import { dungeonTerrainBlockRoles } from "@/project/defaults/dungeonTerrainAutotiles";
import { ICE_DIAGONAL_TILES, validateIceDiagonalTerrain, type IceDiagonalColumn } from "@/project/defaults/iceDiagonalTerrain";
import type { GameMap } from "@/project/types";

/**
 * 설산 60×60 — 절벽과 계단만으로 짓는다.
 *
 * 2026-07-27 감독 지시 셋을 그대로 구조로 옮긴 3차 판이다. 세 지시 모두
 * **1·2차 판의 구조가 원인**이었으므로 고쳐 붙이지 않고 다시 짰다.
 *
 * ① "316 위에는 286 이 나와야 할 거 아니냐"
 *    1·2차 판은 대각 기둥의 맨 위를 **전부** 이음 마감 343 으로 깔았다. 그러면 기둥마다
 *    같은 타일이 얹혀 **비스듬한 윗선이 사라진다** — 대각 절벽인데 윗면이 안 기울어 보인다.
 *    캡 286/287 이 바로 그 기울어진 윗선 조각이다. 이제 대각 기둥의 맨 위는 캡이다.
 *    343 은 **한 칸도 쓰지 않는다** — 통행 가능한 타일이라 절벽이 될 수 없다
 *    (`FORBIDDEN_PASSABLE_LIP` 의 주석에 실측과 사고 경위를 적어 뒀다).
 *
 *    캡을 되살리려면 정본 검증기의 두 금지 규칙을 피해야 한다:
 *      · `left-cap-north-east-right-cap`  — 좌캡의 북동에 우캡
 *      · `right-cap-north-west-left-cap`  — 우캡의 북서에 좌캡
 *    둘은 같은 조건의 앞뒤 표현이고, **한 열짜리 골짜기**에서만 걸린다(내려오는 열의 캡과
 *    올라가는 열의 캡이 한 행 어긋나 대각으로 붙는다). 2차 판이 여기서 튕겼다 —
 *    파동 프로필이 한 열짜리 골짜기를 만들었기 때문이다.
 *    이제 대각 구간은 **한 방향으로만 흐르는 2~4열 묶음**이고 그 사이는 반드시 긴 수평
 *    구간이라, 캡끼리 대각으로 만나는 일이 구성상 일어나지 않는다.
 *
 * ② "계단은 항상 2칸이거나 3칸 이상으로 가로가 '같이' 쓰여야 하고, 삐뚤빼뚤할 수 없다"
 *    1·2차 판은 계단을 `x` 열마다 그 열의 볏 행에서 시작했다. 볏이 흔들리는 자리에 걸리면
 *    **계단이 열마다 한 행씩 밀려** 삐뚤빼뚤해졌다. 이제 계단은 **직사각형 한 덩어리**다:
 *    폭 `STAIR_WIDTH` × 높이 `CLIFF_HEIGHT`, 네 열이 모두 같은 행에서 시작한다.
 *    그래서 계단은 **평평한 구간 안에만** 놓을 수 있고, 코드가 그 자리를 찾아서 놓는다.
 *
 * ③ "삼각형처럼 구현하려 하지 말고, 그냥 위로 가면 높아지는 듯한 느낌만"
 *    1·2차 판은 겹마다 평지 폭을 좁혀 원뿔(삼각형)을 만들었다. 그래서 어깨의 45° 직선이
 *    맵 밖으로 뻗고, 위 겹은 좁아지고, 맵 네 귀퉁이가 비었다.
 *    이제 절벽 다섯 겹이 **맵 폭 전체를 가로지른다**. 북으로 갈수록 한 겹씩 높아질 뿐이고
 *    실루엣도 정상도 없다 — 산의 중턱을 잘라 놓은 화면이다.
 *
 * ── 어휘 ──
 *   · 수평 절벽 : 상단 372/373/374 · 몸통 285 · 밑동 402/403/404   (통행 불가)
 *   · 대각 빙벽 : 캡 286/287 · 몸통 316/317 · 밑동 346/347          (통행 불가)
 *   · 계단      : 375/376/377, 376 이 가로로 증식                    (**통행 가능**)
 *   · 봉우리    : 408/409 — ★ 이라 통행성을 바꾸지 않는다. 맨 위 원경에만.
 */

