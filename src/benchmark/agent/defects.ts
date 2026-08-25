// benchmark/agent/defects.ts
// 결함 집계 — 모든 검사를 "결정 수 대비 결함 수"로 통일한다.
//
// 왜 다시 짜는가(2026-08-21 실측이 드러낸 채점 방식 결함 3개):
//
//  ① 분모를 모델이 스스로 골랐다. `집에 문` = 문 있는 건물/건물 수 였으므로 건물을
//     3개만 하찮게 만들면 만점이었다. haiku 가 정확히 그렇게 네 항목을 만점 받았다.
//     → 항목마다 자기 분모(건물 열·문 개수·길 칸·울타리 칸)를 살려 **전체 결정 수**로
//       합친다. 적게 만들면 그만큼 적게 기여하고, 틀린 것이 그대로 드러난다.
//
//  ② 어려운 항목과 쉬운 항목이 같은 가중치로 평균됐다. 오토타일 합법성(길 칸 수백 개)과
//     문 짝(3개)이 각각 1/8 이었다. → 결정 수 가중이 이것도 함께 고친다.
//
//  ③ 감점 배수가 0/1 절벽이었다. 금지 타일 한 칸이 전체를 0.000 으로 만들어, 일한 항목
//     0.987 인 답과 아무것도 못 한 답이 같은 칸에 들어갔다. → 금지 타일·조각난 나무·
//     레이어 위반도 **칸마다 결함 하나**로 센다.
//
// 그리고 보고는 통과율이 아니라 **결함 밀도(1000 결정당)** 를 헤드라인으로 쓴다.
// 통과율은 1.0 근처에서 압축돼 상위를 못 가른다: opus 0.996 vs sonnet 0.992 는
// 실제로는 결함 5개 대 14개(2.8배)다.

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
import { connectedComponents, floodFill, inBounds, isWalkable } from "@/benchmark/town/gridWalk";
import { EMPTY_CELL, type TownGroundTruth } from "@/benchmark/town/types";
import {
  detectVillage,
  ROOF_FAMILY,
  WALL_FAMILY,
  type Detection,
  type MapSubmission,
} from "./detect";

/** 한 검사의 결과 — 몇 번 판정했고 몇 번 틀렸나. */
export interface DefectItem {
  readonly id: string;
  readonly label: string;
  /** 판정 단위 수(건물 열·문·길 칸·울타리 칸 …). 0 이면 이 검사는 해당 없음이다. */
  readonly decisions: number;
  readonly defects: number;
}

export interface DefectReport {
  readonly items: readonly DefectItem[];
  readonly decisions: number;
  readonly defects: number;
  /**
   * 결함이 난 **검사 종류** 수. 결함 수와 다른 사실을 말한다: 체계적 실수 하나가
   * 칸 수만큼 계상되기 때문이다(haiku 는 "지붕을 벽 위가 아니라 벽에 겹쳐 칠했다"는
   * 실수 하나로 18개 열 전부가 결함이 됐다). "몇 칸이 틀렸나"와 "몇 가지를 틀렸나"는
   * 함께 봐야 한다.
   */
  readonly failedChecks: number;
  readonly checks: number;
  /** 1000 결정당 결함 수. 상위 비교의 헤드라인 — 통과율은 1.0 근처에서 압축된다. */
  readonly defectsPerThousand: number;
  /** 통과율 = 1 - 결함/결정. 연속성을 위해 함께 낸다. */
  readonly passRate: number;
}

const CORNERS_UP: ReadonlySet<number> = new Set([FENCE_BOTTOM_LEFT, FENCE_BOTTOM_RIGHT]);
const CORNERS_DOWN: ReadonlySet<number> = new Set([FENCE_TOP_LEFT, FENCE_TOP_RIGHT]);

/**
 * 벽 계열에서 지붕 계열을 뺀다. 404/405 는 라벨이 "지붕-벽 경계"라 벽 파생에도 들어가지만
 * 집 키트에서는 지붕 몸통·처마다. 겹친 채로 "지붕이 벽 위"를 물으면 정본조차 실패한다.
 */
const WALL_ONLY: ReadonlySet<number> = new Set([...WALL_FAMILY].filter((tile) => !ROOF_FAMILY.has(tile)));

