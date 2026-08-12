import { describe, it, expect } from 'vitest';
import {
  ASM, hashAt, hSpawn, uStart, categoryDirs, makePlan, makeFlight, flightAt, forceLand, assemblySeat, fogRangeAt,
} from '../src/utils/assembly';
import { arrival, arrivalRate } from '../src/utils/motion';
import { T_DONE } from '../src/components/IntroSequence';
import { processData, nR } from '../src/utils/helpers';
import { computeLayouts } from '../src/utils/layout';
import { CATS } from '../src/utils/constants';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';

// ─── Beat 0 restaged: the fly-in assembly (ADDENDUM 1 section 3) ─────────────
// The whole flight is pure math over the real table, so the acceptance items
// the addendum states as pixel checks are unit tests here and the harness only
// has to confirm that the renderer agrees:
//   - "at t = 0.00, instances with scale > 0 equals 153, and instances inside
//      2.0 R0 equals 0"
//   - "every quaternion must be identity on beat 1's first frame"
//   - "a skip never leaves a node in flight and never leaves a quaternion
//      non-identity"
//   - "the last thing to land is the biggest thing"

const { diseases, layoutEdges } = processData(diseasesData, connectionsData);
const { catPos, rawMax } = computeLayouts(diseases, layoutEdges);
const R0 = rawMax * 1.4;               // App.jsx's desktop camDist
const R0_MOBILE = rawMax * 2.4;        // ...and its portrait one
const plan = makePlan(diseases, catPos, R0);
const N = diseases.length;

const dist = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

describe('assembly: deterministic hashes', () => {
  it('h(i) and u(i) are stable across calls and lie in [0, 1)', () => {
    for (let i = 0; i < 200; i += 7) {
      expect(hSpawn(i)).toBe(hSpawn(i));
      expect(uStart(i)).toBe(uStart(i));
      expect(hSpawn(i)).toBeGreaterThanOrEqual(0);
      expect(hSpawn(i)).toBeLessThan(1);
      expect(uStart(i)).toBeGreaterThanOrEqual(0);
      expect(uStart(i)).toBeLessThan(1);
    }
  });

  it('the two hash streams are independent, not the same number twice', () => {
    let same = 0;
    for (let i = 0; i < N; i++) if (Math.abs(hSpawn(i) - uStart(i)) < 1e-6) same++;
    expect(same).toBe(0);
    expect(hashAt(3, 1)).not.toBe(hashAt(3, 2));
  });

  it('spans the unit interval rather than clustering (no Math.random anywhere)', () => {
    let lo = 1, hi = 0, sum = 0;
    for (let i = 0; i < N; i++) { const v = uStart(i); lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
    expect(lo).toBeLessThan(0.05);
    expect(hi).toBeGreaterThan(0.95);
    expect(sum / N).toBeGreaterThan(0.4);
    expect(sum / N).toBeLessThan(0.6);
  });

  it('a rebuilt plan is byte-identical, which is what makes beat 0 seekable', () => {
    const again = makePlan(diseases, catPos, R0);
    expect(Array.from(again.spawn)).toEqual(Array.from(plan.spawn));
    expect(Array.from(again.t0)).toEqual(Array.from(plan.t0));
    expect(Array.from(again.dur)).toEqual(Array.from(plan.dur));
  });
});

describe('assembly: ten streams, not 153 darts', () => {
  it('is ten unit vectors on a Fibonacci sphere, one per category', () => {
    const dirs = categoryDirs();
    expect(dirs.length).toBe(10);
    expect(CATS.length).toBe(10);
    for (const d of dirs) expect(dist(d[0], d[1], d[2])).toBeCloseTo(1, 12);
  });

  it('clamps every entry elevation to [-25, +55] degrees', () => {
    for (const d of categoryDirs()) {
      const el = (Math.asin(d[1]) * 180) / Math.PI;
      expect(el).toBeGreaterThanOrEqual(ASM.elevMin - 1e-9);
      expect(el).toBeLessThanOrEqual(ASM.elevMax + 1e-9);
    }
  });

  it('gives all ten distinct directions despite the elevation clamp', () => {
    const dirs = categoryDirs();
    for (let a = 0; a < dirs.length; a++) {
      for (let b = a + 1; b < dirs.length; b++) {
        const dot = dirs[a][0] * dirs[b][0] + dirs[a][1] * dirs[b][1] + dirs[a][2] * dirs[b][2];
        expect(dot).toBeLessThan(0.985);
      }
    }
  });

  it('every node in a stream curves the same way (one chirality per stream)', () => {
    // The bow is N * 0.22 * |S - P| with N = normalize(P x D_c), so it is not
    // one shared vector -- it is one shared *handedness* about the stream's own
    // entry axis, which is what makes ten ribbons rather than ten flat fans.
    // Two invariants say that exactly: the bow is perpendicular to the entry
    // vector, and (P x N) . D has the same sign for every node in the galaxy.
    const dirs = categoryDirs();
    let seen = 0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const ox = plan.ctrl[i3] - (plan.spawn[i3] + plan.seat[i3]) / 2;
      const oy = plan.ctrl[i3 + 1] - (plan.spawn[i3 + 1] + plan.seat[i3 + 1]) / 2;
      const oz = plan.ctrl[i3 + 2] - (plan.spawn[i3 + 2] + plan.seat[i3 + 2]) / 2;
      const L = dist(ox, oy, oz);
      if (L < 1e-6) continue;
      const n = [ox / L, oy / L, oz / L];
      const D = dirs[plan.cat[i]];
      expect(Math.abs(n[0] * D[0] + n[1] * D[1] + n[2] * D[2])).toBeLessThan(1e-4);
      const P = catPos[i];
      const cx = P[1] * n[2] - P[2] * n[1];
      const cy = P[2] * n[0] - P[0] * n[2];
      const cz = P[0] * n[1] - P[1] * n[0];
      const pl = dist(P[0], P[1], P[2]);
      if (pl < 1e-3) continue;
      expect((cx * D[0] + cy * D[1] + cz * D[2]) / pl).toBeLessThan(0);
      seen++;
    }
    expect(seen).toBeGreaterThan(140);
    expect(new Set(Array.from(plan.cat)).size).toBe(10);
  });
});

