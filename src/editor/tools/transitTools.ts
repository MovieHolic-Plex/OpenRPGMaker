// 맵 위 탈것(승용차 흐름·시내버스·노면전차·전철·지하철) 도구.
//   inspect_map_transit : 길 그림에서 찾은 차도 띠·노면전차 레일, 지금 노선, 미리 돌린 탈것 상태를 돌려준다(읽기).
//   set_map_transit     : 노선을 깐다. auto = 길 그림에서 차 흐름(좌측통행 두 방향)과 버스 정류장을 자동으로,
//                         routes = 칸 경로를 직접(굽은 길·순환선·노면전차·전철), clear/removeRouteIds = 지우기.
// 저장 모양·시뮬레이션은 src/project/mapTransit.ts, 길 띠 찾기는 src/project/transitAuto.ts. 그림 목록은 src/assets/jpCityVehicles.json.
import {
  createTransitSim, expandTransitPath, normalizeMapTransit, transitFootprintRect, transitPose, transitRectCells, transitVehicle, transitVehicleCatalog,
  TRANSIT_ROUTE_VEHICLE_KINDS, type MapTransit, type MapTransitRoute, type MapTransitStop, type TransitDir, type TransitRouteKind,
} from "@/project/mapTransit";
import { autoTrafficRoutes, findRoadBands, headIndexFromCenter, straightPathIndex, type RoadBand } from "@/project/transitAuto";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const ROUTE_KINDS: TransitRouteKind[] = ["road", "bus", "tram", "train", "subway"];
const DIRS: TransitDir[] = ["right", "left", "up", "down"];
const KIND_KO: Record<TransitRouteKind, string> = { road: "차 흐름", bus: "버스", tram: "노면전차", train: "전철", subway: "지하철" };
/** 차·버스가 달려도 되는 1층 칸 = 생활도로 오토타일 묶음. */
const LANE_GROUP = "jp-lane-road";
const TRAM_RAIL_KITS = ["jp-tram-rail-h", "jp-tram-rail-h-xwalk", "jp-tram-rail-v", "jp-tram-rail-end"];
const TRACK_KITS = ["jp-subway-track"];

const vehicleIds = (): string[] => transitVehicleCatalog().map((v) => v.id);
const vehicleLine = (): string => transitVehicleCatalog().map((v) => `${v.id}(${v.kind}, 길이 ${v.length}칸)`).join(", ");

/** 차가 지나가도 되는 길 칸 = 생활도로 묶음 + 횡단보도(묶음·길 4줄 키트) + 「생활도로」 이름표 키트 칸. 횡단보도로 끊긴 간선도 한 띠로 본다. */
const CROSSWALK_GROUPS = ["jp-crosswalk-ew", "jp-crosswalk-ns"];
const CROSSWALK_KITS = ["jp-road-lane-crosswalk-h", "jp-road-lane-crosswalk-v"];
function laneTileSet(project: Project, map: GameMap): Set<number> {
  const ts = project.tilesets[map.tilesetId];
  const out = new Set<number>();
  for (const g of ts?.autotileGroups ?? []) if (g.id === LANE_GROUP || CROSSWALK_GROUPS.includes(g.id)) for (const t of g.memberTileIds) out.add(t);
  for (const t of kitTileSet(project, map, CROSSWALK_KITS, "tiles")) out.add(t);
  (ts?.tileMeta ?? []).forEach((m, i) => { if ((m?.label ?? "").startsWith("생활도로")) out.add(i); });
  return out;
}
function kitTileSet(project: Project, map: GameMap, kitIds: readonly string[], layer: "tiles" | "upperTiles" | "both"): Set<number> {
  const ts = project.tilesets[map.tilesetId];
  const out = new Set<number>();
  for (const k of ts?.structureKits ?? []) {
    if (!kitIds.includes(k.id)) continue;
    for (const row of k.rows ?? []) {
      const src = layer === "tiles" ? row.tiles ?? [] : layer === "upperTiles" ? row.upperTiles ?? [] : [...(row.tiles ?? []), ...(row.upperTiles ?? [])];
      for (const t of src) if (typeof t === "number" && t >= 0) out.add(t);
    }
  }
  return out;
}
const tramTileSet = (project: Project, map: GameMap): Set<number> => kitTileSet(project, map, TRAM_RAIL_KITS, "both");
/** 지하철·전철 선로(1층 jp-subway-track 2줄, 막힘 바닥). */
const trackTileSet = (project: Project, map: GameMap): Set<number> => kitTileSet(project, map, TRACK_KITS, "tiles");
const tileAt = (arr: ReadonlyArray<number> | undefined, map: GameMap, x: number, y: number): number => (arr && inMapBounds(map, x, y) ? arr[y * map.width + x] ?? -1 : -1);

