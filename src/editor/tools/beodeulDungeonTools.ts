// author_beodeul_dungeon — 버들항 던전 한 층을 「방 목록」 하나로 시공한다(2026-10-14, 계산은 src/editor/beodeulDungeon/compose.ts).
// 사용자 스크린샷(field-enemy fe1): 조수가 던전 층을 stamp_object 112번 + paint_tiles 67번(절대 좌표)으로 깔다 25분 시간 초과,
// 횃불·화로·통·상자·기둥이 허공에 뜨고 벽 조각이 바닥에 서고 이벤트가 천장 칸에 놓였다. 좌표를 모델이 고르지 않게 한다.
import { isPassable } from "@/project/collision";
import { groundSupportIssues } from "@/project/groundSupport";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { GameMap, Project } from "@/project/types";
import { composeDungeon, DUNGEON_DIRS, DUNGEON_ROOM_KINDS, DUNGEON_SIZES, DUNGEON_STYLES, DUNGEON_TYPES, DungeonComposeError, type DungeonRoomInput, type DungeonSpec } from "../beodeulDungeon/compose";
import { PROFILES } from "../beodeulDungeon/profiles";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition } from "./types";

const BEODEUL_TILESET_ID = "beodeul_city";
const createMapTool = MAP_TOOLS.find((tool) => tool.name === "create_map")!;
const resizeMapTool = MAP_TOOLS.find((tool) => tool.name === "resize_map")!;

const ROOM_LABEL: Record<string, string> = {
  entrance: "입구 홀", hall: "큰 홀", crypt: "묘실", cell: "감방", shrine: "제단 방", boss: "보스방", storage: "창고", vault: "보물 방",
  channel: "수로 방", cistern: "저수조", pump: "펌프실", cavern: "동굴 방", lake: "호수 동굴", grotto: "이끼 동굴", forge: "옛 대장간", nave: "신랑", junction: "갈림 갱도", stope: "채굴장", depot: "광산 창고",
};
const TYPE_LIST = DUNGEON_TYPES.map((t) => `${t} ${PROFILES[t].label}`).join(" · ");

function isBlankMap(map: GameMap): boolean {
  if (map.events.length > 0 || (map.structurePlacements?.length ?? 0) > 0) return false;
  const first = map.lowerTiles[0];
  if (!map.lowerTiles.every((tile) => tile === first)) return false;
  return [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles].every((layer) => !layer || layer.every((tile) => tile < 0));
}

