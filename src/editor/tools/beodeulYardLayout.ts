// 마당 먼저, 집은 그 테두리(2026-11-14 오너 «내가 보낸 사진들처럼 유려한 마을이었음 좋겠군»).
//
// 자동 배치가 집을 모이는 곳 둘레 8~19칸 고리에 흩어 문이 12~30칸 밖이나 다른 단에 섰다. 참고 마을은 흙 마당이 마을의 바닥이고
// 집 서너 채가 그 가장자리에 서서 문을 마당으로 낸다. 이 칩셋의 문은 남쪽 면에 있으므로 «마당을 본다» 는 것은:
//   - 마당(가운데 네모 + 좌우로 두세 줄 내려앉은 날개)의 북쪽 가장자리에 집 줄 — 문 앞이 마당에 닿는다. 날개 집은 가운데 줄보다 두세 줄 내려앉아 옆구리를 이룬다.
//   - 남는 집은 두세 채씩 무리(작은 앞마당을 같이 쓴다) — 첫 무리는 마당 남쪽에 등을 대고, 다음은 마당에서 가까운 자리에.
// 여기서는 자리만 고른다. 놓을 수 있는지(집 그림 크기·단·물·문 앞)와 길이 닿는지는 시공기(beodeulVillage codePlan)가 env 로 답한다.
// 마당 후보 몇 곳(단마다 하나 + 둘째)을 실제로 앉혀 보고, 예전 고리 배치보다 길·문·집 수가 나빠지지 않는 것 가운데 마당에 문을 낸 집이 가장 많은 것을 고른다.
import type { CodeTerrain } from "./beodeulTerrainGen";
import type { HouseKind, LayoutPoint } from "./beodeulCodeLayout";

export interface YardRect { x0: number; y0: number; x1: number; y1: number }
/** 자리 요청: corner 가 있으면 (x,y)는 건물 아랫줄의 왼쪽(sw)·오른쪽(se) 모서리, 없으면 건물 가운데. maxR 을 주면 그 고리 안에서만 찾고 못 찾아도 실패로 적지 않는다. */
export interface YardWant extends LayoutPoint { corner?: "sw" | "se"; maxW?: number; maxR?: number; /** 이 단에만 앉힌다. */ tier?: number; /** 집 크기 무리(좁은 터에서는 small). */ kind?: HouseKind }
export interface YardSeat { x: number; y: number; w: number; h: number; front: LayoutPoint }
export interface YardPlan extends YardRect {
  level: number;
  /** 우물 자리 — 마당 안, 한가운데가 아니다(판석 광장 마을은 한가운데). */
  gather: LayoutPoint;
  /** 마당 날개(가운데 네모 옆으로 내려앉은 덩이). */
  lobes: YardRect[];
  /** 길가 무리의 앞마당. */
  courts: YardRect[];
  /** 문 앞에서 마당·앞마당까지 뻗은 칸(문 앞 칸 포함). */
  stubs: number[];
  /** 마당 칸 전부(칸 번호 y*W+x: 가운데 네모 · 날개 · 길가 앞마당 · 문 앞으로 뻗은 칸) — 바닥을 칠하는 쪽(beodeulCommons)이 이 칸을 흙 마당으로 칠한다. */
  cells: number[];
  /** 마당·앞마당에 문을 낸 건물 — at: yard(가운데 네모·날개) · court(길가 앞마당). */
  frame: (YardSeat & { role: "anchor" | "house"; at: "yard" | "court" })[];
  /** 집 뒤(마당에서 먼 쪽) 밭 자리. */
  fields: LayoutPoint[];
  /** 숲 자리(마을 몸 밖 빈 땅의 가운데)와 그 빈 칸 — 시공기가 밭·소품을 놓는 동안 비워 두었다가 숲 덩이 씨앗으로 쓴다. */
  woods: LayoutPoint[];
  woodCells: number[];
  /** 숲이 서는 마을(강가·포구·설원)인가 — 밭은 마을 몸(건물·마당에서 여섯 칸 안)에만 서고 그 바깥 띠는 숲의 몫이다. */
  woodsFirst: boolean;
  /** 마당에서 떨어진 터(강 건너 bank · 다른 단 tier)에 남긴 집·일터의 문 앞 칸 — 예전 고리 배치가 그 터를 썼을 때만. */
  apart: (LayoutPoint & { role: "house" | "work"; why: "bank" | "tier" })[];
}

