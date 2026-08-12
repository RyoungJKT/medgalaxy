import { describe, it, expect } from 'vitest';
import { DUR, EASE, springStep, lagFactor, staggeredEase } from '../src/utils/motion';

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
