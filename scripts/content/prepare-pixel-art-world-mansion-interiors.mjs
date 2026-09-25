// Metadata only: native source coordinates and appended-atlas plans, never source pixels.
import {readFile,writeFile} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(new URL('../../'+path,import.meta.url),'utf8'));
const packs=await read('tiledata/pixel-art-world/mansion-interiors.json');
const plans=await read('tiledata/pixel-art-world/mansion-interiors-layout.json');
const comparisons=await read('tiledata/pixel-art-world/mansion-interiors-comparison.json');
const fail=m=>{throw Error(m);};
for(const pack of packs){
 if(pack.width!==256||pack.height!==1760||pack.tileSize!==32||!/^[a-f0-9]{64}$/.test(pack.sha256))fail('Original dimensions/hash');
 for(const r of pack.recipes){const q=r.sourceRect;if(!Object.values(q).every(Number.isInteger)||q.x<0||q.y<0||q.x+q.width>8||q.y+q.height>55||q.width<1||q.height<1)fail(r.id);r.tiles=Array.from({length:q.height},(_,y)=>Array.from({length:q.width},(_,x)=>(q.y+y)*8+q.x+x));}
}
const compiled=[];
for(const plan of plans){
 const pack=packs.find(p=>p.id===plan.packId);if(!pack||plan.sourceSha256!==pack.sha256||plan.sourceFilename!==pack.filename)fail('Plan source differs');
 let row=55;const recipes=structuredClone(pack.recipes),composites=[];
 for(const c of plan.composites){
  if(c.canvas.width%32||c.canvas.height%32||c.canvas.width<32||c.canvas.width>256||c.canvas.height<32)fail('Composite canvas');
  for(const p of c.parts){const r=p.sourceRect,o=p.offset;if(![...Object.values(r),o.x,o.y].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>256||r.y+r.height>1760||o.x<0||o.y<0||o.x+r.width>c.canvas.width||o.y+r.height>c.canvas.height)fail('Composite rectangle '+c.id);}
  const width=c.canvas.width/32,height=c.canvas.height/32,sourceRect={x:0,y:row,width,height},tiles=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>(row+y)*8+x));
  const r={id:c.id,name:c.name,sourceRect,tiles,facing:c.facing,placementKind:c.placementKind,supportCells:Array.from({length:width},(_,x)=>({x,y:height-1}))};recipes.push(r);composites.push({...c,sourceRect,tiles});row+=height;
 }
 const scenes=[];
 for(const s of plan.scenePlans){
  const {width,height}=s,lower=Array(width*height).fill(s.baseTile),upper=Array(width*height).fill(-1);
  const ix=(x,y)=>{if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)fail('Out of bounds '+s.id);return y*width+x;};
  for(const r of s.lowerRects)for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)lower[ix(r.x+x,r.y+y)]=r.tile;
  for(const stamp of s.lowerStamps??[]){const r=stamp.sourceRect;for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)lower[ix(stamp.x+x,stamp.y+y)]=(r.y+y)*8+r.x+x;}
  for(const p of s.placements){const r=recipes.find(r=>r.id===p.recipeId);if(!r)fail('Unknown object '+p.recipeId);r.tiles.forEach((line,y)=>line.forEach((tile,x)=>{const n=ix(p.x+x,p.y+y);if(upper[n]!==-1)fail('Overlap '+s.id);upper[n]=tile;}));for(const cell of r.supportCells){const tile=lower[ix(p.x+cell.x,p.y+cell.y)];if(!(r.placementKind==='wall-mounted'?s.wallTileIds:s.passableTiles).includes(tile))fail('Support '+s.id+'/'+r.id);}}
  if([...lower,...upper].some(t=>!Number.isInteger(t)||t< -1||t>=row*8)||lower.some(t=>!s.lowerTileIds.includes(t))||s.lowerTileIds.some(t=>upper.includes(t)))fail('Layers '+s.id);
  const start=ix(s.approachCells[0].x,s.approachCells[0].y),can=n=>upper[n]===-1&&s.passableTiles.includes(lower[n]),seen=new Set(can(start)?[start]:[]),q=[...seen];
  for(let k=0;k<q.length;k++){const n=q[k],x=n%width,y=Math.floor(n/width);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<width&&ny<height){const v=ix(nx,ny);if(!seen.has(v)&&can(v)){seen.add(v);q.push(v);}}}
  for(const p of s.approachCells)if(!seen.has(ix(p.x,p.y)))fail('Unreachable '+s.id+'/'+p.x+','+p.y);
  for(const r of s.requiredClearRects??[])for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(!seen.has(ix(r.x+x,r.y+y)))fail('Blocked corridor '+s.id);
  scenes.push({id:s.id,name:s.name,width,height,lowerTiles:lower,upperTiles:upper,placements:s.placements,approachCells:s.approachCells,passableTiles:s.passableTiles,lowerTileIds:s.lowerTileIds,rooms:s.rooms,doorways:s.doorways,notes:s.notes});
 }
 compiled.push({packId:pack.id,sourceComparisons:comparisons.filter(c=>c.packId===pack.id),sourceFilename:pack.filename,sourceSha256:pack.sha256,sourceCount:440,count:row*8,imageWidth:256,imageHeight:row*32,composites,recipes,scenes});
}
await writeFile(new URL('../../src/assets/pixelArtWorldMansionInteriorsCatalog.json',import.meta.url),JSON.stringify(packs,null,2)+'\n');
await writeFile(new URL('../../src/assets/pixelArtWorldMansionInteriorsLayout.json',import.meta.url),JSON.stringify(compiled,null,2)+'\n');
console.log(compiled.map(p=>({id:p.packId,raw:p.recipes.length-p.composites.length,composites:p.composites.length,count:p.count,scenes:p.scenes.length})));
