// benchmark/agent/scoring.ts
// 코딩 에이전트가 만든 마을 맵을 채점한다 — 결함 밀도 · 통과율 · 규모.
//
// 이 트랙에서는 **하네스를 쓰는 것이 정답이다.** town/ 트랙은 하네스를 뗀 모델을
// 재지만, 여기서는 에이전트가 저장소를 뒤져 build_village·stampRectHouseKit·
// 오토타일 엔진을 찾아 쓰는 것 자체가 실력이다.
//
// 채점의 헤드라인은 **결함 밀도(1000 결정당 결함 수)** 이고 통과율이 아니다.
// 2026-08-21 실측: opus 통과율 0.997 vs sonnet 0.991 은 무승부처럼 보이지만 실제로는
// 결함 5개 대 22개(3.6배)다. 통과율은 1.0 근처에서 압축돼 상위를 못 가른다 —
// 고품질 공정을 합격률 대신 결함 밀도로 관리하는 것과 같은 이유다.
//
// 결함 집계 규칙과 그것이 고친 이전 채점의 결함 3개는 defects.ts 주석에 적어 뒀다.
// 규모(scale)는 여전히 따로 낸다: "작지만 완벽한 마을"과 "크지만 엉망인 마을"은
// 서로 다른 실패이고, 한 숫자로 합치면 그 둘이 같은 칸에 들어간다.

import { clamp01, mean } from "@/benchmark/town/gridWalk";
import { EMPTY_CELL, type TownGroundTruth } from "@/benchmark/town/types";
import { collectDefects, type DefectReport } from "./defects";
import { detectVillage, type MapSubmission } from "./detect";

/**
 * 규모 1.0 = 하네스가 만든 정본 마을. 손으로 적지 않고 **정본을 실제로 탐지해서**
 * 뽑는다 — 그래야 "하네스 수준 = 1.0"이라는 기준점이 거짓이 되지 않는다.
 */
let cachedBaseline: { houses: number; area: number; roadCells: number } | null = null;

export function scaleBaseline(groundTruth: TownGroundTruth): { houses: number; area: number; roadCells: number } {
  if (cachedBaseline) return cachedBaseline;
  const reference = groundTruth.placements.villageGrid;
  const detection = detectVillage({
    width: reference.width,
    height: reference.height,
    lower: reference.lower,
    upper: reference.upper,
  });
  cachedBaseline = {
    houses: Math.max(1, detection.houses.length),
    area: reference.width * reference.height,
    roadCells: Math.max(1, detection.roadCells.size),
  };
  return cachedBaseline;
}

export interface AgentScore {
  /** 1000 결정당 결함 수. **낮을수록 좋다.** 상위 비교의 헤드라인. */
  readonly defectsPerThousand: number;
  /** 통과율 = 1 - 결함/결정. 정렬에는 편하지만 상위에서 압축된다. */
  readonly quality: number;
  readonly decisions: number;
  readonly defects: number;
  /** 규모 — 정본 마을 대비. 1.0 을 넘을 수 있다(더 크게 만들었으면 그대로 보여준다). */
  readonly scale: number;
  /** 검사별 (결함/결정). 어디서 틀렸는지가 점수보다 중요하다. */
  readonly report: DefectReport;
  readonly detail: Readonly<Record<string, number>>;
}

export function scoreAgentMap(input: {
  readonly map: MapSubmission;
  readonly groundTruth: TownGroundTruth;
}): AgentScore {
  const { map, groundTruth } = input;
  const detection = detectVillage(map);
  const placed =
    map.lower.filter((tile) => tile !== EMPTY_CELL).length + map.upper.filter((tile) => tile !== EMPTY_CELL).length;

  if (placed === 0) {
    return Object.freeze({
      defectsPerThousand: 0,
      quality: 0,
      decisions: 0,
      defects: 0,
      scale: 0,
      report: Object.freeze({
        items: Object.freeze([]),
        decisions: 0,
        defects: 0,
        failedChecks: 0,
        checks: 0,
        defectsPerThousand: 0,
        passRate: 0,
      }) as DefectReport,
      detail: Object.freeze({ placedCells: 0 }),
    });
  }

  const report = collectDefects({ map, groundTruth });
  const baseline = scaleBaseline(groundTruth);
  const area = map.width * map.height;
  const scale = mean([
    detection.houses.length / baseline.houses,
    area / baseline.area,
    detection.roadCells.size / baseline.roadCells,
  ]);

  const detail: Record<string, number> = {
    failedChecks: report.failedChecks,
    checks: report.checks,
    buildings: detection.buildings.length,
    houses: detection.houses.length,
    doors: detection.doors.length,
    roadCells: detection.roadCells.size,
    roadComponents: detection.roadComponents,
    fenceCells: detection.fenceCells.size,
    trees: detection.trees,
    brokenTrees: detection.brokenTrees,
    width: map.width,
    height: map.height,
    area,
    placedCells: placed,
    distinctTiles: new Set([...map.lower, ...map.upper].filter((tile) => tile !== EMPTY_CELL)).size,
  };
  // 검사별 결함·결정 수를 detail 에 펼친다 — 보관본만 보고도 어디서 틀렸는지 안다.
  for (const item of report.items) {
    detail[`${item.id}Defects`] = item.defects;
    detail[`${item.id}Decisions`] = item.decisions;
  }

  return Object.freeze({
    defectsPerThousand: report.defectsPerThousand,
    quality: clamp01(report.passRate),
    decisions: report.decisions,
    defects: report.defects,
    scale,
    report,
    detail: Object.freeze(detail),
  });
}

export { detectVillage };
