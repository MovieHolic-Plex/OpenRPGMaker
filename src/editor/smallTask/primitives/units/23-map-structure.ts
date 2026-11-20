import { listAudioResources } from "@/assets/audioResourceCatalog";
import { AUTHORING_MISC_TOOLS } from "@/editor/tools/authoringMiscTools";
import { inMapBounds } from "@/editor/tools/mapHelpers";
import { ToolError, type JsonSchema } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { countLocationReferences } from "@/project/mapLocationReferences";
import { DOOR_KINDS, inferMapDoor, removeMapDoorsOver, upsertMapDoor, type DoorKind, type InferDoorOptions } from "@/project/mapDoorKinds";
import { MAP_LOOP_VALUES } from "@/project/mapLoop";
import { addMapLocation, deleteMapLocation, findLocationById, findLocationsByName, renameMapLocation, resizeMapLocation } from "@/project/mapNamedLocations";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import type { GameMap, MapNamedLocation, Project, Rect } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  assertReferencesPreserved, duplicateMap, freeId, label, mapDraft, mapLabel, nextMapId, removeMap,
  requiredName, resizeMap, runMapTool, selectedMap,
} from "./23-map-structure/maps";

export const UNIT = "23-map-structure";

type Args = Record<string, unknown>;
type MapOperation = (project: Project, map: GameMap, args: Args, ctx: PrimitiveContext) => Project;

const text = (description: string, maxLength = 128): JsonSchema => ({ type: "string", description, minLength: 1, maxLength });
const bool = (description: string): JsonSchema => ({ type: "boolean", description });
const integer = (description: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): JsonSchema =>
  ({ type: "integer", description, minimum, maximum });
const number = (description: string, minimum: number, maximum: number): JsonSchema =>
  ({ type: "number", description, minimum, maximum });
const choice = (description: string, values: readonly string[]): JsonSchema => ({ type: "string", description, enum: values });
const arr = (description: string, items: JsonSchema, maxItems: number): JsonSchema => ({ type: "array", description, items, maxItems });
const obj = (properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema =>
  ({ type: "object", properties, required, additionalProperties: false });

const xy = { x: integer("왼쪽에서 센 칸 위치"), y: integer("위쪽에서 센 칸 위치") };
const rect = { ...xy, w: integer("가로 칸 수", 1, MAX_TOOL_MAP_DIMENSION), h: integer("세로 칸 수", 1, MAX_TOOL_MAP_DIMENSION) };
const name = text("화면에 보일 이름", 64);
const size = {
  width: integer("맵 가로 칸 수", 3, MAX_TOOL_MAP_DIMENSION),
  height: integer("맵 세로 칸 수", 3, MAX_TOOL_MAP_DIMENSION),
};
const positionFields = ["x", "y"] as const;
const rectFields = ["x", "y", "w", "h"] as const;
const locationId = text("선택한 맵에서 바꿀 장소의 이름 또는 식별자");
const directions = ["up", "down", "left", "right"] as const;

function mapMeta(ctx: PrimitiveContext) {
  return { kind: "mapMeta", mapId: selectedMap(ctx).id } as const;
}

function newMap(ctx: PrimitiveContext) {
  return { kind: "newMap", max: 1, sourceMapId: selectedMap(ctx).id } as const;
}

function primitive(
  id: string, tool: string, title: string, args: JsonSchema,
  describe: (map: GameMap, args: Args, ctx: PrimitiveContext) => string,
  apply: MapOperation,
  scope: SmallTaskPrimitive["scope"] = mapMeta,
): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [tool] }, targets: ["map"], args, scope,
    describe(ctx, args) { return describe(selectedMap(ctx), args, ctx); },
    apply(ctx, args) { return apply(ctx.project, selectedMap(ctx), args, ctx); },
  };
}

