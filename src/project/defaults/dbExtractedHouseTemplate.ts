import { genId } from "@/util/id";
import { stampFootprintHouseKit, stampRectHouseKit, type FootprintWing, type HouseKitId } from "@/editor/houseKit";
import { appendTileToStack } from "@/project/mapOverlayTiles";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "./roadAutotile";
import { kitIdForSmallHouseMaterial, SMALL_HOUSE_01_HOUSE_KIT_PLAN, stampTerrainTemplateHouse, type HouseKitBuildPlan, type HouseStampPlan } from "./terrainTemplateHouseStamp";

type TilePattern = readonly (readonly number[])[];
type TileLayerName = "lower" | "upper";
export type TilePoint = {
  readonly x: number;
  readonly y: number;
};
type StampInput = {
  readonly layer: TileLayerName;
  readonly map: GameMap;
  readonly origin: TilePoint;
  readonly pattern: TilePattern;
  readonly skipTiles?: ReadonlySet<number>;
};
type TilePlacement = {
  readonly layer: TileLayerName;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
};
type HouseInput = {
  readonly material: SmallHouseMaterial;
  readonly origin: TilePoint;
  readonly wallRows: number;
  readonly width: number;
};
type RoofFootprint = {
  readonly origin: TilePoint;
  readonly width: number;
};
type WallFootprint = {
  readonly origin: TilePoint;
  readonly rows: number;
  readonly width: number;
};
type HouseBodyPlan = {
  readonly roof: RoofFootprint;
  readonly wall: WallFootprint;
  readonly windows: readonly TilePoint[];
};
type LShapedHouseBuildPlan = {
  readonly fence: HouseKitBuildPlan["fence"];
  readonly lowerHouse: HouseStampPlan;
  readonly roads: readonly RoadRect[];
  readonly upperHouse: HouseBodyPlan;
};
type ComplexHouseBuildPlan = {
  readonly door: HouseStampPlan["door"];
  readonly fence: HouseKitBuildPlan["fence"];
  readonly houses: readonly HouseBodyPlan[];
  readonly roads: readonly RoadRect[];
};
type CityHousePlan = {
  readonly bodies: readonly HouseBodyPlan[];
  readonly door: HouseStampPlan["door"];
  readonly windows: readonly TilePoint[];
};
type CityBuildPlan = {
  readonly houses: readonly CityHousePlan[];
  readonly roads: readonly RoadRect[];
  readonly treeOrigins: readonly TilePoint[];
};
type BlankHouseMapInput = {
  readonly height: number;
  readonly name: string;
  readonly width: number;
};
export type SmallHouseVariantIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SmallHouseMaterial = "plaster" | "wood" | "stone";
export type DbExtractedHouseStampInput = {
  readonly material?: SmallHouseMaterial;
  readonly origin: TilePoint;
  readonly preserveExistingGround?: boolean;
};

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
const SMALL_HOUSE_CITY_MAP_SIZE = {
  height: 50,
  width: 50,
} as const;
const SMALL_HOUSE_VARIANT_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly SmallHouseVariantIndex[];
const WIDE_SMALL_HOUSE_TEMPLATE_BUILD_PLAN = {
  fence: { x: 2, y: 2, width: 17, height: 15 },
  house: {
    roof: { origin: { x: 5, y: 4 }, width: 13 },
    wall: { origin: { x: 5, y: 8 }, width: 13, rows: 3 },
    door: { x: 11, topY: 9, bottomY: 10 },
    windows: [
      { x: 8, y: 9 },
      { x: 14, y: 9 },
    ],
  },
  roads: [
    { x: 11, y: 11, width: 2, height: 6 },
    { x: 8, y: 15, width: 6, height: 2 },
  ],
} as const satisfies HouseKitBuildPlan;
const L_SHAPED_SMALL_HOUSE_TEMPLATE_BUILD_PLAN = {
  fence: { x: 2, y: 2, width: 17, height: 15 },
  upperHouse: {
    roof: { origin: { x: 4, y: 3 }, width: 11 },
    wall: { origin: { x: 4, y: 7 }, width: 11, rows: 3 },
    windows: [
      { x: 7, y: 8 },
    ],
  },
  lowerHouse: {
    roof: { origin: { x: 10, y: 6 }, width: 8 },
    wall: { origin: { x: 10, y: 10 }, width: 8, rows: 3 },
    door: { x: 13, topY: 11, bottomY: 12 },
    windows: [
      { x: 11, y: 11 },
      { x: 16, y: 11 },
    ],
  },
  roads: [
    { x: 13, y: 13, width: 2, height: 4 },
    { x: 10, y: 15, width: 6, height: 2 },
  ],
} as const satisfies LShapedHouseBuildPlan;
const COMPLEX_SMALL_HOUSE_TEMPLATE_BUILD_PLAN = {
  fence: { x: 1, y: 1, width: 19, height: 16 },
  houses: [
    {
      roof: { origin: { x: 3, y: 2 }, width: 15 },
      wall: { origin: { x: 3, y: 6 }, width: 15, rows: 3 },
      windows: [],
    },
    {
      roof: { origin: { x: 3, y: 5 }, width: 8 },
      wall: { origin: { x: 3, y: 9 }, width: 8, rows: 3 },
      windows: [
        { x: 5, y: 10 },
      ],
    },
    {
      roof: { origin: { x: 10, y: 7 }, width: 8 },
      wall: { origin: { x: 10, y: 11 }, width: 8, rows: 3 },
      windows: [
        { x: 11, y: 12 },
        { x: 16, y: 12 },
      ],
    },
  ],
  door: { x: 13, topY: 12, bottomY: 13 },
  roads: [
    { x: 13, y: 14, width: 2, height: 3 },
    { x: 8, y: 16, width: 7, height: 1 },
  ],
} as const satisfies ComplexHouseBuildPlan;
const SMALL_HOUSE_CITY_BUILD_PLAN = {
  houses: [
    {
      bodies: [
        {
          roof: { origin: { x: 3, y: 3 }, width: 13 },
          wall: { origin: { x: 3, y: 7 }, width: 13, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 8, topY: 8, bottomY: 9 },
      windows: [
        { x: 5, y: 8 },
        { x: 12, y: 8 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 20, y: 3 }, width: 11 },
          wall: { origin: { x: 20, y: 7 }, width: 11, rows: 3 },
          windows: [],
        },
        {
          roof: { origin: { x: 23, y: 6 }, width: 7 },
          wall: { origin: { x: 23, y: 10 }, width: 7, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 26, topY: 11, bottomY: 12 },
      windows: [
        { x: 22, y: 8 },
        { x: 28, y: 8 },
        { x: 24, y: 11 },
        { x: 28, y: 11 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 36, y: 4 }, width: 9 },
          wall: { origin: { x: 36, y: 8 }, width: 9, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 40, topY: 9, bottomY: 10 },
      windows: [
        { x: 38, y: 9 },
        { x: 43, y: 9 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 4, y: 17 }, width: 13 },
          wall: { origin: { x: 4, y: 21 }, width: 13, rows: 3 },
          windows: [],
        },
        {
          roof: { origin: { x: 10, y: 20 }, width: 8 },
          wall: { origin: { x: 10, y: 24 }, width: 8, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 13, topY: 25, bottomY: 26 },
      windows: [
        { x: 7, y: 22 },
        { x: 15, y: 22 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 24, y: 17 }, width: 9 },
          wall: { origin: { x: 24, y: 21 }, width: 9, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 28, topY: 22, bottomY: 23 },
      windows: [
        { x: 25, y: 22 },
        { x: 31, y: 22 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 38, y: 19 }, width: 10 },
          wall: { origin: { x: 38, y: 23 }, width: 10, rows: 3 },
          windows: [],
        },
        {
          roof: { origin: { x: 36, y: 22 }, width: 7 },
          wall: { origin: { x: 36, y: 26 }, width: 7, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 39, topY: 27, bottomY: 28 },
      windows: [
        { x: 40, y: 24 },
        { x: 45, y: 24 },
        { x: 42, y: 27 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 6, y: 34 }, width: 14 },
          wall: { origin: { x: 6, y: 38 }, width: 14, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 12, topY: 39, bottomY: 40 },
      windows: [
        { x: 8, y: 39 },
        { x: 16, y: 39 },
      ],
    },
    {
      bodies: [
        {
          roof: { origin: { x: 27, y: 33 }, width: 13 },
          wall: { origin: { x: 27, y: 37 }, width: 13, rows: 3 },
          windows: [],
        },
        {
          roof: { origin: { x: 32, y: 36 }, width: 10 },
          wall: { origin: { x: 32, y: 40 }, width: 10, rows: 3 },
          windows: [],
        },
      ],
      door: { x: 36, topY: 41, bottomY: 42 },
      windows: [
        { x: 29, y: 38 },
        { x: 37, y: 38 },
        { x: 34, y: 41 },
        { x: 39, y: 41 },
      ],
    },
  ],
  roads: [
    { x: 8, y: 10, width: 2, height: 5 },
    { x: 26, y: 13, width: 2, height: 3 },
    { x: 40, y: 11, width: 2, height: 4 },
    { x: 13, y: 27, width: 2, height: 5 },
    { x: 28, y: 24, width: 2, height: 8 },
    { x: 39, y: 29, width: 2, height: 3 },
    { x: 12, y: 41, width: 2, height: 4 },
    { x: 36, y: 43, width: 2, height: 3 },
    { x: 7, y: 14, width: 35, height: 2 },
    { x: 10, y: 30, width: 34, height: 2 },
    { x: 12, y: 44, width: 26, height: 2 },
    { x: 21, y: 14, width: 2, height: 32 },
    { x: 34, y: 14, width: 2, height: 18 },
  ],
  treeOrigins: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 17, y: 1 },
    { x: 18, y: 1 },
    { x: 32, y: 1 },
    { x: 33, y: 1 },
    { x: 46, y: 1 },
    { x: 47, y: 1 },
    { x: 1, y: 2 },
    { x: 17, y: 2 },
    { x: 32, y: 2 },
    { x: 46, y: 2 },
    { x: 1, y: 3 },
    { x: 17, y: 3 },
    { x: 32, y: 3 },
    { x: 46, y: 3 },
    { x: 1, y: 5 },
    { x: 17, y: 5 },
    { x: 32, y: 5 },
    { x: 46, y: 5 },
    { x: 1, y: 7 },
    { x: 17, y: 7 },
    { x: 32, y: 7 },
    { x: 46, y: 7 },
    { x: 1, y: 18 },
    { x: 2, y: 18 },
    { x: 1, y: 19 },
    { x: 1, y: 20 },
    { x: 1, y: 22 },
    { x: 1, y: 24 },
    { x: 1, y: 26 },
    { x: 1, y: 28 },
    { x: 1, y: 34 },
    { x: 2, y: 34 },
    { x: 24, y: 34 },
    { x: 46, y: 32 },
    { x: 46, y: 34 },
    { x: 1, y: 35 },
    { x: 1, y: 36 },
    { x: 24, y: 36 },
    { x: 46, y: 36 },
    { x: 1, y: 38 },
    { x: 24, y: 38 },
    { x: 46, y: 38 },
    { x: 1, y: 40 },
    { x: 24, y: 40 },
    { x: 46, y: 40 },
    { x: 1, y: 42 },
    { x: 24, y: 42 },
    { x: 46, y: 42 },
    { x: 46, y: 45 },
    { x: 1, y: 46 },
    { x: 24, y: 46 },
    { x: 46, y: 46 },
    { x: 47, y: 46 },
  ],
} as const satisfies CityBuildPlan;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const TREE_TOP_LEFT = 262;
const TREE_TOP_RIGHT = 263;
const TREE_BOTTOM_LEFT = 292;
const TREE_BOTTOM_RIGHT = 293;
const CONIFER_TOP = 260;
const TREE_STACK_TILES = new Set([TREE_TOP_LEFT, TREE_TOP_RIGHT, TREE_BOTTOM_LEFT, TREE_BOTTOM_RIGHT]);
// 패턴이 upper 레이어에 찍은 울타리(378~439 계열)/창문(85,87) 오버레이는
// RM2K3 정석에 따라 upper에 유지한다 (chipsetMapping.isUpperChipsetTile과 일관).
// 강등 대상이 없으므로 normalize는 사실상 no-op이 된다.
const LOWER_TRANSPARENT_HOUSE_TILES = new Set<number>();
const DB_EXTRACTED_HOUSE_GROUND_TILES = new Set<number>([TILE.GRASS]);

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
      buildConnectedLHouseVariant(map);
      break;
    case 5:
      buildComplexSteppedHouseVariant(map);
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

