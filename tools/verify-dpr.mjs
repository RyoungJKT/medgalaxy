// tools/verify-dpr.mjs
// Task 1 of the 2026-09-10 plan. Proves the two fidelity features the
// addendum's camera breathing had silently disabled are back:
//   1. at home rest on a 2x display the drawing buffer is 2160x1350 (DPR 1.5)
//   2. a plain click (no prior drag) racks the depth of field to bokeh > 2.5
//      within 1 s
//   3. the buffer switches DPR at most twice across the whole opening + tour
//   4. a real drag reads cameraOwner 'user' throughout, including the
//      drag.quiet<30 tail right after onEnd, AND releases back to 'ambient'
//      once the tail clears (fix round, 2026-09-10 review: the prior version
//      of this check read cameraOwner immediately after mouse.up() with no
//      wait, so it passed identically whether onEnd fired or not; a broken
//      onEnd leaves drag.active stuck true forever, which only the release
//      check below can catch). This block is timing-sensitive: it samples a
//      real gesture, it retries once before failing, and every failure prints
//      the owner sub-terms rather than naming one suspect.
//   5. after a selection is cleared, the DPR buffer is back at rest within a
//      short, bounded time (fix round: pins that the settle window stays
//      short on this path, not the 2 s flat value the first pass shipped)
//   6. a manual Time Machine session opened AFTER the tour has exited reads
//      cameraOwner 'ambient' at the governed rest DPR, and hands the camera
//      back on close (final fix wave: the ownership line used to key on the
//      store's one-shot exit timestamp, which nothing resets)
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

// A real drag: the user-ownership path (onStart/onEnd, drag.quiet<30) that
// no plain click reaches, fix round review finding.
//
// Diagnosability round (whole-branch review, 2026-09-11): this block went red
// once in four runs, reading 'tween' 1.15 s after mouse-up, and printed
// "onEnd may not be clearing drag.active", which is precisely the branch that
// reading rules out. The owner is computed in one line of CameraRig.jsx
// (the block at ~:255): 'user' means drag.active or the quiet<30 tail, so a
// stuck 'user' is an onEnd fault, while 'tween' means the drag DID release and
// either gsap.isTweening(camera.position) or one of the cinematic flags owned
// that frame. Those are different findings and now read differently. The block
// also runs twice before it fails, because a one-in-four flake on a
// timing-sensitive gesture is not a camera regression.
const ownerState = () => page.evaluate(() => {
  const s = window._store.getState();
  const r = window.__scene;
  return {
    owner: r.cameraOwner,
    tmPhase: s.tmPhase,
    tmExitLive: !!r.tmExitLive,
    tmActive: !!(r.tm && r.tm.active),
    overtureActive: s.overtureActive,
    introPhase: s.introPhase,
    handoverSpeed: r.handover ? r.handover.speed : null,
    handoverCancelled: r.handover ? r.handover.cancelled : null,
    selected: s.selectedNode ? s.selectedNode.disease.id : null,
    flyTarget: s.flyTarget ? s.flyTarget.position : null,
  };
});

// Every cinematic sub-term the owner line ORs together, named. gsap's own
// tween state is not reachable from the page, so it is reported by
// elimination: 'tween' with no cinematic flag set is a camera tween, which on
// this path means a fly-to, which means the drag landed as a click on a node.
const why = (d) => {
  const cine = [];
  if (d.overtureActive) cine.push('overtureActive');
  if (d.introPhase < 5) cine.push(`introPhase ${d.introPhase}`);
  if (d.tmPhase === 'tour') cine.push('tmPhase tour');
  if (d.tmExitLive) cine.push('Time Machine exit choreography live (sceneRefs.tmExitLive)');
  if (d.handoverSpeed != null && !d.handoverCancelled) cine.push(`handover speed ${d.handoverSpeed}`);
  const head = cine.length
    ? `cinematic: ${cine.join(', ')}`
    : 'no cinematic flag set, so it was a gsap tween on camera.position (a fly-to)';
  return `${head}; selected=${d.selected} flyTarget=${JSON.stringify(d.flyTarget)}`;
};

const RELEASE_MS = 1500; // budget: passing runs release at about 500 ms

