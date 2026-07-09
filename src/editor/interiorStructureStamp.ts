import type { TilePoint } from "@/project/defaults/dbExtractedHouseTemplate";
import type { GameMap } from "@/project/types";

type StampTilePlacement = TilePoint & {
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

type StampRect = TilePoint & {
  readonly height: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
  readonly width: number;
};

type StampPattern = {
  readonly layer: "lower" | "upper";
  readonly origin: TilePoint;
  readonly rows: readonly (readonly number[])[];
};

export const INTERIOR_HOUSE_TILESET_ID = "easyrpg_chipset_interior";

export const INTERIOR_HOUSE_TILE = {
  BED_BOTTOM_LEFT: 354,
  BED_BOTTOM_MID: 355,
  BED_BOTTOM_RIGHT: 356,
  BED_TOP_LEFT: 324,
  BED_TOP_MID: 325,
  BED_TOP_RIGHT: 326,
  BOOKSHELF_LEFT: 48,
  BOOKSHELF_MID: 49,
  BOOKSHELF_RIGHT: 50,
  CABINET: 265,
  CHAIR_LEFT: 468,
  CHAIR_RIGHT: 470,
  DOOR_BOTTOM: 294,
  DOOR_TOP: 264,
  FLOOR: 138,
  FLOWER_POT: 288,
  KITCHEN_LEFT: 408,
  KITCHEN_MID: 409,
  KITCHEN_RIGHT: 410,
  RUG_BOTTOM_LEFT: 465,
  RUG_BOTTOM_MID: 466,
  RUG_BOTTOM_RIGHT: 467,
  RUG_TOP_LEFT: 375,
  RUG_TOP_MID: 376,
  RUG_TOP_RIGHT: 377,
  TABLE_BOTTOM_LEFT: 438,
  TABLE_BOTTOM_MID: 439,
  TABLE_BOTTOM_RIGHT: 440,
  TABLE_TOP_LEFT: 408,
  TABLE_TOP_MID: 409,
  TABLE_TOP_RIGHT: 410,
  WALL_BODY_LEFT: 132,
  WALL_BODY_MID: 133,
  WALL_BODY_RIGHT: 134,
  WALL_TOP_LEFT: 102,
  WALL_TOP_MID: 103,
  WALL_TOP_RIGHT: 104,
} as const;

const INTERIOR_TILE = INTERIOR_HOUSE_TILE;

export function stampInteriorHouse10x10(map: GameMap, origin: TilePoint): void {
  fillRect(map, { height: 10, layer: "lower", tile: INTERIOR_TILE.FLOOR, width: 10, ...origin });
  stampPattern(map, {
    layer: "lower",
    origin,
    rows: [
      [
        INTERIOR_TILE.WALL_TOP_LEFT,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_MID,
        INTERIOR_TILE.WALL_TOP_RIGHT,
      ],
      [
        INTERIOR_TILE.WALL_BODY_LEFT,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_MID,
        INTERIOR_TILE.WALL_BODY_RIGHT,
      ],
    ],
  });
  frameInteriorRoom(map, origin);
  placeInteriorFurniture(map, origin);
}

function frameInteriorRoom(map: GameMap, origin: TilePoint): void {
  for (let y = 2; y < 10; y += 1) {
    setTile(map, { layer: "lower", tile: INTERIOR_TILE.WALL_BODY_LEFT, x: origin.x, y: origin.y + y });
    setTile(map, { layer: "lower", tile: INTERIOR_TILE.WALL_BODY_RIGHT, x: origin.x + 9, y: origin.y + y });
  }
  for (let x = 1; x < 9; x += 1) {
    setTile(map, { layer: "lower", tile: INTERIOR_TILE.WALL_BODY_MID, x: origin.x + x, y: origin.y + 9 });
  }
  setTile(map, { layer: "lower", tile: INTERIOR_TILE.DOOR_TOP, x: origin.x + 4, y: origin.y + 8 });
  setTile(map, { layer: "lower", tile: INTERIOR_TILE.DOOR_BOTTOM, x: origin.x + 4, y: origin.y + 9 });
}

function placeInteriorFurniture(map: GameMap, origin: TilePoint): void {
  stampPattern(map, {
    layer: "upper",
    origin: { x: origin.x + 1, y: origin.y + 2 },
    rows: [[INTERIOR_TILE.BOOKSHELF_LEFT, INTERIOR_TILE.BOOKSHELF_MID, INTERIOR_TILE.BOOKSHELF_RIGHT]],
  });
  stampPattern(map, {
    layer: "upper",
    origin: { x: origin.x + 6, y: origin.y + 2 },
    rows: [
      [INTERIOR_TILE.BED_TOP_LEFT, INTERIOR_TILE.BED_TOP_MID, INTERIOR_TILE.BED_TOP_RIGHT],
      [INTERIOR_TILE.BED_BOTTOM_LEFT, INTERIOR_TILE.BED_BOTTOM_MID, INTERIOR_TILE.BED_BOTTOM_RIGHT],
    ],
  });
  stampPattern(map, {
    layer: "lower",
    origin: { x: origin.x + 3, y: origin.y + 4 },
    rows: [
      [INTERIOR_TILE.RUG_TOP_LEFT, INTERIOR_TILE.RUG_TOP_MID, INTERIOR_TILE.RUG_TOP_RIGHT],
      [INTERIOR_TILE.RUG_BOTTOM_LEFT, INTERIOR_TILE.RUG_BOTTOM_MID, INTERIOR_TILE.RUG_BOTTOM_RIGHT],
    ],
  });
  stampPattern(map, {
    layer: "upper",
    origin: { x: origin.x + 3, y: origin.y + 5 },
    rows: [
      [INTERIOR_TILE.TABLE_TOP_LEFT, INTERIOR_TILE.TABLE_TOP_MID, INTERIOR_TILE.TABLE_TOP_RIGHT],
      [INTERIOR_TILE.TABLE_BOTTOM_LEFT, INTERIOR_TILE.TABLE_BOTTOM_MID, INTERIOR_TILE.TABLE_BOTTOM_RIGHT],
    ],
  });
  placeTiles(map, [
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_LEFT, x: origin.x + 1, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_MID, x: origin.x + 2, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_RIGHT, x: origin.x + 3, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.CHAIR_LEFT, x: origin.x + 2, y: origin.y + 5 },
    { layer: "upper", tile: INTERIOR_TILE.CHAIR_RIGHT, x: origin.x + 6, y: origin.y + 5 },
    { layer: "upper", tile: INTERIOR_TILE.CABINET, x: origin.x + 8, y: origin.y + 6 },
    { layer: "upper", tile: INTERIOR_TILE.FLOWER_POT, x: origin.x + 8, y: origin.y + 3 },
  ]);
}

function fillRect(map: GameMap, rect: StampRect): void {
  for (let dy = 0; dy < rect.height; dy += 1) {
    for (let dx = 0; dx < rect.width; dx += 1) {
      setTile(map, { layer: rect.layer, tile: rect.tile, x: rect.x + dx, y: rect.y + dy });
    }
  }
}

function stampPattern(map: GameMap, pattern: StampPattern): void {
  pattern.rows.forEach((row, dy) => {
    row.forEach((tile, dx) => {
      setTile(map, { layer: pattern.layer, tile, x: pattern.origin.x + dx, y: pattern.origin.y + dy });
    });
  });
}

function placeTiles(map: GameMap, placements: readonly StampTilePlacement[]): void {
  for (const placement of placements) setTile(map, placement);
}

function setTile(map: GameMap, placement: StampTilePlacement): void {
  if (placement.x < 0 || placement.y < 0 || placement.x >= map.width || placement.y >= map.height) return;
  const index = placement.y * map.width + placement.x;
  if (placement.layer === "lower") map.lowerTiles[index] = placement.tile;
  else map.upperTiles[index] = placement.tile;
}
