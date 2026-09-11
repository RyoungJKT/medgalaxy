// tools/verify-wave3.mjs
// The round-7 wave-3 acceptance harness: ADDENDUM 1 section 3 and delta-list
// item 3, the fly-in assembly. Headless Chrome against :5280, the same setup
// tools/verify.mjs and verify-wave2.mjs use (the browser pane throttles rAF, so
// a live pane cannot time any of this).
//
//   node tools/verify-wave3.mjs <task> [--mobile] [--reduced] [--headed]
//
// Tasks: seeks, firstFrame, skip, fps, reduced, film, delta1.
// Run them one at a time: each one owns the whole session's state.
//
// Every geometric assertion is read off the LIVE instance matrices
// (`__scene.instancedMesh.instanceMatrix.array`), not off the flight driver's
// own arrays, so what is being verified is the frame the viewer sees:
//   translation  = m[12..14]
//   scale        = the three column lengths
//   quaternion   = identity iff the upper 3x3 is diagonal, i.e. every
//                  off-diagonal entry is zero
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--')) || 'seeks';
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
const headed = args.includes('--headed');
const OUT = '/Users/darwin/Documents/Claude/medgalaxy-next/docs/verify';
const P = mobile ? 'w3m' : 'w3';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: headed ? false : 'new',
  args: [`--window-size=${mobile ? '375,812' : '1440,900'}`, '--use-gl=angle'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console error]', m.text()); });
