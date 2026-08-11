# MedGalaxy UI Shell — Code Map

Repo root: `/Users/darwin/Documents/Claude/medgalaxy-next`. All line citations are 1-indexed against files read on 2026-08-11.

---

## 1. App.jsx component tree

Full render tree, verbatim (`/Users/darwin/Documents/Claude/medgalaxy-next/src/App.jsx:120-188`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/App.jsx:120-188
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerDown={(e) => { pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }; }}
      onDoubleClick={handleDoubleClick}
    >
      <Canvas
        dpr={[1, CFG.dprCap]}
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
          toneMappingExposure: mob ? 1.4 : 1.1,
        }}
        style={{ background: '#000000' }}
        onCreated={({ gl }) => { sceneRefs.canvasElement = gl.domElement; }}
        onPointerMissed={handlePointerMissed}
      >
        <ambientLight intensity={mob ? 0.6 : 0.3} />
        <pointLight intensity={mob ? 1.2 : 0.6} position={[0, 0, 0]} />
        <directionalLight
          color={mob ? 0xffffff : 0x6699cc}
          intensity={mob ? 1.0 : 0.3}
          position={[-200, 250, 300]}
        />
        {mob && (
          <directionalLight
            color={0xffffff}
            intensity={0.5}
            position={[200, -100, -200]}
          />
        )}

        <Suspense fallback={null}>
          <DiseaseNodes />
          <EdgeNetwork />
          <GlowSprites />
          <CameraRig camDist={camDist} />
          <IdleDrift />
          <GravityLens />
          <BackgroundParticles camDist={camDist} />
          <HighlightSystem />
          <StoryEngine />
          <ExplodeView />
          <ConnectionsView />
          <VelocityMap />
          <AttentionMap />
          <Spotlight />
          <SelectionDOF />
          <SelectionRipple />
          <IntroSequence />
          <AdaptiveDpr />
          <GalaxyRoulette />
          <RouletteDust />
          <SupernovaReveal />
          <SupernovaDust />
        </Suspense>
      </Canvas>

      <HtmlOverlay />
    </div>
  );
```

Imports for the tree: `src/App.jsx:1-30`. `camDist = rawMax ? rawMax * (mob ? 2.4 : 1.4) : 900` at `src/App.jsx:33-35`. Blank-click deselect handler `src/App.jsx:38-56`; double-click reset `src/App.jsx:59-80`; Escape-key cascade `src/App.jsx:83-118`.

Entry point (`/Users/darwin/Documents/Claude/medgalaxy-next/src/main.jsx:1-11`) renders `<App />` inside `React.StrictMode` into `#root`.

HtmlOverlay is the single DOM overlay container and mounts every UI chrome component (`/Users/darwin/Documents/Claude/medgalaxy-next/src/components/HtmlOverlay.jsx:19-52`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/HtmlOverlay.jsx:19-52
export default function HtmlOverlay() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        overflow: 'hidden', fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <NodeLabels />
      <Header />
      <FilterBar />
      <Legend />
      <Tooltip />
      <CompareCards />
      <Sidebar />
      <StoryChips />
      <StoryCaption />
      <SpotlightCaption />
      <RouletteCaption />
      <ExplodeOverlay />
      <ConnectionsOverlay />
      <VelocityOverlay />
      <LandingOverlay />
      <SupernovaOverlay />
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideDown{to{transform:translateY(0)}}
        @keyframes slideUp{to{transform:translateY(0)}}
        @keyframes fadeIn{to{opacity:1}}
        @keyframes chipPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 12px 4px rgba(34,197,94,0.15)}}
      `}</style>
    </div>
  );
}
```

Note: `NodeLabels` is imported from `../NodeLabels` (i.e. `/Users/darwin/Documents/Claude/medgalaxy-next/src/components/NodeLabels.jsx`), not from `ui/` (`src/components/HtmlOverlay.jsx:2`).

---

## 2. UI chrome fade-in gating

Gating state is `introStarted` in the zustand store (`/Users/darwin/Documents/Claude/medgalaxy-next/src/store.js:79-82,146-149`):

