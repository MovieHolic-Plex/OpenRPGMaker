import {
  applyMonsterExperienceAndEvolution,
  ensureMonsterSessionFields,
  evolveMonster,
  monsterDisplayName,
  monsterExpToRaiseLevels,
  monsterSpeciesById,
  normalizeMonsterInstanceBattleState,
  previewMonsterEvolutionChain,
} from "@/project/monsterCollection";
import { changeItem, clampFriendship, giftDayKey, type PlaySession } from "@/project/session";
import { isPositiveItemQuantity } from "@/project/itemQuantities";
import type { ItemCareProfile, ItemId, MonsterCareConfig, Project } from "@/project/types";

export const DEFAULT_MONSTER_CARE: MonsterCareConfig = {
  stepsPerTick: 50,
  walkFriendship: 1,
  walkExp: 1,
  dailyCareCap: 30,
};

export type ApplyCareItemInput = {
  readonly itemId: ItemId | string;
  readonly instanceId: string;
};

/** 필드 사용으로 일어난 진화 한 단계 — 메뉴가 진화 장면·문장으로 보인다. */
export type CareEvolution = { readonly name: string; readonly fromSpeciesId: string; readonly toSpeciesId: string };

export type ApplyCareItemResult =
  | {
      readonly ok: true;
      readonly instanceId: string;
      readonly itemId: string;
      readonly friendship: number;
      readonly friendshipDelta: number;
      readonly expDelta: number;
      readonly kind: ItemCareProfile["kind"];
      /** 이상한 사탕(levelUp)·경험치로 오른 레벨 — 오르지 않으면 같은 값. */
      readonly levelBefore: number;
      readonly levelAfter: number;
      readonly evolutions: readonly CareEvolution[];
    }
  | {
      readonly ok: false;
      readonly reason:
        | "missingItem"
        | "notCareItem"
        | "missingInstance"
        | "notInParty"
        | "noInventory"
        | "maxLevel";
    };

/** 돌봄 아이템을 이 파티 몬스터에게 쓰면 어떻게 되는가(읽기 전용) — 메뉴 대상 줄의 「Lv a → b」 미리보기와 사용 경로가 같은 판정을 쓴다. */
export function previewCareItem(
  project: Project,
  session: Pick<PlaySession, "monsterInstances" | "monsterParty" | "inventory"> & Partial<PlaySession>,
  item: { readonly id: string; readonly careProfile?: ItemCareProfile },
  instanceId: string,
): {
  readonly reason?: string;
  readonly level: number;
  readonly levelAfter: number;
  readonly friendship: number;
  readonly friendshipAfter: number;
  readonly evolveToSpeciesIds: readonly string[];
} {
  const raw = session.monsterInstances?.[instanceId];
  const instance = raw ? normalizeMonsterInstanceBattleState(project, raw) : undefined;
  const care = item.careProfile;
  if (!instance || !care) return { reason: "대상을 찾을 수 없습니다", level: 0, levelAfter: 0, friendship: 0, friendshipAfter: 0, evolveToSpeciesIds: [] };
  const species = monsterSpeciesById(project, instance.speciesId);
  const friendshipAfter = clampFriendship(instance.friendship + Math.trunc(Number.isFinite(care.friendshipDelta) ? care.friendshipDelta : 0));
  let levelAfter = instance.level;
  if (species && care.levelUp) levelAfter = monsterExpToRaiseLevels(species, instance, care.levelUp).toLevel;
  const expDelta = Math.max(0, Math.trunc(Number.isFinite(care.expDelta) ? (care.expDelta ?? 0) : 0));
  let reason: string | undefined;
  if (!session.monsterParty?.includes(instanceId)) reason = "파티 몬스터에게만 사용할 수 있습니다";
  else if ((session.inventory[item.id] ?? 0) <= 0) reason = "아이템이 없습니다";
  else if (care.levelUp && expDelta === 0 && friendshipAfter === instance.friendship && levelAfter <= instance.level) reason = "이미 최대 레벨입니다";
  const evolveToSpeciesIds = !reason && levelAfter > instance.level ? previewMonsterEvolutionChain(project, session as PlaySession, instanceId, levelAfter) : [];
  return { reason, level: instance.level, levelAfter: reason ? instance.level : levelAfter, friendship: instance.friendship, friendshipAfter: reason ? instance.friendship : friendshipAfter, evolveToSpeciesIds };
}

export type ApplyWalkCareTicksResult = {
  readonly steps: number;
  readonly ticksApplied: number;
  readonly friendshipGranted: number;
  readonly expGranted: number;
};

export function resolveMonsterCare(project: Project): MonsterCareConfig {
  const raw = project.system.monsterCare;
  return {
    stepsPerTick: positiveInteger(raw?.stepsPerTick, DEFAULT_MONSTER_CARE.stepsPerTick),
    walkFriendship: nonNegativeInteger(raw?.walkFriendship, DEFAULT_MONSTER_CARE.walkFriendship),
    walkExp: nonNegativeInteger(raw?.walkExp, DEFAULT_MONSTER_CARE.walkExp),
    dailyCareCap: nonNegativeInteger(raw?.dailyCareCap, DEFAULT_MONSTER_CARE.dailyCareCap),
  };
}

