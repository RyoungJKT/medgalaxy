import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { nR, nRM } from '../src/utils/helpers';
import { computeLagFactors, morphRadiusAt } from '../src/components/DiseaseNodes';

// Carry-over A (direction 9/10 item 5, deferred from Task 11): mass-weighted
// morph stagger. The one hard requirement — regardless of how the per-node
// lag is computed — is that the endpoints never move: morphT 0 must render
// every node at exactly its papers radius, morphT 1 at exactly its mortality
// radius, for every disease in the live dataset.
//
// Fix (review, direction-reversal pop): computeLagFactors is now
// direction-independent — one static table per disease list, built from
// whichever of a node's two radii (papers or mortality) is larger, so a
// header click that reverses mid-transition never swaps the table out from
// under a node's eased radius.

describe('computeLagFactors + morphRadiusAt (mass-weighted morph stagger)', () => {
  it('every lag factor lands in [0.35, 1]', () => {
    const L = computeLagFactors(diseases);
    expect(L.length).toBe(diseases.length);
    // L is stored in a Float32Array, so compare with a float32-sized epsilon.
    for (let i = 0; i < diseases.length; i++) {
      expect(L[i], diseases[i].id).toBeGreaterThanOrEqual(0.35 - 1e-6);
      expect(L[i], diseases[i].id).toBeLessThanOrEqual(1);
    }
  });

  it('is direction-independent: computing it twice yields the exact same table (the reversal-pop fix)', () => {
    // The old implementation took a `towardMortality` flag and recomputed a
    // *different* table from whichever radius was the current target — that
    // divergence, swapped in mid-transition, was the pop. There is now only
    // one signature and calling it repeatedly for the same disease list must
    // be idempotent.
    const a = computeLagFactors(diseases);
    const b = computeLagFactors(diseases);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('morphT=0 lands on exactly the papers radius for every node, any lag', () => {
    const L = computeLagFactors(diseases);
    for (let i = 0; i < diseases.length; i++) {
      const r = morphRadiusAt(diseases[i], 0, L[i]);
      expect(r, diseases[i].id).toBeCloseTo(nR(diseases[i].papers), 9);
    }
  });

  it('morphT=1 lands on exactly the mortality radius for every node, any lag', () => {
    const L = computeLagFactors(diseases);
    for (let i = 0; i < diseases.length; i++) {
      const r = morphRadiusAt(diseases[i], 1, L[i]);
      expect(r, diseases[i].id).toBeCloseTo(nRM(diseases[i].mortality), 9);
    }
  });

  it('endpoints hold even with no lag table at all (L undefined, the un-staggered fallback)', () => {
    for (const d of diseases) {
      expect(morphRadiusAt(d, 0, undefined)).toBeCloseTo(nR(d.papers), 9);
      expect(morphRadiusAt(d, 1, undefined)).toBeCloseTo(nRM(d.mortality), 9);
    }
  });

  it('a giant target (heart disease, the biggest mortality figure by far) gets a lag near 1', () => {
    const idx = diseases.findIndex((d) => d.id === 'heart-disease');
    const L = computeLagFactors(diseases);
    expect(L[idx]).toBeGreaterThan(0.9);
  });

  it('mid-morph, the giant mover visibly lags the small movers (the 9/10 list requirement)', () => {
    // Heart disease (huge in both worlds) vs. a disease with a much smaller
    // mortality figure: at the same global progress, the small mover should
    // be further along toward its destination than the giant.
    const heartIdx = diseases.findIndex((d) => d.id === 'heart-disease');
    const smallIdx = diseases
      .map((d, i) => ({ i, m: d.mortality }))
      .filter((x) => x.m > 0)
      .sort((a, b) => a.m - b.m)[0].i;

    const L = computeLagFactors(diseases);
    const t = 0.5;
    const heartR = morphRadiusAt(diseases[heartIdx], t, L[heartIdx]);
    const smallR = morphRadiusAt(diseases[smallIdx], t, L[smallIdx]);

    const heartProgress = (heartR - nR(diseases[heartIdx].papers)) / (nRM(diseases[heartIdx].mortality) - nR(diseases[heartIdx].papers));
    const smallProgress = (smallR - nR(diseases[smallIdx].papers)) / (nRM(diseases[smallIdx].mortality) - nR(diseases[smallIdx].papers));

    expect(smallProgress).toBeGreaterThan(heartProgress);
  });
});