```js
// /Users/darwin/Documents/Claude/medgalaxy-next/src/store.js:79-82
    // ── Intro ──
    introStarted: false, // true after user clicks landing overlay
    introPhase: 0,     // 0=dark, 1=hero, 2=constellation, 3=galaxy, 4=effects, 5=done
    introProgress: 0,  // continuous 0→1 for smooth interpolation
```

```js
// /Users/darwin/Documents/Claude/medgalaxy-next/src/store.js:146-149
    setIntroStarted: () => set({ introStarted: true }),
    setIntroPhase: (v) => set({ introPhase: v }),
    setIntroProgress: (v) => set({ introProgress: v }),
    skipIntro: () => set({ introStarted: true, introPhase: 5, introProgress: 1 }),
```

`introStarted` is set by clicking `LandingOverlay` (`src/components/ui/LandingOverlay.jsx:20-24`), or immediately via `skipIntro()` under `prefers-reduced-motion` (`src/components/ui/LandingOverlay.jsx:12-16`). LandingOverlay itself exits with `transition: 'opacity 0.8s ease'` + local `exiting` state (`src/components/ui/LandingOverlay.jsx:26-36`), returning `null` once `introStarted && !exiting` (`src/components/ui/LandingOverlay.jsx:18`).

Components gated on `introStarted`, each starting off-screen via inline `transform` and animating in with a keyframe (keyframes defined in `src/components/HtmlOverlay.jsx:43-49`):

- **Header** — `transform: 'translateY(-100%)'`, `animation: introStarted ? 'slideDown 0.6s ease 3.0s forwards' : 'none'` (`src/components/ui/Header.jsx:131`)
- **FilterBar** — `transform: 'translateY(-60px)'`, `animation: introStarted ? 'slideDown 0.5s ease 3.15s forwards' : 'none'` (`src/components/ui/FilterBar.jsx:38`)
- **Legend** — `transform: 'translateY(100%)'`, `animation: introStarted ? 'slideUp 0.5s ease 3.4s forwards' : 'none'` (`src/components/ui/Legend.jsx:16`)
- **StoryChips** — NOT gated on `introStarted`; uses a local 2800 ms mount timer plus `storyVisible`, with opacity/visibility transition (`src/components/ui/StoryChips.jsx:49-58,66-68`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/StoryChips.jsx:49-58
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2800);
    return () => clearTimeout(t);
  }, []);

  if (!storyVisible && mounted) return null;

  const mob = isMob();
  const show = storyVisible && mounted;
```

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/StoryChips.jsx:66-68
      opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden',
      pointerEvents: show ? 'auto' : 'none',
      transition: 'opacity 0.4s ease, visibility 0.4s ease',
```

Other overlays (SpotlightCaption, RouletteCaption, StoryCaption, ExplodeOverlay, ConnectionsOverlay, VelocityOverlay, CompareCards, Tooltip) fade in with `opacity: 0` + `animation: 'fadeIn ...' forwards` whenever their own store condition renders them (e.g. `src/components/ui/SpotlightCaption.jsx:21`, `src/components/ui/ExplodeOverlay.jsx:34`, `src/components/ui/CompareCards.jsx:127`, `src/components/ui/Tooltip.jsx:105`).

---

## 3. Header button list and onClick wiring

