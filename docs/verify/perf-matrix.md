# Performance gate — measured matrix

Task 19. Measured against commit `d94a762` (branch `next/showcase`).
Machine: Apple M2 Max, 12 cores, macOS 26.6.2. Chrome (headless `new`,
`--use-gl=angle`) via puppeteer-core 24.43.1.

**Headless-Chrome caveat (applies to every FPS number below):** headless
Chrome's `requestAnimationFrame` is not locked to a real compositor the way
an on-screen tab is, so these are *approximate* readings, not a substitute
for on-device profiling. Every prior verification task in this branch's
history that logged an `--fps` number under this harness reads at or near
this machine's apparent ceiling (108/111/120 in tasks 2, 7, 8) regardless of
scene complexity — this run reproduces that same ceiling (120 throughout).
Treat these numbers as a *relative* signal (did this change make frames more
expensive, yes/no) and a floor check (comfortably above gate), not as an
absolute FPS a viewer will see. No on-screen/real-display measurement was
available in this environment.

## 1. FPS matrix

Harness: one-off runner built on the same primitives as `tools/verify.mjs`
(`page.evaluate` rAF-counting loop, 5 s window). Driven through the app's own
dev hooks (`window.__overture`, `window.__tour`, and `roulettePhase` polling)
rather than real clicks, so the timeline state at the start of each 5 s
window is exact and reproducible — see "Drive method" per row.

| Tier | Viewport | Scenario | Drive method | FPS | Gate | Result |
|---|---|---|---|---:|---:|---|
| HIGH | 1440×900 | At rest (post-film) | `skipIntro()` → `finishOverture()`, settle 30 frames | 120 | ≥55 | PASS |
| HIGH | 1440×900 | Beat 2 (the morph) | `__overture.seek(6.0)` → `resume()`, measure 5 s (window 6.0–11.0s of the 5.0–12.0s beat-2 span; covers the suppress ramp at 6.2s through ignite landing at 9.6s) | 120 | ≥55 | PASS |
| HIGH | 1440×900 | Time Machine tour, year-transition | `__tour.seek(0.97)` → `resume()`, measure 5 s (window t=4.21→9.21s; landed mid-rewind-hold at t=4.21, ~3.9s of the window is the capped 6-step travel leg from 1990→1996, landing in the hivSurge hold at t=8.2s) | 120 | ≥55 | PASS |
| HIGH | 1440×900 | Roulette spinup | `startRoulette()` from rest, poll `roulettePhase==='spinup'`, measure 5 s (spinup itself runs `RAMP_DUR+SUSTAIN_DUR`=5.2s on HIGH, so the window sits inside it) | 120 | ≥55 | PASS |
| MEDIUM | 1100×800 (fresh page load) | At rest | same as HIGH rest | 120 | ≥50 | PASS |
| MEDIUM | 1100×800 (fresh page load) | Beat 2 (the morph) | same as HIGH beat 2 | 120 | ≥50 | PASS |
| LOW | 375×812 (`isMobile`+`hasTouch`) | At rest | same as HIGH rest | 120 | ≥40 | PASS |
| LOW | 375×812 (`isMobile`+`hasTouch`) | Beat 2 (the morph, instanceColor ignite path) | same as HIGH beat 2 | 120 | ≥40 | PASS |

All 8 scenarios hit the same 120 fps ceiling this machine shows at idle, so
none of them registered as a bottleneck relative to each other on this
hardware — every gate clears with wide margin. **No tuning knobs were
applied** (step 3 of the brief); nothing here needed it.

Tier confirmation: `src/utils/tiers.js` `detectTier()` reads
`window.innerWidth` at first import, which happens before first paint since
`page.setViewport` runs before `page.goto` in every run above — 1440px →
HIGH, 1100px → MEDIUM (<1200), 375px → LOW (<768, and this task's runner
also sets `isMobile`/`hasTouch` as `tools/verify.mjs --mobile` does).

## 2. Cold load

