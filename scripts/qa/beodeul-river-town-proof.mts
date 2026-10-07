import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {createBlankProject,ensureBundledTilesets} from '../../src/project/defaults.ts';
import {canMove} from '../../src/project/collision.ts';

const out='output/beodeul-river-town',dir='verify-shots/beodeul-river-town';
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const p=JSON.parse(fs.readFileSync(`${out}/preview-project.json`,'utf8'));
const result=JSON.parse(fs.readFileSync(`${out}/build-result.json`,'utf8'));
ensureBundledTilesets(p);
let store=await openLocalProjectStore({projectDir});
const before=store.loadSnapshot()!;
assert.equal(before.revision,17);
assert.equal(before.sha256,'f549255cd96a6272fab2b01a6d5e74fa764e1cd317ff9364704304a6910a4bf0');
store.close();
for(const [id,m] of Object.entries(before.project.maps))assert.deepEqual(p.maps[id],m);
{const fresh=createBlankProject();
for(const project of [fresh,p])for(const id of ['beodeul_city','beodeul_ground']){
 const refs=project.tilesets[id].referenceDocuments.find(r=>r.id==='beodeul-ground-dressing');
 for(const suffix of ['guide','layer-1','layer-2','layer-3','layer-4','kits','grafts-1'])
  assert(refs.documents.some(d=>d.id===`bd-ground-river-town-${suffix}`));
 assert(refs.documents.every(d=>d.markdown.length<=120000));
 assert(refs.images.some(i=>i.id==='bd-ground-river-town-error'));
 assert(refs.images.every(i=>!i.dataUrl.startsWith('data:')));
}
}
const m=p.maps[result.mapId];
const paths=new Set<number>([...result.soilCells,...result.stoneCells]);
for(const b of result.bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)paths.add(y*m.width+x);
function route(from:{x:number;y:number},to:{x:number;y:number}){
 const q=[from],seen=new Set([`${from.x},${from.y}`]),prev=new Map<string,{parent:{x:number;y:number};dir:string}>();
 for(let h=0;h<q.length;h++){
  const a=q[h]!;if(a.x===to.x&&a.y===to.y)break;
  for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){
   const b={x:a.x+dx,y:a.y+dy},key=`${b.x},${b.y}`;
   if(seen.has(key)||b.x<0||b.x>=m.width||b.y<0||b.y>=m.height||!paths.has(b.y*m.width+b.x)||!canMove(p,m,a.x,a.y,b.x,b.y))continue;
   seen.add(key);prev.set(key,{parent:a,dir});q.push(b);
  }
 }
 assert(seen.has(`${to.x},${to.y}`),`No authored street route to ${to.x},${to.y}`);
 const moves=[];let b=to;
 while(b.x!==from.x||b.y!==from.y){const a=prev.get(`${b.x},${b.y}`)!;moves.unshift({kind:'move',dir:a.dir});b=a.parent;}
 return moves;
}
for(const front of result.fronts)route(p.startPos,front);
for(const b of result.bridges)for(const x of [b.x-1,b.x+4])route(p.startPos,{x,y:b.y+1});
let current=p.startPos;const stops=[];
for(const [id,x,y] of [['north-bridge-west',23,12],['north-bridge-east',28,12],['manor',38,23],['middle-bridge-west',24,25],['church',9,58],['south-bridge-east',41,57],['smithy',70,42],['well-return',42,25]] as const){
 const to={mapId:m.id,x,y};stops.push({id,to,moves:route(current,to)});current=to;
}
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start:{mapId:m.id,...p.startPos},stops},null,2));
store=await openLocalProjectStore({projectDir});
const saved=await store.saveSerialized(JSON.stringify(p),before.sha256);assert.equal(saved.kind,'saved');store.close();
console.log(JSON.stringify({saved:true,revision:saved.revision,sha256:saved.sha256,all41EntrancesAndSixBridgeBanksConnected:true,existingMapsPreserved:true,newAndExistingProjectsHaveSharedReferences:true}));
// Reopen in a separate process to avoid retaining both hydrated 60MB snapshots and save caches.
// Run beodeul-river-town-reload.mts after this save stage.
