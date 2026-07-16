// editor/tools/village/roads.ts
// 길 시공 — 광장 루프·간선, 집 진입 스퍼, 성분 재연결, 긴 직선 분절, 도로 하드 마스크.

import { COBBLE_TILE, DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { shapeCobbleAround } from "@/project/defaults/cobbleAutotile";
import { TILE } from "@/project/defaults/constants";
import { shapeRoadAround } from "@/project/defaults/roadAutotile";
import { shapeSandAround } from "@/project/defaults/sandAutotile";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { inMapBounds } from "../mapHelpers";
import { wobblePath } from "../naturalScatter";
import type { RoadStyle } from "../villagePlan";
import {
  clamp,
  coordKey,
  MAX_ROAD_WIDTH,
  ROAD_TILES,
  type BuiltHouse,
  type Plaza,
  type Point,
  type Rect,
  type VillageIntent,
} from "./constants";
import { paintMarketDeck } from "./plaza";

/** 스타일별 길 몸통 타일. stone = 포석(129 블록) 몸통 190. */
function roadBodyTile(style: RoadStyle): number {
  if (style === "dirt") return DIRT_ROAD_TILE.BODY;
  if (style === "stone") return COBBLE_TILE.BODY;
  return SAND_TILE.BODY;
}

/** 스타일별 오토타일 성형. */
function shapeRoadStyle(map: GameMap, style: RoadStyle, cells: readonly Point[]): void {
  if (cells.length === 0) return;
  if (style === "dirt") shapeRoadAround(map, cells);
  else if (style === "stone") shapeCobbleAround(map, cells);
  else shapeSandAround(map, cells);
}

/**
 * 길 시공 강제 훅(2026-07-16 사용자 지시) — 시뮬레이션식:
 * ① 시공 전 스냅샷 → ② 광장 루프·간선·스퍼·재연결·직선 분절 시공 → ③ 침범 점검
 * (시공 영역 밖 / 금지 구역: 수역·집 보호구역·데크) → ④ 침범이면 롤백 후 지터 시드를
 * 바꿔 재시도, 최대 100회 → ⑤ 전부 실패하면 지터를 끈 직선 시공으로 폴백.
 * 침범 판정은 "이번 시공이 새로 만든 길 칸"만 본다(기존 맵 잔존물 무시).
 */
export function paintVillageRoadsChecked(args: {
  readonly draft: Project;
  readonly map: GameMap;
  readonly plaza: Plaza;
  readonly area: Rect;
  readonly houses: readonly BuiltHouse[];
  readonly intent: VillageIntent;
  readonly seed: number;
  readonly warnings: string[];
  readonly hardBlocked: ReadonlySet<string>;
  readonly throughBlocked: ReadonlySet<string>;
  readonly forbidden: ReadonlySet<string>;
}): number {
  const { draft, map, plaza, area, houses, intent, seed, warnings, hardBlocked, throughBlocked, forbidden } = args;
  const MAX_RETRY = 100;
  const baseLower = [...map.lowerTiles];
  const baseUpper = [...map.upperTiles];

  const paintOnce = (runIntent: VillageIntent, runSeed: number): void => {
    paintPlazaAndAvenue(draft, map, plaza, area, runIntent, runSeed, warnings, throughBlocked);
    connectHousesToRoads(draft, map, area, plaza, houses, runIntent, runSeed, warnings, hardBlocked);
    ensureSingleRoadComponent(map, area, hardBlocked, runIntent.pathStyle, throughBlocked);
    breakLongStraightRuns(map, area, hardBlocked, runIntent.pathStyle, houses);
  };
  const restore = (): void => {
    for (let i = 0; i < baseLower.length; i += 1) {
      map.lowerTiles[i] = baseLower[i]!;
      map.upperTiles[i] = baseUpper[i]!;
    }
  };
  const countViolations = (): number => {
    let count = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        const lower = map.lowerTiles[index] ?? TILE.EMPTY;
        if (!ROAD_TILES.has(lower) || baseLower[index] === lower) continue; // 이번 시공분만
        const outside = x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h;
        if (outside || forbidden.has(coordKey(x, y))) count += 1;
      }
    }
    return count;
  };

  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    if (attempt > 0) restore();
    paintOnce(intent, seed + attempt * 7919);
    const violations = countViolations();
    if (violations === 0) {
      if (attempt > 0) warnings.push(`길 침범 점검: ${attempt}회 롤백 재시도 후 통과`);
      return attempt;
    }
  }
  // 100회 전부 침범 — 지터를 끄고 직선으로 깐다(침범 원인 제거).
  restore();
  paintOnce({ ...intent, roadNaturalness: 0 }, seed);
  const residual = countViolations();
  warnings.push(
    residual === 0
      ? `길 침범 점검: ${MAX_RETRY}회 실패 → 직선 폴백으로 통과`
      : `길 침범 점검: ${MAX_RETRY}회 실패 → 직선 폴백에도 침범 ${residual}칸 잔존(수동 확인 필요)`,
  );
  return MAX_RETRY;
}

