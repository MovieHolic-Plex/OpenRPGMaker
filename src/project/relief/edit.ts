// 편집기·조수가 map.relief 를 다룰 때 쓰는 작은 도우미. 저장 형태 정규화, 맵 크기 변경, 붓질.

import { buildReliefOps } from "./ops";
import { hsh3 } from "./render";
import { gridFromRelief, RELIEF_MAX_LEVEL, type HeightGrid, type ReliefData } from "./types";

const clampLevel = (v: unknown) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(0, Math.min(RELIEF_MAX_LEVEL, n));
};

export const emptyRelief = (width: number, height: number): ReliefData => ({
  width,
  height,
  levels: new Array(Math.max(0, width * height)).fill(0),
});

/** 불러온 값 → 맵 크기에 맞춘 ReliefData. 모양이 틀리거나 전부 0 이면 undefined(필드 없음). */
export function normalizeRelief(raw: unknown, mapWidth: number, mapHeight: number): ReliefData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<ReliefData>;
  if (!Array.isArray(r.levels) || !Number.isInteger(r.width) || !Number.isInteger(r.height)) return undefined;
  const ramps = Array.isArray(r.ramps) && r.ramps.length === r.levels.length
    ? r.ramps.map((v) => (Number.isInteger(v) && v >= 0 && v <= 9 ? v : 0))
    : undefined;
  const wallDecor = Array.isArray(r.wallDecor)
    ? r.wallDecor.filter((d) => d && [d.x, d.y, d.row, d.tile].every(Number.isInteger) && d.row >= 1 && d.tile >= 0).map(({ x, y, row, tile }) => ({ x, y, row, tile }))
    : undefined;
  const style = typeof r.style === "string" && r.style ? r.style : undefined;
  const src: ReliefData = { width: r.width!, height: r.height!, levels: r.levels.map(clampLevel), ...(ramps?.some((v) => v > 0) ? { ramps } : {}), ...(wallDecor?.length ? { wallDecor } : {}), ...(style ? { style } : {}) };
  const out = src.width === mapWidth && src.height === mapHeight && src.levels.length === mapWidth * mapHeight
    ? src
    : resizeRelief(src, mapWidth, mapHeight);
  return out.levels.some((v) => v > 0) ? out : undefined;
}

/** 맵 크기 변경: 왼쪽 위 기준으로 자르거나 0 으로 늘린다. */
export function resizeRelief(r: ReliefData, width: number, height: number): ReliefData {
  const out = emptyRelief(width, height);
  const ramps = r.ramps ? new Array<number>(width * height).fill(0) : undefined;
  for (let y = 0; y < Math.min(height, r.height); y++) {
    for (let x = 0; x < Math.min(width, r.width); x++) {
      out.levels[y * width + x] = clampLevel(r.levels[y * r.width + x]);
      if (ramps) ramps[y * width + x] = r.ramps![y * r.width + x] ?? 0;
    }
  }
  if (ramps?.some((v) => v > 0)) out.ramps = ramps;
  const wall = r.wallDecor?.filter((d) => d.x < width && d.y < height);
  if (wall?.length) out.wallDecor = wall.map((d) => ({ ...d }));
  if (r.style) out.style = r.style;
  return out;
}

export type ReliefBrushMode = "raise" | "lower" | "set" | "flatten" | "smooth" | "rough" | "mountain" | "canyon";

/**
 * 원형 붓 한 번. raise/lower 는 ±1(level 을 주면 그 단까지만), set 은 level 로, flatten 은 붓 중심 칸 높이로 맞춘다.
 * smooth 는 주변 평균, rough 는 절벽 가장자리를 들쭉날쭉 깎는다.
 * mountain 은 중심에 level 단 봉우리(경사 2칸/단)를, canyon 은 붓 폭 골짜기(0단)를 판다 — 드래그하면 능선·골이 된다.
 * 바뀐 칸이 없으면 false.
 */
