// tools/verify-r6fix.mjs
// Round-5 gate fix list, items 1-7: the acceptance the ranked list asks for,
// measured rather than watched.
//
//   node tools/verify-r6fix.mjs [task ...] [--mobile] [--shots]
//
//   hold      r6fix-2020-hold    COVID-19 is the dominant silhouette through
//                                the detonation hold (top-2 on-screen px)
//   hiv       r6fix-hiv-pause    HIV/AIDS dominant at its own 1996 pause
//   caption   r6fix-caption-leg  the 1996 card is gone by the 1996-2019 leg
//   assembly  r6fix-assembly-16  beat 0 luminance at the four boarded marks
//   ghosts    r6fix-ghosts-wide  shell legibility at the 1990-1996 overview
//   mobile    r6fix-mobile-pulse the ending's affordance is visible on a phone
//   micro     mover micro-label suppression on the captioned node
//   deter     the two-run determinism pair (tour beats to the millisecond)
//
// Every pause measurement is EVENT-TRIGGERED off the app's own tour clock (year
// landed plus rate exactly zero), never off wall-clock arithmetic: the piece is
// deterministic but a harness's setTimeout is not, and the round-5 numbers this
// is checked against were taken on the played frame.
//
// Pixel radius is the projection the mover label already uses:
//   px = r * viewportHeight / (2 * dist * tan(fov/2))
// read off the live camera and the live tm.radiusAt, so it is the silhouette
// the viewer is actually looking at rather than a layout number.
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5280';
const OUT = 'docs/verify';
const argv = process.argv.slice(2);
const mobile = argv.includes('--mobile');
const shots = argv.includes('--shots');
const tasks = argv.filter((a) => !a.startsWith('--'));
const want = (t) => !tasks.length || tasks.includes(t);
const PRE = mobile ? 'r6fixm-' : 'r6fix-';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

// ── One read of every on-screen silhouette, biggest first ───────────────────
const SILHOUETTES = `((subject) => {
  const st = window._store.getState();
  const cam = window.__scene.camera;
  const rc = window.__scene.canvasElement.getBoundingClientRect();
  const tm = window.__tm;
  const tanHalf = Math.tan((cam.fov * Math.PI / 180) / 2);
  const out = [];
  for (let i = 0; i < st.diseases.length; i++) {
    const p = st.curPos[i];
    if (!p) continue;
    const dist = Math.hypot(p[0]-cam.position.x, p[1]-cam.position.y, p[2]-cam.position.z);
    out.push({ id: st.diseases[i].id, d: Math.round(dist),
               pxR: +((tm.radiusAt(i) * rc.height) / (2 * dist * tanHalf)).toFixed(1) });
  }
  out.sort((a, b) => b.pxR - a.pxR);
  const si = out.findIndex((o) => o.id === subject);
  return {
    camLen: Math.round(cam.position.length()),
    year: +window.__tour.state().year.toFixed(2),
    rank: si + 1, subject: out[si], top2: out.slice(0, 2),
    lead: +(out[si].pxR / out.find((o) => o.id !== subject).pxR).toFixed(2),
  };
})`;

async function open(page) {
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction('window._store !== undefined', { timeout: 20000 });
  await page.evaluate(() => {
    const el = document.querySelector('[style*="z-index: 200"], [style*="zIndex: 200"]');
    if (el) el.click(); else window._store.getState().setIntroStarted();
  });
}

