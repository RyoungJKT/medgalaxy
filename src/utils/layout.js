import * as d3 from 'd3';
import { nR } from './helpers';

export function computeLayouts(diseases, layoutEdges) {
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
