// Task-authorized retrofit through the stopped project's official SQLite API.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {ensureWorldmapAuthoringBrushes} from '../../src/project/defaults/worldmapAuthoring.ts';
import {ensureWorldmapSelectedTileset} from '../../src/project/defaults/worldmapSelected.ts';
import {shapeAllAutotileGroupsAround} from '../../src/project/defaults/autotileEngine.ts';
import type {Project} from '../../src/project/types.ts';
const [folder,out]=process.argv.slice(2).map(s=>path.resolve(s));
const store=await openLocalProjectStore({projectDir:folder}),before=store.loadSnapshot()!;
const backup=store.backup();
const project=before.project as Project,original=structuredClone(project.maps),iconGrafts=JSON.stringify(project.tilesets.worldmap_authoring?.tileGrafts?.filter(g=>g.sourceChipset==='tex_worldmap_selected'));
ensureWorldmapAuthoringBrushes(project);if(project.tilesets.worldmap_selected)ensureWorldmapSelectedTileset(project.tilesets.worldmap_selected);
const edited=[];
for(const map of Object.values(project.maps)){
 // Original baked continents remain intact. Only the new reusable brush map needs repair.
 if(map.tilesetId!=='worldmap_authoring')continue;
 const points=Array.from({length:map.width*map.height},(_,i)=>({x:i%map.width,y:Math.floor(i/map.width)}));
 shapeAllAutotileGroupsAround(map,project.tilesets[map.tilesetId].autotileGroups!,points);
 const old=original[map.id];edited.push({mapId:map.id,lowerChanged:map.lowerTiles.filter((v,i)=>v!==old.lowerTiles[i]).length,upperChanged:map.upperTiles.filter((v,i)=>v!==old.upperTiles[i]).length,eventsPreserved:isDeepStrictEqual(map.events,old.events),reliefPreserved:isDeepStrictEqual(map.relief,old.relief)});
}
if(iconGrafts!==JSON.stringify(project.tilesets.worldmap_authoring?.tileGrafts?.filter(g=>g.sourceChipset==='tex_worldmap_selected')))throw Error('Icon grafts changed');
const result=await store.saveProject(project);if(result.kind!=='saved')throw Error(JSON.stringify(result));const info=store.info();store.close();
const reopened=await openLocalProjectStore({projectDir:folder}),saved=reopened.loadSnapshot()!;reopened.close();
const same=isDeepStrictEqual(saved.project.maps,project.maps);if(!same)throw Error('Stored maps differ');
const preservedOtherMaps=Object.values(original).filter(m=>m.tilesetId!=='worldmap_authoring').every(m=>isDeepStrictEqual(m,saved.project.maps[m.id]));if(!preservedOtherMaps)throw Error('Other maps changed');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({projectId:info.projectId,projectDir:folder,backup,revision:saved.revision,sha256:saved.sha256,edited,iconGraftsPreserved:true,preservedOtherMaps,savedAndReopened:same},null,2));console.log({projectId:info.projectId,revision:saved.revision,edited,preservedOtherMaps});
