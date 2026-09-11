import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

// The peak card's spine line is 79 characters of the user's verbatim wording,
// and on a 375px phone it cannot sit in two lines at the caption's second-line
// size without shrinking the type below the data line. The plan owner's
// 2026-09-11 amendment to Step 5 therefore asks for balance rather than a line
// count: `text-wrap: balance` redistributes the breaks over the same number of
// lines, so the last line stops carrying a single orphaned word ("2020.").
// Desktop caption lines are `nowrap` and must not gain the property at all.
const { TimeCaption } = await import('../src/components/ui/TimeRail.jsx');

const caption = {
  lines: [
    'Attention can move this fast.',
    'HIV/AIDS took 24 years to reach 7,534 papers a year. COVID-19 passed that in 2020.',
  ],
  data: '141,953 COVID-19 papers in 2021 alone.',
  micro: 'A micro line, for the finale only.',
};

const render = (mob) => renderToStaticMarkup(
  React.createElement(TimeCaption, { caption, mob, tall: true, leaving: 0 })
);

const count = (html, needle) => html.split(needle).length - 1;

describe('TimeCaption line wrapping', () => {
  it('balances every caption line on the phone', () => {
    const html = render(true);
    expect(count(html, 'text-wrap:balance')).toBe(caption.lines.length);
    expect(html).toContain('white-space:normal');
  });

  it('leaves the data and micro lines unbalanced', () => {
    // Only the `lines` array is balanced: the data line is a short 11px
    // string and the micro line is a paragraph with its own maxWidth, and
    // neither was part of the amendment.
    const html = render(true);
    const afterLines = html.slice(html.indexOf(caption.data));
    expect(afterLines).not.toContain('text-wrap:balance');
  });

  it('does not touch the desktop lines, which never wrap', () => {
    const html = render(false);
    expect(html).not.toContain('text-wrap');
    expect(html).toContain('white-space:nowrap');
  });
});
