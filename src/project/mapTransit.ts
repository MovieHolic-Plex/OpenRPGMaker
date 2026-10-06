// project/mapTransit.ts
// 맵 위를 다니는 탈것(승용차·버스·노면전차·전철·지하철)의 저작 설정과 순수 계산. DOM·Phaser 없이 계산만 한다.
//
// 저작 단위는 **노선(route)** 이다: 칸 경로(꺾이는 점만 적어도 된다) 하나를 정해진 탈것들이 따라 달린다.
// - `loop: true`  — 닫힌 고리를 `count` 대가 같은 간격으로 계속 돈다(마을 순환 버스·노면전차 순환선).
// - `loop: false` — 경로 처음(보통 맵 가장자리)에서 나타나 끝에서 사라진다. `headwaySec` 마다 한 대(차량 흐름·지하철).
// - `stops` — 경로의 몇 번째 칸에서 머리가 멈추고 문을 연다(`*_open` 프레임). `board` 가 있으면 그 탈것에 「타기」로 이동한다.
//
// 칸 규약(SPEC: scripts/content/jp-city/vehicles/SPEC.md):
// - 경로 칸 = 탈것 **머리**가 지나는 칸, 그리고 탈것 폭 2칸 중 **위/왼쪽 칸**이다.
//   가로로 달리면 몸은 (머리 행, 머리 행+1) 두 줄, 세로로 달리면 (머리 열, 머리 열+1) 두 열.
// - 몸 길이 L칸(목록의 `length`) — 머리에서 지나온 쪽으로 L칸.
// - 좌측통행: 폭 4칸 생활도로(y0..y0+3)에서 동쪽행은 위 두 줄(y0), 서쪽행은 아래 두 줄(y0+2),
//   남쪽행은 오른쪽 두 열(x0+2), 북쪽행은 왼쪽 두 열(x0). `laneOffsetFor` 가 이 규칙 하나다.
//
// 상태(어디쯤 달리는가)는 프로젝트에 저장하지 않는다. 런타임(player/playSceneTransit.ts)이 맵에 들어올 때 처음부터 돌린다.
import catalogJson from "@/assets/jpCityVehicles.json";

export type TransitDir = "right" | "left" | "up" | "down";
export type TransitRouteKind = "road" | "bus" | "tram" | "train" | "subway";
export type TransitVehicleKind = "car" | "taxi" | "kei" | "truck" | "bus" | "tram" | "train" | "subway";

export interface TransitPoint { x: number; y: number }

export interface MapTransitStop {
  /** 확장된 칸 경로(`expandTransitPath`)의 몇 번째 칸에 머리가 닿으면 서는가. */
  index: number;
  /** 머무는 초. 기본 버스 4·노면전차 5·전철 6. */
  waitSec?: number;
  /** 정류장 이름(안내·조수 설명용). */
  name?: string;
  /** 있으면 서 있는 동안 탈것 옆에서 「조사」로 탄다 → 이 맵·칸으로 이동. */
  board?: { mapId: string; x: number; y: number; dir?: TransitDir };
}

export interface MapTransitRoute {
  id: string;
  name?: string;
  kind: TransitRouteKind;
  /** 꺾이는 점(또는 모든 칸). 이웃한 두 점은 같은 행 또는 같은 열이어야 한다. */
  path: TransitPoint[];
  /** 닫힌 고리인가. true 면 마지막 점에서 첫 점으로 이어 계속 돈다. */
  loop?: boolean;
  /** 이 노선에 들어가는 탈것 id(목록 `jpCityVehicles.json`). 차례로 돌려 쓴다. */
  vehicles: string[];
  /** loop 노선에 동시에 도는 대수. 기본 1. */
  count?: number;
  /** 열린 노선에서 다음 차가 나오는 간격(초). 기본 road 6·bus 30·tram 40·train/subway 60. */
  headwaySec?: number;
  /** 칸/초. 기본 road 4·bus 3·tram 2.5·train 5·subway 5. */
  speed?: number;
  stops?: MapTransitStop[];
  /** false 면 이 노선을 끈다. 기본 true. */
  enabled?: boolean;
}

export interface MapTransit {
  routes: MapTransitRoute[];
}