describe('assembly: first-frame integrity, honored harder', () => {
  const f = makeFlight();

  it('all 153 nodes exist at t = 0.00, at their spawns, at exactly 0.55 radius', () => {
    let present = 0;
    for (let i = 0; i < N; i++) {
      flightAt(plan, i, 0, f);
      expect(f.radius).toBe(ASM.rStart);
      expect(f.x).toBe(plan.spawn[i * 3]);
      expect(f.y).toBe(plan.spawn[i * 3 + 1]);
      expect(f.z).toBe(plan.spawn[i * 3 + 2]);
      if (f.radius > 0) present++;
    }
    expect(present).toBe(153);
    expect(N).toBe(153);
  });

  it('zero instances are inside 2.0 R0 on the first frame (the stated gate)', () => {
    let inside = 0;
    let outside6 = 0;
    for (let i = 0; i < N; i++) {
      const d = dist(plan.spawn[i * 3], plan.spawn[i * 3 + 1], plan.spawn[i * 3 + 2]);
      if (d < 2.0 * R0) inside++;
      if (d > 6.0 * R0) outside6++;
    }
    expect(inside).toBe(0);
    expect(outside6).toBe(0); // "...and inside a 6 R0 shell"
  });

  it('every spawn is in deep space on either viewport, 3.4 to 5.2 layout radii', () => {
    // The 2.0 R0 gate above is a desktop measurement: R0 is camDist, and
    // portrait's camera sits 2.4 layout radii out instead of 1.4, so the same
    // shell is a smaller multiple of R0 there. The scale-free statement of the
    // same promise -- no node ever spawns inside the galaxy it is falling into
    // -- is the addendum's own prose, "3.4 to 5.2 times the layout radius", and
    // that holds on both.
    let layoutR = 0;
    for (let i = 0; i < N; i++) layoutR = Math.max(layoutR, dist(catPos[i][0], catPos[i][1], catPos[i][2]));
    for (const camDist of [R0, R0_MOBILE]) {
      const p = makePlan(diseases, catPos, camDist);
      let lo = Infinity, hi = 0;
      for (let i = 0; i < N; i++) {
        const d = dist(p.spawn[i * 3], p.spawn[i * 3 + 1], p.spawn[i * 3 + 2]);
        lo = Math.min(lo, d); hi = Math.max(hi, d);
      }
      expect(lo / layoutR).toBeGreaterThanOrEqual(ASM.spawnBase - 1e-6);
      expect(hi / layoutR).toBeLessThan(8);
      expect(hi).toBeLessThan(6 * camDist);
    }
  });

  it('nothing is in flight and nothing is stretched before the first launch', () => {
    for (let i = 0; i < N; i++) {
      flightAt(plan, i, 0, f);
      expect(f.flying).toBe(false);
      expect(f.landed).toBe(false);
      expect(f.stretch).toBe(1);
      expect(f.alpha).toBe(0);
      expect([f.vx, f.vy, f.vz]).toEqual([0, 1, 0]);
      expect(f.bright).toBe(ASM.brightMin);
    }
  });
});

