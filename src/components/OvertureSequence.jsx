import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { fmtWord } from '../utils/captions';

// ─── The Gap: the cinematic opening ──────────────────────────────────────────
// Null-rendering FSM. Everything continuous (grade, radius morph, glow) is a
// pure function of the beat clock and is written into sceneRefs.fx each frame;
// everything discrete (captions, beat number, UI reveal) is a cue fired once as
// the clock crosses it. That split is what makes the film seekable: the verify
// harness can jump to any second and get the exact frame the direction board
// asks for, and the skip path can rebuild the timeline mid-flight without any
// hidden animation state to unwind.
//
// Beat board: docs/direction/2026-08-11-cinematic-direction.md section 2.

// ── Curve vocabulary (DIRECTION section 4: sanctioned easings) ──
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
export const sramp = (t, a, b) => smooth(ramp(t, a, b));

// Camera easings are plain functions so the identical curve drives both the
// gsap tween inside CameraRig and the analytic seek used by the harness.
const easeSineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
const easeExpoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
// Release glide: decelerating like a critically damped spring but arriving with
// a deliberate residual rate (RESIDUAL x the average rate). That residual is
// the velocity handed to the orbit controls, so the film does not stop before
// the instrument starts. See the handover block below.
const RESIDUAL = 0.22;
export const easeGlide = (p) => 1 - Math.pow(1 - p, 3) * (1 - RESIDUAL) - (1 - p) * RESIDUAL;

// ── Beat clock (seconds from the end of assembly) ──
const T_B1 = 0.0;          // beat 1, attention        5.0 s
const T_B2 = 5.0;          // beat 2, the morph        7.0 s
const T_B3 = 12.0;         // beat 3, release          4.5 s
const T_END = 16.5;
const T_SUPPRESS = T_B2 + 1.2;   // palette drained to graphite
const T_HERO = T_B2 + 2.6;       // the hero caption + the ignition swell
const T_IGNITE_END = T_B2 + 4.6; // radii + burn fully landed

// Release internals, relative to the start of beat 3 (shared by the normal and
// the compressed paths so a skipped film releases exactly like a watched one).
const R_GRADE = 1.5;       // category color + burn cool over 1.5 s
const R_EMBER_0 = 0.5, R_EMBER_1 = 2.0;
const R_MORPH_HOLD = 2.0;  // deaths sizing held, then it teaches the toggle
const R_MORPH_END = 3.2;
const R_GLIDE = 2.6;       // camera glide duration
export const HANDOVER_LEAD = 0.3; // last 300 ms of the glide arm the orbit controls
export const HANDOVER_DECAY = 1.0;
export const REST_ROTATE_SPEED = 0.3; // OrbitControls autoRotateSpeed at rest

// Compressed (skip) path, relative to the moment of the skip.
const C_SUPPRESS = 0.35;
const C_MORPH_END = 1.2;   // 1.2 s papers→deaths cross-fade with the ignite flash
const C_HOLD_END = 2.7;    // hero caption held 1.5 s, then release

const REDUCED_DISSOLVE = 0.3; // reduced motion: held frames, 300 ms dissolves

// Beat 2's hero dominance (review gate F4, "two comparable flares"). Every
// node's ignite weight is raised to this power before the black-body ramp.
// The weights themselves are data (src/utils/igniteWeights.js) and stay data —
// this shapes how the film *presents* them, not who burns. Sepsis is the only
// node that reaches exactly 1.0, so pow() leaves the hero untouched and pulls
// the field down behind it: the nearest competitor, COPD at 0.895, drops to
// 0.717. Measured at the hero-caption frame (t=8.2, 1440x900, 120px box
// around each node): COPD's mean luminance was 88 percent of sepsis's and its
// core blew out white — the frame the review shot. At 3.0 it reads 52 percent
// with 1,193 bright pixels against sepsis's 5,104, and sepsis itself is
// unmoved (125.9 -> 125.0). The mid-field smolder survives: the sampled
// mid-field box moves 44.3 -> 41.9. Nothing outside the film reads this
// channel — `ignite` is 0 the moment the release finishes.
const HERO_CONTRAST = 3.0;
const contrastAt = (p) => 1 + (HERO_CONTRAST - 1) * p;

