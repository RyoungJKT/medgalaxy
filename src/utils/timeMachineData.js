// Time Machine data engine: per-year node radii driven by yearlyPapers instead
// of the cumulative papers/mortality the rest of the galaxy uses. Precomputed
// once at module init so scrubbing the slider is a pure array lookup, never a
// recompute — 153 diseases x 35 years is a trivial 5,355-float table.
//
// Yearly counts are a different domain than cumulative papers (a single year's
// publication count is orders of magnitude smaller than a disease's lifetime
// total), so this gets its own normalization curve rather than reusing nR/nRM
// from helpers.js. 26 keeps the biggest yearly node (COVID-19, 2021) below half
// of the cumulative-view ceiling (helpers.js's MX is 55) and under that view's
// own 90th-percentile radius of 23.96, so the galaxy never looks bigger in the
// Time Machine than it does in the normal view.
export const MIN_RY = 0.25;
// ADDENDUM 1 section 2.1: 18 -> 26. "The whole per-year domain gets 45 percent
// more range. This is the biggest single lever and it costs nothing in honesty:
// it is a uniform scale." Round 6 fixed the *ratio* HIV's arc reads at and left
// the absolute size on the table; a 2.24x climb from radius 3.13 to 7.02 inside
// an 18-unit ceiling, against a median cell of 1.63, is a real change that is
// still not a visible change. Absolute travel in radius units is the criterion
// this answers: HIV 1990 -> 2014 now moves 6.87 units, against 3.89.
export const MXY = 26;
// Present-but-invisible floor for a year with zero recorded papers. Bigger
// than 0 so a node never fully vanishes (it's still a point in the galaxy),
// small enough to read as "nothing happened here yet."
export const ZERO_RY = 0.05;

// ─── The knee (round 6, user feedback) ───────────────────────────────────────
// The curve used to be a single sqrt against the one global maximum (COVID-19,
// 2021, 141,958 papers). One disease's detonation therefore owned the whole
// dynamic range: HIV/AIDS climbing 2,659 -> 7,534 papers a year, a 2.8x rise
// that is the entire point of the tour's HIV pauses, moved a node from radius
// 2.68 to 4.34 — a 1.6x change that reads as "roughly the same node" while the
// slider travels twenty-four years. Every disease outside the top few percent
// had the same problem.
//
// Two changes fix it, and they pull in opposite directions on purpose:
//
//  1. The exponent goes UP (0.5 -> 0.85), not down. A power curve is
//     scale-invariant, so the radius ratio between any two counts is exactly
//     (c2/c1)^exponent no matter what ceiling it is normalized against — the
//     ceiling cannot change it. HIV's 2.83x count growth needs an exponent of
//     at least ln(2)/ln(2.83) = 0.67 to read as a 2x radius change at all, so
//     a *lower* exponent (the intuitive "boost contrast" move) makes this
//     worse, not better: at 0.32 the same span reads 1.38x.
//  2. The ceiling comes down to the knee, so the bulk gets its size back.
//     A near-proportional exponent against a 141,958 ceiling would leave HIV a
//     1.3-2.5 radius speck. Normalizing the bulk against the 90th percentile
//     of every (disease, year) count instead puts HIV's arc at 3.1 -> 7.0.
//
// The tail above the knee stays STRICTLY monotone rather than clamping — a
// clamp would tie COVID-19's 94,633 with pneumonia's 77,289 in 2020 and break
// the honesty invariant that a bigger count is always a bigger node. It is
// linear, which is the least compressive bounded tail available and so
// preserves the top-end separation the detonation depends on: COVID-19 still
// leads 2020's field, and its 2019 -> 2020 jump is the biggest single-year size
// change in the table by both ratio and absolute delta, under every version of
// this curve. Round 7 trades a hair of that ratio lead (1.111x to 1.102x) for a
// wider absolute silhouette margin (1.42 units clear of pneumonia to 1.92),
// which is the margin the eye actually reads at a glance.
export const KNEE_PCT = 90;
// Share of the radius range the sub-knee segment owns. The 90th percentile is
// the knee, so 90 percent of all yearly counts share 42 percent of the range
// (they shared 22.6 percent under the old sqrt, 38 percent in round 6) and the
// top decile — which spans 7,238 to 141,958, a 20x span of its own — keeps the
// remaining 58.
export const KNEE_SHARE = 0.42;
// Sub-knee exponent, 0.85 -> 1.00 (ADDENDUM 1 section 2.1). At exactly 1.00 the
// sentence "below the knee, a node's radius is proportional to that year's
// paper count" is true and printable, which is where the honesty line sits:
// BULK_EXP is capped at 1.00 forever, because above it that sentence is false
// and no amount of drama buys it back. Unit-tested as a hard guard.
export const BULK_EXP = 1.00;

/**
 * The knee count: the KNEE_PCT-th percentile of every (disease, year) yearly
 * count in the table, zeros included. Data-driven on purpose — the weekly
 * PubMed refresh moves every number, and a hard-coded knee would drift out
 * from under the distribution it is supposed to describe.
 * @param {ArrayLike<number>} values every cell of the yearly-count table
 * @param {number} [pct] percentile, 0-100
 * @returns {number} the count at that percentile (0 if there is no data)
 */
