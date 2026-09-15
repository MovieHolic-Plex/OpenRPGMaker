import Jimp from 'jimp';
import assert from 'node:assert/strict';
// User-supplied 4x4 master: sample each cell at pixel centers to avoid fractional
// 1254 / 4 boundaries leaking into adjacent faces. No smoothing or repainting.
const input='public/assets/shared/faceset/source/blue-traveler-expressions.png';
const image=await Jimp.read(input);
assert.equal(image.bitmap.width,1254);assert.equal(image.bitmap.height,1254);
const output=new Jimp(192,192,0);
for(let row=0;row<4;row++)for(let col=0;col<4;col++)for(let y=0;y<48;y++)for(let x=0;x<48;x++){
 const sx=Math.floor((col+(x+.5)/48)*image.bitmap.width/4);
 const sy=Math.floor((row+(y+.5)/48)*image.bitmap.height/4);
 output.setPixelColor(image.getPixelColor(sx,sy),col*48+x,row*48+y);
}
await output.writeAsync('public/assets/shared/faceset/blue-traveler-expressions.png');
await output.clone().resize(768,768,Jimp.RESIZE_NEAREST_NEIGHBOR).writeAsync('public/assets/shared/faceset/source/preview-4x.png');
console.log('Prepared 192x192 shared sheet, 16 cells at 48x48.');
