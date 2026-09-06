import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { normalizeClassRecord, normalizeSkillRecord } from '@/project/databaseRecordModel';
import { serialize, deserialize } from '@/project/io';
import { collectProjectReferenceIssues, validateProjectReferences } from '@/project/io/references';
import { startSession } from '@/project/session';
import { changeActorClass, promoteActor } from '@/project/sessionClass';
import { actorBattlers } from '@/battle/battleBattlers';
import { createBattleRuntime } from '@/battle/runtime';
import { deterministicRng } from '@/util/rng';
import { arrangeTree, promotionEdges, wouldCreateCycle } from '@/project/growth/graph';
import { emptyGrowth } from '@/project/growth/types';
import { assertGrowthShape, growthIssues } from '@/project/growth/validation';
import { growthEffects, growthPoints, investSkillNode, resetSkillTree } from '@/project/growth/runtime';
import { applyGrowthPreset, GROWTH_PRESETS } from '@/project/growth/presets';

const roles = ['vanguard', 'arcane', 'ranger'] as const;
const ids = roles.flatMap(role => [`promotion-${role}`, `skill-${role}`]);
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing required test record');
  return value;
}
function customProject() {
  const source = createBlankProject();
  const customIds = new Map([...source.database.classes, ...source.database.skills].map(r => [r.id, `authored-${r.id}`]));
  const project = deserialize(JSON.stringify(source, (_key, value: unknown) =>
    typeof value === 'string' ? customIds.get(value) ?? value : value));
  const first = required(project.database.classes[0]);
  const second = required(project.database.classes[1]);
  first.promotions = [{ toClassId: second.id, requires: {
    level: 17, switchId: required(project.switches[0]).id,
    variableId: required(project.variables[0]).id, atLeast: 7,
    itemId: required(project.database.items[0]).id,
  } }];
  project.growth = { ...emptyGrowth(), initialPoints: 11, pointsPerLevel: 0,
    bonusVariableId: required(project.variables[0]).id,
    classPositions: { [first.id]: { x: 56, y: 60 }, [second.id]: { x: 9950, y: 9950 } },
    skillTrees: [{ id: 'authored-tree', name: 'Authored', description: '', classIds: [first.id], allowReset: false,
      nodes: [{ id: 'authored-node', name: 'Authored', description: '', x: 200, y: 100,
        cost: 4, level: 8, maxRank: 2, prerequisites: [], effect: { kind: 'parameter', parameter: 'mind', amount: 3 } }] }],
  };
  return project;
}
function emptyDatabaseProject() {
  const project = createBlankProject();
  for (const value of Object.values(project.database)) if (Array.isArray(value)) value.splice(0);
  delete project.growth;
  delete project.database.elements;
  return project;
}

