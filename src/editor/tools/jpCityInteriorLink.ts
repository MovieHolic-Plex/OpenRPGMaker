// 일본 도시(jp_city) 거리 건물의 문 ↔ 실내 맵을 한 번에 잇는다 — link_jp_city_interior.
//   거리 쪽: 문 칸은 건물 맨 아래 줄이라 막혀 있다(밟히지 않음). 그래서 문 앞 접근칸(문 바로 아래 통행 칸)에
//            밟으면 들어가는 발판을 둔다 — author_house 의 집 문(createHouseDoorStepEvent)과 같은 배치.
//   실내 쪽: 장소 평면의 맨 아래 줄 출입구 틈(현관 문턱·자동문)이 나가는 발판이다. 도착은 틈 바로 위 칸.
//   나올 때는 거리의 문 앞 한 칸 더 아래(발판을 다시 밟지 않게)에 내린다.
// 실내는 등록 장소 id(place — 여러 층이면 층마다 새 맵, 첫 층에 잇는다) 또는 이미 있는 실내 맵(interiorMapId).
import { isJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { isPassable } from "@/project/collision";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { importReferenceScene, preloadRegionReferenceScene, regionReferenceScene } from "@/project/regionReferenceImport";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };

const inside = (map: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
const eventAt = (map: GameMap, c: Cell): GameEvent | undefined => (map.events ?? []).find((e) => e.x === c.x && e.y === c.y);

function gateEvent(id: string, name: string, at: Cell, to: { mapId: string; x: number; y: number }): GameEvent {
  return {
    id, x: at.x, y: at.y, name,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_page`, name, conditions: [], graphic: { transparent: true },
      trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "transfer", mapId: to.mapId as MapId, x: to.x, y: to.y, fade: "black" }],
    }],
  } as GameEvent;
}

function uniqueEventId(project: Project, base: string): string {
  const used = new Set(Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  return id;
}

/** 실내 맵의 출입구 틈: 맨 아래 줄(맵 끝)에서 걸을 수 있는 칸 중 이어진 첫 덩이(현관 문턱 한 군데). 맨 아래 줄에 틈이 없으면 빈 배열. */
export function interiorExitCells(project: Project, map: GameMap): Cell[] {
  const y = map.height - 1;
  const runs: Cell[][] = [];
  for (let x = 0; x < map.width; x++) {
    if (!isPassable(project, map, x, y)) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y });
    else runs.push([{ x, y }]);
  }
  // 틈이 여러 군데면 가장 넓은 것(같으면 가운데에 가까운 것)이 정문이다.
  const cx = (map.width - 1) / 2;
  const mid = (r: Cell[]) => Math.abs((r[0]!.x + r[r.length - 1]!.x) / 2 - cx);
  runs.sort((a, b) => b.length - a.length || mid(a) - mid(b));
  const run = runs[0] ?? [];
  // 거리 문은 최대 4칸 — 맨 아래 줄이 넓게 트인 평면(베란다·툇마루)이면 가운데 4칸만 출구 발판으로 쓴다.
  const cut = Math.max(0, Math.floor((run.length - 4) / 2));
  return run.length > 4 ? run.slice(cut, cut + 4) : run;
}

/** 도착 칸에서 걸어서 닿는 칸 수(엔진 통행 판정, 4방향). */
function reachableCount(project: Project, map: GameMap, from: Cell): number {
  const seen = new Set([from.y * map.width + from.x]);
  const q: Cell[] = [from];
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }, k = n.y * map.width + n.x;
      if (!inside(map, n) || seen.has(k) || !isPassable(project, map, n.x, n.y)) continue;
      seen.add(k); q.push(n);
    }
  }
  return seen.size;
}

/** 거리 쪽 문 칸·문 앞 접근칸을 정한다. door 가 막힌 문 칸이면 바로 아래가 접근칸, 통행 칸이면 그 칸이 접근칸. */
function resolveDoor(project: Project, map: GameMap, door: Cell): { door: Cell; front: Cell } {
  if (!inside(map, door)) throw new ToolError(`문 칸 (${door.x},${door.y}) 이 맵 밖이다`, { code: "invalid-args", mapId: map.id });
  if (isPassable(project, map, door.x, door.y)) {
    const above = { x: door.x, y: door.y - 1 };
    if (!inside(map, above) || isPassable(project, map, above.x, above.y)) {
      throw new ToolError(`(${door.x},${door.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — build_jp_city_building 결과의 data.doors 칸(또는 키트 entrance 칸)을 준다`, { code: "not-a-door", mapId: map.id, x: door.x, y: door.y });
    }
    return { door: above, front: door };
  }
  const front = { x: door.x, y: door.y + 1 };
  if (!inside(map, front) || !isPassable(project, map, front.x, front.y)) {
    throw new ToolError(`문 (${door.x},${door.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞 보도·도로를 먼저 깐다`, { code: "DOOR_BLOCKED", mapId: map.id, x: front.x, y: front.y });
  }
  return { door, front };
}

/** 나올 때 내릴 칸: 문 앞 접근칸 줄(발판들)이 아닌 그 아래 줄 — 바로 아래 → 좌우 → 두 칸 아래 순으로 첫 통행 칸. */
function exteriorLanding(project: Project, map: GameMap, front: Cell): Cell {
  const tries = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x, y: front.y + 2 }];
  for (const c of tries) if (inside(map, c) && isPassable(project, map, c.x, c.y) && !eventAt(map, c)) return c;
  throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다 — 문 앞 보도를 두 줄 이상 깐다`, { code: "no-exterior-landing", mapId: map.id, x: front.x, y: front.y });
}

export const LINK_JP_CITY_INTERIOR_TOOL: ToolDefinition = {
  name: "link_jp_city_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "일본 도시(jp_city) 거리 건물의 문과 실내 맵을 왕복 이동으로 잇는다 — 거리 문 앞 접근칸(문 바로 아래)에 들어가는 발판, 실내 맨 아래 출입구 틈에 나오는 발판을 만든다. "
    + "door = 건물 문 칸(build_jp_city_building 의 data.doors, 또는 stamp_object 로 찍은 jp-bldg 키트면 키트 왼쪽 위 + entrance 부품 dx,dy). 문 바로 아래 접근칸을 줘도 된다. "
    + "실내는 place(등록 장소 id — 예 jp-city-apartment-1k-12x13·jp-city-house-interior-21x15·jp-city-konbini-…; read_region_reference 목록에서 jp-city-…-interior/가게 장소) 를 주면 새 맵으로 가져와 잇고(여러 층이면 층마다 맵, 1층에 잇는다), "
    + "이미 가져온·지은 실내 맵이면 interiorMapId(build_hand_interior_room 으로 지은 jp_city 방 포함). 실내 맵은 맵 목록에서 거리 맵 아래로 옮긴다. "
    + "create_transfer_pair 를 따로 부르지 않는다(그 도구는 막힌 문 칸을 옮겨 버린다). 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다). "
    + "실내 출구 = 실내 맵 맨 아래 줄(맵 끝)의 이어진 통행 칸 한 덩이(넓으면 가운데 4칸) — 없으면 no-interior-exit, 이미 이벤트가 있으면 exit-event-exists(replace:true 로 바꾼다). 여러 층 장소는 1층에만 잇는다(층 사이 계단은 장소에 이미 이어져 있다; 2층 이상에 바깥 문을 따로 달지 않는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "거리(바깥) jp_city 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", description: "건물 문 칸 {x,y} (막힌 문 칸 또는 문 바로 아래 접근칸). 문이 여러 칸이면 가장 왼쪽 칸", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(가로로 이어진 문 — data.doors 가 같은 줄에 2~3칸이면 그 수). 기본 1" },
      place: { type: "string", description: "가져올 실내 장소 id (interiorMapId 와 둘 중 하나)" },
      interiorMapId: { type: "string", description: "이미 있는 실내 맵 id (place 와 둘 중 하나)" },
      name: { type: "string", description: "새 실내 맵 이름(place 일 때). 예 「さくら 편의점 안」" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다. 기본 false" },
    },
    required: ["door"],
    additionalProperties: false,
  },
  preservesAuthoredRaster: true,
  prepare: (args) => typeof args.place === "string" && args.place.trim() ? preloadRegionReferenceScene(args.place.trim()).then(() => undefined) : Promise.resolve(),
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 거리 jp_city 맵 id 를 준다", { code: "map-not-found" });
    const street = requireMap(draft, mapId);
    if (!isJpCityTileset(draft.tilesets[street.tilesetId])) {
      throw new ToolError(`맵 ${mapId} 의 칩셋 ${street.tilesetId} 는 ${JP_CITY_ID} 가 아니다 — 일본 도시 거리 맵에서만 쓴다. 다른 칩셋 집은 author_house·create_transfer_pair`, { code: "tileset-family-mismatch", mapId });
    }
    const place = typeof args.place === "string" && args.place.trim() ? args.place.trim() : "";
    const givenInterior = typeof args.interiorMapId === "string" && args.interiorMapId.trim() ? args.interiorMapId.trim() : "";
    if (!!place === !!givenInterior) throw new ToolError("place(가져올 장소 id) 와 interiorMapId(이미 있는 실내 맵) 중 정확히 하나를 준다", { code: "invalid-args" });
    const replace = args.replace === true;
    const d = args.door as { x: number; y: number };
    const width = Number.isInteger(args.width) ? Math.max(1, Math.min(4, Number(args.width))) : 1;
    const doors = Array.from({ length: width }, (_, i) => resolveDoor(draft, street, { x: Number(d.x) + i, y: Number(d.y) }));
    const { door } = doors[0]!;
    if (doors.some((e) => e.front.y !== doors[0]!.front.y)) throw new ToolError("문 칸들이 한 줄에 있지 않다 — width 를 줄인다", { code: "invalid-args", mapId });
    const fronts = doors.map((e) => e.front);
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    const olds = fronts.map((c) => eventAt(street, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) {
      throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y}) ${e.name ?? e.id}`).join(" ")} 에 이미 이벤트가 있다 — 이미 이어졌으면 그대로 두고, 바꾸려면 replace:true`, { code: "door-event-exists", mapId, x: olds[0]!.x, y: olds[0]!.y });
    }
    const outLanding = exteriorLanding(draft, street, front);

    let interiorId = givenInterior;
    let floorMapIds: string[] = [];
    let importNote = "";
    if (place) {
      let scene;
      try { scene = regionReferenceScene(place); }
      catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" }); }
      const result = importReferenceScene(draft, scene, typeof args.name === "string" && args.name.trim() ? { name: args.name.trim() } : {});
      interiorId = result.mapId;
      floorMapIds = result.floorMapIds;
      importNote = `「${scene.name}」 새 맵 ${interiorId}${floorMapIds.length ? ` + 다른 층 ${floorMapIds.join(", ")}` : ""}`;
    }
    const interior = requireMap(draft, interiorId);
    if (interior.id === street.id) throw new ToolError("실내 맵이 거리 맵과 같다", { code: "invalid-args" });
    const exits = interiorExitCells(draft, interior);
    if (!exits.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — 평면 맨 아래 줄(맵 끝)에 틈(현관 문턱)을 둔다`, { code: "no-interior-exit", mapId: interiorId });
    const taken = exits.map((c) => eventAt(interior, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`실내 출입구 틈 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — 다른 문과 이미 이어졌다. replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: interiorId });
    // 도착: 틈 가운데 칸의 바로 위(발판을 다시 밟지 않게) — 다른 이벤트·출입구 칸은 피한다.
    const mid = exits[Math.floor(exits.length / 2)]!;
    const exitSet = new Set(exits.map((c) => `${c.x},${c.y}`));
    const inLanding = [{ x: mid.x, y: mid.y - 1 }, ...exits.map((c) => ({ x: c.x, y: c.y - 1 })), ...exits.map((c) => ({ x: c.x, y: c.y - 2 }))]
      .find((c) => inside(interior, c) && isPassable(draft, interior, c.x, c.y) && !exitSet.has(`${c.x},${c.y}`) && !eventAt(interior, c)
        // 방 안으로 이어져야 한다: 출구 줄 몇 칸에 갇힌 칸이 아니라 출구 칸 수보다 훨씬 많이 닿는 칸.
        && reachableCount(draft, interior, c) > exits.length + 2);
    if (!inLanding) throw new ToolError(`실내 출입구 틈 바로 위(두 칸까지)가 막혔거나 다른 이벤트가 있거나 방 안으로 이어지지 않는다 — 현관 안쪽 칸을 비운다`, { code: "no-interior-landing", mapId: interiorId });

    if (olds.length) street.events = (street.events ?? []).filter((e) => !olds.includes(e));
    if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
    const enterIds: string[] = [];
    for (const c of fronts) {
      const id = uniqueEventId(draft, `ev_jp_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`);
      enterIds.push(id);
      street.events = [...(street.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })];
    }
    const exitIds: string[] = [];
    for (const c of exits) {
      const id = uniqueEventId(draft, `ev_jp_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`);
      exitIds.push(id);
      interior.events = [...(interior.events ?? []), gateEvent(id, `${street.name} 로 나가기`, c, { mapId, ...outLanding })];
    }
    // 맵 목록: 실내(층들은 그 아래에 매달려 있다)를 거리 맵 아래로.
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");

    return {
      summary: `${street.name} 문 (${door.x},${door.y})${width > 1 ? ` 외 ${width - 1}칸` : ""} ↔ ${interior.name}: 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} 발판 → 실내 (${inLanding.x},${inLanding.y}) · 실내 출입구 ${exits.map((c) => `(${c.x},${c.y})`).join(" ")} → 거리 (${outLanding.x},${outLanding.y})${importNote ? ` · ${importNote}` : ""}`,
      data: { mapId, door, fronts, interiorMapId: interiorId, floorMapIds, enterEventIds: enterIds, exitEventIds: exitIds, entryLanding: inLanding, exitCells: exits, exitLanding: outLanding },
    };
  },
};
