// Synthesized score + interaction audio for MedGalaxy Next (Task 15).
// Muted by default, session-scoped: nothing is created or plays before the
// header's "sound" pill fires init()+setEnabled(true) from a real click, and
// nothing persists across a reload. The whole palette is WebAudio oscillators
// and filtered noise; there are no audio files at all
// (docs/direction/2026-08-11-cinematic-direction.md section 5).
//
// Mix discipline (DIRECTION section 5): one foreground sound at a time, the
// ambient drone ducks 6 dB under any event for that event's duration, and
// everything passes through a master limiter so laptop speakers never clip.

// ─── Pure music/gain math — no AudioContext involved, safe to unit-test ────
const SEMITONE = Math.pow(2, 1 / 12);
export const FIFTH_UP = Math.pow(SEMITONE, 7); // perfect fifth, +7 semitones
export const MINOR_THIRD_DOWN = Math.pow(SEMITONE, -3); // minor third, -3 semitones

export function fifthUp(freq) { return freq * FIFTH_UP; }
export function minorThirdDown(freq) { return freq * MINOR_THIRD_DOWN; }
export function dbToGain(db) { return Math.pow(10, db / 20); }

export const DUCK_DB = -6;
export const DUCK_GAIN = dbToGain(DUCK_DB);
export const TMBOOM_DB = -10;
export const REVEAL_BASE_HZ = 440; // A4: the two-note rising-fifth motif's root

// Every name play() understands. tests/audio.test.js greps every
// window.__mgAudio call site in the repo and asserts this list covers them.
export const SOUND_NAMES = ['assembly', 'ignition', 'release', 'tmBoom', 'reveal', 'tick'];

// Rough foreground duration per sound (ms): how long the ambient duck holds.
// The assembly's window follows beat 0's own budget: the resolve lands at
// 4.99 s and rings for 1.6 s after it (ADDENDUM 1 section 3).
export const DUCK_MS = { assembly: 6600, ignition: 1400, release: 2000, tmBoom: 1600, reveal: 500, tick: 120 };

