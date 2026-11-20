import { findCharsetAsset } from "@/assets/charsetCatalog";
import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import { newM2Command } from "@/editor/eventCommandFactory";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { eventDisplayName } from "@/project/eventDisplayName";
import { coordinateAxisSpec } from "@/project/eventCommands/coordinateDestination";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry, type M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";
import { eventCommandHash, EventCommandEditError, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { MAP_BACKGROUND_FLOW_PERCENT_LIMIT } from "@/project/mapBackground";
import { findLocationById } from "@/project/mapNamedLocations";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { GameEvent, GameMap, M2CommandFields, Project } from "@/project/types";
import { isVehicleId, VEHICLE_IDS } from "@/project/vehicles";
import { jsonEqual } from "@/util/structuralJson";
import { commandListAt, insertAtIndex, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { findSpawnUsage, hasEarlierSpawn, spawnedEventId } from "./12-m2-map-move/spawnReferences";

export const UNIT = "12-m2-map-move";

const VEHICLE_NAMES: Readonly<Record<string, string>> = {
  boat: "작은 배", ship: "큰 배", airship: "비행선", chocobo: "초코보", cart: "광산 수레", raft: "뗏목",
};

const NUMBERS = [26, 36, 37, 38, 39, 40, 41, 42, 43, 49, 58, 59, 68, 69, 70, 85, 86, 203, 204, 205, 207];

const REQUIRED: Readonly<Record<number, readonly string[]>> = {
  26: ["value"], 36: ["variableId"], 37: ["mapVariableId", "xVariableId", "yVariableId"],
  41: ["eventB"], 42: ["variableId"], 43: ["variableId"], 68: ["value"],
  203: ["prefabId"], 207: ["regionId"],
};

const FIELD_SCHEMAS: Readonly<Record<string, JsonSchema>> = {
  x: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "왼쪽부터 세는 가로 칸 번호. 첫 칸은 0입니다." },
  y: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "위쪽부터 세는 세로 칸 번호. 첫 칸은 0입니다." },
  mapId: { type: "string", description: "목적지 맵의 식별자. 비우면 선택한 맵입니다." },
  variableId: { type: "string", minLength: 1, description: "결과를 기록할 기존 변수의 식별자." },
  mapVariableId: { type: "string", minLength: 1, description: "목적지의 맵 번호를 담은 기존 변수의 식별자." },
  xVariableId: { type: "string", description: "가로 칸 번호를 담은 기존 변수의 식별자." },
  yVariableId: { type: "string", description: "세로 칸 번호를 담은 기존 변수의 식별자." },
  xSource: { type: "string", enum: ["fixed", "variable"], description: "가로 칸 번호의 출처. 숫자 또는 변수입니다." },
  ySource: { type: "string", enum: ["fixed", "variable"], description: "세로 칸 번호의 출처. 숫자 또는 변수입니다." },
  resultVariableId: { type: "string", description: "이동 결과를 기록할 기존 변수의 식별자. 생략할 수 있습니다." },
  resultSwitchId: { type: "string", description: "도착 여부를 기록할 기존 스위치의 식별자. 생략할 수 있습니다." },
  switchId: { type: "string", description: "구역에 연결할 기존 스위치의 식별자. 이벤트를 연결하면 생략할 수 있습니다." },
  eventA: { type: "string", description: "첫 번째 이벤트의 식별자. 비우면 현재 이벤트입니다." },
  eventB: { type: "string", minLength: 1, description: "자리를 바꿀 두 번째 이벤트의 식별자." },
  prefabId: { type: "string", minLength: 1, description: "복제할 기존 이벤트의 식별자." },
  regionId: { type: "string", minLength: 1, description: "선택한 맵에 저작된 구역의 식별자." },
  distance: { type: "number", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "화면을 옮길 거리. 단위는 칸입니다." },
  flowPercent: { type: "integer", minimum: 0, maximum: MAP_BACKGROUND_FLOW_PERCENT_LIMIT, description: "먼 배경 흐름의 백분율. 0이면 멈추고 100이면 맵에 설정한 속도로 흐릅니다." },
  flowDurationMs: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "흐름 속도가 바뀌는 시간. 단위는 밀리초입니다." },
};

