import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';
import { ASM, assemblySeat } from '../utils/assembly';
import { cameraBreathe, breatheResumeGain } from '../utils/motion';

const PARALLAX_STRENGTH = 3.0;

// Scratch for the breathing offset — one triple, reused every frame.
const _br = [0, 0, 0];
const _base = new THREE.Vector3();
const _want = new THREE.Vector3();

export default function CameraRig({ camDist }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const tweenRef = useRef([]);
  const idleFrames = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const parallaxOffset = useRef({ x: 0, y: 0 });
  const introStarted = useRef(false);
  // ADDENDUM 1 section 4 item 1: camera breathing. `applied` is this rig's own
  // additive offset, held so it can be removed again before the next one is
  // computed (the cursor parallax two blocks down uses the same bookkeeping).
  // `killed` is the handover's rule: the viewer taking the controls kills it
  // immediately, but not for the session — "scrub at rest, idle" is itself
  // one of the eleven holds the addendum lists, so the kill releases again the
  // instant the camera goes idle (the useFrame block below ties this to the
  // same idleFrames threshold that brings autoRotate back).
  const breathe = useRef({ applied: new THREE.Vector3(), killed: false });
  // prefers-reduced-motion, read once on mount (the same pattern OvertureSequence
  // and TimeMachine use). The film's reduced path replaces every camera move
  // with stillness; an ambient drift underneath it would be the one motion that
  // preference could not turn off, so the breathing is simply not armed.
  const reducedRef = useRef(
    typeof window !== 'undefined' && !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Expose camera to sceneRefs for NodeLabels projection
  useEffect(() => {
    sceneRefs.camera = camera;
  }, [camera]);

  // Expose controls + a direct seat for the overture's deterministic seek
  useEffect(() => {
    sceneRefs.controls = controlsRef.current;
    sceneRefs.cameraJump = (x, y, z) => {
      tweenRef.current.forEach(t => t.kill());
      tweenRef.current = [];
      gsap.killTweensOf(camera.position);
      camera.position.set(x, y, z);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    };
    return () => { sceneRefs.cameraJump = null; };
  }, [camera]);

  // Beat 0, assembly: the galaxy assembles itself. ADDENDUM 1 section 3 moves
  // the opening seat out to 2.9 R0 (was 2.2) at 12 degrees above the galactic
  // plane, drifting in to 1.5 R0 across the full 5.2 s on sine.inOut, plus a
  // 2.5 degree azimuth counter-drift turning *against* the streams' curl so the
  // ten ribbons sweep across frame rather than at it. Which way the ribbons
  // wind is derived from the layout by makePlan, not chosen: `curlSign`.
  //
  // gsap interpolates the position in Cartesian under the same sine.inOut, and
  // assemblySeat() states the identical seat analytically for the harness seek;
  // over a 2.5 degree arc the chord and the arc differ by parts in ten
  // thousand, so playback and seek agree to well under a pixel.
  useEffect(() => {
    const curl = sceneRefs.assembly ? sceneRefs.assembly.curlSign : 1;
    const start = assemblySeat(camDist, curl, 0);
    const end = assemblySeat(camDist, curl, ASM.total);

    // Reduced motion: no drift at all, take the beat 1 seat and hold it.
    const reduced =
      typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      camera.position.set(end[0], end[1], end[2]);
      return undefined;
    }

    camera.position.set(start[0], start[1], start[2]);

    let driftTween = null;
    const runDrift = (duration) => {
      if (driftTween) driftTween.kill();
      driftTween = gsap.to(camera.position, {
        x: end[0], y: end[1], z: end[2],
        duration,
        ease: 'sine.inOut',
        overwrite: 'auto',
      });
    };

    // The harness's beat-0 seek seats the camera analytically, which a live
    // 5.2 s tween would immediately walk away from.
    sceneRefs.killAssemblyDrift = () => { if (driftTween) driftTween.kill(); };

    // The clock starts when the landing overlay is dismissed, not at page load,
    // so a viewer who reads the landing copy still gets the whole assembly.
    if (useStore.getState().introStarted) runDrift(ASM.total);
    const unsubStart = useStore.subscribe(
      s => s.introStarted,
      (started) => { if (started) runDrift(ASM.total); }
    );

    // Skip during assembly: fast-forward to the beat 1 seat.
    const unsub = useStore.subscribe(
      s => s.introPhase,
      (phase) => {
        if (phase >= 5 && !introStarted.current) {
          if (driftTween) driftTween.kill();
          // Tracked like every other camera tween: the overture's first beat
          // dispatches a flyTarget within a frame or two of this fast-forward,
          // and the flyTarget subscriber can only kill what is in tweenRef.
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: end[0], y: end[1], z: end[2],
              duration: 0.5,
              ease: 'power2.out',
              overwrite: 'auto',
            })
          );
        }
      }
    );

    return () => {
      if (driftTween) driftTween.kill();
      if (sceneRefs.killAssemblyDrift) sceneRefs.killAssemblyDrift = null;
      unsubStart();
      unsub();
    };
  }, [camera, camDist]);

  // Subscribe to flyTarget changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.flyTarget,
      (flyTarget) => {
        if (!flyTarget || !controlsRef.current) return;
        // During supernova, only allow the prefocus camera move (phase will be 'prefocus')
        // Block the selectDisease flyTarget during burst/linkwave/settle
        const sp = useStore.getState().supernovaPhase;
        if (sp === 'charge' || sp === 'burst' || sp === 'linkwave') return;
        const controls = controlsRef.current;

        // Kill existing tweens
        tweenRef.current.forEach(t => t.kill());
        tweenRef.current = [];

        // Pause autoRotate during fly to prevent fighting GSAP
        controls.autoRotate = false;
        idleFrames.current = 0;

        // ?? not ||: TimeMachine's reduced-motion tour explicitly passes
        // duration: 0 for a snap cut, which || would discard as falsy and
        // fall back to the default 1.2s tween (Task 17 follow-up review,
        // finding 1). This is the only call site that ever passes 0; every
        // other caller passes undefined or a positive number, so behavior
        // there is unchanged.
        const dur = flyTarget.duration ?? 1.2;
        // Callers may name their own curve (the overture passes the exact
        // easing function it also uses for its analytic seek).
        const ease = flyTarget.ease || 'power3.inOut';
        const onUpdate = () => controls.update();

        tweenRef.current.push(
          gsap.to(controls.target, {
            x: flyTarget.position[0],
            y: flyTarget.position[1],
            z: flyTarget.position[2],
            duration: dur,
            ease,
            onUpdate,
          })
        );

        if (flyTarget.cameraPos) {
          // Explicit camera position (e.g. supernova cinematic angle)
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: flyTarget.cameraPos[0],
              y: flyTarget.cameraPos[1],
              z: flyTarget.cameraPos[2],
              duration: dur,
              ease,
              onUpdate,
            })
          );
        } else if (flyTarget.radius) {
          // Fly toward node from current viewing angle
          const nodePos = new THREE.Vector3(flyTarget.position[0], flyTarget.position[1], flyTarget.position[2]);
          const dir = camera.position.clone().sub(nodePos).normalize();
          const targetPos = nodePos.clone().add(dir.multiplyScalar(flyTarget.radius));
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease,
              onUpdate,
            })
          );
        } else {
          // Fly back: maintain current viewing direction toward origin
          const dir = camera.position.clone().normalize();
          const targetPos = dir.multiplyScalar(camDist);
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease,
              onUpdate,
            })
          );
        }
      }
    );
    return unsub;
  }, [camera]);

  // Track mouse for parallax (desktop only)
  useEffect(() => {
    if (TIER === 'LOW') return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((state, delta) => {
    const { introPhase, roulettePhase, supernovaPhase, overtureActive, overtureBeat } = useStore.getState();
    const handover = sceneRefs.handover;

    if (controlsRef.current) {
      if (handover.speed != null && !handover.cancelled) {
        // Velocity-matched handover: the overture's final glide is still
        // running, and the controls are already turning at its rate so there is
        // no dead frame between film and instrument.
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = handover.speed;
        idleFrames.current = 999;
      } else if (introPhase < 5) {
        controlsRef.current.autoRotate = false;
      } else if (overtureActive) {
        controlsRef.current.autoRotate = false;
      } else if (supernovaPhase !== 'idle' && supernovaPhase !== 'complete') {
        controlsRef.current.autoRotate = false;
      } else if (roulettePhase === 'reveal') {
        controlsRef.current.autoRotate = true;
      } else {
        if (!introStarted.current) introStarted.current = true;
        idleFrames.current++;
        controlsRef.current.autoRotate = idleFrames.current > 300;
      }
    }

    // ── Camera breathing (ADDENDUM 1 section 4 item 1) ──────────────────────
    // The loudest tell of a canned demo is a perfectly static held frame, and
    // this piece has eleven of them, including "scrub at rest, idle" — idle
    // only happens after an interaction, so breathing has to resume there, not
    // just stop. An additive offset applied after all tweens: azimuth +-0.45
    // deg at 0.055 Hz, elevation +-0.25 deg at 0.083 Hz, radius +-0.6 percent
    // at 0.037 Hz, about whatever the controls are currently looking at.
    //
    // Three stillnesses are directed and must stay absolute (A4): beat 2's
    // ignition hold, the detonation push-in, and any active fly. The last two
    // are the same test — every camera move in this piece is a gsap tween on
    // camera.position — and a tween owns the position outright, so the rig
    // simply forgets its offset rather than subtracting it out from under one.
    // Off is instant; on eases back over ~0.5 s in the general case, because
    // an offset re-applied whole on the frame a fly lands would be a visible
    // step.
    //
    // The fourth suppression, onStart's kill, is not a directed stillness —
    // it is a hand on the mouse — so it does not follow that rule. It
    // releases on the exact frame idleFrames crosses the same 300-frame
    // threshold that flips autoRotate back on above, and it ramps in over
    // BREATHE_RESUME_SEC (~2s, breatheResumeGain), slower than the usual
    // ~0.5s: the return from an active drag is a slower context than the
    // return from a directed hold ending.
    {
      const b = breathe.current;
      const controls = controlsRef.current;
      const flying = gsap.isTweening(camera.position);

      if (b.killed && idleFrames.current > 300) {
        b.killed = false;
        b.resumeElapsed = 0;
        b.slowResume = true;
      }

      const directed = b.killed || reducedRef.current || introPhase < 5 ||
        (overtureActive && overtureBeat === 2);
      if (flying) {
        b.applied.set(0, 0, 0);
        b.gain = 0;
      } else if (directed || !controls) {
        if (b.applied.lengthSq() > 0) {
          camera.position.sub(b.applied);
          b.applied.set(0, 0, 0);
        }
        b.gain = 0;
      } else {
        camera.position.sub(b.applied);
        b.applied.set(0, 0, 0);
        if (b.slowResume) {
          b.resumeElapsed = (b.resumeElapsed || 0) + delta;
          b.gain = breatheResumeGain(b.resumeElapsed);
          if (b.gain >= 1) b.slowResume = false;
        } else {
          b.gain = Math.min(1, (b.gain || 0) + delta * 2);
        }
        _base.copy(camera.position).sub(controls.target);
        const r = _base.length();
        if (r > 1e-6) {
          cameraBreathe(state.clock.getElapsedTime(), _br);
          const g = b.gain;
          const az = Math.atan2(_base.x, _base.z) + _br[0] * g;
          const el = Math.asin(Math.max(-1, Math.min(1, _base.y / r))) + _br[1] * g;
          const rr = r * (1 + _br[2] * g);
          const c = Math.cos(el);
          _want.set(rr * c * Math.sin(az), rr * Math.sin(el), rr * c * Math.cos(az)).add(controls.target);
          b.applied.copy(_want).sub(camera.position);
          camera.position.add(b.applied);
        }
      }
    }

    // Subtle cursor parallax (desktop only, after intro and after the film)
    if (TIER !== 'LOW' && introPhase >= 5 && !overtureActive) {
      const targetX = mouseRef.current.x * PARALLAX_STRENGTH;
      const targetY = -mouseRef.current.y * PARALLAX_STRENGTH;
      const prev = parallaxOffset.current;
      prev.x += (targetX - prev.x) * 0.05;
      prev.y += (targetY - prev.y) * 0.05;
      camera.position.x += (prev.x - (camera.userData.lastParX || 0));
      camera.position.y += (prev.y - (camera.userData.lastParY || 0));
      camera.userData.lastParX = prev.x;
      camera.userData.lastParY = prev.y;
    }
  });

  // The user taking the controls ends the handover for good — and, on the same
  // rule, kills the breathing immediately: the rig never adds motion under a
  // hand on the mouse. The offset is left where it stands rather than snapped
  // out, which is what makes this a stop rather than a jump. The kill itself
  // is not permanent — see the useFrame breathing block, which releases it
  // again once idleFrames (reset to 0 right here) crosses the same threshold
  // that brings autoRotate back.
  const onStart = () => {
    idleFrames.current = 0;
    sceneRefs.handover.cancelled = true;
    sceneRefs.handover.speed = null;
    breathe.current.killed = true;
    breathe.current.applied.set(0, 0, 0);
    breathe.current.gain = 0;
    breathe.current.slowResume = false;
    breathe.current.resumeElapsed = 0;
    if (controlsRef.current) controlsRef.current.autoRotateSpeed = 0.3;
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      autoRotateSpeed={0.3}
      minDistance={50}
      maxDistance={camDist * 4}
      onStart={onStart}
      makeDefault
    />
  );
}
