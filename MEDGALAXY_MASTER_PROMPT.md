# MEDGALAXY MASTER PROMPT — PubMed Disease Research Network

> **Feed this entire document to Claude Code, Cursor, Windsurf, or any agentic coding platform.**
> It contains everything needed to build the project from scratch — no external docs required.

---

## WHAT YOU ARE BUILDING

An interactive 3D force-directed graph visualization that maps global disease research output from PubMed. ~150 diseases rendered as glowing spheres in WebGL, connected by ~700 luminous lines representing shared publications, with a publications↔mortality size toggle that instantly reveals research inequality between well-funded diseases and neglected tropical diseases.

**One-line pitch:** Breast cancer has 400,000+ papers. Buruli ulcer has ~3,000. This visualization makes that 130:1 ratio impossible to ignore.

---

## TARGET ENVIRONMENT

- **Local dev:** Vite + React 18 with hot reload. Three.js from npm.
- **Final artifact:** A single `.jsx` file that also works when pasted into Claude.ai artifacts.
- **Deployment:** Vercel (free tier) — static hosting, no backend.
- All code must stay in **one file**. Data embedded inline. Only imports available in Claude.ai: `three`, `d3`, `lodash`, `recharts`.

---

## PROJECT STRUCTURE (create this)

```
medgalaxy/
├── README.md
├── MEDGALAXY_MASTER_PROMPT.md ← Canonical spec (this file)
├── BUILD_PLAN.md              ← Execution checklist
├── CLAUDE.md                  ← Artifact constraints quick reference
├── PROJECT_BRIEF.md           ← Project context
├── package.json               ← Vite + React + three + d3 + lodash
├── index.html
├── vite.config.js
├── data/
│   ├── diseases.json          ← Source of truth (~150 diseases)
│   └── connections.json       ← Source of truth (~700 connections)
└── src/
    └── MedGalaxy.jsx          ← THE single-file artifact
```

---

## KEY DECISIONS (NON-NEGOTIABLE)

These have been made. Do not revisit or change them.

| Decision | Rationale |
|----------|-----------|
| Three.js r128 (WebGL) | Real 3D rendering, not SVG |
| React 18 + Vite | Component model for UI overlays, hot reload |
| Single `.jsx` file | Dual-target: local dev + Claude.ai artifact |
| ~150 diseases, 10 categories | Enough for visual impact without exceeding artifact limits |
| Static JSON data | Prototype phase, no live API calls |
| InstancedMesh | One draw call for all 150 nodes — required for 60fps |
| Proxy spheres for raycasting | Invisible meshes at node positions, avoids InstancedMesh raycasting complexity |
| d3-force (2D) + custom Z | d3-force-3d is NOT in the d3 bundle. Use 2D sim + manual Z clustering |
| Custom orbit controls | OrbitControls is NOT available in artifact env. Implement from scratch using spherical coords + damping |
| Faked bloom | EffectComposer/UnrealBloomPass NOT available. Use emissive materials + sprite halos with AdditiveBlending |
| Compact array-of-arrays | Data embedding format — under 550 lines for all diseases + connections |
| Cosine-normalized edge scores | Prevents mega-topic blob; measures relative overlap not absolute volume |
| Layout edges vs display edges | Top-7 per node for simulation, all ~700 for rendering (faint). Clean clusters without hairball |
| Dual layout modes | Category View (default, readable) ↔ Network View (organic emergent clusters). Pre-computed, lerp on toggle |
| Quality tiers (auto-detect) | HIGH/MEDIUM/LOW with DPR capping. Heuristic on mount. Biggest mobile perf win |

---

## CRITICAL TECHNICAL CONSTRAINTS

### Three.js r128 (Artifact Environment)
```javascript
import * as THREE from 'three';
```
- OrbitControls → NOT available. Implement custom orbit controls.
- EffectComposer / UnrealBloomPass → NOT available. Fake bloom.
- `THREE.CapsuleGeometry` → NOT available (added in r142). Do not use.
- No other Three.js addon imports are available.

### Custom Orbit Controls — Implement This Class
Self-contained class using spherical coordinates:
- Properties: `theta`, `phi`, `radius`, `target` (Vector3), velocity damping
- Left-click + drag → rotate camera around target (theta/phi)
- Scroll → zoom (adjust radius along look vector)
- Right-click + drag → pan (move target in screen space)
- Damping: `velocity *= 0.92` per frame
- This is the RISKIEST item. Implement and test rotation BEFORE adding nodes.

