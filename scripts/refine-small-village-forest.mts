/** Explicitly rebuild the owned example with revised forest composition; preserve its library. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase, type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import "../src/editor/tools/village/builder";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { computeReachableCells } from "../src/project/lint/reachability";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { validateLayoutPlacement } from "../src/project/lint/layoutPlacementValidate";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "../src/project/tilesetHarness";
import { DEFAULT_TALL_GRASS_AUTOTILE_GROUP } from "../src/project/defaults/autotileGroups";
const out="output/evidence/village-forest";
fs.mkdirSync(out,{recursive:true});
const config=await configFromEnv();assert.equal(config.projectId,"rpg-zzu-house-template-gallery");
let authority:ProjectWriteAuthority|undefined;
const before=await loadProjectFromSupabase(config,a=>{authority=a;});assert.ok(before?.spatialAuthoring&&authority);
fs.writeFileSync(`${out}/before.json`,serialize(before));
const next=compileSpatialOccurrence(before,{occurrenceId:"small-village:example:20260913"});
const mapId="spatial-geography:30:small-village:example:20260913",map=next.maps[mapId]!;
const houses=map.layoutPlan!.regions.filter(r=>r.objectExterior);
assert.equal(houses.length,26);assert.equal(houses.filter(r=>r.tags?.includes("exterior-stories:1")).length,23);
assert.deepEqual(houses,before.maps[mapId]!.layoutPlan!.regions.filter(r=>r.objectExterior));
for(const h of houses)for(const c of snapshotGraphic(next,next.spatialAuthoring!.library.objects[h.objectExterior!.objectId]!.graphic).cells)assert.equal((c.layer==="lower"?map.lowerTiles:map.upperTiles)[(h.y+c.y)*map.width+h.x+c.x],c.tile);
const decorations=map.layoutPlan!.regions.filter(r=>r.tags?.includes("village-decoration"));
for(const zone of ["house","commons","market","shore","road"])assert.ok(decorations.some(r=>r.tags?.includes(`zone:${zone}`)));
for(const id of ["well-court","market-tent","fishing-dock"])assert.ok(decorations.some(r=>r.tags?.includes(`space:village-dressing:space:${id}`)));
const reachable=computeReachableCells(next,map,next.startPos.x,next.startPos.y);
let destinations=0;
for(const r of map.layoutPlan!.regions)for(const p of [...(r.objectExterior?.doorApproaches??[]),...(r.front?[r.front]:[])]){assert.ok(reachable.has(`${p.x},${p.y}`),`unreachable ${r.id}`);destinations++;}
assert.deepEqual(next.spatialAuthoring!.library,before.spatialAuthoring.library);
assert.deepEqual(next.villagePresets,before.villagePresets);
for(const [id,m] of Object.entries(before.maps))if(id!==mapId)assert.deepEqual(next.maps[id],m);
const measure=(m:typeof map)=>{
 const members=new Set(DEFAULT_TALL_GRASS_AUTOTILE_GROUP.memberTileIds);
 let overlaps=0,grass=0,canopies=0;
 for(let i=0;i<m.lowerTiles.length;i++){
  if(isTreeCanopyTileId(m.upperTiles[i]!)){canopies++;if(isTreeTrunkTileId(m.lowerTiles[i]!))overlaps++;}
  if(members.has(m.lowerTiles[i]!))grass++;
 }
 return {overlaps,grass,canopies};
};
const oldMetrics=measure(before.maps[mapId]!),metrics=measure(map);
const quality=[...validateClusterRules(next,mapId),...validateLayoutPlacement(next,{mapId})].filter(i=>i.severity==="error");
fs.writeFileSync(`${out}/quality.json`,JSON.stringify(quality,null,2));
const proof={projectId:config.projectId,mapId,before:oldMetrics,after:metrics,houses:26,singleStorey:23,multiStorey:3,
 decorations:decorations.length,destinations,vegetation:map.villageDesignSource!.resolvedSettings.vegetation,
 houseRastersPreserved:true,libraryPreserved:true,unrelatedMapsPreserved:true,qualityErrors:quality.length};
fs.writeFileSync(`${out}/preview-project.json`,serialize(next));fs.writeFileSync(`${out}/build-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
if(process.argv.includes("--apply")){
 assert.ok(metrics.overlaps>100);assert.ok(metrics.grass>oldMetrics.grass*1.3);assert.equal(quality.length,0);
 const saved=await saveProjectToSupabase(next,config,authority);assert.equal(saved.kind,"saved");
 const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);assert.equal(serializeForComparison(reloaded),serializeForComparison(next));
 fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify({...proof,saved:true,reloaded:true,canonicalSHA256:saved.sha256},null,2));console.log(JSON.stringify({saved:true,reloaded:true,projectId:config.projectId}));
}
