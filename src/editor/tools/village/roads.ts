// editor/tools/village/roads.ts
// 길 시공 — 광장 루프·간선, 집 진입 스퍼, 성분 재연결, 긴 직선 분절, 도로 하드 마스크.

import { COBBLE_TILE, DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { DEFAULT_COBBLE_AUTOTILE_GROUP, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { assertHouseProtection, captureHouseProtection, protectedHouseCells } from "../houseProtection";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { inMapBounds, lineCells } from "../mapHelpers";
import { wobblePath } from "../naturalScatter";
import type { RoadStyle } from "../villagePlan";
import {
  clamp,
  coordKey,
  environmentalRoadAt,
  MAX_ROAD_WIDTH,
  ROAD_TILES,
  type BuiltHouse,
  type Plaza,
  type Point,
  type Rect,
  type VillageIntent,
} from "./constants";
import { ToolError } from "../types";
import { paintMarketDeck } from "./plaza";

/**
 * 대로(boulevard) — 대형 맵(72+)의 골격 (2026-07-17, 외부 리서치 반영: spine-first).
 * 동서 대로는 광장 남쪽(게이트 앞)을 전폭으로 관통, 남북 대로는 광장 동쪽에서 교차.
 * 대로 밴드는 집 배치 전에 예약되어(builder) 구멍 없는 곡선 대로가 보장된다.
 */
export type BoulevardAxis = "both" | "ew" | "ns";

export type Boulevard = {
  readonly ewRow: number;
  readonly nsCol: number;
  readonly width: number;
  /** 어느 축을 실제로 깔지. 유기적 배치는 한 축만(십자 금지), street-grid 만 "both". */
  readonly axis: BoulevardAxis;
};

/**
 * 대로 축 선택 (2026-09-17). 예전엔 대형 맵마다 두 축을 무조건 예약해 마을이 항상 십자로 읽혔다.
 * 유기적 배치(plaza-ring/clusters)는 긴 변 방향 한 축만 깔고, 나머지 골격은 집에서 자란 길이 맡는다.
 * 정방형에 가까우면(변 차이 < 12) 시드로 고른다. street-grid 는 계획 도시라 두 축 유지.
 */
export function villageBoulevardAxis(area: Rect, seed: number, layout?: string): BoulevardAxis {
  if (layout === "street-grid") return "both";
  if (area.w - area.h >= 12) return "ew";
  if (area.h - area.w >= 12) return "ns";
  return mulberry32((seed ^ 0x51ed270b) >>> 0)() < 0.5 ? "ew" : "ns";
}

export function villageBoulevard(area: Rect, plaza: Plaza, seed?: number, layout?: string): Boulevard | null {
  if (area.w < 72 || area.h < 72) return null;
  return {
    ewRow: plaza.rect.y + plaza.rect.h + 1,
    nsCol: plaza.rect.x + plaza.rect.w + 2,
    width: 3,
    axis: seed === undefined ? "both" : villageBoulevardAxis(area, seed, layout),
  };
}

function stitchBoulevard(waypoints: readonly Point[], alongX: boolean): Point[] {
  const first = waypoints[0];
  if (first === undefined) return [];
  const cells: Point[] = [first];
  for (let i = 1; i < waypoints.length; i += 1) {
    const target = waypoints[i];
    if (target === undefined) continue;
    const from = cells[cells.length - 1];
    if (from === undefined) continue;
    const seg = lineCells(from, target);
    for (let j = 1; j < seg.length; j += 1) {
      const cell = seg[j];
      if (cell === undefined) continue;
      const prev = cells[cells.length - 1];
      if (prev === undefined || (prev.x === cell.x && prev.y === cell.y)) continue;
      if (Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y) > 1) {
        cells.push(alongX ? { x: cell.x, y: prev.y } : { x: prev.x, y: cell.y });
      }
      cells.push(cell);
    }
  }
  return cells;
}

function boulevardPathAt(area: Rect, axes: { readonly ewRow: number; readonly nsCol: number }, seed: number): {
  readonly ew: readonly Point[];
  readonly ns: readonly Point[];
} {
  const rng = mulberry32(seed >>> 0);
  const yLo = area.y + 2;
  const yHi = area.y + area.h - 1 - 2;
  const xLo = area.x + 2;
  const xHi = area.x + area.w - 1 - 2;
  const xEnd = area.x + area.w - 1;
  const yEnd = area.y + area.h - 1;
  const ewWay: Point[] = [];
  for (let x = area.x; ; x = Math.min(xEnd, x + 12)) {
    ewWay.push({ x, y: clamp(axes.ewRow + Math.floor(rng() * 9) - 4, yLo, yHi) });
    if (x >= xEnd) break;
  }
  const nsWay: Point[] = [];
  for (let y = area.y; ; y = Math.min(yEnd, y + 12)) {
    nsWay.push({ x: clamp(axes.nsCol + Math.floor(rng() * 9) - 4, xLo, xHi), y });
    if (y >= yEnd) break;
  }
  return { ew: stitchBoulevard(ewWay, true), ns: stitchBoulevard(nsWay, false) };
}

/** 시드 고정 곡선 골격. 예약·시공이 같은 경로를 쓴다. */
export function villageBoulevardPath(area: Rect, plaza: Plaza, seed: number): {
  readonly ew: readonly Point[];
  readonly ns: readonly Point[];
} {
  return boulevardPathAt(area, { ewRow: plaza.rect.y + plaza.rect.h + 1, nsCol: plaza.rect.x + plaza.rect.w + 2 }, seed);
}

/** 대로가 실제로 깔리는 축의 경로만. axis 가 "ew" 면 ns 는 빈 배열. */
export function activeBoulevardPaths(area: Rect, boulevard: Boulevard, seed: number): {
  readonly ew: readonly Point[];
  readonly ns: readonly Point[];
} {
  const path = boulevardPathAt(area, boulevard, seed);
  return {
    ew: boulevard.axis === "ns" ? [] : path.ew,
    ns: boulevard.axis === "ew" ? [] : path.ns,
  };
}

/** 대로 밴드 전체 칸(폭 width, 전 구간). 집 예약·시공 양쪽이 같은 계산을 쓴다. seed가 있으면 곡선 경로 주변, 없으면 옛 직선. */
export function boulevardCells(area: Rect, boulevard: Boulevard, seed?: number): Point[] {
  const half = Math.floor(boulevard.width / 2);
  const axis = boulevard.axis ?? "both";
  if (seed === undefined) {
    const cells: Point[] = [];
    if (axis !== "ns") {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        for (let dy = -half; dy <= half; dy += 1) cells.push({ x, y: boulevard.ewRow + dy });
      }
    }
    if (axis !== "ew") {
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let dx = -half; dx <= half; dx += 1) cells.push({ x: boulevard.nsCol + dx, y });
      }
    }
    return cells;
  }
  const path = activeBoulevardPaths(area, boulevard, seed);
  const cells: Point[] = [];
  for (const cell of path.ew) {
    for (let dy = -half; dy <= half; dy += 1) cells.push({ x: cell.x, y: cell.y + dy });
  }
  for (const cell of path.ns) {
    for (let dx = -half; dx <= half; dx += 1) cells.push({ x: cell.x + dx, y: cell.y });
  }
  return cells;
}

