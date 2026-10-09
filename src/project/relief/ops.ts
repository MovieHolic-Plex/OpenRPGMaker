// 높이 지형을 글로 짓는 명령(ops). AI 조수와 스크립트가 붓 대신 쓴다.
// 좌표는 [x,y], 북쪽이 y=0. 높이는 0~RELIEF_MAX_LEVEL 단. 뒤 op 가 앞 op 위에 덧칠한다.
import { hsh3 } from "./render";
import { RELIEF_MAX_LEVEL, copyGrid, type HeightGrid } from "./types";

export function vnoise(_W: number, _H: number, sc: number, seed: number) {
  const f = (x: number, y: number) => (hsh3(x, y, seed) % 1000) / 1000;
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const X = x / sc, Y = y / sc, x0 = Math.floor(X), y0 = Math.floor(Y), u = s(X - x0), v = s(Y - y0);
    return (f(x0, y0) * (1 - u) + f(x0 + 1, y0) * u) * (1 - v) + (f(x0, y0 + 1) * (1 - u) + f(x0 + 1, y0 + 1) * u) * v;
  };
}

export type ReliefRect = [number, number, number, number];
export type ReliefPoint = [number, number];
export type ReliefOp =
  | { op: "fill"; h: number }
  | { op: "rect"; rect: ReliefRect; h: number; mode?: "set" | "max" | "min" | "add" }
  | { op: "plateau"; rect: ReliefRect; h: number; rough?: number }
  | { op: "mountain"; at: ReliefPoint; peak: number; slope?: number; rough?: number }
  | { op: "ridge"; path: ReliefPoint[]; h: number; width?: number; slope?: number; rough?: number }
  | { op: "canyon"; path: ReliefPoint[]; width?: number; h?: number }
  | { op: "terraces"; rect: ReliefRect; from?: number; to?: number; toward?: "north" | "south" | "east" | "west" }
  | { op: "rough"; rect?: ReliefRect; amount?: number }
  | { op: "smooth"; rect?: ReliefRect; iter?: number };

export interface ReliefOpsSpec {
  size?: [number, number];
  seed?: number;
  ops?: ReliefOp[];
}

export const RELIEF_OPS_SPEC = `{"size":[W,H], "seed":1, "ops":[ ... ]}   좌표 [x,y], y=0 이 북쪽(화면 위). 높이 0~${RELIEF_MAX_LEVEL}단, 1단 = 벽 1칸.
fill      {"op":"fill","h":1}
rect      {"op":"rect","rect":[x0,y0,x1,y1],"h":4,"mode":"set|max|min|add"}      네모 절벽 (x1,y1 포함)
plateau   {"op":"plateau","rect":[x0,y0,x1,y1],"h":6,"rough":0.3}                  사각 안을 채우는 들쭉날쭉한 고원 (rough 0~1)
mountain  {"op":"mountain","at":[x,y],"peak":9,"slope":2,"rough":0.3}             봉우리. slope = 한 단 내려가는 칸 수 (1 가파름 ~ 3 완만)
ridge     {"op":"ridge","path":[[x,y],...],"h":7,"width":2,"slope":2}              능선 (선 따라 산)
canyon    {"op":"canyon","path":[[x,y],...],"width":3,"h":0}                        선 따라 파낸 골짜기 (폭 칸, 바닥 높이)
terraces  {"op":"terraces","rect":[x0,y0,x1,y1],"from":1,"to":6,"toward":"north|south|east|west"}   계단식 단 (toward 쪽이 높다)
rough     {"op":"rough","rect":[x0,y0,x1,y1],"amount":0.4}                          벽 가장자리를 먹어 들어가 거칠게
smooth    {"op":"smooth","rect":[x0,y0,x1,y1],"iter":1}                             주변 평균으로 다듬기
주의: 화면은 남쪽에서 비스듬히 본다. 북쪽이 남쪽보다 (거리 칸 수) 이상 낮으면 남쪽 땅에 가려 안 보인다.
      1칸씩 어긋난 계단은 45° 대각선 절벽으로, 2칸씩이면 곧은 벽+대각선으로 그려진다. 네모 모서리는 반 칸 깎인다.
      가로(동서로 뻗은) 골짜기는 남쪽 벽이 낮거나 폭이 깊이보다 넓어야 보인다. 1칸 폭 돌기·홈은 렌더가 깎는다.`;

