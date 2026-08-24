/** Maximum authored/runtime stack size for every item-moving subsystem. */
export const ITEM_QUANTITY_MAX = 9_999_999;

export type ItemQuantityOperation = {
  readonly itemId: string;
  readonly op: "=" | "+=" | "-=";
  readonly amount: number;
};

export function isItemQuantity(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= ITEM_QUANTITY_MAX;
}

export function isPositiveItemQuantity(value: unknown): value is number {
  return isItemQuantity(value) && value > 0;
}

/**
 * Resolves one legacy-compatible item operation without ever producing an
 * unsafe, negative, or over-cap stack. Subtraction keeps the historical
 * clamp-to-zero behavior; callers that require sufficient inventory precheck it.
 */
export function resolveItemQuantity(
  current: unknown,
  op: ItemQuantityOperation["op"],
  amount: unknown,
): number | undefined {
  if (!isItemQuantity(current) || !isItemQuantity(amount)) return undefined;
  if (op === "=") return amount;
  if (op === "-=") return Math.max(0, current - amount);
  const next = current + amount;
  return isItemQuantity(next) ? next : undefined;
}
