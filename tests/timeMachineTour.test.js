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
