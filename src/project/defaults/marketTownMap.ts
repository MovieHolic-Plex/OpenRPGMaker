import { genId } from "@/util/id";
import type { GameMap } from "../types";
import {
  stampDbHouseVariant,
  type DbHouseShapeVariant,
} from "./dbExtractedHouseVariants";
import type { SmallHouseMaterial } from "@/project/defaults/contentBuilderTypes";
import {
  clearUpperTilesOnTownPath,
  paintTownPathNetwork,
  shapeAllTownPaths,
} from "./townPathAutotile";
import { DEFAULT_TILE_SIZE, TILE } from "./constants";
import { WOOD_FLOOR_PASSABILITY, SAND_TILE } from "./chipsetMapping";
import { addMarketTownEvents } from "./marketTownEvents";

const TOWN_PATH_TILE_SET = new Set<number>(Object.values(SAND_TILE));

// EasyRPG Combined Town 타일 그림판(16x16)의 기존 컴포넌트를 이어붙여 만든
// 60x60 시장 중심 도시 마을. 컴포넌트 재사용:
//  - stampDbHouseVariant : 집(wide/compact/l × wood/plaster/stone) + 문 앞 도로 접근
//  - paintTownPathNetwork/shapeAllTownPaths : 모래길 자동타일(중심/외곽/모서리)
//  - 시장: 나무 데크 222+edges+223 + 카운터 234–236 (천막 금지)
//  - 장식 타일: 나무(260/290), 꽃(288), 벤치(327/328), 집앞(349~352), 횃불(381)

const MARKET_TOWN_SIZE = 60;
const COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const TOWN_GRASS = 270;
const TREE = 260;
const TREE_BOTTOM = 290;
const FLOWER = 288;
const BENCH_LEFT = 327;
const BENCH_RIGHT = 328;
const QUEST_BOARD_SIGN = 320;
const STATUE_A = 382;
const TORCH = 381;
const WOOD_FLOOR = WOOD_FLOOR_PASSABILITY.body;
const WOOD_EDGE_W = WOOD_FLOOR_PASSABILITY.edgeWest;
const WOOD_EDGE_E = WOOD_FLOOR_PASSABILITY.edgeEast;
const WOOD_EDGE_N = WOOD_FLOOR_PASSABILITY.edgeNorth;
const WOOD_EDGE_S = WOOD_FLOOR_PASSABILITY.edgeSouth;
const TIMBER_RAIL = 223;
const TIMBER_POST = 193;
const RAIL_L = 468;
const RAIL_M = 469;
const RAIL_R = 470;
const TABLE_L = 234;
const TABLE_M = 235;
const TABLE_R = 236;
const WOOD_BOX = 237;

// 격자 도로망: 가로 3줄(y=15/30/45) + 세로 3줄(x=15/30/45), 폭 3.
// → 9개 블록 구획. 중앙 블록(x18-29/y18-29)은 시장 광장.
const MARKET_TOWN_ROADS = [
  // 가로 도로
  { x: 0, y: 15, width: MARKET_TOWN_SIZE, height: 3 },
  { x: 0, y: 30, width: MARKET_TOWN_SIZE, height: 3 },
  { x: 0, y: 45, width: MARKET_TOWN_SIZE, height: 3 },
  // 세로 도로
  { x: 15, y: 0, width: 3, height: MARKET_TOWN_SIZE },
  { x: 30, y: 0, width: 3, height: MARKET_TOWN_SIZE },
  { x: 45, y: 0, width: 3, height: MARKET_TOWN_SIZE },
  // 중앙 시장 광장은 주 도로(y15/30, x15/30)로 이미 둘러싸여 접근 가능하므로
  // 광장 내부는 나무 데크 + 카운터/석상/벤치를 배치한다.
] as const;

type TownHouse = {
  readonly material: SmallHouseMaterial;
  readonly x: number;
  readonly y: number;
  readonly approachHeight: number;
  readonly variant: DbHouseShapeVariant;
};

// 각 블록에 1~2채씩. 도로(x15/30/45, y15/30/45, 폭3)와 집 펜스 영역이
// 겹치지 않도록 블록 내부 좌표에 배치.
const MARKET_TOWN_HOUSES = [
  // 좌상 블록 (x0-14, y0-14)
  { material: "wood", x: 0, y: 0, approachHeight: 3, variant: "l" },
  // 중상 블록 (x18-29, y0-14)
  { material: "plaster", x: 18, y: 1, approachHeight: 3, variant: "compact" },
  // 우상 블록 (x33-59, y0-14)
  { material: "stone", x: 36, y: 1, approachHeight: 3, variant: "wide" },
  { material: "wood", x: 33, y: 1, approachHeight: 4, variant: "compact" },
  // 좌중 블록 (x0-14, y18-29) — 시장 옆
  { material: "plaster", x: 0, y: 19, approachHeight: 3, variant: "wide" },
  // 우중 블록 (x33-59, y18-29)
  { material: "wood", x: 36, y: 19, approachHeight: 3, variant: "compact" },
  { material: "stone", x: 42, y: 19, approachHeight: 3, variant: "compact" },
  // 좌하 블록 (x0-14, y33-59)
  { material: "wood", x: 0, y: 34, approachHeight: 4, variant: "l" },
  // 중하 블록 (x18-29, y33-59)
  { material: "plaster", x: 18, y: 34, approachHeight: 4, variant: "compact" },
  // 우하 블록 (x33-59, y33-59)
  { material: "stone", x: 33, y: 34, approachHeight: 4, variant: "wide" },
] as const satisfies readonly TownHouse[];

