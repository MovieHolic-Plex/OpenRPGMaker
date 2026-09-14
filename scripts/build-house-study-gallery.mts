/** Add a new house study map and reusable sections to the configured project.
 * Preview first; --apply uses the application save path and verifies a remote reload.
 * Existing maps, start position and project identity are preserved.
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { serialize } from "../src/project/io";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
import { DEFAULT_TILESET_ID } from "../src/project/defaults/constants";
import { HOUSE_STUDIES, REMOVED_HOUSE_STUDIES, houseStudyNumber, bakeHouseStudy } from "./lib/houseStudyDesigns.mts";
import { runTool } from "../src/editor/tools/toolRunner";
import { houseObjectForGraphic } from "./lib/houseSpatialCatalog.mts";
import type { ProjectWriteAuthority } from "../src/project/spatial/saveRouting";

const out="output/evidence/house-studies";
fs.mkdirSync(out,{recursive:true});
const config=await configFromEnv();
assert.ok(config.projectId,"A configured project id is required");
let authority: ProjectWriteAuthority | undefined;
const base=await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(base,"Supabase project must be available before authoring");
const next=structuredClone(base);
const tileset=next.tilesets[DEFAULT_TILESET_ID];
assert.ok(tileset,"Combined Town materials missing");
const map=createBlankMap(`집 외형 연구 · ${HOUSE_STUDIES.length}채`,64,76,tileset.id,tileset.tileSize);
map.id="map_house_studies_20260912";
assert.ok(!base.maps[map.id] || process.argv.includes("--replace-study"),"Study map exists; explicit --replace-study required");
next.maps[map.id]=map;
const placements: { id:string;number:number;name:string;note:string;x:number;y:number;width:number;height:number }[]=[];
const kits=HOUSE_STUDIES.map(bakeHouseStudy);
// This revision only removes 08 and rebuilds 11/12. Keep the reviewed nine intact.
const unchangedKits=kits.filter(kit=>!["house-study-inn","house-study-workshop"].includes(kit.id));
if(base.maps[map.id])for(const kit of unchangedKits) {
  const old=base.tilesets[tileset.id]!.structureKits?.find(entry=>entry.id===kit.id);
  assert.deepEqual(kit,old,`${kit.id}: unrelated study changed`);
}
const forbidden=new Set([196,197,226,227,256,257]);
const roofTiles=new Set([354,355,356,357,374,376,377,384,385,386,387,404,405,406,407,467]);
for(const kit of kits) {
  const roof=new Set<string>();
  kit.rows.forEach((row,y)=>row.tiles.forEach((tile,x)=>{
    const layers=[tile,row.upperTiles?.[x] ?? -1];
    assert.ok(layers.every(value=>!forbidden.has(value)),`${kit.id}: excluded material`);
    if(layers.some(value=>roofTiles.has(value)))roof.add(`${x},${y}`);
  }));
  assert.ok(roof.size>0,`${kit.id}: roof missing`);
  const reached=new Set<string>(),queue=[roof.values().next().value!];
  while(queue.length) {
    const key=queue.pop()!;if(reached.has(key))continue;reached.add(key);
    const [x,y]=key.split(",").map(Number);
    for(const next of [`${x!+1},${y}`,`${x!-1},${y}`,`${x},${y!+1}`,`${x},${y!-1}`])if(roof.has(next)&&!reached.has(next))queue.push(next);
  }
  assert.equal(reached.size,roof.size,`${kit.id}: disconnected roofs`);
}
for(const [i,kit] of kits.entries()) {
  const number=houseStudyNumber(HOUSE_STUDIES[i]!.id),slot=number-1;
  const x=2+(slot%3)*20+Math.floor((20-kit.width)/2);
  const y=2+Math.floor(slot/3)*18+14-kit.height;
  placements.push({id:kit.id,number,name:kit.name!,note:HOUSE_STUDIES[i]!.note,x,y,width:kit.width,height:kit.height});
  // Only the study's own cells are painted; no old map is touched.
  kit.rows.forEach((row,dy)=>row.tiles.forEach((tile,dx)=>{
    const at=(y+dy)*map.width+x+dx;
    if(tile>=0) map.lowerTiles[at]=tile;
    const upper=row.upperTiles?.[dx] ?? -1;
    if(upper>=0) map.upperTiles[at]=upper;
  }));
  for(const door of HOUSE_STUDIES[i]!.doors) {
    const approach=(y+door.y+1)*map.width+x+door.x;
    assert.equal(map.upperTiles[approach],-1,`${kit.id}: door approach obstructed`);
    assert.equal(map.lowerTiles[approach],map.lowerTiles[0],`${kit.id}: door approach needs ground`);
  }
}
tileset.structureKits=[...(tileset.structureKits ?? []).filter(kit=>!kits.some(study=>study.id===kit.id)&&!REMOVED_HOUSE_STUDIES.includes(kit.id)),...kits];
if(!next.mapTree.children.some(node=>node.mapId===map.id)) next.mapTree.children.push({mapId:map.id,children:[]});

// Canonical object references are added only if this project already opted into spatial authoring.
const ctx={project:next};
if(next.spatialAuthoring) for(const [i,kit] of kits.entries()) {
  const previous=houseObjectForGraphic(ctx.project,tileset.id,kit.id);
  // Existing catalog metadata/anchor identities belong to its author, not this raster writer.
  if(previous) continue;
  const id=kit.id;
  const result=runTool(ctx,"upsert_spatial_design",{kind:"object",expectedRevision:0,
    object:{id,name:kit.name,revision:1,tags:kit.ai!.tags,provenance:{origin:"ai"},
      graphic:{tilesetId:tileset.id,kitId:kit.id},chips:["block"],
      anchors:HOUSE_STUDIES[i]!.doors.map((door,j)=>({id:`${id}-entrance-${j}`,name:"출입구 앞",x:door.x,y:door.y+1}))}});
  assert.ok(result.ok,JSON.stringify(result));
}
const project=ctx.project;
fs.writeFileSync(`${out}/preview-project.json`,serialize(project));
fs.writeFileSync(`${out}/studies.json`,JSON.stringify({mapId:map.id,placements,kits},null,2));
console.log(JSON.stringify({projectId:config.projectId,mapId:map.id,houses:kits.length,spatialActive:!!project.spatialAuthoring,mode:"preview"}));

if(process.argv.includes("--apply")) {
  assert.deepEqual(await loadProjectFromSupabase(config),base,"Project changed during build; refusing to overwrite concurrent edits");
  fs.writeFileSync(`${out}/before.json`,serialize(base));
  const saved=await saveProjectToSupabase(project,config,authority);
  assert.equal(saved.kind,"saved",JSON.stringify(saved));
  const loaded=await loadProjectFromSupabase(config);
  assert.ok(loaded);
  assert.deepEqual(loaded.maps[map.id],project.maps[map.id]);
  for(const [id,old] of Object.entries(base.maps)) if(id!==map.id) assert.deepEqual(loaded.maps[id],old);
  assert.equal(loaded.startMapId,base.startMapId);
  assert.deepEqual(loaded.startPos,base.startPos);
  for(const kit of kits) assert.deepEqual(loaded.tilesets[tileset.id]!.structureKits?.find(k=>k.id===kit.id),kit);
  for(const id of REMOVED_HOUSE_STUDIES) assert.ok(!loaded.tilesets[tileset.id]!.structureKits?.some(k=>k.id===id));
  if(base.maps[map.id])for(const item of placements.filter(item=>item.number!==11&&item.number!==12)) {
    for(let dy=0;dy<item.height;dy++)for(let dx=0;dx<item.width;dx++) {
      const index=(item.y+dy)*map.width+item.x+dx;
      assert.equal(loaded.maps[map.id]!.lowerTiles[index],base.maps[map.id]!.lowerTiles[index]);
      assert.equal(loaded.maps[map.id]!.upperTiles[index],base.maps[map.id]!.upperTiles[index]);
    }
  }
  fs.writeFileSync(`${out}/reloaded-project.json`,serialize(loaded));
  const proof={projectId:config.projectId,mapId:map.id,saved:true,reloaded:true,houses:kits.length,
    oldMapsPreserved:true,spatialActive:!!loaded.spatialAuthoring,connectedRoofs:kits.length,excludedTileUses:0,
    removed:REMOVED_HOUSE_STUDIES,
    unchangedStudies:unchangedKits.length,
    reference:{projectId:"oprn-343607fd0e",mapId:"map_blank_start",rect:{x:25,y:20,width:13,height:12},readOnly:true},
    mapSha256:createHash("sha256").update(JSON.stringify(loaded.maps[map.id])).digest("hex"),verifiedAt:new Date().toISOString()};
  fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
}
