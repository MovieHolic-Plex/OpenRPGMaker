// 조선(joseon_baram) 건물 문 ↔ 실내 방을 한 번에 잇는다 — link_joseon_interior · list_joseon_doors.
//   바깥 쪽: 들어가는 이벤트는 **문 칸**(디딤돌 바로 위의 막힌 문 그림 칸)에 선 같은 층 부딪힘 이벤트다 — 디딤돌(문 앞 칸)에서 문 쪽으로
//            걸어 들어갈 때만 발동한다(문 앞에 서기만 해서는 들어가지 않는다, project/doorEntries.ts·PR #3973). 런타임이 문을 열고
//            주인공이 문간으로 한 걸음 들어간 뒤 옮긴다.
//   방 쪽: 출구 깔개(방 맨 아래 줄의 문간 칸, 밟으면 나간다)에 나가는 발판, 도착은 깔개 바로 위 칸(위를 본다).
//   나올 때는 바깥 디딤돌에 문을 등지고(아래를 보고) 선다 — 디딤돌은 밟아도 발동하지 않으니 바로 다시 들어가지 않는다.
// 문 자리는 번들 표 src/project/defaults/joseonDoors.json(scripts/content/prepare-joseon-doors.py, 구운 지도의 문·디딤돌·통행에서 뽑음)이 쥔다.
// 가져온 맵이 그 등록 장소 그대로인지는 지문(크기 + 아랫층 칸 표본)으로 본다. 표에 없는 맵(손으로 지은 조선 맵·고친 맵)은
// 주어진 칸에서 같은 규칙(디딤돌 위 첫 막힌 칸 = 문, 방 맨 아래 줄 걸음 칸 = 출구)으로 정한다.
import doorTable from "@/project/defaults/joseonDoors.json";
import { JOSEON_BARAM_FAMILY } from "@/project/defaults/joseonBaram";
import { isPassable } from "@/project/collision";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { importReferenceScene, preloadRegionReferenceScene, regionReferenceScene } from "@/project/regionReferenceImport";
import { tilesetFamily } from "@/project/tilesetFamily";
import { mapDoorAt, mapDoorDefFor, upsertMapDoor } from "@/project/mapDoorKinds";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };
type Pair = readonly [number, number];
interface TableDoor { readonly piece: string; readonly name: string; readonly door: Pair; readonly step: Pair }
interface TableExit { readonly door: Pair; readonly landing: Pair }
interface TablePlace {
  readonly sourceMapId: string;
  readonly kind: "outdoor" | "interior";
  readonly fingerprint: { readonly width: number; readonly height: number; readonly samples: readonly Pair[] };
  readonly doors?: readonly TableDoor[];
  readonly exits?: readonly TableExit[];
}
const PLACES = (doorTable as unknown as { places: Record<string, TablePlace> }).places;

/** 조선 등록 실내 장소 id(방 6·궁 4). */
export const JOSEON_ROOM_PLACE_IDS: readonly string[] = Object.entries(PLACES).filter(([, p]) => p.kind === "interior").map(([id]) => id);

