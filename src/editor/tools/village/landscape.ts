// editor/tools/village/landscape.ts
// 마을 조경 모듈 — 호수·백사장·수로·눈밭·밭 지구·어둠(지하계단)·수풀을 잔디 위에 배치한다.
// 100×100 비판 리뷰(2026-07-17)에서 확정된 조경 문법을 코드로 고정한 단독 모듈:
//   1) 수로는 반드시 호수 인접 칸에서 시작해 가장자리/최대 길이까지(세로 3 → 한 번 꺾어 가로 63),
//      민가 보호구역(houseBlocked ∪ standoff ∪ 문앞 front±2)은 절대 통과하지 않는다.
//   2) 백사장은 호수 동안(東岸)의 물 인접 잔디에서 시작해 2~4칸 확장 — 물과 붙어야 백사장.
//      호수 여백 예약은 북·서쪽만 — 동쪽 접안 열·남쪽 물가(수로·벤치)는 깎지 않는다.
//   3) 지형 궁합 — 눈은 경작지·모래와 12칸 이내 금지, 어둠은 민가 bbox 6칸 이격 +
//      남변 중앙 하단 지하계단(298/299) 세트 필수 + 둘레 바위 1~3개.
//   4) 뭉침 방지 — 큰 지형(호수/눈/밭 지구/숲)은 mulberry32 셔플로 서로 다른 사분면 우선.
//   5) 호숫가 장식 — 남·동안 물가 1칸 잔디에 벤치(327+328) 1세트 + 바위 1~2개.
//   6) 키큰 풀/수풀은 5×4 미만 패치 금지, 가장자리 선호.
//   7) 모든 페인트는 lower==GRASS && upper==EMPTY && 보호구역 밖 칸에만 — 길·광장은 자동 회피.
//
// ⚠ builder.ts/roads.ts/decor.ts 는 건드리지 않는다(동시 작업 중). 배선은 별도 작업.
// 결정론: mulberry32(seed) 단일 스트림만 사용 — Date/Math.random 금지.

import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { coordKey, expandRect, ROAD_TILES, type BuiltHouse, type Plaza, type Rect } from "./constants";
import { houseBlockedCells, houseStandoffCells } from "./houses";

/** 호수 물가 앵커(쿼터 물 시스템) — combined_town 전용. */
export const LAKE_WATER_TILE = 0;
/** 석축 수로 세로 런(애니 스트립 기준 타일). */
export const CANAL_VERTICAL_TILE = 3;
/** 석축 수로 가로 런(애니 스트립 기준 타일). */
export const CANAL_HORIZONTAL_TILE = 63;
/** 지하계단 세트(어둠 남변 중앙 하단) — 계단 없는 어둠 금지. */
export const STAIRS_LEFT_TILE = 298;
export const STAIRS_RIGHT_TILE = 299;
/** 바위 소품(상단 레이어). */
export const ROCK_TILES: readonly number[] = [441, 442];
/** 가로 벤치 세트(상단 레이어). */
export const BENCH_LEFT_TILE = 327;
export const BENCH_RIGHT_TILE = 328;
/** 눈 ↔ 경작지·모래 최소 이격(체비셰프). */
export const SNOW_MIN_SEPARATION = 12;
/** 어둠 ↔ 민가 bbox 최소 이격(체비셰프). */
export const DARKNESS_HOUSE_CLEARANCE = 6;
/** 문앞(front) 사방 보호 반경 — 조경 절대 침범 금지. */
export const DOOR_FRONT_CLEARANCE = 2;
/** 키큰 풀/수풀 최소 패치 크기(노이즈 방지). */
export const MIN_BRUSH_PATCH_W = 5;
export const MIN_BRUSH_PATCH_H = 4;
/** 수로 세그먼트(세로/가로 각각) 최대 길이. */
export const CANAL_MAX_RUN = 18;
/** 다리·잔교 판자(사용자 지정: 199 중심 나무판자를 물/길 위에 띄운다). */
export const BRIDGE_PLANK_TILE = 199;
/** 수로가 길을 횡단할 때 판자 다리의 최대 연속 칸(대로 폭 3 대응). */
export const BRIDGE_MAX_SPAN = 3;

