import { applySpriteLookStep, playParticleEffect } from "@/player/playSceneFieldStaging";
import { queueScheduledBattle, resumeScheduledBattle } from "./scheduledBattle";
import { isRuntimeEventIdle } from "@/player/runtimeConditionWait";
import { showSceneEmote } from "@/player/playSceneEmotes";
import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import { dialogueHost } from "@/player/playSceneDom";
import { setEventSpritePattern } from "@/player/eventSpriteResources";
import { playAudioCommand, stopAudioChannel, stopAudioCommand } from "@/player/audio";
import type { Command, CommonEvent, MoveCommand } from "@/project/types";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { commerceOverlayText } from "@/player/playSceneCommerce";
import type { AutonomousMover, PlaySceneContext, ParallelProcess } from "@/player/playSceneTypes";
import { assertNever } from "@/player/playSceneTypes";
import { tryBoardVehicle, tryGetOffVehicle } from "@/player/playSceneVehicles";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { clampNpcSetting, npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
import { applyTimerStep, updateRuntimeTimers } from "@/player/playSceneTimers";
import { runtimeEventViewById } from "@/project/runtimeEventState"
import { applyCameraControl } from "@/player/playSceneCamera";
import { releaseCutsceneControlForOwner } from "@/player/cutsceneControl";
import { applyLightingStep } from "@/player/playSceneLighting";
import { playMapAnimation } from "@/player/playSceneMapAnimations";
import { playPathfindMove } from "@/player/playScenePathfinding";
import { playMovieOverlay } from "@/player/playSceneMovies";
import { applyWeatherStep } from "@/player/playSceneWeather";
import { applyEventRelocationStep } from "@/player/playSceneMapCommands";
import { reportEndingClear } from "@/player/playSceneOverlays";
import { applyAdvanceTimeStep, applySetTimeStep, observeScheduledTimeTransition } from "@/player/playSceneTime";

type AutonomousMoverSceneContext = Pick<PlaySceneContext, "map" | "autonomousNPCs" | "eventPositions" | "session">;

export function registerAutonomousMover(
  scene: AutonomousMoverSceneContext,
  eventId: string,
  moves: MoveCommand[],
  repeat: boolean,
  timing?: Pick<AutonomousMover, "moveDurationMs" | "moveIntervalMs" | "strategy">
): void {
  const project = store.getCurrent();
  const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
  if (!view) {
    console.warn(`[player] moveEvent target event missing: ${eventId}`);
    return;
  }
  const speed = clampNpcSetting(view.movement.speed);
  const frequency = clampNpcSetting(view.movement.frequency);
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
    speedRank: speed,
    frequencyRank: frequency,
    moveDurationMs: timing?.moveDurationMs ?? npcMoveDurationMs(speed),
    moveIntervalMs: timing?.moveIntervalMs ?? npcMoveIntervalMs(frequency),
    activeMove: null,
  });
}

