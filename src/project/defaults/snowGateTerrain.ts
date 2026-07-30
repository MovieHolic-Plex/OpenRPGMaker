import { createDungeonTerrainAutotileGroups, dungeonTerrainBlockRoles } from "@/project/defaults/dungeonTerrainAutotiles";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  ICE_DIAGONAL_TILES,
  ICE_SNOW_SUPPORT_TILES,
  stampIceDiagonalColumns,
  type IceDiagonalColumn,
} from "@/project/defaults/iceDiagonalTerrain";
import type { GameMap } from "@/project/types";

/**
 * 설산 관문(30×22)의 지형을 **고도 계단**으로 짓는다.
 *
 * 2026-07-27 감독 결정 시트의 답을 그대로 구현한 모듈이다. 결정과 그 근거:
 *
 *  Q1 정석 9-슬라이스 — 재질을 낱개 타일로 찍지 않는다. `dungeonTerrainBlockRoles()` 의
 *      몸통 타일로 칠하고 `shapeAutotileGroupAround()` 로 변/코너를 계산한다.
 *      (큰 맵 `iceGrandExpanseTerrain.ts` 는 심연을 428 = **오른쪽 테두리 조각**으로 2,800칸
 *       채우고 빙판을 `BASIN_TILES[index % 6]` 로 뿌려 벽돌무늬가 됐다. 여기선 그 길을 막는다.
 *       올바른 몸통은 눈 67 · 빙판 70 · 심연 427 이고, 이 세 값은 위 함수가 유도해 준다.)
 *
 *  Q2 끊고 계단 / Q2-B 떼어낸다 — 능선은 12칸 모티프의 복사가 아니라 **높이 프로필**에서
 *      생성한다. 능선마다 통로(gap)를 하나 두고 그 x 를 층마다 옮겨 굽잇길을 만든다.
 *      서로 다른 능선은 최소 두 칸 떨어뜨린다(`RIDGE_MIN_SEPARATION`) — 큰 맵에서
 *      r09+r07 과 r03+r01 이 한 칸 차이로 맞닿아 폭 84칸 벽 하나로 융합된 사고를 막는다.
 *
 *  Q3 얼음 난간 다리 — 고도를 넘는 건 통로(gap)로 하고, **크레바스**는 얼음 난간
 *      375~377 다리로 건넌다. 이 칩셋에 얼음색 계단은 없다(계단 444/445/474/475 는 베이지).
 *
 *  Q4 상위 눈 덮어쓰기 금지 — 길이 절벽을 만나면 통로로 돌아간다. 절벽 칸 위에
 *      **통행 가능한 상위 타일을 절대 올리지 않는다.** `collision.ts` 의 `tilePassability` 는
 *      상위가 하위를 덮으므로(star 제외) 그렇게 하면 절벽이 걸어 넘을 수 있게 된다 —
 *      큰 맵의 365칸이 정확히 그 버그다. `ridgeCellMask` 가 이걸 지킨다.
 *
 *  Q5 원경 실루엣 + Q6 고도 읽힘 — 설산 봉우리 408/409 는 정상 표시가 아니라 **높이 단위**다
 *      (감독 지시: "정상 뿐만 아니라"). 능선 볏 위 한 칸마다 한 쌍씩 얹어 층이 올라갈수록
 *      뒤로 산이 겹치게 한다. 절벽 상단에는 눈처짐 237~239.
 *      바닥 재질도 갈라 최하층은 빙판, 그 위는 눈이다.
 *
 *  Q7 소품 — 얼음 수정 350/351 · 석순 261/288/291 · 얼음 블록 232 · 얼음 난간 375~377 ·
 *      봉우리 408/409 · 눈뭉치 315 · 눈사람 345 · 얼음 마법 블록 125/155/185/215 · 부빙 282~344.
 */

const SNOW_SUPPORT = new Set<number>(ICE_SNOW_SUPPORT_TILES);

/** 얼음 벽 — 좌우 구분 없는 설원 벽면 조각. 능선 길이의 대부분을 이게 맡는다. */
export const ICE_WALL_TILE = 285;

