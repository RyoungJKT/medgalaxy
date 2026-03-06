# MedGalaxy R3F Migration — Design Document

**Date:** 2026-03-06
**Branch:** `prototype/r3f-migration`
**Revert checkpoint:** `checkpoint-pre-experiment` (commit `a575b14`)

## Goal

Full-parity rewrite of MedGalaxy from raw Three.js (42K-line monolith) to a modular React Three Fiber architecture. Prototype branch to evaluate before committing to production.

## Dependencies

### New
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — Html, OrbitControls, helpers
- `@react-three/postprocessing` — Bloom, FXAA
- `gsap` — 3D instance matrix animations + camera sweeps
- `framer-motion` — HTML overlay transitions
- `zustand` — Lightweight state management
- `tailwindcss` + `@tailwindcss/vite` — Glassmorphic UI styling

### Removed Manual Code
- Custom `EffectComposer`/`RenderPass`/`ShaderPass` imports
- Custom `OC` orbit controls class
- Manual renderer/camera/scene setup
- Manual resize observer
- Proxy sphere raycasting system

### Upgraded
- `three` from r128 to latest stable (r170+) — required by R3F

## Component Architecture

```
src/
├── App.jsx                 # <Canvas>, layout, global providers
├── store.js                # Zustand store
├── components/
│   ├── DiseaseNodes.jsx    # InstancedMesh + plasma shader
│   ├── EdgeNetwork.jsx     # LineSegments for connections
│   ├── GlowSprites.jsx     # Additive-blended glow sprites
│   ├── CameraRig.jsx       # OrbitControls + GSAP fly-to
│   ├── StoryEngine.jsx     # GSAP timeline for data story transitions
│   ├── RandomPick.jsx      # 4-phase animation + tornado particles
│   ├── ExplodeView.jsx     # Category explosion layout
│   ├── ConnectionsView.jsx # Connection focus mode
│   ├── VelocityMap.jsx     # Research velocity visualization
│   ├── AttentionMap.jsx    # Attention/funding overlay
│   └── HtmlOverlay.jsx    # Drei <Html> — all UI (Tailwind + Framer)
├── shaders/
│   ├── plasma.vert.glsl    # Existing plasma vertex shader
│   └── plasma.frag.glsl   # Existing plasma fragment shader
└── utils/
    ├── layout.js           # d3 force layout + category layout computation
    └── tiers.js            # Device tier detection + config
```

## State Management (Zustand)

```js
// store.js
{
  // Data
  diseases: [],
  connections: [],
  catPos: [],           // category layout positions
  netPos: [],           // network layout positions
  curPos: [],           // current interpolated positions (mutable)

  // Selection
  selectedNode: null,   // index or null
  hoveredNode: null,    // index or null

  // Mode
  activeMode: null,     // null | 'explode' | 'connections' | 'velocity' | 'attention' | 'randomPick'
  storyActive: null,    // current story key or null
  storyStep: 0,

  // Random Pick
  randomPickPhase: 0,   // 0-4
  randomPickCaption: null,

  // Connections
  connFocusIdx: -1,

  // UI
  uiVisible: true,
  flyTarget: null,      // { position, radius } for camera

  // Actions
  actions: {
    selectDisease: (idx) => {},
    startStory: (key) => {},
    startRandomPick: () => {},
    stopAll: () => {},
    // ...
  }
}
```

**Selector discipline:** Every component uses granular selectors to avoid unnecessary re-renders:
```js
const selected = useStore(s => s.selectedNode);  // Good
const store = useStore();                         // Bad — never do this
```

## Animation Architecture

### GSAP — 3D Transitions
- Story transitions: `gsap.to(curPos, ...)` mutates position array, `useFrame` rebuilds matrices every frame
- Camera sweeps: `gsap.to(controls.target, ...)` via CameraRig
- Explode view: GSAP staggers nodes outward by category
- Fly-to on selection: GSAP animates OrbitControls target + radius

**Critical:** `DiseaseNodes` sets `meshRef.current.instanceMatrix.needsUpdate = true` on EVERY frame inside `useFrame`, not just on GSAP completion. This prevents teleporting.

### Imperative `useFrame` — Random Pick
4-phase system stays imperative (too complex for declarative tweens):
- Phase 1: Fibonacci sphere collapse (150 frames, smoothstep)
- Phase 2: Spin ramp 0.013→0.2 (460 frames, cubic ease-in)
- Phase 3: Physics explosion with velocity + drag (90 frames)
- Phase 4: Reveal chosen node
- Tornado particles + motion trail fade quad managed as scene children

### Framer Motion — UI Layer
- `<AnimatePresence>` for tooltip/caption mount/unmount
- `<motion.div>` for slide-in panels, fade transitions
- `<motion.button>` for hover scale on story chips
- Spring physics for mobile menu dropdown

## HTML Overlay (Drei `<Html>` + Tailwind)

All UI rendered via `<Html fullscreen>` as a single overlay layer.

### Glassmorphism Pattern
```
backdrop-blur-md bg-white/5 border border-white/10 rounded-xl shadow-2xl
```

### Elements
- Header: nav buttons, title — `backdrop-blur-md bg-white/5`
- Story Chips: `bg-slate-900/80 rounded-lg` with Framer hover scale
- Tooltip: Framer fade+slide, glassmorphic card
- Disease Detail Panel: Framer slide-in with spring
- Random Pick Caption: Framer slide-up, `backdrop-blur-lg bg-black/60`
- Story Captions: Framer crossfade between steps
- Mobile Menu: Framer slide-down with stagger

### Responsiveness
Tailwind breakpoints (`md:`, `lg:`) where possible, `isMob()` fallback for 3D-specific logic.

## Performance Strategy

### Device Tiers

| Tier | Bloom | Plasma Shader | Glow Sprites | Particles | DPR |
|------|-------|---------------|-------------|-----------|-----|
| HIGH | Yes | Yes | All | 400 | native |
| MEDIUM | Reduced | Yes | Top 40 | 150 | 1.5 |
| LOW | No | Phong fallback | Top 20 | 0 | 1 |

### R3F Optimizations
- `<Canvas dpr={[1, dprCap]}>` for pixel ratio clamping
- `<EffectComposer>` conditionally rendered (skipped on LOW)
- `instanceMatrix.setUsage(THREE.DynamicDrawUsage)` — avoids GPU buffer reallocation
- R3F pointer events on `<instancedMesh>` replace proxy sphere raycasting
- Tier config stored as non-reactive constant outside Zustand (no re-renders)

### Frustum Culling
Default `frustumCulled` on InstancedMesh. Per-instance culling not implemented — with 153 nodes, GPU cost of drawing all is less than CPU cost of per-frame visibility checks. Revisit only if profiling shows need.

### Texture Compression
Glow texture is canvas-generated (no file). Future file textures will use `.webp` via Drei's `useTexture`.

### Bundle Impact
~150KB gzipped added. Total bundle stays under 300KB.

## Verification Plan
1. `npm run build` — no errors or warnings
2. 60fps on desktop (Chrome DevTools Performance tab)
3. Functional on mobile (iOS Safari, Android Chrome)
4. All features working: node selection, stories, Random Pick, explode, connections, velocity, attention
5. Visual comparison against production (checkpoint-pre-experiment)
6. Lighthouse performance score ≥ 90
