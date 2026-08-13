// ─── Beat 0 restaged: the fly-in assembly (ADDENDUM 1 section 3) ─────────────
// "The original beat 0 directed nodes streaming in along faint filaments and it
// was deferred. The shipped assembly is IntroSequence's staged scale-up from
// zero, which is the exact pop-in the 'no pop-in' rule was written against,
// four times over."
//
// This module is the whole flight as pure math: given the disease list, the
// category layout and the camera distance, `makePlan` returns a deterministic
// per-node spawn, control point, launch time and flight duration, and
// `flightAt` evaluates one node's complete state at any assembly time t.
// Nothing here touches THREE, the store or the DOM, which is what makes the
// acceptance items ("all 153 present at 0.55 radius on the first frame", "every
// quaternion identity at beat 1 frame 1", "a skip never leaves a node in
// flight") plain unit tests instead of pixel comparisons.
//
// Determinism is load-bearing twice over: the verify harness seeks the assembly
// the same way it seeks the film, and the client's own acceptance asks for the
// same five frames on two viewports. Hence deterministic index hashes, never
// Math.random.

import { arrival, arrivalRate } from './motion';
import { CATS } from './constants';
import { nR } from './helpers';

const CAT_INDEX = {};
CATS.forEach((c, i) => { CAT_INDEX[c] = i; });

// Every constant the addendum's section 3 names, in one place.
export const ASM = {
  total: 5.2,          // beat 0 budget, was 4.0
  stillness: 0.21,     // "210 ms of stillness before beat 1 speaks"
  streamStep: 0.16,    // stream launch: 0.16 * c, c = 0..9 in legend order
  jitter: 0.30,        // per-node start: + 0.30 * u(i)
  flightBase: 2.10,    // per-node flight: 2.10 + 1.15 * sqrt(r_i / r_max)
  flightSpan: 1.15,
  spawnBase: 3.4,      // K_i = 3.4 + 1.8 * h(i)
  spawnSpan: 1.8,
  camOffset: 0.85,     // + D_c * camDist * 0.85
  curl: 0.22,          // C = (S + P) / 2 + N * 0.22 * |S - P|
  rStart: 0.55,        // radius 0.55 at launch...
  rTail: 0.30,         // ...to 1.00 over the last 30 percent of the flight
  vRefFrac: 0.9,       // v_ref = 0.9 * camDist per second
  stretchMax: 1.8,     // s_long = 1 + min(1.8, v_i / v_ref)
  stretchFade0: 0.80,  // ...decaying to exactly 1.000 by p = 0.92
  stretchFade1: 0.92,
  // Brightness at launch, climbing to 1.00 at landing. 0.35 -> 0.50 (round-5
  // gate, convergent first30 + craft finding): at 0.35 the first ~1.8 s read as
  // a near-black screen in a bright room (mean frame luminance 0.23/255 at the
  // 1.6 s mark), so the piece opened on two quiet seconds that a demo audience
  // spends wondering whether anything is loading. The monochrome-to-color
  // reward is untouched — beat 0 is still desaturated and color still arrives
  // only at beat 1 — and so is first-frame integrity: this is the flight's own
  // brightness ramp, so a node at its spawn is brighter but still visibly
  // unlanded, and the landing pip still takes it past 1.
  brightMin: 0.50,
  pipMs: 180,          // plus a 180 ms 1.30x pip on the landing frame
  pipAmp: 0.30,
  tail: 0.12,          // filament: back along the bezier by 0.12 of the remaining path
  tailAlpha: 0.25,     // opacity 0.25 * min(1, v_i / v_ref)
  tailColor: 0x1b2740,
  skip: 0.5,           // skip during assembly: force-land over the same 0.5 s
  elevMin: -25,        // ten category directions, elevations clamped so no
  elevMax: 55,         // stream enters from directly behind the camera
  camSeat0: 2.9,       // opening seat 2.9 R0 (was 2.2), elevation 12
  camSeat1: 1.5,       // drift to 1.5 R0 across the full 5.2 s, sine.inOut
  camElev: 12,
  camCounterAz: 2.5,   // + a 2.5 degree azimuth counter-drift against the curl
  dustDrift: 0.03,     // HIGH-only dust: inward 3 percent of their radius...
  dustSpin: 0.004,     // ...with a 0.4 percent per second rotation bump...
  dustSettle: 5.6,     // ...easing back to the resting rate by 5.6 s
  // The atmospheric fog's beat-0 range, in multiples of the layout radius.
  // See fogRangeAt.
  fogNear0: 3.0,
  fogFar0: 13.0,
  fogHold: 4.6,        // held wide until the last giant is nearly down...
};

