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

// 타일 ID는 src/project/defaults/tileSemanticsInterior.ts(정본) 라벨과 전수 대조했다.
// 문 문법(서 플랭크 398 | 개구부 바닥 72 | 동 플랭크 396)은 interiorRoomPipeline의
// 하우스 셸(HOUSE_WALL_FACE) 규약을 따른다.
export const INTERIOR_HOUSE_TILE = {
  BED_LEFT: 355, // 가로 침대 좌(355|356 hard 좌우쌍)
  BED_RIGHT: 356, // 가로 침대 우
  BOOKSHELF_LEFT: 48, // 책장 중단(좌·책 2단)
  BOOKSHELF_MID: 49, // 책장 중단(중·가로 반복)
  BOOKSHELF_RIGHT: 50, // 책장 중단(우)
  CABINET_BOTTOM: 178, // 선반장 하단
  CABINET_TOP: 148, // 선반장 상단
  CHAIR_EAST: 298, // 의자(좌향) — 탁자 동쪽 자리
  CHAIR_WEST: 297, // 의자(우향) — 탁자 서쪽 자리
  DOOR_EAST: 396, // 남벽 문 동쪽 플랭크(하우스 셸 트림)
  DOOR_WEST: 398, // 남벽 문 서쪽 플랭크(하우스 셸 트림)
  FLOOR: 72, // 나무 바닥(파이프라인 표준 바닥 VR.FLOOR)
  FLOWER_POT: 288, // 화분
  KITCHEN_LEFT: 408, // 카운터 경로 윗줄 좌 코너
  KITCHEN_MID: 409, // 카운터 경로 윗줄 가로 직선(반복)
  KITCHEN_RIGHT: 410, // 카운터 경로 윗줄 우 코너
  RUG_BOTTOM_LEFT: 435, // 붉은 카펫(3×3 세트) 하단행 좌
  RUG_BOTTOM_MID: 436, // 붉은 카펫 하단행 중
  RUG_BOTTOM_RIGHT: 437, // 붉은 카펫 하단행 우
  RUG_TOP_LEFT: 375, // 붉은 카펫 상단행 좌
  RUG_TOP_MID: 376, // 붉은 카펫 상단행 중
  RUG_TOP_RIGHT: 377, // 붉은 카펫 상단행 우
  TABLE_LEFT: 325, // 긴 탁자 좌
  TABLE_MID: 326, // 긴 탁자 몸통(가로 반복)
  TABLE_RIGHT: 327, // 긴 탁자 우
  WALL_BODY_LEFT: 104, // 크림 회벽 하단 좌
  WALL_BODY_MID: 105, // 크림 회벽 하단 중
  WALL_BODY_RIGHT: 106, // 크림 회벽 하단 우
  WALL_TOP_LEFT: 74, // 크림 회벽 상단 좌
  WALL_TOP_MID: 75, // 크림 회벽 상단 중
  WALL_TOP_RIGHT: 76, // 크림 회벽 상단 우
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
  // 남벽 문 — 하우스 셸 문법: 서 플랭크 398 | 개구부 바닥 72 | 동 플랭크 396.
  const doorX = origin.x + 4;
  setTile(map, { layer: "lower", tile: INTERIOR_TILE.DOOR_WEST, x: doorX - 1, y: origin.y + 9 });
  setTile(map, { layer: "lower", tile: INTERIOR_TILE.FLOOR, x: doorX, y: origin.y + 9 });
  setTile(map, { layer: "lower", tile: INTERIOR_TILE.DOOR_EAST, x: doorX + 1, y: origin.y + 9 });
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
    rows: [[INTERIOR_TILE.BED_LEFT, INTERIOR_TILE.BED_RIGHT]],
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
    rows: [[INTERIOR_TILE.TABLE_LEFT, INTERIOR_TILE.TABLE_MID, INTERIOR_TILE.TABLE_RIGHT]],
  });
  placeTiles(map, [
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_LEFT, x: origin.x + 1, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_MID, x: origin.x + 2, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.KITCHEN_RIGHT, x: origin.x + 3, y: origin.y + 7 },
    { layer: "upper", tile: INTERIOR_TILE.CHAIR_WEST, x: origin.x + 2, y: origin.y + 5 },
    { layer: "upper", tile: INTERIOR_TILE.CHAIR_EAST, x: origin.x + 6, y: origin.y + 5 },
    { layer: "upper", tile: INTERIOR_TILE.CABINET_TOP, x: origin.x + 8, y: origin.y + 5 },
    { layer: "upper", tile: INTERIOR_TILE.CABINET_BOTTOM, x: origin.x + 8, y: origin.y + 6 },
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
