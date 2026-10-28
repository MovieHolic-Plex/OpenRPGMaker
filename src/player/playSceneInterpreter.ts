import { playLiftRide } from "@/player/playSceneLiftRide";
import { isTouchUiHost } from "@/player/touchTap";
import { stepStopReason, stopsReading } from "@/project/dialogueSystem";
import { applySpriteLookStep, playParticleEffect } from "@/player/playSceneFieldStaging";
import { playQuickTimeEvent, playTeleportMenu, playTimedChoice } from "@/player/playSceneMinigames";
import { mapTileSize } from "@/project/tileGeometry";
import { partySkillContext } from "@/project/partySkills";
import { cancelFurniturePush } from './furniturePushAnimation';
import { friendshipDeltaEmote } from "@/project/emotes";
import { showRelationshipPulse } from "@/player/playSceneRelationshipPulse";
import { showSceneEmote } from "@/player/playSceneEmotes";
import {
  clearAudioState,
  erasePictureState,
  evalCondition,
  DEFAULT_MESSAGE_WINDOW_SETTINGS,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { playMonsterSfx } from "@/player/monsterSfx";
import { playDoorOpenBeforeTransfer } from "@/player/playSceneFieldFx";
import { store } from "@/project/store";
import { COMPANION_SCENE_FLAG, syncFollowerSceneVisibility } from "@/player/playSceneFollowers";
import { setEventSpritePattern } from "@/player/eventSpriteResources";
import { playAudioCommand, stopAudioChannel, stopAudioCommand } from "@/player/audio";
import { resolveEventPage } from "@/project/io";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { Interpreter } from "@/player/interpreter";
import { applyDialogueFacing } from "@/player/playSceneDialogueFacing";
import { stageBusts } from "@/player/playSceneBustStage";
import { playInn, playShop } from "@/player/playSceneCommerce";
import { playOpenChest } from "@/player/playSceneChest";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { resolveDialogueSpeakerName } from "@/player/dialogue";
import { showNameEntry } from "@/player/nameEntry/nameEntryOverlay";
import { nameEntryShowcaseHero } from "@/player/nameEntry/nameEntryShowcase";
import { applyTimerStep } from "@/player/playSceneTimers";
import { startPlayerRoute } from "@/player/playSceneMovement";
import { holdBlockedCommandRoute } from "@/player/playerRouteState";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { resolvePlayerBody } from "@/project/playerFootprint";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { assertNever } from "@/player/playSceneTypes";
import { tryBoardVehicle, tryGetOffVehicle } from "@/player/playSceneVehicles";
import type { Command, MessageWindowSettings, MoveCommand } from "@/project/types";
import { characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { waitForEventKey } from "@/player/eventInput";
import { abortHop, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { applyCameraControl, restoreCameraAfterCutsceneSkip } from "@/player/playSceneCamera";
import { cameraViewOrigin } from "@/player/cameraScreen";
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
import { advanceSocialSlotClock } from "@/player/socialSlotClock";
import { friendshipDisplayMax, resolveSocialLoop, socialSlotsExhausted } from "@/project/socialLoop";
import { resolveTimeSystem } from "@/project/gameTime";
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
  /** 전투 입장 거부처럼 호스트가 처리한 실패로 끝났을 때(완료 영수증은 남기지 않는다). */
  readonly onHandledFailure?: () => void;
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
  const page = view.page ?? resolveEventPage(event, scene.session, { locations: scene.map.locations, ...partySkillContext(store.getCurrent(), scene.session) });
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
  const page = resolveEventPage(event, scene.session, { locations: scene.map.locations, ...partySkillContext(store.getCurrent(), scene.session) });
  const trigger = page?.trigger ?? event.trigger;
  if (trigger.kind !== "action") return;
  const result = trySocialTalk(scene.session, event, store.getCurrent());
  if (!result.ok && result.reason !== "no-slots") return;
  const project = store.getCurrent();
  const loop = resolveSocialLoop(project);
  let endsDay = false;
  if (result.ok) {
    // 소셜 루프: 호감 대화 한 번이 하루 시간대 한 칸을 쓴다 — 시계도 그만큼 간다.
    advanceSocialSlotClock(project, scene.session);
    endsDay = !!loop && socialSlotsExhausted(scene.session, loop) && resolveTimeSystem(project)?.forceSleep === true;
    showSceneEmote(scene, event.id, friendshipDeltaEmote(result.delta));
  }
  scene.syncRuntimeState();
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  const previousRunning = scene.running;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    const feedback = result.ok
      ? formatFriendshipFeedback({ delta: result.delta, friendship: result.friendship, max: friendshipDisplayMax(project) })
        + (result.capped ? " (오늘은 이 사람에게서 얻을 수 있는 만큼 얻었다)" : "")
        + (result.slotsLeft !== undefined ? ` · 오늘 남은 시간 ${result.slotsLeft}` : "")
        + (endsDay ? " · 하루가 저문다." : "")
      : "오늘은 더 이야기할 시간이 없다. 내일 다시 만나자.";
    await dialogue.showText({
      speaker: resolveCharacterSpeaker(store.getCurrent(), event),
      body: feedback,
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
    });
  } catch (error) {
    // 마지막 칸의 시계는 하루 끝 1분 앞에 서 있어, 피드백이 떠 있는 동안 자연 시계가 강제 취침을 먼저 건다 — 그 취침이
    // 열린 대사를 가져가며 끊는 것이다(런타임 QA 실측 「Text cancelled」). 하루가 이미 넘어가는 중이면 정상 흐름이다.
    const takenOverBySleep = endsDay && scene.timeSleepInProgress
      && error instanceof DOMException && error.name === "AbortError";
    if (!takenOverBySleep) throw error;
  } finally {
    // 취침이 이미 대화창(에필로그)을 쥐고 있으면 여기서 닫지 않는다.
    if (scene.session === activeSession && !scene.battleAbortController && scene.sys?.isActive() !== false) {
      scene.running = previousRunning;
      scene.lastActionTargetKey = "";
      scene.setInputEnabled(previousInputEnabled);
      if (!scene.timeSleepInProgress) dialogue.close();
      scene.refreshRuntimeSurfaces();
    }
  }
  // 칸을 다 쓴 날은 저문다 — 잠자리 이벤트가 없어도 하루가 넘어가고, 기한 엔딩(onDayEnd)이 센다.
  if (endsDay && scene.session === activeSession && scene.sys?.isActive() !== false) await scene.sleepUntilMorning();
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
    onFriendshipChanged: (npcKey, delta) => showRelationshipPulse(scene, npcKey, delta),
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
    let result = interpreter.start(), normalCompletion = true, handledFailure = false, lostBattle = false;
    // 첫 걸음이 다른 맵으로 가는 이동(문·출구 이벤트)이면 지금 맵을 다시 그리지 않는다 — 곧 버릴 맵의 타일·이벤트를
    // 다시 깔면서 쓰레기 수거까지 겹쳐, 문 칸을 밟는 순간 한 프레임이 100ms 넘게 멈췄다(2026-10-24 프로파일).
    if (!(result.kind === "transfer" && result.mapId !== scene.map.id)) scene.refreshRuntimeSurfaces();
    while (result.kind !== "done" && current()) {
      if (isCutsceneSkippable(activeSession)) scene.showRuntimeOverlay("cutscene-skip-hint", isTouchUiHost(scene.game?.canvas) ? "B 두 번: 컷신 건너뛰기" : "Esc 두 번: 컷신 건너뛰기");
      const step = result;
      if (step.kind === "changeTile") changedTerrainMaps.add(step.mapId);
      result = await consumeBlockingStep(scene, interpreter, step, currentEventId, skipController, current, () => { handledFailure = true; });
      if (step.kind === "gameOver" || step.kind === "returnToTitle") normalCompletion = false;
      if (step.kind === "battleProcessing" && !step.canLose && activeSession.battleResult === "defeat") normalCompletion = false;
      // 진 전투는 시야선 트레이너(발견 이벤트)의 「끝낸 만남」 영수증으로 세지 않는다 — 센터에서 돌아와 다시 시야에 들면 또 걸어온다.
      if (step.kind === "battleProcessing" && activeSession.battleResult === "defeat") lostBattle = true;
    }
    if (result.kind === "done" && base.isDone() && normalCompletion && current()) {
      observe("completed"); if (!lostBattle) options.onComplete?.();
    } else observe(handledFailure ? "failed" : "cancelled");
    if (handledFailure) options.onHandledFailure?.();
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
    restoreCameraAfterCutsceneSkip(scene);
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
  // 오토·스킵은 사람이 직접 고르거나 장면이 바뀌는 단계(선택지·이동·전투·상점·엔딩…)에서 반드시 멈춘다(project/dialogueSystem.ts stopsReading).
  if (stopsReading(step.kind)) dialogue.stopReading?.(stepStopReason(step.kind));
  switch (step.kind) {
    case "text": {
      const project = store.getCurrent();
      const textContext = { session: scene.session, project };
      const event = step.speaker === undefined && currentEventId
        ? runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions).find((view) => view.event.id === currentEventId)?.event
        : undefined;
      const authoredSpeaker = step.speaker ?? getCharacterProfile(project, event?.characterId)?.displayName;
      const speaker = resolveDialogueSpeakerName(authoredSpeaker, textContext) ?? authoredSpeaker;
      markCompanionSpeaking(project, scene, speaker);
      // 말하는 인물이 듣는 인물 쪽으로 돈다(둘 다 맵에 있고 가까울 때, text.autoFace=false 면 안 돈다).
      applyDialogueFacing(scene, step, currentEventId);
      // 흉상 좌우·듣는 흉상을 맵 위 자리로(text.bustSide = "stage").
      const staged = stageBusts(scene, step);
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
        face: staged ? staged.face : step.face,
        ...(staged ? { stageListener: true, ...(staged.listenerFace ? { listenerFace: staged.listenerFace } : {}) } : step.listenerFace ? { listenerFace: step.listenerFace } : {}),
        settings: textWindowSettings(scene.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS, step.position),
        textContext,
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
        ...playerScreenYOf(scene),
        autoAdvance: step.autoAdvance === true,
        emotion: step.emotion,
        ...(step.voiceResourceId ? { voiceResourceId: step.voiceResourceId } : {}),
        ...(step.endingEpilogue ? { endingEpilogue: true } : {}),
        ...(step.beforeChoices ? { beforeChoices: true } : {}),
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
          // 대사와 같은 화면 속 높이로 가림을 판정한다(타일 높이만 보면 카메라가 맵 끝에 걸릴 때 대사와 다른 쪽을 고른다).
          ...playerScreenYOf(scene),
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
        ...(step.presentation === "showcase" ? { showcase: { hero: nameEntryShowcaseHero(store.getCurrent(), scene.session, step.actorId) } } : {}),
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
      // 몬스터 장르: 다른 맵으로 드나드는 문 소리(체육관 이름이면 무거운 문). 다른 장르는 무음 그대로.
      let genreDoorSound = false;
      if (step.mapId !== scene.map.id) {
        const project = store.getCurrent();
        const destinationName = project.maps[step.mapId]?.name ?? "";
        genreDoorSound = playMonsterSfx(project, /체육관|gym/i.test(destinationName) ? "gym-door" : "door-open") === true;
      }
      // 문 열림 연출: door 생략 = 자동(문 캐릭터 시트이거나 이벤트 칸·바로 윗칸에 여닫는 문 타일일 때만),
      // true = 켜기(주인공 앞 문 타일까지 찾는다), false = 끄기. 성문·통로·맵 가장자리·계단은 자동에서 연출이 없다.
      if (step.mapId !== scene.map.id && step.door !== false) {
        try { await playDoorOpenBeforeTransfer(scene, currentEventId, { silent: genreDoorSound, mode: step.door === true ? "on" : "auto" }); } catch (error) { console.warn("[player] door open fx", error); }
      }
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
      if (typeof callback === "function") await callback(step.kind === "openMenuScreen" ? step.screen : undefined);
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
      // null = 전투 도중 플레이가 끝났다. 이벤트를 더 진행하지 않는다(battleProcessing 의 null 과 같다).
      if (result === null) return { kind: "done" };
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
      const moves = bindStageTargets(step.moves, currentEventId);
      if (target === PLAYER_MOVE_TARGET) {
        // 주인공 강제 이동: 이벤트 무버가 아니라 플레이어를 한 칸씩 걷게 한다.
        startPlayerRoute(scene, moves, step.repeat);
        if (step.skippable === false && scene.playerRoute) scene.playerRoute.preserveBlockedSteps = true;
        if (step.wait) {
          await Promise.race([waitForPlayerRouteComplete(scene), skipController.waitForSkip()]);
        }
      } else {
        scene.registerAutonomousMover(target, moves, step.repeat);
        scene.commandMoveRouteEventIds.add(target);
        if (step.skippable === false) holdBlockedCommandRoute(scene.autonomousNPCs.get(target));
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
        const result = await playCommandBattle(scene, step, isCurrent, isCurrent, currentEventId);
        if (result === null || (result === "defeat" && !step.canLose)) return { kind: "done" };
        return resumeWithValue(scene, interpreter, result);
      } catch (error) {
        onHandledFailure();
        console.error("[player] event battle failed", error);
        await showBattleAdmissionError(scene, error);
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
    case "liftRide": {
      const done = playLiftRide(scene, step);
      if (step.wait) await done;
      return resumeAfterSurface(scene, interpreter);
    }
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
        scene.showEndingScreen(step.title ?? "", step.message ?? "", step.presentation, step.clear?.endingId, step.continueTo);
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
  // 카메라 origin 기준 확대를 반영한다(cameraScreen.ts). 예전 (y - scrollY) * zoom 은 배율 2(아스트라 호라이즌)에서
  // 화면 가운데 주인공을 1.00(맨 아래)으로 읽어 창을 위로 보냈다.
  const ratio = ((centerY - cameraViewOrigin(camera).top) * camera.zoom) / camera.height;
  return Number.isFinite(ratio) ? { playerScreenY: Math.max(0, Math.min(1, ratio)) } : {};
}

/** 다가가기·쪽으로 돌기의 대상 "@this"(이 이벤트)를 실제 id 로 묶는다 — 경로를 받는 인물은 명령을 실행한 이벤트를 모른다. */
function bindStageTargets(moves: MoveCommand[], currentEventId: string | undefined): MoveCommand[] {
  if (!moves.some((m) => (m.kind === "approach" || m.kind === "turnToward") && (m.target === "@this" || m.target === "this-event"))) return moves;
  return moves.map((m) => (m.kind === "approach" || m.kind === "turnToward") && (m.target === "@this" || m.target === "this-event")
    ? { ...m, target: currentEventId ?? "" } : m);
}

/**
 * companions.display "scenesOnly"(FF6 식): 도는 이벤트에서 선두가 아닌 파티원이 말하면 그 이벤트가 끝날 때까지
 * 동료를 주인공 옆에 세운다. 평범한 NPC 대화에서는 동료가 튀어나오지 않는다.
 */
function markCompanionSpeaking(project: ReturnType<typeof store.getCurrent>, scene: PlaySceneContext, speaker: string | undefined): void {
  if (project.system.companions?.display !== "scenesOnly" || !speaker?.trim()) return;
  if (scene.session.flags[COMPANION_SCENE_FLAG] === true) return;
  const name = speaker.trim();
  const companions = scene.session.partyActorIds.slice(1);
  const speaks = companions.some((actorId) => {
    const own = scene.session.actorNames?.[actorId]?.trim();
    const record = project.database.actors.find((actor) => actor.id === actorId);
    return name === own || name === record?.name?.trim() || name === record?.nickname?.trim();
  });
  if (!speaks) return;
  scene.session.flags[COMPANION_SCENE_FLAG] = true;
  syncFollowerSceneVisibility(scene);
}
