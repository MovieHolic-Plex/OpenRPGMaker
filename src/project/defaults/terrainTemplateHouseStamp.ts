import type { GameMap, TerrainTemplateBuildPlan, TerrainTemplateHouseBuildPlan, TerrainTemplatePoint, TerrainTemplateRect, TerrainTemplateSpan, TerrainTemplateWallSpan } from "../types";
import { SAND_TILE } from "./chipsetMapping";
import { TILE } from "./constants";
import type { SmallHouseMaterial, TilePoint } from "./dbExtractedHouseTemplate";
import type { RoadRect } from "./roadAutotile";
import { clearUpperTilesOnTownPath, paintTownPathNetwork } from "./townPathAutotile";

type TileLayerName = "lower" | "upper";
type TilePlacement = TilePoint & {
  readonly layer: TileLayerName;
  readonly tile: number;
};
type TileRun = {
  readonly layer: TileLayerName;
  readonly origin: TilePoint;
  readonly tiles: readonly [number, number, number];
  readonly width: number;
};
type HouseWallTiles = {
  readonly body: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
  readonly top: readonly [number, number, number];
  readonly window: number;
};
export type TerrainTemplateHouseStampInput = {
  readonly buildPlan: TerrainTemplateBuildPlan;
  readonly includeFence?: boolean;
  readonly material: SmallHouseMaterial;
  readonly origin: TilePoint;
  readonly paintRoads?: boolean;
};

const ROOF_BODY = 375;
const ROOF_CAP_RIGHT = 377;
const ROOF_FACE_MID = 405;
const LEFT_DIAGONAL_ROOF_TOP = 354;
const LEFT_DIAGONAL_ROOF_MID = 376;
const LEFT_DIAGONAL_ROOF_BOTTOM = 384;
const RIGHT_DIAGONAL_ROOF_TOP = 355;
const RIGHT_DIAGONAL_ROOF_MID = 377;
const RIGHT_DIAGONAL_ROOF_BOTTOM = 385;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const FENCE_TOP_LEFT = 378;
const FENCE_TOP_RAIL = 379;
const FENCE_TOP_RIGHT = 380;
const FENCE_SIDE_RAIL = 408;
const FENCE_BOTTOM_LEFT = 438;
const FENCE_BOTTOM_RIGHT = 410;
const WALL_TILES: Record<SmallHouseMaterial, HouseWallTiles> = {
  plaster: { top: [15, 16, 17], body: [45, 46, 47], bottom: [75, 76, 77], window: 87 },
  stone: { top: [12, 13, 14], body: [42, 43, 44], bottom: [72, 73, 74], window: 85 },
  wood: { top: [102, 103, 104], body: [132, 133, 134], bottom: [162, 163, 164], window: 85 },
};
const TOWN_PATH_TILES = new Set<number>(Object.values(SAND_TILE));

export function stampTerrainTemplateHouse(map: GameMap, input: TerrainTemplateHouseStampInput): void {
  const buildPlan = offsetBuildPlan(input.buildPlan, input.origin);
  if (input.includeFence !== false) stampFence(map, buildPlan.fence);
  stampHouse(map, buildPlan.house, input.material);
  if (input.paintRoads === true) {
    paintTownPathNetwork(map, buildPlan.roads);
    clearUpperTilesOnTownPath(map);
  }
}

export function terrainTemplateDoorBottomOffset(buildPlan: TerrainTemplateBuildPlan): TilePoint {
  return { x: buildPlan.house.door.x, y: buildPlan.house.door.bottomY };
}

function stampHouse(map: GameMap, house: TerrainTemplateHouseBuildPlan, material: SmallHouseMaterial): void {
  stampRoof(map, house.roof);
  stampWall(map, house.wall, WALL_TILES[material]);
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: house.door.x, y: house.door.topY });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: house.door.x, y: house.door.bottomY });
  for (const window of house.windows) setTile(map, { layer: "upper", tile: WALL_TILES[material].window, x: window.x, y: window.y });
}

function stampRoof(map: GameMap, roof: TerrainTemplateSpan): void {
  const innerOrigin = { x: roof.origin.x + 1, y: roof.origin.y };
  const innerWidth = roof.width - 2;
  stampRun(map, { layer: "upper", origin: innerOrigin, tiles: [ROOF_BODY, ROOF_BODY, ROOF_CAP_RIGHT], width: innerWidth });
  stampRun(map, { layer: "upper", origin: { x: innerOrigin.x, y: roof.origin.y + 1 }, tiles: [ROOF_BODY, ROOF_BODY, ROOF_BODY], width: innerWidth });
  stampRun(map, { layer: "upper", origin: { x: innerOrigin.x, y: roof.origin.y + 2 }, tiles: [ROOF_BODY, ROOF_BODY, ROOF_BODY], width: innerWidth });
  stampRun(map, { layer: "lower", origin: { x: roof.origin.x, y: roof.origin.y + 3 }, tiles: [ROOF_FACE_MID, ROOF_FACE_MID, ROOF_FACE_MID], width: roof.width });
  stampRoofEnds(map, roof);
}

