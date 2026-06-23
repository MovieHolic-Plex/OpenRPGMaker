import { genId } from "@/util/id";
import { appendTileToStack } from "@/project/mapOverlayTiles";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "./roadAutotile";
import { shapeSandEdges } from "./sandAutotile";

type TilePattern = readonly (readonly number[])[];
type TileLayerName = "lower" | "upper";
type TilePoint = {
  readonly x: number;
  readonly y: number;
};
type StampInput = {
  readonly layer: TileLayerName;
  readonly map: GameMap;
  readonly origin: TilePoint;
  readonly pattern: TilePattern;
};
type TilePlacement = {
  readonly layer: TileLayerName;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
};
type LowerRectInput = {
  readonly height: number;
  readonly origin: TilePoint;
  readonly tile: number;
  readonly width: number;
};
type PlasterHouseInput = {
  readonly bodyRows: number;
  readonly origin: TilePoint;
  readonly width: number;
};
type HouseInput = {
  readonly material: SmallHouseMaterial;
  readonly bodyRows: number;
  readonly origin: TilePoint;
  readonly width: number;
};
export type SmallHouseVariantIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SmallHouseMaterial = "plaster" | "wood" | "stone";

type HouseWallTileSet = {
  readonly top: readonly [number, number, number];
  readonly body: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
  readonly window: number;
};

const HOUSE_WALL_TILES: Record<SmallHouseMaterial, HouseWallTileSet> = {
  plaster: { top: [15, 16, 17], body: [45, 46, 47], bottom: [75, 76, 77], window: 87 },
  wood: { top: [102, 103, 104], body: [132, 133, 134], bottom: [162, 163, 164], window: 85 },
  stone: { top: [12, 13, 14], body: [42, 43, 44], bottom: [72, 73, 74], window: 85 },
};

export const DB_EXTRACTED_HOUSE_TEMPLATE_SIZE = {
  height: 15,
  width: 16,
} as const;
const SMALL_HOUSE_VARIANT_MAP_SIZE = {
  height: 18,
  width: 21,
} as const;
const SMALL_HOUSE_VARIANT_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly SmallHouseVariantIndex[];
const ROOF_CAP_LEFT = 374;
const ROOF_BODY = 375;
const ROOF_CAP_RIGHT = 377;
const ROOF_FACE_LEFT = 404;
const ROOF_FACE_MID = 405;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const TREE_TOP_LEFT = 262;
const TREE_TOP_RIGHT = 263;
const TREE_BOTTOM_LEFT = 292;
const TREE_BOTTOM_RIGHT = 293;
// 패턴이 upper 레이어에 찍은 울타리(378~439 계열)/창문(85,87) 오버레이는
// RM2K3 정석에 따라 upper에 유지한다 (chipsetMapping.isUpperChipsetTile과 일관).
// 강등 대상이 없으므로 normalize는 사실상 no-op이 된다.
const LOWER_TRANSPARENT_HOUSE_TILES = new Set<number>();

const DB_EXTRACTED_HOUSE_LOWER_PATTERN = [
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 404, 404, 404, 404, 404, 404, 404, 404, 240, 240, 240],
  [240, 240, 240, 240, 240, 404, 404, 404, 404, 404, 404, 404, 404, 377, 240, 240],
  [240, 240, 240, 240, 240, 404, 404, 404, 375, 375, 375, 375, 375, 375, 240, 240],
  [240, 240, 240, 240, 240, 404, 404, 404, 240, 15, 16, 16, 16, 17, 240, 240],
  [240, 240, 240, 240, 375, 375, 375, 375, 375, 45, 46, 46, 329, 47, 240, 240],
  [240, 240, 240, 240, 15, 16, 16, 16, 17, 75, 76, 76, 359, 77, 240, 240],
  [240, 240, 240, 240, 45, 46, 46, 46, 47, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 75, 76, 76, 76, 77, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
] as const satisfies TilePattern;

const DB_EXTRACTED_HOUSE_UPPER_PATTERN = [
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, 378, 379, 379, 379, 379, 379, 379, 379, 379, 379, 379, 379, 379, 379, 380],
  [-1, 408, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, 354, -1, -1, -1, -1, -1, -1, -1, -1, 355, -1, 408],
  [-1, 408, -1, -1, 376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, 376, -1, -1, -1, 355, -1, -1, -1, -1, 385, -1, 408],
  [-1, 408, -1, -1, 376, -1, -1, -1, 377, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, 384, -1, -1, -1, 385, -1, 87, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, -1, 87, -1, 87, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 408],
  [-1, 408, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 409, 410],
  [-1, 438, 379, 379, 379, 379, 379, 439, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
] as const satisfies TilePattern;