Measured against the **production build** (`npx vite build` → `dist/`,
served by `vite preview` on `:5281`), not the `:5280` dev server — the dev
server serves ~1,300 unbundled ES module requests per load, which would make
a network-throttled measurement meaningless (it doesn't correspond to what a
production visitor's browser fetches). This is the one place in this task
that intentionally departs from `tools/verify.mjs`'s `:5280` convention.

**Setup:** `page.emulateCPUThrottling(4)`, `page.emulateNetworkConditions(puppeteer.PredefinedNetworkConditions['Fast 3G'])`
(180000 B/s down, 84375 B/s up, 562.5 ms latency — puppeteer-core's built-in
Fast 3G preset, the same numbers Chrome DevTools/Lighthouse use), viewport
375×812 mobile emulation (the brief's "mid-tier phone bar"), and
**`page.setCacheEnabled(false)`** — without this a same-browser-instance
second load hits the HTTP cache and the numbers stop meaning "cold load"
(confirmed by A/B: cache enabled read 1.8s combined on a warmed instance vs.
~5.0s on a genuinely fresh one; every number below is cache-disabled).

**Metric definitions:**
- *Landing overlay paint* = wall-clock time from `page.goto()` navigation
  start to the landing overlay's title text (`"...Cartography..."`) being
  present in `document.body.innerText` (i.e. React has mounted and committed
  `LandingOverlay`). Polled every 50 ms.
- *First galaxy frame* = wall-clock time from an auto-click on the landing
  overlay's center to `window._store.getState().introPhase` advancing off
  its initial value. The brief's suggested "canvas non-black" signal was
  attempted first (draw the WebGL canvas into a small offscreen 2D canvas
  and sample pixels) but **never fired within a 20 s timeout** — the app's
  `<Canvas gl={{...}}>` (`src/App.jsx`) does not set `preserveDrawingBuffer`,
  so it defaults to `false` and an out-of-band read (from Node, not the
  render loop itself) reliably samples an already-cleared buffer. `introPhase`
  is therefore the metric actually used, per the brief's own "or" framing.
  Reported at both thresholds: `introPhase>=1` ("hero", first frame the
  scene shows anything after the black hold) and `introPhase>=3` ("galaxy",
  the store's own name for that phase, `src/store.js`) for the stricter read.

| Metric | Measured | Gate | Result |
|---|---:|---:|---|
| Landing overlay paint (nav start → overlay text committed) | 5.03–5.08 s (5 runs: 5078, 5063, 5026, 5048, 5051 ms) | < 2 s | **FAIL** |
| First galaxy frame, `introPhase>=1` ("hero"), after click | 564–576 ms | < 3 s | PASS |
| First galaxy frame, `introPhase>=3` ("galaxy"), after click | 1.45 s | < 3 s | PASS |

**Root cause of the overlay-paint failure:** the production build ships as a
single JS chunk — `dist/assets/index-C0Rm7z17.js`, 2,040.87 kB raw / 580.92 kB
gzip (Vite serves it gzip'd; `vite preview`'s compression middleware
confirmed via `Content-Encoding: gzip`) — and nothing paints until it has
downloaded, parsed, and executed enough to mount React. Isolating the two
throttles (cache disabled throughout) on the same build:

| Throttle | Overlay paint |
|---|---:|
| None (baseline) | 0.36 s |
| CPU 4× only | 0.70 s |
| Fast 3G only | 4.64 s |
| CPU 4× + Fast 3G | 5.03 s |

Network is almost the entire cost (4.64 s of the 5.03 s): at Fast 3G's
180000 B/s, the 580.92 kB gzip payload alone is ~3.2 s, plus the ~562.5 ms
RTT paid on the connection/HTML/subsequent-request round trips.

**No fix applied.** None of this task's sanctioned knobs (bloom levels, DoF
resolution scale, fbm octaves, sphere segments — all runtime-rendering
levers) touch initial bundle size or loading strategy, and the brief's step 3
is explicit: apply the listed knobs in order, "do NOT touch anything else."
Code-splitting the entry bundle (e.g. dynamic `import()` for
`@react-three/postprocessing`, `gsap`, the Time Machine/roulette modules
that aren't needed for first paint) is the change that would actually move
this number, but it is out of this task's scope and is flagged here for a
follow-up task instead of attempted ad hoc.

## 3. Bundle sanity

`npx vite build` output:

```
dist/index.html                     4.38 kB │ gzip:   1.59 kB
dist/assets/index-CeAT17un.css     14.42 kB │ gzip:   3.33 kB
dist/assets/index-C0Rm7z17.js   2,040.87 kB │ gzip: 580.92 kB

(!) Some chunks are larger than 500 kB after minification.
```

Main chunk: **2,040.87 kB raw** — under the 2.2 MB flag threshold, and the
`>500 kB` warning is the pre-existing, already-known one (per the brief).
Not flagged. (It is, however, the direct cause of the cold-load failure
above — the two findings are the same fact read two ways.)

## Summary

- FPS matrix: 8/8 scenarios pass, all at this environment's apparent 120 fps
  ceiling. No knobs applied.
- Cold load: first-galaxy-frame-after-click passes at both thresholds tried.
  Landing-overlay-paint fails its <2s gate (measured ~5.0s) due to the
  unsplit ~581 kB gzip entry bundle under Fast 3G; no in-scope knob
  addresses this, flagged for follow-up (bundle code-splitting).
- Bundle sanity: main chunk 2,040.87 kB raw, under the 2.2 MB flag line.