export const AUTHOR_BEODEUL_DUNGEON_TOOL: ToolDefinition = {
  name: "author_beodeul_dungeon",
  description:
    "버들항(beodeul_city) 던전 한 층을 한 번에 시공한다 — 종류(type)마다 배치 문법·벽·바닥·장식이 다르다: " + TYPE_LIST + ". " +
    "사용자 말 → type: 지하묘지·카타콤·감옥·던전=catacomb · 성 지하·성채·마왕성=castle · 미궁·미로=labyrinth · 하수도·수로=sewer(물 막힘, 보행로·다리) · 동굴·지하 호수=cave(불규칙 동굴 방+호수) · 신전·사원·유적=temple(대칭 열주 홀) · 광산·갱도=mine(긴 갱도+채굴장) · 화산·용암=volcano(용암 못, 안전한 길). " +
    "얼음 동굴은 이 타일셋에 그림이 없어 지원하지 않는다(cave 로 대체하고 사용자에게 알린다). 좌표를 계산하지 않는다 — 방 목록(종류·크기·어느 방에서 이어지는지)만 주거나, rooms 를 생략하고 size 만 줘도 된다. " +
    "코드가 방 배치(동서남북으로 퍼지는 나무 모양 + 고리 통로)·통로·천장(검은 허공과 벽 두께 띠)·벽 앞면·바닥을 깔고, 횃불·깃발·벽감·쇠사슬은 벽 칸에만, 기둥·화로·상자·통·관·제단은 방 안 바닥에만 놓되 문과 문 사이 길은 막지 않는다. " +
    "모든 방이 입구에서 걸어 닿고 허공에 뜬 물체가 0 인지 스스로 검사한 뒤에만 맵을 만든다(어기면 맵을 만들지 않고 거부). " +
    "rooms 는 순서대로 이어진다(첫 방 = 입구, from 생략 = 바로 앞 방 근처, dir 은 문 방향 N·S·W·E, 생략하면 층 모양에 맞게 자동). kind: entrance 입구 홀(올라가는 계단) · hall 기둥 늘어선 큰 홀 · crypt 관·벽감 묘실 · cell 칸막이 감방 · shrine 제단 방 · boss 제단+기둥 보스방 · storage 창고 · vault 보물 방. " +
    "맵 크기는 방 배치로 정해진다(결과 data.width/height). 원하는 맵 크기가 있으면 width·height 를 주면 그 넓이·비율에 맞춰 방 수와 배치를 고른다(rooms 생략 시). 던전 층은 이 도구 한 번이면 된다 — stamp_object·paint_tiles 로 벽·천장·소품을 따로 깔지 말 것(받침 규칙이 거절한다). " +
    "결과 data.rooms[].spots 는 적·상자·NPC 이벤트를 둘 수 있는 빈 바닥 칸(사방이 걸을 수 있는 칸)이다 — 이벤트는 그 좌표에만 둔다. data.stairsUp.front 는 올라가는 계단 앞 칸(위층으로 가는 이동 지점), data.stairsDown 은 내려가는 계단 칸. " +
    "data.anchors: boss(보스방 id — 보스 이벤트 자리), treasure(보물 방 id — 보물 상자), gate(그 방으로 들어가는 통로 칸 — 잠긴 문·열쇠 이벤트 자리). " +
    "mapId 없으면 새 맵을 만든다. mapId 가 있으면 비어 있는 버들항 맵을 방 배치 크기로 넓혀 그 자리에 짓는다(내용이 있는 맵이면 거부 — 새 맵으로). 시작 맵이면 시작 위치를 입구로 옮긴다.",
  mode: "write",
  domains: ["map", "tile"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "비어 있는 기존 버들항 맵 id(시작 빈 맵 등). 생략하면 새 맵." },
      id: { type: "string", description: "새 맵 id(생략 시 자동)" },
      name: { type: "string", description: "새 맵 이름(기본: 지하 던전)" },
      type: { type: "string", enum: [...DUNGEON_TYPES], description: "던전 종류(기본 catacomb): " + TYPE_LIST + ". 종류마다 방 종류(kind)가 다르다 — sewer: channel 수로 방·cistern 저수조·pump 펌프실 / temple: nave 신랑 / mine: junction·stope·depot / cave·volcano: rooms 를 주지 않고 size 만(방은 자동, 호수·용암 못 포함) / labyrinth: size 만." },
      style: { type: "string", enum: [...DUNGEON_STYLES], description: "(옛 인자, type 대신) catacomb 이끼 낀 지하 석벽(기본) · castle 다듬은 성 지하 석벽" },
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
    const iceNote = typeof args.type === "string" && /ice|얼음|빙/i.test(args.type) ? "얼음 동굴은 이 타일셋에 그림이 없어 자연 동굴(cave)로 지었다 — 사용자에게 알린다." : "";
        const spec: DungeonSpec = {
      ...(rooms.length ? { rooms } : {}),
      ...(typeArg ? { type: typeArg } : iceNote ? { type: "cave" as const } : {}),
      style: (DUNGEON_STYLES as readonly string[]).includes(String(args.style)) ? (args.style as DungeonSpec["style"]) : undefined,
      seed: Number.isInteger(args.seed) ? (args.seed as number) : 7,
      size: (DUNGEON_SIZES as readonly string[]).includes(String(args.size)) ? (args.size as DungeonSpec["size"]) : undefined,
      width: int(args.width), height: int(args.height),
    };
    const tileset = draft.tilesets[BEODEUL_TILESET_ID];
    if (!tileset) throw new ToolError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다 — 던전 시공은 버들항 타일셋 전용이다.", { code: "beodeul-tileset-missing" });
    let composed;
    try {
      composed = composeDungeon(tileset, spec);
    } catch (error) {
      if (error instanceof DungeonComposeError) throw new ToolError(error.message, { code: error.code });
      throw error;
    }
    if (composed.width > MAX_TOOL_MAP_DIMENSION || composed.height > MAX_TOOL_MAP_DIMENSION) {
      throw new ToolError(`방 배치가 ${composed.width}×${composed.height} 라 한 맵 한도(${MAX_TOOL_MAP_DIMENSION})를 넘는다 — 방 수나 크기를 줄여라.`, { code: "invalid-args" });
    }
    const notes: string[] = iceNote ? [iceNote] : [];
    let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (mapId) {
      const existing = draft.maps[mapId];
      if (!existing) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
      if (existing.tilesetId !== BEODEUL_TILESET_ID) throw new ToolError(`맵 ${mapId} 은 버들항 맵이 아니다 — mapId 를 빼고 새 맵으로 짓는다.`, { code: "tileset-family-mismatch", mapId });
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
        width: composed.width, height: composed.height, tilesetId: BEODEUL_TILESET_ID, border: "none",
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
    for (const room of composed.rooms) {
      addMapLocation(map, { name: `${ROOM_LABEL[room.kind]} ${room.id}`, x: room.x, y: room.y, w: room.w, h: room.h,
        note: `바닥 ${room.w}×${room.h} · 이벤트 자리 ${(composed.spots[room.id] ?? []).map((p) => `(${p.x},${p.y})`).join(" ")}`,
        tags: ["dungeon-room", COMPOSED_LAYOUT_TAG, room.kind] });
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
      mapId, type: composed.type, liquid: composed.liquid, width: composed.width, height: composed.height,
      entrance: composed.entrance, stairsUp: composed.stairsUp, stairsDown: composed.stairsDown, anchors: composed.anchors,
      rooms: composed.rooms.map((room) => ({ id: room.id, kind: room.kind, x: room.x, y: room.y, w: room.w, h: room.h, from: room.from, spots: composed.spots[room.id] ?? [] })),
      corridors: composed.corridors.map((c) => ({ from: c.a, to: c.b, dir: c.dir, ...(c.loop ? { loop: true } : {}), ...c.rect })),
      counts: composed.counts, warnings: composed.warnings,
    };
    const dressed = Object.values(composed.counts).reduce((a, b) => a + b, 0);
    return {
      summary: `${notes.join(" ")} ${PROFILES[composed.type].label} 던전 ${mapId} ${composed.width}×${composed.height}: 방 ${composed.rooms.length}개를 통로 ${composed.corridors.length}개로 이었다(장식 ${dressed}점, 받침 없는 물체 0${composed.liquid.kind ? `, ${composed.liquid.kind === "lava" ? "용암" : "물"} ${composed.liquid.cells}칸은 걸을 수 없고 다리 ${composed.liquid.bridges}칸` : ""}, 입구에서 모든 방 도달${composed.anchors.boss ? `, 보스방 ${composed.anchors.boss}` : ""}${composed.anchors.treasure ? `, 보물 방 ${composed.anchors.treasure}` : ""}${composed.anchors.gate ? `, 잠긴 문 자리 (${composed.anchors.gate.x},${composed.anchors.gate.y})` : ""}). 이벤트·적·상자는 data.rooms[].spots 좌표에만 둔다.`.trim(),
      data,
      warnings: composed.warnings.length ? composed.warnings : undefined,
    };
  },
};
