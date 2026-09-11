import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

// The legend root is a single non-wrapping flex row, and its trailing credit
// span is over 100 characters, so it shrinks and wraps its own text before the
// row runs out of space. Legend.jsx already records twice (the comments above
// the counts span and above the credit span) that this is why earlier work was
// scoped out of the narrow widths: at 768-820px an extra item plus its 16px gap
// takes the row 43px to 57px, which is 8px into the gutter the TimeRail's own
// bottom offset is tuned against. The Methodology link is therefore gated on
// the rail being down rather than measured and accepted: while the rail owns
// the bottom of the frame, the legend must stay the height the rail was tuned
// against. There is no resize listener here, so a width read would be stale the
// moment the window changed; the rail's own store phase cannot go stale.
let mockState;
vi.mock('../src/store', () => ({
  default: (selector) => selector(mockState),
}));

const { default: Legend } = await import('../src/components/ui/Legend.jsx');

function renderWith(state) {
  mockState = {
    sizeMode: 'papers',
    uiRevealed: true,
    diseases: [{ id: 'a' }, { id: 'b' }],
    displayEdges: [{}, {}, {}],
    setMethodologyOpen: () => {},
    tmPhase: 'idle',
    tmExitAt: 0,
    ...state,
  };
  return renderToStaticMarkup(React.createElement(Legend));
}

describe('Legend Methodology link (gated on the Time Machine rail)', () => {
  it('offers the desktop route into the panel while the rail is down', () => {
    const html = renderWith({ tmPhase: 'idle' });
    expect(html).toContain('Methodology');
  });

  it('stands down while the rail is up on the tour', () => {
    expect(renderWith({ tmPhase: 'tour' })).not.toContain('Methodology');
  });

  it('stands down while the rail is up on a manual scrub', () => {
    expect(renderWith({ tmPhase: 'scrub' })).not.toContain('Methodology');
  });

  it('never drops the credit line, whichever way the gate falls', () => {
    for (const tmPhase of ['idle', 'tour', 'scrub']) {
      const html = renderWith({ tmPhase });
      expect(html, tmPhase).toContain('Data: PubMed, refreshed weekly');
      expect(html, tmPhase).toContain('Project by Russell J. Young');
    }
  });

  it('keeps the row at the same item count the rail was tuned against', () => {
    // The two states that matter: with the rail up the row is exactly what it
    // was before the link existed, and the link is the only difference when it
    // is down.
    const up = renderWith({ tmPhase: 'tour' });
    const down = renderWith({ tmPhase: 'idle' });
    const spans = (h) => (h.match(/<span/g) || []).length;
    expect(spans(down) - spans(up)).toBe(1);
  });
});
