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
import { applyLegacyEnvAliases } from './lib/oprnEnv.mjs';

applyLegacyEnvAliases();
const sourceRoot = process.env.OPRN_SOURCE_ROOT ?? process.cwd();
const source = (file: string) => pathToFileURL(path.join(sourceRoot, 'src', file)).href;
const { loadProjectFromSupabase, saveProjectToSupabase } = await import(source('project/supabaseProjectSync.ts'));
const { serialize, deserialize, serializeForComparison } = await import(source('project/io.ts'));
const { computeReachableCells } = await import(source('project/lint/reachability.ts'));
const { canMove } = await import(source('project/collision.ts'));
const out = 'output/evidence/emerald-wide';
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
assert.notEqual(before.maps[id]?.layoutPlan?.kind,'reference-field-v2','Use scripts/refine-emerald-wide.mts; do not restore the superseded broad layout.');
if(before.maps[id]){
 assert.ok(process.argv.includes('--revise'),'Existing authored map: use --revise only against its saved receipt');
 const receipt=deserialize(fs.readFileSync(`${out}/reloaded-project.json`,'utf8'));
 for(const [kind,key]of [['maps',id],['tilesets',tsId],['assets',assetId]])if(kind==='assets')assert.deepEqual(before.assets.uploaded[key],receipt.assets.uploaded[key]);else assert.deepEqual(before[kind][key],receipt[kind][key]);
}
const project=structuredClone(before),map=createBlankMap('필드 04 · 비취 대계곡',W,H,tsId,16);map.id=id;map.lowerTiles.fill(240);map.upperTiles.fill(-1);project.maps[id]=map;
const base=structuredClone(before.tilesets.easyrpg_chipset_world);seedWorldCoastMapping(base);seedWorldTerrainAutotiles(base);
const inside=(x:number,y:number)=>x>=0&&y>=0&&x<W&&y<H;
const at=(x:number,y:number)=>inside(x,y)?map.lowerTiles[y*W+x]:240;
const set=(x:number,y:number,t:number)=>{if(inside(x,y))map.lowerTiles[y*W+x]=t;};
const top:number[]=[],bottom:number[]=[];
for(let x=0;x<W;x++){
 top[x]=7+Math.round(2*Math.sin(x*.19)+Math.sin(x*.07));
 bottom[x]=top[x]+7+Math.round(2*Math.sin(x*.12+.7));
}
for(let x=0;x<W;x++){
 const rising=(top[x+1]??top[x])<top[x],falling=(top[x-1]??top[x])<top[x];
 for(let y=top[x];y<=bottom[x];y++)set(x,y,y===top[x]?(rising?19:falling?18:139):rising?232:falling?231:172);
 if((bottom[x+1]??bottom[x])<bottom[x]){set(x,bottom[x],49);}
 else if((bottom[x-1]??bottom[x])<bottom[x]){set(x,bottom[x],48);}
 else set(x,bottom[x],202);
}
const water=new Set<number>(),falls=new Set<number>(),protectedCells=new Set<number>(),bridges:{x0:number,x1:number,y:number}[]=[];
function ellipse(cx:number,cy:number,rx:number,ry:number,t:number){for(let y=Math.max(0,Math.floor(cy-ry-1));y<Math.min(H,cy+ry+2);y++)for(let x=Math.max(0,Math.floor(cx-rx-1));x<Math.min(W,cx+rx+2);x++){const angle=Math.atan2((y-cy)/ry,(x-cx)/rx);if(((x-cx)/rx)**2+((y-cy)/ry)**2<1+.09*Math.sin(angle*5+.4))set(x,y,t);}}
// Two neighboring falls share a western pool; a third tributary crosses the eastern escarpment.
for(const [cx,width]of [[23,3],[29,2],[61,3]])for(let y=0;y<27;y++){
 const c=y<top[cx]?cx+Math.round(Math.sin(y*.45)):cx;
 const radius=y<top[cx]?width+1:width;
 for(let x=c;x<c+radius;x++){if(y>=top[x]&&y<=bottom[x])falls.add(y*W+x);set(x,y,120);}
}
ellipse(26,24,7,5,120);ellipse(38,36,13,9,120);ellipse(60,27,6,5,120);
function channel(points:number[][],radius:number){for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j];const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let k=0;k<=steps;k++)ellipse(ax+(bx-ax)*k/steps,ay+(by-ay)*k/steps,radius,radius,120);}}
channel([[26,24],[27,29],[31,33]],3);channel([[60,28],[58,34],[49,38]],3);channel([[43,40],[45,46],[47,53],[43,63]],3.5);
ellipse(42,36,3.5,2.5,240); // Small wooded island, visible from both banks.
for(let i=0;i<W*H;i++)if(map.lowerTiles[i]===120)water.add(i);
function reserve(x:number,y:number,r:number){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(inside(x+dx,y+dy))protectedCells.add((y+dy)*W+x+dx);}
function road(points:number[][],r=1){for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j],steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let k=0;k<=steps;k++){const x=Math.round(ax+(bx-ax)*k/steps),y=Math.round(ay+(by-ay)*k/steps);reserve(x,y,r+1);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(at(x+dx,y+dy)===240)set(x+dx,y+dy,67);}}}
road([[3,55],[11,51],[15,45],[12,38],[15,29],[21,27],[34,27],[39,24],[47,25],[52,29],[67,29],[72,36],[69,45],[60,50],[52,51],[38,51],[31,54],[20,55],[11,51]]);
road([[15,45],[21,45],[24,42]],1);
road([[15,29],[9,25],[8,20],[8,3],[16,3]],1);
road([[69,45],[75,49],[77,55]],1);
for(let x=7;x<=9;x++)for(let y=top[x]-1;y<=bottom[x]+1;y++){set(x,y,374);reserve(x,y,2);}
// Bridge spans include both shore tiles; two rows reproduce the reference's timber deck.
for(const [x0,x1,y]of [[19,33,27],[52,66,29],[39,52,51]]){bridges.push({x0,x1,y});for(let x=x0-1;x<=x1+1;x++)for(let dy=-1;dy<=2;dy++)reserve(x,y+dy,1);}
// Irregular grass patches add depth to the wooded banks without occupying paths.
for(const [x,y,rx,ry]of [[6,34,5,9],[7,60,8,4],[25,59,9,4],[69,59,9,4],[76,34,5,8],[58,43,5,3],[48,6,9,4],[17,39,4,3]]){
 const old=[...map.lowerTiles];ellipse(x,y,rx,ry,304);for(let i=0;i<W*H;i++)if(old[i]!==240||protectedCells.has(i))map.lowerTiles[i]=old[i];
}
reserve(22,44,4);
let state=20260914;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
let treeCount=0;const treeAnchors:number[][]=[];
function tree(x:number,y:number){if(!inside(x+1,y+1))return false;const cells=[y*W+x,y*W+x+1,(y+1)*W+x,(y+1)*W+x+1];if(cells.some(i=>![240,304].includes(map.lowerTiles[i])||map.upperTiles[i]!==-1||protectedCells.has(i)))return false;[318,319,348,349].forEach((t,j)=>map.upperTiles[cells[j]]=t);treeCount++;treeAnchors.push([x,y]);return true;}
const woods=[[3,38,8,16],[8,60,14,5],[25,61,12,5],[61,60,17,5],[77,44,7,18],[67,40,7,6],[52,5,10,5],[15,4,6,4],[72,5,8,5],[18,36,5,5],[55,44,6,3]];
for(let n=0;n<3200;n++){const [cx,cy,rx,ry]=woods[Math.floor(random()*woods.length)];const angle=random()*Math.PI*2,r=Math.sqrt(random());tree(Math.round(cx+Math.cos(angle)*rx*r),Math.round(cy+Math.sin(angle)*ry*r));}
for(const [x,y]of [[41,34],[35,21],[46,21],[33,44],[19,21],[63,21],[56,36],[20,49],[33,58],[59,55]])tree(x,y);
function prop(x:number,y:number,tiles:number[],authored=false){if(!inside(x,y+tiles.length-1))return;const cells=tiles.map((_,j)=>(y+j)*W+x);if(cells.some(i=>![240,304,67].includes(map.lowerTiles[i])||map.upperTiles[i]!==-1||(!authored&&protectedCells.has(i))))return;tiles.forEach((t,j)=>map.upperTiles[cells[j]]=t);}
for(const b of bridges)for(const [x,y]of [[b.x0-1,b.y-3],[b.x1+1,b.y-3],[b.x0-1,b.y+3],[b.x1+1,b.y+3]])prop(x,y,[89,119],true);
for(const [x,y]of [[19,41],[25,40],[26,46],[18,47]])prop(x,y,[89,119],true);
for(let n=0;n<100;n++)prop(Math.floor(random()*W),Math.floor(random()*H),[random()<.6?57:59]);
for(const [cx,cy]of [[17,25],[34,24],[48,27],[68,34],[63,47],[35,49],[23,51],[10,29],[17,6],[55,8]])for(let j=0;j<8;j++)prop(cx+Math.floor(random()*7)-3,cy+Math.floor(random()*5)-2,[288]);
// Bake the engine's exact native 8x8 edge grammar into an editable uploaded atlas.
const original=PNG.sync.read(fs.readFileSync('public/assets/easyrpg-chipset-world-transparent.png'));
const recipes:{sources:any[],solid:boolean}[]=[],recipeIndex=new Map<string,number>();
const semantic=[...map.lowerTiles];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=y*W+x,t=semantic[i],composition=chipsetQuarterComposition({...map,lowerTiles:semantic},base,x,y);
 if(!composition)continue;
 if(composition.sources.every(s=>s.tile===t))continue;
 const key=JSON.stringify(composition.sources);let tile=recipeIndex.get(key);if(tile===undefined){tile=480+recipes.length;recipeIndex.set(key,tile);recipes.push({sources:[...composition.sources],solid:water.has(i)});}map.lowerTiles[i]=tile;
}
const waterfallBase=Math.ceil((480+recipes.length)/30)*30,count=waterfallBase+30;
const atlas=new PNG({width:480,height:count/30*16});
function copy(tile:number,sx:number,sy:number,target:number,dx:number,dy:number,size:number){for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=((Math.floor(tile/30)*16+sy+y)*480+tile%30*16+sx+x)*4,b=((Math.floor(target/30)*16+dy+y)*480+target%30*16+dx+x)*4;for(let c=0;c<4;c++)atlas.data[b+c]=original.data[a+c];if(original.data[a]===255&&original.data[a+1]===103&&original.data[a+2]===139)atlas.data[b+3]=0;}}
for(let t=0;t<480;t++)copy(t,0,0,t,0,0,16);
recipes.forEach((r,j)=>r.sources.forEach(s=>copy(s.tile,s.offsetX,s.offsetY,480+j,s.offsetX,s.offsetY,8)));
[123,153,183,213].forEach((t,j)=>copy(t,0,0,waterfallBase+j,0,0,16));
for(const i of falls)map.lowerTiles[i]=waterfallBase;
for(const b of bridges)for(let x=b.x0;x<=b.x1;x++){map.lowerTiles[b.y*W+x]=102;map.lowerTiles[(b.y+1)*W+x]=103;map.upperTiles[b.y*W+x]=map.upperTiles[(b.y+1)*W+x]=-1;}
const ts=structuredClone(before.tilesets.tileset_twinfalls_reference_20260914);ts.id=tsId;ts.name='비취 대계곡 · 물가와 숲길';ts.image={type:'uploaded',id:assetId};ts.count=count;ts.tileGrafts=[];
const cliff=new Set([18,19,48,49,78,79,138,139,140,171,172,173,201,202,203,231,232]);
const solid=(t:number)=>t>=waterfallBase&&t<waterfallBase+4||t>=480&&t<480+recipes.length&&recipes[t-480].solid||cliff.has(t)||[0,30,60,90,120,121,122,57,59,89,119,348,349].includes(t);
ts.passability=Array.from({length:count},(_,t)=>({up:!solid(t),down:!solid(t),left:!solid(t),right:!solid(t)}));ts.priority=Array.from({length:count},(_,t)=>[318,319,288].includes(t)?'upper':'lower');ts.terrain=Array(count).fill(0);ts.autotileGroups=[];ts.animationStrips=[{baseTile:waterfallBase,frames:4,fps:4},{baseTile:120,frames:3,fps:3}];
ts.tileMeta=Array.from({length:count},(_,t)=>({source:'user',userLocked:true,defaultLayer:[318,319,288].includes(t)?'upper':'lower',passage:solid(t)?'solid':[318,319,288].includes(t)?'star':'passable',description:t<480?`World 원본 ${t}`:t<480+recipes.length?'물가·흙길·풀의 8×8 경계 조합':'폭포 애니메이션'}));
const bytes=PNG.sync.write(atlas);project.tilesets[tsId]=ts;project.assets.uploaded[assetId]={id:assetId,name:'비취 대계곡 팔레트',kind:'tileset',dataUrl:`data:image/png;base64,${bytes.toString('base64')}`,meta:{width:480,height:atlas.height}};
map.layoutPlan={version:1,kind:'reference-authored-wide-field',regions:[],notes:'쌍폭포 원본 문법. 북쪽 삼폭포·서쪽 고지대 계단·중앙 섬 호수·세 나무다리·남쪽 순환 숲길·서쪽 입석 쉼터. 80×64. 시작점 (3,55).'};
if(!before.maps[id])project.mapTree.children.push({mapId:id,children:[]});
const normalized=deserialize(serialize(project)),savedMap=normalized.maps[id],reachable=computeReachableCells(normalized,savedMap,3,55);
const landmarks=[['west-entry',3,55],['old-stones',21,45],['west-bridge',26,27],['north-lakeshore',41,24],['east-bridge',60,29],['east-woods',72,36],['south-bridge',46,51],['highland-lookout',16,3]] as const;
for(const [x,y]of treeAnchors)assert.deepEqual([savedMap.upperTiles[y*W+x],savedMap.upperTiles[y*W+x+1],savedMap.upperTiles[(y+1)*W+x],savedMap.upperTiles[(y+1)*W+x+1]],[318,319,348,349],'Complete tree footprint');
for(const b of bridges){const x=Math.floor((b.x0+b.x1)/2);assert.ok(canMove(normalized,savedMap,x,b.y,x+1,b.y),'Bridge crossing');assert.equal(canMove(normalized,savedMap,x,b.y+1,x,b.y+2),false,'Bridge must not allow a step into water');}
for(const [name,x,y]of landmarks)assert.ok(reachable.has(`${x},${y}`),`Unreachable ${name} (${x},${y})`);
for(const [key,m]of Object.entries(before.maps))if(key!==id)assert.deepEqual(normalized.maps[key],m,`Existing map changed ${key}`);
assert.equal(normalized.startMapId,before.startMapId);assert.deepEqual(normalized.startPos,before.startPos);
fs.writeFileSync(`${out}/preview-project.json`,serialize(normalized));fs.writeFileSync(`${out}/atlas.png`,bytes);fs.writeFileSync(`${out}/landmarks.json`,JSON.stringify(landmarks));
const checks={projectId:config.projectId,mapId:id,width:W,height:H,treeCount,quarterVariants:recipes.length,bridges:bridges.length,reachableCells:reachable.size,landmarks:landmarks.length,existingMapsPreserved:true,startPositionPreserved:true};fs.writeFileSync(`${out}/checks.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
if(process.argv.includes('--apply')){const saved=await saveProjectToSupabase(normalized,config,authority);assert.equal(saved.kind,'saved',JSON.stringify(saved));const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);assert.equal(serializeForComparison(reloaded),serializeForComparison(normalized));fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify({...checks,saved:true,reloaded:true,sha256:saved.sha256},null,2));console.log('Saved and reloaded successfully');}
