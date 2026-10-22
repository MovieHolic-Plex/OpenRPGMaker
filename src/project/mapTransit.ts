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
// - 좌측통행(기본, jp_city): 폭 4칸 생활도로(y0..y0+3)에서 동쪽행은 위 두 줄(y0), 서쪽행은 아래 두 줄(y0+2),
//   남쪽행은 오른쪽 두 열(x0+2), 북쪽행은 왼쪽 두 열(x0). `laneOffsetFor` 가 이 규칙 하나다.
// - 우측통행(modern_city): 동쪽행 아래 반쪽·서쪽행 위 반쪽·남쪽행 왼쪽(서) 반쪽·북쪽행 오른쪽(동) 반쪽.
//   반쪽이 3칸(폭 6 도로)이면 폭 2 차를 가운데 세우려 노선의 `laneShift` 로 가로지르는 방향 0.5칸을 민다.
// - 꺾임: 몸 **가운데**가 두 차선 중심선의 교점 곁을 둥글게 지나며 돈다(transitBodyAt). 머리 기준으로 돌리면
//   몸이 머리 둘레로 순간이동해 옆 차선·횡단보도로 튀었다.
//
// 상태(어디쯤 달리는가)는 프로젝트에 저장하지 않는다. 런타임(player/playSceneTransit.ts)이 맵에 들어올 때 처음부터 돌린다.
import catalogJson from "@/assets/jpCityVehicles.json";

export type TransitDir = "right" | "left" | "up" | "down";
export type TransitRouteKind = "road" | "bus" | "tram" | "train" | "subway";
export type TransitVehicleKind = "car" | "taxi" | "kei" | "moto" | "truck" | "bus" | "tram" | "train" | "subway";

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
  /**
   * 있으면 이 정류장에 선 차는 이 스위치가 켜질 때까지 문을 연 채 기다린다 — 장면이 사람을 태운 뒤에 떠나게 한다.
   * 켜진 뒤로는 남은 정차 시간과 관계없이 `DEPART_DOOR_SEC`(1.5초) 안에 문을 닫고 떠난다.
   */
  departSwitch?: string;
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
  /** 차선 가운데 맞춤(칸, 0~0.99) — 동서 구간은 아래로(ew), 남북 구간은 오른쪽으로(ns) 몸을 민다. 기본 0. */
  laneShift?: { ew?: number; ns?: number };
  /** false 면 이 노선을 끈다. 기본 true. */
  enabled?: boolean;
  /**
   * 있으면 이 스위치가 켜져 있을 때만 새 차가 나온다(열린 노선) — 장면이 「열차가 들어온다」 순간에 부르는 차.
   * 꺼져 있는 동안은 한 대도 나오지 않고(맵에 들어올 때 미리 돌려 두는 것 포함), 켜지는 다음 걸음에 바로 한 대가 나온다.
   */
  callSwitch?: string;
}

export interface MapTransit {
  routes: MapTransitRoute[];
}

export type TransitFrameName =
  | TransitDir
  | "right_open" | "left_open"
  | "right_brake" | "left_brake" | "up_brake" | "down_brake"
  | "right_0" | "right_1" | "right_2" | "right_3"
  | "left_0" | "left_1" | "left_2" | "left_3"
  | "up_0" | "up_1" | "up_2" | "up_3"
  | "down_0" | "down_1" | "down_2" | "down_3"
  | `${TransitDir}_sigL` | `${TransitDir}_sigR`;
export interface TransitFrameRect { x: number; y: number; w: number; h: number; foot: { w: number; h: number } }
export interface TransitVehicleDef {
  id: string;
  name: string;
  kind: TransitVehicleKind;
  length: number;
  image: string;
  width: number;
  height: number;
  frames: Partial<Record<TransitFrameName, TransitFrameRect>>;
  /** 경광등 차(경찰·구급·소방): `_0`/`_2` = 꺼짐, `_1`/`_3` = 켜짐 칸이다. 런타임이 시계로 적·청을 번갈아 켠다(서 있어도). */
  beacon?: boolean;
}

