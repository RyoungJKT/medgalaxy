import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import connections from '../data/connections.json';
import insights from '../data/disease-insights.json';
import audit from '../data/mortality-audit.json';
import { isNoGlobalEstimate } from '../src/utils/mortalityLabel';

describe('data invariants', () => {
  it('has 153 diseases with required fields', () => {
    expect(diseases.length).toBe(153);
    for (const d of diseases) {
      for (const k of ['id','label','category','description','papers','trend','mortality','fundingGap','yearlyPapers','region'])
        expect(d, d.id).toHaveProperty(k);
    }
  });
  it('yearlyPapers arrays are uniform length and non-negative', () => {
    const len = diseases[0].yearlyPapers.length;
    for (const d of diseases) {
      expect(d.yearlyPapers.length, d.id).toBe(len);
      for (const v of d.yearlyPapers) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
  it('connections resolve and have positive sharedPapers', () => {
    const ids = new Set(diseases.map(d => d.id));
    for (const c of connections) {
      expect(ids.has(c.source), c.source).toBe(true);
      expect(ids.has(c.target), c.target).toBe(true);
      expect(c.sharedPapers).toBeGreaterThan(0);
    }
  });
  it('sharedPapers are live PubMed co-occurrence counts, not authored round numbers', () => {
    // scripts/regenerate_connections.py queries "(termA) AND (termB)" all-time
    // for every pair. Real counts are near-unique and mostly not round; the
    // authored set they replaced had 736 pairs sharing only 53 distinct values,
    // every one a multiple of 100. This gate fails if anyone hand-edits them back.
    expect(connections.length).toBe(736);
    const distinct = new Set(connections.map(c => c.sharedPapers));
    expect(distinct.size).toBeGreaterThan(600);
    const roundHundreds = connections.filter(c => c.sharedPapers % 100 === 0);
    expect(roundHundreds.length).toBeLessThan(connections.length * 0.1);
  });
  it('connections carry no authored trend field', () => {
    // The per-pair trend was an authored up/stable/down label rendered beside a
    // measured count. It is gone from the data and from every display.
    for (const c of connections) {
      expect(Object.keys(c).sort(), `${c.source}|${c.target}`).toEqual(['sharedPapers', 'source', 'target']);
    }
  });
  it('insights cover every disease with exactly the 9 canonical fields', () => {
    const canonical = ['whatItIs','whyItMatters','whyNeglected','mismatchInsight','top3Reasons','memorableFact','questionRaised','burdenAnswer','accelerateAnswer'];
    for (const d of diseases) {
      const ins = insights[d.id];
      expect(ins, d.id).toBeTruthy();
      expect(Object.keys(ins).sort(), d.id).toEqual([...canonical].sort());
    }
  });
  it('no absurd trend artifacts (<= 999 percent)', () => {
    for (const d of diseases) expect(Math.abs(d.trend), d.id).toBeLessThanOrEqual(999);
  });
  // Replaces the earlier hand-listed corrections test. Every one of the 153
  // rows was re-checked against the document it cites in the 2026-08-12
  // provenance audit, and the applied truth is recorded in
  // data/mortality-audit.json. Holding the whole dataset against that manifest
  // guards the default pool permanently: a value edited without its source, or
  // a source edited without re-checking the value, fails here.
  it('every mortality triple equals the audit manifest it was applied from', () => {
    expect(Object.keys(audit).length).toBe(diseases.length);
    const mismatches = [];
    for (const d of diseases) {
      const m = audit[d.id];
      if (!m) { mismatches.push(`${d.id}: not in manifest`); continue; }
      if (d.mortality !== m.value) mismatches.push(`${d.id}: mortality ${d.mortality} != ${m.value}`);
      if ((d.mortalityYear ?? null) !== (m.year ?? null)) mismatches.push(`${d.id}: year ${d.mortalityYear} != ${m.year}`);
      if (d.mortalitySource !== m.source) mismatches.push(`${d.id}: source\n  ${d.mortalitySource}\n  ${m.source}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('the manifest records how each row was resolved, and when it was checked', () => {
    const actions = { keep: 0, relabel: 0, correct: 0, flag: 0 };
    for (const [id, m] of Object.entries(audit)) {
      expect(actions, id).toHaveProperty(m.action);
      actions[m.action] += 1;
      expect(m.source, id).toBeTruthy();
      expect(m.checked, id).toBe('2026-08-12');
      expect(['high', 'medium', 'low'], id).toContain(m.confidence);
    }
    expect(actions).toEqual({ keep: 39, relabel: 61, correct: 23, flag: 30 });
  });

  // Spot-checks that state, in the test itself, what the audit concluded for
  // the rows a reader is most likely to check by hand.
  it('spot-checks the figures the audit moved furthest', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const expected = {
      // Each verified against the named primary document, figure as printed there.
      // WHO World malaria report 2025, executive summary: "an estimated 282
      // million cases and 610 000 deaths worldwide in 2024".
      malaria: [610000, 2024, 'WHO World Malaria Report 2025'],
      // WHO Global tuberculosis report 2025 factsheet: "Globally in 2024, TB
      // caused an estimated 1.23 million deaths".
      tuberculosis: [1230000, 2024, 'WHO Global Tuberculosis Report 2025'],
      // WHO COVID-19 dashboard global daily data, New_deaths summed over 2023
      // (= 294,000; the cumulative-column delta for 2023 agrees exactly).
      'covid-19': [294000, 2023, 'WHO COVID-19 dashboard, reported deaths 2023; global reporting has since largely ceased'],
      // The 2025 figure (DRC Kasai 45 plus Uganda 4) is superseded by the
      // ongoing 2026 Bundibugyo epidemic: ~4,400 confirmed cases and 2,013
      // deaths as of 11 Aug 2026, the largest outbreak since 2014-16.
      ebola: [2013, 2026],
      // GBD 2021 stroke (Lancet Neurol 2024;23:973-1003): "7.3 million
      // [95% UI 6.6-7.8] deaths", third leading cause of death in 2021.
      stroke: [7300000, 2021, 'IHME GBD 2021'],
      // GBD 2021 LRI (Lancet Infect Dis 2024;24:974-1002): "2.18 million
      // deaths (1.98-2.36)" from non-COVID-19 lower respiratory infections.
      pneumonia: [2180000, 2021, 'IHME GBD 2021 (lower respiratory infections)'],
      // WHO, 28 Nov 2025: "an estimated 95 000 people ... died due to measles
      // in 2024". The prior 108,000 was the 2023 estimate labelled 2021.
      measles: [95000, 2024, 'WHO measles estimates, 2024'],
      // WHO Global hepatitis report 2026 (28 Apr 2026) supersedes the 2024
      // report: 1.1 million hepatitis B and 240,000 hepatitis C deaths in 2024.
      'hepatitis-b': [1100000, 2024, 'WHO Global Hepatitis Report 2026'],
      'hepatitis-c': [240000, 2024, 'WHO Global Hepatitis Report 2026'],
      // IARC GLOBOCAN 2022 (v1.1, 08.02.2024) world fact sheet deaths, to the
      // nearest thousand: breast 666 103, lung 1 817 469, colorectum 904 019.
      'breast-cancer': [666000, 2022, 'IARC GLOBOCAN 2022'],
      'lung-cancer': [1817000, 2022, 'IARC GLOBOCAN 2022'],
      // 904,000 is GLOBOCAN's colorectum total (colon 538k, rectum 344k, anus
      // 22k), so the row is labelled for the construct it actually carries.
      'colon-cancer': [904000, 2022, 'IARC GLOBOCAN 2022 (colorectum incl. anus)'],
      // GHE 2021's whooping cough line is 59,174; the value was never GBD's.
      pertussis: [59000, 2021, 'WHO Global Health Estimates 2021 (whooping cough)'],
      'west-nile-virus': [130, 2023, 'CDC, US mean 2014-2023; no global estimate exists'],
      // Was 4,700, a US-only count wearing a global citation.
      'multiple-sclerosis': [16300, 2021, 'IHME GBD 2021'],
    };
    for (const [id, [mortality, year, source]] of Object.entries(expected)) {
      expect(byId[id].mortality, id).toBe(mortality);
      expect(byId[id].mortalityYear, id).toBe(year);
      if (source) expect(byId[id].mortalitySource, id).toBe(source);
    }
    expect(byId['rotavirus'].mortality).toBe(128500);
    expect(byId['colon-cancer'].label).toBe('Colorectal Cancer');
  });
  it('every cancer carries the GLOBOCAN 2022 attribution its value came from', () => {
    // The reviewer-found defect: 17 cancers held GLOBOCAN 2022 figures while
    // citing WHO GHE 2021. Every value was re-checked against the GLOBOCAN
    // 2022 world fact sheet before relabelling. Three carry a parenthetical
    // naming the broader construct IARC publishes (colorectum, non-Hodgkin
    // lymphoma, brain and CNS), so the attribution is matched, not equalled.
    const cancers = diseases.filter(d => d.category === 'cancer');
    expect(cancers.length).toBe(19);
    for (const d of cancers) {
      expect(d.mortalitySource, d.id).toMatch(/^IARC GLOBOCAN 2022/);
      expect(d.mortalityYear, d.id).toBe(2022);
    }
  });
  it('every disease carries a mortality source, and a year wherever a year exists', () => {
    // A figure that describes no particular year must not borrow one. The only
    // rows without a year are audit-flagged rows where no authority publishes a
    // global estimate at all, so there is no reference year to state.
    const yearless = [];
    for (const d of diseases) {
      expect(d.mortalitySource, d.id).toBeTruthy();
      if (d.mortalityYear) continue;
      yearless.push(d.id);
      expect(audit[d.id].action, d.id).toBe('flag');
      expect(isNoGlobalEstimate(d.mortalitySource), d.id).toBe(true);
    }
    expect(yearless.sort()).toEqual([
      'buruli-ulcer', 'deep-vein-thrombosis', 'huntingtons-disease', 'mycetoma',
      'prion-disease', 'pulmonary-embolism', 'traumatic-brain-injury',
      'wilsons-disease', 'yaws', 'zika',
    ]);
  });

  it('no audit-flagged row claims an authority that publishes nothing for it', () => {
    // The defect class the audit was run to kill: 30 rows cited "WHO GHE 2021"
    // for a cause line the GHE workbook does not contain. Their source strings
    // now say so, and the sidebar reads "no global estimate" off that wording.
    const flagged = Object.entries(audit).filter(([, m]) => m.action === 'flag').map(([id]) => id);
    expect(flagged.length).toBe(30);
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    for (const id of flagged) {
      expect(byId[id].mortalitySource, id).not.toMatch(/^WHO Global Health Estimates/);
      expect(byId[id].mortalitySource, id).not.toMatch(/^IHME GBD/);
      expect(isNoGlobalEstimate(byId[id].mortalitySource), id).toBe(true);
    }
  });
  it('yearlyPapers is backfilled to 1990 for every disease', () => {
    for (const d of diseases) {
      expect(d.yearlyPapers.length, d.id).toBe(35);
      expect(d.yearStart, d.id).toBe(1990);
    }
  });
  it('covid-19 pre-2019 paper counts are noise-level (sanity gate on the backfill)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const preOnset = byId['covid-19'].yearlyPapers.slice(0, 29); // 1990-2018
    const sum = preOnset.reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThan(400);
  });
  it('hiv-aids shows the 1990s surge (Time Machine second act)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const nineties = byId['hiv-aids'].yearlyPapers.slice(0, 10); // 1990-1999
    const max = Math.max(...nineties);
    // Brief's original threshold was 2x; real data surges 1.86x-1.94x depending
    // on which 90s year is used as the peak. Plan author approved loosening
    // to >= 1.8x so the invariant reflects verified data instead of a guess.
    expect(max).toBeGreaterThanOrEqual(nineties[0] * 1.8);
  });
  it('rheumatic-heart-disease stays flat across the full 1990-2024 span (Time Machine finale)', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    const max = Math.max(...byId['rheumatic-heart-disease'].yearlyPapers);
    expect(max).toBeLessThan(600);
  });
});
