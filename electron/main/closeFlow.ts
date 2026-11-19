export type CloseSaveMode = "auto" | "save";

/** The renderer owns the dirty state, including edits made while a flush was in flight. */
export async function flushProjectForClose(project: {
  hasUnsavedChanges(): boolean;
  flush(): Promise<unknown>;
}): Promise<boolean> {
  if (project.hasUnsavedChanges()) {
    try {
      await project.flush();
    } catch (error) {
      console.error("[store] 닫기 전 저장 실패:", error);
    }
  }
  return !project.hasUnsavedChanges();
}

export function decideAfterCloseFlush(mode: CloseSaveMode, ok: unknown): "close" | "confirm" | "report-failure" {
  if (ok === true) return "close";
  return mode === "auto" ? "confirm" : "report-failure";
}

export function decideCloseResponse(response: number): "save" | "discard" | "cancel" {
  if (response === 0) return "save";
  if (response === 1) return "discard";
  return "cancel";
}