File: `/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Header.jsx` (255 lines). Shared desktop button style at `Header.jsx:80-85`:

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Header.jsx:80-85
const btnStyle = {
  padding: '6px 12px', fontSize: 11, fontFamily: 'inherit',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
  cursor: 'pointer', background: 'transparent', color: '#e2e8f0',
  pointerEvents: 'auto', whiteSpace: 'nowrap',
};
```

Brand row (both modes): pulsing green dot + `MedGalaxy` (`Header.jsx:133-143`); desktop-only subtitle strings: `3D visualization of global disease research`, `{diseases.length} diseases · {displayEdges.length} connections` (`Header.jsx:138-140`).

**Desktop buttons** (`Header.jsx:216-250`), in DOM order:

| Label (exact) | onClick |
|---|---|
| `✕ Attention Map` / `Attention Map` (toggles; active color `#ef4444`) | `() => setNeglectMode(!neglectMode)` (`Header.jsx:219-221`); active state also shows a 260px explainer tooltip (`Header.jsx:222-231`) |
| `Papers` / `Mortality` (SizeToggle segmented) | `handleClick(m)` → `setSizeMode(m)` + 5s tip (`Header.jsx:13-18,28,35`) |
| `Plasma` / `Pulse` (ShaderToggle segmented) | `() => setShaderMode(m)` (`Header.jsx:62-73`) |
| `Research Gap` | `() => setActiveMode('explode')` (`Header.jsx:235`) |
| `Connections` | `() => { useStore.getState().setConnFocusIdx(-1); setActiveMode('connections'); }` (`Header.jsx:236`) |
| `Trends` | `() => setActiveMode('velocity')` (`Header.jsx:237`) |
| `✕ Spotlight` / `Spotlight` (toggles; active color `#f59e0b`) | `() => setSpotlightActive(!spotlightActive)` (`Header.jsx:238-240`) |
| Search input, placeholder `Search diseases...` (width 200) + `<SearchDropdown onSelect={handleSearchSelect} />` | `onChange={e => setSearchQuery(e.target.value)}`; select handler `handleSearchSelect` maps `idMap[d.id]` → `selectDisease(idx)` then clears query (`Header.jsx:119-123,241-249`) |

Verbatim desktop row:

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Header.jsx:216-250
      ) : (
        <>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <button onClick={() => setNeglectMode(!neglectMode)}
              style={{ ...btnStyle, background: neglectMode ? 'rgba(255,255,255,0.12)' : 'transparent', color: neglectMode ? '#ef4444' : '#e2e8f0' }}
            >{neglectMode ? '✕ Attention Map' : 'Attention Map'}</button>
            {neglectMode && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6,
                padding: '8px 12px', background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 10,
                color: '#94a3b8', width: 260, lineHeight: 1.5, opacity: 0, animation: 'fadeIn 0.4s ease forwards',
              }}>
                Nodes colored by research papers per death. <span style={{ color: '#22c55e' }}>Green</span> = high attention. <span style={{ color: '#f59e0b' }}>Yellow</span> = moderate. <span style={{ color: '#ef4444' }}>Red</span> = overlooked.
              </div>
            )}
          </div>
          <SizeToggle />
          <ShaderToggle />
          <button onClick={() => setActiveMode('explode')} style={btnStyle}>Research Gap</button>
          <button onClick={() => { useStore.getState().setConnFocusIdx(-1); setActiveMode('connections'); }} style={btnStyle}>Connections</button>
          <button onClick={() => setActiveMode('velocity')} style={btnStyle}>Trends</button>
          <button onClick={() => setSpotlightActive(!spotlightActive)}
            style={{ ...btnStyle, background: spotlightActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: spotlightActive ? '#f59e0b' : '#e2e8f0' }}
          >{spotlightActive ? '✕ Spotlight' : 'Spotlight'}</button>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search diseases..."
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', width: 200, outline: 'none' }}
            />
            <SearchDropdown onSelect={handleSearchSelect} />
          </div>
        </>
      )}
```

**Mobile** (`Header.jsx:145-215`): a `🔍` (`&#x1F50D;`) button toggling a full-width search drawer (`Header.jsx:147-165`), and a `Menu` button (`Header.jsx:166-172`) opening a dropdown (`Header.jsx:173-213`) containing: section label `Size by` → `Papers`/`Mortality` (`setSizeMode(m); setMenuOpen(false)`, `Header.jsx:180-187`); section label `Shader` → `Plasma`/`Pulse` (`Header.jsx:188-195`); section label `Analysis` → buttons `Research Gap` (`setActiveMode('explode')`, `Header.jsx:197-199`), `Connections` (`setConnFocusIdx(-1)` + `setActiveMode('connections')`, `Header.jsx:200-202`), `Trends` (`setActiveMode('velocity')`, `Header.jsx:203-205`), `✕ Attention Map`/`Attention Map` (`Header.jsx:206-208`), `✕ Spotlight`/`Spotlight` (`Header.jsx:209-211`); each also closes the menu. Outside-touch closes the menu via a capture-phase `touchstart` listener (`Header.jsx:110-117`).

