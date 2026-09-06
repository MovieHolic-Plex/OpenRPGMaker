import type { M2CommandCatalogEntry } from "@/project/eventCommands/m2Catalog";
import { showPictureState } from "@/project/session";
import { ACTOR_PARAMETER_KEYS } from "@/project/actorModel";
import { changeActorClass } from "@/project/sessionClass";
import type { ActorParameterKey, M2CommandFields, Project } from "@/project/types";
import type { M2RuntimeState, PlaySessionLike, RuntimeEventLocation, RuntimePictureState } from "@/project/sessionRuntimeTypes"
import { executeModernCommand } from "./m2ModernRuntime";
import { fieldBoolean, fieldNumber, fieldString } from "./m2RuntimeFields";
import { terrainTagAt } from "@/project/terrainAt";
import { runtimeEventViewById, runtimeEventViewsForMap, type RuntimeEventPositions } from "@/project/runtimeEventState";
import { normalizeWeatherParams, parseWeather, weatherToRuntimeString } from "@/player/weather/weatherModel";
import { ensureM2Runtime } from "./m2RuntimeState";

type M2RuntimeCommand = {
  readonly commandId: string;
  readonly fields: M2CommandFields;
};

export function executeM2RuntimeCommand(
  session: PlaySessionLike,
  entry: M2CommandCatalogEntry,
  command: M2RuntimeCommand,
  context: { readonly currentEventId?: string; readonly project?: Project; readonly eventPositions?: RuntimeEventPositions } = {}
): boolean {
  // 배틀 전용 명령(index 98~108)은 맵 인터프리터에서 실행할 수 없다.
  // false를 반환하면 commandCatalog.ts의 support 등급 기반 경고/스킵이 담당한다.
  // 배틀 런타임은 별도 경로(executeM2BattleCommand)로 이 명령들을 실제로 처리한다.
  if (entry.index >= 98 && entry.index <= 108) return false;
  if (entry.title === "Comment") return true;

  executeByTitle(session, entry, command, context);
  return true;
}