export interface TransitFrameRect { x: number; y: number; w: number; h: number; foot: { w: number; h: number } }
export interface TransitVehicleDef {
  id: string;
  name: string;
  kind: TransitVehicleKind;
  length: number;
  image: string;
  width: number;
  height: number;
  frames: Partial<Record<TransitDir | "right_open" | "left_open", TransitFrameRect>>;
}

const CATALOG = catalogJson as unknown as { version: number; tileSize: number; vehicles: TransitVehicleDef[] };
const BY_ID = new Map(CATALOG.vehicles.map((v) => [v.id, v]));

export function transitVehicleCatalog(): readonly TransitVehicleDef[] { return CATALOG.vehicles; }
export function transitVehicle(id: string): TransitVehicleDef | undefined { return BY_ID.get(id); }

/** 노선 종류마다 탈 수 있는 탈것 종류. 조수·편집기·정규화가 같은 표를 본다. */
export const TRANSIT_ROUTE_VEHICLE_KINDS: Record<TransitRouteKind, readonly TransitVehicleKind[]> = {
  road: ["car", "taxi", "kei", "truck"],
  bus: ["bus"],
  tram: ["tram"],
  train: ["train"],
  subway: ["subway"],
};

const DEFAULT_SPEED: Record<TransitRouteKind, number> = { road: 4, bus: 3, tram: 2.5, train: 5, subway: 5 };
const DEFAULT_HEADWAY: Record<TransitRouteKind, number> = { road: 6, bus: 30, tram: 40, train: 60, subway: 60 };
const DEFAULT_WAIT: Record<TransitRouteKind, number> = { road: 0, bus: 4, tram: 5, train: 6, subway: 6 };

export interface NormalizedTransitRoute {
  id: string;
  name: string;
  kind: TransitRouteKind;
  loop: boolean;
  /** 칸 하나하나로 편 경로(머리 칸). loop 면 마지막 칸 다음이 첫 칸. */
  cells: TransitPoint[];
  vehicles: TransitVehicleDef[];
  count: number;
  headwaySec: number;
  speed: number;
  stops: Array<{ index: number; waitSec: number; name?: string; board?: MapTransitStop["board"] }>;
}

/**
 * 꺾이는 점 목록을 칸 하나씩으로 편다. 이웃 점이 같은 행·열이 아니면 null(저작 오류).
 * loop 면 마지막 점 → 첫 점 구간도 편다(첫 칸은 다시 넣지 않는다).
 */
export function expandTransitPath(path: readonly TransitPoint[], loop = false): TransitPoint[] | null {
  if (path.length === 0) return [];
  const out: TransitPoint[] = [{ x: Math.round(path[0].x), y: Math.round(path[0].y) }];
  const pts = loop && path.length > 1 ? [...path, path[0]] : path;
  for (let i = 1; i < pts.length; i += 1) {
    const a = out[out.length - 1];
    const b = { x: Math.round(pts[i].x), y: Math.round(pts[i].y) };
    if (a.x !== b.x && a.y !== b.y) return null;
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    while (x !== b.x || y !== b.y) { x += dx; y += dy; out.push({ x, y }); }
  }
  if (loop && out.length > 1) {
    const last = out[out.length - 1];
    if (last.x === out[0].x && last.y === out[0].y) out.pop();
  }
  return out;
}

/** 경로 칸 i 에서 i+1 로 갈 때의 방향. 마지막 칸은(열린 노선) 앞 칸의 방향을 잇는다. */
export function transitDirAt(cells: readonly TransitPoint[], i: number, loop: boolean): TransitDir {
  const n = cells.length;
  if (n < 2) return "right";
  let a = cells[i], b = cells[i + 1];
  if (!b) { if (loop) b = cells[0]; else { a = cells[i - 1]; b = cells[i]; } }
  if (b.x > a.x) return "right";
  if (b.x < a.x) return "left";
  if (b.y > a.y) return "down";
  return "up";
}

/** 머리 칸·방향·길이 L 로 몸이 덮는 칸들(통행을 막는 칸). 규약은 파일 머리 주석. */
export function transitFootprint(head: TransitPoint, dir: TransitDir, length: number): TransitPoint[] {
  const out: TransitPoint[] = [];
  for (let k = 0; k < length; k += 1) {
    for (let w = 0; w < 2; w += 1) {
      if (dir === "right") out.push({ x: head.x - k, y: head.y + w });
      else if (dir === "left") out.push({ x: head.x + k, y: head.y + w });
      else if (dir === "down") out.push({ x: head.x + w, y: head.y - k });
      else out.push({ x: head.x + w, y: head.y + k });
    }
  }
  return out;
}

