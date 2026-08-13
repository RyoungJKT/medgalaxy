import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildTimeMachineData } from '../src/utils/timeMachineData';
import {
  TOUR_HOLDS,
  buildTourPauses,
  buildTourTimeline,
  tourYearAt,
  tourRateAt,
  scrubRate,
  buildTourCaptions,
  midSentence,
  HIV_SURGE_SEAT,
  HIV_FADE_SEAT,
  DETONATION_SEAT,
  layoutRadius,
  tourPreempted,
  tourGate,
} from '../src/components/TimeMachine';
import { ACCENT_MAX_RATE } from '../src/utils/timeMachineData';
import { captionNames } from '../src/utils/captions';

const idMap = Object.fromEntries(diseases.map((d, i) => [d.id, i]));
const data = buildTimeMachineData(diseases);
const caps = buildTourCaptions(diseases, idMap, data);

const hiv = diseases[idMap['hiv-aids']];
const covid = diseases[idMap['covid-19']];
const rhd = diseases[idMap['rheumatic-heart-disease']];
const at = (d, year) => d.yearlyPapers[year - d.yearStart];

// Every caption string a viewer can read, flattened for the copy-rule checks.
function allStrings(c) {
  const out = [];
  for (const key of Object.keys(c)) {
    const cap = typeof c[key] === 'function' ? c[key]() : c[key];
    if (!cap) continue;
    if (cap.lines) out.push(...cap.lines);
    if (cap.data) out.push(cap.data);
    if (cap.micro) out.push(cap.micro);
  }
  return out;
}

describe('buildTourPauses', () => {
  it('lays out the six pauses of the 1990-2024 board with the boarded holds', () => {
    const pauses = buildTourPauses(data);
    expect(pauses.map((p) => p.year)).toEqual([1990, 1996, 2019, 2020, 2021, 2024]);
    expect(pauses.map((p) => p.hold)).toEqual(TOUR_HOLDS);
    expect(pauses.map((p) => p.kind)).toEqual([
      'rules', 'hivSurge', 'hivFade', 'detonation', 'peak', 'finale',
    ]);
    expect(pauses.map((p) => p.yearIdx)).toEqual([0, 6, 29, 30, 31, 34]);
  });

  it('collapses to the years a shorter file actually has, strictly increasing, finale last', () => {
    const decade = { yearStart: 2015, nYears: 10 };
    const pauses = buildTourPauses(decade);
    expect(pauses[0].year).toBe(2015);
    expect(pauses[pauses.length - 1].year).toBe(2024);
    expect(pauses[pauses.length - 1].kind).toBe('finale');
    for (let i = 1; i < pauses.length; i++) {
      expect(pauses[i].year).toBeGreaterThan(pauses[i - 1].year);
    }
    for (const p of pauses) {
      expect(p.year).toBeGreaterThanOrEqual(2015);
      expect(p.year).toBeLessThanOrEqual(2024);
    }
  });
});

