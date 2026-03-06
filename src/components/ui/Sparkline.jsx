import React from 'react';

export default function Sparkline({ data, color, w = 260, h = 50 }) {
  if (!data || !data.length) return null;

  const mx = Math.max(...data);
  const mn = Math.min(...data);
  const rng = mx - mn || 1;

  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 4 - ((v - mn) / rng) * (h - 8)}`)
    .join(' ');

  const gid = 'sp' + color.replace('#', '');

  return (
    <svg width={w} height={h} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <text x="0" y={h - 1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono">
        2014
      </text>
      <text x={w} y={h - 1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">
        2024
      </text>
    </svg>
  );
}