// Sound (DIRECTION section 5, moments 1-3). Every call site guard-calls the
// global so a session with sound never initialized costs nothing.
const playSound = (name) => { if (typeof window !== 'undefined') window.__mgAudio?.play?.(name); };

// ── Camera seats, as multiples of R0 (camDist) ──
export const SEAT = {
  // ADDENDUM 1 section 3: beat 0's opening seat moves out to 2.9 R0 to hold the
  // spawn shell in frame. CameraRig owns the drift itself (assemblySeat()); this
  // entry is the board's record of where the piece starts.
  assembly: { m: 2.9, az: 0, el: 12 },
  attention0: { m: 1.5, az: 0, el: 12 },
  attention1: { m: 1.15, az: 4, el: 10 },
  morph: { m: 1.45, az: 6, el: 12 },
  // Portrait's beat-2 seat (review gate F7). The camera's 60 degree field is
  // vertical, so a 375x812 frame has barely 30 degrees across — the seat that
  // frames the field on a 1440x900 desktop runs the hero off the right edge on
  // a phone. Measured at the ignite landing (t=9.6): sepsis projected to x=323
  // of 375 with a 14.7px radius and a bloom halo several times that, clipped by
  // the bezel; the field's own bounds ran -14..387. Pulling the seat back by
  // the same 1.35 the framing was short by lands sepsis near x=288 with the
  // whole field inside the frame. Portrait only — a landscape tablet has the
  // width the desktop seat assumes.
  morphPortrait: { m: 1.45 * 1.35, az: 6, el: 12 },
  rest: { m: 1.0, az: -15, el: 8 },
};

// Beat 2's seat depends on the frame's shape, not on the input device: a
// portrait window is the thing that cannot hold the desktop framing.
function isPortrait() {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
}

export function seatPos(camDist, s) {
  const r = camDist * s.m;
  const el = (s.el * Math.PI) / 180;
  const az = (s.az * Math.PI) / 180;
  const c = Math.cos(el);
  return [r * c * Math.sin(az), r * Math.sin(el), r * c * Math.cos(az)];
}

// Straight Cartesian interpolation under the segment's ease: byte-for-byte what
// gsap.to(camera.position, {...}) produces, so seek and playback agree.
function segPos(seg, t, camDist) {
  const from = seg.fromPos || seatPos(camDist, seg.from);
  const to = seatPos(camDist, seg.to);
  const e = seg.ease(clamp01((t - seg.t0) / (seg.t1 - seg.t0)));
  return [
    from[0] + (to[0] - from[0]) * e,
    from[1] + (to[1] - from[1]) * e,
    from[2] + (to[2] - from[2]) * e,
  ];
}

function camAt(segments, t, camDist) {
  let cur = null;
  for (const sg of segments) if (t >= sg.t0) cur = sg;
  if (!cur) return null;
  return segPos(cur, t, camDist);
}

// Angular rate about the orbit axis at time t, in OrbitControls speed units.
// autoRotate decreases theta, so a camera whose azimuth is falling hands over a
// positive speed; anything else hands over the resting drift instead.
export function handoverSpeed(seg, t, camDist) {
  const dt = 0.05;
  const a = segPos(seg, t - dt, camDist);
  const b = segPos(seg, t, camDist);
  const dTheta = Math.atan2(b[0], b[2]) - Math.atan2(a[0], a[2]);
  const omega = dTheta / dt;               // rad/s, negative = autoRotate's way
  const speed = (-omega * 60) / (2 * Math.PI);
  return clamp01(speed / 3) * 3;           // clamp to [0, 3]
}

