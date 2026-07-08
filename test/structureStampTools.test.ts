import { describe, expect, it } from "vitest";
import {
  applyStructureStampToMap,
  canPlaceStructureStampOnMap,
  previewStructureStampCells,
} from "@/editor/structureStampTools";
import { INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorStructureStamp";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";
import { genId } from "@/util/id";

const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const ROOF_LEFT = 354;
const ROOF_RIGHT = 355;
const WINDOW = 85;
const INTERIOR_WALL_TOP_LEFT = 102;
const INTERIOR_FLOOR = 138;
const INTERIOR_BOOKSHELF_LEFT = 48;
const INTERIOR_BED_TOP_LEFT = 324;
const INTERIOR_TABLE_CENTER = 409;
const INTERIOR_DOOR_BOTTOM = 294;

describe("structure stamp tools", () => {
  it("stamps a complete template house onto both tile layers", () => {
    const map = createMap();

    applyStructureStampToMap(map, { id: "house-template", origin: { x: 1, y: 1 } });

    expect(map.upperTiles[at(map, 8, 5)]).toBe(ROOF_LEFT);
    expect(map.upperTiles[at(map, 18, 5)]).toBe(ROOF_RIGHT);
    expect(map.upperTiles[at(map, 9, 10)]).toBe(WINDOW);
    expect(map.upperTiles[at(map, 15, 10)]).toBe(WINDOW);
    expect(map.lowerTiles[at(map, 14, 10)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 14, 11)]).toBe(FRAMED_DOOR_BOTTOM);
  });

  it("reports preview cells for the structure before committing it", () => {
    const map = createMap();

    const cells = previewStructureStampCells(map, { id: "house-template", origin: { x: 1, y: 1 } });

    expect(cells).toEqual(expect.arrayContaining([
      { layer: "upper", tile: ROOF_LEFT, x: 8, y: 5 },
      { layer: "upper", tile: WINDOW, x: 9, y: 10 },
      { layer: "lower", tile: FRAMED_DOOR_BOTTOM, x: 14, y: 11 },
    ]));
    expect(map.upperTiles[at(map, 8, 5)]).toBe(TILE.EMPTY);
  });

  it("stamps a furnished 10x10 small-house interior", () => {
    const map = createInteriorMap();

    applyStructureStampToMap(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(map.lowerTiles[at(map, 2, 3)]).toBe(INTERIOR_WALL_TOP_LEFT);
    expect(map.lowerTiles[at(map, 5, 6)]).toBe(INTERIOR_FLOOR);
    expect(map.lowerTiles[at(map, 6, 12)]).toBe(INTERIOR_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, 3, 5)]).toBe(INTERIOR_BOOKSHELF_LEFT);
    expect(map.upperTiles[at(map, 8, 5)]).toBe(INTERIOR_BED_TOP_LEFT);
    expect(map.upperTiles[at(map, 6, 8)]).toBe(INTERIOR_TABLE_CENTER);
  });

  it("previews the 10x10 interior without mutating the map", () => {
    const map = createInteriorMap();

    const cells = previewStructureStampCells(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(cells).toEqual(expect.arrayContaining([
      { layer: "lower", tile: INTERIOR_WALL_TOP_LEFT, x: 2, y: 3 },
      { layer: "upper", tile: INTERIOR_BED_TOP_LEFT, x: 8, y: 5 },
      { layer: "upper", tile: INTERIOR_TABLE_CENTER, x: 6, y: 8 },
    ]));
    expect(map.lowerTiles[at(map, 2, 3)]).toBe(TILE.GRASS);
    expect(map.upperTiles[at(map, 8, 5)]).toBe(TILE.EMPTY);
  });

  it("does not stamp interior tiles into an exterior tileset map", () => {
    const map = createMap();
    const lowerTiles = [...map.lowerTiles];
    const upperTiles = [...map.upperTiles];

    applyStructureStampToMap(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(map.lowerTiles).toEqual(lowerTiles);
    expect(map.upperTiles).toEqual(upperTiles);
  });

  it("keeps exterior and interior structure stamps on their own tilesets", () => {
    const exteriorMap = createMap();
    const interiorMap = createInteriorMap();

    expect(canPlaceStructureStampOnMap(exteriorMap, "house-compact")).toBe(true);
    expect(canPlaceStructureStampOnMap(exteriorMap, "house-interior-10x10")).toBe(false);
    expect(canPlaceStructureStampOnMap(interiorMap, "house-interior-10x10")).toBe(true);
    expect(canPlaceStructureStampOnMap(interiorMap, "house-compact")).toBe(false);
  });
});

function createMap(tilesetId = DEFAULT_TILESET_ID): GameMap {
  const width = 24;
  const height = 24;
  return {
    events: [],
    height,
    id: genId("map"),
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    name: "structure stamp test",
    tileSize: 16,
    tilesetId,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

function createInteriorMap(): GameMap {
  return createMap(INTERIOR_HOUSE_TILESET_ID);
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}
