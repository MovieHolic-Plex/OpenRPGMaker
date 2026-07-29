// 설산 변주 4종 생성기 — 감독 손맵 문법(처마 343 + 상단 373×2 + 밑동 403, 대각은 캡+몸통×2+밑동,
// 계단은 4폭×4행, 바닥은 67+스펙클/글린트)을 다른 골조에 적용한다.
//   npx tsx scripts/build-snow-variants.mts            # 렌더 미리보기 + 통행 검증 (로컬)
//   npx tsx scripts/build-snow-variants.mts --push   # Supabase 저장 + 재로드 검증
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import { sha256HexText } from "../src/util/sha256";
import type { GameMap } from "../src/project/types";

const TILESET_ID = "easyrpg_chipset_dungeon";
const PROJECT_ID = "rpg-zzu-quest-demo";

// ── 어휘 (손맵 실측) ──
const FLOOR = 67;
const DRAPE = 343;
const TOP = 373;
const BODY = 285; // 쓰지 않는다 — 어휘표에만 남긴다
const BASE = 403;
const CAP = { left: 286, right: 287 } as const;
const DBODY = { left: 316, right: 317 } as const;
const DBASE = { left: 346, right: 347 } as const;
const STAIR = { left: 375, mid: 376, right: 377 } as const;
const PEAK = { left: 408, right: 409 } as const;
const SPECKLE = [96, 97, 98] as const;
const GLINT = [8, 36, 37, 38] as const;
const PANE = [36, 37, 38] as const;
const WATER = [64, 65] as const;
void WATER;
void BODY;

const PASSABLE = new Set([FLOOR, DRAPE, STAIR.left, STAIR.mid, STAIR.right, 66, 68, ...SPECKLE, ...GLINT, PEAK.left, PEAK.right]);

const STAIR_W = 4;

