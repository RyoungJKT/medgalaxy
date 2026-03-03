import React, { useRef, useEffect, useState, useCallback } from 'react';
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
const CATEGORY_LABELS = {
  tropical: 'Tropical / NTD', cancer: 'Cancer', cardiovascular: 'Cardiovascular',
  neurological: 'Neurological', respiratory: 'Respiratory', autoimmune: 'Autoimmune',
  metabolic: 'Metabolic', infectious: 'Infectious', genetic: 'Genetic', mental: 'Mental Health',
};
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
  if (coarse || window.innerWidth < 768) return 'LOW';
  if (window.innerWidth < 1200) return 'MEDIUM';
  return 'HIGH';
}

function nodeRadius(papers) {
  return Math.log10(Math.max(papers, 10)) * NODE_SCALE;
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 10000) return Math.round(n / 1000) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ─── Data Processing ─────────────────────────────────────────────────────────
function processData(diseases, connections) {
  const idMap = {};
  diseases.forEach((d, i) => { idMap[d.id] = i; });

  const edges = connections.map(c => {
    const si = idMap[c.source], ti = idMap[c.target];
    const score = c.sharedPapers / Math.sqrt(diseases[si].papers * diseases[ti].papers);
    return { ...c, si, ti, score };
  });

  // Top-7 layout edges per node
  const nodeEdgeBuckets = new Map();
  diseases.forEach((_, i) => nodeEdgeBuckets.set(i, []));
  edges.forEach((e, ei) => {
    nodeEdgeBuckets.get(e.si).push({ ei, score: e.score });
    nodeEdgeBuckets.get(e.ti).push({ ei, score: e.score });
  });
  const layoutSet = new Set();
  nodeEdgeBuckets.forEach(arr => {
    arr.sort((a, b) => b.score - a.score);
    arr.slice(0, 7).forEach(({ ei }) => layoutSet.add(ei));
  });

  // Neighbor map + connection counts
  const neighbors = new Map();
  const connCounts = new Map();
  diseases.forEach((_, i) => { neighbors.set(i, new Set()); connCounts.set(i, 0); });
  edges.forEach(e => {
    neighbors.get(e.si).add(e.ti);
    neighbors.get(e.ti).add(e.si);
    connCounts.set(e.si, connCounts.get(e.si) + 1);
    connCounts.set(e.ti, connCounts.get(e.ti) + 1);
  });

  return { diseases, edges, layoutEdges: [...layoutSet].map(i => edges[i]),
    displayEdges: edges, neighbors, connCounts, idMap };
}

// ─── Category Centers ────────────────────────────────────────────────────────
function getCategoryCenters() {
  const xy = {}, zz = {};
  CATEGORIES.forEach((cat, i) => {
    const a = (i / CATEGORIES.length) * Math.PI * 2;
    xy[cat] = { x: Math.cos(a) * 200, y: Math.sin(a) * 200 };
    zz[cat] = ((i / CATEGORIES.length) - 0.5) * 300;
  });
  return { xy, zz };
}

// ─── Dual Force Layout ───────────────────────────────────────────────────────
function computeLayouts(diseases, layoutEdges) {
  const { xy: catXY, zz: catZ } = getCategoryCenters();
  const maxScore = Math.max(...layoutEdges.map(e => e.score), 0.001);
  const mkLinks = (es) => es.map(e => ({ source: e.si, target: e.ti, score: e.score }));

  function zRepulse(nodes) {
    for (let a = 0; a < nodes.length; a++)
      for (let b = a + 1; b < nodes.length; b++) {
        const na = nodes[a], nb = nodes[b];
        const dx = na.x-nb.x, dy = na.y-nb.y, dz = na.z-nb.z;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < 30 && d > 0) { const f = (dz/d)*0.5; na.z += f; nb.z -= f; }
      }
  }

  // Category View
  const cn = diseases.map((d, i) => ({
    index: i, category: d.category, papers: d.papers,
    x: catXY[d.category].x + (Math.random()-0.5)*50,
    y: catXY[d.category].y + (Math.random()-0.5)*50,
    z: catZ[d.category] + (Math.random()-0.5)*30,
  }));
  const cs = d3.forceSimulation(cn)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(mkLinks(layoutEdges)).id(d=>d.index).distance(80).strength(d=>(d.score/maxScore)*0.5))
    .force('center', d3.forceCenter(0,0))
    .force('catX', d3.forceX(d=>catXY[d.category].x).strength(0.15))
    .force('catY', d3.forceY(d=>catXY[d.category].y).strength(0.15))
    .stop();
  for (let i = 0; i < 300; i++) {
    cs.tick();
    cn.forEach(n => { n.z += (catZ[n.category]-n.z)*0.02; });
    zRepulse(cn);
  }

  // Network View
  const nn = diseases.map((d, i) => ({
    index: i, category: d.category, papers: d.papers,
    x: (Math.random()-0.5)*400, y: (Math.random()-0.5)*400, z: (Math.random()-0.5)*200,
  }));
  const ns = d3.forceSimulation(nn)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(mkLinks(layoutEdges)).id(d=>d.index).distance(80).strength(d=>(d.score/maxScore)*0.5))
    .force('center', d3.forceCenter(0,0))
    .force('collide', d3.forceCollide(d=>nodeRadius(d.papers)*1.2))
    .stop();
  for (let i = 0; i < 300; i++) { ns.tick(); zRepulse(nn); }

  return {
    categoryPositions: cn.map(n => [n.x, n.y, n.z]),
    networkPositions: nn.map(n => [n.x, n.y, n.z]),
  };
}

