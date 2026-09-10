import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import connections from '../data/connections.json';
import diseases from '../data/diseases.json';
import { processData, seriesExceedsTotal } from '../src/utils/helpers';

// ─── The pipeline paragraph may not promise more than the pipeline does ──────
// The methodology panel used to tell the reader that the weekly job "re-queries
// just the pairs a fresh total leaves behind, so a shared-paper count always
// describes the same PubMed snapshot as the totals beside it". The only check
// behind that sentence was reconcile_connections, which re-queries a pair only
// when its count exceeds an endpoint total: an invariant a GROWING total can
// never trip. So when PubMed's term mapping for Colorectal Cancer roughly
// doubled that row's total on 2026-09-11, its 13 pair counts were left
// describing the narrower query, every colorectal edge score was deflated by
// about 28 percent, and the run still printed "Connections already consistent".
//
// This file reads the sentence and the script together, in the same spirit as
// the call-site scan in tests/audio.test.js, so weakening either one fails here
// rather than on screen. It lives outside tests/methodology.test.js because
// that file binds a local `meta` from data/meta.json, which vite's SSR
// transform then collides with `import.meta` in the same module.
const HERE = fileURLToPath(import.meta.url);
const REPO = path.join(path.dirname(HERE), '..');
const read = (...parts) => fs.readFileSync(path.join(REPO, ...parts), 'utf8');

// The panel is rendered rather than only grepped for the count assertions
// below, so what is pinned is the sentence a reader sees, not a variable name.
let mockState;
vi.mock('../src/store', () => ({ default: (selector) => selector(mockState) }));
const { default: MethodologyPanel } = await import('../src/components/ui/MethodologyPanel.jsx');

function renderPanel() {
  const processed = processData(diseases, connections);
  mockState = {
    methodologyOpen: true,
    setMethodologyOpen: () => {},
    diseases: processed.diseases,
    displayEdges: processed.displayEdges,
  };
  return renderToStaticMarkup(React.createElement(MethodologyPanel));
}

describe('methodology pipeline paragraph vs scripts/refresh_pubmed.py', () => {
  const panel = read('src', 'components', 'ui', 'MethodologyPanel.jsx');
  const script = read('scripts', 'refresh_pubmed.py');

  it('makes no claim the reconciliation cannot keep', () => {
    expect(panel).not.toContain('always describes the same PubMed snapshot');
    expect(panel).not.toContain('re-queries just the pairs a fresh total leaves behind');
  });

  it('names both triggers the weekly job re-queries on', () => {
    expect(panel).toContain('no longer fits inside its endpoints');
    expect(panel).toContain('moved by more than a quarter in one week');
  });

  it('the script implements the endpoint-jump trigger the paragraph names', () => {
    const m = /^MAPPING_JUMP\s*=\s*([\d.]+)/m.exec(script);
    expect(m, 'MAPPING_JUMP missing from scripts/refresh_pubmed.py').toBeTruthy();
    // "more than a quarter" on screen is this constant, not a second number.
    expect(Number(m[1])).toBe(0.25);
    expect(script).toMatch(/def reconcile_connections\(diseases, jumped=/);
    // The stale set is both triggers, not the invariant on its own.
    expect(script).toMatch(/violates\(c\) or touches_jumped\(c\)/);
    expect(script).toMatch(/jumped\.add\(/);
  });

  it('derives the re-queried pair count instead of stating a literal', () => {
    // The colorectal paragraph names how many pairs were re-queried alongside
    // that row's year-by-year series. It is read from the connection file at
    // render time, like every other numeral in this panel.
    const pairs = connections.filter(c => c.source === 'colon-cancer' || c.target === 'colon-cancer');
    expect(pairs.length).toBe(13);
    expect(panel).toContain('remappedPairCount');
    expect(panel).not.toMatch(/\b13 (connection|pair)/);
  });

  it('describes the search term itself changing, not PubMed remapping it', () => {
    // Colorectal cancer's total went 180,574 to 351,932 because the row's own
    // label, and so its search term (get_search_term falls back to the label),
    // was changed from Colon Cancer to Colorectal Cancer on this branch after
    // the 2026-08-10 snapshot, so 2026-09-11 was the first run under the new
    // term. Attributing it to PubMed's automatic mapping is a claim about an
    // outside service that the git history does not support.
    expect(panel).not.toContain('PubMed changed its automatic term mapping');
    expect(script).not.toContain('changing the automatic term mapping behind that search term');
    expect(panel).toContain('search term');
  });

  it('keeps the house copy rules in the section it pins', () => {
    const pipeline = panel.slice(panel.indexOf('A GitHub Action re-runs'), panel.indexOf('5. Size mapping'));
    expect(pipeline.length).toBeGreaterThan(500);
    expect(pipeline).not.toContain('—'); // em dash
    expect(pipeline).not.toContain('§'); // section sign
  });
});

// ─── One predicate for "the series sums above the total" ─────────────────────
// The panel used to spell the count into its prose ("For six diseases the
// series sums slightly above the all-time total"), while the sidebar's note
// under the sparkline was derived. The 2026-09-11 refresh moved COVID-19's
// total above its own series sum, so the app said five on one screen and six
// one click away. Both surfaces now share seriesExceedsTotal, and the count in
// the sentence is counted from the same rows the note fires on.
describe('the series-over-total count is counted, not written in', () => {
  const panel = read('src', 'components', 'ui', 'MethodologyPanel.jsx');
  const sidebar = read('src', 'components', 'ui', 'Sidebar.jsx');
  const rows = diseases.filter(seriesExceedsTotal);

  it('names a real, non-trivial subset of the file', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(diseases.length);
  });

  it('the sidebar note and the panel count run the same predicate', () => {
    expect(sidebar).toContain('seriesExceedsTotal(disease)');
    expect(panel).toContain('diseases.filter(seriesExceedsTotal)');
  });

  it('leaves no number word or literal standing in the sentence', () => {
    expect(panel).not.toMatch(
      /For (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten) diseases the series sums/
    );
  });

  it('renders the count the sidebar note actually fires on', () => {
    const html = renderPanel();
    expect(html).toContain(`For ${rows.length} diseases the series sums slightly above the all-time total`);
  });
});
