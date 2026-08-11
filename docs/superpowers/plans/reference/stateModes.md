# MedGalaxy State & Modes Map

Repo: `/Users/darwin/Documents/Claude/medgalaxy-next` — zustand store + headless "engine" components mutating a shared `curPos` position array; captions rendered by dedicated UI components reading store fields.

## 1. Store — full API (`src/store.js`, 294 lines)

Created with `create(subscribeWithSelector(...))` (src/store.js:17-18). Module-level data prep at src/store.js:9-14: `processData(diseasesData, connectionsData)` → `{ diseases, layoutEdges, displayEdges, neighbors, connCounts, idMap }`; `computeLayouts(diseases, layoutEdges)` → `{ catPos, netPos, rawMax }`; `curPos = catPos.map(p => [...p])` (mutable copy, src/store.js:14). Store exposed globally: `window._store = useStore` (src/store.js:292).

### State fields with initial values (src/store.js:19-85)

| Field | Initial | Notes / line |
|---|---|---|
| `diseases`, `displayEdges`, `neighbors`, `connCounts`, `idMap` | processed data | src/store.js:20-24 |
| `catPos`, `netPos`, `curPos`, `rawMax` | computed layouts | src/store.js:27-30 |
| `layoutMode` | `'category'` | src/store.js:31 |
| `selectedNode` | `null` | `{index, disease}` when set; src/store.js:34 |
| `hoveredNode` | `null` | src/store.js:35 |
| `activeMode` | `null` | comment: `null \| 'explode' \| 'connections' \| 'velocity' \| 'attention'`; src/store.js:38 |
| `storyActive` | `null` | chipId string; src/store.js:41 |
| `storyStep` | `0` | src/store.js:42 |
| `storyCaption` | `''` | src/store.js:43 |
| `storyVisible` | `true` | src/store.js:44 |
| `connFocusIdx` | `-1` | src/store.js:47 |
| `sizeMode` | `'papers'` | src/store.js:50 |
| `shaderMode` | `'plasma'` | `'plasma' \| 'pulse'`; src/store.js:51 |
| `activeCats` | `new Set(CATS)` | src/store.js:52 |
| `searchQuery` | `''` | src/store.js:53 |
| `neglectMode` | `false` | src/store.js:56 |
| `spotlightActive` | `false` | src/store.js:57 |
| `spotlightCaption` | `''` | src/store.js:58 |
| `roulettePhase` | `'idle'` | `'idle' \| 'assembling' \| 'spinup' \| 'reveal'`; src/store.js:61 |
| `rouletteWinner` | `null` | src/store.js:62 |
| `rouletteEligible` | `[]` | src/store.js:63 |
| `rouletteRingNodes` | `[]` | src/store.js:64 |
| `rouletteCaption` | `''` | src/store.js:65 |
| `_rouletteSnapshot` | `null` | src/store.js:66 |
| `supernovaPhase` | `'idle'` | `'idle' \| 'prefocus' \| 'charge' \| 'burst' \| 'linkwave' \| 'settle' \| 'complete'`; src/store.js:69 |
| `supernovaTargetIdx` | `-1` | src/store.js:70 |
| `supernovaNeighborBatches` | `[]` | `[[idx,...],[idx,...],[idx,...]]` cached at trigger time; src/store.js:71 |
| `supernovaRevealedLinks` | `[]` | flat idx array, updated per-batch; src/store.js:72 |
| `supernovaStartTime` | `0` | src/store.js:73 |
| `supernovaCaption` | `''` | src/store.js:74 |
| `meshRef` | `null` | src/store.js:77 |
| `introStarted` | `false` | src/store.js:80 |
| `introPhase` | `0` | 0=dark…5=done; src/store.js:81 |
| `introProgress` | `0` | src/store.js:82 |
| `flyTarget` | `null` | src/store.js:85 |

### Actions

