import { ICE_DIAGONAL_TILES, ICE_SNOW_SUPPORT_TILES, validateIceDiagonalTerrain, type IceDiagonalColumn } from "@/project/defaults/iceDiagonalTerrain";
import type { GameMap } from "@/project/types";

/**
 * 얼음 대평원 64×64 — 결정시트 q8 의 재건판.
 *
 * 128×128 `iceGrandExpanseTerrain.ts` 를 실측한 결과(2026-07-29)를 구조로 옮겼다.
 * 큰 맵의 세 결함이 전부 **생성 방식**에서 나왔으므로 고쳐 붙이지 않고 다시 짰다.
 *
 * ① **절벽 427칸이 걸어 들어갈 수 있었다.**
 *    큰 맵은 경로 마스크가 대각 빙벽과 겹치면 상위 레이어에 눈 타일 67 을 얹어 다리를 놓았다.
 *    67 의 통행 표시는 `o` 이고 `collision.ts:44` 는 상위가 ★ 가 아니면 상위 통행성으로
 *    **덮어쓴다.** 그래서 절벽 위를 걸을 수 있었다 — 감독 지적 "높이가 다른 절벽은 왜
 *    이어져 있는지"의 정체다.
 *    이 맵은 `safeUpper()` 가 유일한 상위 레이어 출입구이고, 절벽·못 칸에는 **★ 타일만**
 *    허용한다. 고도를 넘는 수단은 오직 **계단**이다.
 *
 * ② **9슬라이스가 아니었다.** 큰 맵의 절벽 테두리는 `index % 3` 으로 타일을 골라
 *    374(우측 끝) 오른쪽에 372(좌측 끝)가 붙는 조합이 195쌍 나왔다.
 *    이 맵은 모든 면 재료를 `blockTile()` 한 곳에서만 깐다 — 마스크의 이웃 4방향을 보고
 *    3×3 블록의 제 조각을 고른다(타일 그림판 한 행 30타일, body 기준 ±1/±30/±31/±29).
 *
 * ③ **계단·부빙·소품이 0개였다.** 결정시트 q7 목록이 통째로 미구현이었고, 고도 변화가
 *    전부 ①의 절벽 관통으로 처리돼 있었다. 이 맵은 계단이 유일한 등반 수단이고,
 *    어두운 못과 부빙이 실제 지형 요소로 들어간다.
 *
 * ── 지형 ──
 * 남에서 북으로 **절벽 네 겹**이 맵 폭 전체를 가로지른다(지시 ③ — 삼각형이 아니다).
 * 겹 사이의 다섯 대지는 남쪽이 낮고 북쪽이 높다. 각 겹에는 계단 한 덩어리가 있고,
 * 그 계단을 막으면 위 대지로 갈 수 없다.
 *
 *   대지0 y52-63  남쪽 대평원 — 눈밭과 **얼음 바닥 패치** (물 없음)
 *   겹A   y48-51
 *   대지1 y39-47
 *   겹B   y35-38
 *   대지2 y26-34  얼음 바닥 패치 시작
 *   겹C   y22-25
 *   대지3 y13-21
 *   겹D   y9-12
 *   대지4 y1-8    정상 대지 — 원경 봉우리 실루엣
 *
 * ── 어휘(실측 통행 표시) ──
 *   · 눈밭      9슬라이스 body 67                       `o`
 *   · 얼음 바닥 9슬라이스 body 70                       `o`
 *   · 평지 립  343 (절벽 상단 바로 위 행, 위 대지의 바닥)  `o`
 *   · 수평 절벽 상단 372/373/374 · 몸통 285 · 밑동 402/403/404   `x`
 *   · 대각 빙벽 캡 286/287 · 몸통 316/317 · 밑동 346/347         `x`
 *   · 계단      375 · 376(가로 증식) · 377                `o`
 *   · 봉우리    408/409                                  ★
 *   · 눈처짐    237/238/239                              ★
 *   · 소품      350/351 · 261/288/291 · 232 · 315 · 345  ★
 *   · 폭포 프레임 125/155/185/215 — **타일이 아니라 애니메이션 프레임이다.** 놓지 않는다.
 */

export const ICE_PLAIN_WIDTH = 64;
export const ICE_PLAIN_HEIGHT = 64;

/** 타일 그림판 한 행의 타일 수. 3×3 블록의 조각 오프셋이 여기서 나온다. */
const CHIPSET_ROW = 30;

/**
 * 절벽 한 겹이 잡는 행 수 — 벽 두 행(상단 373 · 밑동 403) + 대각 밑동이 서는 눈 행 하나.
 *
 * 1차 판은 4로 `상단 373 · 몸통 285 · 몸통 285 · 밑동 403` 이었다. 그게 오답이다 —
 * `MEASURED_CLIFF_FACTS` ① 처럼 373 과 403 은 **같은 벽 그림의 상하 한 벌**이라
 * 사이에 다른 돌을 쌓으면 벽 가운데가 어둡게 끊긴다.
 *
 * 대각 빙벽은 여전히 세 행(캡 · 몸통 · 밑동)이 필수다 — `stampIceDiagonalColumns()` 가
 * `bottomY - topY < 2` 를 `column-invalid-height` 로 막는다. 그래서 겹은 3행이고,
 * 수평 구간은 위 두 행만 벽이며 세 번째 행은 눈이다(대각 밑동이 지지로 요구하는 행과 같다).
 */
export const CLIFF_HEIGHT = 3;

/** 수평 절벽이 실제로 벽인 행 수 — 상단 373 · 밑동 403. 그 아랫 행은 눈밭 바닥이다. */
export const CLIFF_WALL_ROWS = 2;

/** 계단 한 덩어리의 가로 폭. 4 면 `375 · 376 · 376 · 377` 로 376 의 가로 증식이 보인다. */
export const STAIR_WIDTH = 4;

export const CLIFF_TOP = { left: 372, mid: 373, right: 374 } as const;
export const CLIFF_BASE = { left: 402, mid: 403, right: 404 } as const;
/**
 * **절뱽 몸통으로 쓰지 않는다.** 285 는 의미표에서 `푸른 광석 암반` 이고
 * 사용자 정본 맵 `map_g_ice_grand` 에 **한 칸도 없다** (실측: 285 = 0회, 373 = 52회,
 * 403 = 50회, 285 세로 스택 = 0회). 검사가 "이 맵의 절뱽에 광석 암반이 섞이지 않았다"를
 * 지킬 때만 쓴다.
 */
export const CLIFF_ORE_ROCK = 285;

/**
 * 절뱽 재료의 **픽셀 실측 사실**. 이 값들이 이 모듈의 벌 모양을 정한다.
 *
 * 이은면 불일치 = 맞닿는 두 타일의 접촉면 16픽셀 줄을 RGB 평군 절대오차로 본 것이다.
 * 같은 재료 자기 반복이 18~35 이므로 60 이상은 눈에 보이는 이은선, 120 이상은 재료가 끊어진 것이다.
 *
 * ① **373 과 403 은 같은 그림이다.** 행 0~13 이 224/224 픽셀 RGBA 전부 일치하고
 *    403 은 행 14~15 에 밑동 하이라이트(밝기 93·130)를 얹은 것만 다를다.
 *    즐 절뱽 한 겹의 벌은 `373 ↓ 403` 둘이며 그 이은은 23 이다.
 * ② **285 을 사이에 끄우면 벌이 끊긴다.** 285 는 평군 밝기 42 로 벌면보다 30% 어려워
 *    벌 가운데 어된 띄가 깥다. `285 ↓ 403` = 40 · `285 → 계단 375` = 77.
 * ③ **대각 밑동은 수평 밑동과 이어지지 않는다.** `347 → 403` = 172 이고 끝 조각을 써도
 *    나아지지 않는다(402 = 217 · 404 = 172). 그러나 **눈밭과는 이어진다**: `347 → 67` = 21.
 *    그래서 대각 밑동 행은 수평 벌이 아니라 눈 바닥이어야 한다.
 * ④ 그 정렬에서 나머지 가로 이은은 전부 정상이다:
 *    `373 ↔ 286` = 37 · `287 ↔ 373` = 32 · `403 ↔ 316` = 27 · `317 ↔ 403` = 29 · `67 ↔ 346` = 21.
 * ⑤ **계단의 세로 반복은 결함이 아니다.** 자기 세로 이은은 84~90 이지만 그것은 발팜 단차의
 *    윬곽이고 사용자 정본 맵도 `376 ↓ 376` 을 16칸 쓴다. 단 285 와 맞닿는 옆면은 결함이었으니,
 *    285 가 사라지면 `373 → 375` = 55 · `377 → 403` = 50 으로 내려온다.
 */
