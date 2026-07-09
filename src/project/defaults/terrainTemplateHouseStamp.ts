import { stampRectHouseKit, type HouseKitId } from "@/editor/houseKit";
import type { GameMap } from "../types";
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

export type HouseStampRect = TilePoint & {
  readonly height: number;
  readonly width: number;
};

export type HouseStampPlan = {
  readonly door: {
    readonly bottomY: number;
    readonly topY: number;
    readonly x: number;
  };
  readonly roof: {
    readonly origin: TilePoint;
    readonly width: number;
  };
  readonly wall: {
    readonly origin: TilePoint;
    readonly rows: number;
    readonly width: number;
  };
  readonly windows?: readonly TilePoint[];
};

export type HouseKitBuildPlan = {
  readonly fence: HouseStampRect;
  readonly house: HouseStampPlan;
  readonly roads: readonly RoadRect[];
};

export type HouseKitBridgeStampInput = {
  readonly buildPlan: HouseKitBuildPlan;
  readonly includeFence?: boolean;
  readonly material: SmallHouseMaterial;
  readonly origin: TilePoint;
  readonly paintRoads?: boolean;
};

export const SMALL_HOUSE_01_HOUSE_KIT_PLAN = {
  fence: { x: 2, y: 2, width: 17, height: 15 },
  house: {
    roof: { origin: { x: 7, y: 4 }, width: 11 },
    wall: { origin: { x: 7, y: 8 }, width: 11, rows: 3 },
    door: { x: 13, topY: 9, bottomY: 10 },
  },
  roads: [
    { x: 13, y: 11, width: 2, height: 6 },
    { x: 13, y: 14, width: 4, height: 2 },
  ],
} as const satisfies HouseKitBuildPlan;

const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const FENCE_TOP_LEFT = 378;
const FENCE_TOP_RAIL = 379;
const FENCE_TOP_RIGHT = 380;
const FENCE_SIDE_RAIL = 408;
const FENCE_BOTTOM_LEFT = 438;
const FENCE_BOTTOM_RIGHT = 410;
const TOWN_PATH_TILES = new Set<number>(Object.values(SAND_TILE));

export function kitIdForSmallHouseMaterial(material: SmallHouseMaterial): HouseKitId {
  return material === "stone" ? "blue-stone" : "bright-plaster";
}

export function stampTerrainTemplateHouse(map: GameMap, input: HouseKitBridgeStampInput): void {
  const buildPlan = offsetBuildPlan(input.buildPlan, input.origin);
  if (input.includeFence !== false) stampFence(map, buildPlan.fence);
  const result = stampRectHouseKit(map, {
    x: buildPlan.house.wall.origin.x,
    y: buildPlan.house.roof.origin.y,
    width: buildPlan.house.wall.width,
    stories: buildPlan.house.wall.rows >= 5 ? 2 : 1,
    roofBodyRows: roofBodyRows(buildPlan.house),
    kitId: kitIdForSmallHouseMaterial(input.material),
  });
  if (result.ok) {
    setTile(map, { layer: "lower", tile: DOOR_TOP, x: buildPlan.house.door.x, y: buildPlan.house.door.topY });
    setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: buildPlan.house.door.x, y: buildPlan.house.door.bottomY });
  }
  if (input.paintRoads === true) {
    paintTownPathNetwork(map, buildPlan.roads);
    clearUpperTilesOnTownPath(map);
  }
}

export function terrainTemplateDoorBottomOffset(buildPlan: HouseKitBuildPlan): TilePoint {
  return { x: buildPlan.house.door.x, y: buildPlan.house.door.bottomY };
}

function roofBodyRows(house: HouseStampPlan): number {
  return Math.max(1, house.wall.origin.y - house.roof.origin.y - 2);
}

function stampFence(map: GameMap, fence: HouseStampRect): void {
  if (fence.width < 2 || fence.height < 2) return;
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

function offsetBuildPlan(buildPlan: HouseKitBuildPlan, origin: TilePoint): HouseKitBuildPlan {
  return {
    fence: offsetRect(origin, buildPlan.fence),
    house: {
      door: {
        x: origin.x + buildPlan.house.door.x,
        topY: origin.y + buildPlan.house.door.topY,
        bottomY: origin.y + buildPlan.house.door.bottomY,
      },
      roof: { origin: offsetPoint(origin, buildPlan.house.roof.origin), width: buildPlan.house.roof.width },
      wall: { origin: offsetPoint(origin, buildPlan.house.wall.origin), rows: buildPlan.house.wall.rows, width: buildPlan.house.wall.width },
    },
    roads: buildPlan.roads.map((road) => offsetRect(origin, road)),
  };
}

function offsetRect(origin: TilePoint, rect: HouseStampRect): RoadRect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, width: rect.width, height: rect.height };
}

function offsetPoint(origin: TilePoint, point: TilePoint): TilePoint {
  return { x: origin.x + point.x, y: origin.y + point.y };
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
