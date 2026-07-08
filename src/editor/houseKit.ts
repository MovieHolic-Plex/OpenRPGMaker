// editor/houseKit.ts
// 집 하네싱 키트 — 사용자 기준 집(연습04 파랑+석벽 / 연습08 밝은오렌지+회벽)에서 학습한
// 타일 역할·연속 규칙을 선언적 키트로 고정하고, 직사각 집을 규칙 그대로 전개한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png
//
// 불변식(하네싱 규칙):
// 1) 벽 = 상단 1행 + 중단 N행 + 하단 1행 나인슬라이스. 가로는 중앙 열만 반복.
// 2) 지붕(하위) = 처마 1행 + 몸통 N행 (+ 파랑은 좌우 1칸 인셋된 최상행 1행).
// 3) 마감은 전부 상위 레이어, "빈 칸에만" 얹는다(이웃 오브젝트 보존).
// 4) 세트 혼합 금지 — 벽·지붕은 키트로 페어 고정.

import { TILE } from "@/project/defaults";
import { createHouseDoorEvent } from "@/editor/houseInteriors";
import type { GameEvent, GameMap, MapId } from "@/project/types";

export type HouseKitId = "blue-stone" | "bright-plaster";

interface WallNineSlice {
  readonly top: readonly [number, number, number];
  readonly mid: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
}

interface BlueRoofKit {
  readonly kind: "blue";
  readonly body: number; // 406 — 몸통·최상행 채움 (가로+세로)
  readonly rightEdge: number; // 407 — 몸통행 우측 끝 1칸 (세로)
  readonly eave: number; // 467 — 최하행, 벽과 같은 폭 (가로)
  readonly upper: { readonly nw: number; readonly ne: number; readonly sw: number; readonly se: number };
}

interface BrightRoofKit {
  readonly kind: "bright";
  readonly body: number; // 404 — 몸통 면 (가로+세로), 벽보다 좌우 1칸 인셋
  readonly eave: number; // 405 — 최하행, 벽과 같은 폭(몸통보다 좌우 +1 오버행)
  readonly upper: {
    readonly ridge: number; // 374 — 몸통 위 한 줄 (가로)
    readonly ridgeCapL: number; // 354
    readonly ridgeCapR: number; // 355
    readonly trimL: number; // 376 — 몸통 좌측 바깥 열 (세로)
    readonly trimR: number; // 377
    readonly trimCapL: number; // 384 — 처마 행에서 트림 마감(처마 위에 겹침)
    readonly trimCapR: number; // 385
  };
}

export interface HouseKit {
  readonly id: HouseKitId;
  readonly name: string;
  readonly windowTile: number;
  readonly wall: WallNineSlice;
  readonly roof: BlueRoofKit | BrightRoofKit;
}

export const HOUSE_KITS: Record<HouseKitId, HouseKit> = {
  "blue-stone": {
    id: "blue-stone",
    name: "파랑 지붕 + 석벽",
    windowTile: 87,
    wall: { top: [15, 16, 17], mid: [45, 46, 47], bottom: [75, 76, 77] },
    roof: { kind: "blue", body: 406, rightEdge: 407, eave: 467, upper: { nw: 356, ne: 357, sw: 386, se: 387 } },
  },
  "bright-plaster": {
    id: "bright-plaster",
    name: "밝은 오렌지 지붕 + 흰 회벽",
    windowTile: 85,
    wall: { top: [12, 13, 14], mid: [42, 43, 44], bottom: [72, 73, 74] },
    roof: {
      kind: "bright",
      body: 404,
      eave: 405,
      upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
    },
  },
};

export type HouseKitWindowsOption = { readonly spacing?: number } | false;