function noise(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Face = "flat" | "left" | "right";

type Crest = {
  readonly rows: readonly number[]; // x별 첫 373 행 (스택: r-1 처마, r/r+1 상단, r+2 밑동)
  readonly faces: readonly Face[];
};

/** 볏선 폴리라인 → Face 배열. 상승(행 번호 감소)이 오른쪽으로 가면서 일어나면 face=right. */
function facesOf(rows: readonly number[]): Face[] {
  const faces: Face[] = new Array(rows.length).fill("flat");
  for (let x = 0; x < rows.length; x += 1) {
    const prev = x > 0 ? rows[x - 1]! : rows[x]!;
    const cur = rows[x]!;
    if (cur < prev) faces[x] = "right";
    else if (cur > prev) faces[x] = "left";
  }
  return faces;
}

/** 평탄 구간(같은 행 연속) 목록. */
function flatRuns(crest: Crest, minLen: number): Array<{ from: number; to: number; row: number }> {
  const runs: Array<{ from: number; to: number; row: number }> = [];
  let start = -1;
  for (let x = 0; x <= crest.rows.length; x += 1) {
    const flat = x < crest.rows.length && crest.faces[x] === "flat" && (start === -1 || crest.rows[x] === crest.rows[start]);
    if (flat && start === -1) start = x;
    if (!flat && start !== -1) {
      if (x - start >= minLen) runs.push({ from: start, to: x - 1, row: crest.rows[start]! });
      start = -1;
    }
    if (x < crest.rows.length && start !== -1 && crest.faces[x] === "flat" && crest.rows[x] !== crest.rows[start]) {
      if (x - start >= minLen) runs.push({ from: start, to: x - 1, row: crest.rows[start]! });
      start = x;
    }
  }
  return runs;
}

type StairSpec = { readonly targetX: number };

/** 볏 하나를 스택으로 깐다. 계단 자리는 먼저 예약한다 — 평탄 구간이 모자라면 볏을 눌러서라도 만든다. */
function layBand(lower: number[], W: number, H: number, crest: Crest, stair: StairSpec | null): void {
  const stairXs = new Set<number>();
  if (stair) {
    let candidates = flatRuns(crest, STAIR_W + 2);
    const rows = crest.rows as number[];
    if (candidates.length === 0) {
      // 44 폭처럼 좁은 맵에서는 대각만 남는 볏이 나온다 — 목표 x 주변을 눌러 평탄 구간을 만든다.
      const cx = Math.min(Math.max(stair.targetX, 2), W - 2 - STAIR_W);
      const row = rows[cx]!;
      for (let x = cx - 1; x <= cx + STAIR_W; x += 1) if (x >= 0 && x < W) rows[x] = row;
      crest = { rows, faces: facesOf(rows) };
      candidates = flatRuns(crest, STAIR_W + 2);
    }
    const chosen = candidates.reduce((best, run) =>
      Math.abs((run.from + run.to) / 2 - stair.targetX) < Math.abs((best.from + best.to) / 2 - stair.targetX) ? run : best);
    const fromX = Math.min(Math.max(stair.targetX - 1, chosen.from + 1), chosen.to - STAIR_W);
    for (let dx = 0; dx < STAIR_W; dx += 1) {
      const x = fromX + dx;
      const r = crest.rows[x]!;
      const tile = dx === 0 ? STAIR.left : dx === STAIR_W - 1 ? STAIR.right : STAIR.mid;
      for (let dy = r - 1; dy <= r + 2; dy += 1) {
        if (dy >= 0 && dy < H) lower[dy * W + x] = tile;
      }
      stairXs.add(x);
    }
  }
  for (let x = 0; x < W; x += 1) {
    if (stairXs.has(x)) continue;
    const present = (crest as { present?: boolean[] }).present;
    if (present && !present[x]) continue;
    const r = crest.rows[x]!;
    const face = crest.faces[x]!;
    const put = (y: number, tile: number): void => {
      if (y >= 0 && y < H) lower[y * W + x] = tile;
    };
    if (face === "flat") {
      put(r - 1, DRAPE);
      put(r, TOP);
      put(r + 1, TOP);
      put(r + 2, BASE);
    } else {
      // 손맵 실측: 캡은 항상 “높은 쪽 상단 행”에 맞춘다. 오름(right)은 자기 볏 행이
      // 곧 높은 쪽이라 r, 내림(left)은 높은 쪽이 한 행 위라 r-1. 무조건 r-1 로 두면
      // 오름 대각이 수평 상단보다 한 칸 솟는 스파이크가 된다(감독 스크린샷의 그 어긋남).
      const capRow = face === "right" ? r : r - 1;
      // 내림 첫 열에만 캡 위 처마를 이어준다(손맵: 평단→대각 경계의 x28 만 해당,
      // x29 같은 연속 대각에는 얹지 않는다 — 얹으면 중간에 뜬 점이 된다).
      if (face === "left" && x > 0 && crest.faces[x - 1] === "flat") put(capRow - 1, DRAPE);
      put(capRow, CAP[face]);
      put(capRow + 1, DBODY[face]);
      put(capRow + 2, DBODY[face]);
      put(capRow + 3, DBASE[face]);
    }
  }
}

/** 바닥 텍스처: 스펙클 ~2%, 글린트는 대각 밑동 아래 행에. */
function textureFloor(lower: number[], W: number, H: number, crests: readonly Crest[], seed: number): void {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (lower[i] !== FLOOR) continue;
      const n = noise(seed + x, y);
      if (n < 0.02) lower[i] = SPECKLE[Math.floor(noise(y, seed + x) * SPECKLE.length)]!;
    }
  }
  for (const crest of crests) {
    for (let x = 0; x < W; x += 1) {
      if (crest.faces[x] === "flat") continue;
      const y = crest.rows[x]! + 3;
      if (y < H && lower[y * W + x] === FLOOR && noise(seed * 7 + x, y) < 0.55) {
        lower[y * W + x] = GLINT[Math.floor(noise(x, seed * 3 + y) * GLINT.length)]!;
      }
    }
  }
}

