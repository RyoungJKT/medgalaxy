// tools/verify-wave4.mjs
// The round-7 wave-4 acceptance harness: ADDENDUM 1 section 4 (the five ambient
// upgrades) plus delta-list item 4. Headless Chrome against :5280, the same
// setup tools/verify.mjs, verify-wave2.mjs and verify-wave3.mjs use — the
// browser pane throttles rAF to a stop between screenshots, so a live pane can
// time none of this.
//
//   node tools/verify-wave4.mjs <task> [--mobile] [--reduced] [--headed]
//
// Tasks: breathe, stars, hiv, microbreathe, shimmer, fps.
// Run them one at a time: each owns the whole session's state.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--')) || 'breathe';
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
const headed = args.includes('--headed');
const OUT = '/Users/darwin/Documents/Claude/medgalaxy-next/docs/verify';
const P = mobile ? 'w4m' : 'w4';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: headed ? false : 'new',
  args: [`--window-size=${mobile ? '375,812' : '1440,900'}`, '--use-gl=angle'],
});
const page = await browser.newPage();
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

const CAM = `(() => {
  const c = window.__scene.camera.position;
  const st = window._store.getState();
  return { p: [c.x, c.y, c.z], R0: st.rawMax * (window.innerWidth < 768 ? 2.4 : 1.4) };
})()`;

// Screen-space diameter of one node, in CSS pixels, off the LIVE instance
// matrix (what is actually being drawn this frame) and the live camera.
const DIAM = `((id) => {
  const s = window._store.getState();
  const i = s.idMap[id];
  const cam = window.__scene.camera;
  const canvas = window.__scene.canvasElement;
  const m = window.__scene.instancedMesh.instanceMatrix.array;
  const o = i * 16;
  const r = Math.hypot(m[o], m[o+1], m[o+2]);
  const dx = m[o+12]-cam.position.x, dy = m[o+13]-cam.position.y, dz = m[o+14]-cam.position.z;
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
  const h = canvas.clientHeight;
  return { r, dist, px: 2 * r * h / (2 * dist * Math.tan(cam.fov * Math.PI / 360)) };
})`;

const dismiss = () => page.evaluate(() => {
  const el = document.querySelector('[style*="z-index: 200"], [style*="zIndex: 200"]');
  if (el) el.click();
  else window._store.getState().setIntroStarted();
});

