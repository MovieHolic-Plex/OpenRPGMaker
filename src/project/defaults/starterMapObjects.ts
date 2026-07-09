import type { GameEvent, GameMap } from "../types";
import { CHIPSET_TILE_GROUPS, dirtLikeTiles } from "./chipsetMapping";
import { TILE } from "./constants";

type Point = { readonly x: number; readonly y: number };
type Rect = Point & { readonly width: number; readonly height: number };

const DIRT_TILES = dirtLikeTiles();
const SAND_TILES = CHIPSET_TILE_GROUPS.sandGround;
const WATER_TILES = CHIPSET_TILE_GROUPS.water;
const STONE_TILES = CHIPSET_TILE_GROUPS.stoneFloorBody;
const WALL_TILES = CHIPSET_TILE_GROUPS.stoneWallBody;
const FLOWER_TILES = CHIPSET_TILE_GROUPS.flowerObjects;
const FENCE_TILES = CHIPSET_TILE_GROUPS.fenceObjects;
const STAKE_TILES = CHIPSET_TILE_GROUPS.stakeObjects;
const BENCH_TILES = CHIPSET_TILE_GROUPS.benchObjects;
const VINE_TILES = CHIPSET_TILE_GROUPS.vineObjects;
const SMALL_PROP_TILES = CHIPSET_TILE_GROUPS.smallObjects;
const CONIFER_PATTERN = [
  [260],
  [290],
] as const;
const BIG_TREE_PATTERN = [
  [262, 263],
  [292, 293],
] as const;
const VILLAGE_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404, 405, 404, 405, 404],
  [15, 16, 16, 16, 16, 16, 16, 16, 17],
  [45, 46, 46, 46, 329, 46, 46, 46, 47],
  [75, 76, 76, 76, 359, 76, 76, 76, 77],
] as const;
const WOOD_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;
const VISIBLE_LOG_CABIN_PATTERN = [
  [374, 375, 374, 375, 374, 375, 374, 375],
  [404, 405, 404, 405, 404, 405, 404, 405],
  [102, 103, 103, 103, 103, 103, 103, 104],
  [132, 133, 133, 329, 133, 133, 133, 134],
  [162, 163, 163, 359, 163, 163, 163, 164],
] as const;
const PROTRUDING_WOOD_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404, 405, 404],
  [102, 103, 374, 375, 374, 103, 104],
  [132, 133, 404, 405, 404, 133, 134],
  [162, 163, 102, 103, 104, 163, 164],
  [-1, -1, 132, 329, 134, -1, -1],
  [-1, -1, 162, 359, 164, -1, -1],
] as const;
const BLUE_COMPLEX_HOUSE_PATTERN = [
  [406, 407, 406, 407, 406, 407, 406, 407, 406, 407, 406],
  [436, 437, 436, 437, 436, 437, 436, 437, 436, 437, 436],
  [-1, -1, -1, -1, 406, 407, 406, -1, -1, -1, -1],
  [-1, -1, -1, -1, 436, 437, 436, -1, -1, -1, -1],
  [102, 103, 103, 103, 102, 103, 104, 103, 103, 103, 104],
  [132, 133, 133, 133, 132, 329, 134, 133, 133, 133, 134],
  [162, 163, 163, 163, 162, 359, 164, 163, 163, 163, 164],
  [-1, -1, -1, -1, 132, 329, 134, -1, -1, -1, -1],
  [-1, -1, -1, -1, 162, 359, 164, -1, -1, -1, -1],
] as const;
const SECOND_VILLAGE_HOUSE_ORIGIN = { x: 49, y: 38 } as const;
const SECOND_VILLAGE_HOUSE_DOOR = { x: 53, y: 42 } as const;
const VISIBLE_LOG_CABIN_ORIGIN = { x: 5, y: 5 } as const;
const WOOD_HOUSE_ORIGIN = { x: 31, y: 40 } as const;
const PROTRUDING_WOOD_HOUSE_ORIGIN = { x: 23, y: 40 } as const;
const BLUE_COMPLEX_HOUSE_ORIGIN = { x: 8, y: 35 } as const;
const OBJECT1_CHARSET_TEXTURE = "tex_easyrpg_charset_object1";
const WOOD_DOOR_B_CLOSED_FRAME = 27;

export function paintStarterMapObjects(map: GameMap): void {
  paintVillageObjects(map);
  paintForestObjects(map);
}

function paintVillageObjects(map: GameMap): void {
  paintVisibleLogCabinGround(map);
  stampLower(map, VISIBLE_LOG_CABIN_ORIGIN, VISIBLE_LOG_CABIN_PATTERN);
  stampLower(map, { x: 39, y: 31 }, VILLAGE_HOUSE_PATTERN);
  stampLower(map, SECOND_VILLAGE_HOUSE_ORIGIN, VILLAGE_HOUSE_PATTERN);
  stampLower(map, WOOD_HOUSE_ORIGIN, WOOD_HOUSE_PATTERN);
  stampLower(map, PROTRUDING_WOOD_HOUSE_ORIGIN, PROTRUDING_WOOD_HOUSE_PATTERN);
  stampLower(map, BLUE_COMPLEX_HOUSE_ORIGIN, BLUE_COMPLEX_HOUSE_PATTERN);
  addSecondVillageHouseDoor(map);
  stampUpper(map, { x: 57, y: 47 }, [
    [418, 419],
    [448, 449],
    [477, 478],
  ]);
  fillUpperRect(map, { x: 42, y: 24, width: 6, height: 1 }, FENCE_TILES);
  fillUpperRect(map, { x: 47, y: 54, width: 8, height: 1 }, FENCE_TILES);
  fillUpperRect(map, { x: 39, y: 20, width: 7, height: 1 }, FENCE_TILES);
  fillUpperRect(map, { x: 53, y: 29, width: 1, height: 4 }, STAKE_TILES);
  fillUpperRect(map, { x: 54, y: 29, width: 4, height: 1 }, STAKE_TILES);
  fillUpperRect(map, { x: 42, y: 27, width: 2, height: 1 }, BENCH_TILES);
  setUpper(map, { x: 38, y: 38 }, 320);
  setUpper(map, { x: 56, y: 35 }, 323);
  setUpper(map, { x: 48, y: 40 }, 348);
  setUpper(map, { x: 55, y: 44 }, 318);
  setUpper(map, { x: 44, y: 28 }, pick(VINE_TILES, { x: 44, y: 28 }));
  setUpper(map, { x: 45, y: 28 }, pick(VINE_TILES, { x: 45, y: 28 }));
  setUpper(map, { x: 39, y: 25 }, pick(SMALL_PROP_TILES, { x: 39, y: 25 }));
  setUpper(map, { x: 52, y: 28 }, pick(SMALL_PROP_TILES, { x: 52, y: 28 }));
}

