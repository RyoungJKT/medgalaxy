import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import { sceneRefs } from '../../sceneRefs';
import { fmtFull } from '../../utils/captions';
import { digitsOf } from './Odometer';

// ─── Motion vocabulary (DIRECTION section 4) ─────────────────────────────────
const ROLL_MS = 120;      // year numeral digit roll
const SNAP_MS = 180;      // release snaps to the nearest detent
const IN_MS = 240;        // rail entrance
const PULSE_MS = 650;     // one handover pulse
const FRICTION = 0.94;    // flick inertia, per frame
const FLICK_MIN = 0.02;   // years/frame below which a release is just a snap
const FLICK_STOP = 0.004; // years/frame at which momentum resolves to a detent
const EMBER = '#ff4d1a';
const RAIL_W = 520;       // desktop rail width
const HIT_H = 44;         // touch target height, mobile and desktop alike
const easeExpoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

// Digit column, same technique as the odometer (a 0-9 strip translated behind a
// one-character window) at the year numeral's own 120 ms.
function DigitColumn({ digit }) {
  const n = Number(digit);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', height: '1em', width: '0.62em', verticalAlign: 'top' }}>
      <span
        style={{
          display: 'block',
          transform: `translate3d(0, ${-n * 10}%, 0)`,
          transition: `transform ${ROLL_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <span key={d} style={{ display: 'block', height: '1em', lineHeight: '1em', textAlign: 'center' }}>{d}</span>
        ))}
      </span>
    </span>
  );
}

// A year is four digits, never grouped: digitsOf gives the shared decomposition,
// the separator it inserts for thousands is dropped here.
function YearNumeral({ year, size }) {
  const digits = useMemo(() => digitsOf(year).filter((c) => c !== ','), [year]);
  return (
    <span style={{ display: 'inline-flex', fontWeight: 600, color: '#ffffff', fontSize: size, lineHeight: 1, letterSpacing: '0.02em' }}>
      {digits.map((ch, i) => <DigitColumn key={digits.length - 1 - i} digit={ch} />)}
    </span>
  );
}

// The tour's caption card. Same glass treatment as the overture's, one hero
// line, one data line, plus the finale's optional derived micro-line.
function TimeCaption({ caption, mob, tall }) {
  if (!caption) return null;
  const { lines = [], data, micro } = caption;
  return (
    <div
      style={{
        position: 'absolute', bottom: mob ? 150 : 178, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '12px 18px' : '16px 28px', maxWidth: mob ? '90vw' : '76vw',
        fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'none',
      }}
    >
      {lines.map((line, i) => (
        <div
          key={line}
          style={{
            fontSize: i === 0 ? 'clamp(16px, 2.4vw, 26px)' : 'clamp(13px, 1.7vw, 18px)',
            fontWeight: i === 0 ? 500 : 400, color: i === 0 ? '#e2e8f0' : '#94a3b8',
            lineHeight: 1.3, whiteSpace: mob ? 'normal' : 'nowrap',
            animation: `tmLineIn 300ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms both`,
          }}
        >
          {line}
        </div>
      ))}
      {data && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, animation: `tmLineIn 300ms cubic-bezier(0.16,1,0.3,1) ${lines.length * 90}ms both` }}>
          {data}
        </div>
      )}
      {micro && tall && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, maxWidth: mob ? '80vw' : 620, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5, whiteSpace: 'normal', animation: `tmLineIn 300ms cubic-bezier(0.16,1,0.3,1) ${(lines.length + 1) * 90}ms both` }}>
          {micro}
        </div>
      )}
    </div>
  );
}

/**
 * The Time Machine's instrument: a year rail with magnetic detents, the rolling
 * year numeral above it, the tour's captions, and the finale's reticle. Renders
 * only while the Time Machine is up (tmPhase !== 'idle').
 */
export default function TimeRail() {
  const tmPhase = useStore((s) => s.tmPhase);
  const tmCaption = useStore((s) => s.tmCaption);
  const stopTimeMachine = useStore((s) => s.stopTimeMachine);

  const trackRef = useRef(null);
  const playheadRef = useRef(null);
  const fillRef = useRef(null);
  const numeralRef = useRef(null);
  const reticleRef = useRef(null);
  const dragRef = useRef({ active: false, v: 0, lastY: 0 });
  const inertiaRef = useRef(null);
  const snapRef = useRef(null);

  const tm = sceneRefs.tm;
  const nYears = tm ? tm.data.nYears : 1;
  const yearStart = tm ? tm.data.yearStart : 0;
  const maxY = nYears - 1;

  const mob = isMob();
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 1440 : window.innerWidth,
    h: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));
  const [year, setYear] = useState(yearStart + maxY);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [pulse, setPulse] = useState(0);

  const railW = mob ? Math.max(220, vp.w - 32) : RAIL_W;

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Seat the numeral on the year already on screen before the rail's first
  // paint, so it never flashes a placeholder as the Time Machine opens.
  useLayoutEffect(() => {
    const t = sceneRefs.tm;
    if (tmPhase !== 'idle' && t) setYear(t.data.yearStart + Math.round(t.yearFloat));
  }, [tmPhase]);

  // ── Scrubber mechanics ──
  const cancelInertia = useCallback(() => {
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    inertiaRef.current = null;
  }, []);

  const cancelSnap = useCallback(() => {
    if (snapRef.current) cancelAnimationFrame(snapRef.current);
    snapRef.current = null;
  }, []);

  // Release lands on the nearest detent in 180 ms expo.out; the engine's own
  // 120 ms spring is what carries the galaxy there, so the snap is a target
  // move, never a jump.
  const snapTo = useCallback((to) => {
    const t = sceneRefs.tm;
    if (!t) return;
    cancelInertia();
    cancelSnap();
    const from = t.targetYear;
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / SNAP_MS);
      t.targetYear = from + (to - from) * easeExpoOut(p);
      if (p < 1) snapRef.current = requestAnimationFrame(step);
      else { t.targetYear = to; snapRef.current = null; }
    };
    step();
  }, [cancelInertia, cancelSnap]);

  // A hard throw replays the years: momentum with friction, resolving onto a
  // detent when it runs out.
  const flick = useCallback((v0) => {
    const t = sceneRefs.tm;
    if (!t) return;
    const top = t.data.nYears - 1;
    let v = v0;
    let target = t.targetYear;
    const step = () => {
      v *= FRICTION;
      target += v;
      if (target <= 0) { target = 0; v = 0; }
      if (target >= top) { target = top; v = 0; }
      t.targetYear = target;
      if (Math.abs(v) < FLICK_STOP) {
        inertiaRef.current = null;
        snapTo(Math.round(target));
        return;
      }
      inertiaRef.current = requestAnimationFrame(step);
    };
    inertiaRef.current = requestAnimationFrame(step);
  }, [snapTo]);

  // The finale's isolation and its caption hold until the viewer takes the
  // instrument; the first scrub is what releases them. A handover chip
  // (`{ handover: true }`, set by TimeMachine.jsx's window-level listener,
  // which fires first on capture) is a different thing from a held finale
  // caption and must survive this call — otherwise a rail grab or an arrow
  // key nulls the chip in the same gesture that just set it (Task 13 review
  // finding 6), and "Scrub the decades." never has a chance to show.
  const clearFinale = useCallback(() => {
    const s = useStore.getState();
    if (s.tmFocusIdx >= 0) s.setTmFocusIdx(-1);
    if (s.tmCaption && !s.tmCaption.handover) s.setTmCaption(null);
  }, []);

  const yearFromClientX = useCallback((clientX) => {
    const el = trackRef.current;
    const t = sceneRefs.tm;
    if (!el || !t) return 0;
    const rect = el.getBoundingClientRect();
    const top = t.data.nYears - 1;
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(top, frac * top));
  }, []);

  const onPointerMove = useCallback((e) => {
    const t = sceneRefs.tm;
    if (!t || !dragRef.current.active) return;
    const y = yearFromClientX(e.clientX);
    const d = dragRef.current;
    d.v = d.v * 0.75 + (y - d.lastY) * 0.25;
    d.lastY = y;
    t.targetYear = y;
  }, [yearFromClientX]);

  const onPointerUp = useCallback(() => {
    const t = sceneRefs.tm;
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (!t) return;
    if (Math.abs(d.v) > FLICK_MIN) flick(d.v);
    else snapTo(Math.round(t.targetYear));
  }, [flick, snapTo, onPointerMove]);

  const onPointerDown = useCallback((e) => {
    const t = sceneRefs.tm;
    if (!t) return;
    const s = useStore.getState();
    if (s.tmPhase === 'tour') s.setTmPhase('scrub'); // the grab is the handover
    clearFinale();
    cancelInertia();
    cancelSnap();
    const y = yearFromClientX(e.clientX);
    dragRef.current = { active: true, v: 0, lastY: y };
    t.targetYear = y;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [cancelInertia, cancelSnap, clearFinale, yearFromClientX, onPointerMove, onPointerUp]);

  // Keyboard: left and right step a year while scrubbing; Escape leaves the
  // Time Machine altogether.
  useEffect(() => {
    if (tmPhase === 'idle') return undefined;
    const onKey = (e) => {
      // A caret in the search box (or any other text field) owns arrow keys
      // and Escape; the rail must not steal them out from under it (Task 13
      // review finding 3).
      const target = e.target;
      const tag = target && target.tagName;
      if (target && (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable)) return;
      const s = useStore.getState();
      if (e.key === 'Escape') { s.stopTimeMachine(); return; }
      if (s.tmPhase !== 'scrub') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = sceneRefs.tm;
      if (!t) return;
      e.preventDefault();
      clearFinale();
      const top = t.data.nYears - 1;
      const next = Math.max(0, Math.min(top, Math.round(t.targetYear) + (e.key === 'ArrowRight' ? 1 : -1)));
      snapTo(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tmPhase, clearFinale, snapTo]);

  // Stop any momentum the moment the Time Machine closes. If it closed
  // mid-drag, run the same teardown a pointerup would: otherwise the window
  // pointermove/pointerup/pointercancel listeners from onPointerDown outlive
  // the rail (Task 13 review finding 4).
  useEffect(() => {
    if (tmPhase !== 'idle') return undefined;
    cancelInertia();
    cancelSnap();
    onPointerUp();
    return undefined;
  }, [tmPhase, cancelInertia, cancelSnap, onPointerUp]);

  useEffect(() => () => {
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    if (snapRef.current) cancelAnimationFrame(snapRef.current);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  // One pulse as the tour hands the rail over.
  const prevPhase = useRef(tmPhase);
  useEffect(() => {
    if (prevPhase.current === 'tour' && tmPhase === 'scrub') setPulse((p) => p + 1);
    prevPhase.current = tmPhase;
  }, [tmPhase]);

  // The handover chip is a note, not a caption: it clears itself.
  useEffect(() => {
    if (!tmCaption || !tmCaption.handover) return undefined;
    const timer = setTimeout(() => {
      const s = useStore.getState();
      if (s.tmCaption === tmCaption) s.setTmCaption(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [tmCaption]);

  // ── Per-frame readout: playhead, fill, numeral, detent pip, reticle ──
  // Everything continuous is written straight to the DOM; only the integer year
  // touches React state, so scrubbing costs no re-renders.
  useEffect(() => {
    if (tmPhase === 'idle') return undefined;
    let raf = 0;
    let lastDetent = -999;
    let pipFrames = 0;
    const v3 = new THREE.Vector3();
    const loop = () => {
      const t = sceneRefs.tm;
      if (t) {
        const top = t.data.nYears - 1;
        const yf = Math.max(0, Math.min(top, t.yearFloat));
        const frac = top > 0 ? yf / top : 0;
        const el = trackRef.current;
        const w = el ? el.clientWidth : railW;
        if (playheadRef.current) playheadRef.current.style.transform = `translate3d(${frac * w - 1}px, 0, 0)`;
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`;

        const detent = Math.round(yf);
        if (detent !== lastDetent) {
          lastDetent = detent;
          setYear(t.data.yearStart + detent);
          // A visual click: one frame of 4 percent extra brightness.
          if (numeralRef.current) numeralRef.current.style.filter = 'brightness(1.04)';
          pipFrames = 1;
          // Sound arrives with the audio engine; until then this is a no-op.
          if (typeof window !== 'undefined') window.__mgAudio?.play?.('tick');
        } else if (pipFrames > 0) {
          pipFrames -= 1;
          if (pipFrames === 0 && numeralRef.current) numeralRef.current.style.filter = 'none';
        }
      }

      // Finale reticle: a hairline ring around the isolated disease, projected
      // from the live camera (same math NodeLabels uses).
      const ret = reticleRef.current;
      if (ret) {
        const s = useStore.getState();
        const idx = s.tmFocusIdx;
        const cam = sceneRefs.camera;
        const canvas = sceneRefs.canvasElement;
        if (idx >= 0 && cam && canvas && s.curPos[idx]) {
          const p = s.curPos[idx];
          v3.set(p[0], p[1], p[2]).project(cam);
          if (v3.z < 1) {
            const x = (v3.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (-v3.y * 0.5 + 0.5) * canvas.clientHeight;
            ret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            ret.style.opacity = '1';
          } else {
            ret.style.opacity = '0';
          }
        } else {
          ret.style.opacity = '0';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tmPhase, railW]);

  // Detents, drawn once per width. Decade years (and the last year on file)
  // carry a taller tick and a label.
  const ticks = useMemo(() => {
    const out = [];
    for (let i = 0; i < nYears; i++) {
      const y = yearStart + i;
      const major = y % 10 === 0 || i === nYears - 1 || i === 0;
      out.push({ i, y, major, x: maxY > 0 ? (i / maxY) * 100 : 0 });
    }
    return out;
  }, [nYears, yearStart, maxY]);

  const movers = useMemo(() => {
    const t = sceneRefs.tm;
    if (hoverIdx < 0 || !t) return null;
    const list = t.data.moversFor(hoverIdx);
    const top = list && list[0];
    if (!top) return null;
    const sign = top.delta >= 0 ? '+' : '-';
    return {
      x: maxY > 0 ? (hoverIdx / maxY) * 100 : 0,
      text: `${t.data.yearStart + hoverIdx}: ${top.label} ${sign}${fmtFull(Math.abs(top.delta))}`,
    };
  }, [hoverIdx, maxY]);

  if (tmPhase === 'idle' || !tm) return null;

  const emberX = maxY > 0 ? ((2020 - yearStart) / maxY) * 100 : 0;
  const emberOnRail = 2020 >= yearStart && 2020 <= yearStart + maxY;

  return (
    <>
      {/* Mode chip: same seat every mode uses, top center under the header. */}
      <div style={{ position: 'absolute', top: mob ? 56 : 84, left: '50%', transform: 'translateX(-50%)', zIndex: 47 }}>
        <button
          onClick={() => stopTimeMachine()}
          style={{
            pointerEvents: 'auto', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
            padding: mob ? '10px 16px' : '6px 14px', minHeight: mob ? 44 : undefined,
            borderRadius: 999, border: '1px solid rgba(245,158,11,0.5)',
            background: 'rgba(10,16,30,0.9)', color: '#f59e0b', fontSize: mob ? 11 : 11,
            animation: `tmChipIn ${IN_MS}ms cubic-bezier(0.16,1,0.3,1) both`,
          }}
        >
          &#10005; Time Machine
        </button>
      </div>

      <TimeCaption caption={tmCaption} mob={mob} tall={vp.h >= 700} />

      {/* Finale reticle */}
      <div
        ref={reticleRef}
        style={{
          position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: 44,
          transition: 'opacity 240ms ease', fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <div style={{ position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(226,232,240,0.55)' }} />
        <div style={{ position: 'absolute', left: -38, top: -0.5, width: 12, height: 1, background: 'rgba(226,232,240,0.55)' }} />
        <div style={{ position: 'absolute', left: 26, top: -0.5, width: 12, height: 1, background: 'rgba(226,232,240,0.55)' }} />
      </div>

      {/* The rail */}
      {/* Mobile clears the legend's two wrapped lines; desktop clears its one. */}
      <div style={{ position: 'absolute', bottom: mob ? 52 : 40, left: '50%', transform: 'translateX(-50%)', zIndex: 46, fontFamily: "'IBM Plex Mono', monospace" }}>
        <div style={{ width: railW, animation: `tmRailIn ${IN_MS}ms cubic-bezier(0.16,1,0.3,1) both` }}>
          <div ref={numeralRef} style={{ textAlign: 'center', marginBottom: mob ? 6 : 10 }}>
            <YearNumeral year={year} size={mob ? 26 : 38} />
          </div>

          <div
            key={pulse}
            onPointerDown={onPointerDown}
            onPointerMove={(e) => { if (!mob && !dragRef.current.active) setHoverIdx(Math.round(yearFromClientX(e.clientX))); }}
            onPointerLeave={() => setHoverIdx(-1)}
            style={{
              position: 'relative', height: HIT_H, display: 'flex', alignItems: 'center',
              pointerEvents: 'auto', cursor: 'ew-resize', touchAction: 'none',
              animation: pulse ? `tmRailPulse ${PULSE_MS}ms ease` : 'none',
            }}
          >
            {/* Movers chip */}
            {movers && (
              <div style={{
                position: 'absolute', bottom: HIT_H - 4, left: `${movers.x}%`, transform: 'translateX(-50%)',
                whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 6,
                background: 'rgba(10,16,30,0.94)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1', fontSize: 10, pointerEvents: 'none',
              }}>
                {movers.text}
              </div>
            )}

            <div ref={trackRef} style={{ position: 'relative', width: '100%', height: 2, background: 'rgba(255,255,255,0.14)' }}>
              <div
                ref={fillRef}
                style={{
                  position: 'absolute', left: 0, top: 0, width: '100%', height: 2,
                  background: 'rgba(226,232,240,0.45)', transformOrigin: 'left center', transform: 'scaleX(1)',
                }}
              />
              {ticks.map((t) => (
                <div
                  key={t.i}
                  style={{
                    position: 'absolute', left: `${t.x}%`, top: t.major ? -5 : -3, width: 1,
                    height: t.major ? 12 : 8, marginLeft: -0.5,
                    background: t.major ? 'rgba(226,232,240,0.5)' : 'rgba(226,232,240,0.22)',
                  }}
                />
              ))}
              {/* The ember dot on 2020 */}
              {emberOnRail && (
                <div style={{
                  position: 'absolute', left: `${emberX}%`, top: -12, width: 5, height: 5, marginLeft: -2.5,
                  borderRadius: '50%', background: EMBER, boxShadow: `0 0 6px ${EMBER}`,
                }} />
              )}
              {/* Playhead */}
              <div
                ref={playheadRef}
                style={{
                  position: 'absolute', left: 0, top: -9, width: 2, height: 20,
                  background: '#ffffff', boxShadow: '0 0 8px rgba(255,255,255,0.6)', willChange: 'transform',
                }}
              />
              {/* Decade labels */}
              {ticks.filter((t) => t.major).map((t) => (
                <div
                  key={`l${t.i}`}
                  style={{
                    position: 'absolute', left: `${t.x}%`, top: 10, transform: 'translateX(-50%)',
                    fontSize: 9, color: '#64748b', pointerEvents: 'none',
                  }}
                >
                  {t.y}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tmRailIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tmChipIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tmLineIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tmRailPulse { 0% { filter: brightness(1); } 35% { filter: brightness(1.6); } 100% { filter: brightness(1); } }
      `}</style>
    </>
  );
}
