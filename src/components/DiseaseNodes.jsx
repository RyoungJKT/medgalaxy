import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { nR, nRM } from '../utils/helpers';
import { CC, CATS } from '../utils/constants';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';
import { useAttentionColors } from './AttentionMap';
import { igniteWeights } from '../utils/igniteWeights';
import { lagFactor, staggeredEase, springStepInto, DUR, AMBIENT } from '../utils/motion';
import { ASM, fogRangeAt } from '../utils/assembly';
import plasmaVert from '../shaders/plasma.vert.glsl?raw';
import plasmaFrag from '../shaders/plasma.frag.glsl?raw';
import pulseVert from '../shaders/pulse.vert.glsl?raw';
import pulseFrag from '../shaders/pulse.frag.glsl?raw';

const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();
const _q4 = new THREE.Quaternion();
const _s3 = new THREE.Vector3();
// Scratch pair for the hover spring's per-node, per-frame step (150+ nodes x
// 60fps) — springStepInto writes into this instead of allocating a [x, v]
// tuple every iteration of the instancing loop.
const _spring = [0, 0];
// Scratch [near, far] for the beat-0 fog range.
const _fog = [0, 0];

// Category index lookup for aCatId attribute
const CAT_INDEX = {};
CATS.forEach((c, i) => { CAT_INDEX[c] = i; });

// Hover (DIRECTION section 4): "Node scales 1.00 to 1.06 in 120ms" — the
// world family's critically damped spring, at the sanctioned `tick` constant.
const HOVER_TC = DUR.tick / 1000;
const HOVER_SCALE = 1.06;

// ── Carry-over A (direction 9/10 item 5, deferred from Task 11): mass-weighted
// morph stagger. "Per-node duration scales with sqrt of target radius so
// massive nodes move slowly" (DIRECTION section 2 beat 2 / section 6 item 5).
// Exported so the endpoint guarantee — morphT 0 lands on exactly nR(papers)
// and morphT 1 on exactly nRM(mortality), for every node, regardless of lag —
// is a plain unit test rather than a pixel comparison.
//
// Fix (review, direction-reversal pop): a node's lag factor is now
// DIRECTION-INDEPENDENT — computed once from whichever of its two radii
// (papers or mortality) is larger, i.e. the bigger of the two trips it could
// ever be asked to make. The old version recomputed a whole second lag table
// from the *new* target the instant the morph direction reversed, which
// silently swapped a node's eased radius mid-frame (a quick "Mortality then
// Papers" double click could jump one node's radius by double digits in a
// single frame). One static table per disease list, no reversal swap, same
// endpoint invariant (staggeredEase(0)=0, staggeredEase(1)=1 for every L).
export function computeLagFactors(diseases) {
  const n = diseases.length;
  const L = new Float32Array(n);
  const rTarget = new Float32Array(n);
  let rMax = 0;
  for (let i = 0; i < n; i++) {
    rTarget[i] = Math.max(nR(diseases[i].papers), nRM(diseases[i].mortality));
    if (rTarget[i] > rMax) rMax = rTarget[i];
  }
  for (let i = 0; i < n; i++) L[i] = lagFactor(rTarget[i], rMax);
  return L;
}

// This node's radius at a given global morph progress `morphT` (0 = papers,
// 1 = mortality) and its own lag factor `L` from computeLagFactors.
export function morphRadiusAt(disease, morphT, L) {
  const ease = staggeredEase(morphT, L);
  return nR(disease.papers) * (1 - ease) + nRM(disease.mortality) * ease;
}

