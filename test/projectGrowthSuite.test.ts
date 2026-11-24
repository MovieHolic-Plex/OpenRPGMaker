import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { applyGrowthPreset, GROWTH_PRESETS } from "@/project/growth/presets";
import { createGrowthPresetTemplate } from "@/project/growth/presetTemplates";
import { emptyGrowth, GROWTH_PARAMETERS } from "@/project/growth/types";
import { growthIssues } from "@/project/growth/validation";
import { serialize, deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { changeActorClass, promoteActor, promotionRequirementsMet } from "@/project/sessionClass";
import { growthPoints, investSkillNode, growthEffects, activeSkillTrees, resetSkillTree } from "@/project/growth/runtime";
import { integratedGrowthFixture as fixture } from "./fixtures/growthIntegrated";
import { createBattleRuntime } from "@/battle/runtime";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { actorBattlers } from "@/battle/battleBattlers";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { existsSync } from "node:fs";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { classGrowthArt, skillGrowthArt, parameterGrowthArt, treeGrowthArt } from "@/assets/growthTreeArt";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isolateTimers } from "./mergedTeardown";

describe("growthConnectedPresets", () => {
  isolateTimers();
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
});

describe("growthIntegrated", () => {
  isolateTimers();
  describe('integrated actual promotion lineage', () => {
    it.each(['B', 'C'])('retains only the actual diamond path through %s', branch => {
      const {project, actor, session} = fixture();
      promoteActor(session, project, actor.id, branch);
      promoteActor(session, project, actor.id, 'D');
      expect(activeSkillTrees(project, session, actor.id).map(t => t.id)).toEqual(['tree-A', `tree-${branch}`, 'tree-D']);
      expect(session.promotionLineage?.[actor.id]).toEqual(['A', branch, 'D']);
    });
    it('does not fabricate ancestors for advanced starts or old saves', () => {
      const {project, actor, session} = fixture(); actor.classId = 'D';
      expect(activeSkillTrees(project, session, actor.id).map(t => t.id)).toEqual(['tree-D']);
      session.classOverrides[actor.id] = 'B';
      expect(activeSkillTrees(project, session, actor.id).map(t => t.id)).toEqual(['tree-B']);
    });
    it('resets the chain on arbitrary reclass, even along an authored edge', () => {
      const {project, actor, session} = fixture();
      promoteActor(session, project, actor.id, 'B');
      changeActorClass(session, project, actor.id, 'D');
      expect(session.promotionLineage?.[actor.id]).toEqual(['D']);
    });
    it('preserves lineage and investments on same-class reclass', () => {
      const {project, actor, session} = fixture();
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      promoteActor(session, project, actor.id, 'B');
      changeActorClass(session, project, actor.id, 'B');
      expect(session.promotionLineage?.[actor.id]).toEqual(['A', 'B']);
      expect(growthEffects(project, session, actor.id).bonuses.defense).toBe(7);
    });
    it('ignores unrelated saved lineage when the override is invalid', () => {
      const {project, actor, session} = fixture();
      session.classOverrides[actor.id] = 'deleted'; session.promotionLineage = { [actor.id]: ['B', 'D'] };
      expect(activeSkillTrees(project, session, actor.id).map(t => t.id)).toEqual(['tree-A']);
      expect(actorBattlers(project, {classOverrides: session.classOverrides})[0]?.maxHp).toBe(actorBattlers(project)[0]?.maxHp);
    });
    it('retains outgoing eligible skills but never future or reversible tree grants', () => {
      const {project, actor, session} = fixture();
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      investSkillNode(project, session, actor.id, 'tree-A', 'skill');
      promoteActor(session, project, actor.id, 'B');
      expect(session.actorSkillIds[actor.id]).toEqual(expect.arrayContaining(['A-skill', 'B-skill']));
      expect(session.actorSkillIds[actor.id]).not.toContain('tree-skill');
      expect(session.actorSkillIds[actor.id]).not.toContain('future');
    });
  });
  describe('qualified growth requirements', () => {
    it('ANDs local and qualified rank prerequisites and blocks reset of a depended-on tree', () => {
      const {project, actor, session, trees} = fixture();
      const node = trees[1]?.nodes[1]; if (!node) throw new Error('node missing');
      node.requiredNodes = [{ treeId: 'tree-A', nodeId: 'root', rank: 2 }];
      promoteActor(session, project, actor.id, 'B');
      investSkillNode(project, session, actor.id, 'tree-B', 'root');
      expect(investSkillNode(project, session, actor.id, 'tree-B', 'skill')).toBeTypeOf('string');
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      expect(investSkillNode(project, session, actor.id, 'tree-B', 'skill')).toBeUndefined();
      const before = structuredClone(session);
      expect(resetSkillTree(project, session, actor.id, 'tree-A')).toBeTypeOf('string');
      expect(session).toEqual(before);
      expect(resetSkillTree(project, session, actor.id, 'tree-B')).toBeUndefined();
      if (trees[0]?.nodes[0]) trees[0].nodes[0].cost = 90;
      expect(growthPoints(project, session, actor.id).spent).toBe(4);
      expect(resetSkillTree(project, session, actor.id, 'tree-A')).toBeUndefined();
      expect(growthPoints(project, session, actor.id).spent).toBe(0);
    });
    it('checks every promotion gate at its boundary without consuming new requirements', () => {
      const {project, actor, session} = fixture();
      const promotion = project.database.classes[0]?.promotions?.[0]; if (!promotion) throw new Error('promotion missing');
      promotion.requires = {level: 3, requiredSkillIds: ['tree-skill'], requiredNodes: [{treeId:'tree-A', nodeId:'root', rank:2}], requiredTreePoints: [{treeId:'tree-A', points:5}]};
      const before = structuredClone(session);
      expect(promoteActor(session, project, actor.id, 'B').ok).toBe(false);
      expect(session).toEqual(before);
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      investSkillNode(project, session, actor.id, 'tree-A', 'skill');
      expect(promoteActor(session, project, actor.id, 'B').ok).toBe(false);
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      delete session.actorLevels[actor.id];
      expect(promoteActor(session, project, actor.id, 'B').ok).toBe(true);
      expect(growthPoints(project, session, actor.id).spent).toBe(5);
    });
    it('counts inactive retained ranks/spending, capped ranks and current-price-independent spending', () => {
      const {project, actor, session, trees} = fixture();
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      changeActorClass(session, project, actor.id, 'D');
      const node = trees[0]?.nodes[0]; if (!node) throw new Error('node missing'); node.cost = 99;
      const requires = { requiredNodes: [{treeId:'tree-A', nodeId:'root', rank:2}], requiredTreePoints: [{treeId:'tree-A', points:4}] };
      expect(promotionRequirementsMet(session, actor.id, requires, project)).toBe(true);
      node.maxRank = 1;
      expect(promotionRequirementsMet(session, actor.id, requires, project)).toBe(false);
    });
  });
  describe('integrated battle state', () => {
    it('writes several promotions returning to the same class authoritatively, then saves the chain', () => {
      const {project, actor, session} = fixture();
      const troop = project.database.troops[0]; if (!troop) throw new Error('troop missing');
      project.system.battleFlow = 'strict';
      session.classOverrides[actor.id] = 'A';
      investSkillNode(project, session, actor.id, 'tree-A', 'root');
      investSkillNode(project, session, actor.id, 'tree-A', 'skill');
      const gate = project.database.classes[0]?.promotions?.[0]; if (!gate) throw new Error('gate missing');
      gate.requires = { requiredSkillIds:['tree-skill'], requiredNodes:[{treeId:'tree-A',nodeId:'root',rank:1}], requiredTreePoints:[{treeId:'tree-A',points:3}] };
      troop.battleEventPages = [{ id:'chain', name:'chain', span:'battle', conditions:[{kind:'actorCommand',actorId:actor.id,commandId:'defend'}], commands:[
        {kind:'promoteActor',actorId:actor.id,toClassId:'B'}, {kind:'promoteActor',actorId:actor.id,toClassId:'D'}, {kind:'promoteActor',actorId:actor.id,toClassId:'A'},
      ] }];
      const runtime = createBattleRuntime({project,troopId:troop.id,canEscape:true,canLose:true,rng:()=>0.5,sessionState:session,party:{levels:session.actorLevels,experience:session.actorExperience,partyActorIds:[actor.id],classOverrides:session.classOverrides,growthProgress:session.growthProgress}});
      runtime.performActorCommand({kind:'defend'});
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.promotionLineage?.[actor.id]).toEqual(['A','B','D']);
      expect(snapshot.actors[0]?.skillIds).toEqual(expect.arrayContaining(['A-skill','B-skill','D-skill','tree-skill']));
      expect(snapshot.eventState.actorSkillIds?.[actor.id]).not.toContain('tree-skill');
      applyBattleRewardsToSession(session, {result:'escape',rewards:snapshot.rewards,actors:snapshot.actors,eventState:snapshot.eventState}, project);
      expect(session.promotionLineage?.[actor.id]).toEqual(['A','B','D']);
      expect(applySaveSnapshot(project,createSaveSnapshot(project,session)).promotionLineage).toEqual(session.promotionLineage);
    });
    it('uses destination curves, permanent bonuses and active tree bonuses in equipment menu previews', () => {
      const {project, actor, session} = fixture();
      const klass = project.database.classes.find(c => c.id === 'B'); if (!klass) throw new Error('class missing');
      klass.parameterCurves.attack = Array(99).fill(80); actor.parameterCurves.attack = Array(99).fill(12);
      session.actorParamBonuses = {[actor.id]:{attack:5}};
      changeActorClass(session,project,actor.id,'B');
      const menu = createStatusMenuDetail({project,session,selectedCommand:'equipment',slots:[],waitModeEnabled:true,equipmentActorId:actor.id,equipmentSlotId:'weapon'});
      const stats = menu.entries[0]?.statDelta;
      expect(stats?.[0]?.current).toBe(actorBattlers(project,{classOverrides:session.classOverrides,paramBonuses:session.actorParamBonuses,equipment:session.actorEquipment})[0]?.attackPower);
    });
  });
  describe('integrated growth persistence boundaries', () => {
    it('preserves extension fields through normalization and project round trips', () => {
      const {project, trees} = fixture();
      const promotion = project.database.classes[0]?.promotions?.[0]; if (!promotion || !trees[1]?.nodes[0]) throw new Error('fixture missing');
      promotion.requires = { requiredSkillIds:['A-skill'], requiredNodes:[{treeId:'tree-A',nodeId:'root',rank:2}], requiredTreePoints:[{treeId:'tree-A',points:4}] };
      trees[1].nodes[0].requiredNodes = [{treeId:'tree-A',nodeId:'root',rank:2}];
      const loaded = deserialize(serialize(project));
      expect(loaded.database.classes[0]?.promotions?.[0]?.requires).toMatchObject(promotion.requires);
      expect(loaded.growth).toEqual(project.growth);
    });
    it('rejects malformed present promotion extension fields rather than erasing them', () => {
      const {project} = fixture();
      const raw = JSON.parse(serialize(project)); raw.database.classes[0].promotions[0].requires.requiredNodes = 'invalid';
      expect(() => deserialize(JSON.stringify(raw))).toThrow();
    });
    it('rejects cross-tree cycles and invalid required ranks', () => {
      const {project, trees} = fixture();
      const a = trees[0]?.nodes[0], b = trees[1]?.nodes[0]; if (!a || !b) throw new Error('nodes missing');
      a.requiredNodes = [{treeId:'tree-B',nodeId:'root',rank:1}]; b.requiredNodes = [{treeId:'tree-A',nodeId:'root',rank:1}];
      expect(growthIssues(project).length).toBeGreaterThan(0);
      expect(() => deserialize(serialize(project))).toThrow();
    });
    it('round trips earned lineage and permanent skills through save slots', () => {
      const {project, actor, session} = fixture(); promoteActor(session, project, actor.id, 'B'); promoteActor(session, project, actor.id, 'D');
      const data = new Map<string,string>(); const storage = {getItem:(key:string) => data.get(key) ?? null, setItem:(key:string,value:string) => {data.set(key,value);}};
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const saved = readSaveSlot(storage, 1); if (saved.kind !== 'present') throw new Error('save missing');
      const restored = applySaveSnapshot(project, saved.snapshot);
      expect(restored.promotionLineage?.[actor.id]).toEqual(['A','B','D']);
      expect(restored.actorSkillIds[actor.id]).toEqual(expect.arrayContaining(['A-skill','B-skill','D-skill']));
    });
  });
});

