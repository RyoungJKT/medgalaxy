import React, { useMemo } from 'react';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';

export default function ConnectionsOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const setConnFocusIdx = useStore(s => s.setConnFocusIdx);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const connFocusSelect = useStore(s => s.connFocusSelect);

  const connData = useMemo(() => {
    const counts = new Map();
    diseases.forEach(d => counts.set(d.id, 0));
    displayEdges.forEach(c => {
      counts.set(diseases[c.si].id, (counts.get(diseases[c.si].id) || 0) + 1);
      counts.set(diseases[c.ti].id, (counts.get(diseases[c.ti].id) || 0) + 1);
    });
    const catMap = new Map();
    diseases.forEach(d => catMap.set(d.id, d.category));
    const labelMap = new Map();
    diseases.forEach(d => labelMap.set(d.id, d.label));

    const hubs = [...counts.entries()]
      .map(([id, count]) => ({ id, label: labelMap.get(id), category: catMap.get(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const reasons = {
      'infectious-respiratory': 'shared pathogen-host pathways',
      'cardiovascular-metabolic': 'metabolic-cardiovascular syndrome',
      'autoimmune-metabolic': 'autoimmune metabolic overlap',
      'neurological-metabolic': 'neurometabolic pathways',
      'cancer-infectious': 'oncogenic infection link',
      'respiratory-cancer': 'shared carcinogenic exposure',
      'infectious-neurological': 'neuroinfectious pathway',
      'cardiovascular-respiratory': 'cardiopulmonary comorbidity',
      'mental-neurological': 'neuropsychiatric overlap',
      'mental-metabolic': 'metabolic-psychiatric link',
    };

    const crossLinks = displayEdges
      .filter(e => diseases[e.si].category !== diseases[e.ti].category)
      .sort((a, b) => b.sharedPapers - a.sharedPapers)
      .slice(0, 10)
      .map(e => {
        const s = diseases[e.si], t = diseases[e.ti];
        const key = [s.category, t.category].sort().join('-');
        return {
          sLabel: s.label, tLabel: t.label,
          sCat: s.category, tCat: t.category,
          shared: e.sharedPapers,
          reason: reasons[key] || 'cross-category link',
        };
      });

    return { hubs, crossLinks };
  }, [diseases, displayEdges]);

  const show = activeMode === 'connections';
  const mob = isMob();

  if (!show) return null;

  const maxConn = connData.hubs[0]?.count || 1;

  const handleSelect = (id) => {
    if (connFocusSelect) connFocusSelect(id);
    setActiveMode(null);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      fontFamily: 'IBM Plex Mono,monospace', opacity: 0, animation: 'fadeIn 0.5s ease 0.3s forwards',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: 'rgba(10,16,30,0.97)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, padding: mob ? 16 : 28, maxWidth: mob ? '95vw' : 880,
        width: '100%', maxHeight: '85vh', overflowY: 'auto', position: 'relative',
      }}>
        <button onClick={() => { setConnFocusIdx(-1); setActiveMode(null); }} style={{
          position: 'absolute', top: 12, right: 14, background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 8px', fontFamily: 'inherit',
        }}>&#x2715; Close</button>
        <div style={{ fontSize: mob ? 14 : 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Connection Clusters</div>
        <div style={{ fontSize: mob ? 9 : 12, color: '#64748b', marginBottom: mob ? 16 : 24 }}>
          Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap — revealing comorbidities, shared biology, and research overlap
        </div>
        <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 20 : 36 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#3399ff', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Hub Diseases</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Most connected — tap to explore</div>
            {connData.hubs.map((d, i) => (
              <div
                key={d.id}
                onClick={() => handleSelect(d.id)}
                style={{ marginBottom: 8, cursor: 'pointer', opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}
                onMouseEnter={e => { e.currentTarget.querySelector('.hub-bar').style.filter = 'brightness(1.3)'; }}
                onMouseLeave={e => { e.currentTarget.querySelector('.hub-bar').style.filter = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[d.category], flexShrink: 0 }} />{d.label}
                  </span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#3399ff', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>{d.count}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div className="hub-bar" style={{ height: '100%', width: `${Math.max((d.count / maxConn) * 100, 2)}%`, background: 'linear-gradient(90deg,#3399ff,#1d6fcf)', borderRadius: 3, transition: 'width 0.6s ease,filter 0.2s' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', display: mob ? 'none' : 'block' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#ffd500', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Surprising Links</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 12 }}>Cross-category connections with most shared research</div>
            {connData.crossLinks.map((d, i) => (
              <div key={i} style={{ marginBottom: 10, opacity: 0, animation: `fadeIn 0.3s ease ${0.5 + i * 0.05}s forwards` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: CC[d.sCat] }} />{d.sLabel}
                  </span>
                  <span style={{ fontSize: 9, color: '#ffd500' }}>&#x27f7;</span>
                  <span style={{ fontSize: mob ? 9 : 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: CC[d.tCat] }} />{d.tLabel}
                  </span>
                </div>
                <div style={{ fontSize: mob ? 8 : 9, color: '#64748b' }}>{fmt(d.shared)} shared papers &middot; {d.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
