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
