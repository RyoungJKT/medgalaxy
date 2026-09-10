import { mortalitySourceLabel, isNoGlobalEstimate } from './mortalityLabel';

export const PUBMED_LINE = 'PubMed, refreshed weekly';

// The 9 px provenance micro-line under a story caption (Task 3, 2026-09-10
// plan): once a story owns the frame the sidebar is gone, so the caption has
// to carry its own sourcing. `kind` says which figure the caption prints.
//   'papers'  a PubMed count
//   'deaths'  a mortality figure: the row's own short source label
//   'ratio'   papers per death: both, joined with a middle dot
//   'none'    a moral line with no figure
// A row whose source says no global estimate exists never gets a mortality
// source line, the same rule the compare card and the sidebar follow.
export function storyProvenance(kind, d) {
  if (!d || kind === 'none') return '';
  const deaths = isNoGlobalEstimate(d.mortalitySource)
    ? ''
    : (mortalitySourceLabel(d.mortalitySource, d.mortalityYear) || '');
  if (kind === 'papers') return PUBMED_LINE;
  if (kind === 'deaths') return deaths;
  if (kind === 'ratio') return deaths ? `${PUBMED_LINE} · ${deaths}` : PUBMED_LINE;
  return '';
}
