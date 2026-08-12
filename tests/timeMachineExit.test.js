// The ending restage (ADDENDUM 1 section 1): the opening sequence ends at the
// home screen. Everything here is the pure half of that — the choreography
// table, the moment the exit opens on the tour's own clock, the two radius
// blends' endpoint invariant, and the second handover's decay — so the parts
// the delta list calls acceptance are unit tests rather than stopwatch work.
import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildTimeMachineData } from '../src/utils/timeMachineData';
import {
  TM_EXIT, TM_EXIT_FAST, TM_EXIT_REDUCED, TM_ENTER_DUR,
  exitDelay, staggeredArrival, lagFactor,
} from '../src/utils/motion';
import {
  buildTourTimeline, finaleExitAt, FINALE_HOLD, FINALE_SPLIT, EXIT_PAD_DB,
} from '../src/components/TimeMachine';
import {
  easeGlide, sramp, REST_ROTATE_SPEED, HANDOVER_LEAD, HANDOVER_DECAY,
} from '../src/components/OvertureSequence';
import { computeLagFactors, morphRadiusAt } from '../src/components/DiseaseNodes';
import { dbToGain } from '../src/audio/engine';

const data = buildTimeMachineData(diseases);
const tl = buildTourTimeline(data, data.nYears - 1);

describe('the exit choreography table (ADDENDUM 1 section 1)', () => {
  it('carries the addendum\'s offsets, to the millisecond', () => {
    expect(TM_EXIT.caption).toEqual({ at: 0, dur: 200 });
    expect(TM_EXIT.isolation).toEqual({ at: 0, dur: 480 });
    expect(TM_EXIT.sound).toEqual({ at: 0 });
    expect(TM_EXIT.rail).toEqual({ at: 100, dur: 240 });
    expect(TM_EXIT.radius).toEqual({ at: 150, dur: 1100 });
    expect(TM_EXIT.camera).toEqual({ at: 150, dur: 1600 });
    expect(TM_EXIT.grade).toEqual({ at: 1250 });
    expect(TM_EXIT.chrome).toEqual({ at: 1300 });
    expect(TM_EXIT.hints).toEqual({ at: 1600 });
    expect(TM_EXIT.header).toEqual({ at: 1750, dur: 1400, line: 2600, lineOut: 200 });
  });

  it('totals 2.60 s, and every channel opens inside it', () => {
    expect(TM_EXIT.total).toBe(2600);
    for (const ch of Object.values(TM_EXIT)) {
      if (typeof ch !== 'object') continue;
      expect(ch.at).toBeGreaterThanOrEqual(0);
      expect(ch.at).toBeLessThanOrEqual(TM_EXIT.total);
    }
  });

  it('the radius blend is 1.10 s (was 0.40) and the entry blend its 650 ms mirror', () => {
    expect(TM_EXIT.radius.dur).toBe(1100);
    expect(TM_ENTER_DUR).toBe(650);
    // Amendment A3 adds both to the over-700 ms exemption; nothing else in the
    // exit is allowed past it except the camera beat.
    const over700 = Object.entries(TM_EXIT)
      .filter(([, ch]) => typeof ch === 'object' && ch.dur > 700)
      .map(([k]) => k)
      .sort();
    expect(over700).toEqual(['camera', 'header', 'radius']);
  });

  it('the skip is 240 ms and reduced motion is three 300 ms dissolves', () => {
    expect(TM_EXIT_FAST).toBe(240);
    expect(TM_EXIT_REDUCED).toBe(300);
  });

  it('reuses moment 3\'s pad at -4 dB, a real trim rather than a nominal one', () => {
    expect(EXIT_PAD_DB).toBe(-4);
    expect(dbToGain(EXIT_PAD_DB)).toBeCloseTo(0.631, 3);
    expect(dbToGain(EXIT_PAD_DB)).toBeLessThan(1);
  });
});

