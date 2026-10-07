import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store';
import {ensureBeodeulFacilityKits,beodeulFacilityReferences} from '../../src/project/defaults/beodeulFacilities';
import {defaultTilesets} from '../../src/project/defaults/defaultAssets';
const out='output/beodeul-facilities',evidence='verify-shots/beodeul-facilities';
const p=JSON.parse(fs.readFileSync(`${out}/preview-project.json`,'utf8')),before=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8'));
const identity=JSON.parse(fs.readFileSync(`${out}/before-store.json`,'utf8'));
ensureBeodeulFacilityKits(p.tilesets.beodeul_city);assert(!ensureBeodeulFacilityKits(p.tilesets.beodeul_city),'Applying again must be a no-op');
for(const [id,m] of Object.entries(before.maps))if(id!=='map_beodeul_village50')assert.deepEqual(p.maps[id],m);
const fresh=defaultTilesets(),ts=fresh.beodeul_city!,kits=ts.structureKits!.filter(k=>k.id.startsWith('bd-facility-'));
assert.equal(kits.length,32);assert.deepEqual(ts.referenceDocuments!.find(c=>c.id==='beodeul-facilities'),beodeulFacilityReferences()[0]);
assert(!ensureBeodeulFacilityKits(ts));
assert.equal(p.tilesets.beodeul_city.structureKits.filter(k=>k.id.startsWith('bd-facility-')).length,32);
assert.deepEqual(p.tilesets.beodeul_city.referenceDocuments.find(c=>c.id==='beodeul-facilities'),ts.referenceDocuments!.find(c=>c.id==='beodeul-facilities'));
// Existing map data and passage/priority for already used cells must not change.
for(const map of Object.values(before.maps) as any[]){
 const old=before.tilesets[map.tilesetId],next=p.tilesets[map.tilesetId],used=new Set([...(map.lowerTiles??[]),...(map.lowerOverlayTiles??[]),...(map.upperTiles??[]),...(map.upperOverlayTiles??[])]);
 for(const n of used){if(n<0)continue;assert.equal(next.priority[n],old.priority[n]);assert.deepEqual(next.passability[n],old.passability[n]);}
}
fs.writeFileSync(`${out}/authored-project.json`,JSON.stringify(p));
fs.writeFileSync(`${evidence}/fresh-proof.json`,JSON.stringify({freshDefaultsHave32FacilityKits:true,existingProjectHas32FacilityKits:true,commonReferencesMatch:true,idempotent:true,oldTilePassageAndPriorityPreserved:true},null,2));
const store=await openLocalProjectStore({projectDir:identity.projectDir});
assert.equal(store.projectId,identity.projectId);const current=store.loadSnapshot()!;assert.equal(current.sha256,identity.sha256);
const saved=await store.saveSerialized(JSON.stringify(p),identity.sha256);assert.equal(saved.kind,'saved');store.close();
fs.writeFileSync(`${out}/save-result.json`,JSON.stringify({...identity,...saved,oldMapsPreserved:true},null,2));
console.log(JSON.stringify(saved));
