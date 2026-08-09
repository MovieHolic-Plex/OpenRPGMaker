import { clampLevel, parameterValueAtLevel } from "@/project/actorModel";
import type { ActorId, ActorParameterKey, ClassId, ClassPromotion, ClassPromotionRequirement, Project, SkillId } from "@/project/types";
import type { ActorVitals } from "@/project/sessionVitals";
import { transitionItemState } from "@/project/itemTransitions";

export interface ClassOverrideSession {
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

export function effectiveActorClassId(
  project: Project,
  session: Pick<ClassOverrideSession, "classOverrides"> | undefined,
  actorId: ActorId
): ClassId | undefined {
  const override = session?.classOverrides?.[actorId];
  if (override && project.database.classes.some((record) => record.id === override)) return override;
  return project.database.actors.find((record) => record.id === actorId)?.classId;
}

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
  session.classOverrides ??= {};
  session.classOverrides[actorId] = classId;
  learnClassSkillsUpToLevel(session, project, actorId, classId);
  clampActorVitalsToEffectiveClass(session, project, actorId);
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
  const promotion = candidates.find((entry) => promotionRequirementsMet(session, actorId, entry.requires));
  if (!promotion) return { ok: false, actorId, reason: toClassId ? "requirements-not-met" : "promotion-not-available" };
  if (!project.database.classes.some((record) => record.id === promotion.toClassId)) {
    return { ok: false, actorId, reason: "class-not-found" };
  }
  const itemTransition = promotion.requires.itemId
    ? transitionItemState(session, project.database.items, { kind: "remove", itemId: promotion.requires.itemId, amount: 1 })
    : undefined;
  const result = changeActorClass(session, project, actorId, promotion.toClassId);
  if (result.ok && itemTransition) {
    session.inventory = itemTransition.inventory;
    session.itemUseCharges = itemTransition.itemUseCharges;
  }
  return result;
}

export function promotionRequirementsMet(
  session: Pick<ClassOverrideSession, "actorLevels" | "switches" | "variables" | "inventory">,
  actorId: ActorId,
  requires: ClassPromotionRequirement
): boolean {
  if (requires.level !== undefined && (session.actorLevels?.[actorId] ?? 1) < requires.level) return false;
  if (requires.switchId && session.switches[requires.switchId] !== true) return false;
  if (requires.itemId && (session.inventory[requires.itemId] ?? 0) <= 0) return false;
  if (requires.variableId && (session.variables[requires.variableId] ?? 0) < (requires.atLeast ?? 1)) return false;
  return true;
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

function clampActorVitalsToEffectiveClass(session: ClassOverrideSession, project: Project, actorId: ActorId): void {
  const vitals = session.actorVitals[actorId];
  const level = clampLevel(session.actorLevels?.[actorId] ?? project.database.actors.find((record) => record.id === actorId)?.initialLevel ?? 1);
  const nextMax = classVitalsAtLevel(project, session, actorId, level);
  if (!nextMax) return;
  if (!vitals) {
    session.actorVitals[actorId] = { hp: nextMax.maxHp, mp: nextMax.maxMp, maxHp: nextMax.maxHp, maxMp: nextMax.maxMp };
    return;
  }
  session.actorVitals[actorId] = {
    maxHp: nextMax.maxHp,
    maxMp: nextMax.maxMp,
    hp: Math.max(0, Math.min(vitals.hp, nextMax.maxHp)),
    mp: Math.max(0, Math.min(vitals.mp, nextMax.maxMp)),
  };
}

function classVitalsAtLevel(
  project: Project,
  session: Pick<ClassOverrideSession, "classOverrides" | "actorParamBonuses">,
  actorId: ActorId,
  level: number
): { readonly maxHp: number; readonly maxMp: number } | null {
  const classId = effectiveActorClassId(project, session, actorId);
  const klass = project.database.classes.find((record) => record.id === classId);
  if (!klass) return null;
  const bonuses = session.actorParamBonuses?.[actorId];
  const maxHp = Math.max(1, parameterValueAtLevel(klass.parameterCurves.maxHp, clampLevel(level)) + Math.trunc(bonuses?.maxHp ?? 0));
  const maxMp = Math.max(0, parameterValueAtLevel(klass.parameterCurves.maxMp, clampLevel(level)) + Math.trunc(bonuses?.maxMp ?? 0));
  return { maxHp, maxMp };
}