const inside = (map: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
const eventAt = (map: GameMap, c: Cell): GameEvent | undefined => (map.events ?? []).find((e) => e.x === c.x && e.y === c.y);
const cell = (p: Pair): Cell => ({ x: p[0], y: p[1] });

export function isJoseonMap(project: Project, map: GameMap): boolean {
  return tilesetFamily(project, map.tilesetId) === JOSEON_BARAM_FAMILY;
}

/** 맵이 어느 등록 장소를 그대로 가져온 것인지(지문 일치). 고쳐 그린 칸이 표본에 걸리면 undefined. */
export function joseonPlaceOfMap(map: GameMap): string | undefined {
  for (const [id, place] of Object.entries(PLACES)) {
    const f = place.fingerprint;
    if (f.width !== map.width || f.height !== map.height) continue;
    if (f.samples.every(([i, t]) => map.lowerTiles[i] === t)) return id;
  }
  return undefined;
}

/** 바깥 맵의 건물 문 목록(표). 표에 없는 맵이면 빈 배열. */
export function joseonDoorsOfMap(map: GameMap): readonly TableDoor[] {
  const id = joseonPlaceOfMap(map);
  return id ? PLACES[id]!.doors ?? [] : [];
}

/** 문 칸·디딤돌을 정한다. 주어진 칸이 표의 문 칸·디딤돌이면 표 그대로, 아니면 「디딤돌 위 첫 막힌 칸 = 문」. */
function resolveDoor(project: Project, map: GameMap, at: Cell): { door: Cell; step: Cell; name?: string } {
  if (!inside(map, at)) throw new ToolError(`문 칸 (${at.x},${at.y}) 이 맵 밖이다`, { code: "invalid-args", mapId: map.id });
  const known = joseonDoorsOfMap(map).find((d) => (d.door[0] === at.x && d.door[1] === at.y) || (d.step[0] === at.x && d.step[1] === at.y));
  if (known) return { door: cell(known.door), step: cell(known.step), name: known.name };
  if (isPassable(project, map, at.x, at.y)) {
    for (let dy = 1; dy <= 3; dy++) {
      const up = { x: at.x, y: at.y - dy };
      if (!inside(map, up)) break;
      if (!isPassable(project, map, up.x, up.y)) {
        if (dy === 1 || isPassable(project, map, at.x, up.y + 1)) return { door: up, step: at };
      }
    }
    throw new ToolError(`(${at.x},${at.y}) 위에 막힌 문 칸이 없다 — 건물 문 칸이나 그 아래 디딤돌 칸을 준다(list_joseon_doors 로 문 목록을 본다)`, { code: "not-a-door", mapId: map.id, x: at.x, y: at.y });
  }
  for (let dy = 1; dy <= 3; dy++) {
    const down = { x: at.x, y: at.y + dy };
    if (inside(map, down) && isPassable(project, map, down.x, down.y)) return { door: { x: at.x, y: down.y - 1 }, step: down };
  }
  throw new ToolError(`문 (${at.x},${at.y}) 아래가 걸을 수 없다 — 디딤돌·마당이 문 바로 아래에 있어야 한다`, { code: "DOOR_BLOCKED", mapId: map.id, x: at.x, y: at.y });
}

/** 방의 출구 깔개와 도착 칸. 표에 있는 방이면 표, 아니면 맨 아래 줄의 걸음 칸 한 덩이. */
function resolveExit(project: Project, room: GameMap, pick?: Cell): { exits: Cell[]; landing: Cell } {
  const id = joseonPlaceOfMap(room);
  const table = id ? PLACES[id]!.exits ?? [] : [];
  if (table.length) {
    const chosen = pick ? table.find((e) => e.door[0] === pick.x && e.door[1] === pick.y) : table[0];
    if (!chosen) throw new ToolError(`방 ${room.id} 에 출구 (${pick!.x},${pick!.y}) 가 없다 — 출구: ${table.map((e) => `(${e.door[0]},${e.door[1]})`).join(" ")}`, { code: "invalid-args", mapId: room.id });
    return { exits: [cell(chosen.door)], landing: cell(chosen.landing) };
  }
  // 표에 없는 방: 맨 아래 걸음 줄(위에서부터 처음으로 걸음 칸이 하나 덩이로만 있는 가장 아래 줄)
  for (let y = room.height - 1; y >= 1; y--) {
    const runs: Cell[][] = [];
    for (let x = 0; x < room.width; x++) {
      if (!isPassable(project, room, x, y)) continue;
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y }); else runs.push([{ x, y }]);
    }
    if (!runs.length) continue;
    if (runs.length > 1) throw new ToolError(`방 ${room.id} 맨 아래 걸음 줄 y=${y} 에 틈이 ${runs.length}군데라 출구를 고를 수 없다 — exit {x,y} 로 출구 칸을 준다`, { code: "interior-exit-ambiguous", mapId: room.id });
    const run = runs[0]!;
    const chosen = pick ? run.filter((c) => c.x === pick.x && c.y === pick.y) : run;
    if (!chosen.length) throw new ToolError(`(${pick!.x},${pick!.y}) 는 방 ${room.id} 의 출구 줄 y=${y} 에 없다`, { code: "invalid-args", mapId: room.id });
    const mid = chosen[Math.floor(chosen.length / 2)]!;
    const landing = { x: mid.x, y: mid.y - 1 };
    if (!isPassable(project, room, landing.x, landing.y)) throw new ToolError(`출구 (${mid.x},${mid.y}) 바로 위가 막혔다`, { code: "no-interior-landing", mapId: room.id });
    return { exits: chosen, landing };
  }
  throw new ToolError(`방 ${room.id} 에 걸을 수 있는 칸이 없다`, { code: "no-interior-exit", mapId: room.id });
}

