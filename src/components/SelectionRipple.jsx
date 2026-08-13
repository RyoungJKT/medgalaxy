import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { nR } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';
import { DUR } from '../utils/motion';

// Select (DIRECTION section 4): "the existing selection ripple standardizes
// to 480ms expo.out" — the sanctioned `slow` time constant.
const RIPPLE_DURATION = DUR.slow / 1000;
const MAX_RADIUS = 140;
const RING_WIDTH = 6;

// ── The supernova burst ring, sized to its subject (round 10) ───────────────
// The ring used to be sized in absolute world units (start radius + 220, width
// 10, 0.7 s), constants tuned when every node was a handful of units across.
// Honest normalization since then spread node radii from 1.47 to 54.74, and the
// supernova's own camera frames every subject PROPORTIONALLY (prefocus seats
// the camera at 8x the node's own radius). An absolute ring against a
// proportional frame is a different animation for every disease: measured on
// the live build, peak expansion ran 1.08 frame-half-heights on Heart Disease
// and 6.96 on Rheumatic Heart Disease, a 6.4x spread. On every subject but the
// single biggest node the ring had already left the frame before the first
// frame a viewer perceives. What the user saw was two faint diagonal streaks
// in the corners, which is exactly the "broken" in the report.
//
// So every dimension below is a multiple of the node's own live radius. At the
// supernova's 8x framing that makes the ring pixel-identical for all 153
// diseases; away from that framing (a plain selection, an orbited-out camera)
// the absolute floors keep a 1.5-unit node's ring from vanishing.
export const SN = {
  SURFACE: 1.02,   // born just outside the silhouette: never swallowed, never z-fights
  K_MAX: 5.0,      // the shock front's ceiling, in node radii (license: 3.5-5x)
  K_ECHO: 3.6,     // the trailing echo's own, shallower ceiling
  ECHO_DELAY: 120 / 650, // the echo lags the front by 120 ms of the ring's life
  ECHO_ALPHA: 0.45,
  WIDTH_K: 0.16,   // ring width as a fraction of node radius
  // The tiny-node clamp, and the only one. A node below this radius is ringed
  // as if it were exactly this big: reach, width and echo together, so the
  // ring stays one coherent shape rather than a proportional front with a
  // floored width. It still STARTS at the node's true surface; only the
  // travel is borrowed. Without it the smallest node in the set (1.47 units)
  // would throw a 5.9-unit ring, which is nothing from a normal viewing
  // distance. With it, the widest peak-expansion spread across all 153
  // diseases is 1.18x rather than the 6.4x that was measured before.
  R_FLOOR: 1.8,
  ALPHA: 0.82,     // peak ring alpha. Strictly below the 1.0 bloom threshold,
                   // and below what the pre-round-10 ring already ran at times
                   // its own falloff, so nothing here newly crosses into bloom.
  FLASH_K_IN: 1.0,   // the rim-ignition flash starts exactly at the silhouette,
  FLASH_K_OUT0: 2.0, // so it never lays additive light over the node's own disc
  FLASH_K_OUT1: 2.8, // (the one region that could plausibly already be near 1.0)
  FLASH_ALPHA: 0.42,
  FLASH_LIFE: 180 / 650, // DUR.fast, as a fraction of the ring's life
  IMPULSE: 0.0035,       // camera recoil, as a fraction of fov (see below)
  IMPULSE_MS: 240,
};
const SN_DURATION = DUR.world / 1000; // 650 ms, the sanctioned world constant
// Reduced motion: no expansion at all, one short opacity pulse at the surface.
const REDUCED_DURATION = DUR.mid / 1000; // 320 ms, the sanctioned neighbour of 300

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/**
 * The burst ring's geometry at a moment in its life: the whole sizing law, as
 * a pure function of the subject's radius so it can be pinned by a unit test
 * rather than by a screenshot.
 *
 * @param {number} nodeRadius the subject's LIVE radius (morph/Time-Machine
 *   aware), not its papers radius
 * @param {number} p 0..1 progress through the ring's life
 * @param {boolean} [reduced] prefers-reduced-motion: a fixed-radius pulse
 * @returns {{innerR:number, outerR:number, alpha:number,
 *            echoInnerR:number, echoOuterR:number, echoAlpha:number,
 *            flashInnerR:number, flashOuterR:number, flashAlpha:number}}
 *   Radii are world units from the node's centre; every alpha is 0 when that
 *   element is not currently alive.
 */
