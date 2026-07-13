import type Phaser from "phaser";
import { startPlayGame, destroyGame } from "@/app/mode";
import { store } from "@/project/store";
import { startSession, type PlaySession } from "@/project/session";
import { applyStatePreset, testHerePreset } from "@/testing/debugSession";
import { el, clearChildren } from "@/util/dom";
import {
  applySaveSnapshot,
  readSaveSlot,
  type SaveSlotIndex,
} from "@/player/saveSlots";
import { createDialogueUI } from "@/player/dialogue";
import { markPlayRender } from "@/app/perfMetrics";
import type { PlayScene } from "@/player/PlayScene";
import { isPlayScene } from "@/player/playerGuards";
import { createPlaySurface } from "@/player/playSurface";
import { createTouchPad, type TouchPadHandle } from "@/player/touchPad";
import { renderPlayerLoadPanel } from "@/player/playerLoadPanel";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import {
  isConfirmKey,
  moveTitleSelection,
  type RuntimeMenuKey,
} from "@/player/runtimeKeyboardMenu";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { emitRuntimeJuice, type RuntimeJuiceEvent } from "@/player/runtimeJuice";
import { renderTitleScreen } from "@/player/titleScreen";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import {
  mountPlayLoadingOverlay,
  type PlayLoadingOverlay,
} from "@/player/playLoadingOverlay";

let teardownShell: (() => void) | null = null;

export type RenderPlayerOptions = {
  readonly onExit?: () => void;
  readonly trackGlobalGame?: boolean;
  readonly initialSession?: PlaySession;
  readonly initialEventTestId?: string;
  // "여기서 테스트": 지정 맵/좌표에서 바로 플레이 시작(타이틀 건너뜀).
  readonly startOverride?: { readonly mapId: string; readonly x: number; readonly y: number };
};

const MENU_CLOSE_JUICE_MS = 250;
const TITLE_CONFIRM_JUICE_MS = 260;

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
    try {
      loading.setStage("engine");
      loading.setProgress(0.08);
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
            return;
          }
          loading.setStage("ready");
          loading.setProgress(1);
          signalReady();
        },
        onPlaySceneReady: () => {
          if (run !== startRun) return;
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
      // create() 가 이미 끝났을 수도 있으므로 ready 콜백 + 폴링으로 모두 커버.
      await waitForPlaySceneReady(nextGame, () => startRun === run, readyPromise);
      if (run !== startRun) {
        nextGame.destroy(true);
        loading.remove();
        return;
      }
      const scene = nextGame.scene.getScene("PlayScene");
      if (isPlayScene(scene)) scene.refreshRuntimeSurfaces();
      markPlayRender(startedAt);
      loading.remove();
    } catch (error) {
      console.error("[player] failed to start play game:", error);
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
    if (key === "ArrowDown" || key === "ArrowUp") {
      titleMenuIndex = moveTitleSelection(titleMenuIndex, key);
      renderTitle({ emitEnterJuice: false });
      emitTitleJuice("title-select");
      return true;
    }
    if (!isConfirmKey(key)) return false;
    confirmTitleThen(() => {
      if (titleMenuIndex === 0) startGame(newSession());
      if (titleMenuIndex === 1) renderLoad(true);
      if (titleMenuIndex === 2) exitPlayer();
    });
    return true;
  };

  const isDialogueSurfaceActive = (): boolean =>
    Boolean(playStage?.querySelector("[data-testid='dialogue-box'], [data-testid='runtime-choices'], [data-testid='runtime-input-number']"));

  // 상점/여관/불러오기 같은 런타임 모달이 떠 있으면 전역 타이틀/메뉴 입력을 양보한다(B2).
  // 각 모달은 자체 커서 메뉴가 키를 처리하므로, 여기서 조기 return 해 이중 처리를 막는다.
  const isModalOverlayActive = (): boolean => {
    const viewport = playStage?.closest(".play-viewport") ?? playStage ?? layout;
    if (
      viewport?.querySelector(
        "[data-testid='shop-scene'], [data-testid='inn-scene'], [data-testid='game-over-screen'], [data-testid='ending-screen']"
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
    if (!isRuntimeMenuKey(key)) return;
    if (isDialogueSurfaceActive() || isModalOverlayActive()) return;
    if (activeScene() && isCutsceneInputLocked(activeScene()!.session)) {
      if (key === "x" || key === "Escape") event.preventDefault();
      return;
    }
    if (handleTitleKey(key) || statusMenu.handleKey(key)) {
      event.preventDefault();
      return;
    }
    if (key === "x" || key === "Escape") {
      event.preventDefault();
      statusMenu.toggleMenu();
    }
  };

  const renderTitle = (titleOptions: { readonly emitEnterJuice?: boolean } = {}): void => {
    titleConfirming = false;
    stopGame();
    clearChildren(layout);
    const project = store.getCurrent();
    const surface = createPlaySurface();
    clearChildren(surface.stage);
    playStage = surface.stage;
    cleanupPlaySurface = surface.cleanup;
    // Title menu is keyboard-only (RM2003). Mouse/touch must not fire these actions.
    surface.stage.append(renderTitleScreen(project, {
      onNewGame: () => undefined,
      onContinue: () => undefined,
      onQuit: () => undefined,
    }, titleMenuIndex));
    layout.append(surface.viewport);
    surface.sync();
    if (titleOptions.emitEnterJuice ?? true) emitTitleJuice("title-enter");
  };

  const emitTitleJuice = (event: RuntimeJuiceEvent): void => {
    emitRuntimeJuice({ event, target: layout.querySelector<HTMLElement>("[data-testid='title-screen']") });
  };

  const confirmTitleThen = (callback: () => void): void => {
    if (titleConfirming) return;
    titleConfirming = true;
    emitTitleJuice("title-confirm");
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
  return key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "Enter" ||
    key === " " ||
    key === "z" ||
    key === "e" ||
    key === "x" ||
    key === "Escape";
}

async function waitForPlaySceneReady(
  game: Phaser.Game,
  isCurrentRun: () => boolean,
  readyPromise: Promise<void>
): Promise<void> {
  if (!isCurrentRun()) return;
  const scene = game.scene.getScene("PlayScene");
  // create() 가 끝났으면 scene.sys.settings.status 가 RUNNING 이상.
  if (isPlayScene(scene) && scene.sys?.settings?.status >= 5 /* RUNNING */) {
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeout);
      game.events.off("playscene-ready", onReady);
      resolve();
    };
    const onReady = (): void => finish();
    void readyPromise.then(onReady);
    game.events.once("playscene-ready", onReady);
    const pollTimer = window.setInterval(() => {
      if (!isCurrentRun()) {
        finish();
        return;
      }
      const current = game.scene.getScene("PlayScene");
      if (isPlayScene(current) && current.sys?.settings?.status >= 5) {
        finish();
      }
    }, 50);
    // 대용량 맵 create 가 길어도 오버레이가 영원히 남지 않게 상한.
    const timeout = window.setTimeout(finish, 30_000);
  });
}
