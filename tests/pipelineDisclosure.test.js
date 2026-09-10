import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import connections from '../data/connections.json';

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

  it('keeps the house copy rules in the section it pins', () => {
    const pipeline = panel.slice(panel.indexOf('A GitHub Action re-runs'), panel.indexOf('5. Size mapping'));
    expect(pipeline.length).toBeGreaterThan(500);
    expect(pipeline).not.toContain('—'); // em dash
    expect(pipeline).not.toContain('§'); // section sign
  });
});
