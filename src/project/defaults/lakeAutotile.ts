import { animationStripForTile } from "./chipsetAnimation";
import { CHIPSET_TILE_GROUPS } from "./chipsetMapping";
import { worldCoastAutotileGroup, isWorldTileset } from "./worldCoastMapping";
import { isWorldSnowTerrain } from "./worldTerrainAutotiles";
import type { TilesetDef } from "../types";

/**
 * Combined Town 타일 그림판 물 블록 (col 0–2):
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

/**
 * 물 스킨(2026-07-17 사용자 정본) — 물 시스템은 하나고 "물가 스킨"이 여럿이다.
 * 열 0~2 = 잔디 물가, 열 3~5 = 석축 수로. 행별 역할이 정확히 평행하고 몸통(120)은 공용:
 *   볼록 0↔3 · 세로 변 30↔33 · 가로 변 60↔63 · 오목 90↔93.
 * 수로는 전부 타일 3으로 저장하고(호수=0 저장과 동일) 렌더가 쿼터로 역할을 복원한다.
 */
export interface WaterShoreSkin {
  readonly OUTER_CORNER: number;
  readonly INNER_CORNER: number;
  readonly EDGE_WEST: number;
  readonly EDGE_NORTH: number;
  readonly EDGE_SOUTH: number;
  readonly BODY: number;
}

export const CANAL_AUTOTILE_TILE: WaterShoreSkin = {
  OUTER_CORNER: 3,
  INNER_CORNER: 93,
  EDGE_WEST: 33,
  EDGE_NORTH: 63,
  EDGE_SOUTH: 63,
  BODY: 120,
};

// 수로 프레임 타일(애니 3프레임 포함) — 저장 타일이 이 집합이면 수로 스킨으로 렌더.
const CANAL_FRAME_TILES = new Set<number>([3, 4, 5, 33, 34, 35, 63, 64, 65, 93, 94, 95]);

function skinForStoredTile(tile: number | undefined): WaterShoreSkin {
  return typeof tile === "number" && CANAL_FRAME_TILES.has(tile) ? CANAL_AUTOTILE_TILE : LAKE_AUTOTILE_TILE;
}

export type LakeAutotileQuarter = "nw" | "ne" | "sw" | "se";

export type LakeAutotileQuarterSource = {
  /** 맵 셀 안 배치 위치. */
  readonly quarter: LakeAutotileQuarter;
  /** 타일 그림판 타일에서 자를 8×8. */
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
  // 수로 프레임도 같은 물 시스템 — 호수·수로가 서로 물로 연결되고 쿼터 렌더를 공유한다.
  ...CANAL_FRAME_TILES,
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

export function isLakeAutotileTile(tile: number, tileset?: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">): boolean {
  if (isWorldTileset(tileset)) return Boolean(worldCoastAutotileGroup(tileset!)?.memberTileIds.includes(tile));
  return LAKE_AUTOTILE_TILES.has(tile);
}

export function lakeAutotileQuarterSources(
  map: LakeAutotileMap,
  x: number,
  y: number,
  tileset?: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">,
): readonly LakeAutotileQuarterSource[] {
  // 스킨은 저장 타일이 결정 — 수로 프레임(3 패밀리)이면 석축 스킨, 아니면 잔디 물가.
  const world = isWorldTileset(tileset);
  const coast = world ? worldCoastAutotileGroup(tileset!) : undefined;
  const skin = world ? LAKE_AUTOTILE_TILE : skinForStoredTile(map.lowerTiles[y * map.width + x]);
  const waterAt = (px: number, py: number) => hasLakeWater(map, px, py, world, coast?.connectTileIds);
  const north = waterAt(x, y - 1);
  const south = waterAt(x, y + 1);
  const west = waterAt(x - 1, y);
  const east = waterAt(x + 1, y);
  const snowSkin = (dx: number, dy: number): WaterShoreSkin => {
    // A retained v1 coast owns only grass shores. Do not sample snow art owned
    // by another group (or replaced with a graft) merely because snow is nearby.
    if (!world || !coast?.memberTileIds.includes(3)) return skin;
    const verticalWater = waterAt(x, y + dy), horizontalWater = waterAt(x + dx, y);
    // Only the land that contributes this quarter's visible shore selects its skin.
    // A diagonal snow cell must not recolor a straight grass shore.
    const borders = !verticalWater && !horizontalWater ? [[x, y + dy], [x + dx, y]]
      : !verticalWater ? [[x, y + dy]] : !horizontalWater ? [[x + dx, y]] : [[x + dx, y + dy]];
    const snowy = borders.some(([px, py]) => px! >= 0 && py! >= 0 && px! < map.width && py! < map.height
      && isWorldSnowTerrain(map.lowerTiles[py! * map.width + px!]!));
    return snowy ? CANAL_AUTOTILE_TILE : skin;
  };
  return [
    quarterSource(snowSkin(-1, -1), {
      quarter: "nw",
      verticalWater: north,
      horizontalWater: west,
      diagonalWater: waterAt(x - 1, y - 1),
    }),
    quarterSource(snowSkin(1, -1), {
      quarter: "ne",
      verticalWater: north,
      horizontalWater: east,
      diagonalWater: waterAt(x + 1, y - 1),
    }),
    quarterSource(snowSkin(-1, 1), {
      quarter: "sw",
      verticalWater: south,
      horizontalWater: west,
      diagonalWater: waterAt(x - 1, y + 1),
    }),
    quarterSource(snowSkin(1, 1), {
      quarter: "se",
      verticalWater: south,
      horizontalWater: east,
      diagonalWater: waterAt(x + 1, y + 1),
    }),
  ];
}

function quarterSource(skin: WaterShoreSkin, context: QuarterContext): LakeAutotileQuarterSource {
  const tile = quarterTile(skin, context);
  const sourceQuarter = sourceQuarterForLakeChip(tile, context.quarter, context);
  return {
    quarter: context.quarter,
    sourceQuarter,
    tile,
    ...QUARTER_GEOMETRY[context.quarter],
  };
}

function quarterTile(skin: WaterShoreSkin, context: QuarterContext): number {
  // 바깥 모서리: 수직·수평 둘 다 땅
  if (!context.verticalWater && !context.horizontalWater) return skin.OUTER_CORNER;
  // 직선 가장자리: 한쪽만 땅
  if (!context.verticalWater) return verticalEdgeTile(skin, context.quarter);
  if (!context.horizontalWater) return skin.EDGE_WEST;
  // 직교 이웃은 물인데 대각만 땅 → 오목(inner) 모서리 — 90/91/92 (수로는 93/94/95)
  if (!context.diagonalWater) return skin.INNER_CORNER;
  return skin.BODY;
}

function verticalEdgeTile(skin: WaterShoreSkin, quarter: LakeAutotileQuarter): number {
  // 북·남 직선 가장자리는 같은 스트립 (상단/하단 소스로 구분)
  return quarter === "nw" || quarter === "ne" ? skin.EDGE_NORTH : skin.EDGE_SOUTH;
}

/**
 * 타일 그림판 소스 8×8 선택.
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

function hasLakeWater(map: LakeAutotileMap, x: number, y: number, world: boolean, worldConnections?: readonly number[]): boolean {
  // The world canvas ends in open ocean, not an invented strip of land.
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return world;
  const tile = map.lowerTiles[y * map.width + x];
  return typeof tile === "number" && (world ? Boolean(worldConnections?.includes(tile)) : isLakeAutotileTile(tile));
}