export function updateParallelEvents(scene: PlaySceneContext, deltaMs: number): void {
  const terminalOpen = () => Boolean(dialogueHost(scene)?.querySelector('[data-testid="game-over-screen"], [data-testid="ending-screen"]'));
  if (terminalOpen()) return;
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
    if (terminalOpen()) return;
    const pageId = event.pageId ?? "legacy";
    const key = `${event.event.id}:${pageId}`;
    const process = scene.parallelProcesses.get(key) ?? createParallelProcess(scene, event, pageId);
    if (process.stopped || process.pendingTimeTransition) continue;
    if (process.pendingBattle) { resumeScheduledBattle(scene, key, process, consumeParallelSteps); continue; }
    if (process.waitMs > 0) {
      process.waitMs = Math.max(0, process.waitMs - deltaMs);
      if (process.waitMs > 0) continue;
    }
    const result = takeParallelResult(process);
    consumeParallelSteps(scene, key, process, result);
  }
  for (const commonEvent of activeCommonEvents) {
    if (terminalOpen()) return;
    const key = `common:${commonEvent.id}`;
    const process = scene.parallelProcesses.get(key) ?? createCommonParallelProcess(scene, commonEvent);
    if (process.stopped || process.pendingTimeTransition) continue;
    if (process.pendingBattle) { resumeScheduledBattle(scene, key, process, consumeParallelSteps); continue; }
    if (process.waitMs > 0) {
      process.waitMs = Math.max(0, process.waitMs - deltaMs);
      if (process.waitMs > 0) continue;
    }
    const result = takeParallelResult(process);
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
      getEventPositions: () => scene.eventPositions,
      isEventIdle: target => isRuntimeEventIdle(scene, target),
      onFactionStanceChanged: () => invalidateFactionRetargetCache(scene),
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
    interpreter: createInterpreter(event.commands, scene.session, project, {
      getEventPositions: () => scene.eventPositions,
      isEventIdle: target => isRuntimeEventIdle(scene, target),
      onFactionStanceChanged: () => invalidateFactionRetargetCache(scene),
    }),
    waitMs: 0,
    started: false,
  };
  scene.parallelProcesses.set(`common:${event.id}`, process);
  return process;
}

/** 지난 프레임에 상한으로 남긴 결과가 있으면 그것, 없으면 다음 단계. */
function takeParallelResult(process: ParallelProcess): StepResult {
  const pending = process.pendingResult;
  if (pending) {
    process.pendingResult = undefined;
    return pending;
  }
  const result = process.started ? process.interpreter.resume(undefined) : process.interpreter.start();
  process.started = true;
  return result;
}

function invalidateFactionRetargetCache(scene: PlaySceneContext): void {
  for (const combatant of scene.actionCombatState?.enemies.values() ?? []) combatant.retargetMs = 0;
}

function consumeParallelSteps(
  scene: PlaySceneContext,
  key: string,
  process: ParallelProcess,
  firstResult: StepResult
): void {
  // 한 번의 소비에서 비블로킹 명령이 여러 개 이어지면 예전에는 명령마다 refreshRuntimeSurfaces
  // (이벤트 스프라이트 전부 파괴·재생성 + 타일 서명 해시 + 이동 경로 등록 + 자동 트리거 검색)를
  // 불렀다. 병렬 하나당 한 프레임에 최대 16번이다. 표면은 소비가 끝날 때 한 번만 맞추면 된다 —
  // 중간 상태는 어차피 같은 프레임 안이라 화면에 그려지지 않는다.
  let surfacesDirty = false;
  const flushSurfaces = (): void => {
    if (!surfacesDirty) return;
    surfacesDirty = false;
    scene.refreshRuntimeSurfaces();
  };
  // Async parallel work may settle after another event has opened the terminal.
  if (dialogueHost(scene)?.querySelector('[data-testid="game-over-screen"], [data-testid="ending-screen"]')) return;
  let result = firstResult;
  let guard = 0;
  while (result.kind !== "done" && guard < 16) {
    guard += 1;
    if (result.kind === "wait") {
      flushSurfaces();
      process.waitMs = result.ms;
      return;
    }
    if (result.kind === "battleProcessing") {
      flushSurfaces();
      queueScheduledBattle(scene, key, process, result, consumeParallelSteps);
      return;
    }
    if (result.kind === "pathfindMove") {
      flushSurfaces();
      const step = result;
      const move = playPathfindMove(scene, step, process.currentEventId);
      const pending = move.then(() => true);
      if (step.wait) {
        process.pendingTimeTransition = pending;
        void move.then((outcome) => {
          if (scene.parallelProcesses.get(key) !== process) return;
          process.pendingTimeTransition = undefined;
          if (dialogueHost(scene)?.querySelector('[data-testid="game-over-screen"], [data-testid="ending-screen"]')) {
            process.stopped = true;
            return;
          }
          // 병렬 이벤트도 「실패하면 중단」을 지킨다. 안 그러면 전경 명령과 같은
          // 저작이 병렬에서만 조용히 계속 돌아 다른 결말이 된다(OPRN-OUT-013).
          if (step.onFailure === "stop" && outcome !== "arrived") {
            releaseCutsceneControlForOwner(scene.session, process.currentEventId);
            scene.parallelProcesses.delete(key);
            scene.refreshRuntimeSurfaces();
            return;
          }
          consumeParallelSteps(scene, key, process, process.interpreter.resume(undefined));
        });
        return;
      }
      result = process.interpreter.resume(undefined);
      continue;
    }
    if (result.kind === "advanceTime" || result.kind === "sleepUntilMorning") {
      flushSurfaces();
      startParallelTimeTransition(scene, key, process, result);
      return;
    }
    if (applyNonBlockingStep(scene, result, process.currentEventId)) {
      result = process.interpreter.resume(undefined);
      surfacesDirty = true;
      continue;
    }
    // 병렬 이벤트는 블로킹 사용자 대기(text/inputWait/inputNumber/choices/화면효과)를
    // 가질 수 없다. RM2K3 동작과 일관되게 이 명령들을 건너뛴다(영구 hang 방지).
    if (isParallelBlockingStep(result)) {
      console.warn(`[player] 병렬 이벤트 ${process.currentEventId ?? "?"}의 블로킹 명령(${result.kind})을 건너뜁니다`);
      result = process.interpreter.skip();
      surfacesDirty = true;
      continue;
    }
    flushSurfaces();
    process.waitMs = 100;
    return;
  }
  flushSurfaces();
  // 상한(16)에 걸려 빠져나왔다. 이 결과는 아직 처리하지 않았다 — 다음 프레임에 이어서 처리한다.
  if (result.kind !== "done") process.pendingResult = result;
  if (result.kind === "done") {
    releaseCutsceneControlForOwner(scene.session, process.currentEventId);
    scene.parallelProcesses.delete(key);
  }
}

