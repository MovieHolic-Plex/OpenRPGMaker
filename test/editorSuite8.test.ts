import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { setMapTileset } from "@/editor/actions";
import { pendingHistoryLabels, recordMapEditIfChanged, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { paintRelief } from "@/editor/tileActions";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { store } from "@/project/store";
import { tilesetSwitchImpact, tilesetSwitchMessage, tilesetSwitchNeedsConfirm } from "@/editor/tilesetSwitchImpact";
import { tileCellsForPaintShape, tileRectFromDrag } from "@/editor/tileShapeTools";
import { computeActiveToolDomains, computeAssistantToolMode, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { editorState } from "@/editor/editorState";
import { activeTools, allTools, toOpenAiTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED, type ToolDefinition, type ToolDomain, getTool, runTool, type ToolContext } from "@/editor/tools";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";
import { declaredIntent } from "./intentFixture";
import { readFileSync } from "node:fs";
import { retainEventLayerClickFeedback } from "@/editor/transientEditorChrome";
import type { EventLayerClickFeedback } from "@/editor/editSceneEventMarkers";
import type { GameEvent, Project } from "@/project/types";
import { runHeadlessToolWithProject } from "@/headless";
import { paintTerrainBrush } from "@/editor/terrainBrush";
import { isolateTimers } from "./mergedTeardown";

// 지형 리뷰 F1: 칩셋을 바꾼 뒤 Ctrl+Z 한 번이 바로 앞 지형 획까지 지웠다.
// setMapTileset 이 맵 기록을 남기지 않아, 되돌리기가 획 시작 스냅샷(옛 칩셋·획 전 높이)을 복원했기 때문이다.
// 칩셋 변경은 그 자체로 되돌리기 한 단계여야 한다.
describe("tilesetChangeUndo", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  describe("칩셋 변경은 되돌리기 한 단계다", () => {
    it("Ctrl+Z 한 번은 칩셋만 되돌리고 앞 지형 획은 남긴다", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId]!;
      const other = Object.values(project.tilesets).find((t) => t.id !== map.tilesetId && t.tileSize === map.tileSize);
      if (!other) throw new Error("같은 크기의 다른 칩셋이 픽스처에 없습니다");
      const originalTileset = map.tilesetId;

      recordMapEditIfChanged(map.id, () => { paintRelief(map.id, 5, 5, "raise", { radius: 2, level: 1 }); }, { label: "높이 · 높이 올리기" });
      const raised = store.getCurrent().maps[map.id]!.relief!.levels.filter((v) => v > 0).length;
      expect(raised).toBeGreaterThan(0);

      setMapTileset(map.id, other.id);
      expect(store.getCurrent().maps[map.id]!.tilesetId).toBe(other.id);
      expect(pendingHistoryLabels().undo).toContain("칩셋 변경");

      expect(undoMapEdit()).toBe(true);
      const afterUndo = store.getCurrent().maps[map.id]!;
      expect(afterUndo.tilesetId).toBe(originalTileset);
      expect(afterUndo.relief!.levels.filter((v) => v > 0).length).toBe(raised);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[map.id]!.relief?.levels.some((v) => v > 0) ?? false).toBe(false);
    });
  });
});

