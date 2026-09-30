import { describe, expect, it } from "vitest";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";

const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const WINDOW_TILES = new Set([85, 87]);
const WALL_TILES = new Set([12, 13, 14, 15, 16, 17, 42, 43, 44, 45, 46, 47, 72, 73, 74, 75, 76, 77]);
const ROOF_TILES = new Set([354, 355, 356, 357, 374, 375, 377, 384, 385, 386, 387]);
const FENCE_TILES = new Set([378, 379, 380, 408, 438, 409, 410]);
const PROP_TILES = new Set([TILE.FLOWERS, TILE.TREE, 260, 288, 289, 290]);

function lowerDoorTopIndices(map: GameMap): number[] {
  return map.lowerTiles
    .map((tile, index) => ({ tile, index }))
    .filter((entry) => entry.tile === FRAMED_DOOR_TOP)
    .map((entry) => entry.index);
}

function countDoorPairs(map: GameMap): number {
  return lowerDoorTopIndices(map).filter((index) => map.lowerTiles[index + map.width] === FRAMED_DOOR_BOTTOM).length;
}

function countClearRoads(map: GameMap): number {
  let roadCount = 0;
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    if (!isRoadTile(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
    roadCount += 1;
    expect(map.upperTiles[index]).toBe(TILE.EMPTY);
    expect(map.lowerTileStacks?.[index]).toBeUndefined();
    expect(map.upperTileStacks?.[index]).toBeUndefined();
  }
  return roadCount;
}

describe("house template gallery project", () => {
  it("keeps the original small_house_01 variant as root with five gallery children", () => {
    const project = createHouseTemplateGalleryProject();
    const maps = Object.values(project.maps);

    expect(maps).toHaveLength(6);
    expect(maps.some((map) => map.name === "small_house_01 변형 1")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 2")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 3")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 4")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 5")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 도시 8채")).toBe(true);
    expect(project.maps[project.startMapId]?.name).toBe("small_house_01 변형 1");
    expect(project.mapTree.mapId).toBe(project.startMapId);
    expect(project.mapTree.children).toHaveLength(5);
    expect(project.mapTree.children.map((child) => project.maps[child.mapId]?.name)).toEqual([
      "small_house_01 변형 2",
      "small_house_01 변형 3",
      "small_house_01 변형 4",
      "small_house_01 변형 5",
      "small_house_01 도시 8채",
    ]);
  });

  it("builds child variants with house kit layers and clear autotile roads", () => {
    const project = createHouseTemplateGalleryProject();
    let roadCount = 0;
    let windowCount = 0;
    for (const child of project.mapTree.children.slice(0, 4)) {
      const map = project.maps[child.mapId];
      expect(map).toBeDefined();
      if (!map) continue;

      expect(countDoorPairs(map)).toBeGreaterThanOrEqual(1);
      expect(map.lowerTiles.some((tile) => WALL_TILES.has(tile))).toBe(true);
      expect(map.upperTiles.some((tile) => ROOF_TILES.has(tile))).toBe(true);
      windowCount += map.upperTiles.filter((tile) => WINDOW_TILES.has(tile)).length;
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_TOP);
      expect(map.upperTiles).not.toContain(FRAMED_DOOR_BOTTOM);
      roadCount += countClearRoads(map);
    }
    expect(roadCount).toBeGreaterThan(0);
    expect(windowCount).toBeGreaterThan(0);
  });

  it("keeps the first child free of prop objects", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    expect(map.upperTiles.every((tile) => !PROP_TILES.has(tile))).toBe(true);
    expect(Object.values(map.upperTileStacks ?? {}).flat().length).toBe(0);
  });

  it("adds a 50x50 no-fence city map with eight kit houses", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[4]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 도시 8채");
    if (!map) return;
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(map.upperTiles.every((tile) => !FENCE_TILES.has(tile))).toBe(true);
    expect(map.lowerTiles.filter((tile) => tile === FRAMED_DOOR_TOP)).toHaveLength(8);
    expect(map.lowerTiles.filter((tile) => tile === FRAMED_DOOR_BOTTOM)).toHaveLength(8);
    expect(countDoorPairs(map)).toBe(8);
    expect(map.lowerTileStacks).toBeUndefined();
    expect(map.upperTileStacks).toBeUndefined();
    expect(countClearRoads(map)).toBeGreaterThan(0);
  });

  it("does not store terrain templates and drops legacy fields on round trip", () => {
    const project = createHouseTemplateGalleryProject();
    const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID] as unknown as Record<string, unknown>;

    expect("terrainTemplates" in tileset).toBe(false);
    const raw = JSON.parse(serialize(project)) as Record<string, unknown>;
    expect(JSON.stringify(raw)).not.toContain("terrainTemplates");

    const legacy = JSON.parse(serialize(project)) as Record<string, unknown>;
    const legacyTilesets = legacy.tilesets as Record<string, Record<string, unknown>>;
    legacyTilesets[COMBINED_TOWN_TILESET_ID].terrainTemplates = [{ id: "legacy_house", name: "legacy" }];
    const loaded = deserialize(JSON.stringify(legacy));
    expect("terrainTemplates" in (loaded.tilesets[COMBINED_TOWN_TILESET_ID] as unknown as Record<string, unknown>)).toBe(false);
    expect(serialize(loaded)).not.toContain("terrainTemplates");
  });
});
