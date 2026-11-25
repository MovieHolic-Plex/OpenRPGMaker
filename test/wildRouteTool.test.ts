import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, JsonSchema } from "@/editor/tools/types";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { withRetiredCombinedTownMaps, useRetiredCombinedTown } from "./support/retiredCombinedTownMaps";
import { commitChangeset, createDraft } from "@/editor/tools/changeset";
import type { ClusterRule, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { AssistantSession, type SessionEvent, type ProposedCall } from "@/ai/assistantSession";
import { LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { injectToolReasonSchema } from "@/ai/toolReason";
import { allTools, getTool, toOpenAiTools, validateArgs } from "@/editor/tools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { isPassable, canMove } from "@/project/collision";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { applyVocabularyCardEdits, callsWithVocabularyEdits, hasVocabularyEdits, reassembleSelectedProposalProject, renderVocabularyCardList, vocabularyCardsData, type VocabularyCardEdit } from "@/editor/panels/aiChatPanel";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { eligibleEncounterEntries } from "@/player/encounters";
import { startSession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

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
    });

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

describe("wildRouteTool", () => {
  isolateTimers();
  // test/toolsMapRegionMove.test.ts
  // move_region 계약: 잘라내기+붙여넣기. 세 가지가 이 툴의 존재 이유이고 각각 아래 케이스가 잠근다.
  // (1) 겹치는 같은-맵 이동에서 목적지에 쓴 칸은 비우지 않는다. (2) 원본 비우기는 layers 범위를
  // 지킨다. (3) 원본 비우기도 통행 보장 칸(시작 위치·transfer 목적지)의 기록자다.
  describe("toolsMapRegionMove", () => {
    isolateTimers();
    const SRC = "map_move_src";
    const DST = "map_move_dst";
    function context(size = 12): ToolContext {
      const context: ToolContext = { project: createBlankProject() };
      for (const [id, name] of [[SRC, "원본"], [DST, "대상"]] as const) {
        const created = runTool(context, "create_map", { name, width: size, height: size, id });
        expect(created.ok, created.summary).toBe(true);
      }
      return context;
    }
    /** 영역 각 칸에 고유 타일 id 를 심는다 — 이동 결과를 칸 단위로 식별하기 위한 픽스처. */
    function paintUnique(context: ToolContext, mapId: string, rect: { x: number; y: number; w: number; h: number }): void {
      const map = context.project.maps[mapId];
      for (let dy = 0; dy < rect.h; dy += 1) {
        for (let dx = 0; dx < rect.w; dx += 1) {
          const index = (rect.y + dy) * map.width + rect.x + dx;
          const serial = dy * rect.w + dx;
          map.lowerTiles[index] = 200 + serial;
          map.upperTiles[index] = 100 + serial;
        }
      }
    }
    function lowerAt(context: ToolContext, mapId: string, x: number, y: number): number {
      const map = context.project.maps[mapId];
      return map.lowerTiles[y * map.width + x];
    }
    function upperAt(context: ToolContext, mapId: string, x: number, y: number): number {
      const map = context.project.maps[mapId];
      return map.upperTiles[y * map.width + x];
    }
    describe("move_region", () => {
      it("스키마가 strict 제공자 규약(oneOf 없음, array는 items, object는 properties)을 지킨다", () => {
        const tool = getTool("move_region");
        expect(tool, "move_region 툴이 등록되어 있어야 한다").toBeDefined();
        if (!tool) return;
        expect(tool.mode).toBe("write");
        const visit = (node: JsonSchema, path: string): void => {
          expect(node.oneOf, `${path}: oneOf 금지`).toBeUndefined();
          if (node.type === "array") expect(node.items, `${path}: array는 items 필요`).toBeDefined();
          if (node.type === "object") expect(node.properties, `${path}: object는 properties 필요`).toBeDefined();
          for (const [key, child] of Object.entries(node.properties ?? {})) visit(child, `${path}.${key}`);
          if (node.items) visit(node.items, `${path}[]`);
        };
        visit(tool.parameters, "parameters");
      });

      it("정확한 이름으로 find_tools 하면 스키마가 돌아온다", () => {
        const ctx = context();
        const found = runTool(ctx, "find_tools", { query: "move_region" });
        expect(found.ok, found.summary).toBe(true);
        expect(JSON.stringify(found.data)).toContain("move_region");
      });

      it("다른 맵으로 옮기면 목적지에 찍히고 원본은 잔디로 비워진다", () => {
        const ctx = context();
        paintUnique(ctx, SRC, { x: 2, y: 3, w: 3, h: 2 });
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 2, y: 3, w: 3, h: 2 },
          to: { mapId: DST, x: 6, y: 7 },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(lowerAt(ctx, DST, 6, 7)).toBe(200);
        expect(upperAt(ctx, DST, 8, 8)).toBe(105);
        // 원본은 비워진다 — 기본 fill 은 clear_region 과 같은 잔디다.
        expect(lowerAt(ctx, SRC, 2, 3)).toBe(TILE.GRASS);
        expect(upperAt(ctx, SRC, 2, 3)).toBe(TILE.EMPTY);
        expect(lowerAt(ctx, SRC, 4, 4)).toBe(TILE.GRASS);
      });

      it("fill:empty 는 원본 하위 레이어를 빈 칸으로 비운다", () => {
        const ctx = context();
        paintUnique(ctx, SRC, { x: 1, y: 1, w: 2, h: 2 });
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 1, y: 1, w: 2, h: 2 },
          to: { mapId: DST, x: 5, y: 5 },
          fill: "empty",
        });
        expect(result.ok, result.summary).toBe(true);
        expect(lowerAt(ctx, SRC, 1, 1)).toBe(TILE.EMPTY);
        expect(result.summary).toContain("빈 칸");
      });

      it("같은 맵에서 겹치게 옮겨도 목적지에 쓴 칸은 비우지 않는다", () => {
        const ctx = context();
        // 3×1 을 오른쪽으로 한 칸 — 목적지 두 칸이 원본과 겹친다.
        paintUnique(ctx, SRC, { x: 2, y: 5, w: 3, h: 1 });
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 2, y: 5, w: 3, h: 1 },
          to: { mapId: SRC, x: 3, y: 5 },
        });
        expect(result.ok, result.summary).toBe(true);
        // 옮긴 내용이 그대로 살아 있어야 한다(원본 rect 를 통째로 지우면 여기가 잔디가 된다).
        expect(lowerAt(ctx, SRC, 3, 5)).toBe(200);
        expect(lowerAt(ctx, SRC, 4, 5)).toBe(201);
        expect(lowerAt(ctx, SRC, 5, 5)).toBe(202);
        // 겹치지 않은 원본 첫 칸만 비워진다.
        expect(lowerAt(ctx, SRC, 2, 5)).toBe(TILE.GRASS);
      });

      it("layers:upper 는 상위만 옮기고 원본 바닥을 보존한다", () => {
        const ctx = context();
        paintUnique(ctx, SRC, { x: 4, y: 4, w: 2, h: 1 });
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 4, y: 4, w: 2, h: 1 },
          to: { mapId: SRC, x: 8, y: 4 },
          layers: "upper",
        });
        expect(result.ok, result.summary).toBe(true);
        expect(upperAt(ctx, SRC, 8, 4)).toBe(100);
        expect(upperAt(ctx, SRC, 4, 4)).toBe(TILE.EMPTY);
        // 계단만 옮겼으므로 원래 자리 바닥에 구멍이 나지 않는다.
        expect(lowerAt(ctx, SRC, 4, 4)).toBe(200);
        // 목적지 바닥도 건드리지 않는다.
        expect(lowerAt(ctx, SRC, 8, 4)).not.toBe(200);
      });

      it("맵 밖 from/to 는 region-out-of-bounds 로 거절한다", () => {
        const ctx = context();
        const badFrom = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 10, y: 10, w: 5, h: 5 },
          to: { mapId: SRC, x: 0, y: 0 },
        });
        expect(badFrom.ok).toBe(false);
        expect(badFrom.summary).toContain("12×12");
        const badTo = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 0, y: 0, w: 3, h: 3 },
          to: { mapId: SRC, x: 11, y: 11 },
        });
        expect(badTo.ok).toBe(false);
        expect(badTo.summary).toContain("12×12");
      });

      it("제자리 이동은 invalid-args 로 거절한다", () => {
        const ctx = context();
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
          to: { mapId: SRC, x: 2, y: 2 },
        });
        expect(result.ok).toBe(false);
        expect(result.summary).toContain("오프셋");
      });

      it("다른 맵으로 이벤트를 옮기라는 요청은 거절한다", () => {
        const ctx = context();
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
          to: { mapId: DST, x: 5, y: 5 },
          withEvents: true,
        });
        expect(result.ok).toBe(false);
        expect(result.summary).toContain("같은 맵");
      });

      it("withEvents 는 id 를 보존하며 이벤트를 옮긴다", () => {
        const ctx = context();
        const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_move_me" });
        expect(created.ok, created.summary).toBe(true);
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
          to: { mapId: SRC, x: 7, y: 3 },
          withEvents: true,
        });
        expect(result.ok, result.summary).toBe(true);
        const events = ctx.project.maps[SRC].events;
        expect(events.filter((event) => event.id === "ev_move_me")).toHaveLength(1);
        const moved = events.find((event) => event.id === "ev_move_me");
        expect({ x: moved?.x, y: moved?.y }).toEqual({ x: 7, y: 3 });
      });

      it("withEvents 없이 옮기면 남은 이벤트를 경고로 알린다", () => {
        const ctx = context();
        const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_stays" });
        expect(created.ok, created.summary).toBe(true);
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
          to: { mapId: SRC, x: 7, y: 3 },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.maps[SRC].events.find((event) => event.id === "ev_stays")).toMatchObject({ x: 3, y: 3 });
        expect(result.diff?.warnings.join("\n")).toContain("ev_stays");
      });

      it("원본 쪽 시작 위치는 통행 불가로 비워지지 않고 경고로 보고된다", () => {
        const ctx = context();
        expect(runTool(ctx, "set_start_position", { mapId: SRC, x: 2, y: 2 }).ok).toBe(true);
        paintUnique(ctx, SRC, { x: 2, y: 2, w: 2, h: 1 });
        const result = runTool(ctx, "move_region", {
          from: { mapId: SRC, x: 2, y: 2, w: 2, h: 1 },
          to: { mapId: DST, x: 6, y: 6 },
          fill: "empty",
        });
        expect(result.ok, result.summary).toBe(true);
        // 빈 칸(-1)은 통행 불가라 시작 위치 칸은 원래 타일로 되돌아온다.
        expect(lowerAt(ctx, SRC, 2, 2)).toBe(200);
        expect(result.diff?.warnings.join("\n")).toContain("시작 위치");
        // 보호되지 않은 이웃 칸은 정상적으로 비워진다.
        expect(lowerAt(ctx, SRC, 3, 2)).toBe(TILE.EMPTY);
      });
    });
  });
  // test/vocabCardEditV3.test.ts
  // 어휘 프로포절 카드 인라인 편집 (타일 툴 v3 설계 축 6 — V3B).
  // 고정하는 계약: (1) data.cards가 카드 UI로 렌더된다(AI 추정 표기 + 사실 배지 + 편집 필드
  // testid ai-vocab-card-<n>/ai-vocab-edit-<field>-<n>) (2) 편집값이 수락 시 커밋되는 값 —
  // 편집된 args 재조립(UXD 부분 수락 재실행 패턴)이 origin:"user"와 함께 프로젝트에 반영된다.
  describe("vocabCardEditV3", () => {
    isolateTimers();
    // 어휘 카드는 합본 마을 하네스 그룹(석벽 9분할)을 편집한다 — 정리 전 빈 프로젝트처럼 합본 마을 시작 맵에서 잰다.
    const blankCombinedTownProject = () => withRetiredCombinedTownMaps(createBlankProject());
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });
    // propose_tile_vocabulary를 실제 실행해 ProposedCall 모양의 픽스처를 만든다.
    function proposeCall(project: Project): { call: ProposedCall; groupId: string } {
      const groupId = project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups![0].id;
      const args = {
        items: [{ kind: "group", groupId, name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
      };
      const ctx: ToolContext = { project: structuredClone(project) };
      const result = runTool(ctx, "propose_tile_vocabulary", structuredClone(args));
      expect(result.ok, result.summary).toBe(true);
      return { call: { name: "propose_tile_vocabulary", args, summary: result.summary, result, destructive: false }, groupId };
    }
    describe("어휘 카드 렌더 + 인라인 편집", () => {
      it("data.cards가 카드로 렌더되고(AI 추정/사실 배지/편집 필드) 편집 이벤트가 편집값으로 수집된다", () => {
        const project = blankCombinedTownProject();
        const { call } = proposeCall(project);
        expect(vocabularyCardsData(call)?.cards).toHaveLength(1);

        const edits = new Map<number, VocabularyCardEdit>();
        const rendered = renderVocabularyCardList(project, call, 1, (cardIndex, field, value) => {
          const entry = edits.get(cardIndex) ?? {};
          entry[field] = value;
          edits.set(cardIndex, entry);
        });
        expect(rendered).not.toBeNull();
        const root = rendered!.element as unknown as FakeElement;
        const card = findByTestId(root, "ai-vocab-card-1") as unknown as FakeElement;
        expect(card).toBeTruthy();
        expect(card.textContent).toContain("AI 추정"); // 추정 표기(원칙 0)
        expect(card.textContent).toContain("사실"); // 결정론 사실 배지 병기

        const nameInput = findByTestId(root, "ai-vocab-edit-name-1") as unknown as FakeElement;
        nameInput.value = "돌담";
        nameInput.dispatchEvent(new Event("change"));
        const layerSelect = findByTestId(root, "ai-vocab-edit-layerHome-1") as unknown as FakeElement;
        layerSelect.value = "perCell";
        layerSelect.dispatchEvent(new Event("change"));
        const roleSelect = findByTestId(root, "ai-vocab-edit-role-1") as unknown as FakeElement;
        expect(roleSelect).toBeTruthy();
        expect(findByTestId(root, "ai-vocab-edit-patternKind-1")).toBeTruthy();

        expect(edits.get(0)).toMatchObject({ name: "돌담", layerHome: "perCell" });
      });

      it("편집값이 수락 시 커밋되는 값이다 — 재조립 재실행 경로가 편집된 이름/layerHome을 origin:user로 반영", () => {
        const project = blankCombinedTownProject();
        const { call, groupId } = proposeCall(project);
        const editsByCall = new Map<number, Map<number, VocabularyCardEdit>>([
          [0, new Map([[0, { name: "돌담", layerHome: "upper" }]])],
        ]);
        expect(hasVocabularyEdits(editsByCall)).toBe(true);
        const effective = callsWithVocabularyEdits([call], editsByCall);
        expect(effective).not.toBe([call]);
        const editedItem = (effective[0].args.items as Record<string, unknown>[])[0];
        expect(editedItem).toMatchObject({ name: "돌담", layerHome: "upper" });
        // 원본 call.args는 오염되지 않는다(구조 복제).
        expect((call.args.items as Record<string, unknown>[])[0].name).toBe("석벽");

        // 수락 경로와 동일한 재조립 재실행(reassembleSelectedProposalProject) — 커밋값 검증.
        const reassembled = reassembleSelectedProposalProject(project, effective, [true]);
        expect(reassembled.ok).toBe(true);
        if (!reassembled.ok) return;
        const group = reassembled.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups!.find((entry) => entry.id === groupId)!;
        expect(group).toMatchObject({ name: "돌담", layerHome: "upper", origin: "user" });
      });

      it("applyVocabularyCardEdits: 빈 이름은 무시하고 patternKind ''는 제거로 취급한다", () => {
        const args = { items: [{ kind: "group", name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }] };
        const next = applyVocabularyCardEdits(args, new Map([[0, { name: "   ", patternKind: "" }]]));
        const item = (next.items as Record<string, unknown>[])[0];
        expect(item.name).toBe("석벽");
        expect(item.patternKind).toBeUndefined();
      });
    });
  });
  describe("wildRouteTool", () => {
    isolateTimers();
    function monsterProject() {
      const choice = newProjectChoiceById("monster-collect")!;
      const project = createNewProjectSeed(choice.packId, "도로 시험");
      const troopId = project.database.troops[0]!.id;
      return { context: { project }, troopId };
    }
    describe("author_wild_route", () => {
      it("lays a road, forest and tall-grass patches whose encounters only fire inside the grass", () => {
        const { context, troopId } = monsterProject();
        const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
        expect(created.ok, created.summary).toBe(true);
        const result = runTool(context, "author_wild_route", {
          mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
        });
        expect(result.ok, result.summary).toBe(true);
        const map = context.project.maps.map_route_1!;
        const data = result.data as { grassPatches: { id: string; x: number; y: number; w: number; h: number }[]; trainerSpots: unknown[] };
        expect(data.grassPatches.length).toBeGreaterThanOrEqual(2);
        expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));
        expect(map.lowerTiles.filter(tile => tile !== TILE.GRASS).length).toBeGreaterThan(40);
        expect(map.upperTiles.some(tile => tile !== TILE.EMPTY)).toBe(true);
        expect(map.encounterTable?.every(entry => entry.conditions?.locationId?.startsWith("loc_wild_grass_"))).toBe(true);
        const session = startSession(context.project);
        const patch = data.grassPatches[0]!;
        expect(eligibleEncounterEntries(map, session, { x: patch.x, y: patch.y })).not.toHaveLength(0);
        expect(eligibleEncounterEntries(map, session, { x: 14, y: 21 })).toHaveLength(0);
      });

      it("refuses to repaint an authored map without replace", () => {
        const { context } = monsterProject();
        // 몬스터 프로젝트의 시작 맵은 monster_overworld(#2232)라 도로 시공 대상이 아니다 — 시공 가능한 새 맵에서 본다.
        expect(runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 }).ok).toBe(true);
        const map = context.project.maps.map_route_1!;
        map.upperTiles[0] = 5;
        const result = runTool(context, "author_wild_route", { mapId: "map_route_1", exits: [{ x: 0, y: 1 }, { x: map.width - 1, y: 1 }] });
        expect(result.ok).toBe(false);
        expect(result.summary).toContain("replace:true");
      });

      // 2026-09-24 포켓몬풍 r3: 동굴 파이프라인이 먼저 만든 링크 문(1,1)이 author_wild_route(replace)의
      // 숲 우물에 갇혀 autoplay 가 1번 도로 → 동굴 문으로 못 넘어갔다(check.txt 막힘). 시공은 기존
      // transfer 문까지 흙길로 이어야 한다.
      it("keeps a pre-existing transfer door walk-connected when repainting", () => {
        const { context, troopId } = monsterProject();
        const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
        expect(created.ok, created.summary).toBe(true);
        const targetMap = context.project.startMapId;
        const door = runTool(context, "upsert_event", {
          mapId: "map_route_1",
          event: {
            id: "ev_map_route_1_link", x: 1, y: 1,
            pages: [{ trigger: { kind: "playerTouch" }, conditions: [], priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: targetMap, x: 1, y: 1 }] }],
          },
        });
        expect(door.ok, door.summary).toBe(true);
        const result = runTool(context, "author_wild_route", {
          mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));

        // 남쪽 출구 (14,21) 에서 문 (1,1) 까지 실제로 걸어 닿는지 BFS 로 확인한다.
        const map = context.project.maps.map_route_1!;
        const seen = new Set<number>([21 * map.width + 14]);
        const queue: Array<{ x: number; y: number }> = [{ x: 14, y: 21 }];
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i]!;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = p.x + dx, ny = p.y + dy, key = ny * map.width + nx;
            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
            if (!canMove(context.project, map, p.x, p.y, nx, ny)) continue;
            seen.add(key); queue.push({ x: nx, y: ny });
          }
        }
        expect(seen.has(1 * map.width + 1)).toBe(true);
      });
    });
    describe("monster-collect brief prompt", () => {
      // #2232: 새 수집 게임은 build_monster_game(mode:create)이 검토된 캠페인 전체(도로 풀숲·트레이너 포함)를 짓는다.
      it("names the campaign builder so its schema is exposed on the first turn", async () => {
        const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
        const preset = welcomeGenrePresetById("monster-collect")!;
        const prompt = buildWelcomeGenrePresetPrompt(preset, {
          version: 1, presetId: "monster-collect", summary: "첫 체육관까지",
          answers: { scope: { question: "범위", label: "첫 제작 범위", text: "첫 도전장", source: "user" } },
        } as never);
        expect(prompt).toContain("build_monster_game");
      });
    });
  });
});
