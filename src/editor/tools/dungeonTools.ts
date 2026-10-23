// author_dungeon — 던전 한 층을 시공한다(2026-10-14 버들항 author_beodeul_dungeon 으로 시작, 2026-10-15 칩셋 어댑터·장르 프리셋으로 일반화).
// 사용자 스크린샷(field-enemy fe1): 조수가 던전 층을 stamp_object 112번 + paint_tiles 67번(절대 좌표)으로 깔다 25분 시간 초과,
// 횃불·화로·통·상자·기둥이 허공에 뜨고 벽 조각이 바닥에 서고 이벤트가 천장 칸에 놓였다. 좌표를 모델이 고르지 않게 한다.
// 계산은 src/editor/dungeonKit/ — 중립 마스크(mask.ts) + 칩셋 어댑터(beodeul/·monster/) + 장르 프리셋(genres.ts) + 라우팅(route.ts).
import { isPassable } from "@/project/collision";
import { groundSupportIssues } from "@/project/groundSupport";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { Command, EncounterTableEntry, GameEvent, GameMap, Project } from "@/project/types";
import { DUNGEON_DIRS, DUNGEON_LAYOUTS, DUNGEON_ROOM_KINDS, DUNGEON_SIZES, DUNGEON_STYLES, DUNGEON_TYPES, type DungeonRoomInput, type DungeonSpec, type DungeonType } from "../dungeonKit/types";
import { DungeonComposeError } from "../dungeonKit/errors";
import { capabilityTableText } from "../dungeonKit/capabilities";
import { DUNGEON_GENRES, GENRE_PRESETS, genreOfProject, planPopulation } from "../dungeonKit/genres";
import { DUNGEON_REFERENCES, GRAMMAR, inferDungeonRequest, inferDungeonType } from "../dungeonKit/grammar";
import { DUNGEON_GIMMICKS, GIMMICK_LABEL, THEME_GIMMICKS, placeLever, placeThemeGimmick, wallFirst, type DungeonGimmick } from "./dungeonGimmicks";
import { composeRouted, routeDungeon } from "../dungeonKit/route";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS } from "./mapTools";
import { upsertEventIntoMap } from "./eventTools";
import { resolveGraphic } from "./eventCompile";
import { ensureNamedSwitch } from "./flagHelpers";
import { asCell, asRoom, chestLoot, field, list, nested, pickTroops, placeRoamer, text, type Room } from "./jrpgVolumeTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { DUNGEON_ENTRANCE_TAG, ENTRANCE_OPTION_SCHEMA, linkEntranceInDraft, parseEntranceOption } from "./dungeonLinkTools";
import { dungeonTheme, ensureThemeTroop } from "./dungeonThemeTroops";
import { beodeulNatureTileset, planBeodeulCanopy, writeBeodeulCanopy } from "./beodeulForest";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { translateTiles } from "@/project/objectStamp";
import { setLayerTileAt } from "@/project/mapLayers";

const createMapTool = MAP_TOOLS.find((tool) => tool.name === "create_map")!;
const resizeMapTool = MAP_TOOLS.find((tool) => tool.name === "resize_map")!;

const ROOM_LABEL: Record<string, string> = {
  entrance: "입구 홀", hall: "큰 홀", crypt: "묘실", cell: "감방", shrine: "제단 방", boss: "보스방", storage: "창고", vault: "보물 방",
  channel: "수로 방", cistern: "저수조", pump: "펌프실", cavern: "동굴 방", lake: "호수 동굴", grotto: "이끼 동굴", forge: "옛 대장간", nave: "신랑", junction: "갈림 갱도", stope: "채굴장", depot: "광산 창고",
};
const TYPE_LIST = DUNGEON_TYPES.map((t) => `${t} ${GRAMMAR[t].label}`).join(" · ");

function isBlankMap(map: GameMap): boolean {
  if (map.events.length > 0 || (map.structurePlacements?.length ?? 0) > 0) return false;
  const first = map.lowerTiles[0];
  if (!map.lowerTiles.every((tile) => tile === first)) return false;
  return [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles].every((layer) => !layer || layer.every((tile) => tile < 0));
}

interface FloorOpts {
  readonly seed: number;
  readonly entry: "up" | "down" | "door" | "none";
  readonly exit: "up" | "down" | "none";
  readonly sideDoor?: boolean;
}

