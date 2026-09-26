// 편집기·조수가 map.relief 를 다룰 때 쓰는 작은 도우미. 저장 형태 정규화, 맵 크기 변경, 붓질.

import { RELIEF_MAX_LEVEL, type HeightGrid, type ReliefData } from "./types";

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
  const src: ReliefData = { width: r.width!, height: r.height!, levels: r.levels.map(clampLevel) };
  const out = src.width === mapWidth && src.height === mapHeight && src.levels.length === mapWidth * mapHeight
    ? src
    : resizeRelief(src, mapWidth, mapHeight);
  return out.levels.some((v) => v > 0) ? out : undefined;
}

/** 맵 크기 변경: 왼쪽 위 기준으로 자르거나 0 으로 늘린다. */
export function resizeRelief(r: ReliefData, width: number, height: number): ReliefData {
  const out = emptyRelief(width, height);
  for (let y = 0; y < Math.min(height, r.height); y++) {
    for (let x = 0; x < Math.min(width, r.width); x++) {
      out.levels[y * width + x] = clampLevel(r.levels[y * r.width + x]);
    }
  }
  return out;
}

export type ReliefBrushMode = "raise" | "lower" | "set" | "flatten";

/**
 * 원형 붓 한 번. raise/lower 는 ±1(level 을 주면 그 단까지만), set 은 level 로, flatten 은 붓 중심 칸 높이로 맞춘다.
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

export const reliefIsFlat = (r: ReliefData | undefined) => !r || !r.levels.some((v) => v > 0);

export const gridMax = (h: HeightGrid) => h.reduce((m, row) => Math.max(m, ...row), 0);