async function dragBlock() {
  const problems = [];
  // A previous attempt's click-through would otherwise seed the next one with
  // a live fly-to. No-op on the normal path (nothing is selected here).
  const pre = await ownerState();
  if (pre.selected) {
    await page.evaluate(() => window._store.getState().deselect());
    await wait(1500);
  }
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(780, 480, { steps: 8 });
  await wait(50); // let at least one frame pick up drag.active before reading it
  const during = await ownerState();
  await page.mouse.up();
  await wait(100); // comfortably under 30 frames: samples the quiet<30 tail, not the pre-mouseup frame
  const afterEnd = await ownerState();
  console.log(`drag ownership: during=${during.owner} right-after-onEnd=${afterEnd.owner}`);
  if (during.owner !== 'user') {
    problems.push(`cameraOwner during a drag was '${during.owner}', not 'user' (${why(during)})`);
  }
  // What this one pins is the damping tail, not the release: onEnd must reset
  // drag.quiet to 0 rather than skip straight past it.
  if (afterEnd.owner !== 'user') {
    problems.push(
      `cameraOwner right after onEnd was '${afterEnd.owner}', not 'user' `
      + `(onEnd must reset drag.quiet to 0, not skip the damping tail) (${why(afterEnd)})`
    );
  }
  // The assertion that actually exercises onEnd: with onEnd wired, drag.active
  // drops on mouse.up() and quiet counts past 30, so ownership releases to
  // 'ambient'. If onEnd were missing or broken, drag.active would stay true
  // forever and this would read 'user' until the timeout (2026-09-10 review,
  // Important finding). Sampled rather than read once, so a late release reads
  // as late and a stuck one reads as stuck.
  const t = Date.now();
  const timeline = [];
  let settle = afterEnd;
  let firstTween = null;
  while (Date.now() - t < 2500) {
    settle = await ownerState();
    timeline.push(`${Date.now() - t}ms:${settle.owner}`);
    if (!firstTween && settle.owner === 'tween') firstTween = settle;
    if (settle.owner === 'ambient') break;
    await wait(100);
  }
  const releaseMs = Date.now() - t;
  console.log(`drag ownership after settle: ${settle.owner} at ${releaseMs} ms (${timeline.join(' ')})`);
  // A run can pass and still have gone through 'tween' on the way to rest,
  // which is the shape of the intermittent red this block was rewritten for.
  // Print the sub-terms then too, not only on a failure, so the next reader of
  // a slow-but-green run knows what held the camera.
  if (firstTween) console.log(`  tween held the camera before rest: ${why(firstTween)}`);
  if (settle.owner === 'user') {
    problems.push(
      `cameraOwner was still 'user' 2.5 s after mouse-up: drag.active never cleared, `
      + `so onEnd is not firing (timeline ${timeline.join(' ')})`
    );
  } else if (settle.owner !== 'ambient') {
    problems.push(
      `cameraOwner was '${settle.owner}' 2.5 s after mouse-up, not 'ambient': the drag DID `
      + `release and something else owns the camera. ${why(settle)} (timeline ${timeline.join(' ')})`
    );
  } else if (releaseMs > RELEASE_MS) {
    problems.push(
      `cameraOwner took ${releaseMs} ms to release to 'ambient' after the drag (budget ${RELEASE_MS} ms); `
      + `${why(settle)} (timeline ${timeline.join(' ')})`
    );
  }
  return problems;
}

let dragFails = await dragBlock();
if (dragFails.length) {
  console.log('drag block red, retrying once (a drag is timing-sensitive):\n  ' + dragFails.join('\n  '));
  await wait(2000);
  dragFails = await dragBlock();
  if (dragFails.length) fail.push(...dragFails.map((m) => `${m} [red twice]`));
  else console.log('drag block passed on the retry: intermittent, not a regression (say so in the report)');
}

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

