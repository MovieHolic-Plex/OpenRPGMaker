// editor/houseKit.ts
// 집 하네싱 키트 — 사용자 기준 집(연습04 파랑+석벽 / 연습08 밝은오렌지+회벽)에서 학습한
// 타일 역할·연속 규칙을 선언적 키트로 고정하고, 직사각 집을 규칙 그대로 전개한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png
//
// 불변식(하네싱 규칙):
// 1) 벽 = 상단 1행 + 중단 N행 + 하단 1행 나인슬라이스. 가로는 중앙 열만 반복.
// 2) 지붕(하위) = 처마 1행 + 몸통 N행 (+ 파랑은 좌우 1칸 인셋된 최상행 1행).
// 3) 레이어 분배(2026-07-17 사용자 교정): 불투명 지붕 조각(몸통·처마·용마루 374·
//    사선 트림 376/377·A자 꼭짓점)은 전부 "하위" — 지붕 몸체다. 상위에는 투명 캡
//    (354-357/384-387, 뒤로 잔디가 비침)과 소품(굴뚝 326 등)만 "빈 칸에만" 얹는다.
// 4) 세트 혼합 금지 — 벽·지붕은 키트로 페어 고정.

import { TILE } from "@/project/defaults/constants";
import { createHouseDoorEvent, createHouseDoorStepEvent } from "@/editor/houseInteriors";
import type { GameEvent, GameMap, MapId } from "@/project/types";

export type HouseKitId = "blue-stone" | "bright-plaster" | "amber-wood" | "slate-wood" | "timber-hall" | "aframe-stone";

/** 모든 집 키트 id (툴 enum/검증 공용). */
export const ALL_HOUSE_KIT_IDS = ["blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall", "aframe-stone"] as const satisfies readonly HouseKitId[];

/**
 * 랜덤 킷 믹스에 넣어도 되는 킷. aframe은 날개 높이가 폭에 종속(피라미드)이라
 * 임의 템플릿에 배정하면 시공이 실패한다 — aframe-* 템플릿이 킷을 강제할 때만 쓴다.
 */
export const MIXABLE_HOUSE_KIT_IDS = ["blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall"] as const satisfies readonly HouseKitId[];

export function isHouseKitId(value: unknown): value is HouseKitId {
  return typeof value === "string" && (ALL_HOUSE_KIT_IDS as readonly string[]).includes(value);
}

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

interface AframeRoofKit {
  readonly kind: "aframe";
  readonly body: number; // 404 — 피라미드 내부 채움 (하위)
  readonly eave: number; // 405 — 최하행, 벽과 같은 폭 (하위)
  readonly upper: {
    readonly capL: number; // 354 — 좌사선 캡, 행마다 1칸씩 안으로
    readonly capR: number; // 355
    readonly apex: number; // 374 — 홀수 폭 꼭짓점 1칸
    readonly trimCapL: number; // 384 — 처마 행 좌우 마감
    readonly trimCapR: number; // 385
  };
}

export interface HouseKit {
  readonly id: HouseKitId;
  readonly name: string;
  readonly windowTile: number;
  readonly wall: WallNineSlice;
  /**
   * 하프팀버 기둥 열(2026-07-17 사용자 규약): 벽 내부 열을 every 간격으로 기둥
   * 세로 3단(top/mid/bottom)으로 교체한다 — 기둥(196/226/256)과 회벽(16/46/76)의 반복.
   */
  readonly postColumn?: { readonly tiles: readonly [number, number, number]; readonly every: number };
  readonly roof: BlueRoofKit | BrightRoofKit | AframeRoofKit;
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
  "amber-wood": {
    id: "amber-wood",
    name: "밝은 오렌지 지붕 + 통나무 벽",
    windowTile: 85,
    wall: { top: [102, 103, 104], mid: [132, 133, 134], bottom: [162, 163, 164] },
    roof: {
      kind: "bright",
      body: 404,
      eave: 405,
      upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
    },
  },
  "slate-wood": {
    id: "slate-wood",
    name: "파랑 지붕 + 통나무 벽",
    windowTile: 87,
    wall: { top: [102, 103, 104], mid: [132, 133, 134], bottom: [162, 163, 164] },
    roof: { kind: "blue", body: 406, rightEdge: 407, eave: 467, upper: { nw: 356, ne: 357, sw: 386, se: 387 } },
  },
  // 2026-07-17 사용자 규약 2차: 기둥 세로 3단(196/226/256)과 회벽 열(16/46/76)의 교대 반복.
  // 조립 검증: scratchpad todo-evidence/timber-hall-C.png — 좌우 가장자리 기둥 + 내부 3칸 간격 기둥.
  "timber-hall": {
    id: "timber-hall",
    name: "빨간 널지붕 + 목조 기둥 홀",
    windowTile: 85,
    wall: { top: [196, 16, 196], mid: [226, 46, 226], bottom: [256, 76, 256] },
    postColumn: { tiles: [196, 226, 256], every: 3 },
    roof: {
      kind: "bright",
      body: 404,
      eave: 405,
      upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
    },
  },
  // 2026-07-17 이미지 #6(큰 삼각 빨간 지붕 + 회색 석벽): 사선 캡 354/355를 행마다
  // 1칸씩 좁혀 쌓는 피라미드 지붕. 날개 높이 = 벽 밴드 + floor((폭-1)/2) + 1 로
  // 폭에 종속 — 랜덤 믹스에서 제외(MIXABLE)하고 aframe-* 템플릿이 킷을 강제한다.
  "aframe-stone": {
    id: "aframe-stone",
    name: "빨간 A자 지붕 + 석벽",
    windowTile: 85,
    wall: { top: [12, 13, 14], mid: [42, 43, 44], bottom: [72, 73, 74] },
    roof: { kind: "aframe", body: 404, eave: 405, upper: { capL: 354, capR: 355, apex: 374, trimCapL: 384, trimCapR: 385 } },
  },
};

