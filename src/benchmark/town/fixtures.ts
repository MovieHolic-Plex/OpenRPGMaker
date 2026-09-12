// benchmark/town/fixtures.ts
// 벤치마크 입력 도형·프로브 후보의 단일 정본.
//
// groundTruth.ts(정답 산출)와 inputImages.ts(모델이 보는 그림)가 같은 이 파일을
// 읽는다. 두 곳이 각자 좌표를 들고 있으면 그림과 채점 기준이 조용히 어긋난다.
//
// 이 파일은 순수 데이터다 — 엔진(스탬퍼/오토타일)을 호출하지 않는다. 기하가
// 엔진 제약을 만족하는지는 groundTruth.ts 가 실제로 스탬프를 돌려 fail-fast 로
// 확인한다(예: 지붕 몸통 행 수·층수 조합이 시공 가능해야 한다).

import type { HouseKitId } from "@/editor/houseKit";
import type { TownPlacementKey } from "./types";

// ── 오토타일 도형(1번) ────────────────────────────────────────────────────

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

// ── 프로브(선행 조건 문항) ────────────────────────────────────────────────

/**
 * 4번 통행성 프로브 — 겉보기와 실제가 어긋나는 타일을 일부러 섞었다(2026-08-20 실측).
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
 * 3번 레이어 프로브 — 나무 캐노피(상위)와 줄기(하위)를 함께 넣었다.
 * 260~263 캐노피는 upper, 290~293 줄기는 lower 다. 같은 나무의 위아래가 서로 다른
 * 레이어라는 것이 이 타일 그림판 레이어 규칙의 핵심이고, 지붕(374/375/384/385 upper)과
 * 지붕-벽 경계(404/405 lower)도 같은 함정 구조다.
 */
