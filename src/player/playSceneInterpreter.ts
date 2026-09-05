import { cancelFurniturePush } from './furniturePushAnimation';
import { friendshipDeltaEmote } from "@/project/emotes";
import { showSceneEmote } from "@/player/playSceneEmotes";
import {
  clearAudioState,
  erasePictureState,
  evalCondition,
  DEFAULT_MESSAGE_WINDOW_SETTINGS,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import { setEventSpritePattern } from "@/player/eventSpriteResources";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { resolveEventPage } from "@/project/io";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { Interpreter } from "@/player/interpreter";
import { playInn, playShop } from "@/player/playSceneCommerce";
import { playOpenChest } from "@/player/playSceneChest";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { showNameEntry } from "@/player/nameEntry/nameEntryOverlay";
import { applyTimerStep } from "@/player/playSceneTimers";
import { startPlayerRoute } from "@/player/playSceneMovement";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { resolvePlayerBody } from "@/project/playerFootprint";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { assertNever } from "@/player/playSceneTypes";
import type { Command } from "@/project/types";
import { characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { abortHop, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { applyCameraControl } from "@/player/playSceneCamera";
import { applyLightingStep } from "@/player/playSceneLighting";
import { playMapAnimation } from "@/player/playSceneMapAnimations";
import { playPathfindMove } from "@/player/playScenePathfinding";
import { conditionWaitScenes, isRuntimeEventIdle } from "@/player/runtimeConditionWait";
import { playMovieOverlay } from "@/player/playSceneMovies";
import { applyWeatherStep } from "@/player/playSceneWeather";
import { runtimeEventViewsForMap, type RuntimeEventView } from "@/project/runtimeEventState"
import {
  CUTSCENE_END_LABEL,
  isCutsceneSkippable,
  releaseCutsceneControlForOwner,
} from "@/player/cutsceneControl";
import { isFieldSpawnEventId } from "@/player/fieldSpawns";
import { isActionCombatSceneActive } from "@/player/playSceneActionCombat";
import { despawnFieldEnemyForScene, runFieldSpawnEventBattle, spawnFieldEnemyForScene } from "@/player/playSceneFieldSpawns";
import { applyBattleDefeat } from "@/player/playSceneDefeat";
import { applyAdvanceTimeStep, applySetTimeStep } from "@/player/playSceneTime";
import { formatFriendshipFeedback, isGiftableEvent, isGiftSystemEnabled, isTalkFriendshipEnabled, trySocialTalk } from "@/project/friendship";
import { playGiftSelection } from "@/player/playSceneGift";

export type RunCommandsOptions = {
  readonly allowNested?: boolean;
};

export async function runEvent(scene: PlaySceneContext, eventId: string): Promise<void> {
  if (scene.running) return;
  if (isFieldSpawnEventId(eventId) && isActionCombatSceneActive(scene)) return;
  if (isFieldSpawnEventId(eventId) && await runFieldSpawnEventBattle(scene, eventId)) return;
  const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .find((entry) => entry.event.id === eventId);
  if (!view) return;
  const event = view.event;
  const page = view.page ?? resolveEventPage(event, scene.session);
  if (!page && event.condition && !evalCondition(scene.session, event.condition)) return;
  const dialogue = dialogueUi(scene);
  if (!dialogue) {
    console.warn("[player] dialogue UI missing");
    return;
  }
  const commands = page?.commands ?? event.commands;
  if (shouldOfferGiftMenu(event, page, store.getCurrent())) {
    const action = await showGiftMenu(scene, event, page?.name);
    if (action === "talk") await runTalkPath(scene, event, commands, eventId);
    if (action === "gift") await runGiftSelection(scene, event);
    return;
  }
  await runTalkPath(scene, event, commands, eventId);
}

async function runGiftSelection(scene: PlaySceneContext, event: CommandSourceEvent): Promise<void> {
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    await playGiftSelection(scene, event);
  } finally {
    scene.running = previousRunning;
    scene.lastActionTargetKey = "";
    scene.setInputEnabled(previousInputEnabled);
    // 대화 세션이 끝나는 자리 — 퇴장 연출을 재생하고 빠진다(transfer 만 하드 컷).
    dialogueUi(scene)?.close();
    scene.refreshRuntimeSurfaces();
  }
}

async function runTalkPath(
  scene: PlaySceneContext,
  event: CommandSourceEvent,
  commands: readonly Command[],
  eventId: string
): Promise<void> {
  await runCommands(scene, commands, eventId);
  // Action-scoped, once per interaction (not gift path; multi-text cannot re-fire).
  if (!isTalkFriendshipEnabled(event)) return;
  const page = resolveEventPage(event, scene.session);
  const trigger = page?.trigger ?? event.trigger;
  if (trigger.kind !== "action") return;
  const result = trySocialTalk(scene.session, event);
  if (!result.ok) return;
  showSceneEmote(scene, event.id, friendshipDeltaEmote(result.delta));
  scene.syncRuntimeState();
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    const feedback = formatFriendshipFeedback({ delta: result.delta, friendship: result.friendship });
    await dialogue.showText({
      speaker: event.pages?.[0]?.name,
      body: feedback,
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
    });
  } finally {
    scene.running = previousRunning;
    scene.lastActionTargetKey = "";
    scene.setInputEnabled(previousInputEnabled);
    dialogue.close();
    scene.refreshRuntimeSurfaces();
  }
}

function shouldOfferGiftMenu(event: CommandSourceEvent, page: RuntimeEventView["page"] | undefined, project: ReturnType<typeof store.getCurrent>): boolean {
  const trigger = page?.trigger ?? event.trigger;
  return trigger.kind === "action" && isGiftSystemEnabled(project) && isGiftableEvent(project, event);
}

type CommandSourceEvent = RuntimeEventView["event"];

async function showGiftMenu(
  scene: PlaySceneContext,
  event: CommandSourceEvent,
  speaker: string | undefined
): Promise<"talk" | "gift" | "cancel"> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return "cancel";
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    const choice = await dialogue.showChoices({
      prompt: speaker ?? event.id,
      options: [{ text: "대화하기" }, { text: "선물하기" }, { text: "취소" }],
      settings: scene.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
      cancelBehavior: "choice3",
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
    });
    if (choice === 1) return "gift";
    if (choice === 0) return "talk";
    return "cancel";
  } finally {
    scene.running = previousRunning;
    scene.setInputEnabled(previousInputEnabled);
  }
}