const DEG = Math.PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep01 = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

/**
 * One deterministic 32-bit avalanche hash of an instance index, in [0, 1).
 * Two salts give the two independent streams the addendum names, h(i) (spawn
 * distance) and u(i) (launch jitter), from the same index.
 */
export function hashAt(i, salt) {
  let x = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503);
  x = Math.imul(x ^ (x >>> 15), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export const hSpawn = (i) => hashAt(i, 1);
export const uStart = (i) => hashAt(i, 2);

/**
 * The ten category entry vectors: "one of ten unit vectors, one per category,
 * placed on a Fibonacci sphere and clamped to elevations between -25 and +55
 * degrees so no stream enters from directly behind the camera."
 * Ten streams, not 153 darts.
 */
export function categoryDirs(n = CATS.length) {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees
  const out = [];
  for (let c = 0; c < n; c++) {
    const z = 1 - (2 * c + 1) / n;             // the Fibonacci sphere's own z
    let el = Math.asin(z < -1 ? -1 : z > 1 ? 1 : z);
    if (el < ASM.elevMin * DEG) el = ASM.elevMin * DEG;
    if (el > ASM.elevMax * DEG) el = ASM.elevMax * DEG;
    const az = c * GOLDEN;
    const ce = Math.cos(el);
    out.push([ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)]);
  }
  return out;
}

function normInto(out, x, y, z) {
  const L = Math.sqrt(x * x + y * y + z * z);
  if (!(L > 1e-9)) return false;
  out[0] = x / L; out[1] = y / L; out[2] = z / L;
  return true;
}

/**
 * The whole assembly, precomputed once per (diseases, layout, camDist).
 *
 * Returned arrays are flat and index-parallel with `diseases`:
 *   spawn/ctrl/seat  the quadratic bezier's three control points, xyz
 *   t0/dur           launch time and flight length, seconds from beat 0
 *   cat              category index, i.e. which of the ten streams
 * plus `latest` (the last landing, which is the giant), `vRef` and `curlSign`
 * (which way the ten ribbons wind about the vertical, so the camera can drift
 * against them rather than with them).
 */