export type HouseKitWindowsOption = { readonly spacing?: number } | false;

/**
 * 굴뚝(2026-07-20 채택). 어휘 정본: tileSemanticsCombinedTown 326 "지붕 장식 — 굴뚝, 우측 사선 지붕용".
 * 상위 레이어 소품 규약(§3)을 따른다 — 빈 칸에만, 우측 사선 지붕 열의 상단 바로 아래.
 */
export const CHIMNEY_TILE = 326;

export interface RectHousePlan {
  /** 바운딩 박스 좌상단 (bright는 용마루(상위) 행이 y, blue는 지붕 최상행이 y). */
  readonly x: number;
  readonly y: number;
  /** 벽 폭(칸). 최소 3 — 좌/우 모서리 + 중앙 1칸. */
  readonly width: number;
  /** 층수. 벽 중단 행 수 = 2*stories - 1 (1층=1, 2층=3). */
  readonly stories: 1 | 2 | 3;
  /** 지붕 몸통 행 수(≥1). 높은 지붕이 필요하면 늘린다. */
  readonly roofBodyRows: number;
  readonly kitId: HouseKitId;
  /** 낮은 벽(창고/헛간): 벽을 상단+하단 2행만 — 중단 없음, 창 없음. stories 무시. */
  readonly lowWall?: boolean;
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

export function rectHouseHeight(
  plan: Pick<RectHousePlan, "stories" | "roofBodyRows" | "kitId"> & Partial<Pick<RectHousePlan, "width" | "lowWall">>,
): number {
  const wallRows = plan.lowWall ? 2 : 2 + wallMidRows(plan.stories);
  // aframe: 지붕 행수는 폭에 종속 — 피라미드 floor((폭-1)/2) + 처마 1행 (roofBodyRows 무시).
  if (HOUSE_KITS[plan.kitId]?.roof.kind === "aframe" && typeof plan.width === "number") {
    return Math.floor((plan.width - 1) / 2) + 1 + wallRows;
  }
  // blue: 최상행 + 몸통 + 처마 / bright: 용마루(상위) 행 + 몸통 + 처마 — 총 행수는 동일 구조.
  return 1 + plan.roofBodyRows + 1 + wallRows;
}

function wallMidRows(stories: 1 | 2 | 3): number {
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
      // 하프팀버 기둥 열에는 창을 내지 않는다 — 회벽 열에만.
      const lowerTile = map.lowerTiles[run.y * map.width + x] ?? TILE.EMPTY;
      if (kit.postColumn && (kit.postColumn.tiles as readonly number[]).includes(lowerTile)) continue;
      upperIfEmpty(map, x, run.y, kit.windowTile);
    }
  }
}

function wallWindowRunsFromRoles(wallRole: ReadonlyMap<number, 0 | 1 | 2>, width: number): WallRun[] {
  const runs: WallRun[] = [];
  const cellKey = (x: number, y: number): number => y * width + x;
  const eligible = new Set<number>();
  for (const [cell, role] of wallRole.entries()) {
    if (role !== 1) continue;
    const x = cell % width;
    const y = Math.floor(cell / width);
    let midRowsAbove = 0;
    while (wallRole.get(cellKey(x, y - midRowsAbove - 1)) === 1) midRowsAbove += 1;
    if (midRowsAbove % 2 === 0) eligible.add(cell);
  }
  for (const cell of eligible) {
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (x > 0 && eligible.has(cellKey(x - 1, y))) continue;
    let x1 = x;
    while (x1 + 1 < width && eligible.has(cellKey(x1 + 1, y))) x1 += 1;
    runs.push({ x0: x, x1, y });
  }
  return runs.sort((a, b) => a.y - b.y || a.x0 - b.x0);
}

