// benchmarkScoringAutotile.test.ts
// 벤치마크 오토타일 스코어러(todo 8) 계약 테스트 — TDD: 구현 전에 먼저 작성.
// .omo/plans/tileset-vision-benchmark.md todo 8의 수용 기준을 그대로 옮긴다.
//
// 오라클 무결성(stale_state 방어): expectedAutotileGrid 는 살아 있는 엔진
// (src/project/defaults/autotileEngine.ts + DEFAULT_ROAD_AUTOTILE_GROUP) 임포트에서
// 파생해야 한다. 이 테스트는 두 독립 경로로 그 사실을 고정한다:
//   (1) 손으로 유도한 L자 역할 배치(아래 EXPECTED_L_GRID 주석의 마스크 산술)
//   (2) 엔진 고정점 성질 — 오라클 출력을 다시 엔진(autotileNeighborMask +
//       autotileVariantForMask)에 넣으면 같은 변형이 나온다.
// 붙여넣은 정적 그리드였다면 (2)를 우연히 통과할 수 없다.
//
// 픽스처 규칙: 그리드/그룹/타일 상수는 실제 소스에서 import한다(리터럴 복사 금지).
// 기대 수치는 주석에 산술을 인용해 손으로 고정한다.
import { describe, expect, it } from "vitest";

import { AUTOTILE_GROUP_ANSWER } from "@/benchmark/groundTruth";
import { normalizeName } from "@/benchmark/scoringUtils";
import {
  buildAutotileLMask,
  expectedAutotileGrid,
  scoreAutotileCount,
  scoreAutotileGrid,
} from "@/benchmark/scoringAutotile";
import {
  autotileNeighborMask,
  autotileVariantForMask,
  type AutotileMapView,
} from "@/project/defaults/autotileEngine";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";

const GROUP = DEFAULT_ROAD_AUTOTILE_GROUP;

// ── L자 마스크(계획 고정 형상: width 8, height 6) ──────────────────────────
// 경로 칸 = rows 0-4 col 0 (5칸) + row 4 cols 0-3 (4칸, (0,4) 공유) = 8칸.
const MASK = buildAutotileLMask();

// ── 손으로 유도한 엔진 기대 배치 ────────────────────────────────────────────
// 엔진 판정 순서(edgeCornerTile): NW→NE→SW→SE 코너 → N→S→W→E 변 → 몸통.
// 각 칸의 사방 결손(경계 밖/비경로 칸은 비연결)으로 역할을 유도한다:
//   (0,0): N✗ W✗           → cornerNW = 390
//   (0,1..3): W✗ (N·S 연결) → edgeW    = 420
//   (0,4): S✗ W✗           → cornerSW = 450
//   (1,4),(2,4): N✗ S✗ (E·W 연결) → edgeN = 391
//   (3,4): N✗ E✗           → cornerNE = 392
//   비경로 칸 = -1(빈 칸, contract.ts 규약)
const EXPECTED_L_GRID: readonly (readonly number[])[] = [
  [DIRT_ROAD_TILE.CORNER_NORTH_WEST, -1, -1, -1, -1, -1, -1, -1], // 390
  [DIRT_ROAD_TILE.EDGE_WEST, -1, -1, -1, -1, -1, -1, -1], // 420
  [DIRT_ROAD_TILE.EDGE_WEST, -1, -1, -1, -1, -1, -1, -1], // 420
  [DIRT_ROAD_TILE.EDGE_WEST, -1, -1, -1, -1, -1, -1, -1], // 420
  [
    DIRT_ROAD_TILE.CORNER_SOUTH_WEST, // 450
    DIRT_ROAD_TILE.EDGE_NORTH, // 391
    DIRT_ROAD_TILE.EDGE_NORTH, // 391
    DIRT_ROAD_TILE.CORNER_NORTH_EAST, // 392
    -1, -1, -1, -1,
  ],
  [-1, -1, -1, -1, -1, -1, -1, -1],
];

function cloneGrid(grid: readonly (readonly number[])[]): number[][] {
  return grid.map((row) => [...row]);
}

function mapViewOf(grid: readonly (readonly number[])[]): AutotileMapView {
  const height = grid.length;
  const width = grid[0].length;
  const lowerTiles: number[] = [];
  for (const row of grid) lowerTiles.push(...row);
  return { width, height, lowerTiles };
}

/** 마스크 경로 칸 좌표 목록. */
function maskPoints(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < MASK.length; y += 1) {
    for (let x = 0; x < MASK[y].length; x += 1) {
      if (MASK[y][x]) points.push({ x, y });
    }
  }
  return points;
}

// ── d6a: expectedAutotileGrid (엔진 오라클) ────────────────────────────────