Simple setters (src/store.js:118-153, 273-275): `setSizeMode(mode)`, `setShaderMode(mode)`, `setSearchQuery(q)`, `setActiveCats(cats)`, `setActiveMode(mode)`, `setNeglectMode(v)`, `setStoryVisible(v)`, `setStoryCaption(v)`, `setConnFocusIdx(v)`, `setSpotlightActive(v)`, `setSpotlightCaption(v)`, `setMeshRef(ref)`, `setFlyTarget(v)`, `setCurPos(v)`, `setStoryActive(v)`, `setStoryStep(v)`, `setIntroStarted()`, `setIntroPhase(v)`, `setIntroProgress(v)`, `skipIntro()`, `setRoulettePhase(v)`, `setRouletteWinner(v)`, `setRouletteCaption(v)`, `setSupernovaPhase(v)`, `setSupernovaRevealedLinks(v)`, `setSupernovaCaption(v)`.

Compound actions, verbatim:

```js
// src/store.js:88-116
    selectDisease: (idx) => {
      const { diseases: ds, catPos: cp2 } = get();
      if (idx == null || idx < 0 || idx >= ds.length) return;
      const pos = cp2[idx];
      // Consistent zoom: camera stops at nodeRadius * multiplier from center
      const nodeRadius = nR(ds[idx].papers);
      const zoomDist = nodeRadius * (isMob() ? 12.0 : 5.0);
      set({
        selectedNode: { index: idx, disease: ds[idx] },
        flyTarget: { position: [pos[0], pos[1], pos[2]], radius: zoomDist },
      });
    },

    deselect: () => {
      set({
        selectedNode: null,
        flyTarget: { position: [0, 0, 0], radius: null }, // null radius = default
      });
    },

    setHovered: (idx) => {
      if (idx == null || idx < 0) {
        set({ hoveredNode: null });
        return;
      }
      const ds = get().diseases;
      if (idx >= ds.length) return;
      set({ hoveredNode: { index: idx, disease: ds[idx] } });
    },
```

```js
// src/store.js:122-131
    toggleCat: (cat) => {
      const prev = get().activeCats;
      if (cat === 'ALL') {
        set({ activeCats: prev.size === CATS.length ? new Set() : new Set(CATS) });
        return;
      }
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      set({ activeCats: next });
    },
```

```js
// src/store.js:155-194
    startRoulette: () => {
      const { diseases: ds, activeCats, searchQuery, spotlightActive, storyActive,
              storyVisible, selectedNode } = get();
      const sq = searchQuery.toLowerCase();
      const eligible = [];
      for (let i = 0; i < ds.length; i++) {
        if (!activeCats.has(ds[i].category)) continue;
        if (sq && !ds[i].label.toLowerCase().includes(sq)) continue;
        eligible.push(i);
      }
      if (eligible.length < 6) return;
      // Snapshot pre-roulette state for restore
      const snapshot = { spotlightActive, storyActive, storyVisible, selectedNode };
      set({
        roulettePhase: 'assembling',
        rouletteWinner: null,
        rouletteEligible: eligible,
        rouletteCaption: '',
        _rouletteSnapshot: snapshot,
        spotlightActive: false,
        spotlightCaption: '',
        storyVisible: false,
      });
      if (storyActive) {
        set({ storyActive: null, storyCaption: '', storyStep: 0 });
      }
    },

    stopRoulette: () => {
      const snapshot = get()._rouletteSnapshot;
      set({
        roulettePhase: 'idle',
        rouletteWinner: null,
        rouletteEligible: [],
        rouletteRingNodes: [],
        rouletteCaption: '',
        _rouletteSnapshot: null,
        storyVisible: snapshot ? snapshot.storyVisible : true,
      });
    },
```

