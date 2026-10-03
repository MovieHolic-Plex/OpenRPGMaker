// 「높이」 러프 붓 — 1차 스케치용. 큰 붓 덩이를 한 번에 세우고, 비탈은 3칸 폭 단으로 묶으며,
// 노이즈가 큰 쪽은 한 번에 2단 떨어지는 절벽이 된다. 정밀 붓은 edit.ts 의 brushRelief 다.
// 시안: claude-viz relief-brush-redesign.html (2026-10-03).

import { brushRelief, type ReliefBrushMode } from "./edit";
import { hsh3 } from "./render";
import { RELIEF_MAX_LEVEL, type ReliefData } from "./types";

/** 붓 크기 S·M·L·XL → 반지름(칸). */
export const RELIEF_ROUGH_RADII = { S: 2, M: 4, L: 6, XL: 9 } as const;
export type ReliefRoughSize = keyof typeof RELIEF_ROUGH_RADII;

/** 단 하나에 묶이는 비탈 폭(칸). */
const TIER_WIDTH = 3;
/** 이 값보다 노이즈가 크면 그 비탈은 한 단 대신 두 단씩 떨어진다(절벽). */
const CLIFF_NOISE = 0.6;
/** 붓을 뗄 때 이 칸 수보다 작은 섬·구멍은 주변 높이로 메운다. */
export const RELIEF_TIDY_MIN_AREA = 8;

