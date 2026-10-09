// 자동 적용은 맵·카메라를 유지한다. 사람이 미리보기 버튼을 직접 누른 경우만 이동한다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { focusAcceptedAgentChanges, subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { createBlankMap } from "@/project/defaults";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

let unsubscribeHighlight: (() => void) | null = null;
let unsubscribeCamera: (() => void) | null = null;
let highlights: AgentFocusTarget[] = [];
let cameraRequests: CameraFocusTarget[] = [];

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  highlights = [];
  cameraRequests = [];
  unsubscribeHighlight = subscribeAgentFocusHighlight((target) => highlights.push(target));
  unsubscribeCamera = subscribeEditorCameraFocus((target) => cameraRequests.push(target));
  editorState.set({ currentMapId: null, selection: null, layer: "lower", tool: "paint" });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  unsubscribeHighlight?.();
  unsubscribeCamera?.();
  unsubscribeHighlight = null;
  unsubscribeCamera = null;
  vi.restoreAllMocks();
});

function projectWithMap(width: number, height: number): Project {
  const project = createEmptyToolProject();
  project.maps["m1"] = createBlankMap("m1", width, height);
  project.startMapId = "m1";
  return project;
}

describe("사용자가 직접 요청한 변경 위치 이동", () => {
  it("변경 bbox 중심을 화면 밖일 때만 이동하도록 요청한다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    const after = structuredClone(before);
    // (20,10) 한 칸만 바꾼다.
    after.maps["m1"].lowerTiles[10 * 40 + 20] = 77;

    const target = focusAcceptedAgentChanges(before, after, { follow: true });
    expect(target?.bounds).toEqual({ x: 20, y: 10, width: 1, height: 1 });
    expect(highlights).toHaveLength(1);
    expect(cameraRequests).toHaveLength(1);
    expect(cameraRequests[0]).toEqual({
      mapId: "m1",
      // bbox 의 정확한 중심(분수) — 내림하면 짝수 크기에서 반 타일(8px)이 밀린다.
      tileX: 20.5,
      tileY: 10.5,
      bounds: { x: 20, y: 10, width: 1, height: 1 },
      onlyIfOffscreen: true,
    });
  });

  it("넓은 변경은 bbox 중심으로 요청한다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    const after = structuredClone(before);
    for (let y = 4; y < 12; y += 1) {
      for (let x = 6; x < 16; x += 1) after.maps["m1"].lowerTiles[y * 40 + x] = 5;
    }

    focusAcceptedAgentChanges(before, after, { follow: true });
    expect(cameraRequests).toHaveLength(1);
    expect(cameraRequests[0].bounds).toEqual({ x: 6, y: 4, width: 10, height: 8 });
    expect(cameraRequests[0].tileX).toBe(11);
    expect(cameraRequests[0].tileY).toBe(8);
  });

  it("변경이 없으면 하이라이트도 카메라 요청도 없다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    const after = structuredClone(before);

    expect(focusAcceptedAgentChanges(before, after)).toBeNull();
    expect(highlights).toHaveLength(0);
    expect(cameraRequests).toHaveLength(0);
  });

  it("자동 적용은 같은 맵의 화면 밖 변경도 따라가지 않는다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    editorState.set({ currentMapId: "m1", zoom: 2 });
    const view = editorState.get();
    const after = structuredClone(before);
    after.maps.m1.lowerTiles[20 * 40 + 35] = 77;
    focusAcceptedAgentChanges(before, after);
    expect(cameraRequests).toEqual([]);
    expect(editorState.get()).toEqual(view);
    expect(highlights).toHaveLength(1);
  });

  it("새 맵을 만들거나 다른 맵을 고쳐도 현재 맵을 유지한다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    editorState.set({ currentMapId: "m1" });
    const after = structuredClone(before);
    after.maps.m2 = { ...createBlankMap("m2", 20, 20), id: "m2" };
    store.replace(after);
    focusAcceptedAgentChanges(before, after);
    expect(editorState.get().currentMapId).toBe("m1");
    expect(cameraRequests).toEqual([]);
    expect(highlights).toEqual([]);
  });

  it("앱이 백그라운드면 강조·이동 요청을 남기지 않는다", () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    const before = projectWithMap(40, 30);
    store.replace(before);
    const after = structuredClone(before);
    after.maps.m1.lowerTiles[15] = 77;
    focusAcceptedAgentChanges(before, after);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    expect(cameraRequests).toEqual([]);
    expect(highlights).toEqual([]);
  });
});
