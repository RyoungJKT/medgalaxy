import React from 'react';
import useStore from '../../store';
import { CC } from '../../utils/constants';

export default function SearchDropdown({ onSelect }) {
  const searchQuery = useStore(s => s.searchQuery);
  const diseases = useStore(s => s.diseases);

  if (!searchQuery || searchQuery.length < 1) return null;

  const q = searchQuery.toLowerCase();
  const matches = diseases.filter(d => d.label.toLowerCase().includes(q)).slice(0, 8);

  if (!matches.length) return null;

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
      zIndex: 60, background: 'rgba(10,16,30,0.96)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 4,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, minWidth: 200,
    }}>
      {matches.map(d => (
        <div
          key={d.id}
          onClick={() => onSelect(d)}
          style={{ padding: '5px 8px', cursor: 'pointer', borderRadius: 4, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[d.category] }} />
          {d.label}
        </div>
      ))}
    </div>
  );
}
