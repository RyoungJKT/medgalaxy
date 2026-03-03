import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  tropical:'#22c55e', cancer:'#ef4444', cardiovascular:'#f97316',
  neurological:'#a855f7', respiratory:'#3b82f6', autoimmune:'#ec4899',
  metabolic:'#eab308', infectious:'#14b8a6', genetic:'#f472b6', mental:'#8b5cf6',
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);
const CAT_LABELS = {
  tropical:'Tropical / NTD', cancer:'Cancer', cardiovascular:'Cardiovascular',
  neurological:'Neurological', respiratory:'Respiratory', autoimmune:'Autoimmune',
  metabolic:'Metabolic', infectious:'Infectious', genetic:'Genetic', mental:'Mental Health',
};
const TIER_CFG = {
  HIGH:  { dprCap:99, particles:400, glowAll:true, edgesAll:true, pulse:true },
  MEDIUM:{ dprCap:1.5, particles:150, glowAll:false, edgesAll:true, pulse:true },
  LOW:   { dprCap:1.0, particles:0, glowAll:false, edgesAll:false, pulse:false },
};
function detectTier() {
  if (typeof window==='undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth<768) return 'LOW';
  return window.innerWidth<1200 ? 'MEDIUM' : 'HIGH';
}
// Node sizing: log scale mapped to [MIN_R, MAX_R] for visible size differences
const MIN_R = 2, MAX_R = 14;
const LOG_MIN = Math.log10(500), LOG_MAX = Math.log10(450000); // paper count range
const LOG_MMIN = Math.log10(2), LOG_MMAX = Math.log10(1400000); // mortality range
function nR(papers) { const t = (Math.log10(Math.max(papers,10)) - LOG_MIN) / (LOG_MAX - LOG_MIN); return MIN_R + Math.max(0, Math.min(1, t)) * (MAX_R - MIN_R); }
function nRM(mortality) { if (mortality <= 0) return MIN_R * 0.6; const t = (Math.log10(mortality) - LOG_MMIN) / (LOG_MMAX - LOG_MMIN); return MIN_R + Math.max(0, Math.min(1, t)) * (MAX_R - MIN_R); }
function fmt(n) { if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=10000) return Math.round(n/1000)+'K'; if(n>=1000) return (n/1000).toFixed(1)+'K'; return String(n); }

// ─── Data Processing ─────────────────────────────────────────────────────────
function processData(diseases, connections) {
  const idMap = {};
  diseases.forEach((d,i) => { idMap[d.id]=i; });
  const edges = connections.map(c => {
    const si=idMap[c.source], ti=idMap[c.target];
    return { ...c, si, ti, score: c.sharedPapers/Math.sqrt(diseases[si].papers*diseases[ti].papers) };
  });
  const neb = new Map(); diseases.forEach((_,i)=>neb.set(i,[]));
  edges.forEach((e,ei) => { neb.get(e.si).push({ei,score:e.score}); neb.get(e.ti).push({ei,score:e.score}); });
  const ls = new Set();
  neb.forEach(arr => { arr.sort((a,b)=>b.score-a.score); arr.slice(0,7).forEach(({ei})=>ls.add(ei)); });
  const neighbors = new Map(), connCounts = new Map();
  diseases.forEach((_,i) => { neighbors.set(i,new Set()); connCounts.set(i,0); });
  edges.forEach(e => { neighbors.get(e.si).add(e.ti); neighbors.get(e.ti).add(e.si); connCounts.set(e.si,connCounts.get(e.si)+1); connCounts.set(e.ti,connCounts.get(e.ti)+1); });
  return { diseases, edges, layoutEdges:[...ls].map(i=>edges[i]), displayEdges:edges, neighbors, connCounts, idMap };
}

