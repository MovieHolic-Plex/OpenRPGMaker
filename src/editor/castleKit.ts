// 성채 모듈 결정론 스탬프 — 2026-07-18 성 문법 정본(docs/2026-07-18-castle-grammar.html).
// 정본 = 사용자 손그림 map_castle_canvas 실측 역공학. 타일 선택은 전부 여기; LLM/툴은 영역·옵션만 넘긴다.
//
// 정본 문법 요약:
//  1) 커튼월 정단면(북→남) = 데크 상변 19 → 보행면 49(단일톤 78|49|80) → 데크 하변 109 → 정면 51×n → 정면 하단 81.
//     성벽 위에는 통행 데크 필수 — 데크 없는 맨 21/51/81 금지. 타일 21 미사용(정면 상단 마감 = 109).
//     데크 명암 변형 48/79/50 미사용.
//  2) 원형 타워 = 벽선 매립: 캡 24|25(상위 — 밑 lower 보존·비침)가 데크 하변 행 위, 목 138|139부터 하위로
//     정면 열만 세로 대체, 몸통 140|141과 창 142|143이 한 행 걸러 교대, 베이스 54|55(상위 — 밑 lower 보존).
//     데크 상변·보행면 행은 절대 절단 금지. 캡·베이스 아래 lower 잔디 강제 금지.
//  3) 성문 = 전 층 관통: 위쪽 데크 상변·보행 행은 포석 회랑, 데크 하변+정면 전 행은 대계단 111|112*|113.
//     아치 359는 정면 하단 81 자리(킵 문·포스턴).
//  4) 배너 = 179(상, 데크 하변 행)+209(하, 정면 행) 세로 페어 — 단독 반쪽 금지.
//  5) 조립 순서: lower(잔디→포석→데크→정면→개구→타워 몸통) 먼저 → upper(캡·베이스·배너) 나중.

import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

export const CASTLE_DECK = {
  TL: 18,
  T: 19,
  TR: 20,
  L: 78,
  WALK: 49,
  R: 80,
  BL: 108,
  B: 109,
  BR: 110,
} as const;

export const CASTLE_FACE = {
  MID: 51,
  BOT: 81,
} as const;

export const CASTLE_GATE = {
  STAIR_L: 111,
  STAIR_M: 112,
  STAIR_R: 113,
  ARCH: 359,
} as const;

export const CASTLE_BANNER = {
  TOP: 179,
  BOT: 209,
} as const;

export const CASTLE_PAVE = {
  TL: 276,
  T: 277,
  TR: 278,
  L: 306,
  C: 307,
  R: 308,
  BL: 336,
  B: 337,
  BR: 338,
} as const;

// ── 구본 상수(스크립트 호환 유지) ──
// CASTLE_ROOF의 L(48)/FILL_LIGHT·FILL_DARK 명암 교대와 CASTLE_WALL.TOP(21)은 정본 미사용 —
// 새 코드는 CASTLE_DECK/CASTLE_FACE를 쓸 것.
export const CASTLE_ROOF = {
  TL: 18,
  T: 19,
  TR: 20,
  L: 48,
  FILL_LIGHT: 49,
  BODY: 50,
  L2: 78,
  FILL_DARK: 79,
  BODY2: 80,
  BL: 108,
  B: 109,
  BR: 110,
} as const;

export const CASTLE_WALL = {
  /** 정본 미사용 — 정면 상단 마감은 데크 하변 109가 담당한다. */
  TOP: 21,
  MID: 51,
  BOT: 81,
} as const;

export const CASTLE_ROUND_TOWER = {
  CAP_L: 24,
  CAP_R: 25,
  NECK_L: 138,
  NECK_R: 139,
  BODY_L: 140,
  BODY_R: 141,
  WIN_L: 142,
  WIN_R: 143,
  BASE_L: 54,
  BASE_R: 55,
} as const;

const DECK_TOP_SET = new Set<number>([CASTLE_DECK.TL, CASTLE_DECK.T, CASTLE_DECK.TR]);
const WALK_SET = new Set<number>([CASTLE_DECK.L, CASTLE_DECK.WALK, CASTLE_DECK.R]);
const DECK_BOT_SET = new Set<number>([CASTLE_DECK.BL, CASTLE_DECK.B, CASTLE_DECK.BR]);
const DECK_ANY_SET = new Set<number>([...DECK_TOP_SET, ...WALK_SET, ...DECK_BOT_SET]);
const PAVE_SET = new Set<number>(Object.values(CASTLE_PAVE));
const FACE_RUN_SET = new Set<number>([CASTLE_FACE.MID, CASTLE_FACE.BOT, CASTLE_GATE.ARCH]);
const STAIR_SET = new Set<number>([CASTLE_GATE.STAIR_L, CASTLE_GATE.STAIR_M, CASTLE_GATE.STAIR_R]);

export type Rect = { x: number; y: number; w: number; h: number };

// ── 셀 집합(연속 띠 오토타일용) ──

