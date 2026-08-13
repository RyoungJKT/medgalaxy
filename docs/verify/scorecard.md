# MedGalaxy Next Showcase: Review Gate Scorecard

**Verdict: CERTIFIED at 9.26 / 10** (ship bar: 9.0; client target: 10). Round 6 final, 2026-08-13, branch `next/showcase`. First 30 seconds 9.4, story clarity 9.4, expert data depth 9.3, visual + motion craft 9.2, performance 9.0. Arc: shipped round 4 at 9.06; direction addendum 1 ("From 9 to 10") answered the client's four notes with the comet-stream assembly fly-in, the cinematic Time Machine staircase tour (year-scaling, ghost shells, designed pauses at the 1996 HIV surge, 2019 fade, 2020 detonation, 2021 peak, and the rheumatic-heart-disease finale), an ending that returns all the way home with a velocity-matched exit and a real handover affordance on both form factors, and the ambient motion layer (camera breathing, star parallax shells, edge shimmer), growing the suite from 166 to 316 tests plus a structural fuzz harness. Two further gate rounds hardened it 9.06 to 9.16 to 9.26. The round-6 errata (mobile ending chip tap dead zone) and the scrubber drag-selection bug were both fixed and verified post-certification (commits 33c47d9, 36b01e4). Everything else remaining is taste-level; certification is frozen at 9.26 and further gate rounds are declared diminishing returns.

---

## Round 4 record (superseded)

**Verdict: SHIP at 9.06 / 10** (ship bar: 9.0). Round 4 final, 2026-08-12, branch `next/showcase`.

| Dimension | Score | Basis |
|---|---:|---|
| First 30 seconds | 9.0 | Full natural runs (desktop + mobile), skip paths adversarially attacked three ways, zero console errors, thesis lands ~11.7s after the click |
| Expert data depth | 8.8 | All 153 mortality (value, year, source) triples match the audit manifest (0 mismatches, invariant-guarded); 41 adversarially sampled figures checked against primary documents (WHO GHE 2021 workbook, WHO outbreak reports current to 11 Aug 2026, GLOBOCAN 2022, GBD 2021, UNAIDS 2025): 40 of 41 exact at display precision; all 30 "no global estimate" rows render honestly |
| Visual + motion craft | 9.5 | Round-3 label pile-up measured dead (0 overlapping label pairs at rest / tour / mobile vs 20 before); per-year Time Machine label ranking confirmed live at 1996 and 2021; bloom discipline pixel-proven (zero bloom at rest, exactly one cluster at the hero hold) |
| Performance | 9.0 | All FPS gates green headless + headed on-compositor (desktop and 375px mobile incl. a Time Machine travel leg); cold load: branded shell paints 633-643ms on Fast 3G + 4x CPU (was ~5s blank), first galaxy frame 1.95s post-click |
| Story clarity | 9.0 | Every on-screen numeral cross-checked against live store data mid-run; hands-off one-sentence retell test passed |

The product: a cinematic Three.js galaxy of 153 diseases where node size tracks PubMed research volume or annual deaths, opened by a ~20-second film about the gap between research attention and mortality ("The Gap"), with a 1990-2024 Time Machine (auto-tour + analog scrubber), per-disease evidence sidebars with per-disease source labels, a methodology panel whose counts derive live from the data file, opt-in synthesized sound, full mobile and reduced-motion support, and a 166-test suite that locks every mortality triple to `data/mortality-audit.json`.

Process: 20 plan tasks, each implemented by a fresh subagent and gated by an adversarial spec+quality review; 4 review-gate rounds (12 reviewer passes) with two fix waves, a full 153-row primary-source mortality audit by five parallel PhD-level auditors, and regeneration of all 736 disease connections from live PubMed co-occurrence queries.

Post-ship punch list (items 1-4 CLOSED in c7b1a93: COVID 2023 export refresh to 318,570, per-disease tooltip wording, "colon" search alias, chagas year semantics). Remaining non-blocking: sickle cell caveat paragraph in methodology; one clause on the 23-vs-17 GHE duality; flag-class values in comparison chips; pre-existing long-label edge clipping.

Reviewer retells (verbatim):

> "I attacked this as a hostile epidemiologist — pulled WHO's own GHE 2021 workbook and COVID export, chased the 2026 Bundibugyo epidemic toll to the day, and re-derived the methodology's counts from the data file — and 40 of 41 sampled triples matched their primary documents exactly, so yes, I would cite it to colleagues."

> "Yes - it survives its five minutes: the film, tour, and every touched surface run clean end-to-end with zero console errors, the label chaos that marred round 3 is measurably gone, and every deaths figure a Harvard professor might poke now traces live to a named source."
