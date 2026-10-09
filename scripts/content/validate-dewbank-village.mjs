// Read-only comparison against the approved 88×60 reference, not a generic forest detector.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const root=new URL('../../tiledata/tilesets/forest_harmony/dewbank-village/',import.meta.url);
export const sample=JSON.parse(fs.readFileSync(new URL('sample.json',root)));
const parts=JSON.parse(fs.readFileSync(new URL('parts.json',root)));
const roots=new Set([1430,1431,1432,1433,1461,1462,1463]);
const trunks=new Set([1422,1423,1424,1425,1350,1426,1427,1428,1429,1453,1454,1455,1457,1458,1459]);
const canopy=new Set(sample.tileset.autotileGroups.find(g=>g.id==='forest_harmony_grove_47').memberTileIds);
const binding=(t,id)=>t.tileGrafts?.find(g=>g.targetTile===id)??null;
export async function validateDewbank(project,mapId='dewbank_village') {
 const m=project.maps?.[mapId], expected=sample.map, errors=[];let totalErrors=0;
 const add=(code,x,y,extra={})=>{totalErrors++;if(errors.length<128)errors.push({code,x,y,...extra});};
 if(!m||m.width!==88||m.height!==60)return{valid:false,totalErrors:1,errors:[{code:'reference-size-mismatch',mapId,expected:[88,60]}]};
 const t=project.tilesets?.[m.tilesetId];
 if(!t||t.image.type!=='bundled'||t.image.id!==sample.tileset.image.id||t.tilesPerRow!==30||t.tileSize!==16)
  return{valid:false,totalErrors:1,errors:[{code:'reference-tileset-mismatch',mapId}]};
 if(m.lowerTiles?.length!==5280||m.upperTiles?.length!==5280)return{valid:false,totalErrors:1,errors:[{code:'reference-array-length',mapId}]};
 const badBindings=new Set(parts.usedTiles.filter(c=>!isDeepStrictEqual(binding(t,c.tile),binding(sample.tileset,c.tile))).map(c=>c.tile));
 for(let i=0;i<5280;i++)for(const layer of ['lower','upper']){
  const want=expected[layer+'Tiles'][i],actual=m[layer+'Tiles'][i],x=i%88,y=Math.floor(i/88);
  if(badBindings.has(want))add('source-binding-mismatch',x,y,{layer,tile:want});
  if(want!==actual){const other=m[(layer==='lower'?'upper':'lower')+'Tiles'][i];
   const code=want>=0&&other===want?'wrong-layer':layer==='lower'&&roots.has(want)?'cut-root':layer==='lower'&&trunks.has(want)?'missing-trunk':layer==='upper'&&canopy.has(want)?'wrong-edge-direction':'tile-mismatch';
   add(code,x,y,{layer,expected:want,actual});
  }
  if(m[layer+'TileStacks']?.[i]?.length)add('unexpected-stack',x,y,{layer});
 }
 await withTsModule('src/project/lint/reachability.ts','dewbank-reachability.mjs',api=>{
  const seen=api.computeReachableCells(project,m,sample.startPos.x,sample.startPos.y);
  for(const h of expected.layoutPlan.regions.filter(r=>r.role==='house'))if(!seen.has(h.front.x+','+h.front.y))add('blocked-entrance',h.front.x,h.front.y,{houseId:h.id,door:h.doorAt});
  for(const o of parts.placements){if(o.name==='벽걸이 등불')continue;
   const reachable=Array.from({length:o.w*o.h},(_,i)=>({x:o.x+i%o.w,y:o.y+Math.floor(i/o.w)})).some(p=>api.isAdjacentOrOn(seen,p.x,p.y));
   if(!reachable)add('inaccessible-object',o.x,o.y,{name:o.name});
  }
 });
 return{valid:totalErrors===0,reference:sample.id,mapId,totalErrors,truncated:totalErrors>errors.length,errors,scope:'Exact approved arrays and source bindings; engine tile reachability from (36,30). Events and aesthetic quality are not evaluated.'};
}
export function faultExamples(){
 const m=sample.map;const at=(tile,layer)=>{const i=m[layer+'Tiles'].findIndex((id,i)=>id===tile&&Math.floor(i/88)>8&&Math.floor(i/88)<54&&i%88>5&&i%88<82);if(i<0)throw Error('Missing example tile');return{x:i%88,y:Math.floor(i/88),layer,tile};};
 // Opposite left/right upper edge, with a visibly exposed right boundary.
 const edge=at(2555,'upper');
 return[
  {id:'cut-root',...at(1430,'lower'),replacement:240},
  {id:'missing-trunk',...at(1426,'lower'),replacement:240},
  {id:'wrong-edge-direction',...edge,replacement:2552},
  {id:'wrong-layer',...at(2639,'upper'),replacement:-1,moveToOtherLayer:true},
  {id:'blocked-entrance',x:35,y:11,layer:'upper',tile:m.upperTiles[11*88+35],replacement:237},
 ];
}
export function applyFault(p,f){const m=p.maps.dewbank_village,i=f.y*88+f.x;m[f.layer+'Tiles'][i]=f.replacement;if(f.moveToOtherLayer)m[(f.layer==='upper'?'lower':'upper')+'Tiles'][i]=f.tile;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,mapId]=process.argv.slice(2);if(!input)throw Error('Usage: node scripts/content/validate-dewbank-village.mjs <exported-project.json> [mapId]');
 const result=await validateDewbank(JSON.parse(fs.readFileSync(input)),mapId);console.log(JSON.stringify(result,null,2));if(!result.valid)process.exitCode=1;
}
