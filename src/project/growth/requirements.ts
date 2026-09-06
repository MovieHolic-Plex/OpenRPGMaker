import type { ClassPromotionRequirement, Project } from '@/project/types';
import type { NodeRankRequirement, PromotionLineage } from './types';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const integer = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
export function assertNodeRequirements(value: unknown): asserts value is NodeRankRequirement[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every(r => object(r) && id(r.treeId) && id(r.nodeId) && integer(r.rank, 1, 99))) throw new Error('성장 트리: 선행 트리·노드·등급 형식이 올바르지 않습니다.');
}
export function assertPromotionExtensions(requires: unknown): void {
  if (!object(requires)) return;
  assertNodeRequirements(requires.requiredNodes);
  if (requires.requiredSkillIds !== undefined && (!Array.isArray(requires.requiredSkillIds) || !requires.requiredSkillIds.every(id))) throw new Error('승급: 필요 스킬 목록이 올바르지 않습니다.');
  if (requires.requiredTreePoints !== undefined && (!Array.isArray(requires.requiredTreePoints) || !requires.requiredTreePoints.every(r => object(r) && id(r.treeId) && integer(r.points, 1, 999999)))) throw new Error('승급: 필요 트리 포인트 형식이 올바르지 않습니다.');
}
export function nodeRequirementIssues(project: Project, requirements: readonly NodeRankRequirement[]): string[] {
  return requirements.flatMap(r => {
    const node = project.growth?.skillTrees.find(t => t.id === r.treeId)?.nodes.find(n => n.id === r.nodeId);
    return !node ? [`선행 노드가 없습니다 (${r.treeId} / ${r.nodeId}).`] : r.rank > node.maxRank ? [`선행 등급이 최대 등급을 초과합니다 (${r.treeId} / ${r.nodeId}).`] : [];
  });
}
export function promotionExtensionIssues(project: Project, requires: ClassPromotionRequirement): string[] {
  return [
    ...nodeRequirementIssues(project, requires.requiredNodes ?? []),
    ...(requires.requiredSkillIds ?? []).filter(id => !project.database.skills.some(s => s.id === id)).map(id => `필요 스킬이 없습니다 (${id}).`),
    ...(requires.requiredTreePoints ?? []).filter(r => !project.growth?.skillTrees.some(t => t.id === r.treeId)).map(r => `필요 트리가 없습니다 (${r.treeId}).`),
  ];
}
export function isPromotionLineage(value: unknown): value is PromotionLineage {
  return object(value) && Object.entries(value).every(([actorId, classes]) => id(actorId) && Array.isArray(classes) && classes.length > 0 && classes.every(id) && new Set(classes).size === classes.length);
}
export const qualifiedNodeId = (treeId: string, nodeId: string): string => JSON.stringify([treeId, nodeId]);
