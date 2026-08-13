import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { nR } from '../utils/helpers';
import { TIER } from '../utils/tiers';
import { igniteWeights } from '../utils/igniteWeights';
import { sceneRefs } from '../sceneRefs';
import { fireRipple } from './SelectionRipple';

// The node's RESTING radius: the size its sphere returns to once every
// transient owner lets go, not whatever a half-finished size-toggle morph or a
// Time Machine this reveal is about to tear down has it at this frame.
// Everything the reveal scales to its subject (camera distance, tremble
// amplitude) reads this: the seat is chosen once at prefocus and then held for
// 2.2 s, so it cannot be picked off a moving value, and a session sitting on
// the Mortality toggle must be framed by the sphere the viewer can actually
// see (nR(papers) can be 13x wrong there).
function restingRadius(diseases, idx) {
  const fn = sceneRefs.nodeRadius;
  if (fn) {
    const r = fn(idx, true);
    if (r > 0) return r;
  }
  return nR(diseases[idx].papers);
}

// ── Phase durations (ms) ──
const PREFOCUS_MS  = 1200;
const CHARGE_MS    = 1000;
const BURST_MS     = 250;
const LINKWAVE_MS  = 1200;
const SETTLE_MS    = 800;

// ── Tremble config ──
const TREMBLE_FRACTION = TIER === 'LOW' ? 0.12 : 0.25; // fraction of node radius

// ── Easing helpers ──
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