export interface YardEnv {
  /** 빈 땅인가(건물·물·비워 둔 마당이 아니다). */
  free: (c: number) => boolean;
  /** 지금 건물이 앉아 있는 칸인가(자리 잡아 둔 건물 포함). */
  built: (c: number) => boolean;
  /** 칸을 마당으로 비워 둔다(집이 앉지 않는다). */
  hold: (cells: number[]) => void;
  /** 예전 고리 자리에 잡아 둔 여관·일터·집을 걷는다(높은 곳 건물은 그대로). */
  clear: () => void;
  /** 지금 상태를 적어 두고, 부르면 그 상태로 되돌리는 함수를 돌려준다. */
  mark: () => () => void;
  seat: (role: "anchor" | "house" | "work", want: YardWant) => YardSeat | null;
  /** 높은 곳 건물을 걷고 (x,y) 가까이에 다시 앉힌다 — 못 앉히면 false(걷은 채로 둔다, 부른 쪽이 mark 로 되돌린다). */
  reseatLandmark: (p: LayoutPoint) => boolean;
  /** 지금 앉힌 건물로 길이 나는가: 모이는 곳 g 에서 큰길이 닿는 맵 가장자리 수 · 문 앞에서 길망(또는 닿은 마당 칸 on)까지 길이 나는 집 수 · 여관·일터 수 · 높은 곳 건물 · 길이 단을 건너는 횟수(계단 수). */
  routes: (g: number, on: ReadonlySet<number>) => { exits: number; houses: number; others: number; landmark: boolean; climbs: number };
  rand: () => number;
}

const rectCells = (r: YardRect, W: number): number[] => { const out: number[] = []; for (let y = r.y0; y <= r.y1; y += 1) for (let x = r.x0; x <= r.x1; x += 1) out.push(y * W + x); return out; };

/** 마당 칸 전부를 네모들에서 다시 센다(앉히는 동안 쓴다 — 다 앉힌 뒤에는 plan.cells). */
function yardCells(p: Omit<YardPlan, "cells">, W: number): number[] {
  return [...new Set([...rectCells(p, W), ...p.lobes.flatMap((l) => rectCells(l, W)), ...p.courts.flatMap((l) => rectCells(l, W)), ...p.stubs])];
}

/** 씨앗 칸에서 r 칸 안(대각선 포함)인 칸 — 마을 몸(건물·마당 곁)을 가린다. */
export function nearCells(W: number, H: number, seeds: Iterable<number>, r: number): Uint8Array {
  const out = new Uint8Array(W * H); let edge: number[] = [];
  for (const c of seeds) if (!out[c]) { out[c] = 1; edge.push(c); }
  for (let k = 0; k < r; k += 1) {
    const next: number[] = [];
    for (const c of edge) { const x = c % W, y = (c - x) / W;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (!out[n]) { out[n] = 1; next.push(n); } } }
    edge = next;
  }
  return out;
}

/** 마당 칸을 잇닿은 덩이로 나눈다 — first 칸이 든 덩이가 맨 앞(길망은 그 덩이에서 시작하고 나머지 덩이는 길로 잇는다). */
export function yardParts(cells: readonly number[], W: number, first: number): number[][] {
  const left = new Set(cells); const parts: number[][] = [];
  for (const c0 of cells) {
    if (!left.has(c0)) continue;
    const part = [c0]; left.delete(c0);
    for (let h = 0; h < part.length; h += 1) { const c = part[h]!, x = c % W; for (const n of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) if (left.has(n)) { left.delete(n); part.push(n); } }
    if (part.includes(first)) parts.unshift(part); else parts.push(part);
  }
  return parts;
}

type Cand = { r: YardRect; s: number; lobes: YardRect[]; level: number };

/**
 * 마당 후보: 한 단 마른 네모이고, 북쪽에 집 줄이 설 깊이가 있고, 옆으로 날개를 낼 수 있는 자리. 단마다 가장 좋은 하나 + 그 단의 둘째(첫째에서 9칸 넘게 떨어진 것).
 * 땅이 정한다 — 물가 좁은 둑에 모이는 곳이 잡혔어도 마당은 집이 설 수 있는 터로 간다. plaza(판석 광장 마을)는 광장 크기의 네모(날개는 광장 옆 맨땅 앞마당).
 * mode: 0 보통 · 1 좁은 터용 작은 마당만 · 2 얕은 단(여덟 줄 안팎 다랑이)용 띠 마당 — 두 줄 깊이의 긴 흙 띠와 그 북쪽에 작은 집 한 줄.
 */