export const SNOW_MOUNTAIN_WIDTH = 60;
export const SNOW_MOUNTAIN_HEIGHT = 60;

/** 절벽 한 겹의 높이(행): 상단 1 + 몸통 2 + 밑동 1. 대각 기둥도 같은 높이다. */
export const CLIFF_HEIGHT = 4;

export const CLIFF_TOP = { left: 372, mid: 373, right: 374 } as const;
export const CLIFF_BASE = { left: 402, mid: 403, right: 404 } as const;
export const CLIFF_BODY = 285;
export const STAIRS = { left: 375, mid: 376, right: 377 } as const;
export const SUMMIT_PEAK = { left: 408, right: 409 } as const;

/**
 * 계단 한 덩어리의 가로 폭. 감독 지시 ② — 계단은 혼자 서지 못한다.
 * 4 이면 `375 · 376 · 376 · 377` 이 되어 **376 이 가로로 증식하는 성질**이 실제로 보인다.
 */
export const STAIR_WIDTH = 4;

/**
 * **절벽에 쓰면 안 되는 타일.** 정본 문법이 대각 몸통 위에 캡 대신 343 을 허용하고
 * (`iceDiagonalTerrain.ts:80,86`), 2차 판은 그래서 이걸 모든 대각 기둥 위에 깔았다.
 * 3차 판은 지시 ① 에 따라 기둥 머리를 캡으로 되돌리고, 343 은 대각과 수평이 만나는
 * 이음매 한 칸에만 쓰려 했다.
 *
 * **둘 다 틀렸다.** 실측하니 `343` 의 통행 표시는 `o` — **통행 가능**이다(다른 부빙
 * 조각 342/344 도 같다). 절벽 상단에 얹으면 절벽에 걸어 들어갈 수 있는 구멍이 뚫린다.
 * 이음매로 쓴 3차 판에서 실제로 **구멍 23 칸**이 생겼고 통행 검사가 잡았다 —
 * 큰 얼음맵의 365 칸 punch-through 와 같은 종류의 사고다.
 *
 * 정본 문법이 343 을 허용하는 것은 **문법상 이어진다**는 뜻이고 **절벽으로 쓸 수 있다**는
 * 뜻이 아니다. 문법 검증기는 통행성을 보지 않는다. 그래서 이 맵은 캡만 쓴다.
 * 상수는 검사가 "이 맵에 343 이 없다"를 지킬 때 쓰려고 남겨 둔다.
 */
export const FORBIDDEN_PASSABLE_LIP = 343;

export const CLIFF_TILES: readonly number[] = [
  CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right,
  CLIFF_BASE.left, CLIFF_BASE.mid, CLIFF_BASE.right,
  CLIFF_BODY,
  ICE_DIAGONAL_TILES.left.cap, ICE_DIAGONAL_TILES.left.body, ICE_DIAGONAL_TILES.left.base,
  ICE_DIAGONAL_TILES.right.cap, ICE_DIAGONAL_TILES.right.body, ICE_DIAGONAL_TILES.right.base,
];
export const STAIR_TILES: readonly number[] = [STAIRS.left, STAIRS.mid, STAIRS.right];

const W = SNOW_MOUNTAIN_WIDTH;
const H = SNOW_MOUNTAIN_HEIGHT;

/**
 * 절벽 한 겹. 맵 폭 전체를 가로지른다(지시 ③ — 삼각형이 아니다).
 * `baseCrestY` 는 이 겹 볏의 기준 행이고, 실제 볏은 그 위아래로 `MAX_WOBBLE` 행까지 흔들린다.
 * `stairTargetX` 는 계단을 놓고 싶은 x — 평평한 구간을 찾아 **가장 가까운 자리**로 옮겨 놓는다.
 */
export type Band = {
  readonly id: string;
  readonly baseCrestY: number;
  readonly stairTargetX: number;
  /**
   * 이 겹의 볏이 기준 행에서 벗어날 수 있는 최대 행수 (1 또는 2, `MAX_WOBBLE` 이하).
   * 겹마다 다르게 준다 — 다섯 겹이 같은 진폭이면 화면이 **줄무늬**로 읽힌다(실측 2차 판).
   * 1 이면 수평 덩어리가 길고, 2 면 대각이 잦다.
   */
  readonly wobble: 1 | 2;
  /** 수평 구간 길이 범위 `[최소, 최대]` — 겹마다 리듬을 다르게 하는 두 번째 손잡이. */
  readonly flatRun: readonly [number, number];
};

