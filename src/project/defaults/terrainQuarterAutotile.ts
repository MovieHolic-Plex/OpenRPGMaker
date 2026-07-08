import { DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "./autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE } from "./chipsetMapping";

// 모래/흙길 지형의 RM2003식 8×8 쿼터 합성 렌더링.
// 저장 타일 ID는 기존 9-슬라이스 결과를 유지하고, 렌더 시점에 각 쿼터가 필요한
// 소스 타일의 같은 위치 쿼터를 가져와 1칸 폭 길/해변도 양쪽 프린지를 함께 보이게 한다.

export type TerrainQuarter = "nw" | "ne" | "sw" | "se";

export type TerrainQuarterSource = {
  readonly quarter: TerrainQuarter;
  readonly tile: number;
  readonly offsetX: 0 | 8;
  readonly offsetY: 0 | 8;
};

type TerrainQuarterMap = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
};

type TerrainQuarterKit = {
  readonly body: number;
  readonly bodyAlt?: number;
  readonly edgeNorth: number;
  readonly edgeSouth: number;
  readonly edgeWest: number;
  readonly edgeEast: number;
  readonly cornerNorthWest: number;
  readonly cornerNorthEast: number;
  readonly cornerSouthWest: number;
  readonly cornerSouthEast: number;
  readonly inner: number;
  readonly isolated?: number;
  readonly targetTiles: readonly number[];
  readonly connect: ReadonlySet<number>;
};

type QuarterContext = {
  readonly quarter: TerrainQuarter;
  readonly verticalConnected: boolean;
  readonly horizontalConnected: boolean;
  readonly diagonalConnected: boolean;
};

const SAND_TARGET_TILES = [
  SAND_TILE.BODY,
  SAND_TILE.EDGE_NORTH,
  SAND_TILE.EDGE_SOUTH,
  SAND_TILE.EDGE_WEST,
  SAND_TILE.EDGE_EAST,
  SAND_TILE.CORNER_NORTH_WEST,
  SAND_TILE.CORNER_NORTH_EAST,
  SAND_TILE.CORNER_SOUTH_WEST,
  SAND_TILE.CORNER_SOUTH_EAST,
  SAND_TILE.INNER_CORNER,
] as const;

const ROAD_TARGET_TILES = [
  DIRT_ROAD_TILE.BODY,
  DIRT_ROAD_TILE.BODY_ALT,
  DIRT_ROAD_TILE.EDGE_NORTH,
  DIRT_ROAD_TILE.EDGE_SOUTH,
  DIRT_ROAD_TILE.EDGE_WEST,
  DIRT_ROAD_TILE.EDGE_EAST,
  DIRT_ROAD_TILE.CORNER_NORTH_WEST,
  DIRT_ROAD_TILE.CORNER_NORTH_EAST,
  DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
  DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
  DIRT_ROAD_TILE.INNER_CORNER,
] as const;

const KITS: readonly TerrainQuarterKit[] = [
  {
    body: SAND_TILE.BODY,
    edgeNorth: SAND_TILE.EDGE_NORTH,
    edgeSouth: SAND_TILE.EDGE_SOUTH,
    edgeWest: SAND_TILE.EDGE_WEST,
    edgeEast: SAND_TILE.EDGE_EAST,
    cornerNorthWest: SAND_TILE.CORNER_NORTH_WEST,
    cornerNorthEast: SAND_TILE.CORNER_NORTH_EAST,
    cornerSouthWest: SAND_TILE.CORNER_SOUTH_WEST,
    cornerSouthEast: SAND_TILE.CORNER_SOUTH_EAST,
    inner: SAND_TILE.INNER_CORNER,
    targetTiles: SAND_TARGET_TILES,
    connect: new Set<number>(DEFAULT_SAND_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds),
  },
  {
    body: DIRT_ROAD_TILE.BODY,
    bodyAlt: DIRT_ROAD_TILE.BODY_ALT,
    edgeNorth: DIRT_ROAD_TILE.EDGE_NORTH,
    edgeSouth: DIRT_ROAD_TILE.EDGE_SOUTH,
    edgeWest: DIRT_ROAD_TILE.EDGE_WEST,
    edgeEast: DIRT_ROAD_TILE.EDGE_EAST,
    cornerNorthWest: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
    cornerNorthEast: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
    cornerSouthWest: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
    cornerSouthEast: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
    inner: DIRT_ROAD_TILE.INNER_CORNER,
    isolated: DIRT_ROAD_TILE.ISOLATED,
    targetTiles: ROAD_TARGET_TILES,
    connect: new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds),
  },
];

const TERRAIN_QUARTER_TILES = new Set<number>(KITS.flatMap((kit) => kit.targetTiles));