// ── Captions. Every numeral is derived from the live data. ──
const DIES = 'But this is who actually dies.';

function buildCaptions(diseases, idMap) {
  const heroIdx = idMap.sepsis;
  const hero = heroIdx !== undefined ? diseases[heroIdx] : null;
  return {
    attention: () => ({
      lines: ["Where the world's attention goes."],
      data: `${diseases.length} diseases, sized by research papers on record.`,
    }),
    dies: () => ({ lines: [DIES] }),
    // The thesis frame carries both sentence lines at once: line one stays put
    // and the hero joins beneath it, plus the odometer. That is exactly the
    // budget (DIRECTION section 1: never more than two sentence lines plus one
    // data line). heroLine tells the caption which line takes hero typography;
    // line one steps down to the lead style as the hero lands.
    hero: () =>
      hero
        ? {
            lines: [DIES, `${hero.label} kills ${fmtWord(hero.mortality)} people a year.`],
            heroLine: 1,
            odometer: {
              from: hero.papers,
              fromUnit: 'papers',
              to: hero.mortality,
              toUnit: 'deaths every year',
            },
          }
        : { lines: [DIES] },
    explore: () => ({ lines: ['Explore the gap.'] }),
  };
}

// ── Continuous channels ──
function releaseFx(r, o) {
  const back = sramp(r, 0, R_GRADE);
  o.desat = 1 - back;
  o.glow = 1 - back;
  o.ignite = 1 - back;
  // Held, not released: the burn fades out on `ignite` alone, so the field
  // never brightens back toward the hero on its way to black.
  o.contrast = HERO_CONTRAST;
  o.ember = sramp(r, R_EMBER_0, R_EMBER_1);
  o.morph =
    r < R_MORPH_HOLD ? 1 : r >= R_MORPH_END ? null : 1 - sramp(r, R_MORPH_HOLD, R_MORPH_END);
}

function fxNormal(t, o) {
  if (t < T_B2) {
    // Beat 1: the instrument comes up to full color and holds.
    o.desat = 1 - sramp(t, 0, 1.0);
    o.ignite = 0;
    o.ember = 0;
    o.glow = 0;
    o.morph = 0;
    o.contrast = 1;
  } else if (t < T_B3) {
    // Beat 2: suppression first, then the burn. Ignite is eased in (pow > 1) so
    // the eye reads deflation before it reads fire.
    o.desat = sramp(t, T_B2, T_SUPPRESS);
    o.glow = o.desat;
    o.morph = sramp(t, T_SUPPRESS, T_IGNITE_END);
    o.ignite = Math.pow(sramp(t, T_SUPPRESS, T_IGNITE_END), 1.35);
    o.ember = 0;
    // The hero's dominance is complete by the frame that names the hero. It
    // rides the first half of the burn (suppression -> hero caption) rather
    // than the whole ignite ramp: the finding's own frame is the caption
    // moment, and a separation that only finished a second later still left
    // two comparable flares under the sentence that names one of them.
    o.contrast = contrastAt(sramp(t, T_SUPPRESS, T_HERO));
  } else {
    releaseFx(t - T_B3, o);
  }
}

function fxReduced(t, o) {
  const D = REDUCED_DISSOLVE;
  if (t < T_B2) {
    o.desat = 1 - ramp(t, 0, D);
    o.ignite = 0; o.ember = 0; o.glow = 0; o.morph = 0; o.contrast = 1;
  } else if (t < T_B3) {
    o.desat = ramp(t, T_B2, T_B2 + D);
    o.glow = o.desat;
    o.morph = ramp(t, T_SUPPRESS, T_SUPPRESS + D);
    o.ignite = ramp(t, T_SUPPRESS, T_SUPPRESS + D);
    o.ember = 0;
    o.contrast = contrastAt(ramp(t, T_SUPPRESS, T_SUPPRESS + D));
  } else {
    const r = t - T_B3;
    const back = ramp(r, 0, D);
    o.desat = 1 - back;
    o.glow = 1 - back;
    o.ignite = 1 - back;
    o.ember = ramp(r, 0, D);
    o.contrast = HERO_CONTRAST;
    o.morph =
      r < R_MORPH_HOLD ? 1 : r >= R_MORPH_HOLD + D ? null : 1 - ramp(r, R_MORPH_HOLD, R_MORPH_HOLD + D);
  }
}

