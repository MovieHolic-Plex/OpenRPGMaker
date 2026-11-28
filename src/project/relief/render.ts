// 높이 격자 → 3/4 시점 절벽 그림. /tmp 원형(auto-hill-paint)의 render/buildHp 를 그대로 옮겼다.
// DOM 에 기대지 않는다: RGBA 바이트를 돌려주므로 편집기 캔버스·플레이어·Node 스크립트가 같이 쓴다.
//
// 좌표: 맵 화소 (px, py) 의 높이가 c 이면 화면 y = py + pad - c*U. pad = 최고 단 × U.
// 벽은 윗면 가장자리에서 (높이차 × U) 화소만큼 남쪽으로 내려 그린다.

import palette from "./reliefPalette.json" with { type: "json" };
import { copyGrid, RELIEF_MAX_LEVEL, RELIEF_TILE as T, RELIEF_UNIT as U, type HeightGrid } from "./types";
import { compileReliefStyle, RELIEF_DEFAULT_RIM, type ReliefWallStyle } from "./styles";
import { paintSheer } from "./sheerPaint";
import { sheerArt } from "./sheerArt";

type Rgb = [number, number, number];
const D = palette as { G: Rgb[]; B: Rgb[]; TOP: number[]; GROUND: number[]; LIP: Record<"L" | "M" | "R", number[]>; TILES: number[][] };
const RAMPS = [D.G, D.B];
const { TOP, GROUND, LIP, TILES } = D;
// 깎아지른 양식은 단 × faceRows 높이로 그린다(최대 14 × 3) — 0~14 값은 그대로다
const LV = Array.from({ length: RELIEF_MAX_LEVEL * 3 + 1 }, (_, i) => Math.min(3, Math.floor(i / 3)));
const OUT_G = 0, OUT_B = 6, DRIP = 6, CW = 14, CH = 8;
const NATIVE_EDGE_LIGHT = [.45, .65, .8, 1, 1.1, 1.2] as const;
const shift = (p: number, s: number) => { const r = (p / 6) | 0, i = p % 6; return r * 6 + Math.max(1, Math.min(5, i + s)); };

export interface ReliefRenderOptions {
  /** Actual composed lower-layer pixels in absolute map coordinates (16px relief grid). */
  ground?: ReliefGroundSurface;
  /** 단마다 윗면을 조금씩 밝게 (기본 켬) */
  tone?: boolean;
  /** 마칭 스퀘어 대각선 절벽 (기본 켬). 끄면 칸 단위 네모 절벽. */
  diag?: boolean;
  /**
   * 0단 맨땅을 투명하게 (기본 끔). 편집기처럼 타일 위에 겹칠 때 켠다 — 0단 칸은 타일이 그대로 보이고,
   * 절벽 발치 그늘만 검은 반투명으로 남는다.
   */
  transparentGround?: boolean;
  /** 색 램프 [윗면 6단, 벽 6단(, 강조 6단)] (기본 reliefPalette 또는 style 의 램프). 색만 바꿀 때 쓴다. */
  ramps?: number[][][];
  /** 바이옴 절벽 모양(relief.style, styles.ts RELIEF_STYLES). 없거나 모르는 이름이면 기본 그림 그대로. */
  style?: string;
  /** 경사로·계단 (기본 없음). 없으면 그림이 예전과 한 바이트도 다르지 않다. */
  slopes?: ReliefSlope[];
  /**
   * 경사로 도트(선택, 바이옴 스타일에 도트가 있을 때). 매끈한 경사로 윗면을 lit(북·동으로 오르는 면)·shade(남·서로 오르는 면)
   * 16×16 반복으로 칠하고, 낮은 끝 1px 은 side 0 열 색, 높은 끝 1px 은 side 1 열 색으로 긋는다. 원본: tiledata/relief-art/<style>-ramp.ase
   * 켜면 경사로 면은 타일 위(over)로 가고, 층 밝기 곱·발치 반투명 그늘 대신 칩셋 색만 쓴다 — 곱한 색은 칩셋에 없는 색이 되어 튄다.
   */
  rampArt?: ReliefRampArt;
  /** 경사로 번호(slopes 순서)마다 통째 조각(ReliefRampArt.pieces 에서 고른 것). 조각이 있는 경사로는 화면 사각형에 그대로 찍는다. */
  slopeArt?: readonly (ReliefArtPatch | null | undefined)[];
  /**
   * 다리 판 칸(선택, r3 2026-09-29): 칸 번호마다 0 = 다리 아님, n > 0 = 다리이고 그 밑 골짜기 바닥이 n - 1 단(relief.ramps 코드 9, walk.ts reliefBridgeMask). 그 칸과 둘레 한 칸은 네모 가장자리
   * (대각선으로 깎지 않는다), 다리 칸 가장자리에는 뒤·옆 턱(rim)을 그리지 않는다 — 판자 타일이 윗면을 덮고, 옆으로는 골짜기 바닥이 보인다.
   * 없으면 그림이 예전과 같다.
   */
  bridges?: ArrayLike<number>;
  /**
   * 부분 다시 굽기(편집기 높이 붓, relief/window.ts). 주면 h 는 맵 전체에서 잘라 낸 격자이고 slopes·bridges 는 **맵 전체 좌표** 그대로다.
   * 무늬(벽 덩이·흔들림·층리·둑·계단)는 전체 그림과 같은 절대 화면 좌표로 읽으므로, 창 가장자리 여백을 뺀 안쪽은
   * 전체 렌더와 화소 하나 다르지 않다. 반환 그림의 좌표·src 는 창 기준이다.
   */
  window?: ReliefRenderWindow;
  /**
   * 세로 이동 칸(relief.ramps 10 줄사다리 · 11 덩굴, 깎아지른 양식만, 맵 전체 좌표 · 그리는 높이 단위). 비탈 면을 그리지 않고 절벽 면에 장치 조각을 건다.
   * 없으면 그림이 예전과 같다.
   */
  climbs?: readonly ReliefSlope[];
  /** 폭포(relief.falls, 깎아지른 양식만, 맵 전체 좌표). 없으면 그림이 예전과 같다. */
  falls?: readonly { readonly x: number; readonly y: number; readonly w: number }[];
}

export interface ReliefGroundSurface {
  readonly cells: Int32Array;
  readonly signature: number;
  sample(px: number, py: number, out: Uint8ClampedArray, offset: number): boolean;
}

/** {@link ReliefRenderOptions.window}. 원점·크기는 맵 칸 단위, pad·PW·SH 는 전체 그림의 값. */
export interface ReliefRenderWindow {
  /** 잘라 낸 격자의 맵 칸 원점 */
  readonly cx: number;
  readonly cy: number;
  /** 전체 그림의 위쪽 여백(px) — 창 안 최고 단이 낮아도 전체 그림과 같은 화면 y 를 쓴다 */
  readonly pad: number;
  /** 전체 그림 크기(px). 벽 덩이 표를 전체 좌표로 읽는 데 쓴다 */
  readonly PW: number;
  readonly SH: number;
  /** h 와 같은 자리를 **맵 전체에서 깎은(prune)** 격자 — 잘린 가장자리에서 깎기 결과가 달라지지 않게 */
  readonly pruned: HeightGrid;
}

export interface ReliefArtPatch { readonly w: number; readonly h: number; readonly rgba: ArrayLike<number> }
export interface ReliefRampArt {
  readonly lit: ReliefArtPatch; readonly shade: ReliefArtPatch; readonly side: ReliefArtPatch;
  /**
   * 통째 조각(선택): 매끈한 경사로 하나를 반복 무늬 대신 한 장 그림으로 칠한다. 키 = `<ramp|stairs>:<dir>:<w>x<h>:<단 차>`
   * (screen.ts reliefRenderOptions 가 경사로마다 고른다). 조각 크기 = 그 경사로가 화면에 차지하는 사각형
   * (북쪽 오르막 w 칸 × (h 칸 + 단 차) 줄) — 절벽 면 높이와 같은 줄 수의 깎인 길 + 발치. 없으면 그림이 예전과 같다.
   */
  readonly pieces?: Readonly<Record<string, ReliefArtPatch>>;
}

/**
 * 칸 사각형 [x, x+w) × [y, y+h) 안에서 높이가 dir 쪽으로 lo → hi 로 오른다.
 * steps 가 있으면 그 수만큼 계단으로 끊는다(디딤판 = 윗면, 챌면 = 벽). 없으면 매끈한 경사로.
 */
export interface ReliefSlope {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 오르막 방향 */
  dir: "n" | "s" | "e" | "w";
  lo: number;
  hi: number;
  steps?: number;
  /** 세로 이동 칸(walk.ts RELIEF_LADDER 10 · RELIEF_VINE 11). 걷기는 북쪽 오르막과 같고 그림은 절벽 면에 건 장치다. */
  climb?: number;
}

export interface ReliefRender {
  readonly nativeGround?: boolean;
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
  /** 화면 화소 종류: 0 = 윗면, 1 = 벽, -1 = 빈 곳. 윗면에 칩셋 타일을 입힐 때 쓴다. */
  kind: Int8Array;
  /** 화면 화소의 단 (윗면이면 그 화소 높이, 벽이면 벽 주인 칸 높이) */
  lev: Int8Array;
  /** 반 넘게 가려진 칸 [x, y] */
  hidden: [number, number][];
  /** 화면 화소의 경사로 번호 + 1 (0 = 경사로 아님) */
  slope: Int16Array;
  /** 경사로 안 오르막 위치 0..1 */
  slopeT: Float32Array;
  /** 화면 화소의 맵 화소 y (-1 = 빈 곳) */
  mpy: Int32Array;
  /** 화면 화소의 실수 높이 (경사로 밖은 정수) */
  height: Float32Array;
  /**
   * 윗단 가장자리 선(외곽선과 그 밑 밝은 턱) 화소 1. 윗면은 칩셋 타일이 덮으므로 이 선은 타일 위(over)로 보낸다 —
   * 벽이 안 보이는 쪽(북·동·서로 내려가는 가장자리)은 이 선이 없으면 같은 잔디끼리 붙어 단 차이가 사라진다.
   */
  edge: Uint8Array;
  /** 타일 위(over) 띠로 보낼 매끈한 경사로 윗면 화소 1. 주변 칸 타일도 비탈을 덮지 않게. */
  overSlope?: Uint8Array;
}

export function hsh3(a: number, b: number, c: number): number {
  let v = 2166136261;
  v = Math.imul(v ^ a, 16777619) >>> 0;
  v = Math.imul(v ^ b, 16777619) >>> 0;
  v = Math.imul(v ^ c, 16777619) >>> 0;
  return v;
}
const fdiv = (a: number, b: number) => Math.floor(a / b);
// ── 큰 작업 배열 재사용 ──
// 편집기 부분 굽기는 붓 표본마다 renderRelief 를 부른다. 굽기마다 화소 수만큼의 배열 스무 개를 새로 만들면 GC 가 쌓였다
// (2026-10-03 실측: 드래그 한 번에 GC 약 1.2초). 굽기 안에서만 쓰는 배열은 늘 모아 쓰고, 창 굽기(window)는 반환 배열도 모아 쓴다 —
// 창 굽기 결과는 다음 굽기 전에 읽고 버린다(relief/window.ts applyReliefPatch). 전체 굽기의 반환 배열은 늘 새로 만든다.
type Scratch = Int8Array | Int16Array | Int32Array | Uint8Array | Uint8ClampedArray | Float32Array;
const scratchPool = new Map<string, Scratch>();
function take<A extends Scratch>(key: string, make: (n: number) => A, n: number, fill: number, pooled: boolean): A {
  if (!pooled) {
    const fresh = make(n);
    if (fill) fresh.fill(fill);
    return fresh;
  }
  let buf = scratchPool.get(key) as A | undefined;
  if (!buf || buf.length < n) scratchPool.set(key, buf = make(Math.ceil(n * 1.25)));
  const view = buf.subarray(0, n) as A;
  view.fill(fill);
  return view;
}
const i8 = (n: number) => new Int8Array(n), i16 = (n: number) => new Int16Array(n), i32 = (n: number) => new Int32Array(n);
const u8 = (n: number) => new Uint8Array(n), u8c = (n: number) => new Uint8ClampedArray(n), f32 = (n: number) => new Float32Array(n);

/**
 * 줄마다 창 [t-K, t-1](dir -1) 또는 [t+1, t+K](dir 1) 의 최댓값 **상한**(줄 밖은 잘라 낸다, 빈 창은 -Infinity).
 * 줄 l 의 t 번째 값은 src[l * lineStep + t * stride]. Gil–Werman 블록 최댓값 — 길이 K 인 창은 정확하고, 줄 끝에서 잘린 창은
 * 같은 블록의 더 넓은 범위를 볼 수 있어 크거나 같다. 그늘 패스가 「이 창에 더 높은 곳이 전혀 없다」를 보고 루프를 건너뛰는 데만 쓴다.
 */
