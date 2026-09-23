import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { runTool } from "@/editor/tools/toolRunner";
import { isMapWaterTile, waterBoundsInMap } from "@/editor/tools/queryTools";

// toolResultForModel is private — exercise via compact behavior through session isn't easy;
// water detection and get_map_region data.water are the public contract.

describe("isMapWaterTile / waterBoundsInMap", () => {
  it("treats lake autotile and TILE.WATER as water", () => {
    expect(isMapWaterTile(TILE.WATER)).toBe(true);
    // body tile from lake set if exported
    const body = (LAKE_AUTOTILE_TILE as { BODY?: number }).BODY ?? (LAKE_AUTOTILE_TILE as unknown as number);
    if (typeof body === "number") {
      expect(isMapWaterTile(body)).toBe(true);
    }
  });

  it("get_map_region returns water.bounds for lake tiles", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    // paint a small water blob using TILE.WATER
    for (let y = 5; y < 9; y += 1) {
      for (let x = 6; x < 11; x += 1) {
        map.lowerTiles[y * map.width + x] = TILE.WATER;
      }
    }
    const result = runTool({ project }, "get_map_region", {
      mapId,
      x: 0,
      y: 0,
      w: map.width,
      h: map.height,
    });
    expect(result.ok).toBe(true);
    const data = result.data as {
      water: { cellCount: number; bounds: { x: number; y: number; w: number; h: number } | null };
      grid: string[];
    };
    expect(data.water.cellCount).toBe(4 * 5);
    expect(data.water.bounds).toEqual({ x: 6, y: 5, w: 5, h: 4 });
    // grid uses ~
    expect(data.grid[5]!.slice(6, 11)).toBe("~~~~~");
    expect(result.summary).toContain("물");
  });

  it("uses the active tileset rather than foreign water/tree numbers", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const tileset = structuredClone(project.tilesets[map.tilesetId]);
    tileset.id = "custom-interior";
    tileset.image = { type: "uploaded", id: "custom-atlas" };
    tileset.tileMeta = [];
    tileset.tileGroups = [];
    tileset.palettePresets = [];
    project.tilesets[tileset.id] = tileset;
    map.tilesetId = tileset.id;
    map.lowerTiles.fill(TILE.WATER);
    map.upperTiles.fill(TILE.EMPTY);
    map.upperTiles[0] = TILE.TREE;
    const query = () => runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 2, h: 1 });
    const unrelated = query().data as { water: { cellCount: number }; grid: string[] };
    expect(unrelated.water.cellCount).toBe(0);
    expect(unrelated.grid[0]).not.toMatch(/[~T]/);
    tileset.tileMeta[TILE.WATER] = { label: "water", description: "", role: "water", source: "user" };
    const explicit = query().data as { water: { cellCount: number }; grid: string[] };
    expect(explicit.water.cellCount).toBe(2);
    expect(explicit.grid[0]).toBe("~~");
  });

  it("waterBoundsInMap matches painted water rectangle", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.lowerTiles[3 * map.width + 4] = TILE.WATER;
    map.lowerTiles[3 * map.width + 5] = TILE.WATER;
    const b = waterBoundsInMap(map, 0, 0, map.width, map.height);
    expect(b).toEqual({ cellCount: 2, x: 4, y: 3, w: 2, h: 1 });
  });
});

describe("show_map_region size cap", () => {
  // Complete coverage is exempt (see wholeMapCoverageRender.test.ts); the cap still
  // stops the roaming it was added for, which is oversized *partial* slices.
  it("clamps huge partial requests to 24×24 on a large map", () => {
    const project = createBlankProject();
    const big = createBlankMap("big", 60, 60);
    big.id = "map_big";
    project.maps[big.id] = big;
    const result = runTool({ project }, "show_map_region", {
      mapId: big.id,
      x: 4,
      y: 4,
      w: 80,
      h: 80,
    });
    expect(result.ok).toBe(true);
    const data = result.data as { w: number; h: number };
    expect(data.w).toBe(24);
    expect(data.h).toBe(24);
    expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
  });
});
