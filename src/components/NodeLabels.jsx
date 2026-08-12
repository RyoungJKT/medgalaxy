import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { nR, isMob, neglectColor } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';
import { labelCap, restCap, labelWidth, labelHeight, cullOverlaps } from '../utils/labelLayout';
import { railBandHeight } from './ui/TimeRail';

const pv = new THREE.Vector3();

// ─── Label discipline (review gate F5) ───────────────────────────────────────
// The header band. Labels never draw into it once the header is revealed: at
// 1440x900 the header row bottoms out at 44px and the filter bar under it at
// 78px, so 90 clears both with a margin, and the mobile search sheet drops to
// 86px when it is open. A label whose node sits below the line rides down to
// it; a label whose node is inside the band is dropped entirely.
const HEADER_ZONE = 90;
const PRE_HEADER_ZONE = 8; // before the reveal there is nothing to clear but the bezel
// The rail's band at the bottom of the frame, mirroring the header clamp above
// (review gate round 2, P3 #10). A label whose node sits above the rail rides
// up to the line; a label whose node is inside the band stands down entirely,
// exactly the header's rule turned upside down. The 8px is the same kind of
// margin the header zone carries over its own two rows.
const RAIL_MARGIN = 8;
// The Time Machine's ceiling. The tour's whole argument is a handful of nodes
// changing size, and 153 names over it read as noise (rg1-25, rg1-30); the
// biggest on screen carry the frame and the rest stand down for the years.
// The number is now the frame's, not the desktop's: labelCap() still returns
// exactly 40 at 1440px and falls to 12 on a 375px phone, where the round-2
// craft review measured 26 overlapping label pairs at the tour's pauses
// (P1 #5).
// Round 3 (finding 2): the cull is no longer gated to the tour or to narrow
// frames. A 1440px rest frame measured 117 labels and 20 overlapping pairs,
// the same clutter the tour's pauses had before round 2; idle was never
// actually exempt from the problem, only from the fix. Every phase x width
// combination now runs the same greedy cull every frame; only the cap
// differs (labelCap for the tour and for any narrow frame, the roomier
// restCap for wide frames at rest).
const NARROW = 768;
// The finale's isolation reaches the label layer too. HighlightSystem dims the
// instances and TimeMachine dims the halos; without this the names stayed at
// full strength and diluted the one node the closing shot is about.
const TM_DIM = 0.25;

/**
 * Renders disease-name labels as DOM elements positioned via 3D-to-2D
 * projection. Lives outside the R3F Canvas in HtmlOverlay.
 * Uses a requestAnimationFrame loop reading from sceneRefs.camera.
 */
