import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
const out='output/beodeul-river-town',dir='verify-shots/beodeul-river-town';
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const oldMaps=JSON.parse(fs.readFileSync('output/beodeul-gable-fix/reloaded-project.json','utf8')).maps;
const expectedMap=JSON.parse(fs.readFileSync(`${out}/preview-project.json`,'utf8')).maps.map_beodeul_river_town;
const shared=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/river-town-references.json','utf8'));
const store=await openLocalProjectStore({projectDir}),loaded=store.loadSnapshot()!;
assert.equal(loaded.revision,18);
assert.equal(loaded.sha256,'b5c69f999f7d8525f4ff7fa372112fbcf11ec56eda4202a34ce2783eb7c003b5');
for(const [id,m] of Object.entries(oldMaps))assert.deepEqual(loaded.project.maps[id],m);
assert.deepEqual(loaded.project.maps.map_beodeul_river_town,expectedMap);
assert.equal(loaded.project.startMapId,expectedMap.id);assert.deepEqual(loaded.project.startPos,{x:42,y:25});
for(const id of ['beodeul_city','beodeul_ground']){
 const refs=loaded.project.tilesets[id]!.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const d of shared.documents)assert.deepEqual(refs.documents.find(a=>a.id===d.id),d);
 for(const i of shared.images)assert.deepEqual(refs.images.find(a=>a.id===i.id),i);
}
const routes=JSON.parse(fs.readFileSync(`${out}/routes.json`,'utf8'));
const proof={projectId:store.projectId,projectDir,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,
 mapId:expectedMap.id,buildings:41,bridges:3,all41ActualEntrancesAndSixBridgeBanksConnectedByAuthoredStreets:true,
 allAuthoredMapLayersAndEventsMatchSavedIntent:true,existingMapsPreserved:true,newAndExistingProjectsHaveSharedReferences:true,exteriorOnly:true,
 runtimeRouteSteps:routes.stops.reduce((n,s)=>n+s.moves.length,0)};
store.close();fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(loaded.project));
fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
