import { describe, it, expect } from 'vitest';
import { fmtFull, fmtWord, ppd, deathsPerPaper, trendLabel } from '../src/utils/captions';

describe('fmtFull', () => {
  it('comma-separates full numbers', () => {
    expect(fmtFull(248989)).toBe('248,989');
  });
  it('handles small numbers with no separators', () => {
    expect(fmtFull(32)).toBe('32');
  });
  it('rounds non-integers before formatting', () => {
    expect(fmtFull(19556.4)).toBe('19,556');
  });
});

describe('fmtWord', () => {
  it('renders exact millions with no decimal', () => {
    expect(fmtWord(11000000)).toBe('11 million');
  });
  it('renders fractional millions with one decimal', () => {
    expect(fmtWord(9100000)).toBe('9.1 million');
  });
  it('falls back to fmtFull below one million', () => {
    expect(fmtWord(373000)).toBe('373,000');
  });
  it('falls back to fmtFull at zero', () => {
    expect(fmtWord(0)).toBe('0');
  });
});

describe('ppd (papers per death)', () => {
  it('divides papers by mortality', () => {
    expect(ppd({ papers: 69347, mortality: 1000 })).toBeCloseTo(69.347, 2);
  });
  it('returns null when mortality is zero', () => {
    expect(ppd({ papers: 738468, mortality: 0 })).toBeNull();
  });
  it('returns null when mortality is missing', () => {
    expect(ppd({ papers: 100 })).toBeNull();
  });
});

describe('deathsPerPaper', () => {
  it('divides mortality by papers', () => {
    expect(deathsPerPaper({ papers: 248989, mortality: 11000000 })).toBeCloseTo(44.18, 1);
  });
  it('returns null when papers is zero', () => {
    expect(deathsPerPaper({ papers: 0, mortality: 1000 })).toBeNull();
  });
  it('returns null when papers is missing', () => {
    expect(deathsPerPaper({ mortality: 1000 })).toBeNull();
  });
});

describe('trendLabel', () => {
  it('labels positive trend as research up', () => {
    expect(trendLabel(12)).toBe('research up 12%');
  });
  it('labels negative trend as research down', () => {
    expect(trendLabel(-13)).toBe('research down 13%');
  });
  it('labels the sentinel value as surged from zero', () => {
    expect(trendLabel(999)).toBe('surged from zero');
  });
  it('labels zero trend as steady', () => {
    expect(trendLabel(0)).toBe('research steady');
  });
});