export function applyCareItem(
  project: Project,
  session: PlaySession,
  input: ApplyCareItemInput
): ApplyCareItemResult {
  const item = project.database.items.find((record) => record.id === input.itemId);
  if (!item) return { ok: false, reason: "missingItem" };
  const care = item.careProfile;
  if (!care || (care.kind !== "feed" && care.kind !== "toy")) {
    return { ok: false, reason: "notCareItem" };
  }
  if (!isPositiveItemQuantity(session.inventory[item.id])) return { ok: false, reason: "noInventory" };

  const instanceId = input.instanceId.trim();
  const instance = session.monsterInstances?.[instanceId];
  if (!instance) return { ok: false, reason: "missingInstance" };
  if (!session.monsterParty?.includes(instanceId)) return { ok: false, reason: "notInParty" };
  // 이상한 사탕만 있는 아이템이 상한 레벨 개체에 쓰이면 아무것도 바뀌지 않는다 — 소모하지 않는다.
  if (care.levelUp && previewCareItem(project, session, item, instanceId).reason === "이미 최대 레벨입니다") return { ok: false, reason: "maxLevel" };

  if (!changeItem(session, item.id, "-=", 1)) return { ok: false, reason: "noInventory" };

  const friendshipDelta = Math.trunc(Number.isFinite(care.friendshipDelta) ? care.friendshipDelta : 0);
  const nextFriendship = clampFriendship(instance.friendship + friendshipDelta);
  session.monsterInstances[instanceId] = {
    ...instance,
    friendship: nextFriendship,
  };

  const expDelta = Math.max(0, Math.trunc(Number.isFinite(care.expDelta) ? (care.expDelta ?? 0) : 0));
  const levelBefore = normalizeMonsterInstanceBattleState(project, session.monsterInstances[instanceId]!).level;
  const evolutions: CareEvolution[] = [];
  const collect = (name: string, evolution: ReturnType<typeof evolveMonster> | undefined): void => {
    if (evolution?.ok) evolutions.push({ name, fromSpeciesId: evolution.fromSpeciesId, toSpeciesId: evolution.toSpeciesId });
  };
  const name = monsterDisplayName(project, session.monsterInstances[instanceId]);
  const species = monsterSpeciesById(project, instance.speciesId);
  if (care.levelUp && species) {
    const need = monsterExpToRaiseLevels(species, normalizeMonsterInstanceBattleState(project, session.monsterInstances[instanceId]!), care.levelUp);
    if (need.exp > 0) {
      const [raised] = applyMonsterExperienceAndEvolution(project, session, need.exp, [instanceId]);
      collect(name, raised?.evolution);
      // 한 번에 여러 단계를 넘으면 진화가 이어진다(Lv16·Lv34 를 함께 넘은 사탕) — 더 진화할 곳이 없을 때까지.
      for (let step = 0; step < 5 && raised?.evolution?.ok; step += 1) {
        const next = evolveMonster(project, session, { instanceId, allowItemEvolution: false });
        if (!next.ok) break;
        collect(name, next);
      }
    }
  }
  if (expDelta > 0) {
    const [gained] = applyMonsterExperienceAndEvolution(project, session, expDelta, [instanceId]);
    collect(name, gained?.evolution);
  }
  return {
    ok: true,
    instanceId,
    itemId: item.id,
    friendship: session.monsterInstances[instanceId]?.friendship ?? nextFriendship,
    friendshipDelta,
    expDelta,
    kind: care.kind,
    levelBefore,
    levelAfter: normalizeMonsterInstanceBattleState(project, session.monsterInstances[instanceId]!).level,
    evolutions,
  };
}

export function applyWalkCareTicks(
  project: Project,
  session: PlaySession,
  steps = 1
): ApplyWalkCareTicksResult {
  ensureMonsterSessionFields(session);
  const care = resolveMonsterCare(project);
  const addSteps = Math.max(0, Math.trunc(Number.isFinite(steps) ? steps : 0));
  session.monsterCareSteps = Math.max(0, Math.trunc(session.monsterCareSteps ?? 0)) + addSteps;

  let ticksApplied = 0;
  let friendshipGranted = 0;
  let expGranted = 0;
  if (care.stepsPerTick <= 0) {
    return { steps: session.monsterCareSteps, ticksApplied, friendshipGranted, expGranted };
  }

  while (session.monsterCareSteps >= care.stepsPerTick) {
    session.monsterCareSteps -= care.stepsPerTick;
    ticksApplied += 1;
    const tick = applyOneWalkCareTick(project, session, care);
    friendshipGranted += tick.friendshipGranted;
    expGranted += tick.expGranted;
  }

  return {
    steps: session.monsterCareSteps,
    ticksApplied,
    friendshipGranted,
    expGranted,
  };
}

function applyOneWalkCareTick(
  project: Project,
  session: PlaySession,
  care: MonsterCareConfig
): { friendshipGranted: number; expGranted: number } {
  const dayKey = giftDayKey(session.gameTime);
  session.monsterCareDaily ??= {};
  let dailyGranted = Math.max(0, Math.trunc(session.monsterCareDaily[dayKey] ?? 0));
  let friendshipGranted = 0;
  let expGranted = 0;

  for (const instanceId of session.monsterParty) {
    if (dailyGranted >= care.dailyCareCap) break;
    const instance = session.monsterInstances[instanceId];
    if (!instance) continue;

    const remaining = care.dailyCareCap - dailyGranted;
    const friendshipDelta = Math.min(care.walkFriendship, remaining);
    if (friendshipDelta > 0) {
      session.monsterInstances[instanceId] = {
        ...instance,
        friendship: clampFriendship(instance.friendship + friendshipDelta),
      };
      dailyGranted += friendshipDelta;
      friendshipGranted += friendshipDelta;
    }

    if (care.walkExp > 0) {
      applyMonsterExperienceAndEvolution(project, session, care.walkExp, [instanceId]);
      expGranted += care.walkExp;
    }
  }

  session.monsterCareDaily[dayKey] = dailyGranted;
  return { friendshipGranted, expGranted };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const next = Math.trunc(value);
  return next > 0 ? next : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}
