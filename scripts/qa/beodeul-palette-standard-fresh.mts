import fs from 'node:fs';import assert from 'node:assert/strict';
import {createBeodeulCityTileset} from '../../src/project/defaults/beodeulCity.ts';
import {createBeodeulGroundTileset} from '../../src/project/defaults/beodeulGround.ts';
const fragment=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/palette-standard-references.json','utf8'));
for(const ts of [createBeodeulCityTileset(),createBeodeulGroundTileset()]){
 const refs=ts.referenceDocuments!.find(r=>r.id==='beodeul-ground-dressing')!;
 for(const d of fragment.documents)assert.deepEqual(refs.documents.find(a=>a.id===d.id),d);
 for(const i of fragment.images)assert.deepEqual(refs.images.find(a=>a.id===i.id),i);
}
fs.writeFileSync('verify-shots/beodeul-palette-standard/fresh-proof.json',JSON.stringify({freshCityAndGroundHaveSelectedPalette:true,documents:fragment.documents.length},null,2));
console.log('Fresh city and ground palette references verified');
