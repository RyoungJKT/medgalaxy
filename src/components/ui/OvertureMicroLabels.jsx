import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { sceneRefs } from '../../sceneRefs';
import { nR, isMob } from '../../utils/helpers';
import { fmtFull } from '../../utils/captions';

// ─── Beat 1's two in-world micro-labels ──────────────────────────────────────
// DIRECTION section 2, beat 1: "Two micro-labels fade in beside the giants,
// 11px, sub-line style". They name the two nodes the morph is about to argue
// with, while the galaxy is still sized by papers. Both values are read from
// the live data at render time, never baked into a string.
//
// Overture-owned: the general NodeLabels layer hides itself for the whole film
// (its category-colored ink survives the palette suppression, which the grade
// cannot allow), so these two labels are projected here instead, on the same
// math, and only for the beat that asks for them.
//
// Desktop only: on mobile the caption sheet owns the lower frame and an 11px
// label beside a node does not survive the reflow.
const MICRO_IDS = ['heart-disease', 'breast-cancer'];
const FADE_MS = 300;
const GAP = 12;                              // px between node rim and label
const ROW = 16;                              // px of vertical nudge on collision
const pv = new THREE.Vector3();
const tanHalfFov = Math.tan(Math.PI / 6);    // fov 60 → half 30 degrees

// Rect overlap against an already-placed label (single text row, ROW tall).
function hits(p, x, y, w) {
  return Math.abs(p.y - y) < ROW && x < p.x + p.w + GAP && p.x < x + w + GAP;
}

export default function OvertureMicroLabels() {
  const diseases = useStore((s) => s.diseases);
  const idMap = useStore((s) => s.idMap);
  const containerRef = useRef(null);
  const mob = isMob();

  const idxs = mob
    ? []
    : MICRO_IDS.map((id) => idMap && idMap[id]).filter((i) => i !== undefined);
  const idxKey = idxs.join(',');

  useEffect(() => {
    if (!idxKey) return undefined;
    const nodes = idxKey.split(',').map(Number);
    let running = true;
    // Side hysteresis (Task 11 review): latched the first time each label is
    // actually shown, so lateral camera drift crossing the frame midline mid-
    // beat does not flip which side it reads on. null = not yet latched.
    const sides = new Array(nodes.length).fill(null);

    function update() {
      if (!running) return;
      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      const container = containerRef.current;
      if (!camera || !canvas || !container) {
        requestAnimationFrame(update);
        return;
      }

      const st = useStore.getState();
      const on = st.overtureActive && st.overtureBeat === 1;
      const want = on ? '1' : '0';
      if (container.style.opacity !== want) container.style.opacity = want;

      // Keep projecting through beats 2 and 3 so the 300 ms fade-out is not a
      // frozen label sliding off a moving camera; idle once the film is over.
      if (!st.overtureActive) {
        requestAnimationFrame(update);
        return;
      }

      const curPos = st.curPos;
      const rc = canvas.getBoundingClientRect();
      const kids = container.children;
      const placed = [];

      for (let k = 0; k < nodes.length; k++) {
        const el = kids[k];
        const i = nodes[k];
        if (!el || !curPos || !curPos[i]) continue;

        pv.set(curPos[i][0], curPos[i][1], curPos[i][2]);
        const nodeDist = pv.distanceTo(camera.position);
        pv.project(camera);

        if (pv.z > 1 || pv.z < -1) {
          el.style.display = 'none';
          continue;
        }

        const sx = (pv.x * 0.5 + 0.5) * rc.width;
        const sy = (-pv.y * 0.5 + 0.5) * rc.height;
        const screenR = nR(diseases[i].papers) * rc.height / (2 * nodeDist * tanHalfFov);
        const w = el.offsetWidth || 200;

        // Sit beside the giant, reading outward from the middle of the frame:
        // two labels near the galactic core would otherwise run into each other
        // as one line of text. Outward first, inward as the fallback, and a
        // one-line vertical nudge if both sides are taken. Which side counts as
        // "outward" is latched on first placement (once the label is actually
        // visible) so the beat's lateral camera drift never flips it mid-beat.
        if (on && sides[k] === null) sides[k] = sx < rc.width / 2;
        const preferLeft = sides[k] === null ? sx < rc.width / 2 : sides[k];
        const outward = preferLeft
          ? [sx - screenR - GAP - w, sx + screenR + GAP]
          : [sx + screenR + GAP, sx - screenR - GAP - w];
        let left = null;
        for (const c of outward) {
          if (c < 12 || c + w > rc.width - 12) continue;
          if (!placed.some((p) => hits(p, c, sy, w))) { left = c; break; }
        }
        let top = sy - 7;
        if (left === null) {
          left = Math.max(12, Math.min(rc.width - 12 - w, outward[0]));
          while (placed.some((p) => hits(p, left, top, w))) top += ROW;
        }

        placed.push({ x: left, y: top, w });
        el.style.display = '';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => { running = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idxKey, diseases]);

  if (!idxKey) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30,
        overflow: 'hidden', opacity: 0, transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {idxs.map((i) => (
        <div
          key={diseases[i].id}
          style={{
            position: 'absolute', display: 'none', whiteSpace: 'nowrap',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#94a3b8',
            textShadow: '0 0 6px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          {`${diseases[i].label} · ${fmtFull(diseases[i].papers)} papers`}
        </div>
      ))}
    </div>
  );
}
