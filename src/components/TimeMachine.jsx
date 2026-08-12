import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import {
  buildTimeMachineData, accentPicks, ACCENT_BUDGET, ACCENT_MAX_RATE,
} from '../utils/timeMachineData';
import { fmtFull, fmtWord } from '../utils/captions';
import { fireRipple } from './SelectionRipple';
import {
  DUR, springStep, staggeredArrival, settleScale,
  TM_EXIT, TM_EXIT_FAST, TM_EXIT_REDUCED, TM_ENTER_DUR,
  TM_STAIR, TM_SETTLE, TM_SHRINK_INK, TM_MICRO, AMBIENT,
} from '../utils/motion';
import { TIER } from '../utils/tiers';
import { CC } from '../utils/constants';
import { fireGhosts, clearGhosts } from './GhostShells';
import { showMoverLabel, hideMoverLabel } from './ui/MoverLabel';
import { morphRadiusAt, computeLagFactors } from './DiseaseNodes';
// The exit's camera glide is the film's release glide, literally: same seat,
// same easeGlide, same residual, same arming window and decay. "The second
// handover must be indistinguishable from the first" (ADDENDUM 1 section 1) is
// not a code convenience, it is the point, so these are imported rather than
// restated.
import {
  SEAT, seatPos, easeGlide, handoverSpeed, sramp,
  HANDOVER_LEAD, HANDOVER_DECAY, REST_ROTATE_SPEED,
} from './OvertureSequence';

// The scrub engine's critically damped spring (DIRECTION section 3, scrubber
// interaction feel: "each node follows its target through a critically
// damped spring with a 120ms time constant").
const TAU = DUR.tick / 1000;

// The 2020 detonation's white-core flash (DIRECTION section 3, pause 3):
// exactly 12 rendered frames, the same literal-frame-count technique the
// rail's own detent pip uses (TimeRail.jsx `pipFrames`).
const FLASH_FRAMES = 12;
const FLASH_COLOR = 0xfff3e0; // black-body white-hot core, DIRECTION section 1

// Exit blend duration: how long `tm.exit` takes to ramp 0->1 after the machine
// closes, mixing the last Time Machine radius toward the normal
// papers/mortality radius before DiseaseNodes stops calling radiusAt at all.
// 1.10 s, up from 0.40 (ADDENDUM 1 section 1, and amendment A3, which adds
// travel beats to the over-700 ms exemption: "node travel is world motion and
// mass takes time"). Thirty-five years collapse back into the whole record,
// giants landing last. Every close uses it, automatic or manual.
const EXIT_DUR = TM_EXIT.radius.dur / 1000;
// The mirror, for header re-entry.
const ENTER_DUR = TM_ENTER_DUR / 1000;

// ─── Tour vocabulary (DIRECTION section 3 + 4, ADDENDUM 1 section 2.2) ───────
// The tour ratchets instead of lerping. A leg used to be one continuous eased
// tween from pause year to pause year, capped at six year-steps, so every
// intermediate year was motion blur: thirty-five years went by and the eye
// never got a before and an after. Now one year is 240 ms of travel plus a
// 120 ms dwell, and the dwell is the whole point — it is a still frame at a
// real year, which is what makes the change legible.
//
//   legs of 8 years or fewer   pure staircase, 360 ms a year
//   legs longer than 8 years   1.30 s sweep of the first S-6, then 6 stairs
//   single-year legs           650 ms, unchanged (2019->2020 keeps back.out)
//   the rewind                 1.30 s, unchanged, accents suppressed
//
// Shorter and far more legible, which is the whole trade: 30.30 s against the
// shipped 33.35 s.
const STEP = TM_STAIR.single / 1000;          // 0.65, a single-year leg
const STAIR_TRAVEL = TM_STAIR.travel / 1000;  // 0.24, one stair's travel
const STAIR_YEAR = TM_STAIR.year / 1000;      // 0.36, travel plus dwell
const SWEEP = TM_STAIR.sweep / 1000;          // 1.30, the long leg's rush
const REWIND = TM_STAIR.rewind / 1000;        // 1.30
// Inside the finale hold: the cooling line reads first, then the galaxy dims
// around rheumatic heart disease and the flatline caption takes the frame.
//
// 1.9, not 1.8, and the extra 100 ms is load-bearing rather than cosmetic
// (wave 1 concern 4). The exit opens FINALE_HOLD after the flatline cue, so the
// exit's own moment is FINALE_SPLIT + FINALE_HOLD into the finale hold; at 1.8
// that was 4.4 against a 4.5 s hold, and the tour's last 100 ms ran underneath
// a choreography that had already taken the frame. At 1.9 the two coincide
// exactly: `finaleExitAt(tl) === tl.end` for any file whose finale hold is the
// boarded one, the six holds still total 21.00 s and the tour still totals
// 30.30 s. FINALE_HOLD stays the addendum's own 2.6.
export const FINALE_SPLIT = 1.9;
// The 2020 camera move: a micro push-in onto the node that detonates, 15
// percent closer, so the shockwave leaves frame center rather than a corner.
const PUSH_IN = 0.85;
// The two HIV pauses' push-ins. Exported so the tour test can assert the one
// invariant that matters about the pair: their product is unchanged from the
// shipped 0.80 x 0.62, so deepening the surge did not quietly re-frame the
// fade. See the cue site in buildTourTimeline for why they swapped.
export const HIV_SURGE_IN = 0.62;
export const HIV_FADE_IN = 0.80;
const COVID_EMBER = '#ff4d1a';
// The finale's isolation reaches the halos too: HighlightSystem can only dim
// instance colors, and an undimmed additive glow would keep 152 diseases
// burning around the one that never surged. Ramped over 480 ms, released the
// moment the focus does.
const FINALE_GLOW = 0.55;
const GLOW_RAMP = 0.48;

export const TOUR_HOLDS = [3.0, 3.5, 3.0, 4.0, 3.0, 4.5];

// How long the film's hand-off waits before the auto-tour offers itself.
const TOUR_ARM_DELAY = 1500;
// How long the finale's closing shot holds after the flatline cue before the
// exit begins (ADDENDUM 1 section 1). This replaces FINALE_HANDOVER = 2.5 and
// the "Scrub the decades." chip, which is deleted from the automatic path
// entirely: the shipped sequence ended in a permanent park, and "the fix is not
// a smaller park, it is an exit".
export const FINALE_HOLD = 2.6;

/**
 * When the exit opens, on the tour's own clock: the flatline cue plus
 * FINALE_HOLD, capped at the timeline's end so a shorter (decade-only) data
 * file whose finale hold is under FINALE_SPLIT + FINALE_HOLD still exits rather
 * than running past its last frame. Pure, so the one moment the whole ending
 * restage hangs on is a unit test rather than a stopwatch.
 * @param {object} tl a timeline from buildTourTimeline
 */
export function finaleExitAt(tl) {
  if (!tl || !tl.pauses.length) return null;
  const lastPause = tl.pauseAt[tl.pauses.length - 1];
  return Math.min(lastPause + FINALE_SPLIT + FINALE_HOLD, tl.end);
}

// The exit's sound: moment 3's release pad, reused at -4 dB against the film's
// own (ADDENDUM 1 section 1, exit table t = 0.00).
export const EXIT_PAD_DB = -4;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeExpoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeSineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
// back.out(1.2): the tour's single sanctioned overshoot, reserved for the
// detonation (DIRECTION section 4, two motion families).
const BACK_C1 = 1.2;
const BACK_C3 = BACK_C1 + 1;
const easeBackOut = (p) => 1 + BACK_C3 * Math.pow(p - 1, 3) + BACK_C1 * Math.pow(p - 1, 2);

/**
 * The tour's pause board, resolved against whatever span the data file actually
 * carries. Years outside the file are dropped and a collision with an earlier
 * pause is skipped, so a shorter (decade-only) file still produces a strictly
 * increasing board that opens on its first year and closes on its last.
 */
export function buildTourPauses(data) {
  const first = data.yearStart;
  const last = data.yearStart + data.nYears - 1;
  const spec = [
    [first, 'rules'],
    [1996, 'hivSurge'],
    [2019, 'hivFade'],
    [2020, 'detonation'],
    [2021, 'peak'],
    [last, 'finale'],
  ];
  const out = [];
  for (let i = 0; i < spec.length; i++) {
    const [year, kind] = spec[i];
    const hold = TOUR_HOLDS[i];
    if (year < first || year > last) continue;
    const prev = out[out.length - 1];
    if (prev && year <= prev.year) {
      // The closing shot always owns the last slot; anything else that lands on
      // an occupied year simply merges into it.
      if (kind === 'finale') out[out.length - 1] = { year, yearIdx: year - first, kind, hold };
      continue;
    }
    out.push({ year, yearIdx: year - first, kind, hold });
  }
  return out;
}