// ── delta-4: nothing on screen is ever perfectly still ───────────────────────
// "Two shots 1.5 s apart during the 2020 pause differ in camera position by
// more than 0.2 percent and less than 1.0 percent of R0; beat 2's ignition hold
// differs by exactly 0, because that stillness is directed."
async function breathe() {
  log('\n== delta 4: camera breathing on the holds, stillness where it is directed ==');
  const d = (a, b, R0) => Math.hypot(a.p[0]-b.p[0], a.p[1]-b.p[1], a.p[2]-b.p[2]) / R0 * 100;

  // (a) The acceptance as written: the real 2020 pause, on a played tour. The
  // detonation's push-in lands 0.65 s before the hold opens and the hold is
  // 4.0 s, so the two shots sit 1.5 s apart inside it with nothing else on the
  // camera — no autoRotate either, since every camera cue re-arms the rig's
  // idle counter and the pause is far shorter than its 5 s threshold.
  await dismiss();
  await page.waitForFunction('window._store.getState().overtureDone === true', { timeout: 40000 });
  await page.waitForFunction('window._store.getState().tmPhase === "tour"', { timeout: 20000 });
  await page.waitForFunction(() => {
    const st = window.__tour.state();
    return st.year != null && st.year >= 2019.999;
  }, { timeout: 90000, polling: 50 });
  await wait(600);
  const p0 = await page.evaluate(CAM);
  await shot(`${P}-breathe-2020-a`);
  await wait(1500);
  const p1 = await page.evaluate(CAM);
  await shot(`${P}-breathe-2020-b`);
  const played = d(p0, p1, p0.R0);
  const rotating = await page.evaluate('window.__scene.controls.autoRotate');
  log(`  2020 pause (played), two shots 1.5 s apart: ${played.toFixed(3)}% of R0  ` +
      `[camera ${(Math.hypot(...p0.p) / p0.R0).toFixed(2)} R0, autoRotate ${rotating}]`);
  log(`  ${ok(played > 0.2 && played < 1.0)} inside (0.2%, 1.0%) of R0`);

  // (b) The same channel isolated: the pause frozen by a seek, with the rig's
  // rest rotation zeroed, so three consecutive gaps measure the breathing and
  // nothing else. A frozen pause outlives the rig's 5 s idle threshold, which
  // a real 4.0 s hold never does.
  await page.evaluate(() => window.__tour.seek(3));
  await wait(2600);
  await page.evaluate(() => { window.__scene.controls.autoRotateSpeed = 0; });
  await wait(400);
  const samples = [];
  for (let k = 0; k < 4; k++) {
    samples.push(await page.evaluate(CAM));
    if (k < 3) await wait(1500);
  }
  const R0 = samples[0].R0;
  const pairs = [d(samples[0], samples[1], R0), d(samples[1], samples[2], R0), d(samples[2], samples[3], R0)];
  log(`  2020 pause (frozen, rest rotation off), three 1.5 s gaps: ${pairs.map((x) => x.toFixed(3) + '%').join('  ')} of R0  ` +
      `[camera ${(Math.hypot(...samples[0].p) / R0).toFixed(2)} R0]`);
  // Diagnostic band, not the acceptance: with the pause frozen and every other
  // channel removed, what is left is three incommensurate sinusoids, and a
  // 1.5 s window that happens to straddle a common turning point reads lower
  // than one that does not. The acceptance is (a) above, at the real pause.
  log(`  ${ok(pairs.every((x) => x > 0.1 && x < 1.0))} the isolated channel stays inside (0.1%, 1.0%) of R0 at every phase`);

  // The directed stillness: beat 2's ignition hold. The seek freezes the film's
  // own clock at the hero moment; the camera must not move at all.
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction('window._store !== undefined', { timeout: 20000 });
  await dismiss();
  await page.evaluate(() => window.__overture.seek(9.6));
  await wait(1200);
  const a = await page.evaluate(CAM);
  await shot(`${P}-breathe-ignition`);
  await wait(1500);
  const b = await page.evaluate(CAM);
  const dd = Math.hypot(a.p[0]-b.p[0], a.p[1]-b.p[1], a.p[2]-b.p[2]);
  log(`  beat 2 ignition hold, 1.5 s apart: |delta| = ${dd} world units (${(dd / a.R0 * 100).toFixed(6)}% of R0)`);
  log(`  ${ok(dd === 0)} exactly 0`);
}