/**
 * 볏이 기준 행에서 벗어날 수 있는 최대 행수.
 *
 * **왜 2 인가.** 겹 간격이 10 행이고 절벽이 4 행이다. 밑동 바로 아래 한 행은 정본 규칙
 * `*-base-needs-snow-support` 가 눈 계열을 요구하므로 겹 하나가 실제로 먹는 높이는 5 행이다.
 * 위 겹이 최대로 내려오고(+2) 아래 겹이 최대로 올라가면(-2) 여유는 10-5-2-2 = 1 행.
 * 3 으로 키우면 겹이 서로를 파고들어 지지 행이 절벽에 먹힌다 — 검증기가 튕긴다.
 */
const MAX_WOBBLE = 2;

/**
 * 대각 묶음의 최소 열 수.
 *
 * **왜 1 이 아닌가.** 한 열짜리 대각은 화면에서 대각 절벽으로 읽히지 않는다 —
 * 수평 절벽 윗선에 난 **흠집**으로 보인다(실측 `mtn4-full.png` 3차, wobble 1 인 겹들).
 * 감독 지시는 "수평으로 가다가 **대각으로 가다가**" 였으므로 대각도 구간이어야 한다.
 */
const MIN_SLOPE_RUN = 2;

/** 계단 자리를 목표 x 근처에서 찾을 때, 평평한 구간이 계단보다 이만큼은 더 넓어야 한다. */
const STAIR_MARGIN = 1;

/**
 * 다섯 겹. 남(아래)에서 북(위)으로 10 행씩 올라간다.
 * 계단 목표 x 를 좌우로 흩어 놓아 등반로가 한 줄로 곧게 서지 않게 한다.
 */
export const BANDS: readonly Band[] = [
  { id: "b1-foot", baseCrestY: 52, stairTargetX: 31, wobble: 2, flatRun: [9, 15] },
  { id: "b2-lower", baseCrestY: 41, stairTargetX: 13, wobble: 2, flatRun: [6, 10] },
  { id: "b3-mid", baseCrestY: 30, stairTargetX: 44, wobble: 2, flatRun: [8, 13] },
  { id: "b4-upper", baseCrestY: 19, stairTargetX: 20, wobble: 2, flatRun: [5, 9] },
  { id: "b5-shoulder", baseCrestY: 8, stairTargetX: 36, wobble: 2, flatRun: [10, 16] },
];

export const SNOW_MOUNTAIN_START = { x: 30, y: 57 } as const;
export const SNOW_MOUNTAIN_SUMMIT_POINT = { x: 30, y: 4 } as const;

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

/** 이 열이 평평한 구간인지, 대각이면 어느 면인지. */
export type Face = "flat" | "left" | "right";

export type BandProfile = {
  /** 열별 볏 행. */
  readonly crestY: readonly number[];
  readonly face: readonly Face[];
};

const PROFILE_CACHE = new Map<string, BandProfile>();

