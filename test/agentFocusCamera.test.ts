// 수락된 변경에 하이라이트만 켜고 카메라를 두면, 변경 영역이 화면 밖일 때 사용자는
// "아무 일도 일어나지 않았다"고 본다. bbox 는 focusAcceptedAgentChanges 가 이미 계산하므로
// 같은 자리에서 카메라 요청까지 낸다 — 실제로 움직일지는 씬이 planCameraFocus 로 판정한다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});

afterEach(() => {
  unsubscribeHighlight?.();
  unsubscribeCamera?.();
  unsubscribeHighlight = null;
  unsubscribeCamera = null;
});

function projectWithMap(width: number, height: number): Project {
  const project = createEmptyToolProject();
  project.maps["m1"] = createBlankMap("m1", width, height);
  project.startMapId = "m1";
  return project;
}

describe("focusAcceptedAgentChanges 가 카메라도 요청한다", () => {
  it("변경 bbox 중심을 화면 밖일 때만 이동하도록 요청한다", () => {
    const before = projectWithMap(40, 30);
    store.replace(before);
    const after = structuredClone(before);
    // (20,10) 한 칸만 바꾼다.
    after.maps["m1"].lowerTiles[10 * 40 + 20] = 77;

    const target = focusAcceptedAgentChanges(before, after);
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

    focusAcceptedAgentChanges(before, after);
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
});