/** 몸 사각(칸). 그림은 이 사각의 아래 가장자리에 맞춰 선다(위로 최대 2칸 솟음). */
export function transitFootprintRect(head: TransitPoint, dir: TransitDir, length: number): { x: number; y: number; w: number; h: number } {
  if (dir === "right") return { x: head.x - length + 1, y: head.y, w: length, h: 2 };
  if (dir === "left") return { x: head.x, y: head.y, w: length, h: 2 };
  if (dir === "down") return { x: head.x, y: head.y - length + 1, w: 2, h: length };
  return { x: head.x, y: head.y, w: 2, h: length };
}

/**
 * 좌측통행 차로 — 폭 `width` 칸 도로의 왼쪽/위 가장자리 좌표 `edge` 와 달리는 방향을 주면 머리 칸이 서는 행/열.
 * 폭 4 생활도로: 동쪽행 edge, 서쪽행 edge+2, 남쪽행 edge+2, 북쪽행 edge.
 */
export function laneOffsetFor(dir: TransitDir, edge: number, width = 4): number {
  const far = edge + Math.max(0, width - 2);
  if (dir === "right" || dir === "up") return edge;
  return far;
}

export interface TransitRouteProblem { routeId: string; message: string }

/** 저장된 설정을 런타임이 쓰는 꼴로 편다. 고칠 수 없는 노선은 problems 에 적고 뺀다. */
export function normalizeMapTransit(transit: MapTransit | undefined | null, mapSize?: { width: number; height: number }): { routes: NormalizedTransitRoute[]; problems: TransitRouteProblem[] } {
  const routes: NormalizedTransitRoute[] = [];
  const problems: TransitRouteProblem[] = [];
  const seen = new Set<string>();
  for (const raw of transit?.routes ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id ?? "").trim() || `route-${routes.length + problems.length + 1}`;
    const bad = (message: string): void => { problems.push({ routeId: id, message }); };
    if (seen.has(id)) { bad("노선 id 중복"); continue; }
    seen.add(id);
    if (raw.enabled === false) continue;
    const kind: TransitRouteKind = (["road", "bus", "tram", "train", "subway"] as const).includes(raw.kind) ? raw.kind : "road";
    const loop = raw.loop === true;
    const cells = expandTransitPath(Array.isArray(raw.path) ? raw.path : [], loop);
    if (!cells) { bad("경로의 이웃 점이 같은 행·열이 아니다(대각선 구간)"); continue; }
    if (cells.length < 2) { bad("경로가 두 칸보다 짧다"); continue; }
    const allowed = TRANSIT_ROUTE_VEHICLE_KINDS[kind];
    const vehicles = (Array.isArray(raw.vehicles) ? raw.vehicles : []).map((v) => BY_ID.get(String(v))).filter((v): v is TransitVehicleDef => !!v && allowed.includes(v.kind));
    if (vehicles.length === 0) { bad(`이 노선(${kind})에 맞는 탈것이 없다 — ${allowed.join("·")} 중에서`); continue; }
    if (mapSize) {
      // 열린 노선은 맵 밖에서 들어와 밖으로 나간다 — 가장 긴 탈것 + 여유 8칸까지 허용.
      const margin = Math.max(...vehicles.map((v) => v.length)) + 8;
      const outside = cells.find((c) => c.x < -margin || c.y < -margin || c.x >= mapSize.width + margin || c.y >= mapSize.height + margin);
      if (outside) { bad(`경로 칸 (${outside.x},${outside.y}) 가 맵 밖으로 너무 멀다`); continue; }
    }
    const longest = Math.max(...vehicles.map((v) => v.length));
    const countRaw = Math.max(1, Math.round(Number(raw.count) || 1));
    // 고리에 차가 꽉 차 움직이지 못하면 안 된다 — 한 대당 (길이+2) 칸.
    const count = loop ? Math.max(1, Math.min(countRaw, Math.floor(cells.length / (longest + 2)))) : 1;
    const speed = clampNumber(raw.speed, 0.5, 12, DEFAULT_SPEED[kind]);
    const headwaySec = clampNumber(raw.headwaySec, 1, 600, DEFAULT_HEADWAY[kind]);
    const stops = (Array.isArray(raw.stops) ? raw.stops : [])
      .filter((s) => s && Number.isFinite(s.index) && s.index >= 0 && s.index < cells.length)
      .map((s) => ({ index: Math.round(s.index), waitSec: clampNumber(s.waitSec, 0, 120, DEFAULT_WAIT[kind]), ...(s.name ? { name: String(s.name) } : {}), ...(s.board ? { board: s.board } : {}) }))
      .sort((a, b) => a.index - b.index);
    routes.push({ id, name: raw.name ? String(raw.name) : id, kind, loop, cells, vehicles, count, headwaySec, speed, stops });
  }
  return { routes, problems };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ───────────────────────────── 달리기(순수 시뮬레이션) ─────────────────────────────