// Time for the DPR buffer to return to rest after the selection is cleared
// (fix round, 2026-09-10 review, Important finding): the field is never
// busy on this path (no tour re-arms while a node is selected), so a flat
// 2 s settle was pure added latency here. Budget is the ~1.2 s default fly
// back to home plus the short settle, with margin.
await page.evaluate(() => window._store.getState().deselect());
const t1 = Date.now();
let atRest = false;
while (Date.now() - t1 < 4000) {
  atRest = await page.evaluate(() => window.__scene.dprState.current === window.__scene.dprState.rest);
  if (atRest) break;
  await wait(50);
}
const restMs = Date.now() - t1;
console.log(`DPR back to rest ${restMs} ms after deselect (fly back + settle)`);
if (!atRest) fail.push('DPR never returned to rest after deselect (4000 ms budget)');
else if (restMs > 2000) fail.push(`DPR took ${restMs} ms to return to rest after deselect (budget 2000 ms)`);

// 6. A manual Time Machine session, opened after the tour has already exited
// (final fix wave, 2026-09-11). Camera ownership used to key on the store's
// one-shot exit timestamp, which nothing resets, so every manual session that
// followed a tour exit read 'tween' for its whole duration: DPR pinned to 1
// and no depth of field while the viewer scrubbed at rest. The camera is at
// rest in a manual session, so it must read 'ambient' at the governed rest
// DPR, and closing must hand it straight back.
{
  // 1.2 s of continuous 'ambient' before the reading counts as rest. A single
  // not-'tween' sample is not enough on either side of the open: the deselect
  // above hands the camera a 2 s fly home that has not begun on the frame
  // after the call, and reading straight through that gap made this block
  // report a tween the Time Machine never started.
  const restQuiet = async (budgetMs) => {
    const t = Date.now();
    let run = 0;
    while (Date.now() - t < budgetMs) {
      const o = await page.evaluate(() => window.__scene.cameraOwner);
      run = o === 'ambient' ? run + 1 : 0;
      if (run >= 5) return true; // 5 samples, 300 ms apart
      await wait(300);
    }
    return false;
  };
  if (!(await restQuiet(8000))) {
    const d = await ownerState();
    fail.push(`the camera never reached 1.2 s of rest before the manual Time Machine step (${why(d)})`);
  }
  await page.evaluate(() => window._store.getState().startTimeMachine(false)); // what the header button calls once the tour has been seen
  if (!(await restQuiet(8000))) {
    const d = await ownerState();
    fail.push(`a manual Time Machine session never settled to 1.2 s of rest (${why(d)})`);
  }
  const tmRest = await page.evaluate(() => ({
    owner: window.__scene.cameraOwner,
    tmPhase: window._store.getState().tmPhase,
    tmExitLive: window.__scene.tmExitLive,
    dpr: window.__scene.dprState.current,
    restDpr: window.__scene.dprState.rest,
    switches: window.__scene.dprState.switches,
  }));
  console.log('manual Time Machine at rest:', JSON.stringify(tmRest));
  if (tmRest.owner !== 'ambient') {
    fail.push(
      `a manual Time Machine session read cameraOwner '${tmRest.owner}', not 'ambient' `
      + `(tmPhase ${tmRest.tmPhase}, tmExitLive ${tmRest.tmExitLive})`
    );
  }
  if (tmRest.dpr !== tmRest.restDpr) {
    fail.push(`a manual Time Machine session rendered at DPR ${tmRest.dpr}, not the governed rest ${tmRest.restDpr}`);
  }
  // Closing hands the camera straight back: 'ambient' held, not merely touched
  // once, inside the 2 s budget.
  await page.evaluate(() => window._store.getState().stopTimeMachine());
  const tClose = Date.now();
  const closeTimeline = [];
  let held = 0;
  let closeOwner = null;
  while (Date.now() - tClose < 2000) {
    closeOwner = await page.evaluate(() => window.__scene.cameraOwner);
    closeTimeline.push(`${Date.now() - tClose}ms:${closeOwner}`);
    held = closeOwner === 'ambient' ? held + 1 : 0;
    if (held >= 4) break; // 4 samples, 300 ms apart
    await wait(300);
  }
  console.log(`ownership after closing the Time Machine: ${closeTimeline.join(' ')}`);
  if (held < 4) {
    const d = await ownerState();
    fail.push(
      `cameraOwner did not hold 'ambient' within 2 s of closing the Time Machine `
      + `(${why(d)}) (timeline ${closeTimeline.join(' ')})`
    );
  }
}

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
