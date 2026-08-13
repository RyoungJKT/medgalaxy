import React, { useCallback, useEffect, useMemo } from 'react';
import useStore from '../../store';
import { sceneRefs } from '../../sceneRefs';
import { isMob, fmt } from '../../utils/helpers';
import { fmtFull } from '../../utils/captions';
import { MAX_PAPERS, MAX_MORT, MX } from '../../utils/constants';
import { isNoGlobalEstimate } from '../../utils/mortalityLabel';
import {
  buildTimeMachineData, KNEE_PCT, KNEE_SHARE, BULK_EXP, MXY, MIN_RY,
} from '../../utils/timeMachineData';
import meta from '../../../data/meta.json';

const SH = { fontSize: 11, color: '#3399ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 };
const SP = { color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 10 };

// Pure and exported so it can be unit-tested without rendering: every disease
// whose mortality figure is not sourced from the shared default (WHO Global
// Health Estimates 2021, per data/meta.json's mortalityDefaultSource).
export function nonDefaultMortalitySources(diseases, defaultSource) {
  if (!diseases) return [];
  return diseases
    .filter(d => d.mortalitySource && d.mortalitySource !== defaultSource)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ─── "Time Machine size mapping" (ADDENDUM 1 section 2.1, honesty line 4) ────
// The per-year curve is shaped for legibility past the area-proportional
// convention the cumulative view follows, so it has to be described where every
// other mapping is described. This panel was truthful by omission before; it is
// no longer allowed to be, and that disclosure is the price of the extra drama.
//
// Pure and exported for the same reason nonDefaultMortalitySources above is:
// the assertion that every numeral here is read from the built table rather than
// transcribed is a unit test, not a promise. Feed it a different table and every
// figure in the sentence moves.
export function timeMachineMapping(data) {
  if (!data) return null;
  const kneed = data.knee > 0 && data.knee < data.maxYearly;
  return {
    file: 'src/utils/timeMachineData.js',
    kneePct: KNEE_PCT,
    knee: data.knee,
    // Round-5 gate, depth: the subsection said "proportional" where the mapping
    // is affine (MIN_RY + f * (MXY - MIN_RY)), and the omitted floor is not
    // cosmetic — it compresses small-count growth ratios, so leaving it out
    // erred anti-drama in prose while the curve erred anti-drama in fact. Read
    // from the module rather than written, like every other figure here.
    floor: MIN_RY,
    sharePct: Math.round(KNEE_SHARE * 100),
    exponent: BULK_EXP,
    ceiling: MXY,
    maxYearly: data.maxYearly,
    kneed,
    text:
      `The Time Machine sizes each node by that one year's paper count instead, on its own curve `
      + `(${'src/utils/timeMachineData.js'}). The knee is the ${KNEE_PCT}th percentile of every `
      + `disease-year count in the table, ${fmtFull(data.knee)} papers, computed when the table is `
      + `built rather than written in. Below it radius is a ${MIN_RY} floor plus a term proportional to `
      + `the count, exponent ${BULK_EXP.toFixed(2)}, and that segment owns ${Math.round(KNEE_SHARE * 100)} percent of the `
      + `size range; above it the curve runs straight to the single biggest year on record, `
      + `${fmtFull(data.maxYearly)} papers, at the ceiling of ${MXY} units. That ceiling is under half `
      + `the ${MX} the cumulative curve above reaches, so one year is never bigger than the whole record.`,
  };
}

export default function MethodologyPanel() {
  const methodologyOpen = useStore(s => s.methodologyOpen);
  const setMethodologyOpen = useStore(s => s.setMethodologyOpen);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const mob = isMob();

  const close = useCallback(() => setMethodologyOpen(false), [setMethodologyOpen]);

  // Own Escape handling (capture phase, and stopPropagation) so this closes
  // the panel without also tripping App.jsx's global Escape cascade, which
  // has no notion of methodologyOpen and isn't in this task's file set.
  useEffect(() => {
    if (!methodologyOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [methodologyOpen, close]);

  const stats = useMemo(() => {
    if (!diseases.length) return null;
    const yearStart = Math.min(...diseases.map(d => d.yearStart));
    const yearEnd = Math.max(...diseases.map(d => d.yearStart + d.yearlyPapers.length - 1));
    const nonDefault = nonDefaultMortalitySources(diseases, meta.mortalityDefaultSource);
    return {
      diseaseCount: diseases.length,
      connectionCount: displayEdges.length,
      yearStart,
      yearEnd,
      yearSpan: yearEnd - yearStart + 1,
      nonDefault,
      defaultCount: diseases.length - nonDefault.length,
      // Derived, never a literal: the prose below must not be able to claim a
      // count the exceptions table then contradicts.
      // Anchored so the four buckets the paragraph below counts stay disjoint:
      // one row cites GLOBOCAN inside a no-estimate explanation (HPV) and must
      // not be counted twice.
      globocanCount: diseases.filter(d => /^IARC GLOBOCAN/.test(d.mortalitySource || '')).length,
      gheCount: diseases.filter(d => /^WHO Global Health Estimates/.test(d.mortalitySource || '')).length,
      gbdCount: diseases.filter(d => /^IHME/.test(d.mortalitySource || '')).length,
      noEstimateCount: diseases.filter(d => isNoGlobalEstimate(d.mortalitySource)).length,
    };
  }, [diseases, displayEdges]);

  // The live table if the Time Machine has been mounted (it builds one on mount
  // and publishes it), else built here. Either way the numerals below are the
  // ones the instrument is actually using.
  const tmMap = useMemo(() => {
    if (!methodologyOpen || !diseases.length) return null;
    const live = sceneRefs.tm && sceneRefs.tm.data;
    return timeMachineMapping(live || buildTimeMachineData(diseases));
  }, [methodologyOpen, diseases]);

  if (!methodologyOpen || !stats) return null;

  return (
    <div
      onClick={close}
      role="presentation"
      style={{
        position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        fontFamily: 'IBM Plex Mono,monospace', opacity: 0, animation: 'fadeIn 0.3s ease forwards',
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Methodology"
        style={{
          background: 'rgba(10,16,30,0.94)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          width: mob ? '92vw' : 640, maxWidth: '92vw', maxHeight: '85vh',
          overflowY: 'auto', overflowX: 'hidden', position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', color: '#e2e8f0',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, zIndex: 1, background: 'rgba(10,16,30,0.97)',
          backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: mob ? '16px 18px 12px' : '20px 24px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: mob ? 15 : 18, fontWeight: 600, color: '#e2e8f0' }}>Methodology</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>How every number in this galaxy is produced, and where it comes from</div>
          </div>
          <button onClick={close} aria-label="Close methodology" style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1,
            padding: '4px 8px', fontFamily: 'inherit', flexShrink: 0, marginLeft: 12,
          }}>&#x2715; Close</button>
        </div>

        <div style={{ padding: mob ? '16px 18px 22px' : '18px 24px 26px' }}>

          {/* 1. What the numbers are */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>What the numbers are</div>
            <div style={SP}>
              Papers is PubMed's own all-time result count for the disease's search term: a single E-utilities esearch query with no date filter, which is everything PubMed has indexed under that term, not a sum over a window. The sparkline beneath it in the sidebar is a separate series, one dated query per year (datetype=pdat, per-year mindate and maxdate) across the {stats.yearSpan} years {stats.yearStart} to {stats.yearEnd}. The search term is each disease's name; a handful of diseases use a more precise override for accurate matching, documented in data/search-overrides.json (COPD queries the full phrase "chronic obstructive pulmonary disease", NAFLD adds an alternate spelling, and several acronyms expand the same way). Every disease's sidebar carries a live "View on PubMed" link, so any total shown here can be checked directly against PubMed's own search; the 11 diseases queried under an expanded clinical name use that same expansion in their sidebar link, not the shorter display label, so the link always reproduces the total shown.
            </div>
            <div style={SP}>
              The all-time total and the year-by-year series are different queries, so they are not required to agree. For six diseases the series sums slightly above the all-time total, because PubMed counts a record in every year its publication dates name, and a record carrying both an electronic and a print date names two. The sidebar prints a note under the sparkline on exactly those diseases rather than leaving the arithmetic to be discovered.
            </div>
            <div style={SP}>
              Deaths do not come from PubMed at all. They are entered by hand, and every one of the {stats.diseaseCount} figures has been checked against the document it cites, one row at a time. {stats.gheCount} sit on WHO's Global Health Estimates 2021 ({stats.defaultCount} on the estimate itself, which is why the line under this paragraph counts {stats.defaultCount}; the other {stats.gheCount - stats.defaultCount} cite a specific GHE cause line and are listed by name in the table below), {stats.globocanCount} cancers on IARC GLOBOCAN 2022, {stats.gbdCount} on IHME's Global Burden of Disease where WHO's cause list carries no line for them, {stats.diseaseCount - stats.gheCount - stats.globocanCount - stats.gbdCount - stats.noEstimateCount} on a programme report, fact sheet or single modelling study, and {stats.noEstimateCount} on no global estimate at all, for the reason given below. Every count in this paragraph is computed from the data file when this panel opens, not written in by hand, so it cannot drift away from the table below it. The vintages are deliberately mixed, not uniform: malaria, tuberculosis, HIV/AIDS, measles and hepatitis use their own most current annual reports, and WHO Global Health Estimates 2021 is still the latest GHE vintage as of this edition. The sidebar repeats the source in short form next to every deaths figure, so the attribution travels with the number.
            </div>
            <div style={SP}>
              For {stats.noEstimateCount} of the {stats.diseaseCount} diseases no authority publishes a global death estimate at all: WHO's cause list and IHME's cause hierarchy have no line for them, because their deaths are coded to an underlying disease or an external cause. Those rows display the modeling boundary and say so, in the source column below and on the sidebar tile itself, rather than borrowing a citation that would imply a figure nobody has published.
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 8 }}>
              Most-used single source, {stats.defaultCount} of {stats.diseaseCount} diseases: {meta.mortalityDefaultSource}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
              The other {stats.nonDefault.length}, row by row (year "none" means the row describes no reference year):
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '6px 10px', fontWeight: 500, position: 'sticky', top: 0, background: 'rgba(10,16,30,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Disease</th>
                    <th style={{ padding: '6px 10px', fontWeight: 500, position: 'sticky', top: 0, background: 'rgba(10,16,30,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Year</th>
                    <th style={{ padding: '6px 10px', fontWeight: 500, position: 'sticky', top: 0, background: 'rgba(10,16,30,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.nonDefault.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 10px', color: '#e2e8f0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{d.label}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{d.mortalityYear ?? 'none'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{d.mortalitySource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Known caveats, stated plainly */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>Known caveats, stated plainly</div>
            <div style={SP}>
              Sepsis's mortality figure counts sepsis-associated deaths: deaths where sepsis contributed alongside an underlying cause such as pneumonia, cancer, or ischaemic heart disease. It is not an independent cause on top of the others; adding mortality rows together into a single total would double-count it.
            </div>
            <div style={SP}>
              Sickle cell disease's figure is the same kind of count, and for the same reason it needs saying: it is IHME's total sickle cell mortality burden, deaths where sickle cell disease was the underlying cause plus deaths where it contributed to another one (Lancet Haematology 2023). Estimates that count only underlying-cause deaths land roughly an order of magnitude lower. Like sepsis, it is not an independent cause to be added on top of the rows around it.
            </div>
            <div style={SP}>
              Pneumonia uses IHME's lower respiratory infections category, which also includes influenza, RSV, and bronchiolitis deaths, not narrowly bacterial pneumonia, and which excludes COVID-19 deaths by construction. Rotavirus and norovirus are both subsets of overall diarrhoeal disease deaths, not separate causes; neither should be summed with the other or treated as the full diarrhoeal burden.
            </div>
            <div style={SP}>
              Two cancer rows are broader than their labels, because that is how IARC reports them: lymphoma carries non-Hodgkin lymphoma only, with Hodgkin lymphoma counted separately by IARC and not added in, and brain cancer carries the brain and central nervous system category. A third was renamed instead of relabelled: the colon row held GLOBOCAN's colorectum total, so it is now called colorectal cancer, the construct that figure actually describes, rectum and anus included.
            </div>
            <div style={SP}>
              Heart disease reports ischaemic heart disease specifically (heart attacks and related coronary disease), not all cardiovascular disease, which WHO estimates at roughly 19 to 20 million deaths a year. Alzheimer's disease includes Alzheimer's and other dementias combined, per WHO and IHME reporting, not Alzheimer's alone. Type 2 diabetes shows all diabetes direct deaths, type 1 and type 2 together as WHO reports it, and excludes diabetes-attributed kidney deaths, which WHO estimates separately at roughly half a million more.
            </div>
            <div style={SP}>
              COVID-19 and Ebola are both labeled with a single year rather than an ongoing annual rate. COVID-19 shows a recent reported-deaths figure (year noted in the table above); the pandemic year 2021 alone recorded far more under WHO's broader estimate, 8.8 million, the second leading cause of death that year, and global reporting has since largely ceased. Ebola is episodic outbreak data: zero in quiet years, thousands during an epidemic. The figure shown is the running toll of the 2026 Bundibugyo epidemic, which was still ongoing when this edition was built, not a steady annual rate; the whole of 2025 recorded 49 deaths.
            </div>
          </div>

          {/* 3. Connections */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>Connections</div>
            <div style={SP}>
              A connection's shared-papers count is a measurement, not an estimate: for every pair, PubMed's own all-time result count for the two disease terms searched together, one esearch query per pair, run by scripts/regenerate_connections.py using the same terms, endpoint and rate limit as the publication pipeline. Anyone can reproduce any weight in the galaxy by running that one query. What is curated is which pairs exist: the {stats.connectionCount} pairs were chosen by hand as clinically or biologically plausible links, not swept exhaustively across all {stats.diseaseCount} diseases, so a missing edge means nobody drew it, not that the two topics never co-occur.
            </div>
            <div style={SP}>
              Each pair's score is that shared-papers count divided by the square root of the product of both diseases' total papers (processData, src/utils/helpers.js). Raw counts would be dominated by huge topics like heart disease appearing in nearly every list; dividing by the geometric mean of both totals surfaces pairs that are unusually connected to each other specifically, not just individually popular.
            </div>
            <div style={SP}>
              Each node's top 7 highest-scoring edges feed the 3D layout, the force simulation that clusters diseases spatially. All {stats.connectionCount} scored connections are drawn in the galaxy, but only those top-7-per-node edges are part of the layout; the rest render faint in the background and brighten on hover or selection.
            </div>
          </div>

          {/* 4. The pipeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>The pipeline</div>
            <div style={SP}>
              A GitHub Action re-runs the PubMed query above every Monday at 06:00 UTC (.github/workflows/refresh-pubmed.yml, calling scripts/refresh_pubmed.py). It rewrites exactly three fields per disease: total papers, the year-by-year counts, and the trend percentage. It never touches mortality, description, category, or funding gap; those stay fixed until someone updates them by hand from the sources named above. The connection weights are refreshed by their own script (scripts/regenerate_connections.py), run on demand rather than weekly, because it is one query per pair.
            </div>
            <div style={SP}>
              The {stats.yearSpan}-year publication history was backfilled once, extending each disease's record back to {stats.yearStart}. The weekly refresh rewrites a fixed 2015-2024 window, not a rolling one: earlier years are frozen history, and the window itself advances only when the pipeline is updated.
            </div>
          </div>

          {/* 5. Size mapping */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>Size mapping</div>
            <div style={SP}>
              Node size follows a power law: floor, plus the square root of value divided by ceiling, times the range between floor and max size, computed from whichever value the Papers or Mortality toggle currently selects (src/utils/helpers.js, src/utils/constants.js). The square-root exponent compresses the range so a disease with over a million papers doesn't dwarf the display next to one with a few hundred.
            </div>
            <div style={SP}>
              The ceiling for each mode is set close to this edition's real maximum, about {fmt(MAX_PAPERS)} papers or {fmt(MAX_MORT)} deaths, not a shrunk-down cap. The single largest node in each mode is sized by its actual value, unclamped at the top as of this edition.
            </div>
          </div>

          {/* 5b. The Time Machine's own curve */}
          {tmMap && (
            <div style={{ marginBottom: 20 }}>
              <div style={SH}>Time Machine size mapping</div>
              <div style={SP}>{tmMap.text}</div>
              <div style={SP}>
                The two curves answer different questions, which is why they are different curves: the cumulative view compares diseases to each other, and the Time Machine tracks one disease through time. Both are monotone in their own value, so a bigger count is always a bigger node in either, and every figure in the paragraph above is read from the built table when this panel opens rather than written in by hand.
              </div>
            </div>
          )}

          {/* 6. Sound */}
          <div>
            <div style={SH}>Sound</div>
            <div style={SP}>
              All audio is synthesized in the browser at runtime; no recordings are used.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
