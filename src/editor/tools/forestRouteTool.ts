// editor/tools/forestRouteTool.ts
// 「마을 북쪽에 숲을 구불구불한 맵 N개로 나눠 이어 줘」 — 폴른 스타 속삭이는 숲(flagship/fallen/woodland.ts, B1 활엽 composer)과
// 같은 화가로 숲길 맵을 여러 장 짓고, 시작 맵의 그쪽 가장자리 ↔ 숲1 ↔ 숲2 … 를 왕복 출입구로 잇는다.
// 길은 Catmull-Rom 곡선(폭 2~3.6칸 물결), 빈터·나무 섬·나무 사이 틈(숨은 물건 자리)까지 같은 마스크로 그린다.
// 숲 맵마다 어둡기·안개를 고를 수 있고, 틈에 숨은 물건(조사하면 한 번)을 둘 수 있다.
import { paintWoodland, type Cell, type WoodSpec } from "@/project/flagship/fallen/woodland";
import { isPassable } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";
import { addMapLocation } from "@/project/mapNamedLocations";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { runTool } from "./toolRunner";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export type Side = "north" | "south" | "east" | "west";
type Mood = "normal" | "dim" | "dark" | "fog" | "darkfog";
export const ACROSS = 32, ALONG = 40;

export function call(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new ToolError(`${name} 실패: ${res.summary}`);
  Object.assign(project, ctx.project);
  return res as { data?: unknown; summary?: string };
}

/** 추상 좌표(u = 가로지름 0..31, v = 진행 0..39, v=39 가 들어오는 쪽, v=0 이 나가는 쪽)를 실제 맵 칸으로. */
export function toMap(side: Side, u: number, v: number): Cell {
  switch (side) {
    case "north": return { x: u, y: v };
    case "south": return { x: ACROSS - 1 - u, y: ALONG - 1 - v };
    case "east": return { x: ALONG - 1 - v, y: u };
    case "west": return { x: v, y: ACROSS - 1 - u };
  }
}
export const dims = (side: Side): { width: number; height: number } =>
  side === "north" || side === "south" ? { width: ACROSS, height: ALONG } : { width: ALONG, height: ACROSS };
/** 두 칸 폭 문은 「왼쪽/위쪽 칸」 — 가로지름 축이 뒤집히는 쪽은 한 칸 당긴다. */
export function exitCell(side: Side, u: number, v: number): Cell {
  const flip = side === "south" || side === "west";
  const c = toMap(side, Math.floor(u) + (flip ? 1 : 0), v);
  return { x: Math.round(c.x), y: Math.round(c.y) };
}

type Terrain = "forest" | "field" | "edge";
/** 숲 어귀(edge) — 들어오는 쪽 절반 남짓이 트인 풀밭이고, 그 너머로 들쭉날쭉한 나무 벽이 서서 숲길이 그 틈으로 들어간다. */
const EDGE_MEADOW_V = 24;

function forestSpec(id: string, name: string, side: Side, seed: number, last: boolean, entryU: number, terrain: Terrain = "forest"): { spec: WoodSpec; entry: Cell; exit: Cell | null } {
  const field = terrain === "field";
  const edge = terrain === "edge";
  const rnd = mulberry32(seed);
  const across = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const exitU = Math.round(across(7, 24)) + 0.5;
  const endV = last ? across(6, 9) : 0;
  const n = 4;
  const raw: Cell[] = [{ x: entryU, y: ALONG - 1 }];
  for (let i = 1; i <= n; i += 1) {
    const v = ALONG - 1 - ((ALONG - 1 - endV) * i) / (n + 1);
    const swing = (i % 2 === 0 ? 1 : -1) * across(4, 8);
    raw.push({ x: Math.max(4, Math.min(ACROSS - 5, (entryU + exitU) / 2 + swing)), y: v });
  }
  raw.push({ x: last ? across(10, 22) : exitU, y: endV });
  const pts = raw.map((p) => toMap(side, p.x, p.y));
  const mid = raw[2]!;
  const midBlob = centerBlob(side, mid.x, mid.y, across(3.2, 4.6), across(2.4, 3.4));
  const clearings = [
    // 숲 어귀는 가운데 빈터를 두지 않는다 — 풀밭 끝 나무 벽 바로 앞이라 벽에 큰 구멍이 뚫렸다.
    ...(edge ? [] : [midBlob]),
    { ...centerBlob(side, entryU, ALONG - 4, across(3.5, 5), 2.8) },
    ...(last ? [centerBlob(side, raw[raw.length - 1]!.x, endV + 1, 5.5, 4)] : []),
    // 들판: 길 따라 큰 풀밭 빈터 셋 — 나무는 가장자리 띠와 섬으로만 남는다.
    ...(field ? [raw[1]!, raw[2]!, raw[3]!].map((p) => centerBlob(side, Math.max(9, Math.min(ACROSS - 10, p.x)), p.y, across(9, 11.5), across(6, 8))) : []),
    // 숲 어귀: 들어오는 쪽(v 21~39)을 맵 폭 거의 전체의 풀밭으로 — 그 북쪽 끝 들쭉날쭉한 경계가 나무 벽(숲 가장자리)이다.
    ...(edge ? [centerBlob(side, ACROSS / 2 - 0.5, (EDGE_MEADOW_V + ALONG) / 2 + 0.5, ACROSS / 2 - 1.5, (ALONG - EDGE_MEADOW_V) / 2 + 0.5)] : []),
  ];
  const nooks = [raw[1]!, raw[3]!].map((p, k) => {
    const dir = k % 2 === 0 ? 1 : -1;
    const from = toMap(side, Math.round(p.x), Math.round(p.y));
    const to = toMap(side, Math.max(2, Math.min(ACROSS - 3, Math.round(p.x + dir * across(3, 5)))), Math.round(p.y - 1));
    return { from, to };
  });
  const groves = field ? [centerBlob(side, across(6, 10), across(12, 18), 1.6, 1.3), centerBlob(side, across(20, 26), across(22, 30), 1.8, 1.4)]
    // 숲 어귀 풀밭의 나무 섬 둘 — 길 좌우로 엇갈려 서서, 풀밭을 가로지르는 몸을 숨길 덩이·돌아가는 갈래가 된다.
    : edge ? [centerBlob(side, across(5, 9), across(27, 30), 1.9, 1.5), centerBlob(side, across(22, 26), across(31, 34), 1.9, 1.5)] : [];
  const entry = exitCell(side, entryU, ALONG - 1);
  const exit = last ? null : exitCell(side, exitU, 0);
  const { width, height } = dims(side);
  return {
    spec: { id, name, width, height, seed, paths: [{ pts, w: [2.2, 3.4] }], exits: exit ? [entry, exit] : [entry], clearings, nooks, ...(groves.length ? { groves } : {}), ...(field || edge ? { undergrowth: 0.6 } : {}) },
    entry, exit,
  };
}
/**
 * 모델이 설계한 숲길(2026-10-30 씬 벤치 opus 「숲길 탐색 구간」 3판이 거의 같은 맵 — 씨앗이 「맵 수×13」이라 같은 바탕 프로젝트면 늘 같은 숲, 굽이 4·빈터 자리도 고정).
 * 굽이 수·휘는 폭·들어오고 나가는 자리·길 폭·갈림길(어디서 어느 쪽으로 얼마나, 끝에 무엇)·빈터(어디·크기)를 모델이 정한다. 함수는 칸으로 옮기고
 * 맵 안에 가둘 뿐이다. 갈림길 끝 칸은 data.maps[i].deadEnds 로 돌려준다(상자·적 자리).
 */
