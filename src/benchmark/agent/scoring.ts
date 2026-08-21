// benchmark/agent/scoring.ts
// 코딩 에이전트가 만든 마을 맵을 채점한다 — 품질과 규모를 따로 낸다.
//
// 왜 종합 점수 하나로 합치지 않는가: "작지만 완벽한 마을"과 "크지만 엉망인 마을"은
// 서로 다른 실패이고, 한 숫자로 합치면 그 둘이 같은 칸에 들어간다. 감독이 보고
// 판단할 것은 두 숫자다 — quality(감사 통과율)와 scale(얼마나 만들었나).
//
// 이 트랙에서는 **하네스를 쓰는 것이 정답이다.** town/ 트랙은 하네스를 뗀 모델을
// 재지만, 여기서는 에이전트가 저장소를 뒤져 build_village·stampRectHouseKit·
// 오토타일 엔진을 찾아 쓰는 것 자체가 실력이다. 타일을 손으로 하드코딩한 답은
// 오토타일 합법성과 문법 항목에서 갈린다.

import { autotileNeighborMask, autotileVariantForMask } from "@/project/defaults/autotileEngine";
import {
  DEFAULT_COBBLE_AUTOTILE_GROUP,
  DEFAULT_ROAD_AUTOTILE_GROUP,
} from "@/project/defaults/autotileGroups";
import {
  FENCE_BOTTOM_LEFT,
  FENCE_BOTTOM_RIGHT,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  FENCE_SIDE_RAIL,
  FENCE_TOP_LEFT,
  FENCE_TOP_RIGHT,
} from "@/editor/tools/village/constants";
import { clamp01, floodFill, inBounds, isWalkable, mean, ratio } from "@/benchmark/town/gridWalk";
import { EMPTY_CELL, type TownGroundTruth } from "@/benchmark/town/types";
import { detectVillage, FENCE_FAMILY, ROAD_FAMILY, type Detection, type MapSubmission } from "./detect";

/**
 * 규모 1.0 = 하네스가 만든 정본 마을. 손으로 적지 않고 **정본을 실제로 탐지해서**
 * 뽑는다 — 그래야 "하네스 수준 = 1.0"이라는 기준점이 거짓이 되지 않는다.
 * 정본이 바뀌면 기준선도 같이 바뀐다.
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
  /** 감사 통과율 0..1 — 일한 항목 평균 × 감점 배수. */
  readonly quality: number;
  /** 규모 — 정본 마을 대비. 1.0 을 넘을 수 있다(더 크게 만들었으면 그대로 보여준다). */
  readonly scale: number;
  readonly detail: Readonly<Record<string, number>>;
}

const FENCE_CORNERS_UP: ReadonlySet<number> = new Set([FENCE_BOTTOM_LEFT, FENCE_BOTTOM_RIGHT]);
const FENCE_CORNERS_DOWN: ReadonlySet<number> = new Set([FENCE_TOP_LEFT, FENCE_TOP_RIGHT]);

/**
 * 울타리 문법 — 픽스처(게이트 위치·바탕 집)에 의존하는 두 항목을 뺀 자유 맵 버전.
 * 런의 양끝이 마감됐는가 · 모서리가 세로 변으로 이어지는가 · 고아 조각이 없는가.
 */
