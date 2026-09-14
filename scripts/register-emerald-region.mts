/** Associate the existing authored field with a region; never rewrite raster content. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {configFromEnv} from './supabase-resource-root/supabaseRest.mjs';
const root=process.env.RPG_ZZU_SOURCE_ROOT??process.cwd();
const source=(file:string)=>pathToFileURL(path.join(root,'src',file)).href;
const {loadProjectFromSupabase,saveProjectToSupabase}=await import(source('project/supabaseProjectSync.ts'));
const {serialize,deserialize,serializeForComparison}=await import(source('project/io.ts'));
const {instantiateSpatialDesign}=await import(source('project/spatial/instances.ts'));
const {checkedDocument}=await import(source('project/spatial/domain.ts'));
const config=await configFromEnv();
assert.equal(config.projectId,'rpg-zzu-house-template-gallery');
let authority;
const before=await loadProjectFromSupabase(config,value=>authority=value);
assert.ok(before&&authority&&before.spatialAuthoring,'Canonical DB connection required');
const mapId='map_field_emerald_basin_20260914',regionId='region_emerald_basin_20260914',occurrenceId='region_emerald_basin_map_20260914';
const map=before.maps[mapId];assert.ok(map);assert.equal(map.width,80);assert.equal(map.height,64);
const out='output/evidence/emerald-region';fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/before.json`,serialize(before));
const project=structuredClone(before);
if(!project.spatialAuthoring.library.regions[regionId]){
 assert.ok(!project.spatialAuthoring.occurrences[occurrenceId]);
 project.spatialAuthoring.library.regions[regionId]={id:regionId,name:'비취 대계곡',revision:1,tags:['필드','완성 맵','폭포','강','다리'],provenance:{origin:'ai',sourceId:mapId},
  terrain:{tilesetId:map.tilesetId,width:map.width,height:map.height,floor:'grass',areas:[]},places:[],routes:[],
  ports:[{id:'emerald-west',name:'서쪽 길',x:0,y:55},{id:'emerald-east',name:'동쪽 길',x:79,y:49},{id:'emerald-south',name:'남쪽 길',x:22,y:63}]};
 project.spatialAuthoring=instantiateSpatialDesign(project.spatialAuthoring,project,{source:{kind:'region',id:regionId},rootId:occurrenceId,x:0,y:0,level:0,seed:20260914,generatorVersion:'existing-map-association-v1'});
 project.spatialAuthoring=structuredClone(project.spatialAuthoring);
 const occurrence=project.spatialAuthoring.occurrences[occurrenceId];
 occurrence.bindings=[{kind:'projection',mapId,rect:{x:0,y:0,width:map.width,height:map.height},ports:occurrence.snapshot.ports.map(port=>({portId:port.id,x:port.x,y:port.y}))}];
}else{
 assert.equal(project.spatialAuthoring.occurrences[occurrenceId]?.bindings[0]?.mapId,mapId,'Existing registration differs');
}
checkedDocument(project.spatialAuthoring,project);
const normalized=deserialize(serialize(project));
assert.deepEqual(normalized.maps,before.maps);
assert.deepEqual(normalized.tilesets,before.tilesets);
assert.deepEqual(normalized.assets,before.assets);
// Entire project outside the spatial document must stay byte-for-byte equivalent.
const withoutSpatial=(value:any)=>{const copy=structuredClone(value);delete copy.spatialAuthoring;return copy;};
assert.deepEqual(withoutSpatial(normalized),withoutSpatial(before));
fs.writeFileSync(`${out}/preview-project.json`,serialize(normalized));
if(process.argv.includes('--save')){
 const saved=await saveProjectToSupabase(normalized,config,authority);assert.equal(saved.kind,'saved');
 const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);
 assert.equal(serializeForComparison(reloaded),serializeForComparison(normalized));
 fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));
 const proof={projectId:config.projectId,regionId,occurrenceId,mapId,saved:true,reloadedEqual:true,mapsUnchanged:true,mapCount:Object.keys(reloaded.maps).length,mapSHA256:createHash('sha256').update(JSON.stringify(map)).digest('hex')};
 fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}else console.log(JSON.stringify({connected:true,projectId:config.projectId,regionId,previewValidated:true,mapsUnchanged:true}));
