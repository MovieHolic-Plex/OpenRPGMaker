import { store } from "@/project/store";
import { createSaveSnapshot, listSaveSlots, saveToSlot, type SaveSlotIndex } from "@/player/saveSlots";
import { renderPlayerStatusMenu, type StatusMenuCommandId } from "@/player/playerStatusMenu";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { PlayScene } from "@/player/PlayScene";
import type { ActorInitialEquipment } from "@/project/types";
import {
  equipStatusMenuItem,
  moveStatusMenuFormationActor,
  toggleStatusMenuActorRow,
  useStatusMenuItem,
} from "@/player/playerStatusMenuMutations";

type PlayerStatusMenuControllerOptions = {
  readonly layout: HTMLElement;
  readonly getActiveScene: () => PlayScene | undefined;
  readonly getPlayStage: () => HTMLElement | null;
  readonly getPlayStartedAt: () => number;
  readonly closeMenu: () => void;
  readonly closeMenuWithJuice: () => void;
  readonly renderTitle: () => void;
  readonly emitMenuJuice: (event: RuntimeJuiceEvent, target?: HTMLElement | null) => void;
  readonly menuCloseJuiceMs: number;
  readonly loadSlot: (slot: SaveSlotIndex, fromTitle: boolean) => void;
};

export type PlayerStatusMenuController = {
  readonly reset: () => void;
  readonly renderMenu: (message?: string, selectedCommand?: StatusMenuCommandId) => HTMLElement | null;
  readonly toggleMenu: () => void;
  readonly handleKey: (key: RuntimeMenuKey) => boolean;
};

