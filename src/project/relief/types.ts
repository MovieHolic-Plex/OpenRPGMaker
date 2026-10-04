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
  /**
   * 경사로 칸 표기(선택). 0 없음, 1~4 매끈한 경사로(오르막 n·s·e·w), 5~8 계단(같은 방향 + 4), 9 다리 판(걷기는 보통 칸, 렌더는 둑 없는 판).
   * 경사로 칸의 levels 는 낮은 끝 단. 걷기 규칙·렌더 사각형은 relief/walk.ts.
   */
  ramps?: number[];
  /**
   * 벽면 장식(선택): 칸 (x, y) 의 남쪽 벽 row 번째 줄(1 = 윗면 바로 밑, 최대 그 칸 단 수)에 그리는 타일.
   * 덩굴·폭포·절벽 윗단 드리움·동굴 입구처럼 벽에 붙는 그림. 칸이 옮겨지면 같이 옮긴다.
   */
  wallDecor?: ReliefWallTile[];
  /** 바이옴 절벽 모양(선택, relief/styles.ts RELIEF_STYLES 의 키). 없으면 기본 흙벽 그림. */
  style?: string;
}

export interface ReliefWallTile {
  x: number;
  y: number;
  row: number;
  tile: number;
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
