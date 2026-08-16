// benchmark/scoringAutotile.ts
// 벤치마크 오토타일 차원 스코어러(todo 8): d6a 엔진 오라클 + d6b 종류 세기 루브릭.
//
// d6a — ORACLE 무결성(stale_state 방어):
//   expectedAutotileGrid 는 정적 그리드가 아니라 살아 있는 엔진 임포트에서
//   파생한다. 경로 셀을 그룹 멤버로 시드한 뒤 엔진의 shapeAutotileGroupAround
//   (재검사 오프셋·variantMap 조회 포함)를 돌려 엔진이 실제로 배치할 타일을
//   얻는다. 엔진의 변형 로직을 재구현하지 않는다 — 아래에서 재사용하는 엔진
//   export: AUTOTILE_DIR, shapeAutotileGroupAround, autotileNeighborMask,
//   autotileVariantForMask.
//   결정성: 시드는 멤버십 판정에만 쓰이고(연결 여부는 connect 집합 소속으로
//   판정) 성형 중 멤버십은 변하지 않으므로, 각 셀의 최종 변형은 방문 순서와
//   무관하게 이웃 마스크의 함수다.
//
// d6b — 루브릭(계획 고정):
//   countScore: 11 → 1.0, {10,12} → 0.5, 그 외 → 0.
//   nameScore:  jaccard(normalizeName(types), 진짜 이름 11종) — 단 진실 이름은
//               괄호 제거 후 중복 접힘(석축 단(석판)/(자갈) → "석축 단", 어둠 두 종
//               → "어둠")으로 9개 집합이 된다. pred 도 같은 정규화+중복 제거.
//   score:      countScore === 1 일 때 nameScore >= 0.7 이어야 만점(아니면 0.5
//               로 강등). count 가 틀리면 countScore 그대로.
//   passed:     count === 11 (계획: "passed = count === 11"; 자카드는 만점만 게이트).
//   반환 객체가 countScore/nameScore/score/passed 를 분리 노출하므로 "count 11 +
//   가비지 이름" 케이스가 정확히 어떻게 감점되는지 읽을 수 있다.
//
// 금지(계획): 물/폭포/석축 수로(스트립)/잔디 는 오토타일 종류가 아니다 — 진실은
// AUTOTILE_GROUP_ANSWER 의 11그룹 이름뿐이다. editor DOM 은 import 하지 않는다.
import { AUTOTILE_GROUP_ANSWER } from "./groundTruth";
import { assertRectangular, cellAccuracy, normalizeName } from "./scoringUtils";
import {
  AUTOTILE_DIR,
  autotileNeighborMask,
  autotileVariantForMask,
  shapeAutotileGroupAround,
  type AutotileMapView,
} from "@/project/defaults/autotileEngine";
import type { AutotileGroup } from "@/project/types";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";

/** 마스크: true = 경로(오토타일로 채울) 칸, false = 빈 칸(-1). */
export type AutotileMask = readonly (readonly boolean[])[];

/** d6a 계획 고정 형상: width 8 × height 6, L = rows 0-4 col 0 + row 4 cols 0-3. */
export function buildAutotileLMask(): boolean[][] {
  const width = 8;
  const height = 6;
  const mask = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  for (let y = 0; y <= 4; y += 1) mask[y][0] = true; // 세로 팔 (0,0)..(0,4)
  for (let x = 0; x <= 3; x += 1) mask[4][x] = true; // 가로 팔 (0,4)..(3,4)
  return mask;
}

function validateMask(mask: AutotileMask): { width: number; height: number } {
  assertRectangular(mask);
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  if (height === 0 || width === 0) {
    throw new Error(`expectedAutotileGrid: empty mask (${width}x${height})`);
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (typeof mask[y][x] !== "boolean") {
        throw new Error(
          `expectedAutotileGrid: mask[${y}][${x}] is not a boolean (got ${JSON.stringify(mask[y][x])})`,
        );
      }
    }
  }
  if (!mask.some((row) => row.some((cell) => cell))) {
    throw new Error("expectedAutotileGrid: 경로 칸이 하나도 없는 마스크 (공허 참 방어)");
  }
  return { width, height };
}

function maskPoints(mask: AutotileMask, width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y][x]) points.push({ x, y });
    }
  }
  return points;
}