export type DeckCells = Set<string>;
const cellKey = (x: number, y: number): string => `${x},${y}`;

export function addDeckRect(cells: DeckCells, x0: number, y0: number, w: number, h: number): DeckCells {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) cells.add(cellKey(x, y));
  return cells;
}

/** 두께 t의 사각 링 셀 집합(성곽 커튼월 기본형). */
export function deckRingCells(x0: number, y0: number, w: number, h: number, t = 3): DeckCells {
  const cells: DeckCells = new Set();
  addDeckRect(cells, x0, y0, w, t);
  addDeckRect(cells, x0, y0 + h - t, w, t);
  addDeckRect(cells, x0, y0 + t, t, h - 2 * t);
  addDeckRect(cells, x0 + w - t, y0 + t, t, h - 2 * t);
  return cells;
}

// ── 정본 스탬프 ──

/**
 * 데크 블록(연속 띠 오토타일 — 모서리는 진짜 모서리에만) + 모든 남향 하변 아래 정면(51×(faceH-1)+81).
 * 정본 규칙 1. 반환 = { deckCells, faceCells } 시공 수.
 */
export function paintDeckBlock(
  map: GameMap,
  cells: DeckCells,
  faceH = 2,
): { deckCells: number; faceCells: number } {
  const fh = Math.max(2, faceH);
  const has = (x: number, y: number): boolean => cells.has(cellKey(x, y));
  let deckCells = 0;
  for (const k of cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const N = has(x, y - 1), S = has(x, y + 1), W = has(x - 1, y), E = has(x + 1, y);
    let tile: number = CASTLE_DECK.WALK;
    if (!N && !W) tile = CASTLE_DECK.TL;
    else if (!N && !E) tile = CASTLE_DECK.TR;
    else if (!S && !W) tile = CASTLE_DECK.BL;
    else if (!S && !E) tile = CASTLE_DECK.BR;
    else if (!N) tile = CASTLE_DECK.T;
    else if (!S) tile = CASTLE_DECK.B;
    else if (!W) tile = CASTLE_DECK.L;
    else if (!E) tile = CASTLE_DECK.R;
    setLower(map, x, y, tile);
    setUpper(map, x, y, TILE.EMPTY);
    deckCells += 1;
  }
  let faceCells = 0;
  for (const k of cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    if (has(x, y + 1)) continue;
    for (let i = 1; i < fh; i += 1) {
      setLower(map, x, y + i, CASTLE_FACE.MID);
      setUpper(map, x, y + i, TILE.EMPTY);
      faceCells += 1;
    }
    setLower(map, x, y + fh, CASTLE_FACE.BOT);
    setUpper(map, x, y + fh, TILE.EMPTY);
    faceCells += 1;
  }
  return { deckCells, faceCells };
}

/** 포석 9궁 안뜰/회랑. */
export function paintCourtyardPavement(map: GameMap, x0: number, y0: number, w: number, h: number): number {
  let n = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const l = x === 0, r = x === w - 1, t = y === 0, b = y === h - 1;
      let tile: number = CASTLE_PAVE.C;
      if (t && l) tile = CASTLE_PAVE.TL;
      else if (t && r) tile = CASTLE_PAVE.TR;
      else if (t) tile = CASTLE_PAVE.T;
      else if (b && l) tile = CASTLE_PAVE.BL;
      else if (b && r) tile = CASTLE_PAVE.BR;
      else if (b) tile = CASTLE_PAVE.B;
      else if (l) tile = CASTLE_PAVE.L;
      else if (r) tile = CASTLE_PAVE.R;
      setLower(map, x0 + x, y0 + y, tile);
      n += 1;
    }
  }
  return n;
}

export type CastleTowerRecord = {
  /** 타워 왼쪽 열 x (footprint 2열: x, x+1). */
  x: number;
  /** 캡 행(데크 하변 행). */
  capRow: number;
  /** 베이스 행 = capRow + h - 1. */
  baseRow: number;
  /** 스택 총 행수(캡~베이스). 정본 실측 8. */
  h: number;
  /** 캡 자리에 원래 있던 lower [좌, 우] — 보존 검증용. */
  capUnder: [number, number];
  /** 베이스 자리에 원래 있던 lower [좌, 우]. */
  baseUnder: [number, number];
};

export const CANON_TOWER_HEIGHT = 8;

/**
 * 정본 규칙 2: 벽선 매립 원형 타워. capRow = 데크 하변 행.
 * 캡·베이스는 upper 전용(밑 lower 보존 — 잔디 강제 금지), 목부터 정면 열만 세로 대체,
 * 몸통·창은 한 행 걸러 교대. 자리가 정본 조건(캡=데크 하변, 아래=정면 51)이 아니면 시공하지 않는다.
 */