export async function runCommands(
  scene: PlaySceneContext,
  commands: readonly Command[],
  currentEventId?: string,
  options: RunCommandsOptions = {}
): Promise<void> {
  if (scene.running && options.allowNested !== true) return;
  const dialogue = dialogueUi(scene);
  if (!dialogue) {
    console.warn("[player] dialogue UI missing");
    return;
  }
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  const project = store.getCurrent();
  scene.session.commonEvents = project.commonEvents;
  const interpreter = createInterpreter([...commands], scene.session, project, {
    currentEventId,
    getEventPositions: () => scene.eventPositions,
    isEventIdle: target => isRuntimeEventIdle(scene, target),
    onFactionStanceChanged: () => invalidateFactionRetargetCache(scene),
  });
  const activeSession = scene.session;
  const skipController = createCutsceneSkipController(scene, interpreter);
  try {
    let result = interpreter.start();
    scene.refreshRuntimeSurfaces();
    while (result.kind !== "done" && scene.session === activeSession) {
      if (isCutsceneSkippable(scene.session)) {
        scene.showRuntimeOverlay("cutscene-skip-hint", "Esc Esc: 컷신 건너뛰기");
      }
      result = await consumeBlockingStep(scene, interpreter, result, currentEventId, skipController);
    }
  } finally {
    skipController.dispose();
    releaseCutsceneControlForOwner(activeSession, currentEventId);
    if (scene.session === activeSession) {
      scene.clearRuntimeOverlay("cutscene-skip-hint");
      scene.running = options.allowNested === true ? previousRunning : false;
      scene.lastActionTargetKey = "";
      scene.setInputEnabled(options.allowNested === true ? previousInputEnabled : true);
      dialogue.close();
      scene.refreshRuntimeSurfaces();
    }
  }
}

type CutsceneSkipController = {
  dispose(): void;
  takeResult(): StepResult | null;
  waitForSkip(): Promise<void>;
};

