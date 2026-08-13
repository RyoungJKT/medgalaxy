// tools/verify-ring.mjs
// Round 10, user report: "the exploding ring that plays after the nodes
// vibrate in the story modes" reads as broken and unimpressive.
//
//   node tools/verify-ring.mjs [task ...] [--mobile] [--reduced] [--tag NAME]
//
//   subjects  the three representative silhouettes (giant / small / mid):
//             heart-disease, rheumatic-heart-disease, cystic-fibrosis.
//             Fires a plain (non-story) supernova on each and samples the ring
//             through the burst, in world units AND in on-screen pixels.
//   story     the `killers` chip played end to end: per-step phase timings, so
//             a ring change that quietly moved the pacing is caught.
//   reduced   prefers-reduced-motion: the ring must be a fixed-radius opacity
//             pulse, never an expansion.
//   fps       frame rate across a burst.
//
// The measurement that matters is PIXELS, not world units. The supernova frames
// every subject proportionally (prefocus seats the camera at ~8x the node's own
// radius), so a ring sized in absolute world units is a different animation for
// every disease: what fills the frame for a 55-unit node has already left the
// frame by frame two for a 6-unit one. Every number below is therefore also
// reported as a fraction of the viewport half-height (`vh`), where 1.0 = the
// ring's edge exactly touches the top of the frame.
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const OUT = 'docs/verify';
const argv = process.argv.slice(2);
const mobile = argv.includes('--mobile');
const reduced = argv.includes('--reduced');
const tagI = argv.indexOf('--tag');
const TAG = tagI >= 0 ? argv[tagI + 1] : 'now';
const tasks = argv.filter((a, i) => !a.startsWith('--') && i !== tagI + 1);
const want = (t) => !tasks.length || tasks.includes(t);
const PRE = `ring-${TAG}${mobile ? '-m' : ''}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const log = (...a) => console.log(...a);
const check = (name, ok, detail) => {
  if (!ok) failures++;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const SUBJECTS = [
  ['heart-disease', 'giant'],
  ['rheumatic-heart-disease', 'small'],
  ['cystic-fibrosis', 'mid'],
];

// ── One read of the live ring, in world units and in frame-relative pixels ───
// px(r) = r * H / (2 * dist * tan(fov/2)); vh = px / (H/2), so vh 1.0 means the
// ring's edge is exactly at the top of the frame.
const RING = `(() => {
  const rp = window.__ripple;
  const st = window._store.getState();
  const cam = window.__scene.camera;
  const canvas = window.__scene.canvasElement;
  const H = canvas.clientHeight;
  const halfDiag = Math.hypot(1, canvas.clientWidth / H);
  const tanHalf = Math.tan(cam.fov * Math.PI / 360);
  const idx = st.supernovaTargetIdx;
  const p = st.curPos[idx] || [0,0,0];
  const dist = Math.hypot(p[0]-cam.position.x, p[1]-cam.position.y, p[2]-cam.position.z);
  const px = (r) => (r * H) / (2 * dist * tanHalf);
  const vh = (r) => px(r) / (H / 2);
  const nodeR = window.__scene.nodeRadius ? window.__scene.nodeRadius(idx) : null;
  return {
    phase: st.supernovaPhase,
    idx, id: st.diseases[idx] ? st.diseases[idx].id : null,
    dist: +dist.toFixed(1), nodeR: nodeR == null ? null : +nodeR.toFixed(2),
    nodeVh: nodeR == null ? null : +vh(nodeR).toFixed(3),
    active: rp.active, p: +rp.p.toFixed(3), alpha: +rp.alpha.toFixed(3),
    startR: +rp.startR.toFixed(2), innerR: +rp.innerR.toFixed(2), outerR: +rp.outerR.toFixed(2),
    innerVh: +vh(rp.innerR).toFixed(3), outerVh: +vh(rp.outerR).toFixed(3),
    widthPx: +(px(rp.outerR) - px(rp.innerR)).toFixed(1),
    startVh: +vh(rp.startR).toFixed(3),
    halfDiag: +halfDiag.toFixed(3),
    echoVh: +vh(rp.r2Inner || 0).toFixed(3), echoAlpha: +(rp.r2Alpha || 0).toFixed(3),
    flash: +(rp.flashAlpha || 0).toFixed(3), fovPunch: +(rp.fovPunch || 0).toFixed(5),
  };
})()`;

let browser, page;
async function boot() {
  browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--enable-webgl',
           '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
           ...(reduced ? ['--force-prefers-reduced-motion'] : [])],
    defaultViewport: mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
                            : { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  page = await browser.newPage();
  if (mobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => log('  [pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction('window._store !== undefined', { timeout: 20000 });
  await page.evaluate(() => {
    const el = document.querySelector('[style*="z-index: 200"], [style*="zIndex: 200"]');
    if (el) el.click(); else window._store.getState().setIntroStarted();
  });
  await page.evaluate(() => { const s = window._store.getState(); if (!s.overtureDone) s.finishOverture(); });
  // The opening runs film -> Time Machine tour, and skipping the film with
  // finishOverture drops us straight into the tour. A viewer reaching for a
  // story chip is looking at the RESTING galaxy, so put the harness there:
  // stop the tour and wait for its exit blend to hand radius back.
  await page.evaluate(() => {
    const s = window._store.getState();
    if (s.tmPhase !== 'idle') s.stopTimeMachine();
  });
  await page.waitForFunction(
    '!window.__scene.tm || (!window.__scene.tm.active && !window.__scene.tm.exit)',
    { timeout: 20000, polling: 100 }
  );
  // finishOverture also hands the camera to the film's own release tween, which
  // lands at the rest seat ~5 s later. Firing a supernova before it lands means
  // the prefocus fly gets overwritten mid-charge and the subject is framed at a
  // quarter size: a harness artifact, not a live defect, but it poisons every
  // pixel number below. Wait for the camera to actually stop.
  await page.waitForFunction(`(() => {
    const c = window.__scene.camera; const p = c.position;
    const prev = window.__ringCamPrev || null;
    window.__ringCamPrev = [p.x, p.y, p.z];
    return !!prev && Math.hypot(p.x-prev[0], p.y-prev[1], p.z-prev[2]) < 0.05;
  })()`, { timeout: 30000, polling: 250 });
  await wait(600);
}

mkdirSync(OUT, { recursive: true });
const shot = async (name) => {
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(`${OUT}/${name}.png`, buf);
};

/**
 * Fires a plain supernova on `id` and samples the ring across the burst.
 * Phase changes are waited on (never wall-clock arithmetic), so a retimed
 * prefocus/charge cannot silently desync the sample points.
 */
async function burstRun(id, label) {
  log(`\n== ${id} (${label}) ==`);
  await page.evaluate((did) => {
    const s = window._store.getState();
    s.setStoryActive?.(null);
    window._store.setState({ supernovaPhase: 'idle', selectedNode: null });
    s.triggerSupernova(s.idMap[did]);
  }, id);
  // Wait for burst rather than sleeping through prefocus+charge.
  await page.waitForFunction(
    '["burst","linkwave","settle","complete"].includes(window._store.getState().supernovaPhase)',
    { timeout: 15000, polling: 10 }
  );
  const samples = [];
  const marks = [0, 25, 60, 140, 260, 420, 620];
  let prev = 0;
  for (const m of marks) {
    if (m > prev) await wait(m - prev);
    prev = m;
    const r = await page.evaluate(RING);
    samples.push({ t: m, ...r });
    if (m === 25 || m === 140 || m === 420) await shot(`${PRE}-${id}-t${String(m).padStart(3, '0')}`);
  }
  const head = samples[0];
  log(`  camera ${head.dist} from node, node radius ${head.nodeR ?? 'n/a'} world` +
      (head.nodeVh != null ? ` (${(head.nodeVh * 100).toFixed(0)}% of frame half-height)` : ''));
  log('   t(ms)  p     innerR   outerR   inner(vh)  width(px)  alpha  echo(vh/a)   flash');
  for (const s of samples) {
    log(`   ${String(s.t).padStart(4)}  ${s.active ? s.p.toFixed(2) : ' -- '}  ` +
        `${String(s.innerR).padStart(7)}  ${String(s.outerR).padStart(7)}  ` +
        `${String(s.innerVh).padStart(8)}   ${String(s.widthPx).padStart(7)}   ` +
        `${String(s.alpha).padStart(5)}  ${String(s.echoVh).padStart(5)}/${String(s.echoAlpha).padEnd(5)}  ${s.flash}`);
  }
  // "On screen" is the frame's half-DIAGONAL, not its half-height: a ring at
  // 1.08 vh has swept past the top and bottom edges (which is the point: the
  // blast is meant to fill the frame) while its left and right arcs are still
  // well inside a 16:10 viewport. Gone means past the corner.
  const diag = samples[0].halfDiag;
  const onScreen = samples.filter((s) => s.active && s.innerVh <= diag);
  const lastOn = onScreen.length ? onScreen[onScreen.length - 1].t : -1;
  log(`  ring on screen through t=${lastOn}ms of the sampled marks` +
      ` (${onScreen.length}/${samples.length} marks; frame half-diagonal ${diag} vh)`);

  // t=0 is sampled before the ring's first lit frame, so its probe values are
  // the PREVIOUS ring's, frozen. Read the surface off the first lit frame.
  const lit = samples.find((s) => s.active);
  if (lit && lit.nodeR) {
    const off = Math.abs(lit.startR - lit.nodeR) / lit.nodeR;
    check(`${id}: ring starts at the node's live surface`,
      off <= 0.06, `start ${lit.startR} vs node ${lit.nodeR} (${(off*100).toFixed(1)}% off)`);
    check(`${id}: camera is seated at the sanctioned 8x the subject's radius`,
      Math.abs(lit.dist / lit.nodeR - 8) <= 0.6, `${(lit.dist / lit.nodeR).toFixed(2)}x`);
  }
  // The ring must never leave the frame while it is still bright enough to be
  // seen. Stated against alpha rather than against a fixed time, because the
  // frame's shape decides when the front crosses the corner: a 390x844 phone
  // has a half-diagonal of 1.10 vh where a 1440x900 desktop has 1.89.
  const visible = samples.filter((s) => s.active && s.alpha >= 0.05);
  const worstVisible = visible.length ? Math.max(...visible.map((s) => s.innerVh)) : 0;
  check(`${id}: the ring never leaves frame while still visible`,
    visible.length > 0 && worstVisible <= diag, `${worstVisible.toFixed(2)} vh vs ${diag} half-diagonal`);
  // Two ways of asking "does the blast fill the frame". Both read the ring's
  // SETTLED geometry off the last sample: the probe keeps it after the ring
  // fades, where "the biggest sample that happened to catch it alive" swings
  // 20% on whether the 620 ms mark landed a frame before or after the end of a
  // 650 ms animation. The geometric one is camera-free and exact; the framed
  // one carries the prefocus tween's few percent of slack around 8x.
  const finalVh = samples[samples.length - 1].innerVh;
  const reachK = lit ? samples[samples.length - 1].innerR / lit.nodeR : 0;
  check(`${id}: the shock front reaches ~5x the subject's radius`,
    reachK >= 4.8 && reachK <= 5.2, `${reachK.toFixed(2)}x`);
  // How much of the frame that reach covers is DERIVED, not independently
  // measured: reach/(seat * tan(fov/2)) is fixed by the two checks above, so
  // asserting it again would only re-test them through a noisier path (the
  // camera keeps moving through the ring's tail, once the burst's own
  // selectDisease dispatches the selection framing, which drags the measured
  // vh around by ~15% depending on which sample you read it from). Logged as
  // an observation; the acceptance is the exact pair above.
  const seat = lit ? lit.dist / lit.nodeR : 8;
  log(`  reach covers ${(reachK / (8 * Math.tan(Math.PI / 6))).toFixed(2)} of the frame` +
      ` half-height at the sanctioned seat (measured ${finalVh.toFixed(2)} vh at the live ${seat.toFixed(2)}x)`);
  const maxVh = finalVh;
  const widths = samples.filter((s) => s.active).map((s) => s.widthPx);
  check(`${id}: ring width stays legible (>= 2px) and never a slab (<= 90px)`,
    Math.min(...widths) >= 2 && Math.max(...widths) <= 90,
    `${Math.min(...widths).toFixed(1)}-${Math.max(...widths).toFixed(1)} px`);
  const echo = samples.filter((s) => s.echoAlpha > 0);
  const flash = samples.filter((s) => s.flash > 0);
  const punch = Math.max(...samples.map((s) => s.fovPunch));
  log(`  echo lit on ${echo.length} marks (peak alpha ${echo.length ? Math.max(...echo.map((s) => s.echoAlpha)) : 0}),` +
      ` flash on ${flash.length} (peak ${flash.length ? Math.max(...flash.map((s) => s.flash)) : 0}),` +
      ` camera fov punch peak ${(punch * 100).toFixed(3)}%`);
  check(`${id}: camera impulse stays inside the 0.5%-of-R0 ceiling`,
    punch > 0 && punch <= 0.005, `${(punch * 100).toFixed(3)}% of fov`);
  check(`${id}: the echo ring is alive in the ring's second half`, echo.length >= 2);
  check(`${id}: the flash peaks below the ring (cannot newly cross bloom)`,
    !flash.length || Math.max(...flash.map((s) => s.flash)) < 0.63,
    flash.length ? `${Math.max(...flash.map((s) => s.flash))}` : 'not sampled');
  return { id, label, samples, head, maxVh, widths };
}

