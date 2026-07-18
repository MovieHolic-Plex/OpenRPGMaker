// 성채 모듈 결정론 스탬프 — Combined Town 금본(map_castle_keep) 문법.
// 타일 선택은 전부 여기; LLM/툴은 영역·옵션만 넘긴다.

import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

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

export type Rect = { x: number; y: number; w: number; h: number };

export type CastleStampOptions = {
  /** 시공 영역(맵 안 사각형). 최소 28×24 권장. */
  area: Rect;
  /** 성벽 정면 높이(기본 3 = 21/51/81). 최소 2. */
  wallHeight?: number;
  /** 남문 폭(기본 4). */
  gateWidth?: number;
  /** 원형 타워 배치(기본 true). */
  roundTower?: boolean;
  /** 원형 타워 전체 높이(캡+몸+베이스, 기본 7, 최소 5). */
  roundTowerHeight?: number;
};

export type CastleStampResult = {
  ok: true;
  outer: Rect;
  courtyard: Rect;
  keep: Rect;
  gate: { x: number; y: number; w: number };
  roundTowerAt: { x: number; y: number; h: number } | null;
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

  const wallH = clampInt(options.wallHeight ?? 3, 2, 6);
  const gateW = clampInt(options.gateWidth ?? 4, 2, Math.min(8, Math.floor(area.w / 4)));
  const wantTower = options.roundTower !== false;
  const towerH = clampInt(options.roundTowerHeight ?? 7, 5, Math.min(12, area.h - 10));

  // 남쪽 커튼 정면 벽 높이 — 금본 문법: 커튼은 "윗면 데크(성벽 위) + 정면 벽"의 2층 구조다.
  const southFaceH = Math.max(2, Math.min(wallH, 4));

  // 외곽 프레임 (영역 안 1칸 여유 — 남쪽은 정면 벽 + 접근로 3칸을 area에 포함)
  const margin = 1;
  const outer: Rect = {
    x: area.x + margin,
    y: area.y + margin,
    w: area.w - margin * 2,
    h: area.h - margin * 2 - 3 - southFaceH,
  };
  if (outer.w < 22 || outer.h < 14) {
    return { ok: false, reason: `외성 프레임이 너무 작습니다 (${outer.w}x${outer.h}) — area를 키우세요` };
  }

  const roofTopH = 2;
  const roofBotH = 3;
  const sideW = 2;

  // 1) 잔디 바탕(영역) — 마당 통행 보장
  fillLower(map, area.x, area.y, area.w, area.h, TILE.GRASS);
  clearUpper(map, area.x, area.y, area.w, area.h);

  let roofCells = 0;
  let wallCells = 0;
  let towerCells = 0;

  // 2) 외곽 지붕/여장 프레임 (속이 빈 직사각)
  roofCells += paintRoofDeck(map, outer.x, outer.y, outer.w, roofTopH);
  roofCells += paintRoofDeck(map, outer.x, outer.y + outer.h - roofBotH, outer.w, roofBotH);
  roofCells += paintRoofDeck(map, outer.x, outer.y + roofTopH, sideW, outer.h - roofTopH - roofBotH);
  roofCells += paintRoofDeck(
    map,
    outer.x + outer.w - sideW,
    outer.y + roofTopH,
    sideW,
    outer.h - roofTopH - roofBotH,
  );

  // 3) 본채 — 북쪽 중앙 지붕 + 정면 성벽
  const keepW = Math.max(8, Math.min(14, Math.floor(outer.w * 0.35)));
  const keepRoofH = 3;
  const keepX = outer.x + Math.floor((outer.w - keepW) / 2);
  const keepY = outer.y + roofTopH;
  const keep: Rect = { x: keepX, y: keepY, w: keepW, h: keepRoofH + wallH };
  roofCells += paintRoofDeck(map, keep.x, keep.y, keep.w, keepRoofH);
  wallCells += paintWallFaceRow(map, keep.x, keep.y + keepRoofH, keep.w, wallH);

  // 북·남 안쪽 커튼 성벽 (남문은 갭)
  const gateX = outer.x + Math.floor((outer.w - gateW) / 2);
  const northWallY = outer.y + roofTopH;
  // 본채 좌우 북벽 (본채와 겹치지 않는 구간만)
  wallCells += paintWallFaceRow(map, outer.x + sideW, northWallY, keepX - (outer.x + sideW), Math.min(2, wallH));
  wallCells += paintWallFaceRow(
    map,
    keepX + keepW,
    northWallY,
    outer.x + outer.w - sideW - (keepX + keepW),
    Math.min(2, wallH),
  );

  // 남쪽 커튼 = 윗면 데크(outer 남변 3행, "성벽 위") + 그 아래 정면 벽(2026-07-17 교정:
  // 예전엔 정면 벽이 데크를 덮어써서 남쪽 성벽에 '위'가 없었다 — 금본은 2층 구조).
  const southDeckTop = outer.y + outer.h - roofBotH;
  const southFaceY = outer.y + outer.h;
  wallCells += paintWallFaceRow(map, outer.x, southFaceY, gateX - outer.x, southFaceH, { skipTop: true });
  wallCells += paintWallFaceRow(
    map,
    gateX + gateW,
    southFaceY,
    outer.x + outer.w - (gateX + gateW),
    southFaceH,
    { skipTop: true },
  );

  // 문 통로 잔디 확보 — 남쪽 데크와 정면 벽을 관통한다.
  for (let y = southDeckTop; y < southFaceY + southFaceH; y += 1) {
    for (let x = gateX; x < gateX + gateW; x += 1) {
      setLower(map, x, y, TILE.GRASS);
      setUpper(map, x, y, TILE.EMPTY);
    }
  }

  const courtyard: Rect = {
    x: outer.x + sideW,
    y: keep.y + keep.h + 1,
    w: outer.w - sideW * 2,
    h: Math.max(4, southDeckTop - (keep.y + keep.h + 1) - 1),
  };

  // 4) 원형 타워 (마당 왼쪽)
  let roundTowerAt: CastleStampResult["roundTowerAt"] = null;
  if (wantTower && courtyard.w >= 8 && courtyard.h >= towerH + 1) {
    const tx = courtyard.x + 2;
    const ty = courtyard.y + Math.max(0, Math.floor((courtyard.h - towerH) / 2));
    towerCells += paintRoundTower(map, tx, ty, towerH);
    roundTowerAt = { x: tx, y: ty, h: towerH };
  }

  // 5) 남문 접근 잔디 정리 (길은 툴에서 paint_road)
  for (let y = southFaceY + southFaceH; y < area.y + area.h; y += 1) {
    for (let x = gateX; x < gateX + gateW; x += 1) {
      setLower(map, x, y, TILE.GRASS);
    }
  }

  return {
    ok: true,
    outer,
    courtyard,
    keep,
    gate: { x: gateX, y: southDeckTop, w: gateW },
    roundTowerAt,
    stats: { roofCells, wallCells, towerCells },
  };
}