export function createPlayerStatusMenuController(options: PlayerStatusMenuControllerOptions): PlayerStatusMenuController {
  let selectedCommand: StatusMenuCommandId = "items";
  let mode: "main" | "function" = "main";
  let selectedDetailActionIndex = 0;
  let targetItemId: string | undefined;
  let equipmentActorId: string | undefined;
  let equipmentSlotId: keyof ActorInitialEquipment | undefined;
  let formationActorId: string | undefined;
  let waitModeEnabled = true;

  const reset = (): void => {
    selectedCommand = "items";
    mode = "main";
    selectedDetailActionIndex = 0;
    targetItemId = undefined;
    equipmentActorId = undefined;
    equipmentSlotId = undefined;
    formationActorId = undefined;
    waitModeEnabled = true;
  };

  const resetSubscreenState = (): void => {
    selectedDetailActionIndex = 0;
    targetItemId = undefined;
    equipmentActorId = undefined;
    equipmentSlotId = undefined;
    formationActorId = undefined;
  };

  const replaceMenu = (panel: HTMLElement): void => {
    options.layout.querySelector("[data-testid='main-menu']")?.remove();
    panel.dataset.testid = "main-menu";
    (options.getPlayStage() ?? options.layout).append(panel);
  };

  const renderMenu = (message?: string, nextCommand: StatusMenuCommandId = selectedCommand): HTMLElement | null => {
    const project = store.getCurrent();
    const session = options.getActiveScene()?.getSession();
    if (!session) return null;
    selectedCommand = nextCommand;
    const panel = renderPlayerStatusMenu({
      project,
      session,
      slots: listSaveSlots(window.localStorage),
      message,
      elapsedMs: options.getPlayStartedAt() > 0 ? performance.now() - options.getPlayStartedAt() : 0,
      selectedCommand,
      mode,
      targetItemId,
      equipmentActorId,
      equipmentSlotId,
      formationActorId,
      waitModeEnabled,
      selectedDetailActionIndex,
      actions: {
        onCommand: (commandId) => {
          resetSubscreenState();
          mode = "function";
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, commandId));
        },
        onSaveSlot: saveSlot,
        onLoadSlot: (slot) => options.loadSlot(slot, false),
        onSelectItemTarget: (itemId) => {
          targetItemId = itemId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "items"));
        },
        onUseItem: useItem,
        onSelectEquipmentActor: (actorId) => {
          equipmentActorId = actorId;
          equipmentSlotId = undefined;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "equipment"));
        },
        onSelectEquipmentSlot: (actorId, slotId) => {
          equipmentActorId = actorId;
          equipmentSlotId = slotId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "equipment"));
        },
        onEquipItem: equipItem,
        onToggleRow: toggleActorRow,
        onSelectFormationActor: (actorId) => {
          formationActorId = actorId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "formation"));
        },
        onMoveFormationActor: moveFormationActor,
        onToggleWait: () => {
          waitModeEnabled = !waitModeEnabled;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "wait"));
        },
        onToTitle: confirmToTitle,
      },
    });
    replaceMenu(panel);
    return panel;
  };

  const toggleMenu = (): void => {
    if (!options.getActiveScene()) return;
    const menu = currentMenu();
    if (menu?.dataset.statusMenuScreen === "function") {
      resetSubscreenState();
      mode = "main";
      options.emitMenuJuice("menu-back", renderMenu());
      return;
    }
    if (menu) {
      options.closeMenuWithJuice();
      return;
    }
    mode = "main";
    resetSubscreenState();
    options.emitMenuJuice("menu-open", renderMenu());
  };

  const handleKey = (key: RuntimeMenuKey): boolean => {
    if (!currentMenu()) return false;
    if (key === "ArrowDown" && moveSelectedDetailAction(1)) return emitAndHandle("menu-select");
    if (key === "ArrowUp" && moveSelectedDetailAction(-1)) return emitAndHandle("menu-select");
    if ((key === "Enter" || key === " " || key === "e") && activateSelectedDetailAction()) return emitAndHandle("menu-confirm");
    const next = reduceStatusMenuKeyboard({ selectedCommand, mode }, key);
    selectedCommand = next.selectedCommand;
    mode = next.mode;
    switch (next.action) {
      case "select":
      case "back-to-main":
        renderMenu(undefined, selectedCommand);
        return emitAndHandle(next.action === "select" ? "menu-select" : "menu-back");
      case "enter-function":
      case "activate":
        if (!enterSelectedMenuCommand()) options.emitMenuJuice("menu-confirm");
        return true;
      case "close":
        options.closeMenuWithJuice();
        return true;
      case "none":
        return false;
    }
  };

  function saveSlot(slot: SaveSlotIndex): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    saveToSlot(window.localStorage, slot, createSaveSnapshot(store.getCurrent(), scene.getSession()));
    renderMenu(`${slot}번 저장 칸에 저장했습니다`, "save");
  }

  function useItem(itemId: string, actorId?: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    targetItemId = undefined;
    renderMenu(useStatusMenuItem(scene, itemId, actorId), "items");
  }

  function equipItem(actorId: string, equipmentId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    const message = equipStatusMenuItem(scene, actorId, equipmentId);
    if (!message) return;
    equipmentSlotId = undefined;
    renderMenu(message, "equipment");
  }

  function toggleActorRow(actorId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    renderMenu(toggleStatusMenuActorRow(scene, actorId), "row");
  }

  function moveFormationActor(actorId: string, delta: -1 | 1): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    renderMenu(moveStatusMenuFormationActor(scene, actorId, delta), "formation");
  }

  function enterSelectedMenuCommand(): boolean {
    switch (selectedCommand) {
      case "wait":
        waitModeEnabled = !waitModeEnabled;
        renderMenu(undefined, "wait");
        return false;
      case "to-title":
        confirmToTitle();
        return true;
      case "items":
      case "skills":
      case "equipment":
      case "save":
      case "status":
      case "row":
      case "formation":
        resetSubscreenState();
        mode = "function";
        selectedDetailActionIndex = 0;
        renderMenu(undefined, selectedCommand);
        return false;
    }
  }

  function confirmToTitle(): void {
    options.emitMenuJuice("menu-confirm", currentMenu());
    window.setTimeout(() => options.renderTitle(), options.menuCloseJuiceMs);
  }

  function currentMenu(): HTMLElement | null {
    return options.layout.querySelector<HTMLElement>("[data-testid='main-menu']");
  }

  function moveSelectedDetailAction(delta: -1 | 1): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    selectedDetailActionIndex = wrapIndex(selectedDetailActionIndex + delta, actions.length);
    renderMenu(undefined, selectedCommand);
    return true;
  }

  function activateSelectedDetailAction(): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    actions[wrapIndex(selectedDetailActionIndex, actions.length)]?.click();
    return true;
  }

  function detailActionButtons(): HTMLButtonElement[] {
    return Array.from(options.layout.querySelectorAll<HTMLButtonElement>(".status-menu-detail-action:not(:disabled)"));
  }

  function emitAndHandle(event: RuntimeJuiceEvent): boolean {
    options.emitMenuJuice(event);
    return true;
  }

  return { reset, renderMenu, toggleMenu, handleKey };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
