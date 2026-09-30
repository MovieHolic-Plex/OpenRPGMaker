// 높이 지형(relief). 맵 칸마다 0~MAX 단의 높이를 두고, 렌더러가 3/4 시점 절벽을 그린다.
// 1단 = 벽 1칸(16px). 타일 층과 따로 저장하며, 렌더 결과는 하층과 상층 사이에 깔린다.

export const RELIEF_TILE = 16;
export const RELIEF_UNIT = RELIEF_TILE;
export const RELIEF_MAX_LEVEL = 14;

/** 행 우선 높이 격자. levels[y * width + x], y=0 이 북쪽(화면 위). */
export interface ReliefData {
  width: number;
  height: number;
  levels: number[];
}

/** 편집·연산 단위: heights[y][x] */
export type HeightGrid = number[][];

export const gridFromRelief = (r: ReliefData): HeightGrid =>
  Array.from({ length: r.height }, (_, y) => r.levels.slice(y * r.width, (y + 1) * r.width));

export const reliefFromGrid = (h: HeightGrid): ReliefData => ({
  width: h[0]?.length ?? 0,
  height: h.length,
  levels: h.flat(),
});

export const copyGrid = (h: HeightGrid): HeightGrid => h.map((r) => r.slice());