### Edge Score Normalization (prevents mega-topic blob)
Raw `sharedPapers` counts are biased toward high-volume diseases (cancer, diabetes). A breast cancer–lung cancer edge will dominate the layout simply because both have 300k+ papers, not because they're scientifically related. **Normalize all edge scores before using them in the simulation.**

```javascript
// Cosine normalization: measures relative overlap, not absolute volume
edge.score = edge.sharedPapers / Math.sqrt(sourceNode.papers * targetNode.papers);
```

This means a dengue–Zika connection (moderate papers, high relative overlap) scores higher than breast cancer–lung cancer (huge papers, low relative overlap). Use `score` for all layout and visual strength calculations.

### Layout Edges vs Display Edges
To prevent the 700-edge hairball:
- **layoutEdges:** Top-K strongest edges per node (K = 6–8, by normalized `score`). Only these feed into `forceLink`. This produces clean, readable clusters.
- **displayEdges:** All ~700 edges. Rendered faintly by default. Brighten on hover/selection (neighborhood only).

```javascript
// Compute layout edges: top 7 per node by normalized score
const layoutEdges = computeTopKPerNode(allEdges, 7, 'score');
// Use layoutEdges for forceLink, displayEdges for rendering
```

### Dual Layout Modes (Category View ↔ Network View)
Pre-compute **two layouts** on mount. Store both position arrays. Lerp between them on toggle.

**Category View (default):** Readable medical map. Category forces active.
**Network View:** Organic emergent clusters. Category forces off — layout driven purely by connection strength.

```javascript
// Category View: d3-force 2D with category bias
const catSim = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-50))
  .force('link', d3.forceLink(layoutEdges).distance(80).strength(d => d.score * 0.5))
  .force('center', d3.forceCenter(0, 0))
  .force('categoryX', d3.forceX(d => categoryCenters[d.category].x).strength(0.15))
  .force('categoryY', d3.forceY(d => categoryCenters[d.category].y).strength(0.15));
// + manual Z toward categoryZCenters (strength 0.02)
catSim.tick(300);
const categoryPositions = nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));

// Network View: same sim WITHOUT category forces
const netSim = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-50))
  .force('link', d3.forceLink(layoutEdges).distance(80).strength(d => d.score * 0.5))
  .force('center', d3.forceCenter(0, 0))
  .force('collide', d3.forceCollide(d => nodeRadius(d) * 1.2));
// + mild random Z scatter (no category bias)
netSim.tick(300);
const networkPositions = nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));

// Toggle: lerp all node positions over 60 frames
```

### Force Parameters
```
repulsion_strength: -50
link_distance: 80
link_strength: edge.score * 0.5 (uses normalized score, NOT raw sharedPapers)
center_gravity: 0.02
category_cluster: 0.15 (Category View) / 0.0 (Network View)
z_attraction: 0.02 (Category View) / 0.0 (Network View)
damping: 0.85
warm_up_ticks: 300 per layout (600 total, both synchronous on mount)
layout_edges: top 7 per node by score
```