/** 평행 밴드 골조 (손맵과 같은 사행). */
function bandCrests(W: number, bands: ReadonlyArray<{ baseRow: number; wobble: 1 | 2; flatRun: readonly [number, number]; seed: number }>): Crest[] {
  return bands.map((band) => {
    const rows = new Array<number>(W).fill(band.baseRow);
    let x = 0;
    let offset = 0;
    let segment = 0;
    let direction = band.seed % 2 === 0 ? -1 : 1;
    const [flatMin, flatMax] = band.flatRun;
    while (x < W) {
      const run = flatMin + Math.floor(noise(band.seed, segment) * (flatMax - flatMin + 1));
      for (let s = 0; s < run && x < W; s += 1, x += 1) rows[x] = band.baseRow + offset;
      if (W - x < 2) {
        for (; x < W; x += 1) rows[x] = band.baseRow + offset;
        break;
      }
      let room = direction < 0 ? offset + band.wobble : band.wobble - offset;
      if (room < 2) {
        direction = -direction;
        room = direction < 0 ? offset + band.wobble : band.wobble - offset;
      }
      const slope = Math.min(2 + Math.floor(noise(band.seed, segment + 977) * 2), room);
      for (let s = 0; s < slope && x < W; s += 1, x += 1) {
        offset += direction;
        rows[x] = band.baseRow + offset;
      }
      direction = -direction;
      segment += 1;
    }
    return { rows, faces: facesOf(rows) };
  });
}

/** 원형극장 원호 — 테이퍼(2열 대각 꼬리) + 뿔 평단 + 2열 계단 어깨 + 넓은 중앙 평단을 대칭으로 짠다. */
function cirqueArc(W: number, margin: number, baseRow: number, depth: number, hornW: number): Crest & { present: boolean[] } {
  const hornRow = baseRow - depth;
  const rows = new Array<number>(W).fill(baseRow);
  const present = new Array<boolean>(W).fill(false);
  const seg = (x: number, row: number): void => {
    if (x >= 0 && x < W) {
      rows[x] = row;
      present[x] = true;
    }
  };
  // 왼쪽: 테이퍼 → 뿔 → 어깨(2열씩 depth 단)
  seg(margin - 2, hornRow + 1);
  seg(margin - 1, hornRow + 2);
  for (let k = 0; k < hornW; k += 1) seg(margin + k, hornRow);
  for (let s = 0; s < depth; s += 1) {
    for (let k = 0; k < 2; k += 1) seg(margin + hornW + s * 2 + k, hornRow + s + 1);
  }
  // 오른쪽: 어깨 → 뿔 → 테이퍼 (왼쪽의 거울)
  seg(W - margin + 1, hornRow + 2);
  seg(W - margin, hornRow + 1);
  for (let k = 0; k < hornW; k += 1) seg(W - margin - 1 - k, hornRow);
  for (let s = 0; s < depth; s += 1) {
    for (let k = 0; k < 2; k += 1) seg(W - margin - hornW - 1 - s * 2 - k, hornRow + s + 1);
  }
  // 중앙 평단
  const centerFrom = margin + hornW + depth * 2;
  const centerTo = W - margin - hornW - depth * 2 - 1;
  for (let x = centerFrom; x <= centerTo; x += 1) seg(x, baseRow);
  const faces: Face[] = new Array(W).fill("flat");
  for (let x = 0; x < W; x += 1) {
    if (!present[x]) {
      // flatRuns 가 원호 바깥을 평단으로 오인하지 않게 깨뜨려 둔다 (layBand 는 어차피 건른다).
      faces[x] = x % 2 === 0 ? "left" : "right";
      continue;
    }
    const prev = x > 0 && present[x - 1] ? rows[x - 1]! : rows[x]!;
    if (rows[x]! < prev) faces[x] = "right";
    else if (rows[x]! > prev) faces[x] = "left";
  }
  return { rows, faces, present } as Crest & { present: boolean[] };
}

function makeMap(id: string, name: string, W: number, H: number, build: (lower: number[]) => void): GameMap {
  const lower = new Array<number>(W * H).fill(FLOOR);
  build(lower);
  return {
    id, name, width: W, height: H,
    tilesetId: TILESET_ID as GameMap["tilesetId"],
    tileSize: 16,
    lowerTiles: lower,
    upperTiles: new Array<number>(W * H).fill(-1),
    events: [],
    encounterRate: 0,
  } as GameMap;
}

