import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  tropical:       '#22c55e',
  cancer:         '#ef4444',
  cardiovascular: '#f97316',
  neurological:   '#a855f7',
  respiratory:    '#3b82f6',
  autoimmune:     '#ec4899',
  metabolic:      '#eab308',
  infectious:     '#14b8a6',
  genetic:        '#f472b6',
  mental:         '#8b5cf6',
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);
const NODE_SCALE = 1.8;

// ─── Quality Tiers ───────────────────────────────────────────────────────────
const TIER_CONFIG = {
  HIGH:   { dprCap: 99,  particles: 400, glowAll: true,  edgesAll: true,  pulse: true  },
  MEDIUM: { dprCap: 1.5, particles: 150, glowAll: false, edgesAll: true,  pulse: true  },
  LOW:    { dprCap: 1.0, particles: 0,   glowAll: false, edgesAll: false, pulse: false },
};

function detectTier() {
  if (typeof window === 'undefined') return 'HIGH';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth < 768;
  if (coarse || small) return 'LOW';
  if (window.innerWidth < 1200) return 'MEDIUM';
  return 'HIGH';
}

function nodeRadius(papers) {
  return Math.log10(Math.max(papers, 10)) * NODE_SCALE;
}

// ─── Data Processing ─────────────────────────────────────────────────────────
function processData(diseases, connections) {
  // Build lookup
  const map = {};
  diseases.forEach((d, i) => { map[d.id] = i; });

  // Cosine-normalize edge scores
  const edges = connections.map(c => {
    const si = map[c.source];
    const ti = map[c.target];
    const sp = diseases[si].papers;
    const tp = diseases[ti].papers;
    const score = c.sharedPapers / Math.sqrt(sp * tp);
    return { ...c, si, ti, score };
  });

  // Layout edges: top-7 per node by score
  const TOP_K = 7;
  const nodeEdges = new Map();
  diseases.forEach((_, i) => nodeEdges.set(i, []));
  edges.forEach((e, ei) => {
    nodeEdges.get(e.si).push({ ei, score: e.score });
    nodeEdges.get(e.ti).push({ ei, score: e.score });
  });
  const layoutSet = new Set();
  nodeEdges.forEach(arr => {
    arr.sort((a, b) => b.score - a.score);
    arr.slice(0, TOP_K).forEach(({ ei }) => layoutSet.add(ei));
  });
  const layoutEdges = [...layoutSet].map(i => edges[i]);

  return { diseases, edges, layoutEdges, displayEdges: edges };
}

// ─── Category Centers ────────────────────────────────────────────────────────
function getCategoryCenters() {
  const xy = {};
  const zz = {};
  CATEGORIES.forEach((cat, i) => {
    const angle = (i / CATEGORIES.length) * Math.PI * 2;
    const r = 200;
    xy[cat] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    zz[cat] = ((i / CATEGORIES.length) - 0.5) * 300;
  });
  return { xy, zz };
}

// ─── Dual Force Layout ───────────────────────────────────────────────────────
function computeLayouts(diseases, layoutEdges) {
  const { xy: catXY, zz: catZ } = getCategoryCenters();
  const maxScore = Math.max(...layoutEdges.map(e => e.score), 0.001);

  function makeLinks(edges) {
    return edges.map(e => ({ source: e.si, target: e.ti, score: e.score }));
  }

  // Z-repulsion helper (prevents z-axis stacking)
  function applyZRepulsion(nodes) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const na = nodes[a], nb = nodes[b];
        const dx = na.x - nb.x, dy = na.y - nb.y, dz = na.z - nb.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 30 && dist > 0) {
          const f = (dz / dist) * 0.5;
          na.z += f;
          nb.z -= f;
        }
      }
    }
  }

  // ── Category View ──
  const catNodes = diseases.map((d, i) => ({
    index: i, category: d.category, papers: d.papers,
    x: catXY[d.category].x + (Math.random() - 0.5) * 50,
    y: catXY[d.category].y + (Math.random() - 0.5) * 50,
    z: catZ[d.category] + (Math.random() - 0.5) * 30,
  }));

  const catSim = d3.forceSimulation(catNodes)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(makeLinks(layoutEdges))
      .id(d => d.index).distance(80)
      .strength(d => (d.score / maxScore) * 0.5))
    .force('center', d3.forceCenter(0, 0))
    .force('catX', d3.forceX(d => catXY[d.category].x).strength(0.15))
    .force('catY', d3.forceY(d => catXY[d.category].y).strength(0.15))
    .stop();

  for (let i = 0; i < 300; i++) {
    catSim.tick();
    catNodes.forEach(n => { n.z += (catZ[n.category] - n.z) * 0.02; });
    applyZRepulsion(catNodes);
  }
  const categoryPositions = catNodes.map(n => [n.x, n.y, n.z]);

  // ── Network View ──
  const netNodes = diseases.map((d, i) => ({
    index: i, category: d.category, papers: d.papers,
    x: (Math.random() - 0.5) * 400,
    y: (Math.random() - 0.5) * 400,
    z: (Math.random() - 0.5) * 200,
  }));

  const netSim = d3.forceSimulation(netNodes)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(makeLinks(layoutEdges))
      .id(d => d.index).distance(80)
      .strength(d => (d.score / maxScore) * 0.5))
    .force('center', d3.forceCenter(0, 0))
    .force('collide', d3.forceCollide(d => nodeRadius(d.papers) * 1.2))
    .stop();

  for (let i = 0; i < 300; i++) {
    netSim.tick();
    applyZRepulsion(netNodes);
  }
  const networkPositions = netNodes.map(n => [n.x, n.y, n.z]);

  return { categoryPositions, networkPositions };
}

