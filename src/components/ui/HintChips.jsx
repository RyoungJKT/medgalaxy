import React, { useEffect } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import { sceneRefs } from '../../sceneRefs';

const HINTS = [
  { key: 'orbit', label: 'Drag to orbit' },
  { key: 'select', label: 'Click any disease' },
  { key: 'timeMachine', label: 'Try the Time Machine' },
];

// Bottom-center hint row shown above StoryChips once hintsShown flips on.
// Each chip disappears when its key enters hintsDismissed: on the interaction
// it teaches (first orbit drag, first selection, first Time Machine move), or
// on a click of the chip itself.
export default function HintChips() {
  const hintsShown = useStore((s) => s.hintsShown ?? false);
  const hintsDismissed = useStore((s) => s.hintsDismissed ?? null);
  const hintDismiss = useStore((s) => s.hintDismiss);
  // The Time Machine owns bottom center while it is up; the chips that are
  // still standing step aside for it and come back when it closes.
  const tmPhase = useStore((s) => s.tmPhase ?? 'idle');

  // "Drag to orbit" — first controls interaction. The controls instance is
  // published by CameraRig, which may mount after this component.
  useEffect(() => {
    if (!hintsShown) return;
    let controls = null;
    let raf = 0;
    const onStart = () => useStore.getState().hintDismiss('orbit');
    const attach = () => {
      controls = sceneRefs.controls;
      if (controls && controls.addEventListener) controls.addEventListener('start', onStart);
      else raf = requestAnimationFrame(attach);
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      if (controls && controls.removeEventListener) controls.removeEventListener('start', onStart);
    };
  }, [hintsShown]);

  // "Click any disease" — first selection. "Try the Time Machine" — first move
  // of the scrubber (tmPhase lands with the Time Machine itself).
  useEffect(() => {
    if (!hintsShown) return;
    const unsubSel = useStore.subscribe(
      (s) => s.selectedNode,
      (sel) => { if (sel) useStore.getState().hintDismiss('select'); }
    );
    const unsubTm = useStore.subscribe(
      (s) => s.tmPhase,
      (phase) => { if (phase && phase !== 'idle') useStore.getState().hintDismiss('timeMachine'); }
    );
    return () => { unsubSel(); unsubTm(); };
  }, [hintsShown]);

  const visibleHints = HINTS.filter((h) => !(hintsDismissed && hintsDismissed.has(h.key)));

  if (!hintsShown || visibleHints.length === 0 || tmPhase !== 'idle') return null;

  const mob = isMob();

  return (
    <div
      style={{
        position: 'absolute', bottom: mob ? 176 : 200, left: '50%', transform: 'translateX(-50%)',
        zIndex: 45, display: 'flex', gap: mob ? 6 : 10,
        fontFamily: "'IBM Plex Mono', monospace", pointerEvents: 'none',
      }}
    >
      {visibleHints.map((h, i) => (
        <div
          key={h.key}
          onClick={() => hintDismiss && hintDismiss(h.key)}
          style={{
            padding: mob ? '5px 10px' : '6px 14px', borderRadius: 999,
            background: 'rgba(10,16,30,0.85)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', fontSize: mob ? 9 : 10,
            pointerEvents: 'auto', cursor: 'pointer',
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
