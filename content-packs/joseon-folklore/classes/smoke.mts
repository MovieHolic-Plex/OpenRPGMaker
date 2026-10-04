import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeClassRecord, normalizeEquipmentRecord } from '@/project/databaseRecordModel';
import { normalizeActorRecord, totalExpForLevel } from '@/project/actorModel';
import { promoteActor, effectiveActorClassId, classLearnedSkillIdsUpToLevel } from '@/project/sessionClass';
import { actorOwnedSkillIds } from '@/project/growth/runtime';
import { canEquip } from '@/project/equipmentRules';
import { actorDerivedStats } from '@/battle/battleBattlers';
import { battleCommandsForActor } from '@/battle/battleCommands';
import { computeActorLevelUp } from '@/battle/battleLevelUp';
import { applySkillLike } from '@/battle/battleDamage';
import type { ClassRecord, Project, ProjectDatabaseRecords } from '@/project/types';
import type { ClassOverrideSession } from '@/project/sessionClass';
import type { MutableBattler } from '@/battle/battleBattlers';

const here = new URL('./', import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, here), 'utf8'));
const prototypePath = process.env.JF_CLASSES_PROTOTYPE;
assert(prototypePath, 'Set JF_CLASSES_PROTOTYPE to the read-only prototype-database.json');
const prototype: ProjectDatabaseRecords = JSON.parse(readFileSync(prototypePath, 'utf8'));
const input: { classes: ClassRecord[] } = load('data.json');
const ids = load('../ids.json');
const design = load('design.json');
const keys = ['maxHp', 'maxMp', 'attack', 'defense', 'mind', 'agility'] as const;
assert.deepEqual(Object.keys(input), ['classes']);
assert.deepEqual(input.classes.map(c => c.id), Object.values(ids.classes));
const classes = input.classes.map(c => normalizeClassRecord(c));
const novice = classes.find(c => c.id === ids.classes.novice)!;
const jobs = classes.filter(c => c.id !== novice.id);
assert.equal(classes.length, 5);
assert.equal(novice.promotions?.length, 4);
assert.deepEqual(novice.promotions?.map(p => p.toClassId), jobs.map(c => c.id));
assert.deepEqual(novice.equipmentPermissions.equipmentIds, []);
assert.equal(new Set(classes.map(c => c.id)).size, 5);
for (const c of classes) {
  const source = input.classes.find(s => s.id === c.id)!;
  assert.deepEqual(c.parameterCurves, source.parameterCurves, `${c.id}: normalization must preserve authored 99-cell curves`);
  assert.deepEqual(c.learnedSkills, source.learnedSkills);
  assert.deepEqual(c.skillIds, source.skillIds);
  assert.deepEqual(c.expCurve, source.expCurve);
  assert.deepEqual(c.equipmentPermissions.actorIds, []);
  assert.deepEqual(c.equipmentPermissions.classIds, []);
  for (const key of keys) {
    const curve = c.parameterCurves[key];
    assert.equal(curve.length, 99);
    assert(curve.every(v => Number.isInteger(v) && v > 0));
    assert(curve.every((v, i) => i === 0 || v >= curve[i - 1]));
    assert(curve.slice(20).every(v => v === curve[19]));
  }
  if (c.id !== novice.id) {
    assert.equal(c.promotions, undefined);
    assert.deepEqual(c.learnedSkills.map(s => s.level), [1, 3, 5, 8, 12, 16]);
    assert.equal(c.skillIds.length, 6);
    const role = Object.entries(ids.classes).find(([, id]) => id === c.id)![0];
    assert.deepEqual(c.equipmentPermissions.equipmentIds, [1, 2, 3, 4].flatMap(tier => ['weapon', 'body'].map(slot => `equip_jf_${role}_${slot}_${tier}`)));
    assert.equal(c.equipmentPermissions.equipmentIds.length, 8);
  }
}
const heroOriginal = prototype.actors.find(a => a.id === 'actor_hero')!;
assert.equal(heroOriginal.name, '하람');
const hero = normalizeActorRecord({ ...structuredClone(heroOriginal), classId: novice.id, initialLevel: 1, maxLevel: 20,
  initialEquipment: {}, parameterCurves: novice.parameterCurves, expCurve: novice.expCurve,
  learnedSkills: [{ level: 1, skillId: 'skill_attack' }], battleCommandIds: [] });