describe("growthTreeArt", () => {
  isolateTimers();
  describe('growth role art', () => {
    it('distinguishes class roles without borrowing an arbitrary actor face', () => {
      const p = createBlankProject(), base = p.database.classes[0]!;
      const ids = ['전사', '마법사', '성직자', '궁수'].map(name => classGrowthArt(p, { ...base, name }));
      expect(new Set(ids).size).toBe(4);
      for (const id of ids) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
    });
    it('uses skill effects, never the whole authored animation sheet', () => {
      const p = createBlankProject();
      const skill = normalizeSkillRecord({ id: 'custom', name: 'Custom', animationId: p.database.battleAnimations[0]?.id });
      skill.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-holy-water');
      skill.effect = { kind: 'damage', statistic: 'mind', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-magic');
      skill.effect = { kind: 'damage', statistic: 'attack', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-sword');
    });
    it('provides registered, distinct parameter symbols and missing-record fallback', () => {
      const ids = GROWTH_PARAMETERS.map(parameterGrowthArt);
      expect(new Set(ids).size).toBe(6);
      for (const id of [...ids, skillGrowthArt(undefined)]) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
      expect(skillGrowthArt(undefined)).toBe('cc0-jetrel-skill-book');
    });
    it('supports custom classes through learned skills and empty trees without mutation', () => {
      const p = createBlankProject(), c = structuredClone(p.database.classes[0]!);
      c.name = '별지기'; c.options.dualWield = false; c.options.mightyGuard = false;
      const heal = normalizeSkillRecord({ id: 'custom-heal', name: '별빛' });
      heal.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
      p.database.skills.push(heal); c.learnedSkills = [{ level: 1, skillId: heal.id }]; c.skillIds = [];
      const before = JSON.stringify(p);
      expect(classGrowthArt(p, c)).toBe('cc0-jetrel-holy-water');
      expect(treeGrowthArt(p, { id: 'empty', name: 'Empty', description: '', nodes: [], classIds: [], allowReset: true })).toBe('cc0-jetrel-skill-book');
      expect(JSON.stringify(p)).toBe(before);
    });
  });
});