### React Constraints (Artifact Environment)
- Available hooks: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`
- Available libraries: `d3`, `three`, `lodash`, `recharts`
- **No localStorage/sessionStorage** — React state only
- **No `<form>` tags** — use `onClick`, `onChange` handlers directly
- Tailwind utility classes available for basic styling

### Performance Targets
- 60fps with 150 nodes + 800 edges on mid-range laptop
- `InstancedMesh` (one draw call for all nodes)
- `LineSegments` (one draw call for all edges)
- Throttle raycasting to 30fps (every other frame)
- Force simulation runs synchronously on mount (600 ticks total — 300 per layout), NOT during animation loop

### Quality Tiers (auto-detected on mount)

| Setting | HIGH (desktop) | MEDIUM (tablet/weak laptop) | LOW (phone) |
|---------|---------------|---------------------------|-------------|
| DPR cap | `devicePixelRatio` (native) | 1.5 | 1.0 |
| Particles | ~400 | ~150 | 0 |
| Glow sprites | All nodes | Top-40 by paper count | Selected + neighbors only |
| Edge rendering | All ~700 faint | All ~700 faint | Neighborhood only on hover |
| Node pulse | All nodes | All nodes | Off |

**Detection logic (heuristic on mount):**
```javascript
function detectTier() {
  const isMobile = matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = window.innerWidth < 768;
  if (isMobile || isSmallScreen) return 'LOW';
  if (window.innerWidth < 1200) return 'MEDIUM';
  return 'HIGH';
}
// Apply DPR cap immediately:
renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierConfig.dprCap));
```
DPR capping is the single highest-impact mobile optimization — it's the difference between 15fps and 60fps on phones.

### File Size Budget (~3,600–3,900 lines total, hard cap ~4,000)
| Section | Lines |
|---------|-------|
| Data (compact arrays) | ~500 |
| Custom orbit controls | ~130 |
| Force simulation + dual layout | ~130 |
| Edge normalization + layout/display split | ~40 |
| Three.js scene + animation | ~230 |
| InstancedMesh + edges | ~180 |
| Raycasting + interaction | ~180 |
| Tooltip + Sidebar | ~350 |
| Filters + Search + Size + Layout toggle | ~280 |
| Visual effects (glow, particles, entrance) | ~200 |
| Story mode (guided tour) | ~150 |
| Quality tiers + zoom labels | ~60 |
| Header + Legend + styles | ~100 |
| Main component orchestration | ~100 |

If artifact exceeds ~4,000 lines: cut to 120 diseases, simplify sparkline.

---

## STATE ARCHITECTURE

```
React State (triggers overlay re-render):     Mutable Refs (no re-render):
  hoveredNode: Disease | null                    scene, camera, renderer
  selectedNode: Disease | null                   instancedMesh, edgeGeometry
  activeCategories: Set<string>                  nodePositions[], nodeScales[]
  searchQuery: string                            categoryPositions[], networkPositions[]
  sizeMode: "papers" | "mortality"               animationState (fly-to, entrance, layout lerp)
  layoutMode: "category" | "network"             proxySpheresGroup, orbitControls
                                                 qualityTier: "HIGH" | "MEDIUM" | "LOW"
```

**IMPORTANT:** All visual state (node visibility, scale, brightness) must be derived from a single computed `visibleNodes` array. This prevents state coordination bugs between filter, search, and size toggle.

---

## COLOR SCHEME (DO NOT CHANGE)

```javascript
const CATEGORY_COLORS = {
  tropical:       '#22c55e',
  cancer:         '#ef4444',
  cardiovascular: '#f97316',
  neurological:   '#a855f7',
  respiratory:    '#3b82f6',
  autoimmune:     '#ec4899',
  metabolic:      '#eab308',
  infectious:     '#14b8a6',
  genetic:        '#f472b6',
  mental:         '#8b5cf6',
};
```

---

## STYLE RULES

- **Font:** IBM Plex Mono (import from Google Fonts)
- **Background:** Dark gradient `#06080d` → `#0a1019` → `#0d0f18`
- **UI panels:** `rgba(10,16,30,0.92)` with `backdropFilter: blur(16px)`
- **Borders:** `rgba(255,255,255,0.06)`
- **Text primary:** `#e2e8f0`
- **Text secondary:** `#94a3b8`
- **Text muted:** `#64748b`
- **Text dim:** `#475569`

---

## DATA SCHEMAS

