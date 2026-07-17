import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import type { Command, CommonEvent, MoveCommand } from "@/project/types";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { commerceOverlayText } from "@/player/playSceneCommerce";
import type { AutonomousMover, PlaySceneContext, ParallelProcess } from "@/player/playSceneTypes";
import { assertNever } from "@/player/playSceneTypes";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
import { applyTimerStep, updateRuntimeTimers } from "@/player/playSceneTimers";
import { runtimeEventViewsForMap } from "@/player/runtimeEventState";
import { applyCameraControl } from "@/player/playSceneCamera";
import { releaseCutsceneControlForOwner } from "@/player/cutsceneControl";
import { applyLightingStep } from "@/player/playSceneLighting";
import { playMapAnimation } from "@/player/playSceneMapAnimations";
import { applyWeatherStep } from "@/player/playSceneWeather";
import { applyAdvanceTimeStep, applySetTimeStep } from "@/player/playSceneTime";

type AutonomousMoverSceneContext = Pick<PlaySceneContext, "map" | "autonomousNPCs" | "eventPositions" | "session">;

export function registerAutonomousMover(
  scene: AutonomousMoverSceneContext,
  eventId: string,
  moves: MoveCommand[],
  repeat: boolean,
  timing?: Pick<AutonomousMover, "moveDurationMs" | "moveIntervalMs" | "strategy">
): void {
  const project = store.getCurrent();
  if (!runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions).some((event) => event.event.id === eventId)) {
    console.warn(`[player] moveEvent target event missing: ${eventId}`);
    return;
  }
  scene.autonomousNPCs.set(eventId, {
    moves,
    step: 0,
    timer: 0,
    repeat,
    strategy: timing?.strategy ?? "sequence",
    facing: "down",
    directionFix: false,
    through: false,
    animationEnabled: true,
    opacity: 255,
    speedRank: 3,
    frequencyRank: 3,
    moveDurationMs: timing?.moveDurationMs ?? npcMoveDurationMs(3),
    moveIntervalMs: timing?.moveIntervalMs ?? npcMoveIntervalMs(3),
    activeMove: null,
  });
}

export function updateParallelEvents(scene: PlaySceneContext, deltaMs: number): void {
  const activeEvents = scene.activeRuntimeEvents("parallel");
  const activeCommonEvents = activeParallelCommonEvents(scene);
  const activeKeys = new Set([
    ...activeEvents.map((event) => `${event.event.id}:${event.pageId ?? "legacy"}`),
    ...activeCommonEvents.map((event) => `common:${event.id}`),
  ]);
  for (const key of scene.parallelProcesses.keys()) {
    if (!activeKeys.has(key)) scene.parallelProcesses.delete(key);
  }
  for (const event of activeEvents) {
    const pageId = event.pageId ?? "legacy";
    const key = `${event.event.id}:${pageId}`;
    const process = scene.parallelProcesses.get(key) ?? createParallelProcess(scene, event, pageId);
    if (process.waitMs > 0) {
      process.waitMs = Math.max(0, process.waitMs - deltaMs);
      if (process.waitMs > 0) continue;
    }
    const result = process.started ? process.interpreter.resume(undefined) : process.interpreter.start();
    process.started = true;
    consumeParallelSteps(scene, key, process, result);
  }
  for (const commonEvent of activeCommonEvents) {
    const key = `common:${commonEvent.id}`;
    const process = scene.parallelProcesses.get(key) ?? createCommonParallelProcess(scene, commonEvent);
    if (process.waitMs > 0) {
      process.waitMs = Math.max(0, process.waitMs - deltaMs);
      if (process.waitMs > 0) continue;
    }
    const result = process.started ? process.interpreter.resume(undefined) : process.interpreter.start();
    process.started = true;
    consumeParallelSteps(scene, key, process, result);
  }
}