describe("expectedAutotileGrid", () => {
  it("L자 마스크 형상: 8x6, 경로 칸 8개, 비경로 칸은 -1", () => {
    const grid = expectedAutotileGrid(MASK, GROUP);
    expect(grid).toHaveLength(6);
    for (const row of grid) expect(row).toHaveLength(8);
    const filled = grid.flat().filter((tile) => tile !== -1);
    expect(filled).toHaveLength(8);
    expect(maskPoints()).toHaveLength(8);
  });

  it("손으로 유도한 역할 배치와 정확히 일치(코너 3 + 변 5, 몸통 없음)", () => {
    // 1칸 폭 L자 런이므로 몸통/오목/외딴 역할은 등장하지 않는다.
    expect(expectedAutotileGrid(MASK, GROUP)).toEqual(EXPECTED_L_GRID);
  });

  it("엔진 고정점: 오라클 출력을 다시 엔진에 넣으면 같은 변형이 나온다 (살아 있는 엔진 증명)", () => {
    const expected = expectedAutotileGrid(MASK, GROUP);
    const view = mapViewOf(expected);
    // 엔진 connectSet 과 동일한 규칙: connectTileIds ?? memberTileIds
    const connect = new Set(GROUP.connectTileIds ?? GROUP.memberTileIds);
    for (const { x, y } of maskPoints()) {
      const mask = autotileNeighborMask(view, x, y, (tile) => connect.has(tile), 8);
      expect(autotileVariantForMask(GROUP, mask)).toBe(expected[y][x]);
    }
  });

  it("malformed mask: 삐뚤어진 마스크는 구조화 실패(throw)", () => {
    expect(() => expectedAutotileGrid([[true, false], [true]], GROUP)).toThrow(/assertRectangular/);
  });

  it("malformed mask: boolean이 아닌 셀은 구조화 실패(throw)", () => {
    expect(() => expectedAutotileGrid([[true, false], [true, "x"]], GROUP)).toThrow(/boolean/);
  });

  it("malformed mask: 경로 칸이 하나도 없으면 공허 참 대신 throw", () => {
    const empty = buildAutotileLMask().map((row) => row.map(() => false));
    expect(() => expectedAutotileGrid(empty, GROUP)).toThrow(/경로 칸/);
  });
});

// ── d6a: scoreAutotileGrid ─────────────────────────────────────────────────