export const MEASURED_CLIFF_FACTS = {
  topAndBaseAreOneWall: { identicalRows: 14, seam: 23 },
  oreRockBreaksTheWall: { seamBelow: 40, seamToStair: 77 },
  diagonalBaseNeedsSnow: { toWallBase: 172, toSnow: 21 },
} as const;

export const STAIRS = { left: 375, mid: 376, right: 377 } as const;
export const SUMMIT_PEAK = { left: 408, right: 409 } as const;
export const SNOW_DRAPE = { left: 237, mid: 238, right: 239 } as const;

/**
 * 9슬라이스 블록의 중심 타일. 나머지 여덟 조각은 여기서 계산한다.
 *
 * 부빙은 눈 블롭 313 이 아니라 **얼음판 70** 이다. 313 은 정본 의미표에서
 * `눈밭(설원 블롭)` 이고 중심 조각이 흰 사각형이라, 물 위에 놓으면 얼음판이 아니라
 * **구멍에 걸친 판자**로 읽혔다(실측 `tmp/ice-plain-render/01-pool-and-floe.png`).
 * 70 은 `얼음판` 이고 자체 9슬라이스 테두리가 있어 물 위에 뜬 판의 윤곽이 생긴다.
 */
export const BLOCK_BODY = { snow: 67, ice: 70 } as const;

/**
 * **이 맵에는 물을 놓지 않는다** — 감독 지시("물은 지우고, 얼음 말고").
 *
 * 1차 판은 남쪽 대평원에 어두운 못을 놓았다. 처음은 427(심연)이라 나락으로 보여
 * 깊은 물 120 으로 바꿨으나, 그럼에도 얼음 대평원에 맞지 않는다는 판정을 받았다.
 *
 * 물 생산 경로(못 타원 · 부빙 징검다리 · 부빙 섬)는 모듈에서 지웠다. 남쪽 대평원은
 * 눈밭이며 얼음 바닥 패치(`BLOCK_BODY.ice`)는 그대로 남아 있다.
 * 상수는 검사가 "이 맵에 물 타일이 한 칸도 없다"를 지킬 때 쓴다.
 *
 * 기족 타일 사실은 보존해 둔다 — 다시 물이 필요해지면 427 은 순검정이라 호수가 아니고,
 * 120→121→122 가 3fps 상용 스트립이며, 물 구역에는 9슬라이스 블록이 없다.
 */
export const BANNED_WATER_TILES = [120, 121, 122, 427] as const;


/**
 * **타일이 아니다 — 폭포 애니메이션 프레임이다. 맵에 한 칸도 놓지 않는다.**
 *
 * 125/155/185/215 는 결정시트 q7 에 "얼음 마법 블록"으로 적혀 있었고, 타일 그림판 한 행이
 * 30타일이라 네 값이 같은 열 연속 네 행이어서 세로 4칸 기둥으로 읽고 세워 렌더했다.
 * 상자 네 개가 포개진 그림이 나왔다(실측 `00-full.png`).
 *
 * 정체가 확인됐다: `chipsetAnimation.ts` 의 `WATERFALL_VERTICAL_STRIPS` 가
 * `{ baseTile: 125, frames: [125, 155, 185, 215] }` 로 등록한 **폭포 세로 4프레임 루프**다.
 * 즉 네 값은 서로 다른 블록이 아니라 한 칸의 시간축이다 — 세로로 쌓는 것 자체가 오독이었다.
 * 맵에는 베이스 125 한 칸만 놓을 수 있고, 그것도 폭포가 있을 때의 이야기다.
 *
 * 상수는 검사가 "이 맵에 폭포 프레임이 없다"를 지킬 때 쓴다.
 */
export const WATERFALL_FRAMES = [125, 155, 185, 215] as const;

/**
 * 대지 바닥에 흩는 ★ 소품. 전부 `priority === "upper"` + 통행 가능이라
 * `collision.ts:44` 가 하위 통행성을 그대로 쓴다 — 절벽에 얹어도 구멍이 안 뚫린다.
 * 그래도 이 맵은 **바닥 칸에만** 놓는다. 절벽면에 수정이 박혀 있으면 절벽으로 안 읽힌다.
 *
 * 얼음 블록 232 는 빼 두었다 — 회색 사선 사각형이라 눈밭 위에 뜬 스티커로 보인다
 * (실측 `00-full.png`). 얼음 바닥 패치 위에서 다시 시험할 재료다.
 */
/**
 * 대지 바닥에 흔는 ★ 소품. **발자국이 있는 재료는 한 벌 통째로 놓는다.**
 *
 * 이전 판은 이 목록을 1×1 타일 푸리벙으로 쓰거나 다섬 칸짜리 오프셋에 흔어서,
 * 여러 칸을 차지하는 재료가 조각만 남은 모여들이로 나왔다. 상유석이 세로로 길어보이는데
 * 한 칸만 놓여 있다는 감독 지적이 이것이다 — (35,16) 은 상위 타일 291 이었고,
 * 정본 의미표가 261/291 을 `회색 바위 첨탑(1×2)` 로 밝힌다.
 *
 * 실측 발자국(의미표 + 픽셀 이은):
 *   · 261 ↓ 291  — 회색 바위 첨탑 1×2, 이은 22
 *   · 320/321 ↓ 350/351 — 대형 수정 군집 2×2, 이은 8·29
 *   · 288 · 345  — 바위 첨탑 · 눈사람, 진짜 1×1
 * 315 는 소품이 아니다 — 의미표가 `푸른 광석 암반`(wall)이며 바닥 불통행 암반이다.
 */
export const FLOOR_PROP_SHAPES = [
  { id: "big-crystal", tiles: [[320, 321], [350, 351]], label: "대형 수정 군집(2×2)" },
  { id: "gray-spire", tiles: [[261], [291]], label: "회색 바위 첨탑(1×2)" },
  { id: "brown-spire", tiles: [[288]], label: "바위 첨탑(소형)" },
  { id: "snowman", tiles: [[345]], label: "눈사람" },
  { id: "crystal-pillar", tiles: [[119], [149]], label: "수정 기둥(1×2)" },
  { id: "blue-spire", tiles: [[262], [292]], label: "푸른 수정 첨탑(1×2)" },
  { id: "small-crystal", tiles: [[289]], label: "소형 수정 군집" },
  { id: "twin-crystal", tiles: [[413]], label: "쌍둥이 결정" },
  { id: "round-boulder", tiles: [[290]], label: "둥근 회색 바위" },
  { id: "gray-rock-pile", tiles: [[322, 323], [352, 353]], label: "회색 바위 더미(2×2)" },
  { id: "pebbles", tiles: [[382]], label: "회색 잔돌" },
] as const;

