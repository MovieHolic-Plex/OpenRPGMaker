import { actorOwnedSkillIds, permanentActorSkillIds, nodeRequirementsBlocker, treeSpentPoints } from '@/project/growth/runtime';
import { effectiveActorClassId, effectivePromotionLineage } from '@/project/growth/lineage';
export { effectiveActorClassId } from '@/project/growth/lineage';
import { refreshGrowthVitals } from "@/project/growth/vitals";
import { clampLevel } from "@/project/actorModel";
import type { ActorId, ActorParameterKey, ClassId, ClassPromotion, ClassPromotionRequirement, Project, SkillId } from "@/project/types";
import type { ActorVitals } from "@/project/sessionVitals";
import { transitionItemState } from "@/project/itemTransitions";

export interface ClassOverrideSession {
  growthProgress?: import("@/project/growth/types").GrowthProgress;
  promotionLineage?: import("@/project/growth/types").PromotionLineage;
  classOverrides?: Record<string, string>;
  actorLevels?: Record<string, number>;
  actorSkillIds?: Record<string, SkillId[]>;
  actorVitals: Record<string, ActorVitals>;
  actorParamBonuses?: Record<string, Partial<Record<ActorParameterKey, number>>>;
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  itemUseCharges?: Record<string, number>;
}

export type ClassChangeResult =
  | { readonly ok: true; readonly actorId: ActorId; readonly classId: ClassId }
  | { readonly ok: false; readonly actorId: ActorId; readonly reason: string };

export function hasActorClassOverride(
  session: Pick<ClassOverrideSession, "classOverrides"> | undefined,
  actorId: ActorId
): boolean {
  return Boolean(session?.classOverrides && Object.prototype.hasOwnProperty.call(session.classOverrides, actorId));
}

export function changeActorClass(
  session: ClassOverrideSession,
  project: Project,
  actorId: ActorId,
  classId: ClassId
): ClassChangeResult {
  if (!project.database.actors.some((record) => record.id === actorId)) return { ok: false, actorId, reason: "actor-not-found" };
  const klass = project.database.classes.find((record) => record.id === classId);
  if (!klass) return { ok: false, actorId, reason: "class-not-found" };
  const source = effectiveActorClassId(project, session, actorId);
  const lineage = source === classId ? effectivePromotionLineage(project, session, actorId) : [classId];
  applyClassChange(session, project, actorId, classId, lineage);
  return { ok: true, actorId, classId };
}

export function promoteActor(
  session: ClassOverrideSession,
  project: Project,
  actorId: ActorId,
  toClassId?: ClassId
): ClassChangeResult {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) return { ok: false, actorId, reason: "actor-not-found" };
  const currentClassId = effectiveActorClassId(project, session, actorId);
  const currentClass = project.database.classes.find((record) => record.id === currentClassId);
  if (!currentClass) return { ok: false, actorId, reason: "class-not-found" };
  const candidates = (currentClass.promotions ?? []).filter((promotion) => !toClassId || promotion.toClassId === toClassId);
  const promotion = candidates.find((entry) => promotionRequirementsMet(session, actorId, entry.requires, project));
  if (!promotion) return { ok: false, actorId, reason: toClassId ? "requirements-not-met" : "promotion-not-available" };
  if (!project.database.classes.some((record) => record.id === promotion.toClassId)) {
    return { ok: false, actorId, reason: "class-not-found" };
  }
  const itemTransition = promotion.requires.itemId
    ? transitionItemState(session, project.database.items, { kind: "remove", itemId: promotion.requires.itemId, amount: 1 })
    : undefined;
  const lineage = [...new Set([...effectivePromotionLineage(project, session, actorId), currentClass.id, promotion.toClassId])];
  applyClassChange(session, project, actorId, promotion.toClassId, lineage);
  if (itemTransition) {
    session.inventory = itemTransition.inventory;
    session.itemUseCharges = itemTransition.itemUseCharges;
  }
  return { ok: true, actorId, classId: promotion.toClassId };
}

function applyClassChange(session: ClassOverrideSession, project: Project, actorId: ActorId, classId: ClassId, lineage: ClassId[]): void {
  session.actorSkillIds ??= {};
  session.actorSkillIds[actorId] = permanentActorSkillIds(project, session, actorId);
  session.classOverrides ??= {};
  session.classOverrides[actorId] = classId;
  session.promotionLineage ??= {};
  session.promotionLineage[actorId] = lineage;
  learnClassSkillsUpToLevel(session, project, actorId, classId);
  refreshGrowthVitals(project, session, actorId);
}

