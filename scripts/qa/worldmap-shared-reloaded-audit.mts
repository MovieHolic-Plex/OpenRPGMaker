// Re-read the two real model outputs. Compare values, not JSON property insertion order.
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {createBlankProject} from '../../src/project/defaults.ts';
import {readSharedContentLibrary} from '../lib/sharedContentSqlite.ts';
import {WORLDMAP_ICON_TOOLS} from '../../src/editor/tools/worldmapIconTools.ts';
import {canMove} from '../../src/project/collision.ts';
import {measureLayoutQuality} from '../../src/ai/piAgent/layoutQuality.ts';
import type {Project} from '../../src/project/types.ts';

const cases=[];
for(const label of ['yucatan-final','joseon-final']){
  const dir=`verify-shots/worldmap-shared-db/assistant-${label}`;
  const prior=JSON.parse(fs.readFileSync(dir+'/summary.json','utf8'));
  const store=await openLocalProjectStore({projectDir:prior.folder});
  const snapshot=store.loadSnapshot()!;const p=snapshot.project as Project;store.close();
  const seed=createBlankProject();
  const baseline={maps:seed.maps,startMapId:seed.startMapId,startPos:seed.startPos};
  const seedPath=dir+'/seed-maps.json';
  const before=fs.existsSync(seedPath)?JSON.parse(fs.readFileSync(seedPath,'utf8')):baseline;
  const originalMapsPreserved=Object.entries(before.maps).every(([id,m])=>isDeepStrictEqual(m,p.maps[id]))
    &&p.startMapId===before.startMapId&&isDeepStrictEqual(p.startPos,before.startPos);
  const imported=prior.imported.map((r:any)=>{
    const lib=readSharedContentLibrary(r.referenceId==='shared_worldmap_real_joseon'?'worldmap-real-joseon':'worldmap-real-yucatan')!.library;
    const src=lib.maps[r.referenceId]!,map=p.maps[r.mapId]!;
    return {...r,groundPreserved:isDeepStrictEqual(map.lowerTiles,src.lowerTiles),geographyPreserved:isDeepStrictEqual(map.worldmapSource,src.worldmapSource),
      privateTileset:map.tilesetId==='worldmap_'+map.id,scaleCorrect:map.characterScale===.75,
      bakedSceneryMisclassifiedAsEmpty:measureLayoutQuality(p,map)!==null};
  });
  const placements=prior.placements.map((r:any)=>{
    const inspected=WORLDMAP_ICON_TOOLS.find(t=>t.name==='inspect_worldmap_icon')!.run(p,r.args).data as any;
    const trace=JSON.parse(fs.readFileSync(dir+'/trace.json','utf8'));
    const stamp=trace.find((t:any)=>t.name==='stamp_worldmap_icon'&&t.ok&&isDeepStrictEqual(t.args,r.args));
    const {approach:a,entrance:e}=stamp.data,map=p.maps[r.args.mapId]!;
    return {...r,inspected,entranceWalkable:canMove(p,map,a.x,a.y,e.x,e.y)};
  });
  const passed=prior.realModel&&prior.stats.toolErrors===0&&originalMapsPreserved&&
    imported.every((m:any)=>m.groundPreserved&&m.geographyPreserved&&m.privateTileset&&m.scaleCorrect&&!m.bakedSceneryMisclassifiedAsEmpty)&&
    placements.length===2&&placements.every((r:any)=>r.inspected.ok&&r.entranceWalkable);
  const audit={label,projectId:prior.projectId,folder:prior.folder,revision:snapshot.revision,model:prior.modelId,
    originalMapsPreserved,imported,placements,toolErrors:prior.stats.toolErrors,toolCalls:prior.stats.toolCalls,
    savedAndReopened:true,passed,rawSummaryUsedJsonKeyOrder:!('groundPreserved' in prior.imported[0])||prior.originalMapsPreserved===false};
  fs.writeFileSync(dir+'/reloaded-audit.json',JSON.stringify(audit,null,2));cases.push(audit);
}
// Keep the ordinary map counter active, including a world map with edited/non-raster tile arrays.
const ordinary=createBlankProject(),normal=ordinary.maps[ordinary.startMapId]!;
if(measureLayoutQuality(ordinary,normal)===null)throw Error('Ordinary map counter was disabled');
const all={passed:cases.every(c=>c.passed),cases,ordinaryLayoutCounterStillActive:true};
fs.writeFileSync('verify-shots/worldmap-shared-db/reloaded-audit.json',JSON.stringify(all,null,2));
console.log(JSON.stringify({passed:all.passed,cases:cases.map(c=>({label:c.label,projectId:c.projectId,revision:c.revision,toolCalls:c.toolCalls,toolErrors:c.toolErrors,passed:c.passed})),ordinaryLayoutCounterStillActive:true},null,2));
if(!all.passed)process.exitCode=1;