export type FloorPropShapeId = (typeof FLOOR_PROP_SHAPES)[number]["id"];

/** 팔레트 비율만 고정하고 위치·군집 모양은 밀도장에서 결정한다. */
export const FLOOR_PROP_COUNTS: Readonly<Record<FloorPropShapeId, number>> = {
  "big-crystal": 2,
  "gray-spire": 2,
  "brown-spire": 1,
  snowman: 1,
  "crystal-pillar": 6,
  "blue-spire": 7,
  "small-crystal": 9,
  "twin-crystal": 4,
  "round-boulder": 3,
  "gray-rock-pile": 1,
  pebbles: 2,
};

export const FLOOR_PROP_SCATTER_SEED = 20260730;
export const FLOOR_PROP_TARGET_COUNT = Object.values(FLOOR_PROP_COUNTS).reduce((sum, count) => sum + count, 0);

/** 소품에 쓰이는 모든 타일(★ 허용 목록). 발자국 모양은 `FLOOR_PROP_SHAPES` 가 가진다. */
export const FLOOR_PROPS: readonly number[] = FLOOR_PROP_SHAPES.flatMap((shape) => shape.tiles.flat());

/** 결정시트 q7 목록 중 이번 판에서 보류한 재료. 검사가 부재를 고정한다. */
export const DEFERRED_PROPS = [232, ...WATERFALL_FRAMES, SUMMIT_PEAK.left, SUMMIT_PEAK.right] as const;

/**
 * **절벽에 쓰면 안 되는 타일.** 343 은 정본 문법이 대각 몸통 위에 캡 대신 허용하지만
 * (`iceDiagonalTerrain.ts` LEFT/RIGHT_BODY_ABOVE), 실측 통행 표시가 `o` 다.
 * 절벽 상단에 얹으면 걸어 들어갈 구멍이 뚫린다(설산 60×60 3차 판에서 23칸 발생).
 *
 * 부빙이 얼음판 70 으로 바뀌면서 이 맵은 343 을 **한 칸도 쓰지 않는다**. 검사가 고정한다.
 */
/**
 * **절뱽 상단 칸 그 자심에는 343 을 쓰지 않는다.** 정본 뱙벽 밑법은 대각 몸통 위에
 * 캡 대신 343 을 허용하지만(`iceDiagonalTerrain.ts` LEFT/RIGHT_BODY_ABOVE) 통행 표시가 `o` 라,
 * 절뱽을 이룬 칸을 343 으로 바꾸면 거기로 걸어 들어갈 구멍이 뚫린다(설산 60×60 3차 판 23칸).
 *
 * 단 절뱽 상단 **바로 위 행**은 절뱽이 아니라 위 대지의 바닥이다 — 거긴 걸어다니는
 * 평지가 맞고, 거기에 343 을 깔라는 것이 감독 지시다(`CLIFF_LIP` 참조).
 */
export const FORBIDDEN_CLIFF_LIP = 343;

/**
 * 절뱽 상단 바로 위 행에 깔는 **평지 립** — 눈밭 블롭 하단 중앙 343.
 *
 * 감독 지시: "373 위를 평지로 하려면 343 을 배지해서 평지 느낌을 내줘야함".
 *
 * 실측이 지시를 뒷받침한다 — 절뱽 상단 위의 이은:
 *   · 97(눈 9슬라이스 남변) ↓ 373 = **173**  ← 1차 판. 눈밭 테두리가 벌 윗선과 부딪혔다.
 *   · 343 ↓ 373 = **38** · 343 ↓ 374 = 30 · 343 ↓ 372 = 42
 * 위에서 343 으로 들어오는 이은도 깨지지 않는다: `67 ↓ 343` = 2 · `97 ↓ 343` = 2.
 *
  // 대각 캡 위에는 놓지 않는다(`343 ↓ 286` = 168). 절벽 칸 자신은 건드리지 않으므로
 * 립은 하위 레이어에 깔리며 통행 가능하다(바닥이니 당연하다). 절뱽 칸은 건드리지 않으므로
 * 절뱽 관통은 여전히 0칸이고 검사가 그것을 직접 고정한다.
 */
export const CLIFF_LIP = 343;

export const CLIFF_TILES: readonly number[] = [
  CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right,
  CLIFF_BASE.left, CLIFF_BASE.mid, CLIFF_BASE.right,
  ICE_DIAGONAL_TILES.left.cap, ICE_DIAGONAL_TILES.left.body, ICE_DIAGONAL_TILES.left.base,
  ICE_DIAGONAL_TILES.right.cap, ICE_DIAGONAL_TILES.right.body, ICE_DIAGONAL_TILES.right.base,
];
export const STAIR_TILES: readonly number[] = [STAIRS.left, STAIRS.mid, STAIRS.right];

const W = ICE_PLAIN_WIDTH;
const H = ICE_PLAIN_HEIGHT;

/**
 * 시작 위치는 **어두운 못의 남안**이다. 처음 화면에 못과 부빙 징검다리가 함께 들어와야
 * 못이 장식이 아니라 건너야 하는 것으로 읽힌다.
 * (32,61) 로 잡았다가 실측에서 못 안이라 통행 불가로 나왔다 — 못 남쪽 한 행 아래로 내렸다.
 */
export const ICE_PLAIN_START = { x: 32, y: 62 } as const;
export const ICE_PLAIN_SUMMIT = { x: 32, y: 4 } as const;

/** 대지 하나. `floorFrom`~`floorTo` 는 걸을 수 있는 행 범위(닫힌 구간)다. */
export type Terrace = {
  readonly id: string;
  readonly floorFrom: number;
  readonly floorTo: number;
  /** 얼음 바닥 패치 중심. 남쪽 두 대지는 눈밭만 — 고도가 올라갈수록 얼음이 는다(q6). */
  readonly icePatches: readonly { readonly x: number; readonly y: number; readonly radius: number }[];
};

/**
 * 절벽 한 겹. 맵 폭 전체를 가로지른다.
 * `baseCrestY` 는 볏의 기준 행, `stairTargetX` 는 계단을 놓고 싶은 x
 * (평평한 구간을 찾아 가장 가까운 자리로 옮긴다).
 */
export type Band = {
  readonly id: string;
  readonly baseCrestY: number;
  readonly stairTargetX: number;
  /** 볏이 기준 행에서 벗어날 수 있는 최대 행수. `MAX_WOBBLE` 이하. */
  readonly wobble: 1 | 2;
  /** 수평 구간 길이 범위 `[최소, 최대]` — 겹마다 리듬을 다르게 해 줄무늬를 깬다. */
  readonly flatRun: readonly [number, number];
};

/**
 * 볏이 기준 행에서 벗어날 수 있는 최대 행수.
 * 겹 간격 13, 절벽 4행, 밑동 아래 지지 1행 → 겹이 먹는 높이 5행.
 * 위 겹이 최대로 내려오고 아래 겹이 최대로 올라가면 여유 13-5-2-2 = 4행. 안전하다.
 */
const MAX_WOBBLE = 2;

/** 대각 묶음의 최소 열 수. 한 열짜리 대각은 절벽 윗선의 흠집으로 읽힌다(설산 60×60 실측). */
const MIN_SLOPE_RUN = 2;

/** 계단 자리를 고를 때 평평한 구간이 계단보다 이만큼은 더 넓어야 한다. */
const STAIR_MARGIN = 1;

