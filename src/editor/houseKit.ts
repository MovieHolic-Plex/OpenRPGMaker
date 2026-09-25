// editor/houseKit.ts
// 집 하네싱 키트 — 사용자 기준 집(연습04 파랑+석벽 / 연습08 밝은오렌지+회벽)에서 학습한
// 타일 역할·연속 규칙을 선언적 키트로 고정하고, 직사각 집을 규칙 그대로 전개한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png
//
// 불변식(하네싱 규칙):
// 1) 벽 = 상단 1행 + 중단 N행 + 하단 1행 나인슬라이스. 가로는 중앙 열만 반복.
// 2) 지붕(하위) = 처마 1행 + 몸통 N행 (+ 파랑은 좌우 1칸 인셋된 최상행 1행).
// 3) 레이어 분배(2026-07-17 사용자 교정): 불투명 지붕 조각(몸통·처마·용마루 374·
//    사선 트림 376/377)은 전부 "하위" — 지붕 몸체다. 상위에는 투명 캡
//    (354-357/384-387, 뒤로 잔디가 비침)과 소품(굴뚝 326 등)만 "빈 칸에만" 얹는다.
// 4) 세트 혼합 금지 — 벽·지붕은 키트로 페어 고정.

import { TILE } from "@/project/defaults/constants";
import { createHouseDoorEvent, createHouseDoorStepEvent, stampHouseDoorBackground } from "@/editor/houseInteriors";
import { housePartTile } from "@/project/defaults/forestHarmonyHouseParts";
import type { GameEvent, GameMap, MapId } from "@/project/types";

export type HouseKitId =
  | "blue-stone" | "bright-plaster" | "amber-wood" | "slate-wood" | "timber-hall"
  | "moss-plaster" | "thatch-plaster" | "thatch-log" | "amber-brick" | "slate-brick" | "charcoal-timber";

/**
 * 재료 킷(2026-09-25) — 새 지붕색(이끼 초록·초가·회청 슬레이트·검은 기와)과 새 벽(붉은 벽돌·반목조).
 * 칸은 숲마을 집 부품 시트(forest_harmony 3071~, project/defaults/forestHarmonyHouseParts)에 있다.
 * 그 칸이 없는 타일셋(기후 시트 등)에서는 fallbackKitId 로 바꿔 짓는다 — 랜덤 믹스에도 그런 타일셋에선 안 넣는다.
 */
export const MATERIAL_HOUSE_KIT_IDS = [
  "moss-plaster", "thatch-plaster", "thatch-log", "amber-brick", "slate-brick", "charcoal-timber",
] as const satisfies readonly HouseKitId[];

/** 모든 집 키트 id (툴 enum/검증 공용). */
export const ALL_HOUSE_KIT_IDS = [
  "blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall", ...MATERIAL_HOUSE_KIT_IDS,
] as const satisfies readonly HouseKitId[];

/**
 * 랜덤 킷 믹스에 넣어도 되는 킷.
 *
 * 2026-09-11: A자(피라미드) 지붕 킷 `aframe-stone` 을 삭제하면서 이 목록과
 * `ALL_HOUSE_KIT_IDS` 가 같아졌다. 예전에는 "높이가 폭에 종속" 이라 믹스에서
 * 빠져 있었는데, 그런 킷 자체가 없어졌다. 계단식 2층은 이제 날개별 stories 로
 * 만든다(§ FootprintWing.stories).
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
  readonly roof: BlueRoofKit | BrightRoofKit;
  /** 집 부품 시트 칸을 쓰는 재료 킷이면, 그 칸이 없는 타일셋에서 대신 쓸 기본 킷. */
  readonly fallbackKitId?: HouseKitId;
}

