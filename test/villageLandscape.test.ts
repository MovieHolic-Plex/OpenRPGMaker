// 마을 조경 모듈 문법 고정 테스트 — dressVillageLandscape.
// 100×100 비판 리뷰(2026-07-17)에서 확정한 조경 문법을 소형 픽스처(40×40~60×60)로 고정한다:
// 수로 시작=호수 인접, 모래-물 접안, 눈-밭/모래 12칸 이격, 어둠-집 6칸 이격+지하계단 세트,
// 문앞·보호구역 침범 0, 5×4 미만 수풀 패치 금지, 결정론(mulberry32).

import { describe, expect, it } from "vitest";
import {
  BENCH_LEFT_TILE,
  BENCH_RIGHT_TILE,
  CANAL_HORIZONTAL_TILE,
  CANAL_VERTICAL_TILE,
  DARKNESS_HOUSE_CLEARANCE,
  DOOR_FRONT_CLEARANCE,
  dressVillageLandscape,
  LAKE_WATER_TILE,
  MIN_BRUSH_PATCH_H,
  MIN_BRUSH_PATCH_W,
  ROCK_TILES,
  SNOW_MIN_SEPARATION,
  STAIRS_LEFT_TILE,
  STAIRS_RIGHT_TILE,
} from "@/editor/tools/village/landscape";
import { coordKey, expandRect, type BuiltHouse, type Plaza, type Rect } from "@/editor/tools/village/constants";
import { houseBlockedCells, houseStandoffCells } from "@/editor/tools/village/houses";
import { DEFAULT_AUTOTILE_GROUPS } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

type Cell = readonly [number, number];

function makeMap(width: number, height: number): GameMap {
  return {
    id: "m_landscape_test",
    name: "조경 테스트",
    width,
    height,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    events: [],
  };
}

function makeHouse(x: number, y: number): BuiltHouse {
  return {
    bbox: { x, y, w: 6, h: 6 },
    doorAt: { x: x + 3, y: y + 5 },
    front: { x: x + 3, y: y + 6 },
    kitId: "blue-stone",
    stories: 1,
    templateId: "rect-small",
  };
}

function makePlaza(x: number, y: number): Plaza {
  return { rect: { x, y, w: 8, h: 6 }, centerRow: y + 3, centerX: x + 4 };
}

interface Fixture {
  readonly map: GameMap;
  readonly houses: readonly BuiltHouse[];
  readonly plaza: Plaza;
  readonly area: Rect;
  readonly warnings: string[];
  readonly placed: number;
}

function runFixture(size: 40 | 60, seed: number): Fixture {
  const map = makeMap(size, size);
  const houses = size === 60
    ? [makeHouse(16, 14), makeHouse(38, 14), makeHouse(27, 40)]
    : [makeHouse(8, 8), makeHouse(26, 26)];
  const plaza = size === 60 ? makePlaza(26, 27) : makePlaza(16, 17);
  const area: Rect = { x: 1, y: 1, w: size - 2, h: size - 2 };
  const warnings: string[] = [];
  const placed = dressVillageLandscape(map, { area, houses, plaza, seed, warnings });
  return { map, houses, plaza, area, warnings, placed };
}

function cellsWhere(map: GameMap, predicate: (lower: number) => boolean): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (predicate(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) cells.push([x, y]);
    }
  }
  return cells;
}

function memberSet(groupId: string): Set<number> {
  const group = DEFAULT_AUTOTILE_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`그룹 없음: ${groupId}`);
  return new Set(group.memberTileIds);
}

function minChebyshev(a: readonly Cell[], b: readonly Cell[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      best = Math.min(best, Math.max(Math.abs(ax - bx), Math.abs(ay - by)));
    }
  }
  return best;
}