export const BANDS: readonly Band[] = [
  { id: "a-plain-rim", baseCrestY: 48, stairTargetX: 38, wobble: 2, flatRun: [9, 15] },
  { id: "b-lower-step", baseCrestY: 35, stairTargetX: 17, wobble: 2, flatRun: [6, 11] },
  { id: "c-mid-step", baseCrestY: 22, stairTargetX: 45, wobble: 2, flatRun: [8, 14] },
  { id: "d-summit-rim", baseCrestY: 9, stairTargetX: 26, wobble: 2, flatRun: [10, 16] },
];

export const TERRACES: readonly Terrace[] = [
  // 남쪽 대평원은 못 대신 얼음 바닥 두 장을 갖는다 — 시작 지점 (32,62) 에서 보이는 자리다.
  { id: "t0-great-plain", floorFrom: 52, floorTo: 63, icePatches: [{ x: 25, y: 58, radius: 5 }, { x: 41, y: 57, radius: 4 }] },
  { id: "t1-lower", floorFrom: 39, floorTo: 47, icePatches: [{ x: 48, y: 44, radius: 4 }] },
  { id: "t2-mid", floorFrom: 26, floorTo: 34, icePatches: [{ x: 14, y: 30, radius: 5 }, { x: 47, y: 30, radius: 4 }] },
  { id: "t3-upper", floorFrom: 13, floorTo: 21, icePatches: [{ x: 31, y: 17, radius: 6 }] },
  { id: "t4-summit", floorFrom: 1, floorTo: 8, icePatches: [{ x: 32, y: 5, radius: 8 }] },
];

/**
 * **원경 봉우리는 이 맵에도 넣지 않는다.** 정상 대지 뒤(y1~2)에 좌우 한 벌씩 일곱 개를
 * 세워 렌더해 봤고 버렸다 — 설산 60×60 에서 버린 것과 **같은 이유로 같은 그림**이 나왔다.
 * 408/409 는 16px 검은 윤곽선뿐이라 흰 눈밭 위에서는 봉우리가 아니라 흩뿌린
 * **갈매기표(∧ ∧ ∧)** 로 읽힌다(실측: `tmp/ice-plain-render/00-full.png` 최상단).
 *
 * 감독 자유서술("408 409 는 '높이' 를 표현하는 데 쓰일 수 있음")은 유효하지만, 그러려면
 * 봉우리가 **무언가에 얹혀** 있어야 한다 — 눈밭 위에 그냥 서면 배경이 안 된다.
 * 얹을 대상(원경 능선 띠)을 먼저 만들어야 하므로 이번 판에서는 빈다.
 *
 * 상수는 검사가 "이 맵에 봉우리가 없다"를 지킬 때 쓰고, 되살릴 자리를 명시해 둔다.
 */
export const PEAK_PAIR_ORIGINS: readonly (readonly [number, number])[] = [];

function idx(x: number, y: number): number {
  return y * W + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < W && y < H;
}

/** 결정적 잡음. 난수를 쓰면 빌드마다 맵이 바뀌어 스크린샷 회귀가 불가능해진다. */
function noise(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 3×3 블록에서 이 칸이 쓸 조각. **모든 면 재료가 이 함수만 통과한다** — 결함 ②의 재발 방지.
 * 타일 그림판 한 행이 30타일이라 body 기준 오프셋은 NW -31 · N -30 · NE -29 · W -1 · E +1 ·
 * SW +29 · S +30 · SE +31 이다(눈 67 → 36/37/38/66/68/96/97/98 로 실측 확인).
 *
 * 이 타일 그림판 블록에는 안쪽 코너 조각이 없다(`dungeonTerrainBlockRoles()` 의 corners/inner 가
 * 비어 있다). 그래서 RM2K3 관례대로 바깥 테두리 여덟 조각 + 중심만 쓴다.
 */
export function blockTile(body: number, north: boolean, south: boolean, west: boolean, east: boolean): number {
  if (!north && !west) return body - CHIPSET_ROW - 1;
  if (!north && !east) return body - CHIPSET_ROW + 1;
  if (!south && !west) return body + CHIPSET_ROW - 1;
  if (!south && !east) return body + CHIPSET_ROW + 1;
  if (!west) return body - 1;
  if (!east) return body + 1;
  if (!north) return body - CHIPSET_ROW;
  if (!south) return body + CHIPSET_ROW;
  return body;
}

function paintBlock(lower: number[], mask: Uint8Array, body: number): void {
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const cell = idx(x, y);
    if (mask[cell] !== 1) continue;
    // 맵 밖은 "같은 재료가 이어진다"로 본다 — 가장자리에 쓸데없는 테두리를 두르지 않는다
    // (감독 지적: "외곽을 둘러싸고 있는 것들은 왜 만든건지도 모르겠고").
    const north = y === 0 || mask[cell - W] === 1;
    const south = y === H - 1 || mask[cell + W] === 1;
    const west = x === 0 || mask[cell - 1] === 1;
    const east = x === W - 1 || mask[cell + 1] === 1;
    lower[cell] = blockTile(body, north, south, west, east);
  }
}

/** 이 열이 평평한 구간인지, 대각이면 어느 면인지. */
export type Face = "flat" | "left" | "right";

export type BandProfile = {
  readonly crestY: readonly number[];
  readonly face: readonly Face[];
};

const PROFILE_CACHE = new Map<string, BandProfile>();

/**
 * 겹의 볏 프로필. **"수평으로 한참 가다가 대각으로 두어 칸 꺾이고 다시 수평"** 을 구간으로 엮는다.
 * 파동을 열마다 반올림하면 능선이 톱니가 되고 수평 절벽의 덩어리가 사라진다(설산 60×60 2차 실측).
 *
 * 대각 묶음은 **한 방향으로만** 흐르고 사이에 반드시 긴 수평 구간이 들어간다.
 * 그래서 정본 금지 배치(`left-cap-north-east-right-cap` / `right-cap-north-west-left-cap`)를
 * 만드는 **한 열짜리 골짜기**가 구성상 생기지 않는다 — 캡을 쓸 수 있는 이유다.
 */
export function bandProfile(band: Band): BandProfile {
  const cached = PROFILE_CACHE.get(band.id);
  if (cached !== undefined) return cached;
  const bandIndex = BANDS.findIndex((candidate) => candidate.id === band.id);
  const crestY = new Array<number>(W).fill(band.baseCrestY);
  const face = new Array<Face>(W).fill("flat");

  let x = 0;
  let offset = 0;
  let segment = 0;
  // 겹마다 첫 방향을 뒤집어 위아래 겹의 꺾임이 같은 자리에 겹치지 않게 한다.
  let direction = bandIndex % 2 === 0 ? -1 : 1;

  const [flatMin, flatMax] = band.flatRun;
  const wobble = Math.min(band.wobble, MAX_WOBBLE);

  while (x < W) {
    const flatRun = flatMin + Math.floor(noise(bandIndex, segment) * (flatMax - flatMin + 1));
    for (let step = 0; step < flatRun && x < W; step += 1, x += 1) {
      crestY[x] = band.baseCrestY + offset;
      face[x] = "flat";
    }
    // 맵 끝에 대각을 반쯤 걸치면 한 열짜리 대각이 남는다 — 윗선의 흠집으로 읽힌다.
    if (W - x < MIN_SLOPE_RUN) {
      for (; x < W; x += 1) {
        crestY[x] = band.baseCrestY + offset;
        face[x] = "flat";
      }
      break;
    }

    let room = direction < 0 ? offset + wobble : wobble - offset;
    if (room < MIN_SLOPE_RUN) {
      direction = -direction;
      room = direction < 0 ? offset + wobble : wobble - offset;
    }
    const slopeRun = Math.min(MIN_SLOPE_RUN + Math.floor(noise(bandIndex, segment + 977) * 2), room);
    for (let step = 0; step < slopeRun && x < W; step += 1, x += 1) {
      offset += direction;
      crestY[x] = band.baseCrestY + offset;
      // 볏이 오른쪽으로 갈수록 올라가면(y 감소) 정본 face 는 "right" 다
      // (`CANONICAL_RIDGE_OFFSETS` 의 x=0..2 가 topY 5→3 이고 face="right").
      face[x] = direction < 0 ? "right" : "left";
    }
    direction = -direction;
    segment += 1;
  }

  const profile: BandProfile = { crestY, face };
  PROFILE_CACHE.set(band.id, profile);
  return profile;
}

