// ─── Runtime-derived caption formatting ──────────────────────────────────────
// Every numeral shown in story/spotlight/roulette captions is derived from
// live disease data through these helpers, so a weekly PubMed refresh can
// never leave a stale number baked into a caption string.

const nf = new Intl.NumberFormat('en-US');

// Full comma-separated integer, e.g. 248989 -> "248,989".
export function fmtFull(n) {
  return nf.format(Math.round(n));
}

// Hero-style word form for large numbers: exact millions drop the decimal
// ("11 million"), fractional millions keep one decimal ("9.1 million").
// Anything under a million falls back to fmtFull.
export function fmtWord(n) {
  if (n >= 1e6) {
    const millions = (n / 1e6).toFixed(1);
    return (millions.endsWith('.0') ? millions.slice(0, -2) : millions) + ' million';
  }
  return fmtFull(n);
}

// Papers per death (research attention relative to mortality burden).
// Null when there's no mortality to divide by, so callers can special-case
// zero-mortality diseases instead of dividing by zero.
export function ppd(d) {
  if (!d || !d.mortality) return null;
  return d.papers / d.mortality;
}

// Deaths per paper (mortality burden relative to research attention).
// Null when there are no papers to divide by.
export function deathsPerPaper(d) {
  if (!d || !d.papers) return null;
  return d.mortality / d.papers;
}

// Sentence-fragment trend descriptor. t is a decade-growth percentage;
// 999 is the sentinel the data pipeline uses for "grew from ~zero" (division
// by a near-zero baseline), rendered as "surged from zero" instead of a
// meaningless four-digit percent.
export function trendLabel(t) {
  if (t >= 999) return 'surged from zero';
  if (t > 0) return `research up ${t}%`;
  if (t < 0) return `research down ${Math.abs(t)}%`;
  return 'research steady';
}