// ─── Custom Orbit Controls ──────────────────────────────────────────────────
class OrbitControls {
  constructor(camera, el) {
    this.camera = camera; this.el = el;
    this.target = new THREE.Vector3();
    this.theta = 0; this.phi = Math.PI/2; this.radius = 800;
    this.thetaV = 0; this.phiV = 0; this.panVX = 0; this.panVY = 0;
    this._drag = false; this._pan = false; this._lx = 0; this._ly = 0;
    this.enabled = true;

    this._d = this._d.bind(this); this._m = this._m.bind(this);
    this._u = this._u.bind(this); this._w = this._w.bind(this);
    this._c = e => e.preventDefault();
    el.addEventListener('mousedown', this._d);
    el.addEventListener('mousemove', this._m);
    el.addEventListener('mouseup', this._u);
    el.addEventListener('mouseleave', this._u);
    el.addEventListener('wheel', this._w, { passive: false });
    el.addEventListener('contextmenu', this._c);
  }
  _d(e) { if (!this.enabled) return; if (e.button===2) this._pan=true; else if (e.button===0) this._drag=true; this._lx=e.clientX; this._ly=e.clientY; }
  _m(e) { const dx=e.clientX-this._lx, dy=e.clientY-this._ly; this._lx=e.clientX; this._ly=e.clientY;
    if (this._drag&&this.enabled) { this.thetaV-=dx*0.0045; this.phiV-=dy*0.0045; }
    if (this._pan&&this.enabled) { const s=this.radius*0.0009; this.panVX-=dx*s; this.panVY+=dy*s; } }
  _u() { this._drag=false; this._pan=false; }
  _w(e) { if (!this.enabled) return; e.preventDefault(); this.radius=Math.max(50,Math.min(3000,this.radius+e.deltaY*0.001*this.radius)); }

  update() {
    this.theta += this.thetaV;
    this.phi = Math.max(0.05, Math.min(Math.PI-0.05, this.phi+this.phiV));
    this.thetaV *= 0.92; this.phiV *= 0.92;
    if (Math.abs(this.panVX)>0.001 || Math.abs(this.panVY)>0.001) {
      const r = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
      const u = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
      this.target.addScaledVector(r,this.panVX); this.target.addScaledVector(u,this.panVY);
      this.panVX *= 0.92; this.panVY *= 0.92;
    }
    const sp = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius*sp*Math.sin(this.theta),
      this.target.y + this.radius*Math.cos(this.phi),
      this.target.z + this.radius*sp*Math.cos(this.theta));
    this.camera.lookAt(this.target);
  }
  dispose() {
    this.el.removeEventListener('mousedown',this._d); this.el.removeEventListener('mousemove',this._m);
    this.el.removeEventListener('mouseup',this._u); this.el.removeEventListener('mouseleave',this._u);
    this.el.removeEventListener('wheel',this._w); this.el.removeEventListener('contextmenu',this._c);
  }
}

