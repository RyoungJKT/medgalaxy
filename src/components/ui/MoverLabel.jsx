import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { sceneRefs } from '../../sceneRefs';
import { fmtFull, captionNames } from '../../utils/captions';
import { TM_MICRO } from '../../utils/motion';

// ─── Accent 5: the mover micro-label (ADDENDUM 1 section 2.3) ────────────────
// On the rank-1 mover only, only when the ring fires, and only during a step
// whose dwell is at least 360 ms: a 9px micro-line beside the node in the
// existing NodeLabels style, in the rail movers chip's own format, for example
// `Influenza +7,412 papers`. In 180 ms, holds 650 ms, out 240 ms.
//
// Both numerals are the difference of two file values, which is the precedent
// the rail's own hover chip already set (TimeRail's movers chip). Nothing here
// is transcribed and nothing crosses diseases.
//
// Projection is NodeLabels' own math, kept in a rAF loop rather than a React
// render so a label riding a moving camera costs no re-renders.
const GAP = 12;
const tanHalfFov = Math.tan(Math.PI / 6); // fov 60 -> half 30 degrees
const pv = new THREE.Vector3();

let labelShow = null;
let labelHide = null;
let labelSync = null;

/**
 * Shows the micro-label beside one node.
 * @param {number} index disease index
 * @param {number} delta the year-over-year paper difference (signed)
 */
export function showMoverLabel(index, delta) {
  if (labelShow) labelShow(index, delta);
}

/** Drops the label immediately (the Time Machine closing, a skip, a new step). */
export function hideMoverLabel() {
  if (labelHide) labelHide();
}

/**
 * Drops the label if `caption` names the node it is about. Called by the engine
 * on the same frame it sets a caption, so the loudest pauses in the piece never
 * render even one frame carrying both numerals. The rAF loop below runs the same
 * rule continuously, for every other way a caption can change; this is the exact
 * one, for the moment that matters.
 */
export function syncMoverLabel(caption) {
  if (labelSync) labelSync(caption);
}

export default function MoverLabel() {
  const elRef = useRef(null);
  const stateRef = useRef({ idx: -1, t0: 0, total: 0 });

  useEffect(() => {
    const show = (index, delta) => {
      const el = elRef.current;
      const { diseases } = useStore.getState();
      const d = diseases && diseases[index];
      if (!el || !d) return;
      const sign = delta >= 0 ? '+' : '-';
      el.textContent = `${d.label} ${sign}${fmtFull(Math.abs(Math.round(delta)))} papers`;
      stateRef.current = {
        idx: index,
        t0: performance.now(),
        total: TM_MICRO.in + TM_MICRO.hold + TM_MICRO.out,
      };
    };
    const hide = () => {
      stateRef.current = { idx: -1, t0: 0, total: 0 };
      const el = elRef.current;
      if (el) { el.style.opacity = '0'; el.style.display = 'none'; }
    };
    const sync = (caption) => {
      const st = stateRef.current;
      if (st.idx < 0) return;
      const { diseases } = useStore.getState();
      const d = diseases && diseases[st.idx];
      if (captionNames(caption, d && d.label)) hide();
    };
    labelShow = show;
    labelHide = hide;
    labelSync = sync;
    return () => {
      if (labelShow === show) labelShow = null;
      if (labelHide === hide) labelHide = null;
      if (labelSync === sync) labelSync = null;
    };
  }, []);

  useEffect(() => {
    let running = true;
    const update = () => {
      if (!running) return;
      const el = elRef.current;
      const st = stateRef.current;
      if (el && st.idx >= 0) {
        const t = performance.now() - st.t0;
        if (t >= st.total) {
          stateRef.current = { idx: -1, t0: 0, total: 0 };
          el.style.opacity = '0';
          el.style.display = 'none';
        } else {
          const a = t < TM_MICRO.in
            ? t / TM_MICRO.in
            : t < TM_MICRO.in + TM_MICRO.hold
              ? 1
              : 1 - (t - TM_MICRO.in - TM_MICRO.hold) / TM_MICRO.out;
          const camera = sceneRefs.camera;
          const canvas = sceneRefs.canvasElement;
          const store = useStore.getState();
          // Round-5 gate: the moment the card on screen names this node, the
          // label has nothing left to add and stands down. Live, because the
          // caption that duplicates it usually arrives after the label does —
          // see captionNames. Dropped outright rather than faded: the redundancy
          // is the defect, and a 240 ms exit would just prolong it.
          const d = store.diseases && store.diseases[st.idx];
          if (captionNames(store.tmCaption, d && d.label)) {
            stateRef.current = { idx: -1, t0: 0, total: 0 };
            el.style.opacity = '0';
            el.style.display = 'none';
            requestAnimationFrame(update);
            return;
          }
          const pos = store.curPos && store.curPos[st.idx];
          const tm = sceneRefs.tm;
          if (camera && canvas && pos) {
            pv.set(pos[0], pos[1], pos[2]);
            const dist = pv.distanceTo(camera.position);
            pv.project(camera);
            if (pv.z > 1 || pv.z < -1) {
              el.style.display = 'none';
            } else {
              const rc = canvas.getBoundingClientRect();
              const sx = (pv.x * 0.5 + 0.5) * rc.width;
              const sy = (-pv.y * 0.5 + 0.5) * rc.height;
              const r = tm && tm.radiusAt ? tm.radiusAt(st.idx) : 1;
              const screenR = (r * rc.height) / (2 * dist * tanHalfFov);
              const w = el.offsetWidth || 160;
              // Outward from the middle of the frame, and clamped into it: a
              // rank-1 mover is by definition a large node, so the label reads
              // off its rim rather than over it.
              let left = sx < rc.width / 2 ? sx - screenR - GAP - w : sx + screenR + GAP;
              left = Math.max(12, Math.min(rc.width - 12 - w, left));
              el.style.display = '';
              el.style.left = `${left}px`;
              el.style.top = `${sy - 7}px`;
              el.style.opacity = String(a);
            }
          }
        }
      }
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
    return () => { running = false; };
  }, []);

  return (
    <div
      ref={elRef}
      data-mg-mover-label
      style={{
        position: 'absolute', display: 'none', whiteSpace: 'nowrap', pointerEvents: 'none',
        zIndex: 30, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#94a3b8',
        textShadow: '0 0 6px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)', opacity: 0,
      }}
    />
  );
}
