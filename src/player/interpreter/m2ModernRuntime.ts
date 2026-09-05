import type { M2CommandFields, Project } from "@/project/types";
import type { M2RuntimeState, PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { nextSessionRandom } from "@/project/session";
import { evaluateM2Expression } from "./m2Expression";
import { fieldBoolean, fieldNumber, fieldString } from "./m2RuntimeFields";
import { beginCutsceneControl, endCutsceneControl } from "@/player/cutsceneControl";
import { planScreenEffect } from "./screenEffectPlan";

export function executeModernCommand(
  session: PlaySessionLike,
  runtime: M2RuntimeState,
  title: string,
  fields: M2CommandFields,
  context: { readonly currentEventId?: string } = {}
): boolean {
  switch (title) {
    case "Camera Control":
      runtime.camera.mode = fieldString(fields, "mode", "panTo");
      runtime.camera.target = fieldString(fields, "target", "player");
      runtime.camera.x = fieldNumber(fields, "x", 0);
      runtime.camera.y = fieldNumber(fields, "y", 0);
      runtime.camera.zoom = fieldNumber(fields, "zoom", 1);
      runtime.camera.durationMs = fieldNumber(fields, "durationMs", 300);
      session.flags[`camera:${runtime.camera.mode}`] = true;
      return true;
    case "Screen Effect":
      return applyScreenEffect(session, runtime, fields);
    case "Spawn Event":
      recordSpawnEvent(session, runtime, fields);
      return true;
    case "Remove Event":
      recordRemoveEvent(session, runtime, fields, context);
      return true;
    case "Pathfind Move":
      runtime.pathfinding.push({
        target: fieldString(fields, "target", "this-event"),
        x: fieldNumber(fields, "x", 0),
        y: fieldNumber(fields, "y", 0),
        speed: fieldNumber(fields, "speed", 4),
        wait: fieldBoolean(fields, "wait", true),
      });
      return true;
    case "Wait Until":
      recordWaitUntil(session, runtime, fields);
      return true;
    case "Region Trigger":
      recordRegionTrigger(session, runtime, fields);
      return true;
    case "Quest Objective":
      recordQuestObjective(session, runtime, fields);
      return true;
    case "Advanced Dialogue":
      runtime.dialogue.push({
        speaker: fieldString(fields, "speaker", ""),
        portraitId: fieldString(fields, "portraitId", ""),
        emotion: fieldString(fields, "emotion", "neutral"),
        body: fieldString(fields, "body", ""),
        autoAdvance: fieldBoolean(fields, "autoAdvance", false),
      });
      return true;
    case "Sound Layer":
      recordSoundLayer(session, runtime, fields);
      return true;
    case "Weighted Branch":
      recordWeightedBranch(session, runtime, fields);
      return true;
    case "Cutscene Control":
      recordCutsceneControl(session, runtime, fields);
      return true;
    case "Checkpoint Save":
      recordCheckpoint(session, runtime, fields);
      return true;
    case "UI Command":
      recordUiCommand(session, runtime, fields);
      return true;
    case "Debug Log":
      runtime.debug.push({ level: fieldString(fields, "level", "info"), message: fieldString(fields, "message", "") });
      session.flags[`debug:${fieldString(fields, "level", "info")}`] = true;
      return true;
    case "Evaluate Expression":
      recordExpression(session, runtime, fields);
      return true;
    case "Data Query":
      recordDataQuery(session, fields);
      return true;
    default:
      return false;
  }
}

function recordWaitUntil(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const waitState = {
    condition: fieldString(fields, "condition", "switchOn"),
    target: fieldString(fields, "target", ""),
    value: fieldString(fields, "value", ""),
    timeoutMs: fieldNumber(fields, "timeoutMs", 0),
  };
  runtime.waits.push(waitState);
  session.flags[`m2-wait:${waitState.condition}:${waitState.target}`] = waitConditionMet(session, waitState);
}

export function waitConditionMet(
  session: PlaySessionLike,
  waitState: { readonly condition: string; readonly target: string; readonly value: string },
  context: { project?: Project; isEventIdle?: (target: string) => boolean } = {}
): boolean {
  if (waitState.condition === "switchOn") return session.switches[waitState.target] === true;
  if (waitState.condition === "switchOff") return session.switches[waitState.target] !== true;
  if (waitState.condition === "variable") return String(session.variables[waitState.target] ?? 0) === waitState.value;
  if (waitState.condition === "eventIdle") return context.isEventIdle?.(waitState.target) ?? false;
  if (waitState.condition === "region") {
    const region = context.project?.maps[session.currentMapId]?.layoutPlan?.regions.find(r => r.id === waitState.target);
    return !!region && session.x >= region.x && session.x < region.x + region.w && session.y >= region.y && session.y < region.y + region.h;
  }
  return false;
}

function recordSoundLayer(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const channel = fieldString(fields, "channel", "bgm");
  const layer = {
    resourceId: fieldString(fields, "resourceId", ""),
    volume: fieldNumber(fields, "volume", 100),
    fadeMs: fieldNumber(fields, "fadeMs", 0),
  };
  runtime.audio[channel] = layer;
  session.audio ??= {};
  session.audio[channel] = { resourceId: layer.resourceId, loop: channel === "bgm" || channel === "bgs" || channel === "ambient" };
}

function recordCutsceneControl(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const action = fieldString(fields, "action", "lockPlayer");
  const enabled = fieldBoolean(fields, "enabled", true);
  runtime.cutscene[action] = enabled;
  session.flags[`cutscene:${action}`] = enabled;
  if (action === "lockPlayer") {
    if (enabled) beginCutsceneControl(session, undefined, fieldBoolean(fields, "skippable", false));
    else endCutsceneControl(session);
  }
}

function recordCheckpoint(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const checkpoint = {
    slotId: fieldString(fields, "slotId", "auto"),
    label: fieldString(fields, "label", ""),
    restoreOnGameOver: fieldBoolean(fields, "restoreOnGameOver", true),
  };
  runtime.checkpoints.push(checkpoint);
  session.flags[`checkpoint:${checkpoint.slotId}`] = true;
}

function recordUiCommand(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const command = {
    surface: fieldString(fields, "surface", "toast"),
    message: fieldString(fields, "message", ""),
    durationMs: fieldNumber(fields, "durationMs", 1600),
  };
  runtime.ui.push(command);
  session.flags[`ui:${command.surface}`] = command.message.length > 0;
}

/**
 * `Screen Effect` 를 실제 렌더 경로에 얹는다.
 *
 * 지속형(tint/fade)·날씨는 여기서 `runtime.screen` 에 반영하면 기존 렌더러가 집어간다.
 * 일회형 flash 는 카메라 API 를 태워야 해서 상태만 기록하고, 블로킹 StepResult 는
 * commandCatalog 가 발행한다(구식 Flash Screen 과 같은 2단 구조).
 *
 * @returns 처리했으면 true. **false 를 돌리면** 호출부 체인이 계속 흘러 recordFallback 에
 *   닿는다 — 렌더러 없는 옵션(blur)을 조용히 삼키지 않고 기록으로 남기기 위한 경로다.
 */
function applyScreenEffect(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): boolean {
  const effect = fieldString(fields, "effect", "fadeIn");
  const value = fieldString(fields, "value", "");
  const durationMs = fieldNumber(fields, "durationMs", 300);

  // 기존 계약 유지: 상태 조회기·증거 스펙이 이 큐와 플래그를 읽는다.
  runtime.screenEffects.push({ effect, value, durationMs });
  session.flags[`screen-effect:${effect}`] = true;

  const plan = planScreenEffect(effect, value, durationMs);
  switch (plan.kind) {
    case "tint":
      if (plan.unhide) runtime.screen.hidden = false;
      runtime.screen.tint = plan.tint;
      runtime.screen.tintDurationMs = plan.tintDurationMs;
      return true;
    case "flash": {
      // Fade/tint already paint a sized overlay on .play-stage. Reuse that path so
      // Test Play screenshots see pixels change (dedicated flash nodes were 0×0).
      runtime.screen.flash = plan.color;
      runtime.screen.flashUntilMs = (typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()) + Math.max(400, plan.durationMs);
      const named = plan.color.trim() || "white";
      runtime.screen.tint = named === "white" ? "255,255,255,0.85" : named;
      runtime.screen.tintDurationMs = 0;
      runtime.screen.hidden = false;
      return true;
    }
    case "weather":
      runtime.screen.weather = plan.weather;
      return true;
    case "unsupported":
      return false;
  }
}

function recordSpawnEvent(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const templateEventId = fieldString(fields, "templateEventId", fieldString(fields, "prefabId", ""));
  const eventId = fieldString(fields, "eventId", templateEventId ? `${templateEventId}_spawn` : "spawned-event");
  const mapId = fieldString(fields, "mapId", session.currentMapId) || session.currentMapId;
  const templateMapId = fieldString(fields, "templateMapId", fieldString(fields, "sourceMapId", session.currentMapId)) || session.currentMapId;
  const x = fieldNumber(fields, "x", 0);
  const y = fieldNumber(fields, "y", 0);
  runtime.events[eventId] = { ...(runtime.events[eventId] ?? {}), prefabId: templateEventId, mapId, x, y };
  session.spawnedEvents ??= {};
  session.spawnedEvents[eventId] = { templateMapId, templateEventId, mapId, x, y };
  session.eventLocations ??= {};
  session.eventLocations[eventId] = { mapId, x, y };
}

function recordRemoveEvent(
  session: PlaySessionLike,
  runtime: M2RuntimeState,
  fields: M2CommandFields,
  context: { readonly currentEventId?: string }
): void {
  const eventId = fieldString(fields, "eventId", context.currentEventId ?? "");
  if (!eventId) return;
  const spawned = session.spawnedEvents?.[eventId];
  const mapId = spawned?.mapId ?? (fieldString(fields, "mapId", session.currentMapId) || session.currentMapId);
  runtime.events[eventId] = { ...(runtime.events[eventId] ?? {}), removed: true };
  if (spawned) {
    delete session.spawnedEvents?.[eventId];
  } else {
    session.removedEventIds ??= {};
    const removed = new Set(session.removedEventIds[mapId] ?? []);
    removed.add(eventId);
    session.removedEventIds[mapId] = [...removed];
  }
  delete session.eventLocations?.[eventId];
  session.flags[`event-removed:${eventId}`] = true;
}

function recordRegionTrigger(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const region = {
    regionId: fieldString(fields, "regionId", ""),
    eventId: fieldString(fields, "eventId", ""),
    action: fieldString(fields, "action", "enter"),
    switchId: fieldString(fields, "switchId", ""),
  };
  runtime.regions.push(region);
  if (region.switchId) session.switches[region.switchId] = region.action !== "exit";
}

function recordQuestObjective(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const questId = fieldString(fields, "questId", "quest");
  const objectiveId = fieldString(fields, "objectiveId", "objective");
  const state = fieldString(fields, "state", "start");
  runtime.quests[questId] ??= {};
  runtime.quests[questId][objectiveId] = { state, text: fieldString(fields, "text", "") };
  session.flags[`quest:${questId}:${objectiveId}:${state}`] = true;
}

function recordWeightedBranch(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const variableId = fieldString(fields, "resultVariableId", "");
  const table = fieldString(fields, "table", "");
  const selectedIndex = selectWeightedIndex(session, table);
  runtime.session.weightedBranch = { table, resultVariableId: variableId };
  if (variableId) session.variables[variableId] = selectedIndex;
}

function selectWeightedIndex(session: PlaySessionLike, table: string): number {
  const weights = table
    .split(/\r?\n/)
    .map((line) => Number(line.split("=").at(1) ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (weights.length === 0) return 0;
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = nextSessionRandom(session, "misc") * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return index;
  }
  return weights.length - 1;
}

function recordExpression(session: PlaySessionLike, runtime: M2RuntimeState, fields: M2CommandFields): void {
  const resultVariableId = fieldString(fields, "resultVariableId", "");
  const expression = fieldString(fields, "expression", "");
  runtime.expressions.push({ expression, resultVariableId, evaluated: true });
  if (resultVariableId) session.variables[resultVariableId] = evaluateM2Expression(expression, session);
}

function recordDataQuery(session: PlaySessionLike, fields: M2CommandFields): void {
  const variableId = fieldString(fields, "variableId", "");
  if (!variableId) return;
  switch (fieldString(fields, "query", "gold")) {
    case "gold":
      session.variables[variableId] = session.gold;
      return;
    case "playerX":
      session.variables[variableId] = session.x;
      return;
    case "playerY":
      session.variables[variableId] = session.y;
      return;
    case "switch":
      session.variables[variableId] = session.switches[fieldString(fields, "target", "")] ? 1 : 0;
      return;
    case "variable":
      session.variables[variableId] = session.variables[fieldString(fields, "target", "")] ?? 0;
      return;
    case "itemCount":
      session.variables[variableId] = session.inventory[fieldString(fields, "target", "")] ?? 0;
      return;
    default:
      session.variables[variableId] = 0;
  }
}
