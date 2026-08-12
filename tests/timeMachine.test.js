import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import {
  buildTimeMachineData, nRY, kneeYearly, stepDeltas, accentPicks,
  MXY, MIN_RY, KNEE_PCT, KNEE_SHARE, BULK_EXP,
  ACCENT_MIN_DELTA, ACCENT_RING_DELTA, ACCENT_BUDGET,
} from '../src/utils/timeMachineData';
import { MX } from '../src/utils/constants';

const idMap = Object.fromEntries(diseases.map((d, i) => [d.id, i]));
const count = diseases.length;
const data = buildTimeMachineData(diseases);
const R = (year, i) => data.radii[(year - data.yearStart) * count + i];
// Every per-step |delta radius| in the table, and the rank-1 mover of each step.
const perStep = [];
for (let y = 1; y < data.nYears; y++) {
  const row = [];
  for (let i = 0; i < count; i++) {
    row.push(Math.abs(data.radii[y * count + i] - data.radii[(y - 1) * count + i]));
  }
  perStep.push({ year: data.yearStart + y, yearIdx: y, deltas: row, top: Math.max(...row) });
}

describe('buildTimeMachineData', () => {
  it('spans the full backfilled 1990-2024 range with one radius column per disease per year', () => {
    expect(data.yearStart).toBe(1990);
    expect(data.nYears).toBe(35);
    expect(data.radii.length).toBe(data.nYears * count);
  });

  it('nRY floors at 0.05 for a year with zero papers (present but invisible)', () => {
    expect(nRY(0, data.maxYearly, data.knee)).toBe(0.05);
  });

  it('nRY ceilings at MXY for the single biggest yearly count on record', () => {
    expect(MXY).toBe(26);
    expect(nRY(data.maxYearly, data.maxYearly, data.knee)).toBeCloseTo(MXY, 10);
  });

  it('normalizes the bulk against the 90th-percentile knee, not the one global max', () => {
    // Round 6 (user feedback): the knee is what gives everyone below COVID's
    // detonation their share of the range back. It is derived from the data,
    // so it moves with the weekly PubMed refresh rather than being pinned to
    // a transcribed number.
    const cells = [];
    for (const d of diseases) {
      const ys = Number.isFinite(d.yearStart) ? d.yearStart : 2015;
      for (let y = 0; y < data.nYears; y++) {
        const li = data.yearStart + y - ys;
        const v = Array.isArray(d.yearlyPapers) ? d.yearlyPapers[li] : undefined;
        cells.push(li >= 0 && Number.isFinite(v) ? v : 0);
      }
    }
    expect(data.knee).toBe(kneeYearly(cells));
    expect(data.knee).toBeGreaterThan(0);
    expect(data.knee).toBeLessThan(data.maxYearly / 10);
    // KNEE_SHARE of the range at the knee: MIN_RY + share * (MXY - MIN_RY).
    expect(nRY(data.knee, data.maxYearly, data.knee))
      .toBeCloseTo(MIN_RY + KNEE_SHARE * (MXY - MIN_RY), 6);
    // Omitting the knee collapses to the single power segment (still MXY at the top).
    expect(nRY(data.maxYearly, data.maxYearly)).toBeCloseTo(MXY, 10);
  });

  it('nRY is strictly monotone in count across the whole domain (honesty invariant)', () => {
    // The tail above the knee is linear rather than clamped precisely so this
    // holds: with a clamp, COVID-19's 94,633 papers in 2020 and pneumonia's
    // 77,289 would render as the same node.
    const { maxYearly, knee } = data;
    const samples = [1, 2, 10, 100, 569, 1110, 2659, 3424, 7237];
    for (const extra of [knee - 1, knee, knee + 1, maxYearly - 1, maxYearly]) samples.push(extra);
    for (let i = 0; i <= 400; i++) samples.push(Math.round((i / 400) * maxYearly));
    const uniq = [...new Set(samples.filter((c) => c > 0))].sort((a, b) => a - b);
    let prev = nRY(0, maxYearly, knee);
    for (const c of uniq) {
      const r = nRY(c, maxYearly, knee);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
    expect(prev).toBeCloseTo(MXY, 10);
  });

  it('the whole radius table is monotone: a bigger yearly count is never a smaller node', () => {
    // Same invariant asserted against the real table rather than the curve:
    // sort every (disease, year) cell by count and confirm radius never falls.
    const cells = [];
    for (let y = 0; y < data.nYears; y++) {
      for (let i = 0; i < count; i++) {
        const d = diseases[i];
        const ys = Number.isFinite(d.yearStart) ? d.yearStart : 2015;
        const li = data.yearStart + y - ys;
        const v = Array.isArray(d.yearlyPapers) ? d.yearlyPapers[li] : undefined;
        cells.push({ v: li >= 0 && Number.isFinite(v) ? v : 0, r: data.radii[y * count + i] });
      }
    }
    cells.sort((a, b) => a.v - b.v);
    for (let i = 1; i < cells.length; i++) {
      if (cells[i].v > cells[i - 1].v) expect(cells[i].r).toBeGreaterThan(cells[i - 1].r);
      else expect(cells[i].r).toBeCloseTo(cells[i - 1].r, 5);
    }
  });

  it('hiv/aids visibly doubles from 1990 to its own peak year (round 6, user feedback)', () => {
    // The complaint this pins: against the single global max, HIV's 2,659 ->
    // 7,534 papers a year moved a node 2.68 -> 4.34 (1.62x) and read as no
    // growth at all while the slider crossed twenty-four years.
    const hivIdx = idMap['hiv-aids'];
    const series = diseases[hivIdx].yearlyPapers;
    let peakY = 0;
    for (let y = 1; y < series.length; y++) if (series[y] > series[peakY]) peakY = y;
    const r1990 = data.radii[(1990 - data.yearStart) * count + hivIdx];
    const rPeak = data.radii[peakY * count + hivIdx];
    expect(rPeak / r1990).toBeGreaterThanOrEqual(2);
    // And it has to be big enough on screen to see, not just proportionally bigger.
    expect(r1990).toBeGreaterThan(2.5);
    expect(rPeak).toBeGreaterThan(6);
    // The tour's own first HIV pause (1996) is already visibly along the climb.
    const r1996 = data.radii[(1996 - data.yearStart) * count + hivIdx];
    expect(r1996 / r1990).toBeGreaterThan(1.5);
  });

  it('covid-19 is 2020s biggest node and its 2019->2020 jump is the timelines biggest change', () => {
    const covidIdx = idMap['covid-19'];
    const y2020 = 2020 - data.yearStart;
    const row2020 = [];
    for (let i = 0; i < count; i++) row2020.push({ i, r: data.radii[y2020 * count + i] });
    row2020.sort((a, b) => b.r - a.r);
    expect(row2020[0].i).toBe(covidIdx);
    // Ahead of the runner-up (pneumonia, whose own 2020 spike IS covid) by at
    // least as much as the old sqrt curve managed — the knee must not blunt
    // the detonation it exists to make room around.
    expect(row2020[0].r / row2020[1].r).toBeGreaterThan(1.10);

    // The single biggest year-over-year size change in the whole table, by
    // both absolute delta and ratio.
    let bestDelta = { v: -Infinity, i: -1 };
    let bestRatio = { v: -Infinity, i: -1 };
    for (let y = 1; y < data.nYears; y++) {
      for (let i = 0; i < count; i++) {
        const a = data.radii[(y - 1) * count + i];
        const b = data.radii[y * count + i];
        if (b - a > bestDelta.v) bestDelta = { v: b - a, i, y };
        if (b / a > bestRatio.v) bestRatio = { v: b / a, i, y };
      }
    }
    expect(bestDelta.i).toBe(covidIdx);
    expect(bestDelta.y).toBe(y2020);
    expect(bestRatio.i).toBe(covidIdx);
    expect(bestRatio.y).toBe(y2020);
    expect(bestRatio.v).toBeGreaterThan(14); // it was 14.0x under the old curve
  });

  it('covid-19 detonates from near-invisible pre-pandemic to the era-defining spike in 2020', () => {
    const covidIdx = idMap['covid-19'];
    const y2019 = 2019 - data.yearStart;
    const y2020 = 2020 - data.yearStart;
    expect(y2019).toBe(29);
    expect(y2020).toBe(30);

    const r2019 = data.radii[y2019 * count + covidIdx];
    const r2020 = data.radii[y2020 * count + covidIdx];
    expect(r2019).toBeLessThan(1.5);
    expect(r2020).toBeGreaterThan(12);
    expect(r2020).toBeGreaterThan(r2019 * 10); // the detonation
  });

  it('moversFor(2020 index) ranks covid-19 as the single biggest year-over-year mover', () => {
    const covid = diseases[idMap['covid-19']];
    const y2019 = 2019 - data.yearStart;
    const y2020 = 2020 - data.yearStart;
    const movers = data.moversFor(y2020);
    expect(movers[0].id).toBe('covid-19');
    expect(movers[0].delta).toBe(covid.yearlyPapers[y2020] - covid.yearlyPapers[y2019]);
  });

  it('rheumatic heart disease stays a flatline across all 35 years (never spikes)', () => {
    const rhdIdx = idMap['rheumatic-heart-disease'];
    let max = 0;
    for (let y = 0; y < data.nYears; y++) {
      const r = data.radii[y * count + rhdIdx];
      if (r > max) max = r;
    }
    expect(max).toBeLessThan(2.5);
  });
});

// ─── ADDENDUM 1 section 2.4, acceptance 1 to 8 ───────────────────────────────
// Round 6's criterion was the ratio HIV's arc reads at; round 7's is the
// absolute travel in radius units, because a 2.24x climb from 3.13 to 7.02
// inside an 18-unit ceiling is a real change that is still not a visible one.
describe('cinematic year-scaling (addendum 1 section 2.4)', () => {
  // 1
  it('HIV travels 6.00+ radius units from 1990 to its own peak, at 2.50x or better', () => {
    const hivIdx = idMap['hiv-aids'];
    const series = diseases[hivIdx].yearlyPapers;
    let peakY = 0;
    for (let y = 1; y < series.length; y++) if (series[y] > series[peakY]) peakY = y;
    const peakYear = diseases[hivIdx].yearStart + peakY;
    expect(peakYear).toBe(2014);
    const r0 = R(1990, hivIdx);
    const r1 = R(peakYear, hivIdx);
    expect(r1 / r0).toBeGreaterThanOrEqual(2.50);
    expect(r1 - r0).toBeGreaterThanOrEqual(6.00);
    // Absolute floors on BOTH endpoints, so a future change cannot satisfy the
    // ratio by shrinking both ends into a pair of specks.
    expect(r0).toBeGreaterThanOrEqual(4.00);
    expect(r1).toBeGreaterThanOrEqual(10.50);
    // The measured table, for the record: 4.22 -> 11.10, 2.63x, travel 6.87.
    expect(r0).toBeCloseTo(4.22, 2);
    expect(r1).toBeCloseTo(11.10, 2);
    // And the tour's own first HIV pause is already well along the climb.
    expect(R(1996, hivIdx)).toBeCloseTo(7.34, 2);
  });

  // 2
  it('COVID-19 owns 2020 by 1.09x and 1.80 units, and owns the whole table by both measures', () => {
    const covidIdx = idMap['covid-19'];
    const row = [];
    for (let i = 0; i < count; i++) row.push({ i, r: R(2020, i) });
    row.sort((a, b) => b.r - a.r);
    expect(row[0].i).toBe(covidIdx);
    expect(row[0].r / row[1].r).toBeGreaterThanOrEqual(1.09);
    expect(row[0].r - row[1].r).toBeGreaterThanOrEqual(1.80);
    // Measured: 1.102x and 1.92 units clear of pneumonia. The ratio lead moved
    // 1.111 -> 1.102 and the absolute lead 1.42 -> 1.92, which is the trade.
    expect(row[0].r - row[1].r).toBeCloseTo(1.92, 2);
    expect(diseases[row[1].i].id).toBe('pneumonia');

    let bestDelta = { v: -Infinity };
    let bestRatio = { v: -Infinity };
    for (let y = 1; y < data.nYears; y++) {
      for (let i = 0; i < count; i++) {
        const a = data.radii[(y - 1) * count + i];
        const b = data.radii[y * count + i];
        if (b - a > bestDelta.v) bestDelta = { v: b - a, i, y };
        if (b / a > bestRatio.v) bestRatio = { v: b / a, i, y };
      }
    }
    const y2020 = 2020 - data.yearStart;
    expect(bestDelta.i).toBe(covidIdx);
    expect(bestDelta.y).toBe(y2020);
    expect(bestRatio.i).toBe(covidIdx);
    expect(bestRatio.y).toBe(y2020);
  });

  // 3
  it('rheumatic heart disease spans 3.0 percent of the ceiling or less across 35 years', () => {
    const rhdIdx = idMap['rheumatic-heart-disease'];
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < data.nYears; y++) {
      const r = data.radii[y * count + rhdIdx];
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
    expect((hi - lo) / MXY).toBeLessThanOrEqual(0.030);
    // Measured 0.44 to 1.10: a span of 0.66, 2.5 percent of the ceiling, which
    // is proportionally flatter than the 3.1 percent it shipped at.
    expect(lo).toBeCloseTo(0.44, 2);
    expect(hi).toBeCloseTo(1.10, 2);
  });

  // 4
  it('nRY is strictly monotone over 420 sampled counts, and equal counts give equal radii', () => {
    const { maxYearly, knee } = data;
    const samples = [];
    for (let i = 0; i <= 419; i++) samples.push(Math.round((i / 419) * maxYearly));
    // The three cells straddling the knee, explicitly.
    samples.push(knee - 1, knee, knee + 1);
    const uniq = [...new Set(samples.filter((c) => c > 0))].sort((a, b) => a - b);
    expect(uniq.length).toBeGreaterThanOrEqual(420);
    let prev = nRY(0, maxYearly, knee);
    for (const c of uniq) {
      const r = nRY(c, maxYearly, knee);
      expect(r, `count ${c}`).toBeGreaterThan(prev);
      expect(nRY(c, maxYearly, knee)).toBe(r); // equal counts, equal radii
      prev = r;
    }
    // The same invariant against the built table rather than the curve.
    const cells = [];
    for (let y = 0; y < data.nYears; y++) {
      for (let i = 0; i < count; i++) {
        const d = diseases[i];
        const ys = Number.isFinite(d.yearStart) ? d.yearStart : 2015;
        const li = data.yearStart + y - ys;
        const v = Array.isArray(d.yearlyPapers) ? d.yearlyPapers[li] : undefined;
        cells.push({ v: li >= 0 && Number.isFinite(v) ? v : 0, r: data.radii[y * count + i] });
      }
    }
    cells.sort((a, b) => a.v - b.v);
    for (let i = 1; i < cells.length; i++) {
      if (cells[i].v > cells[i - 1].v) expect(cells[i].r).toBeGreaterThan(cells[i - 1].r);
      else expect(cells[i].r).toBeCloseTo(cells[i - 1].r, 5);
    }
  });

  // 5
  it('holds the two hard guards: MXY <= MX / 2 and BULK_EXP <= 1.00', () => {
    // The Time Machine may never look bigger than the galaxy it sits inside.
    expect(MXY).toBeLessThanOrEqual(MX / 2);
    // At exactly 1.00 the sentence "below the knee, radius is proportional to
    // that year's paper count" is true and printable. Above it, it is not, and
    // no amount of drama buys that. Capped forever.
    expect(BULK_EXP).toBeLessThanOrEqual(1.00);
    expect(KNEE_PCT).toBe(90);
  });

  // 6
  it('moves 45 or more nodes by at least 0.15 radius units on the average year step', () => {
    let total = 0;
    for (const s of perStep) total += s.deltas.filter((d) => d >= 0.15).length;
    const mean = total / perStep.length;
    expect(mean).toBeGreaterThanOrEqual(45);
    expect(mean).toBeCloseTo(48.7, 1); // measured, against 33.8 shipped
  });

  // 8 (7 is the settle curve, in tests/motion.test.js)
  it('fires the mover ring on exactly the outbreak years the data selects', () => {
    expect(ACCENT_RING_DELTA).toBe(1.50);
    const fired = perStep.filter((s) => s.top >= ACCENT_RING_DELTA).map((s) => s.year);
    // Nobody authored this list; the data did. Every single one of them lands
    // on an outbreak or its aftermath: swine flu, Ebola, Zika, and COVID-19's
    // rise and decay. Do not tune the threshold away from it.
    expect(fired).toEqual([2009, 2010, 2014, 2016, 2020, 2021, 2023, 2024]);
    // The addendum's ledger predicted a ninth, 2004 (obesity). It measures
    // 1.498 against a 1.50 gate: the prediction was right about the year and
    // 0.002 radius units wrong about the threshold. Pinned rather than tuned,
    // so a future data refresh that moves it either way is visible here.
    const y2004 = perStep.find((s) => s.year === 2004);
    expect(y2004.top).toBeGreaterThan(1.49);
    expect(y2004.top).toBeLessThan(ACCENT_RING_DELTA);
  });

  it('meets the top-3 accent gate on every one of the 34 steps', () => {
    // "Under the new curve the top-3 gate is met on all 34 steps, so every
    // single year of the scrub has three nodes visibly shedding a shell." The
    // shipped curve missed it on 2017 (third mover at 0.235).
    expect(perStep).toHaveLength(34);
    for (const s of perStep) {
      const picks = accentPicks(data, s.yearIdx - 1, s.yearIdx, 3);
      expect(picks, `${s.year}`).toHaveLength(3);
      for (const p of picks) expect(p.abs).toBeGreaterThanOrEqual(ACCENT_MIN_DELTA);
    }
  });
});

describe('accentPicks (gates G3 and G4)', () => {
  const y2020 = 2020 - data.yearStart;

  it('ranks by |delta radius|, descending, and carries the year just left', () => {
    const picks = accentPicks(data, y2020 - 1, y2020, 3);
    expect(picks.map((p) => diseases[p.index].id)).toEqual([
      'covid-19', 'pneumonia', 'acute-respiratory-distress',
    ]);
    expect(picks.map((p) => p.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i].abs).toBeLessThanOrEqual(picks[i - 1].abs);
    }
    // `from` is what the ghost shell is held at: the radius the node had in the
    // year the field is leaving, not the one it is landing on.
    const covidIdx = idMap['covid-19'];
    expect(picks[0].from).toBeCloseTo(R(2019, covidIdx), 6);
    expect(picks[0].to).toBeCloseTo(R(2020, covidIdx), 6);
    expect(picks[0].delta).toBeCloseTo(R(2020, covidIdx) - R(2019, covidIdx), 6);
  });

  it('honors the tier budget: HIGH 3, MEDIUM 2, LOW 1', () => {
    expect(ACCENT_BUDGET).toEqual({ HIGH: 3, MEDIUM: 2, LOW: 1 });
    expect(accentPicks(data, y2020 - 1, y2020, ACCENT_BUDGET.HIGH)).toHaveLength(3);
    expect(accentPicks(data, y2020 - 1, y2020, ACCENT_BUDGET.MEDIUM)).toHaveLength(2);
    expect(accentPicks(data, y2020 - 1, y2020, ACCENT_BUDGET.LOW)).toHaveLength(1);
    expect(accentPicks(data, y2020 - 1, y2020, 0)).toHaveLength(0);
  });

  it('drops anything under 0.25 radius units rather than filling the budget', () => {
    expect(ACCENT_MIN_DELTA).toBe(0.25);
    // 2017 is the quietest step in the table; under the shipped curve its third
    // mover fell under the gate and only two shells lit.
    const y2017 = 2017 - data.yearStart;
    const picks = accentPicks(data, y2017 - 1, y2017, 3);
    for (const p of picks) expect(p.abs).toBeGreaterThanOrEqual(ACCENT_MIN_DELTA);
    const ranked = stepDeltas(data, y2017 - 1, y2017);
    const eligible = ranked.filter((r) => r.abs >= ACCENT_MIN_DELTA).length;
    expect(picks).toHaveLength(Math.min(3, eligible));
  });

  it('marks the ring on rank 1 only, and only above 1.50', () => {
    const loud = accentPicks(data, y2020 - 1, y2020, 3);
    expect(loud[0].ring).toBe(true);
    expect(loud[1].ring).toBe(false);
    expect(loud[2].ring).toBe(false);
    const quiet = accentPicks(data, 2017 - data.yearStart - 1, 2017 - data.yearStart, 3);
    for (const p of quiet) expect(p.ring).toBe(false);
  });

  it('is empty when the field has not moved a year', () => {
    expect(accentPicks(data, y2020, y2020, 3)).toHaveLength(0);
  });

  it('signs the delta so shrinkage is distinguishable from growth', () => {
    // 2022: COVID falls. The ring's color reads direction off this sign.
    const y2022 = 2022 - data.yearStart;
    const picks = accentPicks(data, y2022 - 1, y2022, 3);
    const covid = picks.find((p) => diseases[p.index].id === 'covid-19');
    expect(covid.delta).toBeLessThan(0);
    expect(covid.abs).toBeGreaterThan(0);
  });
});
