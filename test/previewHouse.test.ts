import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { TILE } from "@/project/defaults/constants";

type NumberGrid = readonly (readonly number[])[];

type PreviewHouseData = {
  readonly lower: NumberGrid;
  readonly upper: NumberGrid;
  readonly door: {
    readonly x: number;
    readonly y: number;
  };
};

type MapRegionData = {
  readonly grid: readonly string[];
};

function recordField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return Reflect.get(value, key);
}

function isNumberGrid(value: unknown): value is NumberGrid {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => Number.isInteger(cell)));
}

function isDoor(value: unknown): value is PreviewHouseData["door"] {
  return Number.isInteger(recordField(value, "x")) && Number.isInteger(recordField(value, "y"));
}

function isPreviewHouseData(value: unknown): value is PreviewHouseData {
  return isNumberGrid(recordField(value, "lower")) && isNumberGrid(recordField(value, "upper")) && isDoor(recordField(value, "door"));
}

function isMapRegionData(value: unknown): value is MapRegionData {
  const grid = recordField(value, "grid");
  return Array.isArray(grid) && grid.every((row) => typeof row === "string");
}

describe("preview_house", () => {
  it("집 미리보기 그리드를 돌려주고 실제 맵은 바꾸지 않는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const created = runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 });
    expect(created.ok, created.summary).toBe(true);

    const result = runTool(ctx, "preview_house", {
      mapId: "m1",
      origin: { x: 2, y: 2 },
      width: 6,
      height: 7,
      material: "plaster",
    });

    expect(result.ok, result.summary).toBe(true);
    if (!isPreviewHouseData(result.data)) throw new Error("preview_house data shape mismatch");
    expect(result.data.lower).toHaveLength(7);
    expect(result.data.upper).toHaveLength(7);
    for (const row of result.data.lower) expect(row).toHaveLength(6);
    for (const row of result.data.upper) expect(row).toHaveLength(6);
    expect(result.data.door).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect([...result.data.lower.flat(), ...result.data.upper.flat()].some((tile) => tile !== TILE.EMPTY && tile !== TILE.GRASS)).toBe(true);

    const region = runTool(ctx, "get_map_region", { mapId: "m1", x: 2, y: 2, w: 6, h: 7 });
    expect(region.ok, region.summary).toBe(true);
    if (!isMapRegionData(region.data)) throw new Error("get_map_region data shape mismatch");
    expect(region.data.grid).toEqual(Array.from({ length: 7 }, () => ".".repeat(6)));
  });
});