// ── section 4 item 2: three star shells, depth from motion ───────────────────
async function stars() {
  log('\n== section 4.2: star parallax, three shells ==');
  await dismiss();
  // LOW's particle budget is 0 and stays 0 (section 4 item 2), so on a phone
  // there is nothing to measure and that is the acceptance.
  const budget = await page.evaluate(
    '(window.__scene.starShells || []).length',
  );
  if (!budget) {
    log(`  ${ok(mobile)} 0 shells: LOW's particle budget is 0 and stays 0`);
    await shot(`${P}-stars-none`);
    return;
  }
  // Beat 0's seat is the deepest the camera ever sits (2.9 R0), so it is where
  // the far plane is tested: a star clipped there is a hole in the backdrop on
  // the one frame with nothing else in it.
  await wait(600);
  const clipped = await page.evaluate(`(() => {
    const cam = window.__scene.camera;
    const st = window._store.getState();
    const R0 = st.rawMax * (window.innerWidth < 768 ? 2.4 : 1.4);
    let beyond = 0, total = 0, worst = 0;
    for (const g of (window.__scene.starShells || [])) {
      const pts = g.children[0];
      const a = pts.geometry.getAttribute('position').array;
      for (let i = 0; i < a.length; i += 3) {
        total++;
        const d = Math.hypot(a[i] - cam.position.x, a[i+1] - cam.position.y, a[i+2] - cam.position.z);
        if (d > worst) worst = d;
        if (d > cam.far) beyond++;
      }
    }
    return { beyond, total, worst: worst / R0, far: cam.far / R0, camR0: cam.position.length() / R0 };
  })()`);
  log(`  at the beat-0 seat (${clipped.camR0.toFixed(2)} R0): ${clipped.beyond}/${clipped.total} stars beyond the ` +
      `${clipped.far.toFixed(2)} R0 far plane (furthest is ${clipped.worst.toFixed(2)} R0 away)`);
  log(`  ${ok(clipped.beyond === 0)} the whole star field is inside the far plane from the deepest seat`);
  await shot(`${P}-stars-assembly`);
  // Then the rest seat, where the viewer spends the session.
  await page.evaluate(() => {
    const s = window._store.getState();
    if (!s.overtureDone) s.finishOverture();
  });
  await wait(2500);
  const cfg = await page.evaluate(`(() => {
    const sh = window.__scene.starShells || [];
    const st = window._store.getState();
    const R0 = st.rawMax * (window.innerWidth < 768 ? 2.4 : 1.4);
    const cam = window.__scene.camera;
    return {
      tier: window.__scene.starShells && window.__scene.starShells[0].children[0].material.type,
      far: cam.far / R0, camR0: cam.position.length() / R0,
      shells: sh.map((g) => {
        const pts = g.children[0];
        const a = pts.geometry.getAttribute('position').array;
        let min = 1e9, max = 0;
        for (let i = 0; i < a.length; i += 3) {
          const d = Math.hypot(a[i], a[i+1], a[i+2]);
          if (d < min) min = d; if (d > max) max = d;
        }
        return {
          n: pts.geometry.getAttribute('position').count,
          rMin: +(min / R0).toFixed(2), rMax: +(max / R0).toFixed(2),
          shader: pts.material.type, size: pts.material.uniforms
            ? pts.material.uniforms.uSize.value : pts.material.size,
        };
      }),
    };
  })()`);
  log(`  tier ${cfg.tier}, camera far plane ${cfg.far.toFixed(2)} R0, camera at ${cfg.camR0.toFixed(2)} R0`);
  for (const s of cfg.shells) {
    log(`   shell: ${s.n} points at ${s.rMin}..${s.rMax} R0, size ${s.size}, material ${s.shader}`);
  }
  const worst = Math.max(...cfg.shells.map((s) => s.rMax)) + cfg.camR0;
  log(`  ${ok(worst < cfg.far)} furthest star is ${worst.toFixed(2)} R0 from the rest camera, inside the ${cfg.far.toFixed(2)} R0 far plane`);

  // Depth from motion: orbit the camera by a fixed angle and measure how far
  // each shell's sample point travels across the screen. Nearer shells must
  // travel further — that differential IS the parallax.
  const probe = `((deg) => {
    const cam = window.__scene.camera;
    const V3 = cam.position.constructor;
    if (deg) {
      const a = deg * Math.PI / 180;
      const x = cam.position.x, z = cam.position.z;
      cam.position.x = x * Math.cos(a) - z * Math.sin(a);
      cam.position.z = x * Math.sin(a) + z * Math.cos(a);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
    }
    // Every point of every shell, projected. Off-screen and behind-camera
    // points are marked rather than dropped, so the two passes stay index
    // aligned and only stars visible in BOTH frames are compared.
    const w = window.innerWidth, h = window.innerHeight;
    return (window.__scene.starShells || []).map((g) => {
      const pts = g.children[0];
      const arr = pts.geometry.getAttribute('position').array;
      const out = [];
      for (let i = 0; i < arr.length; i += 3) {
        const v = new V3(arr[i], arr[i+1], arr[i+2]).applyMatrix4(pts.matrixWorld).project(cam);
        const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
        out.push([(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, onScreen ? 1 : 0]);
      }
      return out;
    });
  })`;
  await page.evaluate(() => {
    const c = window.__scene.controls;
    if (c) { c.autoRotate = false; c.enabled = false; }
    window.__scene.handover.cancelled = true;
  });
  await wait(300);
  await shot(`${P}-stars-a`);
  const before = await page.evaluate(`${probe}(0)`);
  const after = await page.evaluate(`${probe}(10)`);
  await wait(300);
  await shot(`${P}-stars-b`);
  // How far a star sweeps across an orbit depends on where in the frame it sits
  // (a star near the rotation axis barely moves whatever shell it is on), so
  // the sample is restricted to the middle of the frame — the same patch of sky
  // for all three shells — and the median is taken rather than the mean, so one
  // straggler near the edge cannot carry a shell.
  const cx = mobile ? 187 : 720, cy = mobile ? 406 : 450;
  const travel = before.map((pts, si) => {
    const d = [];
    for (let k = 0; k < pts.length; k++) {
      if (!pts[k][2] || !after[si][k][2]) continue; // must be in frame in both
      if (Math.hypot(pts[k][0] - cx, pts[k][1] - cy) > 320) continue;
      d.push(Math.hypot(pts[k][0] - after[si][k][0], pts[k][1] - after[si][k][1]));
    }
    d.sort((a, b) => a - b);
    return { px: d.length ? d[Math.floor(d.length / 2)] : 0, n: d.length };
  });
  log(`  10 degree orbit, median screen travel per shell (frame centre): ` +
      travel.map((t) => `${t.px.toFixed(1)}px (${t.n} stars in frame)`).join('  '));
  // The camera orbits the origin rather than translating past the field, so the
  // sign of the differential is the opposite of walk-past parallax: a shell at
  // infinity would sweep the full 10 degrees of view (150px here) and the near
  // shell, which the camera is orbiting *inside*, sweeps least. What matters is
  // that the three rates are separated at all — a single shell is a painted
  // backdrop, three that move at visibly different rates read as depth.
  const monotone = travel.every((t, i) => i === 0 || t.px > travel[i - 1].px);
  const spread = travel[2].px / Math.max(1e-9, travel[0].px);
  log(`  separation between the near and far shells: ${spread.toFixed(2)}x`);
  log(`  ${ok(monotone && travel.length === 3 && spread > 1.3 && travel.every((t) => t.n >= 4))} ` +
      `three distinct rates, monotone in shell radius (depth reads from motion)`);
}

