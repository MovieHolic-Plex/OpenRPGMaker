import type { ItemRecord } from "@/project/types";
import { isItemQuantity, resolveItemQuantity } from "@/project/itemQuantities";

export type ItemTransitionState = {
  readonly inventory: Readonly<Record<string, number>>;
  readonly itemUseCharges?: Readonly<Record<string, number>>;
};

export type ItemTransitionAction =
  | { readonly kind: "grant"; readonly itemId: string; readonly amount: number }
  | { readonly kind: "remove"; readonly itemId: string; readonly amount: number }
  | { readonly kind: "assign"; readonly itemId: string; readonly count: number }
  | { readonly kind: "successfulUse"; readonly itemId: string }
  | { readonly kind: "normalize" };

export type ItemTransitionResult = {
  readonly inventory: Record<string, number>;
  readonly itemUseCharges: Record<string, number>;
};

/**
 * Pure authority for inventory counts and per-copy finite-use cursors.
 * A cursor always belongs to the oldest (FIFO) copy; newer copies form an
 * uncharged tail.
 */
export function transitionItemState(
  state: ItemTransitionState,
  items: readonly ItemRecord[],
  action: ItemTransitionAction
): ItemTransitionResult {
  return transitionItemStates(state, items, [action]);
}

export function transitionItemStates(
  state: ItemTransitionState,
  items: readonly ItemRecord[],
  actions: readonly ItemTransitionAction[]
): ItemTransitionResult {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const normalizeWithItems = itemById.size > 0 || actions.some((action) => action.kind === "normalize");
  const result = normalizeWithItems ? normalizeItemState(state, itemById) : sanitizeItemState(state);

  for (const action of actions) {
    applyItemTransition(result, itemById, action);
  }
  return result;
}

function applyItemTransition(
  state: ItemTransitionResult,
  itemById: ReadonlyMap<string, ItemRecord>,
  action: ItemTransitionAction
): void {
  if (action.kind === "normalize") return;
  const item = itemById.get(action.itemId);
  const current = state.inventory[action.itemId] ?? 0;

  if (action.kind === "grant") {
    const next = resolveItemQuantity(current, "+=", action.amount);
    if (next !== undefined) setInventoryCount(state.inventory, action.itemId, next);
    return;
  }

  if (action.kind === "remove") {
    const next = resolveItemQuantity(current, "-=", action.amount);
    if (next === undefined) return;
    const removed = current - next;
    const unchargedTail = Math.max(0, current - (state.itemUseCharges[action.itemId] === undefined ? 0 : 1));
    const removedChargedCopy = removed > unchargedTail;
    setInventoryCount(state.inventory, action.itemId, next);
    if (removedChargedCopy) delete state.itemUseCharges[action.itemId];
    return;
  }

  if (action.kind === "assign") {
    const next = resolveItemQuantity(current, "=", action.count);
    if (next === undefined) return;
    setInventoryCount(state.inventory, action.itemId, next);
    if (next === 0) delete state.itemUseCharges[action.itemId];
    return;
  }

  if (!item || current === 0 || !item.consumable) return;
  const limit = finiteLimit(item);
  if (limit === undefined) {
    setInventoryCount(state.inventory, item.id, current - 1);
    delete state.itemUseCharges[item.id];
    return;
  }

  const nextCharge = (state.itemUseCharges[item.id] ?? 0) + 1;
  if (nextCharge >= limit) {
    setInventoryCount(state.inventory, item.id, current - 1);
    delete state.itemUseCharges[item.id];
  } else {
    state.itemUseCharges[item.id] = nextCharge;
  }
}

export function normalizeItemTransitionState(
  state: ItemTransitionState,
  items: readonly ItemRecord[]
): ItemTransitionResult {
  return transitionItemState(state, items, { kind: "normalize" });
}

function sanitizeItemState(state: ItemTransitionState): ItemTransitionResult {
  const inventory: Record<string, number> = Object.create(null);
  for (const [itemId, count] of Object.entries(state.inventory)) {
    const normalizedCount = nonnegativeInteger(count);
    if (normalizedCount > 0) inventory[itemId] = normalizedCount;
  }
  const itemUseCharges: Record<string, number> = Object.create(null);
  for (const [itemId, charge] of Object.entries(state.itemUseCharges ?? {})) {
    if (Number.isInteger(charge) && charge > 0) itemUseCharges[itemId] = charge;
  }
  return { inventory, itemUseCharges };
}

function normalizeItemState(
  state: ItemTransitionState,
  itemById: ReadonlyMap<string, ItemRecord>
): ItemTransitionResult {
  const inventory: Record<string, number> = Object.create(null);
  for (const [itemId, count] of Object.entries(state.inventory)) {
    const normalizedCount = nonnegativeInteger(count);
    if (normalizedCount > 0) inventory[itemId] = normalizedCount;
  }

  const itemUseCharges: Record<string, number> = Object.create(null);
  for (const [itemId, rawCharge] of Object.entries(state.itemUseCharges ?? {})) {
    if (!Number.isInteger(rawCharge) || rawCharge <= 0) continue;
    const item = itemById.get(itemId);
    const limit = item && finiteLimit(item);
    let count = inventory[itemId] ?? 0;
    if (!item || !item.consumable || limit === undefined || count === 0) continue;

    const consumed = Math.min(count, Math.floor(rawCharge / limit));
    count -= consumed;
    setInventoryCount(inventory, itemId, count);
    const remainder = rawCharge % limit;
    if (count > 0 && remainder > 0) itemUseCharges[itemId] = remainder;
  }
  return { inventory, itemUseCharges };
}

function finiteLimit(item: ItemRecord): number | undefined {
  return item.consumptionLimit === 1 || item.consumptionLimit === 2 || item.consumptionLimit === 3
    || item.consumptionLimit === 4 || item.consumptionLimit === 5
    ? item.consumptionLimit
    : undefined;
}

function positiveInteger(value: number): number {
  if (!isItemQuantity(value)) return 0;
  return value;
}

function nonnegativeInteger(value: number): number {
  return positiveInteger(value);
}

function setInventoryCount(inventory: Record<string, number>, itemId: string, count: number): void {
  if (count > 0) inventory[itemId] = count;
  else delete inventory[itemId];
}
