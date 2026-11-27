import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentGhostPreviewsForMap, appendAgentGhostPreviewForToolCall, buildGhostRevealSchedule, GHOST_WIPE_DURATION_MS, clearAgentGhostPreview, createThrottledAgentGhostPreviewUpdater, getAgentGhostPreviewState, replaceAgentGhostPreviewFromProjectDiff, subscribeAgentGhostPreview, summarizeAgentGhostPreviewForProjectDiff, summarizeAgentGhostPreviewForToolCall, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { createBlankMap } from "@/project/defaults";
import type { GameMap, Project, Command } from "@/project/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { findParentMapId, findTreeNode } from "@/project/mapTree";
import { projectLint } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("agentGhostPreview", () => {
  isolateTimers();
  beforeEach(() => {
    clearAgentGhostPreview();
  });
  afterEach(() => {
    clearAgentGhostPreview();
    vi.useRealTimers();
  });
  describe("agent ghost preview area extraction", () => {
    it("skips unchanged map objects and keeps the live diff id small", () => {
      const kept = blankMap("kept", 40, 30);
      const edited = blankMap("edited", 40, 30);
      const base = projectWithMaps(kept, edited);
      const same = projectWithMaps(kept, edited);
      expect(summarizeAgentGhostPreviewForProjectDiff(base, same)).toEqual([]);

      const changedTiles = edited.lowerTiles.slice();
      for (let index = 0; index < changedTiles.length; index += 3) changedTiles[index] = 4;
      const changed = { ...edited, lowerTiles: changedTiles };
      const draft = projectWithMaps(kept, changed);
      const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);
      expect(previews.map((preview) => preview.mapId)).toEqual(["edited"]);
      expect(previews[0]?.cells.length).toBeGreaterThan(100);
      expect(previews[0]?.id.length).toBeLessThan(400);
    });

    // Retired: author_house / author_village were removed from the tool registry and from agentGhostPreview.ts.

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
});

describe("aiEditorFullToolCoverage", () => {
  isolateTimers();
  function contextWithMap(): { context: ToolContext; mapId: string } {
    const context: ToolContext = { project: createEmptyToolProject("전체 편집기 툴 커버리지") };
    const root = runTool(context, "create_map", {
      id: "map_root",
      name: "루트 맵",
      width: 8,
      height: 8,
    });
    expect(root.ok, root.summary).toBe(true);
    const created = runTool(context, "create_map", {
      id: "map_source",
      name: "원본 맵",
      width: 12,
      height: 10,
    });
    expect(created.ok, created.summary).toBe(true);
    return { context, mapId: "map_source" };
  }
  describe("AI assistant editor-wide project mutation coverage", () => {
    it("duplicates a map with authored metadata and places the copy next to its source", () => {
      const { context, mapId } = contextWithMap();
      const source = context.project.maps[mapId];
      source.bgm = { mode: "custom", resourceId: "bgm_field", fadeInMs: 350 };
      source.background = { imageId: "easyrpg-backdrop-sky1", scrollX: 1, scrollY: -1 };
      source.disableSave = true;
      source.minimap = { enabled: true, corner: "topLeft", showEvents: true };
      source.cloudShadows = { enabled: true, opacity: 0.3, speed: 40, angleDeg: 200, scale: 1.5 };

      const result = runTool(context, "duplicate_map", {
        mapId,
        id: "map_copy",
        name: "복제된 맵",
      });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.maps.map_copy).toMatchObject({
        id: "map_copy",
        name: "복제된 맵",
        bgm: source.bgm,
        background: source.background,
        disableSave: true,
        minimap: source.minimap,
        cloudShadows: source.cloudShadows,
      });
      expect(findParentMapId(context.project.mapTree, "map_copy")).toBe(findParentMapId(context.project.mapTree, mapId));
    });

    it("edits every map property exposed by the map properties editor", () => {
      const { context, mapId } = contextWithMap();
      const tilesetId = Object.keys(context.project.tilesets).find((id) => id !== context.project.maps[mapId].tilesetId);
      expect(tilesetId).toBeDefined();

      const result = runTool(context, "set_map_properties", {
        mapId,
        name: "속성 완성 맵",
        tilesetId,
        bgm: { mode: "custom", resourceId: "bgm_dungeon", fadeInMs: 500 },
        background: { imageId: "easyrpg-backdrop-dawn1", scrollX: 2, scrollY: 0 },
        battleBackground: "battle_cave",
        flags: { disableSave: true, disableTeleport: true, disableEscape: false },
        minimap: { enabled: true, corner: "bottomRight", scale: 0.2, showEvents: false, fogOfWar: true },
        cloudShadows: { enabled: true, opacity: 0.4, speed: 52, angleDeg: 200, scale: 1.5 },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.diff?.mapPropertiesChanged).toBe(1);
      expect(context.project.maps[mapId]).toMatchObject({
        name: "속성 완성 맵",
        tilesetId,
        bgm: { mode: "custom", resourceId: "bgm_dungeon", fadeInMs: 500 },
        background: { imageId: "easyrpg-backdrop-dawn1", scrollX: 2, scrollY: 0 },
        battleBackground: "battle_cave",
        disableSave: true,
        disableTeleport: true,
        minimap: { enabled: true, corner: "bottomRight", scale: 0.2, showEvents: false, fogOfWar: true },
        cloudShadows: { enabled: true, opacity: 0.4, speed: 52, angleDeg: 200, scale: 1.5 },
      });
      expect(context.project.maps[mapId].disableEscape).toBeUndefined();
    });

    it("creates, renames, reparents, and dissolves map folders through one canonical facade", () => {
      const { context, mapId } = contextWithMap();
      const created = runTool(context, "manage_map_tree", {
        operation: "create_folder",
        folderId: "folder_story",
        name: "스토리 맵",
      });
      expect(created.ok, created.summary).toBe(true);

      const moved = runTool(context, "manage_map_tree", {
        operation: "move",
        mapId,
        parentId: "folder_story",
        index: 0,
      });
      expect(moved.ok, moved.summary).toBe(true);
      expect(findParentMapId(context.project.mapTree, mapId)).toBe("folder_story");

      const renamed = runTool(context, "manage_map_tree", {
        operation: "rename_folder",
        folderId: "folder_story",
        name: "1막",
      });
      expect(renamed.ok, renamed.summary).toBe(true);
      expect(findTreeNode(context.project.mapTree, "folder_story")).toMatchObject({ kind: "folder", name: "1막" });

      const dissolved = runTool(context, "manage_map_tree", {
        operation: "dissolve_folder",
        folderId: "folder_story",
      });
      expect(dissolved.ok, dissolved.summary).toBe(true);
      expect(findTreeNode(context.project.mapTree, "folder_story")).toBeNull();
      expect(findTreeNode(context.project.mapTree, mapId)).not.toBeNull();
    });

    it("duplicates and deletes database records through typed project tools", () => {
      const context: ToolContext = { project: createEmptyToolProject("DB 수명주기") };
      const inserted = runTool(context, "upsert_item", {
        item: { id: "item_seed", name: "씨앗", price: 20 },
      });
      expect(inserted.ok, inserted.summary).toBe(true);

      const duplicated = runTool(context, "duplicate_database_record", {
        collection: "items",
        id: "item_seed",
        newId: "item_seed_copy",
        name: "씨앗 사본",
      });
      expect(duplicated.ok, duplicated.summary).toBe(true);
      expect(context.project.database.items.find((item) => item.id === "item_seed_copy")).toMatchObject({ name: "씨앗 사본", price: 20 });

      const removed = runTool(context, "delete_database_record", {
        collection: "items",
        id: "item_seed",
      });
      expect(removed.ok, removed.summary).toBe(true);
      expect(context.project.database.items.some((item) => item.id === "item_seed")).toBe(false);
      expect(context.project.database.items.some((item) => item.id === "item_seed_copy")).toBe(true);
    });

    it("authors utility database records that have dedicated editor tabs", () => {
      const context: ToolContext = { project: createEmptyToolProject("유틸리티 DB") };

      const element = runTool(context, "upsert_database_utility", {
        collection: "elements",
        record: { id: "element_light", name: "빛", kind: "magical", damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      });
      const terrain = runTool(context, "upsert_database_utility", {
        collection: "terrains",
        record: {
          id: "terrain_swamp",
          name: "늪",
          damage: 3,
          encounterRatePercent: 140,
          characterDisplay: "normal",
          vehiclePassage: { boat: true, ship: false, airshipLand: false },
        },
      });
      const command = runTool(context, "upsert_database_utility", {
        collection: "battleCommands",
        record: { id: "command_capture", name: "포획", kind: "capture" },
      });

      expect(element.ok, element.summary).toBe(true);
      expect(terrain.ok, terrain.summary).toBe(true);
      expect(command.ok, command.summary).toBe(true);
      expect(context.project.database.elements?.find((record) => record.id === "element_light")?.kind).toBe("magical");
      expect(context.project.database.terrains?.find((record) => record.id === "terrain_swamp")?.damage).toBe(3);
      expect(context.project.database.battleCommands?.find((record) => record.id === "command_capture")?.kind).toBe("capture");
    });

    it("changes project identity, terms, display, resources, and battle defaults", () => {
      const context: ToolContext = { project: createEmptyToolProject("프로젝트 설정") };
      const actorId = context.project.database.actors[0]?.id;
      expect(actorId).toBeDefined();
      const enemy = runTool(context, "upsert_enemy", { enemy: { id: "enemy_settings", name: "설정용 적", monsterResourceId: "generated-enemy-orc-01" } });
      const troop = runTool(context, "upsert_troop", { troop: { id: "troop_settings", name: "설정용 적 그룹", enemyIds: ["enemy_settings"] } });
      expect(enemy.ok, enemy.summary).toBe(true);
      expect(troop.ok, troop.summary).toBe(true);
      const troopId = "troop_settings";
      expect(troopId).toBeDefined();

      const previousDefaultBgm = context.project.system.defaultBgmResourceId;
      const previousBattleBgm = context.project.system.battleBgmResourceId;

      const result = runTool(context, "set_project_settings", {
        title: "별빛 연대기",
        author: "AI 조수",
        terms: { attack: "타격", gold: "별가루" },
        playResolution: { width: 640, height: 360 },
        resources: { defaultBgmResourceId: previousBattleBgm, battleBgmResourceId: previousDefaultBgm },
        battle: { flow: "strict", uiStyle: "pokemon", activeSlots: 2, initialTroopId: troopId },
        startActorIds: [actorId],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.meta).toMatchObject({ title: "별빛 연대기", author: "AI 조수", terms: { attack: "타격", gold: "별가루" } });
      expect(context.project.system).toMatchObject({
        playResolution: { width: 640, height: 360 },
        defaultBgmResourceId: previousBattleBgm,
        battleBgmResourceId: previousDefaultBgm,
        battleFlow: "strict",
        // 전투 방식 하나가 화면과 규칙을 같이 정한다(project/battleMethod.ts).
        battleUiStyle: "pokemon",
        battleModel: "gen1",
        activeSlots: 2,
        initialTroopId: troopId,
        startActorIds: [actorId],
      });
    });
  });
});

// test/emberQuestToolReplay.test.ts
// Dogfooding: 잿불의 유산류 게임을 "툴 호출 시퀀스(JSON 배열)만으로" 빈 프로젝트에서 재구축한다.
// 검증: (a) 스펙 카운트(맵5/NPC12/몬스터5/아이템8/전투블로커5), (b) projectLint error 0,
//       (c) 주요 지점 도달성 통과. 타일 완전 일치는 요구하지 않는다.
describe("emberQuestToolReplay", () => {
  isolateTimers();
  interface ToolCall {
    readonly name: string;
    readonly args: Record<string, unknown>;
  }
  const MAP = {
    village: "m_village",
    forest: "m_forest",
    mine: "m_mine",
    pass: "m_pass",
    sanctum: "m_sanctum",
  } as const;
  const ITEM_IDS = ["it_potion", "it_ether", "it_antidote", "it_hipotion", "it_key", "it_talisman", "it_herb", "it_core"] as const;
  const ENEMY_IDS = ["en_slime", "en_bee", "en_bat", "en_golem", "en_dragon"] as const;
  const TROOPS: ReadonlyArray<{ id: string; name: string; enemy: string }> = [
    { id: "tr_slimes", name: "슬라임 무리", enemy: "en_slime" },
    { id: "tr_bees", name: "말벌 떼", enemy: "en_bee" },
    { id: "tr_bats", name: "박쥐 떼", enemy: "en_bat" },
    { id: "tr_golem", name: "돌 골렘", enemy: "en_golem" },
    { id: "tr_dragon", name: "붉은 용", enemy: "en_dragon" },
  ];
  const PEOPLE = "tex_easyrpg_charset_people1";
  // 툴 호출 시퀀스 전체를 순수 데이터로 구성한다.
  function buildToolSequence(): ToolCall[] {
    const calls: ToolCall[] = [];

    // 1) 맵 5개(첫 맵이 시작 맵으로 채택됨).
    calls.push({ name: "create_map", args: { name: "잿불 마을", width: 20, height: 16, id: MAP.village } });
    calls.push({ name: "create_map", args: { name: "안개 숲", width: 18, height: 18, id: MAP.forest } });
    calls.push({ name: "create_map", args: { name: "메마른 광산", width: 16, height: 14, id: MAP.mine } });
    calls.push({ name: "create_map", args: { name: "잿빛 고개", width: 16, height: 12, id: MAP.pass } });
    calls.push({ name: "create_map", args: { name: "화염 성소", width: 14, height: 12, id: MAP.sanctum } });

    // 2) 아이템 8종.
    const itemNames = ["회복약", "에테르", "해독제", "상급 회복약", "낡은 열쇠", "수호 부적", "달빛 약초", "골렘의 핵"];
    ITEM_IDS.forEach((id, index) => {
      calls.push({ name: "upsert_item", args: { item: { id, name: itemNames[index], price: 20 } } });
    });

    // 3) 적 5종.
    const enemyNames = ["슬라임", "말벌", "박쥐", "돌 골렘", "붉은 용"];
    const enemyArt: Partial<Record<string, string>> = {
      en_bee: "generated-enemy-bee-giant",
      en_dragon: "generated-enemy-dragon-blue",
    };
    ENEMY_IDS.forEach((id, index) => {
      calls.push({ name: "upsert_enemy", args: { enemy: { id, name: enemyNames[index], ...(enemyArt[id] ? { monsterResourceId: enemyArt[id] } : {}), stats: { maxHp: 40 + index * 30, attack: 60 } } } });
    });

    // 4) 트룹 5개.
    for (const troop of TROOPS) {
      calls.push({ name: "upsert_troop", args: { troop: { id: troop.id, name: troop.name, enemyIds: [troop.enemy] } } });
    }

    // 5) 퀘스트 플래그 3개.
    calls.push({ name: "create_quest_flags", args: { questKey: "q_furnace", steps: 3 } });
    calls.push({ name: "create_quest_flags", args: { questKey: "q_herbs", steps: 3 } });
    calls.push({ name: "create_quest_flags", args: { questKey: "q_smith", steps: 2 } });

    // 6) NPC 12명(마을6/숲2/광산2/고개1/성소1). id는 ev_npc_* 접두.
    const npc = (n: number, mapId: string, x: number, y: number, name: string, pages: unknown[]): ToolCall => ({
      name: "place_npc",
      args: { mapId, x, y, name, id: `ev_npc_${n}`, graphic: { textureKey: PEOPLE, characterIndex: n % 8 }, pages },
    });
    // 마을 NPC.
    calls.push(npc(1, MAP.village, 9, 6, "촌장 로안", [
      { lines: ["마을 화로가 꺼졌네. 성소의 불씨를 되살려 주게."], choices: [
        { text: "수락한다", commands: [{ kind: "setSwitch", switchId: "sw_q_furnace_started", value: true }] as Command[] },
        { text: "나중에" },
      ] },
      { conditions: [{ kind: "switch", switchId: "sw_q_furnace_started", value: true }], lines: ["성소로 가는 길을 서두르게."] },
    ]));
    calls.push(npc(2, MAP.village, 4, 4, "여관 주인 마사", [{ lines: ["하룻밤 15G입니다."], commands: [{ kind: "inn", price: 15 }] as Command[] }]));
    calls.push(npc(3, MAP.village, 14, 4, "상점 주인 리코", [{ lines: ["필요한 물건 있어요?"], commands: [{ kind: "shop", itemIds: [ITEM_IDS[0], ITEM_IDS[1]], allowSell: true } as Command] }]));
    calls.push(npc(4, MAP.village, 6, 10, "대장장이 무겐", [
      { lines: ["골렘의 핵을 가져오면 부적을 주지."], choices: [
        { text: "수락", commands: [{ kind: "setSwitch", switchId: "sw_q_smith_started", value: true }] as Command[] },
        { text: "거절" },
      ] },
    ]));
    calls.push(npc(5, MAP.village, 12, 10, "꼬마 미루", [{ lines: ["숲에 반짝이는 풀이 있대!"] }]));
    calls.push(npc(6, MAP.village, 16, 12, "파수꾼 데릭", [{ lines: ["동문 밖은 위험해."] }]));
    // 숲 NPC.
    calls.push(npc(7, MAP.forest, 5, 5, "약초꾼 세라", [
      { lines: ["달빛 약초 세 뿌리를 찾아 주세요."], choices: [
        { text: "수락", commands: [{ kind: "setSwitch", switchId: "sw_q_herbs_started", value: true }] as Command[] },
        { text: "나중에" },
      ] },
    ]));
    calls.push(npc(8, MAP.forest, 12, 12, "사냥꾼 브란", [{ lines: ["북쪽 광산 문은 잠겨 있어."] }]));
    // 광산 NPC.
    calls.push(npc(9, MAP.mine, 5, 5, "광부 톨크", [{ lines: ["박쥐 떼를 조심하게."] }]));
    calls.push(npc(10, MAP.mine, 10, 8, "겁먹은 인부 피오", [{ lines: ["샘물 마시고 가요."], commands: [{ kind: "recoverAll" } as Command] }]));
    // 고개 NPC.
    calls.push(npc(11, MAP.pass, 8, 5, "은둔자 오웬", [{ lines: ["용 앞에서 아끼지 말게."], commands: [{ kind: "recoverAll" } as Command] }]));
    // 성소 NPC.
    calls.push(npc(12, MAP.sanctum, 6, 8, "성소지기의 영혼", [{ lines: ["용을 잠재우면 화로가 타오를 것이다."], commands: [{ kind: "recoverAll" } as Command] }]));

    // 7) 전투 블로커 5개(id ev_blk_*).
    const blocker = (n: number, mapId: string, x: number, y: number, troopId: string, victoryItem?: string): ToolCall => ({
      name: "place_battle_blocker",
      args: {
        mapId,
        x,
        y,
        troopId,
        id: `ev_blk_${n}`,
        graphic: { query: "몬스터" },
        intro: ["적이 길을 막았다!"],
        victory: ["길이 열렸다."],
        victoryItems: victoryItem ? [{ itemId: victoryItem, amount: 1 }] : undefined,
      },
    });
    calls.push(blocker(1, MAP.forest, 9, 9, "tr_slimes"));
    calls.push(blocker(2, MAP.forest, 14, 6, "tr_bees", "it_key"));
    calls.push(blocker(3, MAP.mine, 8, 6, "tr_bats"));
    calls.push(blocker(4, MAP.mine, 12, 3, "tr_golem", "it_core"));
    calls.push(blocker(5, MAP.sanctum, 7, 4, "tr_dragon"));

    // 8) 출입구 쌍 4개(마을↔숲↔광산↔고개↔성소).
    const pair = (aMap: string, ax: number, ay: number, bMap: string, bx: number, by: number): ToolCall => ({
      name: "create_transfer_pair",
      args: { a: { mapId: aMap, x: ax, y: ay }, b: { mapId: bMap, x: bx, y: by } },
    });
    calls.push(pair(MAP.village, 18, 8, MAP.forest, 1, 9));
    calls.push(pair(MAP.forest, 16, 9, MAP.mine, 1, 7));
    calls.push(pair(MAP.mine, 14, 7, MAP.pass, 1, 6));
    calls.push(pair(MAP.pass, 14, 6, MAP.sanctum, 1, 6));

    // 9) 시작 위치 + 세션 시작 상태.
    calls.push({ name: "set_start_position", args: { mapId: MAP.village, x: 10, y: 8 } });
    calls.push({ name: "set_session_start", args: { gold: 100, inventory: { it_potion: 2 }, partyActorIds: ["actor_hero"] } });
    return calls;
  }
  function replay(calls: readonly ToolCall[]): { project: Project; failures: Array<{ call: ToolCall; issues: unknown }> } {
    const ctx: ToolContext = { project: createEmptyToolProject("잿불의 유산(툴 재구축)") };
    const failures: Array<{ call: ToolCall; issues: unknown }> = [];
    for (const call of calls) {
      const result = runTool(ctx, call.name, call.args, { dryRun: false });
      if (!result.ok) failures.push({ call, issues: result.issues });
    }
    return { project: ctx.project, failures };
  }
  function countEventsByPrefix(project: Project, prefix: string): number {
    let count = 0;
    for (const map of Object.values(project.maps)) {
      for (const event of map.events) if (event.id.startsWith(prefix)) count += 1;
    }
    return count;
  }
  describe("emberQuestToolReplay", () => {
    const { project, failures } = replay(buildToolSequence());

    it("모든 툴 호출이 성공한다(커밋 게이트 통과)", () => {
      expect(failures.map((f) => ({ name: f.call.name, issues: f.issues }))).toEqual([]);
    });

    it("스펙 카운트가 일치한다(맵5/NPC12/몬스터5/아이템8/전투블로커5)", () => {
      expect(Object.keys(project.maps).length).toBe(5);
      expect(countEventsByPrefix(project, "ev_npc_")).toBe(12);
      expect(countEventsByPrefix(project, "ev_blk_")).toBe(5);
      expect(project.database.items.length).toBe(8);
      expect(project.database.enemies.length).toBe(5);
      expect(project.database.troops.length).toBe(5);
    });

    it("projectLint error가 0이다", () => {
      const issues = projectLint(project);
      const errors = issues.filter((issue) => issue.severity === "error");
      expect(errors).toEqual([]);
    });

    it("주요 지점 도달성이 통과한다", () => {
      // 모든 맵의 전투 블로커/NPC가 시작 지점에서 인접 도달 가능해야 한다.
      const specs: ReachabilitySpec[] = [];
      for (const map of Object.values(project.maps)) {
        const from = map.id === project.startMapId
          ? project.startPos
          : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
        const targets = map.events
          .filter((event) => event.id.startsWith("ev_npc_") || event.id.startsWith("ev_blk_"))
          .map((event) => ({ x: event.x, y: event.y }));
        if (targets.length > 0) specs.push({ mapId: map.id, from, targets });
      }
      const issues = projectLint(project, { reachability: specs });
      const reachErrors = issues.filter((issue) => issue.code === "reachability");
      expect(reachErrors).toEqual([]);
    });

    it("시작 상태가 세션에 반영된다", () => {
      expect(project.startMapId).toBe(MAP.village);
      expect(project.startPos).toEqual({ x: 10, y: 8 });
      expect(project.session.gold).toBe(100);
      expect(project.session.inventory.it_potion).toBe(2);
    });
  });
});

// upsert_resource(AI 툴)로 올린 4×4 얼굴 시트가 낱장으로 쪼개지는지.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 사람이 리소스 관리자에서 올리는 경로는
// planFacesetSheetSplit → sliceFacesetSheetDataUrls 로 낱장이 되는데, AI 툴 경로에는 그
// 배선이 없었다. 192×192 를 그대로 한 장으로 저장했고 얼굴 피커에도 그대로 나왔다
// (실브라우저: 피커 113 → 114). 고르면 48px 칸에 시트 전체가 축소돼 16장이 뭉갠 채 보인다.
//
// run() 은 동기라 canvas 로 픽셀을 자를 수 없다. 그래서 마이그레이션
// (splitUploadedFacesetSheetAssets)과 같은 방식을 쓴다 — 낱장 id 로 등록하되 각 칸에
// sheetCell/sheetSourceId 표식을 달아 두고, 실제 절단은 로드 직후
// repairUploadedFacesetSheets 가 마무리한다.
describe("facesetToolSheetUpload", () => {
  isolateTimers();
  function context(): ToolContext {
    return { project: createEmptyToolProject("얼굴 시트 업로드") };
  }
  /** IHDR 만 있는 최소 PNG. 툴은 앞 24바이트에서 가로·세로만 읽는다. */
  function pngDataUrl(width: number, height: number): string {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set([73, 72, 68, 82], 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  }
  function upload(ctx: ToolContext, id: string, width: number, height: number) {
    return runTool(ctx, "upsert_resource", {
      resource: { id, name: "업로드 얼굴", kind: "faceset", dataUrl: pngDataUrl(width, height) },
    });
  }
  describe("upsert_resource 의 faceset 시트 업로드", () => {
    it("192×192 시트는 낱장 16장이 되고 통짜 시트는 남지 않는다", () => {
      const ctx = context();
      const result = upload(ctx, "res_face_sheet", 192, 192);
      expect(result.ok, result.summary).toBe(true);

      const uploaded = ctx.project.assets.uploaded;
      expect(uploaded.res_face_sheet).toBeUndefined();
      const faceIds = Object.keys(uploaded).filter((id) => /^res_face_sheet-\d\d$/.test(id));
      expect(faceIds).toHaveLength(16);
      expect(faceIds).toContain("res_face_sheet-00");
      expect(faceIds).toContain("res_face_sheet-15");
    });

    it("96×96 시트는 4장이 된다", () => {
      const ctx = context();
      expect(upload(ctx, "res_small_sheet", 96, 96).ok).toBe(true);
      const faceIds = Object.keys(ctx.project.assets.uploaded).filter((id) =>
        /^res_small_sheet-\d\d$/.test(id)
      );
      expect(faceIds).toHaveLength(4);
    });

    it("낱장마다 48×48 크기와 지연 절단 표식을 단다", () => {
      const ctx = context();
      upload(ctx, "res_face_sheet", 192, 192);
      const cell7 = ctx.project.assets.uploaded["res_face_sheet-07"];
      expect(cell7).toBeDefined();
      const meta = cell7!.meta as Record<string, unknown>;
      expect(meta.width).toBe(48);
      expect(meta.height).toBe(48);
      expect(meta.sheetCell).toBe(7);
      expect(meta.sheetSourceId).toBe("res_face_sheet");
      // 픽셀은 아직 시트 그대로 — repairUploadedFacesetSheets 가 로드 때 자른다.
      expect(cell7!.dataUrl).toBe(pngDataUrl(192, 192));
    });

    it("이미 낱장인 48×48 은 쪼개지 않고 그대로 한 장이다", () => {
      const ctx = context();
      expect(upload(ctx, "res_one_face", 48, 48).ok).toBe(true);
      expect(ctx.project.assets.uploaded.res_one_face).toBeDefined();
      expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_one_face-"))).toEqual([]);
    });

    it("비정사각 아트는 저자가 그린 낱장으로 보고 건드리지 않는다", () => {
      const ctx = context();
      expect(upload(ctx, "res_tall_face", 48, 96).ok).toBe(true);
      expect(ctx.project.assets.uploaded.res_tall_face).toBeDefined();
      expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_tall_face-"))).toEqual([]);
    });

    it("faceset 이 아닌 종류는 정사각 시트여도 쪼개지 않는다", () => {
      const ctx = context();
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: "res_pic", name: "그림", kind: "picture", dataUrl: pngDataUrl(192, 192) },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.assets.uploaded.res_pic).toBeDefined();
      expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_pic-"))).toEqual([]);
    });
  });
});

// 숲 합성 레이어 회귀 — 밑동(290/292/293)은 lower solid 가 정위치다.
// liftTrunksToUpper(2026-09 초)가 밑동을 upper 로 들어올려 런타임 렌더러의
// lower 투명-밑동 잔디 받침을 빗나가게 했다(투명 픽셀 구멍). 재발 방지.
describe("forestTrunkLayers", () => {
  isolateTimers();
  const TRUNKS = new Set([290, 291, 292, 293]);
  const CANOPIES = new Set([260, 261, 262, 263]);
  function setup() {
    // 밑동 290~293·수관 260~263 은 옛 combined_town 칸 번호다 — 2026-10-07 정리 뒤 기본 칩셋(beodeul_city)이 아니므로 그 시트를 명시해 만든다.
    const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createEmptyToolProject("숲 레이어 회귀")) };
    const made = runTool(ctx, "create_map", { name: "숲", width: 30, height: 30, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
    const mapId = (made.data as { mapId: string }).mapId;
    return { ctx, mapId };
  }
  function layerCounts(mapId: string, ctx: ToolContext) {
    const map = ctx.project.maps[mapId]!;
    let canopyUpper = 0;
    let canopyLower = 0;
    let trunkUpper = 0;
    let trunkLower = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const i = y * map.width + x;
        const u = map.upperTiles[i] ?? -1;
        const l = map.lowerTiles[i] ?? -1;
        if (CANOPIES.has(u)) canopyUpper += 1;
        if (CANOPIES.has(l)) canopyLower += 1;
        if (TRUNKS.has(u)) trunkUpper += 1;
        if (TRUNKS.has(l)) trunkLower += 1;
      }
    }
    return { canopyUpper, canopyLower, trunkUpper, trunkLower };
  }
  describe("forest composition trunk layers", () => {
    it("dense 합성: 수관은 upper, 밑동은 lower — upper 고아 밑동 없음", () => {
      const { ctx, mapId } = setup();
      const r = runTool(ctx, "place_props", {
        mapId, area: { x: 2, y: 2, w: 20, h: 20 }, material: "침엽수", density: "dense", seed: 7,
      });
      expect(r.ok, r.summary).toBe(true);
      const c = layerCounts(mapId, ctx);
      expect(c.trunkLower).toBeGreaterThan(0);
      expect(c.trunkUpper).toBe(0);
      expect(c.canopyLower).toBe(0);
      expect(c.canopyUpper).toBeGreaterThan(0);
    });

    it("impassable 합성: 밑동은 lower — gap-closure 덤불이 밑동을 upper 로 밀지 않음", () => {
      const { ctx, mapId } = setup();
      const r = runTool(ctx, "place_props", {
        mapId, area: { x: 2, y: 2, w: 20, h: 20 }, material: "활엽수", density: "impassable", seed: 7,
      });
      expect(r.ok, r.summary).toBe(true);
      const c = layerCounts(mapId, ctx);
      expect(c.trunkLower).toBeGreaterThan(0);
      expect(c.trunkUpper).toBe(0);
      expect(c.canopyLower).toBe(0);
    });
  });
});