export function promotionRequirementsMet(
  session: PromotionSession,
  actorId: ActorId,
  requires: ClassPromotionRequirement,
  project?: Project
): boolean {
  return promotionRequirementBlocker(session, actorId, requires, project) === undefined;
}
type PromotionSession = Pick<ClassOverrideSession, 'actorLevels' | 'switches' | 'variables' | 'inventory' | 'classOverrides' | 'promotionLineage' | 'growthProgress' | 'actorSkillIds'>;
export function promotionRequirementBlocker(session: PromotionSession, actorId: ActorId, requires: ClassPromotionRequirement, project?: Project): string | undefined {
  if (requires.level !== undefined && (session.actorLevels?.[actorId] ?? project?.database.actors.find(a => a.id === actorId)?.initialLevel ?? 1) < requires.level) return `레벨 ${requires.level}이 필요합니다.`;
  if (requires.switchId && session.switches[requires.switchId] !== true) return `스위치 ${requires.switchId}가 켜져야 합니다.`;
  if (requires.itemId && (session.inventory[requires.itemId] ?? 0) <= 0) return `아이템 ${requires.itemId} 1개가 필요합니다.`;
  if (requires.variableId && (session.variables[requires.variableId] ?? 0) < (requires.atLeast ?? 1)) return `변수 ${requires.variableId}: ${requires.atLeast ?? 1} 이상이 필요합니다.`;
  if (!project) return requires.requiredSkillIds?.length || requires.requiredNodes?.length || requires.requiredTreePoints?.length ? '성장 조건을 확인할 프로젝트가 필요합니다.' : undefined;
  const owned = actorOwnedSkillIds(project, session, actorId);
  const missingSkill = requires.requiredSkillIds?.find(id => !owned.includes(id));
  if (missingSkill) return `스킬 ${project.database.skills.find(s => s.id === missingSkill)?.name ?? missingSkill}이 필요합니다.`;
  const nodeBlocker = nodeRequirementsBlocker(project, session, actorId, requires.requiredNodes ?? []);
  if (nodeBlocker) return nodeBlocker;
  for (const requirement of requires.requiredTreePoints ?? []) {
    if (treeSpentPoints(project, session, actorId, requirement.treeId) < requirement.points) return `${project.growth?.skillTrees.find(t => t.id === requirement.treeId)?.name ?? requirement.treeId}: ${requirement.points} 포인트 투자가 필요합니다.`;
  }
  return undefined;
}

export function classLearnedSkillIdsUpToLevel(project: Project, classId: ClassId, level: number): SkillId[] {
  const klass = project.database.classes.find((record) => record.id === classId);
  if (!klass) return [];
  const clampedLevel = clampLevel(level);
  return klass.learnedSkills
    .filter((entry) => entry.level <= clampedLevel)
    .map((entry) => entry.skillId);
}

export function classPromotionLabel(project: Project, promotion: ClassPromotion): string {
  const targetName = project.database.classes.find((record) => record.id === promotion.toClassId)?.name ?? promotion.toClassId;
  const parts: string[] = [];
  if (promotion.requires.level !== undefined) parts.push(`Lv.${promotion.requires.level}`);
  if (promotion.requires.switchId) parts.push(`스위치 ${promotion.requires.switchId}`);
  if (promotion.requires.itemId) parts.push(`아이템 ${promotion.requires.itemId}`);
  if (promotion.requires.variableId) parts.push(`변수 ${promotion.requires.variableId}>=${promotion.requires.atLeast ?? 1}`);
  return parts.length > 0 ? `${targetName} (${parts.join(", ")})` : targetName;
}

function learnClassSkillsUpToLevel(session: ClassOverrideSession, project: Project, actorId: ActorId, classId: ClassId): void {
  const level = clampLevel(session.actorLevels?.[actorId] ?? project.database.actors.find((record) => record.id === actorId)?.initialLevel ?? 1);
  const known = new Set<SkillId>(session.actorSkillIds?.[actorId] ?? []);
  for (const skillId of classLearnedSkillIdsUpToLevel(project, classId, level)) known.add(skillId);
  session.actorSkillIds ??= {};
  session.actorSkillIds[actorId] = [...known];
}
