import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { sceneRefs } from '../sceneRefs';
import edgeVert from '../shaders/edge.vert.glsl?raw';
import edgeFrag from '../shaders/edge.frag.glsl?raw';

// ── Config ──
const SEGS = 10;             // segments per curve
const MIN_W = 0.15;          // ribbon width at endpoints
const MAX_W = 0.8;           // ribbon width at midpoint
const CURVE_AMOUNT = 0.12;   // arc offset as fraction of edge length

// ── Helpers ──
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3(1, 0, 0);

// Deterministic hash for per-edge offset direction
function edgeHash(i) {
  let h = i * 2654435761;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) / 0x7fffffff;
}

// Quadratic bezier sample
function bezier(out, s, c, t, u) {
  const inv = 1 - u;
  out[0] = inv * inv * s[0] + 2 * inv * u * c[0] + u * u * t[0];
  out[1] = inv * inv * s[1] + 2 * inv * u * c[1] + u * u * t[1];
  out[2] = inv * inv * s[2] + 2 * inv * u * c[2] + u * u * t[2];
}

// Bezier tangent
function bezierTangent(out, s, c, t, u) {
  const inv = 1 - u;
  out[0] = 2 * inv * (c[0] - s[0]) + 2 * u * (t[0] - c[0]);
  out[1] = 2 * inv * (c[1] - s[1]) + 2 * u * (t[1] - c[1]);
  out[2] = 2 * inv * (c[2] - s[2]) + 2 * u * (t[2] - c[2]);
  // normalize
  const len = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]) || 1;
  out[0] /= len; out[1] /= len; out[2] /= len;
}

// Cross product
function cross(out, a, b) {
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
}

// Mute a hex color toward gray
function muteColor(hex, amount) {
  const c = new THREE.Color(hex);
  const gray = (c.r + c.g + c.b) / 3;
  c.r = c.r + (gray - c.r) * amount;
  c.g = c.g + (gray - c.g) * amount;
  c.b = c.b + (gray - c.b) * amount;
  return c;
}

