import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import useStore from '../store';
import { TIER } from '../utils/tiers';
import { nR, isMob } from '../utils/helpers';

// ── Module-level scratch objects (zero per-frame allocations) ──
const _v3 = new THREE.Vector3();

// ── Tier-based constants ──
const MAX_PER_RING = TIER === 'LOW' ? 10 : TIER === 'MID' ? 16 : 20;
const TOTAL_CAP = MAX_PER_RING * 3;
const MAX_SPEEDS = TIER === 'LOW' ? [9.0, 5.5, 3.5] : TIER === 'MID' ? [13.0, 8.5, 5.5] : [16.0, 11.0, 7.0];
const ASSEMBLE_DUR = TIER === 'LOW' ? 0.8 : 1.2;
const RAMP_DUR = TIER === 'LOW' ? 1.4 : 2.2;
const SUSTAIN_DUR = TIER === 'LOW' ? 1.8 : 3.0;
const REVEAL_TWEEN_DUR = TIER === 'LOW' ? 0.5 : 1.0;
const REVEAL_SELECT_DELAY = 0.15; // just enough for winner tween to start moving
const DECEL_DUR = 0.8; // seconds for non-winner ring deceleration
const MIN_REVEAL_DIST = 80;  // hard floor — never closer than this
const MAX_REVEAL_DIST = 400; // hard ceiling — never farther than this

// ── Pre-computed ring tilt quaternions ──
const RING_TILTS = [
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.2, 0)),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0, 0.35)),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.15, -0.45)),
];

