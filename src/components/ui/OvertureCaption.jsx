import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import Odometer from './Odometer';

const EXIT_MS = 200;

// Drives Odometer through overtureCaption.odometer's from -> to values once,
// on mount. Remounted per caption by the parent's key={captionKey}, so a new
// caption always restarts its own roll.
function OdometerAnimated({ odometer }) {
  const { from, fromUnit, to, toUnit } = odometer;
  const [state, setState] = useState({ value: from, unit: fromUnit });

  useEffect(() => {
    const t = setTimeout(() => setState({ value: to, unit: toUnit }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Odometer value={state.value} unit={state.unit} />;
}

// Follows the SpotlightCaption glass-card pattern (see docs/superpowers/plans/
// reference/uiShell.md section 6) but centered lower-third with no kicker.
// Renders from overtureActive / overtureCaption only; no beat logic lives
// here, that belongs to the FSM that drives these store fields.
export default function OvertureCaption() {
  const overtureActive = useStore((s) => s.overtureActive ?? false);
  const overtureCaption = useStore((s) => s.overtureCaption ?? null);
  const active = overtureActive && !!overtureCaption;

  // Hold the last caption briefly after it goes inactive so the exit can
  // play a plain fade instead of an instant unmount (typography spec: exit
  // is a 200ms fade, no rise).
  const [rendered, setRendered] = useState(active ? overtureCaption : null);
  const [visible, setVisible] = useState(active);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (active) {
      setRendered(overtureCaption);
      setVisible(true);
    } else if (rendered) {
      setVisible(false);
      timerRef.current = setTimeout(() => setRendered(null), EXIT_MS);
    }
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, overtureCaption]);

  if (!rendered) return null;
  const mob = isMob();
  const { lines = [], data, odometer, heroLine = 0 } = rendered;
  const captionKey = lines.join('\n');

  return (
    <div
      // Marked so the in-world micro-labels can measure the sheet and stay
      // clear of it on a phone, where the caption owns the lower frame
      // (OvertureMicroLabels, review gate round 2, P1 #6).
      data-mg-overture-caption=""
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '14px 20px' : '18px 32px',
        // Chromium's shrink-to-fit width for an absolutely positioned,
        // auto-width box anchored by `left:50%` resolves to roughly half its
        // containing block, not the content's natural width — invisible at
        // 1440px (half is still wider than any caption line) but at 375px
        // half is 187.5px, well under a line's own 85vw allowance, so the
        // card clamped itself and wrapped short sentences to three lines
        // (Task 17 mobile sweep, mob-film-caption: "Where the world's
        // attention goes." wrapped 1 word per line). max-content sizes the
        // card to its content; the lines' own maxWidth below still caps
        // genuinely long captions.
        width: 'max-content',
        fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transition: visible ? 'none' : `opacity ${EXIT_MS}ms ease`,
      }}
    >
      {lines.map((line, i) => (
        // Keyed by text, not index: a line that survives a caption change (the
        // thesis frame keeps "But this is who actually dies." while the hero
        // line joins beneath it) keeps its DOM node, so it does not replay its
        // entrance. It steps down to the lead style instead, on a sanctioned
        // 240 ms, which is what gives the hero line the frame.
        <div
          key={line}
          style={{
            fontSize: i === heroLine ? 'clamp(20px, 3.2vw, 34px)' : 'clamp(14px, 1.9vw, 20px)',
            fontWeight: i === heroLine ? 500 : 400,
            color: i === heroLine ? '#e2e8f0' : '#94a3b8',
            lineHeight: 1.25, whiteSpace: mob ? 'normal' : 'nowrap', maxWidth: mob ? '85vw' : 'none',
            marginBottom: i === heroLine ? 0 : 4,
            transition: 'font-size 240ms ease, color 240ms ease',
            animation: visible ? `overtureLineIn 300ms ease ${i * 90}ms forwards` : 'none',
          }}
        >
          {line}
        </div>
      ))}
      {odometer ? (
        <div style={{ marginTop: 10 }}>
          <OdometerAnimated key={captionKey} odometer={odometer} />
        </div>
      ) : data ? (
        <div
          style={{
            fontSize: 11, color: '#94a3b8', marginTop: 8,
            animation: visible ? `overtureLineIn 300ms ease ${lines.length * 90}ms forwards` : 'none',
          }}
        >
          {data}
        </div>
      ) : null}
      <style>{`
        @keyframes overtureLineIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
