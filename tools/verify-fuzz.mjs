// tools/verify-fuzz.mjs
// ADDENDUM 1 delta-list item 10: skip integrity under all the new motion.
//
//   "Every added channel (flight, stretch, filaments, ghosts, settles,
//    breathing, exit blend) has a defined terminal state and a defined
//    fast-forward, and no input at any moment can leave the piece in a half
//    state. Acceptance: a fuzz pass that fires a click at 40 evenly spaced
//    times from 0.0 s to 56.1 s; after each, wait 3 s and assert the invariant
//    set (no node in flight, all quaternions identity, tm.exit in {0, 1}, no
//    orphan ghost instance visible, chrome up, thesis caption seen at least
//    once). This is the test that protects the whole addendum from itself."
//
//   node tools/verify-fuzz.mjs [--conc N] [--points N] [--mobile] [--reduced]
//
// 56.1 s is the whole unattended piece: 5.2 s assembly + 16.5 s film + 1.5 s
// arm + 30.3 s tour + 2.6 s exit. The clock starts when the landing overlay is
// dismissed, which is where the piece's own clock starts.
//
// Two assertion groups, because the invariant set contains two kinds of claim:
//
//   A, three seconds after the click — the structural ones, which are about
//      nothing being left half-applied: no node in flight, every quaternion
//      identity and every scale isotropic (no comet stretch stranded), no
//      filament segment left drawn, tm.exit exactly 0 or 1 (never parked
//      mid-blend), no live ghost shell.
//
//   B, once the sequence it was dropped into has finished — the narrative
//      ones: chrome up, and the thesis caption seen at least once. A click at
//      t = 2 s lands mid-assembly and the compressed film still has its hero
//      hold to run, so asserting "chrome up" three seconds later would be
//      asserting that the skip skipped the thesis, which is the one thing the
//      piece is not allowed to do (DIRECTION 6.9). B is polled, with a
//      timeout, so a run that never gets there fails rather than hangs.
//
// Concurrency uses separate browsers, not tabs: a background tab's rAF is
// throttled by Chrome and every timing in here is wall-clock.
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const CONC = flag('--conc', 2);
const POINTS = flag('--points', 40);
const SPAN = 56.1;
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
// --at 12.946,15.823 re-runs named points only, for confirming a failure
// without paying for the other thirty-eight.
const atArg = (() => { const i = args.indexOf('--at'); return i >= 0 ? args[i + 1] : null; })();

const times = [];
if (atArg) for (const v of atArg.split(',')) times.push(+Number(v).toFixed(3));
else for (let k = 0; k < POINTS; k++) times.push(+(k * (SPAN / (POINTS - 1))).toFixed(3));

// One read of everything the invariant set asks about, off the LIVE instance
// matrices rather than any driver's own arrays — what is being asserted is the
// frame the viewer is sitting in front of.
const INV = `(() => {
  const st = window._store.getState();
  const mesh = window.__scene.instancedMesh;
  const m = mesh.instanceMatrix.array;
  let nonIdentity = 0, maxAniso = 1, present = 0;
  for (let i = 0; i < mesh.count; i++) {
    const o = i * 16;
    const sx = Math.hypot(m[o], m[o+1], m[o+2]);
    const sy = Math.hypot(m[o+4], m[o+5], m[o+6]);
    const sz = Math.hypot(m[o+8], m[o+9], m[o+10]);
    const s = Math.max(sx, sy, sz);
    if (s > 1e-6) present++;
    const aniso = s / Math.max(1e-9, Math.min(sx, sy, sz));
    if (aniso > maxAniso) maxAniso = aniso;
    const off = Math.max(
      Math.abs(m[o+1]), Math.abs(m[o+2]), Math.abs(m[o+4]),
      Math.abs(m[o+6]), Math.abs(m[o+8]), Math.abs(m[o+9]),
    ) / Math.max(1e-9, s);
    if (off > 1e-4) nonIdentity++;
  }
  const asm = window.__assembly ? window.__assembly.state() : null;
  return {
    present, count: mesh.count, nonIdentity, maxAniso: +maxAniso.toFixed(4),
    inFlight: asm ? asm.inFlight : 0,
    asmActive: asm ? !!asm.active : false,
    filaments: asm ? asm.filaments : 0,
    tmExit: window.__tm ? window.__tm.exit : 0,
    tmActive: window.__tm ? !!window.__tm.active : false,
    ghosts: window.__ghosts ? window.__ghosts().length : 0,
    uiRevealed: !!st.uiRevealed, hintsShown: !!st.hintsShown,
    tmPhase: st.tmPhase, overtureDone: !!st.overtureDone,
    thesis: !!(window.__fuzz && window.__fuzz.thesis),
    errors: window.__fuzz ? window.__fuzz.errors : 0,
    // Survives only as long as the document does: a headless renderer that
    // crashes and restores its tab comes back with the landing overlay up and
    // no recorder, which would otherwise read as the piece having lost its
    // chrome and its thesis. That is an infrastructure event, not a finding,
    // and the lane retries it on a fresh browser rather than scoring it.
    session: window.__fuzz ? window.__fuzz.session : null,
  };
})()`;