// ── carried note: the HIV pause has to frame its own growth ──────────────────
async function hiv() {
  log('\n== carried note (wave 2/3): HIV framing at the tour pauses ==');
  // Measured on the PLAYED tour, not on a seek: the framing at a pause is the
  // sum of every leg dolly and every earlier push-in the camera inherited on
  // the way there, and a seek replays only the last camera cue. This is the
  // frame the viewer actually sits in front of.
  await dismiss();
  await page.waitForFunction('window._store.getState().overtureDone === true', { timeout: 40000 });
  await page.waitForFunction('window._store.getState().tmPhase === "tour"', { timeout: 20000 });
  // The tour opens on a rewind from wherever the galaxy stands (2024) back to
  // 1990, so wait that out before treating a year as a pause.
  await page.waitForFunction(() => {
    const st = window.__tour.state();
    return st.year != null && st.year <= 1990.001;
  }, { timeout: 30000, polling: 50 });
  // The year is a step function of the tour clock and each pause year is
  // reached exactly once, so "the field is standing on 1996" is the pause.
  const atYear = async (y, into) => {
    await page.waitForFunction((yy) => {
      const st = window.__tour.state();
      return st.year != null && st.year >= yy - 0.001;
    }, { timeout: 90000, polling: 50 }, y);
    await wait(into * 1000);
  };
  for (const [pi, label, yr] of [[1, 'hivSurge 1996', 1996], [2, 'hivFade 2019', 2019]]) {
    await atYear(yr, 2.4);
    const d = await page.evaluate(`${DIAM}('hiv-aids')`);
    const cam = await page.evaluate(CAM);
    log(`  pause ${pi} (${label}): HIV r=${d.r.toFixed(2)}, camera ${(Math.hypot(...cam.p) / cam.R0).toFixed(2)} R0, ` +
        `distance ${d.dist.toFixed(0)} -> ${d.px.toFixed(1)}px on screen`);
    log(`   ${ok(d.px >= 12)} (>= 12px)`);
    await shot(`${P}-hiv-pause-${pi}`);
  }
  // Growth has to be readable at the pause's own framing: 1990 against 1996 at
  // the frozen 1996 camera.
  await page.evaluate(() => window.__tour.seek(1));
  await wait(2600);
  await page.evaluate(() => {
    const c = window.__scene.controls;
    if (c) { c.autoRotate = false; c.enabled = false; }
    window.__scene.handover.cancelled = true;
  });
  const forceYear = async (y) => {
    await page.evaluate((yy) => {
      window._store.getState().setTmPhase('scrub');
      window.__tm.targetYear = yy; window.__tm.yearFloat = yy;
    }, y);
    await page.evaluate(() => new Promise((res) => {
      let k = 40; const t = () => (--k <= 0 ? res(true) : requestAnimationFrame(t)); requestAnimationFrame(t);
    }));
  };
  await forceYear(0);
  const a = await page.evaluate(`${DIAM}('hiv-aids')`);
  await shot(`${P}-hiv-1990-at-pause-framing`);
  await forceYear(6);
  const b = await page.evaluate(`${DIAM}('hiv-aids')`);
  await shot(`${P}-hiv-1996-at-pause-framing`);
  log(`  at the 1996 pause framing: 1990 ${a.px.toFixed(1)}px -> 1996 ${b.px.toFixed(1)}px ` +
      `(+${(b.px - a.px).toFixed(1)}px, ${(b.px / a.px).toFixed(2)}x)`);
}

