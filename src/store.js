import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';
import { processData, nR, isMob } from './utils/helpers';
import { computeLayouts } from './utils/layout';
import { CATS } from './utils/constants';

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

    // ── Refs (non-reactive, shared between components) ──
    meshRef: null,

    // ── Intro ──
    introStarted: false, // true after user clicks landing overlay
    introPhase: 0,     // 0=dark, 1=hero, 2=constellation, 3=galaxy, 4=effects, 5=done
    introProgress: 0,  // continuous 0→1 for smooth interpolation

    // ── Camera ──
    flyTarget: null,

    // ── Actions ──
    selectDisease: (idx) => {
      const { diseases: ds, curPos: cp, catPos: cp2 } = get();
      if (idx == null || idx < 0 || idx >= ds.length) return;
      const pos = cp[idx] || cp2[idx];
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
    setActiveMode: (mode) => set({ activeMode: mode }),
    setNeglectMode: (v) => set({ neglectMode: v }),
    setStoryVisible: (v) => set({ storyVisible: v }),
    setStoryCaption: (v) => set({ storyCaption: v }),
    setConnFocusIdx: (v) => set({ connFocusIdx: v }),
    setSpotlightActive: (v) => set({ spotlightActive: v }),
    setSpotlightCaption: (v) => set({ spotlightCaption: v }),
    setMeshRef: (ref) => set({ meshRef: ref }),
    setFlyTarget: (v) => set({ flyTarget: v }),
    setCurPos: (v) => set({ curPos: v }),
    setStoryActive: (v) => set({ storyActive: v }),
    setStoryStep: (v) => set({ storyStep: v }),
    setIntroStarted: () => set({ introStarted: true }),
    setIntroPhase: (v) => set({ introPhase: v }),
    setIntroProgress: (v) => set({ introProgress: v }),
    skipIntro: () => set({ introStarted: true, introPhase: 5, introProgress: 1 }),

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

export default useStore;
