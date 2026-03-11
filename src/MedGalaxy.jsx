import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';
import * as d3 from 'd3';
import diseasesData from '../data/diseases.json';
import connectionsData from '../data/connections.json';

// ─── Constants ───────────────────────────────────────────────────────────────
// Vibrant saturated palette
const CC = {
  tropical:'#00ff6a', cancer:'#ff3333', cardiovascular:'#ff8c1a',
  neurological:'#b44dff', respiratory:'#3399ff', autoimmune:'#ff3d8e',
  metabolic:'#ffd500', infectious:'#00e6b8', genetic:'#ff5cbf', mental:'#7c3aed',
};
const CATS = Object.keys(CC);
const CL = {
  tropical:'Tropical / NTD', cancer:'Cancer', cardiovascular:'Cardiovascular',
  neurological:'Neurological', respiratory:'Respiratory', autoimmune:'Autoimmune',
  metabolic:'Metabolic', infectious:'Infectious', genetic:'Genetic', mental:'Mental Health',
};
// Neglect score: papers-per-death ratio → color gradient
function neglectColor(ppd){
  // ppd: papers per death. High = well-researched (green), low = neglected (red)
  if(ppd<=0)return'#22c55e'; // no mortality data → treat as well-researched
  const t=Math.max(0,Math.min(1,(Math.log10(ppd)+2)/3.5)); // -2..1.5 → 0..1
  // Red → Orange → Yellow → Green
  const stops=[[239,68,68],[245,158,11],[234,179,8],[34,197,94]];
  const s=t*(stops.length-1),i=Math.min(Math.floor(s),stops.length-2),f=s-i;
  const a=stops[i],b=stops[i+1];
  return`rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}
const TC = {
  HIGH:  { dprCap:99, particles:400, glowAll:true, pulse:true },
  MEDIUM:{ dprCap:1.5, particles:150, glowAll:false, pulse:true },
  LOW:   { dprCap:1, particles:0, glowAll:false, pulse:false },
};
function dTier() {
  if (typeof window==='undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth<768) return 'LOW';
  return window.innerWidth<1200 ? 'MEDIUM' : 'HIGH';
}
function isMob(){return typeof window!=='undefined'&&(matchMedia('(pointer:coarse)').matches||window.innerWidth<768);}
// Node sizing: extreme power-law for maximum size contrast
const MN=0.3, MX=55, MAX_PAPERS=450000, MAX_MORT=1400000;
function nR(p){return MN+Math.pow(Math.min(p,MAX_PAPERS)/MAX_PAPERS,0.45)*(MX-MN);}
function nRM(m){if(m<=0)return MN*0.2;return MN+Math.pow(Math.min(m,MAX_MORT)/MAX_MORT,0.45)*(MX-MN);}
function fmt(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=10000)return Math.round(n/1000)+'K';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}

// ─── Data Processing ─────────────────────────────────────────────────────────
function processData(diseases, connections) {
  const idMap={};diseases.forEach((d,i)=>{idMap[d.id]=i;});
  const edges=connections.map(c=>{const si=idMap[c.source],ti=idMap[c.target];return{...c,si,ti,score:c.sharedPapers/Math.sqrt(diseases[si].papers*diseases[ti].papers)};});
  const neb=new Map();diseases.forEach((_,i)=>neb.set(i,[]));
  edges.forEach((e,ei)=>{neb.get(e.si).push({ei,score:e.score});neb.get(e.ti).push({ei,score:e.score});});
  const ls=new Set();neb.forEach(arr=>{arr.sort((a,b)=>b.score-a.score);arr.slice(0,7).forEach(({ei})=>ls.add(ei));});
  const neighbors=new Map(),connCounts=new Map();
  diseases.forEach((_,i)=>{neighbors.set(i,new Set());connCounts.set(i,0);});
  edges.forEach(e=>{neighbors.get(e.si).add(e.ti);neighbors.get(e.ti).add(e.si);connCounts.set(e.si,connCounts.get(e.si)+1);connCounts.set(e.ti,connCounts.get(e.ti)+1);});
  return{diseases,edges,layoutEdges:[...ls].map(i=>edges[i]),displayEdges:edges,neighbors,connCounts,idMap};
}

// ─── Force Layout ────────────────────────────────────────────────────────────
function computeLayouts(diseases, layoutEdges) {
  const ms=Math.max(...layoutEdges.map(e=>e.score),0.001);
  const ml=es=>es.map(e=>({source:e.si,target:e.ti,score:e.score}));

  // ── Solar Layout: biggest in center, others orbit outward by paper rank ──
  // Sort by papers descending to get rank
  const ranked=[...diseases].map((d,i)=>({i,papers:d.papers})).sort((a,b)=>b.papers-a.papers);
  const rankMap=new Map();ranked.forEach((r,rank)=>rankMap.set(r.i,rank));
  const maxPapers=ranked[0].papers;

  // Sun + planets layout: rank 0 at center, others orbit outward.
  // Orbits computed cumulatively so each node clears the previous shell.
  const goldenAngle=Math.PI*(3-Math.sqrt(5)); // ~2.3999 rad, true golden angle
  const N=diseases.length;
  // Compute cumulative orbit radii based on actual node sizes
  const PAD=4; // gap between node edges
  let cumOrbit=0;
  const orbitByRank=new Array(N);
  for(let rank=0;rank<N;rank++){
    const idx=ranked[rank].i,r=nR(diseases[idx].papers);
    if(rank===0){orbitByRank[rank]=0;cumOrbit=r+PAD;}
    else{orbitByRank[rank]=cumOrbit+r;cumOrbit=orbitByRank[rank]+r+PAD;}
  }
  // Hybrid compression: keep inner orbits intact (big nodes need room),
  // compress outer range so small nodes aren't too far away.
  const rawCum=cumOrbit||1;
  const INNER=300; // preserve exact spacing below this orbit
  const OUTER_RANGE=500; // compressed range for everything beyond INNER
  function compressOrbit(raw){
    if(raw<=INNER) return raw;
    return INNER+Math.pow((raw-INNER)/(rawCum-INNER||1),0.5)*OUTER_RANGE;
  }
  const rawMax=compressOrbit(rawCum);

  // Use golden-ratio scatter so big nodes aren't all at the same pole.
  // rank → orbit distance, scattered fibIdx → Fibonacci direction.
  const cn=diseases.map((d,i)=>{
    const rank=rankMap.get(i);
    if(rank===0) return{index:i,r:nR(d.papers),category:d.category,papers:d.papers,x:0,y:0,z:0};
    const orbit=compressOrbit(orbitByRank[rank]);
    // Scatter rank across Fibonacci sphere using golden ratio
    const fibIdx=Math.floor((rank*0.618033988749895*N)%N);
    const ft=(fibIdx+0.5)/N;
    const uz=1-2*ft;
    const theta=goldenAngle*fibIdx;
    const rXY=Math.sqrt(1-uz*uz);
    return{index:i,r:nR(d.papers),category:d.category,papers:d.papers,
      x:rXY*Math.cos(theta)*orbit,y:rXY*Math.sin(theta)*orbit,z:uz*orbit};
  });

  // Debug: check for NaN, shell vs volume, orbit range
  let nanCount=0,minOrbit=1e9,maxOrbit=-1e9;
  cn.forEach(n=>{
    if(![n.x,n.y,n.z].every(Number.isFinite))nanCount++;
    const rr=Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z);
    minOrbit=Math.min(minOrbit,rr);maxOrbit=Math.max(maxOrbit,rr);
  });
  const top5=cn.slice().sort((a,b)=>(b.papers||0)-(a.papers||0)).slice(0,5);

  // ── Network View: purely link-driven, no category forces ──
  const nn=diseases.map((d,i)=>({index:i,r:nR(d.papers),category:d.category,papers:d.papers,x:(Math.random()-0.5)*300,y:(Math.random()-0.5)*300,z:(Math.random()-0.5)*150}));
  const ns2=d3.forceSimulation(nn)
    .force('charge',d3.forceManyBody().strength(-40))
    .force('link',d3.forceLink(ml(layoutEdges)).id(d=>d.index).distance(40).strength(d=>(d.score/ms)*0.8))
    .force('center',d3.forceCenter(0,0).strength(0.03))
    .force('collide',d3.forceCollide(d=>d.r+1.2).strength(0.85))
    .stop();
  for(let i=0;i<300;i++){ns2.tick();
    // Z repulsion
    for(let a=0;a<nn.length;a++)for(let b=a+1;b<nn.length;b++){const na=nn[a],nb=nn[b],dz=na.z-nb.z,d=Math.sqrt((na.x-nb.x)**2+(na.y-nb.y)**2+dz*dz);if(d<20&&d>0){const f=(dz/d)*0.3;na.z+=f;nb.z-=f;}}
  }
  // Build debug string
  const _dbg={nanCount,minOrbit:minOrbit.toFixed(1),maxOrbit:maxOrbit.toFixed(1),N:cn.length};
  const _dbgTop=top5.map(n=>({r:n.r.toFixed(1),orbit:Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z).toFixed(1)}));
  const debugStr=`NaN:${_dbg.nanCount} orbit:[${_dbg.minOrbit}..${_dbg.maxOrbit}] N:${_dbg.N}\nTop5: ${_dbgTop.map(t=>`r=${t.r} orb=${t.orbit}`).join(' | ')}`;

  return{catPos:cn.map(n=>[n.x,n.y,n.z]),netPos:nn.map(n=>[n.x,n.y,n.z]),debugStr,rawMax};
}

// ─── Orbit Controls ──────────────────────────────────────────────────────────
class OC{
  constructor(cam,el){this.cam=cam;this.el=el;this.target=new THREE.Vector3();this.theta=0;this.phi=Math.PI/2;this.radius=700;this.defaultTheta=0;this.defaultPhi=Math.PI/2;this.defaultRadius=700;this.tV=0;this.pV=0;this.pnX=0;this.pnY=0;this._dr=false;this._pn=false;this._lx=0;this._ly=0;this.enabled=true;
    this._td=0;this._tp=0;this.zV=0; // touch: pinch distance, touch count, zoom velocity
    this._d=this._d.bind(this);this._m=this._m.bind(this);this._u=this._u.bind(this);this._w=this._w.bind(this);this._c=e=>e.preventDefault();
    this._ts=this._ts.bind(this);this._tm=this._tm.bind(this);this._te=this._te.bind(this);
    el.addEventListener('mousedown',this._d);el.addEventListener('mousemove',this._m);el.addEventListener('mouseup',this._u);el.addEventListener('mouseleave',this._u);el.addEventListener('wheel',this._w,{passive:false});el.addEventListener('contextmenu',this._c);
    el.addEventListener('touchstart',this._ts,{passive:false});el.addEventListener('touchmove',this._tm,{passive:false});el.addEventListener('touchend',this._te,{passive:false});}
  _d(e){if(!this.enabled)return;if(e.button===2)this._pn=true;else if(e.button===0)this._dr=true;this._lx=e.clientX;this._ly=e.clientY;}
  _m(e){const dx=e.clientX-this._lx,dy=e.clientY-this._ly;this._lx=e.clientX;this._ly=e.clientY;if(this._dr&&this.enabled){this.tV-=dx*0.0045;this.pV-=dy*0.0045;}if(this._pn&&this.enabled){const s=this.radius*0.0009;this.pnX-=dx*s;this.pnY+=dy*s;}}
  _u(){this._dr=false;this._pn=false;}
  _w(e){if(!this.enabled)return;e.preventDefault();this.radius=Math.max(50,Math.min(this.defaultRadius*4,this.radius+e.deltaY*0.001*this.radius));}
  _ts(e){if(!this.enabled)return;e.preventDefault();this._tp=e.touches.length;
    if(this._tp===1){this._lx=e.touches[0].clientX;this._ly=e.touches[0].clientY;}
    else if(this._tp>=2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;this._td=Math.sqrt(dx*dx+dy*dy);this._lx=(e.touches[0].clientX+e.touches[1].clientX)/2;this._ly=(e.touches[0].clientY+e.touches[1].clientY)/2;}}
  _tm(e){if(!this.enabled||!e.touches.length)return;e.preventDefault();
    if(this._tp===1&&e.touches.length===1){const dx=e.touches[0].clientX-this._lx,dy=e.touches[0].clientY-this._ly;this._lx=e.touches[0].clientX;this._ly=e.touches[0].clientY;this.tV-=dx*0.0018;this.pV-=dy*0.0018;}
    else if(e.touches.length>=2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;const nd=Math.sqrt(dx*dx+dy*dy);
      if(this._td>0){const raw=this._td/nd-1;const clamped=Math.max(-0.08,Math.min(0.08,raw*0.65));this.zV=clamped;}
      this._td=nd;
      const mx=(e.touches[0].clientX+e.touches[1].clientX)/2,my=(e.touches[0].clientY+e.touches[1].clientY)/2;
      const pmx=mx-this._lx,pmy=my-this._ly;this._lx=mx;this._ly=my;
      const s=this.radius*0.0004;this.pnX-=pmx*s;this.pnY+=pmy*s;}}
  _te(e){this._tp=e.touches.length;this._td=0;}
  update(){this.theta+=this.tV;this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi+this.pV));this.tV*=0.92;this.pV*=0.92;
    if(Math.abs(this.zV)>0.0001){this.radius=Math.max(50,Math.min(this.defaultRadius*4,this.radius*(1+this.zV)));this.zV*=0.88;}
    if(Math.abs(this.pnX)>0.001||Math.abs(this.pnY)>0.001){const r=new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld,0),u=new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld,1);this.target.addScaledVector(r,this.pnX);this.target.addScaledVector(u,this.pnY);this.pnX*=0.92;this.pnY*=0.92;}
    const sp=Math.sin(this.phi);this.cam.position.set(this.target.x+this.radius*sp*Math.sin(this.theta),this.target.y+this.radius*Math.cos(this.phi),this.target.z+this.radius*sp*Math.cos(this.theta));this.cam.lookAt(this.target);}
  dispose(){this.el.removeEventListener('mousedown',this._d);this.el.removeEventListener('mousemove',this._m);this.el.removeEventListener('mouseup',this._u);this.el.removeEventListener('mouseleave',this._u);this.el.removeEventListener('wheel',this._w);this.el.removeEventListener('contextmenu',this._c);
    this.el.removeEventListener('touchstart',this._ts);this.el.removeEventListener('touchmove',this._tm);this.el.removeEventListener('touchend',this._te);}
}

// ─── Glow Texture (programmatic radial gradient) ─────────────────────────────
function makeGlowTexture() {
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,0.3)');g.addColorStop(0.3,'rgba(255,255,255,0.1)');g.addColorStop(0.6,'rgba(255,255,255,0.02)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}

// ─── Plasma Shader ──────────────────────────────────────────────────────────
const PLASMA_VERT = `
attribute float aPhase;
varying vec3 vNormal,vWorldPos,vColor;
varying float vPhase,vFogDepth;
void main(){
  vPhase=aPhase;
  #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
  #else
    vColor=vec3(1.0);
  #endif
  vec4 wp=vec4(position,1.0);
  #ifdef USE_INSTANCING
    wp=instanceMatrix*wp;
  #endif
  vWorldPos=(modelMatrix*wp).xyz;
  vec4 mv=modelViewMatrix*wp;
  vec3 tn=normal;
  #ifdef USE_INSTANCING
    tn=mat3(instanceMatrix)*tn;
  #endif
  vNormal=normalize(normalMatrix*tn);
  vFogDepth=-mv.z;
  gl_Position=projectionMatrix*mv;
}`;
const PLASMA_FRAG = `
uniform float time;
varying vec3 vNormal,vWorldPos,vColor;
varying float vPhase,vFogDepth;
float hash(vec3 p){p=fract(p*vec3(443.897,441.423,437.195));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
float nse(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*nse(p);p*=2.0;a*=0.5;}return v;}
void main(){
  vec3 np=vWorldPos*0.5+vec3(time*0.4+vPhase);
  float n=fbm(np)+fbm(np*1.5+vec3(0.0,time*0.28,0.0));
  float pl=pow(n*0.5,0.7);
  float facing=abs(dot(vNormal,vec3(0.0,0.0,1.0)));
  float fr=pow(1.0-facing,2.5);
  float core=mix(0.3,1.0,pow(facing,0.6));
  vec3 col=vColor*(pl*1.0+0.1)*core*1.3+vColor*fr*0.8;
  gl_FragColor=vec4(col,0.95);
}`;

// ─── UI Components ───────────────────────────────────────────────────────────
function Sparkline({data,color,w=260,h=50}){if(!data||!data.length)return null;const mx=Math.max(...data),mn=Math.min(...data),rng=mx-mn||1;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-4-((v-mn)/rng)*(h-8)}`).join(' ');const gid='sp'+color.replace('#','');return(<svg width={w} height={h} style={{display:'block'}}><defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs><polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/><text x="0" y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono">2014</text><text x={w} y={h-1} fill="#475569" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">2024</text></svg>);}

function Tooltip({disease,connCount,x,y}){if(!disease)return null;const c=CC[disease.category],t=disease.trend,ar=t>0?'↑':t<0?'↓':'→';return(<div style={{position:'fixed',left:x+15,top:y+15,pointerEvents:'none',zIndex:100,background:'rgba(10,16,30,0.94)',backdropFilter:'blur(16px)',maxWidth:240,border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'8px 12px',fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#e2e8f0'}}><div style={{fontWeight:600,fontSize:12,marginBottom:3}}>{disease.label}</div><span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:c+'22',color:c}}>{CL[disease.category]}</span><div style={{color:'#94a3b8',marginTop:4}}>{fmt(disease.papers)} papers <span style={{color:t>0?'#22c55e':t<0?'#ef4444':'#94a3b8'}}>{ar}{Math.abs(t)}%</span></div><div style={{color:'#64748b'}}>{connCount} connections</div></div>);}

function Sidebar({disease,data,onSelect,onClose}){if(!disease)return null;const c=CC[disease.category],idx=data.diseases.indexOf(disease),cc=data.connCounts.get(idx);const conns=data.edges.filter(e=>e.si===idx||e.ti===idx).map(e=>{const oi=e.si===idx?e.ti:e.si;return{d:data.diseases[oi],sp:e.sharedPapers,t:e.trend,oi};}).sort((a,b)=>b.sp-a.sp);const t=disease.trend,ar=t>0?'↑':t<0?'↓':'→',tc=t>0?'#22c55e':t<0?'#ef4444':'#94a3b8';const gc={high:'#ef4444',medium:'#eab308',low:'#22c55e'};const ppd=disease.mortality>0?disease.papers/disease.mortality:null;const ppdStr=ppd===null?'N/A':ppd>=10?String(Math.round(ppd)):ppd>=1?ppd.toFixed(1):ppd>=0.01?ppd.toFixed(2):ppd.toFixed(3);
  const mob=isMob();
  const panelRef=React.useRef(null);
  const [panelH,setPanelH]=React.useState(60); // panel height as vh%
  const swipeRef=React.useRef({startY:0,curY:0,swiping:false,startH:60});
  const onSwipeStart=React.useCallback((e)=>{if(!mob)return;const touch=e.touches[0];swipeRef.current={startY:touch.clientY,curY:touch.clientY,swiping:true,startH:panelH};if(panelRef.current)panelRef.current.style.transition='none';},[mob,panelH]);
  const onSwipeMove=React.useCallback((e)=>{if(!mob||!swipeRef.current.swiping)return;const touch=e.touches[0];swipeRef.current.curY=touch.clientY;const dy=touch.clientY-swipeRef.current.startY;const vhPx=window.innerHeight/100;const dh=dy/vhPx;const newH=Math.max(10,Math.min(85,swipeRef.current.startH-dh));if(panelRef.current){panelRef.current.style.height=newH+'vh';panelRef.current.style.maxHeight=newH+'vh';}},[mob]);
  const onSwipeEnd=React.useCallback(()=>{if(!mob||!swipeRef.current.swiping)return;swipeRef.current.swiping=false;const dy=swipeRef.current.curY-swipeRef.current.startY;const vhPx=window.innerHeight/100;const newH=Math.max(10,Math.min(85,swipeRef.current.startH-(dy/vhPx)));if(panelRef.current){panelRef.current.style.transition='height 0.25s ease, max-height 0.25s ease, opacity 0.25s ease';}if(newH<=12){if(panelRef.current){panelRef.current.style.height='0vh';panelRef.current.style.maxHeight='0vh';panelRef.current.style.opacity='0';}setTimeout(onClose,250);}else{setPanelH(Math.round(newH));}},[mob,onClose]);
  const panelStyle=mob?{position:'absolute',bottom:0,left:0,right:0,height:panelH+'vh',maxHeight:panelH+'vh',background:'rgba(10,16,30,0.96)',backdropFilter:'blur(16px)',borderTop:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px 16px 0 0',fontFamily:'IBM Plex Mono,monospace',color:'#e2e8f0',overflowY:'auto',overflowX:'hidden',zIndex:50,fontSize:11}:{position:'absolute',top:75,right:0,width:320,height:'calc(100% - 75px)',background:'rgba(10,16,30,0.94)',backdropFilter:'blur(16px)',borderLeft:'1px solid rgba(255,255,255,0.06)',fontFamily:'IBM Plex Mono,monospace',color:'#e2e8f0',overflowY:'auto',overflowX:'hidden',zIndex:50,fontSize:11};
  return(<>{mob&&<div onClick={onClose} style={{position:'absolute',inset:0,zIndex:49,background:'rgba(0,0,0,0.4)'}}/>}<div ref={panelRef} style={panelStyle}>
    {mob&&<div onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd} style={{display:'flex',justifyContent:'center',padding:'18px 0 14px',cursor:'grab',touchAction:'none',minHeight:48}}><div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.3)'}}/></div>}
    <div style={{padding:'16px 16px 8px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{disease.label}</div><span style={{fontSize:9,padding:'2px 8px',borderRadius:4,background:c+'22',color:c}}>{CL[disease.category]}</span></div><button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 4px'}}>×</button></div></div>
    <div style={{padding:'10px 16px',color:'#94a3b8',lineHeight:1.5}}>{disease.description}</div>
    <div style={{padding:'0 16px 12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><SB l="Publications" v={fmt(disease.papers)} s={<span style={{color:tc}}>{ar}{Math.abs(t)}%</span>}/><SB l="Connections" v={cc}/><SB l="WHO Deaths/yr" v={disease.mortality>0?fmt(disease.mortality):'N/A'}/><SB l="Funding Gap" v={disease.fundingGap.toUpperCase()} vc={gc[disease.fundingGap]}/><SB l="Papers/Death" v={ppdStr}/></div>
    <div style={{padding:'0 16px 12px'}}><div style={{color:'#94a3b8',fontSize:9,marginBottom:4}}>Publication Trend (2014–2024)</div><Sparkline data={disease.yearlyPapers} color={c}/></div>
    <div style={{padding:'0 16px 12px'}}><a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date`} target="_blank" rel="noopener noreferrer" style={{display:'block',textAlign:'center',padding:'8px 0',borderRadius:6,background:c+'22',color:c,textDecoration:'none',fontSize:11,fontWeight:500}}>View on PubMed →</a></div>
    <div style={{padding:'0 16px 16px'}}><div style={{color:'#94a3b8',fontSize:9,marginBottom:2}}>Connections ({conns.length})</div><div style={{color:'#64748b',fontSize:8,marginBottom:6}}>Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap</div><div style={{maxHeight:240,overflowY:'auto'}}>{conns.map((cn,i)=>{const cc2=CC[cn.d.category],ta=cn.t==='up'?'↑':cn.t==='down'?'↓':'→';return(<div key={i} onClick={()=>onSelect(cn.oi)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 6px',cursor:'pointer',borderRadius:4,borderBottom:'1px solid rgba(255,255,255,0.03)'}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}><span style={{width:6,height:6,borderRadius:'50%',background:cc2,flexShrink:0}}/><span style={{flex:1,color:'#cbd5e1'}}>{cn.d.label}</span><span style={{color:'#94a3b8',fontSize:10}}>{fmt(cn.sp)}</span><span style={{color:cn.t==='up'?'#22c55e':cn.t==='down'?'#ef4444':'#64748b',fontSize:10}}>{ta}</span></div>);})}</div></div>
  </div></>);}
function SB({l,v,s,vc}){return(<div style={{background:'rgba(255,255,255,0.03)',borderRadius:6,padding:'8px 10px',border:'1px solid rgba(255,255,255,0.04)'}}><div style={{color:'#94a3b8',fontSize:9,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600,color:vc||'#e2e8f0'}}>{v} {s&&<span style={{fontSize:10,fontWeight:400}}>{s}</span>}</div></div>);}

function ExplodeOverlay({data,onClose}){
  const mob=isMob();
  const maxH=data.highest[0]?.ppd||1;
  const minPPD=data.lowest[0]?.ppd||0.001;
  function fR(v){return v>=10?String(Math.round(v)):v>=1?v.toFixed(1):v>=0.01?v.toFixed(2):v.toFixed(3);}
  return(
    <div style={{position:'absolute',inset:0,zIndex:55,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',fontFamily:'IBM Plex Mono,monospace',opacity:0,animation:'fadeIn 0.5s ease 0.3s forwards'}}>
      <div style={{background:'rgba(10,16,30,0.97)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:mob?16:28,maxWidth:mob?'95vw':820,width:'100%',maxHeight:'85vh',overflowY:'auto',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#94a3b8',cursor:'pointer',fontSize:14,lineHeight:1,padding:'4px 8px',fontFamily:'inherit'}}>✕ Close</button>
        <div style={{fontSize:mob?14:18,fontWeight:600,color:'#e2e8f0',marginBottom:4}}>Research Intensity</div>
        <div style={{fontSize:mob?9:12,color:'#64748b',marginBottom:mob?16:24}}>Papers published per reported death — revealing where research attention doesn't match disease burden</div>
        <div style={{display:'flex',flexDirection:mob?'column':'row',gap:mob?20:36}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#22c55e',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Most Over-Researched</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Highest papers per death</div>
            {data.highest.map((d,i)=>(<div key={d.id} style={{marginBottom:8,opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1'}}>{d.label}</span>
                <span style={{fontSize:mob?9:11,color:'#22c55e',fontWeight:600,marginLeft:8,whiteSpace:'nowrap'}}>{fR(d.ppd)}</span>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max((d.ppd/maxH)*100,2)}%`,background:'linear-gradient(90deg,#22c55e,#059669)',borderRadius:3,transition:'width 0.6s ease'}}/>
              </div>
            </div>))}
          </div>
          <div style={{width:1,background:'rgba(255,255,255,0.06)',display:mob?'none':'block'}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#ef4444',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Most Under-Researched</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Fewest papers per death</div>
            {data.lowest.map((d,i)=>(<div key={d.id} style={{marginBottom:8,opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1'}}>{d.label}</span>
                <span style={{fontSize:mob?9:11,color:'#ef4444',fontWeight:600,marginLeft:8,whiteSpace:'nowrap'}}>{fR(d.ppd)}</span>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max((minPPD/d.ppd)*100,2)}%`,background:'linear-gradient(90deg,#ef4444,#dc2626)',borderRadius:3,transition:'width 0.6s ease'}}/>
              </div>
            </div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionsOverlay({data,onClose,onSelect}){
  const mob=isMob();
  const maxConn=data.hubs[0]?.count||1;
  return(
    <div style={{position:'absolute',inset:0,zIndex:55,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',fontFamily:'IBM Plex Mono,monospace',opacity:0,animation:'fadeIn 0.5s ease 0.3s forwards'}}>
      <div style={{background:'rgba(10,16,30,0.97)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:mob?16:28,maxWidth:mob?'95vw':880,width:'100%',maxHeight:'85vh',overflowY:'auto',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#94a3b8',cursor:'pointer',fontSize:14,lineHeight:1,padding:'4px 8px',fontFamily:'inherit'}}>✕ Close</button>
        <div style={{fontSize:mob?14:18,fontWeight:600,color:'#e2e8f0',marginBottom:4}}>Connection Clusters</div>
        <div style={{fontSize:mob?9:12,color:'#64748b',marginBottom:mob?16:24}}>Diseases that appear together in published medical research, suggesting shared biology, risk factors, or clinical overlap — revealing comorbidities, shared biology, and research overlap</div>
        <div style={{display:'flex',flexDirection:mob?'column':'row',gap:mob?20:36}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#3399ff',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Hub Diseases</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Most connected — tap to explore</div>
            {data.hubs.map((d,i)=>(<div key={d.id} onClick={()=>onSelect(d.id)} style={{marginBottom:8,cursor:'pointer',opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}} onMouseEnter={e=>{e.currentTarget.querySelector('.hub-bar').style.filter='brightness(1.3)';}} onMouseLeave={e=>{e.currentTarget.querySelector('.hub-bar').style.filter='none';}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1',display:'flex',alignItems:'center',gap:6}}><span style={{width:6,height:6,borderRadius:'50%',background:CC[d.category],flexShrink:0}}/>{d.label}</span>
                <span style={{fontSize:mob?9:11,color:'#3399ff',fontWeight:600,marginLeft:8,whiteSpace:'nowrap'}}>{d.count}</span>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden'}}>
                <div className="hub-bar" style={{height:'100%',width:`${Math.max((d.count/maxConn)*100,2)}%`,background:'linear-gradient(90deg,#3399ff,#1d6fcf)',borderRadius:3,transition:'width 0.6s ease,filter 0.2s'}}/>
              </div>
            </div>))}
          </div>
          <div style={{width:1,background:'rgba(255,255,255,0.06)',display:mob?'none':'block'}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#ffd500',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Surprising Links</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Cross-category connections with most shared research</div>
            {data.crossLinks.map((d,i)=>(<div key={i} style={{marginBottom:10,opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap'}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1',display:'flex',alignItems:'center',gap:4}}><span style={{width:5,height:5,borderRadius:'50%',background:CC[d.sCat]}}/>{d.sLabel}</span>
                <span style={{fontSize:9,color:'#ffd500'}}>⟷</span>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1',display:'flex',alignItems:'center',gap:4}}><span style={{width:5,height:5,borderRadius:'50%',background:CC[d.tCat]}}/>{d.tLabel}</span>
              </div>
              <div style={{fontSize:mob?8:9,color:'#64748b'}}>{fmt(d.shared)} shared papers · {d.reason}</div>
            </div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VelocityOverlay({data,onClose}){
  const mob=isMob();
  const maxG=data.rising[0]?.growth||1;
  const maxD=Math.abs(data.declining[0]?.growth)||1;
  function fG(v){return v>=10?String(Math.round(v))+'×':v>=1?v.toFixed(1)+'×':v.toFixed(2)+'×';}
  function fP(v){return v>=0?'+'+Math.round(v)+'%':Math.round(v)+'%';}
  return(
    <div style={{position:'absolute',inset:0,zIndex:55,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',fontFamily:'IBM Plex Mono,monospace',opacity:0,animation:'fadeIn 0.5s ease 0.3s forwards'}}>
      <div style={{background:'rgba(10,16,30,0.97)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:mob?16:28,maxWidth:mob?'95vw':820,width:'100%',maxHeight:'85vh',overflowY:'auto',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#94a3b8',cursor:'pointer',fontSize:14,lineHeight:1,padding:'4px 8px',fontFamily:'inherit'}}>✕ Close</button>
        <div style={{fontSize:mob?14:18,fontWeight:600,color:'#e2e8f0',marginBottom:4}}>Research Trends</div>
        <div style={{fontSize:mob?9:12,color:'#64748b',marginBottom:mob?16:24}}>Publication growth rate over the last decade — which diseases are surging and which are fading</div>
        <div style={{display:'flex',flexDirection:mob?'column':'row',gap:mob?20:36}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#f59e0b',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Fastest Rising</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Highest publication growth (excl. COVID-19)</div>
            {data.rising.map((d,i)=>(<div key={d.id} style={{marginBottom:8,opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1',display:'flex',alignItems:'center',gap:6}}><span style={{width:6,height:6,borderRadius:'50%',background:CC[d.category],flexShrink:0}}/>{d.label}</span>
                <span style={{fontSize:mob?9:11,color:'#f59e0b',fontWeight:600,marginLeft:8,whiteSpace:'nowrap'}}>{fG(d.growth)}</span>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max((d.growth/maxG)*100,2)}%`,background:'linear-gradient(90deg,#f59e0b,#d97706)',borderRadius:3,transition:'width 0.6s ease'}}/>
              </div>
              <div style={{fontSize:8,color:'#475569',marginTop:2}}>{fP(d.pctChange)} · avg {fmt(Math.round(d.early))}/yr → {fmt(Math.round(d.late))}/yr</div>
            </div>))}
          </div>
          <div style={{width:1,background:'rgba(255,255,255,0.06)',display:mob?'none':'block'}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#64748b',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Fading Research</div>
            <div style={{fontSize:8,color:'#475569',marginBottom:12}}>Declining publication trends</div>
            {data.declining.map((d,i)=>(<div key={d.id} style={{marginBottom:8,opacity:0,animation:`fadeIn 0.3s ease ${0.5+i*0.05}s forwards`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                <span style={{fontSize:mob?9:11,color:'#cbd5e1',display:'flex',alignItems:'center',gap:6}}><span style={{width:6,height:6,borderRadius:'50%',background:CC[d.category],flexShrink:0}}/>{d.label}</span>
                <span style={{fontSize:mob?9:11,color:'#64748b',fontWeight:600,marginLeft:8,whiteSpace:'nowrap'}}>{fP(d.pctChange)}</span>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max((Math.abs(d.growth)/maxD)*100,2)}%`,background:'linear-gradient(90deg,#64748b,#475569)',borderRadius:3,transition:'width 0.6s ease'}}/>
              </div>
              <div style={{fontSize:8,color:'#475569',marginTop:2}}>avg {fmt(Math.round(d.early))}/yr → {fmt(Math.round(d.late))}/yr · {d.mortality>0?fmt(d.mortality)+' deaths/yr':'—'}</div>
            </div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SizeToggle({sizeMode,onSizeToggle,sizeToggleRef}){
  const [showTip,setShowTip]=useState(false);
  const timerRef=useRef(null);
  const handleClick=(m)=>{onSizeToggle(m);setShowTip(true);if(timerRef.current)clearTimeout(timerRef.current);timerRef.current=setTimeout(()=>setShowTip(false),5000);};
  useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current);},[]);
  return(<div style={{position:'relative',pointerEvents:'auto'}}><div ref={sizeToggleRef} style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}>{'papers,mortality'.split(',').map(m=>(<button key={m} onClick={()=>handleClick(m)} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'none',cursor:'pointer',background:sizeMode===m?'rgba(255,255,255,0.12)':'transparent',color:sizeMode===m?'#e2e8f0':'#64748b'}}>{m==='papers'?'Papers':'Mortality'}</button>))}</div>{showTip&&<div style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',marginTop:6,padding:'8px 12px',background:'rgba(10,16,30,0.95)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,fontSize:10,color:'#94a3b8',width:220,lineHeight:1.5,opacity:0,animation:'fadeIn 0.4s ease forwards',textAlign:'center',whiteSpace:'normal'}}>{sizeMode==='papers'?'Node size scaled by total publications on PubMed':'Node size scaled by annual deaths reported by WHO'}</div>}</div>);
}

function Header({diseaseCount,edgeCount,searchQuery,onSearchChange,sizeMode,onSizeToggle,sizeToggleRef,onExplode,onConnections,onVelocity,neglectMode,onNeglect,spotlightActive,onSpotlight,searchDropdown}){
  const mob=isMob();
  const [menuOpen,setMenuOpen]=React.useState(false);
  const menuRef=React.useRef(null);
  React.useEffect(()=>{if(!mob||!menuOpen)return;function onTouch(e){if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}document.addEventListener('touchstart',onTouch,true);return()=>document.removeEventListener('touchstart',onTouch,true);},[mob,menuOpen]);
  const [searchOpen,setSearchOpen]=React.useState(false);
  return(<div style={{position:'absolute',top:0,left:0,right:0,zIndex:40,padding:mob?'10px 12px':'14px 20px',display:'flex',alignItems:'center',gap:mob?8:14,fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'#e2e8f0',background:'linear-gradient(180deg,rgba(6,8,13,0.9) 0%,rgba(6,8,13,0) 100%)',pointerEvents:'none',transform:'translateY(-100%)',animation:'slideDown 0.6s ease 1.8s forwards'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,pointerEvents:'auto'}}><span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px #22c55e',animation:'pulse 2s infinite'}}/><span style={{fontWeight:600,fontSize:mob?13:15}}>MedGalaxy</span>{!mob&&<><span style={{color:'#94a3b8',fontSize:11}}>3D visualization of global disease research</span><span style={{color:'#94a3b8',fontSize:11}}>·</span><span style={{color:'#94a3b8',fontSize:11}}>{diseaseCount} diseases · {edgeCount} connections</span></>}</div>
    <div style={{flex:1}}/>
    {mob?(<>
      {searchOpen&&<div style={{position:'absolute',top:'100%',left:0,right:0,padding:'8px 12px',background:'rgba(6,8,13,0.95)',pointerEvents:'auto'}}><input value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder="Search diseases..." autoFocus onBlur={()=>{if(!searchQuery)setSearchOpen(false);}} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'7px 12px',color:'#e2e8f0',fontSize:12,fontFamily:'inherit',width:'100%',outline:'none'}}/></div>}
      <button onClick={()=>{setSearchOpen(!searchOpen);setMenuOpen(false);}} style={{pointerEvents:'auto',background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'5px 8px',color:'#94a3b8',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>&#x1F50D;</button>
      <div ref={menuRef} style={{position:'relative',pointerEvents:'auto'}}><button onClick={()=>{setMenuOpen(!menuOpen);setSearchOpen(false);}} style={{background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'8px 14px',color:'#e2e8f0',fontSize:16,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Menu</button>
        {menuOpen&&<div style={{position:'absolute',top:'100%',right:0,marginTop:4,background:'rgba(10,16,30,0.96)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:8,minWidth:160,display:'flex',flexDirection:'column',gap:6}}>
          <div style={{color:'#64748b',fontSize:9,padding:'0 4px'}}>Size by</div>
          <div ref={sizeToggleRef} style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}>{['papers','mortality'].map(m=>(<button key={m} onClick={()=>{onSizeToggle(m);setMenuOpen(false);}} style={{flex:1,padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'none',cursor:'pointer',background:sizeMode===m?'rgba(255,255,255,0.12)':'transparent',color:sizeMode===m?'#e2e8f0':'#64748b'}}>{m==='papers'?'Papers':'Mortality'}</button>))}</div>
          <div style={{color:'#64748b',fontSize:9,padding:'4px 4px 0'}}>Analysis</div>
          <button onClick={()=>{onExplode();setMenuOpen(false);}} style={{padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',width:'100%',textAlign:'left'}}>Research Gap</button>
          <button onClick={()=>{onConnections();setMenuOpen(false);}} style={{padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',width:'100%',textAlign:'left'}}>Connections</button>
          <button onClick={()=>{onVelocity();setMenuOpen(false);}} style={{padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',width:'100%',textAlign:'left'}}>Trends</button>
          <button onClick={()=>{onNeglect();setMenuOpen(false);}} style={{padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:neglectMode?'rgba(255,255,255,0.12)':'transparent',color:neglectMode?'#ef4444':'#e2e8f0',width:'100%',textAlign:'left'}}>{neglectMode?'✕ Attention Map':'Attention Map'}</button>
          <button onClick={()=>{onSpotlight();setMenuOpen(false);}} style={{padding:'6px 10px',fontSize:10,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:spotlightActive?'rgba(255,255,255,0.12)':'transparent',color:spotlightActive?'#f59e0b':'#e2e8f0',width:'100%',textAlign:'left'}}>{spotlightActive?'✕ Spotlight':'Spotlight'}</button>
        </div>}
      </div>
    </>):(<>
      <div style={{position:'relative',pointerEvents:'auto'}}>
        <button onClick={onNeglect} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:neglectMode?'rgba(255,255,255,0.12)':'transparent',color:neglectMode?'#ef4444':'#e2e8f0',whiteSpace:'nowrap'}}>{neglectMode?'✕ Attention Map':'Attention Map'}</button>
        {neglectMode&&<div style={{position:'absolute',top:'100%',left:0,marginTop:6,padding:'8px 12px',background:'rgba(10,16,30,0.95)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,fontSize:10,color:'#94a3b8',width:260,lineHeight:1.5,opacity:0,animation:'fadeIn 0.4s ease forwards'}}>Nodes colored by research papers per death. <span style={{color:'#22c55e'}}>Green</span> = high attention. <span style={{color:'#f59e0b'}}>Yellow</span> = moderate. <span style={{color:'#ef4444'}}>Red</span> = overlooked.</div>}
      </div>
      <SizeToggle sizeMode={sizeMode} onSizeToggle={onSizeToggle} sizeToggleRef={sizeToggleRef}/>
      <button onClick={onExplode} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',pointerEvents:'auto',whiteSpace:'nowrap'}}>Research Gap</button>
      <button onClick={onConnections} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',pointerEvents:'auto',whiteSpace:'nowrap'}}>Connections</button>
      <button onClick={onVelocity} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:'transparent',color:'#e2e8f0',pointerEvents:'auto',whiteSpace:'nowrap'}}>Trends</button>
      <button onClick={onSpotlight} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,cursor:'pointer',background:spotlightActive?'rgba(255,255,255,0.12)':'transparent',color:spotlightActive?'#f59e0b':'#e2e8f0',pointerEvents:'auto',whiteSpace:'nowrap'}}>{spotlightActive?'✕ Spotlight':'Spotlight'}</button>
      <div style={{position:'relative',pointerEvents:'auto'}}><input value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder="Search diseases..." style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'7px 12px',color:'#e2e8f0',fontSize:12,fontFamily:'inherit',width:200,outline:'none'}}/>{searchDropdown}</div>
    </>)}
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes slideDown{to{transform:translateY(0)}}@keyframes slideUp{to{transform:translateY(0)}}@keyframes fadeIn{to{opacity:1}}@keyframes chipPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 12px 4px rgba(34,197,94,0.15)}}@keyframes storyPulse{0%,100%{box-shadow:0 0 4px 1px rgba(255,255,255,0.1)}50%{box-shadow:0 0 18px 5px rgba(255,255,255,0.45)}}`}</style>
  </div>);
}

function FilterBar({activeCategories,onToggle,neglectMode}){if(isMob())return null;
  if(neglectMode){return(
    <div style={{position:'absolute',top:50,left:0,right:0,zIndex:40,padding:'0 20px',display:'flex',alignItems:'center',gap:10,fontFamily:'IBM Plex Mono,monospace',fontSize:10,pointerEvents:'none',opacity:0,animation:'fadeIn 0.4s ease forwards'}}>
      <span style={{color:'#ef4444',fontWeight:600}}>OVERLOOKED</span>
      <div style={{width:180,height:8,borderRadius:4,background:'linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e)'}}/>
      <span style={{color:'#22c55e',fontWeight:600}}>HIGH ATTENTION</span>
      <span style={{color:'#64748b',marginLeft:8}}>·</span>
      <span style={{color:'#64748b'}}>Papers per death (log scale)</span>
    </div>);}
  const allActive=activeCategories.size===CATS.length;return(
  <div style={{position:'absolute',top:50,left:0,right:0,zIndex:40,padding:'0 20px',display:'flex',flexWrap:'wrap',gap:5,fontFamily:'IBM Plex Mono,monospace',fontSize:11,pointerEvents:'none',transform:'translateY(-60px)',animation:'slideDown 0.5s ease 1.95s forwards'}}>
    <button onClick={()=>onToggle('ALL')} style={{pointerEvents:'auto',padding:'4px 12px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontFamily:'inherit',fontSize:10,background:allActive?'rgba(255,255,255,0.12)':'transparent',color:allActive?'#e2e8f0':'#64748b'}}>ALL</button>
    {CATS.map(cat=>{const on=activeCategories.has(cat);return(<button key={cat} onClick={()=>onToggle(cat)} style={{pointerEvents:'auto',padding:'4px 12px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontFamily:'inherit',fontSize:10,display:'flex',alignItems:'center',gap:4,background:on?'rgba(255,255,255,0.08)':'transparent',color:on?'#e2e8f0':'#475569',opacity:on?1:0.5}}><span style={{width:6,height:6,borderRadius:'50%',background:CC[cat]}}/>{CL[cat]}</button>);})}
  </div>);}

function SearchDropdown({query,diseases,onSelect}){if(!query||query.length<1)return null;const q=query.toLowerCase(),matches=diseases.filter(d=>d.label.toLowerCase().includes(q)).slice(0,8);if(!matches.length)return null;return(<div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,zIndex:60,background:'rgba(10,16,30,0.96)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:4,fontFamily:'IBM Plex Mono,monospace',fontSize:11,minWidth:200}}>{matches.map(d=>(<div key={d.id} onClick={()=>onSelect(d)} style={{padding:'5px 8px',cursor:'pointer',borderRadius:4,color:'#e2e8f0',display:'flex',alignItems:'center',gap:6}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}><span style={{width:6,height:6,borderRadius:'50%',background:CC[d.category]}}/>{d.label}</div>))}</div>);}


function SpotlightCaption({text}){
  if(!text)return null;const mob=isMob();
  return(<div key={text} style={{position:'absolute',bottom:mob?90:110,left:'50%',transform:'translateX(-50%)',zIndex:46,background:'rgba(10,16,30,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:mob?'12px 18px':'16px 28px',fontFamily:'IBM Plex Mono,monospace',textAlign:'center',opacity:0,animation:'fadeIn 0.4s ease forwards',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}><div style={{fontSize:8,color:'#f59e0b',fontWeight:600,textTransform:'uppercase',letterSpacing:2,marginBottom:6}}>Spotlight</div><div style={{fontSize:mob?12:14,color:'#f1f5f9',lineHeight:1.5,whiteSpace:mob?'normal':'nowrap',maxWidth:mob?'85vw':'none'}}>{text}</div></div>);
}

function RandomPickCaption({data,onDismiss}){
  if(!data)return null;const mob=isMob();
  return(<div key={data.disease.id} style={{position:'absolute',bottom:mob?90:110,left:'50%',transform:'translateX(-50%)',zIndex:46,background:'rgba(10,16,30,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:12,padding:mob?'14px 20px':'20px 32px',fontFamily:'IBM Plex Mono,monospace',textAlign:'center',opacity:0,animation:'fadeIn 0.5s ease forwards',boxShadow:'0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.1)',maxWidth:mob?'92vw':520,cursor:'pointer'}} onClick={onDismiss}>
    <div style={{fontSize:8,color:'#f59e0b',fontWeight:600,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>⟳ Random Pick</div>
    <div style={{fontSize:mob?15:18,color:'#f1f5f9',fontWeight:600,marginBottom:10}}>{data.disease.label}</div>
    <div style={{fontSize:mob?11:13,color:'#cbd5e1',lineHeight:1.6}}>{data.fact}</div>
    <div style={{color:'#64748b',fontSize:10,marginTop:12}}>{mob?'tap':'click'} to dismiss</div>
  </div>);
}

function Legend({sizeMode}){const mob=isMob();return(<div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:40,padding:mob?'8px 12px':'8px 16px',display:'flex',gap:mob?8:16,fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#cbd5e1',background:'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',pointerEvents:'none',transform:'translateY(100%)',animation:'slideUp 0.5s ease 2.1s forwards'}}>{mob?<span>Tap to explore · Pinch to zoom</span>:(<><span>Node size = {sizeMode==='papers'?'publications':'mortality'}</span><span>Drag to rotate · Scroll to zoom · Right-drag to pan · Double-click to re-center</span></>)}<span style={{marginLeft:'auto'}}>Data: PubMed · WHO Global Health Estimates 2021 · Project by Russell J. Young</span></div>);}

// ─── Story Mode Component ────────────────────────────────────────────────────
function StoryChips({onChip,onRandomPick,visible}){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setMounted(true),2800);return()=>clearTimeout(t);},[]);
  if(!visible&&mounted) return null;
  const mob=isMob();
  const show=visible&&mounted;
  const chips=[
    {id:'researched',label:'Most Researched',desc:'See the biggest research spheres'},
    {id:'killers',label:'Biggest Killers',desc:'Diseases with highest mortality'},
    {id:'forgotten',label:'Forgotten Diseases',desc:'Declining research, rising deaths'},
    {id:'silent',label:'Silent Killers',desc:'High mortality, minimal attention'},
    {id:'richpoor',label:'Rich vs Poor',desc:'Who gets the research?'},
    {id:'mismatch',label:'See the Mismatch',desc:'The 2,000:1 research gap'},
  ];
  const btnStyle={padding:mob?'6px 4px':'8px 16px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(10,16,30,0.92)',color:'#e2e8f0',fontSize:mob?9:11,cursor:'pointer',fontFamily:'inherit',transition:'background 0.2s, box-shadow 0.3s, border-color 0.3s'};
  const hIn=e=>{const s=e.currentTarget.style;s.boxShadow='0 0 8px 1px rgba(57,255,20,0.4), 0 0 20px 3px rgba(57,255,20,0.15)';s.borderColor='rgba(57,255,20,0.6)';};
  const hOut=e=>{const s=e.currentTarget.style;s.boxShadow='none';s.borderColor='rgba(255,255,255,0.1)';};
  return(<div style={{position:'absolute',bottom:mob?32:50,left:'50%',transform:'translateX(-50%)',zIndex:45,display:mob?'grid':'flex',gridTemplateColumns:mob?'repeat(4,1fr)':undefined,gap:mob?6:10,fontFamily:'IBM Plex Mono,monospace',opacity:show?1:0,visibility:show?'visible':'hidden',pointerEvents:show?'auto':'none',transition:'opacity 0.4s ease, visibility 0.4s ease',width:mob?'92vw':undefined}}>
    {chips.map(c=>(<button key={c.id} onClick={()=>onChip(c.id)} style={btnStyle} onMouseEnter={hIn} onMouseLeave={hOut}>{c.label}</button>))}
    <button onClick={onRandomPick} style={{...btnStyle,border:'1px solid rgba(245,158,11,0.3)',color:'#f59e0b'}} onMouseEnter={e=>{const s=e.currentTarget.style;s.boxShadow='0 0 8px 1px rgba(245,158,11,0.4), 0 0 20px 3px rgba(245,158,11,0.15)';s.borderColor='rgba(245,158,11,0.6)';}} onMouseLeave={e=>{const s=e.currentTarget.style;s.boxShadow='none';s.borderColor='rgba(245,158,11,0.3)';}}>⟳ Random Pick</button>
  </div>);
}

function StoryCaption({text,onClick}){
  if(!text) return null;const mob=isMob();
  return(<div onClick={onClick} style={{position:'absolute',bottom:mob?90:110,left:'50%',transform:'translateX(-50%)',zIndex:46,background:'rgba(10,16,30,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:mob?'14px 20px':'18px 32px',fontFamily:'IBM Plex Mono,monospace',fontSize:mob?13:15,color:'#f1f5f9',whiteSpace:mob?'normal':'nowrap',maxWidth:mob?'92vw':'none',textAlign:'center',cursor:'pointer',opacity:0,animation:'fadeIn 0.4s ease forwards',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',letterSpacing:'0.01em',lineHeight:1.5}}>{text}<div style={{color:'#94a3b8',fontSize:mob?10:11,marginTop:8}}>{mob?'tap':'click'} to continue</div></div>);
}

// ═════════════════════════════════════════════════════════════════════════════
export default function MedGalaxy() {
  const containerRef=useRef(null),cameraRef=useRef(null),rendererRef=useRef(null),controlsRef=useRef(null);
  const iMeshRef=useRef(null),edgeMeshRef=useRef(null),catPosRef=useRef(null),netPosRef=useRef(null);
  const dataRef=useRef(null),proxiesRef=useRef([]),flyRef=useRef(null),mdRef=useRef({x:0,y:0});
  const frameRef=useRef(0),hoverIdxRef=useRef(-1);
  const sizeAnimRef=useRef(null),layoutAnimRef=useRef(null),curPosRef=useRef(null);
  const sizeModeRef=useRef('papers'); // mutable mirror for animation loop
  const idleRef=useRef(0); // frames since last interaction
  const sizeToggleRef=useRef(null);
  const glowSpritesRef=useRef(null);
  const nodePhaseRef=useRef([]); // random phase offsets for pulse
  const driftBlendRef=useRef(1); // 0→1 ramp to smoothly blend idle drift back in after animations

  const [hoveredNode,setHoveredNode]=useState(null);
  const [selectedNode,setSelectedNode]=useState(null);
  const [tipPos,setTipPos]=useState({x:0,y:0});
  const [cursor,setCursor]=useState('default');
  const [activeCats,setActiveCats]=useState(()=>new Set(CATS));
  const [searchQuery,setSearchQuery]=useState('');
  const [sizeMode,setSizeMode]=useState('papers');
  const [storyVisible,setStoryVisible]=useState(true);
  const [storyCaption,setStoryCaption]=useState('');
  const [explodeActive,setExplodeActive]=useState(false);
  const explodeAnimRef=useRef(null);
  const explodeActiveRef=useRef(false);
  const [connectionsActive,setConnectionsActive]=useState(false);
  const connectionsActiveRef=useRef(false);
  const connFocusRef=useRef(-1); // index of focused hub disease, -1 = none
  const [connFocusActive,setConnFocusActive]=useState(false);
  const [velocityActive,setVelocityActive]=useState(false);
  const [neglectMode,setNeglectMode]=useState(false);
  const [spotlightActive,setSpotlightActive]=useState(false);
  const [spotlightCaption,setSpotlightCaption]=useState('');
  const spotlightRef=useRef({step:0,timer:null});
  const labelsRef=useRef(null); // DOM container for node labels
  const [randomPickCaption,setRandomPickCaption]=useState(null);
  const randomPickRef=useRef({phase:0,timer:null,chosenIdx:-1,origPositions:null});

  const ppdData=React.useMemo(()=>{const wr=diseasesData.filter(d=>d.mortality>0).map(d=>({...d,ppd:d.papers/d.mortality}));const s=[...wr].sort((a,b)=>b.ppd-a.ppd);return{highest:s.slice(0,10),lowest:s.slice(-10).reverse()};},[]);

  const connData=React.useMemo(()=>{
    // Hub diseases: most connections
    const counts=new Map();
    diseasesData.forEach(d=>counts.set(d.id,0));
    connectionsData.forEach(c=>{counts.set(c.source,(counts.get(c.source)||0)+1);counts.set(c.target,(counts.get(c.target)||0)+1);});
    const catMap=new Map();diseasesData.forEach(d=>catMap.set(d.id,d.category));
    const labelMap=new Map();diseasesData.forEach(d=>labelMap.set(d.id,d.label));
    const hubs=[...counts.entries()].map(([id,count])=>({id,label:labelMap.get(id),category:catMap.get(id),count})).sort((a,b)=>b.count-a.count).slice(0,10);
    // Cross-category surprising links
    const reasons={
      'infectious-respiratory':'shared pathogen-host pathways',
      'cardiovascular-metabolic':'metabolic-cardiovascular syndrome',
      'autoimmune-metabolic':'autoimmune metabolic overlap',
      'neurological-metabolic':'neurometabolic pathways',
      'cancer-infectious':'oncogenic infection link',
      'respiratory-cancer':'shared carcinogenic exposure',
      'infectious-neurological':'neuroinfectious pathway',
      'cardiovascular-respiratory':'cardiopulmonary comorbidity',
      'mental-neurological':'neuropsychiatric overlap',
      'mental-metabolic':'metabolic-psychiatric link',
    };
    function reasonFor(a,b){const k1=a+'-'+b,k2=b+'-'+a;return reasons[k1]||reasons[k2]||'cross-discipline research overlap';}
    const cross=connectionsData.filter(c=>catMap.get(c.source)!==catMap.get(c.target))
      .map(c=>({sLabel:labelMap.get(c.source),tLabel:labelMap.get(c.target),sCat:catMap.get(c.source),tCat:catMap.get(c.target),shared:c.sharedPapers,reason:reasonFor(catMap.get(c.source),catMap.get(c.target))}))
      .sort((a,b)=>b.shared-a.shared).slice(0,10);
    return{hubs,crossLinks:cross};
  },[]);

  const velocityData=React.useMemo(()=>{
    const items=diseasesData.filter(d=>d.yearlyPapers&&d.yearlyPapers.length>=6).map(d=>{
      const yp=d.yearlyPapers;
      const early=yp.slice(0,3).reduce((a,b)=>a+b,0)/3;
      const late=yp.slice(-3).reduce((a,b)=>a+b,0)/3;
      const growth=early>0?late/early:0;
      const pctChange=early>0?((late/early)-1)*100:0;
      return{...d,growth,pctChange,early,late};
    });
    const nonCovid=items.filter(d=>d.id!=='covid-19');
    const rising=[...nonCovid].sort((a,b)=>b.growth-a.growth).slice(0,10);
    const declining=[...items].filter(d=>d.pctChange<0).sort((a,b)=>a.growth-b.growth).slice(0,10);
    return{rising,declining};
  },[]);

  const selectDisease=useCallback((idx)=>{const data=dataRef.current;if(!data)return;setSelectedNode({index:idx,disease:data.diseases[idx]});idleRef.current=0;const p=curPosRef.current?curPosRef.current[idx]:catPosRef.current[idx];const ctrl=controlsRef.current;if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(p[0],p[1],p[2]),sr:ctrl.radius,er:Math.max(150,ctrl.radius*0.5),f:0,total:70};},[]);
  const deselect=useCallback(()=>{
    setSelectedNode(null);
    if(connFocusRef.current>=0){
      // Keep connFocusRef alive during return animation to block idle drift;
      // it gets cleared in the render loop when the animation finishes (connReturning flag)
      connectionsActiveRef.current=false;
      const cur=curPosRef.current,data=dataRef.current;
      if(cur&&data){
        const currentPos=cur.map(p=>[...p]);
        const src=catPosRef.current;
        explodeAnimRef.current={from:currentPos,to:src.map(p=>[...p]),f:0,total:90,returning:true,connReturning:true};
        const proxies=proxiesRef.current;
        const curSizes=data.diseases.map((_,i)=>proxies[i]?proxies[i].scale.x:0.001);
        const targetSizes=data.diseases.map(d=>sizeModeRef.current==='papers'?nR(d.papers):nRM(d.mortality));
        sizeAnimRef.current={from:curSizes,to:targetSizes,f:0,total:90};
      }else{
        connFocusRef.current=-1;
      }
      // Fly camera back to default
      const ctrl=controlsRef.current;
      if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:ctrl.defaultRadius,f:0,total:50};
    }
  },[]);
  const toggleCat=useCallback((cat)=>{setActiveCats(prev=>{if(cat==='ALL')return prev.size===CATS.length?new Set():new Set(CATS);const next=new Set(prev);if(next.has(cat))next.delete(cat);else next.add(cat);return next;});},[]);
  const handleSize=useCallback((mode)=>{if(mode===sizeMode)return;setSizeMode(mode);sizeModeRef.current=mode;const data=dataRef.current;if(!data)return;sizeAnimRef.current={from:data.diseases.map(d=>sizeMode==='papers'?nR(d.papers):nRM(d.mortality)),to:data.diseases.map(d=>mode==='papers'?nR(d.papers):nRM(d.mortality)),f:0,total:60};},[sizeMode]);
  const handleSearchSel=useCallback((disease)=>{const data=dataRef.current;if(!data)return;const idx=data.idMap[disease.id];if(idx!==undefined){selectDisease(idx);setSearchQuery('');}},[selectDisease]);

  const handleExplode=useCallback(()=>{
    if(explodeActiveRef.current)return;
    explodeActiveRef.current=true;setExplodeActive(true);
    const cur=curPosRef.current;if(!cur)return;
    const saved=cur.map(p=>[...p]);
    const exploded=cur.map(p=>{
      const d=Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2])||1;
      const factor=2.5+Math.random()*1.5;
      return[p[0]*factor+(Math.random()-0.5)*80,p[1]*factor+(Math.random()-0.5)*80,p[2]*factor+(Math.random()-0.5)*80];
    });
    explodeAnimRef.current={from:saved,to:exploded,f:0,total:60};
  },[]);
  const handleUnexplode=useCallback(()=>{
    const cur=curPosRef.current;if(!cur)return;
    const currentPos=cur.map(p=>[...p]);
    const src=catPosRef.current;
    explodeAnimRef.current={from:currentPos,to:src.map(p=>[...p]),f:0,total:60,returning:true};
    setExplodeActive(false);
  },[]);

  const handleConnections=useCallback(()=>{
    if(connectionsActiveRef.current||connFocusRef.current>=0)return;
    connectionsActiveRef.current=true;setConnectionsActive(true);
  },[]);
  const handleCloseConnections=useCallback(()=>{
    connectionsActiveRef.current=false;setConnectionsActive(false);
  },[]);
  const handleVelocity=useCallback(()=>{
    if(explodeActiveRef.current)return;
    explodeActiveRef.current=true;setVelocityActive(true);
    const cur=curPosRef.current;if(!cur)return;
    const saved=cur.map(p=>[...p]);
    const exploded=cur.map(p=>{
      const factor=2.5+Math.random()*1.5;
      return[p[0]*factor+(Math.random()-0.5)*80,p[1]*factor+(Math.random()-0.5)*80,p[2]*factor+(Math.random()-0.5)*80];
    });
    explodeAnimRef.current={from:saved,to:exploded,f:0,total:60};
  },[]);
  const handleCloseVelocity=useCallback(()=>{
    const cur=curPosRef.current;if(!cur)return;
    const currentPos=cur.map(p=>[...p]);
    const src=catPosRef.current;
    explodeAnimRef.current={from:currentPos,to:src.map(p=>[...p]),f:0,total:60,returning:true};
    setVelocityActive(false);
  },[]);
  const handleNeglect=useCallback(()=>{setNeglectMode(prev=>!prev);},[]);
  const stopSpotlight=useCallback(()=>{
    const sp=spotlightRef.current;
    if(sp.timer){clearInterval(sp.timer);sp.timer=null;}
    setSpotlightActive(false);setSpotlightCaption('');
    setSelectedNode(null);
    const ctrl=controlsRef.current;
    if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:ctrl.defaultRadius,f:0,total:70};
  },[]);
  const handleSpotlight=useCallback(()=>{
    const sp=spotlightRef.current;
    if(spotlightActive){stopSpotlight();return;}
    if(explodeActiveRef.current||connectionsActiveRef.current||connFocusRef.current>=0)return;
    const data=dataRef.current;if(!data)return;
    const find=id=>data.idMap[id];
    const list=[
      // Most researched
      {id:find('breast-cancer'),caption:'Breast Cancer · 574K papers · Most researched cancer'},
      {id:find('heart-disease'),caption:'Heart Disease · 9.1M deaths/yr · #1 killer globally'},
      {id:find('type-2-diabetes'),caption:'Type 2 Diabetes · 273K papers · 1.6M deaths/yr'},
      {id:find('hiv-aids'),caption:'HIV/AIDS · 191K papers · Reshaped modern medicine'},
      {id:find('lung-cancer'),caption:'Lung Cancer · 1.8M deaths/yr · Deadliest cancer'},
      // Most deadly
      {id:find('sepsis'),caption:'Sepsis · 11M deaths/yr but only 243K papers · 45 deaths per paper'},
      {id:find('stroke'),caption:'Stroke · 7.3M deaths/yr · Every 3 seconds someone has one'},
      {id:find('copd'),caption:'COPD · 3.5M deaths/yr · 31 deaths per paper published'},
      {id:find('pneumonia'),caption:'Pneumonia · 2.2M deaths/yr · Leading killer of children'},
      {id:find('alzheimers-disease'),caption:"Alzheimer's · 1.9M deaths/yr · Research surging +66%"},
      // Most neglected
      {id:find('rheumatic-heart-disease'),caption:'Rheumatic Heart Disease · 373K deaths, only 19K papers · 19 deaths per paper'},
      {id:find('norovirus'),caption:'Norovirus · 200K deaths/yr · World\'s most common stomach bug'},
      {id:find('sickle-cell-disease'),caption:'Sickle Cell · 376K deaths/yr · Most common genetic disease in Africa'},
      {id:find('hepatitis-b'),caption:'Hepatitis B · 1.1M deaths/yr · 9 deaths for every paper'},
      // Most researched per death
      {id:find('cystic-fibrosis'),caption:'Cystic Fibrosis · 68 papers per death · Most researched per capita'},
      {id:find('ebola'),caption:'Ebola · 43 papers per death · Fear drives funding'},
      {id:find('west-nile-virus'),caption:'West Nile Virus · 50 papers per death · Heavily studied, rarely fatal'},
      // Trending
      {id:find('nafld'),caption:'Fatty Liver Disease · Research up 124% · Fastest growing liver disease'},
      {id:find('myocarditis'),caption:'Myocarditis · Research up 152% · Heart inflammation gaining attention'},
      {id:find('dengue'),caption:'Dengue · Research up 10% · Half the world at risk'},
      // Declining research
      {id:find('covid-19'),caption:'COVID-19 · 505K papers · Research declining as pandemic fades'},
      {id:find('rotavirus'),caption:'Rotavirus · 128K child deaths/yr · Research declining despite mortality'},
      // Zero mortality, high impact
      {id:find('depression'),caption:'Depression · 719K papers · Zero mortality metric, massive burden'},
      {id:find('obesity'),caption:'Obesity · 537K papers · Affects 1 billion people worldwide'},
      // Unique story
      {id:find('malaria'),caption:'Malaria · 608K deaths/yr · 94% of deaths in Africa'},
    ].filter(s=>s.id!==undefined);
    for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    sp.list=list;sp.step=0;
    setSpotlightActive(true);
    setSpotlightCaption(list[0].caption);
    selectDisease(list[0].id);
    sp.step=1;
    sp.timer=setInterval(()=>{
      const idx=sp.step%sp.list.length;
      setSpotlightCaption(sp.list[idx].caption);
      selectDisease(sp.list[idx].id);
      sp.step++;
    },6000);
  },[spotlightActive,stopSpotlight,selectDisease]);

  const RANDOM_PICK_DISEASES=[
    {id:'sepsis',fact:'Sepsis kills 11M people per year — more than all cancers combined — yet has only 243K papers. That\'s 45 deaths for every paper published.'},
    {id:'breast-cancer',fact:'Breast Cancer has 574,000 papers — more research than any other cancer. Yet it\'s only the 5th deadliest cancer globally.'},
    {id:'rheumatic-heart-disease',fact:'Rheumatic Heart Disease kills 373,000 people per year but has only 19,000 papers. It\'s a disease of poverty — virtually eliminated in wealthy nations.'},
    {id:'cystic-fibrosis',fact:'Cystic Fibrosis has 68 papers for every death — the most researched disease per capita. It primarily affects people of European descent.'},
    {id:'malaria',fact:'Malaria kills 608,000 people per year, 94% in Africa. A child dies of malaria every minute, yet it receives a fraction of cancer research funding.'},
    {id:'alzheimers-disease',fact:'Alzheimer\'s kills 1.9M people per year and research is surging +66%. There is still no cure — only treatments that slow progression.'},
    {id:'covid-19',fact:'COVID-19 generated 505,000 papers in just a few years — the fastest research ramp in scientific history. Research is now declining as the pandemic fades.'},
    {id:'ebola',fact:'Ebola has 43 papers per death — fear drives funding. Despite killing only 300 people per year on average, it receives massive research attention.'},
    {id:'depression',fact:'Depression has 719,000 papers and zero mortality metric. It affects 280M people worldwide and is the leading cause of disability globally.'},
    {id:'tuberculosis',fact:'Tuberculosis kills 1.25M people per year with only 0.25 papers per death. It\'s the deadliest infectious disease and has existed for thousands of years.'},
    {id:'sickle-cell-disease',fact:'Sickle Cell Disease kills 376,000 people per year — mostly in Africa. It\'s the most common genetic disease globally but remains severely under-researched.'},
    {id:'rotavirus',fact:'Rotavirus kills 128,000 children per year, and research is declining. A vaccine exists but remains inaccessible in the countries that need it most.'},
  ];

  const handleRandomPick=useCallback(()=>{
    const rp=randomPickRef.current;
    if(rp.phase>0)return; // already running
    if(explodeActiveRef.current||connectionsActiveRef.current||connFocusRef.current>=0)return;
    const data=dataRef.current,ctrl=controlsRef.current;if(!data||!ctrl)return;
    const cur=curPosRef.current;if(!cur)return;

    // Pick a random disease from the curated list
    const pick=RANDOM_PICK_DISEASES[Math.floor(Math.random()*RANDOM_PICK_DISEASES.length)];
    const chosenIdx=data.idMap[pick.id];
    if(chosenIdx===undefined)return;
    rp.chosenIdx=chosenIdx;rp.fact=pick.fact;
    rp.origPositions=cur.map(p=>[...p]);
    rp.origRadius=ctrl.radius;
    rp.velocities=null; // will be set at explosion phase

    // Start animation immediately — defer React state to next frame to avoid stutter
    rp.phase=1;rp.f=0;
    explodeActiveRef.current=true;
    requestAnimationFrame(()=>{setStoryVisible(false);setRandomPickCaption(null);setSelectedNode(null);});
  },[]);

  const stopRandomPick=useCallback(()=>{
    const rp=randomPickRef.current;
    if(rp.phase===0)return;
    const cur=curPosRef.current;if(!cur)return;
    // Animate back to original positions
    const currentPos=cur.map(p=>[...p]);
    const src=catPosRef.current;
    explodeAnimRef.current={from:currentPos,to:src.map(p=>[...p]),f:0,total:60,returning:true};
    rp.phase=0;rp.f=0;rp.chosenIdx=-1;rp.clusterPos=null;
    setRandomPickCaption(null);setStoryVisible(true);setSelectedNode(null);
    const ctrl=controlsRef.current;
    if(ctrl){ctrl.target.set(0,0,0);ctrl.tV=0.0006;flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:ctrl.defaultRadius,f:0,total:70};}
  },[]);

  const handleConnSelect=useCallback((diseaseId)=>{
    const data=dataRef.current;if(!data)return;
    const idx=data.idMap[diseaseId];if(idx===undefined)return;
    // Close overlay, enter conn focus mode
    setConnectionsActive(false);
    connFocusRef.current=idx;connectionsActiveRef.current=true;setConnFocusActive(true);
    setSelectedNode({index:idx,disease:data.diseases[idx]});
    // Build connected set: hub + all its neighbors
    const nbrs=data.neighbors.get(idx);
    const connSet=new Set([idx]);
    if(nbrs)nbrs.forEach(n=>connSet.add(n));
    // Arrange: hub at center, neighbors in fibonacci sphere, rest dispersed
    const cur=curPosRef.current;if(!cur)return;
    const currentPos=cur.map(p=>[...p]);
    const nbrList=[...connSet].filter(i=>i!==idx);
    const goldenAngle=Math.PI*(3-Math.sqrt(5));
    const N=nbrList.length;
    const target=cur.map((p,i)=>{
      if(i===idx)return[0,0,0];
      if(connSet.has(i)){
        const ni=nbrList.indexOf(i);
        const ft=(ni+0.5)/N,uz=1-2*ft;
        const theta=goldenAngle*ni;
        const rXY=Math.sqrt(1-uz*uz);
        const nodeR=sizeModeRef.current==='papers'?nR(data.diseases[i].papers):nRM(data.diseases[i].mortality);
        const orbit=100+nodeR*3+ni*2;
        return[rXY*Math.cos(theta)*orbit,rXY*Math.sin(theta)*orbit,uz*orbit];
      }
      // Disperse unrelated nodes far away
      const d=Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2])||100;
      return[(p[0]/d)*2500,(p[1]/d)*2500,(p[2]/d)*2500];
    });
    explodeAnimRef.current={from:currentPos,to:target,f:0,total:60};
    // Shrink unrelated nodes, restore connected nodes to full size
    const proxies=proxiesRef.current;
    const curSizes=data.diseases.map((_,i)=>proxies[i]?proxies[i].scale.x:1);
    const targetSizes=data.diseases.map((d,i)=>{
      if(!connSet.has(i))return 0.001;
      return sizeModeRef.current==='papers'?nR(d.papers):nRM(d.mortality);
    });
    sizeAnimRef.current={from:curSizes,to:targetSizes,f:0,total:60};
    // Fly camera: zoom out proportional to neighbor count for readability
    const ctrl=controlsRef.current;
    if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:Math.max(600,350+N*6),f:0,total:50};
  },[]);

  // Story mode handler
  const storyRef=useRef({timer:null,step:0,seq:null,chipId:null,nodeIdx:-1});
  const [storyTip,setStoryTip]=useState(null);
  const advanceStory=useCallback(()=>{
    const sr=storyRef.current;
    if(sr.timer){clearTimeout(sr.timer);sr.timer=null;}
    if(!sr.seq||sr.step>=sr.seq.length){
      setStoryCaption('');sr.nodeIdx=-1;setStoryTip(null);setSelectedNode(null);
      if(sr.chipId==='mismatch'&&sizeToggleRef.current){sizeToggleRef.current.style.animation='chipPulse 1.5s infinite';}
      const ctrl=controlsRef.current;
      if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:ctrl.defaultRadius,f:0,total:70};
      sr.seq=null;return;
    }
    const s=sr.seq[sr.step];
    setStoryCaption(s.caption||'');
    if(s.id!==undefined){selectDisease(s.id);sr.nodeIdx=s.id;}
    else{sr.nodeIdx=-1;setStoryTip(null);}
    sr.step++;
  },[selectDisease]);
  const handleStory=useCallback((chipId)=>{
    const sr=storyRef.current;
    if(sr.timer){clearTimeout(sr.timer);sr.timer=null;}
    setStoryCaption('');setStoryTip(null);sr.nodeIdx=-1;
    const data=dataRef.current;if(!data)return;
    const find=id=>data.idMap[id];
    const sequences={
      researched:[{id:find('breast-cancer'),caption:'Breast Cancer — 574K papers'},{id:find('lung-cancer'),caption:'Lung Cancer — 494K papers'},{id:find('type-2-diabetes'),caption:'Type 2 Diabetes — 273K papers'},{caption:'These diseases each have 270,000+ papers.'}],
      killers:[{id:find('heart-disease'),caption:'Heart Disease — 9.1M deaths/yr'},{id:find('stroke'),caption:'Stroke — 7.3M deaths/yr'},{id:find('copd'),caption:'COPD — 3.5M deaths/yr'},{caption:'These diseases kill millions per year.'}],
      forgotten:[{id:find('rotavirus'),caption:'Rotavirus — 128K child deaths/yr, research declining 13%'},{id:find('tetanus'),caption:'Tetanus — 35K deaths/yr, research declining 10%'},{id:find('hepatitis-c'),caption:'Hepatitis C — 242K deaths/yr, research declining 44%'},{caption:'These diseases still kill 405,000+ yearly while the world looks away.'}],
      silent:[{id:find('rheumatic-heart-disease'),caption:'Rheumatic Heart Disease — 373K deaths/yr, only 19K papers (19 deaths per paper)'},{id:find('norovirus'),caption:'Norovirus — 200K deaths/yr, only 9K papers'},{id:find('pertussis'),caption:'Pertussis — 59K deaths/yr, only 36K papers'},{id:find('rotavirus'),caption:'Rotavirus — 128K child deaths/yr, research declining'},{caption:'These diseases kill 760,000+ people every year in near-silence.'}],
      richpoor:[{id:find('cystic-fibrosis'),caption:'Cystic Fibrosis — 68 papers per death (wealthy nation disease)'},{id:find('multiple-sclerosis'),caption:'Multiple Sclerosis — 26 papers per death (wealthy nation disease)'},{id:find('tuberculosis'),caption:'Tuberculosis — 0.25 papers per death, 1.25M deaths/yr (developing nation)'},{id:find('malaria'),caption:'Malaria — 0.20 papers per death, 608K deaths/yr (developing nation)'},{caption:'Where you are born determines how much science fights for your life.'}],
      mismatch:[{id:find('cystic-fibrosis'),caption:'Cystic Fibrosis — 68K papers, 1K deaths (68 papers per death)'},{id:find('rheumatic-heart-disease'),caption:'Rheumatic Heart Disease — 19K papers, 373K deaths (0.05 papers per death)'},{caption:'1,300× research intensity gap. Now toggle Mortality at the top of the page →'}],
    };
    sr.seq=sequences[chipId];sr.step=0;sr.chipId=chipId;
    if(!sr.seq)return;
    advanceStory();
  },[selectDisease,advanceStory]);

  useEffect(()=>{
    const container=containerRef.current;if(!container)return;
    const tier=dTier(),cfg=TC[tier];
    const data=processData(diseasesData,connectionsData);dataRef.current=data;
    const {diseases,layoutEdges,displayEdges}=data;
    const {catPos,netPos,debugStr,rawMax}=computeLayouts(diseases,layoutEdges);
    catPosRef.current=catPos;netPosRef.current=netPos;
    curPosRef.current=catPos.map(p=>[...p]);

    // Camera distance scales with layout size
    const mob=isMob();
    const camDist=rawMax*(mob?2.4:2.0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(60,container.clientWidth/container.clientHeight,1,camDist*4);
    camera.position.set(0,0,camDist);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(container.clientWidth,container.clientHeight);
    const isAndroid=/android/i.test(navigator.userAgent);
    const isIOS=/iP(hone|ad|od)/i.test(navigator.userAgent);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,isAndroid?2:isIOS?3:cfg.dprCap));
    renderer.setClearColor(0x000000,0);container.appendChild(renderer.domElement);rendererRef.current=renderer;
    let composer=null;
    if(isAndroid){
      composer=new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene,camera));
      const fxaa=new ShaderPass(FXAAShader);
      const pr=renderer.getPixelRatio();
      fxaa.material.uniforms['resolution'].value.set(1/(container.clientWidth*pr),1/(container.clientHeight*pr));
      composer.addPass(fxaa);
    }
    const controls=new OC(camera,renderer.domElement);
    controls.radius=camDist*0.4;controls.defaultRadius=camDist;
    controlsRef.current=controls;

    // Lighting: lower ambient to preserve color saturation
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const ptL=new THREE.PointLight(0xffffff,0.6,0);scene.add(ptL);
    const rimLight=new THREE.DirectionalLight(0x6699cc,0.3);rimLight.position.set(-200,150,-300);scene.add(rimLight);
    // No fog — keep nodes fully visible at all zoom levels
    // Tone mapping — lower exposure to prevent desaturation
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;



    const count=diseases.length;
    // Plasma orb spheres — custom shader on desktop, simple material on mobile
    const mobDevice=tier==='LOW';
    const sGeo=new THREE.SphereGeometry(1,mobDevice?16:24,mobDevice?16:24);
    const sMat=mobDevice?new THREE.MeshPhongMaterial({transparent:true,opacity:0.95,shininess:60}):new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:PLASMA_VERT,fragmentShader:PLASMA_FRAG,transparent:true});
    const iMesh=new THREE.InstancedMesh(sGeo,sMat,count);
    const m4=new THREE.Matrix4(),v3=new THREE.Vector3(),q4=new THREE.Quaternion(),s3=new THREE.Vector3();

    // Init nodes at full scale — oscillation starts immediately
    const phases=[];
    for(let i=0;i<count;i++){v3.set(...catPos[i]);const r=nR(diseases[i].papers);s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);iMesh.setColorAt(i,new THREE.Color(CC[diseases[i].category]));phases.push(Math.random()*Math.PI*2);}
    nodePhaseRef.current=phases;
    iMesh.instanceMatrix.needsUpdate=true;iMesh.instanceColor.needsUpdate=true;
    // Per-instance phase offset for unique plasma animation
    const phaseArr=new Float32Array(count);for(let i=0;i<count;i++)phaseArr[i]=phases[i];
    sGeo.setAttribute('aPhase',new THREE.InstancedBufferAttribute(phaseArr,1));
    scene.add(iMesh);iMeshRef.current=iMesh;

    // Glow sprites
    const glowTex=makeGlowTexture();
    const glowGroup=new THREE.Group();
    const glowSprites=[];
    const topN=cfg.glowAll?count:Math.min(40,count);
    const sorted=[...diseases].map((d,i)=>({i,papers:d.papers})).sort((a,b)=>b.papers-a.papers).slice(0,topN).map(x=>x.i);
    const glowSet=new Set(sorted);
    for(let i=0;i<count;i++){
      if(!glowSet.has(i)){glowSprites.push(null);continue;}
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:new THREE.Color(CC[diseases[i].category]),transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,opacity:0.35}));
      sp.position.set(...catPos[i]);
      const r=nR(diseases[i].papers)*3.5;sp.scale.set(r,r,1);
      glowGroup.add(sp);glowSprites.push(sp);
    }
    glowGroup.renderOrder=-2;scene.add(glowGroup);glowSpritesRef.current=glowSprites;

    // Proxies
    const pGeo=new THREE.SphereGeometry(1,8,8),pMat=new THREE.MeshBasicMaterial({visible:false});
    const pGroup=new THREE.Group(),proxies=[];
    for(let i=0;i<count;i++){const pr=new THREE.Mesh(pGeo,pMat);pr.position.set(...catPos[i]);const r=Math.max(nR(diseases[i].papers),1.5);pr.scale.set(r,r,r);pr.userData.idx=i;pGroup.add(pr);proxies.push(pr);}
    scene.add(pGroup);proxiesRef.current=proxies;

    // Edges
    const eC=displayEdges.length,eBuf=new Float32Array(eC*6);
    for(let i=0;i<eC;i++){const e=displayEdges[i],s=catPos[e.si],t=catPos[e.ti],o=i*6;eBuf[o]=s[0];eBuf[o+1]=s[1];eBuf[o+2]=s[2];eBuf[o+3]=t[0];eBuf[o+4]=t[1];eBuf[o+5]=t[2];}
    const eGeo=new THREE.BufferGeometry();eGeo.setAttribute('position',new THREE.BufferAttribute(eBuf,3));
    const eClr=new Float32Array(eC*6).fill(1.0);eGeo.setAttribute('color',new THREE.BufferAttribute(eClr,3));
    const eMat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false});
    const eMesh=new THREE.LineSegments(eGeo,eMat);eMesh.renderOrder=-1;scene.add(eMesh);edgeMeshRef.current=eMesh;

    // Trail fade overlay (used during Random Pick spin)
    const fadeCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const fadeMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.04,depthTest:false,depthWrite:false});
    const fadeGeo=new THREE.PlaneGeometry(2,2);
    const fadeMesh=new THREE.Mesh(fadeGeo,fadeMat);
    const fadeScene=new THREE.Scene();fadeScene.add(fadeMesh);

    // Tornado swirl particles (used during Random Pick spin)
    const tornadoCount=200;
    const tornadoGeo=new THREE.BufferGeometry();
    const tornadoPos=new Float32Array(tornadoCount*3);
    const tornadoData=[];// {angle, height, radius, speed}
    for(let i=0;i<tornadoCount;i++){
      const a=Math.random()*Math.PI*2;
      const h=(Math.random()-0.5)*2; // -1 to 1
      const r=0.3+Math.random()*0.7; // radius factor
      const spd=0.8+Math.random()*1.2;
      tornadoData.push({a,h,r,spd});
      tornadoPos[i*3]=0;tornadoPos[i*3+1]=0;tornadoPos[i*3+2]=0;
    }
    tornadoGeo.setAttribute('position',new THREE.BufferAttribute(tornadoPos,3));
    const tornadoMat=new THREE.PointsMaterial({color:0x8899bb,size:1.2,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    const tornadoMesh=new THREE.Points(tornadoGeo,tornadoMat);
    tornadoMesh.renderOrder=10;scene.add(tornadoMesh);

    // Background particles
    if(cfg.particles>0){
      const pCount=cfg.particles,pPos=new Float32Array(pCount*3);
      const pR=camDist*4;for(let i=0;i<pCount;i++){const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=pR+Math.random()*pR*0.3;pPos[i*3]=r*Math.sin(ph)*Math.cos(th);pPos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pPos[i*3+2]=r*Math.cos(ph);}
      const pGeo2=new THREE.BufferGeometry();pGeo2.setAttribute('position',new THREE.BufferAttribute(pPos,3));
      const pMat2=new THREE.PointsMaterial({color:0x334155,size:1.5,transparent:true,opacity:0.6});
      const particles=new THREE.Points(pGeo2,pMat2);scene.add(particles);
    }

    // Mouse
    const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(-9999,-9999);
    function onMM(e){const rc=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-rc.left)/rc.width)*2-1;mouse.y=-((e.clientY-rc.top)/rc.height)*2+1;setTipPos({x:e.clientX,y:e.clientY});}
    function onMD(e){mdRef.current={x:e.clientX,y:e.clientY};idleRef.current=0;if(spotlightRef.current.timer){clearInterval(spotlightRef.current.timer);spotlightRef.current.timer=null;setSpotlightActive(false);setSpotlightCaption('');}if(randomPickRef.current.phase>0)stopRandomPick();}
    function onMU(e){const dx=e.clientX-mdRef.current.x,dy=e.clientY-mdRef.current.y;if(Math.sqrt(dx*dx+dy*dy)<5){if(hoverIdxRef.current>=0)selectDisease(hoverIdxRef.current);else deselect();}}
    function onDblClick(e){
      e.preventDefault();idleRef.current=0;deselect();
      flyRef.current={st:controls.target.clone(),et:new THREE.Vector3(0,0,0),sr:controls.radius,er:controls.defaultRadius,f:0,total:50};
      // Also reset theta/phi smoothly by zeroing velocities and letting fly handle position
      controls.theta=controls.defaultTheta;controls.phi=controls.defaultPhi;controls.tV=0;controls.pV=0;controls.pnX=0;controls.pnY=0;
    }
    renderer.domElement.addEventListener('mousemove',onMM);renderer.domElement.addEventListener('mousedown',onMD);renderer.domElement.addEventListener('mouseup',onMU);renderer.domElement.addEventListener('dblclick',onDblClick);

    // Touch: tap-to-select, double-tap-to-recenter
    let _tapStart={x:0,y:0,t:0},_lastTap=0;
    function onTouchStart(e){if(spotlightRef.current.timer){clearInterval(spotlightRef.current.timer);spotlightRef.current.timer=null;setSpotlightActive(false);setSpotlightCaption('');}if(randomPickRef.current.phase>0)stopRandomPick();if(e.touches.length===1){_tapStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};idleRef.current=0;}else{idleRef.current=0;}}
    function onTouchEnd(e){if(e.touches.length>0)return;
      const dt=Date.now()-_tapStart.t;if(dt>300)return; // not a tap
      const cx=_tapStart.x,cy=_tapStart.y;
      // Double-tap detection
      const now=Date.now();
      if(now-_lastTap<350){_lastTap=0;idleRef.current=0;deselect();
        flyRef.current={st:controls.target.clone(),et:new THREE.Vector3(0,0,0),sr:controls.radius,er:controls.defaultRadius,f:0,total:50};
        controls.theta=controls.defaultTheta;controls.phi=controls.defaultPhi;controls.tV=0;controls.pV=0;controls.pnX=0;controls.pnY=0;return;}
      _lastTap=now;
      // Single tap: raycast at touch position
      const rc=renderer.domElement.getBoundingClientRect();
      mouse.x=((cx-rc.left)/rc.width)*2-1;mouse.y=-((cy-rc.top)/rc.height)*2+1;
      raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(proxies);
      if(hits.length>0){const hi=hits[0].object.userData.idx;selectDisease(hi);setHoveredNode({index:hi,disease:diseases[hi]});setTipPos({x:cx,y:cy});}else{deselect();setHoveredNode(null);}
      mouse.x=-9999;mouse.y=-9999; // reset so continuous raycast doesn't fire
    }
    function onTouchMove2(){idleRef.current=0;}
    renderer.domElement.addEventListener('touchstart',onTouchStart,{passive:true});renderer.domElement.addEventListener('touchmove',onTouchMove2,{passive:true});renderer.domElement.addEventListener('touchend',onTouchEnd,{passive:true});

    // Gyroscope parallax (iOS/mobile)
    const gyro={x:0,y:0,enabled:false,permitted:false};
    function onDeviceOrientation(e){if(e.gamma===null)return;gyro.x=e.gamma/90;gyro.y=(e.beta-45)/90;gyro.enabled=true;}
    if(mob&&window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function'){
      // iOS only: request gyro permission on first tap
      const reqGyro=()=>{if(gyro.permitted)return;gyro.permitted=true;
        DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted')window.addEventListener('deviceorientation',onDeviceOrientation);}).catch(()=>{gyro.permitted=false;});
        document.removeEventListener('touchend',reqGyro);};
      document.addEventListener('touchend',reqGyro);
    }

    // Start oscillation immediately — no entrance stagger
    const entrance={phase:2,f:0,nodesDone:count};
    controls.tV=0.0006; // gentle initial rotation
    flyRef.current={st:new THREE.Vector3(0,0,0),et:new THREE.Vector3(0,0,0),sr:camDist*0.4,er:camDist,f:0,total:140};
    let alive=true;
    function animate(){
      if(!alive)return;
      const frame=++frameRef.current;
      idleRef.current++;

      // ── Auto-rotate when idle — only after user momentum fully decays ──
      if(idleRef.current>5&&Math.abs(controls.tV)<0.0004&&Math.abs(controls.pV)<0.0004) controls.tV=0.0006;

      // Layout lerp
      const la=layoutAnimRef.current;
      if(la){la.f++;const t=Math.min(la.f/la.total,1),ease=1-Math.pow(1-t,3);const cur=curPosRef.current;
        for(let i=0;i<count;i++){cur[i][0]=la.from[i][0]+(la.to[i][0]-la.from[i][0])*ease;cur[i][1]=la.from[i][1]+(la.to[i][1]-la.from[i][1])*ease;cur[i][2]=la.from[i][2]+(la.to[i][2]-la.from[i][2])*ease;}
        if(t>=1){layoutAnimRef.current=null;driftBlendRef.current=0;}
        for(let i=0;i<count;i++){v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);if(glowSprites[i])glowSprites[i].position.set(cur[i][0],cur[i][1],cur[i][2]);}
        iMesh.instanceMatrix.needsUpdate=true;
        const ep=eGeo.getAttribute('position').array;
        for(let i=0;i<eC;i++){const e=displayEdges[i],s=cur[e.si],t2=cur[e.ti],o=i*6;ep[o]=s[0];ep[o+1]=s[1];ep[o+2]=s[2];ep[o+3]=t2[0];ep[o+4]=t2[1];ep[o+5]=t2[2];}
        eGeo.getAttribute('position').needsUpdate=true;
      }

      // Size lerp (scale only — positions handled by drift loop)
      const sa=sizeAnimRef.current;
      if(sa){sa.f++;const t=Math.min(sa.f/sa.total,1),ease=1-Math.pow(1-t,3);
        for(let i=0;i<count;i++){const r=sa.from[i]+(sa.to[i]-sa.from[i])*ease;proxies[i].scale.set(Math.max(r,1.5),Math.max(r,1.5),Math.max(r,1.5));if(glowSprites[i]){const gr=r*3;glowSprites[i].scale.set(gr,gr,1);}}
        if(t>=1)sizeAnimRef.current=null;}

      // Explode animation
      const ea=explodeAnimRef.current;
      if(ea){ea.f++;const t=Math.min(ea.f/ea.total,1),ease=1-Math.pow(1-t,3);const cur=curPosRef.current;
        for(let i=0;i<count;i++){cur[i][0]=ea.from[i][0]+(ea.to[i][0]-ea.from[i][0])*ease;cur[i][1]=ea.from[i][1]+(ea.to[i][1]-ea.from[i][1])*ease;cur[i][2]=ea.from[i][2]+(ea.to[i][2]-ea.from[i][2])*ease;}
        for(let i=0;i<count;i++){v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);if(glowSprites[i])glowSprites[i].position.set(cur[i][0],cur[i][1],cur[i][2]);}
        iMesh.instanceMatrix.needsUpdate=true;
        const ep=eGeo.getAttribute('position').array;
        for(let i=0;i<eC;i++){const e2=displayEdges[i],s2=cur[e2.si],t2=cur[e2.ti],o=i*6;ep[o]=s2[0];ep[o+1]=s2[1];ep[o+2]=s2[2];ep[o+3]=t2[0];ep[o+4]=t2[1];ep[o+5]=t2[2];}
        eGeo.getAttribute('position').needsUpdate=true;
        if(t>=1){explodeAnimRef.current=null;if(ea.returning){explodeActiveRef.current=false;driftBlendRef.current=0;}if(ea.connReturning){connFocusRef.current=-1;setConnFocusActive(false);}}
      }

      // Random Pick animation
      const rp=randomPickRef.current;
      if(rp.phase>0){
        rp.f++;const cur=curPosRef.current;
        if(rp.phase===1){
          // Phase 1: Collapse directly to cluster positions (150 frames ~2.5s)
          const t=Math.min(rp.f/150,1);
          const easeIn=t*t;
          controls.tV=0.0006+easeIn*0.012;
          const orig=rp.origPositions;
          // Compute cluster targets on first frame
          if(!rp.clusterPos){
            const GA=2.399963,ballR=controls.defaultRadius*0.28;
            const jit=ballR*0.35;
            rp.clusterPos=[];
            for(let i=0;i<count;i++){
              const phi2=Math.acos(1-2*(i+0.5)/count);
              const theta2=GA*i;
              rp.clusterPos.push([
                Math.sin(phi2)*Math.cos(theta2)*ballR+Math.sin(i*3.7)*jit,
                Math.cos(phi2)*ballR+Math.cos(i*5.3)*jit,
                Math.sin(phi2)*Math.sin(theta2)*ballR+Math.sin(i*7.1)*jit
              ]);
            }
          }
          const cp=rp.clusterPos;
          // Smoothstep blend from original → cluster
          const blend=t*t*(3-2*t);
          for(let i=0;i<count;i++){
            cur[i][0]=orig[i][0]*(1-blend)+cp[i][0]*blend;
            cur[i][1]=orig[i][1]*(1-blend)+cp[i][1]*blend;
            cur[i][2]=orig[i][2]*(1-blend)+cp[i][2]*blend;
            v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);if(glowSprites[i])glowSprites[i].position.set(cur[i][0],cur[i][1],cur[i][2]);}
          iMesh.instanceMatrix.needsUpdate=true;
          if(rp.f%3===0&&controls.radius>controls.defaultRadius*0.7)controls.radius-=0.3;
          if(rp.f>=150){rp.phase=2;rp.f=0;}
        }else if(rp.phase===2){
          // Phase 2: Spin ramp slow→max + hold (460 frames ~7.7s)
          // Ramp over 220 frames, sustain max for 240 frames (~4s at top speed)
          const rampT=Math.min(rp.f/220,1);
          const rampEase=rampT*rampT*rampT;
          controls.tV=0.013+rampEase*0.187; // 0.013 → 0.2
          // Camera shake builds in final 60 frames
          const shakeT=Math.max(0,(rp.f-400)/60);
          if(shakeT>0){const sk=shakeT*0.5;controls.target.x=Math.sin(rp.f*1.7)*sk;controls.target.y=Math.cos(rp.f*2.3)*sk;}
          // Hold stable cluster positions — no pulse, no bounce
          const cp=rp.clusterPos;
          for(let i=0;i<count;i++){
            cur[i][0]=cp[i][0];cur[i][1]=cp[i][1];cur[i][2]=cp[i][2];
            v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);if(glowSprites[i])glowSprites[i].position.set(cur[i][0],cur[i][1],cur[i][2]);}
          iMesh.instanceMatrix.needsUpdate=true;
          if(rp.f>=460){
            rp.phase=3;rp.f=0;controls.target.set(0,0,0);
            // Initialize per-node velocities for physics explosion
            const vels=[];
            for(let i=0;i<count;i++){
              if(i===rp.chosenIdx){vels.push([0,0,0]);continue;}
              // Random direction on unit sphere (uniform)
              const u=Math.random()*2-1,th=Math.random()*Math.PI*2;
              const s2=Math.sqrt(1-u*u);
              // Speed: base + random variation
              const spd=controls.defaultRadius*0.12*(0.7+Math.random()*0.6);
              vels.push([s2*Math.cos(th)*spd, u*spd, s2*Math.sin(th)*spd]);
            }
            rp.velocities=vels;
          }
        }else if(rp.phase===3){
          // Phase 3: Physics explosion — velocity + drag (90 frames)
          const t=Math.min(rp.f/90,1);
          controls.tV=0.2*Math.pow(1-t,3)+0.0006; // decelerate rotation from new max
          const drag=0.96; // per-frame velocity damping
          const vels=rp.velocities;
          for(let i=0;i<count;i++){
            if(i===rp.chosenIdx){
              // Chosen: converge to center after brief delay
              const ce=t<0.25?0:Math.min((t-0.25)/0.35,1);
              const ce2=ce*ce*(3-2*ce);
              cur[i][0]*=(1-ce2*0.15);cur[i][1]*=(1-ce2*0.15);cur[i][2]*=(1-ce2*0.15);
            }else{
              // Apply velocity then damp
              cur[i][0]+=vels[i][0];cur[i][1]+=vels[i][1];cur[i][2]+=vels[i][2];
              vels[i][0]*=drag;vels[i][1]*=drag;vels[i][2]*=drag;
            }
            v3.set(cur[i][0],cur[i][1],cur[i][2]);const r=proxies[i].scale.x;s3.set(r,r,r);m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);proxies[i].position.set(cur[i][0],cur[i][1],cur[i][2]);if(glowSprites[i])glowSprites[i].position.set(cur[i][0],cur[i][1],cur[i][2]);
          }
          iMesh.instanceMatrix.needsUpdate=true;
          if(rp.f>=90){
            rp.phase=4;rp.f=0;controls.tV=0.0006;
            selectDisease(rp.chosenIdx);
            setRandomPickCaption({disease:diseases[rp.chosenIdx],fact:rp.fact});
          }
        }else if(rp.phase===4){
          // Phase 4: Reveal — holding on chosen disease
        }
        // Update edge positions during random pick so white lines track nodes
        if(eMat.opacity>0){
          const ep=eGeo.getAttribute('position').array;
          for(let i=0;i<eC;i++){const e=displayEdges[i],s=cur[e.si],t2=cur[e.ti],o=i*6;ep[o]=s[0];ep[o+1]=s[1];ep[o+2]=s[2];ep[o+3]=t2[0];ep[o+4]=t2[1];ep[o+5]=t2[2];}
          eGeo.getAttribute('position').needsUpdate=true;
        }
        // Tornado swirl particles — visible during phases 1-2, fade out in phase 3
        const ballR=controls.defaultRadius*0.28;
        const tSpd=controls.tV/0.2; // 0→1 normalized spin speed
        if(rp.phase<=2){
          tornadoMat.opacity=Math.min(tSpd*0.6,0.5);
          const tp=tornadoGeo.getAttribute('position').array;
          for(let i=0;i<tornadoCount;i++){
            const d=tornadoData[i];
            d.a+=d.spd*tSpd*0.12; // swirl speed tracks spin
            const wideR=ballR*(0.8+d.r*1.8); // wider than cluster
            const h=d.h*ballR*2.5; // taller than cluster
            // Funnel shape: wider at top, narrower at bottom
            const funnel=0.5+0.5*(d.h+1)*0.5; // 0.5 at bottom → 0.75 at top
            tp[i*3]=Math.cos(d.a)*wideR*funnel;
            tp[i*3+1]=h;
            tp[i*3+2]=Math.sin(d.a)*wideR*funnel;
          }
          tornadoGeo.getAttribute('position').needsUpdate=true;
        }else if(rp.phase===3){
          tornadoMat.opacity*=0.9; // fade out during explosion
        }else{
          tornadoMat.opacity=0;
        }
      }

      // Clear tornado if not in random pick
      if(rp.phase===0&&tornadoMat.opacity>0)tornadoMat.opacity=0;

      // Plasma animation — update time uniform (desktop only)
      if(sMat.uniforms)sMat.uniforms.time.value=frame*0.016;

      // Fly-to
      const fly=flyRef.current;
      if(fly){fly.f++;const t=Math.min(fly.f/fly.total,1),ease=t*t*(3-2*t);controls.target.lerpVectors(fly.st,fly.et,ease);controls.radius=fly.sr+(fly.er-fly.sr)*ease;if(t>=1)flyRef.current=null;}

      // ── Idle drift: sinusoidal breathing on node positions (single-pass) ──
      if(!layoutAnimRef.current&&!explodeAnimRef.current&&!explodeActiveRef.current&&!connectionsActiveRef.current&&connFocusRef.current<0){
        const t=frame*0.016;
        const cur=curPosRef.current;
        const src=catPosRef.current;
        if(src){
          const ph_arr=nodePhaseRef.current;
          const bl=driftBlendRef.current;
          if(bl<1)driftBlendRef.current=Math.min(1,bl+0.025);
          const ry=t*0.15;q4.set(0,Math.sin(ry*0.5),0,Math.cos(ry*0.5));
          for(let i=0;i<count;i++){
            const ph=ph_arr[i];
            const px=src[i][0]+Math.sin(t*0.3+ph)*12*bl;
            const py=src[i][1]+Math.cos(t*0.25+ph*1.3)*12*bl;
            const pz=src[i][2]+Math.sin(t*0.2+ph*0.7)*10*bl;
            cur[i][0]=px;cur[i][1]=py;cur[i][2]=pz;
            v3.set(px,py,pz);
            const r=proxies[i].scale.x;s3.set(r,r,r);
            m4.compose(v3,q4,s3);iMesh.setMatrixAt(i,m4);
            proxies[i].position.set(px,py,pz);
            if(glowSprites[i])glowSprites[i].position.set(px,py,pz);
          }
          iMesh.instanceMatrix.needsUpdate=true;
          // Update edge positions to track drifting nodes
          if(eMat.opacity>0){
            const ep=eGeo.getAttribute('position').array;
            for(let i=0;i<eC;i++){const e=displayEdges[i],s=cur[e.si],t2=cur[e.ti],o=i*6;ep[o]=s[0];ep[o+1]=s[1];ep[o+2]=s[2];ep[o+3]=t2[0];ep[o+4]=t2[1];ep[o+5]=t2[2];}
            eGeo.getAttribute('position').needsUpdate=true;
          }
        }
        q4.set(0,0,0,1);
      }

      controls.update();
      if(gyro.enabled){const str=controls.radius*0.25;const r=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);const u=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);camera.position.addScaledVector(r,gyro.x*str);camera.position.addScaledVector(u,-gyro.y*str);camera.lookAt(controls.target);}
      ptL.position.copy(camera.position);

      // Story tooltip — project focused node to screen coords
      const sni=storyRef.current.nodeIdx;
      if(sni>=0&&frame%3===0&&curPosRef.current&&!flyRef.current){
        camera.updateMatrixWorld();
        const sp=curPosRef.current[sni];
        const vp=new THREE.Vector3(sp[0],sp[1],sp[2]).project(camera);
        const rc=renderer.domElement.getBoundingClientRect();
        const sx=(vp.x*0.5+0.5)*rc.width+rc.left;
        const sy=(-vp.y*0.5+0.5)*rc.height+rc.top;
        setStoryTip({disease:diseases[sni],x:sx,y:sy,connCount:data.connCounts.get(sni)});
      }

      // Raycast
      if(frame%2===0&&entrance.phase>=2&&!flyRef.current){
        raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(proxies);
        const ni=hits.length>0?hits[0].object.userData.idx:-1;
        if(ni!==hoverIdxRef.current){hoverIdxRef.current=ni;if(ni>=0){setHoveredNode({index:ni,disease:diseases[ni]});setCursor('pointer');}else{setHoveredNode(null);setCursor('default');}}
      }
      // Trail effect during Random Pick spin (phases 1-2)
      const trailActive=rp.phase===1||rp.phase===2;
      if(trailActive){
        renderer.autoClear=false;
        renderer.render(fadeScene,fadeCam); // semi-transparent black overlay fades previous frame
        renderer.render(scene,camera);
        renderer.autoClear=true;
      }else if(composer)composer.render();else renderer.render(scene,camera);

      // ── Node labels: project all positions to screen, update DOM directly ──
      const lc=labelsRef.current;
      if(lc&&entrance.phase>=1&&(!flyRef.current||frame%3===0)){
        const rc=renderer.domElement.getBoundingClientRect();
        const cur=curPosRef.current;
        const hIdx=hoverIdxRef.current;
        const kids=lc.children;
        const pv=new THREE.Vector3();
        for(let i=0;i<count;i++){
          const el=kids[i];if(!el)continue;
          pv.set(cur[i][0],cur[i][1],cur[i][2]).project(camera);
          // behind camera or off-screen → hide
          if(pv.z>1||pv.z<-1){el.style.display='none';continue;}
          let sx=(pv.x*0.5+0.5)*rc.width;
          const sy=(-pv.y*0.5+0.5)*rc.height;
          // clamp so labels don't get cut off at screen edges
          sx=Math.max(40,Math.min(rc.width-40,sx));
          const nodeR=nR(diseases[i].papers);
          const screenR=nodeR*rc.height/(2*controls.radius*Math.tan(Math.PI/6));
          // hide only very tiny labels when zoomed way out
          if(screenR<0.3&&i!==hIdx){el.style.display='none';continue;}
          el.style.display='';
          el.style.left=sx+'px';
          el.style.top=(sy-Math.max(screenR*1.2,4)-12)+'px';
          el.style.opacity=i===hIdx?1:0.75;
          // expanded on hover
          if(i===hIdx){el.classList.add('lbl-hover');}else{el.classList.remove('lbl-hover');}
        }
      }


      requestAnimationFrame(animate);
    }
    animate();

    const ro=new ResizeObserver(([e])=>{const{width:w,height:h}=e.contentRect;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);if(composer){composer.setSize(w,h);const pr=renderer.getPixelRatio();composer.passes.forEach(p=>{if(p.material&&p.material.uniforms['resolution'])p.material.uniforms['resolution'].value.set(1/(w*pr),1/(h*pr));});}});
    ro.observe(container);
    // Escape to dismiss story
    function onKey(e){if(e.key==='Escape'){
      const sr=storyRef.current;if(sr.timer){clearTimeout(sr.timer);sr.timer=null;}sr.seq=null;sr.step=0;sr.nodeIdx=-1;
      setStoryCaption('');setStoryTip(null);
      if(spotlightRef.current.timer){clearInterval(spotlightRef.current.timer);spotlightRef.current.timer=null;setSpotlightActive(false);setSpotlightCaption('');}
      if(randomPickRef.current.phase>0){stopRandomPick();return;}
      if(explodeActiveRef.current){
        const cur=curPosRef.current;if(cur){const cp=cur.map(p=>[...p]);const src=catPosRef.current;explodeAnimRef.current={from:cp,to:src.map(p=>[...p]),f:0,total:60,returning:true};}
        explodeActiveRef.current=false;setExplodeActive(false);setVelocityActive(false);
      }
      if(connectionsActiveRef.current){connectionsActiveRef.current=false;setConnectionsActive(false);}
      setNeglectMode(false);
      deselect();
      const ctrl=controlsRef.current;
      if(ctrl)flyRef.current={st:ctrl.target.clone(),et:new THREE.Vector3(0,0,0),sr:ctrl.radius,er:ctrl.defaultRadius,f:0,total:70};
    }}
    window.addEventListener('keydown',onKey);

    return()=>{alive=false;ro.disconnect();controls.dispose();window.removeEventListener('keydown',onKey);window.removeEventListener('deviceorientation',onDeviceOrientation);if(spotlightRef.current.timer)clearInterval(spotlightRef.current.timer);renderer.domElement.removeEventListener('mousemove',onMM);renderer.domElement.removeEventListener('mousedown',onMD);renderer.domElement.removeEventListener('mouseup',onMU);renderer.domElement.removeEventListener('dblclick',onDblClick);renderer.domElement.removeEventListener('touchstart',onTouchStart);renderer.domElement.removeEventListener('touchmove',onTouchMove2);renderer.domElement.removeEventListener('touchend',onTouchEnd);sGeo.dispose();sMat.dispose();pGeo.dispose();pMat.dispose();eGeo.dispose();eMat.dispose();iMesh.dispose();glowTex.dispose();if(composer)composer.dispose();renderer.dispose();if(container.contains(renderer.domElement))container.removeChild(renderer.domElement);};
  },[selectDisease,deselect]);

  // Highlight effect — deferred via rAF to avoid blocking the frame that triggers state change
  useEffect(()=>{
    const raf=requestAnimationFrame(()=>{
    const iMesh=iMeshRef.current,eMesh=edgeMeshRef.current,data=dataRef.current,glows=glowSpritesRef.current;
    if(!iMesh||!eMesh||!data)return;
    const hIdx=hoveredNode?hoveredNode.index:-1,sIdx=selectedNode?selectedNode.index:-1;
    const connFocusIdx=connFocusRef.current;
    const aIdx=hIdx>=0?hIdx:sIdx>=0?sIdx:connFocusIdx;
    const nbrs=aIdx>=0?data.neighbors.get(aIdx):null;
    const {diseases,displayEdges}=data;const sq=searchQuery.toLowerCase();
    const connMode=connectionsActive;
    // Hub set for connections mode (top 10 most connected)
    const hubSet=new Set();
    if(connMode){connData.hubs.forEach(h=>{const idx=data.idMap[h.id];if(idx!==undefined)hubSet.add(idx);});}

    const neg=neglectMode;
    for(let i=0;i<diseases.length;i++){
      const d=diseases[i],ppd=d.mortality>0?d.papers/d.mortality:0;
      const c=new THREE.Color(neg?neglectColor(ppd):CC[d.category]);
      const catVis=activeCats.has(d.category),searchMatch=!sq||d.label.toLowerCase().includes(sq);
      if(!neg&&!catVis)c.multiplyScalar(0.05);
      else if(connMode){if(hubSet.has(i))c.multiplyScalar(1.3);else c.multiplyScalar(0.4);}
      else if(aIdx>=0){if(i===aIdx)c.multiplyScalar(1.4);else if(nbrs&&nbrs.has(i)){}else c.multiplyScalar(0.25);}
      else if(sq&&!searchMatch)c.multiplyScalar(0.15);
      iMesh.setColorAt(i,c);
      // Glow brightness + recolor
      if(glows&&glows[i]){
        if(neg)glows[i].material.color.set(neglectColor(ppd));
        else glows[i].material.color.set(CC[d.category]);
        glows[i].material.opacity=((!neg&&!catVis)?0:connMode?(hubSet.has(i)?0.55:0.08):aIdx>=0?(i===aIdx||nbrs?.has(i)?0.5:0.05):0.35);
      }
      if(!neg&&!catVis){const m=new THREE.Matrix4();iMesh.getMatrixAt(i,m);const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);s.set(0.001,0.001,0.001);m.compose(p,q,s);iMesh.setMatrixAt(i,m);}
    }
    iMesh.instanceColor.needsUpdate=true;iMesh.instanceMatrix.needsUpdate=true;

    // Edges: invisible at rest, neighborhood on hover/select, all visible in connections mode
    const ca=eMesh.geometry.getAttribute('color').array;
    const hasActive=aIdx>=0;
    for(let i=0;i<displayEdges.length;i++){const e=displayEdges[i],o=i*6;
      const sv=activeCats.has(diseases[e.si].category),tv=activeCats.has(diseases[e.ti].category);
      let v=0;
      if(connMode&&sv&&tv){
        // In connections mode: hub edges brighter, others dimmer
        const isHub=hubSet.has(e.si)||hubSet.has(e.ti);
        v=isHub?1.0:0.3;
      }else{
        const isNb=hasActive&&(e.si===aIdx||e.ti===aIdx);
        v=(isNb&&sv&&tv)?1.0:0.0;
      }
      ca[o]=v;ca[o+1]=v;ca[o+2]=v;ca[o+3]=v;ca[o+4]=v;ca[o+5]=v;}
    eMesh.geometry.getAttribute('color').needsUpdate=true;
    eMesh.material.opacity=(connMode||hasActive)?0.55:0;
    });return()=>cancelAnimationFrame(raf);
  },[hoveredNode,selectedNode,activeCats,searchQuery,sizeMode,connectionsActive,connData,connFocusActive,neglectMode]);

  return(
    <div ref={containerRef} style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',cursor,touchAction:'none'}}>
      <Header diseaseCount={diseasesData.length} edgeCount={connectionsData.length} searchQuery={searchQuery} onSearchChange={setSearchQuery} sizeMode={sizeMode} onSizeToggle={handleSize} sizeToggleRef={sizeToggleRef} onExplode={handleExplode} onConnections={handleConnections} onVelocity={handleVelocity} neglectMode={neglectMode} onNeglect={handleNeglect} spotlightActive={spotlightActive} onSpotlight={handleSpotlight} searchDropdown={searchQuery&&dataRef.current?<SearchDropdown query={searchQuery} diseases={dataRef.current.diseases} onSelect={handleSearchSel}/>:null}/>
      <FilterBar activeCategories={activeCats} onToggle={toggleCat} neglectMode={neglectMode}/>
      <Legend sizeMode={sizeMode}/>
      {hoveredNode&&(isMob()||!selectedNode||hoveredNode.index!==selectedNode.index)&&(<Tooltip disease={hoveredNode.disease} connCount={dataRef.current?.connCounts.get(hoveredNode.index)||0} x={tipPos.x} y={tipPos.y}/>)}
      {selectedNode&&dataRef.current&&!isMob()&&(<Sidebar disease={selectedNode.disease} data={dataRef.current} onSelect={selectDisease} onClose={connFocusRef.current>=0?(()=>{setSelectedNode(null);}):deselect}/>)}
      {storyTip&&(<Tooltip disease={storyTip.disease} connCount={storyTip.connCount} x={storyTip.x} y={storyTip.y}/>)}
      <div ref={labelsRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:30,overflow:'hidden'}}>
        {diseasesData.map((d,i)=>(<div key={d.id} className="node-lbl" style={{position:'absolute',transform:'translateX(-50%)',fontFamily:'IBM Plex Mono,monospace',fontSize:isMob()?7:9,color:neglectMode?neglectColor(d.mortality>0?d.papers/d.mortality:0):CC[d.category],textAlign:'center',whiteSpace:'nowrap',textShadow:'0 0 4px rgba(0,0,0,0.8),0 1px 2px rgba(0,0,0,0.9)'}}><span className="lbl-name">{d.label}</span>{!isMob()&&<span className="lbl-detail" style={{display:'none',color:'#94a3b8',fontSize:8}}><br/>{fmt(d.papers)} papers</span>}</div>))}
      </div>
      <style>{`.node-lbl{transition:opacity 0.15s}.lbl-hover .lbl-name{font-size:11px!important;font-weight:600;color:#e2e8f0!important}.lbl-hover .lbl-detail{display:inline!important}`}</style>
      <StoryChips onChip={handleStory} onRandomPick={handleRandomPick} visible={storyVisible}/>
      {storyCaption&&<StoryCaption text={storyCaption} onClick={advanceStory}/>}
      {spotlightActive&&<SpotlightCaption text={spotlightCaption}/>}
      <RandomPickCaption data={randomPickCaption} onDismiss={stopRandomPick}/>
      {explodeActive&&<ExplodeOverlay data={ppdData} onClose={handleUnexplode}/>}
      {connectionsActive&&<ConnectionsOverlay data={connData} onClose={handleCloseConnections} onSelect={handleConnSelect}/>}
      {velocityActive&&<VelocityOverlay data={velocityData} onClose={handleCloseVelocity}/>}
    </div>
  );
}
