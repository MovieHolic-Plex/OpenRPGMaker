import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeSurfaceRule, activateKnowledgeWorkspace, beginKnowledgeDrag, chooseKnowledgeTemplate, clearKnowledgeSelection, knowledgeDraft, knowledgeSelection, loadKnowledgeGroup, loadKnowledgeProposal, saveKnowledgeDraft, selectKnowledgeTile, updateKnowledgeDraft } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import type { ClusterRule, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("clusterRuleSurface", () => {
  isolateTimers();
  /**
   * 타일 그룹의 `surface` 규칙 — 「화덕은 북쪽 벽에 붙는다」의 타일 쪽 절반.
   * 구조물 킷 조건(structureKitPlacementConditions.test.ts)은 찍는 순간 차단하고,
   * 이쪽은 이미 찍힌 맵을 훑어 규칙 감사 패널에 올린다.
   */

  const MAP_ID = "map_surface_rules";
  const WALL = 300;
  const FLOOR = 400;
  const STOVE_TOP = 21;
  const STOVE_BOT = 51;
  function stoveGroup(rules: readonly ClusterRule[]): TileGroupMetadata {
    return {
      defaultLayer: "mixed",
      description: "화덕 오븐",
      id: "kitchen-stove",
      name: "화덕 오븐",
      patternGrammar: {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "topCap", tileIds: [STOVE_TOP] },
          { role: "bottomCap", tileIds: [STOVE_BOT] },
        ],
        preserveCaps: true,
        repeat: "source_order",
      },
      placementRules: "부엌 북쪽 벽",
      role: "building",
      rules: [...rules],
      tileIds: [STOVE_TOP, STOVE_BOT],
    };
  }
  const NORTH_WALL_RULE: ClusterRule = {
    id: "r_interior_stove_north_wall",
    kind: "surface",
    message: "화덕은 북쪽 벽에 등을 대고 놓입니다.",
    params: { facing: "north", zone: "againstWall" },
    strength: "hard",
  };
  /** 8×6 방. y=1 행이 벽, 나머지는 바닥. */
  function projectWithStove(stoveOriginY: number): Project {
    const width = 8;
    const height = 6;
    const map: GameMap = {
      events: [],
      height,
      id: MAP_ID,
      lowerTiles: new Array<number>(width * height).fill(FLOOR),
      name: "주방",
      tileSize: 16,
      tilesetId: DEFAULT_TILESET_ID,
      upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
      width,
    };
    for (let x = 0; x < width; x += 1) map.lowerTiles[1 * width + x] = WALL;

    const project = createBlankProject();
    project.maps = { [MAP_ID]: map };
    project.mapTree = { mapId: MAP_ID, children: [] };
    project.startMapId = MAP_ID;
    project.startPos = { x: 0, y: 0 };
    const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
    tileset.passability[WALL] = blockedFlag();
    tileset.passability[FLOOR] = passableFlag();
    tileset.priority[WALL] = "lower";
    tileset.priority[FLOOR] = "lower";
    // 화덕 자체는 통행 불가 — 검증기가 자기 발밑을 벽으로 오인하지 않는지 같이 본다.
    tileset.passability[STOVE_TOP] = blockedFlag();
    tileset.passability[STOVE_BOT] = blockedFlag();
    tileset.tileGroups = [stoveGroup([NORTH_WALL_RULE])];

    // 실내 파이프라인과 같은 방식으로 찍는다: 상단(21)은 **상위** 레이어에 벽면 위로 겹쳐 세우고,
    // 발밑(51)은 하위 레이어에 놓는다. 그래야 벽의 지형 타일이 남아 감사가 되돌려 볼 수 있다.
    map.upperTiles[stoveOriginY * width + 3] = STOVE_TOP;
    map.lowerTiles[(stoveOriginY + 1) * width + 3] = STOVE_BOT;
    return project;
  }
  describe("cluster-rule surface — 맵 감사", () => {
    it("벽 아래에 등을 댄 화덕은 위반이 아니다", () => {
      // 상단이 벽 행(y=1), 발밑이 y=2 바닥 → 발밑 위(y=1)가 벽.
      const violations = validateClusterRules(projectWithStove(1), MAP_ID);
      expect(violations.filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("방 가운데 떠 있는 화덕은 error 로 보고된다", () => {
      const violations = validateClusterRules(projectWithStove(3), MAP_ID);
      const surface = violations.filter((entry) => entry.rule.kind === "surface");
      expect(surface).toHaveLength(1);
      expect(surface[0]!.severity).toBe("error");
      expect(surface[0]!.code).toBe("cluster-rule:surface:kitchen-stove");
      // 규칙 감사 패널이 위치를 찍을 수 있어야 한다.
      expect(surface[0]!.coords.length).toBeGreaterThan(0);
    });

    it("지형까지 덮어 찍힌 세로쌍은 «판정 불가» 로 건너뛴다 — 벽을 지운 자리는 되볼 수 없다", () => {
      // 구조물 킷 스탬프는 두 줄을 모두 하위 레이어에 쓴다 → 상단이 앉았던 벽 타일이 사라진다.
      // 찍는 순간에는 검사를 통과했으므로, 나중에 되보고 위반이라 우기면 거짓 위반이다.
      const project = projectWithStove(1);
      const map = project.maps[MAP_ID]!;
      map.upperTiles[1 * map.width + 3] = TILE.EMPTY;
      map.lowerTiles[1 * map.width + 3] = STOVE_TOP;
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("params 가 망가진 규칙은 조용히 건너뛴다 — 거짓 위반을 만들지 않는다", () => {
      const project = projectWithStove(3);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [
        stoveGroup([{ ...NORTH_WALL_RULE, params: { zone: "없는존" } }]),
      ];
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });
  });
  describe("set_cluster_rule — surface 규칙 편집", () => {
    it("zone·facing 을 받아 그룹에 저장한다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const context = { project };
      const result = runTool(context, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: {
          id: "r_stove_surface",
          kind: "surface",
          strength: "hard",
          params: { zone: "againstWall", facing: "north" },
        },
      });
      expect(result.ok).toBe(true);
      const saved = context.project.tilesets[DEFAULT_TILESET_ID]!.tileGroups!
        .find((group) => group.id === "kitchen-stove")!.rules!
        .find((rule) => rule.kind === "surface");
      expect(saved?.params).toEqual({ facing: "north", zone: "againstWall" });
    });

    it("모르는 zone 은 거부한다 — 조용히 통과시키면 검사가 없는 것과 같아진다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const result = runTool({ project }, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: { id: "r_bad", kind: "surface", strength: "hard", params: { zone: "북벽" } },
      });
      expect(result.ok).toBe(false);
      expect(result.summary + JSON.stringify(result.issues ?? [])).toContain("params.zone");
    });
  });
  describe("타일셋 지식 저장 — 배치 면 병합", () => {
    const adjacency: ClusterRule = {
      id: "r_interior_stove_v_pair",
      kind: "adjacency",
      params: { a: STOVE_TOP, b: STOVE_BOT, relation: "aAboveB" },
      strength: "hard",
    };

    it("«조건 없음» 은 surface 규칙만 지우고 다른 규칙은 남긴다", () => {
      const merged = mergeSurfaceRule([adjacency, NORTH_WALL_RULE], "kitchen-stove", {
        surfaceFacing: "any",
        surfaceStrength: "hard",
        surfaceZone: "none",
      });
      expect(merged).toEqual([adjacency]);
    });

    it("배치 면을 고르면 규칙이 생기고, 인접 규칙은 그대로 보존된다", () => {
      const merged = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual(adjacency);
      expect(merged[1]).toMatchObject({
        id: "r_surface_kitchen-stove",
        kind: "surface",
        params: { facing: "north", zone: "againstWall" },
        strength: "hard",
      });
    });

    it("같은 그룹에 두 번 저장해도 surface 규칙은 하나만 남는다", () => {
      const once = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      const twice = mergeSurfaceRule(once, "kitchen-stove", {
        surfaceFacing: "west",
        surfaceStrength: "soft",
        surfaceZone: "againstWall",
      });
      expect(twice.filter((rule) => rule.kind === "surface")).toHaveLength(1);
      expect(twice[1]).toMatchObject({ params: { facing: "west", zone: "againstWall" }, strength: "soft" });
    });

    it("방향은 againstWall 에서만 실린다 — 다른 면에 facing 을 남기면 읽는 쪽이 헷갈린다", () => {
      const merged = mergeSurfaceRule([], "g", {
        surfaceFacing: "north",
        surfaceStrength: "medium",
        surfaceZone: "wallFace",
      });
      expect(merged[0]!.params).toEqual({ zone: "wallFace" });
    });
  });
});

