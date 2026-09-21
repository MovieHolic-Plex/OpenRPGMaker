import { isForestHarmonyTileset } from "@/project/defaults/forestHarmony";
// editor/tools/village/relief.ts
// 마을 지형 고저차 — 언덕(단구)을 계획하고 「합본 마을+레트로 월드맵」 혼합 칩셋의 절벽 어휘로 그린다.
//
// 왜 있는가(2026-09-18): 사용자 「언덕도 만들고 고저차도 만들고 대각 언덕도 만들어라」. 합본 마을 칩셋에는
// 자연 절벽 타일이 없고, 레트로 월드맵 반쪽(ID +480)에 잔디/암벽 45° 경계 4장(18·19·48·49)과 암벽 3×3
// (171~232) 이 있다. 이 모듈은 그 어휘만 쓴다 — 다른 칩셋에서는 아무것도 그리지 않는다.
//
// 그리는 문법은 「장소」의 완성 참고 맵 「비취 대계곡」(regionReferences/emerald-basin.json, 월드맵 칩셋)을 따른다:
// 대지 윗선은 139(잔디에 절벽 테), 절벽 면은 172(윗줄)…202(바닥줄), 45° 구간은 윗선 18/19 · 몸통 231 · 아랫선 48/49,
// 길이 면을 내려가는 자리는 374(돌계단). 월드맵 칩셋과 레트로 월드맵 칩셋은 같은 RM2K 배치라 번호가 그대로 대응한다.
//
// 기하: 언덕(대지)은 모서리를 45° 로 깎은 직사각형(chamfered rect)의 합집합이다. 꼭짓점이 칸 모서리(정수)에
// 놓이므로 45° 변은 칸을 정확히 반으로 가르고, 그 칸이 대각 타일이 된다. 대지 Q 를 체비셰프 1 만큼 팽창한
// Q' 와의 차 Q'∖Q 가 암벽 띠(1칸, 45° 구간은 대각 타일+암벽 1칸+대각 타일)이고, 남쪽으로 향한 곧은 변 아래에는
// 암벽을 한 줄 더 얹어 절벽 면을 2칸으로 세운다(위에서 내려다보는 RM2K 관례 — 남면만 보인다).
//
// 통행: 암벽·대각 타일은 하네스가 통행 불가로 본다. 대지 위·아래는 잔디 그대로(240)라 다른 도구(나무·밭)가
// 평지처럼 다룬다. 길은 띠를 지나갈 수 있고, 지난 자리는 모래 길이 되어 비탈(램프)로 읽힌다.

import { mulberry32, type Rng } from "@/util/rng";
import { RETRO_WORLD_CLIFF_WALKABLE_TILES, RETRO_WORLD_TILE_OFFSET, TILE } from "@/project/defaults/constants";
import type { GameMap, TilesetDef } from "@/project/types";
import type { Rect } from "./constants";

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

export type ReliefCell = "top" | "rock" | "face" | "diagNE" | "diagNW" | "diagSW" | "diagSE" | "ground";

export interface ReliefPlan {
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** 칸별 높이(0 = 평지). */
  readonly level: Uint8Array;
  /** 칸별 분류. */
  readonly cells: ReliefCell[];
  /** 집·밭·옆길이 못 쓰는 칸(암벽·절벽 면·대각) — 길은 지나갈 수 있다. */
  readonly cliff: ReadonlySet<number>;
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

/** 네 표본점 — 두 대각선(y=x, y=1-x) 어느 쪽에도 놓이지 않게 비대칭으로 잡았다. */
const SAMPLES: readonly (readonly [number, number])[] = [[0.2, 0.3], [0.7, 0.2], [0.3, 0.8], [0.8, 0.7]];
const MASK_NW = 0b0011; // P1,P2 → 북서 반
const MASK_SW = 0b0101; // P1,P3 → 남서 반
const MASK_NE = 0b1010; // P2,P4 → 북동 반
const MASK_SE = 0b1100; // P3,P4 → 남동 반

function insideChamfer(r: ChamferRect, px: number, py: number): boolean {
  if (px <= r.x0 || px >= r.x1 || py <= r.y0 || py >= r.y1) return false;
  if (px - r.x0 + (py - r.y0) < r.nw) return false;
  if (r.x1 - px + (py - r.y0) < r.ne) return false;
  if (px - r.x0 + (r.y1 - py) < r.sw) return false;
  if (r.x1 - px + (r.y1 - py) < r.se) return false;
  return true;
}

function dilate(r: ChamferRect): ChamferRect {
  return { ...r, x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 };
}

function sampleMask(parts: readonly ChamferRect[], x: number, y: number): number {
  let mask = 0;
  for (const [i, [dx, dy]] of SAMPLES.entries()) {
    if (parts.some((part) => insideChamfer(part, x + dx, y + dy))) mask |= 1 << i;
  }
  return mask;
}

function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m > 0; m >>= 1) n += m & 1;
  return n;
}

