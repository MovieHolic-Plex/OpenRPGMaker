// 길망 검사 — 깔린 바깥 맵의 길이 «어디로 가는가». 판정자(map-vqa)가 가장 많이 짚은 빌더 결함이 길이었다(2026-11-12 Haiku 28맵: major 10 —
// 풀밭에서 끝나는 길 · 막다른 갈림길 · 가장자리로 나가는데 출구가 없는 길 · 큰길에 안 붙은 길 조각).
// 여기는 재는 함수만 둔다(관문·끝맺음에 걸지 않았다 — 빌더들이 통과한 뒤에 출하·깔기 검사로 올린다). 맵을 고치지 않는다. 실내·던전 맵은 부르는 쪽이 거른다.
//
// 길 줄 = 걸을 수 있는 길·광장 판석·다리·계단 칸(place/surface.wayCells)이 네 방향으로 이어진 덩이.
// 닿는 곳(anchor) = 이벤트(다른 맵으로 가는 이동·사람·상자·표지) · 건물·큰 물건 도장 · 막힌 건물·소품·밭 칸 · 낱장 문. 길 칸에서 두 칸 안이면 닿았다.
//  - deadEnds: 닿는 곳 없이 끝나는 길 끝(막다른 토막, 3걸음 이상). length = 끝에서 마지막 갈림(또는 닿는 곳)까지 걸음 수.
//    물가에서 끝나는 길(나루·잔교)은 막다른 길이 아니다 — waterEnds 로 따로 센다.
//  - edgeNoExit: 맵 가장자리에 닿은 길 묶음인데 두 칸 안에 다른 맵으로 가는 이동이 없다(marked = «막힌 길» 표지는 있다).
//  - detached: 가장 큰 길 줄에서 맨땅 세 칸 넘게 떨어진 길 조각(2칸 이상).
import { isPassable } from "@/project/collision";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";
import { DEAD_END_PREFIX } from "../place/deadEndRoads";
import { isWaterCell, leavesMap, wayCells } from "../place/surface";

export interface RoadCell { readonly x: number; readonly y: number }
export interface RoadEnd extends RoadCell {
  /** 끝에서 마지막 갈림(또는 닿는 곳)까지 걸음 수. */
  readonly length: number;
  /** 길 끝 너머: ground = 걸을 수 있는 맨땅으로 흩어진다 · blocked = 나무·물·절벽에 막혔다. */
  readonly into: "ground" | "blocked";
}
export interface EdgeRoad { readonly side: "north" | "south" | "west" | "east"; readonly cells: readonly RoadCell[]; readonly marked: boolean }
export interface RoadPart extends RoadCell { readonly cells: number; readonly anchors: number }
export interface RoadNetwork {
  /** 길 줄 칸 수(0 이면 길 없는 맵). */
  readonly cells: number;
  /** 길 줄 덩이(맨땅 두 칸 안으로 맞닿은 것은 한 덩이) — 큰 것부터. */
  readonly parts: readonly RoadPart[];
  readonly deadEnds: readonly RoadEnd[];
  /** 물가에서 끝나는 길 끝 수(나루·잔교 — 결함으로 세지 않는다). */
  readonly waterEnds: number;
  readonly edgeNoExit: readonly EdgeRoad[];
  readonly detached: readonly RoadPart[];
}

const REACH = 2;          // 닿는 곳까지 칸 수
const MAX_WIDTH = 7;      // 토막의 한 걸음 줄이 이보다 넓으면 길이 아니라 마당이다
const BLOB_RUN = 5;       // 토막 칸들의 가로·세로 줄 길이(작은 쪽) 가운데값이 이보다 크면 광장·빈터 귀퉁이다
const MIN_STUB = 3;       // 길 가장자리의 한두 칸 턱은 토막이 아니다
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

type Layers = readonly (ArrayLike<number> | undefined)[];
const layersOf = (map: GameMap): Layers => {
  const m = map as unknown as { lowerOverlayTiles?: ArrayLike<number>; upperOverlayTiles?: ArrayLike<number> };
  return [map.lowerTiles, m.lowerOverlayTiles, map.upperTiles, m.upperOverlayTiles];
};