// This minimal in-memory project supplies exactly what these pure engine functions read.
const project = { database: { ...structuredClone(prototype), actors: [hero], classes }, system: { battleModel: 'rm2k3', monsterCollection: false } } as Project;
const baseline = (): ClassOverrideSession => ({ switches: {}, variables: {}, inventory: {}, actorVitals: { [hero.id]: { hp: 101, maxHp: 120, mp: 36, maxMp: 36 } } });
const selections = [];
for (const target of jobs) {
  const session = baseline();
  const inventoryBefore = JSON.stringify(session.inventory);
  assert.equal(effectiveActorClassId(project, session, hero.id), novice.id);
  const result = promoteActor(session, project, hero.id, target.id);
  assert(result.ok, JSON.stringify(result));
  assert.equal(effectiveActorClassId(project, session, hero.id), target.id);
  assert.equal(JSON.stringify(session.inventory), inventoryBefore);
  assert.equal(session.actorLevels?.[hero.id], undefined); // actor.initialLevel fallback = 1
  assert.equal(session.actorVitals[hero.id].hp, 101, 'promotion never heals HP');
  assert.equal(session.actorVitals[hero.id].mp, Math.min(36, target.parameterCurves.maxMp[0]), 'promotion clamps, never refills MP');
  assert.deepEqual(session.promotionLineage?.[hero.id], [novice.id, target.id]);
  assert.deepEqual(new Set(actorOwnedSkillIds(project, session, hero.id)), new Set(['skill_attack', target.learnedSkills[0].skillId]));
  const menus = battleCommandsForActor(project, hero.id, { classId: target.id });
  assert.deepEqual(menus.map(c => c.name), target.battleCommands.map(c => c.name));
  assert.deepEqual(menus.map(c => c.kind), ['attack', 'skill', 'defend', 'item']);
  const promotedSnapshot = JSON.stringify(session);
  assert.equal(promoteActor(session, project, hero.id, novice.id).ok, false, 'no implicit retraining route');
  assert.equal(promoteActor(session, project, hero.id, target.id).ok, false, 'cannot repromote the same job');
  assert.equal(JSON.stringify(session), promotedSnapshot, 'rejected selections must leave progress unchanged');
  const reloaded: ClassOverrideSession = JSON.parse(promotedSnapshot);
  assert.equal(effectiveActorClassId(project, reloaded, hero.id), target.id);
  assert.deepEqual(actorOwnedSkillIds(project, reloaded, hero.id), actorOwnedSkillIds(project, session, hero.id));
  for (let level = 1; level <= 20; level++) {
    const s = baseline(); s.actorLevels = { [hero.id]: level };
    assert(promoteActor(s, project, hero.id, target.id).ok);
    const expected = target.learnedSkills.filter(l => l.level <= level).map(l => l.skillId);
    assert.deepEqual(classLearnedSkillIdsUpToLevel(project, target.id, level), expected);
    assert.deepEqual(new Set(actorOwnedSkillIds(project, s, hero.id)), new Set(['skill_attack', ...expected]));
    const stats = actorDerivedStats(project, hero, { level, classOverrides: s.classOverrides, equipment: {} });
    assert(stats.usesOverrideCurves);
    for (const key of keys) assert.equal(stats[key], target.parameterCurves[key][level - 1]);
    if (level < 20) {
      const up = computeActorLevelUp(project, hero.id, level, totalExpForLevel(hero.expCurve, level + 1), { classOverrides: s.classOverrides });
      assert.equal(up?.toLevel, level + 1);
      assert.deepEqual(up?.learnedSkillIds, target.learnedSkills.filter(l => l.level === level + 1).map(l => l.skillId));
      assert.equal(up?.maxHpGain, target.parameterCurves.maxHp[level] - target.parameterCurves.maxHp[level - 1]);
    } else assert.equal(computeActorLevelUp(project, hero.id, level, 999999999, { classOverrides: s.classOverrides }), null);
  }
  selections.push({ classId: target.id, result, commands: menus.map(c => c.name), vitals: session.actorVitals[hero.id], levelsChecked: 20 });
}
// Permission fixtures assert the OR rule without pretending the equipment worker's stats exist.
const permissions = [];
for (const target of jobs) {
  for (const id of target.equipmentPermissions.equipmentIds) {
    const fixture = normalizeEquipmentRecord({ id, name: '권한 확인 전용 fixture', slot: id.includes('_weapon_') ? 'weapon' : 'armor', equippableActorIds: [], equippableClassIds: [] });
    assert.equal(canEquip(project, hero, fixture, target.id), true);
    assert.equal(canEquip(project, hero, fixture, novice.id), false);
    for (const other of jobs.filter(j => j.id !== target.id)) assert.equal(canEquip(project, hero, fixture, other.id), false);
    permissions.push({ id, allowedClassId: target.id, otherClassesRejected: 4, fixtureOnly: true });
  }
}
// Shared equipment uses the original record-level class allow-list, not broad class permissions.
const sharedFixture = normalizeEquipmentRecord({ id: 'fixture_shared_equipment', name: '공유 권한 전용 fixture', slot: 'accessory', equippableActorIds: [], equippableClassIds: jobs.map(c => c.id) });
for (const job of jobs) assert.equal(canEquip(project, hero, sharedFixture, job.id), true);
assert.equal(canEquip(project, hero, sharedFixture, novice.id), false);
assert.equal(permissions.length, 32);
// Engine-backed plain-attack probes: isolate class curves from external equipment/skill art.
const dummy = (stats: Record<string, number>): MutableBattler => ({ ...stats, hp: 9999, maxHp: 9999, mp: 99, maxMp: 99, defending: false, row: 'front' } as MutableBattler);
for (const target of classes) {
  const outgoing = applySkillLike(dummy({ attackPower: target.parameterCurves.attack[0], mind: target.parameterCurves.mind[0] }), dummy({ defense: 12 }),
    { power: 10, statistic: 'attack', effect: 'damage', hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 });
  assert.equal(outgoing.amount, design.balance.levelOneUnequippedBenchmark.basicAttackDamage[target.id]);
  const incoming = applySkillLike(dummy({ attackPower: 30 }), dummy({ defense: target.parameterCurves.defense[0] }),
    { power: 10, statistic: 'attack', effect: 'damage', hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 });
  assert.equal(incoming.amount, design.balance.levelOneUnequippedBenchmark.incomingNormalAttackDamage[target.id]);
}
const sourceIds = new Set(prototype.skills.map(s => s.id));
const linkedSkills = [...new Set(classes.flatMap(c => c.skillIds))];
const unresolvedInPrototype = linkedSkills.filter(id => !sourceIds.has(id));
assert.equal(unresolvedInPrototype.length, 24, 'read-only starting database should have none of the new class skills');
const proof = {
  kind: 'individual pure engine script smoke; no gates/vitest/database writes',
  passed: true, phase: 'full', classCount: 5, learningLinks: linkedSkills.length, selections, permissions,
  normalizedCurvesPreserved: true, saveReload: 'local JSON stringify/parse of in-memory session only; not canonical SQLite evidence',
  originalActorArtUnchanged: hero.characterResourceId === heroOriginal.characterResourceId && hero.characterIndex === heroOriginal.characterIndex,
  sourceDatabaseSha256: createHash('sha256').update(readFileSync(prototypePath)).digest('hex'),
  dataSha256: createHash('sha256').update(readFileSync(new URL('data.json', here))).digest('hex'),
  unresolvedInReadOnlyPrototype: unresolvedInPrototype,
  requiredRootSkills: design.integration.skillDependencies.requiredIds,
  sharedEquipmentPermissionFixture: { allowedClassIds: jobs.map(c => c.id), noviceRejected: true, fixtureOnly: true },
  limits: ['No live SQLite/Supabase, editor registry or actual player was touched.', 'Read-only pilot prototype lacks full root-owned skills/equipment; this script verifies class contracts, not the integrated game.', 'Equipment restriction probes used permission-only fixtures; final equipment stats remain external.'],
};
writeFileSync(fileURLToPath(new URL('smoke-proof.json', here)), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, classes: 5, promotions: 4, perJobLevelsChecked: 20, equipmentPermissionFixtures: permissions.length, proof: 'smoke-proof.json' }));
