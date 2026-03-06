import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store';
import { CC, CL } from '../../utils/constants';
import { fmt } from '../../utils/helpers';

export default function Tooltip() {
  const hoveredNode = useStore(s => s.hoveredNode);
  const connCounts = useStore(s => s.connCounts);
  const selectedNode = useStore(s => s.selectedNode);

  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const show = hoveredNode && !(selectedNode && hoveredNode.index === selectedNode.index);
  if (!show || !hoveredNode) return null;

  const disease = hoveredNode.disease;
  const connCount = connCounts.get(hoveredNode.index) || 0;
  const c = CC[disease.category];
  const t = disease.trend;
  const ar = t > 0 ? '\u2191' : t < 0 ? '\u2193' : '\u2192';

  return (
    <div style={{
      position: 'fixed', left: pos.x + 15, top: pos.y + 15,
      pointerEvents: 'none', zIndex: 100,
      background: 'rgba(10,16,30,0.94)', backdropFilter: 'blur(16px)',
      maxWidth: 240, border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '8px 12px',
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#e2e8f0',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3 }}>{disease.label}</div>
      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: c + '22', color: c }}>
        {CL[disease.category]}
      </span>
      <div style={{ color: '#94a3b8', marginTop: 4 }}>
        {fmt(disease.papers)} papers{' '}
        <span style={{ color: t > 0 ? '#22c55e' : t < 0 ? '#ef4444' : '#94a3b8' }}>
          {ar}{Math.abs(t)}%
        </span>
      </div>
      <div style={{ color: '#64748b' }}>{connCount} connections</div>
    </div>
  );
}
