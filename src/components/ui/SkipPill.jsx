import React, { useEffect, useState } from 'react';
import useStore from '../../store';

const TICKS = 3; // one per upcoming beat (attention, morph, release)
const IN_DELAY = 500;  // visible from 0.5 s of the assembly (DIRECTION beat 0)
const IN_MS = 240;
const OUT_MS = 400;

// Quiet bottom-right skip control for the whole opening: the film first
// ("skip intro", ticks filling as each beat completes), then the narrated
// Time Machine tour that follows it ("skip tour"). The film's ticks read off
// overtureBeat: completedBeats = overtureBeat - 1 (clamped to 0) is how many
// of the three upcoming beats have finished. The tour press asks the store
// for the same exit choreography an untouched tour earns, fast-forwarded.
// It is not the any-input handover, which is why the button carries
// data-mg-skip and TimeMachine's window-level handover listener steps aside
// for it.
export default function SkipPill() {
  const overtureActive = useStore((s) => s.overtureActive ?? false);
  const overtureBeat = useStore((s) => s.overtureBeat ?? 0);
  const skipOverture = useStore((s) => s.skipOverture);
  const tmPhase = useStore((s) => s.tmPhase);
  const requestTmTourSkip = useStore((s) => s.requestTmTourSkip);

  const mode = overtureActive ? 'film' : tmPhase === 'tour' ? 'tour' : null;

  // `shown` is the mode the button renders as, and it lags `mode` on the way
  // out: when the phase ends, the same DOM node stays mounted for OUT_MS in
  // its leaving state so the opacity transition actually plays on it, then
  // unmounts. Both `shown` and the entrance reset are adjusted during render
  // (the sanctioned derived-state form), never in a post-paint effect: the
  // first committed frame of a new mode must already be the hidden one, or
  // stale state from the previous mode paints a full-opacity flash.
  const [shown, setShown] = useState(mode);
  const [entered, setEntered] = useState(false);
  if (mode !== null && shown !== mode) {
    setShown(mode);
    setEntered(false);
  }

  useEffect(() => {
    if (!mode) return undefined;
    const t = setTimeout(() => setEntered(true), IN_DELAY);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (mode !== null || shown === null) return undefined;
    const t = setTimeout(() => {
      setShown(null);
      setEntered(false);
    }, OUT_MS + 60);
    return () => clearTimeout(t);
  }, [mode, shown]);

  if (!shown) return null;

  // Leaving covers both exits: the film's own beat 3 fade, and any mode end
  // (a skip, a handover, the tour's finale) while the node rides out OUT_MS.
  const leaving = mode === null || (shown === 'film' && overtureBeat >= 3);
  const completedBeats = Math.max(0, Math.min(TICKS, overtureBeat - 1));
  const handleClick = () => {
    if (mode === 'film') {
      if (typeof skipOverture === 'function') skipOverture();
    } else if (mode === 'tour') {
      if (typeof requestTmTourSkip === 'function') requestTmTourSkip();
    }
  };

  return (
    <button
      onClick={handleClick}
      data-mg-skip="1"
      style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 46,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: 'rgba(10,16,30,0.85)', border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#64748b',
        cursor: 'pointer', pointerEvents: leaving || !entered ? 'none' : 'auto',
        opacity: leaving ? 0 : entered ? 1 : 0,
        transition: `opacity ${leaving ? OUT_MS : IN_MS}ms ease`,
      }}
    >
      <span>{shown === 'film' ? 'skip intro' : 'skip tour'}</span>
      {shown === 'film' && (
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
      )}
    </button>
  );
}
