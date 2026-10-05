import { playCinematicSequence } from "@/player/cinematicSequence";
import { LifeReconciliationError } from "@/project/lifeRecovery";
import { openEventMenu } from "@/player/playerEventMenus";
import type Phaser from "phaser";
import { startPlayGame, destroyGame } from "@/app/mode";
import { store } from "@/project/store";
import { warnIfPlayBootIssues } from "@/project/playBootValidation";
import { preflightProjectForPlay } from "@/project/playPreflight";
import {
  clearStaleModuleReloadMark,
  consumeStaleModuleReload,
  markStaleModuleReloaded,
} from "@/app/moduleLoadRecovery";
import {
  describeBootFailure,
  installBootProject,
  repairSummaries,
  safeModeProject,
  type PlayBootFailureContext,
} from "@/player/playBootRecovery";
import { isEngineModuleLoadFailure } from "@/util/dynamicImport";
import { startSession, type PlaySession } from "@/project/session";
import { applyClearCarry, newGamePlusMenuLabel } from "@/project/newGamePlus";
import { difficultiesOf, initialDifficultyId, setSessionDifficulty } from "@/project/difficulty";
import { applyTitleVariant } from "@/project/titleVariants";
import { renderDifficultyPanel } from "@/player/playerDifficultyPanel";
import { clearHistoryOf, readClearRecord, recordEndingClear } from "@/player/clearRecord";
import { applyStatePreset, testHerePreset } from "@/testing/debugSession";
import { el, clearChildren } from "@/util/dom";
import {
  applySaveSnapshot,
  readAutosave,
  latestResumableSave,
  readLatestSave,
  readSaveSlot,
  snapshotLoadBlocker,
  setSavePublication,
  type SaveSlotIndex,
} from "@/player/saveSlots";
import { resetAutosaveDebounce } from "@/player/autosave";
import { createDialogueUI } from "@/player/dialogue";
import { destroyBattleSceneOnHost } from "@/player/battleDom";
import { markPlayRender } from "@/app/perfMetrics";
import type { PlayScene } from "@/player/PlayScene";
import { isPlayScene } from "@/player/playerGuards";
import { createPlaySurface } from "@/player/playSurface";
import type { PlaySurfaceScaleMode } from "@/player/playSurfaceScale";
import { createTouchPad, type TouchPadHandle } from "@/player/touchPad";
import { renderPlayerLoadPanel } from "@/player/playerLoadPanel";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import { currentStatusMenu } from "@/player/playerStatusMenuControllerDom";
import { closeStatusMenu } from "@/player/playerStatusMenuMotion";
import {
  moveTitleSelection,
  type RuntimeMenuKey,
} from "@/player/runtimeKeyboardMenu";
import {
  directionForKey,
  handSlotCycleDelta,
  handSlotDigit,
  isCancelKey,
  isConfirmKey,
  isInputCapturingSurfaceActive,
  isMenuKey,
  isRuntimeMenuKey as isRuntimeMenuKeyBinding,
  isTextEntryTarget,
} from "@/player/keyBindings";
import { cycleHandSlot, selectHandSlot } from "@/player/handSlot";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { emitRuntimeJuice, type RuntimeJuiceEvent } from "@/player/runtimeJuice";
import {
  clampTitleMenuIndex,
  focusSelectedTitleOption,
  listTitleMenuOptions,
  playTitleTransition,
  renderTitleScreen,
  updateTitleSelection,
  type TitleMenuOptionId,
} from "@/player/titleScreen";
import { openLicenseDialog } from "@/player/titleLicenseNotice";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { AUDIO_HANDOFF_REGISTRY_KEY, getAudioEngine, playAudioCommand, stopAudioCommand, stopAllAudio } from "@/player/audio";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import {
  mountPlayLoadingOverlay,
  type PlayLoadingOverlay,
} from "@/player/playLoadingOverlay";
import { warmBundledPlayAssets } from "@/assets/bundledAssetWarmup";
import { createCinematicAssets } from './cinematicAssets';
import { warmPlayGameRuntime } from './createPlayGame';
import { createRuntimeAudioWarmup } from './runtimeAudioWarmup';
import { resolveMapBgm } from './mapBgm';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import {
  recordPlayBootDiagnostic,
  type PlayBootDiagnosticSink,
} from "@/player/playBootDiagnostics";
import { mountHostFullscreenToggle, type HostBridge } from "@/player/hostBridge";
import { resolvePlayResolution } from "@/project/playResolution";
import { diagnosticToken } from "@/util/diagnosticObserver";

let teardownShell: (() => void) | null = null;

/**
 * 호스트(에디터 테스트 플레이 창)가 현재 런을 조작하는 손잡이.
 * 모듈 전역 상태를 늘리지 않기 위해 renderPlayer 옵션 콜백으로만 넘긴다.
 */
export type PlayerRunControls = {
  /** 진행 상태 없는 새 런을 즉시 시작한다(타이틀을 거치지 않는다). */
  readonly restartRun: () => void;
  /** 현재 런을 정리하고 타이틀 화면으로 돌아간다. */
  readonly returnToTitle: () => void;
};

export type RenderPlayerOptions = {
  /** Community listing scope derived by the exported boot entry, not project metadata. */
  readonly saveIsolationScope?: string;
  /** Explicit export-QA capability. Normal exported players must leave this false. */
  readonly qaInstrumentation?: boolean;
  readonly onExit?: () => void;
  /** Fires only after the current run has reached a ready PlayScene. */
  readonly onPlayBootSuccess?: () => void;
  readonly trackGlobalGame?: boolean;
  readonly initialSession?: PlaySession;
  readonly initialEventTestId?: string;
  readonly diagnosticSink?: PlayBootDiagnosticSink;
  // "여기서 테스트": 지정 맵/좌표에서 바로 플레이 시작(타이틀 건너뜀).
  readonly startOverride?: { readonly mapId: string; readonly x: number; readonly y: number };
  // 커뮤니티 호스팅 셸이 주입한 기능(전체화면 토글 등). 에디터 테스트플레이에서는 없다 → 아무것도 렌더되지 않음.
  readonly hostBridge?: HostBridge;
  // 플레이 서피스 배율 정책. 내보낸 게임과 테스트 플레이는 fit으로 창에 맞춘다.
  // 명시적인 integer 호스트는 정수 배율을 유지한다.
  readonly surfaceScaleMode?: PlaySurfaceScaleMode;
  // 타이틀을 건너뛰고 새 런을 바로 시작한다. 편집 → 테스트 왕복마다 Enter 를 눌러
  // 타이틀을 통과하던 비용을 없앤다(startOverride / initialSession 가 있으면 이미 그 경로다).
  readonly autoStartRun?: boolean;
  // 오프닝 시네마틱을 재생할지. 런이 시작될 때마다 다시 묻기 때문에 호스트(테스트 플레이 창)가
  // 창을 다시 열지 않고도 체크박스를 반영할 수 있다. 없으면 기존대로 항상 재생한다.
  readonly shouldPlayOpening?: () => boolean;
  // 호스트가 다시 시작 / 타이틀부터를 구동할 수 있도록 런 조작 손잡이를 넘긴다.
  readonly onRunControlsReady?: (controls: PlayerRunControls) => void;
  // 안전 모드로 부팅한다(자율 이동·자동/병렬 이벤트 억제). 복구 패널의 «안전 모드로 시작» 과
  // 같은 경로이며, 호스트가 처음부터 안전 모드로 열 때 쓴다.
  readonly safeMode?: boolean;
  // 예비검사가 자동으로 고친 항목. 호스트(편집기 창)가 토스트로 드러낸다 — 부팅은 막지 않는다.
  readonly onBootRepairs?: (repairs: readonly string[]) => void;
};

