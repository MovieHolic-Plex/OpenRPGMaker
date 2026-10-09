// RPG Maker MV/MZ 오토타일 규격 — rpg_core.js Tilemap 의 쿼터(24px) 합성 표와 이웃 → 모양 번호.
// 표는 rpg_core.js(MIT) 와 같은 값이다 — 고지는 THIRD_PARTY_NOTICES.md 「Format compatibility」.
// 순수 로직이다. 그림 합성은 bake.ts, 타일셋 조립은 tilesetPreset.ts 가 쓴다.
// MV 와 MZ 는 이 표가 같다(tileId 기저만 다르다). 배경: openwiki/teaching-assistant-tilesets.md

import { AUTOTILE_DIR } from "../defaults/autotileEngine";

/** 쿼터 하나 = 오토타일 블록 안의 (qx, qy) 24px 좌표. 항목 순서 = 좌상·우상·좌하·우하. */
export type QuarterTable = readonly (readonly (readonly [number, number])[])[];

/** 바닥형(A1 물·A2 지면·A4 윗면) 48형태. 블록은 2×3칸(4×6 쿼터). */
export const FLOOR_TABLE: QuarterTable = [
  [[2, 4], [1, 4], [2, 3], [1, 3]], [[2, 0], [1, 4], [2, 3], [1, 3]],
  [[2, 4], [3, 0], [2, 3], [1, 3]], [[2, 0], [3, 0], [2, 3], [1, 3]],
  [[2, 4], [1, 4], [2, 3], [3, 1]], [[2, 0], [1, 4], [2, 3], [3, 1]],
  [[2, 4], [3, 0], [2, 3], [3, 1]], [[2, 0], [3, 0], [2, 3], [3, 1]],
  [[2, 4], [1, 4], [2, 1], [1, 3]], [[2, 0], [1, 4], [2, 1], [1, 3]],
  [[2, 4], [3, 0], [2, 1], [1, 3]], [[2, 0], [3, 0], [2, 1], [1, 3]],
  [[2, 4], [1, 4], [2, 1], [3, 1]], [[2, 0], [1, 4], [2, 1], [3, 1]],
  [[2, 4], [3, 0], [2, 1], [3, 1]], [[2, 0], [3, 0], [2, 1], [3, 1]],
  [[0, 4], [1, 4], [0, 3], [1, 3]], [[0, 4], [3, 0], [0, 3], [1, 3]],
  [[0, 4], [1, 4], [0, 3], [3, 1]], [[0, 4], [3, 0], [0, 3], [3, 1]],
  [[2, 2], [1, 2], [2, 3], [1, 3]], [[2, 2], [1, 2], [2, 3], [3, 1]],
  [[2, 2], [1, 2], [2, 1], [1, 3]], [[2, 2], [1, 2], [2, 1], [3, 1]],
  [[2, 4], [3, 4], [2, 3], [3, 3]], [[2, 4], [3, 4], [2, 1], [3, 3]],
  [[2, 0], [3, 4], [2, 3], [3, 3]], [[2, 0], [3, 4], [2, 1], [3, 3]],
  [[2, 4], [1, 4], [2, 5], [1, 5]], [[2, 0], [1, 4], [2, 5], [1, 5]],
  [[2, 4], [3, 0], [2, 5], [1, 5]], [[2, 0], [3, 0], [2, 5], [1, 5]],
  [[0, 4], [3, 4], [0, 3], [3, 3]], [[2, 2], [1, 2], [2, 5], [1, 5]],
  [[0, 2], [1, 2], [0, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [3, 1]],
  [[2, 2], [3, 2], [2, 3], [3, 3]], [[2, 2], [3, 2], [2, 1], [3, 3]],
  [[2, 4], [3, 4], [2, 5], [3, 5]], [[2, 0], [3, 4], [2, 5], [3, 5]],
  [[0, 4], [1, 4], [0, 5], [1, 5]], [[0, 4], [3, 0], [0, 5], [1, 5]],
  [[0, 2], [3, 2], [0, 3], [3, 3]], [[0, 2], [1, 2], [0, 5], [1, 5]],
  [[0, 4], [3, 4], [0, 5], [3, 5]], [[2, 2], [3, 2], [2, 5], [3, 5]],
  [[0, 2], [3, 2], [0, 5], [3, 5]], [[0, 0], [1, 0], [0, 1], [1, 1]],
];

/** 벽형(A3 지붕·벽, A4 벽면) 16형태. 블록은 2×2칸(4×4 쿼터). */
export const WALL_TABLE: QuarterTable = [
  [[2, 2], [1, 2], [2, 1], [1, 1]], [[0, 2], [1, 2], [0, 1], [1, 1]],
  [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[2, 2], [3, 2], [2, 1], [3, 1]], [[0, 2], [3, 2], [0, 1], [3, 1]],
  [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]],
  [[2, 2], [1, 2], [2, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [1, 3]],
  [[2, 0], [1, 0], [2, 3], [1, 3]], [[0, 0], [1, 0], [0, 3], [1, 3]],
  [[2, 2], [3, 2], [2, 3], [3, 3]], [[0, 2], [3, 2], [0, 3], [3, 3]],
  [[2, 0], [3, 0], [2, 3], [3, 3]], [[0, 0], [3, 0], [0, 3], [3, 3]],
];

/** 폭포형(A1 홀수 종류) 4형태. 좌우 이웃만 본다. */
export const WATERFALL_TABLE: QuarterTable = [
  [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]],
];

