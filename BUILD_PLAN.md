# MedGalaxy — Build Plan (Execution Checklist)

> **Canonical spec:** `MEDGALAXY_MASTER_PROMPT.md` is the single source of truth for all decisions, constraints, and technical details.
> This file is the **execution checklist** — session tasks and acceptance criteria only.
> If anything here conflicts with the master prompt, **the master prompt wins**.

---

## Session Summary

| Session | Name | Key Deliverable |
|---------|------|----------------|
| 1 | Setup + Data | Vite project + `diseases.json` + `connections.json` |
| 2 | Scene + Force | Dual-layout force sim, colored spheres, orbit camera, quality tiers, 60fps |
| 3 | Raycasting + UI | Hover tooltip + click sidebar with stats/sparkline/connections |
| 4 | Filters + Search | Category toggles, search, papers↔mortality toggle, Category↔Network toggle, zoom labels |
| 5 | Polish + Assembly | Glow, particles, entrance animation, story mode, final artifact |

---

### SESSION 1: Project Setup + Data Curation
**Goal:** Create project structure, local dev environment, and the full dataset.

| # | Task | Details | Output |
|---|------|---------|--------|
| 1.1 | Create project structure | `medgalaxy/` with `data/`, `src/` subdirectories | Directory tree |
| 1.2 | Set up Vite + React | `npm create vite`, install `three`, `d3`, `lodash` | `package.json`, hot reload |
| 1.3 | Define disease list | ~150 diseases across 10 categories | Disease list |
| 1.4 | Gather publication counts | Approximate PubMed paper counts | Data in JSON |
| 1.5 | Gather mortality data | WHO GHO deaths/year estimates | Data in JSON |
| 1.6 | Generate yearly trends | 10-year publication arrays (2014–2024) | Data in JSON |
| 1.7 | Compute co-occurrences | Disease pairs that share research | Data in JSON |
| 1.8 | Add descriptions | 1–2 sentence description per disease | Data in JSON |
| 1.9 | Classify funding gaps | HIGH/MED/LOW per disease | Data in JSON |
| 1.10 | Compile dataset | Merge into `diseases.json` + `connections.json` | Two JSON files |
| 1.11 | Validate | IDs match, categories balanced, counts realistic | Validation pass |

**Acceptance Criteria:**
- [ ] 140–160 diseases with complete metadata
- [ ] 600–800 connections with shared paper counts
- [ ] All 10 categories represented with 12–20 diseases each
- [ ] Data clearly labeled as approximate
- [ ] Vite dev server runs with hot reload

---

### SESSION 2: Three.js Scene + Force Layout
**Goal:** 150 colored spheres with dual-layout force sim, orbit camera, quality tiers. 60fps.

| # | Task | Details |
|---|------|---------|
| 2.1 | JSX skeleton | React component with `useRef` + `useEffect` for Three.js |
| 2.2 | Initialize Three.js | Scene, Renderer, PerspectiveCamera (fov 60, z 800) |
| 2.3 | Custom orbit controls | Spherical coords, left-drag rotate, scroll zoom, right-drag pan, damping 0.92. **TEST FIRST.** |
| 2.4 | Lighting | Ambient (0.4) + point light following camera |
| 2.5 | Node rendering | InstancedMesh with per-instance position, scale, color |
| 2.6 | Edge rendering | LineSegments, one draw call, display edges at opacity ~0.08 |
| 2.7 | Edge normalization | Cosine score per edge. Split into layoutEdges (top-7/node) and displayEdges (all) |
| 2.8 | Dual force layout | Category View sim (300 ticks) → store positions. Network View sim (300 ticks, no category forces) → store positions. Apply Category as default. |
| 2.9 | Quality tier detection | Detect HIGH/MEDIUM/LOW on mount. Apply DPR cap. |
| 2.10 | Background | CSS dark gradient |
| 2.11 | Resize + loop | ResizeObserver + requestAnimationFrame |

**Acceptance Criteria:**
- [ ] 150 colored spheres visible in 3D
- [ ] Visible clusters by category (Category View)
- [ ] Orbit, zoom, pan smooth with damping
- [ ] 60fps (quality tier applied)
- [ ] Edges visible (faint by default)
- [ ] Dark background
- [ ] Both categoryPositions and networkPositions pre-computed

---

### SESSION 3: Raycasting + Tooltip + Sidebar
**Goal:** Hover shows tooltip with edge LOD, click opens detail sidebar.

| # | Task | Details |
|---|------|---------|
| 3.1 | Proxy spheres | Invisible meshes at node positions |
| 3.2 | Raycaster | Throttled mousemove, intersect proxies |
| 3.3 | Click detection | mousedown+mouseup distance check |
| 3.4 | Hover feedback | Brighten node + neighbor edges, dim non-connected. Edge LOD: neighborhood only on hover. |
| 3.5 | Camera fly-to | Lerp toward clicked node, 50 frames |
| 3.6 | Tooltip | Projected screen coords, name/category/papers/connections |
| 3.7 | Sidebar | 320px right panel, CSS slide-in |
| 3.8 | Stats grid | 2×2: Publications, Connections, Deaths, Funding Gap |
| 3.9 | Sparkline | SVG polyline from yearlyPapers |
| 3.10 | PubMed link | Opens search in new tab |
| 3.11 | Connections list | Sorted, clickable to switch focus |
| 3.12 | Close behavior | X, re-click, or click empty space |
| 3.13 | Cursor style | pointer/grab/default |