/**
 * ★(star) 타일 — 통행에 영향을 주지 않고 캐릭터 위에 그려진다.
 * `tilesetPassage.ts:21` 의 규칙은 "통행 가능 + priority=upper → star" 이고
 * `collision.ts:44` 는 star 면 하위 통행성을 그대로 쓴다. 즉 **★은 절벽 위에 얹어도 안전하다.**
 * 실측(2026-07-27)으로 아래 타일 전부가 던전 칩셋에서 star 임을 확인했다.
 * 반대로 얼음 마법 블록 125/155/185/215 와 얼음 난간 375~377 은 x(통행 불가)라
 * 눈밭에 놓으면 진짜 장애물이 된다 — 그게 의도다.
 */
export const SNOW_GATE_STAR_TILES: readonly number[] = [237, 238, 239, 408, 409, 350, 351, 315, 345, 232, 261, 288, 291];

/** 서로 다른 능선 사이 최소 간격(칸). 1이면 8-이웃으로 붙어 한 덩어리로 그려진다. */
export const RIDGE_MIN_SEPARATION = 2;

export const SNOW_GATE_PROPS = {
  /** 벽 위 쌓인 눈 — 좌 · 가운데 처짐 · 우. 절벽 상단 **위 한 칸**에 얹는다. */
  drape: { left: 237, mid: 238, right: 239 },
  /** 설산 봉우리 가로 2폭 쌍. 세로로 쌓는 조각이 아니다. */
  peak: { left: 408, right: 409 },
  /**
   * 375~377 은 **계단**이다 — 좌 375 · 중 376(가로 증식) · 우 377, 통행 가능.
   * 2026-07-27 사용자 확정 + 실측 렌더(cliff-vocab.png)로 바로잡았다.
   * 하네싱이 "얼음 난간/다리 턱 · solid" 로 잘못 적어 놨고 그걸 믿은 결과
   *   ① 처음엔 다리 바닥으로 깔았다 → 통행 불가라 맵 위쪽 전체가 도달 불가
   *   ② 다음엔 다리 양옆 '턱'으로 썼다 → 계단을 장식으로 낭비
   * 이 맵의 크레바스는 판자(`deck`) 세 칸으로 건너고, 계단은 절벽을 오르는 데만 쓴다.
   */
  stairs: { left: 375, mid: 376, right: 377 },
  /** 세로 판자 다리 — 구덩이 위에 걸치는 통행 가능한 바닥(planks 그룹, 세로 열 141/171/201/231). */
  deck: 171,
  crystalBig: 350,
  crystalSmall: 351,
  stalagmite: [261, 288, 291],
  iceBlock: 232,
  snowball: 315,
  snowman: 345,
  /** 얼음 마법 블록 애니메이션 — 맵에서 유일하게 움직이는 것. */
  magic: [125, 155, 185, 215],
  /** 부빙 3×3 — 313 은 얼음 구멍 장식이라 중앙에 딱 한 번만 온다. */
  floe: [282, 283, 284, 312, 313, 314, 342, 343, 344],
} as const;

export type SnowGateBandId = "reservoir" | "crevasse-shelf" | "crystal-shelf" | "summit";
export type SnowGateMaterial = "snow" | "ice";

export type SnowGateBand = {
  readonly id: SnowGateBandId;
  readonly topY: number;
  readonly bottomY: number;
  readonly material: SnowGateMaterial;
};

/**
 * 능선 하나. `crestY` 는 볏(cap) 행, `height` 는 기둥 길이(cap+body…+base).
 * `gap` 은 통로로 비워 두는 x 구간(양끝 포함). `profile` 은 x 마다 볏 행의 상대 높이로,
 * 이웃 간 차이가 ±1 또는 0 이어야 한다 — 정본 문법이 기둥 한 칸 어긋남만 허용한다.
 */
