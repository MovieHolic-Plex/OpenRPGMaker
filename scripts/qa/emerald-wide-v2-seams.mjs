import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
const out='output/evidence/emerald-wide-v2',preview=process.argv.includes('--preview');
const p=JSON.parse(fs.readFileSync(`${out}/${preview?'preview':'reloaded'}-project.json`)),checks=JSON.parse(fs.readFileSync(`${out}/checks.json`));
const m=p.maps.map_field_emerald_basin_20260914,ts=p.tilesets[m.tilesetId],atlas=PNG.sync.read(Buffer.from(p.assets.uploaded[ts.image.id].dataUrl.split(',')[1],'base64'));
const samples=[];
function sample(kind,x,y,px,py,water=false){const tile=m.lowerTiles[y*m.width+x],a=((Math.floor(tile/30)*16+py)*atlas.width+tile%30*16+px)*4,rgb=[...atlas.data.subarray(a,a+3)];
 assert.ok(water?rgb[2]>rgb[1]&&rgb[1]>rgb[0]:rgb[0]>rgb[1]&&rgb[1]>rgb[2],`${kind} (${x},${y}) edge (${px},${py}): ${rgb}`);
 samples.push({kind,x,y,tile,pixel:[px,py],rgb});
}
for(const s of checks.stairChecks)for(const x of [s.x,s.x+1]){sample('stair-upper',x,s.top-1,8,15);sample('stair-lower',x,s.top+s.rows,8,0);}
for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.lowerTiles[y*m.width+x]===102&&(x===0||m.lowerTiles[y*m.width+x-1]!==102)){
 let end=x;while(end+1<m.width&&m.lowerTiles[y*m.width+end+1]===102)end++;
 if(!(x>=8&&end<33&&y>=2&&y<22))for(const dy of [0,1]){sample('bridge-west',x-1,y+dy,15,8);sample('bridge-east',end+1,y+dy,0,8);}
 x=end;
}
for(const [x,y,px,py]of [[0,55,0,8],[0,56,0,8],[79,49,15,8],[79,50,15,8],[22,63,8,15],[23,63,8,15]])sample('map-road-exit',x,y,px,py);
for(const [x,y,px,py]of [[55,0,8,0],[79,3,15,8],[43,63,8,15]])sample('open-water-edge',x,y,px,py,true);
fs.writeFileSync(`${out}/seam-${preview?'preview':'saved'}-proof.json`,JSON.stringify({passed:true,preview,samples},null,2));
console.log({passed:true,preview,samples:samples.length});
