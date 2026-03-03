# MedGalaxy — Project Brief

## 1. Project Overview

**Project Name:** MedGalaxy — Disease Research Network
**Type:** Interactive 3D data visualization web application
**Stack:** React 18 + Vite (local dev) / Three.js r128 (WebGL) / d3-force
**Target:** Dual — local dev server with hot reload + Claude.ai single-file artifact
**Inspired By:** GitNexus code repository visualizer + Apple Watch bubble menu

### One-Line Summary
An interactive 3D force-directed graph that maps global disease research output from PubMed, revealing connections between diseases through shared publications and exposing research inequality between well-funded diseases and neglected tropical diseases.

### Why This Matters
- **Research inequality is invisible.** Breast cancer has 400,000+ papers. Buruli ulcer has ~3,000. That 130:1 ratio is hard to grasp in a table — but instantly visible when one node is a massive glowing sphere and the other is a barely-visible speck.
- **Disease connections reveal opportunities.** When dengue and Zika share thousands of co-published papers, it signals shared biology, shared vectors, and potential for drug repurposing — exactly what GeneTropica targets.
- **Bibliometric network analysis is a legitimate research methodology.** This visualization could support academic arguments about funding gaps in neglected tropical disease research.

---

## 2. Target Users

| User | Use Case |
|------|----------|
| Researchers | Explore research landscapes, find co-occurrence patterns, identify understudied connections |
| Students (IB/University) | Visual evidence for essays on global health inequality, research ethics, science policy |
| Science communicators | Compelling visual for presentations about neglected diseases |
| Drug repurposing teams | Identify which disease pairs share research — potential for cross-domain drug candidates |

---

## 3. Data Sources

### Primary: PubMed / MEDLINE
- **What:** Biomedical literature database maintained by NCBI (National Center for Biotechnology Information)
- **Access:** Free via E-utilities API (eutils.ncbi.nlm.nih.gov)
- **Data points per disease:**
  - Total publication count (esearch endpoint)
  - Co-occurrence count with other diseases (esearch with combined terms)
  - Publication trend over time (esearch with date filters)
- **Reliability:** Gold standard for biomedical bibliometrics. Updated daily.
- **Rate limits:** 3 requests/second without API key, 10/second with key (free)

### Secondary: WHO Global Health Observatory
- **What:** Mortality and disease burden estimates by country
- **Use:** "Size by mortality" toggle — compare research attention vs actual death toll
- **Access:** Free API (ghoapi.azureedge.net)

### Supplementary: MeSH (Medical Subject Headings)
- **What:** Controlled vocabulary for categorizing diseases in PubMed
- **Use:** Standardized disease names, hierarchical categories, unique identifiers
- **Access:** Bundled with PubMed data

### For Prototype Phase
- Curated JSON dataset with approximate PubMed counts sourced from manual searches
- ~150 diseases, ~600-800 connections
- Clearly labeled as "approximate data — sourced from PubMed [month/year]"
- Real PubMed API integration planned for future enhancement

### Data Embedding Strategy
- Full JSON files (`diseases.json`, `connections.json`) maintained in `data/` as source of truth during development
- For the final artifact: data embedded inline using compact array-of-arrays encoding (not verbose JSON objects)
- Target: ~150 diseases + ~700 connections in under 550 lines of embedded data
- If artifact rendering hits limits, first reduction: cut to 120 diseases

---

## 4. Core Features

### 4.1 3D Force-Directed Graph (Three.js)
- Diseases rendered as glowing spheres in 3D WebGL space
- Node size = publication count (logarithmic scale)
- Node color = disease category (10 categories)
- Connections rendered as luminous lines between co-published diseases
- Edge scores cosine-normalized (`sharedPapers / sqrt(source.papers * target.papers)`) to prevent high-volume diseases from dominating the layout
- Layout edges (top-7 per node by score) drive the force simulation; all ~700 display edges rendered faintly
- Force simulation in 3D (d3-force 2D + manual Z clustering) so clusters form organically
- Categories gravitationally cluster together (Category View) or form emergent clusters by connection strength (Network View)

### 4.2 Dual Layout Modes
- **Category View (default):** Diseases cluster by category with color-coded groupings — a readable medical map
- **Network View:** Category forces removed — layout driven purely by connection strength, revealing emergent clusters (e.g., HIV near TB, dengue near Zika)
- Both layouts pre-computed on mount (300 ticks each). Toggle lerps all positions over 60 frames.

### 4.3 Camera & Navigation
- **Orbit controls:** Click + drag to rotate entire scene (custom implementation)
- **Zoom:** Scroll with smooth momentum easing
- **Pan:** Right-click + drag
- **Fly-to:** Click a node → camera smoothly animates toward it
- **Auto-rotate:** Gentle ambient rotation when idle (toggleable)
- **Depth-of-field feel:** Distant nodes slightly smaller/dimmer

### 4.4 Hover Tooltip (2D HTML Overlay)
Appears near cursor when hovering a node. Non-interactive (disappears on mouse leave).

| Field | Example |
|-------|---------|
| Disease name | Dengue |
| Category badge | TROPICAL / NTD (colored) |
| Publication count + trend | 32,400 ↑12% |
| Connection count | 28 connections |

Edge LOD on hover: neighborhood edges brighten, non-connected edges stay faint or hide.

### 4.5 Click Sidebar (2D HTML Overlay)
Slides open from right when a node is clicked. Persistent until closed.

