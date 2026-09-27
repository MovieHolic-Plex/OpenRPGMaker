/**
 * 숲 나무 확장 띠(forest-trees:*) 물체를 place_props 로 놓으면 물체 모양 그대로 찍혀야 한다.
 *
 * 2026-09-27 「작은 숲속에 오두막 하나」 실측: 그룹의 sourceRect 는 픽셀 단위(숲 벽 160×96)인데 발자국
 * 계산이 칸 단위로 읽어 실패했고, 표본 빌더가 타일 앞 6개를 가로 한 줄로 늘어놓았다. 그래서 큰 참나무·활엽수는
 * 수관 조각 한 줄, 숲 벽은 밑동 한 줄이 되어 맵에 잎 없는 줄기만 남았다.
 */
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const MAP_ID = "map_blank_start";

function project(width = 40, height = 20): { project: Project } {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "resize_map", { mapId: MAP_ID, width, height }).ok).toBe(true);
  return ctx;
}

function bounds(cells: readonly number[], width: number) {
  const xs = cells.map((index) => index % width), ys = cells.map((index) => Math.floor(index / width));
  return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
}

describe("forest-trees 물체 place_props", () => {
  it.each([
    ["숲 나무 · 큰 참나무", "forest-trees:big-oak"],
    ["숲 나무 · 활엽수", "forest-trees:tree"],
  ])("%s 는 previewMap 모양대로 수관(상위)과 밑동(하위)을 함께 찍는다", (material, groupId) => {
    const ctx = project();
    const group = ctx.project.tilesets.forest_harmony!.tileGroups!.find((g) => g.id === groupId)!;
    const preview = group.previewMap!;
    const canopy = new Set(preview.upperTiles.filter((tile) => tile >= 0));
    const trunk = new Set(preview.lowerTiles.filter((tile) => group.tileIds.includes(tile)));
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 20 }, material, count: 1, seed: 3 });
    expect(result.ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const upperCells = map.upperTiles.flatMap((tile, index) => (canopy.has(tile) ? [index] : []));
    const lowerCells = map.lowerTiles.flatMap((tile, index) => (trunk.has(tile) ? [index] : []));
    // 옛 버그: 수관 조각 6칸이 가로 1줄. 이제 수관 칸 수와 높이가 원본과 같다.
    expect(upperCells).toHaveLength(canopy.size);
    expect(lowerCells).toHaveLength(trunk.size);
    expect(bounds([...upperCells, ...lowerCells], map.width)).toEqual({ w: preview.width, h: preview.height });
  });

  it("잎 없는 숲 벽·숲 기둥은 낱개 산포를 거절하고 수관 경로를 안내한다", () => {
    for (const material of ["숲 나무 · 숲 벽", "숲 나무 · 숲 기둥"]) {
      const ctx = project();
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 20 }, material, count: 2 });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("density");
    }
  });

  it("숲 벽에 density 를 주면 굽이숲 수관을 깐다", () => {
    const ctx = project();
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 20 }, material: "숲 나무 · 숲 벽", density: "dense" });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("굽이숲 수관");
  });
});
