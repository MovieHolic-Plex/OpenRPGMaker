// Focused visible receiver checks; no suites, Vitest, gates or original project writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {PNG} from 'pngjs';
import {SunlightField} from '../../src/project/sunlight';
import {SunlightField as BeforeField} from '../../.vite-cache/terrain-shadows/sunlight-before';
import {rasterSunlightArt} from '../../src/project/sunlightArt';
import {renderMapPng,renderToolRegionPngBase64} from '../qa-game/render.mts';
const p=JSON.parse(fs.readFileSync('.vite-cache/terrain-shadows/fixture.json','utf8'));
const t=p.tilesets.beodeul_city,art=rasterSunlightArt(PNG.sync.read(fs.readFileSync('public/assets/beodeul-city/beodeul-city-chipset.png')),t.tileSize,t.tilesPerRow);
const counts=(field,geometry?)=>{const alpha=new Map<string,number>();let duplicates=0,pixels=0,hidden=0;
 for(let y=0;y<field.map.height;y++){const r=field.row(y);for(let py=0;py<r.h;py++)for(let px=0;px<r.w;px++)if(r.rgba[(py*r.w+px)*4+3]){
  const key=`${r.x+px},${r.y+py}`;if(alpha.has(key))duplicates++;alpha.set(key,(alpha.get(key)??0)+1);pixels++;
  if(geometry){const x=(r.x+px+.5)/4,sy=(r.y+py+.5)/4,bx=Math.floor(x/16),by=Math.floor(sy/16),receivers=geometry.receivers(bx,by),j=Math.floor((sy-by*16)*4)*64+Math.floor((x-bx*16)*4);if(receivers.owner[j]!==y)hidden++;}
 }}return {duplicates,pixels,hidden,unique:alpha.size};};
const checks=[],results=[];
for(const mapId of ['shadow_receivers','houses_native']){
 const m=p.maps[mapId],geometry=new SunlightField(m,t,art),old=counts(new BeforeField(m,t,art),geometry),next=counts(geometry,geometry);
 assert.equal(next.duplicates,0);assert.ok(next.pixels>0);results.push({mapId,before:old,after:next});
}
checks.push('each visible ground/cliff pixel receives sunlight opacity once; hidden receivers are excluded');
assert.ok(results.some(r=>r.before.hidden>0));assert.ok(results.every(r=>r.after.hidden===0));
const map=p.maps.shadow_receivers,field=new SunlightField(map,t,art);
assert.ok(field.maxTerrain>0);assert.equal(field.casters.length,0);assert.ok(counts(field).pixels>0);
checks.push('native rough height brush casts terrain shadows with no building/tree caster');
const roadOnly=structuredClone(map);delete roadOnly.relief;assert.equal(new SunlightField(roadOnly,t,art).maxHeight,0);
assert.equal(counts(new SunlightField(roadOnly,t,art)).pixels,0);checks.push('flat native roads never cast a terrain/building shadow');
for(const azimuth of [0,90,180,270]){
 const m=structuredClone(map);m.sunlight.azimuth=azimuth;const f=new SunlightField(m,t,art);
 const shaded=[];for(let py=0;py<m.height*4;py++)for(let px=0;px<m.width*4;px++){const x=(px+.5)/4,y=(py+.5)/4;if(f.terrainAt(x,y)===0&&f.shadowAt(x,y)>0)shaded.push([x,y]);}
 assert.ok(shaded.length>0);results.push({azimuth,groundShadowSamples:shaded.length});
}checks.push('height brush casts ground shadows for all four sun directions');
for(const [name,azimuth]of[['northwest',315],['southeast',135]]){
 map.sunlight.azimuth=azimuth;fs.writeFileSync(`verify-shots/terrain-shadows/terrain-${name}.png`,renderMapPng(p,map).png);
}map.sunlight.azimuth=315;
fs.writeFileSync('verify-shots/terrain-shadows/house-after.png',Buffer.from(renderToolRegionPngBase64(p,{mapId:'houses_native',x:15,y:36,w:22,h:16}),'base64'));
const proof={checks,results,userProjectWritten:false};fs.writeFileSync('verify-shots/terrain-shadows/contracts.json',JSON.stringify(proof,null,2));console.log(proof);