function yardCandidates(t: CodeTerrain, g: LayoutPoint, level: number, houses: number, rand: () => number, free: (c: number) => boolean, opts: { plaza?: { rx: number; ry: number }; wetOk?: boolean }, mode: 0 | 1 | 2): Cand[] {
  const { W, H } = t;
  const inMap = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 2;
  const search = (L: number, sizes: [number, number][]): Cand[] => {
    const dry = (x: number, y: number) => inMap(x, y) && t.levels[y * W + x] === L && !t.water[y * W + x] && free(y * W + x);
    const sit = (x: number, y: number) => dry(x, y) || (!!opts.wetOk && inMap(x, y) && t.water[y * W + x] === 2);
    // 마른 칸 누적 합(네모 안 마른 칸 수를 한 번에) · 위로 이어지는 집 자리 깊이
    const P = new Int32Array((W + 1) * (H + 1)), up = new Int8Array(W * H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      P[(y + 1) * (W + 1) + x + 1] = P[y * (W + 1) + x + 1]! + P[(y + 1) * (W + 1) + x]! - P[y * (W + 1) + x]! + (dry(x, y) ? 1 : 0);
      up[y * W + x] = sit(x, y) ? Math.min(11, 1 + (y > 0 ? up[(y - 1) * W + x]! : 0)) : 0;
    }
    const count = (r: YardRect) => { const x0 = Math.max(0, r.x0), y0 = Math.max(0, r.y0), x1 = Math.min(W - 1, r.x1), y1 = Math.min(H - 1, r.y1); return x1 < x0 || y1 < y0 ? 0 : P[(y1 + 1) * (W + 1) + x1 + 1]! - P[y0 * (W + 1) + x1 + 1]! - P[(y1 + 1) * (W + 1) + x0]! + P[y0 * (W + 1) + x0]!; };
    const allDry = (r: YardRect) => r.x0 >= 1 && r.y0 >= 1 && r.x1 < W - 1 && r.y1 < H - 2 && count(r) === (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    /** 줄 y 위로 깊이 need 이상인 칸이 x0..x1 에서 가장 길게 이어진 폭. */
    const run = (x0: number, x1: number, y: number, need: number) => { let best = 0, cur = 0; for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x += 1) { if (up[y * W + x]! >= need) { cur += 1; best = Math.max(best, cur); } else cur = 0; } return best; };
    const out: Cand[] = [];
    for (const [w, h] of sizes) for (let y0 = 8; y0 + h < H - 3; y0 += 1) for (let x0 = 2; x0 + w < W - 2; x0 += 1) {
      const r = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
      if (!allDry(r)) continue;
      const north = run(r.x0 - 1, r.x1 + 1, r.y0 - 1, mode === 2 ? 6 : 8);
      // 날개: 가운데 네모 옆으로 두세 줄 내려앉은 덩이 — 그 북쪽 가장자리에도 집이 선다
      const lobes: YardRect[] = [];
      for (const side of [-1, 1] as const) {
        let pick: { l: YardRect; s: number } | null = null;
        for (const off of [3, 2, 4]) for (const lw of [6, 7, 8, 9, 10, 11]) for (const ext of [0, 1]) {
          const l = side < 0 ? { x0: r.x0 - lw, y0: r.y0 + off, x1: r.x0 - 1, y1: r.y1 + ext } : { x0: r.x1 + 1, y0: r.y0 + off, x1: r.x1 + lw, y1: r.y1 + ext };
          if (l.y1 - l.y0 < 1 || !allDry(l)) continue;
          const n = run(side < 0 ? l.x0 - 1 : l.x0 + 1, side < 0 ? l.x1 - 1 : l.x1 + 1, l.y0 - 1, 7);
          if (n < 5) continue;
          const s = Math.min(n, 12) + (off === 3 ? 1 : 0) + rand() * 1.5;
          if (!pick || s > pick.s) pick = { l, s };
        }
        if (pick) lobes.push(pick.l);
      }
      if (north < 5 && !lobes.length) continue;
      // 둘레 12칸 안의 같은 단 마른 땅(길가 무리·일터가 설 자리) · 마당 남쪽 10줄(남쪽 무리가 등을 대고 설 자리 — 마당이 터의 맨 아래에 붙지 않게)
      const roomy = count({ x0: r.x0 - 12, y0: r.y0 - 12, x1: r.x1 + 12, y1: r.y1 + 12 }) / 4 + count({ x0: r.x0 - 2, y0: r.y1 + 2, x1: r.x1 + 2, y1: r.y1 + 11 }) / 3;
      const d = Math.hypot(Math.max(r.x0 - g.x, 0, g.x - r.x1), Math.max(r.y0 - g.y, 0, g.y - r.y1));
      const s = 3 * Math.min(north, 16) + (north >= 9 ? 12 : 0) + (north >= 14 ? 8 : 0) + 14 * lobes.length + 0.12 * roomy - 1.5 * Math.min(d, 24) - 0.25 * Math.hypot((r.x0 + r.x1) / 2 - g.x, (r.y0 + r.y1) / 2 - g.y) + rand() * 2;
      out.push({ r, s, lobes, level: L });
    }
    return out.sort((a, b) => b.s - a.s);
  };
  const sizes: [number, number][] = [];
  if (opts.plaza) sizes.push([2 * Math.ceil(opts.plaza.rx) + 1, 2 * Math.ceil(opts.plaza.ry) + 1]);
  else for (const w of houses <= 4 ? [7, 8, 9] : houses <= 6 ? [8, 9, 10] : [9, 10, 11]) for (const h of houses <= 4 ? [5, 6] : houses <= 6 ? [5, 6, 7] : [6, 7, 8]) sizes.push([w, h]);
  const small: [number, number][] = opts.plaza ? [[9, 5], [7, 5]] : mode === 2 ? [[14, 2], [11, 2], [9, 2]] : [[6, 4], [5, 4], [5, 3]];
  const tiers = [level, ...[...new Set(t.areas.filter((a) => a.inner >= 12).map((a) => a.level))].filter((L) => L !== level)].slice(0, 4);
  const out: Cand[] = [];
  for (const L of tiers) {
    let list = mode ? [] : search(L, sizes); if (!list.length) list = search(L, small);
    if (!list.length) continue;
    // 단마다 서로 9칸 넘게 떨어진 것 셋까지(모이는 곳의 단) · 둘까지(다른 단)
    const picked: Cand[] = [];
    for (const c of list) { if (picked.length >= (L === level ? 3 : 2)) break; if (picked.every((q) => Math.hypot((c.r.x0 + c.r.x1 - q.r.x0 - q.r.x1) / 2, (c.r.y0 + c.r.y1 - q.r.y0 - q.r.y1) / 2) > 9)) picked.push(c); }
    out.push(...picked);
  }
  return out;
}

