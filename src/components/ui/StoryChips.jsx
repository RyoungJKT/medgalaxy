import React, { useState, useEffect } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

const chips = [
  { id: 'researched', label: 'Most Researched', desc: 'See the biggest research spheres' },
  { id: 'killers', label: 'Biggest Killers', desc: 'Diseases with highest mortality' },
  { id: 'forgotten', label: 'Forgotten Diseases', desc: 'Declining research, rising deaths' },
  { id: 'silent', label: 'Silent Killers', desc: 'High mortality, minimal attention' },
  { id: 'richpoor', label: 'Rich vs Poor', desc: 'Who gets the research?' },
  { id: 'mismatch', label: 'See the Mismatch', desc: 'The 2,000:1 research gap' },
];

const chipBtnStyle = {
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(10,16,30,0.92)', color: '#e2e8f0',
  cursor: 'pointer', fontFamily: 'inherit',
  transition: 'background 0.2s, box-shadow 0.3s, border-color 0.3s',
};

const hIn = e => {
  const s = e.currentTarget.style;
  s.boxShadow = '0 0 8px 1px rgba(57,255,20,0.4), 0 0 20px 3px rgba(57,255,20,0.15)';
  s.borderColor = 'rgba(57,255,20,0.6)';
};
const hOut = e => {
  const s = e.currentTarget.style;
  s.boxShadow = 'none';
  s.borderColor = 'rgba(255,255,255,0.1)';
};

export default function StoryChips() {
  const storyVisible = useStore(s => s.storyVisible);
  const setStoryActive = useStore(s => s.setStoryActive);
  const startRandomPick = useStore(s => s.startRandomPick);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2800);
    return () => clearTimeout(t);
  }, []);

  if (!storyVisible && mounted) return null;

  const mob = isMob();
  const show = storyVisible && mounted;

  return (
    <div style={{
      position: 'absolute', bottom: mob ? 32 : 50, left: '50%', transform: 'translateX(-50%)',
      zIndex: 45, display: mob ? 'grid' : 'flex',
      gridTemplateColumns: mob ? 'repeat(4,1fr)' : undefined,
      gap: mob ? 6 : 10, fontFamily: 'IBM Plex Mono,monospace',
      opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden',
      pointerEvents: show ? 'auto' : 'none',
      transition: 'opacity 0.4s ease, visibility 0.4s ease',
      width: mob ? '92vw' : undefined,
    }}>
      {chips.map(c => (
        <button
          key={c.id}
          onClick={() => setStoryActive(c.id)}
          style={{ ...chipBtnStyle, padding: mob ? '6px 4px' : '8px 16px', fontSize: mob ? 9 : 11 }}
          onMouseEnter={hIn}
          onMouseLeave={hOut}
        >{c.label}</button>
      ))}
      <button
        onClick={startRandomPick}
        style={{ ...chipBtnStyle, padding: mob ? '6px 4px' : '8px 16px', fontSize: mob ? 9 : 11, border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
        onMouseEnter={e => {
          const s = e.currentTarget.style;
          s.boxShadow = '0 0 8px 1px rgba(245,158,11,0.4), 0 0 20px 3px rgba(245,158,11,0.15)';
          s.borderColor = 'rgba(245,158,11,0.6)';
        }}
        onMouseLeave={e => {
          const s = e.currentTarget.style;
          s.boxShadow = 'none';
          s.borderColor = 'rgba(245,158,11,0.3)';
        }}
      >&#x27f3; Random Pick</button>
    </div>
  );
}