/** 던전 한 층을 짓는다(옛 author_dungeon 본체). 계단 종류·시드는 floor 가 정한다 — 여러 층 잇기·채우기는 authorDungeon. */
function buildFloor(draft: Project, args: Record<string, unknown>, floor: FloorOpts): ToolExecResult {
  const rooms = Array.isArray(args.rooms) ? (args.rooms as DungeonRoomInput[]) : [];
  const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
  const typeArg = (DUNGEON_TYPES as readonly string[]).includes(String(args.type)) ? (args.type as DungeonSpec["type"]) : undefined;
  const spec: DungeonSpec = {
    ...(rooms.length ? { rooms } : {}),
    ...(typeArg ? { type: typeArg } : {}),
    style: (DUNGEON_STYLES as readonly string[]).includes(String(args.style)) ? (args.style as DungeonSpec["style"]) : undefined,
    seed: floor.seed,
    size: (DUNGEON_SIZES as readonly string[]).includes(String(args.size)) ? (args.size as DungeonSpec["size"]) : undefined,
    width: int(args.width), height: int(args.height),
    ...((DUNGEON_LAYOUTS as readonly string[]).includes(String(args.layout)) ? { layout: args.layout as DungeonSpec["layout"] } : {}),
    entryStair: floor.entry, exitStair: floor.exit, ...(floor.sideDoor ? { sideDoor: true } : {}), ...(args.flooded === true ? { flooded: true } : {}), ...(args.lair === true ? { lair: true } : {}), ...(args.rockLine === "A" || args.rockLine === "B" || args.rockLine === "C" || args.rockLine === "none" ? { rockLine: args.rockLine } : {}),
  };
  const entranceOpt = args.entrance === undefined ? undefined : parseEntranceOption(args.entrance);
  if (entranceOpt) {
    if (!draft.maps[entranceOpt.fromMapId]) throw new ToolError(`entrance.fromMapId 맵이 없다: ${entranceOpt.fromMapId} — 야외·월드맵 id 를 확인하라(list_maps).`, { code: "map-not-found", mapId: entranceOpt.fromMapId });
  }
  const requestedMapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  if (requestedMapId && !draft.maps[requestedMapId]) throw new ToolError(`맵이 없습니다: ${requestedMapId}`, { code: "map-not-found", mapId: requestedMapId });
  let composed, route;
  try {
    route = routeDungeon(draft, {
      type: typeof args.type === "string" ? args.type : undefined, variant: typeof args.variant === "string" ? args.variant : undefined,
      adapter: typeof args.adapter === "string" ? args.adapter : undefined, genre: typeof args.genre === "string" ? args.genre : undefined,
      // type 을 안 줬으면 이름·참고 말(「덩굴 덮인 고대 유적」「독 늪」)에서 종류를 읽는다
      text: `${typeof args.name === "string" ? args.name : ""} ${typeof args.inspiration === "string" ? args.inspiration : ""}`.trim() || undefined,
      ...(requestedMapId ? { mapId: requestedMapId } : {}),
    });
    const tileset = route.addTileset ?? draft.tilesets[route.tilesetId]!;
    composed = composeRouted(route, tileset, spec);
    if (route.addTileset) draft.tilesets[route.addTileset.id] = route.addTileset;
  } catch (error) {
    if (error instanceof DungeonComposeError) throw new ToolError(error.message, { code: error.code, ...(requestedMapId ? { mapId: requestedMapId } : {}) });
    throw error;
  }
  const tilesetId = route.tilesetId;
  const tileset = draft.tilesets[tilesetId]!;
  if (composed.width > MAX_TOOL_MAP_DIMENSION || composed.height > MAX_TOOL_MAP_DIMENSION) {
    throw new ToolError(`방 배치가 ${composed.width}×${composed.height} 라 한 맵 한도(${MAX_TOOL_MAP_DIMENSION})를 넘는다 — 방 수나 크기를 줄여라.`, { code: "invalid-args" });
  }
  const notes: string[] = [...route.notes];
  let mapId = requestedMapId;
  if (mapId) {
    const existing = draft.maps[mapId]!;
    if (typeof args.name === "string" && args.name.trim()) existing.name = args.name.trim();
    if (existing.tilesetId !== tilesetId) throw new ToolError(`맵 ${mapId} 은 ${route.adapter === "monster" ? "이 종류가 쓰는 몬스터 시트" : "버들항"} 맵이 아니다(${existing.tilesetId}) — mapId 를 빼고 새 맵으로 짓는다.`, { code: "tileset-family-mismatch", mapId });
    // 다시 짓기: 이 도구가 지은 던전 맵(mapRole dungeon)만 rebuild:true 로 그 자리에서 다시 짓는다 — 거절되자 조수가 새 맵을 또 만들어
    // 같은 이름 던전 두 장이 남았다(2026-10-23 dg-r2 puzzle). 이벤트·스택을 비우고 아래에서 타일을 통째로 덮는다.
    if (!isBlankMap(existing) && args.rebuild === true && existing.mapRole === "dungeon") {
      existing.events = [];
      delete existing.lowerTileStacks; delete existing.upperTileStacks;
      notes.push(`던전 맵 ${mapId} 을 그 자리에서 다시 지었다(rebuild).`);
    } else if (!isBlankMap(existing)) throw new ToolError(`맵 ${mapId} 에는 이미 내용이 있어 덮어쓰지 않는다 — ${existing.mapRole === "dungeon" ? "이 도구가 지은 던전이면 같은 mapId 에 rebuild:true 를 주어 그 자리에서 다시 짓는다(새 맵을 또 만들지 않는다)" : "mapId 를 빼고 새 맵으로 짓는다"}.`, { code: "map-not-blank", mapId });
    if (existing.width !== composed.width || existing.height !== composed.height) {
      resizeMapTool.run(draft, { mapId, width: composed.width, height: composed.height });
      notes.push(`빈 맵 ${mapId} 을 ${composed.width}×${composed.height} 로 넓혀 그 자리에 지었다.`);
    }
  } else {
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : "";
    if (mapId) assertMapIdAvailable(draft, mapId);
    const created = createMapTool.run(draft, {
      ...(mapId ? { id: mapId } : {}), name: typeof args.name === "string" && args.name.trim() ? args.name.trim() : "지하 던전",
      width: composed.width, height: composed.height, tilesetId, border: "none",
    });
    mapId = (created.data as { mapId?: string; id?: string } | undefined)?.mapId ?? (created.data as { id?: string } | undefined)?.id ?? mapId;
    if (!mapId || !draft.maps[mapId]) throw new ToolError("던전 맵 생성에 실패했다.", { code: "create-map-failed" });
  }
  const map = draft.maps[mapId]!;
  if (map.lowerTiles.length !== composed.lower.length) throw new ToolError(`맵 크기 불일치(${map.width}×${map.height} ≠ ${composed.width}×${composed.height}).`, { code: "resize-failed" });
  map.lowerTiles = composed.lower.slice();
  map.upperTiles = composed.upper.slice();
  for (const layer of ["lowerOverlayTiles", "upperOverlayTiles"] as const) if (map[layer]) map[layer] = new Array<number>(map.width * map.height).fill(-1);
  map.mapRole = "dungeon";
  // 자연 물가(2026-10-23 dungeon-themes): 물·용암 칸 위 2층에 beodeul_nature 둑(풀·이끼 늪·흑요석)을 얹는다 — 가장자리 없는 네모 물·용암이 「물감 칸」으로 읽혔다.
  // 2층은 ★(통행 + 위) — 통행은 아래 물·용암 칸이 정한다(막힘). 이웃 = 같은 액체 또는 다리(다리 밑도 물이 이어진다) 또는 맵 밖.
  if (composed.banks) {
    const W = map.width, H = map.height;
    const wet = new Set(composed.banks.cells);
    const bridge = new Set<number>();
    composed.picture.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) if (row[x] === "=") bridge.add(y * W + x); });
    const table = composed.banks.style === "grass" ? BEODEUL_NATURE.bankGrass : composed.banks.style === "bog" ? BEODEUL_NATURE.bankBog : BEODEUL_NATURE.bankLava;
    const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
    const want = new Map<number, number>();
    for (const c of wet) {
      const x = c % W, y = (c - x) / W; let m = 0;
      N8.forEach(([dx, dy], b) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || wet.has(ny * W + nx) || bridge.has(ny * W + nx)) m |= 1 << b; });
      const t = table[m]; if (t !== undefined && t >= 0) want.set(c, t);
    }
    if (want.size) {
      const tr = translateTiles(beodeulNatureTileset(draft), tileset, new Set(want.values()));
      for (const to of tr.map.values()) { tileset.priority[to] = "upper"; tileset.passability[to] = { up: true, down: true, left: true, right: true }; }
      for (const [c, t] of want) setLayerTileAt(map, 2, c, tr.map.get(t)!);
    }
  }
  // 야외 던전(숲·늪, 2026-10-23 dungeon-themes): 벽 칸을 버들항 수관 숲 오토타일로 덮는다(2·3층, 막힘). 숲 남쪽 끝 줄엔 줄기·뿌리, 그 아래 빈터엔 숲 그늘.
  if (composed.canopy) {
    const forest = new Set(composed.canopy.cells);
    // 수관 오토타일이 모양을 못 받는 숲 칸(한 칸 폭 틈·외톨이 칸)은 그림 없이 걸을 수 있는 잔디로 남아 숲을 뚫는 길이 된다.
    // 그런 칸은 숲에서 빼 빈터(잔디)로 둔다 — 이웃 모양이 바뀌니 고정점까지 몇 번 되풀이한다.
    let plan = planBeodeulCanopy(map.width, map.height, composed.canopy.style, forest, (c) => !forest.has(c));
    let opened = 0;
    for (let pass = 0; pass < 6; pass += 1) {
      const leak = [...forest].filter((c) => !plan.canopy.has(c));
      if (!leak.length) break;
      for (const c of leak) forest.delete(c);
      opened += leak.length;
      plan = planBeodeulCanopy(map.width, map.height, composed.canopy.style, forest, (c) => !forest.has(c));
    }
    writeBeodeulCanopy(draft, map, tileset, plan);
    if (opened) notes.push(`수관 모양이 안 맞는 한 칸 폭 숲 틈 ${opened}칸은 빈터로 열었다.`);
  }
  // 방마다 이름표 + composed-layout 표식: 큰 홀·통로의 빈 바닥은 필드 적이 돌아다닐 용도로 비운 칸이다.
  // 표식이 없으면 조수 실행기의 배치 품질 권고(빈 바닥 ≤30%)가 던전을 「빈 방」으로 보고 clear_map 으로 지우려 했다(2026-10-14 재시험 실측).
  map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes("dungeon-room"));
  const population = planPopulation(route.genre, composed, spec.seed ?? 7);
  const wildRooms = new Set(population.wildZones.map((z) => z.room));
  const wildLocationIds: Record<string, string> = {};
  for (const room of composed.rooms) {
    const wild = wildRooms.has(room.id);
    const res = addMapLocation(map, { name: `${wild ? "야생 조우 " : ""}${ROOM_LABEL[room.kind]} ${room.id}`, x: room.x, y: room.y, w: room.w, h: room.h,
      note: `바닥 ${room.w}×${room.h} · 이벤트 자리 ${(composed.spots[room.id] ?? []).map((p) => `(${p.x},${p.y})`).join(" ")}`,
      tags: ["dungeon-room", COMPOSED_LAYOUT_TAG, room.kind, ...(wild ? ["야생 조우"] : [])] });
    if (wild && res.ok) wildLocationIds[room.id] = res.location.id;
  }
  // 야생 조우(pokemon): 구역마다 locationId 조건 항목. 기존 같은 구역 항목은 갈아 끼운다.
  const encounters = Array.isArray(args.encounters) ? (args.encounters as { troopId?: unknown; weight?: unknown }[]).filter((e) => typeof e.troopId === "string" && e.troopId) : [];
  if (route.genre === "pokemon" && population.wildZones.length) {
    if (encounters.length && Object.keys(wildLocationIds).length) {
      const missing = encounters.filter((e) => !draft.database.troops.some((t) => t.id === e.troopId)).map((e) => String(e.troopId));
      if (missing.length) throw new ToolError(`encounters 의 troopId 가 데이터베이스에 없다: ${missing.join(", ")} — upsert_troop 먼저.`, { code: "troop-not-found", mapId });
      const table: EncounterTableEntry[] = Object.values(wildLocationIds).flatMap((locationId) => encounters.map((e) => ({ troopId: String(e.troopId), weight: Math.max(1, Number(e.weight) || 5), conditions: { locationId } })));
      map.encounterTable = table;
      map.encounterRate = Number.isInteger(args.encounterRate) ? Math.max(0, args.encounterRate as number) : (map.encounterRate && map.encounterRate > 0 ? map.encounterRate : 12);
      notes.push(`야생 조우 ${encounters.length}종 × 구역 ${table.length / encounters.length}곳을 encounterTable 에 깔았다(확률 ${map.encounterRate}%).`);
    } else {
      notes.push("야생 조우 구역 이름표만 만들었다 — set_encounter_table 의 conditions.locationId 로 이 구역(이름 「야생 조우 …」)에 야생을 잇는다.");
    }
  }
  // 입구 표식: 야외 맵과 잇는 문 칸(stairsUp 이 있으면 그 칸, 없으면 입구 칸)과 도착 칸. link_world_entrance 가 이 표식을 읽는다.
  {
    const entry = composed.entryStair ?? (composed.stairsUp ? { ...composed.stairsUp, kind: "up" as const } : null);
    const gate = entry ? { x: entry.x, y: entry.y } : composed.entrance;
    const land = entry ? entry.front : undefined;
    map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(DUNGEON_ENTRANCE_TAG));
    // 야외 던전(숲·늪)의 출구는 맵 남쪽 끝 길 칸이다 — 1×1 이면 「맵 축소로 눌린 표식」으로 보이니 길 폭(3칸)으로 잡는다(문 칸은 gate: 태그가 정한다).
    const edge = gate.y >= map.height - 1;
    addMapLocation(map, { name: "던전 입구", x: edge ? Math.max(0, gate.x - 1) : gate.x, y: edge ? gate.y - 1 : gate.y, w: edge ? 3 : 1, h: edge ? 2 : 1, note: `야외로 나가는 문 칸 (${gate.x},${gate.y})${land ? ` · 도착 칸 (${land.x},${land.y})` : ""}`,
      tags: [DUNGEON_ENTRANCE_TAG, COMPOSED_LAYOUT_TAG, `gate:${gate.x},${gate.y}`, ...(land ? [`land:${land.x},${land.y}`] : [])] });
  }
  let entranceLink: ReturnType<typeof linkEntranceInDraft> | undefined;
  if (entranceOpt) {
    try {
      entranceLink = linkEntranceInDraft(draft, { ...entranceOpt, toMapId: mapId });
    } catch (error) {
      if (error instanceof ToolError) throw new ToolError(`던전은 지었지만 야외 입구 연결에 실패했다: ${error.message} — 연결만 link_world_entrance({worldMapId:"${entranceOpt.fromMapId}", links:[{${entranceOpt.place ? `place:"${entranceOpt.place}"` : `x:${entranceOpt.x},y:${entranceOpt.y}`}, toMapId:"${mapId}"}]}) 로 다시 하라.`, { code: error.code ?? "entrance-link-failed", mapId });
      throw error;
    }
    notes.push(`야외 ${entranceOpt.fromMapId}(${entranceLink.fromGate.x},${entranceLink.fromGate.y}) ↔ 이 던전을 양방향으로 이었다.`);
  }
  // 만든 결과를 한 번 더, 실제 맵으로 검사한다(조립기 내부 검사와 같은 규칙).
  const bad = groundSupportIssues(map, tileset, { events: false }).filter((issue) => issue.severity === "error");
  if (bad.length) throw new ToolError(`시공 결과에 받침 없는 물체 ${bad.length}건: ${bad[0]!.message}`, { code: "support-violation", mapId });
  if (draft.startMapId === mapId) {
    // 입구 계단 앞 칸에서 시작한다(계단을 등지고 들어온 자리) — 없으면 입구 방 칸.
    const front = composed.entryStair?.front;
    const start = front && isPassable(draft, map, front.x, front.y) ? { x: front.x, y: front.y } : { x: composed.entrance.x, y: composed.entrance.y };
    if (isPassable(draft, map, start.x, start.y)) {
      draft.startPos = { ...draft.startPos, ...start };
      notes.push(`시작 위치를 입구 (${start.x},${start.y}) 로 옮겼다.`);
    }
  }
  const data = {
    mapId, adapter: route.adapter, genre: route.genre, type: composed.type, ...(route.variant ? { variant: route.variant } : {}), tilesetId,
    liquid: composed.liquid, width: composed.width, height: composed.height,
    entrance: composed.entrance, stairsUp: composed.stairsUp, stairsDown: composed.stairsDown, anchors: composed.anchors,
    entryStair: composed.entryStair ?? null, exitStair: composed.exitStair ?? null, sideDoor: composed.sideDoor ?? null,
    rooms: composed.rooms.map((room) => ({ id: room.id, kind: room.kind, x: room.x, y: room.y, w: room.w, h: room.h, from: room.from, spots: composed.spots[room.id] ?? [] })),
    corridors: composed.corridors.map((c) => ({ from: c.a, to: c.b, dir: c.dir, ...(c.loop ? { loop: true } : {}), ...c.rect })),
    bridges: composed.picture.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === "=" ? [{ x, y }] : []))),
    population, counts: composed.counts, warnings: composed.warnings,
    ...(entranceLink ? { entranceLink: { fromMapId: entranceOpt!.fromMapId, fromGate: entranceLink.fromGate, toGate: entranceLink.toGate, outEvent: entranceLink.link.eventIdA, backEvent: entranceLink.link.eventIdB, landing: entranceLink.link.landingB } } : {}),
  };
  const dressed = Object.values(composed.counts).reduce((a, b) => a + b, 0);
  return {
    summary: `${notes.join(" ")} ${GRAMMAR[composed.type].label}(${route.adapter === "monster" ? "몬스터 키트" : "버들항"}·${GENRE_PRESETS[route.genre].label}) 던전 ${mapId} ${composed.width}×${composed.height}: 방 ${composed.rooms.length}개를 통로 ${composed.corridors.length}개로 이었다(장식 ${dressed}점, 받침 없는 물체 0${composed.liquid.kind ? `, ${composed.liquid.kind === "lava" ? "용암" : "물"} ${composed.liquid.cells}칸은 걸을 수 없고 다리 ${composed.liquid.bridges}칸` : ""}, 입구에서 모든 방 도달${composed.anchors.boss ? `, 보스방 ${composed.anchors.boss}` : ""}${composed.anchors.treasure ? `, 보물 방 ${composed.anchors.treasure}` : ""}${composed.anchors.gate ? `, 잠긴 문을 둘 수 있는 통로 칸 (${composed.anchors.gate.x},${composed.anchors.gate.y}) — 문은 아직 없다` : ""}). 이벤트·적·상자는 data.rooms[].spots 좌표에만 두고, data.population 의 계획을 따른다.`.trim(),
    data,
    warnings: composed.warnings.length ? composed.warnings : undefined,
  };
}

