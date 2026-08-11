# MedGalaxy Next: Showcase Edition

Date: 2026-08-11
Branch: `next/showcase` (worktree at `Documents/Claude/medgalaxy-next`, based on live `origin/main` @ 9b9c091)
Status: approved design, pending spec review

## Mission

Build a parallel showcase edition of MedGalaxy impressive enough that a first-time,
unguided visitor is stunned inside 30 seconds and still convinced after 10 minutes of
expert scrutiny. Target audience: Elon Musk (cinematic quality, scale, engineering
audacity, live systems) and a Harvard biology professor (data integrity, methodology,
novel analytical insight). They will open the link themselves with no walkthrough.

## Hard constraints

1. **Live site untouched.** www.medgalaxy.org and the `main` branch must remain
   byte-for-byte unchanged. All work stays on `next/showcase` in this worktree. No merge,
   no production deploy. The user will compare both versions and pick one to present.
2. **Quality gate.** An independent review agent scores the finished product on a 1 to 10
   impressiveness scale against the rubric below. Ship gate: at least 9. Iterate until met.
3. **Truthful data only.** Every number shown must be traceable to PubMed, WHO, or another
   citable source. No invented statistics, ever. Where data is a proxy (papers as a measure
   of attention), the UI says so.
4. **Graceful degradation.** The showcase must still work on a phone and on Safari. Any
   cutting-edge rendering path needs an automatic fallback.
5. House style: no em dashes in any user-facing text, no section-sign symbol.

## Build process requirements (user-mandated)

- **Cinematic director agent** owns art direction: the opening sequence, color script,
  camera language, motion curves, typography, and (opt-in) sound design. Produces a written
  direction document before implementation; implementation follows it.
- **PhD-level research agents** own the data layer: re-verify mortality and paper counts
  for all 153 diseases against current WHO GHE and PubMed, correct known errors
  (pertussis 160K to ~59K, rotavirus 200K to ~128K), verify the 153 insight cards, and
  research a funding dimension (NIH RePORTER categorical spending) to add dollars to the
  papers-versus-deaths argument if coverage proves adequate.
- **Review agent** scores against the rubric; its findings drive iteration rounds.

## The experience (in visitor order)

### 1. Cinematic opening: "The Gap"
After a rebuilt assembly intro, three beats, roughly 16 to 20 seconds total, skippable on
any input, honors `prefers-reduced-motion`:
- **Attention.** Galaxy assembled, nodes sized by research papers. Caption: "Where the
  world's attention goes."
- **The morph.** Node sizes cross-fade from papers to annual deaths. Research giants
  deflate; neglected killers swell and ignite red with HDR bloom. Caption: "But this is
  who actually dies. Sepsis kills 11 million people a year."
- **Release.** UI chrome fades in, camera hands over. Caption: "Explore the gap."
The cinematic director may restructure these beats, but the papers-to-deaths morph is the
thesis and must survive.

### 2. Headline interactive: the Time Machine
A timeline scrubber across the ~30 years of per-year publication data (already collected
and refreshed weekly). Node sizes animate year by year: HIV surges through the 90s, COVID
detonates into existence in 2020 and visibly cools, Rheumatic Heart Disease never lights
up. Auto-plays once after the opening as a short "history of attention" tour with caption
beats, then the visitor gets the scrubber. Engineering shape: precompute per-year radii,
animate scale only, no per-year layout re-simulation.

### 3. Everything the live site already does
All existing features carry over: supernova reveals, Galaxy Roulette, Spotlight, stories,
Attention Map, connections, insights, search, mobile support. The showcase is a superset,
never a regression.

### 4. Credibility layer
- **Methodology panel** from the header: data provenance, connection methodology
  (co-occurrence normalized by paper volume), limitations stated plainly, the weekly
  auto-refresh pipeline, per-disease links to the live PubMed query.
- **Freshness stamp** in the legend: "Data: PubMed, refreshed weekly (last: <date>) ·
  WHO GHE 2021".
- **Runtime-derived captions.** All stats in spotlight captions, stories, roulette facts,
  and supernova telemetry are computed from `diseases.json` at render time. The weekly
  refresh can never make a caption lie again. (Live site currently says Breast Cancer
  "430K papers" while its own sidebar says 588K; this class of bug becomes impossible.)
- **Funding dimension (research-gated).** If NIH RePORTER coverage is adequate, a third
  metric joins papers and deaths: research dollars. "Deaths per million dollars" is the
  strongest form of the thesis. If coverage is poor, cut cleanly; no partial data.

### 5. Unguided-visitor polish
Post-opening hint chips ("Drag to orbit. Click any disease. Try the Time Machine."),
refreshed OG preview image using the ignite frame, full phone pass (a busy person's first
open is most likely mobile).

## Technology mandate ("latest and greatest")

- **Rendering spike first (Phase 0).** Evaluate Three.js WebGPU renderer + TSL node
  materials for the galaxy core with automatic WebGL2 fallback. Adopt only if the spike
  proves stable across Chrome, Safari 26, and mobile within a week; otherwise stay on
  WebGL2 and spend the budget on shader quality. Either way the demo must never show a
  visitor a broken canvas.
- **Stack upgrade.** React 19 + React Three Fiber v9 + latest drei/postprocessing;
  Vite 7. HDR bloom pipeline, filmic grading, depth of field; GPU particle systems for
  the opening and Time Machine transitions.
- **Sound design (opt-in).** Ambient score + interaction audio behind a muted-by-default
  toggle; autoplay policies respected. Cinematic director decides; cuttable if it cheapens
  the experience.

## Review rubric (gate: at least 9 of 10)

Weighted equally: first-30-seconds impact (unguided), sustained depth under expert
scrutiny (data correctness spot-checks against WHO/PubMed), visual and motion craft,
performance (60fps desktop HIGH tier, no jank on a mid-tier phone), and story clarity
(would a stranger retell the thesis correctly afterward?). The review agent must
spot-check at least 10 diseases' displayed numbers against primary sources.

## Delivery

- Runs locally via `npx vite` in `medgalaxy-next` (its own port, 5280).
- Optional (user decision later, not default): push branch for a Vercel preview URL so the
  user can open it on a phone. Production domain untouched either way.
- Verification per project convention: browser-pane rAF throttling means screenshots need
  the screenshot-pump or headless harness; tier-by-tier checks (HIGH/MEDIUM/LOW).

## Sequencing

1. Phase 0: rendering spike (WebGPU decision) + stack upgrade + data verification agents
   start in parallel.
2. The Gap opening (cinematic director leads).
3. Time Machine.
4. Credibility layer + polish (parallel with 2 and 3 where possible).
5. Review-agent scoring, iterate to 9+, final tier verification.

## Out of scope

Merging to main, deploying to medgalaxy.org, the "Ask MedGalaxy" AI box (stretch only if
everything above lands with time to spare), VR, WebXR.
