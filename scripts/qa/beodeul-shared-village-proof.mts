import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {ensureBundledTilesets,createBlankProject} from '../../src/project/defaults.ts';
import {composeBeodeulCourtyard,COURTYARD_HOUSES} from '../../src/editor/tools/beodeulCourtyardTools.ts';
import {getTool} from '../../src/editor/tools/index.ts';
import {layerTileAt} from '../../src/project/mapLayers.ts';
import catalog from '../../src/assets/beodeulGroundCatalog.json';
import {canMove} from '../../src/project/collision.ts';
import {renderMapPng} from '../qa-game/render.mts';
const dir='verify-shots/beodeul-shared-village',out='output/beodeul-shared-village';fs.mkdirSync(dir,{recursive:true});
const info=JSON.parse(fs.readFileSync(`${out}/before-info.json`,'utf8')),before=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8'));
let s=await openLocalProjectStore({projectDir:info.projectDir});const previous=s.loadSnapshot()!;assert.equal(previous.sha256,info.sha256);s.close();
const p=structuredClone(previous.project);ensureBundledTilesets(p);const m=p.maps.map_beodeul_rest!,old=before.maps[m.id];
const result=getTool('compose_beodeul_courtyard_village')!.run(p,{mapId:m.id});
assert.deepEqual(m.events,old.events);assert.deepEqual(p.startPos,before.startPos);assert.equal(p.startMapId,before.startMapId);
assert.deepEqual(p.maps.map_blank_start,before.maps.map_blank_start);assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
// All six original building arrays are identical after translation to their new positions.
for(const h of COURTYARD_HOUSES){const k=p.tilesets.beodeul_city!.structureKits!.find(k=>k.id===h.kit)!;
 for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy]!.upperTiles[dx]!>=0)
 assert.equal(layerTileAt(m,3,(h.y+dy)*m.width+h.x+dx),layerTileAt(old,3,(h.oldY+dy)*old.width+h.oldX+dx));
}
const snapshot=JSON.stringify(p);const repeat=composeBeodeulCourtyard(p,m.id);assert.equal(JSON.stringify(p),snapshot);assert(repeat.data.alreadyApplied);
assert.equal(createBlankProject().tilesets.beodeul_ground!.count,p.tilesets.beodeul_ground!.count);
for(const project of [p,createBlankProject()])for(const id of ['beodeul_city','beodeul_ground']){
 const refs=project.tilesets[id]!.referenceDocuments!.find(c=>c.id==='beodeul-ground-dressing')!;
 assert(refs.documents.some(d=>d.id==='bd-ground-courtyard-guide'));
 assert(refs.documents.some(d=>d.id==='bd-ground-courtyard-example'));
 assert(refs.documents.some(d=>d.id==='bd-ground-courtyard-grafts'));
 assert(refs.documents.every(d=>d.markdown.length<=120000));
 assert(refs.images.some(i=>i.id==='bd-ground-courtyard-image'&&i.dataUrl==='/assets/beodeul-ground/courtyard-native.png'));
}
assert.equal((result.data as any).support.detectedHouses,6);
assert.equal((result.data as any).support.placements.filter((p:any)=>p.recipe.startsWith('bdg-foundation')).length,6);
const pathsSource=new Set(catalog.recipes.filter(r=>'hamlet' in r&&r.hamlet&&'kind' in r&&['soil','stone','steps'].includes(String(r.kind))).flatMap(r=>r.rows.flat()));
const pathTarget=new Set(p.tilesets.beodeul_city!.tileGrafts?.filter(g=>g.sourceChipset==='tex_beodeul_ground'&&pathsSource.has(g.sourceTile)).map(g=>g.targetTile));
const onPath=(x:number,y:number)=>{const n=layerTileAt(m,1,y*m.width+x);return pathTarget.has(n)||n===1509;};
function route(from:{x:number,y:number},to:{x:number,y:number}){
 const q=[from],seen=new Set([`${from.x},${from.y}`]),prev=new Map<string,{parent:{x:number,y:number};dir:string}>();
 for(let head=0;head<q.length;head++){const a=q[head]!;if(a.x===to.x&&a.y===to.y)break;for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){const b={x:a.x+dx,y:a.y+dy},key=`${b.x},${b.y}`;if(seen.has(key)||!onPath(b.x,b.y)||!canMove(p,m,a.x,a.y,b.x,b.y))continue;seen.add(key);prev.set(key,{parent:a,dir});q.push(b);}}
 assert(seen.has(`${to.x},${to.y}`));const moves=[];let b=to;while(b.x!==from.x||b.y!==from.y){const a=prev.get(`${b.x},${b.y}`)!;moves.unshift({kind:'move',dir:a.dir});b=a.parent;}return moves;
}
const start={mapId:m.id,...p.startPos};let current=p.startPos;const stops=[];
for(const [n,front] of [...(result.data as any).fronts,{kit:'',...p.startPos}].entries()){
 const to={mapId:m.id,x:front.x,y:front.y};stops.push({id:n<5?`house-${n+1}`:n===5?'church':'well-return',kit:front.kit,moves:route(current,to),to});current=to;
}
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start,stops},null,2));
fs.writeFileSync(`${dir}/preview.png`,renderMapPng({...p,startMapId:''},m,2).png);
fs.writeFileSync(`${dir}/before.png`,renderMapPng({...before,startMapId:''},old,2).png);
fs.writeFileSync(`${dir}/tool-result.json`,JSON.stringify(result,null,2));
if(!process.argv.includes('--save')){console.log({preview:true,...result.data});process.exit(0);}
s=await openLocalProjectStore({projectDir:info.projectDir});const saved=await s.saveSerialized(JSON.stringify(p),previous.sha256);assert.equal(saved.kind,'saved');s.close();
s=await openLocalProjectStore({projectDir:info.projectDir});const loaded=s.loadSnapshot()!;s.close();assert.deepEqual(loaded.project,p);
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(loaded.project));fs.writeFileSync(`${dir}/village-overview.png`,renderMapPng({...loaded.project,startMapId:''},loaded.project.maps[m.id]!,2).png);
const proof={projectId:s.projectId,projectDir:info.projectDir,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,allSixOriginalBuildingArraysIdenticalAtNewPositions:true,allEventsAndOriginalEntryTrialPreserved:true,repeatIsNoOp:true,commonFreshAndExisting:true,...result.data};
fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