export interface RectHousePlan {
  /** 바운딩 박스 좌상단 (bright는 용마루(상위) 행이 y, blue는 지붕 최상행이 y). */
  readonly x: number;
  readonly y: number;
  /** 벽 폭(칸). 최소 3 — 좌/우 모서리 + 중앙 1칸. */
  readonly width: number;
  /** 층수. 벽 중단 행 수 = 2*stories - 1 (1층=1, 2층=3). */
  readonly stories: 1 | 2;
  /** 지붕 몸통 행 수(≥1). 높은 지붕이 필요하면 늘린다. */
  readonly roofBodyRows: number;
  readonly kitId: HouseKitId;
  /** 창문 자동 배치. 기본 활성, spacing=2. */
  readonly windows?: HouseKitWindowsOption;
}

export interface RectHouseStampResult {
  readonly ok: boolean;
  readonly reason?: string;
  /** 문 배치 권장 위치(남쪽 벽 하단 중앙). */
  readonly doorAt?: { readonly x: number; readonly y: number };
  readonly height?: number;
}

export function rectHouseHeight(plan: Pick<RectHousePlan, "stories" | "roofBodyRows" | "kitId">): number {
  const wallRows = 2 + wallMidRows(plan.stories);
  // blue: 최상행 + 몸통 + 처마 / bright: 용마루(상위) 행 + 몸통 + 처마 — 총 행수는 동일 구조.
  return 1 + plan.roofBodyRows + 1 + wallRows;
}

function wallMidRows(stories: 1 | 2): number {
  return 2 * stories - 1;
}

interface WallRun {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
}

function windowSpacing(windows: HouseKitWindowsOption | undefined): number | null {
  if (windows === false) return null;
  const spacing = windows?.spacing;
  if (spacing === undefined) return 2;
  if (!Number.isFinite(spacing)) return 2;
  return Math.max(0, Math.floor(spacing));
}

function upperIfEmpty(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const index = y * map.width + x;
  if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
}

function placeWindowsOnWallRuns(
  map: GameMap,
  kit: HouseKit,
  runs: readonly WallRun[],
  windows: HouseKitWindowsOption | undefined,
  doorAt: { readonly x: number; readonly y: number } | undefined
): void {
  const spacing = windowSpacing(windows);
  if (spacing === null) return;
  const step = spacing + 1;
  for (const run of runs) {
    if (run.x1 - run.x0 + 1 < 3) continue;
    for (let x = run.x0 + 1; x <= run.x1 - 1; x += step) {
      if (doorAt && Math.abs(x - doorAt.x) <= 1) continue;
      upperIfEmpty(map, x, run.y, kit.windowTile);
    }
  }
}

function wallMidRunsFromRoles(wallRole: ReadonlyMap<number, 0 | 1 | 2>, width: number): WallRun[] {
  const runs: WallRun[] = [];
  const cellKey = (x: number, y: number): number => y * width + x;
  for (const [cell, role] of wallRole.entries()) {
    if (role !== 1) continue;
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (x > 0 && wallRole.get(cellKey(x - 1, y)) === 1) continue;
    let x1 = x;
    while (x1 + 1 < width && wallRole.get(cellKey(x1 + 1, y)) === 1) x1 += 1;
    runs.push({ x0: x, x1, y });
  }
  return runs.sort((a, b) => a.y - b.y || a.x0 - b.x0);
}

function rectWallMidRuns(left: number, right: number, wallTopY: number, stories: 1 | 2): WallRun[] {
  return Array.from({ length: wallMidRows(stories) }, (_, row) => ({ x0: left, x1: right, y: wallTopY + 1 + row }));
}

// ── 임의 평면(ㄱ/ㄴ/ㄷ/ㅁ/O …) 일반화 ────────────────────────────────────────
// 건물 질량(mass) = 날개 사각형들의 합집합. 열 구간(interval)마다 하단 3행이 벽,
// 그 위가 지붕(R). 지붕 렌더는 기준 집에서 추출한 "국소 규칙"으로 결정된다:
//   처마 = 아래 칸이 지붕이 아님 / 상단행 = 위 칸이 지붕이 아님 /
//   가장자리 = 옆 칸이 지붕이 아님(bright는 처마도 지지대로 안 침).
// 이 규칙만으로 연습04(직사각 파랑)·연습08(ㄱ자 오렌지)이 셀 단위 재현된다(골든 테스트).

