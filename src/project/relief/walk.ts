// 높이 지형(map.relief)의 걷기 규칙과 경사로 표기. 권위: 런타임 이동(collision.ts canMove)·도달성 검사·렌더가 같은 함수를 쓴다.
//
// 경사로(ramp)는 칸 표기다: relief.ramps[i] = 0(없음) | 1~4 매끈한 경사로(오르막 n·s·e·w) | 5~8 계단(같은 방향 + 4) | 9 다리 판(r3, 걷기는 보통 칸).
// 경사로 칸의 levels 값은 그 경사로의 낮은 끝 단(lo)이다. 단이 다른 이웃 칸으로는 못 간다 —
// 유효한 통로의 양 끝은 같은 높이의 층계참과 축 방향으로만 연결된다. 옆구리와 끊긴 표기는 못 건넌다.
// 경사로 사각형(렌더용 ReliefSlope)은 양 끝이 완전한 축 방향 줄끼리만 병합한다(reliefSlopes).
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

const slopeCache = new WeakMap<ReliefData, { levels: number[]; ramps: number[] | undefined; style: string | undefined; slopes: ReliefSlope[]; owners: Int32Array }>();
/** In-place authoring must invalidate geometry before querying movement again. */
export function invalidateReliefSlopes(r: ReliefData): void { slopeCache.delete(r); }

/** Scan actual axial lanes, merging only identical complete flights. Never fill holes in a bounding box. */
export function reliefSlopes(r: ReliefData): ReliefSlope[] {
  const cached = slopeCache.get(r);
  if (cached && cached.levels === r.levels && cached.ramps === r.ramps && cached.style === r.style) return cached.slopes;
  if (!r.ramps?.some((v) => v >= 1 && v <= 8)) {
    const slopes: ReliefSlope[] = [];
    slopeCache.set(r, { levels: r.levels, ramps: r.ramps, style: r.style, slopes, owners: new Int32Array(0) });
    return slopes;
  }
  // r3: smoothStairs styles draw their stair ramps as slopes (no steps); carvedStairs styles cut one step per level climbed (log flights one more)
  const smooth = reliefSmoothStairs(r.style), carved = reliefCarvedStairs(r.style);
  const seen = new Uint8Array(r.width * r.height), out: ReliefSlope[] = [];
  for (let s = 0; s < seen.length; s++) {
    const v = r.ramps[s] ?? 0;
    if (!v || v > 8 || seen[s]) continue;
    const dir = DIRS[(v - 1) % 4]!, [dx, dy] = DV[dir];
    const lo = r.levels[s] ?? 0, cells: number[] = [];
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < r.width && y < r.height;
    const matches = (x: number, y: number) => inside(x, y) && r.ramps![y * r.width + x] === v && r.levels[y * r.width + x] === lo;
    let bx = s % r.width, by = (s / r.width) | 0;
    while (matches(bx - dx, by - dy)) { bx -= dx; by -= dy; }
    let ex = bx, ey = by;
    while (matches(ex, ey)) { const i = ey * r.width + ex; cells.push(i); seen[i] = 1; ex += dx; ey += dy; }
    // Both landings must exist; a stray ramp flag does not grant cliff traversal.
    if (!inside(bx - dx, by - dy) || !inside(ex, ey) || reliefLevel(r, bx - dx, by - dy) !== lo || rampAt(r, bx - dx, by - dy) || rampAt(r, ex, ey)) continue;
    const hi = reliefLevel(r, ex, ey);
    if (hi <= lo) continue;
    const x0 = Math.min(bx, ex - dx), y0 = Math.min(by, ey - dy), x1 = Math.max(bx, ex - dx), y1 = Math.max(by, ey - dy);
    const len = dir === "n" || dir === "s" ? y1 - y0 + 1 : x1 - x0 + 1;
    // carved (r3 QA): a stone flight one step a level (risers the face's own height — two a level read as a ladder), a log flight
    // (log styles, four cells or more across) one log a level plus one; everything else two steps a cell as before
    const across = dir === "n" || dir === "s" ? x1 - x0 + 1 : y1 - y0 + 1;
    const steps = carved ? Math.max(2, hi - lo + (carved.log && across >= 4 ? 1 : 0)) : Math.max(2, len * 2);
    const previous = out.find(p => p.dir === dir && p.lo === lo && p.hi === hi && !!p.steps === (v > 4 && !smooth)
      && (dx === 0 ? p.y === y0 && p.h === len && p.x + p.w === x0 : p.x === x0 && p.w === len && p.y + p.h === y0));
    if (previous) { if (dx === 0) previous.w++; else previous.h++; }
    else out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, dir, lo, hi, ...(v > 4 && !smooth ? { steps } : {}) });
  }
  const owners = new Int32Array(r.width * r.height).fill(-1);
  if (carved) for (const s of out) if (s.steps) { const across = s.dir === "n" || s.dir === "s" ? s.w : s.h; s.steps = Math.max(2, s.hi - s.lo + (carved.log && across >= 4 ? 1 : 0)); }
  out.forEach((p, id) => { for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) owners[y * r.width + x] = id; });
  slopeCache.set(r, { levels: r.levels, ramps: r.ramps, style: r.style, slopes: out, owners });
  return out;
}

/**
 * 높이 규칙만 본 한 걸음(4방향 이웃 사이). 같은 단이면 된다. 단이 다르면 둘 중 하나가 경사로이고
 * 걸음 방향이 그 경사로 축(오르막 방향 또는 그 반대)이며, 높은 쪽이 경사로 오르막 끝 쪽일 때만 된다.
 */
export function reliefAllowsStep(r: ReliefData | undefined, fx: number, fy: number, tx: number, ty: number): boolean {
  if (!r) return true;
  const dx = tx - fx, dy = ty - fy;
  if (Math.abs(dx) + Math.abs(dy) !== 1 || fx < 0 || fy < 0 || tx < 0 || ty < 0 || fx >= r.width || tx >= r.width || fy >= r.height || ty >= r.height) return false;
  const a = reliefLevel(r, fx, fy), b = reliefLevel(r, tx, ty);
  const ra = rampAt(r, fx, fy), rb = rampAt(r, tx, ty);
  if (!ra && !rb) return a === b;
  reliefSlopes(r);
  const geometry = slopeCache.get(r);
  const sa = geometry?.slopes[geometry.owners[fy * r.width + fx]!], sb = geometry?.slopes[geometry.owners[ty * r.width + tx]!];
  if (ra && !sa || rb && !sb) return false;
  if (sa && sb) return sa === sb;
  const slope = sa ?? sb!;
  const [ax, ay] = DV[slope.dir];
  if (dx * ay !== 0 || dy * ax !== 0) return false;
  const rampX = sa ? fx : tx, rampY = sa ? fy : ty, plain = sa ? b : a;
  const outX = sa ? dx : -dx, outY = sa ? dy : -dy;
  const along = slope.dir === "n" ? slope.y + slope.h - 1 - rampY : slope.dir === "s" ? rampY - slope.y : slope.dir === "w" ? slope.x + slope.w - 1 - rampX : rampX - slope.x;
  const length = ax ? slope.w : slope.h;
  return outX === ax && outY === ay ? along === length - 1 && plain === slope.hi : along === 0 && plain === slope.lo;
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
