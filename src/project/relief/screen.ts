// 높이 지형(map.relief)의 화면 들림. 권위: 런타임(PlayScene)·편집기(EditScene)가 타일·캐릭터를 같은 값으로 올린다.
//
// 들림(lift) 단위는 「단」이다. 화면 px = 단 × 맵 칸 크기 (1단 = 벽 1칸, relief/types.ts).
// 칸 들림은 renderRelief 가 **실제로 그리는** 높이(effectiveHeights → prune)다 — 칠한 높이가 아니다.
// 그래야 타일이 그림의 윗면에 정확히 앉는다. 경사로 칸은 칸 중심의 오르막 위치로 보간하고, 계단은 디딤판 단으로 끊는다.
import type { ReliefRender, ReliefRenderOptions } from "./render";
import { RELIEF_TILE, type ReliefData } from "./types";
import { reliefGrids } from "./window";
import { hasRelief, reliefBridgeMask, reliefSlopes } from "./walk";
import { reliefRampArt } from "./styles";

export interface ReliefLiftField {
  readonly width: number;
  readonly height: number;
  /** 칸 들림(단), elevation[y * width + x] */
  readonly elevation: Float32Array;
}

const fields = new WeakMap<ReliefData, ReliefLiftField>();

/** relief → 칸 들림 표. 같은 relief 객체면 다시 계산하지 않는다(런타임은 매 프레임 부른다). */
export function reliefLiftField(relief: ReliefData): ReliefLiftField {
  const cached = fields.get(relief);
  if (cached) return cached;
  const { width, height } = relief;
  const drawn = reliefGrids(relief).pruned;
  const elevation = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) elevation[y * width + x] = drawn[y]?.[x] ?? 0;
  for (const s of reliefSlopes(relief)) {
    const len = s.dir === "n" || s.dir === "s" ? s.h : s.w;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      // 낮은 끝에서 칸 중심까지 거리 / 경사로 길이 (render.ts slopeHeights 와 같은 축)
      const along = s.dir === "n" ? s.y + s.h - (y + 0.5) : s.dir === "s" ? y + 0.5 - s.y : s.dir === "w" ? s.x + s.w - (x + 0.5) : x + 0.5 - s.x;
      let t = along / len;
      // 계단은 칸 중심이 딛는 디딤판 단. 칸 중심이 디딤판 경계에 딱 걸리므로 부동소수 오차로 한 단 아래로 떨어지지 않게 한다.
      if (s.steps) t = Math.floor(t * s.steps + 1e-6) / s.steps;
      elevation[y * width + x] = s.lo + t * (s.hi - s.lo);
    }
  }
  const field = { width, height, elevation };
  fields.set(relief, field);
  return field;
}

/**
 * 그 칸 바닥을 relief 그림이 직접 칠하는가. 매끈한 경사로는 렌더러가 비탈 한 면을 칠하므로
 * 하층 바닥 타일(잔디 240 등)을 그리지 않는다 — 칸마다 계단처럼 들린 타일이 비탈을 조각내지 않게. 통행은 타일 그대로.
 */
export function reliefPaintsCell(relief: ReliefData | undefined, x: number, y: number): boolean {
  if (!relief?.ramps) return false;
  const v = relief.ramps[y * relief.width + x] ?? 0;
  // 기본 경사로도 칸마다 들린 잔디 타일로 덮으면 계단처럼 쪼개진다. 비탈과 계단 모두 직접 그린다.
  return v >= 1 && v <= 8;
}

/** relief → renderRelief 옵션(편집기·플레이어·오프라인 렌더가 같은 값을 쓴다): 경사로·양식·경사로 도트·다리 판. */
export function reliefRenderOptions(relief: ReliefData): ReliefRenderOptions {
  const bridges = reliefBridgeMask(relief);
  return { transparentGround: true, slopes: reliefSlopes(relief), style: relief.style, rampArt: reliefRampArt(relief.style), ...(bridges ? { bridges } : {}) };
}