describe('assembly: timing', () => {
  it('launches ten streams 0.16 s apart, the last at 1.44 s', () => {
    const perCat = new Map();
    for (let i = 0; i < N; i++) {
      const base = ASM.streamStep * plan.cat[i];
      perCat.set(plan.cat[i], base);
      // the per-node start is the stream's launch plus at most 300 ms of jitter
      expect(plan.t0[i]).toBeGreaterThanOrEqual(base);
      expect(plan.t0[i]).toBeLessThanOrEqual(base + ASM.jitter);
    }
    const slots = [...perCat.keys()].sort((a, b) => a - b);
    expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(perCat.get(9)).toBeCloseTo(1.44, 10);
  });

  it('flight duration is 2.10 s to 3.25 s and grows with the node', () => {
    let lo = 99, hi = 0;
    for (let i = 0; i < N; i++) { lo = Math.min(lo, plan.dur[i]); hi = Math.max(hi, plan.dur[i]); }
    expect(lo).toBeGreaterThanOrEqual(ASM.flightBase - 1e-6);
    expect(hi).toBeLessThanOrEqual(ASM.flightBase + ASM.flightSpan + 1e-6);
    // The single largest node flies for the whole 3.25 s.
    let big = 0;
    for (let i = 0; i < N; i++) if (plan.rad[i] > plan.rad[big]) big = i;
    expect(plan.dur[big]).toBeCloseTo(3.25, 6);
  });

  it('the earliest arrival is not before 2.10 s', () => {
    let first = 99;
    for (let i = 0; i < N; i++) first = Math.min(first, plan.t0[i] + plan.dur[i]);
    expect(first).toBeGreaterThanOrEqual(ASM.flightBase);
  });

  it('the last thing to land is the biggest thing, and beat 0 still ends still', () => {
    let last = -1, li = -1, big = 0;
    for (let i = 0; i < N; i++) {
      const a = plan.t0[i] + plan.dur[i];
      if (a > last) { last = a; li = i; }
      if (plan.rad[i] > plan.rad[big]) big = i;
    }
    expect(li).toBe(big);
    expect(nR(diseases[big].papers)).toBeCloseTo(plan.rMax, 4);
    // "Latest arrival 4.99 s ... and then 210 ms of stillness before beat 1
    // speaks. That silence is the beat."
    expect(last).toBeGreaterThan(4.8);
    expect(last).toBeLessThanOrEqual(ASM.total - 0.18);
    expect(ASM.total - last).toBeGreaterThanOrEqual(ASM.stillness - 0.01);
  });

  it('the budget is 5.2 s and IntroSequence ends on it', () => {
    expect(ASM.total).toBe(5.2);
    expect(T_DONE).toBe(5.2);
    // New total from landing dismissal to release end: 21.7 s, under the
    // 5.5 s assembly ceiling the addendum sets for beat 0.
    expect(ASM.total + 16.5).toBeCloseTo(21.7, 10);
    expect(ASM.total).toBeLessThanOrEqual(5.5);
  });
});

