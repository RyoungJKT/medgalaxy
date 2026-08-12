import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildTimeMachineData, nRY, kneeYearly } from '../src/utils/timeMachineData';

const idMap = Object.fromEntries(diseases.map((d, i) => [d.id, i]));
const count = diseases.length;
const data = buildTimeMachineData(diseases);

describe('buildTimeMachineData', () => {
  it('spans the full backfilled 1990-2024 range with one radius column per disease per year', () => {
    expect(data.yearStart).toBe(1990);
    expect(data.nYears).toBe(35);
    expect(data.radii.length).toBe(data.nYears * count);
  });

  it('nRY floors at 0.05 for a year with zero papers (present but invisible)', () => {
    expect(nRY(0, data.maxYearly, data.knee)).toBe(0.05);
  });

  it('nRY ceilings at 18 for the single biggest yearly count on record', () => {
    expect(nRY(data.maxYearly, data.maxYearly, data.knee)).toBeCloseTo(18, 10);
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
    // 38 percent of the range at the knee: 0.25 + 0.38 * (18 - 0.25).
    expect(nRY(data.knee, data.maxYearly, data.knee)).toBeCloseTo(0.25 + 0.38 * 17.75, 6);
    // Omitting the knee collapses to the single power segment (still MXY at the top).
    expect(nRY(data.maxYearly, data.maxYearly)).toBeCloseTo(18, 10);
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
    expect(prev).toBeCloseTo(18, 10);
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