function executeByTitle(
  session: PlaySessionLike,
  entry: M2CommandCatalogEntry,
  command: M2RuntimeCommand,
  context: { readonly currentEventId?: string; readonly project?: Project; readonly eventPositions?: RuntimeEventPositions }
): void {
  const runtime = ensureM2Runtime(session);
  const fields = command.fields;
  const title = entry.title;

  if (title === "Move Picture") {
    upsertPicture(session, fields);
    return;
  }
  if (executeModernCommand(session, runtime, title, fields, context)) return;
  if (title === "Hide Screen" || title === "Show Screen") {
    runtime.screen.hidden = title === "Hide Screen";
    return;
  }
  if (title === "End Event Processing") {
    runtime.session.endedEventProcessing = true;
    return;
  }
  if (title === "Erase Event") {
    runtime.session.eraseEventRequested = true;
    return;
  }
  if (title === "Wait for All Movement") {
    runtime.session.waitForAllMovementRequested = true;
    return;
  }
  if (title === "Stop All Movement") {
    runtime.session.stopAllMovementRequested = true;
    return;
  }
  if (title === "Tint Screen") {
    // color 필드(색 이름)를 우선 사용하고, value(r,g,b / hex)가 있으면 그것을 사용.
    const explicit = fieldString(fields, "value", "");
    runtime.screen.tint = explicit || fieldString(fields, "color", "neutral");
    // duration(초 또는 ms) 필드가 있으면 점진 전환 시간으로 기록. 초로 판단되면 ms 로 변환.
    if (hasField(fields, "duration")) {
      runtime.screen.tintDurationMs = toDurationMs(fieldNumber(fields, "duration", 0));
    } else {
      runtime.screen.tintDurationMs = 0;
    }
    return;
  }
  if (title === "Flash Screen") {
    runtime.screen.flash = fieldString(fields, "value", "flash");
    return;
  }
  if (title === "Shake Screen") {
    runtime.screen.shake = fieldNumber(fields, "value", 1);
    return;
  }
  if (title === "Set Weather Effects") {
    const value = fieldString(fields, "value", "none");
    runtime.screen.weather = fields.intensity === undefined ? value : weatherToRuntimeString(normalizeWeatherParams({
      kind: parseWeather(value).kind,
      intensity: fieldNumber(fields, "intensity", 0.5),
    }));
    return;
  }
  if (title === "Memorize Current BGM") {
    runtime.audio.memorizedBgm = currentBgm(session);
    return;
  }
  if (title === "Play Memorized BGM") {
    playMemorizedBgm(session, runtime);
    return;
  }
  if (title.endsWith("Access") || title === "Teleportation On/Off") {
    runtime.access[accessKey(title)] = fieldBoolean(fields, "enabled", true);
    return;
  }
  if (title === "Move to Variable Location") {
    const mapVar = fieldString(fields, "mapVariableId", fieldString(fields, "mapId", ""));
    const xVar = fieldString(fields, "xVariableId", fieldString(fields, "x", ""));
    const yVar = fieldString(fields, "yVariableId", fieldString(fields, "y", ""));
    const mapId = String(session.variables[mapVar] ?? session.currentMapId);
    const x = Math.trunc(session.variables[xVar] ?? 0);
    const y = Math.trunc(session.variables[yVar] ?? 0);
    runtime.map["move_to_variable_location"] = { mapId, x, y, value: "" };
    return;
  }
  if (title === "Get On/Off Vehicle") {
    runtime.system["vehicle_boarded"] = hasField(fields, "boarded")
      ? fieldBoolean(fields, "boarded", true)
      : fieldBoolean(fields, "enabled", true);
    return;
  }
  if (title === "Set Vehicle Location") {
    const vehicle = fieldString(fields, "vehicle", fieldString(fields, "target", "boat"));
    runtime.map[`vehicle_${vehicle}`] = {
      mapId: fieldString(fields, "mapId", ""),
      x: fieldNumber(fields, "x", 0),
      y: fieldNumber(fields, "y", 0),
      value: "",
    };
    return;
  }
  if (title === "Set Event Location" || title === "Swap Event Location") {
    relocateM2Events(session, title, fields, context);
    return;
  }
  if (title === "Get Terrain ID" || title === "Get Event ID") {
    const variableId = fieldString(fields, "variableId", "");
    if (!variableId) return;
    const mapId = fieldString(fields, "mapId", session.currentMapId) || session.currentMapId;
    const x = Math.trunc(fieldNumber(fields, "x", 0));
    const y = Math.trunc(fieldNumber(fields, "y", 0));
    const project = context.project;
    const map = project?.maps[mapId];
    let result = 0;
    if (project && map && x >= 0 && y >= 0 && x < map.width && y < map.height) {
      if (title === "Get Terrain ID") result = terrainTagAt(project, { mapId, x, y }, session.mapOverrides?.[mapId]?.lower[y * map.width + x]);
      else {
        const views = runtimeEventViewsForMap(project, map, session, context.eventPositions ?? {});
        const found = views.find(v => (!v.event.pages?.length || v.page) && v.x === x && v.y === y);
        if (found) {
          // Numeric variables use stable, one-based authored event slots. Removed events do not renumber them.
          const authored = Object.values(project.maps).flatMap(m => m.events);
          const localIndex = map.events.findIndex(e => e.id === found.event.id);
          result = localIndex >= 0 ? localIndex + 1 : map.events.length +
            [...authored.filter(e => !map.events.some(local => local.id === e.id)).map(e => e.id), ...Object.keys(session.spawnedEvents ?? {})].indexOf(found.event.id) + 1;
        }
      }
    }
    session.variables[variableId] = result;
    return;
  }
  if (title === "Change Tileset") {
    runtime.map["tileset_override"] = { mapId: "", x: 0, y: 0, value: fieldString(fields, "value", "") };
    return;
  }
  if (title === "Change Parallax Back") {
    runtime.map["parallax_override"] = { mapId: "", x: 0, y: 0, value: commandResourceId(fields) };
    return;
  }
  if (title === "Set Encounter Rate") {
    runtime.map["encounter_rate"] = { mapId: "", x: 0, y: 0, value: String(fieldNumber(fields, "value", 0)) };
    return;
  }
  if (title === "Set Teleportation Point") {
    runtime.map["teleport_point"] = {
      mapId: fieldString(fields, "mapId", ""),
      x: fieldNumber(fields, "x", 0),
      y: fieldNumber(fields, "y", 0),
      value: "",
    };
    return;
  }
  if (title === "Set Escape Location") {
    runtime.map["escape_location"] = {
      mapId: fieldString(fields, "mapId", ""),
      x: fieldNumber(fields, "x", 0),
      y: fieldNumber(fields, "y", 0),
      value: "",
    };
    return;
  }
  if (title.startsWith("Change Actor ")) {
    mutateActorState(session, runtime, title, fields, context);
    return;
  }
  if (
    title === "Change Parameters"
    || title === "Change State"
    || title === "Damage Processing"
    || title === "Change Battle Commands"
  ) {
    mutateActorState(session, runtime, title, fields, context);
    return;
  }
  if (title.startsWith("Get ")) {
    recordGetter(session, runtime, title, fields);
    return;
  }
  if (title.includes("Location") || title.includes("Map") || title === "Scroll Map") {
    recordMapOrEventState(runtime, title, fields);
    return;
  }
  if (title === "Change Vehicle Graphic") {
    const vehicle = fieldString(fields, "vehicle", "boat");
    runtime.system[`vehicle_graphic_${vehicle}`] = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change System BGM" || title === "Change System SE") {
    const key = title === "Change System BGM" ? "system_bgm" : "system_se";
    // Configuration metadata only: no system-cue slot is specified by this command.
    runtime.system[key] = commandResourceId(fields);
    if (fields.volume !== undefined) runtime.system[`${key}_volume`] = fieldNumber(fields, "volume", 100);
    return;
  }
  if (title === "Change System Graphic") {
    runtime.system["system_graphic"] = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Screen Transition") {
    runtime.screen.tint = fieldString(fields, "value", "fade");
    return;
  }
  if (title === "Show Animation" || title === "Flash Event") {
    runtime.screenEffects.push({
      effect: title === "Show Animation" ? "animation" : "flash",
      value: fieldString(fields, "value", ""),
      durationMs: fieldNumber(fields, "durationMs", 300),
    });
    return;
  }
  if (title === "Play Movie") {
    runtime.system["movie"] = fieldString(fields, "value", "");
    return;
  }
  if (title.startsWith("Open ") || title === "Exit Game" || title.startsWith("Toggle ")) {
    runtime.session.shellAction = title;
    return;
  }
  recordFallback(runtime, command.commandId, entry.label, "No dedicated player surface exists yet; command was recorded safely.");
}