describe("scoreAutotileGrid", () => {
  it("엔진-정답 그리드: exactMatch=1, pathAccuracy=1, roleChecks 전부 통과 → passed", () => {
    const expected = expectedAutotileGrid(MASK, GROUP);
    const score = scoreAutotileGrid(expected, MASK, GROUP);
    expect(score.maskCellCount).toBe(8);
    expect(score.matchedMaskCells).toBe(8);
    expect(score.pathAccuracy).toBe(1);
    expect(score.exactMatch).toBe(1);
    expect(score.mismatchedCells).toEqual([]);
    expect(score.roleChecks.map((check) => check.passed)).toEqual([true, true, true]);
    expect(score.allRoleChecksPassed).toBe(true);
    expect(score.passed).toBe(true);
  });

  it("잘못된 코너(NW 칸에 NE 코너 392): exactMatch 47/48≥0.85 임에도 cornerRolesCorrect 실패 → 실패", () => {
    const wrongCorner = cloneGrid(expectedAutotileGrid(MASK, GROUP));
    wrongCorner[0][0] = DIRT_ROAD_TILE.CORNER_NORTH_EAST; // 390 → 392 (방향이 다른 코너)
    const score = scoreAutotileGrid(wrongCorner, MASK, GROUP);
    // 48칸 중 1칸 불일치 → 47/48 = 0.979166… (정확도 게이트는 통과)
    expect(score.exactMatch).toBeCloseTo(47 / 48, 10);
    expect(score.pathAccuracy).toBeCloseTo(7 / 8, 10);
    const cornerCheck = score.roleChecks.find((check) => check.id === "cornerRolesCorrect");
    expect(cornerCheck?.passed).toBe(false);
    expect(cornerCheck?.violations).toHaveLength(1);
    expect(score.allRoleChecksPassed).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("변 칸에 몸통 타일(420 → 421): edgeRolesCorrect 실패 → 실패", () => {
    const bodyInEdge = cloneGrid(expectedAutotileGrid(MASK, GROUP));
    bodyInEdge[1][0] = DIRT_ROAD_TILE.BODY; // edgeW 칸에 몸통 421
    const score = scoreAutotileGrid(bodyInEdge, MASK, GROUP);
    expect(score.exactMatch).toBeCloseTo(47 / 48, 10);
    const edgeCheck = score.roleChecks.find((check) => check.id === "edgeRolesCorrect");
    expect(edgeCheck?.passed).toBe(false);
    expect(edgeCheck?.violations).toHaveLength(1);
    // 코너 칸은 그대로 → 코너 체크는 통과(어떤 체크가 실패했는지 구분된다)
    expect(score.roleChecks.find((check) => check.id === "cornerRolesCorrect")?.passed).toBe(true);
    expect(score.passed).toBe(false);
  });

  it("경로에만 잔디(240): exactMatch 40/48 = 0.833 < 0.85 → 정확도 게이트 자체가 실패", () => {
    // 오라클의 비경로 40칸은 -1 과 일치하지만, 경로 8칸은 전부 엉뚱한 타일
    // (잔디는 그룹 멤버가 아니다) → 40/48 = 0.8333… < 0.85.
    const grass = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => -1));
    for (const { x, y } of maskPoints()) grass[y][x] = 240;
    const score = scoreAutotileGrid(grass, MASK, GROUP);
    expect(score.exactMatch).toBeCloseTo(40 / 48, 10);
    expect(score.pathAccuracy).toBe(0);
    expect(score.allRoleChecksPassed).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("마스크 밖 1칸 오염: exactMatch 47/48, roleChecks 통과 → 게이트 설계대로 통과(오염은 비율에만 반영)", () => {
    const polluted = cloneGrid(expectedAutotileGrid(MASK, GROUP));
    polluted[0][5] = DIRT_ROAD_TILE.BODY; // 비경로 칸에 흙길
    const score = scoreAutotileGrid(polluted, MASK, GROUP);
    expect(score.exactMatch).toBeCloseTo(47 / 48, 10);
    expect(score.mismatchedCells).toEqual([`5,0 expected=-1 got=${DIRT_ROAD_TILE.BODY}`]);
    expect(score.pathAccuracy).toBe(1);
    expect(score.allRoleChecksPassed).toBe(true);
    expect(score.passed).toBe(true);
  });

  it("malformed modelGrid: 삐뚤어진 그리드는 구조화 실패(throw)", () => {
    const ragged = cloneGrid(expectedAutotileGrid(MASK, GROUP));
    ragged[1].pop(); // 8 → 7칸
    expect(() => scoreAutotileGrid(ragged, MASK, GROUP)).toThrow(/assertRectangular/);
  });

  it("malformed modelGrid: 형상 불일치(7x6)는 구조화 실패(throw)", () => {
    const wrongShape = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => -1));
    expect(() => scoreAutotileGrid(wrongShape, MASK, GROUP)).toThrow(/scoreAutotileGrid/);
  });
});

// ── d6b: scoreAutotileCount ────────────────────────────────────────────────
// 진짜 이름 11개는 normalizeName(괄호 제거) 후 9개로 축소된다:
//   석축 단(석판) / 석축 단(자갈) → "석축 단"
//   어둠(석축 테) / 어둠(짙은 테) → "어둠"
// 자카드는 양쪽 모두 정규화+중복제거한 집합에서 계산한다(아래 주석의 손계산 참조).
const TRUTH_NAMES = AUTOTILE_GROUP_ANSWER.map((entry) => entry.name);
const TRUTH_NAMES_NORMALIZED = [...new Set(TRUTH_NAMES.map(normalizeName))]; // 9개

// 계획 금지 목록: 물/폭포/석축 수로(스트립)/잔디 는 오토타일 종류가 아니다.
const NON_AUTOTILE_NAMES = ["물", "폭포", "석축 수로", "잔디"] as const;

