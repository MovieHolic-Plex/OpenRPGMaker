/** Read-only original Emerald positive controls. External reference PNGs never copied into repo/public/output. */
import { strict as assert } from 'node:assert';
import { readFileSync,writeFileSync,mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPng,encodePng } from '../../monster-collect-species/node/png';
import { createImage,pixelAt,setPixel } from '../../monster-collect-species/pixel/image';
import { pack,checkCharset,sha,VERSION,LIMITS } from './motion';
const arg=process.argv.indexOf('--references'),folder=process.argv[arg+1];if(arg<0||!folder)throw Error('--references external-directory required');
const references=[{file:'may.png',path:'graphics/object_events/pics/people/may/walking.png'},{file:'brendan.png',path:'graphics/object_events/pics/people/brendan/walking.png'},{file:'professor.png',path:'graphics/object_events/pics/people/prof_birch.png'},{file:'woman.png',path:'graphics/object_events/pics/people/woman_1.png'}];
const mapping=[{frame:5,flip:false},{frame:1,flip:false},{frame:6,flip:false},{frame:7,flip:true},{frame:2,flip:true},{frame:8,flip:true},{frame:3,flip:false},{frame:0,flip:false},{frame:4,flip:false},{frame:7,flip:false},{frame:2,flip:false},{frame:8,flip:false}];
const records=references.map(ref=>{
 const path=join(folder,ref.file),source=readPng(path),bytes=readFileSync(path);assert.equal(source.width,144);assert.equal(source.height,32);const bg=pixelAt(source,0,0);
 // Emerald object graphics are indexed4bpp, palette index0 is transparent. These original PNGs use the corner RGB for that unique index.
 const frames=mapping.map(({frame,flip})=>{const out=createImage(16,32);for(let y=0;y<32;y++)for(let x=0;x<16;x++){const pixel=pixelAt(source,frame*16+(flip?15-x:x),y);if(pixel[0]===bg[0]&&pixel[1]===bg[1]&&pixel[2]===bg[2])continue;setPixel(out,x,y,[pixel[0],pixel[1],pixel[2],255]);}return out;});
 const native=pack(frames),checked=checkCharset(native);assert.equal(checked.pass,true,ref.file+': '+checked.errors.join('; '));assert((checked.metrics.paletteUnion as number)<=15);
 return {file:ref.file,primaryUrl:'https://github.com/pret/pokeemerald/blob/master/'+ref.path,sourceSha256:sha(bytes),sheet:{width:source.width,height:source.height,frames:9,frameWidth:16,frameHeight:32},sourceTransparency:'GBA4bpp palette index0 keyed by original unique corner RGB',probeSha256:sha(encodePng(native)),pass:checked.pass,paletteUnion:checked.metrics.paletteUnion,metrics:checked.metrics};
});
const base=mkdtempSync(join(tmpdir(),'emerald-reference-verifier-')),report={version:VERSION,limits:LIMITS,referenceOnly:true,shippingNintendoPixels:false,rows:['up','right','down','left'],columns:['stepA','idle','stepB'],mapping,records};writeFileSync(join(base,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({base,passed:records.map(r=>({file:r.file,paletteUnion:r.paletteUnion,sourceSha256:r.sourceSha256,probeSha256:r.probeSha256}))},null,2));
