import type { M2CommandCatalogEntry } from "@/editor/eventCommands/m2Catalog";
import type { M2CommandFields } from "@/project/types";
import type { M2RuntimeState, PlaySessionLike } from "@/player/types";
import { executeModernCommand } from "./m2ModernRuntime";
import { fieldBoolean, fieldNumber, fieldString } from "./m2RuntimeFields";
import { ensureM2Runtime } from "./m2RuntimeState";

type M2RuntimeCommand = {
  readonly commandId: string;
  readonly fields: M2CommandFields;
};

export function executeM2RuntimeCommand(
  session: PlaySessionLike,
  entry: M2CommandCatalogEntry,
  command: M2RuntimeCommand
): boolean {
  // 배틀 전용 명령(index 98~199)은 맵 인터프리터에서 실행할 수 없다.
  // false를 반환하면 commandCatalog.ts의 classification 기반 처리(battle-only → 경고 후 스킵)가 담당한다.
  // 배틀 런타임은 별도 경로(executeM2BattleCommand)로 이 명령들을 실제로 처리한다.
  if (entry.runtimeClassification === "battle-only") return false;
  if (entry.title === "Comment") return true;

  executeByTitle(session, entry, command);
  return true;
}

function executeByTitle(session: PlaySessionLike, entry: M2CommandCatalogEntry, command: M2RuntimeCommand): void {
  const runtime = ensureM2Runtime(session);
  const fields = command.fields;
  const title = entry.title;

  if (title === "Move Picture") {
    upsertPicture(session, fields);
    return;
  }
  if (executeModernCommand(session, runtime, title, fields)) return;
  if (title === "Hide Screen" || title === "Show Screen") {
    runtime.screen.hidden = title === "Hide Screen";
    return;
  }
  if (title === "Tint Screen") {
    // color 필드(색 이름)를 우선 사용하고, value(r,g,b / hex)가 있으면 그것을 사용.
    const explicit = fieldString(fields, "value", "");
    runtime.screen.tint = explicit || fieldString(fields, "color", "neutral");
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
    runtime.screen.weather = fieldString(fields, "value", "none");
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
  if (title.startsWith("Change Actor ")) {
    mutateActorState(runtime, title, fields);
    return;
  }
  if (title === "Change Parameters" || title === "Change State" || title === "Damage Processing") {
    mutateActorState(runtime, title, fields);
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
  if (title.startsWith("Open ") || title === "Exit Game" || title.startsWith("Toggle ")) {
    runtime.session.shellAction = title;
    return;
  }
  recordFallback(runtime, command.commandId, entry.label, "No dedicated player surface exists yet; command was recorded safely.");
}

function upsertPicture(session: PlaySessionLike, fields: M2CommandFields): void {
  const pictureId = fieldString(fields, "pictureId", "pic1");
  const resourceId = fieldString(fields, "resourceId", "");
  const picture = {
    pictureId,
    resourceId,
    x: fieldNumber(fields, "x", 0),
    y: fieldNumber(fields, "y", 0),
  };
  session.pictures ??= {};
  session.pictures[pictureId] = picture;
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

function mutateActorState(runtime: M2RuntimeState, title: string, fields: M2CommandFields): void {
  const actorId = fieldString(fields, "target", "party");
  runtime.actors[actorId] ??= {};
  const actor = runtime.actors[actorId];
  if (title === "Change Actor Name") {
    actor.name = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Actor Nickname") {
    actor.nickname = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Actor Graphic") {
    actor.characterGraphic = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Actor Faceset") {
    actor.faceset = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Actor Class") {
    actor.classId = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Battle Commands") {
    actor.battleCommands = fieldString(fields, "value", "");
    return;
  }
  if (title === "Change Parameters") {
    actor.parameters = applyRuntimeNumber(actor.parameters, fields);
    return;
  }
  if (title === "Damage Processing") {
    actor.damage = applyRuntimeNumber(actor.damage, fields);
    return;
  }
  if (title === "Change State") {
    actor.states = applyStringCollection(actor.states, fields);
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

function recordMapOrEventState(runtime: M2RuntimeState, title: string, fields: M2CommandFields): void {
  const target = fieldString(fields, "target", title.includes("Event") ? "event" : "map");
  const state = {
    mapId: fieldString(fields, "mapId", ""),
    x: fieldNumber(fields, "x", 0),
    y: fieldNumber(fields, "y", 0),
    value: fieldString(fields, "value", ""),
  };
  if (title.includes("Event")) {
    runtime.events[target] = state;
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

function slugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
