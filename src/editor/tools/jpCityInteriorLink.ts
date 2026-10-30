// 일본 도시(jp_city) 거리 건물의 문 ↔ 실내 맵을 한 번에 잇는다 — link_jp_city_interior.
//   거리 쪽: 들어가는 이벤트는 **문 칸**(건물 맨 아래 줄의 막힌 문 그림 칸)에 선다 — 같은 층(부딪힘) 접촉 이벤트라
//            문 앞 칸에서 문 쪽으로 걸어 들어갈 때만 발동한다(문 앞에 서는 것만으로는 들어가지 않는다, 2026-10-30 사용자).
//            넓은 문(편의점 유리문 2칸)은 문 칸마다 하나. 런타임이 문을 열고 주인공이 문간으로 한 걸음 들어간 뒤 옮긴다(project/doorEntries.ts).
//   실내 쪽: 장소 평면의 맨 아래 줄 출입구 틈(현관 문턱·자동문)이 나가는 발판이다(문턱 칸 자체가 문간이라 밟으면 나간다). 도착은 틈 바로 위 칸.
//   나올 때는 거리의 문 앞 칸에 문을 등지고(아래를 보고) 선다 — 문 앞 칸은 밟아도 발동하지 않으니 바로 다시 들어가지 않는다.
// 실내는 등록 장소 id(place — 여러 층이면 층마다 새 맵, 첫 층에 잇는다) 또는 이미 있는 실내 맵(interiorMapId).
import { isJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { isPassable } from "@/project/collision";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { importReferenceScene, preloadRegionReferenceScene, regionReferenceScene } from "@/project/regionReferenceImport";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { doorLine, recordDoorForGate } from "./mapDoorTools";
import { inferMapDoor } from "@/project/mapDoorKinds";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };

const inside = (map: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
const eventAt = (map: GameMap, c: Cell): GameEvent | undefined => (map.events ?? []).find((e) => e.x === c.x && e.y === c.y);

/** 이동 이벤트. bump = 막힌 문 칸에 서는 같은 층 접촉 이벤트(부딪혀 들어간다), 아니면 밟는 발판(실내 문턱). */
function gateEvent(id: string, name: string, at: Cell, to: { mapId: string; x: number; y: number; direction: "up" | "down" }, bump = false): GameEvent {
  return {
    id, x: at.x, y: at.y, name,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_page`, name, conditions: [], graphic: { transparent: true },
      // 런타임 부딪힘 판정(findBlockingEventOverlappingRect)은 same + overlapForbidden 을 막는 이벤트로 본다.
      trigger: { kind: "playerTouch" }, priority: bump ? "same" : "below", overlapForbidden: bump,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "transfer", mapId: to.mapId as MapId, x: to.x, y: to.y, direction: to.direction, fade: "black" }],
    }],
  } as GameEvent;
}

function uniqueEventId(project: Project, base: string): string {
  const used = new Set(Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  return id;
}

/** 실내 맵의 출입구 틈: 맨 아래 줄(맵 끝)의 걸음 칸 덩이 — 정확히 한 군데일 때만(현관 문턱). 없거나 여러 군데면 빈 배열. */
export function interiorExitCells(project: Project, map: GameMap): Cell[] {
  const y = map.height - 1;
  const runs: Cell[][] = [];
  for (let x = 0; x < map.width; x++) {
    if (!isPassable(project, map, x, y)) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y });
    else runs.push([{ x, y }]);
  }
  // 틈이 여러 군데면 어느 쪽이 정문인지 모른다 — 고르지 않고 빈 배열(호출부가 interior-exit-ambiguous 로 거절).
  return runs.length === 1 ? runs[0]! : [];
}

/** 맨 아래 줄 걸음 칸 덩이 수(0 = 틈 없음, 2 이상 = 정문이 모호). */
export function interiorExitRunCount(project: Project, map: GameMap): number {
  const y = map.height - 1;
  let n = 0;
  for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y) && (x === 0 || !isPassable(project, map, x - 1, y))) n++;
  return n;
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

export const LINK_JP_CITY_INTERIOR_TOOL: ToolDefinition = {
  name: "link_jp_city_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "일본 도시(jp_city) 거리 건물의 문과 실내 맵을 왕복 이동으로 잇는다 — 들어가는 이벤트는 거리의 문 칸(막힌 문 그림 칸, 넓은 문이면 칸마다)에 서서 문 앞 칸에서 문 쪽으로 걸어 들어갈 때만 발동하고(문 앞에 서기만 해서는 안 들어간다 — 문이 열리고 주인공이 문간으로 한 걸음 들어간 뒤 옮긴다), 실내 맨 아래 출입구 틈에 나오는 발판을 만든다. 나오면 거리의 문 앞 칸에 문을 등지고 선다. "
    + "door = 건물 문 칸(build_jp_city_building 의 data.doors, 또는 stamp_object 로 찍은 jp-bldg 키트면 키트 왼쪽 위 + entrance 부품 dx,dy). 문 바로 아래 접근칸을 줘도 된다. "
    + "실내는 place(등록 장소 id — 예 jp-city-apartment-1k-12x13·jp-city-house-interior-21x15·jp-city-konbini-…; read_region_reference 목록에서 jp-city-…-interior/가게 장소) 를 주면 새 맵으로 가져와 잇고(여러 층이면 층마다 맵, 1층에 잇는다), "
    + "이미 가져온·지은 실내 맵이면 interiorMapId(build_hand_interior_room 으로 지은 jp_city 방 포함). 실내 맵은 맵 목록에서 거리 맵 아래로 옮긴다. "
    + "create_transfer_pair 를 따로 부르지 않는다. 문 칸·문 앞 칸에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다 — 옛 문 앞 발판도 지운다). "
    + "실내 출구 = 실내 맵 맨 아래 줄(맵 끝)의 이어진 통행 칸 한 덩이(1~4칸; 5칸 이상이면 interior-exit-too-wide, 맨 아래 줄에 걸음 칸 덩이가 둘 이상이면 interior-exit-ambiguous — 나머지는 막는다) — 없으면 no-interior-exit, 이미 이벤트가 있으면 exit-event-exists. 도착 칸 = 틈 가운데 위 → 각 틈 칸 위 → 두 칸 위 순으로 이벤트·출구가 아니고 실내 절반 이상에 걸어서 닿는 첫 칸. replace:true 는 이 문(문 칸·문 앞 칸)·이 출구의 이벤트만 바꾼다(전에 다른 맵과 이은 짝 발판은 남으니 그 맵에서 지운다). 오류면 장소 가져오기까지 통째로 취소된다(쓰기 도구는 초안에서 돌고 성공해야만 반영). 여러 층 장소는 1층에만 잇는다(층 사이 계단은 장소에 이미 이어져 있다; 2층 이상에 바깥 문을 따로 달지 않는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "거리(바깥) jp_city 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", description: "건물 문 칸 {x,y} (막힌 문 칸 또는 문 바로 아래 접근칸). 문이 여러 칸이면 가장 왼쪽 칸", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(가로로 이어진 문 — data.doors 가 같은 줄에 2~3칸이면 그 수). 생략 = 문 그림에서 추론(일체형 가게 정면 유리문 2칸), 못 하면 1" },
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
      throw new ToolError(`맵 ${mapId} 의 칩셋 ${street.tilesetId} 는 ${JP_CITY_ID} 가 아니다 — 일본 도시 거리 맵에서만 쓴다. 다른 칩셋 건물은 create_transfer_pair`, { code: "tileset-family-mismatch", mapId });
    }
    const place = typeof args.place === "string" && args.place.trim() ? args.place.trim() : "";
    const givenInterior = typeof args.interiorMapId === "string" && args.interiorMapId.trim() ? args.interiorMapId.trim() : "";
    if (!!place === !!givenInterior) throw new ToolError("place(가져올 장소 id) 와 interiorMapId(이미 있는 실내 맵) 중 정확히 하나를 준다", { code: "invalid-args" });
    const replace = args.replace === true;
    const d = args.door as { x: number; y: number };
    // 폭을 안 주면 문 그림에서 추론한다(일체형 가게 정면의 유리문은 2칸 — 오른쪽 짝 앞으로 걸어가도 들어간다). 넓힌 칸 앞이 막혔으면 1칸.
    const inferredWidth = (() => {
      if (Number.isInteger(args.width)) return undefined;
      const w = inferMapDoor(draft, street, { x: Number(d.x), y: Number(d.y) })?.rect.w ?? 1;
      if (w < 2) return undefined;
      try { Array.from({ length: w }, (_, i) => resolveDoor(draft, street, { x: Number(d.x) + i, y: Number(d.y) })); return w; } catch { return undefined; }
    })();
    const width = Number.isInteger(args.width) ? Math.max(1, Math.min(4, Number(args.width))) : inferredWidth ?? 1;
    const doors = Array.from({ length: width }, (_, i) => resolveDoor(draft, street, { x: Number(d.x) + i, y: Number(d.y) }));
    const { door } = doors[0]!;
    if (doors.some((e) => e.front.y !== doors[0]!.front.y)) throw new ToolError("문 칸들이 한 줄에 있지 않다 — width 를 줄인다", { code: "invalid-args", mapId });
    const fronts = doors.map((e) => e.front);
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    // 문 앞 칸이 거리 주 동선(걸어서 이어진 가장 큰 덩이) 밖이면 플레이어가 그 문에 갈 수 없다 — 잇지 않고 닿는 문을 알려 준다.
    const walk = mainWalkComponent(draft, street);
    if (!fronts.some((c) => inMainWalkComponent(walk, street, c))) {
      const reachable = (street.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => {
        const m = /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(l.note ?? "");
        return m && inMainWalkComponent(walk, street, { x: Number(m[1]), y: Number(m[2]) }) ? `${l.name} 문 (${m[1]},${Number(m[2]) - 1})` : null;
      }).filter((v): v is string => !!v);
      throw new ToolError(`문 (${door.x},${door.y}) 앞 (${front.x},${front.y}) 은 거리 큰길에서 걸어서 닿지 않는다(막힌 뒷골목) — 이 문에 실내를 이으면 플레이어가 들어갈 수 없다. ${reachable.length ? `닿는 문: ${reachable.join(" · ")}` : "길을 먼저 이어 준다"}`, { code: "door-unreachable", mapId, x: front.x, y: front.y });
    }
    const doorCells = doors.map((e) => e.door);
    // 문 칸(새 형태)과 문 앞 칸(옛 발판) 둘 다 본다 — replace 면 옛 발판도 지운다.
    const olds = [...doorCells, ...fronts].map((c) => eventAt(street, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) {
      throw new ToolError(`문 ${olds.map((e) => `(${e.x},${e.y}) ${e.name ?? e.id}`).join(" ")} 에 이미 이벤트가 있다 — 이미 이어졌으면 그대로 두고, 바꾸려면 replace:true`, { code: "door-event-exists", mapId, x: olds[0]!.x, y: olds[0]!.y });
    }
    // 나올 때는 문 앞 칸(가운데)에 문을 등지고 선다 — 문 앞 칸은 밟아도 발동하지 않는다(project/doorEntries.ts).
    const outLanding = front;

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
    if (exits.length > 4) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄 출입구 틈이 ${exits.length}칸이다 — 거리 문은 최대 4칸이라 틈 전체에 발판을 깔 수 없다. 평면 맨 아래 줄 틈을 4칸 이하로 줄인다`, { code: "interior-exit-too-wide", mapId: interiorId });
    const runCount = interiorExitRunCount(draft, interior);
    if (runCount > 1) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸음 칸 덩이가 ${runCount}군데라 정문을 고를 수 없다 — 출입구 틈 하나만 남기고 맨 아래 줄 나머지는 벽·난간·가구로 막는다`, { code: "interior-exit-ambiguous", mapId: interiorId });
    if (!exits.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — 평면 맨 아래 줄(맵 끝)에 틈(현관 문턱)을 둔다`, { code: "no-interior-exit", mapId: interiorId });
    const taken = exits.map((c) => eventAt(interior, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`실내 출입구 틈 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — 다른 문과 이미 이어졌다. replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: interiorId });
    // 도착: 틈 가운데 칸의 바로 위(발판을 다시 밟지 않게) — 다른 이벤트·출입구 칸은 피한다.
    let walkable = 0;
    for (let y = 0; y < interior.height; y++) for (let x = 0; x < interior.width; x++) if (isPassable(draft, interior, x, y)) walkable++;
    const mid = exits[Math.floor(exits.length / 2)]!;
    const exitSet = new Set(exits.map((c) => `${c.x},${c.y}`));
    const inLanding = [{ x: mid.x, y: mid.y - 1 }, ...exits.map((c) => ({ x: c.x, y: c.y - 1 })), ...exits.map((c) => ({ x: c.x, y: c.y - 2 }))]
      .find((c) => inside(interior, c) && isPassable(draft, interior, c.x, c.y) && !exitSet.has(`${c.x},${c.y}`) && !eventAt(interior, c)
        // 방 안으로 이어져야 한다: 출구 곁 작은 격실이 아니라 실내 걸음 칸의 절반 이상에 닿는 칸.
        && reachableCount(draft, interior, c) * 2 >= walkable);
    if (!inLanding) throw new ToolError(`실내 출입구 틈 바로 위(두 칸까지)가 막혔거나 다른 이벤트가 있거나 방 안으로 이어지지 않는다 — 현관 안쪽 칸을 비운다`, { code: "no-interior-landing", mapId: interiorId });

    if (olds.length) street.events = (street.events ?? []).filter((e) => !olds.includes(e));
    if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
    const enterIds: string[] = [];
    for (const c of doorCells) {
      const id = uniqueEventId(draft, `ev_jp_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`);
      enterIds.push(id);
      street.events = [...(street.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding, direction: "up" }, true)];
    }
    const exitIds: string[] = [];
    for (const c of exits) {
      const id = uniqueEventId(draft, `ev_jp_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`);
      exitIds.push(id);
      interior.events = [...(interior.events ?? []), gateEvent(id, `${street.name} 로 나가기`, c, { mapId, ...outLanding, direction: "down" })];
    }
    // 문 종류(유리 자동문·셔터·미닫이·두 짝)를 그림에서 추론해 적는다 — 런타임이 그 문 그림 전체를 그 종류대로 연다(mapDoorTools).
    const recorded = recordDoorForGate(draft, street, door);
    // 맵 목록: 실내(층들은 그 아래에 매달려 있다)를 거리 맵 아래로.
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");

    return {
      summary: `${street.name} 문 (${door.x},${door.y})${width > 1 ? ` 외 ${width - 1}칸` : ""} ↔ ${interior.name}: 문 칸 ${doorCells.map((c) => `(${c.x},${c.y})`).join(" ")}(문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 문 쪽으로 걸어 들어가면) → 실내 (${inLanding.x},${inLanding.y}) · 실내 출입구 ${exits.map((c) => `(${c.x},${c.y})`).join(" ")} → 거리 (${outLanding.x},${outLanding.y})${importNote ? ` · ${importNote}` : ""}${recorded.door ? ` · 문 종류 ${doorLine(recorded.door)} 적음(틀리면 set_map_door)` : ""}`,
      data: { mapId, door, doorCells, fronts, interiorMapId: interiorId, floorMapIds, enterEventIds: enterIds, exitEventIds: exitIds, entryLanding: inLanding, exitCells: exits, exitLanding: outLanding, ...(recorded.door ? { doorKind: recorded.door.kind, doorRect: recorded.door.rect } : {}) },
    };
  },
};
