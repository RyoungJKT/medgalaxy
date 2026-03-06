# R3F Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite MedGalaxy from a 1400-line raw Three.js monolith to a modular React Three Fiber architecture with full feature parity.

**Architecture:** Decompose `MedGalaxy.jsx` into 12+ focused components. Zustand store replaces 30+ refs. GSAP drives 3D animations (story transitions, explode, fly-to). Framer Motion handles UI transitions. Drei provides OrbitControls, Html overlay. Tailwind CSS replaces all inline styles with glassmorphic design tokens.

**Tech Stack:** React 18, @react-three/fiber, @react-three/drei, @react-three/postprocessing, Three.js r170+, Zustand, GSAP, Framer Motion, Tailwind CSS 4, Vite

**Revert checkpoint:** `git reset --hard checkpoint-pre-experiment`

---

## Task 1: Create Prototype Branch & Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `tailwind.config.js`
- Create: `src/index.css`

**Step 1: Create prototype branch**

```bash
cd /Users/darwin/Documents/Claude/medgalaxy
git checkout -b prototype/r3f-migration
```

**Step 2: Install R3F ecosystem + animation + state + styling**

```bash
npm install three@latest @react-three/fiber @react-three/drei @react-three/postprocessing gsap framer-motion zustand
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Update `vite.config.js` to add Tailwind plugin**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

**Step 4: Create `src/index.css` with Tailwind import + base styles**

```css
@import "tailwindcss";

@theme {
  --font-mono: 'IBM Plex Mono', monospace;
  --color-glass: rgba(10, 16, 30, 0.92);
  --color-glass-border: rgba(255, 255, 255, 0.08);
  --color-glass-hover: rgba(255, 255, 255, 0.04);
}

html, body, #root {
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  font-family: var(--font-mono);
  background: #06080d;
  color: #e2e8f0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: none;
}
```

**Step 5: Update `index.html`** — remove the `<style>` block (now in index.css), keep everything else.

**Step 6: Update `src/main.jsx`** — add `import './index.css'` at the top.

**Step 7: Verify build**

```bash
npm run build
```
Expected: Build succeeds (existing MedGalaxy.jsx still works).

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: install R3F ecosystem, GSAP, Framer Motion, Zustand, Tailwind CSS"
```

---

## Task 2: Create Shared Constants, Utilities & Shaders

Extract all pure functions and constants from `MedGalaxy.jsx` into standalone modules.

**Files:**
- Create: `src/utils/constants.js`
- Create: `src/utils/layout.js`
- Create: `src/utils/tiers.js`
- Create: `src/utils/helpers.js`
- Create: `src/shaders/plasma.vert.glsl`
- Create: `src/shaders/plasma.frag.glsl`

**Step 1: Create `src/utils/constants.js`**

```js
// Category colors — vibrant saturated palette
export const CC = {
  tropical:'#00ff6a', cancer:'#ff3333', cardiovascular:'#ff8c1a',
  neurological:'#b44dff', respiratory:'#3399ff', autoimmune:'#ff3d8e',
  metabolic:'#ffd500', infectious:'#00e6b8', genetic:'#ff5cbf', mental:'#7c3aed',
};

export const CATS = Object.keys(CC);

export const CL = {
  tropical:'Tropical / NTD', cancer:'Cancer', cardiovascular:'Cardiovascular',
  neurological:'Neurological', respiratory:'Respiratory', autoimmune:'Autoimmune',
  metabolic:'Metabolic', infectious:'Infectious', genetic:'Genetic', mental:'Mental Health',
};

// Node sizing constants
export const MN = 0.3;
export const MX = 55;
export const MAX_PAPERS = 450000;
export const MAX_MORT = 1400000;

// Random Pick curated diseases
export const RANDOM_PICK_DISEASES = [
  {id:'sepsis',fact:'Sepsis kills 11M people per year — more than all cancers combined — yet has only 95K papers. That\'s 115 deaths for every paper published.'},
  {id:'breast-cancer',fact:'Breast Cancer has 430,000 papers — more research than any other cancer. Yet it\'s only the 5th deadliest cancer globally.'},
  {id:'rheumatic-heart-disease',fact:'Rheumatic Heart Disease kills 373,000 people per year but has only 9,000 papers. It\'s a disease of poverty — virtually eliminated in wealthy nations.'},
  {id:'cystic-fibrosis',fact:'Cystic Fibrosis has 48 papers for every death — the most researched disease per capita. It primarily affects people of European descent.'},
  {id:'malaria',fact:'Malaria kills 608,000 people per year, 94% in Africa. A child dies of malaria every minute, yet it receives a fraction of cancer research funding.'},
  {id:'alzheimers-disease',fact:'Alzheimer\'s kills 1.9M people per year and research is surging +6%. There is still no cure — only treatments that slow progression.'},
  {id:'covid-19',fact:'COVID-19 generated 300,000 papers in just a few years — the fastest research ramp in scientific history. Research is now declining 10% as the pandemic fades.'},
  {id:'ebola',fact:'Ebola has 40 papers per death — fear drives funding. Despite killing only 300 people per year on average, it receives massive research attention.'},
  {id:'depression',fact:'Depression has 280,000 papers and zero mortality metric. It affects 280M people worldwide and is the leading cause of disability globally.'},
  {id:'tuberculosis',fact:'Tuberculosis kills 1.25M people per year with only 0.09 papers per death. It\'s the deadliest infectious disease and has existed for thousands of years.'},
  {id:'sickle-cell-disease',fact:'Sickle Cell Disease kills 376,000 people per year — mostly in Africa. It\'s the most common genetic disease globally but remains severely under-researched.'},
  {id:'rotavirus',fact:'Rotavirus kills 200,000 children per year, and research is declining. A vaccine exists but remains inaccessible in the countries that need it most.'},
];
```

**Step 2: Create `src/utils/helpers.js`**

