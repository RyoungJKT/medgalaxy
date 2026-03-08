import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { TIER } from '../utils/tiers';
import { nR } from '../utils/helpers';

const N_CAP = TIER === 'LOW' ? 5 : TIER === 'MEDIUM' ? 7 : 10;
const PULL_FRACTION = 1.40;
const MAX_PULL_UNITS = 220;
const MIN_PULL_UNITS = 30;
const MIN_DIST = 1.0;
const ANIM_IN_MS = 2800;
const ANIM_OUT_MS = 1400;
const SELECTED_DAMPEN = 0.4;

// Shared ownership set — IdleDrift imports this to skip owned nodes
export const gravOwnedNodes = new Set();

// Per-node animation state
// phase: 'in' | 'hold' | 'out' | null
let _nodes = new Map(); // idx -> { phase, startPos, targetPos, releaseStartPos, releaseTargetPos, elapsed }
let _activeHovIdx = -1;

// Smooth S-curve: gentle start, peak speed in middle, gentle landing
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

const SPACING_BUFFER = 1.3; // multiplier on sum of radii for min separation

function computeNeighbors(hIdx, displayEdges, curPos, selectedNode, diseases) {
  const neighbors = [];
  for (let i = 0; i < displayEdges.length; i++) {
    const e = displayEdges[i];
    let nIdx;
    if (e.si === hIdx) nIdx = e.ti;
    else if (e.ti === hIdx) nIdx = e.si;
    else continue;
    if (nIdx === hIdx) continue;
    neighbors.push({ idx: nIdx, score: e.score || e.sharedPapers });
  }
  neighbors.sort((a, b) => b.score - a.score);
  const top = neighbors.slice(0, N_CAP);
  const maxScore = top.length > 0 ? top[0].score : 1;

  const dampen = selectedNode ? SELECTED_DAMPEN : 1.0;
  const anchorX = curPos[hIdx][0], anchorY = curPos[hIdx][1], anchorZ = curPos[hIdx][2];
  const hoverRadius = nR(diseases[hIdx].papers);

  const results = top.map(n => {
    const sx = curPos[n.idx][0], sy = curPos[n.idx][1], sz = curPos[n.idx][2];
    const dx = anchorX - sx, dy = anchorY - sy, dz = anchorZ - sz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let tx = sx, ty = sy, tz = sz;
    if (dist >= MIN_DIST) {
      const strength = Math.sqrt(n.score / maxScore);
      const pull = Math.min(Math.max(dist * PULL_FRACTION * strength * dampen, MIN_PULL_UNITS), MAX_PULL_UNITS);
      // Clamp: don't pull closer than sum of radii * buffer
      const neighborRadius = nR(diseases[n.idx].papers);
      const minSep = (hoverRadius + neighborRadius) * SPACING_BUFFER;
      const clampedPull = Math.min(pull, dist - minSep);
      if (clampedPull > 0) {
        const inv = clampedPull / dist;
        tx = sx + dx * inv;
        ty = sy + dy * inv;
        tz = sz + dz * inv;
      }
    }

    return {
      idx: n.idx,
      startPos: [sx, sy, sz],
      targetPos: [tx, ty, tz],
    };
  });

  // Pairwise separation: ensure no two pulled neighbors overlap each other
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i], b = results[j];
      const ddx = a.targetPos[0] - b.targetPos[0];
      const ddy = a.targetPos[1] - b.targetPos[1];
      const ddz = a.targetPos[2] - b.targetPos[2];
      const d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      const rA = nR(diseases[a.idx].papers);
      const rB = nR(diseases[b.idx].papers);
      const minSep = (rA + rB) * SPACING_BUFFER;
      if (d < minSep && d > 0.01) {
        const push = (minSep - d) / 2;
        const nx = ddx / d, ny = ddy / d, nz = ddz / d;
        a.targetPos[0] += nx * push;
        a.targetPos[1] += ny * push;
        a.targetPos[2] += nz * push;
        b.targetPos[0] -= nx * push;
        b.targetPos[1] -= ny * push;
        b.targetPos[2] -= nz * push;
      }
    }
  }

  return results;
}

