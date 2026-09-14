import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase,saveProjectToSupabase,type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize } from "../src/project/io";
import { runTool } from "../src/editor/tools/toolRunner";
import { authorHouse30 } from "./lib/house30Authoring.mts";
import { HOUSE30_TAG,type House30Entry } from "./lib/house30Contract.mts";
const flag=process.argv.indexOf("--batch"), batch=flag>=0?process.argv[flag+1]:"all";
assert.ok(["a","b","c","all"].includes(batch!));
const config=await configFromEnv();
assert.equal(config.projectId,batch==="all"?"rpg-zzu-house-template-gallery":`rpg-zzu-house-30-${batch}-20260912`,"Wrong publication target");
let authority:ProjectWriteAuthority|undefined;
const before=await loadProjectFromSupabase(config,value=>{authority=value;});
assert.ok(before?.spatialAuthoring && authority,"Supabase canonical connection required before authoring");
const entries:House30Entry[]=[];
for(const key of batch==="all"?["A","B","C"]:[batch!.toUpperCase()]) {
  const source=await import(`./lib/house30Batch${key}.mts`);
  const built=source[`buildHouse30Batch${key}`]();
  assert.equal(built.length,10); entries.push(...built);
}
entries.sort((a,b)=>a.number-b.number);
const result=authorHouse30(before,entries), next=result.project;
assert.deepEqual(authorHouse30(next,entries).project,next,"Repeated registration must be idempotent");
const ownedMaps=new Set(result.placements.map(p=>p.mapId));
for(const [id,map] of Object.entries(before.maps)) if(!ownedMaps.has(id)) assert.deepEqual(next.maps[id],map,`Unrelated map ${id}`);
assert.deepEqual(next.startPos,before.startPos); assert.equal(next.startMapId,before.startMapId);
const objects=Object.values(next.spatialAuthoring!.library.objects).filter(o=>o.tags.includes(HOUSE30_TAG));
assert.equal(objects.length,entries.length);
const out=`output/evidence/house-30/${batch}`;fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/preview-project.json`,serialize(next));
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({batch,projectId:config.projectId,placements:result.placements,checks:result.checks},null,2));
const query=runTool({project:next},"list_spatial_designs",{kind:"object",query:HOUSE30_TAG});
assert.ok(query.ok,JSON.stringify(query));
console.log(JSON.stringify({batch,projectId:config.projectId,houses:entries.length,checked:true,mode:"preview"}));
if(process.argv.includes("--apply")) {
  fs.writeFileSync(`${out}/before.json`,serialize(before));
  const saved=await saveProjectToSupabase(next,config,authority); assert.equal(saved.kind,"saved");
  const loaded=await loadProjectFromSupabase(config);assert.deepEqual(loaded,next,"Full Supabase reload mismatch");
  fs.writeFileSync(`${out}/reloaded-project.json`,serialize(loaded!));
  const proof={projectId:config.projectId,batch,houses:entries.length,saved:true,reloaded:true,mirror:saved.mirror?.status,
    oldMapsPreserved:true,oldStartPreserved:true,objects:objects.map(o=>o.id),maps:[...ownedMaps],
    connectedRoofs:entries.length,excludedTileUses:0,idempotent:true,
    librarySHA256:createHash("sha256").update(JSON.stringify(loaded!.spatialAuthoring!.library)).digest("hex"),verifiedAt:new Date().toISOString()};
  fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify(proof,null,2)); console.log(JSON.stringify(proof));
}