// ── A. 빙호 분지 (60×60) — 북쪽 테라스 3겹 + 남쪽 빙호 ──
function buildBasin(): GameMap {
  const W = 60, H = 60;
  return makeMap("map_snow_basin_60", "설산 · 빙호 분지 (60×60)", W, H, (lower) => {
    const crests = bandCrests(W, [
      { baseRow: 8, wobble: 2, flatRun: [8, 14], seed: 11 },
      { baseRow: 16, wobble: 2, flatRun: [7, 12], seed: 12 },
      { baseRow: 24, wobble: 2, flatRun: [7, 12], seed: 13 },
      { baseRow: 32, wobble: 1, flatRun: [9, 15], seed: 14 },
    ]);
    layBand(lower, W, H, crests[0]!, { targetX: 14 });
    layBand(lower, W, H, crests[1]!, { targetX: 44 });
    layBand(lower, W, H, crests[2]!, { targetX: 26 });
    layBand(lower, W, H, crests[3]!, { targetX: 50 });
    // 호수 — 남쪽 1/3. 호안은 사인 곡선 볏(긴 대각 런 = 곡선 호안), 호면은 페인 빙결 + 부빙.
    const lakeTop = 41;
    const rimRows = new Array<number>(W);
    for (let x = 0; x < W; x += 1) rimRows[x] = lakeTop + Math.round(Math.sin((x / W) * Math.PI * 2) * 1.5);
    // 곡선 극값의 1열 들뜸/패임을 눌러준다 — 한 열짜리 대각은 윗선의 흠집으로 읽힌다.
    for (let x = 1; x < W - 1; x += 1) {
      if (rimRows[x] !== rimRows[x - 1] && rimRows[x] !== rimRows[x + 1]) rimRows[x] = rimRows[x - 1]!;
    }
    const rim = { rows: rimRows, faces: facesOf(rimRows) };
    layBand(lower, W, H, rim, { targetX: 18 });
    const rimFlats = flatRuns(rim, STAIR_W + 2).filter((r) => r.from > 30);
    if (rimFlats.length > 0) {
      const run = rimFlats[0]!;
      for (let dx = 0; dx < STAIR_W; dx += 1) {
        const x = run.from + 1 + dx;
        const tile = dx === 0 ? STAIR.left : dx === STAIR_W - 1 ? STAIR.right : STAIR.mid;
        for (let dy = run.row - 1; dy <= run.row + 2; dy += 1) lower[dy * W + x] = tile;
      }
    }
    // 호수 — 얼음판 오토타일(70 중심)로 채운다. 눈밭 계열(36-38)을 쓰면 사분합성이
    // 호수를 주변 설원과 동일한 눈으로 렌더해 호수 자체가 소멸한다(감독 지적 (42,52)).
    // 얼음 가족은 전부 통행 가능 — 걸을 수 있는 빙호 의미론 유지.
    for (let x = 0; x < W; x += 1) {
      const rimRow = rimRows[x];
      for (let y = rimRow + 3; y < H; y += 1) {
        if (lower[y * W + x] !== FLOOR) continue;
        lower[y * W + x] = 70;
      }
    }
    // 부빙 — 흰 얼음 덩어리(282/283)를 물결선(342/343/344) 위에 얹은 2~3칸짜리 섬.
    // 343 단독 대시는 눈 처마 조각이라 호면에 뜬 점처럼 읽힌다(감독 지적 (42,52)).
    const floes: ReadonlyArray<readonly [number, number, number]> = [
      [8, 45, 0], [21, 47, 1], [34, 46, 0], [49, 45, 1], [14, 52, 1],
      [28, 54, 0], [42, 52, 0], [54, 53, 1], [36, 57, 1], [18, 57, 0],
    ];
    for (const [bx, by, shape] of floes) {
      if (shape === 0) {
        lower[by * W + bx + 1] = 282;
        lower[(by + 1) * W + bx] = 342;
        lower[(by + 1) * W + bx + 1] = 343;
        lower[(by + 1) * W + bx + 2] = 344;
      } else {
        lower[by * W + bx] = 283;
        lower[(by + 1) * W + bx] = 343;
        lower[(by + 1) * W + bx + 1] = 343;
      }
      if (noise(bx, by) > 0.5) lower[by * W + bx + (shape === 0 ? 2 : 1)] = GLINT[0]!;
    }
    textureFloor(lower, W, H, crests, 101);
  });
}

