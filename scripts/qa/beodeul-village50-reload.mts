import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {renderMapPng} from '../qa-game/render.mts';
const out='output/beodeul-village50';
const saved=JSON.parse(fs.readFileSync(`${out}/save-result.json`,'utf8'));
const store=await openLocalProjectStore({projectDir:saved.projectDir});
const loaded=store.loadSnapshot()!;
assert.equal(loaded.sha256,saved.sha256);assert.equal(loaded.revision,saved.revision);
const p=loaded.project;
assert.deepEqual(p.maps.map_beodeul_village50,JSON.parse(fs.readFileSync(`${out}/authored-map.json`,'utf8')));
for(const [id,m] of Object.entries(JSON.parse(fs.readFileSync(`${out}/before-maps.json`,'utf8'))))assert.deepEqual(p.maps[id],m);
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/village50-references.json','utf8'));
for(const id of ['beodeul_city','beodeul_ground']){
 const refs=p.tilesets[id]!.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const d of fragment.documents)assert.deepEqual(refs.documents.find(a=>a.id===d.id),d);
 for(const i of fragment.images)assert.deepEqual(refs.images.find(a=>a.id===i.id),i);
}
assert.equal(p.tilesets.beodeul_warm_trees!.referenceSourceTilesetId,'beodeul_city');
fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(p));
fs.writeFileSync('verify-shots/beodeul-village50/reloaded.png',renderMapPng({...p,startMapId:''},p.maps.map_beodeul_village50!).png);
store.close();
fs.writeFileSync('verify-shots/beodeul-village50/canonical-proof.json',JSON.stringify({...saved,savedAndReopened:true,sharedWarmTilesetAndReferencesVerified:true},null,2));
console.log('Canonical map and shared palette tiles reopened successfully');
