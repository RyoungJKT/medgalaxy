# MedGalaxy Next Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the showcase edition of MedGalaxy on branch `next/showcase` (worktree `Documents/Claude/medgalaxy-next`): cinematic "Gap" opening, Time Machine decade-plus scrubber, bulletproof data credibility, modern stack, 9/10 review gate. Live medgalaxy.org and branch `main` are never touched.

**Architecture:** The existing R3F app stays the skeleton. One InstancedMesh owns all node matrices (DiseaseNodes useFrame); mutable per-frame values flow through `sceneRefs` (never zustand) exactly like `curPos` does today; zustand holds only discrete state (phases, captions, toggles). New systems (overture, time machine) are null-rendering orchestrator components plus dedicated UI components, mirroring the proven GalaxyRoulette pattern. Rendering stays WebGL2 per the stack research (docs/superpowers/plans/reference/stackResearch.md); budget goes to shader quality and postfx.

**Tech Stack:** React 19.2.8, @react-three/fiber 9.7.0, three 0.185.1, @react-three/drei 10.7.8, @react-three/postprocessing 3.0.5 (postprocessing 6.39.4), zustand 5, gsap 3.14, Vite 7.3.6 + @vitejs/plugin-react 5.2.0, Tailwind v4 (unchanged), vitest (new), puppeteer-core (new, verification).

## Global Constraints

- Branch `next/showcase` only. NEVER commit to `main`, never push, never deploy. Dev server: `npx vite --port 5280 --strictPort`.
- House copy style: no em dashes anywhere (use commas/periods), no section-sign symbol, sentence case captions, full numbers in hero copy ("11 million", never "11M" in hero/caption text; `fmtFull` comma-separated integers elsewhere).
- Every displayed number must be computed at render time from `data/*.json` or carry an explicit source string. Never hardcode a stat in a caption.
- Never sum papers or mortality across diseases in any caption (epidemiologically dishonest per reference/whoData.json notes).
- Bloom discipline: only ignite-ramp emissives may exceed the bloom luminance threshold (1.0). Nothing else ever blooms.
- Motion constitution (docs/direction/2026-08-11-cinematic-direction.md section 4): sanctioned durations 120/180/240/320/480/650 ms; easings expo.out (UI), sine.inOut (camera), critically damped spring (world), back.out(1.2) only for COVID detonation + supernova pop.
- All cinematics: skippable on any input, `prefers-reduced-motion` gets caption-intact dissolves.
- Reference docs (committed, read them per task as cited): `docs/direction/2026-08-11-cinematic-direction.md` (DIRECTION), `docs/superpowers/plans/reference/{sceneCore,stateModes,uiShell,shadersPostfx,dataPipeline,stackResearch}.md` and `{whoData,nihFunding}.json`.
- Commit after every task with a conventional message. Do NOT add a Co-Authored-By trailer (user preference).
- Verification note: browser-pane pages throttle rAF; use the puppeteer harness (`tools/verify.mjs`, Task 2) for screenshots/FPS, not the preview pane.

## File Structure (new / heavily modified)

```
src/utils/captions.js          NEW  formatting + derived-stat helpers (fmtFull, fmtWord, ppd, trendLabel)
src/utils/motion.js            NEW  sanctioned durations/easings/spring
src/utils/timeMachineData.js   NEW  per-year radii precompute + movers
src/utils/igniteWeights.js     NEW  aIgnite / aEmber per-node weights
src/audio/engine.js            NEW  WebAudio synth palette (no assets)
src/components/PostFX.jsx      NEW  replaces SelectionDOF.jsx (Bloom + DoF + Vignette)
src/components/OvertureSequence.jsx  NEW  null-rendering beat clock for The Gap
src/components/TimeMachine.jsx  NEW  null-rendering tour + scrub engine
src/components/ui/OvertureCaption.jsx  NEW  cinematic caption + odometer
src/components/ui/Odometer.jsx  NEW  slot-rolling number
src/components/ui/SkipPill.jsx  NEW  skip affordance with beat ticks
src/components/ui/HintChips.jsx NEW  post-release hint chips
src/components/ui/TimeRail.jsx  NEW  year scrubber
src/components/ui/MethodologyPanel.jsx NEW  provenance modal
scripts/backfill_yearly.py     NEW  one-time 1990-2014 PubMed backfill
tools/verify.mjs               NEW  puppeteer screenshot + FPS harness
tests/*.test.js                NEW  vitest: data invariants, captions, tm data, ignite weights
src/store.js                   MOD  overture/tm/sound/uiRevealed state + guards in start actions
src/components/DiseaseNodes.jsx MOD  radius resolution order + hover scale + fx uniforms
src/shaders/plasma.frag.glsl   MOD  ignite ramp, desat, ember rim, re-enable animated plasma
src/shaders/pulse.frag.glsl    MOD  same uniforms (minimal mirror)
src/utils/constants.js         MOD  honest normalization maxima
src/utils/helpers.js           MOD  nR/nRM exponent, nRY
scripts/refresh_pubmed.py      MOD  preserve backfill prefix, clamp trend
data/diseases.json             MOD  corrections + provenance fields + yearStart + backfill
data/disease-insights.json     MOD  epilepsy typo removal + flagged-number audit
```

Radius resolution order in DiseaseNodes (single owner of scale, per sceneCore.md item 1):
`sceneRefs.tm.active ? timeMachineRadius : lerp(nR(papers), nRM(mortality), morphT)` where `morphT = sceneRefs.fx.morphOverride ?? smoothed(sizeMode)`.

---

### Task 1: Test infrastructure + data invariants suite

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Create: `tests/dataInvariants.test.js`

**Interfaces:**
- Produces: `npm test` (vitest run). The invariants suite is the permanent professor-proofing tripwire; later tasks extend it.

- [ ] **Step 1: Install dev deps**

```bash
cd /Users/darwin/Documents/Claude/medgalaxy-next
npm install -D vitest@^3 puppeteer-core@^24
```

- [ ] **Step 2: Add scripts to package.json** (`"test": "vitest run", "verify": "node tools/verify.mjs"` in `"scripts"`)

- [ ] **Step 3: Write the invariants test (initially documenting CURRENT state, so it fails on known-bad data, proving it works)**

```js
// tests/dataInvariants.test.js
import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import connections from '../data/connections.json';
import insights from '../data/disease-insights.json';

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
  it('WHO-verified mortality corrections are applied', () => {
    const byId = Object.fromEntries(diseases.map(d => [d.id, d]));
    expect(byId['pertussis'].mortality).toBe(59000);
    expect(byId['rotavirus'].mortality).toBe(128500);
    expect(byId['covid-19'].mortality).toBe(250000);
    expect(byId['ebola'].mortality).toBe(32);
    expect(byId['west-nile-virus'].mortality).toBe(130);
  });
});
```

- [ ] **Step 4: Run and confirm the expected failures** (`npx vitest run tests/dataInvariants.test.js`): the epilepsy 10th-field test, the trend<=999 test (covid-19 = 14087650), and the corrections test MUST fail now; the rest pass. This proves the tripwire works.
- [ ] **Step 5: Commit** `test: add data invariants suite (documents known data defects, fixed in Tasks 3-4)`

### Task 2: Verification harness

**Files:**
- Create: `tools/verify.mjs`

**Interfaces:**
- Produces: `npm run verify -- [--shot name] [--fps seconds] [--eval "js"]` writing PNGs to `docs/verify/`. Later tasks call it; it needs the dev server on :5280.

- [ ] **Step 1: Write the harness**