export function createSmallHouseCityMap(): GameMap {
  const map = createBlankHouseMap({
    height: SMALL_HOUSE_CITY_MAP_SIZE.height,
    name: "small_house_01 도시 8채",
    width: SMALL_HOUSE_CITY_MAP_SIZE.width,
  });
  buildSmallHouseCity(map);
  normalizeHouseLayerContract(map);
  return map;
}

export function stampDbExtractedHouseTemplate(map: GameMap, origin: TilePoint): void {
  stampDbExtractedHouse(map, { origin });
}

export function stampSmallHouse(map: GameMap, origin: TilePoint, material: SmallHouseMaterial): void {
  stampDbExtractedHouse(map, { material, origin });
}

export function stampDbExtractedHouse(map: GameMap, input: DbExtractedHouseStampInput): void {
  const swaps = wallTileSwaps(input.material ?? "plaster");
  const lowerPattern = remapPattern(DB_EXTRACTED_HOUSE_LOWER_PATTERN, swaps);
  const upperPattern = remapPattern(DB_EXTRACTED_HOUSE_UPPER_PATTERN, swaps);
  if (input.preserveExistingGround === true) {
    stampPattern({
      layer: "lower",
      map,
      origin: input.origin,
      pattern: lowerPattern,
      skipTiles: DB_EXTRACTED_HOUSE_GROUND_TILES,
    });
  } else {
    stampPattern({ layer: "lower", map, origin: input.origin, pattern: lowerPattern });
  }
  stampPattern({ layer: "upper", map, origin: input.origin, pattern: upperPattern });
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
  return createBlankHouseMap({
    height: SMALL_HOUSE_VARIANT_MAP_SIZE.height,
    name,
    width: SMALL_HOUSE_VARIANT_MAP_SIZE.width,
  });
}

