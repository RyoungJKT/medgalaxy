# Task 19 report: Performance gate

Commit: `d738712` (perf: verified tier budgets), on top of `d94a762`.
Full matrix + methodology committed at `docs/verify/perf-matrix.md`.

## What was done

1. **FPS matrix** — built a one-off headless-Chrome runner (same primitives
   as `tools/verify.mjs`: `page.evaluate` rAF-counting loop) that drives the
   app's own dev hooks rather than simulating real interaction:
   - "At rest (post-film)": `store.skipIntro()` → `store.finishOverture()`
     (the same jump-to-rest pattern `TimeMachine.jsx`'s own `__tour.seek`
     hook uses internally), then 30 settle frames before the 5 s count.
   - "Beat 2 (the morph)": `window.__overture.seek(6.0)` → `.resume()`,
     landing inside the suppress→ignite ramp (T_SUPPRESS=6.2s,
     T_IGNITE_END=9.6s of the 5.0–12.0s beat-2 span), then measured 5 s.
   - "Tour year-transition": `window.__tour.seek(0.97)` → `.resume()`. Since
     the tour's default start year is the *last* year on screen, the seek
     lands mid-rewind-hold at t=4.21s; the following 5 s window covers the
     full capped 6-step (1990→1996) travel leg (~3.9s of it) plus a bit of
     the next hold — genuinely mid-transition, not a static pause.
   - "Roulette spinup": `store.startRoulette()` from rest, poll
     `roulettePhase==='spinup'` (fires ~1.2–1.3s after assembling starts),
     then 5 s (spinup itself runs 5.2s on HIGH, so the window sits inside).
   - Ran each at HIGH (1440×900), MEDIUM (1100×800, fresh page so
     `detectTier()` reads MEDIUM), and LOW (375×812 `isMobile`+`hasTouch`,
     rest + beat2 only, per the brief).
   - **Result: all 8/8 pass, every one reading 120 fps** — this machine's
     apparent headless ceiling (matches 108/111/120 readings logged by
     earlier tasks in this branch's history regardless of scene complexity).
     Flat across scenarios means none of them bottlenecked relative to each
     other on this hardware; gates (≥55/≥50/≥40) all clear with wide margin.
     No knobs were needed or applied.

2. **Cold load** — measured against the **production build**
   (`vite build` → `vite preview` on `:5281`), not the `:5280` dev server:
   the dev server serves ~1,300 unbundled ESM requests per load, which would
   make a network-throttled number meaningless. Setup: `emulateCPUThrottling(4)`
   + `emulateNetworkConditions(PredefinedNetworkConditions['Fast 3G'])`
   (puppeteer-core's built-in preset, 180000 B/s / 562.5ms latency — the same
   numbers DevTools/Lighthouse use), 375×812 mobile viewport, and
   `setCacheEnabled(false)` (confirmed this matters: a cache-warm rerun in
   the same browser instance reads 1.8s combined vs. ~5.0s genuinely cold —
   every number reported is cache-disabled).
   - Landing overlay paint (nav start → overlay title text committed):
     **5.03–5.08s across 5 runs — FAILS the <2s gate.**
   - First galaxy frame after an auto-click on the overlay center: the
     brief's "canvas non-black" signal never fired in 20s — `src/App.jsx`'s
     `<Canvas gl={{...}}>` doesn't set `preserveDrawingBuffer`, so it
     defaults to `false` and an out-of-band pixel read reliably samples an
     already-cleared buffer. Used `introPhase` advancing instead (the
     brief's "or"): `introPhase>=1` ("hero") in 564–576ms, `introPhase>=3`
     ("galaxy", the store's own name) in 1.45s. **Both pass the <3s gate.**
   - Root-caused the overlay-paint failure via throttle isolation (cache
     disabled throughout): baseline 0.36s, CPU-4x-only 0.70s, Fast-3G-only
     4.64s, combined 5.03s — it's almost entirely the network leg, because
     the entry bundle is a single un-split 580.92kB gzip chunk.
   - **No fix attempted.** None of the brief's sanctioned knobs (bloom
     levels, DoF res scale, fbm octaves, sphere segments) touch bundle
     size/splitting, and step 3 says apply only the listed knobs, don't
     touch anything else. Flagging this for a follow-up code-splitting task
     rather than making an out-of-scope change here.

3. **Knob tuning**: not applied — no gate needed it (FPS) and the one gate
   that failed (overlay paint) has no in-scope knob.

4. **Bundle sanity**: `npx vite build` → main chunk **2,040.87 kB raw / 580.92
   kB gzip**. Under the 2.2MB flag threshold — not flagged. This is the same
   number the cold-load root cause points at. The pre-existing `>500kB`
   Rollup warning is present and unchanged, as expected.

5. Cleaned up: killed the `:5281` preview server, deleted the temporary
   runner scripts (`tools/_tmp_*.mjs`, never committed), confirmed `git
   status` is clean except the one committed file.

## Gate summary

| Gate | Result |
|---|---|
| HIGH FPS (rest/beat2/tour/roulette) ≥55 | PASS (120 each) |
| MEDIUM FPS (rest/beat2) ≥50 | PASS (120 each) |
| LOW FPS (rest/beat2) ≥40 | PASS (120 each) |
| Cold load: overlay paint <2s | **FAIL (5.0–5.1s)** |
| Cold load: first galaxy frame after click <3s | PASS (0.56–1.45s depending on threshold) |
| Bundle: main chunk <2.2MB raw | PASS (2.04MB) |

One gate fails: initial-bundle-download time under throttled network, which
this task's knob set cannot address. Everything else clears comfortably.

## Fix (follow-up task): instant pre-React shell + vendor chunk splitting

Commit: `perf: instant landing shell + vendor chunk splitting for cold load`,
on top of `d738712`. Addresses the one failing gate above.

### What was done

1. **Pre-React shell (`index.html`)** — added static markup inside
   `<div id="root">`: a brand row (pulsing `#22c55e` dot, box-shadow glow,
   matching `Header.jsx`'s existing dot styling; "MedGalaxy" wordmark, IBM
   Plex Mono, 600 weight, 15px) plus a "loading the galaxy..." status line
   (11px, `#64748b`) with the same opacity-pulse keyframe pattern already
   used elsewhere in the app (`MedGalaxy.jsx`'s `@keyframes pulse`). Dark
   `#06080d` background matches the app shell. All CSS is inline in
   `index.html`'s existing `<style>` block, no new stylesheet. React's
   `createRoot(...).render()` in `main.jsx` is unchanged — it replaces
   `#root`'s children on mount exactly as before, so this markup only
   exists during the window before React takes over. No em dashes.

   Also switched the Google Fonts `<link>` from a plain blocking
   `<link rel="stylesheet">` to a non-render-blocking load: `preconnect`
   hints for `fonts.googleapis.com`/`fonts.gstatic.com`, then the stylesheet
   itself loaded via the standard `media="print" onload="this.media='all'"`
   trick (with a `<noscript>` fallback), so the third-party CSS fetch can no
   longer gate first paint of the shell. `display=swap` was already present
   in the font URL and the `font-family` stack already falls back to
   `monospace`, so text (shell and app alike) never goes invisible waiting
   on the font — this is what the brief's "use font-display fallback, the
   shell may render in monospace fallback font, fine" pointed at. Without
   this change the shell's own paint would still have been gated behind a
   render-blocking cross-origin stylesheet fetch, which under Fast 3G's
   ~562ms RTT could easily have cost more than the 2s budget on its own.

2. **Vendor chunk splitting (`vite.config.js`)** — added
   `build.rollupOptions.output.manualChunks`. First attempt matched the
   brief's suggested grouping exactly (`three`, `vendor-react: ['react',
   'react-dom']`, `vendor-anim: [gsap, @react-three/fiber, drei,
   postprocessing, @react-three/postprocessing]`), but the build emitted
   `Generated an empty chunk: "vendor-react"` — react/react-dom got pulled
   into `vendor-anim` anyway (confirmed by grepping the built chunks for
   React signatures) because `@react-three/fiber`/`drei` import react
   synchronously, and Rollup resolves the resulting chunk cycle by folding
   the smaller group into the one that needs it rather than emitting a
   genuinely separate chunk. Per the brief's own "adjust groupings if the
   build warns about circular imports" allowance, merged react/react-dom
   into the `vendor-anim` group instead (they always load together in
   practice — fiber can't run without react — so there was no real caching
   benefit to the split anyway). Final config: `{ three: ['three'],
   'vendor-anim': ['react', 'react-dom', 'gsap', '@react-three/fiber',
   '@react-three/drei', '@react-three/postprocessing', 'postprocessing'] }`.
   Data JSONs untouched. Build is clean with no empty-chunk warning.

### Verification

- `npx vite build`: green. New chunk table — entry `index-*.js` 860.82 kB
  raw / 248.63 kB gzip (down from the prior single 2,040.87 kB / 580.92 kB
  chunk), plus parallel `three-*.js` (724.72 kB / 187.57 kB) and
  `vendor-anim-*.js` (451.81 kB / 142.55 kB), both `modulepreload`'d by
  Vite so the browser fetches all three concurrently. Full table in
  `docs/verify/perf-matrix.md` section 4.
- `npx vitest run`: green, 119/119 tests across 12 files, unchanged.
- Cold load re-measured with the exact section-2 method (production build,
  `vite preview` on a fresh port, `emulateCPUThrottling(4)` +
  `emulateNetworkConditions(PredefinedNetworkConditions['Fast 3G'])`,
  `setCacheEnabled(false)`, 375x812 mobile viewport):
  - **(a) Shell paint** (nav start -> static shell text present, zero JS
    involved): **633-643 ms across 5 runs — PASSES the <2s gate** by a wide
    margin, as expected for pure inline HTML/CSS.
  - **(b) React landing** (nav start -> real `LandingOverlay`'s
    "Cartography" text committed, i.e. React mounted): **5.15-5.18 s**,
    essentially unchanged from the pre-fix ~5.0-5.1 s. Expected and
    accepted: none of `App.jsx`'s ~30 component imports are dynamic, so the
    full module graph — same total bytes, just reorganized across 3 chunks
    instead of 1 — still has to download and evaluate before React's first
    render, regardless of chunking. The brief's actual finding was that the
    page stayed *blank* until this point; with the shell in place it no
    longer does, so (a) is the metric that matters for the gate and (b) is
    now informational only.
  - **(c) First galaxy frame after click**: `introPhase>=1` ("hero") in
    550-571 ms, `introPhase>=3` ("galaxy") in 1.95-1.96 s across 3 runs.
    **Both stay under the <3s gate.** The "galaxy" threshold moved from
    1.45 s pre-fix to ~1.95 s post-fix — plausibly the 3 parallel chunk
    requests sharing Fast 3G's fixed ~180 kB/s throughput rather than one
    sequential request stream — but with 1s of margin left it does not put
    the gate at risk.
- FPS regression spot-check: HIGH tier, at rest (post-film), identical drive
  method to the original matrix's row 1 (`skipIntro()` -> `finishOverture()`,
  settle 30 frames, 5s window), dev server, 1440x900: **120 fps**, unchanged,
  gate >=55 PASS.
- Dev mode (`:5280`): loads clean, no console errors, `LandingOverlay`
  renders and functions normally. `manualChunks` lives under
  `build.rollupOptions` so Vite's dev server (native ESM, no bundling) never
  applies it — confirmed rather than assumed.
- Cleanup: killed the temporary `:5281` preview server, deleted the
  temporary runner scripts (`tools/_tmp_*.mjs`, never committed), `dist/`
  removed.

### Updated gate summary

| Gate | Result |
|---|---|
| HIGH FPS (rest) spot-check ≥55 | PASS (120, unchanged) |
| Shell paint (new, pure HTML) <2s | **PASS (633-643 ms)** |
| Cold load: first galaxy frame after click <3s | PASS (0.55-1.96s depending on threshold) |
| Bundle: entry chunk | 860.82 kB raw / 248.63 kB gzip (down from 2,040.87 kB / 580.92 kB) |

All gates now pass. The previously-failing "meaningful landing paint <2s"
gate is satisfied by the new pre-React shell, which paints independently of
bundle size or network conditions.
