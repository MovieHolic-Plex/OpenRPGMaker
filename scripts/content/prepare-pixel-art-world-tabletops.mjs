// Metadata only. Actual source pixels are supplied by the user's verified imports.
import fs from 'node:fs/promises';
const recipes=JSON.parse(await fs.readFile('tiledata/pixel-art-world/tabletop-composites.json','utf8'));
const ids=new Set();
for(const r of recipes){
 if(ids.has(r.id)||!/^[a-f0-9]{64}$/.test(r.sourceSha256))throw Error('Duplicate recipe or invalid hash '+r.id);
 ids.add(r.id);
 if(r.canvas.width%32||r.canvas.height%32||r.sourceWidth!==256||r.sourceHeight%32)throw Error('Invalid geometry '+r.id);
 for(const p of [r.base,...r.overlays]){
  const q=p.sourceRect,o=p.offset;
  if(!Object.values(q).concat(Object.values(o)).every(Number.isInteger)||q.x<0||q.y<0||q.width<=0||q.height<=0||q.x+q.width>r.sourceWidth||q.y+q.height>r.sourceHeight||o.x<0||o.y<0||o.x+q.width>r.canvas.width||o.y+q.height>r.canvas.height)throw Error('Out of bounds '+r.id);
 }
}
await fs.writeFile('src/assets/pixelArtWorldTabletopComposites.json',JSON.stringify(recipes,null,2)+'\n');
console.log('Prepared '+recipes.length+' source-pixel composition recipes; no artwork.');
