import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';

const PARALLAX_STRENGTH = 3.0;
const ASSEMBLY_ELEV = 12; // degrees above the galactic plane (DIRECTION beat 0)

export default function CameraRig({ camDist }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const tweenRef = useRef([]);
  const idleFrames = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const parallaxOffset = useRef({ x: 0, y: 0 });
  const introStarted = useRef(false);

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

  // Beat 0, assembly: the instrument turns on. Camera holds 2.2 R0, 12 degrees
  // above the galactic plane, then drifts in to 1.5 R0 over the assembly's 4.0 s
  // on a long sine.inOut ("held breath"). DIRECTION section 2, beat 0.
  useEffect(() => {
    const seat = (m) => {
      const el = (ASSEMBLY_ELEV * Math.PI) / 180;
      return [0, camDist * m * Math.sin(el), camDist * m * Math.cos(el)];
    };
    const start = seat(2.2);
    const end = seat(1.5);

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

    // The clock starts when the landing overlay is dismissed, not at page load,
    // so a viewer who reads the landing copy still gets the whole assembly.
    if (useStore.getState().introStarted) runDrift(4.0);
    const unsubStart = useStore.subscribe(
      s => s.introStarted,
      (started) => { if (started) runDrift(4.0); }
    );

    // Skip during assembly: fast-forward to the beat 1 seat.
    const unsub = useStore.subscribe(
      s => s.introPhase,
      (phase) => {
        if (phase >= 5 && !introStarted.current) {
          if (driftTween) driftTween.kill();
          gsap.to(camera.position, {
            x: end[0], y: end[1], z: end[2],
            duration: 0.5,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        }
      }
    );

    return () => { if (driftTween) driftTween.kill(); unsubStart(); unsub(); };
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

        const dur = flyTarget.duration || 1.2;
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

  useFrame((state) => {
    const { introPhase, roulettePhase, supernovaPhase, overtureActive } = useStore.getState();
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

  // The user taking the controls ends the handover for good.
  const onStart = () => {
    idleFrames.current = 0;
    sceneRefs.handover.cancelled = true;
    sceneRefs.handover.speed = null;
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
