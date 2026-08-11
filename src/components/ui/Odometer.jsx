import React from 'react';

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
        style={{
          display: 'block',
          transform: `translate3d(0, ${-n * 10}%, 0)`,
          transition: 'transform 480ms cubic-bezier(0.16,1,0.3,1)',
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
      {unit && (
        <span
          key={unit}
          style={{
            fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8,
            opacity: 0, animation: 'odometerUnitFade 240ms ease forwards',
          }}
        >
          {unit}
        </span>
      )}
      <style>{`
        @keyframes odometerUnitFade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </span>
  );
}
