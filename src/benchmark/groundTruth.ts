// benchmark/groundTruth.ts
// 벤치마크 7개 비전 차원의 ground-truth 타일 세트(todo 1).
//
// 설계: 각 세트는 "파생 함수"(소스 테이블을 읽는 것이 근본 진실)와
// "리터럴 스냅샷"(파생 함수의 현재 출력을 손으로 고정) 쌍으로 내보낸다.
// test/benchmarkGroundTruth.test.ts가 매 실행 리터럴 === 파생 을 검증하므로,
// 소스 테이블이 바뀌면 파생 출력이 바뀌고 스냅샷이 뒤처져 테스트가 실패한다 —
// 즉 스냅샷 갱신이 같은 변경 안에서 강제된다(stale-state 방어).
//
// 소스 테이블:
//  - src/project/defaults/tileSemanticsCombinedTown.ts — COMBINED_TOWN_TILE_SEMANTICS(라벨/역할)
//  - src/project/defaults/constants.ts — TILE enum(FLOOR=342/STAIRS=246 통행 불가 경고)
//  - src/project/tilesetHarness/combinedTownGroups.ts — 지붕 오버레이 + 나무 하네스 그룹
//  - src/project/defaults/autotileGroups.ts — DEFAULT_AUTOTILE_GROUPS + TERRAIN_TEMPLATE_ANCHORS
//
// 하드 제약(계획): 수동 id 추가는 반드시 출처 주석을 달 것. 240은 어떤 오토타일
// 세트에도 넣지 말 것. 342는 FLOOR_TILES에 넣지 말 것. 문/창문은 WALL에서 뺄 것.
import { TILE } from "@/project/defaults/constants";
import { DEFAULT_AUTOTILE_GROUPS, TERRAIN_TEMPLATE_ANCHORS } from "@/project/defaults/autotileGroups";
import {
  type CombinedTownTileSemanticEntry,
  COMBINED_TOWN_TILE_SEMANTICS,
} from "@/project/defaults/tileSemanticsCombinedTown";
import {
  COMBINED_TOWN_HARNESS_GROUPS,
  COMBINED_TOWN_ROOF_OVERLAY_TILES,
} from "@/project/tilesetHarness/combinedTownGroups";

export interface AutotileGroupAnswerEntry {
  readonly id: string;
  readonly anchor: number;
  readonly name: string;
}

export type AutotileAnchorKind = "group" | "water" | "strip" | "base";

export interface AutotileAnchor {
  readonly anchor: number;
  readonly label: string;
  readonly kind: AutotileAnchorKind;
  readonly groupId?: string;
}

/** 캐노피(상단) ↔ 줄기(하단) 한 쌍. */
export type TreePair = readonly [canopy: number, trunk: number];

// ── 공용 헬퍼 ──────────────────────────────────────────────────────────────

/** id 컬렉션을 중복 제거한 뒤 참조 동결한 Set으로 만든다. */
function freezeSet(values: Iterable<number>): ReadonlySet<number> {
  return Object.freeze(new Set<number>(values));
}

/** 시맨틱 테이블에서 조건을 만족하는 항목의 index 목록을 읽는다. */
function semanticIdsWhere(predicate: (entry: CombinedTownTileSemanticEntry) => boolean): number[] {
  return COMBINED_TOWN_TILE_SEMANTICS.filter(predicate).map((entry) => entry.index);
}

// ── WALL ───────────────────────────────────────────────────────────────────

// 문 타일 — tileSemanticsCombinedTown.ts 라벨: 329 "문 상단", 359 "문 하단",
// 116 "나무 문 상단", 146 "나무 문 하단". 계획: "subtract doors {329,359,116,146}".
const DOOR_TILES = [329, 359, 116, 146] as const;

// 창문 타일 — tileSemanticsCombinedTown.ts 라벨: 87 "창문", 28 "성 열린 창문",
// 58 "성 창문", 88 "깨진 창문조각". 계획: "subtract windows {87,28,58,88}".
const WINDOW_SUBTRACT_TILES = [87, 28, 58, 88] as const;

