import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import audit from '../data/mortality-audit.json';
import { mortalitySourceLabel, deathsStatLabel, isNoGlobalEstimate } from '../src/utils/mortalityLabel';

// The sidebar's deaths tile used to be labelled "WHO Deaths/yr" for all 153
// diseases, which mislabelled every IHME, IARC, UNAIDS and CDC figure and hid
// the West Nile US-only denominator. The label is now derived per disease.
describe('mortalitySourceLabel', () => {
  it('shortens each source family to a recognisable token plus the year the figure describes', () => {
    expect(mortalitySourceLabel('WHO Global Health Estimates 2021', 2021)).toBe('GHE 2021');
    expect(mortalitySourceLabel('IARC GLOBOCAN 2022', 2022)).toBe('GLOBOCAN 2022');
    expect(mortalitySourceLabel('IHME GBD 2021', 2021)).toBe('GBD 2021');
    expect(mortalitySourceLabel('IHME Global Burden of Disease 2021', 2021)).toBe('GBD 2021');
    expect(mortalitySourceLabel('WHO World Malaria Report 2025', 2024)).toBe('WMR 2024');
    expect(mortalitySourceLabel('WHO Global Tuberculosis Report 2025', 2024)).toBe('GTB 2024');
    expect(mortalitySourceLabel('UNAIDS Global AIDS Update 2025', 2024)).toBe('UNAIDS 2024');
  });

  it('names the fact sheets, surveillance notes and single studies the audit traced values to', () => {
    expect(mortalitySourceLabel('WHO rabies fact sheet (modelled estimate, Hampson et al. 2015)', 2015)).toBe('WHO fact sheet 2015');
    expect(mortalitySourceLabel('WHO asthma fact sheet (updated April 2026; IHME GBD 2023)', 2023)).toBe('WHO fact sheet 2023');
    expect(mortalitySourceLabel('WHO/Carter Center dracunculiasis surveillance (10 human cases worldwide in 2025)', 2025)).toBe('WHO surveillance 2025');
    expect(mortalitySourceLabel('WHO/ECDC chikungunya epidemiological updates: 186 reported deaths in 2025', 2025)).toBe('reported, WHO/ECDC 2025');
    expect(mortalitySourceLabel('WHO situation reports, 2026 Bundibugyo Ebola epidemic', 2026)).toBe('WHO outbreak reports 2026');
    expect(mortalitySourceLabel('Costa et al. 2015, PLOS Neglected Tropical Diseases', 2015)).toBe('modelled, Costa 2015');
    expect(mortalitySourceLabel('Naghavi et al., The Lancet 2024 (GRAM/GBD 2021 AMR study)', 2021)).toBe('GRAM/GBD 2021');
    // A study that merely mentions a fact-sheet range keeps the study's name.
    expect(mortalitySourceLabel('Paget et al. 2019, J Glob Health (GLaMOR study), WHO-cited; WHO fact sheet range 290,000-650,000 respiratory deaths/yr', 2019)).toBe('modelled, Paget 2019');
  });

  it('keeps the caveat visible where the figure is not a global annual rate', () => {
    expect(mortalitySourceLabel('CDC, US mean 2014-2023; no global estimate exists', 2023)).toBe('US only, CDC 2023');
    expect(mortalitySourceLabel('WHO COVID-19 dashboard, reported deaths 2023; global reporting has since largely ceased', 2023)).toBe('WHO reported 2023');
    expect(mortalitySourceLabel('Rudd et al., Lancet 2020 (GBD 2017), WHO-cited; sepsis-associated deaths overlap underlying causes', 2017)).toBe('GBD 2017, sepsis-associated');
    expect(mortalitySourceLabel('IHME GBD 2021 (lower respiratory infections)', 2021)).toBe('GBD 2021, all LRI');
  });

  it('says so plainly where no authority publishes a global estimate', () => {
    expect(mortalitySourceLabel('No global cause-of-death line; heart failure deaths are assigned to underlying causes', 2021)).toBe('no global estimate');
    expect(mortalitySourceLabel('No citable global figure; national registry data only', 2021)).toBe('no global estimate');
    expect(mortalitySourceLabel('Not a cause-of-death category in any global source; 0 is a modeling boundary', 2021)).toBe('no global estimate');
    expect(mortalitySourceLabel('Share of combined IBD line; not published per disease', 2021)).toBe('no global estimate');
    expect(mortalitySourceLabel('US-only vital statistics (~1,000/yr underlying cause, CDC 1999-2016); no global figure', 2021)).toBe('no global estimate');
    // A named source that publishes a figure and then notes the gap keeps its name.
    expect(mortalitySourceLabel('WHO typhoid fact sheet (estimate for 2019; typhoid has no GHE cause line)', 2019)).toBe('WHO fact sheet 2019');
    expect(isNoGlobalEstimate('WHO typhoid fact sheet (estimate for 2019; typhoid has no GHE cause line)')).toBe(false);
  });

  it('renders cleanly when the row describes no particular year', () => {
    // Audit-flagged rows carry no mortalityYear: there is no reference year to
    // state, and borrowing one would invent precision.
    expect(mortalitySourceLabel('No citable global figure', null)).toBe('no global estimate');
    expect(mortalitySourceLabel('IHME GBD 2021', null)).toBe('GBD');
    expect(mortalitySourceLabel('IHME GBD 2021 (lower respiratory infections)', undefined)).toBe('GBD, all LRI');
    expect(mortalitySourceLabel('Some New Registry, page 4', null)).toBe('Some New Registry');
    expect(deathsStatLabel(500000, 'No WHO GHE or IHME GBD cause line (injury deaths are coded to external causes)', null))
      .toBe('Deaths/yr · no global estimate');
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
    expect(mortalitySourceLabel('WHO Global Health Estimates 2021', null)).toBe('GHE');
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
        // A zero from a source that publishes zero needs no caption; a zero that
        // exists only because nobody publishes anything says exactly that.
        expect([`Deaths/yr`, `Deaths/yr · no global estimate`], d.id).toContain(label);
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
    expect(lbl(byId['rabies'])).toBe('Deaths/yr · WHO fact sheet 2015');
    expect(lbl(byId['ebola'])).toBe('Deaths/yr · WHO outbreak reports 2026');
  });

  it('captions every audit-flagged row as having no global estimate, zero or not', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const flagged = Object.entries(audit).filter(([, m]) => m.action === 'flag').map(([id]) => id);
    expect(flagged.length).toBe(30);
    for (const id of flagged) {
      const d = byId[id];
      expect(deathsStatLabel(d.mortality, d.mortalitySource, d.mortalityYear), id)
        .toBe('Deaths/yr · no global estimate');
    }
    // Including the ones that still carry a region-only number.
    expect(byId['traumatic-brain-injury'].mortality).toBeGreaterThan(0);
    expect(byId['buruli-ulcer'].mortality).toBe(0);
  });
});
