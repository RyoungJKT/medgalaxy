# Session 2: Three.js Scene + Force Layout — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core 3D visualization — 148 colored spheres clustered by category, connected by ~700 faint edges, with smooth custom orbit controls and dual pre-computed layouts. 60fps.

**Architecture:** Single React component (`src/MedGalaxy.jsx`) using `useRef` for all Three.js objects (scene, camera, renderer, meshes) and `useEffect` for initialization. Data imported from JSON during dev. Force simulation runs synchronously on mount (600 ticks total). All rendering via InstancedMesh (nodes) and LineSegments (edges) for one draw call each.

**Tech Stack:** React 18, Three.js r128, d3-force, Vite (JSON imports)

**File:** `src/MedGalaxy.jsx` (modify — all tasks write to this single file)

---

## Task Order & Risk Strategy

The spec marks custom orbit controls as the **riskiest item**. We implement and verify camera interaction before adding any nodes, following the spec's explicit instruction: "TEST THIS FIRST before adding nodes."

```
Task 1: Three.js init + dark background + animation loop    → verify: dark canvas renders
Task 2: Custom orbit controls + test cube                   → verify: orbit/zoom/pan a cube
Task 3: Data loading + edge normalization                    → verify: console.log processed data
Task 4: Dual force layout                                   → verify: console.log position arrays
Task 5: InstancedMesh node rendering                         → verify: 148 colored spheres in clusters
Task 6: Edge rendering (LineSegments)                        → verify: faint lines between nodes
Task 7: Lighting + quality tiers                             → verify: 3D shading, tier detected
Task 8: Remove test cube, final cleanup, commit              → verify: acceptance criteria, 60fps
```

---

### Task 1: Three.js Init + Dark Background + Animation Loop

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Replace placeholder with Three.js skeleton**

Replace the entire contents of `src/MedGalaxy.jsx` with:

```jsx
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function MedGalaxy() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 1, 5000
    );
    camera.position.set(0, 0, 800);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Animation loop
    let animating = true;
    function animate() {
      if (!animating) return;
      frameRef.current++;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    // Resize
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    ro.observe(container);

    return () => {
      animating = false;
      ro.disconnect();
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
```

**Step 2: Verify in browser**

Run: `npm run dev`
Expected: Dark canvas fills the viewport. No console errors. Background visible as CSS gradient from `index.html`.

---

### Task 2: Custom Orbit Controls + Test Cube

**Files:**
- Modify: `src/MedGalaxy.jsx`

This is the **riskiest item** per the spec. We add a test cube to verify orbit/zoom/pan before touching any data.

**Step 1: Add OrbitControls class above the component**

Insert this class before the `MedGalaxy` function:

```javascript
// ─── Custom Orbit Controls ───
// Self-contained class: spherical coordinates + velocity damping
// Left-drag → rotate, scroll → zoom, right-drag → pan
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 0, 0);

    // Spherical coordinates
    this.theta = 0;       // horizontal angle
    this.phi = Math.PI / 2; // vertical angle (start at equator)
    this.radius = 800;

    // Velocity for damping
    this.thetaVelocity = 0;
    this.phiVelocity = 0;
    this.panVelocityX = 0;
    this.panVelocityY = 0;

    // Interaction state
    this._isDragging = false;
    this._isPanning = false;
    this._lastX = 0;
    this._lastY = 0;

    // Bind events
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    domElement.addEventListener('mousedown', this._onMouseDown);
    domElement.addEventListener('mousemove', this._onMouseMove);
    domElement.addEventListener('mouseup', this._onMouseUp);
    domElement.addEventListener('mouseleave', this._onMouseUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  _onContextMenu(e) { e.preventDefault(); }

  _onMouseDown(e) {
    if (e.button === 2) {
      this._isPanning = true;
    } else if (e.button === 0) {
      this._isDragging = true;
    }
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  _onMouseMove(e) {
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this._isDragging) {
      this.thetaVelocity -= dx * 0.005;
      this.phiVelocity -= dy * 0.005;
    }
    if (this._isPanning) {
      const panSpeed = this.radius * 0.001;
      this.panVelocityX -= dx * panSpeed;
      this.panVelocityY += dy * panSpeed;
    }
  }

  _onMouseUp() {
    this._isDragging = false;
    this._isPanning = false;
  }

  _onWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.001 * this.radius;
    this.radius = Math.max(50, Math.min(3000, this.radius + zoomDelta));
  }

  update() {
    // Apply velocity
    this.theta += this.thetaVelocity;
    this.phi += this.phiVelocity;

    // Clamp phi to avoid gimbal lock
    this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi));

    // Damping
    this.thetaVelocity *= 0.92;
    this.phiVelocity *= 0.92;

    // Pan: move target in camera's local XY plane
    if (Math.abs(this.panVelocityX) > 0.001 || Math.abs(this.panVelocityY) > 0.001) {
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      up.setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.target.addScaledVector(right, this.panVelocityX);
      this.target.addScaledVector(up, this.panVelocityY);
      this.panVelocityX *= 0.92;
      this.panVelocityY *= 0.92;
    }

    // Convert spherical to cartesian
    const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    this.domElement.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('mouseup', this._onMouseUp);
    this.domElement.removeEventListener('mouseleave', this._onMouseUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
  }
}
```