function startParallelTimeTransition(
  scene: PlaySceneContext,
  key: string,
  process: ParallelProcess,
  step: Extract<StepResult, { kind: "advanceTime" | "sleepUntilMorning" }>,
): void {
  const pending = step.kind === "advanceTime"
    ? observeScheduledTimeTransition(scene, (onFailurePresented) => applyAdvanceTimeStep(scene, step, onFailurePresented), "scheduled-advance")
    : observeScheduledTimeTransition(
      scene,
      (onFailurePresented) => Promise.resolve().then(() => scene.sleepUntilMorning(onFailurePresented)),
      "scheduled-sleep",
    );
  process.pendingTimeTransition = pending;
  void pending.then((ok) => {
    if (scene.parallelProcesses.get(key) !== process || process.pendingTimeTransition !== pending) return;
    process.pendingTimeTransition = undefined;
    if (dialogueHost(scene)?.querySelector('[data-testid="game-over-screen"], [data-testid="ending-screen"]')) {
      process.stopped = true;
      return;
    }
    if (!ok) {
      process.stopped = true;
      releaseCutsceneControlForOwner(scene.session, process.currentEventId);
      scene.refreshRuntimeSurfaces();
      return;
    }
    const result = process.interpreter.resume(undefined);
    scene.refreshRuntimeSurfaces();
    consumeParallelSteps(scene, key, process, result);
  });
}

