import { isForestHarmonyTileset } from "@/project/defaults/forestHarmony";
// editor/tools/village/relief.ts
// 마을 지형 고저차 — 언덕(단구)을 계획하고 「합본 마을+레트로 월드맵」 혼합 칩셋의 절벽 어휘로 그린다.
//
// 왜 있는가(2026-09-18): 사용자 「언덕도 만들고 고저차도 만들고 대각 언덕도 만들어라」. 합본 마을 칩셋에는
// 자연 절벽 타일이 없고, 레트로 월드맵 반쪽(ID +480)에 45° 경계 18·19·48·49 와 암벽 171~232 가 있다.
// 이 모듈은 그 어휘만 쓴다 — 다른 칩셋에서는 아무것도 그리지 않는다.
//
// 그리는 문법은 「비취 대계곡」(regionReferences/emerald-basin.json) 손배치 절벽에서 뽑은 남향 벽 문법(cliffGrammar.ts)이다.
// 2026-09-27: 예전엔 대지를 한 칸 팽창한 띠(231)를 북·서·동에도 둘러, 참고 맵에 없는 이웃 쌍이 수백 개 나왔다
// (오른쪽 대각 몸통 231, 231 위 잔디, 108/110 세로 줄). 참고 맵의 절벽은 남쪽 벽뿐이라 지금은 대지의 남쪽 윤곽만 벽으로 세운다.
//
// 기하: 언덕(대지)은 모서리를 45° 로 깎은 직사각형(chamfered rect)의 합집합이다. 칸 경계 x 마다 남쪽 윤곽 행을 재서
// 윗선으로 삼고, 그 아래 2칸(172 한 줄 + 202 한 줄)이 벽이다. 맵·구역 가장자리가 아닌 벽 끝은 비탈로 땅에 묻는다.
//
// 통행: 벽(몸통·발·대각 윗선)은 막힌다. 평평한 윗선 139 와 대지 위·북쪽은 잔디 그대로라 다른 도구가 평지처럼 다룬다.
// 길은 벽을 지나갈 수 있고, 평평한 열을 지난 자리는 돌계단 374 가 된다.

import { mulberry32, type Rng } from "@/util/rng";
import { RETRO_WORLD_CLIFF_WALKABLE_TILES, RETRO_WORLD_TILE_OFFSET, TILE } from "@/project/defaults/constants";
import type { GameMap, TilesetDef } from "@/project/types";
import type { Rect } from "./constants";
import { buildWall, CLIFF_TILE, type WallCell } from "./cliffGrammar";

export const RELIEF_STYLES = ["none", "hills"] as const;
export type ReliefStyle = (typeof RELIEF_STYLES)[number];

export function isReliefStyle(value: unknown): value is ReliefStyle {
  return typeof value === "string" && (RELIEF_STYLES as readonly string[]).includes(value);
}

/** 레트로 월드맵 절벽 어휘(원본 ID). 혼합 칩셋에서는 RETRO_WORLD_TILE_OFFSET 을 더해 쓴다. 비취 대계곡과 같은 번호. */
export const RETRO_CLIFF = {
  /** 45° 경계 — 이름은 「잔디가 있는 쪽」. 반대쪽 반은 암벽. */
  grassNE: 18,
  grassNW: 19,
  grassSW: 48,
  grassSE: 49,
  /** 대지 윗선(잔디 위 절벽 테) — 남쪽 면 위. 모서리 138/140. */
  lip: 139,
  lipSW: 138,
  lipSE: 140,
  /** 대지 북·서·동 가장자리 테(잔디 위 가는 선). */
  edgeN: 79,
  edgeNW: 78,
  edgeNE: 80,
  edgeW: 108,
  edgeE: 110,
  /** 절벽 면 — 윗줄(테 있음)·바닥줄(그늘)·몸통(대각 구간·북서동 띠). */
  faceTop: 172,
  faceBottom: 202,
  body: 231,
  /** 돌계단 — 길이 절벽 면을 내려가는 칸. */
  stairs: 374,
} as const;

/** 혼합 칩셋에서 통행 가능으로 고쳐 쓰는 레트로 칸 — 정본은 defaults/constants 의 RETRO_WORLD_CLIFF_WALKABLE_TILES. */
export const RETRO_CLIFF_WALKABLE: readonly number[] = RETRO_WORLD_CLIFF_WALKABLE_TILES;