export function kneeYearly(values, pct = KNEE_PCT) {
  const n = values.length;
  if (!n) return 0;
  const sorted = Array.prototype.slice.call(values).sort((a, b) => a - b);
  const i = Math.max(0, Math.min(n - 1, Math.floor((pct / 100) * (n - 1))));
  const v = sorted[i];
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Yearly-count radius curve: a near-proportional power segment up to the knee,
 * then a linear tail to the single global maximum. Strictly increasing in `c`
 * across the whole domain (the honesty invariant: a bigger count is always a
 * bigger node), with the zero floor as its only flat point.
 * @param {number} c yearly paper count for one disease, one year
 * @param {number} maxYearly the single biggest yearly count across the whole
 *   dataset (every disease, every year) — where the curve reaches MXY
 * @param {number} [knee] the sub-knee ceiling (see kneeYearly). Omitted, or
 *   at/above maxYearly, collapses the curve to the single power segment.
 * @returns {number} radius in the Time Machine's own units
 */
export function nRY(c, maxYearly, knee = maxYearly) {
  if (!(c > 0) || !(maxYearly > 0)) return ZERO_RY;
  const kneed = knee > 0 && knee < maxYearly;
  const k = kneed ? knee : maxYearly;
  const share = kneed ? KNEE_SHARE : 1;
  const f = c <= k
    ? share * Math.pow(c / k, BULK_EXP)
    : share + (1 - share) * Math.min(1, (c - k) / (maxYearly - k));
  return MIN_RY + f * (MXY - MIN_RY);
}

// A disease's yearlyPapers count for a given calendar year, honoring its own
// yearStart so a disease whose historical backfill fell back to a shorter
// window (e.g. a 2015-decade array instead of the full 1990 span) still reads
// cleanly: years before its own yearStart are simply zero — "no data yet",
// not a crash, not a stretched/misaligned array.
function valueAt(disease, year) {
  const yearStart = Number.isFinite(disease.yearStart) ? disease.yearStart : 2015;
  const yp = Array.isArray(disease.yearlyPapers) ? disease.yearlyPapers : [];
  const li = year - yearStart;
  if (li < 0 || li >= yp.length) return 0;
  const v = yp[li];
  return Number.isFinite(v) ? v : 0;
}

/**
 * Builds the Time Machine's full per-year radius table.
 * @param {Array} diseases full disease list (store's `diseases`, in index order)
 * @returns {{
 *   nYears: number,
 *   yearStart: number,
 *   radii: Float32Array,   // length nYears*count, index = y*count + i
 *   maxYearly: number,     // true global max (also TourSparkline's ceiling)
 *   knee: number,          // the radius curve's sub-knee ceiling
 *   moversFor: (yearIdx: number) => Array<{index:number, id:string, label:string, delta:number, value:number}>
 * }}
 */
export function buildTimeMachineData(diseases) {
  const count = diseases.length;

  // Span the union of every disease's own [yearStart, yearStart+len) window,
  // so a shorter fallback window (see valueAt) never clips the range other
  // diseases actually have data for.
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const d of diseases) {
    const yearStart = Number.isFinite(d.yearStart) ? d.yearStart : 2015;
    const yp = Array.isArray(d.yearlyPapers) ? d.yearlyPapers : [];
    if (yearStart < minStart) minStart = yearStart;
    const end = yearStart + yp.length;
    if (end > maxEnd) maxEnd = end;
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    minStart = 2015;
    maxEnd = 2015;
  }
  const yearStart = minStart;
  const nYears = Math.max(1, maxEnd - minStart);

  // Pass 1: raw values, the single global ceiling (`maxYearly`) the tail
  // reaches MXY at, and the knee the bulk of the distribution is normalized
  // against. `maxYearly` stays the true maximum whatever the curve does with
  // it — TourSparkline reads it as the finale's sparkline ceiling, and that
  // ceiling is the closing shot's argument, so the two stay decoupled.
  const values = new Float32Array(nYears * count);
  let maxYearly = 0;
  for (let y = 0; y < nYears; y++) {
    const year = yearStart + y;
    const row = y * count;
    for (let i = 0; i < count; i++) {
      const v = valueAt(diseases[i], year);
      values[row + i] = v;
      if (v > maxYearly) maxYearly = v;
    }
  }
  const knee = kneeYearly(values);

  // Pass 2: radii, precomputed once so scrubbing is a pure lookup.
  const radii = new Float32Array(nYears * count);
  for (let idx = 0; idx < radii.length; idx++) {
    radii[idx] = nRY(values[idx], maxYearly, knee);
  }

  // Year-over-year movers, ranked descending by delta. yearIdx 0 has no prior
  // year to diff against, so its delta is the raw value (growth from nothing).
  function moversFor(yearIdx) {
    const y = Math.max(0, Math.min(nYears - 1, yearIdx));
    const row = y * count;
    const prevRow = y > 0 ? (y - 1) * count : -1;
    const movers = new Array(count);
    for (let i = 0; i < count; i++) {
      const value = values[row + i];
      const prev = prevRow >= 0 ? values[prevRow + i] : 0;
      movers[i] = { index: i, id: diseases[i].id, label: diseases[i].label, delta: value - prev, value };
    }
    // Ranked by magnitude: "biggest mover" means the largest swing either way,
    // not only the largest gain. The sign survives in `delta` itself, and the
    // rail's own hover chip formats it back on (TimeRail.jsx's `sign`/`Math.abs`).
    movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return movers;
  }

  return { nYears, yearStart, radii, maxYearly, knee, count, moversFor };
}

