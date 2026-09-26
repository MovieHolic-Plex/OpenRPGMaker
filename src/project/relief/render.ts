// 높이 격자 → 3/4 시점 절벽 그림. /tmp 원형(auto-hill-paint)의 render/buildHp 를 그대로 옮겼다.
// DOM 에 기대지 않는다: RGBA 바이트를 돌려주므로 편집기 캔버스·플레이어·Node 스크립트가 같이 쓴다.
//
// 좌표: 맵 화소 (px, py) 의 높이가 c 이면 화면 y = py + pad - c*U. pad = 최고 단 × U.
// 벽은 윗면 가장자리에서 (높이차 × U) 화소만큼 남쪽으로 내려 그린다.

import palette from "./reliefPalette.json";
import { copyGrid, RELIEF_MAX_LEVEL, RELIEF_TILE as T, RELIEF_UNIT as U, type HeightGrid } from "./types";

type Rgb = [number, number, number];
const D = palette as { G: Rgb[]; B: Rgb[]; TOP: number[]; GROUND: number[]; LIP: Record<"L" | "M" | "R", number[]>; TILES: number[][] };
const RAMPS = [D.G, D.B];
const { TOP, GROUND, LIP, TILES } = D;
const LV = Array.from({ length: RELIEF_MAX_LEVEL + 1 }, (_, i) => Math.min(3, Math.floor(i / 3)));
const OUT_G = 0, OUT_B = 6, DRIP = 6, CW = 14, CH = 8;
const shift = (p: number, s: number) => { const r = (p / 6) | 0, i = p % 6; return r * 6 + Math.max(1, Math.min(5, i + s)); };

export interface ReliefRenderOptions {
  /** 단마다 윗면을 조금씩 밝게 (기본 켬) */
  tone?: boolean;
  /** 마칭 스퀘어 대각선 절벽 (기본 켬). 끄면 칸 단위 네모 절벽. */
  diag?: boolean;
  /**
   * 0단 맨땅을 투명하게 (기본 끔). 편집기처럼 타일 위에 겹칠 때 켠다 — 0단 칸은 타일이 그대로 보이고,
   * 절벽 발치 그늘만 검은 반투명으로 남는다.
   */
  transparentGround?: boolean;
}

export interface ReliefRender {
  /** 절벽 그림 RGBA, 크기 PW × SH */
  rgba: Uint8ClampedArray;
  /** 가려진 윗면 투시 층 RGBA (알파 0 = 없음) */
  xray: Uint8ClampedArray;
  PW: number;
  SH: number;
  /** 화면 위쪽 여백 = 최고 단 × U */
  pad: number;
  /** 화면 화소를 그린 맵 칸 번호 (y*W+x), -1 = 빈 곳. 물체 가림 판정에 쓴다. */
  src: Int32Array;
  /** 반 넘게 가려진 칸 [x, y] */
  hidden: [number, number][];
}

export function hsh3(a: number, b: number, c: number): number {
  let v = 2166136261;
  v = Math.imul(v ^ a, 16777619) >>> 0;
  v = Math.imul(v ^ b, 16777619) >>> 0;
  v = Math.imul(v ^ c, 16777619) >>> 0;
  return v;
}
const fdiv = (a: number, b: number) => Math.floor(a / b);
function jit(sx: number, c: number) {
  const a = hsh3(fdiv(sx, 3), c, 5) % 3, b = hsh3(fdiv(sx, 3) + 1, c, 5) % 3;
  return sx % 3 < 2 ? a : (a + b) >> 1;
}
function chunkRaw(x: number, y: number): [number, number] {
  const gy = fdiv(y, CH); let bd = Infinity, bx = 0, by = 0;
  for (let yy = gy - 1; yy <= gy + 1; yy++) {
    const off = hsh3(yy, 0, 91) % CW, gx = fdiv(x - off, CW);
    for (let xx = gx - 1; xx <= gx + 1; xx++) {
      const h = hsh3(xx, yy, 17);
      const px = xx * CW + off + h % CW, py = yy * CH + (h >>> 8) % CH;
      const d = ((x - px) * 0.75) ** 2 + (y - py) ** 2;
      if (d < bd) { bd = d; bx = xx; by = yy; }
    }
  }
  return [bx, by];
}
// 벽 덩이(보로노이) 표는 화면 좌표에만 의존하므로 크기가 바뀔 때만 다시 만든다
let CK: Int32Array | null = null, CKX = new Int32Array(0), CKY = new Int32Array(0), CKW = 0, CKH = 0;
function ensureChunks(PW: number, SH: number) {
  if (CK && CKW === PW + 1 && CKH >= SH + 5) return;
  CKW = PW + 1; CKH = SH + 5 + 64;
  CK = new Int32Array(CKW * CKH); CKX = new Int32Array(CKW * CKH); CKY = new Int32Array(CKW * CKH);
  for (let r = 0; r < CKH; r++) for (let x = 0; x < CKW; x++) {
    const [a, b] = chunkRaw(x, r - 2), i = r * CKW + x;
    CKX[i] = a; CKY[i] = b; CK[i] = (a + 4096) * 8192 + (b + 4096);
  }
}