```js
// src/store.js:196-271
    triggerSupernova: (idx, opts) => {
      const s = get();
      // Allow re-trigger from 'complete' (e.g. story advancing to next supernova step)
      if (s.supernovaPhase !== 'idle' && s.supernovaPhase !== 'complete') return;
      if (idx == null || idx < 0 || idx >= s.diseases.length) return;

      const keepStory = opts && opts.keepStory;

      // Pause conflicting systems
      if (s.spotlightActive) {
        set({ spotlightActive: false, spotlightCaption: '' });
      }
      if (s.storyActive && !keepStory) {
        set({ storyActive: null, storyCaption: '', storyStep: 0 });
      }
      if (s.roulettePhase !== 'idle') {
        s.stopRoulette();
      }

      // Cache ranked neighbor batches at trigger time
      const { displayEdges, diseases } = s;
      const neighbors = [];
      for (let i = 0; i < displayEdges.length; i++) {
        const e = displayEdges[i];
        let nIdx;
        if (e.si === idx) nIdx = e.ti;
        else if (e.ti === idx) nIdx = e.si;
        else continue;
        if (nIdx === idx) continue;
        neighbors.push({ idx: nIdx, score: e.score || e.sharedPapers });
      }
      neighbors.sort((a, b) => b.score - a.score);

      // Tier-based cap
      const tierCap = typeof window !== 'undefined' && window.innerWidth < 768 ? 7 : 12;
      const top = neighbors.slice(0, tierCap);

      // Split into 3 ranked batches
      const batches = [];
      const b1 = Math.min(3, top.length);
      const b2 = Math.min(b1 + 3, top.length);
      if (b1 > 0) batches.push(top.slice(0, b1).map(n => n.idx));
      if (b2 > b1) batches.push(top.slice(b1, b2).map(n => n.idx));
      if (top.length > b2) batches.push(top.slice(b2).map(n => n.idx));

      set({
        supernovaPhase: 'prefocus',
        supernovaTargetIdx: idx,
        supernovaNeighborBatches: batches,
        supernovaRevealedLinks: [],
        supernovaStartTime: 0, // will be set on first frame
        supernovaCaption: diseases[idx].label,
      });
    },

    cancelSupernova: () => {
      const s = get();
      if (s.supernovaPhase === 'idle' || s.supernovaPhase === 'complete') return;
      // Jump straight to settle if mid-sequence, or just reset if already settling
      if (s.supernovaPhase === 'settle') {
        set({
          supernovaPhase: 'complete',
          supernovaCaption: '',
        });
      } else {
        // Select the disease normally so user has the panel, then clean up
        const idx = s.supernovaTargetIdx;
        if (idx >= 0) s.selectDisease(idx);
        set({
          supernovaPhase: 'complete',
          supernovaRevealedLinks: [],
          supernovaNeighborBatches: [],
          supernovaCaption: '',
        });
      }
    },
```

```js
// src/store.js:277-287
    connFocusSelect: (diseaseId) => {
      const { idMap: im, diseases: ds, neighbors: nb, curPos: cp, sizeMode: sm } = get();
      const idx = im[diseaseId];
      if (idx === undefined) return;

      set({
        connFocusIdx: idx,
        activeMode: 'connections',
        selectedNode: { index: idx, disease: ds[idx] },
      });
    },
```

## 2. Story data structure (`src/components/StoryEngine.jsx`)

Sequences keyed by chipId; steps are `{ id, supernova: true, caption }` or terminal `{ caption }` only. All hardcoded captions verbatim:

```js
// src/components/StoryEngine.jsx:5-46
function buildSequences(idMap) {
  const find = (id) => idMap[id];
  return {
    researched: [
      { id: find('breast-cancer'), supernova: true, caption: 'Breast Cancer\n430,000 published papers' },
      { id: find('lung-cancer'), supernova: true, caption: 'Lung Cancer\n350,000 published papers' },
      { id: find('type-2-diabetes'), supernova: true, caption: 'Type 2 Diabetes\n380,000 published papers' },
      { caption: 'Over 1 million papers combined.\nScience is paying attention here.' },
    ],
    killers: [
      { id: find('heart-disease'), supernova: true, caption: 'Heart Disease\n9.1 million deaths every year' },
      { id: find('stroke'), supernova: true, caption: 'Stroke\n7.3 million deaths every year' },
      { id: find('copd'), supernova: true, caption: 'COPD\n3.5 million deaths every year' },
      { caption: 'Together, nearly 20 million lives lost annually.' },
    ],
    forgotten: [
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus\n200,000 children die yearly — research down 4%' },
      { id: find('tetanus'), supernova: true, caption: 'Tetanus\n35,000 deaths yearly — research down 3%' },
      { id: find('hepatitis-c'), supernova: true, caption: 'Hepatitis C\n242,000 deaths yearly — research down 2%' },
      { caption: '470,000+ deaths a year.\nAnd the world is looking away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease\n373,000 deaths — only 9,000 papers' },
      { id: find('norovirus'), supernova: true, caption: 'Norovirus\n200,000 deaths — only 12,000 papers' },
      { id: find('pertussis'), supernova: true, caption: 'Pertussis\n160,000 deaths — only 14,000 papers' },
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus\n200,000 child deaths — research declining' },
      { caption: '930,000+ people die every year.\nAlmost no one is studying why.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis\n48 papers per death — wealthy nations' },
      { id: find('multiple-sclerosis'), supernova: true, caption: 'Multiple Sclerosis\n16 papers per death — wealthy nations' },
      { id: find('tuberculosis'), supernova: true, caption: 'Tuberculosis\n0.09 papers per death — 1.25M die yearly' },
      { id: find('malaria'), supernova: true, caption: 'Malaria\n0.16 papers per death — 608,000 die yearly' },
      { caption: 'Where you are born decides\nhow much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis\n48,000 papers for 1,000 deaths' },
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease\n9,000 papers for 373,000 deaths' },
      { caption: 'A 2,000x research gap.\nNow toggle Mortality at the top of the page.' },
    ],
  };
}
```

