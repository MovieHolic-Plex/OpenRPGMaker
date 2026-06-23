import type Phaser from "phaser";
import { startPlayGame, destroyGame } from "@/app/mode";
import { store } from "@/project/store";
import { startSession, type PlaySession } from "@/project/session";
import { el, clearChildren } from "@/util/dom";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  listSaveSlots,
  readSaveSlot,
  saveToSlot,
  type SaveSlotIndex,
  type SaveSlotReadResult,
} from "@/player/saveSlots";
import { applySystemGraphic, applyTitleGraphic } from "@/player/systemGraphics";
import { createDialogueUI } from "@/player/dialogue";
import { markPlayRender } from "@/app/perfMetrics";
import type { PlayScene } from "@/player/PlayScene";
import { isPlayScene } from "@/player/playerGuards";
import { createPlaySurface } from "@/player/playSurface";

let teardownShell: (() => void) | null = null;

export type RenderPlayerOptions = { readonly trackGlobalGame?: boolean };

export function renderPlayer(main: HTMLElement, options: RenderPlayerOptions = {}): void {
  teardownShell?.();
  clearChildren(main);

  let game: Phaser.Game | null = null;
  let startRun = 0;
  let cleanupPlaySurface: (() => void) | null = null;
  const layout = el("div", { class: "player-layout system-shell" });
  main.append(layout);

  const stopGame = (): void => {
    startRun += 1;
    cleanupPlaySurface?.();
    cleanupPlaySurface = null;
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

  const renderSlotMessage = (message: string): HTMLElement =>
    el("div", {
      class: "system-shell-message",
      text: message,
      attrs: { role: "status" },
    });

  const renderSlotButton = (
    slot: SaveSlotReadResult,
    label: string,
    testId: string,
    onClick: () => void
  ): HTMLButtonElement => {
    const text = slot.kind === "present"
      ? `${label}: ${slot.snapshot.projectTitle}`
      : slot.kind === "corrupt"
        ? `${label}: 손상됨`
        : `${label}: 비어 있음`;
    const button = el("button", {
      class: "system-shell-button",
      text,
      dataset: { testid: testId },
      on: { click: onClick },
    });
    if (slot.kind === "corrupt") {
      button.classList.add("is-corrupt");
    }
    return button;
  };

  const startGame = (session?: PlaySession): void => {
    stopGame();
    const run = ++startRun;
    const startedAt = performance.now();
    clearChildren(layout);
    const surface = createPlaySurface();
    const menuButton = el("button", {
      class: "main-menu-button",
      text: "메뉴",
      dataset: { testid: "main-menu-button" },
      on: { click: () => renderMenu() },
    });
    layout.append(surface.viewport, menuButton);
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

  const saveSlot = (slot: SaveSlotIndex): void => {
    const scene = activeScene();
    if (!scene) return;
    saveToSlot(window.localStorage, slot, createSaveSnapshot(store.getCurrent(), scene.getSession()));
    renderMenu(`${slot}번 저장 칸에 저장했습니다`);
  };

  const renderLoad = (fromTitle: boolean, message?: string): void => {
    if (fromTitle) {
      stopGame();
      clearChildren(layout);
    }
    const slots = listSaveSlots(window.localStorage);
    const panel = el("div", {
      class: "title-screen system-panel",
      dataset: { testid: "title-screen" },
    });
    applyTitleGraphic(panel);
    applySystemGraphic(panel);
    panel.append(el("h2", { text: "불러오기" }));
    if (message) panel.append(renderSlotMessage(message));
    for (const slot of slots) {
      if (slot.kind === "corrupt") {
        panel.append(el("div", {
          class: "system-shell-corrupt",
          text: `${slot.slot}번 저장 칸 손상: ${slot.message}`,
          dataset: { testid: `save-slot-corrupt-${slot.slot}` },
        }));
      }
      panel.append(renderSlotButton(slot, `${slot.slot}번 저장`, `save-slot-${slot.slot}`, () => {
        loadSlot(slot.slot, fromTitle);
      }));
    }
    panel.append(el("button", {
      class: "system-shell-button",
      text: fromTitle ? "뒤로" : "닫기",
      on: { click: () => (fromTitle ? renderTitle() : closeMenu()) },
    }));
    if (fromTitle) {
      layout.append(panel);
    } else {
      replaceMenu(panel);
    }
  };

  const replaceMenu = (panel: HTMLElement): void => {
    layout.querySelector("[data-testid='main-menu']")?.remove();
    panel.dataset.testid = "main-menu";
    layout.append(panel);
  };

  const closeMenu = (): void => {
    layout.querySelector("[data-testid='main-menu']")?.remove();
  };

  const renderMenu = (message?: string): void => {
    const project = store.getCurrent();
    const slots = listSaveSlots(window.localStorage);
    const panel = el("div", {
      class: "main-menu system-panel",
      dataset: { testid: "main-menu" },
    });
    applySystemGraphic(panel);
    panel.append(el("h2", { text: "메뉴" }));
    panel.append(el("div", {
      class: "system-shell-meta",
      text: `${project.meta.terms.gold ?? "G"} 0`,
    }));
    if (message) panel.append(renderSlotMessage(message));
    panel.append(el("div", { class: "menu-section-title", text: "파티" }));
    panel.append(el("div", { class: "menu-section", text: "상태 / 아이템 / 스킬" }));
    for (const slot of slots) {
      panel.append(renderSlotButton(slot, `${slot.slot}번 저장`, `save-slot-${slot.slot}`, () => {
        saveSlot(slot.slot);
      }));
      panel.append(renderSlotButton(slot, `${slot.slot}번 불러오기`, `load-slot-${slot.slot}`, () => {
        loadSlot(slot.slot, false);
      }));
    }
    panel.append(el("button", {
      class: "system-shell-button",
      text: "닫기",
      on: { click: closeMenu },
    }));
    replaceMenu(panel);
  };

  const toggleMenu = (): void => {
    if (!game) return;
    renderMenu();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    toggleMenu();
  };

  const renderTitle = (): void => {
    stopGame();
    clearChildren(layout);
    const project = store.getCurrent();
    const title = el("div", {
      class: "title-screen system-panel",
      dataset: { testid: "title-screen" },
    });
    applyTitleGraphic(title);
    applySystemGraphic(title);
    title.append(
      el("h1", { text: project.meta.title }),
      el("button", {
        class: "system-shell-button primary",
        text: "새 게임",
        dataset: { testid: "title-new-game" },
        on: { click: () => startGame(startSession(project)) },
      }),
      el("button", {
        class: "system-shell-button",
        text: "불러오기",
        dataset: { testid: "title-load-game" },
        on: { click: () => renderLoad(true) },
      })
    );
    layout.append(title);
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
  delete (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput;
}
