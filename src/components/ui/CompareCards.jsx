import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, nR, isMob } from '../../utils/helpers';
import { sceneRefs } from '../../sceneRefs';

const pv = new THREE.Vector3();

export default function CompareCards() {
  const selectedNode = useStore(s => s.selectedNode);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const selectDisease = useStore(s => s.selectDisease);
  const [pos, setPos] = useState({ x: 0, y: 0, visible: false });
  const rafRef = useRef(null);

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
        setPos({ x: sx - screenR - 16, y: sy, visible: true });
      }
      rafRef.current = requestAnimationFrame(track);
    }
    rafRef.current = requestAnimationFrame(track);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [selectedNode]);

  // Compute comparisons
  const comparisons = useMemo(() => {
    if (!selectedNode) return [];
    const disease = selectedNode.disease;
    const idx = selectedNode.index;
    const cards = [];
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

    // Card 1: Gets More Attention — similar mortality, way more papers
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
        const ratio = Math.round(d1.papers / disease.papers);
        cards.push({ idx: i1, d: d1, label: 'Gets More Attention', stat: ratio + 'x more papers' });
      }
    }

    // Card 2: Higher Mortality — similar papers, way more deaths
    if (disease.papers > 0) {
      const selP = disease.papers, selM = disease.mortality;
      const i2 = pick((d) => {
        if (d.mortality <= 0) return null;
        const pRatio = d.papers / selP;
        if (pRatio < 0.2 || pRatio > 5) return null;
        if (selM > 0 && d.mortality <= selM) return null;
        if (selM === 0 && d.mortality <= 0) return null;
        return selM > 0 ? d.mortality / selM : d.mortality;
      });
      if (i2 !== null) {
        const d2 = diseases[i2];
        const stat = selM > 0 ? Math.round(d2.mortality / selM) + 'x more deaths' : fmt(d2.mortality) + ' deaths/yr';
        cards.push({ idx: i2, d: d2, label: 'Higher Mortality', stat });
      }
    }

    // Card 3: Strongest Research Link — top shared publications
    const conns = displayEdges
      .filter(e => e.si === idx || e.ti === idx)
      .map(e => ({ oi: e.si === idx ? e.ti : e.si, sp: e.sharedPapers }))
      .sort((a, b) => b.sp - a.sp);
    const top = conns.find(cn => !used.has(cn.oi));
    if (top) {
      used.add(top.oi);
      cards.push({ idx: top.oi, d: diseases[top.oi], label: 'Strongest Research Link', stat: fmt(top.sp) + ' shared papers' });
    }

    return cards;
  }, [selectedNode, diseases, displayEdges]);

  if (isMob() || !selectedNode || !pos.visible || comparisons.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      right: window.innerWidth - pos.x,
      top: pos.y,
      transform: 'translateY(-50%)',
      zIndex: 45,
      display: 'flex', flexDirection: 'column', gap: 5,
      opacity: 0, animation: 'fadeIn 0.5s ease 0.3s forwards',
      pointerEvents: 'auto',
    }}>
      {comparisons.map((card, i) => (
        <div
          key={i}
          onClick={() => selectDisease(card.idx)}
          style={{
            background: 'rgba(10,16,30,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '3px solid ' + CC[card.d.category],
            borderRadius: 7, padding: '7px 11px',
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#e2e8f0',
            cursor: 'pointer', width: 190,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,16,30,0.92)'; }}
        >
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{card.label}</div>
          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.d.label}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{card.stat}</div>
        </div>
      ))}
    </div>
  );
}
