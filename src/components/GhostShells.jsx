import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { TM_GHOST } from '../utils/motion';

// ─── Accent 1: the ghost shell (ADDENDUM 1 section 2.3) ──────────────────────
// The hero accent. On each accented node, a sphere at the node's centre held at
// the radius it had in the year just left: category color, MeshBasicMaterial,
// transparent, depthWrite off, normal blending — never additive, because the
// bloom threshold stays reserved for the ignite ramp. Opacity 0.30 to 0, linear,
// over 480 ms. The ghost never scales.
//
// Growth reads as a node breaking out of its old shell; shrinkage reads as a
// node falling inside it. That is the whole idea: it renders the year-over-year
// delta as a visible geometric difference rather than asking the eye to
// remember a frame from 360 ms ago, which is the actual perceptual problem the
// client's note is about.
//
// Cost: one pooled InstancedMesh of 8 slots, LRU recycled, one draw call, one
// geometry, one material, on every tier.
//
// Per-instance opacity is the one thing a stock material cannot express. A
// crossing fires up to three shells at once and the next crossing arrives
// 360 ms later while the previous generation still has 120 ms of fade left, so
// two generations are alive at different alphas by design (8 slots is
// deliberately more than one generation of 3). `instanceColor` multiplies the
// diffuse term only, and fading a normal-blended sphere toward black on a dark
// field reads as a hole, not as a fade. So the built-in basic shader carries a
// three-line `onBeforeCompile` injection of an `aGhostAlpha` instanced
// attribute. It is a patch to a stock program, not an authored shader: no new
// program, no uniforms driven per frame, no tier gate, and it behaves
// identically on the LOW path, which has no custom shaders of its own.
const SEG = 16;

// The live pool's trigger, published by the mounted component. Module-level so
// the Time Machine's accent engine (a non-React caller, inside useFrame) fires
// the same pool the component owns, exactly as fireRipple does for the ring.
let ghostTrigger = null;
let ghostClear = null;

/**
 * Fires up to `slots` ghost shells, one per accented node.
 * @param {Array<{index:number, radius:number, color:string}>} picks
 * @param {boolean} [reduced] prefers-reduced-motion: a single 300 ms dissolve
 *   with no fade curve, in place of the 480 ms linear fade
 * @returns {number} how many shells were actually lit
 */
export function fireGhosts(picks, reduced = false) {
  return ghostTrigger ? ghostTrigger(picks, reduced) : 0;
}

/** Drops every live shell on the same frame (the Time Machine closing, a skip). */
export function clearGhosts() {
  if (ghostClear) ghostClear();
}