export interface ForestDesign {
  readonly bends?: unknown; readonly sway?: unknown; readonly entryAt?: unknown; readonly exitAt?: unknown; readonly width?: unknown;
  readonly branches?: readonly { readonly at?: unknown; readonly toward?: unknown; readonly length?: unknown; readonly end?: unknown }[];
  readonly clearings?: readonly { readonly at?: unknown; readonly size?: unknown; readonly toward?: unknown }[];
}
const n01 = (v: unknown, d: number) => (v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);
const towardOf = (v: unknown): -1 | 1 | 0 => (/left|왼|좌|west|서/iu.test(String(v ?? "")) ? -1 : /right|오른|우|east|동/iu.test(String(v ?? "")) ? 1 : 0);

function designedForestSpec(id: string, name: string, side: Side, seed: number, last: boolean, field: boolean, d: ForestDesign): { spec: WoodSpec; entry: Cell; exit: Cell | null; deadEnds: { at: Cell; end: string }[]; line: string; clearing: Cell; notes: string[] } {
  const rnd = mulberry32(seed);
  const across = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const clampU = (u: number) => Math.max(3, Math.min(ACROSS - 4, u));
  const entryU = 4 + n01(d.entryAt, rnd()) * (ACROSS - 9);
  const exitU = Math.round(4 + n01(d.exitAt, rnd()) * (ACROSS - 9)) + 0.5;
  const endV = last ? across(6, 9) : 0;
  const bendsRaw = Math.floor(Number(d.bends));
  const n = Number.isFinite(bendsRaw) && bendsRaw > 0 ? Math.min(6, bendsRaw) : 2 + Math.floor(rnd() * 4);
  const sway = String(d.sway ?? "");
  const [a0, a1] = /gentle|완만|작|small|straight|곧/iu.test(sway) ? [1.5, 3.5] : /wide|크|심|big|큰/iu.test(sway) ? [6, 10] : [3, 8];
  const width = String(d.width ?? "");
  const w: [number, number] = /narrow|좁/iu.test(width) ? [1.6, 2.4] : /wide|넓/iu.test(width) ? [3, 4.4] : [2.2, 3.4];
  const sign = rnd() < 0.5 ? 1 : -1;
  const raw: Cell[] = [{ x: entryU, y: ALONG - 1 }];
  for (let i = 1; i <= n; i += 1) {
    const v = ALONG - 1 - ((ALONG - 1 - endV) * i) / (n + 1);
    const base = entryU + ((exitU - entryU) * i) / (n + 1);
    raw.push({ x: Math.max(4, Math.min(ACROSS - 5, base + (i % 2 === 0 ? 1 : -1) * sign * across(a0, a1))), y: v });
  }
  raw.push({ x: last ? across(10, 22) : exitU, y: endV });
  // 진행 t(0 = 들어오는 쪽, 1 = 끝)의 길 위 점.
  const along = (t: number): Cell => {
    const v = ALONG - 1 - t * (ALONG - 1 - endV);
    for (let k = 1; k < raw.length; k += 1) {
      const p = raw[k - 1]!, q = raw[k]!;
      if (v <= p.y && v >= q.y) { const f = p.y === q.y ? 0 : (p.y - v) / (p.y - q.y); return { x: p.x + (q.x - p.x) * f, y: v }; }
    }
    return raw[raw.length - 1]!;
  };
  const paths: { pts: Cell[]; w: [number, number] }[] = [{ pts: raw.map((p) => toMap(side, p.x, p.y)), w }];
  const clearings = [
    centerBlob(side, entryU, ALONG - 4, across(3, 4.5), 2.6),
    ...(last ? [centerBlob(side, raw[raw.length - 1]!.x, endV + 1, 5.5, 4)] : []),
    ...(field ? raw.slice(1, -1).filter((_, k) => k % 2 === 0).map((p) => centerBlob(side, Math.max(9, Math.min(ACROSS - 10, p.x)), p.y, across(8, 11), across(5, 7))) : []),
  ];
  const deadEnds: { at: Cell; end: string }[] = [];
  const notes: string[] = [];
  const branchLines: string[] = [];
  // 갈림길이 본길과 겹치면 갈림이 아니다(sc-1030fr opus: 「서쪽으로」 갈래가 본길이 서쪽으로 크게 휜 자리와 겹쳐 상자가 본길 굽이에 놓였다).
  // 끝 칸은 본길·앞선 갈래에서 5칸 넘게 떨어진 자리만 쓴다 — 정한 쪽에 자리가 없으면 반대쪽, 그래도 없으면 짧게, 고친 것은 notes 로 알린다.
  const segDist = (q: Cell, line: readonly Cell[]): number => {
    let best = Infinity;
    for (let k = 1; k < line.length; k += 1) {
      const a0 = line[k - 1]!, a1 = line[k]!; const dx = a1.x - a0.x, dy = a1.y - a0.y; const L = dx * dx + dy * dy;
      const f = L ? Math.max(0, Math.min(1, ((q.x - a0.x) * dx + (q.y - a0.y) * dy) / L)) : 0;
      best = Math.min(best, Math.hypot(q.x - a0.x - f * dx, q.y - a0.y - f * dy));
    }
    return best;
  };
  const taken: Cell[][] = [raw];
  const clear = (q: Cell) => Math.min(...taken.map((l) => segDist(q, l)));
  for (const b of (d.branches ?? []).slice(0, 4)) {
    const t = n01(b.at, across(0.25, 0.75));
    const p = along(Math.max(0.12, Math.min(0.88, t)));
    const want = towardOf(b.toward) || (p.x < ACROSS / 2 ? 1 : -1);
    const len = 4 + n01(b.length, 0.5) * 12;
    let pick: { end: Cell; dir: number; len: number; room: number } | undefined;
    for (const dir of [want, -want]) {
      for (const l of [len, len * 0.75, len * 0.5, 4]) {
        for (const dv of [-4, -2, -6, 0, 2]) {
          const end = { x: clampU(p.x + dir * l), y: Math.max(endV + 3, Math.min(ALONG - 5, p.y + dv)) };
          const room = clear(end);
          if (room >= 5 && (!pick || (pick.dir !== dir ? false : room > pick.room))) pick = { end, dir, len: l, room };
        }
        if (pick) break;
      }
      if (pick) break;
    }
    if (!pick) { notes.push(`고침: 갈림길(at ${t.toFixed(2)})은 본길과 떨어진 막다른 자리가 없어 짓지 않았다 — 다른 at 이나 반대쪽으로.`); continue; }
    if (pick.dir !== want) notes.push(`고침: 갈림길(at ${t.toFixed(2)}) ${want < 0 ? "왼" : "오른"}쪽은 본길 굽이와 겹쳐 반대쪽으로 냈다.`);
    const { end, dir } = pick;
    const mid = { x: (p.x + end.x) / 2, y: (p.y + end.y) / 2 + across(-1, 1) };
    taken.push([p, mid, end]);
    paths.push({ pts: [p, mid, end].map((c) => toMap(side, c.x, c.y)), w: [1.8, 2.6] });
    const what = String(b.end ?? "chest");
    if (!/nothing|없/iu.test(what)) clearings.push(centerBlob(side, end.x, end.y, 2.4, 2));
    const at = toMap(side, end.x, end.y);
    deadEnds.push({ at: { x: Math.round(at.x), y: Math.round(at.y) }, end: what });
    branchLines.push(`${t.toFixed(2)}${dir < 0 ? "왼" : "오"}${Math.round(pick.len)}→${what}`);
  }
  const clearLines: string[] = [];
  for (const c of (d.clearings ?? []).slice(0, 4)) {
    const t = n01(c.at, across(0.3, 0.7));
    const p = along(t);
    const size = String(c.size ?? "");
    const [ru, rv] = /small|작/iu.test(size) ? [2.6, 2] : /large|big|크|넓/iu.test(size) ? [5, 3.8] : [3.8, 2.8];
    const shift = towardOf(c.toward) * 5;
    clearings.push(centerBlob(side, clampU(p.x + shift), p.y, ru, rv));
    clearLines.push(`${t.toFixed(2)}${size || "medium"}`);
  }
  const nooks = [raw[1]!, raw[Math.min(raw.length - 2, 3)]!].map((p, k) => {
    const dir = k % 2 === 0 ? 1 : -1;
    const from = toMap(side, Math.round(p.x), Math.round(p.y));
    const to = toMap(side, Math.max(2, Math.min(ACROSS - 3, Math.round(p.x + dir * across(3, 5)))), Math.round(p.y - 1));
    return { from, to };
  });
  const groves = field ? [centerBlob(side, across(6, 10), across(12, 18), 1.6, 1.3), centerBlob(side, across(20, 26), across(22, 30), 1.8, 1.4)] : [];
  const entry = exitCell(side, entryU, ALONG - 1);
  const exit = last ? null : exitCell(side, exitU, 0);
  const { width: W, height: H } = dims(side);
  const line = `굽이 ${n} · 휨 ${sway || "보통"} · 폭 ${width || "보통"} · 들어옴 ${(entryU / ACROSS).toFixed(2)} · 나감 ${last ? "막다른 빈터" : (exitU / ACROSS).toFixed(2)} · 갈림 ${branchLines.join(" ") || "없음"} · 빈터 ${clearLines.join(" ") || "-"}`;
  return {
    spec: { id, name, width: W, height: H, seed, paths, exits: exit ? [entry, exit] : [entry], clearings, nooks, ...(groves.length ? { groves } : {}), ...(field ? { undergrowth: 0.6 } : {}) },
    entry, exit, deadEnds, line, notes,
    // 보스·사당 자리: 마지막 맵은 막다른 빈터, 아니면 길 가운데.
    clearing: (() => { const p = last ? { x: raw[raw.length - 1]!.x, y: endV + 1 } : along(0.5); const c = toMap(side, p.x, p.y); return { x: Math.round(c.x), y: Math.round(c.y) }; })(),
  };
}