function windowMaxBound(src: ArrayLike<number>, count: number, len: number, lineStep: number, stride: number, K: number, dir: -1 | 1): Float32Array {
  const out = take(`max${K}${dir}`, f32, count * len, -Infinity, true);
  const pre = new Float32Array(len), suf = new Float32Array(len);
  for (let l = 0; l < count; l++) {
    const base = l * lineStep;
    for (let t = 0; t < len; t++) { const v = src[base + t * stride]!; pre[t] = t % K === 0 ? v : Math.max(pre[t - 1]!, v); }
    for (let t = len - 1; t >= 0; t--) { const v = src[base + t * stride]!; suf[t] = t % K === K - 1 || t === len - 1 ? v : Math.max(suf[t + 1]!, v); }
    for (let t = 0; t < len; t++) {
      const a = Math.max(0, dir < 0 ? t - K : t + 1), b = Math.min(len - 1, dir < 0 ? t - 1 : t + K);
      if (a <= b) out[base + t * stride] = Math.max(suf[a]!, pre[b]!);
    }
  }
  return out;
}
/** 칸 배열(행 우선, 폭 fullW)에서 (cx, cy) 부터 w × h 를 잘라 낸다. */
function cropCells(cells: ArrayLike<number>, fullW: number, cx: number, cy: number, w: number, h: number): number[] {
  const out = new Array<number>(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = cells[(cy + y) * fullW + cx + x] ?? 0;
  return out;
}
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
// Window-local, lazily populated Voronoi table. Coordinates remain absolute;
// a distant page must not allocate a table covering the entire map rectangle.
let CK = new Int32Array(0), CKX = new Int32Array(0), CKY = new Int32Array(0), CKFILLED = new Uint8Array(0);
let CKW = 0, CKH = 0, CKOX = 0, CKOY = 0;
function ensureChunks(x0: number, y0: number, width: number, height: number): void {
  CKOX = x0; CKOY = y0; CKW = width; CKH = height;
  const n = width * height;
  if (CK.length < n) {
    CK = new Int32Array(n); CKX = new Int32Array(n); CKY = new Int32Array(n); CKFILLED = new Uint8Array(n);
  } else CKFILLED.fill(0, 0, n);
}
function chunkIndex(x: number, y: number): number {
  const i = (y - CKOY) * CKW + x - CKOX;
  if (x < CKOX || x >= CKOX + CKW || y < CKOY || y >= CKOY + CKH) throw new RangeError("Relief pattern halo");
  if (!CKFILLED[i]) {
    const [a, b] = chunkRaw(x, y);
    CKX[i] = a; CKY[i] = b; CK[i] = (a + 4096) * 8192 + (b + 4096); CKFILLED[i] = 1;
  }
  return i;
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

/** Native height geometry at one pixel; caller supplies the already-pruned grid. */
export function samplePixelHeight(h: HeightGrid, px: number, py: number, square?: (x: number, y: number) => boolean): number {
  const H = h.length, W = h[0]!.length;
  const gc = (x: number, y: number) => h[Math.max(0, Math.min(H - 1, y))]![Math.max(0, Math.min(W - 1, x))]!;
  if (square?.(px >> 4, py >> 4)) return gc(px >> 4, py >> 4);
  const x0 = Math.floor((px - 8) / T), y0 = Math.floor((py - 8) / T), i = px - 8 - x0 * T, j = py - 8 - y0 * T;
  const A = gc(x0, y0), B = gc(x0 + 1, y0), C = gc(x0, y0 + 1), D = gc(x0 + 1, y0 + 1);
  const lo = Math.min(A, B, C, D);
  for (let c = Math.max(A, B, C, D); c > lo; c--) if (inside(A >= c, B >= c, C >= c, D >= c, i, j)) return c;
  return lo;
}

// 둥근 윤곽(깎아지른 양식): 칸 중심 지시값(이 단 이상인가)의 3차 B-스플라인을 0.5 에서 자른다. 곧은 가장자리는 칸 경계 그대로이고,
// 한 칸 계단은 매끈한 S 자로, 볼록 모서리는 반지름 약 한 칸으로 둥글어진다(마칭 스퀘어 45° 깎기의 톱니가 없다).
const BSPLINE = (t: number): [number, number, number, number] => { const s = 1 - t; return [s * s * s / 6, (3 * t * t * t - 6 * t * t + 4) / 6, (-3 * t * t * t + 3 * t * t + 3 * t + 1) / 6, t * t * t / 6]; };

/** 화소 단위 높이. 대각선 절벽: 칸 중심을 꼭짓점으로 한 마칭 스퀘어(round 면 B-스플라인 둥근 윤곽). */
export function buildPixelHeights(h0: HeightGrid, diag = true, square?: (x: number, y: number) => boolean, pruned?: HeightGrid, round = false) {
  const h = pruned ?? prune(h0), H = h.length, W = h[0].length, PW = W * T, PH = H * T;
  const hp = new Int8Array(PW * PH);
  const gc = (x: number, y: number) => h[Math.max(0, Math.min(H - 1, y))][Math.max(0, Math.min(W - 1, x))];
  if (round) {
    const wy = new Float64Array(4), lv = new Float64Array(16);
    for (let py = 0; py < PH; py++) {
      const gy = (py + 0.5) / T - 0.5, iy = Math.floor(gy); wy.set(BSPLINE(gy - iy));
      for (let px = 0; px < PW; px++) {
        if (square?.(px >> 4, py >> 4)) { hp[py * PW + px] = gc(px >> 4, py >> 4); continue; }
        const gx = (px + 0.5) / T - 0.5, ix = Math.floor(gx), wx = BSPLINE(gx - ix);
        let lo = 99, hi = -1;
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const v = gc(ix - 1 + b, iy - 1 + a); lv[a * 4 + b] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
        let v = lo;
        for (let c = hi; c > lo; c--) {
          let sum = 0;
          for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (lv[a * 4 + b]! >= c) sum += wy[a]! * wx[b]!;
          if (sum >= 0.5) { v = c; break; }
        }
        hp[py * PW + px] = v;
      }
    }
    return { hp, PW, PH };
  }
  if (diag) {
    for (let py = 0; py < PH; py++) {
      const y0 = Math.floor((py - 8) / T), j = (py - 8) - y0 * T;
      for (let px = 0; px < PW; px++) {
        // square(x, y): that cell keeps a square edge (its own level over its whole 16×16) — no diagonal cut
        if (square?.(px >> 4, py >> 4)) { hp[py * PW + px] = gc(px >> 4, py >> 4); continue; }
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

// 경사면 밝기: 빛이 북서쪽. 남향(n 오르막, 보는 쪽)·서향(e 오르막)은 밝고 반대는 어둡다
const SLOPE_LIGHT = { n: 1.05, s: 0.86, e: 1.07, w: 0.9 } as const;

/** 경사로 화소 높이. hf = 실수 높이, sid = 경사로 번호 + 1, st = 오르막 위치 */
function slopeHeights(hp: Int8Array, PW: number, PH: number, slopes: ReliefSlope[]) {
  const hf = take("hf", f32, PW * PH, 0, true), sid = take("sid", i16, PW * PH, 0, true), st = take("st", f32, PW * PH, 0, true);
  hf.set(hp);
  slopes.forEach((s, k) => {
    const x0 = Math.max(0, s.x * T), x1 = Math.min(PW, (s.x + s.w) * T);
    const y0 = Math.max(0, s.y * T), y1 = Math.min(PH, (s.y + s.h) * T);
    const len = (s.dir === "n" || s.dir === "s" ? s.h : s.w) * T;
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const a = s.dir === "n" ? (s.y + s.h) * T - py : s.dir === "s" ? py - s.y * T + 1
        : s.dir === "w" ? (s.x + s.w) * T - px : px - s.x * T + 1;
      let t = (a - 0.5) / len;
      if (s.steps) t = Math.floor(t * s.steps) / s.steps;
      const i = py * PW + px;
      hf[i] = s.lo + t * (s.hi - s.lo); sid[i] = k + 1; st[i] = (a - 0.5) / len;
    }
  });
  return { hf, sid, st };
}

// 바이옴 벽 한 화소: 입술(윗면 밑 줄, 흙·눈은 기둥마다 0~2px 더 흘러내림) → 몸통(화면 x, 벽 깊이 d 로 이어지는 무늬)
// → 덧그림(16px 기둥마다 hash 로 고름) → 발치 그늘. 경사로·계단의 챌면은 입술·덧그림 없이 몸통만 쓴다.
function styledWall(S: ReliefWallStyle, sx: number, d: number, n: number, c: number, row: number, slope: boolean): number {
  if (d >= n - 1) return OUT_B;
  const lip = S.lip.rows;
  let p = -1;
  if (!slope) {
    const j = S.jitter ? jit(sx, c) : 0, r = d < j ? 0 : d - j;
    if (r < lip.length) p = lip[r]![sx % S.lip.w]!;
  }
  if (p < 0) {
    const b = S.body[S.body.length > 1 ? hsh3(fdiv(sx, 16), c, 3) % S.body.length : 0]!;
    p = b.rows[d % b.h]![sx % b.w]!;
  }
  const o = S.overlay, od = d - Math.max(0, lip.length - 2);
  if (o && !slope && od >= 0 && od < o.rows.length && hsh3(fdiv(sx, o.w), row, c * 13 + 7) % o.every === 0) {
    const q = o.rows[od]![sx % o.w]!;
    if (q >= 0) p = q;
  }
  return d === n - 2 ? shift(p, -1) : p;
}

// ── 자연 면(style.natural, 2026-11-14 오너 「벽이 타일 하나를 복사한 느낌은 싫다. 자연스러워야한다」) ──
// 16px 무늬를 되풀이하지 않고 절대 좌표(화면 x, 땅 기준 y)의 해시·값 잡음으로 화소마다 만든다 — 부분 굽기 창에서도 전체 그림과 같다.
// hsh3(FNV)는 아랫비트가 덜 섞여 화소 잡음에 쓰면 빗금이 보인다 — 한 번 더 섞는다.
const nmix = (a: number, b: number, c: number) => { let v = hsh3(a, b, c); v ^= v >>> 15; v = Math.imul(v, 0x2c1b3c6d) >>> 0; v ^= v >>> 12; v = Math.imul(v, 0x297a2d39) >>> 0; return (v ^ (v >>> 15)) >>> 0; };
const nu = (a: number, b: number, c: number) => nmix(a, b, c) / 4294967296;
const vn1 = (t: number, k: number) => { const i = Math.floor(t), f = t - i, a = nu(i, k, 77), b = nu(i + 1, k, 77); return a + (b - a) * f * f * (3 - 2 * f); };
const vn2 = (x: number, y: number, k: number) => {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = nu(i, j, k), b = nu(i + 1, j, k), c = nu(i, j + 1, k), d = nu(i + 1, j + 1, k);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
};
const clampTone = (v: number) => Math.max(1, Math.min(5, v));
/**
 * 세로 바위 갈비(원래 버들항 도시 절벽 방식): 폭 4~11px 갈비가 저마다 다르게 휘며 내려가고, 왼쪽이 밝고 오른쪽이 어둡다.
 * 갈비 사이 틈은 이어졌다 끊겼다 해서 이웃 갈비가 붙었다 떨어지고, 갈비마다 다른 높이에서 비스듬히 깨진다. 벽 램프 1~5.
 */
function naturalRibs(ax: number, ay: number): number {
  const xx = ax + Math.round(5 * (vn1(ay * 0.06, 9) - 0.5));
  const bnd = (k: number) => k * 7 + nmix(k, 0, 3) % 5 + Math.round(3.2 * (vn1(ay * 0.13, 100 + k) - 0.5));
  let k = fdiv(xx, 7) + 1; while (xx < bnd(k)) k -= 1;
  const x0 = bnd(k), x1 = Math.max(x0 + 2, bnd(k + 1)), u = (xx - x0) / (x1 - x0);
  const bh = 15 + nmix(k, 1, 5) % 18, yy = ay + nmix(k, 2, 5) % bh + ((xx - x0) >> 1), j = fdiv(yy, bh), v = yy - j * bh;
  let sh = 2 + nmix(k, j, 4) % 3;
  if (xx >= x1 - 1 && vn1(ay * 0.09, 300 + k) > 0.28) return 1;
  if (u < 0.34) sh += 1; else if (u > 0.7) sh -= 1;
  if (v === 0 && nmix(k, j, 8) % 4) sh -= 2; else if (v === 1 && nmix(k, j, 8) % 4) sh += 1;
  const r = nmix(ax, ay, 21) % 11; if (r === 0) sh += 1; else if (r === 1) sh -= 1;
  return clampTone(sh);
}
/** 가로 켜: 두께 3~10px 켜가 물결치며 이어지고(켜마다 물결이 달라 두께가 변한다), 윗선은 밝고 아랫선(층리 틈)은 짙되 군데군데 끊기고, 켜마다 다른 자리에 세로 금. 벽 램프 1~5. */
function naturalStrata(ax: number, ay: number): number {
  const yy = ay + Math.round(5 * (vn1(ax * 0.04, 31) - 0.5));
  const bnd = (k: number) => k * 7 + nmix(k, 0, 13) % 5 + Math.round(3.4 * (vn1(ax * 0.11, 200 + k) - 0.5));
  let k = fdiv(yy, 7) + 1; while (yy < bnd(k)) k -= 1;
  const y0 = bnd(k), y1 = Math.max(y0 + 2, bnd(k + 1)), v = yy - y0, h = y1 - y0;
  let sh = 2 + nmix(k, 0, 14) % 3;
  if (vn1(ax * 0.05, 400 + k) > 0.72) sh += nmix(k, 3, 14) & 1 ? 1 : -1;
  if (v >= h - 1 && vn1(ax * 0.1, 500 + k) > 0.22) return 1;
  if (v === 0) sh += 1;
  else { const w = 19 + nmix(k, 1, 16) % 17, q = ax + nmix(k, 2, 16) % w + (v >> 1); if (q % w === 0 && nmix(fdiv(q, w), k, 17) % 3) sh -= 1; }
  const r = nmix(ax, ay, 23) % 11; if (r === 0) sh += 1; else if (r === 1) sh -= 1;
  return clampTone(sh);
}
/**
 * 턱진 바위: 두께 8~14px 선반이 층층이 — 선반 윗면 한두 줄은 밝고, 몸은 중간, 아래 선반에 닿기 전 두 줄은 짙은 그늘.
 * 선반 윗선은 물결치고 12~30px 토막마다 한두 화소 어긋나 곧은 줄이 서지 않는다. 토막 셋에 하나만 비스듬한 금이 간다. 벽 램프 1~5.
 */
function naturalLedges(ax: number, ay: number): number {
  const yy = ay + Math.round(4 * (vn1(ax * 0.045, 61) - 0.5));
  const seg = (k: number) => { const w = 12 + nmix(k, 0, 62) % 19; return fdiv(ax + nmix(k, 1, 62) % 211, w); };
  const bnd = (k: number) => k * 10 + nmix(k, 0, 63) % 5 + Math.round(3.6 * (vn1(ax * 0.09, 600 + k) - 0.5)) + nmix(seg(k), k, 64) % 3 - 1;
  let k = fdiv(yy, 10) + 1; while (yy < bnd(k)) k -= 1;
  const y0 = bnd(k), y1 = Math.max(y0 + 4, bnd(k + 1)), v = yy - y0, h = y1 - y0, b = seg(k);
  const w = 12 + nmix(k, 0, 62) % 19, u = (ax + nmix(k, 1, 62) % 211) - b * w;
  if (v === 0) return nmix(ax, k, 66) % 7 ? 5 : 4;
  if (v === 1) return vn1(ax * 0.3, 650 + k) > 0.35 ? 4 : 3;
  if (v >= h - 1) return 1;
  if (v === h - 2) return vn1(ax * 0.17, 660 + k) > 0.3 ? 2 : 1;
  const tone = vn2(ax * 0.045, ay * 0.07, 67) + 0.25 * (nu(b, k, 65) - 0.5);
  let sh = tone > 0.62 ? 4 : tone < 0.34 ? 2 : 3;
  if (nmix(b, k, 68) % 3 === 0) { const cu = u - (v >> 1); if (cu === 2) return 1; if (cu === 3) sh += 1; }
  const r = nmix(ax, ay, 69) % 12; if (r === 0) sh += 1; else if (r === 1) sh -= 1;
  return clampTone(Math.min(4, sh));
}
/**
 * 바위 절벽(참고 그림 3 의 회갈색 바위): 비스듬히 선 밝은 바위 조각이 짙은 틈 사이로 엇갈려 박힌다. 조각은 두 벌 — 큰 조각(폭 6~14 · 높이 9~14px,
 * 자리 열에 넷쯤)이 먼저 서고 그 사이를 잔 조각(폭 3~5 · 높이 4~6px)이 메워 크기가 고르지 않다. 폭이 고르지 않은 세로 금이 14~33px 마다
 * 절벽을 내리긋고(휘고, 군데군데 끊기고, 두 화소로 벌어진다) 셋에 하나는 끊기지 않는 긴 금이라 두세 칸 높이를 그대로 잇는다. 금 사이 한 폭은
 * 기둥처럼 왼쪽이 밝고 오른쪽이 어두우며, 폭마다 조각이 기우는 쪽이 다르다. 벽 램프 1~5.
 */
function naturalRock(ax: number, ay: number): number {
  const fx = (k: number) => k * 22 + nmix(k, 0, 71) % 12 + Math.round(4 * (vn1(ay * 0.07, 700 + k) - 0.5));
  let k = fdiv(ax, 22) + 1; while (ax < fx(k)) k -= 1;
  const x0 = fx(k), x1 = Math.max(x0 + 6, fx(k + 1)), off = ax - x0, u = off / (x1 - x0);
  const spine = nmix(k, 5, 71) % 3 === 0;                                    // 긴 금: 끊기지 않고 거의 내내 두 화소
  const open = spine || vn1(ay * 0.04, 800 + k) > 0.16, wide = vn1(ay * 0.09, 900 + k) > (spine ? 0.22 : 0.5);
  if (open && (off === 0 || (wide && off === 1))) return 1;
  // 바위 조각: 엇갈린 흩은 격자 칸마다 기운 마름모꼴 조각 하나. 조각 밖은 짙은 틈 — 조각 오른쪽 아래는 조각 그늘로 가장 짙다.
  // 금 사이 한 폭 안에서는 조각이 같은 쪽으로 기울고, 다섯에 하나만 반대로 눕는다. big = 큰 조각 벌(격자 12×13), 아니면 잔 조각 벌(5×6).
  const lean0 = nmix(k, 3, 71) & 1 ? 0.4 : -0.4;
  const inChip = (x: number, y: number, big: boolean): number => {
    const gw = big ? 12 : 5, gh = big ? 13 : 6, gy = fdiv(y, gh);
    for (let j = gy - 1; j <= gy + 1; j += 1) {
      const st = j & 1 ? gw >> 1 : 0, gx = fdiv(x - st, gw);
      for (let i = gx - 1; i <= gx + 1; i += 1) {
        const h = nmix(i, j, big ? 74 : 72); if (big ? h % 10 >= 4 : h % 7 === 0) continue;
        const cx = i * gw + st + (gw >> 1) + (h >>> 3) % (big ? 4 : 2), cy = j * gh + (gh >> 1) - 1 + (h >>> 5) % 3;
        const hw = big ? 3 + ((h >>> 8) % 9) * 0.5 : 1.3 + ((h >>> 8) % 3) * 0.4, hh = big ? 4.5 + ((h >>> 12) % 6) * 0.5 : 2.0 + ((h >>> 11) % 3) * 0.5;
        const lean = (h >>> 17) % 5 === 0 ? -lean0 : lean0, dy = y - cy, dx = x - cx + lean * dy;
        if (Math.abs(dy) > hh || Math.abs(dx) > hw || Math.abs(dx) / hw + Math.abs(dy) / hh > (big ? 1.7 : 1.6)) continue;
        const rim = big ? 1.4 : 0.9;
        if (dx >= hw - rim || dy >= hh - rim) return 3;
        // 큰 조각의 면: 왼쪽 위가 밝고, 결 한 줄이 비스듬히 지난다
        if (big) return dy <= -hh + 1.6 || (dx <= -hw + 1.2 && dy < 0) ? 5 : dx > hw * 0.2 && (h >>> 20) % 2 ? 3 : 4;   // 윗모서리·왼쪽 위 모서리는 밝고, 둘에 하나는 오른쪽 면이 한 톤 어둡다(각진 판)
        return dy <= -hh + 1 && dx < hw - 0.9 ? 5 : 4;
      }
    }
    return 0;
  };
  const shade = vn2(ax * 0.05, ay * 0.06, 73);
  let sh = inChip(ax, ay, true);
  if (!sh) sh = inChip(ax - 1, ay, true) || inChip(ax, ay - 1, true) || inChip(ax + 1, ay, true) ? -1 : inChip(ax, ay, false);   // 큰 조각 둘레 한 화소는 틈
  if (sh > 0) { if (u > 0.8 || shade < 0.26) sh -= 1; }
  else sh = sh < 0 || inChip(ax - 1, ay - 1, false) || shade < 0.42 ? 1 : 2;
  if (open && off === (wide ? 2 : 1)) sh -= 1;                               // 금 오른쪽 그늘
  return clampTone(sh);
}
/** 자연 면의 풀 처마 깊이(px, 3~6): 열마다 다른 길이로 드리운다(16px 처마 무늬를 되풀이하지 않는다). */
const naturalLipDepth = (ax: number) => 3 + Math.floor(2.6 * vn1(ax * 0.21, 51)) + (nmix(ax, 7, 53) % 4 === 0 ? 1 : 0);
/** 풀 처마 한 화소(윗면 램프 1~5): 끝은 짙은 풀 끝, 그 위는 중간, 맨 윗줄은 드문드문 밝은 잎. */
function naturalLip(ax: number, d: number, depth: number): number {
  if (d === depth - 1) return nmix(ax, 3, 54) % 3 ? 1 : 2;
  if (d === depth - 2) return nmix(ax, d, 55) % 4 ? 2 : 3;
  const r = nmix(ax, d, 56) % 9;
  return r === 0 ? 4 : r === 1 ? 2 : 3;
}
/** 바위 절벽의 갓돌(벽 램프 1~5, -1 = 갓돌 아님): 폭 5~8px 둥근 돌이 절벽 맨 위에 줄지어 얹힌다 — 가운데가 두껍고 양끝이 얇고, 돌 사이·밑은 짙다. */
function naturalCap(ax: number, d: number): number {
  const bnd = (k: number) => k * 6 + nmix(k, 0, 81) % 3;
  let k = fdiv(ax, 6) + 1; while (ax < bnd(k)) k -= 1;
  const x0 = bnd(k), x1 = bnd(k + 1), w = x1 - x0, u = ax - x0, h = 4 + nmix(k, 1, 81) % 3 - (u === 0 || u === w - 1 ? 1 : 0);
  if (d > h) return -1;
  if (d === h) return 1;
  if (u === w - 1) return d === 0 ? 3 : 2;
  if (d === h - 1) return 3;
  return d <= 1 && u < w - 2 ? 5 : 4;
}
/** 자연 면 발치(-1 = 그대로): 맨 아랫줄은 짙은 닿는 선, 군데군데 풀 포기(윗면 램프)와 잔돌(벽 램프 밝은 색)이 그 선을 끊는다. */
function naturalFoot(ax: number, c: number, d: number, n: number): number {
  const b = n - 1 - d;                                             // 0 = 맨 아랫줄
  if (b > 4) return -1;
  const g = fdiv(ax, 3), h = nmix(g, c, 91), kind = h % 5, u = ax - g * 3;
  if (kind === 0) { const tall = 3 + (h >>> 5) % 3 - (u === 1 ? 0 : 1 + (h >>> 9) % 2); if (b < tall) return b === tall - 1 ? 4 : b === 0 ? 1 : 2 + ((h >>> 11) + u) % 2; }   // 풀 포기
  else if (kind === 1 && (h >>> 7) % 2 && b < 2 && !(b === 1 && u !== 1)) return b === 1 ? 6 + 5 : u === 2 ? 6 + 2 : 6 + 4;                                          // 잔돌
  return b === 0 ? OUT_B : -1;
}

// ── 벽면에 판 계단(style.carvedStairs, r3 2026-09-29): 계단 경사로의 디딤판·챌면을 돌(또는 통나무 턱)로 칠한다 ──
// across: 계단 폭 방향 위치(px), width: 계단 폭(px). 돌: 절벽에 물린 자연 턱돌(서쪽 안쪽 깊은 그늘·동쪽 안쪽 햇빛), 약 8px 간격의
// 어긋난 마름돌 디딤판·코·챌면 줄눈. 통나무(log, 폭 4칸 이상 완만한 계단): 다져진 흙·풀 오솔길 디딤판 + 둥근 통나무 턱과 말뚝, 가장자리 풀 포기.
const isLogStair = (S: ReliefWallStyle, s: ReliefSlope) => !!S.carvedStairs?.log && (s.dir === "n" || s.dir === "s" ? s.w : s.h) >= 4;
function stairAcross(s: ReliefSlope, px: number, py: number): [number, number] {
  return s.dir === "n" || s.dir === "s" ? [px - s.x * T, s.w * T] : [py - s.y * T, s.h * T];
}
const safeIdx = (ramp: number, tone: number, rampCount: number) =>
  Math.min(rampCount - 1, Math.max(0, ramp)) * 6 + Math.max(0, Math.min(5, tone));

/** 절벽에 파인 돌계단의 양옆 턱돌(-1 = 계단 안쪽). 곧은 막대 대신 단마다 1px 어긋난 자연 턱돌과 서쪽 그늘·동쪽 양지를 그린다. */
function carvedCheek(a: number, wd: number, gy: number, stepIdx: number, dy: number, sh: number, topDist: number, botDist: number, hasGrassLip: boolean): number {
  const left = a < (wd >> 1), e = left ? a : wd - 1 - a;
  const taper = botDist < 3 ? 1 : 0;
  const cw = Math.max(1, 2 + (nmix(stepIdx, left ? 11 : 23, 401) % 3 === 0 ? 1 : 0) - taper);
  if (e >= cw) return -1;
  // 맨 위 고원 가장자리와 만나는 1~4px: 풀 처마(또는 갓돌)가 턱돌 위로 자연스럽게 덮여 내려온다
  const hang = 2 + nmix(a, left ? 3 : 7, 403) % 3 - (e >= 2 ? 1 : 0);
  if (topDist < hang) {
    if (hasGrassLip) return topDist === hang - 1 ? 1 : topDist === 0 ? 4 : 2 + (nmix(a, topDist, 405) & 1);
    return 6 + (topDist === 0 ? 5 : topDist === hang - 1 ? 2 : 4);
  }
  if (botDist === 0 && e === 0) return -1;
  const joint = (gy + (left ? 2 : 5)) % 7 === 0 || dy === sh - 1;
  if (e === 0) return 6 + (joint ? 0 : left ? 1 : 2);
  if (e === cw - 1) {
    // 안쪽 절개면: 서쪽(왼쪽) 턱돌 안쪽은 동향이라 깊은 절개 그늘, 동쪽(오른쪽) 턱돌 안쪽은 서향이라 북서 햇빛을 받는다
    if (left) return 6 + (joint ? 0 : 1);
    return 6 + (joint ? 2 : dy <= 2 ? 5 : 4);
  }
  return 6 + (joint ? 1 : left ? (dy <= 1 ? 3 : 2) : (dy <= 1 ? 4 : 3));
}

/** 화면 구간 [gLo, gHi] 안의 한 화소를 8px 안팎 간격의 깎은 돌계단 또는 통나무 흙길 계단으로 칠한다. */
function paintCarvedStairPixel(
  S: ReliefWallStyle, s: ReliefSlope, ax: number, gy: number, gLo: number, gHi: number, rampCount: number, fallback: number,
): number {
  const [a, wd] = stairAcross(s, ax, gy);
  if (a < 0 || a >= wd) return fallback;
  const span = Math.max(8, gHi - gLo + 1), relY = Math.max(0, Math.min(span - 1, gy - gLo)), botDist = span - 1 - relY;
  const lip0 = S.lip.rows[0]?.[0] ?? 6, hasGrassLip = lip0 >= 0 && lip0 < 6;

  if (isLogStair(S, s)) {
    const ac = rampCount > 2 ? 2 : 1;
    const visSteps = Math.max(4, Math.round(span / 9));
    const stepIdx = Math.min(visSteps - 1, Math.floor((relY * visSteps) / span));
    const y0 = Math.floor((stepIdx * span) / visSteps), y1 = Math.max(y0 + 5, Math.floor(((stepIdx + 1) * span) / visSteps));
    const sh = y1 - y0, dy = relY - y0;
    const logH = sh >= 9 ? 4 : 3, treadH = sh - logH;
    const left = a < (wd >> 1), e = left ? a : wd - 1 - a;
    // 양옆 가장자리: 곧은 나무 기둥 대신 들쭉날쭉한 풀 포기와 자연 흙둑이 오솔길을 감싼다
    const grassW = (dy < treadH ? 2 : 1) + nmix(gy >> 1, left ? 1 : 2, 501) % 3 + (botDist < 3 ? 1 : 0);
    if (e < grassW) {
      const n = nmix(ax, gy, 503);
      if (relY > 3 && botDist > 4 && e === grassW - 1 && (n % 3 === 0)) return safeIdx(1, left ? 1 : 3, rampCount);
      const gt = e === 0 && relY < span - 8 && (n % 4 === 0) ? 1 : 2 + (n % 3);
      return safeIdx(0, gt, rampCount);
    }
    if (dy < treadH) {
      // 다져진 흙·풀 디딤판: 바로 위 통나무 밑 그늘 → 가운데 닳은 흙길·잔돌 + 양옆으로 넓게 스며드는 풀 클러스터
      const u = Math.min(a, wd - 1 - a);
      const q = vn2(ax * 0.28, gy * 0.32, 509), n = nmix(ax, gy, 511);
      const turfReach = grassW + 4 + Math.floor(5 * vn1(gy * 0.25 + (left ? 0 : 17), 515));
      if (dy === 0) {
        if (u < turfReach - 1 && ((n & 1) || u < grassW + 2)) return safeIdx(0, 1, rampCount);
        return safeIdx(1, n % 5 === 0 ? 2 : 1, rampCount);
      }
      if (u < turfReach && (q > 0.36 + (u - grassW) * 0.055 || (u < grassW + 3 && (n % 3 !== 0)))) {
        return safeIdx(0, q > 0.68 ? 4 : q < 0.28 ? 2 : 3, rampCount);
      }
      if (botDist === 0 && (n % 3 !== 0)) return safeIdx(0, 2 + (n & 1), rampCount);
      let et = q > 0.64 ? 5 : q < 0.32 ? 3 : 4;
      if (dy === 1) et = Math.max(2, et - 1);
      if (left && a < grassW + 4) et = Math.max(2, et - 1);
      if ((n & 31) === 0 && dy > 1) return safeIdx(1, 5, rampCount);
      if ((n & 31) === 1 && dy > 1) return safeIdx(1, 2, rampCount);
      return safeIdx(1, et, rampCount);
    }
    // 둥근 통나무 챌면 + 양끝 둥근 나무 말뚝(네모 기둥 없음)
    const ld = dy - treadH, stakeW = grassW + 3;
    if (e < stakeW) {
      const se = e - grassW;
      if (se === 0) return safeIdx(ac, ld === 0 ? 2 : 1, rampCount);
      if (ld === 0) return safeIdx(ac, se === 1 ? 5 : 4, rampCount);
      if (ld === logH - 1) return safeIdx(ac, 1, rampCount);
      return safeIdx(ac, se === 1 ? 4 : 2, rampCount);
    }
    // 넓은 통나무 계단은 가운데에도 말뚝 하나를 엇갈려 박아 자연스러운 산길 느낌을 살린다
    const midStake = wd >= 56 ? (wd >> 1) + (stepIdx & 1 ? 5 : -6) : -99;
    if (Math.abs(a - midStake) <= 1) {
      const me = a - midStake;
      if (ld === 0) return safeIdx(ac, me <= 0 ? 5 : 3, rampCount);
      if (ld === logH - 1) return safeIdx(ac, 0, rampCount);
      return safeIdx(ac, me === -1 ? 4 : me === 0 ? 3 : 1, rampCount);
    }
    const bark = nmix(ax >> 2, stepIdx * 7 + ld, 521);
    let lt: number;
    if (ld === 0) lt = bark % 7 === 0 ? 4 : 5;
    else if (ld === logH - 1) lt = bark % 5 === 0 ? 0 : 1;
    else if (ld === 1) lt = bark % 4 === 0 ? 3 : 4;
    else lt = bark % 3 === 0 ? 2 : 3;
    if (a < grassW + 5 && lt > 1) lt -= 1;
    return safeIdx(ac, lt, rampCount);
  }

  // 깎은 돌계단: ~8px 간격 어긋난 마름돌(윗면 안쪽 주름 → 결이 살아 있는 디딤판 → 밝은 코 → 코 밑 짙은 그늘 → 어긋난 줄눈 챌면)
  const tw = S.carvedStairs!.tread === "wall" ? 1 : 0;
  const visSteps = Math.max(s.steps! * 2, Math.max(2, Math.round(span / 8)));
  const stepIdx = Math.min(visSteps - 1, Math.floor((relY * visSteps) / span));
  const y0 = Math.floor((stepIdx * span) / visSteps), y1 = Math.max(y0 + 4, Math.floor(((stepIdx + 1) * span) / visSteps));
  const sh = y1 - y0, dy = relY - y0;

  const cheek = carvedCheek(a, wd, gy, stepIdx, dy, sh, relY, botDist, hasGrassLip);
  if (cheek >= 0) return safeIdx((cheek / 6) | 0, cheek % 6, rampCount);

  const hasMoss = rampCount > 2 && hasGrassLip && !!S.overlay;
  const isLower = stepIdx >= visSteps - 2;
  const slabW = 7 + (nmix(stepIdx, 1, 419) % 3); // 7..9px 마름돌 폭
  const stag = (stepIdx * 4 + (nmix(stepIdx, 2, 421) % 3)) % slabW;
  const sa = a + stag, blockIdx = fdiv(sa, slabW), bu = sa - blockIdx * slabW;
  const isJoint = bu === 0 && a > 3 && a < wd - 4;
  const slabVar = nmix(blockIdx, stepIdx, 423) % 5 === 0 ? -1 : 0;
  const nosingY = Math.max(2, Math.min(sh - 3, Math.floor(sh * 0.45)));

  let rRamp = tw, rTone = 3;
  if (stepIdx === 0 && dy === 0) {
    // 고원 마루에서 첫 계단으로 꺾이는 윗턱
    rRamp = tw;
    rTone = isJoint ? 3 : (nmix(ax, 0, 425) % 6 === 0 ? 4 : 5);
  } else if (dy === 0) {
    // 윗단 챌면 밑과 맞닿는 디딤판 안쪽 오목 주름(습한 바이옴은 구석에 이끼 한두 점)
    if (hasMoss && (a <= 4 || a >= wd - 5) && nmix(ax, stepIdx, 426) % 3 === 0) {
      return safeIdx(2, a <= 4 ? 2 : 3, rampCount);
    }
    rRamp = tw;
    rTone = isJoint ? 1 : 2 + (bu === 1 ? 1 : 0);
  } else if (dy < nosingY) {
    // 마름돌 디딤판: 아래쪽 계단도 챌면과 선명히 구분되도록 3~4톤 몸통과 베벨을 유지한다
    rRamp = tw;
    rTone = 3 + slabVar;
    if (dy === 1 && bu > 0 && bu < slabW - 1) rTone += 1;
    if (bu === slabW - 1 && slabVar === 0) rTone -= 1;
    if (isJoint) rTone = 1;
    else {
      const q = nmix(ax, gy, 427) % 19;
      if (q === 0 && rTone > 2) rTone -= 1;
      else if (q === 1 && dy === 1) rTone += 1;
    }
    rTone = Math.max(2, Math.min(5, rTone));
  } else if (dy === nosingY) {
    // 디딤판 앞 코(햇빛 받는 1px 모서리, 줄눈·잔 이빠짐에서 자연스럽게 끊김)
    rRamp = tw;
    const chip = nmix(ax, stepIdx, 431) % 13 === 0;
    rTone = isJoint ? 3 : (chip || (isLower && nmix(ax, stepIdx, 433) % 3 === 0)) ? 4 : 5;
  } else if (dy === nosingY + 1) {
    // 코 바로 아래 1px 짙은 처마 그림자
    rRamp = 1;
    rTone = a > wd - 6 && nmix(ax, stepIdx, 437) % 3 !== 0 ? 1 : (nmix(ax, stepIdx, 439) % 4 === 0 ? 0 : 1);
  } else if (botDist === 0) {
    // 맨 아래 계단 발치: 칼자국 같은 검은 줄 대신 끊어진 접지 그림자와 잔돌·풀로 땅에 스며든다
    const fn = nmix(ax, gy, 443) % 7;
    if (fn === 0) { rRamp = 1; rTone = 4; }
    else if (fn <= 2) { rRamp = 0; rTone = 2; }
    else { rRamp = 1; rTone = 1; }
  } else {
    // 챌면(수직 돌면): 디딤판 줄눈과 반 칸 어긋난 세로 줄눈 + 절벽 결을 살린 어두운 마름돌
    rRamp = 1;
    const rStag = (stag + (slabW >> 1)) % slabW, rJoint = (a + rStag) % slabW === 0 && a > 3 && a < wd - 4;
    if (hasMoss && (a <= 4 || rJoint) && nmix(ax, gy, 445) % 6 === 0) return safeIdx(2, 1 + (nmix(ax, gy, 447) & 1), rampCount);
    if (rJoint) rTone = 0;
    else {
      const b0 = S.body[0]!, bv = b0.rows[gy % b0.h]![ax % b0.w]! % 6;
      rTone = Math.max(1, Math.min(2, bv - 1));
      if (dy === sh - 1) rTone = 1;
    }
  }
  // 서쪽(왼쪽) 턱돌 바로 옆 3px 은 절개면 그림자를 받는다(북서 광원)
  if (a < 6 && !(rRamp === 1 && rTone <= 1)) rTone = Math.max(1, rTone - (a < 4 ? 1 : (dy !== nosingY ? 1 : 0)));
  // 동쪽(오른쪽) 끝 마름돌 모서리는 햇빛을 살짝 더 받는다
  if (a >= wd - 5 && dy <= nosingY && !isJoint && rTone < 5) rTone += 1;
  return safeIdx(rRamp, rTone, rampCount);
}

function carvedTread(S: ReliefWallStyle, s: ReliefSlope, px: number, py: number, t: number, base: number, rampCount: number): number {
  const [a, wd] = stairAcross(s, px, py);
  const totalLen = (s.dir === "n" || s.dir === "s" ? s.h : s.w) * T;
  const visSteps = Math.max(s.steps! * 2, Math.max(2, Math.round(totalLen / 8)));
  const k = Math.max(0, Math.min(visSteps - 1e-6, t * visSteps)), stepIdx = Math.floor(k), frac = k - stepIdx;
  const sh = Math.max(4, Math.round(totalLen / visSteps)), dy = Math.min(sh - 1, Math.floor((1 - frac) * sh));
  const relPos = Math.floor((1 - t) * (totalLen - 1)), botDist = totalLen - 1 - relPos;
  if (isLogStair(S, s)) {
    const ac = rampCount > 2 ? 2 : 1;
    if (a < 2 || a >= wd - 2) return safeIdx(0, 2 + (nmix(px, py, 531) % 3), rampCount);
    if (dy >= sh - 2) return safeIdx(ac, dy === sh - 2 ? 4 : 1, rampCount);
    return dy === 0 ? safeIdx(1, 2, rampCount) : base;
  }
  const lip0 = S.lip.rows[0]?.[0] ?? 6;
  const cheek = carvedCheek(a, wd, py, stepIdx, dy, sh, relPos, botDist, lip0 >= 0 && lip0 < 6);
  if (cheek >= 0) return safeIdx((cheek / 6) | 0, cheek % 6, rampCount);
  const tw = S.carvedStairs!.tread === "wall" ? 1 : 0;
  const slabW = 7 + (nmix(stepIdx, 1, 451) % 3), bu = (a + stepIdx * 4) % slabW, isJoint = bu === 0;
  let tone = dy === sh - 2 ? (isJoint ? 3 : 5) : dy === sh - 1 ? 1 : isJoint ? 1 : dy <= 1 ? 2 : 3 + (bu < slabW - 1 && dy === 2 ? 1 : 0);
  if (a < 5 && tone > 1) tone -= 1;
  return safeIdx(dy === sh - 1 ? 1 : tw, tone, rampCount);
}
function carvedRiser(S: ReliefWallStyle, s: ReliefSlope, px: number, py: number, d: number, n: number, rampCount: number): number {
  const [a, wd] = stairAcross(s, px, py);
  if (isLogStair(S, s)) {
    const ac = rampCount > 2 ? 2 : 1;
    const e = Math.min(a, wd - 1 - a);
    if (e < 2) return safeIdx(0, 2 + (nmix(px, py + d, 541) & 1), rampCount);
    if (e < 4 && n >= 3) return safeIdx(ac, d === 0 ? 5 : d === n - 1 ? 1 : e === 2 ? 4 : 2, rampCount);
    if (d === 0) return safeIdx(ac, 5, rampCount);
    if (d === n - 1) return safeIdx(ac, 1, rampCount);
    return safeIdx(ac, nmix(a >> 2, d, 543) % 3 === 0 ? 2 : 3, rampCount);
  }
  // 동서 돌계단의 남쪽 옆벽: 단 높이에 맞춘 마름돌 옆면
  if (d === n - 1) return OUT_B;
  const course = fdiv(d, 5), gy = py + d;
  const joint = d % 5 === 4 || ((px + course * 5) % 8 === 0 && d > 0);
  if (joint) return safeIdx(1, 1, rampCount);
  const b = S.body[0]!, v = b.rows[gy % b.h]![px % b.w]! % 6;
  let tone = d === 0 ? 4 : Math.max(1, Math.min(4, v));
  if (a < 5 && d > 0) tone = Math.max(1, tone - 1);
  return safeIdx(1, tone, rampCount);
}

/**
 * 벽 무늬(벽 덩이·흙벽 조각·둑 몸통·판 계단 줄눈)를 읽는 세로 좌표의 원점 = 화면 y - pad + BIAS (2026-10-03).
 * 전에는 화면 y 를 그대로 써서 맵 어딘가의 최고 단이 바뀌어 pad 가 바뀌면 맵 전체 절벽 무늬가 다시 뽑혔다 — 붓질 한 번에
 * 온 맵 벽이 깜빡였고, 편집기가 바뀐 곳만 다시 굽지 못했다(relief/window.ts). 땅 기준으로 고정하면 pad 와 무관하다.
 * BIAS 는 최고 단 높이라 들린 윗면 위로도 음수가 되지 않는다.
 */
const PATTERN_BIAS = RELIEF_MAX_LEVEL * U;

/**
 * renderRelief 가 쓸 pad(px) — 그리지 않고 계산한다. pruned 는 깎은 격자, slopes 는 같은 좌표의 경사로.
 * 경사로가 덮지 않은 칸의 화소 높이는 그 칸·이웃 칸 단 중 하나라 최고값은 칸 최고 단과 같다(경사로 둘레 칸은 네모 절벽이라 이웃
 * 경사로 단을 받지 않는다). 경사로 칸은 slopeHeights 와 같은 식으로 칸 끝 화소에서 잰다(높이는 오르막 쪽으로 단조).
 */
export function reliefPadPx(pruned: HeightGrid, slopes: readonly ReliefSlope[] = [], faceRows = 1): number {
  if (faceRows > 1) return reliefPadPx(scaleGrid(pruned, faceRows), slopes.map((s) => scaleSlope(s, faceRows)));
  const H = pruned.length, W = pruned[0]?.length ?? 0;
  // 그 칸을 마지막으로 덮는 경사로 번호 + 1 — slopeHeights 가 뒤 경사로로 덮어쓰는 순서와 같다
  const owner = slopes.length ? new Int32Array(W * H) : null;
  slopes.forEach((s, k) => {
    for (let y = Math.max(0, s.y); y < Math.min(H, s.y + s.h); y++) for (let x = Math.max(0, s.x); x < Math.min(W, s.x + s.w); x++) owner![y * W + x] = k + 1;
  });
  let mx = 0;
  for (let y = 0; y < H; y++) {
    const row = pruned[y]!;
    for (let x = 0; x < W; x++) {
      const k = owner ? owner[y * W + x]! : 0;
      if (!k) { if (row[x]! > mx) mx = row[x]!; continue; }
      const s = slopes[k - 1]!, len = (s.dir === "n" || s.dir === "s" ? s.h : s.w) * T;
      // 이 칸 화소의 오르막 위치 a 범위(slopeHeights 의 a 식)
      const lo = s.dir === "n" ? (s.y + s.h - y - 1) * T + 1 : s.dir === "s" ? (y - s.y) * T + 1 : s.dir === "w" ? (s.x + s.w - x - 1) * T + 1 : (x - s.x) * T + 1;
      for (const a of [lo, lo + T - 1]) {
        let t = (a - 0.5) / len;
        if (s.steps) t = Math.floor(t * s.steps) / s.steps;
        const v = Math.fround(s.lo + t * (s.hi - s.lo));
        if (v > mx) mx = v;
      }
    }
  }
  return Math.ceil(mx) * U;
}

/** 단 × k (깎아지른 양식의 그리는 높이). */
const scaleGrid = (g: HeightGrid, k: number): HeightGrid => g.map((row) => row.map((v) => v * k));
const scaleSlope = (s: ReliefSlope, k: number): ReliefSlope => ({ ...s, lo: s.lo * k, hi: s.hi * k });

export function renderRelief(h: HeightGrid, opt: ReliefRenderOptions = {}): ReliefRender {
  const S = compileReliefStyle(opt.style);
  // 깎아지른 양식(styles.ts sheer): 단 하나를 앞면 faceRows 칸으로 — 높이를 그만큼 들어 그린다. 걷기·저장은 단 그대로(walk.ts · screen.ts 들림도 같은 배).
  const K = S?.sheer ? S.faceRows : 1;
  if (K > 1) {
    h = scaleGrid(h, K);
    opt = { ...opt, ...(opt.slopes ? { slopes: opt.slopes.map((s) => scaleSlope(s, K)) } : {}), ...(opt.climbs ? { climbs: opt.climbs.map((s) => scaleSlope(s, K)) } : {}),
      ...(opt.bridges ? { bridges: Array.from(opt.bridges, (v) => (v > 0 ? (v - 1) * K + 1 : 0)) } : {}),
      ...(opt.window ? { window: { ...opt.window, pruned: scaleGrid(opt.window.pruned, K) } } : {}) };
  }
  // 부분 굽기: ox·oy = 창 원점의 화면 px. 무늬를 읽는 곳은 (화소 + 원점) 절대 좌표를 쓴다. 칸 주기(16)·짝홀만 보는 곳은 그대로 둔다.
  const win = opt.window, ox = win ? win.cx * T : 0, oy = win ? win.cy * T : 0, cy0 = win ? win.cy : 0;
  // gslopes 는 맵 전체 좌표(절대 좌표 패스용), slopes 는 h 기준 좌표(높이·네모 절벽용). 번호는 같다.
  // 디딤판으로 끊는 계단은 벽면에 판 계단 양식(carvedStairs)만 그린다 — 그 밖의 계단은 비탈로 잇고 경사로 도트(칩셋 돌계단 조각)를 입힌다.
  // 전에는 그런 계단을 렌더러가 회색 벽돌 디딤판으로 칠했다(2026-11-14 오너 「계단을 이딴 식으로 하면 절대 안 된다니까 ?」) — 그 길은 없다.
  const gslopes = S?.carvedStairs ? opt.slopes ?? [] : (opt.slopes ?? []).map((s) => (s.steps ? { ...s, steps: undefined } : s));
  const slopes = win ? gslopes.map((s) => ({ ...s, x: s.x - win.cx, y: s.y - win.cy })) : gslopes;
  const baseRamps = opt.ramps ?? S?.ramps ?? RAMPS, ramps = baseRamps;
  const art = !!opt.rampArt;
  // 경사로와 그 둘레 한 칸은 네모 절벽 — 대각선으로 깎이면 경사로 입구가 비스듬히 잘려 비탈이 땅에 붙지 않는다
  const nearRamp = slopes.length
    ? (x: number, y: number) => slopes.some((s) => x >= s.x - 1 && x <= s.x + s.w && y >= s.y - 1 && y <= s.y + s.h)
    : undefined;
  const BW = h[0]?.length ?? 0;
  const bridgesIn = win && opt.bridges ? cropCells(opt.bridges, win.PW / T, win.cx, win.cy, BW, h.length) : opt.bridges;
  const bridge = bridgesIn && Array.prototype.some.call(bridgesIn, (v: number) => v > 0) ? bridgesIn : undefined;
  const isBridge = (x: number, y: number) => !!bridge && x >= 0 && y >= 0 && x < BW && y < h.length && bridge[y * BW + x]! > 0;
  const nearBridge = bridge ? (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isBridge(x + dx, y + dy)) return true; return false; } : undefined;
  const square = nearRamp || nearBridge ? (x: number, y: number) => !!(nearRamp?.(x, y) || nearBridge?.(x, y)) : undefined;
  const { hp, PW, PH } = buildPixelHeights(h, opt.diag !== false, square, win?.pruned, !!S?.sheer && opt.diag !== false);
  const { hf, sid, st } = slopeHeights(hp, PW, PH, slopes);
  let mx = 0; for (let i = 0; i < hp.length; i++) if (hf[i] > mx) mx = hf[i];
  mx = Math.ceil(mx);
  const pad = win ? win.pad : mx * U, SH = PH + pad, N = SH * PW;
  // 무늬 세로 좌표 = 화면 y + yb (땅 기준, PATTERN_BIAS 참고)
  const yb = oy - pad + PATTERN_BIAS;
  // 벽 화소가 읽는 표 줄: (무늬 y ± 2) + 2 → yb .. yb + SH + 4
  ensureChunks(ox, yb - 2, PW + 1, SH + 5);
  const CKa = CK!;
  const ck = (x: number, y: number) => CKa[chunkIndex(x, y)];
  // 반환 배열(kind·lev·src·edge·fl·mpy·ssl·sst·rgba·xray·overSlope)은 창 굽기일 때만 모아 쓴다
  const ret = !!win;
  const kind = take("kind", i8, N, -1, ret), lev = take("lev", i8, N, 0, ret), dep = take("dep", i16, N, 0, true), run = take("run", i16, N, 0, true);
  const out = take("out", i8, N, -1, true), src = take("src", i32, N, -1, ret);
  const W = PW / T, NC = W * (PH / T);
  const hid = take("hid", i8, N, -1, true), hidSrc = take("hidSrc", i32, N, -1, true);
  const topN = new Int32Array(NC), hidN = new Int32Array(NC);
  const edge = take("edge", u8, N, 0, ret);
  const fl = take("fl", f32, N, 0, ret), mpy = take("mpy", i32, N, -1, ret), ssl = take("ssl", i16, N, 0, ret), sst = take("sst", f32, N, 0, ret);
  const cut = take("cut", i16, slopes.some(s => !!s.steps) ? N : 0, 0, true);   // stair riser: its slope number + 1, including the plateau landing
  const underDeck = take("underDeck", u8, bridge ? N : 0, 0, true), deckUnder = take("deckUnder", u8, bridge ? N : 0, 0, true);   // gorge floor under a deck · the deck's underside
  // 경사로 화소끼리는 조금 달라도 같은 면으로 본다 (경사로 없으면 정수 비교와 같다)
  const tol = (i: number, j: number) => (ssl[i] || ssl[j] ? 0.3 : 0);
  const dz = (v: number) => (v > 0.3 ? v : v >= 1e-6 && !slopes.length ? v : 0);
  const hide = (i: number, c: number) => { if (kind[i] === 0 && fl[i] < c - 0.5 && hid[i] < 0) { hid[i] = out[i]; hidSrc[i] = src[i]; hidN[src[i]]++; } };
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const m = py * PW + px, c = hf[m], lc = Math.round(c), Hc = Math.round(c * U);
    const sy = py + pad - Hc, i = sy * PW + px, cell = (py >> 4) * W + (px >> 4);
    hide(i, c); topN[cell]++;
    out[i] = art && sid[m] ? 3 : lc ? shift(TOP[(py % T) * T + px % T], LV[lc]) : GROUND[(py % T) * T + px % T];
    // S.cornice (tundra-snow): stair treads are cut stone (wall ramp), not snow — snow treads vanished into the snow round them
    if (S?.cornice && sid[m] && slopes[sid[m] - 1].steps) out[i] = 6 + (Math.floor(st[m] * slopes[sid[m] - 1].steps! * 2) % 2 ? 4 : 5) - (px % T === 0 || px % T === 15 ? 2 : 0);
    if (S?.carvedStairs && sid[m] && slopes[sid[m] - 1].steps) out[i] = carvedTread(S, gslopes[sid[m] - 1], px + ox, py + oy, st[m], out[i], baseRamps.length);
    kind[i] = 0; lev[i] = lc; src[i] = cell; fl[i] = c; mpy[i] = py; ssl[i] = sid[m]; sst[i] = st[m];
    if (cut.length) cut[i] = 0; // 뒤 계단의 챌면을 앞 윗면이 가리면 계단 소유권도 걷는다.
    const onBridge = !!bridge && bridge[cell]! > 0 && c > 0;
    if (onBridge) {
      // the gorge floor under the deck, where this map pixel would lie at height 0: shaded ground (the deck's cell has no
      // floor tile of its own — its lower tile is the plank, lifted onto the deck)
      const fz = bridge[cell]! - 1, f = (py + pad - fz * U) * PW + px, g = fz ? shift(TOP[(py % T) * T + px % T], LV[fz]) : GROUND[(py % T) * T + px % T];
      if (kind[f] < 0) { kind[f] = 0; out[f] = fz ? (((px + ox) * 3 + py + oy) % 4 ? shift(g, 1) : g) : (((px + ox) * 3 + py + oy) % 5 ? 4 : 3);   // (r3 QA: a darker dither read as a marsh slab) the lit ground (top ramp 4 — the lawn tone), a sparse speckle
        lev[f] = fz; src[f] = cell; fl[f] = fz; mpy[f] = py; underDeck[f] = 1; }
    }
    // 깎아지른 양식: 맵 남쪽 끝 밖은 같은 높이로 이어진다고 본다 — 아니면 맨 아래 줄마다 3칸 면이 띠로 선다(다른 양식은 그대로)
    const hs = py + 1 < PH ? hf[m + PW] : S?.sheer && (!win || win.cy * T + PH >= win.SH - win.pad) ? c : 0;
    if (hs >= c) continue;
    if (onBridge) {
      // a deck is planks, not ground: two rows of dark underside instead of a cliff face under its south edge
      for (let d = 0; d < Math.min(2, Hc - Math.round(hs * U)); d++) { const w = (sy + 1 + d) * PW + px; if (kind[w] >= 0 && fl[w] >= c) continue; kind[w] = 1; lev[w] = lc; dep[w] = d; run[w] = 2; src[w] = cell; fl[w] = c; mpy[w] = py; deckUnder[w] = 1; }
      continue;
    }
    const n = Hc - Math.round(hs * U);
    const s2 = sid[m] || (py + 1 < PH ? sid[m + PW] : 0);
    // 동서 경사로의 남쪽 가장자리: 경사로는 길이 방향(x)으로 오르므로 남쪽 끝에서 쏟은 경사면이 아니라 옆벽이다.
    // 높이만큼 벽을 내려 그린다(낮은 끝은 얇고 높은 끝은 두꺼운 사다리꼴) — 늘여 채우면 옆이 삼각형으로 찢어진다.
    const ew = s2 && (slopes[s2 - 1].dir === "e" || slopes[s2 - 1].dir === "w");
    if (s2 && !slopes[s2 - 1].steps && n <= 3 && !ew) {
      // 매끈한 경사로: 벌어진 틈을 같은 윗면 화소로 늘여 채운다
      for (let d = 0; d < n; d++) {
        const w = (sy + 1 + d) * PW + px;
        kind[w] = 0; out[w] = out[i]; lev[w] = lc; src[w] = cell; fl[w] = c; mpy[w] = py; ssl[w] = ssl[i] || s2; sst[w] = ssl[i] ? sst[i] : st[m + PW];
      }
      continue;
    }
    // 층계참 아래 챌면도 계단에 속한다.
    const own = cut.length ? (sid[m] && slopes[sid[m] - 1].steps ? sid[m] : py + 1 < PH && sid[m + PW] && slopes[sid[m + PW] - 1].steps ? sid[m + PW] : 0) : 0;
    for (let d = 0; d < n; d++) {
      const w = (sy + 1 + d) * PW + px;
      hide(w, c);
      kind[w] = 1; lev[w] = lc; dep[w] = d; run[w] = n; src[w] = cell; fl[w] = c; mpy[w] = py; ssl[w] = sid[m]; sst[w] = st[m];
      if (cut.length) cut[w] = own;
    }
  }
  // 맵 북쪽 끝 위 여백(2026-10-11): 화면 맨 위 pad 줄은 들린 칸만 채워서, 북쪽 끝에 대지가 있는 맵은 그 옆 낮은 칸 위에 빈 띠가
  // 남았다(게임 카메라는 대지를 보이려 그만큼 위로 넓혀 그 띠가 검게 보였다). 맵 밖 북쪽도 땅이 이어진다고 보고, 빈 화소를 그 열의
  // 0번 줄 바닥으로 위로 이어 채운다 — 같은 높이, 0번 줄 타일 윗 절반을 거울로 되풀이(mpy = 0..7). 이 화소는 0번 줄 py=0 과
  // 화면 줄 sy 위쪽 맵 줄([0, sy])만 보므로 부분 굽기 창 규칙(window.ts)이 그대로 맞는다. 맨 위 줄을 담은 창(oy = 0)에서만 한다.
  const padFill = take("padFill", u8, oy === 0 ? N : 0, 0, true);
  if (oy === 0) for (let px = 0; px < PW; px++) {
    const c = hf[px]!, lc = Math.round(c), top0 = pad - Math.round(c * U);
    for (let sy = Math.min(top0, SH) - 1; sy >= 0; sy--) {
      const i = sy * PW + px;
      if (kind[i] >= 0) continue;
      // 0번 줄 칸의 윗 절반(py 0..7)을 거울처럼 위로 되풀이한다(0..7, 7..0, …). 맞닿는 줄이 0번 줄 첫 줄과 같아 이음매가 없고,
      // 칸 아래쪽에 깔린 그림자·물건 발치(같은 칸 위층 나무의 그늘 조각 등)는 여백에 고아로 되풀이되지 않는다.
      const k = top0 - 1 - sy, my = k % T < T / 2 ? k % (T / 2) : T / 2 - 1 - k % (T / 2);
      out[i] = lc ? shift(TOP[my * T + px % T], LV[lc]) : GROUND[my * T + px % T];
      kind[i] = 0; lev[i] = lc; src[i] = px >> 4; fl[i] = c; mpy[i] = my; padFill[i] = 1;
    }
  }
  // 깎아지른 양식의 맵 남쪽 끝 아래(2026-11-16): 땅이 맵 밖 남쪽으로 이어진다고 보고(위 hs), 마지막 줄이 들린 만큼 비는 화면 아래 띠를
  // 마지막 줄 바닥으로 채운다 — 0번 줄 위 여백과 같은 거울 되풀이(mpy = 마지막 칸 아래 절반). 빈 곳(0 단)은 그대로 비운다.
  if (S?.sheer && (!win || oy + PH >= win.SH - win.pad)) for (let px = 0; px < PW; px++) {
    const m = (PH - 1) * PW + px, c = hf[m]!, lc = Math.round(c); if (!lc) continue;
    const sy0 = PH - 1 + pad - Math.round(c * U);
    for (let sy = sy0 + 1; sy < SH; sy++) {
      const i = sy * PW + px; if (kind[i] >= 0) continue;
      const k = sy - sy0 - 1, my = PH - T / 2 + (k % T < T / 2 ? T / 2 - 1 - k % (T / 2) : k % (T / 2));
      out[i] = shift(TOP[(my % T) * T + px % T], LV[lc]); kind[i] = 0; lev[i] = lc; src[i] = (PH / T - 1) * W + (px >> 4); fl[i] = c; mpy[i] = my;
    }
  }
  // 벽 조각
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 1) continue;
    const c = lev[i], d = dep[i], n = run[i], row = sy * PW, ax = sx + ox, ay = sy + yb;
    const same = (x: number) => x >= 0 && x < PW && kind[row + x] === 1 && lev[row + x] === c;
    const wall = (x: number) => x >= 0 && x < PW && kind[row + x] === 1;
    const diagN = (x: number) => x >= 0 && x < PW && kind[row + x] === 0 && lev[row + x] === c;
    const cL = d < DRIP && diagN(sx - 1), cR = d < DRIP && diagN(sx + 1);
    const L = !same(sx - 1) && !cL, R = !same(sx + 1) && !cR, EL = !wall(sx - 1) && !cL, ER = !wall(sx + 1) && !cR;
    // 자연 면 양식의 절벽 화소(경사로 옆벽·챌면은 가족 무늬 그대로): 처마 깊이는 열마다 다르고(갓돌 양식은 0), 16px 처마 무늬를 쓰지 않는다
    const nat = S?.natural && !ssl[i] ? S.natural : null;
    const j = jit(ax, c), de = nat ? (nat === "rock" ? 0 : naturalLipDepth(ax)) : DRIP + j; let p: number;
    if (nat && nat !== "boulders") {
      // 자연 면(style.natural): 처마(풀 드리움 또는 갓돌) → 좌표로 만든 몸통. 처마 바로 밑 두 줄은 처마 그늘, 발치 세 줄은 짙게.
      const cap = nat === "rock" ? naturalCap(ax, d) : -1;
      if (cap >= 0) p = 6 + cap;
      else if (d < de) p = naturalLip(ax, d, de);
      else {
        p = 6 + (nat === "ribs" ? naturalRibs(ax, ay) : nat === "strata" ? naturalStrata(ax, ay) : nat === "ledges" ? naturalLedges(ax, ay) : naturalRock(ax, ay));
        const under = nat === "rock" ? (d >= 1 && naturalCap(ax, d - 1) >= 0) || (d >= 2 && naturalCap(ax, d - 2) >= 0) : d - de < 2;
        if (under) p = shift(p, -1);
        if (d >= n - 3 && d > de + 2) p = shift(p, -1);
        if (d === n - 1) p = OUT_B;
      }
    } else if (S && !nat) {
      p = styledWall(S, ax, d, n, c, ((src[i] / W) | 0) + cy0, ssl[i] !== 0);
      // 경사로 옆벽(동서 경사로의 사다리꼴, 2026-09-29 r2): 몸통 무늬를 한 단 밝게, 위 1줄은 턱, 바깥 외곽선은 4px 넘는 곳만 —
      // 어두운 몸통 + 외곽선만 남은 얇은 끝이 경사로 발치의 검은 세모로 읽혔다
      if (ssl[i]) p = d === n - 1 && n >= 4 ? OUT_B : shift(p, d === 0 ? 3 : 2);
    } else if (d < de) {
      p = nat ? naturalLip(ax, d, de) : LIP[L ? "L" : R ? "R" : "M"][Math.max(0, d - j) * T + (L ? 0 : R ? 15 : sx % T)];
    } else {
      const dd = d - de, ci = chunkIndex(ax, ay), cid = CKa[ci];
      const hr = hsh3(CKX[ci], CKY[ci], 31);
      const tl = TILES[hr % TILES.length];
      const t = tl[((ay + (hr >>> 5)) % 14) * 14 + (ax + (hr >>> 9)) % 14];
      const base = ((hr >>> 13) % 3) ? 3 : 2;
      p = 6 + base + Math.max(-1, Math.min(1, (t % 6) - 3)) * (((hr >>> 15) % 2) || ((ax + ay) % 2));
      if (ck(ax, ay + 1) !== cid) p = 7;
      else if (ck(ax + 1, ay) !== cid) p = shift(p, -1);
      else if (ck(ax, ay - 1) !== cid) p = 6 + Math.min(5, base + 2);
      else if (ck(ax, ay - 2) !== cid) p = shift(p, 1);
      else if (ck(ax, ay + 2) !== cid) p = shift(p, -1);
      if (n > U) {
        // 단 경계 = 층리. 경계 바로 아래는 밝은 선반, 위는 그늘. 몇 곳은 풀 턱이 걸린다
        const r = (d + (hr >>> 19) % 3 - 1) % U, k = Math.floor((d + 1) / U);
        const shelf = k > 0 && k * U < n - 4 && hsh3(fdiv(ax, 11 + k), k, c * 7) % 3 === 0;
        if (shelf && r >= 0 && r < 3) p = LIP.M[Math.min(5, r + 3) * T + sx % T];
        else if (r === 0 && ((hr >>> 21) % 4) && d > de + 1 && d < n - 2) p = 7;
        else if (r === 1 && d > de) p = shift(p, 1);
        else if (r >= U - 3 && d < n - 2) p = shift(p, -1);
      } else if (dd < 2) p = shift(p, -1);
      if (d === n - 2) p = shift(p, -1);
      if (d === n - 1) p = OUT_B;
    }
    // 자연 면 발치: 닿는 선을 풀 포기·잔돌이 끊는다
    if (nat) { const foot = naturalFoot(ax, c, d, n); if (foot >= 0 && d >= de) p = foot; }
    const slopeSide = !!(S && ssl[i]);   // 경사로 옆벽: 끝 외곽선 말고는 옆 그림자·비스듬한 면 어둡힘을 받지 않는다 — 대각선을 따라 검은 띠가 섰다
    if ((EL || ER) && !(slopeSide && n < 4)) p = OUT_B;
    else if (slopeSide) { /* keep the lifted body colour */ }
    else if (((L && lev[i - 1] > c) || (R && lev[i + 1] > c)) && d < DRIP + 4) p = shift(p, -1);
    else if (!wall(sx + 2)) p = shift(p, -1);
    else if (!wall(sx - 2)) p = shift(p, 1);
    // 비스듬한 면: 빛이 북서쪽이라 남서향(＼)은 밝게, 남동향(／)은 어둡게
    if (d >= de && p % 6 && d < n - 1 && !slopeSide) {
      const rd = same(sx + 1) ? dep[i + 1] - d : 0, ld = same(sx - 1) ? dep[i - 1] - d : 0;
      if (rd === 1 || ld === -1) p = shift(p, -1);
      else if (ld === 1 || rd === -1) p = shift(p, 1);
    }
    if (S?.carvedStairs && cut[i]) p = carvedRiser(S, gslopes[cut[i] - 1], ax, mpy[i] + oy, d, n, baseRamps.length);
    // 바이옴 양식은 강조색(세 번째 램프)이 있지만 기본 흙벽은 두 램프뿐이다.
    // 기본 양식의 다리 밑면을 13번 색으로 칠하면 팔레트 바깥을 읽어 렌더가 죽는다.
    if (bridge && deckUnder[i]) p = d === 0 ? (baseRamps.length > 2 ? 13 : 7) : 6;
    out[i] = p;
  }
  // 그늘 루프 건너뛰기용 창 최댓값(서쪽 12·동쪽 4 맵 화소, 남쪽 6 화면 화소). 창 안에 dz > 0 인 곳이 없으면 루프는 아무것도 안 한다.
  const westMax = windowMaxBound(hf, PH, PW, PW, 1, 12, -1);
  const eastMax = windowMaxBound(hf, PH, PW, PW, 1, 4, 1);
  const southMax = windowMaxBound(fl, PW, SH, 1, PW, 6, 1);
  // 원본 바닥 위에 남길 그늘 세기(0~2, style.castShadow) — 원본 바닥은 지형 그늘을 버리므로 따로 적어 두었다가 곱한다
  const castS = S?.castShadow && opt.ground ? new Uint8Array(N) : null;
  // 윗면 가장자리와 그늘
  const rampFace = (j: number) => ssl[j]! > 0 && kind[j] === 0 && !slopes[ssl[j]! - 1]!.steps;
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 0) continue;
    const c = fl[i];
    const top = (y: number, x: number) => {
      if (y < 0 || y >= SH || x < 0 || x >= PW) return false;
      const j = y * PW + x;
      return kind[j] === 0 && Math.abs(fl[j] - c) <= tol(i, j);
    };
    const kL = kind[sy * PW + (sx - 1 + PW) % PW];
    // 매끈한 경사로(계단 아님) 면은 테두리를 긋지 않는다(2026-10-11 사용자: 「일반 땅을 그대로 이어 놓은 느낌」). 경사로 아래쪽이 들린 만큼
    // 옆 0단 땅과 높이가 달라 양옆에 짙은 세로선, 북쪽 끝에 가로 턱 선이 섰다. 옆 절벽 띠는 벽 화소라 제자리에서 끝난다.
    if (c > 0 && !rampFace(i)) {
      if (sy === 0 ? oy === 0 : !top(sy - 1, sx) && kind[i - PW] !== 1) {
        out[i] = OUT_G; edge[i] = 1;
        if (top(sy + 1, sx) && !rampFace(i + PW)) { out[i + PW] = 4; edge[i + PW] = 1; }
        // S.cornice (tundra-snow): a snow cornice two rows deep inside the north rim — the far edge of a raised top reads as a lip
        if (S?.cornice && top(sy + 1, sx) && top(sy + 2, sx) && !ssl[i] && !rampFace(i + PW) && !rampFace(i + 2 * PW)) { out[i + PW] = 5; out[i + 2 * PW] = 3; edge[i + 2 * PW] = 1; }
        continue;
      }
      // 경사로 도트 옆: 경사로 옆선이 이미 테를 두르므로 외곽선을 또 긋지 않는다
      const rampL = !!opt.rampArt && sx > 0 && ssl[i - 1] > 0 && kind[i - 1] === 0, rampR = !!opt.rampArt && sx + 1 < PW && ssl[i + 1] > 0 && kind[i + 1] === 0;
      if (!top(sy, sx - 1) && kL !== 1 && !rampL) {
        out[i] = OUT_G; edge[i] = 1;
        // S.cornice: the west rim faces the light — a lit snow column inside the outline
        if (S?.cornice && sx + 1 < PW && top(sy, sx + 1) && !ssl[i] && !rampFace(i + 1)) { out[i + 1] = 5; edge[i + 1] = 1; }
        continue;
      }
      if (!top(sy, sx + 1) && (sx + 1 >= PW || kind[i + 1] !== 1) && !rampR) {
        out[i] = OUT_G; edge[i] = 1;
        // S.cornice: the east rim turns from the light — a shaded column inside the outline
        if (S?.cornice && sx > 0 && top(sy, sx - 1) && !ssl[i] && !rampFace(i - 1)) { out[i - 1] = 2; edge[i - 1] = 1; }
        continue;
      }
    }
    if (out[i] < 0 || out[i] >= 6 || out[i] === OUT_G) continue;
    // 북쪽 여백 채움 화소는 0번 줄 py=0 에 선 것으로 본다(mpy 는 바닥 무늬 되풀이용이라 그늘 판정에 쓰면 아래 줄을 읽는다)
    const py = padFill[i] ? 0 : mpy[i], mp = py * PW + sx;
    let s = 0;
    for (let k = 1; k <= 10 && sy - k >= 0; k++) {                   // 북쪽 벽 발치
      const jj = i - k * PW; if (kind[jj] !== 1 || (S && ssl[jj])) break;
      const d = dz(fl[jj] - c); if (d <= 0) break;
      s = Math.max(s, k <= 2 ? 2 : k <= 1 + 2 * d ? 1 : 0);
    }
    if (dz(westMax[mp]! - c) > 0) for (let k = 1; k <= 12 && sx - k >= 0; k++) {   // 서쪽이 높다 → 동쪽으로 긴 그늘
      const d = dz(hf[mp - k] - c); if (d <= 0) continue;
      // 경사로가 드리우는 그늘은 없다(2026-09-29 r2): 비탈 높이가 칸마다 올라 그늘이 경사로 옆 검은 세모가 됐다
      if (S && sid[mp - k]) break;
      if (k <= 1 + 3 * d) s = Math.max(s, k <= 1 + d ? 2 : 1);
      break;
    }
    if (dz(eastMax[mp]! - c) > 0) for (let k = 1; k <= 4 && sx + k < PW; k++) {     // 동쪽이 높다 → 짧은 발치 그늘
      const d = dz(hf[mp + k] - c); if (d <= 0) continue;
      if (S && sid[mp + k]) break;
      if (k <= Math.min(4, d)) s = Math.max(s, 1);
      break;
    }
    if (dz(southMax[i]! - c) > 0) for (let k = 1; k <= 6 && sy + k < SH; k++) {     // 남쪽 높은 땅 뒤
      const jj = i + k * PW; if (kind[jj] !== 0) break;
      const d = dz(fl[jj] - c); if (d <= 0) continue;
      if (k <= 1 + d) s = Math.max(s, 1);
      break;
    }
    if (c > 0) {
      const same = (v: number) => Math.abs(v - c) <= (ssl[i] ? 0.3 : 0);
      const lw = sx >= 2 && hf[mp - 2] < c - 0.3 && same(hf[mp - 1]), le = sx + 2 < PW && hf[mp + 2] < c - 0.3 && same(hf[mp + 1]);
      if (!s && lw) out[i] = Math.min(5, out[i] + 1);
      if (le) s = Math.max(s, 1);
    }
    // 경사로 도트 면은 도트가 명암을 가진다 — 벽 발치 그늘을 얹으면 비탈 가장자리에 검은 띠가 선다
    // (the floor under a deck takes no foot shadow either: the deck and the gorge walls around it darkened it into a slab)
    if (s && !(art && ssl[i]) && !(bridge && underDeck[i])) out[i] = Math.max(1, out[i] - s);
    if (castS && s && !ssl[i] && !(bridge && underDeck[i])) castS[i] = s;
  }
  // 뒤·옆 가장자리 턱(rim): 북쪽 가장자리 안쪽 밝은 턱 줄 + 뒤 둑 + 동·서·대각 가장자리 바깥 낮은 땅 위 옆면 띠(벽 램프).
  // 칠한 화소는 가장자리(edge) 표시를 받아 타일 위(over)로 간다. 늪(2026-09-28)에서 시작해 2026-09-29 렌더러 r2 부터
  // 이름 있는 모든 양식의 기본(RELIEF_DEFAULT_RIM, 양식이 rim:false 면 끔).
  // 기본 흙벽도 뒤 둑이 있어야 북쪽 단 차이가 면으로 읽힌다. 재질 없이 윗면을 고르는
  // reliefPickPoint도 실제 화면과 같은 둑/벽 경계를 써야 한다.
  const rim = S ? S.rim : RELIEF_DEFAULT_RIM;
  const rimPx = rim ? take("rimPx", i8, N, -1, true) : null;
  if (rim && rimPx) {
    // 가장자리 화소(외곽선 OUT_G, edge) 하나마다: 그 화소 둘레 8칸 중 윗면이 아닌(더 낮은 땅) 쪽으로 옆면 띠를 편다.
    // 북·북동·북서는 아래로 내려다보는 뒤쪽 둑 — 윗면 안쪽에 밝은 풀 턱 lip 줄. 동·서·대각 옆은 바깥 낮은 땅 위로 side px
    // 옆면(서쪽을 향하면 빛을 받아 벽 4·3, 동쪽이면 그늘 2·1), 가장 바깥 1px 은 벽 외곽선 0. 한 칸 폭 경사로·벽 화소는 건드리지 않는다.
    const { side, lip } = rim, soft = !!rim.soft, sides = rim.sides ?? "all";
    const isTop = (j: number, c: number) => kind[j] === 0 && Math.abs(fl[j] - c) <= 0.3 && !ssl[j];
    const low = (j: number, c: number) => kind[j] !== 1 && !(kind[j] === 0 && fl[j] >= c - 0.5) && !ssl[j];
    // 칠한 화소는 그 가장자리를 가진 윗단 칸(src)의 줄로 옮긴다 — 대각선 가장자리 옆 낮은 땅 화소는 그다음 줄의 들린 윗단 타일
    // (16px 네모 전체)에 덮이므로, 윗단 줄의 over 띠로 그려야 타일 위에 남는다(render-relief-maps·reliefRowStrips 모두 src 로 줄을 정한다)
    let owner = -1;
    // pri: a pixel painted from its own row (0) wins over one hung down from a row above (1..) — on a diagonal edge the
    // next row's face then shows instead of the row above's outline column hanging over it
    const pri = take("pri", i8, N, 99, true);
    let curPri = 0;
    const put = (j: number, v: number) => { if (rimPx[j] < 0 || curPri < pri[j]) { rimPx[j] = v; pri[j] = curPri; } edge[j] = 1; if (owner >= 0 && src[j] < owner) src[j] = owner; };
    for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
      const i = sy * PW + sx; if (kind[i] !== 0 || ssl[i] || !(fl[i] > 0) || out[i] !== OUT_G || !edge[i]) continue;
      if (bridge && isBridge(src[i] % W, (src[i] / W) | 0)) continue;   // a bridge deck has no bank: the gorge floor shows beside it
      const c = fl[i]; owner = src[i];
      const L = sx > 0 && low(i - 1, c), R = sx + 1 < PW && low(i + 1, c), U = sy > 0 && low(i - PW, c);
      if (U) for (let k = 1; k <= lip + 1 && sy + k < SH; k++) {
        const j = i + k * PW; if (!isTop(j, c) || out[j] === OUT_G) break;
        put(j, k <= lip ? (k === 1 ? 5 : 4) : 2);
      }
      // 뒤쪽 둑: 외곽선 바로 위(낮은 땅) 줄들에 흙 비탈 — 북쪽으로 내려가는 둑 면이 보인다(윗줄 밝게, 아래로 어둡게,
      // 맨 윗줄은 벽 외곽선). 3/4 시점에서 뒤로 내려가는 면은 짧게 보이므로 side-1 줄.
      // 면 화소 색: 바이옴 벽 몸통 무늬(이탄 띠)를 화면 좌표로 읽고 빛 방향만큼 밝기를 옮긴다 — 흙 옆면이 벽과 같은 재질로 읽힌다
      const body = S?.body[0];
      const tex = (x: number, y: number, s: number) => {
        const ax = x + ox, ay = y + yb;
        if (body) return shift(body.rows[((ay % body.h) + body.h) % body.h]![((ax % body.w) + body.w) % body.w]!, s);
        const tile = TILES[hsh3(fdiv(ax, 14), fdiv(ay, 14), 31) % TILES.length];
        return shift(6 + Math.max(1, tile[((ay % 14 + 14) % 14) * 14 + (ax % 14 + 14) % 14] % 6), s);
      };
      // (back bank: side-1 rows of peat going down away from the viewer — lit where it leaves the top, darker to its foot,
      // a grass fringe hanging over its top row; the outline closes it at the foot)
      // 뒤 비탈(rim.back, 2026-11-14): 흙 둑 대신 마루 뒤 낮은 땅 back px 를 그늘 비탈로 — 마루 바로 뒤 두 줄은 짙게(윗면 램프 1),
      // 그 뒤는 한 단 옅게(2, 넷에 하나 짙은 점), 이어서 바둑판, 끝은 넷에 하나만 남겨 바닥에 섞인다. 무늬는 칸 주기(4)의 약수라
      // 부분 굽기 창 좌표로 읽어도 전체 그림과 같다. 화소는 낮은 땅 칸의 것으로 남긴다(owner 를 옮기지 않는다): 주인 줄이 윗단이면
      // 언덕 뒤에 선 캐릭터의 발 12px 를 덮고, 그 자리를 누르면 윗단 칸이 집힌다. 맵 밖 빈 화소(kind < 0)에는 그리지 않는다.
      if (U && rim.back) {
        const n = rim.back, n1 = Math.ceil(n / 6), n2 = Math.ceil(n * 5 / 12), n3 = Math.ceil(n * 3 / 4), keep = owner;
        owner = -1;
        for (let k = 1; k <= n && sy - k >= 0; k++) {
          const j = i - k * PW; if (kind[j] !== 0 || !low(j, c)) break;
          const y = sy - k; curPri = k;
          if (k <= n1) put(j, 1);
          else if (k <= n2) put(j, (sx + y) % 4 ? 2 : 1);
          else if (k <= n3) { if ((sx + y) % 2) put(j, 2); }
          else if ((sx + 2 * y) % 4 === 0) put(j, 2);
        }
        curPri = 0; owner = keep;
      } else if (U) { const n = Math.max(2, side - 1); for (let k = 1; k <= n && sy - k >= 0; k++) { const j = i - k * PW; if (!low(j, c)) break; curPri = k;
        // soft: no closing outline — the last row dithers into the ground so the bank reads as a slope, not a fenced strip
        if (soft && k === n) { if ((sx + sy) % 2) put(j, tex(sx, sy - k, 0)); continue; }
        put(j, k === n ? OUT_B : k === 1 ? (((sx + ox) >> 1) % 3 ? 4 : 3) : tex(sx, sy - k, k <= 2 ? 2 : 1)); } curPri = 0; }
      // 옆 둑: 바깥 낮은 땅 쪽 side px 는 옆면. 서쪽을 향하면 빛(4·3), 동쪽이면 그늘(2·1), 가장 바깥 1px 은 벽 외곽선.
      // 대각선 가장자리는 옆면이 한 줄씩 밀려 가는 선이 되므로, 옆면 띠를 아래로 side 줄 늘어뜨려 면으로 만든다.
      // sides (r3): "none" = no east / west faces at all; "diag" = only where the edge is also open to the north or south (a corner or
      // a diagonal step), never along a straight east / west edge
      const diagEdge = U || (sy + 1 < SH && low(i + PW, c));
      for (const [dir, on] of [[-1, L], [1, R]] as const) {
        if (!on || sides === "none" || (sides === "diag" && !diagEdge)) continue;
        for (let k = 1; k <= side; k++) {
          const x = sx + dir * k; if (x < 0 || x >= PW) break;
          const j = sy * PW + x; if (!low(j, c)) break;
          const lit = dir < 0 ? 1 : -1;
          // the face: a lit lip where it leaves the top, the peat body, the outline only on its outermost column
          // (the peat body is dark on its own: the face is lifted so it reads as a sunlit / shaded bank, not a black band)
          // soft (default style bank): a graded slope — lit toward the light, shaded away from it, the outer column dithered into the
          // ground — instead of a bright lip + dark outline frame, which read as a stone/wood rail fencing the plateau
          const f = soft
            ? (yy: number, xx: number) => (k === side ? ((xx + yy) % 2 ? tex(xx, yy, lit - 1) : -2) : tex(xx, yy, lit > 0 ? [2, 1, 0][Math.min(k - 1, 2)]! : [-1, -2, -2][Math.min(k - 1, 2)]!))
            : (yy: number, xx: number) => (k === side ? OUT_B : k === 1 ? shift(tex(xx, yy, 0), 3) : tex(xx, yy, lit + 2 - (k >= side - 1 ? 1 : 0)));
          curPri = 0; { const v0 = f(sy, x); if (v0 >= 0) put(j, v0); }
          // hung down (the face's height): body colour, never the outline — the outline follows the edge row by row
          for (let d = 1; d < side; d++) { const q = j + d * PW; if (sy + d >= SH || !low(q, c)) break; curPri = d; const v1 = k === side && !soft ? tex(x, sy + d, lit) : f(sy + d, x); if (v1 >= 0) put(q, v1); }
          curPri = 0;
        }
      }
    }
  }
  // 윗면 가장자리 안쪽 그늘 띠(style.tundraTopShade, 기본 꺼짐 — 툰드라 담당이 켠다): 윗면과 아랫땅이 같은 색(눈)이면 한 단 높이차가
  // 안 읽힌다. 북·동·서 가장자리 안쪽 band px 를 윗면 램프 0번 색으로 alpha 에서 0 까지 옅어지게 덮는다(가장자리 화소 자신은 외곽선 그대로).
  const shadeA = S?.topShade ? take("shadeA", u8, N, 0, true) : null;
  if (S?.topShade && shadeA) {
    const { band, alpha } = S.topShade;
    const isT = (j: number, c: number) => kind[j] === 0 && Math.abs(fl[j] - c) <= 0.3 && !ssl[j];
    for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
      const i = sy * PW + sx; if (kind[i] !== 0 || ssl[i] || !(fl[i] > 0) || edge[i]) continue;
      const c = fl[i]; let dm = band + 1;
      for (let k = 1; k <= band && sy - k >= 0; k++) if (!isT((sy - k) * PW + sx, c) && kind[(sy - k) * PW + sx] !== 1) { dm = Math.min(dm, k); break; }
      for (let k = 1; k <= band && sx - k >= 0; k++) if (!isT(sy * PW + sx - k, c) && kind[sy * PW + sx - k] !== 1) { dm = Math.min(dm, k); break; }
      for (let k = 1; k <= band && sx + k < PW; k++) if (!isT(sy * PW + sx + k, c) && kind[sy * PW + sx + k] !== 1) { dm = Math.min(dm, k); break; }
      if (dm <= band) shadeA[i] = Math.round(alpha * (1 - (dm - 1) / band));
    }
  }
  const rgba = take("rgba", u8c, N * 4, 0, ret), xray = take("xray", u8c, N * 4, 0, ret);
  // 경사로 도트 맵은 층마다 밝기를 곱하지 않는다 — 곱한 색은 칩셋에 없는 색이 되어 타일 사이에서 튄다
  const tone = opt.tone !== false && !art ? (c: number) => Math.max(0.9, Math.min(1.22, 0.94 + 0.026 * c)) : () => 1;
  // 매끈한 경사로는 연속된 밝기만 쓴다. 일정 간격의 가로 줄은 계단처럼 읽힌다.
  const slopeShade = (i: number) => {
    const s = slopes[ssl[i] - 1];
    let f = SLOPE_LIGHT[s.dir];
    if (s.steps) return f;
    return f * (0.93 + 0.1 * sst[i]);
  };
  // carved stone & log flights: repaint each N/S flight's full screen span at natural ~8-9px step pitch (dressed staggered stone blocks
  // with sunlit nosing, overhang shadow & rugged cut-stone cheeks, or packed earth/grass treads with cylindrical timber logs & stakes).
  // Bounds are anchored in global screen Y so editor partial-window bakes match full bakes pixel-for-pixel.
  if (S?.carvedStairs) {
    const gLo = new Int32Array(slopes.length + 1).fill(1 << 30), gHi = new Int32Array(slopes.length + 1).fill(-1);
    const ownerOf = (i: number) => { const o = cut.length ? cut[i]! : 0; if (o) return o; const q = ssl[i]; return q && kind[i] === 0 && slopes[q - 1]?.steps ? q : 0; };
    for (let o = 1; o <= gslopes.length; o++) {
      const s = gslopes[o - 1]!;
      if (!s.steps || (s.dir !== "n" && s.dir !== "s")) continue;
      if (s.dir === "n") {
        const len = s.h * T, topStepC = s.lo + (Math.floor(((len - 0.5) / len) * s.steps) / s.steps) * (s.hi - s.lo);
        gLo[o] = s.y > 0 ? s.y * T + pad - Math.round(s.hi * U) : pad - Math.round(topStepC * U);
        gHi[o] = (s.y + s.h) * T - 1 + pad - Math.round(s.lo * U);
      } else {
        const len = s.h * T;
        for (let py = s.y * T; py < (s.y + s.h) * T; py++) {
          const t = Math.floor(((py - s.y * T + 0.5) / len) * s.steps) / s.steps;
          const sy = py + pad - Math.round((s.lo + t * (s.hi - s.lo)) * U);
          if (sy < gLo[o]!) gLo[o] = sy;
          if (sy > gHi[o]!) gHi[o] = sy;
        }
      }
    }
    if (!win) {
      for (let i = 0; i < N; i++) {
        const o = ownerOf(i); if (!o) continue;
        const gy = ((i / PW) | 0) + oy;
        if (gy < gLo[o]!) gLo[o] = gy;
        if (gy > gHi[o]!) gHi[o] = gy;
      }
    }
    for (let i = 0; i < N; i++) {
      const o = ownerOf(i); if (!o) continue;
      const s = gslopes[o - 1]!; if (!s.steps || (s.dir !== "n" && s.dir !== "s")) continue;
      const sy = (i / PW) | 0, sx = i % PW;
      out[i] = paintCarvedStairPixel(S, s, sx + ox, sy + oy, gLo[o]!, gHi[o]!, baseRamps.length, out[i]!);
      edge[i] = 0;
    }
  }
  const stairOwner = (i: number): number => (cut.length ? cut[i] : 0) || (ssl[i] && kind[i] === 0 && slopes[ssl[i] - 1]?.steps ? ssl[i] : 0);
  const hidCell = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) hidCell[k] = topN[k] && hidN[k] * 2 >= topN[k] ? 1 : 0;
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; let p = out[i];
    if (p < 0) p = GROUND[(sy % T) * T + sx % T];
    const col = ramps[(p / 6) | 0][p % 6], o = i * 4, f = kind[i] === 0 && !(S?.carvedStairs && stairOwner(i)) && !(bridge && underDeck[i]) ? (art && ssl[i] ? 1 : tone(fl[i])) * (ssl[i] ? slopeShade(i) : 1) : 1;   // (the floor under a deck is ground-lit: tone() darkened it into a slab)
    if (opt.transparentGround && kind[i] < 0) continue;
    // 투명 땅은 제자리(높이 0)만. 경사로 아랫도리는 반올림 단이 0 이어도 위로 밀려 그려져 그 자리에 타일이 없다 — 불투명으로 칠한다.
    // 윗단 칸의 모서리 깎임(diag)도 화소는 높이 0 이지만 그 칸 타일은 위로 들려 그려진다 — 원천 칸이 높이 0 일 때만 비운다.
    if (opt.transparentGround && kind[i] === 0 && lev[i] === 0 && fl[i] < 1e-6 && !ssl[i] && !stairOwner(i) && !h[(src[i] / W) | 0]?.[src[i] % W]) {
      const shade = GROUND[(sy % T) * T + sx % T] - p;
      rgba[o + 3] = shade > 0 ? Math.min(150, 55 * shade) : 0;
      // 경사로 도트 맵: 반투명으로 섞으면 칩셋에 없는 색이 나온다 — 윗면 램프의 풀색(1단 그늘 = 2번, 짙은 그늘 = 1번)으로 불투명하게
      if (art && shade > 0) { const g = ramps[0][shade >= 2 ? 1 : 2]; rgba[o] = g[0]; rgba[o + 1] = g[1]; rgba[o + 2] = g[2]; rgba[o + 3] = 255; }
    } else {
      rgba[o] = col[0] * f; rgba[o + 1] = col[1] * f; rgba[o + 2] = col[2] * f; rgba[o + 3] = 255;
    }
    if (shadeA && shadeA[i] && !(rimPx && rimPx[i] >= 0)) { const g = ramps[0][0]; rgba[o] = g[0]; rgba[o + 1] = g[1]; rgba[o + 2] = g[2]; rgba[o + 3] = shadeA[i]; edge[i] = 1; }
    if (rimPx && rimPx[i] >= 0) {
      const rc = ramps[(rimPx[i] / 6) | 0][rimPx[i] % 6];
      rgba[o] = rc[0]; rgba[o + 1] = rc[1]; rgba[o + 2] = rc[2]; rgba[o + 3] = 255;
      // 바깥 흙 둑은 벽이다. 실제 바닥 타일로 덮거나 바닥 under 띠로 보내지 않는다.
      if (rimPx[i] >= 6) kind[i] = 1;
    }
    if (hid[i] >= 0 && hidCell[hidSrc[i]]) {
      const edge = [1, -1, PW, -PW].some((dd) => { const jj = i + dd; return jj < 0 || jj >= N || hid[jj] < 0 || !hidCell[hidSrc[jj]]; });
      if (edge) { xray[o] = 90; xray[o + 1] = 230; xray[o + 2] = 255; xray[o + 3] = 255; }
      else if (sx % 2 === 0 && sy % 2 === 0) {
        const hc = ramps[(hid[i] / 6) | 0][hid[i] % 6];
        xray[o] = hc[0] * 0.6 + 40; xray[o + 1] = hc[1] * 0.6 + 80; xray[o + 2] = hc[2] * 0.6 + 100; xray[o + 3] = 255;
      }
    }
  }
  const hidden: [number, number][] = [];
  for (let k = 0; k < NC; k++) if (hidCell[k]) hidden.push([k % W, (k / W) | 0]);
  // 매끈한 경사로는 항상 한 면으로 그린다. 바이옴 그림이 없으면 현재 흙·풀 팔레트로 그린다.
  let overSlope: Uint8Array | undefined;
  if (slopes.some(s => !s.steps)) {
    overSlope = take("overSlope", u8, N, 0, ret);
    for (let k = 0; k < N; k++) if (ssl[k] && kind[k] === 0 && !slopes[ssl[k] - 1]?.steps) overSlope[k] = 1;
    const surface = { rgba, kind, ssl, sst, mpy, PW, SH, ox, oy };
    if (opt.rampArt) paintRamps(opt.rampArt, gslopes, surface);
    else paintNaturalRamps(baseRamps, gslopes, surface);
  }
  // Geometry owns the entire lower plane when native pixels are available. Square tile stamps
  // cannot mask diagonal cuts, or preserve a continuous road texture on a ramp.
  if (opt.ground) for (let i = 0; i < N; i++) {
    const cap = kind[i] === 1 && out[i] >= 0 && out[i] < 6;
    const rimTone = rimPx?.[i] ?? -1;
    if (kind[i] !== 0 && !cap || mpy[i] < 0 && !(rimTone >= 0 && src[i] >= 0) || stairOwner(i) || bridge && underDeck[i] || rimTone >= 6) continue;
    const o = i * 4;
    // 지도 끝의 둑도 주인 윗단의 재질을 쓴다. 빈 여백(src=-1)에 그린 둑은 띠 분리 때 버려졌었다.
    const py = mpy[i] < 0 ? Math.floor(src[i] / W) * T : mpy[i];
    let sampled = opt.ground.sample(i % PW + ox, py + oy, rgba, o);
    // 깎아지른 양식: 둥근 윤곽이 윗면을 빈 곳 칸(바닥 타일 없음) 위로 조금 넓힌다 — 그 화소는 이웃 땅 칸의 바닥을 읽는다(하늘 구멍 방지)
    if (!sampled && S?.sheer && kind[i] === 0 && lev[i]! > 0) for (const [dx, dy] of [[0, -16], [-16, 0], [16, 0], [0, 16], [-16, -16], [16, -16]] as const) if ((sampled = opt.ground.sample(i % PW + ox + dx, py + oy + dy, rgba, o))) break;
    if (sampled) {
      // 무늬는 실제 하층 타일, 외곽선·안쪽 밝은 턱은 지형의 명암을 쓴다.
      // kind=0을 무조건 덮으면 북·동·서 절벽 경계가 같은 잔디색에 묻힌다.
      const edgeTone = rimTone >= 0 ? rimTone : edge[i] ? out[i] : -1;
      const shade = cap ? .7 + .05 * out[i]
        : edgeTone >= 0 && edgeTone < 6 ? NATIVE_EDGE_LIGHT[edgeTone]! : 1;
      let light = shade * (shadeA?.[i] && rimTone < 0 ? 1 - .3 * shadeA[i] / 255 : 1);
      if (!cap && edgeTone < 0) {
        if (castS?.[i]) light *= 1 - 0.12 * castS[i]!;
        if (S?.topTone && lev[i]! > 0 && !ssl[i]) light *= 1 + S.topTone * lev[i]!;
      }
      rgba[o] *= light; rgba[o + 1] *= light; rgba[o + 2] *= light;
    }
  }
  if (opt.slopeArt?.some(Boolean)) paintSlopePieces(opt.slopeArt, gslopes, { rgba, ssl, PW, SH, ox, oy, pad });
  // 깎아지른 면(styles.ts sheer): 기하는 위에서 faceRows 배 높이로 다 그렸다 — 면·옆면·테·빈 곳·그늘·장치를 조각으로 입힌다
  if (S?.sheer) paintSheer({ rgba, kind, lev, dep, run, src, fl, ssl, edge, mpy, hf, PW, SH, pad, ox, oy, cx0: win?.cx ?? 0, cy0, levelPx: S.faceRows * U,
    underDeck, deckUnder, bridge, W, h, climbs: opt.climbs ?? [], falls: opt.falls ?? [] }, sheerArt());
  return { rgba, xray, PW, SH, pad, src, kind, lev, hidden, slope: ssl, slopeT: sst, mpy, height: fl, edge, ...(opt.ground ? { nativeGround: true } : {}), ...(overSlope ? { overSlope } : {}) };
}