export function supernovaRing(nodeRadius, p, reduced = false) {
  const R = Math.max(nodeRadius, 0.01);
  // The ring is BORN on the node's true surface and SIZED off the clamped one,
  // so a very small node still throws a ring you can see without the ring ever
  // detaching from the sphere it came out of.
  const eff = Math.max(R, SN.R_FLOOR);
  const startR = R * SN.SURFACE;
  const width = eff * SN.WIDTH_K;
  const clamped = Math.max(0, Math.min(1, p));

  if (reduced) {
    // One 320 ms opacity pulse at the surface. No expansion, no echo, no flash.
    const a = SN.ALPHA * Math.min(clamped / 0.18, 1) * Math.pow(1 - clamped, 1.4);
    return {
      innerR: startR, outerR: startR + width, alpha: a,
      echoInnerR: startR, echoOuterR: startR, echoAlpha: 0,
      flashInnerR: startR, flashOuterR: startR, flashAlpha: 0,
    };
  }

  const reach = eff * (SN.K_MAX - SN.SURFACE);
  const echoReach = eff * (SN.K_ECHO - SN.SURFACE);

  // DIRECTION section 4 keeps the supernova's own decel curve: "their internal
  // physics (ring speeds, decel curves, easeOutCubic reveal) are already good
  // and stay". back.out(1.2) is sanctioned for the reveal POP, and was tried
  // here for the expansion kick, but an overshoot means a shock front that
  // expands past its ceiling and then retracts, which reads as a glitch rather
  // than a blast. easeOutCubic stays.
  const e = easeOutCubic(clamped);
  const innerR = startR + e * reach;
  const outerR = innerR + width * (1 - clamped * 0.5); // the front thins as it runs
  const alpha = SN.ALPHA * Math.min(clamped / 0.06, 1) * Math.pow(1 - clamped, 1.5);

  // The echo: same law, launched 120 ms later, shallower and fainter. It is
  // what keeps something moving through the frame in the ring's second half,
  // where a single front has already decelerated into a near-static hoop.
  const q = (clamped - SN.ECHO_DELAY) / (1 - SN.ECHO_DELAY);
  let echoInnerR = startR, echoOuterR = startR, echoAlpha = 0;
  if (q > 0) {
    const eq = easeOutCubic(q);
    echoInnerR = startR + eq * echoReach;
    echoOuterR = echoInnerR + width * 0.7 * (1 - q * 0.5);
    echoAlpha = SN.ALPHA * SN.ECHO_ALPHA * Math.min(q / 0.06, 1) * Math.pow(1 - q, 1.5);
  }

  // The rim-ignition flash: a short annulus hugging the silhouette. Its inner
  // edge is the silhouette exactly, so it adds light only to the empty space
  // just outside the node, never on top of the node's own (already bright)
  // disc, which is what makes it provably bloom-safe rather than merely
  // dim.
  const f = Math.min(clamped / SN.FLASH_LIFE, 1);
  const flashInnerR = R * SN.FLASH_K_IN;
  const flashOuterR = R * (SN.FLASH_K_OUT0 + (SN.FLASH_K_OUT1 - SN.FLASH_K_OUT0) * f);
  const flashAlpha = f >= 1 ? 0
    : SN.FLASH_ALPHA * Math.min(f / 0.12, 1) * Math.pow(1 - f, 1.6);

  return { innerR, outerR, alpha, echoInnerR, echoOuterR, echoAlpha,
           flashInnerR, flashOuterR, flashAlpha };
}