export default function GravityLens() {
  useFrame((state, delta) => {
    const {
      hoveredNode, selectedNode, curPos, displayEdges, diseases,
      activeMode, roulettePhase, introPhase, spotlightActive, supernovaPhase,
    } = useStore.getState();

    const dt = Math.min(delta, 0.05) * 1000; // ms

    const guarded = activeMode || roulettePhase !== 'idle' || introPhase < 5 || spotlightActive || supernovaPhase !== 'idle';
    const hIdx = (!guarded && hoveredNode) ? hoveredNode.index : -1;

    // Hover changed or became guarded
    if (hIdx !== _activeHovIdx) {
      // Release old affected nodes that aren't in the new set
      const newNeighborIdxs = new Set();

      if (hIdx >= 0) {
        const neighbors = computeNeighbors(hIdx, displayEdges, curPos, selectedNode, diseases);
        for (const n of neighbors) {
          newNeighborIdxs.add(n.idx);
          const existing = _nodes.get(n.idx);

          if (existing && (existing.phase === 'in' || existing.phase === 'hold')) {
            // Retarget: animate from current position to new target
            existing.startPos = [curPos[n.idx][0], curPos[n.idx][1], curPos[n.idx][2]];
            existing.targetPos = n.targetPos;
            existing.phase = 'in';
            existing.elapsed = 0;
          } else if (existing && existing.phase === 'out') {
            // Was releasing, retarget to new pull
            existing.startPos = [curPos[n.idx][0], curPos[n.idx][1], curPos[n.idx][2]];
            existing.targetPos = n.targetPos;
            existing.phase = 'in';
            existing.elapsed = 0;
          } else {
            // New node
            _nodes.set(n.idx, {
              phase: 'in',
              startPos: [...n.startPos],
              targetPos: [...n.targetPos],
              releaseStartPos: null,
              releaseTargetPos: null,
              elapsed: 0,
            });
            gravOwnedNodes.add(n.idx);
          }
        }
      }

      // Start release for nodes no longer in the new set
      for (const [idx, node] of _nodes) {
        if (!newNeighborIdxs.has(idx) && node.phase !== 'out') {
          node.phase = 'out';
          node.releaseStartPos = [curPos[idx][0], curPos[idx][1], curPos[idx][2]];
          // Sample IdleDrift's current target as release destination
          // Use catPos as a stable base (IdleDrift lerps toward catPos + oscillation)
          const { catPos } = useStore.getState();
          node.releaseTargetPos = [catPos[idx][0], catPos[idx][1], catPos[idx][2]];
          node.elapsed = 0;
        }
      }

      _activeHovIdx = hIdx;
    }

    // Animate all active nodes
    const toRemove = [];

    for (const [idx, node] of _nodes) {
      node.elapsed += dt;

      if (node.phase === 'in') {
        const u = Math.min(node.elapsed / ANIM_IN_MS, 1);
        const p = easeInOutCubic(u);
        curPos[idx][0] = node.startPos[0] + (node.targetPos[0] - node.startPos[0]) * p;
        curPos[idx][1] = node.startPos[1] + (node.targetPos[1] - node.startPos[1]) * p;
        curPos[idx][2] = node.startPos[2] + (node.targetPos[2] - node.startPos[2]) * p;

        if (u >= 1) {
          node.phase = 'hold';
        }
      } else if (node.phase === 'hold') {
        // Pin exactly at target — no corrections, no vibration
        curPos[idx][0] = node.targetPos[0];
        curPos[idx][1] = node.targetPos[1];
        curPos[idx][2] = node.targetPos[2];
      } else if (node.phase === 'out') {
        const r = Math.min(node.elapsed / ANIM_OUT_MS, 1);
        const p = easeOutQuart(r);
        curPos[idx][0] = node.releaseStartPos[0] + (node.releaseTargetPos[0] - node.releaseStartPos[0]) * p;
        curPos[idx][1] = node.releaseStartPos[1] + (node.releaseTargetPos[1] - node.releaseStartPos[1]) * p;
        curPos[idx][2] = node.releaseStartPos[2] + (node.releaseTargetPos[2] - node.releaseStartPos[2]) * p;

        if (r >= 1) {
          toRemove.push(idx);
        }
      }
    }

    // Cleanup completed releases
    for (const idx of toRemove) {
      _nodes.delete(idx);
      gravOwnedNodes.delete(idx);
    }
  }, -1);

  return null;
}
