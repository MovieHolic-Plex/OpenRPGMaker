// Focused actual-catalog audit: independent map copies, strict-provider optional fields, new/existing SQLite reload.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readSharedContentLibrary, sharedContentFile } from '../lib/sharedContentSqlite.ts';
import { installSharedContent, ensureSharedContent, sharedContentSnapshot } from '../../src/project/sharedContent.ts';
import { createBlankProject } from '../../src/project/defaults.ts';
import { initLocalProjectStore, openLocalProjectStore } from '../../electron/local-store/store.ts';
import { prepareTool } from '../../src/editor/tools/asyncToolRunner.ts';
import { runTool } from '../../src/editor/tools/index.ts';
import { spatialReferenceImages } from '../../src/editor/tools/spatialReferenceTools.ts';
import { createPiToolset } from '../../src/ai/piAgent/toolAdapter.ts';
import { validateArgs } from '../../src/editor/tools/jsonSchema.ts';
import type { Project } from '../../src/project/types.ts';

function assert(v:unknown,m:string):asserts v {if(!v)throw Error(m);}
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const out='verify-shots/worldmap-shared-db';fs.mkdirSync(out,{recursive:true});
const existing=createBlankProject();existing.meta.title='기존 프로젝트 공용 자료 반영 확인';
const beforeMaps=sha(existing.maps);
const folder=path.join(os.homedir(),'.local/share/oprn/worldmap-shared-contract-20261004');
assert(!fs.existsSync(path.join(folder,'project.sqlite')),'Contract project exists; preserve it and select another folder');
let store=await initLocalProjectStore({projectDir:folder});assert((await store.saveProject(existing)).kind==='saved','Initial save');
const projectId=store.info().projectId;store.close();
const rows=['worldmap-human-selected','worldmap-real-joseon','worldmap-real-yucatan'].map(id=>{
  const row=readSharedContentLibrary(id);assert(row,'Missing actual shared library '+id);return [id,row.library] as const;
});
await installSharedContent({revision:sha(rows),libraries:Object.fromEntries(rows)});
store=await openLocalProjectStore({projectDir:folder});const upgraded=store.loadSnapshot()!.project as Project;
assert(ensureSharedContent(upgraded),'Existing project gains shared defaults');
assert(sha(upgraded.maps)===beforeMaps,'Shared defaults changed existing map');
assert((await store.saveProject(upgraded)).kind==='saved','Upgrade save');store.close();
store=await openLocalProjectStore({projectDir:folder});const reloaded=store.loadSnapshot()!;store.close();
assert(reloaded.project.tilesets.shared_worldmap_selected!.structureKits!.length===79,'Saved shared selected kits');
assert(sha(reloaded.project.maps)===beforeMaps,'Reload changed existing maps');
const fresh=createBlankProject();ensureSharedContent(fresh);
assert(fresh.tilesets.shared_worldmap_selected!.structureKits!.length===79,'New project shared defaults');
assert(!fresh.tilesets.shared_worldmap_real_joseon_tiles,'Example atlas must be installed on demand');
const ctx={project:fresh};
const listed=runTool(ctx,'list_spatial_designs',{kind:'place',query:'조선 팔도',limit:40});
const row=(listed.data as any).shared.rows.find((r:any)=>r.id==='shared_worldmap_real_joseon');
assert(row?.referenceRead?.kind==='region','Catalog must direct the model to the exact document owner');
const cats=runTool(ctx,'read_spatial_reference',{kind:'region',id:row.id,tilesetId:'',categoryId:'',documentId:'',imageId:'',offset:0});
assert(cats.ok&&(cats.data as any).categories.length===1,'Strict empty IDs cannot break owner listing');
const imageArgs={kind:'region',id:row.id,tilesetId:'',categoryId:'worldmap-real-joseon',documentId:'',imageId:'worldmap-real-joseon-image',offset:0};
const image=runTool(ctx,'read_spatial_reference',imageArgs);assert(image.ok,'Strict image offset 0');
assert((await spatialReferenceImages(fresh,imageArgs,image.data))[0]!.dataUrl.startsWith('data:image/png;'),'Actual owner image bytes');
const imports=[];
for(const [id,mapId]of [['shared_worldmap_real_joseon','map_joseon_copy'],['shared_worldmap_real_yucatan','map_yucatan_copy']]){
  const args={id,mapId:'',newMapId:mapId,name:'공용 지역 사본',x:0,y:0,includeEvents:false};
  await prepareTool('import_region_reference',args,ctx.project);
  const result=runTool(ctx,'import_region_reference',args);assert(result.ok,result.summary);
  const lib=rows.find(([,lib])=>lib.maps[id])![1],source=lib.maps[id]!,map=ctx.project.maps[mapId]!;
  assert(sha(map.lowerTiles)===sha(source.lowerTiles)&&sha(map.upperTiles)===sha(source.upperTiles),'Raster arrays changed');
  assert(sha(map.worldmapSource)===sha(source.worldmapSource)&&map.characterScale===source.characterScale,'Geography/scale lost');
  assert(sha(map.locations)===sha(source.locations),'Locations lost');
  assert(map.tilesetId==='worldmap_'+mapId,'Imported world must own its editable tileset');
  const t=ctx.project.tilesets[map.tilesetId]!;assert(t.image.type==='uploaded'&&ctx.project.assets.uploaded[t.image.id],'On-demand image missing');
  assert(map.events.length===0,'Snapshot transfers must not leak into an unrelated project');
  imports.push({referenceId:id,mapId,tilesetId:map.tilesetId,geometryPreserved:true,geographyPreserved:true,scale:map.characterScale,assetInstalled:true});
}
// The real Pi boundary must accept unused nullable properties and change only the requested scale.
const shape=createPiToolset(ctx,{toolNames:['set_map_properties']}).find(t=>t.name==='set_map_properties')!;
const parameters=shape.parameters as any;
const strictArgs=Object.fromEntries(Object.keys(parameters.properties).map(key=>[key,null]));
strictArgs.mapId='map_yucatan_copy';strictArgs.characterScale=0.75;
assert(validateArgs(parameters,strictArgs).length===0,'Provider-facing nullable parameters reject unused fields');
const beforeScale=structuredClone(ctx.project.maps.map_yucatan_copy!);
await shape.execute('strict-properties',strictArgs);
const afterScale=ctx.project.maps.map_yucatan_copy!;
assert(afterScale.characterScale===0.75,'Requested scale was not applied');
assert(isDeepStrictEqual({...beforeScale,characterScale:0.75},afterScale),'Unused optional values changed other map properties/ground');
// Real persistence of both imported worlds, then inspect the external asset bytes after reopen.
store=await openLocalProjectStore({projectDir:folder});assert((await store.saveProject(ctx.project)).kind==='saved','Imported maps save');store.close();
store=await openLocalProjectStore({projectDir:folder});const saved=store.loadSnapshot()!;store.close();
for(const proof of imports){const map=saved.project.maps[proof.mapId]!;assert(sha(map)===sha(ctx.project.maps[proof.mapId]),'Imported map reload differs');}
const proof={passed:true,database:sharedContentFile(),libraryRevisions:rows.map(([id])=>({id,revision:readSharedContentLibrary(id)!.revision})),
  selectedIcons:79,newProject:true,existingProject:{projectDir:folder,projectId,revision:saved.revision,mapsPreserved:true,savedAndReopened:true},imports,
  ownedRowsOnly:true,defaults:['worldmap-human-selected'],exampleLibrariesOnDemand:true,strictNullablePropertiesChangeOnlyScale:true};
fs.writeFileSync(path.join(out,'contract.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