describe('assembly: the flight is monotone and lands exactly', () => {
  const f = makeFlight();

  it('arrival() drives p monotonically from exactly 0 to exactly 1', () => {
    for (const i of [0, 17, 61, 122, 152]) {
      let prev = -1;
      for (let t = 0; t <= ASM.total + 0.001; t += 1 / 120) {
        flightAt(plan, i, t, f);
        expect(f.p).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = f.p;
      }
      flightAt(plan, i, plan.t0[i], f);
      expect(f.p).toBe(0);
      flightAt(plan, i, plan.t0[i] + plan.dur[i], f);
      expect(f.p).toBe(1);
    }
  });

  it('radius runs 0.55 to exactly 1.00, never overshooting, never regressing', () => {
    for (const i of [3, 44, 90, 151]) {
      let prev = -1;
      for (let t = 0; t <= ASM.total; t += 1 / 120) {
        flightAt(plan, i, t, f);
        expect(f.radius).toBeGreaterThanOrEqual(ASM.rStart - 1e-9);
        expect(f.radius).toBeLessThanOrEqual(1 + 1e-9);
        expect(f.radius).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = f.radius;
      }
      // Held at the launch radius until the last 30 percent of the flight.
      flightAt(plan, i, plan.t0[i] + plan.dur[i] * 0.69, f);
      expect(f.radius).toBeCloseTo(ASM.rStart, 6);
      flightAt(plan, i, plan.t0[i] + plan.dur[i], f);
      expect(f.radius).toBe(1);
    }
  });

  it('lands on the seat itself, not near it', () => {
    for (let i = 0; i < N; i++) {
      flightAt(plan, i, plan.t0[i] + plan.dur[i] + 0.5, f);
      expect(f.x).toBe(plan.seat[i * 3]);
      expect(f.y).toBe(plan.seat[i * 3 + 1]);
      expect(f.z).toBe(plan.seat[i * 3 + 2]);
      expect(f.radius).toBe(1);
      expect(f.landed).toBe(true);
    }
  });

  it('arrivalRate is arrival\'s own derivative everywhere on [0, 1]', () => {
    expect(arrivalRate(0)).toBe(0);
    for (const x of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999]) {
      const h = 1e-6;
      const numeric = (arrival(x + h) - arrival(x - h)) / (2 * h);
      expect(arrivalRate(x)).toBeCloseTo(numeric, 3);
      expect(arrivalRate(x)).toBeGreaterThan(0); // p is strictly increasing
    }
    // A critically damped step response normalized to land at x = 1 arrives
    // with a residual rate, exactly as the release glide does. 25 e^-5 over the
    // normalizer, and the comet stretch's own p = 0.92 fade is what makes the
    // *visual* land at rest anyway.
    expect(arrivalRate(1)).toBeCloseTo((25 * Math.exp(-5)) / (1 - 6 * Math.exp(-5)), 9);
    expect(arrivalRate(1)).toBeLessThan(arrivalRate(0.2));
  });
});