/** 겹의 평평한 구간들 — `[from, to]` 닫힌 구간, 볏 행이 하나로 일정한 최대 구간. */
export function flatRuns(band: Band): readonly { readonly from: number; readonly to: number; readonly crestY: number }[] {
  const profile = bandProfile(band);
  const runs: { from: number; to: number; crestY: number }[] = [];
  let start = -1;
  for (let x = 0; x <= W; x += 1) {
    const flat = x < W && profile.face[x] === "flat";
    if (flat && start === -1) start = x;
    if (!flat && start !== -1) {
      const crest = profile.crestY[start];
      if (crest !== undefined) runs.push({ from: start, to: x - 1, crestY: crest });
      start = -1;
    }
  }
  return runs;
}

export type StairBlock = {
  readonly bandId: string;
  readonly fromX: number;
  readonly crestY: number;
};

/**
 * 겹마다 계단 한 덩어리. 감독 지시 — 계단은 **직사각형**이라 평평한 구간 안에만 놓을 수 있고
 * 삐뚤빼뚤할 수 없다. 목표 x 에 중심이 가장 가까운 구간을 골라 그 안에서 목표 x 쪽으로 붙인다.
 */
export function stairBlocks(): readonly StairBlock[] {
  const blocks: StairBlock[] = [];
  for (const band of BANDS) {
    const usable = flatRuns(band).filter((run) => run.to - run.from + 1 >= STAIR_WIDTH + STAIR_MARGIN * 2);
    if (usable.length === 0) throw new Error(`얼음 대평원 64×64: ${band.id} 에 계단을 놓을 평평한 구간이 없다`);
    const chosen = usable.reduce((best, run) => {
      const centre = (run.from + run.to) / 2;
      return Math.abs(centre - band.stairTargetX) < Math.abs((best.from + best.to) / 2 - band.stairTargetX) ? run : best;
    });
    const lowest = chosen.from + STAIR_MARGIN;
    const highest = chosen.to - STAIR_MARGIN - (STAIR_WIDTH - 1);
    const fromX = Math.min(Math.max(band.stairTargetX - Math.floor(STAIR_WIDTH / 2), lowest), highest);
    blocks.push({ bandId: band.id, fromX, crestY: chosen.crestY });
  }
  return blocks;
}

/** 계단 덩어리 안에서 이 열이 쓸 타일. 왼쪽 끝 375 · 가운데 376 반복 · 오른쪽 끝 377. */
function stairTileAt(offset: number): number {
  if (offset === 0) return STAIRS.left;
  if (offset === STAIR_WIDTH - 1) return STAIRS.right;
  return STAIRS.mid;
}

export type IcePlainTerrain = {
  readonly width: typeof ICE_PLAIN_WIDTH;
  readonly height: typeof ICE_PLAIN_HEIGHT;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly cliffMask: Uint8Array;
  readonly stairMask: Uint8Array;
  readonly iceMask: Uint8Array;
  readonly diagonalColumns: readonly IceDiagonalColumn[];
  readonly stairs: readonly StairBlock[];
  readonly horizontalCliffCells: number;
};

/** 얼음 패치를 절벽에서 떼어낸다. 대각 밑동 아래 지지 행이 눈이어야 하기 때문이다. */
function erodeAwayFromCliff(mask: Uint8Array, cliff: Uint8Array, clearance: number): void {
  const doomed: number[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (mask[idx(x, y)] !== 1) continue;
    let tooClose = false;
    for (let dy = -clearance; dy <= clearance && !tooClose; dy += 1) {
      for (let dx = -clearance; dx <= clearance; dx += 1) {
        if (!inBounds(x + dx, y + dy)) continue;
        if (cliff[idx(x + dx, y + dy)] === 1) { tooClose = true; break; }
      }
    }
    if (tooClose) doomed.push(idx(x, y));
  }
  for (const cell of doomed) mask[cell] = 0;
}