### Disease Object (for diseases.json during development)
```json
{
  "id": "dengue",
  "label": "Dengue",
  "category": "tropical",
  "description": "Mosquito-borne viral infection endemic to tropical regions.",
  "papers": 32400,
  "trend": 12,
  "mortality": 40000,
  "fundingGap": "high",
  "yearlyPapers": [1800, 2100, 2400, 2600, 2900, 3200, 3500, 3800, 4100, 4500]
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique lowercase identifier |
| label | string | Display name |
| category | string | One of 10 categories |
| description | string | 1–2 sentence plain-English description |
| papers | number | Approximate total PubMed publications |
| trend | number | Year-over-year publication change (%) |
| mortality | number | WHO estimated deaths per year |
| fundingGap | string | "high" / "medium" / "low" based on papers-to-mortality ratio |
| yearlyPapers | number[] | 10-year annual publication counts (2014–2024) |

### Connection Object (for connections.json during development)
```json
{
  "source": "dengue",
  "target": "malaria",
  "sharedPapers": 4200,
  "trend": "up"
}
```

### Compact Inline Format (for final artifact embedding)
```javascript
// [id, label, category, description, papers, trend, mortality, fundingGap, yearlyPapers]
const DISEASES = [
  ["dengue","Dengue","tropical","Mosquito-borne viral infection...",32400,12,40000,"high",[1800,2100,2400,2600,2900,3200,3500,3800,4100,4500]],
  // ...
];
// [sourceIndex, targetIndex, sharedPapers, trendCode]  ("u"=up, "d"=down, "s"=stable)
const CONNECTIONS = [[0, 1, 4200, "u"], ...];
```

---

## DISEASE CATEGORIES & TARGET COUNTS

| Category | Color | Example Diseases | Count |
|----------|-------|------------------|-------|
| Tropical / NTD | `#22c55e` | Dengue, Malaria, Chagas, Leprosy, Buruli Ulcer | ~20 |
| Cancer | `#ef4444` | Breast, Lung, Colon, Pancreatic, Leukemia | ~18 |
| Cardiovascular | `#f97316` | Heart Disease, Stroke, Hypertension, Atherosclerosis | ~14 |
| Neurological | `#a855f7` | Alzheimer's, Parkinson's, Epilepsy, MS | ~14 |
| Respiratory | `#3b82f6` | Asthma, COPD, Pneumonia, Tuberculosis | ~12 |
| Autoimmune | `#ec4899` | Lupus, Rheumatoid Arthritis, Crohn's, Celiac | ~12 |
| Metabolic | `#eab308` | Diabetes (T1/T2), Obesity, Gout, NAFLD | ~12 |
| Infectious | `#14b8a6` | HIV/AIDS, COVID-19, Hepatitis, Influenza | ~16 |
| Genetic | `#f472b6` | Cystic Fibrosis, Sickle Cell, Down Syndrome | ~12 |
| Mental Health | `#8b5cf6` | Depression, Schizophrenia, PTSD, Anxiety | ~12 |
| **TOTAL** | | | **~142–150** |

---

## BUILD SESSIONS (execute strictly in order)

---

### SESSION 1: Project Setup + Data Curation

**Goal:** Create project structure, local dev environment, and the full curated dataset.

#### Tasks
| # | Task | Details | Output |
|---|------|---------|--------|
| 1.1 | Create project structure | `medgalaxy/` with `data/`, `src/` subdirectories. Docs stay at root. | Directory tree |
| 1.2 | Set up Vite + React | `npm create vite`, install `three`, `d3`, `lodash`. Configure `MedGalaxy.jsx` as entry | `package.json`, hot reload |
| 1.3 | Define disease list | Select ~150 diseases across 10 categories, prioritizing well-known diseases + important NTDs | Disease list |
| 1.4 | Gather publication counts | Approximate paper counts from PubMed manual searches for each disease | Data in JSON |
| 1.5 | Gather mortality data | WHO GHO estimates for deaths/year per disease | Data in JSON |
| 1.6 | Generate yearly trend data | 10-year publication arrays per disease (2014–2024) | Data in JSON |
| 1.7 | Compute co-occurrence matrix | Identify which disease pairs share research, estimate shared paper counts | Data in JSON |
| 1.8 | Add descriptions | 1–2 sentence plain-English description per disease | Data in JSON |
| 1.9 | Classify funding gaps | Label each disease as HIGH/MED/LOW funding gap based on papers-to-mortality ratio | Data in JSON |
| 1.10 | Compile final dataset | Merge all data into `diseases.json` and `connections.json` | Two JSON files |
| 1.11 | Validate dataset | All connection IDs exist in diseases, category distribution 12–20 each, paper counts span hundreds to 400k+ | Validation pass |

#### Acceptance Criteria
- [ ] 140–160 diseases with complete metadata (all fields populated)
- [ ] 600–800 connections with shared paper counts
- [ ] All 10 categories represented with 12–20 diseases each
- [ ] Data clearly labeled as approximate
- [ ] Vite dev server runs with hot reload
- [ ] Paper counts range from ~hundreds (rare NTDs) to 400,000+ (breast cancer)
- [ ] Mortality ranges from 0 (some genetic) to 600,000+ (heart disease)

---

### SESSION 2: Three.js Scene + Force Layout

**Goal:** 150 colored spheres clustered by category, connected by edges, with smooth orbit camera. 60fps.

