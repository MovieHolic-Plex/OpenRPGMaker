import { applyHighScore, applyKeyPoll, quickTimeStep, teleportMenuStep, timedChoiceStep } from "./minigameCommands";
import { isGalleryEnabled, recordGalleryUnlock } from "@/project/gallery";
import { NEW_GAME_PLUS_FLAG } from "@/project/newGamePlus";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import {
  adjustEffectiveFactionStance,
  setEffectiveFactionStance,
} from "@/project/factionRuntime";
import { resolveFactionTable } from "@/project/factions";
import type { Command, EndingDef, GameEvent, M2CommandFields, SwitchValue } from "@/project/types";

import { clampEmoteDurationMs } from "@/project/emotes";
import { craftRecipe } from "@/project/craftRecipes";
import { applyItemUpgrade } from "@/project/upgrades";
import { setEquippedTool } from "@/project/toolActions";
import { changeLifeSkillXp } from "@/project/lifeSkillProgress";
import { friendshipKey, changeFriendship, changeGold, changeItem, changeParty, DEFAULT_MESSAGE_WINDOW_SETTINGS, evalCondition, getFriendship, getSwitch, changeActorSkill, nextSessionRandom, setSwitch, setTimer, setVariable, type ConditionEvalContext, type PlaySession } from "@/project/session";
import type { SocialHost } from "@/project/socialKey";
import { promoteActor } from "@/project/sessionClass";
import { changeActorEquipment, changeActorExperience, changeActorLevel, changeActorVital, recoverAll } from "@/project/sessionActorCommands";
import { syncActorVitals } from "@/project/sessionVitals";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import {
  coordinateFailurePolicy,
  coordinateFallbackPolicy,
  describeDestinationFailure,
  movementResultSwitchId,
  movementResultVariableId,
  resolveDestination,
} from "@/project/eventCommands/coordinateDestination";
import { movementResultLogText, recordMovementResult } from "@/player/movementResult";
import { resolveEventPage } from "@/project/io";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { CommandExecution, Frame, InterpreterState, PendingStep, StepResult } from "@/player/interpreter/types";
import { breakLoop, gotoLabel, pushFrame, pushLoopFrame } from "@/player/interpreter/stack";
import { presentableItems } from "@/player/interpreter/presentItem";
import { executeM2RuntimeCommand, relocateM2Events } from "@/player/interpreter/m2Runtime";
import { fieldBoolean, fieldNumber, fieldString } from "@/player/interpreter/m2RuntimeFields";
import { recordSoundLayer, waitConditionMet } from "@/player/interpreter/m2ModernRuntime";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import type { RuntimeCameraTarget } from "@/project/sessionRuntimeTypes"
import { beginCutsceneControl, endCutsceneControl } from "@/player/cutsceneControl";
import { saveSessionCheckpoint } from "@/player/checkpoints";
import { compileCutscene, CutsceneValidationError, withoutEndingBeats, type CutsceneBeat } from "@/editor/cutscene";
import { addFollowerToSession, removeFollowerFromSession, syncPartyFollowers } from "@/project/followers";
import { addSessionLight, removeSessionLight, setSessionLighting } from "@/project/lightingRules";
import { normalizeWeatherParams, parseWeather, weatherToRuntimeString } from "@/player/weather/weatherModel";
import { evolveMonster, giveMonster, moveMonster } from "@/project/monsterCollection";
import { advanceFarmPlotsForDay } from "@/player/farming";
import { resolvePricedShopStock } from "@/project/shopPrice";
import {
  advanceRoguelikeRunFloor,
  endRoguelikeRun,
  resetRoguelikeRunRoom,
  setRoguelikeRunFlag,
  startRoguelikeRun,
} from "@/project/roguelikeRun";
import { roguelikeRoomId } from "@/project/roguelikeRooms";

import { setRelationshipState } from "@/project/relationshipState";
function pause(pending: PendingStep, step: Exclude<StepResult, { kind: "done" }>): CommandExecution {
  return { kind: "pause", pending, step };
}

function resumeNext(frame: Frame): CommandExecution {
  frame.pc += 1;
  return { kind: "continue" };
}

function callCommonEvent(state: InterpreterState, frame: Frame, commonEventId: string): CommandExecution {
  // 플레이 씬은 세션에 공용 이벤트를 실어 두지만(playSceneInterpreter), 헤드리스 경로(run_scene_test·qa:game 자동 플레이)는
  // 세션만 만들고 싣지 않아 모든 callCommonEvent 가 「공통 이벤트 없음」으로 조용히 건너뛰어졌다 — 프로젝트 정의로 폴백한다.
  const commonEvent = (state.session.commonEvents ?? state.project?.commonEvents)?.find((entry) => entry.id === commonEventId);
  if (commonEvent?.commands.length) {
    if (pushFrame(state, commonEvent.commands)) return { kind: "continue" };
    console.warn("[interpreter] common event recursion limit");
  } else {
    state.onUnverified?.(`Unsupported missing common event: ${commonEventId}`);
    console.warn(`[interpreter] 공통 이벤트 없음: ${commonEventId}`);
  }
  return resumeNext(frame);
}

// 맵 이벤트 호출: 현재 맵의 eventId 이벤트를 찾아 활성 페이지의 commands 를 실행한다.
// 페이지가 없는 레거시 이벤트는 최상위 commands 로 폴백한다(RM2K3 "Call Event" 동작).
function callMapEvent(state: InterpreterState, frame: Frame, eventId: string): CommandExecution {
  const map = state.project?.maps[state.session.currentMapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!event) {
    console.warn(`[interpreter] 맵 이벤트 없음: ${eventId}`);
    return resumeNext(frame);
  }
  const page = event.pages?.length ? resolveEventPage(event, state.session, { locations: map?.locations }) : undefined;
  const commands = page?.commands ?? event.commands;
  if (commands.length) {
    if (pushFrame(state, commands)) return { kind: "continue" };
    console.warn("[interpreter] map event recursion limit");
  }
  return resumeNext(frame);
}