/** 스타일별 길 몸통 타일. stone = 포석(129 블록) 몸통 190. */
function roadBodyTile(style: RoadStyle): number {
  if (style === "dirt") return DIRT_ROAD_TILE.BODY;
  if (style === "stone") return COBBLE_TILE.BODY;
  return SAND_TILE.BODY;
}

/** 스타일별 오토타일 성형. */
function shapeRoadStyle(map: GameMap, style: RoadStyle, cells: readonly Point[]): void {
  if (cells.length === 0) return;
  const blocked = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const group = style === "dirt" ? DEFAULT_ROAD_AUTOTILE_GROUP : style === "stone" ? DEFAULT_COBBLE_AUTOTILE_GROUP : DEFAULT_SAND_AUTOTILE_GROUP;
  shapeAutotileGroupAround(map, group, cells, (x, y) => !blocked.has(coordKey(x, y)));
}

/**
 * 길 시공 강제 훅(2026-07-16 사용자 지시) — 시뮬레이션식:
 * ① 시공 전 스냅샷 → ② 광장 루프·간선·스퍼·재연결·직선 분절 시공 → ③ 침범 점검
 * (시공 영역 밖 / 금지 구역: 수역·집 보호구역·데크) → ④ 침범이면 롤백 후 지터 시드를
 * 바꿔 재시도, 최대 100회 → ⑤ 전부 실패하면 지터를 끈 직선 시공으로 폴백.
 * 침범 판정은 "이번 시공이 새로 만든 길 칸"만 본다(기존 맵 잔존물 무시).
 */
