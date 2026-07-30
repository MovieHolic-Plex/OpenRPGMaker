import type { GameMap } from "../types";
import { SAND_TILE } from "./chipsetMapping";
import { TILE } from "./constants";
import {
  SMALL_HOUSE_01_HOUSE_KIT_PLAN,
  stampTerrainTemplateHouse,
  terrainTemplateDoorBottomOffset,
  type SmallHouseMaterial,
  type TilePoint,
} from "./dbExtractedHouseTemplate";
import { paintTownPathNetwork } from "./townPathAutotile";

type TileLayerName = "lower" | "upper";
type PlannedHouseVariant = "wide" | "compact" | "l";
export type DbHouseShapeVariant = "template" | PlannedHouseVariant;

export type DbHouseVariantStampInput = {
  readonly approachHeight?: number;
  readonly includeFence?: boolean;
  readonly material: SmallHouseMaterial;
  readonly origin: TilePoint;
  readonly variant: DbHouseShapeVariant;
};

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
type Rect = TilePoint & {
  readonly height: number;
  readonly width: number;
};
type HouseBody = {
  readonly roof: Rect;
  readonly wall: Rect;
};
type DoorPlan = {
  readonly bottom: TilePoint;
  readonly top: TilePoint;
};
type HouseWallTiles = {
  readonly body: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
  readonly top: readonly [number, number, number];
  readonly window: number;
};
type HouseVariantPlan = {
  readonly bodies: readonly HouseBody[];
  readonly door: DoorPlan;
  readonly fence: Rect;
  readonly windows: readonly TilePoint[];
};

const ROOF_BODY = 375;
const ROOF_CAP_RIGHT = 377;
const ROOF_FACE_LEFT = 404;
const ROOF_FACE_MID = 405;
const LEFT_DIAGONAL_ROOF_TOP = 354;
const LEFT_DIAGONAL_ROOF_MID = 376;
const LEFT_DIAGONAL_ROOF_BOTTOM = 384;
const RIGHT_DIAGONAL_ROOF_TOP = 355;
const RIGHT_DIAGONAL_ROOF_MID = 377;
const RIGHT_DIAGONAL_ROOF_BOTTOM = 385;
const DB_DOOR_TOP = 329;
const DB_DOOR_BOTTOM = 359;
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
const VARIANT_PLANS: Record<PlannedHouseVariant, HouseVariantPlan> = {
  wide: {
    fence: { x: 0, y: 0, width: 18, height: 16 },
    bodies: [{ roof: { x: 2, y: 3, width: 14, height: 4 }, wall: { x: 2, y: 7, width: 14, height: 3 } }],
    door: { top: { x: 9, y: 8 }, bottom: { x: 9, y: 9 } },
    windows: [{ x: 5, y: 8 }, { x: 13, y: 8 }],
  },
  compact: {
    fence: { x: 1, y: 0, width: 14, height: 16 },
    bodies: [{ roof: { x: 4, y: 3, width: 9, height: 4 }, wall: { x: 4, y: 7, width: 9, height: 3 } }],
    door: { top: { x: 8, y: 8 }, bottom: { x: 8, y: 9 } },
    windows: [{ x: 6, y: 8 }, { x: 11, y: 8 }],
  },
  l: {
    fence: { x: 0, y: 0, width: 18, height: 16 },
    bodies: [
      { roof: { x: 2, y: 2, width: 12, height: 4 }, wall: { x: 2, y: 6, width: 12, height: 3 } },
      { roof: { x: 8, y: 6, width: 8, height: 4 }, wall: { x: 8, y: 10, width: 8, height: 3 } },
    ],
    door: { top: { x: 12, y: 11 }, bottom: { x: 12, y: 12 } },
    windows: [{ x: 5, y: 7 }, { x: 10, y: 7 }, { x: 10, y: 11 }, { x: 15, y: 11 }],
  },
} as const;

export function dbHouseVariantDoorBottomOffset(variant: DbHouseShapeVariant): TilePoint {
  switch (variant) {
    case "template":
      return terrainTemplateDoorBottomOffset(SMALL_HOUSE_01_HOUSE_KIT_PLAN);
    case "wide":
    case "compact":
    case "l":
      return VARIANT_PLANS[variant].door.bottom;
    default:
      return assertNever(variant);
  }
}

export function stampDbHouseVariant(map: GameMap, input: DbHouseVariantStampInput): void {
  switch (input.variant) {
    case "template":
      stampTerrainTemplateHouse(map, {
        buildPlan: SMALL_HOUSE_01_HOUSE_KIT_PLAN,
        includeFence: input.includeFence,
        material: input.material,
        origin: input.origin,
      });
      break;
    case "wide":
    case "compact":
    case "l":
      stampPlannedVariant(map, {
        includeFence: input.includeFence ?? true,
        material: input.material,
        origin: input.origin,
        plan: VARIANT_PLANS[input.variant],
      });
      break;
    default:
      assertNever(input.variant);
  }
  if (input.approachHeight !== undefined) {
    paintApproach(map, { doorBottom: dbHouseVariantDoorBottomOffset(input.variant), height: input.approachHeight, origin: input.origin });
  }
}

