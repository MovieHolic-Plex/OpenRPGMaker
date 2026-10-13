// 전투기계 캐릭터셋(RM2000 규격 288×256: 4×2 인물, 인물당 3열 걷기 × 위·오른쪽·아래·왼쪽 4방향, 프레임 24×32)을 코드로 찍는다.
// 생성 그림이 아니라 손 도트 규칙(윤곽+밝은 윗·왼면+어두운 아래·오른면)이라 맵 도트와 시점·크기가 맞고 걷기 프레임이 진짜로 바뀐다.
import type { RgbaImage } from "./imageProcess";

export type Rgb = readonly [number, number, number];
export type MechBody = "biped" | "quad";
export type MechKit = "none" | "antenna" | "cannon" | "shield";
export interface MechSpec {
  readonly body?: MechBody;
  /** 몸 폭 0 경량 · 1 보통 · 2 중장갑 */
  readonly width?: 0 | 1 | 2;
  readonly kit?: MechKit;
  readonly base: Rgb;
  /** 눈·광학부 발광색 */
  readonly glow: Rgb;
  /** 포인트(관절·방패 문양) 색 */
  readonly accent: Rgb;
}

interface Pal { b: Rgb; l: Rgb; d: Rgb; e: Rgb; g: Rgb; a: Rgb }
const scale = (c: Rgb, k: number): Rgb => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
const palette = (spec: MechSpec): Pal => ({ b: spec.base, l: scale(spec.base, 1.45), d: scale(spec.base, 0.55), e: scale(spec.base, 0.22), g: spec.glow, a: spec.accent });

class Cell {
  readonly px = new Map<number, Rgb>();
  put(x: number, y: number, c: Rgb): void { if (x >= 0 && x < 24 && y >= 0 && y < 32) this.px.set(y * 24 + x, c); }
  rect(x0: number, y0: number, x1: number, y1: number, c: Rgb): void { for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) this.put(x, y, c); }
  box(x0: number, y0: number, x1: number, y1: number, P: Pal): void {
    this.rect(x0, y0, x1, y1, P.e);
    if (x1 - x0 < 2 || y1 - y0 < 2) { this.rect(x0, y0, x1, y1, P.d); return; }
    this.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, P.b);
    this.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, P.l);
    this.rect(x0 + 1, y0 + 1, x0 + 1, y1 - 1, P.l);
    this.rect(x1 - 1, y0 + 2, x1 - 1, y1 - 1, P.d);
    this.rect(x0 + 2, y1 - 1, x1 - 1, y1 - 1, P.d);
  }
}

function kitFront(c: Cell, P: Pal, kit: MechKit, bob: number, front: boolean): void {
  const cx = 12;
  if (kit === "antenna") { c.rect(cx + 2, 1 - bob, cx + 2, 4 - bob, P.e); c.put(cx + 2, 0 - bob, P.g); }
  else if (kit === "cannon") {
    if (front) { c.box(cx + 3, 5 - bob, cx + 6, 9 - bob, P); c.rect(cx + 4, 4 - bob, cx + 5, 5 - bob, P.g); }
    else c.box(cx - 1, 4 - bob, cx + 4, 8 - bob, P);
  } else if (kit === "shield") {
    if (front) { c.box(cx - 8, 11 - bob, cx - 4, 21 - bob, P); c.rect(cx - 7, 14 - bob, cx - 5, 17 - bob, P.a); }
    else c.box(cx - 5, 11 - bob, cx + 1, 21 - bob, P);
  }
}