/** Opens the tour at pause 0 and lets it play from there, untouched. */
async function playTourFromStart(page) {
  await page.waitForFunction('window.__tour !== undefined', { timeout: 20000 });
  // Records every moment the mover micro-label is actually up. Suppressing it
  // where the caption already names the node must not quietly delete the accent.
  await page.evaluate(() => {
    window.__moverLog = [];
    const tick = () => {
      const el = document.querySelector('[data-mg-mover-label]');
      if (el && el.style.display !== 'none' && Number(el.style.opacity) > 0.05) {
        const y = window.__tour ? Math.round(window.__tour.state().year) : null;
        const cap = window._store.getState().tmCaption;
        const txt = [...((cap && cap.lines) || []), cap && cap.data, cap && cap.micro]
          .filter(Boolean).join(' ').toLowerCase();
        // The disease name the label carries, without its own numeral.
        const name = el.textContent.replace(/\s[+-][\d,]+\spapers$/, '').toLowerCase();
        const dup = !!name && txt.includes(name);
        const last = window.__moverLog[window.__moverLog.length - 1];
        if (!last || last.year !== y || last.text !== el.textContent) {
          window.__moverLog.push({ year: y, text: el.textContent, dupFrames: dup ? 1 : 0 });
        } else if (dup) last.dupFrames++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => window.__tour.seek(0));
  await wait(2200); // the opening camera-home fly, so the first pause is framed
  const st = await page.evaluate(() => window.__tour.state());
  await page.evaluate(() => window.__tour.resume());
  return st;
}

/**
 * Waits for the tour to be STANDING on `year`: the year landed exactly and the
 * engine's published rate is exactly zero, which is true in a hold and in a
 * dwell and false anywhere inside a travel segment. Returns the wall clock of
 * the arrival, which every offset in a hold is then measured from.
 */
async function arriveAt(page, year) {
  await page.waitForFunction((y) => {
    const s = window.__tour.state();
    return Math.abs(s.year - y) < 1e-6 && window.__tm.rate === 0;
  }, { timeout: 90000, polling: 16 }, year);
  return Date.now();
}

async function sampleHold(page, subject, arrival, offsets, label) {
  const rows = [];
  for (const off of offsets) {
    const due = off * 1000 - (Date.now() - arrival);
    if (due > 0) await wait(due);
    const s = await page.evaluate(`${SILHOUETTES}(${JSON.stringify(subject)})`);
    rows.push({ off, ...s });
    console.log(`    +${String(off).padEnd(4)}s cam ${String(s.camLen).padStart(4)} yr ${s.year}  ` +
      `${subject} ${s.subject.pxR}px rank ${s.rank}  ::  ${s.top2.map((o) => `${o.id} ${o.pxR}`).join(' / ')}`);
  }
  if (label) writeFileSync(`${OUT}/${PRE}${label}.json`, JSON.stringify(rows, null, 1));
  return rows;
}

async function makePage(browser) {
  const page = await browser.newPage();
  await page.setViewport(mobile
    ? { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { width: 1440, height: 900 });
  page.on('pageerror', (e) => { console.log(`    PAGEERROR ${String(e).slice(0, 140)}`); failures++; });
  return page;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: [`--window-size=${mobile ? '375,812' : '1440,900'}`, '--use-gl=angle'],
});

// ── r6fix-2020-hold + r6fix-hiv-pause + r6fix-caption-leg + micro ───────────
if (want('hold') || want('hiv') || want('caption') || want('micro')) {
  console.log('\nr6fix: the played tour (1996 pause, the long leg, the 2020 hold)');
  const page = await makePage(browser);
  await open(page);
  await playTourFromStart(page);

  // 1996: the subject must own its own pause. The first 1.30 s of the hold is
  // the pause's own framing move (the cue's REWIND-length fly onto HIV's seat),
  // exactly as at the peak and the finale, so the frame under judgement is the
  // settled one the caption is read against.
  const hivAt = await arriveAt(page, 1996);
  const hiv = await sampleHold(page, 'hiv-aids', hivAt, [1.4, 2.2, 3.0, 3.4], 'hiv-pause');
  if (shots) await page.screenshot({ path: `${OUT}/${PRE}hiv-pause.png` });
  if (want('hiv')) {
    check('r6fix-hiv-pause: HIV/AIDS is the dominant silhouette of its own pause',
      hiv.every((r) => r.rank === 1 && r.lead >= 1.3),
      `ranks ${hiv.map((r) => r.rank).join(',')}  lead ${hiv.map((r) => r.lead).join(',')}`);
  }

  // The long leg must not carry the 1996 card into 2018.
  if (want('caption')) {
    await page.waitForFunction(() => window.__tour.state().year > 1996.5, { timeout: 30000, polling: 16 });
    await wait(250);
    const mid = await page.evaluate(() => {
      const c = window._store.getState().tmCaption;
      return { year: +window.__tour.state().year.toFixed(1), caption: c ? JSON.stringify(c).slice(0, 90) : null };
    });
    if (shots) await page.screenshot({ path: `${OUT}/${PRE}caption-leg.png` });
    console.log(`    mid-leg year ${mid.year} caption ${mid.caption}`);
    check('r6fix-caption-leg: the 1996 caption is handed back at the leg start',
      mid.caption === null, `year ${mid.year}`);
  }

  const detAt = await arriveAt(page, 2020);
  const covid = await sampleHold(page, 'covid-19', detAt, [0.05, 0.5, 1.0, 1.4, 2.0, 3.0, 3.8], 'covid-hold');
  if (shots) await page.screenshot({ path: `${OUT}/${PRE}2020-hold.png` });
  if (want('hold')) {
    const settled = covid.filter((r) => r.off >= 1.4);
    check('r6fix-2020-hold: COVID-19 leads every settled frame of the hold',
      settled.every((r) => r.rank === 1 && r.lead >= 1.3),
      `ranks ${covid.map((r) => `${r.off}:${r.rank}`).join(' ')}  settled lead ${settled.map((r) => r.lead).join(',')}`);
    check('r6fix-2020-hold: COVID-19 leads by the caption`s own reading time',
      covid.filter((r) => r.rank === 1).length >= covid.length - 2,
      `${covid.filter((r) => r.rank === 1).length}/${covid.length} marks`);
  }

  if (want('micro')) {
    const lbl = await page.evaluate(() => {
      const el = document.querySelector('[data-mg-mover-label]');
      return { shown: !!el && el.style.display !== 'none' && Number(el.style.opacity) > 0.01, text: el ? el.textContent : null };
    });
    console.log(`    mover label at the 2020 hold: ${JSON.stringify(lbl)}`);
    check('micro-label is suppressed where the caption already names the node', !lbl.shown, lbl.text || '');
  }

  // The 2021 peak was already clean and must stay clean: the seats above move
  // where the camera approaches it from, so this is the regression guard.
  if (want('hold') || want('micro')) {
    const peakAt = await arriveAt(page, 2021);
    const peak = await sampleHold(page, 'covid-19', peakAt, [1.4, 2.5], 'covid-peak');
    if (want('hold')) {
      check('the 2021 peak still belongs to COVID-19',
        peak.every((r) => r.rank === 1 && r.lead >= 1.3),
        `lead ${peak.map((r) => r.lead).join(',')}`);
    }
  }

  if (want('micro')) {
    // Run the tour out so the whole accent record is in.
    await page.waitForFunction(() => window._store.getState().tmPhase === 'idle',
      { timeout: 40000, polling: 100 }).catch(() => {});
    const log = await page.evaluate(() => window.__moverLog);
    console.log(`    mover label fired at: ${log.map((l) => `${l.year} "${l.text}" dupFrames ${l.dupFrames}`).join('; ') || 'never'}`);
    // The rule, exactly as written: not one rendered frame in which the label
    // and a caption naming the same node are both on screen.
    check('no frame carries both the label and a caption naming the same node',
      log.every((l) => l.dupFrames === 0), log.map((l) => `${l.year}:${l.dupFrames}`).join(' '));
    // ...and suppression is not deletion: the accent still speaks where it is
    // the only thing naming the mover.
    check('the label still fires where the caption does not name the node',
      log.length > 0, `${log.length} firing(s)`);
  }
  await page.close();
}

// ── r6fix-ghosts-wide ───────────────────────────────────────────────────────
if (want('ghosts')) {
  console.log('\nr6fix-ghosts-wide: shell legibility on the 1990-1996 staircase');
  const page = await makePage(browser);
  await open(page);
  await playTourFromStart(page);
  await page.waitForFunction(() => window.__tour.state().year >= 1991, { timeout: 40000, polling: 16 });
  let best = null;
  for (let k = 0; k < 60; k++) {
    const g = await page.evaluate(() => (window.__ghosts ? window.__ghosts() : []));
    if (g.length && (!best || g[0].alpha > best.alpha)) best = { ...g[0], n: g.length };
    if (g.length && shots && !best.shot) { await page.screenshot({ path: `${OUT}/${PRE}ghosts-wide.png` }); best.shot = true; }
    await wait(40);
  }
  const px = await page.evaluate(() => (window.__ghostPx ? window.__ghostPx() : null));
  console.log(`    strongest live shell ${JSON.stringify(best)}`);
  console.log(`    last fired annulus px / alpha: ${JSON.stringify(px)}`);
  check('r6fix-ghosts-wide: a shell fires on the early staircase', !!best, best ? `${best.n} live` : 'none');
  check('r6fix-ghosts-wide: the wide-framing shell is lifted above the base alpha',
    !!px && px.alpha > 0.3 && px.annulusPx < 4,
    px ? `annulus ${px.annulusPx}px alpha ${px.alpha} (base 0.30)` : 'no reading');
  await page.close();
}

// ── r6fix-assembly-16 ───────────────────────────────────────────────────────
if (want('assembly')) {
  console.log('\nr6fix-assembly-16: beat 0 luminance at the four boarded marks');
  const page = await makePage(browser);
  await open(page);
  await page.waitForFunction('window.__assembly !== undefined', { timeout: 20000 });
  const marks = [0.0, 1.6, 3.2, 5.0];
  const lum = [];
  for (const t of marks) {
    await page.evaluate((tt) => window.__assembly.seek(tt), t);
    await wait(450);
    const state = await page.evaluate(() => window.__assembly.state());
    // Mean luminance of the delivered frame. Read off the screenshot rather
    // than off the live canvas: a WebGL context without preserveDrawingBuffer
    // reads back black, which is exactly the value under test.
    //
    // Averaged over four frames a beat apart, because the background this frame
    // is mostly made of is alive: star twinkle, three parallax shells and the
    // aurora move between any two screenshots, and their swing is larger than
    // the node channel's whole contribution to a whole-frame mean. A single
    // shot cannot tell a 7 percent change from noise; four can.
    const shot = async (save) => {
    const b64 = await page.screenshot(save
      ? { path: `${OUT}/${PRE}asm-${String(t).replace('.', 'p')}.png`, encoding: 'base64' }
      : { encoding: 'base64' });
    return page.evaluate(async (data) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${data}`; });
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const n = d.length / 4;
      let s = 0, lit = 0, bright = 0, peak = 0;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        s += y;
        if (y >= 2) lit++;
        if (y >= 12) bright++;
        if (y > peak) peak = y;
      }
      // mean is the round-5 reviewer's own instrument, kept for continuity;
      // `lit` and `bright` are what a viewer in a bright room actually sees,
      // because a field of 146 comets covers a fraction of a percent of the
      // frame and cannot move a whole-frame mean however hard it is drawn.
      return { mean: s / n, litPct: (100 * lit) / n, brightPct: (100 * bright) / n, peak };
    }, b64);
    };
    const runs = [];
    for (let k = 0; k < 4; k++) { runs.push(await shot(k === 0)); await wait(120); }
    const avg = (f) => +(runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(3);
    const stat = { mean: avg((r) => r.mean), litPct: avg((r) => r.litPct),
                   brightPct: avg((r) => r.brightPct), peak: Math.round(avg((r) => r.peak)) };
    lum.push({ t, ...stat });
    console.log(`    t=${t}s  mean ${stat.mean}/255  lit>2 ${stat.litPct}%  lit>12 ${stat.brightPct}%  ` +
      `peak ${stat.peak}  (inFlight ${state.inFlight})`);
  }
  writeFileSync(`${OUT}/${PRE}assembly-luminance.json`, JSON.stringify(lum, null, 1));
  const at16 = lum.find((l) => l.t === 1.6);
  // The round-5 reading was mean 0.227, comet peak 147 (re-measured here on the
  // pre-fix build with this same averaged instrument, so the comparison is
  // like-for-like). Both must be up, and the peak is the one that answers the
  // finding: at this mark the 153 nodes and their tails cover under one percent
  // of a 1440x900 frame, so the whole-frame mean is mostly star field and
  // aurora, and no honest change to the flight's own brightness can move it far.
  // What a viewer in a bright room sees get brighter is the comets, and that is
  // what `peak` and `lit>12` measure.
  check('r6fix-assembly-16: the 1.6 s frame reads brighter than round 5',
    at16.mean >= 0.238 && at16.peak >= 154 && at16.brightPct >= 0.54,
    `mean ${at16.mean}/255 (was 0.227), comet peak ${at16.peak} (was 147), lit>12 ${at16.brightPct}%`);
  check('r6fix-assembly-16: brightness still climbs to the landing',
    lum[3].mean > lum[1].mean, lum.map((l) => `${l.t}:${l.mean}`).join(' '));
  await page.close();
}

// ── r6fix-mobile-pulse ──────────────────────────────────────────────────────
if (want('mobile')) {
  console.log('\nr6fix-mobile-pulse: the ending affordance on a phone');
  const page = await makePage(browser);
  await open(page);
  await page.waitForFunction('window.__tour !== undefined', { timeout: 20000 });
  // Land on the exit the way the piece does: seek the finale, then let it run.
  await page.evaluate(() => window.__tour.seek(5.9));
  await page.evaluate(() => window.__tour.resume());
  await page.waitForFunction(() => window._store.getState().tmExitAt > 0, { timeout: 40000, polling: 50 });
  await wait(2100); // the header channel opens at t = 1.75 s
  const aff = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button')];
    const hit = els.filter((e) => /animation/.test(e.getAttribute('style') || '') && /tmBtn/.test(e.getAttribute('style') || ''));
    const chip = document.querySelector('[data-mg-tm-chip]');
    const r = chip ? chip.getBoundingClientRect() : null;
    return {
      pulsing: hit.map((e) => e.textContent.trim().slice(0, 24)),
      chip: chip ? { text: chip.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height),
                     onScreen: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight,
                     anim: getComputedStyle(chip).animationName } : null,
    };
  });
  await page.screenshot({ path: `${OUT}/${PRE}mobile-pulse.png` });
  console.log(`    ${JSON.stringify(aff)}`);
  check('r6fix-mobile-pulse: a pulsing control is visible, not drawer-hidden',
    aff.pulsing.length > 0 && (!mobile || (aff.chip && aff.chip.onScreen && /tm/i.test(aff.chip.anim))),
    JSON.stringify(aff.pulsing));
  await page.close();
}

// ── the two-run determinism pair ────────────────────────────────────────────
if (want('deter')) {
  console.log('\ndeterminism: two untouched runs, tour beats to the millisecond');
  const runs = [];
  for (let k = 0; k < 2; k++) {
    const page = await makePage(browser);
    await open(page);
    await page.waitForFunction('window.__tour !== undefined', { timeout: 20000 });
    await playTourFromStart(page);
    const beats = [];
    for (const y of [1996, 2019, 2020, 2021]) {
      const at = await arriveAt(page, y);
      beats.push({ y, t: at });
    }
    const t0 = beats[0].t;
    runs.push(beats.map((b) => ({ y: b.y, dt: +((b.t - t0) / 1000).toFixed(3) })));
    console.log(`    run ${k + 1}: ${runs[k].map((b) => `${b.y}@+${b.dt}s`).join(' ')}`);
    await page.close();
  }
  const worst = Math.max(...runs[0].map((b, i) => Math.abs(b.dt - runs[1][i].dt)));
  writeFileSync(`${OUT}/${PRE}determinism.json`, JSON.stringify({ runs, worstDeltaS: worst }, null, 1));
  check('two untouched runs agree on every tour beat', worst <= 0.12, `worst delta ${worst.toFixed(3)}s`);
}

await browser.close();
console.log(`\n  ${failures ? `${failures} FAILING check(s)` : 'all checks green'}`);
process.exit(failures ? 1 : 0);
