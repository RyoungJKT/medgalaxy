import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { mortalitySourceLabel, deathsStatLabel } from '../src/utils/mortalityLabel';

// The sidebar's deaths tile used to be labelled "WHO Deaths/yr" for all 153
// diseases, which mislabelled every IHME, IARC, UNAIDS and CDC figure and hid
// the West Nile US-only denominator. The label is now derived per disease.
describe('mortalitySourceLabel', () => {
  it('shortens each source family to a recognisable token plus the year the figure describes', () => {
    expect(mortalitySourceLabel('WHO Global Health Estimates 2021', 2021)).toBe('GHE 2021');
    expect(mortalitySourceLabel('IARC GLOBOCAN 2022', 2022)).toBe('GLOBOCAN 2022');
    expect(mortalitySourceLabel('IHME GBD 2021', 2021)).toBe('GBD 2021');
    expect(mortalitySourceLabel('WHO World Malaria Report 2025', 2024)).toBe('WMR 2024');
    expect(mortalitySourceLabel('WHO Global Tuberculosis Report 2025', 2024)).toBe('GTB 2024');
    expect(mortalitySourceLabel('UNAIDS Global AIDS Update 2025', 2024)).toBe('UNAIDS 2024');
  });

  it('keeps the caveat visible where the figure is not a global annual rate', () => {
    expect(mortalitySourceLabel('CDC, US mean 2014-2023; no global estimate exists', 2023)).toBe('US only, CDC 2023');
    expect(mortalitySourceLabel('WHO/CDC outbreak records 2025, DRC 45 plus Uganda 4; episodic, 2014-16 averaged ~3,800/yr', 2025)).toBe('outbreak records 2025');
    expect(mortalitySourceLabel('WHO COVID-19 dashboard, reported deaths 2023; global reporting has since largely ceased', 2023)).toBe('WHO reported 2023');
    expect(mortalitySourceLabel('Rudd et al., Lancet 2020 (GBD 2017), WHO-cited; sepsis-associated deaths overlap underlying causes', 2017)).toBe('GBD 2017, sepsis-associated');
    expect(mortalitySourceLabel('IHME GBD 2021 (lower respiratory infections)', 2021)).toBe('GBD 2021, all LRI');
  });

  it('shows the year the figure describes, not the year the report was published', () => {
    // WHO's World Malaria Report 2025 reports 2024 deaths.
    expect(mortalitySourceLabel('WHO World Malaria Report 2025', 2024)).toContain('2024');
    expect(mortalitySourceLabel('WHO World Malaria Report 2025', 2024)).not.toContain('2025');
  });

  it('falls back to the leading clause rather than dropping the source', () => {
    expect(mortalitySourceLabel('Some New Registry, page 4', 2030)).toBe('Some New Registry 2030');
  });

  it('returns null when there is nothing to attribute', () => {
    expect(mortalitySourceLabel(null, 2021)).toBeNull();
    expect(mortalitySourceLabel('WHO Global Health Estimates 2021', null)).toBeNull();
  });
});

describe('deathsStatLabel over the real dataset', () => {
  it('gives every disease with a mortality figure a sourced, compact label', () => {
    for (const d of diseases) {
      const label = deathsStatLabel(d.mortality, d.mortalitySource, d.mortalityYear);
      if (d.mortality > 0) {
        expect(label, d.id).toMatch(/^Deaths\/yr · .+/);
        // The tile spans the sidebar's full 301px content width; at 11px mono
        // this keeps every label on one line.
        expect(label.length, `${d.id}: ${label}`).toBeLessThanOrEqual(40);
      } else {
        expect(label, d.id).toBe('Deaths/yr');
      }
    }
  });

  it('drops the blanket WHO claim from sources that are not WHO', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const lbl = d => deathsStatLabel(d.mortality, d.mortalitySource, d.mortalityYear);
    expect(lbl(byId['stroke'])).toBe('Deaths/yr · GBD 2021');
    expect(lbl(byId['breast-cancer'])).toBe('Deaths/yr · GLOBOCAN 2022');
    expect(lbl(byId['west-nile-virus'])).toBe('Deaths/yr · US only, CDC 2023');
    expect(lbl(byId['malaria'])).toBe('Deaths/yr · WMR 2024');
    expect(lbl(byId['hiv-aids'])).toBe('Deaths/yr · UNAIDS 2024');
  });
});