export function paintTowerEmbedded(
  map: GameMap,
  x: number,
  capRow: number,
  height = CANON_TOWER_HEIGHT,
): CastleTowerRecord | { ok: false; reason: string } {
  const h = Math.max(6, height);
  const baseRow = capRow + h - 1;
  if (baseRow >= map.height) return { ok: false, reason: `tower(${x},${capRow}): 베이스 행이 맵 밖` };
  const capUnder: [number, number] = [getLower(map, x, capRow), getLower(map, x + 1, capRow)];
  if (!DECK_BOT_SET.has(capUnder[0]) || !DECK_BOT_SET.has(capUnder[1])) {
    return { ok: false, reason: `tower(${x},${capRow}): 캡 자리가 데크 하변이 아님 (${capUnder.join(",")})` };
  }
  if (getLower(map, x, capRow + 1) !== CASTLE_FACE.MID || getLower(map, x + 1, capRow + 1) !== CASTLE_FACE.MID) {
    return { ok: false, reason: `tower(${x},${capRow}): 캡 아래가 정면 51이 아님` };
  }
  // 몸통이 지나갈 행에 다른 데크가 있으면 절단 사고 — 시공 거부.
  for (let y = capRow + 2; y < baseRow; y += 1) {
    for (const xx of [x, x + 1]) {
      if (DECK_ANY_SET.has(getLower(map, xx, y)) || DECK_TOP_SET.has(getLower(map, xx, y))) {
        return { ok: false, reason: `tower(${x},${capRow}): 몸통 행 y=${y}에 데크 존재 — 절단 금지` };
      }
    }
  }
  setUpper(map, x, capRow, CASTLE_ROUND_TOWER.CAP_L);
  setUpper(map, x + 1, capRow, CASTLE_ROUND_TOWER.CAP_R);
  setLower(map, x, capRow + 1, CASTLE_ROUND_TOWER.NECK_L);
  setLower(map, x + 1, capRow + 1, CASTLE_ROUND_TOWER.NECK_R);
  setUpper(map, x, capRow + 1, TILE.EMPTY);
  setUpper(map, x + 1, capRow + 1, TILE.EMPTY);
  for (let i = 2; i < h - 1; i += 1) {
    const win = i % 2 === 1;
    setLower(map, x, capRow + i, win ? CASTLE_ROUND_TOWER.WIN_L : CASTLE_ROUND_TOWER.BODY_L);
    setLower(map, x + 1, capRow + i, win ? CASTLE_ROUND_TOWER.WIN_R : CASTLE_ROUND_TOWER.BODY_R);
    setUpper(map, x, capRow + i, TILE.EMPTY);
    setUpper(map, x + 1, capRow + i, TILE.EMPTY);
  }
  const baseUnder: [number, number] = [getLower(map, x, baseRow), getLower(map, x + 1, baseRow)];
  setUpper(map, x, baseRow, CASTLE_ROUND_TOWER.BASE_L);
  setUpper(map, x + 1, baseRow, CASTLE_ROUND_TOWER.BASE_R);
  return { x, capRow, baseRow, h, capUnder, baseUnder };
}

export type CastleGateRecord = {
  x: number;
  w: number;
  /** 포석 회랑 행(데크 상변·보행 행 대체). */
  corridorRows: number[];
  /** 대계단 행(데크 하변+정면 전 행 대체). */
  stairRows: number[];
};

/**
 * 정본 규칙 3: 성문 = 전 층 관통. bandTop = 남 데크 밴드(두께 3)의 첫 행.
 * 회랑 2행(포석) + 대계단 (1+faceH)행이 데크·정면 전 층을 대체한다.
 */
export function paintGateStair(map: GameMap, gx: number, w: number, bandTop: number, faceH = 2): CastleGateRecord {
  const corridorRows = [bandTop, bandTop + 1];
  const stairRows: number[] = [];
  for (let y = bandTop + 2; y <= bandTop + 2 + faceH; y += 1) stairRows.push(y);
  for (const y of corridorRows) {
    for (let x = gx; x < gx + w; x += 1) {
      setLower(map, x, y, x === gx ? CASTLE_PAVE.L : x === gx + w - 1 ? CASTLE_PAVE.R : CASTLE_PAVE.C);
      setUpper(map, x, y, TILE.EMPTY);
    }
  }
  for (const y of stairRows) {
    for (let x = gx; x < gx + w; x += 1) {
      setLower(map, x, y, x === gx ? CASTLE_GATE.STAIR_L : x === gx + w - 1 ? CASTLE_GATE.STAIR_R : CASTLE_GATE.STAIR_M);
      setUpper(map, x, y, TILE.EMPTY);
    }
  }
  return { x: gx, w, corridorRows, stairRows };
}

/** 아치문: 정면 하단 81 자리에 359 가로 페어(위 51·데크는 유지되는 벽내 문). */
export function paintArchDoor(map: GameMap, x: number, y81: number): boolean {
  if (getLower(map, x, y81) !== CASTLE_FACE.BOT || getLower(map, x + 1, y81) !== CASTLE_FACE.BOT) return false;
  setLower(map, x, y81, CASTLE_GATE.ARCH);
  setLower(map, x + 1, y81, CASTLE_GATE.ARCH);
  return true;
}