export interface FootprintWing {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FootprintHousePlan {
  readonly wings: readonly FootprintWing[];
  readonly kitId: HouseKitId;
  /** 창문 자동 배치. 기본 활성, spacing=2. */
  readonly windows?: HouseKitWindowsOption;
  /** 내부 맵으로 이어지는 문 이벤트. 도구 계층에서 내부 맵을 만든 뒤 주입한다. */
  readonly doorEvent?: FootprintHouseDoorEventPlan | false;
}

export interface FootprintHouseDoorEventPlan {
  readonly eventId: string;
  readonly interiorMapId: MapId;
  readonly name?: string;
}

const WALL_BAND_ROWS = 3; // 하네싱 불변식: 벽 = 상단+중단+하단

export function stampFootprintHouseKit(map: GameMap, plan: FootprintHousePlan): RectHouseStampResult {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) return { ok: false, reason: `알 수 없는 키트: ${plan.kitId}` };
  if (plan.wings.length === 0) return { ok: false, reason: "날개가 없습니다." };

  // 질량 집합 + 경계 검증.
  const mass = new Set<number>();
  const key = (x: number, y: number): number => y * map.width + x;
  for (const wing of plan.wings) {
    if (wing.w < 3 || wing.h < 1) return { ok: false, reason: "날개는 최소 폭 3이 필요합니다." };
    if (wing.x < 0 || wing.y < 0 || wing.x + wing.w > map.width || wing.y + wing.h > map.height) {
      return { ok: false, reason: "날개가 맵 경계를 벗어납니다." };
    }
    for (let y = wing.y; y < wing.y + wing.h; y += 1) {
      for (let x = wing.x; x < wing.x + wing.w; x += 1) mass.add(key(x, y));
    }
  }
  const inMass = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && mass.has(key(x, y));