export function mapRoadBands(project: Project, map: GameMap): { road: RoadBand[]; tram: RoadBand[]; track: RoadBand[] } {
  const lane = laneTileSet(project, map);
  const tram = tramTileSet(project, map);
  const track = trackTileSet(project, map);
  const overlay = map.lowerOverlayTiles as ReadonlyArray<number> | undefined;
  return {
    // 노면전차 레일(2층)이 깔린 칸은 차도 띠에서 뺀다 — 궤도를 가운데 둔 간선은 양쪽 일방 차로 둘로 잡힌다.
    road: lane.size ? findRoadBands(map, (x, y) => lane.has(tileAt(map.lowerTiles, map, x, y)) && !tram.has(tileAt(overlay, map, x, y))) : [],
    tram: tram.size ? findRoadBands(map, (x, y) => tram.has(tileAt(overlay, map, x, y)), { minW: 2, maxW: 2, minLen: 6 }) : [],
    track: track.size ? findRoadBands(map, (x, y) => track.has(tileAt(map.lowerTiles, map, x, y)), { minW: 2, maxW: 2, minLen: 6 }) : [],
  };
}

const describeBand = (b: RoadBand): string => b.axis === "ew"
  ? `동서 띠 y ${b.edge}~${b.edge + b.width - 1}(폭 ${b.width}) x ${b.from}~${b.to}${b.edgeToEdge ? " 가장자리→가장자리" : ""}`
  : `남북 띠 x ${b.edge}~${b.edge + b.width - 1}(폭 ${b.width}) y ${b.from}~${b.to}${b.edgeToEdge ? " 가장자리→가장자리" : ""}`;

/** 노선의 맵 안 몸 칸이 제 길(차·버스 = 1층 생활도로, 지하철·전철 = 1층 선로, 노면전차 = 2층 레일) 밖에 걸리는 곳(최대 6곳). */
function offRoadCells(project: Project, map: GameMap, route: MapTransitRoute): Array<{ x: number; y: number }> {
  const onRail = route.kind === "tram";
  const set = route.kind === "road" || route.kind === "bus" ? laneTileSet(project, map) : route.kind === "tram" ? tramTileSet(project, map) : trackTileSet(project, map);
  if (!set.size) return [];
  const layer = onRail ? (map.lowerOverlayTiles as ReadonlyArray<number> | undefined) : map.lowerTiles;
  const rails = route.kind === "road" || route.kind === "bus" ? tramTileSet(project, map) : new Set<number>();   // 차·버스는 노면전차 궤도 위를 달리지 않는다
  const overlay = map.lowerOverlayTiles as ReadonlyArray<number> | undefined;
  const cells = expandTransitPath(route.path, route.loop === true) ?? [];
  const bad: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i]!;
    const next = cells[Math.min(i + 1, cells.length - 1)]!, prev = cells[Math.max(i - 1, 0)]!;
    const horizontal = next.y === c.y && prev.y === c.y;
    for (const p of horizontal ? [c, { x: c.x, y: c.y + 1 }] : [c, { x: c.x + 1, y: c.y }]) {
      if (!inMapBounds(map, p.x, p.y)) continue;
      const k = `${p.x},${p.y}`;
      if (seen.has(k) || (set.has(tileAt(layer, map, p.x, p.y)) && !rails.has(tileAt(overlay, map, p.x, p.y)))) continue;
      seen.add(k); bad.push(p);
      if (bad.length >= 6) return bad;
    }
  }
  return bad;
}

const WAY_KO: Record<TransitRouteKind, string> = { road: "1층 생활도로(jp-lane-road)", bus: "1층 생활도로(jp-lane-road)", tram: "2층 노면전차 레일(jp-tram-rail-h/v)", train: "1층 선로(jp-subway-track)", subway: "1층 선로(jp-subway-track)" };

/** 정류장마다 「서면 몸이 차지하는 칸」 — 조수가 정문·승강장 앞에 문이 오는지 스스로 고칠 수 있게 돌려준다. */
function stopBodies(map: GameMap, route: MapTransitRoute): Array<{ name: string; x0: number; x1: number; y0: number; y1: number; inMap: number }> {
  const cells = expandTransitPath(route.path, route.loop === true) ?? [];
  const len = Math.max(...route.vehicles.map((id) => transitVehicle(id)?.length ?? 1));
  return (route.stops ?? []).filter((s) => cells[s.index]).map((s) => {
    const head = cells[s.index]!;
    const back = cells[Math.max(s.index - 1, 0)]!, ahead = cells[Math.min(s.index + 1, cells.length - 1)]!;
    const [from, to] = s.index > 0 ? [back, head] : [head, ahead];
    const dir: TransitDir = to.x > from.x ? "right" : to.x < from.x ? "left" : to.y > from.y ? "down" : "up";
    const r = transitFootprintRect(head, dir, len);
    let inside = 0;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (inMapBounds(map, x, y)) inside += 1;
    return { name: s.name ?? `#${s.index}`, x0: r.x, x1: r.x + r.w - 1, y0: r.y, y1: r.y + r.h - 1, inMap: inside / (r.w * r.h) };
  });
}