describe('exitDelay (staged channels against the live clock)', () => {
  it('is zero when no exit is running', () => {
    expect(exitDelay(0, TM_EXIT.hints.at, 5000)).toBe(0);
  });

  it('counts down to a channel\'s moment and then stays at zero', () => {
    expect(exitDelay(1000, 1600, 1000)).toBe(1600);
    expect(exitDelay(1000, 1600, 1600)).toBe(1000);
    expect(exitDelay(1000, 1600, 2600)).toBe(0);
    // The property that matters: a re-render after the moment must not
    // reintroduce the delay and make the row vanish again.
    expect(exitDelay(1000, 1600, 9999)).toBe(0);
  });

  it('collapses every channel to zero once the skip re-seats the clock', () => {
    const now = 10000;
    const skewed = now - TM_EXIT.total;
    for (const ch of Object.values(TM_EXIT)) {
      if (typeof ch !== 'object') continue;
      expect(exitDelay(skewed, ch.at, now)).toBe(0);
    }
  });
});

describe('the exit opens where the addendum says it does', () => {
  it('fires FINALE_HOLD after the flatline cue', () => {
    const lastPause = tl.pauseAt[tl.pauses.length - 1];
    const flatline = lastPause + FINALE_SPLIT;
    expect(finaleExitAt(tl)).toBeCloseTo(flatline + FINALE_HOLD, 6);
    expect(FINALE_HOLD).toBe(2.6);
  });

  it('is the flatline cue the timeline actually carries, not an assumed one', () => {
    const flat = tl.cues.filter((c) => c.kind === 'caption' && c.caption === 'flatline');
    expect(flat).toHaveLength(1);
    expect(finaleExitAt(tl)).toBeCloseTo(flat[0].t + FINALE_HOLD, 6);
  });

  it('never runs past the tour\'s own end, on any span the data file carries', () => {
    expect(finaleExitAt(tl)).toBeLessThanOrEqual(tl.end);
    // A decade-only fallback file: a shorter board must still exit.
    const short = buildTimeMachineData(
      diseases.map((d) => ({ ...d, yearStart: 2015, yearlyPapers: d.yearlyPapers.slice(-10) }))
    );
    const shortTl = buildTourTimeline(short, short.nYears - 1);
    const at = finaleExitAt(shortTl);
    expect(at).not.toBeNull();
    expect(at).toBeLessThanOrEqual(shortTl.end);
    expect(at).toBeGreaterThan(0);
  });

  it('leaves the finale hold room to play before it opens', () => {
    // The closing shot is the point; the exit must not cut into the flatline
    // caption's own reading time.
    const lastPause = tl.pauseAt[tl.pauses.length - 1];
    expect(finaleExitAt(tl) - lastPause).toBeGreaterThanOrEqual(FINALE_SPLIT);
  });
});

// ─── Delta-list item 8: "no frame during the blend shows a radius outside the
// two endpoints." The blend both directions share is reproduced here exactly
// as TimeMachine.radiusAt computes it.
const blend = (from, to, progress, L) => from + (to - from) * staggeredArrival(progress, L);

