import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import useStore from '../../store';
import { CC, CL } from '../../utils/constants';
import { fmt, nR } from '../../utils/helpers';
import { sceneRefs } from '../../sceneRefs';

const pv = new THREE.Vector3();

function TooltipBox({ disease, connCount, style }) {
  const c = CC[disease.category];
  const t = disease.trend;
  const ar = t > 0 ? '\u2191' : t < 0 ? '\u2193' : '\u2192';

  return (
    <div style={style}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3 }}>{disease.label}</div>
      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: c + '22', color: c }}>
        {CL[disease.category]}
      </span>
      <div style={{ color: '#94a3b8', marginTop: 4 }}>
        {fmt(disease.papers)} papers{' '}
        <span style={{ color: t > 0 ? '#22c55e' : t < 0 ? '#ef4444' : '#94a3b8' }}>
          {ar}{Math.abs(t)}%
        </span>
      </div>
      <div style={{ color: '#64748b' }}>{connCount} connections</div>
    </div>
  );
}

export default function Tooltip() {
  const hoveredNode = useStore(s => s.hoveredNode);
  const connCounts = useStore(s => s.connCounts);
  const selectedNode = useStore(s => s.selectedNode);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef(null);

  // Track mouse for hover tooltip
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Track selected node screen position for persistent tooltip
  useEffect(() => {
    if (!selectedNode) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    function track() {
      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      if (!camera || !canvas) { rafRef.current = requestAnimationFrame(track); return; }

      const curPos = useStore.getState().curPos;
      const idx = selectedNode.index;
      if (!curPos[idx]) { rafRef.current = requestAnimationFrame(track); return; }

      pv.set(curPos[idx][0], curPos[idx][1], curPos[idx][2]);
      const nodeR = nR(selectedNode.disease.papers);
      const nodeDist = pv.distanceTo(camera.position);
      pv.project(camera);

      if (pv.z < 1 && pv.z > -1) {
        const rc = canvas.getBoundingClientRect();
        const tanHalfFov = Math.tan(Math.PI / 6);
        const screenR = nodeR * rc.height / (2 * nodeDist * tanHalfFov);
        const sx = (pv.x * 0.5 + 0.5) * rc.width;
        const sy = (-pv.y * 0.5 + 0.5) * rc.height;
        setAnchorPos({ x: sx + screenR + 16, y: sy - 20 });
      }

      rafRef.current = requestAnimationFrame(track);
    }

    rafRef.current = requestAnimationFrame(track);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [selectedNode]);

  const baseStyle = {
    pointerEvents: 'none', zIndex: 100,
    background: 'rgba(10,16,30,0.94)', backdropFilter: 'blur(16px)',
    maxWidth: 240, border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '8px 12px',
    fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#e2e8f0',
  };

  // Persistent tooltip anchored to selected node
  if (selectedNode) {
    const selDisease = selectedNode.disease;
    const selConnCount = connCounts.get(selectedNode.index) || 0;

    return (
      <TooltipBox
        disease={selDisease}
        connCount={selConnCount}
        style={{
          ...baseStyle,
          position: 'fixed', left: anchorPos.x, top: anchorPos.y,
          opacity: 0, animation: 'fadeIn 0.4s ease forwards',
        }}
      />
    );
  }

  // Standard hover tooltip
  const show = hoveredNode && !(selectedNode && hoveredNode.index === selectedNode.index);
  if (!show || !hoveredNode) return null;

  const disease = hoveredNode.disease;
  const connCount = connCounts.get(hoveredNode.index) || 0;

  return (
    <TooltipBox
      disease={disease}
      connCount={connCount}
      style={{
        ...baseStyle,
        position: 'fixed', left: mousePos.x + 15, top: mousePos.y + 15,
      }}
    />
  );
}