/** 길 재시도 기계 리포트 — 맹목 재시도 대신 원인을 기계 가독으로 남긴다. */
export type RoadRetryReport = {
  /** 0=첫 시도 통과, 1..99=롤백 재시도 후 통과, 100=직선 폴백 통과 */
  readonly attempts: number;
  /** 시도별 잔존 침범 칸 수(마지막이 0이면 통과) */
  readonly violationTrace: readonly number[];
  /** 침범 종류별 잔존(마지막 시도 기준): 집/수역·데크 vs 영역 밖 */
  readonly residualForbidden: number;
  readonly residualOutside: number;
  readonly fallbackStraight: boolean;
};

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
  readonly boulevard?: Boulevard | null;
  /** 재시도 리포트 수집용 — 주면 시도별 침범 추이와 잔존 분류가 기록된다. */
  readonly retryReport?: { readonly report: RoadRetryReport | undefined };
}): number {
  const { draft, map, plaza, area, houses, intent, seed, warnings, hardBlocked, throughBlocked, forbidden, boulevard, retryReport } = args;
  const sealed = captureHouseProtection(draft);
  const assertSealed = (): void => assertHouseProtection(sealed, draft, []);
  const owned = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  const MAX_RETRY = 100;
  const baseLower = [...map.lowerTiles];
  const baseUpper = [...map.upperTiles];
  // 대로 칸은 조그 분절·가지치기에서 보호한다 — 곡선 골격이 끊기거나 곧게 펴지면 안 된다.
  // Explicit street grids retain straight frontage; organic layouts use the seeded curve.
  const boulevardBand = boulevard
    ? boulevardCells(area, boulevard, intent.settlementLayout === "street-grid" ? undefined : seed)
    : [];
  const boulevardProtected = new Set(boulevardBand.map((cell) => coordKey(cell.x, cell.y)));
  for (const house of houses) for (const cell of house.objectExterior?.access ?? []) {
    boulevardProtected.add(coordKey(cell.x, cell.y));
  }

  const paintOnce = (runIntent: VillageIntent, runSeed: number): void => {
    if (boulevard) {
      // 대로 먼저(spine-first) — 밴드는 집 배치 전에 예약돼 있어 구멍이 없다.
      paintRoadCellsAvoidingHouses(map, runIntent.pathStyle, boulevardBand, hardBlocked);
      assertSealed();
    }
    paintPlazaAndAvenue(draft, map, plaza, area, runIntent, runSeed, warnings, throughBlocked, boulevard, seed, houses);
    assertSealed();
    connectHousesToRoads(draft, map, area, plaza, houses, runIntent, runSeed, warnings, hardBlocked);
    assertSealed();
    ensureSingleRoadComponent(map, area, hardBlocked, runIntent.pathStyle, throughBlocked);
    assertSealed();
    breakLongStraightRuns(map, area, hardBlocked, runIntent.pathStyle, houses, boulevardProtected);
    assertSealed();
    pruneDeadEndStubs(map, area, houses, runIntent.pathStyle, boulevardProtected, plaza);
    assertSealed();
    // 마감 2패스(2026-07-17): 분절·가지치기·밀집 스퍼가 남긴 고아 조각을 재연결 시도 후,
    // 그래도 남은 문 없는 소형 고아(<20칸)는 소거한다 — "길 성분 1" 감사 보증.
    ensureSingleRoadComponent(map, area, hardBlocked, runIntent.pathStyle, throughBlocked);
    assertSealed();
    eraseOrphanRoadFragments(map, area, houses, runIntent.pathStyle);
    assertSealed();
  };
  const restore = (): void => {
    for (let i = 0; i < baseLower.length; i += 1) {
      if (owned.has(i)) continue;
      map.lowerTiles[i] = baseLower[i]!;
      map.upperTiles[i] = baseUpper[i]!;
    }
  };
  const countViolations = (): { total: number; forbidden: number; outside: number } => {
    let total = 0;
    let forbiddenCount = 0;
    let outsideCount = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        const lower = map.lowerTiles[index] ?? TILE.EMPTY;
        if (!ROAD_TILES.has(lower) || baseLower[index] === lower) continue; // 이번 시공분만
        const outside = x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h;
        if (!outside && !forbidden.has(coordKey(x, y))) continue;
        total += 1;
        if (forbidden.has(coordKey(x, y))) forbiddenCount += 1;
        if (outside) outsideCount += 1;
      }
    }
    return { total, forbidden: forbiddenCount, outside: outsideCount };
  };
  const recordReport = (trace: readonly number[], last: { total: number; forbidden: number; outside: number }, attempts: number, fallbackStraight: boolean): void => {
    if (!retryReport) return;
    (retryReport as { report: RoadRetryReport | undefined }).report = {
      attempts,
      violationTrace: [...trace],
      residualForbidden: last.forbidden,
      residualOutside: last.outside,
      fallbackStraight,
    };
  };

  const violationTrace: number[] = [];
  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    if (attempt > 0) restore();
    paintOnce(intent, seed + attempt * 7919);
    const violations = countViolations();
    violationTrace.push(violations.total);
    if (violations.total === 0) {
      if (attempt > 0) warnings.push(`길 침범 점검: ${attempt}회 롤백 재시도 후 통과`);
      recordReport(violationTrace, violations, attempt, false);
      return attempt;
    }
  }
  // 100회 전부 침범 — 지터를 끄고 직선으로 깐다(침범 원인 제거).
  restore();
  paintOnce({ ...intent, roadNaturalness: 0 }, seed);
  const residual = countViolations();
  violationTrace.push(residual.total);
  if (residual.total === 0) {
    warnings.push(`길 침범 점검: ${MAX_RETRY}회 실패 → 직선 폴백으로 통과`);
    recordReport(violationTrace, residual, MAX_RETRY, true);
    return MAX_RETRY;
  }
  // 금지선 하드 게이트(2026-09-04) — 직선 폴백에도 집/수역 침범이 남으면 성공 반환 금지.
  // 기존 "수동 확인 필요" 경고는 성공 결과에 묻혀 아무도 안 봤다.
  recordReport(violationTrace, residual, MAX_RETRY, true);
  throw new ToolError(
    `길 금지선 침범: 직선 폴백에도 침범 ${residual.total}칸 잔존(금지 ${residual.forbidden}/영역밖 ${residual.outside}) — 집 footprint·수역·데크 마스크와 area가 겹친다. bounds를 넓히거나 houses를 줄여라.`,
    { code: "road-forbidden-residual" },
  );
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
  boulevard: Boulevard | null = null,
  // 토폴로지 고정 시드(2026-09-04) — 재시도(runSeed)가 바뀌어도 앵커·분기 갈래는
  // 원본 시드에 묶어 둔다. layoutPlan.roadAnchors가 원본 시드로 기록되므로,
  // 재시도마다 앵커가 drift하면 exitRoads 게이트가 빈 칸을 읽고 오실패한다.
  topologySeed?: number,
  // 집 먼저(2026-09-17) — 유기적 배치는 집 앞을 잇는 골격을 깐다. 비우면 광장 결절 골격만.
  houses: readonly BuiltHouse[] = [],
): void {
  const pathStyle = intent.pathStyle;
  const width = intent.roadWidth;
  const naturalness = intent.roadNaturalness;
  if (intent.plazaStyle === "market") paintMarketDeck(map, plaza.rect);

  // garden/market은 광장 rect가 도로 봉쇄 구역이라, 링을 rect 바깥 1칸으로 두른다 —
  // 링이 없으면 광장 가장자리로 향하던 집 스퍼가 고아 성분이 된다 (2026-07-17).
  const ringRect = intent.plazaStyle === "garden" || intent.plazaStyle === "market"
    ? { x: plaza.rect.x - 1, y: plaza.rect.y - 1, w: plaza.rect.w + 2, h: plaza.rect.h + 2 }
    : plaza.rect;
  const loop: readonly Point[] = [
    { x: ringRect.x, y: ringRect.y + 1 },
    { x: plaza.centerX, y: ringRect.y - 1 },
    { x: ringRect.x + ringRect.w - 1, y: ringRect.y },
    { x: ringRect.x + ringRect.w, y: plaza.centerRow },
    { x: ringRect.x + ringRect.w - 2, y: ringRect.y + ringRect.h - 1 },
    { x: plaza.centerX - 1, y: ringRect.y + ringRect.h },
    { x: ringRect.x, y: ringRect.y + ringRect.h - 2 },
    { x: ringRect.x, y: ringRect.y + 1 },
  ];
  paintWideRoad(draft, map, pathStyle, loop, 1, Math.max(0.65, naturalness), seed + 7, warnings, houseBlocked);

  const topology = topologySeed ?? seed;
  if (intent.settlementLayout === "street-grid") {
    // 격자 마을만 4변 간선(+ 대로 2축)을 유지한다 — 십자 위상이 의도인 유일한 배치.
    // 대로 모드: 골격은 대로가 담당하므로 가는 간선 4갈래는 깔지 않는다(스텁·평행 중복 원인).
    if (boulevard) return;
    const routes = villageArteryRoutes(area, plaza, topology, naturalness, seed);
    for (let route = 0; route < routes.length; route += 1) {
      paintWideRoad(draft, map, pathStyle, routes[route]!, Math.max(1, width - 1), naturalness, seed + 20 + route * 11, warnings, houseBlocked);
    }
    return;
  }

  // 유기적 배치(2026-09-17): 집 먼저, 길은 집 앞을 잇는 최소 신장 골격 + 시드로 고른 2~3변 출구.
  // 예전엔 배치와 무관하게 광장→4변 간선을 먼저 깔아 어떤 시드든 십자로 읽혔다.
  // 대로 축의 양 끝은 밴드가 이미 칠했으니, 여기선 대로가 아닌 변의 출구만 이어 준다.
  const boulevardSides: readonly ExitSide[] = boulevard === null
    ? []
    : boulevard.axis === "ew" ? ["west", "east"] : boulevard.axis === "ns" ? ["north", "south"] : ["north", "south", "west", "east"];
  const exits = villageExitAnchors(area, plaza, topology, intent.settlementLayout, boulevard)
    .filter((anchor) => !boulevardSides.includes(anchor.side));
  const network = villageStreetNetwork(area, plaza, houses, exits, topology, seed);
  for (let i = 0; i < network.length; i += 1) {
    const route = network[i]!;
    const routeWidth = route.kind === "exit" ? Math.max(1, width - 1) : 1;
    paintWideRoad(draft, map, pathStyle, route.points, routeWidth, naturalness, seed + 20 + i * 11, warnings, houseBlocked);
  }
}

export function villageRoadAnchors(area: Rect, plaza: Plaza, seed: number): readonly Point[] {
  const rng = mulberry32((seed ^ 0x8da6b343) >>> 0);
  // 앵커 확산(2026-09-04) — 예전 ±2 오프셋은 N/S 앵커가 항상 광장 중심 x 근처에 붙어
  // 남북 간선이 일직선(= 십자가 세로축)으로 굳었다. 가장자리 1/5 폭으로 흩어 꺾인 진입을 만든다.
  const spreadX = Math.max(4, Math.floor(area.w / 5));
  const spreadY = Math.max(4, Math.floor(area.h / 5));
  const spread = (half: number): number => Math.floor(rng() * (half * 2 + 1)) - half;
  return [
    { x: clamp(plaza.centerX + spread(spreadX), area.x + 1, area.x + area.w - 2), y: area.y },
    { x: clamp(plaza.centerX + spread(spreadX), area.x + 1, area.x + area.w - 2), y: area.y + area.h - 1 },
    { x: area.x, y: clamp(plaza.centerRow + spread(spreadY), area.y + 1, area.y + area.h - 2) },
    { x: area.x + area.w - 1, y: clamp(plaza.centerRow + spread(spreadY), area.y + 1, area.y + area.h - 2) },
  ];
}