export default function EdgeNetwork() {
  const meshRef = useRef();
  const displayEdges = useStore(s => s.displayEdges);
  const diseases = useStore(s => s.diseases);
  const eC = displayEdges.length;

  const vertsPerEdge = (SEGS + 1) * 2;
  const idxPerEdge = SEGS * 6;
  const totalVerts = eC * vertsPerEdge;
  const totalIdx = eC * idxPerEdge;

  // Pre-compute per-edge muted colors and curve offsets
  const edgeMeta = useMemo(() => {
    const meta = [];
    for (let i = 0; i < eC; i++) {
      const e = displayEdges[i];
      const sc = CC[diseases[e.si].category];
      const tc = CC[diseases[e.ti].category];
      // Blend source+target colors, then mute
      const blended = new THREE.Color(sc).lerp(new THREE.Color(tc), 0.5);
      const muted = muteColor('#' + blended.getHexString(), 0.4);
      meta.push({
        color: muted,
        phase: edgeHash(i),          // 0-1 random phase for pulse
        curveSign: edgeHash(i + 999) > 0.5 ? 1 : -1, // curve direction
      });
    }
    return meta;
  }, [eC, displayEdges, diseases]);

  // Build geometry buffers
  const { geo, posArr, colorArr, visArr } = useMemo(() => {
    const pos = new Float32Array(totalVerts * 3);
    const col = new Float32Array(totalVerts * 3);
    const tAttr = new Float32Array(totalVerts);      // curve parameter
    const vis = new Float32Array(totalVerts);         // visibility
    const phase = new Float32Array(totalVerts);       // pulse phase
    const idx = new Uint32Array(totalIdx);

    // Fill static attributes (color, t, phase, indices)
    for (let ei = 0; ei < eC; ei++) {
      const m = edgeMeta[ei];
      const vBase = ei * vertsPerEdge;

      for (let si = 0; si <= SEGS; si++) {
        const t = si / SEGS;
        const v0 = vBase + si * 2;
        const v1 = v0 + 1;

        tAttr[v0] = t;
        tAttr[v1] = t;
        vis[v0] = 0;
        vis[v1] = 0;
        phase[v0] = m.phase;
        phase[v1] = m.phase;

        const co = v0 * 3;
        col[co] = m.color.r; col[co + 1] = m.color.g; col[co + 2] = m.color.b;
        col[co + 3] = m.color.r; col[co + 4] = m.color.g; col[co + 5] = m.color.b;
      }

      // Triangle indices
      const iBase = ei * idxPerEdge;
      for (let si = 0; si < SEGS; si++) {
        const v0 = vBase + si * 2;
        const io = iBase + si * 6;
        idx[io] = v0;     idx[io + 1] = v0 + 1; idx[io + 2] = v0 + 2;
        idx[io + 3] = v0 + 1; idx[io + 4] = v0 + 3; idx[io + 5] = v0 + 2;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(tAttr, 1));
    g.setAttribute('aVis', new THREE.BufferAttribute(vis, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));

    return { geo: g, posArr: pos, colorArr: col, visArr: vis };
  }, [eC, edgeMeta, totalVerts, totalIdx, vertsPerEdge, idxPerEdge]);

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: edgeVert,
      fragmentShader: edgeFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
  }, []);

  // Expose to HighlightSystem
  const metaRef = useRef();
  metaRef.current = { geo, visArr, vertsPerEdge };

  // Expose mesh + meta for HighlightSystem
  React.useEffect(() => {
    if (meshRef.current) {
      sceneRefs.edgeMesh = meshRef.current;
      sceneRefs.edgeMeta = metaRef.current;
    }
  });

  // Temp arrays for bezier computation
  const _pt = [0, 0, 0];
  const _tan = [0, 0, 0];
  const _perp = [0, 0, 0];
  const _ctrl = [0, 0, 0];

  useFrame((state) => {
    if (!meshRef.current) return;
    const curPos = useStore.getState().curPos;
    mat.uniforms.time.value = state.clock.getElapsedTime();

    for (let ei = 0; ei < eC; ei++) {
      const e = displayEdges[ei];
      const s = curPos[e.si];
      const t = curPos[e.ti];
      const m = edgeMeta[ei];

      // Edge direction and length
      const dx = t[0] - s[0], dy = t[1] - s[1], dz = t[2] - s[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const dirX = dx / len, dirY = dy / len, dirZ = dz / len;

      // Perpendicular for curve offset
      const absDot = Math.abs(dirY);
      let refX, refY, refZ;
      if (absDot > 0.9) {
        refX = 1; refY = 0; refZ = 0;
      } else {
        refX = 0; refY = 1; refZ = 0;
      }
      // cross(dir, ref)
      const px = dirY * refZ - dirZ * refY;
      const py = dirZ * refX - dirX * refZ;
      const pz = dirX * refY - dirY * refX;
      const pLen = Math.sqrt(px * px + py * py + pz * pz) || 1;
      const perpX = px / pLen, perpY = py / pLen, perpZ = pz / pLen;

      // Control point: midpoint + perpendicular offset
      const offset = len * CURVE_AMOUNT * m.curveSign;
      _ctrl[0] = (s[0] + t[0]) * 0.5 + perpX * offset;
      _ctrl[1] = (s[1] + t[1]) * 0.5 + perpY * offset;
      _ctrl[2] = (s[2] + t[2]) * 0.5 + perpZ * offset;

      const vBase = ei * vertsPerEdge;

      for (let si = 0; si <= SEGS; si++) {
        const u = si / SEGS;

        // Sample bezier position
        bezier(_pt, s, _ctrl, t, u);

        // Sample tangent
        bezierTangent(_tan, s, _ctrl, t, u);

        // Perpendicular to tangent for ribbon width
        cross(_perp, _tan, [perpX, perpY, perpZ]);
        const pL = Math.sqrt(_perp[0] * _perp[0] + _perp[1] * _perp[1] + _perp[2] * _perp[2]) || 1;
        _perp[0] /= pL; _perp[1] /= pL; _perp[2] /= pL;

        // Taper: sin curve for width
        const taper = Math.sin(u * Math.PI);
        const width = MIN_W + (MAX_W - MIN_W) * taper;
        const halfW = width * 0.5;

        const v0 = (vBase + si * 2) * 3;
        posArr[v0]     = _pt[0] + _perp[0] * halfW;
        posArr[v0 + 1] = _pt[1] + _perp[1] * halfW;
        posArr[v0 + 2] = _pt[2] + _perp[2] * halfW;
        posArr[v0 + 3] = _pt[0] - _perp[0] * halfW;
        posArr[v0 + 4] = _pt[1] - _perp[1] * halfW;
        posArr[v0 + 5] = _pt[2] - _perp[2] * halfW;
      }
    }

    geo.getAttribute('position').needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} geometry={geo} material={mat} renderOrder={-1} />
  );
}