function stampRoofEnds(map: GameMap, roof: TerrainTemplateSpan): void {
  const leftX = roof.origin.x;
  const rightX = roof.origin.x + roof.width - 1;
  setTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_TOP, x: leftX, y: roof.origin.y });
  setTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_MID, x: leftX, y: roof.origin.y + 1 });
  setTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_MID, x: leftX, y: roof.origin.y + 2 });
  setTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_BOTTOM, x: leftX, y: roof.origin.y + 3 });
  setTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_TOP, x: rightX, y: roof.origin.y });
  setTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_MID, x: rightX, y: roof.origin.y + 1 });
  setTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_MID, x: rightX, y: roof.origin.y + 2 });
  setTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_BOTTOM, x: rightX, y: roof.origin.y + 3 });
}

function stampWall(map: GameMap, wall: TerrainTemplateWallSpan, tiles: HouseWallTiles): void {
  for (let row = 0; row < wall.rows; row += 1) {
    stampRun(map, {
      layer: "lower",
      origin: { x: wall.origin.x, y: wall.origin.y + row },
      tiles: wallTilesForRow(tiles, row, wall.rows),
      width: wall.width,
    });
  }
}

function stampFence(map: GameMap, fence: TerrainTemplateRect): void {
  const lastX = fence.x + fence.width - 1;
  const lastY = fence.y + fence.height - 1;
  for (let x = fence.x + 1; x < lastX; x += 1) {
    setTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: fence.y });
    setTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: lastY });
  }
  for (let y = fence.y + 1; y < lastY; y += 1) {
    setTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: fence.x, y });
    setTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: lastX, y });
  }
  setTile(map, { layer: "upper", tile: FENCE_TOP_LEFT, x: fence.x, y: fence.y });
  setTile(map, { layer: "upper", tile: FENCE_TOP_RIGHT, x: lastX, y: fence.y });
  setTile(map, { layer: "upper", tile: FENCE_BOTTOM_LEFT, x: fence.x, y: lastY });
  setTile(map, { layer: "upper", tile: FENCE_BOTTOM_RIGHT, x: lastX, y: lastY });
}

function stampRun(map: GameMap, run: TileRun): void {
  for (let offset = 0; offset < run.width; offset += 1) {
    setTile(map, { layer: run.layer, tile: run.tiles[columnIndex(offset, run.width)], x: run.origin.x + offset, y: run.origin.y });
  }
}

function offsetBuildPlan(buildPlan: TerrainTemplateBuildPlan, origin: TilePoint): TerrainTemplateBuildPlan {
  return {
    fence: offsetRect(origin, buildPlan.fence),
    house: offsetHouse(origin, buildPlan.house),
    roads: buildPlan.roads.map((road) => offsetRect(origin, road)),
  };
}

function offsetHouse(origin: TilePoint, house: TerrainTemplateHouseBuildPlan): TerrainTemplateHouseBuildPlan {
  return {
    door: { x: origin.x + house.door.x, topY: origin.y + house.door.topY, bottomY: origin.y + house.door.bottomY },
    roof: { origin: offsetPoint(origin, house.roof.origin), width: house.roof.width },
    wall: { origin: offsetPoint(origin, house.wall.origin), rows: house.wall.rows, width: house.wall.width },
    windows: house.windows.map((window) => offsetPoint(origin, window)),
  };
}

function offsetRect(origin: TilePoint, rect: TerrainTemplateRect): RoadRect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, width: rect.width, height: rect.height };
}

function offsetPoint(origin: TilePoint, point: TerrainTemplatePoint): TilePoint {
  return { x: origin.x + point.x, y: origin.y + point.y };
}

function wallTilesForRow(wall: HouseWallTiles, row: number, rows: number): readonly [number, number, number] {
  if (row === 0) return wall.top;
  if (row === rows - 1) return wall.bottom;
  return wall.body;
}

function columnIndex(offset: number, width: number): 0 | 1 | 2 {
  if (offset === 0) return 0;
  if (offset === width - 1) return 2;
  return 1;
}

function setTile(map: GameMap, placement: TilePlacement): void {
  if (!isInside(map, placement)) return;
  const index = placement.y * map.width + placement.x;
  const lowerTile = map.lowerTiles[index] ?? TILE.EMPTY;
  if (TOWN_PATH_TILES.has(lowerTile)) return;
  if (placement.layer === "lower") map.lowerTiles[index] = placement.tile;
  else map.upperTiles[index] = placement.tile;
}

function isInside(map: GameMap, point: TilePoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