function createBlankHouseMap(input: BlankHouseMapInput): GameMap {
  const tileCount = input.width * input.height;
  return {
    events: [],
    height: input.height,
    id: genId("map"),
    lowerTiles: new Array<number>(tileCount).fill(TILE.GRASS),
    name: input.name,
    tileSize: DEFAULT_TILE_SIZE,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    width: input.width,
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
    { tile: CONIFER_TOP, x: 1, y: 14 },
    { tile: TILE.TREE, x: 1, y: 15 },
  ]);
  placeOverlappingTreeCluster(map);
}

function buildSideGardenVariant(map: GameMap): void {
  stampTerrainTemplateHouse(map, {
    buildPlan: SMALL_HOUSE_01_HOUSE_KIT_PLAN,
    includeFence: true,
    material: "plaster",
    origin: { x: 0, y: 0 },
    paintRoads: true,
  });
}

function buildWideFrontPathVariant(map: GameMap): void {
  stampTerrainTemplateHouse(map, {
    buildPlan: WIDE_SMALL_HOUSE_TEMPLATE_BUILD_PLAN,
    includeFence: true,
    material: "plaster",
    origin: { x: 0, y: 0 },
    paintRoads: true,
  });
}

function stampHouseBodies(map: GameMap, bodies: readonly HouseBodyPlan[], material: SmallHouseMaterial, windows: readonly TilePoint[] = []): void {
  const kitId = kitIdForSmallHouseMaterial(material);
  const wings = bodies.map((body) => wingFromBody(body, kitId));
  const result = stampFootprintHouseKit(map, { kitId, wings, windows: false });
  if (!result.ok) throw new Error(result.reason ?? "house kit stamp failed");
  stampVisibleWindows(map, windows, material);
}