export function paintPlazaAndAvenue(
  draft: Project,
  map: GameMap,
  plaza: Plaza,
  area: Rect,
  intent: VillageIntent,
  seed: number,
  warnings: string[],
  houseBlocked: ReadonlySet<string> = EMPTY_BLOCKED,
): void {
  const pathStyle = intent.pathStyle;
  const width = intent.roadWidth;
  const naturalness = intent.roadNaturalness;
  const anchors = villageRoadAnchors(area, plaza, seed);
  if (intent.plazaStyle === "market") paintMarketDeck(map, plaza.rect);

  const loop: readonly Point[] = [
    { x: plaza.rect.x, y: plaza.rect.y + 1 },
    { x: plaza.centerX, y: plaza.rect.y - 1 },
    { x: plaza.rect.x + plaza.rect.w - 1, y: plaza.rect.y },
    { x: plaza.rect.x + plaza.rect.w, y: plaza.centerRow },
    { x: plaza.rect.x + plaza.rect.w - 2, y: plaza.rect.y + plaza.rect.h - 1 },
    { x: plaza.centerX - 1, y: plaza.rect.y + plaza.rect.h },
    { x: plaza.rect.x, y: plaza.rect.y + plaza.rect.h - 2 },
    { x: plaza.rect.x, y: plaza.rect.y + 1 },
  ];
  paintWideRoad(draft, map, pathStyle, loop, 1, Math.max(0.65, naturalness), seed + 7, warnings, houseBlocked);

  const rng = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const shift = (): number => Math.round((rng() - 0.5) * (2 + naturalness * 4));
  const northJoinX = clamp(plaza.centerX + shift(), plaza.rect.x, plaza.rect.x + plaza.rect.w - 1);
  const southJoinX = clamp(plaza.centerX + shift(), plaza.rect.x, plaza.rect.x + plaza.rect.w - 1);
  const westJoinY = clamp(plaza.centerRow + shift(), plaza.rect.y, plaza.rect.y + plaza.rect.h - 1);
  const eastJoinY = clamp(plaza.centerRow + shift(), plaza.rect.y, plaza.rect.y + plaza.rect.h - 1);
  const routes: readonly (readonly Point[])[] = [
    [anchors[0]!, { x: anchors[0]!.x + shift(), y: Math.floor((area.y + plaza.rect.y) / 2) }, { x: northJoinX, y: plaza.rect.y }],
    [anchors[1]!, { x: anchors[1]!.x + shift(), y: Math.floor((area.y + area.h + plaza.rect.y + plaza.rect.h) / 2) }, { x: southJoinX, y: plaza.rect.y + plaza.rect.h - 1 }],
    [anchors[2]!, { x: Math.floor((area.x + plaza.rect.x) / 2), y: anchors[2]!.y + shift() }, { x: plaza.rect.x, y: westJoinY }],
    [anchors[3]!, { x: Math.floor((area.x + area.w + plaza.rect.x + plaza.rect.w) / 2), y: anchors[3]!.y + shift() }, { x: plaza.rect.x + plaza.rect.w - 1, y: eastJoinY }],
  ];
  for (let route = 0; route < routes.length; route += 1) {
    paintWideRoad(draft, map, pathStyle, routes[route]!, Math.max(1, width - 1), naturalness, seed + 20 + route * 11, warnings, houseBlocked);
  }
}

