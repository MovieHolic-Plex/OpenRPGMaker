import type { ClassPromotionRequirement, Project } from '@/project/types';
import type { NodeRankRequirement } from '@/project/growth/types';
import { button, note, numberInput, section, selectInput } from './controls';

/** Native controls shared by node prerequisites and promotion admission gates. */
export function nodeRequirementControls(project: Project, prefix: string, requirements: readonly NodeRankRequirement[], save: (requirements: NodeRankRequirement[]) => void, exclude?: {treeId: string; nodeId: string}): HTMLElement[] {
  const trees = (project.growth?.skillTrees ?? []).map(t => ({...t, nodes:t.nodes.filter(n => exclude?.treeId !== t.id || exclude.nodeId !== n.id)})).filter(t => t.nodes.length);
  const rows = requirements.map((r, index) => {
    const tree = trees.find(t => t.id === r.treeId);
    const node = tree?.nodes.find(n => n.id === r.nodeId);
    const update = (next: NodeRankRequirement): void => save(requirements.map((old,i) => i === index ? next : {...old}));
    return section(`선행 조건 ${index + 1}`, [
      selectInput('선행 트리', `${prefix}-${index}-tree`, r.treeId, trees, treeId => {
        const first = trees.find(t => t.id === treeId)?.nodes[0];
        if (first) update({treeId,nodeId:first.id,rank:1});
      }),
      selectInput('선행 노드', `${prefix}-${index}-node`, r.nodeId, tree?.nodes ?? [], nodeId => update({...r,nodeId,rank:1})),
      numberInput('필요 등급', `${prefix}-${index}-rank`, r.rank, rank => update({...r,rank}), 1, node?.maxRank ?? 99),
      button('조건 삭제', `${prefix}-${index}-remove`, () => save(requirements.filter((_,i) => i !== index).map(r => ({...r})))),
    ]);
  });
  const add = button('선행 트리·노드 추가', `${prefix}-add`, () => {
    const tree = trees[0], node = tree?.nodes[0];
    if (tree && node) save([...requirements.map(r => ({...r})), {treeId:tree.id,nodeId:node.id,rank:1}]);
  });
  add.disabled = trees.length === 0;
  return [...rows, add, ...(trees.length ? [] : [note('연결할 다른 노드를 먼저 만드세요.')])];
}
export function promotionRequirementControls(project: Project, prefix: string, requires: ClassPromotionRequirement, save: (patch: Partial<ClassPromotionRequirement>) => void): HTMLElement[] {
  const skills = requires.requiredSkillIds ?? [];
  const points = requires.requiredTreePoints ?? [];
  const trees = project.growth?.skillTrees ?? [];
  const addSkill = button('필요 스킬 추가', `${prefix}-skills-add`, () => {
    const skill = project.database.skills[0]; if (skill) save({requiredSkillIds:[...skills,skill.id]});
  });
  addSkill.disabled = !project.database.skills.length;
  const addPoints = button('필요 투자 포인트 추가', `${prefix}-points-add`, () => {
    const tree = trees[0]; if (tree) save({requiredTreePoints:[...points,{treeId:tree.id,points:1}]});
  });
  addPoints.disabled = !trees.length;
  return [
    section('보유 스킬 · 소비하지 않음', [
      ...skills.flatMap((id,index) => [selectInput('필요 스킬', `${prefix}-skills-${index}`, id, project.database.skills, skillId => save({requiredSkillIds:skills.map((old,i) => i === index ? skillId : old)})), button('조건 삭제', `${prefix}-skills-${index}-remove`, () => save({requiredSkillIds:skills.filter((_,i) => i !== index)}))]), addSkill,
    ]),
    section('노드 등급 · 비활성 투자도 인정', nodeRequirementControls(project, `${prefix}-nodes`, requires.requiredNodes ?? [], requiredNodes => save({requiredNodes}))),
    section('트리 투자 포인트 · 실제 지불액', [
      ...points.map((r,index) => section(`포인트 조건 ${index + 1}`, [
        selectInput('투자 트리', `${prefix}-points-${index}-tree`, r.treeId, trees, treeId => save({requiredTreePoints:points.map((old,i) => i === index ? {...r,treeId} : {...old})})),
        numberInput('필요 투자 포인트', `${prefix}-points-${index}-points`, r.points, value => save({requiredTreePoints:points.map((old,i) => i === index ? {...r,points:value} : {...old})}), 1, 999999),
        button('조건 삭제', `${prefix}-points-${index}-remove`, () => save({requiredTreePoints:points.filter((_,i) => i !== index)})),
      ])), addPoints,
    ]),
  ];
}
