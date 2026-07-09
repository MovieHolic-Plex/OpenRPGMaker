import { updateDatabaseRecord } from "@/editor/databaseActions";
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { store } from "@/project/store";
import type { ActorRecord } from "@/project/types";

type ActorResourceField = "battleCharacterResourceId" | "characterResourceId" | "faceResourceId";

export function openActorResourceDialog(record: ActorRecord, field: ActorResourceField, rerender: () => void): void {
  const current = store.getCurrent().database.actors.find((entry) => entry.id === record.id) ?? record;
  const kind = kindForField(field);
  openDatabaseResourcePickerDialog({
    kind,
    title: dialogTitle(kind),
    currentId: current[field],
    currentFaceIndex: current.faceIndex ?? 0,
    currentCharacterIndex: current.characterIndex ?? 0,
    testidPrefix: "db-actor-resource-dialog",
    onConfirm: (result) => {
      if (field === "faceResourceId") {
        updateDatabaseRecord("actors", record.id, {
          faceResourceId: result.resourceId || undefined,
          faceIndex: result.faceIndex,
        });
      } else if (field === "characterResourceId") {
        updateDatabaseRecord("actors", record.id, {
          characterResourceId: result.resourceId || undefined,
          characterIndex: result.characterIndex,
        });
      } else {
        updateDatabaseRecord("actors", record.id, {
          battleCharacterResourceId: result.resourceId || undefined,
        });
      }
      rerender();
    },
  });
}

function kindForField(field: ActorResourceField): "faceset" | "charset" | "battleCharset" {
  if (field === "faceResourceId") return "faceset";
  if (field === "characterResourceId") return "charset";
  return "battleCharset";
}

function dialogTitle(kind: "faceset" | "charset" | "battleCharset"): string {
  if (kind === "faceset") return "얼굴 리소스";
  if (kind === "charset") return "캐릭터셋 리소스";
  return "배틀 캐릭터 리소스";
}