**Step 2: Add a test cube and wire orbit controls into the useEffect**

After the renderer setup (after `rendererRef.current = renderer;`), add:

```javascript
// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

// TEST CUBE — remove after verifying orbit controls work
const testGeo = new THREE.BoxGeometry(50, 50, 50);
const testMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true });
const testCube = new THREE.Mesh(testGeo, testMat);
scene.add(testCube);
```

Update the animation loop to call `controls.update()`:

```javascript
function animate() {
  if (!animating) return;
  frameRef.current++;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

Add to cleanup: `controls.dispose();`

**Step 3: Verify in browser**

Run: `npm run dev`
Expected:
- Green wireframe cube visible at center
- Left-click + drag → rotates camera around cube smoothly
- Scroll → zooms in/out with smooth response
- Right-click + drag → pans the view
- Release → motion continues with damping (decays to stop)
- No gimbal lock when rotating vertically near poles

---

### Task 3: Data Loading + Edge Normalization

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Add constants and data imports at top of file**

After the Three.js import, add:

```javascript
import * as d3 from 'd3';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';

// ─── Constants ───
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
```

**Step 2: Add data processing function**

After the constants, before the OrbitControls class:

```javascript
// ─── Data Processing ───
function processData(diseases, connections) {
  const diseaseMap = {};
  diseases.forEach((d, i) => { diseaseMap[d.id] = { ...d, index: i }; });

  // Cosine-normalize edge scores
  const edges = connections.map(c => {
    const src = diseaseMap[c.source];
    const tgt = diseaseMap[c.target];
    const score = c.sharedPapers / Math.sqrt(src.papers * tgt.papers);
    return { ...c, sourceIndex: src.index, targetIndex: tgt.index, score };
  });

  // Compute layout edges: top-7 per node by normalized score
  const topK = 7;
  const nodeEdgeScores = new Map(); // nodeIndex → [{edgeIndex, score}]
  diseases.forEach((_, i) => nodeEdgeScores.set(i, []));
  edges.forEach((e, ei) => {
    nodeEdgeScores.get(e.sourceIndex).push({ ei, score: e.score });
    nodeEdgeScores.get(e.targetIndex).push({ ei, score: e.score });
  });
  const layoutEdgeSet = new Set();
  nodeEdgeScores.forEach((arr) => {
    arr.sort((a, b) => b.score - a.score);
    arr.slice(0, topK).forEach(({ ei }) => layoutEdgeSet.add(ei));
  });
  const layoutEdges = [...layoutEdgeSet].map(i => edges[i]);
  const displayEdges = edges; // all edges for rendering

  return { diseases: diseases.map((d, i) => ({ ...d, index: i })), edges, layoutEdges, displayEdges, diseaseMap };
}
```

**Step 3: Call processData in useEffect and log results**

At the start of the useEffect (before scene creation), add:

```javascript
const { diseases, layoutEdges, displayEdges, diseaseMap } = processData(diseasesData, connectionsData);
console.log(`Processed: ${diseases.length} diseases, ${layoutEdges.length} layout edges, ${displayEdges.length} display edges`);
```

**Step 4: Verify in browser console**

Run: `npm run dev`
Expected console output: `Processed: 148 diseases, ~350-500 layout edges, 702 display edges`
(Layout edges will be fewer than 702 since top-7-per-node deduplicates, but more than 148*7/2 ≈ 518 due to shared edges)

---

### Task 4: Dual Force Layout

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Add layout computation function**

After `processData`, add:

```javascript
// ─── Category Centers (arranged in a circle for 2D, with Z offsets) ───
function getCategoryCenters() {
  const centers = {};
  const zCenters = {};
  CATEGORIES.forEach((cat, i) => {
    const angle = (i / CATEGORIES.length) * Math.PI * 2;
    const spread = 200;
    centers[cat] = { x: Math.cos(angle) * spread, y: Math.sin(angle) * spread };
    zCenters[cat] = ((i / CATEGORIES.length) - 0.5) * 300;
  });
  return { centers, zCenters };
}

