import type { TileSelection } from "@/editor/editorState";

export const AI_SELECTION_CONTEXT_EVENT = "oprn:ai-selection-context";

export interface AiSelectionContextDetail {
  readonly focus?: boolean;
  readonly selection: TileSelection | null;
}

export function requestAiSelectionContext(selection: TileSelection | null, focus = true): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const detail: AiSelectionContextDetail = { focus, selection };
  let event: Event;
  if (typeof CustomEvent === "function") {
    event = new CustomEvent<AiSelectionContextDetail>(AI_SELECTION_CONTEXT_EVENT, { detail });
  } else {
    event = new Event(AI_SELECTION_CONTEXT_EVENT);
    Object.defineProperty(event, "detail", { configurable: true, value: detail });
  }
  window.dispatchEvent(event);
}

export function aiSelectionContextDetail(event: Event): AiSelectionContextDetail | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== "object" || detail === null) return null;
  const candidate = detail as Partial<AiSelectionContextDetail>;
  if (candidate.selection !== null && !isTileSelection(candidate.selection)) return null;
  return { focus: candidate.focus === false ? false : true, selection: candidate.selection ?? null };
}

function isTileSelection(value: unknown): value is TileSelection {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TileSelection>;
  return (
    typeof candidate.mapId === "string" &&
    Number.isInteger(candidate.x) &&
    Number.isInteger(candidate.y) &&
    Number.isInteger(candidate.width) &&
    Number.isInteger(candidate.height)
  );
}