describe('assembly: the comet stretch', () => {
  const f = makeFlight();

  it('never exceeds the 1 + 1.8 cap', () => {
    let hi = 0;
    for (let t = 0; t <= ASM.total; t += 1 / 120) {
      for (let i = 0; i < N; i++) { flightAt(plan, i, t, f); hi = Math.max(hi, f.stretch); }
    }
    expect(hi).toBeGreaterThan(1.5);            // it does actually stretch
    expect(hi).toBeLessThanOrEqual(1 + ASM.stretchMax + 1e-9);
  });

  it('is exactly 1.000 by p = 0.92, before any caption exists', () => {
    for (let i = 0; i < N; i++) {
      for (let t = 0; t <= ASM.total; t += 1 / 240) {
        flightAt(plan, i, t, f);
        if (f.p >= ASM.stretchFade1) expect(f.stretch).toBe(1);
      }
    }
  });

  it('every quaternion is identity on beat 1\'s first frame', () => {
    for (let i = 0; i < N; i++) {
      flightAt(plan, i, ASM.total, f);
      expect(f.stretch).toBe(1);
      expect(f.flying).toBe(false);
      expect(f.landed).toBe(true);
      // The driver only builds a quaternion when stretch > 1; at rest the
      // velocity IS +Y, which is what setFromUnitVectors(UP, v) turns into the
      // identity rotation.
      expect([f.vx, f.vy, f.vz]).toEqual([0, 1, 0]);
    }
  });

  it('a stretched node is stretched along its own travel direction', () => {
    // Mid-flight the velocity is a unit vector and it is not the resting +Y,
    // so the instance quaternion is doing real work.
    flightAt(plan, 40, plan.t0[40] + plan.dur[40] * 0.25, f);
    expect(f.stretch).toBeGreaterThan(1.2);
    expect(dist(f.vx, f.vy, f.vz)).toBeCloseTo(1, 9);
    expect(Math.abs(f.vy)).toBeLessThan(0.999);
  });
});

describe('assembly: brightness and the landing pip', () => {
  const f = makeFlight();

  it('runs 0.35 at launch to 1.00 at landing', () => {
    const i = 70;
    flightAt(plan, i, plan.t0[i], f);
    expect(f.bright).toBeCloseTo(ASM.brightMin, 9);
    flightAt(plan, i, plan.t0[i] + plan.dur[i] * 0.5, f);
    expect(f.bright).toBeCloseTo((ASM.brightMin + 1) / 2, 6);
    flightAt(plan, i, plan.t0[i] + plan.dur[i] - 1e-6, f);
    expect(f.bright).toBeCloseTo(1, 5);
  });

  it('pips to 1.30x on the landing frame and decays to exactly 1.000 by 180 ms', () => {
    const i = 70;
    const land = plan.t0[i] + plan.dur[i];
    flightAt(plan, i, land, f);
    expect(f.bright).toBeCloseTo(1 + ASM.pipAmp, 9);
    flightAt(plan, i, land + ASM.pipMs / 2000, f);
    expect(f.bright).toBeCloseTo(1 + ASM.pipAmp / 2, 6);
    flightAt(plan, i, land + ASM.pipMs / 1000, f);
    expect(f.bright).toBeCloseTo(1, 9);
    flightAt(plan, i, land + 0.181, f);
    expect(f.bright).toBe(1);
    flightAt(plan, i, land + 1.0, f);
    expect(f.bright).toBe(1);
  });
});

describe('assembly: filaments', () => {
  const f = makeFlight();

  it('one segment per node, never more than 153', () => {
    let hi = 0;
    for (let t = 0; t <= ASM.total; t += 1 / 60) {
      let live = 0;
      for (let i = 0; i < N; i++) { flightAt(plan, i, t, f); if (f.alpha > 0.002) live++; }
      hi = Math.max(hi, live);
    }
    expect(hi).toBeGreaterThan(100);   // the streams really do trail
    expect(hi).toBeLessThanOrEqual(N);
  });

  it('is velocity-scaled, capped at 0.25, and dead on both sides of the flight', () => {
    for (let i = 0; i < N; i++) {
      for (let t = 0; t <= ASM.total; t += 1 / 120) {
        flightAt(plan, i, t, f);
        expect(f.alpha).toBeLessThanOrEqual(ASM.tailAlpha + 1e-9);
        if (!f.flying) expect(f.alpha).toBe(0);
      }
    }
  });

  it('the tail runs back along the node\'s own bezier, never past its spawn', () => {
    const i = 88;
    const t = plan.t0[i] + plan.dur[i] * 0.3;
    flightAt(plan, i, t, f);
    const tailLen = dist(f.x - f.tx, f.y - f.ty, f.z - f.tz);
    const whole = dist(
      plan.spawn[i * 3] - plan.seat[i * 3],
      plan.spawn[i * 3 + 1] - plan.seat[i * 3 + 1],
      plan.spawn[i * 3 + 2] - plan.seat[i * 3 + 2],
    );
    expect(tailLen).toBeGreaterThan(0);
    expect(tailLen).toBeLessThan(whole);
  });
});