/** 성 지붕/여장 직사각 (최소 2×2). */
export function paintRoofDeck(map: GameMap, x0: number, y0: number, w: number, h: number): number {
  const ww = Math.max(2, w);
  const hh = Math.max(2, h);
  let n = 0;
  for (let y = 0; y < hh; y += 1) {
    for (let x = 0; x < ww; x += 1) {
      const left = x === 0;
      const right = x === ww - 1;
      const top = y === 0;
      const bottom = y === hh - 1;
      // as const 리터럴 유니온에 묶이지 않도록 number로 승격
      let tile: number = CASTLE_ROOF.BODY;
      if (top && left) tile = CASTLE_ROOF.TL;
      else if (top && right) tile = CASTLE_ROOF.TR;
      else if (top) tile = CASTLE_ROOF.T;
      else if (bottom && left) tile = CASTLE_ROOF.BL;
      else if (bottom && right) tile = CASTLE_ROOF.BR;
      else if (bottom) tile = CASTLE_ROOF.B;
      else if (left) tile = y % 2 === 0 ? CASTLE_ROOF.L : CASTLE_ROOF.L2;
      else if (right) tile = y % 2 === 0 ? CASTLE_ROOF.BODY : CASTLE_ROOF.BODY2;
      else tile = y % 2 === 0 ? CASTLE_ROOF.FILL_LIGHT : CASTLE_ROOF.FILL_DARK;
      setLower(map, x0 + x, y0 + y, tile);
      n += 1;
    }
  }
  return n;
}

/** 성벽 정면 세로 띠: 상21 + 중51* + 하81. skipTop이면 중+하만(남 커튼용). */
export function paintWallFaceColumn(
  map: GameMap,
  x: number,
  yTop: number,
  height: number,
  opts: { skipTop?: boolean } = {},
): number {
  if (height < 1) return 0;
  let n = 0;
  if (height === 1) {
    setLower(map, x, yTop, CASTLE_WALL.BOT);
    return 1;
  }
  if (opts.skipTop) {
    for (let y = yTop; y < yTop + height - 1; y += 1) {
      setLower(map, x, y, CASTLE_WALL.MID);
      n += 1;
    }
    setLower(map, x, yTop + height - 1, CASTLE_WALL.BOT);
    n += 1;
    return n;
  }
  setLower(map, x, yTop, CASTLE_WALL.TOP);
  n += 1;
  for (let y = yTop + 1; y < yTop + height - 1; y += 1) {
    setLower(map, x, y, CASTLE_WALL.MID);
    n += 1;
  }
  setLower(map, x, yTop + height - 1, CASTLE_WALL.BOT);
  n += 1;
  return n;
}

export function paintWallFaceRow(
  map: GameMap,
  x0: number,
  yTop: number,
  w: number,
  height: number,
  opts: { skipTop?: boolean } = {},
): number {
  if (w <= 0) return 0;
  let n = 0;
  for (let x = x0; x < x0 + w; x += 1) n += paintWallFaceColumn(map, x, yTop, height, opts);
  return n;
}