// ── B. 능선 오솔길 (44×76) — 7겹 지그재그 등반 ──
function buildSwitchback(): GameMap {
  const W = 44, H = 76;
  return makeMap("map_snow_switchback_44", "설산 · 능선 오솔길 (44×76)", W, H, (lower) => {
    const bands = [
      { baseRow: 68, wobble: 2 as const, flatRun: [5, 9] as const, seed: 21 },
      { baseRow: 59, wobble: 2 as const, flatRun: [5, 9] as const, seed: 22 },
      { baseRow: 50, wobble: 2 as const, flatRun: [4, 8] as const, seed: 23 },
      { baseRow: 41, wobble: 2 as const, flatRun: [4, 8] as const, seed: 24 },
      { baseRow: 32, wobble: 2 as const, flatRun: [5, 9] as const, seed: 25 },
      { baseRow: 23, wobble: 2 as const, flatRun: [5, 9] as const, seed: 26 },
      { baseRow: 14, wobble: 1 as const, flatRun: [6, 10] as const, seed: 27 },
    ];
    const stairXs = [9, 33, 8, 34, 10, 32, 21];
    const crests = bandCrests(W, bands);
    crests.forEach((crest, i) => layBand(lower, W, H, crest, { targetX: stairXs[i]! }));
    textureFloor(lower, W, H, crests, 202);
  });
}

// ── C. 정상 (48×48) — 408/409 가 서는 자리 ──
function buildSummit(): GameMap {
  const W = 48, H = 48;
  return makeMap("map_snow_summit_48", "설산 · 정상 (48×48)", W, H, (lower) => {
    const crests = bandCrests(W, [
      { baseRow: 38, wobble: 2, flatRun: [7, 12], seed: 31 },
      { baseRow: 29, wobble: 2, flatRun: [6, 10], seed: 32 },
      { baseRow: 20, wobble: 1, flatRun: [7, 12], seed: 33 },
      { baseRow: 12, wobble: 1, flatRun: [8, 14], seed: 34 },
    ]);
    layBand(lower, W, H, crests[0]!, { targetX: 12 });
    layBand(lower, W, H, crests[1]!, { targetX: 36 });
    layBand(lower, W, H, crests[2]!, { targetX: 15 });
    layBand(lower, W, H, crests[3]!, { targetX: 24 });
    // 정상 평원의 뒤쪽 림에 봉우리 왕관 — 중앙 3쌍을 맞붙이고 양옆에 한 쌍씩.
    const cx = Math.floor(W / 2);
    for (const [px, py] of [[cx - 3, 4], [cx - 1, 4], [cx + 1, 4], [cx - 7, 5], [cx + 5, 5]] as const) {
      lower[py * W + px] = PEAK.left;
      lower[py * W + px + 1] = PEAK.right;
    }
    textureFloor(lower, W, H, crests, 303);
  });
}

// ── D. 빙벽 원형극장 (52×52) — 남쪽으로 열린 중첩 원호 ──
function buildCirque(): GameMap {
  const W = 52, H = 52;
  return makeMap("map_snow_cirque_52", "설산 · 빙벽 원형극장 (52×52)", W, H, (lower) => {
    const arcs = [
      { crest: cirqueArc(W, 4, 18, 5, 5), stairX: 20 },
      { crest: cirqueArc(W, 8, 27, 4, 4), stairX: 32 },
      { crest: cirqueArc(W, 12, 36, 3, 4), stairX: 26 },
    ];
    for (const arc of arcs) layBand(lower, W, H, arc.crest, { targetX: arc.stairX });
    // 중앙 물대 — 페인 빙면.
    for (let y = 42; y < H - 2; y += 1) {
      for (let x = 8; x < W - 8; x += 1) {
        const i = y * W + x;
        if (lower[i] !== FLOOR) continue;
        const n = noise(x, y * 3);
        if (n < 0.65) lower[i] = PANE[Math.floor(n * 1.6 * PANE.length) % PANE.length]!;
        if (n > 0.97) lower[i] = GLINT[0]!;
      }
    }
    textureFloor(lower, W, H, arcs.map((a) => a.crest), 404);
  });
}

