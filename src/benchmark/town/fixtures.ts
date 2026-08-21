// benchmark/town/fixtures.ts
// 벤치마크 입력 도형·프로브 후보의 단일 정본.
//
// groundTruth.ts(정답 산출)와 inputImages.ts(모델이 보는 그림)가 같은 이 파일을
// 읽는다. 두 곳이 각자 좌표를 들고 있으면 그림과 채점 기준이 조용히 어긋난다.

/** 오토타일 과제 도형 — 10x7 그리드. X = 길로 칠할 칸. */
export const AUTOTILE_SHAPE_ROWS: readonly string[] = Object.freeze([
  "..........",
  "..XXX.....",
  ".XXXXX....",
  ".XXX.X....",
  ".XXXXX..X.",
  "..XXX.....",
  "..........",
]);

export const AUTOTILE_SHAPE_WIDTH = 10;
export const AUTOTILE_SHAPE_HEIGHT = 7;

/**
 * 이 도형은 임의로 고른 것이 아니다. 실제 엔진(autotileVariantForMask)을 돌려
 * 11개 역할이 **전부** 나오는 도형을 찾아 고정한 것이다(2026-08-20 실측):
 *   body 1 · edgeN 2 · edgeS 2 · edgeW 2 · edgeE 1
 *   cornerNW 2 · cornerNE 2 · cornerSW 2 · cornerSE 2
 *   inner 4 · isolated 1   (총 21칸)
 * 특히 3x3 덩어리 안의 구멍(3,3)이 **오목 코너 4개**를 만들고, 오른쪽 외딴 점
 * (8,4)이 isolated 를 만든다. 둘 다 없으면 "변과 모서리만 아는" 모델과
 * "이웃을 실제로 읽는" 모델이 구분되지 않는다.
 */
export const AUTOTILE_EXPECTED_ROLE_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  body: 1,
  edgeN: 2,
  edgeS: 2,
  edgeW: 2,
  edgeE: 1,
  cornerNW: 2,
  cornerNE: 2,
  cornerSW: 2,
  cornerSE: 2,
  inner: 4,
  isolated: 1,
});

/** 도형의 마킹 칸(행 우선 인덱스). */
export function autotileShapeCells(): number[] {
  const cells: number[] = [];
  for (let y = 0; y < AUTOTILE_SHAPE_HEIGHT; y += 1) {
    const row = AUTOTILE_SHAPE_ROWS[y] ?? "";
    for (let x = 0; x < AUTOTILE_SHAPE_WIDTH; x += 1) {
      if (row[x] === "X") cells.push(y * AUTOTILE_SHAPE_WIDTH + x);
    }
  }
  return cells;
}

/**
 * A3 통행성 프로브 — 겉보기와 실제가 어긋나는 타일을 일부러 섞었다(2026-08-20 실측).
 * 342 "돌바닥"과 246/306 "석축 단"은 **평평한 바닥처럼 보이지만 전방향 통행 불가**다
 * (constants.ts 가 명시적으로 경고하는 함정). 이걸 안 섞으면 "잔디는 밟을 수 있다"
 * 수준의 상식만으로 만점이 나와 아무것도 측정하지 못한다.
 */
export const PASSABILITY_PROBE_TILES: readonly number[] = Object.freeze([
  240, // 잔디 — 통행 가능
  360, // 흙길 변형 — 통행 가능
  421, // 흙길 — 통행 가능
  423, // 모래 — 통행 가능
  303, // 키큰 풀 — 통행 가능
  190, // 포석 — 통행 가능
  131, // 포석 변형 — 통행 가능
  288, // 꽃 덤불 — 통행 가능(상위 레이어)
  342, // 돌바닥 — 함정: 통행 불가
  246, // 석축 단(석판) — 함정: 통행 불가
  306, // 석축 단(석판) — 함정: 통행 불가
  290, // 나무 — 통행 불가
  120, // 물 — 통행 불가
  404, // 지붕-벽 경계 — 통행 불가
]);

/**
 * A4 레이어 프로브 — 나무 캐노피(상위)와 줄기(하위)를 함께 넣었다.
 * 260~263 캐노피는 upper, 290~293 줄기는 lower 다. 같은 나무의 위아래가 서로 다른
 * 레이어라는 것이 이 타일 그림판 레이어 규칙의 핵심이고, 지붕(374/375/384/385 upper)과
 * 지붕-벽 경계(404/405 lower)도 같은 함정 구조다.
 */
export const LAYER_PROBE_TILES: readonly number[] = Object.freeze([
  260, // 나무 캐노피 — upper
  261, // 나무 캐노피 — upper
  262, // 나무 캐노피 — upper
  288, // 꽃 덤불 — upper
  374, // 사선 지붕 — upper
  375, // 사선 지붕 — upper
  384, // 지붕 — upper
  326, // 지붕 장식 — upper
  290, // 나무 줄기 — lower
  291, // 나무 줄기 — lower
  404, // 지붕-벽 경계 — lower
  405, // 지붕-벽 경계 — lower
  240, // 잔디 — lower
  306, // 석축 단 — lower
  342, // 돌바닥 — lower
]);
