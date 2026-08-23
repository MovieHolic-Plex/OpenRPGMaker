// benchmark/town/scoringGrid.ts
// 1번 오토타일 채점 — 칸 단위 정확도 + 오목 코너 하위 점수.
//
// 오토타일은 정답이 하나뿐인 드문 문항이다(엔진의 variantMap 이 마스크마다 타일
// 하나를 돌려준다). 그래서 여기서만 "정본과 같은가"를 그대로 점수로 쓴다.
//
// 오목 코너(inner)를 detail 로 따로 내는 이유: 변 4개와 모서리 4개는 상하좌우만
// 보면 맞출 수 있지만, 오목 코너는 **대각 이웃**을 읽어야만 나온다. 이 4칸을
// 전체 평균에 섞으면 "이웃을 실제로 읽는 모델"과 "패턴만 외운 모델"의 차이가
// 21칸 평균 안에서 지워진다.

import { flatten, ratio } from "./gridWalk";
import { ROAD_PALETTE } from "./palettes";
import {
  EMPTY_CELL,
  type AutotileReference,
  type AxisScore,
  type TownGridAnswer,
} from "./types";

export function scoreTownAutotile(input: {
  readonly answer: TownGridAnswer;
  readonly reference: AutotileReference;
}): AxisScore {
  const { answer, reference } = input;
  const view = flatten(answer.grid);
  if (view.width !== reference.width || view.height !== reference.height) {
    return Object.freeze({
      axis: "autotile" as const,
      score: 0,
      method: "cellAccuracy" as const,
      detail: Object.freeze({
        shapeMismatch: 1,
        width: view.width,
        height: view.height,
        expectedWidth: reference.width,
        expectedHeight: reference.height,
      }),
    });
  }

  const palette = new Set<number>(ROAD_PALETTE);
  const marked = new Set<number>(reference.shape);

  let correct = 0;
  let innerCorrect = 0;
  let innerTotal = 0;
  let offPalette = 0;
  for (const cell of reference.cells) {
    const index = cell.y * reference.width + cell.x;
    const answered = view.cells[index] ?? EMPTY_CELL;
    const hit = answered === cell.tile;
    if (hit) correct += 1;
    if (answered !== EMPTY_CELL && !palette.has(answered)) offPalette += 1;
    if (cell.role === "inner") {
      innerTotal += 1;
      if (hit) innerCorrect += 1;
    }
  }

  // 마킹되지 않은 칸에 칠한 타일 — 도형을 넘겨 칠한 답은 분모를 키워 깎는다.
  let outside = 0;
  for (let index = 0; index < view.cells.length; index += 1) {
    if (marked.has(index)) continue;
    const tile = view.cells[index] ?? EMPTY_CELL;
    if (tile !== EMPTY_CELL) outside += 1;
  }

  const graded = reference.cells.length;
  const score = ratio(correct, graded + outside);
  return Object.freeze({
    axis: "autotile" as const,
    score,
    method: "cellAccuracy" as const,
    detail: Object.freeze({
      correct,
      graded,
      cellAccuracy: ratio(correct, graded),
      innerCorner: ratio(innerCorrect, innerTotal),
      innerCorrect,
      innerTotal,
      paintedOutsideShape: outside,
      offPalette,
    }),
  });
}
