import type { ActorParameterKey, Project } from '@/project/types';
import { normalizeActorRecord } from '@/project/actorModel';
import { effectiveActorClassId, effectivePromotionLineage } from './lineage';
import type { NodeRankRequirement, PromotionLineage } from './types';
import type { GrowthProgress, SkillTree, SkillTreeNode } from './types';
import { GROWTH_PARAMETERS } from './types';
export interface GrowthSession {
  growthProgress?: GrowthProgress;
  promotionLineage?: PromotionLineage;
  actorSkillIds?: Record<string, readonly string[]>;
  actorLevels?: Record<string, number>;
  classOverrides?: Record<string, string>;
  variables: Record<string, number>;
}
export function activeSkillTrees(project: Project, session: GrowthSession, actorId: string): SkillTree[] {
  const actor = project.database.actors.find(a => a.id === actorId);
  if (!actor) return [];
  const classId = effectiveActorClassId(project, session, actorId);
  const lineage = effectivePromotionLineage(project, session, actorId);
  return (project.growth?.skillTrees ?? []).filter(t => !t.classIds.length || t.classIds.some(id => t.inheritOnPromotion ? lineage.includes(id) : id === classId));
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
export function retainedNodeRank(project: Project, session: GrowthSession, actorId: string, treeId: string, nodeId: string): number {
  const node = project.growth?.skillTrees.find(t => t.id === treeId)?.nodes.find(n => n.id === nodeId);
  return node ? Math.min(node.maxRank, nodeRank(session, actorId, treeId, nodeId)) : 0;
}
export function treeSpentPoints(project: Project, session: GrowthSession, actorId: string, treeId: string): number {
  return project.growth?.skillTrees.find(t => t.id === treeId)?.nodes.reduce((sum, node) => sum + (session.growthProgress?.[actorId]?.[treeId]?.[node.id]?.spent ?? 0), 0) ?? 0;
}
export function nodeRequirementsBlocker(project: Project, session: GrowthSession, actorId: string, requirements: readonly NodeRankRequirement[]): string | undefined {
  for (const requirement of requirements) {
    if (retainedNodeRank(project, session, actorId, requirement.treeId, requirement.nodeId) >= requirement.rank) continue;
    const tree = project.growth?.skillTrees.find(t => t.id === requirement.treeId);
    const node = tree?.nodes.find(n => n.id === requirement.nodeId);
    return `선행: ${tree?.name ?? requirement.treeId} / ${node?.name ?? requirement.nodeId} ${requirement.rank}등급이 필요합니다.`;
  }
  return undefined;
}
export function skillTreeResetBlocker(project: Project, session: GrowthSession, actorId: string, treeId: string): string | undefined {
  if (!project.growth?.skillTrees.find(t => t.id === treeId)?.allowReset) return '초기화가 허용되지 않은 트리입니다.';
  const dependants = project.growth.skillTrees.filter(t => t.id !== treeId).flatMap(t => t.nodes.filter(n =>
    nodeRank(session, actorId, t.id, n.id) > 0 && n.requiredNodes?.some(r => r.treeId === treeId)
  ).map(n => `${t.name} / ${n.name}`));
  return dependants.length ? `먼저 의존 노드를 초기화하세요: ${dependants.join(', ')}` : undefined;
}
/** Permanent and currently eligible automatic skills, excluding reversible tree effects. */
export function permanentActorSkillIds(project: Project, session: GrowthSession, actorId: string): string[] {
  const record = project.database.actors.find(a => a.id === actorId);
  if (!record) return [];
  const actor = normalizeActorRecord(record);
  const level = session.actorLevels?.[actorId] ?? actor.initialLevel;
  const klass = project.database.classes.find(c => c.id === effectiveActorClassId(project, session, actorId));
  return [...new Set([...(session.actorSkillIds?.[actorId] ?? []), ...actor.learnedSkills.filter(s => s.tp === undefined && s.level <= level).map(s => s.skillId), ...(klass?.learnedSkills ?? []).filter(s => s.level <= level).map(s => s.skillId)])];
}
export function actorOwnedSkillIds(project: Project, session: GrowthSession, actorId: string): string[] {
  return [...new Set([...permanentActorSkillIds(project, session, actorId), ...growthEffects(project, session, actorId).skillIds])];
}
export function skillNodeBlocker(project: Project, session: GrowthSession, actorId: string, tree: SkillTree, node: SkillTreeNode): string | undefined {
  if (!activeSkillTrees(project, session, actorId).some(t => t.id === tree.id)) return '현재 직업에서 사용할 수 없는 트리입니다.';
  if (nodeRank(session, actorId, tree.id, node.id) >= node.maxRank) return '최대 등급입니다.';
  const level = session.actorLevels?.[actorId] ?? project.database.actors.find(a => a.id === actorId)?.initialLevel ?? 1;
  if (level < node.level) return `레벨 ${node.level}이 필요합니다.`;
  if (node.prerequisites.some(id => retainedNodeRank(project, session, actorId, tree.id, id) < 1)) return '선행 노드를 먼저 습득하세요.';
  const required = nodeRequirementsBlocker(project, session, actorId, node.requiredNodes ?? []);
  if (required) return required;
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
  const blocked = skillTreeResetBlocker(project, session, actorId, treeId);
  if (blocked) return blocked;
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
