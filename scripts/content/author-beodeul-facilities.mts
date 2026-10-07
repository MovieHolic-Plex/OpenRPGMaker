import fs from 'node:fs';import assert from 'node:assert/strict';
import {dressBeodeulVillageFacilities} from './lib/beodeul-facilities-town.mts';
import {renderMapPng} from '../qa-game/render.mts';
import {canMove} from '../../src/project/collision';
const out='output/beodeul-facilities',evidence='verify-shots/beodeul-facilities';
const p=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8'));
const before=structuredClone(p),result=dressBeodeulVillageFacilities(p),m=p.maps[result.mapId];
for(const [id,map] of Object.entries(before.maps))if(id!==m.id)assert.deepEqual(p.maps[id],map);
const plan=JSON.parse(fs.readFileSync('output/beodeul-village50/build-result.json','utf8'));
const paths=new Set<number>([...plan.soilCells,...plan.stoneCells]);
for(const b of plan.bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)paths.add(y*50+x);
for(let y=46;y<=48;y++)for(let x=25;x<=28;x++)paths.add(y*50+x);
function route(from:{x:number;y:number},to:{x:number;y:number},paved=false){
 const allowed=paved?new Set([...plan.stoneCells,...Array.from(paths).filter(i=>i%50>=23&&i%50<=26&&Math.floor(i/50)>=37&&Math.floor(i/50)<=38)]):paths;
 const q=[from],seen=new Set([from.y*50+from.x]),prev=new Map<number,{parent:number;dir:string}>();
 for(let h=0;h<q.length;h++){const a=q[h]!;if(a.x===to.x&&a.y===to.y)break;
  for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){const x=a.x+dx,y=a.y+dy,n=y*50+x;
   if(x<0||x>=50||y<0||y>=50||paved&&y<37||seen.has(n)||!allowed.has(n)||!canMove(p,m,a.x,a.y,x,y))continue;
   seen.add(n);prev.set(n,{parent:a.y*50+a.x,dir});q.push({x,y});}
 }
 let n=to.y*50+to.x;assert(seen.has(n),`Unreachable ${to.x},${to.y}`);
 const moves=[];while(n!==from.y*50+from.x){const a=prev.get(n)!;moves.unshift({kind:'move',dir:a.dir});n=a.parent;}return moves;
}
for(const f of plan.fronts)route(p.startPos,f);
for(const b of plan.bridges)for(const x of [b.x-1,b.x+4])route(p.startPos,{x,y:b.y+1});
route({x:9,y:44},{x:22,y:37},true);
const targets=[...result.roles.map(r=>({id:r.id,...r.front})),{id:'dock',...result.dock},{id:'south-bridge',x:27,y:37},{id:'well-return',...p.startPos}];
let current=p.startPos;const stops=targets.map(t=>{const to={mapId:m.id,x:t.x,y:t.y},moves=route(current,to);current=to;return{id:t.id,to,moves};});
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start:{mapId:m.id,...p.startPos},stops},null,2));
fs.writeFileSync(`${out}/preview-project.json`,JSON.stringify(p));fs.writeFileSync(`${out}/build-result.json`,JSON.stringify(result,null,2));
fs.writeFileSync(`${evidence}/before.png`,renderMapPng({...before,startMapId:''},before.maps[m.id]).png);
fs.writeFileSync(`${evidence}/preview.png`,renderMapPng({...p,startMapId:''},m).png);
console.log(JSON.stringify({...result,all18DoorsAndFourBridgeBanksConnected:true,lowerPavedRoadStillConnected:true}));
