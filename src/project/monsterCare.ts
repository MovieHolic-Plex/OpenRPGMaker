import {
  applyMonsterExperienceAndEvolution,
  ensureMonsterSessionFields,
} from "@/project/monsterCollection";
import { changeItem, clampFriendship, giftDayKey, type PlaySession } from "@/project/session";
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

export type ApplyCareItemResult =
  | {
      readonly ok: true;
      readonly instanceId: string;
      readonly itemId: string;
      readonly friendship: number;
      readonly friendshipDelta: number;
      readonly expDelta: number;
      readonly kind: ItemCareProfile["kind"];
    }
  | {
      readonly ok: false;
      readonly reason:
        | "missingItem"
        | "notCareItem"
        | "missingInstance"
        | "notInParty"
        | "noInventory";
    };

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
  ensureMonsterSessionFields(session);
  const item = project.database.items.find((record) => record.id === input.itemId);
  if (!item) return { ok: false, reason: "missingItem" };
  const care = item.careProfile;
  if (!care || (care.kind !== "feed" && care.kind !== "toy")) {
    return { ok: false, reason: "notCareItem" };
  }
  if ((session.inventory[item.id] ?? 0) <= 0) return { ok: false, reason: "noInventory" };

  const instanceId = input.instanceId.trim();
  const instance = session.monsterInstances[instanceId];
  if (!instance) return { ok: false, reason: "missingInstance" };
  if (!session.monsterParty.includes(instanceId)) return { ok: false, reason: "notInParty" };

  const friendshipDelta = Math.trunc(Number.isFinite(care.friendshipDelta) ? care.friendshipDelta : 0);
  const nextFriendship = clampFriendship(instance.friendship + friendshipDelta);
  session.monsterInstances[instanceId] = {
    ...instance,
    friendship: nextFriendship,
  };

  const expDelta = Math.max(0, Math.trunc(Number.isFinite(care.expDelta) ? (care.expDelta ?? 0) : 0));
  if (expDelta > 0) {
    applyMonsterExperienceAndEvolution(project, session, expDelta, [instanceId]);
  }

  changeItem(session, item.id, "-=", 1);
  return {
    ok: true,
    instanceId,
    itemId: item.id,
    friendship: session.monsterInstances[instanceId]?.friendship ?? nextFriendship,
    friendshipDelta,
    expDelta,
    kind: care.kind,
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