/**
 * 원형 타워 2폭.
 * y = 캡 행. height ≥ 5: cap + neck + ≥1 body + window + ≥0 body + base.
 */
export function paintRoundTower(map: GameMap, x: number, y: number, height: number): number {
  const h = Math.max(5, height);
  let n = 0;
  // cap (upper over grass)
  setLower(map, x, y, TILE.GRASS);
  setLower(map, x + 1, y, TILE.GRASS);
  setUpper(map, x, y, CASTLE_ROUND_TOWER.CAP_L);
  setUpper(map, x + 1, y, CASTLE_ROUND_TOWER.CAP_R);
  n += 2;

  // neck
  setLower(map, x, y + 1, CASTLE_ROUND_TOWER.NECK_L);
  setLower(map, x + 1, y + 1, CASTLE_ROUND_TOWER.NECK_R);
  setUpper(map, x, y + 1, TILE.EMPTY);
  setUpper(map, x + 1, y + 1, TILE.EMPTY);
  n += 2;

  // body rows between neck and base; one window row in the middle of body
  const bodyStart = y + 2;
  const baseY = y + h - 1;
  const bodyEnd = baseY - 1; // inclusive
  const bodyRows = Math.max(1, bodyEnd - bodyStart + 1);
  const windowRel = Math.floor(bodyRows / 2); // relative index in body

  for (let i = 0; i < bodyRows; i += 1) {
    const yy = bodyStart + i;
    if (i === windowRel) {
      setLower(map, x, yy, CASTLE_ROUND_TOWER.WIN_L);
      setLower(map, x + 1, yy, CASTLE_ROUND_TOWER.WIN_R);
    } else {
      setLower(map, x, yy, CASTLE_ROUND_TOWER.BODY_L);
      setLower(map, x + 1, yy, CASTLE_ROUND_TOWER.BODY_R);
    }
    setUpper(map, x, yy, TILE.EMPTY);
    setUpper(map, x + 1, yy, TILE.EMPTY);
    n += 2;
  }

  // base upper
  setLower(map, x, baseY, TILE.GRASS);
  setLower(map, x + 1, baseY, TILE.GRASS);
  setUpper(map, x, baseY, CASTLE_ROUND_TOWER.BASE_L);
  setUpper(map, x + 1, baseY, CASTLE_ROUND_TOWER.BASE_R);
  n += 2;
  return n;
}

export type CastleEvalReport = {
  ok: boolean;
  score: number;
  issues: string[];
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
 * 완성된 성채를 평가한다(하네스 편입 없이 품질 게이트). 검사:
 *  - 성문 개방(문 칸이 통행 가능한가)
 *  - 문 → 마당 도달성(타워/벽이 마당 통행을 막지 않는가)
 *  - 지붕/성벽이 실제로 시공됐는가
 * 통행 = lower가 잔디(240)이고 upper가 비어있음(타워 베이스는 lower 잔디+upper 스프라이트 → 차단).
 */
export function evaluateCastle(map: GameMap, result: CastleStampResult): CastleEvalReport {
  const W = map.width;
  const idx = (x: number, y: number) => y * W + x;
  const walkable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < map.height
    && map.lowerTiles[idx(x, y)] === TILE.GRASS
    && (map.upperTiles[idx(x, y)] ?? TILE.EMPTY) <= 0;
  const issues: string[] = [];

  // 1) 성문 개방
  let gateOpen = result.gate.w > 0;
  for (let x = result.gate.x; x < result.gate.x + result.gate.w; x += 1) {
    if (!walkable(x, result.gate.y)) gateOpen = false;
  }
  if (!gateOpen) issues.push("성문이 통행 불가(벽으로 막힘)");

  // 2) 문 → 마당 도달성(잔디 4-연결 BFS, 남쪽 접근로 과확산 제한)
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [];
  const northBound = result.outer.y - 1;
  const southBound = result.gate.y + 3;
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
  // keep 바로 남쪽(마당) 칸이 문에서 도달 가능해야 성 안을 걸을 수 있다.
  const keepFrontX = Math.floor(result.keep.x + result.keep.w / 2);
  const keepFrontY = result.keep.y + result.keep.h;
  const courtyardReachable = seen.has(idx(keepFrontX, keepFrontY)) || reachableGrass >= result.courtyard.w * 2;
  if (!courtyardReachable) issues.push("문에서 마당(keep 앞)까지 도달 불가 — 타워/벽이 통행을 막음");

  // 3) 시공 sanity
  if (result.stats.roofCells <= 0) issues.push("지붕이 시공되지 않음");
  if (result.stats.wallCells <= 0) issues.push("성벽이 시공되지 않음");

  const score = Math.max(0, 100 - issues.length * 25);
  return {
    ok: issues.length === 0,
    score,
    issues,
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