export function villageRoadAnchors(area: Rect, plaza: Plaza, seed: number): readonly Point[] {
  const rng = mulberry32((seed ^ 0x8da6b343) >>> 0);
  const offset = (): number => Math.floor(rng() * 5) - 2;
  return [
    { x: clamp(plaza.centerX + offset(), area.x + 1, area.x + area.w - 2), y: area.y },
    { x: clamp(plaza.centerX + offset(), area.x + 1, area.x + area.w - 2), y: area.y + area.h - 1 },
    { x: area.x, y: clamp(plaza.centerRow + offset(), area.y + 1, area.y + area.h - 2) },
    { x: area.x + area.w - 1, y: clamp(plaza.centerRow + offset(), area.y + 1, area.y + area.h - 2) },
  ];
}

/**
 * 폭 width 칸 도로.
 * 집 footprint(houseBlocked) 안 칸은 칠하지 않는다 — 예전엔 paint_road가 lower/upper를 무차별 덮어 집을 뚫었다.
 */
function paintWideRoad(
  draft: Project,
  map: GameMap,
  pathStyle: RoadStyle,
  points: readonly Point[],
  width: number,
  naturalness: number,
  seed: number,
  warnings: string[],
  houseBlocked: ReadonlySet<string> = EMPTY_BLOCKED,
): void {
  void draft;
  void warnings;
  if (points.length === 0) return;
  const w = Math.max(1, Math.min(MAX_ROAD_WIDTH, Math.floor(width)));
  const result = wobblePath(points, naturalness, mulberry32(seed >>> 0));
  const cells = w >= 2 ? [...result.path, ...result.widthCells] : result.path;
  if (w >= 3) {
    for (const cell of result.path) {
      cells.push({ x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y });
    }
  }
  paintRoadCellsAvoidingHouses(map, pathStyle, cells, houseBlocked);
}

const EMPTY_BLOCKED: ReadonlySet<string> = new Set();

/**
 * 긴 직선 도로 분절 — maxRun을 넘는 활주로형 직선에 U자 조그(한 줄 옆으로 2칸)를 넣는다.
 * 문 앞 3칸(게이트)과 하드 마스크(집·데크)는 건드리지 않고, 조그는 잔디 위에만 판다.
 * 연결성은 구조적으로 보존된다(제거 2칸을 옆줄 4칸 우회로 대체).
 */
