import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {ensureBundledTilesets,createBlankProject} from '../../src/project/defaults.ts';
const dir='verify-shots/beodeul-shared-village',out='output/beodeul-shared-village';
const proof=JSON.parse(fs.readFileSync(`${dir}/canonical-proof.json`,'utf8'));
let store=await openLocalProjectStore({projectDir:proof.projectDir});
const before=store.loadSnapshot()!;assert.equal(before.sha256,proof.sha256);
const p=structuredClone(before.project);ensureBundledTilesets(p);assert.deepEqual(p.maps,before.project.maps);
for(const project of [p,createBlankProject()])for(const id of ['beodeul_city','beodeul_ground']){
 const ref=project.tilesets[id]!.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 assert(ref.images.find(i=>i.id==='bd-ground-courtyard-image')!.caption.includes('820px/128색'));
 assert(ref.documents.every(d=>d.markdown.length<=120000));
}
const saved=await store.saveSerialized(JSON.stringify(p),before.sha256);assert.equal(saved.kind,'saved');store.close();
store=await openLocalProjectStore({projectDir:proof.projectDir});const loaded=store.loadSnapshot()!;assert.deepEqual(loaded.project,p);
proof.projectId=store.projectId;proof.revision=loaded.revision;proof.sha256=loaded.sha256;proof.learningImageSizeCap=820;proof.learningImagePalette=128;proof.referenceFinalSaveMapsIdentical=true;store.close();
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(p));fs.writeFileSync(`${dir}/canonical-proof.json`,JSON.stringify(proof,null,2));
console.log(JSON.stringify({projectId:proof.projectId,revision:proof.revision,sha256:proof.sha256,mapsIdentical:true,savedAndReopened:true}));
