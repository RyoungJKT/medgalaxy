# MedGalaxy Next: Hygiene and Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the "hygiene" and "quick wins" tiers of the 2026-09-10 review on branch `next/showcase`: unblock the Retina resolution and selection depth of field that camera breathing silently disabled, give the frame the direction's own stage color and a star field that exists, give selection one voice and let stories own the frame, fix Escape and the keyboard, run the rigor and copy pass, and say the tour's spine once on the 2021 peak card.

**Architecture:** No new subsystems. A `cameraOwner` flag published by CameraRig replaces the per-frame displacement heuristic in AdaptiveDpr and PostFX. A `ground` channel on `sceneRefs.fx` (the same mutable-per-frame path desat/ignite already use) drives the renderer clear color and the node fog color. Story ownership is gated on the existing `storyActive` store flag; no new FSM. Every new number on screen is derived at render time from `data/diseases.json` through pure, unit-tested helpers.

**Tech Stack (as installed, read from node_modules):** React 18.3.1, @react-three/fiber 8.18, three 0.183, @react-three/postprocessing 2.19 (postprocessing 6.x), gsap 3.14, zustand 5, Vite 6.4, vitest 3, puppeteer-core 24. The earlier plan header's React 19 / Vite 7 line was never applied; do not upgrade anything in this plan.

## Global Constraints

- Branch `next/showcase` only, in worktree `/Users/darwin/Documents/Claude/medgalaxy-next`. NEVER touch `main`; never deploy to medgalaxy.org. The snapshot preview is redeployed only in Task 7 with `npx vercel --prod --yes --scope ryoungjkts-projects`.
- Run everything from the worktree directory. `npx vitest run` from the parent folder sweeps other projects.
- Dev server for verification: `npx vite --port 5280 --strictPort` (one instance; check `curl -s -o /dev/null -w "%{http_code}" http://localhost:5280` before starting another).
- Commit after every task with a conventional message. NO Co-Authored-By trailer, no Claude or Anthropic mention anywhere in commit messages. Author identity is the user's git config.
- House copy style: no em dashes anywhere (code comments included in new text), no section-sign symbol, sentence case captions, IBM Plex Mono only, no colored accent stripes on cards, no gradient text.
- Every displayed number is derived at render time from `data/*.json` or carries an explicit source string; never hard-code a stat in a caption. Never sum papers or mortality across diseases.
- Bloom discipline: only ignite-ramp emissives may exceed the bloom luminance threshold (1.0). Nothing added here may bloom: the stage color and star field stay far below it.
- Motion constitution (`docs/direction/2026-08-11-cinematic-direction.md` section 4, tokens in `src/utils/motion.js`): sanctioned durations 120/180/240/320/480/650 ms via `DUR`, `EASE.ui` for UI. New transitions in this plan use `DUR.ui` (240) and `DUR.slow` (480).
- The certified opening's bones are not restaged: no new film beats, no tour pause changes, no camera seat changes.
- Verification uses the puppeteer harness (`tools/verify.mjs` and siblings), never the browser pane (its rAF is throttled). `window._store` (zustand), `window.__scene` (sceneRefs), `window.__overture.seek(t)`, `window.__tour.seek(n)` and `window.__assembly.seek(t)` are the dev hooks.
- Tests must stay green at every commit: currently 333 across 18 files.

## File Structure

```
src/sceneRefs.js                       MOD  cameraOwner, fx.ground, dpr + postfx debug state
src/components/CameraRig.jsx           MOD  publish sceneRefs.cameraOwner from onStart/onEnd + tween state
src/components/AdaptiveDpr.jsx         MOD  owner-based DPR, Retina rest DPR, switch hysteresis
src/components/PostFX.jsx              MOD  owner-based DOF gate, 480 ms rack, dithering on passes
src/components/StageGround.jsx         NEW  drives gl clear color from fx.ground each frame
src/utils/stage.js                     NEW  pure ground-color helper (assembly / desat blend)
src/components/OvertureSequence.jsx    MOD  write fx.ground beside every fx.desat write
src/store.js                           MOD  fx.ground reset in finishOverture; storyProvenance
src/components/DiseaseNodes.jsx        MOD  fogColor uniform tracks fx.ground
src/components/BackgroundParticles.jsx MOD  legible stars: size floor, magnitude spread, gaussian falloff
src/utils/tiers.js                     MOD  particles HIGH 1200, MEDIUM 500
src/utils/motion.js                    MOD  AMBIENT.stars.minPx / magnitude constants
src/components/ui/Tooltip.jsx          MOD  selected-node branch mobile only
src/components/ui/Sidebar.jsx          MOD  stands down during stories; no-estimate + registry rows; term-overlap tag
src/components/ui/CompareCards.jsx     MOD  stands down during stories; skips substring-pair links
src/components/NodeLabels.jsx          MOD  only the subject during stories
src/components/ui/Header.jsx           MOD  dims during stories (toggle stays); search Enter/arrows/blur
src/components/ui/FilterBar.jsx        MOD  dims during stories
src/components/StoryEngine.jsx         MOD  per-step provenance
src/utils/storyProvenance.js           NEW  pure provenance-line builder
src/components/ui/StoryCaption.jsx     MOD  provenance micro-line; Escape gated on an active story
src/components/ui/SearchDropdown.jsx   MOD  highlighted row
src/components/ui/TimeRail.jsx         MOD  wheel over the band steps years
src/components/ui/StoryChips.jsx       MOD  keys 1-7 fire chips
src/utils/captions.js                  MOD  ratioStr (one rounding rule)
src/components/Spotlight.jsx           MOD  factoids replaced with derived stats; ratioStr
src/components/GalaxyRoulette.jsx      MOD  ratioStr
src/components/ui/ExplodeOverlay.jsx   MOD  neutral column labels, no em dash
src/components/ui/ConnectionsOverlay.jsx MOD no em dash
src/components/ui/VelocityOverlay.jsx  MOD  no em dash
src/components/ui/Legend.jsx           MOD  Methodology link (desktop)
src/components/ui/MethodologyPanel.jsx MOD  term-overlap sentence; funding gap sentence
src/utils/mortalityLabel.js            MOD  registry-only class
src/utils/helpers.js                   MOD  processData marks substring pairs
src/components/TimeMachine.jsx         MOD  peak card spine line; finale micro range; hivFade line
tools/verify.mjs                       MOD  --dsf flag
tools/verify-dpr.mjs                   NEW  DPR / DOF / switch-count assertions + Retina FPS rows
docs/verify/perf-matrix.md             MOD  Retina rows
docs/verify/scorecard.md               MOD  post-certification addendum
tests/stage.test.js                    NEW
tests/storyProvenance.test.js          NEW
tests/captions.test.js                 MOD  ratioStr
tests/mortalityLabel.test.js           MOD  registry class
tests/normalization.test.js            MOD  substring pairs
tests/timeMachineTour.test.js          MOD  spine line, finale micro, hivFade line
tests/ambient.test.js                  MOD  star constants
```

---

### Task 1: Unblock DPR 1.5 and the selection depth of field

**Files:**
- Modify: `src/sceneRefs.js`
- Modify: `src/components/CameraRig.jsx` (onStart at ~366, OrbitControls JSX at ~380, useFrame at ~246)
- Modify: `src/components/AdaptiveDpr.jsx` (whole file)
- Modify: `src/components/PostFX.jsx` (lines 16-65)
- Modify: `tools/verify.mjs` (viewport setup)
- Create: `tools/verify-dpr.mjs`
- Modify: `docs/verify/perf-matrix.md`

**Interfaces:**
- Produces: `sceneRefs.cameraOwner: 'user' | 'tween' | 'ambient'` (written every frame by CameraRig), `sceneRefs.dprState = { current: number, rest: number, switches: number }` (AdaptiveDpr), `sceneRefs.postfx = { bokeh: number }` (PostFX). Task 7 and the harness read these.

Background (from the review): `AdaptiveDpr.jsx:22-28` and `PostFX.jsx:36-42` treat any camera displacement above 0.01 units per frame as "camera moving". The addendum's camera breathing (`CameraRig.jsx`, useFrame) exceeds that every frame, so the drawing buffer sits at DPR 1.0 at rest and the depth of field never racks in on a plain click. Confirmed live: buffer 1440x900 at rest, 2160x1350 only after a drag.

- [ ] **Step 1: Add the owner flag and debug state to sceneRefs**

In `src/sceneRefs.js`, after the `nodeRadius: null,` entry add:

```js
  // Who is moving the camera this frame, published by CameraRig every frame:
  //   'user'    a hand on the controls, plus the damping tail after it lets go
  //   'tween'   a gsap tween on camera.position, the film, the tour, the exit
  //             or the handover's decaying autoRotate
  //   'ambient' breathing, autoRotate, cursor parallax: the camera is "at rest"
  //             for every fidelity decision (DPR, depth of field)
  // Replaces the old per-frame displacement heuristic, which the addendum's
  // camera breathing tripped on every frame.
  cameraOwner: 'ambient',
  // Read by the harness: the DPR AdaptiveDpr last applied, the rest value it
  // targets on this display, and how many times it has switched this session.
  dprState: { current: 1, rest: 1, switches: 0 },
  // Read by the harness: the DepthOfField bokehScale PostFX applied this frame.
  postfx: { bokeh: 0 },
```

- [ ] **Step 2: Publish the owner from CameraRig**

In `src/components/CameraRig.jsx`, add a drag ref next to `breathe`:

```js
  // Task 1 (2026-09-10 plan): the controls' own gesture state, so fidelity
  // decisions can tell a hand on the mouse from ambient motion. `quiet` counts
  // frames since the gesture ended; the damping tail is over well inside 30.
  const drag = useRef({ active: false, quiet: 999 });
```

