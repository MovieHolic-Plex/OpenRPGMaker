/** Full behavior probes use copied REAL skills records, never fabricated skills. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createBlankProject} from '@/project/defaults/blankProject';
import {normalizeDatabaseRecords,normalizeSkillRecord,normalizeStateRecord} from '@/project/databaseRecordModel';
import {normalizeEnemyRecord,normalizeTroopRecord} from '@/project/databaseEnemyTroopRecordModel';
import {createBattleRuntime} from '@/battle/runtime';
import {advanceBattleRuntime} from '@/battle/battleRuntimeAdvance';
import {combatConditionMet} from '@/battle/combatConditions';
import {predictSkillDamageFor} from '@/battle/battlePredict';
import type {EnemyActionPattern,EnemyActionCondition,Command,Project} from '@/project/types';

const own=resolve('content-packs/joseon-folklore/behavior');
const read=(name:string)=>JSON.parse(readFileSync(resolve(own,name),'utf8'));
const data=read('data.json'),design=read('design.json'),source=read('skills-source.json'),monsters=read('monsters-source.json');
const ids=JSON.parse(readFileSync('content-packs/joseon-folklore/ids.json','utf8'));
const protoPath=process.argv.find(a=>a.startsWith('--prototype='))?.slice(12)??'/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json';
const proto=JSON.parse(readFileSync(protoPath,'utf8'));const blank=createBlankProject();
assert.equal(createHash('sha256').update(readFileSync(source.sourcePath)).digest('hex'),source.sha256,'skills source changed; re-author snapshot');
const skillMap=new Map(source.records.skills.map((s:any)=>[s.id,normalizeSkillRecord(s)]));
const missing=Object.values(ids.enemySkills).filter(id=>!skillMap.has(id));
assert.equal(data.enemyActions.length,15);assert.equal(design.roster.filter((r:any)=>r.role==='normal').length,12);
assert.equal(design.roster.filter((r:any)=>r.role==='boss').length,3);
const subjects=[{hp:100,maxHp:100,mp:100,maxMp:100,stateIds:[]},{hp:30,maxHp:100,mp:30,maxMp:100,stateIds:['state_poison','state_jf_fox_charm']}];
const conditionMatrix=[];
for(const [index,row] of data.enemyActions.entries()){
 assert(Object.values(ids.enemies).includes(row.enemyId));
 const normalized=normalizeEnemyRecord({id:row.enemyId,name:design.roster[index].name,...row});
 assert.deepEqual(JSON.parse(JSON.stringify(normalized.actions)),row.actions);
 assert.deepEqual(normalized.skillIds,row.skillIds);
 assert.equal(row.actions[0].skillId,'');assert.equal(row.actions[0].condition.kind,'always');
 for(const a of row.actions){assert(a.skillId===''||Object.values(ids.enemySkills).includes(a.skillId));assert(!('and' in a.condition));}
 conditionMatrix.push({enemyId:row.enemyId,samples:subjects.flatMap((subject,si)=>[0,1].flatMap(allies=>[1,2,3,4,5,6].map(turn=>({subject:si,allies,turn,eligible:row.actions.map((a:EnemyActionPattern)=>combatConditionMet(a.condition,subject,turn,allies))}))))});
}
const bossBoundaries=design.roster.filter((r:any)=>r.role==='boss').map((r:any)=>{
 const condition=data.enemyActions.find((x:any)=>x.enemyId===r.enemyId).actions.at(-1).condition;
 const samples=[r.hpThreshold+0.01,r.hpThreshold,r.hpThreshold-0.01].map(percent=>({percent,eligible:combatConditionMet(condition,{...subjects[0],hp:percent},1,0)}));
 assert.deepEqual(samples.map((s:any)=>s.eligible),[false,true,true]);return {enemyId:r.enemyId,samples};
});
const m2=(commandId:string,fields:any):Command=>({kind:'m2Command',commandId,fields});
function caseSeed(condition:EnemyActionCondition,on:boolean,stats:any){
 let hp=stats.maxHp,mp=stats.maxMp,helpers=0;let stateIds:string[]=[];
 if(condition.kind==='hp')hp=Math.max(1,Math.floor(stats.maxHp*(on?(condition.minPercent+condition.maxPercent)/2:100)/100));
 if(condition.kind==='mp')mp=Math.floor(stats.maxMp*(on?100:0)/100);
 if(condition.kind==='allies')helpers=on?condition.min:(condition.max===0?1:0);
 if(condition.kind==='status'&&(on===condition.present))stateIds=[condition.stateId];
 return {hp,mp,helpers,stateIds};
}
function setup(index:number,flow:'strict'|'gauge',mode:'on'|'off'|'high'|'low'|'middle'|'banditLow'|'emptyMp'|'sealed'|'sourceStats'){
 const r=design.roster[index],row=data.enemyActions[index];
 const stats={...r.scenarioStats};
 if(mode==='sourceStats')Object.assign(stats,r.currentMonsterRecord.stats);
 let seed=caseSeed(r.primaryCondition,mode!=='off',stats);
 if(r.role==='boss')seed={hp:mode==='low'?Math.floor(stats.maxHp*r.hpThreshold/100):stats.maxHp,mp:stats.maxMp,helpers:0,stateIds:[]};
 if(mode==='middle')seed.hp=Math.floor(stats.maxHp*0.55);
 if(mode==='banditLow')seed.hp=Math.floor(stats.maxHp*0.25);
 if(mode==='emptyMp')seed.mp=0;
 if(mode==='sealed')seed.stateIds=['state_jf_ghost_seal'];
 const db=normalizeDatabaseRecords(structuredClone(proto));
 const replace=(records:any[],add:any[])=>{const byId=new Map(records.map(x=>[x.id,x]));for(const r of add)byId.set(r.id,r);return [...byId.values()];};
 db.skills=replace(db.skills,source.records.skills.map(normalizeSkillRecord));
 db.states=replace(db.states,source.records.states.map(normalizeStateRecord));
 // Actual elements are already structurally complete; database normalization applies its own element normalizer.
 db.elements=source.records.elements;
 const project={...blank,database:db,system:{...blank.system,battleModel:'rm2k3',battleUiStyle:'retro2003'},session:structuredClone(blank.session),flags:{},switches:[],variables:[]} as Project;
 for(const a of db.actors){
  a.initialEquipment={};a.learnedSkills=[];a.initialLevel=r.recommendedLevel;
  a.parameterCurves.maxHp=Array(99).fill(4000);a.parameterCurves.maxMp=Array(99).fill(250);
  a.parameterCurves.attack=Array(99).fill(20);a.parameterCurves.agility=Array(99).fill(60);
 }
 for(const c of db.classes)c.learnedSkills=[];
 const enemy=normalizeEnemyRecord({id:r.enemyId,name:r.name,stats,actions:row.actions,skillIds:row.skillIds,rewards:{exp:0,gold:0,dropRatePercent:0}});
 const helper=normalizeEnemyRecord({id:'probe_helper',name:'living ally scenario',stats:{maxHp:9999,maxMp:0,attack:1,defense:1,mind:1,agility:15},actions:[]});
 db.enemies=[enemy,...(seed.helpers?[helper]:[])];
 const commands:Command[]=[m2('m2-098-change-enemy-hp',{target:enemy.id,operation:'set',value:seed.hp}),m2('m2-099-change-enemy-mp',{target:enemy.id,operation:'set',value:seed.mp}),
  ...seed.stateIds.map(s=>m2('m2-100-change-enemy-state',{target:enemy.id,operation:'add',value:s}))];
 const troop=normalizeTroopRecord({id:'troop_behavior_probe',name:'real-skill behavior scenario',enemyIds:db.enemies.map(e=>e.id),members:db.enemies.map((e,i)=>({enemyId:e.id,x:80+i*50,y:80})),
  battleEventPages:[{id:'seed',conditions:[],span:'battle',commands}]});
 db.troops=[troop];project.system.initialTroopId=troop.id;
 const rt=createBattleRuntime({project,troopId:troop.id,canEscape:false,canLose:true,battleFlow:flow,activeSlots:4,rng:()=>0.15,
  party:{levels:Object.fromEntries(db.actors.map(a=>[a.id,a.initialLevel])),experience:{},partyActorIds:db.actors.map(a=>a.id)}});
 return {rt,project,seed};
}
function trace(index:number,flow:'strict'|'gauge',mode:any){
 const r=design.roster[index],row=data.enemyActions[index];
 const {rt,project,seed}=setup(index,flow,mode);
 let cursor=0;const events:any[]=[];const snapshots:any[]=[];
 const seen=new Set<number>();
 const collect=()=>{
  const s=rt.snapshot(),en=s.enemies[0];
  for(const e of s.timeline.slice(cursor)){
   if(e.userRecordId!==r.enemyId)continue;
   if(!e.charge&&!e.skillId&&e.commandKind!=='enemyAttack')continue;
   let id=e.skillId;if(e.charge)id=en.charging?.skillId;
   events.push({sequence:e.sequence,turn:s.turn,actionId:e.actionId,kind:e.charge?'prepare':e.commandKind==='enemyAttack'?'basic':e.kind,
    skillId:id,targetId:e.targetId,amount:e.amount,stateId:e.stateId,message:e.message,enemyHp:en.hp,enemyMp:en.mp,enemyStates:en.stateIds,
    targets:s.actors.map(a=>({id:a.id,hp:a.hp,stateIds:a.stateIds}))});
   if(e.actionId!==undefined)seen.add(e.actionId);
  }
  cursor=s.timeline.length;
  snapshots.push({turn:s.turn,phase:s.phase,hp:en.hp,mp:en.mp,states:en.stateIds,charging:en.charging});
 };
 const steps=(mode==='off'&&r.primaryCondition.kind!=='turn')||mode==='sealed'?2:mode==='sourceStats'?4:10;
 for(let i=0;i<260;i++){
  if(flow==='gauge')advanceBattleRuntime(rt);collect();const s=rt.snapshot();
  if(s.result||seen.size>=steps)break;
  if(s.phase==='actorCommand')rt.performActorCommand({kind:'defend'});
 }
 collect();assert(events.length>0,`${r.slug}/${flow}/${mode}: progress`);
 // Strict queues the first choice before seed battle events. Validate subsequent decisions;
 // keep the first queued action visible as warmup evidence, never pretend it saw the new seed.
 const firstId=events[0].actionId;
 const evaluated=events.filter(e=>e.actionId!==firstId);
 const nextId=evaluated[0]?.actionId;
 const firstEvaluated=evaluated.filter(e=>e.actionId===nextId);
 const skillEvents=events.filter(e=>e.skillId&&!e.charge&&e.kind!=='prepare');
 const actualUses=skillEvents.filter(e=>e.kind!=='prepare');
 const prepares=events.filter(e=>e.kind==='prepare');
 if(mode==='on'||mode==='high'){
  const expected=row.actions[1].skillId;
  assert(actualUses.some(e=>e.skillId===expected),`${r.slug}/${flow}/${mode}: primary actual skill executed`);
 }
 if(mode==='low'){
  const expected=ids.enemySkills['bronze-smash'];
  assert(prepares.some(e=>e.skillId===expected),'real charge in low HP phase');
  assert(actualUses.some(e=>e.skillId===expected),'real charged release in low HP phase');
  assert(!evaluated.some(e=>e.kind==='basic'),`${r.slug}/${flow}: low HP changed attack selection`);
 }
 if(mode==='middle'||mode==='banditLow')assert(actualUses.some(e=>e.skillId===ids.enemySkills['poison-bite']),'middle/critical HP condition selects actual poison bite');
 if(mode==='emptyMp'&&r.role==='normal'){
  assert(firstEvaluated.some(e=>e.kind==='basic'),`${r.slug}/${flow}/${mode}: basic fallback legal after seed ${JSON.stringify(firstEvaluated.map(e=>({kind:e.kind,skillId:e.skillId,states:e.enemyStates,turn:e.turn})))}`);
  assert(!firstEvaluated.some(e=>e.skillId),'no paid/sealed skill selected while unavailable');
 }
 if(mode==='sealed'){
  // The real ghost seal expires on the second own upkeep. Gauge can legitimately
  // prepare a skill on that slot; prove the sealed slot's fallback, not eternal sealing.
  assert(events.some(e=>e.kind==='basic'),'basic remains legal during seal scenario');
  assert(!evaluated.some(e=>e.skillId&&e.enemyStates.includes('state_jf_ghost_seal')),`${r.slug}/${flow}: no skill chosen after seed while seal present ${JSON.stringify(evaluated.map(e=>({kind:e.kind,skillId:e.skillId,states:e.enemyStates,turn:e.turn})))}`);
 }
 if(mode==='off'&&r.primaryCondition.kind!=='turn'){
  assert(firstEvaluated.some(e=>e.kind==='basic'));assert(!firstEvaluated.some(e=>e.skillId===row.actions[1].skillId),'condition off after seed warmup');
 }
 for(const warning of prepares){
  const same=events.filter(e=>e.actionId===warning.actionId&&e.kind!=='prepare');
  assert.equal(same.length,0,'prepare causes no damage or state effect');
 }
 const warningsAndReleases=[];
 for(const skillId of [...new Set(actualUses.map(e=>e.skillId))]){
  const skill=skillMap.get(skillId) as any;assert(skill);
  const grouped=new Map<number,any[]>();for(const e of actualUses.filter(e=>e.skillId===skillId)){const list=grouped.get(e.actionId)??[];list.push(e);grouped.set(e.actionId,list);}
  for(const [actionId,group] of grouped){
   if(skill.chargeTurns){assert(prepares.some(e=>e.skillId===skillId&&e.sequence<group[0].sequence),'source charge precedes release');}
   if(skill.scope==='allEnemies'&&skill.effect.kind==='damage')assert.equal(new Set(group.filter(e=>e.kind==='damage').map(e=>e.targetId)).size,4,'actual all-party damage');
   warningsAndReleases.push({skillId,actionId,scope:skill.scope,sourceCost:skill.mpCost,chargeTurns:skill.chargeTurns??0});
  }
 }
 const snap=rt.snapshot();const damageChecks=row.skillIds.filter((id:string,i:number,all:string[])=>all.indexOf(id)===i).map((id:string)=>{
  const skill=skillMap.get(id) as any;if(!skill||skill.effect.kind!=='damage')return {skillId:id,kind:skill?.effect.kind??'missing',hpDamageClaim:false};
  const a=snap.actors[0],open=predictSkillDamageFor(project,snap.enemies[0],skill,{...a,defending:false}).amount;
  const guard=predictSkillDamageFor(project,snap.enemies[0],skill,{...a,defending:true}).amount;
  assert(guard<=open);return {skillId:id,kind:'damage',open,guard};
 });
 const paid=new Map<number,string>();
 for(const e of actualUses)if(e.actionId!==firstId)paid.set(e.actionId,e.skillId);
 const expectedSpent=[...paid.values()].reduce((n,id)=>{const s=skillMap.get(id) as any;return n+s.mpCost.flat+Math.floor(snap.enemies[0].maxMp*s.mpCost.percentMax/100);},0);
 const observedSpent=events[0].enemyMp-snap.enemies[0].mp;
 assert.equal(observedSpent,expectedSpent,`${r.slug}/${flow}/${mode}: actual MP cost of completed actions`);
 return {enemyId:r.enemyId,slug:r.slug,role:r.role,flow,mode,seed,events,warningsAndReleases,damageChecks,
  mpCostCheck:{afterWarmupExpected:expectedSpent,afterWarmupObserved:observedSpent},
  summary:{enemyActions:seen.size,prepares:prepares.length,skillActions:new Set(actualUses.map(e=>e.actionId)).size,basic:events.filter(e=>e.kind==='basic').length,finalHp:snap.enemies[0].hp,finalMp:snap.enemies[0].mp},
  stateSnapshots:snapshots.filter((s,i)=>i===0||s.charging||s.states.length).slice(0,12)};
}
const runs:any[]=[],skipped:any[]=[],compatibility:any[]=[];
for(let i=0;i<15;i++){
 const r=design.roster[i],row=data.enemyActions[i];const absent=row.skillIds.filter((id:string)=>!skillMap.has(id));
 if(absent.length){skipped.push({enemyId:r.enemyId,missingIds:[...new Set(absent)]});continue;}
 for(const flow of ['strict','gauge'] as const){
  for(const mode of (r.role==='boss'?['high','low','sealed']:['on','off','emptyMp']))runs.push(trace(i,flow,mode));
  if(r.slug==='mountain-tiger')runs.push(trace(i,flow,'middle'));
  if(r.slug==='masked-bandit')runs.push(trace(i,flow,'banditLow'));
  if(r.currentMonsterRecord){const run=trace(i,flow,'sourceStats');runs.push(run);compatibility.push({enemyId:r.enemyId,flow,sourceStats:r.currentMonsterRecord.stats,firstAction:run.events[0],minimumMp:r.integrationRequirements.requiredMaximumMpForOneUse});}
 }
}
const comparisons=design.roster.map((r:any)=>{
 const pair=runs.filter(x=>x.enemyId===r.enemyId&&x.mode===(r.role==='boss'?'high':'on'));
 const signature=(run:any)=>{const seen=new Set<number>();return (run?.events??[]).filter((e:any)=>{if(seen.has(e.actionId))return false;seen.add(e.actionId);return true;}).map((e:any)=>({turn:e.turn,kind:e.kind,skillId:e.skillId}));};
 const strictSignature=signature(pair.find(x=>x.flow==='strict')),gaugeSignature=signature(pair.find(x=>x.flow==='gauge'));
 return {enemyId:r.enemyId,strict:pair.find(x=>x.flow==='strict')?.summary,gauge:pair.find(x=>x.flow==='gauge')?.summary,
  strictSignature,gaugeSignature,sameTiming:JSON.stringify(strictSignature)===JSON.stringify(gaugeSignature),
  explanation:'strict prequeues the first decision before seed events; warmup action is excluded from post-seed checks. strict counts rounds; gauge cycles/state upkeep. Saved charge does not re-evaluate turn/HP.'};
});
const report={ok:missing.length===0&&skipped.length===0,phase:'full',skillsAreReal:true,skillSource:source.sourcePath,skillSourceSha256:source.sha256,
 missingIds:missing,skipped,normalization:15,bossBoundaries,conditionMatrix,runs,compatibility,comparisons,
 scenarioDisclosure:{skills:'all records normalized directly from immutable skills-source snapshot; no invented SkillRecords',
  enemies:'design.roster.scenarioStats unless mode sourceStats; M2 troop events seed actual HP/MP/state/allies',
  party:'read-only prototype actors, equipment cleared, HP4000/MP250/attack20/agility60 for durable probes; levels 1..18 from design',
  rng:0.15,scope:'AI and actual skill effects/targets/costs; not final monster/class/art integration or shipped-player QA'},
 limits:['No live DB/public registry writes','full gates/vitest/typecheck not run','missing real skills block ready; source monster maxMp can still block integration']};
writeFileSync(resolve(own,'smoke-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,normalization:15,scenarios:runs.length,skipped,compatibility:compatibility.map(x=>({enemyId:x.enemyId,flow:x.flow,mp:x.sourceStats.maxMp,minimumMp:x.minimumMp,first:x.firstAction.kind}))},null,2));
if(!report.ok)process.exitCode=2;