/** 재료 킷의 지붕 — 집 부품 시트의 재칠 칸(roof-<재료>-<원본 번호>). */
function brightRoofFrom(material: string): BrightRoofKit {
  const t = (tile: number): number => housePartTile(`roof-${material}-${tile}`);
  return {
    kind: "bright",
    body: t(404),
    eave: t(405),
    upper: { ridge: t(374), ridgeCapL: t(354), ridgeCapR: t(355), trimL: t(376), trimR: t(377), trimCapL: t(384), trimCapR: t(385) },
  };
}

function blueRoofFrom(material: string): BlueRoofKit {
  const t = (tile: number): number => housePartTile(`roof-${material}-${tile}`);
  return { kind: "blue", body: t(406), rightEdge: t(407), eave: t(467), upper: { nw: t(356), ne: t(357), sw: t(386), se: t(387) } };
}

const BRIGHT_ORANGE_ROOF: BrightRoofKit = {
  kind: "bright",
  body: 404,
  eave: 405,
  upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
};
const brick = (tile: number): number => housePartTile(`wall-brick-${tile}`);
const PLASTER_WALL: WallNineSlice = { top: [15, 16, 17], mid: [45, 46, 47], bottom: [75, 76, 77] };
const LOG_WALL: WallNineSlice = { top: [102, 103, 104], mid: [132, 133, 134], bottom: [162, 163, 164] };
const BRICK_WALL: WallNineSlice = {
  top: [brick(12), brick(13), brick(14)], mid: [brick(42), brick(43), brick(44)], bottom: [brick(72), brick(73), brick(74)],
};

/** 이 킷이 집 부품 시트 칸을 쓰는가 — 쓰면 tilesetHasHouseParts 가 참인 타일셋에서만 그대로 짓는다. */
export function houseKitNeedsHouseParts(kitId: HouseKitId): boolean {
  return HOUSE_KITS[kitId].fallbackKitId !== undefined;
}

/** 이 타일셋에서 실제로 쓸 킷 — 재료 킷인데 부품 칸이 없으면 기본 킷으로. */
export function houseKitForTileset(kitId: HouseKitId, hasHouseParts: boolean): HouseKitId {
  return hasHouseParts ? kitId : HOUSE_KITS[kitId].fallbackKitId ?? kitId;
}

/** 랜덤 믹스 후보 — 부품 칸이 있는 타일셋이면 재료 킷까지. */
export function mixableHouseKitIds(hasHouseParts: boolean): readonly HouseKitId[] {
  return hasHouseParts ? [...MIXABLE_HOUSE_KIT_IDS, ...MATERIAL_HOUSE_KIT_IDS] : MIXABLE_HOUSE_KIT_IDS;
}

/**
 * 기둥 열(postColumn)이 설 벽 안쪽 오프셋 — 폭 width 인 벽 런에서.
 *
 * 2026-09-25 사용자 규약: 기둥 칸(양쪽 버팀대)은 벽 **가운데**에만 선다. 바깥 끝(0·width-1)은 물론 끝 바로 옆
 * (1·width-2)에도 세우지 않는다 — 끝 칸의 반기둥과 붙어 기둥 두 개가 겹쳐 보인다. 간격은 every 안팎으로 고르게,
 * 가능하면 좌우 대칭(폭 7 → {3}, 폭 10 → {3,6}, 폭 8 → {3}). 폭 5 이하는 기둥 없음.
 */
export function wallPostOffsets(width: number, every: number): ReadonlySet<number> {
  const out = new Set<number>();
  if (width < 6 || every < 2) return out;
  const count = Math.max(0, Math.round((width - 1) / every) - 1);
  for (let k = 1; k <= count; k += 1) {
    // .5 는 내림 — 폭 8 은 3(문 칸 floor(w/2)=4 와 겹치지 않게), 폭 6 은 2.
    const offset = Math.ceil((k * (width - 1)) / (count + 1) - 0.5);
    if (offset >= 2 && offset <= width - 3) out.add(offset);
  }
  return out;
}

