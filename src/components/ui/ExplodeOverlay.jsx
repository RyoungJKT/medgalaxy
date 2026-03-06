import React, { useMemo } from 'react';
import useStore from '../../store';
import { fmt, isMob } from '../../utils/helpers';

function fR(v) {
  return v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v.toFixed(3);
}

export default function ExplodeOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const diseases = useStore(s => s.diseases);

  const ppdData = useMemo(() => {
    const withRatio = diseases
      .filter(d => d.mortality > 0)
      .map(d => ({ ...d, ppd: d.papers / d.mortality }));
    const sorted = [...withRatio].sort((a, b) => b.ppd - a.ppd);
    return { highest: sorted.slice(0, 10), lowest: sorted.slice(-10).reverse() };
  }, [diseases]);

  const show = activeMode === 'explode';
  const mob = isMob();

  if (!show) return null;

  const maxH = ppdData.highest[0]?.ppd || 1;
  const minPPD = ppdData.lowest[0]?.ppd || 0.001;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      fontFamily: 'IBM Plex Mono,monospace', opacity: 0, animation: 'fadeIn 0.5s ease 0.3s forwards',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: 'rgba(10,16,30,0.97)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, padding: mob ? 16 : 28, maxWidth: mob ? '95vw' : 820,
        width: '100%', maxHeight: '85vh', overflowY: 'auto', position: 'relative',
      }}>
        <button onClick={() => setActiveMode(null)} style={{
          position: 'absolute', top: 12, right: 14, background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 8px', fontFamily: 'inherit',
        }}>&#x2715; Close</button>
        <div style={{ fontSize: mob ? 14 : 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Research Intensity</div>
        <div style={{ fontSize: mob ? 9 : 12, color: '#64748b', marginBottom: mob ? 16 : 24 }}>
          Papers published per reported death — revealing where research attention doesn't match disease burden
        </div>
        <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 20 : 36 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Most Over-Researched</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Highest papers per death</div>
            {ppdData.highest.map((d, i) => (
              <div key={d.id} style={{ marginBottom: 8, opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1' }}>{d.label}</span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#22c55e', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{fR(d.ppd)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((d.ppd / maxH) * 100, 2)}%`, background: 'linear-gradient(90deg,#22c55e,#059669)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', display: mob ? 'none' : 'block' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Most Under-Researched</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Fewest papers per death</div>
            {ppdData.lowest.map((d, i) => (
              <div key={d.id} style={{ marginBottom: 8, opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1' }}>{d.label}</span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#ef4444', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{fR(d.ppd)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((minPPD / d.ppd) * 100, 2)}%`, background: 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