function upsertPicture(session: PlaySessionLike, fields: M2CommandFields): void {
  const pictureId = fieldString(fields, "pictureId", "pic1");
  const previous = session.pictures?.[pictureId];
  // resourceId 미지정 이동은 기존 픽처의 리소스를 유지(Move Picture 는 대개 이미지를 안 바꾼다).
  const resourceId = hasField(fields, "resourceId")
    ? fieldString(fields, "resourceId", "")
    : previous?.resourceId ?? fieldString(fields, "resourceId", "");
  const picture: RuntimePictureState = {
    pictureId,
    resourceId,
    x: fieldNumber(fields, "x", previous?.x ?? 0),
    y: fieldNumber(fields, "y", previous?.y ?? 0),
  };
  // 선택 필드는 명령에 포함될 때만 기록(기존 테스트의 정확한 형태 비교 유지).
  if (hasField(fields, "scale") || hasField(fields, "zoom")) {
    (picture as { scale?: number }).scale = fieldNumber(fields, hasField(fields, "scale") ? "scale" : "zoom", 100);
  }
  if (hasField(fields, "opacity")) {
    (picture as { opacity?: number }).opacity = fieldNumber(fields, "opacity", 255);
  }
  if (hasField(fields, "rotation") || hasField(fields, "angle")) {
    (picture as { rotation?: number }).rotation = fieldNumber(fields, hasField(fields, "rotation") ? "rotation" : "angle", 0);
  }
  if (hasField(fields, "duration") || hasField(fields, "durationMs")) {
    (picture as { durationMs?: number }).durationMs = hasField(fields, "durationMs")
      ? Math.max(0, Math.round(fieldNumber(fields, "durationMs", 0)))
      : toDurationMs(fieldNumber(fields, "duration", 0));
  }
  session.pictures ??= {};
  showPictureState(session as { pictures: Record<string, RuntimePictureState> }, picture);
}

