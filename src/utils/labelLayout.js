// Screen-space label budget and collision culling for the DOM label layer.
//
// Both halves are pure so the rule that matters — a label never draws on top of
// a more important one — is testable without a scene (review gate round 2, P1
// #5: 26 overlapping label pairs measured at 375px during tour pauses).

// The label budget, scaled by how much frame there is to spend it in. The
// desktop number is unchanged on purpose: at 1440px this returns exactly the 40
// the Time Machine has always used, and it falls to the floor of 12 well before
// a phone (375/36 = 10.4 -> 12), which is the width the round-2 reviewer
// measured the pile-up at.
export const LABEL_CAP_MIN = 12;
export const LABEL_CAP_MAX = 40;
export function labelCap(viewportWidth) {
  const raw = Math.round((viewportWidth || 0) / 36);
  return raw < LABEL_CAP_MIN ? LABEL_CAP_MIN : raw > LABEL_CAP_MAX ? LABEL_CAP_MAX : raw;
}

// Monospace advance ratio: IBM Plex Mono's glyph box is 0.6em wide, and the
// label carries no letter-spacing, so a name's rendered width is its character
// count times 0.6 times its own font size. (A 22-character name at 12px is
// ~158px, which is 42 percent of a 375px frame — that is why two of them
// overlapping is the default outcome rather than bad luck.)
export const CHAR_W = 0.6;
// One text row plus the shadow's bleed, so two labels one row apart do not
// touch. Matches the 14px the round-2 measurement used at the mobile size, and
// covers the label container's own strut (its 7px font at Chromium's normal
// line-height measures 10.5px tall however small the name inside it is).
export const ROW_H = 14;
// Chromium's `normal` line-height for this stack, measured off the live layer:
// a 5px name renders a 10.5px box, a 12px name an 18px one. The rect that has
// to clear its neighbours is the line box, not the glyph.
export const LINE_H = 1.5;

/** Width in px of a label with `len` characters rendered at `fontSize`. */
export function labelWidth(len, fontSize) {
  return len * fontSize * CHAR_W;
}

/** Height in px of the line box a label at `fontSize` actually occupies. */
export function labelHeight(fontSize) {
  const h = fontSize * LINE_H;
  return h < ROW_H ? ROW_H : h;
}

/**
 * Do two label rects overlap? Rects are center-anchored horizontally (the DOM
 * layer draws them with translateX(-50%)) and top-anchored vertically.
 * @param {{x:number, top:number, w:number, h:number}} a
 * @param {{x:number, top:number, w:number, h:number}} b
 */
export function rectsOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    a.top < b.top + b.h &&
    b.top < a.top + a.h
  );
}

/**
 * Greedy screen-space cull. Walks `cands` in the order given (callers sort by
 * priority, biggest first) and keeps a candidate only if its rect clears every
 * label already placed. `pinned` candidates — the frame's own subjects: hover,
 * selection, the finale's focus — are always placed and always collide against,
 * so the piece's subject never loses its name to an accident of ordering.
 *
 * @param {Array<{i:number, x:number, top:number, w:number, h:number, pinned?:boolean}>} cands
 * @param {number} [limit] maximum non-pinned labels to place (see labelCap)
 * @param {boolean} [collide] false applies the budget only, leaving overlaps
 *   alone — what a wide frame wants, where the cap is the whole discipline
 * @returns {number[]} the `i` of every candidate that survived, in placement order
 */
export function cullOverlaps(cands, limit = Infinity, collide = true) {
  const placed = [];
  const kept = [];
  let budget = limit;
  for (let k = 0; k < cands.length; k++) {
    const c = cands[k];
    if (!c.pinned) {
      if (budget <= 0) continue;
      if (collide) {
        let hit = false;
        for (let j = 0; j < placed.length; j++) {
          if (rectsOverlap(c, placed[j])) { hit = true; break; }
        }
        if (hit) continue;
      }
      budget -= 1;
    }
    placed.push(c);
    kept.push(c.i);
  }
  return kept;
}

export default cullOverlaps;
