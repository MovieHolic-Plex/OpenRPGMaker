import type Phaser from "phaser";
import { startPlayGame, destroyGame } from "@/app/mode";
import { store } from "@/project/store";
import { startSession, type PlaySession } from "@/project/session";
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
import { renderPlayerLoadPanel } from "@/player/playerLoadPanel";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import {
  moveTitleSelection,
  type RuntimeMenuKey,
} from "@/player/runtimeKeyboardMenu";
import { emitRuntimeJuice, type RuntimeJuiceEvent } from "@/player/runtimeJuice";
import { renderTitleScreen } from "@/player/titleScreen";

let teardownShell: (() => void) | null = null;

export type RenderPlayerOptions = {
  readonly onExit?: () => void;
  readonly trackGlobalGame?: boolean;
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
  let cleanupPlaySurface: (() => void) | null = null;
  let playStage: HTMLElement | null = null;
  const layout = el("div", { class: "player-layout system-shell" });
  main.append(layout);

  const stopGame = (): void => {
    startRun += 1;
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

  const startGame = (session?: PlaySession): void => {
    stopGame();
    const run = ++startRun;
    const startedAt = performance.now();
    playStartedAt = startedAt;
    clearChildren(layout);
    const surface = createPlaySurface();
    playStage = surface.stage;
    layout.append(surface.viewport);
    surface.sync();
    cleanupPlaySurface = surface.cleanup;
    void startPlayGame(surface.phaserContainer, session, {
      trackGlobalGame: options.trackGlobalGame,
    }).then((nextGame) => {
      if (run !== startRun) {
        nextGame.destroy(true);
        return;
      }
      game = nextGame;
      const dialogue = createDialogueUI(surface.stage);
      game.registry.set("dialogue", dialogue);
      game.registry.set("dialogueHost", surface.stage);
      game.registry.set("returnToTitle", () => renderTitle());
      const scene = nextGame.scene.getScene("PlayScene");
      if (isPlayScene(scene)) scene.refreshRuntimeSurfaces();
      markPlayRender(startedAt);
    });
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
  };

  const replaceMenu = (panel: HTMLElement): void => {
    layout.querySelector("[data-testid='main-menu']")?.remove();
    panel.dataset.testid = "main-menu";
    (playStage ?? layout).append(panel);
  };

  const closeMenu = (): void => {
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
    if (game || !layout.querySelector("[data-testid='title-screen']")) return false;
    if (titleConfirming) return true;
    if (key === "ArrowDown" || key === "ArrowUp") {
      titleMenuIndex = moveTitleSelection(titleMenuIndex, key);
      renderTitle({ emitEnterJuice: false });
      emitTitleJuice("title-select");
      return true;
    }
    if (key !== "Enter" && key !== " " && key !== "e") return false;
    confirmTitleThen(() => {
      if (titleMenuIndex === 0) startGame(startSession(store.getCurrent()));
      if (titleMenuIndex === 1) renderLoad(true);
      if (titleMenuIndex === 2) exitPlayer();
    });
    return true;
  };

  const isDialogueSurfaceActive = (): boolean =>
    Boolean(playStage?.querySelector("[data-testid='dialogue-box'], [data-testid='runtime-choices'], [data-testid='runtime-input-number']"));

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!isRuntimeMenuKey(key)) return;
    if (isDialogueSurfaceActive()) return;
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
    surface.stage.append(renderTitleScreen(project, {
      onNewGame: () => confirmTitleThen(() => startGame(startSession(project))),
      onContinue: () => confirmTitleThen(() => renderLoad(true)),
      onQuit: () => confirmTitleThen(exitPlayer),
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
    stopGame();
    clearChildren(layout);
  };
  renderTitle();
}

export function teardownPlayer(): void {
  teardownShell?.();
  teardownShell = null;
  delete window.__rpgzzuInput;
}

function isRuntimeMenuKey(key: string): key is RuntimeMenuKey {
  return key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "Enter" ||
    key === " " ||
    key === "e" ||
    key === "x" ||
    key === "Escape";
}