const QUARTERS = [
  {
    quarter: "nw",
    vertical: { dx: 0, dy: -1 },
    horizontal: { dx: -1, dy: 0 },
    diagonal: { dx: -1, dy: -1 },
    offsetX: 0,
    offsetY: 0,
  },
  {
    quarter: "ne",
    vertical: { dx: 0, dy: -1 },
    horizontal: { dx: 1, dy: 0 },
    diagonal: { dx: 1, dy: -1 },
    offsetX: 8,
    offsetY: 0,
  },
  {
    quarter: "sw",
    vertical: { dx: 0, dy: 1 },
    horizontal: { dx: -1, dy: 0 },
    diagonal: { dx: -1, dy: 1 },
    offsetX: 0,
    offsetY: 8,
  },
  {
    quarter: "se",
    vertical: { dx: 0, dy: 1 },
    horizontal: { dx: 1, dy: 0 },
    diagonal: { dx: 1, dy: 1 },
    offsetX: 8,
    offsetY: 8,
  },
] as const satisfies readonly {
  readonly quarter: TerrainQuarter;
  readonly vertical: { readonly dx: 0; readonly dy: -1 | 1 };
  readonly horizontal: { readonly dx: -1 | 1; readonly dy: 0 };
  readonly diagonal: { readonly dx: -1 | 1; readonly dy: -1 | 1 };
  readonly offsetX: 0 | 8;
  readonly offsetY: 0 | 8;
}[];

export function isTerrainQuarterTile(tile: number): boolean {
  return TERRAIN_QUARTER_TILES.has(tile);
}

// (x,y)가 쿼터 합성 대상이면 쿼터 4개의 소스(타일 + 8px 오프셋)를 반환한다.
// 계산 결과가 저장 타일의 같은 위치 쿼터 4개와 같으면 통짜 렌더로 충분하므로 null.
export function terrainQuarterSources(
  map: TerrainQuarterMap,
  x: number,
  y: number
): readonly TerrainQuarterSource[] | null {
  const tile = tileAt(map, x, y);
  if (typeof tile !== "number") return null;
  const kit = KITS.find((entry) => entry.targetTiles.includes(tile));
  if (!kit) return null;
  if (isBodyAltIsolatedArt(map, kit, tile, x, y)) return null;
  const sources = QUARTERS.map((quarter) =>
    quarterSource(kit, {
      quarter: quarter.quarter,
      verticalConnected: connectedAt(map, kit, x + quarter.vertical.dx, y + quarter.vertical.dy),
      horizontalConnected: connectedAt(map, kit, x + quarter.horizontal.dx, y + quarter.horizontal.dy),
      diagonalConnected: connectedAt(map, kit, x + quarter.diagonal.dx, y + quarter.diagonal.dy),
    }, quarter.offsetX, quarter.offsetY)
  );
  return sources.every((source) => source.tile === tile) ? null : sources;
}

function isBodyAltIsolatedArt(
  map: TerrainQuarterMap,
  kit: TerrainQuarterKit,
  tile: number,
  x: number,
  y: number
): boolean {
  // 현재 기본 흙길 편집 타일(TILE.PATH)과 외딴 흙길 아트가 모두 360이다.
  // 인접 흙길이 없는 360은 BODY_ALT가 아니라 외딴 아트로 보고 통짜 렌더를 유지한다.
  if (kit.bodyAlt !== tile || kit.isolated !== tile) return false;
  return !(
    connectedAt(map, kit, x, y - 1) ||
    connectedAt(map, kit, x, y + 1) ||
    connectedAt(map, kit, x - 1, y) ||
    connectedAt(map, kit, x + 1, y)
  );
}

function quarterSource(
  kit: TerrainQuarterKit,
  context: QuarterContext,
  offsetX: 0 | 8,
  offsetY: 0 | 8
): TerrainQuarterSource {
  return {
    quarter: context.quarter,
    tile: quarterTile(kit, context),
    offsetX,
    offsetY,
  };
}

function quarterTile(kit: TerrainQuarterKit, context: QuarterContext): number {
  if (!context.verticalConnected && !context.horizontalConnected) return cornerTile(kit, context.quarter);
  if (!context.verticalConnected) return horizontalEdgeTile(kit, context.quarter);
  if (!context.horizontalConnected) return verticalEdgeTile(kit, context.quarter);
  if (!context.diagonalConnected) return kit.inner;
  return kit.body;
}

function cornerTile(kit: TerrainQuarterKit, quarter: TerrainQuarter): number {
  if (quarter === "nw") return kit.cornerNorthWest;
  if (quarter === "ne") return kit.cornerNorthEast;
  if (quarter === "sw") return kit.cornerSouthWest;
  return kit.cornerSouthEast;
}

function horizontalEdgeTile(kit: TerrainQuarterKit, quarter: TerrainQuarter): number {
  return quarter === "nw" || quarter === "ne" ? kit.edgeNorth : kit.edgeSouth;
}

function verticalEdgeTile(kit: TerrainQuarterKit, quarter: TerrainQuarter): number {
  return quarter === "nw" || quarter === "sw" ? kit.edgeWest : kit.edgeEast;
}

function connectedAt(map: TerrainQuarterMap, kit: TerrainQuarterKit, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  return typeof tile === "number" && kit.connect.has(tile);
}

function tileAt(map: TerrainQuarterMap, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.lowerTiles[y * map.width + x];
}