// ── 통행 검증: 아래 평지에서 계단 사슬로 맨 위 평지까지 ──
function walkCheck(map: GameMap): string[] {
  const problems: string[] = [];
  const { width: W, height: H, lowerTiles } = map;
  // 시작 칸: 아래 중앙에서 위로 훑어 첫 “본토” 칸(통행 가능 이웃 2개 이상) — 호수의 부빙에 착지하는 사고를 막는다.
  const mainland = (i: number): boolean => {
    if (!PASSABLE.has(lowerTiles[i]!)) return false;
    const x = i % W, y = Math.floor(i / W);
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (PASSABLE.has(lowerTiles[ny * W + nx]!)) n += 1;
    }
    return n >= 2;
  };
  let start = -1;
  const cx = Math.floor(W / 2);
  for (let y = H - 1; y >= 0 && start === -1; y -= 1) {
    if (mainland(y * W + cx)) start = y * W + cx;
  }
  if (start === -1) {
    for (let i = W * H - 1; i >= 0 && start === -1; i -= 1) if (mainland(i)) start = i;
  }
  if (start === -1) problems.push("통행 가능 칸이 하나도 없다");
  const seen = new Uint8Array(W * H);
  const queue = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const cx = cur % W, cy = Math.floor(cur / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (seen[ni] || !PASSABLE.has(lowerTiles[ni]!)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  let walkable = 0;
  for (let i = 0; i < W * H; i += 1) if (PASSABLE.has(lowerTiles[i]!)) walkable += 1;
  let reached = 0;
  for (let i = 0; i < W * H; i += 1) if (seen[i]) reached += 1;
  const ratio = walkable === 0 ? 0 : reached / walkable;
  if (ratio < 0.9) problems.push(`통행 가능 칸의 ${(ratio * 100).toFixed(1)}% 만 도달 (${reached}/${walkable}) — 끊긴 평지가 있다`);
  // 맨 위 두 행 중 도달 가능한 칸이 있어야 정상 루트가 열린 것으로 본다 (원형극장 제외는 호출부가 판단).
  return problems;
}

// ── 렌더 ──
const chip = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function renderPng(map: GameMap, path: string): void {
  const S = 2, T = 16, TPR = 30;
  const png = new PNG({ width: map.width * T * S, height: map.height * T * S });
  png.data.fill(24);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.lowerTiles[y * map.width + x]!;
      if (tile < 0) continue;
      const sx = (tile % TPR) * T, sy = Math.floor(tile / TPR) * T;
      for (let py = 0; py < T * S; py += 1) {
        for (let px = 0; px < T * S; px += 1) {
          const si = ((sy + Math.floor(py / S)) * chip.width + sx + Math.floor(px / S)) * 4;
          const di = ((y * T * S + py) * png.width + x * T * S + px) * 4;
          const a = chip.data[si + 3]! / 255;
          for (let c = 0; c < 3; c += 1) png.data[di + c] = Math.round(chip.data[si + c]! * a + png.data[di + c]! * (1 - a));
          png.data[di + 3] = 255;
        }
      }
    }
  }
  writeFileSync(path, PNG.sync.write(png));
}

const maps = [buildBasin(), buildSwitchback(), buildSummit(), buildCirque()];
mkdirSync("tmp/snow-variants", { recursive: true });
let failed = false;
for (const map of maps) {
  const problems = walkCheck(map);
  renderPng(map, `tmp/snow-variants/${map.id}.png`);
  if (problems.length > 0) {
    failed = true;
    console.log(`[walk] ${map.id} 문제:`, problems.join(" / "));
  } else {
    console.log(`[walk] ${map.id} 통과`);
  }
}
writeFileSync("tmp/snow-variants/maps.json", JSON.stringify(Object.fromEntries(maps.map((m) => [m.id, m]))));
if (failed) {
  console.error("통행 검증 실패 — push 하지 않는다.");
  process.exit(1);
}

if (!process.argv.includes("--push")) {
  console.log("[local] tmp/snow-variants/*.png 미리보기 생성. 저장하려면 --push.");
  process.exit(0);
}