export type ExitSide = "north" | "south" | "west" | "east";
export type ExitAnchor = Point & { readonly side: ExitSide };
const EXIT_SIDES: readonly ExitSide[] = ["north", "south", "west", "east"];

/**
 * 출구 앵커(2026-09-17) — 예전엔 4변 4앵커가 상수였다. 그래서 어떤 시드든 마을은 사방으로
 * 길이 뻗는 십자 위상이 됐다. 유기적 배치(plaza-ring/clusters)는 시드로 2~3변만 고르고,
 * street-grid 만 4변을 유지한다. 대로가 있으면 대로 축의 양 끝단이 출구다(+40%로 한 변 추가).
 * 토폴로지 시드에 묶여 재시도(runSeed)에도 흔들리지 않는다 — layoutPlan.roadAnchors 와 일치해야 한다.
 */
export function villageExitAnchors(
  area: Rect,
  plaza: Plaza,
  seed: number,
  layout?: string,
  boulevard: Boulevard | null = null,
): readonly ExitAnchor[] {
  const four = villageRoadAnchors(area, plaza, seed);
  const bySide = (side: ExitSide): ExitAnchor => ({ ...four[EXIT_SIDES.indexOf(side)]!, side });
  if (layout === "street-grid") return EXIT_SIDES.map(bySide);
  const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
  if (boulevard !== null && boulevard.axis !== "both") {
    const paths = activeBoulevardPaths(area, boulevard, seed);
    const anchors: ExitAnchor[] = [];
    if (paths.ew.length > 0) {
      anchors.push({ ...paths.ew[0]!, side: "west" }, { ...paths.ew[paths.ew.length - 1]!, side: "east" });
    }
    if (paths.ns.length > 0) {
      anchors.push({ ...paths.ns[0]!, side: "north" }, { ...paths.ns[paths.ns.length - 1]!, side: "south" });
    }
    if (rng() < 0.4) {
      const rest = EXIT_SIDES.filter((side) => !anchors.some((anchor) => anchor.side === side));
      const pick = rest[Math.floor(rng() * rest.length)];
      if (pick !== undefined) anchors.push(bySide(pick));
    }
    return anchors;
  }
  if (boulevard !== null) return EXIT_SIDES.map(bySide);
  const order = [...EXIT_SIDES];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const count = rng() < 0.5 ? 2 : 3;
  return order.slice(0, count)
    .sort((a, b) => EXIT_SIDES.indexOf(a) - EXIT_SIDES.indexOf(b))
    .map(bySide);
}

type StreetNode = { readonly at: Point; readonly bbox: Rect; readonly plaza: boolean };
export type StreetRoute = { readonly kind: "street" | "exit"; readonly points: readonly Point[] };

function dedupePoints(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.x === p.x && prev.y === p.y) continue;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** 광장 rect 변 위에서 `from` 에 가장 가까운 접점 — 광장은 문이 없으니 오는 방향의 변에 붙인다. */
function plazaJoinPoint(rect: Rect, from: Point): Point {
  const cx = clamp(from.x, rect.x, rect.x + rect.w - 1);
  const cy = clamp(from.y, rect.y, rect.y + rect.h - 1);
  if (from.y < rect.y) return { x: cx, y: rect.y };
  if (from.y >= rect.y + rect.h) return { x: cx, y: rect.y + rect.h - 1 };
  if (from.x < rect.x) return { x: rect.x, y: cy };
  return { x: rect.x + rect.w - 1, y: cy };
}

/** 축 평행 구간 [a,b] 가 rect 안쪽 칸을 하나라도 지나는가. */
function segmentHitsRect(a: Point, b: Point, box: Rect): boolean {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return x1 >= box.x && x0 <= box.x + box.w - 1 && y1 >= box.y && y0 <= box.y + box.h - 1;
}

function routeClear(points: readonly Point[], obstacles: readonly Rect[]): boolean {
  for (let i = 0; i + 1 < points.length; i += 1) {
    for (const box of obstacles) if (segmentHitsRect(points[i]!, points[i + 1]!, box)) return false;
  }
  return true;
}

/**
 * 후보 열을 골라 경로를 만든다. 가운데 1/3 구간을 선호하고(양 끝에 붙으면 벽 밀착 골목처럼 보임),
 * 구간 안에 깨끗한 열이 없으면 바깥으로 한 칸씩 넓혀 찾는다. 끝내 없으면 첫 후보로 그냥 간다 —
 * 칠하는 단계의 집 마스크가 마지막 방어선이다.
 */
function pickClearRoute(
  lo: number,
  hi: number,
  area: Rect,
  rng: () => number,
  obstacles: readonly Rect[],
  build: (column: number) => Point[],
): Point[] {
  const minX = area.x + 1;
  const maxX = area.x + area.w - 2;
  const clear: number[] = [];
  for (let x = Math.max(minX, lo); x <= Math.min(maxX, hi); x += 1) if (routeClear(build(x), obstacles)) clear.push(x);
  if (clear.length > 0) {
    const inner = clear.filter((x) => x >= lo + (hi - lo) * 0.3 && x <= lo + (hi - lo) * 0.7);
    const pool = inner.length > 0 ? inner : clear;
    return build(pool[Math.floor(rng() * pool.length)]!);
  }
  for (let d = 1; lo - d >= minX || hi + d <= maxX; d += 1) {
    for (const x of [hi + d, lo - d]) {
      if (x < minX || x > maxX) continue;
      if (routeClear(build(x), obstacles)) return build(x);
    }
  }
  return build(clamp(Math.round((lo + hi) / 2), minX, maxX));
}

/**
 * 두 집 앞을 잇는 꺾인 골목 — 가로(a 앞 행) → 세로(빈 열) → 가로(b 앞 행).
 * 세 구간 모두를 마을의 모든 집 몸통과 대조해 고른다(2026-09-17): 예전엔 세로 열만 두 footprint 를
 * 피했고, a 앞 행의 가로 구간이 b 몸통(또는 제3의 집)을 관통했다. 대각 직선은 절대 만들지 않는다 —
 * 회피 로직이 구멍을 내고 단일 성분 보수가 벽 밀착 골목으로 메우던 원인.
 */
