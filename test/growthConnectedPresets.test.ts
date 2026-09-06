import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { applyGrowthPreset, GROWTH_PRESETS } from '@/project/growth/presets';
import { createGrowthPresetTemplate } from '@/project/growth/presetTemplates';
import { emptyGrowth } from '@/project/growth/types';
import { growthIssues } from '@/project/growth/validation';
import { serialize, deserialize } from '@/project/io';
import { startSession } from '@/project/session';
import { changeActorClass, promoteActor } from '@/project/sessionClass';
import { growthPoints, investSkillNode, growthEffects } from '@/project/growth/runtime';

const roles = ['vanguard', 'arcane', 'ranger'];
describe.each(roles)('connected %s bundle', role => {
  const id = `bundle-${role}`;
  it('adds nonempty inheritable trees for every class and remaps every qualified reference independently', () => {
    const preset = GROWTH_PRESETS.find(p => p.id === id);
    expect(preset).toBeDefined();
    if (!preset) throw new Error(id);
    const template = createGrowthPresetTemplate(preset);
    const project = createBlankProject();
    project.growth = { ...emptyGrowth(), initialPoints: 0, pointsPerLevel: 0 };
    const before = structuredClone(project);
    for (let copy = 0; copy < 2; copy++) {
      const result = applyGrowthPreset(project, id);
      const trees = project.growth!.skillTrees.filter(t => result.addedTreeIds.includes(t.id));
      const classes = project.database.classes.filter(c => result.addedClassIds.includes(c.id));
      expect(classes).toHaveLength(5); expect(trees).toHaveLength(5);
      expect(classes[0]?.promotions).toHaveLength(2);
      expect(trees.every(t => t.inheritOnPromotion && t.nodes.length > 0)).toBe(true);
      expect(new Set(trees.flatMap(t => t.classIds))).toEqual(new Set(result.addedClassIds));
      expect(trees.some(t => t.nodes.some(n => n.requiredNodes?.some(r => r.treeId !== t.id)))).toBe(true);
      for (const [i, tree] of trees.entries()) {
        expect(tree.nodes).toHaveLength(template.trees[i]!.nodes.length);
        for (const node of tree.nodes) {
          for (const local of node.prerequisites) expect(tree.nodes.some(n => n.id === local)).toBe(true);
          for (const req of node.requiredNodes ?? []) {
            const target = trees.find(t => t.id === req.treeId);
            expect(target?.nodes.find(n => n.id === req.nodeId)?.maxRank).toBeGreaterThanOrEqual(req.rank);
          }
          if (node.effect.kind === 'skill') {
            expect(result.addedSkillIds).toContain(node.effect.skillId);
            for (const klass of classes) {
              expect(klass.skillIds).not.toContain(node.effect.skillId);
              expect(klass.learnedSkills.map(s => s.skillId)).not.toContain(node.effect.skillId);
            }
          }
        }
      }
      for (const klass of classes) for (const edge of klass.promotions ?? []) {
        expect(result.addedClassIds).toContain(edge.toClassId);
        expect(edge.requires.requiredSkillIds?.length).toBeGreaterThan(0);
        expect(edge.requires.requiredNodes?.length).toBeGreaterThan(0);
        expect(edge.requires.requiredTreePoints?.length).toBeGreaterThan(0);
        for (const skill of edge.requires.requiredSkillIds ?? []) expect(result.addedSkillIds).toContain(skill);
        for (const req of edge.requires.requiredNodes ?? []) expect(trees.find(t => t.id === req.treeId)?.nodes.some(n => n.id === req.nodeId)).toBe(true);
        for (const req of edge.requires.requiredTreePoints ?? []) expect(result.addedTreeIds).toContain(req.treeId);
      }
      expect(growthIssues(project)).toEqual([]);
    }
    expect(project.database.actors).toEqual(before.database.actors);
    expect(project.database.classes.slice(0, before.database.classes.length)).toEqual(before.database.classes);
    expect(project.database.skills.slice(0, before.database.skills.length)).toEqual(before.database.skills);
    expect(project.growth).toMatchObject({ initialPoints: 0, pointsPerLevel: 0 });
    expect(deserialize(serialize(project)).growth).toEqual(project.growth);
  });
  it.each([0, 1])('reaches branch %i and its final class at advertised levels without bonus points', branch => {
    const project = createBlankProject(); delete project.growth;
    const result = applyGrowthPreset(project, id);
    const actor = project.database.actors[0]!;
    const root = project.database.classes.find(c => c.id === result.addedClassIds[0])!;
    const first = root.promotions![branch]!;
    const middle = project.database.classes.find(c => c.id === first.toClassId)!;
    const final = middle.promotions![0]!;
    const session = startSession(project);
    expect(changeActorClass(session, project, actor.id, root.id).ok).toBe(true);
    for (const [klass, edge] of [[root, first], [middle, final]] as const) {
      session.actorLevels[actor.id] = edge.requires.level!;
      const untrained = structuredClone(session);
      expect(promoteActor(session, project, actor.id, edge.toClassId).ok).toBe(false);
      expect(session).toEqual(untrained);
      const tree = project.growth!.skillTrees.find(t => t.classIds.includes(klass.id))!;
      for (const node of tree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
        expect(investSkillNode(project, session, actor.id, tree.id, node.id)).toBeUndefined();
      }
      session.actorLevels[actor.id] = edge.requires.level! - 1;
      const below = structuredClone(session);
      expect(promoteActor(session, project, actor.id, edge.toClassId).ok).toBe(false);
      expect(session).toEqual(below);
      session.actorLevels[actor.id] = edge.requires.level!;
      expect(growthPoints(project, session, actor.id).available).toBeGreaterThanOrEqual(0);
      expect(promoteActor(session, project, actor.id, edge.toClassId).ok).toBe(true);
    }
    const lastTree = project.growth!.skillTrees.find(t => t.classIds.includes(final.toClassId))!;
    for (const node of lastTree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
      expect(investSkillNode(project, session, actor.id, lastTree.id, node.id)).toBeUndefined();
    }
    expect(growthEffects(project, session, actor.id).skillIds.length).toBeGreaterThan(0);
    expect(session.actorSkillIds[actor.id] ?? []).not.toEqual(expect.arrayContaining(result.addedSkillIds));
    for (const skill of result.addedSkillIds) expect(session.actorSkillIds[actor.id] ?? []).not.toContain(skill);
  });
});