// ── section 4 item 4: the resting galaxy micro-breathe ───────────────────────
async function microbreathe() {
  log('\n== section 4.4: resting galaxy micro-breathe ==');
  await dismiss();
  // The home screen is only reached at the far end of the whole unattended
  // sequence — film, tour, exit — so this waits the same 60 s the wave-1
  // delta-1 regression does. Anything earlier is the tour, where radius is the
  // year and this channel is deliberately off; the 22 s window between the
  // film's release and the tour's arm looks identical to the store and is not
  // the home screen, which is why the wait is a clock and not only a predicate.
  await wait(60000);
  await page.waitForFunction(
    () => {
      const s = window._store.getState();
      return s.overtureDone && s.uiRevealed && s.hintsShown &&
        s.tmPhase === 'idle' && window.__tm && window.__tm.active === false &&
        window.__tm.exit === 0;
    },
    { timeout: 90000, polling: 200 },
  );
  await wait(1500);
  const SCALES = `(() => {
    const m = window.__scene.instancedMesh.instanceMatrix.array;
    const n = window.__scene.instancedMesh.count;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.hypot(m[i*16], m[i*16+1], m[i*16+2]);
    return out;
  })()`;
  const a = await page.evaluate(SCALES);
  await shot(`${P}-microbreathe-a`);
  await wait(3000);
  const b = await page.evaluate(SCALES);
  await shot(`${P}-microbreathe-b`);
  let maxRel = 0, moved = 0;
  for (let i = 0; i < a.length; i++) {
    const rel = Math.abs(b[i] - a[i]) / Math.max(1e-9, a[i]);
    if (rel > maxRel) maxRel = rel;
    if (rel > 0.0005) moved++;
  }
  // A trough-to-peak pair measured as a fraction of the earlier (trough) value
  // reads 2A/(1-A) = 1.613%, not 2A = 1.600%: the same +-0.8 percent of the
  // node's own radius, divided by the smaller of the two numbers. That ratio is
  // the ceiling this can touch, and touching it is the channel at full swing.
  const ceiling = (2 * 0.008) / (1 - 0.008);
  log(`  ${moved}/${a.length} nodes changed scale over 3 s at rest; largest change ${(maxRel * 100).toFixed(3)}%`);
  log(`  ${ok(maxRel <= ceiling + 1e-9)} inside the +-0.8% band ` +
      `(trough-to-peak ceiling ${(ceiling * 100).toFixed(3)}%, i.e. amplitude ` +
      `${(maxRel / (2 + maxRel) * 100).toFixed(3)}% of radius)`);
  log(`  ${ok(moved > a.length * 0.5)} the field is breathing, not frozen`);
  const tmOff = await page.evaluate(`(async () => {
    await window.__tour.seek(3);
    await new Promise((r) => setTimeout(r, 1500));
    const m = window.__scene.instancedMesh.instanceMatrix.array;
    const n = window.__scene.instancedMesh.count;
    const s0 = []; for (let i = 0; i < n; i++) s0.push(Math.hypot(m[i*16], m[i*16+1], m[i*16+2]));
    await new Promise((r) => setTimeout(r, 1500));
    let worst = 0;
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(Math.hypot(m[i*16], m[i*16+1], m[i*16+2]) - s0[i]) / Math.max(1e-9, s0[i]));
    return worst;
  })()`);
  log(`  inside the Time Machine (2020 pause held), worst scale drift over 1.5 s: ${(tmOff * 100).toFixed(4)}%`);
  log(`  ${ok(tmOff < 1e-6)} year deltas are not muddied by ambient scale`);
}