#### Tasks
| # | Task | Details |
|---|------|---------|
| 2.1 | Create JSX skeleton | React component with `useRef` for canvas container, `useEffect` for Three.js init |
| 2.2 | Initialize Three.js | Scene, WebGLRenderer (antialias, alpha), PerspectiveCamera (fov 60, near 1, far 5000, z 800) |
| 2.3 | Custom orbit controls | Self-contained class using spherical coordinates. Left-drag → rotate, scroll → zoom, right-drag → pan. Damping (velocity *= 0.92/frame). **TEST THIS FIRST before adding nodes.** |
| 2.4 | Lighting | Ambient light (0.4 intensity) + point light following camera position |
| 2.5 | Node rendering | InstancedMesh: `SphereGeometry(1, 16, 16)` + `MeshPhongMaterial` (emissive per category). Per-instance: position, scale (`log10(papers)`), color |
| 2.6 | Edge rendering | `LineSegments`: `BufferGeometry`, one draw call for all display edges. `LineBasicMaterial`, white, opacity 0.08 |
| 2.7 | Edge normalization | Compute cosine score per edge. Split into layoutEdges (top-7 per node) and displayEdges (all). |
| 2.8 | Dual force layout | Run Category View sim (300 ticks) → store `categoryPositions`. Run Network View sim (300 ticks, no category forces) → store `networkPositions`. Apply Category View positions as default. |
| 2.9 | Quality tier detection | Detect HIGH/MEDIUM/LOW on mount. Apply DPR cap to renderer. Store tier in ref. |
| 2.10 | Background | CSS dark gradient (`#06080d` → `#0d0f18`) |
| 2.11 | Resize + animation loop | `ResizeObserver` on container, `requestAnimationFrame` render loop |

#### InstancedMesh Pattern
```javascript
const geometry = new THREE.SphereGeometry(1, 16, 16);
const material = new THREE.MeshPhongMaterial({ emissive: color, emissiveIntensity: 0.3 });
const mesh = new THREE.InstancedMesh(geometry, material, COUNT);

const matrix = new THREE.Matrix4();
matrix.compose(position, quaternion, scale);
mesh.setMatrixAt(index, matrix);
mesh.setColorAt(index, new THREE.Color(color));
mesh.instanceMatrix.needsUpdate = true;
```

#### Acceptance Criteria
- [ ] 150 colored spheres visible in 3D space
- [ ] Nodes form visible clusters by category (Category View)
- [ ] Highly connected diseases sit close together (both layouts)
- [ ] Graph is roughly spherical (uses all 3 dimensions)
- [ ] Orbit, zoom, pan all work smoothly with damping
- [ ] 60fps on mid-range hardware (quality tier applied)
- [ ] Edges visible between connected nodes (faint by default)
- [ ] Dark background
- [ ] Both categoryPositions and networkPositions pre-computed and stored

---

### SESSION 3: Raycasting + Tooltip + Sidebar

**Goal:** Hover shows tooltip, click opens detail sidebar with full disease data.

#### Tasks
| # | Task | Details |
|---|------|---------|
| 3.1 | Proxy sphere array | Array of invisible `Mesh(SphereGeometry, MeshBasicMaterial({visible: false}))` at each node position, in a `Group` |
| 3.2 | Raycaster | Three.js Raycaster on `mousemove` (throttled every 2 frames). Cast ray, intersect proxy spheres, map to disease index |
| 3.3 | Click detection | `mousedown`+`mouseup` distance check to distinguish click from orbit drag |
| 3.4 | Hover feedback | Brighten hovered node emissive, dim non-connected nodes, brighten connected edges |
| 3.5 | Camera fly-to | On click, lerp toward selected node (50 frames, exponential ease-out) |
| 3.6 | Tooltip | React, `position: fixed`. Shows: name, category badge, paper count + trend, connection count |
| 3.7 | Sidebar | React, 320px, slides from right via CSS transform |
| 3.8 | Stats grid | 2×2: Publications (+ trend), Connections, WHO Deaths/yr, Funding Gap badge |
| 3.9 | Sparkline | SVG polyline from `yearlyPapers`, gradient fill, year labels |
| 3.10 | PubMed link | `https://pubmed.ncbi.nlm.nih.gov/?term={encodeURIComponent(label)}&sort=date` → new tab |
| 3.11 | Connections list | Sorted by sharedPapers desc. Colored dot, disease name, shared count, trend arrow. Clickable → switches focus |
| 3.12 | Close behavior | X button, clicking same node, or clicking empty space all deselect |
| 3.13 | Cursor style | `pointer` on hover, `grab` on drag, `default` otherwise |

#### Tooltip Positioning
```javascript
const vector = node.position.clone().project(camera);
const rect = canvas.getBoundingClientRect();
const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
const y = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
// Position tooltip at (x + 15, y + 15) with boundary clamping
```

