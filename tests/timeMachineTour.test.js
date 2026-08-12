import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildTimeMachineData } from '../src/utils/timeMachineData';
import {
  TOUR_HOLDS,
  buildTourPauses,
  buildTourTimeline,
  tourYearAt,
  buildTourCaptions,
  midSentence,
  tourPreempted,
  tourGate,
} from '../src/components/TimeMachine';

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

  it('runs 650 ms per year-step, capped so the quiet decades sweep past', () => {
    // 2019 -> 2020 and 2020 -> 2021 are single steps: the sanctioned 650 ms.
    const single = tl.segs.filter((s) => Math.abs(s.to - s.from) === 1);
    expect(single.length).toBeGreaterThanOrEqual(2);
    for (const s of single) expect(s.t1 - s.t0).toBeCloseTo(0.65, 6);
    // No leg runs longer than the 6-step cap (6 x 650 ms).
    for (const s of tl.segs) expect(s.t1 - s.t0).toBeLessThanOrEqual(3.9 + 1e-6);
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
    expect(kinds.filter((k) => k === 'caption').length).toBe(tl.pauses.length + 1); // + the flatline
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
    // a recenter with no factor and no duration of its own).
    const detCam = rtl.cues.find(
      (c) => c.kind === 'camera-node' && c.node === 'covid-19' && c.factor != null
    );
    expect(detCam.dur).toBe(0);
  });

  it('keeps one caption per pause plus the flatline, same as the normal tour', () => {
    const captionCount = rtl.cues.filter((c) => c.kind === 'caption').length;
    expect(captionCount).toBe(rtl.pauses.length + 1);
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
    expect(caps.hivFade.data).toContain('7,534 papers at its 2014 peak');
    expect(caps.hivFade.data).toContain(`${at(hiv, 2019).toLocaleString('en-US')} in 2019`);
    expect(caps.hivFade.data).toContain('630,000');
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