// ── section 4 item 5: edge shimmer during the film ───────────────────────────
async function shimmer() {
  log('\n== section 4.5: edge shimmer during the film ==');
  await dismiss();
  await page.evaluate(() => window.__overture.seek(2.4)); // beat 1, the film's own hold
  await wait(900);
  const band = await page.evaluate(`(async () => {
    const read = () => ({ ...window.__edges });
    const out = [read()];
    for (let k = 0; k < 50; k++) {
      await new Promise((r) => setTimeout(r, 120));
      out.push(read());
    }
    return out;
  })()`);
  const alphas = band.map((b) => b.alpha);
  log(`  film edge alpha over 6.0 s: min ${Math.min(...alphas).toFixed(3)}, max ${Math.max(...alphas).toFixed(3)} ` +
      `(boarded 0.06 -> 0.13 at 0.2 Hz)`);
  log(`  wave ${band[0].wave} (per-vertex phase, HIGH/MEDIUM only), film ${band[0].film.toFixed(2)}`);
  log(`  ${ok(Math.min(...alphas) < 0.075 && Math.max(...alphas) > 0.115)} the breathe reaches both ends of its band`);
  await shot(`${P}-shimmer-film`);
  await wait(1250);
  await shot(`${P}-shimmer-film-b`);
  const after = await page.evaluate(`(() => ({ ...window.__edges }))()`);
  log(`  a second film frame 1.25 s later: alpha ${after.alpha.toFixed(3)}`);
  // Outside the film the channel must be exactly off.
  await page.evaluate(() => { window.__overture.resume(); });
  await wait(20000);
  const rest = await page.evaluate(`(() => ({ ...window.__edges, done: window._store.getState().overtureDone }))()`);
  log(`  at rest (overtureDone ${rest.done}): film ${rest.film}, alpha ${rest.alpha}`);
  log(`  ${ok(rest.alpha === 0)} film only`);
}

// ── FPS with every ambient channel on ────────────────────────────────────────
async function fps() {
  log(`\n== section 4: FPS with all five ambient channels live (${mobile ? 'LOW portrait' : 'HIGH desktop'}) ==`);
  await dismiss();
  const measure = () => page.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => { frames++; performance.now() - t0 < 5000 ? requestAnimationFrame(tick) : res(); };
      requestAnimationFrame(tick);
    });
    return Math.round(frames / 5);
  });
  // One linear pass through the piece as a viewer gets it: the film first, the
  // tour when it arms itself, then the home screen the exit lands on. No seeks
  // — a seeked frame is a paused frame and would measure an idle scene.
  const film = await measure();
  log(`  film (beat 0 assembly into beat 1): ${film} fps`);
  await page.waitForFunction('window._store.getState().tmPhase === "tour"', { timeout: 60000 });
  await wait(2000);
  const tour = await measure();
  log(`  tour (staircase + leg choreography + accents): ${tour} fps`);
  await page.waitForFunction(
    () => {
      const s = window._store.getState();
      return s.tmPhase === 'idle' && window.__tm && window.__tm.active === false && s.hintsShown;
    },
    { timeout: 90000, polling: 200 },
  );
  await wait(2000);
  const rest = await measure();
  log(`  rest (home screen, breathing + shells + micro-breathe): ${rest} fps`);
  const gate = mobile ? 30 : 55;
  log(`  ${ok(film >= gate && rest >= gate && tour >= gate)} all three >= ${gate}`);
}

const TASKS = { breathe, stars, hiv, microbreathe, shimmer, fps };
if (!TASKS[only]) log(`unknown task ${only}; try: ${Object.keys(TASKS).join(', ')}`);
else await TASKS[only]();
await browser.close();