// ─── Dual Force Layout ───
function computeLayouts(diseases, layoutEdges) {
  const { centers: catCenters, zCenters: catZCenters } = getCategoryCenters();
  const maxScore = Math.max(...layoutEdges.map(e => e.score));

  // Helper: make link objects with source/target as indices
  const makeLinkData = (edges) => edges.map(e => ({
    source: e.sourceIndex,
    target: e.targetIndex,
    score: e.score,
  }));

  // ─── Category View: with category clustering forces ───
  const catNodes = diseases.map(d => ({ ...d, x: catCenters[d.category].x + (Math.random() - 0.5) * 50, y: catCenters[d.category].y + (Math.random() - 0.5) * 50, z: catZCenters[d.category] + (Math.random() - 0.5) * 30 }));
  const catLinks = makeLinkData(layoutEdges);

  const catSim = d3.forceSimulation(catNodes)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(catLinks).id(d => d.index).distance(80).strength(d => (d.score / maxScore) * 0.5))
    .force('center', d3.forceCenter(0, 0))
    .force('categoryX', d3.forceX(d => catCenters[d.category].x).strength(0.15))
    .force('categoryY', d3.forceY(d => catCenters[d.category].y).strength(0.15))
    .stop();

  // Run 300 ticks with manual Z forces
  for (let i = 0; i < 300; i++) {
    catSim.tick();
    catNodes.forEach(n => {
      n.z += (catZCenters[n.category] - n.z) * 0.02;
      // Simple Z repulsion from nearby nodes
      catNodes.forEach(m => {
        if (m.index === n.index) return;
        const dz = n.z - m.z;
        const dist = Math.sqrt((n.x - m.x) ** 2 + (n.y - m.y) ** 2 + dz ** 2);
        if (dist < 30 && dist > 0) {
          n.z += (dz / dist) * 0.5;
        }
      });
    });
  }
  const categoryPositions = catNodes.map(n => ({ x: n.x, y: n.y, z: n.z }));

  // ─── Network View: no category forces, organic clusters ───
  const netNodes = diseases.map(d => ({ ...d, x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400, z: (Math.random() - 0.5) * 200 }));
  const netLinks = makeLinkData(layoutEdges);

  const nodeRadiusScale = (papers) => Math.log10(Math.max(papers, 10)) * 2;
  const netSim = d3.forceSimulation(netNodes)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(netLinks).id(d => d.index).distance(80).strength(d => (d.score / maxScore) * 0.5))
    .force('center', d3.forceCenter(0, 0))
    .force('collide', d3.forceCollide(d => nodeRadiusScale(d.papers) * 1.2))
    .stop();

  // Run 300 ticks with mild random Z scatter
  for (let i = 0; i < 300; i++) {
    netSim.tick();
    netNodes.forEach(n => {
      // Mild Z scatter without category bias
      netNodes.forEach(m => {
        if (m.index === n.index) return;
        const dz = n.z - m.z;
        const dist = Math.sqrt((n.x - m.x) ** 2 + (n.y - m.y) ** 2 + dz ** 2);
        if (dist < 30 && dist > 0) {
          n.z += (dz / dist) * 0.5;
        }
      });
    });
  }
  const networkPositions = netNodes.map(n => ({ x: n.x, y: n.y, z: n.z }));

  console.log('Category positions sample:', categoryPositions[0]);
  console.log('Network positions sample:', networkPositions[0]);

  return { categoryPositions, networkPositions };
}
```

**Step 2: Call computeLayouts in useEffect and store in refs**

After the `processData` call, add:

```javascript
const { categoryPositions, networkPositions } = computeLayouts(diseases, layoutEdges);
```

Add refs at the top of the component (alongside existing refs):

```javascript
const categoryPositionsRef = useRef(null);
const networkPositionsRef = useRef(null);
const dataRef = useRef(null);
```

After computing layouts:

```javascript
categoryPositionsRef.current = categoryPositions;
networkPositionsRef.current = networkPositions;
dataRef.current = { diseases, layoutEdges, displayEdges, diseaseMap };
```

**Step 3: Verify in browser console**

Run: `npm run dev`
Expected:
- Console shows both position samples with x, y, z values
- Category positions should show clustering (nodes in same category have similar x/y/z)
- Network positions should be more scattered
- Page loads within ~2 seconds (600 ticks total should be fast)

---

### Task 5: InstancedMesh Node Rendering

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Add node scale helper**

After the imports/constants section:

```javascript
const NODE_SCALE_FACTOR = 1.8;
function nodeRadius(papers) {
  return Math.log10(Math.max(papers, 10)) * NODE_SCALE_FACTOR;
}
```

**Step 2: Add InstancedMesh creation after layout computation**

In the useEffect, after storing refs, add:

```javascript
// ─── Node Rendering (InstancedMesh) ───
const nodeCount = diseases.length;
const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
const sphereMat = new THREE.MeshPhongMaterial({
  emissiveIntensity: 0.3,
  shininess: 30,
});
const instancedMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, nodeCount);

