import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { storyProvenance } from '../src/utils/storyProvenance';
import { isNoGlobalEstimate } from '../src/utils/mortalityLabel';

const byId = Object.fromEntries(diseases.map((d) => [d.id, d]));

describe('storyProvenance (the story caption micro-line)', () => {
  it('names PubMed for a papers figure', () => {
    expect(storyProvenance('papers', byId['breast-cancer'])).toBe('PubMed, refreshed weekly');
  });
  it('names the mortality source and year for a deaths figure', () => {
    const s = storyProvenance('deaths', byId['sepsis']);
    expect(s).toMatch(/GBD/);
    expect(s).toMatch(/\d{4}/);
  });
  it('joins both with a middle dot for a ratio', () => {
    const s = storyProvenance('ratio', byId['malaria']);
    expect(s.startsWith('PubMed, refreshed weekly · ')).toBe(true);
    expect(s).toMatch(/WMR|WHO|GBD|GHE/);
  });
  it('never invents a mortality source for a no-estimate row', () => {
    const noEst = diseases.find((d) => isNoGlobalEstimate(d.mortalitySource));
    expect(noEst).toBeTruthy();
    expect(storyProvenance('deaths', noEst)).toBe('');
    expect(storyProvenance('ratio', noEst)).toBe('PubMed, refreshed weekly');
  });
  it('is empty for a moral line', () => {
    expect(storyProvenance('none', byId['sepsis'])).toBe('');
  });
  it('carries no em dash for any disease and kind', () => {
    for (const d of diseases) for (const k of ['papers', 'deaths', 'ratio'])
      expect(storyProvenance(k, d)).not.toContain('—');
  });
});
