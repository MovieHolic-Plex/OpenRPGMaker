// project/transitAuto.ts
// 맵의 길 그림에서 탈것 노선을 뽑는다 — 「이 마을에 차 다니게 해 줘」를 칸 좌표 없이 처리하는 순수 계산.
//
// - 차도: 1층의 생활도로 칸(jp-lane-road 오토타일 묶음)이 이룬 **곧은 띠**를 찾는다. 동서 띠는 위 끝 행 y0·높이 h,
//   남북 띠는 왼쪽 끝 열 x0·폭 w. 교차로에서 끊긴 조각은 같은 줄이면 다시 잇는다. 맵 가장자리에서 가장자리까지
//   이어진 띠에만 차를 보낸다(중간에서 끝나는 길에 차가 나타났다 사라지면 어색하다).
//   폭 4칸 이상이면 좌측통행 두 방향(laneOffsetFor), 2~3칸이면 한 방향(동쪽·남쪽행)만.
// - 노면전차: 2층의 레일(tram-rail-h 2줄 / tram-rail-v 2열) 칸이 이룬 곧은 선, 가장자리에서 가장자리까지.
// 막다른 길·굽은 길·고리 노선은 여기서 만들지 않는다 — set_map_transit 의 routes 로 직접 준다.
import { laneOffsetFor, transitVehicle, type MapTransitRoute, type MapTransitStop, type TransitDir } from "./mapTransit";

export interface RoadBand {
  axis: "ew" | "ns";
  /** 동서 띠: 위 끝 행 · 남북 띠: 왼쪽 끝 열 */
  edge: number;
  /** 띠 폭(칸) */
  width: number;
  /** 동서 띠: x 범위 · 남북 띠: y 범위(양 끝 포함) */
  from: number;
  to: number;
  /** 맵 양쪽 가장자리에 닿는가 */
  edgeToEdge: boolean;
}

export interface GridLike { width: number; height: number }

