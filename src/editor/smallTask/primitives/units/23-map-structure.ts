import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { towardJosa } from "@/ai/v2/story/blueprintPathNames";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { inMapBounds } from "@/editor/tools/mapHelpers";
import type { JsonSchema } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { GRASS_TERRAIN_ID } from "@/project/defaults/defaultDatabaseUtilityRecords";
import { doorKindName } from "@/project/eventCommands/doorAnimation";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { locationRoleTag } from "@/project/locationRoles";
import { DOOR_KINDS, inferMapDoor, type DoorKind, type InferDoorOptions } from "@/project/mapDoorKinds";
import { MAP_LOOP_VALUES } from "@/project/mapLoop";
import { addMapLocation, deleteMapLocation, findLocationsByName, locationsOverlap, renameMapLocation, resizeMapLocation, sanitizeName } from "@/project/mapNamedLocations";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { spatialPortLanding } from "@/project/spatial/overview";
import type { Dir, GameMap, MapConnection, MapNamedLocation, Project, Rect } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import {
  LOCATION_DELETION_DRAFT_REFUSAL, MAP_REMOVAL_DRAFT_REFUSAL, MAP_REMOVAL_REFERENCE_REFUSAL, PrimitiveError,
} from "../errors";
import type { SmallTaskUnitHost } from "../host";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  assertReferencesPreserved, changesBlueprintPlaces, duplicateMap, freeId, label, locationDeletionDraftError,
  mapDraft, mapLabel, mapRemovalDraftError, mapRemovalReferenceError, nextMapId, removeMap, requiredName, resizeMap,
  runMapTool, selectedMap, usesLocation,
} from "./23-map-structure/maps";

export const UNIT = "23-map-structure";

export const host: SmallTaskUnitHost = {
  commit: { onRemovedMap: mapRemovalDraftError },
  explainRefusal({ stoppedEarly, before, target, live }) {
    if (target.kind !== "map") return undefined;
    if (stoppedEarly.startsWith(MAP_REMOVAL_REFERENCE_REFUSAL)) return mapRemovalReferenceError(before, target.mapId);
    if (live && stoppedEarly.startsWith(MAP_REMOVAL_DRAFT_REFUSAL)) return mapRemovalDraftError(before, target.mapId, live);
    const locationId = live && stoppedEarly.startsWith(LOCATION_DELETION_DRAFT_REFUSAL)
      ? stoppedEarly.match(/\n([\s\S]+)$/u)?.[1]
      : undefined;
    return locationId ? locationDeletionDraftError(before, target.mapId, locationId, live) : undefined;
  },
};

type Args = Record<string, unknown>;
type MapOperation = (project: Project, map: GameMap, args: Args, ctx: PrimitiveContext) => Project;

const text = (description: string, maxLength = 128): JsonSchema => ({ type: "string", description, minLength: 1, maxLength, pattern: "\\S" });
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

function mapMeta(
  fields: readonly (keyof GameMap)[],
  options: Pick<Extract<SmallTaskScope, { kind: "mapMeta" }>, "connections" | "startPosition"> = {},
): SmallTaskPrimitive["scope"] {
  return ctx => ({ kind: "mapMeta", mapId: selectedMap(ctx).id, fields, connections: "none", ...options });
}

const locationScope = mapMeta(["locations"]);

function newMap(ctx: PrimitiveContext) {
  selectedMap(ctx);
  return { kind: "newMap", max: 1 } as const;
}

function primitive(
  id: string, tool: string, title: string, args: JsonSchema,
  describe: (map: GameMap, args: Args, ctx: PrimitiveContext) => string,
  apply: MapOperation,
  scope: SmallTaskPrimitive["scope"],
): SmallTaskPrimitive {
  return {
    id, unit: UNIT, title, covers: { tools: [tool] }, targets: ["map"], args, scope,
    describe(ctx, args) { return describe(selectedMap(ctx), args, ctx); },
    apply(ctx, args) { return apply(ctx.project, selectedMap(ctx), args, ctx); },
  };
}

function pointInMap(map: GameMap, x: number, y: number): void {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !inMapBounds(map, x, y)) {
    throw new PrimitiveError("범위 밖이에요. 맵 안의 칸을 골라 주세요.");
  }
}

