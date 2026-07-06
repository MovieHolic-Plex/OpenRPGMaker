import { store } from "@/project/store";
import { createSaveSnapshot, listSaveSlots, saveToSlot, type SaveSlotIndex } from "@/player/saveSlots";
import { renderPlayerStatusMenu, type StatusMenuCommandId } from "@/player/playerStatusMenu";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { ActorInitialEquipment } from "@/project/types";
import { currentStatusMenu, statusMenuDetailActionButtons, wrapStatusMenuIndex } from "@/player/playerStatusMenuControllerDom";
import type { PlayerStatusMenuController, PlayerStatusMenuControllerOptions } from "@/player/playerStatusMenuControllerTypes";
import {
  equipStatusMenuItem,
  moveStatusMenuFormationActor,
  toggleStatusMenuActorRow,
  useStatusMenuItem,
} from "@/player/playerStatusMenuMutations";

export function createPlayerStatusMenuController(options: PlayerStatusMenuControllerOptions): PlayerStatusMenuController {
  let selectedCommand: StatusMenuCommandId = "items";
  let mode: "main" | "function" = "main";
  let selectedDetailActionIndex = 0;
  let targetItemId: string | undefined;
  let skillActorId: string | undefined;
  let selectedSkillId: string | undefined;
  let equipmentActorId: string | undefined;
  let equipmentSlotId: keyof ActorInitialEquipment | undefined;
  let formationActorId: string | undefined;
  let waitModeEnabled = true;

  const reset = (): void => {
    selectedCommand = "items";
    mode = "main";
    waitModeEnabled = true;
    resetSubscreenState();
  };

  const resetSubscreenState = (): void => {
    selectedDetailActionIndex = 0;
    targetItemId = undefined;
    skillActorId = undefined;
    selectedSkillId = undefined;
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
      skillActorId,
      selectedSkillId,
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
        onSelectSkillActor: (actorId) => {
          skillActorId = actorId;
          selectedSkillId = undefined;
          selectedDetailActionIndex = 0;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "skills"));
        },
        onSelectSkill: (skillId) => {
          selectedSkillId = skillId;
          options.emitMenuJuice("menu-select", renderMenu(undefined, "skills"));
        },
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
    if (scene) renderMenu(toggleStatusMenuActorRow(scene, actorId), "row");
  }

  function moveFormationActor(actorId: string, targetIndex: number): void {
    const scene = options.getActiveScene();
    if (scene) renderMenu(moveStatusMenuFormationActor(scene, actorId, targetIndex), "formation");
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
      case "load":
      case "status":
      case "row":
      case "formation":
      case "quests":
        resetSubscreenState();
        mode = "function";
        renderMenu(undefined, selectedCommand);
        return false;
    }
  }

  function confirmToTitle(): void {
    options.emitMenuJuice("menu-confirm", currentMenu());
    window.setTimeout(() => options.renderTitle(), options.menuCloseJuiceMs);
  }

  const currentMenu = (): HTMLElement | null => currentStatusMenu(options.layout);

  function moveSelectedDetailAction(delta: -1 | 1): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    selectedDetailActionIndex = wrapStatusMenuIndex(selectedDetailActionIndex + delta, actions.length);
    renderMenu(undefined, selectedCommand);
    return true;
  }

  function activateSelectedDetailAction(): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    actions[wrapStatusMenuIndex(selectedDetailActionIndex, actions.length)]?.click();
    return true;
  }

  function detailActionButtons(): HTMLButtonElement[] {
    return statusMenuDetailActionButtons(options.layout);
  }

  function emitAndHandle(event: RuntimeJuiceEvent): boolean {
    options.emitMenuJuice(event);
    return true;
  }

  return { reset, renderMenu, toggleMenu, handleKey };
}
