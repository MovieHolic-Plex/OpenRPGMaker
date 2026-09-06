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
import { applyStatePreset, testHerePreset } from "@/testing/debugSession";
import { el, clearChildren } from "@/util/dom";
import {
  applySaveSnapshot,
  readAutosave,
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
  renderTitleScreen,
  type TitleMenuOptionId,
} from "@/player/titleScreen";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { getAudioEngine, playAudioCommand, stopAudioCommand } from "@/player/audio";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import {
  mountPlayLoadingOverlay,
  type PlayLoadingOverlay,
} from "@/player/playLoadingOverlay";
import { warmBundledPlayAssets } from "@/assets/bundledAssetWarmup";
import {
  recordPlayBootDiagnostic,
  type PlayBootDiagnosticSink,
} from "@/player/playBootDiagnostics";
import { mountHostFullscreenToggle, type HostBridge } from "@/player/hostBridge";
import { resolvePlayResolution } from "@/project/playResolution";

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
  // 플레이 서피스 배율 정책. 배포/커뮤니티 플레이어는 정수 배율(기본)을 유지하고,
  // 에디터 테스트 플레이 창만 "fit" 으로 창을 가득 채운다.
  readonly surfaceScaleMode?: PlaySurfaceScaleMode;
  // 타이틀을 건너뛰고 새 런을 바로 시작한다. 편집 → 테스트 왕복마다 Enter 를 눌러
  // 타이틀을 통과하던 비용을 없앤다(startOverride / initialSession 가 있으면 이미 그 경로다).
  readonly autoStartRun?: boolean;
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
};

const MENU_CLOSE_JUICE_MS = 250;
const TITLE_CONFIRM_JUICE_MS = 180;

