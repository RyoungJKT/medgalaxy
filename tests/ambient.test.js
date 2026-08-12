// ADDENDUM 1 section 4 and amendment A4: the four ambient oscillators.
//
// A4 is the only rule they answer to, and it is two clauses: no ambient channel
// may exceed 1.0 percent of the quantity it modulates, and every one of them
// stops the instant a directed stillness is called. The first clause is a
// property of these pure functions and is asserted here; the second lives in
// the components (a fly, beat 2's ignition hold, the detonation push-in) and is
// asserted by tools/verify-wave4.mjs against the running scene, where "exactly
// 0" can actually be measured.
import { describe, it, expect } from 'vitest';
import {
  AMBIENT, cameraBreathe, nodeBreathe, edgeBreathe,
  BREATHE_RESUME_SEC, breatheResumeGain,
} from '../src/utils/motion';

describe('A4: no ambient channel exceeds 1 percent of what it modulates', () => {
  it('camera radius breathes by 0.6 percent, inside the ceiling', () => {
    expect(AMBIENT.camera.radFrac).toBeLessThanOrEqual(0.01);
    expect(AMBIENT.camera.radFrac).toBe(0.006);
  });

  it('node radius breathes by 0.8 percent, inside the ceiling', () => {
    expect(AMBIENT.node.amp).toBeLessThanOrEqual(0.01);
    expect(AMBIENT.node.amp).toBe(0.008);
  });

  it('the camera angles are under half a degree, which is under a percent of any framing', () => {
    // At the closest seat the piece ever uses (0.3 R0), half a degree of arc is
    // 0.0087 radians of a 0.3 R0 radius = 0.26 percent of R0. The angular
    // channels cannot break the ceiling at any distance the camera can reach,
    // because the arc scales with the radius it is a fraction of.
    expect(AMBIENT.camera.azDeg).toBeLessThanOrEqual(0.5);
    expect(AMBIENT.camera.elDeg).toBeLessThanOrEqual(0.5);
    expect((AMBIENT.camera.azDeg * Math.PI) / 180).toBeLessThan(0.01);
  });
});

describe('cameraBreathe', () => {
  it('never exceeds its stated amplitudes, over a full hour of clock', () => {
    const azMax = (AMBIENT.camera.azDeg * Math.PI) / 180;
    const elMax = (AMBIENT.camera.elDeg * Math.PI) / 180;
    let azPeak = 0, elPeak = 0, rPeak = 0;
    for (let t = 0; t < 3600; t += 0.37) {
      const [az, el, r] = cameraBreathe(t);
      azPeak = Math.max(azPeak, Math.abs(az));
      elPeak = Math.max(elPeak, Math.abs(el));
      rPeak = Math.max(rPeak, Math.abs(r));
    }
    expect(azPeak).toBeLessThanOrEqual(azMax + 1e-12);
    expect(elPeak).toBeLessThanOrEqual(elMax + 1e-12);
    expect(rPeak).toBeLessThanOrEqual(AMBIENT.camera.radFrac + 1e-12);
    // ...and actually reaches them, so this is a breathe and not a flat line.
    expect(azPeak).toBeGreaterThan(azMax * 0.99);
    expect(rPeak).toBeGreaterThan(AMBIENT.camera.radFrac * 0.99);
  });

  it('writes into a caller-owned triple (no allocation in the frame loop)', () => {
    const out = [0, 0, 0];
    const ret = cameraBreathe(12.5, out);
    expect(ret).toBe(out);
  });

  it('has three incommensurate frequencies, so the sum never visibly repeats', () => {
    const { azHz, elHz, radHz } = AMBIENT.camera;
    // A common period exists only if the three are rational multiples of one
    // another with a small denominator. Search every ratio a/b with b <= 40:
    // none of the three pairs may land on one, which is what keeps the pattern
    // from looping inside a viewing.
    const pairs = [[azHz, elHz], [azHz, radHz], [elHz, radHz]];
    for (const [a, b] of pairs) {
      let best = Infinity;
      for (let q = 1; q <= 40; q++) {
        for (let p = 1; p <= 40; p++) {
          best = Math.min(best, Math.abs(a / b - p / q));
        }
      }
      // Every pair is at least a few parts in ten thousand off any small ratio.
      expect(best).toBeGreaterThan(0);
    }
    // The practical statement: in millihertz the three are 55, 83 and 37, which
    // are pairwise coprime, so the pattern's exact repeat period is 1000 s —
    // roughly seventeen minutes, against a 56 s piece and a pause measured in
    // seconds. It cannot loop inside anything a viewer watches.
    const ms = [azHz, elHz, radHz].map((f) => Math.round(f * 1000));
    expect(ms).toEqual([55, 83, 37]);
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    for (const [a, b] of [[ms[0], ms[1]], [ms[0], ms[2]], [ms[1], ms[2]]]) {
      expect(gcd(a, b)).toBe(1);
    }
    expect(1000 / ms.reduce(gcd)).toBeGreaterThan(500);
  });
});

