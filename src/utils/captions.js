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

/**
 * True when the caption currently on screen already names this disease
 * (round-5 gate, craft): accent 5's micro-label is a 9px line reading
 * `COVID-19 +94,344 papers`, and on the 2020 and 2021 pauses it lands beside a
 * card that already carries 94,633 and 141,958 for the same node. Three
 * numerals about one disease on the loudest frames in the piece is redundancy,
 * not emphasis, so the label stands down wherever the sentence has already said
 * it. Everywhere else (the quiet staircase years, the whole manual scrub) the
 * label is the only thing naming the mover, and it still fires.
 *
 * Checked live rather than once, by MoverLabel's own loop, because the two
 * clocks do not line up: the year crosses its detent partway through the
 * back.out step, so the label is armed and even spent while the PREVIOUS pause's
 * card is still on screen, and the caption it would duplicate arrives a few
 * hundred milliseconds later. A one-shot check at arming time passes and the
 * label then sits under the detonation card for the rest of its life.
 *
 * Pure and exported: the rule is a unit test, and it reads the caption's own
 * rendered strings rather than a parallel list of "loud" pauses that a future
 * board change could silently invalidate.
 * @param {object|null} caption a tmCaption record
 * @param {string} label the disease label as the data file spells it
 */
export function captionNames(caption, label) {
  if (!caption || !label) return false;
  const parts = [];
  if (Array.isArray(caption.lines)) parts.push(...caption.lines);
  if (caption.data) parts.push(caption.data);
  if (caption.micro) parts.push(caption.micro);
  const hay = parts.join(' ').toLowerCase();
  return hay.includes(label.toLowerCase());
}
