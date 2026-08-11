import React from 'react';
import useStore from '../../store';

const TICKS = 3; // one per upcoming beat (attention, morph, release)

// Quiet bottom-right skip control for the overture. Ticks fill as each beat
// completes: overtureBeat counts the current beat (0=assembly..3=release),
// so completedBeats = overtureBeat - 1 (clamped to 0) is how many of the
// three upcoming beats have finished.
export default function SkipPill() {
  const overtureActive = useStore((s) => s.overtureActive ?? false);
  const overtureBeat = useStore((s) => s.overtureBeat ?? 0);
  const skipOverture = useStore((s) => s.skipOverture);

  if (!overtureActive) return null;

  const completedBeats = Math.max(0, Math.min(TICKS, overtureBeat - 1));
  const handleClick = () => {
    if (typeof skipOverture === 'function') skipOverture();
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 46,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: 'rgba(10,16,30,0.85)', border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#64748b',
        cursor: 'pointer', pointerEvents: 'auto',
        opacity: 0, animation: 'skipPillIn 240ms ease 0.5s forwards',
      }}
    >
      <span>skip intro</span>
      <span style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: TICKS }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 10, height: 2, borderRadius: 1,
              background: i < completedBeats ? '#94a3b8' : 'rgba(148,163,184,0.25)',
              transition: 'background 240ms ease',
            }}
          />
        ))}
      </span>
      <style>{`
        @keyframes skipPillIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </button>
  );
}
