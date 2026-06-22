import { genId } from "@/util/id";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, TILE } from "./constants";
import { clearUpperTilesOnTownPath, paintTownPathNetwork, shapeAllTownPaths } from "./townPathAutotile";

const ARCHITECTURE_TEST_SIZE = 20;
const COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const TOWN_GRASS = 270;
const ROOF_CAP_LEFT = 374;
const ROOF_CAP_RIGHT = 377;
const ROOF_DIAGONAL_B = 375;
const ROOF_FACE_LEFT = 404;
const ROOF_FACE_MID = 405;
const WOOD_ROOF_FACE_LEFT = 102;
const WOOD_ROOF_FACE_MID = 103;
const WOOD_ROOF_FACE_RIGHT = 104;
const WOOD_LEFT = 132;
const WOOD_MID = 133;
const WOOD_RIGHT = 134;
const WOOD_BOTTOM_LEFT = 162;
const WOOD_BOTTOM_MID = 163;
const WOOD_BOTTOM_RIGHT = 164;
const PLASTER_LEFT = 45;
const PLASTER_MID = 46;
const PLASTER_RIGHT = 47;
const PLASTER_BOTTOM_LEFT = 75;
const PLASTER_BOTTOM_MID = 76;
const PLASTER_BOTTOM_RIGHT = 77;
const WINDOW_WOOD = 85;
const WINDOW_PLASTER = 87;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;

type TilePoint = {
  readonly x: number;
  readonly y: number;
};

export function createTownArchitectureTestMap(): GameMap {
  const map = createArchitectureBlankMap();
  stampTrueLHouse(map);
  stampTwoStoryHouse(map);
  paintTownPathNetwork(map, [
    { x: 3, y: 16, width: 3, height: 3 },
    { x: 15, y: 11, width: 1, height: 8 },
    { x: 2, y: 17, width: 17, height: 2 },
  ]);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
  stampForegroundOpenings(map);
  return map;
}

function createArchitectureBlankMap(): GameMap {
  const tileCount = ARCHITECTURE_TEST_SIZE * ARCHITECTURE_TEST_SIZE;
  return {
    id: genId("map"),
    name: "20x20 도시 건축 테스트맵",
    width: ARCHITECTURE_TEST_SIZE,
    height: ARCHITECTURE_TEST_SIZE,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(tileCount).fill(TOWN_GRASS),
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    events: [],
  };
}

function stampTrueLHouse(map: GameMap): void {
  stampDiagonalRoofBand(map, { x: 1, y: 1 }, 10, 3);
  stampWoodRoofFaceRun(map, { x: 1, y: 4 }, 10);
  for (let y = 5; y <= 8; y += 1) stampWoodRun(map, { x: 1, y }, 10, y === 8 ? "bottom" : "body");
  stampDiagonalRoofBand(map, { x: 1, y: 9 }, 7, 3);
  stampWoodRoofFaceRun(map, { x: 1, y: 12 }, 7);
  for (let y = 13; y <= 16; y += 1) stampWoodRun(map, { x: 1, y }, 7, y === 16 ? "bottom" : "body");
  stampWoodOpenings(map);
}

function stampWoodOpenings(map: GameMap): void {
  stampUpper(map, { x: 4, y: 6 }, WINDOW_WOOD);
  stampUpper(map, { x: 7, y: 6 }, WINDOW_WOOD);
  stampUpper(map, { x: 2, y: 14 }, WINDOW_WOOD);
  stampUpper(map, { x: 6, y: 14 }, WINDOW_WOOD);
  stampUpper(map, { x: 4, y: 15 }, DOOR_TOP);
  stampUpper(map, { x: 4, y: 16 }, DOOR_BOTTOM);
}

function stampTwoStoryHouse(map: GameMap): void {
  stampDiagonalRoofBand(map, { x: 12, y: 1 }, 7, 4);
  stampRoofFaceRun(map, { x: 12, y: 5 }, 7);
  for (let y = 6; y <= 12; y += 1) stampPlasterRun(map, { x: 12, y }, 7, y === 12 ? "bottom" : "body");
  stampPlasterOpenings(map);
}

