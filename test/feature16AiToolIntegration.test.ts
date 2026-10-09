import { validateMapClimateInput } from '@/editor/tools/combatAuthoringValidation';
import { getTool } from '@/editor/tools/toolRegistry';
import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { deserialize, serialize } from '@/project/io';
import { runTool } from '@/editor/tools/toolRunner';
import type { ToolContext } from '@/editor/tools/types';
import { projectDatabaseReferenceMessage, projectSwitchVariableReferenceMessage } from '@/editor/databaseRecordReferences';
import { collectProjectItemReferenceIds } from '@/project/io/references';

describe('AI tools expose selected engine authoring features', () => {
  it('authors the same skill fields as the editor and keeps them through reload', () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const id = ctx.project.database.skills[0]!.id;
    const patch = { id, damageFormula: 'power + a.atk - b.def', criticalRate: 20, criticalMultiplier: 2,
      hitRate: 85, cooldownTurns: 2, hitSequence: [1, 0.5],
      actionSkill: { kind: 'melee', damage: 10, range: 2, cooldownMs: 500 } };
    const result = runTool(ctx, 'upsert_skill', { skill: patch }, { dryRun: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(deserialize(serialize(ctx.project)).database.skills.find(skill => skill.id === id)).toMatchObject(patch);
  });

  it('authors climate, preserves unrelated properties and can clear the override', () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const name = ctx.project.maps[mapId]!.name;
    expect(runTool(ctx, 'set_map_properties', { mapId, climate: { mode: 'indoor' } }, { dryRun: false }).ok).toBe(true);
    expect(deserialize(serialize(ctx.project)).maps[mapId]!.climate).toEqual({ mode: 'indoor' });
    expect(ctx.project.maps[mapId]!.name).toBe(name);
    expect(runTool(ctx, 'set_map_properties', { mapId, clearClimate: true }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.maps[mapId]!.climate).toBeUndefined();
  });

  it('keeps new drop and condition references safe from deletion and renames switches', () => {
    const ctx: ToolContext = { project: createBlankProject() };
    ctx.project.switches.push({ id: 'feature16_bonus', name: '추가 보상' });
    const enemy = ctx.project.database.enemies[0]!;
    const itemId = ctx.project.database.items[0]!.id;
    const actions = [{ ...enemy.actions[0]!, condition: { kind: 'switch', switchId: 'feature16_bonus', value: true } }];
    const drops = [{ itemId, quantity: 2, ratePercent: 75, condition: { kind: 'switch', switchId: 'feature16_bonus', value: true } }];
    const result = runTool(ctx, 'upsert_enemy', { enemy: { id: enemy.id, actions, rewards: { drops } } }, { dryRun: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(collectProjectItemReferenceIds(ctx.project).has(itemId)).toBe(true);
    expect(projectDatabaseReferenceMessage(ctx.project, 'items', itemId)).not.toBeNull();
    expect(projectSwitchVariableReferenceMessage(ctx.project, 'switch', 'feature16_bonus')).not.toBeNull();
    const renamed = runTool(ctx, 'rename_switch', { fromId: 'feature16_bonus', to: 'feature16_reward' }, { dryRun: false });
    expect(renamed.ok, JSON.stringify(renamed.issues)).toBe(true);
    const restored = deserialize(serialize(ctx.project)).database.enemies.find(record => record.id === enemy.id)!;
    expect(restored.actions[0]!.condition).toMatchObject({ switchId: 'feature16_reward' });
    expect(restored.rewards.drops?.[0]!.condition).toMatchObject({ switchId: 'feature16_reward' });
  });

  it('rejects dangling conditional drops without mutating the project', () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const before = serialize(ctx.project);
    const result = runTool(ctx, 'upsert_enemy', { enemy: { id: ctx.project.database.enemies[0]!.id,
      rewards: { drops: [{ itemId: 'missing_feature16', quantity: 1, ratePercent: 100, condition: { kind: 'always' } }] },
    } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(serialize(ctx.project)).toBe(before);
  });

  it('rejects unknown state conditions through the real loader', () => {
    const project = createBlankProject();
    project.database.enemies[0]!.actions[0]!.condition = { kind: 'status', stateId: 'missing_feature16', present: true };
    expect(() => deserialize(serialize(project))).toThrow(/condition state/);
  });
});

// These contracts use the real tool runner; rejected requests must leave the source byte-identical.
function skillContext() {
  const ctx: ToolContext = { project: createBlankProject() };
  const skill = ctx.project.database.skills[0]!;
  skill.actionSkill = { kind: 'trap', damage: 12, range: 2, cooldownMs: 500, durationMs: 4000,
    fieldStatus: { kind: 'slow', durationMs: 1500 },
    itemCost: { itemId: ctx.project.database.items[0]!.id, amount: 2 } };
  return { ctx, id: skill.id };
}
function rejectSkill(patch: Record<string, unknown>, flags: Record<string, unknown> = {}) {
  const { ctx, id } = skillContext(), before = serialize(ctx.project);
  const result = runTool(ctx, 'upsert_skill', { skill: { id, ...patch }, ...flags }, { dryRun: false });
  expect(result.ok, JSON.stringify(result)).toBe(false);
  expect(serialize(ctx.project)).toBe(before);
}

describe('combat tool validation precedes lossy normalization', () => {
  it.each(['swich', '', 'constructor', 'hpPercent'])('rejects condition discriminant %s in actions and drops', kind => {
    for (const source of ['actions', 'drops'] as const) {
      const ctx: ToolContext = { project: createBlankProject() };
      const enemy = ctx.project.database.enemies[0]!, before = serialize(ctx.project);
      const condition = { kind, switchId: 'missing_switch' };
      const patch = source === 'actions' ? { actions: [{ ...enemy.actions[0]!, condition }] }
        : { rewards: { drops: [{ itemId: ctx.project.database.items[0]!.id, ratePercent: 100, quantity: 1, condition }] } };
      expect(runTool(ctx, 'upsert_enemy', { enemy: { id: enemy.id, ...patch } }, { dryRun: false }).ok).toBe(false);
      expect(serialize(ctx.project)).toBe(before);
    }
  });
  it.each([
    { kind: 'switch' }, { kind: 'status', stateId: 'state_death', present: 1 },
    { kind: 'hp', minPercent: 80, maxPercent: 20 }, { kind: 'turn', start: 1, interval: 0 },
    { kind: 'always', switchId: 'sw_0001' },
  ])('rejects malformed condition %j atomically', condition => {
    const ctx: ToolContext = { project: createBlankProject() };
    const enemy = ctx.project.database.enemies[0]!, before = serialize(ctx.project);
    const result = runTool(ctx, 'upsert_enemy', { enemy: { id: enemy.id, actions: [{ ...enemy.actions[0]!, condition }] } }, { dryRun: false });
    expect(result.ok).toBe(false); expect(serialize(ctx.project)).toBe(before);
  });
  it.each(['a.atk +', 'Math.random()', 'power / 0', 'unknown + 1', '1'.repeat(513)])('rejects formula %s', damageFormula => {
    rejectSkill({ damageFormula });
  });
  it.each([
    { hitSequence: Array(17).fill(1) }, { hitSequence: [1, -0.1] }, { hitSequence: null },
    { criticalRate: 12.5 }, { cooldownTurns: -1 }, { criticalMultiplier: 11 },
    { actionSkill: null }, { actionSkill: { kind: 'teleport', damage: 1, range: 2 } },
    { actionSkill: { cooldownMs: 49 } }, { actionSkill: { fieldStatus: { kind: 'stun' } } },
  ])('rejects malformed skill fields %j', patch => { rejectSkill(patch); });
  it('rejects 65 drops instead of silently retaining 64, and accepts the exact cap', () => {
    const ctx: ToolContext = { project: createBlankProject() }, before = serialize(ctx.project);
    const id = ctx.project.database.enemies[0]!.id;
    const drop = { itemId: ctx.project.database.items[0]!.id, quantity: 1, ratePercent: 100, condition: { kind: 'always' } };
    const write = (count: number) => runTool(ctx, 'upsert_enemy', { enemy: { id, rewards: { drops: Array.from({ length: count }, () => ({ ...drop })) } } }, { dryRun: false });
    expect(write(65).ok).toBe(false); expect(serialize(ctx.project)).toBe(before);
    expect(write(64).ok).toBe(true);
    expect(deserialize(serialize(ctx.project)).database.enemies.find(enemy => enemy.id === id)!.rewards.drops).toHaveLength(64);
  });
  it('accepts 16 hits and blank formula reset without changing other skill fields', () => {
    const { ctx, id } = skillContext();
    const patch = (fields: Record<string, unknown>) => runTool(ctx, 'upsert_skill', { skill: { id, ...fields } }, { dryRun: false });
    expect(patch({ damageFormula: 'power + a.atk - b.def', hitSequence: Array(16).fill(0.5) }).ok).toBe(true);
    expect(patch({ damageFormula: '', hitSequence: [] }).ok).toBe(true);
    const skill = deserialize(serialize(ctx.project)).database.skills.find(skill => skill.id === id)!;
    expect(skill.damageFormula).toBeUndefined(); expect(skill.hitSequence).toBeUndefined();
    expect(skill.actionSkill?.damage).toBe(12);
  });
});

describe('action skill patch and explicit clear contracts', () => {
  it('merges partial profile and nested patches without resetting other values', () => {
    const { ctx, id } = skillContext();
    const result = runTool(ctx, 'upsert_skill', { skill: { id, actionSkill: {
      cooldownMs: 600, itemCost: { amount: 3 }, fieldStatus: { durationMs: 2200 },
    } } }, { dryRun: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(deserialize(serialize(ctx.project)).database.skills.find(skill => skill.id === id)!.actionSkill).toEqual({
      kind: 'trap', damage: 12, range: 2, cooldownMs: 600, durationMs: 4000,
      itemCost: { itemId: ctx.project.database.items[0]!.id, amount: 3 }, fieldStatus: { kind: 'slow', durationMs: 2200 },
    });
  });
  it('requires a complete profile on first activation and complete fields on kind replacement', () => {
    const { ctx, id } = skillContext(); delete ctx.project.database.skills[0]!.actionSkill;
    const before = serialize(ctx.project);
    expect(runTool(ctx, 'upsert_skill', { skill: { id, actionSkill: { cooldownMs: 600 } } }, { dryRun: false }).ok).toBe(false);
    expect(serialize(ctx.project)).toBe(before);
    rejectSkill({ actionSkill: { kind: 'melee' } });
  });
  it.each(['clearActionSkill', 'clearActionFieldStatus', 'clearActionItemCost'] as const)('%s is idempotent, survives reload, and is never persisted', flag => {
    const { ctx, id } = skillContext();
    const previous = structuredClone(ctx.project.database.skills[0]!.actionSkill!);
    for (let i = 0; i < 2; i++) {
      const result = runTool(ctx, 'upsert_skill', { skill: { id }, [flag]: true }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      ctx.project = deserialize(serialize(ctx.project));
      const skill = ctx.project.database.skills.find(skill => skill.id === id)!;
      expect(skill).not.toHaveProperty(flag);
      const expected = structuredClone(previous);
      if (flag === 'clearActionSkill') expect(skill.actionSkill).toBeUndefined();
      else {
        if (flag === 'clearActionFieldStatus') delete expected.fieldStatus;
        else delete expected.itemCost;
        expect(skill.actionSkill).toEqual(expected);
      }
    }
  });
  it('combines independent partial updates and clears; false flags preserve values', () => {
    const { ctx, id } = skillContext();
    expect(runTool(ctx, 'upsert_skill', { skill: { id, actionSkill: { cooldownMs: 700 } },
      clearActionFieldStatus: true, clearActionItemCost: true, clearActionSkill: false }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.database.skills.find(skill => skill.id === id)!.actionSkill).toEqual({ kind: 'trap', damage: 12, range: 2, cooldownMs: 700, durationMs: 4000 });
  });
  it('preserves the complete profile when every clear flag is false', () => {
    const { ctx, id } = skillContext();
    const previous = structuredClone(ctx.project.database.skills[0]!.actionSkill);
    expect(runTool(ctx, 'upsert_skill', { skill: { id }, clearActionSkill: false,
      clearActionFieldStatus: false, clearActionItemCost: false }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.database.skills.find(skill => skill.id === id)!.actionSkill).toEqual(previous);
  });
  it('accepts an explicit kind replacement without leaking old variant fields', () => {
    const { ctx, id } = skillContext();
    expect(runTool(ctx, 'upsert_skill', { skill: { id, actionSkill: { kind: 'melee', damage: 8, range: 1 } } }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.database.skills.find(skill => skill.id === id)!.actionSkill).toEqual({ kind: 'melee', damage: 8, range: 1 });
  });
  it('does not mutate the project on a dry-run clear', () => {
    const { ctx, id } = skillContext(), before = serialize(ctx.project);
    expect(runTool(ctx, 'upsert_skill', { skill: { id }, clearActionSkill: true }, { dryRun: true }).ok).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
  });
  it('rejects ambiguous set/clear combinations atomically', () => {
    rejectSkill({ actionSkill: { cooldownMs: 600 } }, { clearActionSkill: true });
    rejectSkill({ actionSkill: { fieldStatus: { durationMs: 2000 } } }, { clearActionFieldStatus: true });
    rejectSkill({ actionSkill: { itemCost: { amount: 3 } } }, { clearActionItemCost: true });
    rejectSkill({}, { clearActionSkill: true, clearActionItemCost: true });
  });
});


describe('published schema and optional climate validator', () => {
  it('advertises partial action patches, array caps and top-level clear flags', () => {
    const parameters = getTool('upsert_skill')!.parameters;
    const fields = parameters.properties!.skill!.properties!;
    expect(fields.actionSkill!.required).toEqual([]);
    expect(fields.actionSkill!.properties!.itemCost!.required).toEqual([]);
    expect(fields.hitSequence).toHaveProperty('maxItems', 16);
    for (const flag of ['clearActionSkill', 'clearActionFieldStatus', 'clearActionItemCost']) {
      expect(parameters.properties![flag]).toMatchObject({ type: 'boolean' });
      expect(fields).not.toHaveProperty(flag);
    }
    expect(getTool('upsert_enemy')!.parameters.properties!.enemy!.properties!.rewards!.properties!.drops).toHaveProperty('maxItems', 64);
  });
  it.each([
    { mode: 'fixed', weather: 'typhoon', intensity: 0.5 }, { mode: 'fixed' },
    { mode: 'fixed', weather: 'snow', intensity: 2 }, { mode: 'indoors' }, { mode: 'indoor', weather: 'rain' },
  ])('rejects invalid nested climate %j before a caller normalizes it', climate => {
    expect(() => validateMapClimateInput(climate)).toThrow();
  });
  it.each([{ mode: 'inherit' }, { mode: 'indoor' }, { mode: 'fixed', weather: 'snow', intensity: 0.6 }, { mode: 'fixed', weather: 'fog' }])('accepts climate %j', climate => {
    expect(() => validateMapClimateInput(climate)).not.toThrow();
  });
});