/** 4방향 연결 성분 분해. */
function components(cells: readonly Cell[]): Cell[][] {
  const remaining = new Map(cells.map((cell) => [coordKey(cell[0], cell[1]), cell] as const));
  const result: Cell[][] = [];
  while (remaining.size > 0) {
    const [firstKey, first] = remaining.entries().next().value as [string, Cell];
    remaining.delete(firstKey);
    const component: Cell[] = [first];
    const queue: Cell[] = [first];
    while (queue.length > 0) {
      const [cx, cy] = queue.pop() as Cell;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        const key = coordKey(nx, ny);
        const cell = remaining.get(key);
        if (!cell) continue;
        remaining.delete(key);
        component.push(cell);
        queue.push(cell);
      }
    }
    result.push(component);
  }
  return result;
}

function adjacent4(map: GameMap, x: number, y: number, tiles: ReadonlySet<number>): boolean {
  return ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const).some(([nx, ny]) =>
    nx >= 0 && ny >= 0 && nx < map.width && ny < map.height
    && tiles.has(map.lowerTiles[ny * map.width + nx] ?? TILE.EMPTY));
}

const WATER_TILES = new Set([LAKE_WATER_TILE]);
const CANAL_TILES = new Set([CANAL_VERTICAL_TILE, CANAL_HORIZONTAL_TILE]);
const SAND_TILES = memberSet("builtin_sand");
const SNOW_TILES = memberSet("builtin_snow");
const FARM_TILES = memberSet("builtin_farmland");
const DARK_TILES = memberSet("builtin_darkness");
const TALL_GRASS_TILES = memberSet("builtin_tall_grass");
const UNDERGROWTH_TILES = memberSet("builtin_undergrowth");