function makeNoiseBuffer(ctx) {
  const len = Math.round(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Linear attack -> hold at peak -> linear release envelope, pre-connected to
// `dest`. Every voice below is just oscillators/noise routed through one of
// these plus a filter.
function envGain(ctx, dest, attack, hold, release, peak, t0) {
  const g = ctx.createGain();
  g.connect(dest);
  const p = g.gain;
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + attack);
  p.setValueAtTime(peak, t0 + attack + hold);
  p.linearRampToValueAtTime(0, t0 + attack + hold + release);
  return g;
}

// ── Moment 1: the assembly, rewritten for the fly-in (ADDENDUM 1 section 3).
// "The granular bed fades in over the first 1.0 s, each of the ten streams adds
// one partial as it launches (a rising ten-note cluster across 1.44 s),
// resolving to the single soft consonance as the last giant lands at 4.99 s,
// with one low thud at -18 dB on that landing."
//
// The ten partials are the ten streams, in the order they launch, so the ear
// counts what the eye is counting. They are a stacked harmonic series over the
// drone's own low A rather than a scale: ten simultaneous notes have to be
// consonant by construction or the cluster turns into a chord nobody chose.
// Each partial holds until the last landing, so the cluster is still ringing
// when the consonance resolves it.
export const ASSEMBLY_LAUNCH = 0.16;  // one stream every 160 ms, ten in 1.44 s
export const ASSEMBLY_LAND = 4.99;    // the last giant
export const ASSEMBLY_THUD_DB = -18;  // one low thud on that landing
const ASSEMBLY_ROOT = 110;            // A2, an octave under the reveal motif's root

function synthAssembly(e, t0) {
  const ctx = e.ctx;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(2000, t0);
  bp.frequency.linearRampToValueAtTime(6000, t0 + 2.4);
  const bed = ctx.createBufferSource();
  bed.buffer = e.noiseBuf;
  bed.loop = true;
  // Fades in over the first 1.0 s, holds under the whole assembly, and is gone
  // by the time beat 1 speaks.
  bed.connect(bp).connect(envGain(ctx, e.master, 1.0, 3.4, 0.8, 0.10, t0));
  bed.start(t0);
  bed.stop(t0 + 5.3);

  for (let c = 0; c < 10; c++) {
    const at = t0 + ASSEMBLY_LAUNCH * c;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = ASSEMBLY_ROOT * (c + 2); // harmonics 2..11: rising, consonant
    // Quieter the higher it sits, so the cluster reads as one widening tone
    // rather than ten voices competing.
    const peak = 0.030 / Math.sqrt(c + 1);
    osc.connect(envGain(ctx, e.master, 0.35, ASSEMBLY_LAND - ASSEMBLY_LAUNCH * c - 0.35, 0.9, peak, at));
    osc.start(at);
    osc.stop(t0 + ASSEMBLY_LAND + 1.0);
  }

  // The resolve: the single soft consonance, on the frame the last giant lands.
  const land = t0 + ASSEMBLY_LAND;
  const resolve = ctx.createOscillator();
  resolve.type = 'sine';
  resolve.frequency.value = 660; // consonant against the drone's low A
  resolve.connect(envGain(ctx, e.master, 0.15, 0.5, 0.9, 0.06, land));
  resolve.start(land);
  resolve.stop(land + 1.6);

  // ...and the thud under it: the biggest thing in the galaxy arriving.
  const thudGain = dbToGain(ASSEMBLY_THUD_DB);
  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(70, land);
  thud.frequency.exponentialRampToValueAtTime(38, land + 0.5);
  const thudLp = ctx.createBiquadFilter();
  thudLp.type = 'lowpass';
  thudLp.frequency.value = 180;
  thud.connect(thudLp).connect(envGain(ctx, e.master, 0.02, 0.12, 0.5, thudGain, land));
  thud.start(land);
  thud.stop(land + 0.8);
}

// ── Moment 2: ignition. 300ms of near-silence — the duck IS the drama —
// then the one big hit in the piece: an 80->45Hz swell with a lowpassed
// noise bloom. `trim`/`lpHz` let tmBoom (moment 4) reuse this at -10dB,
// muffled; `lead` is the silence tmBoom skips (its own duck already covers it).
function synthIgnitionCore(e, t0, trim, lpHz, lead) {
  const ctx = e.ctx;
  const hit = t0 + lead;

  const swell = ctx.createOscillator();
  swell.type = 'sine';
  swell.frequency.setValueAtTime(80, hit);
  swell.frequency.exponentialRampToValueAtTime(45, hit + 0.9);
  const swellLp = ctx.createBiquadFilter();
  swellLp.type = 'lowpass';
  swellLp.frequency.value = lpHz;
  swell.connect(swellLp).connect(envGain(ctx, e.master, 0.05, 0.5, 0.7, 0.9 * trim, hit));
  swell.start(hit);
  swell.stop(hit + 1.3);

  const bloom = ctx.createBufferSource();
  bloom.buffer = e.noiseBuf;
  bloom.loop = true;
  const bloomLp = ctx.createBiquadFilter();
  bloomLp.type = 'lowpass';
  bloomLp.frequency.setValueAtTime(Math.min(2400, lpHz * 4), hit);
  bloomLp.frequency.exponentialRampToValueAtTime(Math.min(200, lpHz), hit + 1.0);
  bloom.connect(bloomLp).connect(envGain(ctx, e.master, 0.02, 0.15, 0.9, 0.5 * trim, hit));
  bloom.start(hit);
  bloom.stop(hit + 1.2);
}
const synthIgnition = (e, t0) => synthIgnitionCore(e, t0, 1, 2400, 0.3);

// ── Moment 3: release exhale. A warm, consonant pad swell resolving the
// ignition's tension: a resting triad, gently detuned.
// `opts.gainDb` trims the whole pad without a second voice: the Time Machine's
// exit reuses this same exhale at -4 dB against the film's own (ADDENDUM 1
// section 1), because the piece hands control over twice and the second time is
// quieter.
function synthRelease(e, t0, opts) {
  const ctx = e.ctx;
  const trim = opts && Number.isFinite(opts.gainDb) ? dbToGain(opts.gainDb) : 1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  lp.connect(envGain(ctx, e.master, 0.8, 0.6, 1.2, 0.22 * trim, t0));
  [220, 330, 440].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    osc.detune.value = (i - 1) * 4;
    osc.connect(lp);
    osc.start(t0);
    osc.stop(t0 + 2.8);
  });
}

// ── Moment 4: Time Machine 2020. A muffled, distant version of ignition at
// -10dB — deliberately smaller than the thesis; history rhymes, it doesn't
// shout. Same core as ignition, no lead silence, heavier lowpass.
const synthTmBoom = (e, t0) => synthIgnitionCore(e, t0, dbToGain(TMBOOM_DB), 320, 0);

