import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import connections from '../data/connections.json';
import insights from '../data/disease-insights.json';

describe('data invariants', () => {
  it('has 153 diseases with required fields', () => {
    expect(diseases.length).toBe(153);
    for (const d of diseases) {
      for (const k of ['id','label','category','description','papers','trend','mortality','fundingGap','yearlyPapers','region'])
        expect(d, d.id).toHaveProperty(k);
    }
  });
  it('yearlyPapers arrays are uniform length and non-negative', () => {
    const len = diseases[0].yearlyPapers.length;
    for (const d of diseases) {
      expect(d.yearlyPapers.length, d.id).toBe(len);
      for (const v of d.yearlyPapers) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
  it('connections resolve and have positive sharedPapers', () => {
    const ids = new Set(diseases.map(d => d.id));
    for (const c of connections) {
      expect(ids.has(c.source), c.source).toBe(true);
      expect(ids.has(c.target), c.target).toBe(true);
      expect(c.sharedPapers).toBeGreaterThan(0);
    }
  });
  it('insights cover every disease with exactly the 9 canonical fields', () => {
    const canonical = ['whatItIs','whyItMatters','whyNeglected','mismatchInsight','top3Reasons','memorableFact','questionRaised','burdenAnswer','accelerateAnswer'];
    for (const d of diseases) {
      const ins = insights[d.id];
      expect(ins, d.id).toBeTruthy();
      expect(Object.keys(ins).sort(), d.id).toEqual([...canonical].sort());
    }
  });
  it('no absurd trend artifacts (<= 999 percent)', () => {
    for (const d of diseases) expect(Math.abs(d.trend), d.id).toBeLessThanOrEqual(999);
  });
  it('WHO-verified mortality corrections are applied', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    expect(byId['pertussis'].mortality).toBe(59000);
    expect(byId['rotavirus'].mortality).toBe(128500);
    expect(byId['covid-19'].mortality).toBe(250000);
    expect(byId['ebola'].mortality).toBe(32);
    expect(byId['west-nile-virus'].mortality).toBe(130);
  });
  it('yearlyPapers is backfilled to 1990 for every disease', () => {
    for (const d of diseases) {
      expect(d.yearlyPapers.length, d.id).toBe(35);
      expect(d.yearStart, d.id).toBe(1990);
    }
  });
  it('covid-19 pre-2019 paper counts are noise-level (sanity gate on the backfill)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const preOnset = byId['covid-19'].yearlyPapers.slice(0, 29); // 1990-2018
    const sum = preOnset.reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThan(400);
  });
  it('hiv-aids shows the 1990s surge (Time Machine second act)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const nineties = byId['hiv-aids'].yearlyPapers.slice(0, 10); // 1990-1999
    const max = Math.max(...nineties);
    // Brief's original threshold was 2x; real data surges 1.86x-1.94x depending
    // on which 90s year is used as the peak. Plan author approved loosening
    // to >= 1.8x so the invariant reflects verified data instead of a guess.
    expect(max).toBeGreaterThanOrEqual(nineties[0] * 1.8);
  });
  it('rheumatic-heart-disease stays flat across the full 1990-2024 span (Time Machine finale)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const max = Math.max(...byId['rheumatic-heart-disease'].yearlyPapers);
    expect(max).toBeLessThan(600);
  });
});