describe('assembly: skip integrity', () => {
  const f = makeFlight();

  it('drops every stretch and quaternion to identity on the frame the skip lands', () => {
    // Beat 1 begins on that frame, and "every quaternion must be identity on
    // beat 1's first frame" is the harder of the two promises: a node still
    // travelling for another half second travels as a sphere.
    const g = makeFlight();
    const from = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      flightAt(plan, i, 1.0, f);
      from[0] = f.x; from[1] = f.y; from[2] = f.z;
      for (const k of [0, 0.13, 0.5, 0.97, 1]) {
        forceLand(plan, i, from, f.radius, f.bright, k, g);
        expect(g.stretch).toBe(1);
        expect([g.vx, g.vy, g.vz]).toEqual([0, 1, 0]);
        expect(g.alpha).toBe(0);
      }
    }
  });

  it('the 0.5 s force-land ends exactly on the seat, at radius 1, for every node', () => {
    // arrival(1) is exactly 1 and the terminal state is written rather than
    // lerped, so no node is left a float away from where it belongs.
    expect(arrival(1)).toBe(1);
    const g = makeFlight();
    const from = [0, 0, 0];
    for (const tSkip of [0.2, 1.0, 2.6, 4.4]) {
      for (let i = 0; i < N; i++) {
        flightAt(plan, i, tSkip, f);
        from[0] = f.x; from[1] = f.y; from[2] = f.z;
        forceLand(plan, i, from, f.radius, f.bright, arrival(1), g);
        expect(g.x).toBe(plan.seat[i * 3]);
        expect(g.y).toBe(plan.seat[i * 3 + 1]);
        expect(g.z).toBe(plan.seat[i * 3 + 2]);
        expect(g.radius).toBe(1);
        expect(g.bright).toBe(1);
        expect(g.flying).toBe(false);
        expect(g.landed).toBe(true);
      }
    }
  });

  it('the fast-forward is monotone: no node moves away from its seat first', () => {
    const g = makeFlight();
    for (const i of [12, 55, 121]) {
      flightAt(plan, i, 1.0, f);
      const from = [f.x, f.y, f.z];
      let prev = Infinity;
      let prevR = -1;
      for (let e = 0; e <= ASM.skip + 1e-9; e += ASM.skip / 30) {
        forceLand(plan, i, from, f.radius, f.bright, arrival(e / ASM.skip), g);
        const d = dist(g.x - plan.seat[i * 3], g.y - plan.seat[i * 3 + 1], g.z - plan.seat[i * 3 + 2]);
        expect(d).toBeLessThanOrEqual(prev + 1e-9);
        expect(g.radius).toBeGreaterThanOrEqual(prevR - 1e-9);
        prev = d; prevR = g.radius;
      }
      expect(prev).toBe(0);
    }
  });
});