// 계획이 명시한 방어적 합집합(라벨 스캔과 무관하게 보장):
//  - {306, 426} — tileSemanticsCombinedTown.ts "벽"(TILE.WALL=306), "어두운 벽"(426)
//  - {102,103,104,132,133,134,162,163,164} — "나무 집벽 상/중/단" 9종
//  - {15,16,17,45,46,47} — "흰 집벽 상/중단" 6종
//  - {404, 405} — "지붕-벽 경계"
const WALL_PLAN_UNION = [
  TILE.WALL,
  426,
  102, 103, 104, 132, 133, 134, 162, 163, 164,
  15, 16, 17, 45, 46, 47,
  404, 405,
] as const;

export function deriveWallTiles(): ReadonlySet<number> {
  // 1) tileSemanticsCombinedTown.ts 라벨에 벽/wall(대소문자 무시)이 포함된 타일.
  //    현재 일치: 306 "벽", 426 "어두운 벽", 404/405 "지붕-벽 경계",
  //    102..104 "나무 집벽 상단", 132..134 "나무 집벽 중단", 162..164 "나무 집벽 하단",
  //    15..17 "흰 집벽 상단", 45..47 "흰 집벽 중단",
  //    318 "벽 횃불", 320 "벽보", 322 "벽 사다리"(라벨에 벽 포함 — 기계적 스캔 결과).
  const labeled = semanticIdsWhere((entry) => /벽|wall/i.test(entry.label));
  // 2) 계획 명시 합집합.
  const ids = new Set<number>([...labeled, ...WALL_PLAN_UNION]);
  // 3) 문/창문 제외(계획 하드 제약).
  for (const id of [...DOOR_TILES, ...WINDOW_SUBTRACT_TILES]) {
    ids.delete(id);
  }
  return freezeSet(ids);
}

// ── FLOOR ──────────────────────────────────────────────────────────────────

// 계획 명시 합집합 — constants.ts TILE enum: GRASS=240, PATH=360, SAND=423,
// DARK_GRASS=303, FLOWERS=288.
const FLOOR_PLAN_UNION = [TILE.GRASS, TILE.PATH, TILE.SAND, TILE.DARK_GRASS, TILE.FLOWERS] as const;

export function deriveFloorTiles(): ReadonlySet<number> {
  // 1) 라벨에 바닥/floor(대소문자 무시)가 포함된 타일.
  //    현재 일치: 342/343 "돌바닥"(tileSemanticsCombinedTown.ts).
  const labeled = semanticIdsWhere((entry) => /바닥|floor/i.test(entry.label));
  // 2) 계획 명시 합집합.
  const ids = new Set<number>([...labeled, ...FLOOR_PLAN_UNION]);
  // 3) 함정 제외 — TRAP_TILES의 {342, 246}(계획 하드 제약: "traps {342,246} subtracted from FLOOR").
  //    342 = TILE.FLOOR(통행 불가 돌바닥, constants.ts 경고), 246 = TILE.STAIRS(통행 불가).
  for (const id of deriveTrapTiles()) {
    ids.delete(id);
  }
  return freezeSet(ids);
}

// ── ROOF ───────────────────────────────────────────────────────────────────

export function deriveRoofTiles(): ReadonlySet<number> {
  // 1) COMBINED_TOWN_ROOF_OVERLAY_TILES — combinedTownGroups.ts:14 [374,375,376,377,384,385,386,387].
  // 2) 라벨에 지붕/roof(대소문자 무시)가 포함된 타일.
  //    현재 일치: 374/375 "사선 지붕", 404/405 "지붕-벽 경계", 326 "지붕 장식".
  const labeled = semanticIdsWhere((entry) => /지붕|roof/i.test(entry.label));
  return freezeSet([...COMBINED_TOWN_ROOF_OVERLAY_TILES, ...labeled]);
}

// ── WINDOW ─────────────────────────────────────────────────────────────────

export function deriveWindowTiles(): ReadonlySet<number> {
  // {87,28,58,88} ∪ 라벨에 창/window(대소문자 무시)가 포함된 타일.
  // 현재 라벨 일치(창문): 87 "창문", 28 "성 열린 창문", 58 "성 창문", 88 "깨진 창문조각".
  const labeled = semanticIdsWhere((entry) => /창|window/i.test(entry.label));
  return freezeSet([...WINDOW_SUBTRACT_TILES, ...labeled]);
}

// ── TREES ──────────────────────────────────────────────────────────────────