function rectWallWindowRuns(left: number, right: number, wallTopY: number, stories: 1 | 2 | 3): WallRun[] {
  return Array.from({ length: stories }, (_, floor) => ({ x0: left, x1: right, y: wallTopY + 1 + floor * 2 }));
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
  /**
   * 층수. 벽 밴드 행 수 = 2 + (2*stories-1).
   * 1층=벽3행(상·중·하), 2층=벽5행(상·중×3·하). 기본 1.
   */
  readonly stories?: 1 | 2 | 3;
  /** 낮은 벽(창고/헛간): 벽 밴드를 상단+하단 2행만 — 중단 없음, 창 없음. stories 무시. */
  readonly lowWall?: boolean;
  /** 창문 자동 배치. 기본 활성, spacing=2. */
  readonly windows?: HouseKitWindowsOption;
  /** 굴뚝(326, 상위) — 우측 사선 지붕 상단에 1개. 기본 꺼짐. */
  readonly chimney?: boolean;
  /** 내부 맵으로 이어지는 문 이벤트. 도구 계층에서 내부 맵을 만든 뒤 주입한다. */
  readonly doorEvent?: FootprintHouseDoorEventPlan | false;
}

export interface FootprintHouseDoorEventPlan {
  readonly eventId: string;
  readonly interiorMapId: MapId;
  readonly name?: string;
}