async function subjects() {
  const out = [];
  for (const [id, label] of SUBJECTS) {
    out.push(await burstRun(id, label));
    await page.evaluate(() => window._store.setState({ supernovaPhase: 'idle', selectedNode: null }));
    await wait(700);
  }
  // Cross-subject consistency: the three peaks should agree, because the frame
  // is the same for all three. This is the whole defect in one number.
  const peaks = out.map((o) => o.maxVh);
  const spread = Math.max(...peaks) / Math.min(...peaks);
  log(`\n  final reach per subject (vh): ${out.map((o) => `${o.label} ${o.maxVh.toFixed(2)}`).join(', ')}`);
  check('the three subjects read as the same animation (reach spread <= 1.6x)',
    spread <= 1.6, `${spread.toFixed(2)}x spread`);
  return out;
}

/**
 * How long after the burst frame does the ring actually appear?
 * The ring used to arrive as a side effect of whichever selectDisease ran, and
 * in story mode that is the one at the END of the burst: a quarter second
 * after the tremble it is supposed to answer.
 */
async function latency() {
  log('\n== ring latency: burst frame to first lit ring ==');
  for (const [mode, start] of [
    ['plain', `(() => { const s = window._store.getState();
        window._store.setState({ supernovaPhase: 'idle', selectedNode: null, storyActive: null });
        s.triggerSupernova(s.idMap['copd']); })()`],
    ['story', `(() => {
        window._store.setState({ supernovaPhase: 'idle', selectedNode: null, storyActive: null });
        window._store.getState().setStoryActive('killers'); })()`],
  ]) {
    await page.evaluate(`(() => {
      window.__ringLat = { burstAt: null, ringAt: null };
      const un = window._store.subscribe((s) => s.supernovaPhase, (ph) => {
        if (ph === 'burst' && window.__ringLat.burstAt == null) {
          window.__ringLat.burstAt = performance.now();
          const poll = () => {
            if (window.__ripple.active && window.__ringLat.ringAt == null) {
              window.__ringLat.ringAt = performance.now();
              return;
            }
            if (performance.now() - window.__ringLat.burstAt < 2000) requestAnimationFrame(poll);
          };
          requestAnimationFrame(poll);
        }
      });
      window.__ringLatUnsub = un;
    })()`);
    await page.evaluate(start);
    await page.waitForFunction('window.__ringLat.ringAt != null || (window.__ringLat.burstAt != null && performance.now() - window.__ringLat.burstAt > 1500)',
      { timeout: 20000, polling: 30 });
    const r = await page.evaluate('window.__ringLat');
    await page.evaluate('window.__ringLatUnsub && window.__ringLatUnsub()');
    const ms = r.ringAt == null ? null : Math.round(r.ringAt - r.burstAt);
    log(`  ${mode.padEnd(6)} ring lit ${ms == null ? 'NEVER' : `${ms}ms`} after the burst frame`);
    check(`${mode}: the ring is simultaneous with the burst (<= 60ms)`, ms != null && ms <= 60,
      ms == null ? 'never lit' : `${ms}ms`);
    await page.evaluate(() => window._store.setState({
      supernovaPhase: 'idle', selectedNode: null, storyActive: null, storyVisible: true }));
    await wait(900);
  }
}