function executeM2Command(
  state: InterpreterState,
  frame: Frame,
  command: Extract<Command, { kind: "m2Command" }>
): CommandExecution {
  const entry = m2CommandById(command.commandId);
  if (!entry) {
    console.warn(`[interpreter] M2 command is unclassified: ${command.commandId}`);
    return resumeNext(frame);
  }
  const m2Context = { currentEventId: state.currentEventId, project: state.project, eventPositions: state.eventPositions };

  if (entry.existingKind === "displayTextSettings") {
    // Legacy commands may omit these optional settings; omission is not a malformed command.
    const fields = { ...DEFAULT_MESSAGE_WINDOW_SETTINGS, ...command.fields };
    const format = fieldString(fields, "format", DEFAULT_MESSAGE_WINDOW_SETTINGS.format);
    const position = fieldString(fields, "position", DEFAULT_MESSAGE_WINDOW_SETTINGS.position);
    state.session.messageWindowSettings = {
      format: format === "transparent" ? format : "normal",
      position: position === "top" || position === "center" ? position : "bottom",
      preventObscuringPlayer: fieldBoolean(fields, "preventObscuringPlayer", DEFAULT_MESSAGE_WINDOW_SETTINGS.preventObscuringPlayer),
      allowEventMovementDuringWait: fieldBoolean(fields, "allowEventMovementDuringWait", DEFAULT_MESSAGE_WINDOW_SETTINGS.allowEventMovementDuringWait),
    };
    return resumeNext(frame);
  }

  // 명작 공백 #1·#24 — 미니게임 키트와 순간이동 메뉴.
  if (entry.title === "Key Poll") {
    applyKeyPoll(state.session, command.fields);
    return resumeNext(frame);
  }
  if (entry.title === "High Score") {
    applyHighScore(state.session, command.fields);
    return resumeNext(frame);
  }
  if (entry.title === "Timed Choice") return pause("timedChoice", timedChoiceStep(command.fields));
  if (entry.title === "Quick Time Event") return pause("quickTimeEvent", quickTimeStep(command.fields));
  if (entry.title === "Teleport Menu") {
    const step = teleportMenuStep(state.session, command.fields, state.project?.maps ?? {});
    if (step === "forbidden") {
      const resultVariableId = fieldString(command.fields, "resultVariableId", "");
      if (resultVariableId) state.session.variables[resultVariableId] = -1;
      return resumeNext(frame);
    }
    return pause("teleportMenu", step);
  }

  if (entry.title === "Camera Control" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("cameraControl", cameraControlStep(command.fields, state.currentEventId));
  }

  if (entry.title === "Set Event Location" || entry.title === "Swap Event Location") {
    const eventIds = relocateM2Events(state.session, entry.title, command.fields, m2Context);
    return eventIds.length ? pause("relocateEvents", { kind: "relocateEvents", eventIds }) : resumeNext(frame);
  }

  if (entry.title === "Get On/Off Vehicle" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("vehicle", { kind: "vehicle", boarded: ensureM2Runtime(state.session).system["vehicle_boarded"] === true });
  }

  if (entry.title === "Spawn Event" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("spawnEvent", { kind: "spawnEvent", eventId: spawnEventId(command.fields) });
  }

  if (entry.title === "Remove Event" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("removeEvent", { kind: "removeEvent", eventId: removeEventId(command.fields, state.currentEventId) });
  }

  if (entry.title === "Move Picture" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    const pictureId = fieldString(command.fields, "pictureId", "pic1");
    const picture = state.session.pictures?.[pictureId];
    if (picture && shouldWaitForPicture(command.fields)) {
      return pause("showPicture", { kind: "showPicture", ...picture, waitForPicture: true });
    }
    return resumeNext(frame);
  }

  if (entry.title === "Advanced Dialogue" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    // 레거시 m2-209: 문장 표시(text) 와 동일 경로로 통합. autoAdvance/emotion 전달.
    return pause("text", {
      kind: "text",
      speaker: fieldString(command.fields, "speaker", "") || undefined,
      body: fieldString(command.fields, "body", ""),
      face: state.currentFace,
      settings: state.session.messageWindowSettings,
      autoAdvance: fieldBoolean(command.fields, "autoAdvance", false),
      emotion: fieldString(command.fields, "emotion", "neutral") || undefined,
    });
  }

  if (entry.title === "Sound Layer") {
    const audio = recordSoundLayer(state.session, ensureM2Runtime(state.session), command.fields);
    return pause("playAudio", { kind: "playAudio", ...audio });
  }

  if (entry.title === "Fadeout BGM") return pause("stopAudio", { kind: "stopAudio", channel: "bgm" });

  if (entry.title === "Play Memorized BGM" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    const memorized = state.session.m2Runtime?.audio?.playedMemorizedBgm;
    if (typeof memorized === "string" && memorized.length > 0) {
      return pause("playAudio", { kind: "playAudio", resourceId: memorized, loop: true, channel: "bgm" });
    }
    return resumeNext(frame);
  }

  if (entry.title === "Wait Until") {
    // Record once, then re-evaluate after each short wait (including parallel processes).
    if (!state.waitUntil) executeM2RuntimeCommand(state.session, entry, { ...command, fields: { condition: "switchOn", target: "", value: "", timeoutMs: 0, ...command.fields } }, m2Context);
    const condition = fieldString(command.fields, "condition", "switchOn");
    const target = fieldString(command.fields, "target", "");
    const met = waitConditionMet(state.session, { condition, target, value: command.fields.value === undefined ? "" : fieldString(command.fields, "value", "") }, {
      project: state.project,
      isEventIdle: target => state.isEventIdle?.(!target || target === "this-event" ? state.currentEventId ?? "" : target) ?? false,
    });
    state.session.flags[`m2-wait:${condition}:${target}`] = met;
    const timeout = Math.max(0, fieldNumber(command.fields, "timeoutMs", 0));
    const elapsed = state.waitUntil?.elapsedMs ?? 0;
    if (met || (timeout > 0 && elapsed >= timeout)) {
      state.waitUntil = undefined;
      return resumeNext(frame);
    }
    const ms = timeout > 0 ? Math.min(50, timeout - elapsed) : 50;
    state.waitUntil = { elapsedMs: elapsed, intervalMs: ms };
    return pause("waitUntil", { kind: "wait", ms, allowParallelEvents: true });
  }

  if (entry.title === "Pathfind Move") {
    executeM2RuntimeCommand(state.session, entry, command, m2Context);
    const resultVariableId = movementResultVariableId(command.fields);
    const resultSwitchId = movementResultSwitchId(command.fields);
    const onFailure = coordinateFailurePolicy(command.fields);
    // 부재 키를 0 으로 메꾸지 않는 원시 조회다. `getVariable` 은 `?? 0` 이므로
    // 「변수 없음」과 「값이 0」을 지운다 — 이 이슈의 원래 결함이 그것이다.
    const destination = resolveDestination(command.fields, (variableId) => state.session.variables[variableId]);
    if (!destination.ok) {
      const detail = describeDestinationFailure(destination);
      console.warn(`[m2] Pathfind Move — ${movementResultLogText("invalidInput", detail)}`);
      state.session.flags.pathfindSucceeded = false;
      recordMovementResult(state.session, { resultVariableId, resultSwitchId }, "invalidInput");
      // 이동 단계를 아예 내지 않는다 — 대기 설정이여도 기다릴 것이 없으므로
      // 목적지가 무효한 대기 명령은 항상 여기에서 종료한다.
      if (onFailure === "stop") return { kind: "done" };
      return resumeNext(frame);
    }
    return pause("pathfindMove", {
      kind: "pathfindMove",
      target: fieldString(command.fields, "target", "this-event"),
      x: destination.x,
      y: destination.y,
      speed: Math.max(1, Math.min(8, fieldNumber(command.fields, "speed", 4))),
      wait: fieldBoolean(command.fields, "wait", true),
      // 기본값은 단계에 싣지 않는다 — 옛 고정 좌표 명령이 내는 단계는 바이트 단위로
      // 이전과 같은 모양이어야 한다(기존 계약 테스트가 toEqual 로 재는 자리다).
      ...(resultVariableId ? { resultVariableId } : {}),
      ...(resultSwitchId ? { resultSwitchId } : {}),
      ...(onFailure === "stop" ? { onFailure } : {}),
      ...(coordinateFallbackPolicy(command.fields) === "nearest" ? { fallback: "nearest" as const } : {}),
    });
  }

  if (entry.title === "Play Movie") {
    return pause("playMovie", {
      kind: "playMovie",
      resourceId: command.fields.resourceId !== undefined
        ? fieldString(command.fields, "resourceId", "") : fieldString(command.fields, "value", ""),
      wait: fieldBoolean(command.fields, "wait", true),
      skippable: fieldBoolean(command.fields, "skippable", true),
    });
  }

  if (entry.title === "End Event Processing") {
    executeM2RuntimeCommand(state.session, entry, command, m2Context);
    return { kind: "done" };
  }

  if (entry.title === "Open Save Menu" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("openSaveMenu", { kind: "openSaveMenu" });
  }
  if (entry.title === "Open Menu Screen" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("openMenuScreen", { kind: "openMenuScreen" });
  }
  if (entry.title === "Open Load Menu" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("openLoadMenu", { kind: "openLoadMenu" });
  }
  if (entry.title === "Exit Game" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("returnToTitle", { kind: "returnToTitle" });
  }
  if (entry.title === "Toggle ATB Wait Mode" || entry.title === "Toggle Fullscreen Mode" || entry.title === "Open Video Options") {
    executeM2RuntimeCommand(state.session, entry, command, m2Context);
    return resumeNext(frame);
  }

  if (entry.title === "Erase Event" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("eraseEvent", { kind: "eraseEvent", eventId: state.currentEventId });
  }

  if (entry.title === "Wait for All Movement" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("waitForAllMovement", { kind: "waitForAllMovement" });
  }

  if (entry.title === "Stop All Movement" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("stopAllMovement", { kind: "stopAllMovement" });
  }

  // 일회성 화면 효과: 상태 기록(executeM2RuntimeCommand) 후 블로킹 pause 로 플레이어에 위임.
  if (entry.title === "Flash Screen" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    const rgb = screenColorToRgb(fieldString(command.fields, "color", "white"));
    return pause("flashScreen", {
      kind: "flashScreen",
      red: rgb.red,
      green: rgb.green,
      blue: rgb.blue,
      durationMs: clampMs(fieldNumber(command.fields, "durationMs", 300)),
    });
  }

  // 모던 Screen Effect 의 flash 옵션도 구식 Flash Screen 과 같은 카메라 경로를 탄다.
  // 지속형(tint/fade)·날씨는 applyScreenEffect 가 runtime.screen 에 반영해 두므로
  // 여기서는 일회형만 블로킹 pause 로 넘긴다.
  if (entry.title === "Screen Effect" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    const plan = planScreenEffect(
      fieldString(command.fields, "effect", "fadeIn"),
      fieldString(command.fields, "value", ""),
      fieldNumber(command.fields, "durationMs", 300)
    );
    if (plan.kind !== "flash") return resumeNext(frame);
    const rgb = screenColorToRgb(plan.color);
    return pause("flashScreen", {
      kind: "flashScreen",
      red: rgb.red,
      green: rgb.green,
      blue: rgb.blue,
      durationMs: clampMs(plan.durationMs),
    });
  }

  if (entry.title === "Shake Screen" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("shakeScreen", {
      kind: "shakeScreen",
      intensity: fieldNumber(command.fields, "intensity", 3),
      durationMs: clampMs(fieldNumber(command.fields, "durationMs", 400)),
    });
  }

  if (entry.title === "Scroll Map" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return pause("scrollMap", {
      kind: "scrollMap",
      direction: scrollDirection(fieldString(command.fields, "direction", fieldString(command.fields, "target", "down"))),
      distanceTiles: Math.max(0, fieldNumber(command.fields, "distance", fieldNumber(command.fields, "value", 0))),
      durationMs: scrollDurationMs(command.fields),
      wait: fieldBoolean(command.fields, "wait", true),
      returnToPlayer: fieldBoolean(command.fields, "return", false) || fieldString(command.fields, "mode", "") === "return",
      lock: fieldBoolean(command.fields, "lock", false) || fieldString(command.fields, "mode", "") === "lock",
    });
  }

  if (entry.title === "Set Weather Effects" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    const weather = parseWeather(state.session.m2Runtime?.screen.weather);
    return pause("setWeather", {
      kind: "setWeather",
      weather: weather.kind,
      intensity: weather.intensity,
      transitionMs: Math.max(0, Math.round(fieldNumber(command.fields, "transitionMs", fieldNumber(command.fields, "durationMs", 0)))),
    });
  }

  if (entry.title === "Checkpoint Save" && executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    saveCheckpoint(state);
    return resumeNext(frame);
  }

  if (executeM2RuntimeCommand(state.session, entry, command, m2Context)) {
    return resumeNext(frame);
  }

  switch (entry.runtimeSupport) {
    case "editor-only":
      console.warn(`[interpreter] M2 editor-only command skipped: ${entry.label}`);
      return resumeNext(frame);
    case "runtime-partial":
      console.warn(`[interpreter] M2 partial runtime command had no map effect: ${entry.label}`);
      return resumeNext(frame);
    case "runtime-full":
      console.warn(`[interpreter] M2 runtime command should use native command kind: ${entry.label}`);
      return resumeNext(frame);
  }
}