/** 한 번의 부팅 요청. 복구 «다시 시도» 는 이 요청을 새 세대로 그대로 다시 돌린다. */
type PlayBootRequest = {
  // 이미 만들어진 세션(저장 불러오기 / 선택-이벤트 테스트). 없으면 예비검사 뒤에 새로 만든다.
  readonly session?: PlaySession;
  readonly spawn?: { readonly mapId: string; readonly x: number; readonly y: number };
  readonly eventTestId?: string;
  readonly safeMode?: boolean;
  /** 클리어 기록의 이월 필드를 입힌 새 세션(강하게 다시 하기). */
  readonly newGamePlus?: boolean;
  /** 새 게임 난이도 선택 창에서 고른 난이도. 생략 = system.defaultDifficultyId(또는 첫 줄). */
  readonly difficultyId?: string;
};

const MENU_CLOSE_JUICE_MS = 250;
const TITLE_CONFIRM_JUICE_MS = 180;

export function renderPlayer(main: HTMLElement, options: RenderPlayerOptions = {}): void {
  teardownShell?.();
  setSavePublication(store.getCurrent().meta.publication, options.saveIsolationScope);
  clearChildren(main);
  const audioEngine = getAudioEngine({ qaInstrumentation: options.qaInstrumentation === true });

  let openingController: AbortController | null = null;
  let openingMusicPlayback: ReturnType<typeof playCinematicSequence> | undefined;
  const cinematicAssets = createCinematicAssets();
  const audioWarmup = createRuntimeAudioWarmup();
  let titleConfirmTimer: ReturnType<typeof setTimeout> | undefined;
  let game: Phaser.Game | null = null;
  let startRun = 0;
  let playStartedAt = 0;
  let titleMenuIndex = 0;
  let titleConfirming = false;
  let loadDetach: (() => void) | null = null;
  let cleanupPlaySurface: (() => void) | null = null;
  let touchPad: TouchPadHandle | null = null;
  let playStage: HTMLElement | null = null;
  let hostFullscreenCleanup: (() => void) | null = null;
  // 예비검사로 고친(또는 안전 모드로 깎은) 프로젝트를 런타임에 올려 둔 동안의 해제 손잡이.
  let releaseBootProject: (() => void) | null = null;
  // 마지막 부팅 요청 — 복구 패널의 다시 시도 / 안전 모드가 같은 런을 재현하는 근거.
  let lastBootRequest: PlayBootRequest = { safeMode: options.safeMode === true };
  // teardownPlayer 이후에 호스트 버튼/F5 가 들어와도 새 런(타이머·리스너)을 만들지 않는다.
  let shellActive = true;
  const surfaceScaleMode: PlaySurfaceScaleMode = options.surfaceScaleMode ?? "integer";
  // 재시작용 시작 지점. 선택-이벤트 테스트는 호출자가 세션을 주므로 그 세션이 플레이 중
  // 이동하기 전인 마운트 시점의 스폰만 붙잡아 둔다.
  const restartSpawn: { readonly mapId: string; readonly x: number; readonly y: number } | undefined =
    options.startOverride ??
    (options.initialSession
      ? {
          mapId: options.initialSession.currentMapId,
          x: options.initialSession.x,
          y: options.initialSession.y,
        }
      : undefined);
  const layout = el("div", {
    class: "player-layout system-shell",
    dataset: { playInputOwner: "keyboard-only" },
  });
  const cleanupPointerBlocker = installPlayPointerBlocker(layout);
  main.append(layout);

  const stopGame = (): void => {
    openingMusicPlayback?.teardown();
    openingMusicPlayback = undefined;
    openingController?.abort();
    openingController = null;
    clearTimeout(titleConfirmTimer);
    titleConfirmTimer = undefined;
    startRun += 1;
    loadDetach?.();
    loadDetach = null;
    touchPad?.cleanup();
    touchPad = null;
    // 전투가 끝나기 전에 플레이를 닫으면(편집으로/x) battleScene 지역변수가 도달 불가가 되어
    // 틱·keydown·ResizeObserver 가 새어나간다. host 기준으로 컨트롤러를 정리한다(결함 1c).
    if (playStage) destroyBattleSceneOnHost(playStage);
    hostFullscreenCleanup?.();
    hostFullscreenCleanup = null;
    cleanupPlaySurface?.();
    cleanupPlaySurface = null;
    playStage = null;
    playStartedAt = 0;
    // 고친 프로젝트 스냅숏은 런과 수명이 같다. LIFO 로 풀어야 호스트(테스트 플레이 창)가
    // 올려 둔 샌드박스 스냅숏이 되돌아온다.
    releaseBootProject?.();
    releaseBootProject = null;
    statusMenu.reset();
    if (game) {
      if (options.trackGlobalGame === false) {
        game.destroy(true);
      } else {
        destroyGame();
      }
      game = null;
    }
  };

  // 호스트 셸 컨트롤(전체화면 ⛶)을 새 플레이 서피스에 마운트. hostBridge 가 없거나
  // Fullscreen API 부재면 no-op(null) — 에디터 테스트플레이에는 아무것도 렌더되지 않는다.
  const mountHostControls = (viewport: HTMLElement): void => {
    hostFullscreenCleanup?.();
    hostFullscreenCleanup = mountHostFullscreenToggle({
      bridge: options.hostBridge,
      viewport,
      fullscreenRoot: main,
    });
  };

  const activeScene = (): PlayScene | undefined => {
    if (!game) return undefined;
    const scene = game.scene.getScene("PlayScene");
    return isPlayScene(scene) ? scene : undefined;
  };

  // 새 세션 생성. 예비검사가 고친 프로젝트를 명시적으로 받고, spawn 이 있으면 시작 맵/좌표를
  // 오버라이드한다("여기서 테스트"). store 스냅숏 지원 여부와 무관하게 이 프로젝트만 쓴다.
  const newSession = (
    spawn: { readonly mapId: string; readonly x: number; readonly y: number } | undefined,
    bootProject: ReturnType<typeof store.getCurrent>,
  ): PlaySession => {
    const session = startSession(bootProject);
    if (spawn) {
      applyStatePreset(session, testHerePreset(spawn.mapId, spawn.x, spawn.y));
    }
    return session;
  };

  const startGame = (request: PlayBootRequest = {}): void => {
    if (!shellActive) return;
    stopGame();
    const opening = store.getCurrent().system.opening;
    const bypass = request.session || options.startOverride || options.initialEventTestId || request.eventTestId
      || options.shouldPlayOpening?.() === false;
    bootRun(request, !bypass && opening?.enabled && opening.scenes.length ? opening : undefined);
  };

  const bootRun = (request: PlayBootRequest, opening?: NonNullable<ReturnType<typeof store.getCurrent>['system']['opening']>): void => {
    stopGame();
    // 새 플레이 런은 이전 런의 오토세이브 디바운스 기준 시각을 물려받지 않는다.
    resetAutosaveDebounce();
    lastBootRequest = request;
    const eventTestId = request.eventTestId ?? "";
    // 예비검사: 없는 시작 맵/타일셋, 빈 파티, 통행 불가 시작 좌표를 Phaser 앞에서 고친다.
    const preflight = preflightProjectForPlay(store.getCurrent(), request.spawn ?? options.startOverride);
    const bootProject = request.safeMode === true ? safeModeProject(preflight.project) : preflight.project;
    releaseBootProject = installBootProject(bootProject);
    const repairs = repairSummaries(preflight.repairs);
    if (repairs.length > 0) {
      try {
        options.onBootRepairs?.(repairs);
      } catch (repairReportError) {
        console.error("[player] onBootRepairs callback failed:", repairReportError);
      }
    }
    warnIfPlayBootIssues(store.getCurrent());
    const run = ++startRun;
    const startedAt = performance.now();
    playStartedAt = startedAt;
    clearChildren(layout);
    const surface = createPlaySurface(resolvePlayResolution(store.getCurrent().system), surfaceScaleMode, store.getCurrent().system.displayFilter);
    playStage = surface.stage;
    layout.append(surface.viewport);
    mountHostControls(surface.viewport);
    // 엔진/에셋 기동 동안 검은 화면만 보이지 않도록 단계 표시.
    const loading = mountPlayLoadingOverlay(layout, "engine");
    // Normal opening boots have no visible loading card. Recovery can reveal this same overlay.
    if (opening) { loading.root.hidden = true; loading.root.style.display = 'none'; }
    surface.sync();
    cleanupPlaySurface = surface.cleanup;
    // 터치 기기에서만 가상 패드를 부착(데스크톱은 no-op). 방향키/Enter/Escape
    // 합성 이벤트로 기존 키보드 입력 경로(이동/대사/메뉴)를 그대로 구동한다.
    touchPad = createTouchPad(surface.stage);
    if (preflight.blockers.length > 0) {
      // 고칠 수 없는 상태(맵 0개 등)는 Phaser 를 띄우지 않는다 — 왜 못 노는지를 그대로 말한다.
      presentRecovery(loading, run, {
        kind: "preflight-blocked",
        blockers: preflight.blockers,
        detail: "preflightProjectForPlay",
      }, repairs);
      return;
    }
    // 세션은 고친 프로젝트에서 만든다(요청이 세션을 들고 왔으면 그것을 그대로 쓴다).
    const session = request.session ?? newSession(effectiveSpawn(request, bootProject), bootProject);
    const clear = readClearRecord(window.localStorage);
    if (!request.session && request.newGamePlus && clear) applyClearCarry(bootProject, session, clear.carry);
    // 회차는 기기 기록이다 — 새 게임이든 불러오기든 부팅마다 최신 기록을 세션에 비춘다.
    const history = clearHistoryOf(clear);
    if (history) session.clearHistory = history;
    else delete session.clearHistory;
    if (!request.session && request.difficultyId) setSessionDifficulty(bootProject.system, session, request.difficultyId);
    if (!opening) {
      void bootPlayGame(surface.phaserContainer, session, eventTestId, loading, run, startedAt, repairs);
      return;
    }
    stopTitleBgm();
    const controller = new AbortController();
    openingController = controller;
    let lastFrame = '#000', handoffFadeMs = 500;
    const playback = playCinematicSequence({ host: surface.stage, project: bootProject, sequence: opening,
      signal: controller.signal, assets: cinematicAssets, holdMusicOnComplete: true, musicHost: main,
      musicVolume: () => audioEngine.audioStateSnapshot().volume.bgm,
      onFrame: (url, fadeMs) => { lastFrame = url; if (fadeMs !== undefined) handoffFadeMs = fadeMs; } });
    openingMusicPlayback = playback;
    // Start the real engine, decode textures and assemble the map during the cinematic.
    // PlayScene gates time, events, input and map audio until the presentation handoff.
    const prepared = bootPlayGame(surface.phaserContainer, session, eventTestId, loading, run, startedAt, repairs, true);
    void playback.done.then(async result => {
      if (result === 'aborted' || run !== startRun || !shellActive) return;
      openingController = null;
      // Retain the last composition if a short opening/early skip beats map readiness.
      const cover = el('div', { class: 'cinematic-sequence', dataset: { testid: 'opening-map-handoff' } });
      if (lastFrame.startsWith('#')) cover.style.background = lastFrame;
      else cover.append(el('img', { class: 'cinematic-image', attrs: { src: lastFrame, alt: '' } }));
      surface.stage.append(cover);
      await prepared;
      if (run !== startRun || !shellActive) { cover.remove(); return; }
      const scene = activeScene();
      if (!scene || loading.root.dataset.stage === 'error') { cover.remove(); return; }
      playback.releaseMusic(result === 'skipped' ? 0 : 600);
      // No gameplay advances behind the departing cover, even the start-map autorun.
      const fadeMs = result === 'skipped' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : handoffFadeMs;
      if (fadeMs > 0) await cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, fill: 'forwards' }).finished.catch(() => undefined);
      cover.remove();
      if (run !== startRun || !shellActive) return;
      scene.activateInitialPresentation();
      surface.stage.focus({ preventScroll: true });
    });
  };

  // 예비검사가 시작 맵/좌표를 재배선했으면 그 결과가 곧 이번 런의 스폰이다.
  const effectiveSpawn = (
    request: PlayBootRequest,
    bootProject: ReturnType<typeof store.getCurrent>,
  ): { readonly mapId: string; readonly x: number; readonly y: number } | undefined => {
    const requested = request.spawn ?? options.startOverride;
    if (!requested) return undefined;
    return { mapId: bootProject.startMapId, x: bootProject.startPos.x, y: bootProject.startPos.y };
  };

  // 세 갈래 막다른 문구를 대신하는 단 하나의 출구. 낡은 런은 조용히 접는다(새 런을 덮지 않는다).
  const presentRecovery = (
    loading: PlayLoadingOverlay,
    run: number,
    context: PlayBootFailureContext,
    repairs: readonly string[],
  ): void => {
    if (run !== startRun) return;
    openingController?.abort();
    openingController = null;
    openingMusicPlayback?.releaseMusic(600);
    const described = describeBootFailure(context);
    // 부팅이 ready 를 지나 오버레이를 이미 걷어낸 뒤 터졌을 수도 있다 → 그때는 새로 올린다.
    const overlay = loading.root.isConnected ? loading : mountPlayLoadingOverlay(layout, "error");
    overlay.root.hidden = false;
    overlay.root.style.removeProperty('display');
    overlay.showRecovery({
      title: described.title,
      reason: described.reason,
      diagnostics: described.diagnostics,
      ...(repairs.length > 0 ? { repairs } : {}),
      onRetry: () => retryBoot(),
      // 안전 모드는 저작 내용 문제를 우회하는 수단이다 — 맵이 아예 없는 상태는 우회할 수 없다.
      ...(context.kind === "preflight-blocked" ? {} : { onSafeMode: () => retryBoot(true) }),
      // 해시 청크 404 는 in-page retry 가 같은 옛 URL 을 다시 부른다 — 새로고침이 탈출구다.
      ...(isEngineModuleLoadFailure(context.error) ? { onReload: () => window.location.reload() } : {}),
    });
  };

  // 다시 시도 / 안전 모드: 마지막 요청을 **새 세대로** 처음부터 다시 돌린다.
  const retryBoot = (safeMode?: boolean): void => {
    if (!shellActive) return;
    startGame({ ...lastBootRequest, safeMode: safeMode ?? lastBootRequest.safeMode === true });
  };

  const bootPlayGame = async (
    phaserContainer: HTMLElement,
    session: PlaySession | undefined,
    eventTestId: string,
    loading: PlayLoadingOverlay,
    run: number,
    startedAt: number,
    repairs: readonly string[],
    presentationPending = false
  ): Promise<void> => {
    let resolveReady: (() => void) | null = null;
    const diagnosticOwner = diagnosticToken();
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const signalReady = (): void => {
      if (resolveReady && !presentationPending) openingMusicPlayback?.releaseMusic(600);
      resolveReady?.();
      resolveReady = null;
    };
    const mapId = session?.currentMapId ?? options.startOverride?.mapId ?? store.getCurrent().startMapId;
    const bootDiag = (
      stage: "engine" | "assets" | "map" | "ready" | "refresh" | "error" | "timeout",
      ok: boolean,
      extra?: { error?: unknown; detail?: string },
    ): void => {
      if (run !== startRun) return;
      recordPlayBootDiagnostic(
        {
          stage,
          ok,
          mapId,
          eventTestId: eventTestId || undefined,
          elapsedMs: performance.now() - startedAt,
          ...extra,
        },
        options.diagnosticSink,
        diagnosticOwner,
      );
    };
    try {
      loading.setStage("engine");
      loading.setProgress(0.08);
      bootDiag("engine", true, { detail: "startPlayGame" });
      const nextGame = await startPlayGame(phaserContainer, session, {
        initialPresentationPending: presentationPending,
        qaInstrumentation: options.qaInstrumentation,
        keyboardOnly: true,
        initialEventTestId: eventTestId,
        trackGlobalGame: options.trackGlobalGame,
        onPlayLoadProgress: (ratio: number) => {
          if (run !== startRun) return;
          loading.setStage("assets");
          // engine ~ assets 구간: 0.15..0.85
          loading.setProgress(0.15 + Math.max(0, Math.min(1, ratio)) * 0.7);
        },
        onPlayLoadStage: (stage: "map" | "ready") => {
          if (run !== startRun) return;
          if (stage === "map") {
            loading.setStage("map");
            loading.setProgress(0.9);
            bootDiag("map", true);
            return;
          }
          loading.setStage("ready");
          loading.setProgress(1);
          bootDiag("ready", true, { detail: "PlayScene.create finished" });
          // 오버레이를 즉시 내려 맵이 보이게 한다. 이후 refresh 는 best-effort.
          loading.remove();
          signalReady();
        },
        onPlaySceneReady: () => {
          if (run !== startRun) return;
          loading.remove();
          signalReady();
        },
      });
      if (run !== startRun) {
        nextGame.destroy(true);
        loading.remove();
        return;
      }
      game = nextGame;
      const dialogue = createDialogueUI(playStage!);
      game.registry.set("dialogue", dialogue);
      game.registry.set("dialogueHost", playStage);
      game.registry.set("returnToTitle", () => renderTitle());
      game.registry.set("recordEndingClear", (endingId: string, endedSession: PlaySession) => {
        try {
          recordEndingClear(window.localStorage, store.getCurrent(), endedSession, endingId);
        } catch (error) {
          console.error("[player] 클리어 기록을 저장하지 못했습니다:", error);
        }
      });
      game.registry.set("openSaveMenu", () => openEventMenu(layout, statusMenu.openSaveMenu));
      game.registry.set("openMenuScreen", () => openEventMenu(layout, () => {
        statusMenu.reset();
        statusMenu.renderMenu();
      }));
      game.registry.set("openLoadMenu", () => openEventMenu(layout, () => {
        statusMenu.reset();
        renderLoad(false);
      }));
      game.registry.set("openLifeRecoveryLedger", () => openEventMenu(layout, statusMenu.openLifeRecoveryLedger));

      // create() 가 이미 끝났을 수도 있으므로 ready 콜백 + 폴링으로 모두 커버.
      const ready = await waitForPlaySceneReady(nextGame, () => startRun === run, readyPromise);
      if (run !== startRun) {
        nextGame.destroy(true);
        loading.remove();
        return;
      }
      if (!ready.ok) {
        bootDiag("timeout", false, { detail: ready.reason });
        presentRecovery(loading, run, {
          kind: "ready-timeout",
          readyReason: ready.reason,
          mapId,
          elapsedMs: performance.now() - startedAt,
          detail: "waitForPlaySceneReady",
        }, repairs);
        return;
      }
      // ready 이후 무거운 refresh 가 오버레이를 가두지 않도록 이미 remove 한 뒤 실행.
      try {
        const scene = nextGame.scene.getScene("PlayScene");
        if (isPlayScene(scene)) {
          bootDiag("refresh", true, { detail: "refreshRuntimeSurfaces" });
          scene.refreshRuntimeSurfaces();
        }
      } catch (refreshError) {
        bootDiag("refresh", false, { error: refreshError, detail: "refreshRuntimeSurfaces threw" });
        console.error("[player] refreshRuntimeSurfaces failed:", refreshError);
      }
      markPlayRender(startedAt);
      loading.remove();
      bootDiag("ready", true, { detail: "boot complete" });
      signalReady();
      clearStaleModuleReloadMark();
      try {
        options.onPlayBootSuccess?.();
      } catch (callbackError) {
        console.error("[player] onPlayBootSuccess callback failed:", callbackError);
      }
    } catch (error) {
      console.error("[player] failed to start play game:", error);
      if (isEngineModuleLoadFailure(error) && consumeStaleModuleReload()) {
        markStaleModuleReloaded();
        bootDiag("error", false, { error, detail: "stale-module-reload" });
        try {
          if (store.hasUnsavedChanges()) await store.flush();
        } catch {
          // 새로고침은 저장 실패와 무관하게 진행한다 — 옛 해시로는 플레이가 안 된다.
        }
        window.location.reload();
        return;
      }
      bootDiag("error", false, { error, detail: "bootPlayGame catch" });
      presentRecovery(loading, run, {
        kind: "boot-threw",
        error,
        mapId,
        elapsedMs: performance.now() - startedAt,
        detail: "bootPlayGame catch",
      }, repairs);
    }
  };

  const loadSlot = (slot: SaveSlotIndex, fromTitle: boolean): void => {
    const result = readSaveSlot(window.localStorage, slot);
    if (result.kind !== "present") {
      renderLoad(fromTitle, `${slot}번 저장 칸을 불러올 수 없습니다`);
      return;
    }
    const blocker = snapshotLoadBlocker(store.getCurrent(), result.snapshot);
    if (blocker) {
      renderLoad(fromTitle, `${slot}번 저장 칸을 불러올 수 없습니다 — ${blocker}`);
      return;
    }
    let restored: PlaySession;
    try {
      restored = applySaveSnapshot(store.getCurrent(), result.snapshot);
    } catch (error) {
      if (!(error instanceof LifeReconciliationError)) throw error;
      renderLoad(fromTitle, `${slot}번 저장 칸을 불러올 수 없습니다`);
      return;
    }
    if (fromTitle || !game) {
      startGame({ session: restored });
      return;
    }
    activeScene()?.applySession(restored);
    closeMenu();
  };

  // 타이틀 "이어하기" / 로드 패널 오토세이브 카드 — loadSlot 과 동형: 파싱 성공 시
  // applySaveSnapshot → startGame(restored), 실패 시 로드 패널로 안내한다.
  const loadAutosave = (fromTitle: boolean): void => {
    const result = readAutosave(window.localStorage);
    if (result.kind !== "present") {
      renderLoad(fromTitle, "자동 저장을 불러올 수 없습니다");
      return;
    }
    const blocker = snapshotLoadBlocker(store.getCurrent(), result.snapshot);
    if (blocker) {
      renderLoad(fromTitle, `자동 저장을 불러올 수 없습니다 — ${blocker}`);
      return;
    }
    let restored: PlaySession;
    try {
      restored = applySaveSnapshot(store.getCurrent(), result.snapshot);
    } catch (error) {
      if (!(error instanceof LifeReconciliationError)) throw error;
      renderLoad(fromTitle, "자동 저장을 불러올 수 없습니다");
      return;
    }
    if (fromTitle || !game) {
      startGame({ session: restored });
      return;
    }
    activeScene()?.applySession(restored);
    closeMenu();
  };

  // 타이틀 메뉴에 "이어하기"를 노출할지 — 오토세이브가 실제 파싱 가능한 상태일 때만.
  const isAutosaveAvailable = (): boolean => {
    try {
      const result = readAutosave(window.localStorage);
      return result.kind === "present" && snapshotLoadBlocker(store.getCurrent(), result.snapshot) === null;
    } catch {
      return false;
    }
  };

  // 켜 두었고 클리어 기록이 있을 때만 타이틀 항목 이름을 돌려준다(없으면 항목이 숨는다).
  const newGamePlusTitleLabel = (): string | undefined => {
    const project = store.getCurrent();
    if (project.system.newGamePlus?.enabled !== true) return undefined;
    try {
      return readClearRecord(window.localStorage) ? newGamePlusMenuLabel(project) : undefined;
    } catch {
      return undefined;
    }
  };

  const renderLoad = (fromTitle: boolean, message?: string): void => {
    if (fromTitle) {
      stopGame();
      clearChildren(layout);
    }
    const panel = renderPlayerLoadPanel({
      fromTitle,
      message,
      onBack: () => (fromTitle ? renderTitle() : closeMenu()),
      onLoadSlot: (slot) => loadSlot(slot, fromTitle),
      onLoadAutosave: () => loadAutosave(fromTitle),
    });
    if (fromTitle) {
      const surface = createPlaySurface(resolvePlayResolution(store.getCurrent().system), surfaceScaleMode, store.getCurrent().system.displayFilter);
      clearChildren(surface.stage);
      playStage = surface.stage;
      cleanupPlaySurface = surface.cleanup;
      layout.append(surface.viewport);
      mountHostControls(surface.viewport);
      surface.stage.append(panel);
      surface.sync();
    } else {
      replaceMenu(panel);
    }
    // 세이브 슬롯 + 뒤로 를 방향키로 선택, Z/Enter 불러오기, X/Esc(=뒤로) 취소.
    const slots = Array.from(panel.querySelectorAll<HTMLElement>("[data-testid^='save-slot-']"))
      .filter((el) => el.tagName === "BUTTON");
    const back = panel.querySelector<HTMLElement>("[data-testid='player-load-back']");
    loadDetach?.();
    loadDetach = attachCursorMenu(panel, {
      items: back ? [...slots, back] : slots,
      cancelEl: back,
    });
  };

  const replaceMenu = (panel: HTMLElement): void => {
    layout.querySelector("[data-testid='main-menu']")?.remove();
    panel.dataset.testid = "main-menu";
    (playStage ?? layout).append(panel);
  };

  const closeMenu = (): void => {
    loadDetach?.();
    loadDetach = null;
    layout.querySelector("[data-testid='main-menu']")?.remove();
  };

  const closeMenuWithJuice = (): void => {
    const menu = currentStatusMenu(layout);
    if (!menu) return;
    emitMenuJuice("menu-close");
    closeStatusMenu(menu);
  };

  const emitMenuJuice = (event: RuntimeJuiceEvent, target?: HTMLElement | null): void => {
    emitRuntimeJuice({ event, target: target ?? layout.querySelector<HTMLElement>("[data-testid='main-menu']"),
      project: store.getCurrent(), session: activeScene()?.session });
  };

  const statusMenu = createPlayerStatusMenuController({
    layout,
    getActiveScene: activeScene,
    getPlayStage: () => playStage,
    getPlayStartedAt: () => playStartedAt,
    closeMenu,
    closeMenuWithJuice,
    renderTitle: () => renderTitle(),
    emitMenuJuice,
    menuCloseJuiceMs: MENU_CLOSE_JUICE_MS,
    loadSlot,
  });

  const handleTitleKey = (key: RuntimeMenuKey): boolean => {
    // 불러오기 패널도 testid=title-screen 이지만 data-screen 을 달고 있다(자체 커서 메뉴가
    // 키를 처리). 이걸 진짜 타이틀로 오인하면 방향키가 renderTitle 로 패널을 덮어쓴다(B1).
    const titleEl = layout.querySelector<HTMLElement>("[data-testid='title-screen']");
    if (game || !titleEl || titleEl.hasAttribute("data-screen")) return false;
    if (titleConfirming) return true;
    const project = store.getCurrent();
    const settings = currentTitleSettings(project);
    const options = listTitleMenuOptions(settings, { autosaveAvailable: isAutosaveAvailable(), newGamePlusLabel: newGamePlusTitleLabel() });
    const visibleCount = options.length;
    titleMenuIndex = clampTitleMenuIndex(titleMenuIndex, visibleCount);
    const titleDir = directionForKey(key);
    if (titleDir === "down" || titleDir === "up") {
      titleMenuIndex = moveTitleSelection(titleMenuIndex, titleDir === "down" ? "ArrowDown" : "ArrowUp", visibleCount);
      updateTitleSelection(titleEl, titleMenuIndex);
      emitTitleJuice("title-select");
      return true;
    }
    // Horizontal arrows are also title input, never browser scrolling.
    if (titleDir) return true;
    if (!isConfirmKey(key)) return false;
    const selected = options[titleMenuIndex];
    // 크레딧은 타이틀을 떠나지 않는다 — 확정 연출·BGM 정지 없이 창만 띄운다.
    if (selected?.id === "credits") {
      openTitleCredits();
      return true;
    }
    confirmTitleThen(() => activateTitleOption(selected?.id), selected?.id === "newGame");
    return true;
  };

  // 서피스 목록은 keyBindings 가 정본이다(서피스 로컬 재구현 금지).
  const isDialogueSurfaceActive = (): boolean => isInputCapturingSurfaceActive(playStage);

  // 상점/여관/불러오기 같은 런타임 모달이 떠 있으면 전역 타이틀/메뉴 입력을 양보한다(B2).
  // 각 모달은 자체 커서 메뉴가 키를 처리하므로, 여기서 조기 return 해 이중 처리를 막는다.
  const isModalOverlayActive = (): boolean => {
    const viewport = playStage?.closest(".play-viewport") ?? playStage ?? layout;
    if (
      viewport?.querySelector(
        "[data-testid='shop-scene'], [data-testid='inn-scene'], [data-testid='chest-scene'], [data-testid='game-over-screen'], [data-testid='ending-screen'], [data-testid='battle-scene']"
      )
    ) {
      return true;
    }
    return Boolean(layout.querySelector("[data-testid='title-screen'][data-screen]"));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // 텍스트 입력 컨트롤(런타임 디버그 패널의 숫자 입력 등)에 치는 글자는 게임 키가 아니다. 여기서
    // 걸러야 손 슬롯 숫자키가 preventDefault 로 글자를 삼키지 않고, Escape 가 메뉴를 열지 않는다.
    if (event.isComposing || isTextEntryTarget(event.target)) return;
    if (openingController || game?.registry.get('initialPresentationPending') === true || layout.querySelector('[data-testid="opening-map-handoff"]')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const menu = currentStatusMenu(layout);
    if (menu && event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      emitMenuJuice("menu-invalid", menu);
      return;
    }
    const overlayActive = isDialogueSurfaceActive() || isModalOverlayActive();
    const scene = activeScene();
    // `PlayScene.session` is a `declare` field: type-only, with no runtime initialization, and
    // it is first assigned partway through create(). This DOM keydown handler is bound to the
    // document, so it fires independently of Phaser's scene lifecycle and can observe a
    // constructed scene whose session does not exist yet — reading `.flags` off it threw
    // "Cannot read properties of undefined (reading 'flags')". The type says `PlaySession`,
    // never `PlaySession | undefined`, so neither tsc nor a reader can see the gap: do not
    // "simplify" this guard away as redundant. A scene without a session is not input-ready.
    const sceneSession = scene?.session as PlaySession | undefined;
    const cutsceneLocked = Boolean(sceneSession && isCutsceneInputLocked(sceneSession));
    // 손 슬롯 전환은 필드 전용이다. isRuntimeMenuKey 가드보다 앞에 둬야 숫자키가 여기까지
    // 도달하지만(숫자키는 런타임 메뉴 키가 아니다), 대사·모달·상태메뉴·컷신 잠금 중엔 아무 일도 없어야 한다.
    if (sceneSession && !menu && !overlayActive && !cutsceneLocked) {
      const cycle = handSlotCycleDelta(key);
      const digit = handSlotDigit(key);
      if (cycle !== undefined) {
        event.preventDefault();
        cycleHandSlot(store.getCurrent(), sceneSession, cycle);
        return;
      }
      if (digit !== undefined) {
        event.preventDefault();
        selectHandSlot(store.getCurrent(), sceneSession, digit);
        return;
      }
    }
    if (!isRuntimeMenuKey(key)) return;
    if (overlayActive) return;
    // Holding a key may navigate a list, but must not confirm another screen,
    // spend another item, or reopen the menu that the first cancel just closed.
    if (event.repeat && (isConfirmKey(key) || isCancelKey(key))) {
      event.preventDefault();
      return;
    }
    if (cutsceneLocked && !layout.querySelector("[data-testid='main-menu']")) {
      if (isCancelKey(key)) event.preventDefault();
      return;
    }
    if (handleTitleKey(key) || statusMenu.handleKey(key)) {
      event.preventDefault();
      return;
    }
    if (isMenuKey(key)) {
      event.preventDefault();
      statusMenu.toggleMenu();
    }
  };

  const renderTitle = (titleOptions: { readonly emitEnterJuice?: boolean } = {}): void => {
    titleConfirming = false;
    const firstEnter = titleOptions.emitEnterJuice ?? true;
    // 방향키 재렌더가 파티클 canvas/레이어 스택을 파괴하지 않도록, 지우기 전에 기존 fx 노드를
    // 붙잡아 renderTitleScreen 에 넘긴다(설정 서명이 같으면 같은 노드가 새 루트로 move 된다).
    const previousFx = layout.querySelector<HTMLElement>("[data-testid='title-fx']");
    const previousEffects = layout.querySelector<HTMLElement>("[data-testid='title-effects']");
    // 모드 전환이 오디오 소유권을 가져간다. stopGame 의 게임 파괴는 Phaser 다음 프레임에
    // 실제로 일어나고 그 씬의 destroy 이 공유 엔진을 통째로 멈춘다 — 아래에서 켜는
    // 타이틀 BGM 이 그 정리에 쓸려 사라졌다(실측: 패배 후 타이틀 화면이 무음이 됐다).
    // 이전 런의 BGM/BGS 는 여기서 직접 멈춰 무음으로 남지 않게 한다.
    game?.registry.set(AUDIO_HANDOFF_REGISTRY_KEY, true);
    stopGame();
    stopAllAudio();
    clearChildren(layout);
    const project = store.getCurrent();
    const settings = currentTitleSettings(project);
    const titleContext = {
      autosaveAvailable: isAutosaveAvailable(),
      newGamePlusLabel: newGamePlusTitleLabel(),
      // intro 등장 연출은 최초 진입에만 — 방향키 이동(emitEnterJuice:false)에는 재생하지 않는다.
      playIntro: firstEnter,
      reuseFx: previousFx,
      reuseEffects: previousEffects,
    };
    const options = listTitleMenuOptions(settings, titleContext);
    titleMenuIndex = clampTitleMenuIndex(titleMenuIndex, options.length);
    // 타이틀을 보는 동안 맵/캐릭셋 이미지를 HTTP 캐시에 미리 올려
    // "새 게임" 직후 로딩 체감을 줄인다(Phaser 텍스처 등록은 여전히 씬 preload).
    const surface = createPlaySurface(resolvePlayResolution(project.system), surfaceScaleMode, project.system.displayFilter);
    clearChildren(surface.stage);
    playStage = surface.stage;
    cleanupPlaySurface = surface.cleanup;
    // 타이틀 확정은 키보드와 메뉴 클릭이 같은 activateTitleOption 으로 모인다.
    // 변형(엔딩·마지막 저장)을 입힌 설정으로 그린다 — 배경·음악만 바뀌고 나머지는 저작 그대로다.
    const titleProject = settings === project.system.titleScreen ? project : { ...project, system: { ...project.system, titleScreen: settings } };
    const title = renderTitleScreen(titleProject, {
      onNewGame: () => confirmTitleThen(() => activateTitleOption("newGame"), true),
      onNewGamePlus: () => confirmTitleThen(() => activateTitleOption("newGamePlus"), true),
      onResume: () => confirmTitleThen(() => activateTitleOption("resume")),
      onContinue: () => confirmTitleThen(() => activateTitleOption("continueGame")),
      onCredits: () => openTitleCredits(),
      onQuit: () => confirmTitleThen(() => activateTitleOption("quit")),
    }, titleMenuIndex, titleContext);
    layout.append(surface.viewport);
    mountHostControls(surface.viewport);
    surface.stage.append(title);
    focusSelectedTitleOption(title);
    surface.sync();
    startTitleBgm(titleProject);
    // Let the title paint before scans/engine imports. No game/session starts in the background.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!shellActive || !firstEnter) return;
      cinematicAssets.warm(project, project.system.opening);
      const field = resolveMapBgm(project, project.startMapId);
      audioWarmup.warm(project, [titleProject.system.titleScreen?.musicResourceId,
        ...Object.values(titleProject.system.titleScreen?.sounds ?? {}),
        field.kind === 'play' ? field.resourceId : undefined]);
      void warmBundledPlayAssets(project);
      void warmPlayGameRuntime().catch(() => undefined); // Actual boot retains normal recovery/retry.
    }));
    if (firstEnter) emitTitleJuice("title-enter");
  };

  const openTitleCredits = (): void => {
    emitTitleJuice("title-confirm");
    openLicenseDialog(() => {
      emitTitleJuice('menu-back');
      const titleEl = layout.querySelector<HTMLElement>("[data-testid='title-screen']");
      if (titleEl) focusSelectedTitleOption(titleEl);
    });
  };

  // 타이틀 변형 판정 입력 — 클리어 기록의 엔딩과 가장 최근 저장의 맵. 저장소 오류는 «변형 없음»으로 본다.
  const currentTitleSettings = (project: ReturnType<typeof store.getCurrent>) => {
    const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
    if (!settings.variants?.length) return settings;
    try {
      const latest = readLatestSave(window.localStorage);
      return applyTitleVariant(settings, {
        endingIds: readClearRecord(window.localStorage)?.endingIds ?? [],
        lastSaveMapId: latest?.snapshot.session.currentMapId,
      });
    } catch {
      return settings;
    }
  };

  // 난이도가 둘 이상이면 새 게임 전에 묻는다. 「뒤로」는 타이틀로 돌아간다.
  const renderDifficultyPicker = (): void => {
    stopGame();
    clearChildren(layout);
    const project = store.getCurrent();
    const surface = createPlaySurface(resolvePlayResolution(project.system), surfaceScaleMode, project.system.displayFilter);
    clearChildren(surface.stage);
    playStage = surface.stage;
    cleanupPlaySurface = surface.cleanup;
    const panel = renderDifficultyPanel({
      project,
      difficulties: difficultiesOf(project.system),
      selectedId: initialDifficultyId(project.system),
      onPick: (difficultyId) => {
        loadDetach?.();
        loadDetach = null;
        startGame({ safeMode: options.safeMode === true, difficultyId });
      },
      onBack: () => {
        loadDetach?.();
        loadDetach = null;
        renderTitle();
      },
    });
    layout.append(surface.viewport);
    mountHostControls(surface.viewport);
    surface.stage.append(panel);
    surface.sync();
    const buttons = Array.from(panel.querySelectorAll<HTMLElement>("[data-testid^='difficulty-option-']"));
    const back = panel.querySelector<HTMLElement>("[data-testid='player-difficulty-back']");
    const selected = Math.max(0, buttons.findIndex((button) => button.getAttribute("aria-current") === "true"));
    loadDetach?.();
    loadDetach = attachCursorMenu(panel, { items: back ? [...buttons, back] : buttons, cancelEl: back, initialIndex: selected });
  };

  // 「시작하면 바로 이어하기」: 가장 최근 저장이 있으면 타이틀을 건너뛴다. 불러오지 못하면 타이틀로 떨어진다.
  const tryResumeOnLaunch = (): boolean => {
    let latest: ReturnType<typeof latestResumableSave>;
    try {
      latest = latestResumableSave(store.getCurrent(), window.localStorage);
    } catch {
      return false;
    }
    if (!latest) return false;
    if (latest.source === "autosave") loadAutosave(true);
    else loadSlot(latest.slot, true);
    return true;
  };

  const activateTitleOption = (id: TitleMenuOptionId | undefined): void => {
    switch (id) {
      case "newGame": {
        const difficulties = difficultiesOf(store.getCurrent().system);
        if (difficulties.length > 1) {
          renderDifficultyPicker();
          return;
        }
        startGame({ safeMode: options.safeMode === true });
        return;
      }
      case "newGamePlus":
        startGame({ safeMode: options.safeMode === true, newGamePlus: true });
        return;
      case "resume":
        loadAutosave(true);
        return;
      case "continueGame":
        renderLoad(true);
        return;
      case "credits":
        openTitleCredits();
        return;
      case "quit":
        exitPlayer();
        return;
      default:
        return;
    }
  };

  const emitTitleJuice = (event: RuntimeJuiceEvent): void => {
    const sounds = store.getCurrent().system.titleScreen?.sounds;
    // Credits returning to the title uses the authored cancel cue.
    const soundResourceId =
      event === "title-select"
        ? sounds?.cursorSeResourceId
        : event === "title-confirm"
          ? sounds?.confirmSeResourceId
          : event === 'menu-back'
            ? sounds?.cancelSeResourceId
          : undefined;
    emitRuntimeJuice({
      event,
      target: layout.querySelector<HTMLElement>("[data-testid='title-screen']"),
      ...(soundResourceId ? { soundResourceId } : {}),
    });
  };

  // withTransition: 「새 게임」은 설정된 전환 연출(섬광·암전·확대·안개)이 끝난 뒤 게임으로 넘어간다.
  const confirmTitleThen = (callback: () => void, withTransition = false): void => {
    if (titleConfirming) return;
    titleConfirming = true;
    emitTitleJuice("title-confirm");
    const title = layout.querySelector<HTMLElement>("[data-testid='title-screen']");
    const generation = startRun;
    const beginTransition = (): void => {
      if (!shellActive || startRun !== generation) return;
      clearTimeout(titleConfirmTimer);
      title?.removeAttribute('aria-busy');
      title?.querySelector('.title-preparing')?.remove();
      stopTitleBgm();
      const transitionMs = withTransition
        ? playTitleTransition(
            layout.querySelector<HTMLElement>("[data-testid='title-screen']"),
            store.getCurrent().system.titleScreen ?? defaultTitleScreenSettings(),
          )
        : null;
      titleConfirmTimer = setTimeout(() => {
        titleConfirmTimer = undefined;
        if (!shellActive) return;
        titleConfirming = false;
        callback();
      }, transitionMs ?? TITLE_CONFIRM_JUICE_MS);
    };
    const project = store.getCurrent();
    const first = withTransition && project.system.opening?.enabled ? project.system.opening.scenes[0] : undefined;
    const url = first?.kind === 'image' ? resolveAssetResourceUrl(first.resourceId, { project }) : null;
    if (url) {
      // A fast confirmation or slow network keeps the animated title visible until the first shot is decoded.
      title?.setAttribute('aria-busy', 'true');
      titleConfirmTimer = setTimeout(() => {
        if (shellActive && startRun === generation && title?.isConnected) {
          title.append(el('div', { class: 'title-preparing', text: '이야기를 준비하고 있습니다…', attrs: { role: 'status' } }));
        }
      }, 800);
      void cinematicAssets.prepare(url).catch(() => undefined).then(beginTransition);
    } else beginTransition();
  };

  const exitPlayer = (): void => {
    if (options.onExit) {
      options.onExit();
      return;
    }
    renderTitle({ emitEnterJuice: true });
  };

  // 호스트 "다시 시작": 타이틀을 거치지 않고 진행 상태 없는 런을 다시 띄운다.
  const restartRun = (): void => {
    if (!shellActive) return;
    startGame({
      ...(restartSpawn ? { spawn: restartSpawn } : {}),
      eventTestId: options.initialEventTestId ?? "",
      safeMode: options.safeMode === true,
    });
  };

  const returnToTitle = (): void => {
    if (!shellActive) return;
    renderTitle({ emitEnterJuice: true });
  };

  document.addEventListener("keydown", onKeyDown);
  teardownShell = () => {
    shellActive = false;
    cinematicAssets.dispose();
    audioWarmup.dispose();
    document.removeEventListener("keydown", onKeyDown);
    cleanupPointerBlocker();
    stopGame();
    audioEngine.setQaInstrumentation(false);
    clearChildren(layout);
  };
  // 우선순위: 선택-이벤트 테스트(initialSession) → "여기서 테스트"(startOverride)
  //          → 자동 시작(에디터 테스트 플레이 창) → 타이틀.
  if (options.initialSession) {
    startGame({
      session: options.initialSession,
      eventTestId: options.initialEventTestId ?? "",
      safeMode: options.safeMode === true,
    });
  } else if (options.startOverride || options.autoStartRun) {
    startGame({ safeMode: options.safeMode === true });
  } else if (!tryResumeOnLaunch()) {
    renderTitle();
  }
  options.onRunControlsReady?.({ restartRun, returnToTitle });
}

