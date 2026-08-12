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
