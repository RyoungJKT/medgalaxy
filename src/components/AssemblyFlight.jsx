import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { ASM, makePlan, makeFlight, flightAt, forceLand, assemblySeat } from '../utils/assembly';
import { arrival } from '../utils/motion';

// ─── Beat 0: the galaxy assembles itself instead of switching on ─────────────
// ADDENDUM 1 section 3. Ten curved streams falling in from deep space,
// comet-stretched, filament-tailed, giants landing last, all in monochrome so
// beat 1's color is a reward.
//
// This component is the *driver*, not an owner of node matrices. The ownership
// rule from the scene core stands unchanged: DiseaseNodes' instancing loop is
// the sole writer of every node matrix, on every frame, in every mode. What
// this component does is publish, one frame ahead of that loop, a flight
// override for it to read:
//
//   sceneRefs.assembly = { active, pos, quat, radius, stretch, bright, ... }
//
// When `active`, DiseaseNodes composes from `pos` instead of `curPos`, uses
// `radius` as its scale multiplier in place of the old staged intro ramp, and
// applies `quat` + a non-uniform `stretch` along the local +Y it aligns to the
// velocity. When it is false, not one line of that loop behaves differently
// from before this wave. The quaternion and the non-uniform scale exist ONLY
// while a node is in flight, which is why "every quaternion is identity on beat
// 1's first frame" is a test rather than a hope.
//
// It runs at useFrame priority -1: after IdleDrift (-2, which is inert before
// introPhase 5 anyway) and before DiseaseNodes (0), so the arrays a frame's
// matrices are built from were written in that same frame.
//
// It also owns the filaments: one LineSegments, one draw call, 153 tangent
// tails rewritten per frame, dead at beat 1. All tiers.

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const TAIL_RGB = new THREE.Color(ASM.tailColor);
// The far end of a tail keeps a quarter of the segment's opacity.
const FILAMENT_TAPER = 0.25;

