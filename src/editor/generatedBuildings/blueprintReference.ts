/**
 * 설계도 → 생성 기준 이미지(bp_ref.py 이식). 왼쪽 = 설계도(진한 점선 윤곽·옅은 칸 격자·입구·성문·처마선·지붕 칠),
 * 오른쪽 = 화풍 기준 집(같은 배율). 그림 모델은 왼쪽 윤곽 안에 오른쪽 화풍으로 한 채를 그린다.
 */
import { BODY_CELLS, type BuildingBlueprint, type ReferenceLayout, type StyleKit } from "./blueprintTypes.ts";
import { createRaster, type Raster, type Rgb } from "./raster.ts";

const MAGENTA: Rgb = [255, 0, 255];
const CELL_OUTLINE: Rgb = [228, 60, 228];
const GATE: Rgb = [8, 8, 10];
const BODY_LINE: Rgb = [20, 20, 20];
const HEAD_LINE: Rgb = [160, 160, 160];
const EAVE_LINE: Rgb = [0, 90, 255];
const ROOF_TINT: Rgb = [246, 196, 150];

export function buildBlueprintReference(bp: BuildingBlueprint, kit: StyleKit): { image: Raster; layout: ReferenceLayout } {
  const C = kit.canvas, K = kit.scale, T = kit.tile, cs = T * K;
  const m = bp.map, H = m.length, W = m[0]!.length;
  const stW = kit.style.w * K, stH = kit.style.h * K;
  const bw = W * cs, bh = H * cs;
  const x0 = Math.floor((C - (bw + 60 + stW)) / 2), y0 = Math.floor((C - bh) / 2);
  const img = createRaster(C, C);
  const put = (x: number, y: number, c: Rgb): void => {
    if (x < 0 || y < 0 || x >= C || y >= C) return;
    const i = (y * C + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  };
  const fill = (ax: number, ay: number, bx: number, by: number, c: Rgb): void => {
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) put(x, y, c);
  };
  const outline = (ax: number, ay: number, bx: number, by: number, c: Rgb): void => {
    for (let x = ax; x <= bx; x++) { put(x, ay, c); put(x, by, c); }
    for (let y = ay; y <= by; y++) { put(ax, y, c); put(bx, y, c); }
  };
  fill(0, 0, C - 1, C - 1, MAGENTA);
  const at = (x: number, y: number): string => (y >= 0 && y < H && x >= 0 && x < W ? m[y]![x]! : ".");
  const pasteScaled = (src: Uint8Array, sw: number, sh: number, ox: number, oy: number): void => {
    for (let y = 0; y < sh * K; y++) {
      for (let x = 0; x < sw * K; x++) {
        const s = (Math.floor(y / K) * sw + Math.floor(x / K)) * 4;
        if (src[s + 3]! > 0) put(ox + x, oy + y, [src[s]!, src[s + 1]!, src[s + 2]!]);
      }
    }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y), px = x0 + x * cs, py = y0 + y * cs;
      if (BODY_CELLS.includes(c) || c === "*") outline(px, py, px + cs - 1, py + cs - 1, CELL_OUTLINE);
      if (c === "D") {
        if (at(x, y + 1) === "D") fill(px, py, px + cs - 1, py + cs - 1, [0, 0, 0]);
        else {
          for (let yy = 0; yy < cs; yy++) {
            for (let xx = 0; xx < cs; xx++) {
              const s = (Math.floor(yy / K) * T + Math.floor(xx / K)) * 4;
              if (kit.doorTile[s + 3]! > 0) put(px + xx, py + yy, [kit.doorTile[s]!, kit.doorTile[s + 1]!, kit.doorTile[s + 2]!]);
            }
          }
        }
      }
      if (c === "G") fill(px, py, px + cs - 1, py + cs - 1, GATE);
    }
  }
  // PIL line(width=3): 선 양옆으로 1픽셀씩
  const dash = (ax: number, ay: number, bx: number, by: number, col: Rgb): void => {
    const L = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let t = 0; t < L; t += 16) {
      const e = Math.min(t + 8, L);
      const sx = ax + Math.floor((bx - ax) * t / L), sy = ay + Math.floor((by - ay) * t / L);
      const ex = ax + Math.floor((bx - ax) * e / L), ey = ay + Math.floor((by - ay) * e / L);
      if (sy === ey) fill(Math.min(sx, ex), sy - 1, Math.max(sx, ex), sy + 1, col);
      else fill(sx - 1, Math.min(sy, ey), sx + 1, Math.max(sy, ey), col);
    }
  };
  for (const [group, col] of [[BODY_CELLS, BODY_LINE], ["*", HEAD_LINE]] as const) {
    const inside = (x: number, y: number): boolean => group.includes(at(x, y));
    const body = (x: number, y: number): boolean => BODY_CELLS.includes(at(x, y));
    for (let y = 0; y <= H; y++) {
      for (let x = 0; x <= W; x++) {
        if (x < W && inside(x, y) !== inside(x, y - 1) && !(group === "*" && (body(x, y) || body(x, y - 1)))) {
          dash(x0 + x * cs, y0 + y * cs, x0 + (x + 1) * cs, y0 + y * cs, col);
        }
        if (y < H && inside(x, y) !== inside(x - 1, y) && !(group === "*" && (body(x, y) || body(x - 1, y)))) {
          dash(x0 + x * cs, y0 + y * cs, x0 + x * cs, y0 + (y + 1) * cs, col);
        }
      }
    }
  }
  const z = bp.zones;
  const zat = (x: number, y: number): string => (z && y >= 0 && y < H && x >= 0 && x < W ? z[y]![x]! : "-");
  if (z && bp.zoneTint) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (zat(x, y) === "R") fill(x0 + x * cs + 1, y0 + y * cs + 1, x0 + (x + 1) * cs - 2, y0 + (y + 1) * cs - 2, ROOF_TINT);
      }
    }
  }
  if (z) {
    const rw = (a: string, b: string): boolean => (a === "R" && b === "W") || (a === "W" && b === "R");
    for (let y = 0; y <= H; y++) {
      for (let x = 0; x <= W; x++) {
        if (x < W && rw(zat(x, y), zat(x, y - 1))) dash(x0 + x * cs, y0 + y * cs, x0 + (x + 1) * cs, y0 + y * cs, EAVE_LINE);
        if (y < H && rw(zat(x, y), zat(x - 1, y))) dash(x0 + x * cs, y0 + y * cs, x0 + x * cs, y0 + (y + 1) * cs, EAVE_LINE);
      }
    }
  }
  pasteScaled(kit.style.rgba, kit.style.w, kit.style.h, x0 + bw + 60, y0 + bh - stH);
  return { image: img, layout: { width: C, height: C, origin: [x0, y0], scale: K } };
}
