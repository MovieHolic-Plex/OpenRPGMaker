import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { isPassable } from "@/project/collision";
const p: any = deserialize(readFileSync("qa-runs/poke-fix-p/hm1.json", "utf8"));
const m=p.maps.mx_map_meadow;
for (let y=16;y<=30;y++){ let row=""; for(let x=0;x<m.width;x++){ const ev=m.events.find((e:any)=>e.x===x&&e.y===y); row += ev ? (ev.id.includes("hm")?"T":"E") : isPassable(p,m,x,y)?".":"#"; } console.log(String(y).padStart(2),row); }
for (const e of m.events) console.log(e.id,e.x,e.y,e.pages?.[0]?.trigger?.kind, e.pages?.[0]?.priority, e.pages?.[0]?.overlapForbidden, !!e.pages?.[0]?.detectionEncounter);
import { canMove } from "@/project/collision";
const occ = new Set(m.events.filter((e:any)=>e.id!=="ev_hm_tree_1" && (e.pages?.[0]?.priority==="same")).map((e:any)=>e.x+","+e.y));
const q=[{x:10,y:27}], seen=new Set(["10,27"]); let hit=false;
for (let i=0;i<q.length;i++){ const c=q[i]!; if (Math.abs(c.x-11)+Math.abs(c.y-16)===1) {hit=true;console.log("goal",c);break;} for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=c.x+dx!,ny=c.y+dy!,k=nx+","+ny; if(seen.has(k)||occ.has(k)||!canMove(p,m,c.x,c.y,nx,ny))continue; seen.add(k); q.push({x:nx,y:ny}); } }
console.log("reach tree-adjacent", hit, seen.size);
for (let y=15;y<=30;y++){ let row=""; for(let x=0;x<m.width;x++) row += seen.has(x+","+y)?"o":occ.has(x+","+y)?"E":isPassable(p,m,x,y)?"-":"#"; console.log(String(y).padStart(2),row); }
console.log(JSON.stringify([[11,25],[11,24]].map(([x,y])=>[x,y,isPassable(p,m,x!,y!),canMove(p,m,x!,y!,x!,y!-1)])));
console.log("18->17 x=11", canMove(p,m,11,18,11,17), "x=14", canMove(p,m,14,18,14,17), "lower17", m.lowerTiles[17*m.width+11], m.lowerTiles[17*m.width+14], "upper17", m.upperTiles[17*m.width+11], m.upperTiles[17*m.width+14], "lower16", m.lowerTiles[16*m.width+11], "upper16", m.upperTiles[16*m.width+11]);