/**
 * One leg of the tour, appended to `segs` as a staircase (ADDENDUM 1 section
 * 2.2). Every segment carries the `kind` it belongs to and the year rate it
 * travels at, so the accent gate G2 ("suppressed whenever |d(year)/dt| exceeds
 * 4.0 years per second") is read off the timeline rather than differentiated
 * out of a noisy per-frame delta.
 *
 * The dwell is not a segment: it is the gap between one stair's `t1` and the
 * next stair's `t0`, which `tourYearAt` already resolves by holding the last
 * segment's destination. That keeps the year a step function of the clock with
 * no special case, and makes "held for at least 120 ms" a property of the
 * built timeline that a test can read.
 *
 * @returns {number} the clock time the leg ends at
 */
function pushLeg(segs, t0, from, to, reduced, detonation, cues) {
  const steps = Math.abs(to - from);
  if (steps === 0) return t0;
  if (reduced) {
    // Reduced motion: the whole leg collapses to a zero-duration step, exactly
    // as it did before the staircase existed. Rate is infinite by construction
    // and every accent is dropped anyway.
    segs.push({ t0, t1: t0, from, to, ease: easeExpoOut, kind: 'stepped', rate: Infinity });
    return t0;
  }
  if (steps === 1) {
    segs.push({
      t0, t1: t0 + STEP, from, to,
      ease: detonation ? easeBackOut : easeExpoOut,
      kind: 'single', rate: 1 / STEP,
    });
    return t0 + STEP;
  }
  const dir = to > from ? 1 : -1;
  let t = t0;
  let y = from;
  if (steps > TM_STAIR.stairCap) {
    // A rush of years, then an arrival that ticks.
    const swept = steps - TM_STAIR.sweepTail;
    const mid = from + dir * swept;
    // ADDENDUM 1 section 4 item 3: the sweep gets the bigger move (9 degrees of
    // truck, 6 percent of dolly) so the fast-forward has motion under it rather
    // than being a pure numeral change.
    if (cues) cues.push({ t, kind: 'camera-leg', deg: AMBIENT.leg.sweepDeg, dolly: AMBIENT.leg.sweepDolly, dur: SWEEP });
    segs.push({ t0: t, t1: t + SWEEP, from, to: mid, ease: easeSineInOut, kind: 'sweep', rate: swept / SWEEP });
    t += SWEEP;
    y = mid;
  }
  // The staircase's own move: 4 degrees of truck and 3 percent of dolly across
  // the whole run of stairs, both sine.inOut, released at the pause (the
  // pause's own camera cue fires on the frame the last stair lands and
  // overwrites this tween, which is what "the existing per-pause cues are
  // unchanged and still win" means in code).
  const stairT0 = t;
  while (y !== to) {
    const next = y + dir;
    segs.push({ t0: t, t1: t + STAIR_TRAVEL, from: y, to: next, ease: easeExpoOut, kind: 'stair', rate: 1 / STAIR_YEAR });
    t += STAIR_YEAR; // travel, then the dwell that makes the year legible
    y = next;
  }
  if (cues && t > stairT0) {
    cues.push({ t: stairT0, kind: 'camera-leg', deg: AMBIENT.leg.stairDeg, dolly: AMBIENT.leg.stairDolly, dur: t - stairT0 });
  }
  return t;
}

/**
 * The year rate the tour is travelling at, in years per second, at time `t`:
 * the rate of the segment `t` falls inside, and zero in a dwell or a hold. This
 * is accent gate G2's input. Deliberately the segment's own average rate rather
 * than the instantaneous derivative of its easing: expo.out opens at an
 * enormous slope for a millisecond and closes at nearly zero, and gating on
 * that would suppress the first frame of every stair and pass the last frame of
 * the rewind. The addendum's own numbers are segment rates (staircase 2.78,
 * sweep 13.1, rewind 26.2, single-year leg 1.54).
 */
export function tourRateAt(segs, t) {
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (t < sg.t0) return 0;
    if (t <= sg.t1) return sg.t1 > sg.t0 ? sg.rate : Infinity;
  }
  return 0;
}

/**
 * Builds the whole tour as data: travel segments (pure functions of time) plus
 * discrete cues fired once as the clock crosses them. Same split the overture
 * uses, and for the same reason: the harness can seek any pause and get exactly
 * the frame the board describes.
 * @param {object} data the Time Machine radius table (nYears/yearStart)
 * @param {number} startYearIdx where the galaxy stands when the tour opens
 * @param {boolean} [reduced] prefers-reduced-motion: every leg collapses to a
 *   zero-duration step (a hold-to-hold jump, no year tween) and the
 *   detonation's back.out overshoot — the tour's one sanctioned overshoot —
 *   is dropped for the same non-overshoot curve every other leg uses.
 *   tourYearAt still resolves a zero-duration segment correctly: its
 *   `t >= sg.t1` branch (== sg.t0 here) always fires before the eased branch
 *   that would divide by zero is ever reached, so the year just snaps.
 *   Pause holds, captions and the shockwave/flash cues are untouched — only
 *   the travel between pauses stops tweening.
 */
export function buildTourTimeline(data, startYearIdx, reduced = false) {
  const pauses = buildTourPauses(data);
  const segs = [];
  const cues = [];
  const pauseAt = [];
  let t = 0;
  const rewindDur = reduced ? 0 : REWIND;

  // The opening rewind: the galaxy deflates back to the first year on screen
  // while the camera pulls to the overview seat.
  cues.push({ t: 0, kind: 'camera-home', effect: true });
  if (startYearIdx !== pauses[0].yearIdx) {
    const back = Math.abs(startYearIdx - pauses[0].yearIdx);
    segs.push({
      t0: 0, t1: rewindDur, from: startYearIdx, to: pauses[0].yearIdx, ease: easeExpoOut,
      kind: 'rewind', rate: rewindDur > 0 ? back / rewindDur : Infinity,
    });
    t = rewindDur;
  }

  for (let i = 0; i < pauses.length; i++) {
    const p = pauses[i];
    if (i > 0) {
      const from = pauses[i - 1].yearIdx;
      const detonation = p.kind === 'detonation';
      // The push-in rides the year-step itself, so the move and the eruption
      // are one gesture rather than two.
      if (detonation) cues.push({ t, kind: 'camera-node', node: 'covid-19', factor: PUSH_IN, dur: reduced ? 0 : STEP, effect: true });
      // Reduced motion keeps its held frame: no leg choreography, same as every
      // other camera move on that path.
      t = pushLeg(segs, t, from, p.yearIdx, reduced, detonation, reduced ? null : cues);
    }
    pauseAt.push(t);
    if (p.kind === 'finale') {
      cues.push({ t, kind: 'camera-home', effect: true });
      cues.push({ t, kind: 'caption', caption: 'cooling' });
      cues.push({ t: t + FINALE_SPLIT, kind: 'caption', caption: 'flatline' });
      cues.push({ t: t + FINALE_SPLIT, kind: 'focus', focus: 'rheumatic-heart-disease' });
      // The closing shot recenters on the flatline without closing in: the
      // point is the 152 diseases dimmed around it, so they stay in frame. No
      // `factor` on purpose — a relative pull from wherever the camera
      // happens to be would inherit the tour's compounded push-ins (the HIV
      // and detonation drifts) instead of the designed overview distance.
      cues.push({ t: t + FINALE_SPLIT, kind: 'camera-node', node: 'rheumatic-heart-disease', effect: true });
    } else {
      cues.push({ t, kind: 'caption', caption: p.kind });
      // The two HIV pauses are the one place the camera leaves the overview:
      // it drifts onto the node the caption is about, then deeper for the fade.
      //
      // The two factors are swapped from the shipped pair (0.80 then 0.62), and
      // this is the wave-2/3 carried note answered: the tour framed HIV at
      // 12.7px at the 1996 pause, on a caption whose whole claim is that the
      // node grew. The curve delivers the growth (1.74x across this leg, 2.63x
      // to its peak); the camera has to let it be seen. Deepening the *surge*
      // to 0.62 lifts that pause to ~17px, and handing the fade the shallower
      // 0.80 keeps the product exactly what it was (0.62 x 0.80 = 0.80 x 0.62),
      // so the 2019 close-up — which was never the defect — is unmoved.
      if (p.kind === 'hivSurge') cues.push({ t, kind: 'camera-node', node: 'hiv-aids', factor: HIV_SURGE_IN, effect: true });
      if (p.kind === 'hivFade') cues.push({ t, kind: 'camera-node', node: 'hiv-aids', factor: HIV_FADE_IN, effect: true });
      if (p.kind === 'detonation') cues.push({ t, kind: 'shockwave', effect: true });
      // The peak's own recenter (review gate round 2, P2 #7). By 2021 the
      // camera has inherited three compounded push-ins (HIV 0.80, HIV again
      // 0.62, the detonation 0.85), and what they leave on screen is heart
      // disease about two and a half times the size of COVID-19, directly
      // under a caption whose whole claim is that attention moved to COVID.
      // No `factor`, the finale's pattern: recenter on the node the sentence
      // is about, at the designed overview distance, so the true 2021 number
      // one (141,958 papers) is also the biggest thing in the frame.
      if (p.kind === 'peak') cues.push({ t, kind: 'camera-node', node: 'covid-19', effect: true });
    }
    t += p.hold;
  }

  cues.sort((a, b) => a.t - b.t);
  return { segs, cues, pauses, pauseAt, end: t };
}

