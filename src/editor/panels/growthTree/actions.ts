import type { Project, ClassPromotionRequirement } from '@/project/types';
import { emptyGrowth, type SkillTree, type SkillTreeNode, type TreePosition } from '@/project/growth/types';
import { promotionEdges, wouldCreateCycle } from '@/project/growth/graph';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';

export function editGrowth(label: string, mutate: (project: Project) => void): void {
  recordProjectSnapshot(label);
  store.update(mutate, { scope: 'project', label });
}
export function editTree(project: Project, id: string, mutate: (tree: SkillTree) => void): void {
  const tree = project.growth?.skillTrees.find(t => t.id === id);
  if (tree) mutate(tree);
}
export function editNode(project: Project, treeId: string, nodeId: string, mutate: (node: SkillTreeNode) => void): void {
  editTree(project, treeId, t => { const node = t.nodes.find(n => n.id === nodeId); if (node) mutate(node); });
}
export function connectPromotion(project: Project, from: string, to: string, requires?: ClassPromotionRequirement): string | undefined {
  const source = project.database.classes.find(c => c.id === from);
  if (!source || !project.database.classes.some(c => c.id === to)) return '직업을 선택하세요.';
  const edges = promotionEdges(project).filter(e => !(e.from === from && e.to === to));
  if (wouldCreateCycle(edges, from, to)) return '자기 자신이나 이전 직업으로 돌아가는 순환 경로는 연결할 수 없습니다.';
  const previous = source.promotions?.find(p => p.toClassId === to);
  source.promotions = [...(source.promotions ?? []).filter(p => p.toClassId !== to), { toClassId: to, requires: requires ?? previous?.requires ?? {} }];
  return undefined;
}
export function connectSkillNodes(tree: SkillTree, from: string, to: string): string | undefined {
  const node = tree.nodes.find(n => n.id === to);
  if (!node || !tree.nodes.some(n => n.id === from)) return '노드를 선택하세요.';
  const edges = tree.nodes.flatMap(n => n.prerequisites.map(p => ({ from: p, to: n.id })));
  if (wouldCreateCycle(edges, from, to)) return '순환 연결은 만들 수 없습니다.';
  node.prerequisites = [...new Set([...node.prerequisites, from])];
  return undefined;
}
export function deleteSkillNode(tree: SkillTree, id: string): void {
  tree.nodes = tree.nodes.filter(n => n.id !== id);
  for (const node of tree.nodes) node.prerequisites = node.prerequisites.filter(p => p !== id);
}
export function moveClass(project: Project, id: string, position: TreePosition): void {
  project.growth ??= emptyGrowth();
  project.growth.classPositions[id] = position;
}
