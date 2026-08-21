import type Phaser from "phaser";
import { startPlayGame, destroyGame } from "@/app/mode";
import { store } from "@/project/store";
import { warnIfPlayBootIssues } from "@/project/playBootValidation";
import { startSession, type PlaySession } from "@/project/session";
import { applyStatePreset, testHerePreset } from "@/testing/debugSession";
import { el, clearChildren } from "@/util/dom";
import {
  applySaveSnapshot,
  readSaveSlot,
  type SaveSlotIndex,
} from "@/player/saveSlots";
import { createDialogueUI } from "@/player/dialogue";
import { destroyBattleSceneOnHost } from "@/player/battleDom";
import { markPlayRender } from "@/app/perfMetrics";
import type { PlayScene } from "@/player/PlayScene";
import { isPlayScene } from "@/player/playerGuards";
import { createPlaySurface } from "@/player/playSurface";
import { createTouchPad, type TouchPadHandle } from "@/player/touchPad";
import { renderPlayerLoadPanel } from "@/player/playerLoadPanel";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
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
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
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

let teardownShell: (() => void) | null = null;

export type RenderPlayerOptions = {
  readonly onExit?: () => void;
  readonly trackGlobalGame?: boolean;
  readonly initialSession?: PlaySession;
  readonly initialEventTestId?: string;
  readonly diagnosticSink?: PlayBootDiagnosticSink;
  // "여기서 테스트": 지정 맵/좌표에서 바로 플레이 시작(타이틀 건너뜀).
  readonly startOverride?: { readonly mapId: string; readonly x: number; readonly y: number };
};

const MENU_CLOSE_JUICE_MS = 250;
const TITLE_CONFIRM_JUICE_MS = 180;