const dummy = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

diseases.forEach((d, i) => {
  const pos = categoryPositions[i]; // default to Category View
  position.set(pos.x, pos.y, pos.z);
  const r = nodeRadius(d.papers);
  scale.set(r, r, r);
  dummy.compose(position, quaternion, scale);
  instancedMesh.setMatrixAt(i, dummy);
  instancedMesh.setColorAt(i, new THREE.Color(CATEGORY_COLORS[d.category]));
});
instancedMesh.instanceMatrix.needsUpdate = true;
instancedMesh.instanceColor.needsUpdate = true;
scene.add(instancedMesh);
```

**Step 3: Remove test cube**

Remove the test cube code (testGeo, testMat, testCube lines) from the useEffect. Keep the orbit controls.

**Step 4: Verify in browser**

Run: `npm run dev`
Expected:
- 148 colored spheres visible in 3D space
- Spheres are different sizes (log scale of paper count)
- Spheres are color-coded by category (green for tropical, red for cancer, etc.)
- Spheres form visible clusters (same-category nodes grouped together)
- Orbit/zoom/pan still works smoothly around the node cloud

---

### Task 6: Edge Rendering (LineSegments)

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Add edge rendering after InstancedMesh code**

```javascript
// ─── Edge Rendering (LineSegments — one draw call for all display edges) ───
const edgePositions = new Float32Array(displayEdges.length * 6); // 2 vertices * 3 coords per edge
displayEdges.forEach((e, i) => {
  const srcPos = categoryPositions[e.sourceIndex];
  const tgtPos = categoryPositions[e.targetIndex];
  const offset = i * 6;
  edgePositions[offset]     = srcPos.x;
  edgePositions[offset + 1] = srcPos.y;
  edgePositions[offset + 2] = srcPos.z;
  edgePositions[offset + 3] = tgtPos.x;
  edgePositions[offset + 4] = tgtPos.y;
  edgePositions[offset + 5] = tgtPos.z;
});

const edgeGeo = new THREE.BufferGeometry();
edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
const edgeMat = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.08,
});
const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
scene.add(edgeMesh);
```

**Step 2: Store edge refs for later updates**

Add refs at top of component:

```javascript
const instancedMeshRef = useRef(null);
const edgeMeshRef = useRef(null);
```

After creating the meshes:

```javascript
instancedMeshRef.current = instancedMesh;
edgeMeshRef.current = edgeMesh;
```

**Step 3: Verify in browser**

Run: `npm run dev`
Expected:
- Faint white lines visible between connected nodes
- Lines don't dominate the visual — nodes are primary, edges are background texture
- Dense areas (cancer cluster, infectious cluster) have more visible edge density
- Orbiting shows edges in 3D (parallax)

---

### Task 7: Lighting + Quality Tiers

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Add quality tier detection function**

After the constants, before OrbitControls class:

```javascript
// ─── Quality Tiers ───
const TIER_CONFIG = {
  HIGH:   { dprCap: 99, particles: 400, glowAll: true, edgesAll: true, pulse: true },
  MEDIUM: { dprCap: 1.5, particles: 150, glowAll: false, edgesAll: true, pulse: true },
  LOW:    { dprCap: 1.0, particles: 0, glowAll: false, edgesAll: false, pulse: false },
};

