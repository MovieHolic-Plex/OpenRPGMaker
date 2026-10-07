import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {canMove,cellPassability} from '../../src/project/collision.ts';
import {layerTileAt} from '../../src/project/mapLayers.ts';
import {renderMapPng} from '../qa-game/render.mts';
const OUT='verify-shots/beodeul-small-village';fs.mkdirSync(OUT,{recursive:true});
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const before=JSON.parse(fs.readFileSync('output/beodeul-small-village/before-project.json','utf8'));
let s=await openLocalProjectStore({projectDir});const first=s.loadSnapshot()!,info=s.info();s.close();
s=await openLocalProjectStore({projectDir});const last=s.loadSnapshot()!;s.close();
assert.equal(first.sha256,last.sha256);assert.deepEqual(first.project,last.project);
const p=last.project,m=p.maps[p.startMapId]!,old=p.maps.map_blank_start!,b=before.maps.map_blank_start;
assert.equal(m.name,'버들쉼터');assert.equal(m.width,40);assert.equal(m.height,30);
assert.deepEqual(old.lowerTiles,b.lowerTiles);assert.deepEqual(old.upperTiles,b.upperTiles);assert.deepEqual(old.events,b.events);
assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
for(let i=0;i<old.width*old.height;i++){
 for(const l of [2,4] as const)if(layerTileAt(b,l,i)>=0)assert.equal(layerTileAt(old,l,i),layerTileAt(b,l,i));
 assert.deepEqual(cellPassability(p.tilesets[old.tilesetId]!,old,i),cellPassability(before.tilesets[b.tilesetId],b,i));
}
const grafts=new Map(p.tilesets.beodeul_city!.tileGrafts?.map(g=>[g.targetTile,g]));
for(const [x,y] of [[4,5],[5,12]])assert.equal(grafts.get(layerTileAt(old,4,y!*20+x!))?.sourceTile,41);
const houses=[{kit:'bd-house-h101_0',x:4,y:3,door:{x:6,y:9}},
 {kit:'bd-house-h104_0',x:17,y:2,door:{x:19,y:10}},
 {kit:'bd-house-h112_0',x:30,y:5,door:{x:32,y:11}},
 {kit:'bd-house-h109_1',x:5,y:18,door:{x:6,y:26}},
 {kit:'bd-house-h107_0',x:27,y:20,door:{x:30,y:26}}];
for(const h of houses){
 const k=p.tilesets.beodeul_city!.structureKits!.find(k=>k.id===h.kit)!;
 for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){
  const n=k.rows[dy]!.upperTiles[dx]!;if(n>=0)assert.equal(layerTileAt(m,3,(h.y+dy)*m.width+h.x+dx),n,`house changed ${h.kit} ${dx},${dy}`);
 }
}
function route(from:{x:number;y:number},to:{x:number;y:number},roadsOnly=false){
 const queue=[from],previous=new Map<number,{index:number;dir:string}>();
 const start=from.y*m.width+from.x;previous.set(start,{index:-1,dir:''});
 for(let at=0;at<queue.length;at++){
  const here=queue[at]!,i=here.y*m.width+here.x;if(here.x===to.x&&here.y===to.y)break;
  for(const [dir,dx,dy] of [['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]] as const){
   const x=here.x+dx,y=here.y+dy,ni=y*m.width+x;
   if(x<0||y<0||x>=m.width||y>=m.height||previous.has(ni)||!canMove(p,m,here.x,here.y,x,y))continue;
   if(roadsOnly&&layerTileAt(m,1,ni)===737)continue;
   previous.set(ni,{index:i,dir});queue.push({x,y});
  }
 }
 let idx=to.y*m.width+to.x;assert(previous.has(idx),`unreachable ${to.x},${to.y}, roadsOnly=${roadsOnly}`);
 const moves:Array<{kind:'move';dir:string}>=[];
 while(idx!==start){const step=previous.get(idx)!;moves.push({kind:'move',dir:step.dir});idx=step.index;}
 return moves.reverse();
}
let current=p.startPos;
const stops=houses.map((h,i)=>{const moves=route(current,h.door,true);current=h.door;return{id:`house-${i+1}`,kit:h.kit,moves,to:{mapId:m.id,...h.door}};});
const back=route(current,p.startPos,true);stops.push({id:'well-return',kit:'',moves:back,to:{mapId:m.id,...p.startPos}});
fs.writeFileSync('output/beodeul-small-village/reloaded-project.json',JSON.stringify(p));
fs.writeFileSync('output/beodeul-small-village/routes.json',JSON.stringify({mapId:m.id,start:{mapId:m.id,...p.startPos},stops},null,2));
fs.writeFileSync(`${OUT}/village-overview.png`,renderMapPng({...p,startMapId:''},m,2).png);
fs.writeFileSync(`${OUT}/old-trees-fixed.png`,renderMapPng({...p,startMapId:''},old,3).png);
const proof={projectId:info.projectId,projectDir,storeFile:`${projectDir}/project.sqlite`,revision:last.revision,sha256:last.sha256,
 reopenedIdentically:true,mapId:m.id,mapName:m.name,size:[m.width,m.height],houses:5,distinctHouseKits:5,
 originalTwoMapsPreserved:true,oldTwoTreeConnectionsFixed:true,originalOverlayCellsAndPassabilityPreserved:true,
 fiveDoorsConnectedByRoads:true,startMapId:p.startMapId,startPos:p.startPos};
fs.writeFileSync(`${OUT}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
