// Scoped, deterministic content smoke. In-memory fixture only; no storage calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createBlankProject } from '@/project/defaults/blankProject';
import { normalizeDatabaseRecords, normalizeSkillRecord, normalizeStateRecord } from '@/project/databaseRecordModel';
import { normalizeElementRecords } from '@/project/databaseUtilityRecordModel';
import { resolveSkillChoreography } from '@/assets/retroSkillCatalog';
import { createBattleRuntime } from '@/battle/runtime';
import { advanceBattleRuntime } from '@/battle/battleRuntimeAdvance';
import { stateBehavior, applyStateEffects, runStateUpkeep, canBattlerAct, stateBlocksSkillUse, defenseMultiplierForStatesByKind, attackMultiplierForStates, evasionChanceForStates } from '@/battle/battleStates';
import { applySkillLike } from '@/battle/battleDamage';
import type { MutableBattler } from '@/battle/battleBattlers';
import type { SkillRecord, StateRecord, DatabaseElementRecord } from '@/project/types';

const root = 'content-packs/joseon-folklore/skills';
const prototypePath = '/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json';
console.log(readFileSync('/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/steering.md', 'utf8').trim());
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const pack = read(`${root}/data.json`) as { skills: SkillRecord[]; states: StateRecord[]; elements: DatabaseElementRecord[] };
const ids = read('content-packs/joseon-folklore/ids.json');
const prototype = read(prototypePath);
const evidence: Record<string, unknown> = { scope: 'pilot-owned-data-and-in-memory-runtime-fixture', liveProjectWrites: false, browserPlayback: false, checks: [] };
const checks = evidence.checks as unknown[];
const passed = (check: string, observed: unknown) => checks.push({ check, observed, result: 'pass' });
const byId = new Map(pack.skills.map(s => [s.id,s]));
const stateById = new Map(pack.states.map(s => [s.id,s]));
assert.equal(pack.skills.length,12);assert.equal(pack.states.length,6);assert.equal(pack.elements.length,5);
assert.equal(new Set(pack.skills.map(s=>s.id)).size,12);
for (const skill of pack.skills) {
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeSkillRecord(skill))), skill);
  assert.equal(skill.resource2Cost,undefined);
  assert.ok(!skill.id.startsWith('ownskill_jf_item_'));
  assert.ok(resolveSkillChoreography(skill));
  for (const effect of skill.stateEffects ?? []) assert.ok(stateById.has(effect.stateId) || prototype.states.some((s: StateRecord)=>s.id===effect.stateId));
}
for (const state of pack.states) assert.deepEqual(JSON.parse(JSON.stringify(normalizeStateRecord(state))),state);
assert.deepEqual(normalizeElementRecords(pack.elements),pack.elements);
for (const c of read(`${root}/choreography-sources.json`)) for (const l of c.layers) assert.equal(createHash('sha256').update(readFileSync(l.path)).digest('hex'),l.sha256);
passed('normalize JSON roundtrip; reserved IDs; existing source FX hashes', {skills:12,states:6,elements:5});

