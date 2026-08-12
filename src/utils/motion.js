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
