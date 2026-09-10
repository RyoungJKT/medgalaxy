import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { nR, isMob } from '../../utils/helpers';
import { fmtFull } from '../../utils/captions';
import { isNoGlobalEstimate } from '../../utils/mortalityLabel';
import { DUR, EASE, CARD_BARS } from '../../utils/motion';
import { sceneRefs } from '../../sceneRefs';

const pv = new THREE.Vector3();

const CARD_W = 320;
// Edge clearances for the vertical clamp: the header's two rows end ~76px
// down, the story-chip band starts at innerHeight-84. Both plus a margin.
const TOP_CLEAR = 84;
const BOTTOM_CLEAR = 92;
// Estimated card height for the one render before the ref can be measured.
const H_ESTIMATE = 166;

export default function CompareCards() {
  const selectedNode = useStore(s => s.selectedNode);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const selectDisease = useStore(s => s.selectDisease);
  const storyActive = useStore(s => s.storyActive);
  const [pos, setPos] = useState({ x: 0, y: 0, visible: false });
  const [grown, setGrown] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const rafRef = useRef(null);
  const cardRef = useRef(null);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Track selected node screen position — anchor to left
  useEffect(() => {
    if (!selectedNode) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPos(p => ({ ...p, visible: false }));
      return;
    }
    function track() {
      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      if (!camera || !canvas) { rafRef.current = requestAnimationFrame(track); return; }
      const curPos = useStore.getState().curPos;
      const idx = selectedNode.index;
      if (!curPos[idx]) { rafRef.current = requestAnimationFrame(track); return; }
      pv.set(curPos[idx][0], curPos[idx][1], curPos[idx][2]);
      const nodeR = nR(selectedNode.disease.papers);
      const nodeDist = pv.distanceTo(camera.position);
      pv.project(camera);
      if (pv.z < 1 && pv.z > -1) {
        const rc = canvas.getBoundingClientRect();
        const tanHalfFov = Math.tan(Math.PI / 6);
        const screenR = nodeR * rc.height / (2 * nodeDist * tanHalfFov);
        const sx = (pv.x * 0.5 + 0.5) * rc.width;
        const sy = (-pv.y * 0.5 + 0.5) * rc.height;
        setPos({ x: sx - screenR - 16, y: sy + screenR * 0.5 + 20, visible: true });
      }
      rafRef.current = requestAnimationFrame(track);
    }
    rafRef.current = requestAnimationFrame(track);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [selectedNode]);

  // Bars draw in from zero each time the card appears or the selection
  // changes: the reset commit renders width 0 with no transition (so reused
  // bar DOM snaps clean instead of retargeting mid-delay), then the timer
  // re-arms the transition. The card only takes pointer events once its own
  // fade has begun, so the still-invisible card never swallows a click.
  // Layout effect: the width-0 reset must land before the browser paints the
  // re-selection commit, or reused bars flash one frame of the old widths.
  useLayoutEffect(() => {
    setGrown(false);
    setInteractive(false);
    if (!selectedNode || !pos.visible) return;
    const t1 = setTimeout(() => setGrown(true), 40);
    const t2 = setTimeout(() => setInteractive(true), CARD_BARS.base);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [selectedNode, pos.visible]);

  // Compute comparison blocks. Each block is one proportional mini-chart:
  // rows share a unit, bars are linear within the block, every bar is
  // labeled with its exact figure.
  const blocks = useMemo(() => {
    if (!selectedNode) return [];
    const disease = selectedNode.disease;
    const idx = selectedNode.index;
    const out = [];
    const used = new Set([idx]);
    const pick = (fn) => {
      let best = null, bestScore = -Infinity;
      for (let i = 0; i < diseases.length; i++) {
        if (used.has(i)) continue;
        const score = fn(diseases[i], i);
        if (score !== null && score > bestScore) { best = i; bestScore = score; }
      }
      if (best !== null) used.add(best);
      return best;
    };

    // Block 1: Gets More Attention — similar mortality, way more papers
    if (disease.mortality > 0) {
      const selM = disease.mortality, selP = disease.papers;
      const i1 = pick((d) => {
        if (d.mortality <= 0) return null;
        const mRatio = d.mortality / selM;
        if (mRatio < 0.2 || mRatio > 5) return null;
        if (d.papers <= selP) return null;
        return d.papers / selP;
      });
      if (i1 !== null) {
        const d1 = diseases[i1];
        out.push({
          kicker: 'Gets more attention', unit: 'PubMed papers',
          rows: [
            { d: disease, value: disease.papers, max: d1.papers, sel: true, click: null },
            { d: d1, value: d1.papers, max: d1.papers, sel: false, click: i1 },
          ],
        });
      }
    }

    // Block 2: Higher Mortality — similar papers, way more deaths. A disease
    // whose source says no global estimate exists never anchors a deaths
    // comparison, and a selected disease without a citable global figure
    // never has a number invented for it: no-estimate rows say so, and
    // boundary-zero rows (risk factors, double-counting boundaries) print
    // N/A exactly as the sidebar does.
    if (disease.papers > 0) {
      const selP = disease.papers, selM = disease.mortality;
      const selNoEst = isNoGlobalEstimate(disease.mortalitySource);
      const selNoNum = selNoEst || !(selM > 0);
      const i2 = pick((d) => {
        if (d.mortality <= 0) return null;
        if (isNoGlobalEstimate(d.mortalitySource)) return null;
        const pRatio = d.papers / selP;
        if (pRatio < 0.2 || pRatio > 5) return null;
        if (selM > 0 && d.mortality <= selM) return null;
        if (selM === 0 && d.mortality <= 0) return null;
        return selM > 0 ? d.mortality / selM : d.mortality;
      });
      if (i2 !== null) {
        const d2 = diseases[i2];
        out.push({
          kicker: 'Higher mortality', unit: 'deaths/yr',
          rows: [
            {
              d: disease, value: selNoNum ? null : selM, max: d2.mortality, sel: true, click: null,
              noNum: selNoNum, noText: selNoEst ? 'no global estimate' : 'N/A',
            },
            { d: d2, value: d2.mortality, max: d2.mortality, sel: false, click: i2 },
          ],
        });
      }
    }

    // Block 3: Strongest Research Links — top shared publications
    // A pair whose one search term contains the other is never called a
    // strongest link: its count is the smaller term's whole count, not a
    // measured overlap (processData, src/utils/helpers.js).
    const conns = displayEdges
      .filter(e => !e.termOverlap)
      .filter(e => e.si === idx || e.ti === idx)
      .map(e => ({ oi: e.si === idx ? e.ti : e.si, sp: e.sharedPapers }))
      .sort((a, b) => b.sp - a.sp)
      .filter(cn => !used.has(cn.oi))
      .slice(0, 2);
    if (conns.length > 0) {
      conns.forEach(cn => used.add(cn.oi));
      const max = conns[0].sp;
      out.push({
        kicker: conns.length > 1 ? 'Strongest research links' : 'Strongest research link',
        unit: 'shared papers',
        rows: conns.map(cn => ({ d: diseases[cn.oi], value: cn.sp, max, sel: false, click: cn.oi })),
      });
    }

    return out;
  }, [selectedNode, diseases, displayEdges]);

  if (isMob() || storyActive || !selectedNode || !pos.visible || blocks.length === 0) return null;

  // Keep the card fully on screen: never past the left edge, and — measured
  // against its real rendered height, since it runs one to three blocks —
  // never over the header rows or the story-chip band. The card re-renders
  // every tracked frame, so the ref-measured height self-corrects right
  // after first paint.
  const right = Math.min(
    Math.max(12, window.innerWidth - pos.x),
    window.innerWidth - CARD_W - 12
  );
  const cardH = cardRef.current ? cardRef.current.offsetHeight : H_ESTIMATE;
  const topMin = TOP_CLEAR + cardH / 2;
  const topMax = window.innerHeight - BOTTOM_CLEAR - cardH / 2;
  const top = topMax >= topMin
    ? Math.min(Math.max(pos.y, topMin), topMax)
    : (TOP_CLEAR + window.innerHeight - BOTTOM_CLEAR) / 2;

  let rowSeq = 0;

  return (
    <div ref={cardRef} style={{
      position: 'fixed',
      right, top,
      transform: 'translateY(-50%)',
      zIndex: 45,
      width: CARD_W,
      background: 'rgba(10,16,30,0.94)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 10, padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: 'IBM Plex Mono,monospace', color: '#e2e8f0',
      opacity: 0, animation: 'fadeIn 0.5s ease 0.3s forwards',
      pointerEvents: interactive ? 'auto' : 'none',
    }}>
      {blocks.map((block, bi) => (
        <div key={block.kicker} style={bi > 0 ? { marginTop: 13, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)' } : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
            <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: '#64748b' }}>{block.kicker}</span>
            <span style={{ fontSize: 9, color: '#64748b' }}>{block.unit}</span>
          </div>
          {block.rows.map((row, ri) => {
            const delay = CARD_BARS.base + (rowSeq++) * CARD_BARS.step;
            const pct = row.noNum || !(row.max > 0) ? 0 : Math.min(1, row.value / row.max) * 100;
            return (
              <div
                key={ri}
                onClick={row.click !== null ? () => selectDisease(row.click) : undefined}
                onMouseEnter={row.click !== null ? (e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }) : undefined}
                onMouseLeave={row.click !== null ? (e => { e.currentTarget.style.background = 'transparent'; }) : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: row.noNum ? '104px 1fr' : '104px 1fr 72px',
                  gap: 10, alignItems: 'center',
                  padding: '4px 4px', margin: '0 -4px', borderRadius: 5,
                  cursor: row.click !== null ? 'pointer' : 'default',
                }}
              >
                <span title={row.d.label} style={{
                  fontSize: 10, color: row.sel ? '#e2e8f0' : '#94a3b8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{row.d.label}</span>
                {row.noNum ? (
                  <span style={{ fontSize: 9, color: '#64748b', textAlign: 'right' }}>{row.noText}</span>
                ) : (
                  <>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3,
                        background: CC[row.d.category],
                        width: (grown || reducedMotion) ? pct + '%' : '0%',
                        transition: (grown && !reducedMotion)
                          ? `width ${DUR.slow}ms ${EASE.ui} ${delay}ms`
                          : 'none',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtFull(row.value)}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
