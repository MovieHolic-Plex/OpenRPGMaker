import { describe, expect, it } from 'vitest';
import { switchVariableReferencedInProject } from '@/editor/databaseCommandReferences';
import { createBlankProject } from '@/project/defaults';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { serialize, deserialize } from '@/project/io';
import { startSession } from '@/project/session';
import { emptyGrowth, type SkillTree } from '@/project/growth/types';
import { arrangeTree, wouldCreateCycle } from '@/project/growth/graph';
import { assertGrowthShape, growthIssues, isGrowthProgress } from '@/project/growth/validation';
import { activeSkillTrees, growthEffects, growthPoints, investSkillNode, resetSkillTree } from '@/project/growth/runtime';
import { refreshGrowthVitals } from '@/project/growth/vitals';
import { actorBattlers, refreshActorBattlerDerivedStats } from '@/battle/battleBattlers';
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from '@/player/saveSlots';
import { changeActorClass, promoteActor } from '@/project/sessionClass';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import { connectPromotion, connectSkillNodes, deleteSkillNode } from '@/editor/panels/growthTree/actions';

function fixture() {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  project.session.partyActorIds = [actor.id]; project.system.startActorIds = [actor.id];
  const klass = project.database.classes.find(c => c.id === actor.classId)!;
  project.database.classes.push({ ...structuredClone(klass), id: 'growth-test-next', name: '승급 직업' });
  project.database.skills.push(normalizeSkillRecord({ id: 'growth-test-skill', name: '트리 전용 스킬' }));
  const tree: SkillTree = { id: 'test-tree', name: '방패', description: '', classIds: [klass.id], allowReset: true, nodes: [
    { id: 'root', name: '방어 숙련', description: '', x: 20, y: 30, cost: 2, maxRank: 3, level: 1, prerequisites: [], effect: { kind: 'parameter', parameter: 'defense', amount: 7 } },
    { id: 'skill', name: '방패 밀치기', description: '', x: 260, y: 30, cost: 3, maxRank: 1, level: 3, prerequisites: ['root'], effect: { kind: 'skill', skillId: 'growth-test-skill' } },
    { id: 'hp', name: '체력', description: '', x: 260, y: 180, cost: 1, maxRank: 2, level: 1, prerequisites: ['root'], effect: { kind: 'parameter', parameter: 'maxHp', amount: 20 } },
  ] };
  project.growth = { ...emptyGrowth(), initialPoints: 5, pointsPerLevel: 2, skillTrees: [tree] };
  const session = startSession(project); session.actorLevels[actor.id] = 3;
  return { project, session, actor, klass, tree };
}

describe('growth graph authoring and persistence', () => {
  it('loads old v4 projects without adding growth data', () => {
    const project = createBlankProject(); expect(deserialize(serialize(project)).growth).toBeUndefined();
  });
  it('round trips node effects, prerequisites, classes and positions', () => {
    const {project} = fixture(); project.growth!.classPositions = { [project.database.classes[0]!.id]: {x: 64, y: 96} };
    expect(deserialize(serialize(project)).growth).toEqual(project.growth);
  });
  it('rejects malformed nodes, unsafe numbers and duplicate IDs', () => {
    const {project, tree} = fixture(); tree.nodes[0]!.cost = NaN; expect(() => assertGrowthShape(project.growth)).toThrow();
    tree.nodes[0]!.cost = 2; tree.nodes.push(structuredClone(tree.nodes[0]!)); expect(() => assertGrowthShape(project.growth)).toThrow(/중복/);
  });
  it('prevents cycles while allowing a diamond prerequisite graph', () => {
    expect(wouldCreateCycle([{from:'a',to:'b'},{from:'b',to:'c'}], 'c','a')).toBe(true);
    expect(wouldCreateCycle([{from:'a',to:'b'},{from:'a',to:'c'},{from:'b',to:'d'}], 'c','d')).toBe(false);
    const {tree} = fixture(); expect(connectSkillNodes(tree, 'skill', 'root')).toMatch(/순환/);
    expect(tree.nodes[0]!.prerequisites).toEqual([]);
  });
  it('places parents before children and terminates on imported legacy cycles', () => {
    const positions = arrangeTree(['a','b','c'], [{from:'a',to:'b'},{from:'b',to:'c'}]);
    expect(positions.a!.x).toBeLessThan(positions.b!.x); expect(positions.b!.x).toBeLessThan(positions.c!.x);
    expect(Object.keys(arrangeTree(['a','b'], [{from:'a',to:'b'},{from:'b',to:'a'}]))).toHaveLength(2);
  });
  it('removes incoming prerequisites when deleting a node', () => {
    const {tree} = fixture(); deleteSkillNode(tree,'root'); expect(tree.nodes.every(n => !n.prerequisites.length)).toBe(true);
  });
  it('validates references and does not silently discard an invalid graph on load', () => {
    const {project, tree} = fixture(); tree.nodes[1]!.effect = {kind:'skill',skillId:'missing'};
    expect(growthIssues(project)).toContain('방패 / 방패 밀치기: 스킬을 선택하세요.');
    expect(() => deserialize(serialize(project))).toThrow();
  });
  it('writes promotion edges to the existing runtime contract and blocks reverse cycles', () => {
    const {project, klass} = fixture(); expect(connectPromotion(project,klass.id,'growth-test-next',{level:4})).toBeUndefined();
    expect(connectPromotion(project,'growth-test-next',klass.id)).toMatch(/순환/);
    expect(klass.promotions).toEqual([{toClassId:'growth-test-next',requires:{level:4}}]);
  });
});

