import fs from 'node:fs';import assert from 'node:assert/strict';
import {defaultTilesets} from '../../src/project/defaults/defaultAssets.ts';
import {bundledChipsetFrameCount,bundledChipsetSheetHeight,bundledChipsetTilesPerRow} from '../../src/assets/bundled.ts';
import {PNG} from 'pngjs';
const fresh=defaultTilesets();
const warm=fresh.beodeul_warm_trees;assert(warm);assert.equal(warm.referenceSourceTilesetId,'beodeul_city');
const key=warm.image.id,im=PNG.sync.read(fs.readFileSync('public/assets/beodeul-warm-trees/chipset.png'));
assert.equal(bundledChipsetFrameCount(key),warm.count);assert.equal(bundledChipsetTilesPerRow(key),8);assert.equal(bundledChipsetSheetHeight(key),im.height);assert.equal(im.width,128);
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/village50-references.json','utf8'));
for(const id of ['beodeul_city','beodeul_ground']){
 const refs=fresh[id].referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const d of fragment.documents)assert.deepEqual(refs.documents.find(a=>a.id===d.id),d);
 for(const i of fragment.images)assert.deepEqual(refs.images.find(a=>a.id===i.id),i);
}
fs.writeFileSync('verify-shots/beodeul-village50/fresh-proof.json',JSON.stringify({freshDefaultsHaveWarmTrees:true,count:warm.count,pngGeometryMatches:true,cityAndGroundHaveSharedVillageAndTreeReferences:true},null,2));console.log('Fresh defaults and common palette geometry verified');
