// Isolated authored demonstration; no live host owns this new folder.
import {isDeepStrictEqual} from 'node:util';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {withTsModule} from '../ontology-ts-loader.mjs';
const out='output/castle-executable-guide',dir=path.resolve('.oprn-projects/executable-tile-guide-proof-v2');
const equal=(a,b)=>isDeepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const p=JSON.parse(fs.readFileSync(out+'/example-project.json')),category=JSON.parse(fs.readFileSync('tiledata/castle-tiles-rpgs/executable/category.json'));
for(const id of ['opengameart_castle','forest_harmony'])p.tilesets[id].referenceDocuments=[...(p.tilesets[id].referenceDocuments??[]).filter(c=>c.id!==category.id),category];
await withTsModule('electron/local-store/store.ts','assembly-proof-store.mjs',async api=>{const store=await api.initLocalProjectStore({projectDir:dir});try{const old=store.loadSnapshot();if(old)assert.ok(equal(old.project,p),'Existing example differs');else{const saved=await store.saveSerialized(JSON.stringify(p),null);assert.equal(saved.kind,'saved');}assert.ok(equal(store.loadSnapshot().project,p),'Reload differs');fs.writeFileSync(out+'/example-persistence.json',JSON.stringify({projectId:store.info().projectId,projectDir:dir,saved:true,reloaded:true,revision:store.info().revision},null,2));}finally{store.close();}
 const reopened=await api.openLocalProjectStore({projectDir:dir});try{assert.ok(equal(reopened.loadSnapshot().project,p),'Reopen differs');fs.writeFileSync(out+'/example-reloaded.json',reopened.exportSerialized());}finally{reopened.close();}});
console.log('Isolated forest example saved and reopened from SQLite');
