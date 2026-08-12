import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import meta from '../data/meta.json';
import { nonDefaultMortalitySources } from '../src/components/ui/MethodologyPanel';

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