const rippleVert = `
  varying float vEdge;
  void main() {
    vEdge = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rippleFrag = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vEdge;
  void main() {
    // Soft falloff from center of ring width
    float edge = abs(vEdge - 0.5) * 2.0;
    float a = uAlpha * (1.0 - edge * edge);
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

// The flash's profile is one-sided, not a band: zero at the inner edge (the
// silhouette), peaking a little outside it, falling to zero at the outer edge.
const flashFrag = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vEdge;
  void main() {
    float rise = smoothstep(0.0, 0.10, vEdge);
    float a = uAlpha * rise * pow(1.0 - vEdge, 2.6);
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function buildRingGeometry(segments) {
  // Flat ring: inner radius = 0, outer radius = 1 (scaled via mesh.scale)
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Inner vertex
    verts.push(cos * 0, sin * 0, 0);   // will offset in frame
    uvs.push(0, i / segments);
    // Outer vertex
    verts.push(cos * 1, sin * 1, 0);
    uvs.push(1, i / segments);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

const SEGMENTS = 96;

/** Rewrites one annulus geometry's rim positions in place. */
function setAnnulus(geo, innerR, outerR) {
  const positions = geo.attributes.position;
  for (let i = 0; i <= SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.setXYZ(i * 2, cos * innerR, sin * innerR, 0);
    positions.setXYZ(i * 2 + 1, cos * outerR, sin * outerR, 0);
  }
  positions.needsUpdate = true;
}

// The live ring's trigger, published by the mounted component. Module-level so
// non-React callers (the Time Machine tour's 2020 shockwave, and the supernova
// reveal's own burst frame) can fire the same ring the selection path uses,
// rather than standing up a second one.
let rippleTrigger = null;

// Dev probe: the ring's live geometry, so the verify harness can measure what
// the viewer is actually looking at (start radius, current inner/outer, alpha)
// instead of re-deriving it from the source. Instrumentation only.
const probe = typeof window !== 'undefined'
  ? (window.__ripple = { active: false, p: -1, innerR: 0, outerR: 0, startR: 0,
                         alpha: 0, sn: false, nodeR: 0, r2Inner: 0, r2Alpha: 0,
                         flashAlpha: 0, fovPunch: 0 })
  : null;

/**
 * Fires the selection ring from a node, in a caller-chosen color.
 * @param {number} idx disease index
 * @param {string} [color] CSS color; defaults to the disease's category color
 * @param {boolean} [supernova] force the supernova variant (the reveal's burst
 *   frame calls this directly, so the ring no longer has to infer the variant
 *   from whatever phase the store happens to be in)
 * @returns {boolean} false when no ripple is mounted or the index is out of range
 */
export function fireRipple(idx, color, supernova) {
  return rippleTrigger ? rippleTrigger(idx, color, supernova) : false;
}

export default function SelectionRipple() {
  const groupRef = useRef();
  const meshRef = useRef();
  const echoRef = useRef();
  const flashRef = useRef();
  const progressRef = useRef(-1); // -1 = inactive
  const startRadiusRef = useRef(0);
  const nodeRadiusRef = useRef(0);
  const posRef = useRef([0, 0, 0]);
  const supernovaRef = useRef(false);
  // Camera recoil at the burst frame. fov is the one camera channel nothing
  // else in the app writes, so a punch here cannot fight CameraRig's position
  // tweens or OrbitControls the way an additive position offset would. 0.35% of
  // fov over 240 ms is the angular equivalent of shoving the camera 0.35% of
  // its distance to the subject, at the supernova's framing that is 1.5 world
  // units on Heart Disease, comfortably inside the constitution's 0.5%-of-R0
  // ceiling for a camera impulse, and quieter still on every smaller node.
  const fovBaseRef = useRef(0);
  const impulseRef = useRef(-1);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const geo = useMemo(() => buildRingGeometry(SEGMENTS), []);
  const echoGeo = useMemo(() => buildRingGeometry(SEGMENTS), []);
  const flashGeo = useMemo(() => buildRingGeometry(SEGMENTS), []);

  const makeMat = (frag) => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffffff') },
      uAlpha: { value: 0 },
    },
    vertexShader: rippleVert,
    fragmentShader: frag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mat = useMemo(() => makeMat(rippleFrag), []);
  const echoMat = useMemo(() => makeMat(rippleFrag), []);
  const flashMat = useMemo(() => makeMat(flashFrag), []);

  useEffect(() => () => {
    [geo, echoGeo, flashGeo].forEach((g) => g.dispose());
    [mat, echoMat, flashMat].forEach((m) => m.dispose());
  }, [geo, echoGeo, flashGeo, mat, echoMat, flashMat]);

  // One trigger for every caller: the selection subscription below, the
  // supernova reveal's burst frame, and the Time Machine's shockwave. The ring
  // starts at the node's radius as it stands right now: its LIVE radius, so
  // it leaves the surface the viewer is actually looking at whether that is the
  // papers sphere, the mortality sphere mid-morph, or that year's Time Machine
  // sphere.
  const trigger = useCallback((idx, color, supernova) => {
    const { curPos, diseases, supernovaPhase } = useStore.getState();
    if (idx == null || idx < 0 || idx >= diseases.length) return false;
    const disease = diseases[idx];
    const pos = curPos[idx];

    posRef.current = [pos[0], pos[1], pos[2]];
    const tm = sceneRefs.tm;
    const live = sceneRefs.nodeRadius ? sceneRefs.nodeRadius(idx) : 0;
    const radius = live > 0
      ? live
      : (tm && tm.active && tm.radiusAt ? tm.radiusAt(idx) : nR(disease.papers));
    nodeRadiusRef.current = radius;
    startRadiusRef.current = radius;
    const col = color || CC[disease.category];
    mat.uniforms.uColor.value.set(col);
    echoMat.uniforms.uColor.value.set(col);
    flashMat.uniforms.uColor.value.set(col);
    const isSN = supernova === undefined ? supernovaPhase === 'burst' : !!supernova;
    supernovaRef.current = isSN;
    progressRef.current = 0; // trigger
    if (isSN && !reducedMotion) impulseRef.current = 0;
    return true;
  }, [mat, echoMat, flashMat, reducedMotion]);

  // Publish the trigger for module-level callers.
  useEffect(() => {
    rippleTrigger = trigger;
    return () => { if (rippleTrigger === trigger) rippleTrigger = null; };
  }, [trigger]);

  // Watch for selection changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.selectedNode,
      (selectedNode) => {
        if (!selectedNode) return;
        // The supernova reveal fires its own ring, on its own burst frame.
        // Without this guard the selection it performs fires a SECOND ring,
        // and in story mode that selection lands 250 ms after the burst, so
        // the ring the viewer got was the late one: tremble, a beat of
        // nothing, then a ring with no detonation left to belong to.
        const { supernovaPhase, supernovaTargetIdx } = useStore.getState();
        const snOwns = supernovaPhase !== 'idle' && supernovaPhase !== 'complete' &&
          selectedNode.index === supernovaTargetIdx;
        if (snOwns) return;
        trigger(selectedNode.index);
      }
    );
    return unsub;
  }, [trigger]);

  useFrame((state, delta) => {
    // ── Camera recoil, independent of the ring's own lifetime ──────────────
    if (impulseRef.current >= 0) {
      const cam = state.camera;
      // Capture the resting fov ONCE per punch, and only while no punch holds
      // it. A story fires three or four bursts back to back; re-capturing on a
      // re-trigger would take an already-punched fov as the new resting one and
      // ratchet the frame wider on every burst, never returning to where it
      // started. 0 means "no base held".
      if (!fovBaseRef.current) fovBaseRef.current = cam.fov;
      impulseRef.current += (delta * 1000) / SN.IMPULSE_MS;
      const k = impulseRef.current;
      if (k >= 1) {
        cam.fov = fovBaseRef.current;
        cam.updateProjectionMatrix();
        impulseRef.current = -1;
        fovBaseRef.current = 0;
        if (probe) probe.fovPunch = 0;
      } else {
        // Instant shove, easeOutCubic recovery: the blast arrives, the frame
        // gives, the frame comes back.
        const amt = SN.IMPULSE * (1 - easeOutCubic(k));
        cam.fov = fovBaseRef.current * (1 + amt);
        cam.updateProjectionMatrix();
        if (probe) probe.fovPunch = amt;
      }
    }

    if (!meshRef.current) return;

    if (progressRef.current < 0 || progressRef.current >= 1) {
      if (groupRef.current) groupRef.current.visible = false;
      if (probe) probe.active = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;
    const isSN = supernovaRef.current;
    const duration = isSN
      ? (reducedMotion ? REDUCED_DURATION : SN_DURATION)
      : RIPPLE_DURATION;
    progressRef.current += delta / duration;
    const p = Math.min(progressRef.current, 1);

    let innerR, outerR, alpha;
    let echoOn = false, flashOn = false;

    if (isSN) {
      const r = supernovaRing(nodeRadiusRef.current, p, reducedMotion);
      innerR = r.innerR; outerR = r.outerR; alpha = r.alpha;
      echoOn = r.echoAlpha > 0.004;
      flashOn = r.flashAlpha > 0.004;
      if (echoOn) {
        setAnnulus(echoGeo, r.echoInnerR, r.echoOuterR);
        echoMat.uniforms.uAlpha.value = r.echoAlpha;
      }
      if (flashOn) {
        setAnnulus(flashGeo, r.flashInnerR, r.flashOuterR);
        flashMat.uniforms.uAlpha.value = r.flashAlpha;
      }
      if (probe) {
        probe.r2Inner = r.echoInnerR; probe.r2Alpha = echoOn ? r.echoAlpha : 0;
        probe.flashAlpha = flashOn ? r.flashAlpha : 0;
      }
    } else {
      // The plain selection ripple (and the Time Machine's shockwave, which
      // rides the same path) keeps its own certified constants: 140/6/480ms.
      // Only its START radius changes here, from the papers estimate to the
      // node's live radius, which is a correctness fix in Mortality mode and a
      // no-op in Papers mode.
      const eased = easeOutCubic(p);
      innerR = startRadiusRef.current + eased * MAX_RADIUS;
      outerR = innerR + RING_WIDTH * (1 - p * 0.5);
      alpha = (1 - p * p) * 0.7;
      if (probe) { probe.r2Inner = 0; probe.r2Alpha = 0; probe.flashAlpha = 0; }
    }

    if (echoRef.current) echoRef.current.visible = echoOn;
    if (flashRef.current) flashRef.current.visible = flashOn;

    setAnnulus(geo, innerR, outerR);
    mat.uniforms.uAlpha.value = alpha;

    // Position at selected node
    if (groupRef.current) {
      groupRef.current.position.set(
        posRef.current[0],
        posRef.current[1],
        posRef.current[2]
      );
      // Billboard: face camera. The annulus sits on the node's centre plane,
      // where the sphere's own silhouette is exactly co-planar, so the ring is
      // born at SURFACE (1.02x) rather than 1.00x, which puts every fragment of
      // it strictly outside the node's projected disc. It can never be
      // swallowed (it only grows from there) and it can never z-fight the
      // sphere (it never overlaps it).
      groupRef.current.quaternion.copy(state.camera.quaternion);
    }

    if (probe) {
      probe.active = true; probe.p = p; probe.innerR = innerR; probe.outerR = outerR;
      probe.startR = startRadiusRef.current; probe.alpha = alpha;
      probe.sn = isSN; probe.nodeR = nodeRadiusRef.current;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={flashRef} geometry={flashGeo} material={flashMat} visible={false} />
      <mesh ref={echoRef} geometry={echoGeo} material={echoMat} visible={false} />
      <mesh ref={meshRef} geometry={geo} material={mat} />
    </group>
  );
}
