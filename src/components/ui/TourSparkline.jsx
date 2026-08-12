import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { sceneRefs } from '../../sceneRefs';
import { isMob } from '../../utils/helpers';

// Carry-over C (direction, deferred from Task 13): during the Time Machine
// tour's HIV fade pause and the rheumatic heart disease finale, draw the
// focused disease's own yearly series as a small in-world polyline beneath
// its node (DIRECTION section 3, pauses 2 and 5). Which pause wants it is
// carried on the pause's own caption object (`tmCaption.sparklineFor`, set in
// buildTourCaptions) rather than a second piece of store state, so the
// sparkline's lifecycle — show, hold, clear — is exactly the caption's.
const W = 160;
const H = 36;
const GAP = 12; // px between the node's screen rim and the sparkline's top edge
const pv = new THREE.Vector3();
const tanHalfFov = Math.tan(Math.PI / 6); // fov 60 -> half 30 degrees, same math NodeLabels/OvertureMicroLabels use

function buildPath(series, w, h) {
  if (!series || series.length < 2) return { path: '', px: 0, py: h / 2 };
  const mx = Math.max(...series);
  const mn = Math.min(...series);
  const rng = mx - mn || 1;
  const xAt = (i) => (i / (series.length - 1)) * w;
  const yAt = (v) => h - 2 - ((v - mn) / rng) * (h - 4);
  const path = series.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
  return { path, xAt, yAt };
}

export default function TourSparkline() {
  const containerRef = useRef(null);
  const mob = isMob();

  const tmCaption = useStore((s) => s.tmCaption);
  const idMap = useStore((s) => s.idMap);
  const diseases = useStore((s) => s.diseases);

  const diseaseId = !mob && tmCaption ? tmCaption.sparklineFor : null;
  const idx = diseaseId != null ? idMap[diseaseId] : undefined;
  const disease = idx !== undefined ? diseases[idx] : null;

  useEffect(() => {
    if (idx === undefined) return undefined;
    let running = true;

    function update() {
      if (!running) return;
      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      const container = containerRef.current;
      const tm = sceneRefs.tm;
      if (!camera || !canvas || !container || !tm) {
        requestAnimationFrame(update);
        return;
      }

      const st = useStore.getState();
      const curPos = st.curPos;
      // The caption can move on (or clear) between one frame and the next;
      // re-check every frame rather than trusting the effect's own closure.
      if (!curPos || !curPos[idx] || !st.tmCaption || st.tmCaption.sparklineFor !== diseaseId) {
        container.style.opacity = '0';
        requestAnimationFrame(update);
        return;
      }

      pv.set(curPos[idx][0], curPos[idx][1], curPos[idx][2]);
      const nodeDist = pv.distanceTo(camera.position);
      pv.project(camera);

      if (pv.z > 1 || pv.z < -1) {
        container.style.opacity = '0';
        requestAnimationFrame(update);
        return;
      }

      const rc = canvas.getBoundingClientRect();
      const sx = (pv.x * 0.5 + 0.5) * rc.width;
      const sy = (-pv.y * 0.5 + 0.5) * rc.height;
      const screenR = (tm.radiusAt ? tm.radiusAt(idx) : 2) * rc.height / (2 * nodeDist * tanHalfFov);

      container.style.opacity = '1';
      container.style.left = Math.round(sx - W / 2) + 'px';
      container.style.top = Math.round(sy + screenR + GAP) + 'px';

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => { running = false; };
  }, [idx, diseaseId]);

  if (idx === undefined || !disease) return null;

  const series = Array.isArray(disease.yearlyPapers) ? disease.yearlyPapers : [];
  const yearStart = Number.isFinite(disease.yearStart) ? disease.yearStart : 2015;
  const tm = sceneRefs.tm;
  const currentYear = tm ? tm.data.yearStart + Math.round(tm.yearFloat) : yearStart;
  const playIdx = Math.max(0, Math.min(series.length - 1, currentYear - yearStart));
  const chartH = H - 8;
  const { path, xAt, yAt } = buildPath(series, W, chartH);
  const px = xAt ? xAt(playIdx) : 0;
  const py = yAt ? yAt(series[playIdx]) : chartH / 2;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', left: 0, top: 0, width: W, height: H,
        pointerEvents: 'none', zIndex: 29, opacity: 0,
        transition: 'opacity 240ms ease',
      }}
    >
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <polyline points={path} fill="none" stroke="#94a3b8" strokeWidth="1.25" opacity="0.85" />
        <circle cx={px} cy={py} r="2.5" fill="#e2e8f0" />
        <circle cx={px} cy={py} r="5" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.4" />
      </svg>
    </div>
  );
}
