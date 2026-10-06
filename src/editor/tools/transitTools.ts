// 맵 위 탈것(승용차 흐름·시내버스·노면전차·전철·지하철) 도구.
//   inspect_map_transit : 길 그림에서 찾은 차도 띠·노면전차 레일, 지금 노선, 미리 돌린 탈것 상태를 돌려준다(읽기).
//   set_map_transit     : 노선을 깐다. auto = 길 그림에서 차 흐름(좌측통행 두 방향)과 버스 정류장을 자동으로,
//                         routes = 칸 경로를 직접(굽은 길·순환선·노면전차·전철), clear/removeRouteIds = 지우기.
// 저장 모양·시뮬레이션은 src/project/mapTransit.ts, 길 띠 찾기는 src/project/transitAuto.ts. 그림 목록은 src/assets/jpCityVehicles.json.
import {
  createTransitSim, expandTransitPath, normalizeMapTransit, transitPose, transitRectCells, transitVehicle, transitVehicleCatalog,
  TRANSIT_ROUTE_VEHICLE_KINDS, type MapTransit, type MapTransitRoute, type MapTransitStop, type TransitDir, type TransitRouteKind,
} from "@/project/mapTransit";
import { autoTrafficRoutes, findRoadBands, straightPathIndex, type RoadBand } from "@/project/transitAuto";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const ROUTE_KINDS: TransitRouteKind[] = ["road", "bus", "tram", "train", "subway"];
const DIRS: TransitDir[] = ["right", "left", "up", "down"];
const KIND_KO: Record<TransitRouteKind, string> = { road: "차 흐름", bus: "버스", tram: "노면전차", train: "전철", subway: "지하철" };
/** 차·버스가 달려도 되는 1층 칸 = 생활도로 오토타일 묶음. */
const LANE_GROUP = "jp-lane-road";
const TRAM_RAIL_KITS = ["jp-tram-rail-h", "jp-tram-rail-v", "jp-tram-rail-end"];

const vehicleIds = (): string[] => transitVehicleCatalog().map((v) => v.id);
const vehicleLine = (): string => transitVehicleCatalog().map((v) => `${v.id}(${v.kind}, 길이 ${v.length}칸)`).join(", ");

function laneTileSet(project: Project, map: GameMap): Set<number> {
  const ts = project.tilesets[map.tilesetId];
  return new Set(ts?.autotileGroups?.find((g) => g.id === LANE_GROUP)?.memberTileIds ?? []);
}
function tramTileSet(project: Project, map: GameMap): Set<number> {
  const ts = project.tilesets[map.tilesetId];
  const out = new Set<number>();
  for (const k of ts?.structureKits ?? []) {
    if (!TRAM_RAIL_KITS.includes(k.id)) continue;
    for (const row of k.rows ?? []) for (const t of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) if (typeof t === "number" && t >= 0) out.add(t);
  }
  return out;
}
const tileAt = (arr: ReadonlyArray<number> | undefined, map: GameMap, x: number, y: number): number => (arr && inMapBounds(map, x, y) ? arr[y * map.width + x] ?? -1 : -1);

export function mapRoadBands(project: Project, map: GameMap): { road: RoadBand[]; tram: RoadBand[] } {
  const lane = laneTileSet(project, map);
  const tram = tramTileSet(project, map);
  const overlay = map.lowerOverlayTiles as ReadonlyArray<number> | undefined;
  return {
    road: lane.size ? findRoadBands(map, (x, y) => lane.has(tileAt(map.lowerTiles, map, x, y))) : [],
    tram: tram.size ? findRoadBands(map, (x, y) => tram.has(tileAt(overlay, map, x, y)), { minW: 2, maxW: 2, minLen: 6 }) : [],
  };
}

const describeBand = (b: RoadBand): string => b.axis === "ew"
  ? `동서 띠 y ${b.edge}~${b.edge + b.width - 1}(폭 ${b.width}) x ${b.from}~${b.to}${b.edgeToEdge ? " 가장자리→가장자리" : ""}`
  : `남북 띠 x ${b.edge}~${b.edge + b.width - 1}(폭 ${b.width}) y ${b.from}~${b.to}${b.edgeToEdge ? " 가장자리→가장자리" : ""}`;

