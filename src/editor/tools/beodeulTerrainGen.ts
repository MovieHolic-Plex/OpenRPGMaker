// 코드 지형 생성(2026-10-30 사용자 「지형은 코드가 생성한다(약간 무작위) — 지금 지형이 너무 밋밋하다」).
//
// 띠(등고선 몇 줄)를 쌓던 지형 먼저(beodeulHeightFirst)와 달리, 높이맵을 먼저 만들고 물이 흐르는 대로 깎은 뒤 단 수로 자른다:
//   1. 높이: 시드 기울기 잡음 fBm 을 잡음으로 한 번 비튼다(domain warping, Quilez) + 요청 성격 힌트(언덕·비탈·계단식·고원·평지)의 큰 모양.
//      능선 잡음(ridged)을 높은 쪽에 섞어 산등성이를 세운다(Red Blob Games 「Making maps with noise functions」의 재분배 pow 포함).
//   2. 침식: 우선순위 범람(priority-flood, Barnes 2014)으로 웅덩이를 채워 모든 물이 맵 가장자리로 빠지게 하고, D8 흐름 방향·흐름 누적으로
//      하천력 침식(stream power, Cordonnier 2016 · Schott 2023 의 격자 명시 적분)을 몇 번 — 골짜기가 나뭇가지처럼 파인다. 그다음 열 침식
//      (talus, Musgrave 1989) 몇 번으로 날카로운 턱을 무너뜨린다.
//   3. 물: 강은 높은 쪽 가장자리에서 낮은 쪽 가장자리로 높이를 비용으로 한 최소 비용 길(골짜기를 따라 굽는다), 강바닥은 하류로 갈수록 낮게
//      판다(mapgen4 의 canyon). 호수는 채운 웅덩이 깊이로, 사막은 가장 낮은 분지에 오아시스 못, 늪은 낮은 땅에 얕은 못 여럿, 바닷가는 낮은 쪽 바다.
//   4. 단 수 자르기(terracing): 땅 높이의 분위수 문턱으로 0~N 단. 자르기 전에 낮은 주파수 잡음으로 높이를 흔들어 단 가장자리가 등고선 그대로
//      곧게 서지 않게 하고, 자른 뒤 1칸 목·작은 조각·두 단 넘는 낭떠러지를 다듬는다(16px 칸 relief: 한 단 = 절벽면 한 칸).
//   5. 요약: 단 덩이(높이·넓이·중심·평평한 자리)·가장 높은 곳·강 건널 곳·못 — 마을 자리는 조수가 이 요약과 그림을 보고 고른다.
// 같은 요청이라도 씨앗마다 다르고, 직선·계단꼴 띠가 생기지 않는다(단 경계는 높이맵의 등고선).
import { tidyLevels } from "./beodeulTerrain";

export const TERRAIN_CHARACTERS = ["hill", "slope", "terraces", "plateau", "flat"] as const;
export type TerrainCharacter = (typeof TERRAIN_CHARACTERS)[number];
export type TerrainHigh = "north" | "south" | "west" | "east" | "center";
export type TerrainWater = "river" | "none" | "lake" | "oasis" | "bog" | "sea";

export interface TerrainGenInput {
  W: number; H: number; seed: number;
  /** 요청 성격 힌트(모델이 준 landform) — 큰 모양만 기운다. 없으면 씨앗이 고른다. */
  character?: TerrainCharacter;
  high?: TerrainHigh;
  water: TerrainWater;
  /** 위로 쌓을 단 수 힌트(1~4). */
  tiers?: number;
}

export interface TerrainArea {
  id: number; level: number; area: number;
  x0: number; y0: number; x1: number; y1: number;
  /** 덩이 안에서 가장자리에서 가장 먼 칸(평평한 자리 한가운데). */
  cx: number; cy: number;
  /** 가장자리에서 2칸 이상 떨어진 칸 수(집·광장이 앉을 수 있는 속 넓이). */
  inner: number;
}

export interface CodeTerrain {
  W: number; H: number;
  character: TerrainCharacter; high: TerrainHigh;
  /** 0~1 높이(침식 뒤). */
  height: Float32Array;
  levels: Uint8Array;
  /** 0 땅 · 1 강 · 2 못(호수·오아시스·늪 못) · 3 바다. */
  water: Uint8Array;
  /** 강 가운데 줄(상류 → 하류). */
  river: number[];
  /** 숲이 어울리는 정도(0~1): 물기(흐름 누적)·비탈·높이. */
  forest: Float32Array;
  areas: TerrainArea[];
  /** 강 건널 자리 후보(강이 곧게 3칸 흐르고 양쪽 둑이 같은 단). */
  crossings: { x: number; y: number; dir: "ns" | "ew" }[];
  maxLevel: number;
  note: string;
}

// ── 시드 잡음 ──
function rng(seed: number): () => number {
  let s = (seed ^ 0x2c1b3c6d) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}
