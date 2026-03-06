import React, { useMemo } from 'react';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';

function fG(v) { return v >= 10 ? String(Math.round(v)) + '\u00d7' : v >= 1 ? v.toFixed(1) + '\u00d7' : v.toFixed(2) + '\u00d7'; }
function fP(v) { return v >= 0 ? '+' + Math.round(v) + '%' : Math.round(v) + '%'; }

export default function VelocityOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const diseases = useStore(s => s.diseases);

  const velocityData = useMemo(() => {
    const items = diseases
      .filter(d => d.yearlyPapers && d.yearlyPapers.length >= 6)
      .map(d => {
        const yp = d.yearlyPapers;
        const early = yp.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const late = yp.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const growth = early > 0 ? late / early : 0;
        const pctChange = early > 0 ? ((late / early) - 1) * 100 : 0;
        return { ...d, growth, pctChange, early, late };
      });
    const nonCovid = items.filter(d => d.id !== 'covid-19');
    const rising = [...nonCovid].sort((a, b) => b.growth - a.growth).slice(0, 10);
    const declining = [...items].filter(d => d.pctChange < 0).sort((a, b) => a.growth - b.growth).slice(0, 10);
    return { rising, declining };
  }, [diseases]);

  const show = activeMode === 'velocity';
  const mob = isMob();

  if (!show) return null;

  const maxG = velocityData.rising[0]?.growth || 1;
  const maxD = Math.abs(velocityData.declining[0]?.growth) || 1;

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
        <div style={{ fontSize: mob ? 14 : 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Research Trends</div>
        <div style={{ fontSize: mob ? 9 : 12, color: '#64748b', marginBottom: mob ? 16 : 24 }}>
          Publication growth rate over the last decade — which diseases are surging and which are fading
        </div>
        <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 20 : 36 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Fastest Rising</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Highest publication growth (excl. COVID-19)</div>
            {velocityData.rising.map((d, i) => (
              <div key={d.id} style={{ marginBottom: 8, opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[d.category], flexShrink: 0 }} />{d.label}
                  </span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#f59e0b', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{fG(d.growth)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((d.growth / maxG) * 100, 2)}%`, background: 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{fP(d.pctChange)} &middot; avg {fmt(Math.round(d.early))}/yr &rarr; {fmt(Math.round(d.late))}/yr</div>
              </div>
            ))}
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', display: mob ? 'none' : 'block' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Fading Research</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Declining publication trends</div>
            {velocityData.declining.map((d, i) => (
              <div key={d.id} style={{ marginBottom: 8, opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[d.category], flexShrink: 0 }} />{d.label}
                  </span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#64748b', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{fP(d.pctChange)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((Math.abs(d.growth) / maxD) * 100, 2)}%`, background: 'linear-gradient(90deg,#64748b,#475569)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
                  avg {fmt(Math.round(d.early))}/yr &rarr; {fmt(Math.round(d.late))}/yr &middot; {d.mortality > 0 ? fmt(d.mortality) + ' deaths/yr' : '\u2014'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