/**
 * modern_city 차량: 동서 = 길이 L칸 × 2칸(L·16 × 32px), 남북 = 2칸 × L칸(32 × L·16px) — 90° 돌아도 크기가 그대로다.
 * 그림은 네 방향 모두 같은 도트 엔진(scripts/content/modern-city/vehicles)이 1:1 로 그린 차량별 시트
 * `/assets/modern-city/vehicles/<id>.png` 다. 행 = right·left·up·down, 열 = 기본·_0~_3(바퀴)·_brake·_sigL·_sigR·_open(버스 동서).
 */
export const MODERN_VEHICLE_COLUMNS = ["", "_0", "_1", "_2", "_3", "_brake", "_sigL", "_sigR", "_open"] as const;
function makeModernVehicleDef(id: string, name: string, kind: TransitVehicleKind, length: number, openDoor = false, beacon = false): TransitVehicleDef {
  const ewW = length * 16, ewH = 32, nsW = 32, nsH = length * 16;
  const ewFoot = { w: length, h: 2 }, nsFoot = { w: 2, h: length };
  const frames: Partial<Record<TransitFrameName, TransitFrameRect>> = {};
  const cols = MODERN_VEHICLE_COLUMNS.filter((s) => s !== "_open");
  for (const [dir, y] of [["right", 0], ["left", ewH]] as const) {
    cols.forEach((s, i) => { frames[`${dir}${s}` as TransitFrameName] = { x: ewW * i, y, w: ewW, h: ewH, foot: ewFoot }; });
    if (openDoor) frames[`${dir}_open` as TransitFrameName] = { x: ewW * cols.length, y, w: ewW, h: ewH, foot: ewFoot };
  }
  for (const [dir, y] of [["up", ewH * 2], ["down", ewH * 2 + nsH]] as const) {
    cols.forEach((s, i) => { frames[`${dir}${s}` as TransitFrameName] = { x: nsW * i, y, w: nsW, h: nsH, foot: nsFoot }; });
  }
  return { id, name, kind, length, image: `/assets/modern-city/vehicles/${id}.png`, width: Math.max(ewW * (cols.length + (openDoor ? 1 : 0)), nsW * cols.length), height: ewH * 2 + nsH * 2, frames, ...(beacon ? { beacon } : {}) };
}

export const MODERN_CITY_TRANSIT_VEHICLES: readonly TransitVehicleDef[] = [
  makeModernVehicleDef("mc-veh-police-a", "경찰 패트롤카", "car", 3, false, true),
  makeModernVehicleDef("mc-veh-taxi-b", "도심 택시", "taxi", 3),
  makeModernVehicleDef("mc-veh-car2-c-red", "낮은 지붕 세단 · 빨강", "car", 3),
  makeModernVehicleDef("mc-veh-sedan-a-navy", "승용차 · 남색", "car", 3),
  makeModernVehicleDef("mc-veh-sedan-a-white", "승용차 · 흰색", "car", 3),
  makeModernVehicleDef("mc-veh-sedan-a-black", "승용차 · 검정", "car", 3),
  makeModernVehicleDef("mc-veh-car2-c-beige", "낮은 지붕 세단 · 베이지", "car", 3),
  makeModernVehicleDef("mc-veh-car2-c-green", "낮은 지붕 세단 · 녹색", "car", 3),
  makeModernVehicleDef("mc-veh-sedan-a", "승용차 · 은색", "car", 3),
  makeModernVehicleDef("mc-veh-van-a", "승합차(밴)", "truck", 3),
  makeModernVehicleDef("mc-veh-truck-a", "소형 박스 트럭", "truck", 4),
  makeModernVehicleDef("mc-veh-ambulance-a", "구급차", "truck", 4, false, true),
  makeModernVehicleDef("mc-veh-firetruck-b", "소방차", "truck", 4, false, true),
  makeModernVehicleDef("mc-veh-bus-a", "시내버스", "bus", 5, true),
  makeModernVehicleDef("mc-veh-scooter-delivery", "배달 스쿠터", "moto", 2),
];