// combinedTownGroups.ts:16-23 — 비공개 상수:
//   CONIFER_TOP=260 / CONIFER_BOTTOM=290
//   DRY_TREE_TOP=261 / DRY_TREE_BOTTOM=291
//   BROADLEAF_TOP_LEFT=262 / BROADLEAF_TOP_RIGHT=263
//   BROADLEAF_BOTTOM_LEFT=292 / BROADLEAF_BOTTOM_RIGHT=293
// 이 값들은 하네스 그룹의 tileIds로 노출된다: verticalTreeGroup → [top, bottom],
// broadleafTreeGroup → [topLeft, topRight, bottomLeft, bottomRight].
const TREE_HARNESS_GROUP_IDS = {
  conifer: "harness-combined-town-conifer-tree",
  dry: "harness-combined-town-dry-tree",
  broadleaf: "harness-combined-town-broadleaf-tree-2x2",
} as const;

function harnessGroupTileIds(id: string): readonly number[] {
  const group = COMBINED_TOWN_HARNESS_GROUPS.find((candidate) => candidate.id === id);
  if (!group) {
    throw new Error(`groundTruth: combinedTownGroups.ts에 하네스 그룹 ${id} 없음`);
  }
  return group.tileIds;
}

function treeTileIds(): { canopy: number[]; trunk: number[]; pairs: TreePair[] } {
  const conifer = harnessGroupTileIds(TREE_HARNESS_GROUP_IDS.conifer); // [260, 290]
  const dry = harnessGroupTileIds(TREE_HARNESS_GROUP_IDS.dry); // [261, 291]
  const broadleaf = harnessGroupTileIds(TREE_HARNESS_GROUP_IDS.broadleaf); // [262, 263, 292, 293]
  return {
    canopy: [conifer[0], dry[0], broadleaf[0], broadleaf[1]],
    trunk: [conifer[1], dry[1], broadleaf[2], broadleaf[3]],
    pairs: [
      [conifer[0], conifer[1]],
      [dry[0], dry[1]],
      [broadleaf[0], broadleaf[2]],
      [broadleaf[1], broadleaf[3]],
    ],
  };
}

export function deriveTreeCanopyTiles(): ReadonlySet<number> {
  return freezeSet(treeTileIds().canopy);
}

export function deriveTreeTrunkTiles(): ReadonlySet<number> {
  return freezeSet(treeTileIds().trunk);
}

export function deriveTreePairs(): readonly TreePair[] {
  return Object.freeze(treeTileIds().pairs);
}

// ── FENCE ──────────────────────────────────────────────────────────────────

// 계획 명시 합집합 — chipsetMapping.ts fenceObjects와 동일한 8종
// (tileSemanticsCombinedTown.ts 라벨 "울타리" 항목).
const FENCE_PLAN_TILES = [378, 379, 380, 408, 409, 410, 438, 439] as const;

export function deriveFenceTiles(): ReadonlySet<number> {
  // {378..439} ∪ 라벨에 울타리/fence(대소문자 무시)가 포함된 타일.
  // 현재 라벨 일치: 378,379,380,408,409,410,438,439 "울타리".
  const labeled = semanticIdsWhere((entry) => /울타리|fence/i.test(entry.label));
  return freezeSet([...FENCE_PLAN_TILES, ...labeled]);
}

// ── TRAPS ──────────────────────────────────────────────────────────────────

// 계획 명시 목록 {342,246,273,333,411,412,413,443}. 출처:
//  - 342 = TILE.FLOOR — constants.ts 경고("통행 불가 장식 타일. 바닥으로 쓰지 말 것",
//    하네스 그룹 stone-floor-trap). 시맨틱 라벨 "돌바닥"(함정 태그).
//  - 246 = TILE.STAIRS — constants.ts 경고("통행 불가 성벽 조각").
//    시맨틱 라벨 "계단(통행 함정·석축 단)".
//  - 273/333 — 키큰 풀 템플릿 블록(243)의 NW/SW 모서리, tileSemanticsCombinedTown.ts "키큰 풀" 항목.
//  - 411,412,413,443 — tileSemanticsCombinedTown.ts "용도 미확정(사용 금지)" 항목.
export function deriveTrapTiles(): ReadonlySet<number> {
  return freezeSet([TILE.FLOOR, TILE.STAIRS, 273, 333, 411, 412, 413, 443]);
}

// ── AUTOTILE ───────────────────────────────────────────────────────────────