Chip IDs/labels driving these (src/components/ui/StoryChips.jsx:5-12):

```js
// src/components/ui/StoryChips.jsx:5-12
const chips = [
  { id: 'researched', label: 'Most Researched', desc: 'See the biggest research spheres' },
  { id: 'killers', label: 'Biggest Killers', desc: 'Diseases with highest mortality' },
  { id: 'forgotten', label: 'Forgotten Diseases', desc: 'Declining research, rising deaths' },
  { id: 'silent', label: 'Silent Killers', desc: 'High mortality, minimal attention' },
  { id: 'richpoor', label: 'Rich vs Poor', desc: 'Who gets the research?' },
  { id: 'mismatch', label: 'See the Mismatch', desc: 'The 2,000:1 research gap' },
];
```

### Story engine mechanics

- `StoryEngine` renders null; keeps `stateRef = { seq: null, step: 0 }` (src/components/StoryEngine.jsx:90).
- Subscribes to `storyActive` (src/components/StoryEngine.jsx:94-119): on chipId set, clears `storyCaption`, builds `sequences[chipId]`, sets `{ storyStep: 0, storyVisible: false }`, calls `showStep`.
- Subscribes to `storyStep` (src/components/StoryEngine.jsx:122-133): advances only when `step > sr.step`.
- `showStep` (src/components/StoryEngine.jsx:48-87): per step sets `setStoryCaption(s.caption || '')`; if `s.supernova` → `triggerSupernova(s.id, { keepStory: true })`; else `selectDisease(s.id)` then re-sets flyTarget with `duration: 2.0`. End-of-sequence teardown verbatim:

```js
// src/components/StoryEngine.jsx:50-68
  if (!seq || sr.step >= seq.length) {
    // Done: cinematic exit — clear caption and pull back immediately
    useStore.getState().setStoryCaption('');
    sr.seq = null;
    sr.step = 0;

    // Slow pull-back to default view — also clean up supernova dust
    useStore.setState({ selectedNode: null, supernovaTargetIdx: -1 });
    useStore.getState().setFlyTarget({
      position: [0, 0, 0],
      radius: null,
      duration: 3.0,
    });

    // Restore story chips after camera has settled
    setTimeout(() => {
      useStore.setState({ storyActive: null, storyStep: 0, storyVisible: true });
    }, 2800);
    return;
  }
```

- Escape-key exit lives in the caption UI, duplicating teardown with shorter timings:

```js
// src/components/ui/StoryCaption.jsx:5-12
function endStory() {
  useStore.getState().setStoryCaption('');
  useStore.setState({ selectedNode: null, supernovaTargetIdx: -1 });
  useStore.getState().setFlyTarget({ position: [0, 0, 0], radius: null, duration: 2.0 });
  setTimeout(() => {
    useStore.setState({ storyActive: null, storyStep: 0, storyVisible: true });
  }, 1800);
}
```

- Advancement: caption click calls `setStoryStep(storyStep + 1)`, blocked while `supernovaPhase` not in `{'idle','complete'}` (src/components/ui/StoryCaption.jsx:48-53); footer text is `'revealing connections\u2026'` vs `` `${mob ? 'tap' : 'click'} to continue \u00b7 esc to exit` `` (src/components/ui/StoryCaption.jsx:79).