function alleyRoute(a: StreetNode, b: StreetNode, area: Rect, rng: () => number, obstacles: readonly Rect[]): Point[] {
  if (b.plaza) {
    // 광장으로: 앞 행에서 빈 열로 꺾고, 접점 행까지 내려간 뒤 광장 변으로 — 열→접점 대각선 금지.
    const probe = plazaJoinPoint(b.bbox, a.at);
    const lo = Math.min(a.at.x, probe.x);
    const hi = Math.max(a.at.x, probe.x);
    return pickClearRoute(lo, hi, area, rng, obstacles, (column) => {
      const join = plazaJoinPoint(b.bbox, { x: column, y: a.at.y });
      return dedupePoints([a.at, { x: column, y: a.at.y }, { x: column, y: join.y }, join]);
    });
  }
  const lo = Math.min(a.at.x, b.at.x);
  const hi = Math.max(a.at.x, b.at.x);
  return pickClearRoute(lo, hi, area, rng, obstacles, (column) =>
    dedupePoints([a.at, { x: column, y: a.at.y }, { x: column, y: b.at.y }, b.at]));
}

/** 변 앵커 → 가장 가까운 결절. 북/남은 3~6칸 들어온 뒤 골목 규칙으로 꺾고, 동/서는 진입 행에서 바로 꺾는다. */
function exitRoute(anchor: ExitAnchor, target: StreetNode, area: Rect, rng: () => number, obstacles: readonly Rect[]): Point[] {
  const stepIn = 3 + Math.floor(rng() * 4);
  const entry: Point = anchor.side === "north"
    ? { x: anchor.x, y: Math.min(anchor.y + stepIn, area.y + area.h - 2) }
    : anchor.side === "south"
      ? { x: anchor.x, y: Math.max(anchor.y - stepIn, area.y + 1) }
      : anchor;
  const virtual: StreetNode = { at: entry, bbox: { x: entry.x, y: entry.y, w: 1, h: 1 }, plaza: false };
  const tail = alleyRoute(virtual, target, area, rng, obstacles);
  return dedupePoints([anchor, ...tail]);
}

/**
 * 집 먼저 골격(2026-09-17) — 결절 = 집 앞(front) + 광장. 맨해튼 거리 Prim 최소 신장 트리로
 * 모든 집을 잇고, 잎 결절 일부는 근처 결절과 한 번 더 이어 고리를 만든다(막다른 골목 완화).
 * 출구는 가장 가까운 결절에 붙는다. 시드(seed)는 위상, jitterSeed 는 꺾는 열·고리 선택에만 쓴다 —
 * 재시도마다 위상이 바뀌면 layoutPlan.roadAnchors 와 어긋난다.
 */
export function villageStreetNetwork(
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  exits: readonly ExitAnchor[],
  seed: number,
  jitterSeed: number = seed,
): readonly StreetRoute[] {
  const rng = mulberry32((jitterSeed ^ 0x2545f491) >>> 0);
  const topo = mulberry32((seed ^ 0x6a09e667) >>> 0);
  const plazaNode: StreetNode = {
    at: { x: plaza.centerX, y: plaza.rect.y + plaza.rect.h },
    bbox: plaza.rect,
    plaza: true,
  };
  const nodes: StreetNode[] = [plazaNode, ...houses.map((house) => ({ at: house.front, bbox: house.bbox, plaza: false }))];
  const obstacles: readonly Rect[] = houses.map((house) => house.bbox);
  const dist = (i: number, j: number): number => {
    const a = nodes[i]!;
    const b = nodes[j]!;
    const pa = a.plaza ? plazaJoinPoint(a.bbox, b.at) : a.at;
    const pb = b.plaza ? plazaJoinPoint(b.bbox, a.at) : b.at;
    return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
  };
  const edges: [number, number][] = [];
  const inTree = nodes.map((_, i) => i === 0);
  for (let added = 1; added < nodes.length; added += 1) {
    let best: [number, number] | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodes.length; i += 1) {
      if (!inTree[i]) continue;
      for (let j = 0; j < nodes.length; j += 1) {
        if (inTree[j]) continue;
        const d = dist(i, j);
        if (d < bestDist) { bestDist = d; best = [i, j]; }
      }
    }
    if (best === null) break;
    inTree[best[1]] = true;
    edges.push(best);
  }
  // 고리: 잎 결절(차수 1인 집)을 근처 비인접 결절과 잇는다. 최대 floor(집/4)개.
  const degree = nodes.map(() => 0);
  for (const [i, j] of edges) { degree[i]! += 1; degree[j]! += 1; }
  const adjacent = (i: number, j: number): boolean => edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  const leaves = nodes.map((_, i) => i).filter((i) => i > 0 && degree[i] === 1);
  for (let i = leaves.length - 1; i > 0; i -= 1) {
    const j = Math.floor(topo() * (i + 1));
    [leaves[i], leaves[j]] = [leaves[j]!, leaves[i]!];
  }
  let extra = 0;
  const extraCap = Math.floor(houses.length / 4);
  for (const leaf of leaves) {
    if (extra >= extraCap) break;
    let near = -1;
    let nearDist = 14;
    for (let j = 0; j < nodes.length; j += 1) {
      if (j === leaf || adjacent(leaf, j)) continue;
      const d = dist(leaf, j);
      if (d <= nearDist) { nearDist = d; near = j; }
    }
    if (near < 0 || topo() >= 0.6) continue;
    edges.push([leaf, near]);
    extra += 1;
  }
  const routes: StreetRoute[] = edges.map(([i, j]) => {
    // 광장은 항상 목적지 쪽(b)으로 두어 골목 규칙(집 앞 행에서 출발)이 성립하게 한다.
    const [from, to] = nodes[i]!.plaza ? [nodes[j]!, nodes[i]!] : [nodes[i]!, nodes[j]!];
    return { kind: "street", points: alleyRoute(from, to, area, rng, obstacles) };
  });
  for (const anchor of exits) {
    let near = 0;
    let nearDist = Number.POSITIVE_INFINITY;
    for (let j = 0; j < nodes.length; j += 1) {
      const node = nodes[j]!;
      const p = node.plaza ? plazaJoinPoint(node.bbox, anchor) : node.at;
      const d = Math.abs(p.x - anchor.x) + Math.abs(p.y - anchor.y);
      if (d < nearDist) { nearDist = d; near = j; }
    }
    routes.push({ kind: "exit", points: exitRoute(anchor, nodes[near]!, area, rng, obstacles) });
  }
  return routes;
}

/**
 * 간선 중심선(2026-09-04) — 4갈래 중 1갈래는 광장이 아니라 다른 간선에 T자로 붙는다.
 * 예전엔 4갈래가 전부 광장 rect 변에 닿아 광장이 십자가 결절점이 됐다. 시드별 분기 갈래가
 * 달라지므로(4-cycle) 매번 같은 plus 위상이 반복되지 않는다. paintPlazaAndAvenue가 그대로 쓴다.
 * 앵커·분기 갈래는 seed에 묶고, 흔들림(swing)만 jitterSeed에서 뽑는다 — 재시도마다
 * 토폴로지가 바뀌면 layoutPlan.roadAnchors(원본 seed 기록)와 어긋나 exitRoads가 깨진다.
 */