function rectInMap(map: GameMap, value: Rect): void {
  if (value.w < 1 || value.h < 1) throw new PrimitiveError("가로와 세로는 각각 한 칸 이상이어야 해요.");
  pointInMap(map, value.x, value.y);
  pointInMap(map, value.x + value.w - 1, value.y + value.h - 1);
}

function locationInMap(map: GameMap, query: unknown): MapNamedLocation {
  const key = String(query);
  const byId = map.locations?.filter(location => location.id === key) ?? [];
  const matches = byId.length ? byId : findLocationsByName(map, key);
  if (!matches.length) throw new PrimitiveError("이 맵에서 장소를 찾을 수 없어요.");
  if (matches.length > 1) throw new PrimitiveError("이름이 비슷한 장소가 여럿 있어요. 장소 하나를 골라 주세요.");
  const match = matches[0]!;
  if (map.locations?.some(location => location !== match && location.id === match.id)) {
    throw new PrimitiveError("같은 식별자를 쓰는 장소가 여럿 있어요. 장소 목록을 먼저 확인해 주세요.");
  }
  return match;
}

function newLocationName(map: GameMap, value: unknown, current?: MapNamedLocation): string {
  const name = sanitizeName(requiredName(value));
  if (name === current?.name) return name;
  const nameKey = (value: string) => value.replace(/\s+/gu, "").toLowerCase();
  const key = nameKey(name);
  if (map.locations?.some(location => location !== current &&
    (nameKey(location.id) === key || nameKey(location.name) === key))) {
    throw new PrimitiveError("다른 장소와 구분할 수 있는 이름을 적어 주세요.");
  }
  return name;
}