function fenceGrammar(map: MapSubmission, detection: Detection): { score: number; runs: number } {
  const isFence = (x: number, y: number): boolean =>
    inBounds(map, x, y) && detection.fenceCells.has(y * map.width + x);
  const tileAt = (x: number, y: number): number => map.upper[y * map.width + x] ?? EMPTY_CELL;
  if (detection.fenceCells.size === 0) return { score: 0, runs: 0 };

  let ends = 0;
  let finished = 0;
  let oriented = 0;
  let runs = 0;
  for (let y = 0; y < map.height; y += 1) {
    let x = 0;
    while (x < map.width) {
      if (!isFence(x, y)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < map.width && isFence(x, y)) x += 1;
      const stop = x - 1;
      if (stop === start) continue; // 1칸은 세로 런의 일부일 수 있다 — 고아 검사가 다룬다
      runs += 1;
      for (const [edge, expected] of [
        [start, FENCE_END_LEFT],
        [stop, FENCE_END_RIGHT],
      ] as const) {
        const tile = tileAt(edge, y);
        ends += 1;
        const isEndPiece = tile === FENCE_END_LEFT || tile === FENCE_END_RIGHT;
        const isCorner = FENCE_CORNERS_UP.has(tile) || FENCE_CORNERS_DOWN.has(tile);
        const continues = FENCE_CORNERS_UP.has(tile) ? isFence(edge, y - 1) : isFence(edge, y + 1);
        if (isEndPiece || (isCorner && continues)) finished += 1;
        if (!isEndPiece || tile === expected) oriented += 1;
      }
    }
  }

  let corners = 0;
  let cornersLinked = 0;
  let orphans = 0;
  let sideRails = 0;
  let sideRailsLinked = 0;
  for (const index of detection.fenceCells) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const tile = tileAt(x, y);
    if (FENCE_CORNERS_UP.has(tile)) {
      corners += 1;
      if (isFence(x, y - 1)) cornersLinked += 1;
    } else if (FENCE_CORNERS_DOWN.has(tile)) {
      corners += 1;
      if (isFence(x, y + 1)) cornersLinked += 1;
    }
    if (tile === FENCE_SIDE_RAIL) {
      sideRails += 1;
      if (isFence(x, y - 1) || isFence(x, y + 1)) sideRailsLinked += 1;
    }
    if (!isFence(x - 1, y) && !isFence(x + 1, y) && !isFence(x, y - 1) && !isFence(x, y + 1)) orphans += 1;
  }

  return {
    score: mean([
      ratio(finished, ends),
      ratio(oriented, ends),
      ratio(cornersLinked, corners),
      ratio(sideRails - (sideRails - sideRailsLinked), sideRails),
      ratio(detection.fenceCells.size - orphans, detection.fenceCells.size),
    ]),
    runs,
  };
}

/**
 * 길 오토타일 합법성 — 칸마다 제 이웃 관계가 요구하는 변형 타일인가.
 *
 * 흙길과 포석 **두 그룹 다** 채점한다. 한쪽만 보면 "포석 몸통 타일로만 도배"가
 * 검사를 통째로 빠져나간다(2026-08-21 실측). 모래는 물과 연결 규칙이 엮여 있어
 * 자유 맵에서 단독 판정이 불안정하므로 제외하고, 대신 채점 대상 칸 수를 함께 보고한다.
 */
function roadAutotileLegality(map: MapSubmission, detection: Detection): { score: number; graded: number } {
  if (detection.roadCells.size === 0) return { score: 0, graded: 0 };
  const canvas = { width: map.width, height: map.height, lowerTiles: [...map.lower] };
  let graded = 0;
  let legal = 0;
  for (const group of [DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_COBBLE_AUTOTILE_GROUP]) {
    const members = new Set<number>(group.memberTileIds);
    const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
    for (const index of detection.roadCells) {
      const tile = map.lower[index] ?? EMPTY_CELL;
      if (!members.has(tile)) continue;
      graded += 1;
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      const mask = autotileNeighborMask(canvas, x, y, (candidate) => connect.has(candidate), group.neighborhood ?? 4);
      if (autotileVariantForMask(group, mask) === tile) legal += 1;
    }
  }
  // 모래만으로 깐 길은 이 항목의 대상이 아니다 — 벌하지 않고 graded 로 드러낸다.
  return { score: graded === 0 ? 1 : ratio(legal, graded), graded };
}