export function teardownPlayer(): void {
  teardownShell?.();
  teardownShell = null;
  delete window.__oprnInput;
}

function isRuntimeMenuKey(key: string): key is RuntimeMenuKey {
  return isRuntimeMenuKeyBinding(key);
}

async function waitForPlaySceneReady(
  game: Phaser.Game,
  isCurrentRun: () => boolean,
  readyPromise: Promise<void>
): Promise<{ ok: boolean; reason: string }> {
  if (!isCurrentRun()) return { ok: false, reason: "stale-run" };
  const scene = game.scene.getScene("PlayScene");
  // create() 가 끝났으면 scene.sys.settings.status 가 RUNNING 이상.
  if (isPlayScene(scene) && scene.sys?.settings?.status >= 5 /* RUNNING */) {
    return { ok: true, reason: "already-running" };
  }
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (nextReason: string): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeout);
      game.events.off("playscene-ready", onReady);
      resolve({ ok: nextReason !== "timeout" && nextReason !== "stale-run", reason: nextReason });
    };
    const onReady = (): void => finish("event");
    void readyPromise.then(() => finish("callback"));
    game.events.once("playscene-ready", onReady);
    const pollTimer = window.setInterval(() => {
      if (!isCurrentRun()) {
        finish("stale-run");
        return;
      }
      const current = game.scene.getScene("PlayScene");
      if (isPlayScene(current) && current.sys?.settings?.status >= 5) {
        finish("poll-running");
      }
    }, 50);
    // 대용량 맵 create 가 길어도 오버레이가 영원히 남지 않게 상한.
    const timeout = window.setTimeout(() => finish("timeout"), 30_000);
  });
}

function startTitleBgm(project: ReturnType<typeof store.getCurrent>): void {
  const musicId = project.system.titleScreen?.musicResourceId?.trim();
  if (!musicId) {
    stopTitleBgm();
    return;
  }
  playAudioCommand({ resourceId: musicId, loop: true }, project);
}

/** Stop title BGM (fade). Empty musicResourceId is already silent. */
function stopTitleBgm(): void {
  stopAudioCommand();
}