// 지형 리뷰 F2: 칩셋을 바꾸면 범위 밖 칸이 말없이 빈 칸이 됐다. 확인 창이 그 칸 수와 크기 변화를 센다.
describe("tilesetSwitchImpact", () => {
  isolateTimers();
  describe("칩셋 교체 영향", () => {
    it("범위 밖 칸과 칸 크기 변화를 세고 확인을 요구한다", () => {
      const project = createBlankProject();
      const map = structuredClone(project.maps[project.startMapId]!);
      const current = project.tilesets[map.tilesetId]!;
      map.lowerTiles.fill(-1);
      map.upperTiles.fill(-1);
      map.lowerTiles[0] = 3;
      map.lowerTiles[1] = 50;
      map.upperTiles[2] = 70;

      const small = { ...current, id: "small", count: 40 };
      const impact = tilesetSwitchImpact(map, current, small);
      expect(impact.paintedCells).toBe(3);
      expect(impact.outOfRangeCells).toBe(2);
      expect(impact.sizeChanged).toBe(false);
      expect(tilesetSwitchNeedsConfirm(impact)).toBe(true);
      expect(tilesetSwitchMessage(impact, "작은 칩셋")).toContain("3칸 중 2칸");

      const bigger = { ...current, id: "big", count: 1000, tileSize: current.tileSize * 2 };
      const sized = tilesetSwitchImpact(map, current, bigger);
      expect(sized.outOfRangeCells).toBe(0);
      expect(sized.sizeChanged).toBe(true);
      expect(tilesetSwitchNeedsConfirm(sized)).toBe(true);

      const same = tilesetSwitchImpact(map, current, { ...current, id: "same", count: 1000 });
      expect(tilesetSwitchNeedsConfirm(same)).toBe(false);
    });
  });
});

describe("tileShapeTools", () => {
  isolateTimers();
  describe("tile shape tools", () => {
    it("normalizes a dragged tile rectangle in any direction", () => {
      const rect = tileRectFromDrag({ x: 5, y: 4 }, { x: 2, y: 1 });

      expect(rect).toEqual({ x: 2, y: 1, width: 4, height: 4 });
    });

    it("returns every bounded cell for a rectangle paint drag", () => {
      const cells = tileCellsForPaintShape("rect", { x: 1, y: 1 }, { x: 3, y: 2 }, { width: 10, height: 10 });

      expect(cells).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ]);
    });

    it("clips rectangle paint cells to the map bounds", () => {
      const cells = tileCellsForPaintShape("rect", { x: -1, y: -1 }, { x: 1, y: 1 }, { width: 3, height: 3 });

      expect(cells).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]);
    });

    it("returns a filled ellipse footprint for round terrain drags", () => {
      const cells = tileCellsForPaintShape("round", { x: 1, y: 1 }, { x: 5, y: 3 }, { width: 10, height: 10 });

      expect(cells).toEqual([
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ]);
    });
  });
});