function drawFront(c: Cell, P: Pal, w: number, kit: MechKit, f: number, back: boolean): void {
  const bob = f !== 1 ? 1 : 0;
  const liftL = f === 0 ? 2 : 0, liftR = f === 2 ? 2 : 0;
  const tw = 4 + w, cx = 12;
  for (const [side, lift] of [[-1, liftL], [1, liftR]] as const) {
    const x0 = side < 0 ? cx - 5 : cx + 1;
    c.box(x0, 21 - lift, x0 + 3, 26 - lift, P);
    c.box(x0 - (w === 2 ? 1 : 0), 26 - lift, x0 + 3 + (w === 2 ? 1 : 0), 29 - lift, P);
    c.box(x0 - 1, 29 - lift, x0 + 4, 30 - lift + (lift === 0 ? 1 : 0), P);
  }
  c.box(cx - 4, 19 - bob, cx + 3, 22 - bob, P);
  const ayL = 12 - bob + (f === 2 ? 1 : 0), ayR = 12 - bob + (f === 0 ? 1 : 0);
  c.box(cx - tw - 3, ayL, cx - tw, ayL + 7, P);
  c.box(cx + tw - 1, ayR, cx + tw + 2, ayR + 7, P);
  c.rect(cx - tw - 2, ayL + 7, cx - tw - 1, ayL + 7, P.a); c.rect(cx + tw, ayR + 7, cx + tw + 1, ayR + 7, P.a);
  c.box(cx - tw, 10 - bob, cx + tw - 1, 19 - bob, P);
  c.box(cx - tw - 3, 9 - bob, cx - tw + 1, 12 - bob, P); c.box(cx + tw - 2, 9 - bob, cx + tw + 2, 12 - bob, P);
  if (back) {
    c.rect(cx - 2, 12 - bob, cx + 1, 17 - bob, P.d);
    for (const yy of [13, 15, 17]) c.rect(cx - 2, yy - bob, cx + 1, yy - bob, P.e);
  } else { c.rect(cx - 2, 13 - bob, cx + 1, 14 - bob, P.g); c.rect(cx - 1, 16 - bob, cx, 17 - bob, P.a); }
  const hx = cx - 3;
  c.box(hx, 4 - bob, hx + 5, 9 - bob, P);
  if (!back) c.rect(hx + 1, 6 - bob, hx + 4, 7 - bob, P.g); else c.rect(hx + 1, 7 - bob, hx + 4, 7 - bob, P.d);
  kitFront(c, P, kit, bob, !back);
}

function drawSide(c: Cell, P: Pal, w: number, kit: MechKit, f: number, face: "left" | "right"): void {
  const bob = f !== 1 ? 1 : 0;
  const s = face === "right" ? 1 : -1;
  const X = (a: number, b: number): [number, number] => { const p = 12 + s * a, q = 12 + s * b; return [Math.min(p, q), Math.max(p, q)]; };
  const sw = [-3, 0, 3][f]!;
  for (const [lead, off] of [[false, -sw], [true, sw]] as const) {
    const lift = (lead && f === 0) || (!lead && f === 2) ? 1 : 0;
    let [a, b] = X(-1 + off, 2 + off); c.box(a, 21 - lift, b, 26 - lift, P);
    [a, b] = X(-1 + off, 3 + off); c.box(a, 26 - lift, b, 29 - lift, P);
    [a, b] = X(-1 + off, 4 + off); c.box(a, 29 - lift, b, 30 - lift, P);
  }
  let [a, b] = X(-3, 3); c.box(a, 19 - bob, b, 22 - bob, P);
  [a, b] = X(-3 - Math.floor(w / 2), 3 + Math.floor(w / 2)); c.box(a, 10 - bob, b, 19 - bob, P);
  [a, b] = X(-6 - Math.floor(w / 2), -3 - Math.floor(w / 2)); c.box(a, 10 - bob, b, 17 - bob, P);
  const ao = [2, 0, -2][f]!;
  [a, b] = X(-1 + ao, 2 + ao); c.box(a, 11 - bob, b, 18 - bob, P);
  [a, b] = X(0 + ao, 1 + ao); c.rect(a, 18 - bob, b, 18 - bob, P.a);
  [a, b] = X(-2, 4); c.box(a, 4 - bob, b, 9 - bob, P);
  [a, b] = X(2, 4); c.rect(a, 6 - bob, b, 7 - bob, P.g);
  if (kit === "antenna") { const px = X(-1, -1)[0]; c.rect(px, 1 - bob, px, 4 - bob, P.e); c.put(px, 0 - bob, P.g); }
  else if (kit === "cannon") { [a, b] = X(-4, 3); c.box(a, 5 - bob, b, 8 - bob, P); [a, b] = X(3, 5); c.rect(a, 6 - bob, b, 7 - bob, P.g); }
  else if (kit === "shield") { [a, b] = X(1, 3); c.box(a, 11 - bob, b, 21 - bob, P); }
}