In `onStart` add as the first line: `drag.current.active = true; drag.current.quiet = 0;`

Add an `onEnd` handler right after `onStart`:

```js
  const onEnd = () => {
    drag.current.active = false;
    drag.current.quiet = 0;
  };
```

Pass it to the controls: `<OrbitControls ... onStart={onStart} onEnd={onEnd} makeDefault />`.

At the top of the `useFrame` callback body (before the autoRotate block, right after the store reads it already does), add:

```js
    // Camera owner for this frame (see sceneRefs.cameraOwner).
    {
      const d = drag.current;
      if (!d.active) d.quiet++;
      const s = useStore.getState();
      const tweening = gsap.isTweening(camera.position);
      const cinematic = s.overtureActive || s.introPhase < 5 || s.tmPhase === 'tour' ||
        (s.tmExitAt > 0 && sceneRefs.tm && sceneRefs.tm.active) ||
        (sceneRefs.handover.speed != null && !sceneRefs.handover.cancelled);
      sceneRefs.cameraOwner = d.active || d.quiet < 30 ? 'user' : (tweening || cinematic) ? 'tween' : 'ambient';
    }
```

Check the exact names of the store fields the block reads (`overtureActive`, `introPhase`, `tmPhase`, `tmExitAt`) against `src/store.js`; all four exist today. If the useFrame callback already destructures them, reuse those locals.

- [ ] **Step 3: Rewrite AdaptiveDpr on the owner flag**

Replace `src/components/AdaptiveDpr.jsx` with:

```js
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import useStore from '../store';
import { CFG } from '../utils/tiers';
import { sceneRefs } from '../sceneRefs';

// Rest DPR is the display's own ratio, capped by the tier: a 1x display never
// pays for 1.5x, and a Retina display gets the cap the tier allows.
const REST_DPR = Math.min(
  typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
  CFG.dprCap
);
const MOTION_DPR = 1;
// Frames of 'ambient' ownership before DPR returns to rest, so two tweens a few
// frames apart (a fly landing, the next cue starting) do not flap the buffer.
const SETTLE_FRAMES = 10;

// Task 1 (2026-09-10 plan): the old version compared the camera's position to
// last frame's and treated any 0.01-unit change as motion. Camera breathing
// (ADDENDUM 1 section 4 item 1) moves the camera more than that every frame,
// so every viewer who did not drag first watched a 1x upscale for the whole
// visit. Ownership, not displacement, is the signal now: a hand on the
// controls and any tween or cinematic phase render at MOTION_DPR; ambient
// motion (breathing, autoRotate, parallax) is rest.
export default function AdaptiveDpr() {
  const gl = useThree(s => s.gl);
  const settled = useRef(0);
  const currentDpr = useRef(null);

  useEffect(() => {
    sceneRefs.dprState.rest = REST_DPR;
  }, []);

  useFrame(() => {
    const owner = sceneRefs.cameraOwner;
    const spotlightActive = useStore.getState().spotlightActive;
    const wantLow = owner !== 'ambient' || spotlightActive;
    if (wantLow) settled.current = 0; else settled.current++;

    const want = wantLow ? MOTION_DPR : (settled.current >= SETTLE_FRAMES ? REST_DPR : currentDpr.current ?? MOTION_DPR);
    if (want !== currentDpr.current) {
      if (currentDpr.current !== null) sceneRefs.dprState.switches++;
      currentDpr.current = want;
      gl.setPixelRatio(want);
      sceneRefs.dprState.current = want;
    }
  });

  return null;
}
```

