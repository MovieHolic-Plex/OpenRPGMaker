// Real editor Pi assistant + configured model + actual shared SQLite catalog; canonical save and reopen.
// bun scripts/qa/worldmap-shared-assistant-live.mts --label yucatan --task-file <file> [--model klb/claude-opus-5.5]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildModel } from '@oh-my-pi/pi-catalog/build';
import { runPiAgent } from '../lib/piAgentRuntime.ts';
import { readSharedContentLibrary, sharedContentFile } from '../lib/sharedContentSqlite.ts';
import { installSharedContent, ensureSharedContent, sharedContentSnapshot } from '../../src/project/sharedContent.ts';
import { createBlankProject } from '../../src/project/defaults.ts';
import { initLocalProjectStore, openLocalProjectStore } from '../../electron/local-store/store.ts';
import { buildSessionRegistryTools } from '../../src/ai/sessionToolExposure.ts';
import { renderMapPng, renderToolRegionPngBase64 } from '../qa-game/render.mts';
import { setWorldmapBuilder } from '../../src/editor/worldmap/worldmapBuild.ts';
import { buildWorldmap } from '../lib/worldmapBuild.mjs';
import { runTool } from '../../src/editor/tools/index.ts';
import { WORLDMAP_ICON_TOOLS } from '../../src/editor/tools/worldmapIconTools.ts';
import { canonicalJsonString } from '../../src/project/persistence/core/canonicalJson.ts';
import { canMove } from '../../src/project/collision.ts';
import type { Project } from '../../src/project/types.ts';
import { inspectWorldAtlas } from '../../src/project/worldAtlasAudit.ts';

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf('--'+name); return i < 0 ? fallback : process.argv[i+1]!; };
const label = arg('label', 'yucatan')!;
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid evidence label');
const generatedTheme = arg('generated-theme');
const expectedStructure = arg('structure');
const out = path.resolve(arg('out', 'verify-shots/worldmap-shared-db/assistant-'+label)!);
const folder = path.resolve(arg('project', path.join(os.homedir(), '.local/share/oprn/worldmap-shared-ai-'+label+'-20261004'))!);
if (fs.existsSync(path.join(folder, 'project.sqlite'))) throw Error('Choose a fresh project directory; existing content is never replaced');
fs.mkdirSync(out, {recursive:true});
const task = fs.readFileSync(arg('task-file')!, 'utf8');
const libraries = Object.fromEntries(['worldmap-human-selected','worldmap-real-joseon','worldmap-real-yucatan',...(expectedStructure?['worldmap-navigation-structures-v1']:[])].map(id => {
  const row = readSharedContentLibrary(id); if (!row) throw Error('Missing actual shared DB library '+id); return [id,row.library];
}));
await installSharedContent({ revision: createHash('sha256').update(JSON.stringify(libraries)).digest('hex'), libraries });
setWorldmapBuilder(buildWorldmap);
const cfg = Bun.YAML.parse(fs.readFileSync(path.join(os.homedir(), '.omp/agent/models.yml'), 'utf8')) as any;
const [provider, modelId] = arg('model', 'klb/claude-opus-5.5')!.split('/');
const prov = (cfg.providers ?? cfg)[provider!], md = prov?.models.find((m:any)=>m.id===modelId);
if (!md || !prov.apiKey) throw Error('Configured model or credential missing');
const model = buildModel({ ...md, provider, api:prov.api, baseUrl:prov.baseUrl,
  cost:{input:0,output:0,cacheRead:0,cacheWrite:0},compat:{...prov.compat,...md.compat} } as never);
let store = await initLocalProjectStore({ projectDir:folder });
const projectId = store.info().projectId;
const p = createBlankProject(); p.meta.title = '공용 월드맵 조수 실호출 · '+label; p.system.opening = undefined;
ensureSharedContent(p);
if ((await store.saveProject(p)).kind !== 'saved') throw Error('Seed save conflict');
store.close(); store = await openLocalProjectStore({projectDir:folder});
const project = store.loadSnapshot()!.project as Project; store.close();
// Same registry/discovery core as the editor; this runner does not exercise the UI intent model request.
const intent = { mode:'create',space:'none',facility:null,targetMapId:null,useSelection:false,clarify:null,clarifyOptions:[],
  needsPlan:true,resetsContext:false,summary:task,source:'llm',tools:[] };