/** base 가 있으면 그 격자 위에 ops 를 덧칠한다(크기는 base 를 따른다). 없으면 0 으로 채운 size 격자에서 시작. */
export function buildReliefOps(spec: ReliefOpsSpec, base?: HeightGrid): { h: HeightGrid; log: string[] } {
  const [W, H] = base?.length ? [base[0].length, base.length] : spec.size || [48, 32], seed = spec.seed || 1, log: string[] = [];
  const h: HeightGrid = base?.length ? copyGrid(base) : Array.from({ length: H }, () => new Array(W).fill(0));
  const cl = (v: number) => Math.max(0, Math.min(RELIEF_MAX_LEVEL, Math.round(v)));
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const rc = (r?: ReliefRect): ReliefRect => {
    const [a, b, c, d] = r || [0, 0, W - 1, H - 1];
    return [Math.max(0, Math.min(a, c)), Math.max(0, Math.min(b, d)), Math.min(W - 1, Math.max(a, c)), Math.min(H - 1, Math.max(b, d))];
  };
  const segDist = (px: number, py: number, path: ReliefPoint[]) => {
    let best = 1e9;
    if (path.length === 1) return Math.hypot(px - path[0][0], py - path[0][1]);
    for (let k = 0; k + 1 < path.length; k++) {
      const [ax, ay] = path[k], [bx, by] = path[k + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return best;
  };
  (spec.ops || []).forEach((o, n) => {
    const nz = vnoise(W, H, 4, seed * 31 + n * 7), nz2 = vnoise(W, H, 2, seed * 17 + n * 13);
    const put = (x: number, y: number, v: number, mode: string) => {
      if (!inb(x, y)) return;
      v = cl(v);
      const c = h[y][x];
      h[y][x] = mode === "set" ? v : mode === "min" ? Math.min(c, v) : mode === "add" ? cl(c + v) : Math.max(c, v);
    };
    switch (o.op) {
      case "fill": for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[y][x] = cl(o.h); break;
      case "rect": { const [a, b, c, d] = rc(o.rect); for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) put(x, y, o.h, o.mode || "set"); break; }
      case "plateau": {
        const [a, b, c, d] = rc(o.rect), cx = (a + c) / 2, cy = (b + d) / 2, rx = (c - a + 1) / 2, ry = (d - b + 1) / 2, r = o.rough ?? 0.3;
        for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
          const e = Math.max(Math.abs(x - cx) / rx, Math.abs(y - cy) / ry) * (1 - r * 0.25) + Math.hypot((x - cx) / rx, (y - cy) / ry) * r * 0.25;
          if (e + (nz(x, y) - 0.5) * r * 0.7 < 1) put(x, y, o.h, "max");
        }
        break;
      }
      case "mountain": case "ridge": {
        const path = o.op === "mountain" ? [o.at] : o.path, top = o.op === "mountain" ? o.peak : o.h;
        const sl = o.slope || 2, wd = o.op === "ridge" ? (o.width || 1) / 2 : 0, r = o.rough ?? 0.3;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Math.max(0, segDist(x, y, path) - wd) + (nz(x, y) - 0.5) * r * sl * 3;
          const v = top - Math.floor(Math.max(0, d) / sl);
          if (v > 0) put(x, y, v, "max");
        }
        break;
      }
      case "canyon": {
        const wd = (o.width || 3) / 2;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (segDist(x, y, o.path) + (nz2(x, y) - 0.5) * 0.8 <= wd) put(x, y, o.h || 0, "min");
        break;
      }
      case "terraces": {
        const [a, b, c, d] = rc(o.rect), dir = o.toward || "north", from = o.from ?? 1, to = o.to ?? 4, steps = Math.abs(to - from) + 1;
        const len = dir === "north" || dir === "south" ? d - b + 1 : c - a + 1;
        for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
          const t = dir === "north" ? d - y : dir === "south" ? y - b : dir === "east" ? x - a : c - x;
          const k = Math.min(steps - 1, Math.floor((t + (nz2(x, y) - 0.5) * 1.2) * steps / len));
          put(x, y, from + Math.sign(to - from) * Math.max(0, k), "set");
        }
        break;
      }
      case "rough": {
        const [a, b, c, d] = rc(o.rect), amt = o.amount ?? 0.4, src = copyGrid(h);
        for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
          let lo = src[y][x];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) lo = Math.min(lo, src[y + dy][x + dx]);
          if (lo < src[y][x] && nz2(x, y) < amt) h[y][x] = lo;
        }
        break;
      }
      case "smooth": {
        const [a, b, c, d] = rc(o.rect);
        for (let it = 0; it < (o.iter || 1); it++) {
          const src = copyGrid(h);
          for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
            let s = 0, k = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy)) { s += src[y + dy][x + dx]; k++; }
            h[y][x] = cl(s / k);
          }
        }
        break;
      }
      default: log.push(`op ${n}: 모르는 op "${(o as { op: string }).op}" — 건너뜀`);
    }
  });
  return { h, log };
}