// ─── Dual Force Layout ───────────────────────────────────────────────────────
function computeLayouts(diseases, layoutEdges) {
  const xy={}, zz={}; CATEGORIES.forEach((c,i)=>{ const a=(i/CATEGORIES.length)*Math.PI*2; xy[c]={x:Math.cos(a)*200,y:Math.sin(a)*200}; zz[c]=((i/CATEGORIES.length)-0.5)*300; });
  const ms = Math.max(...layoutEdges.map(e=>e.score),0.001);
  const ml = es=>es.map(e=>({source:e.si,target:e.ti,score:e.score}));
  function zR(ns) { for(let a=0;a<ns.length;a++) for(let b=a+1;b<ns.length;b++){ const na=ns[a],nb=ns[b],dx=na.x-nb.x,dy=na.y-nb.y,dz2=na.z-nb.z,d=Math.sqrt(dx*dx+dy*dy+dz2*dz2); if(d<30&&d>0){const f=(dz2/d)*0.5;na.z+=f;nb.z-=f;}} }
  // Category
  const cn=diseases.map((d,i)=>({index:i,category:d.category,papers:d.papers,x:xy[d.category].x+(Math.random()-0.5)*50,y:xy[d.category].y+(Math.random()-0.5)*50,z:zz[d.category]+(Math.random()-0.5)*30}));
  const cs=d3.forceSimulation(cn).force('charge',d3.forceManyBody().strength(-50)).force('link',d3.forceLink(ml(layoutEdges)).id(d=>d.index).distance(80).strength(d=>(d.score/ms)*0.5)).force('center',d3.forceCenter(0,0)).force('cx',d3.forceX(d=>xy[d.category].x).strength(0.15)).force('cy',d3.forceY(d=>xy[d.category].y).strength(0.15)).stop();
  for(let i=0;i<300;i++){cs.tick();cn.forEach(n=>{n.z+=(zz[n.category]-n.z)*0.02;});zR(cn);}
  // Network
  const nn=diseases.map((d,i)=>({index:i,category:d.category,papers:d.papers,x:(Math.random()-0.5)*400,y:(Math.random()-0.5)*400,z:(Math.random()-0.5)*200}));
  const ns2=d3.forceSimulation(nn).force('charge',d3.forceManyBody().strength(-50)).force('link',d3.forceLink(ml(layoutEdges)).id(d=>d.index).distance(80).strength(d=>(d.score/ms)*0.5)).force('center',d3.forceCenter(0,0)).force('collide',d3.forceCollide(d=>nR(d.papers)*1.2)).stop();
  for(let i=0;i<300;i++){ns2.tick();zR(nn);}
  return { catPos:cn.map(n=>[n.x,n.y,n.z]), netPos:nn.map(n=>[n.x,n.y,n.z]) };
}