// 런타임(player/playSceneTransit.ts)과 시험이 같은 계산을 쓴다. 위치는 「경로 칸 번호(실수)」 하나로 들고,
// 그림 사각·막는 칸은 거기서 매번 다시 낸다. 시간 입력과 막힘 함수가 같으면 같은 결과다(난수 없음).

export interface TransitVehicleState {
  key: number;
  routeIndex: number;
  def: TransitVehicleDef;
  /** 머리가 있는 경로 칸 번호(실수). 열린 노선은 끝을 넘어 몸이 다 빠질 때까지 커진다. */
  pos: number;
  /** 정류장에서 남은 대기(초). 0 이면 달린다. */
  wait: number;
  /** 지금 서 있는 정류장(대기 중일 때만). */
  stopAt: number | null;
  /** 이번 바퀴에 이미 선 정류장 칸 번호. */
  served: number[];
  /** 막혀 멈춘 누적 초(QA·보고용). */
  blockedSec: number;
  /** 다른 탈것에 막혀 연달아 멈춘 초 — 교차로 교착을 푸는 데 쓴다. */
  stuckSec?: number;
}

export interface TransitSim {
  routes: NormalizedTransitRoute[];
  vehicles: TransitVehicleState[];
  spawnClock: number[];
  nextDef: number[];
  nextKey: number;
  clockSec: number;
}

export interface TransitPose {
  head: TransitPoint;
  dir: TransitDir;
  /** 그림·막힘 사각(칸, 실수). */
  rect: { x: number; y: number; w: number; h: number };
  open: boolean;
}

/** 다른 탈것에만 이만큼 연달아 막히면 교착으로 보고 지나간다(초). */
export const STUCK_RELEASE_SEC = 6;

const DIR_VEC: Record<TransitDir, TransitPoint> = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, up: { x: 0, y: -1 } };

/** 경로 칸 번호(실수) → 머리 위치(칸, 실수)와 방향. 열린 노선의 앞뒤 바깥은 끝 방향으로 늘인다. */
export function transitHeadAt(route: Pick<NormalizedTransitRoute, "cells" | "loop">, pos: number): { head: TransitPoint; dir: TransitDir } {
  const { cells, loop } = route;
  const n = cells.length;
  if (loop) {
    const p = ((pos % n) + n) % n;
    const i = Math.floor(p), f = p - i;
    const a = cells[i]!, b = cells[(i + 1) % n]!;
    return { head: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, dir: transitDirAt(cells, i, true) };
  }
  if (pos <= 0) {
    const dir = transitDirAt(cells, 0, false); const v = DIR_VEC[dir];
    return { head: { x: cells[0]!.x + v.x * pos, y: cells[0]!.y + v.y * pos }, dir };
  }
  if (pos >= n - 1) {
    const dir = transitDirAt(cells, n - 1, false); const v = DIR_VEC[dir]; const over = pos - (n - 1);
    return { head: { x: cells[n - 1]!.x + v.x * over, y: cells[n - 1]!.y + v.y * over }, dir };
  }
  const i = Math.floor(pos), f = pos - i;
  const a = cells[i]!, b = cells[i + 1]!;
  return { head: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, dir: transitDirAt(cells, i, false) };
}