// 컨텍스트 모드 툴 스코핑 T4 (2026-07-07 타일 시공 흐름 재설계 §2.2).
// - tile 모드: v3 프리미티브 + 코어만 노출(~12개), 옛 타일 지식 툴 0개.
// - event 모드: 이벤트 툴 포함, 타일 프리미티브 제외.
// - deprecated 는 어떤 모드에서도 노출되지 않는다.
// - 모드 판정은 UI 상태에서만 결정론으로 계산된다(원칙 0).
describe("toolDomainScoping", () => {
  isolateTimers();
  const OLD_TILE_TOOLS = [...LEGACY_TILE_KNOWLEDGE_SUPERSEDED.keys()];
  const V3_PRIMITIVES = ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase"];
  const CORE_TOOLS = ["create_map", "resize_map", "get_project_summary", "list_resources", "tile_query"];
  function exposedNames(mode?: "tile" | "map" | "event" | "database"): Set<string> {
    return new Set(toOpenAiTools(undefined, mode ? { mode } : {}).map((tool) => tool.function.name));
  }
  describe("T4 — toOpenAiTools 모드 스코핑", () => {
    it("옛 타일 지식 툴 11종은 deprecated(비노출)이며 실행 호환(supersededBy)이 유지된다", () => {
      const byName = new Map(allTools().map((tool) => [tool.name, tool]));
      const exposed = exposedNames();
      for (const [name, replacement] of LEGACY_TILE_KNOWLEDGE_SUPERSEDED) {
        const tool = byName.get(name);
        expect(tool, name).toBeDefined();
        expect(tool!.deprecated, name).toBe(true);
        expect(tool!.supersededBy, name).toBe(replacement);
        expect(exposed.has(name), name).toBe(false);
      }
    });

    it("tile 모드: v3 프리미티브 + 코어 노출, propose 비노출, 옛 타일 툴 0개", () => {
      const exposed = exposedNames("tile");
      for (const name of ["paint_road", ...V3_PRIMITIVES, ...CORE_TOOLS]) {
        expect(exposed.has(name), name).toBe(true);
      }
      expect(exposed.has("propose_tile_vocabulary")).toBe(false);
      for (const name of OLD_TILE_TOOLS) expect(exposed.has(name), name).toBe(false);
      for (const name of ["upsert_event", "place_npc", "upsert_item", "plan_world", "create_quest"]) {
        expect(exposed.has(name), name).toBe(false);
      }
      expect(exposed.size).toBeGreaterThanOrEqual(12);
      expect([...exposed]).toEqual(eligibleNames(activeTools(), new Set(["tile"])));
    });

    it("event 모드: 이벤트 툴 포함, 타일 프리미티브 제외, 코어는 상시", () => {
      const exposed = exposedNames("event");
      for (const name of ["upsert_event", "place_npc", "move_event", "find_events", "get_event", ...CORE_TOOLS]) {
        expect(exposed.has(name), name).toBe(true);
      }
      for (const name of V3_PRIMITIVES) expect(exposed.has(name), name).toBe(false);
    });

    it("deprecated 는 어떤 모드에서도 0개", () => {
      const deprecated = new Set(allTools().filter((tool) => tool.deprecated === true).map((tool) => tool.name));
      for (const mode of [undefined, "tile", "map", "event", "database"] as const) {
        const exposed = exposedNames(mode);
        for (const name of deprecated) expect(exposed.has(name), `${mode ?? "all"}:${name}`).toBe(false);
      }
    });

    // Removed it "canonical construction만 write surface에": author_house and author_village were removed from the tool registry on purpose.

    it("mode 없으면 종전 동작(deprecated 만 제외한 전체 노출)", () => {
      const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
      expect(toOpenAiTools().length).toBe(exposedCount);
    });

    it("multi-domain filters retain every eligible tool, including database tools", () => {
      const tools = makeExposureTestTools();
      resetAssistantToolDomainMemory();
      const domains = computeActiveToolDomains(declaredIntent({ tools: ["upsert_item", "build_wall", "define_quest", "plan_world"] }));
      const exposed = toOpenAiTools(tools, { domains });
      const names = new Set(exposed.map((tool) => tool.function.name));

      expect([...names]).toEqual(eligibleNames(tools, domains));
      expect(names.has("deprecated_tool")).toBe(false);
      for (let index = 0; index < 8; index += 1) {
        expect(names.has(`database_tool_${index}`), `database_tool_${index}`).toBe(true);
      }
    });
  });
  describe("T4 — computeAssistantToolMode (UI 상태 결정론)", () => {
    const restores: (() => void)[] = [];
    afterEach(() => {
      while (restores.length > 0) restores.pop()?.();
      editorState.set({ layer: "lower", tool: "paint" });
      resetAssistantToolDomainMemory();
    });

    it("DOM 없음(헤드리스) → map (판정 불가 기본)", () => {
      expect(computeAssistantToolMode()).toBe("map");
    });

    it("좌측 타일 팔레트가 보이고 타일 레이어 편집 중이면 tile", () => {
      restores.push(installFakeDom());
      document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
      editorState.set({ layer: "lower", tool: "paint" });
      expect(computeAssistantToolMode()).toBe("tile");
    });

    it("이벤트 레이어/도구면 event, DB 모달이 열려 있으면 database 가 우선한다", () => {
      restores.push(installFakeDom());
      document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
      editorState.set({ layer: "event" });
      expect(computeAssistantToolMode()).toBe("event");
      document.body.append(el("div", { dataset: { testid: "database-modal" } }));
      expect(computeAssistantToolMode()).toBe("database");
    });
  });
  describe("T4 — computeActiveToolDomains (선언 유니온 + TTL)", () => {
    afterEach(() => {
      resetAssistantToolDomainMemory();
      editorState.set({ layer: "lower", tool: "paint" });
    });

    it("선언한 툴의 도메인이 결정론으로 열린다 — 문장은 보지 않는다", () => {
      const enemy = computeActiveToolDomains(declaredIntent({ tools: ["simulate_battle", "upsert_enemy"] }));
      for (const domain of ["core", "map", "battle", "database"] as const) expect(enemy.has(domain)).toBe(true);
      const wall = computeActiveToolDomains(declaredIntent({ tools: ["build_wall"] }));
      for (const domain of ["core", "map", "tile"] as const) expect(wall.has(domain)).toBe(true);
      expect(computeActiveToolDomains(null).size).toBe(2);
    });

    // Removed it "야외 시공 선언은 tile 을 열어": author_village was removed from the tool registry on purpose.

    it("modify intent exposes all three editing domains without pruning", () => {
      const domains = computeActiveToolDomains(declaredIntent({ mode: "modify" }));
      for (const domain of ["tile", "map", "event"] as const) expect(domains.has(domain)).toBe(true);
      const list = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
      expect(list).toEqual(eligibleNames(activeTools(), domains));
      expect(list).toContain("fill_region");
    });

    it("system intent exposes every system capability", () => {
      const resetDomains = computeActiveToolDomains(declaredIntent({ tools: ["reset_project"], resetsContext: true }));
      const resetExposed = toOpenAiTools(undefined, { domains: resetDomains });
      expect(resetDomains.has("system")).toBe(true);
      expect(resetExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), resetDomains));
      expect(resetExposed.some((tool) => tool.function.name === "reset_project")).toBe(true);

      const nightDomains = computeActiveToolDomains(declaredIntent({ tools: ["configure_time_system"] }));
      const nightExposed = toOpenAiTools(undefined, { domains: nightDomains });
      expect(nightDomains.has("system")).toBe(true);
      expect(nightExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), nightDomains));
      expect(nightExposed.some((tool) => tool.function.name === "configure_time_system")).toBe(true);
    });
  });
  function eligibleNames(tools: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): string[] {
    return tools.filter((tool) => !tool.deprecated && (!tool.domains || tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain)))).map((tool) => tool.name);
  }
  function makeExposureTestTools(): ToolDefinition[] {
    const make = (name: string, domain: ToolDomain, deprecated = false): ToolDefinition => ({
      name,
      description: name,
      mode: domain === "core" ? "read" : "write",
      domains: [domain],
      parameters: { type: "object", properties: {} },
      ...(deprecated ? { deprecated: true } : {}),
      run: () => ({ summary: name }),
    });
    return [
      ...Array.from({ length: 5 }, (_, index) => make(`core_tool_${index}`, "core")),
      ...Array.from({ length: 8 }, (_, index) => make(`database_tool_${index}`, "database")),
      ...Array.from({ length: 8 }, (_, index) => make(`tile_tool_${index}`, "tile")),
      ...Array.from({ length: 8 }, (_, index) => make(`battle_tool_${index}`, "battle")),
      ...Array.from({ length: 8 }, (_, index) => make(`quest_tool_${index}`, "quest")),
      ...Array.from({ length: 8 }, (_, index) => make(`world_tool_${index}`, "world")),
      make("deprecated_tool", "core", true),
    ];
  }
});