function pointInMap(map: GameMap, x: number, y: number): void {
  if (!inMapBounds(map, x, y)) throw new PrimitiveError("범위 밖이에요. 맵 안의 칸을 골라 주세요.");
}

function rectInMap(map: GameMap, value: Rect): void {
  pointInMap(map, value.x, value.y);
  pointInMap(map, value.x + value.w - 1, value.y + value.h - 1);
}

function locationInMap(map: GameMap, query: unknown): MapNamedLocation {
  const key = String(query);
  const byId = findLocationById(map, key);
  if (byId) return byId;
  const matches = findLocationsByName(map, key);
  if (!matches.length) throw new PrimitiveError("이 맵에서 장소를 찾을 수 없어요.");
  if (matches.length > 1) throw new PrimitiveError("이름이 비슷한 장소가 여럿 있어요. 장소 하나를 골라 주세요.");
  return matches[0]!;
}

function validateTileset(project: Project, tilesetId: unknown): void {
  if (tilesetId !== undefined && !Object.hasOwn(project.tilesets, String(tilesetId))) {
    throw new PrimitiveError("프로젝트에서 지정한 타일셋을 찾을 수 없어요.");
  }
}

const propertyArgs = {
  name,
  tilesetId: text("프로젝트에 있는 타일셋의 식별자"),
  bgmMode: choice("배경 음악을 상위 맵에서 따를지, 끌지, 직접 고를지", ["parent", "none", "custom"]),
  bgmResourceId: text("설치된 배경 음악의 식별자"),
  backgroundImageId: text("등록된 맵 배경 그림의 식별자"),
  clearBackground: bool("맵 배경을 기본 그림으로 돌릴지"),
  battleBackground: text("등록된 전투 배경 그림의 식별자"),
  clearBattleBackground: bool("전투 배경을 기본 그림으로 돌릴지"),
  disableSave: bool("이 맵에서 저장을 금지할지"),
  disableTeleport: bool("이 맵에서 순간이동을 금지할지"),
  disableEscape: bool("이 맵의 전투에서 도주를 금지할지"),
  encounterRate: integer("무작위 조우 발생률. 0이면 꺼요"),
  loop: choice("맵 가장자리 반복 방향. 없음, 좌우, 상하, 사방 중 선택", ["none", ...MAP_LOOP_VALUES]),
  zoom: number("기본 카메라 배율", 0.25, 6),
  characterScale: number("걷는 캐릭터의 크기 배율", 0.25, 1),
  mapRole: choice("맵의 용도. 마을, 던전, 들판, 실내, 자동 중 선택", ["town", "dungeon", "field", "interior", "auto"]),
};

function setProperties(project: Project, map: GameMap, args: Args): Project {
  const { name, bgmMode, bgmResourceId, backgroundImageId, ...properties } = args;
  const nextName = name === undefined ? undefined : requiredName(name);
  if (nextName !== undefined && Object.values(project.maps).some(other =>
    other.id !== map.id && other.name.trim() === nextName)) {
    throw new PrimitiveError("그 이름을 쓰는 다른 맵이 있어요.");
  }
  validateTileset(project, properties.tilesetId);
  const mode = bgmMode ?? (bgmResourceId !== undefined ? "custom" : undefined);
  if ((mode === "custom" && !bgmResourceId) || (mode !== "custom" && bgmResourceId !== undefined)) {
    throw new PrimitiveError("배경 음악 설정과 곡을 함께 확인해 주세요.");
  }
  if (bgmResourceId !== undefined && !listAudioResources("music", project).some(resource => resource.id === bgmResourceId)) {
    throw new PrimitiveError("지정한 배경 음악을 찾을 수 없어요.");
  }
  if ((backgroundImageId && properties.clearBackground) || (properties.battleBackground && properties.clearBattleBackground)) {
    throw new PrimitiveError("그림을 지정할지 기본 그림으로 돌릴지 하나를 골라 주세요.");
  }
  const toolArgs = {
    ...properties,
    ...(mode === undefined ? {} : { bgm: { mode, ...(bgmResourceId === undefined ? {} : { resourceId: bgmResourceId }) } }),
    ...(backgroundImageId === undefined ? {} : { background: { imageId: backgroundImageId } }),
  };
  if (nextName === undefined && !Object.keys(toolArgs).length) throw new PrimitiveError("바꿀 맵 속성을 골라 주세요.");

  // 이름은 맵의 표시 속성만 바꾼다. 넓은 조수 툴의 지형 자동 보정은 여기서 부르지 않는다.
  const after = mapDraft(project, map, { ...map, ...(nextName === undefined ? {} : { name: nextName }) });
  if (Object.keys(toolArgs).length) {
    runMapTool(after, "set_map_properties", { ...toolArgs, mapId: map.id }, "맵 속성에 지정한 그림, 음악 또는 타일셋을 확인해 주세요.");
  }
  if (backgroundImageId !== undefined || properties.battleBackground !== undefined || properties.tilesetId !== undefined) {
    assertReferencesPreserved(project, after, "맵 속성에 연결할 그림이나 타일셋을 찾을 수 없어요.");
  }
  return after;
}