function fxCompressed(t, o, s0) {
  if (t < C_HOLD_END) {
    o.desat = s0.desat + (1 - s0.desat) * sramp(t, 0, C_SUPPRESS);
    o.glow = s0.glow + (1 - s0.glow) * sramp(t, 0, C_SUPPRESS);
    o.morph = s0.morph + (1 - s0.morph) * sramp(t, 0, C_MORPH_END);
    o.ignite = s0.ignite + (1 - s0.ignite) * Math.pow(sramp(t, C_SUPPRESS, C_MORPH_END), 1.2);
    o.ember = 0;
    // Same rule on the compressed path: landed by the hero caption, which the
    // skip fires at C_SUPPRESS.
    const c0 = s0.contrast != null ? s0.contrast : 1;
    o.contrast = c0 + (HERO_CONTRAST - c0) * sramp(t, 0, C_SUPPRESS);
  } else {
    releaseFx(t - C_HOLD_END, o);
  }
}

// ── Timeline builders ────────────────────────────────────────────────────────
function fullCues(CAP, releaseAt, endAt) {
  return [
    { t: T_B1, run: (s) => s.setOvertureBeat(1) },
    { t: T_B1 + 0.35, run: (s) => s.setOvertureCaption(CAP.attention()) },
    { t: T_B2 - 0.3, run: (s) => s.setOvertureCaption(null) },
    { t: T_B2, run: (s) => s.setOvertureBeat(2) },
    { t: T_B2 + 1.4, run: (s) => s.setOvertureCaption(CAP.dies()) },
    // The odometer-flip moment: the hero caption and the ignition swell land together.
    { t: T_HERO, run: (s) => { s.setOvertureCaption(CAP.hero()); playSound('ignition'); } },
    ...releaseCues(CAP, releaseAt, endAt),
  ];
}

function releaseCues(CAP, r0, endAt) {
  return [
    { t: r0, run: (s) => { s.setOvertureBeat(3); s.setUiRevealed(true); playSound('release'); } },
    { t: r0 + 0.6, run: (s) => s.setOvertureCaption(CAP.explore()) },
    { t: endAt - 0.7, run: (s) => s.setOvertureCaption(null) },
    // The bottom band (hint chips + story chips) waits for the release caption
    // to leave rather than being nudged clear of it (review gate F2): the card
    // sits at bottom:110 desktop / 90 mobile and the chips at bottom:50 / 32,
    // so on both viewports they were sharing the same band — "Explore the gap."
    // printed straight over the story row (rg1-09, rg1-42). The caption's null
    // cue fires 300 ms before this one and OvertureCaption's exit fade is
    // 200 ms, so the band is never revealed while any of that card is still on
    // screen. `hintsShown` gates both rows; finishOverture sets it too, which
    // is what covers a film that ends early.
    { t: endAt - 0.4, run: () => useStore.setState({ hintsShown: true }) },
    { t: endAt, run: (s) => s.finishOverture() },
  ];
}