export default function SupernovaReveal() {
  const phaseStartRef = useRef(0);
  const prevPhaseRef = useRef('idle');
  const batchTimerRef = useRef(0);
  const batchIdxRef = useRef(0);
  const basePosRef = useRef(null); // store target's base position for tremble
  const emberRef = useRef(null);   // lazy igniteWeights().ember cache, for the reveal motif

  useFrame((state, delta) => {
    const s = useStore.getState();
    const { supernovaPhase, supernovaTargetIdx, supernovaNeighborBatches,
            supernovaRevealedLinks, curPos, catPos, diseases } = s;

    if (supernovaPhase === 'idle' || supernovaPhase === 'complete') {
      prevPhaseRef.current = supernovaPhase;
      basePosRef.current = null;
      return;
    }

    const dt = Math.min(delta, 0.05) * 1000; // ms
    const t = state.clock.getElapsedTime();
    const idx = supernovaTargetIdx;

    // Phase transition detection
    if (supernovaPhase !== prevPhaseRef.current) {
      phaseStartRef.current = 0;
      prevPhaseRef.current = supernovaPhase;

      if (supernovaPhase === 'prefocus') {
        // Store base position for tremble reference
        basePosRef.current = [catPos[idx][0], catPos[idx][1], catPos[idx][2]];

        // Camera: cinematic approach from elevated angle to avoid node occlusion
        const pos = catPos[idx];
        const nodeRadius = restingRadius(diseases, idx);
        const zoomDist = nodeRadius * 8.0;

        // Compute a camera position elevated ~30° above the XY plane,
        // approaching from the outward direction (node relative to galaxy center)
        const nx = pos[0], ny = pos[1], nz = pos[2];
        const outLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        // Fallback direction for nodes at/near the center (e.g. Heart Disease)
        let ox, oy, oz;
        if (outLen < nodeRadius * 0.5) {
          // Node is at galaxy center — use a fixed scenic angle (front-right + elevated)
          ox = 0.6; oy = 0.0; oz = 0.8;
        } else {
          ox = nx / outLen; oy = ny / outLen; oz = nz / outLen;
        }
        // Up component (lift camera above the disk plane)
        const elevY = 0.5; // ~30° elevation
        // Camera direction: outward + up, normalized, then scaled to zoomDist
        const dx = ox, dy = oy + elevY, dz = oz;
        const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const camPos = [
          nx + (dx / dLen) * zoomDist,
          ny + (dy / dLen) * zoomDist,
          nz + (dz / dLen) * zoomDist,
        ];

        useStore.setState({
          flyTarget: { position: [pos[0], pos[1], pos[2]], cameraPos: camPos, duration: 1.8 },
        });
      }

      if (supernovaPhase === 'burst') {
        // The burst ring, fired on the burst frame itself. It used to arrive as
        // a side effect of whichever selectDisease happened to run, which in
        // story mode is the one at the END of the burst, 250 ms late, long
        // after the tremble it is supposed to answer. Firing it here makes the
        // ring simultaneous with the burst in every path, story or not.
        fireRipple(idx, undefined, true);
        // Select the disease now (opens sidebar during linkwave)
        // Skip during story mode — story shortcut handles selection in burst end
        if (!s.storyActive) s.selectDisease(idx);
        batchTimerRef.current = 0;
        batchIdxRef.current = 0;
        // Reveal motif (DIRECTION section 5, moment 5): the rising fifth,
        // nudged down a minor third when this disease sits in the
        // overlooked decile (igniteWeights' ember set).
        if (!emberRef.current) emberRef.current = igniteWeights(diseases).ember;
        if (typeof window !== 'undefined') {
          window.__mgAudio?.play?.('reveal', { overlooked: emberRef.current[idx] === 1 });
        }
      }

      if (supernovaPhase === 'linkwave') {
        batchTimerRef.current = 0;
        batchIdxRef.current = 0;
      }

      if (supernovaPhase === 'settle') {
        // Ensure disease is selected if not already
        if (!s.selectedNode || s.selectedNode.index !== idx) {
          s.selectDisease(idx);
        }
      }
    }

    phaseStartRef.current += dt;
    const elapsed = phaseStartRef.current;

    // ── PREFOCUS ──
    if (supernovaPhase === 'prefocus') {
      if (elapsed >= PREFOCUS_MS) {
        useStore.setState({ supernovaPhase: 'charge' });
      }
    }

    // ── CHARGE ──
    else if (supernovaPhase === 'charge') {
      const u = Math.min(elapsed / CHARGE_MS, 1);
      const uEase = easeOutCubic(u);

      // Tremble: layered sin with amplitude scaled to node size
      if (basePosRef.current) {
        const nodeRadius = restingRadius(diseases, idx);
        const amp = nodeRadius * TREMBLE_FRACTION * uEase;
        const freq = 1 + uEase * 2; // frequency increases with charge
        const ox = amp * (
          0.6 * Math.sin(t * 23 * freq + 1.1) +
          0.4 * Math.sin(t * 37 * freq + 2.7)
        );
        const oy = amp * 0.5 * Math.sin(t * 19 * freq + 0.5);
        const oz = amp * (
          0.5 * Math.sin(t * 29 * freq + 3.3) +
          0.3 * Math.sin(t * 41 * freq + 1.9)
        );
        curPos[idx][0] = basePosRef.current[0] + ox;
        curPos[idx][1] = basePosRef.current[1] + oy;
        curPos[idx][2] = basePosRef.current[2] + oz;
      }

      if (elapsed >= CHARGE_MS) {
        // Snap back to base before burst
        if (basePosRef.current) {
          curPos[idx][0] = basePosRef.current[0];
          curPos[idx][1] = basePosRef.current[1];
          curPos[idx][2] = basePosRef.current[2];
        }
        useStore.setState({ supernovaPhase: 'burst' });
      }
    }

    // ── BURST ──
    else if (supernovaPhase === 'burst') {
      if (elapsed >= BURST_MS) {
        // During story mode, skip linkwave/settle — go straight to complete
        if (s.storyActive) {
          s.selectDisease(idx);
          useStore.setState({
            supernovaPhase: 'complete',
            supernovaCaption: '',
          });
          setTimeout(() => {
            const cur = useStore.getState();
            if (cur.supernovaPhase !== 'complete') return;
            useStore.setState({
              supernovaPhase: 'idle',
              supernovaNeighborBatches: [],
              supernovaRevealedLinks: [],
            });
          }, 50);
        } else {
          useStore.setState({ supernovaPhase: 'linkwave' });
        }
      }
    }

    // ── LINKWAVE ──
    else if (supernovaPhase === 'linkwave') {
      const BATCH_STAGGER = 120; // ms between batch reveals

      batchTimerRef.current += dt;
      const batches = supernovaNeighborBatches;

      // Reveal batches progressively
      while (
        batchIdxRef.current < batches.length &&
        batchTimerRef.current >= batchIdxRef.current * BATCH_STAGGER
      ) {
        const newRevealed = [
          ...supernovaRevealedLinks,
          ...batches[batchIdxRef.current],
        ];
        useStore.setState({ supernovaRevealedLinks: newRevealed });
        batchIdxRef.current++;
      }

      if (elapsed >= LINKWAVE_MS) {
        // Reveal all remaining
        const allNeighbors = batches.flat();
        useStore.setState({ supernovaRevealedLinks: allNeighbors });
        useStore.setState({ supernovaPhase: 'settle' });
      }
    }

    // ── SETTLE ──
    else if (supernovaPhase === 'settle') {
      if (elapsed >= SETTLE_MS) {
        useStore.setState({
          supernovaPhase: 'complete',
          supernovaCaption: '',
        });
        // After a tick, clean up to idle
        setTimeout(() => {
          const cur = useStore.getState();
          // Guard: don't clobber a newly-started supernova (race with story advance click)
          if (cur.supernovaPhase !== 'complete') return;
          // During story: keep supernovaTargetIdx so dust persists until story advances
          if (cur.storyActive) {
            useStore.setState({
              supernovaPhase: 'idle',
              supernovaNeighborBatches: [],
              supernovaRevealedLinks: [],
            });
          } else {
            useStore.setState({
              supernovaPhase: 'idle',
              supernovaTargetIdx: -1,
              supernovaNeighborBatches: [],
              supernovaRevealedLinks: [],
            });
          }
        }, 50);
      }
    }
  });

  return null;
}
