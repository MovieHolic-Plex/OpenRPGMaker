import type { Project } from "@/project/types";
import type { MapEditHistoryEntry } from "@/editor/mapEditHistory";
export interface HistoryAccess {
  entries(): readonly MapEditHistoryEntry[];
  previous(steps: number): Project | null;
}
let editorHistory: HistoryAccess | undefined;
export function installEditorHistory(access: HistoryAccess): void { editorHistory = access; }
export function readEditorHistory(): HistoryAccess {
  if (!editorHistory) throw new Error("Editor history is unavailable in this execution host");
  return editorHistory;
}
