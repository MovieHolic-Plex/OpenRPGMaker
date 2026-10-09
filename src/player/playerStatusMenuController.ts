import { monsterBoxUnavailableReason } from "@/player/playerMonsterPartyModel";
import { DEFAULT_INVENTORY_VIEW, type InventoryView } from '@/player/playerInventoryView';
import { LifeReconciliationError } from "@/project/lifeRecovery";
import { actorOwnedSkillIds, investSkillNode, resetSkillTree } from "@/project/growth/runtime";
import { combineItems } from "@/project/craftRecipes";
import { toggleSkillLoadout } from "@/project/skillLoadout";
import { setAudioState } from "@/project/session";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import { itemCombinationPartners } from "@/player/playerStatusMenuDetails";
import { runItemUsePage } from "@/player/playSceneInterpreter";
import { promoteActor } from "@/project/sessionClass";
import { refreshGrowthVitals } from "@/project/growth/vitals";
import type { GrowthMenuTab } from "@/player/playerGrowthMenu";
import { store } from "@/project/store";
import { createSaveSnapshot, getSaveSlotStatus, listSaveSlots, saveToSlot, type SaveSlotIndex } from "@/player/saveSlots";
import { renderPlayerStatusMenu, statusMenuControls } from "@/player/playerStatusMenu";
import { updateStatusMenuDetailSelection } from "@/player/playerStatusMenuDetailRenderer";
import { animateStatusMenuPage, animateStatusMenuVitals, readStatusMenuVitals } from "@/player/playerStatusMenuMotion";
import {
  isStatusMenuGroupEntryId,
  listStatusMenuGroupCommandIds,
  listStatusMenuRailIds,
  statusMenuRailIdForCommand,
  type StatusMenuCommandId,
  type StatusMenuGroupEntryId,
  type StatusMenuRailId,
} from "@/player/playerStatusMenuModel";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";
import { menuSkinFor } from "@/player/menuSkins/registry";
import { directionForKey, isCancelKey, isConfirmKey } from "@/player/keyBindings";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { ActorInitialEquipment, SkillId } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { closeGalleryViewer, galleryViewerIsOpen, stepGalleryViewer } from "@/player/galleryViewer";
import { resolveLifeLedgerTab, type LifeLedgerTabId } from "@/player/lifeLedger";
import { createLifePlacementLiveReader } from "@/player/lifePlacementScene";
import { moveMonster, rejectPendingMonsterSkill, replacePendingMonsterSkill } from "@/project/monsterCollection";
import {
  adoptStatusMenuPanel,
  currentStatusMenu,
  statusMenuDetailActionButtons,
  wrapStatusMenuIndex,
} from "@/player/playerStatusMenuControllerDom";
import type { PlayerStatusMenuController, PlayerStatusMenuControllerOptions } from "@/player/playerStatusMenuControllerTypes";
import {
  equipStatusMenuItem,
  moveStatusMenuFormationActor,
  type StatusMenuMutationResult,
  toggleStatusMenuActorRow,
  unequipStatusMenuItem,
  optimizeStatusMenuEquipment,
  useStatusMenuItem,
} from "@/player/playerStatusMenuMutations";
import { fireAutoTriggers } from "@/player/playSceneMapRuntime";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export function createPlayerStatusMenuController(options: PlayerStatusMenuControllerOptions): PlayerStatusMenuController {
  let selectedCommand: StatusMenuRailId = "items";
  let initialMenuSelection = true;
  // 접힌 그룹을 통해 들어온 경우의 부모 — 취소하면 레일이 아니라 그룹 목록으로 돌아간다.
  let openGroupId: StatusMenuGroupEntryId | undefined;
  let mode: "main" | "function" = "main";
  let selectedDetailActionIndex = 0;
  const detailCursors = new Map<string, number>();
  const detailScrolls = new Map<string, number>();
  let inventoryView: InventoryView = { ...DEFAULT_INVENTORY_VIEW };
  let targetItemId: string | undefined;
  let itemActionId: string | undefined;
  let skillActorId: string | undefined;
  let selectedSkillId: string | undefined;
  let growthTab: GrowthMenuTab = "skills";
  let equipmentActorId: string | undefined;
  let equipmentSlotId: keyof ActorInitialEquipment | undefined;
  let formationActorId: string | undefined;
  let battleReportIndex: number | undefined;
  let campaignSpeciesId: string | undefined;
  let monsterInstanceId: string | undefined;
  let monsterView: "party" | "box" = "party";
  let lifeLedgerTab: LifeLedgerTabId | undefined;
  let confirmSaveSlot: SaveSlotIndex | undefined;
  let confirmToTitlePending = false;
  let waitModeEnabled = true;

  const reset = (): void => {
    initialMenuSelection = true;
    const session = options.getActiveScene()?.getSession();
    selectedCommand = session ? listStatusMenuRailIds(store.getCurrent(), session)[0] ?? 'items' : 'items';
    openGroupId = undefined;
    mode = "main";
    selectedDetailActionIndex = 0;
    inventoryView = { ...DEFAULT_INVENTORY_VIEW };
    detailCursors.clear();
    detailScrolls.clear();
    waitModeEnabled = true;
    resetSubscreenState();
  };

  const resetSubscreenState = (): void => {
    selectedDetailActionIndex = 0;
    targetItemId = undefined;
    itemActionId = undefined;
    skillActorId = undefined;
    selectedSkillId = undefined;
    growthTab = "skills";
    equipmentActorId = undefined;
    equipmentSlotId = undefined;
    formationActorId = undefined;
    battleReportIndex = undefined;
    campaignSpeciesId = undefined;
    monsterInstanceId = undefined;
    monsterView = "party";
    lifeLedgerTab = undefined;
    confirmSaveSlot = undefined;
    confirmToTitlePending = false;
  };

  const replaceMenu = (panel: HTMLElement): HTMLElement => {
    panel.dataset.testid = "main-menu";
    const host = options.getPlayStage() ?? options.layout;
    const existing =
      host.querySelector<HTMLElement>("[data-testid='main-menu']")
      ?? options.layout.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!existing || existing.dataset.statusMenuClosing === "1") {
      existing?.remove();
      host.append(panel);
      return panel;
    }
    return adoptStatusMenuPanel(existing, panel);
  };

  const renderMenu = (message?: string, nextCommand: StatusMenuRailId = selectedCommand): HTMLElement | null => {
    const previous = currentMenu();
    const scroll = previous?.querySelector<HTMLElement>(".status-menu-detail-list")?.scrollTop;
    if (previous?.dataset.detailState && scroll !== undefined) detailScrolls.set(previous.dataset.detailState, scroll);
    const project = store.getCurrent();
    const session = options.getActiveScene()?.getSession();
    if (!session) return null;
    const available = listStatusMenuRailIds(project, session);
    selectedCommand = available.includes(nextCommand) ? nextCommand : available[0] ?? "items";
    initialMenuSelection = false;
    selectedDetailActionIndex = detailCursors.get(detailStateKey()) ?? defaultDetailCursor();
    const panel = renderPlayerStatusMenu({
      project,
      session,
      slots: listSaveSlots(window.localStorage),
      message,
      elapsedMs: options.getPlayStartedAt() > 0 ? performance.now() - options.getPlayStartedAt() : 0,
      selectedCommand,
      mode,
      inventoryView,
      targetItemId,
      itemActionId,
      canUseItemOnFacedTarget: (itemId) => facedItemTarget(itemId) !== undefined,
      skillActorId,
      selectedSkillId,
      growthTab,
      equipmentActorId,
      equipmentSlotId,
      formationActorId,
      battleReportIndex,
      campaignSpeciesId,
      monsterInstanceId,
      monsterView,
      lifeLedgerTab,
      readLive: createLifePlacementLiveReader(
        () => options.getActiveScene(),
        () => store.getCurrent(),
      ),
      placementDirection: options.getActiveScene()?.facing,
      getPlacementDirection: () => options.getActiveScene()?.facing,
      getScene: () => options.getActiveScene(),
      confirmSaveSlot,
      confirmToTitle: confirmToTitlePending,
      saveEnabled: isSaveEnabled(session),
      waitModeEnabled,
      selectedDetailActionIndex,
      actions: {
        onOptionsChanged: (message) => { renderMenu(message, "options"); },
        onInventoryViewChange: (view) => {
          const control = view.filter !== inventoryView.filter ? "inventory-filter" : "inventory-sort";
          inventoryView = view;
          renderMenu(undefined, "items");
          rememberDetailCursorFromTestId(control);
          syncRenderedDetailCursor();
          const detail = currentMenu()?.querySelector<HTMLElement>(".status-menu-detail");
          if (detail) updateStatusMenuDetailSelection(detail, selectedDetailActionIndex);
        },
        onCommand: enterCommand,
        onOpenGroup: openGroup,
        onSaveSlot: saveSlot,
        onLoadSlot: loadSlot,
        onSelectItemTarget: (itemId) => {
          rememberDetailCursorFromTestId(`status-menu-item-${itemId}`);
          itemActionId = undefined;
          targetItemId = itemId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "items"));
        },
        onUseItem: useItem,
        onOpenItemActions: (itemId) => {
          rememberDetailCursorFromTestId(`status-menu-item-${itemId}`);
          itemActionId = itemId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "items"));
        },
        onCombineItems: combineItemsFromMenu,
        onUseItemOnFacedTarget: useItemOnFacedTarget,
        onToggleSkillLoadout: toggleSkillLoadoutFromMenu,
        onSelectSkillActor: (actorId) => {
          rememberDetailCursorFromTestId(`status-menu-skill-actor-${actorId}`);
          skillActorId = actorId;
          selectedSkillId = undefined;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "skills"));
        },
        onSelectGrowthTab: (tab) => { growthTab = tab; selectedDetailActionIndex = 0; options.emitMenuJuice("menu-select", renderMenu(undefined, "skills")); },
        onGrowthMutation: (action) => {
          const scene = options.getActiveScene(); if (!scene) return;
          const project = store.getCurrent(), session = scene.getSession();
          let error: string | undefined;
          if (action.kind === "invest") error = investSkillNode(project, session, action.actorId, action.treeId, action.nodeId);
          else if (action.kind === "reset") error = resetSkillTree(project, session, action.actorId, action.treeId);
          else { const result = promoteActor(session, project, action.actorId, action.classId); if (!result.ok) error = "승급 조건을 만족하지 못했습니다."; }
          refreshGrowthVitals(project, session, action.actorId);
          scene.syncRuntimeState();
          options.emitMenuJuice("menu-confirm", renderMenu(error ?? (action.kind === "invest" ? "능력을 습득했습니다." : action.kind === "reset" ? "포인트를 환급했습니다." : "새로운 직업으로 승급했습니다."), "skills"));
        },
        onSelectSkill: (skillId) => {
          if (skillActorId) rememberDetailCursorFromTestId(`status-menu-skill-${skillActorId}-${skillId}`);
          // 명작 공백 #5: 필드 능력은 고르면 바로 쓴다(두 번 누를 필요 없음). 일반 스킬은 설명만.
          const skill = store.getCurrent().database.skills.find((record) => record.id === skillId);
          const scene = options.getActiveScene();
          if (skill?.fieldCommonEventId && scene && skillActorId) {
            const used = scene.useFieldAbility(skillActorId, skillId);
            if (used.ok) {
              options.closeMenu();
              return;
            }
            options.emitMenuJuice("menu-select", renderMenu(used.message, "skills"));
            return;
          }
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
        onOptimizeEquipment: optimizeEquipment,
        onToggleRow: toggleActorRow,
        onSelectBattleReport: (index) => {
          battleReportIndex = index;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "battle-reports"));
        },
        onSelectFormationActor: (actorId) => {
          rememberDetailCursorFromTestId(`status-menu-formation-actor-${actorId}`);
          formationActorId = actorId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "formation"));
        },
        onMoveFormationActor: moveFormationActor,
        onSelectCampaignSpecies: (speciesId) => {
          if (speciesId) rememberDetailCursorFromTestId(`campaign-dex-${speciesId}`);
          campaignSpeciesId = speciesId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "monster-dex"));
        },
        onSelectMonster: (instanceId) => {
          if (instanceId) rememberDetailCursorFromTestId(`status-menu-monster-${instanceId}`);
          monsterInstanceId = instanceId;
          options.emitMenuJuice("menu-confirm", renderMenu(undefined, "monsters"));
        },
        onToggleMonsterView: toggleMonsterView,
        onMoveMonster: moveMonsterFromMenu,
        onReplacePendingMonsterSkill: replaceMonsterSkillFromMenu,
        onRejectPendingMonsterSkill: rejectMonsterSkillFromMenu,
        onSelectLifeLedgerTab: (tab) => {
          rememberDetailCursorFromTestId(`life-ledger-tab-${tab}`);
          lifeLedgerTab = tab;
          options.emitMenuJuice("menu-select", renderMenu(undefined, "life-ledger"));
        },
        onLifeLedgerMutation: (ok, message) => {
          const scene = options.getActiveScene();
          scene?.refreshRuntimeSurfaces();
          scene?.syncRuntimeState();
          options.emitMenuJuice(ok ? "menu-confirm" : "menu-invalid", renderMenu(message, "life-ledger"));
        },
        onToggleWait: toggleWaitMode,
        onToTitle: confirmToTitle,
      },
    });
    panel.dataset.detailState = detailStateKey();
    const changedPage = currentMenu()?.dataset.detailState !== panel.dataset.detailState;
    const live = replaceMenu(panel);
    if (changedPage && currentMenu()) animateStatusMenuPage(live);
    // 새로 그린 패널이다. 저장된 스크롤이 있으면 아래에서 그대로 되돌리고, 없으면 목록이 맨 위라 첫 행은 이미
    // 보인다 — 어느 쪽이든 scrollIntoView 로 방금 만든 DOM 의 레이아웃을 강제할 이유가 없다(메뉴 첫 개방 83ms,
    // 브라우저 실측). 저장된 스크롤이 없는데 선택이 첫 행이 아니면(되돌아온 커서) 그때만 스크롤한다.
    const list = live.querySelector<HTMLElement>(".status-menu-detail-list");
    const savedScroll = detailScrolls.get(detailStateKey());
    syncRenderedDetailCursor(savedScroll !== undefined || selectedDetailActionIndex === 0);
    if (list && savedScroll !== undefined) list.scrollTop = savedScroll;
    return live;
  };

  const openSaveMenu = (): void => {
    reset();
    // 이벤트 진입은 레일 선택만 바꾸지 않고 저장 슬롯에 바로 포커스를 준다.
    // 저장 가능 여부는 렌더링과 saveSlot의 기존 맵/세션 제한을 그대로 따른다.
    mode = "function";
    options.emitMenuJuice("menu-open", renderMenu(undefined, "save"));
  };

  const openLifeRecoveryLedger = (): void => {
    if (!options.getActiveScene()) return;
    lifeLedgerTab = "recovery";
    mode = "function";
    openGroupId = undefined;
    selectedDetailActionIndex = 0;
    options.emitMenuJuice("menu-open", renderMenu(undefined, "life-ledger"));
  };
  function focusMenuArea(nextMode: "main" | "function"): void {
    mode = nextMode;
    // 첫 화면이 작업 패널이 아닌 스킨(파티 개요·허브·시트)은 main 과 function 의 오른쪽 내용이 다르다.
    // 포커스만 옮기면 빈 자리에 커서가 서므로 모드가 바뀔 때 한 번 다시 그린다. workbench 는 그대로 포커스만 옮긴다.
    const landing = currentMenu()?.dataset.menuSkinLanding;
    if (landing && landing !== "work") renderMenu(undefined, selectedCommand);
    const menu = currentMenu();
    if (!menu) return;
    menu.dataset.statusMenuScreen = mode;
    menu.classList.toggle("status-menu-detail-focus", mode === "function");
    const detail = menu.querySelector<HTMLElement>(".status-menu-detail");
    if (mode === "main") detail?.setAttribute("inert", "");
    else detail?.removeAttribute("inert");
    const controls = menu.querySelector<HTMLElement>(".status-menu-controls");
    if (controls) controls.textContent = statusMenuControls(mode, menuSkinFor(store.getCurrent()).railColumns, menuSkinFor(store.getCurrent()).id === "field-list");
    const debug = menu.querySelector<HTMLElement>("[data-testid='status-menu-debug-json']");
    if (debug) debug.textContent = JSON.stringify({ selectedCommand, mode });
    focusActiveMenuContainer();
  }


  const toggleMenu = (): void => {
    if (galleryViewerIsOpen()) {
      closeGalleryViewer();
      return;
    }
    if (!options.getActiveScene()) return;
    const session = options.getActiveScene()?.getSession();
    if (session?.m2Runtime?.access?.menu === false && !currentMenu()) return;
    const menu = currentMenu();
    if (menu?.dataset.statusMenuScreen === "function") {
      backOneStep();
      return;
    }
    if (menu) {
      closeGalleryViewer();
      options.closeMenuWithJuice();
      return;
    }
    mode = "main";
    selectedCommand = initialMenuSelection && session
      ? listStatusMenuRailIds(store.getCurrent(), session)[0] ?? "items"
      : statusMenuRailIdForCommand(selectedCommand, store.getCurrent(), session);
    openGroupId = undefined;
    resetSubscreenState();
    options.emitMenuJuice("menu-open", renderMenu());
  };

  const handleKey = (key: RuntimeMenuKey): boolean => {
    if (!currentMenu()) return false;
    if (galleryViewerIsOpen()) {
      if (isCancelMenuKey(key) || isConfirmMenuKey(key)) {
        closeGalleryViewer();
        return true;
      }
      const viewDirection = directionForKey(key);
      if (viewDirection === "left" || viewDirection === "up") {
        stepGalleryViewer(-1);
        return true;
      }
      if (viewDirection === "right" || viewDirection === "down") {
        stepGalleryViewer(1);
        return true;
      }
      return false;
    }
    const direction = directionForKey(key);
    if (mode === "function") {
      if (direction === "left") {
        focusMenuArea("main");
        options.emitMenuJuice("menu-back", currentMenu());
        return true;
      }
      if (direction === "right") return true;
      if (isDetailNavKey(key)) return moveSelectedDetailAction(detailDelta(key)) ? emitAndHandle("menu-select") : rejectInput();
      if (isConfirmMenuKey(key)) return activateSelectedDetailAction() || rejectInput();
      if (isCancelMenuKey(key)) {
        backOneStep();
        return true;
      }
      return rejectInput();
    }

    // 격자 레일(허브 타일)은 →← 가 진입/복귀가 아니라 커서 이동이다. 진입은 Enter 로만.
    const railColumns = menuSkinFor(store.getCurrent()).railColumns;
    const grid = railColumns > 1;
    if ((!grid && direction === "right") || isConfirmMenuKey(key)) {
      if (isStatusMenuGroupEntryId(selectedCommand)) openGroupId = selectedCommand;
      focusMenuArea("function");
      options.emitMenuJuice("menu-confirm", currentMenu());
      return true;
    }
    if (!grid && direction === "left") return true;

    if (isRailNavKey(key)) {
      // 1열: 가로 입력도 세로 이동으로 접는다(레일과 미리보기 사이 초점 이동). 격자: 방향 그대로.
      const railDir = directionForKey(key);
      const railKey: RuntimeMenuKey = grid
        ? key
        : railDir === "right" || railDir === "down" ? "ArrowDown" : "ArrowUp";
      const session = options.getActiveScene()?.getSession();
      const commandIds = session
        ? listStatusMenuRailIds(store.getCurrent(), session)
        : undefined;
      const next = reduceStatusMenuKeyboard({ selectedCommand: statusMenuRailIdForCommand(selectedCommand, store.getCurrent(), session), mode, commandIds, columns: railColumns }, railKey);
      if (commandIds && !commandIds.includes(next.selectedCommand)) {
        selectedCommand = commandIds[0] ?? "items";
      } else {
        selectedCommand = next.selectedCommand;
      }
      resetSubscreenState();
      openGroupId = undefined;
      renderMenu(undefined, selectedCommand);
      return emitAndHandle("menu-select");
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
    confirmToTitlePending = false;
    let snapshot;
    try {
      snapshot = createSaveSnapshot(store.getCurrent(), scene.getSession());
    } catch (error) {
      if (!(error instanceof LifeReconciliationError)) throw error;
      rejectInput(`${slot}번 저장 칸에 저장하지 못했습니다`);
      return;
    }
    const written = saveToSlot(window.localStorage, slot, snapshot);
    if (!written.ok) {
      rejectInput(`${slot}번 저장 칸에 저장하지 못했습니다 — ${written.message}`);
      return;
    }
    options.emitMenuJuice("menu-confirm", renderMenu(`${slot}번 저장 칸에 저장했습니다`, "save"));
  }

  function loadSlot(slot: SaveSlotIndex): void {
    rememberDetailCursorFromTestId(`load-slot-${slot}`);
    options.emitMenuJuice("menu-confirm", currentMenu());
    options.loadSlot(slot, false);
  }

  function useItem(itemId: string, actorId?: string, monsterInstanceId?: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    if (actorId) rememberDetailCursorFromTestId(`status-menu-item-target-${actorId}`);
    if (monsterInstanceId) rememberDetailCursorFromTestId(`status-menu-monster-${monsterInstanceId}`);
    const beforeVitals = readStatusMenuVitals(currentMenu());
    const result = useStatusMenuItem(scene, itemId, actorId, monsterInstanceId);
    const usedItem = store.getCurrent().database.items.find((entry) => entry.id === itemId);
    if (result.kind === "used" && usedItem?.type === "switch" && usedItem.switchId && scene.getSession().switches[usedItem.switchId] === true) {
      // 메뉴가 열린 채 자동 공통 이벤트(꿈에서 깨기)가 돌면 대사가 메뉴 아래에 묻힌다.
      options.layout.querySelector("[data-testid='main-menu']")?.remove();
      void fireAutoTriggers(scene as unknown as PlaySceneContext);
      return;
    }
    if (result.kind === "used" && (scene.getSession().inventory[itemId] ?? 0) === 0) targetItemId = undefined;
    const panel = renderMenu(result.message, "items");
    if (panel && result.kind === "used") animateStatusMenuVitals(panel, beforeVitals);
    emitMutationResult(result, panel);
  }

  /** 정면·발밑 이벤트가 이 아이템을 받는가(itemUsed 페이지). 씬이 없으면 undefined. */
  function facedItemTarget(itemId: string): ReturnType<typeof findFacedItemTarget> {
    const scene = options.getActiveScene();
    if (!scene?.map) return undefined;
    return findFacedItemTarget(store.getCurrent(), scene.map, scene.getSession(), scene.eventPositions, { x: scene.tileX, y: scene.tileY, facing: scene.facing }, itemId);
  }

  function useItemOnFacedTarget(itemId: string): void {
    const scene = options.getActiveScene();
    const target = facedItemTarget(itemId);
    if (!scene || !target) {
      emitMutationResult({ kind: "unusable", message: "여기에는 쓸 수 없습니다" }, renderMenu("여기에는 쓸 수 없습니다", "items"));
      return;
    }
    itemActionId = undefined;
    // 메뉴를 닫고 이벤트 대화가 메뉴 아래에 묻히지 않게 한다(스위치 아이템 경로와 같은 이유).
    options.emitMenuJuice("menu-confirm", currentMenu());
    options.layout.querySelector("[data-testid='main-menu']")?.remove();
    void runItemUsePage(scene as unknown as PlaySceneContext, target.event.id, target.page.commands, itemId);
  }

  function combineItemsFromMenu(itemA: string, itemB: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-item-combine-${itemA}-${itemB}`);
    const project = store.getCurrent();
    const session = scene.getSession();
    const result = combineItems(project, session, itemA, itemB);
    if (!result.ok) {
      emitMutationResult({ kind: "unusable", message: "조합할 수 없습니다" }, renderMenu("조합할 수 없습니다", "items"));
      return;
    }
    setAudioState(session, { channel: "se", resourceId: "easyrpg-sound-item1", loop: false });
    scene.syncRuntimeState();
    // 재료가 떨어졌으면 목록으로 돌아간다.
    if ((session.inventory[itemA] ?? 0) <= 0 || itemCombinationPartners(project, session, itemA).length === 0) itemActionId = undefined;
    const output = project.database.items.find((item) => item.id === result.outputItemId)?.name ?? result.outputItemId;
    emitMutationResult({ kind: "used", message: "" }, renderMenu(`${output}을(를) 만들었습니다`, "items"));
  }

  function toggleSkillLoadoutFromMenu(actorId: string, skillId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-skill-${actorId}-${skillId}`);
    const project = store.getCurrent();
    const session = scene.getSession();
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) return;
    const learned = project.database.skills
      .filter((skill) => actorOwnedSkillIds(project, session, actorId).includes(skill.id))
      .map((skill) => skill.id);
    const result = toggleSkillLoadout(session, actor, learned, skillId);
    const message = result.ok
      ? (result.equipped ? "장착했습니다" : "장착을 풀었습니다")
      : result.reason === "full" ? "장착 칸이 가득 찼습니다. 먼저 하나를 푸세요." : "장착할 수 없습니다";
    scene.syncRuntimeState();
    emitMutationResult({ kind: result.ok ? "used" : "unusable", message }, renderMenu(message, "skills"));
  }

  function equipItem(actorId: string, slotId: keyof ActorInitialEquipment, equipmentId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-equipment-item-${equipmentId}`);
    const result = equipStatusMenuItem(scene, actorId, slotId, equipmentId);
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

  function optimizeEquipment(actorId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId("status-menu-equipment-optimize");
    const result = optimizeStatusMenuEquipment(scene, actorId);
    emitMutationResult(result, renderMenu(result.message, "equipment"));
  }

  function toggleActorRow(actorId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(selectedCommand === "formation" ? "status-menu-formation-toggle-row" : `status-menu-row-${actorId}`);
    const result = toggleStatusMenuActorRow(scene, actorId);
    emitMutationResult(result, renderMenu(result.message, selectedCommand === "formation" ? "formation" : "row"));
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
    monsterInstanceId = undefined;
    monsterView = monsterView === "party" ? "box" : "party";
    options.emitMenuJuice("menu-confirm", renderMenu(undefined, "monsters"));
  }

  function moveMonsterFromMenu(instanceId: string, to: "party" | "box"): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    rememberDetailCursorFromTestId(`status-menu-monster-${instanceId}`);
    const reason = to === "box" ? monsterBoxUnavailableReason(store.getCurrent(), scene.getSession(), instanceId) : undefined;
    if (reason) { rejectInput(reason); return; }
    const result = moveMonster(scene.getSession(), instanceId, to, store.getCurrent());
    if (result.ok) {
      monsterInstanceId = undefined;
      scene.refreshRuntimeSurfaces();
      scene.syncRuntimeState();
    }
    const message = result.ok
      ? to === "party" ? "몬스터를 파티로 이동했습니다" : "몬스터를 보관함으로 이동했습니다"
      : result.reason === "partyFull" ? "파티가 가득 찼습니다" : "몬스터를 찾을 수 없습니다";
    options.emitMenuJuice(result.ok ? "menu-confirm" : "menu-invalid", renderMenu(message, "monsters"));
  }

  function replaceMonsterSkillFromMenu(instanceId: string, pendingSkillId: string, replacedSkillId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    const session = scene.getSession();
    const instance = session.monsterInstances[instanceId];
    if (!instance) {
      rejectInput("몬스터를 찾을 수 없습니다");
      return;
    }
    const result = replacePendingMonsterSkill(
      store.getCurrent(),
      instance,
      pendingSkillId as SkillId,
      replacedSkillId as SkillId,
    );
    if (result.ok) session.monsterInstances[instanceId] = result.instance;
    options.emitMenuJuice(
      result.ok ? "menu-confirm" : "menu-invalid",
      renderMenu(result.ok ? "새 기술을 배웠습니다" : "기술 교체에 실패했습니다", "monsters"),
    );
  }

  function rejectMonsterSkillFromMenu(instanceId: string, pendingSkillId: string): void {
    const scene = options.getActiveScene();
    if (!scene) return;
    const session = scene.getSession();
    const instance = session.monsterInstances[instanceId];
    if (!instance) {
      rejectInput("몬스터를 찾을 수 없습니다");
      return;
    }
    const result = rejectPendingMonsterSkill(instance, pendingSkillId as SkillId);
    if (result.ok) session.monsterInstances[instanceId] = result.instance;
    options.emitMenuJuice(
      result.ok ? "menu-confirm" : "menu-invalid",
      renderMenu(result.ok ? "새 기술을 포기했습니다" : "기술 선택에 실패했습니다", "monsters"),
    );
  }

  function openGroup(entryId: StatusMenuGroupEntryId): void {
    selectedCommand = entryId;
    openGroupId = entryId;
    resetSubscreenState();
    mode = "function";
    options.emitMenuJuice("menu-confirm", renderMenu(undefined, entryId));
  }

  function enterCommand(commandId: StatusMenuRailId): void {
    if (isStatusMenuGroupEntryId(commandId)) {
      openGroup(commandId);
      return;
    }
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
      case "monster-dex":
      case "region-map":
      case "campaign-progress":
      case "trainer-card":
      case "options":
      case "load":
      case "status":
      case "row":
      case "formation":
      case "battle-reports":
      case "quests":
      case "relationships":
      case "gallery":
      case "life-ledger":
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
    confirmToTitlePending = false;
    // 접힌 그룹을 통해 들어왔으면 레일이 아니라 그룹 목록으로 한 단 돌아간다.
    if (openGroupId && !isStatusMenuGroupEntryId(selectedCommand) && groupContains(openGroupId, selectedCommand)) {
      selectedCommand = openGroupId;
      options.emitMenuJuice("menu-back", renderMenu(undefined, selectedCommand));
      return;
    }
    selectedCommand = statusMenuRailIdForCommand(selectedCommand, store.getCurrent(), options.getActiveScene()?.getSession());
    openGroupId = undefined;
    mode = "main";
    options.emitMenuJuice("menu-back", renderMenu(undefined, selectedCommand));
  }

  function groupContains(entryId: StatusMenuGroupEntryId, commandId: StatusMenuCommandId): boolean {
    const session = options.getActiveScene()?.getSession();
    if (!session) return false;
    return listStatusMenuGroupCommandIds(entryId, store.getCurrent(), session).includes(commandId);
  }

  function stepBackWithinSubscreen(): boolean {
    // 그룹 목록 화면에는 되돌릴 하위 단계가 없다.
    if (isStatusMenuGroupEntryId(selectedCommand)) return false;
    switch (selectedCommand) {
      case "items":
        if (targetItemId) {
          targetItemId = undefined;
          return true;
        }
        if (itemActionId) {
          itemActionId = undefined;
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
      case "monster-dex":
        if (campaignSpeciesId) { campaignSpeciesId = undefined; return true; }
        return false;
      case "monsters":
        if (monsterInstanceId) { monsterInstanceId = undefined; return true; }
        return false;
      case "region-map":
      case "campaign-progress":
        return false;
      case "battle-reports":
        if (battleReportIndex !== undefined) { battleReportIndex = undefined; return true; }
        return false;
      case "trainer-card":
      case "options":
      case "load":
      case "quests":
      case "relationships":
      case "gallery":
      case "life-ledger":
      case "row":
      case "status":
      case "to-title":
      case "wait":
        return false;
    }
  }

  function confirmToTitle(): void {
    if (!confirmToTitlePending) {
      confirmToTitlePending = true;
      mode = "function";
      options.emitMenuJuice(
        "menu-confirm",
        renderMenu("저장하지 않은 진행은 사라집니다. 한 번 더 선택하세요.", "to-title")
      );
      return;
    }
    confirmToTitlePending = false;
    options.emitMenuJuice("menu-confirm", currentMenu());
    window.setTimeout(() => options.renderTitle(), options.menuCloseJuiceMs);
  }

  const currentMenu = (): HTMLElement | null => currentStatusMenu(options.layout);

  function moveSelectedDetailAction(delta: -1 | 1): boolean {
    const actions = detailActionButtons();
    if (mode !== "function") return false;
    if (actions.length === 0) {
      if (selectedCommand !== "quests") return false;
      const list = currentMenu()?.querySelector<HTMLElement>(".status-menu-detail-list");
      if (!list) return false;
      list.scrollTop += delta * Math.max(24, list.clientHeight * 0.6);
      return true;
    }
    setDetailCursor(wrapStatusMenuIndex(selectedDetailActionIndex + delta, actions.length));
    syncRenderedDetailCursor();
    const detail = currentMenu()?.querySelector<HTMLElement>(".status-menu-detail");
    const message = currentMenu()?.querySelector<HTMLElement>(".status-menu-message");
    if (detail && message) message.textContent = updateStatusMenuDetailSelection(detail, selectedDetailActionIndex) ?? "";
    return true;
  }

  function activateSelectedDetailAction(): boolean {
    const actions = detailActionButtons();
    if (mode !== "function" || actions.length === 0) return false;
    setDetailCursor(wrapStatusMenuIndex(selectedDetailActionIndex, actions.length));
    const reason = actions[selectedDetailActionIndex]?.dataset.unavailableReason;
    if (reason) return rejectInput(reason);
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
    const panel = currentMenu();
    const status = panel?.querySelector<HTMLElement>(".status-menu-message");
    if (status) status.textContent = message;
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

  function syncRenderedDetailCursor(skipScroll = false): void {
    const actions = detailActionButtons();
    if (actions.length === 0) {
      setDetailCursor(0);
      focusActiveMenuContainer();
      return;
    }
    selectedDetailActionIndex = Math.max(0, Math.min(selectedDetailActionIndex, actions.length - 1));
    detailCursors.set(detailStateKey(), selectedDetailActionIndex);
    actions.forEach((action, index) => {
      const selected = index === selectedDetailActionIndex;
      action.classList.toggle("selected", selected);
      action.tabIndex = selected ? 0 : -1;
      action.setAttribute("aria-current", selected ? "true" : "false");
    });
    const detailList = currentMenu()?.querySelector<HTMLElement>(".status-menu-detail-list");
    const activeAction = actions[selectedDetailActionIndex];
    if (detailList && activeAction?.id) detailList.setAttribute("aria-activedescendant", activeAction.id);
    if (!skipScroll) actions[selectedDetailActionIndex]?.scrollIntoView({ block: "nearest" });
    focusActiveMenuContainer();
  }

  function focusActiveMenuContainer(): void {
    const menu = currentMenu();
    const target = mode === "function"
      ? menu?.querySelector<HTMLElement>(".status-menu-detail-list")
        ?? menu?.querySelector<HTMLElement>(".status-menu-detail")
      : menu?.querySelector<HTMLElement>(".status-menu-command-rail");
    if (typeof target?.focus === "function") target.focus({ preventScroll: true });
  }

  function detailStateKey(): string {
    if (isStatusMenuGroupEntryId(selectedCommand)) return `group:${selectedCommand}`;
    switch (selectedCommand) {
      case "items":
        if (targetItemId) return `items:${targetItemId}:targets`;
        return itemActionId ? `items:${itemActionId}:actions` : "items:list";
      case "skills":
        return skillActorId ? `skills:${skillActorId}:${growthTab}` : "skills:actors";
      case "equipment":
        if (!equipmentActorId) return "equipment:actors";
        if (!equipmentSlotId) return `equipment:${equipmentActorId}:slots`;
        return `equipment:${equipmentActorId}:${equipmentSlotId}:choices`;
      case "formation":
        return formationActorId ? `formation:${formationActorId}:moving` : "formation:list";
      case "monster-dex": return `monster-dex:${campaignSpeciesId ?? "list"}`;
      case "region-map": return "region-map";
      case "campaign-progress": return "campaign-progress";
      case "monsters":
        return `monsters:${monsterView}:${monsterInstanceId ?? "list"}`;
      case "battle-reports":
        return `battle-reports:${battleReportIndex ?? "list"}`;
      case "save":
      case "trainer-card":
      case "options":
      case "load":
      case "quests":
      case "relationships":
      case "gallery":
      case "life-ledger":
      case "row":
      case "status":
      case "to-title":
      case "wait":
        if (selectedCommand !== "life-ledger") return selectedCommand;
        const scene = options.getActiveScene();
        const project = store.getCurrent();
        const resolved = scene
          ? resolveLifeLedgerTab(project, scene.session, lifeLedgerTab)
          : (lifeLedgerTab ?? "recovery");
        return `life-ledger:${resolved}`;
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
    if (store.getCurrent().maps[session.currentMapId]?.disableSave === true) return false;
    return session.m2Runtime?.access.save !== false;
  }

  return { reset, renderMenu, openSaveMenu, openLifeRecoveryLedger, toggleMenu, handleKey };
}

function isRailNavKey(key: RuntimeMenuKey): boolean {
  return directionForKey(key) !== null;
}

function isDetailNavKey(key: RuntimeMenuKey): boolean {
  return isRailNavKey(key);
}

function detailDelta(key: RuntimeMenuKey): -1 | 1 {
  const dir = directionForKey(key);
  return dir === "up" || dir === "left" ? -1 : 1;
}

// 확인/취소 판정은 정본에 위임한다. 여기서만 대문자 Z·X 를 놓쳐 CapsLock 상태에서
// 상태 메뉴만 먹통이 되던 결함(적대 리뷰 6).
function isConfirmMenuKey(key: RuntimeMenuKey): boolean {
  return isConfirmKey(key);
}

function isCancelMenuKey(key: RuntimeMenuKey): boolean {
  return isCancelKey(key);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu command: ${String(value)}`);
}