type Pt = { x: number; y: number };
type Stair = Pt & { front: Pt; kind: string };
const DIR_OF = (from: Pt, to: Pt): "up" | "down" | "left" | "right" => {
  const dx = to.x - from.x, dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy < 0 ? "up" : "down";
};

/** 기본 시드: 7 고정이면 시드를 안 준 던전이 전부 같은 배치였다(2026-10-22 기준 시험). 맵 id·이름·맵 수로 정한다(같은 프로젝트 상태 = 같은 결과). */
function defaultSeed(draft: Project, args: Record<string, unknown>): number {
  if (Number.isInteger(args.seed)) return args.seed as number;
  const key = `${String(args.id ?? "")}|${String(args.name ?? "")}|${String(args.type ?? "")}|${Object.keys(draft.maps).length}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return 1 + (h % 9973);
}

/** 계단 칸 이동 이벤트(계단 계약: 이벤트는 계단 그림 칸, 도착은 상대 계단 앞 칸에서 계단을 등지고). */
function stairEvent(map: GameMap, id: string, at: Stair, name: string, to: { mapId: string; land: Pt; facing: "up" | "down" | "left" | "right" }): void {
  const bump = at.kind === "door";
  const event: GameEvent = {
    id, x: at.x, y: at.y, trigger: { kind: "playerTouch" }, commands: [],
    pages: [{
      id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" },
      priority: bump ? "same" : "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...doorOpenCommands(map, at), { kind: "transfer", mapId: to.mapId, x: to.land.x, y: to.land.y, direction: to.facing, fade: "black" } as Command],
    }],
  } as GameEvent;
  upsertEventIntoMap(map, event);
}

/**
 * gap 문(bd-dg-door-closed/open, #3283): 문 칸에 상태 짝 그림이 실려 있으면 들어가기 전에 문을 연다(위층 두 칸 changeTile + 문 소리).
 * changeTile 은 세션에 남으니 한 번 연 문은 열린 채로 있다. 그림 짝이 없는 옛 나무 문은 빈 목록.
 */
function doorOpenCommands(map: GameMap, at: Stair): Command[] {
  const dt = (at as Stair & { doorTiles?: { open: [number, number] } }).doorTiles;
  if (!dt) return [];
  return [
    { kind: "playAudio", resourceId: "cc0-se-osx-door-open", loop: false, channel: "se" } as Command,
    { kind: "changeTile", mapId: map.id, layer: "upper", x: at.x, y: at.y - 1, tile: dt.open[0] } as Command,
    { kind: "changeTile", mapId: map.id, layer: "upper", x: at.x, y: at.y, tile: dt.open[1] } as Command,
    { kind: "wait", ms: 250 } as Command,
  ];
}

/** 레버 퍼즐(같은 칩셋 안): 보물 방(없으면 보스방)으로 들어가는 통로 칸에 닫힌 쇠창살 문, 먼 곁방에 레버. 레버를 당기면 스위치가 켜지고 문이 사라진다. */
function placeLeverGate(draft: Project, map: GameMap, data: Record<string, unknown>, warnings: string[]): string {
  const lock = field(field(data, "population"), "lockedGate");
  const gate = asCell(lock);
  const planKey = asCell(field(lock, "keySpot"));
  // 레버는 그 방 북쪽 벽 바로 앞 칸으로 옮긴다 — 방 한가운데 바닥에 선 작은 레버가 소품 사이에 묻혀 조수가 「레버가 안 보인다」며 던전을 세 번 다시 지었다(2026-10-23 dg-r2 puzzle).
  const keyRoom = planKey ? list(data, "rooms").find((v) => { const x = Number(field(v, "x")), y = Number(field(v, "y")), w = Number(field(v, "w")), h = Number(field(v, "h")); return planKey.x >= x && planKey.x < x + w && planKey.y >= y && planKey.y < y + h; }) : undefined;
  const wallFront = keyRoom ? (asRoom(keyRoom)?.spots ?? []).filter((c) => c.y === Number(field(keyRoom, "y")) && isPassable(draft, map, c.x, c.y) && !map.events.some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1)) : [];
  const key = planKey ? (wallFront.sort((a, b) => Math.abs(a.x - planKey.x) - Math.abs(b.x - planKey.x))[0] ?? planKey) : undefined;
  if (!gate || !key) { warnings.push(`${map.name}: 레버 퍼즐 자리(잠긴 통로·열쇠 방)가 없는 배치라 레버를 두지 않았다 — 방을 늘리거나 vault 방을 넣는다.`); return ""; }
  if (map.events.some((e) => (e.x === gate.x && e.y === gate.y) || (e.x === key.x && e.y === key.y))) { warnings.push(`${map.name}: 레버·창살 자리에 이미 이벤트가 있다`); return ""; }
  const sw = `sw_${map.id}_lever`;
  ensureNamedSwitch(draft, sw, `${map.name}: 레버 당김(쇠창살 열림)`);
  const fixed = { type: "fixed", speed: 3, frequency: 3 } as const;
  const bars = resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
  // 같은 이름 = 한 물체(통로 폭만큼 놓은 창살 칸들) — 이름이 없으면 린트가 「서로 다른 조사물이 같은 그림」으로 본다.
  const ev = (id: string, at: Pt, name: string, pages: GameEvent["pages"]): GameEvent => ({ id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as GameEvent);
  // 쇠창살은 통로 폭 전체를 막는다 — 3칸 통로 가운데 한 칸에만 두면 레버 없이 옆으로 지나갔다(2026-10-23 dg-r2 VQA).
  const corr = list(data, "corridors").find((v) => { const x = Number(field(v, "x")), y = Number(field(v, "y")), w = Number(field(v, "w")), h = Number(field(v, "h")); return gate.x >= x && gate.x < x + w && gate.y >= y && gate.y < y + h; });
  const across: Pt[] = !corr ? [gate] : (text(corr, "dir") === "N" || text(corr, "dir") === "S")
    ? Array.from({ length: Number(field(corr, "w")) }, (_, k) => ({ x: Number(field(corr, "x")) + k, y: gate.y }))
    : Array.from({ length: Number(field(corr, "h")) }, (_, k) => ({ x: gate.x, y: Number(field(corr, "y")) + k }));
  const barCells = across.filter((c) => (c.x === gate.x && c.y === gate.y) || (isPassable(draft, map, c.x, c.y) && !map.events.some((e) => e.x === c.x && e.y === c.y)));
  barCells.forEach((cell, k) => {
    const gid = k === 0 && cell.x === gate.x && cell.y === gate.y ? `ev_${map.id}_lever_gate` : `ev_${map.id}_lever_gate_${cell.x}_${cell.y}`;
    upsertEventIntoMap(map, ev(gid, cell, "쇠창살", [
      { id: `${gid}_p1`, name: "닫힌 쇠창살", conditions: [], graphic: bars, trigger: { kind: "action" }, priority: "same", overlapForbidden: false, movement: fixed,
        commands: [{ kind: "text", body: "굳게 닫힌 쇠창살이다. 어딘가의 레버로 여는 것 같다." } as Command] },
      { id: `${gid}_p2`, name: "열린 쇠창살", conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false, movement: fixed, commands: [] },
    ] as GameEvent["pages"]));
  });
  // gap 벽걸이 레버(#3283): 레버 칸 바로 북쪽 벽 앞면에 걸고 벽을 보고 조사한다. 그림·벽이 없으면 바닥에 옛 캐릭터 레버.
  // 벽 레버 후보: 열쇠 방 상자 안 모든 바닥 칸(북쪽이 벽인 칸 먼저, 계획 자리에 가까운 순)
  const roomCells: Pt[] = [];
  if (keyRoom) { const rx = Number(field(keyRoom, "x")), ry = Number(field(keyRoom, "y")), rw = Number(field(keyRoom, "w")), rh = Number(field(keyRoom, "h"));
    for (let y = ry; y < ry + rh; y += 1) for (let x = rx; x < rx + rw; x += 1) if (isPassable(draft, map, x, y) && !map.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) roomCells.push({ x, y }); }
  roomCells.sort((a, b) => Math.hypot(a.x - key.x, a.y - key.y) - Math.hypot(b.x - key.x, b.y - key.y));
  const placedLever = placeLever(draft, map, [...wallFirst(draft, map, roomCells), key], `ev_${map.id}_lever`, "레버", sw,
    [{ kind: "text", body: "어디선가 쇠창살이 올라가는 소리가 울렸다." } as Command], "녹슨 레버가 있다. 힘껏 당겼다!", "레버는 이미 당겨져 있다.");
  if (!placedLever) { warnings.push(`${map.name}: 레버 자리를 못 찾았다`); return ""; }
  const at = placedLever.at;
  return `레버 퍼즐: ${placedLever.wall ? "벽 " : ""}레버 (${at.x},${at.y}${placedLever.wall ? " — 그 아래 칸에서 벽을 보고 조사" : ""}) → 쇠창살 ${barCells.map((c) => `(${c.x},${c.y})`).join(" ")}(통로 폭 전체) 스위치 ${sw}. 레버는 한 칸짜리 벽 레버 그림이 정상이다 — 다시 짓거나 다른 칩셋의 레버 기물을 찍지 않는다`;
}

/** 층 하나를 채운다(rpg): 계획된 자리의 보이는 적·상자, 보스방 수호자/층 수문장, 보스 앞 방의 회복 세이브 포인트. 실패한 자리는 경고로 넘긴다. */
function populateFloor(draft: Project, mapId: string, data: Record<string, unknown>, troops: ReturnType<typeof pickTroops>, role: { boss: boolean; guardian: boolean; rest: boolean }, salt: number, warnings: string[]): { line: string; placed: { enemies: number; chests: number; boss: number; guardian: number; save: number } } {
  const map = draft.maps[mapId]!;
  const rooms = list(data, "rooms").map(asRoom).filter((r): r is Room => !!r);
  const anchors = field(data, "anchors");
  const bossId = text(anchors, "boss"), vaultId = text(anchors, "treasure");
  const population = field(data, "population");
  const planned = (k: string): Array<Pt & { room?: string }> => list(population, k).flatMap((v) => { const c = asCell(v); if (!c) return []; const room = text(v, "room"); return [room ? { ...c, room } : c]; });
  const bossRoom = rooms.find((r) => r.id === bossId) ?? (role.guardian || role.boss ? rooms[rooms.length - 1] : undefined);
  // 쉼터는 방이 많은 층(5+)·여러 층의 마지막 층에만 — 작은 동굴에 세이브 결정이 서면 어색하다.
  const restRoom = role.rest && bossRoom ? rooms.find((r) => r.id === bossRoom.from && r.id !== vaultId) : undefined;
  const free = (c: Pt): boolean => isPassable(draft, map, c.x, c.y) && !map.events.some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1);
  const attempt = (label: string, fn: () => void): boolean => {
    try { fn(); return true; } catch (error) { if (error instanceof ToolError) { warnings.push(`${map.name}: ${label} — ${error.message}`); return false; } throw error; }
  };
  const out: string[] = [];
  const foes: string[] = [];
  if (troops.field.length) {
    planned("enemies").filter((e) => e.room !== bossRoom?.id && e.room !== restRoom?.id).slice(0, 4).forEach((e, i) => {
      if (!free(e)) return;
      if (attempt(`보이는 적 (${e.x},${e.y})`, () => placeRoamer(draft, { mapId, x: e.x, y: e.y, troopId: troops.field[(i + salt) % troops.field.length], behavior: "patrol", id: `ev_${mapId}_foe${i + 1}` }, i % 2 === 1))) foes.push(`(${e.x},${e.y})`);
    });
  } else warnings.push(`${map.name}: 데이터베이스에 적 그룹이 없어 보이는 적을 두지 않았다 — upsert_troop 뒤 troops 로 다시 짓거나 place_field_enemy.`);
  if (foes.length) out.push(`보이는 적 ${foes.join(" ")}`);
  // 상자: 보물 방이 먼저(보물 방이 빈 방으로 읽히지 않게), 그다음 곁방 하나.
  // 둘째 상자는 보스로 가는 길 위 방(입구→보스방 조상 방)에 둔다 — 두 상자가 모두 보스방 뒤 보물 방에 있으면 「가는 길 중간 보물」 요청이
  // 안 읽혔다(2026-10-23 dg2-r1 boss-run VQA). 계획 자리가 길 위에 없으면 보스 앞 방(쉼터 아님)의 자리를 하나 더 후보로 넣는다.
  const byId = new Map(rooms.map((r) => [r.id, r] as const));
  const onRoute = new Set<string>();
  for (let r = bossRoom ? byId.get(bossRoom.from ?? "") : undefined, guard = 0; r && guard < 40; r = byId.get(r.from ?? ""), guard += 1) onRoute.add(r.id);
  const behindBoss = (id: string | undefined): boolean => { for (let r = byId.get(id ?? ""), guard = 0; r && guard < 40; r = byId.get(r.from ?? ""), guard += 1) if (r.id === bossRoom?.id) return true; return false; };
  const routeExtra: Array<Pt & { room?: string }> = [...onRoute].map((id) => byId.get(id)!).filter((r) => r.kind !== "entrance" && r.id !== restRoom?.id)
    .flatMap((r) => r.spots.slice(-2).map((c) => ({ ...c, room: r.id })));
  const chestRank = (c: { room?: string }): number => (c.room === vaultId ? 0 : onRoute.has(c.room ?? "") ? 1 : behindBoss(c.room) ? 3 : 2);
  const chestPlan = [...planned("chests"), ...routeExtra].sort((a, b) => chestRank(a) - chestRank(b));
  let routeChest = false;
  const chests: string[] = [];
  for (const c of chestPlan) {
    if (chests.length >= 2) break;   // 같은 그림 조사물 3개부터 린트가 「임시 표식」으로 본다
    if (!free(c)) continue;
    // 보물 방 상자 하나 다음엔 길 위 상자를 먼저 기다린다(길 위 후보가 있으면 다른 곁방은 건너뛴다).
    if (chests.length === 1 && !routeChest && chestRank(c) !== 1 && chestPlan.some((q) => chestRank(q) === 1 && free(q))) continue;
    if (chestRank(c) === 1) routeChest = true;
    if (attempt(`상자 (${c.x},${c.y})`, () => nested(draft, "place_chest", { mapId, x: c.x, y: c.y, id: `ev_${mapId}_chest${chests.length + 1}`, name: c.room === vaultId ? "보물상자" : "던전 상자", contents: chestLoot(draft, salt * 5 + chests.length) }))) chests.push(`(${c.x},${c.y})`);
  }
  if (chests.length) out.push(`상자 ${chests.join(" ")}`);
  const guard = (troopId: string | undefined, id: string, label: string): boolean => {
    if (!bossRoom || !troopId) { warnings.push(`${map.name}: ${label} 자리를 찾지 못했다(${!troopId ? "적 그룹 없음" : "보스방 없음"})`); return false; }
    for (const at of bossRoom.spots.filter(free).slice(0, 4)) {
      if (attempt(`${label} (${at.x},${at.y})`, () => nested(draft, "place_field_enemy", { mapId, x: at.x, y: at.y, troopId, behavior: "stationary", canEscape: false, alert: "anger", id }))) { out.push(`${label} 「${draft.database.troops.find((t) => t.id === troopId)?.name ?? troopId}」(${troopId}) (${at.x},${at.y})`); return true; }
    }
    return false;
  };
  let bosses = 0;
  if (role.boss) bosses = guard(troops.boss, `ev_${mapId}_boss`, "보스") ? 1 : 0;
  else if (role.guardian) bosses = guard(troops.midBoss, `ev_${mapId}_guardian`, "층 수문장") ? 1 : 0;
  let saves = 0;
  if (restRoom) {
    const at = restRoom.spots.find(free);
    if (at && attempt(`세이브 포인트 (${at.x},${at.y})`, () => nested(draft, "place_savepoint", { mapId, x: at.x, y: at.y, heal: true, name: "쉼터 결정", id: `ev_${mapId}_rest` }))) { out.push(`쉼터(회복 세이브) ${restRoom.id} (${at.x},${at.y})`); saves = 1; }
  }
  return { line: out.join(" · "), placed: { enemies: foes.length, chests: chests.length, boss: role.boss ? bosses : 0, guardian: role.boss ? 0 : bosses, save: saves } };
}

const FLOOR_NAME = (base: string, dir: "down" | "up", k: number, n: number): string => (n === 1 ? base : `${base} ${dir === "down" ? `지하 ${k}층` : `${k}층`}`);
/**
 * 탑 한 층(성 문법, 좁은 둥근 층): 아래 둥근 층계참 → 위 둥근 큰 방(북쪽 벽에 다음 층 계단). 꼭대기 층은 둥근 보스방 + 곁의 작은 보물 방.
 * 2026-10-23(assistant-dungeons-2): 옛 층은 홀 양옆으로 곁방을 단 43×32 판이라 「탑이 아니라 넓은 지하 감옥」으로 읽혔다(VQA). 층마다 크기·계단 쪽을 바꾼다.
 */
function towerRooms(top: boolean, k: number, seed = 0): DungeonRoomInput[] {
  // 2026-10-23 dungeon-themes: 위 큰 방은 gap 둥근 탑 링(12칸, 바닥 10×8 — 다음 층으로 가는 방은 안벽 계단 링)이다. 아래 층계참에서 남쪽 통로(pass-s)로 들어간다.
  // 같은 탑을 두 번 지어도 판박이가 아니게: 시드로 층계참 곁 서고(동·서)·꼭대기 링 크기(12·10)·층계참 너비가 바뀐다.
  const h = (n: number) => {
    let x = (Math.imul(seed, 1000003) + Math.imul(n, 7919)) | 0;
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  };
  const landW = 9 + (h(k) < 0.5 ? 0 : 2);
  const landing: DungeonRoomInput = k === 1 && !top ? { id: "gate", kind: "entrance", w: 13, h: 6, shape: "apse" } : { id: "landing", kind: "entrance", w: landW, h: 6, shape: "round" };
  const from = landing.id!;
  const study: DungeonRoomInput[] = h(k + 7) < 0.55 ? [{ id: "study", kind: h(k + 3) < 0.5 ? "library" : "storage", w: 7, h: 6, from, dir: h(k + 11) < 0.5 ? "W" : "E", shape: "round" }] : [];
  if (top) {
    const big = h(99) < 0.6;
    return [landing, { id: "throne", kind: "boss", w: big ? 10 : 8, h: big ? 8 : 6, from, dir: "N", shift: 0, len: 4, shape: "ring" }, ...study];
  }
  return [landing, { id: "hall", kind: "hall", w: 10, h: 8, from, dir: "N", shift: 0, len: 4, shape: "ring" }, ...study];
}

/** 채우기 적 그룹: 준 것은 그대로, 안 준 역할은 던전 주제(dungeonThemeTroops.ts)의 그림으로 만든다 — 세기는 원래 고르던 그룹에 맞춘다. */
function themedTroops(draft: Project, args: Record<string, unknown>): ReturnType<typeof pickTroops> & { theme: string } {
  const base = pickTroops(draft, args.troops);
  const given = (args.troops && typeof args.troops === "object" ? args.troops : {}) as Record<string, unknown>;
  const known = (id: unknown) => typeof id === "string" && draft.database.troops.some((t) => t.id === id);
  const theme = dungeonTheme(args);
  const givenField = Array.isArray(given.field) && given.field.some(known);
  const field = givenField ? base.field : [0, 1].map((i) => ensureThemeTroop(draft, theme, "field", base.field[i % base.field.length], i)).filter((v): v is string => !!v);
  return {
    field: field.length ? [...new Set(field)] : base.field,
    midBoss: known(given.midBoss) ? base.midBoss : ensureThemeTroop(draft, theme, "midBoss", base.midBoss) ?? base.midBoss,
    boss: known(given.boss) ? base.boss : ensureThemeTroop(draft, theme, "boss", base.boss) ?? base.boss,
    theme: theme.label,
  };
}

/** 바깥 출구를 단다: 요청이 온 맵이 있으면 그 맵과 양방향으로 잇고, 없으면 1층 입구 계단에 자리표시 출구 이벤트를 둔다(link_world_entrance 가 나중에 덮는다). */
function attachDefaultExit(draft: Project, mapId: string, data: Record<string, unknown>, sourceId: string | undefined, warnings: string[]): string {
  const map = draft.maps[mapId]!;
  const stair = data.entryStair as Stair | null;
  if (!stair) { warnings.push(`${map.name}: 입구 계단 자리가 없어 바깥 출구를 달지 못했다 — link_world_entrance 로 잇는다.`); return ""; }
  if (sourceId) {
    const src = draft.maps[sourceId]!;
    const origin = draft.startMapId === sourceId ? draft.startPos : { x: Math.floor(src.width / 2), y: Math.floor(src.height / 2) };
    // 시작 위치(또는 가운데)에서 가장 가까운, 이벤트 없고 아래 칸도 걸을 수 있는 칸을 바깥 쪽 문 칸으로 쓴다.
    let best: Pt | null = null; let bd = Infinity;
    for (let y = 1; y < src.height - 1; y += 1) for (let x = 1; x < src.width - 1; x += 1) {
      if (!isPassable(draft, src, x, y) || !isPassable(draft, src, x, y + 1) || src.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
      const d = Math.abs(x - origin.x) + Math.abs(y - origin.y);
      if (d >= 2 && d < bd) { bd = d; best = { x, y }; }
    }
    if (best) {
      try {
        const link = linkEntranceInDraft(draft, { fromMapId: sourceId, x: best.x, y: best.y, toMapId: mapId });
        return `바깥 출구: 요청이 온 맵 ${src.name}(${link.fromGate.x},${link.fromGate.y}) ↔ 이 던전 입구 계단을 양방향으로 이었다(entrance 를 안 줘서 기본으로 이었다 — 다른 곳과 이으려면 link_world_entrance).`;
      } catch (error) {
        if (!(error instanceof ToolError)) throw error;
        warnings.push(`${map.name}: 요청이 온 맵 ${src.name} 과 출구를 잇지 못했다(${error.message}) — 자리표시 출구를 두었다.`);
      }
    }
  }
  const id = `ev_${mapId}_exit_placeholder`;
  const bump = stair.kind === "door";
  upsertEventIntoMap(map, {
    id, name: "던전 출구", x: stair.x, y: stair.y, trigger: { kind: bump ? "action" : "playerTouch" }, commands: [],
    pages: [{
      id: `${id}_page`, name: "바깥 출구(연결 대기)", conditions: [], graphic: { transparent: true }, trigger: { kind: bump ? "action" : "playerTouch" },
      priority: bump ? "same" : "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: bump ? "바깥으로 나가는 문이다. 아직은 열리지 않는다." : "바깥으로 이어지는 계단이다. 아직은 나갈 수 없다." } as Command],
    }],
  } as GameEvent);
  return `바깥 출구: 1층 입구 ${bump ? "문" : "계단"} (${stair.x},${stair.y}) 에 자리표시 출구(${id})를 두었다 — 이어질 바깥 맵이 없다(요청이 온 맵이 비었거나 이 던전 자신). 마을·필드가 생기면 link_world_entrance({worldMapId:<바깥 맵>, links:[{x,y, toMapId:"${mapId}"}]}) 로 잇는다(자리표시는 자동으로 바뀐다).`;
}

/** author_dungeon 본체: 층 수만큼 짓고(계단 잇기), rpg 장르면 적·상자·보스·쉼터까지 채운다. */
function authorDungeon(draft: Project, argsIn: Record<string, unknown>): ToolExecResult {
  // 게임 참고·요청 문장(inspiration, 2026-10-23 dungeon-themes): 「엘든링 같은 지하묘지」 → 종류·배치·장치 기본값. 명시한 인자가 늘 이긴다.
  const args: Record<string, unknown> = { ...argsIn };
  const insp = typeof args.inspiration === "string" ? args.inspiration.trim() : "";
  const refNote: string[] = [];
  if (insp) {
    const req = inferDungeonRequest(`${insp} ${typeof args.name === "string" ? args.name : ""}`);
    if (args.type === undefined && req.type) args.type = req.type;
    if (args.layout === undefined && req.layout) args.layout = req.layout;
    if (args.gimmick === undefined && args.puzzle === undefined && req.gimmick && (DUNGEON_GIMMICKS as readonly string[]).includes(req.gimmick)) args.gimmick = req.gimmick;
    if (req.reference) refNote.push(`참고 「${req.reference.label}」: ${req.reference.note}.`);
  }
  // 「마계 성」「지옥의 신전」: 마계 낱말은 장소(성·신전·동굴)보다 구체적인 주제다 — 모델이 성으로 골라도 마계로 짓는다(2026-10-23 dt-p1 「크로노트리거 같은 마계 성」이 회색 성이 됐다).
  {
    const realm = inferDungeonType(`${insp} ${typeof args.name === "string" ? args.name : ""}`);
    if (realm.type === "otherworld" && (args.type === "castle" || args.type === "temple" || args.type === "cave" || args.type === "catacomb")) {
      refNote.push(`「마계」 낱말 — ${String(args.type)} 대신 마계(otherworld)로 지었다(허공에 뜬 땅·타락한 수정).`);
      args.type = "otherworld";
    }
  }
  // 층을 쌓는 배치(vertical): 층 수를 안 주면 2층(탑·마법탑은 3층 위로).
  if (args.layout === "vertical" && args.floors === undefined && args.rooms === undefined) {
    args.floors = args.type === "tower" ? 3 : 2;
    if (args.direction === undefined && args.type === "tower") args.direction = "up";
  }
  if (args.layout === "vertical") delete args.layout;   // 층 안 배치는 시드 가족(고리·갈래·사슬)로
  const floors = Number.isInteger(args.floors) ? Math.max(1, Math.min(5, args.floors as number)) : 1;
  const direction: "down" | "up" = args.direction === "up" ? "up" : "down";
  const baseSeed = defaultSeed(draft, args);
  // 출구(2026-10-23 assistant-dungeons-2): 한 층짜리 던전도 바깥으로 나가는 계단이 늘 있다 — 「출구 없는 맵」은 VQA blocker/major 였다(9건 중 7건).
  // entrance 를 안 주면 요청이 온 맵(sourceMapId = 실행기가 채운 지금 보는 맵)과 잇고, 그 맵이 비었거나 던전 자신이면 연결 자리표시 출구를 둔다.
  const sourceId = typeof args.sourceMapId === "string" && draft.maps[args.sourceMapId] ? args.sourceMapId : undefined;
  const autoSource = args.entrance === undefined && sourceId && sourceId !== args.mapId && !isBlankMap(draft.maps[sourceId]!) && !draft.maps[sourceId]!.worldmapSource && draft.maps[sourceId]!.mapRole !== "dungeon" ? sourceId : undefined;
  const linked = args.entrance !== undefined;
  const genreHint = args.genre === "pokemon" || args.genre === "rpg" ? args.genre : genreOfProject(draft);
  if (floors > 1 && args.adapter === "monster") throw new ToolError("여러 층 던전은 버들항 어댑터만 잇는다 — 몬스터 키트는 floors 를 빼고 층마다 따로 지은 뒤 link 도구로 잇는다.", { code: "invalid-args" });
  const results: ToolExecResult[] = [];
  const warnings: string[] = [];
  const baseName = typeof args.name === "string" && args.name.trim() ? (floors > 1 ? args.name.trim().replace(/\s*(지하\s*)?\d+\s*층$/u, "") || "탑" : args.name.trim()) : direction === "up" && floors > 1 ? "탑" : "지하 던전";
  const baseId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : "";
  for (let k = 1; k <= floors; k += 1) {
    const first = k === 1, last = k === floors;
    // 들어오는 계단: 1층은 바깥과 이을 때만(안 이으면 죽은 계단이 된다). 다음 층부터는 아래층(지하)·위층(탑)에서 오는 계단.
    const entry: FloorOpts["entry"] = first ? (direction === "up" && floors > 1 ? "door" : "up") : direction === "down" ? "up" : "down";
    const exit: FloorOpts["exit"] = last ? (genreHint === "pokemon" && floors === 1 ? "down" : "none") : direction === "down" ? "down" : "up";
    const floorArgs: Record<string, unknown> = { ...args, name: FLOOR_NAME(baseName, direction, k, floors) };
    delete floorArgs.floors; delete floorArgs.direction; delete floorArgs.populate; delete floorArgs.troops; delete floorArgs.seed; delete floorArgs.sourceMapId;
    if (!first) { delete floorArgs.entrance; delete floorArgs.mapId; floorArgs.id = baseId ? `${baseId}_f${k}` : undefined; }
    if (floors > 1 && direction === "up" && !args.rooms) { floorArgs.rooms = towerRooms(last, k, baseSeed); floorArgs.type = args.type ?? "castle"; }
    else if (floors > 1 && !args.rooms && !args.size) floorArgs.size = last ? "medium" : "small";
    results.push(buildFloor(draft, floorArgs, { seed: baseSeed + (k - 1) * 101, entry, exit }));
  }
  const datas = results.map((r) => r.data as Record<string, unknown>);
  const mapIds = datas.map((d) => String(d.mapId));
  const exitLine = linked ? "" : attachDefaultExit(draft, mapIds[0]!, datas[0]!, autoSource, warnings);
  // 층 잇기: k 층 나가는 계단 ↔ k+1 층 들어오는 계단. 도착은 상대 계단 앞 칸, 계단을 등진다.
  const links: string[] = [];
  for (let k = 0; k + 1 < datas.length; k += 1) {
    const a = datas[k]!.exitStair as Stair | null, b = datas[k + 1]!.entryStair as Stair | null;
    const ma = draft.maps[mapIds[k]!]!, mb = draft.maps[mapIds[k + 1]!]!;
    if (!a || !b) { warnings.push(`${ma.name} ↔ ${mb.name}: 계단 자리가 없어 잇지 못했다 — create_transfer_pair 로 잇는다.`); continue; }
    stairEvent(ma, `ev_${ma.id}_stair_next`, a, `${mb.name}(으)로`, { mapId: mb.id, land: b.front, facing: DIR_OF(b, b.front) });
    stairEvent(mb, `ev_${mb.id}_stair_back`, b, `${ma.name}(으)로`, { mapId: ma.id, land: a.front, facing: DIR_OF(a, a.front) });
    links.push(`${ma.id}(${a.x},${a.y}) ↔ ${mb.id}(${b.x},${b.y})`);
  }
  // 주제 장치(2026-10-23 dungeon-themes): 버들항 rpg 던전은 마지막 층에 그 주제다운 장치 하나를 둔다(gimmick 생략 = 주제 기본, "none" = 끔).
  const filled: string[] = [];
  let gimmickPlaced: DungeonGimmick | null = null;
  const gimmickArg = args.gimmick === "none" ? "none" : (DUNGEON_GIMMICKS as readonly string[]).includes(String(args.gimmick)) ? (args.gimmick as DungeonGimmick) : args.puzzle === "lever" ? "lever" : undefined;
  if (gimmickArg !== "none" && datas.every((d) => d.adapter === "beodeul") && (gimmickArg || (args.populate !== false && datas.every((d) => d.genre === "rpg")))) {
    const i = datas.length - 1;
    const m = draft.maps[mapIds[i]!]!;
    const { gimmick, line } = placeThemeGimmick(draft, m, datas[i]!, datas[i]!.type as DungeonType, gimmickArg, baseSeed, warnings, () => placeLeverGate(draft, m, datas[i]!, []));
    gimmickPlaced = gimmick;
    if (line) filled.push(`${m.name}: ${line}`);
  }
  // 채우기(rpg): 생략하면 켠다. 몬스터 수집(pokemon)은 야생 조우 구역이 정본이라 건너뛴다.
  const populate = args.populate !== false && datas.every((d) => d.genre === "rpg");
  const placedTotal = { enemies: 0, chests: 0, boss: 0, guardian: 0, save: 0 };
  if (populate) {
    const troops = themedTroops(draft, { ...args, type: args.type ?? datas[0]?.type });
    datas.forEach((d, i) => {
      const last = i === datas.length - 1;
      const { line, placed } = populateFloor(draft, mapIds[i]!, d, troops, { boss: last, guardian: !last && i === datas.length - 2, rest: last && (datas.length > 1 || list(d, "rooms").length >= 5) }, baseSeed + i, warnings);
      if (line) filled.push(`${draft.maps[mapIds[i]!]!.name}: ${line}`);
      // 계획 자리(enemies 7·chests 7 같은 후보 목록)를 그대로 두면 조수가 그 수를 「상자 7개」로 답했다(2026-10-23 VQA). 채운 뒤에는 실제로 놓인 수만 남긴다.
      const plan = field(d, "population");
      d.population = { ...(field(plan, "lockedGate") ? { lockedGate: field(plan, "lockedGate") } : {}), note: "채움 완료 — 놓인 이벤트 수는 placed 에 있다. 계획 후보 자리는 지웠다." };
      d.placed = placed;
      placedTotal.enemies += placed.enemies; placedTotal.chests += placed.chests; placedTotal.boss += placed.boss; placedTotal.guardian += placed.guardian; placedTotal.save += placed.save;
    });
  }
  // 레버 쇠창살을 안 놓았으면 잠긴 문 계획을 지운다 — 남겨 두면 조수가 「열쇠로 여는 잠긴 문이 있다」로 답했다(2026-10-23 VQA boss-run).
  if (gimmickPlaced !== "lever") for (const d of datas) { const pop = field(d, "population"); if (pop && typeof pop === "object") delete (pop as Record<string, unknown>).lockedGate; }
  const floorWarnings = results.flatMap((r) => r.warnings ?? []);
  // 이미 채웠으면 「계획대로 직접 놓아라」는 문장을 빼고 채운 결과만 알린다(조수가 같은 자리에 적·상자를 또 놓았다).
  // 채웠으면 「잠긴 문을 둘 수 있는 칸」도 뺀다 — 조수가 그 문장을 「열쇠로 여는 잠긴 문이 있다」로 답했다(2026-10-23 VQA boss-run).
  const sums = results.map((r) => (populate ? r.summary.replace(" 이벤트·적·상자는 data.rooms[].spots 좌표에만 두고, data.population 의 계획을 따른다.", "").replace(/, 잠긴 문을 둘 수 있는 통로 칸 \(\d+,\d+\) — 문은 아직 없다/u, "") : r.summary));
  const head = results.length === 1 ? sums[0]! : `${results.length}층 ${direction === "up" ? "탑" : "지하"} 던전: ${sums.map((t, i) => `[${i + 1}] ${t}`).join(" ")}`;
  const tail = [
    links.length ? `층 계단을 이었다: ${links.join(" / ")}(도착은 계단 앞 칸, 계단을 등진다).` : "",
    filled.length ? `채움 — ${filled.join(" / ")}. 실제로 놓인 수: 보이는 적 ${placedTotal.enemies} · 상자 ${placedTotal.chests}${placedTotal.boss ? ` · 보스 ${placedTotal.boss}` : ""}${placedTotal.guardian ? ` · 층 수문장 ${placedTotal.guardian}` : ""}${placedTotal.save ? ` · 회복 세이브 ${placedTotal.save}` : ""} — 사용자에게는 이 수와 위 좌표만 말한다(열쇠·잠긴 문·함정은 따로 놓기 전에는 없다).` : populate ? "" : "채우기는 끔(populate:false) — data.population 계획대로 직접 놓는다.",
    exitLine,
  ].filter(Boolean).join(" ");
  const all = [...floorWarnings, ...warnings];
  return {
    summary: `${refNote.join(" ")} ${head} ${tail}`.trim(),
    data: results.length === 1 ? { ...datas[0], floors: [mapIds[0]], populated: populate, gimmick: gimmickPlaced } : { ...datas[0], floors: mapIds, floorData: datas, links, populated: populate, gimmick: gimmickPlaced },
    ...(all.length ? { warnings: all } : {}),
  };
}

export const AUTHOR_DUNGEON_TOOL: ToolDefinition = {
  name: "author_dungeon",
  description:
    "던전 한 층을 한 번에 시공한다. 칩셋 계열이 어댑터를, 장르가 배치·채우기 계획을 정한다 — 같은 「던전 만들어 줘」가 포켓몬풍(몬스터 수집) 프로젝트에서는 짧은 동굴(방 2~4, 야생 조우 구역·시선 트레이너·지름길)이고 버들항 프로젝트에서는 긴 던전(방 6~9, 보스·보물·잠긴 문)이다. " +
    "종류(type): " + TYPE_LIST + ". 사용자 말 → type: 지하묘지·카타콤·감옥·납골당=catacomb · 성·요새·성채·성 지하=castle · 미궁·미로=labyrinth · 하수도·수로=sewer · 동굴·지하 호수=cave · 신전·사원·고대 유적=temple · 광산·갱도=mine · 화산·용암=volcano · 얼음 동굴·빙굴·설산=ice · 숲·정글·세계수=forest · 늪·습지·맹그로브=swamp · 피라미드·사막 왕묘·모래 무덤=pyramid · 마법탑·마도사의 탑=tower · 마계·이세계·지옥·심연=otherworld. 「던전」은 동굴만이 아니다 — 숲·늪(나무 벽 야외 던전, 맵 남쪽 끝 길이 출구)·유적·피라미드·마법탑·마계도 이 도구 한 번이다. 게임 이름(「엘든링 같은」「FF6 광산」「크로노 트리거」)은 inspiration 에 그대로 넣는다 — 종류·배치(layout)·주제 장치(gimmick)를 정한다. 같은 종류를 두 번 지어도 배치 가족(사슬·갈래·고리)·장치가 시드로 달라진다. " +
    "어댑터별 지을 수 있는 종류(여기 없는 종류는 거절 — 다른 칩셋 조각으로 바꿔 칠하지 않는다):\n" + capabilityTableText() + "\n" +
    "거절 응답(code type-unsupported-by-tileset)에는 가장 가까운 지원 종류가 들어 있다 — 사용자에게 알리고 그 종류로 다시 부르거나, 다른 칩셋은 사용자 승인(ask_tileset_change) 뒤에만. 칩셋은 mapId 의 칩셋 → 장르 순으로 고른다(몬스터 수집 프로젝트 = 몬스터 키트, 그 밖 = 버들항). " +
    "genre 로 장르를 바꿀 수 있다: pokemon(" + GENRE_PRESETS.pokemon.blurb + ") · rpg(" + GENRE_PRESETS.rpg.blurb + "). 생략하면 프로젝트 장르(monster-collect → pokemon, 그 밖 → rpg). variant: 몬스터 키트 cave 는 기본 마른 갈색 동굴, variant:'wet' 이면 물웅덩이 있는 바다 동굴. " +
    "좌표를 계산하지 않는다 — 방 목록(종류·크기·어느 방에서 이어지는지, 버들항 방+통로 문법만)을 주거나 rooms 를 생략하고 size 만 줘도 된다. 코드가 방 배치·통로·벽·바닥·장식을 깔고, 물건은 받침이 있는 칸에만 놓되 문과 문 사이 길은 막지 않는다. " +
    "모든 방이 입구에서 걸어 닿고 허공에 뜬 물체가 0 인지 스스로 검사한 뒤에만 맵을 만든다(어기면 맵을 만들지 않고 거부). " +
    "rooms(버들항 방+통로 문법: catacomb·castle·sewer·temple·mine·pyramid·tower)는 순서대로 이어진다(첫 방 = 입구, from 생략 = 바로 앞 방 근처, dir 은 문 방향 N·S·W·E, 생략하면 층 모양에 맞게 자동). kind: entrance 입구 홀 · hall 큰 홀 · crypt 묘실 · cell 감방 · shrine 제단 방 · boss 보스방 · storage 창고 · vault 보물 방. cave·volcano·ice·labyrinth·forest·swamp·otherworld 는 rooms 를 주지 않고 size(또는 genre)만(pyramid·tower 는 방 문법 — tower kind library 서고). 버들항 rpg 던전은 마지막 층에 주제 장치 하나(gimmick)를 스스로 둔다. " +
    "맵 크기는 방 배치로 정해진다(결과 data.width/height). 원하는 크기가 있으면 width·height 를 준다. 던전 층은 이 도구 한 번이면 된다 — stamp_object·paint_tiles 로 벽·천장·소품을 따로 깔지 말 것(받침 규칙이 거절한다). " +
    "결과 data.rooms[].spots 는 적·상자·NPC 이벤트를 둘 수 있는 빈 바닥 칸이다 — 이벤트는 그 좌표에만 둔다. data.stairsUp.front 는 입구 앞 칸(위층으로 가는 이동 지점), data.stairsDown 은 내려가는 구멍·계단 칸. " +
    "data.anchors: boss(보스방 id), treasure(보물 방 id), gate(그 방으로 들어가는 통로 칸 — 잠긴 문·열쇠 이벤트 자리). " +
    "data.population 은 장르별 채우기 계획이다: pokemon = wildZones(야생 조우 구역 — 이 도구가 방마다 「야생 조우」 이름표 구역을 만들고, encounters:[{troopId,weight}] 를 주면 구역별 encounterTable 도 깐다) · enemies(시선 있는 트레이너 자리: 같은 좌표·sightRange·face 로 place_field_enemy 를 부른다) · shortcut(깊은 방 구멍 → 입구 앞 칸 이동 이벤트) · boss(선택) / rpg = enemies(필드 적) · chests · boss · lockedGate(문 칸+열쇠 방). 계획의 이벤트는 기존 도구로 직접 놓는다. " +
    "entrance:{fromMapId, place|x,y} 를 주면 야외·월드맵 입구와 이 던전을 자동으로 양방향 잇는다(고아 맵이 안 남는다) — 월드맵 「광산 입구」 장소에 place 로 바로 붙여라. 나중에 잇거나 여러 곳을 한 번에 이으려면 link_world_entrance. "
    + "층 수(floors)·방향(direction)을 주면 여러 층을 한 번에 짓고 계단을 잇는다. rpg 장르는 기본으로 적·상자·보스·쉼터까지 채운다(populate) — 채운 뒤 따로 place_field_enemy·place_chest 를 또 부르지 말고 결과 요약을 확인만 한다. 1층 입구 계단은 늘 바깥 출구다(entrance 를 안 주면 요청이 온 맵과 잇고, 그 맵이 비었으면 연결 자리표시 출구), 마지막 층에는 내려가는 계단을 그리지 않는다(어디로도 안 가는 장식 계단 금지). "
    + "mapId 없으면 새 맵을 만든다. mapId 가 있으면 비어 있는 같은 계열 맵을 방 배치 크기로 넓혀 그 자리에 짓는다(내용이 있는 맵이면 거부 — 새 맵으로). 시작 맵이면 시작 위치를 입구로 옮긴다.",
  mode: "write",
  domains: ["map", "tile"],
  preservesAuthoredRaster: true,
  // 채우기(populate)·레버 퍼즐이 상자·세이브 결정·전투 그림의 필드 적·레버·쇠창살 그림을 스스로 고른다 — 모델이 칩을 고르지 않는다.
  // 실측(2026-10-22 dg-r1): 이 표시가 없어 charsetSelectionGate 가 「캐릭터 그림 선택을 되돌렸습니다」로 세 번 거부했다.
  choosesOwnGraphic: (args) => args.populate !== false || args.puzzle === "lever" || (typeof args.gimmick === "string" && args.gimmick !== "none"),
  fillsCurrentMapIdAs: "sourceMapId",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      entrance: ENTRANCE_OPTION_SCHEMA,
      mapId: { type: "string", description: "비어 있는 기존 버들항 맵 id(시작 빈 맵 등). 생략하면 새 맵." },
      id: { type: "string", description: "새 맵 id(생략 시 자동)" },
      name: { type: "string", description: "새 맵 이름(기본: 지하 던전)" },
      type: { type: "string", enum: [...DUNGEON_TYPES], description: "던전 종류(생략하면 장르 기본: pokemon·monster → cave, rpg·버들항 → catacomb): " + TYPE_LIST + ". 칩셋 어댑터가 못 짓는 종류는 거절된다. 종류마다 방 종류(kind)가 다르다 — sewer: channel·cistern·pump / temple: nave / mine: junction·stope·depot / cave·volcano·ice: rooms 를 주지 않고 size 만 / labyrinth: size 만." },
      genre: { type: "string", enum: [...DUNGEON_GENRES], description: "장르 프리셋(생략 = 프로젝트 장르): pokemon 짧은 던전(방 2~4, 야생 조우·시선 트레이너·지름길) · rpg 긴 던전(방 여럿, 보스·보물·잠긴 문·필드 적)." },
      variant: { type: "string", description: "종류의 변형. 몬스터 키트 cave: 기본=마른 갈색 동굴, 'wet'=물웅덩이 있는 바다 동굴. 그 밖에는 없다." },
      adapter: { type: "string", enum: ["beodeul", "monster"], description: "칩셋 어댑터를 직접 지정(보통 생략 — mapId 의 칩셋·프로젝트 장르가 정한다). 다른 계열 칩셋으로 가려면 사용자 승인이 먼저다." },
      encounters: { type: "array", description: "야생 조우(pokemon): [{troopId, weight}] — 야생 조우 구역(방)마다 locationId 조건으로 encounterTable 에 깐다. 생략하면 구역 이름표만 만들고 set_encounter_table 로 잇는다.", items: { type: "object", properties: { troopId: { type: "string" }, weight: { type: "integer" } }, required: ["troopId"] } },
      encounterRate: { type: "integer", description: "야생 조우 확률(걸음당 %, 기본 12). encounters 를 줄 때만." },
      style: { type: "string", enum: [...DUNGEON_STYLES], description: "catacomb·castle 방 문법의 벽 양식(선택)" },
      seed: { type: "integer", description: "배치·장식 변주 시드(같은 값 = 같은 층). 생략하면 맵 id·이름으로 정한다(던전마다 다르다)" },
      sourceMapId: { type: "string", description: "요청이 온 맵 id(생략하면 실행기가 지금 보는 맵으로 채운다). entrance 를 안 주면 이 맵과 던전 입구 계단을 잇는다 — 이 맵이 비었거나 던전 자신이면 연결 자리표시 출구를 둔다." },
      rebuild: { type: "boolean", description: "true 면 mapId 의 기존 던전 맵(이 도구가 지은 것)을 그 자리에서 다시 짓는다. 결과가 마음에 안 들 때 새 맵을 또 만들지 말고 이것을 쓴다(한 층만)." },
      floors: { type: "integer", description: "층 수 1~5(기본 1). 2 이상이면 층마다 맵을 하나씩 짓고 계단으로 잇는다(이동 이벤트는 계단 그림 칸, 도착은 상대 계단 앞 칸에서 계단을 등진다). 「3층 탑」「지하 2층까지」는 이 인자 하나로 — 층마다 author_dungeon 을 따로 부르고 create_transfer_pair 로 잇지 말 것. 버들항만." },
      direction: { type: "string", enum: ["down", "up"], description: "floors 가 2 이상일 때 층 방향: down(기본) 지하로 내려가는 던전(이름 「지하 N층」, 입구 방 북벽 오르는 계단 ↔ 깊은 방 바닥 내려가는 계단) · up 탑(이름 「N층」, 깊은 방 북벽 오르는 계단 ↔ 위층 입구 방 바닥 내려가는 계단, 꼭대기 층에 보스방·보물 방)." },
      populate: { type: "boolean", description: "rpg 장르 채우기(기본 true): 계획된 자리에 보이는 적(순찰)·상자(보물 방 먼저)·마지막 층 보스방 보스(도망 불가)·보스 앞 방 회복 세이브 포인트·그 아래층 층 수문장. 적 그룹은 troops 또는 데이터베이스에서 세기 순으로 고른다. false 면 data.population 계획만 돌려준다." },
      troops: { type: "object", additionalProperties: false, description: "채우기에 쓸 적 그룹 id(선택). 비우면 이 도구가 던전 주제(이름 낱말·소굴·잠김·탑·종류)에 맞는 적·보스 그룹을 만든다 — 지하 묘지 = 언데드·리치, 탑 = 흑기사, 화산 = 화염 짐승·붉은 용, 고블린 굴 = 고블린·대장. 사용자가 적을 직접 말했을 때만 upsert_troop 으로 만들어 여기 준다. 요청에 없는 용·드래곤 그룹을 보스로 고르지 말 것", properties: { field: { type: "array", items: { type: "string" }, description: "돌아다니는 잡몹 무리" }, midBoss: { type: "string", description: "층 수문장" }, boss: { type: "string", description: "마지막 방 보스" } } },
      gimmick: { type: "string", enum: [...DUNGEON_GIMMICKS, "none"], description: "주제 장치(마지막 층에 하나, 버들항). 생략하면 종류에 맞는 장치를 스스로 고른다(" + Object.entries(THEME_GIMMICKS).map(([t, g]) => `${t}=${g.join("/")}`).join(" · ") + "). " + DUNGEON_GIMMICKS.map((g) => `${g} ${GIMMICK_LABEL[g]}`).join(" · ") + " · none 장치 없음. 자리가 없으면 그 종류의 다음 장치로 바꾸고 경고한다 — 장치 이벤트를 따로 손으로 놓지 말 것." },
      inspiration: { type: "string", description: "사용자가 말한 게임·분위기 그대로(「엘든링 같은」「FF6 광산」「크로노 트리거 마법 왕국」). 종류(type)·배치(layout)·장치(gimmick)를 안 줬을 때 기본값을 정한다: " + DUNGEON_REFERENCES.map((r) => `${r.label} → ${r.type}${r.layout ? `·${r.layout}` : ""}${r.gimmick ? `·${r.gimmick}` : ""}`).join(" / ") + ". 종류 낱말(지하묘지·마계…)이 함께 오면 그 낱말이 이긴다." },
      layout: { type: "string", enum: [...DUNGEON_LAYOUTS], description: "층 배치 가족: linear 한 줄 사슬(곁방 하나) · hub 가운데 홀에서 갈래 · loop 고리로 돌아오는 지름길 · vertical 층을 쌓는다(floors 생략 시 2층, tower 는 3층 위로). 생략하면 시드로 고른다 — 같은 종류 두 번 요청도 배치가 달라진다." },
      puzzle: { type: "string", enum: ["lever"], description: "같은 칩셋 안의 퍼즐(마지막 층): lever = 보물 방(없으면 보스방)으로 들어가는 통로를 닫힌 쇠창살로 막고, 먼 곁방에 레버를 둔다(당기면 열림). 「레버로 문을 여는 퍼즐 던전」은 이것 하나 — 다른 칩셋(손 도트 실내) 퍼즐 방을 따로 만들어 잇지 말 것(화풍이 갈린다)." },
      lair: { type: "boolean", description: "무리가 사는 소굴(고블린·도적·오크·짐승 굴): 버들항 cave 방마다 모닥불·가죽 걸이·궤짝·통·자루·뼈 무더기를 깔아 「누가 사는 굴」로 읽히게 한다. 보스방은 우두머리 자리로 더 쌓는다. 「고블린 굴」은 type cave + lair:true + troops." },
      rockLine: { type: "string", enum: ["A", "B", "C", "none"], description: "버들항 동굴 바위 덩이 줄(가로 2줄 바위 앞면 + 바위 윗면). 비우면 cave→A(동굴 바위)·mine→B(광산 바위)·volcano→C(화산암). none 이면 옛 3줄 돌벽. 보통은 비워 둔다." },
      flooded: { type: "boolean", description: "물에 잠긴 던전(신전·묘지·성 등 방 문법 종류): 큰 방(본당·예배실) 가운데가 둥글고 들쭉날쭉한 못으로 잠기고 벽 둘레 두 칸은 마른 회랑으로 남는다(모든 문이 이어진다). 「물에 잠긴 신전」은 type temple + flooded:true — fill_region 으로 물을 직접 칠하지 말 것." },
      size: { type: "string", enum: [...DUNGEON_SIZES], description: "rooms 를 생략했을 때 층 크기: small 방 4 · medium 6(기본) · large 9" },
      width: { type: "integer", description: "바라는 맵 가로(칸, 선택). rooms 생략 시 방 수를 이 넓이에 맞추고, 배치가 이 비율로 자란다." },
      height: { type: "integer", description: "바라는 맵 세로(칸, 선택)." },
      rooms: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        description: "방 목록(첫 방 = 입구). 보통 4~8개. 생략하면 size 로 입구 → 큰 홀 → 갈래 방들 → 보스방(+보물 방)을 정한다.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "방 이름표(from 에서 가리킨다). 생략하면 kind+순번" },
            kind: { type: "string", enum: [...DUNGEON_ROOM_KINDS] },
            w: { type: "integer", description: "바닥 가로 6~40(생략하면 종류별 기본)" },
            h: { type: "integer", description: "바닥 세로 5~22(벽 앞면 3줄은 위에 따로 붙는다)" },
            len: { type: "integer", description: "앞 방과 잇는 통로 길이(칸, 선택 — 긴 갱도·곧은 신전 축에)" },
            shift: { type: "integer", description: "앞 방 가운데에서 옆으로 어긋나는 칸 수(선택 — 0 이면 정중앙 대칭)" },
            from: { type: "string", description: "이어지는 앞 방 id 또는 kind(생략하면 바로 앞 방)" },
            dir: { type: "string", enum: [...DUNGEON_DIRS], description: "앞 방의 어느 쪽 문에서 뻗나 N 북·S 남·W 서·E 동(생략하면 자동)" },
          },
        },
      },
    },
  },
  invalidArgsExample: { size: "medium" },
  run(draft: Project, args) {
    return authorDungeon(draft, args);
  },
};

/** 옛 이름(2026-10-14 ~ 15): 버들항 전용으로 불리던 도구. 같은 시공기로 가되 어댑터를 버들항으로 고정한다. */
export const AUTHOR_BEODEUL_DUNGEON_ALIAS: ToolDefinition = {
  ...AUTHOR_DUNGEON_TOOL,
  name: "author_beodeul_dungeon",
  description: "author_dungeon 의 옛 이름 — 버들항 어댑터로 고정된 던전 시공(몬스터 키트·장르 프리셋 없이 rpg 장르). 새 요청은 author_dungeon 을 쓴다. 인자·결과는 같다.",
  run(draft, args) { return AUTHOR_DUNGEON_TOOL.run(draft, { ...args, adapter: "beodeul", genre: "rpg" }); },
};