export function makePlan(diseases, catPos, camDist) {
  const n = diseases.length;
  const dirs = categoryDirs();
  const spawn = new Float32Array(n * 3);
  const ctrl = new Float32Array(n * 3);
  const seat = new Float32Array(n * 3);
  const t0 = new Float32Array(n);
  const dur = new Float32Array(n);
  const cat = new Uint8Array(n);
  const rad = new Float32Array(n);

  let rMax = 0;
  for (let i = 0; i < n; i++) {
    rad[i] = nR(diseases[i].papers);
    if (rad[i] > rMax) rMax = rad[i];
  }

  // ── Stream launch order (DEVIATION, documented) ────────────────────────────
  // The addendum launches the ten streams "in legend order" and then states the
  // result: "the last thing to land is the biggest thing, and then 210 ms of
  // stillness before beat 1 speaks", with the latest arrival at 4.99 s. Those
  // two cannot both hold on this table. A stream's launch spread is 1.44 s and
  // the whole flight-duration range is only 1.15 s, so the galaxy's largest
  // node can only land last if its category happens to launch last -- and the
  // largest node here is Heart Disease, whose category is third in legend
  // order. Taken literally the assembly ends at 4.50 s with the giant landing
  // 0.64 s earlier, i.e. a 700 ms dead hold at the end of beat 0 and no
  // "biggest thing last".
  //
  // So the launch *slot* is the one thing derived rather than transcribed: the
  // ten streams still launch 0.16 s apart with the last at 1.44 s, but they are
  // ordered by their own heaviest member, lightest stream first. Mass grows
  // through the assembly, the giant is in the last stream and lands last by
  // construction on any table, and the stated 4.99/210 ms shape survives a data
  // refresh that reshuffles which category is biggest.
  const heaviest = new Float32Array(dirs.length);
  for (let i = 0; i < n; i++) {
    const c = CAT_INDEX[diseases[i].category] || 0;
    if (rad[i] > heaviest[c]) heaviest[c] = rad[i];
  }
  const slot = new Uint8Array(dirs.length);
  Array.from(heaviest.keys())
    .sort((a, b) => heaviest[a] - heaviest[b] || a - b)
    .forEach((c, k) => { slot[c] = k; });

  // The spawn shell's floor. The addendum's own prose puts every spawn
  // "between roughly 3.4 and 5.2 times the layout radius plus the category
  // offset ... outside the opening camera's near field and inside a 6 R0
  // shell", and first-frame integrity asks for zero instances inside 2.0 R0.
  // S = P * K alone cannot deliver that for the nodes near the layout's centre
  // (the hero sits exactly at the origin, so its spawn would be the category
  // offset alone, 0.85 R0 -- deep inside the galaxy it is supposed to be
  // falling into). Pushing those out along their own spawn direction to
  // 3.4 layout radii is what makes the prose and the acceptance true for all
  // 153 rather than for the 122 whose seats are far enough out already.
  let layoutR = 0;
  for (let i = 0; i < n; i++) {
    const L = Math.hypot(catPos[i][0], catPos[i][1], catPos[i][2]);
    if (L > layoutR) layoutR = L;
  }
  const floorR = ASM.spawnBase * layoutR;

  const N = [0, 0, 0];
  let curlSum = 0;
  let latest = 0;
  for (let i = 0; i < n; i++) {
    const c = slot[CAT_INDEX[diseases[i].category] || 0];
    cat[i] = c;
    const D = dirs[c];
    const P = catPos[i];
    const K = ASM.spawnBase + ASM.spawnSpan * hSpawn(i);
    const off = camDist * ASM.camOffset;
    let sx = P[0] * K + D[0] * off;
    let sy = P[1] * K + D[1] * off;
    let sz = P[2] * K + D[2] * off;
    const sL = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (sL > 1e-6 && sL < floorR) {
      const k = floorR / sL;
      sx *= k; sy *= k; sz *= k;
    }
    spawn[i * 3] = sx; spawn[i * 3 + 1] = sy; spawn[i * 3 + 2] = sz;
    seat[i * 3] = P[0]; seat[i * 3 + 1] = P[1]; seat[i * 3 + 2] = P[2];

    // N = normalize(cross(P, D_c)): because N comes from the category's own
    // entry vector, every node in a stream curves the same way. Ten ribbons
    // spiralling in, which reads as matter falling into a galaxy rather than as
    // a swarm. The hero sits at the layout's origin, where cross(P, D) is
    // degenerate, so fall back to a vector still fixed by D alone (same stream,
    // same handedness) rather than leaving one node on a straight line.
    let ok = normInto(N, P[1] * D[2] - P[2] * D[1], P[2] * D[0] - P[0] * D[2], P[0] * D[1] - P[1] * D[0]);
    if (!ok) ok = normInto(N, D[2], 0, -D[0]);            // cross(Y, D)
    if (!ok) normInto(N, 0, -D[2], D[1]);                 // cross(X, D)

    const dx = sx - P[0], dy = sy - P[1], dz = sz - P[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const bow = ASM.curl * len;
    ctrl[i * 3] = (sx + P[0]) * 0.5 + N[0] * bow;
    ctrl[i * 3 + 1] = (sy + P[1]) * 0.5 + N[1] * bow;
    ctrl[i * 3 + 2] = (sz + P[2]) * 0.5 + N[2] * bow;

    // Which way this ribbon winds about the vertical: the component of its bow
    // along the seat's own azimuthal direction (Y x P).
    const ax = P[2], az2 = -P[0];
    const aL = Math.sqrt(ax * ax + az2 * az2);
    if (aL > 1e-6) curlSum += (N[0] * ax + N[2] * az2) / aL;

    t0[i] = ASM.streamStep * c + ASM.jitter * uStart(i);
    dur[i] = ASM.flightBase + ASM.flightSpan * Math.sqrt(rMax > 0 ? rad[i] / rMax : 0);
    if (t0[i] + dur[i] > latest) latest = t0[i] + dur[i];
  }

  return {
    n, spawn, ctrl, seat, t0, dur, cat, rad, rMax, latest,
    dirs,
    vRef: ASM.vRefFrac * camDist,
    curlSign: curlSum >= 0 ? 1 : -1,
    camDist,
  };
}

// A caller-owned scratch record, so the per-frame driver allocates nothing.
export function makeFlight() {
  return {
    x: 0, y: 0, z: 0,        // position on the bezier
    tx: 0, ty: 0, tz: 0,     // filament tail point, back along the same bezier
    vx: 0, vy: 0, vz: 0,     // unit velocity direction (0,1,0 when at rest)
    speed: 0,                // world units per second
    p: 0, q: 0,              // eased path fraction, linear time fraction
    radius: ASM.rStart,      // 0.55 -> 1.00 scale multiplier
    stretch: 1,              // s_long, exactly 1.000 by p = 0.92
    bright: ASM.brightMin,   // 0.50 -> 1.00, plus the landing pip
    alpha: 0,                // filament opacity
    flying: false,           // strictly between launch and landing
    landed: false,
  };
}

/**
 * One node's complete state at assembly time `t`, written into `o`.
 *
 * Before launch the node exists, at its spawn, at 0.55 radius: "nothing appears
 * from nothing at any point in the piece". After landing every channel is back
 * at its identity (seat, radius 1, stretch exactly 1, velocity +Y) except the
 * 180 ms brightness pip, which is the landing itself.
 */
export function flightAt(plan, i, t, o) {
  const i3 = i * 3;
  const sx = plan.spawn[i3], sy = plan.spawn[i3 + 1], sz = plan.spawn[i3 + 2];
  const cx = plan.ctrl[i3], cy = plan.ctrl[i3 + 1], cz = plan.ctrl[i3 + 2];
  const px = plan.seat[i3], py = plan.seat[i3 + 1], pz = plan.seat[i3 + 2];
  const q = (t - plan.t0[i]) / plan.dur[i];

  o.q = q < 0 ? 0 : q > 1 ? 1 : q;
  o.vx = 0; o.vy = 1; o.vz = 0;
  o.stretch = 1;
  o.speed = 0;
  o.alpha = 0;

  if (q <= 0) {
    o.p = 0;
    o.x = sx; o.y = sy; o.z = sz;
    o.tx = sx; o.ty = sy; o.tz = sz;
    o.radius = ASM.rStart;
    o.bright = ASM.brightMin;
    o.flying = false;
    o.landed = false;
    return o;
  }

  if (q >= 1) {
    o.p = 1;
    o.x = px; o.y = py; o.z = pz;
    o.tx = px; o.ty = py; o.tz = pz;
    o.radius = 1;
    o.flying = false;
    o.landed = true;
    // The landing pip: 180 ms at 1.30x, decaying to exactly 1.000.
    const age = (t - (plan.t0[i] + plan.dur[i])) * 1000;
    o.bright = age < ASM.pipMs ? 1 + ASM.pipAmp * (1 - age / ASM.pipMs) : 1;
    return o;
  }

  const p = arrival(q);
  o.p = p;
  const m = 1 - p;
  o.x = m * m * sx + 2 * m * p * cx + p * p * px;
  o.y = m * m * sy + 2 * m * p * cy + p * p * py;
  o.z = m * m * sz + 2 * m * p * cz + p * p * pz;

  // dB/dp = 2(1-p)(C - S) + 2p(P - C), and dp/dt = arrival'(q) / dur.
  const dpx = 2 * m * (cx - sx) + 2 * p * (px - cx);
  const dpy = 2 * m * (cy - sy) + 2 * p * (py - cy);
  const dpz = 2 * m * (cz - sz) + 2 * p * (pz - cz);
  const dpdt = arrivalRate(q) / plan.dur[i];
  const dL = Math.sqrt(dpx * dpx + dpy * dpy + dpz * dpz);
  if (dL > 1e-9) { o.vx = dpx / dL; o.vy = dpy / dL; o.vz = dpz / dL; }
  o.speed = dL * dpdt;

  // Radius: 0.55 to 1.00 over the last 30 percent of the flight, smoothstep,
  // no overshoot. "The flight" is the node's own 2.10 to 3.25 s, so this is the
  // linear time fraction q, not the eased path fraction p: the node grows as it
  // arrives rather than in the first third, where arrival() covers most of the
  // distance.
  o.radius = ASM.rStart + (1 - ASM.rStart) * smoothstep01((q - (1 - ASM.rTail)) / ASM.rTail);

  // Comet stretch: non-uniform instance scale along the travel axis. The
  // explicit fade is what makes "decaying to exactly 1.000 by p = 0.92" exact
  // rather than merely small; arrival()'s own deceleration would leave a
  // fraction of a percent behind.
  const sLong = 1 + Math.min(ASM.stretchMax, o.speed / plan.vRef);
  const fade = 1 - smoothstep01((p - ASM.stretchFade0) / (ASM.stretchFade1 - ASM.stretchFade0));
  o.stretch = 1 + (sLong - 1) * fade;

  o.bright = ASM.brightMin + (1 - ASM.brightMin) * q;

  // The filament: a tangent tail running back along the node's own bezier by
  // 0.12 of the remaining path, so a fast node trails and a landed one does not.
  const pt = p - ASM.tail * (1 - p);
  const tp = pt < 0 ? 0 : pt;
  const tm = 1 - tp;
  o.tx = tm * tm * sx + 2 * tm * tp * cx + tp * tp * px;
  o.ty = tm * tm * sy + 2 * tm * tp * cy + tp * tp * py;
  o.tz = tm * tm * sz + 2 * tm * tp * cz + tp * tp * pz;
  o.alpha = ASM.tailAlpha * Math.min(1, o.speed / plan.vRef);

  o.flying = true;
  o.landed = false;
  return o;
}

/**
 * The node shaders' atmospheric fog range during beat 0, written into `out` as
 * [near, far] in world units.
 *
 * This is a fix, not a flourish. The fog is tuned for the settled galaxy: it
 * takes a node to the background color between 0.6 and 3.0 layout radii, which
 * is the right range for a field of radius 1 seen from 1.4. The fly-in puts
 * every node between 3.4 and 5.2 layout radii out and the camera at 2.9 R0
 * behind that, so on the first painted frame every one of the 153 instances is
 * present, correctly placed, correctly scaled -- and fogged to pure black. A
 * frame with nothing in it is exactly what "nothing appears from nothing"
 * forbids, and the acceptance shot proved it: 40 pixels above 12/255 in a
 * 1440x900 frame.
 *
 * So the range opens to cover the spawn shell and contracts back to the
 * settled one over the last 600 ms of beat 0, by which time every node is
 * inside the galaxy and the contraction reads as the volume settling with the
 * dust. It lands on exactly the resting values at t = 5.2, so beat 1 is
 * byte-identical to what it was before this wave.
 */
export function fogRangeAt(rawMax, t, restNear, restFar, out) {
  const e = smoothstep01((t - ASM.fogHold) / (ASM.total - ASM.fogHold));
  const near0 = rawMax * ASM.fogNear0;
  const far0 = rawMax * ASM.fogFar0;
  out[0] = near0 + (restNear - near0) * e;
  out[1] = far0 + (restFar - far0) * e;
  return out;
}

/**
 * The skip's force-land, one node, one frame (ADDENDUM 1 section 3): "the
 * existing 0.5 s power2.out fast-forward to the beat 1 seat stands, and now
 * also force-lands every node over the same 0.5 s on the same arrival() curve.
 * A skip never leaves a node in flight and never leaves a quaternion
 * non-identity."
 *
 * `k` is arrival(elapsed / 0.5). At k = 1 the terminal state is *written*, not
 * lerped: `from + (seat - from) * 1` is not bit-identical to `seat` in IEEE-754
 * and the whole point of this path is that it has an exact end state. The
 * stretch and the quaternion do not ride the curve at all -- they are identity
 * from the first frame of the fast-forward, because beat 1 begins on that frame
 * and every quaternion must be identity when it does.
 */
export function forceLand(plan, i, from, fromR, fromB, k, o) {
  const i3 = i * 3;
  if (k >= 1) {
    o.x = plan.seat[i3]; o.y = plan.seat[i3 + 1]; o.z = plan.seat[i3 + 2];
    o.radius = 1;
    o.bright = 1;
    o.flying = false;
    o.landed = true;
  } else {
    o.x = from[0] + (plan.seat[i3] - from[0]) * k;
    o.y = from[1] + (plan.seat[i3 + 1] - from[1]) * k;
    o.z = from[2] + (plan.seat[i3 + 2] - from[2]) * k;
    o.radius = fromR + (1 - fromR) * k;
    o.bright = fromB + (1 - fromB) * k;
    o.flying = true;
    o.landed = false;
  }
  o.p = k;
  o.q = k;
  o.stretch = 1;
  o.vx = 0; o.vy = 1; o.vz = 0;
  o.speed = 0;
  o.alpha = 0;
  o.tx = o.x; o.ty = o.y; o.tz = o.z;
  return o;
}

/**
 * The camera's own beat 0 channel, analytically: seat 2.9 R0 at elevation 12
 * drifting to 1.5 R0 over the full 5.2 s on sine.inOut, with a 2.5 degree
 * azimuth counter-drift turning against the streams' curl so the ribbons sweep
 * across frame rather than at it. Shared by CameraRig (which tweens it) and the
 * harness seek (which jumps to it), so playback and seek agree.
 */
export function assemblySeat(camDist, curlSign, t) {
  const e = -(Math.cos(Math.PI * clamp01(t / ASM.total)) - 1) / 2; // sine.inOut
  const m = ASM.camSeat0 + (ASM.camSeat1 - ASM.camSeat0) * e;
  const az = curlSign * ASM.camCounterAz * DEG * (1 - e);
  const el = ASM.camElev * DEG;
  const r = camDist * m;
  const c = Math.cos(el);
  return [r * c * Math.sin(az), r * Math.sin(el), r * c * Math.cos(az)];
}

export { smoothstep01 as _smoothstep01 };
