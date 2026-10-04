// test/generateMap.test.ts
// generate_map: 3개 테마 × 시드 2개 → projectLint 0 error + 입구에서 모든 POI 도달 가능.

import { describe, expect, it } from "vitest";
import { projectLint } from "@/project/lint/projectLint";
import { checkReachability } from "@/project/lint/reachability";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { isPassable } from "@/project/collision";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { blockedFlag } from "@/project/tilesetPassage";
import { markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { MAX_TOOL_MAP_DIMENSION } from '@/project/mapSizeLimits';

const THEMES = ["village", "forest", "cave"] as const;
const SEEDS = [1, 99] as const;

describe("generate_map", () => {
  for (const theme of THEMES) {
    for (const seed of SEEDS) {
      it(`${theme} (seed ${seed}) — lint 0 error + 모든 POI 도달 가능`, () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const pois = [
          { x: 18, y: 2 },
          { x: 18, y: 18 },
          { x: 10, y: 18 },
        ];
        const entrance = { x: 1, y: 10 };
        const result = runTool(
          ctx,
          "generate_map",
          { theme, width: 22, height: 22, entrance, pois, chokepoints: 25, seed, id: `gen_${theme}_${seed}` },
          { dryRun: false }
        );
        expect(result.ok).toBe(true);

        // lint 0 error.
        const errors = projectLint(ctx.project).filter((issue) => issue.severity === "error");
        expect(errors).toEqual([]);

        // 입구에서 모든 POI 도달 가능.
        const map = ctx.project.maps[`gen_${theme}_${seed}`];
        expect(map).toBeDefined();
        const reach = checkReachability(ctx.project, map.id, entrance, pois);
        expect(reach.unreachable).toEqual([]);
        expect(reach.reachable).toBe(true);
      });
    }
  }

  it("장애물 밀도가 높아도(90) 도달성이 보장된다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const entrance = { x: 1, y: 1 };
    const pois = [{ x: 20, y: 20 }, { x: 20, y: 1 }, { x: 1, y: 20 }];
    const result = runTool(
      ctx,
      "generate_map",
      { theme: "cave", width: 22, height: 22, entrance, pois, chokepoints: 90, seed: 7, id: "gen_dense" },
      { dryRun: false }
    );
    expect(result.ok).toBe(true);
    const reach = checkReachability(ctx.project, "gen_dense", entrance, pois);
    expect(reach.reachable).toBe(true);
  });

  it("지원 상한 초과 생성은 거부하고 분할 맵 대안을 안내한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(ctx, "generate_map", { theme: "forest", tilesetId: 'easyrpg_chipset_combined_town', width: MAX_TOOL_MAP_DIMENSION + 1, height: 32, id: "gen_huge" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain(`최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}`);
    expect(result.summary).toContain("여러 맵");
    expect(ctx.project.maps.gen_huge).toBeUndefined();
  });

  // border:"wall" 로 고정한다 — 이 케이스가 검증하는 것은 프로필 디스패치와
  // "저작된 장애물 통행 규칙을 따르는가"이고, 그 관측점이 외곽 (0,0)이다.
  it("번들 프로필을 디스패치하되 실내는 개념 시공으로 안내한다", () => {
    const profileKeys = new Set<string>();
    let conceptInteriors = 0;
    let manualAtlases = 0;

    for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
      const tilesetId = bundledEasyRpgTilesetId(asset.textureKey);
      const ctx: ToolContext = { project: createEmptyToolProject() };
      // Match the editor's loaded state; generation is not a tileset normalizer.
      ensureBundledTilesets(ctx.project);
      if (tilesetId === "modern_exteriors_nocturne") {
        // Modern has no bundled solid rule. Exercise dispatch with an explicitly
        // authored obstacle; the untouched default is separately required to fail.
        const tileset = ctx.project.tilesets[tilesetId]!;
        tileset.passability[30] = blockedFlag();
        markUserTileRuntimeMetadata(tileset, 30, { passage: "solid" });
      }
      const beforeTilesets = structuredClone(ctx.project.tilesets);
      const result = runTool(ctx, "generate_map", {
        id: `map_${tilesetId}`,
        name: asset.name,
        theme: "village",
        tilesetId,
        width: 20,
        height: 16,
        seed: 7,
        border: "wall",
      });

      if (tilesetId === "opengameart_castle") {
        // This atlas is bundled for manual authoring; no RM2K generation palette applies.
        expect(result.ok).toBe(false);
        expect(result.issues?.some(issue => issue.code === "unsupported-tileset")).toBe(true);
        expect(ctx.project.maps[`map_${tilesetId}`]).toBeUndefined();
        manualAtlases += 1;
        continue;
      }
      if (["easyrpg_chipset_interior", "easyrpg_chipset_retro_house", "scarloxy_chipset_indoor", "scarloxy_chipset_monster_interior"].includes(tilesetId)) {
        expect(result.ok).toBe(false);
        expect(result.issues?.some(issue => issue.code === "concept-interior-required")).toBe(true);
        expect(ctx.project.maps[`map_${tilesetId}`]).toBeUndefined();
        conceptInteriors += 1;
        continue;
      }
      expect(result.ok, `${tilesetId}: ${result.summary}`).toBe(true);
      const data = result.data as { mapId: string; generationProfile: string };
      const map = ctx.project.maps[data.mapId];
      expect(map?.tilesetId).toBe(tilesetId);
      expect(map?.lowerTiles.every((tileId) => tileId >= 0 && tileId < 480)).toBe(true);
      expect(map?.upperTiles.every((tileId) => tileId === -1 || (tileId >= 0 && tileId < 480))).toBe(true);
      expect(data.generationProfile).toBe(tilesetId);
      expect(new Set(map?.lowerTiles).size, tilesetId).toBeGreaterThanOrEqual(2);
      expect(isPassable(ctx.project, map!, 0, 0)).toBe(false);
      expect(isPassable(ctx.project, map!, 1, Math.floor(map!.height / 2))).toBe(true);
      expect(ctx.project.tilesets).toEqual(beforeTilesets);
      profileKeys.add(data.generationProfile);
    }

    expect(profileKeys.size + conceptInteriors + manualAtlases).toBe(BUNDLED_EASYRPG_CHIPSET_ASSETS.length);
  });

  // 사용자 보고 2026-08-29: "타일 깔라 하면 항상 외곽에 벽을 깐다".
  // blankThemedMap 이 테마·인자와 무관하게 맵 4변을 palette.obstacle 로 두르고 있었고,
  // obstacle 은 생성 프로필 13종 전부 벽/솔리드 타일이다. create_map 은 이미
  // 2026-07-08(47b0d51d)에 옵션으로 강등됐는데 generate_map 만 남아 있었다.
  describe("외곽 테두리는 옵션이다(기본 none)", () => {
    function borderTiles(map: { width: number; height: number; lowerTiles: number[] }): number[] {
      const tiles: number[] = [];
      for (let x = 0; x < map.width; x += 1) {
        tiles.push(map.lowerTiles[x]!, map.lowerTiles[(map.height - 1) * map.width + x]!);
      }
      for (let y = 0; y < map.height; y += 1) {
        tiles.push(map.lowerTiles[y * map.width]!, map.lowerTiles[y * map.width + map.width - 1]!);
      }
      return tiles;
    }

    for (const theme of THEMES) {
      it(`${theme}: border 생략 시 외곽에 장애물 벽을 두르지 않는다`, () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = runTool(
          ctx,
          "generate_map",
          { theme, width: 20, height: 16, chokepoints: 0, seed: 3, id: `gen_open_${theme}` },
          { dryRun: false },
        );
        expect(result.ok, result.summary).toBe(true);
        expect((result.data as { border: string }).border).toBe("none");

        const map = ctx.project.maps[`gen_open_${theme}`]!;
        // chokepoints:0 이라 산포 장애물이 없다 — 외곽이 막혀 있으면 그건 강제 테두리다.
        const blocked: string[] = [];
        for (let x = 0; x < map.width; x += 1) {
          for (const y of [0, map.height - 1]) if (!isPassable(ctx.project, map, x, y)) blocked.push(`${x},${y}`);
        }
        for (let y = 0; y < map.height; y += 1) {
          for (const x of [0, map.width - 1]) if (!isPassable(ctx.project, map, x, y)) blocked.push(`${x},${y}`);
        }
        expect(blocked, `외곽 타일: ${[...new Set(borderTiles(map))].join(",")}`).toEqual([]);
      });
    }

    it("border 생략 시 기본 입구는 맵 가장자리에 붙는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        { theme: "village", width: 20, height: 16, chokepoints: 0, seed: 3, id: "gen_edge_entrance" },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect((result.data as { entrance: { x: number; y: number } }).entrance).toEqual({ x: 0, y: 8 });
    });

    it("border:\"wall\" 은 종전처럼 외곽 4변을 봉인한다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        { theme: "cave", width: 20, height: 16, chokepoints: 0, seed: 3, id: "gen_sealed", border: "wall" },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect((result.data as { border: string }).border).toBe("wall");

      const map = ctx.project.maps.gen_sealed!;
      for (const [x, y] of [[0, 0], [map.width - 1, 0], [0, map.height - 1], [map.width - 1, map.height - 1]]) {
        expect(isPassable(ctx.project, map, x!, y!), `(${x},${y})`).toBe(false);
      }
    });

    it("알 수 없는 border 값은 조용히 무시되지 않고 거부된다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(ctx, "generate_map", { theme: "village", width: 20, height: 16, id: "gen_bad", border: "walls" });
      expect(result.ok).toBe(false);
      expect(result.issues?.map((issue) => issue.message).join(" ")).toContain("border");
      expect(ctx.project.maps.gen_bad).toBeUndefined();
    });

    // 2026-09-11: 조수(모델)에게는 border 선택지를 아예 주지 않는다. 실측으로 스키마에 enum 이
    // 있으면 동굴·던전 요청마다 스스로 wall 을 골랐고(3/3), 설명을 "명시 요청 때만" 으로 바꿔도
    // 그대로였다. 스키마에서 감추면 0/3. 런타임 경로는 위 케이스들이 계속 지킨다.
    it("모델 노출 스키마에는 border 가 없다", () => {
      const tool = toOpenAiTools().find((entry) => entry.function.name === "generate_map");
      expect(tool).toBeDefined();
      expect(Object.keys(tool!.function.parameters.properties ?? {})).not.toContain("border");
      expect(tool!.function.description).not.toContain("border");
    });
  });

  it("등록되지 않은 타일셋은 다른 타일 문법으로 대체하지 않는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    ctx.project.tilesets.uploaded_custom = {
      ...ctx.project.tilesets.easyrpg_chipset_combined_town!,
      id: "uploaded_custom",
      name: "업로드 타일셋",
      image: { type: "generated", id: "uploaded_custom" },
    };

    const result = runTool(ctx, "generate_map", {
      id: "map_custom",
      theme: "village",
      tilesetId: "uploaded_custom",
      width: 20,
      height: 16,
    });

    expect(result.ok).toBe(false);
    expect(ctx.project.maps.map_custom).toBeUndefined();
  });
});