SearchDropdown (`/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/SearchDropdown.jsx:5-37`): filters `diseases` by `label.toLowerCase().includes(q)`, max 8 matches, row = category dot + label, `onClick={() => onSelect(d)}`.

---

## 4. Sidebar

File: `/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Sidebar.jsx` (229 lines). Renders `null` if no `selectedNode` OR if mobile (`Sidebar.jsx:78-79` — `if (!selectedNode) return null; if (mob) return null;` so the mobile bottom-sheet code paths at `Sidebar.jsx:36-76,102-103,108,110-115` are currently dead on mobile).

Stat-box atom and section-style constants (`Sidebar.jsx:8-19`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Sidebar.jsx:8-19
function SB({ l, v, s, vc }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: vc || '#e2e8f0' }}>{v} {s && <span style={{ fontSize: 12, fontWeight: 400 }}>{s}</span>}</div>
    </div>
  );
}

const SH = { fontSize: 11, color: '#3399ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 };
const SP = { color: '#94a3b8', fontSize: 13, lineHeight: 1.55 };
const SD = { padding: '0 16px 10px' };
```

Panel style (desktop branch): `position:absolute, top:75, right:0, width:333, height:'calc(100% - 75px)', background:'rgba(10,16,30,0.94)', backdropFilter:'blur(16px)', borderLeft, zIndex:50, fontSize:13` (`Sidebar.jsx:102-104`).

Section order (all inside the scrollable panel, `Sidebar.jsx:106-226`):
1. **Header** — disease label + category pill (color `CC[disease.category]`, label `CL[disease.category]`) + `×` close button calling `deselect()` (`Sidebar.jsx:117-125`, close handler `Sidebar.jsx:34`).
2. **Description** — `disease.description` (`Sidebar.jsx:127`).
3. **Stats grid** (2-col) — `SB` boxes: `Publications` (with trend arrow `↑/↓/→` + `%`), `Connections`, `WHO Deaths/yr`, `Funding Gap` (color-coded `{ high:'#ef4444', medium:'#eab308', low:'#22c55e' }`), `Papers/Death` (`Sidebar.jsx:86-90,129-135`).
4. **Sparkline** — heading `Publication Trend (2014–2024)` + `<Sparkline data={disease.yearlyPapers} color={c} />` (`Sidebar.jsx:137-140`).
5. **PubMed link** — `View on PubMed →` opening `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date` in new tab (`Sidebar.jsx:142-148`).
6. **Connections list** — heading `Connections ({conns.length})` + explainer `Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap`; rows sorted by shared papers desc, clickable → `selectDisease(cn.oi)` (`Sidebar.jsx:92-98,150-173`).
7. **Insights** (from `data/disease-insights.json`, keyed by `disease.id`, skipped when absent; `Sidebar.jsx:6,175-224`) — sections in order: `What It Is`, `Why It Matters`, `Why It May Be Neglected`, `Mismatch Insight` (gold `#ffd500`, italic), `Top 3 Connected Diseases` (from `ins.top3Reasons` entries), `Memorable Fact` (green `#22c55e`), `Question This Node Raises` (italic), boxed Q&A `Why is this burden not matched by attention?` (`ins.burdenAnswer`) and `Could related disease research accelerate progress here?` (`ins.accelerateAnswer`).

**Sparkline — full source and props** (`/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Sparkline.jsx:1-35`; props `{ data, color, w = 260, h = 50 }`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Sparkline.jsx:1-35
import React from 'react';

export default function Sparkline({ data, color, w = 260, h = 50 }) {
  if (!data || !data.length) return null;

  const mx = Math.max(...data);
  const mn = Math.min(...data);
  const rng = mx - mn || 1;

  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 4 - ((v - mn) / rng) * (h - 8)}`)
    .join(' ');

  const gid = 'sp' + color.replace('#', '');

  return (
    <svg width={w} height={h} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <text x="0" y={h - 1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono">
        2014
      </text>
      <text x={w} y={h - 1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">
        2024
      </text>
    </svg>
  );
}
```

---

## 5. Legend — exact text strings

Full source (`/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Legend.jsx:1-29`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/Legend.jsx:1-29
import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function Legend() {
  const sizeMode = useStore(s => s.sizeMode);
  const introStarted = useStore(s => s.introStarted);
  const mob = isMob();

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: mob ? '8px 12px' : '8px 16px', display: 'flex', gap: mob ? 8 : 16,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#cbd5e1',
      background: 'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',
      pointerEvents: 'none', transform: 'translateY(100%)', animation: introStarted ? 'slideUp 0.5s ease 3.4s forwards' : 'none',
    }}>
      {mob ? (
        <span>Tap to explore &middot; Pinch to zoom</span>
      ) : (
        <>
          <span>Node size = {sizeMode === 'papers' ? 'publications' : 'mortality'}</span>
          <span>Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan &middot; Double-click to re-center</span>
        </>
      )}
      <span style={{ marginLeft: 'auto' }}>Data: PubMed &middot; WHO Global Health Estimates 2021 &middot; Project by Russell J. Young</span>
    </div>
  );
}
```

Rendered strings: mobile `Tap to explore · Pinch to zoom`; desktop `Node size = publications` / `Node size = mortality` and `Drag to rotate · Scroll to zoom · Right-drag to pan · Double-click to re-center`; always `Data: PubMed · WHO Global Health Estimates 2021 · Project by Russell J. Young`.

---

## 6. Caption component pattern — SpotlightCaption (full verbatim example)

Pattern: subscribe to a store caption string + an active/phase flag, early-return `null`, bottom-center absolutely positioned glass card (`bottom: mob ? 90 : 110, left: '50%', translateX(-50%)`, zIndex 46, `rgba(10,16,30,0.95)` + `blur(16px)`), tiny uppercase letter-spaced kicker label, then body text; `key={caption}` forces re-mount so `fadeIn` replays per caption.

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/SpotlightCaption.jsx:1-30
import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function SpotlightCaption() {
  const spotlightCaption = useStore(s => s.spotlightCaption);
  const spotlightActive = useStore(s => s.spotlightActive);

  if (!spotlightActive || !spotlightCaption) return null;
  const mob = isMob();

  return (
    <div
      key={spotlightCaption}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '12px 18px' : '16px 28px',
        fontFamily: 'IBM Plex Mono,monospace', textAlign: 'center',
        opacity: 0, animation: 'fadeIn 0.4s ease forwards',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Spotlight</div>
      <div style={{ fontSize: mob ? 12 : 14, color: '#f1f5f9', lineHeight: 1.5, whiteSpace: mob ? 'normal' : 'nowrap', maxWidth: mob ? '85vw' : 'none' }}>{spotlightCaption}</div>
    </div>
  );
}
```

