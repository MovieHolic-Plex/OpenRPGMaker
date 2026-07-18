import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentGhostPreviewsForMap,
  appendAgentGhostPreviewForToolCall,
  clearAgentGhostPreview,
  createThrottledAgentGhostPreviewUpdater,
  getAgentGhostPreviewState,
  replaceAgentGhostPreviewFromProjectDiff,
  subscribeAgentGhostPreview,
  summarizeAgentGhostPreviewForProjectDiff,
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
  vi.useRealTimers();
});

describe("agent ghost preview area extraction", () => {
  it("canonical house and nested village targets produce ghost bounds", () => {
    // Given: one existing exterior map and canonical construction calls.
    const project = projectWithMaps(blankMap("m1", 30, 24));

    // When: the ghost layer summarizes canonical requests.
    const house = summarizeAgentGhostPreviewForToolCall(project, "author_house", {
      kind: "single", mapId: "m1", wings: [{ x: 3, y: 4, w: 8, h: 7 }],
    });
    const village = summarizeAgentGhostPreviewForToolCall(project, "author_village", {
      target: { kind: "existing", mapId: "m1", bounds: { x: 2, y: 3, w: 20, h: 18 } },
      houseCount: 6,
      countPolicy: "exact",
    });

    // Then: both official front doors preview their exact target on the same map.
    expect(house).toHaveLength(1);
    expect(house[0]).toMatchObject({
      mapId: "m1", toolName: "author_house", bounds: { x: 3, y: 4, width: 8, height: 7 },
    });
    expect(village).toHaveLength(1);
    expect(village[0]).toMatchObject({
      mapId: "m1", toolName: "author_village", bounds: { x: 2, y: 3, width: 20, height: 18 },
    });
  });

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

describe("agent ghost preview live draft diff", () => {
  it("성공한 쓰기 tool_call을 150ms 스로틀 뒤 현재 draft diff 프리뷰로 갱신한다", () => {
    vi.useFakeTimers();
    const base = projectWithMaps(blankMap("m1", 8, 8));
    const draft = structuredClone(base);
    draft.maps.m1.lowerTiles[3 + 2 * 8] = 77;
    let applied = 0;
    const updater = createThrottledAgentGhostPreviewUpdater({
      getBaseProject: () => base,
      getDraftProject: () => draft,
      isWriteTool: (toolName) => toolName === "paint_tiles",
      apply: (before, after) => {
        applied += 1;
        replaceAgentGhostPreviewFromProjectDiff(before, after);
      },
    });

    updater.handleToolCall({ type: "tool_call", name: "paint_tiles", result: { ok: true } });
    updater.handleToolCall({ type: "tool_call", name: "get_project_summary", result: { ok: true } });
    updater.handleToolCall({ type: "tool_call", name: "paint_tiles", result: { ok: false } });

    expect(applied).toBe(0);
    expect(getAgentGhostPreviewState().previews).toEqual([]);

    vi.advanceTimersByTime(149);
    expect(applied).toBe(0);

    vi.advanceTimersByTime(1);

    expect(applied).toBe(1);
    expect(getAgentGhostPreviewState().previews).toHaveLength(1);
    expect(getAgentGhostPreviewState().previews[0]).toMatchObject({
      mapId: "m1",
      toolName: "live_project_diff",
      cells: [{ x: 3, y: 2, layer: "lower" }],
    });
  });

  it("프로젝트 diff 요약은 이벤트 이동의 이전/새 위치를 함께 표시한다", () => {
    const baseMap = blankMap("m1", 8, 8);
    baseMap.events.push({ id: "ev_1", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [] });
    const base = projectWithMaps(baseMap);
    const draft = structuredClone(base);
    draft.maps.m1.events[0].x = 5;
    draft.maps.m1.events[0].y = 4;

    const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);

    expect(previews).toHaveLength(1);
    expect(previews[0]?.bounds).toEqual({ x: 1, y: 1, width: 5, height: 4 });
    expect(previews[0]?.cells).toEqual([
      { x: 5, y: 4, layer: "event" },
      { x: 1, y: 1, layer: "event" },
    ]);
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