export type AutotileShapeKind = "floor" | "wall" | "waterfall";

export function quarterTable(kind: AutotileShapeKind): QuarterTable {
  return kind === "floor" ? FLOOR_TABLE : kind === "wall" ? WALL_TABLE : WATERFALL_TABLE;
}

// 바닥형 쿼터 하나가 이웃에 따라 고르는 원본 쿼터. [세로 이웃, 가로 이웃, 대각 이웃] 판정.
// 순서 = 좌상·우상·좌하·우하. 값 = [안쪽, 오목 모서리, 위아래 변, 좌우 변, 바깥 모서리].
const FLOOR_QUARTER_PICKS: readonly (readonly (readonly [number, number])[])[] = [
  [[2, 4], [2, 0], [2, 2], [0, 4], [0, 2]],
  [[1, 4], [3, 0], [1, 2], [3, 4], [3, 2]],
  [[2, 3], [2, 1], [2, 5], [0, 3], [0, 5]],
  [[1, 3], [3, 1], [1, 5], [3, 3], [3, 5]],
];

function sameQuarters(a: readonly (readonly [number, number])[], b: readonly (readonly [number, number])[]): boolean {
  return a.every((q, i) => q[0] === b[i]![0] && q[1] === b[i]![1]);
}

/** 8방향 이웃 마스크(autotileEngine 의 AUTOTILE_DIR 규약) → 바닥형 모양 번호 0..46. */
export function floorShapeForMask(mask: number): number {
  const has = (bit: number) => (mask & bit) !== 0;
  const around = [
    [has(AUTOTILE_DIR.N), has(AUTOTILE_DIR.W), has(AUTOTILE_DIR.NW)],
    [has(AUTOTILE_DIR.N), has(AUTOTILE_DIR.E), has(AUTOTILE_DIR.NE)],
    [has(AUTOTILE_DIR.S), has(AUTOTILE_DIR.W), has(AUTOTILE_DIR.SW)],
    [has(AUTOTILE_DIR.S), has(AUTOTILE_DIR.E), has(AUTOTILE_DIR.SE)],
  ] as const;
  const quarters = around.map(([vertical, horizontal, diagonal], i) => {
    const picks = FLOOR_QUARTER_PICKS[i]!;
    if (vertical && horizontal) return diagonal ? picks[0]! : picks[1]!;
    if (horizontal) return picks[2]!;
    if (vertical) return picks[3]!;
    return picks[4]!;
  });
  const shape = FLOOR_TABLE.findIndex((entry) => sameQuarters(entry, quarters));
  if (shape < 0) throw new Error(`floor autotile mask ${mask} has no MV shape`);
  return shape;
}

/** 4방향 이웃 마스크 → 벽형 모양 번호 0..15. MV 규약: 빠진 쪽 비트 W=1, N=2, E=4, S=8. */
export function wallShapeForMask(mask: number): number {
  const missing = (bit: number) => (mask & bit) === 0;
  return (missing(AUTOTILE_DIR.W) ? 1 : 0) | (missing(AUTOTILE_DIR.N) ? 2 : 0)
    | (missing(AUTOTILE_DIR.E) ? 4 : 0) | (missing(AUTOTILE_DIR.S) ? 8 : 0);
}

/** 좌우 이웃 마스크 → 폭포형 모양 번호 0..3. 빠진 쪽 비트 W=1, E=2. */
export function waterfallShapeForMask(mask: number): number {
  return ((mask & AUTOTILE_DIR.W) === 0 ? 1 : 0) | ((mask & AUTOTILE_DIR.E) === 0 ? 2 : 0);
}

/**
 * 한 오토타일 종류의 칸 번호(모양 순서) → 에디터 AutotileGroup.variantMap.
 * floor 는 8방향 256키, wall·waterfall 은 4방향 16키.
 */
export function autotileVariantMap(kind: AutotileShapeKind, shapeTiles: readonly number[]): Record<string, number> {
  const variantMap: Record<string, number> = {};
  const size = kind === "floor" ? 256 : 16;
  for (let mask = 0; mask < size; mask += 1) {
    const shape = kind === "floor" ? floorShapeForMask(mask) : kind === "wall" ? wallShapeForMask(mask) : waterfallShapeForMask(mask);
    const tile = shapeTiles[shape];
    if (tile !== undefined) variantMap[String(mask)] = tile;
  }
  return variantMap;
}
