import React, { useEffect } from 'react';
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

// The seven chapters on the number row: the six story chips above, in order,
// then Galaxy Roulette. Keyed off ids, not JSX, so the Task 4 (2026-09-10
// plan) keyboard handler below can fire the same chapters the mouse does.
const CHIPS = [...chips.map(c => c.id), 'roulette'];

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
const rHIn = e => {
  const s = e.currentTarget.style;
  s.boxShadow = '0 0 8px 1px rgba(245,158,11,0.5), 0 0 20px 3px rgba(245,158,11,0.2)';
  s.borderColor = 'rgba(245,158,11,0.7)';
};
const rHOut = e => {
  const s = e.currentTarget.style;
  s.boxShadow = 'none';
  s.borderColor = 'rgba(255,255,255,0.1)';
};

export default function StoryChips() {
  const storyVisible = useStore(s => s.storyVisible);
  const storyActive = useStore(s => s.storyActive);
  const setStoryActive = useStore(s => s.setStoryActive);
  const roulettePhase = useStore(s => s.roulettePhase);
  const startRoulette = useStore(s => s.startRoulette);
  const isRouletteActive = roulettePhase !== 'idle';
  // Chips arrive with the rest of the chrome, at the overture's release beat.
  const uiRevealed = useStore(s => s.uiRevealed);
  // ...but not while the release caption still owns the bottom band. The film
  // sets `hintsShown` once "Explore the gap." has left the frame (review gate
  // F2, OvertureSequence's releaseCues); finishOverture sets it too, so a film
  // that ends early still lands the chips. Outside the film it is simply true.
  const bandShown = useStore(s => s.hintsShown);

  // What each chip does, keyed by id: the six chips above set the story,
  // roulette starts the takeover (reading live state, not a render-scoped
  // flag, so it stays correct however long after mount it fires).
  const fireChip = (id) => {
    if (id === 'roulette') {
      if (useStore.getState().roulettePhase === 'idle') startRoulette();
      return;
    }
    setStoryActive(id);
  };

  // Task 4 (2026-09-10 plan): the seven chapters on the number row, when the
  // chips are up and nothing else owns the keyboard.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const tag = t && t.tagName;
      if (t && (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable)) return;
      const n = Number(e.key);
      if (!(n >= 1 && n <= CHIPS.length)) return;
      const s = useStore.getState();
      if (!s.storyVisible || !s.uiRevealed || s.overtureActive || s.tmPhase !== 'idle' ||
          s.activeMode || s.methodologyOpen || s.roulettePhase !== 'idle' || s.storyActive) return;
      e.preventDefault();
      fireChip(CHIPS[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!storyVisible && uiRevealed) return null;

  const mob = isMob();
  const show = storyVisible && uiRevealed && bandShown;

  return (
    <div style={{
      position: 'absolute', bottom: mob ? 32 : 50, left: '50%', transform: 'translateX(-50%)',
      zIndex: 45, display: mob ? 'grid' : 'flex',
      gridTemplateColumns: mob ? 'repeat(4,1fr)' : undefined,
      gap: mob ? 6 : 10, fontFamily: 'IBM Plex Mono,monospace',
      opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden',
      pointerEvents: show ? 'auto' : 'none',
      transition: 'opacity 0.4s ease, visibility 0.4s ease',
      // Same Chromium shrink-to-fit trap the Task 17 mobile sweep found in
      // HintChips (see HintChips.jsx): an absolutely positioned flex row
      // anchored by `left:50%` with no explicit width resolves to roughly half
      // its containing block, not its content's natural width. Mobile was
      // already pinned at 92vw by that sweep, which is why only the desktop
      // row was left broken — at 1440px, half is 720px against the ~880px
      // seven chips need, so every label wrapped to two lines (review gate F3,
      // rg1-09: "Most / Researched", "Rich / vs / Poor"). max-content sizes
      // the row to the chips themselves.
      width: mob ? '92vw' : 'max-content',
    }}>
      {chips.map((c, i) => (
        <button
          key={c.id}
          onClick={() => fireChip(c.id)}
          title={`Press ${i + 1}`}
          style={{
            ...chipBtnStyle,
            padding: mob ? '6px 4px' : '8px 16px',
            fontSize: mob ? 10 : 12,
          }}
          onMouseEnter={hIn}
          onMouseLeave={hOut}
        >{c.label}</button>
      ))}
      <button
        onClick={() => fireChip('roulette')}
        disabled={isRouletteActive}
        title={`Press ${chips.length + 1}`}
        style={{
          ...chipBtnStyle,
          padding: mob ? '6px 4px' : '8px 16px',
          fontSize: mob ? 10 : 12,
          color: isRouletteActive ? '#f59e0b' : '#e2e8f0',
          borderColor: isRouletteActive ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)',
          opacity: isRouletteActive ? 0.7 : 1,
        }}
        onMouseEnter={rHIn}
        onMouseLeave={rHOut}
      >{isRouletteActive ? 'Spinning...' : 'Galaxy Roulette'}</button>
    </div>
  );
}
