import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { buildTimeMachineData } from '../utils/timeMachineData';
import { fmtFull, fmtWord } from '../utils/captions';
import { fireRipple } from './SelectionRipple';
import { DUR, springStep } from '../utils/motion';
import { morphRadiusAt } from './DiseaseNodes';

// The scrub engine's critically damped spring (DIRECTION section 3, scrubber
// interaction feel: "each node follows its target through a critically
// damped spring with a 120ms time constant").
const TAU = DUR.tick / 1000;

// The 2020 detonation's white-core flash (DIRECTION section 3, pause 3):
// exactly 12 rendered frames, the same literal-frame-count technique the
// rail's own detent pip uses (TimeRail.jsx `pipFrames`).
const FLASH_FRAMES = 12;
const FLASH_COLOR = 0xfff3e0; // black-body white-hot core, DIRECTION section 1

// Exit blend duration: how long `tm.exit` takes to ramp 0->1 after
// stopTimeMachine(), mixing the last Time Machine radius toward the normal
// papers/mortality radius before DiseaseNodes stops calling radiusAt at all.
const EXIT_DUR = 0.4;

// ─── Tour vocabulary (DIRECTION section 3 + 4) ───────────────────────────────
// Sanctioned constants only: a year-step is 650 ms, the rewind is two of them,
// and no single leg runs longer than six (3.9 s). The cap is what keeps the
// quiet stretch between the HIV surge and 2019 a sweep rather than a wait: 23
// year-steps at the full rate would be fifteen seconds of nothing happening.
const STEP = 0.65;
const LEG_CAP_STEPS = 6;
const REWIND = 2 * STEP;
// Inside the finale hold: the cooling line reads first, then the galaxy dims
// around rheumatic heart disease and the flatline caption takes the frame.
const FINALE_SPLIT = 1.8;
// The 2020 camera move: a micro push-in onto the node that detonates, 15
// percent closer, so the shockwave leaves frame center rather than a corner.
const PUSH_IN = 0.85;
const COVID_EMBER = '#ff4d1a';
// The finale's isolation reaches the halos too: HighlightSystem can only dim
// instance colors, and an undimmed additive glow would keep 152 diseases
// burning around the one that never surged. Ramped over 480 ms, released the
// moment the focus does.
const FINALE_GLOW = 0.55;
const GLOW_RAMP = 0.48;

export const TOUR_HOLDS = [3.0, 3.5, 3.0, 4.0, 3.0, 4.5];