/** 혼합 칩셋(위 480 합본 마을 + 아래 480 레트로 월드맵)또는 그 구간을 보존한 숲마을인가. */
export function tilesetHasCliffVocabulary(tileset: Pick<TilesetDef, "image" | "count"> | undefined): boolean {
  return tileset !== undefined && tileset.image.type === "bundled"
    && (tileset.image.id === "tex_easyrpg_chipset_combined_town_retro_world" || isForestHarmonyTileset(tileset)) && tileset.count >= RETRO_WORLD_TILE_OFFSET * 2;
}

/** 모서리를 깎은 직사각형 — 좌표는 칸 모서리(x1,y1 은 배타). 깎기 값은 칸 수(0 = 직각). */
export interface ChamferRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly nw: number;
  readonly ne: number;
  readonly sw: number;
  readonly se: number;
}

export interface Plateau {
  readonly level: 1 | 2;
  readonly parts: readonly ChamferRect[];
}

/** 칸 분류 — 대지 윗면, 평평한 윗선(139, 걸을 수 있음), 벽(몸통·발·대각 윗선), 평지. */
export type ReliefCell = "top" | "lip" | "wall" | "ground";

/** 벽 한 열 — 돌계단 시공이 열 단위로 바꾼다. */
export interface ReliefColumn {
  readonly x: number;
  readonly flat: boolean;
  readonly cells: readonly WallCell[];
}

export interface ReliefPlan {
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** 칸별 높이(0 = 평지). */
  readonly level: Uint8Array;
  /** 칸별 분류. */
  readonly cells: ReliefCell[];
  /** 칸별 절벽 타일(원본 ID, -1 = 없음). */
  readonly tiles: Int16Array;
  /** 집·밭·옆길이 못 쓰는 칸(벽) — 길은 지나갈 수 있다. */
  readonly cliff: ReadonlySet<number>;
  readonly columns: readonly ReliefColumn[];
  readonly plateaus: readonly Plateau[];
  readonly notes: readonly string[];
}

export interface ReliefArgs {
  readonly area: Rect;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly seed: number;
  /** 마을 중심부 — 언덕 띠가 들어오지 않는다(광장·녹지가 절벽에 잘리지 않게). */
  readonly avoid?: Rect;
  /** 2단 언덕(대지 위의 작은 둔덕)을 허용하는가. 기본 true. */
  readonly knoll?: boolean;
}

// ───────────────────────── 기하 ─────────────────────────

/** 칸 윗면 중심이 도형 안인가. */
function insideChamfer(r: ChamferRect, px: number, py: number): boolean {
  if (px <= r.x0 || px >= r.x1 || py <= r.y0 || py >= r.y1) return false;
  if (px - r.x0 + (py - r.y0) < r.nw) return false;
  if (r.x1 - px + (py - r.y0) < r.ne) return false;
  if (px - r.x0 + (r.y1 - py) < r.sw) return false;
  if (r.x1 - px + (r.y1 - py) < r.se) return false;
  return true;
}

/** 칸 경계 x=e 에서 도형 남쪽 윤곽의 행(e 가 도형 가로 범위 밖이면 undefined). 꼭짓점이 정수라 결과도 정수다. */
function southEdgeAt(r: ChamferRect, e: number): number | undefined {
  if (e < r.x0 || e > r.x1) return undefined;
  return r.y1 - Math.max(0, r.sw - (e - r.x0), r.se - (r.x1 - e));
}

/** 벽 높이(윗선 아래 칸 수) — 참고 맵의 1단 절벽은 172 한 줄 + 202 한 줄. */
const WALL_HEIGHT = 2;

// ───────────────────────── 계획 ─────────────────────────

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function chamferBounds(r: ChamferRect, pad: number): Rect {
  return { x: r.x0 - pad, y: r.y0 - pad, w: r.x1 - r.x0 + pad * 2, h: r.y1 - r.y0 + pad * 2 + 1 };
}

function rangeInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * 언덕 배치 — 씨앗으로 세 판형 중 하나: 북쪽 단구(폭 대부분을 가로지르는 대지 + 남쪽으로 튀어나온 곶),
 * 서쪽 또는 동쪽 어깨(세로 대지), 그리고 반대편 가장자리의 독립 둔덕. 전부 마을 중심부(avoid)를 피한다.
 */