/** mask 를 엔진 맵 뷰(lowerTiles 1차원)로 만든다. 비경로 칸은 -1(비연결). */
function toMapView(grid: readonly (readonly number[])[], width: number, height: number): AutotileMapView {
  const lowerTiles: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) lowerTiles.push(grid[y][x]);
  }
  return { width, height, lowerTiles };
}

/**
 * 엔진 오라클: 마스크 경로에 엔진이 배치할 타일 그리드를 계산한다.
 *
 * 경로 칸을 그룹 멤버 타일로 시드한 뒤 엔진의 shapeAutotileGroupAround 를
 * 모든 경로 점에 대해 실행한다(편집기 붓/fill_region 과 같은 성형 경로).
 * 비경로 칸은 -1(비연결)로 남는다. 결과는 결정적이며 그룹이 dirt-road 계열이
 * 아니어도 동일하게 동작한다(connect 집합이 멤버를 포함하는 한).
 */
export function expectedAutotileGrid(
  mask: AutotileMask,
  group: AutotileGroup = DEFAULT_ROAD_AUTOTILE_GROUP,
): number[][] {
  const { width, height } = validateMask(mask);
  const points = maskPoints(mask, width, height);
  const pathKeys = new Set(points.map((point) => `${point.x},${point.y}`));
  const seed = group.memberTileIds[0];
  if (seed === undefined) {
    throw new Error(`expectedAutotileGrid: group ${group.id} has no memberTileIds`);
  }
  const lowerTiles: number[] = new Array<number>(width * height).fill(-1);
  for (const { x, y } of points) lowerTiles[y * width + x] = seed;
  const view: AutotileMapView = { width, height, lowerTiles };
  shapeAutotileGroupAround(view, group, points);

  // 시드 타일이 그룹의 variantMap 출력에 없는 멤버(예: 흙길 BODY_ALT)면
  // 성형이 그 셀을 그대로 남길 수 있다. 그때만(경로 칸에 한해서) 엔진의
  // 마스크→변형 조회로 확정한다 — 연결성은 멤버십 기반이라 순서 무관 결정적.
  // 비경로 칸은 절대 채우지 않는다(-1 = 비연결, 그대로 둔다).
  const seedIsVariantOutput = Object.values(group.variantMap).includes(seed);
  const grid: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      if (!pathKeys.has(`${x},${y}`)) {
        row.push(-1);
        continue;
      }
      const shaped = lowerTiles[y * width + x];
      if (!seedIsVariantOutput && shaped === seed) {
        const neighborMask = autotileNeighborMask(
          view,
          x,
          y,
          (tile) => connectHas(group, tile),
          group.neighborhood ?? 4,
        );
        const resolved = autotileVariantForMask(group, neighborMask);
        if (resolved === undefined) {
          throw new Error(
            `expectedAutotileGrid: group ${group.id} variantMap has no entry for mask ${neighborMask} at (${x},${y})`,
          );
        }
        row.push(resolved);
        continue;
      }
      row.push(shaped);
    }
    grid.push(row);
  }
  return grid;
}

function connectHas(group: AutotileGroup, tile: number): boolean {
  return (group.connectTileIds ?? group.memberTileIds).includes(tile);
}

/** 마스크 셀의 엔진 역할 분류(9분류를 3버킷으로 접는다). */
export type AutotileCellRole = "body" | "edge" | "corner";

/**
 * 이웃 직교(N/E/S/W) 결손 패턴으로 역할을 정한다 — 엔진 edgeCornerTile 의
 * 분기 순서(인접 두 결손 → 코너, 단일 결손 → 변, 무결손 → 몸통/오목)와 동일
 * 기하. 분류는 진단/롤 체크용이며 배치 타일 자체는 엔진 variantMap 이 정한다.
 */
function cellRoleFromMaskBits(neighborMask: number): AutotileCellRole {
  const missingNorth = (neighborMask & AUTOTILE_DIR.N) === 0;
  const missingEast = (neighborMask & AUTOTILE_DIR.E) === 0;
  const missingSouth = (neighborMask & AUTOTILE_DIR.S) === 0;
  const missingWest = (neighborMask & AUTOTILE_DIR.W) === 0;
  if ((missingNorth && missingWest) || (missingNorth && missingEast) ||
      (missingSouth && missingWest) || (missingSouth && missingEast)) {
    return "corner";
  }
  if (missingNorth || missingEast || missingSouth || missingWest) return "edge";
  return "body";
}