```js
import { MN, MX, MAX_PAPERS, MAX_MORT } from './constants';

// Node radius from paper count (power-law for size contrast)
export function nR(p) {
  return MN + Math.pow(Math.min(p, MAX_PAPERS) / MAX_PAPERS, 0.45) * (MX - MN);
}

// Node radius from mortality
export function nRM(m) {
  if (m <= 0) return MN * 0.2;
  return MN + Math.pow(Math.min(m, MAX_MORT) / MAX_MORT, 0.45) * (MX - MN);
}

// Number formatter (1.2M, 42K, etc.)
export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 10000) return Math.round(n / 1000) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// Mobile detection
export function isMob() {
  return typeof window !== 'undefined' &&
    (matchMedia('(pointer:coarse)').matches || window.innerWidth < 768);
}

// Neglect color gradient (papers-per-death ratio)
export function neglectColor(ppd) {
  if (ppd <= 0) return '#22c55e';
  const t = Math.max(0, Math.min(1, (Math.log10(ppd) + 2) / 3.5));
  const stops = [[239,68,68],[245,158,11],[234,179,8],[34,197,94]];
  const s = t * (stops.length - 1), i = Math.min(Math.floor(s), stops.length - 2), f = s - i;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}

// Process raw disease + connection JSON into indexed structures
export function processData(diseases, connections) {
  const idMap = {};
  diseases.forEach((d, i) => { idMap[d.id] = i; });
  const edges = connections.map(c => {
    const si = idMap[c.source], ti = idMap[c.target];
    return { ...c, si, ti, score: c.sharedPapers / Math.sqrt(diseases[si].papers * diseases[ti].papers) };
  });
  const neb = new Map();
  diseases.forEach((_, i) => neb.set(i, []));
  edges.forEach((e, ei) => {
    neb.get(e.si).push({ ei, score: e.score });
    neb.get(e.ti).push({ ei, score: e.score });
  });
  const ls = new Set();
  neb.forEach(arr => {
    arr.sort((a, b) => b.score - a.score);
    arr.slice(0, 7).forEach(({ ei }) => ls.add(ei));
  });
  const neighbors = new Map(), connCounts = new Map();
  diseases.forEach((_, i) => { neighbors.set(i, new Set()); connCounts.set(i, 0); });
  edges.forEach(e => {
    neighbors.get(e.si).add(e.ti);
    neighbors.get(e.ti).add(e.si);
    connCounts.set(e.si, connCounts.get(e.si) + 1);
    connCounts.set(e.ti, connCounts.get(e.ti) + 1);
  });
  return { diseases, edges, layoutEdges: [...ls].map(i => edges[i]), displayEdges: edges, neighbors, connCounts, idMap };
}
```

**Step 3: Create `src/utils/layout.js`**

Copy the existing `computeLayouts` function exactly from `MedGalaxy.jsx:66-143`, importing `nR` from helpers and `d3`.

```js
import * as d3 from 'd3';
import { nR } from './helpers';

export function computeLayouts(diseases, layoutEdges) {
  // ... exact copy of lines 66-143 from MedGalaxy.jsx ...
  // Returns { catPos, netPos, debugStr, rawMax }
}
```

**Step 4: Create `src/utils/tiers.js`**

```js
export const TC = {
  HIGH:  { dprCap: 99, particles: 400, glowAll: true, pulse: true },
  MEDIUM:{ dprCap: 1.5, particles: 150, glowAll: false, pulse: true },
  LOW:   { dprCap: 1, particles: 0, glowAll: false, pulse: false },
};

export function detectTier() {
  if (typeof window === 'undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth < 768) return 'LOW';
  return window.innerWidth < 1200 ? 'MEDIUM' : 'HIGH';
}

// Computed once at init — never changes, never triggers re-renders
export const TIER = detectTier();
export const CFG = TC[TIER];
```

**Step 5: Create shader files**

`src/shaders/plasma.vert.glsl` — exact copy of `PLASMA_VERT` string from lines 187-211.

`src/shaders/plasma.frag.glsl` — exact copy of `PLASMA_FRAG` string from lines 212-228.

Import in components as:
```js
import plasmaVert from '../shaders/plasma.vert.glsl?raw';
import plasmaFrag from '../shaders/plasma.frag.glsl?raw';
```

**Step 6: Verify imports work**

```bash
npm run build
```

**Step 7: Commit**

```bash
git add src/utils/ src/shaders/
git commit -m "feat: extract constants, helpers, layout, tiers, and shaders into modules"
```

---

## Task 3: Create Zustand Store

**Files:**
- Create: `src/store.js`

**Step 1: Create `src/store.js`**