export interface VillageLandscapeArgs {
  readonly area: Rect;
  readonly houses: readonly BuiltHouse[];
  readonly plaza: Plaza;
  readonly seed: number;
  readonly warnings: string[];
}

type Cell = readonly [number, number];

interface Region {
  readonly x0: number;
  readonly y0: number;
  /** exclusive */
  readonly x1: number;
  /** exclusive */
  readonly y1: number;
}

interface ScanOptions {
  readonly reverseX?: boolean;
  readonly reverseY?: boolean;
  readonly ok?: (x: number, y: number) => boolean;
}

function groupById(groupId: string) {
  const group = DEFAULT_AUTOTILE_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`조경: 오토타일 그룹 없음 — ${groupId}`);
  return group;
}

/** 두 rect 사이 체비셰프 거리(겹치면 0). */
function rectChebyshevDistance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w - 1), a.x - (b.x + b.w - 1), 0);
  const dy = Math.max(b.y - (a.y + a.h - 1), a.y - (b.y + b.h - 1), 0);
  return Math.max(dx, dy);
}

/** rect ↔ 셀 집합 최소 체비셰프 거리 ≥ minDist 인가. */
function rectFarFromCells(rect: Rect, cells: readonly Cell[], minDist: number): boolean {
  return cells.every(([cx, cy]) => rectChebyshevDistance(rect, { x: cx, y: cy, w: 1, h: 1 }) >= minDist);
}

/**
 * 마을 조경 총괄 — 배치한 지형 셀 수(lower 레이어 기준)를 반환한다.
 * 배치 실패 항목은 warnings에 남기고 넘어간다(조경은 전부 선택적 장식).
 */
