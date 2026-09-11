import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import engine, {
  SOUND_NAMES, fifthUp, minorThirdDown, dbToGain,
  DUCK_DB, DUCK_GAIN, TMBOOM_DB, REVEAL_BASE_HZ, DUCK_MS,
} from '../src/audio/engine';

// Sound is untestable through the harness (no speakers, no AudioContext in a
// headless page that never gets a real user gesture), so this suite verifies
// the parts that don't need one: the note-frequency and gain math the five
// key moments are built from, and that every window.__mgAudio call site in
// the app names a sound the engine actually registers.

describe('audio engine: note-frequency math (the reveal motif)', () => {
  it('fifthUp raises a frequency a perfect fifth: ratio 2^(7/12)', () => {
    expect(fifthUp(440)).toBeCloseTo(440 * Math.pow(2, 7 / 12), 6);
    expect(fifthUp(440)).toBeCloseTo(659.255, 2);
  });

  it('minorThirdDown lowers a frequency a minor third: ratio 2^(-3/12)', () => {
    expect(minorThirdDown(440)).toBeCloseTo(440 * Math.pow(2, -3 / 12), 6);
    expect(minorThirdDown(440)).toBeCloseTo(369.994, 2);
  });

  it('overlooked pitches the whole motif down, never up', () => {
    expect(minorThirdDown(REVEAL_BASE_HZ)).toBeLessThan(REVEAL_BASE_HZ);
    expect(minorThirdDown(fifthUp(REVEAL_BASE_HZ))).toBeLessThan(fifthUp(REVEAL_BASE_HZ));
  });
});

describe('audio engine: gain math (mix discipline, DIRECTION section 5)', () => {
  it('dbToGain(0dB) is unity gain', () => {
    expect(dbToGain(0)).toBe(1);
  });

  it('dbToGain is monotonic: louder dB values produce larger gain', () => {
    expect(dbToGain(-12)).toBeLessThan(dbToGain(-6));
    expect(dbToGain(-6)).toBeLessThan(dbToGain(0));
  });

  it('the ambient drone ducks exactly 6dB under any foreground event', () => {
    expect(DUCK_DB).toBe(-6);
    expect(DUCK_GAIN).toBeCloseTo(Math.pow(10, -6 / 20), 6);
    expect(DUCK_GAIN).toBeCloseTo(0.50119, 4);
  });

  it('tmBoom sits 10dB under a full-strength hit: deliberately smaller than ignition', () => {
    expect(TMBOOM_DB).toBe(-10);
    expect(dbToGain(TMBOOM_DB)).toBeLessThan(DUCK_GAIN);
    expect(dbToGain(TMBOOM_DB)).toBeLessThan(1);
  });

  it('assembly duck window (2900ms) is long enough for resolve-tone tail (~2.8s)', () => {
    // synthAssembly resolve-tone stops at t0 + 2.8s (line 76)
    // duck should hold until at least 2800ms to avoid tail cutoff
    expect(DUCK_MS.assembly).toBeGreaterThanOrEqual(2800);
  });
});

describe('audio engine: name registry vs every call site in the app', () => {
  // Matches both the direct guard-call pattern (window.__mgAudio?.play?.('name', ...))
  // used by TimeRail/TimeMachine/SupernovaReveal/GalaxyRoulette, and OvertureSequence's
  // local playSound('name') wrapper around that same guard-call.
  const CALL_RE = /(?:__mgAudio\?\.play\?\.|playSound)\(\s*['"]([\w-]+)['"]/g;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.join(here, '..', 'src');

  function scan(dir) {
    const names = new Set();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'audio') continue; // the engine itself, not a consumer
        for (const n of scan(full)) names.add(n);
        continue;
      }
      if (!/\.(js|jsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      let m;
      while ((m = CALL_RE.exec(text))) names.add(m[1]);
    }
    return names;
  }

  const callSiteNames = scan(srcDir);

  it('the scan actually found call sites (not a vacuously-passing empty set)', () => {
    expect(callSiteNames.size).toBeGreaterThan(0);
  });

  it('every window.__mgAudio call site names a sound the engine registers', () => {
    for (const name of callSiteNames) {
      expect(SOUND_NAMES, `unregistered sound name "${name}"`).toContain(name);
    }
  });

  it('all five key moments plus the UI tick are wired somewhere in src/', () => {
    for (const name of SOUND_NAMES) {
      expect(callSiteNames.has(name), `${name} has no call site`).toBe(true);
    }
  });

  it('the registry is exactly the six names the direction board specifies', () => {
    expect([...SOUND_NAMES].sort()).toEqual(
      ['assembly', 'ignition', 'release', 'reveal', 'tick', 'tmBoom'].sort()
    );
  });
});

describe('audio engine: singleton is inert without a real AudioContext (test env)', () => {
  it('exposes init/setEnabled/play and starts muted', () => {
    expect(typeof engine.init).toBe('function');
    expect(typeof engine.setEnabled).toBe('function');
    expect(typeof engine.play).toBe('function');
    expect(engine.enabled).toBe(false);
  });

  it('play() never throws while disabled or uninitialized (the guard-call is zero-cost)', () => {
    expect(() => engine.play('assembly')).not.toThrow();
    expect(() => engine.play('reveal', { overlooked: true })).not.toThrow();
    expect(() => engine.play('not-a-real-sound')).not.toThrow();
  });

  it('init() and setEnabled() never throw with no window.AudioContext available', () => {
    expect(() => engine.init()).not.toThrow();
    expect(() => engine.setEnabled(true)).not.toThrow();
    expect(() => engine.setEnabled(false)).not.toThrow();
  });
});
