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
