// author_dungeon — 던전 한 층을 시공한다(2026-10-14 버들항 author_beodeul_dungeon 으로 시작, 2026-10-15 칩셋 어댑터·장르 프리셋으로 일반화).
// 사용자 스크린샷(field-enemy fe1): 조수가 던전 층을 stamp_object 112번 + paint_tiles 67번(절대 좌표)으로 깔다 25분 시간 초과,
// 횃불·화로·통·상자·기둥이 허공에 뜨고 벽 조각이 바닥에 서고 이벤트가 천장 칸에 놓였다. 좌표를 모델이 고르지 않게 한다.
// 계산은 src/editor/dungeonKit/ — 중립 마스크(mask.ts) + 칩셋 어댑터(beodeul/·monster/) + 장르 프리셋(genres.ts) + 라우팅(route.ts).
import { isPassable } from "@/project/collision";
import { groundSupportIssues } from "@/project/groundSupport";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { EncounterTableEntry, GameMap, Project } from "@/project/types";
import { DUNGEON_DIRS, DUNGEON_ROOM_KINDS, DUNGEON_SIZES, DUNGEON_STYLES, DUNGEON_TYPES, type DungeonRoomInput, type DungeonSpec } from "../dungeonKit/types";
import { DungeonComposeError } from "../dungeonKit/errors";
import { capabilityTableText } from "../dungeonKit/capabilities";
import { DUNGEON_GENRES, GENRE_PRESETS, planPopulation } from "../dungeonKit/genres";
import { GRAMMAR } from "../dungeonKit/grammar";
import { composeRouted, routeDungeon } from "../dungeonKit/route";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition } from "./types";

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

