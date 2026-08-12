// tools/verify.mjs
// Headless-Chrome harness (browser-pane rAF throttling makes the preview pane unusable for this).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// --mobile: emulate a phone (375x812, isMobile+hasTouch — the width<768 half
// of tiers.js's detectTier()/helpers.js's isMob() alone is enough to land LOW
// tier and the mobile UI branch, regardless of how headless Chrome reports
// pointer:coarse).
// --reduced: emulate prefers-reduced-motion: reduce, set before goto (has to
// be live for the very first paint — LandingOverlay's reduced-motion skip and
// CameraRig's assembly-hold both read matchMedia on mount).
// --headed: run on the real display instead of headless Chrome. The whole
// perf matrix carries a caveat that headless rAF is not driven by a real
// compositor and reads this machine's apparent ceiling regardless of scene
// cost; a headed window is the only way to get an on-display FPS number from
// this harness. Everything else (shots, evals) behaves identically, so
// `--headed --shot x` is also a way to confirm a frame is not a headless
// artifact.
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
const headed = args.includes('--headed');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: headed ? false : 'new',
  args: [`--window-size=${mobile ? '375,812' : '1440,900'}`, '--use-gl=angle'] });
const page = await browser.newPage();
if (reduced) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
}
await page.setViewport(
  mobile ? { width: 375, height: 812, isMobile: true, hasTouch: true } : { width: 1440, height: 900 }
);
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction('window._store !== undefined', { timeout: 15000 });

const evalArg = get('--eval');
if (evalArg) console.log(JSON.stringify(await page.evaluate(evalArg)));

const fpsSecs = get('--fps');
if (fpsSecs) {
  const fps = await page.evaluate(async (secs) => {
    let frames = 0; const t0 = performance.now();
    await new Promise((res) => { const tick = () => { frames++;
      performance.now() - t0 < secs * 1000 ? requestAnimationFrame(tick) : res(); };
      requestAnimationFrame(tick); });
    return Math.round(frames / secs);
  }, Number(fpsSecs));
  console.log(`FPS: ${fps}`);
}

const shot = get('--shot');
if (shot) {
  fs.mkdirSync('docs/verify', { recursive: true });
  await page.screenshot({ path: `docs/verify/${shot}.png` });
  console.log(`saved docs/verify/${shot}.png`);
}
await browser.close();
