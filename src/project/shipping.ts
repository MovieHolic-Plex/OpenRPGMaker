import { changeItem, GOLD_MAX, type PlaySession, type ShippingSettlement, type ShippingSettlementEntry } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import type { Project } from "@/project/types";
import { resolveSellPrice } from "@/project/upgrades";

const DEFAULT_HISTORY_LIMIT = 28;
const MAX_HISTORY_LIMIT = 365;

type ShippingFailureReason =
  | "disabled"
  | "invalid-count"
  | "unknown-item"
  | "item-not-allowed"
  | "insufficient-inventory"
  | "insufficient-queue"
  | "overflow"
  | "invalid-day-key"
  | "already-settled"
  | "invalid-queue"
  | "invalid-price";

export type ShippingQueueResult =
  | { readonly ok: true; readonly itemId: string; readonly queued: number }
  | { readonly ok: false; readonly reason: ShippingFailureReason; readonly itemId?: string };

export type ShippingSettlementResult =
  | { readonly ok: true; readonly dayKey: string; readonly entries: readonly ShippingSettlementEntry[]; readonly total: number; readonly credited: number }
  | { readonly ok: false; readonly reason: ShippingFailureReason; readonly itemId?: string };

export function depositShipping(
  project: Project,
  session: PlaySession,
  itemId: string,
  count: number,
): ShippingQueueResult {
  const enabled = shippingEnabled(project);
  if (!enabled) return { ok: false, reason: "disabled" };
  if (!isPositiveItemQuantity(count)) return { ok: false, reason: "invalid-count", itemId };
  const eligibility = validateItemEligibility(project, itemId);
  if (eligibility) return { ok: false, reason: eligibility, itemId };
  const inventoryCount = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(inventoryCount) || inventoryCount < count) {
    return { ok: false, reason: "insufficient-inventory", itemId };
  }
  const queued = session.shippingQueue?.[itemId] ?? 0;
  if (!isItemQuantity(queued) || queued + count > ITEM_QUANTITY_MAX) {
    return { ok: false, reason: "overflow", itemId };
  }

  if (!changeItem(session, itemId, "-=", count)) return { ok: false, reason: "overflow", itemId };
  session.shippingQueue ??= {};
  session.shippingQueue[itemId] = queued + count;
  return { ok: true, itemId, queued: queued + count };
}

export function withdrawShipping(
  project: Project,
  session: PlaySession,
  itemId: string,
  count: number,
): ShippingQueueResult {
  if (!shippingEnabled(project)) return { ok: false, reason: "disabled" };
  if (!isPositiveItemQuantity(count)) return { ok: false, reason: "invalid-count", itemId };
  const eligibility = validateItemEligibility(project, itemId);
  if (eligibility) return { ok: false, reason: eligibility, itemId };
  const queued = session.shippingQueue?.[itemId] ?? 0;
  if (!isItemQuantity(queued) || queued < count) {
    return { ok: false, reason: "insufficient-queue", itemId };
  }
  const inventoryCount = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(inventoryCount) || inventoryCount + count > ITEM_QUANTITY_MAX) {
    return { ok: false, reason: "overflow", itemId };
  }

  if (!changeItem(session, itemId, "+=", count)) return { ok: false, reason: "overflow", itemId };
  session.shippingQueue ??= {};
  const remaining = queued - count;
  if (remaining === 0) delete session.shippingQueue[itemId];
  else session.shippingQueue[itemId] = remaining;
  return { ok: true, itemId, queued: remaining };
}

export function settleShipping(project: Project, session: PlaySession, dayKey: string): ShippingSettlementResult {
  if (!shippingEnabled(project)) return { ok: false, reason: "disabled" };
  const normalizedDayKey = dayKey.trim();
  if (!normalizedDayKey) return { ok: false, reason: "invalid-day-key" };
  if (session.shippingLastSettledDayKey === normalizedDayKey ||
    (session.shippingHistory ?? []).some((entry) => entry.dayKey === normalizedDayKey)) {
    return { ok: false, reason: "already-settled" };
  }

  const entries: ShippingSettlementEntry[] = [];
  let total = 0;
  for (const [itemId, count] of Object.entries(session.shippingQueue ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isPositiveItemQuantity(count)) {
      return { ok: false, reason: "invalid-queue", itemId };
    }
    const eligibility = validateItemEligibility(project, itemId);
    if (eligibility) return { ok: false, reason: eligibility, itemId };
    const unitPrice = resolveSellPrice(project, itemId);
    if (!isNonNegativeInteger(unitPrice) || unitPrice > GOLD_MAX) {
      return { ok: false, reason: "invalid-price", itemId };
    }
    const subtotal = Math.min(GOLD_MAX, unitPrice * count);
    total = Math.min(GOLD_MAX, total + subtotal);
    entries.push({ itemId, count, unitPrice, subtotal });
  }

  const currentGold = isNonNegativeInteger(session.gold) ? Math.min(GOLD_MAX, session.gold) : 0;
  const credited = Math.min(total, GOLD_MAX - currentGold);
  const settlement: ShippingSettlement = { dayKey: normalizedDayKey, entries, total, credited };
  const limit = shippingHistoryLimit(project);

  session.gold = currentGold + credited;
  session.shippingQueue = {};
  session.shippingLastSettledDayKey = normalizedDayKey;
  session.shippingHistory = [...(session.shippingHistory ?? []), settlement].slice(-limit);
  return { ok: true, dayKey: normalizedDayKey, entries, total, credited };
}

export function shippingHistoryLimit(project: Project): number {
  const value = project.system.shipping?.historyLimit;
  if (!isPositiveInteger(value)) return DEFAULT_HISTORY_LIMIT;
  return Math.min(MAX_HISTORY_LIMIT, value);
}

function shippingEnabled(project: Project): boolean {
  return project.system.shipping?.enabled === true;
}

function validateItemEligibility(project: Project, itemId: string): "unknown-item" | "item-not-allowed" | undefined {
  if (!project.database.items.some((item) => item.id === itemId) || resolveSellPrice(project, itemId) === undefined) {
    return "unknown-item";
  }
  const allowed = project.system.shipping?.allowedItemIds;
  if (allowed !== undefined && !allowed.includes(itemId)) return "item-not-allowed";
  return undefined;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