describe('the entry and exit radius blends (delta-list item 8)', () => {
  const lag = computeLagFactors(diseases);

  it('never leaves its two endpoints, for any node at any progress', () => {
    for (let i = 0; i < diseases.length; i++) {
      const tmR = data.radii[(data.nYears - 1) * diseases.length + i];
      const normalR = morphRadiusAt(diseases[i], 0, 1);
      const lo = Math.min(tmR, normalR);
      const hi = Math.max(tmR, normalR);
      for (let k = 0; k <= 40; k++) {
        const p = k / 40;
        const out = blend(tmR, normalR, p, lag[i]);
        const back = blend(normalR, tmR, p, lag[i]);
        expect(out).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(out).toBeLessThanOrEqual(hi + 1e-9);
        expect(back).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(back).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it('lands exactly on the settled mapping, so the blend leaves no residue', () => {
    for (let i = 0; i < diseases.length; i++) {
      const tmR = data.radii[(data.nYears - 1) * diseases.length + i];
      const normalR = morphRadiusAt(diseases[i], 0, 1);
      expect(blend(tmR, normalR, 1, lag[i])).toBe(normalR);
      expect(blend(tmR, normalR, 0, lag[i])).toBe(tmR);
      expect(blend(normalR, tmR, 1, lag[i])).toBe(tmR);
      expect(blend(normalR, tmR, 0, lag[i])).toBe(normalR);
    }
  });

  it('is monotone per node, so nothing rebounds on its way home', () => {
    for (let i = 0; i < diseases.length; i += 7) {
      const tmR = data.radii[(data.nYears - 1) * diseases.length + i];
      const normalR = morphRadiusAt(diseases[i], 0, 1);
      if (Math.abs(tmR - normalR) < 1e-6) continue;
      const rising = normalR > tmR;
      let prev = blend(tmR, normalR, 0, lag[i]);
      for (let k = 1; k <= 60; k++) {
        const cur = blend(tmR, normalR, k / 60, lag[i]);
        if (rising) expect(cur).toBeGreaterThanOrEqual(prev - 1e-12);
        else expect(cur).toBeLessThanOrEqual(prev + 1e-12);
        prev = cur;
      }
    }
  });

  it('gives the giants the longest trip home', () => {
    // The lag table is the morph's own, so "giants landing last" is a property
    // of the data rather than a hand-picked constant.
    let biggest = 0;
    for (let i = 1; i < lag.length; i++) if (lag[i] > lag[biggest]) biggest = i;
    let smallest = 0;
    for (let i = 1; i < lag.length; i++) if (lag[i] < lag[smallest]) smallest = i;
    expect(lag[biggest]).toBeCloseTo(1, 6);
    expect(lag[smallest]).toBeLessThan(1);
    expect(staggeredArrival(0.5, lag[smallest])).toBeGreaterThan(staggeredArrival(0.5, lag[biggest]));
  });

  it('lagFactor stays inside its documented band for every disease', () => {
    // Float32Array: the floor round-trips as 0.34999999404, so the band is
    // asserted with a float32 epsilon rather than at exact double precision.
    for (let i = 0; i < lag.length; i++) {
      expect(lag[i]).toBeGreaterThanOrEqual(0.35 - 1e-7);
      expect(lag[i]).toBeLessThanOrEqual(1);
    }
    expect(lagFactor(0, 0)).toBe(1);
  });
});

// ─── Delta-list item 5: "the second handover is as good as the first."
describe('the second velocity-matched handover (delta-list item 5)', () => {
  // The exit's glide segment, in exactly the shape TimeMachine builds it: the
  // film's own easeGlide from wherever the finale left the camera to SEAT.rest.
  const seg = { t0: 0.15, t1: 0.15 + TM_EXIT.camera.dur / 1000, ease: easeGlide };

  it('runs the film\'s own glide curve, arriving with a residual rate', () => {
    expect(seg.ease(0)).toBeCloseTo(0, 12);
    expect(seg.ease(1)).toBeCloseTo(1, 12);
    // RESIDUAL 0.22: the glide decelerates but does not stop, which is the
    // whole reason there is a velocity to hand over at all.
    const tail = seg.ease(1) - seg.ease(1 - 1e-4);
    const mean = 1;
    expect(tail / 1e-4).toBeCloseTo(0.22 * mean, 3);
  });

  it('arms in the last 300 ms of the glide and decays over 1.0 s', () => {
    expect(HANDOVER_LEAD).toBe(0.3);
    expect(HANDOVER_DECAY).toBe(1.0);
    expect(REST_ROTATE_SPEED).toBe(0.3);
    const armAt = seg.t1 - HANDOVER_LEAD;
    expect(armAt).toBeCloseTo(1.45, 6);
    // The exit's camera beat ends at 1.75 s, inside the 2.60 s exit, so the
    // handover is armed and its decay is under way before the exit lands.
    expect(seg.t1).toBeCloseTo(1.75, 6);
    expect(seg.t1).toBeLessThan(TM_EXIT.total / 1000);
  });

  it('holds the glide\'s terminal rate to the end of the glide, then eases to 0.3', () => {
    const base = 1.9; // any terminal rate; the curve is what is under test
    const speedAt = (t) => (t <= seg.t1
      ? base
      : REST_ROTATE_SPEED + (base - REST_ROTATE_SPEED) * (1 - sramp(t, seg.t1, seg.t1 + HANDOVER_DECAY)));
    expect(speedAt(seg.t1 - 0.1)).toBe(base);
    expect(speedAt(seg.t1)).toBe(base);
    expect(speedAt(seg.t1 + HANDOVER_DECAY)).toBeCloseTo(REST_ROTATE_SPEED, 9);
    // Monotone all the way down: no dead frame, no bounce back up.
    let prev = Infinity;
    for (let k = 0; k <= 100; k++) {
      const v = speedAt(seg.t1 + (k / 100) * HANDOVER_DECAY);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      expect(v).toBeGreaterThanOrEqual(REST_ROTATE_SPEED - 1e-12);
      prev = v;
    }
  });
});