export function brushRelief(
  r: ReliefData,
  cx: number,
  cy: number,
  mode: ReliefBrushMode,
  opts: { radius?: number; level?: number; flattenTo?: number } = {},
): boolean {
  const rad = Math.max(0, opts.radius ?? 0);
  if (mode === "mountain" || mode === "canyon") {
    const op = mode === "mountain"
      ? { op: "mountain" as const, at: [cx, cy] as [number, number], peak: clampLevel(opts.level ?? 1), slope: 2, rough: 0.25 }
      : { op: "canyon" as const, path: [[cx, cy]] as [number, number][], width: rad * 2 + 1, h: 0 };
    const { h } = buildReliefOps({ seed: 1, ops: [op] }, gridFromRelief(r));
    return writeGrid(r, h);
  }
  if (mode === "smooth" || mode === "rough") {
    const src = r.levels.slice();
    const at = (x: number, y: number) => src[y * r.width + x] ?? 0;
    let changed = false;
    forCircle(r, cx, cy, rad, (x, y, i) => {
      const c = src[i] ?? 0;
      let v = c;
      if (mode === "smooth") {
        let s = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < r.width && Y < r.height) { s += at(X, Y); k++; }
        }
        v = clampLevel(s / k);
      } else {
        let lo = c;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < r.width && Y < r.height) lo = Math.min(lo, at(X, Y));
        }
        if (lo < c && hsh3(x, y, 77) % 100 < 45) v = lo;
      }
      if (v !== c) { r.levels[i] = v; changed = true; }
    });
    return changed;
  }
  const target = mode === "flatten" ? opts.flattenTo ?? r.levels[cy * r.width + cx] ?? 0 : clampLevel(opts.level ?? 0);
  let changed = false;
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad + 0.25) continue;
      const i = y * r.width + x, c = r.levels[i] ?? 0;
      // raise/lower 에 level 을 주면 「그 단까지만」 — 드래그 한 번이 같은 칸을 여러 번 올리지 않게 한다.
      const v = mode === "raise"
        ? opts.level === undefined ? clampLevel(c + 1) : Math.max(c, target)
        : mode === "lower"
          ? opts.level === undefined ? clampLevel(c - 1) : Math.min(c, target)
          : clampLevel(target);
      if (v !== c) { r.levels[i] = v; changed = true; }
    }
  }
  return changed;
}

function forCircle(r: ReliefData, cx: number, cy: number, rad: number, visit: (x: number, y: number, i: number) => void): void {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad + 0.25) continue;
      visit(x, y, y * r.width + x);
    }
  }
}

function writeGrid(r: ReliefData, h: HeightGrid): boolean {
  let changed = false;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    const i = y * r.width + x, v = h[y]?.[x] ?? 0;
    if (r.levels[i] !== v) { r.levels[i] = v; changed = true; }
  }
  return changed;
}

export const reliefIsFlat = (r: ReliefData | undefined) => !r || !r.levels.some((v) => v > 0);

export const gridMax = (h: HeightGrid) => h.reduce((m, row) => Math.max(m, ...row), 0);

/**
 * 높이 격자(levels)만 새로 만든 relief 에 이전 relief 의 경사로·벽면 장식·양식을 이어 붙인다.
 * 격자에서 단이 바뀐 칸의 경사로 칸·벽면 장식은 더는 맞지 않으므로 버린다. 맵 크기가 다르면 양식만 잇는다.
 * (조수 `sculpt_relief` 처럼 높이만 빚는 도구가 저작된 경사로·장식·양식을 지우지 않게 한다.)
 */
export function carryReliefExtras(prev: ReliefData | undefined, next: ReliefData): ReliefData {
  if (!prev) return next;
  const out: ReliefData = { ...next };
  if (prev.style) out.style = prev.style;
  if (prev.width !== next.width || prev.height !== next.height) return out;
  const same = (i: number) => (prev.levels[i] ?? 0) === (next.levels[i] ?? 0);
  if (prev.ramps) {
    const ramps = prev.ramps.map((v, i) => (same(i) ? v : 0));
    if (ramps.some((v) => v > 0)) out.ramps = ramps;
  }
  const wallDecor = prev.wallDecor?.filter((d) => same(d.y * prev.width + d.x));
  if (wallDecor?.length) out.wallDecor = wallDecor.map((d) => ({ ...d }));
  return out;
}