export function collectDefects(input: {
  readonly map: MapSubmission;
  readonly groundTruth: TownGroundTruth;
}): DefectReport {
  const { map, groundTruth } = input;
  const detection = detectVillage(map);
  const items: DefectItem[] = [];
  const add = (id: string, label: string, decisions: number, defects: number): void => {
    items.push({ id, label, decisions, defects });
  };

  // ── 건물 단면: 열마다 "지붕이 벽 위" 인가 ──
  {
    let columns = 0;
    let bad = 0;
    for (const building of detection.buildings) {
      const wallRows = new Map<number, number[]>();
      const roofRows = new Map<number, number[]>();
      for (const index of building.cells) {
        const x = index % map.width;
        const y = Math.floor(index / map.width);
        const lower = map.lower[index] ?? EMPTY_CELL;
        const upper = map.upper[index] ?? EMPTY_CELL;
        const push = (into: Map<number, number[]>): void => {
          const rows = into.get(x);
          if (rows) rows.push(y);
          else into.set(x, [y]);
        };
        if (WALL_ONLY.has(lower)) push(wallRows);
        if (ROOF_FAMILY.has(lower) || ROOF_FAMILY.has(upper)) push(roofRows);
      }
      const allColumns = new Set([...wallRows.keys(), ...roofRows.keys()]);
      columns += allColumns.size;
      // 벽만 있는 상자도, 지붕만 있는 덩어리도 집이 아니다 — 모든 열이 결함이다.
      if (wallRows.size === 0 || roofRows.size === 0) {
        bad += allColumns.size;
        continue;
      }
      for (const x of allColumns) {
        const walls = wallRows.get(x);
        const roofs = roofRows.get(x);
        if (!walls || !roofs) {
          bad += 1; // 벽만 있거나 지붕만 있는 열 — 단면이 성립하지 않는다
          continue;
        }
        if (Math.max(...roofs) >= Math.min(...walls)) bad += 1;
      }
    }
    add("buildingSection", "건물 단면(지붕이 벽 위)", columns, bad);
  }

  // ── 건물마다 문이 났는가 ──
  add("houseDoor", "건물에 문", detection.buildings.length, detection.buildings.length - detection.houses.length);

  // ── 문마다: 앞에 길 · 같은 벌 · 걸어서 도달 ──
  {
    let noRoad = 0;
    for (const door of detection.doors) {
      let connected = false;
      for (let y = door.y + 1; y <= door.y + 3 && !connected; y += 1) {
        for (let x = door.x - 1; x <= door.x + 1 && !connected; x += 1) {
          if (!inBounds(map, x, y)) continue;
          if (detection.roadCells.has(y * map.width + x)) connected = true;
        }
      }
      if (!connected) noRoad += 1;
    }
    add("doorRoad", "문 앞에 길", detection.doors.length, noRoad);
    add("doorFamily", "문 상·하단 같은 벌", detection.doors.length, detection.doors.filter((door) => !door.sameFamily).length);

    const composite = map.lower.map((tile, index) => {
      const above = map.upper[index] ?? EMPTY_CELL;
      return above === EMPTY_CELL ? tile : above;
    });
    const edges: { x: number; y: number }[] = [];
    for (let x = 0; x < map.width; x += 1) edges.push({ x, y: 0 }, { x, y: map.height - 1 });
    for (let y = 0; y < map.height; y += 1) edges.push({ x: 0, y }, { x: map.width - 1, y });
    const reachable = floodFill(map, edges, (x, y) =>
      isWalkable(groundTruth.passFlags, composite[y * map.width + x] ?? EMPTY_CELL),
    );
    const unreachable = detection.doors.filter((door) => {
      const front = (door.y + 1) * map.width + door.x;
      return door.y + 1 >= map.height || !reachable.has(front);
    }).length;
    add("doorReachable", "문까지 걸어감", detection.doors.length, unreachable);
  }

  // ── 길 칸마다: 단일망 소속 · 오토타일 합법 ──
  {
    const components = connectedComponents(map, detection.roadCells);
    const largest = components[0]?.length ?? 0;
    add("roadNetwork", "길 단일망", detection.roadCells.size, detection.roadCells.size - largest);

    const canvas = { width: map.width, height: map.height, lowerTiles: [...map.lower] };
    let graded = 0;
    let illegal = 0;
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
        if (autotileVariantForMask(group, mask) !== tile) illegal += 1;
      }
    }
    add("roadAutotile", "길 오토타일 성형", graded, illegal);
  }

  // ── 울타리 칸마다: 이웃과 이어짐 · 런의 끝 마감 · 모서리 연결 ──
  {
    const isFence = (x: number, y: number): boolean =>
      inBounds(map, x, y) && detection.fenceCells.has(y * map.width + x);
    const tileAt = (x: number, y: number): number => map.upper[y * map.width + x] ?? EMPTY_CELL;

    let orphans = 0;
    let corners = 0;
    let cornersLoose = 0;
    let rails = 0;
    let railsLoose = 0;
    for (const index of detection.fenceCells) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      if (!isFence(x - 1, y) && !isFence(x + 1, y) && !isFence(x, y - 1) && !isFence(x, y + 1)) orphans += 1;
      const tile = tileAt(x, y);
      if (CORNERS_UP.has(tile)) {
        corners += 1;
        if (!isFence(x, y - 1)) cornersLoose += 1;
      } else if (CORNERS_DOWN.has(tile)) {
        corners += 1;
        if (!isFence(x, y + 1)) cornersLoose += 1;
      }
      if (tile === FENCE_SIDE_RAIL) {
        rails += 1;
        if (!isFence(x, y - 1) && !isFence(x, y + 1)) railsLoose += 1;
      }
    }
    add("fenceConnected", "울타리 고아 조각", detection.fenceCells.size, orphans);
    add("fenceCorner", "모서리에 세로 변", corners, cornersLoose);
    add("fenceRail", "세로 변 이어짐", rails, railsLoose);

    let ends = 0;
    let unfinished = 0;
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
        for (const edge of [start, stop]) {
          ends += 1;
          const tile = tileAt(edge, y);
          const isEndPiece = tile === FENCE_END_LEFT || tile === FENCE_END_RIGHT;
          const isCorner = CORNERS_UP.has(tile) || CORNERS_DOWN.has(tile);
          const continues = CORNERS_UP.has(tile) ? isFence(edge, y - 1) : isFence(edge, y + 1);
          if (!isEndPiece && !(isCorner && continues)) unfinished += 1;
        }
      }
    }
    add("fenceEnd", "런의 끝 마감", ends, unfinished);
  }

  // ── 칸마다: 상위 레이어 규율 · 금지 타일 · 나무 온전 ──
  {
    let upperCells = 0;
    let upperWrong = 0;
    let banned = 0;
    for (let index = 0; index < map.upper.length; index += 1) {
      const upper = map.upper[index] ?? EMPTY_CELL;
      if (upper !== EMPTY_CELL) {
        upperCells += 1;
        if (groundTruth.priority[upper] !== "upper") upperWrong += 1;
      }
      if (groundTruth.banned.has(upper)) banned += 1;
      if (groundTruth.banned.has(map.lower[index] ?? EMPTY_CELL)) banned += 1;
    }
    add("layerDiscipline", "상위 레이어 규율", upperCells, upperWrong);
    // 금지 타일은 "쓴 칸 수"가 곧 결정 수다 — 안 썼으면 해당 없음(0/0).
    add("bannedTiles", "금지 타일", banned, banned);
    add("treesIntact", "나무 온전", detection.trees, detection.brokenTrees);
  }

  const decisions = items.reduce((sum, item) => sum + item.decisions, 0);
  const defects = items.reduce((sum, item) => sum + item.defects, 0);
  const graded = items.filter((item) => item.decisions > 0);
  return {
    items: Object.freeze(items),
    decisions,
    defects,
    failedChecks: graded.filter((item) => item.defects > 0).length,
    checks: graded.length,
    defectsPerThousand: decisions === 0 ? 0 : (defects / decisions) * 1000,
    passRate: decisions === 0 ? 0 : 1 - defects / decisions,
  };
}

/** 탐지 결과를 함께 쓰고 싶은 호출자를 위해 노출. */
export { detectVillage, type Detection };
