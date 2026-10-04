// Scoped, deterministic content smoke. Memory runtime + owned local serializer fixture; no live storage calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serialize, deserialize } from '@/project/io/serialize';
import { collectProjectReferenceIssues } from '@/project/io/references';
import { spendSkillHp, restoreSkillDrain } from '@/battle/battleSkillVitals';
import { mergeStateDefaults } from './merge-state-defaults.mts';
import { createBlankProject } from '@/project/defaults/blankProject';
import { normalizeDatabaseRecords, normalizeSkillRecord, normalizeStateRecord } from '@/project/databaseRecordModel';
import { normalizeElementRecords } from '@/project/databaseUtilityRecordModel';
import { resolveSkillChoreography } from '@/assets/retroSkillCatalog';
import { createBattleRuntime } from '@/battle/runtime';
import { advanceBattleRuntime } from '@/battle/battleRuntimeAdvance';
import { stateBehavior, stateResistancePercent, applyStateEffects, runStateUpkeep, canBattlerAct, stateBlocksSkillUse, defenseMultiplierForStatesByKind, attackMultiplierForStates, evasionChanceForStates } from '@/battle/battleStates';
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
const evidence: Record<string, unknown> = { scope: 'full-owned-data-and-local-roundtrip-runtime-fixture', liveProjectWrites: false, browserPlayback: false, checks: [] };
const checks = evidence.checks as unknown[];
const passed = (check: string, observed: unknown) => checks.push({ check, observed, result: 'pass' });
const byId = new Map(pack.skills.map(s => [s.id,s]));
const stateById = new Map(pack.states.map(s => [s.id,s]));
assert.equal(pack.skills.length,36);assert.equal(pack.states.length,10);assert.equal(pack.elements.length,5);
assert.equal(new Set(pack.skills.map(s=>s.id)).size,36);
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
passed('normalize JSON roundtrip; reserved IDs; existing source FX hashes', {skills:36,states:10,elements:5});

