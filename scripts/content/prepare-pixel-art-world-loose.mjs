// No source artwork is read or embedded. Regions were manually reviewed in pixels.
import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/loose.json',import.meta.url),'utf8'));
if(data.packs.length!==106)throw Error('Expected106catalog28source variants');
const ids=new Set();
for(const pack of data.packs){
 if(ids.has(pack.id)||!/^[a-f0-9]{64}$/.test(pack.sha256)||pack.width%16||pack.height%16)throw Error('Invalid source metadata');ids.add(pack.id);
 let row=1;
 for(const recipe of pack.recipes){
  if(ids.has(recipe.id))throw Error('Duplicate object');ids.add(recipe.id);
  const r=recipe.pixelRect,b=recipe.alphaBounds;
  if(Object.values(r).some(v=>!Number.isInteger(v))||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>pack.width||r.y+r.height>pack.height)throw Error(`Source bounds ${recipe.id}`);
  if(b.x<0||b.y<0||b.width<1||b.height<1||b.x+b.width>r.width||b.y+b.height>r.height)throw Error(`Alpha bounds ${recipe.id}`);
  if(recipe.supportStatus==='source-only')continue;
  const surface=recipe.placementKind==='surface';
  if(surface&&(b.width>92||b.height>56))throw Error(`Surface too large ${recipe.id}`);
  const width=surface?3:Math.ceil(r.width/32),height=surface?3:Math.ceil(r.height/32);
  if(width>8)throw Error(`Atlas too narrow ${recipe.id}`);
  recipe.outputRect={x:0,y:row,width,height};
  if(recipe.blockingCells?.some(([x,y])=>!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height))throw Error(`Footprint bounds ${recipe.id}`);
  recipe.pixelOffset=surface?{x:48-Math.floor(b.width/2),y:56-b.height}:{x:Math.floor((width*32-r.width)/2),y:height*32-r.height};
  row+=height;
 }
 pack.atlas={columns:8,width:256,height:row*32,count:8*row};
}
await writeFile(new URL('../../src/assets/pixelArtWorldLooseCatalog.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log({sources:data.packs.length,regions:data.packs.reduce((n,p)=>n+p.coverage.sourceRegions,0),fixedObjects:data.packs.reduce((n,p)=>n+p.coverage.fixedObjects,0),sourceOnly:data.packs.reduce((n,p)=>n+p.coverage.sourceOnly,0)});