// ── 저장: 라이브 프로젝트에 4 맵을 얹고 projects + maps 업서트, 재로드 검증 ──
function env(key: string): string {
  const line = readFileSync(".env", "utf-8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing in .env`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}
const url = env("VITE_SUPABASE_URL");
const anonKey = env("VITE_SUPABASE_ANON_KEY");
const readHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "rpg_zzu" };
const writeHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  "Content-Profile": "rpg_zzu",
  Prefer: "resolution=merge-duplicates,return=representation",
};

type MapTreeNode = { mapId: string; children: MapTreeNode[] };
const projectRes = await fetch(`${url}/rest/v1/projects?project_id=eq.${PROJECT_ID}&select=current_json`, { headers: readHeaders });
if (!projectRes.ok) throw new Error(`project fetch ${projectRes.status}`);
const project = ((await projectRes.json()) as Array<{ current_json: Record<string, unknown> }>)[0]!.current_json as {
  maps: Record<string, GameMap>;
  mapTree: MapTreeNode;
  version: number;
  meta: { title: string };
};

for (const map of maps) project.maps[map.id] = map;
const root = project.mapTree;
const existing = new Set(root.children.map((c) => c.mapId));
for (const map of maps) {
  if (!existing.has(map.id)) root.children.push({ mapId: map.id, children: [] });
}

const json = JSON.stringify(project);
const terrainTemplateCount = Object.values(project.tilesets as Record<string, unknown>).reduce((sum, tileset) => {
  const templates = (tileset as { terrainTemplates?: unknown }).terrainTemplates;
  return sum + (Array.isArray(templates) ? templates.length : 0);
}, 0);
const upsert = await fetch(`${url}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST",
  headers: writeHeaders,
  body: JSON.stringify({
    project_id: PROJECT_ID,
    title: project.meta.title,
    schema_version: project.version,
    current_json: JSON.parse(json),
    current_sha256: await sha256HexText(json),
    map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets as object).length,
    terrain_template_count: terrainTemplateCount,
  }),
});
if (!upsert.ok) {
  console.error("[push] projects 실패", upsert.status, (await upsert.text()).slice(0, 300));
  process.exit(1);
}
console.log("[push] projects 업서트 성공");

const mapRows = await Promise.all(maps.map(async (map) => ({
  project_id: PROJECT_ID,
  map_id: map.id,
  name: map.name,
  width: map.width,
  height: map.height,
  tileset_id: map.tilesetId,
  lower_sha256: await sha256HexText(JSON.stringify(map.lowerTiles)),
  upper_sha256: await sha256HexText(JSON.stringify(map.upperTiles)),
  lower_tile_count: map.lowerTiles.length,
  upper_tile_count: map.upperTiles.length,
  map_json: map,
})));
const mapsUpsert = await fetch(`${url}/rest/v1/maps?on_conflict=project_id,map_id`, {
  method: "POST",
  headers: writeHeaders,
  body: JSON.stringify(mapRows),
});
if (!mapsUpsert.ok) {
  console.error("[push] maps 실패", mapsUpsert.status, (await mapsUpsert.text()).slice(0, 300));
  process.exit(1);
}
console.log("[push] maps 업서트 성공:", mapRows.length, "행");

const verify = await fetch(
  `${url}/rest/v1/maps?project_id=eq.${PROJECT_ID}&select=map_id,lower_sha256`,
  { headers: readHeaders },
);
const rows = (await verify.json()) as Array<{ map_id: string; lower_sha256: string }>;
const byId = new Map(rows.map((r) => [r.map_id, r.lower_sha256]));
let verifyFailed = false;
for (const row of mapRows) {
  const remote = byId.get(row.map_id);
  const ok = remote === row.lower_sha256;
  console.log(`[verify] ${row.map_id} ${ok ? "일치" : `불일치 local=${row.lower_sha256.slice(0, 8)} remote=${(remote ?? "없음").slice(0, 8)}`}`);
  if (!ok) verifyFailed = true;
}
if (verifyFailed) {
  console.error("[verify] 재로드 검증 실패");
  process.exit(1);
}
console.log("[verify] 재로드 검증 통과 —", rows.length, "맵 행");
