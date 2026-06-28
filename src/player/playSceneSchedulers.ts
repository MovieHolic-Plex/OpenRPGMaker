import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import type { Command, CommonEvent, MoveCommand } from "@/project/types";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { commerceOverlayText } from "@/player/playSceneCommerce";
import type { AutonomousMover, PlaySceneContext, ParallelProcess } from "@/player/playSceneTypes";
import { assertNever } from "@/player/playSceneTypes";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";

type AutonomousMoverSceneContext = Pick<PlaySceneContext, "map" | "autonomousNPCs">;

export function registerAutonomousMover(
  scene: AutonomousMoverSceneContext,
  eventId: string,
  moves: MoveCommand[],
  repeat: boolean,
  timing?: Pick<AutonomousMover, "moveDurationMs" | "moveIntervalMs" | "strategy">
): void {
  if (!scene.map.events.some((event) => event.id === eventId)) {
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
    interpreter: createInterpreter(event.page?.commands ?? event.event.commands, scene.session, store.getCurrent()),
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
    process.waitMs = 100;
    return;
  }
  if (result.kind === "done") scene.parallelProcesses.delete(key);
}

export function applyNonBlockingStep(scene: PlaySceneContext, step: StepResult, currentEventId?: string): boolean {
  switch (step.kind) {
    case "changeTile":
      scene.applyChangeTileStep(step);
      return true;
    case "moveEvent":
      scene.registerAutonomousMover(step.eventId || currentEventId || "", step.moves, step.repeat);
      return true;
    case "transfer":
      scene.transferTo(step.mapId, step.x, step.y);
      return true;
    case "battleProcessing":
      scene.showBattleScene(step.troopId);
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
      scene.showRuntimeOverlay("audio-indicator", resourceDisplayName(step.resourceId, step.resourceId || "오디오"));
      return true;
    case "stopAudio":
      clearAudioState(scene.session);
      scene.clearRuntimeOverlay("audio-indicator");
      return true;
    case "shop":
      scene.showRuntimeOverlay("shop-scene", commerceOverlayText(step));
      return true;
    case "inn":
      scene.showRuntimeOverlay("inn-scene", commerceOverlayText(step));
      return true;
    case "gameOver":
      scene.showGameOverScreen();
      return true;
    case "returnToTitle":
      scene.returnToTitle();
      return true;
    case "done":
    case "text":
    case "choices":
    case "wait":
    case "inputWait":
    case "inputNumber":
      return false;
    default:
      return assertNever(step);
  }
}

export function updateTimers(scene: PlaySceneContext, deltaMs: number): void {
  for (const timer of scene.runtimeTimers.values()) {
    if (!timer.active) continue;
    timer.remaining = Math.max(0, timer.remaining - deltaMs / 1000);
    if (timer.remaining === 0) timer.active = false;
  }
  for (const [id, seconds] of Object.entries(scene.session.timers)) {
    if (!scene.runtimeTimers.has(id)) {
      scene.runtimeTimers.set(id, { remaining: seconds, active: true });
    }
  }
}