#### Acceptance Criteria
- [ ] Hovering a node highlights it within 1 frame
- [ ] Connected nodes and edges highlight on hover
- [ ] Click triggers smooth camera fly-to
- [ ] Tooltip shows correct data at projected screen position
- [ ] Sidebar slides in smoothly with all sections (stats, sparkline, connections)
- [ ] PubMed link opens in new tab
- [ ] Clicking connection in sidebar switches focus
- [ ] Clicking empty space deselects

---

### SESSION 4: Filters, Search & Size Toggle

**Goal:** Category filters, disease search, the "aha moment" papers↔mortality toggle, and the Category↔Network layout toggle.

#### Tasks
| # | Task | Details |
|---|------|---------|
| 4.1 | Filter state | React `useState`: `activeCategories` (Set of all 10), `searchQuery` (string), `sizeMode` ("papers" \| "mortality"), `layoutMode` ("category" \| "network") |
| 4.2 | Category filter bar | "ALL" + 10 toggle buttons with colored dots. Deselected → animate node scale to 0, hide edges |
| 4.3 | Search bar | Text input with fuzzy matching. Matching nodes brighten, non-matching dim |
| 4.4 | Search autocomplete | Dropdown showing top 8 matches. Enter/click → camera flies to match, opens sidebar |
| 4.5 | Size toggle | "Papers" vs "Mortality". Recalculates all node scales, animates over 60 frames |
| 4.6 | Layout toggle | "Category" vs "Network". Lerps all node positions between pre-computed `categoryPositions` and `networkPositions` over 60 frames. Updates edge positions each frame during lerp. |
| 4.7 | Zoom-based labels | Show persistent HTML labels for top ~15 diseases when zoomed out. Increase to ~30–40 at medium zoom. Hovered/selected always labeled. LOW tier: neighborhood labels only. |
| 4.8 | State composition | All controls compose: filter + search + size + layout work together. Derive visuals from single `visibleNodes` array |

#### Size Calculation
```javascript
// Papers mode:
radius = Math.log10(papers) * scaleFactor

// Mortality mode:
radius = Math.log10(mortality + 1) * scaleFactor

// Transition: lerp between old and new radius over 60 frames
```

#### Acceptance Criteria
- [ ] Toggling a category smoothly hides/shows those nodes
- [ ] Search highlights and flies to matching disease
- [ ] Autocomplete dropdown shows matches
- [ ] Size toggle visibly rebalances graph (cancer shrinks, malaria grows)
- [ ] Layout toggle smoothly transitions between Category and Network views
- [ ] Network View shows emergent clusters (HIV near TB, dengue near Zika)
- [ ] Top ~15 disease labels visible when zoomed out
- [ ] All three controls work together without visual glitches

---

### SESSION 5: Visual Polish + Final Assembly

**Goal:** Glow, particles, animations, entrance sequence. Ship-ready artifact.

#### Tasks
| # | Task | Details |
|---|------|---------|
| 5.1 | Faked bloom | Glow Sprites with `AdditiveBlending` behind nodes. Programmatic radial gradient texture (canvas-generated), category-colored |
| 5.2 | Node pulse | Sinusoidal scale oscillation (±3%, 3–5s period, random phase offsets) |
| 5.3 | Background particles | ~400 `Points` in large sphere (radius 2000), `PointsMaterial`, slow rotation |
| 5.4 | Auto-rotate | After 5s idle, gentle orbit (0.001 rad/frame). Stops on interaction |
| 5.5 | Entrance choreography | Full sequence: (1) slow auto-pan/rotate starts immediately, (2) nodes stagger scale-up (0→full, 1-frame delay), (3) edges fade in after 50% of nodes, (4) header slides down, filter bar slides down, legend slides up (staggered CSS transitions, 150ms apart), (5) auto-pan stops, (6) story mode chips appear. ~2.5 seconds total. |
| 5.6 | Header bar | Title: "MedGalaxy — Disease Research Network", pulsing green dot, node/edge count |
| 5.7 | Legend bar | Dynamic text for size mode, interaction hints: "Drag to rotate · Scroll to zoom" |
| 5.8 | Final data embedding | Convert JSON → compact inline arrays. Target under 550 lines |
| 5.9 | Performance audit | Verify 60fps. Fallback: reduce particles, limit glow to top-40 nodes |
| 5.10 | Artifact compatibility | Verify single JSX works in Claude.ai: no `localStorage`/`fetch`/`<form>`, no OrbitControls/EffectComposer imports |
| 5.11 | Story mode | 3 guided-tour chips on first load. Each triggers scripted fly-to sequence with captions. "See the Mismatch" delivers the thesis and prompts the mortality toggle. See STORY MODE section for full spec. |