  // 열 구간 → 벽(구간 하단 3행) / 지붕(R).
  const roof = new Set<number>();
  const wallRole = new Map<number, 0 | 1 | 2>(); // 0=상단, 1=중단, 2=하단
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const cell of mass) {
    xs.add(cell % map.width);
    ys.add(Math.floor(cell / map.width));
  }
  for (const x of xs) {
    let y = Math.min(...ys);
    const yEnd = Math.max(...ys);
    while (y <= yEnd + 1) {
      if (!inMass(x, y)) {
        y += 1;
        continue;
      }
      let top = y;
      while (inMass(x, y + 1)) y += 1;
      const bottom = y;
      const height = bottom - top + 1;
      if (height < WALL_BAND_ROWS + 2) {
        return { ok: false, reason: `열 x=${x}의 구간 높이(${height})가 최소 5(벽 3+지붕 2)보다 작습니다.` };
      }
      for (let wy = bottom - WALL_BAND_ROWS + 1; wy <= bottom; wy += 1) {
        wallRole.set(key(x, wy), (wy - (bottom - WALL_BAND_ROWS + 1)) as 0 | 1 | 2);
      }
      for (let ry = top; ry <= bottom - WALL_BAND_ROWS; ry += 1) roof.add(key(x, ry));
      y = bottom + 1;
    }
  }
  const inRoof = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && roof.has(key(x, y));

  const lower = (x: number, y: number, tile: number): void => {
    map.lowerTiles[key(x, y)] = tile;
  };
  const upperIfEmpty = (x: number, y: number, tile: number): void => {
    if (y < 0) return;
    const index = key(x, y);
    if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
  };

  // ── 벽: 같은 행·같은 역할의 연속 런을 나인슬라이스로 ──
  for (const [cell, role] of [...wallRole.entries()].sort((a, b) => a[0] - b[0])) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    const slice = role === 0 ? kit.wall.top : role === 1 ? kit.wall.mid : kit.wall.bottom;
    const runStart = !wallRole.has(key(x - 1, y)) || wallRole.get(key(x - 1, y)) !== role;
    const runEnd = !wallRole.has(key(x + 1, y)) || wallRole.get(key(x + 1, y)) !== role;
    lower(x, y, runStart ? slice[0] : runEnd ? slice[2] : slice[1]);
  }

  // ── 지붕: 기준 집에서 추출한 국소 규칙 ──
  for (const cell of roof) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    const isEave = !inRoof(x, y + 1);
    const isTop = !inRoof(x, y - 1);
    if (kit.roof.kind === "blue") {
      const edgeL = !inRoof(x - 1, y);
      const edgeR = !inRoof(x + 1, y);
      if (isEave) {
        lower(x, y, kit.roof.eave);
        if (edgeL) upperIfEmpty(x, y, kit.roof.upper.sw);
        if (edgeR) upperIfEmpty(x, y, kit.roof.upper.se);
        continue;
      }
      if (isTop && edgeL) {
        upperIfEmpty(x, y, kit.roof.upper.nw);
        continue;
      }
      if (isTop && edgeR) {
        upperIfEmpty(x, y, kit.roof.upper.ne);
        continue;
      }
      lower(x, y, edgeR ? kit.roof.rightEdge : kit.roof.body);
      continue;
    }
    // bright: 처마는 지지대로 안 치는 가장자리 판정(기준 08의 안쪽 트림 재현 조건).
    const eaveAt = (nx: number, ny: number): boolean => inRoof(nx, ny) && !inRoof(nx, ny + 1);
    const edgeL = !inRoof(x - 1, y) || eaveAt(x - 1, y);
    const edgeR = !inRoof(x + 1, y) || eaveAt(x + 1, y);
    if (isEave) {
      lower(x, y, kit.roof.eave);
      if (!inRoof(x - 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapL);
      if (!inRoof(x + 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapR);
      if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridge);
      continue;
    }
    if (edgeL) {
      upperIfEmpty(x, y, kit.roof.upper.trimL);
      if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridgeCapL);
      continue;
    }
    if (edgeR) {
      upperIfEmpty(x, y, kit.roof.upper.trimR);
      if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridgeCapR);
      continue;
    }
    lower(x, y, kit.roof.body);
    if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridge);
  }

  // 문 권장 위치: 건물 최남단(외부에 면한) 벽 하단 런 중 가장 긴 것의 중앙.
  let best: { x0: number; x1: number; y: number } | null = null;
  for (const [cell, role] of wallRole.entries()) {
    if (role !== 2) continue;
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    if (inMass(x, y + 1)) continue; // 외부에 면한 하단만
    if (wallRole.get(key(x - 1, y)) === 2 && !inMass(x - 1, y + 1)) continue; // 런 시작만 취급
    let x1 = x;
    while (wallRole.get(key(x1 + 1, y)) === 2 && !inMass(x1 + 1, y + 1)) x1 += 1;
    if (!best || x1 - x > best.x1 - best.x0 || (x1 - x === best.x1 - best.x0 && y > best.y)) best = { x0: x, x1, y };
  }
  const doorAt = best ? { x: best.x0 + Math.floor((best.x1 - best.x0) / 2), y: best.y } : undefined;
  placeWindowsOnWallRuns(map, kit, wallMidRunsFromRoles(wallRole, map.width), plan.windows, doorAt);
  if (doorAt && plan.doorEvent) {
    upsertEvent(map, createHouseDoorEvent({
      eventId: plan.doorEvent.eventId,
      x: doorAt.x,
      y: doorAt.y,
      interiorMapId: plan.doorEvent.interiorMapId,
      kitId: plan.kitId,
      name: plan.doorEvent.name,
    }));
  }
  return { ok: true, doorAt };
}

function upsertEvent(map: GameMap, event: GameEvent): void {
  const index = map.events.findIndex((candidate) => candidate.id === event.id);
  if (index >= 0) map.events[index] = event;
  else map.events.push(event);
}

