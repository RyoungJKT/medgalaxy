// Time Machine data engine: per-year node radii driven by yearlyPapers instead
// of the cumulative papers/mortality the rest of the galaxy uses. Precomputed
// once at module init so scrubbing the slider is a pure array lookup, never a
// recompute — 153 diseases x 35 years is a trivial 5,355-float table.
//
// Yearly counts are a different domain than cumulative papers (a single year's
// publication count is orders of magnitude smaller than a disease's lifetime
// total), so this gets its own normalization curve rather than reusing nR/nRM
// from helpers.js. 18 keeps the biggest yearly node (COVID-19, 2021) well
// below the cumulative-view giants (helpers.js's MX is 55), so the galaxy
// never looks bigger in the Time Machine than it does in the normal view.
const MIN_RY = 0.25;
const MXY = 18;
// Present-but-invisible floor for a year with zero recorded papers. Bigger
// than 0 so a node never fully vanishes (it's still a point in the galaxy),
// small enough to read as "nothing happened here yet."
const ZERO_RY = 0.05;

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
// leads 2020's field by 11.1 percent (it led by 10.5 percent before), and its
// 2019 -> 2020 jump goes from 14.0x to 20.6x — the biggest single-year size
// change in the table, by both ratio and absolute delta, before and after.
const KNEE_PCT = 90;
// Share of the radius range the sub-knee segment owns. The 90th percentile is
// the knee, so 90 percent of all yearly counts share 38 percent of the range
// (they shared 22.6 percent under the old sqrt) and the top decile — which
// spans 7,238 to 141,958, a 20x span of its own — keeps the remaining 62.
const KNEE_SHARE = 0.38;
// Sub-knee exponent. Close to proportional so a year-over-year climb reads at
// close to its true rate, still under 1 so the decile inside the knee doesn't
// flatten the diseases beneath it.
const BULK_EXP = 0.85;

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

  return { nYears, yearStart, radii, maxYearly, knee, moversFor };
}

export default buildTimeMachineData;