/**
 * 겹의 볏 프로필. **"수평으로 한참 가다가 대각으로 두어 칸 꺾이고 다시 수평"** 을
 * 구간 단위로 엮는다. 2차 판처럼 파동을 열마다 반올림하면 능선이 톱니가 되고
 * 수평 절벽의 덩어리가 사라진다(실측: 수평 508 → 212 칸).
 *
 * 대각 묶음은 **한 방향으로만** 흐르고 그 사이에 반드시 6 열 이상의 수평 구간이 들어간다.
 * 이것이 캡을 되살릴 수 있는 이유다 — 한 열짜리 골짜기가 생기지 않으므로
 * 캡끼리 대각으로 만나는 금지 배치가 구성상 불가능하다(파일 머리 ① 참고).
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
    // 맵 끝에 대각을 반쯤 걸치면 **한 열짜리 대각**이 남는다 — 윗선의 흠집으로 읽힌다.
    // 남은 열이 묶음 하나를 못 채우면 수평으로 채우고 끝낸다.
    if (W - x < MIN_SLOPE_RUN) {
      for (; x < W; x += 1) {
        crestY[x] = band.baseCrestY + offset;
        face[x] = "flat";
      }
      break;
    }

    // 진폭 한계에 부딪히면 방향을 뒤집는다 — 뒤집으면 여유가 최소 `wobble` 열은 남는다.
    let room = direction < 0 ? offset + wobble : wobble - offset;
    if (room < MIN_SLOPE_RUN) {
      direction = -direction;
      room = direction < 0 ? offset + wobble : wobble - offset;
    }
    const slopeRun = Math.min(MIN_SLOPE_RUN + Math.floor(noise(bandIndex, segment + 977) * 2), room);
    for (let step = 0; step < slopeRun && x < W; step += 1, x += 1) {
      offset += direction;
      crestY[x] = band.baseCrestY + offset;
      // 볏이 오른쪽으로 갈수록 올라가면(y 감소) 정본 문법의 face 는 "right" 다
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
      runs.push({ from: start, to: x - 1, crestY: profile.crestY[start]! });
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
 * 겹마다 계단 한 덩어리. 지시 ② — **직사각형**이라 평평한 구간 안에만 놓을 수 있다.
 * 목표 x 에 중심이 가장 가까운 구간을 골라 그 안에서 목표 x 쪽으로 붙인다.
 */
export function stairBlocks(): readonly StairBlock[] {
  const blocks: StairBlock[] = [];
  for (const band of BANDS) {
    const usable = flatRuns(band).filter((run) => run.to - run.from + 1 >= STAIR_WIDTH + STAIR_MARGIN * 2);
    if (usable.length === 0) throw new Error(`설산 60×60: ${band.id} 에 계단을 놓을 평평한 구간이 없다`);
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

export type SnowMountainTerrain = {
  readonly lowerTiles: readonly number[];
  readonly cliffMask: Uint8Array;
  readonly stairMask: Uint8Array;
  readonly diagonalColumns: readonly IceDiagonalColumn[];
  readonly horizontalCells: number;
};

export function buildSnowMountainTerrain(): SnowMountainTerrain {
  const roles = new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
  const snow = roles.get("snow");
  if (snow === undefined) throw new Error("눈밭 역할표 누락");

  const lower = new Array<number>(W * H).fill(snow.body);
  const cliffMask = new Uint8Array(W * H);
  const stairMask = new Uint8Array(W * H);
  const diagonalColumns: IceDiagonalColumn[] = [];
  let horizontalCells = 0;

  // 계단 칸을 먼저 예약한다 — 절벽을 찍고 덮어쓰면 이음매가 틀어진다.
  const stairCells = new Set<number>();
  const blocks = stairBlocks();
  for (const block of blocks) {
    for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
      for (let step = 0; step < CLIFF_HEIGHT; step += 1) {
        stairCells.add(idx(block.fromX + offset, block.crestY + step));
      }
    }
  }

  for (const band of BANDS) {
    const profile = bandProfile(band);
    for (let x = 0; x < W; x += 1) {
      const crest = profile.crestY[x]!;
      if (crest < 1 || crest + CLIFF_HEIGHT >= H) continue;
      if (stairCells.has(idx(x, crest))) continue;
      const face = profile.face[x]!;
      if (face === "flat") {
        // 수평 절벽. 끝 조각 372/374·402/404 는 **맵 가장자리에서만** 쓴다.
        // 대각과 만나는 자리에 끝 조각을 쓰면 윗선에 직각 턱이 생겨 대각이 떨어져 보인다.
        const top = x === 0 ? CLIFF_TOP.left : x === W - 1 ? CLIFF_TOP.right : CLIFF_TOP.mid;
        const base = x === 0 ? CLIFF_BASE.left : x === W - 1 ? CLIFF_BASE.right : CLIFF_BASE.mid;
        lower[idx(x, crest)] = top;
        for (let step = 1; step < CLIFF_HEIGHT - 1; step += 1) lower[idx(x, crest + step)] = CLIFF_BODY;
        lower[idx(x, crest + CLIFF_HEIGHT - 1)] = base;
        for (let step = 0; step < CLIFF_HEIGHT; step += 1) cliffMask[idx(x, crest + step)] = 1;
        horizontalCells += CLIFF_HEIGHT;
        continue;
      }
      diagonalColumns.push({ x, topY: crest, bottomY: crest + CLIFF_HEIGHT - 1, face });
    }
  }

  /**
   * 대각 기둥. 맨 위는 **캡**이다(지시 ①) — `stampIceDiagonalColumns()` 와 같은 배치이지만
   * 그 함수는 눈 계열·빈칸만 대체하므로 수평 절벽이 이미 깔린 그리드에서는 쓸 수 없다.
   * 문법 준수는 주장하지 않는다 — 바로 아래에서 정본 검증기를 그리드 전체에 돌린다.
   */
  for (const column of diagonalColumns) {
    const tiles = ICE_DIAGONAL_TILES[column.face];
    for (let y = column.topY; y <= column.bottomY; y += 1) {
      const tile = y === column.topY ? tiles.cap : y === column.bottomY ? tiles.base : tiles.body;
      lower[idx(column.x, y)] = tile;
      cliffMask[idx(column.x, y)] = 1;
    }
  }

  // 계단. 절벽 네 행을 전부 끊어야 위아래가 이어진다.
  for (const block of blocks) {
    for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
      const tile = stairTileAt(offset);
      for (let step = 0; step < CLIFF_HEIGHT; step += 1) {
        const cell = idx(block.fromX + offset, block.crestY + step);
        lower[cell] = tile;
        stairMask[cell] = 1;
        cliffMask[cell] = 0;
      }
    }
  }

  const issues = validateIceDiagonalTerrain({ width: W, height: H, lower });
  if (issues.length > 0) {
    const summary = issues.slice(0, 8).map((issue) => `${issue.code}@${issue.x},${issue.y}=${issue.actual}`).join(" · ");
    throw new Error(`설산 60×60 대각 빙벽 정본 검증 실패: ${summary}`);
  }

  return { lowerTiles: lower, cliffMask, stairMask, diagonalColumns, horizontalCells };
}