export function planRelief(args: ReliefArgs): ReliefPlan {
  const { area, mapWidth, mapHeight } = args;
  const rng = mulberry32((args.seed ^ 0x5a17c0de) >>> 0);
  const notes: string[] = [];
  const avoid = args.avoid ?? { x: area.x + Math.floor(area.w * 0.3), y: area.y + Math.floor(area.h * 0.3), w: Math.floor(area.w * 0.4), h: Math.floor(area.h * 0.4) };
  const plateaus: Plateau[] = [];
  const fits = (parts: readonly ChamferRect[]): boolean =>
    parts.every((part) => !rectsIntersect(chamferBounds(part, 2), avoid))
    && parts.every((part) => part.x1 - part.x0 >= 6 && part.y1 - part.y0 >= 5);

  // 판형은 씨앗 순서로 시도하되, 마을 중심부(avoid)에 걸리면 다음 판형으로 넘어간다.
  const first = rangeInt(rng, 0, 2);
  for (let step = 0; step < 3 && plateaus.length === 0; step += 1) {
    const variant = (first + step) % 3;
    if (variant === 0) {
      // ① 북쪽 단구 — 위쪽 가장자리 밖에서 시작해 북쪽 띠가 없다. 남쪽 변은 45° 로 내려온다.
      const depth = Math.max(8, Math.min(avoid.y - 4, Math.floor(area.h * 0.3) + rangeInt(rng, -2, 2)));
      const x0 = area.x - 2 + rangeInt(rng, 0, 3);
      const x1 = area.x + area.w + 2 - rangeInt(rng, 0, 3);
      const main: ChamferRect = { x0, y0: area.y - 3, x1, y1: area.y + depth, nw: 0, ne: 0, sw: rangeInt(rng, 3, 6), se: rangeInt(rng, 3, 6) };
      // 곶 — 단구 남쪽 변에서 4~7칸 튀어나온 작은 대지(모서리 45°). 중심부를 피해 좌·우 중 한쪽.
      const promW = rangeInt(rng, 9, 14);
      const promX0 = rng() < 0.5 ? x0 + rangeInt(rng, 4, 8) : x1 - rangeInt(rng, 4, 8) - promW;
      const prom: ChamferRect = { x0: promX0, y0: area.y + depth - 4, x1: promX0 + promW, y1: area.y + depth + rangeInt(rng, 4, 7), nw: 0, ne: 0, sw: rangeInt(rng, 2, 4), se: rangeInt(rng, 2, 4) };
      const parts = fits([main, prom]) ? [main, prom] : fits([main]) ? [main] : [];
      if (parts.length > 0) { plateaus.push({ level: 1, parts }); notes.push(`언덕: 북쪽 단구 깊이 ${depth}${parts.length > 1 ? " + 곶" : ""}`); }
    } else {
      // ② 서쪽/동쪽 어깨 — 가장자리 밖에서 시작하는 세로 대지. 안쪽 모서리는 45°.
      const west = variant === 1;
      const width = Math.max(8, Math.min(west ? avoid.x - area.x - 4 : area.x + area.w - (avoid.x + avoid.w) - 4, Math.floor(area.w * 0.28) + rangeInt(rng, -2, 2)));
      const y0 = area.y - 2 + rangeInt(rng, 0, 4);
      const y1 = area.y + area.h - rangeInt(rng, 6, 12);
      const shoulder: ChamferRect = west
        ? { x0: area.x - 3, y0, x1: area.x + width, y1, nw: 0, ne: rangeInt(rng, 2, 5), sw: 0, se: rangeInt(rng, 3, 6) }
        : { x0: area.x + area.w - width, y0, x1: area.x + area.w + 3, y1, nw: rangeInt(rng, 2, 5), ne: 0, sw: rangeInt(rng, 3, 6), se: 0 };
      if (fits([shoulder])) { plateaus.push({ level: 1, parts: [shoulder] }); notes.push(`언덕: ${west ? "서" : "동"}쪽 어깨 폭 ${width}`); }
    }
  }
  // ③ 반대편 독립 둔덕 — 네 모서리 전부 45°. 들어갈 자리가 없으면 생략.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const w = rangeInt(rng, 10, 16), h = rangeInt(rng, 6, 10);
    const x0 = area.x + 2 + Math.floor(rng() * Math.max(1, area.w - w - 4));
    const y0 = area.y + 2 + Math.floor(rng() * Math.max(1, area.h - h - 6));
    const mound: ChamferRect = { x0, y0, x1: x0 + w, y1: y0 + h, nw: rangeInt(rng, 2, 4), ne: rangeInt(rng, 2, 4), sw: rangeInt(rng, 2, 4), se: rangeInt(rng, 2, 4) };
    const clashes = plateaus.some((plateau) => plateau.parts.some((part) => rectsIntersect(chamferBounds(part, 4), chamferBounds(mound, 2))));
    if (!clashes && fits([mound])) { plateaus.push({ level: 1, parts: [mound] }); notes.push(`둔덕 ${w}×${h}`); break; }
  }
  // ④ 2단 — 첫 대지 안쪽에 여유가 있으면 작은 둔덕을 한 단 더 올린다(사방 4칸 여백).
  const base = plateaus[0]?.parts[0];
  if (base && (args.knoll ?? true)) {
    const innerW = base.x1 - base.x0 - 10, innerH = base.y1 - base.y0 - 10;
    if (innerW >= 7 && innerH >= 5) {
      const w = Math.min(innerW, rangeInt(rng, 7, 12)), h = Math.min(innerH, rangeInt(rng, 5, 8));
      const kx0 = Math.max(area.x + 3, base.x0 + 5 + Math.floor(rng() * Math.max(1, innerW - w)));
      const ky0 = Math.max(area.y + 3, base.y0 + 5 + Math.floor(rng() * Math.max(1, innerH - h)));
      const knoll: ChamferRect = { x0: kx0, y0: ky0, x1: kx0 + w, y1: ky0 + h, nw: rangeInt(rng, 1, 3), ne: rangeInt(rng, 1, 3), sw: rangeInt(rng, 1, 3), se: rangeInt(rng, 1, 3) };
      // 둔덕 전체(띠+면 포함)가 대지 안에 있어야 한다.
      const inside = [[kx0 - 2, ky0 - 2], [kx0 + w + 2, ky0 - 2], [kx0 - 2, ky0 + h + 3], [kx0 + w + 2, ky0 + h + 3]]
        .every(([px, py]) => insideChamfer(base, px! + 0.5, py! + 0.5));
      if (inside && fits([knoll])) { plateaus.push({ level: 2, parts: [knoll] }); notes.push(`2단 둔덕 ${w}×${h}`); }
    }
  }
  return rasterize(plateaus, mapWidth, mapHeight, area, notes);
}