function buildNormal(CAP) {
  const morph = isPortrait() ? SEAT.morphPortrait : SEAT.morph;
  return {
    kind: 'normal',
    fx: fxNormal,
    end: T_END,
    beatAt: (t) => (t < T_B2 ? 1 : t < T_B3 ? 2 : 3),
    segments: [
      { t0: T_B1, t1: T_B1 + 5.0, from: SEAT.attention0, to: SEAT.attention1, ease: easeExpoOut },
      { t0: T_B2, t1: T_B2 + 2.5, from: SEAT.attention1, to: morph, ease: easeSineInOut },
      { t0: T_B3, t1: T_B3 + R_GLIDE, from: morph, to: SEAT.rest, ease: easeGlide },
    ],
    cues: fullCues(CAP, T_B3, T_END),
  };
}

function buildReduced(CAP) {
  return {
    kind: 'reduced',
    fx: fxReduced,
    end: T_END,
    beatAt: (t) => (t < T_B2 ? 1 : t < T_B3 ? 2 : 3),
    // Reduced motion holds one frame for the whole film: every camera move is
    // replaced by stillness, and the state changes are the 300 ms dissolves in
    // fxReduced. The seat is beat 1's, wide enough to hold the whole field.
    segments: [],
    seat: SEAT.attention0,
    cues: fullCues(CAP, T_B3, T_END),
  };
}