export function dressVillageLandscape(map: GameMap, args: VillageLandscapeArgs): number {
  const { area, houses, plaza, seed, warnings } = args;
  const W = map.width;
  const H = map.height;
  const rng = mulberry32(seed);
  let painted = 0;

  // ── 조경 금지 마스크: 집 footprint(용마루 포함) ∪ 스탠드오프 ∪ 문앞 front±2 ∪ 광장+1 ∪ 이벤트 ──
  const forbidden = new Set<string>();
  for (const key of houseBlockedCells(houses)) forbidden.add(key);
  for (const key of houseStandoffCells(houses)) forbidden.add(key);
  for (const house of houses) {
    for (let dy = -DOOR_FRONT_CLEARANCE; dy <= DOOR_FRONT_CLEARANCE; dy += 1) {
      for (let dx = -DOOR_FRONT_CLEARANCE; dx <= DOOR_FRONT_CLEARANCE; dx += 1) {
        forbidden.add(coordKey(house.front.x + dx, house.front.y + dy));
        forbidden.add(coordKey(house.doorAt.x + dx, house.doorAt.y + dy));
      }
    }
  }
  const plazaZone = expandRect(plaza.rect, 1);
  for (let y = plazaZone.y; y < plazaZone.y + plazaZone.h; y += 1) {
    for (let x = plazaZone.x; x < plazaZone.x + plazaZone.w; x += 1) forbidden.add(coordKey(x, y));
  }
  for (const event of map.events) forbidden.add(coordKey(event.x, event.y));

  const used = new Set<string>();
  // 작업 영역 — 맵 테두리 1칸은 항상 제외.
  const x0 = Math.max(1, area.x);
  const y0 = Math.max(1, area.y);
  const x1 = Math.min(W - 1, area.x + area.w);
  const y1 = Math.min(H - 1, area.y + area.h);

  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * W + x] ?? TILE.EMPTY;
  const upperAt = (x: number, y: number): number => map.upperTiles[y * W + x] ?? TILE.EMPTY;
  const inArea = (x: number, y: number): boolean => x >= x0 && y >= y0 && x < x1 && y < y1;
  const paintable = (x: number, y: number): boolean =>
    inArea(x, y)
    && lowerAt(x, y) === TILE.GRASS
    && upperAt(x, y) === TILE.EMPTY
    && !forbidden.has(coordKey(x, y))
    && !used.has(coordKey(x, y));

  const rectCells = (x: number, y: number, w: number, h: number): Cell[] => {
    const cells: Cell[] = [];
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) cells.push([x + dx, y + dy]);
    return cells;
  };

  /**
   * 블롭 페인터 — 페인트 가능 칸만 남긴 뒤 8방향 마스크로 variantMap 성형.
   * 블롭 밖이라도 그룹 connectTileIds에 속한 기존 타일(예: 모래의 물)은 연결로 본다.
   */
  const paintBlob = (groupId: string, cells: readonly Cell[]): Cell[] => {
    const group = groupById(groupId);
    const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
    const blob = cells.filter(([x, y]) => paintable(x, y));
    const inBlob = new Set(blob.map(([x, y]) => coordKey(x, y)));
    const connected = (x: number, y: number): boolean =>
      inBlob.has(coordKey(x, y)) || connect.has(lowerAt(x, y));
    const done: Cell[] = [];
    for (const [x, y] of blob) {
      let mask = 0;
      if (connected(x, y - 1)) mask |= AUTOTILE_DIR.N;
      if (connected(x + 1, y)) mask |= AUTOTILE_DIR.E;
      if (connected(x, y + 1)) mask |= AUTOTILE_DIR.S;
      if (connected(x - 1, y)) mask |= AUTOTILE_DIR.W;
      if (connected(x + 1, y - 1)) mask |= AUTOTILE_DIR.NE;
      if (connected(x + 1, y + 1)) mask |= AUTOTILE_DIR.SE;
      if (connected(x - 1, y + 1)) mask |= AUTOTILE_DIR.SW;
      if (connected(x - 1, y - 1)) mask |= AUTOTILE_DIR.NW;
      const variant = group.variantMap[String(mask)];
      if (variant === undefined) continue;
      map.lowerTiles[y * W + x] = variant;
      used.add(coordKey(x, y));
      painted += 1;
      done.push([x, y]);
    }
    return done;
  };

  const findClearRect = (w: number, h: number, region: Region, opts?: ScanOptions): Cell | null => {
    const yLast = region.y1 - h;
    const xLast = region.x1 - w;
    for (let i = 0; i <= yLast - region.y0; i += 1) {
      const y = opts?.reverseY ? yLast - i : region.y0 + i;
      for (let j = 0; j <= xLast - region.x0; j += 1) {
        const x = opts?.reverseX ? xLast - j : region.x0 + j;
        if (!rectCells(x, y, w, h).every(([cx, cy]) => paintable(cx, cy))) continue;
        if (opts?.ok && !opts.ok(x, y)) continue;
        return [x, y];
      }
    }
    return null;
  };

  /** 패치 둘레 1칸 예약 — 서로 다른 지형이 맞붙는 뭉침 방지. */
  const reserveMargin = (x: number, y: number, w: number, h: number): void => {
    for (let dy = -1; dy <= h; dy += 1) {
      for (let dx = -1; dx <= w; dx += 1) used.add(coordKey(x + dx, y + dy));
    }
  };

  // ── 사분면 할당제(뭉침 방지): 호수/눈/밭 지구/숲을 서로 다른 사분면에 우선 배치 ──
  const midX = x0 + Math.floor((x1 - x0) / 2);
  const midY = y0 + Math.floor((y1 - y0) / 2);
  const quadrants: Region[] = [
    { x0, y0, x1: midX, y1: midY },
    { x0: midX, y0, x1, y1: midY },
    { x0, y0: midY, x1: midX, y1 },
    { x0: midX, y0: midY, x1, y1 },
  ];
  for (let i = quadrants.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = quadrants[i] as Region;
    quadrants[i] = quadrants[j] as Region;
    quadrants[j] = tmp;
  }
  const [lakeQuad, snowQuad, farmQuad, forestQuad] = quadrants as [Region, Region, Region, Region];
  const whole: Region = { x0, y0, x1, y1 };
  /** 사분면이 접한 맵 가장자리 쪽부터 스캔(가장자리 선호). */
  const edgeScan = (quad: Region): ScanOptions => ({ reverseX: quad.x0 > x0, reverseY: quad.y0 > y0 });

  const minDim = Math.min(x1 - x0, y1 - y0);

  // ══ 1. 호수 ══
  const lakeW = Math.max(8, Math.min(14, Math.floor(minDim * 0.25)));
  const lakeH = Math.max(6, Math.min(9, Math.floor(minDim * 0.17)));
  const lakeCells: Cell[] = [];
  const lakeAt = findClearRect(lakeW, lakeH, lakeQuad) ?? findClearRect(lakeW, lakeH, whole);
  if (lakeAt) {
    const [lx, ly] = lakeAt;
    // 유기적 물가: 본체 + 북/남 노브 + 서쪽 반칸 — 동안(東岸)은 직선 유지(백사장 접안 열).
    const nubW = Math.max(3, Math.floor(lakeW / 2));
    const organic = [
      ...rectCells(lx, ly, lakeW, lakeH),
      ...rectCells(lx + 2, ly - 1, nubW, 1),
      ...rectCells(lx + 1, ly + lakeH, nubW, 1),
      ...rectCells(lx - 1, ly + 1, 1, Math.max(2, lakeH - 3)),
    ].filter(([cx, cy]) => paintable(cx, cy));
    for (const [cx, cy] of organic) {
      map.lowerTiles[cy * W + cx] = LAKE_WATER_TILE;
      used.add(coordKey(cx, cy));
      lakeCells.push([cx, cy]);
      painted += 1;
    }
    // 여백 예약은 북·서쪽 밴드만 — 동쪽 물가 열(모래 접안)·남쪽 물가(수로 시작·벤치)는 남긴다.
    for (let xx = lx - 2; xx < lx + lakeW + 1; xx += 1) {
      used.add(coordKey(xx, ly - 2));
      used.add(coordKey(xx, ly - 3));
    }
    for (let yy = ly - 2; yy < ly + lakeH + 1; yy += 1) {
      used.add(coordKey(lx - 2, yy));
      used.add(coordKey(lx - 3, yy));
    }
  } else {
    warnings.push("조경: 호수 자리 확보 실패 — 백사장·수로·호숫가 장식 생략");
  }
  const lakeSet = new Set(lakeCells.map(([cx, cy]) => coordKey(cx, cy)));
  const isWater = (x: number, y: number): boolean => lakeSet.has(coordKey(x, y));

  // ══ 2. 백사장(동안 접안) — 물 인접 잔디에서 시작해 바깥으로 2~4칸 확장 ══
  let sandCells: Cell[] = [];
  if (lakeCells.length > 0) {
    const seedCells: Cell[] = [];
    for (const [cx, cy] of lakeCells) {
      if (!isWater(cx + 1, cy) && paintable(cx + 1, cy)) seedCells.push([cx + 1, cy]);
    }
    seedCells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const depth = 2 + Math.floor(rng() * 3); // 2~4
    const beach: Cell[] = [];
    const seen = new Set<string>();
    let frontier = seedCells;
    for (let d = 0; d < depth && frontier.length > 0; d += 1) {
      const next: Cell[] = [];
      for (const [bx, by] of frontier) {
        const key = coordKey(bx, by);
        if (seen.has(key)) continue;
        seen.add(key);
        beach.push([bx, by]);
        for (const [nx, ny] of [[bx + 1, by], [bx, by + 1], [bx, by - 1]] as const) {
          if (!seen.has(coordKey(nx, ny)) && paintable(nx, ny)) next.push([nx, ny]);
        }
      }
      frontier = next;
    }
    sandCells = paintBlob("builtin_sand", beach);
    if (sandCells.length === 0) warnings.push("조경: 백사장 접안 실패 — 동안에 페인트 가능한 잔디 없음");
  }

  // ══ 3. 수로 — 호수 남안 인접 칸에서 시작, 세로(3) 런 + 필요시 한 번 꺾어 가로(63) ══
  let canalColumn = -1;
  if (lakeCells.length > 0) {
    const lakeCenterX = lakeCells.reduce((sum, [cx]) => sum + cx, 0) / lakeCells.length;
    const starts: Cell[] = [];
    for (const [cx, cy] of lakeCells) {
      if (!isWater(cx, cy + 1) && paintable(cx, cy + 1)) starts.push([cx, cy + 1]);
    }
    starts.sort((a, b) => Math.abs(a[0] - lakeCenterX) - Math.abs(b[0] - lakeCenterX) || a[0] - b[0]);
    let canalLaid = 0;
    for (const [sx, sy] of starts) {
      const vertical: Cell[] = [];
      const bridges: Cell[] = [];
      let yy = sy;
      while (yy < y1 && vertical.length < CANAL_MAX_RUN) {
        if (paintable(sx, yy)) {
          vertical.push([sx, yy]);
          yy += 1;
          continue;
        }
        // 길 횡단(2026-07-17 사용자 지시): 연속 도로 ≤3칸이면 판자 다리(199)로 건너고,
        // 건너편에 수로가 2칸 이상 이어질 때만 — 다리 뒤가 막히면 횡단하지 않는다.
        const span: Cell[] = [];
        let by = yy;
        while (by < y1 && span.length < BRIDGE_MAX_SPAN && ROAD_TILES.has(lowerAt(sx, by))) {
          span.push([sx, by]);
          by += 1;
        }
        if (span.length > 0 && paintable(sx, by) && paintable(sx, by + 1)) {
          bridges.push(...span);
          yy = by;
          continue;
        }
        break;
      }
      if (vertical.length < 3) continue; // 짧은 토막은 수로가 아니다 — 다음 시작 후보로.
      for (const [vx, vy] of vertical) {
        map.lowerTiles[vy * W + vx] = CANAL_VERTICAL_TILE;
        used.add(coordKey(vx, vy));
        painted += 1;
      }
      // 다리 = RM2K 정본: 하위는 수로 물이 계속 흐르고, 판자(199)는 상위 레이어에 얹는다.
      // (상위 O가 하위 X를 덮는 tilePassability 규약 — 물 위를 걷는 진짜 다리.)
      // placed(잔디→지형) 계약에는 세지 않는다.
      for (const [bx, by] of bridges) {
        map.lowerTiles[by * W + bx] = CANAL_VERTICAL_TILE;
        map.upperTiles[by * W + bx] = BRIDGE_PLANK_TILE;
        used.add(coordKey(bx, by));
      }
      if (bridges.length > 0) warnings.push(`조경: 수로-길 횡단 판자 다리 ${bridges.length}칸(199)`);
      canalLaid = vertical.length + bridges.length;
      const reachedEdge = yy >= y1;
      if (!reachedEdge && vertical.length < CANAL_MAX_RUN) {
        // 막혔으면 한 번만 꺾는다 — 마지막 세로 칸 행에서 가까운 x 가장자리 방향으로.
        // (다리 횡단이 있으면 세로가 불연속이므로 실제 마지막 칸의 y를 쓴다.)
        const bendY = vertical[vertical.length - 1]![1];
        const dir = sx - x0 <= x1 - 1 - sx ? -1 : 1;
        const horizontal: Cell[] = [];
        let xx = sx + dir;
        while (xx >= x0 && xx < x1 && horizontal.length < CANAL_MAX_RUN && paintable(xx, bendY)) {
          horizontal.push([xx, bendY]);
          xx += dir;
        }
        // 데드엔드 가로 조각 금지 — 3칸 미만이면 가로 없이 세로로 끝낸다.
        if (horizontal.length >= 3) {
          for (const [hx, hy] of horizontal) {
            // 수로는 전부 마커 타일 3으로 저장 — 쿼터 렌더가 가로 변(63)·코너를 복원한다.
            map.lowerTiles[hy * W + hx] = CANAL_VERTICAL_TILE;
            used.add(coordKey(hx, hy));
            painted += 1;
          }
          canalLaid += horizontal.length;
        }
      }
      canalColumn = sx;
      break; // 수로는 1기.
    }
    if (canalLaid === 0) warnings.push("조경: 수로 생략 — 호수 남안에서 뻗을 자리 없음");
  }

  // ══ 3.5 잔교(pier) — 판자(199)를 물 위에 띄운다 (사용자 지시). 남안 중앙 부근에서
  // 물속으로 2~3칸: 물가 잔디에서 걸어 들어가는 나무 잔교. 수로 열과는 3칸 이상 이격.
  if (lakeCells.length > 0) {
    const lakeCenterX = lakeCells.reduce((sum, [cx]) => sum + cx, 0) / lakeCells.length;
    const southShore = lakeCells
      .filter(([cx, cy]) => !isWater(cx, cy + 1) && isWater(cx, cy - 1) && isWater(cx, cy - 2)
        && (canalColumn < 0 || Math.abs(cx - canalColumn) >= 3))
      .sort((a, b) => Math.abs(a[0] - lakeCenterX) - Math.abs(b[0] - lakeCenterX) || a[0] - b[0]);
    const pierBase = southShore[0];
    if (pierBase) {
      const [px, py] = pierBase;
      const pierLen = 2 + Math.floor(rng() * 2); // 2~3칸
      let laid = 0;
      for (let i = 0; i < pierLen; i += 1) {
        const ny = py - i;
        if (!isWater(px, ny)) break;
        // 잔교도 정본대로: 하위 물 유지 + 상위 판자(199). 물이 판자 밑에서 계속 출렁인다.
        // placed(잔디→지형) 계약에는 세지 않는다.
        map.upperTiles[ny * W + px] = BRIDGE_PLANK_TILE;
        used.add(coordKey(px, ny));
        laid += 1;
      }
      if (laid > 0) warnings.push(`조경: 호수 잔교 ${laid}칸(판자 199)`);
    }
  }

  // ══ 4. 눈밭 — 경작지·모래와 12칸 이내 금지 (모래는 이미 깔렸으니 여기서, 밭은 아래서 검사) ══
  const snowW = Math.max(7, Math.min(11, Math.floor(minDim * 0.2)));
  const snowH = Math.max(5, Math.min(7, Math.floor(minDim * 0.14)));
  let snowCells: Cell[] = [];
  {
    const ok = (x: number, y: number): boolean =>
      rectFarFromCells({ x: x - 1, y: y - 1, w: snowW + 2, h: snowH + 2 }, sandCells, SNOW_MIN_SEPARATION);
    const snowAt = findClearRect(snowW, snowH, snowQuad, { ...edgeScan(snowQuad), ok })
      ?? findClearRect(snowW, snowH, whole, { ok });
    if (snowAt) {
      const [sx, sy] = snowAt;
      snowCells = paintBlob("builtin_snow", [
        ...rectCells(sx, sy, snowW, snowH),
        ...rectCells(sx + 2, sy - 1, 3, 1),
        ...rectCells(sx - 1, sy + 1, 1, 2),
        ...rectCells(sx + snowW, sy + snowH - 3, 1, 2),
        ...rectCells(sx + snowW - 4, sy + snowH, 3, 1),
      ]);
      reserveMargin(sx - 1, sy - 1, snowW + 2, snowH + 2);
    } else {
      warnings.push("조경: 눈밭 생략 — 모래와 12칸 이격 가능한 자리 없음");
    }
  }

  // ══ 5. 밭 지구 — 밭 7~9폭 1~2면 + 흙마당 세트, 가장자리 선호, 눈과 12칸 이격 ══
  {
    const farmW = 7 + Math.floor(rng() * 3); // 7~9
    const farmH = 5 + Math.floor(rng() * 2); // 5~6
    const ok = (x: number, y: number): boolean =>
      rectFarFromCells({ x, y, w: farmW, h: farmH }, snowCells, SNOW_MIN_SEPARATION);
    const farmAt = findClearRect(farmW, farmH, farmQuad, { ...edgeScan(farmQuad), ok })
      ?? findClearRect(farmW, farmH, whole, { ok });
    if (farmAt) {
      const [fx, fy] = farmAt;
      paintBlob("builtin_farmland", rectCells(fx, fy, farmW, farmH));
      // 두 번째 면 — 첫 면 남쪽 1칸 간격, 자리가 되고 눈과도 이격될 때만.
      const farm2H = 4 + Math.floor(rng() * 2);
      const farm2Y = fy + farmH + 1;
      if (
        rectCells(fx, farm2Y, farmW, farm2H).every(([cx, cy]) => paintable(cx, cy))
        && rectFarFromCells({ x: fx, y: farm2Y, w: farmW, h: farm2H }, snowCells, SNOW_MIN_SEPARATION)
      ) {
        paintBlob("builtin_farmland", rectCells(fx, farm2Y, farmW, farm2H));
      }
      // 흙마당(builtin_dirt_road 소형) — 밭 좌/우 인접, 먼저 들어가는 자리에.
      const yardW = 4;
      const yardH = 3;
      const yardCandidates: Cell[] = [
        [fx + farmW + 1, fy + 1],
        [fx - yardW - 1, fy + 1],
        [fx + 1, fy - yardH - 1],
      ];
      for (const [yx, yy] of yardCandidates) {
        if (!rectCells(yx, yy, yardW, yardH).every(([cx, cy]) => paintable(cx, cy))) continue;
        paintBlob("builtin_dirt_road", rectCells(yx, yy, yardW, yardH));
        break;
      }
      reserveMargin(fx - 1, fy - 1, farmW + 2, farmH + 2);
    } else {
      warnings.push("조경: 밭 지구 생략 — 눈과 12칸 이격 가능한 자리 없음");
    }
  }

  // ══ 6. 어둠 — 민가 bbox 6칸 이격 + 남변 중앙 하단 지하계단(298/299) 세트 + 둘레 바위 ══
  {
    const darkW = 6;
    const darkH = 4;
    const ok = (x: number, y: number): boolean =>
      houses.every((house) => rectChebyshevDistance({ x, y, w: darkW, h: darkH }, house.bbox) >= DARKNESS_HOUSE_CLEARANCE);
    const darkAt = findClearRect(darkW, darkH, forestQuad, { ...edgeScan(forestQuad), ok })
      ?? findClearRect(darkW, darkH, whole, { ok });
    if (darkAt) {
      const [dx, dy] = darkAt;
      const blob = paintBlob("builtin_darkness", rectCells(dx, dy, darkW, darkH));
      const blobSet = new Set(blob.map(([cx, cy]) => coordKey(cx, cy)));
      const stairY = dy + darkH - 1;
      const stairX = dx + Math.floor(darkW / 2) - 1;
      if (blobSet.has(coordKey(stairX, stairY)) && blobSet.has(coordKey(stairX + 1, stairY))) {
        // 계단은 어둠 셀을 덮어쓴다 — painted 는 이미 블롭에서 집계됐다.
        map.lowerTiles[stairY * W + stairX] = STAIRS_LEFT_TILE;
        map.lowerTiles[stairY * W + stairX + 1] = STAIRS_RIGHT_TILE;
        // 둘레 바위 1~3개 — 어둠 밖 1칸 링의 잔디에만(상단 레이어).
        const ring: Cell[] = [];
        for (let ry = dy - 1; ry <= dy + darkH; ry += 1) {
          for (let rx = dx - 1; rx <= dx + darkW; rx += 1) {
            const inside = rx >= dx && rx < dx + darkW && ry >= dy && ry < dy + darkH;
            if (inside || !inArea(rx, ry)) continue;
            if (lowerAt(rx, ry) !== TILE.GRASS || upperAt(rx, ry) !== TILE.EMPTY) continue;
            if (forbidden.has(coordKey(rx, ry))) continue;
            ring.push([rx, ry]);
          }
        }
        const rockCount = Math.min(ring.length, 1 + Math.floor(rng() * 3));
        for (let i = 0; i < rockCount; i += 1) {
          const pick = Math.floor(rng() * ring.length);
          const [rx, ry] = ring.splice(pick, 1)[0] as Cell;
          map.upperTiles[ry * W + rx] = ROCK_TILES[Math.floor(rng() * ROCK_TILES.length)] as number;
        }
        reserveMargin(dx - 1, dy - 1, darkW + 2, darkH + 2);
      } else {
        // 계단 자리를 못 지키면 어둠 자체를 무른다 — 계단 없는 어둠 금지.
        for (const [cx, cy] of blob) {
          map.lowerTiles[cy * W + cx] = TILE.GRASS;
          painted -= 1;
        }
        warnings.push("조경: 어둠 철회 — 지하계단 세트 자리 확보 실패");
      }
    } else {
      warnings.push("조경: 어둠 생략 — 민가 6칸 이격 가능한 자리 없음");
    }
  }

  // ══ 7. 숲 언저리 — 짙은 수풀 + 키큰 풀, 최소 5×4, 가장자리 선호 ══
  {
    const patches: readonly (readonly [groupId: string, w: number, h: number, primary: Region])[] = [
      ["builtin_undergrowth", Math.max(MIN_BRUSH_PATCH_W, Math.min(9, Math.floor(minDim * 0.16))), Math.max(MIN_BRUSH_PATCH_H, 5), forestQuad],
      ["builtin_tall_grass", 7, 5, forestQuad],
      ["builtin_tall_grass", MIN_BRUSH_PATCH_W, MIN_BRUSH_PATCH_H, snowQuad],
    ];
    for (const [groupId, w, h, primary] of patches) {
      const at = findClearRect(w, h, primary, edgeScan(primary)) ?? findClearRect(w, h, whole);
      if (!at) continue;
      const [px, py] = at;
      paintBlob(groupId, rectCells(px, py, w, h));
      reserveMargin(px, py, w, h);
    }
  }

  // ══ 8. 호숫가 장식 — 남·동안 물가 1칸 잔디에 벤치(327+328) 1세트 + 바위 1~2개(상단) ══
  if (lakeCells.length > 0) {
    const decorOk = (x: number, y: number): boolean =>
      inArea(x, y)
      && lowerAt(x, y) === TILE.GRASS // 길(포석·흙길 등)이 깔린 칸은 lower가 잔디가 아니라 자동 스킵.
      && upperAt(x, y) === TILE.EMPTY
      && !forbidden.has(coordKey(x, y));
    const shore: Cell[] = [];
    const shoreSeen = new Set<string>();
    for (const [cx, cy] of lakeCells) {
      for (const [nx, ny] of [[cx, cy + 1], [cx + 1, cy]] as const) { // 남안·동안만
        const key = coordKey(nx, ny);
        if (shoreSeen.has(key)) continue;
        shoreSeen.add(key);
        if (!isWater(nx, ny) && decorOk(nx, ny)) shore.push([nx, ny]);
      }
    }
    shore.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    let benchPlaced = false;
    const benchUsed = new Set<string>();
    for (const [bx, by] of shore) {
      if (!decorOk(bx + 1, by) || isWater(bx + 1, by)) continue;
      map.upperTiles[by * W + bx] = BENCH_LEFT_TILE;
      map.upperTiles[by * W + bx + 1] = BENCH_RIGHT_TILE;
      benchUsed.add(coordKey(bx, by));
      benchUsed.add(coordKey(bx + 1, by));
      benchPlaced = true;
      break;
    }
    if (!benchPlaced) warnings.push("조경: 호숫가 벤치 생략 — 물가 잔디 2칸 연속 자리 없음");
    const rockSpots = shore.filter(([sx, sy]) => !benchUsed.has(coordKey(sx, sy)) && upperAt(sx, sy) === TILE.EMPTY);
    const rockCount = Math.min(rockSpots.length, 1 + Math.floor(rng() * 2));
    for (let i = 0; i < rockCount; i += 1) {
      const pick = Math.floor(rng() * rockSpots.length);
      const [rx, ry] = rockSpots.splice(pick, 1)[0] as Cell;
      map.upperTiles[ry * W + rx] = ROCK_TILES[Math.floor(rng() * ROCK_TILES.length)] as number;
    }
  }

  return painted;
}
