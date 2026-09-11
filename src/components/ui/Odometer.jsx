import React, { useEffect, useRef, useState } from 'react';
import { DUR, EASE } from '../../utils/motion';

// Unit-label crossfade duration (sanctioned time constant).
const UNIT_MS = DUR.ui;

// ─── Digit decomposition ──────────────────────────────────────────────────────
// Splits a number into an ordered array of single characters: digits '0'-'9'
// and comma separators, e.g. digitsOf(11000000) -> ['1','1',',','0','0','0',',','0','0','0'].
// Pure, exported for the odometer test; also drives the digit-column render below.
const nf = new Intl.NumberFormat('en-US');
export function digitsOf(n) {
  return nf.format(Math.round(n)).split('');
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// One fixed-width column showing digits 0-9 stacked vertically; the strip is
// translated with a CSS transform so the current digit sits in the visible
// window. Pure transform animation, no layout thrash, 60fps safe.
function DigitColumn({ digit }) {
  const n = Number(digit);
  return (
    <span
      style={{
        display: 'inline-block', overflow: 'hidden',
        height: '1em', width: '0.62em', verticalAlign: 'top',
      }}
    >
      <span
        className="mg-odometer-col"
        style={{
          display: 'block',
          transform: `translate3d(0, ${-n * 10}%, 0)`,
          transition: `transform ${DUR.slow}ms ${EASE.ui}`,
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} style={{ display: 'block', height: '1em', lineHeight: '1em', textAlign: 'center' }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// Unit label to the right of the digits. A change is a true crossfade: the old
// label keeps its place and fades out while the new one fades in over the same
// 240 ms, which is what makes the flip read as one label turning into another
// mid-roll rather than a blank frame followed by a new word.
function UnitLabel({ unit }) {
  const [pair, setPair] = useState({ prev: null, cur: unit });
  const timerRef = useRef(null);

  useEffect(() => {
    setPair((p) => (p.cur === unit ? p : { prev: p.cur, cur: unit }));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPair({ prev: null, cur: unit }), UNIT_MS);
    return () => clearTimeout(timerRef.current);
  }, [unit]);

  return (
    <span
      style={{
        position: 'relative', display: 'inline-block', marginLeft: 8,
        whiteSpace: 'nowrap', fontSize: 11, fontWeight: 400, color: '#94a3b8',
      }}
    >
      <span
        key={pair.cur}
        style={{ display: 'inline-block', opacity: 0, animation: `odometerUnitIn ${UNIT_MS}ms ease forwards` }}
      >
        {pair.cur}
      </span>
      {pair.prev && pair.prev !== pair.cur && (
        <span
          key={`${pair.prev}-out`}
          style={{
            position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap',
            opacity: 1, animation: `odometerUnitOut ${UNIT_MS}ms ease forwards`,
          }}
        >
          {pair.prev}
        </span>
      )}
    </span>
  );
}

// Live odometer: fixed-width digit columns (comma separators static) plus a
// unit label to the right that crossfades when it changes. Value changes
// animate purely through the digit columns' CSS transform transition; this
// component holds no timers of its own.
export default function Odometer({ value, unit }) {
  const digits = digitsOf(value ?? 0);
  const n = digits.length;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'baseline',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <span style={{ display: 'inline-flex', fontWeight: 600, color: '#ffffff', fontSize: 'clamp(22px, 3.4vw, 36px)', lineHeight: 1 }}>
        {digits.map((ch, i) => {
          // Key by distance-from-the-right (place value) so the low-order
          // columns keep their identity as the digit count grows or shrinks.
          const place = n - 1 - i;
          return ch === ',' ? (
            <span key={`c${place}`} style={{ display: 'inline-block', width: '0.3em', textAlign: 'center' }}>,</span>
          ) : (
            <DigitColumn key={`d${place}`} digit={ch} />
          );
        })}
      </span>
      {unit && <UnitLabel unit={unit} />}
      <style>{`
        @keyframes odometerUnitIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes odometerUnitOut { from { opacity: 1; } to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .mg-odometer-col { transition: none !important; }
        }
      `}</style>
    </span>
  );
}