const encounterConditions = obj({
  switchId: text("켜져 있어야 하는 스위치의 식별자"),
  variableId: text("값을 비교할 변수의 식별자"),
  atLeast: integer("변수가 넘어야 할 기준값", -Number.MAX_SAFE_INTEGER),
  minPartyLevel: integer("등장할 최소 파티 레벨", 1),
  maxPartyLevel: integer("등장할 최대 파티 레벨", 1),
  locationId: text("이 맵에서 조우할 장소 이름 또는 식별자"),
  terrainId: text("조우할 지형의 식별자"),
  region: obj(rect, rectFields),
  timePhase: choice("하루 중 조우할 시간대", TIME_PHASES),
  season: choice("조우할 계절", SEASONS),
});
const encounterEntry = obj({
  troopId: text("등장할 적 무리의 식별자"),
  weight: integer("다른 무리와 비교한 등장 비중. 기본은 1", 1),
  levelMin: integer("야생 몬스터의 최저 레벨", 1, 99),
  levelMax: integer("야생 몬스터의 최고 레벨", 1, 99),
  conditions: { ...encounterConditions, description: "이 무리가 등장할 조건" },
}, ["troopId"]);

function setEncounterTable(project: Project, map: GameMap, args: Args): Project {
  const entries = (args.entries as Args[]).map(entry => {
    const conditions = entry.conditions as Args | undefined;
    if (conditions?.terrainId && !project.database.terrains?.some(terrain => terrain.id === conditions.terrainId)) {
      throw new PrimitiveError("조우 조건에 지정한 지형을 찾을 수 없어요.");
    }
    if (conditions?.atLeast !== undefined && conditions.variableId === undefined) {
      throw new PrimitiveError("조우 기준값을 비교할 변수를 골라 주세요.");
    }
    return {
      weight: 1, ...entry,
      ...(conditions?.locationId === undefined ? {} : {
        conditions: { ...conditions, locationId: locationInMap(map, conditions.locationId).id },
      }),
    };
  });
  // 기존 검증기는 지형 자료가 없으면 표를 초기화한다. 그 사본은 결과에 포함하지 않는다.
  const after = mapDraft(project, map);
  const draft = { ...after, database: { ...project.database, terrains: project.database.terrains?.slice() } };
  runMapTool(draft, "set_encounter_table", { ...args, entries, mapId: map.id }, "조우표의 적 무리와 등장 조건을 확인해 주세요.");
  return after;
}

const doorTypes = ["detect", ...DOOR_KINDS.filter(kind => kind !== "kit")] as const;
const doorNames: Record<(typeof doorTypes)[number], string> = {
  detect: "그림에 맞게", auto: "자동문으로", swing: "여닫이로", double: "두 짝 여닫이로",
  slide: "미닫이로", shutter: "셔터로", none: "열림 연출 없이",
};