// ─── Accents (ADDENDUM 1 section 2.3) ────────────────────────────────────────
// Accents dramatize. They are transient, they return to identity, they are
// invisible in an at-rest frame, and none of them can change which node is
// bigger. Four gates, all required, and the two that are pure data live here so
// the selection is a unit test rather than a frame capture.
//
//   G1  fire only on integer-year crossings          (the engine's detent edge)
//   G2  suppressed above ACCENT_MAX_RATE years/sec   (the engine's rate gate)
//   G3  at most three nodes, each >= ACCENT_MIN_DELTA          (accentPicks)
//   G4  tier budget HIGH 3 / MEDIUM 2 / LOW 1                  (accentPicks)

// The 78th percentile of all 5,202 per-step radius deltas: below this a node's
// change is not a change anyone can see, so an accent on it is decoration.
export const ACCENT_MIN_DELTA = 0.25;
// The mover ring's own, much higher bar. This threshold fires on 8 of the 34
// steps and every one of them lands on an outbreak or its aftermath: 2009 and
// 2010 influenza, 2014 Ebola, 2016 Zika, and COVID-19's 2020, 2021, 2023, 2024.
// Nobody authored that; the data did. Do not tune it.
export const ACCENT_RING_DELTA = 1.50;
// Years per second above which every accent is suppressed. Kills the rewind
// (26.2 yr/s) and the long-leg sweep (13.1 yr/s), passes every staircase step
// (2.78 yr/s), every single-year leg (1.54 yr/s) and every deliberate scrub.
export const ACCENT_MAX_RATE = 4.0;
export const ACCENT_BUDGET = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Every node's radius change across one year step, ranked by magnitude. Pure
 * over the built table, so the whole accent selection is testable without a
 * scene.
 * @param {object} data a table from buildTimeMachineData
 * @param {number} fromIdx the year index being left
 * @param {number} toIdx the year index being landed on
 * @returns {Array<{index:number, delta:number, abs:number}>} descending by abs
 */
export function stepDeltas(data, fromIdx, toIdx) {
  const { radii, count, nYears } = data;
  const a = Math.max(0, Math.min(nYears - 1, fromIdx));
  const b = Math.max(0, Math.min(nYears - 1, toIdx));
  const rowA = a * count;
  const rowB = b * count;
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const delta = radii[rowB + i] - radii[rowA + i];
    out[i] = { index: i, delta, abs: delta < 0 ? -delta : delta };
  }
  out.sort((x, y) => y.abs - x.abs);
  return out;
}

/**
 * Gates G3 and G4 applied: the accented nodes for one year crossing, at most
 * `budget` of them, each clearing ACCENT_MIN_DELTA, ranked by |delta radius|.
 * Each pick carries the radius it *had* in the year just left, because that is
 * what the ghost shell is: a sphere held at the old size while the node grows
 * out of it or falls inside it.
 * @param {object} data a table from buildTimeMachineData
 * @param {number} fromIdx the year index being left
 * @param {number} toIdx the year index being landed on
 * @param {number} [budget] tier budget, ACCENT_BUDGET's values
 * @returns {Array<{index:number, delta:number, abs:number, rank:number, from:number, to:number, ring:boolean}>}
 */
export function accentPicks(data, fromIdx, toIdx, budget = 3) {
  const cap = Math.max(0, Math.min(3, budget));
  if (!cap || fromIdx === toIdx) return [];
  const { radii, count, nYears } = data;
  const a = Math.max(0, Math.min(nYears - 1, fromIdx));
  const b = Math.max(0, Math.min(nYears - 1, toIdx));
  const ranked = stepDeltas(data, a, b);
  const out = [];
  for (let k = 0; k < ranked.length && out.length < cap; k++) {
    const r = ranked[k];
    if (r.abs < ACCENT_MIN_DELTA) break; // ranked descending: nothing below clears it either
    out.push({
      index: r.index,
      delta: r.delta,
      abs: r.abs,
      rank: out.length + 1,
      from: radii[a * count + r.index],
      to: radii[b * count + r.index],
      // The mover ring is rank-1 only, and only above its own threshold.
      ring: out.length === 0 && r.abs >= ACCENT_RING_DELTA,
    });
  }
  return out;
}

export default buildTimeMachineData;