export function createDbExtractedHouseTemplateMap(): GameMap {
  const tileCount = DB_EXTRACTED_HOUSE_TEMPLATE_SIZE.width * DB_EXTRACTED_HOUSE_TEMPLATE_SIZE.height;
  const map: GameMap = {
    events: [],
    height: DB_EXTRACTED_HOUSE_TEMPLATE_SIZE.height,
    id: genId("map"),
    lowerTiles: new Array<number>(tileCount).fill(TILE.GRASS),
    name: "DB 추출 사용자 집 템플릿",
    tileSize: DEFAULT_TILE_SIZE,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    width: DB_EXTRACTED_HOUSE_TEMPLATE_SIZE.width,
  };
  stampDbExtractedHouseTemplate(map, { x: 0, y: 0 });
  normalizeHouseLayerContract(map);
  return map;
}

export function createSmallHouseVariantMaps(): GameMap[] {
  return SMALL_HOUSE_VARIANT_INDICES.map(createSmallHouseVariantMap);
}

export function createSmallHouseVariantMap(variant: SmallHouseVariantIndex): GameMap {
  const map = createVariantBlankMap(`small_house_01 변형 ${variant}`);
  switch (variant) {
    case 1:
      buildOpenYardVariant(map);
      break;
    case 2:
      buildSideGardenVariant(map);
      break;
    case 3:
      buildWideFrontPathVariant(map);
      break;
    case 4:
      buildPondGardenVariant(map);
      break;
    case 5:
      buildOrchardFenceVariant(map);
      break;
    case 6:
      buildPlazaTwoStoryVariant(map);
      break;
    case 7:
      buildTStemHouseVariant(map);
      break;
    case 8:
      buildTStemWoodHouseVariant(map);
      break;
    case 9:
      buildTStemStoneHouseVariant(map);
      break;
  }
  normalizeHouseLayerContract(map);
  return map;
}

export function stampDbExtractedHouseTemplate(map: GameMap, origin: TilePoint): void {
  stampPattern({ layer: "lower", map, origin, pattern: DB_EXTRACTED_HOUSE_LOWER_PATTERN });
  stampPattern({ layer: "upper", map, origin, pattern: DB_EXTRACTED_HOUSE_UPPER_PATTERN });
}

export function stampSmallHouse(map: GameMap, origin: TilePoint, material: SmallHouseMaterial): void {
  const swaps = wallTileSwaps(material);
  stampPattern({ layer: "lower", map, origin, pattern: remapPattern(DB_EXTRACTED_HOUSE_LOWER_PATTERN, swaps) });
  stampPattern({ layer: "upper", map, origin, pattern: remapPattern(DB_EXTRACTED_HOUSE_UPPER_PATTERN, swaps) });
}

function wallTileSwaps(material: SmallHouseMaterial): ReadonlyMap<number, number> {
  const swaps = new Map<number, number>();
  const base = HOUSE_WALL_TILES.plaster;
  const target = HOUSE_WALL_TILES[material];
  base.top.forEach((tile, index) => swaps.set(tile, target.top[index] ?? tile));
  base.body.forEach((tile, index) => swaps.set(tile, target.body[index] ?? tile));
  base.bottom.forEach((tile, index) => swaps.set(tile, target.bottom[index] ?? tile));
  swaps.set(base.window, target.window);
  return swaps;
}

function remapPattern(pattern: TilePattern, swaps: ReadonlyMap<number, number>): number[][] {
  return pattern.map((row) => (row ? row.map((tile) => swaps.get(tile) ?? tile) : []));
}

function createVariantBlankMap(name: string): GameMap {
  const tileCount = SMALL_HOUSE_VARIANT_MAP_SIZE.width * SMALL_HOUSE_VARIANT_MAP_SIZE.height;
  return {
    events: [],
    height: SMALL_HOUSE_VARIANT_MAP_SIZE.height,
    id: genId("map"),
    lowerTiles: new Array<number>(tileCount).fill(TILE.GRASS),
    name,
    tileSize: DEFAULT_TILE_SIZE,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    width: SMALL_HOUSE_VARIANT_MAP_SIZE.width,
  };
}