/** 두 설계 한 줄이 거의 같은가 — 굽이 수·갈림 수·갈림 자리·방향이 같으면. */
function sameShape(a: string, b: string): boolean {
  const key = (l: string) => {
    const bends = /굽이 (\d+)/u.exec(l)?.[1];
    const br = [...l.matchAll(/(\d\.\d\d)([왼오])/gu)].map((m) => `${Math.round(Number(m[1]) * 4)}${m[2]}`).join(",");
    return `${bends}|${br}`;
  };
  return key(a) === key(b);
}

/**
 * 적 자리 후보(2026-10-31 씬 벤치 terra 숲길 3판 «몬스터·조우 없음»): 모델이 돌려받은 clearing 한 칸에 동굴 문·상자·필드 적을 모두 겹쳐 놓다
 * 자리 충돌로 적이 다 빠졌다. 입구에서 걸어 닿는 칸을 걸음 수로 줄 세워 30·50·70·88% 지점에서, 이벤트·입구·출구·빈터·갈림 끝과 3칸 넘게 떨어지고
 * 서로 4칸 넘게 떨어진 길 칸(사방이 많이 트인 칸 우선)을 고른다.
 */
function enemySpotsOf(project: Project, map: GameMap, entry: Cell, avoid: readonly Cell[]): Cell[] {
  const W = map.width, H = map.height;
  const dist = new Map<number, number>([[entry.y * W + entry.x, 0]]); const q = [entry.y * W + entry.x];
  for (let h = 0; h < q.length; h += 1) {
    const c = q[h]!; const x = c % W, y = (c - x) / W; const d = dist.get(c)!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || dist.has(n) || !isPassable(project, map, nx, ny)) continue;
      dist.set(n, d + 1); q.push(n);
    }
  }
  const max = Math.max(0, ...dist.values());
  const busy = [...avoid, ...map.events.map((e) => ({ x: e.x, y: e.y }))];
  const open = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([dx, dy]) => dist.has((y + dy!) * W + x + dx!)).length;
  const out: Cell[] = [];
  for (const f of [0.3, 0.5, 0.7, 0.88]) {
    let best: { c: Cell; score: number } | undefined;
    for (const [k, d] of dist) {
      if (Math.abs(d - f * max) > 3) continue;
      const c = { x: k % W, y: Math.floor(k / W) };
      if (busy.some((b) => Math.abs(b.x - c.x) + Math.abs(b.y - c.y) <= 3) || out.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 4)) continue;
      const score = open(c.x, c.y) * 10 - Math.abs(d - f * max);
      if (!best || score > best.score) best = { c, score };
    }
    if (best) out.push(best.c);
  }
  return out;
}