function gateEvent(id: string, name: string, at: Cell, to: { mapId: string; x: number; y: number; direction: "up" | "down" }, bump: boolean): GameEvent {
  return {
    id, x: at.x, y: at.y, name,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_page`, name, conditions: [], graphic: { transparent: true },
      // 부딪힘(same + overlapForbidden) = 막힌 문 칸에서 문 쪽으로 밀 때만. 방 출구 깔개는 밟는 발판(below).
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

const asCell = (v: unknown): Cell | undefined => {
  const o = v as { x?: unknown; y?: unknown } | undefined;
  return o && Number.isInteger(o.x) && Number.isInteger(o.y) ? { x: Number(o.x), y: Number(o.y) } : undefined;
};

export const LIST_JOSEON_DOORS_TOOL: ToolDefinition = {
  name: "list_joseon_doors",
  mode: "read",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "조선(joseon_baram) 맵의 건물 문 목록 — 등록 장소(마을 20호·국내성·국내성 원작 규모)를 그대로 가져온 맵이면 건물마다 문 칸·디딤돌(문 앞 칸)·건물 이름과 이미 이어졌는지를 준다. 방(실내 등록 장소)이면 출구 깔개·도착 칸을 준다. link_joseon_interior 의 door 에 이 문 칸을 그대로 넘긴다.",
  parameters: { type: "object", properties: { mapId: { type: "string", description: "조선 맵 id. 생략하면 지금 보는 맵" } }, additionalProperties: false },
  run(project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다", { code: "map-not-found" });
    const map = requireMap(project, mapId);
    if (!isJoseonMap(project, map)) throw new ToolError(`맵 ${mapId} 는 조선 칩셋 계열이 아니다`, { code: "tileset-family-mismatch", mapId });
    const placeId = joseonPlaceOfMap(map);
    const place = placeId ? PLACES[placeId] : undefined;
    if (!place) return { summary: `${map.name}: 등록 장소 그대로가 아니라 문 표가 없다 — link_joseon_interior 에 문 칸(디딤돌 바로 위 막힌 칸)이나 디딤돌을 직접 준다`, data: { mapId, placeId: null, doors: [], exits: [] } };
    const doors = (place.doors ?? []).map((d) => {
      const ev = eventAt(map, cell(d.door)) ?? eventAt(map, cell(d.step));
      return { name: d.name, piece: d.piece, door: { x: d.door[0], y: d.door[1] }, step: { x: d.step[0], y: d.step[1] }, linked: ev ? (ev.name ?? ev.id) : null };
    });
    const exits = (place.exits ?? []).map((e) => ({ door: { x: e.door[0], y: e.door[1] }, landing: { x: e.landing[0], y: e.landing[1] }, linked: eventAt(map, cell(e.door))?.name ?? null }));
    return {
      summary: place.kind === "interior"
        ? `${map.name}(${placeId}): 출구 ${exits.map((e) => `(${e.door.x},${e.door.y})`).join(" ")} — 도착 ${exits.map((e) => `(${e.landing.x},${e.landing.y})`).join(" ")}`
        : `${map.name}(${placeId}): 건물 문 ${doors.length}곳 — ${doors.map((d) => `${d.name} 문 (${d.door.x},${d.door.y})${d.linked ? "·이어짐" : ""}`).join(" · ")}`,
      data: { mapId, placeId, kind: place.kind, doors, exits },
    };
  },
};

export const LINK_JOSEON_INTERIOR_TOOL: ToolDefinition = {
  name: "link_joseon_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "조선(joseon_baram) 마을·도성의 건물 문과 방(실내 맵)을 왕복 이동으로 잇는다. 들어가는 이벤트는 문 칸(디딤돌 바로 위의 막힌 문 그림 칸)에 서서 디딤돌에서 문 쪽(위)으로 걸어 들어갈 때만 발동한다 — 문 앞에 서기만 해서는 들어가지 않고, 문이 열리고 주인공이 문간으로 한 걸음 들어간 뒤 옮긴다. 방 출구 깔개(방 맨 아래 문간)에 나가는 발판을 만들고, 나오면 디딤돌에 문을 등지고 선다. "
    + "door = 건물 문 칸 또는 그 아래 디딤돌 칸(list_joseon_doors 의 door/step). 방은 place(조선 실내 등록 장소 id: joseon-in-house-15x15 민가 · joseon-in-inn-22x16 주막 · joseon-in-smith-12x10 대장간 · joseon-in-pharmacy-12x10 약방 · joseon-in-school-16x14 서당 · joseon-in-office-17x15 관아 동헌 · joseon-in-throne-24x24 어좌전 · joseon-in-corridor-34x10 회랑 · joseon-in-bedchamber-16x14 침전 · joseon-in-library-20x12 서고)를 주면 새 맵으로 가져와 잇고, 이미 가져온 방이면 interiorMapId. 방 맵은 맵 목록에서 바깥 맵 아래로 옮긴다. "
    + "create_transfer_pair 를 따로 부르지 않는다. 문 칸·디딤돌·방 출구에 이미 이벤트가 있으면 거부한다(replace:true 면 그 이벤트만 바꾼다). 디딤돌이 바깥 큰길에서 걸어서 닿지 않으면 door-unreachable 로 거부한다. 회랑처럼 출구가 여럿인 방은 exit {x,y} 로 고른다. 오류면 장소 가져오기까지 통째로 취소된다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "바깥(마을·도성) 조선 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", description: "건물 문 칸 {x,y}(막힌 문 칸) 또는 그 아래 디딤돌 칸", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false },
      place: { type: "string", description: "가져올 조선 실내 등록 장소 id (interiorMapId 와 둘 중 하나)" },
      interiorMapId: { type: "string", description: "이미 있는 방 맵 id (place 와 둘 중 하나)" },
      name: { type: "string", description: "새 방 맵 이름(place 일 때). 예 「주막 안」" },
      newMapId: { type: "string", description: "새 방 맵 id(place 일 때, 생략하면 자동)" },
      exit: { type: "object", description: "방 출구 깔개 칸 {x,y} — 출구가 여럿인 방만(생략하면 첫 출구)", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false },
      replace: { type: "boolean", description: "문·출구의 기존 이벤트를 바꾼다. 기본 false" },
    },
    required: ["door"],
    additionalProperties: false,
  },
  preservesAuthoredRaster: true,
  prepare: (args) => typeof args.place === "string" && args.place.trim() ? preloadRegionReferenceScene(args.place.trim()).then(() => undefined) : Promise.resolve(),
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 바깥 조선 맵 id 를 준다", { code: "map-not-found" });
    const outside = requireMap(draft, mapId);
    if (!isJoseonMap(draft, outside)) {
      throw new ToolError(`맵 ${mapId} 의 칩셋 ${outside.tilesetId} 는 조선 칩셋(oprn-joseon) 계열이 아니다 — 다른 칩셋 건물은 create_transfer_pair`, { code: "tileset-family-mismatch", mapId });
    }
    const place = typeof args.place === "string" && args.place.trim() ? args.place.trim() : "";
    const givenRoom = typeof args.interiorMapId === "string" && args.interiorMapId.trim() ? args.interiorMapId.trim() : "";
    if (!!place === !!givenRoom) throw new ToolError("place(가져올 방 장소 id) 와 interiorMapId(이미 있는 방 맵) 중 정확히 하나를 준다", { code: "invalid-args" });
    if (place && PLACES[place]?.kind !== "interior") {
      throw new ToolError(`'${place}' 는 조선 실내 등록 장소가 아니다 — ${JOSEON_ROOM_PLACE_IDS.join(" · ")}`, { code: "invalid-args" });
    }
    const replace = args.replace === true;
    const at = asCell(args.door);
    if (!at) throw new ToolError("door {x,y} 가 필요하다", { code: "invalid-args" });
    const { door, step, name: doorName } = resolveDoor(draft, outside, at);
    const walk = mainWalkComponent(draft, outside);
    if (!inMainWalkComponent(walk, outside, step)) {
      throw new ToolError(`문 (${door.x},${door.y}) 의 디딤돌 (${step.x},${step.y}) 은 바깥 큰길에서 걸어서 닿지 않는다 — 이 문에 방을 이으면 플레이어가 들어갈 수 없다`, { code: "door-unreachable", mapId, x: step.x, y: step.y });
    }
    const olds = [door, step].map((c) => eventAt(outside, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) {
      throw new ToolError(`문 ${olds.map((e) => `(${e.x},${e.y}) ${e.name ?? e.id}`).join(" ")} 에 이미 이벤트가 있다 — 이미 이어졌으면 그대로 두고, 바꾸려면 replace:true`, { code: "door-event-exists", mapId, x: olds[0]!.x, y: olds[0]!.y });
    }

    let roomId = givenRoom;
    let importNote = "";
    if (place) {
      let scene;
      try { scene = regionReferenceScene(place); }
      catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" }); }
      const target: { name?: string; newMapId?: string } = {};
      if (typeof args.name === "string" && args.name.trim()) target.name = args.name.trim();
      if (typeof args.newMapId === "string" && args.newMapId.trim()) target.newMapId = args.newMapId.trim();
      try { roomId = importReferenceScene(draft, scene, target).mapId; }
      catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" }); }
      importNote = `「${scene.name}」 새 맵 ${roomId}`;
    }
    const room = requireMap(draft, roomId);
    if (room.id === outside.id) throw new ToolError("방 맵이 바깥 맵과 같다", { code: "invalid-args" });
    if (!isJoseonMap(draft, room)) throw new ToolError(`방 맵 ${roomId} 는 조선 칩셋 계열이 아니다`, { code: "tileset-family-mismatch", mapId: roomId });
    const { exits, landing } = resolveExit(draft, room, asCell(args.exit));
    const taken = exits.map((c) => eventAt(room, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`방 출구 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — 다른 문과 이미 이어졌다. replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: roomId });
    if (eventAt(room, landing) && !taken.includes(eventAt(room, landing)!)) throw new ToolError(`방 도착 칸 (${landing.x},${landing.y}) 에 다른 이벤트가 있다 — 비운다`, { code: "no-interior-landing", mapId: roomId });

    if (olds.length) outside.events = (outside.events ?? []).filter((e) => !olds.includes(e));
    if (taken.length) room.events = (room.events ?? []).filter((e) => !taken.includes(e));
    const slug = roomId.replace(/[^a-z0-9]+/gi, "_");
    const enterId = uniqueEventId(draft, `ev_jb_enter_${slug}`);
    outside.events = [...(outside.events ?? []), gateEvent(enterId, `${room.name} 들어가기`, door, { mapId: roomId, ...landing, direction: "up" }, !isPassable(draft, outside, door.x, door.y))];
    const exitIds: string[] = [];
    for (const c of exits) {
      const id = uniqueEventId(draft, `ev_jb_exit_${slug}`);
      exitIds.push(id);
      room.events = [...(room.events ?? []), gateEvent(id, `${outside.name} 로 나가기`, c, { mapId, ...step, direction: "down" }, false)];
    }
    // 문 정의(map.doors): 조선 문 그림 이름표에는 「문」 낱말이 없어 런타임이 문으로 추론하지 못한다(doorEntries.ts) — 여기서 적어야
    // 「문 쪽으로 걸어 들어가기」·문 열림·문간 걸음·도착 보호가 붙는다. 창호 여닫이(외짝), 윗칸이 막힌 벽이면 2줄 높이.
    if (!mapDoorAt(outside.doors, door)) {
      const tall = door.y > 0 && !isPassable(draft, outside, door.x, door.y - 1);
      upsertMapDoor(outside, mapDoorDefFor("swing", { x: door.x, y: tall ? door.y - 1 : door.y, w: 1, h: tall ? 2 : 1 }));
    }
    const node = extractTreeNode(draft.mapTree, roomId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");

    return {
      summary: `${outside.name}${doorName ? ` ${doorName}` : ""} 문 (${door.x},${door.y}) ↔ ${room.name}: 디딤돌 (${step.x},${step.y}) 에서 문 쪽으로 걸어 들어가면 → 방 (${landing.x},${landing.y}) · 방 출구 ${exits.map((c) => `(${c.x},${c.y})`).join(" ")} → 디딤돌 (${step.x},${step.y})${importNote ? ` · ${importNote}` : ""}`,
      data: { mapId, door, step, interiorMapId: roomId, enterEventId: enterId, exitEventIds: exitIds, entryLanding: landing, exitCells: exits, exitLanding: step },
    };
  },
};

export const JOSEON_DOOR_TOOLS: readonly ToolDefinition[] = [LIST_JOSEON_DOORS_TOOL, LINK_JOSEON_INTERIOR_TOOL];