function schemaFor(entry: M2CommandCatalogEntry, field: M2CommandFieldSpec): JsonSchema {
  if (field.key === "target") {
    return { type: "string", description: entry.index === 205
      ? "이동할 기존 이벤트의 식별자. 이 이벤트나 주인공도 고를 수 있습니다."
      : "옮길 기존 이벤트의 식별자. 비우면 현재 이벤트입니다." };
  }
  if (field.key === "eventId") {
    const description = entry.index === 203
      ? "게임에서 생성할 이벤트의 새 식별자. 추가할 때 비우면 원본 식별자에서 정합니다."
      : entry.index === 204
        ? "게임 중 제거할 이벤트의 식별자. 비우거나 this-event를 쓰면 실행 중인 이벤트 자신을 제거합니다."
        : "구역에 연결할 이벤트의 식별자. 스위치를 연결하면 생략할 수 있습니다.";
    return { type: "string", description };
  }
  if (field.key === "resourceId") return {
    type: "string",
    description: "먼 배경 그림의 식별자. 빈 문자열과 흐름 배율을 함께 지정하면 그림을 유지합니다. 빈 문자열만 지정하면 맵의 기본 그림으로 돌아가고 이 줄의 흐름 설정을 지웁니다.",
  };
  if (entry.index === 37 && (field.key === "xVariableId" || field.key === "yVariableId")) {
    return { ...FIELD_SCHEMAS[field.key], minLength: 1 };
  }
  if (field.key === "value") {
    if (entry.index === 26) return { type: "string", minLength: 1, description: "탈것에 쓸 걷기 그림의 식별자." };
    if (entry.index === 68) return { type: "string", minLength: 1, description: "맵에 쓸 타일셋의 식별자." };
    return { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "전투 빈도 설정값. 0은 전투를 끄는 값입니다." };
  }
  if (field.key === "speed") return { type: "number", minimum: 1, maximum: entry.index === 49 ? 6 : 8, description: "이동 속도. 숫자가 클수록 빠릅니다." };
  const schema = FIELD_SCHEMAS[field.key];
  if (schema) return schema;
  if (field.options?.every(option => option.value === "true" || option.value === "false") || field.type === "boolean") {
    return { type: "boolean", description: field.key === "boarded" ? "탑승이면 참, 하차면 거짓." : "이동을 마칠 때까지 기다릴지 여부." };
  }
  if (field.options) return {
    type: "string",
    enum: field.options.map(option => option.value),
    description: `${field.label}. ${field.options.map(option => option.label).join(", ")} 중에서 고릅니다.`,
  };
  return { type: "string", description: `${field.label}에 사용할 기존 항목의 식별자.` };
}

function scopeFor(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage" as const, mapId: map.id, eventId: event.id, pageId: page.id };
}

type PageContext = ReturnType<typeof scopedPage> & Pick<PrimitiveContext, "project" | "live">;
type M2Command = ReturnType<typeof newM2Command>;

function fieldPatch(fields: readonly M2CommandFieldSpec[], args: Record<string, unknown>): M2CommandFields {
  const patch: M2CommandFields = {};
  for (const field of fields) {
    const value = args[field.key];
    if (typeof value === "boolean") patch[field.key] = field.type === "select" ? String(value) : value;
    if (typeof value === "string" && value.trim() !== value) {
      throw new PrimitiveError("식별자의 앞뒤 공백을 지운 뒤 다시 입력해 주세요.");
    }
    if (typeof value === "string" || typeof value === "number") patch[field.key] = value;
  }
  return patch;
}