function saveCheckpoint(state: InterpreterState): void {
  if (!state.project) {
    console.warn("[interpreter] checkpointSave skipped: project context missing");
    return;
  }
  saveSessionCheckpoint(state.project, state.session as PlaySession);
}

function advanceCommandMinutes(command: Extract<Command, { kind: "advanceTime" }>): number {
  const minutes = Number.isFinite(command.minutes ?? 0) ? command.minutes ?? 0 : 0;
  const hours = Number.isFinite(command.hours ?? 0) ? command.hours ?? 0 : 0;
  return Math.max(0, Math.trunc(minutes + hours * 60));
}

function killParty(state: InterpreterState): void {
  for (const actorId of state.session.partyActorIds) {
    if (state.project) syncActorVitals(state.project, state.session.actorVitals, actorId);
    const vitals = state.session.actorVitals[actorId];
    if (vitals) vitals.hp = 0;
    state.session.actorStateIds ??= {};
    const states = new Set(state.session.actorStateIds[actorId] ?? []);
    states.add("state_death");
    state.session.actorStateIds[actorId] = [...states];
  }
}

// 에필로그 끝에 붙는 합성 ending 명령 → 실제로 본 엔딩 id. 저작된 ending 명령은 클리어가 아니다.
const ENDING_CLEAR_COMMANDS = new WeakMap<Command, string>();

