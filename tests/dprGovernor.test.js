import { describe, it, expect } from 'vitest';
import { createRestGovernor } from '../src/utils/dprGovernor';

// ─── The resting DPR is measured, not assumed ───────────────────────────────
// REST_DPR 1.5 reaches every Retina viewer in the HIGH tier, and the only
// machine it was ever measured on is an M2 Max holding 120 fps. There is no
// second device to measure, so the guard is a runtime one: the governor
// watches frame time while the scene is genuinely at rest and steps the
// resting value down when the machine cannot hold the budget. It only ever
// steps down, and only on sustained evidence.

// One window's worth of frames at a fixed frame time, plus a little, so a
// window always closes inside the call whatever the float sum does. Returns
// the last stepped-down value sample() reported, or null if it never stepped.
const feedWindow = (g, ms, atRest = true) => {
  const n = Math.ceil(1020 / ms);
  let stepped = null;
  for (let i = 0; i < n; i++) {
    const r = g.sample(ms / 1000, atRest);
    if (r != null) stepped = r;
  }
  return stepped;
};

const OVER = 20; // 50 fps, over the 1000/55 ms budget
const UNDER = 10; // 100 fps, comfortably under it

describe('rest DPR governor', () => {
  it('starts at the resting value it was given, with a clean slate', () => {
    const g = createRestGovernor({ rest: 1.5 });
    expect(g.state()).toEqual({ rest: 1.5, strikes: 0, lastMeanMs: null });
  });

  it('steps down after three consecutive over-budget windows, not after two', () => {
    const g = createRestGovernor({ rest: 1.5 });
    expect(feedWindow(g, OVER)).toBe(null);
    expect(g.state().strikes).toBe(1);
    expect(g.state().rest).toBe(1.5);
    expect(feedWindow(g, OVER)).toBe(null);
    expect(g.state().strikes).toBe(2);
    expect(g.state().rest).toBe(1.5);
    expect(feedWindow(g, OVER)).toBe(1.25);
    expect(g.state().rest).toBe(1.25);
    expect(g.state().strikes).toBe(0);
  });

  it('records the window it measured', () => {
    const g = createRestGovernor({ rest: 1.5 });
    feedWindow(g, OVER);
    expect(g.state().lastMeanMs).toBeGreaterThan(1000 / 55);
    expect(g.state().lastMeanMs).toBeCloseTo(OVER, 1);
  });

  it('clears the strikes on an under-budget window', () => {
    const g = createRestGovernor({ rest: 1.5 });
    feedWindow(g, OVER);
    feedWindow(g, OVER);
    expect(g.state().strikes).toBe(2);
    feedWindow(g, UNDER);
    expect(g.state().strikes).toBe(0);
    expect(g.state().rest).toBe(1.5);
    // Two more over-budget windows are still only two: the run was broken.
    feedWindow(g, OVER);
    feedWindow(g, OVER);
    expect(g.state().rest).toBe(1.5);
  });

  it('counts nothing while the scene is not at rest', () => {
    const g = createRestGovernor({ rest: 1.5 });
    for (let i = 0; i < 5; i++) feedWindow(g, OVER, false);
    expect(g.state()).toEqual({ rest: 1.5, strikes: 0, lastMeanMs: null });
  });

  it('counts nothing on hitch frames, and a hitch discards the window it lands in', () => {
    const g = createRestGovernor({ rest: 1.5 });
    for (let i = 0; i < 20; i++) g.sample(0.3, true); // 0.3 s: a tab switch, not a frame
    expect(g.state()).toEqual({ rest: 1.5, strikes: 0, lastMeanMs: null });
    // Half a window over budget, one hitch, then the other half: no window closes.
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    g.sample(0.4, true);
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    expect(g.state().strikes).toBe(0);
    expect(g.state().lastMeanMs).toBe(null);
  });

  it('a frame at rest with a false atRest also discards the window', () => {
    const g = createRestGovernor({ rest: 1.5 });
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    g.sample(OVER / 1000, false);
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    expect(g.state().strikes).toBe(0);
  });

  it('never steps below the floor', () => {
    const g = createRestGovernor({ rest: 1.5 });
    for (let i = 0; i < 12; i++) feedWindow(g, OVER);
    expect(g.state().rest).toBe(1);
  });

  it('never steps back up once the budget recovers', () => {
    const g = createRestGovernor({ rest: 1.5 });
    feedWindow(g, OVER);
    feedWindow(g, OVER);
    feedWindow(g, OVER);
    expect(g.state().rest).toBe(1.25);
    for (let i = 0; i < 20; i++) feedWindow(g, UNDER);
    expect(g.state().rest).toBe(1.25);
  });

  it('is inert once it is sitting on the floor', () => {
    const g = createRestGovernor({ rest: 1, floor: 1 });
    for (let i = 0; i < 6; i++) feedWindow(g, OVER);
    expect(g.state()).toEqual({ rest: 1, strikes: 0, lastMeanMs: null });
  });

  it('reset() discards a half-built window and the strikes with it', () => {
    const g = createRestGovernor({ rest: 1.5 });
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    g.reset();
    for (let i = 0; i < 25; i++) g.sample(OVER / 1000, true);
    expect(g.state().strikes).toBe(0);
    expect(g.state().lastMeanMs).toBe(null);

    feedWindow(g, OVER);
    feedWindow(g, OVER);
    expect(g.state().strikes).toBe(2);
    g.reset();
    expect(g.state().strikes).toBe(0);
    feedWindow(g, OVER);
    feedWindow(g, OVER);
    expect(g.state().rest).toBe(1.5);
  });

  it('honours its own thresholds', () => {
    const g = createRestGovernor({ rest: 2, floor: 1.5, budgetMs: 8, strikes: 1, step: 0.5 });
    expect(feedWindow(g, UNDER)).toBe(1.5); // 10 ms is over an 8 ms budget
    expect(g.state().rest).toBe(1.5);
    for (let i = 0; i < 4; i++) feedWindow(g, UNDER);
    expect(g.state().rest).toBe(1.5); // the floor, and inert from here
  });
});
