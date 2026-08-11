import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

const HINTS = [
  { key: 'orbit', label: 'Drag to orbit' },
  { key: 'select', label: 'Click any disease' },
  { key: 'timeMachine', label: 'Try the Time Machine' },
];

// Bottom-center hint row shown above StoryChips once hintsShown flips on.
// Each chip disappears when its key enters hintsDismissed. Dismissal
// wiring (attaching onClick handlers that call hintDismiss) arrives in
// Task 11; this component only reads state.
export default function HintChips() {
  const hintsShown = useStore((s) => s.hintsShown ?? false);
  const hintsDismissed = useStore((s) => s.hintsDismissed ?? null);

  const visibleHints = HINTS.filter((h) => !(hintsDismissed && hintsDismissed.has(h.key)));

  if (!hintsShown || visibleHints.length === 0) return null;

  const mob = isMob();

  return (
    <div
      style={{
        position: 'absolute', bottom: mob ? 82 : 100, left: '50%', transform: 'translateX(-50%)',
        zIndex: 45, display: 'flex', gap: mob ? 6 : 10,
        fontFamily: "'IBM Plex Mono', monospace", pointerEvents: 'none',
      }}
    >
      {visibleHints.map((h, i) => (
        <div
          key={h.key}
          style={{
            padding: mob ? '5px 10px' : '6px 14px', borderRadius: 999,
            background: 'rgba(10,16,30,0.85)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', fontSize: mob ? 9 : 10,
            opacity: 0, animation: `hintChipIn 300ms ease ${i * 300}ms forwards`,
          }}
        >
          {h.label}
        </div>
      ))}
      <style>{`
        @keyframes hintChipIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