export function createMarketTownMap(): GameMap {
  const map = createBlankMarketTownMap();
  paintRoads(map);
  stampHouses(map);
  decorateMarketSquare(map);
  decorateNeighborhoods(map);
  addMarketTownEvents(map);
  return map;
}

export function marketTownStartPos(): { readonly x: number; readonly y: number } {
  // 중앙 시장 광장 입구
  return { x: 24, y: 31 };
}

function createBlankMarketTownMap(): GameMap {
  const tileCount = MARKET_TOWN_SIZE * MARKET_TOWN_SIZE;
  return {
    id: genId("map"),
    name: "시장 마을",
    width: MARKET_TOWN_SIZE,
    height: MARKET_TOWN_SIZE,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(tileCount).fill(TOWN_GRASS),
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    events: [],
  };
}

function paintRoads(map: GameMap): void {
  paintTownPathNetwork(map, MARKET_TOWN_ROADS);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
}

function stampHouses(map: GameMap): void {
  for (const house of MARKET_TOWN_HOUSES) {
    stampDbHouseVariant(map, {
      material: house.material,
      origin: { x: house.x, y: house.y },
      variant: house.variant,
      approachHeight: house.approachHeight,
    });
  }
  // 집 스탬프 이후 도로 외곽 재성형(집 틈새 도로 모서리 정리)
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
}

// 중앙 시장/상점가: 광장 블록에 나무 데크(222+edges+223) + 카운터 + 벤치 + 석상.
function decorateMarketSquare(map: GameMap): void {
  const deck = { x: 19, y: 19, w: 10, h: 10 };
  stampWoodMarketDeck(map, deck);
  // 카운터 4곳 + 상자 (NPC 22,19 / 26,24 와 겹치지 않음)
  stampCounterOnly(map, 19, 20);
  stampCounterOnly(map, 25, 20);
  stampCounterOnly(map, 19, 26);
  stampCounterOnly(map, 25, 26);
  stampUpper(map, { x: 19, y: 21 }, WOOD_BOX);
  stampUpper(map, { x: 28, y: 21 }, WOOD_BOX);
  stampUpper(map, { x: 19, y: 27 }, WOOD_BOX);
  stampUpper(map, { x: 28, y: 27 }, WOOD_BOX);
  // 광장 중앙 석상 + 횃불
  stampUpper(map, { x: 23, y: 23 }, STATUE_A);
  stampUpper(map, { x: 22, y: 23 }, TORCH);
  stampUpper(map, { x: 24, y: 23 }, TORCH);
  // 벤치 (광장 외곽 휴식 공간)
  stampUpperPattern(map, { x: 19, y: 28 }, [[BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1]]);
  stampUpperPattern(map, { x: 25, y: 28 }, [[BENCH_LEFT, BENCH_RIGHT], [-1, FLOWER]]);
  stampUpper(map, { x: 24, y: 29 }, QUEST_BOARD_SIGN);
  // 꽃 장식
  stampUpperPattern(map, { x: 20, y: 23 }, [[FLOWER]]);
  stampUpperPattern(map, { x: 26, y: 23 }, [[FLOWER]]);
}

function stampCounterOnly(map: GameMap, x: number, y: number): void {
  stampUpperPattern(map, { x, y }, [[TABLE_L, TABLE_M, TABLE_M, TABLE_R]]);
}

/** 상점가와 동일 규칙: 222 body + 4dir edges + 남단 223 난간 + 입구 3칸 */
function stampWoodMarketDeck(
  map: GameMap,
  deck: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): void {
  const { x, y, w, h } = deck;
  const gateX0 = x + Math.floor(w / 2) - 1;
  const gateXs = new Set([gateX0, gateX0 + 1, gateX0 + 2]);
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      setLower(map, x + dx, y + dy, WOOD_FLOOR);
      setUpper(map, x + dx, y + dy, TILE.EMPTY);
    }
  }
  for (let dx = 1; dx < w - 1; dx += 1) {
    setLower(map, x + dx, y, WOOD_EDGE_N);
    if (!gateXs.has(x + dx)) setLower(map, x + dx, y + h - 1, WOOD_EDGE_S);
  }
  for (let dy = 1; dy < h - 1; dy += 1) {
    setLower(map, x, y + dy, WOOD_EDGE_W);
    setLower(map, x + w - 1, y + dy, WOOD_EDGE_E);
  }
  for (let dx = 0; dx < w; dx += 1) {
    const wx = x + dx;
    const wy = y + h - 1;
    if (gateXs.has(wx)) {
      setLower(map, wx, wy, WOOD_FLOOR);
      setUpper(map, wx, wy, TILE.EMPTY);
      continue;
    }
    setLower(map, wx, wy, TIMBER_RAIL);
    setUpper(map, wx, wy, dx === 0 ? RAIL_L : dx === w - 1 ? RAIL_R : RAIL_M);
  }
  setLower(map, x, y, TIMBER_POST);
  setLower(map, x + w - 1, y, TIMBER_POST);
  setLower(map, x, y + h - 1, TIMBER_POST);
  setLower(map, x + w - 1, y + h - 1, TIMBER_POST);
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