/**
 * 두 relief 사이에 타일 자리가 달라지는 칸 — 칸 들림이 바뀌었거나 「경사로 도트가 바닥을 칠하는가」 가 바뀐 칸.
 * 편집기가 높이 붓 한 번마다 맵 전체 타일을 다시 만들지 않고 이 칸들의 타일만 다시 올리는 데 쓴다.
 * 맵 크기는 같다고 본다(크기가 바뀌면 호출부가 전체를 다시 그린다). 평지·relief 없음은 들림 0 이다.
 */
export function reliefTileSlotChangedCells(before: ReliefData | undefined, after: ReliefData | undefined, width: number, height: number): { x: number; y: number }[] {
  const a = hasRelief(before) ? reliefLiftField(before) : null;
  const b = hasRelief(after) ? reliefLiftField(after) : null;
  if (!a && !b && !before?.ramps && !after?.ramps) return [];
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const liftBefore = a ? cellLift(a, x, y) : 0, liftAfter = b ? cellLift(b, x, y) : 0;
    if (liftBefore !== liftAfter || reliefPaintsCell(before, x, y) !== reliefPaintsCell(after, x, y)) cells.push({ x, y });
  }
  return cells;
}

/** 칸 (x, y) 의 들림(단). 맵 밖은 0. */
export function cellLift(field: ReliefLiftField, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= field.width || y >= field.height) return 0;
  return field.elevation[y * field.width + x] ?? 0;
}

/**
 * 실수 칸 좌표(걷는 중·트윈 중 위치)의 들림(단). 네 이웃 칸 들림의 쌍선형 보간 — 정수 좌표면 cellLift 와 같다.
 * 걸음은 같은 단 또는 경사로 축으로만 이어지므로(walk.ts) 보간이 절벽을 가로지르지 않는다.
 */
