import { CHIPSET_TILE_GROUPS } from "./chipsetMapping";

export const LAKE_AUTOTILE_TILE = {
  OUTER_CORNER: 0,
  INNER_CORNER: 0,
  EDGE_WEST: 30,
  EDGE_NORTH: 60,
  EDGE_SOUTH: 90,
  BODY: 120,
} as const;

export type LakeAutotileQuarter = "nw" | "ne" | "sw" | "se";

export type LakeAutotileQuarterSource = {
  readonly quarter: LakeAutotileQuarter;
  readonly tile: number;
  readonly offsetX: 0 | 8;
  readonly offsetY: 0 | 8;
};

type LakeAutotileMap = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
};

type QuarterContext = {
  readonly quarter: LakeAutotileQuarter;
  readonly verticalWater: boolean;
  readonly horizontalWater: boolean;
  readonly diagonalWater: boolean;
};

const LAKE_AUTOTILE_TILES = new Set<number>([
  ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
]);

const QUARTER_GEOMETRY = {
  nw: { offsetX: 0, offsetY: 0 },
  ne: { offsetX: 8, offsetY: 0 },
  sw: { offsetX: 0, offsetY: 8 },
  se: { offsetX: 8, offsetY: 8 },
} as const satisfies Record<
  LakeAutotileQuarter,
  Pick<LakeAutotileQuarterSource, "offsetX" | "offsetY">
>;

export function isLakeAutotileTile(tile: number): boolean {
  return LAKE_AUTOTILE_TILES.has(tile);
}

export function lakeAutotileQuarterSources(
  map: LakeAutotileMap,
  x: number,
  y: number
): readonly LakeAutotileQuarterSource[] {
  const north = hasLakeWater(map, x, y - 1);
  const south = hasLakeWater(map, x, y + 1);
  const west = hasLakeWater(map, x - 1, y);
  const east = hasLakeWater(map, x + 1, y);
  return [
    quarterSource({
      quarter: "nw",
      verticalWater: north,
      horizontalWater: west,
      diagonalWater: hasLakeWater(map, x - 1, y - 1),
    }),
    quarterSource({
      quarter: "ne",
      verticalWater: north,
      horizontalWater: east,
      diagonalWater: hasLakeWater(map, x + 1, y - 1),
    }),
    quarterSource({
      quarter: "sw",
      verticalWater: south,
      horizontalWater: west,
      diagonalWater: hasLakeWater(map, x - 1, y + 1),
    }),
    quarterSource({
      quarter: "se",
      verticalWater: south,
      horizontalWater: east,
      diagonalWater: hasLakeWater(map, x + 1, y + 1),
    }),
  ];
}

function quarterSource(context: QuarterContext): LakeAutotileQuarterSource {
  return {
    quarter: context.quarter,
    tile: quarterTile(context),
    ...QUARTER_GEOMETRY[context.quarter],
  };
}

function quarterTile(context: QuarterContext): number {
  if (!context.verticalWater && !context.horizontalWater) return LAKE_AUTOTILE_TILE.OUTER_CORNER;
  if (!context.verticalWater) return verticalEdgeTile(context.quarter);
  if (!context.horizontalWater) return LAKE_AUTOTILE_TILE.EDGE_WEST;
  if (!context.diagonalWater) return LAKE_AUTOTILE_TILE.INNER_CORNER;
  return LAKE_AUTOTILE_TILE.BODY;
}

function verticalEdgeTile(quarter: LakeAutotileQuarter): number {
  return quarter === "nw" || quarter === "ne" ? LAKE_AUTOTILE_TILE.EDGE_NORTH : LAKE_AUTOTILE_TILE.EDGE_SOUTH;
}

function hasLakeWater(map: LakeAutotileMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = map.lowerTiles[y * map.width + x];
  return typeof tile === "number" && isLakeAutotileTile(tile);
}