export default function GhostShells() {
  const meshRef = useRef(null);
  // One slot record per instance: `t0` is the ms clock the shell was lit at,
  // `dur` its own fade length, `seq` a monotonic counter that makes "least
  // recently used" a comparison rather than a scan of timestamps that can tie
  // inside one frame.
  const slotsRef = useRef(
    Array.from({ length: TM_GHOST.slots }, () => ({ live: false, t0: 0, dur: TM_GHOST.dur, seq: -1 }))
  );
  const seqRef = useRef(0);

  const geo = useMemo(() => new THREE.SphereGeometry(1, SEG, SEG), []);

  const { mat, alphaAttr } = useMemo(() => {
    const arr = new Float32Array(TM_GHOST.slots);
    const attr = new THREE.InstancedBufferAttribute(arr, 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    const m = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      // depthTest off, the same deliberate overdraw the 2020 flash already
      // makes, and here it is the accent rather than a tradeoff. Half of what
      // the ghost is for is growth: a node breaking out of its old shell. But a
      // shell smaller than the node it belongs to is *inside* an opaque sphere,
      // so with depth testing on, every growth ghost in the piece would be
      // invisible and only shrinkage would ever read. Drawn over the node, the
      // old radius stays legible in both directions: a translucent disc of the
      // previous silhouette, with the new node around it or inside it.
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float aGhostAlpha;\nvarying float vGhostAlpha;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGhostAlpha = aGhostAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vGhostAlpha;\nvoid main() {')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n\tgl_FragColor.a *= vGhostAlpha;');
    };
    return { mat: m, alphaAttr: attr };
  }, []);

  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  // Wire the per-instance alpha attribute onto the instanced geometry once the
  // mesh exists, and start every slot dark so an unfired pool is invisible
  // rather than eight unit spheres at the origin.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.setAttribute('aGhostAlpha', alphaAttr);
    const m4 = new THREE.Matrix4();
    m4.makeScale(0, 0, 0);
    for (let s = 0; s < TM_GHOST.slots; s++) {
      mesh.setMatrixAt(s, m4);
      alphaAttr.array[s] = 0;
    }
    mesh.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    mesh.count = TM_GHOST.slots;
  }, [alphaAttr]);

  useEffect(() => {
    const _m4 = new THREE.Matrix4();
    const _v3 = new THREE.Vector3();
    const _q4 = new THREE.Quaternion();
    const _s3 = new THREE.Vector3();
    const _c = new THREE.Color();

    const trigger = (picks, reduced) => {
      const mesh = meshRef.current;
      if (!mesh || !picks || !picks.length) return 0;
      const { curPos } = useStore.getState();
      const slots = slotsRef.current;
      const now = performance.now();
      const dur = reduced ? TM_GHOST.reduced : TM_GHOST.dur;
      let lit = 0;
      for (const p of picks) {
        const pos = curPos && curPos[p.index];
        if (!pos || !(p.radius > 0)) continue;
        // LRU: the first dead slot, else the oldest live one. Eight slots
        // against three per crossing means an eviction only ever takes a shell
        // that is already two generations and 720 ms old.
        let slot = -1;
        for (let s = 0; s < slots.length; s++) {
          if (!slots[s].live) { slot = s; break; }
          if (slot < 0 || slots[s].seq < slots[slot].seq) slot = s;
        }
        const rec = slots[slot];
        rec.live = true;
        rec.t0 = now;
        rec.dur = dur;
        rec.seq = seqRef.current++;
        _v3.set(pos[0], pos[1], pos[2]);
        // The shell is placed once and never touched again: it holds the old
        // radius while the node itself moves off it. "The ghost never scales."
        _s3.setScalar(p.radius);
        _m4.compose(_v3, _q4, _s3);
        mesh.setMatrixAt(slot, _m4);
        _c.set(p.color || '#94a3b8');
        mesh.setColorAt(slot, _c);
        alphaAttr.array[slot] = TM_GHOST.alpha;
        lit++;
      }
      if (lit) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        alphaAttr.needsUpdate = true;
      }
      return lit;
    };

    const clear = () => {
      const mesh = meshRef.current;
      const slots = slotsRef.current;
      for (let s = 0; s < slots.length; s++) {
        slots[s].live = false;
        alphaAttr.array[s] = 0;
      }
      if (mesh) alphaAttr.needsUpdate = true;
    };

    ghostTrigger = trigger;
    ghostClear = clear;
    // Dev hook: the verify harness's acceptance for section 2.4 item 12 counts
    // shells at crossing + 200 ms and again at crossing + 600 ms, which is not
    // a thing a screenshot can assert on its own.
    if (typeof window !== 'undefined') {
      window.__ghosts = () => slotsRef.current.map((s, i) => ({
        slot: i,
        live: s.live,
        alpha: alphaAttr.array[i],
        age: s.live ? performance.now() - s.t0 : null,
      })).filter((s) => s.live);
    }
    return () => {
      if (ghostTrigger === trigger) ghostTrigger = null;
      if (ghostClear === clear) ghostClear = null;
      if (typeof window !== 'undefined') delete window.__ghosts;
    };
  }, [alphaAttr]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const slots = slotsRef.current;
    const now = performance.now();
    let dirty = false;
    let anyLive = false;
    for (let s = 0; s < slots.length; s++) {
      const rec = slots[s];
      if (!rec.live) continue;
      const p = (now - rec.t0) / rec.dur;
      if (p >= 1) {
        rec.live = false;
        alphaAttr.array[s] = 0;
        dirty = true;
        continue;
      }
      anyLive = true;
      // Linear, per the addendum. An eased fade would put the shell's most
      // visible moment somewhere other than the frame the change happened on.
      alphaAttr.array[s] = TM_GHOST.alpha * (1 - p);
      dirty = true;
    }
    if (dirty) alphaAttr.needsUpdate = true;
    // An empty pool costs nothing to skip, and skipping it is what keeps the
    // ghost's whole cost proportional to the ~1.4 s a year the accents are up.
    mesh.visible = anyLive;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, TM_GHOST.slots]}
      frustumCulled={false}
      visible={false}
      renderOrder={2}
    />
  );
}
