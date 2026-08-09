import { describe, expect, it } from "vitest";
import { createSmallHouseVariantMaps, createSmallHouseVariantProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { stampDbExtractedHouse } from "@/editor/content/dbExtractedHouseTemplate";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import type { GameMap } from "@/project/types";
import { genId } from "@/util/id";

const WINDOW_TILES = new Set([85, 87]);
const EXTRACTED_DOOR_TOP = 329;
const EXTRACTED_DOOR_BOTTOM = 359;
const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const ROOF_TILES = new Set([354, 355, 356, 357, 374, 375, 377, 384, 385, 386, 387]);
const WALL_TILES = new Set([12, 13, 14, 15, 16, 17, 42, 43, 44, 45, 46, 47, 72, 73, 74, 75, 76, 77]);
const LEGACY_WOOD_WALL_TILES = new Set([102, 103, 104, 132, 133, 134, 162, 163, 164]);
const WATER_TILE = 120;
const TOWN_GRASS = 270;

function mapSignature(map: ReturnType<typeof createSmallHouseVariantMaps>[number]): string {
  return `${map.width}x${map.height}:${map.lowerTiles.join(",")}:${map.upperTiles.join(",")}`;
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function lowerDoorTopIndices(map: GameMap): number[] {
  return map.lowerTiles
    .map((tile, index) => ({ tile, index }))
    .filter((entry) => entry.tile === FRAMED_DOOR_TOP || entry.tile === EXTRACTED_DOOR_TOP)
    .map((entry) => entry.index);
}

function hasLowerDoorPair(map: GameMap): boolean {
  return lowerDoorTopIndices(map).some((index) => {
    const bottom = map.lowerTiles[index + map.width];
    return bottom === FRAMED_DOOR_BOTTOM || bottom === EXTRACTED_DOOR_BOTTOM;
  });
}

function hasRoadWithClearUpper(map: GameMap): boolean {
  let found = false;
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    if (!isRoadTile(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
    found = true;
    expect(map.upperTiles[index]).toBe(TILE.EMPTY);
    expect(map.lowerTileStacks?.[index]).toBeUndefined();
    expect(map.upperTileStacks?.[index]).toBeUndefined();
  }
  return found;
}

function createBlankTemplateApiMap(): GameMap {
  const width = 20;
  const height = 20;
  return {
    events: [],
    height,
    id: genId("map"),
    lowerTiles: new Array<number>(width * height).fill(TOWN_GRASS),
    name: "template api test",
    tileSize: 16,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

describe("small house variants", () => {
  it("stamps the canonical DB template API with lower doors, upper windows, and remapped walls", () => {
    const map = createBlankTemplateApiMap();

    stampDbExtractedHouse(map, {
      material: "stone",
      origin: { x: 2, y: 2 },
      preserveExistingGround: true,
    });

    expect(map.lowerTiles[at(map, 2, 2)]).toBe(TOWN_GRASS);
    expect(map.upperTiles[at(map, 6, 5)]).toBe(354);
    expect(map.upperTiles[at(map, 15, 5)]).toBe(355);
    expect(map.lowerTiles[at(map, 11, 8)]).toBe(12);
    expect(map.upperTiles[at(map, 12, 9)]).toBe(85);
    expect(map.lowerTiles[at(map, 14, 9)]).toBe(EXTRACTED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 14, 10)]).toBe(EXTRACTED_DOOR_BOTTOM);
    expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_TOP);
    expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_BOTTOM);
  });

  it("creates nine showcase maps from the house kit bridge without storing template grammar", () => {
    const maps = createSmallHouseVariantMaps();

    expect(maps).toHaveLength(9);
    expect(new Set(maps.map((map) => map.id)).size).toBe(9);
    expect(new Set(maps.map((map) => map.name)).size).toBe(9);
    expect(new Set(maps.map(mapSignature)).size).toBeGreaterThanOrEqual(8);

    let windowCount = 0;
    for (const map of maps) {
      expect(map.width).toBeGreaterThanOrEqual(16);
      expect(map.height).toBeGreaterThanOrEqual(15);
      expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(map.lowerTiles.some((tile) => WALL_TILES.has(tile))).toBe(true);
      expect(map.upperTiles.some((tile) => ROOF_TILES.has(tile))).toBe(true);
      windowCount += map.upperTiles.filter((tile) => WINDOW_TILES.has(tile)).length;
      expect(hasLowerDoorPair(map)).toBe(true);
      expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_TOP);
      expect(map.upperTiles).not.toContain(EXTRACTED_DOOR_BOTTOM);
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_TOP);
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_BOTTOM);
      expect(map.lowerTiles.some((tile) => tile === WATER_TILE)).toBe(false);
    }
    expect(windowCount).toBeGreaterThan(0);
  });

  it("maps the old wood material showcase onto the bright-plaster kit instead of legacy wood walls", () => {
    const woodRequested = createSmallHouseVariantMaps()[7];
    expect(woodRequested).toBeDefined();
    if (!woodRequested) return;

    expect(woodRequested.lowerTiles.some((tile) => LEGACY_WOOD_WALL_TILES.has(tile))).toBe(false);
    expect(woodRequested.lowerTiles.some((tile) => WALL_TILES.has(tile))).toBe(true);
    expect(hasLowerDoorPair(woodRequested)).toBe(true);
  });

  it("keeps roads clear on every variant that paints an approach", () => {
    const maps = createSmallHouseVariantMaps();
    expect(maps.some(hasRoadWithClearUpper)).toBe(true);
  });

  it("flattens overlapping 2x2 trees on variant 1 into one tile per layer", () => {
    const map = createSmallHouseVariantMaps()[0];
    expect(map).toBeDefined();
    if (!map) return;

    expect(map.upperTiles[at(map, 4, 3)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 18, 6)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 0, 3)]).toBe(262);
    expect(map.lowerTiles[at(map, 0, 4)]).toBe(292);
    expect(map.upperTiles[at(map, 0, 4)]).toBe(262);
    expect(map.lowerTiles[at(map, 0, 5)]).toBe(292);
    expect(map.upperTiles[at(map, 0, 5)]).toBe(262);
    expect(map.lowerTiles[at(map, 0, 6)]).toBe(292);
    expect(map.lowerTileStacks).toBeUndefined();
    expect(map.upperTileStacks).toBeUndefined();
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
      expect(project.startPos.x).toBeGreaterThanOrEqual(0);
      expect(project.startPos.x).toBeLessThan(startMap.width);
      expect(project.startPos.y).toBeGreaterThanOrEqual(0);
      expect(project.startPos.y).toBeLessThan(startMap.height);
    }
  });
});