export function applyNonBlockingStep(scene: PlaySceneContext, step: StepResult, currentEventId?: string): boolean {
  switch (step.kind) {
    case "changeTile":
      scene.applyChangeTileStep(step);
      return true;
    case "setEventGraphicPattern":
      applyEventGraphicPatternStep(scene, step, currentEventId);
      return true;
    case "pathfindMove":
      void playPathfindMove(scene, step, currentEventId);
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
      return false; // Foreground handoff is awaited by the scheduler, never an overlay-only step.
    case "timer":
      applyTimerStep(scene, step);
      return true;
    case "advanceTime":
      observeScheduledTimeTransition(scene, (onFailurePresented) => applyAdvanceTimeStep(scene, step, onFailurePresented), "scheduled-advance");
      return true;
    case "setTime":
      applySetTimeStep(scene, step);
      return true;
    case "sleepUntilMorning":
      observeScheduledTimeTransition(scene, (onFailurePresented) => scene.sleepUntilMorning(onFailurePresented), "scheduled-sleep");
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
      // 인터프리터 경로와 같은 규칙 — 루프만 배너를 띄운다(원샷 SE 는 화면에 남는다).
      if (step.loop) scene.showRuntimeOverlay("audio-indicator", resourceDisplayName(step.resourceId, step.resourceId || "오디오"));
      return true;
    case "stopAudio":
      clearAudioState(scene.session, step.channel);
      if (step.channel === undefined) stopAudioCommand();
      else stopAudioChannel(step.channel);
      if (step.channel === undefined || step.channel === "bgm" || step.channel === "bgs") scene.clearRuntimeOverlay("audio-indicator");
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
    case "particleEffect":
      void playParticleEffect(scene, step, currentEventId);
      return true;
    case "spriteLook":
      applySpriteLookStep(scene, step, currentEventId);
      return true;
    case "showEmote":
      showSceneEmote(
        scene,
        step.target === "player" ? "player" : step.target.eventId || currentEventId || "",
        step.emote,
        step.durationMs,
      );
      return true;
    case "playMovie":
      void playMovieOverlay(scene, { ...step, wait: false });
      return true;
    case "relocateEvents":
      applyEventRelocationStep(scene, step);
      return true;
    case "vehicle":
      if (step.boarded) tryBoardVehicle(scene);
      else tryGetOffVehicle(scene);
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
    case "openSaveMenu":
    case "openMenuScreen":
    case "openLoadMenu":
      return false;
    case "spawnFieldEnemy":
      return true;
    case "despawnFieldEnemy":
      return true;
    case "tacticsBattle":
      // 격자 전투는 플레이어 입력을 쥐는 화면이다 — 병렬 이벤트는 isParallelBlockingStep 으로 건너뛴다.
      return false;
    case "shop":
      scene.showRuntimeOverlay("shop-scene", commerceOverlayText(step));
      return true;
    case "inn":
      scene.showRuntimeOverlay("inn-scene", commerceOverlayText(step));
      return true;
    case "gameOver":
      scene.showGameOverScreen(step.message, step.gameOverId);
      return true;
    case "returnToTitle":
      reportEndingClear(scene, step.clear);
      if (step.title !== undefined || step.message !== undefined || step.presentation) scene.showEndingScreen(step.title ?? "", step.message ?? "", step.presentation);
      else scene.returnToTitle();
      return true;
    case "done":
    case "text":
    case "choices":
    case "presentItem":
    case "wait":
    case "waitForAllMovement":
    case "inputWait":
    case "inputNumber":
    case "enterHeroName":
    case "timedChoice":
    case "quickTimeEvent":
    case "teleportMenu":
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
    step.kind === "openSaveMenu" ||
    step.kind === "openMenuScreen" ||
    step.kind === "openLoadMenu" ||
    step.kind === "text" ||
    step.kind === "choices" ||
    step.kind === "presentItem" ||
    step.kind === "tacticsBattle" ||
    step.kind === "inputWait" ||
    step.kind === "inputNumber" ||
    step.kind === "enterHeroName" ||
    step.kind === "timedChoice" ||
    step.kind === "quickTimeEvent" ||
    step.kind === "teleportMenu" ||
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
  setEventSpritePattern(store.getCurrent(), scene.eventSprites.get(eventId), step.pattern);
  scene.syncRuntimeState();
}

function stopCommandMovement(scene: PlaySceneContext): void {
  for (const eventId of scene.commandMoveRouteEventIds) scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.clear();
  scene.playerRoute = null;
  scene.playerSlide = null;
  scene.playerSlideKind = null;
}

export function updateTimers(scene: PlaySceneContext, deltaMs: number): void {
  updateRuntimeTimers(scene, deltaMs);
}