export function scoreAgentMap(input: {
  readonly map: MapSubmission;
  readonly groundTruth: TownGroundTruth;
}): AgentScore {
  const { map, groundTruth } = input;
  const detection = detectVillage(map);

  const placed = map.lower.filter((tile) => tile !== EMPTY_CELL).length
    + map.upper.filter((tile) => tile !== EMPTY_CELL).length;
  if (placed === 0) {
    return Object.freeze({ quality: 0, scale: 0, detail: Object.freeze({ placedCells: 0 }) });
  }

  // ── 일한 항목 ──
  // 1) 집에 문이 났는가.
  const housesWithDoor = ratio(detection.houses.length, Math.max(1, detection.buildings.length));
  // 2) 문 앞에 길이 있는가(village/audit.ts doorHasRoad 와 같은 규칙: 남쪽 3칸 · 좌우 1칸).
  let doorsWithRoad = 0;
  for (const door of detection.doors) {
    let connected = false;
    for (let y = door.y + 1; y <= door.y + 3 && !connected; y += 1) {
      for (let x = door.x - 1; x <= door.x + 1 && !connected; x += 1) {
        if (!inBounds(map, x, y)) continue;
        if (detection.roadCells.has(y * map.width + x)) connected = true;
      }
    }
    if (connected) doorsWithRoad += 1;
  }
  // 3) 길이 하나의 망인가.
  const roadOneNetwork = detection.roadCells.size === 0
    ? 0
    : ratio(detection.largestRoadComponent, detection.roadCells.size);
  // 4) 맵 밖에서 걸어 들어가 모든 문 앞에 닿는가.
  const composite = map.lower.map((tile, index) => {
    const above = map.upper[index] ?? EMPTY_CELL;
    return above === EMPTY_CELL ? tile : above;
  });
  const edges: { x: number; y: number }[] = [];
  for (let x = 0; x < map.width; x += 1) {
    edges.push({ x, y: 0 }, { x, y: map.height - 1 });
  }
  for (let y = 0; y < map.height; y += 1) {
    edges.push({ x: 0, y }, { x: map.width - 1, y });
  }
  const reachable = floodFill(map, edges, (x, y) =>
    isWalkable(groundTruth.passFlags, composite[y * map.width + x] ?? EMPTY_CELL),
  );
  const doorsReached = detection.doors.filter((door) => {
    const front = (door.y + 1) * map.width + door.x;
    return door.y + 1 < map.height && reachable.has(front);
  }).length;
  // 5) 울타리 문법. 울타리가 없으면 마을 요소가 빠진 것이므로 0 이다.
  const fence = fenceGrammar(map, detection);
  // 6) 길 오토타일 합법성(흙길 + 포석 두 그룹).
  const legality = roadAutotileLegality(map, detection);
  // 7) 문 짝이 섞이지 않았는가.
  const doorFamilies = ratio(detection.doors.filter((door) => door.sameFamily).length, detection.doors.length);

  // 문이 하나도 없으면 문 관련 항목은 "해당 없음"이 아니라 **0** 이다. 분모 0 을
  // 만점으로 두면 "문 없는 집 3채"가 0.857 을 받는다(2026-08-21 실측 허점).
  // 들어갈 수 없는 건물만 세워 놓은 것은 마을이 아니다.
  const hasDoors = detection.doors.length > 0;
  const work = {
    housesWithDoor,
    doorsWithRoad: hasDoors ? ratio(doorsWithRoad, detection.doors.length) : 0,
    roadOneNetwork,
    doorsReachable: hasDoors ? ratio(doorsReached, detection.doors.length) : 0,
    fenceGrammar: fence.score,
    roadAutotileLegality: legality.score,
    doorFamilies: hasDoors ? doorFamilies : 0,
  };

  // ── 감점 배수(아무것도 안 해도 만점인 항목은 평균에 넣지 않는다) ──
  let upperCells = 0;
  let upperCorrect = 0;
  let banned = 0;
  for (let index = 0; index < map.upper.length; index += 1) {
    const upper = map.upper[index] ?? EMPTY_CELL;
    if (upper !== EMPTY_CELL) {
      upperCells += 1;
      if (groundTruth.priority[upper] === "upper") upperCorrect += 1;
    }
    if (groundTruth.banned.has(upper)) banned += 1;
    if (groundTruth.banned.has(map.lower[index] ?? EMPTY_CELL)) banned += 1;
  }
  const penalties = {
    layerDiscipline: upperCells === 0 ? 1 : upperCorrect / upperCells,
    noBanned: banned === 0 ? 1 : 0,
    treesIntact: ratio(detection.trees - detection.brokenTrees, detection.trees),
  };

  const quality = Object.values(penalties).reduce((acc, penalty) => acc * penalty, mean(Object.values(work)));

  // ── 규모 — 정본 마을 대비. clamp 하지 않는다(더 크게 만들었으면 그대로 보고한다). ──
  const area = map.width * map.height;
  const baseline = scaleBaseline(groundTruth);
  const scale = mean([
    detection.houses.length / baseline.houses,
    area / baseline.area,
    detection.roadCells.size / baseline.roadCells,
  ]);

  return Object.freeze({
    quality: clamp01(quality),
    scale,
    detail: Object.freeze({
      ...work,
      ...penalties,
      buildings: detection.buildings.length,
      houses: detection.houses.length,
      doors: detection.doors.length,
      roadCells: detection.roadCells.size,
      roadComponents: detection.roadComponents,
      fenceCells: detection.fenceCells.size,
      fenceRuns: fence.runs,
      autotileGradedCells: legality.graded,
      trees: detection.trees,
      brokenTrees: detection.brokenTrees,
      width: map.width,
      height: map.height,
      area,
      placedCells: placed,
      distinctTiles: new Set([...map.lower, ...map.upper].filter((tile) => tile !== EMPTY_CELL)).size,
    }),
  });
}

/** 제출물이 길·집·울타리 중 무엇도 없으면 "마을"이 아니다 — 리포트에서 따로 표시한다. */
export function looksLikeVillage(detection: Detection): boolean {
  return detection.houses.length > 0 && detection.roadCells.size > 0;
}

export { detectVillage, ROAD_FAMILY, FENCE_FAMILY };