/**
 * 정본 규칙 4: 배너 179+209 세로 페어, step 간격. 순정 데크 하변(109) + 정면 51 + upper 빈 칸에만.
 * 모서리·타워·계단 칸은 가드가 자동 제외한다. 반환 = 시공한 페어 수.
 */
export function paintBanners(
  map: GameMap,
  x0: number,
  x1: number,
  capRow: number,
  skip: ReadonlyArray<readonly [number, number]> = [],
  step = 3,
): number {
  let pairs = 0;
  for (let x = x0; x <= x1; x += step) {
    if (skip.some(([a, b]) => x >= a && x <= b)) continue;
    if (getLower(map, x, capRow) !== CASTLE_DECK.B) continue;
    if (getLower(map, x, capRow + 1) !== CASTLE_FACE.MID) continue;
    if (getUpper(map, x, capRow) > 0 || getUpper(map, x, capRow + 1) > 0) continue;
    setUpper(map, x, capRow, CASTLE_BANNER.TOP);
    setUpper(map, x, capRow + 1, CASTLE_BANNER.BOT);
    pairs += 1;
  }
  return pairs;
}

// ── 성채 스탬프(정본 레이아웃) ──

export type CastleStampOptions = {
  /** 시공 영역(맵 안 사각형). 최소 28×24. */
  area: Rect;
  /** 정면 벽 높이(51×(n-1)+81, 기본 2 = 정본 2층). 2~4. */
  wallHeight?: number;
  /** 남문 폭(기본 8 = 정본 실측). 4~10. */
  gateWidth?: number;
  /** 성문 협곽 매립 타워(기본 true). */
  roundTower?: boolean;
  /** @deprecated 정본 타워 스택은 8행 고정 — 값은 무시된다. */
  roundTowerHeight?: number;
};

export type CastleStampResult = {
  ok: true;
  area: Rect;
  outer: Rect;
  courtyard: Rect;
  keep: Rect;
  gate: { x: number; y: number; w: number };
  roundTowerAt: { x: number; y: number; h: number } | null;
  towers: CastleTowerRecord[];
  gateRecords: CastleGateRecord[];
  banners: number;
  faceH: number;
  stats: {
    roofCells: number;
    wallCells: number;
    towerCells: number;
  };
};

const MIN_AREA_W = 28;
const MIN_AREA_H = 24;

export function stampCastle(map: GameMap, options: CastleStampOptions): CastleStampResult | { ok: false; reason: string } {
  const area = options.area;
  if (area.w < MIN_AREA_W || area.h < MIN_AREA_H) {
    return { ok: false, reason: `성채 시공 영역은 최소 ${MIN_AREA_W}x${MIN_AREA_H} 필요합니다 (받은 ${area.w}x${area.h})` };
  }
  if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height) {
    return { ok: false, reason: `성채 영역이 맵 밖입니다: ${area.x},${area.y} ${area.w}x${area.h}` };
  }

  const faceH = clampInt(options.wallHeight ?? 2, 2, 4);
  const wantTower = options.roundTower !== false;

  // 링 아래 예약: 정면 faceH + (타워 돌출 8행-1 | 접근로 3행)
  const margin = 1;
  const reserve = wantTower ? Math.max(faceH + 3, CANON_TOWER_HEIGHT) : faceH + 3;
  const ring: Rect = {
    x: area.x + margin,
    y: area.y + margin,
    w: area.w - margin * 2,
    h: area.h - margin * 2 - reserve,
  };
  if (ring.w < 22 || ring.h < 12) {
    return { ok: false, reason: `성곽 링이 너무 작습니다 (${ring.w}x${ring.h}) — area를 키우세요` };
  }

  const gateW = clampInt(options.gateWidth ?? 8, 4, Math.min(10, ring.w - 10));

  // 1) 잔디 바탕 — 마당 통행 보장
  fillLower(map, area.x, area.y, area.w, area.h, TILE.GRASS);
  clearUpper(map, area.x, area.y, area.w, area.h);

  // 2) 커튼월 링 + 킵(북 밴드에 남쪽으로 붙여 연속 띠로 병합) — 정면 자동
  const keepW = clampInt(Math.floor(ring.w * 0.35), 8, 16);
  const keepExtra = Math.max(1, Math.min(4, Math.floor((ring.h - 12) / 3)));
  const keepDepth = 3 + keepExtra;
  const keepX = ring.x + Math.floor((ring.w - keepW) / 2);
  const cells = deckRingCells(ring.x, ring.y, ring.w, ring.h);
  addDeckRect(cells, keepX, ring.y, keepW, keepDepth);
  const painted = paintDeckBlock(map, cells, faceH);

  const keep: Rect = { x: keepX, y: ring.y, w: keepW, h: keepDepth + faceH };
  const bandTop = ring.y + ring.h - 3;
  const courtyard: Rect = {
    x: ring.x + 3,
    y: ring.y + keepDepth + faceH + 1,
    w: ring.w - 6,
    h: bandTop - (ring.y + keepDepth + faceH + 1),
  };

  // 3) 킵 아치문(정면 하단 81 자리 — 남문과 같은 축)
  paintArchDoor(map, keepX + Math.floor(keepW / 2) - 1, ring.y + keepDepth + faceH - 1);

  // 4) 성문(전 층 관통 대계단) + 협곽 매립 타워
  const gateX = ring.x + Math.floor((ring.w - gateW) / 2);
  const gateRecord = paintGateStair(map, gateX, gateW, bandTop, faceH);
  const capRow = bandTop + 2;

  const towers: CastleTowerRecord[] = [];
  let towerCells = 0;
  if (wantTower) {
    for (const tx of [gateX - 2, gateX + gateW]) {
      const tower = paintTowerEmbedded(map, tx, capRow);
      if ("capRow" in tower) {
        towers.push(tower);
        towerCells += tower.h * 2;
      }
    }
  }

  // 5) 배너(마지막 — upper) : 남 커튼 정면 + 킵 정면 + 북 밴드 안쪽 정면
  let banners = 0;
  banners += paintBanners(map, ring.x + 1, ring.x + ring.w - 2, capRow, [[gateX - 2, gateX + gateW + 1]]);
  const keepCapRow = ring.y + keepDepth - 1;
  const keepArchX = keepX + Math.floor(keepW / 2) - 1;
  banners += paintBanners(map, keepX + 1, keepX + keepW - 2, keepCapRow, [[keepArchX - 1, keepArchX + 2]]);
  banners += paintBanners(map, ring.x + 1, ring.x + ring.w - 2, ring.y + 2);

  const roundTowerAt = towers.length > 0
    ? { x: towers[0]!.x, y: towers[0]!.capRow, h: towers[0]!.h }
    : null;

  return {
    ok: true,
    area,
    outer: ring,
    courtyard,
    keep,
    gate: { x: gateX, y: capRow, w: gateW },
    roundTowerAt,
    towers,
    gateRecords: [gateRecord],
    banners,
    faceH,
    stats: {
      roofCells: painted.deckCells,
      wallCells: painted.faceCells,
      towerCells,
    },
  };
}