```js
// tools/verify.mjs
// Headless-Chrome harness (browser-pane rAF throttling makes the preview pane unusable for this).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--window-size=1440,900', '--use-gl=angle'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction('window._store !== undefined', { timeout: 15000 });

const evalArg = get('--eval');
if (evalArg) console.log(JSON.stringify(await page.evaluate(evalArg)));

const fpsSecs = get('--fps');
if (fpsSecs) {
  const fps = await page.evaluate(async (secs) => {
    let frames = 0; const t0 = performance.now();
    await new Promise((res) => { const tick = () => { frames++;
      performance.now() - t0 < secs * 1000 ? requestAnimationFrame(tick) : res(); };
      requestAnimationFrame(tick); });
    return Math.round(frames / secs);
  }, Number(fpsSecs));
  console.log(`FPS: ${fps}`);
}

const shot = get('--shot');
if (shot) {
  fs.mkdirSync('docs/verify', { recursive: true });
  await page.screenshot({ path: `docs/verify/${shot}.png` });
  console.log(`saved docs/verify/${shot}.png`);
}
await browser.close();
```

- [ ] **Step 2: Verify against the running baseline** (start `npx vite --port 5280 --strictPort` if not running):

```bash
npm run verify -- --eval "window._store.getState().skipIntro() || true" --shot baseline --fps 5
```

Expected: `FPS:` at or near 60, `saved docs/verify/baseline.png`, screenshot shows the galaxy (not a black canvas). If Chrome is missing at that path, locate with `ls /Applications | grep -i chrome` and fix CHROME.
- [ ] **Step 3: Commit** `chore: add puppeteer verification harness` (add `docs/verify/` to `.gitignore` in the same commit; screenshots are scratch output).

### Task 3: Data integrity, corrections + provenance

**Files:**
- Modify: `data/diseases.json`, `data/disease-insights.json`, `scripts/refresh_pubmed.py`
- Create: `data/meta.json`
- Test: `tests/dataInvariants.test.js` (Task 1, goes green except backfill-related)

Authoritative values: `docs/superpowers/plans/reference/whoData.json`.

- [ ] **Step 1: Write a one-off Node script (scratch, do not commit) applying to `data/diseases.json`:**
  - `pertussis.mortality = 59000`; `rotavirus.mortality = 128500`; `covid-19.mortality = 250000`; `ebola.mortality = 32`; `west-nile-virus.mortality = 130`; `covid-19.trend = 999`.
  - Add to EVERY disease: `"mortalityYear"` and `"mortalitySource"`. Defaults: `2021` and `"WHO Global Health Estimates 2021"`. Overrides (exact strings):
    - sepsis: 2017, `"Rudd et al., Lancet 2020 (GBD 2017), WHO-cited; sepsis-associated deaths overlap underlying causes"`
    - breast-cancer, lung-cancer: 2022, `"IARC GLOBOCAN 2022"`
    - malaria: 2024, `"WHO World Malaria Report 2025"`
    - tuberculosis: 2024, `"WHO Global Tuberculosis Report 2025"`
    - hiv-aids: 2024, `"UNAIDS Global AIDS Update 2025"`
    - pertussis: 2021, `"IHME GBD 2021 (all ages)"`
    - rotavirus: 2016, `"GBD/Troeger et al. 2018, WHO-cited (under-5 deaths)"`
    - covid-19: 2023, `"WHO reported deaths, 2023; global reporting has since largely ceased"`
    - ebola: 2025, `"WHO/CDC outbreak records 2025; episodic, 2014-16 averaged ~3,800/yr"`
    - west-nile-virus: 2023, `"CDC, US mean 2014-2023; no global estimate exists"`
    - alzheimers-disease: 2021, `"IHME GBD 2021 (Alzheimer's and other dementias)"`
    - rheumatic-heart-disease: 2021, `"IHME GBD 2021"`
    - norovirus: 2016, `"Lopman et al., PLOS Medicine 2016 modeling, WHO-cited"`
  - `data/disease-insights.json`: delete the `"burundAnswer"` key from the `epilepsy` entry only.
- [ ] **Step 2: Create `data/meta.json`:** `{ "pubmedLastRefresh": "2026-08-10", "mortalityDefaultSource": "WHO Global Health Estimates 2021" }`
- [ ] **Step 3: Amend `scripts/refresh_pubmed.py`:** after the trend computation (`trend = round(pct_change)` at ~:92), clamp: `trend = max(-999, min(999, trend))`. In the write step, also update `meta.json`'s `pubmedLastRefresh` with today's date (`json.dump` alongside diseases; path `DATA_PATH` sibling `meta.json`).
- [ ] **Step 4: Run `npx vitest run tests/dataInvariants.test.js`.** Expected: all green EXCEPT nothing; all should now pass (backfill invariants arrive in Task 4).
- [ ] **Step 5: Spot-check in the sidebar** (dev server, click Pertussis): WHO Deaths/yr shows 59K. (Sidebar reads `disease.mortality` directly per uiShell.md section 4, so no code change needed for the value itself.)
- [ ] **Step 6: Commit** `fix(data): WHO-verified mortality corrections + per-disease provenance fields`

### Task 4: yearlyPapers backfill 1990-2024

**Files:**
- Create: `scripts/backfill_yearly.py`
- Modify: `scripts/refresh_pubmed.py`, `data/diseases.json`, `src/components/ui/Sparkline.jsx`, `src/components/ui/Sidebar.jsx:138`
- Test: extend `tests/dataInvariants.test.js`

**Interfaces:**
- Produces: every disease gains `"yearStart": 1990` and a 35-entry `yearlyPapers` (indexes 0..24 = 1990..2014 backfilled, 25..34 = 2015..2024 from the existing weekly pipeline). Time Machine (Tasks 11-13) consumes `yearStart` + array length dynamically. Sparkline gains props `yearStart`, `yearEnd`.

- [ ] **Step 1: Write `scripts/backfill_yearly.py`** mirroring `refresh_pubmed.py`'s `pubmed_count`, `SEARCH_OVERRIDES`, term building, UA, and 0.35 s rate limit (copy those blocks verbatim from `scripts/refresh_pubmed.py:18-67`); `YEARS_BACK = list(range(1990, 2015))`. For each disease lacking `yearStart == 1990`: fetch 25 per-year counts, then `disease['yearlyPapers'] = back + disease['yearlyPapers']`, `disease['yearStart'] = 1990`. Write file after EVERY completed disease (json.dump, indent=2) so the run is resumable; skip already-backfilled diseases on restart. Print progress `i/153 id`.
- [ ] **Step 2: Amend `scripts/refresh_pubmed.py`** yearly-write block (`disease['yearlyPapers'] = yearly` at ~:96): preserve the backfill prefix:

```python
    prior = disease.get('yearlyPapers', [])
    year_start = disease.get('yearStart', YEARS[0])
    prefix_len = YEARS[0] - year_start  # 25 after backfill, 0 before
    disease['yearlyPapers'] = prior[:prefix_len] + yearly
```

