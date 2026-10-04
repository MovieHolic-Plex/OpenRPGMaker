/** Focused in-memory runtime probe. No store/host/client or live database access. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBlankProject } from '@/project/defaults/blankProject';
import { normalizeDatabaseRecords, normalizeSkillRecord } from '@/project/databaseRecordModel';
import { normalizeEnemyRecord, normalizeTroopRecord } from '@/project/databaseEnemyTroopRecordModel';
import { createBattleRuntime } from '@/battle/runtime';
import { advanceBattleRuntime } from '@/battle/battleRuntimeAdvance';
import { combatConditionMet } from '@/battle/combatConditions';
import { predictSkillDamageFor } from '@/battle/battlePredict';
import type { EnemyActionPattern } from '@/project/types';

const root=process.cwd();
const own=resolve(root,'content-packs/joseon-folklore/behavior');
const data=JSON.parse(readFileSync(resolve(own,'data.json'),'utf8'));
const design=JSON.parse(readFileSync(resolve(own,'design.json'),'utf8'));
const ids=JSON.parse(readFileSync(resolve(root,'content-packs/joseon-folklore/ids.json'),'utf8'));
const sourcePath=process.argv.find(a=>a.startsWith('--prototype='))?.slice(12)
 ?? '/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json';
const proto=JSON.parse(readFileSync(sourcePath,'utf8'));
const blank=createBlankProject();
const sources=['generated-enemy-boar-tusk','generated-enemy-goblin-scout','generated-enemy-ghost-pale','generated-enemy-goblin-brute'];
const stats=[
 {maxHp:120,maxMp:12,attack:18,defense:10,mind:12,agility:40},
 {maxHp:100,maxMp:12,attack:16,defense:10,mind:12,agility:40},
 {maxHp:100,maxMp:12,attack:14,defense:10,mind:20,agility:40},
 {maxHp:640,maxMp:12,attack:26,defense:16,mind:26,agility:40},
];
const inputKeys=['skillId','priority','condition','switchOnAfterAction','switchOffAfterAction'];
for(const [index,row] of data.enemyActions.entries()) {
 assert(Object.values(ids.enemies).includes(row.enemyId));
 for(const a of row.actions){
  assert.deepEqual(Object.keys(a).sort(),inputKeys.slice().sort());
  assert(['always','turn','hp','mp','status','allies','switch'].includes(a.condition.kind));
  assert(a.skillId===''||Object.values(ids.enemySkills).includes(a.skillId));
 }
 const n=normalizeEnemyRecord({id:row.enemyId,name:design.pilot[index].name,...row});
 assert.deepEqual(JSON.parse(JSON.stringify(n.actions)),row.actions,'normalization must preserve persisted authored actions');
 assert.deepEqual(n.skillIds,row.skillIds,'legacy projection must match actual normalizer');
 assert.deepEqual(JSON.parse(JSON.stringify(n)).actions,row.actions,'JSON save/readback');
}
assert.equal(design.rosterOutline.filter(x=>x.role==='normal').length,12);
assert.equal(design.rosterOutline.filter(x=>x.role==='boss').length,3);
assert.equal(new Set(design.rosterOutline.map(x=>x.enemyId)).size,15);
const bossHp=data.enemyActions[3].actions[2].condition;
const subject={hp:640,maxHp:640,mp:12,maxMp:12,stateIds:[]};
const hpBoundaries=[100,40.01,40,39.99,0].map(percent=>({percent,eligible:combatConditionMet(bossHp,{...subject,hp:640*percent/100},1,0)}));
assert.deepEqual(hpBoundaries.map(x=>x.eligible),[false,false,true,true,true]);
const conditionSamples=data.enemyActions.map(row=>({enemyId:row.enemyId,
 turns:Array.from({length:10},(_,i)=>({turn:i+1,eligible:row.actions.map((a:EnemyActionPattern)=>combatConditionMet(a.condition,subject,i+1,0))}))}));

function fixture(index:number,flow:'strict'|'gauge',options:{missingSkill?:boolean;hpCross?:boolean}={}) {
 const database=normalizeDatabaseRecords(structuredClone(proto));
 const project={...blank,system:{...blank.system,battleModel:'rm2k3' as const,battleUiStyle:'retro2003'},database,
  session:structuredClone(blank.session),flags:{},switches:[],variables:[]};
 for(const [i,a] of database.actors.entries()){
  a.initialEquipment={};a.learnedSkills=[];a.initialLevel=1;
  // Durability override permits long traces; predictions below retain original L1 HP.
  a.parameterCurves.maxHp=Array(99).fill(2000);a.parameterCurves.maxMp=Array(99).fill(100);
  a.parameterCurves.agility=Array(99).fill(60);
  a.parameterCurves.attack=Array(99).fill(options.hpCross&&i===0?140:20);
 }
 for(const c of database.classes){c.learnedSkills=[];c.parameterCurves={...c.parameterCurves};}
 const req=design.skillRequirements[index];
 const skill=normalizeSkillRecord({id:req.skillId,name:req.fixtureName,scope:req.scope,power:req.fixturePower,
  chargeTurns:req.chargeTurns||undefined,mpCost:{flat:req.fixtureMpCost,percentMax:0},successRate:100,hitRate:100,variance:0,
  effect:{kind:'damage',statistic:req.fixtureStatistic,affects:'hp'},stateEffects:[]});
 if(!options.missingSkill)database.skills.push(skill);
 const row=data.enemyActions[index];
 const enemy=normalizeEnemyRecord({id:row.enemyId,name:design.pilot[index].name,monsterResourceId:sources[index],stats:stats[index],
  actions:row.actions,skillIds:row.skillIds,rewards:{exp:0,gold:0,dropRatePercent:0}});
 database.enemies=[enemy];
 const troop=normalizeTroopRecord({id:'troop_behavior_probe',name:'behavior memory probe',enemyIds:[enemy.id],
  members:[{enemyId:enemy.id,x:80,y:80}],battleEventPages:[]});
 database.troops=[troop];project.system.initialTroopId=troop.id;
 const rt=createBattleRuntime({project,troopId:troop.id,canEscape:false,canLose:true,battleFlow:flow,activeSlots:4,rng:()=>0.5,
  party:{levels:Object.fromEntries(database.actors.map(a=>[a.id,1])),experience:{},partyActorIds:database.actors.map(a=>a.id)}});
 return {rt,project,skill};
}
function trace(index:number,flow:'strict'|'gauge',options:{missingSkill?:boolean;hpCross?:boolean}={}){
 const {rt,project,skill}=fixture(index,flow,options);
 const events:any[]=[];let lastCount=0;let crossingObserved=false;
 const collect=()=>{
  const s=rt.snapshot();const en=s.enemies[0];
  if(en.hp>0&&en.hp*100/en.maxHp<=40)crossingObserved=true;
  for(const e of s.timeline.slice(lastCount)){
   if(e.side!=='enemy')continue;
   if(e.charge||e.commandKind==='enemyAttack'||e.commandKind==='enemySkill'){
    events.push({turn:s.turn,enemyHp:en.hp,enemyMaxHp:en.maxHp,kind:e.charge?'prepare':e.commandKind==='enemyAttack'?'basic':e.kind,
     skillId:e.skillId??(e.charge?skill.id:undefined),targetId:e.targetId,amount:e.amount,message:e.message,actionId:e.actionId,
     charging:en.charging});
   }
  }
  lastCount=s.timeline.length;
 };
 for(let i=0;i<300;i++){
  if(flow==='gauge')advanceBattleRuntime(rt);
  collect();const s=rt.snapshot();
  if(s.result)break;
  if(events.filter(e=>e.kind==='prepare'||e.kind==='damage'||e.kind==='basic').length>=28)break;
  if(s.phase==='actorCommand'){
   const shouldAttack=options.hpCross&&s.activeActorId===project.database.actors[0].id&&s.enemies[0].hp*100/s.enemies[0].maxHp>40;
   rt.performActorCommand(shouldAttack?{kind:'attack',targetEnemyId:s.enemies[0].id}:{kind:'defend'});
  }
 }
 collect();assert(events.length>0,'runtime progressed');
 const prepares=events.filter(e=>e.kind==='prepare');
 const releases=events.filter(e=>e.kind==='damage'&&e.skillId===skill.id);
 if(options.missingSkill){assert.equal(prepares.length,0);assert.equal(releases.length,0);assert(events.some(e=>e.kind==='basic'));}
 else {
  assert(releases.length>0,`skill release: ${index}/${flow}`);
  if(skill.chargeTurns){assert(prepares.length>0);assert(events.findIndex(e=>e.kind==='prepare')<events.findIndex(e=>e.kind==='damage'&&e.skillId===skill.id));}
 }
 if(index===3&&!options.missingSkill){
  const firstRelease=releases[0];
  const firstAction=events.filter(e=>e.kind==='damage'&&e.actionId===firstRelease.actionId);
  assert.equal(new Set(firstAction.map(e=>e.targetId)).size,4,'all-party release');
 }
 if(options.hpCross){
  assert(crossingObserved,'player attacks cross 40% HP');
  const low=events.filter(e=>e.enemyHp*100/e.enemyMaxHp<=40);
  assert(low.some(e=>e.kind==='prepare'),'low HP prepares smash');
  assert(!low.some(e=>e.kind==='basic'),'no low HP basic in durable fixture');
 }
 const snap=rt.snapshot();const damageChecks=snap.actors.map((a,i)=>{
  const target={...a,hp:proto.actors[i].parameterCurves.maxHp[0],maxHp:proto.actors[i].parameterCurves.maxHp[0],defending:false};
  const open=predictSkillDamageFor(project,snap.enemies[0],skill,target).amount;
  const guard=predictSkillDamageFor(project,snap.enemies[0],skill,{...target,defending:true}).amount;
  assert.equal(guard,Math.floor(open/2));
  assert(open<target.maxHp,'sample damage below each original actor L1 HP');
  return {actorId:a.recordId,level1Hp:target.maxHp,open,guard};
 });
 return {enemyId:data.enemyActions[index].enemyId,flow,options,events,damageChecks,
  summary:{prepares:prepares.length,releaseActions:new Set(releases.map(e=>e.actionId)).size,
   damageEntries:releases.length,basic:events.filter(e=>e.kind==='basic').length,crossingObserved}};
}
const runs=[];
for(const flow of ['strict','gauge'] as const){for(let i=0;i<4;i++)runs.push(trace(i,flow));runs.push(trace(3,flow,{hpCross:true}));runs.push(trace(3,flow,{missingSkill:true}));}
const report={ok:true,scope:'4 authored AIs; actual runtime, synthetic skill dependencies, read-only prototype; no live store',
 sourcePath,normalization:'exact EnemyActionPattern and skillIds preserved; JSON readback',hpBoundaries,conditionSamples,runs,
 fixtureOverrides:{actors:{maxHp:2000,maxMp:100,attack:20,agility:60,initialEquipment:{},hpCrossFirstActorAttack:140},
  enemies:stats,skills:'design.skillRequirements; no actual skills-role records available'},
 limits:['real skills/monster art/balance integration pending','actor durability 2000 for long traces; damage checks use original prototype L1 HP',
 'PNG is a review board, not player screenshot','full gates/vitest/typecheck not run']};
writeFileSync(resolve(own,'smoke-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,scenarios:runs.length,normalization:4,hpBoundaries,runs:runs.map(({enemyId,flow,options,summary})=>({enemyId,flow,options,...summary}))},null,2));
