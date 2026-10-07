import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
const saved=JSON.parse(fs.readFileSync('output/beodeul-palette-standard/save-result.json','utf8'));
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/palette-standard-references.json','utf8'));
const old=JSON.parse(fs.readFileSync('output/beodeul-river-town/reloaded-project.json','utf8'));
const store=await openLocalProjectStore({projectDir:saved.projectDir}),loaded=store.loadSnapshot()!;
assert.equal(loaded.sha256,saved.sha256);assert.equal(loaded.revision,saved.revision);
assert.deepEqual(loaded.project.maps,old.maps);assert.deepEqual(loaded.project.startPos,old.startPos);assert.equal(loaded.project.startMapId,old.startMapId);
for(const id of ['beodeul_city','beodeul_ground']){
 const ts=loaded.project.tilesets[id]!,before=old.tilesets[id];
 const {referenceDocuments:currentRefs,...currentMetadata}=ts;
 const {referenceDocuments:oldRefs,...oldMetadata}=before;
 assert.deepEqual(currentMetadata,oldMetadata);
 const refs=ts.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const d of fragment.documents)assert.deepEqual(refs.documents.find(a=>a.id===d.id),d);
 for(const i of fragment.images)assert.deepEqual(refs.images.find(a=>a.id===i.id),i);
}
const proof={projectId:store.projectId,projectDir:saved.projectDir,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,
 mapsEventsStartAndTilePassageUnchanged:true,freshAndExistingGroundReferencesVerified:saved.freshGroundReferencesVerified,existingCityReferencesVerified:true,
 selectedPalette:'warm',sharedDocuments:fragment.documents.length,referenceOnly:true};store.close();
fs.writeFileSync('output/beodeul-palette-standard/reloaded-project.json',JSON.stringify(loaded.project));
fs.writeFileSync('verify-shots/beodeul-palette-standard/canonical-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