function stampPlannedVariant(
  map: GameMap,
  input: { readonly includeFence: boolean; readonly material: SmallHouseMaterial; readonly origin: TilePoint; readonly plan: HouseVariantPlan }
): void {
  if (input.includeFence) stampFence(map, offsetRect(input.origin, input.plan.fence));
  for (const body of input.plan.bodies) stampBody(map, { body, material: input.material, origin: input.origin });
  for (const window of input.plan.windows) {
    placeTile(map, { layer: "upper", tile: WALL_TILES[input.material].window, ...offsetPoint(input.origin, window) });
  }
  placeTile(map, { layer: "lower", tile: DB_DOOR_TOP, ...offsetPoint(input.origin, input.plan.door.top) });
  placeTile(map, { layer: "lower", tile: DB_DOOR_BOTTOM, ...offsetPoint(input.origin, input.plan.door.bottom) });
}

function stampBody(map: GameMap, input: { readonly body: HouseBody; readonly material: SmallHouseMaterial; readonly origin: TilePoint }): void {
  stampRoof(map, offsetRect(input.origin, input.body.roof));
  const wall = WALL_TILES[input.material];
  for (let row = 0; row < input.body.wall.height; row += 1) {
    stampRun(map, {
      layer: "lower",
      origin: offsetPoint(input.origin, { x: input.body.wall.x, y: input.body.wall.y + row }),
      tiles: wallTilesForRow(wall, row, input.body.wall.height),
      width: input.body.wall.width,
    });
  }
}

function stampRoof(map: GameMap, roof: Rect): void {
  stampRun(map, { layer: "upper", origin: { x: roof.x + 1, y: roof.y }, tiles: [ROOF_BODY, ROOF_BODY, ROOF_CAP_RIGHT], width: roof.width - 2 });
  stampRun(map, { layer: "upper", origin: { x: roof.x + 1, y: roof.y + 1 }, tiles: [ROOF_BODY, ROOF_BODY, ROOF_BODY], width: roof.width - 2 });
  stampRun(map, { layer: "upper", origin: { x: roof.x + 1, y: roof.y + 2 }, tiles: [ROOF_BODY, ROOF_BODY, ROOF_BODY], width: roof.width - 2 });
  stampRun(map, { layer: "lower", origin: { x: roof.x, y: roof.y + 3 }, tiles: [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID], width: roof.width });
  placeTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_TOP, x: roof.x, y: roof.y });
  placeTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_MID, x: roof.x, y: roof.y + 1 });
  placeTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_MID, x: roof.x, y: roof.y + 2 });
  placeTile(map, { layer: "upper", tile: LEFT_DIAGONAL_ROOF_BOTTOM, x: roof.x, y: roof.y + 3 });
  placeTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_TOP, x: roof.x + roof.width - 1, y: roof.y });
  placeTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_MID, x: roof.x + roof.width - 1, y: roof.y + 1 });
  placeTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_MID, x: roof.x + roof.width - 1, y: roof.y + 2 });
  placeTile(map, { layer: "upper", tile: RIGHT_DIAGONAL_ROOF_BOTTOM, x: roof.x + roof.width - 1, y: roof.y + 3 });
}

function stampFence(map: GameMap, fence: Rect): void {
  const lastX = fence.x + fence.width - 1;
  const lastY = fence.y + fence.height - 1;
  for (let x = fence.x + 1; x < lastX; x += 1) {
    placeTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: fence.y });
    placeTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: lastY });
  }
  for (let y = fence.y + 1; y < lastY; y += 1) {
    placeTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: fence.x, y });
    placeTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: lastX, y });
  }
  placeTile(map, { layer: "upper", tile: FENCE_TOP_LEFT, x: fence.x, y: fence.y });
  placeTile(map, { layer: "upper", tile: FENCE_TOP_RIGHT, x: lastX, y: fence.y });
  placeTile(map, { layer: "upper", tile: FENCE_BOTTOM_LEFT, x: fence.x, y: lastY });
  placeTile(map, { layer: "upper", tile: FENCE_BOTTOM_RIGHT, x: lastX, y: lastY });
}

function stampRun(map: GameMap, run: TileRun): void {
  for (let offset = 0; offset < run.width; offset += 1) placeTile(map, { layer: run.layer, tile: run.tiles[columnIndex(offset, run.width)], x: run.origin.x + offset, y: run.origin.y });
}

function paintApproach(map: GameMap, input: { readonly doorBottom: TilePoint; readonly height: number; readonly origin: TilePoint }): void {
  paintTownPathNetwork(map, [{ x: input.origin.x + input.doorBottom.x, y: input.origin.y + input.doorBottom.y + 1, width: 1, height: input.height }]);
}

function wallTilesForRow(wall: HouseWallTiles, row: number, rows: number): readonly [number, number, number] {
  if (row === 0) return wall.top;
  if (row === rows - 1) return wall.bottom;
  return wall.body;
}

function placeTile(map: GameMap, placement: TilePlacement): void {
  if (!isInside(map, placement)) return;
  const index = placement.y * map.width + placement.x;
  const lowerTile = map.lowerTiles[index] ?? TILE.EMPTY;
  if (TOWN_PATH_TILES.has(lowerTile)) return;
  if (placement.layer === "lower") map.lowerTiles[index] = placement.tile;
  else map.upperTiles[index] = placement.tile;
}

function offsetRect(origin: TilePoint, rect: Rect): Rect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, width: rect.width, height: rect.height };
}

function offsetPoint(origin: TilePoint, point: TilePoint): TilePoint {
  return { x: origin.x + point.x, y: origin.y + point.y };
}

function columnIndex(offset: number, width: number): 0 | 1 | 2 {
  if (offset === 0) return 0;
  if (offset === width - 1) return 2;
  return 1;
}

function isInside(map: GameMap, point: TilePoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled DB house variant: ${value}`);
}