/**
 * 통째 경사로 조각(ReliefRenderOptions.slopeArt): 그 경사로 화소에 조각을 화면 사각형 기준으로 찍는다(반복 없음).
 * 북쪽 오르막 사각형 = x [s.x, s.x+w) 칸, 화면 y [s.y·T + pad − hi·U, (s.y+h)·T + pad − lo·U).
 * 남쪽 오르막(역방향) 사각형 = 화면 y [s.y·T + pad − lo·U, (s.y+h)·T + pad − hi·U) — 높은 단 앞 가장자리에서 멀어지며 내려가는 면. 동서는 조각을 쓰지 않는다.
 */
function paintSlopePieces(
  art: readonly (ReliefArtPatch | null | undefined)[], slopes: ReliefSlope[],
  r: { rgba: Uint8ClampedArray; ssl: Int16Array; PW: number; SH: number; ox: number; oy: number; pad: number },
) {
  const { rgba, ssl, PW, SH, ox, oy, pad } = r;
  for (let i = 0; i < PW * SH; i++) {
    const sid = ssl[i]; if (!sid) continue;
    const p = art[sid - 1], s = slopes[sid - 1];
    if (!p || !s || (s.dir !== "n" && s.dir !== "s")) continue;
    // n: top = the cut's crest on the high ground; s (reverse, high ground south): top = its far (north) foot on the low ground
    const x = (i % PW) + ox - s.x * T, y = Math.floor(i / PW) + oy - (s.y * T + pad - (s.dir === "n" ? s.hi : s.lo) * U);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
    const q = (y * p.w + x) * 4;
    if (!p.rgba[q + 3]) continue;
    rgba[i * 4] = p.rgba[q]!; rgba[i * 4 + 1] = p.rgba[q + 1]!; rgba[i * 4 + 2] = p.rgba[q + 2]!; rgba[i * 4 + 3] = 255;
  }
}