## 3. Spotlight caption list verbatim (`src/components/Spotlight.jsx`)

```js
// src/components/Spotlight.jsx:5-50
function buildSpotlightList(idMap) {
  const find = (id) => idMap[id];
  const list = [
    // Most researched
    { id: find('breast-cancer'), caption: 'Breast Cancer \u00b7 430K papers \u00b7 Most researched cancer' },
    { id: find('heart-disease'), caption: 'Heart Disease \u00b7 9.1M deaths/yr \u00b7 #1 killer globally' },
    { id: find('type-2-diabetes'), caption: 'Type 2 Diabetes \u00b7 380K papers \u00b7 1.6M deaths/yr' },
    { id: find('hiv-aids'), caption: 'HIV/AIDS \u00b7 350K papers \u00b7 Reshaped modern medicine' },
    { id: find('lung-cancer'), caption: 'Lung Cancer \u00b7 1.8M deaths/yr \u00b7 Deadliest cancer' },
    // Most deadly
    { id: find('sepsis'), caption: 'Sepsis \u00b7 11M deaths/yr but only 95K papers \u00b7 115 deaths per paper' },
    { id: find('stroke'), caption: 'Stroke \u00b7 7.3M deaths/yr \u00b7 Every 3 seconds someone has one' },
    { id: find('copd'), caption: 'COPD \u00b7 3.5M deaths/yr \u00b7 41 deaths per paper published' },
    { id: find('pneumonia'), caption: 'Pneumonia \u00b7 2.2M deaths/yr \u00b7 Leading killer of children' },
    { id: find('alzheimers-disease'), caption: "Alzheimer's \u00b7 1.9M deaths/yr \u00b7 Research surging +6%" },
    // Most neglected
    { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease \u00b7 373K deaths, only 9K papers \u00b7 41 deaths per paper' },
    { id: find('norovirus'), caption: "Norovirus \u00b7 200K deaths/yr \u00b7 World's most common stomach bug" },
    { id: find('sickle-cell-disease'), caption: 'Sickle Cell \u00b7 376K deaths/yr \u00b7 Most common genetic disease in Africa' },
    { id: find('hepatitis-b'), caption: 'Hepatitis B \u00b7 1.1M deaths/yr \u00b7 15 deaths for every paper' },
    // Most researched per death
    { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis \u00b7 48 papers per death \u00b7 Most researched per capita' },
    { id: find('ebola'), caption: 'Ebola \u00b7 40 papers per death \u00b7 Fear drives funding' },
    { id: find('west-nile-virus'), caption: 'West Nile Virus \u00b7 45 papers per death \u00b7 Heavily studied, rarely fatal' },
    // Trending
    { id: find('nafld'), caption: 'Fatty Liver Disease \u00b7 Research up 15% \u00b7 Fastest growing liver disease' },
    { id: find('myocarditis'), caption: 'Myocarditis \u00b7 Research up 10% \u00b7 Heart inflammation gaining attention' },
    { id: find('dengue'), caption: 'Dengue \u00b7 Research up 12% \u00b7 Half the world at risk' },
    // Declining research
    { id: find('covid-19'), caption: 'COVID-19 \u00b7 300K papers \u00b7 Research declining 10% as pandemic fades' },
    { id: find('rotavirus'), caption: 'Rotavirus \u00b7 200K child deaths/yr \u00b7 Research declining despite mortality' },
    // Zero mortality, high impact
    { id: find('depression'), caption: 'Depression \u00b7 280K papers \u00b7 Zero mortality metric, massive burden' },
    { id: find('obesity'), caption: 'Obesity \u00b7 200K papers \u00b7 Affects 1 billion people worldwide' },
    // Unique story
    { id: find('malaria'), caption: 'Malaria \u00b7 608K deaths/yr \u00b7 94% of deaths in Africa' },
  ].filter((s) => s.id !== undefined);

  // Shuffle
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
}
```