// ---- 높이 규칙: 렌더가 그릴 수 없는 1칸 폭 돌기·홈을 깎는다 ----
export function prune(h0: HeightGrid): HeightGrid {
  const h = copyGrid(h0), H = h.length, W = h[0].length;
  for (let it = 0; it < 8; it++) {
    let ch = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = h[y][x]; let n = 0, m = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, v = (X >= 0 && X < W && Y >= 0 && Y < H) ? h[Y][X] : c;
        if (v < c) { n++; if (v > m) m = v; }
      }
      if (n >= 3) { h[y][x] = m; ch = true; }
    }
    if (!ch) break;
  }
  return h;
}
export function cleanup(h0: HeightGrid): HeightGrid {
  const h = copyGrid(h0), H = h.length, W = h[0].length;
  for (let it = 0; it < 12; it++) {
    let ch = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = h[y][x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const a = (x - dx >= 0 && y - dy >= 0) ? h[y - dy][x - dx] : 0;
        const b = (x + dx < W && y + dy < H) ? h[y + dy][x + dx] : 0;
        if (v > a && v > b) { h[y][x] = Math.max(a, b); ch = true; break; }
      }
    }
    if (!ch) break;
  }
  return h;
}
export function thin(h0: HeightGrid): HeightGrid {
  const h = copyGrid(h0), H = h.length, W = h[0].length;
  const at = (j: number, i: number) => (j >= 0 && j < H && i >= 0 && i < W) ? h[j][i] : 0;
  for (let it = 0; it < 6; it++) {
    let ch = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = h[y][x];
      for (const [a, b] of [[[y, x - 1], [y, x + 1]], [[y - 1, x], [y + 1, x]]]) {
        const m = Math.max(at(a[0], a[1]), at(b[0], b[1]));
        if (v > m) { h[y][x] = m; ch = true; break; }
      }
    }
    if (!ch) break;
  }
  return h;
}
/** 칠한 높이 → 렌더가 실제로 그리는 높이 */
export const effectiveHeights = (h: HeightGrid): HeightGrid => thin(cleanup(h));

// 사분면 안 화소 i,j (0..15). a b / c d = 네 칸 중심이 이 단 이상인가
function inside(a: boolean, b: boolean, c: boolean, d: boolean, i: number, j: number): boolean {
  const n = +a + +b + +c + +d;
  if (n === 0) return false;
  if (n === 4) return true;
  const tl = i + j < 7, tr = (15 - i) + j < 7, bl = i + (15 - j) < 7, br = (15 - i) + (15 - j) < 7;
  if (n === 1) return a ? tl : b ? tr : c ? bl : br;
  if (n === 3) return !(a ? false : tl) && !(b ? false : tr) && !(c ? false : bl) && !(d ? false : br);
  if (a && b) return j < 8;
  if (c && d) return j >= 8;
  if (a && c) return i < 8;
  if (b && d) return i >= 8;
  return a ? (tl || br) : (tr || bl);
}