export default function DiseaseNodes() {
  const meshRef = useRef();
  const diseases = useStore(s => s.diseases);
  const shaderMode = useStore(s => s.shaderMode);
  const count = diseases.length;
  const mobDevice = TIER === 'LOW';

  // Wire up attention-map recoloring (neglectMode toggle)
  useAttentionColors(meshRef);

  // Pre-compute intro reveal data: hero index, constellation set, distance-from-hero
  const introData = useMemo(() => {
    // Find hero (most papers = rank 0, positioned at origin)
    let heroIdx = 0;
    let maxPapers = 0;
    for (let i = 0; i < count; i++) {
      if (diseases[i].papers > maxPapers) { maxPapers = diseases[i].papers; heroIdx = i; }
    }
    const heroCategory = diseases[heroIdx].category;
    const catPos = useStore.getState().catPos;

    // Constellation: same category as hero + spatially nearest
    const constellation = new Set([heroIdx]);
    const heroPos = catPos[heroIdx];

    // Compute distances from hero for all nodes
    const distances = new Float32Array(count);
    let maxDist = 0;
    for (let i = 0; i < count; i++) {
      const dx = catPos[i][0] - heroPos[0];
      const dy = catPos[i][1] - heroPos[1];
      const dz = catPos[i][2] - heroPos[2];
      distances[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distances[i] > maxDist) maxDist = distances[i];
    }
    // Normalize distances to 0–1
    const normDist = new Float32Array(count);
    for (let i = 0; i < count; i++) normDist[i] = maxDist > 0 ? distances[i] / maxDist : 0;

    // Add same-category nodes as constellation (up to 12)
    const sameCat = [];
    for (let i = 0; i < count; i++) {
      if (i !== heroIdx && diseases[i].category === heroCategory) {
        sameCat.push({ i, dist: distances[i] });
      }
    }
    sameCat.sort((a, b) => a.dist - b.dist);
    for (let j = 0; j < Math.min(11, sameCat.length); j++) {
      constellation.add(sameCat[j].i);
    }

    return { heroIdx, constellation, normDist };
  }, [count, diseases]);

  // Intro scale tracking
  const introScalesRef = useRef(null);
  const introDoneRef = useRef(false);
  // Beat 0 fly-in: the frame the flight stops owning the field, every channel
  // it wrote has to be handed back exactly once (attribute to 1.0, colors to
  // the category palette) rather than every frame for the rest of the session.
  const asmWasActive = useRef(false);
  const baseColRef = useRef(null);
  // Size-morph engine: smoothed sizeMode toggle + per-node hover breathe
  const morphRef = useRef(0);
  const hoverScaleRef = useRef(new Float32Array(count).fill(1));
  const hoverVelRef = useRef(new Float32Array(count));
  // Carry-over A: per-node lag factors — direction-independent (see
  // computeLagFactors above), so this only needs to change when the disease
  // list itself changes, never mid-transition.
  const lag = useMemo(() => computeLagFactors(diseases), [diseases]);
  // prefers-reduced-motion, read once on mount: the micro-breathe is ambient
  // motion with no informational content, which is exactly what that preference
  // asks to be spared.
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // ── The one true "how big is node i" (round 10) ──────────────────────────
  // The instancing pass below is the only place that knows a node's live
  // radius: it owns the smoothed morph position AND the lag table, and it
  // defers to the Time Machine when that owns radius instead. Everything else
  // that needs a node's size (the supernova's camera framing, its tremble
  // amplitude, the burst ring's start radius) used to re-derive it as
  // `nR(papers)`, which is only correct while the size toggle sits on Papers.
  // In Mortality mode that estimate is wrong by up to 13x (cystic-fibrosis
  // reads 11.19 by papers against a live 0.82), which is how the burst ring
  // ended up detached from small nodes and born *inside* big ones.
  //
  // Two answers, because there are two honest questions:
  //   resting=false: what the sphere measures THIS FRAME, transient owners and
  //     all. What the burst ring wants: it has to be born on the surface that
  //     is actually on screen, whether that is the papers sphere, a half-done
  //     morph, or the Time Machine's sphere for that year.
  //   resting=true : the radius this node RETURNS to once every transient
  //     owner lets go: the papers/mortality morph's endpoint, full stop. What
  //     anything sizing a lasting decision wants. The supernova picks its
  //     camera distance once, at prefocus, and then holds it for 2.2 s, so it
  //     must not be picked off a value that is still moving. Both movers are
  //     real and both were measured: mid-morph, Heart Disease reads 12.28
  //     against a resting 54.74; and because a supernova triggered during the
  //     Time Machine tears it down on the way in (triggerSupernova calls
  //     stopTimeMachine), a prefocus that read the tour's year-radius framed
  //     the reveal's own hero node four times too close.
  useEffect(() => {
    sceneRefs.nodeRadius = (i, resting) => {
      if (i == null || i < 0 || i >= diseases.length) return 0;
      const L = lag ? lag[i] : 1;
      if (resting) {
        const target = useStore.getState().sizeMode === 'mortality' ? 1 : 0;
        return morphRadiusAt(diseases[i], target, L);
      }
      const tm = sceneRefs.tm;
      if (tm && tm.active && tm.radiusAt) return tm.radiusAt(i);
      return morphRadiusAt(diseases[i], morphRef.current, L);
    };
    return () => { sceneRefs.nodeRadius = null; };
  }, [diseases, lag]);

  // ADDENDUM 1 section 4 item 4: the resting galaxy micro-breathe rides the
  // same aPhase the shaders do, so the geometry's own attribute is built here
  // and kept, rather than generated inside the memo and thrown away. `bFreq` is
  // that phase mapped once onto 0.10-0.16 Hz — a per-node frequency, so the
  // field never pulses as one mass, precomputed because the frame loop may not
  // do division 153 times for an ambient channel that costs "literally zero".
  const breathe = useMemo(() => {
    const phases = new Float32Array(count);
    const freq = new Float32Array(count);
    const [lo, hi] = AMBIENT.node.hz;
    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      freq[i] = 2 * Math.PI * (lo + (hi - lo) * (phases[i] / (2 * Math.PI)));
    }
    return { phases, freq };
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, mobDevice ? 16 : 32, mobDevice ? 16 : 32);
    const phases = breathe.phases;
    const catIds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      catIds[i] = CAT_INDEX[diseases[i].category] || 0;
    }
    const { ignite, ember } = igniteWeights(diseases);
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    g.setAttribute('aCatId', new THREE.InstancedBufferAttribute(catIds, 1));
    g.setAttribute('aIgnite', new THREE.InstancedBufferAttribute(ignite, 1));
    g.setAttribute('aEmber', new THREE.InstancedBufferAttribute(ember, 1));
    // ADDENDUM 1 section 3: the fly-in's brightness channel, 0.35 at launch to
    // 1.00 at landing plus the 180 ms landing pip. HIGH and MEDIUM ride this
    // shader attribute; LOW has no custom shaders and rides instanceColor
    // instead (see the frame loop). Exactly 1.0 outside beat 0, so the shaders
    // multiply by one for the whole rest of the session.
    const flight = new Float32Array(count).fill(1);
    const fa = new THREE.InstancedBufferAttribute(flight, 1);
    fa.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aFlight', fa);
    return g;
  }, [count, mobDevice, diseases, breathe]);

  const fogUniforms = useMemo(() => ({
    fogColor: { value: new THREE.Color(0x000000) },
    fogNear: { value: 400.0 },
    fogFar: { value: 2000.0 },
  }), []);

  // Overture grade uniforms — separate objects per material (each material owns
  // its own, both fed from sceneRefs.fx every frame).
  const gradeUniforms = () => ({
    igniteAmount: { value: 0 },
    desatAmount: { value: 0 },
    emberAmount: { value: 0 },
    igniteContrast: { value: 1 },
  });

  const plasmaMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, usePlasma: { value: TIER === 'HIGH' ? 1.0 : 0.0 }, ...fogUniforms, ...gradeUniforms() },
      vertexShader: plasmaVert,
      fragmentShader: plasmaFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const pulseMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, ...fogUniforms, ...gradeUniforms() },
      vertexShader: pulseVert,
      fragmentShader: pulseFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const fallbackMat = useMemo(() => {
    if (!mobDevice) return null;
    return new THREE.MeshPhongMaterial({ transparent: true, opacity: 1.0, shininess: 90, specular: new THREE.Color(0x444444) });
  }, [mobDevice]);

  const mat = mobDevice ? fallbackMat : (shaderMode === 'pulse' ? pulseMat : plasmaMat);

  // Initialize instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const catPos = useStore.getState().catPos;

    // Reset intro scales on remount (shader toggle)
    introScalesRef.current = new Float32Array(count);
    introDoneRef.current = useStore.getState().introPhase >= 5;
    if (introDoneRef.current) {
      introScalesRef.current.fill(1);
    }
    sceneRefs.introScales = introScalesRef.current;

    // First-frame integrity (ADDENDUM 1 section 3): if beat 0 is still ahead of
    // us, the very first matrices written are the spawns at 0.55 radius, not
    // the seats at full radius. The flight driver overwrites these on its first
    // frame with the same values; this is what makes the promise hold even on a
    // frame the driver has not run yet.
    const asm = sceneRefs.assembly;
    const pre = !introDoneRef.current && asm && asm.plan;

    _q4.set(0, 0, 0, 1);
    for (let i = 0; i < count; i++) {
      const r = nR(diseases[i].papers);
      let is = introScalesRef.current[i];
      if (pre) {
        _v3.set(asm.plan.spawn[i * 3], asm.plan.spawn[i * 3 + 1], asm.plan.spawn[i * 3 + 2]);
        is = ASM.rStart;
        introScalesRef.current[i] = ASM.rStart;
      } else {
        _v3.set(catPos[i][0], catPos[i][1], catPos[i][2]);
      }
      _s3.set(r * is, r * is, r * is);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
      mesh.setColorAt(i, new THREE.Color(CC[diseases[i].category]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // LOW's brightness channel writes into instanceColor, so it needs the
    // untouched category colors to scale (and to restore exactly on landing).
    baseColRef.current = Float32Array.from(mesh.instanceColor.array);
    sceneRefs.instancedMesh = mesh;
  }, [count, diseases, shaderMode]);

  // Update fog range based on data extent. The settled range; beat 0's fly-in
  // widens it and hands it back here (see the frame loop).
  const restFog = useRef([0, 0]);
  useEffect(() => {
    const rawMax = useStore.getState().rawMax || 600;
    const near = rawMax * 0.6;
    const far = rawMax * 3.0;
    restFog.current = [near, far];
    if (plasmaMat) {
      plasmaMat.uniforms.fogNear.value = near;
      plasmaMat.uniforms.fogFar.value = far;
    }
    if (pulseMat) {
      pulseMat.uniforms.fogNear.value = near;
      pulseMat.uniforms.fogFar.value = far;
    }
  }, [plasmaMat, pulseMat]);

  // Every frame: rebuild matrices from curPos + update shader time
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const store = useStore.getState();
    const curPos = store.curPos;
    const sizeMode = store.sizeMode;
    const dt = delta > 0.05 ? 0.05 : delta; // clamp so a stalled tab doesn't fling the hover spring

    if (mat.uniforms) {
      mat.uniforms.time.value = state.clock.getElapsedTime();
      const fx = sceneRefs.fx;
      mat.uniforms.igniteAmount.value = fx.ignite;
      mat.uniforms.desatAmount.value = fx.desat;
      mat.uniforms.emberAmount.value = fx.ember;
      // Defaulted rather than assumed: only the film ever writes this channel,
      // and a session that never plays it must still light nodes on the raw
      // weights rather than pow(w, undefined) = NaN.
      mat.uniforms.igniteContrast.value = fx.igniteContrast ?? 1;
    }

    // ── Beat 0 fly-in (ADDENDUM 1 section 3) ──────────────────────────────
    // AssemblyFlight ran a moment ago at priority -1 and left this frame's
    // flight state in sceneRefs.assembly. While it is active it replaces the
    // old staged intro ramp entirely: position, scale multiplier, the comet's
    // quaternion and non-uniform stretch, and the brightness channel. This loop
    // still writes every matrix; the flight only supplies what goes into them.
    const asm = sceneRefs.assembly;
    const asmActive = !!(asm && asm.active);

    // The fog has to reach the spawn shell or the whole first frame is black
    // (see fogRangeAt). Only the shader tiers carry a fog term at all; LOW's
    // MeshPhongMaterial has none and needs no widening.
    if (mat.uniforms && (asmActive || asmWasActive.current)) {
      const [rn, rf] = restFog.current;
      if (asmActive) {
        fogRangeAt(store.rawMax || 600, asm.t, rn, rf, _fog);
        mat.uniforms.fogNear.value = _fog[0];
        mat.uniforms.fogFar.value = _fog[1];
      } else {
        mat.uniforms.fogNear.value = rn;
        mat.uniforms.fogFar.value = rf;
      }
    }

    // Intro scale logic
    if (!asmActive && !introDoneRef.current) {
      const scales = introScalesRef.current;
      if (!scales) return;

      const { introPhase, introProgress } = store;
      const { heroIdx, constellation, normDist } = introData;

      for (let i = 0; i < count; i++) {
        let target = 0;
        if (introPhase >= 5) {
          target = 1;
        } else if (introPhase >= 3) {
          // Galaxy: staggered by distance from hero
          target = introProgress > normDist[i] * 0.4 + 0.5 ? 1 : 0;
        } else if (introPhase >= 2) {
          // Constellation: hero + same-category neighbors
          target = constellation.has(i) ? 1 : 0;
        } else if (introPhase >= 1) {
          // Hero only
          target = i === heroIdx ? 1 : 0;
        }
        // Never regress — once a node has started appearing, keep it
        if (target < scales[i]) target = scales[i] > 0.01 ? 1 : 0;
        // Lerp toward target
        scales[i] += (target - scales[i]) * 0.08;
        if (scales[i] < 0.001) scales[i] = 0;
        if (scales[i] > 0.999) scales[i] = 1;
      }

      if (introPhase >= 5) {
        // Check if all scales reached 1
        let allDone = true;
        for (let i = 0; i < count; i++) {
          if (scales[i] < 0.999) { allDone = false; break; }
        }
        if (allDone) {
          scales.fill(1);
          introDoneRef.current = true;
        }
      }
    }

    const scales = introScalesRef.current;
    const fx = sceneRefs.fx;
    const tm = sceneRefs.tm;
    // smooth sizeMode toggle: drift stored morph toward target
    const morphTarget = fx.morphOverride ?? (sizeMode === 'mortality' ? 1 : 0);
    morphRef.current += (morphTarget - morphRef.current) * (fx.morphOverride != null ? 1 : 0.06);
    const morphT = fx.morphOverride ?? morphRef.current;

    const hoverIdx = store.hoveredNode ? store.hoveredNode.index : -1;
    const flightAttr = mesh.geometry.getAttribute('aFlight');
    const baseCol = baseColRef.current;

    // ── The resting galaxy micro-breathe (ADDENDUM 1 section 4 item 4) ───────
    // +-0.8 percent of radius at a per-node 0.10-0.16 Hz, off the aPhase the
    // geometry already carries, written into the matrix compose that already
    // runs every frame. It is off wherever scale is carrying a meaning:
    //   - the Time Machine (year deltas must not be muddied by ambient scale,
    //     and that includes the exit blend, which is still year radius),
    //   - beat 2, where every radius on screen is the papers-to-deaths morph,
    //   - beat 0, where the flight owns radius outright,
    //   - the selected node, whose size is being read against a panel,
    // and on LOW, which has no cycles to spare for it.
    const bAmp = mobDevice || reducedMotion ? 0 : AMBIENT.node.amp;
    const bOn = bAmp > 0 && !asmActive && !(tm && (tm.active || tm.exit > 0)) &&
      !(store.overtureActive && store.overtureBeat === 2);
    const bSel = store.selectedNode ? store.selectedNode.index : -1;
    const bT = state.clock.getElapsedTime();
    const bPhase = breathe.phases;
    const bFreq = breathe.freq;

    for (let i = 0; i < count; i++) {
      if (asmActive) {
        _v3.set(asm.pos[i * 3], asm.pos[i * 3 + 1], asm.pos[i * 3 + 2]);
        _q4.set(asm.quat[i * 4], asm.quat[i * 4 + 1], asm.quat[i * 4 + 2], asm.quat[i * 4 + 3]);
        if (scales) scales[i] = asm.radius[i];
      } else {
        _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
        _q4.set(0, 0, 0, 1);
      }
      let r;
      if (tm && tm.active) {
        r = tm.radiusAt(i); // Task 12
      } else {
        r = morphRadiusAt(diseases[i], morphT, lag ? lag[i] : 1);
      }
      springStepInto(_spring, hoverScaleRef.current[i], hoverVelRef.current[i], i === hoverIdx ? HOVER_SCALE : 1, dt, HOVER_TC);
      hoverScaleRef.current[i] = _spring[0];
      hoverVelRef.current[i] = _spring[1];
      const is = (asmActive ? asm.radius[i] : (scales ? scales[i] : 1)) * _spring[0];
      const rr = bOn && i !== bSel
        ? r * is * (1 + bAmp * Math.sin(bFreq[i] * bT + bPhase[i]))
        : r * is;
      // The comet: local +Y is the travel axis (that is what _q4 was built
      // from), so the stretch goes on Y alone. It is exactly 1.000 by p = 0.92
      // and for every landed node, which makes this a sphere again before any
      // caption exists.
      if (asmActive) _s3.set(rr, rr * asm.stretch[i], rr);
      else _s3.set(rr, rr, rr);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);

      if (asmActive) {
        const b = asm.bright[i];
        if (mobDevice) {
          // LOW: no custom shaders, so brightness rides instanceColor.
          if (baseCol && mesh.instanceColor) {
            mesh.instanceColor.array[i * 3] = baseCol[i * 3] * b;
            mesh.instanceColor.array[i * 3 + 1] = baseCol[i * 3 + 1] * b;
            mesh.instanceColor.array[i * 3 + 2] = baseCol[i * 3 + 2] * b;
          }
        } else if (flightAttr) {
          flightAttr.array[i] = b;
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (asmActive) {
      if (mobDevice) { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
      else if (flightAttr) flightAttr.needsUpdate = true;
      asmWasActive.current = true;
    } else if (asmWasActive.current) {
      // Hand back, once: beat 1 opens on the exact palette and the exact
      // brightness the rest of the piece assumes.
      asmWasActive.current = false;
      if (mobDevice) {
        if (baseCol && mesh.instanceColor) {
          mesh.instanceColor.array.set(baseCol);
          mesh.instanceColor.needsUpdate = true;
        }
      } else if (flightAttr) {
        flightAttr.array.fill(1);
        flightAttr.needsUpdate = true;
      }
    }
  });

  const onPointerOver = (e) => {
    e.stopPropagation();
    if (useStore.getState().roulettePhase !== 'idle') return;
    if (useStore.getState().overtureActive) return;
    if (e.instanceId !== undefined) {
      useStore.getState().setHovered(e.instanceId);
      document.body.style.cursor = 'pointer';
    }
  };
  const onPointerOut = () => {
    useStore.getState().setHovered(null);
    document.body.style.cursor = 'default';
  };
  const onClick = (e) => {
    e.stopPropagation();
    if (useStore.getState().roulettePhase !== 'idle') return;
    if (useStore.getState().overtureActive) return;
    if (e.instanceId !== undefined) {
      useStore.getState().selectDisease(e.instanceId);
    }
  };

  return (
    <instancedMesh
      key={shaderMode}
      ref={meshRef}
      args={[geo, mat, count]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
}