const CATALOG = catalogJson as unknown as { version: number; tileSize: number; vehicles: TransitVehicleDef[] };
const ALL_VEHICLES: readonly TransitVehicleDef[] = [...CATALOG.vehicles, ...MODERN_CITY_TRANSIT_VEHICLES];
const BY_ID: Readonly<Record<string, TransitVehicleDef>> = Object.fromEntries(ALL_VEHICLES.map((v) => [v.id, v]));

export function transitVehicleCatalog(): readonly TransitVehicleDef[] { return ALL_VEHICLES; }
export function transitVehicle(id: string): TransitVehicleDef | undefined { return BY_ID[id]; }

/** 노선 종류마다 탈 수 있는 탈것 종류. 조수·편집기·정규화가 같은 표를 본다. */
export const TRANSIT_ROUTE_VEHICLE_KINDS: Record<TransitRouteKind, readonly TransitVehicleKind[]> = {
  road: ["car", "taxi", "kei", "moto", "truck"],
  bus: ["bus"],
  tram: ["tram"],
  train: ["train"],
  subway: ["subway"],
};

const DEFAULT_SPEED: Record<TransitRouteKind, number> = { road: 4, bus: 3, tram: 2.5, train: 5, subway: 5 };
const DEFAULT_HEADWAY: Record<TransitRouteKind, number> = { road: 6, bus: 30, tram: 40, train: 60, subway: 60 };
/** departSwitch 가 켜진 뒤 문을 닫고 떠나기까지(초). */
export const DEPART_DOOR_SEC = 1.5;
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
  stops: Array<{ index: number; waitSec: number; name?: string; board?: MapTransitStop["board"]; departSwitch?: string }>;
  callSwitch?: string;
  /** 차선 가운데 맞춤(칸) — 동서 구간 y·남북 구간 x 에 더한다. */
  laneShift: { ew: number; ns: number };
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
  const near = width >= 6 ? edge + 1 : edge;
  const far = edge + Math.max(0, width - 2);
  if (dir === "right" || dir === "up") return near;
  return far;
}

export type TransitDrive = "left" | "right";

/**
 * 차로 — 머리 칸이 서는 행/열(lane)과 폭 2 차를 차로 한가운데 세우는 나머지 민 칸(shift, 0 또는 0.5).
 * 좌측통행(jp_city)은 laneOffsetFor 그대로(shift 0). 우측통행(modern_city)은 반쪽 가운데:
 * 폭 6 도로 edge..edge+5 — 서쪽행 edge+0.5(위 반쪽), 동쪽행 edge+3.5(아래 반쪽), 남쪽행 edge+0.5(서쪽 반쪽), 북쪽행 edge+3.5(동쪽 반쪽).
 */
