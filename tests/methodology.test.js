import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import meta from '../data/meta.json';
import searchOverrides from '../data/search-overrides.json';
import { nonDefaultMortalitySources } from '../src/components/ui/MethodologyPanel';
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
      expect(d.mortalityYear, d.id).toBeTruthy();
      expect(d.mortalitySource, d.id).toBeTruthy();
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