function endingConditionsMet(state: InterpreterState, ending: EndingDef): boolean {
  return ending.conditions.every((condition) => condition.kind === "newGamePlus"
    ? (state.session.flags[NEW_GAME_PLUS_FLAG] === true) === condition.value
    : evalCondition(
      state.session,
      condition,
      resolveSocialHost(state) ?? state.currentEventId,
      locationEvalContext(state),
    ));
}

function triggerEnding(
  state: InterpreterState,
  frame: Frame,
  endingId: string | undefined
): CommandExecution {
  const project = state.project;
  const endings = project?.endings ?? [];
  // 이름 있는 호출도 그 엔딩의 conditions 를 본다. 호감 ≥ 6 을 엔딩에만 적어 두고
  // triggerEnding(endingId) 만 부르면, 예전에는 조건이 무시되어 호감 0에도 고백이 성공했다
  // (2026-09-24 연애 도그푸딩 「골목 라디오의 밤」). 조건이 거짓이면 타이틀로 쫓지 않고 다음 명령으로 넘어간다.
  if (endingId) {
    const named = endings.find((ending) => ending.id === endingId);
    if (named && !endingConditionsMet(state, named)) return resumeNext(frame);
  }
  const ending = project ? selectEnding(endings, state, endingId) : undefined;
  if (!ending) {
    console.warn(`[interpreter] 엔딩을 선택할 수 없습니다: ${endingId ?? "(auto)"}`);
    return pause("returnToTitle", { kind: "returnToTitle", title: "엔딩", message: "조건에 맞는 엔딩이 없습니다." });
  }

  state.session.flags[`ending:${ending.id}`] = true;
  const clear = { endingId: ending.id };
  const finalCommand: Command = { kind: "ending", title: ending.name, message: "", ...(ending.presentation ? { presentation: ending.presentation } : {}) };
  ENDING_CLEAR_COMMANDS.set(finalCommand, ending.id);
  const epilogueCommands = compileEndingEpilogue(state, ending);
  if (epilogueCommands.length > 0 && pushFrame(state, [...epilogueCommands, finalCommand])) {
    return { kind: "continue" };
  }
  return pause("returnToTitle", { kind: "returnToTitle", title: ending.name, message: "", clear, ...(ending.presentation ? { presentation: ending.presentation } : {}) });
}

function selectEnding(
  endings: readonly EndingDef[],
  state: InterpreterState,
  endingId: string | undefined
): EndingDef | undefined {
  if (endingId) return endings.find((ending) => ending.id === endingId);
  return endings
    .filter((ending) => endingConditionsMet(state, ending))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}

function compileEndingEpilogue(state: InterpreterState, ending: EndingDef): Command[] {
  if (!state.project || !ending.epilogue || ending.epilogue.length === 0) return [];
  const eventIds = new Set<string>();
  for (const map of Object.values(state.project.maps)) {
    for (const event of map.events) eventIds.add(event.id);
  }
  try {
    // 에필로그 안에서 엔딩을 다시 부르면 에필로그가 무한 반복된다 — 옛 저장본도 여기서 막는다.
    return compileCutscene(withoutEndingBeats(ending.epilogue as CutsceneBeat[]).beats, {
      resetFace: true,
      context: { eventIds, resourceIds: collectResourceIds(state.project) },
    });
  } catch (cause) {
    if (cause instanceof CutsceneValidationError) {
      console.warn(`[interpreter] 엔딩 에필로그 검증 실패(${ending.id}): ${cause.reasons.join(" / ")}`);
      return [];
    }
    throw cause;
  }
}