// ─── Orbit Controls ──────────────────────────────────────────────────────────
class OC {
  constructor(cam,el) {
    this.cam=cam;this.el=el;this.target=new THREE.Vector3();this.theta=0;this.phi=Math.PI/2;this.radius=800;
    this.tV=0;this.pV=0;this.pnX=0;this.pnY=0;this._dr=false;this._pn=false;this._lx=0;this._ly=0;this.enabled=true;
    this._d=this._d.bind(this);this._m=this._m.bind(this);this._u=this._u.bind(this);this._w=this._w.bind(this);this._c=e=>e.preventDefault();
    el.addEventListener('mousedown',this._d);el.addEventListener('mousemove',this._m);el.addEventListener('mouseup',this._u);el.addEventListener('mouseleave',this._u);el.addEventListener('wheel',this._w,{passive:false});el.addEventListener('contextmenu',this._c);
  }
  _d(e){if(!this.enabled)return;if(e.button===2)this._pn=true;else if(e.button===0)this._dr=true;this._lx=e.clientX;this._ly=e.clientY;}
  _m(e){const dx=e.clientX-this._lx,dy=e.clientY-this._ly;this._lx=e.clientX;this._ly=e.clientY;if(this._dr&&this.enabled){this.tV-=dx*0.0045;this.pV-=dy*0.0045;}if(this._pn&&this.enabled){const s=this.radius*0.0009;this.pnX-=dx*s;this.pnY+=dy*s;}}
  _u(){this._dr=false;this._pn=false;}
  _w(e){if(!this.enabled)return;e.preventDefault();this.radius=Math.max(50,Math.min(3000,this.radius+e.deltaY*0.001*this.radius));}
  update(){
    this.theta+=this.tV;this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+this.pV));this.tV*=0.92;this.pV*=0.92;
    if(Math.abs(this.pnX)>0.001||Math.abs(this.pnY)>0.001){const r=new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld,0),u=new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld,1);this.target.addScaledVector(r,this.pnX);this.target.addScaledVector(u,this.pnY);this.pnX*=0.92;this.pnY*=0.92;}
    const sp=Math.sin(this.phi);this.cam.position.set(this.target.x+this.radius*sp*Math.sin(this.theta),this.target.y+this.radius*Math.cos(this.phi),this.target.z+this.radius*sp*Math.cos(this.theta));this.cam.lookAt(this.target);
  }
  dispose(){this.el.removeEventListener('mousedown',this._d);this.el.removeEventListener('mousemove',this._m);this.el.removeEventListener('mouseup',this._u);this.el.removeEventListener('mouseleave',this._u);this.el.removeEventListener('wheel',this._w);this.el.removeEventListener('contextmenu',this._c);}
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({data,color,w=260,h=50}){
  if(!data||!data.length) return null;
  const mx=Math.max(...data),mn=Math.min(...data),rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-4-((v-mn)/rng)*(h-8)}`).join(' ');
  const gid='sp'+color.replace('#','');
  return(<svg width={w} height={h} style={{display:'block'}}><defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs><polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/><text x="0" y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono">2014</text><text x={w} y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">2024</text></svg>);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function Tooltip({disease,connCount,x,y}){
  if(!disease) return null;
  const c=CATEGORY_COLORS[disease.category],t=disease.trend,ar=t>0?'↑':t<0?'↓':'→';
  return(<div style={{position:'fixed',left:x+15,top:y+15,pointerEvents:'none',zIndex:100,background:'rgba(10,16,30,0.94)',backdropFilter:'blur(16px)',maxWidth:240,border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'8px 12px',fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#e2e8f0'}}>
    <div style={{fontWeight:600,fontSize:12,marginBottom:3}}>{disease.label}</div>
    <span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:c+'22',color:c}}>{CAT_LABELS[disease.category]}</span>
    <div style={{color:'#94a3b8',marginTop:4}}>{fmt(disease.papers)} papers <span style={{color:t>0?'#22c55e':t<0?'#ef4444':'#94a3b8'}}>{ar}{Math.abs(t)}%</span></div>
    <div style={{color:'#64748b'}}>{connCount} connections</div>
  </div>);
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({disease,data,onSelect,onClose}){
  if(!disease) return null;
  const c=CATEGORY_COLORS[disease.category], idx=data.diseases.indexOf(disease), cc=data.connCounts.get(idx);
  const conns=data.edges.filter(e=>e.si===idx||e.ti===idx).map(e=>{const oi=e.si===idx?e.ti:e.si;return{d:data.diseases[oi],sp:e.sharedPapers,t:e.trend,oi};}).sort((a,b)=>b.sp-a.sp);
  const t=disease.trend, ar=t>0?'↑':t<0?'↓':'→', tc=t>0?'#22c55e':t<0?'#ef4444':'#94a3b8';
  const gc={high:'#ef4444',medium:'#eab308',low:'#22c55e'};
  return(<div style={{position:'absolute',top:0,right:0,width:320,height:'100%',background:'rgba(10,16,30,0.94)',backdropFilter:'blur(16px)',borderLeft:'1px solid rgba(255,255,255,0.06)',fontFamily:'IBM Plex Mono,monospace',color:'#e2e8f0',overflowY:'auto',overflowX:'hidden',zIndex:50,fontSize:11}}>
    <div style={{padding:'16px 16px 8px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{disease.label}</div><span style={{fontSize:9,padding:'2px 8px',borderRadius:4,background:c+'22',color:c}}>{CAT_LABELS[disease.category]}</span></div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 4px'}}>×</button>
      </div></div>
    <div style={{padding:'10px 16px',color:'#64748b',lineHeight:1.5}}>{disease.description}</div>
    <div style={{padding:'0 16px 12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      <SB l="Publications" v={fmt(disease.papers)} s={<span style={{color:tc}}>{ar}{Math.abs(t)}%</span>}/>
      <SB l="Connections" v={cc}/><SB l="WHO Deaths/yr" v={disease.mortality>0?fmt(disease.mortality):'N/A'}/>
      <SB l="Funding Gap" v={disease.fundingGap.toUpperCase()} vc={gc[disease.fundingGap]}/>
    </div>
    <div style={{padding:'0 16px 12px'}}><div style={{color:'#475569',fontSize:9,marginBottom:4}}>Publication Trend (2014–2024)</div><Sparkline data={disease.yearlyPapers} color={c}/></div>
    <div style={{padding:'0 16px 12px'}}><a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date`} target="_blank" rel="noopener noreferrer" style={{display:'block',textAlign:'center',padding:'8px 0',borderRadius:6,background:c+'22',color:c,textDecoration:'none',fontSize:11,fontWeight:500}}>View on PubMed →</a></div>
    <div style={{padding:'0 16px 16px'}}><div style={{color:'#475569',fontSize:9,marginBottom:6}}>Connections ({conns.length})</div>
      <div style={{maxHeight:240,overflowY:'auto'}}>{conns.map((cn,i)=>{const cc2=CATEGORY_COLORS[cn.d.category],ta=cn.t==='up'?'↑':cn.t==='down'?'↓':'→';return(
        <div key={i} onClick={()=>onSelect(cn.oi)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 6px',cursor:'pointer',borderRadius:4,borderBottom:'1px solid rgba(255,255,255,0.03)'}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:cc2,flexShrink:0}}/><span style={{flex:1,color:'#94a3b8'}}>{cn.d.label}</span><span style={{color:'#475569',fontSize:10}}>{fmt(cn.sp)}</span><span style={{color:cn.t==='up'?'#22c55e':cn.t==='down'?'#ef4444':'#64748b',fontSize:10}}>{ta}</span>
        </div>);})}</div></div>
  </div>);
}
function SB({l,v,s,vc}){return(<div style={{background:'rgba(255,255,255,0.03)',borderRadius:6,padding:'8px 10px',border:'1px solid rgba(255,255,255,0.04)'}}><div style={{color:'#475569',fontSize:9,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600,color:vc||'#e2e8f0'}}>{v} {s&&<span style={{fontSize:10,fontWeight:400}}>{s}</span>}</div></div>);}

