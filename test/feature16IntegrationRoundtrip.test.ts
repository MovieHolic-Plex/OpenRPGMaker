import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { deserialize, serialize } from '@/project/io';

describe('selected features share the shipping project codec', () => {
  it('keeps climate, combat, action and AI authoring together across two reloads', () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const skill = project.database.skills[0]!;
    const enemy = project.database.enemies[0]!;
    const item = project.database.items[0]!;
    map.climate = { mode: 'fixed', weather: 'snow', intensity: 0.6 };
    Object.assign(skill, {
      damageFormula: 'power + a.atk * 2 - b.def',
      criticalRate: 25, criticalMultiplier: 1.8, hitRate: 90,
      cooldownTurns: 2, hitSequence: [1, 0.5, 0.25],
      actionSkill: { kind: 'trap', damage: 12, range: 2, durationMs: 4000, cooldownMs: 600,
        fieldStatus: { kind: 'slow', durationMs: 1500 } },
    });
    enemy.rewards.drops = [{ itemId: item.id, quantity: 2, ratePercent: 100, condition: { kind: 'always' } }];
    enemy.actions[0]!.condition = { kind: 'hp', minPercent: 0, maxPercent: 50 };
    project.aiAuthoring = {
      templates: [{ id: 'roundtrip', name: '인물 대사', tags: ['대사'], body: '{{인물}}의 인사를 써 줘.' }],
      dialogueStyleRules: '호칭을 일관되게 사용한다.', maxDialogueChars: 180,
    };
    const restored = deserialize(serialize(deserialize(serialize(project))));
    expect(restored.maps[map.id]!.climate).toEqual(map.climate);
    const restoredSkill = restored.database.skills.find(record => record.id === skill.id)!;
    for (const field of ['damageFormula', 'criticalRate', 'criticalMultiplier', 'hitRate', 'cooldownTurns', 'hitSequence', 'actionSkill'] as const) {
      expect(restoredSkill[field], field).toEqual(skill[field]);
    }
    const restoredEnemy = restored.database.enemies.find(record => record.id === enemy.id)!;
    expect(restoredEnemy.rewards.drops).toEqual(enemy.rewards.drops);
    expect(restoredEnemy.actions[0]!.condition).toEqual(enemy.actions[0]!.condition);
    expect(restored.aiAuthoring).toEqual(project.aiAuthoring);
  });

  it('does not opt old projects into new battle or climate behavior', () => {
    const restored = deserialize(serialize(createBlankProject()));
    expect(restored.maps[restored.startMapId]!.climate).toBeUndefined();
    for (const skill of restored.database.skills) {
      expect(skill.damageFormula).toBeUndefined();
      expect(skill.hitSequence).toBeUndefined();
      expect(skill.cooldownTurns).toBeUndefined();
    }
    for (const enemy of restored.database.enemies) expect(enemy.rewards.drops).toBeUndefined();
  });
});
