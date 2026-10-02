import type { ItemRecord } from "../types";
import { normalizeItemRecord } from "../databaseRecordModel";
import catalog from "./sharedItemCatalog.json";

export const DEFAULT_SHARED_ITEM_COUNT = 1000;

/** Called only by the new-project seed. Loading a project never restores deleted rows. */
export function expandDefaultItemCatalog(base: readonly ItemRecord[]): ItemRecord[] {
  const records = [...base];
  const ids = new Set(records.map((record) => record.id));
  const authored = catalog as unknown as readonly (Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">)[];
  for (const input of authored) {
    if (records.length >= DEFAULT_SHARED_ITEM_COUNT) break;
    if (ids.has(input.id)) continue;
    records.push(normalizeItemRecord(input));
    ids.add(input.id);
  }
  if (records.length !== DEFAULT_SHARED_ITEM_COUNT) {
    throw new Error(`Shared item seed requires ${DEFAULT_SHARED_ITEM_COUNT} records; found ${records.length}`);
  }
  return records;
}