export type SnowGateRidge = {
  readonly id: string;
  readonly crestY: number;
  readonly height: number;
  readonly gap: readonly [number, number];
  readonly profile: readonly number[];
  /**
   * 정본 봉우리(Λ)를 세울 x 위치들. 각 위치는 x·x+1 두 칸을 쓰고 `profile` 이 둘 다 0이어야 한다.
   * **정본 캡 286/287 은 긴 절벽 윗면을 만들 수 없다** — 캡 하나가 V 의 반쪽이라
   * 같은 캡을 늘어놓으면 톱니(MWMW)가 된다. 큰 맵의 "존나 엉망"이 정확히 이것이고,
   * 프로필을 다듬어서는 못 고친다. 재질의 성질이다.
   * 그래서 캡은 **봉우리 꼭지에서만** 쓰고 나머지 길이는 얼음 벽 285 가 맡는다.
   */
  readonly peaks: readonly number[];
};

export const SNOW_GATE_WIDTH = 30;
export const SNOW_GATE_HEIGHT = 22;

/**
 * 고도 네 단 · 능선 셋. 남(아래)에서 북(위)으로 오른다.
 * 통로 x 가 15 → 8 → 22 로 옮겨 다녀 20칸 직선이 아니라 굽잇길이 된다.
 *
 * 밴드 경계는 **능선 밑동의 눈 지지 행**이 정한다. 정본 규칙
 * `left-base-needs-snow-support` 는 밑동 바로 아래가 눈 계열일 것을 요구하므로,
 * 빙판·크레바스는 어떤 능선의 (밑동+1) 행에도 닿을 수 없다.
 * 처음 짠 배치(저수지 y19~21 · 크레바스 y13)는 그 규칙을 어겨서
 * 저수지에 구멍이 뚫리고 능선 B 밑동이 크레바스와 겹쳤다 — 한 칸씩 밀어 해결했다.
 */
export const SNOW_GATE_BANDS: readonly SnowGateBand[] = [
  { id: "reservoir", topY: 20, bottomY: 21, material: "ice" },
  { id: "crevasse-shelf", topY: 13, bottomY: 14, material: "snow" },
  { id: "crystal-shelf", topY: 7, bottomY: 8, material: "snow" },
  { id: "summit", topY: 1, bottomY: 2, material: "snow" },
];

/**
 * 프로필은 능선마다 다르게 짠다 — 같은 파형을 반복하면 큰 맵의 VVVV 톱니가 된다.
 * 값은 볏 행에 더하는 오프셋이라 **클수록 화면에서 낮다**. 0/1 두 단만 쓴다:
 * 세 단(0/1/2)을 쓰면 기둥 네 칸이 되어 밑동이 아래 밴드로 내려가 버린다.
 */