export interface AutotileRoleCheck {
  readonly id: "edgeRolesCorrect" | "cornerRolesCorrect" | "bodyRolesCorrect";
  readonly label: string;
  readonly passed: boolean;
  /** 역할 위반 칸("x,y expected=<엔진 변형> got=<모델 타일>"). */
  readonly violations: readonly string[];
}

export interface AutotileGridScore {
  readonly kind: "autotileGrid";
  /** 전체 그리드(비경로 -1 포함) 칸 단위 정확도. 통과 게이트: >= 0.85. */
  readonly exactMatch: number;
  /** 마스크 경로 칸만 본 정확도(정보용). */
  readonly pathAccuracy: number;
  readonly maskCellCount: number;
  readonly matchedMaskCells: number;
  readonly mismatchedCells: readonly string[];
  readonly roleChecks: readonly AutotileRoleCheck[];
  readonly allRoleChecksPassed: boolean;
  readonly passed: boolean;
}

const EXACT_MATCH_THRESHOLD = 0.85;

/**
 * d6a 채점: 모델 그리드를 엔진 오라클과 비교한다.
 *
 * - exactMatch: 전체 칸(경로+비경로) 정확도.
 * - roleChecks: 경로 칸을 엔진 역할(코너/변/몸통)별로 묶어, 각 칸의 모델
 *   타일이 엔진 변형과 정확히 일치하는지 검사한다. 방향까지 물어본다 —
 *   NW 자리에 NE 코너를 놓으면 cornerRolesCorrect 가 실패한다(계획 픽스처).
 * - passed = exactMatch >= 0.85 && 모든 roleChecks.
 *
 * malformed_input: 삐뚤어진 그리드(assertRectangular throw)와 형상 불일치는
 * 구조화된 Error 로 실패한다 — 조용한 부분 점수를 내지 않는다.
 */
export function scoreAutotileGrid(
  modelGrid: readonly (readonly number[])[],
  mask: AutotileMask,
  group: AutotileGroup = DEFAULT_ROAD_AUTOTILE_GROUP,
): AutotileGridScore {
  const { width, height } = validateMask(mask);
  assertRectangular(modelGrid);
  const modelHeight = modelGrid.length;
  const modelWidth = modelGrid[0]?.length ?? 0;
  if (modelHeight !== height || modelWidth !== width) {
    throw new Error(
      `scoreAutotileGrid: model grid is ${modelWidth}x${modelHeight} but the mask is ${width}x${height}`,
    );
  }

  const expected = expectedAutotileGrid(mask, group);

  const mismatchedCells: string[] = [];
  const violations: Record<AutotileCellRole, string[]> = { body: [], edge: [], corner: [] };
  const roleByCell = new Map<string, AutotileCellRole>();

  // 오라클 그리드 자체에서(엔진 고정점) 역할을 재유도한다.
  const oracleView = toMapView(expected, width, height);
  const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
  const neighborhood = group.neighborhood ?? 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y][x]) continue;
      const neighborMask = autotileNeighborMask(oracleView, x, y, (tile) => connect.has(tile), neighborhood);
      roleByCell.set(`${x},${y}`, cellRoleFromMaskBits(neighborMask));
    }
  }

  let maskCellCount = 0;
  let matchedMaskCells = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const want = expected[y][x];
      const got = modelGrid[y][x];
      if (!mask[y][x]) {
        if (want !== got) mismatchedCells.push(`${x},${y} expected=${want} got=${got}`);
        continue;
      }
      maskCellCount += 1;
      if (want === got) {
        matchedMaskCells += 1;
        continue;
      }
      mismatchedCells.push(`${x},${y} expected=${want} got=${got}`);
      const role = roleByCell.get(`${x},${y}`);
      if (role) violations[role].push(`${x},${y} expected=${want} got=${got}`);
    }
  }

  const roleChecks: AutotileRoleCheck[] = [
    {
      id: "edgeRolesCorrect",
      label: "변(edge) 칸은 엔진 변형 타일(방향 포함)",
      passed: violations.edge.length === 0,
      violations: [...violations.edge],
    },
    {
      id: "cornerRolesCorrect",
      label: "코너 칸은 마스크 기하가 정하는 코너 변형(방향 포함)",
      passed: violations.corner.length === 0,
      violations: [...violations.corner],
    },
    {
      id: "bodyRolesCorrect",
      label: "몸통 칸은 엔진 몸통 계열 변형",
      passed: violations.body.length === 0,
      violations: [...violations.body],
    },
  ];

  const exactMatch = cellAccuracy(modelGrid, expected);
  return {
    kind: "autotileGrid",
    exactMatch,
    pathAccuracy: maskCellCount === 0 ? 0 : matchedMaskCells / maskCellCount,
    maskCellCount,
    matchedMaskCells,
    mismatchedCells,
    roleChecks,
    allRoleChecksPassed: roleChecks.every((check) => check.passed),
    passed: exactMatch >= EXACT_MATCH_THRESHOLD && roleChecks.every((check) => check.passed),
  };
}