describe("transientEditorChrome", () => {
  isolateTimers();
  const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const FEEDBACK: EventLayerClickFeedback = {
    mapId: "map_1",
    x: 11,
    y: 8,
    mode: "edit",
  };
  describe("retainEventLayerClickFeedback", () => {
    it("keeps the last-click badge after a human map edit", () => {
      expect(
        retainEventLayerClickFeedback({
          feedback: FEEDBACK,
          currentMapId: "map_1",
          changeOrigin: "human",
        }),
      ).toEqual(FEEDBACK);
    });

    it("drops the badge when an AI apply redraws the map", () => {
      expect(
        retainEventLayerClickFeedback({
          feedback: FEEDBACK,
          currentMapId: "map_1",
          changeOrigin: "ai",
        }),
      ).toBeNull();
    });

    it("drops the badge when the editor switches maps", () => {
      expect(
        retainEventLayerClickFeedback({
          feedback: FEEDBACK,
          currentMapId: "map_2",
          mapChanged: true,
        }),
      ).toBeNull();
    });

    it("drops a badge that belongs to a different map even without mapChanged", () => {
      expect(
        retainEventLayerClickFeedback({
          feedback: FEEDBACK,
          currentMapId: "map_2",
        }),
      ).toBeNull();
    });

    it("does nothing when there is no badge", () => {
      expect(
        retainEventLayerClickFeedback({
          feedback: null,
          currentMapId: "map_1",
          changeOrigin: "ai",
        }),
      ).toBeNull();
    });
  });
  describe("wiring", () => {
    it("EditScene drops the click badge on AI store changes and map switches", () => {
      const scene = read("src/editor/EditScene.ts");
      expect(scene).toContain("retainEventLayerClickFeedback");
      expect(scene).toContain("changeOrigin: change.origin");
      expect(scene).toContain("this.clearEventLayerClickFeedback()");
    });

  });
});

