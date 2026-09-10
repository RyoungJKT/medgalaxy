import { describe, it, expect } from 'vitest';
import { STAGE, groundFor } from '../src/utils/stage';
import { sceneRefs } from '../src/sceneRefs';

describe('stage ground color (DIRECTION section 1, color script)', () => {
  it('carries the three directed stage colors', () => {
    expect(STAGE.base).toBe(0x06080d);
    expect(STAGE.assembly).toBe(0x04060a);
    expect(STAGE.suppressed).toBe(0x030409);
  });
  it('is the assembly stage while beat 0 is live, whatever desat says', () => {
    expect(groundFor(true, 1)).toBe(STAGE.assembly);
    expect(groundFor(true, 0)).toBe(STAGE.assembly);
  });
  it('sinks with desat and returns to base at zero', () => {
    expect(groundFor(false, 0)).toBe(STAGE.base);
    expect(groundFor(false, 1)).toBe(STAGE.suppressed);
    const mid = groundFor(false, 0.5);
    const r = (c) => (c >> 16) & 255;
    expect(r(mid)).toBeGreaterThanOrEqual(r(STAGE.suppressed));
    expect(r(mid)).toBeLessThanOrEqual(r(STAGE.base));
  });
  it('never exceeds the base: the stage can only get darker', () => {
    for (let d = 0; d <= 1; d += 0.1) expect(groundFor(false, d)).toBeLessThanOrEqual(STAGE.base);
  });
  // The shared grade channel starts on the same base the script names, rather
  // than on a literal transcribed beside it.
  it('is where the shared ground channel starts', () => {
    expect(sceneRefs.fx.ground).toBe(STAGE.base);
  });
});