const ARM = `((id) => {
  window.__fuzz = { thesis: false, errors: 0, session: id };
  window.addEventListener('error', () => { window.__fuzz.errors++; });
  // The thesis frame is the only caption that carries the odometer and the
  // hero line, on both the played and the compressed path.
  window._store.subscribe(
    (s) => s.overtureCaption,
    (c) => { if (c && (c.odometer || c.heroLine != null)) window.__fuzz.thesis = true; }
  );
  return true;
})`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runPoint(page, t) {
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction('window._store !== undefined', { timeout: 20000 });
  const session = `s${Math.random().toString(36).slice(2)}`;
  await page.evaluate(`${ARM}(${JSON.stringify(session)})`);
  // The piece's clock starts at the dismissal, not at page load.
  const t0 = Date.now();
  await page.evaluate(() => {
    const el = document.querySelector('[style*="z-index: 200"], [style*="zIndex: 200"]');
    if (el) el.click();
    else window._store.getState().setIntroStarted();
  });
  const due = t * 1000 - (Date.now() - t0);
  if (due > 0) await wait(due);
  const at = +((Date.now() - t0) / 1000).toFixed(2);
  // A real click on the canvas: pointerdown is what every skip/handover path in
  // the piece listens for, and mouse events are what a viewer produces.
  await page.mouse.click(mobile ? 187 : 720, mobile ? 300 : 400);
  await wait(3000);
  const a = await page.evaluate(INV);
  if (a.session !== session) throw new Error('page reloaded before the 3 s read');
  const structural =
    a.inFlight === 0 && a.asmActive === false && a.filaments === 0 &&
    a.nonIdentity === 0 && a.maxAniso < 1.001 &&
    (a.tmExit === 0 || a.tmExit === 1) && a.ghosts === 0 &&
    a.present === a.count && a.errors === 0;

  // B: let whatever the click landed in finish, then assert the narrative pair.
  let b = a;
  try {
    await page.waitForFunction(
      () => {
        const s = window._store.getState();
        return s.uiRevealed && s.hintsShown && window.__fuzz.thesis;
      },
      { timeout: 40000, polling: 200 },
    );
  } catch { /* falls through to a failing read below */ }
  b = await page.evaluate(INV);
  if (b.session !== session) throw new Error('page reloaded during the settle poll');
  const narrative = b.uiRevealed && b.hintsShown && b.thesis;
  return { t, at, a, b, structural, narrative, pass: structural && narrative };
}

// Forty page loads of a WebGL scene through one browser will eventually lose
// the context, and a detached frame then fails every remaining point in that
// lane with a protocol error rather than a finding. The lane therefore owns a
// disposable browser: rebuilt every RECYCLE points, and rebuilt again on any
// error before the point is retried once. Only a point that fails twice, with
// a live browser, is a real failure.
const RECYCLE = 8;

async function makeBrowser() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [`--window-size=${mobile ? '375,812' : '1440,900'}`, '--use-gl=angle'],
  });
  const page = await browser.newPage();
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(mobile
    ? { width: 375, height: 812, isMobile: true, hasTouch: true }
    : { width: 1440, height: 900 });
  return { browser, page };
}

const results = new Array(times.length);
const lanes = [];
for (let lane = 0; lane < CONC; lane++) {
  lanes.push((async () => {
    let ctx = await makeBrowser();
    let since = 0;
    for (let i = lane; i < times.length; i += CONC) {
      if (since >= RECYCLE) {
        await ctx.browser.close().catch(() => {});
        ctx = await makeBrowser();
        since = 0;
      }
      since++;
      try {
        results[i] = await runPoint(ctx.page, times[i]);
      } catch (e) {
        console.log(`  t=${times[i]}s  retrying on a fresh browser (${String(e && e.message || e).slice(0, 60)})`);
        await ctx.browser.close().catch(() => {});
        ctx = await makeBrowser();
        since = 1;
        try {
          results[i] = await runPoint(ctx.page, times[i]);
        } catch (e2) {
          results[i] = { t: times[i], pass: false, error: String(e2 && e2.message || e2) };
        }
      }
      const r = results[i];
      console.log(
        `  t=${String(times[i]).padStart(6)}s  ${r.pass ? 'PASS' : 'FAIL'}` +
        (r.error ? `  ${r.error}` : `  [3s: flight ${r.a.inFlight} quat ${r.a.nonIdentity} ` +
          `aniso ${r.a.maxAniso} fil ${r.a.filaments} exit ${r.a.tmExit} ghosts ${r.a.ghosts} ` +
          `err ${r.a.errors}]  [settled: chrome ${r.b.uiRevealed && r.b.hintsShown} ` +
          `thesis ${r.b.thesis} tm ${r.b.tmPhase} exit ${r.b.tmExit}]`)
      );
    }
    await ctx.browser.close().catch(() => {});
  })());
}
await Promise.all(lanes);

const failed = results.filter((r) => !r || !r.pass);
console.log(`\n  ${times.length - failed.length}/${times.length} points green` +
  (failed.length ? `\n  FAILURES: ${failed.map((r) => (r ? r.t : '?')).join(', ')}` : ''));
console.log(`  structural (3 s after the click): ${results.filter((r) => r && r.structural).length}/${times.length}`);
console.log(`  narrative (once settled): ${results.filter((r) => r && r.narrative).length}/${times.length}`);
process.exit(failed.length ? 1 : 0);
