// Focused native-material rendering evidence. Local copies are render fixtures;
// the reloaded SQLite maps are never modified or saved by this script.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { createReliefGroundSurface } from "../../src/editor/reliefGroundSurface";
import { tilesetBaseImageUrl } from "../../src/editor/tilesetImage";
import { renderRelief } from "../../src/project/relief/render";
import { reliefRenderOptions } from "../../src/project/relief/screen";
import { RELIEF_STYLES } from "../../src/project/relief/styles";
import { reliefGrids, reliefImageFromRender, planReliefPatch, applyReliefPatch } from "../../src/project/relief/window";
import { renderMapPng } from "../qa-game/render.mts";
const out = path.resolve("verify-shots/terrain-body-rims/surfaces");fs.mkdirSync(out,{recursive:true});
const storage = await openLocalProjectStore({projectDir:path.resolve(".vite-cache/terrain-seams/project")});
const snapshot = storage.loadSnapshot()!,projectId=storage.info().projectId;storage.close();
// The editor registers 354 available tilesets. Keep all authored maps and runtime
// data, but give the dedicated player fixture only its referenced atlas. This is
// a separate SQLite project; the editor/source project is never rewritten.
const used=new Set(Object.values(snapshot.project.maps).map(m=>m.tilesetId));
const fixture={...snapshot.project,tilesets:Object.fromEntries(Object.entries(snapshot.project.tilesets).filter(([id])=>used.has(id)))};
const fixtureFolder=path.resolve('.vite-cache/terrain-body-rims/runtime-project');
let runtime=await initLocalProjectStore({projectDir:fixtureFolder});
const saved=await runtime.saveSerialized(JSON.stringify(fixture));if(saved.kind!=='saved')throw Error(saved.kind);
const runtimeProjectId=runtime.info().projectId;runtime.close();runtime=await openLocalProjectStore({projectDir:fixtureFolder});
const reloaded=runtime.loadSnapshot()!;runtime.close();
if(JSON.stringify(reloaded.project.maps)!==JSON.stringify(snapshot.project.maps))throw Error('Runtime fixture changed canonical scene data');
const source=path.resolve('.vite-cache/terrain-body-rims/source');fs.mkdirSync(source,{recursive:true});
fs.writeFileSync(path.join(source,'project.json'),JSON.stringify(reloaded.project));
fs.writeFileSync(path.join(source,'summary.json'),JSON.stringify({projectId:runtimeProjectId,revision:reloaded.revision,storage:fixtureFolder,canonicalReload:true,sourceProjectId:projectId,sourceRevision:snapshot.revision,sourceMapsEqual:true,tilesetsBefore:Object.keys(snapshot.project.tilesets).length,tilesetsAfter:used.size}));
const project=snapshot.project,map=project.maps.ramps_four!,tileset=project.tilesets[map.tilesetId]!;
const url=tilesetBaseImageUrl(tileset,project),raster=PNG.sync.read(fs.readFileSync(path.resolve("public",url.replace(/^\//u,""))));
const ground=createReliefGroundSurface(map,tileset,raster),results=[];
for(const style of [undefined,...Object.keys(RELIEF_STYLES)]){
 const before={...map.relief!,style},grids=reliefGrids(before),opts=reliefRenderOptions(before,ground);
 const render=renderRelief(grids.eff,opts);
 // reliefImageFromRender shares RGBA; applyReliefPatch mutates its buffer.
 const image=reliefImageFromRender({...render,rgba:render.rgba.slice()},map.width,map.height);
 const after={...before,levels:before.levels.slice()};
 for(let y=25;y<28;y++)for(let x=5;x<8;x++)after.levels[y*map.width+x]=8;
 const next={grids:reliefGrids(after),opts:reliefRenderOptions(after,ground)},plan=planReliefPatch({grids,opts},next,image);
 if(!plan||plan==='same')throw Error(`${style??'default'}: no partial render exercised`);
 applyReliefPatch(image,next,plan);
 const full=reliefImageFromRender(renderRelief(next.grids.eff,next.opts),map.width,map.height);
 for(const key of ['rgba','owner','part'] as const){
  if(image[key].length!==full[key].length)throw Error(`${style??'default'}: ${key} length`);
  for(let i=0;i<image[key].length;i++)if(image[key][i]!==full[key][i])throw Error(`${style??'default'}: partial ${key}[${i}] ${image[key][i]} != ${full[key][i]}`);
 }
 let untouched=0,outlined=0,banks=0;const sample=new Uint8ClampedArray(4);
 for(let i=0;i<render.kind.length;i++){
  if(render.kind[i]===1&&render.height[i]===0&&render.lev[i]===0)banks++;
  if(render.kind[i]!==0||render.mpy[i]<0)continue;
  if(!ground.sample(i%render.PW,render.mpy[i],sample,0))continue;
  if(!render.edge[i]&&!render.slope[i]){
   for(let c=0;c<4;c++)if(render.rgba[i*4+c]!==sample[c])throw Error(`${style??'default'}: native ground changed outside rim at ${i}, channel ${c}: ${render.rgba[i*4+c]} vs ${sample[c]}`);
   untouched++;
  }else if(render.edge[i]&&render.rgba[i*4]<sample[0]*.6)outlined++;
 }
 if(!untouched||!outlined||!banks)throw Error(`${style??'default'}: missing actual ground, outline or rear bank`);
 results.push({style:style??'default',untouchedNativePixels:untouched,outlinedPixels:outlined,rearBankWallPixels:banks,partialMatchesFull:true});
 if([undefined,'jungle','swamp-peat','tundra-snow','castle'].includes(style)){
  const png=renderMapPng(project,{...map,relief:before});if(png.note)throw Error(png.note);
  fs.writeFileSync(path.join(out,`${style??'default'}.png`),png.png);
 }
}
const proof={projectId,revision:snapshot.revision,canonicalMapsWritten:false,results};
fs.writeFileSync(path.join(out,"observations.json"),JSON.stringify(proof,null,2));
console.log(JSON.stringify({styles:results.length,partialMatchesFull:results.every(r=>r.partialMatchesFull)}));
