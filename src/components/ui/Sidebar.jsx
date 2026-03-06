import React, { useRef, useState, useCallback } from 'react';
import useStore from '../../store';
import { CC, CL } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';
import Sparkline from './Sparkline';

function SB({ l, v, s, vc }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: vc || '#e2e8f0' }}>{v} {s && <span style={{ fontSize: 10, fontWeight: 400 }}>{s}</span>}</div>
    </div>
  );
}

export default function Sidebar() {
  const selectedNode = useStore(s => s.selectedNode);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const connCounts = useStore(s => s.connCounts);
  const deselect = useStore(s => s.deselect);
  const selectDisease = useStore(s => s.selectDisease);

  const mob = isMob();
  const panelRef = useRef(null);
  const [panelH, setPanelH] = useState(60);
  const swipeRef = useRef({ startY: 0, curY: 0, swiping: false, startH: 60 });

  const onClose = useCallback(() => { deselect(); }, [deselect]);

  const onSwipeStart = useCallback((e) => {
    if (!mob) return;
    const touch = e.touches[0];
    swipeRef.current = { startY: touch.clientY, curY: touch.clientY, swiping: true, startH: panelH };
    if (panelRef.current) panelRef.current.style.transition = 'none';
  }, [mob, panelH]);

  const onSwipeMove = useCallback((e) => {
    if (!mob || !swipeRef.current.swiping) return;
    const touch = e.touches[0];
    swipeRef.current.curY = touch.clientY;
    const dy = touch.clientY - swipeRef.current.startY;
    const vhPx = window.innerHeight / 100;
    const dh = dy / vhPx;
    const newH = Math.max(10, Math.min(85, swipeRef.current.startH - dh));
    if (panelRef.current) {
      panelRef.current.style.height = newH + 'vh';
      panelRef.current.style.maxHeight = newH + 'vh';
    }
  }, [mob]);

  const onSwipeEnd = useCallback(() => {
    if (!mob || !swipeRef.current.swiping) return;
    swipeRef.current.swiping = false;
    const dy = swipeRef.current.curY - swipeRef.current.startY;
    const vhPx = window.innerHeight / 100;
    const newH = Math.max(10, Math.min(85, swipeRef.current.startH - (dy / vhPx)));
    if (panelRef.current) {
      panelRef.current.style.transition = 'height 0.25s ease, max-height 0.25s ease, opacity 0.25s ease';
    }
    if (newH <= 12) {
      if (panelRef.current) {
        panelRef.current.style.height = '0vh';
        panelRef.current.style.maxHeight = '0vh';
        panelRef.current.style.opacity = '0';
      }
      setTimeout(onClose, 250);
    } else {
      setPanelH(Math.round(newH));
    }
  }, [mob, onClose]);

  if (!selectedNode) return null;

  const disease = selectedNode.disease;
  const idx = selectedNode.index;
  const c = CC[disease.category];
  const cc = connCounts.get(idx);
  const t = disease.trend;
  const ar = t > 0 ? '\u2191' : t < 0 ? '\u2193' : '\u2192';
  const tc = t > 0 ? '#22c55e' : t < 0 ? '#ef4444' : '#94a3b8';
  const gc = { high: '#ef4444', medium: '#eab308', low: '#22c55e' };
  const ppd = disease.mortality > 0 ? disease.papers / disease.mortality : null;
  const ppdStr = ppd === null ? 'N/A' : ppd >= 10 ? String(Math.round(ppd)) : ppd >= 1 ? ppd.toFixed(1) : ppd >= 0.01 ? ppd.toFixed(2) : ppd.toFixed(3);

  const conns = displayEdges
    .filter(e => e.si === idx || e.ti === idx)
    .map(e => {
      const oi = e.si === idx ? e.ti : e.si;
      return { d: diseases[oi], sp: e.sharedPapers, t: e.trend, oi };
    })
    .sort((a, b) => b.sp - a.sp);

  const panelStyle = mob
    ? { position: 'absolute', bottom: 0, left: 0, right: 0, height: panelH + 'vh', maxHeight: panelH + 'vh', background: 'rgba(10,16,30,0.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 0 0', fontFamily: 'IBM Plex Mono,monospace', color: '#e2e8f0', overflowY: 'auto', overflowX: 'hidden', zIndex: 50, fontSize: 11 }
    : { position: 'absolute', top: 75, right: 0, width: 320, height: 'calc(100% - 75px)', background: 'rgba(10,16,30,0.94)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,0.06)', fontFamily: 'IBM Plex Mono,monospace', color: '#e2e8f0', overflowY: 'auto', overflowX: 'hidden', zIndex: 50, fontSize: 11 };

  return (
    <>
      {mob && <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.4)', pointerEvents: 'auto' }} />}
      <div ref={panelRef} style={{ ...panelStyle, pointerEvents: 'auto' }}>
        {mob && (
          <div onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}
            style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 14px', cursor: 'grab', touchAction: 'none', minHeight: 48 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
          </div>
        )}
        {/* Header */}
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{disease.label}</div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: c + '22', color: c }}>{CL[disease.category]}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>&times;</button>
          </div>
        </div>
        {/* Description */}
        <div style={{ padding: '10px 16px', color: '#94a3b8', lineHeight: 1.5 }}>{disease.description}</div>
        {/* Stats */}
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <SB l="Publications" v={fmt(disease.papers)} s={<span style={{ color: tc }}>{ar}{Math.abs(t)}%</span>} />
          <SB l="Connections" v={cc} />
          <SB l="WHO Deaths/yr" v={disease.mortality > 0 ? fmt(disease.mortality) : 'N/A'} />
          <SB l="Funding Gap" v={disease.fundingGap.toUpperCase()} vc={gc[disease.fundingGap]} />
          <SB l="Papers/Death" v={ppdStr} />
        </div>
        {/* Sparkline */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 4 }}>Publication Trend (2014–2024)</div>
          <Sparkline data={disease.yearlyPapers} color={c} />
        </div>
        {/* PubMed link */}
        <div style={{ padding: '0 16px 12px' }}>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', padding: '8px 0', borderRadius: 6, background: c + '22', color: c, textDecoration: 'none', fontSize: 11, fontWeight: 500 }}
          >View on PubMed &rarr;</a>
        </div>
        {/* Connections */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>Connections ({conns.length})</div>
          <div style={{ color: '#64748b', fontSize: 8, marginBottom: 6 }}>Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap</div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {conns.map((cn, i) => {
              const cc2 = CC[cn.d.category];
              const ta = cn.t === 'up' ? '\u2191' : cn.t === 'down' ? '\u2193' : '\u2192';
              return (
                <div
                  key={i}
                  onClick={() => selectDisease(cn.oi)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', cursor: 'pointer', borderRadius: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cc2, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#cbd5e1' }}>{cn.d.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: 10 }}>{fmt(cn.sp)}</span>
                  <span style={{ color: cn.t === 'up' ? '#22c55e' : cn.t === 'down' ? '#ef4444' : '#64748b', fontSize: 10 }}>{ta}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