export function villageArteryRoutes(area: Rect, plaza: Plaza, seed: number, naturalness: number, jitterSeed: number = seed): readonly (readonly Point[])[] {
  const anchors = villageRoadAnchors(area, plaza, seed);
  const rng = mulberry32((jitterSeed ^ 0x5f3759df) >>> 0);
  const swing = (): number => Math.round((rng() - 0.5) * (6 + naturalness * 8));
  const edge = (n: number): number => Math.max(0, Math.floor(n));
  const cx = (x: number): number => clamp(x, area.x + 1, area.x + area.w - 2);
  const cy = (y: number): number => clamp(y, area.y + 1, area.y + area.h - 2);
  const northJoinX = plaza.rect.x + edge(rng() * plaza.rect.w);
  const southJoinX = plaza.rect.x + edge(rng() * plaza.rect.w);
  const westJoinY = plaza.rect.y + edge(rng() * plaza.rect.h);
  const eastJoinY = plaza.rect.y + edge(rng() * plaza.rect.h);
  const northAnchor = anchors[0]!;
  const southAnchor = anchors[1]!;
  const westAnchor = anchors[2]!;
  const eastAnchor = anchors[3]!;
  const q = (from: number, to: number, t: number): number => Math.floor(from + (to - from) * t);
  const onLine = (a: Point, b: Point, p: Point): boolean =>
    (b.x - a.x) * (p.y - a.y) === (b.y - a.y) * (p.x - a.x);
  // [1]·[2] 중점 + 흔들림. 흔들림이 0으로 맞아떨어져 선 위에 떨어지면(축 평행 다리에서 흔함)
  // 수직으로 2칸 밀어 비공선을 보장한다 — 직선 굳기 방지의 핵심이 우연에 맡겨지면 안 된다.
  // 양쪽 부호를 시도하므로 가장자리 클램프에 뭉개져도 살아남는다.
  const joggedMid = (a: Point, b: Point): Point => {
    const mid = {
      x: cx(Math.floor((a.x + b.x) / 2) + swing()),
      y: cy(Math.floor((a.y + b.y) / 2) + swing()),
    };
    if (!onLine(a, b, mid)) return mid;
    const sign = rng() < 0.5 ? -1 : 1;
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const nudges: readonly Point[] = horizontal
      ? [{ x: mid.x, y: cy(mid.y + 2 * sign) }, { x: mid.x, y: cy(mid.y - 2 * sign) }]
      : [{ x: cx(mid.x + 2 * sign), y: mid.y }, { x: cx(mid.x - 2 * sign), y: mid.y }];
    for (const nudged of nudges) {
      const distinct = (nudged.x !== a.x || nudged.y !== a.y) && (nudged.x !== b.x || nudged.y !== b.y);
      if (distinct && !onLine(a, b, nudged)) return nudged;
    }
    return mid;
  };
  const plazaRoutes: (readonly Point[])[] = [
    [
      northAnchor,
      { x: cx(northAnchor.x + swing()), y: q(area.y, plaza.rect.y, 0.4) },
      { x: cx(northJoinX + swing()), y: q(area.y, plaza.rect.y, 0.8) },
      { x: northJoinX, y: plaza.rect.y },
    ],
    [
      southAnchor,
      { x: cx(southAnchor.x + swing()), y: q(area.y + area.h - 1, plaza.rect.y + plaza.rect.h - 1, 0.4) },
      { x: cx(southJoinX + swing()), y: q(area.y + area.h - 1, plaza.rect.y + plaza.rect.h - 1, 0.8) },
      { x: southJoinX, y: plaza.rect.y + plaza.rect.h - 1 },
    ],
    [
      westAnchor,
      { x: q(area.x, plaza.rect.x, 0.4), y: cy(westAnchor.y + swing()) },
      { x: q(area.x, plaza.rect.x, 0.8), y: cy(westJoinY + swing()) },
      { x: plaza.rect.x, y: westJoinY },
    ],
    [
      eastAnchor,
      { x: q(area.x + area.w - 1, plaza.rect.x + plaza.rect.w - 1, 0.4), y: cy(eastAnchor.y + swing()) },
      { x: q(area.x + area.w - 1, plaza.rect.x + plaza.rect.w - 1, 0.8), y: cy(eastJoinY + swing()) },
      { x: plaza.rect.x + plaza.rect.w - 1, y: eastJoinY },
    ],
  ];
  // 직선 4점 굳기 방지 — [1]과 [2] 사이에 흔들린 경유점 하나를 끼운다.
  // [1]은 그대로라 T-분기 host[1] 조인은 그대로 통과한다.
  const widened: (readonly Point[])[] = plazaRoutes.map((route) => {
    const start = route[0]!;
    const first = route[1]!;
    const second = route[2]!;
    const last = route[3]!;
    return [start, first, joggedMid(first, second), second, last];
  });
  // 분기 갈래: 자기 간선을 버리고 인접 축 간선 mid에 합류한다. 가장자리 출구는 유지되므로
  // exitRoads=4 게이트와 4변 출구 테스트는 그대로 통과한다.
  // [N,S,W,E] 순서에서 +2는 항상 인접 축(N→W, S→E, W→N, E→S)이다.
  // +1은 seed%4가 짝수일 때 정반대 축에 붙어 plus가 살아남는다.
  const branchIndex = ((seed % 4) + 4) % 4;
  const hostIndex = (branchIndex + 2) % 4;
  const branchAnchor = anchors[branchIndex]!;
  const hostMid = widened[hostIndex]![1]!;
  const branched: (readonly Point[])[] = widened.map((route, index) => {
    if (index !== branchIndex) return route;
    const mid = { x: cx(q(branchAnchor.x, hostMid.x, 0.5) + swing()), y: cy(q(branchAnchor.y, hostMid.y, 0.5) + swing()) };
    return [branchAnchor, mid, joggedMid(mid, hostMid), hostMid];
  });
  return branched;
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
  protectedExtra: ReadonlySet<string> = EMPTY_BLOCKED,
): void {
  const body = roadBodyTile(pathStyle);
  // 분절 임계(2026-09-04): 예전 0.42는 50맵에서 maxRun=21이라 간선 한 팔(~20칸)을
  // 거의 건드리지 않아 plus 위상이 굳었다. 0.3(50맵 maxRun=15)으로 낮춰 간선을 꺾는다.
  // 대로는 보호 집합(boulevardProtected)으로 여전히 제외되므로 대로 직선성은 유지된다.
  const maxRun = Math.max(12, Math.floor(Math.max(map.width, map.height) * 0.3));
  const isRoad = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const isGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY;
  // 문 앞 게이트 보호: front 행의 door.x±1은 제거 금지. 대로 칸도 제거 금지(protectedExtra).
  const protectedCells = new Set([...protectedExtra, ...protectedHouseCells(map).map(({ x, y }) => coordKey(x, y))]);
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
      if (removeCells.some((cell) => protectedCells.has(coordKey(cell.x, cell.y)) || hardBlocked.has(coordKey(cell.x, cell.y)))) continue;
      if (!addCells.every((cell) =>
        cell.x > area.x && cell.y > area.y && cell.x < area.x + area.w - 1 && cell.y < area.y + area.h - 1
        && !hardBlocked.has(coordKey(cell.x, cell.y)) && !protectedCells.has(coordKey(cell.x, cell.y))
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

/**
 * 광장 보호 칸 — 길이 광장 내부를 갈아엎지 못하게 하드 차단.
 * market: 데크. garden: 울타리·꽃밭·석상 구역 전체 (2026-07-17 — 물결 간선·스퍼가
 * 광장을 관통해 울타리가 끊기던 버그의 근본 수정. 출입은 남쪽 게이트 길로만).
 */
export function plazaDeckBlockedCells(plaza: Plaza, intent: VillageIntent): Set<string> {
  const blocked = new Set<string>();
  if (intent.plazaStyle !== "market" && intent.plazaStyle !== "garden") return blocked;
  for (let y = plaza.rect.y; y < plaza.rect.y + plaza.rect.h; y += 1) {
    for (let x = plaza.rect.x; x < plaza.rect.x + plaza.rect.w; x += 1) {
      blocked.add(coordKey(x, y));
    }
  }
  return blocked;
}

/**
 * garden 광장 게이트 길(2026-07-17) — 울타리 남쪽 게이트(3칸)에서 광장 밖 도로(대로)까지
 * 짧은 진입로를 깐다. 광장 rect는 도로 마스크로 봉쇄돼 있으므로 이 함수가 유일한 통로다.
 */
export function paintPlazaGatePath(map: GameMap, plaza: Plaza, pathStyle: RoadStyle): void {
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const rect = plaza.rect;
  const innerX = rect.x + 1;
  const innerW = Math.max(1, rect.w - 2);
  const gateC = innerX + Math.floor(innerW / 2);
  const painted: Point[] = [];
  for (let y = rect.y + rect.h - 1; y <= rect.y + rect.h; y += 1) {
    for (let x = gateC - 1; x <= gateC + 1; x += 1) {
      if (!inMapBounds(map, x, y) || protectedCells.has(coordKey(x, y))) continue;
      const index = y * map.width + x;
      if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
      if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
      map.lowerTiles[index] = roadBodyTile(pathStyle);
      painted.push({ x, y });
    }
  }
  if (painted.length > 0) shapeRoadStyle(map, pathStyle, painted);
}

/**
 * 고아 도로 조각 소거(2026-07-17) — 최대 성분·집 문이 붙은 성분만 남기고,
 * 20칸 미만의 고아 조각을 잔디로 되돌린다. 재연결이 실패한 잔여물의 최종 방어선.
 */
export function eraseOrphanRoadFragments(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  pathStyle: RoadStyle,
): void {
  const isRoad = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const seen = new Set<string>();
  const components: Point[][] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (!isRoad(x, y) || seen.has(coordKey(x, y))) continue;
      const cells: Point[] = [];
      const stack: Point[] = [{ x, y }];
      seen.add(coordKey(x, y));
      while (stack.length > 0) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          if (!isRoad(nx, ny) || seen.has(coordKey(nx, ny))) continue;
          seen.add(coordKey(nx, ny));
          stack.push({ x: nx, y: ny });
        }
      }
      components.push(cells);
    }
  }
  if (components.length <= 1) return;
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const fronts = new Set(houses.map((house) => coordKey(house.front.x, house.front.y)));
  const touchesFront = (cells: readonly Point[]): boolean =>
    cells.some((cell) =>
      fronts.has(coordKey(cell.x, cell.y)) || fronts.has(coordKey(cell.x, cell.y - 1)) || fronts.has(coordKey(cell.x, cell.y + 1))
      || fronts.has(coordKey(cell.x - 1, cell.y)) || fronts.has(coordKey(cell.x + 1, cell.y)));
  const largest = components.reduce((best, cells) => (cells.length > best.length ? cells : best), components[0]!);
  const changed: Point[] = [];
  for (const cells of components) {
    if (cells === largest || cells.length >= 20 || touchesFront(cells)
      || cells.some(({ x, y }) => protectedCells.has(coordKey(x, y)))) continue;
    for (const cell of cells) {
      map.lowerTiles[cell.y * map.width + cell.x] = TILE.GRASS;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (isRoad(cell.x + dx, cell.y + dy)) changed.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }
  if (changed.length > 0) shapeRoadStyle(map, pathStyle, changed);
}

