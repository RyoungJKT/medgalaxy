import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import meta from '../data/meta.json';
import searchOverrides from '../data/search-overrides.json';
import { nonDefaultMortalitySources, timeMachineMapping } from '../src/components/ui/MethodologyPanel';
import {
  buildTimeMachineData, KNEE_PCT, KNEE_SHARE, BULK_EXP, MXY,
} from '../src/utils/timeMachineData';
import { isNoGlobalEstimate } from '../src/utils/mortalityLabel';
import { pubmedTermFor } from '../src/utils/pubmedTerms';

describe('methodology non-default mortality source table', () => {
  const rows = nonDefaultMortalitySources(diseases, meta.mortalityDefaultSource);
  const ids = rows.map(d => d.id);

  it('returns exactly the diseases whose mortalitySource differs from meta.mortalityDefaultSource', () => {
    const expected = diseases
      .filter(d => d.mortalitySource !== meta.mortalityDefaultSource)
      .map(d => d.id)
      .sort();
    expect([...ids].sort()).toEqual(expected);
  });

  it('spot-checks the diseases known to carry a non-default source', () => {
    expect(ids).toContain('sepsis');
    expect(ids).toContain('covid-19');
    expect(ids).toContain('ebola');
  });

  it('excludes a disease known to use the default source', () => {
    expect(ids).not.toContain('dengue');
  });

  it('every row carries the fields the table renders', () => {
    for (const d of rows) {
      expect(d.label, d.id).toBeTruthy();
      expect(d.mortalitySource, d.id).toBeTruthy();
      // Year is optional: rows where no authority publishes an estimate
      // describe no reference year, and the table prints "none" for them.
      if (d.mortalityYear !== undefined) expect(typeof d.mortalityYear, d.id).toBe('number');
    }
  });

  it('the no-global-estimate count the panel states is derived from the data it shows', () => {
    // The panel computes this with the same predicate the sidebar tile uses, so
    // the sentence cannot claim a count the source column contradicts.
    const derived = diseases.filter(d => isNoGlobalEstimate(d.mortalitySource)).length;
    expect(derived).toBe(46);
    expect(derived).toBeLessThan(diseases.length);
    // Every one of them is an exception row, never the shared default source.
    for (const d of diseases) {
      if (!isNoGlobalEstimate(d.mortalitySource)) continue;
      expect(d.mortalitySource, d.id).not.toBe(meta.mortalityDefaultSource);
      expect(ids, d.id).toContain(d.id);
    }
  });
});

// The sidebar's "View on PubMed" link must reproduce the totals the pipeline
// queried for, which means it has to resolve the same 11 overrides
// scripts/refresh_pubmed.py and scripts/backfill_yearly.py use — all three
// now load from the single data/search-overrides.json file.
describe('data/search-overrides.json', () => {
  it('holds exactly the 11 diseases the pipeline overrides', () => {
    const expected = [
      'plague', 'hpv', 'mrsa', 'nafld', 'als', 'copd',
      'adhd', 'ocd', 'ptsd', 'c-difficile', 'hiv-aids',
    ].sort();
    expect(Object.keys(searchOverrides).sort()).toEqual(expected);
  });

  it('every override id is a real disease in diseases.json', () => {
    const ids = new Set(diseases.map(d => d.id));
    for (const id of Object.keys(searchOverrides)) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe('pubmedTermFor (Sidebar link term)', () => {
  it('resolves an overridden id to its expanded clinical phrase', () => {
    expect(pubmedTermFor('copd', 'COPD')).toBe('chronic obstructive pulmonary disease');
  });

  it('resolves a non-overridden id to its plain label', () => {
    expect(pubmedTermFor('dengue', 'Dengue')).toBe('Dengue');
  });

  it('strips a parenthetical from the label when there is no override', () => {
    expect(pubmedTermFor('sleeping-sickness', 'Sleeping Sickness (African Trypanosomiasis)')).toBe('Sleeping Sickness');
  });

  it('every disease in diseases.json resolves to a non-empty term', () => {
    for (const d of diseases) {
      expect(pubmedTermFor(d.id, d.label), d.id).toBeTruthy();
    }
  });
});

// ─── Delta-list item 7: disclosure keeps pace with drama ─────────────────────
// The per-year curve is now shaped for legibility past the area-proportional
// convention the cumulative view follows, so it has to be described where every
// other mapping is described. This is the price of the extra drama.
describe('methodology "Time Machine size mapping" subsection', () => {
  const data = buildTimeMachineData(diseases);
  const map = timeMachineMapping(data);

  it('names the file the curve lives in', () => {
    expect(map.file).toBe('src/utils/timeMachineData.js');
    expect(map.text).toContain('src/utils/timeMachineData.js');
  });

  it('states the knee percentile, the knee count, the exponent, the share and the ceiling', () => {
    expect(map.kneePct).toBe(KNEE_PCT);
    expect(map.knee).toBe(data.knee);
    expect(map.sharePct).toBe(Math.round(KNEE_SHARE * 100));
    expect(map.exponent).toBe(BULK_EXP);
    expect(map.ceiling).toBe(MXY);
    expect(map.text).toContain(`${KNEE_PCT}th percentile`);
    expect(map.text).toContain(data.knee.toLocaleString('en-US'));
    expect(map.text).toContain(data.maxYearly.toLocaleString('en-US'));
    expect(map.text).toContain(`${Math.round(KNEE_SHARE * 100)} percent`);
    expect(map.text).toContain(BULK_EXP.toFixed(2));
    expect(map.text).toContain(`ceiling of ${MXY} units`);
  });

  it('reads every numeral from the built table rather than transcribing one', () => {
    // Feed it a different table and every figure in the sentence moves. A
    // transcribed numeral would survive this unchanged.
    const half = buildTimeMachineData(
      diseases.map(d => ({ ...d, yearlyPapers: d.yearlyPapers.map(v => Math.round(v / 3)) }))
    );
    const other = timeMachineMapping(half);
    expect(other.knee).not.toBe(map.knee);
    expect(other.maxYearly).not.toBe(map.maxYearly);
    expect(other.text).not.toBe(map.text);
    expect(other.text).toContain(half.knee.toLocaleString('en-US'));
    // The shape of the curve is a constant, not data: those do not move.
    expect(other.ceiling).toBe(map.ceiling);
    expect(other.exponent).toBe(map.exponent);
  });

  it('keeps the house copy rules', () => {
    expect(map.text).not.toContain('—'); // em dash
    expect(map.text).not.toContain('§'); // section sign
  });
});