type YardAsk = { houses: number; anchor: boolean; work: boolean; loose: readonly LayoutPoint[]; wide: boolean; plaza?: { rx: number; ry: number }; wetOk?: boolean; /** 숲 덩이가 서는 마을(강가·포구·설원) — 숲 몫을 남긴다. */ woods?: boolean; /** 작은 집만(좁은 터). */ compact?: boolean;
  /** 좋은 순서로 몇째 마당을 쓸까(0 = 가장 좋은 것) — 고른 마당이 뒤 단계(계단 놓기)에서 깨지면 시공기가 다음 것으로 다시 짓는다. */ skip?: number;
  /** 예전 고리 배치가 앉힌 집·일터(건물 가운데 · 문 앞 칸의 마른 땅 덩이와 단) — 마당과 다른 덩이·단에 있던 것은 터마다 하나를 거기에 남긴다. */
  apart?: readonly (LayoutPoint & { role: "house" | "work"; bank: number; level: number })[];
  /** 칸의 마른 땅 덩이 번호(강·바다가 가른다). */ bankOf?: (c: number) => number;
  /** 높은 곳 건물이 선 덩이와 단 — 그 터는 이미 쓰이고 있다. */ landmarkOn?: { bank: number; level: number } };

/** 후보 마당 하나에 건물을 앉힌다: 여관이 가운데 네모 북쪽 줄, 집은 날개 북쪽 줄과 여관 곁, 남는 집은 무리, 일터·밭은 마을 몸 바깥. */
function seatYard(t: CodeTerrain, cand: Cand, g: LayoutPoint, env: YardEnv, want: YardAsk): { plan: YardPlan; houses: YardSeat[] } {
  const { W, H } = t;
  const r = cand.r, w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
  // 우물은 마당의 한쪽 삼분 자리(가운데 축을 피한다) — 원래 모이는 곳에 가까운 쪽
  const gx = want.plaza ? Math.round((r.x0 + r.x1) / 2) : (g.x <= (r.x0 + r.x1) / 2 ? r.x0 + Math.max(1, Math.round(w * 0.28)) : r.x1 - Math.max(1, Math.round(w * 0.28)));
  const gy = want.plaza ? Math.round((r.y0 + r.y1) / 2) : r.y0 + Math.min(h - 2, Math.max(2, Math.round(h * 0.6)));
  const plan: YardPlan = { ...r, level: cand.level, gather: { x: gx, y: gy }, lobes: cand.lobes, courts: [], stubs: [], cells: [], frame: [], fields: [], woods: [], woodCells: [], woodsFirst: !!want.woods, apart: [] };
  const inMap = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 2;
  /** 빈 마른 칸(L 단). */
  const freeDry = (x: number, y: number, L: number) => inMap(x, y) && t.levels[y * W + x] === L && !t.water[y * W + x] && env.free(y * W + x);
  const yard = new Set(yardCells(plan, W));
  env.hold([...yard]);
  const houses: YardSeat[] = [];
  /** 문 앞에서 마당까지: 아래로 내려와 마당 줄에 닿고, 문이 마당 폭 밖이면 그 줄을 따라 마당까지. */
  const tongue = (f: LayoutPoint, to: YardRect) => {
    const add: number[] = [];
    let x = f.x, y = f.y;
    for (let n = 0; n < 12; n += 1) {
      const c = y * W + x;
      if (yard.has(c)) break;
      if (!inMap(x, y) || t.water[c] || t.levels[c] !== t.levels[f.y * W + f.x]) return;
      add.push(c);
      if (y < to.y0) y += 1; else if (x < to.x0) x += 1; else if (x > to.x1) x -= 1; else break;
    }
    for (const c of add) { yard.add(c); plan.stubs.push(c); }
    env.hold(add.filter((c) => env.free(c)));
  };
  /** 마당 덩이 to 의 북쪽 가장자리 집 줄 — next() 한 번에 한 채, from 에서 dir 쪽으로 이어 앉힌다. */
  const line = (to: YardRect, from: number, dir: 1 | -1, limit: number, at: "yard" | "court") => {
    let cursor = from, n = 0, miss = 0;
    return { made: 0, next(role: "anchor" | "house"): boolean {
      while (miss < 2) {
        const room = dir > 0 ? limit - cursor + 1 : cursor - limit + 1;
        if (room < 4) { miss = 2; break; }
        // 줄이 자로 그은 선이 되지 않게 한 칸씩 번갈아 물러앉힌다(여관은 마당에 바로)
        const stag = role === "anchor" ? 0 : (n + (env.rand() < 0.5 ? 1 : 0)) % 2;
        const sp = env.seat(role, { x: cursor, y: to.y0 - 1 - stag, corner: dir > 0 ? "sw" : "se", maxW: room, maxR: 1, ...(want.compact && role === "house" ? { kind: "small" as const } : {}) });
        n += 1;
        if (!sp) { miss += 1; cursor += dir * 2; continue; }
        if (role === "house") houses.push(sp);
        plan.frame.push({ ...sp, role, at }); tongue(sp.front, to); this.made += 1;
        cursor = dir > 0 ? sp.x + sp.w + 1 + (env.rand() < 0.5 ? 1 : 0) : sp.x - 2 - (env.rand() < 0.5 ? 1 : 0);
        return true;
      }
      return false;
    } };
  };
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  let left = want.houses;
  // 떨어진 터(2026-11-15 감독 «집을 마당으로 모으는 것은 맞다, 강 건너와 윗단의 쓰임을 잃는 것은 아니다»): 예전 고리 배치가 마당과 다른 마른 땅 덩이(강 건너)나
  // 다른 단에 집·일터를 두었으면 하나는 거기에 남긴다 — 강 건너 먼저, 일터 먼저(집은 마당에 남는다), 마을에 하나만(둘을 보내면 떨어진 집과 그 골목이 집 곁 빈 땅을 써서 탐침 30판의 밭이 64 에서 49 로 줄었다). 집은 마당 몫 셋(집이 셋이면 둘)이 남을 때만 보낸다.
  // 강 건너에 문이 서면 시공기가 그 문 앞까지 골목을 내고 물을 건너는 자리에 다리를 놓는다. 높은 곳 건물이 이미 선 터는 쓰이고 있는 터다.
  let workSeated = false;
  // 떨어진 터의 건물이 제 단의 목을 막으면 안 된다(탐침 산골 씨앗 24: 윗단 움푹한 터의 목에 집이 서서 그 뒤 66칸이 못 닿는 칸이 됐다 — 기준은 13칸).
  // 건물을 앉히기 전에 문 앞에서 같은 단 마른 빈 땅으로 번져 닿던 칸 가운데, 앉힌 뒤 못 닿게 된 칸이 열 칸을 넘으면 그 자리는 쓰지 않는다.
  const cutsTier = (sp: YardSeat): boolean => {
    const f = sp.front.y * W + sp.front.x, L = t.levels[f];
    const inside = (c: number) => { const x = c % W, y = (c - x) / W; return x >= sp.x && x < sp.x + sp.w && y >= sp.y && y < sp.y + sp.h; };
    const flood = (through: boolean): Uint8Array => {
      const seen = new Uint8Array(W * H), q = [f]; seen[f] = 1;
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = ny * W + nx;
          if (seen[n] || t.levels[n] !== L || t.water[n] || (env.built(n) && !(through && inside(n)))) continue; seen[n] = 1; q.push(n); } }
      return seen;
    };
    const before = flood(true), after = flood(false);
    let lost = 0; for (let c = 0; c < W * H; c += 1) if (before[c] && !after[c] && !inside(c)) lost += 1;
    return lost > 10;
  };
  if (want.apart?.length && want.bankOf && !want.wetOk) {
    const yb = want.bankOf(gy * W + gx), cap = 1, done = new Set<string>();
    for (const p of [...want.apart].sort((a, b) => Number(a.bank === yb) - Number(b.bank === yb) || Number(a.role === "house") - Number(b.role === "house"))) {
      if (plan.apart.length >= cap) break;
      const far = p.bank !== yb, key = far ? `b${p.bank}` : `l${p.level}`;
      if ((!far && p.level === plan.level) || done.has(key)) continue;
      if (want.landmarkOn && want.landmarkOn.bank === p.bank && (far || want.landmarkOn.level === p.level)) continue;
      if (p.role === "house" ? left - 1 < Math.min(3, want.houses - 1) : workSeated || !want.work) continue;
      const undo = env.mark();
      const sp = env.seat(p.role, { x: p.x, y: p.y, maxR: 6, tier: p.level });
      if (!sp || want.bankOf(sp.front.y * W + sp.front.x) !== p.bank || cutsTier(sp)) { undo(); continue; }
      done.add(key); plan.apart.push({ x: sp.front.x, y: sp.front.y, role: p.role, why: far ? "bank" : "tier" });
      if (p.role === "house") { houses.push(sp); left -= 1; } else workSeated = true;
    }
  }
  // 가운데 줄은 네모 폭보다 한 칸씩 넘쳐도 된다(여관은 폭 8~9). 여관이 줄의 어느 끝에 서는가는 씨앗이 고른다 — 집은 여관이 남긴 자리에 이어 선다
  const mainLine = env.rand() < 0.5 ? line(r, r.x0 - 1, 1, r.x1 + 1, "yard") : line(r, r.x1 + 1, -1, r.x0 - 1, "yard");
  if (want.anchor && !mainLine.next("anchor")) env.seat("anchor", { x: Math.round(cx), y: r.y0 - 6, maxR: 9 });
  const lobeLines = plan.lobes.map((l) => (l.x1 < r.x0 ? line(l, l.x1, -1, l.x0 - 2, "yard") : line(l, l.x0, 1, l.x1 + 2, "yard")));
  // 테두리 집은 셋까지(날개마다 하나 → 여관 곁 → 날개 둘째) — 넷째부터는 무리로 가서 마당 남쪽을 막는다(한 줄로 늘어서지 않게)
  let framed = 0;
  for (let round = 0; round < 2; round += 1) for (const ln of [...lobeLines, mainLine]) { if (left > 0 && framed < 3 && ln.made < (ln === mainLine ? 3 : 2) && ln.next("house")) { left -= 1; framed += 1; } }
  // 길가 무리: 앞마당 하나와 그 북쪽 줄에 두세 채. 첫 무리는 마당 남쪽(등을 마당에 대고 서서 마당의 남쪽 테두리가 된다), 다음은 마당에서 가까운 자리.
  // 마당의 단이 먼저, 자리가 없으면 다른 단에도(터가 좁은 언덕 마을).
  const yardBottom = Math.max(r.y1, ...plan.lobes.map((l) => l.y1));
  for (let k = 0; k < 4 && left > 0; k += 1) {
    let made = 0;
    for (let size = left <= 3 ? left : Math.min(3, Math.ceil(left / 2)); size >= 1 && !made; size -= 1) {
      const cw = want.compact ? (size === 1 ? 5 : size === 2 ? 10 : 14) : size === 1 ? 6 : size === 2 ? 11 : 15, ch = 2;
      let best: { r: YardRect; s: number } | null = null;
      for (let y0 = 8; y0 + ch < H - 3; y0 += 1) for (let x0 = 2; x0 + cw < W - 2; x0 += 1) {
        const L = t.levels[y0 * W + x0]!;
        const d = Math.hypot((x0 + cw / 2 - cx) * (want.wide ? 0.8 : 1.25), (y0 - cy) * (want.wide ? 1.25 : 0.8));
        if (d > 26 || !freeDry(x0, y0, L) || !freeDry(x0 + cw - 1, y0 - 7, L)) continue;
        let ok = true;
        for (let y = y0 - 7; y <= y0 + ch && ok; y += 1) for (let x = x0 - 1; x <= x0 + cw; x += 1) if (!freeDry(x, y, L)) { ok = false; break; }
        if (!ok) continue;
        // 마당 바로 남쪽(집 줄의 등이 마당 아랫줄에서 한두 칸)이면 마당을 둘러싼다
        const south = L === plan.level && y0 - 7 - yardBottom >= 1 && y0 - 7 - yardBottom <= 3 && x0 + cw > r.x0 - 3 && x0 < r.x1 + 3;
        const s = -d + (south && !plan.courts.length ? 14 : 0) - (L === plan.level ? 0 : 12) + env.rand() * 1.5;
        if (!best || s > best.s) best = { r: { x0, y0, x1: x0 + cw - 1, y1: y0 + ch - 1 }, s };
      }
      if (!best) continue;
      const cells = rectCells(best.r, W);
      env.hold(cells); for (const c of cells) yard.add(c);
      const ln = line(best.r, best.r.x0, 1, best.r.x1, "court");
      while (ln.made < size && left > 0 && ln.next("house")) left -= 1;
      made = ln.made;
      if (made) plan.courts.push(best.r);
    }
    if (!made) break;
  }
  // 남은 집은 마당에서 가장 가까운 놓을 수 있는 자리(같은 단 먼저) — 마을 몸이 한곳에 모인다. 그래도 남으면 예전 고리 자리(집 수가 줄지 않게).
  for (const tier of [plan.level, undefined]) while (left > 0) {
    const sp = env.seat("house", { x: Math.round(cx), y: yardBottom + 6, maxR: tier === undefined ? 22 : 16, ...(tier === undefined ? {} : { tier }) });
    if (!sp) break;
    houses.push(sp); left -= 1;
  }
  for (const p of want.loose) { if (left <= 0) break; const sp = env.seat("house", { x: p.x, y: p.y, maxR: 9 }); if (sp) { houses.push(sp); left -= 1; } }
  // 일터·밭은 집 뒤(마당에서 먼 쪽): 마을 몸의 동·서 바깥, 집 줄 북쪽 뒤, 남쪽
  const all = [...houses, ...plan.frame];
  const x0 = Math.min(r.x0, ...all.map((s) => s.x)), x1 = Math.max(r.x1, ...all.map((s) => s.x + s.w - 1));
  const y0 = Math.min(r.y0, ...all.map((s) => s.y)), y1 = Math.max(r.y1, ...all.map((s) => s.y + s.h));
  const clamp = (p: LayoutPoint): LayoutPoint => ({ x: Math.max(6, Math.min(W - 7, Math.round(p.x))), y: Math.max(6, Math.min(H - 7, Math.round(p.y))) });
  const behind = [{ x: x0 - 8, y: cy }, { x: x1 + 8, y: cy }, { x: cx + (env.rand() < 0.5 ? -6 : 6), y: y0 - 6 }, { x: cx, y: y1 + 8 }].map(clamp);
  if (env.rand() < 0.5) [behind[0], behind[1]] = [behind[1]!, behind[0]!];
  let workAt = -1;
  if (want.work && !workSeated) {
    workAt = behind.findIndex((p) => !!env.seat("work", { ...p, maxR: 4 }));
    if (workAt < 0 && env.seat("work", { ...behind[0]!, maxR: 12 })) workAt = 0;
  }
  plan.fields = behind.filter((_, i) => i !== workAt).slice(0, 2);
  // 숲이 서는 마을(2026-11-15 감독: «숲이 먼저다, 마을 몸 바깥에서» · «밭은 마을 몸 안과 그 가장자리에 작게 여럿»).
  // 집을 한곳에 모으자 남는 땅을 밭·기물·길이 잘게 갈라 숲 덩이가 설 자리를 잃었다(탐침 30판 숲 칸 4673 → 3787, 숲 없는 판 6 → 8).
  if (want.woods) {
    // 밭 자리: 집마다 마당 반대쪽 옆구리(없으면 뒤, 그다음 마당 쪽 옆구리)에 7×5 빈 한 단 땅이 있으면 그 가운데 — 넷까지, 서로 떨어뜨린다.
    const room = (x: number, y: number) => {
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
        if (!inMap(x + dx, y + dy)) return false;
        const c = (y + dy) * W + x + dx; if (!env.free(c) || t.water[c] || t.levels[c] !== t.levels[y * W + x]) return false;
      }
      return true;
    };
    const beside: LayoutPoint[] = [];
    for (const s of all) {
      if (beside.length >= 4) break;
      const west = s.x + s.w / 2 < cx, my = s.y + Math.floor(s.h / 2);
      const p = [{ x: west ? s.x - 5 : s.x + s.w + 4, y: my }, { x: s.x + Math.floor(s.w / 2), y: s.y - 4 }, { x: west ? s.x + s.w + 4 : s.x - 5, y: my }]
        .find((q) => room(q.x, q.y) && beside.every((o) => Math.abs(o.x - q.x) >= 8 || Math.abs(o.y - q.y) >= 6));
      if (p) beside.push(p);
    }
    plan.fields = beside;
    // 숲 몫: 마당 둘레와 건물 곁을 뺀 빈 마른 한 단 땅이 가장 넓은 창(13×7) 둘 — 시공기가 기물을 놓는 동안 비워 두었다가 숲 씨앗으로 쓴다.
    const wins: { x: number; y: number; cells: number[] }[] = [];
    for (let y = 3; y < H - 3; y += 1) for (let x = 6; x < W - 6; x += 2) {
      if (x >= r.x0 - 10 && x <= r.x1 + 10 && y >= r.y0 - 7 && y <= r.y1 + 7) continue;
      if (all.some((s) => s.x - 1 <= x + 6 && s.x + s.w >= x - 6 && s.y - 1 <= y + 3 && s.y + s.h >= y - 3)) continue;
      if (plan.fields.some((p) => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 6)) continue;
      const L = t.levels[y * W + x], cells: number[] = [];
      for (let dy = -3; dy <= 3; dy += 1) for (let dx = -6; dx <= 6; dx += 1) { const c = (y + dy) * W + x + dx; if (env.free(c) && !t.water[c] && t.levels[c] === L) cells.push(c); }
      if (cells.length >= 64) wins.push({ x, y, cells });
    }
    wins.sort((a, b) => b.cells.length - a.cells.length || a.y - b.y || a.x - b.x);
    for (const w0 of wins) {
      if (plan.woods.length >= 2) break;
      if (plan.woods.some((q) => Math.abs(q.x - w0.x) < 16 && Math.abs(q.y - w0.y) < 10)) continue;
      plan.woods.push({ x: w0.x, y: w0.y }); plan.woodCells.push(...w0.cells);
    }
  }
  plan.cells = yardCells(plan, W);
  return { plan, houses };
}

