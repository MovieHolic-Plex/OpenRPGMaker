import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '@/project/io';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { normalizeEnemyRecord } from '@/project/databaseEnemyTroopRecordModel';
import { updateEnemyRecord, updateSkillRecord } from '@/editor/databaseRecordMutators';
import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT } from '@/battle/damageFormula';
import fixture from './fixtures/projects/battle-v3.json';

describe('feature16 combat authoring persistence', () => {
  it('roundtrips authored rules through the editor mutator and project wire load/save', () => {
    const project = deserialize(JSON.stringify(fixture));
    project.switches.push({ id: 'bonus', name: '추가 보상' });
    project.database.states.push({ ...project.database.states[0], id: 'poison', name: '독' });
    const id = project.database.skills[0].id;
    const patch = { damageFormula: 'power + a.atk * 2 - b.def', criticalRate: 0, criticalMultiplier: 2.5, cooldownTurns: 2, hitSequence: [1, 0.5, 2], hitRate: 74 };
    updateSkillRecord(project.database, id, patch);
    project.database.enemies[0] = normalizeEnemyRecord({ ...project.database.enemies[0], actions: [
      { ...project.database.enemies[0].actions[0], skillId: id, condition: { kind: 'mp', minPercent: 10, maxPercent: 80 } },
    ], rewards: { ...project.database.enemies[0].rewards, drops: [
      { itemId: project.database.items[0].id, ratePercent: 45, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } },
      { itemId: project.database.items[0].id, ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'poison', present: false } },
    ] } });
    const loaded = deserialize(serialize(project));
    expect(loaded.database.skills.find(skill => skill.id === id)).toMatchObject(patch);
    expect(loaded.database.enemies[0].actions[0].condition).toEqual({ kind: 'mp', minPercent: 10, maxPercent: 80 });
    expect(loaded.database.enemies[0].rewards.drops).toEqual(project.database.enemies[0].rewards.drops);
    expect(deserialize(serialize(loaded)).database.skills.find(skill => skill.id === id)).toMatchObject(patch);
  });
  it('keeps omitted defaults and clamps malformed optional numbers', () => {
    const legacy = normalizeSkillRecord({ id: 'legacy', name: 'Legacy' });
    expect(legacy.damageFormula).toBeUndefined();
    expect(legacy.criticalRate).toBeUndefined();
    expect(legacy.hitSequence).toBeUndefined();
    expect(legacy.cooldownTurns).toBeUndefined();
    expect(normalizeSkillRecord({ ...legacy, criticalRate: 300, cooldownTurns: -5, hitSequence: [NaN, -2, 50] })).toMatchObject({ criticalRate: 100, cooldownTurns: 0, hitSequence: [1, 0, 10] });
    expect(normalizeEnemyRecord({ id: 'e', name: 'E' }).rewards.drops).toBeUndefined();
    expect(normalizeEnemyRecord({ id: 'e', name: 'E', rewards: { exp: 0, gold: 0, dropRatePercent: 100, drops: [] } }).rewards.drops).toEqual([]);
  });
});

describe('database form combat fields', () => {
  it('keeps the skill and enemy fields the database forms write', () => {
    const project = deserialize(JSON.stringify(fixture));
    const id = project.database.skills[0].id;
    const name = project.database.skills[0].name;
    updateSkillRecord(project.database, id, {
      gaugeShift: -20,
      chargeTurns: 2,
      summonResourceId: 'party-pixel-animal-0',
      learnable: true,
      inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
      battleGimmick: { pattern: 'dash', durationTurns: 3 },
    });
    const saved = project.database.skills.find((skill) => skill.id === id);
    expect(saved?.name).toBe(name);
    expect(saved).toMatchObject({
      gaugeShift: -20,
      chargeTurns: 2,
      summonResourceId: 'party-pixel-animal-0',
      learnable: true,
      inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
      battleGimmick: { pattern: 'dash', durationTurns: 3 },
    });
    updateSkillRecord(project.database, id, {
      gaugeShift: undefined,
      chargeTurns: undefined,
      summonResourceId: undefined,
      learnable: undefined,
      inputSequence: undefined,
      battleGimmick: undefined,
    });
    const cleared = project.database.skills.find((skill) => skill.id === id);
    expect(cleared?.gaugeShift).toBeUndefined();
    expect(cleared?.chargeTurns).toBeUndefined();
    expect(cleared?.summonResourceId).toBeUndefined();
    expect(cleared?.learnable).toBeUndefined();
    expect(cleared?.inputSequence).toBeUndefined();
    expect(cleared?.battleGimmick).toBeUndefined();

    const enemy = project.database.enemies[0];
    const itemId = project.database.items[0].id;
    updateEnemyRecord(project.database, enemy.id, { stealItems: [{ itemId, rate: 40 }] });
    expect(project.database.enemies[0].stealItems).toEqual([{ itemId, rate: 40 }]);
    updateEnemyRecord(project.database, enemy.id, { stealItems: undefined });
    expect(project.database.enemies[0].stealItems).toBeUndefined();
    expect(project.database.enemies[0].name).toBe(enemy.name);
  });
});

describe('feature16 bounded damage formula language', () => {
  it('supports precedence, unary signs, parentheses and deterministic values', () => {
    expect(evaluateDamageFormula('power + (a.atk * 2 - b.def) / 2', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 20 });
    expect(evaluateDamageFormula('-10 + 2 * 3', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 0 });
  });
  it.each(['globalThis.alert(1)', 'a.constructor', '1;2', 'a.atk=99', '1/0', '1e99', '2 ** 999', '('.repeat(40) + '1' + ')'.repeat(40), '1'.repeat(513)])('rejects unsafe or invalid input %s', expression => {
    expect(evaluateDamageFormula(expression, FORMULA_PREVIEW_CONTEXT).ok).toBe(false);
  });
});
