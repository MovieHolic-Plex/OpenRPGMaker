/** Focused offline production/admission probe; no host writes, suites or native-play claims. */
import { resolveAutonomy } from '@/ai/autonomyLevels';
import { classifyPlainPiTurn } from '@/ai/piAgent/plainTurn';
import { runPiAgentViaCompanion } from '@/ai/piAgent/client';
import {runToolAsync} from '@/editor/tools/asyncToolRunner';
import {createPiToolset} from '@/ai/piAgent/toolAdapter';
import { createBlankProject } from '@/project/defaults/blankProject';
import { runTool } from '@/editor/tools/toolRunner';
import { PiMonsterGameProduction } from '@/ai/piAgent/monsterGameProduction';
import { requestsEmeraldMonsterGame } from '@/ai/piAgent/monsterGameRequest';
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
for(const text of ['포켓몬 같은 게임 만들어','Make a Pokemon-like game','Build an Emerald monster game'])assert(requestsEmeraldMonsterGame(text),'request missed: '+text);
for(const text of ['포켓몬 게임 어떻게 만들어요?','Explain Pokemon-like games','포켓몬 NPC 추가해','몬스터 상점 고쳐'])assert(!requestsEmeraldMonsterGame(text),'scope widened: '+text);
const ctx={project:createBlankProject()};
const production=new PiMonsterGameProduction(true);
assert(production.inspect(ctx.project).length>0,'settings-only accepted');
const call=async(name:string,args:Record<string,unknown>={})=>{const result=await runToolAsync(ctx,name,args);if(!result.ok)throw Error(name+': '+JSON.stringify(result.issues));production.record(name,result,ctx.project);return result;};
await call('read_monster_game');await call('read_game_systems');
const notPrepared=runTool(ctx,'build_monster_game',{mode:'create'});assert(!notPrepared.ok&&notPrepared.issues?.some(i=>i.code==='monster-builder-not-prepared'),'sync create unexpectedly admitted');
let built: import('@/editor/tools/types').ToolResult | undefined;
const piBuild=createPiToolset(ctx,{toolNames:['build_monster_game'],onCall:r=>{built=r.result;production.record(r.name,r.result,ctx.project);}})[0]!;
assert(piBuild.concurrency==='exclusive','writes not ordered');
await piBuild.execute('focused-create',{mode:'create',title:'에메랄드 도구 probe'});
assert(built?.ok,'Pi async create failed');
console.log('BUILT',JSON.stringify(built!.data));
assert(Object.keys(ctx.project.maps).length===72,'map scope');assert(ctx.project.database.monsterSpecies?.length===60,'species scope');
assert(production.inspect(ctx.project).length>0,'no final review accepted');
const session=JSON.stringify(ctx.project.session),mapsBefore=JSON.stringify(Object.fromEntries(Object.entries(ctx.project.maps).map(([id,m])=>[id,[m.lowerTiles,m.upperTiles]]))),start=JSON.stringify([ctx.project.startMapId,ctx.project.startPos]);
const refused=runTool(ctx,'build_monster_game',{mode:'create'});assert(!refused.ok,'authored overwrite admitted');
await call('read_monster_game');await call('build_monster_game',{mode:'repair'});
assert(JSON.stringify(ctx.project.session)===session,'repair session changed');assert(JSON.stringify([ctx.project.startMapId,ctx.project.startPos])===start,'repair start changed');assert(JSON.stringify(Object.fromEntries(Object.entries(ctx.project.maps).map(([id,m])=>[id,[m.lowerTiles,m.upperTiles]])))===mapsBefore,'repair raster changed');
await call('read_monster_game');await call('review_monster_game');await call('review_opening');
for(const id of new Set(ctx.project.system.opening?.scenes.filter(s=>s.kind==='image').map(s=>s.resourceId)))if(id)production.saw(ctx.project,id);
const issues=production.inspect(ctx.project);console.log('FINAL_ISSUES',JSON.stringify(issues));assert(!issues.length,'complete review rejected');
console.log(JSON.stringify({maps:72,species:60,resolution:ctx.project.system.playResolution,cameraZoom:ctx.project.system.cameraZoom,overwriteRefused:true,sessionPreserved:true,startPreserved:true,rasterPreserved:true,productionIssues:issues.length,piAsyncPrepare:true,syncCreateRefused:true}));

const project=createBlankProject();
const input={project,text:'포켓몬 같은 게임 만들어',currentMapId:project.startMapId,selection:null,hasActivePlan:false,autonomy:resolveAutonomy('balanced'),declarer:()=>{throw Error('unexpected second model intent call');},piTeam:true};
const route=await classifyPlainPiTurn(input);assert(route.mode==='single'&&route.initialToolNames?.includes('build_monster_game'),'whole-game route narrowed');
const readonly=await classifyPlainPiTurn({...input,autonomy:resolveAutonomy('readonly')});assert(readonly.plan.readOnly&&!readonly.initialToolNames?.includes('build_monster_game'),'read-only changed');
assert(requestsEmeraldMonsterGame('Can you make a Pokemon-like game?'),'polite request missed');assert(!requestsEmeraldMonsterGame('포켓몬 블랙 같은 게임 만들어'),'explicit other reference overridden');
for(const field of ['monsterGameProduction','gameSystemProduction'] as const){
  const done={type:'done',project,stats:{ms:1,turns:1,toolCalls:0,toolErrors:0},changedKeys:[],[field]:{issues:['focused remaining issue'],playbackVerified:false}};
  let caught='';try{await runPiAgentViaCompanion({provider:'google-antigravity',task:'probe',mapIds:[],project},{fetchImpl:async()=>new Response(JSON.stringify(done)+'\n')});}catch(e){caught=String(e);}
  assert(caught.includes('focused remaining issue'),'client accepted '+field);console.log(field,caught);
}
console.log(JSON.stringify({routing:route.routingAudit,mode:route.mode,wholeGameTool:true,readOnlyPreserved:true,remainingProductionIssuesRejected:true}));