export const AUTHOR_DUNGEON_TOOL: ToolDefinition = {
  name: "author_dungeon",
  description:
    "던전 한 층을 한 번에 시공한다. 칩셋 계열이 어댑터를, 장르가 배치·채우기 계획을 정한다 — 같은 「던전 만들어 줘」가 포켓몬풍(몬스터 수집) 프로젝트에서는 짧은 동굴(방 2~4, 야생 조우 구역·시선 트레이너·지름길)이고 버들항 프로젝트에서는 긴 던전(방 6~9, 보스·보물·잠긴 문)이다. " +
    "종류(type): " + TYPE_LIST + ". 사용자 말 → type: 지하묘지·카타콤·감옥·던전=catacomb · 성 지하·성채·마왕성=castle · 미궁·미로=labyrinth · 하수도·수로=sewer · 동굴·지하 호수=cave · 신전·사원·유적=temple · 광산·갱도=mine · 화산·용암=volcano · 얼음 동굴·빙굴=ice. " +
    "어댑터별 지을 수 있는 종류(여기 없는 종류는 거절 — 다른 칩셋 조각으로 바꿔 칠하지 않는다):\n" + capabilityTableText() + "\n" +
    "거절 응답(code type-unsupported-by-tileset)에는 가장 가까운 지원 종류가 들어 있다 — 사용자에게 알리고 그 종류로 다시 부르거나, 다른 칩셋은 사용자 승인(ask_tileset_change) 뒤에만. 칩셋은 mapId 의 칩셋 → 장르 순으로 고른다(몬스터 수집 프로젝트 = 몬스터 키트, 그 밖 = 버들항). " +
    "genre 로 장르를 바꿀 수 있다: pokemon(" + GENRE_PRESETS.pokemon.blurb + ") · rpg(" + GENRE_PRESETS.rpg.blurb + "). 생략하면 프로젝트 장르(monster-collect → pokemon, 그 밖 → rpg). variant: 몬스터 키트 cave 는 기본 마른 갈색 동굴, variant:'wet' 이면 물웅덩이 있는 바다 동굴. " +
    "좌표를 계산하지 않는다 — 방 목록(종류·크기·어느 방에서 이어지는지, 버들항 방+통로 문법만)을 주거나 rooms 를 생략하고 size 만 줘도 된다. 코드가 방 배치·통로·벽·바닥·장식을 깔고, 물건은 받침이 있는 칸에만 놓되 문과 문 사이 길은 막지 않는다. " +
    "모든 방이 입구에서 걸어 닿고 허공에 뜬 물체가 0 인지 스스로 검사한 뒤에만 맵을 만든다(어기면 맵을 만들지 않고 거부). " +
    "rooms(버들항 방+통로 문법: catacomb·castle·sewer·temple·mine)는 순서대로 이어진다(첫 방 = 입구, from 생략 = 바로 앞 방 근처, dir 은 문 방향 N·S·W·E, 생략하면 층 모양에 맞게 자동). kind: entrance 입구 홀 · hall 큰 홀 · crypt 묘실 · cell 감방 · shrine 제단 방 · boss 보스방 · storage 창고 · vault 보물 방. cave·volcano·ice·labyrinth 는 rooms 를 주지 않고 size(또는 genre)만. " +
    "맵 크기는 방 배치로 정해진다(결과 data.width/height). 원하는 크기가 있으면 width·height 를 준다. 던전 층은 이 도구 한 번이면 된다 — stamp_object·paint_tiles 로 벽·천장·소품을 따로 깔지 말 것(받침 규칙이 거절한다). " +
    "결과 data.rooms[].spots 는 적·상자·NPC 이벤트를 둘 수 있는 빈 바닥 칸이다 — 이벤트는 그 좌표에만 둔다. data.stairsUp.front 는 입구 앞 칸(위층으로 가는 이동 지점), data.stairsDown 은 내려가는 구멍·계단 칸. " +
    "data.anchors: boss(보스방 id), treasure(보물 방 id), gate(그 방으로 들어가는 통로 칸 — 잠긴 문·열쇠 이벤트 자리). " +
    "data.population 은 장르별 채우기 계획이다: pokemon = wildZones(야생 조우 구역 — 이 도구가 방마다 「야생 조우」 이름표 구역을 만들고, encounters:[{troopId,weight}] 를 주면 구역별 encounterTable 도 깐다) · enemies(시선 있는 트레이너 자리: 같은 좌표·sightRange·face 로 place_field_enemy 를 부른다) · shortcut(깊은 방 구멍 → 입구 앞 칸 이동 이벤트) · boss(선택) / rpg = enemies(필드 적) · chests · boss · lockedGate(문 칸+열쇠 방). 계획의 이벤트는 기존 도구로 직접 놓는다. " +
    "mapId 없으면 새 맵을 만든다. mapId 가 있으면 비어 있는 같은 계열 맵을 방 배치 크기로 넓혀 그 자리에 짓는다(내용이 있는 맵이면 거부 — 새 맵으로). 시작 맵이면 시작 위치를 입구로 옮긴다.",
  mode: "write",
  domains: ["map", "tile"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "비어 있는 기존 버들항 맵 id(시작 빈 맵 등). 생략하면 새 맵." },
      id: { type: "string", description: "새 맵 id(생략 시 자동)" },
      name: { type: "string", description: "새 맵 이름(기본: 지하 던전)" },
      type: { type: "string", enum: [...DUNGEON_TYPES], description: "던전 종류(생략하면 장르 기본: pokemon·monster → cave, rpg·버들항 → catacomb): " + TYPE_LIST + ". 칩셋 어댑터가 못 짓는 종류는 거절된다. 종류마다 방 종류(kind)가 다르다 — sewer: channel·cistern·pump / temple: nave / mine: junction·stope·depot / cave·volcano·ice: rooms 를 주지 않고 size 만 / labyrinth: size 만." },
      genre: { type: "string", enum: [...DUNGEON_GENRES], description: "장르 프리셋(생략 = 프로젝트 장르): pokemon 짧은 던전(방 2~4, 야생 조우·시선 트레이너·지름길) · rpg 긴 던전(방 여럿, 보스·보물·잠긴 문·필드 적)." },
      variant: { type: "string", description: "종류의 변형. 몬스터 키트 cave: 기본=마른 갈색 동굴, 'wet'=물웅덩이 있는 바다 동굴. 그 밖에는 없다." },
      adapter: { type: "string", enum: ["beodeul", "monster"], description: "칩셋 어댑터를 직접 지정(보통 생략 — mapId 의 칩셋·프로젝트 장르가 정한다). 다른 계열 칩셋으로 가려면 사용자 승인이 먼저다." },
      encounters: { type: "array", description: "야생 조우(pokemon): [{troopId, weight}] — 야생 조우 구역(방)마다 locationId 조건으로 encounterTable 에 깐다. 생략하면 구역 이름표만 만들고 set_encounter_table 로 잇는다.", items: { type: "object", properties: { troopId: { type: "string" }, weight: { type: "integer" } }, required: ["troopId"] } },
      encounterRate: { type: "integer", description: "야생 조우 확률(걸음당 %, 기본 12). encounters 를 줄 때만." },
      seed: { type: "integer", description: "배치·장식 변주 시드(같은 값 = 같은 층). 기본 7" },
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
    const rooms = Array.isArray(args.rooms) ? (args.rooms as DungeonRoomInput[]) : [];
    const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
    const typeArg = (DUNGEON_TYPES as readonly string[]).includes(String(args.type)) ? (args.type as DungeonSpec["type"]) : undefined;
    const spec: DungeonSpec = {
      ...(rooms.length ? { rooms } : {}),
      ...(typeArg ? { type: typeArg } : {}),
      style: (DUNGEON_STYLES as readonly string[]).includes(String(args.style)) ? (args.style as DungeonSpec["style"]) : undefined,
      seed: Number.isInteger(args.seed) ? (args.seed as number) : 7,
      size: (DUNGEON_SIZES as readonly string[]).includes(String(args.size)) ? (args.size as DungeonSpec["size"]) : undefined,
      width: int(args.width), height: int(args.height),
    };
    const requestedMapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (requestedMapId && !draft.maps[requestedMapId]) throw new ToolError(`맵이 없습니다: ${requestedMapId}`, { code: "map-not-found", mapId: requestedMapId });
    let composed, route;
    try {
      route = routeDungeon(draft, {
        type: typeof args.type === "string" ? args.type : undefined, variant: typeof args.variant === "string" ? args.variant : undefined,
        adapter: typeof args.adapter === "string" ? args.adapter : undefined, genre: typeof args.genre === "string" ? args.genre : undefined,
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
      if (existing.tilesetId !== tilesetId) throw new ToolError(`맵 ${mapId} 은 ${route.adapter === "monster" ? "이 종류가 쓰는 몬스터 시트" : "버들항"} 맵이 아니다(${existing.tilesetId}) — mapId 를 빼고 새 맵으로 짓는다.`, { code: "tileset-family-mismatch", mapId });
      if (!isBlankMap(existing)) throw new ToolError(`맵 ${mapId} 에는 이미 내용이 있어 덮어쓰지 않는다 — mapId 를 빼고 새 맵으로 짓는다.`, { code: "map-not-blank", mapId });
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
    // 만든 결과를 한 번 더, 실제 맵으로 검사한다(조립기 내부 검사와 같은 규칙).
    const bad = groundSupportIssues(map, tileset, { events: false }).filter((issue) => issue.severity === "error");
    if (bad.length) throw new ToolError(`시공 결과에 받침 없는 물체 ${bad.length}건: ${bad[0]!.message}`, { code: "support-violation", mapId });
    if (draft.startMapId === mapId) {
      const start = { x: composed.entrance.x, y: composed.entrance.y };
      if (isPassable(draft, map, start.x, start.y)) {
        draft.startPos = { ...draft.startPos, ...start };
        notes.push(`시작 위치를 입구 (${start.x},${start.y}) 로 옮겼다.`);
      }
    }
    const data = {
      mapId, adapter: route.adapter, genre: route.genre, type: composed.type, ...(route.variant ? { variant: route.variant } : {}), tilesetId,
      liquid: composed.liquid, width: composed.width, height: composed.height,
      entrance: composed.entrance, stairsUp: composed.stairsUp, stairsDown: composed.stairsDown, anchors: composed.anchors,
      rooms: composed.rooms.map((room) => ({ id: room.id, kind: room.kind, x: room.x, y: room.y, w: room.w, h: room.h, from: room.from, spots: composed.spots[room.id] ?? [] })),
      corridors: composed.corridors.map((c) => ({ from: c.a, to: c.b, dir: c.dir, ...(c.loop ? { loop: true } : {}), ...c.rect })),
      population, counts: composed.counts, warnings: composed.warnings,
    };
    const dressed = Object.values(composed.counts).reduce((a, b) => a + b, 0);
    return {
      summary: `${notes.join(" ")} ${GRAMMAR[composed.type].label}(${route.adapter === "monster" ? "몬스터 키트" : "버들항"}·${GENRE_PRESETS[route.genre].label}) 던전 ${mapId} ${composed.width}×${composed.height}: 방 ${composed.rooms.length}개를 통로 ${composed.corridors.length}개로 이었다(장식 ${dressed}점, 받침 없는 물체 0${composed.liquid.kind ? `, ${composed.liquid.kind === "lava" ? "용암" : "물"} ${composed.liquid.cells}칸은 걸을 수 없고 다리 ${composed.liquid.bridges}칸` : ""}, 입구에서 모든 방 도달${composed.anchors.boss ? `, 보스방 ${composed.anchors.boss}` : ""}${composed.anchors.treasure ? `, 보물 방 ${composed.anchors.treasure}` : ""}${composed.anchors.gate ? `, 잠긴 문 자리 (${composed.anchors.gate.x},${composed.anchors.gate.y})` : ""}). 이벤트·적·상자는 data.rooms[].spots 좌표에만 두고, data.population 의 계획을 따른다.`.trim(),
      data,
      warnings: composed.warnings.length ? composed.warnings : undefined,
    };
  },
};

/** 옛 이름(2026-10-14 ~ 15): 버들항 전용으로 불리던 도구. 같은 시공기로 가되 어댑터를 버들항으로 고정한다. */
export const AUTHOR_BEODEUL_DUNGEON_ALIAS: ToolDefinition = {
  ...AUTHOR_DUNGEON_TOOL,
  name: "author_beodeul_dungeon",
  description: "author_dungeon 의 옛 이름 — 버들항 어댑터로 고정된 던전 시공(몬스터 키트·장르 프리셋 없이 rpg 장르). 새 요청은 author_dungeon 을 쓴다. 인자·결과는 같다.",
  run(draft, args) { return AUTHOR_DUNGEON_TOOL.run(draft, { ...args, adapter: "beodeul", genre: "rpg" }); },
};