/** 이 킷에서 폭 width 벽 런의 offset 열이 기둥인가. */
export function isWallPostAt(kit: HouseKit, offset: number, width: number): boolean {
  return kit.postColumn !== undefined && wallPostOffsets(width, kit.postColumn.every).has(offset);
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
  // 2026-09-25 사용자 교정: 기둥 196/226/256 은 양쪽 버팀대가 달린 **가운데 전용** 칸이다 — 벽 바깥 끝에 서면
  // 버팀대가 허공을 받친다. 끝은 반기둥+안쪽 버팀대 모서리 칸(15/45/75 · 17/47/77), 기둥은 wallPostOffsets 의 안쪽 열만.
  "timber-hall": {
    id: "timber-hall",
    name: "빨간 널지붕 + 목조 기둥 홀",
    windowTile: 85,
    wall: PLASTER_WALL,
    postColumn: { tiles: [196, 226, 256], every: 3 },
    roof: {
      kind: "bright",
      body: 404,
      eave: 405,
      upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
    },
  },
  // ── 재료 킷(2026-09-25) — 지붕·벽 칸은 집 부품 시트의 재칠 사본 ──
  "moss-plaster": {
    id: "moss-plaster",
    name: "이끼 초록 기와 + 흰 회벽",
    windowTile: 85,
    wall: PLASTER_WALL,
    roof: brightRoofFrom("moss"),
    fallbackKitId: "timber-hall",
  },
  "thatch-plaster": {
    id: "thatch-plaster",
    name: "초가 + 흰 회벽",
    windowTile: 85,
    wall: PLASTER_WALL,
    roof: brightRoofFrom("thatch"),
    fallbackKitId: "timber-hall",
  },
  "thatch-log": {
    id: "thatch-log",
    name: "초가 + 통나무 벽",
    windowTile: 85,
    wall: LOG_WALL,
    roof: brightRoofFrom("thatch"),
    fallbackKitId: "amber-wood",
  },
  "amber-brick": {
    id: "amber-brick",
    name: "주황 기와 + 붉은 벽돌",
    windowTile: 85,
    wall: BRICK_WALL,
    roof: BRIGHT_ORANGE_ROOF,
    fallbackKitId: "bright-plaster",
  },
  "slate-brick": {
    id: "slate-brick",
    name: "회청 슬레이트 + 붉은 벽돌",
    windowTile: 87,
    wall: BRICK_WALL,
    roof: blueRoofFrom("slate"),
    fallbackKitId: "blue-stone",
  },
  // 반목조: 세 칸마다 X 버팀 기둥 열(위 196 · 가운데 X 회벽 · 아래 256), 사이는 민 회벽 — 창은 민 회벽에만 난다.
  "charcoal-timber": {
    id: "charcoal-timber",
    name: "검은 기와 + 반목조",
    windowTile: 85,
    wall: PLASTER_WALL,
    postColumn: { tiles: [196, housePartTile("wall-half-timber-46"), 256], every: 3 },
    roof: blueRoofFrom("charcoal"),
    fallbackKitId: "blue-stone",
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
  /** 낮은 벽(창고/헛간): 벽을 상단+하단 2행만 — 중단 없음, 창은 윗줄(처마 밑). stories 무시. */
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
  const isPostTile = (x: number, y: number): boolean =>
    kit.postColumn !== undefined && (kit.postColumn.tiles as readonly number[]).includes(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const nearDoor = (x: number, y: number): boolean => doorAt !== undefined && Math.abs(x - doorAt.x) <= 1 && y >= doorAt.y - 2;
  for (const run of runs) {
    if (run.x1 - run.x0 + 1 < 3) continue;
    let placed = false;
    for (let x = run.x0 + 1; x <= run.x1 - 1; x += step) {
      if (nearDoor(x, run.y)) continue;
      // 하프팀버 기둥 열에는 창을 내지 않는다 — 회벽 열에만.
      if (isPostTile(x, run.y)) continue;
      upperIfEmpty(map, x, run.y, kit.windowTile);
      placed = true;
    }
    if (placed || spacing === 0) continue;
    // 2026-09-25 사용자 규칙 「3칸 이상 벽 면이면 창 하나는」: 간격이 문·기둥에 다 걸리면 안쪽 빈 칸 → 문에서 먼 벽 끝 칸.
    const inner = Array.from({ length: run.x1 - run.x0 - 1 }, (_, i) => run.x0 + 1 + i).filter((x) => !nearDoor(x, run.y) && !isPostTile(x, run.y));
    const ends = [run.x0, run.x1].filter((x) => !nearDoor(x, run.y));
    const far = (a: number, b: number): number => (doorAt ? Math.abs(b - doorAt.x) - Math.abs(a - doorAt.x) : 0);
    const pick = inner.length > 0 ? inner[Math.floor((inner.length - 1) / 2)] : ends.sort(far)[0];
    if (pick !== undefined) upperIfEmpty(map, pick, run.y, kit.windowTile);
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
  // 낮은 벽(상·하 2줄, 중단 없음)은 윗줄에 처마 밑 창 — 2026-09-25 「창 없는 집이 너무 많다」.
  if (eligible.size === 0) {
    for (const [cell, role] of wallRole.entries()) if (role === 0) eligible.add(cell);
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
  /**
   * 이 날개만의 층수. 생략하면 계획 전체의 `stories` 를 쓴다.
   *
   * 왜 날개별인가(2026-09-11): 2층 본채 앞에 1층 현관 날개를 붙이면 "위층이
   * 드러나는" 계단식 집이 된다. 예전에는 층수가 계획 하나뿐이라 그런 합집합이
   * **열 구간 높이 검사**에 걸려 거부됐다(실측: `a-main-plus-front` 열 x=2 구간
   * 높이 6 < 1층 최소 7). 층수를 열 구간마다 정하면 같은 도형이 정상 시공된다.
   */
  readonly stories?: 1 | 2 | 3;
}

export interface FootprintHousePlan {
  readonly wings: readonly FootprintWing[];
  readonly kitId: HouseKitId;
  /**
   * 층수. 벽 밴드 행 수 = 2 + (2*stories-1).
   * 1층=벽3행(상·중·하), 2층=벽5행(상·중×3·하). 기본 1.
   */
  readonly stories?: 1 | 2 | 3;
  /** 낮은 벽(창고/헛간): 벽 밴드를 상단+하단 2행만 — 중단 없음, 창은 윗줄(처마 밑). stories 무시. */
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
  readonly seed?: number;
}

export function stampFootprintHouseKit(map: GameMap, plan: FootprintHousePlan): RectHouseStampResult {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) return { ok: false, reason: `알 수 없는 키트: ${plan.kitId}` };
  if (plan.wings.length === 0) return { ok: false, reason: "날개가 없습니다." };
  const stories: 1 | 2 | 3 = plan.stories === 3 ? 3 : plan.stories === 2 ? 2 : 1;
  /**
   * 열 구간 하나가 쓸 층수. 날개가 자기 층수를 선언하면 그 값을, 아니면 계획값을 쓴다.
   *
   * 2층 본채 앞에 1층 날개를 붙인 계단식 집이 여기서 성립한다 — 예전에는 계획 층수
   * 하나로 전 열을 재서 1층 날개의 구간이 "최소 높이 미달"로 거부됐다.
   */
  const storiesAt = (x: number, y: number): 1 | 2 | 3 => {
    const containing = plan.wings.filter((wing) =>
      x >= wing.x && x < wing.x + wing.w && y >= wing.y && y < wing.y + wing.h);
    // 날개가 겹칠 때는 **층수를 선언한 날개**가 이긴다 — 선언 없는 날개가 먼저 와도
    // 계단식 의도(2층 본채 + 1층 날개)가 조용히 무시되지 않게 한다.
    for (const wing of containing) if (wing.stories !== undefined) return wing.stories;
    return stories;
  };
  const wallBandAt = (x: number, y: number): number =>
    plan.lowWall ? 2 : 2 + wallMidRows(storiesAt(x, y));
  /**
   * 그 칸의 나인슬라이스 런을 소유하는 날개. 좌우 끝 타일은 **행 안의 역할 연속**이
   * 아니라 이 날개의 가로 범위로 정한다.
   *
   * 핵심은 이 날개를 **벽 밴드 행**에서 고르는 것이다. 층수가 다른 날개가 가로로
   * 맞닿으면, 왼쪽 날개의 윗층 벽(중단 행)과 오른쪽 날개의 아래 벽(상단 행)이 같은
   * 행에서 만나 역할이 같아진다 — 역할만 보면 한 런이 되어 좌측 끝 타일이 오른쪽
   * 날개의 왼쪽 모서리에, 우측 끝 타일이 왼쪽 날개의 오른쪽 모서리에 붙는다
   * (2026-09-11 사용자 실측: 계단식 2층의 좌우 접합부).
   *
   * 그 행에서 벽 밴드가 아닌 날개(예: 더 낮은 층의 지붕만 그 행에 걸친 날개)는
   * 후보에서 뺀다 — 그러지 않으면 그 날개가 런을 가로채 정작 벽을 그리는 날개의
   * 좌우 끝을 잃는다. 밴드 후보가 여럿이면 층수가 가장 높은 날개가 이긴다.
   */
  const ownerAt = (x: number, y: number, isWallRow: boolean): FootprintWing | undefined => {
    const containing = plan.wings.filter((wing) =>
      x >= wing.x && x < wing.x + wing.w && y >= wing.y && y < wing.y + wing.h);
    if (isWallRow) {
      // 그 행이 이 날개의 벽 밴드(top..bottom) 안에 들어야 한다.
      const wallCandidates = containing.filter((wing) => {
        const band = plan.lowWall ? 2 : 2 + wallMidRows(wing.stories ?? stories);
        const bottom = wing.y + wing.h - 1;
        return y >= bottom - band + 1 && y <= bottom;
      });
      if (wallCandidates.length > 0) {
        return wallCandidates.reduce((best, wing) =>
          (wing.stories ?? stories) > (best.stories ?? stories) ? wing : best);
      }
    }
    return containing.find((wing) => wing.stories !== undefined) ?? containing[0];
  };
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
  /**
   * 지붕 칸 → 그 칸이 속한 열 구간의 벽 밴드(= 층수). **다른 지붕면인지**를 가르는 근거다.
   *
   * 2026-09-11 계단식 2층 결함: 예전에는 가장자리를 "옆 칸이 지붕인가"로만 판정했다.
   * 그래서 2층 본채의 지붕이 1층 날개 지붕과 **같은 면으로 취급**돼, 본채의 옆 트림
   * (376/377)이 생략된 채 두 경사면이 한 장처럼 이어졌다(실측: 접합부가 377 이어야
   * 하는데 404).
   *
   * 기준을 "처마 행"이 아니라 "벽 밴드"로 잡는 이유: 층수가 같은 ㄱ자 집은 날개 길이만
   * 달라도 **한 지붕면**이다(처마가 계단처럼 따라 내려간다) — 연습08 골든이 그렇다.
   * 처마 행으로 가르면 그 정당한 ㄱ자가 두 면으로 쪼개져 옆 트림이 잘못 생긴다(실측).
   * 반대로 층수가 다르면 지붕 높이 자체가 달라 별개의 면이다.
   */
  const roofRunBand = new Map<number, number>();
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
      /**
       * 구간은 유효 층수가 바뀌는 경계에서도 끊긴다 — 층수가 다른 날개가 같은 열에
       * 세로로 붙으면(넓은 1층 위에 2층 본채) 위쪽 덩어리가 자기 벽 밴드를 드러내야
       * 한다. 합치면 위층 벽이 아래 지붕에 삼켜져 한 층짜리 거대 지붕으로 읽힌다.
       * 같은 층수끼리는 계속 한 런이다 — ㄱ자·tier 겹침의 한 지붕면 규칙을 지킨다.
       */
      while (inMass(x, y + 1) && storiesAt(x, y + 1) === storiesAt(x, y)) y += 1;
      const bottom = y;
      const height = bottom - top + 1;
      const runWallBand = wallBandAt(x, bottom);
      if (height < runWallBand + 2) {
        const runStories = wallBandAt(x, bottom) === 2 ? 1 : (runWallBand - 2 + 1) / 2;
        return {
          ok: false,
          reason: `열 x=${x}의 구간 높이(${height})가 최소 ${runWallBand + 2}(벽 ${runWallBand}+지붕 2)보다 작습니다 — 이 구간의 층수는 ${runStories}층입니다. 날개에 stories 를 지정했는지 확인하세요.`,
        };
      }
      // role: 0=상단, 마지막=하단, 중간=중단(창 배치 대상)
      for (let wy = bottom - runWallBand + 1; wy <= bottom; wy += 1) {
        const offset = wy - (bottom - runWallBand + 1);
        const role: 0 | 1 | 2 = offset === 0 ? 0 : offset === runWallBand - 1 ? 2 : 1;
        wallRole.set(key(x, wy), role);
      }
      for (let ry = top; ry <= bottom - runWallBand; ry += 1) {
        roof.add(key(x, ry));
        roofRunBand.set(key(x, ry), runWallBand);
      }
      y = bottom + 1;
    }
  }
  const inRoof = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && roof.has(key(x, y));
  /** (nx,ny) 가 (x,y) 와 **같은 지붕면**인가 — 지붕이면서 벽 밴드(층수)가 같아야 한다. */
  const sameRoofFace = (x: number, y: number, nx: number, ny: number): boolean => {
    if (!inRoof(nx, ny)) return false;
    return roofRunBand.get(key(nx, ny)) === roofRunBand.get(key(x, y));
  };

  const lower = (x: number, y: number, tile: number): void => {
    map.lowerTiles[key(x, y)] = tile;
  };
  const upperIfEmpty = (x: number, y: number, tile: number): void => {
    if (y < 0) return;
    const index = key(x, y);
    if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
  };

  // ── 벽: 같은 행·같은 역할의 연속 런을 나인슬라이스로 (+하프팀버 기둥 열 교대) ──
  //
  // 런 경계는 **역할이 바뀌는 곳**만이 아니다(2026-09-11 사용자 실측: 계단식 2층의
  // 좌우 접합부). 층수가 다른 날개가 가로로 맞닿으면 왼쪽 날개의 윗층 벽(중단 행)과
  // 오른쪽 날개의 아래 벽(상단 행)이 **같은 행**에서 만나 역할이 같아진다. 그러면 좌측
  // 끝 타일이 오른쪽 날개의 왼쪽 모서리에, 우측 끝 타일이 왼쪽 날개의 오른쪽 모서리에
  // 붙는다. 그래서 경계는 행의 역할 연속이 아니라 **날개의 가로 범위**로 정한다.
  for (const [cell, role] of [...wallRole.entries()].sort((a, b) => a[0] - b[0])) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    const slice = role === 0 ? kit.wall.top : role === 1 ? kit.wall.mid : kit.wall.bottom;
    // 런 경계는 그 칸을 덮는 **날개의 가로 범위**다(층수 선언 날개가 이김).
    // 역할 연속으로 재면 층이 다른 두 날개가 같은 행에서 만날 때(왼쪽 날개의 중단 행
    // = 오른쪽 날개의 상단 행) 한 런이 되어 좌측 끝 타일이 오른쪽 날개 왼쪽 모서리에
    // 붙는다 — 2026-09-11 사용자 실측.
    const owner = ownerAt(x, y, true);
    const ownerX0 = owner ? owner.x : x;
    const ownerX1 = owner ? owner.x + owner.w - 1 : x;
    const sameRun = (nx: number): boolean =>
      nx >= ownerX0 && nx <= ownerX1 && inMass(nx, y) && wallRole.get(key(nx, y)) === role;
    const runStart = !sameRun(x - 1);
    const runEnd = !sameRun(x + 1);
    let tile = runStart ? slice[0] : runEnd ? slice[2] : slice[1];
    if (!runStart && !runEnd && kit.postColumn) {
      let runX0 = x;
      while (sameRun(runX0 - 1)) runX0 -= 1;
      let runX1 = x;
      while (sameRun(runX1 + 1)) runX1 += 1;
      if (isWallPostAt(kit, x - runX0, runX1 - runX0 + 1)) tile = kit.postColumn.tiles[role as 0 | 1 | 2];
    }
    lower(x, y, tile);
  }

  // ── 지붕: 기준 집에서 추출한 국소 규칙 ──
  for (const cell of roof) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    // 아래/위 칸이 **다른 지붕면**이면 이 칸은 그 면의 처마/용마루다.
    const isEave = !sameRoofFace(x, y, x, y + 1);
    const isTop = !sameRoofFace(x, y, x, y - 1);
    if (kit.roof.kind === "blue") {
      const edgeL = !sameRoofFace(x, y, x - 1, y);
      const edgeR = !sameRoofFace(x, y, x + 1, y);
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
    const eaveAt = (nx: number, ny: number): boolean =>
      sameRoofFace(x, y, nx, ny) && !sameRoofFace(x, y, nx, ny + 1);
    const edgeL = !sameRoofFace(x, y, x - 1, y) || eaveAt(x - 1, y);
    const edgeR = !sameRoofFace(x, y, x + 1, y) || eaveAt(x + 1, y);
    if (isEave) {
      lower(x, y, kit.roof.eave);
      if (!sameRoofFace(x, y, x - 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapL);
      if (!sameRoofFace(x, y, x + 1, y)) upperIfEmpty(x, y, kit.roof.upper.trimCapR);
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
    stampHouseDoorBackground(map, doorAt);
    upsertEvent(map, createHouseDoorEvent({
      eventId: plan.doorEvent.eventId,
      x: doorAt.x,
      y: doorAt.y,
      interiorMapId: plan.doorEvent.interiorMapId,
      kitId: plan.kitId,
      name: plan.doorEvent.name,
      seed: plan.doorEvent.seed,
    }));
    // 열린 문 기본값: 문 앞 통행 칸에 밟으면 열리는 발판 — 문 칸은 벽이라 밟히지 않는다.
    // 문 앞이 맵 밖이면 발판을 생략한다(문 스프라이트만 남는다).
    if (doorAt.y + 1 < map.height) {
      upsertEvent(map, createHouseDoorStepEvent({
        eventId: `${plan.doorEvent.eventId}_step`,
        doorEventId: plan.doorEvent.eventId,
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
      const isPost = postTile !== undefined && isWallPostAt(kit, x - left, right - left + 1);
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
  }

  // ── 벽(상단 1 + 중단 N + 하단 1 — lowWall은 상단+하단만) ──
  const wallTopY = y;
  nineSliceRow(y, kit.wall.top, kit.postColumn?.tiles[0]);
  y += 1;
  const midRows = plan.lowWall ? 0 : wallMidRows(plan.stories);
  for (let row = 0; row < midRows; row += 1, y += 1) nineSliceRow(y, kit.wall.mid, kit.postColumn?.tiles[1]);
  nineSliceRow(y, kit.wall.bottom, kit.postColumn?.tiles[2]);

  const doorAt = { x: left + Math.floor(plan.width / 2), y };
  placeWindowsOnWallRuns(map, kit, plan.lowWall
    ? [{ x0: left, x1: right, y: wallTopY }]
    : rectWallWindowRuns(left, right, wallTopY, plan.stories), plan.windows, doorAt);

  return { ok: true, doorAt, height };
}