const clamp = (v: number) => Math.max(0, Math.min(RELIEF_MAX_LEVEL, Math.round(v)));
/** hsh3(FNV) 뒤에 섞기를 한 번 더 — 이웃 격자점이 비슷한 값을 내지 않게. 0~1. */
function hash01(x: number, y: number, s: number): number {
  let v = hsh3(x, y, s);
  v = Math.imul(v ^ (v >>> 16), 0x85ebca6b);
  v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/** 부드러운 값 노이즈 0~1 (격자 간격 scale 칸). 맵 좌표로만 정해진다 — 같은 자리는 늘 같은 모양. */
export function reliefValueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale, fy = y / scale, X = Math.floor(fx), Y = Math.floor(fy), tx = fx - X, ty = fy - Y;
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  const a = hash01(X, Y, seed), b = hash01(X + 1, Y, seed), c = hash01(X, Y + 1, seed), d = hash01(X + 1, Y + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export interface ReliefRoughOptions {
  /** 붓 반지름(칸). */
  radius: number;
  /** 스트로크를 시작한 칸의 높이. 올리기 비탈은 이 높이 밑으로 내려가지 않는다. */
  base: number;
  /** 지금 봉우리(올리기)·바닥(내리기) 단. 누르고 있으면 호출부가 한 단씩 키운다. */
  peak: number;
  /** 상한 단 — 올리기·산은 이 단을 넘지 않고, 단 지정은 이 단으로 맞춘다. */
  cap: number;
}

/**
 * 러프 붓 한 번. 바뀐 칸이 없으면 false.
 *  · raise·mountain: 덩이 안은 봉우리, 밖은 3칸마다 한 단(노이즈 큰 쪽은 두 단)씩 내려간다. 지금보다 높을 때만 쓴다.
 *  · lower·canyon: 거꾸로 판다. 골짜기는 한 칸에 한 단씩 가파르게 오른다.
 *  · flatten(시작 칸 높이)·set(상한 단): 덩이 안을 그 높이로.
 *  · smooth·rough: 정밀 붓과 같은 연산을 큰 반지름으로.
 */
export function roughReliefStroke(r: ReliefData, cx: number, cy: number, mode: ReliefBrushMode, opts: ReliefRoughOptions): boolean {
  const R = Math.max(1, opts.radius);
  if (mode === "smooth" || mode === "rough") return brushRelief(r, cx, cy, mode, { radius: R });
  const cap = clamp(opts.cap), base = clamp(opts.base), peak = clamp(opts.peak);
  const span = Math.abs(peak - base) * TIER_WIDTH + TIER_WIDTH;
  const reach = Math.ceil(R * 1.3) + span;
  let changed = false;
  for (let y = cy - reach; y <= cy + reach; y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue;
      const i = y * r.width + x, c = r.levels[i] ?? 0;
      // 덩이 모양: 거리에 노이즈를 곱해 원이 아니라 울퉁불퉁한 덩이로.
      const d = Math.hypot(x - cx, y - cy) * (0.8 + 0.45 * reliefValueNoise(x + 31, y + 17, 5, 11));
      const out = Math.max(0, d - R);
      const tier = out <= 0 ? 0 : Math.ceil((out + 1.2 * reliefValueNoise(x + 77, y + 5, 5, 23)) / TIER_WIDTH);
      const drop = reliefValueNoise(x + 140, y + 60, 11, 37) > CLIFF_NOISE ? 2 : 1;
      let v = c;
      if (mode === "raise" || mode === "mountain") {
        const want = Math.min(cap, peak) - tier * drop;
        if (want > c && (out === 0 || want > base)) v = want;
      } else if (mode === "lower" || mode === "canyon") {
        const want = peak + (mode === "canyon" ? Math.floor(out) : tier * drop);
        if (want < c) v = want;
      } else if (d <= R) {
        v = mode === "flatten" ? base : cap;
      }
      v = clamp(v);
      if (v !== c) { r.levels[i] = v; changed = true; }
    }
  }
  return changed;
}

/**
 * 붓을 뗄 때 정리 — 스트로크가 지나간 사각형 안에서만:
 *  1) 1칸 폭 돌기·홈(렌더 규칙이 어차피 깎는 것)을 이웃 높이로 맞춘다.
 *  2) RELIEF_TIDY_MIN_AREA 칸 미만의 섬(주변보다 높은 덩어리)·구멍(낮은 덩어리)을 메운다.
 * 경사로·다리가 놓인 칸은 건드리지 않는다. 사각형 밖은 조수·저자가 일부러 만든 것일 수 있어 그대로 둔다.
 */
export function tidyReliefRegion(r: ReliefData, box: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const x0 = Math.max(0, box.x0), y0 = Math.max(0, box.y0), x1 = Math.min(r.width - 1, box.x1), y1 = Math.min(r.height - 1, box.y1);
  if (x1 < x0 || y1 < y0) return false;
  const locked = (i: number) => (r.ramps?.[i] ?? 0) > 0;
  const inBox = (x: number, y: number) => x >= x0 && y >= y0 && x <= x1 && y <= y1;
  let changed = false;
  const set = (i: number, v: number) => { if (r.levels[i] !== v && !locked(i)) { r.levels[i] = v; changed = true; } };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * r.width + x, l = r.levels[i] ?? 0;
      const at = (X: number, Y: number) => X >= 0 && Y >= 0 && X < r.width && Y < r.height ? r.levels[Y * r.width + X] ?? 0 : l;
      const e = at(x + 1, y), w = at(x - 1, y), n = at(x, y - 1), s = at(x, y + 1);
      if (l > e && l > w) set(i, Math.max(e, w));
      else if (l > n && l > s) set(i, Math.max(n, s));
      else if (l < e && l < w) set(i, Math.min(e, w));
      else if (l < n && l < s) set(i, Math.min(n, s));
    }
  }
  let top = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) top = Math.max(top, r.levels[y * r.width + x] ?? 0);
  const seen = new Uint8Array(r.width * r.height);
  for (let t = 1; t <= top; t++) {
    for (const up of [true, false]) {
      seen.fill(0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const s0 = y * r.width + x;
        if (seen[s0] || ((r.levels[s0] ?? 0) >= t) !== up) continue;
        const comp = [s0], queue = [s0];
        seen[s0] = 1;
        let escapes = false;
        while (queue.length > 0) {
          const i = queue.pop()!, X = i % r.width, Y = (i / r.width) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = X + dx, ny = Y + dy;
            if (nx < 0 || ny < 0 || nx >= r.width || ny >= r.height) { if (!up) escapes = true; continue; }
            const j = ny * r.width + nx;
            if (seen[j] || ((r.levels[j] ?? 0) >= t) !== up) continue;
            if (!inBox(nx, ny)) { escapes = true; continue; }
            seen[j] = 1; comp.push(j); queue.push(j);
          }
        }
        if (escapes || comp.length >= RELIEF_TIDY_MIN_AREA) continue;
        for (const i of comp) set(i, up ? t - 1 : t);
      }
    }
  }
  return changed;
}