```js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';
import { processData } from './utils/helpers';
import { computeLayouts } from './utils/layout';

// Process data once at module load
const processed = processData(diseasesData, connectionsData);
const layouts = computeLayouts(processed.diseases, processed.layoutEdges);

const useStore = create(
  subscribeWithSelector((set, get) => ({
    // ── Data (immutable after init) ──
    diseases: processed.diseases,
    connections: processed.edges,
    displayEdges: processed.displayEdges,
    neighbors: processed.neighbors,
    connCounts: processed.connCounts,
    idMap: processed.idMap,

    // ── Layout positions ──
    catPos: layouts.catPos,
    netPos: layouts.netPos,
    curPos: layouts.catPos.map(p => [...p]),  // mutable working copy
    layoutMode: 'category',
    rawMax: layouts.rawMax,

    // ── Selection ──
    selectedNode: null,     // { index, disease } or null
    hoveredNode: null,      // { index, disease } or null

    // ── Active mode (mutual exclusion) ──
    activeMode: null,       // null | 'explode' | 'connections' | 'velocity' | 'attention' | 'randomPick'

    // ── Stories ──
    storyActive: null,
    storyStep: 0,
    storyCaption: '',
    storyVisible: true,

    // ── Random Pick ──
    randomPickPhase: 0,
    randomPickCaption: null,

    // ── Connections ──
    connFocusIdx: -1,

    // ── UI ──
    sizeMode: 'papers',
    activeCats: new Set(Object.keys(processed.diseases.reduce((m, d) => { m[d.category] = 1; return m; }, {}))),
    searchQuery: '',
    neglectMode: false,
    spotlightActive: false,
    spotlightCaption: '',

    // ── Camera ──
    flyTarget: null,        // { position: [x,y,z], radius, duration }

    // ── Actions ──
    selectDisease: (idx) => {
      const { diseases, curPos, catPos } = get();
      if (idx === null) {
        set({ selectedNode: null });
        return;
      }
      const p = curPos[idx] || catPos[idx];
      set({
        selectedNode: { index: idx, disease: diseases[idx] },
        flyTarget: {
          position: [p[0], p[1], p[2]],
          radius: 150,
          duration: 1.2,
        },
      });
    },

    deselect: () => {
      const { rawMax } = get();
      set({
        selectedNode: null,
        flyTarget: {
          position: [0, 0, 0],
          radius: rawMax ? rawMax * 1.1 : 700,
          duration: 1.2,
        },
      });
    },

    setHovered: (idx) => {
      if (idx === null) {
        set({ hoveredNode: null });
      } else {
        const { diseases } = get();
        set({ hoveredNode: { index: idx, disease: diseases[idx] } });
      }
    },

    setSizeMode: (mode) => set({ sizeMode: mode }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setActiveCats: (cats) => set({ activeCats: cats }),
    toggleCat: (cat) => {
      const { activeCats } = get();
      const next = new Set(activeCats);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      set({ activeCats: next });
    },

    setActiveMode: (mode) => set({ activeMode: mode }),
    setNeglectMode: (v) => set({ neglectMode: typeof v === 'function' ? v(get().neglectMode) : v }),
    setStoryVisible: (v) => set({ storyVisible: v }),
    setStoryCaption: (c) => set({ storyCaption: c }),
    setRandomPickPhase: (p) => set({ randomPickPhase: p }),
    setRandomPickCaption: (c) => set({ randomPickCaption: c }),
    setConnFocusIdx: (i) => set({ connFocusIdx: i }),
    setSpotlightActive: (v) => set({ spotlightActive: v }),
    setSpotlightCaption: (c) => set({ spotlightCaption: c }),
    setFlyTarget: (t) => set({ flyTarget: t }),
    setCurPos: (pos) => set({ curPos: pos }),
  }))
);

export default useStore;
```

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/store.js
git commit -m "feat: create Zustand store with all state, actions, and processed data"
```

---

## Task 4: Create App Shell with R3F Canvas

Replace the monolithic `MedGalaxy.jsx` with a new `App.jsx` that sets up the R3F Canvas.

**Files:**
- Create: `src/App.jsx`
- Modify: `src/main.jsx`

**Step 1: Create `src/App.jsx`** — minimal shell with Canvas + lighting

```jsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TIER, CFG } from './utils/tiers';
import useStore from './store';
import DiseaseNodes from './components/DiseaseNodes';
import EdgeNetwork from './components/EdgeNetwork';
import GlowSprites from './components/GlowSprites';
import CameraRig from './components/CameraRig';
import HtmlOverlay from './components/HtmlOverlay';

export default function App() {
  const rawMax = useStore(s => s.rawMax);
  const camDist = rawMax ? rawMax * 1.1 : 700;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        dpr={[1, CFG.dprCap === 99 ? window.devicePixelRatio : CFG.dprCap]}
        camera={{
          fov: 60,
          near: 1,
          far: camDist * 4,
          position: [0, 0, camDist],
        }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ background: '#000000' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight intensity={0.6} />
        <directionalLight
          color={0x6699cc}
          intensity={0.3}
          position={[-200, 150, -300]}
        />

        <Suspense fallback={null}>
          <DiseaseNodes />
          <EdgeNetwork />
          <GlowSprites />
          <CameraRig camDist={camDist} />
        </Suspense>
      </Canvas>

      <HtmlOverlay />
    </div>
  );
}
```

**Step 2: Update `src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 3: Create placeholder components** (stubs that return null) so the build passes:

Create files:
- `src/components/DiseaseNodes.jsx` — `export default function DiseaseNodes() { return null; }`
- `src/components/EdgeNetwork.jsx` — `export default function EdgeNetwork() { return null; }`
- `src/components/GlowSprites.jsx` — `export default function GlowSprites() { return null; }`
- `src/components/CameraRig.jsx` — `export default function CameraRig() { return null; }`
- `src/components/HtmlOverlay.jsx` — `export default function HtmlOverlay() { return null; }`

**Step 4: Verify build**

```bash
npm run build
```
Expected: Build succeeds. App renders a black canvas with lights.

**Step 5: Commit**

```bash
git add src/App.jsx src/main.jsx src/components/
git commit -m "feat: create App shell with R3F Canvas, lighting, and placeholder components"
```

---

## Task 5: Implement DiseaseNodes (InstancedMesh + Plasma Shader)

The core rendering component. Single InstancedMesh with 153 instances, plasma shader on desktop, Phong on mobile.

**Files:**
- Modify: `src/components/DiseaseNodes.jsx`

**Step 1: Implement DiseaseNodes**

```jsx
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { nR, nRM } from '../utils/helpers';
import { CC } from '../utils/constants';
import { TIER } from '../utils/tiers';
import plasmaVert from '../shaders/plasma.vert.glsl?raw';
import plasmaFrag from '../shaders/plasma.frag.glsl?raw';

const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();
const _q4 = new THREE.Quaternion();
const _s3 = new THREE.Vector3();

export default function DiseaseNodes() {
  const meshRef = useRef();
  const diseases = useStore(s => s.diseases);
  const count = diseases.length;
  const mobDevice = TIER === 'LOW';

  // Geometry + material (memoized, created once)
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, mobDevice ? 16 : 24, mobDevice ? 16 : 24);
    // Per-instance phase attribute for plasma animation
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) phases[i] = Math.random() * Math.PI * 2;
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    return g;
  }, [count, mobDevice]);

  const mat = useMemo(() => {
    if (mobDevice) {
      return new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.95,
        shininess: 60,
      });
    }
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: plasmaVert,
      fragmentShader: plasmaFrag,
      transparent: true,
    });
  }, [mobDevice]);

  // Initialize instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const catPos = useStore.getState().catPos;
    const sizeMode = useStore.getState().sizeMode;

    for (let i = 0; i < count; i++) {
      _v3.set(catPos[i][0], catPos[i][1], catPos[i][2]);
      const r = sizeMode === 'papers' ? nR(diseases[i].papers) : nRM(diseases[i].mortality);
      _s3.set(r, r, r);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
      mesh.setColorAt(i, new THREE.Color(CC[diseases[i].category]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [count, diseases]);

  // Every frame: update matrices from curPos + update plasma time
  useFrame((state) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const curPos = useStore.getState().curPos;
    const sizeMode = useStore.getState().sizeMode;

    // Update plasma time uniform
    if (mat.uniforms) {
      mat.uniforms.time.value = state.clock.getElapsedTime();
    }

    // Rebuild matrices from curPos every frame
    for (let i = 0; i < count; i++) {
      _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
      const r = sizeMode === 'papers' ? nR(diseases[i].papers) : nRM(diseases[i].mortality);
      _s3.set(r, r, r);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Pointer events for hover/selection
  const onPointerOver = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      useStore.getState().setHovered(e.instanceId);
      document.body.style.cursor = 'pointer';
    }
  };

  const onPointerOut = () => {
    useStore.getState().setHovered(null);
    document.body.style.cursor = 'default';
  };

  const onClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      useStore.getState().selectDisease(e.instanceId);
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, count]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
}
```