Runtime: subscribes to `spotlightActive`; bails if `roulettePhase !== 'idle'` (src/components/Spotlight.jsx:60). On activate: shuffled list, shows first immediately via `setSpotlightCaption(list[0].caption)` + `selectDisease(list[0].id)`, then `setInterval` cycling every 6000 ms (src/components/Spotlight.jsx:62-81). On deactivate: `clearInterval`, `setSpotlightCaption('')`, `deselect()`, resets list/step (src/components/Spotlight.jsx:82-92).

## 4. GalaxyRoulette phase machine (`src/components/GalaxyRoulette.jsx`)

Phases: `'idle' → 'assembling' → 'spinup' → 'reveal'` (store-driven; the component detects phase changes in `useFrame` at src/components/GalaxyRoulette.jsx:91-95 and ticks the current phase at 101-103).

- **Entry**: `startRoulette()` (store) filters eligible by `activeCats` + `searchQuery`, requires >= 6, snapshots `{ spotlightActive, storyActive, storyVisible, selectedNode }` into `_rouletteSnapshot`, kills spotlight/story (src/store.js:155-181). Triggered from the `'Galaxy Roulette'` chip; button text is `'Spinning...'` while active (src/components/ui/StoryChips.jsx:84-97).
- **assembling** (src/components/GalaxyRoulette.jsx:117-219): kills tweens incl. `gsap.killTweensOf(curPos[idx])` for eligible nodes; shuffles pool, caps to `TOTAL_CAP = MAX_PER_RING * 3` (`MAX_PER_RING`: LOW 10 / MID 16 / else 20, src/components/GalaxyRoulette.jsx:13-14); sets `rouletteRingNodes`; distributes inner ~28% / middle ~36% / outer ~36%; ring radii `[rm*0.25, rm*0.45, rm*0.70]` from `rawMax || 600`; GSAP-tweens ring nodes to ring positions and pushes non-ring nodes outside exclusion radius `ringRadii[2] * 1.3`; `store.deselect()` and camera to `radius: ringRadii[2] * 2.5, duration: 1.0`. Advances after `ASSEMBLE_DUR + 0.1` (src/components/GalaxyRoulette.jsx:262-266).
- **spinup** (src/components/GalaxyRoulette.jsx:221-230, 268-287): kills tweens ("useFrame now owns positions"), camera dolly to `ringRadii[2] * 1.8`; quintic ease-in ramp over `RAMP_DUR` then sustain `SUSTAIN_DUR`; ring speeds `MAX_SPEEDS` (LOW `[9.0,5.5,3.5]` / MID `[13.0,8.5,5.5]` / else `[16.0,11.0,7.0]`, src/components/GalaxyRoulette.jsx:15). At end: `pickWinner` (uniform random from in-ring eligible, sets `rouletteWinner`, src/components/GalaxyRoulette.jsx:337-344) then `roulettePhase: 'reveal'`.
- **reveal** (src/components/GalaxyRoulette.jsx:232-250, 289-326): winner tweened to origin over `REVEAL_TWEEN_DUR`; other rings decelerate over `DECEL_DUR = 0.8`; after `REVEAL_SELECT_DELAY = 0.15`, sets (NOT via `selectDisease` — comment at src/components/GalaxyRoulette.jsx:310-311: it reads mid-tween curPos):

```js
// src/components/GalaxyRoulette.jsx:312-325
  if (!sr.didSelect && elapsed >= REVEAL_SELECT_DELAY) {
    sr.didSelect = true;
    const d = diseases[sr.winnerIdx];
    const baseRadius = nR(d.papers);
    // Clamp focus distance: comfortable framing regardless of node size
    const baseDist = baseRadius * (isMob() ? 12.0 : 8.0) + 20;
    const zoomDist = Math.max(MIN_REVEAL_DIST, Math.min(MAX_REVEAL_DIST, baseDist));

    useStore.setState({
      selectedNode: { index: sr.winnerIdx, disease: d },
      flyTarget: { position: [0, 0, 0], radius: zoomDist },
      rouletteCaption: buildCaption(sr.winnerIdx, diseases),
    });
  }
```

- **Winner caption is runtime-derived, NOT curated** — there are no hardcoded roulette fact strings; the only literal caption fragments are `' papers'`, `' deaths/yr'`, `' papers per death'` joined with `' \u00b7 '`:

```js
// src/components/GalaxyRoulette.jsx:42-59
// ── Winner caption builder ──
function buildCaption(idx, diseases) {
  const d = diseases[idx];
  const parts = [d.label];
  if (d.papers) parts.push(`${fmt(d.papers)} papers`);
  if (d.mortality) parts.push(`${fmt(d.mortality)} deaths/yr`);
  if (d.mortality > 0) {
    const ppd = (d.papers / d.mortality).toFixed(2);
    parts.push(`${ppd} papers per death`);
  }
  return parts.join(' \u00b7 ');
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
```

- **Teardown**: `stopRoulette()` restores only `storyVisible` from `_rouletteSnapshot` (rest of snapshot unused, src/store.js:183-194); component `onEnterIdle` kills tweens and nulls `ringAssignment`/`ringBaseTheta` (src/components/GalaxyRoulette.jsx:252-259). Dismiss path: clicking the reveal caption calls `deselect()` then `stopRoulette()` (src/components/ui/RouletteCaption.jsx:12-15); overlay header literal `'Galaxy Roulette'`, footer `` `${mob ? 'tap' : 'click'} to return to galaxy` `` (src/components/ui/RouletteCaption.jsx:38, 49). Position restore back to layout happens implicitly via IdleDrift lerp once `roulettePhase === 'idle'` (see section 6).

## 5. Supernova trigger API & phase flow

**Signature**: `triggerSupernova(idx, opts)` where `opts = { keepStory?: boolean }` (src/store.js:196-202). Re-triggerable from `'idle'` or `'complete'` only. On trigger: pauses spotlight, clears story unless `keepStory`, stops roulette; caches up to 12 (desktop) / 7 (`window.innerWidth < 768`) top-scored neighbors from `displayEdges` split into 3 ranked batches of 3/3/rest; sets `supernovaPhase: 'prefocus'`, `supernovaCaption: diseases[idx].label` (full excerpt in section 1). `cancelSupernova()` jumps to `'complete'` (from settle) or selects the disease + clears batches (src/store.js:251-271).

**Phase flow** driven by `SupernovaReveal` in `useFrame` (src/components/SupernovaReveal.jsx):

- Durations: `PREFOCUS_MS = 1200`, `CHARGE_MS = 1000`, `BURST_MS = 250`, `LINKWAVE_MS = 1200`, `SETTLE_MS = 800` (src/components/SupernovaReveal.jsx:8-12); `TREMBLE_FRACTION` = 0.12 LOW / 0.25 else (line 15).
- **prefocus** (src/components/SupernovaReveal.jsx:47-82): stores `basePosRef` from `catPos[idx]`; computes elevated (~30°) outward camera, `zoomDist = nR(papers) * 8.0`, sets `flyTarget: { position, cameraPos, duration: 1.8 }`; after 1200 ms → `'charge'`.
- **charge** (src/components/SupernovaReveal.jsx:116-148): layered-sin tremble writes directly into `curPos[idx]`; on end snaps `curPos[idx]` back to base, → `'burst'`.
- **burst** (src/components/SupernovaReveal.jsx:84-90, 151-173): on entry `selectDisease(idx)` unless `storyActive`. On end: if `s.storyActive`, selects and short-circuits `'complete'` → (50 ms setTimeout, guarded on still-`'complete'`) → `'idle'` keeping `supernovaTargetIdx` (dust persists); else → `'linkwave'`.
- **linkwave** (src/components/SupernovaReveal.jsx:176-201): reveals batches every `BATCH_STAGGER = 120` ms by appending to `supernovaRevealedLinks`; at 1200 ms flushes all → `'settle'`.
- **settle** (src/components/SupernovaReveal.jsx:204-232): ensures selection; after 800 ms → `'complete'` + `supernovaCaption: ''`, then 50 ms setTimeout (guard: `cur.supernovaPhase !== 'complete'` → return) resets to `'idle'`; keeps `supernovaTargetIdx` if `storyActive`, else resets it to `-1`.
- **SupernovaDust** (src/components/SupernovaDust.jsx): `PARTICLE_COUNT` 200 HIGH / 100 MEDIUM / 0 (line 9); active when phase not idle/complete OR `storyHold = storyActive && supernovaTargetIdx >= 0` (lines 53-56); opacity 0 during prefocus, target 0.7 otherwise (line 59); per-phase `radiusMult/speedMult`: charge 0.6/1.5, burst 2.5/3.0, settle/linkwave/storyHold 1.5/0.5 (lines 82-92); orbits `catPos[idx]`, color from `CC[diseases[idx].category]` (lines 113-115).
- Console test hook comment: `window._store.getState().triggerSupernova(0)` (src/store.js:291-292).