export function buildIcePlainTerrain(): IcePlainTerrain {
  const lower = new Array<number>(W * H).fill(BLOCK_BODY.snow);
  const upper = new Array<number>(W * H).fill(-1);
  const cliffMask = new Uint8Array(W * H);
  const stairMask = new Uint8Array(W * H);
  const iceMask = new Uint8Array(W * H);
  const diagonalColumns: IceDiagonalColumn[] = [];
  let horizontalCliffCells = 0;

  // ── ① 계단 칸 예약. 절벽을 찍고 덮어쓰면 이음매가 틀어진다.
  // 계단이 끊어야 하는 것은 **벽인 두 행**이다 — 겹의 세 번째 행은 어차피 눈 바닥이다.
  const stairs = stairBlocks();
  const stairCells = new Set<number>();
  for (const block of stairs) {
    for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
      for (let step = 0; step < CLIFF_WALL_ROWS; step += 1) {
        stairCells.add(idx(block.fromX + offset, block.crestY + step));
      }
    }
  }

  // ── ② 절벽 네 겹. 수평은 바로 찍고, 대각은 기둥으로 모아 뒤에 찍는다.
  for (const band of BANDS) {
    const profile = bandProfile(band);
    for (let x = 0; x < W; x += 1) {
      const crest = profile.crestY[x];
      if (crest === undefined || crest < 2 || crest + CLIFF_HEIGHT >= H) continue;
      if (stairCells.has(idx(x, crest))) continue;
      if (profile.face[x] === "flat") {
        // 끝 조각 372/374 · 402/404 는 **맵 가장자리에서만** 쓴다.
        // 대각과 만나는 자리에 끝 조각을 쓰면 윗선에 직각 턱이 생겨 대각이 떨어져 보인다
        // (실측: `373 ↔ 286` = 37 인데 `374 ↔ 286` = 49 로 오히려 나빠진다).
        const top = x === 0 ? CLIFF_TOP.left : x === W - 1 ? CLIFF_TOP.right : CLIFF_TOP.mid;
        const base = x === 0 ? CLIFF_BASE.left : x === W - 1 ? CLIFF_BASE.right : CLIFF_BASE.mid;
        // 벽은 두 행이다 — 상단 373 위에 밑동 403. 둘은 같은 그림의 상하 한 벌이다.
        // 세 번째 행은 벽이 아니라 눈 바닥이며, 그 자리가 대각 밑동이 요구하는 지지 행과 같다.
        lower[idx(x, crest)] = top;
        lower[idx(x, crest + 1)] = base;
        for (let step = 0; step < CLIFF_WALL_ROWS; step += 1) cliffMask[idx(x, crest + step)] = 1;
        horizontalCliffCells += CLIFF_WALL_ROWS;
        continue;
      }
      // 대각 기둥의 세로 자리는 **면마다 다르다**. 쿠와 밑동은 방향이 있는 조각이고,
      // 그 방향이 벽이 붙는 쪽과 맞지 않으면 이은이 통째로 깨진다(실측):
      //
      //   왼쿠 286 :  `373 → 286` = 37   벽이 오른윽이면 `286 → 373` = **161**
      //   오른쿠 287 : `287 → 373` = 32   벽이 왼쪽이면 `373 → 287` = **145**
      //   왼밑 346 :  `346 → 403` = 8    벽이 왼쪽이면 `403 → 346` = **156**
      //   오른밑 347 : `347 → 67`  = 21   벽과 맞닿으면 `347 → 403` = **172**
      //
      // 몸통은 방향이 없다 — `316 ↔ 373` = 0/27 · `317 ↔ 373` = 29/33 으로 양쪽 다 이어진다.
      // 그래서 면별로 **방향이 맞는 행**에 쿠와 밑동을 놓는다:
      //   왼면은 한 행 올리면 몸통이 벽 상단에 오고 밑동 346 은 밑동 행에 맞닿는다(8).
      //   오른면은 그대로 다 — 쿠 287 이 벽 상단에 나란하고(32) 밑동 347 은 눈 행으로 내려간다(21).
      const face = profile.face[x] as "left" | "right";
      const topY = face === "left" ? crest - 1 : crest;
      diagonalColumns.push({ x, topY, bottomY: topY + CLIFF_HEIGHT - 1, face });
    }
  }

  for (const column of diagonalColumns) {
    const tiles = ICE_DIAGONAL_TILES[column.face];
    for (let y = column.topY; y <= column.bottomY; y += 1) {
      const tile = y === column.topY ? tiles.cap : y === column.bottomY ? tiles.base : tiles.body;
      lower[idx(column.x, y)] = tile;
      cliffMask[idx(column.x, y)] = 1;
    }
  }

  // ── ③ 얼음 바닥 패치. 절벽에서 떼어낸다 — 대각 밑동 아래 지지 행은 눈이어야 한다.
  // 물은 놓지 않는다(감독 지시) — 남쪽 대평원도 못 대신 얼음 패치만 갖는다.
  for (const terrace of TERRACES) {
    for (const patch of terrace.icePatches) {
      for (let y = patch.y - patch.radius; y <= patch.y + patch.radius; y += 1) {
        for (let x = patch.x - patch.radius * 2; x <= patch.x + patch.radius * 2; x += 1) {
          if (!inBounds(x, y) || y < terrace.floorFrom || y > terrace.floorTo) continue;
          if (cliffMask[idx(x, y)] === 1 || stairCells.has(idx(x, y))) continue;
          const dx = (x - patch.x) / (patch.radius * 2);
          const dy = (y - patch.y) / patch.radius;
          if (dx * dx + dy * dy <= 1 - 0.15 + noise(x * 7, y * 13) * 0.28) iceMask[idx(x, y)] = 1;
        }
      }
    }
  }
  erodeAwayFromCliff(iceMask, cliffMask, 2);

  // ── ④ 면 재료. 모든 블록이  한 곳만 통과한다(9슬라이스 위반 재발 방지).
  const snowMask = new Uint8Array(W * H);
  for (let cell = 0; cell < snowMask.length; cell += 1) {
    if (cliffMask[cell] === 1 || stairCells.has(cell)) continue;
    snowMask[cell] = 1;
  }
  paintBlock(lower, snowMask, BLOCK_BODY.snow);
  paintBlock(lower, iceMask, BLOCK_BODY.ice);

  // ── ⑤ 평지 립. 절벽 상단 **바로 위 행**을 343 으로 바꿔 위 대지가 평지로 읽히게 한다.
  // 눈밭 9슬라이스가 깔던 97(남쪽 변)은 벽 윗선과 `97 ↓ 373` = 173 으로 부딪혔다.
  // 343 은 `343 ↓ 373` = 38 이고 위에서 들어오는 이음도 `67 ↓ 343` = 2 로 깨지지 않는다.
  // 대각 캡 위에는 놓지 않는다(`343 ↓ 286` = 168). 절벽 칸 자신은 건드리지 않으므로
  // 절벽 관통은 여전히 0칸이다.
  const cliffTops = new Set<number>([CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right]);
  for (let y = 1; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!cliffTops.has(lower[idx(x, y)] ?? -1)) continue;
    const lip = idx(x, y - 1);
    if (cliffMask[lip] === 1 || stairCells.has(lip)) continue;
    lower[lip] = CLIFF_LIP;
    iceMask[lip] = 0;
  }

  // ── ⑥ 계단. 벽인 두 행을 끊어야 아래 대지와 위 대지가 이어진다.
  // 세 번째 행은 이미 눈 바닥이니 계단을 깔지 않는다 — `377 ↓ 67` = 96 으로 끊기기 만하고,
  // 거기에 계단이 한 행 더 있으면 계단이 대지 바닥으로 흘러나와 보인다.
  for (const block of stairs) {
    for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
      const tile = stairTileAt(offset);
      for (let step = 0; step < CLIFF_WALL_ROWS; step += 1) {
        const cell = idx(block.fromX + offset, block.crestY + step);
        lower[cell] = tile;
        stairMask[cell] = 1;
        cliffMask[cell] = 0;
      }
    }
  }

  // ── ⑦ 정본 검증. 문법 준수를 주장하지 않고 검증기에 물어본다.
  const issues = validateIceDiagonalTerrain({ width: W, height: H, lower });
  if (issues.length > 0) {
    const summary = issues.slice(0, 8).map((issue) => `${issue.code}@${issue.x},${issue.y}=${issue.actual}`).join(" · ");
    throw new Error(`얼음 대평원 64×64 대각 빙벽 정본 검증 실패: ${summary}`);
  }

  // ── ⑧ 상위 레이어. `safeUpper` 가 유일한 출입구다(결함 ① 재발 방지).
  const stars = new Set<number>([...FLOOR_PROPS, SUMMIT_PEAK.left, SUMMIT_PEAK.right, SNOW_DRAPE.left, SNOW_DRAPE.mid, SNOW_DRAPE.right]);
  const safeUpper = (x: number, y: number, tile: number): boolean => {
    if (!inBounds(x, y)) return false;
    // ★ 가 아닌 타일을 절벽·못 칸에 얹으면 상위 통행성이 하위를 덮어쓴다 — 큰 맵의 427칸 버그.
    if (!stars.has(tile)) return false;
    if ((upper[idx(x, y)] ?? -1) !== -1) return false;
    upper[idx(x, y)] = tile;
    return true;
  };

  paintSnowDrapes(lower, cliffMask, safeUpper);
  paintFloorProps({
    cliffMask,
    stairMask,
    iceMask,
    upperTaken: (x, y) => (upper[idx(x, y)] ?? -1) !== -1,
    safeUpper,
  });

  return {
    width: ICE_PLAIN_WIDTH,
    height: ICE_PLAIN_HEIGHT,
    lowerTiles: lower,
    upperTiles: upper,
    cliffMask,
    stairMask,
    iceMask,
    diagonalColumns,
    stairs,
    horizontalCliffCells,
  };
}

/**
 * 눈처짐 237/238/239 (★) — 절벽 상단 행에 세 칸 원자로 얹는다(q6 "눈처짐").
 * 절벽 위에 눈이 얹혀 처져 있으면 그 선이 **위쪽 면**이라는 것이 읽힌다.
 * 세 칸이 한 벌이라 하나만 놓이면 잘린 조각이 되므로 원자 배치한다.
 */