describe("scoreAutotileCount", () => {
  it("count 11 + 진짜 이름 전부: countScore=1, nameScore=1(9/9), score=1, passed", () => {
    const score = scoreAutotileCount({ count: 11, types: [...TRUTH_NAMES] });
    // 정규화 후 pred 9개 == truth 9개 → ∩=9, ∪=9 → 9/9 = 1.0
    expect(score.countScore).toBe(1);
    expect(score.nameScore).toBe(1);
    expect(score.nameGatePassed).toBe(true);
    expect(score.score).toBe(1);
    expect(score.passed).toBe(true);
    expect(score.missingNames).toEqual([]);
    expect(score.extraNames).toEqual([]);
  });

  it("count 11 + 이름 8/11 겹침(초과 항목 없음): 자카드 8/9 ≥ 0.7 → 만점 유지", () => {
    // slice(0,8) = 흙길·모래·포석·경작지·눈·짙은 수풀·키큰 풀·석축 단(석판)
    // 정규화 후 pred 8개(충돌 쌍의 한쪽만 포함) → ∩=8, ∪=9 → 8/9 = 0.888… ≥ 0.7
    const score = scoreAutotileCount({ count: 11, types: TRUTH_NAMES.slice(0, 8) });
    expect(score.nameScore).toBeCloseTo(8 / 9, 10);
    expect(score.nameGatePassed).toBe(true);
    expect(score.countScore).toBe(1);
    expect(score.score).toBe(1);
    expect(score.passed).toBe(true);
  });

  it("count 11 + 8개 진짜 이름 + 물/폭포/잔디 3개: 자카드 8/12 < 0.7 → 만점 깎임(0.5), passed 는 유지", () => {
    // pred 정규화 후 8 + 3 = 11개, truth 9개 → ∩=8, ∪=12 → 8/12 = 0.666… < 0.7
    const score = scoreAutotileCount({
      count: 11,
      types: [...TRUTH_NAMES.slice(0, 8), "물", "폭포", "잔디"],
    });
    expect(score.nameScore).toBeCloseTo(8 / 12, 10);
    expect(score.nameGatePassed).toBe(false);
    expect(score.countScore).toBe(1);
    // 계획: passed = count === 11 (자카드는 만점만 게이트) → 점수만 1.0 미만.
    expect(score.score).toBe(0.5);
    expect(score.passed).toBe(true);
    expect(score.extraNames).toEqual(["물", "폭포", "잔디"]);
  });

  it("count 11 + 전부 가비지 이름: nameScore=0 → 점수 0.5 로 강등, 문서화된 반환이 그 차이를 보여준다", () => {
    const score = scoreAutotileCount({
      count: 11,
      types: ["물", "폭포", "잔디", "잔디밭", "바위", "눈사람", "계곡", "다리", "벽돌", "판자", "타일"],
    });
    // ∩=0, ∪=9+11=20 → 0
    expect(score.nameScore).toBe(0);
    expect(score.nameGatePassed).toBe(false);
    expect(score.countScore).toBe(1);
    expect(score.score).toBe(0.5);
    expect(score.passed).toBe(true); // 계획: passed = count === 11
  });

  it("count 10: countScore=0.5, score=0.5, passed=false (자카드는 만점 게이트일 뿐 감점 없음)", () => {
    // slice(0,10) 정규화 후 9개(석축 단 쌍 합쳐짐) == truth 9개 → nameScore 1.0
    const score = scoreAutotileCount({ count: 10, types: TRUTH_NAMES.slice(0, 10) });
    expect(score.nameScore).toBeCloseTo(9 / 9, 10);
    expect(score.countScore).toBe(0.5);
    expect(score.score).toBe(0.5);
    expect(score.passed).toBe(false);
  });

  it("count 12: countScore=0.5, passed=false", () => {
    const score = scoreAutotileCount({ count: 12, types: [...TRUTH_NAMES, "잔디"] });
    expect(score.countScore).toBe(0.5);
    expect(score.score).toBe(0.5);
    expect(score.passed).toBe(false);
  });

  it("count 13: countScore=0 → score=0, passed=false (이름이 거의 맞아도)", () => {
    // pred 정규화 후 9 + 2 = 11개, truth 9개 → ∩=9, ∪=11 → 9/11 = 0.818…
    const score = scoreAutotileCount({ count: 13, types: [...TRUTH_NAMES, "물", "석축 수로"] });
    expect(score.nameScore).toBeCloseTo(9 / 11, 10);
    expect(score.countScore).toBe(0);
    expect(score.score).toBe(0);
    expect(score.passed).toBe(false);
  });

  it("금지 목록(물/폭포/석축 수로/잔디)은 어떤 오토타일 종류도 아니다: 자카드 0, 진실에 등장하지 않음", () => {
    for (const name of NON_AUTOTILE_NAMES) {
      expect(TRUTH_NAMES_NORMALIZED).not.toContain(name);
    }
    const score = scoreAutotileCount({ count: NON_AUTOTILE_NAMES.length, types: [...NON_AUTOTILE_NAMES] });
    // ∩=0, ∪=9+4=13 → 0
    expect(score.nameScore).toBe(0);
    expect(score.countScore).toBe(0);
    expect(score.score).toBe(0);
    expect(score.passed).toBe(false);
  });

  it("이름 정규화: 괄호 없는 형태(석축 단)도 진짜 이름과 동일 취급 → nameScore=1", () => {
    const types = TRUTH_NAMES.map((name) => name.replace(/[（(][^（）()]*[）)]/g, ""));
    const score = scoreAutotileCount({ count: 11, types });
    // 정규화 후 pred 9개 == truth 9개 → 1.0 (중복은 Set 으로 접힌다)
    expect(score.nameScore).toBe(1);
    expect(score.score).toBe(1);
    expect(score.passed).toBe(true);
  });
});
