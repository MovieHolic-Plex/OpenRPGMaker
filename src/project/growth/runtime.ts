import type { ActorParameterKey, Project } from '@/project/types';
import type { GrowthProgress, SkillTree, SkillTreeNode } from './types';
import { GROWTH_PARAMETERS } from './types';
export interface GrowthSession {
  growthProgress?: GrowthProgress;
  actorLevels?: Record<string, number>;
  classOverrides?: Record<string, string>;
  variables: Record<string, number>;
}
export function activeSkillTrees(project: Project, session: GrowthSession, actorId: string): SkillTree[] {
  const actor = project.database.actors.find(a => a.id === actorId);
  if (!actor) return [];
  const override = session.classOverrides?.[actorId];
  const classId = override && project.database.classes.some(c => c.id === override) ? override : actor.classId;
  return (project.growth?.skillTrees ?? []).filter(t => !t.classIds.length || t.classIds.includes(classId));
}
export function growthPoints(project: Project, session: GrowthSession, actorId: string): { earned: number; spent: number; available: number } {
  const g = project.growth;
  const level = session.actorLevels?.[actorId] ?? project.database.actors.find(a => a.id === actorId)?.initialLevel ?? 1;
  const earned = g ? g.initialPoints + Math.max(0, level - 1) * g.pointsPerLevel + Math.max(0, Math.trunc(session.variables[g.bonusVariableId ?? ''] ?? 0)) : 0;
  // Removed authored trees/nodes implicitly refund their old investments.
  const spent = (g?.skillTrees ?? []).reduce((sum, tree) => sum + tree.nodes.reduce((s, n) => s + (session.growthProgress?.[actorId]?.[tree.id]?.[n.id]?.spent ?? 0), 0), 0);
  return { earned, spent, available: Math.max(0, earned - spent) };
}
export function nodeRank(session: GrowthSession, actorId: string, treeId: string, nodeId: string): number {
  return session.growthProgress?.[actorId]?.[treeId]?.[nodeId]?.rank ?? 0;
}
export function skillNodeBlocker(project: Project, session: GrowthSession, actorId: string, tree: SkillTree, node: SkillTreeNode): string | undefined {
  if (!activeSkillTrees(project, session, actorId).some(t => t.id === tree.id)) return '현재 직업에서 사용할 수 없는 트리입니다.';
  if (nodeRank(session, actorId, tree.id, node.id) >= node.maxRank) return '최대 등급입니다.';
  const level = session.actorLevels?.[actorId] ?? project.database.actors.find(a => a.id === actorId)?.initialLevel ?? 1;
  if (level < node.level) return `레벨 ${node.level}이 필요합니다.`;
  if (node.prerequisites.some(id => nodeRank(session, actorId, tree.id, id) < 1)) return '선행 노드를 먼저 습득하세요.';
  if (node.effect.kind === 'skill' && !project.database.skills.some(s => s.id === (node.effect as {skillId: string}).skillId)) return '연결된 스킬이 없습니다.';
  if (growthPoints(project, session, actorId).available < node.cost) return `${node.cost} 포인트가 필요합니다.`;
  return undefined;
}
export function investSkillNode(project: Project, session: GrowthSession, actorId: string, treeId: string, nodeId: string): string | undefined {
  const tree = project.growth?.skillTrees.find(t => t.id === treeId), node = tree?.nodes.find(n => n.id === nodeId);
  if (!tree || !node) return '노드를 찾을 수 없습니다.';
  const blocked = skillNodeBlocker(project, session, actorId, tree, node);
  if (blocked) return blocked;
  session.growthProgress ??= {};
  const actor = session.growthProgress[actorId] ??= {};
  const nodes = actor[treeId] ??= {};
  const before = nodes[nodeId] ?? { rank: 0, spent: 0 };
  nodes[nodeId] = { rank: before.rank + 1, spent: before.spent + node.cost };
  return undefined;
}
export function resetSkillTree(project: Project, session: GrowthSession, actorId: string, treeId: string): string | undefined {
  if (!project.growth?.skillTrees.find(t => t.id === treeId)?.allowReset) return '초기화가 허용되지 않은 트리입니다.';
  if (session.growthProgress?.[actorId]) delete session.growthProgress[actorId][treeId];
  return undefined;
}
export function growthEffects(project: Project, session: GrowthSession, actorId: string): { skillIds: string[]; bonuses: Record<ActorParameterKey, number> } {
  const skills = new Set<string>();
  const bonuses = Object.fromEntries(GROWTH_PARAMETERS.map(k => [k, 0])) as Record<ActorParameterKey, number>;
  for (const tree of activeSkillTrees(project, session, actorId)) for (const node of tree.nodes) {
    const rank = Math.min(node.maxRank, nodeRank(session, actorId, tree.id, node.id));
    if (!rank) continue;
    if (node.effect.kind === 'skill') skills.add(node.effect.skillId);
    else bonuses[node.effect.parameter] += rank * node.effect.amount;
  }
  return { skillIds: [...skills], bonuses };
}
