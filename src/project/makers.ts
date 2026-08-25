import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_DAYS_PER_SEASON,
  SEASONS,
  resolveTimeSystem,
  type GameTime,
  type TimeSystemConfig,
} from "@/project/gameTime";
import { changeItemsAtomically, type MakerInstanceState, type PlaySession } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import type { MakerDefinition, Project } from "@/project/types";

type MakerFailureReason =
  | "disabled"
  | "invalid-instance"
  | "missing-maker"
  | "invalid-time"
  | "invalid-definition"
  | "insufficient-input"
  | "busy"
  | "missing-instance"
  | "not-ready"
  | "inventory-overflow"
  | "invalid-state";

export type MakerStartResult =
  | { readonly ok: true; readonly instanceId: string; readonly makerId: string; readonly readyAtMinute: number }
  | { readonly ok: false; readonly reason: MakerFailureReason; readonly instanceId?: string; readonly makerId?: string };

export type MakerAdvanceResult =
  | { readonly ok: true; readonly readyInstanceIds: readonly string[] }
  | { readonly ok: false; readonly reason: MakerFailureReason; readonly instanceId?: string };

export type MakerCollectResult =
  | { readonly ok: true; readonly instanceId: string; readonly makerId: string; readonly outputs: readonly { readonly itemId: string; readonly count: number }[] }
  | { readonly ok: false; readonly reason: MakerFailureReason; readonly instanceId?: string };

/**
 * Monotonic minute index for the authored playable-day clock.
 * Hours beyond 23 remain part of the current authored day, so a 26:00 day end
 * advances monotonically into the next date's dayStartHour.
 */
export function absoluteGameMinutes(time: GameTime, system?: TimeSystemConfig): number {
  const resolved = resolveTimeSystem(system);
  const dayStartHour = resolved?.dayStartHour ?? DEFAULT_DAY_START_HOUR;
  const dayEndHour = resolved?.dayEndHour ?? DEFAULT_DAY_END_HOUR;
  const daysPerSeason = resolved?.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON;
  const seasonIndex = Math.max(0, SEASONS.indexOf(time.season));
  const year = Math.max(1, Math.trunc(time.year));
  const day = Math.max(1, Math.min(daysPerSeason, Math.trunc(time.day)));
  const dayIndex = ((year - 1) * SEASONS.length + seasonIndex) * daysPerSeason + day - 1;
  const dayLengthMinutes = Math.max(1, dayEndHour - dayStartHour) * 60;
  const elapsed = Math.max(0, Math.trunc(time.hour) * 60 + Math.trunc(time.minute) - dayStartHour * 60);
  const result = dayIndex * dayLengthMinutes + elapsed;
  if (!Number.isSafeInteger(result) || result < 0) throw new RangeError("Game time exceeds the absolute-minute range");
  return result;
}

export const absoluteGameMinute = absoluteGameMinutes;

export function startMaker(
  project: Project,
  session: PlaySession,
  instanceId: string,
  makerId: string,
  absoluteMinute: number,
): MakerStartResult {
  const definitions = project.system.makers;
  if (!definitions || definitions.length === 0) return { ok: false, reason: "disabled", instanceId, makerId };
  if (!instanceId.trim()) return { ok: false, reason: "invalid-instance", instanceId, makerId };
  if (!isNonNegativeSafeInteger(absoluteMinute)) return { ok: false, reason: "invalid-time", instanceId, makerId };
  const maker = definitions.find((entry) => entry.id === makerId);
  if (!maker) return { ok: false, reason: "missing-maker", instanceId, makerId };
  if (!validMakerDefinition(project, maker)) return { ok: false, reason: "invalid-definition", instanceId, makerId };

  const existing = session.makerInstances?.[instanceId];
  if (existing && existing.status !== "idle") return { ok: false, reason: "busy", instanceId, makerId };
  if (existing && existing.makerId !== makerId) return { ok: false, reason: "invalid-instance", instanceId, makerId };
  const readyAtMinute = absoluteMinute + maker.durationMinutes;
  if (!isNonNegativeSafeInteger(readyAtMinute)) return { ok: false, reason: "invalid-time", instanceId, makerId };
  for (const input of maker.inputs) {
    const current = session.inventory[input.itemId] ?? 0;
    if (!isItemQuantity(current) || current < input.count) {
      return { ok: false, reason: "insufficient-input", instanceId, makerId };
    }
  }

  if (!changeItemsAtomically(session, maker.inputs.map((input) => ({ itemId: input.itemId, op: "-=", amount: input.count })))) {
    return { ok: false, reason: "invalid-state", instanceId, makerId };
  }
  session.makerInstances ??= {};
  session.makerInstances[instanceId] = {
    instanceId,
    makerId,
    status: "processing",
    startedAtMinute: absoluteMinute,
    readyAtMinute,
  };
  return { ok: true, instanceId, makerId, readyAtMinute };
}

