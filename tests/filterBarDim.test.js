import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

// FilterBar's neglect-mode (Attention Map) branch used to spread the shared
// `dim` object's opacity onto a div that also carries a still-attached
// `animation: fadeIn 0.4s ease forwards`. Per the CSS cascade a running (or
// finished, fill-mode forwards) animation's effect on a property outranks a
// normal-origin inline style for that same property, so the animation's held
// end state (opacity 1) kept winning over `dim`'s opacity 0.3 while a story
// was active, even though the rendered inline style attribute correctly said
// opacity:0.3. jsdom does not run CSS animations at all, so this regression
// cannot be caught by asserting a computed style in a DOM test; the fix has
// to stop the animation from being attached (or holding an opacity effect)
// once a story is active, which we can verify directly off the server-
// rendered markup's inline style string.
let mockState;
vi.mock('../src/store', () => ({
  default: (selector) => selector(mockState),
}));

const { default: FilterBar } = await import('../src/components/ui/FilterBar.jsx');

function renderWith(state) {
  mockState = {
    activeCats: new Set(),
    toggleCat: () => {},
    neglectMode: true,
    uiRevealed: true,
    ...state,
  };
  return renderToStaticMarkup(React.createElement(FilterBar));
}

describe('FilterBar neglect-mode dim (Task 3 finding: animation outranks dim opacity)', () => {
  it('keeps the mount-time fadeIn animation when no story is active', () => {
    const html = renderWith({ storyActive: false });
    expect(html).toContain('fadeIn');
  });

  it('does not leave a still-attached opacity-owning animation once a story is active', () => {
    const html = renderWith({ storyActive: true });
    // The fadeIn keyframe only ever sets `to { opacity: 1 }`. As long as
    // `animation` still names it, that animation origin keeps opacity:1 in
    // a real browser no matter what the inline opacity says. The fix must
    // stop naming it (e.g. `animation:none`) once a story owns the frame.
    expect(html).not.toContain('fadeIn');
    expect(html).toMatch(/opacity:0\.3/);
  });
});
