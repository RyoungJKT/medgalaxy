import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { nR, nRM } from '../src/utils/helpers';
import { supernovaRing, SN } from '../src/components/SelectionRipple';

// Round 10, user report: the burst ring "after the nodes vibrate" read as
// broken and unimpressive. It was sized in absolute world units (start + 220,
// width 10) while the supernova's own camera frames every subject at 8x THAT
// subject's radius, so the animation was a different one for every disease,
// and on all but the biggest node the ring had left the frame before the
// viewer saw it.
//
// The fix is a sizing law that is a pure function of the subject's live
// radius, which is what this file pins. The framing identity is the load
// bearing property: at the supernova's 8x seat, a ring whose every dimension
// is a multiple of the node's radius subtends the SAME angle for a 1.47-unit
// node and a 54.74-unit one.

// The supernova seats the camera at 8x the node's radius; the renderer's
// vertical fov is 60 degrees. A ring of radius r therefore covers
// r / (8R * tan(30deg)) = r / (4.6188 R) of the frame's half-height.
const FRAME_HALF = 8 * Math.tan((60 * Math.PI / 180) / 2); // in node radii

const radii = diseases.map((d) => nR(d.papers));
const R_MIN = Math.min(...radii);
const R_MAX = Math.max(...radii);

describe('supernovaRing: the sizing law is a pure function of the subject', () => {
  it('the live dataset really does span the range that broke the old constants', () => {
    // Guards the premise: if a future data refresh flattened node radii, the
    // proportional law would still be correct but this test's point would be
    // moot, and whoever reads it deserves to be told.
    expect(R_MIN).toBeLessThan(2);
    expect(R_MAX).toBeGreaterThan(50);
    expect(R_MAX / R_MIN).toBeGreaterThan(20);
  });

  it('the ring is born at the node surface, just outside it, for every disease', () => {
    for (const R of radii) {
      const { innerR } = supernovaRing(R, 0);
      expect(innerR).toBeCloseTo(R * SN.SURFACE, 6);
      // Strictly outside the silhouette: never swallowed, never co-planar with
      // the sphere's own rim (which is what would z-fight).
      expect(innerR).toBeGreaterThan(R);
      expect(innerR / R).toBeLessThan(1.05);
    }
  });

  it('the ring only ever grows', () => {
    for (const R of [R_MIN, 6.08, 11.19, R_MAX]) {
      let prev = -1;
      for (let p = 0; p <= 1.0001; p += 0.02) {
        const { innerR } = supernovaRing(R, p);
        expect(innerR).toBeGreaterThanOrEqual(prev);
        prev = innerR;
      }
    }
  });

  it('peak reach is 3.5-5x the node radius, the sanctioned band', () => {
    for (const R of radii) {
      const { innerR } = supernovaRing(R, 1);
      const k = innerR / R;
      expect(k).toBeGreaterThanOrEqual(3.5);
      // Only the tiny-node clamp may exceed 5x, and only for nodes below it.
      if (k > SN.K_MAX + 1e-6) expect(R).toBeLessThan(SN.R_FLOOR);
    }
  });

  it('every subject subtends the same ring at the supernova framing', () => {
    // The whole defect, as one number. Peak expansion in frame-half-heights,
    // for the three subjects the harness shoots, plus the extremes.
    const peaks = [R_MIN, 6.08, 11.19, 32.02, R_MAX].map((R) => {
      const { innerR } = supernovaRing(R, 1);
      return innerR / (FRAME_HALF * R);
    });
    const spread = Math.max(...peaks) / Math.min(...peaks);
    // The tiny-node clamp is the only source of spread at all, and it can only
    // make the smallest node's ring bigger, never smaller.
    expect(spread).toBeLessThan(1.25);
    for (const v of peaks) {
      expect(v).toBeGreaterThan(1.0); // sweeps past the frame edge, so it reads as a blast
      expect(v).toBeLessThan(3.0);    // but not so far that it is gone on arrival
    }
  });

  it('the old absolute law failed that same test by 6x', () => {
    // The measured before-state, reproduced from the constants it used, so the
    // regression this file guards is stated rather than remembered.
    const OLD_MAX = 220;
    const old = (R) => (R + OLD_MAX) / (FRAME_HALF * R);
    const peaks = [R_MIN, 6.08, R_MAX].map(old);
    expect(Math.max(...peaks) / Math.min(...peaks)).toBeGreaterThan(6);
  });

  it('ring width is proportional, with a floor, and never a slab', () => {
    for (const R of radii) {
      const { innerR, outerR } = supernovaRing(R, 0);
      const w = outerR - innerR;
      expect(w).toBeCloseTo(Math.max(R, SN.R_FLOOR) * SN.WIDTH_K, 6);
      // As a fraction of the frame at the supernova seat: legible, never a band.
      const wFrame = w / (FRAME_HALF * R);
      expect(wFrame).toBeGreaterThan(0.02);
      expect(wFrame).toBeLessThan(0.06);
    }
  });

  it('the front thins as it runs', () => {
    const R = 11.19;
    const w0 = supernovaRing(R, 0).outerR - supernovaRing(R, 0).innerR;
    const w1 = supernovaRing(R, 1).outerR - supernovaRing(R, 1).innerR;
    expect(w1).toBeLessThan(w0);
    expect(w1 / w0).toBeCloseTo(0.5, 2);
  });
});

