import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { buildTerrainConstraintMasks, type Rect } from "@/editor/tools/villageTerrainPass";
import type { VillageRequirements } from "@/editor/tools/villageRequirements";
import { countTreeCells, countWaterCells } from "@/editor/tools/villageEvaluate";
import { TILE } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import type { ToolContext } from "@/editor/tools/types";

const AREA: Rect = { x: 10, y: 8, w: 30, h: 24 };
const SIDES = ["west", "east", "north", "south"] as const;

function requirements(side: (typeof SIDES)[number]): VillageRequirements {
  return {
    query: "강과 숲이 있는 마을",
    landmarks: ["river", "forest"],
    mustHaveVillage: true,
    mustExist: ["주거 마을", "강", "숲"],
    riverSide: side,
    forestSide: side,
  };
}

function isWithin(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w
    && inner.y + inner.h <= outer.y + outer.h;
}

describe("village terrain bounds", () => {
  it.each(SIDES)("translates %s terrain masks into a non-zero-origin build area", (side) => {
    const masks = buildTerrainConstraintMasks({ width: 80, height: 70 }, requirements(side), AREA);

    expect([...masks.waterRects, ...masks.forestRects, masks.buildableRect].every((rect) => isWithin(rect, AREA))).toBe(true);
  });

  it("counts required landmarks only inside the requested area", () => {
    const context: ToolContext = { project: createEmptyToolProject("counts") };
    expect(runTool(context, "create_map", { id: "map_counts", name: "Counts", width: 20, height: 20 }).ok).toBe(true);
    const map = context.project.maps.map_counts;
    map.lowerTiles[0] = TILE.WATER;
    map.upperTiles[1] = 260;
    map.lowerTiles[6 * map.width + 6] = TILE.WATER;
    map.upperTiles[7 * map.width + 7] = 260;
    const area = { x: 5, y: 5, w: 10, h: 10 };

    expect(countWaterCells(map)).toBe(2);
    expect(countTreeCells(map)).toBe(2);
    expect(countWaterCells(map, area)).toBe(1);
    expect(countTreeCells(map, area)).toBe(1);
  });

  it("rejects requested bounds that extend beyond the map before any write", () => {
    const context: ToolContext = { project: createEmptyToolProject("bounds") };
    expect(runTool(context, "create_map", { id: "map_bounds", name: "Bounds", width: 40, height: 40 }).ok).toBe(true);
    const before = serialize(context.project);

    const result = runTool(context, "build_village", {
      mapId: "map_bounds",
      bounds: { x: 15, y: 10, w: 30, h: 20 },
      houses: 1,
      seed: 7,
      interior: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("bounds-out-of-map");
    expect(serialize(context.project)).toBe(before);
  });
});
