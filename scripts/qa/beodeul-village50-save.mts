import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {beodeulGroundReferences} from '../../src/project/defaults/beodeulGround.ts';
import {canMove} from '../../src/project/collision.ts';
import {createBeodeulWarmTreesTileset} from '../../src/project/defaults/beodeulWarmTrees.ts';
const out='output/beodeul-village50';
const p=JSON.parse(fs.readFileSync(`${out}/preview-project.json`,'utf8'));
p.tilesets.beodeul_warm_trees=createBeodeulWarmTreesTileset();
const result=JSON.parse(fs.readFileSync(`${out}/build-result.json`,'utf8'));
const before=JSON.parse(fs.readFileSync(`${out}/before-store.json`,'utf8'));
for(const [id,m] of Object.entries(JSON.parse(fs.readFileSync(`${out}/before-maps.json`,'utf8'))))assert.deepEqual(p.maps[id],m);
for(const id of ['beodeul_city','beodeul_ground']){
 const ts=p.tilesets[id],cats=structuredClone(ts.referenceDocuments??[]);
 for(const shipped of beodeulGroundReferences()){
  const at=cats.findIndex(c=>c.id===shipped.id);
  if(at<0)cats.push(shipped);
  else{const old=cats[at];cats[at]={...old,
   documents:[...old.documents.filter(d=>!shipped.documents.some(s=>s.id===d.id)),...shipped.documents],
   images:[...old.images.filter(i=>!shipped.images.some(s=>s.id===i.id)),...shipped.images]};}
 }
 ts.referenceDocuments=cats;
 assert(cats.every(c=>c.documents.every(d=>d.markdown.length<=120000)&&c.images.every(i=>!i.dataUrl.startsWith('data:'))));
}
const m=p.maps[result.mapId];assert.equal(m.width,50);assert.equal(m.height,50);
const paths=new Set<number>([...result.soilCells,...result.stoneCells]);
for(const b of result.bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)paths.add(y*m.width+x);
function route(from:{x:number;y:number},to:{x:number;y:number}){
 const q=[from],seen=new Set([`${from.x},${from.y}`]),prev=new Map<string,{parent:{x:number;y:number};dir:string}>();
 for(let h=0;h<q.length;h++){
  const a=q[h]!;if(a.x===to.x&&a.y===to.y)break;
  for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){
   const b={x:a.x+dx,y:a.y+dy},key=`${b.x},${b.y}`;
   if(seen.has(key)||b.x<0||b.x>=50||b.y<0||b.y>=50||!paths.has(b.y*50+b.x)||!canMove(p,m,a.x,a.y,b.x,b.y))continue;
   seen.add(key);prev.set(key,{parent:a,dir});q.push(b);
  }
 }
 assert(seen.has(`${to.x},${to.y}`),`No authored road to ${to.x},${to.y}`);
 const moves=[];let b=to;
 while(b.x!==from.x||b.y!==from.y){const a=prev.get(`${b.x},${b.y}`)!;moves.unshift({kind:'move',dir:a.dir});b=a.parent;}
 return moves;
}
for(const front of result.fronts)route(p.startPos,front);
for(const b of result.bridges)for(const x of [b.x-1,b.x+4])route(p.startPos,{x,y:b.y+1});
let current=p.startPos;const stops=[];
for(const [id,x,y] of [['north-bridge-west',22,16],['north-bridge-east',27,16],['manor',33,15],['church',9,44],['south-bridge-east',27,37],['smithy',45,36],['well-return',32,16]] as const){
 const to={mapId:m.id,x,y};stops.push({id,to,moves:route(current,to)});current=to;
}
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start:{mapId:m.id,...p.startPos},stops},null,2));
fs.writeFileSync(`${out}/authored-map.json`,JSON.stringify(m));
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const store=await openLocalProjectStore({projectDir});
const saved=await store.saveSerialized(JSON.stringify(p),before.sha256);assert.equal(saved.kind,'saved');
fs.writeFileSync(`${out}/save-result.json`,JSON.stringify({projectId:store.projectId,projectDir,...saved,all18DoorsAndFourBridgeBanksConnected:true,existingMapsPreserved:true}));
store.close();console.log(JSON.stringify(saved));
