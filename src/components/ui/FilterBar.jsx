import React from 'react';
import useStore from '../../store';
import { CC, CL, CATS } from '../../utils/constants';
import { isMob } from '../../utils/helpers';

export default function FilterBar() {
  const activeCats = useStore(s => s.activeCats);
  const toggleCat = useStore(s => s.toggleCat);
  const neglectMode = useStore(s => s.neglectMode);
  const introStarted = useStore(s => s.introStarted);

  if (isMob()) return null;

  if (neglectMode) {
    return (
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, zIndex: 40,
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, pointerEvents: 'none',
        opacity: 0, animation: 'fadeIn 0.4s ease forwards',
      }}>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>OVERLOOKED</span>
        <div style={{ width: 180, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e)' }} />
        <span style={{ color: '#22c55e', fontWeight: 600 }}>HIGH ATTENTION</span>
        <span style={{ color: '#64748b', marginLeft: 8 }}>&middot;</span>
        <span style={{ color: '#64748b' }}>Papers per death (log scale)</span>
      </div>
    );
  }

  const allActive = activeCats.size === CATS.length;

  return (
    <div style={{
      position: 'absolute', top: 50, left: 0, right: 0, zIndex: 40,
      padding: '0 20px', display: 'flex', flexWrap: 'wrap', gap: 5,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, pointerEvents: 'none',
      transform: 'translateY(-60px)', animation: introStarted ? 'slideDown 0.5s ease 3.15s forwards' : 'none',
    }}>
      <button
        onClick={() => toggleCat('ALL')}
        style={{
          pointerEvents: 'auto', padding: '4px 12px', borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 10,
          background: allActive ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: allActive ? '#e2e8f0' : '#64748b',
        }}
      >ALL</button>
      {CATS.map(cat => {
        const on = activeCats.has(cat);
        return (
          <button
            key={cat}
            onClick={() => toggleCat(cat)}
            style={{
              pointerEvents: 'auto', padding: '4px 12px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
              background: on ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: on ? '#e2e8f0' : '#475569', opacity: on ? 1 : 0.5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[cat] }} />
            {CL[cat]}
          </button>
        );
      })}
    </div>
  );
}
