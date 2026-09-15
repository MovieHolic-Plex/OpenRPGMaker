/** Rebuild the saved reference field from native tile/quarter recipes, never screenshot pixels. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { configFromEnv } from './supabase-resource-root/supabaseRest.mjs';
import type { ProjectWriteAuthority } from '../src/project/supabaseProjectSync';
import type { GameMap, GameEvent, TilesetDef } from '../src/project/types';
const sourceRoot = process.env.RPG_ZZU_SOURCE_ROOT ?? process.cwd();
const source = (file: string) => pathToFileURL(path.join(sourceRoot, 'src', file)).href;
const { loadProjectFromSupabase, saveProjectToSupabase } = await import(source('project/supabaseProjectSync.ts'));
const { serialize, deserialize, serializeForComparison } = await import(source('project/io.ts'));
const { computeReachableCells } = await import(source('project/lint/reachability.ts'));
const { canMove } = await import(source('project/collision.ts'));
const out = 'output/evidence/emerald-wide-v2';
fs.mkdirSync(out,{recursive:true});
const config = await configFromEnv();
assert.equal(config.projectId, 'rpg-zzu-house-template-gallery');
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, (value: ProjectWriteAuthority) => authority = value);
assert.ok(before && authority, 'A readable canonical project and write authority are mandatory');
if(!fs.existsSync(`${out}/before.json`))fs.writeFileSync(`${out}/before.json`,serialize(before));
fs.writeFileSync(`${out}/last-before.json`,serialize(before));
console.log(JSON.stringify({connected:true,projectId:config.projectId,maps:Object.keys(before.maps).length,referencePresent:!!before.maps.map_field_twinfalls_20260913}));
const {createBlankMap}=await import(source('project/defaults/defaultMaps.ts'));
const {chipsetQuarterComposition}=await import(source('project/defaults/terrainQuarterAutotile.ts'));
const {seedWorldCoastMapping}=await import(source('project/defaults/worldCoastMapping.ts'));
const {seedWorldTerrainAutotiles}=await import(source('project/defaults/worldTerrainAutotiles.ts'));
const W=80,H=64,id='map_field_emerald_basin_20260914',tsId='tileset_emerald_basin_20260914',assetId='asset_emerald_basin_20260914';
if(before.maps[id]){
 assert.ok(process.argv.includes('--revise'),'Existing authored map: use --revise only against its saved receipt');
 const receipt=deserialize(fs.readFileSync(fs.existsSync(`${out}/reloaded-project.json`)?`${out}/reloaded-project.json`:'output/evidence/emerald-wide/reloaded-project.json','utf8'));
 for(const [kind,key]of [['maps',id],['tilesets',tsId],['assets',assetId]])if(kind==='assets')assert.deepEqual(before.assets.uploaded[key],receipt.assets.uploaded[key]);else assert.deepEqual(before[kind][key],receipt[kind][key]);
}
const project=structuredClone(before),map=createBlankMap('필드 04 · 비취 대계곡',W,H,tsId,16);map.id=id;map.lowerTiles.fill(240);map.upperTiles.fill(-1);project.maps[id]=map;
const base=structuredClone(before.tilesets.easyrpg_chipset_world);seedWorldCoastMapping(base);seedWorldTerrainAutotiles(base);
const inside=(x:number,y:number)=>x>=0&&y>=0&&x<W&&y<H;
const at=(x:number,y:number)=>inside(x,y)?map.lowerTiles[y*W+x]:240;
const set=(x:number,y:number,t:number)=>{if(inside(x,y))map.lowerTiles[y*W+x]=t;};
const reference=JSON.parse(fs.readFileSync('scripts/lib/emeraldFieldReference.json','utf8'));
const RX=8,RY=2,inReference=(x:number,y:number)=>x>=RX&&x<RX+25&&y>=RY&&y<RY+20;
const reserved=new Set<number>(),water=new Set<number>(),bridges:{x0:number,x1:number,y:number}[]=[],treeAnchors:number[][]=[];
const reserve=(x:number,y:number,r=1)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(inside(x+dx,y+dy))reserved.add((y+dy)*W+x+dx);};
let seed=202609142;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function line(points:number[][],fn:(x:number,y:number)=>void){for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j],steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let k=0;k<=steps;k++)fn(Math.round(ax+(bx-ax)*k/steps),Math.round(ay+(by-ay)*k/steps));}}
function river(points:number[][],r:number){line(points,(x,y)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=(r+.4)**2)set(x+dx,y+dy,120);});}
river([[21,20],[21,23],[28,27],[31,31],[34,35],[32,40],[37,44],[41,48],[48,54],[46,59],[42,64]],2);
// Backwater at the north-east edge: finger-shaped banks and wooded islets.
for(let x=42;x<W;x++){const edge=11+Math.round(3*Math.sin(x*.25)+2*Math.sin(x*.51));for(let y=0;y<edge;y++)set(x,y,120);}
// Authored asymmetric shorelines, not rectangular stamps.
for(const island of [{x:48,y:1,rows:[[2,4],[1,5],[0,5],[0,4],[1,3]]},{x:59,y:6,rows:[[1,2],[0,3],[0,3],[1,2]]},{x:69,y:1,rows:[[2,3],[1,4],[0,4],[1,3]]}])
 island.rows.forEach(([lo,hi],dy)=>{for(let dx=lo;dx<=hi;dx++)set(island.x+dx,island.y+dy,240);});
river([[57,7],[56,14],[58,19],[55,24],[53,28],[47,31],[42,35],[34,39]],2);
// Every scarp has one upper contour and a parallel foot contour. The terrain
// behind it remains continuous grass, not a separately outlined rectangular plate.
const cliffIds=new Set([18,19,48,49,78,79,80,108,110,138,139,140,171,172,173,201,202,203,231,232]);
const scarps:{name:string,x:number,tops:number[],depths:number[]}[]=[];
const cliffOccupancy=new Map<number,string>();
function scarp(name:string,x0:number,tops:number[],depths:number[],fillNorth=false){
 assert.equal(tops.length,depths.length);
 for(let i=1;i<tops.length;i++){assert.ok(Math.abs(tops[i]-tops[i-1])<=1,'Continuous cliff contour');assert.ok(Math.abs(depths[i]-depths[i-1])<=1,'Gradual cliff taper');assert.ok(Math.abs(tops[i]+depths[i]-tops[i-1]-depths[i-1])<=1,'Continuous cliff foot');}
 scarps.push({name,x:x0,tops,depths});
 for(let dx=0;dx<tops.length;dx++){
  const x=x0+dx,depth=depths[dx];let top=tops[dx];
  if(fillNorth)for(let y=0;y<top;y++)set(x,y,240);
  const next=dx===tops.length-1&&name==='north-west-upper'?6:dx===tops.length-1&&name==='north-west-lower'?11:tops[Math.min(tops.length-1,dx+1)];
  const slope=Math.sign(next-top),foot=top+depth;
  const nextFoot=next+depths[Math.min(tops.length-1,dx+1)],footSlope=Math.sign(nextFoot-foot);
  const bottomY=foot+(footSlope>0?1:0);
  // Tile 18 starts its diagonal at the top-left pixel, while flat lip
  // 139 starts near its bottom edge. The descending cap belongs one row
  // below the flat lip; otherwise every transition grows a rock spike.
  if(slope>0)top++;
  const left=dx===0&&x0>0&&!name.startsWith('north-'),right=dx===tops.length-1&&x<W-1&&!name.startsWith('north-');
  assert.ok(bottomY>top,`${name}: caps must not overlap`);
  for(let y=top;y<=bottomY;y++)if(inside(x,y)){const key=y*W+x;assert.ok(!cliffOccupancy.has(key),`${name} overlaps ${cliffOccupancy.get(key)} at ${x},${y}`);cliffOccupancy.set(key,name);}
  set(x,top,slope>0?18:slope<0?19:139);
  for(let y=top+1;y<bottomY;y++)set(x,y,slope===footSlope&&slope!==0?(slope>0?231:232):171+(left?0:right?2:1));
  set(x,bottomY,footSlope>0?48:footSlope<0?49:201+(left?0:right?2:1));
  // No isolated vertical cut taller than one row at an interior endpoint.
  if(!name.startsWith('north-')&&(left||right)&&inside(x,top))assert.ok(depth<=1,`${name}: taper interior end`);
 }
}
scarp('north-west-upper',0,[5,5,6,7,7,8,8,7],Array(8).fill(3),true);
scarp('north-west-lower',0,[16,16,15,14,14,14,13,12],Array(8).fill(2));
// The learned cliff turns back toward the northern boundary, ending outside
// the map instead of exposing a six-row vertical cut in the clearing.
scarp('north-east',33,[4,5,6,6,5,4,4,3,3,2,1,0,-1,-2,-3,-4,-5,-6],[6,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],true);
const terraces:{x:number,y:number,w:number,h:number,face:number,stair:number}[]=[];
function terrace(name:string,x:number,tops:number[],depths:number[],stair:number,face:number){
 const top=tops[stair-x];assert.equal(tops[stair+1-x],top);
 assert.equal(depths[stair-x],face);assert.equal(depths[stair+1-x],face);
 scarp(name,x,tops,depths);
 terraces.push({x,y:top,w:tops.length,h:1,face,stair});
 for(let sy=top+1;sy<=top+face;sy++){set(stair,sy,374);set(stair+1,sy,374);reserve(stair,sy,1);}
 for(const sy of [top,top+face+1])for(const sx of [stair,stair+1]){set(sx,sy,67);reserve(sx,sy,1);}
}
// Different contours: a broad west bay, an east headland with a smaller upper
// ledge, and a shallow south-west bank. Free ends taper down into natural ramps.
terrace('west-bank',0,[33,33,33,34,35,36,36,36,36,36,36,36,36,36,36,36,36,36,36,36,35,35,35],[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],18,3);
terrace('east-bank',61,[24,24,24,25,25,25,25,25,25,25,25,25,25,25,25,24,23,23,23],[1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],73,3);
terrace('east-upper',65,[20,20,20,20,20,20,20,19,18,18,18,19,19,19,19],[1,2,2,2,2,2,2,2,2,2,2,2,2,2,2],70,2);
terrace('south-west-bank',0,[49,49,49,50,51,52,52,52,53,54,54,54,54,54,54,54,53,53],[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],14,2);
// A short overhang gives a recognizable sheltered place along the west trail.
const caveCells=[(39)*W+10,39*W+11,38*W+10,38*W+11];for(const i of caveCells)map.lowerTiles[i]=236;
for(let y=40;y<=42;y++)for(let x=10;x<=11;x++){set(x,y,67);reserve(x,y,1);}
for(let i=0;i<W*H;i++)if(map.lowerTiles[i]===120)water.add(i);
const roadRoutes:{points:number[][],wide:boolean}[]=[];
function road(points:number[][],wide=false){
 roadRoutes.push({points,wide});
 const paint=(x:number,y:number)=>{reserve(x,y,1);const offsets=wide?[[0,0],[1,0],[0,1],[1,1]]:[[0,0]];for(const [dx,dy]of offsets)if([240,109,304].includes(at(x+dx,y+dy)))set(x+dx,y+dy,67);};
 let previous:number[]|undefined;
 line(points,(x,y)=>{
  // Cardinal neighbors are required by the road quarter compositor. A diagonal
  // Bresenham stroke alone renders as isolated dirt flecks on a one-cell trail.
  if(previous&&x!==previous[0]&&y!==previous[1]){
   const a=[x,previous[1]],b=[previous[0],y];
   const join=[240,109,304,67,374].includes(at(a[0],a[1]))?a:b;
   paint(join[0],join[1]);
  }
  paint(x,y);previous=[x,y];
 });
}
// Narrow routes follow bank bends. No ring of equally wide road around a large lake.
road([[10,46],[11,42],[17,43],[22,38],[23,31],[29,29],[38,28],[44,25],[51,24],[59,24],[62,30],[68,34],[65,41],[58,45],[46,47],[35,47],[27,50],[20,56]],true);
road([[23,31],[20,25],[18,22],[15,20],[14,18]],true);
road([[22,38],[19,39],[19,34],[13,33]],false);
road([[62,30],[73,30],[73,25],[73,24],[70,24],[70,20],[70,18]],false);
road([[10,46],[12,49],[14,52],[14,54]],false);
road([[14,54],[14,57],[14,59]],true);
road([[38,28],[36,23],[32,18]],false);
road([[65,41],[72,45],[76,49]],true);
road([[76,49],[75,53],[74,56],[70,58],[64,57],[60,53],[58,49],[58,45]],false);
road([[35,47],[30,45],[27,43],[25,42],[22,38]],false);
// Continuous two-cell exits with a straight approach at the adjoining map seam.
road([[3,55],[0,55]],true);
road([[3,55],[4,57],[10,59],[16,59],[20,56]],true);
road([[20,56],[22,60],[22,63]],true);
road([[76,49],[79,49]],true);
// Keep lookout ends uncluttered; stones and flowers identify the destination.
for(const [cx,cy]of [[13,33],[70,18]])reserve(cx,cy,2);
function crossing(y:number,cx:number){let x0=cx,x1=cx;while(x0>0&&water.has(y*W+x0-1))x0--;while(x1<W-1&&water.has(y*W+x1+1))x1++;x0--;x1++;bridges.push({x0,x1,y});for(let x=x0-2;x<=x1+2;x++){reserve(x,y,1);reserve(x,y+1,1);if(!water.has(y*W+x)&&[240,304].includes(at(x,y)))set(x,y,67);if(!water.has((y+1)*W+x)&&[240,304].includes(at(x,y+1)))set(x,y+1,67);}}
crossing(29,30);crossing(24,55);crossing(47,40);
// Check the authored road graph before quarter baking; bridge decks and stairs
// participate. Reference-module terrain has its own already-authored paths.
const roadCells=new Set<number>();
for(let i=0;i<W*H;i++)if([67,374].includes(map.lowerTiles[i]))roadCells.add(i);
for(const b of bridges)for(let x=b.x0;x<=b.x1;x++){roadCells.add(b.y*W+x);roadCells.add((b.y+1)*W+x);}
const roadNeighbors=(i:number)=>[[i%W-1,Math.floor(i/W)],[i%W+1,Math.floor(i/W)],[i%W,Math.floor(i/W)-1],[i%W,Math.floor(i/W)+1]].filter(([x,y])=>inside(x,y)).map(([x,y])=>y*W+x);
const pendingRoads=new Set(roadCells),roadComponents:number[][]=[];
while(pendingRoads.size){const queue=[pendingRoads.values().next().value!];pendingRoads.delete(queue[0]);for(let k=0;k<queue.length;k++){const i=queue[k];for(const j of roadNeighbors(i))if(pendingRoads.has(j)){pendingRoads.delete(j);queue.push(j);}}roadComponents.push(queue);}
const detachedRoadComponents=roadComponents.filter(c=>!c.some(i=>inReference(i%W,Math.floor(i/W)))&&!c.includes(55*W));
assert.equal(detachedRoadComponents.length,0,'Every road component reaches the west exit or reference module');
const isolatedRoadCells=[...roadCells].filter(i=>!inReference(i%W,Math.floor(i/W))&&!roadNeighbors(i).some(j=>roadCells.has(j)));
assert.deepEqual(isolatedRoadCells,[],'No isolated dirt flecks outside the reference module');
fs.writeFileSync(`${out}/road-graph.json`,JSON.stringify({routes:roadRoutes,isolatedRoadCells,roadCellCount:roadCells.size,components:roadComponents.map(c=>({size:c.length,cells:c.map(i=>[i%W,Math.floor(i/W)])}))},null,2));
for(const [x,y]of [[11,42],[13,33],[69,19],[68,34]])reserve(x,y,1);
for(let y=RY;y<RY+20;y++)for(let x=RX;x<RX+25;x++)reserve(x,y,0);
// Dark grass makes coherent woodland pockets; clearings remain visibly different.
const groves=[[4,2,4,2],[73,12,6,4],[12,33,7,3],[68,21,7,5],[10,51,4,2],[5,21,7,6],[8,46,7,7],[24,18,6,4],[38,18,6,7],[44,8,5,4],[46,22,6,5],[66,31,8,6],[75,43,6,12],[61,54,12,8],[25,60,15,4],[4,61,5,4],[33,52,6,7],[34,5,7,4],[56,36,6,7]];
for(const [cx,cy,rx,ry]of groves)for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++)if(inside(x,y)&&!reserved.has(y*W+x)&&at(x,y)===240&&((x-cx)/rx)**2+((y-cy)/ry)**2<.52+.06*Math.sin(x*.3+y*.2))set(x,y,304);
const clear=(x:number,y:number,w:number,h:number,allowReserved=false)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){if(!inside(x+dx,y+dy))return false;const i=(y+dy)*W+x+dx;if(![240,109,304,67].includes(map.lowerTiles[i])||map.upperTiles[i]!==-1||(!allowReserved&&reserved.has(i)))return false;}return true;};
let roundTrees=0,cypresses=0,shrubs=0,flowerPatches=0;
function tree(x:number,y:number,slim=false){const w=slim?1:2;if(!clear(x,y,w,2))return false;const tiles=slim?[[450],[451]]:[[318,319],[348,349]];for(let dy=0;dy<2;dy++)for(let dx=0;dx<w;dx++)map.upperTiles[(y+dy)*W+x+dx]=tiles[dy][dx];treeAnchors.push([x,y,w]);if(slim)cypresses++;else roundTrees++;return true;}
function prop(x:number,y:number,t:number,authored=false){if(!clear(x,y,1,1,authored))return false;map.upperTiles[y*W+x]=t;return true;}
// Groups have a broadleaf focal tree, slim trees along their flanks and a low shrub edge.
for(let n=0;n<230;n++){
 const [cx,cy,rx,ry]=groves[Math.floor(random()*groves.length)],a=random()*Math.PI*2,r=Math.sqrt(random());
 const x=Math.round(cx+Math.cos(a)*rx*r),y=Math.round(cy+Math.sin(a)*ry*r);
 tree(x,y,false);if(random()<.65)tree(x-2,y+1,true);if(random()<.5)tree(x+3,y-1,true);
 for(const [dx,dy]of [[-1,3],[2,3],[3,1]])if(random()<.6&&prop(x+dx,y+dy,453))shrubs++;
}
// Trees on plateau tops, river-bank promontories and the small upper islets are authored individually.
for(const [x,y,slim]of [[7,31,0],[14,30,0],[5,33,1],[16,34,1],[11,35,1],[64,17,0],[74,18,1],[67,18,0],[76,23,1],[64,23,1],[68,24,1],[7,51,0],[12,51,1],[49,2,0],[70,2,0],[60,7,1],[35,33,1],[38,34,0],[29,37,1],[43,41,0],[46,43,1],[22,47,0],[53,51,0],[58,15,1],[48,28,1]])tree(x,y,Boolean(slim));
for(const [x,y]of [[11,32],[15,32],[68,17],[72,17]])if(![67,374].includes(at(x,y)))prop(x,y,59,true);
for(const [x,y]of [[12,32],[14,32],[69,17],[71,17]])if(![67,374].includes(at(x,y)))prop(x,y,452,true);
for(const b of bridges)for(const x of [b.x0-1,b.x1+1])if(![67,374].includes(at(x,b.y-1)))prop(x,b.y-1,59,true);
// Several short flower patches per clearing, not one global uniform scatter.
for(const [cx,cy]of [[8,25],[17,27],[24,34],[25,43],[37,26],[47,23],[62,29],[67,38],[58,43],[50,48],[36,50],[19,54],[9,44],[66,24],[74,23],[13,35],[51,4],[72,5],[70,52]])for(let j=0;j<7;j++){
 const x=cx+Math.floor(random()*7)-3,y=cy+Math.floor(random()*5)-2;
 if(prop(x,y,random()<.75?452:288))flowerPatches++;
}
for(let n=0;n<100;n++){const x=Math.floor(random()*W),y=Math.floor(random()*H);if(random()<.45)prop(x,y,57);else if(prop(x,y,453))shrubs++;}
// A few standing stones emphasize crossings; they are not repeated at every corner.
for(const [x,y]of [[25,26],[34,31],[51,21],[60,27],[36,44],[45,50]])if(clear(x,y,1,2)){map.upperTiles[y*W+x]=89;map.upperTiles[(y+1)*W+x]=119;}
const semantic=[...map.lowerTiles],recipes:{sources:any[],solid:boolean}[]=[],recipeIndex=new Map<string,number>();
// Ghost road neighbors make exit art flush with the boundary, without rounded dead-end caps.
const padded={width:W+2,height:H+2,lowerTiles:Array((W+2)*(H+2)).fill(undefined)};
for(let y=0;y<H;y++)for(let x=0;x<W;x++)padded.lowerTiles[(y+1)*(W+2)+x+1]=semantic[y*W+x];
// Open water continues through map boundaries; avoid a false grassy rim.
for(let x=0;x<W;x++){
 if(semantic[x]===120)padded.lowerTiles[x+1]=120;
 if(semantic[(H-1)*W+x]===120)padded.lowerTiles[(H+1)*(W+2)+x+1]=120;
}
for(let y=0;y<H;y++){
 if(semantic[y*W]===120)padded.lowerTiles[(y+1)*(W+2)]=120;
 if(semantic[y*W+W-1]===120)padded.lowerTiles[(y+1)*(W+2)+W+1]=120;
}
for(const [px,py,sx,sy]of [[0,0,0,0],[W+1,0,W-1,0],[0,H+1,0,H-1],[W+1,H+1,W-1,H-1]])if(semantic[sy*W+sx]===120)padded.lowerTiles[py*(W+2)+px]=120;
for(const y of [55,56])padded.lowerTiles[(y+1)*(W+2)]=67;
for(const y of [49,50])padded.lowerTiles[(y+1)*(W+2)+W+1]=67;
for(const x of [22,23])padded.lowerTiles[(H+1)*(W+2)+x+1]=67;

// Only dirt sees stair/deck neighbors as continuation. Water keeps the actual
// river bed context so a bridge does not grow a false grass shoreline.
const roadPadded={...padded,lowerTiles:[...padded.lowerTiles]};
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if([374,236].includes(semantic[y*W+x]))roadPadded.lowerTiles[(y+1)*(W+2)+x+1]=67;
for(const b of bridges)for(let x=b.x0;x<=b.x1;x++)for(const y of [b.y,b.y+1])roadPadded.lowerTiles[(y+1)*(W+2)+x+1]=67;

for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=y*W+x,t=semantic[i],composition=chipsetQuarterComposition(t===67?roadPadded:padded,base,x+1,y+1);if(!composition||composition.sources.every(s=>s.tile===t))continue;
 const key=JSON.stringify(composition.sources);let tile=recipeIndex.get(key);if(tile===undefined){tile=540+recipes.length;recipeIndex.set(key,tile);recipes.push({sources:[...composition.sources],solid:water.has(i)});}map.lowerTiles[i]=tile;
}
// Reuse the learned 25x20 waterfall assembly at native scale as a focal module.
for(let y=0;y<20;y++)for(let x=0;x<25;x++){const i=(RY+y)*W+RX+x,t=reference.lowerTiles[y*25+x];map.lowerTiles[i]=t===123?510:t;map.upperTiles[i]=reference.upperTiles[y*25+x];}
for(let y=0;y<RY;y++)for(let x=0;x<25;x++){const t=reference.lowerTiles[x];if(t>=480||[0,30,60,90,120].includes(t))set(RX+x,y,120);}
for(const b of bridges)for(let x=b.x0;x<=b.x1;x++){map.lowerTiles[b.y*W+x]=102;map.lowerTiles[(b.y+1)*W+x]=103;map.upperTiles[b.y*W+x]=map.upperTiles[(b.y+1)*W+x]=-1;}
const original=PNG.sync.read(Buffer.from(before.assets.uploaded.asset_twinfalls_native_quarters_20260914.dataUrl.split(',')[1],'base64'));
const exterior=PNG.sync.read(fs.readFileSync('public/assets/easyrpg-chipset-exterior.png'));
const count=Math.ceil((540+recipes.length)/30)*30,atlas=new PNG({width:480,height:count/30*16});
function copy(src:PNG,tile:number,sx:number,sy:number,target:number,dx:number,dy:number,size:number){for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=((Math.floor(tile/30)*16+sy+y)*480+tile%30*16+sx+x)*4,b=((Math.floor(target/30)*16+dy+y)*480+target%30*16+dx+x)*4;for(let c=0;c<4;c++)atlas.data[b+c]=src.data[a+c];if(src.data[a]===255&&src.data[a+1]===103&&src.data[a+2]===139)atlas.data[b+3]=0;}}
for(let t=0;t<540;t++)copy(original,t,0,0,t,0,0,16);
[260,290,348,289].forEach((t,j)=>copy(exterior,t,0,0,450+j,0,0,16));
recipes.forEach((r,j)=>r.sources.forEach(s=>copy(original,s.tile,s.offsetX,s.offsetY,540+j,s.offsetX,s.offsetY,8)));
const ts=structuredClone(before.tilesets.tileset_twinfalls_reference_20260914);ts.id=tsId;ts.name='비취 계곡 · 강변 숲과 작은 단차';ts.image={type:'uploaded',id:assetId};ts.count=count;ts.tileGrafts=[];
const solid=(t:number)=>t>=540?recipes[t-540]?.solid??false:[450,452,109,374,102,103].includes(t)?false:t===453||t===451||t===236||cliffIds.has(t)||!ts.passability[t]?.up;
ts.passability=Array.from({length:count},(_,t)=>({up:!solid(t),down:!solid(t),left:!solid(t),right:!solid(t)}));
ts.priority=Array.from({length:count},(_,t)=>[318,319,450,288].includes(t)?'upper':'lower');ts.terrain=Array(count).fill(0);ts.autotileGroups=[];
ts.tileMeta=Array.from({length:count},(_,t)=>({source:'user',userLocked:true,defaultLayer:[318,319,450,452,288].includes(t)?'upper':'lower',passage:solid(t)?'solid':[318,319,450,288].includes(t)?'star':'passable',description:t>=540?'World 물가·흙길·풀 경계 쿼터 조립':t>=450&&t<=453?'Exterior 원본 키 큰 나무·꽃·관목':'World 원본과 쌍폭포 모듈'}));
const bytes=PNG.sync.write(atlas);project.tilesets[tsId]=ts;project.assets.uploaded[assetId]={id:assetId,name:'비취 계곡 · 혼합 식생 팔레트',kind:'tileset',dataUrl:`data:image/png;base64,${bytes.toString('base64')}`,meta:{width:480,height:atlas.height}};
map.layoutPlan={version:1,kind:'reference-field-v2',regions:[],notes:'두 참고 이미지의 폭포→물길→좁은 건널목과 활엽수·키 큰 나무·관목의 높이 차를 반영. 80×64. 작은 단차와 좁은 샛길. 원본 쌍폭포는 25×20 모듈로 native scale 재사용.'};
const normalized=deserialize(serialize(project)),savedMap=normalized.maps[id],reachable=computeReachableCells(normalized,savedMap,3,55);
const landmarks=[['entry',3,55],['west-exit',0,55],['east-exit',79,49],['south-exit',22,63],['west-shelter',11,42],['west-terrace',13,33],['reference-bridge',17,16],['middle-bridge',30,29],['east-bridge',55,24],['upper-terrace',69,19],['south-bridge',40,47],['east-woods',68,34]] as const;
for(const [name,x,y]of landmarks)assert.ok(reachable.has(`${x},${y}`),`Unreachable ${name} (${x},${y})`);
for(const [key,m]of Object.entries(before.maps))if(key!==id)assert.deepEqual(normalized.maps[key],m,`Other map changed ${key}`);
assert.equal(normalized.startMapId,before.startMapId);assert.deepEqual(normalized.startPos,before.startPos);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const t=savedMap.upperTiles[y*W+x];
 if(t===318)assert.deepEqual([savedMap.upperTiles[y*W+x+1],savedMap.upperTiles[(y+1)*W+x],savedMap.upperTiles[(y+1)*W+x+1]],[319,348,349],'Complete broadleaf tree');
 if(t===450)assert.equal(savedMap.upperTiles[(y+1)*W+x],451,'Complete cypress');
}
for(const b of bridges){const x=Math.floor((b.x0+b.x1)/2);assert.ok(canMove(normalized,savedMap,x,b.y,x+1,b.y),'Bridge crossing');if(water.has((b.y+2)*W+x))assert.equal(canMove(normalized,savedMap,x,b.y+1,x,b.y+2),false,'Water blocks sideways bridge exit');}
const stairChecks=terraces.map(t=>{for(const x of [t.stair,t.stair+1]){
 for(let y=t.y+t.h;y<t.y+t.h+t.face;y++)assert.equal(savedMap.lowerTiles[y*W+x],374,'Stairs stay inside the cliff face');
 for(const y of [t.y+t.h-1,t.y+t.h+t.face]){assert.notEqual(savedMap.lowerTiles[y*W+x],374,'Landing must not extend stairs');assert.ok(reachable.has(`${x},${y}`),'Reachable stair landing');}
 }return {x:t.stair,top:t.y+t.h,rows:t.face,cliffRows:t.face};});
const exits=[{side:'west',x:0,y:55,width:2},{side:'east',x:79,y:49,width:2},{side:'south',x:22,y:63,width:2}];
for(const e of exits)for(let n=0;n<e.width;n++){const x=e.x+(e.side==='south'?n:0),y=e.y+(e.side==='south'?0:n);assert.ok(reachable.has(`${x},${y}`),'Every edge exit cell is reachable');}
const diagonalCliffTiles=savedMap.lowerTiles.filter(t=>[18,19,48,49].includes(t)).length;
assert.ok(scarps.length===7,'All seven cliff contours are authored explicitly');
const checks={detachedRoadComponents:detachedRoadComponents.length,isolatedRoadCells:isolatedRoadCells.length,cliffContours:scarps.length,cliffContoursDoNotOverlap:true,diagonalCliffTiles,stairChecks,exits,projectId:config.projectId,mapId:id,width:W,height:H,roundTrees:savedMap.upperTiles.filter(t=>t===318).length,cypresses:savedMap.upperTiles.filter(t=>t===450).length,shrubs:savedMap.upperTiles.filter(t=>t===453).length,flowerPatches:savedMap.upperTiles.filter(t=>t===452||t===288).length,quarterVariants:recipes.length,bridges:bridges.length+1,reachableCells:reachable.size,landmarks:landmarks.length,existingMapsPreserved:true,startPositionPreserved:true};
fs.writeFileSync(`${out}/cliff-contours.json`,JSON.stringify(scarps,null,2));
fs.writeFileSync(`${out}/preview-project.json`,serialize(normalized));fs.writeFileSync(`${out}/checks.json`,JSON.stringify(checks,null,2));fs.writeFileSync(`${out}/landmarks.json`,JSON.stringify(landmarks));fs.writeFileSync(`${out}/atlas.png`,bytes);console.log(JSON.stringify(checks));
if(process.argv.includes('--apply')){const saved=await saveProjectToSupabase(normalized,config,authority);assert.equal(saved.kind,'saved',JSON.stringify(saved));const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);assert.equal(serializeForComparison(reloaded),serializeForComparison(normalized));fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify({...checks,saved:true,reloaded:true,sha256:saved.sha256},null,2));console.log('Saved and reloaded successfully');}