function activeParallelCommonEvents(scene: PlaySceneContext): CommonEvent[] {
  const project = store.getCurrent();
  return project.commonEvents.filter((event) => {
    if (event.trigger !== "parallel") return false;
    if (!event.conditionSwitchId) return true;
    return scene.session.switches[event.conditionSwitchId] === true;
  });
}

function createParallelProcess(
  scene: PlaySceneContext,
  event: { event: { id: string; commands: Command[] }; page?: { commands: Command[] } },
  pageId: string
): ParallelProcess {
  const process = {
    pageId,
    currentEventId: event.event.id,
    interpreter: createInterpreter(event.page?.commands ?? event.event.commands, scene.session, store.getCurrent(), {
      currentEventId: event.event.id,
    }),
    waitMs: 0,
    started: false,
  };
  scene.parallelProcesses.set(`${event.event.id}:${pageId}`, process);
  return process;
}

function createCommonParallelProcess(scene: PlaySceneContext, event: CommonEvent): ParallelProcess {
  scene.session.commonEvents = store.getCurrent().commonEvents;
  const project = store.getCurrent();
  const process = {
    pageId: event.id,
    interpreter: createInterpreter(event.commands, scene.session, project),
    waitMs: 0,
    started: false,
  };
  scene.parallelProcesses.set(`common:${event.id}`, process);
  return process;
}

function consumeParallelSteps(
  scene: PlaySceneContext,
  key: string,
  process: ParallelProcess,
  firstResult: StepResult
): void {
  let result = firstResult;
  let guard = 0;
  while (result.kind !== "done" && guard < 16) {
    guard += 1;
    if (result.kind === "wait") {
      process.waitMs = result.ms;
      return;
    }
    if (applyNonBlockingStep(scene, result, process.currentEventId)) {
      result = process.interpreter.resume(undefined);
      scene.refreshRuntimeSurfaces();
      continue;
    }
    // 병렬 이벤트는 블로킹 사용자 대기(text/inputWait/inputNumber/choices/화면효과)를
    // 가질 수 없다. RM2K3 동작과 일관되게 이 명령들을 건너뛴다(영구 hang 방지).
    if (isParallelBlockingStep(result)) {
      console.warn(`[player] 병렬 이벤트 ${process.currentEventId ?? "?"}의 블로킹 명령(${result.kind})을 건너뜁니다`);
      result = process.interpreter.skip();
      scene.refreshRuntimeSurfaces();
      continue;
    }
    process.waitMs = 100;
    return;
  }
  if (result.kind === "done") {
    releaseCutsceneControlForOwner(scene.session, process.currentEventId);
    scene.parallelProcesses.delete(key);
  }
}