export function transitLane(dir: TransitDir, edge: number, width: number, drive: TransitDrive): { lane: number; shift: number } {
  if (drive === "left") return { lane: laneOffsetFor(dir, edge, width), shift: 0 };
  if (width < 4) {
    const c = Math.max(0, width - 2) / 2;
    return { lane: edge + Math.floor(c), shift: c - Math.floor(c) };
  }
  const half = Math.floor(width / 2);
  const start = dir === "left" || dir === "down" ? edge : edge + width - half;
  const c = (half - 2) / 2;
  return { lane: start + Math.floor(c), shift: c - Math.floor(c) };
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
    const vehicles = (Array.isArray(raw.vehicles) ? raw.vehicles : []).map((v) => BY_ID[String(v)]).filter((v): v is TransitVehicleDef => !!v && allowed.includes(v.kind));
    if (vehicles.length === 0) { bad(`이 노선(${kind})에 맞는 탈것이 없다 — ${allowed.join("·")} 중에서`); continue; }
    if (mapSize) {
      // 열린 노선은 맵 밖에서 들어와 밖으로 나간다 — 가장 긴 탈것 + 여유 8칸까지, 적어도 자동 노선의 맵 밖 여유(transitAuto OFF = 12칸).
      const margin = Math.max(12, Math.max(...vehicles.map((v) => v.length)) + 8);
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
      .map((s) => ({ index: Math.round(s.index), waitSec: clampNumber(s.waitSec, 0, 120, DEFAULT_WAIT[kind]), ...(s.name ? { name: String(s.name) } : {}), ...(s.board ? { board: s.board } : {}), ...(s.departSwitch ? { departSwitch: String(s.departSwitch) } : {}) }))
      .sort((a, b) => a.index - b.index);
    const shiftOf = (v: unknown): number => clampNumber(v, 0, 0.99, 0);
    const laneShift = { ew: shiftOf(raw.laneShift?.ew), ns: shiftOf(raw.laneShift?.ns) };
    routes.push({ id, name: raw.name ? String(raw.name) : id, kind, loop, cells, vehicles, count, headwaySec, speed, stops, laneShift, ...(raw.callSwitch ? { callSwitch: String(raw.callSwitch) } : {}) });
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
  /** 교차로(동서·남북 노선이 겹치는 칸 덩어리)와 노선별 진입 정보 — stepTransitSim 이 처음 부를 때 만든다. */
  junctions?: TransitJunctions;
}

export interface TransitJunctionPass { box: number; entryDir: TransitDir; swept: Set<string> }
export interface TransitJunctions { boxes: Array<Set<string>>; byRoute: TransitJunctionPass[][] }

/** 신호 주기(초): 동서 초록 → 전부 빨강 → 남북 초록 → 전부 빨강. */
export const TRANSIT_SIGNAL = { green: 7, clear: 1.5 } as const;

/** 지금 초록인 축(전부 빨강이면 null). */
export function transitSignalAxis(clockSec: number): "ew" | "ns" | null {
  const { green, clear } = TRANSIT_SIGNAL;
  const t = ((clockSec % (2 * (green + clear))) + 2 * (green + clear)) % (2 * (green + clear));
  if (t < green) return "ew";
  if (t < green + clear) return null;
  if (t < 2 * green + clear) return "ns";
  return null;
}

export interface TransitPose {
  head: TransitPoint;
  dir: TransitDir;
  /** 교차로 90° 회전 직전·회전 중 깜빡이는 방향지시등(직진 중이면 null). */
  blinker?: "left" | "right" | null;
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

export function transitCornerBlinker(route: Pick<NormalizedTransitRoute, "cells" | "loop">, pos: number): "left" | "right" | null {
  const { cells, loop } = route;
  const n = cells.length;
  if (n < 3) return null;
  const p = loop ? ((pos % n) + n) % n : pos;
  const start = loop ? 0 : 1;
  const end = loop ? n : n - 1;
  for (let c = start; c < end; c += 1) {
    const prevIdx = (c - 1 + n) % n;
    const fromDir = transitDirAt(cells, prevIdx, loop);
    const toDir = transitDirAt(cells, c, loop);
    if (fromDir === toDir) continue;
    const diff = loop ? ((c - p + n / 2) % n) - n / 2 : c - p;
    if (diff < -0.5 || diff > 5) continue;
    const isLeftTurn =
      (fromDir === "right" && toDir === "up") ||
      (fromDir === "up" && toDir === "left") ||
      (fromDir === "left" && toDir === "down") ||
      (fromDir === "down" && toDir === "right");
    return isLeftTurn ? "left" : "right";
  }
  return null;
}

/** 곧게 달릴 때 몸 가운데(칸, 실수) — transitFootprintRect 의 가운데에 노선 차선 맞춤을 더한 것. */
function straightBodyCenter(head: TransitPoint, dir: TransitDir, length: number, shift: { ew: number; ns: number }): TransitPoint {
  const r = transitFootprintRect(head, dir, length);
  return isHorizontal(dir) ? { x: r.x + r.w / 2, y: r.y + r.h / 2 + shift.ew } : { x: r.x + r.w / 2 + shift.ns, y: r.y + r.h / 2 };
}

/**
 * 몸 가운데·몸 방향. 꺾임 칸 c 를 머리가 지난 뒤 몸 길이 L 만큼(c ≤ pos < c+L) 몸 가운데가 들어오던 차선 중심선에서
 * 나가는 차선 중심선으로 사분원을 그리며 옮겨 간다(가운데 피벗). 몸 방향은 반쯤 돌았을 때 바뀐다 — 크기는 L×2 ↔ 2×L 그대로.
 */
export function transitBodyAt(route: Pick<NormalizedTransitRoute, "cells" | "loop" | "laneShift">, pos: number, length: number): { center: TransitPoint; dir: TransitDir } {
  const { cells, loop } = route;
  const n = cells.length;
  const shift = route.laneShift ?? { ew: 0, ns: 0 };
  if (n >= 3) {
    const p = loop ? ((pos % n) + n) % n : pos;
    const hi = Math.floor(p);
    for (let c = hi; c > p - length - 1e-9; c -= 1) {
      if (!loop && (c < 1 || c > n - 2)) continue;
      const ci = ((c % n) + n) % n;
      const u = transitDirAt(cells, (ci - 1 + n) % n, loop), w = transitDirAt(cells, ci, loop);
      if (u === w || isHorizontal(u) === isHorizontal(w)) continue;
      const t = (p - c) / length;
      const corner = cells[ci]!;
      const p0 = straightBodyCenter(corner, u, length, shift);
      const wv = DIR_VEC[w], uv = DIR_VEC[u];
      const p1 = straightBodyCenter({ x: corner.x + wv.x * length, y: corner.y + wv.y * length }, w, length, shift);
      const du = (p1.x - p0.x) * uv.x + (p1.y - p0.y) * uv.y;
      const dw = (p1.x - p0.x) * wv.x + (p1.y - p0.y) * wv.y;
      const a = Math.sin((t * Math.PI) / 2), b = 1 - Math.cos((t * Math.PI) / 2);
      return {
        center: { x: p0.x + uv.x * du * a + wv.x * dw * b, y: p0.y + uv.y * du * a + wv.y * dw * b },
        dir: t < 0.5 ? u : w,
      };
    }
  }
  const { head, dir } = transitHeadAt(route, pos);
  return { center: straightBodyCenter(head, dir, length, shift), dir };
}

/** 몸 사각(칸, 실수)과 몸 방향 — 길이 L 은 동서 L×2, 남북 2×L. */
function transitBodyRect(route: Pick<NormalizedTransitRoute, "cells" | "loop" | "laneShift">, pos: number, length: number): { rect: TransitPose["rect"]; dir: TransitDir } {
  const body = transitBodyAt(route, pos, length);
  const w = isHorizontal(body.dir) ? length : 2, h = isHorizontal(body.dir) ? 2 : length;
  return { rect: { x: body.center.x - w / 2, y: body.center.y - h / 2, w, h }, dir: body.dir };
}

export function transitPose(sim: TransitSim, v: TransitVehicleState): TransitPose {
  const route = sim.routes[v.routeIndex]!;
  const { head } = transitHeadAt(route, v.pos);
  const { rect, dir } = transitBodyRect(route, v.pos, v.def.length);
  const blinker = transitCornerBlinker(route, v.pos);
  return { head, dir, blinker, rect, open: v.wait > 0 && v.stopAt !== null };
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

/**
 * 교차로 찾기 — 한 노선의 동서 차선 몸 칸과 **다른** 노선의 남북 차선 몸 칸이 겹치는 칸을 이어 붙인 덩어리가 교차로(상자)다.
 * 노선마다 상자를 지날 때 들어오는 방향과, 그 노선 가장 긴 탈것이 상자 안에서 쓸고 지나가는 칸(swept)을 적어 둔다.
 */
export function buildTransitJunctions(routes: readonly NormalizedTransitRoute[]): TransitJunctions {
  const h = new Map<string, Set<number>>(), v = new Map<string, Set<number>>();
  routes.forEach((r, ri) => {
    const n = r.cells.length;
    for (let i = 0; i < n; i += 1) {
      const { rect, dir } = transitBodyRect(r, i, 1);
      const into = isHorizontal(dir) ? h : v;
      for (const c of transitRectCells(rect)) { const k = cellKey(c.x, c.y); (into.get(k) ?? into.set(k, new Set()).get(k)!).add(ri); }
    }
  });
  const boxCells = new Set<string>();
  for (const [k, hr] of h) { const vr = v.get(k); if (vr && [...hr].some((a) => [...vr].some((b) => a !== b))) boxCells.add(k); }
  const boxes: Array<Set<string>> = [];
  const boxOf = new Map<string, number>();
  for (const start of boxCells) {
    if (boxOf.has(start)) continue;
    const box = new Set<string>([start]); boxOf.set(start, boxes.length);
    const stack = [start];
    while (stack.length) {
      const [x, y] = stack.pop()!.split(",").map(Number) as [number, number];
      for (const k of [cellKey(x + 1, y), cellKey(x - 1, y), cellKey(x, y + 1), cellKey(x, y - 1)]) {
        if (!boxCells.has(k) || boxOf.has(k)) continue;
        boxOf.set(k, boxes.length); box.add(k); stack.push(k);
      }
    }
    boxes.push(box);
  }
  const byRoute = routes.map((r) => {
    const L = Math.max(...r.vehicles.map((d) => d.length));
    const passes = new Map<number, TransitJunctionPass>();
    const lo = r.loop ? 0 : -L, hi = r.loop ? r.cells.length : r.cells.length + L;
    for (let p = lo; p <= hi; p += 0.25) {
      const { rect } = transitBodyRect(r, p, L);
      for (const c of transitRectCells(rect)) {
        const k = cellKey(c.x, c.y); const b = boxOf.get(k);
        if (b === undefined) continue;
        let pass = passes.get(b);
        // 들어오는 방향 = 처음 상자에 닿을 때 머리가 달리던 방향(꺾임은 상자 안에서 일어난다)
        if (!pass) { pass = { box: b, entryDir: transitHeadAt(r, p).dir, swept: new Set() }; passes.set(b, pass); }
        pass.swept.add(k);
      }
    }
    return [...passes.values()];
  });
  return { boxes, byRoute };
}

const touchesBox = (rect: TransitPose["rect"], box: Set<string>): boolean => transitRectCells(rect).some((c) => box.has(cellKey(c.x, c.y)));

/** 정지선 — 상자(차선이 엇갈리는 칸) 앞 이만큼(칸)에서 선다. modern_city 교차로 횡단보도(2칸)를 밟지 않게. */
const STOP_LINE_GAP = 2;

/** 사각을 진행 방향으로 늘인다(정지선 내다보기). */
function reachAhead(rect: TransitPose["rect"], dir: TransitDir, by: number): TransitPose["rect"] {
  const d = DIR_VEC[dir];
  return { x: rect.x + Math.min(0, d.x * by), y: rect.y + Math.min(0, d.y * by), w: rect.w + Math.abs(d.x * by), h: rect.h + Math.abs(d.y * by) };
}

/**
 * 상자 건너편이 비었는가 — 몸이 상자를 다 빠져나간 자리(+앞차 간격 1칸)에 다른 탈것이 있으면 들어가지 않는다.
 * 아래쪽 줄이 상자까지 밀려 있을 때 상자 안에 서서 엇갈린 축을 영영 막는 교착(꼬리 물기)을 막는다.
 */
function junctionExitClear(sim: TransitSim, v: TransitVehicleState, box: Set<string>): boolean {
  const r = sim.routes[v.routeIndex]!;
  const L = v.def.length;
  let p = v.pos, touched = false;
  for (let k = 0; k < 400; k += 1, p += 0.25) {
    if (touchesBox(transitBodyRect(r, p, L).rect, box)) touched = true;
    else if (touched) break;
  }
  if (!touched) return true;
  const out = transitBodyRect(r, p, L);
  const need = new Set(transitRectCells(reachAhead(out.rect, out.dir, 1)).map((c) => cellKey(c.x, c.y)));
  for (const o of sim.vehicles) {
    if (o === v) continue;
    if (transitRectCells(transitPose(sim, o).rect).some((c) => need.has(cellKey(c.x, c.y)))) return false;
  }
  return true;
}

/**
 * 상자에 새로 들어가도 되는가 — 들어오는 축이 빨간불이면 정지선(상자 STOP_LINE_GAP 칸 앞)에서 선다. 초록이어도 상자 건너편이
 * 막혔거나(junctionExitClear), 상자 안에 다른 방향에서 들어와 쓸고 지나갈 칸이 겹치는 탈것(맞은편 직진과 좌회전 등)이 있으면
 * 기다린다 — 겹쳐 지나가거나 교착하지 않게. 이미 상자에 몸이 걸친 탈것은 신호와 상관없이 빠져나간다.
 */
function junctionHolds(sim: TransitSim, v: TransitVehicleState, curRect: TransitPose["rect"], nextRect: TransitPose["rect"], nextDir: TransitDir): boolean {
  const j = sim.junctions!;
  const reach = reachAhead(nextRect, nextDir, STOP_LINE_GAP);
  for (const pass of j.byRoute[v.routeIndex] ?? []) {
    const box = j.boxes[pass.box]!;
    if (touchesBox(curRect, box) || !touchesBox(reach, box)) continue;
    if (transitSignalAxis(sim.clockSec) !== (isHorizontal(pass.entryDir) ? "ew" : "ns")) return true;
    if (!junctionExitClear(sim, v, box)) return true;
    for (const o of sim.vehicles) {
      if (o === v) continue;
      const op = (j.byRoute[o.routeIndex] ?? []).find((q) => q.box === pass.box);
      if (!op || op.entryDir === pass.entryDir) continue;
      if (!touchesBox(transitPose(sim, o).rect, box)) continue;
      for (const k of op.swept) if (pass.swept.has(k)) return true;
    }
  }
  return false;
}

export function createTransitSim(transit: MapTransit | undefined | null, mapSize?: { width: number; height: number }, warmupSec = 90): TransitSim {
  const { routes } = normalizeMapTransit(transit, mapSize);
  const sim: TransitSim = { routes, vehicles: [], spawnClock: routes.map((r, i) => ((i * 2.3) % r.headwaySec)), nextDef: routes.map(() => 0), nextKey: 1, clockSec: 0 };
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
 * 정류장 앞 감속·떠날 때 가속(버스·노면전차·전철·지하철) — 등감속 꼴(속도 ∝ √남은 거리)으로 정차 칸에 스르르 서고,
 * 문을 닫고 떠날 때는 같은 거리 동안 천천히 붙는다. 차 흐름(road)은 정류장이 없어 늘 1.
 */
export function transitStopEase(r: Pick<NormalizedTransitRoute, "kind" | "speed" | "stops">, v: Pick<TransitVehicleState, "pos" | "served">): number {
  if (r.kind === "road" || !r.stops.length) return 1;
  const brake = Math.min(14, Math.max(3, r.speed * 2));
  let ease = 1;
  for (const s of r.stops) {
    const served = v.served.includes(s.index);
    if (!served && s.index >= v.pos) ease = Math.min(ease, Math.sqrt((s.index - v.pos) / brake));
    else if (served && v.pos >= s.index) ease = Math.min(ease, Math.sqrt((v.pos - s.index) / brake));
  }
  return Math.min(1, Math.max(0.12, ease));
}

/**
 * 한 걸음. `isBlocked(x, y)` 는 탈것이 들어가면 안 되는 칸(주인공·서 있는 이벤트) — 다음 몸 칸에 걸리면 그 자리에 선다.
 * 앞차와는 몸 사이 1칸 이상 띄운다(같은 칸을 차지하지 않는다).
 */
export function stepTransitSim(sim: TransitSim, dtSec: number, isBlocked: (x: number, y: number) => boolean, switchOn: (id: string) => boolean = () => false): void {
  sim.clockSec += dtSec;
  sim.junctions ??= buildTransitJunctions(sim.routes);
  // 열린 노선: 간격마다 시작점에 새 차(시작 자리가 비었을 때만)
  sim.routes.forEach((r, ri) => {
    if (r.loop) return;
    // 장면이 부르는 노선: 스위치가 꺼져 있으면 나오지 않고, 켜지는 걸음에 바로 나오도록 시계를 간격에 붙여 둔다.
    if (r.callSwitch && !switchOn(r.callSwitch)) { sim.spawnClock[ri] = r.headwaySec; return; }
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
      const holdAt = v.stopAt === null ? undefined : r.stops.find((s) => s.index === v.stopAt)?.departSwitch;
      if (holdAt) {
        if (!switchOn(holdAt)) continue;
        v.wait = Math.min(v.wait, DEPART_DOOR_SEC);
      }
      v.wait = Math.max(0, v.wait - dtSec);
      if (v.wait > 0) continue;
      v.stopAt = null;
    }
    let next = v.pos + r.speed * transitStopEase(r, v) * dtSec;
    // 정류장: 이번에 지나칠 정류장이 있으면 거기서 선다(막히지 않았을 때만 확정)
    let reached: (typeof r.stops)[number] | null = null;
    for (const s of r.stops) {
      if (v.served.includes(s.index)) continue;
      if (v.pos <= s.index + 1e-6 && next >= s.index) { next = s.index; reached = s; break; }
    }
    // 막힘: 새로 들어갈 몸 칸이 주인공·다른 탈것과 겹치면 서 있는다(정류장 대기 설정은 그대로 둔다)
    const curRect = transitPose(sim, v).rect;
    const cur = new Set(transitRectCells(curRect).map((c) => cellKey(c.x, c.y)));
    const nextPose = transitPose(sim, { ...v, pos: next });
    // 교차로: 빨간불·상자 안 엇갈린 탈것이면 정지선에서 기다린다(막힘 초에는 넣지 않는다 — 신호 대기는 막힘이 아니다).
    if (junctionHolds(sim, v, curRect, nextPose.rect, nextPose.dir)) { v.stuckSec = 0; continue; }
    const occ = occupied(sim, v);
    // 앞차 간격: 머리 앞 한 칸까지 본다
    const ahead = transitHeadAt(r, next + 1);
    const aheadCells = transitRectCells(transitFootprintRect(ahead.head, ahead.dir, 1));
    const enter = transitRectCells(nextPose.rect).filter((c) => !cur.has(cellKey(c.x, c.y)));
    const byPlayer = enter.some((c) => isBlocked(c.x, c.y));
    const blockers = new Set<TransitVehicleState>();
    for (const c of [...enter, ...aheadCells]) { const o = occ.get(cellKey(c.x, c.y)); if (o) blockers.add(o); }
    // 교차로 교착(가로·세로 탈것이 서로의 다음 칸을 막음): 막는 탈것이 전부 **엇갈린(직각) 방향**이고 STUCK_RELEASE_SEC 넘게
    // 연달아 막혔으면 겹쳐서라도 지나간다 — 신호·상자 규칙(junctionHolds)이 막아 주지 못한 저작 노선의 마지막 안전판.
    // 같은 방향 줄(같은 차선에 합류한 다른 노선·정류장 버스 뒤 등)과 주인공 앞에서는 끝까지 선다(앞차를 뚫고 지나가지 않는다).
    const crossOnly = blockers.size > 0 && [...blockers].every((o) => !(o.wait > 0) && isHorizontal(transitPose(sim, o).dir) !== isHorizontal(nextPose.dir));
    const releaseThreshold = STUCK_RELEASE_SEC;
    if (byPlayer || (blockers.size > 0 && !(crossOnly && (v.stuckSec ?? 0) >= releaseThreshold))) {
      v.blockedSec += dtSec;
      v.stuckSec = byPlayer || !crossOnly ? 0 : (v.stuckSec ?? 0) + dtSec;
      continue;
    }
    if (blockers.size === 0) v.stuckSec = 0;
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
