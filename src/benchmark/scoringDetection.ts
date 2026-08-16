// benchmark/scoringDetection.ts
// 벤치마크 감지(detection) 차원 스코어러(todo 6): d1 벽/바닥, d2 지붕, d4 창문.
//
// 설계:
//  - scoreDetection은 순수 함수로 예측/진실/함정 id 컬렉션만 받는다 (LLM 판정 없음).
//  - 점수는 scoringUtils의 precision/recall/f1 계약을 재사용한다
//    (빈/빈=1.0, 빈 pred vs 비어있지 않은 truth=0, NaN 금지).
//  - trapHits = predicted ∩ traps 는 "정보용"으로만 기록한다. trap id는 truth에
//    없으므로 일반 FP로만 점수에 영향을 주고, trapHits 자체의 추가 페널티는 없다.
//  - passed = f1 >= 0.8.
//  - d1은 wall/floor 두 서브런을 scoreDetection으로 채점한 뒤 평균 F1으로 집계한다
//    (scoreD1 — 서브런 결과(DetectionScore)를 받아 합산).
import { f1, precision, recall } from "./scoringUtils";

export interface DetectionInput {
  readonly predicted: readonly number[];
  readonly truth: readonly number[];
  readonly traps: readonly number[];
}

export interface DetectionScore {
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly trapHits: number;
  readonly passed: boolean;
}

export function scoreDetection({ predicted, truth, traps }: DetectionInput): DetectionScore {
  const pred = new Set(predicted);
  const truthSet = new Set(truth);
  const trapSet = new Set(traps);

  let truePositives = 0;
  for (const id of pred) {
    if (truthSet.has(id)) truePositives += 1;
  }

  // 정보용 카운터 — 점수 계산에 사용하지 않는다.
  let trapHits = 0;
  for (const id of pred) {
    if (trapSet.has(id)) trapHits += 1;
  }

  const precisionScore = precision(pred, truthSet);
  const recallScore = recall(pred, truthSet);
  const f1Score = f1(pred, truthSet);

  return {
    precision: precisionScore,
    recall: recallScore,
    f1: f1Score,
    falsePositives: pred.size - truePositives,
    falseNegatives: truthSet.size - truePositives,
    trapHits,
    passed: f1Score >= 0.8,
  };
}

export interface D1Input {
  readonly walls: DetectionScore;
  readonly floors: DetectionScore;
}

/**
 * d1(벽/바닥) 집계: 두 서브런 스코어를 평균 F1으로 합친다.
 * 비율 필드(precision/recall/f1)는 평균, 카운트 필드(FP/FN/trapHits)는 합산.
 * passed = 평균 F1 >= 0.8.
 */
export function scoreD1({ walls, floors }: D1Input): DetectionScore {
  const meanF1 = (walls.f1 + floors.f1) / 2;
  return {
    precision: (walls.precision + floors.precision) / 2,
    recall: (walls.recall + floors.recall) / 2,
    f1: meanF1,
    falsePositives: walls.falsePositives + floors.falsePositives,
    falseNegatives: walls.falseNegatives + floors.falseNegatives,
    trapHits: walls.trapHits + floors.trapHits,
    passed: meanF1 >= 0.8,
  };
}