/** 주변 땅의 팔레트로 칠하는 연속 비탈. 뭉개진 보간 대신 도트 클러스터·풀 포기 가장자리·등고 음영·잔돌로 자연스러운 3/4 오르막을 그린다. */
function paintNaturalRamps(
  ramps: number[][][], slopes: ReliefSlope[],
  r: { rgba: Uint8ClampedArray; kind: Int8Array; ssl: Int16Array; sst: Float32Array; mpy: Int32Array; PW: number; SH: number; ox: number; oy: number },
) {
  const { rgba, kind, ssl, sst, mpy, PW, SH, ox, oy } = r;
  const topRamp = ramps[0]!, earthRamp = ramps[Math.min(ramps.length - 1, 1)]!;
  for (let i = 0; i < PW * SH; i++) {
    const owner = ssl[i];
    if (!owner || kind[i] !== 0 || slopes[owner - 1]!.steps) continue;
    const s = slopes[owner - 1]!, px = i % PW + ox, py = mpy[i]! + oy;
    const [across, width] = stairAcross(s, px, py), t = Math.max(0, Math.min(1, sst[i]!));
    const ns = s.dir === "n" || s.dir === "s";
    const along = ns ? py : px, len = (ns ? s.h : s.w) * T;
    const edgeDist = Math.min(across, width - 1 - across), leftSide = across < (width >> 1);
    const n = nmix(px, py, 601), clod = 0.58 * vn2(px * 0.42, py * 0.42, 607) + 0.42 * vn2(px * 0.19, py * 0.21, 613);
    // 양옆 풀 포기 경계와 위·아래 끝: 곧은 사각형 대신 들쭉날쭉한 풀 클러스터가 비탈 안쪽으로 자연스럽게 스며든다
    const wave = 2.0 + 3.4 * vn1(along * 0.21, owner * 13 + (leftSide ? 3 : 9)) + (n % 3 === 0 ? 1.2 : 0);
    const endDist = Math.min(t, 1 - t) * len;
    const endFeather = 1.0 + 4.2 * vn1(across * 0.29, owner * 19 + (t > 0.5 ? 5 : 11)) + ((n >> 2) % 3);
    let col: number[];
    if (edgeDist < wave || endDist < endFeather) {
      const gt = (n % 7 === 0) ? 4 : clod > 0.62 ? 4 : clod < 0.34 ? 2 : 3;
      col = topRamp[Math.max(1, Math.min(5, gt + (t > 0.84 && (n % 4 === 0) ? 1 : 0)))]!;
    } else if (edgeDist < wave + 1.5) {
      // 풀과 흙길 경계 턱: 서쪽(왼쪽) 절개 가장자리는 살짝 그늘지고 동쪽(오른쪽)은 빛을 받는다
      col = (n & 1 ? topRamp[leftSide ? 2 : 3] : earthRamp[leftSide ? 2 : 4])!;
    } else {
      // 다져진 비탈 흙길: 마루(t→1)는 햇빛을 받아 밝고 발치(t→0)로 갈수록 차분해지며, 부드러운 흙덩이 결·잔돌로 경사를 읽힌다
      const fade = (t - 0.42) * 1.45 + (clod - 0.5) * 2.1 + (((n >> 4) & 3) - 1.5) * 0.18;
      let et = fade > 0.52 ? 5 : fade > -0.08 ? 4 : fade > -0.62 ? 3 : 2;
      const u = Math.abs(across - (width - 1) * 0.5) / Math.max(1, width * 0.5);
      const arc = Math.round(along + (ns ? 1 : -1) * 2.2 * (1 - u * u));
      if (arc % 9 === 0 && clod < 0.52 && (n % 5 < 2)) et = Math.max(2, et - 1);
      else if (arc % 9 === 8 && clod > 0.48 && (n % 5 < 2)) et = Math.min(5, et + 1);
      if (t > 0.88 && (n % 3 !== 0)) et = Math.max(et, 5);
      if ((n & 31) === 0) et = 5;
      else if (nmix(px - 1, py, 601) % 32 === 0) et = 2;
      col = earthRamp[et]!;
    }
    const light = SLOPE_LIGHT[s.dir] * (0.95 + 0.08 * t), o = i * 4;
    rgba[o] = col[0]! * light; rgba[o + 1] = col[1]! * light; rgba[o + 2] = col[2]! * light; rgba[o + 3] = 255;
  }
}