/** 2차원 기울기 잡음(Perlin) — 값은 대략 -1~1. */
function gradientNoise(seed: number): (x: number, y: number) => number {
  const r = rng(seed); const perm = new Uint8Array(512); const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j]!, p[i]!]; }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255]!;
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y;
    const g = (i: number, j: number, dx: number, dy: number) => { const h = perm[(perm[(X + i) & 255]! + Y + j) & 255]!; return gx[h]! * dx + gy[h]! * dy; };
    const u = fade(fx), v = fade(fy);
    const a = g(0, 0, fx, fy), b = g(1, 0, fx - 1, fy), c = g(0, 1, fx, fy - 1), d = g(1, 1, fx - 1, fy - 1);
    return 1.4 * ((a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v);
  };
}
function fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 5, lac = 2.0, gain = 0.5): number {
  let s = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < oct; o += 1) { s += amp * n(x * f + o * 17.3, y * f + o * 9.1); norm += amp; amp *= gain; f *= lac; }
  return s / norm;
}
function ridged(n: (x: number, y: number) => number, x: number, y: number, oct = 4): number {
  let s = 0, amp = 0.6, f = 1, w = 1, norm = 0;
  for (let o = 0; o < oct; o += 1) { let v = 1 - Math.abs(n(x * f + 31.7 * o, y * f - 12.9 * o)); v *= v * w; w = Math.min(1, v * 1.6); s += v * amp; norm += amp; amp *= 0.5; f *= 2.1; }
  return s / norm;
}

// ── 물 흐름 ──
const N8: readonly [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 작은 이진 힙(값이 작은 것부터). */
class MinHeap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p]! <= key) break; k[i] = k[p]!; v[i] = v[p]!; i = p; } k[i] = key; v[i] = val; }
  pop(): [number, number] {
    const k = this.k, v = this.v; const rk = k[0]!, rv = v[0]!; const lk = k.pop()!, lv = v.pop()!;
    if (k.length) { let i = 0; const n = k.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1]! < k[c]!) c += 1; if (k[c]! >= lk) break; k[i] = k[c]!; v[i] = v[c]!; i = c; } k[i] = lk; v[i] = lv; }
    return [rk, rv];
  }
}

/** 우선순위 범람(Barnes 2014, ε 변형): 가장자리에서 안쪽으로 낮은 곳부터 넘치게 채운다 — 결과는 모든 칸이 가장자리로 내려가는 높이. */
export function priorityFlood(h: Float32Array, W: number, H: number, eps = 1e-5): Float32Array {
  const f = Float32Array.from(h); const done = new Uint8Array(W * H); const q = new MinHeap();
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { const c = y * W + x; done[c] = 1; q.push(f[c]!, c); }
  while (q.size) {
    const [z, c] = q.pop(); const x = c % W, y = (c - x) / W;
    for (const [dx, dy] of N8) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (done[n]) continue; done[n] = 1; if (f[n]! <= z) f[n] = z + eps; q.push(f[n]!, n); }
  }
  return f;
}

/** D8 받는 칸(가장 가파르게 내려가는 이웃, 가장자리·없으면 -1)과 흐름 누적(칸마다 비 1). */
function flow(f: Float32Array, W: number, H: number): { recv: Int32Array; acc: Float32Array } {
  const recv = new Int32Array(W * H).fill(-1);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = y * W + x; let best = 0, bn = -1;
    for (const [dx, dy, d] of N8) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; const s = (f[c]! - f[n]!) / d; if (s > best) { best = s; bn = n; } }
    recv[c] = bn;
  }
  const order = Array.from({ length: W * H }, (_, i) => i).sort((a, b) => f[b]! - f[a]!);
  const acc = new Float32Array(W * H).fill(1);
  for (const c of order) { const r = recv[c]!; if (r >= 0) acc[r] += acc[c]!; }
  return { recv, acc };
}

/** 하천력 침식(stream power: dh = -K·A^m·S) + 열 침식(talus). 격자 명시 적분 몇 번 — 3천 칸 맵에서 수 ms. */
function erode(h: Float32Array, W: number, H: number, iters: number, K: number, talus: number): Float32Array {
  for (let it = 0; it < iters; it += 1) {
    const f = priorityFlood(h, W, H);
    const { recv, acc } = flow(f, W, H);
    const norm = 1 / Math.sqrt(W * H);
    for (let c = 0; c < W * H; c += 1) {
      const r = recv[c]!; if (r < 0) continue;
      const dx = (c % W) - (r % W), dy = Math.floor(c / W) - Math.floor(r / W);
      const s = Math.max(0, f[c]! - f[r]!) / Math.hypot(dx, dy);
      const e = K * Math.sqrt(acc[c]! * norm) * s;
      h[c] = Math.max(h[r]!, h[c]! - e);
    }
    // 열 침식: 이웃보다 talus 넘게 높으면 차이의 1/4 을 가장 낮은 이웃으로
    for (let t = 0; t < 2; t += 1) for (let c = 0; c < W * H; c += 1) {
      const x = c % W, y = (c - x) / W; let lo = -1, dmax = 0;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; const d = h[c]! - h[n]!; if (d > dmax) { dmax = d; lo = n; } }
      if (lo >= 0 && dmax > talus) { const m = (dmax - talus) * 0.25; h[c] -= m; h[lo] += m; }
    }
  }
  return h;
}