// ─── Header Bar ──────────────────────────────────────────────────────────────
function Header({ diseaseCount, edgeCount, searchQuery, onSearchChange, sizeMode, onSizeToggle, layoutMode, onLayoutToggle }) {
  return (
    <div style={{position:'absolute',top:0,left:0,right:0,zIndex:40,padding:'10px 16px',display:'flex',alignItems:'center',gap:12,fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#e2e8f0',background:'linear-gradient(180deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',pointerEvents:'none'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,pointerEvents:'auto'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px #22c55e',animation:'pulse 2s infinite'}}/>
        <span style={{fontWeight:600,fontSize:13}}>MedGalaxy</span>
        <span style={{color:'#475569',fontSize:10}}>{diseaseCount} diseases · {edgeCount} connections</span>
      </div>
      <div style={{flex:1}}/>
      {/* Search */}
      <div style={{position:'relative',pointerEvents:'auto'}}>
        <input value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder="Search diseases..."
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'5px 10px',color:'#e2e8f0',fontSize:11,fontFamily:'inherit',width:180,outline:'none'}}/>
      </div>
      {/* Size toggle */}
      <div style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',pointerEvents:'auto'}}>
        {['papers','mortality'].map(m=>(<button key={m} onClick={()=>onSizeToggle(m)} style={{padding:'4px 10px',fontSize:10,fontFamily:'inherit',border:'none',cursor:'pointer',background:sizeMode===m?'rgba(255,255,255,0.12)':'transparent',color:sizeMode===m?'#e2e8f0':'#64748b'}}>{m==='papers'?'Papers':'Mortality'}</button>))}
      </div>
      {/* Layout toggle */}
      <div style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',pointerEvents:'auto'}}>
        {['category','network'].map(m=>(<button key={m} onClick={()=>onLayoutToggle(m)} style={{padding:'4px 10px',fontSize:10,fontFamily:'inherit',border:'none',cursor:'pointer',background:layoutMode===m?'rgba(255,255,255,0.12)':'transparent',color:layoutMode===m?'#e2e8f0':'#64748b'}}>{m==='category'?'Category':'Network'}</button>))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ─── Category Filter Bar ─────────────────────────────────────────────────────
function FilterBar({ activeCategories, onToggle }) {
  const allActive = activeCategories.size === CATEGORIES.length;
  return (
    <div style={{position:'absolute',top:44,left:0,right:0,zIndex:40,padding:'0 16px',display:'flex',flexWrap:'wrap',gap:4,fontFamily:'IBM Plex Mono,monospace',fontSize:10,pointerEvents:'none'}}>
      <button onClick={()=>onToggle('ALL')} style={{pointerEvents:'auto',padding:'3px 10px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontFamily:'inherit',fontSize:10,background:allActive?'rgba(255,255,255,0.12)':'transparent',color:allActive?'#e2e8f0':'#64748b'}}>ALL</button>
      {CATEGORIES.map(cat=>{const on=activeCategories.has(cat);return(
        <button key={cat} onClick={()=>onToggle(cat)} style={{pointerEvents:'auto',padding:'3px 10px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontFamily:'inherit',fontSize:10,display:'flex',alignItems:'center',gap:4,background:on?'rgba(255,255,255,0.08)':'transparent',color:on?'#e2e8f0':'#475569',opacity:on?1:0.5}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:CATEGORY_COLORS[cat]}}/>{CAT_LABELS[cat]}
        </button>);
      })}
    </div>
  );
}

// ─── Search Autocomplete ─────────────────────────────────────────────────────
function SearchDropdown({ query, diseases, onSelect }) {
  if (!query || query.length < 1) return null;
  const q = query.toLowerCase();
  const matches = diseases.filter(d => d.label.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) return null;
  return (
    <div style={{position:'absolute',top:40,right:260,zIndex:60,background:'rgba(10,16,30,0.96)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:4,fontFamily:'IBM Plex Mono,monospace',fontSize:11,minWidth:200}}>
      {matches.map(d=>(
        <div key={d.id} onClick={()=>onSelect(d)} style={{padding:'5px 8px',cursor:'pointer',borderRadius:4,color:'#e2e8f0',display:'flex',alignItems:'center',gap:6}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:CATEGORY_COLORS[d.category]}}/>
          {d.label}
        </div>))}
    </div>
  );
}

// ─── Legend Bar ───────────────────────────────────────────────────────────────
function Legend({ sizeMode, layoutMode }) {
  return (
    <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:40,padding:'8px 16px',display:'flex',gap:16,fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#475569',background:'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',pointerEvents:'none'}}>
      <span>Node size = {sizeMode==='papers'?'publications':'mortality'}</span>
      <span>Layout = {layoutMode==='category'?'Category clusters':'Network connections'}</span>
      <span>Drag to rotate · Scroll to zoom · Right-drag to pan</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function MedGalaxy() {
  const containerRef=useRef(null),cameraRef=useRef(null),rendererRef=useRef(null),controlsRef=useRef(null);
  const iMeshRef=useRef(null),edgeMeshRef=useRef(null),catPosRef=useRef(null),netPosRef=useRef(null);
  const dataRef=useRef(null),proxiesRef=useRef([]),flyRef=useRef(null),mdRef=useRef({x:0,y:0});
  const frameRef=useRef(0),hoverIdxRef=useRef(-1);
  // Animation refs for smooth transitions
  const sizeAnimRef = useRef(null); // { from:[], to:[], f:0, total:60 }
  const layoutAnimRef = useRef(null); // { from:[], to:[], f:0, total:60 }
  const curPosRef = useRef(null); // current node positions [x,y,z][]

  const [hoveredNode,setHoveredNode] = useState(null);
  const [selectedNode,setSelectedNode] = useState(null);
  const [tipPos,setTipPos] = useState({x:0,y:0});
  const [cursor,setCursor] = useState('default');
  const [activeCategories,setActiveCategories] = useState(()=>new Set(CATEGORIES));
  const [searchQuery,setSearchQuery] = useState('');
  const [sizeMode,setSizeMode] = useState('papers');
  const [layoutMode,setLayoutMode] = useState('category');

  const selectDisease = useCallback((idx)=>{
    const data=dataRef.current; if(!data) return;
    setSelectedNode({index:idx,disease:data.diseases[idx]});
    const p=curPosRef.current?curPosRef.current[idx]:catPosRef.current[idx];
    const ctrl=controlsRef.current;
    if(ctrl) flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(p[0],p[1],p[2]),sr:ctrl.radius,er:Math.max(150,ctrl.radius*0.5),f:0,total:50};
  },[]);
  const deselect = useCallback(()=>{setSelectedNode(null);},[]);

  // Toggle category filter
  const toggleCategory = useCallback((cat)=>{
    setActiveCategories(prev=>{
      if(cat==='ALL') return prev.size===CATEGORIES.length ? new Set() : new Set(CATEGORIES);
      const next=new Set(prev);
      if(next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  },[]);

  // Size toggle with animation
  const handleSizeToggle = useCallback((mode)=>{
    if(mode===sizeMode) return;
    setSizeMode(mode);
    const data=dataRef.current; if(!data) return;
    const from=data.diseases.map(d=>nR(d.papers));
    const to=data.diseases.map(d=>mode==='papers'?nR(d.papers):nRM(d.mortality));
    sizeAnimRef.current={from,to,f:0,total:60};
  },[sizeMode]);

  // Layout toggle with animation
  const handleLayoutToggle = useCallback((mode)=>{
    if(mode===layoutMode) return;
    setLayoutMode(mode);
    const cp=catPosRef.current, np=netPosRef.current;
    if(!cp||!np) return;
    const from=curPosRef.current||(layoutMode==='category'?cp:np);
    const to=mode==='category'?cp:np;
    layoutAnimRef.current={from,to,f:0,total:60};
  },[layoutMode]);

  // Search select
  const handleSearchSelect = useCallback((disease)=>{
    const data=dataRef.current; if(!data) return;
    const idx=data.idMap[disease.id];
    if(idx!==undefined) { selectDisease(idx); setSearchQuery(''); }
  },[selectDisease]);

  useEffect(()=>{
    const container=containerRef.current; if(!container) return;
    const tier=detectTier(), cfg=TIER_CFG[tier];
    const data=processData(diseasesData,connectionsData);
    dataRef.current=data;
    const {diseases,layoutEdges,displayEdges}=data;
    const {catPos,netPos}=computeLayouts(diseases,layoutEdges);
    catPosRef.current=catPos; netPosRef.current=netPos;
    curPosRef.current=catPos.map(p=>[...p]); // mutable copy

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(60,container.clientWidth/container.clientHeight,1,5000);
    camera.position.set(0,0,800); cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(container.clientWidth,container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,cfg.dprCap));
    renderer.setClearColor(0x000000,0);
    container.appendChild(renderer.domElement); rendererRef.current=renderer;
    const controls=new OC(camera,renderer.domElement); controlsRef.current=controls;

    scene.add(new THREE.AmbientLight(0xffffff,0.4));
    const ptL=new THREE.PointLight(0xffffff,0.8,0); scene.add(ptL);

    // Nodes
    const count=diseases.length;
    const sGeo=new THREE.SphereGeometry(1,16,16), sMat=new THREE.MeshPhongMaterial({emissiveIntensity:0.3,shininess:30});
    const iMesh=new THREE.InstancedMesh(sGeo,sMat,count);
    const m4=new THREE.Matrix4(),v3=new THREE.Vector3(),q4=new THREE.Quaternion(),s3=new THREE.Vector3();
    for(let i=0;i<count;i++){v3.set(...catPos[i]);const r=nR(diseases[i].papers);s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);iMesh.setColorAt(i,new THREE.Color(CATEGORY_COLORS[diseases[i].category]));}
    iMesh.instanceMatrix.needsUpdate=true;iMesh.instanceColor.needsUpdate=true;scene.add(iMesh);iMeshRef.current=iMesh;

    // Proxies
    const pGeo=new THREE.SphereGeometry(1,8,8),pMat=new THREE.MeshBasicMaterial({visible:false});
    const pGroup=new THREE.Group(),proxies=[];
    for(let i=0;i<count;i++){const pr=new THREE.Mesh(pGeo,pMat);pr.position.set(...catPos[i]);const r=Math.max(nR(diseases[i].papers),3);pr.scale.set(r,r,r);pr.userData.idx=i;pGroup.add(pr);proxies.push(pr);}
    scene.add(pGroup);proxiesRef.current=proxies;

    // Edges
    const eC=displayEdges.length,eBuf=new Float32Array(eC*6);
    for(let i=0;i<eC;i++){const e=displayEdges[i],s=catPos[e.si],t=catPos[e.ti],o=i*6;eBuf[o]=s[0];eBuf[o+1]=s[1];eBuf[o+2]=s[2];eBuf[o+3]=t[0];eBuf[o+4]=t[1];eBuf[o+5]=t[2];}
    const eGeo=new THREE.BufferGeometry();eGeo.setAttribute('position',new THREE.BufferAttribute(eBuf,3));
    const eClr=new Float32Array(eC*6).fill(1.0);eGeo.setAttribute('color',new THREE.BufferAttribute(eClr,3));
    const eMat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.08});
    const eMesh=new THREE.LineSegments(eGeo,eMat);scene.add(eMesh);edgeMeshRef.current=eMesh;

    // Mouse handlers
    const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
    function onMM(e){const rc=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-rc.left)/rc.width)*2-1;mouse.y=-((e.clientY-rc.top)/rc.height)*2+1;setTipPos({x:e.clientX,y:e.clientY});}
    function onMD(e){mdRef.current={x:e.clientX,y:e.clientY};}
    function onMU(e){const dx=e.clientX-mdRef.current.x,dy=e.clientY-mdRef.current.y;if(Math.sqrt(dx*dx+dy*dy)<5){if(hoverIdxRef.current>=0)selectDisease(hoverIdxRef.current);else deselect();}}
    renderer.domElement.addEventListener('mousemove',onMM);renderer.domElement.addEventListener('mousedown',onMD);renderer.domElement.addEventListener('mouseup',onMU);

    // Animation
    let alive=true;
    function animate(){
      if(!alive) return;
      const frame=++frameRef.current;

      // Layout lerp animation
      const la=layoutAnimRef.current;
      if(la){
        la.f++;const t=Math.min(la.f/la.total,1),ease=1-Math.pow(1-t,3);
        const cur=curPosRef.current;
        for(let i=0;i<count;i++){
          cur[i][0]=la.from[i][0]+(la.to[i][0]-la.from[i][0])*ease;
          cur[i][1]=la.from[i][1]+(la.to[i][1]-la.from[i][1])*ease;
          cur[i][2]=la.from[i][2]+(la.to[i][2]-la.from[i][2])*ease;
        }
        if(t>=1) layoutAnimRef.current=null;
        // Update node positions + edges
        for(let i=0;i<count;i++){v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);}
        iMesh.instanceMatrix.needsUpdate=true;
        const ep=eGeo.getAttribute('position').array;
        for(let i=0;i<eC;i++){const e=displayEdges[i],s=cur[e.si],t2=cur[e.ti],o=i*6;ep[o]=s[0];ep[o+1]=s[1];ep[o+2]=s[2];ep[o+3]=t2[0];ep[o+4]=t2[1];ep[o+5]=t2[2];}
        eGeo.getAttribute('position').needsUpdate=true;
      }

      // Size lerp animation
      const sa=sizeAnimRef.current;
      if(sa){
        sa.f++;const t=Math.min(sa.f/sa.total,1),ease=1-Math.pow(1-t,3);
        const cur=curPosRef.current;
        for(let i=0;i<count;i++){
          const r=sa.from[i]+(sa.to[i]-sa.from[i])*ease;
          v3.set(cur[i][0],cur[i][1],cur[i][2]);s3.set(r,r,r);m4.compose(v3,q4,s3);
          iMesh.setMatrixAt(i,m4);
          proxies[i].scale.set(Math.max(r,3),Math.max(r,3),Math.max(r,3));
        }
        iMesh.instanceMatrix.needsUpdate=true;
        if(t>=1) sizeAnimRef.current=null;
      }

      // Fly-to
      const fly=flyRef.current;
      if(fly){fly.f++;const t=Math.min(fly.f/fly.total,1),ease=1-Math.pow(1-t,3);controls.target.lerpVectors(fly.st,fly.et,ease);controls.radius=fly.sr+(fly.er-fly.sr)*ease;if(t>=1)flyRef.current=null;}

      controls.update(); ptL.position.copy(camera.position);

      // Raycast
      if(frame%2===0){
        raycaster.setFromCamera(mouse,camera);
        const hits=raycaster.intersectObjects(proxies);
        const ni=hits.length>0?hits[0].object.userData.idx:-1;
        if(ni!==hoverIdxRef.current){hoverIdxRef.current=ni;if(ni>=0){setHoveredNode({index:ni,disease:diseases[ni]});setCursor('pointer');}else{setHoveredNode(null);setCursor('default');}}
      }
      renderer.render(scene,camera);requestAnimationFrame(animate);
    }
    animate();

    const ro=new ResizeObserver(([e])=>{const{width:w,height:h}=e.contentRect;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});
    ro.observe(container);
    return()=>{alive=false;ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('mousemove',onMM);renderer.domElement.removeEventListener('mousedown',onMD);renderer.domElement.removeEventListener('mouseup',onMU);sGeo.dispose();sMat.dispose();pGeo.dispose();pMat.dispose();eGeo.dispose();eMat.dispose();iMesh.dispose();renderer.dispose();if(container.contains(renderer.domElement))container.removeChild(renderer.domElement);};
  },[selectDisease,deselect]);

  // ── Highlight (hover/select + category filter + search) ──
  useEffect(()=>{
    const iMesh=iMeshRef.current,eMesh=edgeMeshRef.current,data=dataRef.current;
    if(!iMesh||!eMesh||!data) return;
    const hIdx=hoveredNode?hoveredNode.index:-1,sIdx=selectedNode?selectedNode.index:-1;
    const aIdx=hIdx>=0?hIdx:sIdx;
    const nbrs=aIdx>=0?data.neighbors.get(aIdx):null;
    const {diseases,displayEdges}=data;
    const sq=searchQuery.toLowerCase();

    for(let i=0;i<diseases.length;i++){
      const d=diseases[i], c=new THREE.Color(CATEGORY_COLORS[d.category]);
      const catVisible=activeCategories.has(d.category);
      const searchMatch=!sq||d.label.toLowerCase().includes(sq);
      if(!catVisible){ c.multiplyScalar(0.05); }
      else if(aIdx>=0){
        if(i===aIdx) c.multiplyScalar(1.4);
        else if(nbrs&&nbrs.has(i)){}
        else c.multiplyScalar(0.25);
      } else if(sq&&!searchMatch){ c.multiplyScalar(0.15); }
      iMesh.setColorAt(i,c);

      // Scale hidden categories to 0
      if(!catVisible&&!sizeAnimRef.current&&!layoutAnimRef.current){
        const m=new THREE.Matrix4();iMesh.getMatrixAt(i,m);
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
        m.decompose(p,q,s);s.set(0.001,0.001,0.001);m.compose(p,q,s);iMesh.setMatrixAt(i,m);
      } else if(catVisible&&!sizeAnimRef.current&&!layoutAnimRef.current){
        const cur=curPosRef.current;if(cur){
          const r=sizeMode==='papers'?nR(d.papers):nRM(d.mortality);
          const p2=new THREE.Vector3(cur[i][0],cur[i][1],cur[i][2]);
          const s2=new THREE.Vector3(r,r,r);const m2=new THREE.Matrix4();m2.compose(p2,new THREE.Quaternion(),s2);iMesh.setMatrixAt(i,m2);
        }
      }
    }
    iMesh.instanceColor.needsUpdate=true;iMesh.instanceMatrix.needsUpdate=true;

    const ca=eMesh.geometry.getAttribute('color').array;
    for(let i=0;i<displayEdges.length;i++){
      const e=displayEdges[i],o=i*6;
      const srcVis=activeCategories.has(diseases[e.si].category);
      const tgtVis=activeCategories.has(diseases[e.ti].category);
      if(!srcVis||!tgtVis){ca[o]=0;ca[o+1]=0;ca[o+2]=0;ca[o+3]=0;ca[o+4]=0;ca[o+5]=0;continue;}
      const bright=aIdx>=0&&(e.si===aIdx||e.ti===aIdx);
      const v=bright?1.0:(aIdx>=0?0.15:1.0);
      ca[o]=v;ca[o+1]=v;ca[o+2]=v;ca[o+3]=v;ca[o+4]=v;ca[o+5]=v;
    }
    eMesh.geometry.getAttribute('color').needsUpdate=true;
    eMesh.material.opacity=aIdx>=0?0.25:0.08;
  },[hoveredNode,selectedNode,activeCategories,searchQuery,sizeMode]);

  return(
    <div ref={containerRef} style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',cursor}}>
      <Header diseaseCount={diseasesData.length} edgeCount={connectionsData.length}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        sizeMode={sizeMode} onSizeToggle={handleSizeToggle}
        layoutMode={layoutMode} onLayoutToggle={handleLayoutToggle}/>
      <FilterBar activeCategories={activeCategories} onToggle={toggleCategory}/>
      <Legend sizeMode={sizeMode} layoutMode={layoutMode}/>
      {searchQuery && dataRef.current && <SearchDropdown query={searchQuery} diseases={dataRef.current.diseases} onSelect={handleSearchSelect}/>}
      {hoveredNode&&(!selectedNode||hoveredNode.index!==selectedNode.index)&&(
        <Tooltip disease={hoveredNode.disease} connCount={dataRef.current?.connCounts.get(hoveredNode.index)||0} x={tipPos.x} y={tipPos.y}/>)}
      {selectedNode&&dataRef.current&&(<Sidebar disease={selectedNode.disease} data={dataRef.current} onSelect={selectDisease} onClose={deselect}/>)}
    </div>
  );
}