**Step 2: Verify dev server renders nodes**

```bash
npm run dev
```
Expected: 153 plasma spheres visible in 3D space.

**Step 3: Commit**

```bash
git add src/components/DiseaseNodes.jsx
git commit -m "feat: implement DiseaseNodes with InstancedMesh, plasma shader, and pointer events"
```

---

## Task 6: Implement EdgeNetwork

**Files:**
- Modify: `src/components/EdgeNetwork.jsx`

**Step 1: Implement EdgeNetwork**

```jsx
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';

export default function EdgeNetwork() {
  const lineRef = useRef();
  const displayEdges = useStore(s => s.displayEdges);
  const eC = displayEdges.length;

  const { geo, clrAttr } = useMemo(() => {
    const buf = new Float32Array(eC * 6);
    const catPos = useStore.getState().catPos;
    for (let i = 0; i < eC; i++) {
      const e = displayEdges[i];
      const s = catPos[e.si], t = catPos[e.ti];
      const o = i * 6;
      buf[o] = s[0]; buf[o+1] = s[1]; buf[o+2] = s[2];
      buf[o+3] = t[0]; buf[o+4] = t[1]; buf[o+5] = t[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    const clr = new Float32Array(eC * 6).fill(1.0);
    const ca = new THREE.BufferAttribute(clr, 3);
    g.setAttribute('color', ca);
    return { geo: g, clrAttr: ca };
  }, [displayEdges, eC]);

  // Update edge endpoints from curPos every frame
  useFrame(() => {
    if (!lineRef.current) return;
    const curPos = useStore.getState().curPos;
    const posArr = geo.getAttribute('position').array;
    for (let i = 0; i < eC; i++) {
      const e = displayEdges[i];
      const s = curPos[e.si], t = curPos[e.ti];
      const o = i * 6;
      posArr[o] = s[0]; posArr[o+1] = s[1]; posArr[o+2] = s[2];
      posArr[o+3] = t[0]; posArr[o+4] = t[1]; posArr[o+5] = t[2];
    }
    geo.getAttribute('position').needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} geometry={geo} renderOrder={-1}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
      />
    </lineSegments>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/EdgeNetwork.jsx
git commit -m "feat: implement EdgeNetwork with per-frame position tracking"
```

---

## Task 7: Implement GlowSprites

**Files:**
- Modify: `src/components/GlowSprites.jsx`

**Step 1: Implement GlowSprites**

```jsx
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { nR } from '../utils/helpers';
import { CC } from '../utils/constants';
import { CFG } from '../utils/tiers';

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export default function GlowSprites() {
  const groupRef = useRef();
  const diseases = useStore(s => s.diseases);
  const count = diseases.length;

  const { tex, glowIndices } = useMemo(() => {
    const t = makeGlowTexture();
    const topN = CFG.glowAll ? count : Math.min(40, count);
    const sorted = [...diseases]
      .map((d, i) => ({ i, papers: d.papers }))
      .sort((a, b) => b.papers - a.papers)
      .slice(0, topN)
      .map(x => x.i);
    return { tex: t, glowIndices: sorted };
  }, [diseases, count]);

  const spritesRef = useRef([]);

  // Update sprite positions from curPos
  useFrame(() => {
    const curPos = useStore.getState().curPos;
    spritesRef.current.forEach(({ ref, idx }) => {
      if (ref.current) {
        ref.current.position.set(curPos[idx][0], curPos[idx][1], curPos[idx][2]);
      }
    });
  });

  // Create refs for each sprite
  const sprites = useMemo(() => {
    spritesRef.current = [];
    return glowIndices.map(idx => {
      const ref = React.createRef();
      spritesRef.current.push({ ref, idx });
      const r = nR(diseases[idx].papers) * 3.5;
      const color = CC[diseases[idx].category];
      return { idx, ref, r, color };
    });
  }, [glowIndices, diseases]);

  return (
    <group ref={groupRef} renderOrder={-2}>
      {sprites.map(({ idx, ref, r, color }) => (
        <sprite key={idx} ref={ref} scale={[r, r, 1]}>
          <spriteMaterial
            map={tex}
            color={color}
            transparent
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
            opacity={0.35}
          />
        </sprite>
      ))}
    </group>
  );
}
```

**Step 2: Verify dev server shows glows behind nodes**

```bash
npm run dev
```

**Step 3: Commit**

```bash
git add src/components/GlowSprites.jsx
git commit -m "feat: implement GlowSprites with additive blending and per-frame tracking"
```

---

## Task 8: Implement CameraRig (OrbitControls + GSAP Fly-To)

**Files:**
- Modify: `src/components/CameraRig.jsx`

**Step 1: Implement CameraRig**

