import overrides from '../../data/search-overrides.json';

/**
 * The exact PubMed search term used for a disease's totals, mirroring
 * scripts/refresh_pubmed.py's get_search_term(): the override term when the
 * disease id has one in data/search-overrides.json, else the disease label
 * with any parenthetical suffix stripped (e.g. "Sleeping Sickness (African
 * Trypanosomiasis)" -> "Sleeping Sickness").
 *
 * Sidebar.jsx uses this to build the "View on PubMed" link, so the query the
 * weekly pipeline runs and the link the viewer clicks are always the same
 * term.
 */
export function pubmedTermFor(id, label) {
  if (id && overrides[id]) return overrides[id];
  if (!label) return '';
  const idx = label.indexOf('(');
  return idx === -1 ? label : label.slice(0, idx).trim();
}