export function breakLongStraightRuns(
  map: GameMap,
  area: Rect,
  hardBlocked: ReadonlySet<string>,
  pathStyle: RoadStyle,
  houses: readonly BuiltHouse[],
): void {
  const body = roadBodyTile(pathStyle);
  const maxRun = Math.max(12, Math.floor(Math.max(map.width, map.height) * 0.42));
  const isRoad = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const isGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY;
  // 문 앞 게이트 보호: front 행의 door.x±1은 제거 금지.
  const protectedCells = new Set<string>();
  for (const house of houses) {
    for (let dx = -1; dx <= 1; dx += 1) protectedCells.add(coordKey(house.front.x + dx, house.front.y));
  }
  const changed: Point[] = [];
  const jogAt = (h: boolean, fixed: number, c: number): boolean => {
    // h=true: 가로 run(행 fixed), 세로 조그. h=false: 세로 run(열 fixed), 가로 조그.
    const cellOf = (main: number, cross: number): Point => (h ? { x: main, y: cross } : { x: cross, y: main });
    for (const side of [1, -1]) {
      const jogCross = fixed + side;
      const removeCells = [cellOf(c, fixed), cellOf(c + 1, fixed)];
      const addCells = [cellOf(c - 1, jogCross), cellOf(c, jogCross), cellOf(c + 1, jogCross), cellOf(c + 2, jogCross)];
      if (removeCells.some((cell) => protectedCells.has(coordKey(cell.x, cell.y)))) continue;
      if (!addCells.every((cell) =>
        cell.x > area.x && cell.y > area.y && cell.x < area.x + area.w - 1 && cell.y < area.y + area.h - 1
        && !hardBlocked.has(coordKey(cell.x, cell.y))
        && (isGrass(cell.x, cell.y) || isRoad(cell.x, cell.y)))) continue;
      for (const cell of addCells) {
        map.lowerTiles[cell.y * map.width + cell.x] = body;
        map.upperTiles[cell.y * map.width + cell.x] = TILE.EMPTY;
        changed.push(cell);
      }
      for (const cell of removeCells) {
        map.lowerTiles[cell.y * map.width + cell.x] = TILE.GRASS;
        changed.push(...([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
          .filter((n) => isRoad(n.x, n.y)));
      }
      return true;
    }
    return false;
  };
  const scan = (h: boolean): void => {
    const crossMax = h ? map.height : map.width;
    const mainMax = h ? map.width : map.height;
    for (let cross = 0; cross < crossMax; cross += 1) {
      let runStart = -1;
      for (let main = 0; main <= mainMax; main += 1) {
        const road = main < mainMax && (h ? isRoad(main, cross) : isRoad(cross, main));
        if (road && runStart < 0) runStart = main;
        if (!road && runStart >= 0) {
          const len = main - runStart;
          if (len > maxRun) {
            // run 중앙부터 바깥으로 조그 시도 — 하나만 성공해도 run이 절반으로 갈라진다.
            const mid = runStart + Math.floor(len / 2);
            for (let offset = 0; offset < Math.floor(len / 2) - 2; offset += 1) {
              if (jogAt(h, cross, mid + offset) || jogAt(h, cross, mid - offset)) break;
            }
          }
          runStart = -1;
        }
      }
    }
  };
  scan(true);
  scan(false);
  if (changed.length > 0) {
    shapeRoadStyle(map, pathStyle, changed);
  }
}

/** 광장 데크(장터) 칸 — 길이 데크 테두리를 갈아엎지 못하게 하드 차단. */
export function plazaDeckBlockedCells(plaza: Plaza, intent: VillageIntent): Set<string> {
  const blocked = new Set<string>();
  if (intent.plazaStyle !== "market") return blocked;
  for (let y = plaza.rect.y; y < plaza.rect.y + plaza.rect.h; y += 1) {
    for (let x = plaza.rect.x; x < plaza.rect.x + plaza.rect.w; x += 1) {
      blocked.add(coordKey(x, y));
    }
  }
  return blocked;
}

function paintRoadCellsAvoidingHouses(
  map: GameMap,
  pathStyle: RoadStyle,
  cells: readonly Point[],
  houseBlocked: ReadonlySet<string>,
): void {
  const painted: Point[] = [];
  const seen = new Set<string>();
  const body = roadBodyTile(pathStyle);
  const paintCell = (x: number, y: number): boolean => {
    const key = coordKey(x, y);
    if (seen.has(key) || !inMapBounds(map, x, y) || houseBlocked.has(key)) return false;
    seen.add(key);
    map.lowerTiles[y * map.width + x] = body;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
    painted.push({ x, y });
    return true;
  };
  for (const cell of cells) {
    paintCell(cell.x, cell.y);
  }
  if (painted.length === 0) return;
  shapeRoadStyle(map, pathStyle, painted);
}


/**
 * 집 footprint를 건너뛴 뒤 끊긴 길 성분을 하나로 잇는다.
 * 경로 탐색은 집 칸·맵 밖을 피하고, 기존 잔디 위를 우회한다.
 */
export function ensureSingleRoadComponent(
  map: GameMap,
  area: Rect,
  houseBlocked: ReadonlySet<string>,
  pathStyle: RoadStyle,
  preferAvoid: ReadonlySet<string> = houseBlocked,
): void {
  const body = roadBodyTile(pathStyle);
  const key = (x: number, y: number) => `${x},${y}`;
  const isRoad = (x: number, y: number): boolean => {
    if (!inMapBounds(map, x, y)) return false;
    return ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  };
  const walkableWith = (mask: ReadonlySet<string>) => (x: number, y: number): boolean => {
    if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) return false;
    if (mask.has(key(x, y))) return false;
    return true;
  };
  // 우회로는 스탠드오프(벽 1칸 이격)를 우선하고, 못 이으면 하드 마스크로 폴백한다.
  const walkable = walkableWith(houseBlocked);
  const walkableSoft = walkableWith(preferAvoid);

  const collectComponents = (): Point[][] => {
    const seen = new Set<string>();
    const comps: Point[][] = [];
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        const k = key(x, y);
        if (seen.has(k) || !isRoad(x, y)) continue;
        const cells: Point[] = [];
        const q: Point[] = [{ x, y }];
        seen.add(k);
        while (q.length > 0) {
          const cur = q.pop()!;
          cells.push(cur);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const nk = key(nx, ny);
            if (seen.has(nk) || !isRoad(nx, ny)) continue;
            seen.add(nk);
            q.push({ x: nx, y: ny });
          }
        }
        comps.push(cells);
      }
    }
    return comps;
  };

  const bfsPath = (
    start: Point,
    goals: ReadonlySet<string>,
    canWalk: (x: number, y: number) => boolean,
  ): Point[] | null => {
    const q: Point[] = [start];
    const prev = new Map<string, string | null>();
    prev.set(key(start.x, start.y), null);
    let gi = 0;
    while (gi < q.length) {
      const cur = q[gi++]!;
      const ck = key(cur.x, cur.y);
      if (goals.has(ck) && !(cur.x === start.x && cur.y === start.y)) {
        const path: Point[] = [];
        let walk: string | null = ck;
        while (walk) {
          const [sx, sy] = walk.split(",").map(Number) as [number, number];
          path.push({ x: sx, y: sy });
          walk = prev.get(walk) ?? null;
        }
        path.reverse();
        return path;
      }
      // 이웃 순서를 좌표 패리티로 교차 — 최단 길이는 같지만 경로가 계단형으로 꺾여
      // 우회로가 긴 직선(격자 대로)으로 굳는 것을 막는다.
      const dirs = (cur.x + cur.y) % 2 === 0
        ? ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)
        : ([[0, 1], [1, 0], [0, -1], [-1, 0]] as const);
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nk = key(nx, ny);
        if (prev.has(nk) || !canWalk(nx, ny)) continue;
        prev.set(nk, ck);
        q.push({ x: nx, y: ny });
      }
    }
    return null;
  };

  const painted: Point[] = [];
  // 성분 수가 1이 될 때까지 최대 houses 수준으로 연결
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const comps = collectComponents().sort((a, b) => b.length - a.length);
    if (comps.length <= 1) break;
    const main = comps[0]!;
    const mainSet = new Set(main.map((c) => key(c.x, c.y)));
    let linked = false;
    for (let ci = 1; ci < comps.length; ci += 1) {
      const other = comps[ci]!;
      // other 경계에서 main까지 최단 우회 — 스탠드오프 우선, 실패 시 하드 마스크.
      let best: Point[] | null = null;
      for (const canWalk of [walkableSoft, walkable]) {
        for (const seed of other) {
          // 경계 후보만 (이웃 중 비도로 있음)
          const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
            const nx = seed.x + dx;
            const ny = seed.y + dy;
            return walkable(nx, ny) && !isRoad(nx, ny);
          });
          if (!edge && other.length > 8) continue;
          const path = bfsPath(seed, mainSet, canWalk);
          if (path && (best === null || path.length < best.length)) best = path;
          if (best && best.length <= 3) break;
        }
        if (!best) {
          // 전수: other 아무 점에서
          for (const seed of other) {
            const path = bfsPath(seed, mainSet, canWalk);
            if (path && (best === null || path.length < best.length)) best = path;
          }
        }
        if (best) break;
      }
      if (!best) continue;
      for (const cell of best) {
        if (houseBlocked.has(key(cell.x, cell.y))) continue;
        map.lowerTiles[cell.y * map.width + cell.x] = body;
        map.upperTiles[cell.y * map.width + cell.x] = TILE.EMPTY;
        painted.push(cell);
      }
      linked = true;
      break; // 한 성분씩 합친 뒤 재계산
    }
    if (!linked) break;
  }
  if (painted.length > 0) {
    shapeRoadStyle(map, pathStyle, painted);
  }
}