#### Bloom Fallback
EffectComposer/UnrealBloomPass NOT available in artifact env. Instead:
- `MeshPhongMaterial` with `emissive` and `emissiveIntensity`
- Sprite halos with `AdditiveBlending` behind each node
- Programmatic radial gradient texture (canvas-generated)
- Achieves ~80% of bloom look at zero extra render passes.

If 150 glow sprites cause frame drops: use `Points` geometry for halos, or limit to top-40 nodes by paper count.

#### Acceptance Criteria
- [ ] Nodes glow softly against dark background
- [ ] Scene feels alive (pulsing, drifting particles)
- [ ] Entrance animation creates a "wow" on first load
- [ ] All transitions smooth (no pops or jumps)
- [ ] 60fps with all effects active
- [ ] Works both locally (Vite) and as Claude.ai artifact
- [ ] Story mode chips appear after entrance animation
- [ ] "See the Mismatch" spotlight delivers the aha moment and prompts toggle
- [ ] Story mode dismisses on click/Escape or after completing

---

## STORY MODE (Guided First-Visit Experience)

On first load, after the entrance animation completes, show a translucent overlay with 3 clickable chips:

| Chip Label | What It Does |
|-----------|--------------|
| "Most Researched" | Flies to breast cancer (huge sphere), then lung cancer, then leukemia. Caption: "These diseases have 100,000+ papers each." |
| "Biggest Killers" | Flies to heart disease, then malaria, then tuberculosis. Caption: "These diseases kill hundreds of thousands per year." |
| "See the Mismatch" | Flies to breast cancer (large), then Buruli ulcer (tiny speck nearby). Caption: "130× more papers, far fewer deaths. Now toggle Mortality →" Pulses the size toggle button. |

### Story Mode Behavior
- Each chip triggers a scripted sequence: 2–3 auto fly-to animations with short captions (1 line, overlaid on the 3D scene)
- Each spotlight holds for ~3 seconds before advancing
- User can click anywhere or press Escape to exit story mode and explore freely
- After the final spotlight, story mode dismisses automatically
- Story mode does NOT re-trigger on subsequent visits (track with React state, not localStorage)
- "See the Mismatch" chip is visually highlighted (brighter border, subtle pulse) — this is the one that delivers the thesis

### Why This Exists
The success criteria say "understand within 30 seconds" and "aha moment on toggle." Story mode guarantees both happen without relying on the user discovering the toggle independently. It's a 15-second guided tour, not a tutorial.

### Implementation Notes
- Pure React state + animation refs — no localStorage, no backend
- Chips render as simple `<div>` buttons over the canvas, same styling as category filter bar
- Fly-to uses the same camera lerp function from Session 3 (task 3.5)
- Captions are positioned center-bottom, semi-transparent background, fade in/out
- Total addition: ~150 lines (fits within Session 5 budget)

---

## INTERACTION SPEC

### Hover
- Tooltip at projected 2D screen position of node (via `vector.project(camera)` + canvas bounding rect)
- Shows: name, category badge (colored), paper count + trend arrow, connection count
- Non-interactive (no clickable elements in tooltip)
- Disappears immediately on mouse leave

### Click
- Sidebar slides in from right (320px wide)
- Camera smoothly flies toward clicked node (50 frames, exponential ease-out)
- Shows: name, description, stats grid (2×2), sparkline, PubMed link, connections list
- Clicking a disease in connections list → switches focus to that node
- PubMed link: `https://pubmed.ncbi.nlm.nih.gov/?term={encodeURIComponent(label)}&sort=date`
- Distinguish click from drag via `mousedown`+`mouseup` distance check

### Drag Node
- Left-click + drag on a node → move that node in 3D space
- Other nodes react via force simulation
- Must not conflict with orbit controls (orbit = drag on empty space, node drag = drag on node)

