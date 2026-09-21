import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {canMove} from '../src/project/collision';
const root='output/castle-shared-place';fs.mkdirSync(root,{recursive:true});
const p=JSON.parse(fs.readFileSync('output/castle-landscape-improvement/before-place.json','utf8'));
const old=JSON.parse(fs.readFileSync('output/castle-density-improvement/sqlite-reloaded.json','utf8'));
const m=p.maps['grand-river-fortress'],o=old.maps[m.id],ts=p.tilesets[m.tilesetId],ot=old.tilesets[o.tilesetId];
const asset=p.assets.uploaded[ts.image.id],oldAsset=old.assets.uploaded[ot.image.id];
const img=PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1],'base64')),oi=PNG.sync.read(Buffer.from(oldAsset.dataUrl.split(',')[1],'base64'));
const rect=[16,122,88,22],tiles=new Set<number>();
for(let y=rect[1];y<rect[1]+rect[3];y++)for(let x=rect[0];x<rect[0]+rect[2];x++)for(const layer of ['lowerTiles','upperTiles']){const v=o[layer][y*m.width+x];if(v>=0)tiles.add(v);}
const first=ts.count,remap=new Map([...tiles].map((v,i)=>[v,first+i]));
const packed=new PNG({width:512,height:Math.ceil((first+tiles.size)/32)*16});PNG.bitblt(img,packed,0,0,512,img.height,0,0);
for(const [from,to] of remap){PNG.bitblt(oi,packed,from%32*16,Math.floor(from/32)*16,16,16,to%32*16,Math.floor(to/32)*16);for(const field of ['passability','priority','terrain','tileMeta'])ts[field].push(structuredClone(ot[field][from]));}
ts.count+=tiles.size;asset.dataUrl='data:image/png;base64,'+PNG.sync.write(packed).toString('base64');asset.meta.height=packed.height;
for(const r of p.resourceProfiles)if(r.assetId===ts.image.id)r.imageHeight=packed.height;
for(let y=rect[1];y<rect[1]+rect[3];y++)for(let x=rect[0];x<rect[0]+rect[2];x++){const i=y*m.width+x;for(const layer of ['lowerTiles','upperTiles'])m[layer][i]=o[layer][i]<0?-1:remap.get(o[layer][i]);for(const field of ['lowerTileStacks','upperTileStacks'])if(m[field])delete m[field][i];}
const proof=JSON.parse(fs.readFileSync('tiledata/castle-tiles-rpgs/improvements/density-01/assembly-proof.json','utf8'));
let pos={...p.startPos};for(const stop of proof.routes){for(const move of stop.moves){const [dx,dy]=({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]} as any)[move.dir];assert(canMove(p,m,pos.x,pos.y,pos.x+dx,pos.y+dy));pos={x:pos.x+dx,y:pos.y+dy};}assert.deepEqual(pos,{x:stop.x,y:stop.y});}
assert.deepEqual(p.maps['castle-study'],old.maps['castle-study']);
fs.writeFileSync(root+'/project.json',JSON.stringify(p));
fs.writeFileSync(root+'/assembly-proof.json',JSON.stringify({...proof,placements:undefined,restoredRect:rect,source:'density-01',restoredTileRemap:Object.fromEntries(remap),outsideRectUnchanged:true},null,2));
console.log(JSON.stringify({restoredRect:rect,copiedUniqueCells:tiles.size,routes:proof.routes.length,otherMapPreserved:true}));
