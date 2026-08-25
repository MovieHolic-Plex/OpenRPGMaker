// test/generateMap.test.ts
// generate_map: 3개 테마 × 시드 2개 → projectLint 0 error + 입구에서 모든 POI 도달 가능.

import { describe, expect, it } from "vitest";
import { projectLint } from "@/project/lint/projectLint";
import { checkReachability } from "@/project/lint/reachability";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { isPassable } from "@/project/collision";

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

  it("256x256 초과 생성은 거부하고 분할 맵 대안을 안내한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(ctx, "generate_map", { theme: "forest", width: 257, height: 32, id: "gen_huge" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("최대 256×256");
    expect(result.summary).toContain("여러 맵");
    expect(ctx.project.maps.gen_huge).toBeUndefined();
  });

  it("모든 번들 타일셋을 서로 다른 생성 프로필로 디스패치한다", () => {
    const profileKeys = new Set<string>();

    for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
      const tilesetId = bundledEasyRpgTilesetId(asset.textureKey);
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(ctx, "generate_map", {
        id: `map_${tilesetId}`,
        name: asset.name,
        theme: "village",
        tilesetId,
        width: 20,
        height: 16,
        seed: 7,
      });

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
      profileKeys.add(data.generationProfile);
    }

    expect(profileKeys.size).toBe(BUNDLED_EASYRPG_CHIPSET_ASSETS.length);
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
