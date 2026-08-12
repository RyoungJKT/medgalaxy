import { describe, it, expect } from 'vitest';
import {
  DUR, EASE, springStep, lagFactor, staggeredEase,
  arrival, staggeredArrival, settleScale, TM_SETTLE, TM_STAIR, TM_GHOST, TM_MICRO,
} from '../src/utils/motion';

describe('motion tokens', () => {
  it('DUR carries exactly the sanctioned time constants (DIRECTION section 4)', () => {
    expect(DUR).toEqual({ tick: 120, fast: 180, ui: 240, mid: 320, slow: 480, world: 650 });
  });

  it('EASE carries the sanctioned easings, keyed by their motion family', () => {
    expect(EASE.ui).toBe('cubic-bezier(0.16,1,0.3,1)');
    expect(EASE.cameraGsap).toBe('sine.inOut');
    expect(EASE.overshoot).toBe('back.out(1.2)');
  });
});

describe('springStep (critically damped, the world family\'s only motion)', () => {
  it('converges to the target from rest', () => {
    let x = 0, v = 0;
    for (let i = 0; i < 600; i++) [x, v] = springStep(x, v, 1, 1 / 60, 0.12);
    expect(x).toBeCloseTo(1, 3);
    expect(v).toBeCloseTo(0, 3);
  });

  it('never overshoots the target from rest (damping ratio 1, no bounce)', () => {
    let x = 0, v = 0, max = 0;
    for (let i = 0; i < 600; i++) {
      [x, v] = springStep(x, v, 1, 1 / 60, 0.12);
      if (x > max) max = x;
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('a shorter time constant reaches the target faster', () => {
    const run = (tc) => {
      let x = 0, v = 0;
      for (let i = 0; i < 30; i++) [x, v] = springStep(x, v, 1, 1 / 60, tc);
      return x;
    };
    expect(run(0.06)).toBeGreaterThan(run(0.24));
  });

  it('holds still at the target with zero velocity', () => {
    const [x, v] = springStep(1, 0, 1, 1 / 60, 0.12);
    expect(x).toBe(1);
    expect(v).toBe(0);
  });
});

describe('lagFactor (mass-weighted stagger, DIRECTION section 6 item 5)', () => {
  it('clamps to [0.35, 1]', () => {
    expect(lagFactor(0, 55)).toBeCloseTo(0.35, 6);
    expect(lagFactor(55, 55)).toBeCloseTo(1, 6);
    expect(lagFactor(1000, 55)).toBeCloseTo(1, 6); // a node above the current max still ceilings at 1
  });

  it('falls back to 1 (no lag) when there is no positive ceiling to scale against', () => {
    expect(lagFactor(10, 0)).toBe(1);
    expect(lagFactor(10, -5)).toBe(1);
  });

  it('scales with sqrt of the target radius, not linearly', () => {
    // A quarter of the ceiling radius should land near the sqrt curve's 0.5,
    // not the linear 0.25.
    expect(lagFactor(25, 100)).toBeCloseTo(0.5, 6);
  });
});

describe('staggeredEase (per-node progress from a global 0..1 morph clock)', () => {
  it('endpoints: global t=0 -> ease 0, t=1 -> ease 1, for every lag value', () => {
    for (const L of [0.35, 0.5, 0.75, 1]) {
      expect(staggeredEase(0, L)).toBe(0);
      expect(staggeredEase(1, L)).toBe(1);
    }
  });

  it('a smaller lag (a small mover) is further along than a larger lag at the same global t', () => {
    const tMid = 0.5;
    expect(staggeredEase(tMid, 0.35)).toBeGreaterThan(staggeredEase(tMid, 1));
  });

  it('is monotonically non-decreasing in t for a fixed lag', () => {
    for (const L of [0.35, 0.6, 1]) {
      let prev = -Infinity;
      for (let t = 0; t <= 1; t += 0.05) {
        const e = staggeredEase(t, L);
        expect(e).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = e;
      }
    }
  });

  it('treats a missing lag as no lag at all (L=1, the plain global curve)', () => {
    expect(staggeredEase(0.5, null)).toBeCloseTo(staggeredEase(0.5, 1), 10);
  });
});

// ─── Addendum 1, amendment A1: the world spring's analytic form ──────────────

describe('arrival (ADDENDUM 1 amendment A1)', () => {
  // The addendum's formula, transcribed once here so the implementation is
  // checked against the document rather than against itself.
  const spec = (x) => (1 - Math.exp(-5 * x) * (1 + 5 * x)) / (1 - 6 * Math.exp(-5));

  it('lands on both endpoints exactly, not approximately', () => {
    // Load-bearing: the entry and exit blends lerp between the per-year radius
    // and the settled papers/mortality radius, so an arrival that returned
    // 0.999 at x=1 would leave every node a hair off the mapping on the frame
    // the blend ends.
    expect(arrival(0)).toBe(0);
    expect(arrival(1)).toBe(1);
  });

  it('matches the addendum formula across the domain', () => {
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      expect(arrival(x)).toBeCloseTo(spec(x), 12);
    }
  });

  it('is strictly increasing', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const y = arrival(i / 1000);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });

  it('clamps outside [0,1], so a blend can never leave its endpoints', () => {
    expect(arrival(-3)).toBe(0);
    expect(arrival(-0.001)).toBe(0);
    expect(arrival(1.4)).toBe(1);
    for (let i = 0; i <= 100; i++) {
      const y = arrival(i / 100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('is a critically damped arrival: decelerating, no overshoot', () => {
    // Fastest progress in the first half, and never above 1 on the way.
    const d = (a, b) => arrival(b) - arrival(a);
    expect(d(0.1, 0.3)).toBeGreaterThan(d(0.7, 0.9));
    expect(arrival(0.5)).toBeGreaterThan(0.5); // ahead of linear, then eases in
  });
});

describe('staggeredArrival (arrival under the morph\'s mass-weighted lag)', () => {
  it('keeps the endpoint invariant for every lag factor', () => {
    for (let L = 0.3; L <= 1.0001; L += 0.01) {
      expect(staggeredArrival(0, L)).toBe(0);
      expect(staggeredArrival(1, L)).toBe(1);
    }
    expect(staggeredArrival(0, null)).toBe(0);
    expect(staggeredArrival(1, null)).toBe(1);
  });

  it('stays inside [0,1] at every global progress and lag', () => {
    for (let L = 0.35; L <= 1.0001; L += 0.05) {
      for (let i = 0; i <= 100; i++) {
        const e = staggeredArrival(i / 100, L);
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });

  it('makes giants land last: mid-blend, a small mover reads further along', () => {
    // "Thirty-five years collapse back into the whole record, giants landing
    // last" (ADDENDUM 1 section 1, exit table t = 0.15).
    expect(staggeredArrival(0.5, 0.35)).toBeGreaterThan(staggeredArrival(0.5, 1));
  });

  it('is monotone in global progress for every lag factor', () => {
    for (let L = 0.35; L <= 1.0001; L += 0.05) {
      let prev = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const e = staggeredArrival(i / 200, L);
        expect(e).toBeGreaterThanOrEqual(prev);
        prev = e;
      }
    }
  });
});

// ─── A2, the year-step settle (ADDENDUM 1 section 0 + acceptance 2.4 item 7) ──
describe('settleScale (amendment A2)', () => {
  it('is exactly 1 at both ends of its 240 ms window', () => {
    expect(settleScale(0, 0.045)).toBe(1);
    expect(settleScale(TM_SETTLE.dur, 0.045)).toBe(1);
    // And outside it, so a node that is not settling is at exactly its mapping.
    expect(settleScale(-1, 0.045)).toBe(1);
    expect(settleScale(1000, 0.045)).toBe(1);
    expect(settleScale(120, 0)).toBe(1);
  });

  it('peaks at exactly 1 + A, halfway through', () => {
    const A = TM_SETTLE.amps[0];
    expect(settleScale(TM_SETTLE.dur / 2, A)).toBeCloseTo(1 + A, 12);
    let max = 0;
    for (let t = 0; t <= TM_SETTLE.dur; t += 0.5) max = Math.max(max, settleScale(t, A));
    expect(max).toBeCloseTo(1 + A, 10);
  });

  it('never dips below 1: a half sine, not a full one', () => {
    for (let t = -50; t <= TM_SETTLE.dur + 50; t += 0.5) {
      expect(settleScale(t, TM_SETTLE.amps[0])).toBeGreaterThanOrEqual(1);
    }
  });

  it('stays strictly under back.out(1.2), so the overshoot hierarchy holds', () => {
    // back.out(1.2) peaks 5.29 percent past its target, at p = 0.6364. The
    // year-step settle is the third sanctioned overshoot and must be the
    // quietest of the three, by construction rather than by taste.
    const c1 = 1.2;
    const c3 = c1 + 1;
    let backPeak = 0;
    for (let p = 0; p <= 1; p += 0.0001) {
      backPeak = Math.max(backPeak, 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2));
    }
    expect(backPeak - 1).toBeCloseTo(0.0529, 4);
    expect(TM_SETTLE.amps[0]).toBeLessThanOrEqual(0.045);
    expect(TM_SETTLE.amps[0]).toBeLessThan(backPeak - 1);
  });

  it('ranks its three amplitudes 4.5, 3.0 and 2.0 percent, descending', () => {
    expect(TM_SETTLE.amps).toEqual([0.045, 0.030, 0.020]);
    expect(TM_SETTLE.dur).toBe(DUR.ui);
  });
});

describe('the staircase, ghost and micro-label constants', () => {
  it('composes the 360 ms year out of two sanctioned durations, not a new one', () => {
    expect(TM_STAIR.travel).toBe(DUR.ui);   // 240
    expect(TM_STAIR.dwell).toBe(DUR.tick);  // 120
    expect(TM_STAIR.year).toBe(360);
    expect(TM_STAIR.single).toBe(DUR.world);
    expect(TM_STAIR.stairCap).toBe(8);
    expect(TM_STAIR.sweepTail).toBe(6);
    expect(TM_STAIR.sweep).toBe(1300);
    expect(TM_STAIR.rewind).toBe(1300);
  });

  it('fades the ghost shell 0.30 to 0 over 480 ms from a pool of 8', () => {
    expect(TM_GHOST).toEqual({ dur: 480, alpha: 0.30, slots: 8, reduced: 300 });
    expect(TM_GHOST.dur).toBe(DUR.slow);
    // Eight slots against three per crossing: an eviction only ever takes a
    // shell two generations and 720 ms old, which is past its own fade.
    expect(TM_GHOST.slots).toBeGreaterThan(2 * 3);
    expect(TM_GHOST.dur).toBeGreaterThan(TM_STAIR.year);
    expect(TM_GHOST.dur).toBeLessThan(2 * TM_STAIR.year);
  });

  it('runs the micro-label in 180, holds 650, out 240, on a 360 ms dwell gate', () => {
    expect(TM_MICRO).toEqual({ in: 180, hold: 650, out: 240, dwell: 360 });
  });
});