export function centerBlob(side: Side, u: number, v: number, ru: number, rv: number) {
  const c = toMap(side, u, v);
  const vertical = side === "north" || side === "south";
  return { cx: c.x, cy: c.y, rx: vertical ? ru : rv, ry: vertical ? rv : ru };
}

/** 시작 맵 그쪽 가장자리에서 걸어 닿는 칸 — 길·빈 칸을 가운데 가까운 것부터. 없으면 가까운 칸에서 가장자리까지 윗층을 걷어 길을 낸다. */
/**
 * 시작 칸에서 닿는 칸 — 단, 시작 칸(맵 가운데)이 집 안·나무 사이 같은 작은 섬이면 맵에서 가장 큰 걸을 수 있는 덩이를 쓴다.
 * 가운데가 집 그림 위인 광장 마을에서는 닿는 칸이 몇 칸뿐이라 가장자리를 못 찾고, 곧은 길을 집을 뚫고 내다가
 * 「완성된 집 보호」에 걸려 숲 전체가 실패했다(2026-10-30 isekai-godding: 광장 마을 60×44, 동·북 모두 protected-house-write).
 */
function mainWalkableArea(project: Project, map: GameMap, start: Cell): Set<string> {
  const W = map.width, H = map.height;
  const first = computeReachableCells(project, map, start.x, start.y);
  if (first.size >= W * H * 0.15) return first;
  let best = first;
  const seen = new Set(first);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (seen.has(`${x},${y}`) || !isPassable(project, map, x, y)) continue;
    const area = computeReachableCells(project, map, x, y);
    for (const k of area) seen.add(k);
    if (area.size > best.size) best = area;
  }
  return best;
}

