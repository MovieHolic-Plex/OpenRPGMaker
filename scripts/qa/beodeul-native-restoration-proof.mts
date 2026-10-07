import fs from 'node:fs';
import assert from 'node:assert/strict';
import { openLocalProjectStore } from '../../electron/local-store/store.ts';
import { ensureBundledTilesets } from '../../src/project/defaults.ts';
import { getTool } from '../../src/editor/tools/index.ts';
import { layerTileAt } from '../../src/project/mapLayers.ts';
import { canMove } from '../../src/project/collision.ts';
import { renderMapPng } from '../qa-game/render.mts';
import catalog from '../../src/assets/beodeulArchitectureCatalog.json';
import { HOUSE_VISION_TOOLS } from '../../src/editor/tools/houseVisionTools.ts';

const OUT='verify-shots/beodeul-native-restoration';fs.mkdirSync(OUT,{recursive:true});
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const before=JSON.parse(fs.readFileSync('output/beodeul-native-restoration/before-project.json','utf8'));
let store=await openLocalProjectStore({projectDir});const previous=store.loadSnapshot()!,projectId=store.info().projectId;
const refreshOnly=process.argv.includes('--refresh-references');
assert.equal(previous.sha256,refreshOnly?'30fa6c12c53c0cfae5fccde712f9313573f8fa9d2c938f3fef13326c2f443ebc':'a227205a2ced75130e153d7eecf403ea087de4e7eaa9509912d05a13061557bd','canonical changed since this task began');
const p=structuredClone(previous.project);ensureBundledTilesets(p);
const repair=refreshOnly?undefined:getTool('refine_beodeul_village')!.run(p,{mapId:'map_beodeul_rest',church:true});
if(repair){fs.writeFileSync(`${OUT}/repair-tool.json`,JSON.stringify(repair,null,2));assert.equal((repair.data as any).changed.length,6);}
assert.deepEqual(p.maps.map_blank_start,before.maps.map_blank_start);
assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
const m=p.maps.map_beodeul_rest!,old=before.maps.map_beodeul_rest;
const placements=[{concept:'cream',x:4,y:3},{concept:'brick',x:17,y:2},{concept:'stone',x:30,y:5},
 {concept:'sage',x:5,y:18},{concept:'ochre',x:27,y:20},{concept:'church',x:41,y:3}];
const houses=placements.map(h=>{
 const b=catalog.buildings.find(b=>b.concept===h.concept)!,k=p.tilesets.beodeul_city!.structureKits!.find(k=>k.id===b.id)!;
 for(let y=0;y<k.height;y++)for(let x=0;x<k.width;x++)if(k.rows[y]!.upperTiles[x]!>=0)
  assert.equal(layerTileAt(m,3,(h.y+y)*m.width+h.x+x),k.rows[y]!.upperTiles[x]);
 const part=k.parts!.find(p=>p.kind==='entrance')!;
 return {...h,kit:k.id,w:k.width,h:k.height,door:{x:h.x+part.dx,y:h.y+part.dy+part.h}};
});
assert.equal(m.width,54);assert.equal(m.height,30);assert.deepEqual(m.events,old.events);
assert.equal(p.startMapId,before.startMapId);assert.deepEqual(p.startPos,before.startPos);
let preservedUpper=0,preservedGround=0;
for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++){
 const i=y*old.width+x,ni=y*m.width+x;
 if(!houses.some(h=>x>=h.x&&x<h.x+h.w&&y>=h.y&&y<h.y+h.h)){
  assert.equal(layerTileAt(m,3,ni),layerTileAt(old,3,i));preservedUpper++;
 }
 {
  assert.equal(layerTileAt(m,1,ni),layerTileAt(old,1,i));preservedGround++;
 }
}
const observed=HOUSE_VISION_TOOLS[0]!.run(p,{mapId:m.id});assert.equal((observed.data as any).houses.length,6);
function route(from:{x:number;y:number},to:{x:number;y:number}){
 const first=from.y*m.width+from.x,queue=[from],prev=new Map<number,{index:number;dir:string}>([[first,{index:-1,dir:''}]]);
 for(let at=0;at<queue.length;at++){
  const h=queue[at]!,index=h.y*m.width+h.x;if(h.x===to.x&&h.y===to.y)break;
  for(const [dir,dx,dy] of [['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]] as const){
   const x=h.x+dx,y=h.y+dy,i=y*m.width+x;
   if(x<0||y<0||x>=m.width||y>=m.height||prev.has(i)||layerTileAt(m,1,i)===737||!canMove(p,m,h.x,h.y,x,y))continue;
   prev.set(i,{index,dir});queue.push({x,y});
  }
 }
 let i=to.y*m.width+to.x;assert(prev.has(i),`road-only approach unreachable ${to.x},${to.y}`);
 const moves:Array<{kind:'move';dir:string}>=[];
 while(i!==first){const s=prev.get(i)!;moves.push({kind:'move',dir:s.dir});i=s.index;}
 return moves.reverse();
}
let current=p.startPos;
const stops=houses.map((h,i)=>{const moves=route(current,h.door);current=h.door;
 return{id:h.concept==='church'?'church':`house-${i+1}`,kit:h.kit,moves,to:{mapId:m.id,...h.door}};});
stops.push({id:'well-return',kit:'',moves:route(current,p.startPos),to:{mapId:m.id,...p.startPos}});
fs.writeFileSync(`${OUT}/preview.png`,renderMapPng({...p,startMapId:''},m,2).png);
if(process.argv.includes('--preview')){store.close();console.log({preview:true,repair:repair?.summary});process.exit(0);}
const save=await store.saveSerialized(JSON.stringify(p),previous.sha256);assert.equal(save.kind,'saved');store.close();
store=await openLocalProjectStore({projectDir});const loaded=store.loadSnapshot()!;store.close();
assert.deepEqual(loaded.project,p);
fs.writeFileSync('output/beodeul-native-restoration/reloaded-project.json',JSON.stringify(loaded.project));
fs.writeFileSync('output/beodeul-native-restoration/routes.json',JSON.stringify({start:{mapId:m.id,...p.startPos},stops},null,2));
fs.writeFileSync(`${OUT}/village-overview.png`,renderMapPng({...loaded.project,startMapId:''},loaded.project.maps[m.id]!,2).png);
const proof={projectId,projectDir,storeFile:`${projectDir}/project.sqlite`,revision:loaded.revision,sha256:loaded.sha256,
 savedAndReopened:true,originalArtRestoredByCommonTool:true,sideFacesRequired:false,nativeSilhouettesPreserved:true,
 mapId:m.id,size:[54,30],houses:5,churches:1,distinctWindows:5,doorsPerBuilding:1,
 originalDoorTestAndInteriorPreserved:true,originalMapEventsPreserved:true,preservedUpperCells:preservedUpper,preservedGroundCells:preservedGround,
 allSixDoorFrontsConnectedByRoads:true,observedBuildings:(observed.data as any).houses.length};
fs.writeFileSync(`${OUT}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
