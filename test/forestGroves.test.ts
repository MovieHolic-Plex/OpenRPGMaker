import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { paintForestGroves } from "@/editor/tools/village/forestGroves";
import { prepareVillageTreeKit } from "@/editor/tools/village/treeKit";
import { createForestHarmonyTileset } from "@/project/defaults/forestHarmony";
import { ensureForestGroveTileset, FOREST_GROVE_GROUP } from "@/project/defaults/forestGrove";
import { isPassable } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";

it("appends reference canopy after user extensions without modifying original slots", () => {
  const tileset = createForestHarmonyTileset();
  tileset.tileGrafts!.push({ sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 1, targetTile: 2700 });
  const before = structuredClone(tileset);
  ensureForestGroveTileset(tileset);
  const group = tileset.autotileGroups!.find(group => group.id === FOREST_GROVE_GROUP)!;
  expect(Math.min(...group.memberTileIds)).toBeGreaterThan(2700);
  for (const key of ["terrain", "priority", "passability", "tileMeta"] as const) {
    expect(tileset[key]!.slice(0, before.count)).toEqual(before[key]);
  }
  expect(tileset.tileGrafts!.slice(0, before.tileGrafts!.length)).toEqual(before.tileGrafts);
  const once = structuredClone(tileset);
  ensureForestGroveTileset(tileset);
  expect(tileset).toEqual(once);
});

describe("reference forest grammar", () => {
  it("preserves a three-cell through route and emits complete roots inside the selected area", () => {
    const ctx = { project: createEmptyToolProject() };
    expect(runTool(ctx, "create_map", { id: "grove", width: 64, height: 48 }).ok).toBe(true);
    const map = ctx.project.maps.grove!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    const kit = prepareVillageTreeKit(tileset);
    const before = structuredClone(map);
    const area = { x: 4, y: 3, w: 56, h: 42 };
    const result = paintForestGroves(map, area, kit.grove!, (x, y) => x < 30 || x > 32, 17, 0.7);
    expect(result.canopyCells).toBeGreaterThan(200);
    expect(result.trunkRuns).toBeGreaterThan(0);
    for (const index of result.cells) {
      const x = index % map.width, y = Math.floor(index / map.width);
      expect(x >= 4 && x < 60 && y >= 3 && y < 45).toBe(true);
      expect(x < 30 || x > 32).toBe(true);
      expect(isPassable(ctx.project, map, x, y)).toBe(false);
    }
    for (let y = 0; y < map.height; y++) for (let x = 30; x <= 32; x++) {
      const index = y * map.width + x;
      expect(map.lowerTiles[index]).toBe(before.lowerTiles[index]);
      expect(map.upperTiles[index]).toBe(before.upperTiles[index]);
      expect(isPassable(ctx.project, map, x, y)).toBe(true);
    }
    const topToRoots = new Map([[1422,1430], [1423,1431], [1424,1432], [1425,1433],
      [1350,1432], [1453,1461], [1454,1462], [1455,1463]]);
    map.lowerTiles.forEach((tile, index) => {
      if (topToRoots.has(tile)) expect(map.lowerTiles[index + 2 * map.width]).toBe(topToRoots.get(tile));
    });
    const loaded = deserialize(serialize(ctx.project));
    expect(loaded.maps.grove).toEqual(map);
    expect(loaded.tilesets[map.tilesetId]).toEqual(tileset);
  });

  it("leaves no partial assembly when a region is too narrow", () => {
    const ctx = { project: createEmptyToolProject() };
    runTool(ctx, "create_map", { id: "grove", width: 20, height: 15 });
    const map = ctx.project.maps.grove!;
    const kit = prepareVillageTreeKit(ctx.project.tilesets[map.tilesetId]);
    const before = structuredClone(map);
    const result = paintForestGroves(map, { x: 5, y: 4, w: 2, h: 8 }, kit.grove!, () => true, 7, 1);
    expect(result.cells.size).toBe(0);
    expect(map).toEqual(before);
  });
});