function effectiveFields(entry: M2CommandCatalogEntry, fields: M2CommandFields): M2CommandFields {
  const effective = { ...fields };
  const readLegacy = (key: string, ...fallbackKeys: string[]) => {
    if (effective[key] !== undefined) return;
    for (const fallback of fallbackKeys) {
      const value = fields[fallback];
      if (value === undefined) continue;
      effective[key] = value;
      return;
    }
  };
  // Older forms wrote these keys. Resolve them for validation without filling the stored
  // patch with factory defaults that would shadow an existing command's runtime fallbacks.
  switch (entry.index) {
    case 37:
      readLegacy("mapVariableId", "mapId");
      readLegacy("xVariableId", "x");
      readLegacy("yVariableId", "y");
      break;
    case 38: effective.boarded ??= fields.enabled ?? "true"; break;
    case 39: effective.vehicle ??= fields.target ?? "boat"; break;
    case 41:
      readLegacy("eventA", "target");
      readLegacy("eventB", "value", "mapId");
      break;
    case 49:
      readLegacy("direction", "target");
      readLegacy("distance", "value");
      effective.mode = fields.return === "true" || fields.return === true || fields.mode === "return" ? "return"
        : fields.lock === "true" || fields.lock === true || fields.mode === "lock" ? "lock" : "pan";
      break;
    case 69: readLegacy("resourceId", "value"); break;
    case 203: effective.prefabId = fields.templateEventId ?? fields.prefabId ?? ""; break;
  }
  return effective;
}

function stringField(fields: M2CommandFields, key: string, fallback = ""): string {
  return String(fields[key] ?? fallback);
}

function explicitRemovalId(fields: M2CommandFields): string {
  const id = stringField(fields, "eventId");
  return id === "this-event" ? "" : id;
}

function finishPatch(ctx: PageContext, entry: M2CommandCatalogEntry, fields: M2CommandFields, patch: M2CommandFields, inserting: boolean) {
  const selfField = entry.index === 40 ? "target" : entry.index === 41 ? "eventA" : undefined;
  if (selfField && (inserting || Object.hasOwn(patch, selfField)) && !stringField(effectiveFields(entry, fields), selfField)) {
    patch[selfField] = "this-event";
  }
  if ((entry.index === 39 || entry.index === 40) && (inserting || Object.hasOwn(patch, "mapId"))) {
    patch.mapId = stringField(fields, "mapId") || ctx.map.id;
  }
  if (entry.index === 203 && Object.hasOwn(patch, "prefabId") && Object.hasOwn(fields, "templateEventId")) {
    patch.templateEventId = patch.prefabId;
  }
  if (entry.index === 203 && (inserting || Object.hasOwn(patch, "eventId"))) {
    const prefabId = stringField(effectiveFields(entry, { ...fields, ...patch }), "prefabId");
    patch.eventId = stringField(fields, "eventId") || `${prefabId}_spawn`;
  }
  if (entry.index === 204 && patch.eventId === "this-event") patch.eventId = "";
  if (entry.index === 69 && Object.hasOwn(patch, "resourceId")) {
    // The rich editor reads the old value field first when it is present.
    if (Object.hasOwn(fields, "value")) patch.value = patch.resourceId;
    if (Object.hasOwn(fields, "target")) patch.target = patch.resourceId;
  }
  if (entry.index === 49) {
    if (Object.hasOwn(patch, "mode")) {
      if (Object.hasOwn(fields, "return")) patch.return = patch.mode === "return";
      if (Object.hasOwn(fields, "lock")) patch.lock = patch.mode === "lock";
    }
    if (Object.hasOwn(patch, "speed")) {
      if (Object.hasOwn(fields, "durationMs")) patch.durationMs = 0;
      if (Object.hasOwn(fields, "duration")) patch.duration = 0;
    }
  }
  if (entry.index === 70 && Object.hasOwn(patch, "value")) {
    if (Object.hasOwn(fields, "valueSource")) patch.valueSource = "number";
    if (Object.hasOwn(fields, "valueVariableId")) patch.valueVariableId = "";
  }
  if (entry.index === 205) {
    if (patch.target === "") patch.target = "this-event";
    for (const axis of ["x", "y"] as const) {
      const variableKey = `${axis}VariableId`;
      const sourceKey = `${axis}Source`;
      if (patch[sourceKey] !== undefined) continue;
      if (patch[variableKey]) patch[sourceKey] = "variable";
      else if (patch[axis] !== undefined && coordinateAxisSpec(fields, axis).source === "variable") patch[sourceKey] = "fixed";
    }
  }
}

function mapEvent(map: GameMap, id: string) {
  return map.events.find(event => event.id === id);
}