export function renderPlayer(main: HTMLElement, options: RenderPlayerOptions = {}): void {
  teardownShell?.();
  setSavePublication(store.getCurrent().meta.publication);
  clearChildren(main);
  const audioEngine = getAudioEngine({ qaInstrumentation: options.qaInstrumentation === true });

  let openingController: AbortController | null = null;
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
    const bypass = request.session || options.startOverride || options.initialEventTestId || request.eventTestId;
    if (!bypass && opening?.enabled && opening.scenes.length > 0) {
      stopTitleBgm();
      clearChildren(layout);
      const surface = createPlaySurface(resolvePlayResolution(store.getCurrent().system), surfaceScaleMode);
      playStage = surface.stage;
      cleanupPlaySurface = surface.cleanup;
      layout.append(surface.viewport);
      surface.sync();
      const controller = new AbortController();
      openingController = controller;
      const playback = playCinematicSequence({ host: surface.stage, project: store.getCurrent(), sequence: opening, signal: controller.signal });
      void playback.done.then(result => {
        if (result === "aborted" || !shellActive || openingController !== controller) return;
        openingController = null;
        bootRun(request);
      });
      return;
    }
    bootRun(request);
  };

  const bootRun = (request: PlayBootRequest): void => {
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
    const surface = createPlaySurface(resolvePlayResolution(store.getCurrent().system), surfaceScaleMode);
    playStage = surface.stage;
    layout.append(surface.viewport);
    mountHostControls(surface.viewport);
    // 엔진/에셋 기동 동안 검은 화면만 보이지 않도록 단계 표시.
    const loading = mountPlayLoadingOverlay(layout, "engine");
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
    void bootPlayGame(surface.phaserContainer, session, eventTestId, loading, run, startedAt, repairs);
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
    const described = describeBootFailure(context);
    // 부팅이 ready 를 지나 오버레이를 이미 걷어낸 뒤 터졌을 수도 있다 → 그때는 새로 올린다.
    const overlay = loading.root.isConnected ? loading : mountPlayLoadingOverlay(layout, "error");
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
    repairs: readonly string[]
  ): Promise<void> => {
    let resolveReady: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const signalReady = (): void => {
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
      );
    };
    try {
      loading.setStage("engine");
      loading.setProgress(0.08);
      bootDiag("engine", true, { detail: "startPlayGame" });
      const nextGame = await startPlayGame(phaserContainer, session, {
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
      game.registry.set("openSaveMenu", () => openEventMenu(layout, statusMenu.openSaveMenu));
      game.registry.set("openMenuScreen", () => openEventMenu(layout, () => {
        statusMenu.reset();
        statusMenu.renderMenu();
      }));
      game.registry.set("openLoadMenu", () => openEventMenu(layout, () => {
        statusMenu.reset();
        renderLoad(false);
      }));

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
      const surface = createPlaySurface(resolvePlayResolution(store.getCurrent().system), surfaceScaleMode);
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
    emitRuntimeJuice({ event: "menu-close" });
    closeStatusMenu(menu);
  };

  const emitMenuJuice = (event: RuntimeJuiceEvent, target?: HTMLElement | null): void => {
    emitRuntimeJuice({ event, target: target ?? layout.querySelector<HTMLElement>("[data-testid='main-menu']") });
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
    const titleEl = layout.querySelector("[data-testid='title-screen']");
    if (game || !titleEl || titleEl.hasAttribute("data-screen")) return false;
    if (titleConfirming) return true;
    const project = store.getCurrent();
    const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
    const options = listTitleMenuOptions(settings, { autosaveAvailable: isAutosaveAvailable() });
    const visibleCount = options.length;
    titleMenuIndex = clampTitleMenuIndex(titleMenuIndex, visibleCount);
    const titleDir = directionForKey(key);
    if (titleDir === "down" || titleDir === "up") {
      titleMenuIndex = moveTitleSelection(titleMenuIndex, titleDir === "down" ? "ArrowDown" : "ArrowUp", visibleCount);
      renderTitle({ emitEnterJuice: false });
      emitTitleJuice("title-select");
      return true;
    }
    if (!isConfirmKey(key)) return false;
    const selected = options[titleMenuIndex];
    confirmTitleThen(() => activateTitleOption(selected?.id));
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
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const menu = currentStatusMenu(layout);
    if (menu && event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      emitRuntimeJuice({ event: "menu-invalid", target: menu });
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
    stopGame();
    clearChildren(layout);
    const project = store.getCurrent();
    const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
    const titleContext = {
      autosaveAvailable: isAutosaveAvailable(),
      // intro 등장 연출은 최초 진입에만 — 방향키 이동(emitEnterJuice:false)에는 재생하지 않는다.
      playIntro: firstEnter,
      reuseFx: previousFx,
    };
    const options = listTitleMenuOptions(settings, titleContext);
    titleMenuIndex = clampTitleMenuIndex(titleMenuIndex, options.length);
    // 타이틀을 보는 동안 맵/캐릭셋 이미지를 HTTP 캐시에 미리 올려
    // "새 게임" 직후 로딩 체감을 줄인다(Phaser 텍스처 등록은 여전히 씬 preload).
    void warmBundledPlayAssets(project);
    const surface = createPlaySurface(resolvePlayResolution(project.system), surfaceScaleMode);
    clearChildren(surface.stage);
    playStage = surface.stage;
    cleanupPlaySurface = surface.cleanup;
    // 타이틀 확정은 handleTitleKey의 키보드 경로만 사용한다.
    const title = renderTitleScreen(project, {
      onNewGame: () => confirmTitleThen(() => activateTitleOption("newGame")),
      onResume: () => confirmTitleThen(() => activateTitleOption("resume")),
      onContinue: () => confirmTitleThen(() => activateTitleOption("continueGame")),
      onQuit: () => confirmTitleThen(() => activateTitleOption("quit")),
    }, titleMenuIndex, titleContext);
    layout.append(surface.viewport);
    mountHostControls(surface.viewport);
    surface.stage.append(title);
    focusSelectedTitleOption(title);
    surface.sync();
    startTitleBgm(project);
    if (firstEnter) emitTitleJuice("title-enter");
  };

  const activateTitleOption = (id: TitleMenuOptionId | undefined): void => {
    switch (id) {
      case "newGame":
        startGame({ safeMode: options.safeMode === true });
        return;
      case "resume":
        loadAutosave(true);
        return;
      case "continueGame":
        renderLoad(true);
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
    // cursor/confirm overrides only; title-enter stays default; cancel SE is never played here.
    const soundResourceId =
      event === "title-select"
        ? sounds?.cursorSeResourceId
        : event === "title-confirm"
          ? sounds?.confirmSeResourceId
          : undefined;
    emitRuntimeJuice({
      event,
      target: layout.querySelector<HTMLElement>("[data-testid='title-screen']"),
      ...(soundResourceId ? { soundResourceId } : {}),
    });
  };

  const confirmTitleThen = (callback: () => void): void => {
    if (titleConfirming) return;
    titleConfirming = true;
    emitTitleJuice("title-confirm");
    stopTitleBgm();
    titleConfirmTimer = setTimeout(() => {
      titleConfirmTimer = undefined;
      if (!shellActive) return;
      titleConfirming = false;
      callback();
    }, TITLE_CONFIRM_JUICE_MS);
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
  } else {
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
