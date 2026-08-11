// Ignite + ember weights: which nodes burn when the galaxy re-sorts itself by
// who actually dies, and which keep a standing scar after the fire cools.
//
// Two components, both runtime-derived from data/diseases.json, never hand-picked:
//
//   1. Neglect intensity — deaths per paper (mortality / papers), normalized to
//      the worst case. This is what makes sepsis the hero: 11,000,000 deaths
//      against 248,989 papers is the highest toll-per-unit-of-attention in the
//      file, so sepsis alone reaches 1.0 and the white-hot core.
//   2. Structural divergence — how far a disease's mortality rank outruns its
//      papers rank, (paperRank - mortRank) / n, normalized so the biggest
//      diverger reads 1. This is the direction doc's "mortality rank far exceeds
//      papers rank" and it is what keeps Heart Disease dark: rank 0 in papers and
//      rank 1 in deaths is an honest anchor, not a gap.
//
// Divergence alone (the shape first drafted for this task) cannot satisfy the
// spec: it ranks sepsis 7th (norovirus wins on rank gap alone), and no monotone
// mortality weighting fixes that without also dropping rheumatic heart disease
// well under its required 0.6 — sepsis needs COPD suppressed 2.4x, which
// suppresses RHD (34x less mortality) far harder. So divergence modulates
// intensity rather than driving it: intensity says how hot, divergence says
// whether the heat is a story about neglect at all.
//
// Ember is a separate, deliberately blunt statement: the bottom decile of
// papers-per-death among diseases with a recorded toll. Diseases with mortality
// recorded as 0 are excluded from both (a modeling boundary in WHO GHE, not a
// claim that no one dies).

// How much of the burn survives when a node has zero rank divergence.
// Above 0 so that pure toll-per-paper still reads; low enough that giants
// which are giants in both worlds stay dark.
const RANK_FLOOR = 0.5;
// Gamma on the final normalized burn. 0.75 lifts the mid-field into visible
// smolder while keeping the honest anchors (heart disease) under a quarter.
const GAMMA = 0.75;
const EMBER_DECILE = 0.1;

/**
 * @param {Array<{papers:number, mortality:number}>} diseases
 * @returns {{ignite: Float32Array, ember: Float32Array}} ignite 0..1 (1 = sepsis,
 *   the white-hot core), ember 1 for the overlooked decile else 0.
 */
export function igniteWeights(diseases) {
  const n = diseases.length;
  const ignite = new Float32Array(n);
  const ember = new Float32Array(n);
  if (n === 0) return { ignite, ember };

  const order = [...diseases.keys()];
  const paperRank = new Int32Array(n);
  const mortRank = new Int32Array(n);
  [...order].sort((a, b) => diseases[b].papers - diseases[a].papers)
    .forEach((di, r) => { paperRank[di] = r; });
  [...order].sort((a, b) => diseases[b].mortality - diseases[a].mortality)
    .forEach((di, r) => { mortRank[di] = r; });

  // Pass 1: normalizers over the diseases that carry a recorded toll.
  let maxNeglect = 0;
  let maxDiv = 0;
  for (let i = 0; i < n; i++) {
    const d = diseases[i];
    if (!(d.mortality > 0) || !(d.papers > 0)) continue;
    const neglect = d.mortality / d.papers;
    if (neglect > maxNeglect) maxNeglect = neglect;
    const div = (paperRank[i] - mortRank[i]) / n;
    if (div > maxDiv) maxDiv = div;
  }

  // Pass 2: raw burn = intensity modulated by divergence.
  const raw = new Float64Array(n);
  let maxRaw = 0;
  for (let i = 0; i < n; i++) {
    const d = diseases[i];
    if (!(d.mortality > 0) || !(d.papers > 0)) continue;
    const intensity = maxNeglect > 0 ? (d.mortality / d.papers) / maxNeglect : 0;
    const div = maxDiv > 0
      ? Math.min(Math.max((paperRank[i] - mortRank[i]) / n, 0) / maxDiv, 1)
      : 0;
    raw[i] = intensity * (RANK_FLOOR + (1 - RANK_FLOOR) * div);
    if (raw[i] > maxRaw) maxRaw = raw[i];
  }

  if (maxRaw > 0) {
    for (let i = 0; i < n; i++) {
      if (raw[i] > 0) ignite[i] = Math.pow(raw[i] / maxRaw, GAMMA);
    }
  }

  // Ember: bottom decile of papers per death, among diseases with a toll.
  const tolled = order.filter(i => diseases[i].mortality > 0 && diseases[i].papers > 0);
  tolled.sort((a, b) =>
    diseases[a].papers / diseases[a].mortality - diseases[b].papers / diseases[b].mortality);
  const k = Math.ceil(EMBER_DECILE * tolled.length);
  for (let j = 0; j < k && j < tolled.length; j++) ember[tolled[j]] = 1;

  return { ignite, ember };
}

export default igniteWeights;
