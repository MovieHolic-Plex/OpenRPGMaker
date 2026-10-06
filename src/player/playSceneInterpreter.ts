import { applySpriteLookStep, playParticleEffect } from "@/player/playSceneFieldStaging";
import { playQuickTimeEvent, playTeleportMenu, playTimedChoice } from "@/player/playSceneMinigames";
import { mapTileSize } from "@/project/tileGeometry";
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
import { playAudioCommand, stopAudioChannel, stopAudioCommand } from "@/player/audio";
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
import { tryBoardVehicle, tryGetOffVehicle } from "@/player/playSceneVehicles";
import type { Command, MessageWindowSettings } from "@/project/types";
import { characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { waitForEventKey } from "@/player/eventInput";
import { abortHop, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { applyCameraControl } from "@/player/playSceneCamera";
import { applyLightingStep } from "@/player/playSceneLighting";
import { playMapAnimation } from "@/player/playSceneMapAnimations";
import { playPathfindMove } from "@/player/playScenePathfinding";
import { conditionWaitScenes, isRuntimeEventIdle } from "@/player/runtimeConditionWait";
import { playMovieOverlay } from "@/player/playSceneMovies";
import { applyWeatherStep } from "@/player/playSceneWeather";
import { applyEventRelocationStep, placePlayerOnCurrentMap } from "@/player/playSceneMapCommands";
import { recoverPlayerFromTerrain } from "@/project/terrainLandingRecovery";
import { showBattleAdmissionError } from "@/player/playSceneOverlays";
import { runtimeEventViewsForMap, type RuntimeEventView } from "@/project/runtimeEventState"
import {
  CUTSCENE_END_LABEL,
  isCutsceneSkippable,
  releaseCutsceneControlForOwner,
} from "@/player/cutsceneControl";
import { isFieldSpawnEventId } from "@/player/fieldSpawns";
import { isActionCombatSceneActive } from "@/player/playSceneActionCombat";
import { despawnFieldEnemyForScene, runFieldSpawnEventBattle, spawnFieldEnemyForScene } from "@/player/playSceneFieldSpawns";
import { playCommandBattle } from "./commandBattle";
import { claimForeground, foregroundOwner } from "./foregroundControl";
import { applyAdvanceTimeStep, applySetTimeStep } from "@/player/playSceneTime";
import { formatFriendshipFeedback, isGiftableEvent, isGiftSystemEnabled, isTalkFriendshipEnabled, trySocialTalk } from "@/project/friendship";
import { playGiftSelection } from "@/player/playSceneGift";
import { playPresentItem } from "@/player/playScenePresentItem";
import { playTacticsBattle } from "@/player/playSceneTactics";
import { applyBattleDefeat } from "@/player/playSceneDefeat";
import { completeDetectionEncounter } from "@/project/npcBehavior";
import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";
import { getCharacterProfile, resolveCharacterSpeaker } from "@/project/characterProfiles";
import { resolveDialogueLook } from "@/project/dialogueStyles";
import { dialogueSceneHooks } from "@/player/playSceneDialogueHooks";
import { reportEndingClear } from "@/player/playSceneOverlays";

export type RunCommandsOptions = {
  readonly allowNested?: boolean;
  readonly isCurrent?: () => boolean;
  readonly onComplete?: () => void;
  readonly continueAfterTransfer?: boolean;
};

export async function runEvent(scene: PlaySceneContext, eventId: string): Promise<void> {
  if (scene.running) return;
  if (isFieldSpawnEventId(eventId) && isActionCombatSceneActive(scene)) return;
  if (isFieldSpawnEventId(eventId) && await runFieldSpawnEventBattle(scene, eventId)) return;
  const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .find((entry) => entry.event.id === eventId);
  if (!view) return;
  const event = view.event;
  const page = view.page ?? resolveEventPage(event, scene.session, { locations: scene.map.locations });
  if (!page && event.condition && !evalCondition(scene.session, event.condition, undefined, { map: scene.map })) return;
  const dialogue = dialogueUi(scene);
  if (!dialogue) {
    console.warn("[player] dialogue UI missing");
    return;
  }
  const commands = page?.commands ?? event.commands;
  const session = scene.session;
  const completionPageId = page?.detectionEncounter ? page.id : undefined;
  const options: RunCommandsOptions = completionPageId === undefined ? {} : {
    continueAfterTransfer: true,
    onComplete: () => completeDetectionEncounter(session, eventId, completionPageId),
  };
  const activeSession = scene.session;
  try {
    if (shouldOfferGiftMenu(event, page, store.getCurrent())) {
      const action = await showGiftMenu(scene, event, page?.name);
      if (action === "talk") await runTalkPath(scene, event, commands, eventId, options);
      if (action === "gift") await runGiftSelection(scene, event);
      return;
    }
    await runTalkPath(scene, event, commands, eventId, options);
  } catch (error) {
    // Social feedback is outside runCommands, but has the same cancellation boundary.
    if (error instanceof DOMException && error.name === "AbortError"
      && (scene.session !== activeSession || scene.sys?.isActive() === false)) return;
    throw error;
  }
}

/**
 * 메뉴 «바라보는 대상에 사용»: 아이템 사용 페이지(itemUsed 조건)의 명령을 그 이벤트 소유로 실행한다.
 * 실행하는 동안 session.itemUsedId 가 남아 있어 페이지 안의 조건 분기도 같은 아이템을 본다.
 */
export async function runItemUsePage(scene: PlaySceneContext, eventId: string, commands: readonly Command[], itemId: string): Promise<void> {
  if (scene.running) return;
  const session = scene.session;
  session.itemUsedId = itemId;
  try {
    await runCommands(scene, commands, eventId);
  } finally {
    if (session.itemUsedId === itemId) delete session.itemUsedId;
    scene.refreshRuntimeSurfaces();
  }
}

async function runGiftSelection(scene: PlaySceneContext, event: CommandSourceEvent): Promise<void> {
  const activeSession = scene.session;
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    await playGiftSelection(scene, event);
  } finally {
    if (scene.session === activeSession && !scene.battleAbortController && scene.sys?.isActive() !== false) {
      scene.running = previousRunning;
      scene.lastActionTargetKey = "";
      scene.setInputEnabled(previousInputEnabled);
      // 대화 세션이 끝나는 자리 — 퇴장 연출을 재생하고 빠진다(transfer 만 하드 컷).
      dialogueUi(scene)?.close();
      scene.refreshRuntimeSurfaces();
    }
  }
}

async function runTalkPath(
  scene: PlaySceneContext,
  event: CommandSourceEvent,
  commands: readonly Command[],
  eventId: string,
  options: RunCommandsOptions = {}
): Promise<void> {
  const activeSession = scene.session;
  await runCommands(scene, commands, eventId, options);
  // An abandoned command run is not a completed social interaction.
  if (scene.session !== activeSession || scene.sys?.isActive() === false) return;
  // Action-scoped, once per interaction (not gift path; multi-text cannot re-fire).
  if (!isTalkFriendshipEnabled(event)) return;
  const page = resolveEventPage(event, scene.session, { locations: scene.map.locations });
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
      speaker: resolveCharacterSpeaker(store.getCurrent(), event),
      body: feedback,
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
    });
  } finally {
    if (scene.session === activeSession && !scene.battleAbortController && scene.sys?.isActive() !== false) {
      scene.running = previousRunning;
      scene.lastActionTargetKey = "";
      scene.setInputEnabled(previousInputEnabled);
      dialogue.close();
      scene.refreshRuntimeSurfaces();
    }
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
      prompt: getCharacterProfile(store.getCurrent(), event.characterId)?.displayName ?? speaker ?? event.id,
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
  if (!dialogue) { console.warn("[player] dialogue UI missing"); return; }
  const previousRunning = scene.running, previousInputEnabled = scene.inputEnabled;
  const lease = options.allowNested === true ? undefined : claimForeground(scene);
  if (options.allowNested !== true && !lease) return;
  const owner = foregroundOwner(scene), activeSession = scene.session;
  const current = () => scene.session === activeSession && foregroundOwner(scene) === owner
    && owner?.current() !== false && options.isCurrent?.() !== false;
  scene.running = true; scene.setInputEnabled(false);
  const project = store.getCurrent();
  activeSession.commonEvents = project.commonEvents;
  const base = createInterpreter([...commands], activeSession, project, {
    currentEventId, continueAfterTransfer: options.continueAfterTransfer, getEventPositions: () => scene.eventPositions,
    isEventIdle: target => isRuntimeEventIdle(scene, target),
    onFactionStanceChanged: () => invalidateFactionRetargetCache(scene),
  });
  // An awaited UI result must never resume commands after its owner/page/session was cancelled.
  const interpreter: Interpreter = { ...base, resume: value => current() ? base.resume(value) : { kind: "done" } };
  const skipController = createCutsceneSkipController(scene, interpreter);
  const diagnosticOwner = diagnosticToken();
  const changedTerrainMaps = new Set<string>();
  const observe = (phase: "started" | "completed" | "cancelled" | "failed") => {
    if (diagnosticOwner && diagnosticOwner === diagnosticToken() && diagnosticObserved("event")) publishDiagnostic({ category: "event", phase, count: commands.length });
  };
  observe("started");
  try {
    let result = interpreter.start(), normalCompletion = true, handledFailure = false;
    scene.refreshRuntimeSurfaces();
    while (result.kind !== "done" && current()) {
      if (isCutsceneSkippable(activeSession)) scene.showRuntimeOverlay("cutscene-skip-hint", "Esc Esc: 컷신 건너뛰기");
      const step = result;
      if (step.kind === "changeTile") changedTerrainMaps.add(step.mapId);
      result = await consumeBlockingStep(scene, interpreter, step, currentEventId, skipController, current, () => { handledFailure = true; });
      if (step.kind === "gameOver" || step.kind === "returnToTitle") normalCompletion = false;
      if (step.kind === "battleProcessing" && !step.canLose && activeSession.battleResult === "defeat") normalCompletion = false;
    }
    if (result.kind === "done" && base.isDone() && normalCompletion && current()) {
      observe("completed"); options.onComplete?.();
    } else observe(handledFailure ? "failed" : "cancelled");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError"
      && (!current() || scene.sys?.isActive() === false)) { observe("cancelled"); return; }
    observe("failed");
    throw error;
  } finally {
    skipController.dispose(); releaseCutsceneControlForOwner(activeSession, currentEventId);
    const owns = scene.session === activeSession && foregroundOwner(scene) === owner && !owner?.signal.aborted
      && !scene.battleAbortController && scene.sys?.isActive() !== false;
    if (owns) {
      scene.clearRuntimeOverlay("cutscene-skip-hint"); scene.lastActionTargetKey = "";
      if (changedTerrainMaps.has(scene.session.currentMapId) && scene.playerRoute?.through !== true) {
        const landing = recoverPlayerFromTerrain(project, scene.session, scene.eventPositions);
        if (landing) placePlayerOnCurrentMap(scene, landing.x, landing.y);
      }
      if (lease) lease.release();
      else { scene.running = previousRunning; scene.setInputEnabled(previousInputEnabled); }
      dialogue.close(); scene.refreshRuntimeSurfaces();
    } else lease?.release(false);
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
  const duration = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
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
  skipController: CutsceneSkipController,
  isCurrent: () => boolean,
  onHandledFailure: () => void
): Promise<StepResult> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return { kind: "done" };
  switch (step.kind) {
    case "text": {
      const project = store.getCurrent();
      const event = step.speaker === undefined && currentEventId
        ? runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions).find((view) => view.event.id === currentEventId)?.event
        : undefined;
      const speaker = step.speaker ?? getCharacterProfile(project, event?.characterId)?.displayName;
      await dialogue.showText({
        speaker,
        look: resolveDialogueLook(project, {
          speaker,
          characterId: event?.characterId,
          style: step.style,
          context: step.context,
          container: step.container,
          emotion: step.emotion,
        }),
        ...dialogueSceneHooks(scene, { speaker, currentEventId }),
        body: step.body,
        face: step.face,
        settings: textWindowSettings(scene.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS, step.position),
        textContext: { session: scene.session, project: store.getCurrent() },
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
        ...playerScreenYOf(scene),
        autoAdvance: step.autoAdvance === true,
        emotion: step.emotion,
        ...(step.voiceResourceId ? { voiceResourceId: step.voiceResourceId } : {}),
      });
      {
        const skipped = skipController.takeResult();
        if (skipped) return skipped;
      }
      return resumeAfterSurface(scene, interpreter);
    }
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
    case "presentItem": {
      const itemId = await playPresentItem(scene, step);
      const skipped = skipController.takeResult();
      if (skipped) return skipped;
      return itemId === undefined ? resumeAfterSurface(scene, interpreter) : resumeWithValue(scene, interpreter, itemId);
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
      const session = scene.session;
      const abort = new AbortController();
      const cancel = (): void => abort.abort();
      scene.events?.once("shutdown", cancel);
      scene.events?.once("destroy", cancel);
      try {
        const keyCode = await waitForEventKey(abort.signal);
        if (scene.session !== session || scene.sys?.isActive() === false) return { kind: "done" };
        return step.variableId ? resumeWithValue(scene, interpreter, keyCode) : resumeAfterSurface(scene, interpreter);
      } finally {
        scene.events?.off("shutdown", cancel);
        scene.events?.off("destroy", cancel);
      }
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
        ...(step.prompt ? { prompt: step.prompt } : {}),
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
    case "transfer": {
      dialogue.hide();
      const owner = foregroundOwner(scene);
      const finishTransfer = owner?.beginAuthoredTransfer(step.mapId);
      if (owner && !finishTransfer) return { kind: "done" };
      try { await scene.transferTo(step); }
      finally { finishTransfer?.(); }
      return resumeAfterSurface(scene, interpreter);
    }
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
    case "tacticsBattle": {
      dialogue.hide();
      const result = await playTacticsBattle(scene, step);
      if (result === undefined) return resumeAfterSurface(scene, interpreter);
      // 패배 불허 전투의 패배는 게임 오버다(battleProcessing 과 같은 규칙).
      if (result === "defeat" && !step.canLose) { applyBattleDefeat(scene); return { kind: "done" }; }
      scene.refreshRuntimeSurfaces();
      return resumeWithValue(scene, interpreter, result);
    }
    case "setEventGraphicPattern":
      applyEventGraphicPatternStep(scene, step, currentEventId);
      return resumeInterpreter(interpreter);
    case "pathfindMove": {
      const abort = new AbortController();
      const pending = playPathfindMove(scene, step, currentEventId, abort.signal);
      if (step.wait) {
        // 대기하는 명령은 반드시 끝난다: playPathfindMove 는 막힘·경로 없음·중단을
        // 모두 해결된 결과로 돌려주므로 영원히 기다리는 경로가 없다(OPRN-OUT-013).
        const outcome = await Promise.race([pending, skipController.waitForSkip()]);
        const skipped = skipController.takeResult();
        if (skipped) { abort.abort(); return skipped; }
        if (step.onFailure === "stop" && outcome !== undefined && outcome !== "arrived") {
          scene.refreshRuntimeSurfaces();
          return { kind: "done" };
        }
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
      try {
        const result = await playCommandBattle(scene, step, isCurrent);
        if (result === null || (result === "defeat" && !step.canLose)) return { kind: "done" };
        return resumeWithValue(scene, interpreter, result);
      } catch (error) {
        onHandledFailure();
        console.error("[player] event battle failed", error);
        showBattleAdmissionError(scene, error);
        return { kind: "done" }; // Do not resume the interpreter or invent a battle result.
      }
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
      clearAudioState(scene.session, step.channel);
      if (step.channel === undefined) stopAudioCommand();
      else stopAudioChannel(step.channel);
      if (step.channel === undefined || step.channel === "bgm" || step.channel === "bgs") scene.clearRuntimeOverlay("audio-indicator");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "flashScreen":
      await scene.flashScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "shakeScreen":
      await scene.shakeScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "particleEffect": {
      const done = playParticleEffect(scene, step, currentEventId);
      if (step.wait) await done;
      return resumeAfterSurface(scene, interpreter);
    }
    case "spriteLook":
      applySpriteLookStep(scene, step, currentEventId);
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
    case "relocateEvents":
      applyEventRelocationStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "vehicle":
      if (step.boarded) tryBoardVehicle(scene);
      else tryGetOffVehicle(scene);
      return resumeAfterSurface(scene, interpreter);
    case "spawnEvent":
      refreshSpawnedEvent(scene, step.eventId);
      return resumeAfterSurface(scene, interpreter);
    case "removeEvent":
      removeRuntimeEvent(scene, step.eventId);
      return resumeAfterSurface(scene, interpreter);
    case "openChest":
      await playOpenChest(scene, {
        ...step,
        mapId: scene.map.id,
        x: scene.tileX,
        y: scene.tileY,
      });
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
      scene.showGameOverScreen(step.message, step.gameOverId);
      return resumeInterpreter(interpreter);
    case "returnToTitle":
      reportEndingClear(scene, step.clear);
      if (step.title !== undefined || step.message !== undefined || step.presentation) {
        scene.showEndingScreen(step.title ?? "", step.message ?? "", step.presentation);
      } else {
        scene.returnToTitle();
      }
      return resumeInterpreter(interpreter);
    case "timedChoice":
      return resumeWithValue(scene, interpreter, await playTimedChoice(scene, step));
    case "quickTimeEvent":
      return resumeWithValue(scene, interpreter, await playQuickTimeEvent(scene, step));
    case "teleportMenu":
      return resumeWithValue(scene, interpreter, await playTeleportMenu(scene, step));
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
  scene.playerSlide = null;
  scene.playerSlideKind = null;
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
    scene.player.setPosition(footprintSpriteX(scene.tileX, footprint, mapTileSize(scene.map)), characterSpriteY(scene.tileY, mapTileSize(scene.map)));
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



/** 이 한 줄의 대화창 위치 지정(position)을 문장 표시 설정에 덮는다 — auto 는 주인공 가림 회피를 켜고, top·center·bottom 은 고정한다. */
function textWindowSettings(base: MessageWindowSettings, position: "auto" | "top" | "center" | "bottom" | undefined): MessageWindowSettings {
  if (!position) return base;
  if (position === "auto") return { ...base, preventObscuringPlayer: true };
  return { ...base, position, preventObscuringPlayer: false };
}

/** 카메라를 거친 화면 속 주인공 높이(0~1). 스프라이트·카메라가 없으면 비워 타일 위치로 판정하게 둔다. */
function playerScreenYOf(scene: PlaySceneContext): { playerScreenY?: number } {
  const camera = scene.cameras?.main;
  const sprite = scene.player;
  if (!camera || !sprite || !(camera.height > 0)) return {};
  const centerY = sprite.y - (sprite.displayHeight > 0 ? sprite.displayHeight : 0) * (sprite.originY ?? 1) + (sprite.displayHeight > 0 ? sprite.displayHeight : 0) / 2;
  const ratio = ((centerY - camera.scrollY) * camera.zoom) / camera.height;
  return Number.isFinite(ratio) ? { playerScreenY: Math.max(0, Math.min(1, ratio)) } : {};
}
