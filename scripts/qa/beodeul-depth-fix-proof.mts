import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {ensureBundledTilesets} from '../../src/project/defaults.ts';
import {refineBeodeulVegetation} from '../../src/editor/tools/beodeulVegetationTools.ts';
import {layerTileAt} from '../../src/project/mapLayers.ts';
import {COURTYARD_HOUSES} from '../../src/editor/tools/beodeulCourtyardTools.ts';
import {canMove} from '../../src/project/collision.ts';
import {isPassable} from '../../src/project/collision.ts';
import catalog from '../../src/assets/beodeulGroundCatalog.json';
import {renderMapPng} from '../qa-game/render.mts';
const dir='verify-shots/beodeul-depth-fix',out='output/beodeul-depth-fix',projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
let s=await openLocalProjectStore({projectDir});const previous=s.loadSnapshot()!;assert.equal(previous.sha256,'a93675c2ffdb34eb3f7145740ccf7d3c9efdac625d3b1154574aa415b4a18445');s.close();
const before=previous.project,p=structuredClone(before);ensureBundledTilesets(p);const m=p.maps.map_beodeul_rest!,old=before.maps[m.id]!;
const result=refineBeodeulVegetation(p,m.id);
for(const placement of result.data.placements!){const r=catalog.recipes.find(r=>r.id===placement.recipe)!;if('blockingCells' in r)for(const [x,y] of r.blockingCells)assert(!isPassable(p,m,placement.x+x!,placement.y+y!));}
assert.deepEqual(m.lowerTiles,old.lowerTiles);assert.deepEqual(m.events,old.events);assert.deepEqual(p.startPos,before.startPos);
assert.deepEqual(p.maps.map_blank_start,before.maps.map_blank_start);assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
for(const h of COURTYARD_HOUSES){const k=p.tilesets.beodeul_city!.structureKits!.find(k=>k.id===h.kit)!;for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy]!.upperTiles[dx]!>=0)assert.equal(layerTileAt(m,3,(h.y+dy)*m.width+h.x+dx),layerTileAt(old,3,(h.y+dy)*m.width+h.x+dx));}
const snapshot=JSON.stringify(p),repeat=refineBeodeulVegetation(p,m.id);assert.equal(JSON.stringify(p),snapshot);assert(repeat.data.alreadyApplied);
const pathsSource=new Set(catalog.recipes.filter(r=>'hamlet'in r&&r.hamlet&&'kind'in r&&['soil','stone','steps'].includes(String(r.kind))).flatMap(r=>r.rows.flat()));
const pathTarget=new Set(p.tilesets.beodeul_city!.tileGrafts?.filter(g=>g.sourceChipset==='tex_beodeul_ground'&&pathsSource.has(g.sourceTile)).map(g=>g.targetTile));
const onPath=(x:number,y:number)=>x>=0&&y>=0&&x<m.width&&y<m.height&&pathTarget.has(layerTileAt(m,1,y*m.width+x));
function route(from:{x:number;y:number},to:{x:number;y:number}){const q=[from],seen=new Set([`${from.x},${from.y}`]),prev=new Map<string,{parent:{x:number;y:number};dir:string}>();for(let head=0;head<q.length;head++){const a=q[head]!;if(a.x===to.x&&a.y===to.y)break;for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){const b={x:a.x+dx,y:a.y+dy},key=`${b.x},${b.y}`;if(seen.has(key)||!onPath(b.x,b.y)||!canMove(p,m,a.x,a.y,b.x,b.y))continue;seen.add(key);prev.set(key,{parent:a,dir});q.push(b);}}assert(seen.has(`${to.x},${to.y}`));const moves=[];let b=to;while(b.x!==from.x||b.y!==from.y){const a=prev.get(`${b.x},${b.y}`)!;moves.unshift({kind:'move',dir:a.dir});b=a.parent;}return moves;}
let current=p.startPos;const stops=[];for(const [n,front] of [...result.data.fronts!,{kit:'',...p.startPos}].entries()){const to={mapId:m.id,x:front.x,y:front.y};stops.push({id:n<5?`house-${n+1}`:n===5?'church':'well-return',kit:front.kit,moves:route(current,to),to});current=to;}
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start:{mapId:m.id,...p.startPos},stops},null,2));
fs.writeFileSync(`${dir}/preview.png`,renderMapPng({...p,startMapId:''},m,2).png);
fs.writeFileSync(`${dir}/tool-result.json`,JSON.stringify(result,null,2));
if(!process.argv.includes('--save')){console.log({preview:true,groves:result.data.groves,removedTrees:result.data.removedTrees});process.exit(0);}
for(const project of [p])for(const id of ['beodeul_city','beodeul_ground']){
 const ref=project.tilesets[id]!.referenceDocuments!.find(c=>c.id==='beodeul-ground-dressing')!;
 assert(ref.documents.some(d=>d.id==='bd-ground-woodland'));
 assert(ref.documents.every(d=>d.markdown.length<=120000));
 assert(ref.images.some(i=>i.id==='bd-ground-woodland-error'));
}
s=await openLocalProjectStore({projectDir});const saved=await s.saveSerialized(JSON.stringify(p),previous.sha256);assert.equal(saved.kind,'saved');s.close();
s=await openLocalProjectStore({projectDir});const loaded=s.loadSnapshot()!;assert.deepEqual(loaded.project,p);
const proof={projectId:s.projectId,projectDir,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,allBuildingsAtSameCoordinates:true,lowerGroundAndOriginalDoorTrialPreserved:true,repeatIsNoOp:true,...result.data};s.close();
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(p));fs.writeFileSync(`${dir}/village-overview.png`,renderMapPng({...p,startMapId:''},m,2).png);fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));
console.log(JSON.stringify({projectId:proof.projectId,revision:proof.revision,sha256:proof.sha256,groves:proof.groves,savedAndReopened:true}));
