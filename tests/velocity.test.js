import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { decadeGrowth } from '../src/utils/helpers';

describe('decadeGrowth', () => {
  const byId = Object.fromEntries(diseases.map(d => [d.id, d]));

  it('HIV/AIDS is declining over the last decade (2015-2024), not rising', () => {
    // Pre-fix, slicing yp.slice(0,3) against the full 1990-backfilled array
    // compared 1990-1992 to 2022-2024 and flipped this to a false "rising" 2.17x.
    expect(decadeGrowth(byId['hiv-aids'].yearlyPapers).growth).toBeLessThan(1);
  });

  it('NAFLD is rising over the last decade (2015-2024)', () => {
    expect(decadeGrowth(byId['nafld'].yearlyPapers).growth).toBeGreaterThan(1);
  });

  it('is independent of how far back yearlyPapers starts (yearStart)', () => {
    const backfilled = [...Array(25).fill(9999), 1, 1, 1, 2, 2, 2, 3, 3, 3, 3];
    const decadeOnly = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3];
    expect(decadeGrowth(backfilled)).toEqual(decadeGrowth(decadeOnly));
  });
});