export default function NodeLabels() {
  const diseases = useStore(s => s.diseases);
  const neglectMode = useStore(s => s.neglectMode);
  const containerRef = useRef(null);
  const mob = isMob();

  useEffect(() => {
    let running = true;

    // Scratch, allocated once per mount rather than per frame. The pass is
    // split in two because the Time Machine's cap is a comparison across the
    // whole field: nothing can be drawn until every node's screen radius for
    // this frame is known.
    const n = diseases.length;
    const sxA = new Float32Array(n);
    const topA = new Float32Array(n);
    const rA = new Float32Array(n);
    const fsA = new Float32Array(n);
    const showA = new Uint8Array(n);
    // Candidate rects for the budget/collision pass, allocated once and
    // refilled in place: the pass runs every frame and must not allocate.
    const nameLen = diseases.map((d) => (d.label ? d.label.length : 0));
    const pool = [];
    for (let i = 0; i < n; i++) pool.push({ i, x: 0, top: 0, w: 0, h: 0, pri: 0, pinned: false });
    const cands = [];
    const byPriority = (a, b) => b.pri - a.pri;

    function update() {
      if (!running) return;

      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      const container = containerRef.current;

      if (!camera || !canvas || !container) {
        requestAnimationFrame(update);
        return;
      }

      const storeState = useStore.getState();

      // The overture owns the frame: no label layer over the film (the beat
      // board calls for in-world micro-labels only, and DOM labels keep their
      // category color through the palette suppression).
      if (storeState.overtureActive) {
        if (container.style.visibility !== 'hidden') container.style.visibility = 'hidden';
        requestAnimationFrame(update);
        return;
      }
      if (container.style.visibility === 'hidden') container.style.visibility = '';

      const curPos = storeState.curPos;
      const hovIdx = storeState.hoveredNode?.index ?? -1;
      const selIdx = storeState.selectedNode?.index ?? -1;
      const rPhase = storeState.roulettePhase;
      const ringNodes = storeState.rouletteRingNodes;
      const rouletteActive = rPhase !== 'idle';
      const ringSet = rouletteActive && ringNodes.length > 0 ? new Set(ringNodes) : null;
      const introScales = sceneRefs.introScales;
      const rc = canvas.getBoundingClientRect();
      const kids = container.children;
      const tmActive = storeState.tmPhase !== 'idle';
      // Round 3 (finding 1): while the Time Machine is up, the node itself
      // draws at tm.radiusAt(i) (DiseaseNodes.jsx's own render loop reads it
      // the same way), the per-year interpolated radius, not the all-time
      // nR(papers) below. Ranking priority off the wrong radius is why
      // COVID's label used to dominate the empty 1996 frame: its all-time
      // paper count made it "big" on every tour frame, including years
      // before it existed.
      const tm = tmActive ? sceneRefs.tm : null;
      const focusIdx = storeState.tmFocusIdx;
      const topLimit = storeState.uiRevealed ? HEADER_ZONE : PRE_HEADER_ZONE;
      // The rail only exists while the Time Machine is up, so its band is only
      // excluded then; the rest of the time the frame runs to the bezel.
      const bottomLimit = tmActive
        ? rc.height - railBandHeight(mob) - RAIL_MARGIN
        : rc.height;
      const narrow = rc.width < NARROW;

      const tanHalfFov = Math.tan(Math.PI / 6); // fov=60 → half=30°

      // The font each label will actually be written at (pass 2 below), needed
      // here because a label's width, and therefore whether it collides, is
      // its character count times this size.
      const fontFor = (i, screenR) =>
        i === selIdx
          ? (mob ? Math.max(10, Math.min(18, screenR * 1.2)) : 15)
          : i === hovIdx
            ? (mob ? Math.max(9, Math.min(14, screenR * 1.0)) : 11)
            : (mob ? Math.max(5, Math.min(12, screenR * 0.8)) : 9);

      // ── Pass 1: project, and decide what could be drawn ──
      for (let i = 0; i < diseases.length; i++) {
        showA[i] = 0;
        if (!kids[i]) continue;

        pv.set(curPos[i][0], curPos[i][1], curPos[i][2]);

        // Distance from camera to this specific node
        const nodeDist = pv.distanceTo(camera.position);

        pv.project(camera);

        // Behind camera or off-screen
        if (pv.z > 1 || pv.z < -1) continue;

        let sx = (pv.x * 0.5 + 0.5) * rc.width;
        const sy = (-pv.y * 0.5 + 0.5) * rc.height;

        // Clamp so labels don't get cut off at screen edges
        sx = Math.max(40, Math.min(rc.width - 40, sx));

        const nodeR = tm && tm.radiusAt ? tm.radiusAt(i) : nR(diseases[i].papers);
        const screenR = nodeR * rc.height / (2 * nodeDist * tanHalfFov);

        // Hide labels for nodes not yet revealed during intro
        if (introScales && introScales[i] < 0.1) continue;

        // Hide all labels during spin (motion too fast for labels to read)
        // Hide non-ring-node labels during other roulette phases
        if (rPhase === 'spinup') continue;
        if (ringSet && !ringSet.has(i)) continue;

        // Hide very tiny labels when zoomed out. The finale's isolated node is
        // exempt: it is small precisely because it never surged, and the whole
        // closing shot is about reading its name.
        if (screenR < 0.3 && i !== hovIdx && i !== focusIdx) continue;

        // Header/search exclusion zone: a label that would ride up into the
        // chrome is pushed back down to the line, and one whose node is itself
        // inside the band stands down altogether — the header wins its strip.
        let top = sy - Math.max(screenR * 1.1, 3) - 10;
        if (top < topLimit) {
          if (sy < topLimit) continue;
          top = topLimit;
        }

        const fs = fontFor(i, screenR);
        const h = labelHeight(fs);
        // The rail's band, the header rule mirrored: ride up to the line, or
        // stand down if the node itself is down in the rail.
        if (top + h > bottomLimit) {
          if (sy > bottomLimit) continue;
          top = bottomLimit - h;
        }

        sxA[i] = sx;
        topA[i] = top;
        rA[i] = screenR;
        fsA[i] = fs;
        showA[i] = 1;
      }

      // ── The budget and the collision cull, every frame, every viewport ──
      // Round 3 (finding 2): idle used to be exempt (only the tour, or a
      // narrow frame, ran this pass); a 1440px rest frame measured 117
      // labels with 20 overlapping pairs, the clutter round 2 already fixed
      // for the tour and for narrow frames. Every combination of phase and
      // width runs the same greedy cull now; only the cap differs. The tour
      // keeps its narrative-driven 40 at desktop width (labelCap, unchanged
      // since round 2); rest gets the roomier restCap (~60-80 at desktop
      // widths), since idle has no story to compress attention to a handful
      // of names; narrow keeps labelCap either way, its own 12-40 floor
      // already tight enough that a separate rest number would be the same
      // number.
      const cap = narrow ? labelCap(rc.width) : (tmActive ? labelCap(rc.width) : restCap(rc.width));
      cands.length = 0;
      for (let i = 0; i < diseases.length; i++) {
        if (!showA[i]) continue;
        const c = pool[i];
        c.x = sxA[i];
        c.top = topA[i];
        c.w = labelWidth(nameLen[i], fsA[i]);
        c.h = labelHeight(fsA[i]);
        c.pri = rA[i];
        // The frame's own subjects survive both the budget and the cull.
        c.pinned = i === hovIdx || i === selIdx || i === focusIdx;
        cands.push(c);
      }
      cands.sort(byPriority);
      const keep = cullOverlaps(cands, cap);
      for (let i = 0; i < diseases.length; i++) if (showA[i]) showA[i] = 0;
      for (let k = 0; k < keep.length; k++) showA[keep[k]] = 1;

      // ── Pass 2: write the DOM ──
      for (let i = 0; i < diseases.length; i++) {
        const el = kids[i];
        if (!el) continue;
        if (!showA[i]) {
          if (el.style.display !== 'none') el.style.display = 'none';
          continue;
        }

        el.style.display = '';
        el.style.left = sxA[i] + 'px';
        el.style.top = topA[i] + 'px';

        let op = i === hovIdx || i === selIdx ? 1 : 0.75;
        // Finale isolation: everything that is not the subject steps back.
        if (focusIdx >= 0) op = i === focusIdx ? 1 : op * TM_DIM;
        el.style.opacity = String(op);

        // fsA is the same size the collision pass measured this label at, so
        // the rect that cleared its neighbours is the rect that gets drawn.
        const nameEl = el.firstChild;
        nameEl.style.fontSize = fsA[i] + 'px';
        if (i === selIdx) {
          nameEl.style.fontWeight = '700';
          nameEl.style.color = '#f1f5f9';
        } else if (i === hovIdx) {
          nameEl.style.fontWeight = '600';
          nameEl.style.color = '#e2e8f0';
        } else {
          nameEl.style.fontWeight = '400';
          nameEl.style.color = '';
        }
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => {
      running = false;
    };
  }, [diseases, mob]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-30 overflow-hidden"
    >
      {diseases.map((d) => (
        <div
          key={d.id}
          className="absolute"
          style={{
            transform: 'translateX(-50%)',
            // Same shrink-to-fit width bug as HintChips/OvertureCaption/
            // TimeRail (Task 17 report section 2): `el.style.left` below sets
            // a per-node pixel offset (not the literal `50%` the other fixed
            // components use), but the mechanism is identical — an
            // absolutely positioned box with `width` auto and `right` auto
            // resolves its Chromium shrink-to-fit width against the space
            // remaining between `left` and the containing block's right edge,
            // not the label's natural width. A label anchored anywhere right
            // of center (`sx` clamped up to `rc.width - 40`, i.e. as little
            // as 40px of "available width" at the clamp) wrapped its disease
            // name one word per line. max-content sizes each label to its
            // own text.
            width: 'max-content',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: mob ? 7 : 9,
            color: neglectMode
              ? neglectColor(d.mortality > 0 ? d.papers / d.mortality : 0)
              : CC[d.category],
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow:
              '0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          <span className="lbl-name">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
