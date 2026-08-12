// tools/verify-wave2.mjs
// The round-7 wave-2 acceptance harness: ADDENDUM 1 section 2.4 pixel items 10
// to 12, the staircase and sweep frames, the accent channels, the measured tour
// length, and the wave-1 delta-1 regression. Headless Chrome against :5280, the
// same setup tools/verify.mjs uses (the browser pane throttles rAF, so a live
// pane cannot time any of this).
//
//   node tools/verify-wave2.mjs <task> [--mobile] [--reduced]
//
// Tasks: hivRatio, covid2020, ghosts, ghostCloseup, stairAndSweep,
//        microAndSettle, panelAndFlick, reducedCheck, tourTiming, delta1.
// Run them one at a time: each one owns the whole session's state, and `all`
// only exists for a smoke pass.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--')) || 'all';
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
const OUT = '/Users/darwin/Documents/Claude/medgalaxy-next/docs/verify';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
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

// Screen-space diameter of one node, in CSS pixels, from the live camera and
// the live radiusAt — i.e. the size actually being drawn this frame.
const DIAM = `((id) => {
  const s = window._store.getState();
  const i = s.idMap[id];
  const cam = window.__scene.camera;
  const canvas = window.__scene.canvasElement;
  const p = s.curPos[i];
  const tm = window.__tm;
  const v = new (window.__THREE ? window.__THREE.Vector3 : Object)();
  const dx = p[0]-cam.position.x, dy = p[1]-cam.position.y, dz = p[2]-cam.position.z;
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
  const r = tm && tm.active ? tm.radiusAt(i) : null;
  const h = canvas.clientHeight;
  return { r, dist, px: r == null ? null : 2 * r * h / (2 * dist * Math.tan(Math.PI/6)) };
})`;

async function forceYear(yearIdx, frames = 30) {
  await page.evaluate((y) => {
    const s = window._store.getState();
    s.setTmPhase('scrub');
    window.__tm.targetYear = y;
    window.__tm.yearFloat = y;
  }, yearIdx);
  await page.evaluate((n) => new Promise((res) => {
    let k = n; const t = () => (--k <= 0 ? res(true) : requestAnimationFrame(t)); requestAnimationFrame(t);
  }), frames);
}

// ── 10: HIV 1990 vs 2014 at one frozen camera ──
async function hivRatio() {
  log('\n== 2.4 #10: HIV 1990 vs 2014, frozen camera ==');
  await page.evaluate(() => window.__tour.seek(1));
  // Let the pause's own camera cue land before freezing: the hivSurge fly is
  // 1.30 s and the seek returns after 14 frames.
  await wait(3000);
  await page.evaluate(() => {
    const c = window.__scene.controls;
    if (c) { c.autoRotate = false; c.enabled = false; }
    window.__scene.handover.cancelled = true;
  });
  await wait(400);
  const camR = await page.evaluate(() => window.__scene.camera.position.length());
  log(`  camera radius at the HIV pause: ${camR.toFixed(0)}`);
  const cam0 = await page.evaluate(() => {
    const c = window.__scene.camera.position; return [c.x, c.y, c.z];
  });
  await forceYear(0, 40);
  const a = await page.evaluate(`${DIAM}('hiv-aids')`);
  await shot('w2-hiv-1990');
  await forceYear(24, 40); // 2014
  const b = await page.evaluate(`${DIAM}('hiv-aids')`);
  await shot('w2-hiv-2014');
  const cam1 = await page.evaluate(() => {
    const c = window.__scene.camera.position; return [c.x, c.y, c.z];
  });
  const drift = Math.hypot(cam1[0]-cam0[0], cam1[1]-cam0[1], cam1[2]-cam0[2]);
  log(`  1990: r=${a.r.toFixed(3)} -> ${a.px.toFixed(1)}px   2014: r=${b.r.toFixed(3)} -> ${b.px.toFixed(1)}px`);
  log(`  radius ratio ${(b.r/a.r).toFixed(3)}, on-screen diameter ratio ${(b.px/a.px).toFixed(3)}`);
  log(`  camera drift between the two shots: ${drift.toFixed(4)} units`);
  log(`  ${b.px/a.px >= 2.50 ? 'PASS' : 'FAIL'} (>= 2.50)`);
}