describe('buildTourTimeline', () => {
  const tl = buildTourTimeline(data, data.nYears - 1);

  it('opens by rewinding from where the galaxy stands to the first pause', () => {
    expect(tl.segs[0].t0).toBe(0);
    expect(tl.segs[0].from).toBe(data.nYears - 1);
    expect(tl.segs[0].to).toBe(0);
  });

  it('keeps the single-year legs at 650 ms and every other year at 360', () => {
    // 2019 -> 2020 and 2020 -> 2021 are single-year legs: the sanctioned 650 ms.
    const single = tl.segs.filter((s) => s.kind === 'single');
    expect(single).toHaveLength(2);
    for (const s of single) expect(s.t1 - s.t0).toBeCloseTo(0.65, 6);
    // Every stair is 240 ms of travel inside a 360 ms year.
    const stairs = tl.segs.filter((s) => s.kind === 'stair');
    expect(stairs.length).toBeGreaterThan(0);
    for (const s of stairs) {
      expect(s.t1 - s.t0).toBeCloseTo(0.24, 6);
      expect(Math.abs(s.to - s.from)).toBe(1);
    }
    // Nothing runs longer than the rewind and the sweep, the two 1.30 s beats
    // amendment A3 exempts.
    for (const s of tl.segs) expect(s.t1 - s.t0).toBeLessThanOrEqual(1.30 + 1e-6);
  });

  it('gives the detonation the tour only overshoot', () => {
    const det = tl.segs.find((s) => s.from === 29 && s.to === 30);
    expect(det).toBeTruthy();
    let peak = 0;
    for (let p = 0; p <= 1; p += 0.01) peak = Math.max(peak, det.ease(p));
    expect(peak).toBeGreaterThan(1.0);   // overshoots past 2020
    expect(peak).toBeLessThan(1.12);     // back.out(1.2), not a bounce
    expect(det.ease(1)).toBeCloseTo(1, 6);
    // Every other leg lands without overshoot.
    for (const s of tl.segs) {
      if (s === det) continue;
      for (let p = 0; p <= 1; p += 0.05) expect(s.ease(p)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('parks exactly on each pause year for that pause hold', () => {
    tl.pauses.forEach((p, i) => {
      const t = tl.pauseAt[i];
      expect(tourYearAt(tl.segs, t)).toBeCloseTo(p.yearIdx, 6);
      expect(tourYearAt(tl.segs, t + p.hold * 0.5)).toBeCloseTo(p.yearIdx, 6);
    });
    expect(tourYearAt(tl.segs, tl.end)).toBeCloseTo(data.nYears - 1, 6);
    expect(tourYearAt(tl.segs, 0)).toBeCloseTo(data.nYears - 1, 6);
  });

  it('fires one shockwave, one focus and one caption per pause, in time order', () => {
    const kinds = tl.cues.map((c) => c.kind);
    expect(kinds.filter((k) => k === 'shockwave')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'focus').length).toBe(1);
    const captions = tl.cues.filter((c) => c.kind === 'caption');
    const clears = captions.filter((c) => c.caption == null);
    // One card per pause, plus the finale's flatline swap, plus one hand-back
    // for each leg long enough to sweep (round-5 gate: the 1996 card used to
    // ride the whole 23-year run to 2019 while the numeral rolled under it).
    expect(captions.length - clears.length).toBe(tl.pauses.length + 1);
    for (let i = 1; i < tl.cues.length; i++) {
      expect(tl.cues[i].t).toBeGreaterThanOrEqual(tl.cues[i - 1].t);
    }
    const shock = tl.cues.find((c) => c.kind === 'shockwave');
    expect(shock.t).toBeCloseTo(tl.pauseAt[3], 6); // lands with 2020
    expect(shock.effect).toBe(true);
  });

  // Review gate round 2, P2 #7: the peak pause must undo the tour's compounded
  // push-ins, or "Attention can move this fast." plays over a frame where
  // heart disease is the biggest thing on screen.
  it('recenters on COVID-19 at the 2021 peak, at the designed distance', () => {
    const peakIdx = tl.pauses.findIndex((p) => p.kind === 'peak');
    expect(peakIdx).toBeGreaterThan(0);
    const cue = tl.cues.find(
      (c) => c.kind === 'camera-node' && Math.abs(c.t - tl.pauseAt[peakIdx]) < 1e-6
    );
    expect(cue).toBeTruthy();
    expect(cue.node).toBe('covid-19');
    // No factor: the fly-home branch, not a relative pull off the current seat.
    expect(cue.factor).toBeUndefined();
  });

  it('makes COVID-19 the biggest node of the peak year it recenters on', () => {
    const peak = tl.pauses.find((p) => p.kind === 'peak');
    const year = peak.year;
    const covidCount = at(covid, year);
    for (const d of diseases) {
      if (d.id === 'covid-19') continue;
      const v = d.yearlyPapers[year - d.yearStart] || 0;
      expect(v).toBeLessThan(covidCount);
    }
  });
});

// ─── ADDENDUM 1 section 2.4, acceptance 9 ────────────────────────────────────
// The tour ratchets instead of lerping. Asserted on the built timeline, not
// observed: "the 1996 to 2019 leg is a 1.30 s sweep followed by six 360 ms
// stairs" is a property of the data structure or it is nothing.
describe('the staircase (addendum 1 section 2.2)', () => {
  const tl = buildTourTimeline(data, data.nYears - 1);

  it('runs the whole tour in 31.0 s or less', () => {
    expect(tl.end).toBeLessThanOrEqual(31.0);
    // The boarded total: 1.30 rewind + 2.16 + 3.46 + 0.65 + 0.65 + 1.08 legs
    // + 21.00 of holds, against the shipped 33.35.
    expect(tl.end).toBeCloseTo(30.30, 6);
    expect(tl.pauses.reduce((a, p) => a + p.hold, 0)).toBeCloseTo(21.0, 6);
  });

  it('holds every intermediate year of a non-swept leg for at least 120 ms', () => {
    const stairs = tl.segs.filter((s) => s.kind === 'stair');
    expect(stairs.length).toBe(6 + 6 + 3); // 1990->1996, the 1996->2019 tail, 2021->2024
    for (let i = 0; i < tl.segs.length - 1; i++) {
      if (tl.segs[i].kind !== 'stair') continue;
      // The dwell is the gap to whatever comes next: another stair, or the
      // pause hold at the end of the leg.
      const gap = tl.segs[i + 1].t0 - tl.segs[i].t1;
      expect(gap, `stair landing on year ${tl.segs[i].to}`).toBeGreaterThanOrEqual(0.12 - 1e-9);
      // And the year is genuinely parked there for the whole gap, not easing.
      const mid = tl.segs[i].t1 + gap / 2;
      expect(tourYearAt(tl.segs, mid)).toBeCloseTo(tl.segs[i].to, 9);
    }
    // The last stair of the tour is followed by the finale hold, not a segment.
    const last = tl.segs[tl.segs.length - 1];
    expect(last.kind).toBe('stair');
    expect(tl.end - last.t1).toBeGreaterThanOrEqual(0.12);
  });

  it('sweeps 1996 to 2019 in 1.30 s and then ratchets its last six years', () => {
    const legStart = tl.pauseAt[1] + tl.pauses[1].hold;
    const leg = tl.segs.filter((s) => s.t0 >= legStart - 1e-9 && s.t1 <= tl.pauseAt[2] + 1e-9);
    expect(leg[0].kind).toBe('sweep');
    expect(leg[0].t1 - leg[0].t0).toBeCloseTo(1.30, 6);
    expect(leg[0].from).toBe(6);   // 1996
    expect(leg[0].to).toBe(23);    // 2013: 23 years less the six that ratchet
    expect(leg.slice(1).map((s) => s.kind)).toEqual(Array(6).fill('stair'));
    expect(leg.slice(1).map((s) => s.to)).toEqual([24, 25, 26, 27, 28, 29]);
    // 1.30 + 6 x 0.36 = 3.46, against the shipped 3.90.
    expect(tl.pauseAt[2] - legStart).toBeCloseTo(3.46, 6);
  });

  it('makes the short legs pure staircases', () => {
    // 1990 -> 1996 is six years: 2.16, against the shipped 3.90.
    expect(tl.pauseAt[1] - (tl.pauseAt[0] + tl.pauses[0].hold)).toBeCloseTo(2.16, 6);
    // 2021 -> 2024 is three: 1.08, against 1.95.
    expect(tl.pauseAt[5] - (tl.pauseAt[4] + tl.pauses[4].hold)).toBeCloseTo(1.08, 6);
  });

  it('leaves the rewind and the detonation exactly as they were', () => {
    expect(tl.segs[0].kind).toBe('rewind');
    expect(tl.segs[0].t1 - tl.segs[0].t0).toBeCloseTo(1.30, 6);
    const det = tl.segs.find((s) => s.from === 29 && s.to === 30);
    expect(det.kind).toBe('single');
    expect(det.t1 - det.t0).toBeCloseTo(0.65, 6);
  });

  it('carries a year rate on every segment, which is accent gate G2 input', () => {
    const rate = (kind) => tl.segs.find((s) => s.kind === kind).rate;
    // Suppressed: the rewind at 26.2 and the sweep at 13.1 years per second.
    expect(rate('rewind')).toBeGreaterThan(ACCENT_MAX_RATE);
    expect(rate('sweep')).toBeGreaterThan(ACCENT_MAX_RATE);
    expect(rate('rewind')).toBeCloseTo(34 / 1.3, 6);
    expect(rate('sweep')).toBeCloseTo(17 / 1.3, 6);
    // Passed: every stair at 2.78 and every single-year leg at 1.54.
    expect(rate('stair')).toBeCloseTo(1 / 0.36, 6);
    expect(rate('single')).toBeCloseTo(1 / 0.65, 6);
    expect(rate('stair')).toBeLessThan(ACCENT_MAX_RATE);
    expect(rate('single')).toBeLessThan(ACCENT_MAX_RATE);
  });

  it('reads zero rate in every dwell and every hold, so accents fire at rest', () => {
    for (const t of tl.pauseAt) expect(tourRateAt(tl.segs, t + 0.5)).toBe(0);
    const stair = tl.segs.find((s) => s.kind === 'stair');
    expect(tourRateAt(tl.segs, stair.t0 + 0.1)).toBeCloseTo(1 / 0.36, 6);
    expect(tourRateAt(tl.segs, stair.t1 + 0.06)).toBe(0);
    // Before the first segment and after the last, nothing is travelling.
    expect(tourRateAt(tl.segs, -1)).toBe(0);
    expect(tourRateAt(tl.segs, tl.end)).toBe(0);
  });
});

describe('leg choreography (addendum 1 section 4 item 3)', () => {
  const tl = buildTourTimeline(data, data.nYears - 1);
  const legs = tl.cues.filter((c) => c.kind === 'camera-leg');

  it('puts a truck and a dolly under every staircase, and under every sweep', () => {
    // Three multi-year legs (1990-1996, 1996-2019, 2021-2024) contribute a
    // staircase cue each; the long one contributes a sweep cue as well.
    expect(legs.length).toBe(4);
    const sweeps = legs.filter((c) => c.deg === 9.0);
    const stairs = legs.filter((c) => c.deg === 4.0);
    expect(sweeps.length).toBe(1);
    expect(stairs.length).toBe(3);
    expect(sweeps[0].dolly).toBe(0.06);
    expect(stairs.every((c) => c.dolly === 0.03)).toBe(true);
  });

  it('leaves the single-year legs alone: the detonation is its own gesture', () => {
    // 2019->2020 and 2020->2021 are 650 ms legs with the detonation push-in and
    // its weight already on them. Nothing here may sit on top of that.
    const singles = tl.segs.filter((s) => s.kind === 'single');
    expect(singles.length).toBe(2);
    for (const sg of singles) {
      expect(legs.some((c) => Math.abs(c.t - sg.t0) < 1e-9)).toBe(false);
    }
  });

  it('opens each leg move on the frame the leg opens, and lands it on the pause', () => {
    for (const c of legs) {
      // Every leg cue coincides with the start of a travel segment.
      expect(tl.segs.some((s) => Math.abs(s.t0 - c.t) < 1e-9)).toBe(true);
      expect(c.dur).toBeGreaterThan(0);
    }
    // The long leg: 1.30 s of sweep, then the six stairs, and the two cues
    // tile the leg exactly, so the dolly is released at the pause and nowhere
    // else.
    const legStart = tl.pauseAt[1] + tl.pauses[1].hold;
    const onLeg = legs.filter((c) => c.t >= legStart - 1e-9 && c.t < tl.pauseAt[2]);
    expect(onLeg.length).toBe(2);
    expect(onLeg[0].deg).toBe(9.0);
    expect(onLeg[0].dur).toBeCloseTo(1.30, 6);
    expect(onLeg[1].t).toBeCloseTo(legStart + 1.30, 6);
    expect(onLeg[1].deg).toBe(4.0);
    expect(onLeg[0].dur + onLeg[1].dur).toBeCloseTo(tl.pauseAt[2] - legStart, 6);
  });

  it('never lands a leg move on top of a pause cue: the pause cue is always later', () => {
    for (const c of legs) {
      const pauseCues = tl.cues.filter(
        (x) => (x.kind === 'camera-node' || x.kind === 'camera-home') && Math.abs(x.t - c.t) < 1e-9,
      );
      expect(pauseCues.length).toBe(0);
    }
    // ...and every pause that re-frames does so after its leg's move began.
    for (const pi of [1, 2, 4, 5]) {
      const cam = tl.cues.find(
        (x) => (x.kind === 'camera-node' || x.kind === 'camera-home') &&
          Math.abs(x.t - tl.pauseAt[pi]) < 1e-9,
      );
      expect(cam, `pause ${pi} keeps its own camera cue`).toBeTruthy();
    }
  });

  it('adds no time to the tour: the choreography is a camera channel, not a beat', () => {
    expect(tl.end).toBeCloseTo(30.30, 6);
  });

  it('is dropped entirely under reduced motion', () => {
    const r = buildTourTimeline(data, data.nYears - 1, true);
    expect(r.cues.filter((c) => c.kind === 'camera-leg').length).toBe(0);
  });
});

describe('the subject pauses frame their subject (round-5 gate)', () => {
  // The rule the three re-seated pauses share: a pause frames its subject from
  // OUTSIDE the layout, on the subject's own ray. That is not taste, it is the
  // only geometry in which nothing can sit between the lens and the node and
  // collect a perspective boost the data never earned. The seats are fractions
  // of the designed camDist, so none of them can inherit another's drift.
  it('drifts onto the surge, then deeper for the fade', () => {
    expect(HIV_FADE_SEAT).toBeLessThan(HIV_SURGE_SEAT);
    // ...and the detonation is a push-in: nearer than the overview the peak
    // returns to, which is camDist, itself 2.0 layout radii on a desktop.
    expect(DETONATION_SEAT).toBeLessThan(2.0);
  });

  it('keeps every seat outside the layout, which is the whole mechanism', () => {
    // The unit is the layout's own radius, so this is not a tuned clearance —
    // it is what the unit means. A seat below 1 puts the camera inside the
    // galaxy, where the nearest bystander collects a perspective boost the data
    // never earned, which is the defect all three of these were re-seated for.
    for (const seat of [HIV_SURGE_SEAT, HIV_FADE_SEAT, DETONATION_SEAT]) {
      expect(seat).toBeGreaterThan(1);
    }
  });

  it('measures the layout radius off the live positions, robustly', () => {
    expect(layoutRadius([[3, 4, 0], [1, 0, 0]])).toBeCloseTo(5, 9);
    expect(layoutRadius([[0, 0, 0]])).toBe(1);   // degenerate: never divide by it
    expect(layoutRadius([])).toBe(1);
    expect(layoutRadius(null)).toBe(1);
    expect(layoutRadius([null, [0, 0, 2]])).toBeCloseTo(2, 9);
  });

  it('puts both HIV pauses on the HIV node as designed seats, and nothing else', () => {
    const tl = buildTourTimeline(data, data.nYears - 1);
    const hivCues = tl.cues.filter((c) => c.kind === 'camera-node' && c.node === 'hiv-aids');
    expect(hivCues.length).toBe(2);
    expect(hivCues.map((c) => c.seat)).toEqual([HIV_SURGE_SEAT, HIV_FADE_SEAT]);
    expect(hivCues.every((c) => c.factor === undefined)).toBe(true);
    expect(hivCues[0].t).toBeCloseTo(tl.pauseAt[1], 9);
    expect(hivCues[1].t).toBeCloseTo(tl.pauseAt[2], 9);
  });

  it('gives the detonation a designed seat that rides the year-step', () => {
    const tl = buildTourTimeline(data, data.nYears - 1);
    const det = tl.cues.find((c) => c.kind === 'camera-node' && c.node === 'covid-19' && c.seat != null);
    expect(det.seat).toBe(DETONATION_SEAT);
    expect(det.node).toBe('covid-19');
    // Fired at the leg start, not the arrival: the move and the eruption are
    // one gesture, and the hold it lands on is a still frame.
    expect(det.t).toBeCloseTo(tl.pauseAt[3] - 0.65, 6);
    expect(det.dur).toBeCloseTo(0.65, 6);
    // No relative push-in survives anywhere on the board: that is the defect.
    expect(tl.cues.filter((c) => c.factor != null).length).toBe(0);
  });
});

describe('the long leg hands its caption back (round-5 gate)', () => {
  const tl = buildTourTimeline(data, data.nYears - 1);

  it('clears the caption at the start of the 1996-2019 leg and nowhere else', () => {
    const clears = tl.cues.filter((c) => c.kind === 'caption' && c.caption == null);
    expect(clears.length).toBe(1);
    // The leg's own start: the 1996 pause arrival plus its hold.
    expect(clears[0].t).toBeCloseTo(tl.pauseAt[1] + tl.pauses[1].hold, 6);
    // And it is the leg that sweeps, not a named year.
    expect(Math.abs(tl.pauses[2].yearIdx - tl.pauses[1].yearIdx)).toBeGreaterThan(8);
  });

  it('leaves every short leg its caption all the way across', () => {
    // The detonation's two single-year steps must read as one sentence.
    const clears = tl.cues.filter((c) => c.kind === 'caption' && c.caption == null);
    for (const c of clears) expect(c.t).toBeLessThan(tl.pauseAt[3]);
  });
});

describe('captionNames (round-5 gate: micro-label redundancy)', () => {
  it('sees the node the pause caption is already about', () => {
    expect(captionNames(caps.detonation, 'COVID-19')).toBe(true);
    expect(captionNames(caps.peak, 'COVID-19')).toBe(true);
    expect(captionNames(caps.hivSurge, 'HIV/AIDS')).toBe(true);
  });

  it('lets the label speak where the caption does not name it', () => {
    expect(captionNames(caps.rules, 'COVID-19')).toBe(false);
    expect(captionNames(caps.detonation, 'Influenza')).toBe(false);
    expect(captionNames(null, 'COVID-19')).toBe(false);
    expect(captionNames(caps.detonation, '')).toBe(false);
    // A cleared caption (the long leg) suppresses nothing, which is what gives
    // the accent its room back on the quiet staircase years.
    expect(captionNames(undefined, 'HIV/AIDS')).toBe(false);
  });

  it('reads the caption`s data line and its kicker, not just its headline', () => {
    expect(captionNames({ lines: ['nothing'], data: 'COVID-19: 289 papers' }, 'COVID-19')).toBe(true);
    expect(captionNames({ lines: ['nothing'], micro: 'COVID-19 drew more' }, 'COVID-19')).toBe(true);
  });
});

// The manual scrub's own G2 input. Nothing about drag changes: the critically
// damped 120 ms spring stays and the rail stays analog between detents; this
// only decides whether the crossing it produces is allowed an accent.
describe('scrubRate (gate G2 off the timeline)', () => {
  it('passes a deliberate step and suppresses a flick', () => {
    expect(scrubRate(0.5, 0.2)).toBeCloseTo(2, 6);     // a year every half second
    expect(scrubRate(0.5, 0.2)).toBeLessThan(ACCENT_MAX_RATE);
    expect(scrubRate(0.02, 0.2)).toBeGreaterThan(ACCENT_MAX_RATE); // 50 yr/s
  });

  it('suppresses anything whose target is more than a year and a half away', () => {
    // A drag or a flick parks the target wherever the pointer went; an arrow
    // key snaps to the neighbouring year and never exceeds one.
    expect(scrubRate(1.0, 1.0)).toBe(1);
    expect(scrubRate(1.0, 1.5)).toBe(1);
    expect(scrubRate(1.0, 1.6)).toBe(Infinity);
    expect(scrubRate(1.0, 12)).toBe(Infinity);
  });

  it('treats a zero-length step as infinitely fast rather than dividing by zero', () => {
    expect(scrubRate(0, 0)).toBe(Infinity);
    expect(scrubRate(-1, 0)).toBe(Infinity);
  });
});

describe('buildTourTimeline reduced motion', () => {
  const rtl = buildTourTimeline(data, data.nYears - 1, true);

  it('collapses every leg to a zero-duration step, no year tween', () => {
    expect(rtl.segs.length).toBeGreaterThan(0);
    for (const s of rtl.segs) expect(s.t1).toBe(s.t0);
  });

  it('still visits every pause year, in order, holding for the same durations', () => {
    // No travel time between legs: consecutive pauses are separated by
    // exactly the previous pause's hold, not hold + a leg duration.
    for (let i = 1; i < rtl.pauses.length; i++) {
      expect(rtl.pauseAt[i]).toBeCloseTo(rtl.pauseAt[i - 1] + rtl.pauses[i - 1].hold, 6);
    }
    expect(rtl.end).toBeCloseTo(
      rtl.pauseAt[rtl.pauses.length - 1] + rtl.pauses[rtl.pauses.length - 1].hold,
      6
    );
  });

  it('jumps straight to the pause year with no interpolated frame in between', () => {
    rtl.pauses.forEach((p, i) => {
      const t = rtl.pauseAt[i];
      // The instant the pause is reached, and for its whole hold, the year is
      // pinned exactly on the pause (a step function, not an eased approach).
      expect(tourYearAt(rtl.segs, t)).toBeCloseTo(p.yearIdx, 6);
      expect(tourYearAt(rtl.segs, t + p.hold * 0.5)).toBeCloseTo(p.yearIdx, 6);
      if (i > 0) {
        // A hair before this pause, the year is still the previous one — the
        // whole leg is zero-width, so there is no fractional year on screen.
        expect(tourYearAt(rtl.segs, t - 1e-6)).toBeCloseTo(rtl.pauses[i - 1].yearIdx, 4);
      }
    });
  });

  it('drops the detonation overshoot: every leg uses the same non-overshoot curve', () => {
    for (const s of rtl.segs) {
      for (let p = 0; p <= 1; p += 0.05) expect(s.ease(p)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('still fires the shockwave and camera cues, with zero-duration camera moves', () => {
    const shock = rtl.cues.find((c) => c.kind === 'shockwave');
    expect(shock).toBeTruthy();
    expect(shock.t).toBeCloseTo(rtl.pauseAt[3], 6);
    // The push-in specifically (the peak pause also flies to covid-19, but as
    // a recenter with no seat and no duration of its own).
    const detCam = rtl.cues.find(
      (c) => c.kind === 'camera-node' && c.node === 'covid-19' && c.seat != null
    );
    expect(detCam.dur).toBe(0);
  });

  it('keeps one caption per pause plus the flatline, same as the normal tour', () => {
    const captions = rtl.cues.filter((c) => c.kind === 'caption');
    const clears = captions.filter((c) => c.caption == null);
    expect(captions.length - clears.length).toBe(rtl.pauses.length + 1);
    // A zero-duration leg still hands its caption back, and the pause card that
    // follows on the same instant still wins: the clear is pushed first, and
    // the cue sort is stable.
    for (const c of clears) {
      const later = rtl.cues.filter((x) => x.kind === 'caption' && x.t === c.t && x.caption != null);
      expect(later.length).toBe(1);
      expect(rtl.cues.indexOf(later[0])).toBeGreaterThan(rtl.cues.indexOf(c));
    }
  });
});

describe('buildTourCaptions', () => {
  it('derives the rules pause from the span of the file', () => {
    expect(caps.rules.lines[0]).toBe('35 years of attention, year by year.');
  });

  it('derives the HIV surge from the file first year and 1996', () => {
    expect(at(hiv, 1990)).toBe(2659);
    expect(caps.hivSurge.data).toBe('HIV/AIDS: 2,659 papers in 1990, 4,747 in 1996.');
  });

  it('derives the HIV fade from the series own peak, not a hard-coded year', () => {
    const peakValue = Math.max(...hiv.yearlyPapers);
    const peakYear = hiv.yearStart + hiv.yearlyPapers.indexOf(peakValue);
    expect(peakYear).toBe(2014);
    expect(caps.hivFade.data).toContain('papers peaked at 7,534 in 2014');
    expect(caps.hivFade.data).toContain('630,000');
  });

  // Review gate round 3, finding 3: the caption used to pair the peak against
  // the fixed 2019 pause year, a 9.1% dip that undersells the argument. The
  // honest, stronger comparison pairs the peak against the latest year on
  // file (2024, 6,050 papers, a 19.7% decline). This pins that the fixed
  // 2019 figure is gone from the copy entirely.
  it('does not lean on the weak 2019 snapshot the fixed pause year used to cite', () => {
    expect(caps.hivFade.data).not.toContain('2019');
    expect(caps.hivFade.data).not.toContain(at(hiv, 2019).toLocaleString('en-US'));
  });

  // Review gate round 2, P3 #12: the HIV pause carries its own sparkline
  // ceiling so a series dwarfed by COVID's spike still draws its arc; the
  // finale deliberately does not, because there the flatness is the argument.
  it('gives the HIV fade its own sparkline ceiling and leaves the finale on the shared one', () => {
    expect(caps.hivFade.sparklineCeiling).toBe(Math.max(...hiv.yearlyPapers));
    expect(caps.hivFade.sparklineCeiling).toBeLessThan(data.maxYearly);
    expect(caps.flatline.sparklineCeiling).toBeUndefined();
  });

  it('lifts the HIV arc off the floor: its own ceiling gives it real vertical range', () => {
    const span = (ceiling) => {
      const lo = Math.min(...hiv.yearlyPapers) / ceiling;
      const hi = Math.max(...hiv.yearlyPapers) / ceiling;
      return hi - lo;
    };
    // Against the shared ceiling the whole 35-year series occupies a few
    // percent of the box; against its own it occupies most of it.
    expect(span(data.maxYearly)).toBeLessThan(0.06);
    expect(span(caps.hivFade.sparklineCeiling)).toBeGreaterThan(0.6);
  });

  it('derives the detonation and the peak from covid own series', () => {
    expect(caps.detonation.data).toBe('COVID-19: 289 papers in 2019, 94,633 in 2020.');
    expect(at(covid, 2021)).toBe(141958);
    expect(caps.peak.data).toBe('141,958 COVID-19 papers in 2021 alone.');
  });

  it('derives the cooling line from the last year in the file', () => {
    expect(caps.cooling.lines[0]).toBe('The surge cools: 59,634 papers in 2024.');
  });

  it('derives the flatline from rheumatic heart disease best year and toll', () => {
    expect(caps.flatline.lines[0]).toBe('Rheumatic heart disease never surged at all.');
    expect(caps.flatline.data).toBe('Its best year: 569 papers. Its toll: 373,000 deaths, every year.');
  });

  it('sums the flatline micro-line within one disease, at render time', () => {
    const sum = rhd.yearlyPapers.reduce((a, b) => a + b, 0);
    expect(sum).toBe(9905);
    expect(caps.flatline.micro).toBe(
      'COVID-19 drew more papers in 2020 than rheumatic heart disease drew in all 35 years combined (94,633 versus 9,905).'
    );
  });

  it('keeps every caption free of em dashes and section signs', () => {
    for (const s of allStrings(caps)) {
      expect(s).not.toContain('—');
      expect(s).not.toContain('§');
    }
  });

  it('starts every caption line with a capital and never shouts mid-sentence', () => {
    for (const s of allStrings(caps)) {
      expect(s[0]).toBe(s[0].toUpperCase());
      expect(s).not.toContain('Rheumatic Heart Disease never');
    }
  });
});

// The auto-tour's one-shot slot. The bug this pins (review gate F1b): arming
// the timer used to be what spent the tour, so a viewer who happened to have a
// node selected when it came due lost the narrated tour for the whole session
// without ever seeing a frame of it.
describe('tourGate: consumed vs preempted', () => {
  const free = {
    selectedNode: null, activeMode: null, spotlightActive: false, storyActive: null,
    tmPhase: 'idle', roulettePhase: 'idle', supernovaPhase: 'idle',
  };

  it('runs when the field is free', () => {
    expect(tourPreempted(free)).toBe(false);
    expect(tourGate(free, false)).toBe('run');
  });

  it('reads every takeover as a preemption, not a consumption', () => {
    const busy = [
      { ...free, selectedNode: { index: 3 } },
      { ...free, activeMode: 'velocity' },
      { ...free, spotlightActive: true },
      { ...free, storyActive: 'mismatch' },
      { ...free, tmPhase: 'scrub' },
      { ...free, roulettePhase: 'spinup' },
      { ...free, supernovaPhase: 'burst' },
    ];
    for (const s of busy) {
      expect(tourPreempted(s)).toBe(true);
      expect(tourGate(s, false)).toBe('preempted');
    }
  });

  it('does not treat a settled supernova as a takeover', () => {
    expect(tourPreempted({ ...free, supernovaPhase: 'complete' })).toBe(false);
    expect(tourGate({ ...free, supernovaPhase: 'complete' }, false)).toBe('run');
  });

  it('leaves the slot unspent after a preemption, so the tour re-arms', () => {
    // The exact session the fix is about: preempted by a selection, then the
    // viewer deselects. Nothing has consumed the tour, so it can still run.
    let consumed = false;
    const preempted = { ...free, selectedNode: { index: 3 } };
    const first = tourGate(preempted, consumed);
    expect(first).toBe('preempted');
    if (first === 'run') consumed = true;   // the caller's rule: only 'run' spends it
    expect(consumed).toBe(false);

    const second = tourGate(free, consumed);
    expect(second).toBe('run');
    if (second === 'run') consumed = true;
    expect(consumed).toBe(true);

    // ...and it is a one-shot: once spent, never again, whatever the field says.
    expect(tourGate(free, consumed)).toBe('consumed');
  });

  it('is consumed by a Time Machine the viewer opened themselves', () => {
    // startTimeMachine flips tmPhase, which is what latches `consumed` in the
    // component; the gate then refuses regardless of the field being free again.
    expect(tourGate(free, true)).toBe('consumed');
  });
});

describe('midSentence', () => {
  it('lowercases plain title-case labels', () => {
    expect(midSentence('Rheumatic Heart Disease')).toBe('rheumatic heart disease');
    expect(midSentence('Heart Disease')).toBe('heart disease');
  });

  it('leaves acronyms and coded names alone', () => {
    expect(midSentence('HIV/AIDS')).toBe('HIV/AIDS');
    expect(midSentence('COVID-19')).toBe('COVID-19');
    expect(midSentence('COPD')).toBe('COPD');
  });
});
