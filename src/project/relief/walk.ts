// 높이 지형(map.relief)의 걷기 규칙과 경사로 표기. 권위: 런타임 이동(collision.ts canMove)·도달성 검사·렌더가 같은 함수를 쓴다.
//
// 경사로(ramp)는 칸 표기다: relief.ramps[i] = 0(없음) | 1~4 매끈한 경사로(오르막 n·s·e·w) | 5~8 계단(같은 방향 + 4) | 9 다리 판(r3, 걷기는 보통 칸).
// 경사로 칸의 levels 값은 그 경사로의 낮은 끝 단(lo)이다. 단이 다른 이웃 칸으로는 못 간다 —
// 단, 두 칸 중 하나가 경사로이고 이동 방향이 그 경사로의 오르내림 축과 같으면 간다(단 차 최대 hi-lo).
// 경사로 사각형(렌더용 ReliefSlope)은 같은 방향 경사로 칸의 연결 덩어리에서 다시 만든다(reliefSlopes).
import { gridFromRelief, type ReliefData } from "./types";
import type { ReliefSlope } from "./render";
import { reliefCarvedStairs, reliefSmoothStairs } from "./styles";

export type RampDir = "n" | "s" | "e" | "w";
const DIRS: RampDir[] = ["n", "s", "e", "w"];
const DV: Record<RampDir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export const rampCode = (dir: RampDir, stairs = false): number => DIRS.indexOf(dir) + 1 + (stairs ? 4 : 0);
export function rampAt(r: ReliefData, x: number, y: number): { dir: RampDir; stairs: boolean } | null {
  const v = r.ramps?.[y * r.width + x] ?? 0;
  if (v < 1 || v > 8) return null;
  return { dir: DIRS[(v - 1) % 4]!, stairs: v > 4 };
}
export const reliefLevel = (r: ReliefData, x: number, y: number): number =>
  x < 0 || y < 0 || x >= r.width || y >= r.height ? 0 : (r.levels[y * r.width + x] ?? 0);

/** 경사로 칸 덩어리(같은 방향, 4방향 연결) → 렌더용 사각형. hi 는 오르막 끝 너머 칸의 단. */
export function reliefSlopes(r: ReliefData): ReliefSlope[] {
  if (!r.ramps?.some((v) => v > 0)) return [];
  // r3: smoothStairs styles draw their stair ramps as slopes (no steps); carvedStairs styles cut one step per level climbed (log flights one more)
  const smooth = reliefSmoothStairs(r.style), carved = reliefCarvedStairs(r.style);
  const seen = new Uint8Array(r.width * r.height), out: ReliefSlope[] = [];
  for (let s = 0; s < seen.length; s++) {
    const v = r.ramps[s] ?? 0;
    if (!v || v > 8 || seen[s]) continue;
    const cells = [s]; seen[s] = 1;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k]!, x = c % r.width, y = (c / r.width) | 0;
      for (const [dx, dy] of Object.values(DV)) {
        const X = x + dx, Y = y + dy, j = Y * r.width + X;
        if (X >= 0 && Y >= 0 && X < r.width && Y < r.height && !seen[j] && r.ramps[j] === v && r.levels[j] === r.levels[s]) { seen[j] = 1; cells.push(j); }
      }
    }
    const xs = cells.map((c) => c % r.width), ys = cells.map((c) => (c / r.width) | 0);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const dir = DIRS[(v - 1) % 4]!, [dx, dy] = DV[dir];
    const lo = Math.min(...cells.map((c) => r.levels[c] ?? 0));
    let hi = lo;
    for (const c of cells) { const X = (c % r.width) + dx, Y = ((c / r.width) | 0) + dy; hi = Math.max(hi, reliefLevel(r, X, Y)); }
    if (hi <= lo) continue;
    const len = dir === "n" || dir === "s" ? y1 - y0 + 1 : x1 - x0 + 1;
    // carved (r3 QA): a stone flight one step a level (risers the face's own height — two a level read as a ladder), a log flight
    // (log styles, four cells or more across) one log a level plus one; everything else two steps a cell as before
    const across = dir === "n" || dir === "s" ? x1 - x0 + 1 : y1 - y0 + 1;
    const steps = carved ? Math.max(2, hi - lo + (carved.log && across >= 4 ? 1 : 0)) : Math.max(2, len * 2);
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, dir, lo, hi, ...(v > 4 && !smooth ? { steps } : {}) });
  }
  return out;
}

/**
 * 높이 규칙만 본 한 걸음(4방향 이웃 사이). 같은 단이면 된다. 단이 다르면 둘 중 하나가 경사로이고
 * 걸음 방향이 그 경사로 축(오르막 방향 또는 그 반대)이며, 높은 쪽이 경사로 오르막 끝 쪽일 때만 된다.
 */
export function reliefAllowsStep(r: ReliefData | undefined, fx: number, fy: number, tx: number, ty: number): boolean {
  if (!r) return true;
  const a = reliefLevel(r, fx, fy), b = reliefLevel(r, tx, ty);
  const ra = rampAt(r, fx, fy), rb = rampAt(r, tx, ty);
  if (a === b) {
    // 경사로 옆구리로 드나들지 않는다: 경사로와 평지가 같은 단(lo)이라도 축 옆으로는 막는다(경사로 벽).
    const side = (ramp: { dir: RampDir } | null, dx: number, dy: number) => !!ramp && (DV[ramp.dir][0] === 0 ? dx !== 0 : dy !== 0);
    const dx = tx - fx, dy = ty - fy;
    if ((ra && !rb && side(ra, dx, dy)) || (rb && !ra && side(rb, dx, dy))) return false;
    return true;
  }
  const dx = tx - fx, dy = ty - fy;
  const up = b > a;
  const along = (ramp: { dir: RampDir }, sgn: 1 | -1) => DV[ramp.dir][0] * sgn === dx && DV[ramp.dir][1] * sgn === dy;
  if (up && ra && along(ra, 1)) return true;
  if (!up && rb && along(rb, -1)) return true;
  return false;
}

/** 다리 판 칸(relief.ramps 코드 9, r3 2026-09-29): 걷기로는 보통 칸(그 칸 단 그대로), 렌더는 둑 없는 네모 판(render.ts bridges). */
export const RELIEF_BRIDGE = 9;
/** 다리 판 칸 → (그 밑 골짜기 바닥 단 + 1), 다리 아닌 칸 0. 바닥 단 = 둘레 8칸 중 다리 아닌 칸의 가장 낮은 단. */
export function reliefBridgeMask(r: ReliefData): Uint8Array | undefined {
  if (!r.ramps?.some((v) => v === RELIEF_BRIDGE)) return undefined;
  const W = r.width, out = new Uint8Array(r.levels.length);
  for (let i = 0; i < out.length; i++) {
    if (r.ramps[i] !== RELIEF_BRIDGE) continue;
    const x = i % W, y = (i / W) | 0; let floor = r.levels[i] ?? 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, j = Y * W + X;
      if (X >= 0 && Y >= 0 && X < W && Y < r.height && r.ramps[j] !== RELIEF_BRIDGE) floor = Math.min(floor, r.levels[j] ?? 0);
    }
    out[i] = floor + 1;
  }
  return out;
}

/** 높이 규칙이 있는 맵인지(평지·없음이면 false). */
export const hasRelief = (r: ReliefData | undefined): r is ReliefData => !!r && r.levels.some((v) => v > 0);
export { gridFromRelief };
