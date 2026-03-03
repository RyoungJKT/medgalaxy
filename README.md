# MedGalaxy — PubMed Disease Research Network

An interactive 3D force-directed graph that maps global disease research from PubMed — revealing connections between diseases through shared publications and exposing research inequality between well-funded diseases and neglected tropical diseases.

## Quick Start

```bash
npm install
npm run dev
```

> **Note:** The Vite project will be scaffolded during Session 1 of the build plan. Until then, this directory contains documentation only.

## Documentation

| Document | Role | Description |
|----------|------|-------------|
| [`MEDGALAXY_MASTER_PROMPT.md`](MEDGALAXY_MASTER_PROMPT.md) | **Canonical spec** | Single source of truth. Feed this to any agentic coding platform to build the project. |
| [`BUILD_PLAN.md`](BUILD_PLAN.md) | Execution checklist | Session tasks and acceptance criteria. Defers to master prompt on conflicts. |
| [`CLAUDE.md`](CLAUDE.md) | Quick reference | Artifact environment constraints only. Defers to master prompt on conflicts. |
| [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) | Context | What the project is and why it matters. |

## Project Structure (after Session 1)

```
medgalaxy/
├── README.md                      ← This file
├── MEDGALAXY_MASTER_PROMPT.md     ← Canonical spec (source of truth)
├── BUILD_PLAN.md                  ← Execution checklist
├── CLAUDE.md                      ← Artifact constraints quick reference
├── PROJECT_BRIEF.md               ← Project context and motivation
├── package.json                   ← Vite + React + Three.js deps
├── index.html
├── vite.config.js
├── data/
│   ├── diseases.json              ← Disease metadata (~150 diseases)
│   └── connections.json           ← Co-occurrence links (~700 connections)
└── src/
    └── MedGalaxy.jsx              ← Single-file artifact (Sessions 2-5)
```

## Build Sessions

1. **Project Setup + Data Curation** — Vite dev server, ~150 diseases, ~700 connections
2. **Three.js Scene + Force Layout** — 3D spheres, edges, custom orbit controls, d3-force 2D + Z clustering
3. **Raycasting + UI Overlays** — Hover tooltip, click sidebar with stats/sparkline/connections
4. **Filters, Search & Size Toggle** — Category toggles, search autocomplete, papers↔mortality switch
5. **Visual Polish + Final Assembly** — Glow, particles, entrance animation, artifact compatibility pass

## Tech Stack

- React 18 + Vite (local dev)
- Three.js r128 (WebGL)
- d3-force (2D simulation) + custom Z-dimension clustering
- Custom orbit controls + proxy-sphere raycasting
- Single-file artifact (dual-target: local + Claude.ai)

## Deployment

- **Vercel** (free tier) — static hosting, auto-deploy from GitHub
- Also works as a **Claude.ai artifact** (paste single `.jsx`)