/** 차·버스 노선의 맵 안 몸 칸이 차도 밖에 걸리는 곳(최대 6곳). */
function offRoadCells(project: Project, map: GameMap, route: MapTransitRoute): Array<{ x: number; y: number }> {
  if (route.kind !== "road" && route.kind !== "bus") return [];
  const lane = laneTileSet(project, map);
  if (!lane.size) return [];
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
      if (seen.has(k) || lane.has(tileAt(map.lowerTiles, map, p.x, p.y))) continue;
      seen.add(k); bad.push(p);
      if (bad.length >= 6) return bad;
    }
  }
  return bad;
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
  description: "정류장. (x, y) = 탈것 **머리**가 서는 경로 칸(노선 path 위 칸).",
  properties: { x: { type: "integer" }, y: { type: "integer" }, name: { type: "string" }, waitSec: { type: "number" }, board: boardSchema },
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
    const index = cells.findIndex((c) => c.x === s.x && c.y === s.y);
    if (index < 0) throw new ToolError(`노선 ${String(raw.id)}: 정류장 (${String(s.x)},${String(s.y)}) 이 경로 칸이 아니다 — 머리가 지나는 경로 위 칸을 준다(경로 ${path.map((p) => `(${p.x},${p.y})`).join("→")})`, { code: "invalid-args" });
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
  description: "맵의 탈것(차 흐름·버스·노면전차·전철·지하철) 상태를 본다 — 길 그림에서 찾은 차도 띠(좌표·폭·가장자리 연결)와 노면전차 레일, 지금 깔린 노선, 120초 미리 돌린 결과(노선별 대수·막힌 차). set_map_transit 전에 띠 좌표를 확인하고, 깐 뒤에는 차가 실제로 다니는지 이것으로 확인한다.",
  parameters: { type: "object", properties: { mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵)" } }, additionalProperties: false },
  run(project, args): ToolExecResult {
    const map = requireMap(project, String(args.mapId ?? ""));
    const bands = mapRoadBands(project, map);
    const { routes, problems } = normalizeMapTransit(map.transit, { width: map.width, height: map.height });
    const sim = routes.length ? simReport(map) : null;
    const lines = [
      `차도 띠 ${bands.road.length}개: ${bands.road.map(describeBand).join(" / ") || "없음(1층 생활도로 칸이 없다)"}`,
      `노면전차 레일 ${bands.tram.length}개: ${bands.tram.map(describeBand).join(" / ") || "없음"}`,
      `노선 ${routes.length}개: ${routes.map((r) => `${r.id}(${KIND_KO[r.kind]}, ${r.cells.length}칸${r.loop ? " 고리" : ""}, 정류장 ${r.stops.length})`).join(", ") || "없음"}`,
      ...(problems.length ? [`문제: ${problems.map((p) => `${p.routeId}: ${p.message}`).join(" / ")}`] : []),
      ...(sim ? [`120초 뒤 탈것 ${sim.vehicles}대${sim.stuck.length ? ` · 막힘 ${sim.stuck.join(", ")}` : ""}`] : []),
    ];
    return { summary: lines.join("\n"), data: { mapId: map.id, roadBands: bands.road, tramBands: bands.tram, routes: map.transit?.routes ?? [], problems, sim } };
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
    routes = routes.filter((r) => !/^(traffic|bus|tram)-/.test(r.id));
    if (auto.traffic !== false || Array.isArray(auto.busStops)) {
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
            .map(({ s, index }) => ({ index, ...(typeof s.name === "string" ? { name: s.name } : {}), ...(typeof s.waitSec === "number" ? { waitSec: s.waitSec } : {}), ...(s.board ? { board: s.board as MapTransitStop["board"] } : {}) }));
          routes.push({ id: `tram-${band.axis}${band.edge}-${dir}`, name: "노면전차", kind: "tram", path, vehicles: ["jp-tram"], headwaySec: 45, ...(stops.length ? { stops } : {}) });
        }
        if (!mate) warnings.push(`노면전차 레일 ${describeBand(b)} 은 단선이라 한 방향(${b.axis === "ew" ? "서쪽행" : "남쪽행"})만 다닌다 — 양방향이면 레일을 한 줄 더(4칸 안에 나란히) 깐다`);
      }
      const lost = ((auto.tramStops as Array<Record<string, unknown>> | undefined) ?? []).filter((t) => !matchedTramStops.has(t));
      if (lost.length) throw new ToolError(`노면전차 정류장 ${lost.map((t) => `(${String(t.x)},${String(t.y)})`).join(" ")} 이 레일 위가 아니다 — 전차 머리가 서는 레일 칸(레일 2줄 중 하나)을 준다. 레일: ${rails.map(describeBand).join(" / ")}`, { code: "invalid-args", mapId: map.id });
      notes.push(`노면전차 레일 ${rails.length}줄`);
    }
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
    if (off.length) throw new ToolError(`노선을 깔지 않았다 — ${r.id}(${KIND_KO[r.kind]})의 몸이 차도 밖 칸 ${off.map((c) => `(${c.x},${c.y})`).join(" ")} 에 걸린다. 몸 폭 2칸(가로로 달리면 머리 행·그 아래 행, 세로면 머리 열·그 오른쪽 열)이 모두 1층 생활도로여야 한다. inspect_map_transit 로 띠 좌표를 본다.`, { code: "off-road", mapId: map.id, x: off[0]!.x, y: off[0]!.y });
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
    + "가장 쉬운 길: auto:{} — 1층 생활도로(jp-lane-road) 그림에서 가장자리→가장자리 곧은 띠를 찾아 좌측통행 두 방향 차 흐름을 깐다. auto.busStops 로 버스 정류장(버스 머리가 서는 차선 칸)을 주면 그 차선에 시내버스 노선이 붙는다. auto.tram:true 면 2층 노면전차 레일(jp-tram-rail-h/v) 위로 노면전차. "
    + "굽은 길·순환선·지하철·전철은 routes 로 칸 경로를 직접 준다(먼저 inspect_map_transit 로 띠 좌표를 본다). 차·버스 노선은 몸이 차도 밖에 걸리면 깔지 않는다. "
    + "지하철·전철 승강장 맵: 선로 위 칸 경로(맵 밖→맵 밖) + stops 에 board(타면 갈 맵·칸). 지상 지하철 출입구(jp-subway-entrance)는 탈것이 아니라 그 안 칸의 이동 이벤트로 승강장 맵에 잇는다. "
    + `탈것 목록: ${vehicleLine()}. 노선 종류별 허용 탈것: road=승용·택시·경차·트럭, bus=버스, tram=노면전차, train=전철, subway=지하철.`,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵)" },
      auto: {
        type: "object",
        description: "길 그림에서 자동으로 깐다. 이전에 자동으로 깐 노선(traffic-*·bus-*·tram-*)은 바꾼다.",
        properties: {
          traffic: { type: "boolean", description: "차 흐름(기본 true)" },
          headwaySec: { type: "number", description: "차 간격 초(기본 7). 한산한 주택가 10~14, 큰길 4~6" },
          vehicles: { type: "array", items: { type: "string", enum: vehicleIds() }, description: "차 흐름에 쓸 탈것(기본 승용·택시·경차·트럭 섞음)" },
          busStops: { type: "array", items: stopSchema, description: "버스 정류장 — (x, y) 는 버스 머리가 서는 차선 칸(그 칸을 지나는 방향 차선)" },
          busHeadwaySec: { type: "number", description: "버스 간격 초(기본 35)" },
          tram: { type: "boolean", description: "2층 노면전차 레일 위로 노면전차(가장자리→가장자리 레일만)" },
          tramStops: { type: "array", items: stopSchema, description: "노면전차 정류장(전차 머리가 서는 레일 칸) — jp-tram-stop 안전지대 옆" },
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