/** 시험 삼아 120초 돌려 노선마다 탈것이 실제로 다니는지 본다. */
function simReport(map: GameMap): { vehicles: number; perRoute: Record<string, { vehicles: number; onMap: number }>; stuck: string[] } {
  const sim = createTransitSim(map.transit, { width: map.width, height: map.height }, 120);
  const perRoute: Record<string, { vehicles: number; onMap: number }> = {};
  for (const r of sim.routes) perRoute[r.id] = { vehicles: 0, onMap: 0 };
  const stuck: string[] = [];
  for (const v of sim.vehicles) {
    const r = sim.routes[v.routeIndex]!;
    const e = perRoute[r.id]!;
    e.vehicles += 1;
    if (transitRectCells(transitPose(sim, v).rect).some((c) => inMapBounds(map, c.x, c.y))) e.onMap += 1;
    if (v.blockedSec > 30) stuck.push(`${r.id}/${v.def.id} 막힘 ${v.blockedSec.toFixed(0)}초`);
  }
  return { vehicles: sim.vehicles.length, perRoute, stuck };
}

const pointSchema: JsonSchema = { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false };
const boardSchema: JsonSchema = {
  type: "object",
  description: "이 정류장에 선 탈것 옆에서 「조사」하면 이동할 곳(지하철 승강장 맵·다른 마을 등)",
  properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, dir: { type: "string", enum: DIRS } },
  required: ["mapId", "x", "y"], additionalProperties: false,
};
const stopSchema: JsonSchema = {
  type: "object",
  description: "정류장. (x, y) = 경로 위 칸. at:\"center\" 면 서 있을 때 **몸 가운데**가 올 칸(정문·계단 앞 칸을 그대로 주면 문이 그 앞에 온다 — 권장), 생략·\"head\" 면 **머리** 칸.",
  properties: { x: { type: "integer" }, y: { type: "integer" }, at: { type: "string", enum: ["head", "center"], description: "center = (x, y) 가 몸 가운데(권장), head = 머리" }, name: { type: "string" }, waitSec: { type: "number" }, board: boardSchema },
  required: ["x", "y"], additionalProperties: false,
};
const routeSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "노선 id(같은 id 가 있으면 바꾼다)" },
    name: { type: "string" },
    kind: { type: "string", enum: ROUTE_KINDS, description: "road=승용차 흐름, bus=시내버스, tram=노면전차, train=지상 전철, subway=지하철" },
    path: { type: "array", items: pointSchema, description: "탈것 머리가 지나는 칸의 꺾이는 점들(이웃 점은 같은 행 또는 같은 열). 몸 폭 2칸 중 위/왼쪽 칸. 좌측통행 폭 4칸 길: 동쪽행 = 위 끝 행, 서쪽행 = 위 끝+2, 남쪽행 = 왼쪽 끝+2, 북쪽행 = 왼쪽 끝 열. 맵 밖으로 이어지는 노선은 양 끝을 맵 밖 12칸까지 늘인다." },
    loop: { type: "boolean", description: "닫힌 고리(마지막 점 → 첫 점). 순환 버스·노면전차 순환선" },
    vehicles: { type: "array", items: { type: "string", enum: vehicleIds() } },
    count: { type: "integer", description: "loop 노선에 동시에 도는 대수(기본 1)" },
    headwaySec: { type: "number", description: "열린 노선에서 다음 차가 나오는 간격(초)" },
    speed: { type: "number", description: "칸/초(기본 road 4·bus 3·tram 2.5·train/subway 5)" },
    stops: { type: "array", items: stopSchema },
  },
  required: ["id", "kind", "path", "vehicles"],
  additionalProperties: false,
};

function routeFromArgs(raw: Record<string, unknown>): MapTransitRoute {
  const kind = raw.kind as TransitRouteKind;
  const path = (raw.path as Array<{ x: number; y: number }>).map((p) => ({ x: p.x, y: p.y }));
  const loop = raw.loop === true;
  const cells = expandTransitPath(path, loop);
  if (!cells) throw new ToolError(`노선 ${String(raw.id)}: path 의 이웃 점이 같은 행·열이 아니다(대각선) — 꺾이는 점마다 가로 또는 세로로만 잇는다`, { code: "invalid-args" });
  const stops: MapTransitStop[] = [];
  for (const s of (raw.stops as Array<Record<string, unknown>> | undefined) ?? []) {
    const found = cells.findIndex((c) => c.x === s.x && c.y === s.y);
    const len = Math.max(...((raw.vehicles as string[]) ?? []).map((id) => transitVehicle(id)?.length ?? 1), 1);
    const index = found >= 0 && s.at === "center" ? Math.min(headIndexFromCenter(found, len), cells.length - 1) : found;
    if (found < 0) throw new ToolError(`노선 ${String(raw.id)}: 정류장 (${String(s.x)},${String(s.y)}) 이 경로 칸이 아니다 — 머리가 지나는 경로 위 칸을 준다(경로 ${path.map((p) => `(${p.x},${p.y})`).join("→")})`, { code: "invalid-args" });
    stops.push({ index, ...(typeof s.name === "string" ? { name: s.name } : {}), ...(typeof s.waitSec === "number" ? { waitSec: s.waitSec } : {}), ...(s.board ? { board: s.board as MapTransitStop["board"] } : {}) });
  }
  return {
    id: String(raw.id), kind, path, vehicles: [...(raw.vehicles as string[])],
    ...(typeof raw.name === "string" ? { name: raw.name } : {}),
    ...(loop ? { loop: true } : {}),
    ...(typeof raw.count === "number" ? { count: raw.count } : {}),
    ...(typeof raw.headwaySec === "number" ? { headwaySec: raw.headwaySec } : {}),
    ...(typeof raw.speed === "number" ? { speed: raw.speed } : {}),
    ...(stops.length ? { stops } : {}),
  };
}