export function originEdge(project: Project, map: GameMap, side: Side, walkFrom?: Cell): Cell {
  const W = map.width, H = map.height;
  // 걸어 닿는 기준 칸 — 주면 그 칸(다른 맵에서 들어오는 입구), 아니면 시작 위치·맵 가운데.
  const start = walkFrom ?? (project.startMapId === map.id && project.startPos ? project.startPos : { x: Math.floor(W / 2), y: Math.floor(H / 2) });
  const reach = walkFrom ? computeReachableCells(project, map, start.x, start.y) : mainWalkableArea(project, map, start);
  const edge: Cell[] = [];
  if (side === "north" || side === "south") for (let x = 1; x < W - 1; x += 1) edge.push({ x, y: side === "north" ? 0 : H - 1 });
  else for (let y = 1; y < H - 1; y += 1) edge.push({ x: side === "west" ? 0 : W - 1, y });
  const midX = W / 2, midY = H / 2;
  const free = (c: Cell) => !map.events.some((e) => e.x === c.x && e.y === c.y);
  const inner = (c: Cell): Cell => side === "north" ? { x: c.x, y: 1 } : side === "south" ? { x: c.x, y: H - 2 } : side === "west" ? { x: 1, y: c.y } : { x: W - 2, y: c.y };
  const ok = edge.filter((c) => reach.has(`${c.x},${c.y}`) && reach.has(`${inner(c).x},${inner(c).y}`) && free(c) && free(inner(c)))
    .sort((a, b) => Math.hypot(a.x - midX, a.y - midY) - Math.hypot(b.x - midX, b.y - midY));
  if (ok[0]) return ok[0];
  // 가장자리에 닿는 칸이 없다 — 그 쪽으로 가장 멀리 나간 닿는 칸에서 곧게 길을 낸다.
  const cells = [...reach].map((k) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; });
  const score = (c: Cell) => side === "north" ? c.y : side === "south" ? -c.y : side === "west" ? c.x : -c.x;
  cells.sort((a, b) => score(a) - score(b) || Math.abs(a.x - midX) + Math.abs(a.y - midY) - (Math.abs(b.x - midX) + Math.abs(b.y - midY)));
  const from = cells[0];
  if (!from) throw new ToolError("시작 맵에서 걸어 닿는 칸이 없어 숲 입구를 낼 수 없다.");
  const step = side === "north" ? { dx: 0, dy: -1 } : side === "south" ? { dx: 0, dy: 1 } : side === "west" ? { dx: -1, dy: 0 } : { dx: 1, dy: 0 };
  const ground = map.lowerTiles[from.y * W + from.x]!;
  let c = { ...from };
  while (c.x > 0 && c.y > 0 && c.x < W - 1 && c.y < H - 1) {
    c = { x: c.x + step.dx, y: c.y + step.dy };
    for (const d of [0, step.dx === 0 ? 1 : W]) {
      const i = c.y * W + c.x + d;
      if (i >= 0 && i < W * H) {
        map.upperTiles[i] = -1; map.lowerTiles[i] = ground;
        // 겹 칸(나무 밑동·덤불)도 걷어야 실제로 지나간다 — 윗층만 걷으면 들판 북쪽 끝이 막힌 채 남았다(2026-10-26).
        const layers = map as unknown as { lowerOverlayTiles?: number[]; upperOverlayTiles?: number[] };
        if (layers.lowerOverlayTiles) layers.lowerOverlayTiles[i] = -1;
        if (layers.upperOverlayTiles) layers.upperOverlayTiles[i] = -1;
      }
    }
  }
  return c;
}

function inward(map: GameMap, at: Cell): { x: number; y: number; direction: "up" | "down" | "left" | "right" } {
  if (at.y === map.height - 1) return { x: at.x, y: at.y - 1, direction: "up" };
  if (at.y === 0) return { x: at.x, y: 1, direction: "down" };
  if (at.x === 0) return { x: 1, y: at.y, direction: "right" };
  return { x: at.x - 1, y: at.y, direction: "left" };
}
export function link(project: Project, a: { mapId: string } & Cell, b: { mapId: string } & Cell): void {
  call(project, "create_transfer_pair", { a, b });
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const map = project.maps[from.mapId]!;
    const land = inward(project.maps[to.mapId]!, to);
    for (const e of map.events) {
      if (e.x !== from.x || e.y !== from.y) continue;
      for (const page of e.pages ?? []) for (const c of page.commands as Array<{ kind: string; mapId?: string; x?: number; y?: number; direction?: string }>) {
        if (c.kind === "transfer" && c.mapId === to.mapId) { c.x = land.x; c.y = land.y; c.direction = land.direction; }
      }
    }
  }
}

const MOODS: Record<Mood, { ambient?: number; color?: string; fog?: number }> = {
  normal: {}, dim: { ambient: 0.55, color: "#3a5a44" }, dark: { ambient: 0.3, color: "#24402f" },
  fog: { fog: 0.55 }, darkfog: { ambient: 0.3, color: "#24402f", fog: 0.6 },
};