// ── 문법 린트(하네스 품질 게이트) ──

export type CastleGrammarCheck = { key: string; label: string; pass: boolean; detail: string };

/**
 * 정본 문법 린트 — evaluateCastle이 하네스 게이트로 쓴다. area 사각형 안만 검사한다.
 * (a) 정면 열 위 데크(109·49·19) 존재 + 51×n+81|359 구성(다단 적층 허용)
 * (b) 타일 21 사용 0  (c) 타워가 데크 상변·보행면을 절단하지 않음
 * (d) 캡·베이스 아래 lower 보존  (e) 타워 스택(캡·목·몸/창 교대·베이스)
 * (f) 배너 179+209 페어 완전성  (g) 성문 전 층 관통  (h) 데크 명암 변형 48/79/50 사용 0
 */
export function lintCastleGrammar(
  map: GameMap,
  opts: {
    area: Rect;
    towers?: readonly CastleTowerRecord[];
    gates?: readonly CastleGateRecord[];
  },
): CastleGrammarCheck[] {
  const { area } = opts;
  const towers = opts.towers ?? [];
  const gates = opts.gates ?? [];
  const checks: CastleGrammarCheck[] = [];
  const x0 = area.x, x1 = area.x + area.w - 1;
  const y0 = area.y, y1 = area.y + area.h - 1;
  const lower = (x: number, y: number): number => getLower(map, x, y);
  const upper = (x: number, y: number): number => getUpper(map, x, y);

  // (a) 정면 세로 런 위 데크 존재 + 구성
  {
    const bad: string[] = [];
    let runs = 0;
    for (let x = x0; x <= x1; x += 1) {
      let y = y0;
      while (y <= y1) {
        if (!FACE_RUN_SET.has(lower(x, y))) { y += 1; continue; }
        const runTop = y;
        while (y <= y1 && FACE_RUN_SET.has(lower(x, y))) y += 1;
        const runBot = y - 1;
        runs += 1;
        let ok = true;
        for (let yy = runTop; yy < runBot; yy += 1) if (lower(x, yy) !== CASTLE_FACE.MID) ok = false;
        if (lower(x, runBot) !== CASTLE_FACE.BOT && lower(x, runBot) !== CASTLE_GATE.ARCH) ok = false;
        // 위로 걷기: 109 → 49+ → (19 | 상단 적층 정면) — 다단 데크 적층 허용
        let yy = runTop - 1;
        let guard = 0;
        let reachedTop = false;
        while (guard < map.height) {
          guard += 1;
          if (!DECK_BOT_SET.has(lower(x, yy))) { ok = false; break; }
          yy -= 1;
          let sawWalk = false;
          while (WALK_SET.has(lower(x, yy))) { sawWalk = true; yy -= 1; }
          if (!sawWalk) { ok = false; break; }
          if (DECK_TOP_SET.has(lower(x, yy))) { reachedTop = true; break; }
          if (lower(x, yy) !== CASTLE_FACE.BOT && lower(x, yy) !== CASTLE_GATE.ARCH) { ok = false; break; }
          yy -= 1;
          while (lower(x, yy) === CASTLE_FACE.MID) yy -= 1;
        }
        if (!reachedTop) ok = false;
        if (!ok) bad.push(`x${x}:y${runTop}-${runBot}`);
      }
    }
    checks.push({
      key: "a",
      label: "정면 열 위 데크(109·49·19) 존재 + 51×n+81 구성",
      pass: bad.length === 0,
      detail: bad.length ? `위반 ${bad.slice(0, 8).join(", ")}` : `정면 세로 런 ${runs}개 전수 통과`,
    });
  }

  // (b) 타일 21 사용 0
  {
    let count = 0;
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      if (lower(x, y) === CASTLE_WALL.TOP) count += 1;
      if (upper(x, y) === CASTLE_WALL.TOP) count += 1;
    }
    checks.push({ key: "b", label: "타일 21(정면 상단 구본) 사용 0회", pass: count === 0, detail: `21 출현 ${count}회` });
  }

  // (c) 타워가 데크 상변·보행면을 절단하지 않음
  {
    const bad: string[] = [];
    for (const t of towers) {
      for (const x of [t.x, t.x + 1]) {
        let yy = t.capRow - 1;
        let sawWalk = false;
        while (WALK_SET.has(lower(x, yy))) { sawWalk = true; yy -= 1; }
        if (!sawWalk || !DECK_TOP_SET.has(lower(x, yy))) bad.push(`tower(${t.x},${t.capRow})x${x}`);
      }
    }
    checks.push({
      key: "c",
      label: "데크 상변·보행면 행 무절단(타워 열 상부 무결)",
      pass: bad.length === 0,
      detail: bad.length ? bad.join(", ") : `타워 ${towers.length}기 × 2열 전수 통과`,
    });
  }

  // (d) 캡·베이스 lower 보존
  {
    const bad: string[] = [];
    for (const t of towers) {
      for (let i = 0; i < 2; i += 1) {
        if (lower(t.x + i, t.capRow) !== t.capUnder[i]) bad.push(`cap(${t.x + i},${t.capRow})`);
        if (lower(t.x + i, t.baseRow) !== t.baseUnder[i]) bad.push(`base(${t.x + i},${t.baseRow})`);
      }
    }
    checks.push({
      key: "d",
      label: "캡·베이스 아래 lower 보존(잔디 강제 금지)",
      pass: bad.length === 0,
      detail: bad.length ? bad.join(", ") : `타워 ${towers.length}기 보존 확인`,
    });
  }

  // (e) 타워 스택: 캡(상위) → 목 → 몸/창 교대 → 베이스(상위)
  {
    const bad: string[] = [];
    for (const t of towers) {
      if (upper(t.x, t.capRow) !== CASTLE_ROUND_TOWER.CAP_L || upper(t.x + 1, t.capRow) !== CASTLE_ROUND_TOWER.CAP_R) {
        bad.push(`cap(${t.x},${t.capRow})`);
      }
      if (lower(t.x, t.capRow + 1) !== CASTLE_ROUND_TOWER.NECK_L || lower(t.x + 1, t.capRow + 1) !== CASTLE_ROUND_TOWER.NECK_R) {
        bad.push(`neck(${t.x},${t.capRow + 1})`);
      }
      for (let i = 2; i < t.h - 1; i += 1) {
        const win = i % 2 === 1;
        const wantL = win ? CASTLE_ROUND_TOWER.WIN_L : CASTLE_ROUND_TOWER.BODY_L;
        const wantR = win ? CASTLE_ROUND_TOWER.WIN_R : CASTLE_ROUND_TOWER.BODY_R;
        if (lower(t.x, t.capRow + i) !== wantL || lower(t.x + 1, t.capRow + i) !== wantR) {
          bad.push(`row(${t.x},${t.capRow + i})`);
        }
      }
      if (upper(t.x, t.baseRow) !== CASTLE_ROUND_TOWER.BASE_L || upper(t.x + 1, t.baseRow) !== CASTLE_ROUND_TOWER.BASE_R) {
        bad.push(`base(${t.x},${t.baseRow})`);
      }
    }
    checks.push({
      key: "e",
      label: "타워 스택(캡·목·몸/창 교대·베이스) 정본 일치",
      pass: bad.length === 0,
      detail: bad.length ? bad.slice(0, 6).join(", ") : `타워 ${towers.length}기 스택 전수 일치`,
    });
  }

  // (f) 배너 페어 완전성
  {
    const bad: string[] = [];
    let pairs = 0;
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      if (upper(x, y) === CASTLE_BANNER.TOP) {
        if (upper(x, y + 1) !== CASTLE_BANNER.BOT) bad.push(`179@(${x},${y})`);
        else pairs += 1;
      }
      if (upper(x, y) === CASTLE_BANNER.BOT && upper(x, y - 1) !== CASTLE_BANNER.TOP) bad.push(`209@(${x},${y})`);
    }
    checks.push({
      key: "f",
      label: "배너 179+209 세로 페어 완전성",
      pass: bad.length === 0,
      detail: bad.length ? bad.slice(0, 6).join(", ") : `페어 ${pairs}쌍 — 반쪽 배너 0`,
    });
  }

  // (g) 성문 전 층 관통(계단 열 잔재 0 · 회랑 포석)
  {
    const bad: string[] = [];
    const residue = new Set<number>([...DECK_ANY_SET, CASTLE_WALL.TOP, CASTLE_FACE.MID, CASTLE_FACE.BOT, 48, 50, 79]);
    for (const gate of gates) {
      for (const y of gate.stairRows) {
        for (let x = gate.x; x < gate.x + gate.w; x += 1) {
          const want = x === gate.x ? CASTLE_GATE.STAIR_L : x === gate.x + gate.w - 1 ? CASTLE_GATE.STAIR_R : CASTLE_GATE.STAIR_M;
          if (lower(x, y) !== want) bad.push(`stair(${x},${y})=${lower(x, y)}`);
        }
      }
      for (const y of gate.corridorRows) {
        for (let x = gate.x; x < gate.x + gate.w; x += 1) {
          if (!PAVE_SET.has(lower(x, y))) bad.push(`corr(${x},${y})=${lower(x, y)}`);
        }
      }
      for (const y of [...gate.corridorRows, ...gate.stairRows]) {
        for (let x = gate.x; x < gate.x + gate.w; x += 1) {
          if (residue.has(lower(x, y))) bad.push(`residue(${x},${y})=${lower(x, y)}`);
        }
      }
    }
    checks.push({
      key: "g",
      label: "성문 전 층 관통(계단 열 잔재 0 · 회랑 포석)",
      pass: bad.length === 0,
      detail: bad.length ? bad.slice(0, 8).join(", ") : `대계단 문 ${gates.length}개 전수 통과`,
    });
  }

  // (h) 데크 명암 변형 48/79/50 사용 0 — 단일톤
  {
    let count = 0;
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const t = lower(x, y);
      if (t === 48 || t === 79 || t === 50) count += 1;
    }
    checks.push({ key: "h", label: "데크 명암 변형 48/79/50 사용 0 — 단일톤", pass: count === 0, detail: `출현 ${count}회` });
  }

  return checks;
}