/** 화소 단위 높이. 대각선 절벽: 칸 중심을 꼭짓점으로 한 마칭 스퀘어. */
export function buildPixelHeights(h0: HeightGrid, diag = true) {
  const h = prune(h0), H = h.length, W = h[0].length, PW = W * T, PH = H * T;
  const hp = new Int8Array(PW * PH);
  const gc = (x: number, y: number) => h[Math.max(0, Math.min(H - 1, y))][Math.max(0, Math.min(W - 1, x))];
  if (diag) {
    for (let py = 0; py < PH; py++) {
      const y0 = Math.floor((py - 8) / T), j = (py - 8) - y0 * T;
      for (let px = 0; px < PW; px++) {
        const x0 = Math.floor((px - 8) / T), i = (px - 8) - x0 * T;
        const A = gc(x0, y0), B = gc(x0 + 1, y0), C = gc(x0, y0 + 1), Dd = gc(x0 + 1, y0 + 1);
        const lo = Math.min(A, B, C, Dd);
        let v = lo;
        for (let c = Math.max(A, B, C, Dd); c > lo; c--)
          if (inside(A >= c, B >= c, C >= c, Dd >= c, i, j)) { v = c; break; }
        hp[py * PW + px] = v;
      }
    }
    return { hp, PW, PH };
  }
  // 옛 방식: 칸 단위 네모 절벽, 1칸 계단 모서리만 반 칸 삼각형으로 깎는다
  const g = (x: number, y: number) => y < H ? gc(x, y) : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = h[y][x], N = g(x, y - 1), S = g(x, y + 1), E = g(x + 1, y), Wn = g(x - 1, y);
    let mode = 0, lowv = 0;
    if (c > 0) {
      if (S < c && E < c && g(x + 1, y - 1) >= c && g(x - 1, y + 1) >= c) { mode = 1; lowv = Math.max(S, E); }
      else if (S < c && Wn < c && g(x - 1, y - 1) >= c && g(x + 1, y + 1) >= c) { mode = 2; lowv = Math.max(S, Wn); }
      else if (N < c && E < c && g(x - 1, y - 1) >= c && g(x + 1, y + 1) >= c) { mode = 3; lowv = Math.max(N, E); }
      else if (N < c && Wn < c && g(x + 1, y - 1) >= c && g(x - 1, y + 1) >= c) { mode = 4; lowv = Math.max(N, Wn); }
    }
    for (let ly = 0; ly < T; ly++) for (let lx = 0; lx < T; lx++) {
      let v = c;
      if ((mode === 1 && lx + ly > 15) || (mode === 2 && lx < ly) || (mode === 3 && lx > ly) || (mode === 4 && lx + ly < 15)) v = lowv;
      hp[(y * T + ly) * PW + x * T + lx] = v;
    }
  }
  return { hp, PW, PH };
}