function projectEvent(project: Project, id: string) {
  for (const map of Object.values(project.maps)) {
    const event = mapEvent(map, id);
    if (event) return event;
  }
  return undefined;
}

function hasResource(project: Project, kind: DatabaseResourcePickerKind, id: string): boolean {
  return (kind === "charset" && Boolean(findCharsetAsset(id)))
    || listDatabaseResourceOptions(kind, project).some(option => option.id === id);
}

function validateReferences(
  ctx: PageContext, entry: M2CommandCatalogEntry, command: M2Command, previous: M2Command | undefined,
  patch: M2CommandFields, path: readonly number[],
) {
  const fields = effectiveFields(entry, command.fields);
  const string = (key: string) => stringField(fields, key);
  const requireEvent = (id: string, event: GameEvent | undefined) => {
    if (!event) throw new PrimitiveError(id ? "지정한 이벤트를 찾을 수 없습니다." : "이벤트를 선택해 주세요.");
  };
  const requireLocationEvent = (id: string) => {
    requireEvent(id, id === "this-event" ? ctx.event : projectEvent(ctx.project, id));
  };
  let hasLegacyLookupMap = false;

  switch (entry.index) {
    case 26:
      if (!isVehicleId(stringField(fields, "vehicle", "boat"))) throw new PrimitiveError("모습을 바꿀 탈것을 선택해 주세요.");
      if (!hasResource(ctx.project, "charset", string("value"))) throw new PrimitiveError("탈것에 쓸 걷기 그림을 찾을 수 없습니다.");
      break;
    case 39:
      if (!isVehicleId(string("vehicle"))) throw new PrimitiveError("위치를 설정할 탈것을 선택해 주세요.");
      fields.mapId = string("mapId") || ctx.map.id;
      break;
    case 40:
      fields.mapId = string("mapId") || ctx.map.id;
      requireLocationEvent(string("target"));
      break;
    case 41:
      requireLocationEvent(string("eventA"));
      requireLocationEvent(string("eventB"));
      if (string("eventA") && string("eventA") === string("eventB")) throw new PrimitiveError("서로 다른 이벤트 두 개를 선택해 주세요.");
      break;
    case 42:
    case 43: {
      const mapId = string("mapId");
      if (mapId && mapId !== ctx.map.id) {
        if (!Object.hasOwn(ctx.project.maps, mapId)) throw new PrimitiveError("지정한 맵을 찾을 수 없습니다. 선택을 확인해 주세요.");
        const { width, height } = ctx.project.maps[mapId];
        const x = Number(fields.x ?? 0);
        const y = Number(fields.y ?? 0);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
          throw new PrimitiveError("좌표가 맵 범위 밖입니다.");
        }
        hasLegacyLookupMap = true;
      }
      break;
    }
    case 68:
      if (!Object.hasOwn(ctx.project.tilesets, string("value"))) throw new PrimitiveError("지정한 타일셋을 찾을 수 없습니다.");
      break;
    case 69:
      if (string("resourceId") && !hasResource(ctx.project, "backdrop", string("resourceId"))) throw new PrimitiveError("지정한 먼 배경 그림을 찾을 수 없습니다.");
      if (patch.flowDurationMs !== undefined && (fields.flowPercent === undefined || fields.flowPercent === "")) {
        throw new PrimitiveError("흐름 전환 시간을 지정하려면 흐름 배율도 입력해 주세요.");
      }
      if (!previous && patch.resourceId === undefined && fields.flowPercent === undefined) {
        throw new PrimitiveError("먼 배경 그림을 고르거나 흐름 배율을 입력해 주세요.");
      }
      break;
    case 203: {
      const id = spawnedEventId(fields);
      const oldId = previous && spawnedEventId(previous.fields);
      const references = withOpenEventDrafts(ctx.project, ctx.live, { mapId: ctx.map.id, eventId: ctx.event.id });
      if (!id.trim() || id.trim() !== id || Object.hasOwn(Object.prototype, id) || ["this-event", "player", PLAYER_MOVE_TARGET, "_swap"].includes(id)) {
        throw new PrimitiveError("새 이벤트에 쓸 다른 식별자를 입력해 주세요.");
      }
      const templateMapId = stringField(fields, "templateMapId", string("sourceMapId"));
      if (templateMapId) {
        if (!Object.hasOwn(ctx.project.maps, templateMapId)) throw new PrimitiveError("복제할 원본의 맵을 찾을 수 없습니다.");
        if (!mapEvent(ctx.project.maps[templateMapId], string("prefabId"))) {
          throw new PrimitiveError("지정된 원본 맵에서 복제할 이벤트를 찾을 수 없습니다.");
        }
      }
      if (projectEvent(references, id) || (oldId !== id && findSpawnUsage(references, id, previous, "declaration"))) {
        throw new PrimitiveError("같은 식별자를 쓰는 이벤트가 이미 있습니다. 다른 식별자를 입력해 주세요.");
      }
      if (oldId && oldId !== id && findSpawnUsage(references, oldId, previous, "reference")) {
        throw new PrimitiveError("기존 식별자를 참조하는 곳이 있거나 스크립트의 참조 여부를 확인할 수 없어 생성 식별자를 바꿀 수 없습니다.");
      }
      break;
    }
    case 204: {
      const id = explicitRemovalId(fields);
      if (id) {
        const mapId = string("mapId") || ctx.map.id;
        const map = Object.hasOwn(ctx.project.maps, mapId) ? ctx.project.maps[mapId] : undefined;
        if (!(map && mapEvent(map, id)) && !hasEarlierSpawn(ctx.project, ctx.page, path, id)) {
          if (!map) throw new PrimitiveError("이벤트를 제거할 맵을 찾을 수 없습니다.");
          throw new PrimitiveError("지정한 이벤트를 찾을 수 없습니다.");
        }
      }
      const oldId = previous && explicitRemovalId(previous.fields);
      if (oldId !== undefined && oldId !== id) {
        const references = withOpenEventDrafts(ctx.project, ctx.live, { mapId: ctx.map.id, eventId: ctx.event.id });
        if (findSpawnUsage(references, oldId || ctx.event.id, previous, "removalFlag", !oldId)) {
          throw new PrimitiveError("이벤트가 제거되었는지 확인하는 곳이 있거나 스크립트의 참조 여부를 확인할 수 없어 제거 대상을 바꿀 수 없습니다.");
        }
      }
      break;
    }
    case 205: {
      const id = string("target") || "this-event";
      if (![PLAYER_MOVE_TARGET, "player", "this-event"].includes(id)) requireEvent(id, mapEvent(ctx.map, id));
      for (const axis of ["x", "y"] as const) {
        const spec = coordinateAxisSpec(fields, axis);
        const limit = axis === "x" ? ctx.map.width : ctx.map.height;
        if (spec.source === "fixed" && spec.fixedValue >= limit) throw new PrimitiveError("좌표가 맵 범위 밖입니다.");
        if (spec.source === "variable" && !spec.variableId) throw new PrimitiveError("좌표를 읽을 변수를 선택해 주세요.");
        if ((spec.source === "variable" || patch[`${axis}VariableId`]) && !ctx.project.variables.some(variable => variable.id === spec.variableId)) {
          throw new PrimitiveError("지정한 좌표 변수를 찾을 수 없습니다. 선택을 확인해 주세요.");
        }
      }
      break;
    }
    case 207:
      if (!findLocationById(ctx.map, string("regionId"))) throw new PrimitiveError("이 맵에서 지정한 구역을 찾을 수 없습니다.");
      if ([string("eventId"), string("switchId")].some(id => id.trim() !== id)) {
        throw new PrimitiveError("구역에 연결할 이벤트나 스위치의 식별자를 확인해 주세요.");
      }
      if (!string("eventId") && !string("switchId")) throw new PrimitiveError("구역에 연결할 이벤트나 스위치를 선택해 주세요.");
      break;
  }

  // Only the proposed line is checked. An unrelated warning or old error elsewhere
  // on the real page must not prevent a valid single-command edit.
  const page = { ...ctx.page, conditions: [], commands: [{ ...command, fields }] };
  const validation = validateEventDraftBody(ctx.project, ctx.map.id, { ...ctx.event, pages: [page] });
  const issue = validation.issues.find(item => item.severity === "error" && item.commandPath?.[0] === 0
    && !(entry.index === 41 && item.code === "reference.event.missing")
    && !(hasLegacyLookupMap && item.code === "map.position.out-of-bounds")
    && !(entry.index === 69 && !string("resourceId") && item.code === "reference.resource.missing"));
  if (!issue) return;
  if (issue.code.startsWith("reference.")) {
    const object = ({ event: "이벤트를", map: "맵을", resource: "그림을", switch: "스위치를", variable: "변수를" } as Record<string, string>)[issue.code.split(".")[1]];
    throw new PrimitiveError(`지정한 ${object ?? "대상을"} 찾을 수 없습니다. 선택을 확인해 주세요.`);
  }
  if (issue.code.startsWith("map.position.")) throw new PrimitiveError("좌표가 맵 범위 밖입니다.");
  if (issue.code.startsWith("m2.coordinate.")) throw new PrimitiveError("좌표에 0 이상의 정수를 입력해 주세요.");
  throw new PrimitiveError("이 명령의 좌표 설정을 확인해 주세요.");
}