export const INSPECT_MAP_TRANSIT_TOOL: ToolDefinition = {
  name: "inspect_map_transit",
  mode: "read",
  domains: ["map", "tile"],
  fillsCurrentMapId: true,
  description: "맵의 탈것(차 흐름·버스·노면전차·전철·지하철) 상태를 본다 — 길 그림에서 찾은 차도 띠(좌표·폭·가장자리 연결)·노면전차 레일·지하철/전철 선로, 지금 깔린 노선, 120초 미리 돌린 결과(노선별 대수·막힌 차). set_map_transit 전에 띠 좌표를 확인하고, 깐 뒤에는 차가 실제로 다니는지 이것으로 확인한다.",
  parameters: { type: "object", properties: { mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵)" } }, additionalProperties: false },
  run(project, args): ToolExecResult {
    const map = requireMap(project, String(args.mapId ?? ""));
    const bands = mapRoadBands(project, map);
    const { routes, problems } = normalizeMapTransit(map.transit, { width: map.width, height: map.height });
    const sim = routes.length ? simReport(map) : null;
    const lines = [
      `차도 띠 ${bands.road.length}개: ${bands.road.map(describeBand).join(" / ") || "없음(1층 생활도로 칸이 없다)"}`,
      `노면전차 레일 ${bands.tram.length}개: ${bands.tram.map(describeBand).join(" / ") || "없음"}`,
      `지하철·전철 선로 ${bands.track.length}개: ${bands.track.map((b) => `${describeBand(b)} → 경로 머리 ${b.axis === "ew" ? `행 y=${b.edge}` : `열 x=${b.edge}`}`).join(" / ") || "없음"}${bands.track.length ? " (set_map_transit auto.subway 로 깐다)" : ""}`,
      `노선 ${routes.length}개: ${routes.map((r) => `${r.id}(${KIND_KO[r.kind]}, ${r.cells.length}칸${r.loop ? " 고리" : ""}, 정류장 ${r.stops.length})`).join(", ") || "없음"}`,
      ...(problems.length ? [`문제: ${problems.map((p) => `${p.routeId}: ${p.message}`).join(" / ")}`] : []),
      ...(sim ? [`120초 뒤 탈것 ${sim.vehicles}대${sim.stuck.length ? ` · 막힘 ${sim.stuck.join(", ")}` : ""}`] : []),
    ];
    return { summary: lines.join("\n"), data: { mapId: map.id, roadBands: bands.road, tramBands: bands.tram, trackBands: bands.track, routes: map.transit?.routes ?? [], problems, sim } };
  },
};

/**
 * set_map_transit 인자 → 새 노선 목록(맵은 바꾸지 않는다). 편집기 「탈것」 칸의 자동 버튼도 이것을 부른다.
 * 고칠 수 없는 입력이면 ToolError 를 던진다.
 */
export function planMapTransit(draft: Project, map: GameMap, args: Record<string, unknown>): { routes: MapTransitRoute[]; next: MapTransit; notes: string[]; warnings: string[] } {
  const W = map.width, H = map.height;
  let routes: MapTransitRoute[] = args.clear === true ? [] : structuredClone(map.transit?.routes ?? []);
  const notes: string[] = [];
  const warnings: string[] = [];
  if (Array.isArray(args.removeRouteIds)) {
    const rm = new Set(args.removeRouteIds as string[]);
    routes = routes.filter((r) => !rm.has(r.id));
  }
  const auto = args.auto && typeof args.auto === "object" ? (args.auto as Record<string, unknown>) : null;
  if (auto) {
    const bands = mapRoadBands(draft, map);
    const onlyRail = Boolean(auto.subway || auto.tram === true) && auto.traffic === undefined && !Array.isArray(auto.busStops);
    routes = routes.filter((r) => !(onlyRail ? (auto.tram === true ? /^tram-/ : /^$/) : /^(traffic|bus|tram)-/).test(r.id));
    if (!onlyRail && (auto.traffic !== false || Array.isArray(auto.busStops))) {
      const usable = bands.road.filter((b) => b.edgeToEdge);
      if (!usable.length) {
        throw new ToolError(`자동으로 깔 차도가 없다 — 가장자리에서 가장자리까지 이어진 생활도로 띠(1층 ${LANE_GROUP}, 폭 2~8칸)를 찾지 못했다. 찾은 띠: ${bands.road.map(describeBand).join(" / ") || "없음"}. 길을 맵 끝까지 잇거나, routes 로 칸 경로를 직접 준다.`, { code: "no-road", mapId: map.id });
      }
      const made = autoTrafficRoutes(bands.road, map, {
        ...(typeof auto.headwaySec === "number" ? { headwaySec: auto.headwaySec } : {}),
        ...(Array.isArray(auto.vehicles) ? { vehicles: auto.vehicles as string[] } : {}),
        ...(Array.isArray(auto.busStops) ? { busStops: auto.busStops as NonNullable<Parameters<typeof autoTrafficRoutes>[2]>["busStops"] } : {}),
        ...(typeof auto.busHeadwaySec === "number" ? { busHeadwaySec: auto.busHeadwaySec } : {}),
      });
      if (made.unmatchedStops.length) {
        throw new ToolError(`버스 정류장 ${made.unmatchedStops.map((s) => `(${s.x},${s.y})`).join(" ")} 이 어느 차선 위도 아니다 — 버스 머리가 서는 **차선 칸**을 준다. 차선: ${usable.map((b) => b.axis === "ew" ? `y ${b.edge}~${b.edge + 1}(동쪽행)${b.width >= 4 ? ` · y ${b.edge + b.width - 2}~${b.edge + b.width - 1}(서쪽행)` : ""}` : `x ${b.edge + (b.width >= 4 ? b.width - 2 : 0)}~${b.edge + (b.width >= 4 ? b.width - 1 : 1)}(남쪽행)${b.width >= 4 ? ` · x ${b.edge}~${b.edge + 1}(북쪽행)` : ""}`).join(" / ")}`, { code: "invalid-args", mapId: map.id });
      }
      routes.push(...made.routes.filter((r) => auto.traffic !== false || r.kind === "bus"));
      notes.push(`차도 띠 ${usable.length}개(${usable.map(describeBand).join(" / ")})`);
    }
    if (auto.tram === true) {
      const rails = bands.tram.filter((b) => b.edgeToEdge);
      if (!rails.length) throw new ToolError(`노면전차 레일이 가장자리→가장자리로 이어지지 않는다 — 2층에 jp-tram-rail-h(가로 2줄)/jp-tram-rail-v(세로 2열)를 맵 끝까지 잇거나 routes 로 kind:"tram" 경로를 직접 준다. 찾은 레일: ${bands.tram.map(describeBand).join(" / ") || "없음"}`, { code: "no-rail", mapId: map.id });
      // 복선: 같은 축에서 4칸 안에 나란한 두 레일 = 좌측통행(동서 길이면 위 레일 동쪽행·아래 레일 서쪽행, 남북 길이면 왼쪽 북쪽행·오른쪽 남쪽행).
      // 단선(짝 없는 레일)은 한 방향만 — 마주 오는 전차가 한 레일에서 만나면 서로 비켜 갈 수 없다.
      const used = new Set<RoadBand>();
      const matchedTramStops = new Set<Record<string, unknown>>();
      for (const b of rails) {
        if (used.has(b)) continue;
        const mate = rails.find((o) => o !== b && !used.has(o) && o.axis === b.axis && o.edge > b.edge && o.edge - b.edge <= 4);
        used.add(b); if (mate) used.add(mate);
        const lanes: Array<[RoadBand, TransitDir]> = mate
          ? (b.axis === "ew" ? [[b, "right"], [mate, "left"]] : [[b, "up"], [mate, "down"]])
          : [[b, b.axis === "ew" ? "left" : "down"]];
        for (const [band, dir] of lanes) {
          const OFF = 16;
          const along = band.axis === "ew" ? W : H;
          const [a0, z0] = dir === "right" || dir === "down" ? [-OFF, along - 1 + OFF] : [along - 1 + OFF, -OFF];
          const path = band.axis === "ew" ? [{ x: a0, y: band.edge }, { x: z0, y: band.edge }] : [{ x: band.edge, y: a0 }, { x: band.edge, y: z0 }];
          const stops = ((auto.tramStops as Array<Record<string, unknown>> | undefined) ?? [])
            .map((s) => ({ s, index: straightPathIndex(path, s.x as number, s.y as number) })).filter((e): e is { s: Record<string, unknown>; index: number } => e.index !== null)
            .map((e) => { matchedTramStops.add(e.s); return e; })
            .map(({ s, index }) => ({ index: s.at === "center" ? headIndexFromCenter(index, transitVehicle("jp-tram")?.length ?? 12) : index, ...(typeof s.name === "string" ? { name: s.name } : {}), ...(typeof s.waitSec === "number" ? { waitSec: s.waitSec } : {}), ...(s.board ? { board: s.board as MapTransitStop["board"] } : {}) }));
          routes.push({ id: `tram-${band.axis}${band.edge}-${dir}`, name: "노면전차", kind: "tram", path, vehicles: ["jp-tram"], headwaySec: 45, ...(stops.length ? { stops } : {}) });
        }
        if (!mate) warnings.push(`노면전차 레일 ${describeBand(b)} 은 단선이라 한 방향(${b.axis === "ew" ? "서쪽행" : "남쪽행"})만 다닌다 — 양방향이면 레일을 한 줄 더(4칸 안에 나란히) 깐다`);
      }
      const lost = ((auto.tramStops as Array<Record<string, unknown>> | undefined) ?? []).filter((t) => !matchedTramStops.has(t));
      if (lost.length) throw new ToolError(`노면전차 정류장 ${lost.map((t) => `(${String(t.x)},${String(t.y)})`).join(" ")} 이 레일 위가 아니다 — 전차 머리가 서는 레일 칸(레일 2줄 중 하나)을 준다. 레일: ${rails.map(describeBand).join(" / ")}`, { code: "invalid-args", mapId: map.id });
      notes.push(`노면전차 레일 ${rails.length}줄`);
    }
  }
  const sub = auto && auto.subway && typeof auto.subway === "object" ? (auto.subway as Record<string, unknown>) : null;
  if (sub) {
    const bands = mapRoadBands(draft, map).track.filter((b) => b.edgeToEdge);
    if (!bands.length) throw new ToolError(`지하철·전철 선로가 가장자리→가장자리로 이어지지 않는다 — 1층에 jp-subway-track(2줄)을 맵 끝까지 깔거나 routes 로 kind:"subway" 경로를 직접 준다. 찾은 선로: ${mapRoadBands(draft, map).track.map(describeBand).join(" / ") || "없음"}`, { code: "no-rail", mapId: map.id });
    const vehicleId = typeof sub.vehicle === "string" ? sub.vehicle : "jp-subway";
    const def = transitVehicle(vehicleId);
    if (!def || (def.kind !== "subway" && def.kind !== "train")) throw new ToolError(`auto.subway.vehicle '${vehicleId}' 은 지하철·전철이 아니다 — jp-subway 또는 jp-train-commuter`, { code: "invalid-args", mapId: map.id });
    const kind: TransitRouteKind = def.kind;
    routes = routes.filter((r) => !/^(subway|train)-(ew|ns)\d+-/.test(r.id));
    const len = def.length;
    const OFF = len + 6;
    const used = new Set<RoadBand>();
    for (const b of bands) {
      if (used.has(b)) continue;
      const mate = bands.find((o) => o !== b && !used.has(o) && o.axis === b.axis && o.edge > b.edge && o.edge - b.edge <= 6);
      used.add(b); if (mate) used.add(mate);
      const lanes: Array<[RoadBand, TransitDir]> = mate
        ? (b.axis === "ew" ? [[b, "right"], [mate, "left"]] : [[b, "up"], [mate, "down"]])
        : [[b, b.axis === "ew" ? "right" : "down"]];
      for (const [band, dir] of lanes) {
        const along = band.axis === "ew" ? W : H;
        const forward = dir === "right" || dir === "down";
        const [a0, z0] = forward ? [-OFF, along - 1 + OFF] : [along - 1 + OFF, -OFF];
        const path = band.axis === "ew" ? [{ x: a0, y: band.edge }, { x: z0, y: band.edge }] : [{ x: band.edge, y: a0 }, { x: band.edge, y: z0 }];
        // 몸 가운데 = center(기본 맵 가운데). 몸이 맵 안에 다 들어가게 머리를 조인다(맵이 열차보다 짧으면 가운데 정렬).
        const want = typeof (band.axis === "ew" ? sub.centerX : sub.centerY) === "number" ? Number(band.axis === "ew" ? sub.centerX : sub.centerY) : Math.floor((along - 1) / 2);
        const half = Math.floor((len - 1) / 2);
        let head = forward ? want + half : want - half;
        if (len <= along) head = forward ? Math.min(Math.max(head, len - 1), along - 1) : Math.max(Math.min(head, along - len), 0);
        const index = forward ? head - a0 : a0 - head;
        const stop: MapTransitStop = { index, name: typeof sub.stopName === "string" ? sub.stopName : map.name, waitSec: typeof sub.waitSec === "number" ? sub.waitSec : 12, ...(sub.board ? { board: sub.board as MapTransitStop["board"] } : {}) };
        routes.push({ id: `${kind}-${band.axis}${band.edge}-${dir}`, name: typeof sub.name === "string" ? sub.name : KIND_KO[kind], kind, path, vehicles: [vehicleId], headwaySec: typeof sub.headwaySec === "number" ? sub.headwaySec : 40, speed: 6, stops: [stop] });
      }
    }
    notes.push(`선로 ${bands.length}줄(${bands.map(describeBand).join(" / ")})`);
  }
  if (Array.isArray(args.routes)) {
    for (const raw of args.routes as Array<Record<string, unknown>>) {
      const r = routeFromArgs(raw);
      const allowed = TRANSIT_ROUTE_VEHICLE_KINDS[r.kind];
      const wrong = r.vehicles.filter((id) => !allowed.includes(transitVehicle(id)?.kind ?? ("?" as never)));
      if (wrong.length) throw new ToolError(`노선 ${r.id}(${KIND_KO[r.kind]})에 맞지 않는 탈것: ${wrong.join(", ")} — ${r.kind} 노선에는 ${allowed.join("·")} 종류만`, { code: "invalid-args", mapId: map.id });
      routes = routes.filter((x) => x.id !== r.id);
      routes.push(r);
    }
  }
  if (!auto && !Array.isArray(args.routes) && !Array.isArray(args.removeRouteIds) && args.clear !== true) {
    throw new ToolError("바꿀 것이 없다 — auto:{} · routes · removeRouteIds · clear 중 하나를 준다", { code: "invalid-args", mapId: map.id });
  }
  const next: MapTransit = { routes };
  const { problems } = normalizeMapTransit(next, { width: W, height: H });
  if (problems.length) throw new ToolError(`노선을 깔지 않았다 — ${problems.map((p) => `${p.routeId}: ${p.message}`).join(" / ")}`, { code: "invalid-route", mapId: map.id });
  for (const r of routes) {
    const off = offRoadCells(draft, map, r);
    if (off.length) throw new ToolError(`노선을 깔지 않았다 — ${r.id}(${KIND_KO[r.kind]})의 몸이 길 밖 칸 ${off.map((c) => `(${c.x},${c.y})`).join(" ")} 에 걸린다. 몸 폭 2칸(가로로 달리면 머리 행·그 아래 행, 세로면 머리 열·그 오른쪽 열)이 모두 ${WAY_KO[r.kind]} 이어야 한다. 경로 머리 행 = 띠의 위 끝 행(세로면 왼쪽 끝 열). inspect_map_transit 로 띠 좌표를 본다.`, { code: r.kind === "road" || r.kind === "bus" ? "off-road" : "off-track", mapId: map.id, x: off[0]!.x, y: off[0]!.y });
    for (const b of stopBodies(map, r)) if (b.inMap < 0.6) warnings.push(`${r.id} 정류장 ${b.name}: 서면 몸이 x ${b.x0}~${b.x1}, y ${b.y0}~${b.y1} — ${Math.round(b.inMap * 100)}% 만 맵 안이다. 승강장·정문 앞에 오도록 at:"center" 로 몸 가운데 칸을 준다`);
    for (const s of r.stops ?? []) {
      if (!s.board) continue;
      const dest = draft.maps[s.board.mapId];
      if (!dest) throw new ToolError(`노선 ${r.id} 정류장의 board.mapId '${s.board.mapId}' 맵이 없다`, { code: "map-not-found", mapId: map.id });
      if (!inMapBounds(dest, s.board.x, s.board.y)) throw new ToolError(`노선 ${r.id} 정류장의 board (${s.board.x},${s.board.y}) 가 ${dest.name}(${dest.width}×${dest.height}) 밖이다`, { code: "invalid-args", mapId: map.id });
    }
  }
  return { routes, next, notes, warnings };
}

export const SET_MAP_TRANSIT_TOOL: ToolDefinition = {
  name: "set_map_transit",
  mode: "write",
  domains: ["map", "tile"],
  fillsCurrentMapId: true,
  description: "맵에 탈것을 다니게 한다(게임에서 실제로 움직이고, 주인공 앞에서는 서고, 정류장에서 문을 열고, board 가 있으면 「조사」로 탄다). "
    + "가장 쉬운 길: auto:{} — 1층 생활도로(jp-lane-road) 그림에서 가장자리→가장자리 곧은 띠를 찾아 좌측통행 두 방향 차 흐름을 깐다. auto.busStops 로 버스 정류장을 주면 그 차선에 시내버스 노선이 붙는다 — 정문 앞에 버스 문이 오게 하려면 {x: 정문 가운데 x, y: 그 앞 차선 행, at:\"center\"}. auto.tram:true 면 2층 노면전차 레일(jp-tram-rail-h/v) 위로 노면전차. "
    + "지하철·전철 승강장 맵은 auto.subway:{board:{mapId,x,y}, stopName, centerX} 하나면 된다(1층 jp-subway-track 선로를 찾아 30칸 열차를 승강장 가운데에 세운다). 결과 요약의 「서면 몸 x a~b」 로 문 위치를 확인한다. "
    + "굽은 길·순환선·지하철·전철은 routes 로 칸 경로를 직접 준다(먼저 inspect_map_transit 로 띠 좌표를 본다). 차·버스 노선은 몸이 차도 밖에 걸리면 깔지 않는다. "
    + "routes 로 지하철을 직접 줄 때: 경로 머리 행 = 선로 2줄의 위 행, 맵 밖 36칸→맵 밖 36칸, stops 는 at:\"center\" + board. 지상 지하철 출입구(jp-subway-entrance)는 탈것이 아니라 그 안 칸의 이동 이벤트로 승강장 맵에 잇는다. "
    + `탈것 목록: ${vehicleLine()}. 노선 종류별 허용 탈것: road=승용·택시·경차·트럭, bus=버스, tram=노면전차, train=전철, subway=지하철.`,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵)" },
      auto: {
        type: "object",
        description: "길·레일·선로 그림에서 자동으로 깐다. 이전에 자동으로 깐 노선(traffic-*·bus-*·tram-*, subway 를 주면 subway-*/train-*)은 바꾼다. subway 나 tram 만 주면 차 흐름은 깔지 않는다.",
        properties: {
          traffic: { type: "boolean", description: "차 흐름(기본 true)" },
          headwaySec: { type: "number", description: "차 간격 초(기본 7). 한산한 주택가 10~14, 큰길 4~6" },
          vehicles: { type: "array", items: { type: "string", enum: vehicleIds() }, description: "차 흐름에 쓸 탈것(기본 승용·택시·경차·트럭 섞음)" },
          busStops: { type: "array", items: stopSchema, description: "버스 정류장 — (x, y) 는 버스 머리가 서는 차선 칸(그 칸을 지나는 방향 차선)" },
          busHeadwaySec: { type: "number", description: "버스 간격 초(기본 35)" },
          tram: { type: "boolean", description: "2층 노면전차 레일 위로 노면전차(가장자리→가장자리 레일만)" },
          tramStops: { type: "array", items: stopSchema, description: "노면전차 정류장(레일 칸, at:\"center\" 권장) — jp-tram-stop 안전지대 옆" },
          subway: {
            type: "object",
            description: "지하철·전철 승강장: 1층 선로(jp-subway-track, 맵 끝→끝 2줄)를 찾아 열차가 맵 밖에서 들어와 승강장 앞에 서서 문을 열고 떠나게 한다. 선로가 둘(6칸 안에 나란히)이면 양방향. 차 흐름은 따로 주지 않으면 깔지 않는다.",
            properties: {
              vehicle: { type: "string", enum: ["jp-subway", "jp-train-commuter"], description: "기본 jp-subway(30칸). 지상 전철 승강장이면 jp-train-commuter" },
              name: { type: "string", description: "노선 이름(예: 地下鉄 さくら線)" },
              stopName: { type: "string", description: "역 이름(기본 맵 이름)" },
              board: boardSchema,
              centerX: { type: "integer", description: "가로 선로에서 열차 몸 가운데가 설 x(기본 맵 가운데 — 승강장 계단 앞 등)" },
              centerY: { type: "integer", description: "세로 선로에서 몸 가운데 y" },
              waitSec: { type: "number", description: "정차 초(기본 12)" },
              headwaySec: { type: "number", description: "열차 간격 초(기본 40)" },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      routes: { type: "array", items: routeSchema, description: "직접 주는 노선(같은 id 는 바꾸고 나머지는 둔다)" },
      removeRouteIds: { type: "array", items: { type: "string" } },
      clear: { type: "boolean", description: "이 맵의 노선을 모두 지운다" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { auto: { busStops: [{ x: 30, y: 44, name: "学校前" }] } },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, String(args.mapId ?? ""));
    const { routes, next, notes, warnings } = planMapTransit(draft, map, args);
    if (routes.length) map.transit = next; else delete map.transit;
    const sim = routes.length ? simReport(map) : null;
    const quiet = sim ? Object.entries(sim.perRoute).filter(([, e]) => e.vehicles === 0).map(([id]) => id) : [];
    if (quiet.length) warnings.push(`120초 돌려도 탈것이 나오지 않은 노선: ${quiet.join(", ")} — 간격(headwaySec)·시작 칸이 막혔는지 본다`);
    if (sim?.stuck.length) warnings.push(`오래 막힌 탈것: ${sim.stuck.slice(0, 4).join(", ")} — 경로가 다른 노선과 겹치거나 막다른 곳에서 끝난다`);
    const byKind = routes.reduce<Record<string, number>>((acc, r) => ({ ...acc, [KIND_KO[r.kind]]: (acc[KIND_KO[r.kind]] ?? 0) + 1 }), {});
    const stopLines = routes.flatMap((r) => stopBodies(map, r).map((b) => `${KIND_KO[r.kind]} 정류장 ${b.name}: 서면 몸 x ${b.x0}~${b.x1}, y ${b.y0}~${b.y1}(문은 ${r.kind === "road" ? "-" : "몸 가운데쯤"})`));
    if (stopLines.length) notes.push(stopLines.join(" / "));
    return {
      summary: routes.length
        ? `${map.name} 탈것 노선 ${routes.length}개(${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(", ")}) — ${notes.join(" · ")}${sim ? ` · 120초 시험: 탈것 ${sim.vehicles}대` : ""}. 게임에서 차는 주인공 앞에서 서고, 정류장에서 문을 연다.`
        : `${map.name} 탈것 노선을 모두 지웠다`,
      data: { mapId: map.id, routes: routes.map((r) => ({ id: r.id, kind: r.kind, path: r.path, stops: r.stops ?? [] })), sim },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const TRANSIT_TOOLS: readonly ToolDefinition[] = [INSPECT_MAP_TRANSIT_TOOL, SET_MAP_TRANSIT_TOOL];
