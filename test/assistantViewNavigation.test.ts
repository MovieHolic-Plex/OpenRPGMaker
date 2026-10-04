import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAssistantViewNavigation } from "@/editor/assistantViewNavigation";
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { editorState } from "@/editor/editorState";
import { navigateToEditorReference } from "@/editor/editorReferenceNavigation";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankMap } from "@/project/defaults";
import { store } from "@/project/store";

let requests: CameraFocusTarget[];
let unsubscribe: () => void;
const other = { mapId: "m2", x: 6, y: 9, w: 1, h: 1 };

beforeEach(() => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createEmptyToolProject();
  for (const id of ["m1", "m2"]) project.maps[id] = { ...createBlankMap(id, 40, 30), id };
  project.startMapId = "m1";
  store.replace(project);
  editorState.set({ currentMapId: "m1", selection: null });
  requests = [];
  unsubscribe = subscribeEditorCameraFocus(target => requests.push(target));
});

afterEach(() => { unsubscribe(); vi.restoreAllMocks(); });

describe("request-local assistant navigation", () => {
  it("blocks unsolicited focus and interview highlights, including other maps", () => {
    const navigate = createAssistantViewNavigation(() => false);
    navigate("focus_editor_view", other);
    navigate("highlight_map_region", other);
    navigate("highlight_map_region", { ...other, mapId: "m1" });
    expect(editorState.get().currentMapId).toBe("m1");
    expect(editorState.get().selection).toBeNull();
    expect(requests).toEqual([]);
  });

  it("locates the requested place once without enabling subsequent automatic moves", () => {
    const navigate = createAssistantViewNavigation(() => true);
    expect(navigate("focus_editor_view", other)).toBe(true);
    expect(editorState.get().currentMapId).toBe("m2");
    navigate("focus_editor_view", { ...other, mapId: "m1" });
    expect(editorState.get().currentMapId).toBe("m2");
    expect(requests).toHaveLength(1);
  });

  it("drops a background location request and does not replay it on focus", () => {
    const navigate = createAssistantViewNavigation(() => true);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    navigate("focus_editor_view", other);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    navigate("focus_editor_view", other);
    expect(editorState.get().currentMapId).toBe("m1");
    expect(requests).toEqual([]);
  });

  it("does not allow a parallel map run or a cancelled run to navigate", () => {
    createAssistantViewNavigation(() => true, { background: true })("focus_editor_view", other);
    createAssistantViewNavigation(() => true, { signal: AbortSignal.abort() })("focus_editor_view", other);
    expect(requests).toEqual([]);
  });

  it("rejects malformed tool data before consuming location guidance", () => {
    const navigate = createAssistantViewNavigation(() => true);
    expect(navigate("focus_editor_view", { ...other, x: NaN })).toBe(false);
    expect(navigate("focus_editor_view", other)).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it("keeps direct answer-link navigation available after a blocked AI call", () => {
    createAssistantViewNavigation(() => false)("focus_editor_view", other);
    expect(navigateToEditorReference({ kind: "map", mapId: "m2" })).toBe(true);
    expect(editorState.get().currentMapId).toBe("m2");
  });
});