```jsx
import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import useStore from '../store';

export default function CameraRig({ camDist }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const tweenRef = useRef(null);
  const idleFrames = useRef(0);

  // Initial zoom-out animation (camera starts close, flies out)
  useEffect(() => {
    camera.position.set(0, 0, camDist * 0.4);
    gsap.to(camera.position, {
      z: camDist,
      duration: 2.3,
      ease: 'power2.out',
    });
  }, [camera, camDist]);

  // Subscribe to flyTarget changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.flyTarget,
      (flyTarget) => {
        if (!flyTarget || !controlsRef.current) return;
        const controls = controlsRef.current;

        // Kill any existing tween
        if (tweenRef.current) tweenRef.current.kill();

        const dur = flyTarget.duration || 1.2;

        // Animate controls target
        tweenRef.current = gsap.to(controls.target, {
          x: flyTarget.position[0],
          y: flyTarget.position[1],
          z: flyTarget.position[2],
          duration: dur,
          ease: 'power3.inOut',
        });

        // Animate camera distance by moving camera along look direction
        const currentDist = camera.position.distanceTo(controls.target);
        const targetDist = flyTarget.radius || currentDist;
        const dir = camera.position.clone().sub(controls.target).normalize();
        const targetPos = controls.target.clone().add(dir.multiplyScalar(targetDist));

        gsap.to(camera.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: dur,
          ease: 'power3.inOut',
        });
      }
    );
    return unsub;
  }, [camera]);

  // Auto-rotate when idle
  useFrame(() => {
    if (controlsRef.current) {
      idleFrames.current++;
      controlsRef.current.autoRotate = idleFrames.current > 300;
    }
  });

  // Reset idle on user interaction
  const onStart = () => { idleFrames.current = 0; };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      autoRotateSpeed={0.3}
      minDistance={50}
      maxDistance={camDist * 4}
      onStart={onStart}
      makeDefault
    />
  );
}
```

**Step 2: Verify orbit + zoom works in dev server**

```bash
npm run dev
```

**Step 3: Commit**

```bash
git add src/components/CameraRig.jsx
git commit -m "feat: implement CameraRig with OrbitControls, GSAP fly-to, and auto-rotate"
```

---

## Task 9: Implement Idle Drift Animation

The sinusoidal breathing effect that makes nodes gently float when idle.

**Files:**
- Create: `src/components/IdleDrift.jsx`
- Modify: `src/App.jsx` — add `<IdleDrift />` to Canvas

**Step 1: Implement IdleDrift**

```jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';

export default function IdleDrift() {
  const phasesRef = useRef(null);
  const blendRef = useRef(0);

  useFrame((state) => {
    const { activeMode, curPos, catPos, diseases } = useStore.getState();

    // Only drift when no animation is active
    if (activeMode) {
      blendRef.current = 0;
      return;
    }

    const count = diseases.length;
    const t = state.clock.getElapsedTime();

    // Initialize phases once
    if (!phasesRef.current || phasesRef.current.length !== count) {
      phasesRef.current = diseases.map(() => Math.random() * Math.PI * 2);
    }

    // Blend in gradually
    if (blendRef.current < 1) blendRef.current = Math.min(1, blendRef.current + 0.025);
    const bl = blendRef.current;
    const ph = phasesRef.current;

    for (let i = 0; i < count; i++) {
      curPos[i][0] = catPos[i][0] + Math.sin(t * 0.3 + ph[i]) * 12 * bl;
      curPos[i][1] = catPos[i][1] + Math.cos(t * 0.25 + ph[i] * 1.3) * 12 * bl;
      curPos[i][2] = catPos[i][2] + Math.sin(t * 0.2 + ph[i] * 0.7) * 10 * bl;
    }
  });

  return null;
}
```

**Step 2: Add to App.jsx** inside `<Canvas>`:
```jsx
import IdleDrift from './components/IdleDrift';
// ... inside Canvas, after CameraRig:
<IdleDrift />
```

**Step 3: Verify nodes gently float**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add src/components/IdleDrift.jsx src/App.jsx
git commit -m "feat: implement IdleDrift sinusoidal breathing animation"
```

---

## Task 10: Implement HtmlOverlay (Header + StoryChips + Tooltip + Sidebar)

All HTML UI rendered as a React overlay div positioned absolutely over the Canvas. Uses Tailwind CSS + Framer Motion.

**Files:**
- Modify: `src/components/HtmlOverlay.jsx`
- Create: `src/components/ui/Header.jsx`
- Create: `src/components/ui/StoryChips.jsx`
- Create: `src/components/ui/Tooltip.jsx`
- Create: `src/components/ui/Sidebar.jsx`
- Create: `src/components/ui/FilterBar.jsx`
- Create: `src/components/ui/Legend.jsx`
- Create: `src/components/ui/Sparkline.jsx`
- Create: `src/components/ui/SearchDropdown.jsx`

**Step 1: Create HtmlOverlay container**

```jsx
// src/components/HtmlOverlay.jsx
import React from 'react';
import Header from './ui/Header';
import StoryChips from './ui/StoryChips';
import Tooltip from './ui/Tooltip';
import Sidebar from './ui/Sidebar';
import FilterBar from './ui/FilterBar';
import Legend from './ui/Legend';

export default function HtmlOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden font-mono">
      <Header />
      <FilterBar />
      <Legend />
      <Tooltip />
      <Sidebar />
      <StoryChips />
    </div>
  );
}
```

**Step 2: Implement each UI sub-component**

Port each component from `MedGalaxy.jsx` (lines 233-500), converting inline styles to Tailwind classes and wrapping interactive elements in Framer Motion. Each component reads from Zustand store directly.

Key patterns for every component:
- `pointer-events-auto` on interactive elements (buttons, panels)
- `backdrop-blur-md bg-white/5 border border-white/10 rounded-xl` for glassmorphism
- `<motion.div>` from framer-motion for enter/exit animations
- `<AnimatePresence>` for conditional rendering transitions
- Zustand selectors for reactive state: `const selected = useStore(s => s.selectedNode)`

Each sub-component is a direct port of its MedGalaxy.jsx counterpart with identical logic, just Tailwind-styled. The exact Tailwind classes and Framer Motion animations should be derived from the existing inline styles during implementation.

**Step 3: Verify all UI elements render over canvas**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add src/components/HtmlOverlay.jsx src/components/ui/
git commit -m "feat: implement HTML overlay with Header, StoryChips, Tooltip, Sidebar, FilterBar, Legend"
```

