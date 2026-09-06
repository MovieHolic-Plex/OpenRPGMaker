import { expect, it } from 'vitest';
import { integratedGrowthFixture as fixture } from './fixtures/growthIntegrated';
import { createBattleRuntime } from '@/battle/runtime';
import { actorBattlers } from '@/battle/battleBattlers';
import { applyBattleRewardsToSession } from '@/player/battleRewardsToSession';
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot } from '@/player/saveSlots';
import { activeSkillTrees, actorOwnedSkillIds, investSkillNode } from '@/project/growth/runtime';
import { refreshGrowthVitals } from '@/project/growth/vitals';
import { totalExpForLevel } from '@/project/actorModel';
import type { Command, Project } from '@/project/types';
import type { PlaySession } from '@/project/session';

function restore(project: Project, session: PlaySession): PlaySession {
  const saved = JSON.stringify(createSaveSnapshot(project, session));
  const slot = readSaveSlot({ getItem: () => saved }, 1);
  if (slot.kind !== 'present') throw new Error(`save ${slot.kind}`);
  return applySaveSnapshot(project, slot.snapshot);
}

function battle(project: Project, session: PlaySession, commands: Command[], withParty = true) {
  const troop = project.database.troops[0];
  if (!troop) throw new Error('troop missing');
  project.system.battleFlow = 'strict';
  troop.battleEventPages = [{
    id: 'growth-fix', name: 'growth-fix', span: 'battle',
    conditions: [{ kind: 'actorCommand', actorId: session.partyActorIds[0]!, commandId: 'defend' }], commands,
  }];
  return createBattleRuntime({
    project, troopId: troop.id, sessionState: session, canEscape: true, canLose: true, rng: () => 0.5,
    party: withParty ? {
      levels: session.actorLevels, experience: session.actorExperience, vitals: session.actorVitals,
      partyActorIds: session.partyActorIds, classOverrides: session.classOverrides,
      paramBonuses: session.actorParamBonuses,
    } : undefined,
  });
}

it.each([5, 2])('R1 keeps battle, field, save and next battle at authoritative level %s after promotion', level => {
  const { project, actor, session } = fixture();
  const destination = project.database.classes.find(c => c.id === 'B');
  if (!destination) throw new Error('class missing');
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, (_, i) => 200 + i);
  actor.parameterCurves.maxMp = Array.from({ length: 99 }, (_, i) => 40 + i);
  destination.parameterCurves.maxHp = Array.from({ length: 99 }, (_, i) => 100 + 10 * i);
  destination.parameterCurves.maxMp = Array.from({ length: 99 }, (_, i) => 20 + 5 * i);
  refreshGrowthVitals(project, session, actor.id);
  Object.assign(session.actorVitals[actor.id]!, { hp: 130, mp: 33 });
  const runtime = battle(project, session, [
    { kind: 'changeLevel', actorId: actor.id, op: '=', amount: level },
    { kind: 'promoteActor', actorId: actor.id, toClassId: 'B' },
    { kind: 'm2Command', commandId: 'm2-105-abort-battle', fields: {} },
  ]);
  expect(runtime.snapshot().actors[0]).toMatchObject({ level: 3, maxHp: 202, hp: 130 });
  runtime.performActorCommand({ kind: 'defend' });
  const snapshot = runtime.snapshot();
  const vitals = { maxHp: 100 + 10 * (level - 1), maxMp: 20 + 5 * (level - 1), hp: Math.min(130, 100 + 10 * (level - 1)), mp: Math.min(33, 20 + 5 * (level - 1)) };
  expect(snapshot.result).toBe('escape');
  expect(snapshot.eventState.actorLevels?.[actor.id]).toBe(level);
  expect(snapshot.actors[0]).toMatchObject({ level, classId: 'B', ...vitals });
  applyBattleRewardsToSession(session, { ...snapshot, result: 'escape' }, project);
  expect(session.actorLevels[actor.id]).toBe(level);
  expect(session.actorVitals[actor.id]).toEqual(vitals);
  const loaded = restore(project, session);
  expect(loaded.actorLevels[actor.id]).toBe(level);
  expect(loaded.actorVitals[actor.id]).toEqual(vitals);
  expect(battle(project, loaded, []).snapshot().actors[0]).toMatchObject({ level, ...vitals });
});