describe("dressVillageLandscape", () => {
  const fx = runFixture(60, 41);

  it("60×60에서 핵심 지형이 전부 배치되고 배치 수를 돌려준다", () => {
    expect(fx.placed).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => WATER_TILES.has(tile)).length).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => SAND_TILES.has(tile)).length).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => CANAL_TILES.has(tile)).length).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => SNOW_TILES.has(tile)).length).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => FARM_TILES.has(tile)).length).toBeGreaterThan(0);
    expect(cellsWhere(fx.map, (tile) => DARK_TILES.has(tile)).length).toBeGreaterThan(0);
    // 반환값 = lower 레이어가 실제로 바뀐 셀 수(잔디→지형). 계단은 어둠을 덮어써 이중 집계되지 않는다.
    const changed = cellsWhere(fx.map, (tile) => tile !== TILE.GRASS).length;
    expect(fx.placed).toBe(changed);
  });

  it("수로는 물의 논리 — 시작은 호수 인접, 한 성분, 가로 토막 데드엔드 없음", () => {
    const canal = cellsWhere(fx.map, (tile) => CANAL_TILES.has(tile));
    expect(canal.length).toBeGreaterThanOrEqual(3);
    // 시작(최상단 세로 칸)은 호수 물과 4방 인접해야 한다.
    const vertical = canal.filter(([x, y]) => fx.map.lowerTiles[y * fx.map.width + x] === CANAL_VERTICAL_TILE);
    expect(vertical.length).toBeGreaterThanOrEqual(3);
    const start = [...vertical].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0] as Cell;
    expect(adjacent4(fx.map, start[0], start[1], WATER_TILES)).toBe(true);
    // 수로 전체는 하나의 연결 성분 — 떨어져 나간 가로 조각(데드엔드 토막)이 없다.
    expect(components(canal).length).toBe(1);
    // 가로(63) 칸이 있다면 3칸 이상 연속 — 1~2칸 토막 금지.
    const horizontal = canal.filter(([x, y]) => fx.map.lowerTiles[y * fx.map.width + x] === CANAL_HORIZONTAL_TILE);
    if (horizontal.length > 0) expect(horizontal.length).toBeGreaterThanOrEqual(3);
  });

  it("백사장은 호수에 접안 — 모든 모래가 물에 닿은 성분에 속한다", () => {
    const sand = cellsWhere(fx.map, (tile) => SAND_TILES.has(tile));
    expect(sand.length).toBeGreaterThan(0);
    for (const component of components(sand)) {
      expect(component.some(([x, y]) => adjacent4(fx.map, x, y, WATER_TILES))).toBe(true);
    }
  });

  it("지형 궁합 — 눈은 경작지·모래와 12칸 이내 인접 금지", () => {
    const snow = cellsWhere(fx.map, (tile) => SNOW_TILES.has(tile));
    const farm = cellsWhere(fx.map, (tile) => FARM_TILES.has(tile));
    const sand = cellsWhere(fx.map, (tile) => SAND_TILES.has(tile));
    expect(snow.length).toBeGreaterThan(0);
    expect(minChebyshev(snow, farm)).toBeGreaterThanOrEqual(SNOW_MIN_SEPARATION);
    expect(minChebyshev(snow, sand)).toBeGreaterThanOrEqual(SNOW_MIN_SEPARATION);
  });

  it("어둠은 민가 6칸 이격 + 지하계단 세트 + 둘레 바위", () => {
    const dark = cellsWhere(fx.map, (tile) => DARK_TILES.has(tile) || tile === STAIRS_LEFT_TILE || tile === STAIRS_RIGHT_TILE);
    expect(dark.length).toBeGreaterThan(0);
    // 민가 bbox와의 체비셰프 거리 ≥ 6.
    for (const house of fx.houses) {
      const bboxCells: Cell[] = [];
      for (let y = house.bbox.y; y < house.bbox.y + house.bbox.h; y += 1) {
        for (let x = house.bbox.x; x < house.bbox.x + house.bbox.w; x += 1) bboxCells.push([x, y]);
      }
      expect(minChebyshev(dark, bboxCells)).toBeGreaterThanOrEqual(DARKNESS_HOUSE_CLEARANCE);
    }
    // 계단 세트(298+299 좌우 인접)가 어둠 남변(최하단 행)에 있다 — 계단 없는 어둠 금지.
    const stairsLeft = cellsWhere(fx.map, (tile) => tile === STAIRS_LEFT_TILE);
    expect(stairsLeft.length).toBe(1);
    const [sx, sy] = stairsLeft[0] as Cell;
    expect(fx.map.lowerTiles[sy * fx.map.width + sx + 1]).toBe(STAIRS_RIGHT_TILE);
    const darkMaxY = Math.max(...dark.map(([, y]) => y));
    expect(sy).toBe(darkMaxY);
    // 둘레 1칸 링에 바위(441/442, 상단 레이어) 1개 이상.
    const rocks: Cell[] = [];
    for (let y = 0; y < fx.map.height; y += 1) {
      for (let x = 0; x < fx.map.width; x += 1) {
        if (ROCK_TILES.includes(fx.map.upperTiles[y * fx.map.width + x] ?? TILE.EMPTY)) rocks.push([x, y]);
      }
    }
    expect(minChebyshev(rocks, dark)).toBe(1);
  });

  it("호숫가 벤치(327+328)는 물가 1칸 잔디 위에 놓인다", () => {
    const benches: Cell[] = [];
    for (let y = 0; y < fx.map.height; y += 1) {
      for (let x = 0; x < fx.map.width; x += 1) {
        if (fx.map.upperTiles[y * fx.map.width + x] === BENCH_LEFT_TILE) benches.push([x, y]);
      }
    }
    expect(benches.length).toBe(1);
    const [bx, by] = benches[0] as Cell;
    expect(fx.map.upperTiles[by * fx.map.width + bx + 1]).toBe(BENCH_RIGHT_TILE);
    // 벤치는 잔디 lower 위 + 물과 4방 인접(물가 1칸).
    expect(fx.map.lowerTiles[by * fx.map.width + bx]).toBe(TILE.GRASS);
    expect(adjacent4(fx.map, bx, by, WATER_TILES)).toBe(true);
  });

  it("키큰 풀/수풀 패치는 5×4(20칸) 미만이 없다", () => {
    const brush = cellsWhere(fx.map, (tile) => TALL_GRASS_TILES.has(tile) || UNDERGROWTH_TILES.has(tile));
    expect(brush.length).toBeGreaterThan(0);
    for (const component of components(brush)) {
      expect(component.length).toBeGreaterThanOrEqual(MIN_BRUSH_PATCH_W * MIN_BRUSH_PATCH_H);
    }
  });

  it("보호구역(집·스탠드오프·문앞±2·광장+1)은 lower/upper 모두 원본 그대로다", () => {
    for (const size of [40, 60] as const) {
      const local = runFixture(size, 7);
      const protectedKeys = new Set<string>([
        ...houseBlockedCells(local.houses),
        ...houseStandoffCells(local.houses),
      ]);
      for (const house of local.houses) {
        for (let dy = -DOOR_FRONT_CLEARANCE; dy <= DOOR_FRONT_CLEARANCE; dy += 1) {
          for (let dx = -DOOR_FRONT_CLEARANCE; dx <= DOOR_FRONT_CLEARANCE; dx += 1) {
            protectedKeys.add(coordKey(house.front.x + dx, house.front.y + dy));
            protectedKeys.add(coordKey(house.doorAt.x + dx, house.doorAt.y + dy));
          }
        }
      }
      const plazaZone = expandRect(local.plaza.rect, 1);
      for (let y = plazaZone.y; y < plazaZone.y + plazaZone.h; y += 1) {
        for (let x = plazaZone.x; x < plazaZone.x + plazaZone.w; x += 1) protectedKeys.add(coordKey(x, y));
      }
      for (const key of protectedKeys) {
        const [x, y] = key.split(",").map(Number) as [number, number];
        if (x < 0 || y < 0 || x >= local.map.width || y >= local.map.height) continue;
        const index = y * local.map.width + x;
        expect(local.map.lowerTiles[index], `lower 침범 ${key} (${size}×${size})`).toBe(TILE.GRASS);
        expect(local.map.upperTiles[index], `upper 침범 ${key} (${size}×${size})`).toBe(TILE.EMPTY);
      }
    }
  });

  it("길이 깔린 칸(잔디 아닌 lower)은 회피한다", () => {
    const map = makeMap(60, 60);
    // 가짜 길: 세로 한 줄을 포석 몸통으로 채운다.
    const cobbleBody = [...memberSet("builtin_cobble")][0] as number;
    for (let y = 1; y < 59; y += 1) map.lowerTiles[y * 60 + 30] = cobbleBody;
    const warnings: string[] = [];
    dressVillageLandscape(map, {
      area: { x: 1, y: 1, w: 58, h: 58 },
      houses: [makeHouse(16, 14)],
      plaza: makePlaza(26, 27),
      seed: 41,
      warnings,
    });
    for (let y = 1; y < 59; y += 1) {
      expect(map.lowerTiles[y * 60 + 30], `길 훼손 30,${y}`).toBe(cobbleBody);
    }
  });

  it("결정론 — 같은 seed는 같은 맵·같은 반환값, Date/Math.random 무관", () => {
    const a = runFixture(60, 123);
    const b = runFixture(60, 123);
    expect(a.placed).toBe(b.placed);
    expect(a.map.lowerTiles).toEqual(b.map.lowerTiles);
    expect(a.map.upperTiles).toEqual(b.map.upperTiles);
    expect(a.warnings).toEqual(b.warnings);
    const c = runFixture(40, 9);
    const d = runFixture(40, 9);
    expect(c.map.lowerTiles).toEqual(d.map.lowerTiles);
    expect(c.map.upperTiles).toEqual(d.map.upperTiles);
    expect(c.placed).toBe(d.placed);
  });
});