function paintVisibleLogCabinGround(map: GameMap): void {
  fillLowerRect(map, { x: 4, y: 9, width: 10, height: 4 }, DIRT_TILES);
  fillLowerRect(map, { x: 8, y: 12, width: 2, height: 6 }, DIRT_TILES);
}

function addSecondVillageHouseDoor(map: GameMap): void {
  const eventId = "event_second_village_house_wood_door_b";
  if (map.events.some((event) => event.id === eventId)) return;
  const event: GameEvent = {
    id: eventId,
    x: SECOND_VILLAGE_HOUSE_DOOR.x,
    y: SECOND_VILLAGE_HOUSE_DOOR.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_closed",
        name: "Closed wood door B",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: OBJECT1_CHARSET_TEXTURE },
          direction: "down",
          pattern: WOOD_DOOR_B_CLOSED_FRAME,
        },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
  map.events.push(event);
}

function paintForestObjects(map: GameMap): void {
  // 1칸 나무 조각(289/259 등)을 뿌리지 않는다.
  // 침엽수(2단)·큰 나무(2×2) 스탬프만 쓰고, 시드 간격으로 과밀을 막는다.
  for (let y = 4; y < map.height - 5; y++) {
    for (let x = 4; x < map.width - 5; x++) {
      const point = { x, y };
      if (!acceptsUpperObject(map, point)) continue;
      const value = seed(point);
      if (value % 97 === 0 && canStampUpper(map, point, BIG_TREE_PATTERN)) {
        stampUpper(map, point, BIG_TREE_PATTERN);
        continue;
      }
      if (value % 71 === 0 && canStampUpper(map, point, CONIFER_PATTERN)) {
        stampUpper(map, point, CONIFER_PATTERN);
        continue;
      }
      // 꽃만 희소하게 — 나무 조각으로 오인되는 단일 타일 장식은 넣지 않는다.
      if (value % 131 === 0) {
        setUpper(map, point, pick(FLOWER_TILES, point));
      }
    }
  }
}

function fillUpperRect(map: GameMap, rect: Rect, tiles: readonly number[]): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const point = { x, y };
      setUpper(map, point, pick(tiles, point));
    }
  }
}

function fillLowerRect(map: GameMap, rect: Rect, tiles: readonly number[]): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const point = { x, y };
      setLower(map, point, pick(tiles, point));
    }
  }
}

function stampUpper(map: GameMap, origin: Point, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      const point = { x: origin.x + x, y: origin.y + y };
      if (tile !== undefined && tile >= 0) setUpper(map, point, tile);
    }
  }
}

function stampLower(map: GameMap, origin: Point, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      const point = { x: origin.x + x, y: origin.y + y };
      if (tile !== undefined && tile >= 0) setLower(map, point, tile);
    }
  }
}

function canStampUpper(map: GameMap, origin: Point, pattern: readonly (readonly number[])[]): boolean {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      const point = { x: origin.x + x, y: origin.y + y };
      if (tile !== undefined && tile >= 0 && !acceptsUpperObject(map, point)) return false;
    }
  }
  return true;
}

function setUpper(map: GameMap, point: Point, tile: number): void {
  if (!inBounds(map, point)) return;
  map.upperTiles[point.y * map.width + point.x] = tile;
}

function setLower(map: GameMap, point: Point, tile: number): void {
  if (!inBounds(map, point)) return;
  map.lowerTiles[point.y * map.width + point.x] = tile;
}

function inBounds(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function acceptsUpperObject(map: GameMap, point: Point): boolean {
  if (!inBounds(map, point)) return false;
  const index = point.y * map.width + point.x;
  const lower = map.lowerTiles[index];
  if (map.upperTiles[index] !== TILE.EMPTY || lower === undefined) return false;
  return !hasTile(DIRT_TILES, lower) &&
    !hasTile(SAND_TILES, lower) &&
    !hasTile(WATER_TILES, lower) &&
    !hasTile(STONE_TILES, lower) &&
    !hasTile(WALL_TILES, lower);
}

function hasTile(tiles: readonly number[], tile: number): boolean {
  return tiles.includes(tile);
}

function pick(tiles: readonly number[], point: Point): number {
  return tiles[seed(point) % tiles.length] ?? TILE.EMPTY;
}

function seed(point: Point): number {
  let value = Math.imul(point.x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(point.y ^ 0xc2b2ae35, 0x27d4eb2f);
  value ^= value >>> 15;
  return value >>> 0;
}