Siblings following the same pattern:
- **RouletteCaption** (`src/components/ui/RouletteCaption.jsx:5-53`): gate `roulettePhase !== 'reveal' || !rouletteCaption` (`:9`); amber border `rgba(245,158,11,0.4)`, kicker `Galaxy Roulette`, clickable (`pointerEvents:'auto'`) with `handleDismiss` → `deselect()` + `stopRoulette()` (`:12-15`), footer `` `${mob ? 'tap' : 'click'} to return to galaxy` `` (`:49`).
- **StoryCaption** (`src/components/ui/StoryCaption.jsx:14-83`): gate `!storyCaption` (`:45`); rAF-driven border pulse on the box (`:23-35`); Escape ends story via module-level `endStory()` (`:5-12,37-43`); click advances `setStoryStep(storyStep + 1)` unless `supernovaBusy` (`:48-53`); multi-line caption split on `\n` (first line bold, rest smaller `:73-77`); footer `revealing connections…` or `` `${mob ? 'tap' : 'click'} to continue · esc to exit` `` (`:78-80`).
- **SupernovaOverlay** (`src/components/ui/SupernovaOverlay.jsx:4-68`): vignette (zIndex 5) during `prefocus|charge|burst`; telemetry caption at `bottom: 80` with kicker `ANALYZING`/`FOCUSING`, hidden while `storyActive` (`:9-12,34-65`).

