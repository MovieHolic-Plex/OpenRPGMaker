import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
const resultFile='output/beodeul-palette-standard/save-result.json';
const previous=JSON.parse(fs.readFileSync(resultFile,'utf8'));
const baseline=JSON.parse(fs.readFileSync('output/beodeul-river-town/reloaded-project.json','utf8'));
const store=await openLocalProjectStore({projectDir:previous.projectDir});
const before=store.loadSnapshot()!;
assert.equal(before.sha256,previous.sha256);assert.equal(before.revision,19);
const project=before.project;
assert.deepEqual(project.maps,baseline.maps);
for(const id of ['beodeul_city','beodeul_ground']){
 const refs=project.tilesets[id]!.referenceDocuments;
 project.tilesets[id]={...baseline.tilesets[id],referenceDocuments:refs};
}
const saved=await store.saveSerialized(JSON.stringify(project),before.sha256);
assert.equal(saved.kind,'saved');
fs.writeFileSync(resultFile,JSON.stringify({...previous,...saved,metadataRestoredToRevision18:true}));
store.close();console.log(JSON.stringify(saved));