describe('growth progression through shipped runtime consumers', () => {
  it('preserves promotion requirements when an existing edge is connected again', () => {
    const {project, klass} = fixture();
    connectPromotion(project, klass.id, 'growth-test-next', {level: 12});
    connectPromotion(project, klass.id, 'growth-test-next');
    expect(klass.promotions).toEqual([{toClassId: 'growth-test-next', requires: {level: 12}}]);
  });
  it('protects the event bonus variable from deletion while referenced', () => {
    const {project} = fixture(); project.growth!.bonusVariableId = 'growth-bonus';
    expect(switchVariableReferencedInProject(project, 'variable', 'growth-bonus')).toBe(true);
    delete project.growth!.bonusVariableId;
    expect(switchVariableReferencedInProject(project, 'variable', 'growth-bonus')).toBe(false);
  });
  it('refunds deleted authored nodes and trees without losing remaining investments', () => {
    const {project, session, actor, tree} = fixture();
    investSkillNode(project, session, actor.id, tree.id, 'root');
    investSkillNode(project, session, actor.id, tree.id, 'skill');
    deleteSkillNode(tree, 'skill');
    expect(growthPoints(project, session, actor.id).spent).toBe(2);
    project.growth!.skillTrees = [];
    expect(growthPoints(project, session, actor.id).spent).toBe(0);
  });
  it('uses the original class when a saved override no longer exists', () => {
    const {project, session, actor, tree} = fixture();
    session.classOverrides = {[actor.id]: 'deleted-class'};
    expect(activeSkillTrees(project, session, actor.id)).toEqual([tree]);
  });
  it('requires parents and level, spends exact points, and rejects max rank without charging', () => {
    const {project,session,actor} = fixture();
    expect(investSkillNode(project,session,actor.id,'test-tree','skill')).toMatch(/선행/);
    expect(investSkillNode(project,session,actor.id,'test-tree','root')).toBeUndefined();
    session.actorLevels[actor.id] = 1;
    expect(investSkillNode(project,session,actor.id,'test-tree','skill')).toMatch(/레벨/);
    session.actorLevels[actor.id] = 3;
    expect(investSkillNode(project,session,actor.id,'test-tree','skill')).toBeUndefined();
    expect(growthPoints(project,session,actor.id)).toEqual({earned:9,spent:5,available:4});
    expect(investSkillNode(project,session,actor.id,'test-tree','skill')).toMatch(/최대/);
    expect(growthPoints(project,session,actor.id).spent).toBe(5);
  });
  it('rejects insufficient points and unknown actors', () => {
    const {project,session,actor} = fixture(); project.growth!.initialPoints=0; project.growth!.pointsPerLevel=0;
    expect(investSkillNode(project,session,actor.id,'test-tree','root')).toMatch(/포인트/);
    expect(investSkillNode(project,session,'absent','test-tree','root')).toMatch(/직업/);
    expect(session.growthProgress).toBeUndefined();
  });
  it('preserves independent actor investments and event bonus variable budgets', () => {
    const {project,session,actor} = fixture(); project.variables.push({id:'growth-bonus',name:'보너스'}); project.growth!.bonusVariableId='growth-bonus'; session.variables['growth-bonus']=6;
    investSkillNode(project,session,actor.id,'test-tree','root');
    expect(growthPoints(project,session,actor.id)).toEqual({earned:15,spent:2,available:13});
    expect(growthPoints(project,session,project.database.actors[1]!.id).spent).toBe(0);
  });
  it('refunds historical spending after author changes node cost, including inactive trees', () => {
    const {project,session,actor,tree} = fixture(); investSkillNode(project,session,actor.id,tree.id,'root'); tree.nodes[0]!.cost=100;
    changeActorClass(session,project,actor.id,'growth-test-next');
    expect(activeSkillTrees(project,session,actor.id)).toHaveLength(0);
    expect(resetSkillTree(project,session,actor.id,tree.id)).toBeUndefined(); expect(growthPoints(project,session,actor.id).spent).toBe(0);
  });
  it('preserves investments across class changes, deactivating only class-specific effects', () => {
    const {project,session,actor,klass,tree} = fixture(); investSkillNode(project,session,actor.id,tree.id,'root');
    expect(growthEffects(project,session,actor.id).bonuses.defense).toBe(7);
    changeActorClass(session,project,actor.id,'growth-test-next'); expect(growthEffects(project,session,actor.id).bonuses.defense).toBe(0);
    changeActorClass(session,project,actor.id,klass.id); expect(growthEffects(project,session,actor.id).bonuses.defense).toBe(7);
    tree.classIds=[]; changeActorClass(session,project,actor.id,'growth-test-next'); expect(growthEffects(project,session,actor.id).bonuses.defense).toBe(7);
  });
  it('adds skills and passive stats to real battlers without polluting permanent actor skills or bonuses', () => {
    const {project,session,actor,tree} = fixture();
    const baseline = actorBattlers(project,{levels:session.actorLevels})[0]!;
    investSkillNode(project,session,actor.id,tree.id,'root'); investSkillNode(project,session,actor.id,tree.id,'skill');
    const battler=actorBattlers(project,{levels:session.actorLevels,growthProgress:session.growthProgress})[0]!;
    expect(battler.defense).toBe(baseline.defense+7); expect(battler.skillIds).toContain('growth-test-skill');
    expect(session.actorSkillIds[actor.id] ?? []).not.toContain('growth-test-skill');
    refreshActorBattlerDerivedStats(project,battler,{growthProgress:session.growthProgress,classOverrides:{[actor.id]:'growth-test-next'},skills:{sessionSkillIds:[]}});
    expect(battler.skillIds).not.toContain('growth-test-skill');
    expect(session.actorParamBonuses?.[actor.id]?.defense ?? 0).toBe(0);
  });
  it('keeps a separately learned skill after resetting the tree', () => {
    const {project,session,actor,tree} = fixture(); investSkillNode(project,session,actor.id,tree.id,'root'); investSkillNode(project,session,actor.id,tree.id,'skill');
    session.actorSkillIds[actor.id]=['growth-test-skill']; resetSkillTree(project,session,actor.id,tree.id);
    expect(actorBattlers(project,{skillIds:session.actorSkillIds,growthProgress:session.growthProgress})[0]!.skillIds).toContain('growth-test-skill');
  });
  it('recomputes HP maxima without healing and clamps on reset', () => {
    const {project,session,actor,tree}=fixture(); refreshGrowthVitals(project,session,actor.id); const original=session.actorVitals[actor.id]!;
    original.hp=10; const max=original.maxHp;
    investSkillNode(project,session,actor.id,tree.id,'root'); investSkillNode(project,session,actor.id,tree.id,'hp'); refreshGrowthVitals(project,session,actor.id);
    expect(session.actorVitals[actor.id]).toMatchObject({hp:10,maxHp:max+20});
    resetSkillTree(project,session,actor.id,tree.id); refreshGrowthVitals(project,session,actor.id); expect(session.actorVitals[actor.id]).toMatchObject({hp:10,maxHp:max});
  });
  it('round trips investments and skill points through actual save snapshots', () => {
    const {project,session,actor,tree}=fixture(); investSkillNode(project,session,actor.id,tree.id,'root');
    session.horror = {
      pursuits: { pursuer: { home: { mapId: project.startMapId, x: 1, y: 1 }, active: true, searchMs: 500, doors: [] } },
      hiding: { mapId: project.startMapId, eventId: 'hiding-place', witnessedBy: ['pursuer'] },
    };
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } as Storage;
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const saved = readSaveSlot(storage, 1);
    expect(saved.kind).toBe('present');
    if (saved.kind !== 'present') throw new Error('combined save missing');
    const restored = applySaveSnapshot(project, saved.snapshot);
    expect(restored.horror).toEqual(session.horror);
    expect(restored.growthProgress).toEqual(session.growthProgress); expect(growthPoints(project,restored,actor.id)).toEqual(growthPoints(project,session,actor.id));
  });
  it('rejects malformed save progress rather than accepting negative or infinite spending', () => {
    expect(isGrowthProgress({a:{t:{n:{rank:1,spent:-1}}}})).toBe(false); expect(isGrowthProgress({a:{t:{n:{rank:1,spent:Infinity}}}})).toBe(false);
  });
  it('offers functional runtime growth tabs and executes promotion conditions', () => {
    const {project,session,actor,klass}=fixture(); connectPromotion(project,klass.id,'growth-test-next',{level:4});
    expect(promoteActor(session,project,actor.id,'growth-test-next').ok).toBe(false); session.actorLevels[actor.id]=4;
    const detail=createStatusMenuDetail({project,session,selectedCommand:'skills',slots:[],waitModeEnabled:true,skillActorId:actor.id,growthTab:'promotion'});
    expect(detail.tabs).toHaveLength(3); expect(detail.entries[0]!.disabled).toBe(false);
    expect(promoteActor(session,project,actor.id,'growth-test-next').ok).toBe(true);
  });
});
