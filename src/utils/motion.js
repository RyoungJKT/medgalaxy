// The motion constitution (DIRECTION section 4): one shared vocabulary for the
// opening film, the Time Machine, and every inherited feature (supernova,
// roulette, spotlight, stories, Attention Map). Nothing outside this file
// should invent its own duration/easing constant for a world or instrument
// motion — import DUR/EASE instead, so a future retiming touches one file.
//
// Two motion families (DIRECTION section 4):
//   World (nodes, camera, dust): critically damped springs, no bounce,
//     duration scales with sqrt of node radius. springStep is that spring.
//   Instrument (UI panels, chips, tooltips): expo.out, 160-240ms. EASE.ui is
//     that curve, as a CSS cubic-bezier so it drives both CSS transitions and
//     inline `animation` declarations identically.
//
// Sanctioned time constants: 120, 180, 240, 320, 480, 650ms. Nothing else,
// and nothing above 700ms outside camera beats and the morph.

export const DUR = { tick: 120, fast: 180, ui: 240, mid: 320, slow: 480, world: 650 };

export const EASE = {
  ui: 'cubic-bezier(0.16,1,0.3,1)', // expo.out, the instrument family
  cameraGsap: 'sine.inOut',         // camera drifts (the "held breath"/"exhale" beats)
  overshoot: 'back.out(1.2)',       // the two sanctioned events only: detonation + supernova pop
};

/**
 * One critically damped spring step (damping ratio 1, no bounce): the world
 * family's only motion. Advances position `x` and velocity `v` toward
 * `target` over `dt` seconds with time constant `tc` (roughly how long it
 * takes to close ~63% of the remaining distance). Used by the Time Machine's
 * scrub engine and node hover.
 * @param {number} x current position
 * @param {number} v current velocity
 * @param {number} target where `x` is headed
 * @param {number} dt elapsed seconds since the last step
 * @param {number} tc spring time constant, in seconds
 * @returns {[number, number]} [nextX, nextV]
 */
export function springStep(x, v, target, dt, tc) {
  const omega = 1 / tc;
  const k = omega * omega;
  const c = 2 * omega;
  const a = k * (target - x) - c * v;
  const nv = v + a * dt;
  const nx = x + nv * dt;
  return [nx, nv];
}

/**
 * Same critically damped step as springStep, but writes into a caller-owned
 * `out` pair instead of allocating a new [x, v] tuple. For hot per-node loops
 * (DiseaseNodes' instancing pass runs this once per node per frame) where a
 * fresh array every iteration is needless GC pressure — pass one scratch pair
 * and read `out[0]`/`out[1]` immediately after the call.
 * @param {[number, number]} out scratch pair, overwritten with [nextX, nextV]
 * @returns {[number, number]} the same `out` array, for chaining/convenience
 */
export function springStepInto(out, x, v, target, dt, tc) {
  const omega = 1 / tc;
  const k = omega * omega;
  const c = 2 * omega;
  const a = k * (target - x) - c * v;
  const nv = v + a * dt;
  const nx = x + nv * dt;
  out[0] = nx;
  out[1] = nv;
  return out;
}

// ── Mass-weighted stagger (DIRECTION section 6 item 5; section 2 beat 2) ──
// "Per-node duration scales with sqrt of target radius so massive nodes move
// slowly, mass made visible." lagFactor turns a node's target radius into a
// 0.35..1 lag L (small movers get the floor, the single biggest mover gets
// 1). staggeredEase turns a *global* 0..1 progress into *this node's own*
// eased 0..1 progress from that lag — guaranteed to land on exactly 0 at
// global progress 0 and exactly 1 at global progress 1, for every L, so
// toggling direction never disturbs the endpoints.
const LAG_FLOOR = 0.35;
// How much of the global range small movers sit idle at 0 before starting —
// not a head start. A small mover (low L) holds still through this delay,
// then races through a compressed ramp and lands on 1 at the same global t=1
// every node shares; the net effect mid-transition is what "mass made
// visible" wants (small movers read further along, big movers still
// catching up) even though they start later, not earlier.
const LAG_LEAD = 0.15;