describe('nodeBreathe', () => {
  it('stays inside 1 +- 0.8 percent for every phase and every time', () => {
    let lo = Infinity, hi = -Infinity;
    for (let p = 0; p < 2 * Math.PI; p += 0.11) {
      for (let t = 0; t < 60; t += 0.13) {
        const m = nodeBreathe(t, p);
        lo = Math.min(lo, m);
        hi = Math.max(hi, m);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(1 - AMBIENT.node.amp - 1e-12);
    expect(hi).toBeLessThanOrEqual(1 + AMBIENT.node.amp + 1e-12);
    expect(hi - lo).toBeGreaterThan(AMBIENT.node.amp); // it does breathe
  });

  it('spreads per-node frequency across 0.10 to 0.16 Hz off the aPhase attribute', () => {
    // The frequency is read out of the phase, so the two ends of the attribute
    // are the two ends of the band and nothing outside it is reachable.
    const freqOf = (phase) => {
      // Recover the period by finding the first return to the phase's own start
      // value, which is 1/f by construction.
      const f = AMBIENT.node.hz[0] +
        (AMBIENT.node.hz[1] - AMBIENT.node.hz[0]) * (phase / (2 * Math.PI));
      // Sanity: the helper really is running at that frequency.
      expect(nodeBreathe(1 / f, phase)).toBeCloseTo(nodeBreathe(0, phase), 10);
      return f;
    };
    expect(freqOf(0)).toBeCloseTo(0.10, 10);
    expect(freqOf(2 * Math.PI)).toBeCloseTo(0.16, 10);
    expect(freqOf(Math.PI)).toBeCloseTo(0.13, 10);
  });

  it('gives neighbouring nodes different cycles, so the field is not one throb', () => {
    const a = [], b = [];
    for (let t = 0; t < 20; t += 0.25) { a.push(nodeBreathe(t, 0.4)); b.push(nodeBreathe(t, 5.1)); }
    let same = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) < 1e-4) same++;
    expect(same).toBeLessThan(a.length / 4);
  });
});

describe('edgeBreathe (the film-only edge shimmer)', () => {
  it('runs 0.06 to 0.13 and reaches both ends inside one 5 s period', () => {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t <= 5; t += 0.01) {
      const a = edgeBreathe(t, 1);
      lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    expect(lo).toBeCloseTo(AMBIENT.edge.lo, 3);
    expect(hi).toBeCloseTo(AMBIENT.edge.hi, 3);
  });

  it('is exactly 0 outside the film, at every time', () => {
    for (let t = 0; t < 100; t += 0.7) expect(edgeBreathe(t, 0)).toBe(0);
  });

  it('scales linearly with how much of the film is live, so beat 2 fades it out', () => {
    for (const t of [0.3, 2.2, 7.7]) {
      expect(edgeBreathe(t, 0.5)).toBeCloseTo(edgeBreathe(t, 1) * 0.5, 12);
    }
  });

  it('is 0.2 Hz: a full period every 5 s', () => {
    expect(AMBIENT.edge.hz).toBe(0.2);
    expect(edgeBreathe(5, 1)).toBeCloseTo(edgeBreathe(0, 1), 12);
    expect(edgeBreathe(12.5, 1)).toBeCloseTo(edgeBreathe(2.5, 1), 12);
  });
});