Note the composite-only switch is kept on purpose (`gl.setPixelRatio`, not R3F's `setDpr`): the EffectComposer's render targets stay at the size R3F allocated and only the drawing buffer changes, so a switch never reallocates targets mid-handover. Record this in the file comment if you change it.

- [ ] **Step 4: Gate the depth of field on the owner and rack it over 480 ms**

In `src/components/PostFX.jsx` replace the `useFrame` body (lines 24-65) with:

```js
  useFrame((state, delta) => {
    const effect = dofRef.current;
    if (!effect) return;

    const { selectedNode, curPos, spotlightActive } = useStore.getState();
    const cam = sceneRefs.camera;

    // Task 1 (2026-09-10 plan): the DOF used to be suppressed whenever the
    // camera had moved more than 0.01 units since last frame, or whenever a
    // flyTarget was set (and flyTarget is never cleared after a fly lands).
    // Camera breathing tripped the first test every frame, so the rack never
    // happened on a plain click. Ownership is the test now: a hand on the
    // controls or a live tween suppresses it; ambient motion does not.
    const tweening = cam ? gsap.isTweening(cam.position) : false;
    const suppress = sceneRefs.cameraOwner === 'user' || tweening || spotlightActive;

    // Critically damped approach with a 160 ms time constant: 95 percent of the
    // rack lands inside DUR.slow (480 ms), the sanctioned instrument duration.
    const dt = delta > 0.05 ? 0.05 : delta;
    const k = 1 - Math.exp(-dt / (DUR.slow / 3000));

    if (selectedNode && cam && !suppress) {
      const pos = curPos[selectedNode.index];
      _target.set(pos[0], pos[1], pos[2]);
      if (effect.target) effect.target.copy(_target);
      curBokeh.current += (MAX_BOKEH - curBokeh.current) * k;
    } else {
      curBokeh.current += (0 - curBokeh.current) * k;
    }

    if (curBokeh.current < 0.01) curBokeh.current = 0;
    effect.bokehScale = curBokeh.current;
    sceneRefs.postfx.bokeh = curBokeh.current;
  });
```

Add the imports `import gsap from 'gsap';` and `import { DUR } from '../utils/motion';`, and delete the now-unused `prevCamRef` and `idleFrames` refs. `DUR.slow / 3000` is 0.16 s (480 ms over three time constants).

- [ ] **Step 5: Add a deviceScaleFactor flag to the harness**

In `tools/verify.mjs`, add after the `headed` flag:

```js
// --dsf N: emulate a display with this devicePixelRatio (2 for a Retina
// MacBook). Task 1 of the 2026-09-10 plan: AdaptiveDpr rests at
// min(devicePixelRatio, tier cap), so at --dsf 1 the rest DPR is 1 and the
// Retina path is invisible; every DPR/DOF assertion runs at --dsf 2.
const dsf = Number(get('--dsf') || 1);
```

and change the `setViewport` call to pass `deviceScaleFactor: dsf` in both branches:

```js
await page.setViewport(
  mobile
    ? { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: dsf }
    : { width: 1440, height: 900, deviceScaleFactor: dsf }
);
```

- [ ] **Step 6: Write the DPR/DOF assertion harness**

Create `tools/verify-dpr.mjs`:

```js
// tools/verify-dpr.mjs
// Task 1 of the 2026-09-10 plan. Proves the two fidelity features the
// addendum's camera breathing had silently disabled are back:
//   1. at home rest on a 2x display the drawing buffer is 2160x1350 (DPR 1.5)
//   2. a plain click (no prior drag) racks the depth of field to bokeh > 2.5
//      within 1 s
//   3. the buffer switches DPR at most twice across the whole opening + tour
// Run with the dev server up:  node tools/verify-dpr.mjs [--headed] [--fps]
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const headed = args.includes('--headed');
const doFps = args.includes('--fps');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: headed ? false : 'new',
  args: ['--window-size=1440,900', '--use-gl=angle'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction('window._store !== undefined', { timeout: 15000 });
await wait(800);
await page.mouse.click(720, 450); // begin
await wait(1200);
// Let the film and the tour play untouched: every DPR switch counts.
await page.waitForFunction(() => window._store.getState().overtureDone, { timeout: 60000 });
await page.waitForFunction(() => window._store.getState().tmPhase === 'tour', { timeout: 30000 });
await page.waitForFunction(
  () => window._store.getState().tmPhase === 'idle' && window.__scene.cameraOwner === 'ambient',
  { timeout: 90000 }
);
await wait(2500);

const fail = [];
const rest = await page.evaluate(() => ({
  buffer: [window.__scene.canvasElement.width, window.__scene.canvasElement.height],
  dpr: window.__scene.dprState.current,
  restDpr: window.__scene.dprState.rest,
  switches: window.__scene.dprState.switches,
  owner: window.__scene.cameraOwner,
}));
console.log('home rest:', JSON.stringify(rest));
if (rest.dpr !== 1.5 || rest.buffer[0] !== 2160) fail.push(`rest DPR ${rest.dpr}, buffer ${rest.buffer}`);
if (rest.switches > 2) fail.push(`${rest.switches} DPR switches across opening + tour (max 2)`);

// A plain click on a node, no drag first.
await page.evaluate(() => {
  const s = window._store.getState();
  s.selectDisease(s.diseases.findIndex((d) => d.id === 'sepsis'));
});
let bokeh = 0;
const t0 = Date.now();
while (Date.now() - t0 < 2500) {
  bokeh = await page.evaluate(() => window.__scene.postfx.bokeh);
  if (bokeh > 2.5) break;
  await wait(50);
}
console.log(`bokeh ${bokeh.toFixed(2)} after ${Date.now() - t0} ms`);
if (bokeh <= 2.5) fail.push(`DOF never racked in (bokeh ${bokeh.toFixed(2)})`);

if (doFps) {
  const measure = async (label) => {
    const fps = await page.evaluate(async () => {
      let frames = 0; const t0 = performance.now();
      await new Promise((res) => { const tick = () => { frames++;
        performance.now() - t0 < 5000 ? requestAnimationFrame(tick) : res(); };
        requestAnimationFrame(tick); });
      return Math.round(frames / 5);
    });
    console.log(`| HIGH | 1440x900 @2x | ${label} | ${fps} |`);
  };
  await page.evaluate(() => window._store.getState().deselect());
  await wait(3000);
  await measure('At rest, DPR 1.5, breathing + autoRotate');
  await page.evaluate(() => window.__overture.seek(6.0));
  await wait(300);
  await page.evaluate(() => window.__overture.resume());
  await measure('Beat 2 (the morph), DPR 1');
  await page.evaluate(() => window.__tour.seek(0.97));
  await wait(300);
  await page.evaluate(() => window.__tour.resume());
  await measure('Time Machine leg, DPR 1');
}

await browser.close();
if (fail.length) { console.error('FAIL\n  ' + fail.join('\n  ')); process.exit(1); }
console.log('PASS');
```

Check the names of the two dev hooks' resume functions (`window.__overture.resume`, `window.__tour.resume`) in `OvertureSequence.jsx` and `TimeMachine.jsx` and adjust if they differ (perf-matrix.md shows both were used before).

- [ ] **Step 7: Run the assertions headless**

Run: `node tools/verify-dpr.mjs`
Expected: `home rest: {"buffer":[2160,1350],"dpr":1.5,...,"switches":1 or 2,"owner":"ambient"}`, `bokeh 2.5x after < 1000 ms`, `PASS`.

If the film's compressed skip or the tour exit leaves `cameraOwner` at `'tween'` (the wait at the top times out), print `window.__scene.cameraOwner` and the store phases and fix the `cinematic` expression in Step 2 rather than loosening the assertion.

- [ ] **Step 8: Measure the Retina FPS rows headed and record them**

Run: `node tools/verify-dpr.mjs --headed --fps`
Expected: three markdown rows printed. Append them to `docs/verify/perf-matrix.md` under a new heading `## 1b. Retina rows (Task 1, 2026-09-10)` with the note: "Measured headed at deviceScaleFactor 2 on the same machine; the at-rest row is the first on-display number in this file that includes DPR 1.5, breathing and the depth of field at once. Gate stays 55 fps for HIGH." If the at-rest row falls below 55, set `REST_DPR` to `Math.min(devicePixelRatio, 1.25)` in AdaptiveDpr, re-measure, and record both numbers.

- [ ] **Step 9: Run the suite and commit**

Run: `npx vitest run`
Expected: 333 passed.

```bash
git add src/sceneRefs.js src/components/CameraRig.jsx src/components/AdaptiveDpr.jsx src/components/PostFX.jsx tools/verify.mjs tools/verify-dpr.mjs docs/verify/perf-matrix.md
git commit -m "fix: rest DPR and selection depth of field keyed on camera owner, not displacement"
```

---

### Task 2: Stage color script and a star field that exists

**Files:**
- Create: `src/utils/stage.js`, `tests/stage.test.js`, `src/components/StageGround.jsx`
- Modify: `src/sceneRefs.js` (fx object), `src/components/OvertureSequence.jsx` (every `sceneRefs.fx.desat =` write: ~379, ~445, ~528), `src/store.js` (finishOverture ~255-260), `src/App.jsx` (Canvas style + mount), `src/components/DiseaseNodes.jsx` (fog uniform copy ~351-360), `src/components/BackgroundParticles.jsx`, `src/utils/motion.js` (AMBIENT.stars), `src/utils/tiers.js`, `src/components/PostFX.jsx` (dithering), `tests/ambient.test.js`, `tools/verify-r6fix.mjs` (assembly luminance baseline)

**Interfaces:**
- Produces: `sceneRefs.fx.ground` (hex number), `groundFor(assemblyActive, desat)` from `src/utils/stage.js`, `AMBIENT.stars.minPx`, `AMBIENT.stars.magnitude`.

Background: the canvas clears to `#000000` (`App.jsx:185`, alpha canvas over a black div), `fogColor` is `0x000000`, and the direction's stage (`#06080d` base, `#04060a` in beat 0, `#030409` in beat 2 stage one) never reached the renderer. The three star shells (400 points, 1 to 2.2 px, `#3b4a63` at 0.6 opacity) are invisible at 1440x900.

- [ ] **Step 1: Write the failing test for the ground helper**

Create `tests/stage.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STAGE, groundFor } from '../src/utils/stage';

describe('stage ground color (DIRECTION section 1, color script)', () => {
  it('carries the three directed stage colors', () => {
    expect(STAGE.base).toBe(0x06080d);
    expect(STAGE.assembly).toBe(0x04060a);
    expect(STAGE.suppressed).toBe(0x030409);
  });
  it('is the assembly stage while beat 0 is live, whatever desat says', () => {
    expect(groundFor(true, 1)).toBe(STAGE.assembly);
    expect(groundFor(true, 0)).toBe(STAGE.assembly);
  });
  it('sinks with desat and returns to base at zero', () => {
    expect(groundFor(false, 0)).toBe(STAGE.base);
    expect(groundFor(false, 1)).toBe(STAGE.suppressed);
    const mid = groundFor(false, 0.5);
    const r = (c) => (c >> 16) & 255;
    expect(r(mid)).toBeGreaterThanOrEqual(r(STAGE.suppressed));
    expect(r(mid)).toBeLessThanOrEqual(r(STAGE.base));
  });
  it('never exceeds the base: the stage can only get darker', () => {
    for (let d = 0; d <= 1; d += 0.1) expect(groundFor(false, d)).toBeLessThanOrEqual(STAGE.base);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/stage.test.js`
Expected: FAIL, module `../src/utils/stage` not found.

- [ ] **Step 3: Write the helper**

Create `src/utils/stage.js`:

```js
// The stage color script (DIRECTION section 1, "Color script, beat by beat"):
// base stage #06080d, space deepens to #04060a through beat 0, and the ground
// sinks to #030409 during beat 2's suppression, returning with the release.
// One channel, `sceneRefs.fx.ground`, carries it to the renderer's clear color
// (StageGround.jsx) and to the node shaders' fog color (DiseaseNodes.jsx), so
// far nodes fog into the stage instead of into black. Pure so the script is
// a test, not a promise.
export const STAGE = {
  base: 0x06080d,
  assembly: 0x04060a,
  suppressed: 0x030409,
};

function lerpHex(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/**
 * The ground color for this frame.
 * @param {boolean} assemblyActive beat 0 is live (sceneRefs.assembly.active)
 * @param {number} desat the film's desaturation channel, 0..1
 */
export function groundFor(assemblyActive, desat) {
  if (assemblyActive) return STAGE.assembly;
  const t = desat <= 0 ? 0 : desat >= 1 ? 1 : desat;
  return lerpHex(STAGE.base, STAGE.suppressed, t);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/stage.test.js`
Expected: 4 passed.

- [ ] **Step 5: Add the channel to sceneRefs and write it beside every desat write**

In `src/sceneRefs.js` change the fx line to:

```js
  fx: { morphOverride: null, ignite: 0, desat: 0, ember: 0, glowSuppress: 0, igniteContrast: 1, ground: 0x06080d },
```

and extend the comment block above it with: `//   ground: the stage color this frame (src/utils/stage.js), read by StageGround (clear color) and DiseaseNodes (fog color).`

In `src/components/OvertureSequence.jsx` import `import { groundFor } from '../utils/stage';` and:
- at the mount effect (~line 379, after `sceneRefs.fx.desat = 1;`) add `sceneRefs.fx.ground = groundFor(true, 1);`
- at the beat-0 hold (~line 445, after `sceneRefs.fx.desat = 1;`) add `sceneRefs.fx.ground = groundFor(true, 1);`
- at the continuous channels (~line 528, after `sceneRefs.fx.desat = o.desat;`) add `sceneRefs.fx.ground = groundFor(false, o.desat);`

If the file has any other `sceneRefs.fx.desat =` write (grep it), pair it the same way.

In `src/store.js` `finishOverture` (~line 257, after `sceneRefs.fx.desat = 0;`) add `sceneRefs.fx.ground = groundFor(false, 0);` with the import `import { groundFor } from './utils/stage';`.

- [ ] **Step 6: Drive the clear color from the channel**

Create `src/components/StageGround.jsx`:

```js
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sceneRefs } from '../sceneRefs';

// Task 2 (2026-09-10 plan): the renderer used to clear to transparent over a
// #000000 div, so the direction's stage color never reached a pixel. The
// clear color now follows sceneRefs.fx.ground every frame (a hex number, see
// src/utils/stage.js), opaque, so the CSS behind the canvas no longer matters.
export default function StageGround() {
  const gl = useThree((s) => s.gl);
  const last = useRef(-1);
  useEffect(() => {
    gl.setClearColor(sceneRefs.fx.ground, 1);
    last.current = sceneRefs.fx.ground;
  }, [gl]);
  useFrame(() => {
    const g = sceneRefs.fx.ground;
    if (g !== last.current) {
      gl.setClearColor(g, 1);
      last.current = g;
    }
  });
  return null;
}
```

In `src/App.jsx` mount `<StageGround />` as the first child inside `<Suspense>` (before `<TimeMachine>`), import it, and change the Canvas `style={{ background: '#000000' }}` to `style={{ background: '#06080d' }}` (the frame before the first clear). Leave `gl.alpha` as is.

- [ ] **Step 7: Make the node fog track the stage**

In `src/components/DiseaseNodes.jsx`, in the per-frame uniform copy (~line 351, inside `if (mat.uniforms) {`), after `mat.uniforms.igniteContrast.value = ...;` add:

```js
      // The fog is the stage: far nodes dissolve into the ground color, not
      // into black (Task 2, 2026-09-10 plan).
      if (mat.uniforms.fogColor.value.getHex() !== fx.ground) mat.uniforms.fogColor.value.setHex(fx.ground);
```

Both materials share `fogUniforms` (one object), so one write covers plasma and pulse. Change the initial `fogColor: { value: new THREE.Color(0x000000) }` (~line 236) to `new THREE.Color(0x06080d)`.

- [ ] **Step 8: Add the star constants and the failing test**

In `src/utils/motion.js` extend `AMBIENT.stars` with two entries after `twinkle`:

```js
    // Task 2 (2026-09-10 plan): legibility. `minPx` is the on-screen floor per
    // shell in CSS px (near, mid, far), because a 1 px point at 6.2x camDist
    // is invisible on any display; `magnitude` is the power-law exponent for
    // per-star brightness (u^magnitude with u uniform on 0..1): a few stars
    // read, most stay faint, the way a sky does.
    minPx: [2.2, 1.6, 1.1],
    magnitude: 2.6,
```

In `tests/ambient.test.js`, inside `describe('the star shells (section 4 item 2)')`, add:

```js
  it('gives every shell an on-screen size floor and a power-law brightness spread', () => {
    const { minPx, magnitude } = AMBIENT.stars;
    expect(minPx).toHaveLength(3);
    for (let i = 1; i < 3; i++) expect(minPx[i]).toBeLessThan(minPx[i - 1]);
    expect(minPx[2]).toBeGreaterThanOrEqual(1.0);
    expect(magnitude).toBeGreaterThan(1);
  });
```

Run: `npx vitest run tests/ambient.test.js`
Expected: the new case FAILS (minPx undefined) until the constants land; then PASS.

- [ ] **Step 9: Raise the budgets and rewrite the star shader**

In `src/utils/tiers.js` set `particles: 1200` for HIGH and `particles: 500` for MEDIUM (LOW stays 0).

In `src/components/BackgroundParticles.jsx`:

Replace `TWINKLE_VERT` and `TWINKLE_FRAG` with:

```js
const TWINKLE_VERT = `
attribute float aPhase;
attribute float aRate;
attribute float aMag;
uniform float uSize;
uniform float uScale;
uniform float uTime;
uniform float uMinPx;
varying float vTw;
varying float vMag;
void main() {
  vTw = 0.5 + 0.5 * sin(uTime * aRate + aPhase);
  vMag = aMag;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // The tier's size attenuation, floored at a legible on-screen size.
  gl_PointSize = max(uMinPx, uSize * (uScale / -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const TWINKLE_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uLo;
varying float vTw;
varying float vMag;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float d2 = dot(d, d);
  if (d2 > 0.25) discard;
  // Gaussian falloff instead of a hard disc: a star is a point of light, not
  // a coin.
  float a = exp(-d2 * 9.0);
  gl_FragColor = vec4(uColor, uOpacity * a * vMag * mix(uLo, 1.0, vTw));
}`;
```

In the `shells` memo, allocate and fill a magnitude array beside `phase`/`rate`:

```js
      const mag = new Float32Array(n);
      ...
        mag[i] = 0.25 + 0.75 * Math.pow(Math.random(), S.magnitude);
```

and include `mag` in the pushed object. In the `mats` memo, use the shader on HIGH and MEDIUM (`if (TIER === 'LOW') return null;`), add the uniforms `uMinPx: { value: S.minPx[i] * dprNow }` where `dprNow = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, CFG.dprCap) : 1` (compute once above the memo), and raise `BASE_OPACITY` to `0.9`. In the JSX add the attribute beside `aRate`:

```jsx
              {mats && (
                <bufferAttribute attach="attributes-aMag" count={sh.n} array={sh.mag} itemSize={1} />
              )}
```

Because `mats` now exists on MEDIUM, the `pointsMaterial` fallback only renders on LOW, which has zero particles; leave the fallback in place.

`uMinPx` is in device pixels because `gl_PointSize` is; multiplying by the rest DPR keeps the floor the same CSS size on a Retina display. AdaptiveDpr drops the buffer to DPR 1 during tweens, so the floor grows by 1.5x on screen during motion; that is acceptable (stars are 1 to 3 px).

- [ ] **Step 10: Turn on dithering in the post chain**

In `src/components/PostFX.jsx`, add a ref to the composer and enable dithering on its effect passes once mounted:

```js
  const composerRef = useRef();
  useEffect(() => {
    const c = composerRef.current;
    if (!c || !c.passes) return;
    // Task 2 (2026-09-10 plan): the warm ignite gradient bands in 8-bit; the
    // post chain's own dithering removes it for free.
    for (const p of c.passes) {
      if ('dithering' in p) p.dithering = true;
      else if (p.fullscreenMaterial) p.fullscreenMaterial.dithering = true;
    }
  }, []);
```

and `<EffectComposer ref={composerRef} resolutionScale={DOF_RES_SCALE}>`. Import `useEffect`. Verify in the running app: `window.__scene` does not expose the composer, so check with `node tools/verify.mjs --eval "document.querySelector('canvas') !== null"` only for a clean load, and confirm visually in Step 13 that the ignite frame's warm gradient no longer bands (zoom the r7 ignite shot).

- [ ] **Step 11: Run the suite**

Run: `npx vitest run`
Expected: 338 passed (333 + 4 stage + 1 ambient).

- [ ] **Step 12: Re-baseline the beat-0 luminance check**

Run: `node tools/verify-r6fix.mjs` (it needs the dev server on 5280). Read the printed `t=... mean ... lit>2 ...` lines. The ground color lifts the whole-frame mean by roughly 6 to 8 counts on 255 and the star floor raises `lit>2`; the script's assertions after `const at16 = ...` compare against round-5 numbers. Update those expected values and the comment beside them to the new readings, stating in the comment that the baseline moved because the stage is now `#04060a` under beat 0 (Task 2, 2026-09-10 plan) and the stars have a size floor. Do not weaken the comet-peak assertion (`peak`), which the stage does not touch.

- [ ] **Step 13: Cut the reference frames**

With the server up, run:

```bash
node tools/verify.mjs --eval "window.__assembly.seek(1.6)" --shot r7-01-asm-1p6
node tools/verify.mjs --eval "window.__overture.seek(9.6)" --shot r7-02-film-ignite
node tools/verify.mjs --eval "(async()=>{const s=window._store.getState(); s.setIntroStarted&&s.setIntroStarted(); s.skipOverture&&s.skipOverture(); await new Promise(r=>setTimeout(r,4000));})()" --shot r7-03-home
node tools/verify.mjs --mobile --eval "window.__assembly.seek(1.6)" --shot r7-m-01-asm-1p6
```

If a seek needs the landing dismissed first, prepend `document.querySelector('[style*=\"z-index: 200\"]')?.click();` to the eval (see `tools/verify-fuzz.mjs` for the landing selector). Open the four PNGs with the Read tool and confirm: the background is `#06080d`/`#04060a` not pure black (sample a corner pixel with a tiny node script if in doubt), stars are visible as points at 1440x900, no star or ground pixel is bright enough to bloom (the bloom threshold is luminance 1.0; the stage is under 0.02 linear), and the ignite frame still reads as the one lit event.

- [ ] **Step 14: Commit**

```bash
git add src/utils/stage.js tests/stage.test.js src/components/StageGround.jsx src/sceneRefs.js src/components/OvertureSequence.jsx src/store.js src/App.jsx src/components/DiseaseNodes.jsx src/components/BackgroundParticles.jsx src/utils/motion.js src/utils/tiers.js src/components/PostFX.jsx tests/ambient.test.js tools/verify-r6fix.mjs docs/verify/r7-*.png
git commit -m "feat: stage color script and a legible star field"
```

---

### Task 3: One voice on selection, and stories own the frame

**Files:**
- Modify: `src/components/ui/Tooltip.jsx` (lines 93-109), `src/components/ui/Sidebar.jsx` (~line 92), `src/components/ui/CompareCards.jsx` (~line 182), `src/components/NodeLabels.jsx` (Pass 1 ~line 143), `src/components/ui/Header.jsx`, `src/components/ui/FilterBar.jsx`, `src/store.js`, `src/components/StoryEngine.jsx`, `src/components/ui/StoryCaption.jsx`
- Create: `src/utils/storyProvenance.js`, `tests/storyProvenance.test.js`

**Interfaces:**
- Consumes: `storyActive` (store, string chip id or null), `mortalitySourceLabel`, `isNoGlobalEstimate` from `src/utils/mortalityLabel.js`.
- Produces: store field `storyProvenance: string` + `setStoryProvenance(v)`; `storyProvenance(kind, disease)` from `src/utils/storyProvenance.js` with `kind` in `'papers' | 'deaths' | 'ratio' | 'none'`.

Background: a cold click puts four text surfaces on screen (persistent tooltip, sidebar, Scale card, label) repeating the same figures; during a story chip it is five, and the tooltip covers the sidebar's Deaths value on a 1280 px laptop. The red team's surviving form: retire the selected-node tooltip on desktop only (mobile keeps it, it is the phone's only readout), let stories own the frame gated on `storyActive`, leave the Scale card floating (the owner chose that on 2026-08-28).

- [ ] **Step 1: Retire the persistent tooltip on desktop**

In `src/components/ui/Tooltip.jsx` change the persistent branch condition (line 94) to `if (selectedNode && isMob()) {` and import `isMob` from `../../utils/helpers`. Add above it:

```js
  // Task 3 (2026-09-10 plan): on desktop the sidebar and the compare card
  // already say everything this box repeated an inch away (and it covered the
  // sidebar's Deaths value on a 1280 px laptop). The phone keeps it: there the
  // sidebar does not render, so this is the tap's only readout.
```

The rAF tracker effect (lines 49-83) can stay as is; it only runs while a node is selected and is cheap. Optional cleanup: guard it with `if (!selectedNode || !isMob())` so desktop skips the per-frame `setAnchorPos`.

- [ ] **Step 2: Write the failing provenance test**

Create `tests/storyProvenance.test.js`:

```js
import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { storyProvenance } from '../src/utils/storyProvenance';
import { isNoGlobalEstimate } from '../src/utils/mortalityLabel';

const byId = Object.fromEntries(diseases.map((d) => [d.id, d]));

describe('storyProvenance (the story caption micro-line)', () => {
  it('names PubMed for a papers figure', () => {
    expect(storyProvenance('papers', byId['breast-cancer'])).toBe('PubMed, refreshed weekly');
  });
  it('names the mortality source and year for a deaths figure', () => {
    const s = storyProvenance('deaths', byId['sepsis']);
    expect(s).toMatch(/GBD/);
    expect(s).toMatch(/\d{4}/);
  });
  it('joins both with a middle dot for a ratio', () => {
    const s = storyProvenance('ratio', byId['malaria']);
    expect(s.startsWith('PubMed, refreshed weekly · ')).toBe(true);
    expect(s).toMatch(/WMR|WHO|GBD|GHE/);
  });
  it('never invents a mortality source for a no-estimate row', () => {
    const noEst = diseases.find((d) => isNoGlobalEstimate(d.mortalitySource));
    expect(noEst).toBeTruthy();
    expect(storyProvenance('deaths', noEst)).toBe('');
    expect(storyProvenance('ratio', noEst)).toBe('PubMed, refreshed weekly');
  });
  it('is empty for a moral line', () => {
    expect(storyProvenance('none', byId['sepsis'])).toBe('');
  });
  it('carries no em dash for any disease and kind', () => {
    for (const d of diseases) for (const k of ['papers', 'deaths', 'ratio'])
      expect(storyProvenance(k, d)).not.toContain('—');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/storyProvenance.test.js`
Expected: FAIL, module not found.

- [ ] **Step 4: Write the helper**

Create `src/utils/storyProvenance.js`:

```js
import { mortalitySourceLabel, isNoGlobalEstimate } from './mortalityLabel';

export const PUBMED_LINE = 'PubMed, refreshed weekly';

// The 9 px provenance micro-line under a story caption (Task 3, 2026-09-10
// plan): once a story owns the frame the sidebar is gone, so the caption has
// to carry its own sourcing. `kind` says which figure the caption prints.
//   'papers'  a PubMed count
//   'deaths'  a mortality figure: the row's own short source label
//   'ratio'   papers per death: both, joined with a middle dot
//   'none'    a moral line with no figure
// A row whose source says no global estimate exists never gets a mortality
// source line, the same rule the compare card and the sidebar follow.
export function storyProvenance(kind, d) {
  if (!d || kind === 'none') return '';
  const deaths = isNoGlobalEstimate(d.mortalitySource)
    ? ''
    : (mortalitySourceLabel(d.mortalitySource, d.mortalityYear) || '');
  if (kind === 'papers') return PUBMED_LINE;
  if (kind === 'deaths') return deaths;
  if (kind === 'ratio') return deaths ? `${PUBMED_LINE} · ${deaths}` : PUBMED_LINE;
  return '';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/storyProvenance.test.js`
Expected: 6 passed. If the sepsis `deaths` case fails because its short label does not contain `GBD`, read `mortalitySourceLabel` output for sepsis and adjust the regex to the label it actually produces (the row's source is "Rudd et al", labelled `GBD 2017, sepsis-associated`).

- [ ] **Step 6: Carry provenance through the store and StoryEngine**

In `src/store.js` add `storyProvenance: '',` next to `storyCaption: '',` and `setStoryProvenance: (v) => set({ storyProvenance: v }),` next to `setStoryCaption`. Everywhere the store clears `storyCaption: ''` (lines ~241, ~305, ~337 and any other `storyCaption: ''` write), also write `storyProvenance: ''`.

In `src/components/StoryEngine.jsx`, tag every step with its kind. Add `kind` to each object in `buildSequences`: `'papers'` for the researched steps, `'deaths'` for killers and forgotten, `'deaths'` for the silent steps (their headline figure is deaths), `'ratio'` for richpoor and for the two mismatch steps, and `kind: 'none'` on every closing caption. Then in `showStep`, after `setStoryCaption(s.caption || '')`:

```js
  const dz = s.id !== undefined ? useStore.getState().diseases[s.id] : null;
  useStore.getState().setStoryProvenance(storyProvenance(s.kind || 'none', dz));
```

with `import { storyProvenance } from '../utils/storyProvenance';`. In the done branch and in the `!chipId` reset, call `setStoryProvenance('')`.

- [ ] **Step 7: Render the micro-line and gate Escape on an active story**

In `src/components/ui/StoryCaption.jsx`:
- read `const storyProvenance = useStore(s => s.storyProvenance);`
- change the Escape effect to:

```js
  useEffect(() => {
    // Task 4 hardening, landed here with Task 3: the listener used to fire on
    // every Escape in the session, flying the camera home and drawing the
    // story chips 1.8 s later, over the Time Machine's rail if it had opened
    // in between. It only means anything while a story is up.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!useStore.getState().storyActive) return;
      endStory();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

- render the provenance between the caption lines and the "click to continue" line:

```jsx
      {storyProvenance && (
        <div style={{ color: '#64748b', fontSize: 9, marginTop: 8, letterSpacing: '0.02em' }}>{storyProvenance}</div>
      )}
```

- [ ] **Step 8: Stand the instrument down while a story runs**

`src/components/ui/Sidebar.jsx`: read `const storyActive = useStore(s => s.storyActive);` and add `if (storyActive) return null;` right after `if (mob) return null;` (desktop only by construction).

`src/components/ui/CompareCards.jsx`: read `storyActive` the same way and extend the early return: `if (isMob() || storyActive || !selectedNode || !pos.visible || blocks.length === 0) return null;`.

`src/components/NodeLabels.jsx`: in Pass 1, after the `if (introScales && introScales[i] < 0.1) continue;` line add:

```js
        // A story owns the frame: only its subject keeps a name (Task 3,
        // 2026-09-10 plan). Seventy other labels under a supernova reveal read
        // as a debugger, not a film.
        if (storeState.storyActive && i !== selIdx) continue;
```

`src/components/ui/Header.jsx`: read `const storyActive = useStore(s => s.storyActive);` and define `const dim = { opacity: storyActive ? 0.3 : 1, transition: \`opacity ${DUR.ui}ms ${EASE.ui}\` };` (import `DUR`, `EASE` from `../../utils/motion`; `TM_EXIT, exitDelay` are already imported from there). Spread `...dim` into the style of: the tagline and counts spans, every mode button rendered from `btnStyle` on desktop (Attention Map, Research Gap, Connections, Trends, Time Machine, Spotlight), the plasma/pulse toggle, and the search container div. Do NOT dim `<SizeToggle />` (the Mismatch story's last line points the viewer at it) or the wordmark. On mobile the menu button gets `...dim` too.

`src/components/ui/FilterBar.jsx`: read `storyActive` and apply the same `dim` object to its root element.

- [ ] **Step 9: Verify headless**

With the server up, run a one-off script (put it under the scratchpad, not the repo) that boots to home the way `tools/verify-dpr.mjs` does, then:
1. `selectDisease(sepsis)`, wait 2 s, assert `document.querySelectorAll('[style*="z-index: 100"]').length === 0` (no persistent tooltip; the hover tooltip only appears on mousemove) and that the sidebar and compare card exist; screenshot `docs/verify/r7-04-select-sepsis.png`.
2. click the "Silent Killers" story chip (button by text), wait 3 s, assert no sidebar, no compare card, exactly one visible `.lbl-name` label (`display !== 'none'`), the caption's provenance line contains `GBD`, and the Papers/Mortality toggle's computed opacity is 1 while a mode button's is 0.3; screenshot `docs/verify/r7-05-story-owns-frame.png`.
3. press Escape twice at home with nothing active, then open the Time Machine via the header button, wait 2.5 s, assert `storyVisible === false` (chips are not drawn over the rail).

Read both PNGs with the Read tool before moving on.

- [ ] **Step 10: Run the suite and commit**

Run: `npx vitest run`
Expected: 344 passed.

```bash
git add src/components/ui/Tooltip.jsx src/utils/storyProvenance.js tests/storyProvenance.test.js src/store.js src/components/StoryEngine.jsx src/components/ui/StoryCaption.jsx src/components/ui/Sidebar.jsx src/components/ui/CompareCards.jsx src/components/NodeLabels.jsx src/components/ui/Header.jsx src/components/ui/FilterBar.jsx docs/verify/r7-04-select-sepsis.png docs/verify/r7-05-story-owns-frame.png
git commit -m "feat: one voice on selection; stories own the frame with their own provenance"
```

---

### Task 4: Escape and keyboard fixes

**Files:**
- Modify: `src/components/ui/Header.jsx` (search inputs ~257-265 mobile, ~385-394 desktop; `handleSearchSelect` ~219), `src/components/ui/SearchDropdown.jsx`, `src/store.js`, `src/components/ui/TimeRail.jsx` (rail container JSX ~605), `src/components/ui/StoryChips.jsx`

**Interfaces:**
- Consumes: `searchQuery`, `setSearchQuery`, `selectDisease`, `idMap` (store), `matchesSearch` (helpers), `snapTo` (TimeRail internal), `storyActive`/`setStoryActive` (store).
- Produces: store field `searchHighlight: number` + `setSearchHighlight(n)`.

Background (confirmed live): the Escape bug is fixed in Task 3 Step 7. Remaining: search plus Enter selects nothing (`SearchDropdown` is click-only); rail arrow keys are ignored while the search input keeps focus after a selection (`TimeRail.jsx:369`); the story chips have no keyboard path.

- [ ] **Step 1: Keyboard search: Enter selects, arrows move a highlight, the input blurs on select**

In `src/store.js` add `searchHighlight: 0,` beside `searchQuery` and `setSearchHighlight: (v) => set({ searchHighlight: v }),` beside `setSearchQuery`; in `setSearchQuery` (find its definition) also reset the highlight: `setSearchQuery: (v) => set({ searchQuery: v, searchHighlight: 0 }),`.

In `src/components/ui/SearchDropdown.jsx` read `const searchHighlight = useStore(s => s.searchHighlight);` and give the highlighted row a background: `background: i === searchHighlight ? 'rgba(255,255,255,0.08)' : 'none'` (use the map index `i`; keep the mouse handlers, and on `onMouseEnter` also call `useStore.getState().setSearchHighlight(i)`). Export the match list builder so the header can reuse it:

```js
export function searchMatches(diseases, searchQuery) {
  if (!searchQuery) return [];
  const q = searchQuery.toLowerCase();
  return diseases.filter(d => matchesSearch(d, q)).slice(0, 8);
}
```

and use it inside the component.

In `src/components/ui/Header.jsx` add a key handler used by both inputs:

```js
  const onSearchKey = (e) => {
    const s = useStore.getState();
    const list = searchMatches(s.diseases, s.searchQuery);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!list.length) return;
      e.preventDefault();
      const n = list.length;
      const cur = s.searchHighlight;
      s.setSearchHighlight(e.key === 'ArrowDown' ? (cur + 1) % n : (cur - 1 + n) % n);
      return;
    }
    if (e.key === 'Enter') {
      if (!list.length) return;
      e.preventDefault();
      const pick = list[Math.min(s.searchHighlight, list.length - 1)];
      handleSearchSelect(pick);
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Escape') {
      s.setSearchQuery('');
      e.currentTarget.blur();
      e.stopPropagation();
    }
  };
```

with `import { searchMatches } from './SearchDropdown';`. Add `onKeyDown={onSearchKey}` to both `<input>` elements. In `handleSearchSelect` keep `setSearchQuery('')` (it now also resets the highlight); the blur is what gives the rail its arrow keys back (`TimeRail.jsx:369` bails while an input has focus). Escape inside the input stops propagation so App.jsx's cascade does not also deselect a node.

- [ ] **Step 2: Wheel over the rail band steps years**

In `src/components/ui/TimeRail.jsx`, on the rail's root container (the `position: 'absolute', bottom: mob ? 52 : 40` div at ~line 605), add a non-passive wheel listener via a ref (React's `onWheel` is passive and cannot `preventDefault`):

```js
  // Task 4 (2026-09-10 plan): a wheel over the band steps one year per tick
  // through the same snap the arrow keys use. Non-passive so the page does
  // not also zoom the galaxy under it; scoped to the band itself, so a wheel
  // anywhere else is still OrbitControls' zoom.
  const railRootRef = useRef(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    const el = railRootRef.current;
    if (!el || tmPhase === 'idle') return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const s = useStore.getState();
      if (s.tmPhase !== 'scrub') return;
      const t = sceneRefs.tm;
      if (!t) return;
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < 40) return;
      const dir = wheelAcc.current > 0 ? 1 : -1;
      wheelAcc.current = 0;
      clearFinale();
      const top = t.data.nYears - 1;
      snapTo(Math.max(0, Math.min(top, Math.round(t.targetYear) + dir)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tmPhase, clearFinale, snapTo]);
```

and `ref={railRootRef}` on that div. If the root div is conditionally rendered only while the rail is up, the effect's `tmPhase` dependency re-attaches it correctly. A wheel during the tour is still "any input" for the window-level handover (TimeMachine.jsx), which converts the tour to scrub; that is the existing, intended behavior.

- [ ] **Step 3: Keys 1 to 7 fire the story chips**

In `src/components/ui/StoryChips.jsx` find the array that defines the seven chips in order (ids `researched`, `killers`, `forgotten`, `silent`, `richpoor`, `mismatch`, `roulette`; read the file for the exact list and the click handler each chip calls). Add:

```js
  // Task 4 (2026-09-10 plan): the seven chapters on the number row, when the
  // chips are up and nothing else owns the keyboard.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const tag = t && t.tagName;
      if (t && (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable)) return;
      const n = Number(e.key);
      if (!(n >= 1 && n <= CHIPS.length)) return;
      const s = useStore.getState();
      if (!s.storyVisible || !s.uiRevealed || s.overtureActive || s.tmPhase !== 'idle' ||
          s.activeMode || s.methodologyOpen || s.roulettePhase !== 'idle' || s.storyActive) return;
      e.preventDefault();
      fireChip(CHIPS[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

where `CHIPS` is the ordered chip list and `fireChip(chip)` is whatever the existing `onClick` does for that chip (extract it into a function if it is inline). Add a `title` attribute to each chip button: `title={\`Press ${i + 1}\`}` so the shortcut is discoverable on hover.

- [ ] **Step 4: Verify headless**

One-off scratchpad script, server up, boot to home:
1. `page.type` into the desktop search input `"cerv"`, press `ArrowDown`, `ArrowUp`, then `Enter`; assert `selectedNode.disease.id === 'cervical-cancer'`, `searchQuery === ''`, and `document.activeElement.tagName !== 'INPUT'`.
2. open the Time Machine via the header, wait 2 s, press `ArrowRight` twice, assert `window.__tm.targetYear` advanced by 2.
3. dispatch two `wheel` events with `deltaY: 60` on the rail root element, assert `targetYear` advanced by 2 more.
4. close the Time Machine, press `4`, wait 1 s, assert `storyActive === 'silent'`; press Escape, wait 2.5 s, assert `storyActive === null` and `storyVisible === true`.
Zero console errors throughout.

- [ ] **Step 5: Run the suite and commit**

Run: `npx vitest run`
Expected: 344 passed.

```bash
git add src/store.js src/components/ui/SearchDropdown.jsx src/components/ui/Header.jsx src/components/ui/TimeRail.jsx src/components/ui/StoryChips.jsx
git commit -m "feat: keyboard search, wheel over the rail, number keys for the story chips"
```

---

### Task 5: Rigor and copy pass

**Files:**
- Modify: `src/utils/captions.js`, `tests/captions.test.js`, `src/components/Spotlight.jsx`, `src/components/GalaxyRoulette.jsx` (buildCaption ~46-56), `src/components/StoryEngine.jsx` (ppdStr ~6-9), `src/components/ui/Sidebar.jsx` (~104-105, ~159-161, connections list ~186-200), `src/components/ui/ExplodeOverlay.jsx` (~49-55 and the second column's label), `src/components/ui/ConnectionsOverlay.jsx` (94, 99), `src/components/ui/VelocityOverlay.jsx` (54), `src/components/ui/Legend.jsx`, `src/components/ui/MethodologyPanel.jsx` (~253 and the funding gap sentence), `src/utils/mortalityLabel.js`, `tests/mortalityLabel.test.js`, `src/utils/helpers.js` (processData line 42), `tests/normalization.test.js`, `src/components/ui/CompareCards.jsx` (block 3), `src/components/TimeMachine.jsx` (buildTourCaptions hivFade line ~570, flatline micro ~616), `tests/timeMachineTour.test.js`, `data/*.json` (via the refresh script), `docs/verify/scorecard.md`

**Interfaces:**
- Produces: `ratioStr(val)` from `src/utils/captions.js`; `edge.termOverlap: boolean` on every processed edge; `mortalitySourceLabel` returns `'registries, not a global estimate'` for registry-only rows.

Every item below is something a Harvard reader finds within two clicks. Do them in order; each has its own check.

- [ ] **Step 1: One rounding rule for papers per death (failing test first)**

Append to `tests/captions.test.js`:

```js
import { ratioStr } from '../src/utils/captions';

describe('ratioStr (one rounding rule for every surface)', () => {
  it('shows whole numbers from 10 up', () => { expect(ratioStr(417.4)).toBe('417'); });
  it('shows one decimal between 1 and 10', () => { expect(ratioStr(6.63)).toBe('6.6'); expect(ratioStr(8.31)).toBe('8.3'); });
  it('shows two decimals between 0.01 and 1', () => { expect(ratioStr(0.421)).toBe('0.42'); });
  it('shows three decimals below 0.01', () => { expect(ratioStr(0.0042)).toBe('0.004'); });
  it('is N/A for null', () => { expect(ratioStr(null)).toBe('N/A'); });
});
```

Run: `npx vitest run tests/captions.test.js` and see the new block fail. Then add to `src/utils/captions.js`:

```js
// One rounding rule for papers per death and deaths per paper, everywhere a
// ratio is printed (sidebar, spotlight, roulette, stories). Spotlight used to
// say "7 papers per death" for a row the sidebar printed as 6.6.
export function ratioStr(val) {
  if (val == null || !Number.isFinite(val)) return 'N/A';
  if (val >= 10) return String(Math.round(val));
  if (val >= 1) return val.toFixed(1);
  if (val >= 0.01) return val.toFixed(2);
  return val.toFixed(3);
}
```

Replace the local `ratioStr` in `Spotlight.jsx`, the local `ppdStr` in `StoryEngine.jsx`, the inline `val` expression in `GalaxyRoulette.jsx` `buildCaption`, and the `ppdStr` expression in `Sidebar.jsx` (line 105) with imports of this one. Run the captions test again: PASS.

- [ ] **Step 2: Cut the unsourced factoids from Spotlight**

In `src/components/Spotlight.jsx` `buildSpotlightList`, replace the four unsourced clauses with derived stats (every other clause in the list is a value judgment or a derived number; the four below are claims of fact with no source in the data):
- stroke: `Every 3 seconds someone has one` becomes `${ratioStr(deathsPerPaper(d('stroke')))} deaths per paper`
- dengue: `Half the world at risk` becomes `${fmtFull(d('dengue').papers)} papers`
- obesity: `Affects 1 billion people worldwide` becomes `no global deaths figure; deaths are counted under the diseases it causes`
- malaria: `94% of deaths in Africa` becomes `${ratioStr(ppd(d('malaria')))} papers per death`

Also change `Fear drives funding` (ebola) to `${fmtFull(d('ebola').papers)} papers`, since it asserts a cause the data cannot show. Import `ratioStr` from captions. Grep the file for any remaining digit that is not inside a template expression; there should be none except the `#1` in `#1 killer globally` (derivable: keep only if heart disease is in fact the max `mortality` in the file; add `.filter` logic or drop the clause; the honest option is to compute `const topKiller = diseases.reduce((a, b) => (b.mortality > a.mortality ? b : a))` and use the clause only when `topKiller.id === 'heart-disease'`).

- [ ] **Step 3: Neutral overlay labels and no em dashes**

`src/components/ui/ExplodeOverlay.jsx`: change `Most Over-Researched` to `Most papers per death` and the mirrored column label (read the file; it is the second `textTransform: 'uppercase'` label) to `Fewest papers per death`; change the subtitle to `Papers published per reported death, showing where research attention and disease burden diverge`.
`src/components/ui/ConnectionsOverlay.jsx`: subtitle to `Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap`; `Most connected — tap to explore` to `Most connected. Tap to explore`.
`src/components/ui/VelocityOverlay.jsx`: `Publication growth rate over the last decade — which diseases are surging and which are fading` to `Publication growth rate over the last decade: which diseases are surging and which are fading`.
Then run `grep -rn "—" src/components/ui/*.jsx src/components/*.jsx | grep -v "^\S*:[0-9]*:\s*//" ` and confirm no JSX string carries one (comments are allowed to keep the existing ones; do not add new ones).

- [ ] **Step 4: A desktop route back into the Methodology panel**

In `src/components/ui/Legend.jsx`, read `const setMethodologyOpen = useStore(s => s.setMethodologyOpen);` and, on desktop only, add before the trailing credit span:

```jsx
      {!mob && (
        <span
          onClick={() => setMethodologyOpen(true)}
          style={{ pointerEvents: 'auto', cursor: 'pointer', color: '#94a3b8', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >Methodology</span>
      )}
```

The legend root has `pointerEvents: 'none'`; the span re-enables it for itself. Keep the credit line as it is.

- [ ] **Step 5: The Funding Gap tile names no source: remove it**

In `src/components/ui/Sidebar.jsx` delete the `<SB l="Funding Gap" ... />` line (160) and the `gc` map if it is now unused. The `fundingGap` field stays in the data (the methodology panel describes it as authored); in `src/components/ui/MethodologyPanel.jsx` find the sentence that lists `funding gap` among the fields the refresh never touches and change it to say that the authored funding-gap label is kept in the data file but no longer displayed, because it names no source. Grep `fundingGap` across `src/` for any other display (Tooltip does not show it; if the Attention Map or an overlay does, apply the same removal there and say so in the commit).

- [ ] **Step 6: Registry-only rows (failing test first)**

Find cystic fibrosis's `mortalitySource` in `data/diseases.json`. Append to `tests/mortalityLabel.test.js`:

```js
describe('registry-only rows (Task 5, 2026-09-10 plan)', () => {
  it('labels a registry-only figure as such and still prints it', () => {
    const cf = diseases.find((d) => d.id === 'cystic-fibrosis');
    expect(mortalitySourceLabel(cf.mortalitySource, cf.mortalityYear)).toBe('registries, not a global estimate');
    expect(isNoGlobalEstimate(cf.mortalitySource)).toBe(false);
    expect(deathsStatLabel(cf.mortality, cf.mortalitySource, cf.mortalityYear)).toBe('Deaths/yr · registries, not a global estimate');
  });
});
```

(check the file's existing imports; `diseases` and the three functions are already imported there). Run it: FAIL. Then in `src/utils/mortalityLabel.js` add, at the top of `RULES` (before the named-source rules, since the CF string may also mention a named body):

```js
  // A figure assembled from national patient registries (cystic fibrosis):
  // a real count, not a global estimate, and the tile says exactly that.
  [/registr(y|ies)/i, 'registries, not a global estimate', ''],
```

Since the rule's `short` must not carry a year, special-case it in `classify`: when the matched prefix is the registries string, return `{ named: true, short: prefix }` without the year. Run the whole mortalityLabel test file and the dataInvariants file: PASS. If any OTHER disease's source matches `/registr/i`, list them in the commit message and confirm each is in fact registry-based; if one is a named global estimate that merely mentions a registry, move the rule below the named rules instead and re-run.

Then in `src/components/ui/Sidebar.jsx` the deaths tile already prints `fmt(mortality)` for these rows under the new label, which is now honest.

- [ ] **Step 7: Term-overlap connections (failing test first)**

Append to `tests/normalization.test.js` (it already imports `processData` or the data; read the file's header and reuse its fixtures):

```js
describe('term-overlap edges (Task 5, 2026-09-10 plan)', () => {
  it('flags a pair whose one label contains the other', () => {
    const { edges, diseases: ds } = processData(diseases, connections);
    const e = edges.find((x) => (x.source === 'heart-disease' && x.target === 'rheumatic-heart-disease') || (x.source === 'rheumatic-heart-disease' && x.target === 'heart-disease'));
    expect(e).toBeTruthy();
    expect(e.termOverlap).toBe(true);
    const clean = edges.find((x) => x.source === 'malaria' || x.target === 'malaria');
    expect(clean.termOverlap).toBe(false);
  });
});
```

Run: FAIL (`termOverlap` undefined). Then in `src/utils/helpers.js` `processData`, extend the edge map:

```js
  const edges=connections.map(c=>{const si=idMap[c.source],ti=idMap[c.target];
    const a=diseases[si].label.toLowerCase(),b=diseases[ti].label.toLowerCase();
    // One search term contains the other ("Heart Disease" inside "Rheumatic
    // Heart Disease"): PubMed's AND count is then the smaller term's whole
    // count, a substring artifact, not a measured link. Kept in the data and
    // in the sidebar list (it is the true result of the stated query) but
    // never ranked as a strongest link.
    const termOverlap=a!==b&&(a.includes(b)||b.includes(a));
    return{...c,si,ti,termOverlap,score:c.sharedPapers/Math.sqrt(diseases[si].papers*diseases[ti].papers)};});
```

Run the test: PASS. Then:
- `src/components/ui/CompareCards.jsx` block 3: add `.filter(e => !e.termOverlap)` before the `.map` over `displayEdges`.
- `src/components/ui/Sidebar.jsx` connections list: after the count span, render `{cn.termOverlap && <span style={{ color: '#64748b', fontSize: 9 }}>term overlap</span>}` (carry `termOverlap: e.termOverlap` through the `conns` map at ~line 107).
- `src/components/ui/MethodologyPanel.jsx` connections section (the paragraph at ~line 241 about pair scores): append one sentence: `Where one disease's search term contains the other's (Heart Disease inside Rheumatic Heart Disease), the pair count is the smaller term's whole count rather than a measured overlap; those pairs are marked "term overlap" in the sidebar and are never ranked as a strongest link.`

- [ ] **Step 8: Two tour caption fixes (failing tests first)**

In `tests/timeMachineTour.test.js` `describe('buildTourCaptions')` add:

```js
  it('states the HIV fade as the series supports it: a peak, then a decline', () => {
    expect(caps.hivFade.lines[0]).toBe('Attention peaked in 2014 and has fallen since.');
  });
  it('gives the finale micro-line its year range beside the summed series', () => {
    expect(caps.flatline.micro).toContain('across 1990 to 2024');
  });
```

Run: FAIL. Then in `src/components/TimeMachine.jsx` `buildTourCaptions`:
- `caps.hivFade.lines` becomes `[\`Attention peaked in ${pk.year} and has fallen since.\`]` (derived from the same `pk` the data line uses; the old line implied the epidemic had not faded, which the file cannot show and which a biologist would dispute).
- the finale `flat.micro` becomes `${covid.label} drew more papers in 2020 than ${midSentence(rhd.label)} drew across ${first} to ${last} combined (${fmtFull(valueAt(covid, 2020))} versus ${fmtFull(total)}).` (`first`/`last` are already defined at the top of the function).
Run the tour test file: PASS. Check `allStrings` copy rules in that file still pass (no em dash, sentence case).

- [ ] **Step 9: Refresh the data so the freshness stamp is true**

The footer prints `refreshed weekly (latest: 2026-08-10)`; the cron runs on `main`, not on this branch, so the stamp is a month stale. Run the weekly job here (it now includes the connections reconciliation):

Run: `python3 scripts/refresh_pubmed.py` (about 20 minutes; 153 diseases x 11 queries at the script's rate limit). It writes `data/diseases.json`, `data/meta.json` and, if any pair needed it, `data/connections.json`.
Expected: `Done. Updated: 153, Failed: 0` and either `Connections already consistent with the refreshed totals.` or a short re-query log ending with no `WARNING`. If any disease fails, re-run the script (it is safe to repeat) before continuing; do not hand-edit a count.

Then run `npx vitest run`: everything must pass (mortality is untouched by the refresh; the audit manifest tests read mortality only). Read `git diff --stat data/` and confirm only `papers`, `yearlyPapers`, `trend`, `pubmedLastRefresh` and possibly `sharedPapers` moved. If the suite's `covid-19 pre-2019 paper counts are noise-level` or `hiv-aids shows the 1990s surge` tests fail, the refresh changed a windowed count; read the failing assertion, confirm the new value is the live PubMed answer (re-run `pubmed_count` for that one term in a python one-liner), and adjust the test's threshold with a comment, never the data.

- [ ] **Step 10: Run the suite and commit**

Run: `npx vitest run`
Expected: 351 passed (344 + 5 ratioStr + 1 registry + 1 termOverlap + 2 tour... count what the run prints and record it).

```bash
git add src/utils/captions.js tests/captions.test.js src/components/Spotlight.jsx src/components/GalaxyRoulette.jsx src/components/StoryEngine.jsx src/components/ui/Sidebar.jsx src/components/ui/ExplodeOverlay.jsx src/components/ui/ConnectionsOverlay.jsx src/components/ui/VelocityOverlay.jsx src/components/ui/Legend.jsx src/components/ui/MethodologyPanel.jsx src/utils/mortalityLabel.js tests/mortalityLabel.test.js src/utils/helpers.js tests/normalization.test.js src/components/ui/CompareCards.jsx src/components/TimeMachine.jsx tests/timeMachineTour.test.js data/diseases.json data/meta.json data/connections.json scripts/.connections_progress.json
git commit -m "fix: rigor pass; one ratio rule, sourced spotlight, registry rows, term-overlap links, fresh PubMed snapshot"
```

(`scripts/.connections_progress.json` is gitignored; the `git add` of it is a no-op and can be dropped.)

---

### Task 6: The tour's spine, said once on the 2021 peak card

**Files:**
- Modify: `src/components/TimeMachine.jsx` (buildTourCaptions, `caps.peak` ~597), `tests/timeMachineTour.test.js`

**Interfaces:**
- Consumes: `peakOf(disease)` and `valueAt(disease, year)` (already defined in TimeMachine.jsx), `fmtFull`.

The red team kept exactly this from the "restage the spine" idea: the six-pause board, the clock, every seat and every certified frame stay. One derived line on the peak card says what the adjacency only implied.

- [ ] **Step 1: Write the failing test**

In `tests/timeMachineTour.test.js` `describe('buildTourCaptions')` add:

```js
  it('says the spine once on the peak card, in the file own numbers', () => {
    const pk = Math.max(...hiv.yearlyPapers);
    const pkYear = hiv.yearStart + hiv.yearlyPapers.indexOf(pk);
    const years = pkYear - hiv.yearStart;
    const passYear = covid.yearStart + covid.yearlyPapers.findIndex((v) => v > pk);
    expect(years).toBe(24);
    expect(passYear).toBe(2020);
    expect(caps.peak.lines[1]).toBe(`HIV/AIDS took ${years} years to reach ${pk.toLocaleString('en-US')} papers a year. COVID-19 passed that in ${passYear}.`);
  });
  it('drops the spine line when no year of covid exceeds the HIV peak', () => {
    const noCovid = diseases.map((d) => d.id === 'covid-19' ? { ...d, yearlyPapers: d.yearlyPapers.map(() => 1) } : d);
    const c2 = buildTourCaptions(noCovid, idMap, buildTimeMachineData(noCovid));
    expect(c2.peak.lines).toHaveLength(1);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/timeMachineTour.test.js`
Expected: FAIL, `caps.peak.lines[1]` undefined.

- [ ] **Step 3: Derive the line**

In `src/components/TimeMachine.jsx` `buildTourCaptions`, inside `if (covid)`, replace the `caps.peak` assignment with:

```js
    caps.peak = {
      lines: ['Attention can move this fast.'],
      data: `${fmtFull(pk.value)} ${covid.label} papers in ${pk.year} alone.`,
    };
    // The spine, said once (Task 6, 2026-09-10 plan): the two HIV pauses and
    // the detonation only imply it by adjacency. Every numeral is scanned
    // from the file: the years HIV took to reach its own best year, and the
    // first year COVID-19 exceeded that value. Omitted if no such year exists.
    if (hiv) {
      const hp = peakOf(hiv);
      const years = hp.year - first;
      const series = Array.isArray(covid.yearlyPapers) ? covid.yearlyPapers : [];
      const idx = series.findIndex((v) => Number.isFinite(v) && v > hp.value);
      if (years > 0 && idx >= 0) {
        const passYear = (covid.yearStart ?? first) + idx;
        caps.peak.lines.push(
          `${hiv.label} took ${years} years to reach ${fmtFull(hp.value)} papers a year. ${covid.label} passed that in ${passYear}.`
        );
      }
    }
```

Check `peakOf` returns `{ value, year }` (it is used that way at ~line 566). The `TimeCaption` in `TimeRail.jsx` already renders `lines[1]` at its second-line size and wraps on mobile.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/timeMachineTour.test.js`
Expected: PASS, including the existing `allStrings` copy-rule cases (sentence case, no em dash) which now cover the new line.

- [ ] **Step 5: Look at the frame**

With the server up: `node tools/verify.mjs --eval "window.__tour.seek(4)" --shot r7-06-peak-spine` and `node tools/verify.mjs --mobile --eval "window.__tour.seek(4)" --shot r7-m-06-peak-spine` (pause index 4 is the peak; confirm against the pause order in `buildTourPauses`: rules, hivSurge, hivFade, detonation, peak, finale). If the seek needs the landing dismissed and the film finished, use the same prelude as Task 2 Step 13. Read both PNGs: the second line sits under the headline at the caption's second-line size, does not collide with the rail or the sparkline, and wraps to at most two lines on the phone.

- [ ] **Step 6: Commit**

```bash
git add src/components/TimeMachine.jsx tests/timeMachineTour.test.js docs/verify/r7-06-peak-spine.png docs/verify/r7-m-06-peak-spine.png
git commit -m "feat: the tour says its spine once, on the 2021 peak card"
```

---

### Task 7: Integration: fuzz, natural-run recut, scorecard addendum, preview redeploy

**Files:**
- Modify: `docs/verify/scorecard.md`
- Create: `docs/verify/r7-*.png` (natural-run set, desktop + mobile)

- [ ] **Step 1: Full suite and the structural fuzz**

Run: `npx vitest run` (expected: all green; record the count).
Run: `node tools/verify-fuzz.mjs --points 20` and `node tools/verify-fuzz.mjs --mobile --points 12` (server up).
Expected: every point reports the structural invariant and the narrative pair as before (read the script's own PASS/FAIL summary). A failure here is a regression from Tasks 1-6; fix it in the task's files with a follow-up commit, never by loosening the harness.

- [ ] **Step 2: DPR/DOF re-check after everything landed**

Run: `node tools/verify-dpr.mjs`
Expected: PASS (switch count still at most 2 with the stage and stars in).

- [ ] **Step 3: Natural-run recut**

Write a one-off scratchpad runner (same boot as `tools/verify-dpr.mjs`, but no skips) that saves frames at these moments on desktop (1440x900, deviceScaleFactor 1) and mobile (375x812): landing; assembly 1.6 s and 5.0 s (`window.__assembly.seek`); film attention, ignite, release (`window.__overture.seek(2.5 / 9.6 / 13.5)`, the same marks the r5c set used); home handover; tour rewind, HIV surge, detonation flash, 2020 hold, peak, flatline (`window.__tour.seek(0 / 1 / 3 / 3.4 / 4 / 5.4)`); home rest 5 s after the exit. Save as `docs/verify/r7-N-<name>.png` and `docs/verify/r7-m-N-<name>.png`. Read every frame. What to look for: the stage color is present everywhere, stars read at rest and during the tour, nothing but the ignite blooms, the peak card carries its second line, the finale frame is unchanged except for the ground, no label appears during a story frame (take one extra story frame: click "Silent Killers" at home, wait 3 s).

- [ ] **Step 4: Scorecard addendum**

Append to `docs/verify/scorecard.md` a section `## Post-certification changes (2026-09-10, hygiene and quick wins)` listing, one line each with the commit SHA: the DPR/DOF unblock with the Retina FPS rows, the stage color script and star field with the luminance re-baseline, one voice on selection and stories owning the frame, the keyboard fixes, the rigor pass items (ratio rule, spotlight sourcing, registry rows, term-overlap links, funding gap tile, methodology link, fresh snapshot date), and the peak card spine line. State plainly that the 9.26 certification is not re-scored by this work and that the r7 frame set is the new reference library.

- [ ] **Step 5: Commit and redeploy the snapshot preview**

```bash
git add docs/verify/scorecard.md docs/verify/r7-*.png
git commit -m "docs: post-certification addendum and r7 reference frames"
npx vercel --prod --yes --scope ryoungjkts-projects
```

Then `curl -s -o /dev/null -w "%{http_code}" https://medgalaxy-next.vercel.app` must print 200. Never merge to `main`.

---

## Self-review notes

- Spec coverage: Task 1 = "Unblock DPR 1.5 and the selection depth of field (fix the breathing collision, add a Retina row to the perf gates)". Task 2 = "Stage color script + legible star field" (plus the post chain's own dithering, one line). Task 3 = "one voice on selection (retire the duplicate tooltip on desktop, stories own the frame)" and the Escape bug fix the red team folded into it. Task 4 = "the Escape and keyboard fixes". Task 5 = "rigor and copy pass" (every item from the review's rigor list that survived: ratio rule, spotlight factoids, overlay labels and em dashes, methodology route, funding gap source, registry rows, term-overlap links, hivFade line, finale range, fresh stamp). Task 6 = the spine line. Task 7 = the verification the red team required of every rendering change.
- Deliberately excluded (not chosen by the owner, or contested): the one-ink label discipline, the sepsis micro-label flip, the Scale card moving into the sidebar, the category-chip isolate-vs-exclude behavior, a "?" key card, Space to replay the film (`overtureDone` latches the film once per session by design).
- Type consistency: `sceneRefs.cameraOwner` (string), `sceneRefs.fx.ground` (hex number, consumed via `setHex`/`setClearColor`), `storyProvenance(kind, d)` (string), `ratioStr(val)` (string), `edge.termOverlap` (boolean) are the only cross-task names, and each is defined before it is consumed.