// How far ahead of the field the scrubber's target may sit and still count as a
// deliberate step rather than a drag or a flick. One year plus half a detent:
// an arrow key snaps to the neighbouring year, so its target is never more than
// one away, while a drag or a flick parks the target wherever the pointer went.
const SCRUB_LEAD = 1.5;

/**
 * Accent gate G2's input on the manual scrub, where there is no timeline to
 * read a segment rate off: the years-per-second implied by how long the field
 * spent on the year it just left, plus the flick guard above. Same quantity the
 * tour's `tourRateAt` returns, measured instead of boarded, so one threshold
 * governs both paths.
 * @param {number} dtSinceCross seconds since the previous detent crossing
 * @param {number} lead |targetYear - yearFloat| at the moment of the crossing
 */
export function scrubRate(dtSinceCross, lead) {
  if (!(lead <= SCRUB_LEAD)) return Infinity;
  return dtSinceCross > 0 ? 1 / dtSinceCross : Infinity;
}

// ─── The auto-tour's gate ────────────────────────────────────────────────────
// Pure so the one rule that matters is testable without a scene: a tour that
// never ran is not a tour that was spent.

/**
 * True while something else owns the field, so the auto-tour must not open.
 * @param {object} s a store snapshot
 */
export function tourPreempted(s) {
  if (!s) return true;
  if (s.selectedNode || s.activeMode || s.spotlightActive || s.storyActive) return true;
  if (s.tmPhase !== 'idle') return true;
  if (s.roulettePhase !== 'idle') return true;
  if (s.supernovaPhase !== 'idle' && s.supernovaPhase !== 'complete') return true;
  return false;
}

/**
 * The three outcomes the auto-tour's timer can have, kept apart on purpose
 * (review gate F1b). Before this, arming the timer was itself treated as
 * spending the tour: if the viewer happened to have a node selected, a mode up
 * or the spotlight on when it came due, the guard clauses returned and the
 * narrated tour was marked run without a single frame of it ever playing —
 * and, since the film only arms once, it could never play again in that
 * session. 'preempted' leaves the slot unspent so the tour re-arms when
 * whatever preempted it lets go; only 'run' consumes it.
 * @returns {'consumed'|'preempted'|'run'}
 */
export function tourGate(state, consumed) {
  if (consumed) return 'consumed';
  if (tourPreempted(state)) return 'preempted';
  return 'run';
}

/** Year (as a fractional year index) at time t. Holds park on the pause year. */
export function tourYearAt(segs, t) {
  if (!segs.length) return 0;
  let y = segs[0].from;
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (t >= sg.t1) { y = sg.to; continue; }
    if (t >= sg.t0) {
      const p = clamp01((t - sg.t0) / (sg.t1 - sg.t0));
      return sg.from + (sg.to - sg.from) * sg.ease(p);
    }
    break;
  }
  return y;
}

// ─── Caption copy ────────────────────────────────────────────────────────────

/**
 * A disease label as it should read inside a sentence: plain title case drops to
 * lower case ("Rheumatic Heart Disease" -> "rheumatic heart disease"), while
 * anything the data spells in caps or with digits is left exactly as filed
 * (HIV/AIDS, COVID-19, COPD).
 */