/** 띠 찾기 — `isRoad(x, y)` 가 참인 칸들의 곧은 띠(폭 minW~maxW, 길이 minLen 이상). */
export function findRoadBands(grid: GridLike, isRoad: (x: number, y: number) => boolean, opts: { minW?: number; maxW?: number; minLen?: number } = {}): RoadBand[] {
  const { width: W, height: H } = grid;
  const minW = opts.minW ?? 2, maxW = opts.maxW ?? 8, minLen = opts.minLen ?? 8;
  const road = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && isRoad(x, y);
  const bands: RoadBand[] = [];
  for (const axis of ["ew", "ns"] as const) {
    const along = axis === "ew" ? W : H, across = axis === "ew" ? H : W;
    const at = (a: number, c: number): boolean => (axis === "ew" ? road(a, c) : road(c, a));
    // 가로지르는 방향으로 길 칸이 연속한 높이 — 띠의 시작(위/왼쪽 끝)에서만 잰다
    const runs = new Map<string, number[]>(); // "edge:width" → 칸 위치들
    for (let c = 0; c < across; c += 1) {
      for (let a = 0; a < along; a += 1) {
        if (!at(a, c) || at(a, c - 1)) continue;
        let h = 0;
        while (at(a, c + h)) h += 1;
        if (h < minW || h > maxW) continue;
        const key = `${c}:${h}`;
        (runs.get(key) ?? runs.set(key, []).get(key)!).push(a);
      }
    }
    for (const [key, cells] of runs) {
      const [edge, width] = key.split(":").map(Number) as [number, number];
      cells.sort((p, q) => p - q);
      // 조각 → 연속 구간. 사이가 교차로(띠 폭 전체가 길 칸)면 잇는다.
      const segs: Array<[number, number]> = [];
      for (const a of cells) {
        const last = segs[segs.length - 1];
        if (last && a === last[1] + 1) { last[1] = a; continue; }
        if (last) {
          let bridged = true;
          for (let g = last[1] + 1; g < a && bridged; g += 1) for (let k = 0; k < width; k += 1) if (!at(g, edge + k)) { bridged = false; break; }
          if (bridged) { last[1] = a; continue; }
        }
        segs.push([a, a]);
      }
      for (const [from0, to0] of segs) {
        // 가장자리 쪽 교차로 칸까지 늘린다(띠 폭 전체가 길이면)
        let from = from0, to = to0;
        const full = (a: number): boolean => { for (let k = 0; k < width; k += 1) if (!at(a, edge + k)) return false; return true; };
        while (from > 0 && full(from - 1)) from -= 1;
        while (to < along - 1 && full(to + 1)) to += 1;
        if (to - from + 1 < minLen) continue;
        bands.push({ axis, edge, width, from, to, edgeToEdge: from === 0 && to === along - 1 });
      }
    }
  }
  // 같은 띠가 두 번 잡히지 않게(교차로 연장으로 같은 구간이 된 조각)
  const seen = new Set<string>();
  return bands.filter((b) => { const k = `${b.axis}:${b.edge}:${b.width}:${b.from}:${b.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((p, q) => (p.axis === q.axis ? p.edge - q.edge || p.from - q.from : p.axis === "ew" ? -1 : 1));
}

/** 맵 밖으로 나가 사라질 여유(칸) — 가장 긴 탈것보다 길어야 몸이 다 빠진다. normalizeMapTransit 의 허용 여유 안. */
const OFF = 12;

/** 띠 하나의 한 방향 칸 경로(꺾이는 점 두 개). 가장자리에 닿은 끝은 맵 밖 OFF 칸까지 늘인다. */
export function bandLanePath(band: RoadBand, dir: TransitDir, grid: GridLike): Array<{ x: number; y: number }> {
  const lane = laneOffsetFor(dir, band.edge, band.width);
  const along = band.axis === "ew" ? grid.width : grid.height;
  const lo = band.from === 0 ? -OFF : band.from;
  const hi = band.to === along - 1 ? along - 1 + OFF : band.to;
  const [a, b] = dir === "right" || dir === "down" ? [lo, hi] : [hi, lo];
  return band.axis === "ew" ? [{ x: a, y: lane }, { x: b, y: lane }] : [{ x: lane, y: a }, { x: lane, y: b }];
}

/** 경로(꺾이는 점 두 개, 곧은 선)에서 머리가 (x, y) 에 오는 칸 번호. 선 위가 아니면 null. */
export function straightPathIndex(path: ReadonlyArray<{ x: number; y: number }>, x: number, y: number): number | null {
  const [a, b] = [path[0]!, path[path.length - 1]!];
  if (a.y === b.y) { if (y !== a.y && y !== a.y + 1) return null; const i = b.x >= a.x ? x - a.x : a.x - x; return i >= 0 && i <= Math.abs(b.x - a.x) ? i : null; }
  if (x !== a.x && x !== a.x + 1) return null;
  const i = b.y >= a.y ? y - a.y : a.y - y;
  return i >= 0 && i <= Math.abs(b.y - a.y) ? i : null;
}

/** 정류장 (x, y) 가 가리키는 것: head = 탈것 머리 칸, center = 서 있을 때 몸 가운데 칸(정문·계단 앞에 문을 맞출 때). */
export type StopAnchor = "head" | "center";
/** 몸 가운데 칸 번호 → 머리 칸 번호. 경로 칸 번호는 진행 방향으로 늘고 몸은 머리 뒤(작은 번호)로 뻗는다. */
export const headIndexFromCenter = (centerIndex: number, length: number): number => centerIndex + Math.floor((length - 1) / 2);
const busLength = (): number => transitVehicle("jp-bus-city")?.length ?? 9;

export const DEFAULT_CAR_MIX = ["jp-car-white", "jp-car-silver", "jp-car-kei-yellow", "jp-car-black", "jp-car-taxi", "jp-car-red", "jp-truck-kei", "jp-car-blue", "jp-car-kei-mint", "jp-truck-box"];

export interface AutoTrafficOptions {
  /** 차 흐름 간격(초). 기본 7. */
  headwaySec?: number;
  vehicles?: string[];
  /** 버스 정류장: (x, y) = 버스 머리가 서는 차선 칸. 그 칸을 지나는 방향의 띠에 버스 노선을 하나 만든다. */
  busStops?: Array<{ x: number; y: number; at?: StopAnchor; name?: string; waitSec?: number; board?: MapTransitStop["board"] }>;
  busHeadwaySec?: number;
  /** 띠마다 차를 보낼지 거르는 함수(기본: 가장자리→가장자리 띠만). */
  accept?: (band: RoadBand) => boolean;
}

/** 찾은 띠마다 차 흐름 노선(좌측통행 두 방향)을 만들고, 정류장이 있으면 그 차선에 버스 노선을 더한다. */
export function autoTrafficRoutes(bands: readonly RoadBand[], grid: GridLike, opts: AutoTrafficOptions = {}): { routes: MapTransitRoute[]; unmatchedStops: Array<{ x: number; y: number }> } {
  const routes: MapTransitRoute[] = [];
  const accept = opts.accept ?? ((b: RoadBand) => b.edgeToEdge);
  const lanes: Array<{ id: string; dir: TransitDir; path: Array<{ x: number; y: number }> }> = [];
  for (const band of bands.filter(accept)) {
    const dirs: TransitDir[] = band.axis === "ew" ? (band.width >= 4 ? ["right", "left"] : ["right"]) : (band.width >= 4 ? ["down", "up"] : ["down"]);
    for (const dir of dirs) {
      const id = `traffic-${band.axis}${band.edge}-${dir}`;
      const path = bandLanePath(band, dir, grid);
      lanes.push({ id, dir, path });
      routes.push({ id, name: `${band.axis === "ew" ? "동서" : "남북"} 길 ${band.edge} ${({ right: "동쪽행", left: "서쪽행", down: "남쪽행", up: "북쪽행" } as const)[dir]}`, kind: "road", path, vehicles: opts.vehicles?.length ? [...opts.vehicles] : rotate(DEFAULT_CAR_MIX, routes.length * 3), headwaySec: opts.headwaySec ?? 7 });
    }
  }
  const unmatchedStops: Array<{ x: number; y: number }> = [];
  const busByLane = new Map<string, MapTransitRoute>();
  for (const stop of opts.busStops ?? []) {
    const lane = lanes.find((l) => straightPathIndex(l.path, stop.x, stop.y) !== null);
    if (!lane) { unmatchedStops.push({ x: stop.x, y: stop.y }); continue; }
    const raw = straightPathIndex(lane.path, stop.x, stop.y)!;
    const index = stop.at === "center" ? headIndexFromCenter(raw, busLength()) : raw;
    let bus = busByLane.get(lane.id);
    if (!bus) {
      bus = { id: `bus-${lane.id.slice("traffic-".length)}`, name: "시내버스", kind: "bus", path: lane.path.map((p) => ({ ...p })), vehicles: ["jp-bus-city"], headwaySec: opts.busHeadwaySec ?? 35, stops: [] };
      busByLane.set(lane.id, bus);
      routes.push(bus);
    }
    bus.stops!.push({ index, ...(stop.name ? { name: stop.name } : {}), ...(stop.waitSec !== undefined ? { waitSec: stop.waitSec } : {}), ...(stop.board ? { board: stop.board } : {}) });
  }
  return { routes, unmatchedStops };
}

const rotate = <T,>(xs: readonly T[], k: number): T[] => xs.map((_, i) => xs[(i + k) % xs.length]!);
