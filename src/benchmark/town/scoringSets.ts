// benchmark/town/scoringSets.ts
// 프로브(tileSet) 채점 — 균형 정확도.
//
// 프로브는 "보여 준 이 타일들 중 어느 것이 X 인가"라는 유계 이지선다다. 그래서
// 재현율이 무한한 F1 대신 균형 정확도((민감도+특이도)/2)를 쓴다 — 정답이 적은
// 쪽으로 쏠린 프로브에서 "전부 예" 또는 "전부 아니오"가 만점을 받지 않는다.
//
// 프로브 목록에 없는 id 를 답하면 음성 풀에 넣어 특이도를 깎는다. 보여 주지도
// 않은 타일을 지목하는 것은 추측이고, 추측에 비용이 없으면 측정이 안 된다.

import { mean, ratio } from "./gridWalk";
import type { AxisScore, TownAxisId, TownProbeSet, TownTileSetAnswer } from "./types";

export function scoreTownProbe(input: {
  readonly answer: TownTileSetAnswer;
  readonly probe: TownProbeSet;
  readonly axis: TownAxisId;
}): AxisScore {
  const { answer, probe, axis } = input;
  const answered = new Set<number>(answer.tileIds);
  const probes = new Set<number>(probe.probes);

  let truePositive = 0;
  let falseNegative = 0;
  for (const tile of probe.positives) {
    if (answered.has(tile)) truePositive += 1;
    else falseNegative += 1;
  }

  let trueNegative = 0;
  let falsePositive = 0;
  for (const tile of probes) {
    if (probe.positives.has(tile)) continue;
    if (answered.has(tile)) falsePositive += 1;
    else trueNegative += 1;
  }
  // 프로브에 없는 id — 보여 주지 않은 타일을 지목한 것이므로 오탐으로 센다.
  let offProbe = 0;
  for (const tile of answered) {
    if (!probes.has(tile)) {
      offProbe += 1;
      falsePositive += 1;
    }
  }

  const sensitivity = ratio(truePositive, truePositive + falseNegative);
  const specificity = ratio(trueNegative, trueNegative + falsePositive);
  const trapsAvoided = countTrapsAvoided(probe, answered);

  return Object.freeze({
    axis,
    score: mean([sensitivity, specificity]),
    method: "balancedAccuracy" as const,
    detail: Object.freeze({
      sensitivity,
      specificity,
      truePositive,
      falseNegative,
      trueNegative,
      falsePositive,
      offProbe,
      trapsAvoided,
      answered: answered.size,
    }),
  });
}

/**
 * 함정 회피율 — 점수에는 들어가지 않고 진단용으로만 낸다. 균형 정확도가 이미
 * 함정 오탐을 특이도로 벌하고 있으므로 두 번 세면 같은 실수를 이중으로 깎는다.
 */
function countTrapsAvoided(probe: TownProbeSet, answered: ReadonlySet<number>): number {
  if (probe.traps.size === 0) return 1;
  let avoided = 0;
  for (const trap of probe.traps) {
    const shouldPick = probe.positives.has(trap);
    if (answered.has(trap) === shouldPick) avoided += 1;
  }
  return avoided / probe.traps.size;
}