/** 강: from 가장자리 칸들 중 하나에서 to 가장자리까지 높이 비용 최소 길(4이웃). 골짜기를 따라 굽는다. */
function riverPath(h: Float32Array, W: number, H: number, from: number[], toEdge: (x: number, y: number) => boolean, wiggle: (x: number, y: number) => number): number[] {
  const dist = new Float64Array(W * H).fill(Infinity); const prev = new Int32Array(W * H).fill(-1); const q = new MinHeap();
  for (const c of from) { dist[c] = 0; q.push(0, c); }
  let end = -1;
  while (q.size) {
    const [d, c] = q.pop(); if (d > dist[c]!) continue; const x = c % W, y = (c - x) / W;
    if (toEdge(x, y) && !from.includes(c)) { end = c; break; }
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X;
      // 높이가 비용(골짜기를 탄다) · 오르막은 크게 · 맵 옆 가장자리 가까이는 비싸게(강이 맵 테두리를 따라 흐르지 않게)
      const edge = Math.min(X, Y, W - 1 - X, H - 1 - Y);
      const up = Math.max(0, h[n]! - h[c]!);
      const cost = 0.6 + 30 * h[n]! * h[n]! + 60 * up + (edge < 5 && !toEdge(X, Y) ? 14 - 2.5 * edge : 0) + 2.2 * wiggle(X, Y);
      const nd = d + cost; if (nd < dist[n]!) { dist[n] = nd; prev[n] = c; q.push(nd, n); }
    }
  }
  const path: number[] = []; for (let c = end; c >= 0; c = prev[c]!) path.push(c);
  return path.reverse();
}

/**
 * 굽이: 최소 비용 길은 평평한 곳에서 자로 그은 듯 곧다 — 5~7칸마다 열쇠점을 잡아 흐름에 수직으로 ±3칸 흔들고(사인 + 잡음, 굽이가 번갈아),
 * 열쇠점을 Catmull-Rom 곡선으로 이어 4이웃 칸 줄로 다시 긋는다. 양 끝(가장자리 어귀)은 그대로.
 */
function meanderPath(path: number[], W: number, H: number, rand: () => number): number[] {
  if (path.length < 12) return path;
  const pts: [number, number][] = [];
  const step = 5 + Math.floor(rand() * 3), ph = rand() * Math.PI * 2, amp = 2 + rand() * 1.5;
  for (let i = 0; i < path.length; i += step) pts.push([path[i]! % W, Math.floor(path[i]! / W)]);
  const last = path[path.length - 1]!; pts.push([last % W, Math.floor(last / W)]);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i + 1]!; let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const o = amp * Math.sin(i * 1.15 + ph) + (rand() - 0.5) * 1.6;
    pts[i] = [Math.max(2, Math.min(W - 3, pts[i]![0] - dy * o)), Math.max(2, Math.min(H - 3, pts[i]![1] + dx * o))];
  }
  const out: number[] = []; const push = (x: number, y: number) => {
    const c = y * W + x; const p = out[out.length - 1];
    if (p === c) return;
    if (p !== undefined) { const px = p % W, py = (p - px) / W; if (px !== x && py !== y) out.push(py * W + x); } // 대각 걸음은 한 칸 끼워 4이웃으로
    out.push(c);
  };
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const n = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 3));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      push(Math.max(0, Math.min(W - 1, Math.round(f(p0[0], p1[0], p2[0], p3[0])))), Math.max(0, Math.min(H - 1, Math.round(f(p0[1], p1[1], p2[1], p3[1])))));
    }
  }
  // 되돌아 겹친 칸(고리) 걷기
  const seen = new Map<number, number>(); const res: number[] = [];
  for (const c of out) { const j = seen.get(c); if (j !== undefined) { for (const d of res.splice(j + 1)) seen.delete(d); continue; } seen.set(c, res.length); res.push(c); }
  return res;
}

function components(W: number, H: number, same: (a: number, b: number) => boolean, ok: (c: number) => boolean): { comp: Int32Array; list: number[][] } {
  const comp = new Int32Array(W * H).fill(-1); const list: number[][] = [];
  for (let c0 = 0; c0 < W * H; c0 += 1) {
    if (comp[c0]! >= 0 || !ok(c0)) continue; const cells = [c0]; comp[c0] = list.length;
    for (let i = 0; i < cells.length; i += 1) { const c = cells[i]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (comp[n]! < 0 && ok(n) && same(c, n)) { comp[n] = list.length; cells.push(n); } } }
    list.push(cells);
  }
  return { comp, list };
}

const CHAR_LABEL: Record<TerrainCharacter, string> = { hill: "언덕", slope: "산비탈", terraces: "계단식 단", plateau: "고원", flat: "평지" };