/**
 * 마당 먼저 배치. 부를 때는 예전 고리 배치가 이미 앉아 있다(견줄 기준). 후보 마당마다 앉혀 보고, 큰길·문 길·집 수·높은 곳 건물의 길이 기준보다 나빠지지 않는 것 가운데
 * 마당에 문을 낸 집이 가장 많은 것으로 남긴다(want.skip 째). 셋(집이 넷보다 적으면 전부)에 못 미치면 작은 마당·작은 집으로, 그래도 못 미치면 띠 마당으로 더 본다. 맞는 것이 없으면 기준 그대로 두고 null.
 */
export function layYardVillage(t: CodeTerrain, g: LayoutPoint, level: number, env: YardEnv, want: YardAsk): YardPlan | null {
  const { W, H } = t;
  const start = env.mark();
  const base = env.routes(g.y * W + g.x, new Set());
  env.clear();
  const cleared = env.mark();
  type Routes = ReturnType<YardEnv["routes"]>;
  /** 높은 곳 건물에 길이 닿지 않으면(제 몸이 터의 목을 막은 자리) 높은 단의 다른 터로 옮겨 본다. */
  const withLandmark = (gi: number, on: ReadonlySet<number>, now: Routes): Routes => {
    if (now.landmark) return now;
    const keep = env.mark();
    for (const a of [...t.areas].filter((a0) => a0.inner >= 20 && a0.level > 0).sort((a0, b0) => b0.level - a0.level || b0.inner - a0.inner).slice(0, 4))
      for (const p of [{ x: a.cx, y: a.cy }, { x: Math.round((a.x0 + a.cx) / 2), y: a.cy }, { x: Math.round((a.x1 + a.cx) / 2), y: a.cy }]) {
        keep();
        if (!env.reseatLandmark(p)) continue;
        const got = env.routes(gi, on);
        if (got.landmark && got.exits >= now.exits && got.houses >= now.houses && got.others >= now.others) return got;
      }
    keep();
    return now;
  };
  // 마당 둘레의 건물이 마당 단의 목을 막으면 그 마당은 쓰지 않는다(탐침 산골 씨앗 24: 여관이 윗단 움푹한 터의 목에 서서 그 뒤 60칸 남짓이 못 닿는 칸이 됐다 — 기준은 13칸).
  // 건물이 없다고 치고 우물에서 같은 단 마른 땅으로 번져 닿던 칸 가운데, 건물이 선 뒤 못 닿게 된 칸 수(여관·일터·높은 곳 건물까지 지금 앉은 건물 전부).
  const cutByBuildings = (plan: YardPlan): number => {
    const L = plan.level, f = plan.gather.y * W + plan.gather.x;
    const flood = (through: boolean): Uint8Array => {
      const seen = new Uint8Array(W * H), q = [f]; seen[f] = 1;
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx;
          if (seen[n] || t.levels[n] !== L || t.water[n] || (!through && env.built(n))) continue; seen[n] = 1; q.push(n); } }
      return seen;
    };
    const before = flood(true), after = flood(false);
    let lost = 0; for (let c = 0; c < W * H; c += 1) if (before[c] && !after[c] && !env.built(c)) lost += 1;
    return lost;
  };
  const good: { plan: YardPlan; s: number; near: number; goal: number; keep: () => void }[] = [];
  for (const mode of [0, 1, 2] as const) {
    if (mode && (want.plaza || good.some((b) => b.near >= b.goal))) break;
    const compact = mode > 0;
    for (const cand of yardCandidates(t, g, level, want.houses, env.rand, env.free, want, mode)) {
      cleared();
      const { plan, houses } = seatYard(t, cand, g, env, { ...want, compact });
      const gi = plan.gather.y * W + plan.gather.x, on = new Set(yardParts(plan.cells, W, gi)[0] ?? []);
      const got = withLandmark(gi, on, env.routes(gi, on));
      if (got.exits < base.exits || got.houses < base.houses || got.others < base.others || (base.landmark && !got.landmark)) continue;
      if (cutByBuildings(plan) > 10) continue;
      const core = [...rectCells(plan, W), ...plan.lobes.flatMap((l) => rectCells(l, W))];
      const onTier = houses.filter((s) => t.levels[s.front.y * W + s.front.x] === plan.level);
      const near = onTier.filter((s) => core.some((c) => Math.max(Math.abs((c % W) - s.front.x), Math.abs(Math.floor(c / W) - s.front.y)) <= 6)).length;
      const s = 12 * Math.min(near, 4) + 4 * onTier.length + 3 * plan.frame.filter((f) => f.at === "yard").length + (plan.level === level ? 6 : 0) - (compact ? 4 : 0)
        - 0.4 * Math.hypot(plan.gather.x - g.x, plan.gather.y - g.y) + 5 * (got.houses - base.houses);
      // 떨어진 터로 보낸 집은 마당 집의 목표(셋, 집이 셋보다 적으면 전부)에서 뺀다
      good.push({ plan, s, near, goal: Math.min(3, want.houses - plan.apart.filter((a) => a.role === "house").length), keep: env.mark() });
    }
  }
  const best = good.sort((a, b) => b.s - a.s)[want.skip ?? 0];
  if (!best) { start(); return null; }
  best.keep();
  return best.plan;
}
