import { store } from "@/project/store";
import { createSaveSnapshot, getSaveSlotStatus, listSaveSlots, saveToSlot, type SaveSlotIndex } from "@/player/saveSlots";
import { listStatusMenuCommandIds, renderPlayerStatusMenu, type StatusMenuCommandId } from "@/player/playerStatusMenu";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { ActorInitialEquipment } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { moveMonster } from "@/project/monsterCollection";
import { currentStatusMenu, statusMenuDetailActionButtons, wrapStatusMenuIndex } from "@/player/playerStatusMenuControllerDom";
import type { PlayerStatusMenuController, PlayerStatusMenuControllerOptions } from "@/player/playerStatusMenuControllerTypes";
import {
  equipStatusMenuItem,
  moveStatusMenuFormationActor,
  type StatusMenuMutationResult,
  toggleStatusMenuActorRow,
  unequipStatusMenuItem,
  useStatusMenuItem,
} from "@/player/playerStatusMenuMutations";

export function createPlayerStatusMenuController(options: PlayerStatusMenuControllerOptions): PlayerStatusMenuController {
  let selectedCommand: StatusMenuCommandId = "items";
  let mode: "main" | "function" = "main";
  let selectedDetailActionIndex = 0;
  const detailCursors = new Map<string, number>();
  let targetItemId: string | undefined;
  let skillActorId: string | undefined;
  let selectedSkillId: string | undefined;
  let equipmentActorId: string | undefined;
  let equipmentSlotId: keyof ActorInitialEquipment | undefined;
  let formationActorId: string | undefined;
  let monsterView: "party" | "box" = "party";
  let confirmSaveSlot: SaveSlotIndex | undefined;
  let waitModeEnabled = true;

  const reset = (): void => {
    selectedCommand = "items";
    mode = "main";
    selectedDetailActionIndex = 0;
    detailCursors.clear();
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
    monsterView = "party";
    confirmSaveSlot = undefined;
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
    selectedDetailActionIndex = detailCursors.get(detailStateKey()) ?? defaultDetailCursor();
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
      monsterView,
      confirmSaveSlot,
      saveEnabled: isSaveEnabled(session),
      waitModeEnabled,
      selectedDetailActionIndex,
      actions: {
        onCommand: enterCommand,
        onSaveSlot: saveSlot,
        onLoadSlot: loadSlot,
        onSelectItemTarget: (itemId) => {
          rememberDetailCursorFromTestId(`status-menu-item-${itemId}`);
          targetItemId = itemId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "items"));
        },
        onUseItem: useItem,
        onSelectSkillActor: (actorId) => {
          rememberDetailCursorFromTestId(`status-menu-skill-actor-${actorId}`);
          skillActorId = actorId;
          selectedSkillId = undefined;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "skills"));
        },
        onSelectSkill: (skillId) => {
          if (skillActorId) rememberDetailCursorFromTestId(`status-menu-skill-${skillActorId}-${skillId}`);
          selectedSkillId = skillId;
          options.emitMenuJuice("menu-select", renderMenu(undefined, "skills"));
        },
        onSelectEquipmentActor: (actorId) => {
          rememberDetailCursorFromTestId(`status-menu-equipment-actor-${actorId}`);
          equipmentActorId = actorId;
          equipmentSlotId = undefined;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "equipment"));
        },
        onSelectEquipmentSlot: (actorId, slotId) => {
          rememberDetailCursorFromTestId(`status-menu-equipment-slot-${slotId}`);
          equipmentActorId = actorId;
          equipmentSlotId = slotId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "equipment"));
        },
        onEquipItem: equipItem,
        onUnequipItem: unequipItem,
        onToggleRow: toggleActorRow,
        onSelectFormationActor: (actorId) => {
          rememberDetailCursorFromTestId(`status-menu-formation-actor-${actorId}`);
          formationActorId = actorId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "formation"));
        },
        onMoveFormationActor: moveFormationActor,
        onToggleMonsterView: toggleMonsterView,
        onMoveMonster: moveMonsterFromMenu,
        onToggleWait: toggleWaitMode,
        onToTitle: confirmToTitle,
      },
    });
    replaceMenu(panel);
    syncRenderedDetailCursor();
    return panel;
  };

  const toggleMenu = (): void => {
    if (!options.getActiveScene()) return;
    const session = options.getActiveScene()?.getSession();
    if (session?.m2Runtime?.access?.menu === false && !currentMenu()) return;
    const menu = currentMenu();
    if (menu?.dataset.statusMenuScreen === "function") {
      backOneStep();
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
    if (mode === "function") {
      if (isDetailNavKey(key)) return moveSelectedDetailAction(detailDelta(key)) ? emitAndHandle("menu-select") : rejectInput();
      if (isConfirmMenuKey(key)) return activateSelectedDetailAction() || rejectInput();
      if (isCancelMenuKey(key)) {
        backOneStep();
        return true;
      }
      return rejectInput();
    }

    if (isRailNavKey(key)) {
      const railKey = key === "ArrowRight" ? "ArrowDown" : key === "ArrowLeft" ? "ArrowUp" : key;
      const session = options.getActiveScene()?.getSession();
      const commandIds = session
        ? listStatusMenuCommandIds(store.getCurrent(), session)
        : undefined;
      const next = reduceStatusMenuKeyboard({ selectedCommand, mode, commandIds }, railKey);
      if (commandIds && !commandIds.includes(next.selectedCommand)) {
        selectedCommand = commandIds[0] ?? "items";
      } else {
        selectedCommand = next.selectedCommand;
      }
      renderMenu(undefined, selectedCommand);
      return emitAndHandle("menu-select");
    }
    if (isConfirmMenuKey(key)) {
      enterCommand(selectedCommand);
      return true;
    }
    if (isCancelMenuKey(key)) {
      options.closeMenuWithJuice();
      return true;
    }
    return false;
  };

  function saveSlot(slot: SaveSlotIndex): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`save-slot-${slot}`);
    if (!isSaveEnabled(scene.getSession())) {
      rejectInput("지금은 저장할 수 없습니다");
      return;
    }
    const slots = listSaveSlots(window.localStorage);
    const slotState = getSaveSlotStatus(slots, slot);
    if (slotState.kind === "present" && confirmSaveSlot !== slot) {
      confirmSaveSlot = slot;
      options.emitMenuJuice("menu-confirm", renderMenu(`${slot}번 저장 칸을 덮어쓰려면 다시 선택하세요`, "save"));
      return;
    }
    confirmSaveSlot = undefined;
    saveToSlot(window.localStorage, slot, createSaveSnapshot(store.getCurrent(), scene.getSession()));
    options.emitMenuJuice("menu-confirm", renderMenu(`${slot}번 저장 칸에 저장했습니다`, "save"));
  }

  function loadSlot(slot: SaveSlotIndex): void {
    rememberDetailCursorFromTestId(`load-slot-${slot}`);
    options.emitMenuJuice("menu-confirm", currentMenu());
    options.loadSlot(slot, false);
  }

  function useItem(itemId: string, actorId?: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    if (actorId) rememberDetailCursorFromTestId(`status-menu-item-target-${actorId}`);
    const result = useStatusMenuItem(scene, itemId, actorId);
    if (result.kind === "used") targetItemId = undefined;
    emitMutationResult(result, renderMenu(result.message, "items"));
  }

  function equipItem(actorId: string, equipmentId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-equipment-item-${equipmentId}`);
    const result = equipStatusMenuItem(scene, actorId, equipmentId);
    if (result.kind === "used") equipmentSlotId = undefined;
    emitMutationResult(result, renderMenu(result.message, "equipment"));
  }

  function unequipItem(actorId: string, slotId: keyof ActorInitialEquipment): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId("status-menu-equipment-item-none");
    const result = unequipStatusMenuItem(scene, actorId, slotId);
    if (result.kind === "used") equipmentSlotId = undefined;
    emitMutationResult(result, renderMenu(result.message, "equipment"));
  }

  function toggleActorRow(actorId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-row-${actorId}`);
    const result = toggleStatusMenuActorRow(scene, actorId);
    emitMutationResult(result, renderMenu(result.message, "row"));
  }

  function moveFormationActor(actorId: string, targetIndex: number): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    const targetActorId = scene.getSession().partyActorIds[targetIndex];
    if (targetActorId) rememberDetailCursorFromTestId(`status-menu-formation-actor-${targetActorId}`);
    const result = moveStatusMenuFormationActor(scene, actorId, targetIndex);
    emitMutationResult(result, renderMenu(result.message, "formation"));
  }

  function toggleMonsterView(): void {
    monsterView = monsterView === "party" ? "box" : "party";
    options.emitMenuJuice("menu-confirm", renderMenu(undefined, "monsters"));
  }

  function moveMonsterFromMenu(instanceId: string, to: "party" | "box"): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-monster-${instanceId}`);
    const result = moveMonster(scene.getSession(), instanceId, to, store.getCurrent());
    const message = result.ok
      ? to === "party" ? "몬스터를 파티로 이동했습니다" : "몬스터를 보관함으로 이동했습니다"
      : result.reason === "partyFull" ? "파티가 가득 찼습니다" : "몬스터를 찾을 수 없습니다";
    options.emitMenuJuice(result.ok ? "menu-confirm" : "menu-invalid", renderMenu(message, "monsters"));
  }

  function enterCommand(commandId: StatusMenuCommandId): void {
    selectedCommand = commandId;
    switch (commandId) {
      case "wait":
        toggleWaitMode();
        return;
      case "to-title":
        confirmToTitle();
        return;
      case "save": {
        const scene = options.getActiveScene();
        if (scene && !isSaveEnabled(scene.getSession())) {
          rejectInput("지금은 저장할 수 없습니다");
          return;
        }
        resetSubscreenState();
        mode = "function";
        options.emitMenuJuice("menu-confirm", renderMenu(undefined, commandId));
        return;
      }
      case "items":
      case "skills":
      case "equipment":
      case "monsters":
      case "load":
      case "status":
      case "row":
      case "formation":
      case "quests":
      case "relationships":
        resetSubscreenState();
        mode = "function";
        options.emitMenuJuice("menu-confirm", renderMenu(undefined, commandId));
        return;
      default:
        assertNever(commandId);
    }
  }

  function toggleWaitMode(): void {
    waitModeEnabled = !waitModeEnabled;
    mode = "function";
    options.emitMenuJuice(
      "menu-confirm",
      renderMenu(`대기 방식을 ${waitModeEnabled ? "ON" : "OFF"}로 전환했습니다`, "wait")
    );
  }

  // RM2003식 취소 백스택: 후보 목록 -> 슬롯 -> 액터 -> 레일 -> 메뉴 닫기.
  // 하위 화면에서 돌아올 때 각 단계의 커서는 detailCursors에 저장해 이전 위치를 되살린다.
  function backOneStep(): void {
    if (stepBackWithinSubscreen()) {
      options.emitMenuJuice("menu-back", renderMenu(undefined, selectedCommand));
      return;
    }
    confirmSaveSlot = undefined;
    mode = "main";
    options.emitMenuJuice("menu-back", renderMenu(undefined, selectedCommand));
  }

  function stepBackWithinSubscreen(): boolean {
    switch (selectedCommand) {
      case "items":
        if (targetItemId) {
          targetItemId = undefined;
          return true;
        }
        return false;
      case "skills":
        if (selectedSkillId) {
          selectedSkillId = undefined;
          return true;
        }
        if (skillActorId) {
          skillActorId = undefined;
          return true;
        }
        return false;
      case "equipment":
        if (equipmentSlotId) {
          equipmentSlotId = undefined;
          return true;
        }
        if (equipmentActorId) {
          equipmentActorId = undefined;
          return true;
        }
        return false;
      case "save":
        if (confirmSaveSlot) {
          confirmSaveSlot = undefined;
          return true;
        }
        return false;
      case "formation":
        if (formationActorId) {
          formationActorId = undefined;
          return true;
        }
        return false;
      case "monsters":
        return false;
      case "load":
      case "quests":
      case "relationships":
      case "row":
      case "status":
      case "to-title":
      case "wait":
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
    setDetailCursor(wrapStatusMenuIndex(selectedDetailActionIndex + delta, actions.length));
    renderMenu(undefined, selectedCommand);
    return true;
  }

  function activateSelectedDetailAction(): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    setDetailCursor(wrapStatusMenuIndex(selectedDetailActionIndex, actions.length));
    actions[selectedDetailActionIndex]?.click();
    return true;
  }

  function detailActionButtons(): HTMLButtonElement[] {
    return statusMenuDetailActionButtons(options.layout);
  }

  function emitAndHandle(event: RuntimeJuiceEvent): boolean {
    options.emitMenuJuice(event);
    return true;
  }

  function rejectInput(message = "선택할 수 없습니다"): true {
    const panel = renderMenu(message, selectedCommand);
    options.emitMenuJuice("menu-invalid", panel);
    return true;
  }

  function emitMutationResult(result: StatusMenuMutationResult, target?: HTMLElement | null): void {
    options.emitMenuJuice(result.kind === "used" ? "menu-confirm" : "menu-invalid", target ?? currentMenu());
  }

  function rememberDetailCursorFromTestId(testId: string): void {
    const element = currentMenu()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const actionIndex = Number(element?.dataset.actionIndex);
    if (!Number.isFinite(actionIndex)) return;
    setDetailCursor(actionIndex);
  }

  function setDetailCursor(index: number): void {
    selectedDetailActionIndex = Math.max(0, index);
    detailCursors.set(detailStateKey(), selectedDetailActionIndex);
  }

  function syncRenderedDetailCursor(): void {
    const actions = detailActionButtons();
    if (actions.length === 0) {
      setDetailCursor(0);
      return;
    }
    selectedDetailActionIndex = Math.max(0, Math.min(selectedDetailActionIndex, actions.length - 1));
    detailCursors.set(detailStateKey(), selectedDetailActionIndex);
    actions.forEach((action, index) => action.classList.toggle("selected", index === selectedDetailActionIndex));
    actions[selectedDetailActionIndex]?.scrollIntoView({ block: "nearest" });
  }

  function detailStateKey(): string {
    switch (selectedCommand) {
      case "items":
        return targetItemId ? `items:${targetItemId}:targets` : "items:list";
      case "skills":
        return skillActorId ? `skills:${skillActorId}:list` : "skills:actors";
      case "equipment":
        if (!equipmentActorId) return "equipment:actors";
        if (!equipmentSlotId) return `equipment:${equipmentActorId}:slots`;
        return `equipment:${equipmentActorId}:${equipmentSlotId}:choices`;
      case "formation":
        return formationActorId ? "formation:moving" : "formation:list";
      case "monsters":
        return `monsters:${monsterView}`;
      case "save":
      case "load":
      case "quests":
      case "relationships":
      case "row":
      case "status":
      case "to-title":
      case "wait":
        return selectedCommand;
    }
  }

  function defaultDetailCursor(): number {
    if (selectedCommand === "formation" && formationActorId) {
      return Math.max(0, options.getActiveScene()?.getSession().partyActorIds.indexOf(formationActorId) ?? 0);
    }
    if (selectedCommand === "save" && confirmSaveSlot) return confirmSaveSlot - 1;
    return 0;
  }

  function isSaveEnabled(session: PlaySession): boolean {
    return session.m2Runtime?.access.save !== false;
  }

  return { reset, renderMenu, toggleMenu, handleKey };
}

function isRailNavKey(key: RuntimeMenuKey): key is "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" {
  return key === "ArrowDown" || key === "ArrowUp" || key === "ArrowLeft" || key === "ArrowRight";
}

function isDetailNavKey(key: RuntimeMenuKey): key is "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" {
  return isRailNavKey(key);
}

function detailDelta(key: "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp"): -1 | 1 {
  return key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
}

function isConfirmMenuKey(key: RuntimeMenuKey): boolean {
  return key === "Enter" || key === " " || key === "e" || key === "z";
}

function isCancelMenuKey(key: RuntimeMenuKey): boolean {
  return key === "Escape" || key === "x";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu command: ${String(value)}`);
}
