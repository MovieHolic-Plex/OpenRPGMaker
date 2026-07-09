import { animationStripForTile } from "./chipsetAnimation";
import { CHIPSET_TILE_GROUPS } from "./chipsetMapping";

/**
 * Combined Town 칩셋 물 블록 (col 0–2):
 *   row0  0/1/2   → outer corner (통짜 연못 모서리)
 *   row1 30/31/32 → vertical edge (동·서)
 *   row2 60/61/62 → horizontal edge (남·북) — 같은 타일, 소스 쿼터로 구분
 *   row3 90/91/92 → inner corner (오목 모서리) — 직선 가장자리 아님!
 *   row4 120…     → body
 */
export const LAKE_AUTOTILE_TILE = {
  OUTER_CORNER: 0,
  INNER_CORNER: 90,
  EDGE_WEST: 30,
  EDGE_NORTH: 60,
  EDGE_SOUTH: 60,
  BODY: 120,
} as const;

export type LakeAutotileQuarter = "nw" | "ne" | "sw" | "se";

export type LakeAutotileQuarterSource = {
  /** 맵 셀 안 배치 위치. */
  readonly quarter: LakeAutotileQuarter;
  /** 칩셋 타일에서 자를 8×8. */
  readonly sourceQuarter: LakeAutotileQuarter;
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
  const tile = quarterTile(context);
  const sourceQuarter = sourceQuarterForLakeChip(tile, context.quarter, context);
  return {
    quarter: context.quarter,
    sourceQuarter,
    tile,
    ...QUARTER_GEOMETRY[context.quarter],
  };
}

function quarterTile(context: QuarterContext): number {
  // 바깥 모서리: 수직·수평 둘 다 땅
  if (!context.verticalWater && !context.horizontalWater) return LAKE_AUTOTILE_TILE.OUTER_CORNER;
  // 직선 가장자리: 한쪽만 땅
  if (!context.verticalWater) return verticalEdgeTile(context.quarter);
  if (!context.horizontalWater) return LAKE_AUTOTILE_TILE.EDGE_WEST;
  // 직교 이웃은 물인데 대각만 땅 → 오목(inner) 모서리 — 90/91/92
  if (!context.diagonalWater) return LAKE_AUTOTILE_TILE.INNER_CORNER;
  return LAKE_AUTOTILE_TILE.BODY;
}

function verticalEdgeTile(quarter: LakeAutotileQuarter): number {
  // 북·남 직선 가장자리는 같은 60 스트립 (상단/하단 소스로 구분)
  return quarter === "nw" || quarter === "ne" ? LAKE_AUTOTILE_TILE.EDGE_NORTH : LAKE_AUTOTILE_TILE.EDGE_SOUTH;
}

/**
 * 칩셋 소스 8×8 선택.
 *
 * Combined Town 물 블록:
 *   0  = outer, 30 = 세로 가장자리, 60 = 가로 가장자리, 90 = inner only, 120 = body
 *
 * 직선 가장자리 규칙 (inner 90 금지):
 * - 남쪽 (아래만 땅): tile 60 + 하단 소스 sw/se
 * - 북쪽 (위만 땅):   tile 60 + 상단 소스 nw/ne
 * - 서쪽 (왼쪽만 땅): tile 30 + 좌측 소스 nw/sw
 * - 동쪽 (오른쪽만 땅): tile 30 + 우측 소스 ne/se  ← dest와 동일 열 (좌우 뒤집지 말 것)
 * - inner (직교는 물, 대각만 땅): tile 90 + dest와 동일 코너
 */
export function sourceQuarterForLakeChip(
  tile: number,
  destQuarter: LakeAutotileQuarter,
  _context?: Pick<QuarterContext, "verticalWater" | "horizontalWater" | "diagonalWater">,
): LakeAutotileQuarter {
  const base = animationStripForTile(tile)?.baseTile ?? tile;

  // 90 = INNER corner only — 직선 가장자리에 쓰면 안 됨
  if (base === LAKE_AUTOTILE_TILE.INNER_CORNER) {
    return destQuarter;
  }

  // 60 = 가로 가장자리 (N/S). dest 상단↔소스 상단, dest 하단↔소스 하단
  if (base === 60 || base === LAKE_AUTOTILE_TILE.EDGE_NORTH) {
    return destQuarter;
  }

  // 30 = 세로 가장자리 (W/E). dest 왼쪽↔소스 왼쪽, dest 오른쪽↔소스 오른쪽
  // (예: (30,25) 동쪽 직선 — ne/se 자리에 30의 ne/se, 절대 nw로 뒤집지 않음)
  if (base === LAKE_AUTOTILE_TILE.EDGE_WEST) {
    return destQuarter;
  }

  return destQuarter;
}

function hasLakeWater(map: LakeAutotileMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = map.lowerTiles[y * map.width + x];
  return typeof tile === "number" && isLakeAutotileTile(tile);
}
