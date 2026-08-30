/** Shared upper bound for player gold and persisted shop economy ledgers. */
export const GOLD_MAX = 9_999_999;

export type ShopTradeCount = {
  readonly sold: number;
  readonly bought: number;
};

export function isSafeEconomyValue(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= GOLD_MAX;
}

export function normalizeEconomyValue(value: unknown, fallback = 0): number {
  if (isSafeEconomyValue(value)) return value;
  return isSafeEconomyValue(fallback) ? fallback : 0;
}

export function economyValueOrUndefined(value: unknown): number | undefined {
  return isSafeEconomyValue(value) ? value : undefined;
}

export function isSafeEconomyRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isSafeEconomyValue);
}

export function sanitizeEconomyRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const sanitized: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (isSafeEconomyValue(amount)) sanitized[key] = amount;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function isSafeShopTradeCountsRecord(value: unknown): value is Record<string, ShopTradeCount> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((counts) =>
    isRecord(counts) && isSafeEconomyValue(counts.sold) && isSafeEconomyValue(counts.bought));
}

export function sanitizeShopTradeCounts(value: unknown): Record<string, ShopTradeCount> | undefined {
  if (!isRecord(value)) return undefined;
  const sanitized: Record<string, ShopTradeCount> = {};
  for (const [key, counts] of Object.entries(value)) {
    if (!isRecord(counts) || !isSafeEconomyValue(counts.sold) || !isSafeEconomyValue(counts.bought)) continue;
    sanitized[key] = { sold: counts.sold, bought: counts.bought };
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}


export type ShopHaggleVisitState = {
  readonly patience: number;
  readonly drift: number;
  readonly attemptIndex: number;
  readonly broken?: boolean;
};

export function sanitizeShopHaggleState(value: unknown): Record<string, ShopHaggleVisitState> | undefined {
  if (!isRecord(value)) return undefined;
  const sanitized: Record<string, ShopHaggleVisitState> = {};
  for (const [key, row] of Object.entries(value)) {
    if (!isRecord(row)) continue;
    if (!isSafeEconomyValue(row.patience) || !isSafeSignedLedger(row.drift) || !isSafeEconomyValue(row.attemptIndex)) continue;
    const next: ShopHaggleVisitState = {
      patience: row.patience,
      drift: row.drift,
      attemptIndex: row.attemptIndex,
      ...(row.broken === true ? { broken: true } : {}),
    };
    sanitized[key] = next;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeShopShelf(value: unknown): Record<string, Record<string, number>> | undefined {
  if (!isRecord(value)) return undefined;
  const sanitized: Record<string, Record<string, number>> = {};
  for (const [shopKey, shelf] of Object.entries(value)) {
    const inner = sanitizeEconomyRecord(shelf);
    if (inner) sanitized[shopKey] = inner;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function isSafeSignedLedger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= GOLD_MAX;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
