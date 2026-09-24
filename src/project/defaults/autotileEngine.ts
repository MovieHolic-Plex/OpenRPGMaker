import type { AutotileGroup, AutotileNeighborhood, GameMap } from "../types";
import type { TileLayerNo } from "../mapLayers";

// 범용 오토타일(지형 자동 연결) 엔진 — 순수 로직.
// 이웃 연결 상태를 비트마스크로 계산하고 variantMap 조회로 배치 타일을 결정한다.
// DOM/스토어에 의존하지 않아 단위 테스트가 쉽다.

// 방향 비트. 하위 4비트(N/E/S/W)는 4방향 오토타일에서, 상위 4비트는 8방향에서 사용.
export const AUTOTILE_DIR = {
  N: 1,
  E: 2,
  S: 4,
  W: 8,
  NE: 16,
  SE: 32,
  SW: 64,
  NW: 128,
} as const;

// 엔진이 다루는 맵 뷰(가변 lowerTiles). GameMap 이 그대로 만족한다.
export interface AutotileMapView {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: number[];
}

/**
 * 한 층(1~4)의 배열을 엔진 뷰로 빌려준다 — 엔진은 `lowerTiles` 이름으로 읽고 쓰지만 실제로는 고른 층이다.
 * 1층 = lowerTiles, 3층 = upperTiles, 2·4층 = 선택 칸(lowerOverlayTiles/upperOverlayTiles).
 * 2·4층 칸이 없는 맵에는 맵에 붙지 않은 빈 배열(-1)을 준다 — 빈칸엔 그룹 멤버가 없어 엔진이 쓰지 않으므로
 * 옛 맵에 새 키가 생기지 않는다. 2·4층에 멤버를 칠하면(setLayerTileAt) 그때 배열이 생기고 이 뷰가 그 배열을 쓴다.
 * 층 번호와 칸 이름의 대응은 mapLayers.ts 가 정본이다.
 */
export function autotileLayerView(map: GameMap, layer: TileLayerNo): AutotileMapView {
  const { width, height } = map;
  if (layer === 1) return { width, height, lowerTiles: map.lowerTiles };
  if (layer === 3) return { width, height, lowerTiles: map.upperTiles };
  const tiles = layer === 2 ? map.lowerOverlayTiles : map.upperOverlayTiles;
  return { width, height, lowerTiles: tiles ?? new Array<number>(width * height).fill(-1) };
}

export interface AutotilePoint {
  readonly x: number;
  readonly y: number;
}

// 편집 지점 + 상하좌우를 재검사한다(기존 shapeRoadAround/shapeSandAround 와 동일한 오프셋/순서).
const RECHECK_OFFSETS: readonly AutotilePoint[] = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

