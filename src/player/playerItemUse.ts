import { activeItemEffects, itemAllowsMenu } from "@/project/itemUsage";
import { applyCareItem } from "@/project/monsterCare";
import { learnSkill, nextSessionRandom, setSwitch, type PlaySession } from "@/project/session";
import { effectiveActorClassId } from "@/project/sessionClass";
import type { ActorParameterKey, ItemRecord, Project, SkillId } from "@/project/types";
import { transitionItemState } from "@/project/itemTransitions";
import { isItemActorEligible } from "@/project/itemEligibility";

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
  const authoredItem = project.database.items.find((record) => record.id === itemId);
  const item = authoredItem ? activeItemEffects(authoredItem) : undefined;
  if (!item || (session.inventory[item.id] ?? 0) <= 0) return { kind: "unusable", message: "사용할 수 없습니다" };
  if (!canUseItemInMenu(item)) return { kind: "unusable", message: `${item.name}은(는) 지금 사용할 수 없습니다` };

  if (item.careProfile) {
    return useCareItem(project, session, item, targetMonsterInstanceId);
  }

  const learnedSkillId = item.learnedSkillId ?? (item.type === "book" ? item.skillId : undefined);
  if (learnedSkillId) {
    return useSkillBook(project, session, item, learnedSkillId, targetActorId);
  }

  if (item.type === "switch" && item.switchId) {
    if (session.switches[item.switchId] === true) return { kind: "unusable", message: `${item.name}의 장치는 이미 작동했습니다` };
    setSwitch(session, item.switchId, true);
    commitSuccessfulUse(project, session, item);
    return { kind: "used", message: `${item.name}으로 장치를 작동했습니다` };
  }

  const targets = hasSeedBonus(item)
    ? [targetActorId].filter((actorId): actorId is string => Boolean(actorId))
    : item.scope === "allAllies"
      ? session.partyActorIds
      : [targetActorId].filter((actorId): actorId is string => Boolean(actorId));
  if ((item.scope !== "none" || hasSeedBonus(item)) && targets.length === 0) return { kind: "unusable", message: "대상을 선택하세요" };

  let changed = false;
  for (const actorId of targets) {
    if (!isItemActorEligible(project, item, actorId, effectiveActorClassId(project, session, actorId))) continue;
    if (!canApplyItemEffects(project, item, session, actorId)) continue;
    changed = applyItemEffects(project, item, session, actorId) || changed;
  }
  if (!changed) return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };

  commitSuccessfulUse(project, session, item);
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
  const beforeInventory = session.inventory[item.id] ?? 0;
  const beforeCharge = session.itemUseCharges?.[item.id];
  const result = applyCareItem(project, session, { itemId: item.id, instanceId });
  if (!result.ok) {
    if (result.reason === "notInParty") return { kind: "unusable", message: "파티 몬스터에게만 사용할 수 있습니다" };
    if (result.reason === "missingInstance") return { kind: "unusable", message: "대상을 찾을 수 없습니다" };
    return { kind: "unusable", message: `${item.name}은(는) 지금 사용할 수 없습니다` };
  }
  // applyCareItem owns its legacy one-copy decrement. Restore both the copy and
  // its FIFO cursor before the shared authority commits the successful use.
  session.inventory[item.id] = beforeInventory;
  session.itemUseCharges ??= {};
  if (beforeCharge === undefined) delete session.itemUseCharges[item.id];
  else session.itemUseCharges[item.id] = beforeCharge;
  commitSuccessfulUse(project, session, item);
  return { kind: "used", message: `${item.name}을 사용했습니다` };
}

function useSkillBook(
  project: Project,
  session: PlaySession,
  item: ItemRecord,
  skillId: SkillId,
  targetActorId?: string
): MenuItemUseResult {
  const actorId = targetActorId ?? session.partyActorIds[0];
  if (!actorId) return { kind: "unusable", message: "대상을 선택하세요" };
  if (!isItemActorEligible(project, item, actorId, effectiveActorClassId(project, session, actorId))) {
    return { kind: "unusable", message: `${item.name}을(를) 사용할 수 없는 대상입니다` };
  }

  session.actorSkillIds ??= {};
  const known = session.actorSkillIds[actorId] ?? [];
  if (known.includes(skillId)) {
    return { kind: "unusable", message: "이미 습득한 기술입니다" };
  }

  learnSkill(session, actorId, skillId);
  commitSuccessfulUse(project, session, item);
  return { kind: "used", message: `${item.name}으로 기술을 익혔습니다` };
}