describe("tilesetKnowledgeWorkspace", () => {
  isolateTimers();
  class TestMouseEvent extends Event {
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;

    constructor(type: string, init: { readonly ctrlKey?: boolean; readonly shiftKey?: boolean } = {}) {
      super(type);
      this.ctrlKey = init.ctrlKey ?? false;
      this.metaKey = false;
      this.shiftKey = init.shiftKey ?? false;
    }
  }
  class TestPointerEvent extends TestMouseEvent {}
  let cleanupDom: (() => void) | null = null;
  let previousMouseEvent: typeof MouseEvent | undefined;
  let previousPointerEvent: typeof PointerEvent | undefined;
  let tilesetId = "";
  function currentTileset(): TilesetDef {
    const tileset = store.getCurrent().tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset");
    return tileset;
  }
  function selectRectangle(tileset: TilesetDef, start: number, end: number): void {
    selectKnowledgeTile(tileset, start, new MouseEvent("click"));
    selectKnowledgeTile(tileset, end, new MouseEvent("click", { shiftKey: true }));
  }
  describe("tileset knowledge workspace", () => {
    beforeEach(() => {
      cleanupDom = installFakeDom();
      previousMouseEvent = globalThis.MouseEvent;
      previousPointerEvent = globalThis.PointerEvent;
      Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: TestMouseEvent });
      Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: TestPointerEvent });
      store.replace(createBlankProject());
      resetMapEditHistory();
      tilesetId = Object.keys(store.getCurrent().tilesets)[0] ?? "";
      activateKnowledgeWorkspace(currentTileset());
      clearKnowledgeSelection();
      updateKnowledgeDraft({ activeGroupId: null, cellLayers: null, description: "", name: "", placementRules: "" });
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = null;
      if (previousMouseEvent === undefined) Reflect.deleteProperty(globalThis, "MouseEvent");
      else Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: previousMouseEvent });
      if (previousPointerEvent === undefined) Reflect.deleteProperty(globalThis, "PointerEvent");
      else Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: previousPointerEvent });
    });

    it("renders named templates and an accessible selection summary", () => {
      const panel = renderTileGroupPanel(currentTileset(), () => undefined) as unknown as FakeElement;

      expect(findByTestId(panel, "tileset-knowledge-inspector")).not.toBeNull();
      expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
      expect(findByTestId(panel, "tileset-knowledge-template-water-atlas-9x9")).not.toBeNull();
      expect(findByTestId(panel, "tileset-knowledge-template-repeatable-cliff-2x3")).not.toBeNull();
      expect(findByTestId(panel, "tileset-knowledge-selection-summary")?.textContent).toContain("타일");
    });

    it("saves and updates a 2x3 repeatable cliff under one stable group id", () => {
      const tileset = currentTileset();
      selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 1);
      chooseKnowledgeTemplate("repeatable-cliff-2x3");
      updateKnowledgeDraft({ name: "북쪽 절벽" });

      expect(saveKnowledgeDraft(tileset)).toBe(true);
      const saved = currentTileset().tileGroups?.find((group) => group.name === "북쪽 절벽");
      expect(saved?.patternGrammar?.kind).toBe("repeatable_block");
      expect(saved?.patternGrammar?.blockWidth).toBe(2);
      expect(saved?.patternGrammar?.blockHeight).toBe(3);
      expect(saved?.tileIds).toEqual([0, 1, tileset.tilesPerRow, tileset.tilesPerRow + 1, tileset.tilesPerRow * 2, (tileset.tilesPerRow * 2) + 1]);

      if (!saved) throw new Error("missing saved group");
      resetMapEditHistory();
      loadKnowledgeGroup(saved, currentTileset());
      updateKnowledgeDraft({ name: "북쪽 절벽 수정" });
      expect(saveKnowledgeDraft(currentTileset())).toBe(true);
      expect(currentTileset().tileGroups?.filter((group) => group.id === saved.id)).toHaveLength(1);
      expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽 수정");
      expect(undoMapEdit()).toBe(true);
      expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽");
    });

    it("persists directional passage and registers a real 3x3 autotile", () => {
      const tileset = currentTileset();
      selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 2);
      chooseKnowledgeTemplate("one-way-path");
      updateKnowledgeDraft({
        name: "아래로만 가는 길",
        passage: { down: true, left: false, right: false, up: false },
      });

      expect(saveKnowledgeDraft(tileset)).toBe(true);
      const saved = currentTileset().tileGroups?.find((group) => group.name === "아래로만 가는 길");
      expect(saved).toBeDefined();
      expect(currentTileset().passability[0]).toEqual({ down: true, left: false, right: false, up: false });
      const autotile = currentTileset().autotileGroups?.find((group) => group.id === saved?.id);
      expect(autotile?.neighborhood).toBe(8);
      expect(Object.keys(autotile?.variantMap ?? {})).toHaveLength(256);
    });

    it("keeps per-cell layers paired with their tile when loading knowledge", () => {
      const tileset = currentTileset();
      loadKnowledgeGroup({
        cellLayers: ["upper", "lower"],
        defaultLayer: "mixed",
        description: "Two cells",
        id: "layer-pair",
        layerHome: "perCell",
        name: "Layer pair",
        origin: "user",
        placementRules: "Keep pairing",
        role: "prop",
        source: "user",
        tileIds: [5, 4],
      }, tileset);

      expect(knowledgeSelection().selected).toEqual([4, 5]);
      expect(knowledgeDraft().cellLayers).toEqual(["lower", "upper"]);
    });

    it("clears per-cell layers when a same-sized selection moves to another tile", () => {
      const tileset = currentTileset();
      loadKnowledgeProposal({
        cellLayers: ["upper"],
        description: "Canopy",
        name: "Single cell",
        passage: { down: false, left: false, right: false, up: false },
        placementRules: "Upper only",
        template: "tree",
        tileIds: [4],
      });

      beginKnowledgeDrag(tileset, 5, new PointerEvent("pointerdown"));

      expect(knowledgeSelection().selected).toEqual([5]);
      expect(knowledgeDraft().cellLayers).toBeNull();
    });
  });
});