const authorForestRoute: ToolDefinition = {
  name: "author_forest_route",
  description:
    "숲(또는 terrain:'field' 트인 들판)을 구불구불한 길 맵 여러 장(1~5)으로 지어 시작 맵의 한쪽 가장자리(north·south·east·west)와 줄줄이 잇는다 — 폴른 스타 속삭이는 숲과 같은 "
    + "B1 활엽수 화가(곡선 숲길·빈터·나무 섬·나무 사이 틈). 「마을 북쪽에 숲을 맵 3개로 나눠 이어 줘」「숲 두 개, 두 번째는 어둡고 안개」의 정본. "
    + "moods[i] = normal·dim·dark·fog·darkfog(실제 조명·안개). hiddenPerMap 개수만큼 나무 사이 틈에 숨은 물건(조사하면 한 번, 그림 없음)을 둔다. "
    + "terrain:'edge' = 숲 어귀 — 들어오는 쪽 절반이 트인 풀밭(나무 섬 둘)이고 그 너머 들쭉날쭉한 나무 벽 틈으로 숲길이 들어간다(성벽 밑을 빠져 숲으로 달아나는 추격·「숲 가장자리」 장면). "
    + "terrains[i] 로 맵마다 따로 줄 수 있다(예: ['edge','field']). "
    + "마지막 숲은 막다른 빈터로 끝난다(보스·사당 자리). 숲·들판 길 모양은 네가 designs[i] 로 설계한다(edge 맵은 어귀 틀 그대로) — 굽이 수·휘는 폭·들어오고 나가는 자리·길 폭·갈림길(at·toward·length·end)·빈터. "
    + "같은 요청이라도 이 장면의 사연에 맞게 짜고, 앞서 지은 숲길과 다르게(결과 warnings 가 거의 같은 설계를 짚는다). "
    + "결과 data.maps[i] = {mapId, entry, exit, clearing, terrain, treeline?, deadEnds[{at, end}](갈림길 끝 — 상자 자리), enemySpots[](적 자리 — 이 도구는 몬스터·조우를 깔지 않는다, encounters:'none'), design} — edge 맵의 treeline = 풀밭이 끝나고 나무 벽이 시작되는 줄(y 또는 x).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      fromMapId: { type: "string", description: "숲과 이을 맵(보통 마을)" },
      side: { type: "string", enum: ["north", "south", "east", "west"] },
      count: { type: "integer", description: "숲 맵 수 1~5" },
      names: { type: "array", items: { type: "string" }, description: "맵 이름(생략 = '숲 1'…)" },
      moods: { type: "array", items: { type: "string", enum: ["normal", "dim", "dark", "fog", "darkfog"] } },
      hiddenPerMap: { type: "integer", description: "맵마다 숨은 물건 수 0~3(기본 0)" },
      hiddenItemIds: { type: "array", items: { type: "string" }, description: "숨은 물건 아이템 id(돌아가며 쓴다, 없으면 돈)" },
      terrain: { type: "string", enum: ["forest", "field", "edge"], description: "forest(기본)=나무 사이 숲길 · field=트인 들판(큰 풀밭 빈터, 가장자리만 나무) · edge=숲 어귀(들어오는 쪽 풀밭 → 나무 벽 틈으로 숲길)" },
      terrains: { type: "array", items: { type: "string", enum: ["forest", "field", "edge"] }, description: "맵마다 terrain(i 번째 맵). 빠진 자리는 terrain" },
      linkFrom: { type: "boolean", description: "false 면 시작 맵 가장자리에 길을 내지 않고 이동 이벤트도 두지 않는다 — 성벽 개구멍·뒷문·우물처럼 시작 맵의 정한 칸에서 이벤트로 들여보낼 때. 첫 맵 입구는 data.maps[0].entry(그 칸에 돌아가는 이벤트를 직접 둔다). 기본 true" },
      designs: {
        type: "array", maxItems: 5,
        description: "맵마다 숲길 설계(네가 정한다 — 같은 요청이라도 굽이·갈림·빈터를 이야기에 맞게, 앞서 지은 숲길과 다르게). 생략하면 기본 틀(굽이 4·갈림 없음).",
        items: {
          type: "object",
          properties: {
            bends: { type: "integer", description: "굽이 수 1~6" },
            sway: { type: "string", description: "휘는 폭: gentle 완만 · normal · wide 크게" },
            entryAt: { type: "number", description: "들어오는 자리 0~1(가로지름, 0 = 왼쪽)" },
            exitAt: { type: "number", description: "나가는 자리 0~1(마지막 맵은 막다른 빈터라 무시)" },
            width: { type: "string", description: "길 폭: narrow · normal · wide" },
            branches: { type: "array", maxItems: 4, description: "갈림길 — 본길에서 갈라져 막다른 곳으로", items: { type: "object", properties: {
              at: { type: "number", description: "갈라지는 진행 위치 0~1(0 = 들어오는 쪽)" },
              toward: { type: "string", description: "left·right" },
              length: { type: "number", description: "길이 0~1" },
              end: { type: "string", description: "끝에 둘 것: chest 상자 자리 · clearing 빈터 · nothing" } } } },
            clearings: { type: "array", maxItems: 4, description: "본길 옆 빈터", items: { type: "object", properties: {
              at: { type: "number", description: "진행 위치 0~1" }, size: { type: "string", description: "small·medium·large" }, toward: { type: "string", description: "left·right·center" } } } },
          },
        },
      },
    },
    required: ["fromMapId", "side"],
  },
  invalidArgsExample: { fromMapId: "map_1", side: "north", count: 3, moods: ["normal", "dim", "darkfog"], hiddenPerMap: 1 },
  run(draft, args): ToolExecResult {
    const from = requireMap(draft, String(args.fromMapId));
    const side = (["north", "south", "east", "west"] as const).find((s) => s === args.side);
    if (!side) throw new ToolError("side 는 north·south·east·west 중 하나.");
    const count = Math.max(1, Math.min(5, Math.floor(Number(args.count ?? 1)) || 1));
    // 씨앗은 모델에게 보이지 않는다(스키마에 없음 — 고정 씨앗을 쓰는 대본만 seed 를 넘긴다). 기본은 인자 전체 해시 + 무작위 덧값:
    // 「맵 수×13」이면 같은 바탕 프로젝트에서 늘 같은 숲이었다(씬 벤치 opus 숲길 3판 — 인자까지 같았다). 쓴 씨앗은 요약·data.seed 로 남긴다(다시 짓기용).
    const seed0 = Number.isFinite(Number(args.seed)) ? Number(args.seed)
      : ([...`${JSON.stringify({ ...args, seed: undefined })}|${Object.keys(draft.maps).length}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) + Math.floor(Math.random() * 1_000_000)) % 1_000_000;
    const designs = Array.isArray(args.designs) ? (args.designs as unknown[]) : [];
    const earlier = Object.values(draft.maps).flatMap((m) => (m.locations ?? []).filter((l) => (l.tags ?? []).includes("forest-route")).map((l) => ({ map: m.name, line: l.note ?? "" })));
    const names = Array.isArray(args.names) ? args.names.map(String) : [];
    const moods = Array.isArray(args.moods) ? args.moods.map(String) as Mood[] : [];
    const hidden = Math.max(0, Math.min(3, Math.floor(Number(args.hiddenPerMap ?? 0)) || 0));
    const itemIds = (Array.isArray(args.hiddenItemIds) ? args.hiddenItemIds.map(String) : []).filter((id) => draft.database.items.some((i) => i.id === id) || draft.database.equipment.some((i) => i.id === id));
    const terrainOf = (i: number): Terrain => {
      const t = Array.isArray(args.terrains) ? args.terrains[i] : undefined;
      const pick = typeof t === "string" ? t : args.terrain;
      return pick === "field" || pick === "edge" ? pick : "forest";
    };
    const warnings: string[] = [];
    const out: Array<{ mapId: string; name: string; entry: Cell; exit: Cell | null; clearing: Cell; hidden: Cell[]; enemySpots: Cell[]; encounters: "none" | "set"; terrain: Terrain; treeline?: number; branches: { from: Cell; end: Cell }[]; deadEnds?: { at: Cell; end: string }[]; design?: string }> = [];
    const linkFrom = args.linkFrom !== false;
    let prev: ({ mapId: string } & Cell) | null = linkFrom ? { mapId: from.id, ...originEdge(draft, from, side) } : null;
    let used = 0;
    for (let i = 0; i < count; i += 1) {
      const terrain = terrainOf(i);
      const field = terrain === "field";
      // 숲 어귀(edge)는 들판에서 숲으로 드는 맵 — 들판 이름(map_field_*)을 쓴다(들판으로 짓던 맵을 edge 로 바꿔도 id 가 그대로다).
      const kind = field || terrain === "edge" ? "field" : "forest";
      let id = `map_${kind}_${side}_${i + 1}`;
      for (let n = 2; draft.maps[id]; n += 1) id = `map_${kind}_${side}_${i + 1}_${n}`;
      const base = field ? "들판" : "숲";
      const name = names[i] ?? (count > 1 ? `${base} ${i + 1}` : base);
      const entryU = 10 + mulberry32(seed0 + i * 31)() * 12;
      const d = terrain !== "edge" && designs[i] && typeof designs[i] === "object" ? designs[i] as ForestDesign : undefined;
      const built = d ? designedForestSpec(id, name, side, seed0 + i * 97, i === count - 1, field, d) : undefined;
      const { spec, entry, exit } = built ?? forestSpec(id, name, side, seed0 + i * 97, i === count - 1, entryU, terrain);
      const result = paintWoodland(draft, spec);
      if (built) {
        warnings.push(...built.notes.map((n) => `${name}: ${n}`));
        const twin = earlier.find((e) => sameShape(e.line, built.line));
        if (twin) warnings.push(`${name}: 앞서 지은 숲길 「${twin.map}」(${twin.line})과 굽이·갈림이 거의 같다 — 다음 숲길은 굽이 수·갈림 자리·방향을 다르게 설계한다.`);
        addMapLocation(draft.maps[id]!, { name: `숲길 설계 ${name}`, x: 0, y: 0, w: 1, h: 1, note: built.line, tags: ["forest-route"] });
        earlier.push({ map: name, line: built.line });
      } else if (!args.seed && terrain !== "edge") warnings.push(`${name}: designs 를 주지 않아 기본 틀(굽이 4·갈림 없음)로 지었다 — 갈림길·빈터·굽이는 designs[i] 로 네가 정한다.`);
      // 시작 맵의 이 숲 묶음 아래로 — 범위 체크포인트가 새 맵을 버리지 않게.
      try { call(draft, "manage_map_tree", { operation: "move", mapId: id, parentId: from.id }); } catch { /* 트리 이동 실패는 무시 */ }
      if (prev) link(draft, prev, { mapId: id, ...entry });
      const mood = MOODS[moods[i] ?? "normal"] ?? {};
      if (mood.ambient !== undefined || mood.fog !== undefined) {
        try {
          call(draft, "set_scene_mood", {
            mapId: id, applyMode: "map",
            ...(mood.ambient !== undefined ? { lighting: { ambient: mood.ambient, color: mood.color } } : {}),
            ...(mood.fog !== undefined ? { weather: { kind: "fog", intensity: mood.fog } } : {}),
          });
        } catch (e) { warnings.push(`${name} 분위기 실패: ${String(e).slice(0, 120)}`); }
      }
      const spots: Cell[] = [];
      for (const pocket of result.pockets.slice(0, hidden)) {
        const itemId = itemIds.length ? itemIds[used % itemIds.length] : undefined;
        used += 1;
        try {
          call(draft, "place_examine_hotspots", {
            mapId: id,
            hotspots: [{ at: pocket, name: "나무 사이", once: true, ...(itemId ? { itemId } : { lines: ["나무 사이에 무언가 반짝인다…"] }) }],
          });
          if (!itemId) {
            const ev = draft.maps[id]!.events.find((e) => e.x === pocket.x && e.y === pocket.y);
            const page = ev?.pages?.[0];
            if (page) page.commands.push({ kind: "changeGold", op: "+=", amount: 60 + 20 * (used % 4) } as never, { kind: "text", body: `${60 + 20 * (used % 4)}골드를 주웠다!` } as never);
          }
          spots.push(pocket);
        } catch (e) { warnings.push(`${name} 숨은 물건 실패: ${String(e).slice(0, 120)}`); }
      }
      if (result.pockets.length < hidden) warnings.push(`${name}: 나무 사이 틈이 ${result.pockets.length}곳뿐이라 숨은 물건 ${result.pockets.length}개만 두었다.`);
      const c = spec.clearings?.[spec.clearings.length - 1];
      const clearingCell = built ? built.clearing : c ? { x: Math.round(c.cx), y: Math.round(c.cy) } : entry;
      // 이 도구는 몬스터·조우를 깔지 않는다(전투 방식은 프로젝트마다 다르다) — 요약·data 에 비었다고 적고 겹치지 않는 적 자리를 준다.
      // 「몬스터가 있게」 요청을 지키게 하는 것은 v2 게임 검사(gameChecks 1i 「전투」)다 — 여기서 같은 말을 경고로 또 하지 않는다.
      const enemySpots = enemySpotsOf(draft, draft.maps[id]!, entry, [entry, ...(exit ? [exit] : []), clearingCell, ...(built?.deadEnds.map((e) => e.at) ?? []), ...spots]);
      const hasFoes = !!draft.maps[id]!.encounterTable?.length || draft.maps[id]!.events.some((e) => /enemy|foe|troop/iu.test(e.id));
      const treeline = terrain === "edge" ? (side === "north" ? EDGE_MEADOW_V : side === "south" ? ALONG - 1 - EDGE_MEADOW_V : side === "west" ? EDGE_MEADOW_V : ALONG - 1 - EDGE_MEADOW_V) : undefined;
      // 샛길(nooks)은 큰길에서 갈라져 막다른 끝으로 가는 갈림길이다 — 결과에 좌표로 알린다(2026-10-30 omo-loop-1030b terra forest-path:
      // 갈림길이 이미 있는데 «숲길 빌더는 갈림길을 지정하지 못한다»며 항목을 막힘으로 닫았다). 모델 설계 맵은 deadEnds 가 갈림 끝이다.
      const branches = (spec.nooks ?? []).map((nk) => ({ from: { x: Math.round(nk.from.x), y: Math.round(nk.from.y) }, end: { x: Math.round(nk.to.x), y: Math.round(nk.to.y) } }));
      out.push({ mapId: id, name, entry, exit, clearing: clearingCell, hidden: spots, enemySpots, encounters: hasFoes ? "set" : "none", terrain, ...(treeline !== undefined ? { treeline } : {}), branches, ...(built ? { deadEnds: built.deadEnds, design: built.line } : {}) });
      if (exit) prev = { mapId: id, ...exit };
    }
    return {
      summary: `숲길 ${count}장(${side}): ${out.map((m) => `${m.name}=${m.mapId}(${m.terrain})${m.hidden.length ? ` 숨은 물건 ${m.hidden.length}` : ""}${m.encounters === "none" ? " 몬스터·조우 없음" : ""}${m.deadEnds?.length ? ` 갈림길 끝 ${m.deadEnds.map((e) => `(${e.at.x},${e.at.y})${e.end}`).join(" ")}` : ""}`).join(" → ")} · ${from.id} ${side} 가장자리와 연결 · seed ${seed0}`
        + out.filter((m) => !m.deadEnds?.length && m.branches.length).map((m) => ` · ${m.name} 갈림길 ${m.branches.length}곳(큰길에서 갈라지는 막다른 샛길): ${m.branches.map((b) => `(${b.from.x},${b.from.y})→끝 (${b.end.x},${b.end.y})`).join(", ")} — 막다른 끝에 place_chest·place_field_enemy 를 그 좌표로 놓는다`).join("")
        + out.map((m) => ` · ${m.name} ${m.exit ? "" : "막다른 "}빈터 (${m.clearing.x},${m.clearing.y})`).join(""),
      data: { maps: out },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const FOREST_ROUTE_TOOLS: readonly ToolDefinition[] = [authorForestRoute];