export function advanceMakers(project: Project, session: PlaySession, absoluteMinute: number): MakerAdvanceResult {
  if (!project.system.makers || project.system.makers.length === 0) return { ok: false, reason: "disabled" };
  if (!isNonNegativeSafeInteger(absoluteMinute)) return { ok: false, reason: "invalid-time" };
  const definitions = new Set(project.system.makers.map((maker) => maker.id));
  for (const [instanceId, instance] of Object.entries(session.makerInstances ?? {})) {
    if (!validMakerInstance(instanceId, instance, definitions)) {
      return { ok: false, reason: "invalid-state", instanceId };
    }
  }

  const readyInstanceIds: string[] = [];
  for (const [instanceId, instance] of Object.entries(session.makerInstances ?? {})) {
    if (instance.status !== "processing" || instance.readyAtMinute! > absoluteMinute) continue;
    session.makerInstances![instanceId] = { ...instance, status: "ready" };
    readyInstanceIds.push(instanceId);
  }
  return { ok: true, readyInstanceIds };
}

export function collectMaker(project: Project, session: PlaySession, instanceId: string): MakerCollectResult {
  const instance = session.makerInstances?.[instanceId];
  if (!instance) return { ok: false, reason: "missing-instance", instanceId };
  if (instance.status !== "ready") return { ok: false, reason: "not-ready", instanceId };
  const maker = project.system.makers?.find((entry) => entry.id === instance.makerId);
  if (!maker || !validMakerDefinition(project, maker)) return { ok: false, reason: "invalid-definition", instanceId };
  for (const output of maker.outputs) {
    const current = session.inventory[output.itemId] ?? 0;
    if (!isItemQuantity(current) || current + output.count > ITEM_QUANTITY_MAX) {
      return { ok: false, reason: "inventory-overflow", instanceId };
    }
  }

  if (!changeItemsAtomically(session, maker.outputs.map((output) => ({ itemId: output.itemId, op: "+=", amount: output.count })))) {
    return { ok: false, reason: "inventory-overflow", instanceId };
  }
  session.makerInstances![instanceId] = {
    instanceId,
    makerId: instance.makerId,
    status: "idle",
  };
  return { ok: true, instanceId, makerId: maker.id, outputs: maker.outputs.map((entry) => ({ ...entry })) };
}

function validMakerDefinition(project: Project, maker: MakerDefinition): boolean {
  if (!maker.id.trim() || !isPositiveSafeInteger(maker.durationMinutes) || maker.outputs.length === 0) return false;
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const validAmounts = (values: readonly { readonly itemId: string; readonly count: number }[]) => {
    const seen = new Set<string>();
    return values.every((entry) => {
      if (!itemIds.has(entry.itemId) || seen.has(entry.itemId) || !isPositiveItemQuantity(entry.count)) return false;
      seen.add(entry.itemId);
      return true;
    });
  };
  return validAmounts(maker.inputs) && validAmounts(maker.outputs);
}

function validMakerInstance(instanceId: string, instance: MakerInstanceState, makerIds: ReadonlySet<string>): boolean {
  if (instance.instanceId !== instanceId || !makerIds.has(instance.makerId)) return false;
  if (instance.status === "idle") return instance.startedAtMinute === undefined && instance.readyAtMinute === undefined;
  return isNonNegativeSafeInteger(instance.startedAtMinute) &&
    isNonNegativeSafeInteger(instance.readyAtMinute) &&
    instance.readyAtMinute >= instance.startedAtMinute;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