export function executeCommand(
  state: InterpreterState,
  frame: Frame,
  command: Command
): CommandExecution {
  state.beforeCommand?.(command);
  switch (command.kind) {
    case "changeFace": {
      if (command.appearanceId !== undefined) {
        const face = state.project ? resolveAppearancePortrait(state.project, command.appearanceId, command.presentation ?? "face") : undefined;
        state.currentFace = face ? { ...face, position: command.position, flipHorizontally: command.flipHorizontally } : undefined;
        return resumeNext(frame);
      }
      state.currentFace = command.resourceId
        ? {
            resourceId: command.resourceId,
            ...(command.presentation ? { presentation: command.presentation } : {}),
            position: command.position,
            flipHorizontally: command.flipHorizontally,
          }
        : undefined;
      return resumeNext(frame);
    }
    case "text":
      return pause("text", {
        kind: "text",
        speaker: command.speaker,
        body: textBodyOf(command),
        face: state.currentFace,
        settings: state.session.messageWindowSettings,
        autoAdvance: command.autoAdvance === true,
        emotion: command.emotion,
        ...(command.style ? { style: command.style } : {}),
        ...(command.context ? { context: command.context } : {}),
        ...(command.container ? { container: command.container } : {}),
        ...(command.voiceResourceId ? { voiceResourceId: command.voiceResourceId } : {}),
      });
    case "choices":
      return pause("choices", {
        kind: "choices",
        prompt: command.prompt,
        options: command.options.slice(0, 5).map((option) => ({ text: option.text })),
        settings: state.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
        cancelBehavior: command.cancelBehavior,
      });
    case "presentItem":
      return pause("presentItem", {
        kind: "presentItem",
        prompt: command.prompt,
        items: presentableItems(state.session, command),
        settings: state.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
      });
    case "fork": {
      const branch = evalCondition(state.session, command.condition, resolveSocialHost(state) ?? state.currentEventId, locationEvalContext(state)) ? command.then : command.else ?? [];
      if (pushFrame(state, branch)) return { kind: "continue" };
      return resumeNext(frame);
    }
    case "setSwitch": {
      const next = resolveSwitchValue(state.session, command.switchId, command.value);
      setSwitch(state.session, command.switchId, next);
      return resumeNext(frame);
    }
    case "setVariable":
      setVariable(
        state.session,
        command.variableId,
        command.op,
        typeof command.value === "number" ? command.value : state.session.variables[command.value.id] ?? 0
      );
      return resumeNext(frame);
    case "timer": {
      const timerId = command.timerId ?? "timer1";
      if (command.action === "set") setTimer(state.session, timerId, command.seconds ?? 0);
      if (command.action === "start" && command.seconds !== undefined) setTimer(state.session, timerId, command.seconds);
      return pause("timer", { kind: "timer", action: command.action, seconds: command.seconds, timerId });
    }
    case "advanceTime":
      return pause("advanceTime", {
        kind: "advanceTime",
        minutes: advanceCommandMinutes(command),
        days: command.days,
      });
    case "advanceCropGrowth":
      if (state.project) advanceFarmPlotsForDay(state.project, state.session as PlaySession, command.days);
      return resumeNext(frame);
    case "setTime":
      return pause("setTime", { kind: "setTime", hour: command.hour, minute: command.minute });
    case "sleepUntilMorning":
      return pause("sleepUntilMorning", { kind: "sleepUntilMorning" });
    case "inputWait":
      return pause("inputWait", { kind: "inputWait", variableId: command.variableId });
    case "inputNumber":
      return pause("inputNumber", {
        kind: "inputNumber",
        variableId: command.variableId,
        digits: command.digits,
        prompt: command.prompt,
        showPad: command.showPad,
        settings: state.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
      });
    case "label":
      return resumeNext(frame);
    case "gotoLabel":
      if (!gotoLabel(state.stack, command.name)) {
        console.warn(`[interpreter] 라벨을 찾을 수 없음: ${command.name}`);
        frame.pc += 1;
      }
      return { kind: "continue" };
    case "loop": {
      frame.pc += 1;
      // 빈 본문이면 한 번의 반복도 의미가 없으므로 건너뛴다.
      if (command.body.length === 0) return { kind: "continue" };
      if (pushLoopFrame(state, command.body, frame.commands, frame.pc - 1)) {
        return { kind: "continue" };
      }
      console.warn("[interpreter] 루프 본문 프레임 push 실패 (스택 한계)");
      return { kind: "continue" };
    }
    case "breakLoop":
      // A malformed break outside a loop is a warned no-op. Advancing the
      // current frame is essential: otherwise the interpreter executes this
      // same command until the global instruction budget is exhausted.
      if (!breakLoop(state)) return resumeNext(frame);
      return { kind: "continue" };
    case "transfer":
      return pause("transfer", { kind: "transfer", mapId: command.mapId, x: command.x, y: command.y, direction: command.direction, fade: command.fade, transition: command.transition });
    case "wait": {
      const ms =
        command.variableId && command.variableId.trim()
          ? Math.max(0, Math.trunc(Number(state.session.variables[command.variableId] ?? 0) || 0))
          : command.ms;
      return pause("wait", { kind: "wait", ms });
    }
    case "changeTile":
      return pause("changeTile", {
        kind: "changeTile",
        mapId: command.mapId,
        layer: command.layer,
        x: command.x,
        y: command.y,
        tile: command.tile,
      });
    case "moveEvent":
      return pause("moveEvent", {
        kind: "moveEvent",
        eventId: command.eventId,
        moves: command.route.moves,
        repeat: command.route.repeat,
        wait: command.route.wait === true,
      });
    case "setEventGraphicPattern":
      return pause("setEventGraphicPattern", {
        kind: "setEventGraphicPattern",
        eventId: command.eventId,
        pattern: command.pattern,
      });
    case "battleProcessing":
      return pause("battleProcessing", {
        kind: "battleProcessing",
        troopId: command.troopId,
        canEscape: command.canEscape,
        canLose: command.canLose,
        battleFlow: command.battleFlow,
        troopSource: command.troopSource,
        troopVariableId: command.troopVariableId,
        branchOnResult: command.branchOnResult,
        // 이 전투를 기동한 맵 이벤트(커먼 이벤트 경유 시에도 호출 원점 이벤트).
        // 트룹 배틀 이벤트의 selfSwitch 조건/setSelfSwitch 커맨드의 소유 이벤트가 된다.
        ownerEventId: state.currentEventId,
      });
    case "showPicture":
      if (command.recordInGallery === true && state.project && isGalleryEnabled(state.project)) {
        recordGalleryUnlock(state.session, command.resourceId);
      }
      return pause("showPicture", {
        kind: "showPicture",
        pictureId: command.pictureId,
        resourceId: command.resourceId,
        x: command.x,
        y: command.y,
        scale: command.scale,
        opacity: command.opacity,
        rotation: command.rotation,
        durationMs: command.durationMs,
        waitForPicture: command.waitForPicture,
      });
    case "erasePicture":
      return pause("erasePicture", { kind: "erasePicture", pictureId: command.pictureId });
    case "playAudio":
      return pause("playAudio", {
        kind: "playAudio",
        resourceId: command.resourceId,
        loop: command.loop,
        ...(command.channel === undefined ? {} : { channel: command.channel }),
        ...(command.fadeInMs === undefined ? {} : { fadeInMs: command.fadeInMs }),
        ...(command.volume === undefined ? {} : { volume: command.volume }),
      });
    case "stopAudio":
      return pause("stopAudio", command.channel === undefined ? { kind: "stopAudio" } : { kind: "stopAudio", channel: command.channel });
    case "cutsceneControl":
      if (command.mode === "begin") beginCutsceneControl(state.session, state.currentEventId, command.skippable === true);
      else endCutsceneControl(state.session);
      return resumeNext(frame);
    case "displayTextSettings": {
      state.session.messageWindowSettings = {
        format: command.format,
        position: command.position,
        preventObscuringPlayer: command.preventObscuringPlayer,
        allowEventMovementDuringWait: command.allowEventMovementDuringWait,
      };
      return resumeNext(frame);
    }
    case "shop":
      return pause("shop", {
        kind: "shop",
        itemIds: command.itemIds,
        items: state.project
          ? resolvePricedShopStock(state.project, state.session, command, resolveCurrentGameEvent(state))
          : undefined,
        allowSell: command.allowSell,
        quantityMode: command.quantityMode,
        shopType: command.shopType,
        shopUiPreset: command.shopUiPreset,
        messageType: command.messageType,
        merchantGold: command.merchantGold,
        branchOnTransaction: command.branchOnTransaction,
        // 아래 필드들이 빠져 있어서 에디터의 「빈 상점 분기」·「추가 서비스」 카드가
        // 저장은 되지만 런타임에 도달하지 않았다(설정해도 게임이 달라지지 않음).
        branchOnFailedTransaction: command.branchOnFailedTransaction,
        shopServiceKind: command.shopServiceKind,
        appraisalUnidentifiedPool: command.appraisalUnidentifiedPool,
        loyaltyTierId: command.loyaltyTierId,
        mileageRate: command.mileageRate,
        investmentLevel: command.investmentLevel,
        restockPolicy: command.restockPolicy,
        economy: command.economy,
        blackMarketFlag: command.blackMarketFlag,
        festivalFlag: command.festivalFlag,
      });

    case "inn": {
      const innPrice = typeof command.price === "number" ? command.price : ((command.price as unknown as { kind?: string; id?: string })?.kind === "var" ? Math.trunc(state.session.variables[(command.price as unknown as { id: string }).id] ?? 0) : 0);
      return pause("inn", {
        kind: "inn",
        price: innPrice,
        note: command.note,
        question: command.question,
        recoverMp: command.recoverMp,
        advanceToMorning: command.advanceToMorning,
        restDurationMs: command.restDurationMs,
        wakeDurationMs: command.wakeDurationMs,
        branchOnNotEnoughGold: command.branchOnNotEnoughGold,
      });
    }
    case "checkpointSave":
      saveCheckpoint(state);
      return resumeNext(frame);
    case "openSaveMenu":
      return pause("openSaveMenu", { kind: "openSaveMenu" });
    case "spawnFieldEnemy":
      return pause("spawnFieldEnemy", { kind: "spawnFieldEnemy", spawn: command.spawn });
    case "despawnFieldEnemy":
      return pause("despawnFieldEnemy", { kind: "despawnFieldEnemy", spawnId: command.spawnId });
    case "runControl": {
      switch (command.action) {
        case "start": {
          const seed = command.seed ?? Math.floor(nextSessionRandom(state.session, "misc") * 0x1_0000_0000);
          startRoguelikeRun(state.session, {
            seed,
            runId: command.runId,
            startFloor: command.startFloor,
          });
          break;
        }
        case "advance":
          advanceRoguelikeRunFloor(state.session, command.amount);
          break;
        case "end":
          endRoguelikeRun(state.session, command.result);
          break;
        case "setFlag":
          setRoguelikeRunFlag(state.session, command.flag, command.value);
          break;
        case "resetRoom":
          {
            const map = state.project?.maps[state.session.currentMapId];
            resetRoguelikeRunRoom(state.session, command.roomId ?? (map ? roguelikeRoomId(map) : state.session.currentMapId));
          }
          break;
      }
      return resumeNext(frame);
    }
    case "killPlayer":
      killParty(state);
      return pause("gameOver", { kind: "gameOver", message: command.message, ...(command.gameOverId ? { gameOverId: command.gameOverId } : {}) });
    case "triggerEnding":
      return triggerEnding(state, frame, command.endingId);
    case "gameOver":
      return pause("gameOver", { kind: "gameOver", ...(command.gameOverId ? { gameOverId: command.gameOverId } : {}) });
    case "ending": {
      const clearedEndingId = ENDING_CLEAR_COMMANDS.get(command);
      return pause("returnToTitle", {
        kind: "returnToTitle",
        title: command.title,
        message: command.message,
        ...(clearedEndingId ? { clear: { endingId: clearedEndingId } } : {}),
        ...(command.presentation ? { presentation: command.presentation } : {}),
      });
    }
    case "returnToTitle":
      return pause("returnToTitle", { kind: "returnToTitle" });
    case "callCommonEvent":
      return callCommonEvent(state, frame, command.commonEventId);
    case "callMapEvent":
      return callMapEvent(state, frame, command.eventId);
    case "learnSkill":
      changeActorSkill(state.session, command.actorId, command.skillId, command.action ?? "learn");
      return resumeNext(frame);
    case "changeExp":
      changeActorExperience(state.session, command);
      return resumeNext(frame);
    case "changeLevel":
      changeActorLevel(state.session, command);
      return resumeNext(frame);
    case "changeLifeSkillExp": {
      if (state.project) {
        const amount = typeof command.amount === "number"
          ? command.amount
          : state.session.variables[command.amount.id] ?? 0;
        changeLifeSkillXp(state.project, state.session as PlaySession, command.skillId, command.op, amount);
      }
      return resumeNext(frame);
    }
    case "promoteActor": {
      const result = state.project
        ? promoteActor(state.session, state.project, command.actorId, command.toClassId || undefined)
        : { ok: false as const, actorId: command.actorId, reason: "project-not-available" };
      state.session.flags.promoteActorSuccess = result.ok;
      const branch = result.ok ? command.successBranch : command.failureBranch;
      if (branch?.length && pushFrame(state, branch)) return { kind: "continue" };
      return resumeNext(frame);
    }
    case "changeEquipment":
      if (state.project) changeActorEquipment(state.session, state.project, command);
      return resumeNext(frame);
    case "changeActorHp":
    case "changeActorMp":
      changeActorVital(state.session, command);
      return resumeNext(frame);
    case "recoverAll":
      recoverAll(state.session, command.actorId, state.project);
      return resumeNext(frame);
    case "enterHeroName": {
      const actor = state.project?.database.actors.find((record) => record.id === command.actorId);
      const textTarget = command.stringVariableId;
      return pause("enterHeroName", {
        kind: "enterHeroName",
        actorId: command.actorId,
        maxLength: command.maxLength,
        showInitialName: command.showInitialName,
        currentName: textTarget ? (state.session.stringVariables?.[textTarget] ?? "") : (actor?.name ?? ""),
        ...(command.prompt ? { prompt: command.prompt } : {}),
      });
    }
    case "changeGold": {
      const amount = typeof command.amount === "number"
        ? command.amount
        : state.session.variables[command.amount.id] ?? 0;
      changeGold(state.session, command.op, amount);
      return resumeNext(frame);
    }
    case "changeItem": {
      const amount = typeof command.amount === "number"
        ? command.amount
        : state.session.variables[command.amount.id] ?? 0;
      changeItem(state.session, command.itemId, command.op, amount);
      return resumeNext(frame);
    }
    case "craftRecipe": {
      const result = state.project && craftRecipe(state.project, state.session as PlaySession, command.recipeId);
      if (command.resultVariableId !== undefined) setVariable(state.session, command.resultVariableId, "=", result?.ok ? 1 : 0);
      return resumeNext(frame);
    }
    case "applyItemUpgrade": {
      const result = state.project && applyItemUpgrade(state.project, state.session as PlaySession, command.upgradeId);
      if (command.resultVariableId !== undefined) setVariable(state.session, command.resultVariableId, "=", result?.ok ? 1 : 0);
      return resumeNext(frame);
    }
    case "equipTool":
      setEquippedTool(state.session as PlaySession, command.itemId);
      return resumeNext(frame);
    case "openChest": {
      const chestId = (command.chestId ?? "").trim() || resolveOpenChestId(state);
      const {
        displayName, template, layout, showIcons, capacity, allowBulk, allowSort,
        showCategories, goldVault, lockSwitchId, lockItemId, allowedItemTypes,
      } = command;
      return pause("openChest", {
        kind: "openChest",
        chestId,
        ...(displayName ? { displayName } : {}),
        ...(template ? { template } : {}),
        ...(layout ? { layout } : {}),
        ...(showIcons !== undefined ? { showIcons } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
        ...(allowBulk !== undefined ? { allowBulk } : {}),
        ...(allowSort !== undefined ? { allowSort } : {}),
        ...(showCategories !== undefined ? { showCategories } : {}),
        ...(goldVault !== undefined ? { goldVault } : {}),
        ...(lockSwitchId ? { lockSwitchId } : {}),
        ...(lockItemId ? { lockItemId } : {}),
        ...(allowedItemTypes && allowedItemTypes.length > 0 ? { allowedItemTypes } : {}),
      });
    }
    case "changeFriendship":
      changeFriendship(state.session, command.npcKey, command.delta, resolveSocialHost(state));
      return resumeNext(frame);
    case "setRelationship": {
      const npcKey = friendshipKey(command.npcKey, resolveSocialHost(state));
      if (npcKey) setRelationshipState(state.session, npcKey, command.state);
      return resumeNext(frame);
    }
    case "changeFactionStance": {
      if (!state.project) return resumeNext(frame);
      const table = resolveFactionTable(state.project.factions);
      const delta = command.op === "-=" ? -command.value : command.value;
      const next = command.op === "="
        ? setEffectiveFactionStance(table, state.session.factionStanceOverrides, command.a, command.b, command.value)
        : adjustEffectiveFactionStance(table, state.session.factionStanceOverrides, command.a, command.b, delta);
      state.session.factionStanceOverrides ??= {};
      for (const key of Object.keys(state.session.factionStanceOverrides)) delete state.session.factionStanceOverrides[key];
      Object.assign(state.session.factionStanceOverrides, next);
      state.onFactionStanceChanged?.();
      return resumeNext(frame);
    }
    case "getFriendship":
      setVariable(state.session, command.variableId, "=", getFriendship(state.session, command.npcKey, resolveSocialHost(state)));
      return resumeNext(frame);
    case "changeParty":
      changeParty(state.session, command.actorId, command.action, state.project);
      if (state.project) syncPartyFollowers(state.project, state.session as PlaySession);
      return resumeNext(frame);
    case "giveMonster":
      if (state.project) giveMonster(state.project, state.session as PlaySession, command);
      return resumeNext(frame);
    case "moveMonster":
      if (state.project) moveMonster(state.session as PlaySession, command.instanceId, command.to, state.project);
      else moveMonster(state.session as PlaySession, command.instanceId, command.to);
      return resumeNext(frame);
    case "evolveMonster": {
      const result = state.project
        ? evolveMonster(state.project, state.session as PlaySession, { instanceId: command.instanceId, toSpeciesId: command.toSpeciesId, allowItemEvolution: true })
        : { ok: false as const };
      state.session.flags.evolveMonsterSuccess = result.ok;
      const branch = result.ok ? command.successBranch : command.failureBranch;
      if (branch?.length && pushFrame(state, branch)) return { kind: "continue" };
      return resumeNext(frame);
    }
    case "addFollower":
      if (state.project) addFollowerToSession(state.project, state.session as PlaySession, command);
      return resumeNext(frame);
    case "removeFollower":
      removeFollowerFromSession(state.session as PlaySession, command);
      return resumeNext(frame);
    case "setLighting": {
      const transitionMs = Math.max(0, Math.round(command.transitionMs ?? 0));
      if (transitionMs > 0) {
        return pause("setLighting", {
          kind: "setLighting",
          ambient: command.ambient,
          color: command.color,
          transitionMs,
        });
      }
      setSessionLighting(state.session, command);
      return resumeNext(frame);
    }
    case "addLight":
      addSessionLight(state.session, command.source);
      return resumeNext(frame);
    case "removeLight":
      removeSessionLight(state.session, command);
      return resumeNext(frame);
    case "setWeather": {
      const weather = normalizeWeatherParams({ kind: command.weather, intensity: command.intensity });
      ensureM2Runtime(state.session).screen.weather = weatherToRuntimeString(weather);
      return pause("setWeather", {
        kind: "setWeather",
        weather: weather.kind,
        intensity: weather.intensity,
        transitionMs: Math.max(0, Math.round(command.transitionMs ?? 0)),
      });
    }
    case "showAnimation":
      return pause("showAnimation", {
        kind: "showAnimation",
        target: command.target,
        animationId: command.animationId,
        wait: command.wait === true,
      });
    case "showEmote":
      return pause("showEmote", {
        kind: "showEmote",
        target: command.target,
        emote: command.emote,
        durationMs: clampEmoteDurationMs(command.durationMs),
      });
    case "playMovie":
      return pause("playMovie", {
        kind: "playMovie",
        resourceId: command.resourceId,
        wait: command.wait !== false,
        skippable: command.skippable !== false,
      });
    case "setFlag":
      state.session.flags[command.flag] = command.value;
      return resumeNext(frame);
    case "setSelfSwitch": {
      const eventId = state.currentEventId;
      if (eventId) {
        state.session.selfSwitches ??= {};
        state.session.selfSwitches[eventId] ??= {};
        state.session.selfSwitches[eventId][command.key] = command.value;
      }
      return resumeNext(frame);
    }
    case "m2Command":
      return executeM2Command(state, frame, command);
    default:
      console.warn("[interpreter] 알 수 없는 command kind, 이벤트 중단");
      return { kind: "done" };
  }
}

const SCREEN_COLOR_RGB: Record<string, { red: number; green: number; blue: number }> = {
  white: { red: 255, green: 255, blue: 255 },
  red: { red: 255, green: 0, blue: 0 },
  green: { red: 0, green: 255, blue: 0 },
  blue: { red: 0, green: 0, blue: 255 },
  yellow: { red: 255, green: 255, blue: 0 },
  purple: { red: 180, green: 0, blue: 255 },
  black: { red: 0, green: 0, blue: 0 },
  neutral: { red: 200, green: 200, blue: 200 },
};

// 이름으로 지원하는 화면 색인가. 에디터가 "이 값을 알아볼 수 있는가"를 런타임과
// 같은 목록으로 판단하려면 필요하다(screenColorToRgb 는 모를 경우 조용하게 흰색으로 돌린다).
export function isScreenColorName(color: string): boolean {
  return Object.hasOwn(SCREEN_COLOR_RGB, color);
}

// 화면 효과 색상 문자열(white/red/.../neutral 또는 #rrggbb)을 RGB 로 변환한다.
export function screenColorToRgb(color: string): { red: number; green: number; blue: number } {
  const named = SCREEN_COLOR_RGB[color];
  if (named) return named;
  const hexMatch = color.match(/^#?([0-9a-f]{6})$/i);
  if (hexMatch) {
    const value = parseInt(hexMatch[1] ?? "", 16);
    return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
  }
  return SCREEN_COLOR_RGB.white;
}

// 화면 효과 지속시간을 안전한 범위(50ms~5000ms)로 묶는다.
export function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 300;
  return Math.max(50, Math.min(5000, Math.round(ms)));
}

function scrollDirection(value: string): "down" | "left" | "right" | "up" {
  switch (value) {
    case "left":
    case "right":
    case "up":
    case "down":
      return value;
    default:
      return "down";
  }
}

function scrollDurationMs(fields: M2CommandFields): number {
  const explicit = fieldNumber(fields, "durationMs", fieldNumber(fields, "duration", 0));
  if (explicit > 0) return clampMs(explicit);
  const distance = Math.max(0, fieldNumber(fields, "distance", fieldNumber(fields, "value", 0)));
  const speed = Math.max(1, Math.min(6, fieldNumber(fields, "speed", 4)));
  return clampMs(distance * (700 - speed * 80));
}

function cameraControlStep(
  fields: M2CommandFields,
  currentEventId: string | undefined
): Extract<StepResult, { kind: "cameraControl" }> {
  const mode = cameraControlMode(fieldString(fields, "mode", "panTo"));
  return {
    kind: "cameraControl",
    mode,
    target: cameraTarget(fields, currentEventId, mode),
    durationMs: cameraDurationMs(fieldNumber(fields, "durationMs", fieldNumber(fields, "duration", 300))),
    wait: fieldBoolean(fields, "wait", true),
    returnToPlayer: mode === "return" || fieldBoolean(fields, "return", false),
    offsetX: optionalNumberField(fields, "offsetX"),
    offsetY: optionalNumberField(fields, "offsetY"),
    zoom: optionalNumberField(fields, "zoom"),
  };
}

function cameraControlMode(value: string): Extract<StepResult, { kind: "cameraControl" }>["mode"] {
  switch (value) {
    case "follow":
      return "follow";
    case "lock":
    case "fixed":
      return "fixed";
    case "return":
    case "restore":
    case "followPlayer":
      return "return";
    case "panTo":
    case "pan":
    case "zoom":
    default:
      return "pan";
  }
}

function cameraTarget(
  fields: M2CommandFields,
  currentEventId: string | undefined,
  mode: Extract<StepResult, { kind: "cameraControl" }>["mode"]
): RuntimeCameraTarget {
  if (mode === "return") return { kind: "player" };
  const target = fieldString(fields, "target", "player");
  const x = fieldNumber(fields, "x", 0);
  const y = fieldNumber(fields, "y", 0);
  if (usesCoordinateTarget(fields, target, mode, x, y)) return { kind: "position", x, y };
  const eventId = explicitCameraEventId(fields, target, currentEventId);
  if (eventId) return { kind: "event", eventId };
  return { kind: "player" };
}

function usesCoordinateTarget(
  fields: M2CommandFields,
  target: string,
  mode: Extract<StepResult, { kind: "cameraControl" }>["mode"],
  x: number,
  y: number
): boolean {
  if (target === "screen" || target === "position" || target === "fixed") return true;
  return mode === "pan" && (x !== 0 || y !== 0) && !hasM2Field(fields, "targetEventId") && !hasM2Field(fields, "eventId");
}

function explicitCameraEventId(
  fields: M2CommandFields,
  target: string,
  currentEventId: string | undefined
): string {
  const fieldEventId = fieldString(fields, "targetEventId", fieldString(fields, "eventId", ""));
  if (fieldEventId) return fieldEventId;
  if (target === "this-event") return currentEventId ?? "";
  if (target.startsWith("event:")) return target.slice("event:".length);
  if (target && target !== "player" && target !== "screen" && target !== "position" && target !== "fixed") return target;
  return "";
}

function cameraDurationMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(60_000, Math.round(value));
}

