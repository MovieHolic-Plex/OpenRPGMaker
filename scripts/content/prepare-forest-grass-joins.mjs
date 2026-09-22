// Deterministic sprite palette adaptation, never reshapes the authored silhouettes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
const sourcePath='public/assets/forest-harmony/chipset.png';
const source=PNG.sync.read(fs.readFileSync(sourcePath));
const original=PNG.sync.read(fs.readFileSync('public/assets/region-references/great-falls-atlas.png'));
const ids=[504,505,240,498,499,528,529,619,712,559];
const out=new PNG({width:ids.length*16,height:16});
const at=(im,tile,x,y)=>((Math.floor(tile/30)*16+y)*im.width+tile%30*16+x)*4;
const key=(im,i)=>Array.from(im.data.subarray(i,i+3)).join(',');
const greens=new Map([['84,176,67',1],['54,119,64',0.85],['189,227,110',1.06]]);
// 712 was left in the old palette in the existing atlas. Match its rock tones to 711.
const rock=new Map();
for(let y=0;y<16;y++)for(let x=0;x<16;x++){
 const a=at(original,711,x,y),b=at(source,711,x,y),k=key(original,a);
 const group=rock.get(k)??[];group.push(Array.from(source.data.subarray(b,b+3)));rock.set(k,group);
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const rockPalette=Object.fromEntries([...rock].map(([k,v])=>[k,[0,1,2].map(c=>median(v.map(rgb=>rgb[c])))]));
const proof=[];
for(const [n,tile] of ids.entries()){
 let grassPixels=0,opaque=0;
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const from=at(source,tile,x,y),old=at(original,tile,x,y),floor=at(source,240,x,y),to=(y*out.width+n*16+x)*4;
  source.data.copy(out.data,to,from,from+4);
  const tone=greens.get(key(original,old));
  if(tile!==240&&tile!==712&&source.data[from+3]&&tone!==undefined){
   for(let c=0;c<3;c++)out.data[to+c]=Math.min(255,Math.round(source.data[floor+c]*tone));
   grassPixels++;
  }
  if(tile===712){const mapped=rockPalette[key(original,old)];assert(mapped,'Every right-face rock tone has a left-face match');for(let c=0;c<3;c++)out.data[to+c]=mapped[c];}
  assert.equal(out.data[to+3],source.data[from+3]);
  if(out.data[to+3])opaque++;
 }
 proof.push({sourceTile:tile,sourceX:tile%30,sourceY:Math.floor(tile/30),targetTile:n,width:16,height:16,alphaUnchanged:true,grassPixels,opaquePixels:opaque,change:tile===240?'identical floor copy':tile===712?'rock palette only':'grass pixels only'});
}
fs.writeFileSync('public/assets/forest-harmony/grass-joins.png',PNG.sync.write(out));
fs.writeFileSync('tiledata/forest-villages/diverse/grass-joins-source.json',JSON.stringify({sourcePath,sourceSha256:createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),floorTile:240,texture:'tex_forest_harmony_grass_joins',tilesPerRow:10,count:10,rockPalette,tiles:proof},null,2)+'\n');
console.log(proof);
