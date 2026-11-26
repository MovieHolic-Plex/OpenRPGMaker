import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { withRetiredCombinedTownMaps, useRetiredCombinedTown } from "./support/retiredCombinedTownMaps";
import { commitChangeset, createDraft } from "@/editor/tools/changeset";
import type { ClusterRule, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { injectToolReasonSchema } from "@/ai/toolReason";
import { allTools, getTool, toOpenAiTools, validateArgs } from "@/editor/tools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { isPassable } from "@/project/collision";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";
import { bundledTileSemantics } from "@/assets/resourceSearch";
import { bundledTileLabels } from "@/editor/tools/tileMetadataTools";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroDungeon";
import { RETRO_WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroWorld";
import { SHIP_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsWorld";

describe("tileMetadataTools", () => {
  isolateTimers();
  // 맵 인터뷰 툴 계약(2026-07-04): get_tile_info / set_tile_metadata / upsert_tile_group
  // / analyze_map_tile_usage / highlight_map_region.
  // 핵심 계약: 사용자 확정(confirmedByUser)은 잠금·최우선, 분석은 설명 없는 타일 우선 정렬,
  // 기록된 지식은 list_resources/시스템 프롬프트에 반영된다.
  describe("tileMetadataTools", () => {
    isolateTimers();
    const WINDOW_TILE = 85;   // 상위 레이어 소품(창문) — 클러스터 페인팅용.

    // 창문(85)·TILE.* 번호와 그 라벨은 합본 마을 칩셋 것이다 — 정리 전 빈 프로젝트처럼 합본 마을 시작 맵에서 잰다.
    function ctx(): ToolContext {
      return { project: withRetiredCombinedTownMaps(createBlankProject()) };
    }
    function ctxWithMap(): { context: ToolContext; mapId: string } {
      const context = ctx();
      // create_map 의 tilesetId 생략은 새 야외 기본(버들항)이다 — 합본 마을 번호를 쓰므로 칩셋을 밝힌다.
      const created = runTool(context, "create_map", { name: "인터뷰 테스트", width: 8, height: 8, id: "map_interview", tilesetId: COMBINED_TOWN_TILESET_ID });
      expect(created.ok, created.summary).toBe(true);
      return { context, mapId: "map_interview" };
    }
    describe("set_tile_metadata", () => {
      it("라벨/설명/태그를 기록하고 기본 source는 ai다", () => {
        const context = ctx();
        const result = runTool(context, "set_tile_metadata", {
          entries: [{ tile: WINDOW_TILE, label: "창문", description: "집 벽에 붙는 장식", tags: ["집", "장식"] }],
        });
        expect(result.ok, result.summary).toBe(true);
        const meta = context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileMeta?.[WINDOW_TILE];
        expect(meta?.label).toBe("창문");
        expect(meta?.description).toBe("집 벽에 붙는 장식");
        expect(meta?.tags).toEqual(["집", "장식"]);
        expect(meta?.source).toBe("ai");
        expect(meta?.userLocked).not.toBe(true);
      });

      it("confirmedByUser=true sets canonical and compatibility confirmation fields", () => {
        const context = ctx();
        runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
        const meta = context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileMeta?.[WINDOW_TILE];
        expect(meta?.source).toBe("user");
        expect(meta?.userLocked).toBe(true);
        expect(meta?.origin).toBe("user");
        expect(meta?.locked).toBe(true);
        expect(meta?.confidence).toBe(1);
      });

      it("잠긴 타일은 confirmedByUser 없이는 덮어쓰지 못한다(건너뜀 경고)", () => {
        const context = ctx();
        runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
        const overwrite = runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "AI 추측" }] });
        expect(overwrite.ok).toBe(true);
        expect(overwrite.summary).toContain("잠금 건너뜀");
        expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileMeta?.[WINDOW_TILE].label).toBe("창문");
        // 사용자 확정으로는 수정 가능.
        runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "둥근 창문" }], confirmedByUser: true });
        expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileMeta?.[WINDOW_TILE].label).toBe("둥근 창문");
      });

      it("LLM 별칭 키(tileId/index/name)도 수용한다 — 라이브 스모크 실패 패턴 회귀", () => {
        const context = ctx();
        const result = runTool(context, "set_tile_metadata", {
          entries: [
            { tileId: WINDOW_TILE, name: "창문" },
            { index: 86, label: "창문 오른쪽" },
          ],
          confirmedByUser: true,
        });
        expect(result.ok, result.summary).toBe(true);
        const tileset = context.project.tilesets[COMBINED_TOWN_TILESET_ID];
        expect(tileset.tileMeta?.[WINDOW_TILE].label).toBe("창문");
        expect(tileset.tileMeta?.[86].label).toBe("창문 오른쪽");
      });

      it("범위 밖 타일은 실패한다", () => {
        const context = ctx();
        const result = runTool(context, "set_tile_metadata", { entries: [{ tile: 99999, label: "x" }] });
        expect(result.ok).toBe(false);
      });
    });
    describe("get_tile_info", () => {
      it("reports modern-only locks through the compatibility response field", () => {
        const context = ctx();
        const tileset = context.project.tilesets[COMBINED_TOWN_TILESET_ID];
        const current = tileset.tileMeta?.[WINDOW_TILE] ?? { label: "", description: "" };
        if (!tileset.tileMeta) throw new Error("missing tile metadata");
        tileset.tileMeta[WINDOW_TILE] = { ...current, locked: true };

        const result = runTool(context, "get_tile_info", { tileIds: [WINDOW_TILE] });
        const data = result.data as { tiles: Array<{ userLocked: boolean }> };

        expect(data.tiles[0]?.userLocked).toBe(true);
      });

      it("기록된 라벨/태그/통행성/레이어/그룹 규칙을 돌려준다", () => {
        const context = ctx();
        runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문", tags: ["집"] }], confirmedByUser: true });
        runTool(context, "upsert_tile_group", {
          name: "집 장식",
          role: "prop",
          tileIds: [WINDOW_TILE],
          placementRules: "벽 타일 위에만 배치",
        });
        const result = runTool(context, "get_tile_info", { tileIds: [WINDOW_TILE, TILE.WALL] });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { tiles: Array<Record<string, unknown>> };
        expect(data.tiles).toHaveLength(2);
        const windowInfo = data.tiles[0];
        expect(windowInfo.label).toBe("창문");
        expect(windowInfo.userLocked).toBe(true);
        // 번들 기본 그룹이 이미 있을 수 있으므로 내가 만든 규칙이 포함되는지만 본다.
        expect((windowInfo.groups as Array<{ placementRules: string }>).some((group) => group.placementRules === "벽 타일 위에만 배치")).toBe(true);
        const wallInfo = data.tiles[1];
        expect(wallInfo.passable).toBe(false); // WALL은 통행 불가.
      });
    });
    describe("upsert_tile_group", () => {
      it("그룹을 생성하고 defaultLayer를 priority에서 추론한다", () => {
        const context = ctx();
        const result = runTool(context, "upsert_tile_group", {
          name: "울타리",
          role: "fence",
          tileIds: [378, 379, 380],
          placementRules: "모서리→가로 반복→모서리 순서로 배치",
        });
        expect(result.ok, result.summary).toBe(true);
        // 번들 타일셋에 같은 이름의 기본 그룹이 있으므로 반환된 groupId로 찾는다.
        const groupId = (result.data as { groupId: string }).groupId;
        const group = context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((entry) => entry.id === groupId);
        expect(group).toBeDefined();
        expect(group?.placementRules).toContain("반복");
        expect(group?.source).toBe("user");
        const update = runTool(context, "upsert_tile_group", {
          id: groupId,
          name: "나무 울타리",
          role: "fence",
          tileIds: [378, 379],
        });
        expect(update.ok).toBe(true);
        expect((update.data as { created: boolean }).created).toBe(false);
        expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((entry) => entry.id === groupId)?.name).toBe("나무 울타리");
      });

      it("모르는 id/role은 거부한다", () => {
        const context = ctx();
        expect(runTool(context, "upsert_tile_group", { id: "ghost", name: "x", role: "fence", tileIds: [1] }).ok).toBe(false);
        expect(runTool(context, "upsert_tile_group", { name: "x", role: "flying", tileIds: [1] }).ok).toBe(false);
      });
    });
    describe("analyze_map_tile_usage", () => {
      it("클러스터 bbox·인접 통계·설명 없는 타일 우선 정렬을 제공한다", () => {
        const { context, mapId } = ctxWithMap();
        const map = context.project.maps[mapId];
        // (2,2)~(4,3)에 창문 타일 2x3 클러스터를 상위 레이어에 깐다.
        for (let y = 2; y <= 3; y += 1) {
          for (let x = 2; x <= 4; x += 1) map.upperTiles[y * map.width + x] = WINDOW_TILE;
        }
        // 정렬(설명됨 vs 설명 없음)을 검증하려면 설명된 타일도 포함해야 한다(기본값은 설명 없는 것만).
        const result = runTool(context, "analyze_map_tile_usage", { mapId, includeDescribed: true });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as {
          coverage: { used: number; described: number };
          tiles: Array<{ tile: number; described: boolean; count: number; sampleRegion: { x: number; y: number; w: number; h: number }; mostCommonBelow: number | null; label?: string; knownVia: string | null }>;
        };
        const windowStat = data.tiles.find((stat) => stat.tile === WINDOW_TILE);
        expect(windowStat).toBeDefined();
        expect(windowStat?.count).toBe(6);
        expect(windowStat?.sampleRegion).toEqual({ x: 2, y: 2, w: 3, h: 2 });
        // 클러스터 바로 아래 줄: (2..4,4) — 상위는 비었고 하위는 잔디.
        expect(windowStat?.mostCommonBelow).toBe(TILE.GRASS);
        // 설명 없는 타일이 설명된 타일보다 앞에 온다.
        const firstDescribedIndex = data.tiles.findIndex((stat) => stat.described);
        const lastUndescribedIndex = data.tiles.map((stat) => stat.described).lastIndexOf(false);
        if (firstDescribedIndex !== -1 && lastUndescribedIndex !== -1) {
          expect(lastUndescribedIndex).toBeLessThan(firstDescribedIndex);
        }
      });

      it("사용자가 가르친 타일은 described=true, knownVia=user로 바뀐다", () => {
        const { context, mapId } = ctxWithMap();
        const map = context.project.maps[mapId];
        map.upperTiles[2 * map.width + 2] = WINDOW_TILE;
        const before = runTool(context, "analyze_map_tile_usage", { mapId });
        const beforeStat = (before.data as { tiles: Array<{ tile: number; knownVia: string | null }> }).tiles.find((stat) => stat.tile === WINDOW_TILE);
        runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
        // 확정 후에는 described=true라 기본 목록에서 빠진다 — 포함시켜 상태 전이를 검증한다(#7 회귀).
        const after = runTool(context, "analyze_map_tile_usage", { mapId, includeDescribed: true });
        const afterStat = (after.data as { tiles: Array<{ tile: number; described: boolean; knownVia: string | null; label?: string }> }).tiles.find((stat) => stat.tile === WINDOW_TILE);
        expect(afterStat?.described).toBe(true);
        expect(afterStat?.knownVia).toBe("user");
        expect(afterStat?.label).toBe("창문");
        // 가르치기 전에는 최소한 user는 아니어야 한다.
        expect(beforeStat?.knownVia).not.toBe("user");
      });
    });
    describe("show_tiles", () => {
      it("타일 목록을 표시 데이터로 돌려준다(최대 12개, 범위 검증)", () => {
        const context = ctx();
        const result = runTool(context, "show_tiles", { tileIds: [WINDOW_TILE, 86, 87] });
        expect(result.ok, result.summary).toBe(true);
        expect(result.data).toEqual({ tilesetId: COMBINED_TOWN_TILESET_ID, tiles: [WINDOW_TILE, 86, 87] });
        expect(runTool(context, "show_tiles", { tileIds: [99999] }).ok).toBe(false);
        expect(runTool(context, "show_tiles", { tileIds: [] }).ok).toBe(false);
      });
    });
    describe("highlight_map_region", () => {
      it("범위를 맵 안으로 클램프해 강조 영역을 돌려준다", () => {
        const { context, mapId } = ctxWithMap();
        const result = runTool(context, "highlight_map_region", { mapId, x: -3, y: 5, w: 100, h: 2 });
        expect(result.ok, result.summary).toBe(true);
        expect(result.data).toEqual({ mapId, x: 0, y: 5, w: 8, h: 2 });
      });
    });
    describe("타일 지식 배선(검색·시스템 프롬프트)", () => {
      it("가르친 라벨이 list_resources(tile) 검색에 히트한다", () => {
        const context = ctx();
        runTool(context, "set_tile_metadata", {
          entries: [{ tile: WINDOW_TILE, label: "루비 창문", tags: ["보석집"] }],
          confirmedByUser: true,
        });
        const byLabel = runTool(context, "list_resources", { kind: "tile", query: "루비 창문" });
        expect(byLabel.ok).toBe(true);
        const matches = (byLabel.data as { matches: Array<{ id: string }> }).matches;
        expect(matches.some((match) => match.id === `tile:${WINDOW_TILE}`)).toBe(true);
        // 커스텀 태그로도 검색된다.
        const byTag = runTool(context, "list_resources", { kind: "tile", query: "보석집" });
        expect((byTag.data as { matches: Array<{ id: string }> }).matches.some((match) => match.id === `tile:${WINDOW_TILE}`)).toBe(true);
      });

      it("그룹 이름이 소속 타일의 검색 태그가 된다", () => {
        const context = ctx();
        runTool(context, "upsert_tile_group", { name: "수정 울타리", role: "fence", tileIds: [378] });
        const result = runTool(context, "list_resources", { kind: "tile", query: "수정 울타리" });
        expect((result.data as { matches: Array<{ id: string }> }).matches.some((match) => match.id === "tile:378")).toBe(true);
      });

      it("사용자가 가르친 타일이 있으면 시스템 프롬프트에 타일 지식 섹션이 실린다", () => {
        const context = ctx();
        const blankPrompt = buildSystemPrompt(context.project);
        expect(blankPrompt).not.toContain("타일 지식");
        runTool(context, "set_tile_metadata", {
          entries: [{ tile: WINDOW_TILE, label: "루비 창문", description: "보석 저택 전용 창문" }],
          confirmedByUser: true,
        });
        runTool(context, "upsert_tile_group", {
          name: "보석 저택",
          role: "building",
          tileIds: [WINDOW_TILE],
          placementRules: "벽 위에 가로로 배치",
        });
        const prompt = buildSystemPrompt(context.project);
        expect(prompt).toContain("타일 지식");
        expect(prompt).toContain("루비 창문");
        expect(prompt).toContain("벽 위에 가로로 배치");
      });
    });
  });
  describe("toolCommitHotPath", () => {
    isolateTimers();
    function at(map: GameMap, x: number, y: number): number {
      return y * map.width + x;
    }
    function adjacencyGroup(): TileGroupMetadata {
      const rule: ClusterRule = {
        id: "roof-wall-hard",
        kind: "adjacency",
        params: { a: 260, b: 290, relation: "aAboveB" },
        strength: "hard",
      };
      return {
        defaultLayer: "lower",
        description: "260은 290 바로 위에 있어야 한다",
        id: "roof-wall",
        name: "지붕-벽",
        placementRules: "260 아래에는 290",
        role: "building",
        rules: [rule],
        tileIds: [260, 290],
      };
    }
    function twoMapProject(): { readonly project: Project; readonly left: GameMap; readonly right: GameMap } {
      const project = withRetiredCombinedTownMaps(createBlankProject());
      const left = useRetiredCombinedTown(createBlankMap("map-left", 6, 6));
      const right = useRetiredCombinedTown(createBlankMap("map-right", 6, 6));
      project.maps = { [left.id]: left, [right.id]: right };
      project.mapTree = { mapId: left.id, children: [{ mapId: right.id, children: [] }] };
      project.startMapId = left.id;
      project.startPos = { x: 0, y: 0 };
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [adjacencyGroup()];
      return { project, left, right };
    }
    describe("AI 타일 커밋 핫패스", () => {
      it("createDraft는 타일 버퍼를 원본과 분리해 복사한다", () => {
        const project = withRetiredCombinedTownMaps(createBlankProject());
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("시작 맵이 없습니다");
        map.lowerTiles[0] = 3;
        map.lowerTileStacks = { 0: [4, 5] };
        const draft = createDraft(project);
        const cloned = draft.maps[map.id];
        if (!cloned) throw new Error("복제 맵이 없습니다");
        cloned.lowerTiles[0] = 9;
        cloned.lowerTileStacks?.[0]?.push(8);
        expect(map.lowerTiles[0]).toBe(3);
        expect(map.lowerTileStacks[0]).toEqual([4, 5]);
        expect(cloned.lowerTiles).not.toBe(map.lowerTiles);
      });

      it("skipRoundtrip 커밋은 직렬화 실패를 차단 사유로 쓰지 않는다", () => {
        const project = withRetiredCombinedTownMaps(createBlankProject());
        Object.defineProperty(project, "boom", {
          enumerable: true,
          get() {
            throw new Error("roundtrip");
          },
        });
        const blocked = commitChangeset(project);
        expect(blocked.ok).toBe(false);
        expect(blocked.issues.some((issue) => issue.code === "serialize-roundtrip")).toBe(true);

        const passed = commitChangeset(project, undefined, { skipRoundtrip: true });
        expect(passed.ok).toBe(true);
        expect(passed.issues.some((issue) => issue.code === "serialize-roundtrip")).toBe(false);
      });

      it("paint_tiles는 방금 칠한 맵의 클러스터 위반만 보고한다", () => {
        const { project, left, right } = twoMapProject();
        left.lowerTiles[at(left, 1, 1)] = 260;
        right.lowerTiles[at(right, 1, 1)] = 260;
        const painted = runTool({ project }, "paint_tiles", {
          mapId: left.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.PATH,
          cells: [{ x: 3, y: 3 }],
        });
        expect(painted.ok).toBe(true);
        const cluster = painted.issues?.filter((issue) => issue.code.startsWith("cluster-rule")) ?? [];
        expect(cluster.some((issue) => issue.mapId === left.id)).toBe(true);
        expect(cluster.some((issue) => issue.mapId === right.id)).toBe(false);
      });

      it("손대지 않은 맵의 기존 클러스터 위반은 타일 도구 결과에 다시 싣지 않는다", () => {
        const { project, left, right } = twoMapProject();
        right.lowerTiles[at(right, 1, 1)] = 260;
        const painted = runTool({ project }, "paint_tiles", {
          mapId: left.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.PATH,
          cells: [{ x: 2, y: 2 }],
        });
        expect(painted.ok).toBe(true);
        const cluster = painted.issues?.filter((issue) => issue.code.startsWith("cluster-rule")) ?? [];
        expect(cluster.some((issue) => issue.mapId === right.id)).toBe(false);
      });
    });
  });
});