function shortName(name: string | undefined, id: string, fallback: string): string {
  if (!name || name === id) return fallback;
  const clean = displayText(name.replace(/['".!?{}\[\]]/gu, " "), fallback);
  return clean.length > 14 ? clean.slice(0, 13) + "…" : clean;
}

function action(ctx: PageContext, entry: M2CommandCatalogEntry, values: M2CommandFields, patch: M2CommandFields): string {
  const fields = effectiveFields(entry, values);
  const str = (key: string, fallback = "") => stringField(fields, key, fallback);
  const point = `(${Number(fields.x ?? 0)}, ${Number(fields.y ?? 0)})`;
  const variable = (key: string) => shortName(ctx.project.variables.find(item => item.id === str(key))?.name, str(key), "변수");
  const event = (key: string) => {
    const id = str(key);
    if (id === ctx.event.id || !id || id === "this-event") return "이 이벤트";
    if (id === PLAYER_MOVE_TARGET || id === "player") return "주인공";
    const found = projectEvent(ctx.project, id);
    return shortName(found && eventDisplayName(found), id, "이벤트");
  };
  const mapId = str("mapId") || ctx.map.id;
  const map = shortName(ctx.project.maps[mapId]?.name, mapId, "맵");
  const vehicle = VEHICLE_NAMES[str("vehicle", "boat")] ?? "탈것";
  switch (entry.index) {
    case 26: return `‘${vehicle}’에 쓸 걷기 그림을 지정`;
    case 36: return `‘${variable("variableId")}’를 기준으로 주인공의 맵 번호와 좌표를 기록`;
    case 37: return "변수에서 맵 번호와 좌표를 읽어 이동 목적지로 지정";
    case 38: return str("boarded") === "false" ? "현재 탈것에서 내리도록 설정" : "앞에 있는 탈것에 타도록 설정";
    case 39: return `‘${vehicle}’를 ‘${map}’ ${point} 칸에 배치`;
    case 40: return `‘${event("target")}’의 위치를 ‘${map}’ ${point} 칸으로 옮기도록 설정`;
    case 41: return `‘${event("eventA")}’, ‘${event("eventB")}’ 두 이벤트의 자리를 교환`;
    case 42: return `${str("mapId") && mapId !== ctx.map.id ? `‘${map}’ ` : ""}${point} 칸의 지형 번호를 ‘${variable("variableId")}’에 기록`;
    case 43: return `${str("mapId") && mapId !== ctx.map.id ? `‘${map}’ ` : ""}${point} 칸의 이벤트 번호를 ‘${variable("variableId")}’에 기록`;
    case 49: {
      const direction = entry.fields.find(field => field.key === "direction")?.options?.find(option => option.value === str("direction"))?.label ?? "아래";
      const towards = direction === "위" || direction === "아래" ? `${direction}로` : `${direction}으로`;
      const ending = str("mode") === "return" ? "주인공에게 복귀"
        : str("mode") === "lock" ? "그 자리에서 고정" : "옮긴 위치를 표시";
      return `화면을 ${towards} ${Number(fields.distance ?? 0)}칸 옮긴 뒤 ${ending}`;
    }
    case 58: return "모든 이동이 끝날 때까지 기다리도록 설정";
    case 59: return "진행 중인 이동을 모두 멈추도록 설정";
    case 68: return `‘${shortName(ctx.project.tilesets[str("value")]?.name, str("value"), "타일셋")}’을 맵 그림 세트로 지정`;
    case 69: {
      const flow = `먼 배경의 흐름 배율을 ${Number(fields.flowPercent ?? 100)}퍼센트로 설정`;
      if (fields.resourceId && patch.flowPercent !== undefined) return `먼 배경 그림을 지정하고 ${flow}`;
      if (patch.resourceId) return "먼 배경 그림을 바꾸도록 설정";
      if (patch.flowDurationMs !== undefined && patch.flowPercent === undefined) {
        return `먼 배경의 흐름 전환 시간을 ${Number(fields.flowDurationMs ?? 0)}밀리초로 설정`;
      }
      if (patch.resourceId === "") return fields.flowPercent === undefined || fields.flowPercent === ""
        ? "맵에 설정한 먼 배경 그림으로 돌아가도록 설정" : `기존 먼 배경 그림을 유지하고 ${flow}`;
      return flow;
    }
    case 70: return `무작위 전투 빈도 설정값을 ${Number(fields.value ?? 25)}로 지정`;
    case 85: return "실행 중인 이벤트를 이 줄에서 끝내도록 설정";
    case 86: return "이번 맵 방문 동안 이 이벤트를 숨기도록 설정";
    case 203: return `‘${event("prefabId")}’를 복제해 ‘${map}’ ${point} 칸에 나타나도록 설정`;
    case 204: return `‘${event("eventId")}’를 게임 진행 중에 제거하도록 설정`;
    case 205: {
      const destination = (["x", "y"] as const).some(axis => coordinateAxisSpec(fields, axis).source === "variable")
        ? "변수로 정한 칸" : `${point} 칸`;
      return `이동 대상 ‘${event("target")}’의 목적지를 ${destination}으로 설정`;
    }
    case 207: return `‘${shortName(findLocationById(ctx.map, str("regionId"))?.name, str("regionId"), "구역")}’의 동작을 등록`;
    default: throw new PrimitiveError("지도·이동 명령을 찾을 수 없습니다.");
  }
}

function primitive(entry: M2CommandCatalogEntry, operation: "insert" | "update"): SmallTaskPrimitive {
  const update = operation === "update";
  const fields = entry.index === 26
    ? [...entry.fields.filter(field => field.key === "value"), {
      key: "vehicle", label: "탈것", type: "select" as const, defaultValue: "boat",
      options: VEHICLE_IDS.map(value => ({ value, label: VEHICLE_NAMES[value] })),
    }]
    : entry.fields;
  const properties = Object.fromEntries(fields.map(field => [field.key, schemaFor(entry, field)]));
  const indexSchema: JsonSchema = {
    type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER,
    description: update ? "목록에서 고칠 줄의 번호. 첫 줄은 0입니다." : "목록에 넣을 줄의 번호. 첫 줄은 0이며 생략하면 맨 뒤에 넣습니다.",
  };
  const branchPathSchema: JsonSchema = {
    type: "array", items: { type: "integer" }, description: "분기 안을 고치려면 이벤트 읽기에서 받은 분기 경로를 적습니다.",
  };
  const expectedHashSchema: JsonSchema = {
    type: "string", minLength: 1, description: "get_event에서 includeCommandHashes를 켜고 읽은 해당 줄의 해시.",
  };
  const number = String(entry.index).padStart(3, "0");

  function prepare(ctx: PrimitiveContext, args: Record<string, unknown>) {
    const pageContext = { ...scopedPage(ctx), project: ctx.project, live: ctx.live };
    const { index, branchPath = [], expectedHash } = args as { index?: number; branchPath?: number[]; expectedHash?: string };
    const list = commandListAt(pageContext.page, branchPath);
    const row = index ?? list.length;
    if (!Number.isSafeInteger(row) || row < 0 || (!update && row > list.length)) {
      throw new PrimitiveError("명령 줄 위치를 다시 확인해 주세요.");
    }
    const current = update ? list[row] : newM2Command(entry.id);
    if (update && (!current || eventCommandHash(current) !== expectedHash)) {
      throw new PrimitiveError(STALE_COMMAND_LIST);
    }
    if (current?.kind !== "m2Command" || current.commandId !== entry.id) {
      throw new PrimitiveError("선택한 줄에 이 종류의 명령이 없습니다.");
    }
    const patch = fieldPatch(fields, args);
    if (update && entry.index === 203 && patch.eventId === "") {
      throw new PrimitiveError("생성할 이벤트의 식별자를 입력해 주세요.");
    }
    if (!update && entry.index === 26) patch.vehicle ??= "boat";
    if (!update || Object.keys(patch).length > 0) {
      finishPatch(pageContext, entry, { ...current.fields, ...patch }, patch, !update);
      // Legacy commands could store boolean selects directly. Keep their meaning
      // while writing the string form required by the saved command shape.
      for (const field of fields) {
        const stored = current.fields[field.key];
        if (field.type === "select" && typeof stored === "boolean" && field.options?.some(option => option.value === String(stored))) {
          patch[field.key] ??= String(stored);
        }
      }
      if (update && entry.index === 203 && !Object.hasOwn(patch, "eventId")) {
        if (current.fields.eventId === undefined && spawnedEventId(current.fields) !== spawnedEventId({ ...current.fields, ...patch })) {
          patch.eventId = spawnedEventId(current.fields);
        }
      }
    }
    const next = { ...current, fields: { ...current.fields, ...patch } };
    if (entry.index === 69 && patch.flowPercent === undefined && (!update || patch.resourceId === "")) {
      delete next.fields.flowPercent;
      delete next.fields.flowDurationMs;
    }
    return { pageContext, row, branchPath, expectedHash, current, patch, next, unchanged: update && jsonEqual(current, next) };
  }

  return {
    id: `m2.${number}.${operation}`,
    unit: UNIT,
    title: entry.label,
    covers: { m2Ids: [`m2-${number}`] },
    targets: ["event"],
    args: {
      type: "object",
      properties: { index: indexSchema, branchPath: branchPathSchema, ...(update ? { expectedHash: expectedHashSchema } : {}), ...properties },
      required: update ? ["index", "expectedHash"] : REQUIRED[entry.index] ?? [],
      additionalProperties: false,
    },
    scope: scopeFor,
    describe(ctx, args) {
      const { pageContext, next, patch, unchanged } = prepare(ctx, args);
      if (unchanged) return `‘${entry.label}’ 명령의 현재 설정을 유지합니다.`;
      return koreanSentence(`${action(pageContext, entry, next.fields, patch)}하는 명령을 ${update ? "고칩니다" : "넣습니다"}.`);
    },
    apply(ctx, args) {
      const { pageContext, row, branchPath, expectedHash, current, patch, next, unchanged } = prepare(ctx, args);
      if (unchanged && Object.keys(patch).length === 0) return ctx.project;
      const path = [...branchPath, row];
      validateReferences(pageContext, entry, next, update ? current : undefined, patch, path);
      if (unchanged) return ctx.project;
      try {
        return update
          ? updateScopedPage(ctx, page => updateEventCommand(page, path, { fields: next.fields }, expectedHash!))
          : insertAtIndex(ctx, next, row, branchPath);
      } catch (error) {
        if (!(error instanceof EventCommandEditError) || error.code === "stale-event-command") throw error;
        throw new PrimitiveError("명령 줄 위치나 입력값을 다시 확인해 주세요.");
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = NUMBERS.flatMap(number => {
  const entry = M2_COMMAND_CATALOG.find(candidate => candidate.index === number);
  if (!entry) throw new PrimitiveError("지도·이동 명령의 카탈로그 항목을 찾을 수 없습니다.");
  return [primitive(entry, "insert"), primitive(entry, "update")];
});