const exposed = buildSessionRegistryTools({requestText:task,intent:intent as never,contextWindow:model.contextWindow}).map(t=>t.function.name);
const trace:any[] = [], events:any[] = [];
const record = () => { fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2)); fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2)); };
fs.writeFileSync(path.join(out,'task.txt'),task);
fs.writeFileSync(path.join(out,'exposed-tools.json'),JSON.stringify(exposed,null,2));
const started = Date.now();
const seedMapsHash = createHash('sha256').update(canonicalJsonString(project.maps)).digest('hex');
fs.writeFileSync(path.join(out,'seed-maps.json'),JSON.stringify({maps:project.maps,startMapId:project.startMapId,startPos:project.startPos}));
const done = await runPiAgent({provider:provider!,model:modelId!,task,mapIds:[],project,maxTurns:Number(arg('max-turns','65')),
  thinkingLevel:'high' as never,initialToolNames:exposed}, {
  model:model as never,apiKey:prov.apiKey,timeoutMs:Number(arg('timeout-ms','900000')),
  renderToolImage: async (draft,_name,data)=>renderToolRegionPngBase64(draft,data),
  onToolCall:r=>{ const data = r.result.data as any;
    trace.push({i:trace.length+1,name:r.name,args:r.args,ok:r.result.ok,summary:String(r.result.summary).slice(0,1200),warnings:r.result.warnings,
      data:['stamp_worldmap_icon','inspect_worldmap_icon','import_region_reference','edit_world_terrain','read_world_terrain','author_worldmap_structure','inspect_worldmap_structure'].includes(r.name)?data:undefined});record(); },
  onCheckpoint:async checkpoint=>{ fs.writeFileSync(path.join(out,'checkpoint.json'),JSON.stringify(checkpoint)); },
  onEvent:e=>{ if (['assistant','tool_end','error','execution_status'].includes(e.type)) {
      const event = Object.fromEntries(Object.entries(e).filter(([key])=>['type','at','id','name','ok','summary','text','message','durationMs'].includes(key)));
      if (e.type==='execution_status'&&e.name==='map.image.delivered') event.data=e.data;
      events.push(event);record();
    }
    if(e.type==='tool_end')console.log(`${e.ok?'OK':'FAIL'} ${e.name}: ${String(e.summary).slice(0,220)}`);
    else if(e.type==='assistant')console.log('assistant: '+e.text.replace(/\n/g,' ').slice(0,600));
    else if(e.type==='error')console.log('ERROR: '+e.message.slice(0,500)); },
});
store = await openLocalProjectStore({projectDir:folder});
if ((await store.saveSerialized(JSON.stringify(done.project),store.loadSnapshot()!.sha256)).kind!=='saved')throw Error('Final save conflict');
store.close(); store = await openLocalProjectStore({projectDir:folder});
const snapshot = store.loadSnapshot()!; const saved = snapshot.project as Project; store.close();
// Rehydrate verified canonical assets solely for rendering and read-only tool audits.
const portable = structuredClone(saved);
for(const asset of Object.values(portable.assets.uploaded))if(asset.ref&&!asset.dataUrl){
  const bytes=fs.readFileSync(path.join(folder,'assets',`${asset.ref.sha256}.${asset.ref.extension}`));
  if(createHash('sha256').update(bytes).digest('hex')!==asset.ref.sha256)throw Error('Canonical image hash mismatch');
  asset.dataUrl=`data:${asset.ref.mime};base64,${bytes.toString('base64')}`;
}
const placements=trace.filter(t=>t.name==='stamp_worldmap_icon'&&t.ok).map(t=>{
  const inspected=WORLDMAP_ICON_TOOLS.find(t=>t.name==='inspect_worldmap_icon')!.run(portable,t.args).data as any;
  const map=portable.maps[t.args.mapId],start=t.data.approach,target=t.data.entrance;
  const ingress=!!map&&canMove(portable,map,start.x,start.y,target.x,target.y);
  return {args:t.args,inspected,entranceWalkable:ingress};
});
const imported=trace.filter(t=>t.name==='import_region_reference'&&t.ok).map(t=>{
  const map=portable.maps[t.data.mapId];
  if(map){const image=renderMapPng(portable,map,1);if(image.note)throw Error(image.note);fs.writeFileSync(path.join(out,map.id+'.png'),image.png);}
  const source = Object.values(libraries).find(lib=>lib.maps[t.args.id])?.maps[t.args.id];
  const same = (a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  return {referenceId:t.args.id,mapId:map?.id,worldmapSource:map?.worldmapSource,characterScale:map?.characterScale,events:map?.events.length,
    groundPreserved:!!source&&same(map?.lowerTiles,source.lowerTiles),geographyPreserved:!!source&&same(map?.worldmapSource,source.worldmapSource),
    privateTileset:map?.tilesetId==='worldmap_'+map?.id};
});
const originalMaps = Object.fromEntries(Object.keys(project.maps).map(id=>[id,saved.maps[id]]));
const originalMapsPreserved = createHash('sha256').update(canonicalJsonString(originalMaps)).digest('hex')===seedMapsHash;
const generated = Object.values(portable.maps).filter(map=>map.worldmapSource&&!project.maps[map.id]).map(map=>{
  const built = trace.findLast(t=>t.name==='edit_world_terrain'&&t.ok&&t.data?.mapId===map.id);
  const image=renderMapPng(portable,map,1);if(image.note)throw Error(image.note);
  fs.writeFileSync(path.join(out,map.id+'.png'),image.png);
  return {mapId:map.id,theme:map.worldmapSource!.theme,source:map.worldmapSource,characterScale:map.characterScale,
    locations:map.locations,events:map.events.length,privateTileset:map.tilesetId==='worldmap_'+map.id,
    journeyCheck:built?.data?.journeyCheck,layout:built?.data?.layout,iconSelection:built?.data?.iconSelection,
    warnings:built?.warnings,renderedPng:true};
});
const sharedPassed=imported.length>0&&placements.length>=2&&placements.every(p=>p.inspected.ok&&p.entranceWalkable)&&
  imported.every(m=>m.worldmapSource?.ops.some(op=>op.op==='continents'&&op.style==='real')&&m.characterScale===0.75&&m.groundPreserved&&m.geographyPreserved&&m.privateTileset)&&originalMapsPreserved;
const generatedPassed=generated.length===1&&generated[0]!.theme===generatedTheme&&generated[0]!.journeyCheck?.ok===true&&
  generated[0]!.privateTileset&&generated[0]!.iconSelection?.mode==='human-selected'&&originalMapsPreserved&&
  trace.every(t=>t.ok)&&saved.startMapId===project.startMapId&&canonicalJsonString(saved.startPos)===canonicalJsonString(project.startPos);
const structures=(portable.worldAtlases??[]).map(atlas=>({id:atlas.id,structure:atlas.structure,audit:inspectWorldAtlas(portable,atlas)}));
const structurePassed=structures.length===1&&structures[0]!.structure===expectedStructure&&structures[0]!.audit.ok&&originalMapsPreserved&&
  trace.some(t=>t.name==='read_worldmap_structure_reference'&&t.ok)&&trace.some(t=>t.name==='author_worldmap_structure'&&t.ok)&&
  trace.some(t=>t.name==='inspect_worldmap_structure'&&t.ok)&&trace.every(t=>t.ok)&&
  saved.startMapId===project.startMapId&&canonicalJsonString(saved.startPos)===canonicalJsonString(project.startPos);
const summary={realModel:true,provider,modelId,uiIntentRequestExercised:false,sharedDatabase:sharedContentFile(),libraries:Object.keys(libraries),
  folder,projectId,revision:snapshot.revision,elapsedSeconds:(Date.now()-started)/1000,
  counts:Object.fromEntries([...new Set(trace.map(t=>t.name))].map(name=>[name,trace.filter(t=>t.name===name).length])),
  failures:trace.filter(t=>!t.ok).map(t=>({name:t.name,summary:t.summary})),imported,generated,placements,structures,stats:done.stats,
  loadedCatalogLibraries:Object.keys(sharedContentSnapshot().libraries).length,originalMapsPreserved,
  passed:expectedStructure?structurePassed:generatedTheme?generatedPassed:sharedPassed,
  savedAndReopened:true};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(!summary.passed)process.exitCode=1;