function validateTileset(project: Project, tilesetId: unknown): void {
  const id = String(tilesetId);
  if (tilesetId !== undefined && (!Object.hasOwn(project.tilesets, id) || project.tilesets[id]?.id !== id)) {
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

const propertyFields = {
  name: ["name"], tilesetId: ["tilesetId", "tileSize"], bgmMode: ["bgm"], bgmResourceId: ["bgm"],
  backgroundImageId: ["background"], clearBackground: ["background"],
  battleBackground: ["battleBackground"], clearBattleBackground: ["battleBackground"],
  disableSave: ["disableSave"], disableTeleport: ["disableTeleport"], disableEscape: ["disableEscape"],
  encounterRate: ["encounterRate"], loop: ["loop"], zoom: ["cameraZoom"],
  characterScale: ["characterScale"], mapRole: ["mapRole"],
} satisfies Record<keyof typeof propertyArgs, readonly (keyof GameMap)[]>;

function propertyScope(ctx: PrimitiveContext, args: Args): SmallTaskScope {
  const fields = (Object.keys(propertyFields) as (keyof typeof propertyFields)[]).flatMap<keyof GameMap>(key => {
    if (key === "clearBackground" || key === "clearBattleBackground") return args[key] === true ? propertyFields[key] : [];
    return args[key] === undefined ? [] : propertyFields[key];
  });
  return mapMeta(fields)(ctx, args);
}

function setProperties(project: Project, map: GameMap, args: Args): Project {
  const { name, bgmMode, bgmResourceId, backgroundImageId, battleBackground, clearBackground, clearBattleBackground, ...properties } = args;
  const nextName = name === undefined ? undefined : requiredName(name);
  if (nextName !== undefined && nextName !== map.name.trim() && Object.values(project.maps).some(other =>
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
  if ((backgroundImageId && clearBackground) || (battleBackground && clearBattleBackground)) {
    throw new PrimitiveError("그림을 지정할지 기본 그림으로 돌릴지 하나를 골라 주세요.");
  }
  const backgroundId = typeof backgroundImageId === "string" ? backgroundImageId.trim().replace(/^backdrop:/u, "").trim() : undefined;
  const battleId = typeof battleBackground === "string" ? battleBackground.trim().replace(/^backdrop:/u, "").trim() : undefined;
  if (backgroundId !== undefined || battleId !== undefined) {
    const backdrops = listDatabaseResourceOptions("backdrop", project);
    if (backgroundId !== undefined && !backdrops.some(resource => resource.id === backgroundId)) {
      throw new PrimitiveError("지정한 맵 배경 그림을 찾을 수 없어요.");
    }
    if (battleId !== undefined && battleId !== FIELD_BATTLE_BACKGROUND_ID && !backdrops.some(resource => resource.id === battleId)) {
      throw new PrimitiveError("지정한 전투 배경 그림을 찾을 수 없어요.");
    }
  }
  const toolArgs = {
    ...properties,
    ...(clearBackground === true ? { clearBackground } : {}),
    ...(clearBattleBackground === true ? { clearBattleBackground } : {}),
    ...(mode === undefined ? {} : { bgm: {
      mode,
      ...(bgmResourceId === undefined ? {} : { resourceId: bgmResourceId }),
      ...(map.bgm?.fadeInMs === undefined ? {} : { fadeInMs: map.bgm.fadeInMs }),
    } }),
    ...(battleId === undefined ? {} : { battleBackground: battleId }),
  };
  const hasToolArgs = Object.keys(toolArgs).length > 0;
  if (nextName === undefined && backgroundId === undefined && !hasToolArgs) {
    throw new PrimitiveError("바꿀 맵 속성을 골라 주세요.");
  }

  // 이름은 맵의 표시 속성만 바꾼다. 넓은 조수 툴의 지형 자동 보정은 여기서 부르지 않는다.
  const draft = { ...map, ...(nextName === undefined ? {} : { name: nextName }) };
  const after = mapDraft(project, map, draft);
  if (nextName !== undefined && nextName !== map.name && changesBlueprintPlaces(project, after)) {
    throw new PrimitiveError("이 이름으로 바꾸면 게임 청사진이 가리키는 맵이 달라져요. 맵과 청사진의 장소 이름을 함께 확인해 주세요.");
  }
  if (backgroundId !== undefined) {
    const { fromMap: _previousSource, ...background } = map.background ?? { showInEmptyCells: true };
    draft.background = { ...background, imageId: backgroundId };
  }
  if (hasToolArgs) {
    runMapTool(after, "set_map_properties", { ...toolArgs, mapId: map.id }, "맵 속성에 지정한 그림, 음악 또는 타일셋을 확인해 주세요.");
  }
  if (project.startMapId === map.id && draft.tilesetId !== map.tilesetId) {
    const { x, y } = project.startPos;
    if (isPassable(project, map, x, y) && !isPassable(after, draft, x, y)) {
      throw new PrimitiveError("타일셋을 바꾸면 게임 시작 칸을 걸을 수 없어요. 시작 위치를 먼저 옮겨 주세요.");
    }
  }
  if (backgroundId !== undefined || properties.tilesetId !== undefined) {
    assertReferencesPreserved(project, after, "맵 속성에 연결할 그림이나 타일셋을 찾을 수 없어요.");
  }
  return after;
}

const encounterConditions = obj({
  switchId: text("켜져 있어야 하는 스위치의 식별자"),
  variableId: text("값을 비교할 변수의 식별자"),
  atLeast: integer("변수가 이 값 이상일 때 등장", -Number.MAX_SAFE_INTEGER),
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
  const locationIds: (string | undefined)[] = [];
  const entries = (args.entries as Args[]).map(entry => {
    const { conditions: input, ...fields } = entry;
    const { locationId, ...conditions } = (input ?? {}) as Args;
    const terrainId = typeof conditions.terrainId === "string" ? conditions.terrainId.trim() : undefined;
    const canonicalTerrainId = terrainId === "grass" || terrainId === "tall_grass" ? GRASS_TERRAIN_ID : terrainId;
    if (canonicalTerrainId !== undefined && !project.database.terrains?.some(terrain => terrain.id === canonicalTerrainId)) {
      throw new PrimitiveError("조우 조건에 지정한 지형을 찾을 수 없어요.");
    }
    if (canonicalTerrainId !== undefined) conditions.terrainId = canonicalTerrainId;
    if (conditions.atLeast !== undefined && conditions.variableId === undefined) {
      throw new PrimitiveError("조우 기준값을 비교할 변수를 골라 주세요.");
    }
    if (conditions.variableId !== undefined && conditions.atLeast === undefined) {
      throw new PrimitiveError("변수가 얼마 이상일 때 적이 등장할지 적어 주세요.");
    }
    if (locationId !== undefined && conditions.region !== undefined) {
      throw new PrimitiveError("조우할 장소 이름이나 칸 범위 중 하나를 골라 주세요.");
    }
    locationIds.push(locationId === undefined ? undefined : locationInMap(map, locationId).id);
    return { weight: 1, ...fields, ...(input === undefined ? {} : { conditions }) };
  });
  // 기존 검증기는 지형 자료가 없으면 표를 초기화한다. 그 사본은 결과에 포함하지 않는다.
  const next = { ...map };
  const after = mapDraft(project, map, next);
  const draft = { ...after, database: { ...project.database, terrains: project.database.terrains?.slice() } };
  runMapTool(draft, "set_encounter_table", { ...args, entries, mapId: map.id }, "조우표의 적 무리와 등장 조건을 확인해 주세요.");
  // 도구가 이름을 다시 찾는 과정에서 공백이 있는 기존 ID를 다른 장소로 해석할 수 있다.
  next.encounterTable = next.encounterTable?.map((entry, index) => {
    const locationId = locationIds[index];
    return locationId === undefined ? entry : { ...entry, conditions: { ...entry.conditions, locationId } };
  });
  if (!next.encounterTable) delete next.encounterTable;
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
  const existing = map.doors ?? [];
  const inside = existing.filter(row => locationsOverlap(row, { ...at, w: 1, h: 1 }));
  const candidates = inside.length ? inside : existing.filter(row =>
    at.y === row.y + row.h && at.x >= row.x && at.x < row.x + row.w);
  if (candidates.length > 1) throw new PrimitiveError("이 칸에 문이 여럿 걸쳐 있어요. 문 한 곳의 칸을 골라 주세요.");
  const selected = candidates[0];
  const options: InferDoorOptions = {
    kind: kind === "detect" ? undefined : (kind as DoorKind | undefined) ?? (selected && doorKindName(selected)),
    width: (width as number | undefined) ?? selected?.w,
    height: (height as number | undefined) ?? selected?.h,
    hinge: hinge as InferDoorOptions["hinge"], chime: chime as boolean | undefined,
  };
  let door = inferMapDoor(project, map, at, options);
  if (selected && (!door || !locationsOverlap(selected, door.rect))) {
    door = inferMapDoor(project, map, { x: selected.x, y: selected.y + selected.h - 1 }, {
      ...options, kind: options.kind ?? doorKindName(selected),
    });
  }
  if (!door) throw new PrimitiveError("문 그림을 찾을 수 없어요. 문 칸이나 문 종류를 골라 주세요.");
  const rect = selected ? {
    x: selected.x, y: selected.y + selected.h - options.height!, w: options.width!, h: options.height!,
  } : door.rect;
  rectInMap(map, rect);
  const hitDoors = existing.filter(row => locationsOverlap(row, rect));
  // 그림을 알아낸 영역이 이웃 문까지 덮더라도 한 개의 문만 바꾼다.
  if (hitDoors.length > 1 || (hitDoors[0] && hitDoors[0] !== selected)) {
    throw new PrimitiveError("다른 문과 범위가 겹쳐요. 바꿀 문 한 곳의 칸과 크기를 확인해 주세요.");
  }
  let definition = door.def && { ...door.def, ...rect };
  if (hinge !== undefined && (!definition || doorKindName(definition) !== "swing")) {
    throw new PrimitiveError("경첩 방향은 한 짝 여닫이문에서 고를 수 있어요.");
  }
  if (chime !== undefined && !definition?.auto) {
    throw new PrimitiveError("차임 소리는 자동문에서 고를 수 있어요.");
  }
  if (definition && selected) {
    if (doorKindName(definition) === doorKindName(selected)) {
      definition = {
        ...selected, ...rect,
        ...(hinge === undefined ? {} : { hinge: definition.hinge }),
        ...(chime === undefined ? {} : { chimeSe: definition.chimeSe }),
      };
    } else {
      definition = {
        ...definition,
        ...(selected.frame === undefined ? {} : { frame: selected.frame }),
        ...(selected.openSe === undefined ? {} : { openSe: selected.openSe }),
        ...(selected.closeSe === undefined ? {} : { closeSe: selected.closeSe }),
        ...(definition.auto && chime === undefined && selected.chimeSe !== undefined ? { chimeSe: selected.chimeSe } : {}),
      };
    }
  }
  if (!selected && !definition) return project;
  const doors = existing.flatMap(row => row === selected ? (definition ? [definition] : []) : [row]);
  if (!selected && definition) doors.push(definition);
  const next = { ...map };
  if (doors.length) next.doors = doors;
  else delete next.doors;
  return mapDraft(project, map, next);
}

function usesSpatialEntrance(project: Project, link: MapConnection): boolean {
  const document = project.spatialAuthoring;
  if (!document) return false;
  const sameStart = (point: MapConnection["from"]) =>
    point.mapId === link.from.mapId && point.x === link.from.x && point.y === link.from.y;
  return Object.values(document.occurrences).some(occurrence => occurrence.bindings.some(binding =>
    isOwnedSpatialBinding(binding) && binding.overviewEntries?.some(entry => {
      if (link.id === entry.eventId || link.id === entry.returnEventId || sameStart({ ...entry, mapId: binding.mapId })) return true;
      const landing = spatialPortLanding(document, entry.target);
      return landing !== undefined && sameStart(landing);
    })));
}

function upsertConnection(project: Project, map: GameMap, args: Args): Project {
  const toMapId = String(args.toMapId);
  const toMap = Object.hasOwn(project.maps, toMapId) ? project.maps[toMapId] : undefined;
  if (!toMap || toMap.id !== toMapId) throw new PrimitiveError("도착 맵을 찾을 수 없어요.");
  const fromX = Number(args.x), fromY = Number(args.y), toX = Number(args.toX), toY = Number(args.toY);
  pointInMap(map, fromX, fromY);
  pointInMap(toMap, toX, toY);

  const connections = project.mapConnections ?? [];
  const prior = connections.find(connection => connection.id === args.connectionId);
  if (args.connectionId !== undefined && !prior) throw new PrimitiveError("고칠 맵 연결을 찾을 수 없어요.");
  if (prior && connections.some(connection => connection !== prior && connection.id === prior.id)) {
    throw new PrimitiveError("같은 식별자를 쓰는 연결이 여럿 있어요. 맵 연결 목록을 먼저 확인해 주세요.");
  }
  if (prior && prior.from.mapId !== map.id) throw new PrimitiveError("범위 밖이에요. 출발 맵을 선택해 주세요.");
  const name = args.name === undefined ? prior?.name : requiredName(args.name);
  const fromDirection = (args.fromDirection as Dir | undefined) ?? prior?.from.direction;
  const toDirection = (args.toDirection as Dir | undefined) ?? prior?.to.direction;
  const next: MapConnection = {
    id: prior?.id ?? freeId("connection_small_task_", id => connections.some(row => row.id === id)),
    ...(name === undefined ? {} : { name }),
    from: { mapId: map.id, x: fromX, y: fromY, ...(fromDirection ? { direction: fromDirection } : {}) },
    to: { mapId: toMapId, x: toX, y: toY, ...(toDirection ? { direction: toDirection } : {}) },
    playerEnabled: (args.playerEnabled as boolean | undefined) ?? prior?.playerEnabled ?? true,
    npcEnabled: (args.npcEnabled as boolean | undefined) ?? prior?.npcEnabled ?? false,
  };
  if (prior && jsonEqual(prior, next)) return project;
  if ((prior && usesSpatialEntrance(project, prior)) || usesSpatialEntrance(project, next)) {
    throw new PrimitiveError("공간 설계에서 만든 출입구가 이 연결이나 출발 칸을 써요. 공간 설계에서 출입구를 바꿔 주세요.");
  }
  return { ...project, mapConnections: prior ? connections.map(row => row === prior ? next : row) : [...connections, next] };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("map.structure.create", "create_map", "새 맵 만들기", obj({
    name, ...size, tilesetId: text("프로젝트에 있는 타일셋의 식별자. 생략하면 선택한 맵과 같아요"),
  }, ["name"]),
  (_map, args) => `『${label(String(args.name), "새 맵")}』 맵을 만들어요.`,
  (project, map, args) => {
    const tilesetId = String(args.tilesetId ?? map.tilesetId).trim();
    validateTileset(project, tilesetId);
    const after = runMapTool(
      { ...project, maps: { ...project.maps }, mapTree: structuredClone(project.mapTree) }, "create_map",
      { width: 20, height: 15, ...args, tilesetId, name: requiredName(args.name), id: nextMapId(project) },
      "새 맵에 사용할 타일셋과 크기를 확인해 주세요.",
    );
    if (changesBlueprintPlaces(project, after)) {
      throw new PrimitiveError("이 이름을 쓰면 게임 청사진이 새 맵을 가리켜요. 다른 이름을 골라 주세요.");
    }
    return after;
  }, newMap),

  primitive("map.structure.duplicate", "duplicate_map", "맵 복제", obj({ name }),
    (map, args) => args.name === undefined ? `『${mapLabel(map)}』 맵을 복제해요.`
      : `『${mapLabel(map)}』 맵을 『${label(String(args.name), "복사본")}』 이름으로 복제해요.`,
    (project, map, args) => duplicateMap(project, map, args.name === undefined ? `${map.name} 복사` : requiredName(args.name)), newMap),

  primitive("map.structure.remove", "remove_map", "맵 삭제", obj({}),
    map => `『${mapLabel(map)}』 맵을 삭제해요.`,
    (project, map, _args, ctx) => removeMap(project, map, ctx.live),
    ctx => ({ kind: "mapRemove", mapId: selectedMap(ctx).id })),

  primitive("map.structure.resize", "resize_map", "맵 크기 변경", obj(size),
    (map, args) => `『${mapLabel(map)}』 맵을 가로 ${args.width ?? map.width}칸, 세로 ${args.height ?? map.height}칸으로 바꿔요.`,
    (project, map, args, ctx) => {
      if (args.width === undefined && args.height === undefined) throw new PrimitiveError("바꿀 가로 또는 세로 크기를 적어 주세요.");
      return resizeMap(project, map, Number(args.width ?? map.width), Number(args.height ?? map.height), ctx.live);
    }, ctx => ({ kind: "mapResize", mapId: selectedMap(ctx).id })),

  primitive("map.properties.set", "set_map_properties", "맵 속성 변경", obj(propertyArgs),
    (map, args) => {
      if (args.name !== undefined) {
        const newName = label(String(args.name), "새 이름");
        const action = Object.keys(args).length > 1 ? "바꾸고 속성도 고쳐요" : "바꿔요";
        return `『${mapLabel(map)}』 맵 이름을 『${newName}』${towardJosa(newName)} ${action}.`;
      }
      if (args.bgmMode === "none") return `『${mapLabel(map)}』 맵의 배경 음악을 꺼요.`;
      if (args.bgmMode !== undefined || args.bgmResourceId !== undefined) return `『${mapLabel(map)}』 맵의 배경 음악 설정을 바꿔요.`;
      return `『${mapLabel(map)}』 맵의 속성을 바꿔요.`;
    },
    setProperties, propertyScope),

  primitive("map.encounterTable.set", "set_encounter_table", "조우표 설정",
    obj({ entries: arr("이 맵에서 등장할 적 무리 목록", encounterEntry, 64), encounterRate: propertyArgs.encounterRate }, ["entries"]),
    (map, args) => `『${mapLabel(map)}』 맵의 조우표를 ${(args.entries as unknown[]).length}개 항목으로 설정해요.`,
    setEncounterTable, mapMeta(["encounterTable", "encounterRate", "troopIds"])),

  primitive("map.startPosition.set", "set_start_position", "게임 시작 위치 변경", obj(xy, positionFields),
    (map, args) => `『${mapLabel(map)}』 맵의 (${args.x}, ${args.y}) 칸에서 게임을 시작해요.`,
    (project, map, args) => {
      const x = Number(args.x), y = Number(args.y);
      pointInMap(map, x, y);
      if (!isPassable(project, map, x, y)) throw new PrimitiveError("걸을 수 있는 시작 칸을 골라 주세요.");
      return { ...project, startMapId: map.id, startPos: { x, y } };
    }, mapMeta([], { startPosition: true })),

  primitive("map.door.set", "set_map_door", "문 열림 설정", obj({
    ...xy, kind: choice("문 종류. 자동문, 여닫이, 두 짝 여닫이, 미닫이, 셔터, 연출 끄기 또는 그림으로 판단", doorTypes),
    width: integer("문 가로 칸 수. 생략하면 그림으로 판단해요", 1, 4),
    height: integer("문 세로 칸 수. 생략하면 그림으로 판단해요", 1, 4),
    hinge: choice("여닫이 경첩이 있는 쪽", ["left", "right"]),
    chime: bool("자동문을 열 때 입점 소리를 낼지"),
  }, positionFields), (map, args) => {
    if (args.kind === "none") return `『${mapLabel(map)}』 맵에 따로 지정한 문 열림 설정을 지워요.`;
    if (args.kind === undefined) return `『${mapLabel(map)}』 맵의 문 열림 설정을 바꿔요.`;
    return `『${mapLabel(map)}』 맵의 문을 ${doorNames[args.kind as keyof typeof doorNames]} 설정해요.`;
  }, setDoor, mapMeta(["doors"])),

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
  }, upsertConnection, mapMeta([], { connections: "outgoing" })),

  primitive("map.location.create", "create_map_location", "새 장소 만들기", obj({
    ...rect, name, note: text("장소의 용도를 설명하는 메모", 240), tags: arr("장소를 찾을 낱말", text("검색 낱말", 32), 12),
  }, ["name", ...rectFields]),
  (_map, args) => `『${label(String(args.name), "새 장소")}』 장소를 만들어요.`,
  (project, map, args) => {
    const area = { x: Number(args.x), y: Number(args.y), w: Number(args.w), h: Number(args.h) };
    rectInMap(map, area);
    const tags = args.tags as string[] | undefined;
    if (locationRoleTag({ tags })) {
      throw new PrimitiveError("안전지대나 경작지 역할은 장소 편집에서 지정해 주세요.");
    }
    const next = { ...map };
    const result = addMapLocation(next, { ...area, name: newLocationName(map, args.name),
      note: args.note as string | undefined, tags });
    if (!result.ok) throw new PrimitiveError(result.error);
    return mapDraft(project, map, next);
  }, locationScope),

  primitive("map.location.update", "update_map_location", "장소 수정", obj({ locationId, name, ...rect }, ["locationId"]),
    (map, args) => {
      const location = locationInMap(map, args.locationId);
      const current = label(location.name, "선택한 장소");
      if (args.name === undefined) return `『${current}』 장소의 영역을 바꿔요.`;
      const name = label(String(args.name), "새 이름");
      return `『${current}』 장소 이름을 『${name}』${towardJosa(name)} ${rectFields.some(key => args[key] !== undefined) ? "바꾸고 영역도 고쳐요" : "바꿔요"}.`;
    },
    (project, map, args) => {
      const location = locationInMap(map, args.locationId);
      const wantsRect = rectFields.some(key => args[key] !== undefined);
      if (args.name === undefined && !wantsRect) throw new PrimitiveError("바꿀 장소 이름이나 영역을 적어 주세요.");
      if (rectFields.some(key => args[key] !== undefined && args[key] !== location[key]) && (locationRoleTag(location)
        || Object.values(map.locationRoleProjection ?? {}).some(roles => Object.hasOwn(roles, location.id)))) {
        throw new PrimitiveError("이 장소는 안전지대나 경작지로 쓰여요. 장소 편집에서 영역을 바꿔 주세요.");
      }
      const next = { ...map, locations: map.locations?.map(row => row === location ? { ...row } : row) };
      if (args.name !== undefined) {
        const result = renameMapLocation(next, location.id, newLocationName(map, args.name, location));
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
    }, locationScope),

  primitive("map.location.delete", "delete_map_location", "장소 삭제", obj({ locationId }, ["locationId"]),
    (map, args) => `『${label(locationInMap(map, args.locationId).name, "선택한 장소")}』 장소를 삭제해요.`,
    (project, map, args, ctx) => {
      const location = locationInMap(map, args.locationId);
      const draftError = locationDeletionDraftError(project, map.id, location.id, ctx.live);
      if (draftError) throw new PrimitiveError(`${LOCATION_DELETION_DRAFT_REFUSAL}${draftError}\n${location.id}`);
      if (usesLocation(project, map, location.id)) {
        throw new PrimitiveError("이 장소를 가리키는 조건이나 설정이 남아 있어 삭제할 수 없어요.");
      }
      const next = { ...map };
      deleteMapLocation(next, location.id);
      return mapDraft(project, map, next);
    }, locationScope),
];