function canApplyItemEffects(project: Project, item: ItemRecord, session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;
  if (hasSeedBonus(item)) return true;
  const dead = vitals.hp <= 0;
  if (item.onlyEffectiveOnDeadActors) return dead;
  if (dead) return false;

  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  if ((hp > 0 && vitals.hp < vitals.maxHp) || (mp > 0 && vitals.mp < vitals.maxMp)) return true;

  const states = session.actorStateIds?.[actorId] ?? [];
  for (const stateId of healStateIdsOf(item)) {
    if (states.includes(stateId)) return true;
  }
  // 부여(add) 후보가 하나라도 아직 걸리지 않았으면 사용을 시도할 수 있다 — 확률 판정은
  // applyItemEffects 가 굴리고, 실패하면 changed=false 라 공통 소모 경로가 물리지 않는다.
  return inflictStateEffectsOf(project, item).some((effect) => !states.includes(effect.stateId));
}

function canUseItemInMenu(item: ItemRecord): boolean {
  return itemAllowsMenu(item);
}

function applyItemEffects(project: Project, item: ItemRecord, session: PlaySession, actorId: string): boolean {
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

  // add-op 상태 부여 — 전투(applyStateEffects)과 같은 확률 판정. 필드에는 장비 저항·상태
  // 저항률 모델이 없으므로 저작된 chance 그대로 굴린다. 이미 걸린 상태는 건너뛴다.
  const inflictEffects = inflictStateEffectsOf(project, item);
  if (inflictEffects.length > 0) {
    session.actorStateIds ??= {};
    const current = session.actorStateIds[actorId] ?? [];
    const next = [...current];
    for (const effect of inflictEffects) {
      if (next.includes(effect.stateId)) continue;
      if (!rollInflict(session, effect.chance)) continue;
      next.push(effect.stateId);
    }
    if (next.length !== current.length) {
      session.actorStateIds[actorId] = next;
      changed = true;
    }
  }

  if (hasSeedBonus(item)) {
    session.actorParamBonuses ??= {};
    const current = session.actorParamBonuses[actorId] ?? {};
    const next = { ...current };
    for (const key of SEED_PARAMETER_KEYS) {
      const delta = item.seedParameterBonuses[key];
      if (delta !== 0) next[key] = (next[key] ?? 0) + delta;
    }
    session.actorParamBonuses[actorId] = next;
    changed = true;
  }
  return changed;
}

/** 존재하는 상태만 — 삭제된 상태 id 가 남은 레코드가 세션에 유령 상태를 심지 않게 한다(전투 behaviorFor 게이트와 같은 방향). */
function inflictStateEffectsOf(project: Project, item: ItemRecord): ItemRecord["stateEffects"] {
  return item.stateEffects.filter((effect) =>
    effect.operation === "add" && project.database.states.some((state) => state.id === effect.stateId)
  );
}

/** 부분 확률은 저장 가능한 battle 난수 스트림을 사용한다. 0%와 100%는 스트림을 전진시키지 않는다. */
function rollInflict(session: PlaySession, chance: number): boolean {
  if (chance >= 100) return true;
  if (chance <= 0) return false;
  return nextSessionRandom(session, "battle") * 100 < chance;
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

const SEED_PARAMETER_KEYS = ["attack", "defense", "mind", "agility"] as const satisfies readonly ActorParameterKey[];

function hasSeedBonus(item: ItemRecord): boolean {
  return SEED_PARAMETER_KEYS.some((key) => item.seedParameterBonuses[key] !== 0);
}

function commitSuccessfulUse(project: Project, session: PlaySession, item: ItemRecord): void {
  const next = transitionItemState(session, project.database.items, { kind: "successfulUse", itemId: item.id });
  session.inventory = next.inventory;
  session.itemUseCharges = next.itemUseCharges;
}