/** 경사로 도트 입히기. 윗면 화소는 맵 좌표(mpy, 화면 x)로 16×16 면 도트를 반복한다. */
function paintRamps(
  art: ReliefRampArt,
  slopes: ReliefSlope[],
  r: { rgba: Uint8ClampedArray; kind: Int8Array; ssl: Int16Array; sst: Float32Array; mpy: Int32Array; PW: number; SH: number; ox: number; oy: number },
) {
  const { rgba, kind, ssl, sst, mpy, PW, SH, ox, oy } = r;
  const put = (i: number, p: ReliefArtPatch, x: number, y: number) => {
    const q = ((((y % p.h) + p.h) % p.h) * p.w + (((x % p.w) + p.w) % p.w)) * 4;
    if (p.rgba[q + 3]! === 0) return;
    rgba[i * 4] = p.rgba[q]!; rgba[i * 4 + 1] = p.rgba[q + 1]!; rgba[i * 4 + 2] = p.rgba[q + 2]!; rgba[i * 4 + 3] = 255;
  };
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx, sid = ssl[i];
    if (!sid || kind[i] !== 0) continue;
    const s = slopes[sid - 1]!, ns = s.dir === "n" || s.dir === "s", my = mpy[i]! + oy;
    if (s.steps) continue;
    // t = 0 at the low end, 1 at the high end (render.ts slopeHeights)
    const t = sst[i]!, len = (ns ? s.h : s.w) * T;
    // the face art's rows are contour lines across the slope: north-south ramps take it as drawn, east-west ramps
    // transposed (contours run north-south). Where it meets the ground: a 1px line in the chipset's own darker grass at
    // the foot and its lighter grass at the crest (the art's side strip: column 0 = foot, column 1 = crest), so the slope
    // reads as joined to both levels.
    const face = s.dir === "n" || s.dir === "e" ? art.lit : art.shade;
    if (ns) put(i, face, sx + ox, my); else put(i, face, my, sx + ox);
    if (t >= 0 && t * len < 1) put(i, art.side, 0, 0);
    else if (t >= 0 && (1 - t) * len < 1) put(i, art.side, 1, 0);
  }
}
