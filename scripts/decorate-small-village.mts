import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase, type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { registerVillageDecorationCatalog } from "./lib/villageDecorationCatalog.mts";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import "../src/editor/tools/village/builder";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { computeReachableCells } from "../src/project/lint/reachability";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
const out="output/evidence/village-decoration";
fs.mkdirSync(out,{recursive:true});
const config=await configFromEnv();assert.equal(config.projectId,"rpg-zzu-house-template-gallery");
let authority:ProjectWriteAuthority|undefined;
const before=await loadProjectFromSupabase(config,a=>{authority=a;});assert.ok(before?.spatialAuthoring&&authority);
const draft=structuredClone(before);
const rules=registerVillageDecorationCatalog(draft);
const preset=draft.villagePresets!.find(p=>p.id==="small-village-dense")!;
assert.ok(preset.design?.objectVillage);
preset.design.objectVillage.decorations=rules;preset.design.revision++;
const next=compileSpatialOccurrence(draft,{occurrenceId:"small-village:example:20260913"});
const mapId="spatial-geography:30:small-village:example:20260913",map=next.maps[mapId]!;
const houses=map.layoutPlan!.regions.filter(r=>r.objectExterior);
assert.equal(houses.length,26);assert.equal(houses.filter(r=>r.tags?.includes("exterior-stories:1")).length,23);
assert.deepEqual(houses.map(h=>({id:h.id,x:h.x,y:h.y,w:h.w,h:h.h,object:h.objectExterior!.objectId})),before.maps[mapId]!.layoutPlan!.regions.filter(r=>r.objectExterior).map(h=>({id:h.id,x:h.x,y:h.y,w:h.w,h:h.h,object:h.objectExterior!.objectId})));
for(const h of houses)for(const c of snapshotGraphic(next,next.spatialAuthoring!.library.objects[h.objectExterior!.objectId]!.graphic).cells)assert.equal((c.layer==="lower"?map.lowerTiles:map.upperTiles)[(h.y+c.y)*map.width+h.x+c.x],c.tile);
const decorations=map.layoutPlan!.regions.filter(r=>r.tags?.includes("village-decoration"));
const reachable=computeReachableCells(next,map,next.startPos.x,next.startPos.y);
for(const r of map.layoutPlan!.regions){for(const p of [...(r.objectExterior?.doorApproaches??[]),...(r.front?[r.front]:[])])assert.ok(reachable.has(`${p.x},${p.y}`),`unreachable ${r.id}`);}
for(const [id,m] of Object.entries(before.maps))if(id!==mapId && id!=="map_village_decoration_catalog")assert.deepEqual(next.maps[id],m);
const gallery=createBlankMap("마을 생활 공간 · 20종",40,40,map.tilesetId,map.tileSize);gallery.id="map_village_decoration_catalog";
const cards=rules.map((r,i)=>{
 const space=next.spatialAuthoring!.library.spaces[r.spaceId]!;const x=2+(i%4)*10,y=2+Math.floor(i/4)*8;
 for(const slot of space.objectSlots){assert.equal(slot.placement.mode,"fixed");if(slot.placement.mode!=="fixed")continue;for(const c of snapshotGraphic(next,next.spatialAuthoring!.library.objects[slot.objectDesignId]!.graphic).cells)(c.layer==="lower"?gallery.lowerTiles:gallery.upperTiles)[(y+slot.placement.y+c.y)*gallery.width+x+slot.placement.x+c.x]=c.tile;}
 return {name:space.name,x,y,width:space.width,height:space.height,zone:r.zone,maxCount:r.maxCount};
});
next.maps[gallery.id]=gallery;if(!next.mapTree.children.some(n=>n.mapId===gallery.id))next.mapTree.children.push({mapId:gallery.id,children:[]});
const counts=Object.fromEntries(["house","commons","market","shore","road"].map(zone=>[zone,decorations.filter(r=>r.tags?.includes(`zone:${zone}`)).length]));
const proof={projectId:config.projectId,mapId,houses:26,singleStorey:23,multiStorey:3,houseRastersPreserved:true,housePositionsPreserved:true,spaces:rules.length,counts,placements:decorations.map(r=>({label:r.label,x:r.x,y:r.y,tags:r.tags})),allDestinationsReachable:true,unrelatedMapsPreserved:true};
fs.writeFileSync(`${out}/preview-project.json`,serialize(next));fs.writeFileSync(`${out}/build-proof.json`,JSON.stringify(proof,null,2));fs.writeFileSync(`${out}/cards.json`,JSON.stringify(cards,null,2));console.log(JSON.stringify(proof));
if(process.argv.includes("--apply")){
 for(const zone of Object.keys(counts))assert.ok(counts[zone]!>0,`missing ${zone}`);
 assert.ok(counts.house!>=20,"at least 20 houses require authored yards");
 const saved=await saveProjectToSupabase(next,config,authority);assert.equal(saved.kind,"saved");
 const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);assert.equal(serializeForComparison(reloaded),serializeForComparison(next));
 fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify({...proof,saved:true,reloaded:true,canonicalSHA256:saved.sha256},null,2));
 console.log(JSON.stringify({saved:true,reloaded:true,projectId:config.projectId}));
}
