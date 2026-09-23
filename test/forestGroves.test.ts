import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { paintForestGroves } from "@/editor/tools/village/forestGroves";
import { paintContouredForest, refitForestTrunks } from "@/editor/tools/village/forestContour";
import { forestTrunkCandidates } from "@/editor/tools/village/forestTrunkTiles";
import { prepareVillageTreeKit } from "@/editor/tools/village/treeKit";
import { createForestHarmonyTileset } from "@/project/defaults/forestHarmony";
import { ensureForestGroveTileset, FOREST_GROVE_GROUP } from "@/project/defaults/forestGrove";
import { isPassable } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";

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

describe("whole trunks under every canopy edge", () => {
  const ROW0 = new Set([1422, 1423, 1424, 1425, 1350, 1453, 1454, 1455]);
  const LOWER_ROWS = new Set([1426, 1427, 1428, 1429, 1457, 1458, 1459, 1430, 1431, 1432, 1433, 1461, 1462, 1463]);

  const blank = (width: number, height: number) => ({ id: "wood", name: "wood", width, height, tileSize: 16,
    tilesetId: "forest_harmony", lowerTiles: Array(width * height).fill(240), upperTiles: Array(width * height).fill(-1), events: [] }) as unknown as GameMap;
  const grove = () => {
    const tileset = createForestHarmonyTileset();
    ensureForestGroveTileset(tileset);
    return tileset.autotileGroups!.find(group => group.id === FOREST_GROVE_GROUP)!;
  };

  it("fits roots exactly as wide as the edge from two cells, ending in whole trees", () => {
    expect(forestTrunkCandidates(3, 1)).toEqual([]);
    for (let width = 2; width <= 12; width++) {
      const [candidate, ...rest] = forestTrunkCandidates(3, width);
      expect(rest).toEqual([]);
      expect(candidate!.x).toBe(3);
      expect(candidate!.rows.map(row => row.length)).toEqual([width, width, width]);
      expect(candidate!.rows.map(row => [row[0], row[width - 1]])).toEqual([[1422, 1455], [1426, 1459], [1430, 1463]]);
    }
  });

  it("never leaves a root under a canopy tile or a half trunk at a run's end", () => {
    const map = blank(72, 56), group = grove();
    const canopy = new Set(Object.values(group.variantMap));
    for (const seed of [3, 17, 91]) {
      map.lowerTiles.fill(240); map.upperTiles.fill(-1);
      const result = paintContouredForest(map, { x: 0, y: 0, w: 72, h: 56 }, group, () => true, seed, 0.55);
      expect(result.trunkRuns).toBeGreaterThan(5);
      map.lowerTiles.forEach((tile, index) => {
        const x = index % map.width;
        if (LOWER_ROWS.has(tile)) expect(canopy.has(map.upperTiles[index]!)).toBe(false);
        if (!ROW0.has(tile)) return;
        expect(canopy.has(map.upperTiles[index]!)).toBe(true);
        if (!ROW0.has(map.lowerTiles[index - 1]!) || x === 0) expect(tile).toBe(1422);
        if (!ROW0.has(map.lowerTiles[index + 1]!) || x === map.width - 1) expect(tile).toBe(1455);
      });
    }
  });

  it("re-fits old 4-wide caps in place, keeping the canopy", () => {
    const map = blank(24, 16), group = grove(), ground = 240;
    const at = (x: number, y: number) => y * map.width + x;
    for (let y = 2; y <= 5; y++) for (let x = 6; x <= 10; x++) map.upperTiles[at(x, y)] = group.variantMap["255"]!;
    // The old painter's 4-wide cap under a 5-wide edge: its last column is half a trunk.
    [[1422, 1423, 1424, 1425], [1426, 1427, 1428, 1429], [1430, 1431, 1432, 1433]]
      .forEach((row, dy) => row.forEach((tile, dx) => { map.lowerTiles[at(6 + dx, 5 + dy)] = tile; }));
    const report = refitForestTrunks(map, { x: 0, y: 0, w: 24, h: 16 }, group, ground,
      (x, y) => map.lowerTiles[at(x, y)] === ground && map.upperTiles[at(x, y)] === -1);
    expect(report.canopyCells).toBe(20);
    expect([5, 6, 7].map(y => map.lowerTiles.slice(at(6, y), at(11, y)))).toEqual([
      [1422, 1423, 1424, 1454, 1455], [1426, 1427, 1428, 1458, 1459], [1430, 1431, 1432, 1462, 1463]]);
    expect(map.upperTiles.filter(tile => tile !== -1)).toHaveLength(20);
  });
});
