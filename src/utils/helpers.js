import { MN, MX, MAX_PAPERS, MAX_MORT } from './constants';

export function nR(p){return MN+Math.pow(Math.min(p,MAX_PAPERS)/MAX_PAPERS,0.6)*(MX-MN);}
export function nRM(m){if(m<=0)return MN*0.2;return MN+Math.pow(Math.min(m,MAX_MORT)/MAX_MORT,0.6)*(MX-MN);}
export function fmt(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=10000)return Math.round(n/1000)+'K';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}
export function isMob(){return typeof window!=='undefined'&&(matchMedia('(pointer:coarse)').matches||window.innerWidth<768);}

export function neglectColor(ppd){
  // ppd: papers per death. High = well-researched (green), low = neglected (red)
  if(ppd<=0)return'#22c55e'; // no mortality data → treat as well-researched
  const t=Math.max(0,Math.min(1,(Math.log10(ppd)+2)/3.5)); // -2..1.5 → 0..1
  // Red → Orange → Yellow → Green
  const stops=[[239,68,68],[245,158,11],[234,179,8],[34,197,94]];
  const s=t*(stops.length-1),i=Math.min(Math.floor(s),stops.length-2),f=s-i;
  const a=stops[i],b=stops[i+1];
  return`rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}

export function processData(diseases, connections) {
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
