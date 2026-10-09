import type { PlaySession } from "@/project/session";

export const COLLECTION_COUNT_MAX = Number.MAX_SAFE_INTEGER;

export type CollectionProgress = {
  discovered: boolean;
  shippedCount: number;
  caughtCount: number;
  donated: boolean;
};

export function emptyCollectionProgress(): CollectionProgress {
  return { discovered: false, shippedCount: 0, caughtCount: 0, donated: false };
}

export function initializeCollections(inventory: Record<string, number>): Record<string, CollectionProgress> {
  const result: Record<string, CollectionProgress> = {};
  for (const [itemId, count] of Object.entries(inventory)) {
    if (Number.isSafeInteger(count) && count > 0) result[itemId] = { ...emptyCollectionProgress(), discovered: true };
  }
  return result;
}

export function markDiscovered(session: Pick<PlaySession, "collections">, itemId: string): boolean {
  if (!session.collections) return true;
  const current = validProgress(session.collections[itemId]);
  if (!current) return false;
  session.collections[itemId] = { ...current, discovered: true };
  return true;
}

export function canIncrementCollection(
  session: Pick<PlaySession, "collections">,
  itemId: string,
  field: "shippedCount" | "caughtCount",
  amount: number,
): boolean {
  if (!session.collections) return true;
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;
  const current = validProgress(session.collections[itemId]);
  return Boolean(current && current[field] <= COLLECTION_COUNT_MAX - amount);
}

export function incrementCollection(
  session: Pick<PlaySession, "collections">,
  itemId: string,
  field: "shippedCount" | "caughtCount",
  amount: number,
): boolean {
  if (!canIncrementCollection(session, itemId, field, amount)) return false;
  if (!session.collections) return true;
  const current = validProgress(session.collections[itemId])!;
  session.collections[itemId] = { ...current, discovered: true, [field]: current[field] + amount };
  return true;
}

export function canDonateCollection(session: Pick<PlaySession, "collections">, itemId: string): boolean {
  if (!session.collections) return true;
  return validProgress(session.collections[itemId]) !== undefined;
}

export function markDonated(session: Pick<PlaySession, "collections">, itemId: string): boolean {
  if (!canDonateCollection(session, itemId)) return false;
  if (!session.collections) return true;
  const current = validProgress(session.collections[itemId])!;
  session.collections[itemId] = { ...current, discovered: true, donated: true };
  return true;
}

export function collectionProgress(session: Pick<PlaySession, "collections">, itemId: string): CollectionProgress | undefined {
  return session.collections ? validProgress(session.collections[itemId]) : undefined;
}

export function validProgress(value: unknown): CollectionProgress | undefined {
  if (value === undefined) return emptyCollectionProgress();
  if (!isRecord(value) || typeof value.discovered !== "boolean" || typeof value.donated !== "boolean") return undefined;
  if (!validCount(value.shippedCount) || !validCount(value.caughtCount)) return undefined;
  return {
    discovered: value.discovered || value.donated || value.shippedCount > 0 || value.caughtCount > 0,
    shippedCount: value.shippedCount,
    caughtCount: value.caughtCount,
    donated: value.donated,
  };
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= COLLECTION_COUNT_MAX;
}
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
