import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store';
import {defaultTilesets} from '../../src/project/defaults/defaultAssets';
import {ensureBeodeulForms,createBeodeulFormsTileset} from '../../src/project/defaults/beodeulForms';
import {renderMapPng} from '../qa-game/render.mts';
import references from '../../src/assets/beodeulFormsReferences.json';
const out='output/beodeul-forms',evidence='verify-shots/beodeul-forms',mode=process.argv.at(-1);
if(mode==='save'){
 const before=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8')),identity=JSON.parse(fs.readFileSync(`${out}/before-store.json`,'utf8'));
 const p=JSON.parse(fs.readFileSync(`${out}/authored-project.json`,'utf8'));ensureBeodeulForms(p.tilesets.beodeul_city);p.tilesets.beodeul_forms=createBeodeulFormsTileset();
 assert(!ensureBeodeulForms(p.tilesets.beodeul_city));
 for(const [id,map] of Object.entries(before.maps))assert.deepEqual(p.maps[id],map);
 for(const map of Object.values(before.maps) as any[]){const old=before.tilesets[map.tilesetId],next=p.tilesets[map.tilesetId];
  for(const n of new Set<number>([...map.lowerTiles,...(map.lowerOverlayTiles??[]),...map.upperTiles,...(map.upperOverlayTiles??[])]))if(n>=0){assert.deepEqual(next.passability[n],old.passability[n]);assert.equal(next.priority[n],old.priority[n]);}
 }
 const fresh=defaultTilesets(),city=fresh.beodeul_city!;
 assert.equal(city.structureKits!.filter(k=>k.id.startsWith('bd-house-form-')).length,6);assert.equal(fresh.beodeul_forms!.structureKits!.length,18);
 assert.deepEqual(city.referenceDocuments!.find(c=>c.id==='beodeul-forms'),references[0]);assert.deepEqual(p.tilesets.beodeul_city.referenceDocuments.find(c=>c.id==='beodeul-forms'),references[0]);
 assert(!ensureBeodeulForms(city));
 fs.writeFileSync(`${out}/authored-project.json`,JSON.stringify(p));
 const store=await openLocalProjectStore({projectDir:identity.projectDir});assert.equal(store.projectId,identity.projectId);const s=store.loadSnapshot()!;assert.equal(s.sha256,identity.sha256);
 const saved=await store.saveSerialized(JSON.stringify(p),identity.sha256);assert.equal(saved.kind,'saved');store.close();
 fs.writeFileSync(`${out}/save-result.json`,JSON.stringify({...identity,...saved},null,2));
 fs.writeFileSync(`${evidence}/fresh-existing-proof.json`,JSON.stringify({freshHasSixFamilies:true,existingHasSixFamilies:true,sourceHas18Kits:true,referencesMatch:true,idempotent:true,oldMapsAndPassagePreserved:true},null,2));
 console.log(saved);
}else if(mode==='reload'){
 const saved=JSON.parse(fs.readFileSync(`${out}/save-result.json`,'utf8')),expected=JSON.parse(fs.readFileSync(`${out}/expected-content.json`,'utf8'));
 const store=await openLocalProjectStore({projectDir:saved.projectDir}),s=store.loadSnapshot()!;assert.equal(s.sha256,saved.sha256);assert.equal(s.revision,saved.revision);
 assert.deepEqual(s.project.maps,expected.maps);assert.equal(s.project.startMapId,expected.startMapId);assert.deepEqual(s.project.startPos,expected.startPos);
 const city=s.project.tilesets.beodeul_city!;
 assert.deepEqual(city.structureKits!.filter(k=>k.id.startsWith('bd-house-form-')||k.id.startsWith('bd-form-')),expected.formKits);
 assert.deepEqual(city.referenceDocuments!.filter(c=>c.id==='beodeul-forms'),expected.references);
 const m=s.project.maps.map_beodeul_forms_village!;assert(m.width===50&&m.height===50);assert.equal(s.project.tilesets.beodeul_city!.structureKits!.filter(k=>k.id.startsWith('bd-house-form-')).length,6);
 fs.writeFileSync(`${out}/reloaded-project.json`,JSON.stringify(s.project));fs.writeFileSync(`${evidence}/reloaded.png`,renderMapPng({...s.project,startMapId:''},m).png);store.close();
 fs.writeFileSync(`${evidence}/canonical-proof.json`,JSON.stringify({...saved,separateProcessReopened:true,allSixMapsMatch:true,startMatches:true,all18SharedKitsMatch:true,sharedReferencesMatch:true,mapId:m.id,width:m.width,height:m.height},null,2));console.log('Canonical maps, shared kits and references reloaded',saved.revision,saved.projectId);
}else throw Error('save | reload');
