import { describe, it, expect } from 'vitest';
import {
  labelCap,
  labelWidth,
  rectsOverlap,
  cullOverlaps,
  LABEL_CAP_MIN,
  LABEL_CAP_MAX,
  ROW_H,
} from '../src/utils/labelLayout';

// A label rect at a given center-x/top, sized like a real disease name.
const L = (i, x, top, chars = 10, fs = 9, pinned = false) => ({
  i,
  x,
  top,
  w: labelWidth(chars, fs),
  h: ROW_H,
  pri: 0,
  pinned,
});

describe('labelCap', () => {
  it('leaves the desktop budget exactly where it was', () => {
    // 1440 / 36 = 40, the number the Time Machine has always used.
    expect(labelCap(1440)).toBe(40);
  });

  it('falls to the floor on a phone', () => {
    expect(labelCap(375)).toBe(LABEL_CAP_MIN);
    expect(labelCap(414)).toBe(LABEL_CAP_MIN);
  });

  it('scales in between and never exceeds the ceiling', () => {
    expect(labelCap(768)).toBe(21);
    expect(labelCap(1024)).toBe(28);
    expect(labelCap(2560)).toBe(LABEL_CAP_MAX);
    expect(labelCap(0)).toBe(LABEL_CAP_MIN);
  });
});

describe('rectsOverlap', () => {
  it('sees a horizontal collision on the same row', () => {
    // Two 10-character 9px labels are 54px wide; centers 30px apart collide.
    expect(rectsOverlap(L(0, 100, 200), L(1, 130, 200))).toBe(true);
  });

  it('clears labels far enough apart horizontally', () => {
    expect(rectsOverlap(L(0, 100, 200), L(1, 200, 200))).toBe(false);
  });

  it('clears labels on different rows at the same x', () => {
    expect(rectsOverlap(L(0, 100, 200), L(1, 100, 200 + ROW_H))).toBe(false);
    expect(rectsOverlap(L(0, 100, 200), L(1, 100, 200 + ROW_H - 1))).toBe(true);
  });

  it('is symmetric', () => {
    const a = L(0, 100, 200);
    const b = L(1, 120, 205);
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
  });
});

describe('cullOverlaps', () => {
  it('keeps the first of a colliding pair and drops the second', () => {
    const kept = cullOverlaps([L(0, 100, 200), L(1, 120, 200)]);
    expect(kept).toEqual([0]);
  });

  it('keeps everything that does not collide', () => {
    const kept = cullOverlaps([L(0, 100, 200), L(1, 300, 200), L(2, 100, 400)]);
    expect(kept).toEqual([0, 1, 2]);
  });

  it('respects call order as priority', () => {
    // Same two rects, opposite order: whichever comes first survives.
    expect(cullOverlaps([L(7, 100, 200), L(3, 118, 200)])).toEqual([7]);
    expect(cullOverlaps([L(3, 118, 200), L(7, 100, 200)])).toEqual([3]);
  });

  it('places pinned candidates regardless of collisions or budget', () => {
    const kept = cullOverlaps(
      [L(0, 100, 200), L(1, 105, 200), L(2, 110, 200, 10, 9, true)],
      1
    );
    expect(kept).toContain(2); // the frame's subject is never culled
    expect(kept).toContain(0);
    expect(kept).not.toContain(1);
  });

  it('spends the budget on non-pinned labels only', () => {
    const cands = [
      L(0, 50, 100, 10, 9, true),
      L(1, 250, 100),
      L(2, 450, 100),
      L(3, 650, 100),
    ];
    const kept = cullOverlaps(cands, 2);
    expect(kept).toEqual([0, 1, 2]);
  });

  it('applies the budget without culling when collide is false', () => {
    // The wide frame's path: overlaps are allowed, the cap is the discipline.
    const cands = [L(0, 100, 200), L(1, 105, 200), L(2, 110, 200)];
    expect(cullOverlaps(cands, 40, false)).toEqual([0, 1, 2]);
    expect(cullOverlaps(cands, 2, false)).toEqual([0, 1]);
  });

  it('culls a 153-name phone field down to a non-overlapping set', () => {
    // 153 labels stacked into a 375x812 frame, the round-2 measurement's shape.
    const cands = [];
    for (let i = 0; i < 153; i++) {
      cands.push(L(i, 40 + ((i * 37) % 300), 100 + ((i * 53) % 600), 12, 9));
    }
    const kept = cullOverlaps(cands, labelCap(375));
    expect(kept.length).toBeLessThanOrEqual(labelCap(375));
    const rects = kept.map((i) => cands.find((c) => c.i === i));
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        expect(rectsOverlap(rects[a], rects[b])).toBe(false);
      }
    }
  });
});