function paintSnowDrapes(lower: readonly number[], cliffMask: Uint8Array, safeUpper: (x: number, y: number, tile: number) => boolean): void {
  const tops = new Set<number>([CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right]);
  for (let y = 0; y < H; y += 1) {
    let x = 0;
    while (x + 2 < W) {
      const runIsTop = [0, 1, 2].every((offset) => {
        const cell = idx(x + offset, y);
        return cliffMask[cell] === 1 && tops.has(lower[cell] ?? -1);
      });
      if (!runIsTop || noise(x * 31, y * 17) > 0.10) { x += 1; continue; }
      const placed = safeUpper(x, y, SNOW_DRAPE.left) && safeUpper(x + 1, y, SNOW_DRAPE.mid) && safeUpper(x + 2, y, SNOW_DRAPE.right);
      x += placed ? 11 : 1;
    }
  }
}

/**
 * 밀도장 + 서식 적합도 + 확률적 군집 + 가변 반경으로 38개 소품을 산포한다.
 * 고정 앵커·고정 shape 순서·최근접 빈칸 채우기를 쓰지 않는다.
 */
function paintFloorProps(input: {
  readonly cliffMask: Uint8Array;
  readonly stairMask: Uint8Array;
  readonly iceMask: Uint8Array;
  readonly upperTaken: (x: number, y: number) => boolean;
  readonly safeUpper: (x: number, y: number, tile: number) => boolean;
}): void {
  type Shape = (typeof FLOOR_PROP_SHAPES)[number];
  type Family = "crystal" | "rock" | "rare";
  type Placed = { readonly family: Family; readonly radius: number; readonly shape: Shape; readonly x: number; readonly y: number; readonly cx: number; readonly cy: number };

  const reserved = floorPropReservedMask(stairBlocks());
  const iceDistance = maskDistanceField(input.iceMask);
  const cliffDistance = maskDistanceField(input.cliffMask);
  const placed: Placed[] = [];
  const requests = FLOOR_PROP_SHAPES.flatMap((shape) =>
    Array.from({ length: FLOOR_PROP_COUNTS[shape.id] }, (_, copy) => ({ shape, copy })),
  ).sort((a, b) => {
    const aArea = a.shape.tiles.length * a.shape.tiles[0]!.length;
    const bArea = b.shape.tiles.length * b.shape.tiles[0]!.length;
    if (aArea !== bArea) return bArea - aArea;
    const aKey = noise(floorPropIdSalt(a.shape.id), a.copy + FLOOR_PROP_SCATTER_SEED);
    const bKey = noise(floorPropIdSalt(b.shape.id), b.copy + FLOOR_PROP_SCATTER_SEED);
    return aKey - bKey;
  });

  const free = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const cell = idx(x, y);
    return reserved[cell] !== 1
      && input.cliffMask[cell] !== 1
      && input.stairMask[cell] !== 1
      && !input.upperTaken(x, y);
  };

  for (let requestIndex = 0; requestIndex < requests.length; requestIndex += 1) {
    const request = requests[requestIndex]!;
    const shape = request.shape;
    const family = floorPropFamily(shape.id);
    const rows = shape.tiles.length;
    const cols = shape.tiles[0]!.length;
    const radius = 0.78 + Math.max(rows, cols) * 0.46;
    let chosen: { x: number; y: number; cx: number; cy: number } | null = null;

    for (let relaxation = 0; relaxation <= 2 && chosen === null; relaxation += 1) {
      let bestKey = Number.POSITIVE_INFINITY;
      for (let terraceIndex = 0; terraceIndex < TERRACES.length; terraceIndex += 1) {
        const terrace = TERRACES[terraceIndex]!;
        for (let y = terrace.floorFrom + 1; y + rows - 1 <= terrace.floorTo - 1; y += 1) {
          for (let x = 2; x + cols <= W - 2; x += 1) {
            let fits = true;
            for (let row = 0; row < rows && fits; row += 1) for (let col = 0; col < cols; col += 1) {
              if (!free(x + col, y + row)) { fits = false; break; }
            }
            if (!fits) continue;

            const cx = x + (cols - 1) / 2;
            const cy = y + (rows - 1) / 2;
            const spacingScale = relaxation === 0 ? 1 : relaxation === 1 ? 0.82 : 0.68;
            if (placed.some((other) => {
              const jitter = 0.88 + noise(x * 43 + other.x, y * 47 + other.y) * 0.24;
              return Math.hypot(cx - other.cx, cy - other.cy) < (radius + other.radius) * 0.72 * spacingScale * jitter;
            })) continue;

            const local = placed.filter((other) => Math.hypot(cx - other.cx, cy - other.cy) <= 6.5);
            const sameFamily = local.filter((other) => other.family === family);
            if (local.length >= (relaxation === 0 ? 5 : relaxation === 1 ? 7 : 9)) continue;
            if (sameFamily.length >= (relaxation === 0 ? 4 : relaxation === 1 ? 6 : 8)) continue;
            if (relaxation === 0) {
              const rowAligned = placed.filter((other) => Math.abs(other.cy - cy) < 0.01 && Math.abs(other.cx - cx) <= 12).length;
              const colAligned = placed.filter((other) => Math.abs(other.cx - cx) < 0.01 && Math.abs(other.cy - cy) <= 12).length;
              if (rowAligned >= 2 || colAligned >= 2) continue;
            }

            const cell = idx(Math.round(cx), Math.round(cy));
            const habitat = floorPropHabitatScore({
              family,
              shapeId: shape.id,
              terraceIndex,
              x: cx,
              y: cy,
              iceDistance: iceDistance[cell] ?? 99,
              cliffDistance: cliffDistance[cell] ?? 99,
            });
            if (habitat <= 0) continue;
            const macro = 0.32 + 0.68 * floorPropFbm(cx, cy, family === "crystal" ? 101 : family === "rock" ? 211 : 307);
            const nearestSame = placed.reduce((best, other) => other.family === family ? Math.min(best, Math.hypot(cx - other.cx, cy - other.cy)) : best, Number.POSITIVE_INFINITY);
            const cluster = !Number.isFinite(nearestSame) ? 1
              : nearestSame <= 4.5 ? 1.55
                : nearestSame <= 8 ? 1.2
                  : 0.82;
            const crowding = 1 / (1 + sameFamily.length * sameFamily.length * 0.2);
            const score = habitat * macro * cluster * crowding;
            const u = Math.max(0.000001, noise(
              x * 193 + requestIndex * 997 + floorPropIdSalt(shape.id),
              y * 389 + request.copy * 571 + FLOOR_PROP_SCATTER_SEED,
            ));
            const key = -Math.log(u) / Math.max(score, 0.000001);
            if (key < bestKey) {
              bestKey = key;
              chosen = { x, y, cx, cy };
            }
          }
        }
      }
    }

    if (!chosen) throw new Error(`얼음 대평원 64×64: 자연 산포 중 ${shape.id} 배치 실패`);
    for (let row = 0; row < rows; row += 1) {
      const tileRow = shape.tiles[row]!;
      for (let col = 0; col < tileRow.length; col += 1) {
        if (!input.safeUpper(chosen.x + col, chosen.y + row, tileRow[col]!)) {
          throw new Error(`얼음 대평원 64×64: ${shape.id} ${chosen.x},${chosen.y} 원자 배치 실패`);
        }
      }
    }
    placed.push({ family, radius, shape, ...chosen });
  }

  if (placed.length !== FLOOR_PROP_TARGET_COUNT) {
    throw new Error(`얼음 대평원 64×64: 바닥 소품 ${FLOOR_PROP_TARGET_COUNT}개 중 ${placed.length}개만 배치`);
  }
}

function floorPropFamily(id: FloorPropShapeId): "crystal" | "rock" | "rare" {
  if (id === "big-crystal" || id === "crystal-pillar" || id === "blue-spire" || id === "small-crystal" || id === "twin-crystal") return "crystal";
  if (id === "snowman") return "rare";
  return "rock";
}

function floorPropIdSalt(id: FloorPropShapeId): number {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  return value | 0;
}