function detectTier() {
  const isMobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  if (isMobile || isSmallScreen) return 'LOW';
  if (typeof window !== 'undefined' && window.innerWidth < 1200) return 'MEDIUM';
  return 'HIGH';
}
```

**Step 2: Apply quality tier to renderer**

In useEffect, right after creating the renderer, add:

```javascript
// Quality tier
const tier = detectTier();
const tierCfg = TIER_CONFIG[tier];
renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierCfg.dprCap));
console.log(`Quality tier: ${tier}, DPR: ${Math.min(window.devicePixelRatio, tierCfg.dprCap)}`);
```

Add a ref:

```javascript
const tierRef = useRef('HIGH');
```

After detection: `tierRef.current = tier;`

**Step 3: Add lighting**

In useEffect, after scene creation (before orbit controls):

```javascript
// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 0.8, 0);
scene.add(pointLight);
```

Update animation loop to move point light with camera:

```javascript
function animate() {
  if (!animating) return;
  frameRef.current++;
  controls.update();
  // Point light follows camera
  pointLight.position.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

**Step 4: Verify in browser**

Run: `npm run dev`
Expected:
- Console shows `Quality tier: HIGH, DPR: 2` (or your actual DPR)
- Nodes now have 3D shading (not flat circles — visible specular highlights)
- Light follows camera, so front-facing nodes are always lit
- Emissive glow gives nodes a slight self-illumination
- Still 60fps

---

### Task 8: Final Cleanup + Commit

**Files:**
- Modify: `src/MedGalaxy.jsx`

**Step 1: Ensure test cube is removed**

Verify no testGeo/testMat/testCube code remains.

**Step 2: Add cleanup for Three.js objects in useEffect return**

Update the cleanup function:

```javascript
return () => {
  animating = false;
  ro.disconnect();
  controls.dispose();
  sphereGeo.dispose();
  sphereMat.dispose();
  edgeGeo.dispose();
  edgeMat.dispose();
  instancedMesh.dispose();
  renderer.dispose();
  if (container.contains(renderer.domElement)) {
    container.removeChild(renderer.domElement);
  }
};
```

**Step 3: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds, no warnings about missing imports.

**Step 4: Verify all acceptance criteria**

Open `npm run dev` and check:
- [ ] 148 colored spheres visible in 3D space
- [ ] Nodes form visible clusters by category (Category View)
- [ ] Graph uses all 3 dimensions (not flat)
- [ ] Orbit, zoom, pan smooth with damping
- [ ] 60fps (check Chrome DevTools Performance tab)
- [ ] Edges visible between connected nodes (faint)
- [ ] Dark background (CSS gradient from index.html)
- [ ] Both categoryPositions and networkPositions logged in console
- [ ] No console errors

**Step 5: Commit**

```bash
git add src/MedGalaxy.jsx
git commit -m "Session 2: Three.js scene + dual force layout

- Custom orbit controls (spherical coords, damping 0.92, left-rotate/scroll-zoom/right-pan)
- InstancedMesh rendering for 148 nodes (one draw call, 60fps)
- LineSegments rendering for 702 display edges (opacity 0.08)
- Cosine-normalized edge scores, top-7 layout edges per node
- Dual force layout: Category View (300 ticks) + Network View (300 ticks)
- Quality tier auto-detection (HIGH/MEDIUM/LOW) with DPR capping
- Ambient + camera-following point light

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git push origin main
```

---

## Key Code References

| Concept | Spec Location |
|---------|--------------|
| InstancedMesh pattern | `MEDGALAXY_MASTER_PROMPT.md` lines 387-398 |
| Force parameters | `MEDGALAXY_MASTER_PROMPT.md` lines 142-153 |
| Cosine normalization | `MEDGALAXY_MASTER_PROMPT.md` lines 90-98 |
| Layout vs display edges | `MEDGALAXY_MASTER_PROMPT.md` lines 100-109 |
| Dual layout code | `MEDGALAXY_MASTER_PROMPT.md` lines 117-140 |
| Quality tiers table | `MEDGALAXY_MASTER_PROMPT.md` lines 169-191 |
| Orbit controls spec | `MEDGALAXY_MASTER_PROMPT.md` lines 81-88 |
| Color scheme | `MEDGALAXY_MASTER_PROMPT.md` lines 234-247 |

## Acceptance Criteria (from BUILD_PLAN.md)

- [ ] 150 colored spheres visible in 3D
- [ ] Visible clusters by category (Category View)
- [ ] Orbit, zoom, pan smooth with damping
- [ ] 60fps (quality tier applied)
- [ ] Edges visible (faint by default)
- [ ] Dark background
- [ ] Both categoryPositions and networkPositions pre-computed