/** 길 칸마다 닿은 곳 번호 묶음 + 다른 맵으로 가는 이동이 선 칸 · «막힌 길» 표지 칸. */
function anchorsOf(project: Project, map: GameMap, ways: ReadonlySet<number>): { near: Map<number, number[]>; exits: RoadCell[]; marks: RoadCell[] } {
  const w = map.width, h = map.height, near = new Map<number, number[]>(), exits: RoadCell[] = [], marks: RoadCell[] = [];
  let id = 0;
  const touch = (n: number, x0: number, y0: number, x1: number, y1: number, diamond: boolean) => {
    for (let y = Math.max(0, y0 - REACH); y <= Math.min(h - 1, y1 + REACH); y++) for (let x = Math.max(0, x0 - REACH); x <= Math.min(w - 1, x1 + REACH); x++) {
      if (diamond && Math.abs(x - x0) + Math.abs(y - y0) > REACH) continue;
      const i = y * w + x; if (!ways.has(i)) continue;
      const list = near.get(i); if (!list) near.set(i, [n]); else if (!list.includes(n)) list.push(n);
    }
  };
  for (const e of map.events ?? []) {
    if (e.id.startsWith(DEAD_END_PREFIX)) { marks.push({ x: e.x, y: e.y }); continue; }
    if (leavesMap(e.pages ?? (e as unknown as { commands?: unknown }).commands, map.id)) exits.push({ x: e.x, y: e.y });
    touch(id++, e.x, e.y, e.x, e.y, true);
  }
  for (const s of (map as unknown as { structurePlacements?: { x: number; y: number; w?: number; h?: number }[] }).structurePlacements ?? []) {
    const sw = s.w ?? 1, sh = s.h ?? 1;
    if (sw * sh >= 4) touch(id++, s.x, s.y, s.x + sw - 1, s.y + sh - 1, false);
  }
  // 막힌 건물·소품·밭 칸과 낱장 문 — 맞닿은 칸은 한 덩이(닿는 곳 하나)로 센다.
  const { doors, things } = tilesetSurface(project.tilesets[map.tilesetId]), layers = layersOf(map);
  const thing = new Set<number>();
  for (let i = 0; i < w * h; i++) {
    const has = (set: ReadonlySet<number>) => layers.some((l) => set.has(l?.[i] ?? -1));
    if (has(doors) || (has(things) && !isPassable(project, map, i % w, Math.floor(i / w)))) thing.add(i);
  }
  const seen = new Set<number>();
  for (const c0 of thing) {
    if (seen.has(c0)) continue;
    const n = id++, cells = [c0]; seen.add(c0);
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q]!, x = c % w, y = (c - x) / w; touch(n, x, y, x, y, true);
      for (const [dx, dy] of AROUND) { const nx = x + dx, ny = y + dy, k = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && thing.has(k) && !seen.has(k)) { seen.add(k); cells.push(k); } }
    }
  }
  return { near, exits, marks };
}

/** 한 덩이를 seeds 에서 걸음 수로 켜를 나누고, 위로 더 갈 데 없는 켜(길 끝)마다 마지막 갈림까지의 토막을 잰다. */
function stubsFrom(part: readonly number[], seeds: readonly number[], w: number, h: number): { cells: number[]; length: number }[] {
  const inPart = new Set(part), dist = new Map<number, number>();
  const queue = [...seeds]; for (const s of seeds) dist.set(s, 0);
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!, x = c % w, y = (c - x) / w;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, n = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || !inPart.has(n) || dist.has(n)) continue; dist.set(n, dist.get(c)! + 1); queue.push(n); }
  }
  // 같은 걸음 수의 칸이 (대각선 포함) 맞닿으면 한 켜 마디.
  const node = new Map<number, number>(), nodes: { level: number; cells: number[]; up: Set<number>; down: Set<number> }[] = [];
  for (const c0 of queue) {
    if (node.has(c0)) continue;
    const level = dist.get(c0)!, cells = [c0]; node.set(c0, nodes.length);
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q]!, x = c % w, y = (c - x) / w;
      for (const [dx, dy] of AROUND) { const nx = x + dx, ny = y + dy, n = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || node.has(n) || dist.get(n) !== level) continue; node.set(n, nodes.length); cells.push(n); }
    }
    nodes.push({ level, cells, up: new Set(), down: new Set() });
  }
  nodes.forEach((nd, k) => { for (const c of nd.cells) { const x = c % w, y = (c - x) / w; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const m = node.get(ny * w + nx); if (m === undefined || m === k) continue; if (nodes[m]!.level > nd.level) nd.up.add(m); else if (nodes[m]!.level < nd.level) nd.down.add(m); } } });
  const out: { cells: number[]; length: number }[] = [];
  for (const tip of nodes) {
    // 두 쪽에서 온 켜가 만나는 곳(고리 한가운데)은 끝이 아니다.
    if (tip.level === 0 || tip.up.size || tip.down.size > 1 || tip.cells.length > MAX_WIDTH) continue;
    const cells = [...tip.cells]; let length = 1, cur = tip;
    while (cur.down.size === 1) {
      const below = nodes[[...cur.down][0]!]!;
      // 아래 켜가 갑자기 넓어지면(길 옆구리의 턱 · 마당 가장자리) 토막은 거기까지다.
      if (below.level === 0 || below.up.size !== 1 || below.cells.length > Math.min(MAX_WIDTH, cur.cells.length + 1)) break;
      cells.push(...below.cells); length += 1; cur = below;
    }
    out.push({ cells, length });
  }
  return out;
}

