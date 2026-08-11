// Time Machine data engine: per-year node radii driven by yearlyPapers instead
// of the cumulative papers/mortality the rest of the galaxy uses. Precomputed
// once at module init so scrubbing the slider is a pure array lookup, never a
// recompute — 153 diseases x 35 years is a trivial 5,355-float table.
//
// Yearly counts are a different domain than cumulative papers (a single year's
// publication count is orders of magnitude smaller than a disease's lifetime
// total), so this gets its own normalization curve rather than reusing nR/nRM
// from helpers.js. 18 keeps the biggest yearly node (COVID-19, 2021) well
// below the cumulative-view giants, so the galaxy never looks bigger in the
// Time Machine than it does in the normal view.
const MIN_RY = 0.25;
const MXY = 18;
// Present-but-invisible floor for a year with zero recorded papers. Bigger
// than 0 so a node never fully vanishes (it's still a point in the galaxy),
// small enough to read as "nothing happened here yet."
const ZERO_RY = 0.05;

/**
 * Yearly-count radius curve. sqrt easing (same shape as nR/nRM) so growth
 * reads honestly rather than linearly compressing the early, quieter years.
 * @param {number} c yearly paper count for one disease, one year
 * @param {number} maxYearly the single biggest yearly count across the whole
 *   dataset (every disease, every year) — the curve's ceiling reference
 * @returns {number} radius in the Time Machine's own units
 */
export function nRY(c, maxYearly) {
  if (!(c > 0) || !(maxYearly > 0)) return ZERO_RY;
  const ratio = Math.min(c / maxYearly, 1);
  return MIN_RY + Math.pow(ratio, 0.5) * (MXY - MIN_RY);
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
 *   maxYearly: number,
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

  // Pass 1: raw values + the single global ceiling (`maxYearly`) the radius
  // curve normalizes against.
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

  // Pass 2: radii, precomputed once so scrubbing is a pure lookup.
  const radii = new Float32Array(nYears * count);
  for (let idx = 0; idx < radii.length; idx++) {
    radii[idx] = nRY(values[idx], maxYearly);
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
    movers.sort((a, b) => b.delta - a.delta);
    return movers;
  }

  return { nYears, yearStart, radii, maxYearly, moversFor };
}

export default buildTimeMachineData;
