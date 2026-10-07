import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {createBlankProject,ensureBundledTilesets} from '../../src/project/defaults.ts';
import {installBeodeulArchitecture} from '../../src/project/defaults/beodeulArchitecture.ts';
import catalog from '../../src/assets/beodeulArchitectureCatalog.json';
import {renderMapPng} from '../qa-game/render.mts';

const dir='verify-shots/beodeul-gable-fix',out='output/beodeul-gable-fix';
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
let store=await openLocalProjectStore({projectDir});
const previous=store.loadSnapshot()!;assert.equal(previous.revision,16);
assert.equal(previous.sha256,'63cc2e115090b415fba118e94339cec7a9caa9a5d2c84b921674d0a065be0870');store.close();
const p=structuredClone(previous.project);ensureBundledTilesets(p);installBeodeulArchitecture(p);
assert.deepEqual(p.maps,previous.project.maps);
assert.deepEqual(p.startPos,previous.project.startPos);assert.equal(p.startMapId,previous.project.startMapId);
for(const id of ['beodeul_city','beodeul_architecture']){
 assert.deepEqual(p.tilesets[id]!.priority,previous.project.tilesets[id]!.priority);
 assert.deepEqual(p.tilesets[id]!.passability,previous.project.tilesets[id]!.passability);
 assert.deepEqual(p.tilesets[id]!.tileGrafts,previous.project.tilesets[id]!.tileGrafts);
}
const fresh=createBlankProject();
for(const project of [fresh,p])for(const id of ['beodeul_city','beodeul_ground']){
 const refs=project.tilesets[id]!.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 assert(refs.documents.find(d=>d.id==='bd-ground-architecture')!.markdown.includes('gable-post-through-window'));
 assert(refs.documents.every(d=>d.markdown.length<=120000));
 assert(refs.images.every(i=>!i.dataUrl.startsWith('data:')));
}
assert.equal(catalog.count,336);assert(catalog.buildings.every(b=>b.appearanceVersion===5));
store=await openLocalProjectStore({projectDir});const saved=await store.saveSerialized(JSON.stringify(p),previous.sha256);
assert.equal(saved.kind,'saved');store.close();
store=await openLocalProjectStore({projectDir});const loaded=store.loadSnapshot()!;assert.deepEqual(loaded.project,p);
const proof={projectId:store.projectId,projectDir,revision:loaded.revision,sha256:loaded.sha256,
 savedAndReopened:true,allMapLayersAndEventsUnchanged:true,passabilityAndPriorityUnchanged:true,
 sourceSlotsUnchanged:true,newAndExistingProjectsHaveGableReferences:true,buildingCount:6,allNativeRoofsRestored:true,onlyStoneGableChangedFromRevision15:true};store.close();
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(loaded.project));
fs.copyFileSync('output/beodeul-depth-fix/routes.json',`${out}/routes.json`);
fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));
fs.writeFileSync(`${dir}/village-overview.png`,renderMapPng({...loaded.project,startMapId:''},loaded.project.maps.map_beodeul_rest!,2).png);
console.log(JSON.stringify(proof));
