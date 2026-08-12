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
 * Pure and exported so tests can hold it against every record in
 * data/diseases.json without rendering the sidebar.
 */

const RULES = [
  [/^WHO Global Health Estimates/, y => `GHE ${y}`],
  [/^IARC GLOBOCAN/, y => `GLOBOCAN ${y}`],
  [/^IHME GBD 2021 \(lower respiratory/, y => `GBD ${y}, all LRI`],
  [/^IHME GBD 2021 \(Alzheimer/, y => `GBD ${y}, with dementias`],
  [/^IHME GBD/, y => `GBD ${y}`],
  [/^WHO World Malaria Report/, y => `WMR ${y}`],
  [/^WHO Global Tuberculosis Report/, y => `GTB ${y}`],
  [/^WHO Global Hepatitis Report/, y => `WHO hepatitis ${y}`],
  [/^WHO measles estimates/, y => `WHO measles ${y}`],
  [/^WHO COVID-19 dashboard/, y => `WHO reported ${y}`],
  [/^WHO\/CDC outbreak records/, y => `outbreak records ${y}`],
  [/^UNAIDS/, y => `UNAIDS ${y}`],
  [/^CDC,/, y => `US only, CDC ${y}`],
  [/^Rudd et al/, y => `GBD ${y}, sepsis-associated`],
  [/^GBD\/Troeger/, y => `GBD ${y}, under-5`],
  [/^Lopman et al/, y => `modelled, Lopman ${y}`],
];

export function mortalitySourceLabel(mortalitySource, mortalityYear) {
  if (!mortalitySource || !mortalityYear) return null;
  for (const [re, fmt] of RULES) {
    if (re.test(mortalitySource)) return fmt(mortalityYear);
  }
  // Fallback: first clause of the source string, plus the year it describes.
  const head = mortalitySource.split(/[,;(]/)[0].trim();
  return `${head} ${mortalityYear}`;
}

export function deathsStatLabel(mortality, mortalitySource, mortalityYear) {
  if (!(mortality > 0)) return 'Deaths/yr';
  const short = mortalitySourceLabel(mortalitySource, mortalityYear);
  return short ? `Deaths/yr · ${short}` : 'Deaths/yr';
}