export function roadNetwork(project: Project, map: GameMap): RoadNetwork {
  const w = map.width, h = map.height, ways = wayCells(project, map);
  if (!ways.size) return { cells: 0, parts: [], deadEnds: [], waterEnds: 0, edgeNoExit: [], detached: [] };
  const { near, exits, marks } = anchorsOf(project, map, ways);
  const within = (cells: readonly RoadCell[], spots: readonly RoadCell[]) => spots.some((s) => cells.some((c) => Math.abs(c.x - s.x) + Math.abs(c.y - s.y) <= REACH));
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  // 네 방향으로 이어진 덩이.
  const group = new Map<number, number>(), groups: number[][] = [];
  for (const c0 of ways) {
    if (group.has(c0)) continue;
    const cells = [c0]; group.set(c0, groups.length);
    for (let q = 0; q < cells.length; q++) { const c = cells[q]!, x = c % w, y = (c - x) / w; for (const [dx, dy] of DIRS) { const n = (y + dy) * w + x + dx; if (inMap(x + dx, y + dy) && ways.has(n) && !group.has(n)) { group.set(n, groups.length); cells.push(n); } } }
    groups.push(cells);
  }
  // 맨땅 두 칸 안으로 맞닿은 덩이는 한 길 줄로 센다(광장의 좌판·우물이 길을 가른 것은 끊긴 길이 아니다).
  const root = groups.map((_, k) => k);
  const find = (k: number): number => { while (root[k] !== k) k = root[k] = root[root[k]!]!; return k; };
  const beside = (x: number, y: number): number[] => DIRS.flatMap(([dx, dy]) => { const g = inMap(x + dx, y + dy) ? group.get((y + dy) * w + x + dx) : undefined; return g === undefined ? [] : [g]; });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ways.has(y * w + x) || !isPassable(project, map, x, y)) continue;
    const mine = beside(x, y); if (!mine.length) continue;
    const others = [...mine];
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) if (inMap(x + dx, y + dy) && !ways.has((y + dy) * w + x + dx) && isPassable(project, map, x + dx, y + dy)) others.push(...beside(x + dx, y + dy));
    for (const g of others) root[find(g)] = find(mine[0]!);
  }
  const merged = new Map<number, number[]>();
  groups.forEach((cells, k) => { const r = find(k); const list = merged.get(r); if (list) list.push(...cells); else merged.set(r, [...cells]); });
  const parts = [...merged.values()].sort((a, b) => b.length - a.length)
    .map((cells): RoadPart => ({ x: cells[0]! % w, y: Math.floor(cells[0]! / w), cells: cells.length, anchors: new Set(cells.flatMap((c) => near.get(c) ?? [])).size }));
  // 가로·세로 줄 길이(작은 쪽) — 광장·빈터 귀퉁이를 길 끝으로 세지 않는다.
  const run = (c: number): number => {
    const x = c % w, y = (c - x) / w; let a = 1, b = 1;
    for (let k = x - 1; k >= 0 && ways.has(y * w + k); k--) a++; for (let k = x + 1; k < w && ways.has(y * w + k); k++) a++;
    for (let k = y - 1; k >= 0 && ways.has(k * w + x); k--) b++; for (let k = y + 1; k < h && ways.has(k * w + x); k++) b++;
    return Math.min(a, b);
  };
  const far = (from: number): number => { const seen = new Set([from]), q = [from]; for (let k = 0; k < q.length; k++) { const c = q[k]!, x = c % w, y = (c - x) / w; for (const [dx, dy] of DIRS) { const n = (y + dy) * w + x + dx; if (inMap(x + dx, y + dy) && ways.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } } return q[q.length - 1]!; };
  const deadEnds: RoadEnd[] = [];
  let waterEnds = 0;
  for (const cells of groups) {
    const anchored = cells.filter((c) => near.has(c));
    let stubs: { cells: number[]; length: number }[];
    if (anchored.length) stubs = stubsFrom(cells, anchored, w, h);
    else {
      // 닿는 곳이 하나도 없는 덩이 — 양 끝에서 한 번씩 재어 두 끝을 다 본다.
      const a = far(cells[0]!), b = far(a);
      stubs = [...stubsFrom(cells, [a], w, h), ...stubsFrom(cells, [b], w, h).filter((s) => s.cells.some((c) => Math.abs((c % w) - (a % w)) + Math.abs(Math.floor(c / w) - Math.floor(a / w)) <= 1))];
    }
    for (const s of stubs) {
      if (s.length < MIN_STUB) continue;
      const head = s.cells.slice(0, Math.max(1, Math.round(s.cells.length / s.length))).map((c) => ({ x: c % w, y: Math.floor(c / w) }));
      if (head.some((c) => c.x === 0 || c.y === 0 || c.x === w - 1 || c.y === h - 1)) continue;   // 가장자리 길은 edgeNoExit 가 본다
      // 맨땅 두 칸 너머에 다른 길 덩이가 있으면 그 길로 이어진 끝이다.
      const mine = group.get(s.cells[0]!);
      if (head.some((c) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3 + Math.abs(dy); dx <= 3 - Math.abs(dy); dx++) { const g = inMap(c.x + dx, c.y + dy) ? group.get((c.y + dy) * w + c.x + dx) : undefined; if (g !== undefined && g !== mine) return true; } return false; })) continue;
      const runs = s.cells.map(run).sort((p, q) => p - q);
      if (runs[Math.floor(runs.length / 2)]! > BLOB_RUN) continue;
      const beyond = head.flatMap((c) => DIRS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))).filter((c) => inMap(c.x, c.y) && !ways.has(c.y * w + c.x));
      if (beyond.some((c) => isWaterCell(project, map, c.x, c.y))) { waterEnds += 1; continue; }
      deadEnds.push({ x: head[0]!.x, y: head[0]!.y, length: s.length, into: beyond.some((c) => isPassable(project, map, c.x, c.y)) ? "ground" : "blocked" });
    }
  }
  // 가장자리에 닿은 길 묶음.
  const edgeNoExit: EdgeRoad[] = [];
  const sides: { side: EdgeRoad["side"]; cells: RoadCell[] }[] = [
    { side: "north", cells: Array.from({ length: w }, (_, x) => ({ x, y: 0 })) }, { side: "south", cells: Array.from({ length: w }, (_, x) => ({ x, y: h - 1 })) },
    { side: "west", cells: Array.from({ length: h }, (_, y) => ({ x: 0, y })) }, { side: "east", cells: Array.from({ length: h }, (_, y) => ({ x: w - 1, y })) },
  ];
  for (const { side, cells } of sides) {
    let cur: RoadCell[] = [];
    const flush = () => { if (cur.length && !within(cur, exits)) edgeNoExit.push({ side, cells: cur, marked: within(cur, marks) }); cur = []; };
    for (const c of cells) { if (ways.has(c.y * w + c.x)) cur.push(c); else flush(); }
    flush();
  }
  return { cells: ways.size, parts, deadEnds, waterEnds, edgeNoExit, detached: parts.slice(1).filter((p) => p.cells >= 2) };
}