---

## Task 11: Implement Story Engine (GSAP Transitions)

**Files:**
- Create: `src/components/StoryEngine.jsx`

**Step 1: Implement StoryEngine**

```jsx
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import useStore from '../store';
import { nR } from '../utils/helpers';

// Story sequences — same data as MedGalaxy.jsx lines 839-856
function buildSequences(idMap) {
  const find = id => idMap[id];
  return {
    researched: [
      { id: find('breast-cancer'), caption: 'Breast Cancer — 430K papers' },
      { id: find('lung-cancer'), caption: 'Lung Cancer — 350K papers' },
      { id: find('type-2-diabetes'), caption: 'Type 2 Diabetes — 380K papers' },
      { caption: 'These diseases each have 300,000+ papers.' },
    ],
    killers: [
      { id: find('heart-disease'), caption: 'Heart Disease — 9.1M deaths/yr' },
      { id: find('stroke'), caption: 'Stroke — 7.3M deaths/yr' },
      { id: find('copd'), caption: 'COPD — 3.5M deaths/yr' },
      { caption: 'These diseases kill millions per year.' },
    ],
    forgotten: [
      { id: find('rotavirus'), caption: 'Rotavirus — 200K child deaths/yr, research declining 18%' },
      { id: find('tetanus'), caption: 'Tetanus — 35K deaths/yr, research declining 10%' },
      { id: find('hepatitis-c'), caption: 'Hepatitis C — 242K deaths/yr, research declining' },
      { caption: 'These diseases still kill 470,000+ yearly while the world looks away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease — 373K deaths/yr, only 9K papers' },
      { id: find('norovirus'), caption: 'Norovirus — 200K deaths/yr, only 12K papers' },
      { id: find('pertussis'), caption: 'Pertussis — 160K deaths/yr, only 14K papers' },
      { id: find('rotavirus'), caption: 'Rotavirus — 200K child deaths/yr, research declining' },
      { caption: 'These diseases kill 930,000+ people every year in near-silence.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis — 48 papers per death (wealthy nation disease)' },
      { id: find('multiple-sclerosis'), caption: 'Multiple Sclerosis — 16 papers per death (wealthy nation disease)' },
      { id: find('tuberculosis'), caption: 'Tuberculosis — 0.09 papers per death, 1.25M deaths/yr (developing nation)' },
      { id: find('malaria'), caption: 'Malaria — 0.16 papers per death, 608K deaths/yr (developing nation)' },
      { caption: 'Where you are born determines how much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis — 48K papers, 1K deaths (48 papers per death)' },
      { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease — 9K papers, 373K deaths (0.02 papers per death)' },
      { caption: '2,000× research intensity gap. Now toggle Mortality at the top of the page →' },
    ],
  };
}

export default function StoryEngine() {
  const seqRef = useRef(null);
  const stepRef = useRef(0);
  const timerRef = useRef(null);

  // Handle story chip clicks
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.storyActive,
      (storyKey) => {
        // Clear previous
        if (timerRef.current) clearTimeout(timerRef.current);
        stepRef.current = 0;
        useStore.getState().setStoryCaption('');

        if (!storyKey) { seqRef.current = null; return; }

        const { idMap } = useStore.getState();
        const sequences = buildSequences(idMap);
        seqRef.current = sequences[storyKey];
        if (!seqRef.current) return;

        advanceStory();
      }
    );
    return unsub;
  }, []);

  function advanceStory() {
    const seq = seqRef.current;
    if (!seq) return;
    const step = stepRef.current;
    if (step >= seq.length) {
      // Story complete — reset
      useStore.setState({ storyActive: null, storyCaption: '' });
      seqRef.current = null;
      stepRef.current = 0;
      return;
    }
    const item = seq[step];
    useStore.getState().setStoryCaption(item.caption);

    if (item.id !== undefined) {
      useStore.getState().selectDisease(item.id);
    }

    stepRef.current++;
    timerRef.current = setTimeout(advanceStory, 4500);
  }

  return null; // Pure logic component, no rendering
}
```

**Step 2: Add to App.jsx** inside Canvas:
```jsx
import StoryEngine from './components/StoryEngine';
// inside Canvas:
<StoryEngine />
```

**Step 3: Wire story chips** — in `StoryChips.jsx`, clicking a chip calls `useStore.setState({ storyActive: chipId })`.

**Step 4: Verify stories cycle through diseases with captions**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/StoryEngine.jsx src/App.jsx src/components/ui/StoryChips.jsx
git commit -m "feat: implement StoryEngine with GSAP-driven story transitions"
```

---

## Task 12: Implement Explode View

**Files:**
- Create: `src/components/ExplodeView.jsx`
- Create: `src/components/ui/ExplodeOverlay.jsx`

**Step 1: Implement ExplodeView** (3D animation logic)

Port `handleExplode`/`handleUnexplode` from MedGalaxy.jsx lines 614-632. Use GSAP to tween `curPos` entries outward by factor 2.5-4x with random offset, then reverse on close.

```jsx
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import useStore from '../store';

export default function ExplodeView() {
  const tweenRef = useRef(null);

  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.activeMode,
      (mode, prevMode) => {
        const { curPos, catPos } = useStore.getState();

        if (mode === 'explode' && prevMode !== 'explode') {
          // Explode outward
          const targets = curPos.map(p => {
            const d = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]) || 1;
            const factor = 2.5 + Math.random() * 1.5;
            return [
              p[0] * factor + (Math.random() - 0.5) * 80,
              p[1] * factor + (Math.random() - 0.5) * 80,
              p[2] * factor + (Math.random() - 0.5) * 80,
            ];
          });

          // GSAP tween each position
          for (let i = 0; i < curPos.length; i++) {
            gsap.to(curPos[i], {
              0: targets[i][0],
              1: targets[i][1],
              2: targets[i][2],
              duration: 1.0,
              ease: 'power2.out',
            });
          }
        }

        if (prevMode === 'explode' && mode !== 'explode') {
          // Return to category positions
          for (let i = 0; i < curPos.length; i++) {
            gsap.to(curPos[i], {
              0: catPos[i][0],
              1: catPos[i][1],
              2: catPos[i][2],
              duration: 1.0,
              ease: 'power2.inOut',
            });
          }
        }
      }
    );
    return unsub;
  }, []);

  return null;
}
```

**Step 2: Create ExplodeOverlay** — port the overlay panel from MedGalaxy.jsx lines 255-298, converting to Tailwind + Framer Motion.

**Step 3: Add to App.jsx and HtmlOverlay.jsx**

**Step 4: Verify explode animation + overlay**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/ExplodeView.jsx src/components/ui/ExplodeOverlay.jsx src/App.jsx src/components/HtmlOverlay.jsx
git commit -m "feat: implement ExplodeView with GSAP position animation and overlay panel"
```