it.each([
  { withParty: true, eventGrowth: false },
  { withParty: true, eventGrowth: true },
  { withParty: false, eventGrowth: true },
])('R2 previews final class, level, XP and skill threshold %j', ({ withParty, eventGrowth }) => {
  const { project, actor, session } = fixture();
  const destination = project.database.classes.find(c => c.id === 'B');
  if (!destination) throw new Error('class missing');
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, (_, i) => 100 + i);
  destination.parameterCurves.maxHp = Array.from({ length: 99 }, (_, i) => 100 + 10 * i);
  const fromLevel = eventGrowth ? 4 : 3, toLevel = fromLevel + 1;
  destination.learnedSkills = [{ level: toLevel, skillId: 'B-skill' }];
  for (const enemy of project.database.enemies) enemy.rewards.exp = 1;
  const thresholdExp = totalExpForLevel(actor.expCurve, toLevel) - 1;
  session.actorExperience[actor.id] = eventGrowth ? 0 : thresholdExp;
  const growthCommands: Command[] = eventGrowth ? [
    { kind: 'changeLevel', actorId: actor.id, op: '=', amount: fromLevel },
    { kind: 'changeExp', actorId: actor.id, op: '=', amount: thresholdExp },
  ] : [];
  const runtime = battle(project, session, [
    ...growthCommands,
    { kind: 'promoteActor', actorId: actor.id, toClassId: 'B' },
    { kind: 'm2Command', commandId: 'm2-098-change-enemy-hp', fields: { target: 'all', operation: 'remove', value: 999999 } },
  ], withParty);
  runtime.performActorCommand({ kind: 'defend' });
  const snapshot = runtime.snapshot();
  expect(snapshot.result).toBe('victory');
  expect(snapshot.actors[0]?.skillIds).not.toContain('B-skill');
  const beforeHp = snapshot.actors[0]!.hp;
  const applied = applyBattleRewardsToSession(session, { ...snapshot, result: 'victory' }, project);
  expect(applied).toHaveLength(1);
  expect(applied[0]).toMatchObject({ fromLevel, toLevel, maxHpGain: 10, learnedSkillIds: ['B-skill'] });
  expect(snapshot.rewards.levelUps).toEqual(applied);
  expect(session.actorSkillIds[actor.id]).toContain('B-skill');
  expect(session.actorVitals[actor.id]?.hp).toBe(beforeHp + 10);
});

it('R2 keeps authored initial levels authoritative without party or session-state seeds', () => {
  const { project, actor, session } = fixture();
  const troop = project.database.troops[0];
  if (!troop) throw new Error('troop missing');
  project.system.battleFlow = 'strict';
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, (_, i) => 100 + i);
  const earnedExp = totalExpForLevel(actor.expCurve, 3);
  for (const enemy of project.database.enemies) enemy.rewards.exp = earnedExp;
  troop.battleEventPages = [{
    id: 'default-growth', name: 'default-growth', span: 'battle',
    conditions: [{ kind: 'actorCommand', actorId: actor.id, commandId: 'defend' }],
    commands: [{ kind: 'm2Command', commandId: 'm2-098-change-enemy-hp', fields: { target: 'all', operation: 'remove', value: 999999 } }],
  }];
  const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5 });
  const initial = runtime.snapshot();
  expect(initial.actors[0]?.level).toBe(3);
  expect(session.actorLevels[actor.id]).toBe(3);
  runtime.performActorCommand({ kind: 'defend' });
  const snapshot = runtime.snapshot();
  expect(snapshot.result).toBe('victory');
  expect(snapshot.rewards.exp).toBe(earnedExp);
  const applied = applyBattleRewardsToSession(session, { ...snapshot, result: 'victory' }, project);
  expect(applied).toEqual([]);
  expect(snapshot.rewards.levelUps).toEqual(applied);
  expect(initial.eventState.actorLevels?.[actor.id]).toBe(3);
  expect(snapshot.eventState.actorLevels?.[actor.id]).toBe(3);
  expect(session.actorLevels[actor.id]).toBe(3);
  expect(session.actorExperience[actor.id]).toBe(earnedExp);
});