export const SNOW_GATE_RIDGES: readonly SnowGateRidge[] = [
  {
    id: "a-reservoir-rim",
    crestY: 15,
    height: 3,
    gap: [14, 16],
    // 서쪽은 낮게 눌리고, 통로 양옆이 솟아 관문의 어깨가 된다.
    profile: [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    peaks: [4, 24],
  },
  {
    id: "b-crevasse-wall",
    crestY: 9,
    height: 3,
    gap: [7, 9],
    // 통로 주변만 낮고 동쪽으로 길게 한 단 올라간 사면. 꺾임이 성기다.
    profile: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1],
    peaks: [15, 25],
  },
  {
    id: "c-summit-shoulder",
    crestY: 3,
    height: 3,
    gap: [21, 23],
    // 정상 어깨 — 서쪽이 솟고 동쪽 통로로 갈수록 내려앉는다.
    profile: [1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
    peaks: [5, 13],
  },
];

/**
 * 크레바스 — 얼음 난간 다리로만 건널 수 있는 틈. 통로 A 를 나오면 정면에서 마주친다.
 * 다리는 심연(통행 불가) 위에 통행 가능한 상위 타일을 얹어 뚫는다. 절벽에 같은 짓을 하면
 * 버그지만(큰 맵 365칸) 크레바스 위에서는 그게 바로 다리다 — 같은 지레를 제자리에 쓴다.
 */
export const SNOW_GATE_CREVASSE = { y: 14, minX: 11, maxX: 19 } as const;
export const SNOW_GATE_BRIDGE_X = 15;

/** 부빙 3×3 을 저수지에 딱 한 번 놓는다. */
export const SNOW_GATE_FLOE_ORIGIN = { x: 5, y: 19 } as const;

function idx(x: number, y: number): number {
  return y * SNOW_GATE_WIDTH + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < SNOW_GATE_WIDTH && y < SNOW_GATE_HEIGHT;
}

/** 능선의 한 열. `kind` 가 재질을 정한다 — 봉우리 꼭지만 정본 캡을 쓴다. */
export type SnowGateColumn = IceDiagonalColumn & { readonly kind: "wall" | "peak" };

function peakXs(ridge: SnowGateRidge): Set<number> {
  const set = new Set<number>();
  for (const x of ridge.peaks) { set.add(x); set.add(x + 1); }
  return set;
}

/**
 * 능선 하나를 열 목록으로 펼친다.
 *
 * 봉우리 꼭지는 정본 캡 두 칸으로 세운다 — 실측(2026-07-27, `sg-wall-plate.png`)으로
 * **`[287,286]` 이 Λ 봉우리, `[286,287]` 이 V 골짜기**임을 확인했다.
 * (하네싱 설명 themePacks.ts:211 은 "봉우리는 [286,287]"이라 적혀 있는데 좌우가 뒤바뀌어 있다.)
 * 즉 왼쪽 열이 face="right"(올라감), 오른쪽 열이 face="left"(내려감)여야 Λ 가 된다.
 * 나머지 길이는 얼음 벽 285 — 캡을 늘어놓으면 톱니가 되기 때문이다.
 */
export function snowGateRidgeColumns(ridge: SnowGateRidge): readonly SnowGateColumn[] {
  const [gapFrom, gapTo] = ridge.gap;
  const peakCells = peakXs(ridge);
  const peakStarts = new Set(ridge.peaks);
  const columns: SnowGateColumn[] = [];
  for (let x = 0; x < SNOW_GATE_WIDTH; x += 1) {
    const here = ridge.profile[x];
    if (here === undefined) continue;
    if (x >= gapFrom && x <= gapTo) continue;
    const topY = ridge.crestY + here;
    const bottomY = topY + ridge.height - 1;
    if (peakCells.has(x)) {
      // 꼭지 왼쪽 열은 올라가는 면(right), 오른쪽 열은 내려가는 면(left) → Λ.
      columns.push({ x, topY, bottomY, face: peakStarts.has(x) ? "right" : "left", kind: "peak" });
      continue;
    }
    // 벽 열의 face 는 쓰이지 않는다(285 는 좌우 구분이 없다) — 형식을 맞추기 위해 넣는다.
    columns.push({ x, topY, bottomY, face: "right", kind: "wall" });
  }
  return columns;
}

export function snowGateRidgeColumnsAll(): readonly SnowGateColumn[] {
  return SNOW_GATE_RIDGES.flatMap(snowGateRidgeColumns);
}

/** 정본 검증기에 넘길 열만 — 얼음 벽 285 는 정본 문법의 대상이 아니다. */
export function snowGatePeakColumns(): readonly IceDiagonalColumn[] {
  return snowGateRidgeColumnsAll()
    .filter((column) => column.kind === "peak")
    .map(({ x, topY, bottomY, face }) => ({ x, topY, bottomY, face }));
}

/** 능선이 실제로 점유하는 칸. 여기엔 통행 가능한 상위 타일을 절대 얹지 않는다. */
export function snowGateRidgeCellMask(): Uint8Array {
  const mask = new Uint8Array(SNOW_GATE_WIDTH * SNOW_GATE_HEIGHT);
  for (const column of snowGateRidgeColumnsAll()) {
    for (let y = column.topY; y <= column.bottomY; y += 1) if (inBounds(column.x, y)) mask[idx(column.x, y)] = 1;
  }
  return mask;
}

/** 능선 칸 + 밑동 바로 아래 한 줄. 아래 줄은 눈이어야 `left-base-needs-snow-support` 를 만족한다. */
function ridgeProtectedMask(): Uint8Array {
  const mask = snowGateRidgeCellMask();
  for (const column of snowGateRidgeColumnsAll()) {
    const y = column.bottomY + 1;
    if (inBounds(column.x, y)) mask[idx(column.x, y)] = 1;
  }
  return mask;
}

export type SnowGateTerrainError = { readonly code: string; readonly detail: string };

/** 능선끼리 최소 간격을 지키는지, 프로필 기울기가 ±1 이내인지 확인한다. */
export function validateSnowGateRidges(): readonly SnowGateTerrainError[] {
  const errors: SnowGateTerrainError[] = [];
  for (const ridge of SNOW_GATE_RIDGES) {
    if (ridge.profile.length !== SNOW_GATE_WIDTH) {
      errors.push({ code: "PROFILE_LENGTH", detail: `${ridge.id}: ${ridge.profile.length} != ${SNOW_GATE_WIDTH}` });
    }
    for (let x = 1; x < ridge.profile.length; x += 1) {
      const step = Math.abs((ridge.profile[x] ?? 0) - (ridge.profile[x - 1] ?? 0));
      if (step > 1) errors.push({ code: "PROFILE_STEP", detail: `${ridge.id} x=${x}: 기울기 ${step}` });
    }
  }
  // 능선별 점유 칸을 따로 모아 8-이웃 간격을 잰다.
  const owners = SNOW_GATE_RIDGES.map((ridge) => {
    const cells = new Set<number>();
    for (const column of snowGateRidgeColumns(ridge)) {
      for (let y = column.topY; y <= column.bottomY; y += 1) if (inBounds(column.x, y)) cells.add(idx(column.x, y));
    }
    return { id: ridge.id, cells };
  });
  for (let a = 0; a < owners.length; a += 1) for (let b = a + 1; b < owners.length; b += 1) {
    const left = owners[a]!;
    const right = owners[b]!;
    for (const cell of left.cells) {
      const cx = cell % SNOW_GATE_WIDTH;
      const cy = Math.floor(cell / SNOW_GATE_WIDTH);
      for (let dy = -RIDGE_MIN_SEPARATION; dy <= RIDGE_MIN_SEPARATION; dy += 1) {
        for (let dx = -RIDGE_MIN_SEPARATION; dx <= RIDGE_MIN_SEPARATION; dx += 1) {
          if (!inBounds(cx + dx, cy + dy)) continue;
          if (right.cells.has(idx(cx + dx, cy + dy))) {
            errors.push({ code: "RIDGE_TOO_CLOSE", detail: `${left.id} ↔ ${right.id} @ ${cx},${cy}` });
          }
        }
      }
    }
  }
  return errors;
}

type Roles = ReturnType<typeof dungeonTerrainBlockRoles>[number];

function rolesByKey(): Map<string, Roles> {
  return new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
}

/** 몸통 타일만 찍고 변·코너는 오토타일 엔진이 계산한다 — 낱개 타일을 나머지 연산으로 뿌리지 않는다. */
function paintBlockBody(map: GameMap, cells: readonly number[], body: number): void {
  for (const cell of cells) map.lowerTiles[cell] = body;
}

function shapeBlocks(map: GameMap, keys: readonly string[]): void {
  const groups = new Map(createDungeonTerrainAutotileGroups().map((group) => [group.id, group]));
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < SNOW_GATE_HEIGHT; y += 1) for (let x = 0; x < SNOW_GATE_WIDTH; x += 1) points.push({ x, y });
  for (const key of keys) {
    const group = groups.get(`harness-dungeon-v1-terrain-${key}`);
    if (group === undefined) throw new Error(`던전 지형 오토타일 그룹 없음: ${key}`);
    shapeAutotileGroupAround(map, group, points);
  }
}

