import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';
import { processData, nR, isMob, matchesSearch } from './utils/helpers';
import { computeLayouts } from './utils/layout';
import { CATS } from './utils/constants';
import { sceneRefs } from './sceneRefs';
import { TM_EXIT } from './utils/motion';

const TM_EXIT_TOTAL = TM_EXIT.total;

// ─── Module-level data processing ────────────────────────────────────────────
const processed = processData(diseasesData, connectionsData);
const { diseases, layoutEdges, displayEdges, neighbors, connCounts, idMap } = processed;

const { catPos, netPos, rawMax } = computeLayouts(diseases, layoutEdges);
const curPos = catPos.map(p => [...p]); // mutable copy

// ─── Store ───────────────────────────────────────────────────────────────────
const useStore = create(
  subscribeWithSelector((set, get) => ({
    // ── Processed data ──
    diseases,
    displayEdges,
    neighbors,
    connCounts,
    idMap,

    // ── Layouts ──
    catPos,
    netPos,
    curPos,
    rawMax,
    layoutMode: 'category',

    // ── Selection / hover ──
    selectedNode: null,
    hoveredNode: null,

    // ── Active modes ──
    activeMode: null, // null | 'explode' | 'connections' | 'velocity' | 'attention'

    // ── Story ──
    storyActive: null,
    storyStep: 0,
    storyCaption: '',
    storyVisible: true,

    // ── Connection focus ──
    connFocusIdx: -1,

    // ── Size / filter / shader ──
    sizeMode: 'papers',
    shaderMode: 'plasma', // 'plasma' | 'pulse'
    activeCats: new Set(CATS),
    searchQuery: '',

    // ── Neglect / spotlight ──
    neglectMode: false,
    spotlightActive: false,
    spotlightCaption: '',

    // ── Sound (Task 15; engine lives in src/audio/engine.js) ──
    soundOn: false,

    // ── Methodology panel (credibility layer) ──
    methodologyOpen: false,

    // ── Galaxy Roulette (separate from activeMode to avoid conflicts) ──
    roulettePhase: 'idle', // 'idle' | 'assembling' | 'spinup' | 'reveal'
    rouletteWinner: null,
    rouletteEligible: [],
    rouletteRingNodes: [], // subset actually placed in orbital rings
    rouletteCaption: '',
    _rouletteSnapshot: null, // pre-roulette state for clean restore

    // ── Supernova Reveal ──
    supernovaPhase: 'idle', // 'idle' | 'prefocus' | 'charge' | 'burst' | 'linkwave' | 'settle' | 'complete'
    supernovaTargetIdx: -1,
    supernovaNeighborBatches: [], // [[idx,idx,...], [idx,...], [idx,...]] — cached at trigger time
    supernovaRevealedLinks: [],   // flat array of revealed neighbor indices (updated per-batch)
    supernovaStartTime: 0,
    supernovaCaption: '',

    // ── Refs (non-reactive, shared between components) ──
    meshRef: null,

    // ── Intro ──
    introStarted: false, // true after user clicks landing overlay
    introPhase: 0,     // 0=dark, 1=hero, 2=constellation, 3=galaxy, 4=effects, 5=done
    introProgress: 0,  // continuous 0→1 for smooth interpolation

    // ── The Gap overture (cinematic opening; FSM lives in OvertureSequence) ──
    overtureActive: false,   // true from landing dismissal until the film hands over
    overtureBeat: 0,         // 0=assembly, 1=attention, 2=morph, 3=release
    overtureCaption: null,   // { lines: string[], data?: string, odometer?: {...} }
    overtureDone: false,     // latched once; the film never replays in a session
    uiRevealed: false,       // gates header / filter bar / legend / story chips
    hintsShown: false,
    hintsDismissed: new Set(),
    _overtureSkip: false,    // request flag; the FSM answers with the compressed morph

    // ── Camera ──
    flyTarget: null,

    // ── Time Machine (per-year radius scrub/tour; engine lives in TimeMachine.jsx) ──
    tmPhase: 'idle',  // 'idle' | 'tour' | 'scrub'
    tmCaption: null,  // overtureCaption shape plus one field: { lines: string[], data?: string, micro?: string }
    tmFocusIdx: -1,   // -1 = inactive; >=0 isolates one disease (the tour's flatline finale)
    // Latched the first time a narrated tour is started, by anyone: the film's
    // own auto-tour, the "Try the Time Machine" hint chip, or the header
    // button. The header reads it to decide whether its next press owes the
    // viewer the decade story or just the scrubber (review gate F1c).
    tmTourSeen: false,
    _tmSnapshot: null, // pre-Time-Machine state for a clean restore

    // ── The exit choreography (ADDENDUM 1 section 1) ──
    // The opening sequence ends at the home screen, so the tour's finale is
    // followed by a 2.6 s exit rather than a permanent park. `tmExitAt` is the
    // performance.now() the exit began at; every staged channel (rail out,
    // chrome back, hint row, header pulse) reads its own delay off it through
    // motion.js's exitDelay, which is why it is a timestamp and not a flag.
    // Set at most once per session — only the automatic path runs the
    // choreography; a manual close is just stopTimeMachine.
    tmExitAt: 0,
    tmExitMode: null, // null | 'normal' | 'fast' | 'reduced'
    // The finale's isolation outlives tmFocusIdx by 480 ms so the 152 dimmed
    // diseases ramp back to full color instead of popping on the frame the
    // exit begins. tmFocusIdx still clears at t=0 (everything else keys off
    // it, including the rail's reticle, which leaves with the rail); these two
    // carry the release alone.
    tmIsoIdx: -1,
    tmIsoDim: 1, // 0.4 at the start of the release, 1 when it lands

    // ── Actions ──
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

    setSizeMode: (mode) => set({ sizeMode: mode }),
    setShaderMode: (mode) => set({ shaderMode: mode }),
    setSearchQuery: (q) => set({ searchQuery: q }),

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

    setActiveCats: (cats) => set({ activeCats: cats }),
    setActiveMode: (mode) => {
      const s = get();
      if (s.tmPhase !== 'idle') s.stopTimeMachine();
      set({ activeMode: mode });
    },
    setNeglectMode: (v) => set({ neglectMode: v }),
    setStoryVisible: (v) => set({ storyVisible: v }),
    setStoryCaption: (v) => set({ storyCaption: v }),
    setConnFocusIdx: (v) => set({ connFocusIdx: v }),
    setSpotlightActive: (v) => set({ spotlightActive: v }),
    setSpotlightCaption: (v) => set({ spotlightCaption: v }),
    setSoundOn: (v) => set({ soundOn: v }),
    setMethodologyOpen: (v) => set({ methodologyOpen: v }),
    setMeshRef: (ref) => set({ meshRef: ref }),
    setFlyTarget: (v) => set({ flyTarget: v }),
    setCurPos: (v) => set({ curPos: v }),
    setStoryActive: (v) => set({ storyActive: v }),
    setStoryStep: (v) => set({ storyStep: v }),
    setIntroStarted: () => set({ introStarted: true }),
    setIntroPhase: (v) => set({ introPhase: v }),
    setIntroProgress: (v) => set({ introProgress: v }),
    skipIntro: () => set({ introStarted: true, introPhase: 5, introProgress: 1 }),

    setOvertureBeat: (v) => set({ overtureBeat: v }),
    setOvertureCaption: (v) => set({ overtureCaption: v }),
    setUiRevealed: (v) => set({ uiRevealed: v }),

    hintDismiss: (key) => {
      const prev = get().hintsDismissed;
      if (!key || prev.has(key)) return;
      const next = new Set(prev);
      next.add(key);
      set({ hintsDismissed: next });
    },

    // Opens the film. Tears down anything that could write the scene while it
    // plays, in the same shape startRoulette uses for its own takeover.
    startOverture: () => {
      const s = get();
      if (s.overtureDone || s.overtureActive) return;
      if (s.tmPhase !== 'idle') s.stopTimeMachine();
      if (s.roulettePhase !== 'idle') s.stopRoulette();
      set({
        overtureActive: true,
        overtureBeat: 0,
        overtureCaption: null,
        _overtureSkip: false,
        uiRevealed: false,
        hintsShown: false,
        spotlightActive: false,
        spotlightCaption: '',
        selectedNode: null,
      });
      if (s.storyActive) set({ storyActive: null, storyCaption: '', storyStep: 0 });
    },

    // A request, not a teardown: the FSM reads this and plays the compressed
    // morph so nobody leaves without meeting the thesis.
    skipOverture: () => {
      const s = get();
      if (!s.overtureActive || s._overtureSkip) return;
      set({ _overtureSkip: true });
    },

    finishOverture: () => {
      // Hand the grade back to its resting state: no suppression, no burn, and
      // the standing ember scar left on the overlooked decile.
      sceneRefs.fx.morphOverride = null;
      sceneRefs.fx.ignite = 0;
      sceneRefs.fx.desat = 0;
      sceneRefs.fx.ember = 1;
      sceneRefs.fx.glowSuppress = 0;
      sceneRefs.fx.igniteContrast = 1;
      // Hand the drift back to CameraRig's resting rule, still turning.
      sceneRefs.handover.speed = null;
      set({
        overtureActive: false,
        overtureBeat: 3,
        overtureCaption: null,
        uiRevealed: true,
        hintsShown: true,
        overtureDone: true,
        _overtureSkip: false,
      });
    },

    setRoulettePhase: (v) => set({ roulettePhase: v }),
    setRouletteWinner: (v) => set({ rouletteWinner: v }),
    setRouletteCaption: (v) => set({ rouletteCaption: v }),

    startRoulette: () => {
      const s0 = get();
      if (s0.overtureActive) return;
      if (s0.tmPhase !== 'idle') s0.stopTimeMachine();
      const { diseases: ds, activeCats, searchQuery, spotlightActive, storyActive,
              storyVisible, selectedNode } = get();
      const sq = searchQuery.toLowerCase();
      const eligible = [];
      for (let i = 0; i < ds.length; i++) {
        if (!activeCats.has(ds[i].category)) continue;
        if (!matchesSearch(ds[i], sq)) continue;
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

    triggerSupernova: (idx, opts) => {
      const s = get();
      if (s.overtureActive) return;
      if (s.tmPhase !== 'idle') s.stopTimeMachine();
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

    setSupernovaPhase: (v) => set({ supernovaPhase: v }),
    setSupernovaRevealedLinks: (v) => set({ supernovaRevealedLinks: v }),
    setSupernovaCaption: (v) => set({ supernovaCaption: v }),

    setTmPhase: (v) => set({ tmPhase: v }),
    setTmCaption: (v) => set({ tmCaption: v }),
    setTmFocusIdx: (v) => set({ tmFocusIdx: v }),

    // Takes over node radius from the papers/mortality morph, same teardown
    // shape as startRoulette: refuses while another full-scene takeover (the
    // overture, roulette, or a live supernova) owns the field, and parks the
    // engine at the most recent year every time it starts fresh.
    startTimeMachine: (auto) => {
      const s = get();
      if (s.overtureActive) return;
      if (s.roulettePhase !== 'idle') return;
      if (s.supernovaPhase !== 'idle' && s.supernovaPhase !== 'complete') return;
      const tm = sceneRefs.tm;
      // The one runtime-derived chip re-entry gets: "drag the rail. 1990 to
      // 2024." with both years read off the built table, never transcribed
      // (ADDENDUM 1 section 1, header re-entry). `handover: true` is what
      // gives it the rail's existing 2.6 s self-clearing life.
      let chip = null;
      if (tm) {
        const lastYear = tm.data.nYears - 1;
        tm.active = true;
        tm.exit = 0;
        // The entry blend (ADDENDUM 1 section 1): 0 -> 1 over 650 ms on
        // arrival(), staggered by the same lag factors, so the instrument
        // opens with a blend rather than the hard radius swap that was the one
        // ugly cut left in the piece. The narrated tour keeps the instant
        // seat: it opens on a rewind that owns the radii outright, and the
        // harness's __tour.seek must land a deterministic frame.
        tm.enter = auto ? 1 : 0;
        tm.yearFloat = lastYear;
        tm.targetYear = lastYear;
        if (!auto) {
          const first = tm.data.yearStart;
          const last = tm.data.yearStart + tm.data.nYears - 1;
          chip = { lines: [`drag the rail. ${first} to ${last}.`], handover: true };
        }
      }
      // The rail owns bottom center for as long as it is up, so the story chips
      // stand down (same snapshot/restore shape roulette uses for its takeover),
      // and anything else that drives the camera or the caption slot stands down
      // with them.
      set({
        tmPhase: auto ? 'tour' : 'scrub',
        tmCaption: chip,
        tmFocusIdx: -1,
        tmIsoIdx: -1,
        tmIsoDim: 1,
        tmTourSeen: s.tmTourSeen || !!auto,
        _tmSnapshot: s._tmSnapshot || { storyVisible: s.storyVisible },
        storyVisible: false,
        spotlightActive: false,
        spotlightCaption: '',
        // Same effect as setActiveMode(null): the rail owns bottom center and
        // the node-radius channel, so an active Trends/Connections/Research Gap
        // overlay stands down rather than running underneath it.
        activeMode: null,
      });
      if (s.storyActive) set({ storyActive: null, storyCaption: '', storyStep: 0 });
    },

    // Hands radius back to the normal morph. `sceneRefs.tm.active` stays true
    // a beat longer than `tmPhase` — TimeMachine.jsx ramps `tm.exit` 0->1 over
    // ~400ms so the return to papers/mortality sizing is a blend, not a snap,
    // then flips `active` off itself once the blend completes.
    stopTimeMachine: () => {
      const s = get();
      if (s.tmPhase === 'idle') return;
      const snap = s._tmSnapshot;
      set({
        tmPhase: 'idle',
        tmCaption: null,
        tmFocusIdx: -1,
        tmIsoIdx: -1,
        tmIsoDim: 1,
        _tmSnapshot: null,
        storyVisible: snap ? snap.storyVisible : true,
      });
    },

    // ── The exit choreography's store half (ADDENDUM 1 section 1) ──
    // t = 0.00: everything stopTimeMachine does, with two differences. The
    // finale's isolation moves to tmIsoIdx/tmIsoDim so it can ramp out over
    // 480 ms instead of popping, and storyVisible is held back to the exit's
    // 1.30 s chrome mark rather than restored on this frame. The 2.6 s script
    // itself is driven by TimeMachine.jsx; this is only its opening beat.
    beginTmExit: (mode) => {
      const s = get();
      if (s.tmPhase === 'idle') return;
      set({
        tmPhase: 'idle',
        tmCaption: null,
        tmFocusIdx: -1,
        tmIsoIdx: s.tmFocusIdx,
        tmIsoDim: 0.4, // HighlightSystem's own isolation multiplier
        // _tmSnapshot deliberately survives: it is what tmExitChrome restores
        // storyVisible from at 1.30, and leaving it in place also means a
        // viewer who re-opens the Time Machine mid-exit still has their true
        // pre-Time-Machine chrome state to come back to.
        storyVisible: false,
        tmExitAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        tmExitMode: mode || 'normal',
      });
    },

    setTmIso: (idx, dim) => set({ tmIsoIdx: idx, tmIsoDim: dim }),

    // Skip during the exit: any input fast-forwards to the landed state over
    // 240 ms. Re-seating tmExitAt in the past is what collapses every staged
    // delay exitDelay() computes to zero, so the chrome comes up immediately
    // and the header pulse is cancelled rather than merely hurried.
    tmExitSkip: () => {
      const s = get();
      if (!s.tmExitAt || s.tmExitMode !== 'normal') return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      set({ tmExitMode: 'fast', tmExitAt: now - TM_EXIT_TOTAL });
    },

    // t = 1.30: the story chip row returns. Header, filter bar and legend are
    // already up from the film's release and do not re-animate.
    tmExitChrome: () => {
      const snap = get()._tmSnapshot;
      set({ storyVisible: snap ? snap.storyVisible : true, _tmSnapshot: null });
    },

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
  }))
);

// Expose store for console testing (e.g. window._store.getState().triggerSupernova(0))
if (typeof window !== 'undefined') window._store = useStore;

export default useStore;