function stampRectHouseFromRows(map: GameMap, input: HouseInput): void {
  const kitId = kitIdForSmallHouseMaterial(input.material);
  const wallRows = Math.max(3, input.wallRows);
  const result = stampRectHouseKit(map, {
    x: input.origin.x,
    y: input.origin.y,
    width: input.width,
    stories: wallRows >= 5 ? 2 : 1,
    roofBodyRows: Math.max(1, input.wallRows - 2),
    kitId,
    windows: false,
  });
  if (!result.ok) throw new Error(result.reason ?? "house kit rect stamp failed");
}

function wingFromBody(body: HouseBodyPlan, kitId: HouseKitId): FootprintWing {
  const y = kitId === "bright-plaster" ? body.roof.origin.y + 1 : body.roof.origin.y;
  const bottom = body.wall.origin.y + body.wall.rows;
  return { x: body.roof.origin.x, y, w: body.roof.width, h: bottom - y };
}

function stampDoor(map: GameMap, door: HouseStampPlan["door"]): void {
  setTile(map, { layer: "lower", tile: DOOR_TOP, x: door.x, y: door.topY });
  setTile(map, { layer: "lower", tile: DOOR_BOTTOM, x: door.x, y: door.bottomY });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: door.x, y: door.topY });
  setTile(map, { layer: "upper", tile: TILE.EMPTY, x: door.x, y: door.bottomY });
}