describe('supernovaRing: alpha, echo and flash', () => {
  const R = 11.19;

  it('the ring ignites fast, falls off, and ends at zero', () => {
    expect(supernovaRing(R, 0).alpha).toBe(0);
    expect(supernovaRing(R, 1).alpha).toBe(0);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => supernovaRing(R, i / 100).alpha));
    expect(peak).toBeGreaterThan(0.6);
    // Below the 1.0 bloom threshold with room to spare: the ring itself must
    // never be what crosses into bloom (only the ignite ramp may).
    expect(peak).toBeLessThan(SN.ALPHA);
    expect(peak).toBeLessThan(0.8);
  });

  it('the echo trails the front by 120ms and never overtakes it', () => {
    expect(supernovaRing(R, 0.1).echoAlpha).toBe(0);
    expect(supernovaRing(R, 0.5).echoAlpha).toBeGreaterThan(0);
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const r = supernovaRing(R, p);
      expect(r.echoInnerR).toBeLessThanOrEqual(r.innerR + 1e-9);
      expect(r.echoAlpha).toBeLessThan(r.alpha + 1e-9 || 1);
    }
  });

  it('the echo is fainter than the front at every moment it is alive', () => {
    for (let p = 0.2; p < 1; p += 0.02) {
      const r = supernovaRing(R, p);
      if (r.echoAlpha > 0) expect(r.echoAlpha).toBeLessThan(r.alpha);
    }
  });

  it('the flash never lays light inside the node silhouette', () => {
    for (const Rn of radii) {
      for (let p = 0; p < SN.FLASH_LIFE; p += 0.01) {
        const r = supernovaRing(Rn, p);
        if (r.flashAlpha <= 0) continue;
        // Inner edge is the silhouette exactly; the shader's profile is zero
        // there and rises outward, so no additive light ever lands on the
        // node's own disc, which is what keeps it under the bloom threshold
        // without relying on the node being dim.
        expect(r.flashInnerR).toBeCloseTo(Rn * SN.FLASH_K_IN, 6);
        expect(r.flashOuterR).toBeGreaterThan(r.flashInnerR);
      }
    }
  });

  it('the flash is short, and quieter than the ring that outlives it', () => {
    const peakFlash = Math.max(...Array.from({ length: 201 }, (_, i) => supernovaRing(R, i / 200).flashAlpha));
    expect(peakFlash).toBeLessThan(SN.FLASH_ALPHA);
    expect(peakFlash).toBeLessThan(0.7 * 0.9); // quieter than the pre-round-10 ring's own peak
    expect(supernovaRing(R, SN.FLASH_LIFE).flashAlpha).toBe(0);
    expect(supernovaRing(R, 0.5).flashAlpha).toBe(0);
  });
});

describe('supernovaRing: prefers-reduced-motion', () => {
  it('is a pulse, not an expansion, at every subject size', () => {
    for (const R of [R_MIN, 6.08, 11.19, R_MAX]) {
      const at = (p) => supernovaRing(R, p, true);
      const radiiSeen = [0, 0.25, 0.5, 0.75, 1].map((p) => at(p).innerR);
      expect(Math.max(...radiiSeen)).toBeCloseTo(Math.min(...radiiSeen), 9);
      expect(at(0.5).innerR).toBeCloseTo(R * SN.SURFACE, 6);
      // and no second ring, no flash, no extra light
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        expect(at(p).echoAlpha).toBe(0);
        expect(at(p).flashAlpha).toBe(0);
      }
    }
  });

  it('still pulses, and still ends at zero', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => supernovaRing(11.19, i / 100, true).alpha));
    expect(peak).toBeGreaterThan(0.4);
    expect(peak).toBeLessThanOrEqual(SN.ALPHA);
    expect(supernovaRing(11.19, 0, true).alpha).toBe(0);
    expect(supernovaRing(11.19, 1, true).alpha).toBe(0);
  });
});

describe('supernovaRing: the Mortality-mode correctness the law depends on', () => {
  it('a papers estimate would misplace the ring by up to an order of magnitude', () => {
    // Why the ring now reads sceneRefs.nodeRadius instead of nR(papers): in
    // Mortality mode these are different spheres, and the ring is drawn on the
    // one the viewer cannot see.
    const worst = diseases.reduce((acc, d) => {
      const p = nR(d.papers), m = nRM(d.mortality);
      const ratio = Math.max(p / m, m / p);
      return ratio > acc.ratio ? { id: d.id, ratio, p, m } : acc;
    }, { ratio: 0 });
    expect(worst.ratio).toBeGreaterThan(5);
    // Sized on the wrong sphere, the ring is either a detached hoop...
    const detached = supernovaRing(worst.p, 0).innerR / worst.m;
    // ...or born inside the node. Either way it is not on the surface.
    expect(Math.abs(detached - 1)).toBeGreaterThan(0.5);
    // Sized on the right one, it is on the surface by construction.
    expect(supernovaRing(worst.m, 0).innerR / worst.m).toBeCloseTo(SN.SURFACE, 6);
  });
});