export function stampFootprintHouseKit(map: GameMap, plan: FootprintHousePlan): RectHouseStampResult {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) return { ok: false, reason: `알 수 없는 키트: ${plan.kitId}` };
  if (plan.wings.length === 0) return { ok: false, reason: "날개가 없습니다." };
  const stories: 1 | 2 | 3 = plan.stories === 3 ? 3 : plan.stories === 2 ? 2 : 1;
  // 벽 밴드: 상단1 + 중단(2*stories-1) + 하단1 — lowWall(헛간)은 상단+하단만.
  const wallBandRows = plan.lowWall ? 2 : 2 + wallMidRows(stories);
  // aframe: 피라미드 지오메트리 검증 — 단일 직사각 날개 + 높이 = 벽 밴드 + floor((폭-1)/2) + 1.
  if (kit.roof.kind === "aframe") {
    if (plan.wings.length !== 1) return { ok: false, reason: "A자 지붕 킷은 단일 직사각 날개만 지원합니다." };
    const wing = plan.wings[0]!;
    const required = wallBandRows + Math.floor((wing.w - 1) / 2) + 1;
    if (wing.h !== required) {
      return { ok: false, reason: `A자 지붕 날개는 h=${required}(벽 ${wallBandRows} + 지붕 ${required - wallBandRows})이어야 합니다 (현재 ${wing.h}).` };
    }
  }

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
      if (height < wallBandRows + 2) {
        return { ok: false, reason: `열 x=${x}의 구간 높이(${height})가 최소 ${wallBandRows + 2}(벽 ${wallBandRows}+지붕 2)보다 작습니다.` };
      }
      // role: 0=상단, 마지막=하단, 중간=중단(창 배치 대상)
      for (let wy = bottom - wallBandRows + 1; wy <= bottom; wy += 1) {
        const offset = wy - (bottom - wallBandRows + 1);
        const role: 0 | 1 | 2 = offset === 0 ? 0 : offset === wallBandRows - 1 ? 2 : 1;
        wallRole.set(key(x, wy), role);
      }
      for (let ry = top; ry <= bottom - wallBandRows; ry += 1) roof.add(key(x, ry));
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

  // ── 벽: 같은 행·같은 역할의 연속 런을 나인슬라이스로 (+하프팀버 기둥 열 교대) ──
  for (const [cell, role] of [...wallRole.entries()].sort((a, b) => a[0] - b[0])) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    const slice = role === 0 ? kit.wall.top : role === 1 ? kit.wall.mid : kit.wall.bottom;
    const runStart = !wallRole.has(key(x - 1, y)) || wallRole.get(key(x - 1, y)) !== role;
    const runEnd = !wallRole.has(key(x + 1, y)) || wallRole.get(key(x + 1, y)) !== role;
    let tile = runStart ? slice[0] : runEnd ? slice[2] : slice[1];
    if (!runStart && !runEnd && kit.postColumn) {
      let runX0 = x;
      while (wallRole.get(key(runX0 - 1, y)) === role) runX0 -= 1;
      if ((x - runX0) % kit.postColumn.every === 0) tile = kit.postColumn.tiles[role as 0 | 1 | 2];
    }
    lower(x, y, tile);
  }

  // ── 지붕: 기준 집에서 추출한 국소 규칙 ──
  // aframe: 처마 위로 행마다 좌우 1칸씩 좁아지는 피라미드 — 사선 캡(354/355) 바깥은
  // 잔디 그대로 남겨 삼각 실루엣을 만든다 (파랑 최상행 인셋 어깨와 같은 원리).
  if (kit.roof.kind === "aframe") {
    const wing = plan.wings[0]!;
    const left = wing.x;
    const right = wing.x + wing.w - 1;
    const eaveY = wing.y + wing.h - wallBandRows - 1;
    for (let x = left; x <= right; x += 1) lower(x, eaveY, kit.roof.eave);
    upperIfEmpty(left, eaveY, kit.roof.upper.trimCapL);
    upperIfEmpty(right, eaveY, kit.roof.upper.trimCapR);
    for (let k = 1; k <= eaveY - wing.y; k += 1) {
      const rowY = eaveY - k;
      const capLX = left + k;
      const capRX = right - k;
      if (capLX === capRX) {
        lower(capLX, rowY, kit.roof.upper.apex); // 꼭짓점 374는 불투명 — 하위 (2026-07-17 교정)
        continue;
      }
      upperIfEmpty(capLX, rowY, kit.roof.upper.capL);
      upperIfEmpty(capRX, rowY, kit.roof.upper.capR);
      for (let x = capLX + 1; x < capRX; x += 1) lower(x, rowY, kit.roof.body);
    }
  } else for (const cell of roof) {
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
    // 2026-07-17 사용자 교정: 불투명 사선(용마루 374·트림 376/377)은 하위 레이어 —
    // 상위는 투명 캡(354/355/384/385)과 소품(굴뚝 등)의 자리다.
    const lowerIfInMap = (nx: number, ny: number, tile: number): void => {
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return;
      map.lowerTiles[key(nx, ny)] = tile;
    };
    const eaveAt = (nx: number, ny: number): boolean => inRoof(nx, ny) && !inRoof(nx, ny + 1);
    const edgeL = !inRoof(x - 1, y) || eaveAt(x - 1, y);
    const edgeR = !inRoof(x + 1, y) || eaveAt(x + 1, y);
    if (isEave) {
      lower(x, y, kit.roof.eave);
      if (!inRoof(x - 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapL);
      if (!inRoof(x + 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapR);
      if (isTop) lowerIfInMap(x, y - 1, kit.roof.upper.ridge);
      continue;
    }
    if (edgeL) {
      lower(x, y, kit.roof.upper.trimL);
      if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridgeCapL);
      continue;
    }
    if (edgeR) {
      lower(x, y, kit.roof.upper.trimR);
      if (isTop) upperIfEmpty(x, y - 1, kit.roof.upper.ridgeCapR);
      continue;
    }
    lower(x, y, kit.roof.body);
    if (isTop) lowerIfInMap(x, y - 1, kit.roof.upper.ridge);
  }

  // ── 굴뚝(선택): 우측 사선 지붕 상단 바로 아래 — 상위 소품 규약(빈 칸에만) ──
  if (plan.chimney) {
    if (kit.roof.kind === "aframe") {
      // 피라미드는 우측 바깥 열이 잔디라 사선 캡 안쪽 몸통 위에 얹는다.
      const wing = plan.wings[0]!;
      const eaveY = wing.y + wing.h - wallBandRows - 1;
      const x = wing.x + wing.w - 3;
      if (eaveY - 1 >= wing.y && x > wing.x) upperIfEmpty(x, eaveY - 1, CHIMNEY_TILE);
    } else {
      let bestX = -1;
      for (const cell of roof) bestX = Math.max(bestX, cell % map.width);
      if (bestX >= 0) {
        let topY = Infinity;
        for (const cell of roof) {
          if (cell % map.width === bestX) topY = Math.min(topY, Math.floor(cell / map.width));
        }
        upperIfEmpty(bestX, topY + 1, CHIMNEY_TILE);
      }
    }
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
  placeWindowsOnWallRuns(map, kit, wallWindowRunsFromRoles(wallRole, map.width), plan.windows, doorAt);
  if (doorAt && plan.doorEvent) {
    upsertEvent(map, createHouseDoorEvent({
      eventId: plan.doorEvent.eventId,
      x: doorAt.x,
      y: doorAt.y,
      interiorMapId: plan.doorEvent.interiorMapId,
      kitId: plan.kitId,
      name: plan.doorEvent.name,
    }));
    // 열린 문 기본값: 문 앞 통행 칸에 밟으면 열리는 발판 — 문 칸은 벽이라 밟히지 않는다.
    // 문 앞이 맵 밖이면 발판을 생략한다(문 스프라이트만 남는다).
    if (doorAt.y + 1 < map.height) {
      upsertEvent(map, createHouseDoorStepEvent({
        eventId: `${plan.doorEvent.eventId}_step`,
        x: doorAt.x,
        y: doorAt.y + 1,
        interiorMapId: plan.doorEvent.interiorMapId,
        name: plan.doorEvent.name,
      }));
    }
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
  // 나인슬라이스 한 행: 좌 모서리 + 중앙 반복 + 우 모서리 (+하프팀버 기둥 열 교대).
  const nineSliceRow = (y: number, [l, c, r]: readonly [number, number, number], postTile?: number): void => {
    lower(left, y, l);
    for (let x = left + 1; x < right; x += 1) {
      const isPost = postTile !== undefined && kit.postColumn !== undefined && (x - left) % kit.postColumn.every === 0;
      lower(x, y, isPost ? postTile : c);
    }
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
  } else if (roof.kind === "bright") {
    // 용마루 행: 몸통 폭 = 벽보다 좌우 1칸 인셋 → 용마루도 인셋 폭, 캡은 그 바깥.
    // 2026-07-17 사용자 교정: 사선 지붕의 불투명 조각(용마루 374·트림 376/377)은 지붕
    // "몸체"라서 하위 레이어 — 상위는 투명 캡(354/355/384/385)과 소품(굴뚝 등)의 자리다.
    for (let x = left + 1; x < right; x += 1) lower(x, y, roof.upper.ridge);
    upperIfEmpty(left, y, roof.upper.ridgeCapL);
    upperIfEmpty(right, y, roof.upper.ridgeCapR);
    y += 1;
    // 몸통행 ×N (인셋) + 좌우 바깥 열 수직 트림(하위).
    for (let row = 0; row < plan.roofBodyRows; row += 1, y += 1) {
      for (let x = left + 1; x < right; x += 1) lower(x, y, roof.body);
      lower(left, y, roof.upper.trimL);
      lower(right, y, roof.upper.trimR);
    }
    // 처마행: 벽과 같은 폭(몸통보다 +1 오버행), 트림 하단 캡을 처마 위에 겹침.
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.trimCapL);
    upperIfEmpty(right, y, roof.upper.trimCapR);
    y += 1;
  } else {
    // aframe: 꼭짓점(374)부터 행마다 좌우 1칸씩 넓어지는 피라미드 — roofBodyRows 무시,
    // 행수는 폭에 종속(floor((폭-1)/2)). 사선 캡 354/355 바깥은 잔디 그대로.
    const pyramidRows = Math.floor((plan.width - 1) / 2);
    for (let row = 0; row < pyramidRows; row += 1, y += 1) {
      const inset = pyramidRows - row;
      const capLX = left + inset;
      const capRX = right - inset;
      if (capLX === capRX) {
        lower(capLX, y, roof.upper.apex); // 꼭짓점 374는 불투명 — 하위 (2026-07-17 교정)
        continue;
      }
      upperIfEmpty(capLX, y, roof.upper.capL);
      upperIfEmpty(capRX, y, roof.upper.capR);
      for (let x = capLX + 1; x < capRX; x += 1) lower(x, y, roof.body);
    }
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.trimCapL);
    upperIfEmpty(right, y, roof.upper.trimCapR);
    y += 1;
  }

  // ── 벽(상단 1 + 중단 N + 하단 1 — lowWall은 상단+하단만) ──
  const wallTopY = y;
  nineSliceRow(y, kit.wall.top, kit.postColumn?.tiles[0]);
  y += 1;
  const midRows = plan.lowWall ? 0 : wallMidRows(plan.stories);
  for (let row = 0; row < midRows; row += 1, y += 1) nineSliceRow(y, kit.wall.mid, kit.postColumn?.tiles[1]);
  nineSliceRow(y, kit.wall.bottom, kit.postColumn?.tiles[2]);

  const doorAt = { x: left + Math.floor(plan.width / 2), y };
  if (!plan.lowWall) {
    placeWindowsOnWallRuns(map, kit, rectWallWindowRuns(left, right, wallTopY, plan.stories), plan.windows, doorAt);
  }

  return { ok: true, doorAt, height };
}