// How long the film's hand-off waits before the auto-tour offers itself, and
// how long the finale's closing shot holds before it tells the viewer the rail
// is theirs (review gate F6).
const TOUR_ARM_DELAY = 1500;
const FINALE_HANDOVER = 2.5;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeExpoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
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
    segs.push({ t0: 0, t1: rewindDur, from: startYearIdx, to: pauses[0].yearIdx, ease: easeExpoOut });
    t = rewindDur;
  }

  for (let i = 0; i < pauses.length; i++) {
    const p = pauses[i];
    if (i > 0) {
      const from = pauses[i - 1].yearIdx;
      const steps = Math.abs(p.yearIdx - from);
      const dur = reduced ? 0 : Math.min(steps, LEG_CAP_STEPS) * STEP;
      const detonation = p.kind === 'detonation';
      // The push-in rides the year-step itself, so the move and the eruption
      // are one gesture rather than two.
      if (detonation) cues.push({ t, kind: 'camera-node', node: 'covid-19', factor: PUSH_IN, dur: reduced ? 0 : STEP, effect: true });
      segs.push({ t0: t, t1: t + dur, from, to: p.yearIdx, ease: detonation && !reduced ? easeBackOut : easeExpoOut });
      t += dur;
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
      if (p.kind === 'hivSurge') cues.push({ t, kind: 'camera-node', node: 'hiv-aids', factor: 0.80, effect: true });
      if (p.kind === 'hivFade') cues.push({ t, kind: 'camera-node', node: 'hiv-aids', factor: 0.62, effect: true });
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
    const fadeYear = Math.min(2019, last);
    caps.hivFade = {
      lines: ['Attention faded long before the epidemic did.'],
      data: `${hiv.label}: ${fmtFull(pk.value)} papers at its ${pk.year} peak, ${fmtFull(valueAt(hiv, fadeYear))} in ${fadeYear}. ${fmtWord(hiv.mortality)} people still die of it every year.`,
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
export default function TimeMachine() {
  const tmRef = useRef(null);
  const velRef = useRef(0);
  const tourRef = useRef({ tl: null, caps: null, t0: 0, fired: null, paused: null, pendingSeek: null, handoverAt: null });
  // The auto-tour's one-shot slot. Spent only when the tour actually opens (or
  // when the viewer opens the Time Machine themselves) — never by a timer that
  // came due and found the field busy. See tourGate above.
  const tourConsumedRef = useRef(false);
  const tourTimerRef = useRef(null);
  const glowRef = useRef(0);
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

    const tm = {
      active: false,
      yearFloat: lastYear,
      targetYear: lastYear,
      data,
      exit: 0,
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
      const tmR = r0 + (r1 - r0) * frac;
      if (tm.exit <= 0) return tmR;

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
      return tmR + (normalR - tmR) * tm.exit;
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
      if (s.tmPhase === 'tour') {
        const tm = tmRef.current;
        if (tm) tm.targetYear = Math.round(tm.yearFloat);
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
        tourRef.current.handoverAt = null;
        useStore.getState().setTmFocusIdx(-1);
        useStore.getState().startTimeMachine(true);
        useStore.getState().setTmPhase('tour');
        tourRef.current.pendingSeek = pauseIndex;
        return waitFrames(frames);
      },
      resume: () => { tourRef.current.paused = null; },
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

  useFrame((state, delta) => {
    const tm = tmRef.current;
    const dt = delta > 0.05 ? 0.05 : delta; // clamp so a stalled tab doesn't fling the spring
    const store = useStore.getState();
    const tmPhase = store.tmPhase;
    const maxY = tm.data.nYears - 1;
    const r = tourRef.current;

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

    // Halo suppression follows the finale's focus, and only ever writes the
    // shared grade channel when it has something to say (the film owns it
    // while it plays).
    const glowTarget = store.tmFocusIdx >= 0 ? FINALE_GLOW : 0;
    if (!store.overtureActive && (glowTarget > 0 || glowRef.current > 0.001)) {
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
      // The finale's own handover (review gate F6). A tour that ends naturally
      // used to leave the closing shot up with nothing telling the viewer the
      // rail was now theirs — only an interrupt ever printed "Scrub the
      // decades." After FINALE_HANDOVER seconds on the held frame, the same
      // chip the interrupt path sets goes up here too. The isolation itself
      // stays: the closing shot is the point, and TimeRail's first scrub
      // releases it exactly as before.
      if (r.handoverAt != null && state.clock.getElapsedTime() >= r.handoverAt) {
        r.handoverAt = null;
        // Only if the finale is still the frame. Any input in the meantime has
        // already run the window-level handover, which clears the focus and
        // sets this same chip; re-setting it here would restart its 2.6 s life.
        if (store.tmFocusIdx >= 0 && store.tmCaption && !store.tmCaption.handover) {
          store.setTmCaption(r.caps ? r.caps.handover : { lines: ['Scrub the decades.'], handover: true });
        }
      }
      const target = tm.targetYear < 0 ? 0 : (tm.targetYear > maxY ? maxY : tm.targetYear);
      const [ny, nv] = springStep(tm.yearFloat, velRef.current, target, dt, TAU);
      velRef.current = nv;
      tm.yearFloat = ny;
      if (tm.yearFloat < 0) tm.yearFloat = 0;
      if (tm.yearFloat > maxY) tm.yearFloat = maxY;
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
        r.handoverAt = null;
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
          if (c.kind === 'camera-home' || c.kind === 'camera-node') { lastCam = c; continue; }
          if (c.effect && target - c.t > 0.4) continue;
          runCue(c, r.caps, reducedRef.current);
        }
        if (lastCam) runCue(lastCam, r.caps, reducedRef.current);
        tm.yearFloat = tourYearAt(r.tl.segs, target);
        tm.targetYear = tm.yearFloat;
        return;
      }

      const t = r.paused != null ? r.paused : clock - r.t0;
      let y = tourYearAt(r.tl.segs, t);
      if (y < 0) y = 0;
      if (y > maxY) y = maxY;
      tm.yearFloat = y;
      tm.targetYear = y;

      if (r.paused != null) return;

      for (let k = 0; k < r.tl.cues.length; k++) {
        if (!r.fired.has(k) && t >= r.tl.cues[k].t) {
          r.fired.add(k);
          runCue(r.tl.cues[k], r.caps, reducedRef.current);
        }
      }

      if (t >= r.tl.end) {
        // The closing shot stays on screen: the flatline caption and its
        // isolation hold until the viewer touches the rail. All the handover
        // does is give them the scrubber, at the year they are looking at —
        // and, FINALE_HANDOVER seconds later, say so (the scrub branch above).
        tm.targetYear = Math.round(tm.yearFloat);
        r.handoverAt = clock + FINALE_HANDOVER;
        useStore.getState().setTmPhase('scrub');
      }
    } else if (tm.active) {
      // idle, but still blending out: ramp the 400ms exit mix, then hand
      // radius fully back to DiseaseNodes' own morph.
      velRef.current = 0;
      if (r.tl) { r.tl = null; r.paused = null; r.pendingSeek = null; }
      r.handoverAt = null; // the machine is closing; nothing left to hand over
      tm.exit += dt / EXIT_DUR;
      if (tm.exit >= 1) {
        tm.exit = 0;
        tm.active = false;
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