describe("tilePassabilityExposure", () => {
  isolateTimers();
  const SETTER = "set_tile_passability";
  const TILESET = "passage_fixture";
  const CONFIG = {
    authMode: "apiKey" as const, agentMode: "chat" as const,
    baseUrl: "x", model: "fixture", liteModel: "fixture", apiKey: "sk",
    maxToolCalls: 4, maxTokens: 512,
  };
  const SEMANTIC_TOOLS = [
    "set_tile_metadata", "upsert_tile_group", "delete_tile_group",
    "set_group_junction", "set_group_overlay", "set_cluster_rule", "upsert_palette_preset",
    "set_group_layout", "suggest_group_from_range", "propose_tile_vocabulary",
  ];
  const LEGACY_PAINT_TOOLS = ["clear_region", "scatter_object"];
  // 2026-10-07 저작권 정리로 레지스트리에서 아예 지운 옛 칠 도구(mapTools.ts — 대체는 stamp_object). 숨김보다 강하다.
  const REMOVED_PAINT_TOOLS = ["stamp_structure"];
  function passage(passable: boolean) {
    return { up: passable, down: passable, left: passable, right: passable };
  }
  // Three cells/three chips; no authored project, store, browser, or remote persistence.
  function fixture(initialPassable = false): Project {
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    const tileset: TilesetDef = {
      id: TILESET, name: "Passage fixture", image: project.tilesets[COMBINED_TOWN_TILESET_ID].image,
      tileSize: 16, tilesPerRow: 3, count: 3,
      passability: [passage(true), passage(initialPassable), passage(true)],
      priority: ["lower", "lower", "lower"], terrain: [0, 0, 0],
      tileMeta: [
        { label: "ground", description: "", source: "user", userLocked: true },
        { label: "existing label", description: "existing description", source: "ai", origin: "ai", defaultLayer: "lower", tags: ["existing-tag"] },
        { label: "untouched", description: "neighbor", source: "ai", origin: "ai", confidence: 0.5 },
      ],
      tileGroups: [], palettePresets: [],
    };
    project.tilesets = { [TILESET]: tileset };
    const map = project.maps[project.startMapId];
    Object.assign(map, { width: 3, height: 1, tilesetId: TILESET, lowerTiles: [0, 1, 2], upperTiles: [-1, -1, -1], events: [] });
    project.startPos = { x: 0, y: 0 };
    return project;
  }
  function call(name: string, args: Record<string, unknown>): ChatResult {
    return {
      message: { role: "assistant", content: null, tool_calls: [
        { id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify({ ...args, reason: "fixture passage operation" }) } },
      ] }, finishReason: "tool_calls",
    } as ChatResult;
  }
  function final(): ChatResult {
    return { message: { role: "assistant", content: "Done." }, finishReason: "stop" } as ChatResult;
  }
  function expectOnlyPassageChanged(before: Project, after: Project, passable: boolean) {
    const expected = structuredClone(before);
    const tileset = expected.tilesets[TILESET];
    tileset.passability[1] = passage(passable);
    const { defaultLayer: _inheritedLayer, ...meta } = tileset.tileMeta![1];
    tileset.tileMeta![1] = {
      ...meta, passage: passable ? "passable" : "solid",
      confidence: 1, locked: true, origin: "user", source: "user", userLocked: true,
    };
    // Full equality protects all other chips, labels, groups, maps and project metadata.
    expect(after).toEqual(expected);
    expect(isPassable(after, after.maps[after.startMapId], 1, 0)).toBe(passable);
  }
  describe("public technical tile passage capability", () => {
    it("exposes the existing native setter with only its typed passage fields", () => {
      const registered = getTool(SETTER)!;
      expect(registered.run).toBe(MAP_TOOLS.find(tool => tool.name === SETTER)!.run);
      expect(allTools().filter(tool => tool.name === SETTER)).toEqual([registered]);
      const exposed = toOpenAiTools().find(tool => tool.function.name === SETTER);
      expect(exposed).toBeDefined();
      expect(registered.deprecated).not.toBe(true);
      expect(registered.supersededBy).toBeUndefined();
      expect(registered.mode).toBe("write");
      expect(exposed!.function.parameters).toEqual(injectToolReasonSchema(registered.parameters));
      expect(Object.keys(exposed!.function.parameters.properties!).sort()).toEqual(["passable", "reason", "tile", "tilesetId"]);
      expect(registered.parameters).toMatchObject({
        type: "object", required: ["tile", "passable"], properties: {
          tilesetId: { type: "string" }, tile: { type: "integer" }, passable: { type: "boolean" },
        },
      });
    });

    it.each([SETTER, "특정 타일 통행"])("find_tools discovers the same registered schema via %s", query => {
      const result = runTool({ project: fixture() }, "find_tools", { query });
      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ matches: expect.arrayContaining([
        expect.objectContaining({ name: SETTER, mode: "write", parameters: getTool(SETTER)!.parameters }),
      ]) });
    });

    it("exposes runtime layer rules without substituting a vocabulary proposal", () => {
      const name = "set_tile_rules";
      expect(toOpenAiTools().some(tool => tool.function.name === name)).toBe(true);
      const context = { project: fixture() };
      const discovery = runTool(context, "find_tools", { query: name });
      expect(discovery.data).toMatchObject({ matches: expect.arrayContaining([
        expect.objectContaining({ name, parameters: getTool(name)!.parameters }),
      ]) });
      const args = { tilesetId: TILESET, entries: [{ tile: 1, layer: "upper" }] };
      const before = structuredClone(context.project);
      expect(runTool(context, name, args).ok).toBe(false);
      expect(context.project).toEqual(before);
      expect(runTool(context, name, { ...args, confirmedByUser: true }).ok).toBe(true);
      expect(context.project.tilesets[TILESET].priority[1]).toBe("upper");
      expect(context.project.maps).toEqual(before.maps);
    });

    // 호스티드 ci-full 샤드에서 15초를 넘겼다(ci-full 45675478186 tests (8)) — 기본 15초 대신 60초.
    it("keeps semantic teaching and superseded painting hidden", () => {
      const names = toOpenAiTools().map(tool => tool.function.name);
      for (const name of [...SEMANTIC_TOOLS, ...LEGACY_PAINT_TOOLS]) {
        expect(getTool(name)?.deprecated, name).toBe(true);
        expect(names, name).not.toContain(name);
        const result = runTool({ project: fixture() }, "find_tools", { query: name });
        const matches = (result.data as { matches: { name: string }[] }).matches;
        expect(matches.map(match => match.name), name).not.toContain(name);
      }
      for (const name of REMOVED_PAINT_TOOLS) {
        expect(getTool(name), name).toBeUndefined();
        expect(names, name).not.toContain(name);
        const result = runTool({ project: fixture() }, "find_tools", { query: name });
        const matches = (result.data as { matches: { name: string }[] }).matches;
        expect(matches.map(match => match.name), name).not.toContain(name);
      }
    }, 60_000);

    it.each([true, false])("dispatches discovered passage=%s through an ordinary detached session", async passable => {
      const project = fixture(!passable);
      const before = structuredClone(project);
      const requests: ChatRequest[] = [];
      const events: SessionEvent[] = [];
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: async (_config, request) => {
          requests.push(request);
          if (requests.length === 1) return call("find_tools", { query: SETTER, limit: 1 });
          if (requests.length === 2) {
            const discovery = request.messages.findLast(message => message.role === "tool" && message.name === "find_tools");
            expect(JSON.parse(discovery!.content as string)).toMatchObject({ ok: true, data: { matches: [
              expect.objectContaining({ name: SETTER, parameters: getTool(SETTER)!.parameters }),
            ] } });
            // Do not inject an unexposed operation: require the actual working schema first.
            expect(request.tools?.find(tool => tool.function.name === SETTER)).toEqual(toOpenAiTools().find(tool => tool.function.name === SETTER));
            return call(SETTER, { tilesetId: TILESET, tile: 1, passable });
          }
          // End at the post-dispatch request, not a fabricated final acceptance/apply.
          if (requests.length === 3) throw new LlmError("fixture-dispatch-observed", 422);
          throw new Error("Unexpected extra model request");
        },
      });
      const result = await session.sendUserMessage(`Set chip 1 physical passage to ${passable}. Keep its semantic vocabulary.`, event => events.push(event));
      expect(result.stoppedReason).toBe("error");
      expect(result.error).toBe("fixture-dispatch-observed");
      expect(requests).toHaveLength(3);
      // The first request is narrowed on purpose (the full catalog exceeds the window), so the setter
      // arrives through find_tools rather than in the opening tool list.
      expect(requests[0].tools?.some(tool => tool.function.name === "find_tools")).toBe(true);
      expect(requests[0].tools?.some(tool => tool.function.name === SETTER)).toBe(false);
      expect(events.filter(event => event.type === "tool_call")).toMatchObject([
        { name: "find_tools", result: { ok: true } },
        { name: SETTER, result: { ok: true, data: { tilesetId: TILESET, tile: 1, passable } } },
      ]);
      expect(result.proposedCalls).toHaveLength(1);
      expect(result.proposedCalls[0]).toMatchObject({ name: SETTER, destructive: false, requiresApproval: false });
      expectOnlyPassageChanged(before, session.getProposedProject(), passable);
      expectOnlyPassageChanged(before, JSON.parse(JSON.stringify(session.getProposedProject())) as Project, passable);
      expect(project).toEqual(before);
    });

    it("retains ask-mode exposure and execution refusal for this write", async () => {
      const project = fixture();
      const events: SessionEvent[] = [];
      const requests: ChatRequest[] = [];
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: async (_config, request) => {
          requests.push(request);
          return requests.length === 1 ? call(SETTER, { tilesetId: TILESET, tile: 1, passable: true }) : final();
        },
      });
      const result = await session.sendUserMessage("Is chip 1 passable?", event => events.push(event), undefined, { composerMode: "ask" });
      expect(requests[0].tools?.some(tool => tool.function.name === SETTER)).toBe(false);
      expect(events.filter(event => event.type === "tool_call")).toMatchObject([
        { name: SETTER, result: { ok: false, issues: [expect.objectContaining({ code: "composer-mode-ask" })] } },
      ]);
      expect(result.proposedCalls).toEqual([]);
      expect(session.getProposedProject()).toEqual(project);
    });

    it.each([
      [{ tile: 1 }, "invalid-args"],
      [{ tile: 1.5, passable: true }, "invalid-args"],
      [{ tile: 1, passable: {} }, "invalid-args"],
      [{ tile: -1, passable: true }, "tile-out-of-range"],
      [{ tile: 3, passable: true }, "tile-out-of-range"],
      [{ tilesetId: "missing", tile: 1, passable: true }, "tileset-not-found"],
    ] as const)("preserves native validation and atomic refusal: %j", (args, code) => {
      const project = fixture();
      const context = { project };
      const result = runTool(context, SETTER, { tilesetId: TILESET, ...args });
      expect(result).toMatchObject({ ok: false, issues: [expect.objectContaining({ code })] });
      expect(context.project).toBe(project);
    });

    it("keeps the native passage metadata through JSON reload and bundled harness reapplication", () => {
      // tilesetId 를 생략한 호출은 시작 맵의 칩셋(342번 = 합본 마을 칩)에 쓴다.
      const context = { project: startOnRetiredCombinedTown(createBlankProject()) };
      const schema = toOpenAiTools().find(tool => tool.function.name === SETTER);
      expect(schema).toBeDefined();
      const args = { tile: 342, passable: true, reason: "repair physical passage" };
      expect(validateArgs(schema!.function.parameters, args)).toEqual([]);
      const before = structuredClone(context.project.tilesets[COMBINED_TOWN_TILESET_ID]);
      expect(runTool(context, SETTER, { tile: 342, passable: true }).ok).toBe(true);
      const reloaded = JSON.parse(JSON.stringify(context.project)) as Project;
      const tileset = reloaded.tilesets[COMBINED_TOWN_TILESET_ID];
      const target = structuredClone(tileset.tileMeta![342]);
      expect(target).toMatchObject({ passage: "passable", origin: "user", source: "user", locked: true, userLocked: true });
      applyCombinedTownHarness(tileset);
      expect(tileset.passability[342]).toEqual(passage(true));
      expect(tileset.tileMeta![342]).toEqual(target);
      expect(tileset.passability[343]).toEqual(before.passability[343]);
      expect(tileset.tileMeta![343]).toEqual(before.tileMeta![343]);
      expect(tileset.tileGroups).toEqual(before.tileGroups);
    });
  });
});

