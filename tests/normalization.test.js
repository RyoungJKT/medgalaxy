import { describe, it, expect } from 'vitest';
import { nR, nRM } from '../src/utils/helpers';

describe('honest size normalization', () => {
  it('distinguishes the giants (no clamping at the top)', () => {
    expect(nR(1733464)).toBeGreaterThan(nR(605564) * 1.2);
    expect(nRM(11000000)).toBeGreaterThan(nRM(9100000) * 1.05);
  });
  it('keeps the smallest nodes visible', () => {
    expect(nR(797)).toBeGreaterThan(1.0);
    expect(nRM(32)).toBeGreaterThan(0.05);
  });
});