export function deriveAutotileGroupAnswer(): readonly AutotileGroupAnswerEntry[] {
  // DEFAULT_AUTOTILE_GROUPS(autotileGroups.ts:216)의 순서 + TERRAIN_TEMPLATE_ANCHORS
  // (autotileGroups.ts:194-214)의 groupId→anchor 매핑을 읽는다.
  // 앵커는 kind:"group" 항목에서만 온다 — 240은 kind:"base"라 승격되지 않는다.
  const anchorByGroupId = new Map<string, number>();
  for (const anchor of TERRAIN_TEMPLATE_ANCHORS) {
    if (anchor.kind === "group" && anchor.groupId) {
      anchorByGroupId.set(anchor.groupId, anchor.anchor);
    }
  }
  return Object.freeze(
    DEFAULT_AUTOTILE_GROUPS.map((group) => {
      const anchor = anchorByGroupId.get(group.id);
      if (anchor === undefined) {
        throw new Error(`groundTruth: DEFAULT_AUTOTILE_GROUPS의 ${group.id}에 TERRAIN_TEMPLATE_ANCHORS 앵커 없음`);
      }
      return Object.freeze({ id: group.id, anchor, name: group.name });
    }),
  );
}

export function deriveAutotileAnchors(): readonly AutotileAnchor[] {
  // TERRAIN_TEMPLATE_ANCHORS(autotileGroups.ts:194-214) 16개 항목을 그대로 노출한다.
  return TERRAIN_TEMPLATE_ANCHORS;
}

// ── 리터럴 스냅샷(파생 함수의 현재 출력을 손으로 고정) ─────────────────────
// 아래 값들은 2026-08-15 기준 소스 테이블에서 파생 함수가 산출하는 결과다.
// 소스 테이블이 바뀌면 테스트가 실패하고, 이 스냅샷을 같은 변경 안에서 갱신해야 한다.

export const WALL_TILES: ReadonlySet<number> = freezeSet([
  15, 16, 17, 45, 46, 47, 102, 103, 104, 132, 133, 134, 162, 163, 164,
  306, 318, 320, 322, 404, 405, 426,
]);

export const FLOOR_TILES: ReadonlySet<number> = freezeSet([240, 288, 303, 343, 360, 423]);

export const ROOF_TILES: ReadonlySet<number> = freezeSet([
  326, 374, 375, 376, 377, 384, 385, 386, 387, 404, 405,
]);

export const WINDOW_TILES: ReadonlySet<number> = freezeSet([28, 58, 87, 88]);

export const TREE_TRUNK_TILES: ReadonlySet<number> = freezeSet([290, 291, 292, 293]);

export const TREE_CANOPY_TILES: ReadonlySet<number> = freezeSet([260, 261, 262, 263]);

export const TREE_PAIRS: readonly TreePair[] = Object.freeze([
  [260, 290],
  [261, 291],
  [262, 292],
  [263, 293],
]);

export const FENCE_TILES: ReadonlySet<number> = freezeSet([378, 379, 380, 408, 409, 410, 438, 439]);

export const TRAP_TILES: ReadonlySet<number> = freezeSet([246, 273, 333, 342, 411, 412, 413, 443]);

export const AUTOTILE_GROUP_ANSWER: readonly AutotileGroupAnswerEntry[] = Object.freeze([
  Object.freeze({ id: "builtin_dirt_road", anchor: 360, name: "흙길" }),
  Object.freeze({ id: "builtin_sand", anchor: 363, name: "모래 지형" }),
  Object.freeze({ id: "builtin_cobble", anchor: 129, name: "포석" }),
  Object.freeze({ id: "builtin_farmland", anchor: 126, name: "경작지" }),
  Object.freeze({ id: "builtin_snow", anchor: 6, name: "눈" }),
  Object.freeze({ id: "builtin_undergrowth", anchor: 9, name: "짙은 수풀" }),
  Object.freeze({ id: "builtin_tall_grass", anchor: 243, name: "키큰 풀" }),
  Object.freeze({ id: "builtin_stone_court", anchor: 246, name: "석축 단(석판)" }),
  Object.freeze({ id: "builtin_gravel_court", anchor: 249, name: "석축 단(자갈)" }),
  Object.freeze({ id: "builtin_darkness", anchor: 366, name: "어둠(석축 테)" }),
  Object.freeze({ id: "builtin_darkness_deep", anchor: 369, name: "어둠(짙은 테)" }),
]);

export const AUTOTILE_ANCHORS: readonly AutotileAnchor[] = Object.freeze([...TERRAIN_TEMPLATE_ANCHORS]);