describe("tileSemanticsRetroExterior", () => {
  isolateTimers();
  // 픽셀이 거의 같은 칩셋끼리는 라벨도 거의 같아야 한다.
  //
  // 왜 이 테스트가 존재하는가 (실측): 번들 칩셋 PNG 를 전수 대조해 보니
  // easyrpg-chipset-retro-exterior-transparent.png 와 retro-house-transparent.png 는
  // **RGB 차이가 0.4%** 다. 사실상 같은 그림이다. 그런데 출하되던 두 시맨틱 테이블은
  // 공통 478칸에서 **role 일치 24.5%, label 일치 0.0%** 였다.
  // 같은 그림을 설명하는 두 표가 4분의 3이 어긋난다는 건 최소 하나가 그림을 안 보고 쓰였다는 뜻이다.
  // 실제로 같은 픽셀(12~17)을 한쪽은 "갈아엎은 흙밭", 다른 쪽은 "나무 침대 머리"라고 적어 놨고,
  // 그림에서는 조석 벽판 위 목조 머리보였다.
  //
  // 이 불일치는 색·통행성만 보던 기존 감사로는 잡히지 않았다. 두 표를 서로 비교해야만 드러난다.
  // 그래서 "중복 시트 간 role 합치도" 를 불변식으로 고정한다. 다시 24% 로 주저앉으면 빨간불이다.
  //
  // 임계값 70%: 재감사 후 실측 82.0%(출하 24.5%). 100% 를 요구하지 않는 이유가 둘 있다.
  //   1) 두 시트가 완전히 같은 그림은 아니다 — 0.4% 픽셀은 실제로 다른 타일이다.
  //   2) 판독이 갈린 688칸은 지어내지 않고 기존 라벨을 그대로 두는데, 기존 라벨이 두 표에서
  //      서로 다르므로 그만큼은 구조적으로 어긋난 채 남는다.
  // 이 테스트가 잡아야 하는 건 미세한 변동이 아니라 24% 수준으로 되돌아가는 붕괴다.
  // 그래서 실측값에 딱 붙이지 않고 여유를 둔다.
  describe("tileSemanticsDuplicateSheetConsistency", () => {
    isolateTimers();
    describe("중복 칩셋 시트의 라벨 합치도", () => {
      it("같은 그림이므로 두 테이블의 role 이 70% 이상 일치한다", () => {
        const house = new Map(RETRO_HOUSE_TILE_SEMANTICS.map((e) => [e.index, e]));
        let shared = 0;
        let sameRole = 0;
        const drift: string[] = [];
        for (const ext of RETRO_EXTERIOR_TILE_SEMANTICS) {
          const hou = house.get(ext.index);
          if (!hou) continue;
          shared += 1;
          if (ext.role === hou.role) sameRole += 1;
          else if (drift.length < 12) drift.push(`${ext.index}: exterior=${ext.label}(${ext.role}) house=${hou.label}(${hou.role})`);
        }
        expect(shared).toBeGreaterThan(400);
        const ratio = sameRole / shared;
        expect(
          ratio,
          `같은 그림인데 role 이 ${(100 * ratio).toFixed(1)}% 만 일치한다. 한쪽 표가 그림을 안 보고 쓰였을 수 있다.\n` +
            `어긋난 칸 예시:\n  ${drift.join("\n  ")}`,
        ).toBeGreaterThanOrEqual(0.7);
      });

      it("두 테이블 모두 12~17 을 침대나 흙밭이 아니라 벽으로 본다", () => {
        // 실측 회귀 지점: 이 여섯 칸은 조석/회벽 벽판 위의 목조 머리보다.
        // 3x2 크롭만 보면 2단 침대로 읽히고(PR #86 이 그렇게 읽었다), 아래 4행까지 붙여 보면 벽이다.
        for (const table of [RETRO_EXTERIOR_TILE_SEMANTICS, RETRO_HOUSE_TILE_SEMANTICS]) {
          const byIndex = new Map(table.map((e) => [e.index, e]));
          for (const index of [12, 13, 14, 15, 16, 17]) {
            const entry = byIndex.get(index);
            expect(entry, `${index} 칸이 표에 없다`).toBeDefined();
            expect(entry!.role, `${index} 은 "${entry!.label}"(${entry!.role}) 로 적혀 있다`).toBe("wall");
          }
        }
      });
    });
  });
  // 렌더된 그림을 실제로 보고 판정한 사실만 단정한다.
  //
  // 왜 이 테스트가 존재하는가: 이 시트들의 라벨은 두 번 틀렸고, 두 번 다 기존 게이트를 통과했다.
  //
  // 1차 오류(PR #81) — 판독자가 타일을 볼 수 없었다. 샤드 shard-retro_exterior-08-11 은
  //   카테고리 unspecified-low 로 갔고 그 1순위 모델(cliproxy/deepseek-v4-flash-0731)은 비전이 없다.
  //   그 샤드는 완료 보고에 "the model couldn't render them as images" 라 적고 픽셀 통계로
  //   119칸을 추론했다. audit-tile-semantics-grounding.mts 는 색·통행성 모순만 보므로
  //   "가구를 벽이라 부르는" 종류를 원리적으로 못 잡고 위반 2/2856 으로 통과시켰다.
  //
  // 2차 오류(PR #86) — 교정하던 내가 3x2 크롭만 보고 아래 행을 잘라냈다. retro_house 12-17 을
  //   "나무 침대"+role=furniture 로 바꿨는데, 10배 확대 + 아래 4행 맥락으로 보면 그 여섯 칸은
  //   건물 벽 상단 목재 머리보이고 아래로 42-44/72-74=분홍 조석 벽판, 45-47/75-77=크림 회벽판이
  //   아치로 이어진다. 침대가 아니다. #86 의 "roof slot now resolves to 42-44" 도 같은 이유로 틀렸다.
  //   증거: .omo/evidence/tile-reaudit/vision-probe/house-cols10-19-rows0-4.png
  //
  // 그래서 이 테스트는 "라벨 문구"가 아니라 **그림이 반증한 주장**만 못 박는다. 문구 자체를
  // 고정하면 저작 자유를 죽이고 동어반복이 된다. 반증 가능한 명제만 단정한다.
  describe("tileSemanticsReauditEvidence", () => {
    isolateTimers();
    interface Entry {
      readonly index: number;
      readonly label: string;
      readonly role: string;
      readonly passage: "passable" | "solid";
      readonly tags: readonly string[];
    }
    function at(table: readonly Entry[], index: number): Entry {
      const found = table.find((entry) => entry.index === index);
      expect(found, `인덱스 ${index} 엔트리가 있어야 한다`).toBeDefined();
      return found!;
    }
    describe("retro_house 12-17 — 벽 상단 머리보이고 침대가 아니다", () => {
      const BEAM_SLOTS = [12, 13, 14, 15, 16, 17] as const;

      it.each(BEAM_SLOTS)("타일 %i 를 가구로 부르지 않는다", (index) => {
        const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
        // 아래로 벽판이 이어지므로 이 칸은 벽 구조의 일부다. 독립 가구가 아니다.
        expect(entry.role).not.toBe("furniture");
      });

      it.each(BEAM_SLOTS)("타일 %i 라벨이 침대를 주장하지 않는다", (index) => {
        const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
        expect(entry.label).not.toContain("침대");
        expect(entry.tags.join(" ")).not.toContain("침대");
      });

      it("42-44 는 지붕이 아니라 벽판이다 — #86 의 roof 재배정도 틀렸다", () => {
        for (const index of [42, 43, 44]) {
          const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
          expect(entry.role, `타일 ${index} 는 분홍 조석 벽판이다`).not.toBe("roof");
        }
      });
    });
    describe("retro_exterior 179 — 금빛 문장 든 붉은 깃발이고 지붕이 아니다", () => {
      it("179 를 지붕으로 부르지 않는다", () => {
        const entry = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
        // 179 는 5행 29열(맨 오른쪽 끝)이라 180·181 은 다음 행으로 넘어가 이웃이 아니다.
        // 아래 209 와 이어져 제비꼬리 하단이 드러난다 = 깃발/페넌트.
        expect(entry.role).not.toBe("roof");
        expect(entry.label).not.toContain("지붕");
        expect(entry.label).not.toContain("처마");
      });

      it("179 와 209 가 같은 깃발의 위아래로 읽힌다", () => {
        const top = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
        const bottom = at(RETRO_EXTERIOR_TILE_SEMANTICS, 209);
        expect(`${top.label} ${top.tags.join(" ")}`).toContain("깃발");
        expect(`${bottom.label} ${bottom.tags.join(" ")}`).toContain("깃발");
      });
    });
  });
  // EasyRPG 번들 칩셋 6종(retro_dungeon/retro_exterior/retro_house/retro_world/ship/world)의
  // 시맨틱 테이블이 **칩셋별로 정확히 배선**되는지 단정한다.
  //
  // 왜 이 테스트가 존재하는가: resourceSearch.ts 의 폴백이
  //   if (tileset?.image.type === "bundled") return COMBINED_TOWN_TILE_SEMANTICS;
  // 였기 때문에, interior/dungeon 이 아닌 모든 번들 칩셋(배·월드맵·레트로 4종)이 **마을 라벨을
  // 오답으로** 받아 갔다. AI 검색과 타일 라벨 조회가 전부 다른 칩셋의 사실을 인용하게 된다.
  // 이 테스트는 그 오답을 재발 시 즉시 빨간불로 만든다.
  describe("tileSemanticsSixChipsets", () => {
    isolateTimers();
    function bundledTileset(textureKey: string): TilesetDef {
      return {
        id: `test-${textureKey}`,
        name: textureKey,
        image: { type: "bundled", id: textureKey },
        tileSize: 16,
        columns: 30,
        rows: 16,
      } as unknown as TilesetDef;
    }
    /** 6종 + 기존 3종 = 배선이 정확히 9갈래로 갈라져야 한다. */
    const WIRING = [
      { textureKey: "tex_easyrpg_chipset_retro_dungeon", table: RETRO_DUNGEON_TILE_SEMANTICS, drawable: 478 },
      { textureKey: "tex_easyrpg_chipset_retro_exterior", table: RETRO_EXTERIOR_TILE_SEMANTICS, drawable: 478 },
      { textureKey: "tex_easyrpg_chipset_retro_house", table: RETRO_HOUSE_TILE_SEMANTICS, drawable: 478 },
      { textureKey: "tex_easyrpg_chipset_retro_world", table: RETRO_WORLD_TILE_SEMANTICS, drawable: 480 },
      { textureKey: "tex_easyrpg_chipset_ship", table: SHIP_TILE_SEMANTICS, drawable: 464 },
      { textureKey: "tex_easyrpg_chipset_world", table: WORLD_TILE_SEMANTICS, drawable: 478 },
    ] as const;
    describe("6종 번들 칩셋 시맨틱 배선", () => {
      it.each(WIRING)("$textureKey 는 자기 전용 테이블을 돌려준다", ({ textureKey, table }) => {
        const resolved = bundledTileSemantics(bundledTileset(textureKey));
        expect(resolved).toBe(table);
      });

      it.each(WIRING)("$textureKey 는 마을 테이블을 돌려주지 않는다", ({ textureKey }) => {
        const resolved = bundledTileSemantics(bundledTileset(textureKey));
        expect(resolved).not.toBe(COMBINED_TOWN_TILE_SEMANTICS);
        expect(resolved).not.toBe(INTERIOR_TILE_SEMANTICS);
        expect(resolved).not.toBe(DUNGEON_TILE_SEMANTICS);
      });

      it.each(WIRING)("$textureKey 는 도화 가능 칸 전수를 라벨로 노출한다", ({ textureKey, drawable }) => {
        const labels = bundledTileLabels(bundledTileset(textureKey));
        expect(labels.size).toBe(drawable);
      });

      it("기존 3종 배선은 그대로다", () => {
        expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_interior"))).toBe(INTERIOR_TILE_SEMANTICS);
        expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_dungeon"))).toBe(DUNGEON_TILE_SEMANTICS);
        expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_combined_town"))).toBe(COMBINED_TOWN_TILE_SEMANTICS);
      });
    });
  });
});
