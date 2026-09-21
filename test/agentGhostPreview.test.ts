import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentGhostPreviewsForMap,
  appendAgentGhostPreviewForToolCall,
  buildGhostRevealSchedule,
  GHOST_WIPE_DURATION_MS,
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

  it("타일 diff 셀은 렌더러가 실제 타일을 그릴 수 있도록 after 타일 id와 맵 tilesetId를 실어 보낸다", () => {
    const base = projectWithMaps(blankMap("m1", 8, 8));
    const draft = structuredClone(base);
    draft.maps.m1.lowerTiles[3 + 2 * 8] = 77;
    draft.maps.m1.upperTiles[4 + 1 * 8] = 512;

    const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);
    const cells = previews[0]?.cells ?? [];

    expect(cells).toEqual([
      { x: 4, y: 1, layer: "upper", tilesetId: draft.maps.m1.tilesetId, tileId: 512 },
      { x: 3, y: 2, layer: "lower", tilesetId: draft.maps.m1.tilesetId, tileId: 77 },
    ]);
  });
});

// 좌→우 단일 와이프 계약: 변경 셀은 열(x) 단위로 한 번에 드러난다. 같은 열은 같은 시각,
// 열은 왼쪽에서 오른쪽으로, 총 길이는 셀 수와 무관하게 GHOST_WIPE_DURATION_MS 고정이다.
// 층 순서와 전체 길이를 검증한다.
describe("buildGhostRevealSchedule", () => {
  it("하위층을 먼저 공개하고 같은 층은 왼쪽에서 오른쪽으로 진행한다", () => {
    const schedule = buildGhostRevealSchedule([
      { x: 2, y: 1, layer: "lower" },
      { x: 0, y: 5, layer: "lower" },
      { x: 0, y: 1, layer: "upper" },
      { x: 1, y: 0, layer: "lower" },
    ]);

    expect(schedule.map((entry) => [entry.cell.x, entry.cell.y, entry.startMs])).toEqual([
      [0, 5, 0],
      [1, 0, GHOST_WIPE_DURATION_MS / 4],
      [2, 1, GHOST_WIPE_DURATION_MS / 2],
      [0, 1, GHOST_WIPE_DURATION_MS / 2],
    ]);
  });

  it("같은 좌표의 lower·upper·event도 층별 공개 시간을 갖는다", () => {
    const schedule = buildGhostRevealSchedule([
      { x: 1, y: 1, layer: "event" },
      { x: 1, y: 1, layer: "upper" },
      { x: 1, y: 1, layer: "lower" },
    ]);

    expect(schedule.map((entry) => entry.cell.layer)).toEqual(["lower", "upper", "event"]);
    expect(schedule.map((entry) => entry.startMs)).toEqual([0, GHOST_WIPE_DURATION_MS / 3, GHOST_WIPE_DURATION_MS * 2 / 3]);
    expect(schedule.map((entry) => entry.kind)).toEqual(["tile", "tile", "event"]);
  });

  it("셀이 아무리 많아도 와이프 총 길이는 고정 상한을 넘지 않는다", () => {
    const cells = Array.from({ length: 400 }, (_, index) => ({
      x: index % 20,
      y: Math.floor(index / 20),
      layer: "lower" as const,
    }));
    const schedule = buildGhostRevealSchedule(cells);

    expect(schedule).toHaveLength(400);
    expect(schedule[0].startMs).toBe(0);
    expect(schedule[schedule.length - 1].startMs).toBe(GHOST_WIPE_DURATION_MS);
    // 열 20개 → 인접 열 간격은 균등하다.
    const columnStarts = [...new Set(schedule.map((entry) => entry.startMs))];
    expect(columnStarts).toHaveLength(20);
    expect(columnStarts[1] - columnStarts[0]).toBeCloseTo(GHOST_WIPE_DURATION_MS / 19, 6);
  });

  it("빈 입력은 빈 스케줄이고 한 열에서도 층 순서는 유지된다", () => {
    expect(buildGhostRevealSchedule([])).toEqual([]);
    const singleColumn = buildGhostRevealSchedule([
      { x: 4, y: 2, layer: "event" },
      { x: 4, y: 7, layer: "lower" },
    ]);
    expect(singleColumn.map((entry) => entry.startMs)).toEqual([0, GHOST_WIPE_DURATION_MS / 2]);
    expect(singleColumn.map((entry) => entry.cell.y)).toEqual([7, 2]);
  });

  it("durationMs 로 와이프 길이를 바꿀 수 있고 셀 참조는 그대로 유지된다", () => {
    const first = { x: 0, y: 0, layer: "lower" as const, tileId: 12, tilesetId: "ts_a" };
    const schedule = buildGhostRevealSchedule([first, { x: 1, y: 0, layer: "lower" }, { x: 9, y: 9, layer: "event" }], {
      durationMs: 200,
    });

    // 와이프 선단은 공간을 지나간다 — 시각은 열 인덱스가 아니라 x 위치에 비례한다.
    expect(schedule.map((entry) => entry.startMs)).toEqual([0, 100 / 9, 200]);
    expect(schedule[0].cell).toBe(first);
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
