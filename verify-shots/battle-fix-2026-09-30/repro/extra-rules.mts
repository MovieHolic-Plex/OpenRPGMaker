import { writeFileSync } from 'node:fs';
import { createBlankProject } from '../../src/project/defaults/blankProject';
import { createBattleRuntime } from '../../src/battle/runtime';
import { predictSkillDamageFor } from '../../src/battle/battlePredict';
import { normalizeStateRecord, normalizeSkillRecord } from '../../src/project/databaseRecordModel';
import { collectWebExportAssets } from '../../src/project/webExportAssets';
import { CHARSET_BATTLERS } from '../../src/assets/charsetBattlers';
import { ensureRetroRosterRecords } from '../../src/project/defaults/defaultDatabase';
import { collectProjectReferenceIssues } from '../../src/project/io/references';
import { deserialize, serialize } from '../../src/project/io';

const report: Record<string, unknown> = {};
function setup() {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const enemy = project.database.enemies[0]!;
  const troop = project.database.troops.find(t => t.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.enemyIds = [enemy.id]; troop.members = [{ enemyId: enemy.id, x: 100, y: 100 }]; troop.battleEventPages = [];
  actor.initialEquipment = {}; actor.learnedSkills = [];
  actor.parameterCurves.maxHp = Array(99).fill(500); actor.parameterCurves.maxMp = Array(99).fill(100);
  actor.parameterCurves.agility = Array(99).fill(10);
  enemy.stats = { ...enemy.stats, maxHp: 9999, maxMp: 100, attack: 1, defense: 1, agility: 999 };
  enemy.actions = [];
  return { project, actor, enemy, troop };
}
function start(s: ReturnType<typeof setup>, flow: 'gauge' | 'strict', extra: object = {}) {
  return createBattleRuntime({ project: s.project, troopId: s.troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
    party: { levels: { [s.actor.id]: 1 }, experience: {}, partyActorIds: [s.actor.id], ...extra } });
}
function stopSkill(s: ReturnType<typeof setup>, self: boolean, recovery: number) {
  const stop = normalizeStateRecord({ id: 'state_audit_stop', name: '감사 스톱', runtimeEffects: { freezesGauge: true, restrictsAction: true, removeOnBattleEnd: false }, recoverNaturallyFromTurn: recovery, recoverNaturallyChance: recovery === 2 ? 100 : 0 });
  s.project.database.states.push(stop);
  const skill = normalizeSkillRecord({ id: 'skill_audit_stop', name: '감사 스톱', scope: self ? 'self' : 'enemy', mpCost: { flat: 0, percentMax: 0 }, power: 0, successRate: 100, hitRate: 100,
    effect: { kind: 'support' }, stateEffects: [{ stateId: stop.id, operation: 'add', chance: 100 }] });
  s.project.database.skills.push(skill);
  s.enemy.actions = [{ skillId: skill.id, priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  return stop;
}
import { resolveRetroClassChoreography, resolveRetroMonsterChoreography } from '../../src/assets/retroSkillCatalog';
import { resolveAssetResourceUrl } from '../../src/assets/generatedAssetResourceResolver';
import { registerExportAssetBase, registerInlineAssets } from '../../src/assets/inlineAssetStore';
for (const statistic of ['attack','mind'] as const) {
 const s=setup(); s.enemy.stats.defense=20;s.enemy.stats.mind=20;
 s.actor.parameterCurves.attack=Array(99).fill(0);s.actor.parameterCurves.mind=Array(99).fill(0);
 s.project.database.states.push(normalizeStateRecord({id:'audit_protect',name:'보호',runtimeEffects:{physicalDefenseMultiplier:statistic==='attack'?2.5:1,magicDefenseMultiplier:statistic==='mind'?2.5:1}}));
 s.enemy.stateRates.audit_protect='A';
 const protect=normalizeSkillRecord({id:'audit_protect_skill',name:'보호',scope:'self',effect:{kind:'support'},stateEffects:[{stateId:'audit_protect',chance:100,operation:'add'}],successRate:100,hitRate:100,mpCost:{flat:0,percentMax:0}});
 const damage=normalizeSkillRecord({id:'audit_damage',name:'피해',scope:'enemy',power:100,effect:{kind:'damage',statistic,affects:'hp'},variance:0,criticalRate:0,successRate:100,hitRate:100,mpCost:{flat:0,percentMax:0}});
 s.project.database.skills.push(protect,damage);s.enemy.actions=[{skillId:protect.id,priority:50,condition:{kind:'always'},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
 const rt=start(s,'strict',{skillIds:{[s.actor.id]:[damage.id]}});rt.performActorCommand({kind:'defend'});
 let snap=rt.snapshot();const p=predictSkillDamageFor(s.project,snap.actors[0]!,damage,snap.enemies[0]!).amount;
 rt.performActorCommand({kind:'skill',skillId:damage.id,targetEnemyId:'enemy-1'});
 const a=rt.snapshot().timeline.filter(e=>e.kind==='damage'&&e.userRecordId===s.actor.id).at(-1)?.amount;
 damage.damageFormula=statistic==='attack'?'100-b.def':'100-b.mind';snap=rt.snapshot();const fp=predictSkillDamageFor(s.project,snap.actors[0]!,damage,snap.enemies[0]!).amount;
 rt.performActorCommand({kind:'skill',skillId:damage.id,targetEnemyId:'enemy-1'});const fa=rt.snapshot().timeline.filter(e=>e.kind==='damage'&&e.userRecordId===s.actor.id).at(-1)?.amount;
 report[statistic+'Defense']={predicted:p,actual:a,formulaPredicted:fp,formulaActual:fa,fixed:p===75&&a===75&&fp===50&&fa===50};
}
{
 const s=setup();s.actor.parameterCurves.agility=Array(99).fill(999);s.enemy.stats.agility=1;
 s.project.database.states.push(normalizeStateRecord({id:'audit_joy',name:'기쁨',emotion:{family:'joy',tier:1}}),normalizeStateRecord({id:'audit_anger',name:'분노',emotion:{family:'anger',tier:1}}));
 s.project.system.emotionCycle=[{attackerFamily:'joy',targetFamily:'anger',multiplier:2}];s.enemy.stateRates.audit_anger='A';
 const skill=normalizeSkillRecord({id:'audit_emotion',name:'감정 연타',scope:'enemy',damageFormula:'100',hitSequence:[1,1],stateEffects:[{stateId:'audit_anger',chance:100,operation:'add'}],effect:{kind:'damage',statistic:'attack',affects:'hp'},variance:0,criticalRate:0,successRate:100,hitRate:100,mpCost:{flat:0,percentMax:0}});
 s.project.database.skills.push(skill);const rt=start(s,'strict',{stateIds:{[s.actor.id]:['audit_joy']},skillIds:{[s.actor.id]:[skill.id]}});const snap=rt.snapshot();const p=predictSkillDamageFor(s.project,snap.actors[0]!,skill,snap.enemies[0]!).amount;
 rt.performActorCommand({kind:'skill',skillId:skill.id,targetEnemyId:'enemy-1'});const amounts=rt.snapshot().timeline.filter(e=>e.kind==='damage'&&e.userRecordId===s.actor.id).map(e=>e.amount);report.emotion={predicted:p,amounts,fixed:p===300&&amounts.join(',')==='100,200'};
}
{
 const s=setup();const stop=stopSkill(s,true,99);const rt=start(s,'gauge',{stateIds:{[s.actor.id]:[stop.id]}});rt.tick(100000);rt.tick(1000000);const snap=rt.snapshot();report.permanentStop={turn:snap.turn,result:snap.result,fixed:snap.result==='escape'&&snap.turn===200};
}
{
 const cases=[{id:'skill_ranger_snipe',retroChoreographyId:'skill_mon_acid_spit'},{id:'skill_mon_acid_spit',retroChoreographyId:'skill_ranger_snipe'},{id:'custom_class',retroChoreographyId:'skill_ranger_snipe'},{id:'custom_mon',retroChoreographyId:'skill_mon_acid_spit'}];
 report.contractPrecedence=cases.map(r=>({record:r,class:resolveRetroClassChoreography(r)?.id,monster:resolveRetroMonsterChoreography(r)?.id}));
 const s=setup();const mage=s.project.database.actors.find(a=>a.id==='actor_mage')!;const cast=CHARSET_BATTLERS.find(c=>c.resourceId===mage.battleCharacterResourceId)!;
 registerExportAssetBase(new URL('https://example.test/games/mage/'));const nested=resolveAssetResourceUrl(cast.resourceId+'-cast',{project:s.project});registerInlineAssets({[cast.castPath!]:'data:image/png;base64,AQ=='});const inline=resolveAssetResourceUrl(cast.resourceId+'-cast',{project:s.project});registerExportAssetBase(null);registerInlineAssets(null);
 report.castRouting={nested,inline,fixed:nested==='https://example.test/games/mage/'+cast.castPath&&inline==='data:image/png;base64,AQ=='};
 const override=s.project.database.skills.find(x=>x.id==='skill_squire_triple_cut')!;override.name='저자의 삼연격';override.hitSequence=[0.2,0.3];ensureRetroRosterRecords(s.project);const restored=deserialize(serialize(deserialize(serialize(s.project))));report.authorPreservation={name:restored.database.skills.find(x=>x.id===override.id)?.name,hits:restored.database.skills.find(x=>x.id===override.id)?.hitSequence,idempotent:ensureRetroRosterRecords(s.project)===false};
}
writeFileSync('verify-shots/battle-fix-2026-09-30/extra-rules.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