// ── d6b: 종류 세기 루브릭 ──────────────────────────────────────────────────

export interface AutotileCountAnswer {
  readonly count: number;
  readonly types: readonly string[];
}

export interface AutotileCountScore {
  readonly kind: "autotileCount";
  readonly count: number;
  readonly expectedCount: number;
  /** 11 → 1, {10,12} → 0.5, 그 외 → 0. */
  readonly countScore: number;
  /** jaccard(normalizeName(types), 진짜 이름) — 진실은 괄호 제거 후 9개로 접힌다. */
  readonly nameScore: number;
  readonly nameGateThreshold: 0.7;
  readonly nameGatePassed: boolean;
  /** 루브릭 점수: count 11 이어도 이름 게이트(< 0.7)를 놓치면 0.5 로 강등. */
  readonly score: number;
  /** 계획 고정: passed = count === 11 (자카드는 만점만 게이트). */
  readonly passed: boolean;
  readonly missingNames: readonly string[];
  readonly extraNames: readonly string[];
}

const AUTOTILE_COUNT_TRUTH = 11;
const NAME_GATE_THRESHOLD = 0.7;
const OFF_BY_ONE_SCORE = 0.5;
const NAME_GATE_MISS_SCORE = 0.5;

/**
 * 문자열 집합 자카드 — scoringUtils.jaccard 와 동일한 빈 집합 계약
 * (∅/∅ = 1.0, 한쪽만 빈 = 0)을 문자열에 적용한 것(scoringUtils 버전은
 * 타일 id(number) 전용 타입이다).
 */
function nameJaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const name of a) {
    if (b.has(name)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * d6b 채점. 진실 이름은 AUTOTILE_GROUP_ANSWER(11그룹)이며 물/폭포/석축 수로/
 * 잔디 는 결코 포함되지 않는다. normalizeName 이 괄호를 지우므로 진실 집합은
 * 9개("석축 단", "어둠" 각각 두 그룹이 접힘)가 되고, pred 도 같은 규칙으로
 * 정규화+중복 제거해 비교한다.
 */
export function scoreAutotileCount(
  answer: AutotileCountAnswer,
  truthNames: readonly string[] = AUTOTILE_GROUP_ANSWER.map((entry) => entry.name),
): AutotileCountScore {
  const count = answer.count;
  const countScore =
    count === AUTOTILE_COUNT_TRUTH ? 1 : count === 10 || count === 12 ? OFF_BY_ONE_SCORE : 0;

  const truth = new Set(truthNames.map(normalizeName));
  const predicted: string[] = [];
  for (const type of answer.types) {
    const normalized = normalizeName(type);
    if (!predicted.includes(normalized)) predicted.push(normalized);
  }
  const predSet = new Set(predicted);

  const nameScore = nameJaccard(predSet, truth);
  const nameGatePassed = nameScore >= NAME_GATE_THRESHOLD;
  const score = countScore === 1 ? (nameGatePassed ? 1 : NAME_GATE_MISS_SCORE) : countScore;

  const missingNames = [...truth].filter((name) => !predSet.has(name));
  const extraNames = predicted.filter((name) => !truth.has(name));

  return {
    kind: "autotileCount",
    count,
    expectedCount: AUTOTILE_COUNT_TRUTH,
    countScore,
    nameScore,
    nameGateThreshold: NAME_GATE_THRESHOLD,
    nameGatePassed,
    score,
    passed: count === AUTOTILE_COUNT_TRUTH,
    missingNames,
    extraNames,
  };
}