// ── Orbital position computation (zero allocations) ──
function computeRingPos(ringIdx, baseTheta, angle, radius, out) {
  const theta = baseTheta + angle;
  _v3.set(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
  _v3.applyQuaternion(RING_TILTS[ringIdx]);
  out[0] = _v3.x;
  out[1] = _v3.y;
  out[2] = _v3.z;
}

// ── Winner caption builder ──
function buildCaption(idx, diseases) {
  const d = diseases[idx];
  const parts = [d.label];
  if (d.papers) parts.push(`${fmt(d.papers)} papers`);
  if (d.mortality) parts.push(`${fmt(d.mortality)} deaths/yr`);
  if (d.mortality > 0) {
    const ppd = (d.papers / d.mortality).toFixed(2);
    parts.push(`${ppd} papers per death`);
  }
  return parts.join(' \u00b7 ');
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

// ── Fisher-Yates shuffle ──
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default function GalaxyRoulette() {
  const stateRef = useRef({
    phase: 'idle',
    phaseStartTime: 0,
    ringAngles: [0, 0, 0],
    ringAssignment: null,   // Int16Array: nodeIndex → ring (0/1/2) or -1
    ringBaseTheta: null,    // Float32Array: nodeIndex → base angle in ring
    ringRadii: [0, 0, 0],
    ringCounts: [0, 0, 0],
    winnerIdx: -1,
    tweens: [],
    didSelect: false,       // true after selectDisease called in reveal
  });

  useFrame((state, delta) => {
    const store = useStore.getState();
    const { roulettePhase } = store;
    const sr = stateRef.current;
    const clock = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    // ── Phase change detection ──
    if (roulettePhase !== sr.phase) {
      sr.phase = roulettePhase;
      sr.phaseStartTime = clock;
      onPhaseEnter(sr, roulettePhase, store, clock);
    }

    if (roulettePhase === 'idle') return;

    const elapsed = clock - sr.phaseStartTime;

    if (roulettePhase === 'assembling') tickAssembling(sr, elapsed);
    else if (roulettePhase === 'spinup') tickSpinup(sr, elapsed, dt, store);
    else if (roulettePhase === 'reveal') tickReveal(sr, elapsed, dt, store);
  });

  return null;
}

// ── Phase entry handlers ──
function onPhaseEnter(sr, phase, store, clock) {
  if (phase === 'assembling') onEnterAssembling(sr, store);
  else if (phase === 'spinup') onEnterSpinup(sr);
  else if (phase === 'reveal') onEnterReveal(sr, store);
  else if (phase === 'idle') onEnterIdle(sr);
}

function onEnterAssembling(sr, store) {
  const { rouletteEligible, curPos, rawMax, diseases } = store;

  // Kill any lingering tweens
  sr.tweens.forEach(t => t.kill());
  sr.tweens = [];

  // Kill any lingering GSAP tweens on eligible nodes from other modes
  for (const idx of rouletteEligible) {
    gsap.killTweensOf(curPos[idx]);
  }

  // Shuffle and cap to total ring capacity
  const pool = [...rouletteEligible];
  shuffle(pool);
  const capped = pool.slice(0, TOTAL_CAP);

  // Store ring node indices so HighlightSystem/NodeLabels can distinguish them
  useStore.setState({ rouletteRingNodes: capped });

  // Distribute: inner ~28%, middle ~36%, outer ~36%
  const n = capped.length;
  const innerCount = Math.min(MAX_PER_RING, Math.round(n * 0.28));
  const middleCount = Math.min(MAX_PER_RING, Math.round(n * 0.36));
  const outerCount = Math.min(MAX_PER_RING, n - innerCount - middleCount);
  sr.ringCounts = [innerCount, middleCount, outerCount];

  // Ring radii scaled to data extent — well separated for clear orbital motion
  const rm = rawMax || 600;
  sr.ringRadii = [rm * 0.25, rm * 0.45, rm * 0.70];

  // Assign nodes to rings
  const totalNodes = diseases.length;
  sr.ringAssignment = new Int16Array(totalNodes).fill(-1);
  sr.ringBaseTheta = new Float32Array(totalNodes);

  let idx = 0;
  for (let ri = 0; ri < 3; ri++) {
    const count = sr.ringCounts[ri];
    for (let si = 0; si < count; si++) {
      const nodeIdx = capped[idx++];
      sr.ringAssignment[nodeIdx] = ri;
      sr.ringBaseTheta[nodeIdx] = (si / count) * Math.PI * 2;

      // Compute target position at angle 0
      const target = [0, 0, 0];
      computeRingPos(ri, sr.ringBaseTheta[nodeIdx], 0, sr.ringRadii[ri], target);

      sr.tweens.push(
        gsap.to(curPos[nodeIdx], {
          0: target[0], 1: target[1], 2: target[2],
          duration: ASSEMBLE_DUR,
          ease: 'power2.inOut',
        })
      );
    }
  }

  sr.ringAngles = [0, 0, 0];
  sr.winnerIdx = -1;
  sr.didSelect = false;

  // ── Push non-ring nodes out of center exclusion zone ──
  // The exclusion radius covers all 3 rings plus padding so no
  // background node can sit in the orbital structure or reveal area.
  const exclusionR = sr.ringRadii[2] * 1.3; // beyond outer ring
  const cappedSet = new Set(capped);
  for (let i = 0; i < totalNodes; i++) {
    if (cappedSet.has(i)) continue; // ring node — handled above
    const pos = curPos[i];
    const dx = pos[0], dy = pos[1], dz = pos[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < exclusionR) {
      // Push outward along current direction (or random if at exact origin)
      let nx, ny, nz;
      if (dist < 0.1) {
        // Node is at exact origin (e.g. rank-0 disease) — pick random direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        nx = Math.sin(phi) * Math.cos(theta);
        ny = Math.sin(phi) * Math.sin(theta);
        nz = Math.cos(phi);
      } else {
        nx = dx / dist;
        ny = dy / dist;
        nz = dz / dist;
      }
      const targetDist = exclusionR + 30 + Math.random() * 50;
      sr.tweens.push(
        gsap.to(pos, {
          0: nx * targetDist, 1: ny * targetDist, 2: nz * targetDist,
          duration: ASSEMBLE_DUR,
          ease: 'power2.inOut',
        })
      );
    }
  }

  // Deselect current node and fly camera to a good viewing distance for the rings
  store.deselect();
  const camRadius = sr.ringRadii[2] * 2.5; // pull back enough to see all 3 rings
  store.setFlyTarget({ position: [0, 0, 0], radius: camRadius, duration: 1.0 });
}

function onEnterSpinup(sr) {
  // Kill assembly GSAP tweens — useFrame now owns positions
  sr.tweens.forEach(t => t.kill());
  sr.tweens = [];
  sr.ringAngles = [0, 0, 0];

  // Subtle camera dolly-in during spin for more energy
  const camRadius = sr.ringRadii[2] * 1.8; // pull in closer than assemble view
  useStore.getState().setFlyTarget({ position: [0, 0, 0], radius: camRadius, duration: 2.0 });
}

function onEnterReveal(sr, store) {
  const { curPos } = store;

  // Kill all tweens before starting reveal
  sr.tweens.forEach(t => t.kill());
  sr.tweens = [];
  sr.didSelect = false;

  // Tween winner to origin
  if (sr.winnerIdx >= 0) {
    sr.tweens.push(
      gsap.to(curPos[sr.winnerIdx], {
        0: 0, 1: 0, 2: 0,
        duration: REVEAL_TWEEN_DUR,
        ease: 'power3.inOut',
      })
    );
  }
}

function onEnterIdle(sr) {
  sr.tweens.forEach(t => t.kill());
  sr.tweens = [];
  sr.ringAssignment = null;
  sr.ringBaseTheta = null;
  sr.winnerIdx = -1;
  sr.didSelect = false;
}

// ── Phase tick handlers ──
function tickAssembling(sr, elapsed) {
  if (elapsed >= ASSEMBLE_DUR + 0.1) {
    useStore.setState({ roulettePhase: 'spinup' });
  }
}

function tickSpinup(sr, elapsed, dt, store) {
  const { curPos, diseases } = store;
  const totalDur = RAMP_DUR + SUSTAIN_DUR;

  // Quintic ease-in ramp (steeper acceleration), then constant
  const rampT = Math.min(elapsed / RAMP_DUR, 1.0);
  const speedMult = rampT < 1.0 ? rampT * rampT * rampT * rampT * rampT : 1.0;

  for (let ri = 0; ri < 3; ri++) {
    sr.ringAngles[ri] += MAX_SPEEDS[ri] * speedMult * dt;
  }

  // Update positions for all ring nodes
  updateRingPositions(sr, curPos, diseases.length);

  if (elapsed >= totalDur) {
    pickWinner(sr, store);
    useStore.setState({ roulettePhase: 'reveal' });
  }
}

function tickReveal(sr, elapsed, dt, store) {
  const { curPos, diseases } = store;

  // Decelerate non-winner rings
  const decelT = Math.min(elapsed / DECEL_DUR, 1.0);
  const speedMult = 1.0 - decelT * decelT;

  for (let ri = 0; ri < 3; ri++) {
    sr.ringAngles[ri] += MAX_SPEEDS[ri] * speedMult * dt;
  }

  // Update non-winner ring nodes only
  const N = diseases.length;
  for (let i = 0; i < N; i++) {
    if (i === sr.winnerIdx) continue;
    const ri = sr.ringAssignment[i];
    if (ri < 0) continue;
    computeRingPos(ri, sr.ringBaseTheta[i], sr.ringAngles[ri], sr.ringRadii[ri], curPos[i]);
  }

  // After delay, trigger selection (once)
  // Do NOT use selectDisease() — it reads curPos which is mid-tween.
  // Instead, directly set selectedNode and flyTarget to origin (where winner is tweened to).
  if (!sr.didSelect && elapsed >= REVEAL_SELECT_DELAY) {
    sr.didSelect = true;
    const d = diseases[sr.winnerIdx];
    const baseRadius = nR(d.papers);
    // Clamp focus distance: comfortable framing regardless of node size
    const baseDist = baseRadius * (isMob() ? 12.0 : 8.0) + 20;
    const zoomDist = Math.max(MIN_REVEAL_DIST, Math.min(MAX_REVEAL_DIST, baseDist));

    useStore.setState({
      selectedNode: { index: sr.winnerIdx, disease: d },
      flyTarget: { position: [0, 0, 0], radius: zoomDist },
      rouletteCaption: buildCaption(sr.winnerIdx, diseases),
    });
  }
}

// ── Helpers ──
function updateRingPositions(sr, curPos, count) {
  for (let i = 0; i < count; i++) {
    const ri = sr.ringAssignment[i];
    if (ri < 0) continue;
    computeRingPos(ri, sr.ringBaseTheta[i], sr.ringAngles[ri], sr.ringRadii[ri], curPos[i]);
  }
}

function pickWinner(sr, store) {
  const { rouletteEligible } = store;
  // Pick from nodes actually in rings
  const inRing = rouletteEligible.filter(idx => sr.ringAssignment[idx] >= 0);
  if (inRing.length === 0) return;
  sr.winnerIdx = inRing[Math.floor(Math.random() * inRing.length)];
  useStore.setState({ rouletteWinner: sr.winnerIdx });
}