### Zoom-Based Labels (top diseases always visible)
- When zoomed out: show persistent HTML labels for the top ~15 diseases by paper count (e.g., breast cancer, HIV, malaria, Alzheimer's)
- Labels are simple `<div>` overlays positioned via `vector.project(camera)`, same as tooltip
- As camera zooms in: show more labels (up to ~30–40 visible at medium zoom)
- Hovered/selected node + its neighbors always show labels regardless of zoom
- On LOW quality tier: only show labels for hovered/selected neighborhood
- Labels use text-shadow for legibility against dark background, small font (9–10px)

### Edge LOD (Level of Detail)
- **Default:** All display edges rendered faint (opacity ~0.08)
- **Hover:** Brighten only hovered node's neighbor edges; optionally hide all other edges
- **Selected:** Keep selected node's neighborhood edges bright until deselected
- **LOW tier:** Hide global edges entirely; show only neighborhood edges on hover/select

### Layout Toggle
- "Category" ↔ "Network" toggle in header
- On toggle: lerp all node positions between `categoryPositions` and `networkPositions` over 60 frames
- Both position arrays pre-computed on mount (no re-simulation needed)
- Edges re-render at new positions each frame during lerp

---

## UI COMPONENTS

### Header Bar
- Title: "MedGalaxy — Disease Research Network"
- Green status dot (pulsing CSS animation)
- Node/edge count label
- Search input (right side)
- Size toggle: "Papers" | "Mortality" (right side)
- Layout toggle: "Category" | "Network" (right side, next to size toggle)

### Category Filter Bar
- Below header
- "ALL" button + one button per category with colored dot
- Multi-select toggle behavior

### Sidebar Sections (top to bottom)
1. Disease name + category badge + close button
2. Description paragraph (11px, muted color)
3. Stats grid (2×2): Publications, Connections, WHO Deaths, Funding Gap
4. Sparkline (SVG, 10 data points, gradient fill)
5. PubMed link button (colored to match category)
6. Connections list (scrollable, sorted by shared papers desc)

### Legend Bar (bottom)
- "Node size = publications" (or mortality, dynamic based on toggle)
- "Line thickness = shared papers"
- "Drag to rotate · Scroll to zoom"

---

## RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Custom orbit controls math wrong | Critical | Implement as isolated class, test rotation/zoom/pan BEFORE adding nodes |
| Artifact exceeds ~4000 lines | High | Track line count; cut to 120 diseases, simplify sparkline |
| Force sim produces bad layout | High | d3-force is proven for 2D; Z is simple category banding; fallback to deterministic Z |
| Glow sprites kill performance | Medium | Use Points geometry instead, or limit to top-40 nodes |
| InstancedMesh raycasting complex | Medium | Proxy sphere array (decided) |
| State coordination bugs (filter+search+size) | Medium | Derive ALL visuals from single computed `visibleNodes` array |
| Three.js post-processing unavailable | Low | Emissive + sprite halos (decided) |
| Mobile touch events | Low | Map touch to orbit controls (stretch goal) |

---

## TESTING CHECKLIST (verify after each session)

- [ ] No console errors
- [ ] 60fps in Chrome DevTools performance tab
- [ ] All nodes visible and correctly colored
- [ ] Orbit/zoom/pan smooth with damping
- [ ] (Session 3+) Hover tooltip shows correct data at correct position
- [ ] (Session 3+) Click sidebar shows all sections with correct data
- [ ] (Session 4+) Filters, search, and size toggle work in combination
- [ ] (Session 5) Entrance animation, glow, particles, auto-rotate active
- [ ] (Session 5) PubMed links open correctly in new tab
- [ ] (Session 5) Works both locally and as Claude.ai artifact

---

## DEPLOYMENT

- **Platform:** Vercel (free tier) — static hosting only, no backend
- **Build:** `npm run build` → `dist/` output (auto-detected by Vercel)
- **Custom domain:** e.g. `medgalaxy.russellgenetics.com` (configure in Vercel dashboard)
- **Auto-deploy:** Push to `main` on GitHub triggers redeployment
- **Also works as:** Claude.ai artifact (paste single `.jsx`) and local Vite dev server

---

## SUCCESS CRITERIA

1. The visualization **instantly communicates research inequality** between cancer and NTDs
2. A user can **find any disease within 5 seconds** (via search or visual exploration)
3. Clicking a disease provides **enough context to understand its research landscape**
4. 3D interaction feels **smooth and satisfying** — no jank, no lag, 60fps
5. Someone with **no science background can understand** the visualization within 30 seconds
6. The **"Size by Mortality" toggle creates an "aha moment"** about funding misallocation

---

## FUTURE ENHANCEMENTS (do not build these now)

1. Live PubMed API integration — real-time paper counts
2. Time slider — scrub through years, watch network evolve
3. "Add Disease" button — user adds disease, app queries PubMed
4. Export — screenshot or data export
5. VR mode — WebXR for immersive exploration
6. Indonesia overlay — filter to diseases prevalent in Indonesia