function optionalNumberField(fields: M2CommandFields, key: string): number | undefined {
  return hasM2Field(fields, key) ? fieldNumber(fields, key, 0) : undefined;
}

function shouldWaitForPicture(fields: M2CommandFields): boolean {
  return fieldBoolean(fields, "waitForPicture", fieldBoolean(fields, "wait", false));
}

function spawnEventId(fields: M2CommandFields): string {
  const templateEventId = fieldString(fields, "templateEventId", fieldString(fields, "prefabId", ""));
  return fieldString(fields, "eventId", templateEventId ? `${templateEventId}_spawn` : "spawned-event");
}

function removeEventId(fields: M2CommandFields, currentEventId: string | undefined): string {
  return fieldString(fields, "eventId", currentEventId ?? "");
}

function hasM2Field(fields: M2CommandFields, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined;
}
function resolveOpenChestId(state: InterpreterState): string {
  const event = resolveCurrentGameEvent(state);
  const mapId = state.session.currentMapId;
  if (event) {
    const x = Math.trunc(Number(event.x) || 0);
    const y = Math.trunc(Number(event.y) || 0);
    return `chest_${mapId}_${x}_${y}`;
  }
  return `chest_${mapId}_0_0`;
}

/**
 * `insideLocation` 조건이 읽는 명명 로케이션 기하. 항상 **세션의 현재 맵**이 원처다 —
 * 조건은 맵 경계를 넘지 않으므로 맵 복사본은 자기 로케이션을 보게 된다.
 * 프로젝트를 부채로 돌리는 잡트리(단위 테스트 등)에서는 해석 불가 = 거짓이다.
 */
function locationEvalContext(state: InterpreterState): ConditionEvalContext {
  return { map: state.project?.maps[state.session.currentMapId] };
}

function resolveSocialHost(state: InterpreterState): SocialHost | undefined {
  const eventId = state.currentEventId;
  if (!eventId || !state.project) return eventId ? { id: eventId } : undefined;
  for (const map of Object.values(state.project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { id: event.id, characterId: event.characterId };
  }
  // Spawned/runtime-only ids: no characterId available.
  return { id: eventId };
}

function resolveCurrentGameEvent(state: InterpreterState): GameEvent | undefined {
  const eventId = state.currentEventId;
  if (!eventId || !state.project) return undefined;
  for (const map of Object.values(state.project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return event;
  }
  return undefined;
}

function resolveSwitchValue(session: { switches: Record<string, boolean>; variables: Record<string, number> }, switchId: string, value: SwitchValue): boolean {
  if (typeof value === "boolean") return value;
  if (value === "toggle") return !getSwitch(session as any, switchId);
  return (session.variables[value.id] ?? 0) !== 0;
}