- [ ] **Step 3: Run the backfill** (`python3 scripts/backfill_yearly.py`, ~25 min). Then sanity-gate (add to invariants test): every `yearlyPapers.length === 35`, `yearStart === 1990`; `covid-19.yearlyPapers.slice(0,29)` sums to under 400 (pre-2019 noise only); `hiv-aids` max over 1990-1999 is at least 2x its 1990 value (the 90s surge must be visible, this is the Time Machine's second act). If PubMed blocks or the HIV surge is absent, STOP and fall back per DIRECTION section 3 note: keep 2015-2024 only, revert yearStart, and Time Machine ships the decade version. Record the outcome in the commit message.
- [ ] **Step 4: Make year labels dynamic.** `Sparkline.jsx`: add `yearStart`, `yearEnd` props replacing the hardcoded `2014`/`2024` text nodes (uiShell.md section 4 has full source). `Sidebar.jsx:138`: heading becomes `` `Publication Trend (${d.yearStart ?? 2015}-2024)` `` and pass `yearStart={disease.yearStart ?? 2015} yearEnd={2024}`. This also fixes the live off-by-one ("2014-2024" for 2015-2024 data).
- [ ] **Step 5: Run full test suite, verify sidebar sparkline label + longer curve** via `npm run verify -- --shot backfill-sidebar` after selecting a node (`--eval "window._store.getState().selectDisease(window._store.getState().idMap['hiv-aids'])||true"`).
- [ ] **Step 6: Commit** `feat(data): backfill yearlyPapers to 1990 + dynamic year labels (or the documented decade fallback)`

### Task 5: Honest size normalization

**Files:**
- Modify: `src/utils/constants.js:12`, `src/utils/helpers.js:3-4`
- Test: `tests/normalization.test.js` (create)

Today `MAX_PAPERS = 450000` and `MAX_MORT = 1400000` clamp the top of both scales: heart-disease (1,733,464 papers) renders the SAME size as pneumonia (605,564), and in deaths view the top 8 killers all clamp identical, which flattens the morph and is visually dishonest. Fix:

- [ ] **Step 1: Write failing test**

```js
// tests/normalization.test.js
import { describe, it, expect } from 'vitest';
import { nR, nRM } from '../src/utils/helpers';

describe('honest size normalization', () => {
  it('distinguishes the giants (no clamping at the top)', () => {
    expect(nR(1733464)).toBeGreaterThan(nR(605564) * 1.2);
    expect(nRM(11000000)).toBeGreaterThan(nRM(9100000) * 1.05);
  });
  it('keeps the smallest nodes visible', () => {
    expect(nR(797)).toBeGreaterThan(1.0);
    expect(nRM(32)).toBeGreaterThan(0.05);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** (top-clamp equalities).
- [ ] **Step 3: Implement:** constants.js `export const MN = 0.3, MX = 55, MAX_PAPERS = 1750000, MAX_MORT = 11000000;` and helpers.js exponent 0.6 → 0.5 in both `nR` and `nRM` (keeps small nodes near current visual size under the larger domain).
- [ ] **Step 4: Tests pass.** Then visual check (layout also derives from nR per dataPipeline.md `layout.js` notes): `npm run verify -- --shot resize-papers --fps 5`, then `--eval "window._store.getState().setSizeMode('mortality')||true" --shot resize-mortality`. Confirm: heart-disease clearly largest in papers view; sepsis clearly dominant in mortality view; galaxy composition still reads well (no giant swallowing the center; if it does, nudge MX 55 → 50 and re-shoot).
- [ ] **Step 5: Commit** `feat(viz): unclamped honest size normalization (papers and deaths views)`

### Task 6: Runtime-derived captions everywhere

**Files:**
- Create: `src/utils/captions.js`, `tests/captions.test.js`
- Modify: `src/components/StoryEngine.jsx:5-46`, `src/components/Spotlight.jsx:5-50`, `src/components/GalaxyRoulette.jsx:42-59` (use shared fmt), `src/components/ui/Sidebar.jsx` (trend display clamp label)

**Interfaces:**
- Produces: `captions.js` exports `fmtFull(n)` ("248,989"), `fmtWord(n)` ("11 million" for exact millions >= 1e6 else fmtFull), `ppd(d)` (papers per death, null when mortality 0), `deathsPerPaper(d)`, `trendLabel(t)` ("research up 12%" / "research down 13%" / "surged from zero" when t >= 999). Consumed by StoryEngine, Spotlight, roulette, overture, time machine.

- [ ] **Step 1: Failing tests** for all five helpers (`fmtWord(11000000) === '11 million'`, `fmtWord(9100000) === '9.1 million'`, `fmtFull(248989) === '248,989'`, `ppd({papers: 69347, mortality: 1000})` ≈ 69.3, `trendLabel(999) === 'surged from zero'`, `trendLabel(-13) === 'research down 13%'`).
- [ ] **Step 2: Implement captions.js** (Intl.NumberFormat('en-US') for fmtFull; fmtWord: `n >= 1e6 ? trimTrailingZero((n/1e6).toFixed(1)) + ' million' : fmtFull(n)`).
- [ ] **Step 3: Rewrite `buildSequences` (StoryEngine.jsx:5-46)** deriving every numeral. Pattern per step (repeat for all six sequences, keeping today's editorial framing and the stateModes.md verbatim list as the reference for which diseases each sequence visits):

```js
const d = (id) => diseases[idMap[id]];
// example: silent killers step
{ id: idMap['rheumatic-heart-disease'], supernova: true,
  caption: `Rheumatic Heart Disease\n${fmtFull(d('rheumatic-heart-disease').mortality)} deaths, only ${fmtFull(d('rheumatic-heart-disease').papers)} papers` },
```

`buildSequences(idMap)` gains a `diseases` argument: change the call site (StoryEngine.jsx:96 area) accordingly. Terminal summary captions must not sum across diseases (Global Constraints); rewrite the four offenders as qualitative lines, e.g. researched: `'Science is paying attention here.'`, killers: `'Each of these alone outranks entire categories of disease.'`, forgotten: `'And the world is looking away.'`, silent: `'Almost no one is studying why.'` The richpoor per-death ratios use `ppd()` formatted to 2 decimals below 1, whole numbers above.
- [ ] **Step 4: Rewrite `buildSpotlightList` (Spotlight.jsx:5-50)** the same way (25 entries, keep editorial tails like "Reshaped modern medicine", derive every numeral via fmtFull/fmtWord/ppd/trendLabel/deathsPerPaper). Delete the now-wrong literals ("430K", "95K", "160K"...). For covid-19 use `trendLabel` so it reads "surged from zero" not a fake percentage.
- [ ] **Step 5: GalaxyRoulette.jsx:42-59:** replace local `fmt` with `fmtFull` from captions.js (full numbers per house style).
- [ ] **Step 6: Sidebar trend stat:** where the Publications SB shows the trend arrow + `%` (uiShell.md section 4 item 3), render `trendLabel(disease.trend)` semantics: when `Math.abs(trend) >= 999` display `new` instead of a percent.
- [ ] **Step 7: Tests pass + manual sweep:** run each story chip and Spotlight for one cycle in the dev server; confirm zero stale numbers (sepsis spotlight must say 248,989 papers). Commit `feat(captions): all captions runtime-derived from data`

### Task 7: PostFX pipeline (Bloom + DoF + Vignette)

**Files:**
- Create: `src/components/PostFX.jsx`
- Delete: `src/components/SelectionDOF.jsx`
- Modify: `src/App.jsx` (import/mount swap), `src/utils/tiers.js` (bloom params)

**Interfaces:**
- Produces: `<PostFX />` mounted where SelectionDOF was (App.jsx:174 area). Exports nothing else. Tier config gains `TC[tier].bloom = { intensity, levels }`; LOW stays composer-free (per DIRECTION, mobile carries the story with size + color).

- [ ] **Step 1: tiers.js:** `HIGH: { ..., bloom: { intensity: 0.9, levels: 7 } }, MEDIUM: { ..., bloom: { intensity: 0.7, levels: 5 } }, LOW: { ..., bloom: null }`.
- [ ] **Step 2: Write PostFX.jsx.** Copy SelectionDOF's whole DoF/motion-suppression logic verbatim (shadersPostfx.md section 4 has the full 79-line source), then wrap:

```jsx
  return (
    <EffectComposer resolutionScale={DOF_RES_SCALE}>
      <Bloom mipmapBlur intensity={CFG.bloom.intensity} levels={CFG.bloom.levels}
        luminanceThreshold={1.0} luminanceSmoothing={0.05} />
      <DepthOfField ref={dofRef} focusDistance={0} focalLength={0.04}
        bokehScale={0} resolutionScale={DOF_RES_SCALE} />
      <Vignette eskil={false} offset={0.28} darkness={0.62} />
    </EffectComposer>
  );
```

(`Bloom`, `Vignette` from `@react-three/postprocessing`; keep the `TIER === 'LOW'` null return.) luminanceThreshold 1.0 is the bloom-discipline enforcement: LDR content cannot bloom; only the ignite emissive (Task 8) exceeds 1.0.
- [ ] **Step 3: App.jsx:** swap import + JSX `<SelectionDOF />` → `<PostFX />`; delete SelectionDOF.jsx.
- [ ] **Step 4: Verify:** dev server renders identically to baseline except a subtle vignette (`npm run verify -- --shot postfx --fps 5`, FPS still ~60; nothing blooms yet). Commit `feat(postfx): bloom pipeline with threshold discipline + vignette (DoF preserved)`

### Task 8: Shader ignite system + animated plasma re-enable

**Files:**
- Create: `src/utils/igniteWeights.js`, `tests/igniteWeights.test.js`
- Modify: `src/shaders/plasma.frag.glsl`, `src/shaders/pulse.frag.glsl`, `src/components/DiseaseNodes.jsx`, `src/sceneRefs.js`

**Interfaces:**
- Produces: `sceneRefs.fx = { morphOverride: null, ignite: 0, desat: 0, ember: 0 }` (mutable, written by OvertureSequence later; DiseaseNodes copies into uniforms per frame). Geometry attributes `aIgnite` (0..1 divergence weight) and `aEmber` (1.0 for bottom-decile papers-per-death, else 0). `igniteWeights(diseases)` returns `{ ignite: Float32Array, ember: Float32Array }`.

- [ ] **Step 1: Failing tests:** sepsis ignite weight is the maximum (1.0); heart-disease under 0.25 (giant in both worlds, "honest anchor" per DIRECTION); depression 0 (mortality 0 never ignites); rheumatic-heart-disease and copd over 0.6; ember has exactly `Math.ceil(0.1 * countWithMortality)` ones; cystic-fibrosis (48 papers/death) ember 0.
- [ ] **Step 2: Implement igniteWeights.js:** rank diseases by papers desc → `paperRank`; by mortality desc → `mortRank` (mortality 0 excluded from ignite, weight 0). Divergence `div = (paperRank - mortRank) / n` clamped to [0, 1] after normalizing so the max diverger = 1: `ignite[i] = Math.pow(Math.max(0, div) / maxDiv, 0.75)`. Ember: among mortality > 0, bottom decile of `papers / mortality` gets 1.
- [ ] **Step 3: plasma.frag.glsl:**
  - Line 2 area, add uniforms: `uniform float igniteAmount; uniform float desatAmount; uniform float emberAmount;` and varying `varying float vIgnite; varying float vEmber;` (vert passes through new attributes `aIgnite`, `aEmber`, both verts).
  - Re-enable animated plasma: `if (false)` at :103 → `if (usePlasma > 0.5)`.
  - After the existing final clamp `col = min(col, vColor * 1.15);` insert, in order:

```glsl
  // Palette suppression (overture beat 2 stage one): drain to graphite
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(0.72, 0.78, 0.92), desatAmount * 0.85);

  // Black-body ignite: dark rim to white-hot core, HDR (exceeds bloom threshold)
  float ig = vIgnite * igniteAmount;
  if (ig > 0.001) {
    float core = pow(NdotV, 2.2);                       // radial: rim 0, core 1
    vec3 ramp = mix(vec3(0.17, 0.03, 0.02),             // smolder #2b0806
                mix(vec3(0.79, 0.08, 0.03),             // ignition #c92a0d
                    vec3(1.0, 0.95, 0.88), core * core), // white-hot core #fff3e0
                core);
    col = mix(col, ramp * (1.0 + 5.0 * core * ig), ig);
  }

  // Persistent ember rim on the overlooked decile (post-release standing scar)
  float rim = pow(1.0 - NdotV, 3.0);
  col += vec3(1.0, 0.23, 0.08) * rim * vEmber * emberAmount
         * (0.30 + 0.05 * sin(time * 3.14159 + vPhase));
