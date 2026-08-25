// benchmark/agent/composition.ts
// 구성 지표 — 감사로는 안 갈리는 것을 잰다.
//
// 왜 quality 와 분리하는가: quality 항목은 전부 "감사 통과 여부"라서 하네스를 제대로
// 쓴 순간 전부 1.0 이 된다. 2026-08-21 실측에서 opus 1.000 / sonnet 0.992 로 사실상
// 비겼다 — 천장에 닿은 것이다. 상위를 가르는 것은 정답이 하나가 아닌 것들, 즉
// **구성 판단**이다(같은 집을 복붙했나, 막다른 길을 남겼나, 마을이 비어 보이나).
//
// 그리고 이것들은 **점수 하나로 합치지 않는다.** 좋다/나쁘다의 기준이 감독의 취향인
// 항목을 평균 내면, 벤치마크가 미학을 판정하는 척하게 된다. 더 결정적인 이유는
// 정본조차 자기 기준을 통과하지 못한다는 것이다 — 정본 도로는 맵 폭을 가로지르는
// 직선 한 줄이라 "긴 직선 런" 지표에서 최하점을 받는다. quality 처럼 정본 = 1.000
// 으로 앵커할 수 없는 지표를 quality 에 섞으면 앵커 자체가 거짓이 된다.

import { HOUSE_KITS } from "@/editor/houseKit";
import { EMPTY_CELL } from "@/benchmark/town/types";
import {
  detectVillage,
  FENCE_FAMILY,
  ROAD_FAMILY,
  ROOF_FAMILY,
  WALL_FAMILY,
  type MapSubmission,
} from "./detect";

export interface Composition {
  /** 집 키트 분포의 균등도(0..1). 한 키트만 복붙하면 0 에 가깝다. */
  readonly kitVariety: number;
  /** 건물 크기의 변동계수. 0 이면 전부 같은 크기다. */
  readonly sizeVariety: number;
  /** 길 칸 중 막다른 길(이웃 1개 이하) 비율. 제품의 pruneDeadEndStubs 가 지우는 결함. */
  readonly deadEndRate: number;
  /** 최장 직선 도로 런 / 맵 한 변. 제품의 breakLongStraightRuns 가 끊는 결함. */
  readonly straightRunRatio: number;
  /** 소품(울타리·지붕이 아닌 상위 타일) 밀도 — 1000칸당. */
  readonly propDensity: number;
  /** 아무 구조물도 없는 칸 비율. 높으면 "빈 들판에 집 몇 채". */
  readonly emptyRatio: number;
  /** 서로 다른 타일 종류 수 — 어휘를 얼마나 넓게 썼나. */
  readonly distinctTiles: number;
}

/** 정규화 섀넌 균등도. 항목이 하나뿐이면 0(다양성 없음). */
function evenness(counts: readonly number[]): number {
  const used = counts.filter((count) => count > 0);
  const total = used.reduce((sum, count) => sum + count, 0);
  if (total === 0 || used.length <= 1) return 0;
  const entropy = -used.reduce((sum, count) => sum + (count / total) * Math.log(count / total), 0);
  return entropy / Math.log(used.length);
}

/** 지붕 타일 → 어느 집 키트인가. 건물의 대표 키트를 세는 데 쓴다. */
const KIT_BY_ROOF_TILE: ReadonlyMap<number, string> = (() => {
  const map = new Map<number, string>();
  for (const [id, kit] of Object.entries(HOUSE_KITS)) {
    for (const value of Object.values(kit.roof)) if (typeof value === "number") map.set(value, id);
    for (const value of Object.values(kit.roof.upper)) if (typeof value === "number") map.set(value, id);
  }
  return map;
})();

export function measureComposition(map: MapSubmission): Composition {
  const detection = detectVillage(map);
  const area = map.width * map.height;

  const kitCounts = new Map<string, number>();
  for (const building of detection.buildings) {
    const perKit = new Map<string, number>();
    for (const index of building.cells) {
      for (const tile of [map.lower[index], map.upper[index]]) {
        const kit = tile === undefined ? undefined : KIT_BY_ROOF_TILE.get(tile);
        if (kit) perKit.set(kit, (perKit.get(kit) ?? 0) + 1);
      }
    }
    const dominant = [...perKit.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (dominant) kitCounts.set(dominant, (kitCounts.get(dominant) ?? 0) + 1);
  }

  const sizes = detection.buildings.map((building) => building.bbox.w * building.bbox.h);
  const meanSize = sizes.length === 0 ? 0 : sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  const sizeVariety =
    meanSize === 0
      ? 0
      : Math.sqrt(sizes.reduce((sum, size) => sum + (size - meanSize) ** 2, 0) / sizes.length) / meanSize;

  let deadEnds = 0;
  for (const index of detection.roadCells) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    let neighbours = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (detection.roadCells.has((y + dy) * map.width + (x + dx))) neighbours += 1;
    }
    if (neighbours <= 1) deadEnds += 1;
  }

  let longestRun = 0;
  for (let y = 0; y < map.height; y += 1) {
    let run = 0;
    for (let x = 0; x < map.width; x += 1) {
      run = detection.roadCells.has(y * map.width + x) ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
    }
  }
  for (let x = 0; x < map.width; x += 1) {
    let run = 0;
    for (let y = 0; y < map.height; y += 1) {
      run = detection.roadCells.has(y * map.width + x) ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
    }
  }

  let props = 0;
  let empty = 0;
  const distinct = new Set<number>();
  for (let index = 0; index < area; index += 1) {
    const lower = map.lower[index] ?? EMPTY_CELL;
    const upper = map.upper[index] ?? EMPTY_CELL;
    if (lower !== EMPTY_CELL) distinct.add(lower);
    if (upper !== EMPTY_CELL) distinct.add(upper);
    if (upper !== EMPTY_CELL && !FENCE_FAMILY.has(upper) && !ROOF_FAMILY.has(upper)) props += 1;
    const structural =
      WALL_FAMILY.has(lower) ||
      ROOF_FAMILY.has(lower) ||
      ROOF_FAMILY.has(upper) ||
      ROAD_FAMILY.has(lower) ||
      FENCE_FAMILY.has(upper);
    if (!structural && upper === EMPTY_CELL) empty += 1;
  }

  return {
    kitVariety: evenness([...kitCounts.values()]),
    sizeVariety,
    deadEndRate: detection.roadCells.size === 0 ? 0 : deadEnds / detection.roadCells.size,
    straightRunRatio: longestRun / Math.max(map.width, map.height),
    propDensity: (props / Math.max(1, area)) * 1000,
    emptyRatio: empty / Math.max(1, area),
    distinctTiles: distinct.size,
  };
}
