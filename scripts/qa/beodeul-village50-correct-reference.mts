import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
const file='output/beodeul-village50/save-result.json',previous=JSON.parse(fs.readFileSync(file,'utf8'));
const store=await openLocalProjectStore({projectDir:previous.projectDir});
const before=store.loadSnapshot()!;assert.equal(before.sha256,previous.sha256);
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/village50-references.json','utf8'));
for(const id of ['beodeul_city','beodeul_ground']){
 const refs=before.project.tilesets[id]!.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const doc of fragment.documents){const at=refs.documents.findIndex(d=>d.id===doc.id);assert(at>=0);refs.documents[at]=doc;}
}
const saved=await store.saveSerialized(JSON.stringify(before.project),before.sha256);assert.equal(saved.kind,'saved');
fs.writeFileSync(file,JSON.stringify({...previous,...saved}));store.close();console.log(JSON.stringify(saved));