/** 대지 목록을 칸 분류·높이·절벽 타일로 굽는다. 높은 단이 낮은 단 위에 덧그려진다. */
export function rasterize(plateaus: readonly Plateau[], mapWidth: number, mapHeight: number, area: Rect, notes: readonly string[] = []): ReliefPlan {
  const level = new Uint8Array(mapWidth * mapHeight);
  const cells: ReliefCell[] = new Array<ReliefCell>(mapWidth * mapHeight).fill("ground");
  const tiles = new Int16Array(mapWidth * mapHeight).fill(-1);
  const cliff = new Set<number>();
  const columns: ReliefColumn[] = [];
  const ax0 = Math.max(0, area.x), ax1 = Math.min(mapWidth, area.x + area.w);
  const ay0 = Math.max(0, area.y), ay1 = Math.min(mapHeight, area.y + area.h);
  const inArea = (x: number, y: number) => x >= ax0 && x < ax1 && y >= ay0 && y < ay1;
  let walls = 0;
  for (const plateau of [...plateaus].sort((a, b) => a.level - b.level)) {
    // 윗면 — 칸 중심이 도형 안.
    for (let y = ay0; y < ay1; y += 1) {
      for (let x = ax0; x < ax1; x += 1) {
        if (!plateau.parts.some((part) => insideChamfer(part, x + 0.5, y + 0.5))) continue;
        const index = y * mapWidth + x;
        cells[index] = "top"; tiles[index] = -1; level[index] = plateau.level; cliff.delete(index);
      }
    }
    // 남쪽 윤곽 — 경계 e 마다 겹친 도형 중 가장 남쪽 변. 연속 구간 하나가 벽 하나다.
    const edge = (e: number): number | undefined => {
      let best: number | undefined;
      for (const part of plateau.parts) {
        const v = southEdgeAt(part, e);
        if (v !== undefined && (best === undefined || v > best)) best = v;
      }
      return best;
    };
    let e = ax0;
    while (e <= ax1) {
      if (edge(e) === undefined) { e += 1; continue; }
      const xa = e;
      while (e + 1 <= ax1 && edge(e + 1) !== undefined) e += 1;
      const xb = e;
      e += 1;
      if (xb - xa < 1) continue;
      const rawLip = Array.from({ length: xb - xa + 1 }, (_, i) => edge(xa + i)!);
      // 구역·맵 가장자리에서 잘린 끝은 드러나지 않는다(벽이 화면 밖으로 이어진다).
      const exposedLeft = xa > ax0 || plateau.parts.every((part) => part.x0 >= xa);
      const exposedRight = xb < ax1 || plateau.parts.every((part) => part.x1 <= xb);
      const wall = buildWall({ xa, xb, rawLip, height: WALL_HEIGHT, exposedLeft, exposedRight });
      walls += 1;
      const byColumn = new Map<number, WallCell[]>();
      for (const cell of wall.cells) {
        if (!inArea(cell.x, cell.y)) continue;
        const index = cell.y * mapWidth + cell.x;
        tiles[index] = cell.tile;
        if (cell.role === "lip") {
          cells[index] = "lip"; level[index] = plateau.level; cliff.delete(index);
        } else {
          cells[index] = "wall"; level[index] = plateau.level - 1; cliff.add(index);
        }
        byColumn.set(cell.x, [...byColumn.get(cell.x) ?? [], cell]);
      }
      for (const [x, list] of byColumn) columns.push({ x, flat: list.some((cell) => cell.role === "lip") && list.some((cell) => cell.role === "foot") && !list.some((cell) => cell.tile === CLIFF_TILE.capLeftFace || cell.tile === CLIFF_TILE.capRightFoot), cells: list });
    }
  }
  const counts = { top: 0, lip: 0, wall: 0 };
  for (const kind of cells) if (kind !== "ground") counts[kind] += 1;
  return {
    mapWidth, mapHeight, level, cells, tiles, cliff, columns, plateaus,
    notes: [...notes, `고저차: 대지 ${counts.top}칸 윗선 ${counts.lip} 벽 ${counts.wall} (남향 벽 ${walls}개)`],
  };
}

