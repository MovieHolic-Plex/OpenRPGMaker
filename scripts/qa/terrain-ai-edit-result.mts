// Compare a real assistant's saved result with the three requested production edits.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openLocalProjectStore } from '../../electron/local-store/store';
import { runTool } from '../../src/editor/tools';
const arg=(n:string,f:string)=>{const i=process.argv.indexOf(`--${n}`);return i<0?f:process.argv[i+1]!;};
const baseline=JSON.parse(fs.readFileSync(arg('baseline','verify-shots/terrain-ai-edit/contracts/project.json'),'utf8'));
const out=path.resolve(arg('out','verify-shots/terrain-ai-edit/live-fixed'));
const store=await openLocalProjectStore({projectDir:path.resolve(arg('project','.vite-cache/terrain-ai-edit/project'))});
const saved=store.loadSnapshot()!,projectId=store.info().projectId;store.close();
const mapId='houses_native', before=baseline.maps[mapId], after=saved.project.maps[mapId];
const ridge=before.terrainDesign.features.find((f:any)=>f.tool==='ridge');
const road=before.terrainDesign.features.find((f:any)=>f.tool==='road'&&f.points[0].x===24&&f.points[0].y===54);
const house=before.structurePlacements.find((p:any)=>p.kitId.startsWith('quick_house_'));
const ctx={project:baseline};
for(const [name,args] of [
 ['design_terrain',{mapId,editId:ridge.id,width:7}],
 ['resize_terrain_house_roof',{mapId,placementId:house.id,roofWidth:15}],
 ['lay_terrain_road',{mapId,editId:road.id,width:3}],
] as const){const r=runTool(ctx,name,args);assert(r.ok,`${name}: ${r.summary}`);}
fs.writeFileSync(path.join(out,'expected-map.json'),JSON.stringify(ctx.project.maps[mapId]));
// The production stamper records the real time of each roof operation.
ctx.project.maps[mapId].structurePlacements.find((p:any)=>p.id===house.id).stampedAt=after.structurePlacements.find((p:any)=>p.id===house.id).stampedAt;
assert.deepEqual(after,JSON.parse(JSON.stringify(ctx.project.maps[mapId])),'Real model changed more or less than the three requested edits');
for(const id of Object.keys(baseline.maps).filter(id=>id!==mapId))assert.equal(JSON.stringify(saved.project.maps[id]),JSON.stringify(baseline.maps[id]));
const inspection=runTool({project:saved.project},'inspect_terrain',{mapId,includeCatalog:false}).data as any;
assert.equal(inspection.houses.length,4);assert(inspection.houses.every((h:any)=>h.flat));assert.equal(inspection.gameplay.visionBlocking,false);
assert.deepEqual(after.relief.ramps,before.relief.ramps);assert.deepEqual(after.terrainDesign.lockedCells,before.terrainDesign.lockedCells);
const access=runTool({project:saved.project},'check_terrain_access',{mapId,from:{x:4,y:58},targets:inspection.houses.map((h:any)=>h.doorFront)}).data as any;
assert(access.reachable);
const trace=JSON.parse(fs.readFileSync(path.join(out,'trace.json'),'utf8'));
const lastWrite=Math.max(...trace.map((t:any,i:number)=>['design_terrain','resize_terrain_house_roof','lay_terrain_road'].includes(t.name)?i:-1));
assert(trace.slice(lastWrite+1).some((t:any)=>t.name==='check_terrain_access'&&t.ok));
assert(trace.slice(lastWrite+1).some((t:any)=>t.name==='show_map_region'&&t.ok));
assert(trace.every((t:any)=>t.ok),'Real model encountered a tool error');
const proof={projectId,revision:saved.revision,canonicalReload:true,requestedEdits:3,completedEdits:3,
 exactRequestedMap:true,unrelatedMapsUnchanged:true,originalRampsUnchanged:true,lockedCellsUnchanged:true,
 houses:inspection.houses.map((h:any)=>({id:h.placementId,kit:h.kitId,flat:h.flat,doorFront:h.doorFront,level:h.level})),
 actualAccess:access,inspectionAfterLastWrite:true,mapSha256:createHash('sha256').update(JSON.stringify(after)).digest('hex')};
fs.writeFileSync(path.join(out,'verified-result.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