function createCutsceneSkipController(scene: PlaySceneContext, interpreter: Interpreter): CutsceneSkipController {
  let lastEscapeAt = 0;
  let result: StepResult | null = null;
  let waiters: Array<() => void> = [];
  const notify = (): void => {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };
  const requestSkip = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !isCutsceneSkippable(scene.session) || result) return;
    const now = performance.now();
    const secondEscape = now - lastEscapeAt <= 900;
    lastEscapeAt = now;
    if (!secondEscape) return;
    event.preventDefault();
    result = interpreter.jumpToLabel(CUTSCENE_END_LABEL);
    scene.refreshRuntimeSurfaces();
    notify();
  };
  document.addEventListener("keydown", requestSkip);
  return {
    dispose(): void {
      document.removeEventListener("keydown", requestSkip);
      waiters = [];
    },
    takeResult(): StepResult | null {
      const next = result;
      result = null;
      return next;
    },
    waitForSkip(): Promise<void> {
      if (result) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function waitWithCutsceneSkip(ms: number, skipController: CutsceneSkipController): Promise<void> {
  const duration = Math.max(0, Math.round(ms));
  if (duration === 0) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => window.setTimeout(resolve, duration)),
    skipController.waitForSkip(),
  ]);
}

async function consumeBlockingStep(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  step: Exclude<StepResult, { kind: "done" }>,
  currentEventId: string | undefined,
  skipController: CutsceneSkipController
): Promise<StepResult> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return { kind: "done" };
  switch (step.kind) {
    case "text":
      await dialogue.showText({
        speaker: step.speaker,
        body: step.body,
        face: step.face,
        settings: scene.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
        textContext: { session: scene.session, project: store.getCurrent() },
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
        autoAdvance: step.autoAdvance === true,
        emotion: step.emotion,
      });
      {
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    case "choices":
      {
        const choice = await dialogue.showChoices({
          prompt: step.prompt,
          options: step.options,
          settings: step.settings,
          cancelBehavior: step.cancelBehavior,
          textContext: { session: scene.session, project: store.getCurrent() },
          playerTileY: scene.tileY,
          mapHeight: scene.map.height,
        });
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
        return resumeWithChoice(scene, interpreter, choice);
      }
    case "wait":
      if (step.allowParallelEvents) conditionWaitScenes.add(scene);
      try { await waitWithCutsceneSkip(step.ms, skipController); }
      finally { if (step.allowParallelEvents) conditionWaitScenes.delete(scene); }
      {
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    case "inputWait": {
      const keyCode = await waitForKey();
      if (step.variableId) {
        return resumeWithValue(scene, interpreter, keyCode);
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "inputNumber":
      return resumeWithValue(scene, interpreter, await dialogue.showNumberInput({
        digits: step.digits,
        prompt: step.prompt,
        showPad: step.showPad,
        settings: step.settings,
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
      }));
    case "enterHeroName": {
      const host = dialogueHost(scene);
      if (!host) return resumeInterpreter(interpreter);
      const name = await showNameEntry(host, {
        currentName: step.currentName,
        maxLength: step.maxLength,
        showInitialName: step.showInitialName,
      });
      const result = interpreter.resume(name);
      // 액터 이름 변경을 메뉴/전투 표시에 즉시 반영.
      scene.refreshRuntimeSurfaces();
      scene.syncRuntimeState();
      return result;
    }
    case "timer":
      applyTimerStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "advanceTime":
      await applyAdvanceTimeStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "setTime":
      applySetTimeStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "sleepUntilMorning":
      if (!await scene.sleepUntilMorning()) return { kind: "done" };
      return resumeAfterSurface(scene, interpreter);
    case "transfer":
      dialogue.hide();
      await scene.transferTo(step);
      return resumeAfterSurface(scene, interpreter);
    case "changeTile":
      scene.applyChangeTileStep(step);
      return resumeAfterSurface(scene, interpreter);
    case "openSaveMenu":
    case "openMenuScreen":
    case "openLoadMenu": {
      dialogue.hide();
      const session = scene.session;
      const callback: unknown = scene.game.registry.get(step.kind);
      if (typeof callback === "function") await callback();
      return scene.session === session ? resumeInterpreter(interpreter) : { kind: "done" };
    }
    case "spawnFieldEnemy":
      spawnFieldEnemyForScene(scene, step.spawn);
      return resumeAfterSurface(scene, interpreter);
    case "despawnFieldEnemy":
      despawnFieldEnemyForScene(scene, step.spawnId);
      return resumeAfterSurface(scene, interpreter);
    case "setEventGraphicPattern":
      applyEventGraphicPatternStep(scene, step, currentEventId);
      return resumeInterpreter(interpreter);
    case "pathfindMove": {
      const abort = new AbortController();
      const pending = playPathfindMove(scene, step, currentEventId, abort.signal);
      if (step.wait) {
        await Promise.race([pending, skipController.waitForSkip()]);
        const skipped = skipController.takeResult();
        if (skipped) { abort.abort(); return skipped; }
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "moveEvent": {
      const target = resolveMoveEventTarget(step.eventId, currentEventId);
      if (target === PLAYER_MOVE_TARGET) {
        // 주인공 강제 이동: 이벤트 무버가 아니라 플레이어를 한 칸씩 걷게 한다.
        startPlayerRoute(scene, step.moves, step.repeat);
        if (step.wait) {
          await Promise.race([waitForPlayerRouteComplete(scene), skipController.waitForSkip()]);
        }
      } else {
        scene.registerAutonomousMover(target, step.moves, step.repeat);
        scene.commandMoveRouteEventIds.add(target);
        if (step.wait) {
          await Promise.race([waitForMoverComplete(scene, target), skipController.waitForSkip()]);
        }
      }
      {
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "eraseEvent":
      eraseRuntimeEvent(scene, step.eventId ?? currentEventId);
      return resumeAfterSurface(scene, interpreter);
    case "waitForAllMovement": {
      await Promise.race([waitForAllCommandMovement(scene), skipController.waitForSkip()]);
      const skipped = skipController.takeResult();
      if (skipped) return skipped;
      return resumeAfterSurface(scene, interpreter);
    }
    case "stopAllMovement":
      stopCommandMovement(scene);
      return resumeAfterSurface(scene, interpreter);
    case "battleProcessing": {
      const troopId = resolveBattleTroopId(scene, step);
      scene.session.battleResult = await scene.playBattle({ ...step, troopId });
      // canLose=false 패배는 게임 오버다(sceneTestRunner/walkthroughRunner 와 같은 계약).
      // 이벤트를 여기서 끝낸다 — 전멸한 파티로 뒷 커맨드가 이어지면 안 되고, 게임 오버
      // 오버레이의 '다시 시도'(restoreCheckpoint)가 살아 있는 인터프리터와 충돌한다.
      if (scene.session.battleResult === "defeat" && step.canLose !== true) {
        applyBattleDefeat(scene);
        return { kind: "done" };
      }
      return resumeWithValue(scene, interpreter, scene.session.battleResult);
    }
    case "showPicture":
      showPictureState(scene.session, step);
      scene.showRuntimeOverlay("picture-overlay", resourceDisplayName(step.resourceId, step.pictureId || step.resourceId));
      scene.syncRuntimeState();
      if (step.waitForPicture === true) {
        await waitWithCutsceneSkip(step.durationMs ?? 0, skipController);
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeInterpreter(interpreter);
    case "erasePicture":
      erasePictureState(scene.session, step.pictureId);
      scene.clearRuntimeOverlay("picture-overlay");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "playAudio":
      setAudioState(scene.session, step);
      playAudioCommand(step, store.getCurrent());
      // 배너는 "지금 흐르는 곡"을 알리는 장치라 루프(BGM/BGS)만 띄운다. 원샷 SE 까지 띄우면
      // clear 경로가 stopAudio 뿐이라 문 열림 효과음 하나에 리소스 id 가 화면에 박혀 남는다.
      if (step.loop) scene.showRuntimeOverlay("audio-indicator", resourceDisplayName(step.resourceId, step.resourceId || "오디오"));
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "stopAudio":
      clearAudioState(scene.session);
      stopAudioCommand();
      scene.clearRuntimeOverlay("audio-indicator");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "flashScreen":
      await scene.flashScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "shakeScreen":
      await scene.shakeScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "scrollMap":
      await scene.panScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "cameraControl": {
      await Promise.race([applyCameraControl(scene, step), skipController.waitForSkip()]);
      const skipped = skipController.takeResult();
      if (skipped) return skipped;
      return resumeAfterSurface(scene, interpreter);
    }
    case "setLighting":
      await applyLightingStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "setWeather":
      applyWeatherStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "showAnimation": {
      const done = playMapAnimation(scene, step, currentEventId);
      if (step.wait) {
        await Promise.race([done, skipController.waitForSkip()]);
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "showEmote":
      showSceneEmote(
        scene,
        step.target === "player" ? "player" : step.target.eventId || currentEventId || "",
        step.emote,
        step.durationMs,
      );
      return resumeAfterSurface(scene, interpreter);
    case "playMovie": {
      const played = playMovieOverlay(scene, step);
      if (step.wait) {
        await Promise.race([played, skipController.waitForSkip()]);
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "spawnEvent":
      refreshSpawnedEvent(scene, step.eventId);
      return resumeAfterSurface(scene, interpreter);
    case "removeEvent":
      removeRuntimeEvent(scene, step.eventId);
      return resumeAfterSurface(scene, interpreter);
    case "openChest":
      await playOpenChest(scene, { chestId: step.chestId });
      return resumeAfterSurface(scene, interpreter);
    case "shop":
      // 상점 원장은 맵+이벤트로 가른다 — 예전에는 전부 "global" 하나를 공유해서 대장간에서
      // 흥정하다 상인을 화나게 하면 잡화점 주인도 같이 화나 있었다.
      return resumeWithValue(
        scene,
        interpreter,
        await playShop(scene, step, { mapId: scene.map?.id, eventId: currentEventId }),
      );
    case "inn":
      return resumeWithValue(scene, interpreter, await playInn(scene, step));
    case "gameOver":
      scene.showGameOverScreen(step.message);
      return resumeInterpreter(interpreter);
    case "returnToTitle":
      if (step.title || step.message) {
        scene.showEndingScreen(step.title ?? "", step.message ?? "");
      } else {
        scene.returnToTitle();
      }
      return resumeInterpreter(interpreter);
    default:
      return assertNever(step);
  }
}

function resolveMoveEventTarget(eventId: string, currentEventId: string | undefined): string {
  return eventId || currentEventId || "";
}

function applyEventGraphicPatternStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "setEventGraphicPattern" }>,
  currentEventId: string | undefined
): void {
  const eventId = step.eventId || currentEventId;
  if (!eventId) return;
  // Persist across refreshRuntimeSurfaces so door open frames survive wait/transfer mid-sequence.
  scene.eventGraphicPatternOverrides.set(eventId, step.pattern);
  setEventSpritePattern(store.getCurrent(), scene.eventSprites.get(eventId), step.pattern);
  scene.syncRuntimeState();
}

// moveEvent 의 wait 옵션: mover 가 활동을 마칠 때(autonomousNPCs 에서 제거될 때)까지 대기.
// 반복(repeat) mover는 완료되지 않으므로 wait 와 함께 쓰면 무한 대기가 되나,
// RM2K3 동작과 일관되게 비반복 경로에만 의미를 둔다. 안전 가드로 최대 30초 후 타임아웃.
function waitForMoverComplete(scene: PlaySceneContext, eventId: string): Promise<void> {
  return new Promise((resolve) => {
    const timeoutMs = 30000;
    const startedAt = performance.now();
    const check = () => {
      if (!scene.autonomousNPCs.has(eventId)) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

function waitForAllCommandMovement(scene: PlaySceneContext): Promise<void> {
  return new Promise((resolve) => {
    const timeoutMs = 30000;
    const startedAt = performance.now();
    const check = () => {
      const hasCommandMover = [...scene.commandMoveRouteEventIds].some((eventId) => scene.autonomousNPCs.has(eventId));
      if (!hasCommandMover && !scene.playerRoute && !scene.moving) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

// 주인공 강제 이동 루트가 끝날 때(scene.playerRoute 가 비워질 때)까지 대기. 안전 타임아웃 30초.
function waitForPlayerRouteComplete(scene: PlaySceneContext): Promise<void> {
  return new Promise((resolve) => {
    const timeoutMs = 30000;
    const startedAt = performance.now();
    const check = () => {
      if (!scene.playerRoute || performance.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

function eraseRuntimeEvent(scene: PlaySceneContext, eventId: string | undefined): void {
  if (!eventId) return;
  scene.session.erasedEventIds = [...new Set([...(scene.session.erasedEventIds ?? []), eventId])];
  removeRuntimeEvent(scene, eventId);
}

function refreshSpawnedEvent(scene: PlaySceneContext, eventId: string): void {
  if (!eventId) return;
  scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.delete(eventId);
  scene.pageMoveRouteEventIds.delete(eventId);
}

function removeRuntimeEvent(scene: PlaySceneContext, eventId: string | undefined): void {
  if (!eventId) return;
  scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.delete(eventId);
  scene.pageMoveRouteEventIds.delete(eventId);
  scene.eventSprites.get(eventId)?.destroy();
  scene.eventSprites.delete(eventId);
}

function stopCommandMovement(scene: PlaySceneContext): void {
  cancelFurniturePush(scene);
  for (const eventId of scene.commandMoveRouteEventIds) scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.clear();
  scene.playerRoute = null;
  // 체공 중에 이동이 취소되면 원점 리프트가 남아 주인공이 공중에 붙는다.
  if (scene.playerHop) {
    scene.playerHop = null;
    abortHop(scene, PLAYER_SHADOW_KEY, scene.player);
  }
  if (scene.moving) {
    scene.moving = false;
    scene.moveProgress = 0;
    scene.movingTo = { ...scene.movingFrom };
    // 이동을 끊고 스프라이트를 되돌릴 때도 **몸 중앙**이다. 1x1 이면 타일 중앙과 같다.
    const footprint = resolvePlayerBody(store.getCurrent(), scene.session).footprint;
    scene.player.setPosition(footprintSpriteX(scene.tileX, footprint), characterSpriteY(scene.tileY));
  }
}

function invalidateFactionRetargetCache(scene: PlaySceneContext): void {
  for (const combatant of scene.actionCombatState?.enemies.values() ?? []) combatant.retargetMs = 0;
}

function resumeAfterSurface(scene: PlaySceneContext, interpreter: Interpreter): StepResult {
  const result = resumeInterpreter(interpreter);
  scene.refreshRuntimeSurfaces();
  return result;
}

function resumeWithChoice(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  index: number
): StepResult {
  return resumeWithValue(scene, interpreter, index);
}

function resumeWithValue(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  value: number | boolean | string
): StepResult {
  const result = interpreter.resume(value);
  scene.refreshRuntimeSurfaces();
  return result;
}

function resumeInterpreter(interpreter: Interpreter): StepResult {
  return interpreter.resume(undefined);
}

// 아무 키나 누를 때까지 대기하고, 눌린 키의 RM2K3 호환 코드를 반환한다.
// variableId 가 없는 inputWait 에서는 반환값을 무시한다.
function waitForKey(): Promise<number> {
  return new Promise<number>((resolve) => {
    const handler = (event: KeyboardEvent): void => {
      document.removeEventListener("keydown", handler);
      resolve(keyInputCodeFor(event));
    };
    document.addEventListener("keydown", handler);
  });
}

// RM2K3 Key Input Processing 호환 코드. 방향/결정/취소/숫자 등을 정수 코드로 매핑.
// 변수에 저장된 코드를 이벤트 조건에서 검사하는 용도.
function keyInputCodeFor(event: KeyboardEvent): number {
  switch (event.key) {
    case "ArrowDown": case "s": case "S": return 1;
    case "ArrowLeft": case "a": case "A": return 2;
    case "ArrowRight": case "d": case "D": return 3;
    case "ArrowUp": case "w": case "W": return 4;
    case "Enter": case " ": case "z": case "Z": return 5;  // 결정
    case "Escape": case "x": case "X": return 6;            // 취소
    case "Shift": return 7;
    default:
      // 숫자키 0-9
      if (/^[0-9]$/.test(event.key)) return 10 + parseInt(event.key, 10);
      return 0;
  }
}

function resolveBattleTroopId(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "battleProcessing" }>
): string {
  if (step.troopSource === "variable" && step.troopVariableId) {
    const raw = scene.session.variables[step.troopVariableId] as unknown as string | number | undefined;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const asIndex = Math.trunc(raw);
      const troops = store.getCurrent().database.troops;
      const byIndex = troops[asIndex - 1] ?? troops[asIndex];
      if (byIndex) return byIndex.id;
      const byNumericId = troops.find((troop) => troop.id.endsWith(String(asIndex)) || troop.id === String(asIndex));
      if (byNumericId) return byNumericId.id;
    }
    // 변수 값이 troop id 문자열이 아닐 수 있어 세션 변수 맵 외에 flags 를 보지 않는다.
    const project = store.getCurrent();
    // 일부 프로젝트는 변수에 troop id 문자열을 직접 넣지 않고 숫자 인덱스만 둔다.
    // 위에서 못 찾으면 고정 troopId 로 폴백.
    void project;
  }
  return step.troopId;
}
