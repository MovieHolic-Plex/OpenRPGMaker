import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { canMove } from "@/project/collision";
const p:any = deserialize(readFileSync("qa-runs/poke-fix-p/g8.json","utf8"));
const m=structuredClone(p.maps.mx_map_moon_gym);
(function applyDevice(){ const walk=(v:any)=>{ if(Array.isArray(v)) v.forEach(walk); else if(v&&typeof v==="object"){ if(v.kind==="changeTile"&&v.mapId===m.id){ (v.layer==="upper"?m.upperTiles:m.lowerTiles)[v.y*m.width+v.x]=v.tile; } Object.values(v).forEach(walk);} }; walk(m.events.filter((e:any)=>/device/.test(e.id))); })();
const entry={x:8,y:16};
function reach(skip:Set<string>){ const solid=new Set(m.events.filter((e:any)=>e.pages?.[0]?.overlapForbidden && !skip.has(e.id)).map((e:any)=>e.x+","+e.y));
  const q=[entry],seen=new Set([entry.x+","+entry.y]); for(let n=0;n<q.length;n++){const c=q[n]; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=c.x+dx,y=c.y+dy,k=x+","+y; if(!seen.has(k)&&!solid.has(k)&&canMove(p,m,c.x,c.y,x,y)){seen.add(k);q.push({x,y});}}} return seen; }
const leader={x:8,y:3};
const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>(leader.x+dx)+","+(leader.y+dy));
const all=reach(new Set()); console.log("with all: leader neighbours reachable:", nb.filter(k=>all.has(k)), "cells", all.size);
for (const e of m.events.filter((e:any)=>/grunt/.test(e.id))) { const r=reach(new Set([e.id])); console.log("without",e.id,"->",nb.filter(k=>r.has(k)).length,"cells",r.size); }
const none=reach(new Set(m.events.filter((e:any)=>/grunt/.test(e.id)).map((e:any)=>e.id))); console.log("no grunts: neighbours",nb.filter(k=>none.has(k)),"cells",none.size);