describe('curated growth preset contracts', () => {
  it('exposes six immutable metadata entries with fixed editor cover URLs', () => {
    expect(GROWTH_PRESETS.map(p => p.id).sort()).toEqual([...ids].sort());
    expect(Object.isFrozen(GROWTH_PRESETS)).toBe(true);
    for (const preset of GROWTH_PRESETS) {
      expect(Object.isFrozen(preset)).toBe(true);
      expect(preset.coverUrl).toBe(`/assets/generated/growth-presets/${preset.role}.png`);
      expect(preset.nodeCount).toBe(preset.kind === 'promotion' ? 5 : 7);
      expect(preset.edgeCount).toBe(preset.kind === 'promotion' ? 4 : 7);
    }
  });
  it.each(ids)('%s preserves every authored record, condition, position and budget', id => {
    const project = customProject(), before = structuredClone(project);
    const result = applyGrowthPreset(project, id);
    expect(collectProjectReferenceIssues(project)).toEqual([]);
    expect(result.presetId).toBe(id);
    expect(project.database.classes.slice(0, before.database.classes.length)).toEqual(before.database.classes);
    expect(project.database.skills.slice(0, before.database.skills.length)).toEqual(before.database.skills);
    const restored = structuredClone(project);
    restored.database.classes.splice(before.database.classes.length);
    restored.database.skills.splice(before.database.skills.length);
    restored.growth = structuredClone(before.growth);
    expect(restored).toEqual(before);
    expect(project.growth).toMatchObject({ initialPoints: 11, pointsPerLevel: 0, bonusVariableId: before.growth?.bonusVariableId });
    expect(project.growth?.skillTrees.slice(0, 1)).toEqual(before.growth?.skillTrees);
    for (const [key, position] of Object.entries(required(before.growth).classPositions)) {
      expect(project.growth?.classPositions[key]).toEqual(position);
    }
  });
  it.each(ids)('%s is self-contained on an empty database', id => {
    const project = emptyDatabaseProject();
    const beforeIssues = collectProjectReferenceIssues(project);
    const result = applyGrowthPreset(project, id);
    expect(() => assertGrowthShape(project.growth)).not.toThrow();
    expect(growthIssues(project)).toEqual([]);
    expect(collectProjectReferenceIssues(project).filter(issue => !beforeIssues.includes(issue))).toEqual([]);
    expect(project.growth).toMatchObject({ initialPoints: 2, pointsPerLevel: 1 });
    expect(result.addedSkillIds).toHaveLength(3);
    expect(project.database.skills.map(s => s.id)).toEqual(result.addedSkillIds);
    if (id.startsWith('promotion-')) {
      expect(result.addedClassIds).toHaveLength(5);
      expect(result.addedTreeIds).toEqual([]);
      expect(result.addedNodeIds).toEqual([]);
      const edges = promotionEdges(project);
      expect(edges).toHaveLength(4);
      expect(edges.every(e => !wouldCreateCycle(edges.filter(other => other !== e), e.from, e.to))).toBe(true);
      expect(project.database.classes.some(c => c.promotions?.length === 2)).toBe(true);
      for (const klass of project.database.classes) {
        expect(klass.learnedSkills.length).toBeGreaterThan(0);
        expect(klass.skillIds.every(skill => result.addedSkillIds.includes(skill))).toBe(true);
        expect(klass.battleCommands.some(command => command.kind === 'skill')).toBe(true);
        expect(klass.stateRates).toEqual({});
        expect(klass.elementRates).toEqual({});
      }
    } else {
      expect(result.addedClassIds).toEqual([]);
      expect(result.addedTreeIds).toHaveLength(1);
      expect(result.addedNodeIds).toHaveLength(7);
      const tree = required(project.growth?.skillTrees[0]);
      expect(tree.classIds).toEqual([]);
      expect(tree.nodes.filter(n => n.effect.kind === 'skill')).toHaveLength(3);
      expect(tree.nodes.filter(n => n.effect.kind === 'parameter')).toHaveLength(4);
      expect(tree.nodes.flatMap(n => n.prerequisites)).toHaveLength(7);
      expect(tree.nodes.map(n => n.id)).toEqual(result.addedNodeIds);
    }
  });
  it('allocates unique IDs across repeated applications and authored collisions', () => {
    const project = customProject();
    const preview = structuredClone(project);
    const first = applyGrowthPreset(preview, 'promotion-vanguard');
    project.database.skills.push(normalizeSkillRecord({ id: required(first.addedSkillIds[0]), name: 'Collision' }));
    project.database.classes.push(normalizeClassRecord({ id: required(first.addedClassIds[0]), name: 'Collision' }));
    const seen = new Set([...project.database.classes, ...project.database.skills].map(r => r.id));
    for (const id of [...ids, ...ids]) {
      const result = applyGrowthPreset(project, id);
      for (const added of [...result.addedClassIds, ...result.addedSkillIds, ...result.addedTreeIds, ...result.addedNodeIds]) {
        expect(seen.has(added)).toBe(false); seen.add(added);
      }
      for (const klass of project.database.classes.filter(c => result.addedClassIds.includes(c.id))) {
        expect(klass.skillIds.every(skill => result.addedSkillIds.includes(skill))).toBe(true);
        expect((klass.promotions ?? []).every(edge => result.addedClassIds.includes(edge.toClassId))).toBe(true);
      }
      for (const tree of required(project.growth).skillTrees.filter(t => result.addedTreeIds.includes(t.id))) {
        expect(tree.nodes.every(n => n.prerequisites.every(parent => result.addedNodeIds.includes(parent)))).toBe(true);
        expect(tree.nodes.every(n => n.effect.kind !== 'skill' || result.addedSkillIds.includes(n.effect.skillId))).toBe(true);
      }
    }
    expect(growthIssues(project)).toEqual([]);
    expect(() => assertGrowthShape(project.growth)).not.toThrow();
  });
  it.each([false, true])('rejects unknown IDs without mutation (existing growth: %s)', existing => {
    const project = existing ? customProject() : createBlankProject();
    const before = structuredClone(project);
    expect(() => applyGrowthPreset(project, '__proto__')).toThrow();
    expect(project).toEqual(before);
  });
  it.each(ids)('%s previews on a clone and survives actual wire serialization', id => {
    const project = customProject(), before = structuredClone(project), preview = structuredClone(project);
    const planned = applyGrowthPreset(preview, id);
    expect(project).toEqual(before);
    expect(applyGrowthPreset(project, id)).toEqual(planned);
    expect(project).toEqual(preview);
    const loaded = deserialize(serialize(project));
    expect(loaded.growth).toEqual(project.growth);
    for (const klass of project.database.classes.filter(c => planned.addedClassIds.includes(c.id))) {
      expect(loaded.database.classes.find(c => c.id === klass.id)).toEqual(klass);
    }
    for (const skill of project.database.skills.filter(s => planned.addedSkillIds.includes(s.id))) {
      expect(loaded.database.skills.find(s => s.id === skill.id)).toEqual(skill);
    }
  });
  it.each(roles)('rejects an exhausted authored canvas for promotion-%s without partial records or settings', role => {
    const project = createBlankProject();
    project.growth = emptyGrowth();
    for (let y = 60; y <= 9848; y += 456) for (let x = 56; x <= 9504; x += 744) {
      project.growth.classPositions[`occupied-${x}-${y}`] = { x, y };
    }
    const before = structuredClone(project);
    expect(() => applyGrowthPreset(project, `promotion-${role}`)).toThrow();
    expect(project).toEqual(before);
  });
  it('preserves explicitly zero point budgets rather than initializing defaults', () => {
    const project = createBlankProject();
    project.growth = { ...emptyGrowth(), initialPoints: 0, pointsPerLevel: 0 };
    applyGrowthPreset(project, 'skill-vanguard');
    expect(project.growth).toMatchObject({ initialPoints: 0, pointsPerLevel: 0 });
  });
  it('places new promotion nodes apart from authored and automatically positioned nodes', () => {
    const project = customProject();
    for (const id of roles.map(role => `promotion-${role}`)) {
      const existingIds = project.database.classes.map(c => c.id);
      const result = applyGrowthPreset(project, id);
      const auto = arrangeTree(project.database.classes.map(c => c.id), promotionEdges(project));
      const occupied = existingIds.map(classId => required(project.growth?.classPositions[classId] ?? auto[classId]));
      for (const classId of result.addedClassIds) {
        const p = required(project.growth?.classPositions[classId]);
        expect(occupied.every(old => Math.abs(old.x - p.x) >= 248 || Math.abs(old.y - p.y) >= 152)).toBe(true);
        occupied.push(p);
      }
    }
  });
});