/** The killers chip, played through: phase timings per step. */
async function story() {
  log('\n== story `killers`, played end to end ==');
  await page.evaluate(() => {
    window._store.setState({ supernovaPhase: 'idle', selectedNode: null, storyActive: null });
  });
  await wait(400);
  const t0 = Date.now();
  const marks = await page.evaluate(`(() => {
    window.__ringMarks = [];
    const un = window._store.subscribe(
      (s) => s.supernovaPhase,
      (ph) => window.__ringMarks.push([ph, Date.now()])
    );
    window.__ringUnsub = un;
    return true;
  })()`);
  await page.evaluate(() => window._store.getState().setStoryActive('killers'));
  // Step 1 runs on its own; advance the remaining steps the way the UI does.
  for (let step = 1; step <= 3; step++) {
    await page.waitForFunction(
      'window._store.getState().supernovaPhase === "complete" || window._store.getState().supernovaPhase === "idle"',
      { timeout: 20000, polling: 20 }
    );
    await wait(1200);
    await shot(`${PRE}-story-killers-step${step}`);
    await page.evaluate((s) => window._store.setState({ storyStep: s }), step);
    await wait(200);
  }
  const raw = await page.evaluate('window.__ringMarks');
  await page.evaluate('window.__ringUnsub && window.__ringUnsub()');
  const rel = raw.map(([ph, t]) => [ph, t - t0]);
  // Per-step phase durations: prefocus -> charge -> burst -> complete.
  const legs = [];
  for (let i = 1; i < rel.length; i++) legs.push([rel[i - 1][0], rel[i][1] - rel[i - 1][1]]);
  const byPhase = {};
  for (const [ph, ms] of legs) (byPhase[ph] ||= []).push(ms);
  for (const ph of ['prefocus', 'charge', 'burst']) {
    if (!byPhase[ph]) continue;
    log(`  ${ph.padEnd(9)} ${byPhase[ph].map((m) => `${m}ms`).join(', ')}`);
  }
  const okPre = (byPhase.prefocus || []).every((m) => Math.abs(m - 1200) <= 140);
  const okChg = (byPhase.charge || []).every((m) => Math.abs(m - 1000) <= 140);
  const okBst = (byPhase.burst || []).every((m) => Math.abs(m - 250) <= 140);
  check('story pacing unchanged (prefocus 1200 / charge 1000 / burst 250, +-140ms)',
    okPre && okChg && okBst);
  check('all three killers steps fired a supernova',
    (byPhase.prefocus || []).length >= 3, `${(byPhase.prefocus || []).length} prefocus legs`);
  return byPhase;
}

