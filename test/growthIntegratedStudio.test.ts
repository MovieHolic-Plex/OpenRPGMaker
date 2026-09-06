// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { emptyGrowth, type SkillTree } from '@/project/growth/types';
import { renderGrowthTreeTab } from '@/editor/panels/growthTree/studio';
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from '@/editor/mapEditHistory';
import { deleteSkillNode, deleteSkillTree, duplicateSkillTree, setSkillNodeRequirements } from '@/editor/panels/growthTree/actions';

function fixture() {
  const project = createBlankProject();
  const actor = project.database.actors[0], klass = project.database.classes.find(c => c.id === actor?.classId);
  if (!actor || !klass) throw new Error('fixture missing');
  const next = {...structuredClone(klass),id:'next',name:'next'}; project.database.classes.push(next);
  klass.promotions = [{toClassId:'next',requires:{}}];
  const trees: SkillTree[] = ['base','next'].map(id => ({id,name:id,description:'',classIds:[id === 'base' ? klass.id : next.id],inheritOnPromotion:true,allowReset:true,nodes:[{id:'root',name:'root',description:'',x:0,y:0,cost:1,maxRank:3,level:1,prerequisites:[],effect:{kind:'parameter',parameter:'defense',amount:5}}]}));
  project.growth = {...emptyGrowth(),initialPoints:10,skillTrees:trees};
  return {project,actor,klass,trees};
}
function surface(mode: 'promotion' | 'skill') {
  const data = fixture(); store.replace(data.project); resetMapEditHistory();
  const host = document.createElement('div'); document.body.append(host); renderGrowthTreeTab(host,mode);
  const click = (id:string) => { const button = host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`); if (!button) throw new Error(`missing ${id}`); button.click(); };
  const change = (id:string,value:string) => { const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`); if (!input) throw new Error(`missing ${id}`); input.value=value; input.dispatchEvent(new Event('change',{bubbles:true})); };
  return {...data,host,click,change};
}
afterEach(() => {resetMapEditHistory();document.body.replaceChildren();});

it('blocks externally referenced node/tree deletion, but remaps self references on duplicate', () => {
  const {project,trees,klass} = fixture(); const base=trees[0],next=trees[1]; if (!base || !next?.nodes[0]) throw new Error('tree missing');
  next.nodes[0].requiredNodes=[{treeId:'base',nodeId:'root',rank:2}];
  const before=structuredClone(project);
  expect(deleteSkillNode(base,'root',project)).toBeTypeOf('string'); expect(project).toEqual(before);
  expect(deleteSkillTree(project,'base')).toBeTypeOf('string'); expect(project).toEqual(before);
  next.nodes[0].requiredNodes=[];
  klass.promotions=[{toClassId:'next',requires:{requiredTreePoints:[{treeId:'base',points:1}]}}];
  expect(deleteSkillTree(project,'base')).toBeTypeOf('string');
  base.nodes.push({...structuredClone(next.nodes[0]),id:'child',requiredNodes:[{treeId:'base',nodeId:'root',rank:2},{treeId:'next',nodeId:'root',rank:1}]});
  const copy=duplicateSkillTree(base,'copy');
  expect(copy.nodes[1]?.requiredNodes).toEqual([{treeId:'copy',nodeId:'root',rank:2},{treeId:'next',nodeId:'root',rank:1}]);
  expect(base.nodes[1]?.requiredNodes?.[0]?.treeId).toBe('base');
});
it('blocks qualified cycles before mutation', () => {
  const {project}=fixture();
  expect(setSkillNodeRequirements(project,'next','root',[{treeId:'base',nodeId:'root',rank:2}])).toBeUndefined();
  const before=structuredClone(project);
  expect(setSkillNodeRequirements(project,'base','root',[{treeId:'next',nodeId:'root',rank:1}])).toBeTypeOf('string');
  expect(project).toEqual(before);
});
it('authors inheritance and qualified prerequisite tree/node/rank with undo', () => {
  const {host,click,change}=surface('skill');
  const checkbox=host.querySelector<HTMLInputElement>('[data-testid="growth-tree-inherit"]'); if (!checkbox) throw new Error('inherit control missing');
  checkbox.checked=false; checkbox.dispatchEvent(new Event('change',{bubbles:true}));
  expect(store.getCurrent().growth?.skillTrees[0]?.inheritOnPromotion).toBe(false);
  click('growth-required-add'); change('growth-required-0-tree','next'); change('growth-required-0-rank','2');
  expect(store.getCurrent().growth?.skillTrees[0]?.nodes[0]?.requiredNodes).toEqual([{treeId:'next',nodeId:'root',rank:2}]);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent().growth?.skillTrees[0]?.nodes[0]?.requiredNodes?.[0]?.rank).toBe(1);
});
it('authors promotion skill/rank/point gates through native controls', () => {
  const {click,change,klass}=surface('promotion'); click(`growth-list-${klass.id}`);
  click('growth-promotion-next-skills-add'); click('growth-promotion-next-nodes-add'); click('growth-promotion-next-points-add');
  change('growth-promotion-next-nodes-0-rank','2'); change('growth-promotion-next-points-0-points','3');
  const requires=store.getCurrent().database.classes.find(c=>c.id===klass.id)?.promotions?.[0]?.requires;
  expect(requires?.requiredSkillIds).toHaveLength(1); expect(requires?.requiredNodes).toEqual([{treeId:'base',nodeId:'root',rank:2}]); expect(requires?.requiredTreePoints).toEqual([{treeId:'base',points:3}]);
});
it('navigates from a class to its selected tree without authoring writes', () => {
  const {host,click,klass}=surface('promotion'); const before=structuredClone(store.getCurrent());
  click(`growth-list-${klass.id}`); click('growth-open-tree-base');
  expect(host.querySelector('[data-testid="growth-studio-skill"]')).not.toBeNull();
  expect(host.querySelector<HTMLInputElement>('[data-testid="growth-tree-name"]')?.value).toBe('base');
  expect(store.getCurrent()).toEqual(before); expect(getMapEditHistoryEntries()).toHaveLength(0);
});
it('creates new authored trees with inheritance enabled', () => {
  const {click}=surface('skill'); click('growth-add-tree');
  expect(store.getCurrent().growth?.skillTrees.at(-1)?.inheritOnPromotion).toBe(true);
});
it('simulates actual promotions and arbitrary reclass without authored writes', () => {
  const {host,click,change,klass}=surface('skill'); const before=structuredClone(store.getCurrent());
  click('growth-preview-toggle'); click('growth-preview-learn'); click('growth-preview-promote-next');
  expect(host.querySelector<HTMLButtonElement>('[data-testid="growth-preview-learn"]')?.disabled).toBe(false);
  change('growth-preview-class',klass.id); change('growth-preview-class','next');
  expect(host.querySelector<HTMLButtonElement>('[data-testid="growth-preview-learn"]')?.disabled).toBe(true);
  expect(store.getCurrent()).toEqual(before); expect(getMapEditHistoryEntries()).toHaveLength(0);
});
