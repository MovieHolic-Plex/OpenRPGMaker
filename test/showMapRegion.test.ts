import { describe, expect, it } from "vitest";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";

type ShowMapRegionData = {
  readonly h: number;
  readonly lower: readonly (readonly number[])[];
  readonly mapId: string;
  readonly upper: readonly (readonly number[])[];
  readonly w: number;
  readonly x: number;
  readonly y: number;
};

function showMapRegionData(value: unknown): ShowMapRegionData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("show_map_region data must be an object");
  const lower = Reflect.get(value, "lower");
  const upper = Reflect.get(value, "upper");
  if (!Array.isArray(lower) || !lower.every(Array.isArray)) throw new Error("show_map_region lower grid mismatch");
  if (!Array.isArray(upper) || !upper.every(Array.isArray)) throw new Error("show_map_region upper grid mismatch");
  const data = {
    h: Reflect.get(value, "h"),
    lower,
    mapId: Reflect.get(value, "mapId"),
    upper,
    w: Reflect.get(value, "w"),
    x: Reflect.get(value, "x"),
    y: Reflect.get(value, "y"),
  };
  if (
    typeof data.mapId !== "string"
    || !Number.isInteger(data.x)
    || !Number.isInteger(data.y)
    || !Number.isInteger(data.w)
    || !Number.isInteger(data.h)
  ) {
    throw new Error("show_map_region scalar fields mismatch");
  }
  return data;
}

describe("show_map_region", () => {
  it("returns clamped lower and upper 2D tile arrays", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.width = 4;
    map.height = 3;
    map.tilesetId = DEFAULT_TILESET_ID;
    map.lowerTiles = [
      0, 1, 2, 3,
      10, 11, 12, 13,
      20, 21, 22, 23,
    ];
    map.upperTiles = [
      TILE.EMPTY, 101, 102, 103,
      110, 111, 112, 113,
      120, 121, 122, 123,
    ];

    const result = runTool({ project }, "show_map_region", { h: 4, mapId: map.id, w: 4, x: 2, y: 1 });

    expect(result.ok, result.summary).toBe(true);
    const data = showMapRegionData(result.data);
    expect(data).toMatchObject({ h: 2, mapId: map.id, w: 2, x: 2, y: 1 });
    expect(data.lower).toEqual([
      [12, 13],
      [22, 23],
    ]);
    expect(data.upper).toEqual([
      [112, 113],
      [122, 123],
    ]);
  });

  it("lets the image renderer accept show_map_region data in fakeDom", async () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    const result = runTool({ project }, "show_map_region", { h: 1, mapId: map.id, w: 1, x: 0, y: 0 });
    expect(result.ok, result.summary).toBe(true);

    const images = await renderToolImages(project, "show_map_region", result.data);

    expect(images).toEqual([]);
  });
});