// ── 11: COVID is the largest silhouette in 2020 ──
async function covid2020() {
  log(`\n== 2.4 #11: COVID largest silhouette in 2020 (${mobile ? 'mobile' : 'desktop'}) ==`);
  await page.evaluate(() => window.__tour.seek(3));
  await wait(1400);
  const res = await page.evaluate(`(() => {
    const s = window._store.getState();
    const cam = window.__scene.camera, canvas = window.__scene.canvasElement;
    const rows = [];
    for (let i = 0; i < s.diseases.length; i++) {
      const p = s.curPos[i];
      const dx=p[0]-cam.position.x, dy=p[1]-cam.position.y, dz=p[2]-cam.position.z;
      const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
      const r = window.__tm.radiusAt(i);
      rows.push({ id: s.diseases[i].id, r, px: 2*r*canvas.clientHeight/(2*dist*Math.tan(Math.PI/6)) });
    }
    const byR = [...rows].sort((a,b)=>b.r-a.r);
    const byPx = [...rows].sort((a,b)=>b.px-a.px);
    return { year: Math.round(window.__tm.yearFloat) + window.__tm.data.yearStart,
             topR: byR.slice(0,3), topPx: byPx.slice(0,3) };
  })()`);
  log(`  year ${res.year}`);
  log(`  by radius:    ${res.topR.map(r=>`${r.id} ${r.r.toFixed(2)}`).join(' | ')}`);
  log(`  by silhouette: ${res.topPx.map(r=>`${r.id} ${r.px.toFixed(1)}px`).join(' | ')}`);
  const ok = res.topR[0].id === 'covid-19' && res.topPx[0].id === 'covid-19';
  log(`  ${ok ? 'PASS' : 'FAIL'} (largest by both)`);
  await shot(mobile ? 'w2-2020-covid-mobile' : 'w2-2020-covid');
}

