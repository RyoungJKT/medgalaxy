import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { nR, isMob, neglectColor } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';

const pv = new THREE.Vector3();

// ─── Label discipline (review gate F5) ───────────────────────────────────────
// The header band. Labels never draw into it once the header is revealed: at
// 1440x900 the header row bottoms out at 44px and the filter bar under it at
// 78px, so 90 clears both with a margin, and the mobile search sheet drops to
// 86px when it is open. A label whose node sits below the line rides down to
// it; a label whose node is inside the band is dropped entirely.
const HEADER_ZONE = 90;
const PRE_HEADER_ZONE = 8; // before the reveal there is nothing to clear but the bezel
// The Time Machine's ceiling. The tour's whole argument is a handful of nodes
// changing size, and 153 names over it read as noise (rg1-25, rg1-30); the
// biggest 40 on screen carry the frame and the rest stand down for the years.
const TM_MAX_LABELS = 40;
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
    const showA = new Uint8Array(n);
    const sortA = new Float32Array(n);

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
      const focusIdx = storeState.tmFocusIdx;
      const topLimit = storeState.uiRevealed ? HEADER_ZONE : PRE_HEADER_ZONE;

      const tanHalfFov = Math.tan(Math.PI / 6); // fov=60 → half=30°

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

        const nodeR = nR(diseases[i].papers);
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

        sxA[i] = sx;
        topA[i] = top;
        rA[i] = screenR;
        showA[i] = 1;
      }

      // ── The Time Machine's ceiling: the biggest TM_MAX_LABELS on screen ──
      if (tmActive) {
        let m = 0;
        for (let i = 0; i < diseases.length; i++) if (showA[i]) sortA[m++] = rA[i];
        if (m > TM_MAX_LABELS) {
          const ranked = sortA.subarray(0, m);
          ranked.sort(); // ascending, numeric (typed array)
          const cut = ranked[m - TM_MAX_LABELS];
          for (let i = 0; i < diseases.length; i++) {
            if (!showA[i] || rA[i] >= cut) continue;
            // The frame's own subjects survive the cap regardless of size.
            if (i === hovIdx || i === selIdx || i === focusIdx) continue;
            showA[i] = 0;
          }
        }
      }

      // ── Pass 2: write the DOM ──
      for (let i = 0; i < diseases.length; i++) {
        const el = kids[i];
        if (!el) continue;
        if (!showA[i]) {
          if (el.style.display !== 'none') el.style.display = 'none';
          continue;
        }

        const screenR = rA[i];
        el.style.display = '';
        el.style.left = sxA[i] + 'px';
        el.style.top = topA[i] + 'px';

        let op = i === hovIdx || i === selIdx ? 1 : 0.75;
        // Finale isolation: everything that is not the subject steps back.
        if (focusIdx >= 0) op = i === focusIdx ? 1 : op * TM_DIM;
        el.style.opacity = String(op);

        const nameEl = el.firstChild;
        if (i === selIdx) {
          nameEl.style.fontSize = mob ? Math.max(10, Math.min(18, screenR * 1.2)) + 'px' : '15px';
          nameEl.style.fontWeight = '700';
          nameEl.style.color = '#f1f5f9';
        } else if (i === hovIdx) {
          nameEl.style.fontSize = mob ? Math.max(9, Math.min(14, screenR * 1.0)) + 'px' : '11px';
          nameEl.style.fontWeight = '600';
          nameEl.style.color = '#e2e8f0';
        } else {
          nameEl.style.fontSize = mob ? Math.max(5, Math.min(12, screenR * 0.8)) + 'px' : '9px';
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
