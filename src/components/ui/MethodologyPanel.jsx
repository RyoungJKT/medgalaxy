import React, { useCallback, useEffect, useMemo } from 'react';
import useStore from '../../store';
import { isMob, fmt } from '../../utils/helpers';
import { MAX_PAPERS, MAX_MORT } from '../../utils/constants';
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
    };
  }, [diseases, displayEdges]);

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
              Papers is PubMed's own count of publications whose publication date falls in a given year, queried through PubMed's E-utilities esearch endpoint (datetype=pdat, per-year mindate and maxdate) and summed across {stats.yearSpan} years, {stats.yearStart} to {stats.yearEnd}. The search term is each disease's name; a handful of diseases use a more precise override for accurate matching, documented in scripts/refresh_pubmed.py (COPD queries the full phrase "chronic obstructive pulmonary disease", NAFLD adds an alternate spelling, and several acronyms expand the same way). Every disease's sidebar carries a live "View on PubMed" link, so any total shown here can be checked directly against PubMed's own search.
            </div>
            <div style={SP}>
              Deaths do not come from PubMed at all. They are entered by hand from named sources: {stats.defaultCount} of {stats.diseaseCount} diseases use the shared default below, and the other {stats.nonDefault.length} use a disease-specific source, each with the year its figure describes. The vintages are deliberately mixed, not uniform: cancers use GLOBOCAN 2022, malaria and tuberculosis and HIV/AIDS use their own most current annual reports, and everything else defaults to WHO Global Health Estimates 2021, still the latest GHE vintage as of this edition.
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 8 }}>
              Default source, {stats.defaultCount} of {stats.diseaseCount} diseases: {meta.mortalityDefaultSource}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
              The {stats.nonDefault.length} exceptions:
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
                      <td style={{ padding: '6px 10px', color: '#94a3b8', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{d.mortalityYear}</td>
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
              Pneumonia uses WHO's lower respiratory infections category, which also includes influenza, RSV, and bronchiolitis deaths, not narrowly bacterial pneumonia. Rotavirus and norovirus are both subsets of overall diarrhoeal disease deaths, not separate causes; neither should be summed with the other or treated as the full diarrhoeal burden.
            </div>
            <div style={SP}>
              Heart disease reports ischaemic heart disease specifically (heart attacks and related coronary disease), not all cardiovascular disease, which WHO estimates at roughly 19 to 20 million deaths a year. Alzheimer's disease includes Alzheimer's and other dementias combined, per WHO and IHME reporting, not Alzheimer's alone. Type 2 diabetes shows all diabetes direct deaths, type 1 and type 2 together as WHO reports it, and excludes diabetes-attributed kidney deaths, which WHO estimates separately at roughly half a million more.
            </div>
            <div style={SP}>
              COVID-19 and Ebola are both labeled with a single year rather than an ongoing annual rate. COVID-19 shows a recent reported-deaths figure (year noted in the table above); the pandemic year 2021 alone recorded far more under WHO's broader estimate, 8.8 million, the second leading cause of death that year, and global reporting has since largely ceased. Ebola is episodic outbreak data: zero in quiet years, thousands during an epidemic; the figure shown is a single recent year, not a steady annual toll.
            </div>
          </div>

          {/* 3. Connections */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>Connections</div>
            <div style={SP}>
              Every pair of diseases that shares PubMed papers gets a co-occurrence score: shared papers divided by the square root of the product of both diseases' total papers (processData, src/utils/helpers.js). Raw shared-paper counts would be dominated by huge topics like heart disease appearing in nearly every list; dividing by the geometric mean of both totals surfaces pairs that are unusually connected to each other specifically, not just individually popular.
            </div>
            <div style={SP}>
              Each node's top 7 highest-scoring edges feed the 3D layout, the force simulation that clusters diseases spatially. All {stats.connectionCount} scored connections are drawn in the galaxy, but only those top-7-per-node edges are part of the layout; the rest render faint in the background and brighten on hover or selection.
            </div>
          </div>

          {/* 4. The pipeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={SH}>The pipeline</div>
            <div style={SP}>
              A GitHub Action re-runs the PubMed query above every Monday at 06:00 UTC (.github/workflows/refresh-pubmed.yml, calling scripts/refresh_pubmed.py). It rewrites exactly three fields per disease: total papers, the year-by-year counts, and the trend percentage. It never touches mortality, description, category, funding gap, or the connections file; those stay fixed until someone updates them by hand from the sources named above.
            </div>
            <div style={SP}>
              The {stats.yearSpan}-year publication history was backfilled once, extending each disease's record back to {stats.yearStart}. The weekly refresh only rewrites the most recent ten years; the backfilled decades before that stay fixed.
            </div>
          </div>

          {/* 5. Size mapping */}
          <div>
            <div style={SH}>Size mapping</div>
            <div style={SP}>
              Node size follows a power law: floor, plus the square root of value divided by ceiling, times the range between floor and max size, computed from whichever value the Papers or Mortality toggle currently selects (src/utils/helpers.js, src/utils/constants.js). The square-root exponent compresses the range so a disease with over a million papers doesn't dwarf the display next to one with a few hundred.
            </div>
            <div style={SP}>
              The ceiling for each mode is set close to this edition's real maximum, about {fmt(MAX_PAPERS)} papers or {fmt(MAX_MORT)} deaths, not a shrunk-down cap. The single largest node in each mode is sized by its actual value, unclamped at the top as of this edition.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