function buildOpenYardVariant(map: GameMap): void {
  stampDbExtractedHouseTemplate(map, { x: 2, y: 1 });
  paintAutoRoad(map, [
    { x: 14, y: 10, width: 2, height: 8 },
    { x: 10, y: 15, width: 5, height: 2 },
  ]);
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: 9, y: 14 });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: 10, y: 14 });
  placeUpperTiles(map, [
    { tile: TILE.TREE, x: 1, y: 15 },
  ]);
  placeOverlappingTreeCluster(map);
}

function buildSideGardenVariant(map: GameMap): void {
  stampDbExtractedHouseTemplate(map, { x: 1, y: 2 });
  eraseRect(map, { x: 5, y: 5 }, 10, 8);
  stampPlasterHouse(map, { origin: { x: 8, y: 4 }, width: 7, bodyRows: 5 });
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: 11, y: 10 });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: 11, y: 11 });
  setTile(map, { layer: "upper", tile: 87, x: 9, y: 8 });
  setTile(map, { layer: "upper", tile: 87, x: 13, y: 8 });
  setTile(map, { layer: "upper", tile: 87, x: 13, y: 10 });
  paintLowerRect(map, { origin: { x: 11, y: 12 }, width: 2, height: 5, tile: TILE.PATH });
  paintLowerRect(map, { origin: { x: 13, y: 14 }, width: 4, height: 2, tile: TILE.PATH });
  paintLowerRect(map, { origin: { x: 2, y: 14 }, width: 6, height: 2, tile: TILE.DARK_GRASS });
  placeUpperTiles(map, [
    { tile: TILE.FLOWERS, x: 3, y: 14 },
    { tile: TILE.FLOWERS, x: 5, y: 15 },
    { tile: TILE.FLOWERS, x: 7, y: 14 },
    { tile: TILE.TREE, x: 18, y: 2 },
    { tile: TILE.TREE, x: 18, y: 14 },
  ]);
}

function buildWideFrontPathVariant(map: GameMap): void {
  stampDbExtractedHouseTemplate(map, { x: 3, y: 0 });
  eraseRect(map, { x: 5, y: 3 }, 12, 8);
  stampPlasterHouse(map, { origin: { x: 5, y: 4 }, width: 12, bodyRows: 4 });
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: 11, y: 9 });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: 11, y: 10 });
  setTile(map, { layer: "upper", tile: 87, x: 7, y: 8 });
  setTile(map, { layer: "upper", tile: 87, x: 9, y: 8 });
  setTile(map, { layer: "upper", tile: 87, x: 14, y: 8 });
  paintLowerRect(map, { origin: { x: 11, y: 11 }, width: 1, height: 7, tile: TILE.PATH });
  paintLowerRect(map, { origin: { x: 9, y: 15 }, width: 5, height: 2, tile: TILE.PATH });
  paintLowerRect(map, { origin: { x: 1, y: 2 }, width: 3, height: 11, tile: TILE.DARK_GRASS });
  placeUpperTiles(map, [
    { tile: TILE.FLOWERS, x: 1, y: 2 },
    { tile: TILE.FLOWERS, x: 2, y: 4 },
    { tile: TILE.FLOWERS, x: 1, y: 8 },
    { tile: TILE.TREE, x: 2, y: 12 },
    { tile: 378, x: 6, y: 14 },
    { tile: 379, x: 7, y: 14 },
    { tile: 379, x: 8, y: 14 },
    { tile: 380, x: 9, y: 14 },
  ]);
}

