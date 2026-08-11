// tools/verify.mjs
// Headless-Chrome harness (browser-pane rAF throttling makes the preview pane unusable for this).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--window-size=1440,900', '--use-gl=angle'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
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
