// 적 도트 전투 시트의 칸 배치(순수 모듈 — 서버 번들(assetStore/format.ts)과 런타임·에디터가 함께 읽는다. import 없음).
//   3x3 = 9칸 · 4x4 = 16칸(15번 예약, 항상 투명) · 5x4 = 20칸(5열×4행, 행 우선 번호). 0~8 은 세 배치 모두 같은 이름·순서다.
// 칸 이름 ↔ 번호 표는 pixelEnemySheets.ts PIXEL_ENEMY_CELL_INDEX.
export type PixelEnemyGrid = "3x3" | "4x4" | "5x4";
/** 확장 칸(9번 이후)을 갖는 배치. */
export type ExtendedPixelEnemyGrid = "4x4" | "5x4";

export interface PixelEnemyGridDims {
  readonly cols: number;
  readonly rows: number;
}

export const PIXEL_ENEMY_GRIDS: readonly PixelEnemyGrid[] = ["3x3", "4x4", "5x4"];

/** 시트의 열·행 수. grid 생략·모르는 값 = 3x3. */
export function pixelEnemyGridDims(grid: unknown): PixelEnemyGridDims {
  if (grid === "4x4") return { cols: 4, rows: 4 };
  if (grid === "5x4") return { cols: 5, rows: 4 };
  return { cols: 3, rows: 3 };
}

/** 4x4·5x4 인가 — 확장 칸을 읽는 모든 곳이 이 판정 하나를 쓴다. */
export function isExtendedPixelGrid(grid: unknown): grid is ExtendedPixelEnemyGrid {
  return grid === "4x4" || grid === "5x4";
}

/** 비워 둘 수 있는(missingCells 허용) 칸 번호. 4x4 = 9~14(15 는 늘 투명), 5x4 = 9~19. 3x3 은 없다. */
export function pixelEnemyOptionalCells(grid: unknown): readonly number[] {
  if (grid === "4x4") return [9, 10, 11, 12, 13, 14];
  if (grid === "5x4") return [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  return [];
}

/** 늘 완전 투명이어야 하는 예약 칸. 4x4 의 15 번뿐이다. */
export function pixelEnemyReservedCells(grid: unknown): readonly number[] {
  return grid === "4x4" ? [15] : [];
}
