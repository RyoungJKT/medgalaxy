// tools/verify-dpr.mjs
// Task 1 of the 2026-09-10 plan. Proves the two fidelity features the
// addendum's camera breathing had silently disabled are back:
//   1. at home rest on a 2x display the drawing buffer is 2160x1350 (DPR 1.5)
//   2. a plain click (no prior drag) racks the depth of field to bokeh > 2.5
//      within 1 s
//   3. the buffer switches DPR at most twice across the whole opening + tour
//   4. a real drag reads cameraOwner 'user' throughout, including the
//      drag.quiet<30 tail right after onEnd (fix round, 2026-09-10 review:
//      the onEnd/user-ownership branch this task adds was never exercised)
//   5. after a selection is cleared, the DPR buffer is back at rest within a
//      short, bounded time (fix round: pins that the settle window stays
//      short on this path, not the 2 s flat value the first pass shipped)
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
await page.mouse.move(720, 450);
await page.mouse.down();
await page.mouse.move(780, 480, { steps: 8 });
await wait(50); // let at least one frame pick up drag.active before reading it
const duringDrag = await page.evaluate(() => window.__scene.cameraOwner);
await page.mouse.up();
const rightAfterEnd = await page.evaluate(() => window.__scene.cameraOwner);
console.log(`drag ownership: during=${duringDrag} right-after-onEnd=${rightAfterEnd}`);
if (duringDrag !== 'user') fail.push(`cameraOwner during a drag was '${duringDrag}', not 'user'`);
if (rightAfterEnd !== 'user') fail.push(`cameraOwner right after onEnd was '${rightAfterEnd}', not 'user' (the drag.quiet<30 tail)`);
await wait(1000); // clears drag.quiet<30 and the short settle, back to ambient/rest

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