function stampVisibleWindows(map: GameMap, windows: readonly TilePoint[], material: SmallHouseMaterial): void {
  for (const window of windows) {
    if (isVisibleWallMiddle(map, window, material)) {
      setTile(map, { layer: "upper", tile: HOUSE_WALL_TILES[material].window, x: window.x, y: window.y });
    }
  }
}

function isVisibleWallMiddle(map: GameMap, point: TilePoint, material: SmallHouseMaterial): boolean {
  if (!isInside(map, point.x, point.y)) return false;
  const index = point.y * map.width + point.x;
  const lowerTile = map.lowerTiles[index] ?? TILE.EMPTY;
  const upperTile = map.upperTiles[index] ?? TILE.EMPTY;
  return upperTile === TILE.EMPTY && lowerTile === HOUSE_WALL_TILES[material].body[1];
}

function paintAutoRoad(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) paintRoadRect(map, rect);
  shapeRoadEdges(map, rects);
  clearObjectsOnRoadRects(map, rects);
}

function clearObjectsOnRoadRects(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        if (!isInside(map, x, y)) continue;
        const index = y * map.width + x;
        map.upperTiles[index] = TILE.EMPTY;
        delete map.lowerTileStacks?.[index];
        delete map.upperTileStacks?.[index];
      }
    }
  }
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
      if (tile !== undefined && tile >= 0 && input.skipTiles?.has(tile) !== true) {
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

function placeTwoByTwoTreeIfClear(map: GameMap, origin: TilePoint): void {
  const occupiedPoints = [
    origin,
    { x: origin.x + 1, y: origin.y },
    { x: origin.x, y: origin.y + 1 },
    { x: origin.x + 1, y: origin.y + 1 },
  ] as const satisfies readonly TilePoint[];
  if (occupiedPoints.every((point) => canStackTreeOnPoint(map, point))) placeTwoByTwoTree(map, origin);
}

function canStackTreeOnPoint(map: GameMap, point: TilePoint): boolean {
  if (!isInside(map, point.x, point.y)) return false;
  const index = point.y * map.width + point.x;
  return (
    map.lowerTiles[index] === TILE.GRASS &&
    map.upperTiles[index] === TILE.EMPTY &&
    isTreeStackOrEmpty(map.lowerTileStacks?.[index]) &&
    isTreeStackOrEmpty(map.upperTileStacks?.[index])
  );
}

function isTreeStackOrEmpty(stack: readonly number[] | undefined): boolean {
  return stack === undefined || stack.every((tile) => TREE_STACK_TILES.has(tile));
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

function buildConnectedLHouseVariant(map: GameMap): void {
  const buildPlan = L_SHAPED_SMALL_HOUSE_TEMPLATE_BUILD_PLAN;

  placeFenceRect(map, { origin: buildPlan.fence, width: buildPlan.fence.width, height: buildPlan.fence.height });
  stampHouseBodies(map, [buildPlan.upperHouse, buildPlan.lowerHouse], "plaster", [
    ...buildPlan.upperHouse.windows,
    ...(buildPlan.lowerHouse.windows ?? []),
  ]);
  stampDoor(map, buildPlan.lowerHouse.door);
  paintAutoRoad(map, buildPlan.roads);
}

function buildComplexSteppedHouseVariant(map: GameMap): void {
  const buildPlan = COMPLEX_SMALL_HOUSE_TEMPLATE_BUILD_PLAN;
  const windows: TilePoint[] = buildPlan.houses.flatMap((house) => [...house.windows]);

  placeFenceRect(map, { origin: buildPlan.fence, width: buildPlan.fence.width, height: buildPlan.fence.height });
  stampHouseBodies(map, buildPlan.houses, "plaster", windows);
  stampDoor(map, buildPlan.door);
  paintAutoRoad(map, buildPlan.roads);
}

function buildSmallHouseCity(map: GameMap): void {
  for (const housePlan of SMALL_HOUSE_CITY_BUILD_PLAN.houses) {
    stampHouseBodies(map, housePlan.bodies, "plaster", housePlan.windows);
    stampDoor(map, housePlan.door);
  }
  paintAutoRoad(map, SMALL_HOUSE_CITY_BUILD_PLAN.roads);
  for (const treeOrigin of SMALL_HOUSE_CITY_BUILD_PLAN.treeOrigins) placeTwoByTwoTreeIfClear(map, treeOrigin);
}

function buildPlazaTwoStoryVariant(map: GameMap): void {
  stampRectHouseFromRows(map, { material: "plaster", origin: { x: 4, y: 1 }, width: 10, wallRows: 6 });
  stampDoor(map, { x: 8, topY: 10, bottomY: 11 });
  stampVisibleWindows(map, [{ x: 6, y: 7 }, { x: 10, y: 7 }, { x: 6, y: 9 }, { x: 10, y: 9 }], "plaster");
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
  stampHouseBodies(map, [
    { roof: { origin: { x: 2, y: 1 }, width: 17 }, wall: { origin: { x: 2, y: 5 }, width: 17, rows: 3 }, windows: [] },
    { roof: { origin: { x: 7, y: 5 }, width: 7 }, wall: { origin: { x: 7, y: 9 }, width: 7, rows: 3 }, windows: [] },
  ], material, [
    { x: 4, y: 6 },
    { x: 15, y: 6 },
    { x: 8, y: 11 },
    { x: 12, y: 11 },
  ]);
  stampDoor(map, { x: 10, topY: 12, bottomY: 13 });
  placeFenceRect(map, { origin: { x: 0, y: 0 }, width: 21, height: 18 });
  paintAutoRoad(map, [{ x: 10, y: 14, width: 1, height: 4 }]);
  placeUpperTiles(map, [
    { tile: CONIFER_TOP, x: 1, y: 13 },
    { tile: TILE.TREE, x: 1, y: 14 },
    { tile: CONIFER_TOP, x: 17, y: 13 },
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