---

## Task 13: Implement ConnectionsView

**Files:**
- Create: `src/components/ConnectionsView.jsx`
- Create: `src/components/ui/ConnectionsOverlay.jsx`

**Step 1: Implement ConnectionsView**

Port the connection focus logic from MedGalaxy.jsx lines 634-818. When a disease is selected in connections mode:
- Center the chosen node at origin
- Arrange neighbors in Fibonacci sphere orbit
- Push non-connected nodes far away (scale to near-zero)
- GSAP tween all positions + sizes
- Fly camera to frame the cluster

**Step 2: Create ConnectionsOverlay** — port from MedGalaxy.jsx lines 300-340 with Tailwind + Framer.

**Step 3: Add to App.jsx and HtmlOverlay.jsx**

**Step 4: Verify connections mode**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/ConnectionsView.jsx src/components/ui/ConnectionsOverlay.jsx
git commit -m "feat: implement ConnectionsView with Fibonacci orbit layout and GSAP animation"
```

---

## Task 14: Implement VelocityMap & AttentionMap

**Files:**
- Create: `src/components/VelocityMap.jsx`
- Create: `src/components/ui/VelocityOverlay.jsx`
- Create: `src/components/AttentionMap.jsx`

**Step 1: Implement VelocityMap** — same explode pattern as ExplodeView but with velocity-based overlay data. Port from lines 641-658.

**Step 2: Create VelocityOverlay** — port from lines 342-388 with Tailwind + Framer.

**Step 3: Implement AttentionMap** — toggles neglect mode coloring. Port the color-update logic from the highlight useEffect (lines 1331-1383). The attention map recolors instance colors based on papers-per-death ratio using `neglectColor()`.

**Step 4: Add all to App.jsx and HtmlOverlay.jsx**

**Step 5: Verify velocity and attention modes**

```bash
npm run dev
```

**Step 6: Commit**

```bash
git add src/components/VelocityMap.jsx src/components/ui/VelocityOverlay.jsx src/components/AttentionMap.jsx
git commit -m "feat: implement VelocityMap, AttentionMap with overlays"
```

---

## Task 15: Implement RandomPick (4-Phase Animation)

The most complex animation. Port all 4 phases + tornado particles + motion trails.

**Files:**
- Create: `src/components/RandomPick.jsx`
- Create: `src/components/ui/RandomPickCaption.jsx`

**Step 1: Implement RandomPick**

This component runs inside `useFrame` with imperative phase logic. Port from MedGalaxy.jsx lines 738-772 (callbacks) and the animation loop sections for phases 1-4 (lines 1073-1196).

Key implementation notes:
- Use `useRef` for phase state (`{phase, f, chosenIdx, origPositions, velocities, clusterPos}`)
- Subscribe to store for `randomPickPhase` changes to trigger start
- Mutate `curPos` directly in `useFrame` (same as current)
- Create tornado particles as a `<points>` child with AdditiveBlending
- Motion trail effect: use a `<mesh>` with `renderOrder={-10}`, semi-transparent black plane rendered before scene via `useFrame` with `gl.autoClear = false`
- On phase 4 completion: call `selectDisease()` and `setRandomPickCaption()`

Phase breakdown (identical frame counts to current):
- Phase 1 (150 frames): Fibonacci sphere collapse with smoothstep blend
- Phase 2 (460 frames): Spin ramp 0.013→0.2 with cubic ease-in, camera shake at end
- Phase 3 (90 frames): Physics explosion with velocity + drag (0.96)
- Phase 4: Reveal chosen node

**Step 2: Create RandomPickCaption** — port from MedGalaxy.jsx lines 461-469 with Tailwind + Framer slide-up animation.

**Step 3: Wire handleRandomPick** — StoryChips button triggers `setActiveMode('randomPick')` + `setRandomPickPhase(1)`.

**Step 4: Wire exit handlers** — any click/drag during random pick calls `stopRandomPick()` which resets phase to 0 and tweens positions back.

**Step 5: Verify full random pick animation cycle**

```bash
npm run dev
```

**Step 6: Commit**

```bash
git add src/components/RandomPick.jsx src/components/ui/RandomPickCaption.jsx
git commit -m "feat: implement RandomPick 4-phase animation with tornado particles and motion trails"
```

---

## Task 16: Implement Spotlight Mode

**Files:**
- Create: `src/components/Spotlight.jsx`
- Create: `src/components/ui/SpotlightCaption.jsx`

**Step 1: Implement Spotlight** — auto-tour cycling through curated diseases every 6 seconds. Port the spotlight logic (setInterval-based cycling, same as existing).

**Step 2: Create SpotlightCaption** — port from MedGalaxy.jsx lines 456-459.

**Step 3: Wire to Header button**

**Step 4: Verify spotlight cycles and stops on interaction**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/Spotlight.jsx src/components/ui/SpotlightCaption.jsx
git commit -m "feat: implement Spotlight auto-tour mode"
```

---

## Task 17: Implement Node Highlight System

The effect that dims/highlights nodes based on selection, category filters, search, and attention mode.

**Files:**
- Create: `src/components/HighlightSystem.jsx`

**Step 1: Implement HighlightSystem**

Port the highlight useEffect from MedGalaxy.jsx lines 1331-1383. Runs in `useFrame`, updates instance colors and glow opacity based on:
- `hoveredNode` / `selectedNode` — brighten hovered, dim others
- `activeCats` — hide/dim filtered categories
- `searchQuery` — highlight matching diseases
- `neglectMode` — recolor all nodes by papers-per-death ratio
- `connFocusIdx` — highlight connected cluster, hide others