// Skip: never a hard cut. 1.2 s cross-fade with the ignite flash, hero caption
// held 1.5 s, then the release beat at its normal speed.
function buildCompressed(CAP, snapshot, fromPos, reduced) {
  const end = C_HOLD_END + (T_END - T_B3);
  const morph = isPortrait() ? SEAT.morphPortrait : SEAT.morph;
  return {
    kind: 'compressed',
    fx: (t, o) => fxCompressed(t, o, snapshot),
    end,
    beatAt: (t) => (t < C_HOLD_END ? 2 : 3),
    // Reduced motion keeps its held frame through the skip too: the compressed
    // morph plays as a state change, with no camera move under it.
    segments: reduced ? [] : [
      { t0: 0, t1: C_MORPH_END, fromPos, to: morph, ease: easeSineInOut },
      { t0: C_HOLD_END, t1: C_HOLD_END + R_GLIDE, from: morph, to: SEAT.rest, ease: easeGlide },
    ],
    cues: [
      { t: 0, run: (s) => s.setOvertureBeat(2) },
      { t: C_SUPPRESS, run: (s) => { s.setOvertureCaption(CAP.hero()); playSound('ignition'); } },
      ...releaseCues(CAP, C_HOLD_END, end),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OvertureSequence({ camDist }) {
  const ref = useRef({
    tl: null,
    startedAt: null,
    fired: null,
    paused: null,
    pendingSeek: null,
    lastBeat: -1,
    camDispatched: null,
    handoverArmed: false,
    reduced: false,
    fx: { desat: 1, ignite: 0, ember: 0, glow: 0, morph: 0, contrast: 1 },
  });

  // Beat 0 grade: the assembly is near-monochrome from the first painted frame.
  useEffect(() => {
    const s = useStore.getState();
    if (s.overtureDone) return;
    ref.current.reduced =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sceneRefs.fx.desat = 1;
    sceneRefs.fx.morphOverride = 0;
    sceneRefs.fx.ignite = 0;
    sceneRefs.fx.ember = 0;
    sceneRefs.fx.glowSuppress = 0;
    sceneRefs.fx.igniteContrast = 1;
    sceneRefs.handover.speed = null;
    sceneRefs.handover.cancelled = false;
  }, []);

  // Dev hook: deterministic beat capture for the verify harness.
  //   await window.__overture.seek(9.6)  → jump the beat clock, hold the frame
  //   window.__overture.resume()         → let it play on
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const waitFrames = (n) =>
      new Promise((res) => {
        let k = n;
        const tick = () => (--k <= 0 ? res(true) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
    window.__overture = {
      seek: (t, frames = 12) => {
        const s = useStore.getState();
        if (s.overtureDone) return Promise.resolve(false);
        if (!s.introStarted || s.introPhase < 5) s.skipIntro();
        // The intro's per-node scale lerp would still be climbing; land it so a
        // seeked frame is the frame the board describes.
        if (sceneRefs.introScales) sceneRefs.introScales.fill(1);
        if (!s.overtureActive) useStore.getState().startOverture();
        ref.current.pendingSeek = t;
        return waitFrames(frames);
      },
      resume: () => { ref.current.paused = null; },
      state: () => {
        const r = ref.current;
        return {
          kind: r.tl ? r.tl.kind : null,
          t: r.paused != null ? r.paused : null,
          beat: useStore.getState().overtureBeat,
          fx: { ...sceneRefs.fx },
        };
      },
    };
    return () => { delete window.__overture; };
  }, []);

  useFrame((state) => {
    const r = ref.current;
    const store = useStore.getState();
    const clock = state.clock.getElapsedTime();

    if (!store.overtureActive) {
      if (store.introStarted && !store.overtureDone) {
        store.startOverture();
        // Beat 0, assembly: the granular shimmer bed fades in with the
        // filaments (moment 1). IntroSequence owns the visual; this is the
        // earliest frame the film itself is live to cue from.
        playSound('assembly');
      }
      return;
    }

    // ── Beat 0: assembly. The intro owns the scene; the film waits, holding
    // the monochrome grade and the papers sizing. Skips chain straight through.
    if (store.introPhase < 5) {
      sceneRefs.fx.desat = 1;
      sceneRefs.fx.morphOverride = 0;
      if (store._overtureSkip) store.skipIntro();
      else return;
    }

    // ── Timeline construction ──
    if (!r.tl) {
      const { diseases, idMap } = store;
      const CAP = buildCaptions(diseases, idMap);
      r.CAP = CAP;
      r.tl = r.reduced ? buildReduced(CAP) : buildNormal(CAP);
      r.startedAt = clock;
      r.fired = new Set();
      r.camDispatched = new Set();
      r.lastBeat = -1;
      if (r.tl.seat && sceneRefs.cameraJump) {
        const p = seatPos(camDist, r.tl.seat);
        sceneRefs.cameraJump(p[0], p[1], p[2]);
      }
    }

    // ── Skip request: rebuild the timeline compressed, from wherever we are ──
    if (store._overtureSkip && r.paused == null) {
      useStore.setState({ _overtureSkip: false });
      const tNow = clock - r.startedAt;
      // Nobody leaves without meeting the thesis (DIRECTION 6.9). A second
      // input (trackpad momentum, a double click's second pointerdown, key
      // auto-repeat) arrives milliseconds after the first and must not cut the
      // hero caption: an early finish is only allowed once the thesis has
      // actually landed, which on the compressed path means the hero hold has
      // run out. Otherwise the request is consumed and ignored.
      const landed = r.tl.kind === 'compressed' ? tNow >= C_HOLD_END : tNow >= T_B3;
      if (landed) {
        // Already releasing: the thesis has landed, hand over now.
        store.finishOverture();
        r.tl = null;
        return;
      }
      // Mid-thesis on the compressed path the flag is simply spent: the film
      // keeps playing and this frame falls through as normal.
      if (r.tl.kind !== 'compressed') {
        const cam = sceneRefs.camera;
        const fromPos = cam ? [cam.position.x, cam.position.y, cam.position.z] : seatPos(camDist, SEAT.attention1);
        r.tl = buildCompressed(r.CAP, { ...r.fx }, fromPos, r.reduced);
        r.startedAt = clock;
        r.fired = new Set();
        r.camDispatched = new Set();
        sceneRefs.handover.speed = null;
        // The skip gesture itself reaches the orbit controls and cancels the
        // handover; the compressed film still has a release to hand over from.
        sceneRefs.handover.cancelled = false;
        r.handoverArmed = false;
      }
    }

    const tl = r.tl;
    const t = r.paused != null ? r.paused : clock - r.startedAt;

    // ── Seek (harness): reposition the clock, replay cue state, jump camera ──
    if (r.pendingSeek != null) {
      const target = r.pendingSeek;
      r.pendingSeek = null;
      r.startedAt = clock - target;
      r.paused = target;
      r.fired = new Set();
      r.camDispatched = new Set();
      for (let i = 0; i < tl.cues.length; i++) {
        if (tl.cues[i].t <= target && tl.cues[i].t < tl.end) {
          r.fired.add(i);
          tl.cues[i].run(useStore.getState());
        }
      }
      for (let i = 0; i < tl.segments.length; i++) if (tl.segments[i].t0 <= target) r.camDispatched.add(i);
      const p = camAt(tl.segments, target, camDist) ||
        seatPos(camDist, tl.seat || SEAT.attention0);
      if (sceneRefs.cameraJump) sceneRefs.cameraJump(p[0], p[1], p[2]);
      return;
    }

    // ── Continuous channels ──
    const o = r.fx;
    tl.fx(t, o);
    sceneRefs.fx.desat = o.desat;
    sceneRefs.fx.ignite = o.ignite;
    sceneRefs.fx.ember = o.ember;
    sceneRefs.fx.glowSuppress = o.glow;
    sceneRefs.fx.morphOverride = o.morph;
    sceneRefs.fx.igniteContrast = o.contrast != null ? o.contrast : 1;

    if (r.paused != null) return;

    // ── Beat number ──
    const beat = tl.beatAt(t);
    if (beat !== r.lastBeat) {
      r.lastBeat = beat;
      if (store.overtureBeat !== beat) store.setOvertureBeat(beat);
    }

    // ── Camera segments: dispatched once, tweened by CameraRig ──
    for (let i = 0; i < tl.segments.length; i++) {
      const sg = tl.segments[i];
      if (t >= sg.t0 && !r.camDispatched.has(i)) {
        r.camDispatched.add(i);
        const to = seatPos(camDist, sg.to);
        store.setFlyTarget({
          position: [0, 0, 0],
          cameraPos: to,
          duration: sg.t1 - sg.t0,
          ease: sg.ease,
        });
      }
    }

    // ── Velocity-matched handover (DIRECTION 6.1) ──
    // The last 300 ms of the glide arm the orbit controls at the glide's own
    // terminal angular velocity; it then eases to the resting drift over 1 s,
    // so the frame the user first touches is already moving.
    const glide = tl.segments.length ? tl.segments[tl.segments.length - 1] : null;
    if (glide && !sceneRefs.handover.cancelled) {
      const armAt = glide.t1 - HANDOVER_LEAD;
      if (t >= armAt && t <= glide.t1 + HANDOVER_DECAY) {
        if (!r.handoverArmed) {
          r.handoverArmed = true;
          r.handoverBase = handoverSpeed(glide, glide.t1, camDist);
        }
        const base = r.handoverBase;
        sceneRefs.handover.speed =
          t <= glide.t1
            ? base
            : REST_ROTATE_SPEED + (base - REST_ROTATE_SPEED) * (1 - sramp(t, glide.t1, glide.t1 + HANDOVER_DECAY));
      } else if (r.handoverArmed && t > glide.t1 + HANDOVER_DECAY) {
        // Hold the drift at its resting speed for the rest of the film: the
        // overture's own autoRotate guard would otherwise stop the galaxy dead
        // between the handover and the final frame. finishOverture releases the
        // override, and CameraRig's resting rule carries the same 0.3 onward.
        sceneRefs.handover.speed = REST_ROTATE_SPEED;
      }
    }

    // ── Cues ──
    for (let i = 0; i < tl.cues.length; i++) {
      if (!r.fired.has(i) && t >= tl.cues[i].t) {
        r.fired.add(i);
        tl.cues[i].run(useStore.getState());
      }
    }

    if (t >= tl.end && !useStore.getState().overtureActive) {
      r.tl = null; // film finished; nothing left to drive
    }
  });

  return null;
}
