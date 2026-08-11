import { describe, it, expect } from 'vitest';
import { digitsOf } from '../src/components/ui/Odometer';

describe('digitsOf', () => {
  it('decomposes a large number into digit and comma characters', () => {
    expect(digitsOf(11000000)).toEqual(['1', '1', ',', '0', '0', '0', ',', '0', '0', '0']);
  });
  it('handles zero', () => {
    expect(digitsOf(0)).toEqual(['0']);
  });
  it('decomposes a six-digit number', () => {
    expect(digitsOf(248989)).toEqual(['2', '4', '8', ',', '9', '8', '9']);
  });
});