export function midSentence(label) {
  if (!label) return '';
  return label
    .split(' ')
    .map((w) => (w === w.toUpperCase() || /\d/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const valueAt = (d, year) => {
  const start = Number.isFinite(d.yearStart) ? d.yearStart : 2015;
  const v = Array.isArray(d.yearlyPapers) ? d.yearlyPapers[year - start] : 0;
  return Number.isFinite(v) ? v : 0;
};
const peakOf = (d) => {
  const yp = Array.isArray(d.yearlyPapers) ? d.yearlyPapers : [];
  let best = -Infinity;
  let idx = 0;
  for (let i = 0; i < yp.length; i++) if (yp[i] > best) { best = yp[i]; idx = i; }
  return { value: best > -Infinity ? best : 0, year: (Number.isFinite(d.yearStart) ? d.yearStart : 2015) + idx };
};

/**
 * Every numeral the tour shows, derived from the live series at build time. A
 * weekly PubMed refresh moves the numbers and the copy follows; nothing here is
 * transcribed from the direction board.
 */
export function buildTourCaptions(diseases, idMap, data) {
  const first = data.yearStart;
  const last = data.yearStart + data.nYears - 1;
  const hiv = diseases[idMap['hiv-aids']];
  const covid = diseases[idMap['covid-19']];
  const rhd = diseases[idMap['rheumatic-heart-disease']];

  const caps = {
    rules: {
      lines: [`${data.nYears} years of attention, year by year.`],
      data: 'Node size: papers published in that year.',
    },
  };

  if (hiv) {
    // Clamped on both ends: a decade-fallback data file (yearStart well after
    // 1990) must not let this land before the file's own first year, which
    // would read the pre-file zero floor and print a "0 papers" line.
    const surgeYear = Math.max(first, Math.min(1996, last));
    caps.hivSurge = {
      lines: ['HIV research climbed with the epidemic.'],
      data: `${hiv.label}: ${fmtFull(valueAt(hiv, first))} papers in ${first}, ${fmtFull(valueAt(hiv, surgeYear))} in ${surgeYear}.`,
    };
    const pk = peakOf(hiv);
    // Round 3 (finding 3): the caption used to pair the peak against the
    // fixed pause year (2019), a 9.1% dip that undersells the argument while
    // papers rose across large stretches of the pause's own 1996-2019 travel
    // window. Pairing the peak against the latest year on file instead is the
    // honest, stronger comparison the same series actually supports.
    caps.hivFade = {
      lines: ['Attention faded long before the epidemic did.'],
      data: `${hiv.label} papers peaked at ${fmtFull(pk.value)} in ${pk.year}. ${fmtWord(hiv.mortality)} people still die of it every year.`,
      // Carry-over C (direction, deferred from Task 13): the in-world sparkline
      // this pause draws beneath the node it's about (DIRECTION section 3,
      // pause 2: "its ten-year sparkline draws in-world beneath it").
      sparklineFor: 'hiv-aids',
      // Per-pause ceiling (review gate round 2, P3 #12). Against the shared
      // maxYearly ceiling (COVID's 2021 spike, several times HIV's best year)
      // HIV's whole 35-year arc flattened into a line hugging the bottom of
      // the box, so the pause meant to show attention fading showed no fade.
      // Its own peak as the ceiling, still with a zero baseline, restores the
      // climb and the decline the caption is describing. The finale keeps the
      // shared ceiling on purpose: there the flatness is the argument.
      sparklineCeiling: Math.max(
        0,
        ...(Array.isArray(hiv.yearlyPapers) ? hiv.yearlyPapers.filter(Number.isFinite) : [0])
      ),
    };
  }

  if (covid) {
    const pk = peakOf(covid);
    caps.detonation = {
      lines: ['Then a new disease detonated.'],
      data: `${covid.label}: ${fmtFull(valueAt(covid, 2019))} papers in 2019, ${fmtFull(valueAt(covid, 2020))} in 2020.`,
    };
    caps.peak = {
      lines: ['Attention can move this fast.'],
      data: `${fmtFull(pk.value)} ${covid.label} papers in ${pk.year} alone.`,
    };
    caps.cooling = {
      lines: [`The surge cools: ${fmtFull(valueAt(covid, last))} papers in ${last}.`],
    };
  }

  if (rhd) {
    const pk = peakOf(rhd);
    const flat = {
      lines: [`${cap1(midSentence(rhd.label))} never surged at all.`],
      data: `Its best year: ${fmtFull(pk.value)} papers. Its toll: ${fmtWord(rhd.mortality)} deaths, every year.`,
      // Carry-over C: the finale's own flat in-world sparkline (DIRECTION
      // section 3, pause 5: "its flat in-world sparkline").
      sparklineFor: 'rheumatic-heart-disease',
    };
    if (covid) {
      // Within one disease: the sum of rheumatic heart disease's own series,
      // summed here rather than transcribed. Never a cross-disease total.
      const series = Array.isArray(rhd.yearlyPapers) ? rhd.yearlyPapers : [];
      const total = series.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      flat.micro = `${covid.label} drew more papers in 2020 than ${midSentence(rhd.label)} drew in all ${data.nYears} years combined (${fmtFull(valueAt(covid, 2020))} versus ${fmtFull(total)}).`;
    }
    caps.flatline = flat;
  }

  caps.handover = { lines: ['Scrub the decades.'], handover: true };
  return caps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Almost-null-rendering engine half of the Time Machine. Owns `sceneRefs.tm`,
// the interface DiseaseNodes' render loop already guards on (Task 9):
//   { active: bool, yearFloat: number, targetYear: number, data, radiusAt(i), exit: number }
// and, since Task 13, the auto-tour that drives yearFloat during 'tour'. Its
// only rendered output is the 2020 detonation's white-core flash mesh
// (carry-over D), an isolated primitive that owns no shared scene state.
export default function TimeMachine({ camDist = 900 }) {
  const tmRef = useRef(null);
  const velRef = useRef(0);
  const tourRef = useRef({ tl: null, caps: null, t0: 0, fired: null, paused: null, pendingSeek: null, exitAt: null });
  // The exit choreography's clock and one-shot bookkeeping. `t0` is the frame
  // clock the exit began at; `fired` guards the staged channels; `glide` is the
  // camera segment the velocity-matched handover is computed from.
  const exitRef = useRef(null);
  // The auto-tour's one-shot slot. Spent only when the tour actually opens (or
  // when the viewer opens the Time Machine themselves) — never by a timer that
  // came due and found the field busy. See tourGate above.
  const tourConsumedRef = useRef(false);
  const tourTimerRef = useRef(null);
  const glowRef = useRef(0);
  // The accent engine's bookkeeping. `detent` is the integer year the field is
  // standing on, which is the edge gate G1 watches; `crossedAt` is when it last
  // changed, which is what the manual scrub's rate is measured across;
  // `pendingLabel` is accent 5 waiting out its 360 ms dwell.
  const accentRef = useRef({ detent: -1, crossedAt: 0, lastStepRate: 0, pendingLabel: null });
  // prefers-reduced-motion, read once on mount (same pattern as
  // OvertureSequence's own reducedRef): the tour becomes stepped year holds
  // under it — no year tweens, no shockwave overshoot (see buildTourTimeline
  // and runCue above). Captions, holds and the shockwave/flash cues fire on
  // the same schedule either way.
  const reducedRef = useRef(false);
  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  // Carry-over D (direction, deferred from Task 13): the 2020 detonation's
  // white-core flash. `frames` counts down once per rendered frame, the same
  // literal-frame technique TimeRail's own detent pip uses.
  const flashRef = useRef({ idx: -1, frames: 0 });
  const flashMeshRef = useRef(null);
  // Fix (review): the flash fires once per tour (occasionally replayed by the
  // verify harness's seek), not every frame, so its geometry/material are
  // allocated only for the ~12 frames they're needed rather than held for the
  // component's whole lifetime — allocFlash/disposeFlash below own that,
  // instead of a permanent useMemo pair that was never disposed.
  const flashResRef = useRef(null);
  const allocFlash = () => ({
    geo: new THREE.SphereGeometry(1, 12, 12),
    mat: new THREE.MeshBasicMaterial({
      color: FLASH_COLOR, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
      // depthTest off is a deliberate overdraw tradeoff: the flash must read
      // through the galaxy for its 12 frames regardless of which nodes are
      // nearer the camera, and at 12 frames of one additive sphere the cost
      // is invisible next to the payoff of the core never getting occluded.
      depthTest: false,
    }),
  });
  const disposeFlash = () => {
    const r = flashResRef.current;
    if (!r) return;
    r.geo.dispose();
    r.mat.dispose();
    flashResRef.current = null;
    const mesh = flashMeshRef.current;
    if (mesh) { mesh.geometry = null; mesh.material = null; }
  };
  useEffect(() => disposeFlash, []); // safety net: dispose if still live on unmount

  if (!tmRef.current) {
    const diseases = useStore.getState().diseases;
    const count = diseases.length;
    const data = buildTimeMachineData(diseases);
    const lastYear = data.nYears - 1;

    // Mass-weighted stagger for both blends, the same direction-independent
    // table DiseaseNodes' morph already uses (one per disease list, computed
    // from the larger of a node's two radii). "Giants landing last" in the exit
    // table is exactly this.
    const lag = computeLagFactors(diseases);

    const tm = {
      active: false,
      yearFloat: lastYear,
      targetYear: lastYear,
      data,
      lag,
      exit: 0,
      // 1 = fully inside the Time Machine. Ramps 0 -> 1 over 650 ms on a
      // manual (header) entry; the narrated tour opens at 1.
      enter: 1,
      // Mass-weighted stagger on both blends, off under reduced motion.
      stagger: true,
      // Years per second, published for accent gate G2 and for the rail (the
      // year numeral drops to 55 percent and 0.6px of blur while a sweep runs
      // past it). Written once per frame by the engine below.
      rate: 0,
      // Accent 3, the year-step settle: at most three live records of
      // { i, t0, amp }, read by radiusAt against `clockMs`. A node that is not
      // settling multiplies by exactly 1, and every settle returns to exactly
      // 1.000 at 240 ms, so the settled frame is always exactly the mapping.
      settles: [],
      clockMs: 0,
      radiusAt: null,
    };

    // radiusAt(i): DiseaseNodes calls this with only the instance index (its
    // existing call site is `tm.radiusAt(i)`), so the exit-blend fallback —
    // mixing toward the normal morph radius — is computed in here, reading
    // sizeMode/fx.morphOverride directly rather than depending on DiseaseNodes'
    // own smoothed morph state (which this component has no access to).
    tm.radiusAt = (i) => {
      const { radii, nYears } = tm.data;
      const yf = tm.yearFloat < 0 ? 0 : (tm.yearFloat > nYears - 1 ? nYears - 1 : tm.yearFloat);
      const y0 = Math.floor(yf);
      const y1 = y0 + 1 < nYears ? y0 + 1 : y0;
      const frac = yf - y0;
      const r0 = radii[y0 * count + i];
      const r1 = radii[y1 * count + i];
      // Accent 3 rides here, multiplicatively, because this is the one place a
      // node's Time Machine radius is decided. `settleScale` is exactly 1
      // outside its own 240 ms window, so an unaccented node's radius is
      // bit-identical to the mapping and the cost of the lookup is a scan of a
      // list that is empty or three long.
      let settle = 1;
      const ss = tm.settles;
      for (let k = 0; k < ss.length; k++) {
        if (ss[k].i === i) { settle = settleScale(tm.clockMs - ss[k].t0, ss[k].amp); break; }
      }
      const tmR = (r0 + (r1 - r0) * frac) * settle;
      if (tm.exit <= 0 && tm.enter >= 1) return tmR;

      const store = useStore.getState();
      const fx = sceneRefs.fx;
      // Fix (review): the Time Machine only ever exits into the normal galaxy
      // view, whose sizeMode toggle is discrete — morphT here is always the
      // *settled* destination (0 or 1), never a live scripted transition, so
      // this is a lookup of the landing radius, not a curve to ease along.
      // Reusing DiseaseNodes' own morphRadiusAt (lag=1, irrelevant at a
      // settled endpoint — the endpoint invariant holds for every L) keeps
      // this in lockstep with the shared morph formula instead of a second,
      // independently-drifting copy of the smoothstep curve.
      const morphT = fx.morphOverride != null ? fx.morphOverride : (store.sizeMode === 'mortality' ? 1 : 0);
      const d = store.diseases[i];
      const normalR = morphRadiusAt(d, morphT, 1);
      // Both blends are the same lerp between the same two endpoints, shaped by
      // arrival() under this node's own lag (amendment A1 sanctions it for
      // exactly these two channels). arrival is clamped to [0,1], so no frame
      // of either blend can show a radius outside its endpoints — the delta
      // list's item-8 acceptance, guaranteed by construction rather than
      // sampled.
      // Reduced motion drops the stagger with every other ramp: L = 1 makes
      // staggeredArrival the plain arrival curve, one dissolve for all 153.
      const L = tm.stagger === false ? 1 : tm.lag[i];
      if (tm.exit > 0) {
        const e = staggeredArrival(tm.exit, L);
        return tmR + (normalR - tmR) * e;
      }
      const e = staggeredArrival(tm.enter, L);
      return normalR + (tmR - normalR) * e;
    };

    tmRef.current = tm;
    sceneRefs.tm = tm;
    if (typeof window !== 'undefined') window.__tm = tm;
  }

  // ── The auto-tour offers itself 1.5 s after the film hands over ──
  // Skipped if the viewer already took the instrument (a selection, a mode, the
  // spotlight, or a Time Machine they started themselves) — but only *skipped*,
  // not spent: a tour the field preempted re-arms the moment the field is free
  // again (review gate F1b).
  useEffect(() => {
    // Anyone who has already been in the Time Machine has spent the auto-tour's
    // slot, even if they left again before the timer came due.
    const unsubSeen = useStore.subscribe(
      (s) => s.tmPhase,
      (phase) => { if (phase !== 'idle') tourConsumedRef.current = true; }
    );
    const arm = () => {
      if (tourConsumedRef.current || tourTimerRef.current) return;
      tourTimerRef.current = setTimeout(() => {
        tourTimerRef.current = null;
        const s = useStore.getState();
        // 'preempted' returns without consuming, so the re-arm below can try
        // again; 'run' is the only branch that spends the slot.
        if (tourGate(s, tourConsumedRef.current) !== 'run') return;
        tourConsumedRef.current = true;
        s.startTimeMachine(true);
      }, TOUR_ARM_DELAY);
    };
    if (useStore.getState().overtureDone) arm();
    const unsubDone = useStore.subscribe((s) => s.overtureDone, (done) => { if (done) arm(); });
    // The re-arm. Fires on the edge where the field stops being busy (a
    // deselect, a mode closed, the spotlight off), and the same 1.5 s pause
    // then applies, so the invitation never lands on top of the gesture that
    // freed the frame.
    const unsubFree = useStore.subscribe(
      (s) => tourPreempted(s),
      (busy) => { if (!busy && useStore.getState().overtureDone) arm(); }
    );
    return () => {
      clearTimeout(tourTimerRef.current);
      tourTimerRef.current = null;
      unsubDone();
      unsubSeen();
      unsubFree();
    };
  }, []);

  // ── Any input during the tour hands the scrubber over, at the year on screen ──
  // The same guard also covers the finale's held frame: the tour can end
  // naturally (tmPhase already 'scrub') with the flatline focus/caption still
  // parked from the closing shot. Without this, only a rail-drag, arrow key,
  // Escape, or the close button released them — a plain click on another node
  // left the dim/isolation locked on indefinitely (Task 13 review finding 1).
  useEffect(() => {
    const handover = () => {
      const s = useStore.getState();
      // The methodology panel owns Escape (and, while it's up, every other
      // keydown that would otherwise hand the tour over or release the
      // finale) — the panel wins; closing it is the only effect while open
      // (fix-14 review finding 4).
      if (s.methodologyOpen) return;
      // Skip during the exit (ADDENDUM 1 section 1): any input fast-forwards
      // to the landed state over 240 ms. Checked before the tour branch
      // because by now tmPhase is already 'idle'.
      if (exitRef.current && !exitRef.current.landed) {
        s.tmExitSkip();
        return;
      }
      if (s.tmPhase === 'tour') {
        // The one exception to "the opening sequence ends at the home screen",
        // stated in the addendum so nobody removes it: a tour the viewer
        // interrupted is not a park. If any input hands the scrubber over
        // mid-tour, the viewer owns the rail and it stays up until they close
        // it. The exit sequence runs only when the tour reaches its own end
        // untouched — which is exactly what dropping `exitAt` here guarantees,
        // since the tour clock stops being read the moment the phase leaves
        // 'tour'.
        const tm = tmRef.current;
        if (tm) tm.targetYear = Math.round(tm.yearFloat);
        tourRef.current.exitAt = null;
        s.setTmFocusIdx(-1);
        s.setTmCaption(tourRef.current.caps ? tourRef.current.caps.handover : { lines: ['Scrub the decades.'], handover: true });
        s.setTmPhase('scrub');
        return;
      }
      if (s.tmPhase === 'scrub' && s.tmFocusIdx >= 0) {
        s.setTmFocusIdx(-1);
        s.setTmCaption(null);
      }
    };
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', handover, opts);
    window.addEventListener('keydown', handover, opts);
    window.addEventListener('wheel', handover, opts);
    window.addEventListener('touchstart', handover, opts);
    return () => {
      window.removeEventListener('pointerdown', handover, opts);
      window.removeEventListener('keydown', handover, opts);
      window.removeEventListener('wheel', handover, opts);
      window.removeEventListener('touchstart', handover, opts);
    };
  }, []);

  // ── Dev hook: deterministic pause capture for the verify harness ──
  //   await window.__tour.seek(3)    → jump to the 2020 pause and hold the frame
  //   await window.__tour.seek(5.4)  → 40 percent into the finale hold (flatline)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const waitFrames = (n) => new Promise((res) => {
      let k = n;
      const tick = () => (--k <= 0 ? res(true) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    window.__tour = {
      seek: (pauseIndex, frames = 14) => {
        const s = useStore.getState();
        if (!s.introStarted || s.introPhase < 5) s.skipIntro();
        if (sceneRefs.introScales) sceneRefs.introScales.fill(1);
        // The film must be finished, not merely inactive: OvertureSequence
        // restarts it on the next frame otherwise, and its takeover would tear
        // the seeked tour straight back down.
        if (!s.overtureDone) s.finishOverture();
        tourConsumedRef.current = true; // the harness owns the tour from here
        tourRef.current.tl = null;
        tourRef.current.exitAt = null;
        exitRef.current = null;
        useStore.getState().setTmFocusIdx(-1);
        useStore.getState().startTimeMachine(true);
        useStore.getState().setTmPhase('tour');
        tourRef.current.pendingSeek = pauseIndex;
        return waitFrames(frames);
      },
      resume: () => { tourRef.current.paused = null; },
      // The exit choreography's live state, for the harness's own acceptance
      // checks (delta-list items 1 and 5).
      exit: () => {
        const ex = exitRef.current;
        if (!ex) return null;
        return { ...ex, fired: [...ex.fired], glide: ex.glide ? { t0: ex.glide.t0, t1: ex.glide.t1 } : null };
      },
      state: () => {
        const r = tourRef.current;
        const tm = tmRef.current;
        return {
          phase: useStore.getState().tmPhase,
          t: r.paused,
          end: r.tl ? r.tl.end : null,
          pauseAt: r.tl ? r.tl.pauseAt : null,
          year: tm ? tm.data.yearStart + tm.yearFloat : null,
          yearFloat: tm ? tm.yearFloat : null,
          targetYear: tm ? tm.targetYear : null,
          focus: useStore.getState().tmFocusIdx,
        };
      },
    };
    return () => { delete window.__tour; };
  }, []);

  // Executes one timeline cue. Kept out of the builder so the timeline stays
  // pure data (and testable without a scene). `reduced` forces every camera
  // move this fires to duration 0 (a snap, not a fly) — the same "no year
  // tweens" rule as the segments above, applied to the camera cues that live
  // outside buildTourTimeline's own duration math (camera-home's duration is
  // fixed at REWIND here, not threaded through the cue).
  const runCue = (cue, caps, reduced) => {
    const s = useStore.getState();
    switch (cue.kind) {
      case 'caption':
        s.setTmCaption(caps[cue.caption] || null);
        break;
      case 'focus': {
        const idx = s.idMap[cue.focus];
        if (idx !== undefined) s.setTmFocusIdx(idx);
        break;
      }
      case 'shockwave': {
        const idx = s.idMap['covid-19'];
        if (idx !== undefined) {
          fireRipple(idx, COVID_EMBER);
          // Carry-over D: the white-core flash rides the same cue as the ring.
          // disposeFlash() first: a re-fired shockwave (a harness seek that
          // replays this cue) before the previous flash's 12 frames finished
          // must not leak the earlier geometry/material.
          disposeFlash();
          flashResRef.current = allocFlash();
          const mesh = flashMeshRef.current;
          if (mesh) { mesh.geometry = flashResRef.current.geo; mesh.material = flashResRef.current.mat; }
          flashRef.current = { idx, frames: FLASH_FRAMES };
        }
        // The muffled 2020 boom (DIRECTION section 5, moment 4): smaller than
        // the thesis ignition, history rhymes but does not shout.
        if (typeof window !== 'undefined') window.__mgAudio?.play?.('tmBoom');
        break;
      }
      case 'camera-home':
        // No radius: CameraRig's fly-back branch (docs/superpowers/plans/reference/
        // sceneCore.md item 6) flies to the fixed, designed camDist rather than a
        // distance relative to wherever the camera already is — the one branch
        // that guarantees a wide framing regardless of how far the tour's earlier
        // push-ins (HIV, detonation) left the camera pulled in. `radius: null`
        // is explicit here, the same pattern store.deselect uses for its own
        // fly-home.
        s.setFlyTarget({ position: [0, 0, 0], radius: null, duration: reduced ? 0 : REWIND, ease: 'sine.inOut' });
        break;
      case 'camera-leg': {
        // ADDENDUM 1 section 4 item 3. A truck and a dolly about whatever the
        // controls are currently looking at, so a leg that leaves a pause
        // framed on HIV orbits HIV rather than snapping the target home. Both
        // are read off the live camera at the moment the leg opens, which is
        // what makes this one extra flyTarget per leg and no state at all.
        const cam = sceneRefs.camera;
        const controls = sceneRefs.controls;
        if (!cam) break;
        const tx = controls ? controls.target.x : 0;
        const ty = controls ? controls.target.y : 0;
        const tz = controls ? controls.target.z : 0;
        const ox = cam.position.x - tx, oy = cam.position.y - ty, oz = cam.position.z - tz;
        const a = (cue.deg * Math.PI) / 180;
        const k = 1 - cue.dolly;
        const ca = Math.cos(a), sa = Math.sin(a);
        s.setFlyTarget({
          position: [tx, ty, tz],
          cameraPos: [
            tx + (ox * ca - oz * sa) * k,
            ty + oy * k,
            tz + (ox * sa + oz * ca) * k,
          ],
          duration: cue.dur,
          ease: 'sine.inOut',
        });
        break;
      }
      case 'camera-node': {
        const idx = s.idMap[cue.node];
        const cam = sceneRefs.camera;
        if (idx !== undefined && cam && s.curPos[idx]) {
          const p = s.curPos[idx];
          // Distance measured off wherever the viewer already is, so the drift
          // is proportional to the current framing rather than a fixed seat —
          // except when the cue omits `factor` (the finale's recenter), which
          // asks for the same designed-camDist overview `camera-home` uses.
          const radius = cue.factor != null ? cam.position.length() * cue.factor : null;
          s.setFlyTarget({
            position: [p[0], p[1], p[2]],
            radius,
            duration: reduced ? 0 : (cue.dur || REWIND),
            ease: 'sine.inOut',
          });
        }
        break;
      }
      default:
        break;
    }
  };

  // ─── The accent engine (ADDENDUM 1 section 2.3) ────────────────────────────
  // Four gates, all required. G1 (integer-year crossings) and G2 (the rate) are
  // here, because only the running engine knows where the year is and how fast
  // it got there; G3 (three nodes, each clearing 0.25 radius units) and G4 (the
  // tier budget) are `accentPicks`, pure over the built table.
  //
  // Everything an accent writes is transient and returns to identity: the ghost
  // pool empties itself, the settle multiplier is exactly 1.000 outside its
  // 240 ms, the ring is the selection ripple's own one-shot, and the micro-label
  // tears itself down. An at-rest frame is byte-identical with accents on or off.
  const TIER_BUDGET = ACCENT_BUDGET[TIER] || 1;

  // `gate` and `shown` are the same number on the tour and deliberately
  // different on the manual scrub, because they answer different questions.
  // The gate asks "how fast were the twelve months just crossed", which is a
  // property of a completed step and is what G2 was written against. The rail
  // asks "is the numeral a readable year right now or a blur of digits", which
  // is the instantaneous velocity. Publishing the gate's own 1/dt to the rail
  // dimmed the numeral for a third of a second after every deliberate step,
  // because on the frame after a crossing that quantity is 1/0.016 s.
  const stepAccents = (tm, gate, shown, nowMs) => {
    const acc = accentRef.current;
    tm.rate = shown;

    // Expire settles. Three at most, so this is a scan of a list that is empty
    // almost all the time.
    for (let k = tm.settles.length - 1; k >= 0; k--) {
      if (nowMs - tm.settles[k].t0 >= TM_SETTLE.dur) tm.settles.splice(k, 1);
    }

    // Accent 5 is armed on the crossing and spent only if the year is still
    // standing on that detent one stair later. That is the literal reading of
    // "only during a step whose dwell is at least 360 ms", and it needs no
    // knowledge of whether a tour or a hand is driving.
    const pending = acc.pendingLabel;
    if (pending) {
      if (Math.round(tm.yearFloat) !== pending.detent) acc.pendingLabel = null;
      else if (nowMs - pending.t0 >= TM_MICRO.dwell) {
        acc.pendingLabel = null;
        showMoverLabel(pending.index, pending.delta);
      }
    }

    // ── G1: the integer-year crossing ──
    const detent = Math.round(tm.yearFloat);
    if (detent === acc.detent) return;
    const from = acc.detent;
    const dt = (nowMs - acc.crossedAt) / 1000;
    acc.detent = detent;
    acc.crossedAt = nowMs;
    if (from < 0) return; // nothing was left behind: this is the first detent seen
    acc.lastStepRate = gate;
    // ── G2: nothing fires above 4.0 years per second ──
    // The rewind (26 yr/s), the sweep (13 yr/s) and any hard flick, killed;
    // every staircase step (2.78), every single-year leg (1.54) and every
    // deliberate scrub, passed.
    if (!(gate <= ACCENT_MAX_RATE)) return;
    // Not a neighbouring year: a seek, a jump, or the frame the machine opened
    // on. There is no "year just left" to hold a shell at.
    if (Math.abs(detent - from) !== 1) return;

    // ── G3 and G4 ──
    const picks = accentPicks(tm.data, from, detent, TIER_BUDGET);
    if (!picks.length) return;
    const store = useStore.getState();
    const reduced = reducedRef.current;

    // Accent 1, the hero: a shell at the radius the node had in the year just
    // left. Every tier, and the only accent reduced motion keeps (as a single
    // 300 ms dissolve).
    fireGhosts(
      picks.map((p) => ({
        index: p.index,
        radius: p.from,
        color: CC[store.diseases[p.index].category],
      })),
      reduced
    );
    // Reduced motion drops rings, settles and micro-labels entirely.
    if (reduced) return;

    // Accent 3, the year-step settle: 4.5 / 3.0 / 2.0 percent by rank, starting
    // on the frame the detent lands.
    for (const p of picks) {
      const amp = TM_SETTLE.amps[p.rank - 1];
      if (amp > 0) tm.settles.push({ i: p.index, t0: nowMs, amp });
    }

    // Accent 2, the mover ring: rank-1 only, and only above its own much higher
    // threshold. Color says direction — the category color on growth, tertiary
    // ink on shrinkage, never the detonation's ember.
    const top = picks[0];
    if (!top.ring) return;
    const d = store.diseases[top.index];
    fireRipple(top.index, top.delta >= 0 ? CC[d.category] : TM_SHRINK_INK);

    // Accent 4's upgrade is the rail's own (it owns the numeral); accent 5 is
    // armed here. Both numerals in it are the difference of two file values,
    // which is the precedent the rail's hover chip already set.
    const yearStart = tm.data.yearStart;
    acc.pendingLabel = {
      index: top.index,
      delta: valueAt(d, yearStart + detent) - valueAt(d, yearStart + from),
      detent,
      t0: nowMs,
    };
  };

  // Everything the accents own, dropped on the same frame. Called when the
  // machine closes, when a skip fast-forwards it, and when a harness seek jumps
  // the year: no orphan ghost, no half-applied settle, no floating label.
  const clearAccents = (tm) => {
    const acc = accentRef.current;
    acc.pendingLabel = null;
    acc.detent = -1;
    tm.settles.length = 0;
    tm.rate = 0;
    clearGhosts();
    hideMoverLabel();
  };

  // ─── The exit choreography (ADDENDUM 1 section 1) ──────────────────────────
  // Opens when the finale's closing shot has held FINALE_HOLD seconds after the
  // flatline cue, and lands 2.60 s later on the home screen. The table it
  // follows lives in motion.js so the rail, the hint row, the header and the
  // tests all read the same offsets.

  const beginExit = (clock) => {
    const s = useStore.getState();
    const mode = reducedRef.current ? 'reduced' : 'normal';
    const tm = tmRef.current;
    // Reduced motion drops the mass-weighted stagger with everything else: the
    // radii come home as one 300 ms dissolve, not a staggered blend.
    if (tm) tm.stagger = mode !== 'reduced';
    exitRef.current = {
      t0: clock,
      mode,
      fired: new Set(),
      glide: null,
      handoverArmed: false,
      handoverBase: 0,
      landed: false,
      glow0: sceneRefs.fx.glowSuppress,
      fastAt: 0,
    };
    s.beginTmExit(mode);
    // Moment 3's release pad, reused at -4 dB against the film's own: the same
    // exhale, quieter, because this is the second handover and not the first.
    if (typeof window !== 'undefined') window.__mgAudio?.play?.('release', { gainDb: EXIT_PAD_DB });
    // Reduced motion: no glide. The camera takes the rest seat outright.
    if (mode === 'reduced' && sceneRefs.cameraJump) {
      const p = seatPos(camDist, SEAT.rest);
      sceneRefs.cameraJump(p[0], p[1], p[2]);
    }
  };

  // Everything the exit still owes the viewer, applied at once. Shared by the
  // skip fast-forward and by the landing itself, so a skipped exit and a
  // watched one leave byte-identical state.
  const settleExit = () => {
    const s = useStore.getState();
    s.setTmIso(-1, 1);
    sceneRefs.fx.glowSuppress = 0;
    glowRef.current = 0;
    sceneRefs.fx.ember = 1;
    if (s.storyVisible === false) s.tmExitChrome();
    // The hint the viewer just watched play out in full is not an invitation
    // any more (exit table, t = 1.60).
    s.hintDismiss('timeMachine');
  };

  const stepExit = (clock) => {
    const ex = exitRef.current;
    // `landed` is the end of the 2.60 s choreography; `done` is the end of this
    // driver. They are not the same instant on purpose: the glide's handover
    // decays to the resting drift over a full second from the end of the glide
    // at 1.75 s, which runs 150 ms past the exit itself. Stopping at `landed`
    // truncated the decay and left the galaxy turning at 0.32 instead of 0.30
    // (delta-list item 5 asserts the film's exact terminal value).
    if (!ex || ex.done) return;
    const s = useStore.getState();

    // Re-entry mid-exit (the header button is live from t = 0): the instrument
    // wins, and the choreography stops writing rather than fighting it.
    if (s.tmPhase !== 'idle') { ex.landed = true; ex.done = true; return; }

    // ── Skip during the exit: 240 ms to the landed state ──
    if (s.tmExitMode === 'fast' && ex.mode !== 'fast') {
      ex.mode = 'fast';
      ex.fastAt = clock;
      // Camera tweens killed and seated at rest, in one call.
      if (sceneRefs.cameraJump) {
        const p = seatPos(camDist, SEAT.rest);
        sceneRefs.cameraJump(p[0], p[1], p[2]);
      }
      sceneRefs.handover.speed = REST_ROTATE_SPEED;
      ex.glide = null; // nothing left to arm; the pulse is cancelled with it
      settleExit();
    }

    if (ex.mode === 'fast') {
      if (clock - ex.fastAt >= TM_EXIT_FAST / 1000) { ex.landed = true; ex.done = true; }
      return;
    }

    const t = clock - ex.t0;
    const reduced = ex.mode === 'reduced';

    // ── Isolation release: dim 0.4 -> 1 and glowSuppress 0.55 -> 0, both on
    // the same 480 ms sine.inOut (300 ms straight dissolve under reduced
    // motion). HighlightSystem can only dim instance colors, so the halos need
    // the second channel or 152 diseases keep burning around the one that
    // never surged.
    const isoDur = (reduced ? TM_EXIT_REDUCED : TM_EXIT.isolation.dur) / 1000;
    if (!ex.landed && s.tmIsoIdx >= 0) {
      const p = t <= 0 ? 0 : t >= isoDur ? 1 : t / isoDur;
      const e = reduced ? p : easeSineInOut(p);
      if (p >= 1) {
        s.setTmIso(-1, 1);
        sceneRefs.fx.glowSuppress = 0;
        glowRef.current = 0;
      } else {
        // Quantized so a 480 ms ramp costs about thirty repaints of the
        // instance colors rather than one per frame at whatever the display
        // runs at.
        const dim = Math.round((0.4 + 0.6 * e) * 50) / 50;
        if (dim !== s.tmIsoDim) s.setTmIso(s.tmIsoIdx, dim);
        sceneRefs.fx.glowSuppress = ex.glow0 * (1 - e);
        glowRef.current = sceneRefs.fx.glowSuppress;
      }
    }

    // ── Camera: the release glide, again ──
    if (!reduced && !ex.landed && !ex.fired.has('camera') && t >= TM_EXIT.camera.at / 1000) {
      ex.fired.add('camera');
      const cam = sceneRefs.camera;
      const dur = TM_EXIT.camera.dur / 1000;
      const from = cam
        ? [cam.position.x, cam.position.y, cam.position.z]
        : seatPos(camDist, SEAT.rest);
      ex.glide = { t0: t, t1: t + dur, fromPos: from, to: SEAT.rest, ease: easeGlide };
      s.setFlyTarget({
        position: [0, 0, 0],
        cameraPos: seatPos(camDist, SEAT.rest),
        duration: dur,
        ease: easeGlide,
      });
    }

    // ── Velocity-matched handover, the film's own arming logic ──
    // The last 300 ms of the glide hand the orbit controls the glide's terminal
    // angular velocity; it then eases to the resting drift over 1 s. "The piece
    // hands control over twice and both times the frame the user touches is
    // already moving."
    const g = ex.glide;
    if (sceneRefs.handover.cancelled) {
      // The viewer took the orbit controls. CameraRig's onStart has already
      // reset the rate and killed the handover for good; nothing here may
      // write over that.
      ex.handoverDone = true;
    } else if (g) {
      const armAt = g.t1 - HANDOVER_LEAD;
      if (t >= armAt && t <= g.t1 + HANDOVER_DECAY) {
        if (!ex.handoverArmed) {
          ex.handoverArmed = true;
          ex.handoverBase = handoverSpeed(g, g.t1, camDist);
        }
        const base = ex.handoverBase;
        sceneRefs.handover.speed =
          t <= g.t1
            ? base
            : REST_ROTATE_SPEED + (base - REST_ROTATE_SPEED) * (1 - sramp(t, g.t1, g.t1 + HANDOVER_DECAY));
      } else if (ex.handoverArmed && t > g.t1 + HANDOVER_DECAY) {
        // Held at the resting drift, exactly as the film holds it: CameraRig's
        // idle rule would otherwise never re-arm autoRotate on its own, and the
        // home screen the exit lands on is a turning galaxy.
        sceneRefs.handover.speed = REST_ROTATE_SPEED;
        ex.handoverDone = true;
      }
    } else if (reduced || ex.fired.has('camera')) {
      // No glide will ever exist on this path (reduced motion has none, and a
      // dispatched camera channel that produced none cannot produce one
      // later): the resting drift is simply asserted. Note the guard — before
      // t = 0.15 the glide has merely not been dispatched yet, and treating
      // that as "no glide" ended the handover before it began.
      if (!ex.fired.has('rest')) {
        ex.fired.add('rest');
        sceneRefs.handover.speed = REST_ROTATE_SPEED;
      }
      ex.handoverDone = true;
    }

    if (ex.landed) {
      if (ex.handoverDone) ex.done = true;
      return;
    }

    // ── Staged state channels ──
    const fire = (key, atMs, fn) => {
      if (ex.fired.has(key)) return;
      if (t < (reduced ? 0 : atMs) / 1000) return;
      ex.fired.add(key);
      fn();
    };
    // The standing ember scar on the overlooked decile, re-asserted.
    fire('grade', TM_EXIT.grade.at, () => { sceneRefs.fx.ember = 1; });
    fire('chrome', TM_EXIT.chrome.at, () => s.tmExitChrome());
    fire('hints', TM_EXIT.hints.at, () => s.hintDismiss('timeMachine'));

    if (t >= TM_EXIT.total / 1000) {
      ex.landed = true;
      settleExit();
      if (ex.handoverDone) ex.done = true;
    }
  };

  useFrame((state, delta) => {
    const tm = tmRef.current;
    const dt = delta > 0.05 ? 0.05 : delta; // clamp so a stalled tab doesn't fling the spring
    const store = useStore.getState();
    const tmPhase = store.tmPhase;
    const maxY = tm.data.nYears - 1;
    const r = tourRef.current;
    // One clock for every accent channel, published so radiusAt (which is
    // called by DiseaseNodes, not from in here) can resolve a live settle
    // without reaching for performance.now() 153 times a frame.
    const nowMs = state.clock.getElapsedTime() * 1000;
    tm.clockMs = nowMs;

    // Carry-over D: count the flash down one rendered frame at a time,
    // independent of tour phase/pause, so a harness seek that lands mid-flash
    // still tears it down cleanly.
    const fl = flashRef.current;
    if (fl.frames > 0) {
      fl.frames -= 1;
      const p = store.curPos[fl.idx];
      const mesh = flashMeshRef.current;
      if (mesh && p) {
        mesh.visible = true;
        mesh.position.set(p[0], p[1], p[2]);
        const r0 = tm.radiusAt ? tm.radiusAt(fl.idx) : 2;
        mesh.scale.setScalar(Math.max(2, r0 * 1.4));
      }
      // Countdown just ended: the flash has no further use for its geometry
      // and material until the next shockwave cue allocates a fresh pair.
      if (fl.frames === 0) {
        if (mesh) mesh.visible = false;
        disposeFlash();
      }
    } else if (flashMeshRef.current && flashMeshRef.current.visible) {
      flashMeshRef.current.visible = false;
    }

    // The exit choreography, run before anything else this frame: it owns the
    // glow channel and the radius blend's schedule while it lasts.
    const exiting = exitRef.current && !exitRef.current.landed;
    if (exitRef.current) stepExit(state.clock.getElapsedTime());

    // The entry blend: 0 -> 1 over 650 ms on a manual open, so the instrument
    // arrives rather than cutting in.
    if (tm.enter < 1) {
      tm.enter += dt / ENTER_DUR;
      if (tm.enter > 1) tm.enter = 1;
    }

    // Halo suppression follows the finale's focus, and only ever writes the
    // shared grade channel when it has something to say (the film owns it
    // while it plays, and the exit owns it while it runs).
    const glowTarget = store.tmFocusIdx >= 0 ? FINALE_GLOW : 0;
    if (!exiting && !store.overtureActive && (glowTarget > 0 || glowRef.current > 0.001)) {
      if (reducedRef.current) {
        // Reduced motion: the finale's halo suppression snaps straight to its
        // target instead of ramping over GLOW_RAMP (Task 17 follow-up review,
        // finding 3) — the same "no ramp" rule the tour's year travel and
        // camera cues already follow under this flag.
        glowRef.current = glowTarget;
      } else {
        const k = Math.min(1, dt / GLOW_RAMP);
        glowRef.current += (glowTarget - glowRef.current) * k;
        if (glowRef.current < 0.001) glowRef.current = 0;
      }
      sceneRefs.fx.glowSuppress = glowRef.current;
    }

    if (tmPhase === 'scrub') {
      tm.active = true;
      tm.exit = 0;
      if (r.tl) { r.tl = null; r.paused = null; r.pendingSeek = null; }
      // The 2.5 s "Scrub the decades." chip that used to appear here is gone
      // from the automatic path (ADDENDUM 1 section 1). A tour that reaches its
      // own end now exits to the home screen instead of parking, and the chip
      // survives only where it was always right: the interrupted tour, set by
      // the window-level handover above.
      const target = tm.targetYear < 0 ? 0 : (tm.targetYear > maxY ? maxY : tm.targetYear);
      const [ny, nv] = springStep(tm.yearFloat, velRef.current, target, dt, TAU);
      velRef.current = nv;
      tm.yearFloat = ny;
      if (tm.yearFloat < 0) tm.yearFloat = 0;
      if (tm.yearFloat > maxY) tm.yearFloat = maxY;
      // The manual scrub's own G2 input, measured rather than boarded: the
      // years-per-second implied by the year just crossed, plus the flick guard.
      // A deliberate step passes; a drag or a flick does not. The rail gets the
      // spring's own instantaneous velocity instead, which is what "the numeral
      // is a blur of digits right now" actually means.
      stepAccents(
        tm,
        scrubRate(
          (nowMs - accentRef.current.crossedAt) / 1000,
          Math.abs(tm.targetYear - tm.yearFloat)
        ),
        Math.abs(velRef.current),
        nowMs
      );
    } else if (tmPhase === 'tour') {
      // The tour owns yearFloat outright: a pure function of the tour clock,
      // so a seeked frame and a played frame are the same frame.
      tm.active = true;
      tm.exit = 0;
      velRef.current = 0;
      const clock = state.clock.getElapsedTime();

      if (!r.tl) {
        r.caps = buildTourCaptions(store.diseases, store.idMap, tm.data);
        r.tl = buildTourTimeline(tm.data, Math.round(tm.yearFloat), reducedRef.current);
        r.t0 = clock;
        r.fired = new Set();
        r.paused = null;
        // The exit's own cue, computed off the flatline rather than off the
        // tour's end: the addendum starts the exit clock "when the finale's
        // closing shot has held FINALE_HOLD after the flatline cue". Capped at
        // the timeline's end so a shorter (decade-only) data file, whose finale
        // hold may be under FINALE_SPLIT + FINALE_HOLD, still exits rather than
        // running past its last frame.
        r.exitAt = finaleExitAt(r.tl);
        // The tour opens on a rewind: nothing was "just left", and the first
        // detent the engine sees must not read as a crossing.
        clearAccents(tm);
        accentRef.current.detent = Math.round(tm.yearFloat);
        accentRef.current.crossedAt = nowMs;
      }

      // Harness seek: reposition the clock, replay the state cues up to it, and
      // hold the frame. One-shot effects (the shockwave, camera moves) only
      // replay if they belong to the moment being captured.
      if (r.pendingSeek != null) {
        const pi = r.pendingSeek;
        r.pendingSeek = null;
        const i = Math.max(0, Math.min(r.tl.pauses.length - 1, Math.floor(pi)));
        const target = r.tl.pauseAt[i] + (pi - i) * r.tl.pauses[i].hold;
        r.t0 = clock - target;
        r.paused = target;
        r.fired = new Set();
        // Camera cues are framing state, not one-shot effects: only the most
        // recent one before the target is replayed, and it always is, so a
        // seeked pause is framed the way the played pause would be.
        let lastCam = null;
        for (let k = 0; k < r.tl.cues.length; k++) {
          const c = r.tl.cues[k];
          if (c.t > target) break;
          r.fired.add(k);
          // A leg's truck and dolly are relative to the camera at the moment
          // the leg opened, so they mean nothing replayed from a seeked seat:
          // a seeked frame is defined by its pause's own cue, which is always
          // the later one. Marked fired, never run.
          if (c.kind === 'camera-leg') continue;
          if (c.kind === 'camera-home' || c.kind === 'camera-node') { lastCam = c; continue; }
          if (c.effect && target - c.t > 0.4) continue;
          runCue(c, r.caps, reducedRef.current);
        }
        if (lastCam) runCue(lastCam, r.caps, reducedRef.current);
        tm.yearFloat = tourYearAt(r.tl.segs, target);
        tm.targetYear = tm.yearFloat;
        // A seek is a jump, not a crossing: drop anything the accents were
        // holding and re-seat the detent so the frame after a seek does not
        // fire a shell for a year the viewer never watched go by.
        clearAccents(tm);
        accentRef.current.detent = Math.round(tm.yearFloat);
        accentRef.current.crossedAt = nowMs;
        return;
      }

      const t = r.paused != null ? r.paused : clock - r.t0;
      let y = tourYearAt(r.tl.segs, t);
      if (y < 0) y = 0;
      if (y > maxY) y = maxY;
      tm.yearFloat = y;
      tm.targetYear = y;

      if (r.paused != null) { tm.rate = 0; return; }

      // Gate G2's input on the tour: the rate of the segment the clock is
      // inside, straight off the timeline, and zero in every dwell and hold. The
      // gate and the rail read the same number here, because a boarded segment
      // rate is both what the step travelled at and what the numeral is doing.
      const segRate = tourRateAt(r.tl.segs, t);
      stepAccents(tm, segRate, segRate, nowMs);

      for (let k = 0; k < r.tl.cues.length; k++) {
        if (!r.fired.has(k) && t >= r.tl.cues[k].t) {
          r.fired.add(k);
          runCue(r.tl.cues[k], r.caps, reducedRef.current);
        }
      }

      // The film ends at home. The closing shot holds FINALE_HOLD seconds past
      // the flatline, then the 2.60 s exit takes the viewer to the home screen
      // with the instrument in the header. Only reachable from an untouched
      // tour: any input before this moment has already run the window-level
      // handover, which drops r.exitAt and leaves the rail with the viewer.
      if (r.exitAt != null && t >= r.exitAt) {
        tm.targetYear = Math.round(tm.yearFloat);
        beginExit(clock);
      }
    } else if (tm.active) {
      // idle, but still blending out: ramp the exit mix, then hand radius fully
      // back to DiseaseNodes' own morph. 1.10 s on every close, automatic or
      // manual ("closing again runs the same 1.10 s radius blend home").
      velRef.current = 0;
      if (r.tl) { r.tl = null; r.paused = null; r.pendingSeek = null; }
      r.exitAt = null; // the machine is closing; nothing left to hand over
      // Accents belong to the instrument, not to the galaxy it exits into: no
      // orphan shell survives the close, and no settle is left half-applied
      // while the radius blends home.
      if (tm.settles.length || accentRef.current.detent >= 0) clearAccents(tm);
      const ex = exitRef.current;
      let dur = EXIT_DUR;
      let hold = 0;
      if (ex && !ex.landed) {
        // Inside the automatic choreography the blend is a staged channel: it
        // waits out the rail's 100 ms head start, and a skip or reduced motion
        // compresses it to their own single durations.
        if (ex.mode === 'fast') dur = TM_EXIT_FAST / 1000;
        else if (ex.mode === 'reduced') dur = TM_EXIT_REDUCED / 1000;
        else hold = TM_EXIT.radius.at / 1000;
      }
      if (!ex || ex.landed || state.clock.getElapsedTime() - ex.t0 >= hold) {
        tm.exit += dt / dur;
        if (tm.exit >= 1) {
          tm.exit = 0;
          tm.enter = 1;
          tm.stagger = true;
          tm.active = false;
        }
      }
    }
  });

  // Almost entirely a null-rendering engine; the one exception is the 2020
  // flash mesh, an isolated additive sprite that touches nothing else in the
  // scene (no shared uniform, no ignite amount), so it cannot bloom anything
  // but itself. It carries no geometry/material of its own here — allocFlash/
  // disposeFlash wire those in only while a flash is actually live.
  return <mesh ref={flashMeshRef} visible={false} frustumCulled={false} />;
}