---

## 7. index.html meta/OG tags verbatim

`/Users/darwin/Documents/Claude/medgalaxy-next/index.html:4-53`:

```html
<!-- /Users/darwin/Documents/Claude/medgalaxy-next/index.html:4-53 -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
    <title>MedGalaxy — Interactive 3D Disease Research Visualization by Russell James Young</title>
    <meta name="description" content="MedGalaxy is an interactive 3D visualization of global disease research, mapping 153 diseases by publication volume, mortality, and funding gaps. A data science project by Russell J. Young, British School Jakarta." />
    <meta name="keywords" content="Russell Young, Russell J. Young, Russell James Young, Russell Young Jakarta, Russell Young Indonesia, Russell Young British School Jakarta, BSJ, MedGalaxy, disease research visualization, global health data, PubMed, WHO mortality, 3D data visualization, medical research, neglected diseases" />
    <meta name="author" content="Russell J. Young" />
    <link rel="canonical" href="https://www.medgalaxy.org" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="MedGalaxy — Interactive 3D Disease Research Visualization" />
    <meta property="og:description" content="Explore 153 diseases in an interactive 3D galaxy. See which diseases get the most research, which are neglected, and where funding gaps exist. By Russell J. Young, British School Jakarta." />
    <meta property="og:url" content="https://www.medgalaxy.org" />
    <meta property="og:site_name" content="MedGalaxy" />
    <meta property="og:image" content="https://www.medgalaxy.org/og-image.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="MedGalaxy — 3D Disease Research Visualization" />
    <meta name="twitter:description" content="Interactive 3D visualization mapping global disease research by Russell J. Young. Explore publication volumes, mortality data, and research gaps." />
    <meta name="twitter:image" content="https://www.medgalaxy.org/og-image.jpg" />

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "MedGalaxy",
      "url": "https://www.medgalaxy.org",
      "description": "Interactive 3D visualization of global disease research, mapping 153 diseases by publication volume, mortality, and funding gaps using PubMed and WHO data.",
      "applicationCategory": "DataVisualization",
      "author": {
        "@type": "Person",
        "name": "Russell J. Young",
        "alternateName": ["Russell Young", "Russell James Young"],
        "affiliation": {
          "@type": "EducationalOrganization",
          "name": "British School Jakarta",
          "alternateName": "BSJ"
        }
      },
      "keywords": "disease research, global health, data visualization, PubMed, WHO, neglected diseases, medical research",
      "inLanguage": "en"
    }
    </script>

    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Inline base CSS + safe-area body padding: `index.html:54-65`. Body: `<div id="root">` + `/src/main.jsx` module script (`index.html:67-70`). `src/index.css:1-19` mirrors this with Tailwind v4 `@import "tailwindcss"` and `@theme` tokens `--font-mono`, `--color-glass: rgba(10, 16, 30, 0.92)`, `--color-glass-border`, `--color-glass-hover` (`src/index.css:3-8`).

---

## 8. StoryChips structure + chip labels

File: `/Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/StoryChips.jsx`. Chip data verbatim (`:5-12`):

```jsx
// /Users/darwin/Documents/Claude/medgalaxy-next/src/components/ui/StoryChips.jsx:5-12
const chips = [
  { id: 'researched', label: 'Most Researched', desc: 'See the biggest research spheres' },
  { id: 'killers', label: 'Biggest Killers', desc: 'Diseases with highest mortality' },
  { id: 'forgotten', label: 'Forgotten Diseases', desc: 'Declining research, rising deaths' },
  { id: 'silent', label: 'Silent Killers', desc: 'High mortality, minimal attention' },
  { id: 'richpoor', label: 'Rich vs Poor', desc: 'Who gets the research?' },
  { id: 'mismatch', label: 'See the Mismatch', desc: 'The 2,000:1 research gap' },
];
```

Structure: bottom-center container (`bottom: mob ? 32 : 50`, zIndex 45); desktop `display:flex`, mobile `display:grid` with `gridTemplateColumns:'repeat(4,1fr)'` and `width:'92vw'` (`:61-70`). Six story chips call `setStoryActive(c.id)` (`:71-83`), plus a seventh **Galaxy Roulette** button whose label becomes `Spinning...` and is disabled while `roulettePhase !== 'idle'`; click → `startRoulette()` (`:84-97`). Shared `chipBtnStyle` (`:14-19`); green hover glow handlers `hIn`/`hOut` for story chips, amber `rHIn`/`rHOut` for roulette (`:21-40`). Render/visibility gating covered in section 2.

---

## 9. Mobile detection helper and every isMob() branch in the UI files

Helper (`/Users/darwin/Documents/Claude/medgalaxy-next/src/utils/helpers.js:6`):

```js
// /Users/darwin/Documents/Claude/medgalaxy-next/src/utils/helpers.js:6
export function isMob(){return typeof window!=='undefined'&&(matchMedia('(pointer:coarse)').matches||window.innerWidth<768);}
```

All `isMob()` call sites and branches in the shell files:

- **src/App.jsx:34** `const mob = isMob();` — branches: `camDist` multiplier `2.4` vs `1.4` (`:35`); `toneMappingExposure` 1.4 vs 1.1 (`:138`); ambient 0.6 vs 0.3 (`:144`); pointLight 1.2 vs 0.6 (`:145`); directionalLight color `0xffffff` vs `0x6699cc`, intensity 1.0 vs 0.3 (`:146-150`); extra mobile-only directionalLight (`:151-157`).
- **src/components/ui/Header.jsx:105** `const mob = isMob();` — branches: outside-touch menu-close effect only when mob (`:110-117`); padding/gap/fontSize (`:128-129`); brand fontSize 13 vs 15 (`:135`); desktop-only subtitle block `!mob && (...)` (`:136-142`); whole toolbar swap `mob ? <search+Menu> : <desktop buttons>` (`:145-251`).
- **src/components/ui/FilterBar.jsx:12** `if (isMob()) return null;` — FilterBar (category chips + neglect gradient legend) is desktop-only.
- **src/components/ui/Legend.jsx:8** `const mob = isMob();` — padding/gap (`:13`); string swap `Tap to explore · Pinch to zoom` vs node-size + controls hints (`:18-25`).
- **src/components/ui/Sidebar.jsx:29** `const mob = isMob();` — swipe handlers no-op unless mob (`:36-76`); `if (mob) return null;` kills the panel on mobile (`:79`); (dead-on-mobile) bottom-sheet `panelStyle` branch (`:102-104`), backdrop scrim (`:108`), drag handle (`:110-115`).
- **src/components/ui/StoryChips.jsx:57** `const mob = isMob();` — bottom 32 vs 50, grid vs flex, `repeat(4,1fr)`, gap 6 vs 10, width `92vw` (`:62-69`); chip padding `'6px 4px'` vs `'8px 16px'`, fontSize 10 vs 12 (`:77-79,89-90`).
- **src/components/ui/SpotlightCaption.jsx:10** `const mob = isMob();` — bottom 90 vs 110 (`:16`); padding (`:19`); body fontSize 12 vs 14, `whiteSpace` normal vs nowrap, `maxWidth` `85vw` vs none (`:26`).
- **src/components/ui/RouletteCaption.jsx:10** `const mob = isMob();` — bottom 90 vs 110 (`:22`); padding (`:26`); fontSize 13 vs 16, maxWidth `85vw` vs 420 (`:41-42`); footer fontSize 10 vs 11 and `tap`/`click` wording (`:47-50`).
- **src/components/ui/StoryCaption.jsx:46** `const mob = isMob();` — bottom 90 vs 110 (`:60`); padding (`:63`); fontSize 18 vs 22 (`:64`); whiteSpace/maxWidth `92vw` (`:65-66`); secondary-line fontSize 14 vs 17 (`:74`); footer fontSize 13 vs 15 and `tap`/`click` wording (`:78-79`).
- **src/components/ui/LandingOverlay.jsx:9** `const mob = isMob();` — left `6vw` vs `8vw`, maxWidth `88vw` vs 560 (`:40-43`); h1 fontSize 28 vs 48 (`:48`); subtitle fontSize 12 vs 15, marginTop 20 vs 28 (`:63,68`); prompt fontSize 10 vs 12, marginTop 36 vs 52, text `Tap anywhere to begin` vs `Click anywhere to begin` (`:78,83,87`).
- **src/components/ui/CompareCards.jsx:117** `if (isMob() || !selectedNode || !pos.visible || comparisons.length === 0) return null;` — CompareCards is desktop-only.
- **src/components/ui/ExplodeOverlay.jsx:23** `const mob = isMob();` — modal padding 16 vs 28, maxWidth `95vw` vs 820 (`:39`); title 14 vs 18, subtitle 9 vs 12, marginBottom 16 vs 24 (`:47-48`); column vs row layout, gap 20 vs 36 (`:51`); row label/value fontSize 9 vs 11 (`:58-59,74-75`); divider hidden on mob (`:67`).
- **src/components/ui/ConnectionsOverlay.jsx:63** `const mob = isMob();` — same modal pattern: padding 16 vs 28, maxWidth `95vw` vs 880 (`:84`); title/subtitle sizes (`:92-93`); column vs row, gap (`:96`); row fontSizes 9 vs 11 (`:109,112,127,131`), cross-link meta 8 vs 9 (`:135`); divider hidden on mob (`:120`).
- **src/components/ui/VelocityOverlay.jsx:32** `const mob = isMob();` — padding 16 vs 28, maxWidth `95vw` vs 820 (`:48`); title/subtitle (`:56-57`); column vs row, gap (`:60`); row fontSizes 9 vs 11 (`:67,70,86,89`); divider hidden on mob (`:79`).

No `isMob` usage in: `src/components/HtmlOverlay.jsx`, `src/components/ui/Tooltip.jsx`, `src/components/ui/SearchDropdown.jsx`, `src/components/ui/Sparkline.jsx`, `src/components/ui/SupernovaOverlay.jsx` (SupernovaOverlay instead uses a raw `window.innerWidth < 768` check indirectly via `store.js:230` for the neighbor tier cap).

---

## Supporting store facts referenced by the shell

- `activeMode: null | 'explode' | 'connections' | 'velocity' | 'attention'` (`/Users/darwin/Documents/Claude/medgalaxy-next/src/store.js:38`); `roulettePhase: 'idle' | 'assembling' | 'spinup' | 'reveal'` (`src/store.js:61`); `supernovaPhase: 'idle' | 'prefocus' | 'charge' | 'burst' | 'linkwave' | 'settle' | 'complete'` (`src/store.js:69`).
- `selectDisease(idx)` sets `selectedNode` + `flyTarget` with zoom `nodeRadius * (isMob() ? 12.0 : 5.0)` (`src/store.js:88-99`); `deselect()` flies back to origin (`src/store.js:101-106`).
- Store is exposed as `window._store` for console testing (`src/store.js:292`).
- z-index ladder across the shell: overlay root 10 (`src/components/HtmlOverlay.jsx:23`), Header/FilterBar/Legend 40 (`Header.jsx:127`, `FilterBar.jsx:17,35`, `Legend.jsx:12`), StoryChips/CompareCards 45 (`StoryChips.jsx:63`, `CompareCards.jsx:125`), captions 46 (`SpotlightCaption.jsx:17`, `RouletteCaption.jsx:23`, `StoryCaption.jsx:61`), Sidebar 50 + mobile scrim 49 (`Sidebar.jsx:103-104,108`), modal overlays 55 (`ExplodeOverlay.jsx:32`, `ConnectionsOverlay.jsx:77`, `VelocityOverlay.jsx:41`), SearchDropdown 60 (`SearchDropdown.jsx:19`), Tooltip 100 (`Tooltip.jsx:86`), LandingOverlay 200 (`LandingOverlay.jsx:30`), supernova vignette/caption 5/6 (`SupernovaOverlay.jsx:28,42`).