Uses `meshRef.current.setColorAt()` to update instance colors, `meshRef.current.instanceColor.needsUpdate = true`.

Note: This component needs a ref to the InstancedMesh from DiseaseNodes. Use a shared ref in the store or pass via React context.

**Step 2: Add to App.jsx**

**Step 3: Verify highlighting works for all modes**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add src/components/HighlightSystem.jsx
git commit -m "feat: implement HighlightSystem for selection, filtering, search, and attention mode"
```

---

## Task 18: Implement Node Labels

Projected 3D→2D labels for each disease name.

**Files:**
- Create: `src/components/NodeLabels.jsx`

**Step 1: Implement NodeLabels**

Port the label projection logic from MedGalaxy.jsx lines 1272-1300. Use Drei's `<Html>` component attached to each node's position, or port the manual projection approach (project 3D→screen coordinates, position absolute divs).

Recommended: Use manual projection in `useFrame` for performance (153 `<Html>` components would be too heavy). Render a single div container with 153 label spans, update their `transform` via refs.

**Step 2: Style with Tailwind** — `text-[9px] font-mono text-center whitespace-nowrap`

**Step 3: Add to HtmlOverlay.jsx**

**Step 4: Verify labels track nodes during drift and animations**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/NodeLabels.jsx
git commit -m "feat: implement NodeLabels with 3D-to-screen projection"
```

---

## Task 19: Add Post-Processing

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add conditional post-processing**

```jsx
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { TIER } from './utils/tiers';

// Inside Canvas, after all scene components:
{TIER !== 'LOW' && (
  <EffectComposer>
    <Bloom
      luminanceThreshold={0.6}
      luminanceSmoothing={0.9}
      intensity={TIER === 'HIGH' ? 1.0 : 0.5}
    />
  </EffectComposer>
)}
```

**Step 2: Verify bloom renders on desktop, skipped on mobile**

```bash
npm run dev
```

**Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add conditional Bloom post-processing by device tier"
```

---

## Task 20: Add Background Particles

**Files:**
- Create: `src/components/BackgroundParticles.jsx`

**Step 1: Implement BackgroundParticles**

Port from MedGalaxy.jsx lines 975-982. Render `CFG.particles` points distributed on a sphere at `camDist * 4` radius.

```jsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { CFG } from '../utils/tiers';

export default function BackgroundParticles({ camDist }) {
  const count = CFG.particles;

  const positions = useMemo(() => {
    if (count === 0) return null;
    const pos = new Float32Array(count * 3);
    const pR = camDist * 4;
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = pR + Math.random() * pR * 0.3;
      pos[i*3] = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pos[i*3+2] = r * Math.cos(ph);
    }
    return pos;
  }, [count, camDist]);

  if (!positions) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={0x334155} size={1.5} transparent opacity={0.6} />
    </points>
  );
}
```

**Step 2: Add to App.jsx**

**Step 3: Commit**

```bash
git add src/components/BackgroundParticles.jsx src/App.jsx
git commit -m "feat: add background particles by device tier"
```

---

## Task 21: Remove Old MedGalaxy.jsx & Final Wiring

**Files:**
- Delete: `src/MedGalaxy.jsx` (old monolith)
- Modify: `src/App.jsx` — ensure all components are imported and rendered

**Step 1: Remove old file**

```bash
rm src/MedGalaxy.jsx
```

**Step 2: Verify the full app works end-to-end**

Checklist:
- [ ] Nodes render with plasma shader
- [ ] Orbit controls work (drag, zoom, touch)
- [ ] Hover tooltips appear
- [ ] Click selects disease, sidebar opens
- [ ] All 6 story modes work
- [ ] Random Pick full animation cycle
- [ ] Explode view
- [ ] Connections view
- [ ] Velocity map
- [ ] Attention map
- [ ] Spotlight mode
- [ ] Category filters
- [ ] Search
- [ ] Size toggle (papers/mortality)
- [ ] Node labels track positions
- [ ] Mobile layout works
- [ ] No console errors

**Step 3: Build passes**

```bash
npm run build
```

**Step 4: Commit**

```bash
git rm src/MedGalaxy.jsx
git add -A
git commit -m "feat: complete R3F migration — remove old monolith, all features ported"
```

---

## Task 22: Performance Validation & Deploy

**Step 1: Check bundle size**

```bash
npm run build
# Check dist/ output size
du -sh dist/
```

**Step 2: Run dev server and check Chrome DevTools Performance tab**

- Record 10 seconds of idle drift
- Verify consistent 60fps
- Check no memory leaks (heap snapshots)

**Step 3: Test on mobile** (iOS Safari, Android Chrome via local network or deploy)

**Step 4: Deploy to Vercel**

```bash
vercel --prod --yes
```

**Step 5: Visual comparison against production checkpoint**

Compare https://www.medgalaxy.org (checkpoint-pre-experiment) with preview deployment.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: performance tuning and deployment adjustments"
```

---

## Summary

| Task | Component | Estimated Complexity |
|------|-----------|---------------------|
| 1 | Dependencies & branch setup | Low |
| 2 | Constants, utils, shaders | Low |
| 3 | Zustand store | Medium |
| 4 | App shell + Canvas | Low |
| 5 | DiseaseNodes (InstancedMesh) | High |
| 6 | EdgeNetwork | Medium |
| 7 | GlowSprites | Medium |
| 8 | CameraRig | Medium |
| 9 | IdleDrift | Low |
| 10 | HtmlOverlay (all UI) | High |
| 11 | StoryEngine | Medium |
| 12 | ExplodeView | Medium |
| 13 | ConnectionsView | High |
| 14 | VelocityMap + AttentionMap | Medium |
| 15 | RandomPick | Very High |
| 16 | Spotlight | Low |
| 17 | HighlightSystem | Medium |
| 18 | NodeLabels | Medium |
| 19 | Post-processing | Low |
| 20 | BackgroundParticles | Low |
| 21 | Final wiring + cleanup | Medium |
| 22 | Performance + deploy | Medium |