describe('assembly: the camera seat', () => {
  it('opens at 2.9 R0 elevation 12 and drifts to 1.5 R0', () => {
    for (const curl of [1, -1]) {
      const a = assemblySeat(R0, curl, 0);
      const b = assemblySeat(R0, curl, ASM.total);
      expect(dist(a[0], a[1], a[2]) / R0).toBeCloseTo(2.9, 6);
      expect(dist(b[0], b[1], b[2]) / R0).toBeCloseTo(1.5, 6);
      const elA = (Math.asin(a[1] / dist(a[0], a[1], a[2])) * 180) / Math.PI;
      const elB = (Math.asin(b[1] / dist(b[0], b[1], b[2])) * 180) / Math.PI;
      expect(elA).toBeCloseTo(12, 6);
      expect(elB).toBeCloseTo(12, 6);
    }
  });

  it('counter-drifts 2.5 degrees of azimuth against the curl, landing at 0', () => {
    const curl = plan.curlSign;
    const a = assemblySeat(R0, curl, 0);
    const b = assemblySeat(R0, curl, ASM.total);
    const azA = (Math.atan2(a[0], a[2]) * 180) / Math.PI;
    const azB = (Math.atan2(b[0], b[2]) * 180) / Math.PI;
    expect(Math.abs(azA)).toBeCloseTo(ASM.camCounterAz, 6);
    expect(Math.sign(azA)).toBe(curl);   // the camera turns against the bow
    expect(azB).toBeCloseTo(0, 9);
  });

  it('pulls in monotonically, so the drift never backs up', () => {
    let prev = Infinity;
    for (let t = 0; t <= ASM.total; t += 0.05) {
      const p = assemblySeat(R0, 1, t);
      const d = dist(p[0], p[1], p[2]);
      expect(d).toBeLessThanOrEqual(prev + 1e-6);
      prev = d;
    }
    expect(prev / R0).toBeCloseTo(1.5, 3);
  });
});

describe('assembly: the frame actually reaches the screen', () => {
  it('the fog range covers the spawn shell at t = 0 and is the settled one at 5.2', () => {
    const restNear = rawMax * 0.6;
    const restFar = rawMax * 3.0;
    const out = [0, 0];

    // Every spawn has to sit inside the fog's far edge from the opening seat,
    // or the first painted frame is a black screen with 153 correctly placed,
    // correctly scaled, completely invisible instances. It was: 40 pixels above
    // 12/255 in a 1440x900 shot before this was fixed.
    const seat = assemblySeat(R0, plan.curlSign, 0);
    let worst = 0;
    for (let i = 0; i < N; i++) {
      worst = Math.max(worst, dist(
        plan.spawn[i * 3] - seat[0],
        plan.spawn[i * 3 + 1] - seat[1],
        plan.spawn[i * 3 + 2] - seat[2],
      ));
    }
    fogRangeAt(rawMax, 0, restNear, restFar, out);
    expect(out[1]).toBeGreaterThan(worst);
    expect(out[0]).toBeGreaterThan(restNear);

    // ...and it hands back the exact settled range on the frame beat 1 opens,
    // so the film is byte-identical to what it was before this wave.
    fogRangeAt(rawMax, ASM.total, restNear, restFar, out);
    expect(out[0]).toBe(restNear);
    expect(out[1]).toBe(restFar);

    // Monotone in between, and held wide until the giants are nearly down.
    fogRangeAt(rawMax, ASM.fogHold, restNear, restFar, out);
    expect(out[1]).toBe(rawMax * ASM.fogFar0);
    let prev = Infinity;
    for (let t = 0; t <= ASM.total; t += 0.05) {
      fogRangeAt(rawMax, t, restNear, restFar, out);
      expect(out[1]).toBeLessThanOrEqual(prev + 1e-6);
      prev = out[1];
    }
  });

  it('the camera far plane (8 R0) clears the worst spawn, on both viewports', () => {
    for (const camDist of [R0, R0_MOBILE]) {
      const p = makePlan(diseases, catPos, camDist);
      const seat = assemblySeat(camDist, p.curlSign, 0);
      let worst = 0;
      for (let i = 0; i < N; i++) {
        worst = Math.max(worst, dist(
          p.spawn[i * 3] - seat[0], p.spawn[i * 3 + 1] - seat[1], p.spawn[i * 3 + 2] - seat[2],
        ));
      }
      // App.jsx's `far: camDist * 8`. At the old 4 R0, fifty-two instances
      // began beat 0 hard-clipped and popped into existence as they crossed it.
      expect(worst).toBeLessThan(camDist * 8);
      expect(worst).toBeGreaterThan(camDist * 4); // ...which is why 4 was not enough
    }
  });
});