type HalfKind = "full" | "empty" | "NE" | "NW" | "SW" | "SE";

function halfKind(mask: number): HalfKind {
  if (mask === 0b1111) return "full";
  if (mask === 0) return "empty";
  if (mask === MASK_NE) return "NE";
  if (mask === MASK_NW) return "NW";
  if (mask === MASK_SW) return "SW";
  if (mask === MASK_SE) return "SE";
  // 두 도형이 겹친 이상한 칸 — 셋 이상이면 채우고, 하나 이하면 비운다. 대각 맞은편 둘은 채운다.
  return popcount(mask) >= 2 ? "full" : "empty";
}

const OPPOSITE: Record<Exclude<HalfKind, "full" | "empty">, ReliefCell> = { NE: "diagSW", NW: "diagSE", SW: "diagNE", SE: "diagNW" };
const SAME: Record<Exclude<HalfKind, "full" | "empty">, ReliefCell> = { NE: "diagNE", NW: "diagNW", SW: "diagSW", SE: "diagSE" };

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

/** 대지 목록을 칸 분류·높이·절벽 집합으로 굽는다. 높은 단이 낮은 단 위에 덧그려진다. */
export function rasterize(plateaus: readonly Plateau[], mapWidth: number, mapHeight: number, area: Rect, notes: readonly string[] = []): ReliefPlan {
  const level = new Uint8Array(mapWidth * mapHeight);
  const cells: ReliefCell[] = new Array<ReliefCell>(mapWidth * mapHeight).fill("ground");
  const cliff = new Set<number>();
  const sorted = [...plateaus].sort((a, b) => a.level - b.level);
  for (const plateau of sorted) {
    const dilated = plateau.parts.map(dilate);
    const local: ReliefCell[] = new Array<ReliefCell>(mapWidth * mapHeight).fill("ground");
    const bounds = plateau.parts.map((part) => chamferBounds(part, 2));
    for (const b of bounds) {
      for (let y = Math.max(0, b.y); y < Math.min(mapHeight, b.y + b.h); y += 1) {
        for (let x = Math.max(0, b.x); x < Math.min(mapWidth, b.x + b.w); x += 1) {
          const index = y * mapWidth + x;
          if (local[index] !== "ground") continue;
          const top = halfKind(sampleMask(plateau.parts, x, y));
          if (top === "full") { local[index] = "top"; continue; }
          if (top !== "empty") { local[index] = SAME[top]; continue; }
          const band = halfKind(sampleMask(dilated, x, y));
          if (band === "full") local[index] = "rock";
          else if (band !== "empty") local[index] = OPPOSITE[band];
        }
      }
    }
    // 남쪽 절벽 면 — 곧은 남쪽 변 아래(암벽 띠 바로 아래 칸이 평지이고, 그 위 두 칸이 띠·대지)에 한 줄 더.
    for (let y = 2; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const index = y * mapWidth + x;
        if (local[index] !== "ground") continue;
        const up = local[index - mapWidth]!, up2 = local[index - 2 * mapWidth]!;
        if (up === "rock" && up2 === "top") local[index] = "face";
      }
    }
    for (let index = 0; index < local.length; index += 1) {
      const kind = local[index]!;
      if (kind === "ground") continue;
      const x = index % mapWidth, y = Math.floor(index / mapWidth);
      if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) continue;
      cells[index] = kind;
      if (kind === "top") { level[index] = plateau.level; cliff.delete(index); continue; }
      level[index] = Math.max(level[index]!, plateau.level - 1);
      cliff.add(index);
    }
  }
  const counts = { top: 0, rock: 0, face: 0, diag: 0 };
  for (const kind of cells) {
    if (kind === "top") counts.top += 1;
    else if (kind === "rock") counts.rock += 1;
    else if (kind === "face") counts.face += 1;
    else if (kind !== "ground") counts.diag += 1;
  }
  return {
    mapWidth, mapHeight, level, cells, cliff, plateaus,
    notes: [...notes, `고저차: 대지 ${counts.top}칸 암벽 ${counts.rock} 면 ${counts.face} 대각 ${counts.diag}`],
  };
}

// ───────────────────────── 시공 ─────────────────────────

function isTopLike(kind: ReliefCell | undefined): boolean {
  return kind === "top" || kind === "diagNE" || kind === "diagNW" || kind === "diagSW" || kind === "diagSE";
}

function isBand(kind: ReliefCell | undefined): boolean {
  return kind === "rock" || kind === "face";
}