export function applyNonBlockingStep(scene: PlaySceneContext, step: StepResult, currentEventId?: string): boolean {
  switch (step.kind) {
    case "changeTile":
      scene.applyChangeTileStep(step);
      return true;
    case "setEventGraphicPattern":
      applyEventGraphicPatternStep(scene, step, currentEventId);
      return true;
    case "moveEvent":
      scene.registerAutonomousMover(step.eventId || currentEventId || "", step.moves, step.repeat);
      scene.commandMoveRouteEventIds.add(step.eventId || currentEventId || "");
      return true;
    case "eraseEvent":
      eraseRuntimeEvent(scene, step.eventId || currentEventId);
      return true;
    case "stopAllMovement":
      stopCommandMovement(scene);
      return true;
    case "transfer":
      void scene.transferTo(step);
      return true;
    case "battleProcessing":
      scene.showBattleScene(step.troopId);
      return true;
    case "timer":
      applyTimerStep(scene, step);
      return true;
    case "advanceTime":
      void applyAdvanceTimeStep(scene, step);
      return true;
    case "setTime":
      applySetTimeStep(scene, step);
      return true;
    case "sleepUntilMorning":
      void scene.sleepUntilMorning();
      return true;
    case "showPicture":
      showPictureState(scene.session, step);
      scene.showRuntimeOverlay("picture-overlay", resourceDisplayName(step.resourceId, step.pictureId || step.resourceId));
      return true;
    case "erasePicture":
      erasePictureState(scene.session, step.pictureId);
      scene.clearRuntimeOverlay("picture-overlay");
      return true;
    case "playAudio":
      setAudioState(scene.session, step);
      playAudioCommand(step, store.getCurrent());
      scene.showRuntimeOverlay("audio-indicator", resourceDisplayName(step.resourceId, step.resourceId || "오디오"));
      return true;
    case "stopAudio":
      clearAudioState(scene.session);
      stopAudioCommand();
      scene.clearRuntimeOverlay("audio-indicator");
      return true;
    case "scrollMap":
      void scene.panScreen({ ...step, wait: false });
      return true;
    case "cameraControl":
      void applyCameraControl(scene, { ...step, wait: false });
      return true;
    case "setLighting":
      void applyLightingStep(scene, step);
      return true;
    case "setWeather":
      applyWeatherStep(scene, step);
      return true;
    case "showAnimation":
      void playMapAnimation(scene, { ...step, wait: false }, currentEventId);
      return true;
    case "spawnEvent":
      removeRuntimeEventSurfaces(scene, step.eventId);
      return true;
    case "removeEvent":
      removeRuntimeEventSurfaces(scene, step.eventId);
      return true;
    case "openChest":
      scene.showRuntimeOverlay("chest-scene", "보관 상자");
      return true;
    case "shop":
      scene.showRuntimeOverlay("shop-scene", commerceOverlayText(step));
      return true;
    case "inn":
      scene.showRuntimeOverlay("inn-scene", commerceOverlayText(step));
      return true;
    case "gameOver":
      scene.showGameOverScreen(step.message);
      return true;
    case "returnToTitle":
      scene.returnToTitle();
      return true;
    case "done":
    case "text":
    case "choices":
    case "wait":
    case "waitForAllMovement":
    case "inputWait":
    case "inputNumber":
    case "enterHeroName":
    case "flashScreen":
    case "shakeScreen":
      return false;
    default:
      return assertNever(step);
  }
}

// 병렬 이벤트가 처리할 수 없는(사용자 대기/일회성 화면효과) 단계인지.
// 이들은 consumeParallelSteps 에서 skip 대상이 된다. wait/done 읔 제외.
function isParallelBlockingStep(step: StepResult): boolean {
  return (
    step.kind === "text" ||
    step.kind === "choices" ||
    step.kind === "inputWait" ||
    step.kind === "inputNumber" ||
    step.kind === "enterHeroName" ||
    step.kind === "waitForAllMovement" ||
    step.kind === "flashScreen" ||
    step.kind === "shakeScreen"
  );
}

function eraseRuntimeEvent(scene: PlaySceneContext, eventId: string | undefined): void {
  if (!eventId) return;
  scene.session.erasedEventIds = [...new Set([...(scene.session.erasedEventIds ?? []), eventId])];
  removeRuntimeEventSurfaces(scene, eventId);
}

function removeRuntimeEventSurfaces(scene: PlaySceneContext, eventId: string | undefined): void {
  if (!eventId) return;
  scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.delete(eventId);
  scene.pageMoveRouteEventIds.delete(eventId);
  scene.eventSprites.get(eventId)?.destroy();
  scene.eventSprites.delete(eventId);
}

function applyEventGraphicPatternStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "setEventGraphicPattern" }>,
  currentEventId: string | undefined
): void {
  const eventId = step.eventId || currentEventId;
  if (!eventId) return;
  scene.eventGraphicPatternOverrides.set(eventId, step.pattern);
  scene.eventSprites.get(eventId)?.setFrame(step.pattern);
  scene.syncRuntimeState();
}

function stopCommandMovement(scene: PlaySceneContext): void {
  for (const eventId of scene.commandMoveRouteEventIds) scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.clear();
  scene.playerRoute = null;
}

export function updateTimers(scene: PlaySceneContext, deltaMs: number): void {
  updateRuntimeTimers(scene, deltaMs);
}
