# CLAUDE.md — Artifact Constraints Quick Reference

> **Canonical spec:** `MEDGALAXY_MASTER_PROMPT.md` is the single source of truth.
> This file is a quick-reference for constraints specific to the Claude.ai artifact environment.
> If anything here conflicts with the master prompt, **the master prompt wins**.

## Build Order
Follow the sessions in `BUILD_PLAN.md` strictly in order:
1. Project Setup + Data Curation
2. Three.js Scene + Force Layout (+ dual layout, edge normalization, quality tiers)
3. Raycasting + Tooltip + Sidebar (+ edge LOD)
4. Filters, Search, Size Toggle & Layout Toggle (+ zoom labels)
5. Visual Polish + Final Assembly (+ story mode)

## Artifact Environment Constraints

### What's Available
- `import * as THREE from 'three'` (r128)
- `import * as d3 from 'd3'`
- `import _ from 'lodash'`
- `import { ... } from 'recharts'`
- React hooks: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`
- Tailwind utility classes

### What's NOT Available (must work around)
- **OrbitControls** → implement custom orbit controls (spherical coords + damping)
- **EffectComposer / UnrealBloomPass** → fake bloom with emissive materials + sprite halos
- **d3-force-3d** → use d3-force 2D + manual Z clustering
- **THREE.CapsuleGeometry** → not in r128, do not use
- **localStorage / sessionStorage** → React state only
- **`<form>` tags** → use `onClick`, `onChange` handlers
- **`fetch()` / network requests** → all data embedded inline
- No other Three.js addon imports

## Key Technical Decisions

### Edge Score Normalization
Raw `sharedPapers` biases toward high-volume diseases. Normalize all edge scores:
```javascript
edge.score = edge.sharedPapers / Math.sqrt(sourceNode.papers * targetNode.papers);
```
Use `score` (not raw `sharedPapers`) for all layout and visual strength calculations.

### Layout Edges vs Display Edges
- **layoutEdges:** Top-7 per node by normalized `score` → feed into `forceLink`
- **displayEdges:** All ~700 edges → rendered faint (opacity ~0.08), brighten on hover/select

### Dual Layout Modes
Pre-compute two layouts on mount, store both position arrays, lerp between on toggle:
- **Category View (default):** d3-force 2D with category clustering forces + manual Z
- **Network View:** Same sim without category forces — organic emergent clusters

### Quality Tiers (auto-detected on mount)
| Setting | HIGH (desktop) | MEDIUM (tablet) | LOW (phone) |
|---------|---------------|-----------------|-------------|
| DPR cap | native | 1.5 | 1.0 |
| Particles | ~400 | ~150 | 0 |
| Glow sprites | All nodes | Top-40 | Selected + neighbors |
| Edge rendering | All faint | All faint | Neighborhood only |
| Node pulse | All | All | Off |

### Performance Targets
- 60fps with 150 nodes + 800 edges (per quality tier)
- `InstancedMesh` (one draw call for all nodes)
- `LineSegments` (one draw call for all edges)
- Throttle raycasting to 30fps (every other frame)
- Force simulation: 600 ticks synchronous on mount (300 per layout), NOT during animation

### File Size Budget
~3,600–3,900 lines target. Hard cap ~4,000 lines.
If over: cut to 120 diseases, simplify sparkline.

## Deployment
- **Platform:** Vercel (free tier) — static hosting, no backend
- **Build:** `npm run build` → `dist/`
- **Domain:** e.g. `medgalaxy.russellgenetics.com`
- **Also works as:** Claude.ai artifact (paste single `.jsx`) and local Vite dev server

## Testing Checklist
After each session, verify:
- [ ] No console errors
- [ ] 60fps in Chrome DevTools performance tab
- [ ] All nodes visible and correctly colored
- [ ] Orbit/zoom/pan smooth with damping
- [ ] (Session 2+) Both category and network positions pre-computed
- [ ] (Session 3+) Hover tooltip shows correct data at correct position
- [ ] (Session 3+) Click sidebar shows all sections with correct data
- [ ] (Session 3+) Edge LOD: neighborhood edges brighten on hover
- [ ] (Session 4+) Filters, search, size toggle, and layout toggle work in combination
- [ ] (Session 4+) Zoom-based labels visible for top diseases
- [ ] (Session 5) Entrance animation, glow, particles, auto-rotate active
- [ ] (Session 5) Story mode chips appear; "See the Mismatch" delivers aha moment
- [ ] (Session 5) PubMed links open correctly in new tab
- [ ] (Session 5) Works both locally and as Claude.ai artifact