describe.each([false, true])('imported promotion cycles (authored positions: %s)', authored => {
  it.each(roles)('places promotion-%s apart from post-apply effective existing positions', role => {
    // Given: an actual imported, reference-valid cycle, with optional authored overrides and an orphan reservation.
    const source = createBlankProject();
    const first = required(source.database.classes[0]), second = required(source.database.classes[1]);
    first.promotions = [{ toClassId: second.id, requires: { level: 5 } }];
    second.promotions = [{ toClassId: first.id, requires: { level: 12 } }];
    const presetId = `promotion-${role}`;
    const reservedId = `${presetId}-class-0`;
    if (authored) source.growth = { ...emptyGrowth(), initialPoints: 11, pointsPerLevel: 0,
      classPositions: { [second.id]: { x: 56, y: 2000 }, [reservedId]: { x: 1544, y: 60 } } };
    const project = deserialize(serialize(source));
    expect(() => validateProjectReferences(project)).not.toThrow();
    const before = structuredClone(project);
    const preApplyAuto = arrangeTree(project.database.classes.map(c => c.id), promotionEdges(project));
    expect(preApplyAuto[first.id]).toEqual({ x: 304, y: 60 });

    // When: append a disconnected promotion preset without rewriting the imported graph.
    const result = applyGrowthPreset(project, presetId);

    // Then: use the studio's combined post-apply layout, not the pre-append automatic positions.
    const auto = arrangeTree(project.database.classes.map(c => c.id), promotionEdges(project));
    expect(auto[first.id]).toEqual({ x: 800, y: 60 });
    const occupied = Object.entries({
      ...Object.fromEntries(before.database.classes.map(c => [c.id, required(auto[c.id])])),
      ...before.growth?.classPositions,
    });
    for (const classId of result.addedClassIds) {
      const p = required(project.growth?.classPositions[classId]);
      for (const [oldId, old] of occupied) {
        expect(Math.abs(old.x - p.x) >= 248 || Math.abs(old.y - p.y) >= 152,
          `${classId} at (${p.x},${p.y}) overlaps ${oldId} at (${old.x},${old.y})`).toBe(true);
      }
      occupied.push([classId, p]);
    }
    expect(project.database.classes.slice(0, before.database.classes.length)).toEqual(before.database.classes);
    expect(Object.keys(required(project.growth).classPositions).sort()).toEqual([
      ...Object.keys(before.growth?.classPositions ?? {}), ...result.addedClassIds,
    ].sort());
    if (authored) {
      expect(project.growth).toMatchObject(before.growth);
      expect(result.addedClassIds).not.toContain(reservedId);
    }
    const loaded = deserialize(serialize(project));
    expect(() => validateProjectReferences(loaded)).not.toThrow();
    expect(loaded.growth).toEqual(project.growth);
  });
});