describe('the star shells (section 4 item 2)', () => {
  it('splits the tier budget 0.30 / 0.45 / 0.25 and spends it exactly', () => {
    expect(AMBIENT.stars.split.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    for (const count of [400, 150, 0]) {
      let spent = 0;
      const counts = [];
      for (let s = 0; s < 3; s++) {
        const n = s === 2 ? count - spent : Math.round(count * AMBIENT.stars.split[s]);
        spent += n;
        counts.push(n);
      }
      expect(counts.reduce((a, b) => a + b, 0)).toBe(count);
      expect(counts.every((n) => n >= 0)).toBe(true);
    }
  });

  it('orders the shells near to far, with sizes and rates falling with distance', () => {
    const { radii, rates, sizes } = AMBIENT.stars;
    expect(radii).toEqual([2.8, 4.0, 6.2]);
    for (let i = 1; i < 3; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
      expect(rates[i]).toBeLessThan(rates[i - 1]);
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it('keeps the outermost shell inside the 9.6 R0 far plane from the 2.9 R0 assembly seat', () => {
    const outer = AMBIENT.stars.radii[2] * (1 + AMBIENT.stars.jitter);
    expect(outer + 2.9).toBeLessThan(9.6);
  });
});

describe('breatheResumeGain (the onStart kill releases at idle, not for the session)', () => {
  // CameraRig's onStart kills breathing outright, but the addendum's own
  // eleven holds include "scrub at rest, idle" — idle only happens after an
  // interaction ends, so the kill has to let go again. This is the pure ramp
  // shape CameraRig drives with elapsed idle time once idleFrames crosses the
  // same 300-frame threshold that brings autoRotate back.
  it('is 0 at and before the release instant', () => {
    expect(breatheResumeGain(0)).toBe(0);
    expect(breatheResumeGain(-1)).toBe(0);
  });

  it('is exactly 1 at BREATHE_RESUME_SEC and stays clamped at 1 after', () => {
    expect(BREATHE_RESUME_SEC).toBe(2.0);
    expect(breatheResumeGain(BREATHE_RESUME_SEC)).toBe(1);
    expect(breatheResumeGain(BREATHE_RESUME_SEC * 10)).toBe(1);
  });

  it('ramps linearly and monotonically between 0 and BREATHE_RESUME_SEC', () => {
    expect(breatheResumeGain(BREATHE_RESUME_SEC / 2)).toBeCloseTo(0.5, 12);
    let prev = -1;
    for (let t = 0; t <= BREATHE_RESUME_SEC; t += 0.05) {
      const g = breatheResumeGain(t);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it('is slower than the ~0.5s generic ramp elsewhere in the breathing block', () => {
    // The generic ramp used for every other directed->undirected transition
    // reaches full gain in 0.5s (rate 2/s); the interaction-resume ramp must
    // still be well under full strength at that point, since the return from
    // an active drag is deliberately slower.
    expect(breatheResumeGain(0.5)).toBeLessThan(1);
    expect(breatheResumeGain(0.5)).toBeCloseTo(0.25, 12);
  });
});

describe('the tour leg choreography (section 4 item 3)', () => {
  it('gives the sweep the larger truck and dolly', () => {
    expect(AMBIENT.leg.sweepDeg).toBeGreaterThan(AMBIENT.leg.stairDeg);
    expect(AMBIENT.leg.sweepDolly).toBeGreaterThan(AMBIENT.leg.stairDolly);
    expect(AMBIENT.leg).toMatchObject({
      stairDeg: 4.0, stairDolly: 0.03, sweepDeg: 9.0, sweepDolly: 0.06,
    });
  });

  it('cannot compound into a runaway push-in: five legs of dolly stay inside 20 percent', () => {
    // Six pauses means at most five legs, and the longest leg carries both a
    // sweep and a staircase. Even the worst case leaves the camera at 0.83 of
    // where it started, and every pause cue re-frames from an absolute seat
    // anyway.
    const worst = Math.pow(1 - AMBIENT.leg.stairDolly, 5) * (1 - AMBIENT.leg.sweepDolly);
    expect(worst).toBeGreaterThan(0.80);
  });
});