export function transitPose(sim: TransitSim, v: TransitVehicleState): TransitPose {
  const { head, dir } = transitHeadAt(sim.routes[v.routeIndex]!, v.pos);
  return { head, dir, rect: transitFootprintRect(head, dir, v.def.length), open: v.wait > 0 && v.stopAt !== null };
}

/** 실수 사각이 걸치는 정수 칸들. */
export function transitRectCells(rect: { x: number; y: number; w: number; h: number }): TransitPoint[] {
  const out: TransitPoint[] = [];
  const x0 = Math.floor(rect.x + 1e-6), y0 = Math.floor(rect.y + 1e-6);
  const x1 = Math.ceil(rect.x + rect.w - 1e-6), y1 = Math.ceil(rect.y + rect.h - 1e-6);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) out.push({ x, y });
  return out;
}

const cellKey = (x: number, y: number): string => `${x},${y}`;

/** 다른 탈것들이 차지한 칸 → 그 탈것(자기 자신 제외). */
function occupied(sim: TransitSim, except?: TransitVehicleState): Map<string, TransitVehicleState> {
  const s = new Map<string, TransitVehicleState>();
  for (const v of sim.vehicles) {
    if (v === except) continue;
    for (const c of transitRectCells(transitPose(sim, v).rect)) s.set(cellKey(c.x, c.y), v);
  }
  return s;
}

const isHorizontal = (d: TransitDir): boolean => d === "left" || d === "right";

export function createTransitSim(transit: MapTransit | undefined | null, mapSize?: { width: number; height: number }, warmupSec = 90): TransitSim {
  const { routes } = normalizeMapTransit(transit, mapSize);
  const sim: TransitSim = { routes, vehicles: [], spawnClock: routes.map(() => 0), nextDef: routes.map(() => 0), nextKey: 1, clockSec: 0 };
  routes.forEach((r, ri) => {
    if (!r.loop) return;
    for (let k = 0; k < r.count; k += 1) {
      const def = r.vehicles[k % r.vehicles.length]!;
      sim.vehicles.push({ key: sim.nextKey++, routeIndex: ri, def, pos: (k * r.cells.length) / r.count, wait: 0, stopAt: null, served: [], blockedSec: 0 });
    }
    sim.nextDef[ri] = r.count % r.vehicles.length;
  });
  // 처음 들어왔을 때 이미 차가 길에 흩어져 있게 — 막힘 없이 빨리 돌려 둔다.
  for (let t = 0; t < warmupSec; t += 0.25) stepTransitSim(sim, 0.25, () => false);
  sim.clockSec = 0;
  return sim;
}

/**
 * 한 걸음. `isBlocked(x, y)` 는 탈것이 들어가면 안 되는 칸(주인공·서 있는 이벤트) — 다음 몸 칸에 걸리면 그 자리에 선다.
 * 앞차와는 몸 사이 1칸 이상 띄운다(같은 칸을 차지하지 않는다).
 */
