import { describe, expect, it } from 'vitest';
import { integratedGrowthFixture as fixture } from './fixtures/growthIntegrated';
import { changeActorClass, promoteActor, promotionRequirementsMet } from '@/project/sessionClass';
import { activeSkillTrees, investSkillNode, resetSkillTree, growthEffects, growthPoints } from '@/project/growth/runtime';
import { createBattleRuntime } from '@/battle/runtime';
import { applyBattleRewardsToSession } from '@/player/battleRewardsToSession';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import { actorBattlers } from '@/battle/battleBattlers';
import { serialize, deserialize } from '@/project/io';
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from '@/player/saveSlots';
import { growthIssues } from '@/project/growth/validation';

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