// ── 평가(하네스 품질 게이트) ──

export type CastleEvalReport = {
  ok: boolean;
  score: number;
  issues: string[];
  grammar: { pass: boolean; checks: CastleGrammarCheck[] };
  metrics: {
    gateOpen: boolean;
    courtyardReachable: boolean;
    reachableGrass: number;
    roofCells: number;
    wallCells: number;
    towerCells: number;
  };
};

/**
 * 완성된 성채를 평가한다(하네스 품질 게이트). 구조 검사(문 개방·문→마당 도달성·시공량) +
 * 정본 문법 린트(lintCastleGrammar) 전 항목. 통행 = 잔디/포석/대계단/아치 + upper 빈 칸.
 */
export function evaluateCastle(map: GameMap, result: CastleStampResult): CastleEvalReport {
  const walkable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const lo = getLower(map, x, y);
    const passableLower = lo === TILE.GRASS || PAVE_SET.has(lo) || STAIR_SET.has(lo) || lo === CASTLE_GATE.ARCH;
    return passableLower && getUpper(map, x, y) <= 0;
  };
  const idx = (x: number, y: number): number => y * map.width + x;
  const issues: string[] = [];

  // 1) 성문 개방
  let gateOpen = result.gate.w > 0;
  for (let x = result.gate.x; x < result.gate.x + result.gate.w; x += 1) {
    if (!walkable(x, result.gate.y)) gateOpen = false;
  }
  if (!gateOpen) issues.push("성문이 통행 불가(벽으로 막힘)");

  // 2) 문 → 마당(keep 앞) 도달성 — 4-연결 BFS
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [];
  const northBound = result.keep.y;
  const southBound = result.gate.y + result.faceH + 4;
  for (let x = result.gate.x; x < result.gate.x + result.gate.w; x += 1) {
    if (walkable(x, result.gate.y)) {
      seen.add(idx(x, result.gate.y));
      queue.push([x, result.gate.y]);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (ny < northBound || ny > southBound) continue;
      if (!walkable(nx, ny)) continue;
      const k = idx(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  const reachableGrass = seen.size;
  const keepFrontX = Math.floor(result.keep.x + result.keep.w / 2);
  const keepFrontY = result.keep.y + result.keep.h + 1;
  const courtyardCenterX = result.courtyard.x + Math.floor(result.courtyard.w / 2);
  const courtyardCenterY = result.courtyard.y + Math.floor(result.courtyard.h / 2);
  const courtyardReachable = seen.has(idx(keepFrontX, keepFrontY)) || seen.has(idx(courtyardCenterX, courtyardCenterY));
  if (!courtyardReachable) issues.push("문에서 마당(keep 앞)까지 도달 불가 — 타워/벽이 통행을 막음");

  // 3) 시공 sanity
  if (result.stats.roofCells <= 0) issues.push("지붕/데크가 시공되지 않음");
  if (result.stats.wallCells <= 0) issues.push("성벽 정면이 시공되지 않음");

  // 4) 정본 문법 린트
  const checks = lintCastleGrammar(map, { area: result.area, towers: result.towers, gates: result.gateRecords });
  const failed = checks.filter((check) => !check.pass);
  for (const check of failed) issues.push(`문법(${check.key}) ${check.label} — ${check.detail}`);

  const score = Math.max(0, 100 - issues.length * 25);
  return {
    ok: issues.length === 0,
    score,
    issues,
    grammar: { pass: failed.length === 0, checks },
    metrics: {
      gateOpen,
      courtyardReachable,
      reachableGrass,
      roofCells: result.stats.roofCells,
      wallCells: result.stats.wallCells,
      towerCells: result.stats.towerCells,
    },
  };
}

// ── 구본 호환 스탬프(스크립트/테스트 호환 — 새 코드는 위 정본 스탬프를 쓸 것) ──

/** 성 지붕/여장 직사각(단일톤 정본판 — 예전 명암 교대 제거). 최소 2×2. */
export function paintRoofDeck(map: GameMap, x0: number, y0: number, w: number, h: number): number {
  const cells: DeckCells = new Set();
  addDeckRect(cells, x0, y0, Math.max(2, w), Math.max(2, h));
  let n = 0;
  const has = (x: number, y: number): boolean => cells.has(cellKey(x, y));
  for (const k of cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const N = has(x, y - 1), S = has(x, y + 1), W = has(x - 1, y), E = has(x + 1, y);
    let tile: number = CASTLE_DECK.WALK;
    if (!N && !W) tile = CASTLE_DECK.TL;
    else if (!N && !E) tile = CASTLE_DECK.TR;
    else if (!S && !W) tile = CASTLE_DECK.BL;
    else if (!S && !E) tile = CASTLE_DECK.BR;
    else if (!N) tile = CASTLE_DECK.T;
    else if (!S) tile = CASTLE_DECK.B;
    else if (!W) tile = CASTLE_DECK.L;
    else if (!E) tile = CASTLE_DECK.R;
    setLower(map, x, y, tile);
    n += 1;
  }
  return n;
}

/**
 * @deprecated 정본 스택은 paintTowerEmbedded(벽선 매립)다. 이 함수는 독립 타워용 —
 * 정본대로 캡·베이스 아래 lower를 보존하고(잔디 강제 제거) 창은 한 행 걸러 교대한다.
 */
export function paintRoundTower(map: GameMap, x: number, y: number, height: number): number {
  const h = Math.max(5, height);
  let n = 0;
  setUpper(map, x, y, CASTLE_ROUND_TOWER.CAP_L);
  setUpper(map, x + 1, y, CASTLE_ROUND_TOWER.CAP_R);
  n += 2;
  setLower(map, x, y + 1, CASTLE_ROUND_TOWER.NECK_L);
  setLower(map, x + 1, y + 1, CASTLE_ROUND_TOWER.NECK_R);
  setUpper(map, x, y + 1, TILE.EMPTY);
  setUpper(map, x + 1, y + 1, TILE.EMPTY);
  n += 2;
  const baseY = y + h - 1;
  for (let i = 2; i < h - 1; i += 1) {
    const win = i % 2 === 1;
    setLower(map, x, y + i, win ? CASTLE_ROUND_TOWER.WIN_L : CASTLE_ROUND_TOWER.BODY_L);
    setLower(map, x + 1, y + i, win ? CASTLE_ROUND_TOWER.WIN_R : CASTLE_ROUND_TOWER.BODY_R);
    setUpper(map, x, y + i, TILE.EMPTY);
    setUpper(map, x + 1, y + i, TILE.EMPTY);
    n += 2;
  }
  setUpper(map, x, baseY, CASTLE_ROUND_TOWER.BASE_L);
  setUpper(map, x + 1, baseY, CASTLE_ROUND_TOWER.BASE_R);
  n += 2;
  return n;
}

// ── 내부 유틸 ──

function fillLower(map: GameMap, x0: number, y0: number, w: number, h: number, tile: number): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setLower(map, x, y, tile);
  }
}

function clearUpper(map: GameMap, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setUpper(map, x, y, TILE.EMPTY);
  }
}

function getLower(map: GameMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return -999;
  return map.lowerTiles[y * map.width + x] ?? -999;
}

function getUpper(map: GameMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 0;
  return map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}
