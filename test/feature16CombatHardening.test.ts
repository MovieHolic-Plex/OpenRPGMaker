import { describe, expect, it, vi } from 'vitest';
import { createBattleRuntime } from '@/battle/runtime';
import { predictSkillDamageFor } from '@/battle/battlePredict';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { deserialize } from '@/project/io';
import { createBattleSequencer, type DamageFeedback } from '@/player/battleSequencer';
import { actorCommandDirectorState, enemyActionDirectorState } from '@/player/battleDirectorDom';
import { createPresentationLedger } from '@/player/battlePresentation';
import * as advance from '@/battle/battleRuntimeAdvance';
import type { SkillRecord } from '@/project/types';
import fixture from './fixtures/projects/battle-strict-v3.json';

function setup(patch: Partial<SkillRecord> = {}, flow: 'strict' | 'gauge' = 'strict') {
  const project = deserialize(JSON.stringify(fixture));
  const skill = normalizeSkillRecord({ id: 'hardening', name: 'Hardening', power: 10, damageFormula: 'power', criticalRate: 0, variance: 0,
    mpCost: { flat: 3, percentMax: 0 }, hitSequence: [1, 1], ...patch });
  project.database.skills.push(skill);
  const actor = project.database.actors.find(a => a.id === 'actor_warrior')!;
  actor.learnedSkills = [{ level: 1, skillId: skill.id }];
  actor.parameterCurves.maxMp = Array(99).fill(100);
  actor.parameterCurves.maxHp = Array(99).fill(9999);
  actor.parameterCurves.agility = Array(99).fill(999);
  const enemy = project.database.enemies.find(e => e.id === 'enemy_training_slime')!;
  enemy.stats = { ...enemy.stats, maxHp: 1000, maxMp: 100, attack: 1, defense: 20, agility: 1 };
  enemy.actions = [{ skillId: '', priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  const troop = project.database.troops.find(t => t.id === 'troop_strict_training')!;
  troop.battleEventPages = [];
  const start = () => createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
    party: { levels: {}, experience: {}, partyActorIds: [actor.id] } });
  return { project, skill, enemy, troop, start };
}
const cast = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.performActorCommand({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' });
const actorHits = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage');

function comparePrediction(patch: Partial<SkillRecord>, configure?: (fixture: ReturnType<typeof setup>) => void) {
  const fixture = setup(patch); configure?.(fixture);
  const runtime = fixture.start();
  const before = runtime.snapshot(); const original = JSON.stringify(before);
  const predicted = predictSkillDamageFor(fixture.project, before.actors[0], fixture.skill, before.enemies[0]);
  expect(JSON.stringify(before)).toBe(original);
  cast(runtime);
  const amounts = actorHits(runtime).map(e => e.amount!);
  expect(predicted.amount).toBe(amounts.reduce((sum, value) => sum + value, 0));
  return { runtime, amounts };
}

describe('feature16 combat hardening: production runtime and presentation', () => {
  it('subtracts one MP cost before evaluating a.mp on every hit', () => {
    const { amounts, runtime } = comparePrediction({ damageFormula: 'a.mp' });
    expect(amounts).toEqual([97, 97]);
    expect(runtime.snapshot().actors[0].mp).toBe(97);
  });
  it('recalculates a guaranteed defense state between formula hits', () => {
    const { amounts } = comparePrediction({ damageFormula: '100 - b.def', stateEffects: [{ stateId: 'hardening_weak', chance: 100, operation: 'add' }] }, ({ project, enemy }) => {
      project.database.states.push({ id: 'hardening_weak', name: 'Weak', runtimeEffects: { defenseMultiplier: 0.5 } });
      enemy.stateRates.hardening_weak = 'A';
    });
    expect(amounts).toEqual([80, 90]);
  });
  it('recalculates the ordinary formula after a guaranteed state change', () => {
    comparePrediction({ damageFormula: undefined, power: 100, stateEffects: [{ stateId: 'hardening_weak', chance: 100, operation: 'add' }] }, ({ project, enemy }) => {
      project.database.states.push({ id: 'hardening_weak', name: 'Weak', runtimeEffects: { defenseMultiplier: 0.5 } });
      enemy.stateRates.hardening_weak = 'A';
    });
  });
  it('updates MP rather than HP between MP formula hits', () => {
    const { amounts, runtime } = comparePrediction({ damageFormula: 'b.mp / 2', effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
    expect(amounts).toEqual([50, 25]);
    expect(runtime.snapshot().enemies[0]).toMatchObject({ hp: 1000, mp: 25 });
  });
  it('rejects a queued extra cast after the first cast starts cooldown', () => {
    const { troop, start } = setup({ cooldownTurns: 2, hitSequence: [1] });
    troop.battleEventPages = [{ id: 'extra', span: 'battle', runOnce: true, conditions: [{ kind: 'turn', start: 1, interval: 0 }],
      commands: [{ kind: 'm2Command', commandId: 'm2-108-action-times', fields: { target: 'actor_warrior', value: 1 } }] }];
    const runtime = start(); cast(runtime);
    expect(runtime.snapshot().eventLogs.some(log => log.detail?.includes('actionTimes'))).toBe(true);
    expect(actorHits(runtime)).toHaveLength(1);
    expect(runtime.snapshot().actors[0].mp).toBe(97);
    expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(2);
  });
  it('decrements gauge cooldown once per whole cycle rather than once per battler', () => {
    const { project, enemy, start } = setup({ cooldownTurns: 2, hitSequence: [1] }, 'gauge');
    project.database.actors.find(actor => actor.id === 'actor_warrior')!.parameterCurves.agility = Array(99).fill(20);
    enemy.stats.agility = 20;
    const runtime = start();
    const awaitActor = () => {
      for (let i = 0; i < 100 && runtime.snapshot().phase !== 'actorCommand'; i++) runtime.tick(1000);
      expect(runtime.snapshot().phase).toBe('actorCommand');
    };
    awaitActor(); cast(runtime); awaitActor();
    expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(2);
    const before = runtime.snapshot().actors[0].mp; cast(runtime);
    expect(runtime.snapshot().actors[0].mp).toBe(before);
    runtime.performActorCommand({ kind: 'defend' }); awaitActor();
    expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(1);
    runtime.performActorCommand({ kind: 'defend' }); awaitActor();
    expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBeUndefined();
  });
  it.each(['strict', 'gauge'] as const)('evaluates %s drops in the killing turn before battle-end state cleanup', flow => {
    const { project, enemy, start } = setup({ power: 2000, hitSequence: [1], stateEffects: [{ stateId: 'marked', chance: 100, operation: 'add' }] }, flow);
    project.database.states.push({ id: 'marked', name: 'Marked', runtimeEffects: { removeOnBattleEnd: true } });
    enemy.stateRates.marked = 'A';
    enemy.rewards.drops = [
      { itemId: 'mark_reward', ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'marked', present: true } },
      { itemId: 'wrong_absence', ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'marked', present: false } },
      { itemId: 'first_turn', ratePercent: 100, quantity: 1, condition: { kind: 'turn', start: 1, interval: 99 } },
      { itemId: 'wrong_turn', ratePercent: 100, quantity: 1, condition: { kind: 'turn', start: 2, interval: 99 } },
    ];
    const runtime = start();
    if (flow === 'gauge') for (let tick = 0; tick < 40 && runtime.snapshot().phase !== 'actorCommand'; tick++) runtime.tick(1000);
    expect(runtime.snapshot().phase).toBe('actorCommand'); cast(runtime);
    expect(runtime.snapshot().result).toBe('victory');
    expect(runtime.snapshot().rewards.items).toEqual(['mark_reward', 'first_turn']);
    expect(runtime.snapshot().enemies[0].stateIds).not.toContain('marked');
  });
  it('preserves MP damage through sequencer feedback without reducing displayed HP', () => {
    const { start } = setup({ effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
    const runtime = start(); const before = runtime.snapshot(); const ledger = createPresentationLedger(before);
    cast(runtime); const after = runtime.snapshot();
    expect(actorCommandDirectorState({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' }, before, after).lines.join(' ')).toContain('MP');
    expect(enemyActionDirectorState({ userRecordId: 'enemy_training_slime', targetId: before.actors[0].id, hit: true, amount: 10, critical: false }, after, { resource: 'mp', healing: false }).lines.join(' ')).toContain('MP');
    const queue: (() => void)[] = []; const feedback: DamageFeedback[] = [];
    const spy = vi.spyOn(advance, 'advanceBattleRuntime').mockImplementation(() => undefined);
    try {
      const sequencer = createBattleSequencer(runtime, {
        onDirectorState: () => undefined, onSyncView: () => undefined, onDamageFeedback: value => { if (value) { feedback.push(value); ledger.applyFeedback(value); } },
        onResultStage: () => undefined, onSequenceBusy: () => undefined,
      }, callback => { queue.push(callback); return queue.length; }, () => undefined);
      sequencer.runAfterActorCommand({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' }, before, after);
      for (let i = 0; queue.length && i < 100; i++) queue.shift()!();
      const enemyFeedback = feedback.filter(value => value.targetId === 'enemy-1');
      expect(enemyFeedback).toHaveLength(2);
      expect(enemyFeedback.every(value => value.resource === 'mp' && !value.healing)).toBe(true);
      expect(ledger.vitalsFor('enemy-1')).toMatchObject({ hp: 1000, defeated: false });
    } finally { spy.mockRestore(); }
  });
  it('marks exact Gen1 MP damage with the MP timeline resource', () => {
    const { project } = setup({ hitRate: 100, damageFormula: '10', effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
    project.system.battleModel = 'gen1';
    // Exact Gen1 damage sampling needs a byte accepted by its rejection sampler.
    let byteIndex = 0;
    const bytes = [0, 255, 0];
    const runtime = createBattleRuntime({ project, troopId: 'troop_strict_training', canEscape: false, canLose: true, battleFlow: 'strict', rng: () => bytes[byteIndex++ % bytes.length] / 256,
      party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior'] } });
    cast(runtime);
    expect(actorHits(runtime).length).toBeGreaterThan(0);
    expect(actorHits(runtime).every(hit => hit.resource === 'mp')).toBe(true);
    expect(runtime.snapshot().enemies[0].hp).toBe(1000);
  });
});