/**
 * 지형을 깐다. 순서가 규칙이다:
 *   ① 눈으로 전부 채운다 → ② 능선이 쓸 칸을 보호하고 그 밖에만 빙판·심연을 칠한다
 *   → ③ 오토타일로 변·코너를 계산한다 → ④ 정본 빌더로 능선을 세운다(눈 계열만 대체된다)
 *   → ⑤ 상위 레이어에 눈처짐·봉우리·다리·소품을 얹는다.
 * ④가 마지막인 이유: `stampIceDiagonalColumns` 의 `REPLACEABLE_TILES` 는 눈 계열 12종과 -1 뿐이라
 * 빙판·심연 위에는 능선이 서지 않는다. 즉 순서 자체가 재질 충돌을 막는 장치다.
 */
export function paintSnowGateTerrain(map: GameMap): void {
  const roles = rolesByKey();
  const snow = roles.get("snow");
  const ice = roles.get("ice");
  const abyss = roles.get("abyss-blue");
  if (snow === undefined || ice === undefined || abyss === undefined) throw new Error("던전 지형 역할표 누락");

  // ① 눈 몸통으로 전부
  for (let cell = 0; cell < SNOW_GATE_WIDTH * SNOW_GATE_HEIGHT; cell += 1) map.lowerTiles[cell] = snow.body;

  // ② 능선 보호 마스크 밖에만 다른 재질
  const protectedCells = ridgeProtectedMask();
  const iceCells: number[] = [];
  for (const band of SNOW_GATE_BANDS) {
    if (band.material !== "ice") continue;
    for (let y = band.topY; y <= band.bottomY; y += 1) for (let x = 0; x < SNOW_GATE_WIDTH; x += 1) {
      if (protectedCells[idx(x, y)] === 1) continue;
      iceCells.push(idx(x, y));
    }
  }
  paintBlockBody(map, iceCells, ice.body);

  const crevasseCells: number[] = [];
  for (let x = SNOW_GATE_CREVASSE.minX; x <= SNOW_GATE_CREVASSE.maxX; x += 1) {
    const cell = idx(x, SNOW_GATE_CREVASSE.y);
    if (protectedCells[cell] === 1) continue;
    crevasseCells.push(cell);
  }
  paintBlockBody(map, crevasseCells, abyss.body);

  // ③ 변·코너 계산. 오버레이(빙판·심연)를 먼저 성형해야 눈이 그 경계를 존중한다.
  shapeBlocks(map, ["ice", "abyss-blue", "snow"]);

  // ④-a 얼음 벽 285 — 능선 길이의 대부분. 좌우 구분이 없어 어느 길이로든 이어진다.
  for (const column of snowGateRidgeColumnsAll()) {
    if (column.kind !== "wall") continue;
    for (let y = column.topY; y <= column.bottomY; y += 1) {
      if (inBounds(column.x, y)) map.lowerTiles[idx(column.x, y)] = ICE_WALL_TILE;
    }
  }

  // ④-b 봉우리 꼭지만 정본 빌더로. 검증기는 이 열들만 본다.
  const stamped = stampIceDiagonalColumns(
    { width: SNOW_GATE_WIDTH, height: SNOW_GATE_HEIGHT, lower: map.lowerTiles },
    snowGatePeakColumns(),
  );
  if (!stamped.ok) {
    const summary = stamped.issues.slice(0, 6).map((issue) => `${issue.code}@${issue.x},${issue.y}`).join(" · ");
    throw new Error(`설산 관문 능선 정본 검증 실패: ${summary}`);
  }
  for (let cell = 0; cell < stamped.lower.length; cell += 1) map.lowerTiles[cell] = stamped.lower[cell] ?? snow.body;

  // ⑤ 상위 레이어
  decorateSnowGate(map);
}