## 6. Mode teardown / restore patterns

- **ExplodeView** (src/components/ExplodeView.jsx:10-42) and **VelocityMap** (src/components/VelocityMap.jsx:10-41) are identical patterns: `useFrame` no-ops while `roulettePhase !== 'idle'`; on `activeMode` transition kill tweens, and on entering their mode GSAP-tween every `curPos[i]` outward (`factor = 2.5 + Math.random() * 1.5`, jitter ±40). No explicit restore — both carry the comment `// Reverse is handled by IdleDrift's lerp when activeMode becomes null` (src/components/ExplodeView.jsx:41, src/components/VelocityMap.jsx:40).
- **ConnectionsView** (src/components/ConnectionsView.jsx:9-82): subscribes to `connFocusIdx`; guards `roulettePhase !== 'idle'`; when `connFocusIdx >= 0 && activeMode === 'connections'` tweens focus node to origin, neighbors onto a golden-angle sphere (`orbit = 100 + nodeR * 3 + ni * 2`), all others radially out to distance 2500; camera `radius: Math.max(600, 350 + N * 6), duration: 0.9`. Same IdleDrift-restore comment (src/components/ConnectionsView.jsx:74).
- **IdleDrift** (src/components/IdleDrift.jsx:10-38) is the universal position restorer: runs only when `activeMode` is falsy AND `roulettePhase === 'idle'` AND `introPhase >= 5`; lerps every `curPos[i]` (except `gravOwnedNodes`) toward `catPos[i]` plus a small sinusoidal drift with `lerpRate = 1 - Math.pow(0.3, dt)`, blend ramping in at `+1.5 * dt`.
- **Roulette** is the only snapshot-based restore: `_rouletteSnapshot` captured in `startRoulette`, only `storyVisible` read back in `stopRoulette` (src/store.js:167, 192).
- **Story** teardown = the two duplicated blocks in section 2 (StoryEngine `showStep` end-branch with 2800 ms timeout; StoryCaption `endStory` with 1800 ms timeout); both set `{ selectedNode: null, supernovaTargetIdx: -1 }` then restore `{ storyActive: null, storyStep: 0, storyVisible: true }`.
- **Supernova** cleanup happens inside SupernovaReveal's settle/burst end branches and `cancelSupernova` (section 5); story-mode runs deliberately leave `supernovaTargetIdx` set so dust persists until the story advances or ends.

## 7. Store fields the UI reads for captions

| UI component | Store fields read | Render condition | Lines |
|---|---|---|---|
| `StoryCaption` | `storyCaption`, `storyStep`, `supernovaPhase` (+ action `setStoryStep`) | `storyCaption` truthy; splits on `'\n'` (line 0 bold, rest smaller) | src/components/ui/StoryCaption.jsx:15-18, 45, 73-77 |
| `SpotlightCaption` | `spotlightCaption`, `spotlightActive` | both truthy; header literal `'Spotlight'` | src/components/ui/SpotlightCaption.jsx:6-9, 25-26 |
| `RouletteCaption` | `roulettePhase`, `rouletteCaption` | `roulettePhase === 'reveal' && rouletteCaption`; header literal `'Galaxy Roulette'` | src/components/ui/RouletteCaption.jsx:6-9, 38, 44 |
| `SupernovaOverlay` | `supernovaPhase`, `supernovaCaption`, `storyActive` | caption shown only in `'prefocus'`/`'charge'` and `!storyActive`; label literal `'ANALYZING'` (charge) / `'FOCUSING'` (prefocus) | src/components/ui/SupernovaOverlay.jsx:5-12, 34, 53 |

All four are mounted from `src/components/HtmlOverlay.jsx` (RouletteCaption at src/components/HtmlOverlay.jsx:11, 37).