function project() {
  const p = createBlankProject();
  p.database = normalizeDatabaseRecords({ ...prototype, skills:[...prototype.skills,...pack.skills], states:mergeStateDefaults(prototype.states,pack.states), elements:[...prototype.elements,...pack.elements] });
  p.system.battleModel='rm2k3';p.system.battleUiStyle='retro2003';
  return p;
}
const design=read(`${root}/design.json`);
assert.deepEqual(pack.skills.map(s=>s.id), [...Object.values(ids.classSkills).flat(),...Object.values(ids.enemySkills)]);
for(const role of design.learnedSkills)assert.deepEqual(role.skills.map((s:any)=>s.level),[1,3,5,8,12,16]);
assert.equal(design.learnedSkills.find((c:any)=>c.classId===ids.classes.taoist).skills[3].skillId,ids.classSkills.taoist[3]);
assert.ok(prototype.states.some((s:any)=>s.id==='state_deep_poison'));assert.ok(prototype.states.some((s:any)=>s.id==='state_silence'));
assert.ok(!prototype.states.some((s:any)=>s.id==='state_death'));assert.ok(stateById.has('state_death'));
const merged=mergeStateDefaults(prototype.states,pack.states);
assert.deepEqual(merged.slice(0,prototype.states.length),prototype.states);
assert.equal(merged.filter(s=>s.id==='state_death').length,1);
assert.deepEqual(mergeStateDefaults(merged,pack.states),merged);
const custom={...stateById.get('state_death')!,name:'저자 정의 보존',runtimeEffects:{restrictsAction:false},recoverNaturallyChance:17};
assert.deepEqual(mergeStateDefaults([custom],pack.states)[0],custom);
passed('snapshot/defaults/missing-only merge and learning ledger',{snapshotDeath:false,snapshotDeepPoison:true,snapshotSilence:true,baseDefaults:4,newStates:6,levels:[1,3,5,8,12,16],reviveLevel:8,existingRowsPreserved:prototype.states.length});
{
  const pr=createBlankProject();
  pr.database.skills.push(...structuredClone(pack.skills));
  pr.database.states=mergeStateDefaults(pr.database.states,pack.states);
  pr.database.elements=normalizeElementRecords([...pr.database.elements,...pack.elements]);
  assert.deepEqual(collectProjectReferenceIssues(pr),[]);
  const path=`${root}/.cache/full-roundtrip.oprn.json`;
  writeFileSync(path,serialize(pr));
  let loaded=deserialize(readFileSync(path,'utf8'));
  for(let pass=0;pass<2;pass++){
    assert.deepEqual(collectProjectReferenceIssues(loaded),[]);
    // Compare persisted values: the normalizer exposes optional undefined keys.
    for(const sk of pack.skills)assert.deepEqual(JSON.parse(JSON.stringify(loaded.database.skills.find(s=>s.id===sk.id))),sk);
    assert.deepEqual(loaded.database.states.find(s=>s.id==='state_death'),stateById.get('state_death'));
    loaded=deserialize(serialize(loaded));
  }
  passed('actual project serializer: local save/load/reload and zero reference issues',{file:path,liveProject:false,passes:2,skills:36,stateDeathPresent:true,referenceIssues:0});
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
    a.initialEquipment={};a.learnedSkills=pack.skills.slice(0,24).map(s=>({level:1,skillId:s.id}));
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
// Every published skill gets a numerical magnitude/hit/state-probability sample.
for(const skill of pack.skills){
  const u=battler(),t=battler();u.hp=80;t.hp=80;t.stateIds=[];
  const seq=skill.hitSequence??[1];const amounts:number[]=[];
  const effect=skill.effect.kind;
  if(effect==='damage'||effect==='healing'){
    const stat=skill.effect.statistic;
    for(const multiplier of seq){
      t.hp=80;
      const actual=applySkillLike(u,t,{power:skill.power,damageFormula:skill.damageFormula,statistic:stat,effect,affects:'hp',hitRate:skill.hitRate,variance:0,criticalRate:0,hitMultiplier:multiplier,rng:()=>0.1});
      const base=skill.damageFormula?skill.damageFormula==='power + a.atk / 2'?skill.power+20:Number(skill.damageFormula):skill.power+(stat==='attack'?20:15)-(effect==='damage'?10:0);
      const expected=Math.round(base*multiplier);
      assert.equal(actual.amount,expected,skill.id+' numeric sample');amounts.push(actual.amount);
    }
  }
  const chances=[];
  for(const e of skill.stateEffects??[]){
    const test=battler();test.stateIds=[];test.stateTurns={};
    if(e.operation==='add'){
      const effective=e.chance*stateResistancePercent(p,test,e.stateId)/100;
      assert.ok(applyStateEffects(p,test,[e],()=>Math.max(0,effective/100-0.00001)).added.includes(e.stateId),skill.id+' '+e.stateId);
      if(effective<100){const no=battler();no.stateIds=[];assert.equal(applyStateEffects(p,no,[e],()=>effective/100).added.length,0);}
      chances.push({...e,resistancePercent:stateResistancePercent(p,test,e.stateId),effectiveChance:effective,probabilityBoundaryChecked:effective<100});
    }else{test.stateIds=[e.stateId];assert.ok(applyStateEffects(p,test,[e],()=>0.99).removed.includes(e.stateId));}
    if(e.operation==='remove')chances.push({...e,deterministicRemoval:true});
  }
  const hpCost=spendSkillHp(u,skill);
  assert.equal(hpCost,skill.hpCostPercent?Math.min(79,Math.floor(200*skill.hpCostPercent/100)):0);
  const drain=restoreSkillDrain(u,skill,amounts[0]??0,'hp');
  assert.equal(drain,skill.drainPercent?Math.max(1,Math.floor((amounts[0]??0)*skill.drainPercent/100)):0);
  passed('numeric '+skill.id,{power:skill.power,mp:skill.mpCost.flat,hitSequence:seq,amounts,states:chances,hpCost,drain});
}
for(const skill of pack.skills.slice(0,24)){
  if(skill.id===ids.classSkills.taoist[3])continue; // The real dead-target case below owns this check.
  const {rt,hero}=setup();advanceBattleRuntime(rt);
  let snap=rt.snapshot();assert.equal(snap.phase,'actorCommand');
  const user=snap.actors.find(a=>a.recordId===hero.id)!;const before=user.mp;
  rt.performActorCommand({kind:'skill',skillId:skill.id,...(skill.scope==='enemy'||skill.scope==='allEnemies'?{targetEnemyId:snap.enemies[0].id}:{targetActorId:user.id})});
  for(let i=0;i<12;i++){
    snap=rt.snapshot();
    if(snap.timeline.some(t=>t.skillId===skill.id&&['damage','healing','action'].includes(t.kind)))break;
    if(snap.phase==='actorCommand')rt.performActorCommand({kind:'defend'});
    advanceBattleRuntime(rt);
  }
  snap=rt.snapshot();const after=snap.actors.find(a=>a.recordId===hero.id)!;
  assert.equal(before-after.mp,skill.mpCost.flat,skill.id+' MP');
  const tl=snap.timeline.filter(t=>t.skillId===skill.id);
  assert.ok(tl.length>0,skill.id+' no runtime effect');
  if(skill.effect.kind==='damage')assert.equal(tl.filter(t=>t.kind==='damage'&&t.targetId!==user.id).length,(skill.hitSequence??[1]).length);
  if(skill.scope==='allAllies')assert.equal(new Set(tl.filter(t=>t.kind==='action'||t.kind==='healing').map(t=>t.targetId)).size,2);
  if(skill.chargeTurns){const pre=snap.timeline.findIndex(t=>t.charge===true&&t.side==='actor'),hit=snap.timeline.findIndex(t=>t.skillId===skill.id&&t.kind==='damage');assert.ok(pre>=0&&hit>pre);}
  passed('actor runtime '+skill.id,{mpConsumed:before-after.mp,timeline:tl.map(t=>({kind:t.kind,amount:t.amount,targetId:t.targetId}))});
}
for(const skill of pack.skills.slice(24)){
  for(const flow of skill.chargeTurns?['strict','gauge'] as const:['strict'] as const){
    const {rt}=setup(skill.id,flow);const chargingViews:unknown[]=[];
    for(let i=0;i<20;i++){
      advanceBattleRuntime(rt);let snap=rt.snapshot();
      if(snap.enemies[0].charging)chargingViews.push(snap.enemies[0].charging);
      if(snap.phase==='actorCommand')rt.performActorCommand({kind:'defend'});
      snap=rt.snapshot();
      if(snap.timeline.some(t=>t.skillId===skill.id&&(t.kind==='damage'||t.kind==='action')))break;
    }
    const snap=rt.snapshot(),tl=snap.timeline;
    const actions=tl.filter(t=>t.side==='enemy'&&t.skillId===skill.id&&(t.kind==='damage'||t.kind==='action'));
    assert.equal(actions.length,(skill.scope==='allEnemies'?2:1)*(skill.hitSequence??[1]).length);
    if(skill.scope==='allEnemies')assert.equal(new Set(actions.map(t=>t.targetId)).size,2);
    if(skill.chargeTurns){const pre=tl.findIndex(t=>t.side==='enemy'&&t.charge===true),hit=tl.findIndex(t=>t.side==='enemy'&&t.skillId===skill.id&&(t.kind==='damage'||t.kind==='action'));assert.ok(pre>=0&&hit>pre);assert.equal(tl[pre].skillId,undefined);assert.ok(chargingViews.length>0);}
    assert.equal(999-snap.enemies[0].mp,skill.mpCost.flat);
    passed('enemy runtime '+skill.id+' '+flow,{actions:actions.map(t=>({kind:t.kind,amount:t.amount,targetId:t.targetId})),chargeAnnouncements:tl.filter(t=>t.charge),chargingViews,mpConsumed:999-snap.enemies[0].mp});
  }
}
// Published level8 revival, explicitly dead target with an actual state_death record.
{
  const {pr,hero,second}=setup();const revive=byId.get(ids.classSkills.taoist[3])!;
  const runtime=createBattleRuntime({project:pr,troopId:pr.database.troops[0].id,canEscape:false,canLose:true,battleFlow:'strict',rng:()=>0.1,
    party:{levels:{[hero.id]:8,[second.id]:8},experience:{},partyActorIds:[hero.id,second.id],stateIds:{[second.id]:['state_death']},vitals:{[hero.id]:{hp:2000,mp:200},[second.id]:{hp:0,mp:100}}}});
  advanceBattleRuntime(runtime);const before=runtime.snapshot();const dead=before.actors.find(a=>a.recordId===second.id)!;assert.equal(dead.hp,0);assert.ok(dead.stateIds.includes('state_death'));
  runtime.performActorCommand({kind:'skill',skillId:revive.id,targetActorId:dead.id});
  const after=runtime.snapshot(),healing=after.timeline.find(t=>t.skillId===revive.id&&t.kind==='healing');
  const living=after.actors.find(a=>a.recordId===second.id)!;
  assert.equal(healing?.amount,60);assert.ok(living.hp>0);assert.ok(!living.stateIds.includes('state_death'));
  assert.equal(200-after.actors.find(a=>a.recordId===hero.id)!.mp,12);
  passed('published level8 revive: dead selection, HP60, death removal, MP12',{skillId:revive.id,level:8,beforeHp:0,healAmount:60,hpAfterEnemyTurn:living.hp,stateDeathRemoved:true,mpSpent:12});
}
// Each proposed boss uses the exact published shared record. Standalone local sample.
for(const boss of design.bossTelegraphs){
  for(const flow of ['strict','gauge'] as const){
    const {pr,hero,second}=setup(boss.skillId,flow);const enemy=pr.database.enemies[0],oldId=enemy.id;
    enemy.id=boss.enemyId;enemy.name=boss.enemyId;enemy.stats={...enemy.stats,...boss.sampleStats};
    for(const member of pr.database.troops[0].members??[])if(member.enemyId===oldId)member.enemyId=boss.enemyId;
    pr.database.troops[0].enemyIds=[boss.enemyId];
    const rt=createBattleRuntime({project:pr,troopId:pr.database.troops[0].id,canEscape:false,canLose:true,battleFlow:flow,rng:()=>0.1,party:{levels:{[hero.id]:1,[second.id]:1},experience:{},partyActorIds:[hero.id,second.id],vitals:{[hero.id]:{hp:120,mp:100},[second.id]:{hp:120,mp:100}}}});
    for(let i=0;i<30;i++){advanceBattleRuntime(rt);if(rt.snapshot().phase==='actorCommand')rt.performActorCommand({kind:'defend'});if(rt.snapshot().timeline.some(t=>t.skillId===boss.skillId&&(t.kind==='damage'||t.kind==='action')))break;}
    const snap=rt.snapshot(),tl=snap.timeline,sk=byId.get(boss.skillId)!;
    const pre=tl.findIndex(t=>t.charge&&t.userRecordId===boss.enemyId),hit=tl.findIndex(t=>t.skillId===boss.skillId&&(t.kind==='damage'||t.kind==='action'));
    assert.ok(pre>=0&&hit>pre);assert.equal(tl[pre].skillId,undefined);
    const effects=tl.filter(t=>t.skillId===boss.skillId&&(t.kind==='damage'||t.kind==='action'));
    const expectedDamage=sk.effect.kind==='damage'?Math.floor((sk.power+24-10)/2):0;
    for(const effect of effects)assert.equal(effect.amount,expectedDamage);
    for(const effect of effects)for(const state of sk.stateEffects??[]){
      if(state.operation==='add')assert.ok(snap.actors.find(a=>a.id===effect.targetId)?.stateIds.includes(state.stateId),'boss state not applied');
    }
    assert.ok(snap.actors.every(a=>a.hp>0),'boss sample wiped party');
    passed('boss telegraph '+boss.enemyId+' '+flow,{skillId:boss.skillId,chargeTurns:sk.chargeTurns,announcedBeforeImpact:true,damagePerGuardedTarget:expectedDamage,startingHp:120,remainingHp:snap.actors.map(a=>a.hp),appliedStateIds:snap.actors.map(a=>a.stateIds),mpConsumed:30-snap.enemies[0].mp});
  }
}
evidence.result='pass';evidence.checkCount=checks.length;
evidence.prototypeSha256=createHash('sha256').update(readFileSync(prototypePath)).digest('hex');
evidence.dataSha256=createHash('sha256').update(readFileSync(`${root}/data.json`)).digest('hex');
writeFileSync(`${root}/smoke-results.json`,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,checkCount:checks.length,skills:36,states:10,elements:5,liveProjectWrites:false}));