// ───────────────────────── 시공 ─────────────────────────

/**
 * 절벽 타일을 lower 레이어에 그린다(비취 대계곡 남향 벽 문법, cliffGrammar.ts). 잔디(240) 칸만 바꾼다 — 물·기존 시공은 건드리지 않는다.
 */
export function paintRelief(map: GameMap, plan: ReliefPlan, tileOffset: number = RETRO_WORLD_TILE_OFFSET): { painted: number } {
  let painted = 0;
  for (let index = 0; index < plan.tiles.length; index += 1) {
    const tile = plan.tiles[index]!;
    if (tile < 0) continue;
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
    map.lowerTiles[index] = tile + tileOffset;
    map.upperTiles[index] = TILE.EMPTY;
    painted += 1;
  }
  return { painted };
}

/**
 * 길이 지나간 평평한 벽 열의 몸통·발을 돌계단 374 로 바꾼다 — 참고 맵처럼 윗선 칸은 길 그대로 둔다.
 * 대각·벽 끝 열을 지난 길은 모래 그대로(비탈로 읽힌다). 길 시공 뒤에 부른다.
 */
export function paintReliefStairs(map: GameMap, plan: ReliefPlan, isRoadTile: (tile: number) => boolean, tileOffset: number = RETRO_WORLD_TILE_OFFSET): number {
  let stairs = 0;
  for (const column of plan.columns) {
    if (!column.flat) continue;
    const below = column.cells.filter((cell) => cell.role === "body" || cell.role === "foot");
    const crossed = column.cells.some((cell) => isRoadTile(map.lowerTiles[cell.y * map.width + cell.x] ?? TILE.EMPTY));
    if (!crossed) continue;
    for (const cell of below) {
      const index = cell.y * map.width + cell.x;
      map.lowerTiles[index] = CLIFF_TILE.stairs + tileOffset;
      map.upperTiles[index] = TILE.EMPTY;
      stairs += 1;
    }
  }
  return stairs;
}