// ── Moment 5: reveal motif. The shared two-note rising fifth (supernova
// burst + roulette reveal), nudged down a minor third when the disease sits
// in the overlooked decile — the sound design carries the thesis too.
function synthReveal(e, t0, opts) {
  const ctx = e.ctx;
  const root = (opts && opts.overlooked) ? minorThirdDown(REVEAL_BASE_HZ) : REVEAL_BASE_HZ;
  [root, fifthUp(root)].forEach((freq, i) => {
    const start = t0 + i * 0.14;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(envGain(ctx, e.master, 0.01, 0.1, 0.2, 0.18, start));
    osc.start(start);
    osc.stop(start + 0.35);
  });
}

// ── UI tick: a 30ms filtered sine blip near 2.2kHz. Scrub detents only, no
// pitch mapping (DIRECTION section 5: data sonification would claim a
// precision the ear can't verify).
function synthTick(e, t0) {
  const ctx = e.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 2200;
  osc.connect(envGain(ctx, e.master, 0.003, 0.01, 0.017, 0.15, t0));
  osc.start(t0);
  osc.stop(t0 + 0.04);
}

const VOICES = {
  assembly: synthAssembly,
  ignition: synthIgnition,
  release: synthRelease,
  tmBoom: synthTmBoom,
  reveal: synthReveal,
  tick: synthTick,
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;  // trim GainNode, pre-limiter
    this.limiter = null; // DynamicsCompressorNode, -6dB ceiling
    this.noiseBuf = null;
    this.droneGain = null;
    this.droneBaseGain = 0.05;
    this.droneNodes = null;
    this.enabled = false;
    this._suspendTimer = null;  // deferred suspend, cleared on re-enable
  }

  // Builds the graph on first call. Idempotent: safe to call on every pill
  // click. A user gesture must be on the call stack the first time, or the
  // browser hands back a suspended context (fine — setEnabled resumes it).
  init() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;
    this.master.connect(this.limiter).connect(ctx.destination);
    this.noiseBuf = makeNoiseBuffer(ctx);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.ctx) return;
    if (this.enabled) {
      // Clear any pending suspend, then resume if needed and start drone
      if (this._suspendTimer) clearTimeout(this._suspendTimer);
      this._suspendTimer = null;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._startDrone();
    } else {
      // Stop drone, then defer suspend so the fade automation can finish
      this._stopDrone();
      this._suspendTimer = setTimeout(() => this.ctx?.suspend(), 400);
    }
  }

  play(name, opts) {
    if (!this.enabled || !this.ctx || !VOICES[name]) return;
    const t0 = this.ctx.currentTime;
    this._duck(DUCK_MS[name] || 300);
    VOICES[name](this, t0, opts);
  }

  // Ducks the ambient drone 6dB for `ms`, then restores it. Retriggerable —
  // an overlapping event simply re-arms the hold from wherever the gain is.
  _duck(ms) {
    if (!this.droneGain) return;
    const ctx = this.ctx;
    const g = this.droneGain.gain;
    const now = ctx.currentTime;
    const base = this.droneBaseGain;
    const ducked = base * DUCK_GAIN;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(ducked, now + 0.03);
    const until = Math.max(now + 0.03, now + ms / 1000 - 0.2);
    g.setValueAtTime(ducked, until);
    g.linearRampToValueAtTime(base, until + 0.2);
  }

  // Sub drone, 40-55Hz sine plus filtered noise, barely there. Starts on
  // enable and stays running until the pill turns sound back off.
  _startDrone() {
    if (!this.ctx) return;

    // Hard-disconnect any stale drone nodes before creating fresh ones
    if (this.droneNodes) {
      const { osc, noise, gain } = this.droneNodes;
      try { osc.disconnect(); } catch (e) { /* ignore */ }
      try { noise.disconnect(); } catch (e) { /* ignore */ }
      try { gain.disconnect(); } catch (e) { /* ignore */ }
    }

    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    this.droneGain = gain;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 46;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.6;
    osc.connect(oscGain).connect(gain);
    osc.start();

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;
    noise.connect(lp).connect(noiseGain).connect(gain);
    noise.start();

    this.droneNodes = { osc, noise, gain };
    gain.gain.linearRampToValueAtTime(this.droneBaseGain, ctx.currentTime + 2.0);
  }

  _stopDrone() {
    if (!this.droneNodes) return;
    const { osc, noise, gain } = this.droneNodes;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.stop(now + 0.35);
    noise.stop(now + 0.35);
    // Keep droneNodes reference so _startDrone can hard-disconnect stale nodes
    this.droneGain = null;
  }
}

const engine = new AudioEngine();
if (typeof window !== 'undefined') window.__mgAudio = engine;

export default engine;
