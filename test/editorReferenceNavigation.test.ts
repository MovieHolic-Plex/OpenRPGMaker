import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { editorState } from "@/editor/editorState";
import { focusEditorRegion, navigateToEditorReference } from "@/editor/editorReferenceNavigation";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";

function merchant(): GameEvent {
  return {
    id: "ev_hana",
    x: 6,
    y: 9,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_hana_page_1",
        name: "상인 하나",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
}

function fixture(): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId];
  if (!start) throw new Error("blank project has no start map");
  start.name = "햇살 마을";
  start.events = [merchant()];
  const house = createBlankMap("상인 하나의 집", 20, 16);
  house.id = "map_house_interior_1";
  project.maps[house.id] = house;
  return project;
}

describe("editor reference navigation", () => {
  let cameraRequests: CameraFocusTarget[] = [];
  let highlights: AgentFocusTarget[] = [];
  let unsubscribe: (() => void)[] = [];
  let project: Project;

  beforeEach(() => {
    project = fixture();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
    cameraRequests = [];
    highlights = [];
    unsubscribe = [
      subscribeEditorCameraFocus((target) => cameraRequests.push(target)),
      subscribeAgentFocusHighlight((target) => highlights.push(target)),
    ];
  });

  afterEach(() => {
    for (const off of unsubscribe) off();
    unsubscribe = [];
  });

  it("opens the map for a map reference without moving the camera", () => {
    expect(navigateToEditorReference({ kind: "map", mapId: "map_house_interior_1" })).toBe(true);

    expect(editorState.get().currentMapId).toBe("map_house_interior_1");
    expect(cameraRequests).toEqual([]);
  });

  it("takes the user to the event tile and flashes a highlight there", () => {
    const ok = navigateToEditorReference({
      kind: "event",
      mapId: project.startMapId,
      eventId: "ev_hana",
      x: 6,
      y: 9,
    });

    expect(ok).toBe(true);
    expect(cameraRequests).toEqual([
      {
        mapId: project.startMapId,
        tileX: 6,
        tileY: 9,
        bounds: { x: 6, y: 9, width: 1, height: 1 },
      },
    ]);
    expect(highlights[0]?.bounds).toEqual({ x: 6, y: 9, width: 1, height: 1 });
  });

  it("다른 맵의 이벤트로 이동한 뒤 새 맵 기준 요청을 보낸다", () => {
    store.updateMap("map_house_interior_1", (map) => {
      map.events = [merchant()];
    });
    const house = store.getCurrent().maps.map_house_interior_1;
    if (!house) throw new Error("house map is missing");

    expect(navigateToEditorReference({
      kind: "event",
      mapId: house.id,
      eventId: "ev_hana",
      x: 6,
      y: 9,
    })).toBe(true);

    expect(editorState.get().currentMapId).toBe(house.id);
    expect(cameraRequests).toEqual([{
      mapId: house.id,
      tileX: 6,
      tileY: 9,
      bounds: { x: 6, y: 9, width: 1, height: 1 },
    }]);
    expect(highlights).toEqual([{
      mapId: house.id,
      cells: [],
      bounds: { x: 6, y: 9, width: 1, height: 1 },
      score: 1,
    }]);
  });

  it("모호한 대상은 찾기만 열고 이동 부작용을 만들지 않는다", () => {
    const beforeMapId = editorState.get().currentMapId;

    expect(navigateToEditorReference({ kind: "ambiguous", label: "여관", count: 2 })).toBe(true);

    expect(editorState.get().currentMapId).toBe(beforeMapId);
    expect(cameraRequests).toEqual([]);
    expect(highlights).toEqual([]);
  });

  it("화면 안의 대상도 항상 카메라를 움직인다", () => {
    focusEditorRegion({ mapId: project.startMapId, x: 2, y: 3, w: 4, h: 4 });

    // onlyIfOffscreen 이 붙으면 화면 안에 있는 대상에서 클릭이 아무 일도 하지 않는다.
    expect(cameraRequests[0]?.onlyIfOffscreen).toBeUndefined();
    expect(cameraRequests[0]?.bounds).toEqual({ x: 2, y: 3, width: 4, height: 4 });
  });

  it("clamps a region that runs past the map edge", () => {
    focusEditorRegion({ mapId: "map_house_interior_1", x: 18, y: 15, w: 10, h: 10 });

    expect(cameraRequests[0]?.bounds).toEqual({ x: 18, y: 15, width: 2, height: 1 });
  });

  it("reports failure for a map or event that is gone, and changes nothing", () => {
    const beforeMapId = editorState.get().currentMapId;

    expect(navigateToEditorReference({ kind: "map", mapId: "map_missing" })).toBe(false);
    expect(navigateToEditorReference({ kind: "event", mapId: project.startMapId, eventId: "ev_gone", x: 1, y: 1 })).toBe(false);
    expect(focusEditorRegion({ mapId: "map_missing", x: 0, y: 0, w: 1, h: 1 })).toBe(false);

    expect(editorState.get().currentMapId).toBe(beforeMapId);
    expect(cameraRequests).toEqual([]);
    expect(highlights).toEqual([]);
  });

  it("keeps the event selection when focusing a region so the editor does not lose context", () => {
    editorState.set({ selectedEventId: "ev_hana" });

    focusEditorRegion({ mapId: project.startMapId, x: 6, y: 9, w: 1, h: 1 });

    expect(editorState.get().selectedEventId).toBe("ev_hana");
  });
});