function stampPlasterOpenings(map: GameMap): void {
  stampUpper(map, { x: 14, y: 8 }, WINDOW_PLASTER);
  stampUpper(map, { x: 16, y: 8 }, WINDOW_PLASTER);
  stampUpper(map, { x: 13, y: 10 }, WINDOW_PLASTER);
  stampUpper(map, { x: 17, y: 10 }, WINDOW_PLASTER);
  stampUpper(map, { x: 15, y: 10 }, DOOR_TOP);
  stampUpper(map, { x: 15, y: 11 }, DOOR_BOTTOM);
}

function stampForegroundOpenings(map: GameMap): void {
  stampWoodOpenings(map);
  stampPlasterOpenings(map);
}

function stampDiagonalRoofBand(map: GameMap, origin: TilePoint, width: number, height: number): void {
  for (let offsetY = 0; offsetY < height; offsetY += 1) {
    if (offsetY === 0) {
      stampDiagonalRoofRun(map, { x: origin.x, y: origin.y + offsetY }, width);
    } else {
      stampRoofBodyRun(map, { x: origin.x, y: origin.y + offsetY }, width);
    }
  }
}

function stampDiagonalRoofRun(map: GameMap, origin: TilePoint, width: number): void {
  for (let offset = 0; offset < width; offset += 1) {
    const tile = roofTileForOffset(offset, width);
    stampUpper(map, { x: origin.x + offset, y: origin.y }, tile);
  }
}

function stampRoofBodyRun(map: GameMap, origin: TilePoint, width: number): void {
  for (let offset = 0; offset < width; offset += 1) {
    stampUpper(map, { x: origin.x + offset, y: origin.y }, roofTileForOffset(offset, width));
  }
}

function stampRoofFaceRun(map: GameMap, origin: TilePoint, width: number): void {
  stampRun(map, origin, width, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
}

function stampWoodRoofFaceRun(map: GameMap, origin: TilePoint, width: number): void {
  stampLowerRun(map, origin, width, [WOOD_ROOF_FACE_LEFT, WOOD_ROOF_FACE_MID, WOOD_ROOF_FACE_RIGHT]);
}

function stampWoodRun(map: GameMap, origin: TilePoint, width: number, row: "body" | "bottom"): void {
  const tiles: readonly [number, number, number] =
    row === "bottom" ? [WOOD_BOTTOM_LEFT, WOOD_BOTTOM_MID, WOOD_BOTTOM_RIGHT] : [WOOD_LEFT, WOOD_MID, WOOD_RIGHT];
  stampLowerRun(map, origin, width, tiles);
}

function stampPlasterRun(map: GameMap, origin: TilePoint, width: number, row: "body" | "bottom"): void {
  const tiles: readonly [number, number, number] =
    row === "bottom"
      ? [PLASTER_BOTTOM_LEFT, PLASTER_BOTTOM_MID, PLASTER_BOTTOM_RIGHT]
      : [PLASTER_LEFT, PLASTER_MID, PLASTER_RIGHT];
  stampLowerRun(map, origin, width, tiles);
}

function stampRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) {
    stampUpper(map, { x: origin.x + offset, y: origin.y }, tiles[columnIndex(offset, width)]);
  }
}

function stampLowerRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) {
    stampLower(map, { x: origin.x + offset, y: origin.y }, tiles[columnIndex(offset, width)]);
  }
}

function roofTileForOffset(offset: number, width: number): number {
  if (offset === 0) return ROOF_CAP_LEFT;
  if (offset === width - 1) return ROOF_CAP_RIGHT;
  return ROOF_DIAGONAL_B;
}

function columnIndex(offset: number, width: number): 0 | 1 | 2 {
  if (offset === 0) return 0;
  if (offset === width - 1) return 2;
  return 1;
}

function stampUpper(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point)) map.upperTiles[point.y * map.width + point.x] = tile;
}

function stampLower(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point)) map.lowerTiles[point.y * map.width + point.x] = tile;
}

function isInside(map: GameMap, point: TilePoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