// 필드 존재 여부(값이 undefined 가 아님).
function hasField(fields: M2CommandFields, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined;
}

// duration 값을 ms 로 정규화. RM2K3 는 duration 을 프레임(60fps)/초로 쓰기도 하나,
// 여기서는 값이 작으면(<=60) 초로 보고 ms 로 환산, 그 외(>60)는 이미 ms 로 간주.
function toDurationMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value <= 60 ? Math.round(value * 1000) : Math.round(value);
}

function currentBgm(session: PlaySessionLike): string {
  return session.audio?.bgm?.resourceId ?? "";
}

function playMemorizedBgm(session: PlaySessionLike, runtime: M2RuntimeState): void {
  const memorized = fieldString(runtime.audio, "memorizedBgm", "");
  if (memorized) {
    session.audio ??= {};
    session.audio.bgm = { resourceId: memorized, loop: true };
  }
  runtime.audio.playedMemorizedBgm = memorized;
}

function accessKey(title: string): keyof M2RuntimeState["access"] {
  if (title.includes("Save")) return "save";
  if (title.includes("Menu")) return "menu";
  if (title.includes("Escape")) return "escape";
  if (title.includes("Teleportation")) return "teleportation";
  return "menu";
}

function mutateActorState(
  session: PlaySessionLike,
  runtime: M2RuntimeState,
  title: string,
  fields: M2CommandFields,
  context: { readonly project?: Project } = {}
): void {
  const actorId = fieldString(fields, "target", "party");
  runtime.actors[actorId] ??= {};
  const actor = runtime.actors[actorId];
  if (title === "Change Actor Name") {
    actor.name = fieldString(fields, "value", "");
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      session.actorNames ??= {};
      session.actorNames[targetActorId] = actor.name;
    }
    return;
  }
  if (title === "Change Actor Nickname") {
    actor.nickname = fieldString(fields, "value", "");
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      session.actorNicknames ??= {};
      session.actorNicknames[targetActorId] = actor.nickname;
    }
    return;
  }
  if (title === "Change Actor Graphic") {
    const resourceId = fieldString(fields, "value", "");
    actor.characterGraphic = resourceId;
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      session.actorCharacterResourceIds ??= {};
      session.actorCharacterResourceIds[targetActorId] = resourceId;
    }
    return;
  }
  if (title === "Change Actor Class") {
    const classId = fieldString(fields, "value", "");
    actor.classId = classId;
    if (context.project && classId) {
      for (const targetActorId of resolveActorTargets(session, actorId)) {
        changeActorClass(session, context.project, targetActorId, classId);
      }
    }
    return;
  }
  if (title === "Change Battle Commands") {
    const commandId = fieldString(fields, "value", "");
    const operation = fieldString(fields, "operation", "add");
    const slots = fieldString(fields, "slots", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    actor.battleCommands = commandId;
    session.actorBattleCommands ??= {};
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      const current = session.actorBattleCommands[targetActorId] ?? [];
      if (operation === "remove") {
        session.actorBattleCommands[targetActorId] = current.filter((id) => id !== commandId);
      } else if (operation === "set") {
        session.actorBattleCommands[targetActorId] = slots.length > 0 ? slots : (commandId ? [commandId] : []);
      } else if (commandId && !current.includes(commandId)) {
        session.actorBattleCommands[targetActorId] = [...current, commandId];
      } else {
        session.actorBattleCommands[targetActorId] = current.length ? current : (commandId ? [commandId] : []);
      }
    }
    return;
  }
  if (title === "Change Parameters") {
    const amount = resolveNumericField(session, fields, "value", 0);
    actor.parameters = applyRuntimeNumber(actor.parameters, { ...fields, value: amount });
    const parameter = actorParameterKey(fields);
    const op = fieldString(fields, "operation", "set");
    session.actorParamBonuses ??= {};
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      const bonuses = session.actorParamBonuses[targetActorId] ?? {};
      const current = bonuses[parameter] ?? 0;
      const next = applySessionNumber(current, op, amount);
      bonuses[parameter] = next;
      session.actorParamBonuses[targetActorId] = bonuses;
      syncVitalMaximumBonus(session, targetActorId, parameter, next - current);
    }
    return;
  }
  if (title === "Damage Processing") {
    const amount = Math.max(0, resolveNumericField(session, fields, "value", 0));
    actor.damage = applyRuntimeNumber(actor.damage, { ...fields, value: amount });
    const op = fieldString(fields, "operation", "add");
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      const vitals = session.actorVitals[targetActorId];
      if (!vitals) continue;
      const signed = op === "remove" ? amount : -amount;
      vitals.hp = clampNumber(vitals.hp + signed, 0, vitals.maxHp);
    }
    return;
  }
  if (title === "Change Actor Faceset") {
    // 얼굴은 낱장 파일 한 장 — 리소스 id 하나만 싣는다(셀 번호 없음).
    const resourceId = fieldString(fields, "value", "");
    actor.faceset = resourceId;
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      session.actorFaceResourceIds ??= {};
      session.actorFaceResourceIds[targetActorId] = resourceId;
    }
    return;
  }
  if (title === "Change State") {
    actor.states = applyStringCollection(actor.states, fields);
    session.actorStateIds ??= {};
    for (const targetActorId of resolveActorTargets(session, actorId)) {
      session.actorStateIds[targetActorId] = [...applyStringCollection(session.actorStateIds[targetActorId], fields)];
    }
  }
}