export const LAYER_PROBE_TILES: readonly number[] = Object.freeze([
  260, // 나무 캐노피 — upper
  261, // 나무 캐노피 — upper
  262, // 나무 캐노피 — upper
  288, // 꽃 덤불 — upper
  374, // 사선 지붕 몸체 — lower
  375, // 사선 지붕 몸체 — lower
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

/**
 * 5번 벽 프로브 — "집의 벽면인가". 정답(positives)은 HOUSE_KITS 의 벽 나인슬라이스
 * 에서 파생하고(groundTruth.ts), 아래 함정 목록은 벽처럼 보이지만 벽이 아닌 것들이다:
 * 404/405 는 라벨이 "지붕-벽 경계"라 이름에 벽이 들어가지만 지붕 조각이고,
 * 116/146 은 문, 85/87 은 창문, 374 는 사선 지붕, 342/246 은 바닥/석축이다.
 * 함정이 없으면 "회색 사각형 = 벽" 수준의 답이 만점을 받는다.
 */
export const WALL_PROBE_TILES: readonly number[] = Object.freeze([
  12, 13, 14, // 흰 회벽 상단 (bright-plaster)
  42, 43, 44, // 흰 회벽 중단
  72, 73, 74, // 흰 회벽 하단
  15, 16, 17, // 다른 키트의 벽 상단 (blue-stone) — 벽이므로 정답
  102, 103, 104, // 통나무 집벽 상단 (amber-wood) — 벽이므로 정답
  306, // 벽 (TILE.WALL)
  404, 405, // 함정: 지붕-벽 경계 = 지붕 조각
  374, // 함정: 사선 지붕
  116, 146, // 함정: 문
  85, 87, // 함정: 창문
  342, 246, // 함정: 돌바닥 / 석축 단
]);

/** WALL_PROBE_TILES 중 벽이 아닌 것들 — 정답 파생의 교차 검증용 명시 목록. */
export const WALL_PROBE_TRAPS: readonly number[] = Object.freeze([
  404, 405, 374, 116, 146, 85, 87, 342, 246,
]);

// ── 그리드 픽스처 공용 타입 ───────────────────────────────────────────────

export interface FixturePoint {
  readonly x: number;
  readonly y: number;
}

export interface FixtureRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** stampRectHouseKit 의 RectHousePlan 으로 그대로 넘어가는 집 계획. */
export interface FixtureHousePlan {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly stories: 1 | 2 | 3;
  readonly roofBodyRows: number;
  readonly kitId: HouseKitId;
  readonly lowWall?: boolean;
  /** 창문은 기본 끈다 — 정본과의 칸 일치(identity)에 잡음을 넣지 않기 위해. */
  readonly windows?: false;
}

export interface TownGridFixture {
  readonly key: TownPlacementKey;
  readonly width: number;
  readonly height: number;
}

// ── 3번 나무 배치 그리드 ──────────────────────────────────────────────────

/**
 * 나무 4그루. 좌표는 1세대 벤치마크(src/benchmark/fixtures/construction.ts d5)와
 * 같은 자리를 쓴다 — 같은 칩셋에서 두 세대가 다른 자리를 쓰면 결과를 나란히
 * 놓고 볼 수 없다.
 */
export const TREE_GRID: TownGridFixture & { readonly spots: readonly FixturePoint[] } = Object.freeze({
  key: "treeGrid" as const,
  width: 8,
  height: 6,
  spots: Object.freeze([
    Object.freeze({ x: 1, y: 1 }),
    Object.freeze({ x: 5, y: 1 }),
    Object.freeze({ x: 2, y: 4 }),
    Object.freeze({ x: 6, y: 4 }),
  ]),
});

// ── 4번 길 그리드 ─────────────────────────────────────────────────────────

/**
 * 길 과제 — 건물 두 채를 피해 세 지점을 하나의 길로 잇는다.
 *
 * 정본 경로(canonicalCells)는 "유일한 정답"이 아니다. 그래서 4번은 정본과의 칸
 * 일치로 채점하지 않고 구조(단일 성분 · 세 지점 연결 · 오토타일 합법성 · 건물
 * 침범 0 · 통행 가능)로 채점한다. 정본은 그림을 그리고 오토타일 정답 타일을
 * 뽑아 두기 위한 기준선이다.
 */
export const ROAD_GRID: TownGridFixture & {
  readonly buildings: readonly FixtureRect[];
  readonly anchors: readonly FixturePoint[];
  readonly canonicalCells: readonly FixturePoint[];
} = Object.freeze({
  key: "roadGrid" as const,
  width: 14,
  height: 10,
  buildings: Object.freeze([
    Object.freeze({ x: 2, y: 2, w: 3, h: 3 }),
    Object.freeze({ x: 9, y: 5, w: 4, h: 3 }),
  ]),
  anchors: Object.freeze([
    Object.freeze({ x: 1, y: 8 }),
    Object.freeze({ x: 13, y: 1 }),
    Object.freeze({ x: 6, y: 4 }),
  ]),
  canonicalCells: Object.freeze([
    // 남쪽 대로 y=8 (x 1..13)
    ...Array.from({ length: 13 }, (_unused, index) => Object.freeze({ x: 1 + index, y: 8 })),
    // 동쪽 수직 지선 x=13 (y 1..7) — 건물 2(x9..12)를 피해 마지막 열로 낸다
    ...Array.from({ length: 7 }, (_unused, index) => Object.freeze({ x: 13, y: 1 + index })),
    // 중앙 지선 x=6 (y 4..7) — 세 번째 지점을 대로에 붙인다
    ...Array.from({ length: 4 }, (_unused, index) => Object.freeze({ x: 6, y: 4 + index })),
  ]),
});

// ── 5번 벽 외곽 / 7번 문 / 8번 울타리가 공유하는 기준 집 ───────────────────

/**
 * 6x6 집(밝은 오렌지 지붕 + 흰 회벽). 세 문항이 같은 집을 쓴다 — 벽을 세우고,
 * 그 벽에 문을 내고, 그 필지에 울타리를 친다. 같은 집을 쓰면 세 점수를 나란히
 * 읽을 수 있다("벽은 세우는데 문을 못 낸다"가 보인다).
 *
 * 기하: 폭 6 · 1층 · 지붕 몸통 1행 → rectHouseHeight = 1 + 1 + 1 + (2 + 1) = 6.
 * 문 자리(stampRectHouseKit 반환값) = (x + floor(6/2), 벽 하단 행) = (4, 6).
 */
export const SHELL_HOUSE: FixtureHousePlan = Object.freeze({
  x: 1,
  y: 1,
  width: 6,
  stories: 1 as const,
  roofBodyRows: 1,
  kitId: "bright-plaster" as HouseKitId,
  windows: false as const,
});

export const WALL_GRID: TownGridFixture & { readonly house: FixtureHousePlan } = Object.freeze({
  key: "wallGrid" as const,
  width: 8,
  height: 8,
  house: SHELL_HOUSE,
});

// ── 6번 지붕 대각(표준 사선 지붕) ─────────────────────────────────────────

/**
 * 표준 사선 지붕 — 용마루 행·몸통 행·처마 행 + **투명 대각 캡**(354/355/384/385)이
 * 이 축의 실제 난이도다. 불투명 조각(용마루 374·트림 376/377·몸통 404·처마 405)은
 * 전부 하위 레이어, 캡만 상위 레이어 — 레이어 규율과 사선 마감을 함께 본다.
 *
 * 폭 7 · 1층 · 지붕 몸통 2행 → rectHouseHeight = 1 + 2 + 1 + 3 = 7.
 * 2026-09-11: 예전 A자(피라미드) 지붕은 제품에서 삭제됐다(사용자 지시).
 */
export const ROOF_GRID: TownGridFixture & { readonly house: FixtureHousePlan } = Object.freeze({
  key: "roofGrid" as const,
  width: 9,
  height: 9,
  house: Object.freeze({
    x: 1,
    y: 1,
    width: 7,
    stories: 1 as const,
    roofBodyRows: 2,
    kitId: "bright-plaster" as HouseKitId,
    windows: false as const,
  }),
});

// ── 7번 문 그리드 ─────────────────────────────────────────────────────────

/**
 * 이미 지어진 집에 문만 낸다. 답변은 "바꾼 칸만" 채우는 단일 레이어 그리드이므로
 * 집을 다시 베껴 쓰는 전사(轉寫) 시험이 되지 않는다 — 문 두 칸이 전부다.
 * 정본: 하위 레이어에 (4,5)=문 상단 116, (4,6)=문 하단 146 (village/houses.ts 규약).
 */
export const DOOR_GRID: TownGridFixture & {
  readonly house: FixtureHousePlan;
  readonly doorAt: FixturePoint;
} = Object.freeze({
  key: "doorGrid" as const,
  width: 8,
  height: 8,
  house: SHELL_HOUSE,
  doorAt: Object.freeze({ x: 4, y: 6 }),
});

// ── 8번 울타리 그리드 ─────────────────────────────────────────────────────

/**
 * 필지 울타리 — 답변은 상위 레이어 단일 그리드.
 * seed 20260820 / houseIndex 0 은 placeLotFence 의 withSidePosts 분기를 **참**으로
 * 만든다(hash % 2 === 0, 2026-08-21 실측). 그래야 정본이 아래 모서리(438/410) +
 * 세로 변(408) + 끝 조각(409/439) + 가로대(379)를 전부 포함해 8번 규칙 6개가
 * 모두 채점 대상이 된다. seed 를 바꾸면 정본이 끝 조각 마감 분기로 바뀐다.
 */
export const FENCE_GRID: TownGridFixture & {
  readonly house: FixtureHousePlan;
  readonly doorAt: FixturePoint;
  readonly seed: number;
  readonly houseIndex: number;
} = Object.freeze({
  key: "fenceGrid" as const,
  width: 8,
  height: 8,
  house: SHELL_HOUSE,
  doorAt: Object.freeze({ x: 4, y: 6 }),
  seed: 20260820,
  houseIndex: 0,
});

// ── 9번 마을 그리드 ───────────────────────────────────────────────────────

/**
 * 20x12 마을 — 집 3채(서로 다른 키트) + 대로 + 광장.
 *
 * 크기를 20x12(240칸 × 2레이어 = 480개 정수)로 잡은 것은 의도적이다. 더 키우면
 * 출력 토큰이 8192 상한에 닿아 절단이 실력이 아닌 이유로 점수를 갈라 버린다.
 *
 * 기하:
 *  - 집 3채는 y=1..6, 문은 벽 하단 행 y=6, 문 앞은 y=7
 *  - 필지 울타리 앞줄은 y=7(문 앞 ±1 은 게이트로 비움)
 *  - 대로는 y=8 한 줄 — 문 앞에서 남쪽 3칸 안에 들어오므로 doorHasRoad 를 만족한다
 *  - 광장(포석)은 y=9..11 로 대로에 맞닿아 같은 도로 성분이 된다
 */
export const VILLAGE_GRID: TownGridFixture & {
  readonly houses: readonly FixtureHousePlan[];
  readonly plaza: FixtureRect;
  readonly roadRow: number;
  readonly roadAnchors: readonly FixturePoint[];
  readonly seed: number;
} = Object.freeze({
  key: "villageGrid" as const,
  width: 20,
  height: 12,
  houses: Object.freeze([
    Object.freeze({
      x: 1, y: 1, width: 6, stories: 1 as const, roofBodyRows: 1,
      kitId: "bright-plaster" as HouseKitId, windows: false as const,
    }),
    Object.freeze({
      x: 8, y: 1, width: 6, stories: 1 as const, roofBodyRows: 1,
      kitId: "amber-wood" as HouseKitId, windows: false as const,
    }),
    // 폭 4 — 필지(bbox+1 = x14..19)가 그리드 안에 들어와야 한다. 폭 5면 필지가
    // x=20 으로 넘쳐 앞줄 런이 끝 조각 없이 끊기고 **정본이 8번 규칙을 위반**한다.
    Object.freeze({
      x: 15, y: 1, width: 4, stories: 1 as const, roofBodyRows: 1,
      kitId: "slate-wood" as HouseKitId, windows: false as const,
    }),
  ]),
  plaza: Object.freeze({ x: 7, y: 9, w: 6, h: 3 }),
  roadRow: 8,
  roadAnchors: Object.freeze([Object.freeze({ x: 0, y: 8 }), Object.freeze({ x: 19, y: 8 })]),
  seed: 20260820,
});

// ── 모아 보기 ─────────────────────────────────────────────────────────────

/** 그리드 픽스처 전체 — inputImages/groundTruth 가 순회한다. */
export const TOWN_GRID_FIXTURES: Readonly<Record<TownPlacementKey, TownGridFixture>> = Object.freeze({
  treeGrid: TREE_GRID,
  roadGrid: ROAD_GRID,
  wallGrid: WALL_GRID,
  roofGrid: ROOF_GRID,
  doorGrid: DOOR_GRID,
  fenceGrid: FENCE_GRID,
  villageGrid: VILLAGE_GRID,
});

export function gridFixture(key: TownPlacementKey): TownGridFixture {
  const fixture = TOWN_GRID_FIXTURES[key];
  if (!fixture) throw new Error(`town fixtures: 알 수 없는 그리드 픽스처 ${key}`);
  return fixture;
}