// 8방향 그룹은 대각 이웃의 오목 코너 판정도 바뀌므로 대각까지 재검사한다.
const RECHECK_OFFSETS_8: readonly AutotilePoint[] = [
  ...RECHECK_OFFSETS,
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// 9분류(몸통/4변/4모서리) 오토타일 타일 매핑 기술자.
export interface EdgeCornerTileSet {
  readonly body: number;
  readonly edgeN: number;
  readonly edgeS: number;
  readonly edgeW: number;
  readonly edgeE: number;
  readonly cornerNW: number;
  readonly cornerNE: number;
  readonly cornerSW: number;
  readonly cornerSE: number;
}

// 4방향 이웃 유무(N/E/S/W)로 9분류 타일을 결정한다.
// 기존 tileForRoadCell/tileForSandCell 의 판정 순서를 그대로 재현한다.
function edgeCornerTile(tiles: EdgeCornerTileSet, north: boolean, east: boolean, south: boolean, west: boolean): number {
  const missingNorth = !north;
  const missingSouth = !south;
  const missingWest = !west;
  const missingEast = !east;

  if (missingNorth && missingWest) return tiles.cornerNW;
  if (missingNorth && missingEast) return tiles.cornerNE;
  if (missingSouth && missingWest) return tiles.cornerSW;
  if (missingSouth && missingEast) return tiles.cornerSE;
  if (missingNorth) return tiles.edgeN;
  if (missingSouth) return tiles.edgeS;
  if (missingWest) return tiles.edgeW;
  if (missingEast) return tiles.edgeE;
  return tiles.body;
}

// 9분류 기술자로 16개(4비트) variantMap 을 생성한다.
export function buildEdgeCornerVariantMap(tiles: EdgeCornerTileSet): Record<string, number> {
  const variantMap: Record<string, number> = {};
  for (let mask = 0; mask < 16; mask += 1) {
    const north = (mask & AUTOTILE_DIR.N) !== 0;
    const east = (mask & AUTOTILE_DIR.E) !== 0;
    const south = (mask & AUTOTILE_DIR.S) !== 0;
    const west = (mask & AUTOTILE_DIR.W) !== 0;
    variantMap[String(mask)] = edgeCornerTile(tiles, north, east, south, west);
  }
  return variantMap;
}

// 11분류(9분류 + 외딴 점 + 오목 코너) 오토타일 매핑 기술자.
// isolated: 상하좌우가 전부 결손인 1칸 웅덩이(예: 모래 363, 흙길 360).
// inner: 상하좌우는 전부 연결인데 대각선에 결손이 있는 오목 코너 합성 타일(예: 모래 365, 흙길 362).
export interface EdgeCornerInnerTileSet extends EdgeCornerTileSet {
  readonly isolated: number;
  readonly inner: number;
}

// 11분류 기술자로 256개(8비트) variantMap 을 생성한다. neighborhood: 8 그룹 전용.
export function buildEdgeCornerInnerVariantMap(tiles: EdgeCornerInnerTileSet): Record<string, number> {
  const variantMap: Record<string, number> = {};
  for (let mask = 0; mask < 256; mask += 1) {
    const north = (mask & AUTOTILE_DIR.N) !== 0;
    const east = (mask & AUTOTILE_DIR.E) !== 0;
    const south = (mask & AUTOTILE_DIR.S) !== 0;
    const west = (mask & AUTOTILE_DIR.W) !== 0;
    if (!north && !east && !south && !west) {
      variantMap[String(mask)] = tiles.isolated;
      continue;
    }
    if (north && east && south && west) {
      const allDiagonals =
        (mask & AUTOTILE_DIR.NE) !== 0 &&
        (mask & AUTOTILE_DIR.SE) !== 0 &&
        (mask & AUTOTILE_DIR.SW) !== 0 &&
        (mask & AUTOTILE_DIR.NW) !== 0;
      variantMap[String(mask)] = allDiagonals ? tiles.body : tiles.inner;
      continue;
    }
    variantMap[String(mask)] = edgeCornerTile(tiles, north, east, south, west);
  }
  return variantMap;
}

function inBounds(map: AutotileMapView, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function tileAt(map: AutotileMapView, x: number, y: number): number | undefined {
  if (!inBounds(map, x, y)) return undefined;
  return map.lowerTiles[y * map.width + x];
}

// (x,y) 셀의 이웃 연결 비트마스크를 계산한다.
export function autotileNeighborMask(
  map: AutotileMapView,
  x: number,
  y: number,
  isConnected: (tile: number) => boolean,
  neighborhood: AutotileNeighborhood = 4,
  outsideConnects = false,
): number {
  const connectedAt = (dx: number, dy: number): boolean => {
    const nx = x + dx;
    const ny = y + dy;
    if (outsideConnects && (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height)) return true;
    const tile = tileAt(map, nx, ny);
    return typeof tile === "number" && isConnected(tile);
  };
  let mask = 0;
  if (connectedAt(0, -1)) mask |= AUTOTILE_DIR.N;
  if (connectedAt(1, 0)) mask |= AUTOTILE_DIR.E;
  if (connectedAt(0, 1)) mask |= AUTOTILE_DIR.S;
  if (connectedAt(-1, 0)) mask |= AUTOTILE_DIR.W;
  if (neighborhood === 8) {
    if (connectedAt(1, -1)) mask |= AUTOTILE_DIR.NE;
    if (connectedAt(1, 1)) mask |= AUTOTILE_DIR.SE;
    if (connectedAt(-1, 1)) mask |= AUTOTILE_DIR.SW;
    if (connectedAt(-1, -1)) mask |= AUTOTILE_DIR.NW;
  }
  return mask;
}

/** 그룹이 이웃을 세고 모양을 바꾸는 레이어. 생략 = lower. */
export function autotileGroupLayer(group: AutotileGroup): "lower" | "upper" {
  return group.layer === "upper" ? "upper" : "lower";
}

/**
 * 그룹의 레이어를 엔진이 읽는 `lowerTiles` 자리에 둔 뷰. 같은 배열을 가리키므로 엔진이 쓰면 맵이 제자리에서 바뀐다.
 * upper 그룹(바닥 위에 겹치는 투명 오토타일)도 엔진을 그대로 쓰게 하는 한 줄짜리 어댑터다.
 */
export function autotileGroupLayerView(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[]; readonly upperTiles: number[] },
  group: AutotileGroup,
): AutotileMapView {
  return autotileGroupLayer(group) === "upper" ? { width: map.width, height: map.height, lowerTiles: map.upperTiles } : map;
}

// 비트마스크에 매핑된 변형 타일. 없으면 undefined.
export function autotileVariantForMask(group: AutotileGroup, mask: number): number | undefined {
  const value = group.variantMap[String(mask)];
  return typeof value === "number" ? value : undefined;
}

function connectSet(group: AutotileGroup): ReadonlySet<number> {
  return new Set<number>(group.connectTileIds ?? group.memberTileIds);
}

function triggerSet(group: AutotileGroup): ReadonlySet<number> {
  return new Set<number>(group.triggerTileIds ?? group.connectTileIds ?? group.memberTileIds);
}

// (x,y) 가 그룹 멤버 타일일 때 이웃 기반으로 결정된 변형 타일. 아니면 undefined.
export function autotileVariantForCell(map: AutotileMapView, group: AutotileGroup, x: number, y: number): number | undefined {
  const current = tileAt(map, x, y);
  if (typeof current !== "number") return undefined;
  const members = new Set<number>(group.memberTileIds);
  if (!members.has(current)) return undefined;
  const connect = connectSet(group);
  const mask = autotileNeighborMask(map, x, y, (tile) => connect.has(tile), group.neighborhood ?? 4, group.outsideConnects === true);
  return autotileVariantForMask(group, mask);
}

// 편집된 이전/다음 타일이 이 그룹의 재계산을 유발하는지 판정한다.
export function autotileEditTriggersGroup(group: AutotileGroup, previousTile: number | undefined, nextTile: number): boolean {
  const triggers = triggerSet(group);
  if (triggers.has(nextTile)) return true;
  return previousTile !== undefined && triggers.has(previousTile);
}

// 편집 지점 주변의 그룹 멤버 셀을 재계산하여 lowerTiles 를 갱신한다.
// 기존 shapeRoadAround/shapeSandAround 와 동일한 방문/재검사 규칙을 따른다.
export function shapeAutotileGroupAround(
  map: AutotileMapView,
  group: AutotileGroup,
  points: readonly AutotilePoint[],
  canWrite?: (x: number, y: number) => boolean
): void {
  const members = new Set<number>(group.memberTileIds);
  const connect = connectSet(group);
  const isConnected = (tile: number): boolean => connect.has(tile);
  const neighborhood = group.neighborhood ?? 4;
  const offsets = neighborhood === 8 ? RECHECK_OFFSETS_8 : RECHECK_OFFSETS;
  // A depth variant of the full cell is already right for a full mask; only shadeAutotileInterior re-picks it.
  const interior = new Set((group.interiorVariants ?? []).flat());
  const full = group.variantMap[String(neighborhood === 8 ? 255 : 15)];
  const visited = new Set<string>();
  for (const point of points) {
    for (const offset of offsets) {
      const cx = point.x + offset.x;
      const cy = point.y + offset.y;
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (canWrite && !canWrite(cx, cy)) continue;
      const current = tileAt(map, cx, cy);
      if (typeof current !== "number" || !members.has(current)) continue;
      const mask = autotileNeighborMask(map, cx, cy, isConnected, neighborhood, group.outsideConnects === true);
      const variant = autotileVariantForMask(group, mask);
      if (variant === full && interior.has(current)) continue;
      if (typeof variant === "number") map.lowerTiles[cy * map.width + cx] = variant;
    }
  }
}

/**
 * 편집 칸 둘레의 **모든** 오토타일 그룹을 제 레이어에서 다시 맞춘다. 흙 공터 안에 잔디를 채우면
 * 잔디만이 아니라 둘레 흙 칸도 가장자리 모양으로 바뀌어야 한다 — 칠한 재료만 맞추면 경계가 칼로 자른 직선이 된다
 * (2026-09-25 MV 팩 헤드리스 실측). 바뀐 칸 수를 돌려준다.
 */
export function shapeAllAutotileGroupsAround(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[]; readonly upperTiles: number[] },
  groups: readonly AutotileGroup[],
  points: readonly AutotilePoint[],
): number {
  if (points.length === 0) return 0;
  const lowerBefore = map.lowerTiles.slice();
  const upperBefore = map.upperTiles.slice();
  for (const group of groups) shapeAutotileGroupAround(autotileGroupLayerView(map, group), group, points);
  let changed = 0;
  for (let index = 0; index < lowerBefore.length; index += 1) {
    if (lowerBefore[index] !== map.lowerTiles[index] || upperBefore[index] !== map.upperTiles[index]) changed += 1;
  }
  return changed;
}