function resolveNumericField(
  session: PlaySessionLike,
  fields: M2CommandFields,
  key: string,
  fallback: number
): number {
  const source = fieldString(fields, "valueSource", "number");
  const variableId = fieldString(fields, "valueVariableId", "").trim();
  if (source === "variable" && variableId) {
    const raw = session.variables?.[variableId];
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fieldNumber(fields, key, fallback);
}

function resolveActorTargets(session: PlaySessionLike, target: string): readonly string[] {
  if (!target || target === "party" || target === "all") return session.partyActorIds;
  return [target];
}

function actorParameterKey(fields: M2CommandFields): ActorParameterKey {
  const explicit = fieldString(fields, "parameter", fieldString(fields, "stat", fieldString(fields, "key", "")));
  // RM2003 "정신" legacy field name spirit maps to engine key mind.
  const normalized = explicit === "spirit" ? "mind" : explicit;
  return ACTOR_PARAMETER_KEYS.includes(normalized as ActorParameterKey) ? normalized as ActorParameterKey : "maxHp";
}

function applySessionNumber(current: number, operation: string, value: number): number {
  switch (operation) {
    case "add":
      return current + value;
    case "remove":
      return current - value;
    case "toggle":
      return current === value ? 0 : value;
    case "set":
      return value;
    default:
      return value;
  }
}

function syncVitalMaximumBonus(session: PlaySessionLike, actorId: string, parameter: ActorParameterKey, delta: number): void {
  const vitals = session.actorVitals[actorId] as ({ maxHp: number; maxMp: number; hp: number; mp: number } | undefined);
  if (!vitals) return;
  if (parameter === "maxHp") {
    vitals.maxHp = Math.max(1, vitals.maxHp + delta);
    vitals.hp = clampNumber(vitals.hp, 0, vitals.maxHp);
  }
  if (parameter === "maxMp") {
    vitals.maxMp = Math.max(0, vitals.maxMp + delta);
    vitals.mp = clampNumber(vitals.mp, 0, vitals.maxMp);
  }
}

function recordGetter(session: PlaySessionLike, runtime: M2RuntimeState, title: string, fields: M2CommandFields): void {
  const variableId = fieldString(fields, "variableId", slugKey(title));
  if (title === "Get Player Location") {
    session.variables[`${variableId}_map`] = numericMapId(session.currentMapId);
    session.variables[`${variableId}_x`] = session.x;
    session.variables[`${variableId}_y`] = session.y;
    return;
  }
  session.variables[variableId] = 0;
  runtime.map[slugKey(title)] = { target: fieldString(fields, "target", "") };
}

function commandResourceId(fields: M2CommandFields): string {
  return fieldString(fields, fields.resourceId === undefined ? "value" : "resourceId", "");
}

/** Commit positions before returning the affected IDs for host movement cancellation. */
export function relocateM2Events(
  session: PlaySessionLike,
  title: "Set Event Location" | "Swap Event Location",
  fields: M2CommandFields,
  context: { readonly project?: Project; readonly eventPositions?: RuntimeEventPositions }
): string[] {
  const runtime = ensureM2Runtime(session);
  const eventA = fieldString(fields, title === "Set Event Location" || fields.eventA === undefined ? "target" : "eventA", "");
  const eventB = title === "Swap Event Location"
    ? fieldString(fields, fields.eventB !== undefined ? "eventB" : fields.value !== undefined ? "value" : "mapId", "") : "";
  if (title === "Set Event Location") recordMapOrEventState(runtime, title, fields);
  else runtime.events._swap = { mapId: "", x: 0, y: 0, value: `${eventA}<->${eventB}` };

  const project = context.project;
  if (!project) return [];
  const positions = context.eventPositions ?? {};
  const currentLocation = (eventId: string): RuntimeEventLocation | undefined => {
    for (const map of Object.values(project.maps)) {
      const view = runtimeEventViewById(project, map, session, map.id === session.currentMapId ? positions : {}, eventId);
      if (view) return { mapId: map.id, x: view.x, y: view.y, direction: view.direction };
    }
    return undefined;
  };
  const writeLocation = (eventId: string, location: RuntimeEventLocation): void => {
    session.eventLocations ??= {};
    session.eventLocations[eventId] = location;
    if (session.spawnedEvents?.[eventId]) {
      session.spawnedEvents[eventId] = { ...session.spawnedEvents[eventId], ...location };
    }
    if (location.mapId === session.currentMapId) {
      positions[eventId] = { x: location.x, y: location.y, direction: location.direction };
    } else delete positions[eventId];
  };
  const a = currentLocation(eventA);
  if (!a) return [];
  if (title === "Set Event Location") {
    const mapId = fieldString(fields, "mapId", session.currentMapId) || session.currentMapId;
    if (!project.maps[mapId]) return [];
    writeLocation(eventA, { mapId, x: fieldNumber(fields, "x", 0), y: fieldNumber(fields, "y", 0), direction: a.direction });
    return [eventA];
  }
  // Snapshot both sides before either write; swapping positions does not swap facing.
  const b = currentLocation(eventB);
  if (!b || eventA === eventB) return [];
  writeLocation(eventA, { ...b, direction: a.direction });
  writeLocation(eventB, { ...a, direction: b.direction });
  return [eventA, eventB];
}

function recordMapOrEventState(runtime: M2RuntimeState, title: string, fields: M2CommandFields): void {
  const target = fieldString(fields, "target", title.includes("Event") ? "event" : "map");
  const state = {
    mapId: fieldString(fields, "mapId", ""),
    x: fieldNumber(fields, "x", 0),
    y: fieldNumber(fields, "y", 0),
    value: fieldString(fields, "value", ""),
  };
  if (title.includes("Event")) {
    runtime.events[target] = { ...runtime.events[target], ...state };
    return;
  }
  runtime.map[slugKey(title)] = state;
}

function recordFallback(runtime: M2RuntimeState, commandId: string, label: string, reason: string): void {
  runtime.fallbacks.push({ commandId, label, reason });
}

function applyRuntimeNumber(current: unknown, fields: M2CommandFields): number {
  const value = fieldNumber(fields, "value", 0);
  if (typeof current !== "number") return value;
  switch (fieldString(fields, "operation", "set")) {
    case "add":
      return current + value;
    case "remove":
      return current - value;
    case "toggle":
    case "set":
      return value;
    default:
      return value;
  }
}

function applyStringCollection(current: unknown, fields: M2CommandFields): readonly string[] {
  const value = fieldString(fields, "value", "");
  const collection = Array.isArray(current) ? current.filter((entry) => typeof entry === "string") : [];
  switch (fieldString(fields, "operation", "set")) {
    case "add":
      return value && !collection.includes(value) ? [...collection, value] : collection;
    case "remove":
      return collection.filter((entry) => entry !== value);
    case "toggle":
      return collection.includes(value) ? collection.filter((entry) => entry !== value) : [...collection, value];
    case "set":
      return value ? [value] : [];
    default:
      return collection;
  }
}

function numericMapId(mapId: string): number {
  const parsed = Number(mapId.replace(/\D+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function slugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
