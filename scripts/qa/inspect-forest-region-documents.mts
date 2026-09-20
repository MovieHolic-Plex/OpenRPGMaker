import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {deserialize,serialize} from '../../src/project/io/serialize';
const results=[];
for(const slug of ['gubisup','small-forest-village','forest-cliff-village']){
 const file=`public/assets/region-references/${slug}.oprn.json`,raw=fs.readFileSync(file,'utf8'),source=JSON.parse(raw),map=Object.values(source.maps)[0] as any,ts=source.tilesets[map.tilesetId];
 const loaded=deserialize(raw),again=deserialize(serialize(loaded));
 for(const p of [loaded,again]){
  assert.ok(isDeepStrictEqual(p.maps[map.id],map),slug+': map changed');
  for(const key of ['passability','priority','terrain','tileMeta','tileGroups','autotileGroups','tileGrafts','structureKits'])assert.ok(isDeepStrictEqual(p.tilesets[ts.id][key],ts[key]),slug+': '+key+' changed');
  assert.equal(p.assets.uploaded[ts.image.id].dataUrl,source.assets.uploaded[ts.image.id].dataUrl);
 }
 const bytes=Buffer.from(source.assets.uploaded[ts.image.id].dataUrl.split(',')[1],'base64');assert.ok(bytes.equals(fs.readFileSync(`public/assets/region-references/${slug}-atlas.png`)));
 assert.ok([...map.lowerTiles,...map.upperTiles].every((id:number)=>id>=-1&&id<ts.count));
 results.push({slug,map:map.id,roundTripExact:true,atlasExact:true,atlasSha256:createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync('.omo/evidence/forest-village-trails/document-proof.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
