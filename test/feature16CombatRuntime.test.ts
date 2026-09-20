import { describe, expect, it } from 'vitest';
import { createBattleRuntime } from '@/battle/runtime';
import { simulateBattle } from '@/battle/simulate';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { deserialize } from '@/project/io';
import type { BattleRuntimeOptions } from '@/battle/types';
import type { SkillRecord } from '@/project/types';
import fixture from './fixtures/projects/battle-strict-v3.json';

function setup(patch: Partial<SkillRecord> = {}, options: Partial<BattleRuntimeOptions> = {}) {
  const project = deserialize(JSON.stringify(fixture));
  const skill = normalizeSkillRecord({ id: 'feature16', name: '연격', power: 10, damageFormula: 'power', criticalRate: 0, variance: 0, mpCost: { flat: 3, percentMax: 0 }, hitSequence: [1, 2, 3], ...patch });
  project.database.skills.push(skill);
  const warrior = project.database.actors.find(a => a.id === 'actor_warrior')!;
  warrior.learnedSkills = [{ level: 1, skillId: skill.id }];
  warrior.parameterCurves.maxMp = Array(99).fill(100);
  warrior.parameterCurves.maxHp = Array(99).fill(9999);
  warrior.parameterCurves.agility = Array(99).fill(999);
  const enemy = project.database.enemies.find(e => e.id === 'enemy_training_slime')!;
  enemy.stats = { ...enemy.stats, maxHp: 1000, attack: 1, agility: 1 };
  enemy.actions = [{ skillId: '', priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  project.database.troops.find(t => t.id === 'troop_strict_training')!.battleEventPages = [];
  const runtimeOptions: BattleRuntimeOptions = { project, troopId: 'troop_strict_training', canEscape: false, canLose: true, battleFlow: 'strict', rng: () => 0.5,
    party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior'] }, ...options };
  return { project, skill, enemy, runtimeOptions };
}
const cast = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.performActorCommand({ kind: 'skill', skillId: 'feature16', targetEnemyId: 'enemy-1' });

describe('feature16 shipping runtime integration', () => {
  it('records each hit, consumes MP once and uses authored multipliers', () => {
    const { runtimeOptions } = setup();
    const runtime = createBattleRuntime(runtimeOptions);
    const before = runtime.snapshot().actors[0].mp;
    cast(runtime);
    const snapshot = runtime.snapshot();
    const hits = snapshot.timeline.filter(entry => entry.userRecordId === 'actor_warrior' && entry.kind === 'damage');
    expect(hits.map(hit => hit.amount)).toEqual([10, 20, 30]);
    expect(snapshot.actors[0].mp).toBe(before - 3);
    expect(snapshot.enemies[0].hp).toBe(940);
  });
  it('stops the actual sequence immediately on lethal damage', () => {
    const { runtimeOptions, enemy } = setup(); enemy.stats.maxHp = 25;
    const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
    expect(runtime.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage').map(e => e.amount)).toEqual([10, 20]);
    expect(runtime.snapshot().enemies[0].hp).toBe(0);
  });
  it('rejects cooldown commands without consuming a round or MP, then unlocks after full rounds', () => {
    const { runtimeOptions } = setup({ cooldownTurns: 2 });
    const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
    expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBe(2);
    const before = runtime.snapshot(); cast(runtime);
    expect(runtime.snapshot().actors[0].mp).toBe(before.actors[0].mp);
    expect(runtime.snapshot().roundLogs.length).toBe(before.roundLogs.length);
    runtime.performActorCommand({ kind: 'defend' });
    expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBe(1);
    runtime.performActorCommand({ kind: 'defend' });
    expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBeUndefined();
    cast(runtime);
    expect(runtime.snapshot().actors[0].mp).toBe(before.actors[0].mp - 3);
  });
  it('allows a legacy single-hit revival to apply to an explicitly dead ally', () => {
    const { runtimeOptions } = setup({ hitSequence: undefined, damageFormula: undefined, scope: 'ally', effect: { kind: 'healing', statistic: 'mind', affects: 'hp' }, stateEffects: [{ stateId: 'state_death', chance: 100, operation: 'remove' }] }, {
      activeSlots: 2, party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior', 'actor_mage'], vitals: { actor_mage: { hp: 0, mp: 10 } } },
    });
    const runtime = createBattleRuntime(runtimeOptions);
    expect(runtime.snapshot().actors.find(a => a.recordId === 'actor_mage')!.hp).toBe(0);
    runtime.performActorCommand({ kind: 'skill', skillId: 'feature16', targetActorId: 'actor_mage' });
    expect(runtime.snapshot().actors.find(a => a.recordId === 'actor_mage')!.hp).toBeGreaterThan(0);
    expect(runtime.snapshot().timeline.some(e => e.kind === 'healing' && e.userRecordId === 'actor_warrior')).toBe(true);
  });
  it('changes enemy action selection when its authored HP threshold is reached', () => {
    const { project, enemy, runtimeOptions } = setup({ power: 600, hitSequence: [1] });
    project.database.skills.push(normalizeSkillRecord({ id: 'rage', name: '분노', power: 1, criticalRate: 0, damageFormula: '1' }));
    enemy.actions = [{ ...enemy.actions[0], skillId: 'rage', priority: 100, condition: { kind: 'hp', minPercent: 0, maxPercent: 50 } }];
    const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
    expect(runtime.snapshot().roundLogs[0].timeline.some(e => e.skillName === '분노')).toBe(false);
    runtime.performActorCommand({ kind: 'defend' });
    expect(runtime.snapshot().roundLogs[1].timeline.some(e => e.skillName === '분노')).toBe(true);
  });
  it('uses authored critical/hit rates and MP targeting through real commands', () => {
    const { runtimeOptions, enemy } = setup({ power: 10, criticalRate: 100, criticalMultiplier: 3, hitSequence: [1, 1], effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
    enemy.stats.maxMp = 100;
    const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
    const snapshot = runtime.snapshot();
    expect(snapshot.enemies[0].hp).toBe(1000);
    expect(snapshot.enemies[0].mp).toBe(40);
    expect(snapshot.timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage').map(e => e.amount)).toEqual([30, 30]);
    const miss = setup({ hitRate: 0 }); const missed = createBattleRuntime(miss.runtimeOptions); cast(missed);
    expect(missed.snapshot().enemies[0].hp).toBe(1000);
    expect(missed.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'miss')).toHaveLength(3);
  });
  it('evaluates victory drops against the battle session switches', () => {
    const { runtimeOptions, enemy } = setup({ power: 2000, hitSequence: [1] });
    enemy.rewards.drops = [{ itemId: 'bonus_item', ratePercent: 100, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } }];
    const runtime = createBattleRuntime({ ...runtimeOptions, sessionState: { switches: { bonus: true }, variables: {}, inventory: {} } });
    cast(runtime);
    expect(runtime.snapshot().rewards.items).toEqual(['bonus_item', 'bonus_item']);
  });
  it('runs authored sequences in the production headless simulator with a fixed seed', () => {
    const { project } = setup({ power: 600, hitSequence: [1, 1] });
    const input = { project, troopId: 'troop_strict_training', heroLevel: 1, partyActorIds: ['actor_warrior'], battleFlow: 'strict' as const, n: 1, seed: 16, maxSteps: 10,
      strictScript: [[{ actorId: 'actor_warrior', command: 'skill' as const, skillId: 'feature16', target: 'enemy-1' }]] };
    const first = simulateBattle(input);
    const second = simulateBattle(input);
    expect(first).toEqual(second);
    expect(first.winRate).toBe(1);
  });
});