function project() {
  const p = createBlankProject();
  p.database = normalizeDatabaseRecords({ ...prototype, skills:[...prototype.skills,...pack.skills], states:[...prototype.states,...pack.states], elements:[...prototype.elements,...pack.elements] });
  p.system.battleModel='rm2k3';p.system.battleUiStyle='retro2003';
  return p;
}
const p=project();
function battler(): MutableBattler {
  return {id:'probe',recordId:p.database.actors[0].id,name:'probe',maxHp:200,maxMp:100,hp:80,mp:100,attackPower:40,defense:20,mind:30,agility:30,chargeRate:1,skillIds:[],stateIds:[],stateTurns:{},gauge:0} as MutableBattler;
}
const iron=ids.states['iron-breath'],seal=ids.states['ghost-seal'];
const target=battler();
applyStateEffects(p,target,byId.get(ids.classSkills.warrior[1])!.stateEffects,()=>0);
assert.equal(defenseMultiplierForStatesByKind(p,target,'attack'),1.6);
assert.equal(defenseMultiplierForStatesByKind(p,target,'mind'),1);
for(let i=0;i<2;i++){runStateUpkeep(p,target,()=>0);assert.ok(target.stateIds.includes(iron));}
runStateUpkeep(p,target,()=>0);assert.ok(!target.stateIds.includes(iron));
passed('쇠숨: physical-only defense and self-upkeep expiry',{attackDefense:1.6,mindDefense:1,expiresAtSelfUpkeep:3});
applyStateEffects(p,target,[{stateId:seal,chance:100,operation:'add'}],()=>0);
assert.equal(stateBlocksSkillUse(p,target),true);assert.equal(canBattlerAct(p,target),true);
runStateUpkeep(p,target,()=>0);assert.ok(target.stateIds.includes(seal));runStateUpkeep(p,target,()=>0);assert.ok(!target.stateIds.includes(seal));
passed('귀봉: skills blocked, basic action permitted, deterministic expiry',{upkeep:2,restrictsAction:false});
target.stateIds=[ids.states['shadow-step']];assert.equal(evasionChanceForStates(p,target),30);
target.stateIds=[ids.states['protective-talisman']];assert.equal(defenseMultiplierForStatesByKind(p,target,'attack'),1.4);assert.equal(defenseMultiplierForStatesByKind(p,target,'mind'),1.4);
target.stateIds=[ids.states['fox-charm']];assert.equal(attackMultiplierForStates(p,target),0.75);
target.stateIds=[ids.states['heaven-blessing']];target.stateTurns={};target.hp=80;runStateUpkeep(p,target,()=>0);assert.equal(target.hp,90);
passed('reserved support definitions: evasion/protect/charm/blessing',{physicalEvasion:30,defenseSplit:1.4,foxAttack:0.75,blessingHpTick:10});
target.stateIds=['state_poison'];target.stateTurns={};target.hp=80;runStateUpkeep(p,target,()=>0.99);assert.equal(target.hp,68);
target.hp=5;runStateUpkeep(p,target,()=>0.99);assert.equal(target.hp,1);
target.stateIds=byId.get(ids.classSkills.taoist[1])!.stateEffects!.map(e=>e.stateId);target.stateTurns={};
const purify=applyStateEffects(p,target,byId.get(ids.classSkills.taoist[1])!.stateEffects,()=>0.99);
assert.equal(purify.removed.length,5);assert.equal(target.stateIds.length,0);
passed('existing poison and actual cleanse list',{poisonMaxHpPercent:6,poisonHpFloor:1,removed:purify.removed});
const life=byId.get(ids.classSkills.taoist[0])!;
target.hp=80;
const healed=applySkillLike(battler(),target,{power:life.power,damageFormula:life.damageFormula,statistic:'mind',effect:'healing',affects:'hp',variance:life.variance,criticalRate:life.criticalRate,rng:()=>0.5});
assert.equal(healed.amount,45);assert.equal(target.hp,125);
passed('생명수: exact HP recovery with runtime damage formula',{amount:healed.amount,hpAfter:target.hp});