export function generateCodeTerrain(input: TerrainGenInput): CodeTerrain {
  const { W, H, seed } = input;
  const r = rng(seed * 2654435761 + 97);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const character: TerrainCharacter = input.character ?? pick(["hill", "slope", "terraces", "plateau", "hill", "terraces"] as const);
  const high: TerrainHigh = input.high ?? (character === "hill" || character === "plateau" ? pick(["center", "center", "north", "west", "east"] as const) : pick(["north", "north", "west", "east", "north"] as const));
  const n1 = gradientNoise(seed * 31 + 1), n2 = gradientNoise(seed * 31 + 2), n3 = gradientNoise(seed * 31 + 3), n4 = gradientNoise(seed * 31 + 4);
  const F = 16 + r() * 8; // 큰 모양 하나의 칸 수(맵 하나에 산·골이 두세 개)
  const ox = r() * 100, oy = r() * 100;
  // 높은 곳 자리: 언덕·고원 꼭대기 중심, 비탈·계단식은 그쪽 가장자리
  const hx = high === "west" ? W * (0.18 + r() * 0.1) : high === "east" ? W * (0.72 + r() * 0.1) : W * (0.35 + r() * 0.3);
  const hy = high === "north" ? H * (0.15 + r() * 0.1) : high === "south" ? H * (0.75 + r() * 0.1) : H * (0.3 + r() * 0.3);
  const h = new Float32Array(W * H);
  const warpK = 0.9 + r() * 0.8;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    // 동서로 늘인 잡음(가로 1.8배) — 3/4 시점에서 높이는 남쪽을 보는 절벽으로만 읽힌다. 둥근 잡음은 남북 단 경계(가는 선)를 맵 곳곳에 그었다(ab12 판정자 「풀밭 위 다각형 윤곽선」)
    const px = x / (F * 1.8) + ox, py = y / F + oy;
    // domain warping(Quilez): 좌표를 fBm 으로 한 번 비튼다 — 둥근 혹이 고르게 늘어선 fBm 이 골짜기·곶 모양으로 흐른다
    const qx = fbm(n2, px, py, 3), qy = fbm(n3, px + 5.2, py + 1.3, 3);
    const base = fbm(n1, px + warpK * qx, py + warpK * qy, 5) * 0.5 + 0.5;
    const rid = ridged(n4, px * 0.9 + qx, py * 0.9 + qy);
    // 큰 모양(요청 성격): 기울기·혹·고원
    const tx = (x - hx) / W, ty = (y - hy) / H;
    // 서·동이 높아도 북쪽으로 함께 오른다 — 순수 동서 기울기는 단 경계가 남북으로 달려 가는 선만 남았다
    const toward = high === "north" ? 1 - y / H : high === "south" ? y / H : high === "west" ? 0.5 * (1 - x / W) + 0.5 * (1 - y / H) : high === "east" ? 0.5 * (x / W) + 0.5 * (1 - y / H) : 1 - Math.min(1, Math.hypot(tx, ty) * 2.2);
    const dome = Math.max(0, 1 - Math.hypot(tx * 1.1, ty * 1.9) * 2.2); // 동서로 긴 혹
    let v: number;
    if (character === "flat") v = 0.55 * base + 0.15 * toward;
    else if (character === "slope") v = 0.35 * base + 0.5 * toward + 0.3 * rid * toward;
    else if (character === "terraces") v = 0.45 * base + 0.45 * toward + 0.1 * rid;
    else if (character === "hill") v = 0.4 * base + 0.55 * (high === "center" ? dome : 0.5 * dome + 0.5 * toward) + 0.12 * rid * dome;
    else v = 0.4 * base + 0.55 * (high === "center" ? dome : 0.6 * dome + 0.4 * toward);
    h[y * W + x] = v;
  }
  // 0~1 로 펴고 재분배(pow: 1 보다 크면 낮은 땅이 넓게 — 마을이 앉을 평평한 터)
  let mn = Infinity, mx = -Infinity; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const expo = character === "flat" ? 1.6 : character === "slope" ? 1.1 : 1.3;
  for (let c = 0; c < W * H; c += 1) h[c] = Math.pow((h[c]! - mn) / Math.max(1e-6, mx - mn), expo);
  if (character === "plateau") {
    // 고원: 높은 쪽을 판판하게 자른다(메사) — 위는 평평, 옆은 가파르다
    for (let c = 0; c < W * H; c += 1) { const v = h[c]!; h[c] = v > 0.55 ? 0.78 + (v - 0.55) * 0.25 : v * (0.78 / 0.55) * (0.55 + 0.45 * (v / 0.55)); }
  }
  erode(h, W, H, character === "flat" ? 6 : 10, 0.9, 0.05);

  // ── 물 ──
  const water = new Uint8Array(W * H);
  const river: number[] = [];
  const notes: string[] = [];
  const edgeOf = (x: number, y: number) => x === 0 ? "west" : x === W - 1 ? "east" : y === 0 ? "north" : y === H - 1 ? "south" : null;
  if (input.water === "sea") {
    // 바다: 높은 곳 반대쪽 가장자리에서 낮은 땅(분위 22%)을 따라 들어온다
    const side = high === "north" ? "south" : high === "south" ? "north" : high === "west" ? "east" : high === "east" ? "west" : pick(["south", "east", "west"] as const);
    const sorted = Float32Array.from(h).sort(); const lvl = sorted[Math.floor(sorted.length * 0.24)]!;
    const seen = new Uint8Array(W * H); const q: number[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (edgeOf(x, y) === side || (side === "south" && y >= H - 2) || (side === "north" && y <= 1) || (side === "west" && x <= 1) || (side === "east" && x >= W - 2)) { const c = y * W + x; seen[c] = 1; q.push(c); }
    for (let i = 0; i < q.length; i += 1) { const c = q[i]!; water[c] = 3; const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (!seen[n] && h[n]! < lvl) { seen[n] = 1; q.push(n); } } }
    // 바닷가 다수결 두 번 — 높이맵 잡음이 1칸 가시·구멍을 남겼다
    for (let pass = 0; pass < 2; pass += 1) { const out = Uint8Array.from(water); for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) { let k = 0; for (const [dx, dy] of N8) if (water[(y + dy) * W + x + dx] === 3) k += 1; const c = y * W + x; if (water[c] === 3 && k <= 3) out[c] = 0; else if (!water[c] && k >= 5) out[c] = 3; } water.set(out); }
    notes.push(`바다는 ${side} 쪽`);
  }
  if (input.water === "river") {
    // 높은 쪽 가장자리(언덕·고원이면 아무 가장자리)에서 나와, 다른 가장자리 중 가장 낮은 쪽으로 빠진다
    const edges = ["north", "south", "west", "east"] as const;
    const cellsOf = (e: string) => { const out: number[] = []; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (edgeOf(x, y) === e && Math.min(x, y, W - 1 - x, H - 1 - y) === 0 && (e === "north" || e === "south" ? x >= 6 && x <= W - 7 : y >= 6 && y <= H - 7)) out.push(y * W + x); return out; };
    const meanH = (e: string) => { const cs = cellsOf(e); return cs.reduce((s, c) => s + h[c]!, 0) / Math.max(1, cs.length); };
    const src = high !== "center" ? high : edges[Math.floor(r() * 4)]!;
    const opp = { north: "south", south: "north", west: "east", east: "west" } as const;
    const sinks = edges.filter((e) => e !== src).sort((a, b) => meanH(a) - meanH(b));
    const sink = r() < 0.6 ? opp[src] : sinks[0]!;
    // 들어오는 자리: 그 가장자리의 낮은 칸(골짜기 어귀) 몇 개
    const from = cellsOf(src).sort((a, b) => h[a]! - h[b]!).slice(0, 4);
    const wig = gradientNoise(seed * 31 + 9);
    const path = meanderPath(riverPath(h, W, H, from, (x, y) => edgeOf(x, y) === sink, (x, y) => 0.5 + 0.5 * wig(x / 4, y / 4)), W, H, r);
    if (path.length > 8) {
      // 강바닥은 하류로 갈수록 낮게(canyon) — 둑은 강에서 멀어질수록 원래 높이로
      let run = Infinity; const bed = new Float32Array(path.length);
      path.forEach((c, i) => { run = Math.min(run, h[c]!) - 0.004; bed[i] = run; });
      const dist = new Float32Array(W * H).fill(Infinity); const near = new Int32Array(W * H).fill(-1); const q: number[] = [];
      path.forEach((c, i) => { dist[c] = 0; near[c] = i; q.push(c); });
      for (let i = 0; i < q.length; i += 1) { const c = q[i]!, x = c % W, y = (c - x) / W; if (dist[c]! >= 4) continue;
        for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (dist[n]! > dist[c]! + 1) { dist[n] = dist[c]! + 1; near[n] = near[c]!; q.push(n); } } }
      for (let c = 0; c < W * H; c += 1) {
        if (near[c]! < 0) continue; const b = bed[near[c]!]!, d = dist[c]!;
        if (d <= 1) { water[c] = 1; h[c] = b; } else h[c] = Math.min(h[c]!, b + 0.035 * (d - 1));
      }
      river.push(...path);
      notes.push(`강은 ${src} → ${sink}`);
    }
  }
  if (input.water === "lake" || input.water === "oasis" || input.water === "bog") {
    // 채운 웅덩이 깊이가 깊은 곳이 못 — 없으면(사막 오아시스는 늘) 가장 낮은 안쪽 땅에 둥근 분지를 판다
    const f = priorityFlood(h, W, H);
    const deep = (c: number) => f[c]! - h[c]! > (input.water === "bog" ? 0.004 : 0.012);
    const { list } = components(W, H, () => true, (c) => deep(c) && !water[c]);
    const lakes = list.filter((cs) => cs.length >= 5).sort((a, b) => b.length - a.length).slice(0, input.water === "bog" ? 5 : 1);
    for (const cs of lakes) for (const c of cs) water[c] = 2;
    const want = input.water === "bog" ? 4 : 1;
    let made = lakes.length;
    const ln = gradientNoise(seed * 31 + 11);
    for (let t = 0; t < 60 && made < want; t += 1) {
      // 가장 낮은 안쪽 칸 근처에 잡음으로 일그러진 분지
      let best = -1; for (let k = 0; k < 40; k += 1) { const x = 5 + Math.floor(r() * (W - 10)), y = 5 + Math.floor(r() * (H - 10)); const c = y * W + x; if (water[c]) continue; if (best < 0 || h[c]! < h[best]!) best = c; }
      if (best < 0) break;
      const bx = best % W, by = (best - bx) / W; const rx = input.water === "bog" ? 2 + r() * 3 : 3 + r() * 2.5, ry = rx * (0.6 + r() * 0.5);
      let n = 0;
      for (let y = Math.max(1, Math.floor(by - ry - 2)); y <= Math.min(H - 2, by + ry + 2); y += 1) for (let x = Math.max(1, Math.floor(bx - rx - 2)); x <= Math.min(W - 2, bx + rx + 2); x += 1) {
        const ex = (x - bx) / rx, ey = (y - by) / ry; if (ex * ex + ey * ey + 0.45 * ln(x / 3, y / 3) <= 1) { const c = y * W + x; water[c] = 2; n += 1; }
      }
      if (n >= 6) made += 1;
    }
    notes.push(`${input.water === "oasis" ? "오아시스 못" : input.water === "bog" ? "늪 못" : "못"} ${made}개`);
  }

  // ── 단 자르기 ──
  const tiersHint = input.tiers && input.tiers > 0 ? Math.min(4, input.tiers) : undefined;
  // 단 문턱(땅 높이 분위수): 성격마다 단 수가 다르다. 맨 아래 단이 넓어야 마을·밭이 선다.
  const fr: number[] = character === "flat" ? [0.78]
    // 단은 넓게(2026-10-30 첫 판: 문턱 넷이 좁은 띠를 여럿 만들어 맵이 등고선 지도처럼 선투성이였다) — 기본 두 단, 힌트로 더
    : character === "slope" ? [0.36, 0.62, 0.84].slice(0, tiersHint ?? 2)
    : character === "terraces" ? [0.4, 0.68, 0.88].slice(0, tiersHint ?? 2)
    : character === "plateau" ? [0.42, 0.68]
    : [0.48, 0.78, 0.92].slice(0, tiersHint ?? 2);
  const land = [...h].filter((_, c) => !water[c]).sort((a, b) => a - b);
  const thr = fr.map((q) => land[Math.min(land.length - 1, Math.floor(land.length * q))] ?? 1);
  // 자르기 전에 낮은 주파수 잡음으로 높이를 흔든다 — 단 가장자리가 높이맵 등고선을 자로 잰 듯 따라가지 않게
  const jn = gradientNoise(seed * 31 + 7);
  const lv = new Uint8Array(W * H);
  for (let c = 0; c < W * H; c += 1) {
    const x = c % W, y = (c - x) / W; const v = h[c]! + 0.035 * jn(x / 5, y / 5);
    let L = 0; for (const t of thr) if (v >= t) L += 1;
    // 고원: 꼭대기는 그 아래 단보다 두 단 높다(두꺼운 벽)
    if (character === "plateau" && L >= 2) L = 3;
    lv[c] = L;
  }
  // 물: 강·못·바다는 그 물에 닿은 땅 중 가장 낮은 단에 — 물 칸과 둘레 한 칸(둑)을 그 단으로
  {
    const { list } = components(W, H, (a, b) => water[a] === water[b], (c) => water[c]! > 0);
    for (const cs of list) {
      let low = 99; for (const c of cs) { const x = c % W, y = (c - x) / W; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (!water[n]) low = Math.min(low, lv[n]!); } }
      if (low === 99) low = 0;
      for (const c of cs) { lv[c] = low; const x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (!water[n] && lv[n]! > low) lv[n] = low; } }
    }
  }
  // 다듬기: 다수결(8이웃) 두 번 → 1칸 목·구멍 정리 → 작은 조각 합치기 → 이웃 단 차 2 넘는 곳 깎기 → tidyLevels
  for (let pass = 0; pass < 4; pass += 1) {
    const out = Uint8Array.from(lv);
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      const c = y * W + x; if (water[c]) continue; const cnt = new Map<number, number>();
      for (const [dx, dy] of N8) { const n = (y + dy) * W + x + dx; if (!water[n]) cnt.set(lv[n]!, (cnt.get(lv[n]!) ?? 0) + 1); }
      const own = cnt.get(lv[c]!) ?? 0; if (own >= 4) continue;
      let best = lv[c]!, bk = own; for (const [L, k] of cnt) if (k > bk) { best = L; bk = k; }
      out[c] = best;
    }
    lv.set(out);
  }
  const cellHash = (x: number, y: number) => { let k = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177) >>> 0; k ^= k >>> 13; k = Math.imul(k, 1103515245) >>> 0; return (k >>> 8) / 16777216; };
  // 옆 경계 비스듬히(2026-10-30 ab12 판정 8:12 「풀밭 위 다각형 윤곽선·떠 있는 대지」): 3/4 탑뷰에서 높이는 남쪽을 보는 절벽으로만 두껍게 그려지고
  // 동·서를 보는 단 경계는 가는 세로선이 된다. 두 줄 넘게 곧게 내려가는 옆 경계는 아래 칸부터 한 칸씩 깎아 45° 계단(짧은 남향 절벽이 이어진 사선)으로 —
  // 옛 띠 지형의 「사라지는 옆면」과 같은 읽힘. 물 칸은 건드리지 않는다.
  for (let pass = 0; pass < 40; pass += 1) {
    let changed = false;
    for (let y = H - 2; y >= 0; y -= 1) for (let x = 0; x < W; x += 1) {
      const c = y * W + x, b = c + W; if (water[c] || water[b]) continue; const L = lv[c]!; if (lv[b] !== L) continue;
      for (const dx of [1, -1]) {
        const X = x + dx; if (X < 0 || X >= W) continue; const n = c + dx, m = b + dx;
        if (water[n] || water[m] || lv[n]! >= L || lv[m]! >= L) continue;
        // 칸마다 정해진 값으로 열에 셋 중 하나는 깎지 않는다 — 자로 그은 45° 사선이 아니라 가파르기가 들쭉날쭉한 사선(ab13 판정 「곧은 긴 대각선」)
        if (cellHash(x, y + 1) < 0.3) continue;
        lv[b] = Math.max(lv[m]!, lv[n]!); changed = true; break;
      }
    }
    if (!changed) break;
  }
  // 가로 다수결(7칸 창) 두 번 — 등고선의 한두 열짜리 톱니(판정자 「지그재그 절벽」)를 펴서 남쪽 절벽 띠가 길게 이어지게
  for (let pass = 0; pass < 2; pass += 1) {
    const out = Uint8Array.from(lv);
    for (let y = 0; y < H; y += 1) for (let x = 3; x < W - 3; x += 1) {
      const c = y * W + x; if (water[c]) continue; const cnt = new Map<number, number>();
      for (let k = -3; k <= 3; k += 1) { const n = c + k; if (!water[n]) cnt.set(lv[n]!, (cnt.get(lv[n]!) ?? 0) + 1); }
      let best = lv[c]!, bk = cnt.get(lv[c]!) ?? 0; for (const [L, k] of cnt) if (k > bk) { best = L; bk = k; }
      if (bk >= 4) out[c] = best;
    }
    lv.set(out);
  }
  const minArea = Math.max(80, Math.round(W * H * 0.045));
  for (let pass = 0; pass < 3; pass += 1) {
    const { comp, list } = components(W, H, (a, b) => lv[a] === lv[b], (c) => !water[c]);
    let changed = false;
    list.forEach((cs, i) => {
      if (cs.length >= minArea) return;
      const cnt = new Map<number, number>();
      for (const c of cs) { const x = c % W, y = (c - x) / W; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (comp[n] !== i && !water[n]) cnt.set(lv[n]!, (cnt.get(lv[n]!) ?? 0) + 1); } }
      let best = -1, bk = 0; for (const [L, k] of cnt) if (k > bk) { best = L; bk = k; }
      if (best >= 0) { for (const c of cs) lv[c] = best; changed = true; }
    });
    if (!changed) break;
  }
  // 움푹 팬 단(둘레가 모두 더 높은 단이고 맵 가장자리·물에 안 닿는 덩이)은 메운다 — 3/4 에서 북쪽 절벽만 보이고 나머지는 가는 선으로 떠 보였다
  {
    const { comp, list } = components(W, H, (a, b) => lv[a] === lv[b], (c) => !water[c]);
    list.forEach((cs, i) => {
      let rim = 99, open = false;
      for (const c of cs) { const x = c % W, y = (c - x) / W; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { open = true; break; }
        for (const [dx, dy] of N4) { const n = (y + dy) * W + x + dx; if (comp[n] === i) continue; if (water[n] || lv[n]! < lv[c]!) { open = true; break; } rim = Math.min(rim, lv[n]!); } if (open) break; }
      if (!open && rim < 99 && cs.length < W * H * 0.12) for (const c of cs) lv[c] = rim;
    });
  }
  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    for (let c = 0; c < W * H; c += 1) { const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const n = Y * W + X; if (lv[c]! - lv[n]! > 1) { lv[c] -= 1; changed = true; break; } } }
    if (!changed) break;
  }
  tidyLevels(lv, W, H);
  // 단 하나 = 두 칸 절벽(2026-10-30 ab13 판정 「절벽이 1px 갈색 선 — 높이가 안 읽힌다」): 띠 지형의 마을 위 단처럼 이웃 단 차를 2 로 —
  // 3/4 에서 남향 절벽면이 두 칸 높이로 그려지고, 길은 세 칸 계단으로 오른다.
  if (character !== "flat") for (let c = 0; c < W * H; c += 1) lv[c] = lv[c]! * 2;
  for (let c = 0; c < W * H; c += 1) if (water[c]) { /* 물은 다듬기에서 둑과 같은 단으로 남아 있다 */ }
  let maxLevel = 0; for (const v of lv) maxLevel = Math.max(maxLevel, v);

  // ── 숲 어울림 ──
  const { acc } = flow(priorityFlood(h, W, H), W, H);
  const fn = gradientNoise(seed * 31 + 13);
  const forest = new Float32Array(W * H);
  let amx = 1; for (const a of acc) amx = Math.max(amx, a);
  for (let c = 0; c < W * H; c += 1) {
    if (water[c]) continue; const x = c % W, y = (c - x) / W;
    const wet = Math.log(acc[c]!) / Math.log(amx);
    const hi = maxLevel ? lv[c]! / maxLevel : 0;
    forest[c] = Math.max(0, Math.min(1, 0.45 * (fn(x / 6, y / 6) * 0.5 + 0.5) + 0.3 * wet + 0.35 * hi - 0.1));
  }

  // ── 요약: 단 덩이·건널 곳 ──
  const { list } = components(W, H, (a, b) => lv[a] === lv[b], (c) => !water[c]);
  const areas: TerrainArea[] = list.map((cs, id) => {
    const set = new Set(cs); let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const c of cs) { const x = c % W, y = (c - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    // 덩이 가장자리에서의 거리(BFS) — 가장 먼 칸이 평평한 자리 한가운데
    const d = new Map<number, number>(); const q: number[] = [];
    for (const c of cs) { const x = c % W, y = (c - x) / W; if (N4.some(([dx, dy]) => !set.has((y + dy) * W + x + dx) || x + dx < 0 || x + dx >= W)) { d.set(c, 0); q.push(c); } }
    for (let i = 0; i < q.length; i += 1) { const c = q[i]!, x = c % W, y = (c - x) / W; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || X >= W) continue; const n = Y * W + X; if (set.has(n) && !d.has(n)) { d.set(n, d.get(c)! + 1); q.push(n); } } }
    let bc = cs[0]!, bd = -1, inner = 0; for (const [c, v] of d) { if (v >= 2) inner += 1; if (v > bd) { bd = v; bc = c; } }
    return { id, level: lv[cs[0]!]!, area: cs.length, x0, y0, x1, y1, cx: bc % W, cy: Math.floor(bc / W), inner };
  }).sort((a, b) => b.area - a.area);
  const crossings: CodeTerrain["crossings"] = [];
  for (let i = 2; i < river.length - 2; i += 1) {
    const c = river[i]!, x = c % W, y = (c - x) / W;
    const px = river[i - 2]! % W, nx = river[i + 2]! % W, py = Math.floor(river[i - 2]! / W), ny = Math.floor(river[i + 2]! / W);
    const dir = px === nx && px === x ? "ns" : py === ny && py === y ? "ew" : null; if (!dir) continue;
    // 강이 남북으로 흐르면 동서로 건넌다 — 양쪽 둑(3칸 밖) 땅이 같은 단
    const [ax, ay, bx, by] = dir === "ns" ? [x - 3, y, x + 3, y] : [x, y - 3, x, y + 3];
    if (ax < 0 || bx >= W || ay < 0 || by >= H) continue;
    const a = ay * W + ax, b = by * W + bx; if (water[a] || water[b] || lv[a] !== lv[b]) continue;
    if (crossings.some((k) => Math.abs(k.x - x) + Math.abs(k.y - y) < 6)) continue;
    crossings.push({ x, y, dir: dir === "ns" ? "ew" : "ns" });
  }
  const counts = new Map<number, number>(); for (let c = 0; c < W * H; c += 1) if (!water[c]) counts.set(lv[c]!, (counts.get(lv[c]!) ?? 0) + 1);
  const note = `코드 지형 · ${CHAR_LABEL[character]}(높은 곳 ${high}) · 단 ${[...counts.keys()].sort().map((k) => `${k}:${counts.get(k)}`).join("/")}${notes.length ? " · " + notes.join(" · ") : ""}`;
  return { W, H, character, high, height: h, levels: lv, water, river, forest, areas, crossings, maxLevel, note };
}