function stampHouse(map: GameMap, input: HouseInput): void {
  const wall = HOUSE_WALL_TILES[input.material];
  stampUpperRun(map, input.origin, input.width, [ROOF_CAP_LEFT, ROOF_BODY, ROOF_CAP_RIGHT]);
  stampUpperRun(map, { x: input.origin.x, y: input.origin.y + 1 }, input.width, [
    ROOF_BODY,
    ROOF_BODY,
    ROOF_BODY,
  ]);
  stampUpperRun(map, { x: input.origin.x, y: input.origin.y + 2 }, input.width, [
    ROOF_BODY,
    ROOF_BODY,
    ROOF_BODY,
  ]);
  stampLowerRun(map, { x: input.origin.x, y: input.origin.y + 3 }, input.width, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
  for (let row = 0; row < input.bodyRows; row += 1) {
    const y = input.origin.y + 4 + row;
    stampLowerRun(map, { x: input.origin.x, y }, input.width, row === input.bodyRows - 1 ? wall.bottom : wall.body);
  }
}

function stampPlasterHouse(map: GameMap, input: PlasterHouseInput): void {
  stampHouse(map, { ...input, material: "plaster" });
}

function eraseRect(map: GameMap, origin: TilePoint, width: number, height: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setTile(map, { layer: "lower", tile: TILE.GRASS, x: origin.x + x, y: origin.y + y });
      setTile(map, { layer: "upper", tile: TILE.EMPTY, x: origin.x + x, y: origin.y + y });
    }
  }
}

function stampLowerRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) {
    setTile(map, { layer: "lower", tile: tiles[columnIndex(offset, width)], x: origin.x + offset, y: origin.y });
  }
}

function stampUpperRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) {
    setTile(map, { layer: "upper", tile: tiles[columnIndex(offset, width)], x: origin.x + offset, y: origin.y });
  }
}

function columnIndex(offset: number, width: number): 0 | 1 | 2 {
  if (offset === 0) return 0;
  if (offset === width - 1) return 2;
  return 1;
}

function paintLowerRect(map: GameMap, input: LowerRectInput): void {
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      setTile(map, { layer: "lower", tile: input.tile, x: input.origin.x + x, y: input.origin.y + y });
    }
  }
}

function paintAutoRoad(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) paintRoadRect(map, rect);
  shapeRoadEdges(map, rects);
}

function placeUpperTiles(map: GameMap, placements: readonly Omit<TilePlacement, "layer">[]): void {
  for (const placement of placements) setTile(map, { ...placement, layer: "upper" });
}

function stampPattern(input: StampInput): void {
  for (let y = 0; y < input.pattern.length; y += 1) {
    const row = input.pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) {
        setTile(input.map, { layer: input.layer, tile, x: input.origin.x + x, y: input.origin.y + y });
      }
    }
  }
}

function setTile(map: GameMap, placement: TilePlacement): void {
  if (!isInside(map, placement.x, placement.y)) return;
  const index = placement.y * map.width + placement.x;
  if (placement.layer === "lower") map.lowerTiles[index] = placement.tile;
  else map.upperTiles[index] = placement.tile;
}

function normalizeHouseLayerContract(map: GameMap): void {
  for (let index = 0; index < map.upperTiles.length; index += 1) {
    const tile = map.upperTiles[index];
    if (!LOWER_TRANSPARENT_HOUSE_TILES.has(tile)) continue;
    appendTileToStack(map, "lower", index, tile);
    map.upperTiles[index] = TILE.EMPTY;
  }
}

function placeOverlappingTreeCluster(map: GameMap): void {
  placeTwoByTwoTree(map, { x: 0, y: 3 });
  placeTwoByTwoTree(map, { x: 0, y: 4 });
  placeTwoByTwoTree(map, { x: 0, y: 5 });
}

function placeTwoByTwoTree(map: GameMap, origin: TilePoint): void {
  stackTile(map, "upper", origin.x, origin.y, TREE_TOP_LEFT);
  stackTile(map, "upper", origin.x + 1, origin.y, TREE_TOP_RIGHT);
  stackTile(map, "lower", origin.x, origin.y + 1, TREE_BOTTOM_LEFT);
  stackTile(map, "lower", origin.x + 1, origin.y + 1, TREE_BOTTOM_RIGHT);
}

