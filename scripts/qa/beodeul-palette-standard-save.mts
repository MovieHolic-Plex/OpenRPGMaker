import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {createBeodeulGroundTileset,beodeulGroundReferences} from '../../src/project/defaults/beodeulGround.ts';
const projectDir='/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/palette-standard-references.json','utf8'));
const fresh=createBeodeulGroundTileset();
const check=(ts:any)=>{const cat=ts.referenceDocuments.find((r:any)=>r.id==='beodeul-ground-dressing');
 for(const d of fragment.documents)assert.deepEqual(cat.documents.find((a:any)=>a.id===d.id),d);
 for(const i of fragment.images)assert.deepEqual(cat.images.find((a:any)=>a.id===i.id),i);
 assert(cat.documents.every((d:any)=>d.markdown.length<=120000));assert(cat.images.every((i:any)=>!i.dataUrl.startsWith('data:')));
};check(fresh);
const store=await openLocalProjectStore({projectDir}),before=store.loadSnapshot()!;
assert.equal(before.revision,18);assert.equal(before.sha256,'b5c69f999f7d8525f4ff7fa372112fbcf11ec56eda4202a34ce2783eb7c003b5');
const project=before.project;for(const id of ['beodeul_city','beodeul_ground']){
 const ts=project.tilesets[id]!,cats=structuredClone(ts.referenceDocuments??[]);
 for(const shipped of beodeulGroundReferences()){
  const at=cats.findIndex(c=>c.id===shipped.id);
  if(at<0)cats.push(shipped);
  else{const old=cats[at]!;cats[at]={...old,
   documents:[...old.documents.filter(d=>!shipped.documents.some(s=>s.id===d.id)),...shipped.documents],
   images:[...old.images.filter(i=>!shipped.images.some(s=>s.id===i.id)),...shipped.images]};}
 }
 ts.referenceDocuments=cats;check(ts);
}
const saved=await store.saveSerialized(JSON.stringify(project),before.sha256);assert.equal(saved.kind,'saved');
fs.writeFileSync('output/beodeul-palette-standard/save-result.json',JSON.stringify({projectId:store.projectId,projectDir,...saved,freshGroundReferencesVerified:true}));
store.close();console.log(JSON.stringify(saved));