/**
 * 분류를 lower 레이어에 그린다(비취 대계곡 문법). 잔디(240) 칸만 바꾼다 — 물·기존 시공은 건드리지 않는다.
 *  · 대지 가장자리 칸: 남쪽에 띠 → 139(윗선, 모서리 138/140), 북쪽 → 79(78/80), 서 → 108, 동 → 110.
 *  · 띠: 남쪽 면 첫 줄 172, 그 아래 face 줄 202, 나머지(북·서·동 띠, 대각 몸통) 231.
 *  · 대각: 18/19/48/49 — 잔디가 있는 쪽이 이름.
 */
export function paintRelief(map: GameMap, plan: ReliefPlan, tileOffset: number = RETRO_WORLD_TILE_OFFSET): { painted: number } {
  let painted = 0;
  const W = map.width, H = map.height;
  const kindAt = (x: number, y: number): ReliefCell | undefined =>
    x < 0 || y < 0 || x >= W || y >= H ? undefined : plan.cells[y * W + x];
  const levelAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : plan.level[y * W + x]!);
  for (let index = 0; index < plan.cells.length; index += 1) {
    const kind = plan.cells[index]!;
    if (kind === "ground") continue;
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
    const x = index % W, y = Math.floor(index / W);
    let tile: number | undefined;
    switch (kind) {
      case "top": {
        // 가장자리 테 — 이 칸보다 낮은 띠가 어느 쪽에 붙었는가.
        const lv = levelAt(x, y);
        const south = isBand(kindAt(x, y + 1)) && levelAt(x, y + 1) < lv;
        const north = isBand(kindAt(x, y - 1)) && levelAt(x, y - 1) < lv;
        const west = isBand(kindAt(x - 1, y)) && levelAt(x - 1, y) < lv;
        const east = isBand(kindAt(x + 1, y)) && levelAt(x + 1, y) < lv;
        if (south) tile = west ? RETRO_CLIFF.lipSW : east ? RETRO_CLIFF.lipSE : RETRO_CLIFF.lip;
        else if (north) tile = west ? RETRO_CLIFF.edgeNW : east ? RETRO_CLIFF.edgeNE : RETRO_CLIFF.edgeN;
        else if (west) tile = RETRO_CLIFF.edgeW;
        else if (east) tile = RETRO_CLIFF.edgeE;
        break;
      }
      case "rock": {
        // 남쪽 면 첫 줄인가 — 바로 위가 대지(또는 대지 대각)이고 그 대지가 이 칸보다 높다.
        const above = kindAt(x, y - 1);
        const southFace = isTopLike(above) && levelAt(x, y - 1) > levelAt(x, y);
        const below = kindAt(x, y + 1);
        tile = southFace ? (below === "face" ? RETRO_CLIFF.faceTop : RETRO_CLIFF.faceBottom) : RETRO_CLIFF.body;
        break;
      }
      case "face": tile = RETRO_CLIFF.faceBottom; break;
      case "diagNE": tile = RETRO_CLIFF.grassNE; break;
      case "diagNW": tile = RETRO_CLIFF.grassNW; break;
      case "diagSW": tile = RETRO_CLIFF.grassSW; break;
      case "diagSE": tile = RETRO_CLIFF.grassSE; break;
    }
    if (tile === undefined) continue;
    map.lowerTiles[index] = tile + tileOffset;
    map.upperTiles[index] = TILE.EMPTY;
    painted += 1;
  }
  return { painted };
}

/**
 * 길이 절벽 면(남쪽 면 줄)을 지나는 칸을 돌계단으로 바꾼다 — 비취 대계곡의 374. 북·서·동 띠와 대각 구간을
 * 지난 길은 모래 그대로(비탈로 읽힌다). 길 시공 뒤에 부른다.
 */
export function paintReliefStairs(map: GameMap, plan: ReliefPlan, isRoadTile: (tile: number) => boolean, tileOffset: number = RETRO_WORLD_TILE_OFFSET): number {
  const W = map.width;
  let stairs = 0;
  for (let index = 0; index < plan.cells.length; index += 1) {
    const kind = plan.cells[index]!;
    if (kind !== "rock" && kind !== "face") continue;
    if (!isRoadTile(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
    const x = index % W, y = Math.floor(index / W);
    // 남쪽 면 줄만: 위쪽으로 띠를 거슬러 올라가면 대지가 나오고, 그 대지가 더 높다.
    let up = y - 1;
    while (up >= 0 && (plan.cells[up * W + x] === "rock" || plan.cells[up * W + x] === "face")) up -= 1;
    if (up < 0 || !isTopLike(plan.cells[up * W + x]) || plan.level[up * W + x]! <= plan.level[index]!) continue;
    if (kind === "rock" && y - 1 !== up && plan.cells[(y - 1) * W + x] === "rock" && plan.cells[(y + 1) * W + x] !== "face") continue;
    map.lowerTiles[index] = RETRO_CLIFF.stairs + tileOffset;
    map.upperTiles[index] = TILE.EMPTY;
    stairs += 1;
  }
  return stairs;
}
