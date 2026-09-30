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
{
  const s = setup(); const stop = stopSkill(s, false, 99); const rt = start(s, 'strict');
  rt.performActorCommand({ kind: 'attack', targetEnemyId: 'enemy-1' });
  const snap = rt.snapshot();
  const addedIndex = snap.timeline.findIndex(e => e.kind === 'stateAdded' && e.targetId === s.actor.id);
  const attackIndex = snap.timeline.findIndex(e => e.kind === 'damage' && e.userRecordId === s.actor.id);
  report.strictStop = { actor: s.actor.id, addedIndex, attackIndex, reproduced: addedIndex >= 0 && attackIndex > addedIndex, actorStateIds: snap.actors[0]?.stateIds, timeline: snap.timeline.slice(0, 8), totalTimelineEntries: snap.timeline.length };
}
{
  const s = setup(); const stop = stopSkill(s, true, 2); const rt = start(s, 'gauge', { stateIds: { [s.actor.id]: [stop.id] } });
  rt.tick(100000); const first = rt.snapshot();
  for (let i = 0; i < 20; i++) rt.tick(100000);
  const last = rt.snapshot();
  report.freezeDeadlock = { simulatedMs: 2100000, naturalRecovery: { fromTurn: 2, chance: 100 }, first: { phase: first.phase, turn: first.turn, actors: first.actors.map(a => ({ states: a.stateIds, turns: a.stateTurns, gauge: a.gauge })), enemies: first.enemies.map(a => ({ states: a.stateIds, turns: a.stateTurns, gauge: a.gauge })) },
    last: { phase: last.phase, turn: last.turn, actors: last.actors.map(a => ({ states: a.stateIds, turns: a.stateTurns, gauge: a.gauge })), enemies: last.enemies.map(a => ({ states: a.stateIds, turns: a.stateTurns, gauge: a.gauge })) },
    reproduced: first.turn === last.turn && last.phase === 'charging' && last.actors.every(a => a.stateIds.includes(stop.id)) && last.enemies.every(a => a.stateIds.includes(stop.id)) };
}
{
  const s = setup(); s.actor.parameterCurves.agility = Array(99).fill(999); s.enemy.stats.agility = 1;
  s.troop.enemyIds = [s.enemy.id, s.enemy.id]; s.troop.members = [{ enemyId: s.enemy.id, x: 90, y: 90 }, { enemyId: s.enemy.id, x: 130, y: 110 }];
  const picked = normalizeSkillRecord({ id: 'skill_audit_picked', name: '감사 전체 피해 10', scope: 'allEnemies', mpCost: { flat: 0, percentMax: 0 }, power: 10, damageFormula: '10', variance: 0, criticalRate: 0, successRate: 100, hitRate: 100, effect: { kind: 'damage', statistic: 'attack', affects: 'hp' }, stateEffects: [] });
  const wrapper = normalizeSkillRecord({ ...picked, id: 'skill_audit_random', name: '감사 무작위 전체', effect: { kind: 'randomSkillFrom', skillIds: [picked.id] } });
  s.project.database.skills.push(picked, wrapper); const rt = start(s, 'strict', { skillIds: { [s.actor.id]: [wrapper.id] } });
  rt.performActorCommand({ kind: 'skill', skillId: wrapper.id }); const snap = rt.snapshot();
  const hits = snap.timeline.filter(e => e.kind === 'damage' && e.userRecordId === s.actor.id);
  report.randomAoe = { enemies: snap.enemies.map(e => ({ id: e.id, hp: e.hp, hpLoss: e.maxHp - e.hp })), hits, reproduced: hits.length === 4 && snap.enemies.every(e => e.maxHp - e.hp === 20) };
}
for (const kind of ['hpCost', 'drain'] as const) {
  const s = setup(); s.actor.parameterCurves.agility = Array(99).fill(999); s.enemy.stats.agility = 1;
  const skill = normalizeSkillRecord({ id: 'skill_audit_' + kind, name: '감사 ' + kind, scope: 'enemy', mpCost: { flat: 0, percentMax: 0 }, power: 10, damageFormula: 'a.hp', variance: 0, criticalRate: 0, successRate: 100, hitRate: 100,
    effect: { kind: 'damage', statistic: 'attack', affects: 'hp' }, stateEffects: [], ...(kind === 'hpCost' ? { hpCostPercent: 50, hitSequence: [1] } : { drainPercent: 50, hitSequence: [1, 1] }) });
  s.project.database.skills.push(skill); const rt = start(s, 'strict', { skillIds: { [s.actor.id]: [skill.id] }, vitals: { [s.actor.id]: { hp: kind === 'hpCost' ? 500 : 100, mp: 100 } } });
  const before = rt.snapshot(); const predicted = predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!);
  rt.performActorCommand({ kind: 'skill', skillId: skill.id, targetEnemyId: 'enemy-1' }); const snap = rt.snapshot();
  const hits = snap.timeline.filter(e => e.kind === 'damage' && e.userRecordId === s.actor.id && e.targetId === 'enemy-1'); const actual = hits.reduce((total, e) => total + (e.amount ?? 0), 0);
  report[kind + 'Prediction'] = { predicted: predicted.amount, actual, hits, actorHpAfter: snap.actors[0]!.hp, reproduced: predicted.amount !== actual };
}
{
  const s = setup(); s.actor.parameterCurves.agility = Array(99).fill(999); s.enemy.stats.agility = 1;
  const el = s.project.database.elements.find(e => e.damageMultipliers)!;
  el.damageMultipliers = { A: 200, B: 150, C: 100, D: 50, E: 0 };
  s.enemy.elementRates[el.id] = 'C';
  s.project.database.states.push(normalizeStateRecord({ id: 'state_audit_wet', name: '감사 젖음', runtimeEffects: { elementRates: { [el.id]: 'A' }, removeOnBattleEnd: false } }));
  s.enemy.stateRates.state_audit_wet = 'A';
  const skill = normalizeSkillRecord({ id: 'skill_audit_wet', name: '감사 약점 2타', scope: 'enemy', mpCost: { flat: 0, percentMax: 0 }, power: 100, damageFormula: '100', variance: 0, criticalRate: 0, successRate: 100, hitRate: 100, elementId: el.id,
    effect: { kind: 'damage', statistic: 'mind', affects: 'hp' }, stateEffects: [{ stateId: 'state_audit_wet', operation: 'add', chance: 100 }], hitSequence: [1, 1] });
  s.project.database.skills.push(skill); const rt = start(s, 'strict', { skillIds: { [s.actor.id]: [skill.id] } });
  const before = rt.snapshot(); const predicted = predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!);
  rt.performActorCommand({ kind: 'skill', skillId: skill.id, targetEnemyId: 'enemy-1' }); const snap = rt.snapshot();
  const amounts = snap.timeline.filter(e => e.kind === 'damage' && e.userRecordId === s.actor.id && e.targetId === 'enemy-1').map(e => e.amount); const actual = amounts.reduce((a, b) => a + (b ?? 0), 0);
  report.stateElementPrediction = { predicted: predicted.amount, actual, amounts, targetStates: snap.enemies[0]?.stateIds, reproduced: predicted.amount !== actual };
}
{
  const s = setup(); const p = s.project; const actor = structuredClone(s.actor); const klass = structuredClone(p.database.classes.find(c => c.id === actor.classId)!);
  actor.id = 'actor_audit_custom'; actor.classId = 'class_audit_custom'; actor.initialEquipment = {}; actor.learnedSkills = []; actor.stateRates = {}; actor.elementRates = {};
  klass.id = 'class_audit_custom'; klass.skillIds = []; klass.learnedSkills = []; klass.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] }; klass.stateRates = {}; klass.elementRates = {};
  for (const key of ['actors', 'classes', 'skills', 'equipment', 'items', 'enemies', 'troops', 'states', 'monsterSpecies']) (p.database as any)[key] = [];
  delete actor.unarmedAnimationId;delete klass.animationId;p.database.battleAnimations=[];p.database.elements=[];p.database.actors = [actor]; p.database.classes = [klass]; p.system.startActorIds = [actor.id]; delete p.system.initialTroopId;
  p.session.partyActorIds = [actor.id];
  for (const map of Object.values(p.maps)) { map.events = []; map.encounters = []; }
  let beforeReload: string = 'ok';
  const beforeIssues = collectProjectReferenceIssues(p);
  try { deserialize(serialize(p)); } catch (e) { beforeReload = String(e); }
  const changed = ensureRetroRosterRecords(p); const afterIssues = collectProjectReferenceIssues(p);
  let afterReload: string = 'ok';
  try { deserialize(serialize(deserialize(serialize(p)))); } catch (e) { afterReload = String(e).split('\n').slice(0, 8).join('\n'); }
  report.customBackfill = { beforeIssueCount: beforeIssues.length, beforeIssues: beforeIssues.slice(0, 10), beforeReload, changed, afterIssueCount: afterIssues.length, afterIssues: afterIssues.slice(0, 16), afterReload, idempotent: ensureRetroRosterRecords(p) === false, reproduced: beforeIssues.length === 0 && beforeReload === 'ok' && afterIssues.length > 0 && afterReload !== 'ok' };
}
{
  const s = setup();
  report.rosterTriple = ['skill_squire_triple_cut', 'skill_noble_triple_thrust'].map(id => {
    const fresh = setup(); fresh.actor.parameterCurves.agility = Array(99).fill(999); fresh.enemy.stats.agility = 1;
    const sk = fresh.project.database.skills.find(x => x.id === id); const rt = start(fresh, 'strict', { skillIds: { [fresh.actor.id]: [id] } });
    rt.performActorCommand({ kind: 'skill', skillId: id, targetEnemyId: 'enemy-1' });
    const hits = rt.snapshot().timeline.filter(e => e.kind === 'damage' && e.userRecordId === fresh.actor.id && e.targetId === 'enemy-1');
    return { id, name: sk?.name, hitSequence: sk?.hitSequence ?? [1], scope: sk?.scope, description: sk?.description, actualHitCount: hits.length, amounts: hits.map(e => e.amount) };
  });
  const paths = collectWebExportAssets(s.project).map(a => a.zipPath);
  const mage = s.project.database.actors.find(a => a.id === 'actor_mage');
  const cast = CHARSET_BATTLERS.find(a => a.resourceId === mage?.battleCharacterResourceId);
  report.castExport = { actor: mage?.id, resource: mage?.battleCharacterResourceId, basePath: cast?.path, castPath: cast?.castPath, baseIncluded: paths.includes(cast?.path ?? ''), castIncluded: paths.includes(cast?.castPath ?? ''), collectedCastPaths: paths.filter(p => p.includes('charset-battlers/cast/')), collectedBaseCount: paths.filter(p => p.includes('charset-battlers/') && !p.includes('/cast/')).length };
}
writeFileSync('verify-shots/battle-merge-2026-10-01/rules-probe.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
