import { DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "./autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE } from "./chipsetMapping";

// 오목 코너 합성 타일(모래 365 / 흙길 362)의 4등분(쿼터) 렌더링 —
// 호수 오토타일과 같은 8×8 쿼터 합성 체계.
// 합성 타일에는 네 귀퉁이 전부에 잔디 바이트가 그려져 있으므로 통짜로 그리면
// 필요 없는 귀퉁이에도 바이트가 보인다. 렌더 시점에 대각 이웃을 보고
// "잔디인 대각 귀퉁이"만 합성 타일의 쿼터를 쓰고, 나머지 귀퉁이는 몸통 쿼터를 쓴다.

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

type InnerCornerKit = {
  readonly inner: number;
  readonly body: number;
  readonly connect: ReadonlySet<number>;
};

const KITS: readonly InnerCornerKit[] = [
  {
    inner: SAND_TILE.INNER_CORNER,
    body: SAND_TILE.BODY,
    connect: new Set<number>(DEFAULT_SAND_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds),
  },
  {
    inner: DIRT_ROAD_TILE.INNER_CORNER,
    body: DIRT_ROAD_TILE.BODY,
    connect: new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds),
  },
];

const QUARTERS = [
  { quarter: "nw", dx: -1, dy: -1, offsetX: 0, offsetY: 0 },
  { quarter: "ne", dx: 1, dy: -1, offsetX: 8, offsetY: 0 },
  { quarter: "sw", dx: -1, dy: 1, offsetX: 0, offsetY: 8 },
  { quarter: "se", dx: 1, dy: 1, offsetX: 8, offsetY: 8 },
] as const satisfies readonly {
  readonly quarter: TerrainQuarter;
  readonly dx: -1 | 1;
  readonly dy: -1 | 1;
  readonly offsetX: 0 | 8;
  readonly offsetY: 0 | 8;
}[];

export function isTerrainInnerCornerTile(tile: number): boolean {
  return KITS.some((kit) => kit.inner === tile);
}

// (x,y)가 오목 코너 합성 타일이면 쿼터 4개의 소스(타일 + 8px 오프셋)를 반환한다.
// 대각이 지형에 연결돼 있으면(모래·물 등) 몸통 쿼터, 끊겨 있으면(잔디) 오목 쿼터.
export function terrainInnerCornerQuarterSources(
  map: TerrainQuarterMap,
  x: number,
  y: number
): readonly TerrainQuarterSource[] | null {
  const tile = tileAt(map, x, y);
  const kit = KITS.find((entry) => entry.inner === tile);
  if (!kit) return null;
  return QUARTERS.map((quarter) => ({
    quarter: quarter.quarter,
    tile: connectedAt(map, kit, x + quarter.dx, y + quarter.dy) ? kit.body : kit.inner,
    offsetX: quarter.offsetX,
    offsetY: quarter.offsetY,
  }));
}

function connectedAt(map: TerrainQuarterMap, kit: InnerCornerKit, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  return typeof tile === "number" && kit.connect.has(tile);
}

function tileAt(map: TerrainQuarterMap, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.lowerTiles[y * map.width + x];
}