**Acceptance Criteria:**
- [ ] Hover highlights within 1 frame
- [ ] Neighbor edges brighten on hover (edge LOD)
- [ ] Smooth fly-to on click
- [ ] Tooltip at correct position with correct data
- [ ] Sidebar with all sections
- [ ] PubMed link works
- [ ] Connection click switches focus
- [ ] Click empty deselects

---

### SESSION 4: Filters, Search, Size Toggle & Layout Toggle
**Goal:** Category filters, search, papers↔mortality toggle, Category↔Network layout toggle, zoom labels.

| # | Task | Details |
|---|------|---------|
| 4.1 | Filter state | activeCategories, searchQuery, sizeMode, layoutMode |
| 4.2 | Category filter bar | "ALL" + 10 toggles with colored dots |
| 4.3 | Search bar | Fuzzy matching, brighten matches |
| 4.4 | Autocomplete | Top 8 matches, fly-to on select |
| 4.5 | Size toggle | Papers vs Mortality, animate scales over 60 frames |
| 4.6 | Layout toggle | Category vs Network, lerp positions over 60 frames using pre-computed arrays |
| 4.7 | Zoom-based labels | Top ~15 diseases labeled when zoomed out. More at medium zoom. Hover/selected always labeled. |
| 4.8 | State composition | All controls compose via single `visibleNodes` array |

**Acceptance Criteria:**
- [ ] Category toggle smoothly hides/shows nodes
- [ ] Search highlights and flies to match
- [ ] Autocomplete dropdown works
- [ ] Size toggle rebalances graph (cancer shrinks, malaria grows)
- [ ] Layout toggle smoothly transitions between Category and Network views
- [ ] Network View shows emergent clusters (HIV near TB, dengue near Zika)
- [ ] Top ~15 disease labels visible when zoomed out
- [ ] All four controls work together

---

### SESSION 5: Visual Polish + Final Assembly
**Goal:** Glow, particles, animations, entrance, story mode. Ship-ready artifact.

| # | Task | Details |
|---|------|---------|
| 5.1 | Faked bloom | Glow sprites with AdditiveBlending (respect quality tier) |
| 5.2 | Node pulse | ±3% sinusoidal, 3–5s period (off on LOW tier) |
| 5.3 | Particles | Points system (HIGH: ~400, MEDIUM: ~150, LOW: 0) |
| 5.4 | Auto-rotate | 0.001 rad/frame after 5s idle |
| 5.5 | Entrance choreography | Slow auto-pan starts → nodes stagger in → edges fade in → UI slides in (header, filters, legend staggered) → pan stops → story chips appear. ~2.5s total. |
| 5.6 | Header bar | Title, pulsing green dot, counts |
| 5.7 | Legend bar | Dynamic size/layout mode text, interaction hints |
| 5.8 | Data embedding | JSON → compact inline arrays, <550 lines |
| 5.9 | Performance audit | Verify 60fps per tier, apply fallbacks if needed |
| 5.10 | Artifact compatibility | No localStorage/fetch/form, no unavailable imports |
| 5.11 | Story mode | 3 guided-tour chips; scripted fly-to with captions; "See the Mismatch" delivers thesis |

**Acceptance Criteria:**
- [ ] Soft glow on nodes (tier-appropriate)
- [ ] Scene feels alive (pulse, particles)
- [ ] Entrance animation "wow"
- [ ] Smooth transitions
- [ ] 60fps with all effects (per quality tier)
- [ ] Works locally and as Claude.ai artifact
- [ ] Story mode chips appear after entrance, "See the Mismatch" delivers aha moment

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Custom orbit controls math wrong | Critical | Test rotation/zoom/pan BEFORE adding nodes |
| Artifact exceeds ~4000 lines | High | Track line count; cut to 120 diseases if needed |
| Force sim bad layout | High | d3-force proven for 2D; cosine normalization prevents mega-blob |
| Dual layout adds too many lines | Medium | Pre-compute both on mount; lerp is ~30 lines |
| Glow sprites kill perf | Medium | Quality tiers auto-limit; Points fallback |
| State coordination bugs | Medium | Derive all visuals from single `visibleNodes` |
| Mobile perf | Medium | Quality tier auto-detect + DPR capping |

---

## Deployment

- **Platform:** Vercel (free tier), static hosting
- **Build:** `npm run build` → `dist/`
- **Custom domain:** e.g. `medgalaxy.russellgenetics.com`
- **Auto-deploy:** Push to `main` triggers redeployment
- **Also works as:** Claude.ai artifact + local Vite dev server