function setDoor(project: Project, map: GameMap, args: Args): Project {
  const at = { x: Number(args.x), y: Number(args.y) };
  pointInMap(map, at.x, at.y);
  const { kind, width, height, hinge, chime } = args;
  const options: InferDoorOptions = {
    kind: kind === "detect" ? undefined : kind as DoorKind | undefined,
    width: width as number | undefined, height: height as number | undefined,
    hinge: hinge as InferDoorOptions["hinge"], chime: chime as boolean | undefined,
  };
  const door = inferMapDoor(project, map, at, options);
  if (!door) throw new PrimitiveError("문 그림을 찾을 수 없어요. 문 칸이나 문 종류를 골라 주세요.");
  rectInMap(map, door.rect);
  const next = { ...map };
  if (door.def) upsertMapDoor(next, door.def);
  else removeMapDoorsOver(next, door.rect);
  return mapDraft(project, map, next);
}

function upsertConnection(project: Project, map: GameMap, args: Args): Project {
  const toMapId = String(args.toMapId);
  const toMap = Object.hasOwn(project.maps, toMapId) ? project.maps[toMapId] : undefined;
  if (!toMap) throw new PrimitiveError("도착 맵을 찾을 수 없어요.");
  const fromX = Number(args.x), fromY = Number(args.y), toX = Number(args.toX), toY = Number(args.toY);
  pointInMap(map, fromX, fromY);
  pointInMap(toMap, toX, toY);

  const connections = project.mapConnections ?? [];
  const prior = connections.find(connection => connection.id === args.connectionId);
  if (args.connectionId !== undefined && !prior) throw new PrimitiveError("고칠 맵 연결을 찾을 수 없어요.");
  if (prior && prior.from.mapId !== map.id) throw new PrimitiveError("범위 밖이에요. 출발 맵을 선택해 주세요.");
  const after = { ...project };
  try {
    AUTHORING_MISC_TOOLS.find(tool => tool.name === "upsert_map_connection")!.run(after, {
      connection: {
        id: prior?.id ?? freeId("connection_small_task_", id => connections.some(row => row.id === id)),
        name: args.name ?? prior?.name,
        from: { mapId: map.id, x: fromX, y: fromY, direction: args.fromDirection ?? prior?.from.direction },
        to: { mapId: toMapId, x: toX, y: toY, direction: args.toDirection ?? prior?.to.direction },
        playerEnabled: args.playerEnabled ?? prior?.playerEnabled ?? true,
        npcEnabled: args.npcEnabled ?? prior?.npcEnabled ?? false,
      },
    });
  } catch (error) {
    if (error instanceof ToolError) throw new PrimitiveError("맵 연결의 이름과 이동 위치를 확인해 주세요.");
    throw error;
  }
  return after;
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("map.structure.create", "create_map", "새 맵 만들기", obj({
    name, ...size, tilesetId: text("프로젝트에 있는 타일셋의 식별자. 생략하면 선택한 맵과 같아요"),
  }, ["name"]),
  (_map, args) => `『${label(String(args.name), "새 맵")}』 맵을 만들어요.`,
  (project, map, args) => {
    validateTileset(project, args.tilesetId);
    return runMapTool(
      { ...project, maps: { ...project.maps }, mapTree: structuredClone(project.mapTree) }, "create_map",
      { width: 20, height: 15, tilesetId: map.tilesetId, ...args, name: requiredName(args.name), id: nextMapId(project) },
      "새 맵에 사용할 타일셋과 크기를 확인해 주세요.",
    );
  }, newMap),

  primitive("map.structure.duplicate", "duplicate_map", "맵 복제", obj({ name }),
    (map, args) => args.name === undefined ? `『${mapLabel(map)}』 맵을 복제해요.`
      : `『${mapLabel(map)}』 맵을 『${label(String(args.name), "복사본")}』 이름으로 복제해요.`,
    (project, map, args) => duplicateMap(project, map, args.name === undefined ? `${map.name} 복사` : requiredName(args.name)), newMap),

  primitive("map.structure.remove", "remove_map", "맵 삭제", obj({}),
    map => `『${mapLabel(map)}』 맵을 삭제해요.`, removeMap),

  primitive("map.structure.resize", "resize_map", "맵 크기 변경", obj(size),
    (map, args) => `『${mapLabel(map)}』 맵을 가로 ${args.width ?? map.width}칸, 세로 ${args.height ?? map.height}칸으로 바꿔요.`,
    (project, map, args) => {
      if (args.width === undefined && args.height === undefined) throw new PrimitiveError("바꿀 가로 또는 세로 크기를 적어 주세요.");
      return resizeMap(project, map, Number(args.width ?? map.width), Number(args.height ?? map.height));
    }),

  primitive("map.properties.set", "set_map_properties", "맵 속성 변경", obj(propertyArgs),
    (map, args) => args.name !== undefined
      ? `『${mapLabel(map)}』 맵 이름을 『${label(String(args.name), "새 이름")}』${Object.keys(args).length > 1 ? "으로 바꾸고 속성도 고쳐요" : "으로 바꿔요"}.`
      : args.bgmMode === "none" ? `『${mapLabel(map)}』 맵의 배경 음악을 꺼요.`
        : args.bgmMode !== undefined || args.bgmResourceId !== undefined ? `『${mapLabel(map)}』 맵의 배경 음악 설정을 바꿔요.`
          : `『${mapLabel(map)}』 맵의 속성을 바꿔요.`,
    setProperties),

  primitive("map.encounterTable.set", "set_encounter_table", "조우표 설정",
    obj({ entries: arr("이 맵에서 등장할 적 무리 목록", encounterEntry, 64), encounterRate: propertyArgs.encounterRate }, ["entries"]),
    (map, args) => `『${mapLabel(map)}』 맵의 조우표를 ${(args.entries as unknown[]).length}개 항목으로 설정해요.`, setEncounterTable),

  primitive("map.startPosition.set", "set_start_position", "게임 시작 위치 변경", obj(xy, positionFields),
    (map, args) => `『${mapLabel(map)}』 맵의 (${args.x}, ${args.y}) 칸에서 게임을 시작해요.`,
    (project, map, args) => {
      const x = Number(args.x), y = Number(args.y);
      pointInMap(map, x, y);
      if (!isPassable(project, map, x, y)) throw new PrimitiveError("걸을 수 있는 시작 칸을 골라 주세요.");
      return { ...project, startMapId: map.id, startPos: { x, y } };
    }),

  primitive("map.door.set", "set_map_door", "문 열림 설정", obj({
    ...xy, kind: choice("문 종류. 자동문, 여닫이, 양짝 여닫이, 미닫이, 셔터, 출구 또는 그림으로 판단", doorTypes),
    width: integer("문 가로 칸 수. 생략하면 그림으로 판단해요", 1, 4),
    height: integer("문 세로 칸 수. 생략하면 그림으로 판단해요", 1, 4),
    hinge: choice("여닫이 경첩이 있는 쪽", ["left", "right"]),
    chime: bool("자동문을 열 때 입점 소리를 낼지"),
  }, positionFields), (map, args) => `『${mapLabel(map)}』 맵의 문을 ${doorNames[(args.kind ?? "detect") as keyof typeof doorNames]} 설정해요.`, setDoor),

  primitive("map.connection.upsert", "upsert_map_connection", "맵 연결 설정", obj({
    ...xy, toMapId: text("도착 맵의 식별자"),
    toX: integer("도착 맵 왼쪽에서 센 칸 위치"), toY: integer("도착 맵 위쪽에서 센 칸 위치"),
    connectionId: text("고칠 기존 연결의 식별자. 생략하면 새로 만들어요"),
    name, fromDirection: choice("출발할 때 이동하는 방향", directions),
    toDirection: choice("도착할 때 바라볼 방향", directions),
    playerEnabled: bool("주인공의 이동을 허용할지. 새 연결의 기본은 허용"),
    npcEnabled: bool("주민의 이동을 허용할지. 새 연결의 기본은 금지"),
  }, ["x", "y", "toMapId", "toX", "toY"]),
  (map, args, { project }) => {
    const id = String(args.toMapId);
    const toMap = Object.hasOwn(project.maps, id) ? project.maps[id] : undefined;
    return `『${mapLabel(map)}』 맵에서 『${toMap ? mapLabel(toMap) : "도착 맵"}』 맵으로 가는 연결을 설정해요.`;
  }, upsertConnection),

  primitive("map.location.create", "create_map_location", "새 장소 만들기", obj({
    ...rect, name, note: text("장소의 용도를 설명하는 메모", 240), tags: arr("장소를 찾을 낱말", text("검색 낱말", 32), 12),
  }, ["name", ...rectFields]),
  (_map, args) => `『${label(String(args.name), "새 장소")}』 장소를 만들어요.`,
  (project, map, args) => {
    const area = { x: Number(args.x), y: Number(args.y), w: Number(args.w), h: Number(args.h) };
    rectInMap(map, area);
    const next = { ...map };
    const result = addMapLocation(next, { ...area, name: requiredName(args.name),
      note: args.note as string | undefined, tags: args.tags as string[] | undefined });
    if (!result.ok) throw new PrimitiveError(result.error);
    return mapDraft(project, map, next);
  }),

  primitive("map.location.update", "update_map_location", "장소 수정", obj({ locationId, name, ...rect }, ["locationId"]),
    (map, args) => {
      const location = locationInMap(map, args.locationId);
      return args.name === undefined ? `『${label(location.name, "선택한 장소")}』 장소의 영역을 바꿔요.`
        : `『${label(location.name, "선택한 장소")}』 장소 이름을 『${label(String(args.name), "새 이름")}』으로 바꿔요.`;
    },
    (project, map, args) => {
      const location = locationInMap(map, args.locationId);
      const wantsRect = rectFields.some(key => args[key] !== undefined);
      if (args.name === undefined && !wantsRect) throw new PrimitiveError("바꿀 장소 이름이나 영역을 적어 주세요.");
      const next = { ...map, locations: map.locations?.map(row => row === location ? { ...row } : row) };
      if (args.name !== undefined) {
        const result = renameMapLocation(next, location.id, requiredName(args.name));
        if (!result.ok) throw new PrimitiveError("장소 이름을 확인해 주세요.");
      }
      if (wantsRect) {
        const area = { x: Number(args.x ?? location.x), y: Number(args.y ?? location.y),
          w: Number(args.w ?? location.w), h: Number(args.h ?? location.h) };
        rectInMap(map, area);
        const result = resizeMapLocation(next, location.id, area);
        if (!result.ok) throw new PrimitiveError("장소 영역을 확인해 주세요.");
      }
      return mapDraft(project, map, next);
    }),

  primitive("map.location.delete", "delete_map_location", "장소 삭제", obj({ locationId }, ["locationId"]),
    (map, args) => `『${label(locationInMap(map, args.locationId).name, "선택한 장소")}』 장소를 삭제해요.`,
    (project, map, args) => {
      const location = locationInMap(map, args.locationId);
      if (countLocationReferences(project, location.id, map.id) > 0) {
        throw new PrimitiveError("이 장소를 가리키는 조건이 남아 있어 삭제할 수 없어요.");
      }
      const next = { ...map };
      deleteMapLocation(next, location.id);
      return mapDraft(project, map, next);
    }),
];