/**
 * **원경 봉우리는 이 맵에 넣지 않는다.** 두 밀도로 렌더해 보고 둘 다 버렸다:
 *   · 다섯 칸 간격으로 흩어 놓으면 → 눈밭에 흩뿌린 갈매기표(^ ^ ^)로 읽힌다.
 *   · 두 칸씩 맞붙이면 → ΛΛΛΛ 가 이어져 **물결선 낙서**가 된다.
 * 408/409 는 16px 윤곽선뿐이라 흰 눈밭 위에서 원경 능선의 무게를 버티지 못한다.
 *
 * 애초에 감독 지시 ③("삼각형처럼 하지 말고 위로 가면 높아지는 느낌만") 이후 이 맵에는
 * 정상이 없다 — 산의 중턱을 잘라 놓은 화면이다. 마감할 봉우리가 없으므로 마감재도 없다.
 * 408/409 는 정상이 실제로 있는 맵(설산 관문·64×64 얼음 대설원)에서 쓴다.
 *
 * 상수는 남겨 둔다 — 검사가 "이 맵에는 봉우리가 없다"를 지킬 때 쓰고,
 * 감독이 뒤집으면 되살릴 자리를 명시해 둔다.
 */
export function summitPeakCells(): readonly { readonly x: number; readonly y: number; readonly tile: number }[] {
  void SUMMIT_PEAK;
  return [];
}

export function buildSnowMountainMap(reference: { readonly tilesetId: string; readonly tileSize: number }): GameMap {
  const terrain = buildSnowMountainTerrain();
  const upperTiles = new Array<number>(W * H).fill(-1);
  for (const cell of summitPeakCells()) {
    if (inBounds(cell.x, cell.y)) upperTiles[idx(cell.x, cell.y)] = cell.tile;
  }
  return {
    id: "map_snow_mountain_60",
    name: "설산 · 절벽 다섯 겹 (60×60)",
    width: W,
    height: H,
    tilesetId: reference.tilesetId as GameMap["tilesetId"],
    tileSize: reference.tileSize,
    lowerTiles: [...terrain.lowerTiles],
    upperTiles,
    events: [],
    encounterRate: 0,
  };
}