| Section | Content |
|---------|---------|
| Header | Disease name, category badge, close button |
| Description | 1-2 sentence summary of the disease |
| Stats Grid (2×2) | Publications (+ trend), Connections, WHO Deaths/yr, Funding Gap (HIGH/MED/LOW) |
| Sparkline | 10-year publication trend (mini line chart) |
| PubMed Link | "View Latest Research on PubMed →" (opens pubmed.ncbi.nlm.nih.gov/?term={disease}&sort=date) |
| Connections List | Sorted by shared papers. Each row: disease name, dot color, shared count, trend arrow |

### 4.6 Filters & Search
- **Category toggle buttons:** Filter to show only tropical, cancer, etc. (multi-select)
- **Search bar:** Type disease name → matching node highlights and camera flies to it
- **Size toggle:** Switch between "Size by Publications" vs "Size by WHO Mortality"
  - This is the most impactful feature — the mismatch between research and death toll is immediately visible
- **Layout toggle:** Switch between "Category" and "Network" views

### 4.7 Zoom-Based Labels
- Top ~15 diseases by paper count always labeled when zoomed out
- More labels (~30–40) appear at medium zoom
- Hovered/selected node + neighbors always labeled regardless of zoom
- Adapts to quality tier (LOW: neighborhood labels only)

### 4.8 Story Mode (Guided First-Visit Experience)
On first load, after the entrance animation, 3 clickable chips appear:
- **"Most Researched"** — Flies to breast cancer, lung cancer, leukemia. Caption: "These diseases have 100,000+ papers each."
- **"Biggest Killers"** — Flies to heart disease, malaria, tuberculosis. Caption: "These diseases kill hundreds of thousands per year."
- **"See the Mismatch"** — Flies to breast cancer then Buruli ulcer. Caption: "130× more papers, far fewer deaths. Now toggle Mortality →" Pulses the size toggle.

Story mode guarantees the "aha moment" without relying on the user discovering the toggle independently.

### 4.9 Visual Polish
- Dark background (deep space aesthetic)
- Faked bloom via emissive materials + sprite halos with AdditiveBlending
- Subtle ambient particle field in background (depth atmosphere)
- Smooth transitions on all state changes (filter, focus, sidebar open/close, layout toggle)
- Node pulse animation (subtle, organic breathing)
- Staggered entrance animation on first load

### 4.10 Quality Tiers (Adaptive Performance)
Auto-detected on mount based on device capabilities:
- **HIGH (desktop):** Full effects — all particles, glow on all nodes, native DPR
- **MEDIUM (tablet/weak laptop):** Reduced particles (~150), glow on top-40 nodes, DPR capped at 1.5
- **LOW (phone):** No particles, glow on selected + neighbors only, DPR capped at 1.0, neighborhood-only edges

DPR capping is the single highest-impact mobile optimization.

---

## 5. Disease Categories & Counts

| Category | Color | Example Diseases | Target Count |
|----------|-------|------------------|-------------|
| Tropical / NTD | `#22c55e` | Dengue, Malaria, Chagas, Leprosy, Buruli Ulcer | 20 |
| Cancer | `#ef4444` | Breast, Lung, Colon, Pancreatic, Leukemia | 18 |
| Cardiovascular | `#f97316` | Heart Disease, Stroke, Hypertension, Atherosclerosis | 14 |
| Neurological | `#a855f7` | Alzheimer's, Parkinson's, Epilepsy, MS | 14 |
| Respiratory | `#3b82f6` | Asthma, COPD, Pneumonia, Tuberculosis | 12 |
| Autoimmune | `#ec4899` | Lupus, Rheumatoid Arthritis, Crohn's, Celiac | 12 |
| Metabolic | `#eab308` | Diabetes (T1/T2), Obesity, Gout, NAFLD | 12 |
| Infectious | `#14b8a6` | HIV/AIDS, COVID-19, Hepatitis, Influenza | 16 |
| Genetic | `#f472b6` | Cystic Fibrosis, Sickle Cell, Down Syndrome | 12 |
| Mental Health | `#8b5cf6` | Depression, Schizophrenia, PTSD, Anxiety, Bipolar | 12 |
| **TOTAL** | | | **~142** |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Performance | 60fps with 150 nodes + 800 edges (adaptive via quality tiers) |
| Scalability | Architecture supports 500+ nodes (instanced meshes) |
| Browser support | Chrome, Firefox, Safari, Edge (WebGL2) |
| Mobile | Quality tier auto-detection + DPR capping for smooth mobile performance |
| Accessibility | Keyboard navigation for sidebar, ARIA labels on controls |
| Load time | <3 seconds to first meaningful render |

---

## 7. Out of Scope (For Now)

- Real-time PubMed API queries (future enhancement)
- User accounts / saving state
- Collaborative features
- VR/AR mode (cool future idea)
- Backend server (everything runs client-side)
- Full-text paper content analysis (we only use publication counts)

---

## 8. Success Criteria

1. The visualization instantly communicates the research inequality between cancer and NTDs
2. A user can find any disease within 5 seconds (via search or visual exploration)
3. Clicking a disease provides enough context to understand its research landscape
4. The 3D interaction feels smooth and satisfying — no jank, no lag, 60fps
5. Someone with no science background can understand the visualization within 30 seconds
6. The "Size by Mortality" toggle creates an "aha moment" about funding misallocation
