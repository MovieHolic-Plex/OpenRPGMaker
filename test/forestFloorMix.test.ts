import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { DEFAULT_UNDERGROWTH_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import type { GameMap } from "@/project/types";

const UNDERGROWTH = new Set<number>(DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.memberTileIds);
const TRUNKS = new Set([290, 291, 292, 293]);
const CANOPIES = new Set([260, 261, 262, 263]);
const BUSHES = new Set([288, 289]);

function setup() {
  const ctx: ToolContext = { project: createEmptyToolProject("숲 바닥 혼합") };
  const made = runTool(ctx, "create_map", { name: "숲", width: 30, height: 30 });
  const mapId = (made.data as { mapId: string }).mapId;
  return { ctx, mapId };
}

type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

function snapshot(map: GameMap, area: Area): { trunks: number; canopies: number; bushes: number } {
  let trunks = 0;
  let canopies = 0;
  let bushes = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i] ?? 0;
      const upper = map.upperTiles[i] ?? 0;
      if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(upper) || isTreeTrunkTileId(lower)) trunks += 1;
      if (CANOPIES.has(upper) || isTreeCanopyTileId(upper)) canopies += 1;
      if (BUSHES.has(upper) || BUSHES.has(lower)) bushes += 1;
    }
  }
  return { trunks, canopies, bushes };
}

function counts(map: GameMap, area: Area) {
  let undergrowth = 0;
  let water = 0;
  let waterOnTrunk = 0;
  let waterCells = 0;
  let cells = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      cells += 1;
      const i = y * map.width + x;
      const lower = map.lowerTiles[i] ?? 0;
      const upper = map.upperTiles[i] ?? 0;
      if (UNDERGROWTH.has(lower)) undergrowth += 1;
      if (isLakeAutotileTile(lower)) {
        water += 1;
        if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper)) {
          waterOnTrunk += 1;
        }
      }
    }
  }
  return { undergrowth, water, waterOnTrunk, waterCells, cells };
}

describe("forest floor mix", () => {
  it("dense 합성: 짙은 수풀 오토타일과 물웅덩이를 드물게 섞는다", () => {
    const { ctx, mapId } = setup();
    const area = { x: 2, y: 2, w: 20, h: 20 };
    const result = runTool(ctx, "place_props", {
      mapId, area, material: "침엽수", density: "dense", seed: 7,
    });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[mapId]!;
    const c = counts(map, area);
    expect(c.undergrowth).toBeGreaterThan(0);
    expect(c.undergrowth).toBeLessThan(c.cells * 0.35);
    expect(c.water).toBeLessThanOrEqual(8);
    expect(c.waterOnTrunk).toBe(0);
  });

  it("impassable 합성: 물웅덩이가 밑동을 덮지 않는다", () => {
    const { ctx, mapId } = setup();
    const area = { x: 2, y: 2, w: 20, h: 20 };
    const result = runTool(ctx, "place_props", {
      mapId, area, material: "활엽수", density: "impassable", seed: 11,
    });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[mapId]!;
    const c = counts(map, area);
    expect(c.undergrowth).toBeGreaterThan(0);
    expect(c.waterOnTrunk).toBe(0);
    const s = snapshot(map, area);
    expect(s.trunks).toBeGreaterThan(0);
    expect(s.canopies).toBeGreaterThan(0);
  });
});
