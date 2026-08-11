import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildTimeMachineData, nRY } from '../src/utils/timeMachineData';

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
    expect(nRY(0, data.maxYearly)).toBe(0.05);
  });

  it('nRY ceilings at 18 for the single biggest yearly count on record', () => {
    expect(nRY(data.maxYearly, data.maxYearly)).toBeCloseTo(18, 10);
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