describe.each(roles)('%s preset runtime integration', role => {
  it('enforces prerequisite, level, points and ranks, with real passive battler effects and refunds', () => {
    const project = createBlankProject();
    applyGrowthPreset(project, `skill-${role}`);
    const tree = required(project.growth?.skillTrees[0]);
    const actor = required(project.database.actors[0]), session = startSession(project);
    const root = required(tree.nodes.find(n => n.prerequisites.length === 0));
    const child = required(tree.nodes.find(n => n.prerequisites.includes(root.id)));
    session.actorLevels[actor.id] = 99;
    expect(investSkillNode(project, session, actor.id, tree.id, child.id)).toBeTypeOf('string');
    session.actorLevels[actor.id] = 1;
    expect(investSkillNode(project, session, actor.id, tree.id, root.id)).toBeUndefined();
    expect(growthPoints(project, session, actor.id).spent).toBe(root.cost);
    expect(investSkillNode(project, session, actor.id, tree.id, child.id)).toBeTypeOf('string');
    session.actorLevels[actor.id] = 99;
    const baseline = required(actorBattlers(project, { levels: session.actorLevels })[0]);
    for (const node of tree.nodes) {
      const already = node.id === root.id ? 1 : 0;
      for (let rank = already; rank < node.maxRank; rank++) expect(investSkillNode(project, session, actor.id, tree.id, node.id)).toBeUndefined();
    }
    const spent = growthPoints(project, session, actor.id).spent;
    expect(investSkillNode(project, session, actor.id, tree.id, root.id)).toBeTypeOf('string');
    expect(growthPoints(project, session, actor.id).spent).toBe(spent);
    const effects = growthEffects(project, session, actor.id);
    const battler = required(actorBattlers(project, { levels: session.actorLevels, growthProgress: session.growthProgress })[0]);
    for (const node of tree.nodes) if (node.effect.kind === 'parameter') {
      const parameter = node.effect.parameter;
      const stat = parameter === 'attack' ? 'attackPower' : parameter;
      expect(battler[stat]).toBe(baseline[stat] + effects.bonuses[parameter]);
    }
    expect(battler.skillIds).toEqual(expect.arrayContaining(effects.skillIds));
    expect(resetSkillTree(project, session, actor.id, tree.id)).toBeUndefined();
    expect(growthPoints(project, session, actor.id).spent).toBe(0);
    required(project.growth).initialPoints = 0; required(project.growth).pointsPerLevel = 0;
    expect(investSkillNode(project, session, actor.id, tree.id, root.id)).toBeTypeOf('string');
    expect(growthPoints(project, session, actor.id).spent).toBe(0);
  });
  it('executes every supplied skill through the actual battle command surface', () => {
    const project = createBlankProject();
    const added = applyGrowthPreset(project, `skill-${role}`);
    const actor = required(project.database.actors[0]), session = startSession(project);
    project.session.partyActorIds = [actor.id]; project.system.startActorIds = [actor.id];
    session.actorLevels[actor.id] = 30;
    const tree = required(project.growth?.skillTrees[0]);
    for (const node of tree.nodes) expect(investSkillNode(project, session, actor.id, tree.id, node.id)).toBeUndefined();
    for (const skillId of added.addedSkillIds) {
      const skill = required(project.database.skills.find(s => s.id === skillId));
      const runtime = createBattleRuntime({ project, troopId: required(project.database.troops[0]).id,
        canEscape: true, canLose: true, battleFlow: 'strict', rng: deterministicRng(622, skillId),
        party: { levels: session.actorLevels, experience: {}, partyActorIds: [actor.id],
          growthProgress: session.growthProgress, vitals: { [actor.id]: { hp: 1, mp: 9999 } } },
      });
      const before = runtime.snapshot(), user = required(before.actors[0]), enemy = required(before.enemies[0]);
      expect(before.phase).toBe('actorCommand');
      expect(user.skillIds).toContain(skillId);
      runtime.performActorCommand(skill.effect.kind === 'healing'
        ? { kind: 'skill', skillId, targetActorId: user.id, targetEnemyId: user.id }
        : { kind: 'skill', skillId, targetEnemyId: enemy.id });
      const after = runtime.snapshot();
      expect(required(after.actors[0]).mp).toBe(user.mp - skill.mpCost.flat);
      if (skill.effect.kind === 'healing') expect(required(after.actors[0]).hp).toBeGreaterThan(user.hp);
      else expect(required(after.enemies[0]).hp).toBeLessThan(enemy.hp);
    }
  });
  it('executes both promotion branches at their required levels and learns supplied skills', () => {
    const project = createBlankProject();
    const added = applyGrowthPreset(project, `promotion-${role}`);
    const actor = required(project.database.actors[0]);
    for (const klass of project.database.classes.filter(c => added.addedClassIds.includes(c.id))) {
      for (const edge of klass.promotions ?? []) {
        const session = startSession(project), level = required(edge.requires.level);
        session.actorLevels[actor.id] = level - 1;
        expect(changeActorClass(session, project, actor.id, klass.id).ok).toBe(true);
        expect(promoteActor(session, project, actor.id, edge.toClassId).ok).toBe(false);
        session.actorLevels[actor.id] = level;
        expect(promoteActor(session, project, actor.id, edge.toClassId).ok).toBe(true);
        expect(session.classOverrides?.[actor.id]).toBe(edge.toClassId);
        const target = required(project.database.classes.find(c => c.id === edge.toClassId));
        expect(session.actorSkillIds[actor.id]).toEqual(expect.arrayContaining(target.learnedSkills.filter(s => s.level <= level).map(s => s.skillId)));
      }
    }
  });
});