export function stepTransitSim(sim: TransitSim, dtSec: number, isBlocked: (x: number, y: number) => boolean): void {
  sim.clockSec += dtSec;
  // 열린 노선: 간격마다 시작점에 새 차(시작 자리가 비었을 때만)
  sim.routes.forEach((r, ri) => {
    if (r.loop) return;
    sim.spawnClock[ri] = (sim.spawnClock[ri] ?? 0) + dtSec;
    if (sim.spawnClock[ri]! < r.headwaySec) return;
    const def = r.vehicles[sim.nextDef[ri]! % r.vehicles.length]!;
    const probe: TransitVehicleState = { key: 0, routeIndex: ri, def, pos: 0, wait: 0, stopAt: null, served: [], blockedSec: 0 };
    const occ = occupied(sim);
    const free = transitRectCells(transitPose(sim, probe).rect).every((c) => !occ.has(cellKey(c.x, c.y)) && !isBlocked(c.x, c.y));
    if (!free) return;
    sim.spawnClock[ri] = 0;
    sim.nextDef[ri] = (sim.nextDef[ri]! + 1) % r.vehicles.length;
    sim.vehicles.push({ ...probe, key: sim.nextKey++ });
  });
  const gone: TransitVehicleState[] = [];
  for (const v of sim.vehicles) {
    const r = sim.routes[v.routeIndex]!;
    const n = r.cells.length;
    if (v.wait > 0) {
      v.wait = Math.max(0, v.wait - dtSec);
      if (v.wait > 0) continue;
      v.stopAt = null;
    }
    let next = v.pos + r.speed * dtSec;
    // 정류장: 이번에 지나칠 정류장이 있으면 거기서 선다(막히지 않았을 때만 확정)
    let reached: (typeof r.stops)[number] | null = null;
    for (const s of r.stops) {
      if (v.served.includes(s.index)) continue;
      if (v.pos <= s.index + 1e-6 && next >= s.index) { next = s.index; reached = s; break; }
    }
    // 막힘: 새로 들어갈 몸 칸이 주인공·다른 탈것과 겹치면 서 있는다(정류장 대기 설정은 그대로 둔다)
    const cur = new Set(transitRectCells(transitPose(sim, v).rect).map((c) => cellKey(c.x, c.y)));
    const nextPose = transitPose(sim, { ...v, pos: next });
    const occ = occupied(sim, v);
    // 앞차 간격: 머리 앞 한 칸까지 본다
    const ahead = transitHeadAt(r, next + 1);
    const aheadCells = transitRectCells(transitFootprintRect(ahead.head, ahead.dir, 1));
    const enter = transitRectCells(nextPose.rect).filter((c) => !cur.has(cellKey(c.x, c.y)));
    const byPlayer = enter.some((c) => isBlocked(c.x, c.y));
    const blockers = new Set<TransitVehicleState>();
    for (const c of [...enter, ...aheadCells]) { const o = occ.get(cellKey(c.x, c.y)); if (o) blockers.add(o); }
    // 교차로 교착(가로·세로 탈것이 서로의 다음 칸을 막음): 막는 탈것이 전부 **엇갈린 방향**이고 STUCK_RELEASE_SEC 넘게
    // 연달아 막혔으면 겹쳐서라도 지나간다. 같은 방향 줄(정류장 버스 뒤 등)과 주인공 앞에서는 끝까지 선다.
    const crossOnly = blockers.size > 0 && [...blockers].every((o) => isHorizontal(transitPose(sim, o).dir) !== isHorizontal(nextPose.dir));
    if (byPlayer || (blockers.size > 0 && !(crossOnly && (v.stuckSec ?? 0) >= STUCK_RELEASE_SEC))) {
      v.blockedSec += dtSec;
      v.stuckSec = byPlayer || !crossOnly ? 0 : (v.stuckSec ?? 0) + dtSec;
      continue;
    }
    v.stuckSec = 0;
    v.pos = next;
    if (reached) { v.wait = reached.waitSec; v.stopAt = reached.index; v.served.push(reached.index); }
    if (r.loop && v.pos >= n) { v.pos -= n; v.served = []; }
    if (!r.loop && v.pos - (n - 1) > v.def.length + 1) gone.push(v);
  }
  if (gone.length) sim.vehicles = sim.vehicles.filter((v) => !gone.includes(v));
}

/** (x, y) 칸이 탈것 몸에 덮였는가 — 주인공 통행 판정이 쓴다. */
export function transitCellBlocked(sim: TransitSim | undefined, x: number, y: number): boolean {
  if (!sim) return false;
  for (const v of sim.vehicles) if (transitRectCells(transitPose(sim, v).rect).some((c) => c.x === x && c.y === y)) return true;
  return false;
}

/** (x, y) 칸에 붙어 정류장에 서 있는(문 연) 탈것의 「타기」 목적지. 없으면 null. */
export function transitBoardingAt(sim: TransitSim | undefined, x: number, y: number): { mapId: string; x: number; y: number; dir?: TransitDir; vehicleId: string; stopName?: string } | null {
  if (!sim) return null;
  for (const v of sim.vehicles) {
    if (!(v.wait > 0) || v.stopAt === null) continue;
    const r = sim.routes[v.routeIndex]!;
    const stop = r.stops.find((s) => s.index === v.stopAt);
    if (!stop?.board) continue;
    if (transitRectCells(transitPose(sim, v).rect).some((c) => c.x === x && c.y === y)) return { ...stop.board, vehicleId: v.def.id, ...(stop.name ? { stopName: stop.name } : {}) };
  }
  return null;
}