function stackTile(map: GameMap, layer: TileLayerName, x: number, y: number, tile: number): void {
  if (!isInside(map, x, y)) return;
  appendTileToStack(map, layer, y * map.width + x, tile);
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

const FENCE_TOP_LEFT = 378;
const FENCE_TOP_RAIL = 379;
const FENCE_TOP_RIGHT = 380;
const FENCE_SIDE_RAIL = 408;
const FENCE_BOTTOM_LEFT = 438;
const FENCE_BOTTOM_RIGHT = 410;
const SAND_BODY = 424;
const WATER_BODY = 120;
const BENCH_LEFT = 327;
const BENCH_RIGHT = 328;
const MARKET_AWNING_TOP = [411, 412, 413] as const;
const MARKET_AWNING_BOTTOM = [441, 442, 443] as const;

type FenceRectInput = {
  readonly origin: TilePoint;
  readonly width: number;
  readonly height: number;
};

function placeFenceRect(map: GameMap, input: FenceRectInput): void {
  const { origin, width, height } = input;
  if (width < 2 || height < 2) return;
  const lastX = origin.x + width - 1;
  const lastY = origin.y + height - 1;
  for (let x = origin.x + 1; x < lastX; x += 1) {
    setTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: origin.y });
    setTile(map, { layer: "upper", tile: FENCE_TOP_RAIL, x, y: lastY });
  }
  for (let y = origin.y + 1; y < lastY; y += 1) {
    setTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: origin.x, y });
    setTile(map, { layer: "upper", tile: FENCE_SIDE_RAIL, x: lastX, y });
  }
  setTile(map, { layer: "upper", tile: FENCE_TOP_LEFT, x: origin.x, y: origin.y });
  setTile(map, { layer: "upper", tile: FENCE_TOP_RIGHT, x: lastX, y: origin.y });
  setTile(map, { layer: "upper", tile: FENCE_BOTTOM_LEFT, x: origin.x, y: lastY });
  setTile(map, { layer: "upper", tile: FENCE_BOTTOM_RIGHT, x: lastX, y: lastY });
}

function buildPondGardenVariant(map: GameMap): void {
  stampSmallHouse(map, { x: 4, y: 0 }, "wood");
  paintLowerRect(map, { origin: { x: 0, y: 0 }, width: 4, height: 15, tile: SAND_BODY });
  paintLowerRect(map, { origin: { x: 1, y: 2 }, width: 2, height: 11, tile: WATER_BODY });
  shapeSandEdges(map);
  paintAutoRoad(map, [
    { x: 15, y: 9, width: 3, height: 8 },
    { x: 5, y: 16, width: 12, height: 2 },
  ]);
  paintLowerRect(map, { origin: { x: 0, y: 15 }, width: 5, height: 3, tile: TILE.DARK_GRASS });
  placeUpperTiles(map, [
    { tile: TILE.FLOWERS, x: 1, y: 16 },
    { tile: TILE.FLOWERS, x: 3, y: 17 },
    { tile: TILE.FLOWERS, x: 9, y: 15 },
    { tile: TILE.TREE, x: 0, y: 15 },
    { tile: TILE.TREE, x: 18, y: 15 },
  ]);
  placeTwoByTwoTree(map, { x: 1, y: 13 });
}

function buildOrchardFenceVariant(map: GameMap): void {
  stampSmallHouse(map, { x: 0, y: 2 }, "stone");
  placeFenceRect(map, { origin: { x: 16, y: 3 }, width: 4, height: 13 });
  placeUpperTiles(map, [
    { tile: TILE.TREE, x: 17, y: 5 },
    { tile: TILE.TREE, x: 19, y: 5 },
    { tile: TILE.TREE, x: 17, y: 8 },
    { tile: TILE.TREE, x: 19, y: 8 },
    { tile: TILE.TREE, x: 18, y: 11 },
    { tile: TILE.FLOWERS, x: 18, y: 7 },
    { tile: TILE.FLOWERS, x: 17, y: 12 },
  ]);
  placeTwoByTwoTree(map, { x: 16, y: 13 });
  paintAutoRoad(map, [
    { x: 11, y: 11, width: 3, height: 6 },
    { x: 0, y: 16, width: 16, height: 2 },
  ]);
  placeUpperTiles(map, [
    { tile: TILE.FLOWERS, x: 1, y: 16 },
    { tile: TILE.FLOWERS, x: 4, y: 17 },
    { tile: TILE.TREE, x: 0, y: 0 },
    { tile: TILE.TREE, x: 15, y: 0 },
  ]);
}