// ── 12: three shells at crossing + 200 ms, none at + 600 ms ──
async function ghosts() {
  log('\n== 2.4 #12: ghost shells at crossing +200 ms and +600 ms ==');
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.introStarted || s.introPhase < 5) s.skipIntro();
    if (window.__scene.introScales) window.__scene.introScales.fill(1);
    if (!s.overtureDone) s.finishOverture();
    window._store.getState().startTimeMachine(false);
  });
  await wait(1400);

  // Anchored on the crossing itself, not on the frame the target was set:
  // the scrub's own 120 ms spring takes ~200 ms to carry the field past the
  // half-year mark, which is where gate G1 fires.
  const probe = async (fromY, toY) => {
    await forceYear(fromY, 30);
    await wait(700);
    return page.evaluate((to) => new Promise((res) => {
      const out = { crossAt: null, peak: 0, rate: null, at200: null, at600: null };
      const t0 = performance.now();
      window.__tm.targetYear = to;
      const tick = () => {
        const t = performance.now() - t0;
        const g = window.__ghosts ? window.__ghosts() : [];
        if (g.length && out.crossAt === null) {
          out.crossAt = t;
          out.rate = window.__tm.rate;
        }
        if (g.length > out.peak) out.peak = g.length;
        if (out.crossAt !== null) {
          const age = t - out.crossAt;
          if (out.at200 === null && age >= 200) {
            out.at200 = { n: g.length, alphas: g.map((x) => +x.alpha.toFixed(3)) };
          }
          if (age >= 600) { out.at600 = g.length; res(out); return; }
        }
        if (t > 4000) { res(out); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), toY);
  };

  for (const [a, b, label] of [[29, 30, '2019 -> 2020 (growth)'], [31, 32, '2021 -> 2022 (shrinkage)']]) {
    const r = await probe(a, b);
    log(`  ${label}: ${r.peak} shells at rate ${r.rate && r.rate.toFixed(2)} yr/s, crossing at +${Math.round(r.crossAt)} ms`);
    log(`    +200ms: ${JSON.stringify(r.at200)}   +600ms: ${r.at600} live`);
  }

  // The two frames, on the tour's own detonation step: COVID's shell is held at
  // 0.68 against a 20.75 node (30x), pneumonia's at 11.41 against 18.83 (1.65x)
  // and ARDS's at 2.49 against 6.58 (2.64x) — the clearest read in the table.
  await forceYear(29, 30);
  await wait(700);
  const held = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    window.__tm.targetYear = 30;
    let crossAt = null;
    const tick = () => {
      const t = performance.now() - t0;
      const g = window.__ghosts ? window.__ghosts() : [];
      if (g.length && crossAt === null) crossAt = t;
      // Fire the capture early: the screenshot lands about 120 ms later, so the
      // frame on disk is the one at crossing + 200 ms.
      if (crossAt !== null && t - crossAt >= 80) { res({ n: g.length }); return; }
      if (t > 3000) { res({ n: -1, y: window.__tm.yearFloat, tgt: window.__tm.targetYear, rate: window.__tm.rate, phase: window._store.getState().tmPhase, hook: typeof window.__ghosts, settles: window.__tm.settles.length, crossSeen: crossAt }); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const beforeShot = await page.evaluate(() => (window.__ghosts ? window.__ghosts().map((g) => Math.round(g.age)) : []));
  await shot('w2-ghosts-mid');
  // A crop around the three movers, so the shells are legible at 1:1 rather
  // than three faint rings inside a 1440-wide frame.
  const box = await page.evaluate(() => {
    const s = window._store.getState();
    const cam = window.__scene.camera, canvas = window.__scene.canvasElement;
    const ids = ['covid-19', 'pneumonia', 'acute-respiratory-distress'];
    const pts = ids.map((id) => {
      const i = s.idMap[id]; const p = s.curPos[i];
      const v = { x: p[0], y: p[1], z: p[2] };
      const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
      const e = m.elements;
      const w = e[3]*v.x + e[7]*v.y + e[11]*v.z + e[15];
      const nx = (e[0]*v.x + e[4]*v.y + e[8]*v.z + e[12]) / w;
      const ny = (e[1]*v.x + e[5]*v.y + e[9]*v.z + e[13]) / w;
      return { x: (nx*0.5+0.5)*canvas.clientWidth, y: (-ny*0.5+0.5)*canvas.clientHeight };
    });
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    return { x: Math.max(0, Math.min(...xs)-90), y: Math.max(0, Math.min(...ys)-90),
             w: Math.max(...xs)-Math.min(...xs)+180, h: Math.max(...ys)-Math.min(...ys)+180 };
  });
  await page.screenshot({ path: `${OUT}/w2-ghosts-mid-crop.png`,
    clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.w), height: Math.round(box.h) } });
  log('  shot w2-ghosts-mid-crop.png');
  const afterShot = await page.evaluate(() => (window.__ghosts ? window.__ghosts().map((g) => Math.round(g.age)) : []));
  log(`  w2-ghosts-mid: ${JSON.stringify(held)} shells at the +200 ms mark; ages ${JSON.stringify(beforeShot)} -> ${JSON.stringify(afterShot)} across the capture`);
  await wait(500);
  await shot('w2-ghosts-gone');
  const after = await page.evaluate(() => (window.__ghosts ? window.__ghosts().length : -1));
  log(`  w2-ghosts-gone: ${after} live`);
}

// ── the staircase and the sweep, on the real tour clock ──
async function stairAndSweep() {
  log('\n== staircase dwell + sweep numeral ==');
  const numeral = async () => page.evaluate(() => {
    const n = document.querySelector('[data-mg-rail-numeral]');
    const cs = n ? getComputedStyle(n) : null;
    return {
      year: n ? n.innerText.replace(/\s/g, '') : null,
      opacity: cs ? cs.opacity : null,
      filter: cs ? cs.filter : null,
      rate: +(window.__tm.rate || 0).toFixed(2),
      y: +window.__tm.yearFloat.toFixed(3),
    };
  });

  // Seek the 1996 pause and let it run: the 1996 -> 2019 leg is the tour's one
  // long leg, a 1.30 s sweep of 17 years followed by six 360 ms stairs.
  await page.evaluate(() => window.__tour.seek(1));
  await wait(900);
  await page.evaluate(() => window.__tour.resume());

  const waitFor = (expr, limit = 12000) => page.evaluate((e, lim) => new Promise((res) => {
    const t0 = performance.now();
    const fn = new Function('return (' + e + ')');
    const tick = () => {
      if (fn()) { res(true); return; }
      if (performance.now() - t0 > lim) { res(false); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), expr, limit);

  const sawSweep = await waitFor('window.__tm.rate > 4');
  const midSweep = await numeral();
  await shot('w2-sweep');
  const afterSweep = await numeral();
  log(`  sweep reached: ${sawSweep}`);
  log(`  at the shot: ${JSON.stringify(midSweep)} -> ${JSON.stringify(afterSweep)}`);

  // The first dwell after the sweep: the numeral restores at the first stair.
  const sawStair = await waitFor('window.__tm.rate > 0 && window.__tm.rate < 4');
  const inStair = await numeral();
  await shot('w2-staircase');
  const afterStair = await numeral();
  log(`  first stair reached: ${sawStair}`);
  log(`  at the shot: ${JSON.stringify(inStair)} -> ${JSON.stringify(afterStair)}`);

  // And the dwell itself, sampled rather than shot: 120 ms of a still year.
  const dwells = await page.evaluate(() => new Promise((res) => {
    const out = []; const t0 = performance.now(); let cur = null;
    const tick = () => {
      const t = performance.now() - t0;
      const r = window.__tm.rate || 0;
      const y = window.__tm.yearFloat;
      if (r === 0 && Math.abs(y - Math.round(y)) < 1e-6) {
        if (!cur) cur = { year: Math.round(y), t0: t };
        cur.t1 = t;
      } else if (cur) { out.push({ year: cur.year, ms: Math.round(cur.t1 - cur.t0) }); cur = null; }
      if (t > 2600) { if (cur) out.push({ year: cur.year, ms: Math.round(cur.t1 - cur.t0) }); res(out); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  log(`  measured dwells: ${JSON.stringify(dwells)}`);
}

// ── natural tour timing ──
async function tourTiming() {
  log('\n== tour length, measured on the wall clock ==');
  const r = await page.evaluate(() => new Promise((res) => {
    const s = window._store.getState();
    s.setTmFocusIdx(-1);
    s.startTimeMachine(true);
    const t0 = performance.now();
    let exitAt = null;
    const tick = () => {
      const st = window._store.getState();
      if (st.tmExitAt && exitAt === null) exitAt = performance.now() - t0;
      if (exitAt !== null && st.tmPhase === 'idle' && performance.now() - t0 > exitAt + 3000) {
        res({ exitAt, total: performance.now() - t0, phase: st.tmPhase });
        return;
      }
      if (performance.now() - t0 > 45000) { res({ exitAt, total: -1 }); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  log(`  tour ran ${(r.exitAt / 1000).toFixed(2)} s before the exit opened (boarded 30.30, gate 31.0)`);
  log(`  ${r.exitAt / 1000 <= 31.0 ? 'PASS' : 'FAIL'}`);
}

// ── wave-1 regression: 60 s untouched ──
async function delta1() {
  log('\n== wave-1 delta 1 regression: 60 s untouched ==');
  await page.evaluate(() => window._store.getState().setIntroStarted(true));
  const marks = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    const out = { tourAt: null, exitAt: null, homeAt: null };
    const tick = () => {
      const s = window._store.getState();
      const t = performance.now() - t0;
      if (out.tourAt === null && s.tmPhase === 'tour') out.tourAt = t;
      if (out.exitAt === null && s.tmExitAt) out.exitAt = t;
      if (out.homeAt === null && out.exitAt !== null && s.tmPhase === 'idle'
          && s.storyVisible && !window.__tm.active) out.homeAt = t;
      if (t >= 60000) { res(out); return; }
      setTimeout(tick, 60);
    };
    tick();
  }));
  const state = await page.evaluate(() => {
    const s = window._store.getState();
    const c = window.__scene.controls;
    return {
      tmPhase: s.tmPhase, tmFocusIdx: s.tmFocusIdx, tmCaption: s.tmCaption,
      sizeMode: s.sizeMode, uiRevealed: s.uiRevealed, hintsShown: s.hintsShown,
      storyVisible: s.storyVisible,
      autoRotate: c ? c.autoRotate : null, speed: c ? c.autoRotateSpeed : null,
      tmActive: window.__tm.active, tmExit: window.__tm.exit,
      ghosts: window.__ghosts ? window.__ghosts().length : 0,
      settles: window.__tm.settles.length, rate: window.__tm.rate,
      glow: window.__fx.glowSuppress, ember: window.__fx.ember,
    };
  });
  log(`  tour opened ${(marks.tourAt / 1000).toFixed(1)} s, exit ${(marks.exitAt / 1000).toFixed(1)} s, home ${(marks.homeAt / 1000).toFixed(1)} s`);
  log(`  ${JSON.stringify(state)}`);
  const ok = state.tmPhase === 'idle' && state.tmFocusIdx === -1 && state.tmCaption === null
    && state.sizeMode === 'papers' && state.uiRevealed && state.hintsShown && state.storyVisible
    && state.autoRotate === true && Math.abs(state.speed - 0.3) < 1e-6
    && state.tmActive === false && state.ghosts === 0 && state.settles === 0;
  log(`  ${ok ? 'PASS' : 'FAIL'}`);
  await shot('w2-home-after-60s');
}

// A close look at one ghost, so the shell is a shape on disk rather than a
// claim: the camera seats on pneumonia, whose 2019 -> 2020 shell is held at
// 11.41 against an 18.83 node.
async function ghostCloseup() {
  log('\n== ghost shell, close ==');
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.introStarted || s.introPhase < 5) s.skipIntro();
    if (window.__scene.introScales) window.__scene.introScales.fill(1);
    if (!s.overtureDone) s.finishOverture();
    window._store.getState().startTimeMachine(false);
  });
  await wait(1400);
  await forceYear(29, 30);
  await page.evaluate(() => {
    const s = window._store.getState();
    const i = s.idMap.pneumonia;
    const p = s.curPos[i];
    const cam = window.__scene.camera;
    const c = window.__scene.controls;
    if (c) { c.autoRotate = false; c.enabled = false; }
    window.__scene.handover.cancelled = true;
    window._store.getState().setFlyTarget(null);
    cam.position.set(p[0], p[1], p[2] + 120);
    cam.lookAt(p[0], p[1], p[2]);
    cam.updateMatrixWorld();
  });
  await wait(600);
  const geom = await page.evaluate(() => {
    const s = window._store.getState();
    const i = s.idMap.pneumonia;
    const cam = window.__scene.camera, canvas = window.__scene.canvasElement;
    const p = s.curPos[i];
    const d = Math.hypot(p[0]-cam.position.x, p[1]-cam.position.y, p[2]-cam.position.z);
    const px = (r) => 2*r*canvas.clientHeight/(2*d*Math.tan(Math.PI/6));
    return { ghost: px(11.41), node: px(18.83) };
  });
  log(`  pneumonia on screen: ghost ${geom.ghost.toFixed(0)}px, node ${geom.node.toFixed(0)}px`);
  await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    window.__tm.targetYear = 30;
    let crossAt = null;
    const tick = () => {
      const t = performance.now() - t0;
      const g = window.__ghosts ? window.__ghosts() : [];
      if (g.length && crossAt === null) crossAt = t;
      if (crossAt !== null && t - crossAt >= 40) { res(true); return; }
      if (t > 3000) { res(false); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await page.screenshot({ path: `${OUT}/w2-ghost-closeup.png`, clip: { x: 470, y: 200, width: 500, height: 500 } });
  const age = await page.evaluate(() => (window.__ghosts ? window.__ghosts().map((g) => Math.round(g.age)) : []));
  log(`  shot w2-ghost-closeup.png, shell ages ${JSON.stringify(age)}`);
}

// Reduced motion: the shells become a single 300 ms dissolve and the rings,
// settles and micro-labels are dropped entirely. The three are one branch in
// the engine, so the settle count is the assertion for all three.
async function reducedCheck() {
  log('\n== reduced motion ==');
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.introStarted || s.introPhase < 5) s.skipIntro();
    if (window.__scene.introScales) window.__scene.introScales.fill(1);
    if (!s.overtureDone) s.finishOverture();
    window._store.getState().startTimeMachine(false);
  });
  await wait(1400);
  await forceYear(29, 30);
  await wait(700);
  const r = await page.evaluate(() => new Promise((res) => {
    const out = { peak: 0, crossAt: null, maxSettles: 0, label: 'none', at200: null, at320: null, gone: null };
    const t0 = performance.now();
    window.__tm.targetYear = 30;
    const tick = () => {
      const t = performance.now() - t0;
      const g = window.__ghosts ? window.__ghosts() : [];
      if (g.length && out.crossAt === null) out.crossAt = t;
      if (g.length > out.peak) out.peak = g.length;
      out.maxSettles = Math.max(out.maxSettles, window.__tm.settles.length);
      const el = document.querySelector('[data-mg-mover-label]');
      if (el && el.style.display !== 'none' && el.style.opacity !== '0') out.label = 'shown';
      if (out.crossAt !== null) {
        const age = t - out.crossAt;
        if (out.at200 === null && age >= 200) out.at200 = g.length;
        if (out.at320 === null && age >= 320) { out.at320 = g.length; }
        if (age >= 700) { out.gone = g.length; res(out); return; }
      }
      if (t > 4000) { res(out); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  log(`  shells lit ${r.peak}; at +200ms ${r.at200} live, at +320ms ${r.at320} live (300 ms dissolve), at +700ms ${r.gone}`);
  log(`  settles ever live: ${r.maxSettles} (rings and settles and micro-labels all dropped by the same branch)`);
  log(`  micro-label: ${r.label}`);
  log(`  ${r.maxSettles === 0 && r.label === 'none' && r.at320 === 0 && r.peak > 0 ? 'PASS' : 'FAIL'}`);
}

// Accents 3, 4 and 5: the settle returns to exactly the mapping, the numeral
// pip doubles on a ring step, and the micro-label waits out its 360 ms dwell.
async function microAndSettle() {
  log('\n== accents 3, 4, 5 ==');
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.introStarted || s.introPhase < 5) s.skipIntro();
    if (window.__scene.introScales) window.__scene.introScales.fill(1);
    if (!s.overtureDone) s.finishOverture();
    window._store.getState().startTimeMachine(false);
  });
  await wait(1400);
  await forceYear(29, 30);
  await wait(700);
  const r = await page.evaluate(() => new Promise((res) => {
    const s = window._store.getState();
    const ci = s.idMap['covid-19'];
    const tm = window.__tm;
    const n = s.diseases.length;
    // The mapping without the accent: the same interpolation radiusAt does,
    // minus the settle multiplier. Their ratio IS the settle.
    const mapped = () => {
      const yf = Math.max(0, Math.min(tm.data.nYears - 1, tm.yearFloat));
      const y0 = Math.floor(yf), y1 = Math.min(tm.data.nYears - 1, y0 + 1);
      const r0 = tm.data.radii[y0 * n + ci], r1 = tm.data.radii[y1 * n + ci];
      return r0 + (r1 - r0) * (yf - y0);
    };
    const out = { peakMul: 1, minMul: Infinity, settleMs: null, endMul: null, label: null,
                  pip: [], blurFrames: 0, crossAt: null };
    const t0 = performance.now();
    tm.targetYear = 30;
    let settleStart = null;
    const numeral = document.querySelector('[data-mg-rail-numeral]');
    const tick = () => {
      const t = performance.now() - t0;
      if (tm.settles.length && settleStart === null) settleStart = t;
      const mul = tm.radiusAt(ci) / mapped();
      if (mul > out.peakMul) out.peakMul = mul;
      if (mul < out.minMul) out.minMul = mul;
      if (numeral && numeral.style.filter && numeral.style.filter !== 'none') {
        out.pip.push(numeral.style.filter);
        if (numeral.style.filter.indexOf('blur') >= 0) out.blurFrames++;
      }
      const el = document.querySelector('[data-mg-mover-label]');
      if (el && el.style.display !== 'none' && el.textContent && out.label === null) {
        out.label = { text: el.textContent, at: Math.round(t), font: getComputedStyle(el).fontSize };
      }
      if (t > 950) {
        out.settleMs = settleStart;
        out.endMul = tm.radiusAt(ci) / mapped();
        out.settlesLeft = tm.settles.length;
        res(out);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  log(`  settle multiplier: peak ${r.peakMul.toFixed(5)} (spec 1.045 at rank 1), floor ${r.minMul.toFixed(5)}, settled back to ${r.endMul.toFixed(12)}`);
  log(`  settles still live at +0.95 s: ${r.settlesLeft}`);
  log(`  numeral pip frames: ${JSON.stringify([...new Set(r.pip)])} x${r.pip.length}, of which blur ${r.blurFrames}`);
  log(`  micro-label: ${JSON.stringify(r.label)}`);
  await shot('w2-mover-label');
}

// The methodology panel's new subsection, and the flick end of the numeral gate.
async function panelAndFlick() {
  log('\n== methodology subsection + flick dim ==');
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.introStarted || s.introPhase < 5) s.skipIntro();
    if (window.__scene.introScales) window.__scene.introScales.fill(1);
    if (!s.overtureDone) s.finishOverture();
  });
  await wait(600);
  await page.evaluate(() => window._store.getState().setMethodologyOpen(true));
  await wait(500);
  const sect = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')];
    const h = els.find((e) => e.textContent.trim() === 'Time Machine size mapping' && e.children.length === 0);
    if (!h) return null;
    h.scrollIntoView({ block: 'center' });
    const body = h.parentElement.querySelectorAll('div');
    return { heading: h.textContent, text: [...body].map((d) => d.textContent).join(' ').slice(0, 700) };
  });
  log(`  heading: ${sect && sect.heading}`);
  log(`  copy: ${sect && sect.text}`);
  await wait(400);
  await shot('w2-methodology-tm');
  await page.evaluate(() => window._store.getState().setMethodologyOpen(false));
  await wait(300);

  // The flick end of the gate: the numeral dims and no accent fires.
  await page.evaluate(() => window._store.getState().startTimeMachine(false));
  await wait(1200);
  await forceYear(34, 20);
  await wait(600);
  const flick = await page.evaluate(() => new Promise((res) => {
    const out = { maxRate: 0, blur: 0, crisp: 0, ghosts: 0, settles: 0 };
    const t0 = performance.now();
    window.__tm.targetYear = 0; // the whole rail in one throw
    const n = document.querySelector('[data-mg-rail-numeral]');
    const tick = () => {
      const t = performance.now() - t0;
      out.maxRate = Math.max(out.maxRate, window.__tm.rate || 0);
      if (n && n.style.filter && n.style.filter.indexOf('blur') >= 0) out.blur++; else out.crisp++;
      out.ghosts = Math.max(out.ghosts, window.__ghosts ? window.__ghosts().length : 0);
      out.settles = Math.max(out.settles, window.__tm.settles.length);
      if (t > 2000) { out.endRate = window.__tm.rate; out.endFilter = n ? n.style.filter : null; res(out); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  log(`  flick across 34 years: peak rate ${flick.maxRate.toFixed(1)} yr/s, blurred ${flick.blur} frames, crisp ${flick.crisp}`);
  log(`  accents during the flick: ${flick.ghosts} ghosts, ${flick.settles} settles`);
  log(`  after it settles: rate ${flick.endRate && flick.endRate.toFixed(3)}, filter ${JSON.stringify(flick.endFilter)}`);
}

const tasks = { hivRatio, panelAndFlick, microAndSettle, reducedCheck, ghostCloseup, covid2020, ghosts, stairAndSweep, tourTiming, delta1 };
if (only === 'all') { for (const k of Object.keys(tasks)) await tasks[k](); }
else await tasks[only]();
await browser.close();