function drawQuad(c: Cell, P: Pal, dir: string, f: number): void {
  const bob = f !== 1 ? 1 : 0;
  if (dir === "down" || dir === "up") {
    c.box(6, 12 - bob, 17, 21 - bob, P);
    c.box(8, 8 - bob, 15, 13 - bob, P);
    if (dir === "down") { c.rect(9, 10 - bob, 14, 11 - bob, P.g); c.rect(10, 12 - bob, 13, 12 - bob, P.e); }
    else { c.rect(9, 15 - bob, 14, 16 - bob, P.d); c.rect(10, 18 - bob, 13, 18 - bob, P.g); }
    [5, 9, 13, 17].forEach((x, i) => {
      const lift = (f === 0 && (i === 0 || i === 3)) || (f === 2 && (i === 1 || i === 2)) ? 2 : 0;
      c.box(x, 21 - lift, x + 2, 29 - lift, P);
      c.box(x - 1, 29 - lift, x + 3, 30 - lift, P);
    });
    c.box(3, 12 - bob, 5, 15 - bob, P); c.box(18, 12 - bob, 20, 15 - bob, P);
    return;
  }
  const s = dir === "right" ? 1 : -1;
  const X = (a: number, b: number): [number, number] => { const p = 12 + s * a, q = 12 + s * b; return [Math.min(p, q), Math.max(p, q)]; };
  let [a, b] = X(-8, 6); c.box(a, 12 - bob, b, 20 - bob, P);
  [a, b] = X(4, 10); c.box(a, 9 - bob, b, 15 - bob, P);
  [a, b] = X(8, 10); c.rect(a, 11 - bob, b, 12 - bob, P.g);
  [a, b] = X(-11, -8); c.box(a, 13 - bob, b, 16 - bob, P);
  [-8, -4, 1, 5].forEach((xo, i) => {
    const sw = [-2, 0, 2][f]! * (i % 2 === 0 ? 1 : -1);
    const lift = sw > 0 ? 1 : 0;
    let [p, q] = X(xo + sw, xo + sw + 2); c.box(p, 20 - lift, q, 28 - lift, P);
    [p, q] = X(xo + sw - 1, xo + sw + 3); c.box(p, 28 - lift, q, 30 - lift, P);
  });
}

/** 위·오른쪽·아래·왼쪽(이 엔진의 CHARSET_DIRECTIONS 순서) × 걷기 3프레임. */
const DIRECTIONS = ["up", "right", "down", "left"] as const;

/** 최대 8명을 4열×2행으로 놓은 288×256 시트. 빈 칸은 투명. */
export function drawMechSheet(specs: readonly MechSpec[]): RgbaImage {
  const width = 288, height = 256;
  const data = new Uint8ClampedArray(width * height * 4);
  specs.slice(0, 8).forEach((spec, ci) => {
    const P = palette(spec);
    const ox = (ci % 4) * 72, oy = Math.floor(ci / 4) * 128;
    DIRECTIONS.forEach((dir, row) => {
      for (let f = 0; f < 3; f += 1) {
        const c = new Cell();
        const kit = spec.kit ?? "none", w = spec.width ?? 1;
        if (spec.body === "quad") drawQuad(c, P, dir, f);
        else if (dir === "down") drawFront(c, P, w, kit, f, false);
        else if (dir === "up") drawFront(c, P, w, kit, f, true);
        else drawSide(c, P, w, kit, f, dir);
        for (const [key, col] of c.px) {
          const x = ox + f * 24 + (key % 24), y = oy + row * 32 + Math.floor(key / 24);
          const i = (y * width + x) * 4;
          data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
        }
      }
    });
  });
  return { width, height, data };
}
