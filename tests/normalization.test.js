import { describe, it, expect } from 'vitest';
import { nR, nRM, processData } from '../src/utils/helpers';
import diseases from '../data/diseases.json';
import connections from '../data/connections.json';

describe('honest size normalization', () => {
  it('distinguishes the giants (no clamping at the top)', () => {
    expect(nR(1733464)).toBeGreaterThan(nR(605564) * 1.2);
    expect(nRM(11000000)).toBeGreaterThan(nRM(9100000) * 1.05);
  });
  it('keeps the smallest nodes visible', () => {
    expect(nR(797)).toBeGreaterThan(1.0);
    expect(nRM(32)).toBeGreaterThan(0.05);
  });
});

describe('term-overlap edges (Task 5, 2026-09-10 plan)', () => {
  it('flags a pair whose one label contains the other', () => {
    const { edges, diseases: ds } = processData(diseases, connections);
    const e = edges.find((x) => (x.source === 'heart-disease' && x.target === 'rheumatic-heart-disease') || (x.source === 'rheumatic-heart-disease' && x.target === 'heart-disease'));
    expect(e).toBeTruthy();
    expect(e.termOverlap).toBe(true);
    const clean = edges.find((x) => x.source === 'malaria' || x.target === 'malaria');
    expect(clean.termOverlap).toBe(false);
  });
});
