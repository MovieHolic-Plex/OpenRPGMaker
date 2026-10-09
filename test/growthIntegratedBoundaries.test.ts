import { expect, it } from 'vitest';
import { integratedGrowthFixture as fixture } from './fixtures/growthIntegrated';
import { changeActorClass, promoteActor, promotionRequirementsMet } from '@/project/sessionClass';
import { actorOwnedSkillIds, activeSkillTrees, investSkillNode, resetSkillTree } from '@/project/growth/runtime';
import { actorBattlers } from '@/battle/battleBattlers';
import { createBattleRuntime } from '@/battle/runtime';
import { refreshGrowthVitals } from '@/project/growth/vitals';
import { assertGrowthShape, growthIssues } from '@/project/growth/validation';
import { transitionActorEquipment } from '@/project/equipmentRules';
import { normalizeClassRecord } from '@/project/databaseRecordModel';
import { createSaveSnapshot, readSaveSlot } from '@/player/saveSlots';

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