export function pointLift(field: ReliefLiftField, fx: number, fy: number): number {
  const cx = Math.max(0, Math.min(field.width - 1, fx)), cy = Math.max(0, Math.min(field.height - 1, fy));
  const x0 = Math.floor(cx), y0 = Math.floor(cy), tx = cx - x0, ty = cy - y0;
  const a = cellLift(field, x0, y0), b = cellLift(field, Math.min(field.width - 1, x0 + 1), y0);
  const c = cellLift(field, x0, Math.min(field.height - 1, y0 + 1)), d = cellLift(field, Math.min(field.width - 1, x0 + 1), Math.min(field.height - 1, y0 + 1));
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** 단·경사로·벽면 장식 전부를 담는 32비트 서명. 타일 계층 재생성 판정·편집기 렌더 키에 쓴다. */
export function reliefSignature(relief: ReliefData | undefined): number {
  if (!relief) return 0;
  let hash = 0x811c9dc5;
  const mix = (v: number) => { hash ^= v & 0xffff; hash = Math.imul(hash, 0x01000193); hash ^= v >>> 16; hash = Math.imul(hash, 0x01000193); };
  mix(relief.width); mix(relief.height);
  for (const v of relief.levels) mix(v);
  mix(relief.ramps?.length ?? 0);
  for (const v of relief.ramps ?? []) mix(v);
  mix(relief.wallDecor?.length ?? 0);
  for (const d of relief.wallDecor ?? []) { mix(d.x); mix(d.y); mix(d.row); mix(d.tile); }
  for (const ch of relief.style ?? "") mix(ch.charCodeAt(0));
  return hash >>> 0;
}

/** 윗면(단 > 0, 불투명)은 그 줄 타일 **밑**, 벽·0단 발치 그늘·윗단 가장자리 선은 그 줄 타일 **위**에 그린다. */
export type ReliefStripPart = "under" | "over";

const partOf = (render: ReliefRender, i: number): ReliefStripPart => (render.kind[i] === 0 && render.lev[i] > 0 && !render.overSlope?.[i] && !render.edge[i] ? "under" : "over");

/**
 * 맵 한 줄(row)이 그린 절벽 화소 중 part 에 속하는 것만 잘라 낸 띠. 좌표는 renderRelief 16px 그림 좌표 — 월드 y 는 y - pad.
 * 화소가 없는 줄은 띠가 없다.
 */
export interface ReliefRowStrip {
  readonly row: number;
  readonly part: ReliefStripPart;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rgba: Uint8ClampedArray;
}

export function reliefRowStrips(render: ReliefRender, mapWidth: number, part: ReliefStripPart): ReliefRowStrip[] {
  const { PW, SH, pad, src, rgba } = render;
  const rows = (SH - pad) / RELIEF_TILE;
  const x0 = new Int32Array(rows).fill(PW), y0 = new Int32Array(rows).fill(SH), x1 = new Int32Array(rows).fill(-1), y1 = new Int32Array(rows).fill(-1);
  const take = (i: number) => src[i] >= 0 && rgba[i * 4 + 3] > 0 && partOf(render, i) === part;
  for (let i = 0; i < src.length; i++) {
    if (!take(i)) continue;
    const r = Math.floor(src[i] / mapWidth), sx = i % PW, sy = (i / PW) | 0;
    if (sx < x0[r]) x0[r] = sx;
    if (sx > x1[r]) x1[r] = sx;
    if (sy < y0[r]) y0[r] = sy;
    if (sy > y1[r]) y1[r] = sy;
  }
  const out: ReliefRowStrip[] = [];
  for (let r = 0; r < rows; r++) {
    if (x1[r] < 0) continue;
    const w = x1[r] - x0[r] + 1, h = y1[r] - y0[r] + 1, strip = new Uint8ClampedArray(w * h * 4);
    for (let sy = y0[r]; sy <= y1[r]; sy++) for (let sx = x0[r]; sx <= x1[r]; sx++) {
      const i = sy * PW + sx;
      if (!take(i) || Math.floor(src[i] / mapWidth) !== r) continue;
      const o = ((sy - y0[r]) * w + (sx - x0[r])) * 4;
      strip[o] = rgba[i * 4]; strip[o + 1] = rgba[i * 4 + 1]; strip[o + 2] = rgba[i * 4 + 2]; strip[o + 3] = rgba[i * 4 + 3];
    }
    out.push({ row: r, part, x: x0[r], y: y0[r], w, h, rgba: strip });
  }
  return out;
}

/** 편집기용 한 장: 벽·발치 그늘만 남기고 윗면은 비운다(윗면은 들린 타일이 덮는다). */
export function reliefOverRgba(render: ReliefRender): Uint8ClampedArray {
  const out = new Uint8ClampedArray(render.rgba);
  for (let i = 0; i < render.src.length; i++) if (partOf(render, i) === "under") out[i * 4 + 3] = 0;
  return out;
}

/**
 * 들림 없는 땅 좌표 (x, groundY) 를 눌렀을 때 화면에 실제로 보이는 칸 — 그 칸의 윗면인지 남쪽 벽인지.
 * 3/4 시점에서 높은 칸은 북쪽으로 올라가 그려지므로, 남쪽(앞) 칸부터 거슬러 올라가며 처음 덮는 것을 고른다.
 * 편집기 높이 붓·지형지물이 「보이는 그 언덕」을 집게 한다. relief 가 없으면 그 칸의 윗면이다.
 */
export function reliefPickCell(relief: ReliefData | undefined, x: number, groundY: number): { x: number; y: number; face: "top" | "wall" } {
  if (!relief || !hasRelief(relief) || x < 0 || x >= relief.width) return { x, y: groundY, face: "top" };
  const field = reliefLiftField(relief);
  let maxLift = 0;
  for (let i = 0; i < field.elevation.length; i++) maxLift = Math.max(maxLift, field.elevation[i] ?? 0);
  const fy = groundY + 0.5;
  for (let y = Math.min(relief.height - 1, groundY + Math.ceil(maxLift) + 1); y >= Math.max(0, groundY); y--) {
    const lift = cellLift(field, x, y), top = y - lift;
    if (fy >= top && fy < top + 1) return { x, y, face: "top" };
    const southLift = y + 1 < relief.height ? cellLift(field, x, y + 1) : 0;
    if (lift > southLift && fy >= top + 1 && fy < y + 1 - southLift) return { x, y, face: "wall" };
  }
  return { x, y: groundY, face: "top" };
}