/**
 * 막다른 토막길 가지치기(2026-07-17, 리서치 ⑤ 마감 패스) — 이웃 도로가 1칸 이하인
 * 끝 칸을 반복 회수한다. 문앞 게이트(front±1)·대로·광장 게이트 주변은 보호.
 * 집 진입 스퍼는 front 칸에서 끝나므로 보호 집합이 지켜준다.
 */
export function pruneDeadEndStubs(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  pathStyle: RoadStyle,
  protectedExtra: ReadonlySet<string>,
  plaza: Plaza,
): void {
  const protectedCells = new Set([...protectedExtra, ...protectedHouseCells(map).map(({ x, y }) => coordKey(x, y))]);
  for (const house of houses) {
    for (let dy = 0; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) protectedCells.add(coordKey(house.front.x + dx, house.front.y + dy));
    }
  }
  // 광장 게이트 길 보호 (남쪽 게이트 아래 3열)
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dy = 0; dy <= 3; dy += 1) protectedCells.add(coordKey(plaza.centerX + dx, plaza.rect.y + plaza.rect.h - 1 + dy));
  }
  const isRoad = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const changed: Point[] = [];
  for (let round = 0; round < 6; round += 1) {
    const removals: Point[] = [];
    // 가장자리 2칸 밴드는 건드리지 않는다 — 맵 경계로 나가는 진입로는 의도된 막다른 길.
    for (let y = area.y + 2; y < area.y + area.h - 2; y += 1) {
      for (let x = area.x + 2; x < area.x + area.w - 2; x += 1) {
        if (!isRoad(x, y) || protectedCells.has(coordKey(x, y))) continue;
        let neighbors = 0;
        if (isRoad(x + 1, y)) neighbors += 1;
        if (isRoad(x - 1, y)) neighbors += 1;
        if (isRoad(x, y + 1)) neighbors += 1;
        if (isRoad(x, y - 1)) neighbors += 1;
        if (neighbors <= 1) removals.push({ x, y });
      }
    }
    if (removals.length === 0) break;
    for (const cell of removals) {
      map.lowerTiles[cell.y * map.width + cell.x] = TILE.GRASS;
      changed.push(cell);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (isRoad(cell.x + dx, cell.y + dy)) changed.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }
  if (changed.length > 0) shapeRoadStyle(map, pathStyle, changed);
}