// 주택가 블록: 나무 클러스터(블록 구석) + 꽃밭 + 벤치로 초록 분위기.
function decorateNeighborhoods(map: GameMap): void {
  // 외곽 울타리용 나무 — 맵 테두리를 나무로 둘러싸 자연 경계 형성
  for (let x = 0; x < MARKET_TOWN_SIZE; x += 1) {
    stampConifer(map, { x, y: 0 }, { overwrite: true });
    stampConifer(map, { x, y: MARKET_TOWN_SIZE - 2 }, { overwrite: true });
  }
  for (let y = 2; y < MARKET_TOWN_SIZE - 2; y += 2) {
    stampConifer(map, { x: 0, y }, { overwrite: true });
    stampConifer(map, { x: MARKET_TOWN_SIZE - 1, y }, { overwrite: true });
  }
  // 블록 구석 나무 클러스터 (도로 외곽, 집과 겹치지 않는 위치)
  const treeOrigins = [
    { x: 13, y: 12 }, { x: 13, y: 13 },
    { x: 29, y: 12 }, { x: 29, y: 13 },
    { x: 43, y: 12 }, { x: 44, y: 13 },
    { x: 13, y: 27 }, { x: 13, y: 28 },
    { x: 43, y: 27 }, { x: 44, y: 28 },
    { x: 13, y: 43 }, { x: 13, y: 44 },
    { x: 29, y: 43 }, { x: 29, y: 44 },
    { x: 43, y: 43 }, { x: 44, y: 44 },
  ];
  for (const origin of treeOrigins) stampConifer(map, origin);
  // 꽃밭 장식 (주택가 곳곳)
  stampUpperPattern(map, { x: 11, y: 11 }, [[FLOWER, -1, FLOWER], [-1, FLOWER, -1]]);
  stampUpperPattern(map, { x: 38, y: 11 }, [[FLOWER, FLOWER], [FLOWER, FLOWER]]);
  stampUpperPattern(map, { x: 4, y: 28 }, [[FLOWER], [FLOWER]]);
  stampUpperPattern(map, { x: 38, y: 28 }, [[FLOWER, -1], [-1, FLOWER]]);
  stampUpperPattern(map, { x: 11, y: 44 }, [[FLOWER, FLOWER]]);
  stampUpperPattern(map, { x: 26, y: 44 }, [[FLOWER, -1, FLOWER]]);
  // 벤치 (주택가 휴식처)
  stampUpperPattern(map, { x: 4, y: 12 }, [[BENCH_LEFT, BENCH_RIGHT]]);
  stampUpperPattern(map, { x: 38, y: 44 }, [[BENCH_LEFT, BENCH_RIGHT]]);
}

function stampUpperPattern(
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  pattern: readonly (readonly number[])[]
): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) stampUpper(map, { x: origin.x + x, y: origin.y + y }, tile);
    }
  }
}

function stampUpper(map: GameMap, point: { readonly x: number; readonly y: number }, tile: number): void {
  if (!isInside(map, point)) return;
  // 도로(모래길) 위에는 오브젝트를 덮어씌우지 않아 통행과 도로 시인성을 유지한다.
  if (isTownPath(map, point)) return;
  map.upperTiles[point.y * map.width + point.x] = tile;
}

function stampConifer(map: GameMap, point: { readonly x: number; readonly y: number }, options: { readonly overwrite?: boolean } = {}): void {
  const bottom = { x: point.x, y: point.y + 1 };
  if (!isInside(map, point) || !isInside(map, bottom)) return;
  if (isTownPath(map, point) || isTownPath(map, bottom)) return;
  const topIndex = point.y * map.width + point.x;
  const bottomIndex = bottom.y * map.width + bottom.x;
  if (!options.overwrite && (map.upperTiles[topIndex] !== TILE.EMPTY || map.upperTiles[bottomIndex] !== TILE.EMPTY)) return;
  map.upperTiles[topIndex] = TREE;
  map.upperTiles[bottomIndex] = TREE_BOTTOM;
}

function isTownPath(map: GameMap, point: { readonly x: number; readonly y: number }): boolean {
  const tile = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
  return TOWN_PATH_TILE_SET.has(tile);
}

function isInside(map: GameMap, point: { readonly x: number; readonly y: number }): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
