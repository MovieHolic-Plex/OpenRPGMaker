import type { Project, ClassPromotionRequirement } from '@/project/types';
import { assertNodeRequirements, nodeRequirementIssues, qualifiedNodeId } from '@/project/growth/requirements';
import { emptyGrowth, type NodeRankRequirement, type SkillTree, type SkillTreeNode, type TreePosition } from '@/project/growth/types';
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
export function connectSkillNodes(tree: SkillTree, from: string, to: string, project?: Project): string | undefined {
  const node = tree.nodes.find(n => n.id === to);
  if (!node || !tree.nodes.some(n => n.id === from)) return '노드를 선택하세요.';
  const edges = project ? qualifiedSkillEdges(project) : tree.nodes.flatMap(n => [...n.prerequisites.map(nodeId => ({treeId: tree.id, nodeId})), ...(n.requiredNodes ?? [])].map(r => ({from: qualifiedNodeId(r.treeId, r.nodeId), to: qualifiedNodeId(tree.id, n.id)})));
  if (wouldCreateCycle(edges, qualifiedNodeId(tree.id, from), qualifiedNodeId(tree.id, to))) return '순환 연결은 만들 수 없습니다.';
  node.prerequisites = [...new Set([...node.prerequisites, from])];
  return undefined;
}
export function deleteSkillNode(tree: SkillTree, id: string, project?: Project): string | undefined {
  const blocked = project && skillTreeDeletionBlocker(project, tree.id, id);
  if (blocked) return blocked;
  tree.nodes = tree.nodes.filter(n => n.id !== id);
  for (const node of tree.nodes) {
    node.prerequisites = node.prerequisites.filter(p => p !== id);
    if (node.requiredNodes) node.requiredNodes = node.requiredNodes.filter(r => r.treeId !== tree.id || r.nodeId !== id);
  }
  return undefined;
}
export function skillTreeDeletionBlocker(project: Project, treeId: string, nodeId?: string): string | undefined {
  const matches = (r: {treeId: string; nodeId: string}): boolean => r.treeId === treeId && (nodeId === undefined || r.nodeId === nodeId);
  const references = (project.growth?.skillTrees ?? []).filter(t => t.id !== treeId).flatMap(t => t.nodes.filter(n => n.requiredNodes?.some(matches)).map(n => `${t.name} / ${n.name}`));
  for (const klass of project.database.classes) for (const promotion of klass.promotions ?? []) {
    if (promotion.requires.requiredNodes?.some(matches) || (nodeId === undefined && promotion.requires.requiredTreePoints?.some(r => r.treeId === treeId))) references.push(`${klass.name} 승급`);
  }
  return references.length ? `먼저 외부 참조를 해제하세요: ${references.join(', ')}` : undefined;
}
export function deleteSkillTree(project: Project, treeId: string): string | undefined {
  const blocked = skillTreeDeletionBlocker(project, treeId);
  if (blocked) return blocked;
  if (project.growth) project.growth.skillTrees = project.growth.skillTrees.filter(t => t.id !== treeId);
  return undefined;
}
export function duplicateSkillTree(tree: SkillTree, id: string): SkillTree {
  const copy = structuredClone(tree);
  copy.id = id;
  copy.name += ' 복사';
  for (const node of copy.nodes) for (const requirement of node.requiredNodes ?? []) if (requirement.treeId === tree.id) requirement.treeId = id;
  return copy;
}
export function qualifiedSkillEdges(project: Project): {from: string; to: string}[] {
  return (project.growth?.skillTrees ?? []).flatMap(t => t.nodes.flatMap(n => [...n.prerequisites.map(nodeId => ({treeId:t.id,nodeId})), ...(n.requiredNodes ?? [])].map(r => ({from:qualifiedNodeId(r.treeId,r.nodeId),to:qualifiedNodeId(t.id,n.id)}))));
}
export function setSkillNodeRequirements(project: Project, treeId: string, nodeId: string, requirements: NodeRankRequirement[]): string | undefined {
  assertNodeRequirements(requirements);
  const node = project.growth?.skillTrees.find(t => t.id === treeId)?.nodes.find(n => n.id === nodeId);
  if (!node) return '노드를 선택하세요.';
  const issue = nodeRequirementIssues(project, requirements)[0];
  if (issue) return issue;
  const to = qualifiedNodeId(treeId, nodeId);
  const edges = qualifiedSkillEdges(project).filter(e => e.to !== to);
  for (const r of [...node.prerequisites.map(id => ({treeId,nodeId:id,rank:1})), ...requirements]) {
    const from = qualifiedNodeId(r.treeId, r.nodeId);
    if (wouldCreateCycle(edges, from, to)) return '순환 연결은 만들 수 없습니다.';
    edges.push({from,to});
  }
  node.requiredNodes = structuredClone(requirements);
  return undefined;
}
export function moveClass(project: Project, id: string, position: TreePosition): void {
  project.growth ??= emptyGrowth();
  project.growth.classPositions[id] = position;
}
