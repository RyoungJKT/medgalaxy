/**
 * Compact point-of-display sourcing for the sidebar's deaths stat.
 *
 * The methodology panel carries the full source string and the year each
 * figure describes; this produces the short form that fits the sidebar's
 * 11px label row, so a viewer never reads a deaths number without knowing
 * which body produced it and which year it describes. The year shown is
 * always mortalityYear, the year the figure describes, not the year its
 * report was published (WHO's World Malaria Report 2025 reports 2024).
 *
 * Two cases the full audit added:
 *  - Rows where no authority publishes a global death estimate. Their source
 *    string says so in full; the tile says "no global estimate" and says it
 *    whether the stored value is 0 or a region-only number, because that is
 *    the honest caption for both.
 *  - Rows with no year at all. A figure that describes no particular year
 *    must not borrow one, so the short form simply drops it.
 *
 * Pure and exported so tests can hold it against every record in
 * data/diseases.json without rendering the sidebar.
 */

// A source string in this class states that no global figure exists (or that
// the row is a modeling boundary). Matched on the source's own wording, so the
// data file stays the single place the truth is written down.
const NO_ESTIMATE = [
  /^No\b/i,
  /^Not a cause/i,
  /^Modeling boundary/i,
  /^Share of combined/i,
  /^US-only vital statistics/i,
  /no (WHO|GHE|GBD|IHME|global)[^.;]*cause line/i,
];

// [matcher, prefix, suffix] -> `${prefix} ${year}${suffix}`, year omitted when
// the row has none. Ordered: named sources first, so a source that names a body
// and then adds "no global estimate exists" (West Nile) keeps its attribution.
const RULES = [
  [/^WHO Global Health Estimates/, 'GHE', ''],
  [/^IARC GLOBOCAN/, 'GLOBOCAN', ''],
  [/^IHME GBD 2021 \(lower respiratory/, 'GBD', ', all LRI'],
  [/^IHME GBD 2021 \(Alzheimer/, 'GBD', ', with dementias'],
  [/^IHME (GBD|Global Burden of Disease)/, 'GBD', ''],
  [/^WHO World Malaria Report/, 'WMR', ''],
  [/^WHO Global Tuberculosis Report/, 'GTB', ''],
  [/^WHO Global Hepatitis Report/, 'WHO hepatitis', ''],
  [/^WHO measles estimates/, 'WHO measles', ''],
  [/^WHO COVID-19 dashboard/, 'WHO reported', ''],
  [/^WHO situation reports/, 'WHO outbreak reports', ''],
  [/^WHO\/ECDC/, 'reported, WHO/ECDC', ''],
  [/^WHO\/Carter Center/, 'WHO surveillance', ''],
  // Only when the fact sheet is the source itself. Cholera and influenza cite a
  // study and mention a fact-sheet range afterwards; those stay with the study.
  [/^WHO [^,;:]*fact sheet/i, 'WHO fact sheet', ''],
  [/^UNAIDS/, 'UNAIDS', ''],
  [/^CDC,/, 'US only, CDC', ''],
  [/^Rudd et al/, 'GBD', ', sepsis-associated'],
  [/^Naghavi et al/, 'GRAM/GBD', ''],
  [/^GBD\/Troeger/, 'GBD', ', under-5'],
  [/^Risk factor, not a cause/, 'risk factor, not a cause', ''],
  [/^Boundary to avoid double-counting/, 'counted under cancer rows', ''],
];

// Costa et al. 2015, Ali et al. 2015, Paget et al. 2019, Lopman et al. 2016:
// single-study modelled estimates, named by their first author.
const AUTHOR = /^([A-Z][A-Za-z'-]+) et al/;

// A named source wins over the no-estimate wording: WHO's typhoid fact sheet
// publishes 110,000 deaths and then notes typhoid has no GHE cause line, and
// the reader of that row should see the fact sheet, not "no global estimate".
function classify(mortalitySource, mortalityYear) {
  if (!mortalitySource) return null;
  const y = mortalityYear ? ` ${mortalityYear}` : '';

  for (const [re, prefix, suffix] of RULES) {
    if (re.test(mortalitySource)) return { named: true, short: `${prefix}${y}${suffix}` };
  }
  const author = mortalitySource.match(AUTHOR);
  if (author) return { named: true, short: `modelled, ${author[1]}${y}` };

  if (NO_ESTIMATE.some(re => re.test(mortalitySource))) {
    return { named: false, short: 'no global estimate' };
  }
  // Fallback: first clause of the source string, plus the year it describes.
  const head = mortalitySource.split(/[,;(:]/)[0].trim();
  return { named: true, short: `${head}${y}` };
}

export function isNoGlobalEstimate(mortalitySource) {
  const c = classify(mortalitySource, null);
  return !!c && !c.named;
}

export function mortalitySourceLabel(mortalitySource, mortalityYear) {
  const c = classify(mortalitySource, mortalityYear);
  return c ? c.short : null;
}

export function deathsStatLabel(mortality, mortalitySource, mortalityYear) {
  const c = classify(mortalitySource, mortalityYear);
  if (!c) return 'Deaths/yr';
  // The no-estimate caption is the point of those rows, so it shows even where
  // the stored value is 0 and the tile prints N/A beside it.
  if (!c.named) return `Deaths/yr · ${c.short}`;
  if (!(mortality > 0)) return 'Deaths/yr';
  return `Deaths/yr · ${c.short}`;
}
