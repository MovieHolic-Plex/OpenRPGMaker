import { updateDatabaseRecord } from "@/editor/databaseActions";
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { currentEnemy } from "@/editor/panels/databaseEnemyRecordSupport";
import type { EnemyRecord } from "@/project/types";

export function openGraphicDialog(record: EnemyRecord, rerender: () => void): void {
  const current = currentEnemy(record);
  openDatabaseResourcePickerDialog({
    kind: "monster",
    title: "적 그래픽",
    currentId: current.monsterResourceId,
    allowClear: true,
    testidPrefix: "db-enemy-graphic-dialog",
    onConfirm: (result) => {
      updateDatabaseRecord("enemies", record.id, {
        monsterResourceId: result.resourceId || undefined,
      });
      rerender();
    },
  });
}