it.each(['lowered rank', 'deleted node', 'invalid override', 'unchanged'] as const)('R3 restores effective growth maxima without healing after %s', change => {
  const { project, actor, session, trees } = fixture();
  const root = trees[0]?.nodes[0];
  const destination = project.database.classes.find(c => c.id === 'B');
  if (!root || !destination) throw new Error('fixture missing');
  actor.parameterCurves.maxHp = Array(99).fill(100);
  actor.parameterCurves.maxMp = Array(99).fill(30);
  destination.parameterCurves.maxHp = Array(99).fill(200);
  destination.parameterCurves.maxMp = Array(99).fill(60);
  root.effect = { kind: 'parameter', parameter: 'maxHp', amount: 50 };
  trees[0]!.nodes.push({ ...structuredClone(root), id: 'mp', effect: { kind: 'parameter', parameter: 'maxMp', amount: 20 } });
  session.actorParamBonuses = { [actor.id]: { maxHp: 7, maxMp: 3 } };
  investSkillNode(project, session, actor.id, 'tree-A', 'root');
  investSkillNode(project, session, actor.id, 'tree-A', 'root');
  investSkillNode(project, session, actor.id, 'tree-A', 'mp');
  investSkillNode(project, session, actor.id, 'tree-A', 'mp');
  if (change === 'invalid override') {
    session.classOverrides[actor.id] = 'B';
    session.promotionLineage = { [actor.id]: ['A', 'B'] };
  }
  refreshGrowthVitals(project, session, actor.id);
  session.actorVitals[actor.id]!.hp = session.actorVitals[actor.id]!.maxHp - 20;
  session.actorVitals[actor.id]!.mp = session.actorVitals[actor.id]!.maxMp - 10;
  const saved = JSON.stringify(createSaveSnapshot(project, session));
  const history = structuredClone(session.growthProgress);
  if (change === 'lowered rank') for (const node of trees[0]!.nodes) node.maxRank = 1;
  if (change === 'deleted node') trees[0]!.nodes = [];
  if (change === 'invalid override') project.database.classes = project.database.classes.filter(c => c.id !== 'B');
  const slot = readSaveSlot({ getItem: () => saved }, 1);
  if (slot.kind !== 'present') throw new Error(`save ${slot.kind}`);
  const loaded = applySaveSnapshot(project, slot.snapshot);
  const expected = change === 'lowered rank' ? { maxHp: 157, hp: 157, maxMp: 53, mp: 53 }
    : change === 'deleted node' ? { maxHp: 107, hp: 107, maxMp: 33, mp: 33 }
    : change === 'invalid override' ? { maxHp: 207, hp: 207, maxMp: 73, mp: 73 }
    : { maxHp: 207, hp: 187, maxMp: 73, mp: 63 };
  expect(loaded.actorVitals[actor.id]).toEqual(expected);
  expect(loaded.growthProgress).toEqual(history);
  expect(battle(project, loaded, []).snapshot().actors[0]).toMatchObject(expected);
});

it.each(['', 'deleted', undefined])('R5 distinguishes invalid-present override %j from missing across ownership, battle and save', override => {
  const { project, actor, session } = fixture();
  if (override !== undefined) session.classOverrides[actor.id] = override;
  session.promotionLineage = { [actor.id]: ['A', 'B'] };
  session.growthProgress = { [actor.id]: { 'tree-B': { skill: { rank: 1, spent: 1 } } } };
  for (const state of [session, restore(project, session)]) {
    const expectedTrees = override === undefined ? ['tree-A', 'tree-B'] : ['tree-A'];
    expect(activeSkillTrees(project, state, actor.id).map(t => t.id)).toEqual(expectedTrees);
    expect(actorOwnedSkillIds(project, state, actor.id).includes('tree-skill')).toBe(override === undefined);
    expect(actorBattlers(project, { classOverrides: state.classOverrides, promotionLineage: state.promotionLineage, growthProgress: state.growthProgress })[0]?.skillIds.includes('tree-skill')).toBe(override === undefined);
    expect(battle(project, state, []).snapshot().actors[0]?.skillIds.includes('tree-skill')).toBe(override === undefined);
    expect(state.growthProgress).toEqual(session.growthProgress);
  }
});
