import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  agentGhostPreviewsForMap,
  appendAgentGhostPreviewForToolCall,
  clearAgentGhostPreview,
  getAgentGhostPreviewState,
  subscribeAgentGhostPreview,
  summarizeAgentGhostPreviewForToolCall,
  type AgentGhostPreviewState,
} from "@/editor/agentGhostPreview";
import { createBlankMap } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

beforeEach(() => {
  clearAgentGhostPreview();
});

afterEach(() => {
  clearAgentGhostPreview();
});

describe("agent ghost preview area extraction", () => {
  it("paint_tiles rect 호출을 lower 페인트 영역으로 요약한다", () => {
    const project = projectWithMaps(blankMap("m1", 12, 10));

    const previews = summarizeAgentGhostPreviewForToolCall(project, "paint_tiles", {
      mapId: "m1",
      layer: "lower",
      mode: "rect",
      tile: 4,
      from: { x: 2, y: 3 },
      to: { x: 5, y: 4 },
    });

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      mapId: "m1",
      toolName: "paint_tiles",
      bounds: { x: 2, y: 3, width: 4, height: 2 },
    });
    expect(previews[0]?.cells).toHaveLength(8);
    expect(new Set(previews[0]?.cells.map((cell) => cell.layer))).toEqual(new Set(["lower"]));
  });

  it("place_npc 호출을 이벤트 셀로 요약하고 현재 맵 필터링에 걸린다", () => {
    const m1 = blankMap("m1", 10, 10);
    const m2 = blankMap("m2", 10, 10);
    const project = projectWithMaps(m1, m2);

    appendAgentGhostPreviewForToolCall(project, "place_npc", {
      mapId: "m2",
      x: 4,
      y: 6,
      name: "주민",
      pages: [{ lines: ["안녕"] }],
    });
    const state = getAgentGhostPreviewState();

    expect(agentGhostPreviewsForMap(state, "m1")).toEqual([]);
    expect(agentGhostPreviewsForMap(state, "m2")).toHaveLength(1);
    expect(agentGhostPreviewsForMap(state, "m2")[0]).toMatchObject({
      bounds: { x: 4, y: 6, width: 1, height: 1 },
      cells: [{ x: 4, y: 6, layer: "event" }],
    });
  });

  it("move_event 호출은 기존 위치와 새 위치를 함께 묶는다", () => {
    const map = blankMap("m1", 12, 12);
    map.events.push({ id: "ev_old", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [] });
    const project = projectWithMaps(map);

    const previews = summarizeAgentGhostPreviewForToolCall(project, "move_event", {
      mapId: "m1",
      eventId: "ev_old",
      x: 7,
      y: 4,
    });

    expect(previews).toHaveLength(1);
    expect(previews[0]?.bounds).toEqual({ x: 2, y: 2, width: 6, height: 3 });
    expect(previews[0]?.cells).toEqual([
      { x: 7, y: 4, layer: "event" },
      { x: 2, y: 2, layer: "event" },
    ]);
  });

  it("resize_map 확장은 기존 맵 밖의 추가 경계를 표시한다", () => {
    const project = projectWithMaps(blankMap("m1", 10, 8));

    const previews = summarizeAgentGhostPreviewForToolCall(project, "resize_map", {
      mapId: "m1",
      width: 12,
      height: 10,
    });

    expect(previews.map((preview) => preview.bounds)).toEqual([
      { x: 10, y: 0, width: 2, height: 10 },
      { x: 0, y: 8, width: 12, height: 2 },
    ]);
  });
});

describe("agent ghost preview proposal lifecycle", () => {
  it("수락/거부 결정에서 쓰는 clear가 누적 고스트를 제거하고 구독자에게 알린다", () => {
    const project = projectWithMaps(blankMap("m1", 8, 8));
    const seen: AgentGhostPreviewState[] = [];
    const unsubscribe = subscribeAgentGhostPreview((state) => seen.push(state));

    appendAgentGhostPreviewForToolCall(project, "clear_region", { mapId: "m1", x: 1, y: 1, w: 3, h: 2 });
    expect(getAgentGhostPreviewState().previews).toHaveLength(1);

    clearAgentGhostPreview();

    expect(getAgentGhostPreviewState().previews).toEqual([]);
    expect(seen.at(-1)?.previews).toEqual([]);
    unsubscribe();
  });
});

function blankMap(id: string, width: number, height: number): GameMap {
  const map = createBlankMap(id, width, height);
  map.id = id;
  map.name = id;
  return map;
}

function projectWithMaps(first: GameMap, ...rest: GameMap[]): Project {
  const project = createEmptyToolProject();
  project.maps = {};
  for (const map of [first, ...rest]) project.maps[map.id] = map;
  project.mapTree = { mapId: first.id, children: rest.map((map) => ({ mapId: map.id, children: [] })) };
  project.startMapId = first.id;
  project.startPos = { x: 1, y: 1 };
  return project;
}