// ─── Custom Orbit Controls ──────────────────────────────────────────────────
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.el = domElement;
    this.target = new THREE.Vector3(0, 0, 0);

    this.theta = 0;
    this.phi = Math.PI / 2;
    this.radius = 800;

    this.thetaV = 0;
    this.phiV = 0;
    this.panVX = 0;
    this.panVY = 0;

    this._dragging = false;
    this._panning = false;
    this._lastX = 0;
    this._lastY = 0;

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._wheel = this._wheel.bind(this);
    this._ctx = (e) => e.preventDefault();

    domElement.addEventListener('mousedown', this._down);
    domElement.addEventListener('mousemove', this._move);
    domElement.addEventListener('mouseup', this._up);
    domElement.addEventListener('mouseleave', this._up);
    domElement.addEventListener('wheel', this._wheel, { passive: false });
    domElement.addEventListener('contextmenu', this._ctx);
  }

  _down(e) {
    if (e.button === 2) this._panning = true;
    else if (e.button === 0) this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  _move(e) {
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this._dragging) {
      this.thetaV -= dx * 0.005;
      this.phiV -= dy * 0.005;
    }
    if (this._panning) {
      const s = this.radius * 0.001;
      this.panVX -= dx * s;
      this.panVY += dy * s;
    }
  }

  _up() {
    this._dragging = false;
    this._panning = false;
  }

  _wheel(e) {
    e.preventDefault();
    this.radius = Math.max(50, Math.min(3000,
      this.radius + e.deltaY * 0.001 * this.radius));
  }

  update() {
    this.theta += this.thetaV;
    this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + this.phiV));
    this.thetaV *= 0.92;
    this.phiV *= 0.92;

    if (Math.abs(this.panVX) > 0.001 || Math.abs(this.panVY) > 0.001) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.target.addScaledVector(right, this.panVX);
      this.target.addScaledVector(up, this.panVY);
      this.panVX *= 0.92;
      this.panVY *= 0.92;
    }

    const sp = Math.sin(this.phi);
    const x = this.radius * sp * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * sp * Math.cos(this.theta);

    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
  }

  dispose() {
    const el = this.el;
    el.removeEventListener('mousedown', this._down);
    el.removeEventListener('mousemove', this._move);
    el.removeEventListener('mouseup', this._up);
    el.removeEventListener('mouseleave', this._up);
    el.removeEventListener('wheel', this._wheel);
    el.removeEventListener('contextmenu', this._ctx);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function MedGalaxy() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const instancedMeshRef = useRef(null);
  const edgeMeshRef = useRef(null);
  const categoryPosRef = useRef(null);
  const networkPosRef = useRef(null);
  const dataRef = useRef(null);
  const tierRef = useRef('HIGH');
  const frameRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Quality tier ──
    const tier = detectTier();
    tierRef.current = tier;
    const tierCfg = TIER_CONFIG[tier];

    // ── Process data ──
    const data = processData(diseasesData, connectionsData);
    const { diseases, layoutEdges, displayEdges } = data;
    dataRef.current = data;

    // ── Compute dual layouts ──
    const { categoryPositions, networkPositions } = computeLayouts(diseases, layoutEdges);
    categoryPosRef.current = categoryPositions;
    networkPosRef.current = networkPositions;

    // ── Scene ──
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 1, 5000
    );
    camera.position.set(0, 0, 800);
    cameraRef.current = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierCfg.dprCap));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 0);
    scene.add(pointLight);

    // ── Nodes (InstancedMesh) ──
    const count = diseases.length;
    const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
    const sphereMat = new THREE.MeshPhongMaterial({
      emissiveIntensity: 0.3,
      shininess: 30,
    });
    const iMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, count);

    const mtx = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const [px, py, pz] = categoryPositions[i];
      pos.set(px, py, pz);
      const r = nodeRadius(diseases[i].papers);
      scl.set(r, r, r);
      mtx.compose(pos, quat, scl);
      iMesh.setMatrixAt(i, mtx);

      const col = new THREE.Color(CATEGORY_COLORS[diseases[i].category]);
      iMesh.setColorAt(i, col);
    }
    iMesh.instanceMatrix.needsUpdate = true;
    iMesh.instanceColor.needsUpdate = true;
    scene.add(iMesh);
    instancedMeshRef.current = iMesh;

    // ── Edges (LineSegments) ──
    const edgeCount = displayEdges.length;
    const edgeBuf = new Float32Array(edgeCount * 6);
    for (let i = 0; i < edgeCount; i++) {
      const e = displayEdges[i];
      const s = categoryPositions[e.si];
      const t = categoryPositions[e.ti];
      const o = i * 6;
      edgeBuf[o]     = s[0]; edgeBuf[o + 1] = s[1]; edgeBuf[o + 2] = s[2];
      edgeBuf[o + 3] = t[0]; edgeBuf[o + 4] = t[1]; edgeBuf[o + 5] = t[2];
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeBuf, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
    });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeMesh);
    edgeMeshRef.current = edgeMesh;

    // ── Animation loop ──
    let animating = true;
    function animate() {
      if (!animating) return;
      frameRef.current++;
      controls.update();
      pointLight.position.copy(camera.position);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    // ── Resize ──
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    ro.observe(container);

    // ── Cleanup ──
    return () => {
      animating = false;
      ro.disconnect();
      controls.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      iMesh.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
}
