import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {ensureBundledTilesets,createBlankProject} from '../../src/project/defaults.ts';
import {harmonizeBeodeulDaylight} from '../../src/editor/tools/beodeulLightTools.ts';
import {getTool} from '../../src/editor/tools/index.ts';
import {cellPassability} from '../../src/project/collision.ts';
import {layerTileAt} from '../../src/project/mapLayers.ts';
import {renderMapPng} from '../qa-game/render.mts';
const dir='verify-shots/beodeul-light-ground',out='output/beodeul-light-ground';fs.mkdirSync(dir,{recursive:true});
const info=JSON.parse(fs.readFileSync(`${out}/before-info.json`,'utf8')),before=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8'));
let s=await openLocalProjectStore({projectDir:info.projectDir});const previous=s.loadSnapshot()!;assert.equal(previous.sha256,info.sha256);s.close();
const p=structuredClone(previous.project);ensureBundledTilesets(p);const m=p.maps.map_beodeul_rest!,old=before.maps[m.id];
const shadow=structuredClone(p);harmonizeBeodeulDaylight(shadow,m.id,{roads:false,meadow:false});
fs.writeFileSync(`${dir}/shadow-only.png`,renderMapPng({...shadow,startMapId:''},shadow.maps[m.id]!,2).png);
const result=getTool('harmonize_beodeul_daylight')!.run(p,{mapId:m.id});fs.writeFileSync(`${dir}/tool-result.json`,JSON.stringify(result,null,2));
assert.deepEqual(m.upperTiles,old.upperTiles);assert.deepEqual(m.upperOverlayTiles,old.upperOverlayTiles);assert.deepEqual(m.events,old.events);
assert.deepEqual(p.maps.map_blank_start,before.maps.map_blank_start);assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
assert.deepEqual(p.startPos,before.startPos);assert.equal(p.startMapId,before.startMapId);assert.equal(m.width,old.width);assert.equal(m.height,old.height);
for(let i=0;i<m.width*m.height;i++){
 assert.deepEqual(cellPassability(p.tilesets[m.tilesetId]!,m,i),cellPassability(before.tilesets[m.tilesetId],old,i),`collision changed ${i}`);
 if(layerTileAt(old,2,i)>=0)assert.equal(layerTileAt(m,2,i),layerTileAt(old,2,i),`existing layer-2 art changed ${i}`);
}
const snapshot=JSON.stringify(p);const repeat=getTool('harmonize_beodeul_daylight')!.run(p,{mapId:m.id});assert.equal(JSON.stringify(p),snapshot);assert.equal((repeat.data as any).alreadyApplied,true);
assert((result.data as any).shadowCells>0);assert((result.data as any).roadCells>0);assert((result.data as any).meadowCells>0);
const fresh=createBlankProject();assert.equal(fresh.tilesets.beodeul_ground!.count,p.tilesets.beodeul_ground!.count);
fs.writeFileSync(`${dir}/preview.png`,renderMapPng({...p,startMapId:''},m,2).png);
fs.writeFileSync(`${dir}/before.png`,renderMapPng({...before,startMapId:''},old,2).png);
if(!process.argv.includes('--save')){console.log({preview:true,...result.data});process.exit(0);}
s=await openLocalProjectStore({projectDir:info.projectDir});const saved=await s.saveSerialized(JSON.stringify(p),previous.sha256);assert.equal(saved.kind,'saved');s.close();
s=await openLocalProjectStore({projectDir:info.projectDir});const loaded=s.loadSnapshot()!;s.close();assert.deepEqual(loaded.project,p);
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(loaded.project));fs.writeFileSync(`${dir}/village-overview.png`,renderMapPng({...loaded.project,startMapId:''},loaded.project.maps[m.id]!,2).png);
const proof={projectId:info.projectId,projectDir:info.projectDir,storeFile:`${info.projectDir}/project.sqlite`,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,originalBuildingPixelsAndPositionsPreserved:true,allOriginalUpperLayersPreserved:true,originalTwoDemoMapsPreserved:true,eventsAndStartPreserved:true,all1620CollisionCellsUnchanged:true,originalLayer2ArtPreserved:true,repeatIsNoOp:true,commonSourceAvailableInFreshAndExistingProjects:true,...result.data};
fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