describe("viewFocusTool", () => {
  isolateTimers();
  function merchant(id = "ev_hana", name = "상인 하나", x = 6): GameEvent {
    return {
      id,
      x,
      y: 9,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page_1`,
          name,
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
    start.events = [merchant(), merchant("ev_dul", "상인 둘", 10)];
    const house = createBlankMap("상인 하나의 집", 20, 16);
    house.id = "map_house_interior_1";
    project.maps[house.id] = house;
    return project;
  }
  function context(project: Project): ToolContext {
    return { project };
  }
  function focus(project: Project, args: Record<string, unknown>) {
    return runTool(context(project), "focus_editor_view", args);
  }
  describe("focus_editor_view", () => {
    it("is registered as a read tool", () => {
      const tool = getTool("focus_editor_view");

      expect(tool?.mode).toBe("read");
    });

    // 노출되지 않으면 기능이 없는 것과 같다 — "어디야?" 는 도메인 상황을 가리지 않고 들어오므로
    // 타일·이벤트처럼 상한(40) 트림이 세게 걸리는 모드에서도 남아야 한다.
    it("stays exposed to the model in every tool mode", () => {
      for (const mode of ["map", "tile", "event", "quest", "system"] as const) {
        const exposed = new Set(toOpenAiTools(undefined, { mode }).map((entry) => entry.function.name));
        expect(exposed.has("focus_editor_view"), `mode=${mode}`).toBe(true);
      }
    });

    it("핀이 대표 도구를 밀어내지 않고 주요 모드에 함께 노출된다", () => {
      const expectations = {
        map: [],
        tile: [],
        event: ["set_scene_mood", "create_transfer_pair"],
      } as const;

      for (const [mode, representativeTools] of Object.entries(expectations) as [keyof typeof expectations, readonly string[]][]) {
        const exposed = new Set(toOpenAiTools(undefined, { mode }).map((entry) => entry.function.name));
        expect(exposed.has("focus_editor_view"), `mode=${mode}`).toBe(true);
        for (const toolName of representativeTools) {
          expect(exposed.has(toolName), `mode=${mode}, tool=${toolName}`).toBe(true);
        }
      }
    });

    it("맵 이름을 맵 전체 영역으로 해석한다", () => {
      const project = fixture();

      const result = focus(project, { query: "상인 하나의 집" });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        mapId: "map_house_interior_1",
        x: 0,
        y: 0,
        w: 20,
        h: 16,
        label: "상인 하나의 집",
        kind: "map",
      });
    });

    it("resolves an event name to its own tile", () => {
      const project = fixture();

      const result = focus(project, { query: "상인 하나" });

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({
        mapId: project.startMapId,
        x: 6,
        y: 9,
        w: 1,
        h: 1,
        kind: "event",
        eventId: "ev_hana",
      });
    });

    it("서로 다른 부분 이름이 여럿이면 후보 이름을 알리고 정확한 이름은 찾는다", () => {
      const project = fixture();

      const ambiguous = focus(project, { query: "상인" });
      const exact = focus(project, { query: "상인 하나" });

      expect(ambiguous.ok).toBe(false);
      expect(ambiguous.summary).toContain("상인 하나");
      expect(ambiguous.summary).toContain("상인 둘");
      expect(exact.ok).toBe(true);
      expect(exact.data).toMatchObject({ eventId: "ev_hana" });
    });

    it("clamps an explicit rectangle into the map", () => {
      const project = fixture();

      const result = focus(project, { mapId: "map_house_interior_1", x: 18, y: 14, w: 40, h: 40 });

      expect(result.data).toMatchObject({ mapId: "map_house_interior_1", x: 18, y: 14, w: 2, h: 2 });
    });

    it("fails with a name the project does not have", () => {
      const result = focus(fixture(), { query: "용의 성" });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("찾지 못했습니다");
    });

    it("mapId가 있으면 모호한 query보다 좌표 지정을 우선한다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 24, 18);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;

      const result = focus(project, { query: "여관", mapId: second.id, x: 4, y: 5 });

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ mapId: second.id, x: 4, y: 5 });
    });

    it("같은 이름이 여러 곳이면 임의로 고르지 않는다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 20, 16);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;

      const result = focus(project, { query: "여관" });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("2곳");
    });

    it("needs either a name or a map id", () => {
      const result = focus(fixture(), {});

      expect(result.ok).toBe(false);
    });

    it("changes nothing in the project", () => {
      const project = fixture();
      const before = JSON.stringify(project);

      focus(project, { query: "상인 하나" });

      expect(JSON.stringify(project)).toBe(before);
    });
  });
});

// 지형 리뷰 F4·F5: 물이 단 경계를 넘어 깔려 절벽 띠가 연못을 가로지르고, 강 붓이 고원을 벽 없이 갈랐다.
describe("waterReliefBoundary", () => {
  isolateTimers();
  function halfPlateau(): { project: Project; mapId: string } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const levels = new Array<number>(map.width * map.height).fill(0);
    for (let y = 0; y < 6; y++) for (let x = 0; x < map.width; x++) levels[y * map.width + x] = 2;
    map.relief = { width: map.width, height: map.height, levels };
    return { project, mapId: map.id };
  }
  describe("물과 높이 경계", () => {
    beforeEach(() => store.replace(createBlankProject()));

    it("fill_region 물은 가장 낮은 단 칸에만 깔고 넘친 칸 수를 경고한다", () => {
      const { project, mapId } = halfPlateau();
      const { result, project: next } = runHeadlessToolWithProject(project, "fill_region", { mapId, rect: { x: 2, y: 4, w: 6, h: 4 }, material: "버들항 물" }, { assistantRun: true });
      expect(result.ok).toBe(true);
      const map = next.maps[mapId]!, before = project.maps[mapId]!;
      for (let y = 4; y < 6; y++) for (let x = 2; x < 8; x++) expect(map.lowerTiles[y * map.width + x]).toBe(before.lowerTiles[y * map.width + x]);
      expect(map.relief!.levels[4 * map.width + 2]).toBe(2);
      expect(JSON.stringify(result.warnings ?? result.diff?.warnings ?? [])).toContain("높이가 다른 12칸");
    });

    it("강 붓은 첫 칸과 다른 높이의 땅을 깎지 않고 건너뛴 칸 수를 돌려준다", () => {
      const { project, mapId } = halfPlateau();
      store.replace(project);
      const refused = paintTerrainBrush(mapId, 5, 6, "water", 3, 0);
      const map = store.getCurrent().maps[mapId]!;
      expect(refused).toBeGreaterThan(0);
      for (let x = 0; x < map.width; x++) expect(map.relief!.levels[5 * map.width + x]).toBe(2);
    });
  });
});
