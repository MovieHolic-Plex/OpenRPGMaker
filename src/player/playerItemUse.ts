import { applyCareItem } from "@/project/monsterCare";
import { changeItem, learnSkill, type PlaySession } from "@/project/session";
import type { ItemRecord, Project, SkillId } from "@/project/types";

export type MenuItemUseResult =
  | { readonly kind: "used"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

export function useItemFromMenu(
  project: Project,
  session: PlaySession,
  itemId: string,
  targetActorId?: string,
  targetMonsterInstanceId?: string
): MenuItemUseResult {
  const item = project.database.items.find((record) => record.id === itemId);
  if (!item || (session.inventory[item.id] ?? 0) <= 0) return { kind: "unusable", message: "사용할 수 없습니다" };
  if (!canUseItemInMenu(item)) return { kind: "unusable", message: `${item.name}은(는) 지금 사용할 수 없습니다` };

  if (item.careProfile) {
    return useCareItem(project, session, item, targetMonsterInstanceId);
  }

  const learnedSkillId = item.learnedSkillId ?? (item.type === "book" ? item.skillId : undefined);
  if (learnedSkillId) {
    return useSkillBook(session, item, learnedSkillId, targetActorId);
  }

  const targets = item.scope === "allAllies"
    ? session.partyActorIds
    : [targetActorId].filter((actorId): actorId is string => Boolean(actorId));
  if (item.scope !== "none" && targets.length === 0) return { kind: "unusable", message: "대상을 선택하세요" };

  let changed = false;
  for (const actorId of targets) {
    if (!canApplyItemEffects(item, session, actorId)) continue;
    changed = applyItemEffects(item, session, actorId) || changed;
  }
  if (!changed) return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };

  if (item.consumable) changeItem(session, item.id, "-=", 1);
  return { kind: "used", message: `${item.name}을 사용했습니다` };
}

function useCareItem(
  project: Project,
  session: PlaySession,
  item: ItemRecord,
  targetMonsterInstanceId?: string
): MenuItemUseResult {
  const instanceId = targetMonsterInstanceId?.trim();
  if (!instanceId) return { kind: "unusable", message: "대상을 선택하세요" };
  const result = applyCareItem(project, session, { itemId: item.id, instanceId });
  if (!result.ok) {
    if (result.reason === "notInParty") return { kind: "unusable", message: "파티 몬스터에게만 사용할 수 있습니다" };
    if (result.reason === "missingInstance") return { kind: "unusable", message: "대상을 찾을 수 없습니다" };
    return { kind: "unusable", message: `${item.name}은(는) 지금 사용할 수 없습니다` };
  }
  return { kind: "used", message: `${item.name}을 사용했습니다` };
}

function useSkillBook(
  session: PlaySession,
  item: ItemRecord,
  skillId: SkillId,
  targetActorId?: string
): MenuItemUseResult {
  const actorId = targetActorId ?? session.partyActorIds[0];
  if (!actorId) return { kind: "unusable", message: "대상을 선택하세요" };
  if (item.usableActorIds.length > 0 && !item.usableActorIds.includes(actorId)) {
    return { kind: "unusable", message: `${item.name}을(를) 사용할 수 없는 대상입니다` };
  }

  session.actorSkillIds ??= {};
  const known = session.actorSkillIds[actorId] ?? [];
  if (known.includes(skillId)) {
    return { kind: "unusable", message: "이미 습득한 기술입니다" };
  }

  learnSkill(session, actorId, skillId);
  if (item.consumable) changeItem(session, item.id, "-=", 1);
  return { kind: "used", message: `${item.name}으로 기술을 익혔습니다` };
}

function canApplyItemEffects(item: ItemRecord, session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;
  const dead = vitals.hp <= 0;
  if (item.onlyEffectiveOnDeadActors) return dead;
  if (dead) return false;

  if (item.usableActorIds.length > 0 && !item.usableActorIds.includes(actorId)) return false;

  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  if ((hp > 0 && vitals.hp < vitals.maxHp) || (mp > 0 && vitals.mp < vitals.maxMp)) return true;

  const states = session.actorStateIds?.[actorId] ?? [];
  for (const stateId of healStateIdsOf(item)) {
    if (states.includes(stateId)) return true;
  }
  return false;
}

function canUseItemInMenu(item: ItemRecord): boolean {
  if (item.occasion === "never" || item.occasion === "battle") return false;
  if (item.onlyUsableInMenu) return true;
  if (item.occasionField === false && item.occasion !== "field" && item.occasion !== "always") return false;
  return item.occasion === "always" || item.occasion === "field" || item.occasionField === true;
}

function applyItemEffects(item: ItemRecord, session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;

  let changed = false;
  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  const beforeHp = vitals.hp;
  const beforeMp = vitals.mp;
  if (hp > 0) vitals.hp = Math.min(vitals.maxHp, vitals.hp + hp);
  if (mp > 0) vitals.mp = Math.min(vitals.maxMp, vitals.mp + mp);
  if (vitals.hp !== beforeHp || vitals.mp !== beforeMp) changed = true;

  const healIds = healStateIdsOf(item);
  if (healIds.length > 0) {
    session.actorStateIds ??= {};
    const current = session.actorStateIds[actorId] ?? [];
    const next = current.filter((stateId) => !healIds.includes(stateId));
    if (next.length !== current.length) {
      session.actorStateIds[actorId] = next;
      changed = true;
    }
  }
  return changed;
}

function healStateIdsOf(item: ItemRecord): string[] {
  const ids = new Set<string>(item.healStateIds);
  for (const effect of item.stateEffects) {
    if (effect.operation === "remove") ids.add(effect.stateId);
  }
  return [...ids];
}

function recoveryAmount(recovery: ItemRecord["hpRecovery"], maxValue: number): number {
  return Math.max(0, Math.floor((maxValue * recovery.percentMax) / 100) + recovery.flat);
}