export function renderRelief(h: HeightGrid, opt: ReliefRenderOptions = {}): ReliefRender {
  const { hp, PW, PH } = buildPixelHeights(h, opt.diag !== false);
  let mx = 0; for (let i = 0; i < hp.length; i++) if (hp[i] > mx) mx = hp[i];
  const pad = mx * U, SH = PH + pad, N = SH * PW;
  ensureChunks(PW, SH);
  const CKa = CK!;
  const ck = (x: number, y: number) => CKa[(y + 2) * CKW + x];
  const kind = new Int8Array(N).fill(-1), lev = new Int8Array(N), dep = new Int16Array(N), run = new Int16Array(N);
  const out = new Int8Array(N).fill(-1), src = new Int32Array(N).fill(-1);
  const W = PW / T, NC = W * (PH / T);
  const hid = new Int8Array(N).fill(-1), hidSrc = new Int32Array(N).fill(-1);
  const topN = new Int32Array(NC), hidN = new Int32Array(NC);
  const hide = (i: number, c: number) => { if (kind[i] === 0 && lev[i] < c && hid[i] < 0) { hid[i] = out[i]; hidSrc[i] = src[i]; hidN[src[i]]++; } };
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const c = hp[py * PW + px], sy = py + pad - c * U, i = sy * PW + px, cell = (py >> 4) * W + (px >> 4);
    hide(i, c); topN[cell]++;
    out[i] = c ? shift(TOP[(py % T) * T + px % T], LV[c]) : GROUND[(py % T) * T + px % T];
    kind[i] = 0; lev[i] = c; src[i] = cell;
    const hs = py + 1 < PH ? hp[(py + 1) * PW + px] : 0;
    if (hs >= c) continue;
    const n = (c - hs) * U;
    for (let d = 0; d < n; d++) {
      const w = (sy + 1 + d) * PW + px;
      hide(w, c);
      kind[w] = 1; lev[w] = c; dep[w] = d; run[w] = n; src[w] = cell;
    }
  }
  // 벽 조각
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 1) continue;
    const c = lev[i], d = dep[i], n = run[i], row = sy * PW;
    const same = (x: number) => x >= 0 && x < PW && kind[row + x] === 1 && lev[row + x] === c;
    const wall = (x: number) => x >= 0 && x < PW && kind[row + x] === 1;
    const diagN = (x: number) => x >= 0 && x < PW && kind[row + x] === 0 && lev[row + x] === c;
    const cL = d < DRIP && diagN(sx - 1), cR = d < DRIP && diagN(sx + 1);
    const L = !same(sx - 1) && !cL, R = !same(sx + 1) && !cR, EL = !wall(sx - 1) && !cL, ER = !wall(sx + 1) && !cR;
    const j = jit(sx, c), de = DRIP + j; let p: number;
    if (d < de) {
      p = LIP[L ? "L" : R ? "R" : "M"][Math.max(0, d - j) * T + (L ? 0 : R ? 15 : sx % T)];
    } else {
      const dd = d - de, ci = (sy + 2) * CKW + sx, cid = CKa[ci];
      const hr = hsh3(CKX[ci], CKY[ci], 31);
      const tl = TILES[hr % TILES.length];
      const t = tl[((sy + (hr >>> 5)) % 14) * 14 + (sx + (hr >>> 9)) % 14];
      const base = ((hr >>> 13) % 3) ? 3 : 2;
      p = 6 + base + Math.max(-1, Math.min(1, (t % 6) - 3)) * (((hr >>> 15) % 2) || ((sx + sy) % 2));
      if (ck(sx, sy + 1) !== cid) p = 7;
      else if (ck(sx + 1, sy) !== cid) p = shift(p, -1);
      else if (ck(sx, sy - 1) !== cid) p = 6 + Math.min(5, base + 2);
      else if (ck(sx, sy - 2) !== cid) p = shift(p, 1);
      else if (ck(sx, sy + 2) !== cid) p = shift(p, -1);
      if (n > U) {
        // 단 경계 = 층리. 경계 바로 아래는 밝은 선반, 위는 그늘. 몇 곳은 풀 턱이 걸린다
        const r = (d + (hr >>> 19) % 3 - 1) % U, k = Math.floor((d + 1) / U);
        const shelf = k > 0 && k * U < n - 4 && hsh3(fdiv(sx, 11 + k), k, c * 7) % 3 === 0;
        if (shelf && r >= 0 && r < 3) p = LIP.M[Math.min(5, r + 3) * T + sx % T];
        else if (r === 0 && ((hr >>> 21) % 4) && d > de + 1 && d < n - 2) p = 7;
        else if (r === 1 && d > de) p = shift(p, 1);
        else if (r >= U - 3 && d < n - 2) p = shift(p, -1);
      } else if (dd < 2) p = shift(p, -1);
      if (d === n - 2) p = shift(p, -1);
      if (d === n - 1) p = OUT_B;
    }
    if (EL || ER) p = OUT_B;
    else if (((L && lev[i - 1] > c) || (R && lev[i + 1] > c)) && d < DRIP + 4) p = shift(p, -1);
    else if (!wall(sx + 2)) p = shift(p, -1);
    else if (!wall(sx - 2)) p = shift(p, 1);
    // 비스듬한 면: 빛이 북서쪽이라 남서향(＼)은 밝게, 남동향(／)은 어둡게
    if (d >= de && p % 6 && d < n - 1) {
      const rd = same(sx + 1) ? dep[i + 1] - d : 0, ld = same(sx - 1) ? dep[i - 1] - d : 0;
      if (rd === 1 || ld === -1) p = shift(p, -1);
      else if (ld === 1 || rd === -1) p = shift(p, 1);
    }
    out[i] = p;
  }
  // 윗면 가장자리와 그늘
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 0) continue;
    const c = lev[i];
    const top = (y: number, x: number) => y >= 0 && y < SH && x >= 0 && x < PW && kind[y * PW + x] === 0 && lev[y * PW + x] === c;
    const kL = kind[sy * PW + (sx - 1 + PW) % PW];
    if (c) {
      if (sy > 0 && !top(sy - 1, sx) && kind[i - PW] !== 1) {
        out[i] = OUT_G;
        if (top(sy + 1, sx)) out[i + PW] = 4;
        continue;
      }
      if (!top(sy, sx - 1) && kL !== 1) { out[i] = OUT_G; continue; }
      if (!top(sy, sx + 1) && (sx + 1 >= PW || kind[i + 1] !== 1)) { out[i] = OUT_G; continue; }
    }
    if (out[i] < 0 || out[i] >= 6 || out[i] === OUT_G) continue;
    const py = sy - pad + c * U, mp = py * PW + sx;
    let s = 0;
    for (let k = 1; k <= 10 && sy - k >= 0; k++) {                   // 북쪽 벽 발치
      const jj = i - k * PW; if (kind[jj] !== 1) break;
      const d = lev[jj] - c; if (d <= 0) break;
      s = Math.max(s, k <= 2 ? 2 : k <= 1 + 2 * d ? 1 : 0);
    }
    for (let k = 1; k <= 12 && sx - k >= 0; k++) {                   // 서쪽이 높다 → 동쪽으로 긴 그늘
      const d = hp[mp - k] - c; if (d <= 0) continue;
      if (k <= 1 + 3 * d) s = Math.max(s, k <= 1 + d ? 2 : 1);
      break;
    }
    for (let k = 1; k <= 4 && sx + k < PW; k++) {                    // 동쪽이 높다 → 짧은 발치 그늘
      const d = hp[mp + k] - c; if (d <= 0) continue;
      if (k <= Math.min(4, d)) s = Math.max(s, 1);
      break;
    }
    for (let k = 1; k <= 6 && sy + k < SH; k++) {                    // 남쪽 높은 땅 뒤
      const jj = i + k * PW; if (kind[jj] !== 0) break;
      const d = lev[jj] - c; if (d <= 0) continue;
      if (k <= 1 + d) s = Math.max(s, 1);
      break;
    }
    if (c) {
      const lw = sx >= 2 && hp[mp - 2] < c && hp[mp - 1] === c, le = sx + 2 < PW && hp[mp + 2] < c && hp[mp + 1] === c;
      if (!s && lw) out[i] = Math.min(5, out[i] + 1);
      if (le) s = Math.max(s, 1);
    }
    if (s) out[i] = Math.max(1, out[i] - s);
  }
  const rgba = new Uint8ClampedArray(N * 4), xray = new Uint8ClampedArray(N * 4);
  const tone = opt.tone !== false ? (c: number) => Math.max(0.9, Math.min(1.22, 0.94 + 0.026 * c)) : () => 1;
  const hidCell = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) hidCell[k] = topN[k] && hidN[k] * 2 >= topN[k] ? 1 : 0;
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; let p = out[i];
    if (p < 0) p = GROUND[(sy % T) * T + sx % T];
    const col = RAMPS[(p / 6) | 0][p % 6], o = i * 4, f = kind[i] === 0 ? tone(lev[i]) : 1;
    if (opt.transparentGround && kind[i] < 0) continue;
    if (opt.transparentGround && kind[i] === 0 && lev[i] === 0) {
      const shade = GROUND[(sy % T) * T + sx % T] - p;
      rgba[o + 3] = shade > 0 ? Math.min(150, 55 * shade) : 0;
    } else {
      rgba[o] = col[0] * f; rgba[o + 1] = col[1] * f; rgba[o + 2] = col[2] * f; rgba[o + 3] = 255;
    }
    if (hid[i] >= 0 && hidCell[hidSrc[i]]) {
      const edge = [1, -1, PW, -PW].some((dd) => { const jj = i + dd; return jj < 0 || jj >= N || hid[jj] < 0 || !hidCell[hidSrc[jj]]; });
      if (edge) { xray[o] = 90; xray[o + 1] = 230; xray[o + 2] = 255; xray[o + 3] = 255; }
      else if (sx % 2 === 0 && sy % 2 === 0) {
        const hc = RAMPS[(hid[i] / 6) | 0][hid[i] % 6];
        xray[o] = hc[0] * 0.6 + 40; xray[o + 1] = hc[1] * 0.6 + 80; xray[o + 2] = hc[2] * 0.6 + 100; xray[o + 3] = 255;
      }
    }
  }
  const hidden: [number, number][] = [];
  for (let k = 0; k < NC; k++) if (hidCell[k]) hidden.push([k % W, (k / W) | 0]);
  return { rgba, xray, PW, SH, pad, src, hidden };
}