/**
 * 상위 레이어 장식. 규칙 하나가 전부를 지배한다:
 * **★이 아닌 상위 타일은 능선 칸에 절대 올리지 않는다.**
 * ★은 통행성을 바꾸지 않으므로(위 `SNOW_GATE_STAR_TILES` 주석) 절벽 위에 바로 얹어도 되고,
 * 눈처짐 237~239 는 애초에 그러라고 만든 어휘다("절벽 상단에 가로로 얹습니다").
 * 처음엔 안전하게 볏 위 한 칸에 얹었는데 화면에서 **눈 위에 뜬 희미한 물결**이 되어
 * 아무 일도 하지 않았다 — 벽 윗면에 직접 붙어야 눈 처짐으로 읽힌다.
 */
function decorateSnowGate(map: GameMap): void {
  const ridgeCells = snowGateRidgeCellMask();
  const stars = new Set<number>(SNOW_GATE_STAR_TILES);
  const safeUpper = (x: number, y: number, tile: number): boolean => {
    if (!inBounds(x, y)) return false;
    // 통행 가능한 **비-★** 타일을 능선 칸에 얹으면 절벽이 걸어 넘어진다 — 큰 맵의 365칸 버그.
    if (ridgeCells[idx(x, y)] === 1 && !stars.has(tile)) return false;
    if ((map.upperTiles[idx(x, y)] ?? -1) !== -1) return false;
    map.upperTiles[idx(x, y)] = tile;
    return true;
  };

  // 볏 행별로 연속 구간을 찾아 좌·중·우 눈처짐을 붙인다.
  for (const ridge of SNOW_GATE_RIDGES) {
    const crestByX = new Map<number, number>();
    for (const column of snowGateRidgeColumns(ridge)) crestByX.set(column.x, column.topY);
    let run: number[] = [];
    const flush = (): void => {
      if (run.length >= 3) {
        run.forEach((x, position) => {
          // 볏 행 **그 자체**에 얹는다. ★이라 절벽은 통행 불가로 남는다.
          const y = crestByX.get(x) ?? 0;
          const tile = position === 0
            ? SNOW_GATE_PROPS.drape.left
            : position === run.length - 1 ? SNOW_GATE_PROPS.drape.right : SNOW_GATE_PROPS.drape.mid;
          safeUpper(x, y, tile);
        });
      }
      run = [];
    };
    for (let x = 0; x < SNOW_GATE_WIDTH; x += 1) {
      const top = crestByX.get(x);
      const previous = crestByX.get(x - 1);
      if (top === undefined) { flush(); continue; }
      if (previous !== undefined && previous !== top) flush();
      run.push(x);
    }
    flush();
  }

  /**
   * 봉우리 쌍은 **원자로** 놓는다 — 왼쪽만 놓고 오른쪽이 막히면 반쪽 산이 남는다.
   * (실제로 그랬다: (13,2) 에 408 을 놓고 (14,2) 는 이미 눈처짐 237 이 차지해 거부돼
   *  409 없는 408 하나가 떠 있었다. 숲의 활엽수 원자와 같은 실수다.)
   */
  const peakPair = (x: number, y: number): boolean => {
    if (!inBounds(x, y) || !inBounds(x + 1, y)) return false;
    if ((map.upperTiles[idx(x, y)] ?? -1) !== -1 || (map.upperTiles[idx(x + 1, y)] ?? -1) !== -1) return false;
    map.upperTiles[idx(x, y)] = SNOW_GATE_PROPS.peak.left;
    map.upperTiles[idx(x + 1, y)] = SNOW_GATE_PROPS.peak.right;
    return true;
  };

  /**
   * 봉우리 쌍 408/409 는 **높이 단위**다(감독 지시: "정상 뿐만 아니라 … 높이를 표현하는 데에").
   * 능선 볏 바로 위에 붙여 그 능선 뒤로 더 높은 산이 겹쳐 보이게 한다. 흩뿌리지 않고
   * 능선마다 서쪽·중앙·동쪽 세 곳에만 — 사방에 두면 새떼처럼 보인다(처음 렌더가 그랬다).
   */
  for (const ridge of SNOW_GATE_RIDGES) {
    const crestByX = new Map<number, number>();
    for (const column of snowGateRidgeColumns(ridge)) crestByX.set(column.x, column.topY);
    const anchors = [2, Math.floor(SNOW_GATE_WIDTH / 2) - 4, SNOW_GATE_WIDTH - 7];
    for (const anchor of anchors) {
      for (let offset = 0; offset < 4; offset += 1) {
        const x = anchor + offset;
        const top = crestByX.get(x);
        if (top === undefined || crestByX.get(x + 1) === undefined) continue;
        if (peakPair(x, top - 1)) break;
      }
    }
  }
  // 맵 위 경계 — 원경. 정상보다 더 높은 것이 있다는 표시.
  for (let x = 2; x + 1 < SNOW_GATE_WIDTH; x += 5) peakPair(x, 0);

  /**
   * 크레바스 다리 — **판자 한 칸**이 바닥이고 양옆 얼음 난간은 통행 불가인 턱이다.
   * 심연(통행 불가) 위에 통행 가능한 상위 타일을 얹어 뚫는 것이라 기계는 절벽 뚫기와 같지만,
   * 크레바스 위에서는 그게 바로 다리다. 절벽 칸에는 `safeUpper` 가 이 지레를 절대 허용하지 않는다.
   */
  const bridgeY = SNOW_GATE_CREVASSE.y;
  for (let offset = -1; offset <= 1; offset += 1) safeUpper(SNOW_GATE_BRIDGE_X + offset, bridgeY, SNOW_GATE_PROPS.deck);

  /**
   * 부빙 282~344 는 **넣지 않는다.** 감독이 고른 어휘지만 이 맵에 들어갈 자리가 없다.
   *
   * 실측(2026-07-27, `sg-new.png` 1차): 저수지(밝은 빙판) 위에 3×3 으로 얹으니
   * 대비가 전혀 없어 **흰 상자 하나**로 보였다. 부빙은 하네싱 설명대로
   * "급류 위에 뜬" 조각이라 아래가 어두워야 읽힌다.
   * 그런데 30×22 에는 3×3 짜리 어두운 못을 넣을 자리가 없다 —
   * 저수지는 두 행뿐이고(y20~21, y19 는 능선 밑동의 눈 지지 행이라 못 쓴다),
   * 크레바스는 한 행이며 그 위아래는 능선 A·B 가 차지한다.
   * 64×64 재작성 때 어두운 못과 함께 넣는 게 맞다.
   */
  void SNOW_GATE_FLOE_ORIGIN;

  // 소품 — 층마다 다른 것을 둔다. 같은 것을 흩뿌리면 어휘가 늘어도 화면은 안 바뀐다.
  const props: readonly (readonly [number, number, number])[] = [
    // 저수지(최하층) — 사람 흔적과 얼음 덩이
    [11, 20, SNOW_GATE_PROPS.snowman],
    [13, 21, SNOW_GATE_PROPS.snowball],
    [19, 20, SNOW_GATE_PROPS.iceBlock],
    [22, 21, SNOW_GATE_PROPS.iceBlock],
    [3, 21, SNOW_GATE_PROPS.stalagmite[0]!],
    // 크레바스 단 — 석순과 마법 블록. y13~14 가 이 단이다(y12 는 능선 B 몸통).
    [4, 13, SNOW_GATE_PROPS.stalagmite[1]!],
    [25, 13, SNOW_GATE_PROPS.stalagmite[2]!],
    [27, 13, SNOW_GATE_PROPS.magic[0]!],
    // 수정 단 — 은자가 사는 층. 수정 광맥.
    [4, 7, SNOW_GATE_PROPS.crystalBig],
    [6, 8, SNOW_GATE_PROPS.crystalSmall],
    [26, 7, SNOW_GATE_PROPS.crystalBig],
    [24, 8, SNOW_GATE_PROPS.crystalSmall],
    [11, 6, SNOW_GATE_PROPS.stalagmite[0]!],
    // 정상 — 제단으로 가는 문 앞. 움직이는 것 둘.
    [13, 2, SNOW_GATE_PROPS.magic[1]!],
    [17, 2, SNOW_GATE_PROPS.magic[2]!],
    [8, 1, SNOW_GATE_PROPS.crystalSmall],
  ];
  for (const [x, y, tile] of props) safeUpper(x, y, tile);
}

/** 능선 밑동 아래가 눈 계열인지 — 정본 규칙 `*-base-needs-snow-support` 의 사전 확인. */
export function snowGateBaseSupportGaps(map: GameMap): readonly { readonly x: number; readonly y: number; readonly tile: number }[] {
  const gaps: { x: number; y: number; tile: number }[] = [];
  for (const column of snowGateRidgeColumnsAll()) {
    const y = column.bottomY + 1;
    if (!inBounds(column.x, y)) continue;
    const tile = map.lowerTiles[idx(column.x, y)] ?? -1;
    if (!SNOW_SUPPORT.has(tile)) gaps.push({ x: column.x, y, tile });
  }
  return gaps;
}

export const SNOW_GATE_CLIFF_TILES: readonly number[] = [
  ICE_WALL_TILE,
  ICE_DIAGONAL_TILES.left.cap, ICE_DIAGONAL_TILES.left.body, ICE_DIAGONAL_TILES.left.base,
  ICE_DIAGONAL_TILES.right.cap, ICE_DIAGONAL_TILES.right.body, ICE_DIAGONAL_TILES.right.base,
];
