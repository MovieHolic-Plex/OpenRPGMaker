import { describe, expect, it } from "vitest";
import { createSmallHouseVariantMaps, createSmallHouseVariantProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";

const FENCE_TILES = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
const UPPER_ROOF_TILES = new Set([374, 375, 377]);
const WINDOW_TILES = new Set([85, 87]);
const EXTRACTED_DOOR_TOP = 329;
const EXTRACTED_DOOR_BOTTOM = 359;
const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const ROOF_FACE_LEFT = 404;
const ROOF_FACE_MID = 405;
const DIRT_ROAD_TILES = new Set<number>(Object.values(DIRT_ROAD_TILE));
const WOOD_WALL_TILES = new Set([102, 103, 104, 132, 133, 134, 162, 163, 164]);
const STONE_WALL_TILES = new Set([12, 13, 14, 42, 43, 44, 72, 73, 74]);
const WATER_TILE = 120;
const SAND_TILES = new Set([423, 424, 393, 394, 395, 453, 454, 455]);

function mapSignature(map: ReturnType<typeof createSmallHouseVariantMaps>[number]): string {
  return `${map.width}x${map.height}:${map.lowerTiles.join(",")}:${map.upperTiles.join(",")}`;
}

function at(map: ReturnType<typeof createSmallHouseVariantMaps>[number], x: number, y: number): number {
  return y * map.width + x;
}

function lowerVisualTiles(map: ReturnType<typeof createSmallHouseVariantMaps>[number]): number[] {
  return [...map.lowerTiles, ...Object.values(map.lowerTileStacks ?? {}).flat()];
}

function lowerDoorTopIndex(map: ReturnType<typeof createSmallHouseVariantMaps>[number]): number {
  const framedDoorIndex = map.lowerTiles.indexOf(FRAMED_DOOR_TOP);
  return framedDoorIndex >= 0 ? framedDoorIndex : map.lowerTiles.indexOf(EXTRACTED_DOOR_TOP);
}

function hasLowerDoorPair(map: ReturnType<typeof createSmallHouseVariantMaps>[number]): boolean {
  const index = lowerDoorTopIndex(map);
  if (index < 0) return false;
  const bottom = map.lowerTiles[index + map.width];
  return bottom === FRAMED_DOOR_BOTTOM || bottom === EXTRACTED_DOOR_BOTTOM;
}

describe("small house variants", () => {
  it("creates seven distinct maps while preserving the small_house_01 layer contract", () => {
    const maps = createSmallHouseVariantMaps();

    expect(maps).toHaveLength(9);
    expect(new Set(maps.map((map) => map.id)).size).toBe(9);
    expect(new Set(maps.map((map) => map.name)).size).toBe(9);
    expect(new Set(maps.map(mapSignature)).size).toBe(9);
    expect(new Set(maps.map(lowerDoorTopIndex)).size).toBe(7);
    expect(maps[1]?.lowerTiles[at(maps[1], 6, 10)]).toBe(TILE.GRASS);
    expect(maps[1]?.upperTiles[at(maps[1], 8, 4)]).toBe(374);
    expect(maps[2]?.lowerTiles[at(maps[2], 5, 8)]).toBe(45);
    expect(maps[2]?.lowerTiles[at(maps[2], 16, 8)]).toBe(47);

    for (const map of maps) {
      expect(map.width).toBeGreaterThanOrEqual(16);
      expect(map.height).toBeGreaterThanOrEqual(15);
      expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);

      // fence/window는 RM2K3 정석에 따라 upper 오버레이 (chipsetMapping.isUpperChipsetTile과 일관).
      expect(map.upperTiles.some((tile) => FENCE_TILES.has(tile))).toBe(true);
      expect(map.upperTiles.some((tile) => WINDOW_TILES.has(tile))).toBe(true);
      expect(lowerVisualTiles(map).some((tile) => FENCE_TILES.has(tile))).toBe(false);
      expect(lowerVisualTiles(map).some((tile) => WINDOW_TILES.has(tile))).toBe(false);
      expect(hasLowerDoorPair(map)).toBe(true);
      expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_TOP);
      expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_BOTTOM);
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_TOP);
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_BOTTOM);
      expect(map.lowerTiles.filter((tile) => tile === TILE.GRASS).length).toBeGreaterThan(0);
    }
  });

  it("variant 4 stamps a wood-wall house by the pond garden", () => {
    const map = createSmallHouseVariantMaps()[3];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.lowerTiles.some((tile) => WOOD_WALL_TILES.has(tile))).toBe(true);
    expect(map.lowerTiles.some((tile) => STONE_WALL_TILES.has(tile))).toBe(false);
    expect(map.lowerTiles.some((tile) => tile === WATER_TILE)).toBe(true);
    expect(map.lowerTiles.some((tile) => SAND_TILES.has(tile))).toBe(true);
    expect(map.upperTiles.some((tile) => FENCE_TILES.has(tile))).toBe(true);
    expect(hasLowerDoorPair(map)).toBe(true);
  });

  it("variant 5 stamps a stone-wall house inside the orchard fence", () => {
    const map = createSmallHouseVariantMaps()[4];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.lowerTiles.some((tile) => STONE_WALL_TILES.has(tile))).toBe(true);
    expect(map.lowerTiles.some((tile) => WOOD_WALL_TILES.has(tile))).toBe(false);
    expect(map.upperTiles.some((tile) => FENCE_TILES.has(tile))).toBe(true);
    expect(map.upperTiles.some((tile) => tile === TILE.TREE)).toBe(true);
    expect(hasLowerDoorPair(map)).toBe(true);
  });

  it("variant 6 stamps a wide two-story plaster house on the plaza", () => {
    const map = createSmallHouseVariantMaps()[5];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.lowerTiles[at(map, 8, 10)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 8, 11)]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 6, 7)]).toBe(87);
    expect(map.upperTiles[at(map, 10, 9)]).toBe(87);
    expect(map.upperTiles.some((tile) => UPPER_ROOF_TILES.has(tile))).toBe(true);
    expect(map.lowerTiles.some((tile) => DIRT_ROAD_TILES.has(tile))).toBe(true);
  });

  it("variant 7 stamps a T-shaped plaster house with a centered stem door", () => {
    const map = createSmallHouseVariantMaps()[6];
    expect(map).toBeDefined();
    if (!map) return;

    for (let x = 2; x <= 18; x += 1) {
      expect(UPPER_ROOF_TILES.has(map.upperTiles[at(map, x, 1)])).toBe(true);
    }

    expect(map.lowerTiles[at(map, 2, 5)]).toBe(15);
    expect(map.lowerTiles[at(map, 18, 5)]).toBe(17);
    expect(map.lowerTiles[at(map, 7, 9)]).toBe(15);
    expect(map.lowerTiles[at(map, 13, 9)]).toBe(17);
    expect(map.lowerTiles[at(map, 10, 12)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 10, 13)]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 10, 12)]).toBe(TILE.EMPTY);
    expect(DIRT_ROAD_TILES.has(map.lowerTiles[at(map, 10, 14)] ?? -1)).toBe(true);
    expect(DIRT_ROAD_TILES.has(map.lowerTiles[at(map, 10, 17)] ?? -1)).toBe(true);
    expect(map.upperTiles[at(map, 10, 17)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 4, 6)]).toBe(87);
    expect(map.upperTiles[at(map, 15, 6)]).toBe(87);
  });

  it("variant 8 stamps a T-shaped wood house with a centered stem door", () => {
    const map = createSmallHouseVariantMaps()[7];
    expect(map).toBeDefined();
    if (!map) return;

    for (let x = 2; x <= 18; x += 1) {
      expect(UPPER_ROOF_TILES.has(map.upperTiles[at(map, x, 1)])).toBe(true);
    }

    expect(map.lowerTiles[at(map, 2, 5)]).toBe(102);
    expect(map.lowerTiles[at(map, 18, 5)]).toBe(104);
    expect(map.lowerTiles[at(map, 7, 9)]).toBe(102);
    expect(map.lowerTiles[at(map, 13, 9)]).toBe(104);
    expect(map.lowerTiles[at(map, 10, 12)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 10, 13)]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 10, 12)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 4, 6)]).toBe(85);
    expect(map.upperTiles[at(map, 15, 6)]).toBe(85);
  });

  it("variant 9 stamps a T-shaped stone house with a centered stem door", () => {
    const map = createSmallHouseVariantMaps()[8];
    expect(map).toBeDefined();
    if (!map) return;

    for (let x = 2; x <= 18; x += 1) {
      expect(UPPER_ROOF_TILES.has(map.upperTiles[at(map, x, 1)])).toBe(true);
    }

    expect(map.lowerTiles[at(map, 2, 5)]).toBe(12);
    expect(map.lowerTiles[at(map, 18, 5)]).toBe(14);
    expect(map.lowerTiles[at(map, 7, 9)]).toBe(12);
    expect(map.lowerTiles[at(map, 13, 9)]).toBe(14);
    expect(map.lowerTiles[at(map, 10, 12)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 10, 13)]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 10, 12)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 4, 6)]).toBe(85);
    expect(map.upperTiles[at(map, 15, 6)]).toBe(85);
  });

  it("locks variant 3 roof, door, and path anchors", () => {
    const map = createSmallHouseVariantMaps()[2];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.lowerTiles[at(map, 11, 9)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 11, 10)]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 11, 8)]).toBe(TILE.EMPTY);
    expect(map.lowerTiles[at(map, 11, 11)]).toBe(TILE.PATH);
    expect(map.lowerTiles[at(map, 10, 11)]).not.toBe(TILE.PATH);
    expect(map.lowerTiles[at(map, 12, 11)]).not.toBe(TILE.PATH);

    for (let y = 4; y <= 6; y += 1) {
      for (let x = 5; x <= 16; x += 1) {
        expect(UPPER_ROOF_TILES.has(map.upperTiles[at(map, x, y)])).toBe(true);
        expect(map.lowerTiles[at(map, x, y)]).toBe(TILE.GRASS);
      }
    }

    expect(map.upperTiles[at(map, 5, 5)]).toBe(375);
    expect(map.upperTiles[at(map, 16, 5)]).toBe(375);
    expect(map.upperTiles[at(map, 5, 6)]).toBe(375);
    expect(map.upperTiles[at(map, 16, 6)]).toBe(375);
    expect(map.lowerTiles[at(map, 5, 7)]).toBe(ROOF_FACE_LEFT);
    expect(map.lowerTiles[at(map, 11, 7)]).toBe(ROOF_FACE_MID);
    expect(map.lowerTiles[at(map, 16, 7)]).toBe(ROOF_FACE_MID);
  });

  it("places three overlapping 2x2 trees on variant 1 with lower and upper tile stacks", () => {
    const map = createSmallHouseVariantMaps()[0];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.upperTiles[at(map, 4, 3)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 18, 6)]).toBe(TILE.EMPTY);
    expect(map.upperTileStacks?.[at(map, 0, 3)]).toEqual([262]);
    expect(map.lowerTileStacks?.[at(map, 0, 4)]).toEqual([292]);
    expect(map.upperTileStacks?.[at(map, 0, 4)]).toEqual([262]);
    expect(map.lowerTileStacks?.[at(map, 0, 5)]).toEqual([292]);
    expect(map.upperTileStacks?.[at(map, 0, 5)]).toEqual([262]);
    expect(map.lowerTileStacks?.[at(map, 0, 6)]).toEqual([292]);
  });

  it("lays variant 1 yard path with dirt road autotile edges", () => {
    const map = createSmallHouseVariantMaps()[0];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.lowerTiles[at(map, 14, 10)]).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
    expect(map.lowerTiles[at(map, 15, 10)]).toBe(DIRT_ROAD_TILE.CORNER_NORTH_EAST);
    expect(map.lowerTiles[at(map, 14, 15)]).toBe(DIRT_ROAD_TILE.BODY);
    expect(map.lowerTiles[at(map, 11, 15)]).toBe(DIRT_ROAD_TILE.EDGE_NORTH);
    expect(map.lowerTiles[at(map, 11, 16)]).toBe(DIRT_ROAD_TILE.EDGE_SOUTH);
    expect(map.lowerTiles[at(map, 14, 17)]).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_WEST);
    expect(map.lowerTiles[at(map, 15, 17)]).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
  });

  it("uses the requested variant as the project start and tree root map", () => {
    for (const variant of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const project = createSmallHouseVariantProject(variant);
      const startMap = project.maps[project.startMapId];

      expect(Object.values(project.maps)).toHaveLength(1);
      expect(project.mapTree.mapId).toBe(project.startMapId);
      expect(startMap?.name).toContain(`변형 ${variant}`);
      expect(startMap).toBeDefined();
      if (!startMap) continue;
      expect(startMap.events).toEqual([]);
      expect(DIRT_ROAD_TILES.has(startMap.lowerTiles[at(startMap, project.startPos.x, project.startPos.y)] ?? -1)).toBe(true);
    }
  });
});