export interface AutotileArea {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Position hash for variant choice: stable across repaints, no per-call randomness. */
function cellHash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x2f6b1d;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/**
 * Depth-shaded interior (AutotileGroup.interiorVariants): every full cell (all 8 neighbours connected) in the
 * area gets a depth variant — tier 0 when an unconnected cell or the map edge lies within Chebyshev distance 2,
 * tier 1 when deeper — chosen by a hash of its position, so painting the same mask twice gives the same tiles.
 * Only cells holding the full variant or one of its depth variants are touched; edges stay as painted.
 * Returns the number of cells written.
 */
export function shadeAutotileInterior(map: AutotileMapView, group: AutotileGroup, area?: AutotileArea): number {
  const tiers = group.interiorVariants?.filter((tier) => tier.length > 0) ?? [];
  const full = group.variantMap["255"];
  if (tiers.length === 0 || typeof full !== "number" || (group.neighborhood ?? 4) !== 8) return 0;
  const connect = connectSet(group);
  const own = new Set<number>([full, ...tiers.flat()]);
  const on = (x: number, y: number): boolean => {
    const tile = tileAt(map, x, y);
    return typeof tile === "number" && connect.has(tile);
  };
  const x0 = Math.max(0, area?.x ?? 0), y0 = Math.max(0, area?.y ?? 0);
  const x1 = Math.min(map.width, area ? area.x + area.w : map.width), y1 = Math.min(map.height, area ? area.y + area.h : map.height);
  let written = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const index = y * map.width + x;
    if (!own.has(map.lowerTiles[index]!)) continue;
    let depth = 2;
    for (let dy = -2; dy <= 2 && depth > 0; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (on(x + dx, y + dy)) continue;
      depth = Math.min(depth, Math.max(Math.abs(dx), Math.abs(dy)) - 1);
      if (depth === 0) break;
    }
    // A cell with an open neighbour is an edge, not an interior cell: leave it to the variant map.
    if (depth === 0) continue;
    const tier = tiers[Math.min(depth - 1, tiers.length - 1)]!;
    const tile = tier[cellHash(x, y) % tier.length]!;
    if (map.lowerTiles[index] !== tile) { map.lowerTiles[index] = tile; written++; }
  }
  return written;
}
