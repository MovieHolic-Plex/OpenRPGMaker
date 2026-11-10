// 조수 v2 — 맵 칸 읽기: 이벤트가 차지한 칸, 걸어 닿는 칸, 타일 이름표, 길·물건 칸. 자리 고르기(where.ts)와 검사들이 같이 쓴다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";

export type Cell = { x: number; y: number };

export const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

// ───────────────────────── 공간 도우미 (events.ts 도 쓴다) ─────────────────────────

export function findMap(project: Project, mapId: string): GameMap | undefined {
  const maps = project.maps as unknown as Record<string, GameMap> | GameMap[];
  return Array.isArray(maps) ? maps.find((m) => m.id === mapId) : maps[mapId];
}

export function eventsOf(map: GameMap): GameEvent[] {
  return Object.values((map.events ?? []) as unknown as Record<string, GameEvent>);
}

export function hasTransfer(ev: GameEvent): boolean {
  const lists: unknown[][] = [ev.commands ?? [], ...((ev.pages ?? []).map((p) => p.commands ?? []))];
  return lists.some((cmds) => cmds.some((c) => (c as { kind?: string }).kind === "transfer"));
}

/** 이동(문) 칸. */
export function transferCells(map: GameMap): Cell[] {
  return eventsOf(map).filter(hasTransfer).map((e) => ({ x: e.x, y: e.y }));
}

/** 사람이 서서 막는 칸: 이동 칸이 아닌 이벤트 칸 전부(그림 있는 이벤트·기존 NPC). */
/**
 * 큰 몸(page.footprint)을 가진 이벤트가 덮는 칸 전부(앵커 칸 제외) — 키운 보스(3×2)처럼 그림이 여러 칸을 덮는다.
 * 그 칸에 조사 칸을 두면 보스 그림 밑에 묻혀 보스를 쓰러뜨리기 전에는 조사할 수 없었다(2026-10-29 vm1 deepseek 「동굴 입구의 봉인」).
 */
export function eventBodyCells(map: GameMap, exceptId?: string): Set<number> {
  const set = new Set<number>();
  for (const e of eventsOf(map)) if (e.id !== exceptId) for (const p of e.pages ?? []) {
    const fp = (p as { footprint?: { width?: number; height?: number } }).footprint;
    const fw = Math.max(1, Math.floor(fp?.width ?? 1)), fh = Math.max(1, Math.floor(fp?.height ?? 1));
    if (fw === 1 && fh === 1) continue;
    const left = e.x - Math.floor((fw - 1) / 2);
    for (let y = e.y - (fh - 1); y <= e.y; y++) for (let x = left; x < left + fw; x++) if (x >= 0 && y >= 0 && x < map.width && y < map.height && !(x === e.x && y === e.y)) set.add(y * map.width + x);
  }
  return set;
}

/** exceptId: 옮기는 이벤트 자신 — 제 자리가 저를 막지 않는다. */
export function eventBlockers(map: GameMap, exceptId?: string): Set<number> {
  const set = new Set<number>();
  for (const e of eventsOf(map)) if (e.id !== exceptId && !hasTransfer(e)) set.add(e.y * map.width + e.x);
  return set;
}

/** 길찾기: from 에서 걸어 닿는 칸 집합. blocked 칸은 서 있는 사람이라 못 지난다. */
export function walkReach(project: Project, map: GameMap, from: Cell, blocked: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  if (blocked.has(from.y * w + from.x) || !isPassable(project, map, from.x, from.y)) return seen;
  const q: number[] = [from.y * w + from.x];
  seen[q[0]!] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j)) continue;
      if (!canMove(project, map, x, y, nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** 걷기 시작점: 시작 맵이면 startPos, 아니면 가장 큰 덩어리의 한 칸. */
export function walkStart(project: Project, map: GameMap): Cell {
  if (map.id === project.startMapId && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return { x: project.startPos.x, y: project.startPos.y };
  }
  const w = map.width;
  const done = new Uint8Array(w * map.height);
  let best: { cell: Cell; n: number } | null = null;
  const none = new Set<number>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if (done[y * w + x] || !isPassable(project, map, x, y)) continue;
      const r = walkReach(project, map, { x, y }, none);
      let n = 0;
      for (let i = 0; i < r.length; i++) if (r[i]) { n++; done[i] = 1; }
      if (!best || n > best.n) best = { cell: { x, y }, n };
    }
  }
  return best?.cell ?? { x: project.startPos.x, y: project.startPos.y };
}