/** prefers-reduced-motion: a pulse, not an expansion. */
async function reducedCheck() {
  log('\n== prefers-reduced-motion ==');
  const r = await page.evaluate(`(() => {
    const s = window._store.getState();
    window._store.setState({ supernovaPhase: 'idle', selectedNode: null });
    s.triggerSupernova(s.idMap['cystic-fibrosis']);
    return true;
  })()`);
  await page.waitForFunction(
    '["burst","linkwave","settle","complete"].includes(window._store.getState().supernovaPhase)',
    { timeout: 15000, polling: 10 }
  );
  // Absolute marks, not fixed 60 ms gaps: the pulse is DUR.mid (320 ms), so a
  // liveness check has to sample on BOTH sides of that, not stop at 300.
  const seq = [];
  let prev = 0;
  for (const m of [0, 60, 120, 200, 300, 430]) {
    if (m > prev) await wait(m - prev);
    prev = m;
    seq.push({ t: m, ...(await page.evaluate(RING)) });
  }
  await shot(`${PRE}-reduced-cf`);
  const act = seq.filter((s) => s.active);
  const radii = act.map((s) => s.innerR);
  const grew = radii.length > 1 ? Math.max(...radii) / Math.min(...radii) : 1;
  log(`  inner radii: ${radii.map((r) => r.toFixed(1)).join(', ')} (node surface ${act.length ? act[0].nodeR : '?'} x 1.02)`);
  log(`  alphas:      ${act.map((s) => s.alpha.toFixed(2)).join(', ')}`);
  check('reduced motion: the ring does not expand (radius spread < 1.02x)', grew < 1.02, `${grew.toFixed(3)}x`);
  check('reduced motion: alpha still pulses', act.length > 1 && Math.max(...act.map(s=>s.alpha)) > 0.05);
  const life = act.length ? act[act.length - 1] : null;
  check('reduced motion: the pulse is a single short beat (gone by 430ms)',
    seq[5] && !seq[5].active, life ? `last lit at t=${life.t}ms, p=${life.p}` : 'never active');
  check('reduced motion: the ring sits on the surface, not out in the frame',
    !!act.length && act.every((s) => s.innerVh < 0.5),
    act.length ? `${Math.max(...act.map((s) => s.innerVh))} vh` : 'never active');
}

/** FPS across a burst. */
async function fps() {
  log('\n== frame rate across a burst ==');
  await page.evaluate(() => {
    window._store.setState({ supernovaPhase: 'idle', selectedNode: null });
    const s = window._store.getState();
    s.triggerSupernova(s.idMap['heart-disease']);
  });
  await page.waitForFunction('window._store.getState().supernovaPhase === "charge"', { timeout: 15000, polling: 10 });
  const f = await page.evaluate(`new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 1600) requestAnimationFrame(tick);
      else res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
    requestAnimationFrame(tick);
  })`);
  log(`  ${f} fps across charge + burst`);
  check('fps >= 55 across the burst', f >= 55, `${f} fps`);
}

(async () => {
  await boot();
  log(`ring verify [${TAG}]${mobile ? ' mobile' : ''}${reduced ? ' reduced-motion' : ''}`);
  if (reduced) { await reducedCheck(); }
  else {
    if (want('subjects')) await subjects();
    if (want('latency')) await latency();
    if (want('story')) await story();
    if (want('fps')) await fps();
  }
  await browser.close();
  log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`}`);
  process.exit(failures ? 1 : 0);
})().catch(async (e) => { console.error(e); if (browser) await browser.close(); process.exit(2); });
