import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '@/project/io';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { normalizeEnemyRecord } from '@/project/databaseEnemyTroopRecordModel';
import { updateSkillRecord } from '@/editor/databaseRecordMutators';
import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT } from '@/battle/damageFormula';
import fixture from './fixtures/projects/battle-v3.json';

describe('feature16 combat authoring persistence', () => {
  it('roundtrips authored rules through the editor mutator and project wire load/save', () => {
    const project = deserialize(JSON.stringify(fixture));
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

describe('feature16 bounded damage formula language', () => {
  it('supports precedence, unary signs, parentheses and deterministic values', () => {
    expect(evaluateDamageFormula('power + (a.atk * 2 - b.def) / 2', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 20 });
    expect(evaluateDamageFormula('-10 + 2 * 3', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 0 });
  });
  it.each(['globalThis.alert(1)', 'a.constructor', '1;2', 'a.atk=99', '1/0', '1e99', '2 ** 999', '('.repeat(40) + '1' + ')'.repeat(40), '1'.repeat(513)])('rejects unsafe or invalid input %s', expression => {
    expect(evaluateDamageFormula(expression, FORMULA_PREVIEW_CONTEXT).ok).toBe(false);
  });
});