function paintRoadCellsAvoidingHouses(
  map: GameMap,
  pathStyle: RoadStyle,
  cells: readonly Point[],
  houseBlocked: ReadonlySet<string>,
): void {
  const painted: Point[] = [];
  const seen = new Set<string>();
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const body = roadBodyTile(pathStyle);
  const paintCell = (x: number, y: number): boolean => {
    const key = coordKey(x, y);
    if (seen.has(key) || !inMapBounds(map, x, y) || houseBlocked.has(key) || protectedCells.has(key)) return false;
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

/** 미리보기용 길 조각 — 본시공과 같은 몸통 타일·오토타일 성형. 타일 번호는 여기만 안다. */
export function paintRoadStrip(map: GameMap, style: RoadStyle, cells: readonly Point[]): void {
  paintRoadCellsAvoidingHouses(map, style, cells, EMPTY_BLOCKED);
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
  houseBlocked = new Set([...houseBlocked, ...protectedHouseCells(map).map(({ x, y }) => coordKey(x, y))]);
  preferAvoid = new Set([...preferAvoid, ...houseBlocked]);
  const body = roadBodyTile(pathStyle);
  const key = (x: number, y: number) => `${x},${y}`;
  const isRoad = environmentalRoadAt(map);
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
  if (houses.length > 0 && houses.every(house => house.objectExterior)) {
    connectVillageAccessPoints(map, area, houses.map(house => house.front), intent.pathStyle, houseBlocked);
    return;
  }
  // 유기적 배치(2026-09-17): 집 앞은 이미 골격 결절이다. 남은 문은 가장 가까운 길에 붙이고,
  // 그래도 닿지 못한 문만 예전 광장 스퍼로 떨어진다. 예전엔 모든 문이 광장까지 스퍼를 끌어
  // 광장이 결절점인 방사형(십자) 위상을 다시 만들었다.
  let pending: readonly BuiltHouse[] = houses;
  if (intent.settlementLayout !== "street-grid" && houses.length > 0) {
    const unreachable = connectGatesToNearestRoad(map, area, houses.map(house => house.front), intent.pathStyle, houseBlocked);
    pending = houses.filter(house => unreachable.some(gate => gate.x === house.front.x && gate.y === house.front.y));
  }
  const pathStyle = intent.pathStyle;
  const leftEdge = plaza.rect.x;
  const rightEdge = plaza.rect.x + plaza.rect.w - 1;
  const plazaTop = plaza.rect.y;
  const plazaBottom = plaza.rect.y + plaza.rect.h - 1;
  const plazaLeft = plaza.rect.x;
  const plazaRight = plaza.rect.x + plaza.rect.w - 1;
  for (let hi = 0; hi < pending.length; hi += 1) {
    const house = pending[hi] as BuiltHouse;
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

/** Connect each saved house to the nearest connected street, instead of another long plaza spur. */
export function connectVillageAccessPoints(map: GameMap, area: Rect, gates: readonly Point[], style: RoadStyle,
  blocked: ReadonlySet<string>): void {
  const unreachable = connectGatesToNearestRoad(map, area, gates, style, blocked, true);
  const first = unreachable[0];
  if (first !== undefined) {
    throw new ToolError(`건물 대문(${first.x},${first.y})을 길에 연결할 수 없습니다.`, { code: "village-object-road", mapId: map.id });
  }
}

/**
 * 문 → 가장 가까운 길 성분 BFS 연결. 닿지 못한 문을 돌려준다(던지지 않음) — paintOnce 재시도
 * 루프는 예외를 잡지 않으므로, 유기적 배치의 보조 연결이 예외를 내면 시공 전체가 죽는다.
 * `strict` 면 길 성분이 하나도 없을 때만 던진다(객체 외관 마을의 예전 계약 유지).
 */
export function connectGatesToNearestRoad(map: GameMap, area: Rect, gates: readonly Point[], style: RoadStyle,
  blocked: ReadonlySet<string>, strict: boolean = false): Point[] {
  const inside = (p: Point): boolean => p.x >= area.x && p.y >= area.y && p.x < area.x + area.w && p.y < area.y + area.h;
  const neighbors = (p: Point): Point[] => [{ x: p.x, y: p.y + 1 }, { x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y - 1 }];
  const roadAt = environmentalRoadAt(map), seen = new Set<string>();
  let network = new Set<string>();
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    const key = coordKey(x, y);
    if (seen.has(key) || !roadAt(x, y)) continue;
    const cells = new Set<string>(), queue: Point[] = [{ x, y }];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!, k = coordKey(p.x, p.y);
      if (!inside(p) || seen.has(k) || !roadAt(p.x, p.y)) continue;
      seen.add(k); cells.add(k); queue.push(...neighbors(p));
    }
    if (cells.size > network.size) network = cells;
  }
  if (network.size === 0) {
    if (strict) throw new ToolError("건물 대문을 연결할 공용 도로가 없습니다.", { code: "village-object-road", mapId: map.id });
    return [...gates];
  }
  const unreachable: Point[] = [];
  for (const gate of gates) {
    const gateKey = coordKey(gate.x, gate.y);
    if (network.has(gateKey)) continue;
    const previous = new Map<string, Point | null>([[gateKey, null]]), queue: Point[] = [gate];
    let end: Point | undefined;
    for (let i = 0; i < queue.length && !end; i++) {
      const p = queue[i]!;
      if (network.has(coordKey(p.x, p.y))) { end = p; break; }
      for (const next of neighbors(p)) {
        const k = coordKey(next.x, next.y), index = next.y * map.width + next.x;
        if (!inside(next) || blocked.has(k) || previous.has(k)
          || (map.lowerTiles[index] !== TILE.GRASS && !ROAD_TILES.has(map.lowerTiles[index] ?? -1))
          || map.upperTiles[index] !== TILE.EMPTY || map.lowerTileStacks?.[index]?.length || map.upperTileStacks?.[index]?.length
          || map.events.some(event => event.x === next.x && event.y === next.y)) continue;
        previous.set(k, p); queue.push(next);
      }
    }
    if (!end) { unreachable.push(gate); continue; }
    const cells: Point[] = [];
    for (let p: Point | null = end; p; p = previous.get(coordKey(p.x, p.y)) ?? null) cells.push(p);
    paintRoadCellsAvoidingHouses(map, style, cells, blocked);
    for (const p of cells) network.add(coordKey(p.x, p.y));
  }
  return unreachable;
}
