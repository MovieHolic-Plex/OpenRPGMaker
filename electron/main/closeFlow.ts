export type CloseSaveMode = "auto" | "save";

export function decideAfterCloseFlush(mode: CloseSaveMode, ok: unknown): "close" | "confirm" | "report-failure" {
  if (ok === true) return "close";
  return mode === "auto" ? "confirm" : "report-failure";
}

export function decideCloseResponse(response: number): "save" | "discard" | "cancel" {
  if (response === 0) return "save";
  if (response === 1) return "discard";
  return "cancel";
}