page.on('pageerror', (e) => console.log('  [page error]', e.message));
if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setViewport(mobile
  ? { width: 375, height: 812, isMobile: true, hasTouch: true }
  : { width: 1440, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction('window._store !== undefined', { timeout: 20000 });

const shot = async (name) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  shot ${name}.png`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const ok = (b) => (b ? 'PASS' : 'FAIL');

// One read of the whole instanced mesh, decomposed by hand.
const SCAN = `(() => {
  const mesh = window.__scene.instancedMesh;
  const cam = window.__scene.camera;
  const m = mesh.instanceMatrix.array;
  const n = mesh.count;
  const R0 = window._store.getState().rawMax * (window.innerWidth < 768 ? 2.4 : 1.4);
  let present = 0, insideR0 = 0, nonIdentity = 0, stretched = 0;
  let minS = 1e9, maxS = 0, maxAniso = 1, minD = 1e9, maxD = 0;
  const sample = [];
  for (let i = 0; i < n; i++) {
    const o = i * 16;
    const cx = [m[o], m[o+1], m[o+2]];
    const cy = [m[o+4], m[o+5], m[o+6]];
    const cz = [m[o+8], m[o+9], m[o+10]];
    const sx = Math.hypot(cx[0], cx[1], cx[2]);
    const sy = Math.hypot(cy[0], cy[1], cy[2]);
    const sz = Math.hypot(cz[0], cz[1], cz[2]);
    const px = m[o+12], py = m[o+13], pz = m[o+14];
    const d = Math.hypot(px, py, pz);
    const s = Math.max(sx, sy, sz);
    if (s > 1e-6) present++;
    if (d < 2.0 * R0) insideR0++;
    minS = Math.min(minS, s); maxS = Math.max(maxS, s);
    minD = Math.min(minD, d); maxD = Math.max(maxD, d);
    const aniso = Math.max(sx, sy, sz) / Math.max(1e-9, Math.min(sx, sy, sz));
    if (aniso > maxAniso) maxAniso = aniso;
    if (aniso > 1.001) stretched++;
    // Quaternion identity <=> the upper 3x3 is diagonal (off-diagonals zero).
    const off = Math.max(
      Math.abs(m[o+1]), Math.abs(m[o+2]), Math.abs(m[o+4]),
      Math.abs(m[o+6]), Math.abs(m[o+8]), Math.abs(m[o+9]),
    ) / Math.max(1e-9, s);
    if (off > 1e-4) nonIdentity++;
    if (i < 3) sample.push({ i, d: +d.toFixed(1), s: +s.toFixed(3), aniso: +aniso.toFixed(3) });
  }
  const asm = window.__assembly ? window.__assembly.state() : null;
  return {
    n, present, insideR0, nonIdentity, stretched,
    maxAniso: +maxAniso.toFixed(3),
    minD: +minD.toFixed(0), maxD: +maxD.toFixed(0), R0: +R0.toFixed(0),
    dR0: [+(minD/R0).toFixed(2), +(maxD/R0).toFixed(2)],
    camR0: +(Math.hypot(cam.position.x, cam.position.y, cam.position.z) / R0).toFixed(3),
    filaments: asm ? asm.filaments : 0,
    asm,
    introPhase: window._store.getState().introPhase,
    beat: window._store.getState().overtureBeat,
    desat: window.__fx.desat,
  };
})()`;

const dismiss = () => page.evaluate(() => {
  const el = document.querySelector('[style*="z-index: 200"], [style*="zIndex: 200"]');
  if (el) el.click();
  else window._store.getState().setIntroStarted();
});

// ── delta-3: the five seeks, desktop and portrait ───────────────────────────
async function seeks() {
  log(`\n== delta 3: __assembly.seek shot set (${mobile ? 'portrait 375x812' : 'desktop 1440x900'}) ==`);
  const rows = [];
  for (const t of [0.0, 1.6, 3.2, 4.9, 5.0, 5.2]) {
    const okSeek = await page.evaluate((tt) => window.__assembly.seek(tt, 14), t);
    if (!okSeek) { log(`  t=${t}: seek refused (assembly already over)`); continue; }
    await wait(260);
    const s = await page.evaluate(SCAN);
    rows.push([t, s]);
    log(`  t=${t.toFixed(1)}s  present ${s.present}/${s.n}  inside2R0 ${s.insideR0}  ` +
        `nonIdentityQuat ${s.nonIdentity}  stretched ${s.stretched} (max ${s.maxAniso}x)  ` +
        `filaments ${s.filaments}  dist ${s.dR0[0]}..${s.dR0[1]} R0  cam ${s.camR0} R0  ` +
        `phase ${s.introPhase} desat ${s.desat.toFixed(2)}` +
        (s.asm ? `  inFlight ${s.asm.inFlight} landed ${s.asm.landed} pip ${s.asm.maxBright}` : ''));
    await shot(`${P}-assembly-${String(t.toFixed(1)).replace('.', 'p')}`);
  }
  log('\n  acceptance:');
  const first = rows.find((r) => r[0] === 0.0);
  if (first) {
    log(`   first frame: ${ok(first[1].present === 153)} 153 present, ` +
        `${ok(first[1].insideR0 === 0)} 0 inside 2.0 R0, ` +
        `${ok(first[1].nonIdentity === 0)} 0 non-identity quaternions`);
  }
  const mid = rows.filter((r) => r[0] === 1.6 || r[0] === 3.2).map((r) => r[1]);
  log(`   mid-flight streams: ${ok(mid.every((s) => s.filaments > 40 && s.stretched > 40))} ` +
      `filament segments ${mid.map((s) => s.filaments).join(' / ')}, ` +
      `stretched instances ${mid.map((s) => s.stretched).join(' / ')}`);
  const late = rows.find((r) => r[0] === 5.0);
  if (late) log(`   giants landing last: at 5.0 s ${late[1].asm ? late[1].asm.inFlight : '?'} still in flight`);
  const end = rows.find((r) => r[0] === 5.2);
  if (end) log(`   beat 0 ends clean: ${ok(end[1].nonIdentity === 0 && end[1].maxAniso < 1.001 && end[1].filaments === 0)} ` +
      `quats ${end[1].nonIdentity}, max anisotropy ${end[1].maxAniso}, filaments ${end[1].filaments}`);
}

// ── first-frame integrity, played rather than seeked ─────────────────────────
async function firstFrame() {
  log('\n== section 3: first-frame integrity, on the real first painted frame ==');
  await dismiss();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const s = await page.evaluate(SCAN);
  log(`  present ${s.present}/${s.n}  inside 2.0 R0 ${s.insideR0}  non-identity quaternions ${s.nonIdentity}`);
  log(`  spawn shell ${s.dR0[0]}..${s.dR0[1]} R0 (R0 = ${s.R0}), camera ${s.camR0} R0, desat ${s.desat}`);
  log(`  ${ok(s.present === 153 && s.insideR0 === 0 && s.nonIdentity === 0)} (153 present, 0 inside 2.0 R0, 0 rotated)`);
  await shot(`${P}-assembly-firstpaint`);
}

// ── skip during assembly ─────────────────────────────────────────────────────
async function skip() {
  log('\n== section 3: skip during assembly at t = 1.0 s ==');
  await dismiss();
  await wait(1000);
  const before = await page.evaluate(SCAN);
  log(`  at the skip: inFlight ${before.asm ? before.asm.inFlight : '?'}, stretched ${before.stretched}, ` +
      `non-identity quaternions ${before.nonIdentity}`);
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const frame1 = await page.evaluate(SCAN);
  log(`  beat 1 frame 1 (2 frames after the input): phase ${frame1.introPhase}, ` +
      `non-identity quaternions ${frame1.nonIdentity}, max anisotropy ${frame1.maxAniso}, ` +
      `filaments ${frame1.filaments}, still moving ${frame1.asm ? frame1.asm.inFlight : 0}`);
  await shot(`${P}-assembly-skip-frame1`);
  await wait(520);
  const after = await page.evaluate(SCAN);
  log(`  +0.5 s: inFlight ${after.asm ? after.asm.inFlight : 0}, ` +
      `non-identity quaternions ${after.nonIdentity}, max anisotropy ${after.maxAniso}, ` +
      `filaments ${after.filaments}, assembly active ${after.asm ? after.asm.active : false}`);
  const seated = await page.evaluate(`(() => {
    const s = window._store.getState();
    const m = window.__scene.instancedMesh.instanceMatrix.array;
    let worst = 0;
    for (let i = 0; i < s.diseases.length; i++) {
      const o = i * 16;
      worst = Math.max(worst, Math.hypot(m[o+12]-s.catPos[i][0], m[o+13]-s.catPos[i][1], m[o+14]-s.catPos[i][2]));
    }
    return +worst.toFixed(4);
  })()`);
  log(`  worst distance from any node to its seat: ${seated}`);
  log(`  ${ok(frame1.nonIdentity === 0 && frame1.maxAniso < 1.001)} quaternions identity on beat 1 frame 1`);
  log(`  ${ok((after.asm ? after.asm.inFlight : 0) === 0 && seated < 1)} nothing in flight after 0.5 s`);
  await shot(`${P}-assembly-skip-settled`);
}

// ── FPS during the assembly window ───────────────────────────────────────────
async function fps() {
  log(`\n== section 3: FPS during the assembly (${mobile ? 'LOW tier portrait' : 'HIGH tier desktop'}) ==`);
  await dismiss();
  const res = await page.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    await new Promise((res2) => {
      const tick = () => { frames++; performance.now() - t0 < 5000 ? requestAnimationFrame(tick) : res2(); };
      requestAnimationFrame(tick);
    });
    return { fps: Math.round(frames / 5), phase: window._store.getState().introPhase };
  });
  log(`  ${res.fps} fps across the whole 5.2 s assembly window (phase now ${res.phase})`);
  log(`  ${ok(res.fps >= (mobile ? 30 : 55))} (gate ${mobile ? 30 : 55})`);
}

// ── reduced motion: unchanged from today ─────────────────────────────────────
async function reducedCheck() {
  log('\n== section 3: reduced motion is unchanged (assembly skipped outright) ==');
  const s = await page.evaluate(SCAN);
  log(`  introPhase ${s.introPhase}, assembly ${s.asm ? JSON.stringify(s.asm) : 'null'}`);
  log(`  present ${s.present}/${s.n}, inside 2.0 R0 ${s.insideR0}, non-identity quats ${s.nonIdentity}, ` +
      `filaments ${s.filaments}, camera ${s.camR0} R0`);
  log(`  ${ok(s.introPhase === 5 && s.nonIdentity === 0 && s.filaments === 0 && s.insideR0 === s.n)} ` +
      `(seated on the first frame, nothing flying, no filaments)`);
  await shot(`${P}-assembly-reduced`);
}

// ── the film still lands after the longer beat 0 ─────────────────────────────
async function film() {
  log('\n== the overture clock keeps the 16.5 s film after the longer assembly ==');
  await dismiss();
  const t0 = Date.now();
  await page.evaluate(() => {
    window.__marks = { beats: [], phase5: null };
    const s = window._store;
    s.subscribe((st) => st.introPhase, (p) => { if (p >= 5 && !window.__marks.phase5) window.__marks.phase5 = performance.now(); });
    s.subscribe((st) => st.overtureBeat, (b) => window.__marks.beats.push([b, performance.now()]));
    window.__marks.t0 = performance.now();
    s.subscribe((st) => st.overtureDone, (d) => { if (d) window.__marks.done = performance.now(); });
  });
  await wait(24000);
  const marks = await page.evaluate(() => {
    const m = window.__marks;
    return {
      phase5: m.phase5 ? +((m.phase5 - m.t0) / 1000).toFixed(2) : null,
      beats: m.beats.map(([b, t]) => [b, +((t - m.t0) / 1000).toFixed(2)]),
      done: m.done ? +((m.done - m.t0) / 1000).toFixed(2) : null,
      state: {
        uiRevealed: window._store.getState().uiRevealed,
        hintsShown: window._store.getState().hintsShown,
        beat: window._store.getState().overtureBeat,
        ember: window.__fx.ember,
      },
    };
  });
  log(`  assembly ended (phase 5) at ${marks.phase5} s after dismissal`);
  log(`  beats: ${marks.beats.map(([b, t]) => `${b}@${t}`).join('  ')}`);
  log(`  film finished at ${marks.done} s; state ${JSON.stringify(marks.state)}`);
  const filmLen = marks.done != null && marks.phase5 != null ? +(marks.done - marks.phase5).toFixed(2) : null;
  log(`  film length beat 1 to release end: ${filmLen} s (boarded 16.5)`);
  log(`  ${ok(filmLen != null && Math.abs(filmLen - 16.5) < 0.6)} film unchanged`);
  log(`  ${ok(marks.phase5 != null && Math.abs(marks.phase5 - 5.2) < 0.4)} beat 0 is 5.2 s`);
  void t0;
  await shot(`${P}-after-film`);
}

// ── wave-1 regression: 60 s untouched still ends at home ─────────────────────
async function delta1() {
  log('\n== wave-1 delta 1 regression: 60 s untouched ends at home ==');
  await dismiss();
  await wait(61000);
  const s = await page.evaluate(`(() => {
    const st = window._store.getState();
    const c = window.__scene.controls;
    return {
      tmPhase: st.tmPhase, tmFocusIdx: st.tmFocusIdx, tmCaption: st.tmCaption,
      sizeMode: st.sizeMode, uiRevealed: st.uiRevealed, hintsShown: st.hintsShown,
      storyVisible: st.storyVisible,
      autoRotate: c ? c.autoRotate : null, autoRotateSpeed: c ? c.autoRotateSpeed : null,
      tmActive: window.__tm ? window.__tm.active : null,
      tmExit: window.__tm ? window.__tm.exit : null,
      ghosts: window.__ghosts ? window.__ghosts().length : null,
      assembly: window.__assembly ? window.__assembly.state() : null,
      ember: window.__fx.ember, glowSuppress: window.__fx.glowSuppress,
      camR0: +(window.__scene.camera.position.length() / (st.rawMax * 1.4)).toFixed(3),
    };
  })()`);
  log('  ' + JSON.stringify(s));
  const pass = s.tmPhase === 'idle' && s.tmFocusIdx === -1 && !s.tmCaption &&
    s.sizeMode === 'papers' && s.uiRevealed && s.hintsShown && s.autoRotate === true &&
    Math.abs(s.autoRotateSpeed - 0.3) < 1e-6 && s.ghosts === 0 &&
    s.assembly && s.assembly.active === false && s.assembly.dead === true &&
    s.assembly.inFlight === 0 && s.assembly.filaments === 0 && s.assembly.maxStretch === 1;
  log(`  ${ok(pass)} home screen, with beat 0's driver inert (active false, dead, 0 in flight)`);
  await shot(`${P}-home-after-60s`);
}

const TASKS = { seeks, firstFrame, skip, fps, reduced: reducedCheck, film, delta1 };
if (!TASKS[only]) { log(`unknown task ${only}; try: ${Object.keys(TASKS).join(', ')}`); }
else await TASKS[only]();
await browser.close();