function setup(skillId?: string, flow:'strict'|'gauge'='strict', partyExtra: Record<string,unknown>={}) {
  const pr=project(),hero=pr.database.actors[0],second=structuredClone(hero),enemy=pr.database.enemies[0];
  second.id='actor_jf_probe_two';second.name='probe2';pr.database.actors.push(second);
  for(const a of [hero,second]){
    a.initialEquipment={};a.learnedSkills=pack.skills.slice(0,8).map(s=>({level:1,skillId:s.id}));
    a.parameterCurves.maxHp=Array(99).fill(2000);a.parameterCurves.maxMp=Array(99).fill(200);a.parameterCurves.attack=Array(99).fill(40);a.parameterCurves.defense=Array(99).fill(20);a.parameterCurves.mind=Array(99).fill(30);a.parameterCurves.agility=Array(99).fill(60);
  }
  for(const cl of pr.database.classes){cl.learnedSkills=[];cl.skillIds=[];cl.parameterCurves=undefined;}
  enemy.stats={...enemy.stats,maxHp:99999,maxMp:999,attack:30,defense:20,mind:20,agility:60};
  enemy.elementRates={};enemy.stateRates={};
  enemy.actions=[{skillId:skillId??'skill_attack',priority:50,condition:{kind:'always'},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
  enemy.skillIds=[skillId??'skill_attack'];
  const tr=pr.database.troops[0];tr.enemyIds=[enemy.id];tr.members=[{enemyId:enemy.id,x:80,y:80}];tr.battleEventPages=[];
  const rt=createBattleRuntime({project:pr,troopId:tr.id,canEscape:false,canLose:true,battleFlow:flow,rng:()=>0.1,
    party:{levels:{[hero.id]:1,[second.id]:1},experience:{},partyActorIds:[hero.id,second.id],...partyExtra}});
  return {rt,pr,hero,second};
}
for(const skill of pack.skills.slice(0,8)){
  const {rt,hero}=setup();advanceBattleRuntime(rt);
  let snap=rt.snapshot();assert.equal(snap.phase,'actorCommand');
  const user=snap.actors.find(a=>a.recordId===hero.id)!;
  const before=user.mp;
  const command = {kind:'skill' as const,skillId:skill.id,...(skill.scope==='enemy'?{targetEnemyId:snap.enemies[0].id}:{targetActorId:user.id})};
  rt.performActorCommand(command);
  // Strict flow queues a full party round before spending MP/applying effects.
  if(rt.snapshot().phase==='actorCommand') rt.performActorCommand({kind:'defend'});
  advanceBattleRuntime(rt);
  snap=rt.snapshot();
  const after=snap.actors.find(a=>a.recordId===hero.id)!;
  assert.equal(before-after.mp,skill.mpCost.flat,skill.id+' MP');
  const tl=snap.timeline.filter(t=>t.skillId===skill.id);
  assert.ok(tl.length>0,skill.id+' no runtime effect');
  if(skill.id===ids.classSkills.rogue[0]) assert.equal(tl.filter(t=>t.kind==='damage').length,2);
  if(skill.id===ids.classSkills.warrior[1]) assert.ok(after.stateIds.includes(iron));
  passed('actor skill '+skill.id,{mpConsumed:before-after.mp,timeline:tl.map(t=>({kind:t.kind,amount:t.amount,targetId:t.targetId}))});
}
for(const skill of pack.skills.slice(8)){
  for(const flow of skill.chargeTurns?['strict','gauge'] as const:['strict'] as const){
    const {rt}=setup(skill.id,flow);const chargingViews: unknown[]=[];
    for(let i=0;i<16;i++){
      advanceBattleRuntime(rt);let snap=rt.snapshot();
      if(snap.enemies[0].charging) chargingViews.push(snap.enemies[0].charging);
      if(snap.phase==='actorCommand')rt.performActorCommand({kind:'defend'});
      snap=rt.snapshot();
      if(snap.timeline.some(t=>t.skillId===skill.id&&(t.kind==='damage'||t.kind==='action')))break;
    }
    const snap=rt.snapshot(),tl=snap.timeline;
    const actions=tl.filter(t=>t.side==='enemy'&&t.skillId===skill.id&&(t.kind==='damage'||t.kind==='action'));
    assert.ok(actions.length>0,skill.id+' '+flow+' absent');
    if(skill.scope==='allEnemies')assert.equal(new Set(actions.map(t=>t.targetId)).size,2);
    if(skill.chargeTurns){
      const pre=tl.findIndex(t=>t.side==='enemy'&&t.charge===true);
      const hit=tl.findIndex(t=>t.side==='enemy'&&t.skillId===skill.id&&t.kind==='damage');
      assert.ok(pre>=0&&hit>pre);assert.equal(tl[pre].skillId,undefined);assert.ok(chargingViews.length>0);
    }
    passed('enemy skill '+skill.id+' '+flow,{actions:actions.map(t=>({kind:t.kind,amount:t.amount,targetId:t.targetId})),chargeAnnouncements:tl.filter(t=>t.charge),chargingViews,enemyMp:snap.enemies[0].mp});
  }
}
// Revive contract compatibility only: no extra authored skill and no item-owned ID.
{
  const {rt,pr,hero,second}=setup(undefined,'strict');
  const revive=normalizeSkillRecord({id:'probe_jf_revive_contract',name:'probe only',scope:'ally',power:40,damageFormula:'40',effect:{kind:'healing',statistic:'mind',affects:'hp'},mpCost:{flat:0,percentMax:0},stateEffects:[{stateId:'state_death',chance:100,operation:'remove'}],variance:0});
  pr.database.skills.push(revive);hero.learnedSkills.push({level:1,skillId:revive.id});
  // Restart once with a dead teammate, so runtime builds its learned-skill snapshot.
  const runtime=createBattleRuntime({project:pr,troopId:pr.database.troops[0].id,canEscape:false,canLose:true,battleFlow:'strict',rng:()=>0.1,
    party:{levels:{[hero.id]:1,[second.id]:1},experience:{},partyActorIds:[hero.id,second.id],vitals:{[hero.id]:{hp:2000,mp:200},[second.id]:{hp:0,mp:100}}}});
  advanceBattleRuntime(runtime);const before=runtime.snapshot();
  const dead=before.actors.find(a=>a.recordId===second.id)!;assert.equal(dead.hp,0);
  runtime.performActorCommand({kind:'skill',skillId:revive.id,targetActorId:dead.id});
  const after=runtime.snapshot().actors.find(a=>a.recordId===second.id)!;assert.ok(after.hp>0);
  passed('engine revive contract only (not published data)',{beforeHp:0,afterHp:after.hp,authoredReviveInPilot:false});
}
evidence.result='pass';evidence.checkCount=checks.length;
evidence.prototypeSha256=createHash('sha256').update(readFileSync(prototypePath)).digest('hex');
evidence.dataSha256=createHash('sha256').update(readFileSync(`${root}/data.json`)).digest('hex');
writeFileSync(`${root}/smoke-results.json`,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,checkCount:checks.length,skills:12,states:6,elements:5,liveProjectWrites:false}));
