import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {withTsModule} from '../ontology-ts-loader.mjs';
// Stop the project's host before invoking. Never write live SQLite behind the editor.
const dirs=process.argv.slice(2);assert(dirs.length,'Pass offline project directories');const proof=[];
await withTsModule('src/project/defaults/forestHarmony.ts','forest.mjs',async forest=>{
 await withTsModule('src/project/tilesetReferences.ts','refs.mjs',m=>m.validateTilesetReferences(forest.createForestHarmonyTileset().referenceDocuments));
 await withTsModule('electron/local-store/store.ts','store.mjs',async api=>{
 for(const dir of dirs){const store=await api.openLocalProjectStore({projectDir:path.resolve(dir)});try{const before=store.loadSnapshot(),p=structuredClone(before.project);assert(p.tilesets.forest_harmony);store.backup();forest.ensureForestHarmonyReferences(p.tilesets.forest_harmony);assert.deepEqual(p.maps,before.project.maps);const saved=await store.saveSerialized(JSON.stringify(p),before.sha256);assert.equal(saved.kind,'saved');const after=store.loadSnapshot();assert.deepEqual(JSON.parse(JSON.stringify(after.project)),JSON.parse(JSON.stringify(p)));const c=after.project.tilesets.forest_harmony.referenceDocuments.find(c=>c.id==='forest-executable-v1');assert.equal(c.documents.length,3);assert.equal(c.images.length,3);proof.push({projectId:store.info().projectId,storage:'SQLite',saved:true,reloaded:true,mapsUnchanged:true,documents:c.documents.length,images:c.images.length});}finally{store.close();}}
 });
});
fs.mkdirSync('verify-shots/forest-executable-recipes',{recursive:true});fs.writeFileSync('verify-shots/forest-executable-recipes/persistence.json',JSON.stringify(proof,null,2));console.log(proof);