export function connectHousesToRoads(
  draft: Project,
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  intent: VillageIntent,
  seed: number,
  warnings: string[],
  houseBlocked: ReadonlySet<string> = EMPTY_BLOCKED,
): void {
  const pathStyle = intent.pathStyle;
  const leftEdge = plaza.rect.x;
  const rightEdge = plaza.rect.x + plaza.rect.w - 1;
  const plazaTop = plaza.rect.y;
  const plazaBottom = plaza.rect.y + plaza.rect.h - 1;
  const plazaLeft = plaza.rect.x;
  const plazaRight = plaza.rect.x + plaza.rect.w - 1;
  for (let hi = 0; hi < houses.length; hi += 1) {
    const house = houses[hi] as BuiltHouse;
    const points: Point[] = [house.front];
    const houseRight = house.bbox.x + house.bbox.w - 1;
    const houseLeft = house.bbox.x;
    // 문은 항상 남쪽 벽. 북/남/동/서 밴드별로 집 footprint를 우회한다.
    if (house.front.y <= plazaTop) {
      // 광장 위: 문 앞에서 광장 윗변까지 남하 (집 남쪽이므로 관통 없음)
      points.push({ x: house.front.x, y: plazaTop }, { x: clamp(house.front.x, leftEdge, rightEdge), y: plazaTop });
    } else if (house.bbox.y >= plazaBottom) {
      // 광장 아래: 곧장 북상하면 집 몸통을 뚫음 → 옆 복도 우회
      // 복도는 벽에서 1칸 띄운다 — 벽 밀착 골목이 집을 감싸 보이던 원인.
      const rightCorridor = house.bbox.x + house.bbox.w + 1;
      const corridorX = rightCorridor <= area.x + area.w - 2 ? rightCorridor : house.bbox.x - 2;
      points.push(
        { x: corridorX, y: house.front.y },
        { x: corridorX, y: plazaBottom },
        { x: clamp(corridorX, leftEdge, rightEdge), y: plazaBottom },
      );
    } else if (houseRight < plazaLeft) {
      // 광장 왼쪽: 문 앞 → 남쪽 복도 → 광장 왼쪽 변
      const southY = house.bbox.y + house.bbox.h;
      points.push(
        { x: house.front.x, y: southY },
        { x: plazaLeft, y: southY },
        { x: plazaLeft, y: clamp(southY, plazaTop, plazaBottom) },
      );
    } else if (houseLeft > plazaRight) {
      // 광장 오른쪽
      const southY = house.bbox.y + house.bbox.h;
      points.push(
        { x: house.front.x, y: southY },
        { x: plazaRight, y: southY },
        { x: plazaRight, y: clamp(southY, plazaTop, plazaBottom) },
      );
    } else {
      // 애매한 겹침: 옆 복도로 광장 아랫변
      // 복도는 벽에서 1칸 띄운다 — 벽 밀착 골목이 집을 감싸 보이던 원인.
      const rightCorridor = house.bbox.x + house.bbox.w + 1;
      const corridorX = rightCorridor <= area.x + area.w - 2 ? rightCorridor : house.bbox.x - 2;
      points.push(
        { x: corridorX, y: house.front.y },
        { x: corridorX, y: plazaBottom },
        { x: clamp(corridorX, leftEdge, rightEdge), y: plazaBottom },
      );
    }
    paintWideRoad(
      draft,
      map,
      pathStyle,
      points,
      1,
      Math.max(0.25, intent.roadNaturalness * 0.5),
      seed + 300 + hi * 17,
      warnings,
      houseBlocked,
    );
  }
}