export function renderPlayer(main: HTMLElement, options: RenderPlayerOptions = {}): void {
  teardownShell?.();
  clearChildren(main);

  let game: Phaser.Game | null = null;
  let startRun = 0;
  let playStartedAt = 0;
  let titleMenuIndex = 0;
  let titleConfirming = false;
  let loadDetach: (() => void) | null = null;
  let cleanupPlaySurface: (() => void) | null = null;
  let touchPad: TouchPadHandle | null = null;
  let playStage: HTMLElement | null = null;
  const layout = el("div", { class: "player-layout system-shell" });
  const cleanupPointerBlocker = installPlayPointerBlocker(layout);
  main.append(layout);

  const stopGame = (): void => {
    startRun += 1;
    loadDetach?.();
    loadDetach = null;
    touchPad?.cleanup();
    touchPad = null;
    // 전투가 끝나기 전에 플레이를 닫으면(편집으로/x) battleScene 지역변수가 도달 불가가 되어
    // 틱·keydown·ResizeObserver 가 새어나간다. host 기준으로 컨트롤러를 정리한다(결함 1c).
    if (playStage) destroyBattleSceneOnHost(playStage);
    cleanupPlaySurface?.();
    cleanupPlaySurface = null;
    playStage = null;
    playStartedAt = 0;
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

  const activeScene = (): PlayScene | undefined => {
    if (!game) return undefined;
    const scene = game.scene.getScene("PlayScene");
    return isPlayScene(scene) ? scene : undefined;
  };

  // 새 세션 생성. startOverride가 있으면 시작 맵/좌표를 오버라이드한다("여기서 테스트").
  const newSession = (): PlaySession => {
    const project = store.getCurrent();
    const session = startSession(project);
    if (options.startOverride) {
      applyStatePreset(session, testHerePreset(options.startOverride.mapId, options.startOverride.x, options.startOverride.y));
    }
    return session;
  };

  const startGame = (session?: PlaySession, eventTestId = ""): void => {
    stopGame();
    warnIfPlayBootIssues(store.getCurrent());
    const run = ++startRun;
    const startedAt = performance.now();
    playStartedAt = startedAt;
    clearChildren(layout);
    const surface = createPlaySurface();
    playStage = surface.stage;
    layout.append(surface.viewport);
    // 엔진/에셋 기동 동안 검은 화면만 보이지 않도록 단계 표시.
    const loading = mountPlayLoadingOverlay(layout, "engine");
    surface.sync();
    cleanupPlaySurface = surface.cleanup;
    // 터치 기기에서만 가상 패드를 부착(데스크톱은 no-op). 방향키/Enter/Escape
    // 합성 이벤트로 기존 키보드 입력 경로(이동/대사/메뉴)를 그대로 구동한다.
    touchPad = createTouchPad(surface.stage);
    void bootPlayGame(surface.phaserContainer, session, eventTestId, loading, run, startedAt);
  };

  const bootPlayGame = async (
    phaserContainer: HTMLElement,
    session: PlaySession | undefined,
    eventTestId: string,
    loading: PlayLoadingOverlay,
    run: number,
    startedAt: number
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
      game.registry.set("openSaveMenu", () => {
        // 타자기 세이브: 이벤트가 세이브 화면을 연다. 전역 메뉴 세이브 비활성과 조합해 세이브 포인트 전용 설계가 가능하다.
        statusMenu.reset();
        statusMenu.renderMenu(undefined, "save");
      });
      // create() 가 이미 끝났을 수도 있으므로 ready 콜백 + 폴링으로 모두 커버.
      const ready = await waitForPlaySceneReady(nextGame, () => startRun === run, readyPromise);
      if (run !== startRun) {
        nextGame.destroy(true);
        loading.remove();
        return;
      }
      if (!ready.ok) {
        bootDiag("timeout", false, { detail: ready.reason });
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
    } catch (error) {
      console.error("[player] failed to start play game:", error);
      bootDiag("error", false, { error, detail: "bootPlayGame catch" });
      if (run === startRun) {
        loading.setStage("error", "플레이를 시작하지 못했습니다");
      }
    }
  };

  const loadSlot = (slot: SaveSlotIndex, fromTitle: boolean): void => {
    const result = readSaveSlot(window.localStorage, slot);
    if (result.kind !== "present") {
      renderLoad(fromTitle, `${slot}번 저장 칸을 불러올 수 없습니다`);
      return;
    }
    const restored = applySaveSnapshot(store.getCurrent(), result.snapshot);
    if (fromTitle || !game) {
      startGame(restored);
      return;
    }
    activeScene()?.applySession(restored);
    closeMenu();
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
    });
    if (fromTitle) {
      layout.append(panel);
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
    const menu = layout.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return;
    emitRuntimeJuice({ event: "menu-close", target: menu });
    window.setTimeout(() => {
      if (menu.isConnected) menu.remove();
    }, MENU_CLOSE_JUICE_MS);
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
    const options = listTitleMenuOptions(settings);
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
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const menu = layout.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (menu && event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      emitRuntimeJuice({ event: "menu-invalid", target: menu });
      return;
    }
    const overlayActive = isDialogueSurfaceActive() || isModalOverlayActive();
    const scene = activeScene();
    const cutsceneLocked = Boolean(scene && isCutsceneInputLocked(scene.session));
    // 손 슬롯 전환은 필드 전용이다. isRuntimeMenuKey 가드보다 앞에 둬야 숫자키가 여기까지
    // 도달하지만(숫자키는 런타임 메뉴 키가 아니다), 대사·모달·상태메뉴·컷신 잠금 중엔 아무 일도 없어야 한다.
    if (scene && !menu && !overlayActive && !cutsceneLocked) {
      const cycle = handSlotCycleDelta(key);
      const digit = handSlotDigit(key);
      if (cycle !== undefined) {
        event.preventDefault();
        cycleHandSlot(store.getCurrent(), scene.session, cycle);
        return;
      }
      if (digit !== undefined) {
        event.preventDefault();
        selectHandSlot(store.getCurrent(), scene.session, digit);
        return;
      }
    }
    if (!isRuntimeMenuKey(key)) return;
    if (overlayActive) return;
    if (cutsceneLocked) {
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
    stopGame();
    clearChildren(layout);
    const project = store.getCurrent();
    const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
    const options = listTitleMenuOptions(settings);
    titleMenuIndex = clampTitleMenuIndex(titleMenuIndex, options.length);
    // 타이틀을 보는 동안 맵/캐릭셋 이미지를 HTTP 캐시에 미리 올려
    // "새 게임" 직후 로딩 체감을 줄인다(Phaser 텍스처 등록은 여전히 씬 preload).
    void warmBundledPlayAssets(project);
    const surface = createPlaySurface();
    clearChildren(surface.stage);
    playStage = surface.stage;
    cleanupPlaySurface = surface.cleanup;
    // 키보드 + 클릭 모두 동일 확인 연출 후 분기.
    const title = renderTitleScreen(project, {
      onNewGame: () => confirmTitleThen(() => activateTitleOption("newGame")),
      onContinue: () => confirmTitleThen(() => activateTitleOption("continueGame")),
      onQuit: () => confirmTitleThen(() => activateTitleOption("quit")),
    }, titleMenuIndex);
    layout.append(surface.viewport);
    surface.stage.append(title);
    focusSelectedTitleOption(title);
    surface.sync();
    startTitleBgm(project);
    if (titleOptions.emitEnterJuice ?? true) emitTitleJuice("title-enter");
  };

  const activateTitleOption = (id: TitleMenuOptionId | undefined): void => {
    switch (id) {
      case "newGame":
        startGame(newSession());
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
    window.setTimeout(() => {
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

  document.addEventListener("keydown", onKeyDown);
  teardownShell = () => {
    document.removeEventListener("keydown", onKeyDown);
    cleanupPointerBlocker();
    stopGame();
    clearChildren(layout);
  };
  // 우선순위: 선택-이벤트 테스트(initialSession) → "여기서 테스트"(startOverride) → 타이틀.
  if (options.initialSession) {
    startGame(options.initialSession, options.initialEventTestId ?? "");
  } else if (options.startOverride) {
    startGame(newSession());
  } else {
    renderTitle();
  }
}

export function teardownPlayer(): void {
  teardownShell?.();
  teardownShell = null;
  delete window.__rpgzzuInput;
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