/** 모델에게 보여 줄 지형 요약(글) — 좌표는 칸(x 오른쪽, y 아래). */
export function describeCodeTerrain(t: CodeTerrain): string {
  const big = t.areas.filter((a) => a.area >= 40).slice(0, 8);
  const lines = big.map((a) => `단${a.level} 터: 넓이 ${a.area}칸(속 ${a.inner}) · 범위 (${a.x0},${a.y0})~(${a.x1},${a.y1}) · 한가운데 (${a.cx},${a.cy})`);
  const top = [...t.areas].filter((a) => a.area >= 30).sort((a, b) => b.level - a.level || b.area - a.area)[0];
  const water: string[] = [];
  if (t.river.length) { const a = t.river[0]!, b = t.river[t.river.length - 1]!; water.push(`강 (${a % t.W},${Math.floor(a / t.W)}) → (${b % t.W},${Math.floor(b / t.W)})`); }
  if (t.crossings.length) water.push(`강 건널 자리 ${t.crossings.slice(0, 4).map((k) => `(${k.x},${k.y})`).join(" ")}`);
  let lake = 0, sea = 0; for (const v of t.water) { if (v === 2) lake += 1; if (v === 3) sea += 1; }
  if (lake) water.push(`못 ${lake}칸`); if (sea) water.push(`바다 ${sea}칸`);
  return [`${t.W}×${t.H} ${t.note}`, ...lines, top ? `가장 높은 터: 단${top.level} (${top.cx},${top.cy})` : "", water.join(" · ")].filter(Boolean).join("\n");
}