// 직사각 집을 하네싱 규칙 그대로 전개한다. map을 직접 변경(호출측이 draft/스냅샷 관리).
export function stampRectHouseKit(map: GameMap, plan: RectHousePlan): RectHouseStampResult {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) return { ok: false, reason: `알 수 없는 키트: ${plan.kitId}` };
  if (plan.width < 3) return { ok: false, reason: "벽 폭은 최소 3칸(좌·중·우)입니다." };
  if (plan.roofBodyRows < 1) return { ok: false, reason: "지붕 몸통은 최소 1행입니다." };
  const height = rectHouseHeight(plan);
  const left = plan.x;
  const right = plan.x + plan.width - 1;
  if (left < 0 || plan.y < 0 || right >= map.width || plan.y + height > map.height) {
    return { ok: false, reason: `맵 경계를 벗어납니다 (필요 영역 ${plan.width}×${height}).` };
  }

  const lower = (x: number, y: number, tile: number): void => {
    map.lowerTiles[y * map.width + x] = tile;
  };
  // 상위 마감은 빈 칸에만 — 이웃 오브젝트(나무/다른 지붕)를 절대 덮지 않는다.
  const upperIfEmpty = (x: number, y: number, tile: number): void => {
    const index = y * map.width + x;
    if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
  };
  // 나인슬라이스 한 행: 좌 모서리 + 중앙 반복 + 우 모서리.
  const nineSliceRow = (y: number, [l, c, r]: readonly [number, number, number]): void => {
    lower(left, y, l);
    for (let x = left + 1; x < right; x += 1) lower(x, y, c);
    lower(right, y, r);
  };

  // ── 지붕(위→아래) ──
  const roof = kit.roof;
  let y = plan.y;
  if (roof.kind === "blue") {
    // 최상행: 좌우 1칸 인셋 몸통 + 빈 모서리에 상위 대각.
    for (let x = left + 1; x < right; x += 1) lower(x, y, roof.body);
    upperIfEmpty(left, y, roof.upper.nw);
    upperIfEmpty(right, y, roof.upper.ne);
    y += 1;
    // 몸통행 ×N: 좌측 끝 포함 몸통, 우측 끝만 사면 마감.
    for (let row = 0; row < plan.roofBodyRows; row += 1, y += 1) {
      for (let x = left; x < right; x += 1) lower(x, y, roof.body);
      lower(right, y, roof.rightEdge);
    }
    // 처마행: 벽과 같은 폭, 좌우 끝에 상위 대각 겹침.
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.sw);
    upperIfEmpty(right, y, roof.upper.se);
    y += 1;
  } else {
    // 용마루(상위) 행: 몸통 폭 = 벽보다 좌우 1칸 인셋 → 용마루도 인셋 폭, 캡은 그 바깥.
    for (let x = left + 1; x < right; x += 1) upperIfEmpty(x, y, roof.upper.ridge);
    upperIfEmpty(left, y, roof.upper.ridgeCapL);
    upperIfEmpty(right, y, roof.upper.ridgeCapR);
    y += 1;
    // 몸통행 ×N (인셋) + 좌우 바깥 열 수직 트림(상위).
    for (let row = 0; row < plan.roofBodyRows; row += 1, y += 1) {
      for (let x = left + 1; x < right; x += 1) lower(x, y, roof.body);
      upperIfEmpty(left, y, roof.upper.trimL);
      upperIfEmpty(right, y, roof.upper.trimR);
    }
    // 처마행: 벽과 같은 폭(몸통보다 +1 오버행), 트림 하단 캡을 처마 위에 겹침.
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.trimCapL);
    upperIfEmpty(right, y, roof.upper.trimCapR);
    y += 1;
  }

  // ── 벽(상단 1 + 중단 N + 하단 1) ──
  const wallTopY = y;
  nineSliceRow(y, kit.wall.top);
  y += 1;
  for (let row = 0; row < wallMidRows(plan.stories); row += 1, y += 1) nineSliceRow(y, kit.wall.mid);
  nineSliceRow(y, kit.wall.bottom);

  const doorAt = { x: left + Math.floor(plan.width / 2), y };
  placeWindowsOnWallRuns(map, kit, rectWallMidRuns(left, right, wallTopY, plan.stories), plan.windows, doorAt);

  return { ok: true, doorAt, height };
}