function floorPropValueNoise(x: number, y: number, scale: number, salt: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const tx0 = x / scale - gx;
  const ty0 = y / scale - gy;
  const tx = tx0 * tx0 * (3 - 2 * tx0);
  const ty = ty0 * ty0 * (3 - 2 * ty0);
  const sample = (dx: number, dy: number): number => noise((gx + dx) * 1619 + salt * 313, (gy + dy) * 6971 - salt * 1013);
  const north = sample(0, 0) * (1 - tx) + sample(1, 0) * tx;
  const south = sample(0, 1) * (1 - tx) + sample(1, 1) * tx;
  return north * (1 - ty) + south * ty;
}

function floorPropFbm(x: number, y: number, salt: number): number {
  return floorPropValueNoise(x, y, 15, salt) * 0.5
    + floorPropValueNoise(x, y, 7, salt + 17) * 0.32
    + floorPropValueNoise(x, y, 3, salt + 41) * 0.18;
}

function floorPropHabitatScore(input: {
  readonly family: "crystal" | "rock" | "rare";
  readonly shapeId: FloorPropShapeId;
  readonly terraceIndex: number;
  readonly x: number;
  readonly y: number;
  readonly iceDistance: number;
  readonly cliffDistance: number;
}): number {
  if (input.family === "crystal") {
    const elevation = 0.5 + input.terraceIndex * 0.16;
    const iceEdge = input.iceDistance <= 4
      ? 1.5 - Math.abs(input.iceDistance - 1.5) * 0.16
      : Math.max(0.34, 0.95 - (input.iceDistance - 4) * 0.07);
    const cliffSafety = input.cliffDistance < 1.5 ? 0.5 : 1;
    const largePenalty = input.shapeId === "big-crystal" && input.terraceIndex < 2 ? 0.35 : 1;
    return elevation * iceEdge * cliffSafety * largePenalty;
  }
  if (input.family === "rock") {
    const elevation = 1.08 - input.terraceIndex * 0.1;
    const cliffAffinity = 0.62 + Math.exp(-Math.abs(input.cliffDistance - 3) / 3) * 0.7;
    const icePenalty = input.iceDistance < 0.5 ? 0.62 : 1;
    return elevation * cliffAffinity * icePenalty;
  }
  if (input.terraceIndex > 1 || input.iceDistance < 2 || input.cliffDistance < 2.5) return 0;
  return 0.75 + floorPropFbm(input.x, input.y, 401) * 0.5;
}

function maskDistanceField(mask: Uint8Array): Float64Array {
  const occupied: { x: number; y: number }[] = [];
  for (let cell = 0; cell < mask.length; cell += 1) if (mask[cell] === 1) occupied.push({ x: cell % W, y: Math.floor(cell / W) });
  const result = new Float64Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    let best = Number.POSITIVE_INFINITY;
    for (const point of occupied) {
      const dx = x - point.x;
      const dy = y - point.y;
      best = Math.min(best, dx * dx + dy * dy);
    }
    result[idx(x, y)] = Math.sqrt(best);
  }
  return result;
}

/** 시작·정상·계단과 각 대지의 지그재그 주동선을 소품 금지 마스크로 만든다. */
function floorPropReservedMask(stairs: readonly StairBlock[]): Uint8Array {
  const mask = new Uint8Array(W * H);
  const mark = (x: number, y: number): void => { if (inBounds(x, y)) mask[idx(x, y)] = 1; };
  const brush = (x: number, y: number, radius: number): void => {
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) mark(x + dx, y + dy);
  };
  const segment = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
    let x = from.x;
    let y = from.y;
    brush(x, y, 2);
    while (x !== to.x) { x += Math.sign(to.x - x); brush(x, y, 2); }
    while (y !== to.y) { y += Math.sign(to.y - y); brush(x, y, 2); }
  };
  const route = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
    const midY = Math.round((from.y + to.y) / 2);
    segment(from, { x: from.x, y: midY });
    segment({ x: from.x, y: midY }, { x: to.x, y: midY });
    segment({ x: to.x, y: midY }, to);
  };

  for (let y = ICE_PLAIN_START.y - 2; y <= ICE_PLAIN_START.y + 2; y += 1) {
    for (let x = ICE_PLAIN_START.x - 2; x <= ICE_PLAIN_START.x + 2; x += 1) mark(x, y);
  }
  for (let y = ICE_PLAIN_SUMMIT.y - 2; y <= ICE_PLAIN_SUMMIT.y + 2; y += 1) {
    for (let x = ICE_PLAIN_SUMMIT.x - 3; x <= ICE_PLAIN_SUMMIT.x + 3; x += 1) mark(x, y);
  }
  for (const stair of stairs) {
    for (let y = stair.crestY - 2; y <= stair.crestY + CLIFF_WALL_ROWS + 1; y += 1) {
      for (let x = stair.fromX - 2; x <= stair.fromX + STAIR_WIDTH + 1; x += 1) mark(x, y);
    }
  }

  const stairX = stairs.map((stair) => stair.fromX + 1);
  if (stairX.length !== 4) throw new Error("얼음 대평원 64×64: 주동선에는 계단 네 덩어리가 필요하다");
  route(ICE_PLAIN_START, { x: stairX[0]!, y: TERRACES[0]!.floorFrom });
  route({ x: stairX[0]!, y: TERRACES[1]!.floorTo }, { x: stairX[1]!, y: TERRACES[1]!.floorFrom });
  route({ x: stairX[1]!, y: TERRACES[2]!.floorTo }, { x: stairX[2]!, y: TERRACES[2]!.floorFrom });
  route({ x: stairX[2]!, y: TERRACES[3]!.floorTo }, { x: stairX[3]!, y: TERRACES[3]!.floorFrom });
  route({ x: stairX[3]!, y: TERRACES[4]!.floorTo }, ICE_PLAIN_SUMMIT);
  return mask;
}

export const ICE_PLAIN_MAP_ID = "map_ice_grand_plain_64";
export const ICE_PLAIN_MAP_NAME = "얼음 대평원 · 절벽과 계단 (64×64)";

export function buildIcePlainMap(reference: { readonly tilesetId: string; readonly tileSize: number }): GameMap {
  const terrain = buildIcePlainTerrain();
  return {
    id: ICE_PLAIN_MAP_ID,
    name: ICE_PLAIN_MAP_NAME,
    width: W,
    height: H,
    tilesetId: reference.tilesetId as GameMap["tilesetId"],
    tileSize: reference.tileSize,
    lowerTiles: [...terrain.lowerTiles],
    upperTiles: [...terrain.upperTiles],
    events: [],
    encounterRate: 0,
    layoutPlan: {
      version: 1,
      kind: "ice-grand-plain-64",
      seed: 20260729,
      regions: TERRACES.map((terrace, index) => ({
        id: terrace.id,
        role: index === TERRACES.length - 1 ? "boss" : "expedition-region",
        label: terrace.id,
        x: 0,
        y: terrace.floorFrom,
        w: W,
        h: terrace.floorTo - terrace.floorFrom + 1,
      })),
      roadAnchors: terrain.stairs.map((block) => ({ id: block.bandId, x: block.fromX + 1, y: block.crestY })),
      notes: "절벽 네 겹 · 계단 네 덩어리 · 얼음 바닥 패치. 고도 변화는 계단으로만 넘는다. 물은 없다.",
    },
  };
}

/** `ICE_SNOW_SUPPORT_TILES` 를 검사가 참조한다 — 대각 밑동 아래 지지 규칙의 근거. */
export const SNOW_SUPPORT_REFERENCE: readonly number[] = ICE_SNOW_SUPPORT_TILES;
