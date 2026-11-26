import { describe, expect, it } from "vitest";
import { integratedGrowthFixture as fixture } from "./fixtures/growthIntegrated";
import { changeActorClass, promoteActor, promotionRequirementsMet } from "@/project/sessionClass";
import { activeSkillTrees, investSkillNode, resetSkillTree, growthEffects, growthPoints, actorOwnedSkillIds } from "@/project/growth/runtime";
import { createBattleRuntime } from "@/battle/runtime";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { actorBattlers } from "@/battle/battleBattlers";
import { serialize, deserialize } from "@/project/io";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { growthIssues, assertGrowthShape } from "@/project/growth/validation";
import { refreshGrowthVitals } from "@/project/growth/vitals";
import { transitionActorEquipment } from "@/project/equipmentRules";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import { isolateTimers } from "./mergedTeardown";

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

describe("growthIntegratedBoundaries", () => {
  isolateTimers();
  it('does not let an invalid override revive unrelated tree skills even if lineage contains the fallback class', () => {
    const {project,actor,session}=fixture();
    session.classOverrides[actor.id]='deleted'; session.promotionLineage={[actor.id]:['A','B']};
    session.growthProgress={[actor.id]:{'tree-B':{skill:{rank:1,spent:1}}}};
    expect(actorOwnedSkillIds(project,session,actor.id)).not.toContain('tree-skill');
    expect(actorBattlers(project,{classOverrides:session.classOverrides,promotionLineage:session.promotionLineage,growthProgress:session.growthProgress})[0]?.skillIds).not.toContain('tree-skill');
  });
  it('uses the fallback class equipment restrictions when an override is invalid', () => {
    const {project,actor}=fixture(); const klass=project.database.classes.find(c=>c.id===actor.classId); if (!klass) throw new Error('class missing');
    klass.options.fixedEquipment=true;
    expect(transitionActorEquipment({project,actorId:actor.id,classId:'deleted',inventory:{},slot:'weapon'})).toMatchObject({kind:'rejected',reason:'fixedEquipment'});
  });
  it('seeds battlers and event state consistently when a session-state override is supplied', () => {
    const {project,actor,session}=fixture(); const troop=project.database.troops[0]; if (!troop) throw new Error('troop missing');
    promoteActor(session,project,actor.id,'B'); session.actorSkillIds[actor.id]=['D-skill'];
    const snapshot=createBattleRuntime({project,troopId:troop.id,sessionState:session,canEscape:true,canLose:true,rng:()=>0.5}).snapshot();
    expect(snapshot.actors[0]?.classId).toBe('B'); expect(snapshot.actors[0]?.skillIds).toContain('D-skill');
    expect(snapshot.eventState.promotionLineage).toEqual(session.promotionLineage);
  });
  it('keeps an active tree grant when a battle event forgets the independent copy', () => {
    const {project,actor,session}=fixture(); const troop=project.database.troops[0]; if (!troop) throw new Error('troop missing');
    project.system.battleFlow='strict'; investSkillNode(project,session,actor.id,'tree-A','root'); investSkillNode(project,session,actor.id,'tree-A','skill'); session.actorSkillIds[actor.id]=['tree-skill'];
    troop.battleEventPages=[{id:'forget',name:'forget',span:'battle',conditions:[{kind:'actorCommand',actorId:actor.id,commandId:'defend'}],commands:[{kind:'learnSkill',actorId:actor.id,skillId:'tree-skill',action:'forget'}]}];
    const runtime=createBattleRuntime({project,troopId:troop.id,sessionState:session,canEscape:true,canLose:true,rng:()=>0.5}); runtime.performActorCommand({kind:'defend'});
    expect(runtime.snapshot().eventState.actorSkillIds?.[actor.id]).not.toContain('tree-skill');
    expect(runtime.snapshot().actors[0]?.skillIds).toContain('tree-skill');
  });
  it('makes outgoing actor-level skills permanent and stops former-class future accrual', () => {
    const {project,actor,session}=fixture(); const klass=project.database.classes.find(c=>c.id==='B'); if (!klass) throw new Error('class missing');
    klass.learnedSkills=[{level:1,skillId:'B-skill'}];
    promoteActor(session,project,actor.id,'B'); session.actorLevels[actor.id]=9;
    expect(session.actorSkillIds[actor.id]).toContain('actor-skill');
    expect(actorOwnedSkillIds(project,session,actor.id)).not.toContain('future');
  });
  it.each([undefined,false])('keeps legacy current-only activation for inherit=%s', inherit => {
    const {project,actor,session,trees}=fixture(); const tree=trees[0]; if (!tree) throw new Error('tree missing'); tree.inheritOnPromotion=inherit;
    promoteActor(session,project,actor.id,'B'); expect(activeSkillTrees(project,session,actor.id).map(t=>t.id)).toEqual(['tree-B']);
  });
  it('does not rewrite earned lineage when authored edges change', () => {
    const {project,actor,session}=fixture(); promoteActor(session,project,actor.id,'B');
    for (const klass of project.database.classes) klass.promotions=[];
    expect(activeSkillTrees(project,session,actor.id).map(t=>t.id)).toEqual(['tree-A','tree-B']);
  });
  it('never transiently clamps inherited HP away during promotion, and reset does not demote or heal', () => {
    const {project,actor,session,trees}=fixture(); const node=trees[0]?.nodes[0], klass=project.database.classes.find(c=>c.id==='B'); if (!node || !klass) throw new Error('fixture missing');
    actor.parameterCurves.maxHp=Array(99).fill(100); klass.parameterCurves.maxHp=Array(99).fill(100); node.effect={kind:'parameter',parameter:'maxHp',amount:50};
    investSkillNode(project,session,actor.id,'tree-A','root'); refreshGrowthVitals(project,session,actor.id);
    const vitals=session.actorVitals[actor.id]; if (!vitals) throw new Error('vitals missing'); vitals.hp=130;
    promoteActor(session,project,actor.id,'B'); expect(session.actorVitals[actor.id]).toMatchObject({maxHp:150,hp:130});
    resetSkillTree(project,session,actor.id,'tree-A'); refreshGrowthVitals(project,session,actor.id);
    expect(session.actorVitals[actor.id]).toMatchObject({maxHp:100,hp:100}); expect(session.classOverrides[actor.id]).toBe('B');
  });
  it.each(['skill','rank','points'] as const)('fails only the %s admission gate below boundary and passes at boundary', gate => {
    const {project,actor,session}=fixture();
    const requires=gate==='skill'?{requiredSkillIds:['tree-skill']}:gate==='rank'?{requiredNodes:[{treeId:'tree-A',nodeId:'root',rank:2}]}:{requiredTreePoints:[{treeId:'tree-A',points:4}]};
    investSkillNode(project,session,actor.id,'tree-A','root');
    const before=structuredClone(session); expect(promotionRequirementsMet(session,actor.id,requires,project)).toBe(false); expect(session).toEqual(before);
    investSkillNode(project,session,actor.id,'tree-A',gate==='skill'?'skill':'root');
    const vitals=session.actorVitals[actor.id]; if (vitals) vitals.mp=0;
    expect(promotionRequirementsMet(session,actor.id,requires,project)).toBe(true);
  });
  it('accepts independent skills after tree reset, but not inactive tree-only ownership', () => {
    const {project,actor,session}=fixture(); investSkillNode(project,session,actor.id,'tree-A','root'); investSkillNode(project,session,actor.id,'tree-A','skill');
    changeActorClass(session,project,actor.id,'D'); expect(promotionRequirementsMet(session,actor.id,{requiredSkillIds:['tree-skill']},project)).toBe(false);
    session.actorSkillIds[actor.id]=['tree-skill']; resetSkillTree(project,session,actor.id,'tree-A');
    expect(promotionRequirementsMet(session,actor.id,{requiredSkillIds:['tree-skill']},project)).toBe(true);
  });
  it('selects the first eligible authored edge when destination is omitted', () => {
    const {project,actor,session}=fixture(); const first=project.database.classes[0]?.promotions?.[0]; if (!first) throw new Error('edge missing'); first.requires={requiredSkillIds:['tree-skill']};
    expect(promoteActor(session,project,actor.id)).toMatchObject({ok:true,classId:'C'});
  });
  it.each([null,'true',1])('rejects malformed inheritance %s', value => {
    const {project}=fixture(); const growth=structuredClone(project.growth); if (!growth?.skillTrees[0]) throw new Error('tree missing');
    Object.assign(growth.skillTrees[0],{inheritOnPromotion:value}); expect(()=>assertGrowthShape(growth)).toThrow();
  });
  it.each([null,'nodes',[{treeId:'tree-A',nodeId:'root',rank:0}],[{treeId:'tree-A',nodeId:'root',rank:1.5}],[{treeId:'tree-A',nodeId:'root',rank:100}]])('rejects malformed qualified requirements %j', value => {
    const {project}=fixture(); const growth=structuredClone(project.growth); if (!growth?.skillTrees[0]?.nodes[0]) throw new Error('node missing');
    Object.assign(growth.skillTrees[0].nodes[0],{requiredNodes:value}); expect(()=>assertGrowthShape(growth)).toThrow();
    const klass=project.database.classes[0]; if (!klass) throw new Error('class missing'); const copy=structuredClone(klass); if (!copy.promotions?.[0]) throw new Error('edge missing'); Object.assign(copy.promotions[0].requires,{requiredNodes:value}); expect(()=>normalizeClassRecord(copy)).toThrow();
  });
  it.each([{requiredSkillIds:null},{requiredSkillIds:[3]},{requiredTreePoints:null},{requiredTreePoints:[{treeId:'tree-A',points:-1}]},{requiredTreePoints:[{treeId:'tree-A',points:1.5}]}])('rejects malformed promotion extensions %j before normalization loses them', extension => {
    const {project}=fixture(); const klass=project.database.classes[0]; if (!klass?.promotions?.[0]) throw new Error('edge missing'); Object.assign(klass.promotions[0].requires,extension); expect(()=>normalizeClassRecord(klass)).toThrow();
  });
  it.each([{requiredSkillIds:['absent']},{requiredNodes:[{treeId:'absent',nodeId:'root',rank:1}]},{requiredNodes:[{treeId:'tree-A',nodeId:'root',rank:4}]},{requiredTreePoints:[{treeId:'absent',points:1}]}])('rejects invalid promotion references %j', requires => {
    const {project}=fixture(); const path=project.database.classes[0]?.promotions?.[0]; if (!path) throw new Error('edge missing'); path.requires=requires; expect(growthIssues(project).length).toBeGreaterThan(0);
  });
  it.each([{promotionLineage:null},{promotionLineage:{actor:['A','A']}},{promotionLineage:{actor:'A'}},{growthProgress:{actor:{tree:{node:{rank:1,spent:-1}}}}},{growthProgress:{actor:{tree:{node:{rank:1.5,spent:2}}}}}])('rejects malformed present saved growth fields %j', extension => {
    const {project,session}=fixture(); const snapshot=createSaveSnapshot(project,session); const value={...snapshot,session:{...snapshot.session,...extension}};
    expect(readSaveSlot({getItem:()=>JSON.stringify(value)},1).kind).toBe('corrupt');
  });
});