export function dist(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function shortestPathCells(project: Project, map: GameMap, from: Cell, to: Cell, blocked: ReadonlySet<number>): Set<number> {
  const w = map.width;
  const prev = new Int32Array(w * map.height).fill(-2);
  const q: number[] = [from.y * w + from.x];
  prev[q[0]!] = -1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    if (x === to.x && y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (prev[j] !== -2 || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  const out = new Set<number>();
  let cur = to.y * w + to.x;
  if (prev[cur] === -2) return out;
  while (cur >= 0) { out.add(cur); cur = prev[cur]!; }
  return out;
}

/** 이 칸을 막아도 («막기 전에 닿던 칸» − 이 칸) 전부에 아직 닿는가. */
export function keepsMapConnected(project: Project, map: GameMap, start: Cell, cell: Cell, baseBlocked: ReadonlySet<number>): boolean {
  const w = map.width;
  const before = walkReach(project, map, start, baseBlocked);
  const ci = cell.y * w + cell.x;
  if (start.x === cell.x && start.y === cell.y) return false;
  const blocked = new Set(baseBlocked);
  blocked.add(ci);
  const after = walkReach(project, map, start, blocked);
  for (let i = 0; i < before.length; i++) {
    if (before[i] && i !== ci && !after[i]) return false;
  }
  return true;
}

export function openness(reach: Uint8Array, map: GameMap, c: Cell, r = 2): number {
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) n++;
    }
  }
  return n;
}

/**
 * 맵 가장자리에서 걸어 닿는 칸 중 «길로 보이는» 칸. 가장자리 바닥 그림 중 가장 흔한 것(풀밭)이 아닌 칸을 길로 본다.
 * 그런 칸이 없으면 닿는 가장자리 칸 전부.
 */
export function edgeExitCells(map: GameMap, reach: Uint8Array): Cell[] {
  const w = map.width;
  const edge: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if ((x === 0 || y === 0 || x === w - 1 || y === map.height - 1) && reach[y * w + x]) edge.push({ x, y });
    }
  }
  const lower = (map as unknown as { lowerTiles?: ArrayLike<number> }).lowerTiles;
  if (!lower || edge.length === 0) return edge;
  const count = new Map<number, number>();
  for (const c of edge) count.set(lower[c.y * w + c.x], (count.get(lower[c.y * w + c.x]) ?? 0) + 1);
  let common = -1;
  let top = 0;
  for (const [k, n] of count) if (n > top) { top = n; common = k; }
  const odd = edge.filter((c) => lower[c.y * w + c.x] !== common);
  return odd.length > 0 && odd.length < edge.length ? odd : edge;
}

export const SEAT_LABEL = /의자|스툴|걸상|벤치|chair|stool|bench|탁자|식탁|테이블|table/i;

export const STAIR_LABEL = /계단|사다리|stair|ladder/i;

export const WALL_LABEL = /벽|wall/i;

export const WINDOW_LABEL = /창문|창틀|유리창|window/i;

const ROAD_LABEL = /길|도로|포석|보도|road|street|path|pavement|asphalt|cobble/i;

export function tileLabel(project: Project, map: GameMap, tile: number | undefined): string {
  if (typeof tile !== "number" || tile < 0) return "";
  const meta = (project.tilesets[map.tilesetId]?.tileMeta as unknown as ({ label?: string; tags?: readonly string[] } | undefined)[] | undefined)?.[tile];
  return meta?.label ?? "";
}

function tileTags(project: Project, map: GameMap, tile: number | undefined): readonly string[] {
  if (typeof tile !== "number" || tile < 0) return [];
  return (project.tilesets[map.tilesetId]?.tileMeta as unknown as ({ tags?: readonly string[] } | undefined)[] | undefined)?.[tile]?.tags ?? [];
}

type Layer = ArrayLike<number> | undefined;

export function layers(map: GameMap): { lower: Layer; lowerOverlay: Layer; upper: Layer; upperOverlay: Layer } {
  const m = map as unknown as { lowerTiles?: Layer; lowerOverlayTiles?: Layer; upperTiles?: Layer; upperOverlayTiles?: Layer };
  return { lower: m.lowerTiles, lowerOverlay: m.lowerOverlayTiles, upper: m.upperTiles, upperOverlay: m.upperOverlayTiles };
}

/** 이 칸에 사람·물건이 «위에 놓인» 그림(가구·소품·지붕 끝)이 있는가 — 맨바닥이 아니다. */
export function objectAt(map: GameMap, c: Cell): boolean {
  const i = c.y * map.width + c.x;
  const { upper, upperOverlay } = layers(map);
  return (upper?.[i] ?? -1) >= 0 || (upperOverlay?.[i] ?? -1) >= 0;
}

/** 길(포석·도로) 칸 — 칩셋 이름표·태그로 판정. */
export function roadCellSet(project: Project, map: GameMap): Set<number> {
  const out = new Set<number>();
  const { lower, lowerOverlay } = layers(map);
  const cache = new Map<number, boolean>();
  const isRoad = (t: number | undefined): boolean => {
    if (typeof t !== "number" || t < 0) return false;
    let hit = cache.get(t);
    if (hit === undefined) {
      const tags = tileTags(project, map, t).map((x) => x.toLowerCase());
      const label = tileLabel(project, map, t);
      hit = tags.includes("road") || tags.includes("street") || tags.includes("path") || tags.includes("길") || (ROAD_LABEL.test(label) && !/풀|잔디|grass/i.test(label));
      cache.set(t, hit);
    }
    return hit;
  };
  for (let i = 0; i < map.width * map.height; i++) if (isRoad(lower?.[i]) || isRoad(lowerOverlay?.[i])) out.add(i);
  return out;
}