export function lagFactor(rTarget, rMax) {
  if (!(rMax > 0)) return 1;
  const raw = Math.sqrt(Math.max(0, rTarget)) / Math.sqrt(rMax);
  return Math.min(1, Math.max(LAG_FLOOR, raw));
}

function smoothstep01(x) {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

export function staggeredEase(t, L) {
  const li = L == null ? 1 : Math.min(1, Math.max(LAG_FLOOR, L));
  const offset = LAG_LEAD * (1 - li);
  return smoothstep01((t - offset) / li);
}

// ── A1: the world spring's analytic form (ADDENDUM 1 section 0) ──────────────
// "The world family is a critically damped spring. A node flying along a curved
// path cannot be integrated as a spring per axis without leaving the path, so
// the same curve is now also available in closed form."
//
//   arrival(x) = (1 - e^(-5x) * (1 + 5x)) / (1 - 6 * e^(-5))
//
// The critically damped step response with time constant d/5, normalized to
// land. It is not a new easing, it is the sanctioned one written down, and the
// addendum limits it to exactly three call sites: the assembly fly-in and the
// Time Machine's entry and exit blends.
//
// Both endpoints are exact, not approximate, and that is load-bearing rather
// than decorative — the entry and exit blends lerp between the per-year radius
// and the normal papers/mortality radius, so an arrival that returned 0.999 at
// x=1 would hand DiseaseNodes a radius a hair off the settled mapping on the
// frame the blend ends. At x=1 the numerator is `1 - Math.exp(-5) * 6` and the
// denominator `1 - 6 * Math.exp(-5)`; IEEE-754 multiplication is commutative,
// so those are bit-identical and the ratio is exactly 1.
const ARRIVAL_K = 5;
const ARRIVAL_NORM = 1 - (ARRIVAL_K + 1) * Math.exp(-ARRIVAL_K);

export function arrival(x) {
  // Clamped, so the blends stay inside their two endpoints even on a frame
  // where the driving progress overshoots 1 (delta-list item 8: "no frame
  // during the blend shows a radius outside the two endpoints").
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return (1 - Math.exp(-ARRIVAL_K * c) * (1 + ARRIVAL_K * c)) / ARRIVAL_NORM;
}

/**
 * arrival()'s own derivative, d/dx of the curve above:
 *
 *   arrival'(x) = 25 * x * e^(-5x) / ARRIVAL_NORM
 *
 * The assembly fly-in needs it because the comet stretch and the filament
 * opacity are both functions of a node's *speed*, and a node on a bezier
 * driven by arrival() has speed |dB/dp| * arrival'(q) / duration. Differencing
 * two frames' positions would work too, but it lags by a frame and goes to
 * pieces on the first frame and on any seek, which is exactly where the
 * acceptance shots are taken. Exactly 0 at both endpoints, so a node at rest
 * has no stretch and no filament by construction.
 */
export function arrivalRate(x) {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return (ARRIVAL_K * ARRIVAL_K * c * Math.exp(-ARRIVAL_K * c)) / ARRIVAL_NORM;
}

/**
 * arrival() under the same mass-weighted stagger staggeredEase applies to the
 * morph: a global 0..1 progress becomes this node's own eased 0..1 progress
 * from its lag factor L, so giants land last. The addendum's exit table asks
 * for "per node staggered by the existing lag factors" and its entry blend for
 * "per-node staggered by the same lag factors, using arrival()" — this is the
 * one function that satisfies both, with the same endpoint guarantee
 * staggeredEase carries (exactly 0 at global 0 and exactly 1 at global 1, for
 * every L, since (1 - LAG_LEAD*(1-L))/L >= 1 whenever L <= 1).
 */
export function staggeredArrival(t, L) {
  const li = L == null ? 1 : Math.min(1, Math.max(LAG_FLOOR, L));
  const offset = LAG_LEAD * (1 - li);
  return arrival((t - offset) / li);
}

// ── A2: the year-step settle (ADDENDUM 1 section 0) ──────────────────────────
// The third sanctioned overshoot, and the quietest. One half sine,
//
//   m(t) = 1 + A * sin(pi * t / 240ms)
//
// which is exactly 1.000 at t = 0 and exactly 1.000 at t = 240 ms, peaks at
// 1 + A, and never dips below 1. Peak magnitude 4.5 percent at rank 1, so it
// sits strictly under `back.out(1.2)`'s 5.29 percent: the detonation and the
// supernova pop stay the two loudest events in the piece by construction, not
// by taste. At most three nodes per detent crossing, only inside the Time
// Machine.
export const TM_SETTLE = { dur: 240, amps: [0.045, 0.030, 0.020] };

/**
 * The settle multiplier at `t` ms into a 240 ms settle of amplitude `A`.
 * Outside [0, dur] it is exactly 1, so a caller can apply it unconditionally
 * and a node that is not settling is a node at exactly its mapped radius.
 * @param {number} t milliseconds since the detent landed
 * @param {number} amp peak fraction, e.g. 0.045
 * @param {number} [dur] settle length in ms
 */
export function settleScale(t, amp, dur = TM_SETTLE.dur) {
  if (!(amp > 0) || !(dur > 0) || t <= 0 || t >= dur) return 1;
  return 1 + amp * Math.sin((Math.PI * t) / dur);
}

// ── The staircase (ADDENDUM 1 section 2.2) ───────────────────────────────────
// The tour stops lerping and starts ratcheting. A leg used to be one continuous
// eased tween from pause year to pause year, so every intermediate year was
// motion blur with no stable frame to compare against: thirty-five years went
// by and the eye never got a before and an after. The dwell is what makes the
// change legible, because it is a still frame at a real year.
//
// The 360 ms year is a composite of two sanctioned durations (240 travel plus
// 120 dwell), not a new constant. `sweep` and the single-year leg's 650 ms are
// covered by amendment A3's over-700 exemption and by the original 650
// respectively.
export const TM_STAIR = {
  travel: DUR.ui,     // 240 ms, expo.out, one year
  dwell: DUR.tick,    // 120 ms held on that year
  year: DUR.ui + DUR.tick, // 360 ms per stair
  single: DUR.world,  // a one-year leg keeps its 650 ms (and the detonation its back.out)
  stairCap: 8,        // legs of 8 years or fewer are pure staircase
  sweepTail: 6,       // a longer leg ratchets its last 6 years
  sweep: 1300,        // ...after sweeping the rest continuously in 1.30 s
  rewind: 1300,       // the tour's opening rewind, unchanged
};

// ── Ghost shells (ADDENDUM 1 section 2.3, accent 1) ──────────────────────────
// A sphere at the node's centre held at the radius it had in the year just
// left. Growth reads as a node breaking out of its old shell; shrinkage reads
// as a node falling inside it. It renders the year-over-year delta as a visible
// geometric difference rather than asking the eye to remember a frame from
// 360 ms ago, which is the actual perceptual problem. The ghost never scales.
export const TM_GHOST = { dur: 480, alpha: 0.30, slots: 8, reduced: 300 };
// Tertiary ink: the shrinkage color for the mover ring. Never #ff4d1a, which
// belongs to the detonation and the overlooked-decile scar.
export const TM_SHRINK_INK = '#64748b';
// The mover micro-label: in 180 ms, holds 650 ms, out 240 ms, and only on a
// step the year actually rests on for at least one stair's length.
export const TM_MICRO = { in: DUR.fast, hold: DUR.world, out: DUR.ui, dwell: TM_STAIR.year };

// ── The exit choreography, as data (ADDENDUM 1 section 1) ────────────────────
// The opening sequence ends at the home screen: every automatic path
// terminates in tmPhase 'idle', papers sizing, the rest camera seat, no
// isolation, no tour caption, full chrome, the galaxy turning. This table is
// the addendum's own, in milliseconds from the moment the exit begins, kept
// here rather than inside any one component because five separate files read
// it (the engine, the rail, the hint row, the header, the tests).
export const TM_EXIT = {
  total: 2600,
  caption: { at: 0, dur: 200 },    // flatline card exits on a fade, no rise
  isolation: { at: 0, dur: 480 },  // dim release + glowSuppress 0.55 -> 0
  sound: { at: 0 },                // moment 3 pad, reused at -4 dB
  rail: { at: 100, dur: 240 },     // rail slides down and out, expo.out
  radius: { at: 150, dur: 1100 },  // tm.exit 0 -> 1, staggered by lag factors
  camera: { at: 150, dur: 1600 },  // glide to SEAT.rest on easeGlide
  grade: { at: 1250 },             // fx.ember confirmed at 1
  chrome: { at: 1300 },            // story chip row returns
  hints: { at: 1600 },             // orbit/select return, timeMachine dismissed
  header: { at: 1750, dur: 1400, line: 2600, lineOut: 200 },
};

// Skip during the exit: any input fast-forwards to the landed state over
// 240 ms. Reduced motion replaces the whole thing with three 300 ms dissolves.
export const TM_EXIT_FAST = 240;
export const TM_EXIT_REDUCED = 300;

// The mirror of the exit blend: the header re-entry's tm.enter channel, so the
// instrument opens with a blend instead of the hard radius swap that was "the
// one ugly cut left in the piece".
export const TM_ENTER_DUR = 650;

/**
 * How long from *now* until the exit channel scheduled at `atMs` should fire,
 * given the exit began at `t0`. Returns 0 once the moment has passed, which is
 * what lets a component re-render mid-exit (a hint dismissed, a caption
 * cleared) without restarting an animation whose delay has already elapsed:
 * the delay is recomputed against the live clock every render rather than
 * baked in once.
 * @param {number} t0 performance.now() when the exit began, 0 if none is running
 * @param {number} atMs the channel's offset from the exit table above
 * @param {number} [now] injectable clock, for tests
 */
export function exitDelay(t0, atMs, now) {
  if (!t0) return 0;
  const clock = now == null
    ? (typeof performance !== 'undefined' ? performance.now() : Date.now())
    : now;
  const remaining = atMs - (clock - t0);
  return remaining > 0 ? remaining : 0;
}

// ── Ambient micro-motion (ADDENDUM 1 section 4, amendment A4) ────────────────
// Four continuous oscillators, exempt from the duration table because they are
// not transitions. They are governed by amplitude and frequency, and by one
// rule: no ambient channel exceeds 1.0 percent of the quantity it modulates,
// and every one of them stops the instant a directed stillness is called
// (beat 2's ignition hold, the detonation push-in, any active fly).
//
// The frequencies inside each channel are deliberately incommensurate, so the
// sum never visibly repeats: 0.055 / 0.083 / 0.037 Hz have a common period
// measured in hours.
export const AMBIENT = {
  // Item 1: camera breathing on every hold. Degrees and a radius fraction,
  // applied as an additive offset after all tweens — exactly like the cursor
  // parallax, and killed by OrbitControls.onStart exactly like the handover.
  camera: { azDeg: 0.45, azHz: 0.055, elDeg: 0.25, elHz: 0.083, radFrac: 0.006, radHz: 0.037 },
  // Item 2: the three star shells. Fractions of CFG.particles, multiples of
  // camDist, rad/s, point sizes, colors — near shell first.
  stars: {
    split: [0.30, 0.45, 0.25],
    radii: [2.8, 4.0, 6.2],
    rates: [0.00090, 0.00040, 0.00015],
    sizes: [2.2, 1.5, 1.0],
    colors: [0x3b4a63, 0x334155, 0x232f42],
    jitter: 0.06,          // +-6% shell thickness, so a shell is not a shrink-wrap
    twinkle: [0.55, 1.0],  // HIGH only, through the points shader
  },
  // Item 3: tour leg choreography. Truck in degrees of azimuth about the
  // current framing, dolly as a fraction of the current distance to it.
  leg: { stairDeg: 4.0, stairDolly: 0.03, sweepDeg: 9.0, sweepDolly: 0.06 },
  // Item 4: the resting galaxy micro-breathe. +-0.8 percent of radius, at a
  // per-node frequency between 0.10 and 0.16 Hz taken off the aPhase attribute
  // the geometry already carries.
  node: { amp: 0.008, hz: [0.10, 0.16] },
  // Item 5: edge shimmer during the film. The global opacity breathe every
  // tier gets; HIGH and MEDIUM additionally get the per-vertex phase wave.
  edge: { lo: 0.06, hi: 0.13, hz: 0.2, waveSpeed: 0.55, waveLength: 0.9 },
};

/**
 * The camera's ambient offset at time `t`, in (azimuth radians, elevation
 * radians, radius fraction). Pure, so the amplitudes are testable without a
 * scene and A4's one percent ceiling is an assertion rather than a promise.
 * @param {number} t seconds on any monotonic clock
 * @param {[number,number,number]} [out] scratch triple
 */
export function cameraBreathe(t, out = [0, 0, 0]) {
  const c = AMBIENT.camera;
  out[0] = ((c.azDeg * Math.PI) / 180) * Math.sin(2 * Math.PI * c.azHz * t);
  out[1] = ((c.elDeg * Math.PI) / 180) * Math.sin(2 * Math.PI * c.elHz * t + 1.7);
  out[2] = c.radFrac * Math.sin(2 * Math.PI * c.radHz * t + 3.9);
  return out;
}

// ── The onStart kill's own resume (ADDENDUM 1 section 4 item 1, the eleven
// holds) ───────────────────────────────────────────────────────────────────
// Camera breathing is suppressed by three directed stillnesses (A4) plus one
// more that is not directed at all: OrbitControls.onStart, a hand landing on
// the mouse. That is not one of the eleven holds — it is the viewer taking
// over — but the addendum's own list of holds that must never sit perfectly
// still names "scrub at rest, idle", and idle is what follows an interaction,
// not what precedes it. So the kill cannot last the session; it has to
// release once the camera has actually gone idle, on the same idleFrames
// threshold CameraRig already uses to bring autoRotate back, and it ramps
// back in slower than the ~0.5s used elsewhere in that block (a directed
// stillness ending, or a fly landing) so the return itself is not the thing
// that catches the eye. Pure and testable without a scene: elapsed idle time
// in, a clamped 0..1 gain out.
export const BREATHE_RESUME_SEC = 2.0;

export function breatheResumeGain(elapsedSec) {
  if (!(elapsedSec > 0)) return 0;
  return Math.min(1, elapsedSec / BREATHE_RESUME_SEC);
}

/**
 * One node's micro-breathe multiplier at time `t`. The node's own `phase`
 * (0..2pi, the aPhase attribute) sets both where in the cycle it sits and how
 * fast it breathes, so no two neighbours pulse together and the field reads as
 * alive rather than as one throbbing mass. Exactly within 1 +- amp, always.
 * @param {number} t seconds
 * @param {number} phase the node's aPhase, 0..2pi
 */
export function nodeBreathe(t, phase) {
  const n = AMBIENT.node;
  const f = n.hz[0] + (n.hz[1] - n.hz[0]) * (phase / (2 * Math.PI));
  return 1 + n.amp * Math.sin(2 * Math.PI * f * t + phase);
}

/**
 * The film's global edge alpha at time `t`: 0.06 to 0.13 at 0.2 Hz, scaled by
 * how much of the film's shimmer is live (0 outside beats 0 and 1).
 * @param {number} t seconds
 * @param {number} amount 0..1
 */
export function edgeBreathe(t, amount) {
  const e = AMBIENT.edge;
  const w = 0.5 + 0.5 * Math.sin(2 * Math.PI * e.hz * t);
  return (e.lo + (e.hi - e.lo) * w) * amount;
}