function buildPlazaTwoStoryVariant(map: GameMap): void {
  stampPlasterHouse(map, { origin: { x: 4, y: 1 }, width: 10, bodyRows: 6 });
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: 8, y: 10 });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: 8, y: 11 });
  setTile(map, { layer: "upper", tile: 87, x: 6, y: 7 });
  setTile(map, { layer: "upper", tile: 87, x: 10, y: 7 });
  setTile(map, { layer: "upper", tile: 87, x: 6, y: 9 });
  setTile(map, { layer: "upper", tile: 87, x: 10, y: 9 });
  placeFenceRect(map, { origin: { x: 15, y: 1 }, width: 5, height: 5 });
  paintAutoRoad(map, [
    { x: 0, y: 14, width: 20, height: 2 },
    { x: 8, y: 12, width: 1, height: 2 },
    { x: 15, y: 10, width: 3, height: 4 },
    { x: 0, y: 10, width: 4, height: 4 },
  ]);
  placeUpperTiles(map, [
    { tile: MARKET_AWNING_TOP[0], x: 1, y: 12 },
    { tile: MARKET_AWNING_TOP[1], x: 2, y: 12 },
    { tile: MARKET_AWNING_TOP[2], x: 3, y: 12 },
    { tile: MARKET_AWNING_BOTTOM[0], x: 1, y: 13 },
    { tile: MARKET_AWNING_BOTTOM[1], x: 2, y: 13 },
    { tile: MARKET_AWNING_BOTTOM[2], x: 3, y: 13 },
    { tile: BENCH_LEFT, x: 17, y: 14 },
    { tile: BENCH_RIGHT, x: 18, y: 14 },
    { tile: TILE.FLOWERS, x: 5, y: 16 },
    { tile: TILE.FLOWERS, x: 12, y: 16 },
    { tile: TILE.FLOWERS, x: 17, y: 8 },
  ]);
}

function buildTStemHouseMaterialVariant(map: GameMap, material: SmallHouseMaterial): void {
  const wall = HOUSE_WALL_TILES[material];
  stampHouse(map, { material, origin: { x: 2, y: 1 }, width: 17, bodyRows: 4 });
  stampHouse(map, { material, origin: { x: 7, y: 5 }, width: 7, bodyRows: 5 });
  stampUpperRun(map, { x: 2, y: 1 }, 18, [ROOF_CAP_LEFT, ROOF_BODY, ROOF_CAP_RIGHT]);
  stampUpperRun(map, { x: 2, y: 2 }, 18, [ROOF_BODY, ROOF_BODY, ROOF_BODY]);
  stampUpperRun(map, { x: 2, y: 3 }, 18, [ROOF_BODY, ROOF_BODY, ROOF_BODY]);
  stampLowerRun(map, { x: 2, y: 4 }, 18, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
  stampUpperRun(map, { x: 7, y: 5 }, 8, [ROOF_CAP_LEFT, ROOF_BODY, ROOF_CAP_RIGHT]);
  stampUpperRun(map, { x: 7, y: 6 }, 8, [ROOF_BODY, ROOF_BODY, ROOF_BODY]);
  stampUpperRun(map, { x: 7, y: 7 }, 8, [ROOF_BODY, ROOF_BODY, ROOF_BODY]);
  stampLowerRun(map, { x: 7, y: 8 }, 8, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
  stampLowerRun(map, { x: 2, y: 5 }, 17, wall.top);
  stampLowerRun(map, { x: 7, y: 9 }, 7, wall.top);
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: 10, y: 12 });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: 10, y: 13 });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: 10, y: 12 });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: 10, y: 13 });
  placeFenceRect(map, { origin: { x: 0, y: 0 }, width: 21, height: 18 });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: 10, y: 17 });
  paintLowerRect(map, { origin: { x: 10, y: 14 }, width: 1, height: 4, tile: TILE.PATH });
  placeUpperTiles(map, [
    { tile: wall.window, x: 4, y: 6 },
    { tile: wall.window, x: 15, y: 6 },
    { tile: wall.window, x: 8, y: 11 },
    { tile: wall.window, x: 12, y: 11 },
    { tile: TILE.TREE, x: 1, y: 14 },
    { tile: TILE.TREE, x: 17, y: 14 },
  ]);
}

function buildTStemHouseVariant(map: GameMap): void {
  buildTStemHouseMaterialVariant(map, "plaster");
}

function buildTStemWoodHouseVariant(map: GameMap): void {
  buildTStemHouseMaterialVariant(map, "wood");
}

function buildTStemStoneHouseVariant(map: GameMap): void {
  buildTStemHouseMaterialVariant(map, "stone");
}
