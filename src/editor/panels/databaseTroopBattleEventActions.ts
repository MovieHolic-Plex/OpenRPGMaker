import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export function updateTroopBattleEventPage(
  record: TroopRecord,
  page: BattleEventPageRecord,
  patch: Partial<BattleEventPageRecord>
): void {
  const currentRecord = store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? record;
  updateDatabaseRecord("troops", record.id, {
    battleEventPages: currentRecord.battleEventPages.map((entry) => entry.id === page.id ? { ...entry, ...patch } : entry),
  });
}