// ─── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ data, color, w = 260, h = 50 }) {
  if (!data || !data.length) return null;
  const mx = Math.max(...data), mn = Math.min(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h-4-((v-mn)/rng)*(h-8)}`).join(' ');
  const gid = 'sp' + color.replace('#','');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
      </linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
      <text x="0" y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono">2014</text>
      <text x={w} y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">2024</text>
    </svg>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────────────────
function Tooltip({ disease, connCount, x, y }) {
  if (!disease) return null;
  const color = CATEGORY_COLORS[disease.category];
  const t = disease.trend;
  const arrow = t > 0 ? '↑' : t < 0 ? '↓' : '→';
  return (
    <div style={{
      position:'fixed', left: x+15, top: y+15, pointerEvents:'none', zIndex:100,
      background:'rgba(10,16,30,0.94)', backdropFilter:'blur(16px)', maxWidth:240,
      border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
      padding:'8px 12px', fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#e2e8f0',
    }}>
      <div style={{ fontWeight:600, fontSize:12, marginBottom:3 }}>{disease.label}</div>
      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:color+'22', color }}>{CATEGORY_LABELS[disease.category]}</span>
      <div style={{ color:'#94a3b8', marginTop:4 }}>
        {fmt(disease.papers)} papers <span style={{ color: t>0?'#22c55e':t<0?'#ef4444':'#94a3b8' }}>{arrow}{Math.abs(t)}%</span>
      </div>
      <div style={{ color:'#64748b' }}>{connCount} connections</div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ disease, data, onSelect, onClose }) {
  if (!disease) return null;
  const color = CATEGORY_COLORS[disease.category];
  const idx = data.diseases.indexOf(disease);
  const cc = data.connCounts.get(idx);
  const conns = data.edges
    .filter(e => e.si === idx || e.ti === idx)
    .map(e => { const oi = e.si===idx ? e.ti : e.si; return { d: data.diseases[oi], sp: e.sharedPapers, t: e.trend, oi }; })
    .sort((a,b) => b.sp - a.sp);

  const t = disease.trend;
  const arrow = t>0 ? '↑' : t<0 ? '↓' : '→';
  const tc = t>0 ? '#22c55e' : t<0 ? '#ef4444' : '#94a3b8';
  const gc = { high:'#ef4444', medium:'#eab308', low:'#22c55e' };

  return (
    <div style={{
      position:'absolute', top:0, right:0, width:320, height:'100%',
      background:'rgba(10,16,30,0.94)', backdropFilter:'blur(16px)',
      borderLeft:'1px solid rgba(255,255,255,0.06)',
      fontFamily:'IBM Plex Mono,monospace', color:'#e2e8f0',
      overflowY:'auto', overflowX:'hidden', zIndex:50, fontSize:11,
    }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{disease.label}</div>
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:4, background:color+'22', color }}>{CATEGORY_LABELS[disease.category]}</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding:'10px 16px', color:'#64748b', lineHeight:1.5 }}>{disease.description}</div>

      {/* Stats Grid */}
      <div style={{ padding:'0 16px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <SB label="Publications" val={fmt(disease.papers)} sub={<span style={{color:tc}}>{arrow}{Math.abs(t)}%</span>}/>
        <SB label="Connections" val={cc}/>
        <SB label="WHO Deaths/yr" val={disease.mortality > 0 ? fmt(disease.mortality) : 'N/A'}/>
        <SB label="Funding Gap" val={disease.fundingGap.toUpperCase()} vc={gc[disease.fundingGap]}/>
      </div>

      {/* Sparkline */}
      <div style={{ padding:'0 16px 12px' }}>
        <div style={{ color:'#475569', fontSize:9, marginBottom:4 }}>Publication Trend (2014–2024)</div>
        <Sparkline data={disease.yearlyPapers} color={color}/>
      </div>

      {/* PubMed Link */}
      <div style={{ padding:'0 16px 12px' }}>
        <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date`}
          target="_blank" rel="noopener noreferrer"
          style={{ display:'block', textAlign:'center', padding:'8px 0', borderRadius:6, background:color+'22', color, textDecoration:'none', fontSize:11, fontWeight:500 }}>
          View on PubMed →
        </a>
      </div>

      {/* Connections */}
      <div style={{ padding:'0 16px 16px' }}>
        <div style={{ color:'#475569', fontSize:9, marginBottom:6 }}>Connections ({conns.length})</div>
        <div style={{ maxHeight:240, overflowY:'auto' }}>
          {conns.map((c, i) => {
            const cc2 = CATEGORY_COLORS[c.d.category];
            const ta = c.t==='up'?'↑':c.t==='down'?'↓':'→';
            return (
              <div key={i} onClick={() => onSelect(c.oi)} style={{
                display:'flex', alignItems:'center', gap:8, padding:'5px 6px', cursor:'pointer', borderRadius:4, borderBottom:'1px solid rgba(255,255,255,0.03)',
              }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:cc2, flexShrink:0 }}/>
                <span style={{ flex:1, color:'#94a3b8' }}>{c.d.label}</span>
                <span style={{ color:'#475569', fontSize:10 }}>{fmt(c.sp)}</span>
                <span style={{ color:c.t==='up'?'#22c55e':c.t==='down'?'#ef4444':'#64748b', fontSize:10 }}>{ta}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SB({ label, val, sub, vc }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:6, padding:'8px 10px', border:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ color:'#475569', fontSize:9, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:600, color:vc||'#e2e8f0' }}>{val} {sub && <span style={{ fontSize:10, fontWeight:400 }}>{sub}</span>}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function MedGalaxy() {
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const iMeshRef = useRef(null);
  const edgeMeshRef = useRef(null);
  const catPosRef = useRef(null);
  const netPosRef = useRef(null);
  const dataRef = useRef(null);
  const proxiesRef = useRef([]);
  const flyRef = useRef(null);
  const mdRef = useRef({ x:0, y:0 }); // mousedown pos
  const frameRef = useRef(0);
  const hoverIdxRef = useRef(-1); // current hover (mutable, no re-render)

  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tipPos, setTipPos] = useState({ x:0, y:0 });
  const [cursor, setCursor] = useState('default');

  const selectDisease = useCallback((idx) => {
    const data = dataRef.current;
    if (!data) return;
    setSelectedNode({ index: idx, disease: data.diseases[idx] });
    // Fly-to
    const p = catPosRef.current[idx];
    const ctrl = controlsRef.current;
    if (ctrl) {
      flyRef.current = {
        st: ctrl.target.clone(), et: new THREE.Vector3(p[0],p[1],p[2]),
        sr: ctrl.radius, er: Math.max(150, ctrl.radius*0.5),
        f: 0, total: 50,
      };
    }
  }, []);

  const deselect = useCallback(() => { setSelectedNode(null); }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tier = detectTier();
    const cfg = TIER_CONFIG[tier];
    const data = processData(diseasesData, connectionsData);
    dataRef.current = data;
    const { diseases, layoutEdges, displayEdges } = data;

    const { categoryPositions, networkPositions } = computeLayouts(diseases, layoutEdges);
    catPosRef.current = categoryPositions;
    netPosRef.current = networkPositions;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth/container.clientHeight, 1, 5000);
    camera.position.set(0,0,800);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.dprCap));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const ptLight = new THREE.PointLight(0xffffff, 0.8, 0);
    scene.add(ptLight);

    // ── Nodes ──
    const count = diseases.length;
    const sGeo = new THREE.SphereGeometry(1, 16, 16);
    const sMat = new THREE.MeshPhongMaterial({ emissiveIntensity:0.3, shininess:30 });
    const iMesh = new THREE.InstancedMesh(sGeo, sMat, count);
    const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      v3.set(...categoryPositions[i]);
      const r = nodeRadius(diseases[i].papers);
      s3.set(r,r,r); m4.compose(v3,q4,s3);
      iMesh.setMatrixAt(i, m4);
      iMesh.setColorAt(i, new THREE.Color(CATEGORY_COLORS[diseases[i].category]));
    }
    iMesh.instanceMatrix.needsUpdate = true;
    iMesh.instanceColor.needsUpdate = true;
    scene.add(iMesh);
    iMeshRef.current = iMesh;

    // ── Proxy spheres for raycasting ──
    const pGeo = new THREE.SphereGeometry(1, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ visible:false });
    const proxyGroup = new THREE.Group();
    const proxies = [];
    for (let i = 0; i < count; i++) {
      const pr = new THREE.Mesh(pGeo, pMat);
      pr.position.set(...categoryPositions[i]);
      const r = Math.max(nodeRadius(diseases[i].papers), 3);
      pr.scale.set(r,r,r);
      pr.userData.idx = i;
      proxyGroup.add(pr);
      proxies.push(pr);
    }
    scene.add(proxyGroup);
    proxiesRef.current = proxies;

    // ── Edges ──
    const eCount = displayEdges.length;
    const eBuf = new Float32Array(eCount * 6);
    for (let i = 0; i < eCount; i++) {
      const e = displayEdges[i], s = categoryPositions[e.si], t = categoryPositions[e.ti], o = i*6;
      eBuf[o]=s[0]; eBuf[o+1]=s[1]; eBuf[o+2]=s[2];
      eBuf[o+3]=t[0]; eBuf[o+4]=t[1]; eBuf[o+5]=t[2];
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(eBuf, 3));
    const eColors = new Float32Array(eCount * 6).fill(1.0);
    eGeo.setAttribute('color', new THREE.BufferAttribute(eColors, 3));
    const eMat = new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.08 });
    const eMesh = new THREE.LineSegments(eGeo, eMat);
    scene.add(eMesh);
    edgeMeshRef.current = eMesh;

    // ── Raycasting + click detection ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMM(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
      mouse.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
      setTipPos({ x: e.clientX, y: e.clientY });
    }
    function onMD(e) { mdRef.current = { x:e.clientX, y:e.clientY }; }
    function onMU(e) {
      const dx = e.clientX - mdRef.current.x, dy = e.clientY - mdRef.current.y;
      if (Math.sqrt(dx*dx+dy*dy) < 5) {
        if (hoverIdxRef.current >= 0) selectDisease(hoverIdxRef.current);
        else deselect();
      }
    }

    renderer.domElement.addEventListener('mousemove', onMM);
    renderer.domElement.addEventListener('mousedown', onMD);
    renderer.domElement.addEventListener('mouseup', onMU);

    // ── Animation loop ──
    let alive = true;
    function animate() {
      if (!alive) return;
      const frame = ++frameRef.current;

      // Fly-to
      const fly = flyRef.current;
      if (fly) {
        fly.f++;
        const t = Math.min(fly.f / fly.total, 1);
        const ease = 1 - Math.pow(1-t, 3);
        controls.target.lerpVectors(fly.st, fly.et, ease);
        controls.radius = fly.sr + (fly.er - fly.sr) * ease;
        if (t >= 1) flyRef.current = null;
      }

      controls.update();
      ptLight.position.copy(camera.position);

      // Raycast every 2 frames — only update state when index changes
      if (frame % 2 === 0) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(proxies);
        const newIdx = hits.length > 0 ? hits[0].object.userData.idx : -1;
        if (newIdx !== hoverIdxRef.current) {
          hoverIdxRef.current = newIdx;
          if (newIdx >= 0) {
            setHoveredNode({ index: newIdx, disease: diseases[newIdx] });
            setCursor('pointer');
          } else {
            setHoveredNode(null);
            setCursor('default');
          }
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    // Resize
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      camera.aspect = width/height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    ro.observe(container);

    return () => {
      alive = false; ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('mousemove', onMM);
      renderer.domElement.removeEventListener('mousedown', onMD);
      renderer.domElement.removeEventListener('mouseup', onMU);
      sGeo.dispose(); sMat.dispose(); pGeo.dispose(); pMat.dispose();
      eGeo.dispose(); eMat.dispose(); iMesh.dispose(); renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [selectDisease, deselect]);

  // ── Highlight effect (runs on hover/select change) ──
  useEffect(() => {
    const iMesh = iMeshRef.current, eMesh = edgeMeshRef.current, data = dataRef.current;
    if (!iMesh || !eMesh || !data) return;

    const hIdx = hoveredNode ? hoveredNode.index : -1;
    const sIdx = selectedNode ? selectedNode.index : -1;
    const aIdx = hIdx >= 0 ? hIdx : sIdx;
    const nbrs = aIdx >= 0 ? data.neighbors.get(aIdx) : null;
    const { diseases, displayEdges } = data;

    // Nodes
    for (let i = 0; i < diseases.length; i++) {
      const c = new THREE.Color(CATEGORY_COLORS[diseases[i].category]);
      if (aIdx >= 0) {
        if (i === aIdx) c.multiplyScalar(1.4);
        else if (nbrs && nbrs.has(i)) { /* keep */ }
        else c.multiplyScalar(0.25);
      }
      iMesh.setColorAt(i, c);
    }
    iMesh.instanceColor.needsUpdate = true;

    // Edges
    const ca = eMesh.geometry.getAttribute('color').array;
    for (let i = 0; i < displayEdges.length; i++) {
      const e = displayEdges[i], o = i*6;
      const bright = aIdx >= 0 && (e.si===aIdx || e.ti===aIdx);
      const v = bright ? 1.0 : (aIdx >= 0 ? 0.15 : 1.0);
      ca[o]=v; ca[o+1]=v; ca[o+2]=v; ca[o+3]=v; ca[o+4]=v; ca[o+5]=v;
    }
    eMesh.geometry.getAttribute('color').needsUpdate = true;
    eMesh.material.opacity = aIdx >= 0 ? 0.25 : 0.08;
  }, [hoveredNode, selectedNode]);

  return (
    <div ref={containerRef} style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', cursor }}>
      {hoveredNode && (!selectedNode || hoveredNode.index !== selectedNode.index) && (
        <Tooltip disease={hoveredNode.disease} connCount={dataRef.current?.connCounts.get(hoveredNode.index)||0} x={tipPos.x} y={tipPos.y}/>
      )}
      {selectedNode && dataRef.current && (
        <Sidebar disease={selectedNode.disease} data={dataRef.current} onSelect={selectDisease} onClose={deselect}/>
      )}
    </div>
  );
}