```

- [ ] **Step 4: pulse.frag.glsl:** mirror the same three uniforms + varyings + the ignite/desat/ember block (paste identically after its final clamp; it already has `time`).
- [ ] **Step 5: DiseaseNodes.jsx:** add `aIgnite`/`aEmber` InstancedBufferAttributes in the geo useMemo (:82-93 pattern) from `igniteWeights(diseases)`; add the three uniforms (value 0) to plasmaMat and pulseMat; extend the per-frame uniform block (:180-182):

```js
    if (mat.uniforms) {
      mat.uniforms.time.value = state.clock.getElapsedTime();
      const fx = sceneRefs.fx;
      mat.uniforms.igniteAmount.value = fx.ignite;
      mat.uniforms.desatAmount.value = fx.desat;
      mat.uniforms.emberAmount.value = fx.ember;
    }
```

  Initialize `sceneRefs.fx = { morphOverride: null, ignite: 0, desat: 0, ember: 0 }` in sceneRefs.js.
- [ ] **Step 6: Verify.** Tests green. Console-drive the effect via harness: `--eval "sceneRefs is module-scoped, so expose for testing: add window.__fx = sceneRefs.fx in sceneRefs.js (dev-only line, keep it)"` then `--eval "window.__fx.desat=1;window.__fx.ignite=1;true" --shot ignite-full`: galaxy graphite-gray with sepsis burning white-hot core, stroke/COPD in flame, cancer NOT blooming. Also `--shot plasma-check` at rest: animated plasma visibly flowing on HIGH. FPS >= 55. Commit `feat(shaders): black-body ignite + palette suppression + ember rim, animated plasma restored`

### Task 9: Size-morph engine + hover scale

**Files:**
- Modify: `src/components/DiseaseNodes.jsx:227-237`
- Test: harness (visual)

**Interfaces:**
- Produces: DiseaseNodes remains the SOLE scale owner. Resolution: `sceneRefs.tm.active` (Task 11) → per-year radius; else `morphT = fx.morphOverride ?? smoothed sizeMode`; hover scale 1.06 (120 ms feel via lerp).

- [ ] **Step 1: Replace the final matrix loop (sceneCore.md item 1 has the verbatim current block) with:**

```js
    const scales = introScalesRef.current;
    const fx = sceneRefs.fx;
    const tm = sceneRefs.tm;
    // smooth sizeMode toggle: drift stored morph toward target
    const morphTarget = fx.morphOverride ?? (sizeMode === 'mortality' ? 1 : 0);
    morphRef.current += (morphTarget - morphRef.current) * (fx.morphOverride != null ? 1 : 0.06);
    const morphT = fx.morphOverride ?? morphRef.current;
    const ease = morphT * morphT * (3 - 2 * morphT); // smoothstep
    const hoverIdx = store.hoveredNode ? store.hoveredNode.index : -1;
    for (let i = 0; i < count; i++) {
      _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
      let r;
      if (tm && tm.active) {
        r = tm.radiusAt(i); // Task 11
      } else {
        r = nR(diseases[i].papers) * (1 - ease) + nRM(diseases[i].mortality) * ease;
      }
      hoverScaleRef.current[i] += (((i === hoverIdx) ? 1.06 : 1) - hoverScaleRef.current[i]) * 0.25;
      const is = (scales ? scales[i] : 1) * hoverScaleRef.current[i];
      _s3.set(r * is, r * is, r * is);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
```

  Add refs: `const morphRef = useRef(0); const hoverScaleRef = useRef(new Float32Array(count).fill(1));`
- [ ] **Step 2: Verify:** toggling Papers/Mortality in the header now animates smoothly (no snap); hovering a node breathes it up 6 percent; `--fps 5` still ~60. Commit `feat(engine): unified size-morph resolution + hover scale`

### Task 10: Overture UI components (caption, odometer, skip pill, hint chips)

**Files:**
- Create: `src/components/ui/Odometer.jsx`, `src/components/ui/OvertureCaption.jsx`, `src/components/ui/SkipPill.jsx`, `src/components/ui/HintChips.jsx`
- Modify: `src/components/HtmlOverlay.jsx` (mount all four)
- Test: `tests/odometer.test.js` (digit decomposition)

**Interfaces:**
- Consumes (store fields created in Task 11's store step, defined here so both tasks agree): `overtureActive: bool`, `overtureBeat: 0|1|2|3`, `overtureCaption: { lines: string[], data?: string, odometer?: { from: number, fromUnit: string, to: number, toUnit: string } } | null`, `uiRevealed: bool`, actions `skipOverture()`, and `hintDismiss(key)` with `hintsShown: bool`, `hintsDismissed: Set<string>`.
- Produces: caption/skip/hints render from those fields only (no logic).

- [ ] **Step 1: Odometer.jsx:** props `{ value, unit }`. Renders fixed-width digit columns (IBM Plex Mono); each column is a vertical strip of 0-9 translated with `transition: transform 480ms cubic-bezier(0.16,1,0.3,1)` to the current digit; comma separators as static spans; unit label to the right with a 240 ms crossfade on change. Pure CSS transforms (60 fps safe). Test: exported `digitsOf(11000000)` → `['1','1',',','0','0','0',',','0','0','0']`.
- [ ] **Step 2: OvertureCaption.jsx:** follows the SpotlightCaption glass-card pattern (uiShell.md section 6 verbatim example) but centered lower-third, no kicker; hero line clamp(20px, 3.2vw, 34px) weight 500 ink `#e2e8f0`; data sub-line 11px `#94a3b8`; per-line entrance 8px rise + fade 300 ms with 90 ms stagger (`animation-delay: i*90ms`), exit plain 200 ms fade; renders `<Odometer />` when `overtureCaption.odometer` present, animating from→to on mount. Renders null unless `overtureActive && overtureCaption`.
- [ ] **Step 3: SkipPill.jsx:** bottom-right 9px mono `#64748b` pill "skip intro" + three progress ticks filled by `overtureBeat`; visible from 0.5 s (CSS delay); onClick → `skipOverture()`. pointerEvents auto.
- [ ] **Step 4: HintChips.jsx:** three chips ("Drag to orbit", "Click any disease", "Try the Time Machine"), bottom-center above StoryChips, 300 ms stagger fade-in when `hintsShown`; each disappears when its key enters `hintsDismissed`. Dismissal wiring arrives in Task 11 step 5.
- [ ] **Step 5: Mount all four in HtmlOverlay.jsx** (after `<SupernovaOverlay />`). Components render null until the store fields exist (guard with `useStore(s => s.overtureActive ?? false)` style reads so this commit is inert). Odometer test green. Commit `feat(ui): overture caption, odometer, skip pill, hint chips (inert until FSM lands)`

### Task 11: The Gap overture FSM

**Files:**
- Create: `src/components/OvertureSequence.jsx`
- Modify: `src/store.js`, `src/App.jsx` (mount + input capture), guards in `src/components/{IdleDrift,GravityLens,CameraRig,Spotlight}.jsx`, `src/components/DiseaseNodes.jsx` (pointer guards), `src/components/ui/{Header,FilterBar,Legend,StoryChips}.jsx` (uiRevealed gating), `src/components/IntroSequence.jsx` (T_DONE 3.5 → 4.0)

Read DIRECTION section 2 (beat board) in full before implementing; it is the authoritative choreography. Summary of what the FSM drives per beat (all continuous values written to `sceneRefs.fx`, camera via `setFlyTarget`, captions via `setOvertureCaption`):

| Beat | Dur | fx / camera / caption |
|---|---|---|
| 0 assembly | existing intro (4.0 s) | `desat: 1` from load; no caption; SkipPill visible |
| 1 attention | 5.0 s | desat 1→0 over first 1.0 s; camera dolly camDist*1.5 → camDist*1.15, 4 deg lateral drift, expo.out; caption "Where the world's attention goes." + data "153 diseases, sized by research papers on record." (count from `diseases.length`) |
| 2 morph | 7.0 s | camera pull to 1.45, sine.inOut over 2.5 s then HOLD; 0-1.2 s desat 0→1; 1.2-4.6 s `morphOverride` 0→1 (smoothstep) + `ignite` 0→1; captions at 1.4 s "But this is who actually dies." and 2.6 s hero "Sepsis kills {fmtWord(sepsis.mortality)} people a year." + odometer {from: sepsis.papers, fromUnit: 'papers', to: sepsis.mortality, toUnit: 'deaths every year'} |
| 3 release | 4.5 s | desat 1→0 over 1.5 s; ignite 1→0 over 1.5 s; `ember` 0→1; camera glide to camDist, damped; morphOverride holds 1 for 2 s then eases to null (hands control to sizeMode, teaching the toggle); caption "Explore the gap."; `setUiRevealed(true)`; `hintsShown: true`; sizeMode left as 'papers' |

- [ ] **Step 1: Store additions** (follow existing setter style, store.js:118-153): fields `overtureActive: false, overtureBeat: 0, overtureCaption: null, uiRevealed: false, hintsShown: false, hintsDismissed: new Set(), overtureDone: false`; actions `setOvertureBeat`, `setOvertureCaption`, `setUiRevealed`, `hintDismiss(key)` (Set copy + add), `startOverture()` (guards: only if `!overtureDone`; tears down like startRoulette does: spotlight off, story cleared, roulette stopped), `skipOverture()` (sets a `_overtureSkip: true` flag the FSM reads; NOT an instant teardown, the compressed morph must still play), `finishOverture()` (`{ overtureActive: false, overtureBeat: 3, overtureCaption: null, uiRevealed: true, hintsShown: true, overtureDone: true }` and resets `sceneRefs.fx` ignite/desat to 0, ember to 1).
- [ ] **Step 2: OvertureSequence.jsx** (null-rendering, useFrame clock, GalaxyRoulette.jsx is the structural template): auto-starts once when `introPhase >= 5 && !overtureDone && introStarted` (also handle the reduced-motion path: if `matchMedia('(prefers-reduced-motion: reduce)').matches`, play the two-held-frames dissolve variant per DIRECTION beat 2 note: set morphOverride/ignite instantly at the caption schedule with 300 ms opacity dissolves, then finish). Beat clock per the table; camera moves through `setFlyTarget({ position: [0,0,0], cameraPos: [...], duration })` (CameraRig already supports explicit cameraPos, sceneCore.md item 6). Skip flag: on `_overtureSkip`, jump to compressed path (1.2 s morph 0→1 + ignite flash + hero caption held 1.5 s, then release beat at normal speed). Velocity-matched handover approximation: during the final glide's last 300 ms, set `controls.autoRotate = true` with `autoRotateSpeed` matched to the glide's terminal angular velocity, then decay autoRotateSpeed to the resting 0.3 over 1 s (access controls via `sceneRefs`; expose `sceneRefs.controls = controlsRef.current` inside CameraRig's effect if not already).
- [ ] **Step 3: Guards.** Add `if (useStore.getState().overtureActive) return;` alongside every existing roulettePhase guard listed in sceneCore.md item 4 for: IdleDrift (:12 block), GravityLens (:116 expression, add `|| overtureActive`), CameraRig autoRotate branch (force `false` while overtureActive, before the roulette branch), DiseaseNodes onPointerOver/onClick (:241,:253), Spotlight (:60), App.jsx background-click/double-click/Escape handlers (Escape during overture = skipOverture, insert BEFORE the roulette branch at App.jsx:93). `startRoulette`/`triggerSupernova`/`setActiveMode` calls are unreachable during overture because chrome is hidden (uiRevealed false), but add the guard in `startRoulette` and `triggerSupernova` anyway (`if (get().overtureActive) return;`).
- [ ] **Step 4: Any-input skip capture:** in App.jsx, while `overtureActive`, a capture-phase listener on window for `pointerdown|keydown|wheel|touchstart` calls `skipOverture()` (except when the target is the SkipPill button, which calls it anyway; do not preventDefault).
- [ ] **Step 5: UI reveal regating** (uiShell.md section 2 has each current line): Header.jsx:131, FilterBar.jsx:38, Legend.jsx:16 change `introStarted ? 'slideDown 0.6s ease 3.0s forwards' : 'none'` (and the 3.15 s/3.4 s variants) to `uiRevealed ? 'slideDown 0.6s ease forwards' : 'none'` (delays 0, 0.15 s, 0.4 s respectively to keep the stagger). StoryChips.jsx: replace the 2800 ms mount timer with `uiRevealed` (`const show = storyVisible && uiRevealed;`). HintChips dismissal wiring: orbit chip on first controls interaction (listen `controlsRef` 'start' once via sceneRefs.controls), click chip on first `selectedNode`, time machine chip on first `tmPhase !== 'idle'` (subscribe in HintChips itself).
- [ ] **Step 6: IntroSequence.jsx:** `T_DONE = 3.5` → `4.0`, `T_EFFECTS = 2.5` → `2.8` (beat 0 length per DIRECTION). Existing intro skip (any input during intro) still works and now chains into the overture, whose own skip then compresses; verify chain feels right.
- [ ] **Step 7: Verify the full film** with the harness: fresh load (`--eval "window._store.getState().setIntroStarted()||true"` then timed shots at 5 s, 10 s, 14 s, 18 s: `--shot beat1`, `--shot beat2-suppress`, `--shot beat2-ignite`, `--shot beat3-release`). Check: beat 1 shows full palette + caption; beat 2 early is graphite; beat 2 late shows sepsis white-hot with bloom; beat 3 shows chrome arrived + ember rims + hint chips. FPS during morph >= 55 on HIGH. Reduced-motion path: re-run with `--eval "matchMedia stub"` visual check or manual browser check. Commit `feat(overture): The Gap cinematic opening`

### Task 12: Time Machine data + engine

**Files:**
- Create: `src/utils/timeMachineData.js`, `tests/timeMachine.test.js`, `src/components/TimeMachine.jsx` (engine half)
- Modify: `src/store.js`, `src/sceneRefs.js`, `src/App.jsx` (mount)

**Interfaces:**
- Produces: `buildTimeMachineData(diseases)` → `{ nYears, yearStart, radii: Float32Array(nYears*count), maxYearly, moversFor(yearIdx) }` (radiusAt via `radii[y*count+i]`). `sceneRefs.tm = { active: false, yearFloat: nYears-1, data, radiusAt(i) }` where `radiusAt` lerps between floor/ceil year columns by `yearFloat` fraction (consumed by DiseaseNodes Task 9). Store: `tmPhase: 'idle'|'tour'|'scrub'`, `tmCaption` (same shape as overtureCaption), actions `startTimeMachine(auto)` (teardown guards like startRoulette; sets `sceneRefs.tm.active = true`), `stopTimeMachine()`, `setTmPhase`, `setTmCaption`.
- Consumes: `yearStart` field from Task 4 (falls back to 2015 decade cleanly if backfill fell back).

- [ ] **Step 1: Failing tests:** yearly radius normalization `nRY(0) === 0.05` (present but invisible), `nRY(maxYearly) === MXY (18)`; covid radiusAt detonates (2019 radius < 1, 2020 radius > 12); moversFor(2020 index) top mover is covid-19 with delta `+94,344`-consistent value from data (assert `movers[0].id === 'covid-19'` and `movers[0].delta === covid.yearlyPapers[idx2020] - covid.yearlyPapers[idx2019]`); RHD max radius over all years < 2.5 (the flatline).
- [ ] **Step 2: Implement** `nRY(c, maxYearly) = c <= 0 ? 0.05 : 0.25 + Math.pow(c / maxYearly, 0.5) * (18 - 0.25)` (yearly counts are a different domain than cumulative papers; 18 keeps the biggest yearly node below cumulative-view giants). Precompute all radii once at module init (153 × 35 floats).
- [ ] **Step 3: TimeMachine.jsx engine half:** null-rendering; owns `sceneRefs.tm`; useFrame: while `tmPhase === 'scrub'`, spring `yearFloat` toward `sceneRefs.tm.targetYear` with 120 ms time-constant critically damped spring (`v += (k*(t-x) - c*v)*dt; x += v*dt` with k, c for damping ratio 1); while `'tour'`, Task 13's script drives it. On `stopTimeMachine`: `sceneRefs.tm.active = false` (DiseaseNodes falls back to morph radii smoothly since matrices rebuild every frame; add a 400 ms radius blend: keep tm.active true while lerping a `tm.exit` 0→1 mixing tm radius toward normal radius, then flip active off).
- [ ] **Step 4: Guards both directions:** `startTimeMachine` refuses while `overtureActive || roulettePhase !== 'idle' || supernovaPhase not in {idle, complete}`; `startRoulette`, `triggerSupernova`, `startOverture`, `setActiveMode` teardown/stop the time machine first (call `stopTimeMachine()` at their top when `tmPhase !== 'idle'`). IdleDrift keeps running during tm (positions still breathe; only radii change). Tests green.
- [ ] **Step 5: Commit** `feat(timemachine): per-year radius engine with analog scrub spring`

### Task 13: TimeRail UI + auto-tour

**Files:**
- Create: `src/components/ui/TimeRail.jsx`
- Modify: `src/components/TimeMachine.jsx` (tour script), `src/components/ui/Header.jsx` (+ mobile menu entry), `src/components/HtmlOverlay.jsx` (mount TimeRail)

Read DIRECTION section 3 in full first (pauses, captions, scrubber feel, growth animation). With the 1990 backfill the tour gains a first act; the pause list becomes: yearStart (rules), 1996 (HIV surge, caption numbers derived from `hiv-aids.yearlyPapers`), 2019 (HIV fade + calm before), 2020 (detonation + shockwave), 2021 (peak), 2024 (cooling + RHD flatline finale). If the decade fallback shipped, use the DIRECTION's original five pauses verbatim.

- [ ] **Step 1: TimeRail.jsx:** full-width-on-mobile / centered 520 px rail above the legend; year detents (one per year, 44 px hit targets); large rolling year numeral above (digits 120 ms roll, reuse Odometer digit column); drag = continuous (`sceneRefs.tm.targetYear = fractional position`), release snaps to nearest detent 180 ms expo.out; flick inertia (velocity → targetYear momentum with friction 0.94/frame); keyboard left/right steps a year; ember dot on the 2020 detent (`#ff4d1a`); detent crossings fire a 1-frame 4 percent brightness pip on the numeral + `audio.play('tick')` (audio lands Task 15; guard `window.__mgAudio?.play`). Hover (desktop) shows movers chip: `moversFor(year)[0]` as `"2020: COVID-19 +{fmtFull(delta)}"`. Renders when `tmPhase !== 'idle'`. Exit button ("✕ Time Machine" top-center mode chip position per DIRECTION section 4) → `stopTimeMachine()`.
- [ ] **Step 2: Tour script (TimeMachine.jsx):** on `startTimeMachine(true)`: camera pulls to overview (`flyTarget` home), then per pause: tween `yearFloat` to the pause year over 650 ms expo.out per year-step (auto-tour transitions per DIRECTION: stagger handled implicitly by radius deltas), hold per the board (3.0/3.5/3.0/4.0/3.0/4.5 s), set `tmCaption` with derived numbers. 2020 event: single shockwave ring reusing the SelectionRipple mechanism with color `#ff4d1a` from covid's position (add an exported `fireRipple(idx, color)` helper to SelectionRipple.jsx following its existing trigger pattern, sceneCore/shadersPostfx notes) + camera micro push-in + the tour's only overshoot back.out(1.2). Finale: dim all but RHD to 40 percent via a `tmFocusIdx` store field consumed in HighlightSystem (add one branch alongside its roulette dimming, stateModes/sceneCore item 4 table) + caption with RHD best year (`Math.max(...yearlyPapers)`), toll, and the DERIVED decade-sum line only if viewport >= 700 px tall. Any input during tour → hand over scrubber at current year (`tmPhase: 'scrub'`, rail pulses once, chip "Scrub the decades"). Tour auto-runs ONCE 1.5 s after overture release (`overtureDone && !tourRan` in OvertureSequence's finish or a subscription in TimeMachine; ref-guard `tourRan`).
- [ ] **Step 3: Header:** desktop button `Time Machine` (btnStyle, before Spotlight; active state `✕ Time Machine` amber like Spotlight) → `tmPhase === 'idle' ? startTimeMachine(false) : stopTimeMachine()` (manual start goes straight to scrub at 2024 with rail visible). Mobile menu: same entry under Analysis (uiShell.md section 3 mobile list).
- [ ] **Step 4: Verify (harness):** start tour via `--eval "window._store.getState().startTimeMachine(true)||true"`, shots at pauses (`--shot tm-hiv`, `--shot tm-2020` catching the shockwave, `--shot tm-finale` showing the RHD isolation). Scrub check: `--eval` set `tmPhase:'scrub'` + drive `sceneRefs.tm.targetYear` (expose `window.__tm = sceneRefs.tm` dev hook next to `__fx`); confirm radii track. FPS >= 55 during year transitions. Commit `feat(timemachine): rail scrubber + history-of-attention auto-tour`

### Task 14: Methodology panel + freshness stamp

**Files:**
- Create: `src/components/ui/MethodologyPanel.jsx`
- Modify: `src/components/ui/Header.jsx` (open button: small `?` icon-button labeled `Methodology`), `src/components/ui/Legend.jsx`, `src/components/HtmlOverlay.jsx` (mount)

- [ ] **Step 1: MethodologyPanel.jsx:** glass modal (Sidebar visual language, uiShell.md section 4 constants), scrollable, Escape/backdrop closes, zIndex 60. Content sections (write the full copy in the component, sourced from reference/whoData.json `notes` and dataPipeline.md; no em dashes):
  1. **What the numbers are.** Papers = PubMed query counts by publication date (name the query form + the SEARCH_OVERRIDES honesty: exact term per disease is visible via its sidebar PubMed link). Deaths = per-disease sources with year labels (render a small table of the non-default `mortalitySource` entries straight from diseases.json fields, plus the default GHE 2021 line).
  2. **Known caveats, stated plainly.** Verbatim-adapt from whoData notes: sepsis overlap (never sum rows), pneumonia = WHO lower respiratory infections, rotavirus/norovirus are diarrhoeal subsets, heart disease = ischaemic only, Alzheimer's includes other dementias, diabetes = all diabetes direct deaths, mixed vintages disclosed, COVID-19 and Ebola year-labeling (episodic).
  3. **Connections.** Co-occurrence: `sharedPapers / sqrt(papersA * papersB)` (processData, dataPipeline.md), top-7 per node drive layout, all 736 shown faint.
  4. **The pipeline.** Weekly GitHub Action re-queries PubMed every Monday; mortality never auto-updates; 1990-2024 series backfilled once (or decade note per Task 4 outcome).
  5. **Size mapping.** Power-law (exponent 0.5) between floor and max, unclamped at the top as of this edition.
  6. **Sound** (if Task 15 ships): all audio synthesized at runtime, no recordings.
- [ ] **Step 2: Legend.jsx:** replace the static data line with `` `Data: PubMed, refreshed weekly (latest: ${meta.pubmedLastRefresh}) · WHO GHE 2021 and per-disease sources · Project by Russell J. Young` `` importing `data/meta.json`.
- [ ] **Step 3: Verify** panel opens/closes on desktop + mobile widths, copy renders, no em dashes anywhere (`grep -n "—" src/components/ui/MethodologyPanel.jsx` returns nothing). Commit `feat(credibility): methodology panel + freshness stamp`

### Task 15: Sound design (opt-in synth)

**Files:**
- Create: `src/audio/engine.js`
- Modify: `src/store.js` (`soundOn: false`, `setSoundOn`), `src/components/ui/Header.jsx` (sound pill), hooks in `OvertureSequence.jsx`, `TimeMachine.jsx`, `SupernovaReveal.jsx`, `GalaxyRoulette.jsx`, `TimeRail.jsx`

Read DIRECTION section 5 (palette, five moments, mix discipline). Muted by default, session-scoped, first un-mute click primes the AudioContext.

- [ ] **Step 1: engine.js:** singleton exposing `init()` (creates AudioContext + master limiter/compressor at -6 dB ceiling), `setEnabled(bool)`, `play(name)` with names: `assembly` (granular shimmer bed fade-in, 2-6 kHz filtered noise), `ignition` (300 ms duck-to-silence then 80→45 Hz swell + lowpassed noise bloom), `release` (warm pad swell, consonant), `tmBoom` (muffled distant version of ignition at -10 dB), `reveal` (two-note rising fifth, sine, pitch -minor third when arg `{ overlooked: true }`), `tick` (30 ms 2.2 kHz blip). Ambient drone 40-55 Hz starts on enable, ducks 6 dB under any event for its duration. All synthesized; ~200 lines. Expose `window.__mgAudio = engine` (dev + loose coupling for TimeRail).
- [ ] **Step 2: Header sound pill:** `sound` / `✕ sound` btnStyle toggle → first enable calls `init()` then `setEnabled(true)`.
- [ ] **Step 3: Hook the five moments:** OvertureSequence beat 0 start → `assembly`; odometer flip moment (beat 2, 2.6 s) → `ignition`; release → `release`; tour 2020 → `tmBoom`; supernova burst + roulette reveal → `reveal` (pass `{ overlooked: emberSet.has(idx) }` using igniteWeights ember). TimeRail detents → `tick`. Every call sites guards `engine.enabled`.
- [ ] **Step 4: Manual check** (sound is untestable in the harness): dev server, enable sound, run the film + a roulette. Levels comfortable on laptop speakers, nothing clips. Commit `feat(sound): synthesized score + interaction audio, muted by default`

### Task 16: Motion constitution + inherited-feature binding

**Files:**
- Create: `src/utils/motion.js`
- Modify: `src/components/ui/Sidebar.jsx` (entrance), `src/components/SelectionRipple.jsx` (480 ms standard), `src/components/RouletteDust.jsx` + `src/components/GalaxyRoulette.jsx` (tier `'MID'` → `'MEDIUM'` bug + dust tint), `src/components/SupernovaDust.jsx` (dust tint), `src/components/AttentionMap.jsx` + `src/components/DiseaseNodes.jsx` (dedupe double recolor)

- [ ] **Step 1: motion.js:** `export const DUR = { tick: 120, fast: 180, ui: 240, mid: 320, slow: 480, world: 650 };` `export const EASE = { ui: 'cubic-bezier(0.16,1,0.3,1)', cameraGsap: 'sine.inOut', overshoot: 'back.out(1.2)' };` plus `springStep(x, v, target, dt, tc)` (critically damped, used by TimeMachine + hover). Refactor TimeRail/TimeMachine/Odometer constants to import these.
- [ ] **Step 2: Sidebar entrance:** wrap panel in `transform: translateX(16px)` + fadeIn 280 ms EASE.ui on selectedNode change (key by disease id), per-section 40 ms stagger via animation-delay.
- [ ] **Step 3: Ripple standard:** `RIPPLE_DURATION = 1.0` → `0.48`; verify select feels crisper.
- [ ] **Step 4: Tier bug:** in RouletteDust.jsx (:8,:60,:129) and GalaxyRoulette.jsx (:13-19) replace every `'MID'` comparison with `'MEDIUM'` (currently dead branches; MEDIUM silently gets HIGH particle counts and ring speeds).
- [ ] **Step 5: Dust tint:** SupernovaDust + RouletteDust particle color: `neglectColor(ppd(disease))` (helpers.js) instead of flat `CC[category]` when the target disease's ember weight is 1 (import from igniteWeights), so an overlooked reveal throws ember-red dust (DIRECTION section 4).
- [ ] **Step 6: Recolor dedupe:** AttentionMap currently applies neglect colors twice (hook inside DiseaseNodes AND the standalone component, sceneCore.md item 2). Remove the standalone `<AttentionMap />` from App.jsx and delete its default export, keeping `useAttentionColors`.
- [ ] **Step 7: Verify** roulette on a MEDIUM-width window (resize 1100 px) uses medium speeds; attention map still recolors; ripple 480 ms. Commit `feat(motion): constitution + inherited features bound to the family (tier fix, dust tint, dedupe)`

### Task 17: Mobile + reduced-motion pass

**Files:**
- Modify: `src/components/OvertureSequence.jsx`, `src/components/HighlightSystem.jsx` (LOW ignite path), `src/components/ui/{TimeRail,OvertureCaption,HintChips,LandingOverlay}.jsx` as found

- [ ] **Step 1: LOW-tier ignite:** Phong has no per-instance emissive; during overture beat 2 on LOW, drive instanceColor instead: lerp ignited nodes' colors toward `#ff4d1a` by `fx.ignite * aIgnite[i]`, non-ignited toward graphite by `fx.desat` (one rAF-driven recolor pass in HighlightSystem following its existing write pattern at :142, active only when `overtureActive && TIER === 'LOW'`; restore colors at release via its normal recolor).
- [ ] **Step 2: Sweep at 375 px (harness `page.setViewport({width:375,height:812,isMobile:true,hasTouch:true})`, add a `--mobile` flag to verify.mjs):** landing copy, film captions legible (bottom-sheet position per uiShell caption pattern), skip pill reachable, TimeRail full-width 44 px targets, hint chips fit, methodology panel scrolls, header Time Machine entry in menu. Screenshot each (`--shot mob-beat2` etc.).
- [ ] **Step 3: Reduced-motion end-to-end:** emulate via harness `page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])`; confirm dissolve variant plays with captions intact, tour becomes stepped year holds (no springs), nothing autoplays motion. Fix what fails.
- [ ] **Step 4: Commit** `fix(mobile): LOW-tier ignite via instance colors + full phone and reduced-motion pass`

### Task 18: OG image + meta polish

**Files:**
- Modify: `public/og-image.jpg`, `index.html` (description strings only)

- [ ] **Step 1:** Harness-capture the beat-2 ignite frame at 2400x1260 (`page.setViewport({width:1200,height:630,deviceScaleFactor:2})`, drive `window.__fx` desat 1 ignite 1, hide UI chrome via `uiRevealed` false), export JPEG quality 85 to `public/og-image.jpg` (keep under 300 KB).
- [ ] **Step 2:** index.html: update the two description metas to mention the opening + Time Machine (keep title, keywords, canonical, JSON-LD untouched; the showcase may replace production later so URLs stay).
- [ ] **Step 3: Commit** `feat(meta): ignite-frame OG image + updated descriptions`

### Task 19: Performance gate

**Files:**
- Test: harness runs; fixes wherever found

- [ ] **Step 1: FPS matrix via harness:** HIGH 1440x900 at rest, during beat 2, during tour year-transition, during roulette spinup: all >= 55 (target 60). MEDIUM (1100 px): >= 50. LOW (375 mobile emulation): >= 40 at rest, film watchable.
- [ ] **Step 2: Cold load:** `page.metrics()` + Performance API: `domContentLoaded` to first galaxy frame under 3 s with CPU throttling 4x + Fast 3G network emulation (approximates the mid-tier phone bar in DIRECTION 9/10 item 10).
- [ ] **Step 3: Known knobs if over budget** (apply in order, re-measure): AdaptiveDpr MOTION_DPR already 1; bloom levels 7 → 5 on HIGH; DoF res scale 0.667 → 0.5 during overture only; plasma `fbm` octaves stay 2 (do not raise); sphere segments stay 32.
- [ ] **Step 4: Commit** `perf: verified 60fps HIGH / tier budgets met` (include the measured numbers in the commit body).

### Task 20: Review gate (9/10 or iterate)

Run the adversarial review workflow (Workflow tool) from the orchestrating session, not a subagent. Rubric per the spec (docs/superpowers/specs/2026-08-11-medgalaxy-next-showcase-design.md): five dimensions weighted equally, minimum overall 9.0:

1. First-30-seconds impact, unguided (reviewer sees timed screenshots of the film + can drive the dev server via harness).
2. Sustained expert depth: reviewer spot-checks AT LEAST 10 diseases' displayed numbers against PubMed/WHO primary sources via web, including at least 3 flagged ones (sepsis, covid-19, ebola) whose methodology disclosures must satisfy a skeptical epidemiologist.
3. Visual + motion craft vs DIRECTION (bloom discipline: capture a rest frame and assert no LDR bloom).
4. Performance evidence from Task 19.
5. Story clarity: would a stranger retell the thesis correctly (reviewer writes the one-sentence retell).

- [ ] **Step 1:** Run review workflow (3 independent reviewers + 1 synthesizer scoring; refute-oriented prompts).
- [ ] **Step 2:** For every finding: fix, or document why not (spec conflict only). Re-run scoring until >= 9.0.
- [ ] **Step 3:** Final commit `docs: review gate passed at N.N/10` with the scorecard in `docs/verify/scorecard.md` (this one file in docs/verify IS committed).
- [ ] **Step 4:** Update project memory (medgalaxy-project.md): showcase complete, how to run, review score, deploy decision still pending with user.

---

## Self-review checklist (author ran this)

- Spec coverage: opening (T10-11), Time Machine (T12-13), superset regression guard (T16 keeps all features; T6 upgrades captions in place), credibility layer (T3,4,6,14), tech mandate (T7 stack decision recorded, research-gated WebGPU declined per reference/stackResearch.md, NIH funding cut per reference/nihFunding.json coverage 46.4%), sound (T15), unguided polish (T10 hints, T18 OG), mobile (T17), perf (T19), review gate >= 9 (T20). Spec's "30 years" corrected to verified 1990-2024 backfill with explicit decade fallback (T4).
- Type consistency: `sceneRefs.fx` shape identical in T8/T9/T11; `overtureCaption`/`tmCaption` shape shared T10/T11/T13; `startTimeMachine(auto)` consistent T12/T13; ember set from igniteWeights reused T15/T16.
- No placeholders: every step names files, values, and either code or the exact reference doc section carrying the verbatim current code.