export default function AssemblyFlight({ camDist }) {
  const diseases = useStore(s => s.diseases);
  const count = diseases.length;
  const lineRef = useRef(null);

  // The plan is deterministic: same disease list, same layout, same camera
  // distance gives byte-identical spawns, launches and flights on every load,
  // which is what lets the verify harness seek beat 0 the way it seeks the film.
  const plan = useMemo(
    () => makePlan(diseases, useStore.getState().catPos, camDist),
    [diseases, camDist]
  );

  const buf = useMemo(() => ({
    pos: new Float32Array(count * 3),
    quat: new Float32Array(count * 4),
    radius: new Float32Array(count).fill(ASM.rStart),
    stretch: new Float32Array(count).fill(1),
    bright: new Float32Array(count).fill(ASM.brightMin),
    flying: new Uint8Array(count),
    // Skip fast-forward: where each node was on the frame the input landed.
    fromPos: new Float32Array(count * 3),
    fromR: new Float32Array(count),
    fromB: new Float32Array(count),
  }), [count]);

  const linePos = useMemo(() => new Float32Array(count * 6), [count]);
  const lineCol = useMemo(() => new Float32Array(count * 6), [count]);

  const st = useRef({
    started: false,
    dead: false,      // reduced motion / a session that never plays beat 0
    t0: null,
    fastFrom: null,   // clock time the skip fast-forward began
    fastT: 0,         // ...and the assembly time it began at
    flight: makeFlight(),
    from3: [0, 0, 0],
  });

  // Publish the override the instancing loop reads. Seeded at the spawns with
  // 0.55 radius and identity quaternions, so the very first painted frame is
  // already the frame the direction asks for even if this component's first
  // useFrame has not run yet (first-frame integrity, honored harder).
  useEffect(() => {
    const a = {
      active: false,
      plan,
      count,
      t: 0,
      pos: buf.pos,
      quat: buf.quat,
      radius: buf.radius,
      stretch: buf.stretch,
      bright: buf.bright,
      flying: buf.flying,
      inFlight: 0,
      landed: 0,
      seekT: null,       // harness: a frozen beat-0 clock, read by IntroSequence too
      t0: null,
      curlSign: plan.curlSign,
      total: ASM.total,
      latest: plan.latest,
    };
    for (let i = 0; i < count; i++) {
      a.pos[i * 3] = plan.spawn[i * 3];
      a.pos[i * 3 + 1] = plan.spawn[i * 3 + 1];
      a.pos[i * 3 + 2] = plan.spawn[i * 3 + 2];
      a.quat[i * 4] = 0; a.quat[i * 4 + 1] = 0; a.quat[i * 4 + 2] = 0; a.quat[i * 4 + 3] = 1;
      a.radius[i] = ASM.rStart;
      a.stretch[i] = 1;
      a.bright[i] = ASM.brightMin;
      a.flying[i] = 0;
    }
    // Reduced motion (and any reload straight into the instrument) never plays
    // beat 0 at all: IntroSequence has already declared phase 5, and the
    // reduced viewer is not made to watch stillness.
    if (useStore.getState().introPhase >= 5) st.current.dead = true;
    sceneRefs.assembly = a;
    return () => { if (sceneRefs.assembly === a) sceneRefs.assembly = null; };
  }, [plan, buf, count]);

  // Dev hook: deterministic beat-0 capture, the mirror of window.__overture.
  //   await window.__assembly.seek(3.2)   → freeze the assembly clock at 3.2 s
  //   window.__assembly.resume()          → let it play on
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const waitFrames = (n) => new Promise((res) => {
      let k = n;
      const tick = () => (--k <= 0 ? res(true) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    window.__assembly = {
      seek: (t, frames = 12) => {
        const s = useStore.getState();
        if (st.current.dead || s.introPhase >= 5) return Promise.resolve(false);
        if (!s.introStarted) s.setIntroStarted();
        const a = sceneRefs.assembly;
        if (!a) return Promise.resolve(false);
        a.seekT = Math.max(0, Math.min(ASM.total, t));
        st.current.fastFrom = null;
        // The camera drift is a gsap tween, so a seek has to kill it and seat
        // the camera analytically or the two clocks fight for the frame.
        if (sceneRefs.killAssemblyDrift) sceneRefs.killAssemblyDrift();
        const p = assemblySeat(camDist, plan.curlSign, a.seekT);
        if (sceneRefs.cameraJump) sceneRefs.cameraJump(p[0], p[1], p[2]);
        return waitFrames(frames);
      },
      resume: () => { if (sceneRefs.assembly) sceneRefs.assembly.seekT = null; },
      state: () => {
        const a = sceneRefs.assembly;
        const line = lineRef.current;
        return a
          ? { active: a.active, t: a.t, inFlight: a.inFlight, landed: a.landed,
              latest: a.latest, total: a.total, curlSign: a.curlSign,
              seek: a.seekT, dead: st.current.dead,
              filaments: line && line.visible ? (line.geometry.drawRange.count || 0) / 2 : 0,
              maxStretch: (() => { let m = 1; for (let i = 0; i < a.count; i++) if (a.stretch[i] > m) m = a.stretch[i]; return +m.toFixed(3); })(),
              maxBright: (() => { let m = 0; for (let i = 0; i < a.count; i++) if (a.bright[i] > m) m = a.bright[i]; return +m.toFixed(3); })() }
          : null;
      },
    };
    return () => { delete window.__assembly; };
  }, [camDist, plan]);

  useFrame((state) => {
    const a = sceneRefs.assembly;
    if (!a) return;
    const store = useStore.getState();
    const clock = state.clock.getElapsedTime();
    const s = st.current;

    if (s.dead) { a.active = false; return; }

    if (!s.started) {
      if (!store.introStarted) return;
      if (store.introPhase >= 5) { s.dead = true; a.active = false; return; }
      s.started = true;
      s.t0 = clock;
      // IntroSequence reads this so the phase clock and the flight clock are
      // the same clock, to the frame.
      a.t0 = clock;
      a.active = true;
    }

    // ── The skip: "the existing 0.5 s power2.out fast-forward to the beat 1
    // seat stands, and now also force-lands every node over the same 0.5 s on
    // the same arrival() curve." Anything that declares phase 5 while the
    // assembly is still running is a skip, whether it came from an input, from
    // the overture's own chain-through, or from the harness.
    //
    // The stretch and the quaternion do NOT ride the fast-forward: they are
    // dropped to identity on the frame the skip lands. Beat 1 begins on that
    // frame, and "every quaternion must be identity on beat 1's first frame"
    // is the harder of the two promises. A node still travelling for another
    // half second is a node travelling as a sphere.
    if (a.active && store.introPhase >= 5 && s.fastFrom == null) {
      let anyFlying = false;
      for (let i = 0; i < count; i++) if (!isLanded(plan, i, elapsed(s, clock))) { anyFlying = true; break; }
      if (!anyFlying) {
        // The natural end: everything is already seated at radius 1 with an
        // identity quaternion, so there is nothing to fast-forward.
        finish(a, buf, count);
        s.dead = true;
        drawFilaments(lineRef, 0);
        return;
      }
      s.fastFrom = clock;
      const t = elapsed(s, clock);
      s.fastT = t;
      for (let i = 0; i < count; i++) {
        flightAt(plan, i, t, s.flight);
        buf.fromPos[i * 3] = s.flight.x;
        buf.fromPos[i * 3 + 1] = s.flight.y;
        buf.fromPos[i * 3 + 2] = s.flight.z;
        buf.fromR[i] = s.flight.radius;
        buf.fromB[i] = Math.min(1, s.flight.bright);
      }
    }

    if (s.fastFrom != null) {
      const k = arrival((clock - s.fastFrom) / ASM.skip);
      const from = s.from3;
      let live = 0;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        from[0] = buf.fromPos[i3]; from[1] = buf.fromPos[i3 + 1]; from[2] = buf.fromPos[i3 + 2];
        const f = forceLand(plan, i, from, buf.fromR[i], buf.fromB[i], k, s.flight);
        buf.pos[i3] = f.x; buf.pos[i3 + 1] = f.y; buf.pos[i3 + 2] = f.z;
        buf.radius[i] = f.radius;
        buf.bright[i] = f.bright;
        buf.stretch[i] = 1;
        buf.quat[i * 4] = 0; buf.quat[i * 4 + 1] = 0; buf.quat[i * 4 + 2] = 0; buf.quat[i * 4 + 3] = 1;
        buf.flying[i] = f.flying ? 1 : 0;
        if (f.flying) live++;
      }
      a.inFlight = live;
      a.landed = count - live;
      // The assembly clock rides the same curve the nodes do, so every channel
      // keyed off it (the fog range, the dust settle) fast-forwards with them
      // instead of snapping on the frame the input landed.
      a.t = s.fastT + (ASM.total - s.fastT) * k;
      drawFilaments(lineRef, 0);
      if (k >= 1) { finish(a, buf, count); s.dead = true; }
      return;
    }

    const t = elapsed(s, clock);
    a.t = t;

    let live = 0;
    let landed = 0;
    let tails = 0;
    for (let i = 0; i < count; i++) {
      const f = flightAt(plan, i, t, s.flight);
      const i3 = i * 3;
      buf.pos[i3] = f.x; buf.pos[i3 + 1] = f.y; buf.pos[i3 + 2] = f.z;
      buf.radius[i] = f.radius;
      buf.stretch[i] = f.stretch;
      buf.bright[i] = f.bright;
      buf.flying[i] = f.flying ? 1 : 0;
      if (f.flying) live++;
      if (f.landed) landed++;

      // The comet's own axis: the instance quaternion aligns local +Y to the
      // velocity direction, one setFromUnitVectors per node per frame, zero
      // extra draw calls. At rest the velocity IS +Y, so the quaternion is
      // exactly identity and nothing is spent on a node that has landed.
      const i4 = i * 4;
      if (f.stretch > 1.0001) {
        _v.set(f.vx, f.vy, f.vz);
        _q.setFromUnitVectors(UP, _v);
        buf.quat[i4] = _q.x; buf.quat[i4 + 1] = _q.y; buf.quat[i4 + 2] = _q.z; buf.quat[i4 + 3] = _q.w;
      } else {
        buf.quat[i4] = 0; buf.quat[i4 + 1] = 0; buf.quat[i4 + 2] = 0; buf.quat[i4 + 3] = 1;
      }

      if (f.alpha > 0.002) {
        const v6 = tails * 6;
        linePos[v6] = f.tx; linePos[v6 + 1] = f.ty; linePos[v6 + 2] = f.tz;
        linePos[v6 + 3] = f.x; linePos[v6 + 4] = f.y; linePos[v6 + 5] = f.z;
        // The segment carries its own 0.25 * min(1, v/v_ref), tapering to a
        // quarter of that at the far end rather than to nothing: a hard-ended
        // line reads as a stick, and a line that fades to black reads as half
        // the filament it is. #1b2740 at a quarter alpha is 7 counts of blue on
        // an 8-bit display, so every one of those counts is load-bearing.
        const a0 = f.alpha * FILAMENT_TAPER;
        lineCol[v6] = TAIL_RGB.r * a0;
        lineCol[v6 + 1] = TAIL_RGB.g * a0;
        lineCol[v6 + 2] = TAIL_RGB.b * a0;
        lineCol[v6 + 3] = TAIL_RGB.r * f.alpha;
        lineCol[v6 + 4] = TAIL_RGB.g * f.alpha;
        lineCol[v6 + 5] = TAIL_RGB.b * f.alpha;
        tails++;
      }
    }
    a.inFlight = live;
    a.landed = landed;
    drawFilaments(lineRef, tails);
  }, -1);

  return (
    <lineSegments ref={lineRef} frustumCulled={false} visible={false} renderOrder={-3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count * 2} array={linePos} itemSize={3} usage={THREE.DynamicDrawUsage} />
        <bufferAttribute attach="attributes-color" count={count * 2} array={lineCol} itemSize={3} usage={THREE.DynamicDrawUsage} />
      </bufferGeometry>
      {/* Additive, deliberately: on a black field it paints the identical
          #1b2740 a normal-blended line would, but where a stream's own tails
          overlap they accumulate, and that accumulation is the difference
          between 153 separate streaks and ten visible ribbons. It cannot reach
          the bloom threshold the ignite ramp is reserved for -- the brightest
          possible filament pixel is 0.25 of a color whose luminance is 0.13. */}
      <lineBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// Elapsed assembly seconds, honoring a harness seek. Published on
// sceneRefs.assembly so IntroSequence's phase clock and this flight clock are
// the same number on the same frame, seek or no seek.
function elapsed(s, clock) {
  const a = sceneRefs.assembly;
  if (a && a.seekT != null) return a.seekT;
  return clock - s.t0;
}

function isLanded(plan, i, t) {
  return t >= plan.t0[i] + plan.dur[i];
}

// Beat 1 owns the field from here: every node seated, radius 1, stretch 1,
// quaternion identity, brightness 1, filaments dead.
function finish(a, buf, count) {
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    buf.pos[i3] = a.plan.seat[i3];
    buf.pos[i3 + 1] = a.plan.seat[i3 + 1];
    buf.pos[i3 + 2] = a.plan.seat[i3 + 2];
    buf.radius[i] = 1;
    buf.stretch[i] = 1;
    buf.bright[i] = 1;
    buf.flying[i] = 0;
    buf.quat[i * 4] = 0; buf.quat[i * 4 + 1] = 0; buf.quat[i * 4 + 2] = 0; buf.quat[i * 4 + 3] = 1;
  }
  a.inFlight = 0;
  a.landed = count;
  a.active = false;
}

function drawFilaments(lineRef, tails) {
  const line = lineRef.current;
  if (!line) return;
  if (!tails) { line.visible = false; line.geometry.setDrawRange(0, 0); return; }
  line.visible = true;
  line.geometry.setDrawRange(0, tails * 2);
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.attributes.color.needsUpdate = true;
}
