import { isUiInBackground } from "@/ai/yieldToUi";
import { focusEditorRegion, type EditorFocusRegion } from "./editorReferenceNavigation";

function focusRegion(data: unknown): EditorFocusRegion | null {
  if (!data || typeof data !== "object") return null;
  const region = data as Partial<EditorFocusRegion>;
  return typeof region.mapId === "string"
    && [region.x, region.y, region.w, region.h].every(value => typeof value === "number" && Number.isFinite(value))
    && region.w! > 0 && region.h! > 0 ? region as EditorFocusRegion : null;
}

/** One location-guidance action per user request. Workers cannot grant themselves navigation. */
export function createAssistantViewNavigation(allowed: () => boolean, options: {
  readonly background?: boolean;
  readonly signal?: AbortSignal;
} = {}) {
  let consumed = false;
  return (name: string, data: unknown): boolean => {
    if (name !== "focus_editor_view" && name !== "highlight_map_region") return false;
    const region = focusRegion(data);
    if (!region || options.signal?.aborted) return false;
    // Drop hidden/background requests; never queue a camera jump for returning to the app.
    if (options.background || isUiInBackground()) {
      consumed = true;
      return false;
    }
    const moveView = !consumed && allowed();
    const applied = focusEditorRegion(region, { moveView, highlight: true });
    if (moveView && applied) consumed = true;
    return applied;
  };
}
