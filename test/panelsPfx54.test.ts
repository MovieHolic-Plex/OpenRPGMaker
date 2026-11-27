// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { validateEventDraftBody, validateEventDraft } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, EventPage, MapId, EventPageCondition, Project, GameMap } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { renderStoryboard, renderViewToggle, resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { branchesOf, simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { commandLabel, openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { isolateTimers } from "./mergedTeardown";
import { createDefaultGameEvent, addEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetModalStackForTest, modalStackEntryCountForTest } from "@/editor/ui/modalStack";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { renderEventPageFlow, renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { readEventSurfaceCss } from "./helpers/eventSurfaceCss";
import { renderClassicPageTabStrip, renderPageActions, openEventRailGroupFor } from "@/editor/panels/eventEditor/pageProps";
import { openPageTabContextMenu } from "@/editor/panels/eventEditor/pageTabContextMenu";
import { pageTabDropIndex } from "@/editor/panels/eventEditor/pageTabDragDrop";
import { addEventPage, clearCopiedEventPage, copyEventPageToClipboard } from "@/editor/eventPages";
import { clearCommandInspector, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { eventEditorViewLevel, setEventEditorViewLevel } from "@/editor/panels/eventEditor/beginnerChrome";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { buildSceneCards, conditionQuestion, SCENE_COMMENT_COMMAND_ID } from "@/editor/panels/eventEditor/sceneCards";
import { resetViewLevelHintForTest, VIEW_LEVEL_HINT_QUIET_MS, viewLevelHintFor } from "@/editor/panels/eventEditor/viewLevelHint";
import { editStepSummary, eventCommandChanges, linkedMapEvents, noteViewLevelSignal, pruneUndoneSteps, resetEventEditLineForTest, type EditStep } from "@/editor/panels/eventEditor/eventEditLine";
import { registerAiAssistantBridge, unregisterAiAssistantBridge, type AiBridgeSendOptions } from "@/editor/aiAssistantBridge";
import { saveEventDraft } from "@/editor/eventDraftActions";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { buildFieldMonsterFightCommands, hasFieldMonsterVictoryErasePattern } from "@/project/fieldMonsterTemplate";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { craftRecipe } from "@/project/craftRecipes";
import { applyItemUpgrade } from "@/project/upgrades";
import { deserialize, serialize } from "@/project/io";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { depositShipping, settleShipping } from "@/project/shipping";
import { resolveShopSellUnitPrice } from "@/project/shopPrice";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { GOLD_MAX, startSession } from "@/project/session";
import { resolveTerms } from "@/project/terms";
import { createInterpreter } from "@/player/interpreter";
import { createShopOverlay, listingPrice, renderShopItems, sellPrice, updateShopQuantityTotal } from "@/player/playSceneShopDom";
import { handleShopTransaction, type ShopStep } from "@/player/playSceneShop";
import { itemToGoods } from "@/player/playSceneShopGoods";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { LOCATION_DRAW_CTA_LABEL, renderLocationDrawCta, startDrawingLocations } from "@/editor/locationDrawCta";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { renderInsideLocationCondition } from "@/editor/panels/eventEditor/conditionForm";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, isLocationDrawClick } from "@/project/mapNamedLocations";
import { installLocationDrawModeGuard, dismissLocationDrawModeForLayer, dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";

describe("panelsEventEditorSuite3", () => {
  isolateTimers();
  describe("eventBattleAdmission", () => {
    isolateTimers();
    type BattleCommand = Extract<Command, { kind: "battleProcessing" }>;
    const previous = store.getCurrent();
    let project = createBlankProject();
    beforeEach(() => { project = createBlankProject(); store.replaceProject(project); });
    afterEach(() => { document.body.replaceChildren(); store.replaceProject(previous); });
    function control(id: string): HTMLElement {
      const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    }
    function select(id: string, value: string): void {
      const node = control(id);
      if (!(node instanceof HTMLSelectElement)) throw new Error(`Not a select ${id}`);
      node.value = value; node.dispatchEvent(new Event("change"));
    }
    function command(): BattleCommand {
      return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false,
        victoryBranch: [{ kind: "setFlag", flag: "kept", value: true }] };
    }
    function troop() {
      const record = project.database.troops[0];
      if (!record) throw new Error("Missing fixture troop");
      return record;
    }
    describe("native battle confirmation admission", () => {
      it.each(["empty", "missing", "empty-members", "variable-empty", "variable-missing"])("retains the draft when %s is confirmed and allows corrected authoring", kind => {
        // Given an incomplete command and a separate valid troop for correction.
        const initial = command();
        const validId = troop().id;
        if (kind === "missing") initial.troopId = "removed-troop";
        if (kind === "empty-members") {
          project.database.troops.push({ ...troop(), id: "empty", members: [], enemyIds: [] });
          initial.troopId = "empty";
        }
        if (kind.startsWith("variable")) {
          initial.troopSource = "variable"; initial.troopVariableId = kind === "variable-empty" ? "" : "removed-variable";
        }
        const apply = vi.fn();
        openEventCommandEditDialog({ initial, onApply: apply });
        const dialog = control("event-command-edit-dialog");
        control("battle-processing-preset-boss").click();
        // When confirming invalid input, no command is committed or discarded.
        control("event-command-edit-ok").click();
        expect(apply).not.toHaveBeenCalled();
        expect(control("event-command-edit-dialog")).toBe(dialog);
        const warning = control("battle-processing-warning");
        expect(warning.hidden).toBe(false);
        expect(warning.textContent?.trim().length).toBeGreaterThan(0);
        // Correct the same mounted draft; prior rule and branch edits survive.
        select("battle-processing-troop-source", "fixed");
        select("battle-processing-troop-select", validId);
        control("event-command-edit-ok").click();
        expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
          troopId: validId, canEscape: false, battleFlow: "strict", victoryBranch: initial.victoryBranch,
        }));
        expect(dialog.isConnected).toBe(false);
      });

      it("revalidates a troop removed while the dialog is open", () => {
        const apply = vi.fn();
        openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
        project.database.troops = [];
        control("event-command-edit-ok").click();
        expect(apply).not.toHaveBeenCalled();
        expect(control("battle-processing-warning").hidden).toBe(false);
      });

      it("accepts a selected variable without treating the unused fixed reference as required", () => {
        const variable = project.variables[0];
        if (!variable) throw new Error("Missing fixture variable");
        const initial = { ...command(), troopSource: "variable", troopVariableId: variable.id } as const;
        const apply = vi.fn();
        openEventCommandEditDialog({ initial, onApply: apply });
        control("event-command-edit-ok").click();
        expect(apply).toHaveBeenCalledExactlyOnceWith(initial);
      });

      it.each(["hidden", "legacy"])("accepts legitimate %s composition", kind => {
        if (kind === "hidden") troop().members = troop().enemyIds.map(enemyId => ({ enemyId, hidden: true, x: 20, y: 20 }));
        else troop().members = [];
        const apply = vi.fn();
        openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
        control("event-command-edit-ok").click();
        expect(apply).toHaveBeenCalledTimes(1);
      });

      it("blocks aggregate event Apply for a troop whose effective composition is empty", () => {
        troop().members = []; troop().enemyIds = [];
        const event: GameEvent = { id: "admission", x: 1, y: 1, trigger: { kind: "action" },
          commands: [], pages: [{ id: "battle-page", name: "Battle", conditions: [], graphic: {},
            trigger: { kind: "action" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ ...command(), troopId: troop().id }] }] };
        const result = validateEventDraftBody(project, project.startMapId, event);
        expect(result.canCommit).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({ code: "battle.troop.empty", severity: "error", commandPath: [0] }));
      });
    });
  });
  describe("eventCommand", () => {
    isolateTimers();
    //
    // 분기 열거의 정본이 하나임을 못박는 계약 테스트.
    //
    // 회귀 배경(실측 2026-08-31): 같은 일을 하는 분기 열거 함수가 다섯 벌 있었고 그중 셋이
    // 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다. 런타임(`player/interpreter/resume.ts`)
    // 은 그 분기를 실행하는데 목록·플로우·미리보기에는 줄이 안 났고, 검증도 그 안으로 들어가지
    // 않았다 — 화면에 없는 분기는 모르고 지워진다. 라벨도 뷰마다 갈려 같은 분기가 «참» /
    // «참일 때» / «조건이 맞을 때» / «조건을 만족함» 네 이름으로 불렸다.
    describe("eventCommandBranchesSingleSource", () => {
      isolateTimers();
      const SUCCESS = "거래 감사합니다!";
      const FAILURE = "돈이 모자라시군요.";
      function shopWithBothBranches(): Command {
        return {
          kind: "shop",
          itemIds: [],
          allowSell: true,
          branchOnTransaction: true,
          transactionBranch: [{ kind: "text", body: SUCCESS }],
          branchOnFailedTransaction: true,
          failedTransactionBranch: [{ kind: "text", body: FAILURE }],
        } as Command;
      }
      function textOf(node: HTMLElement): string {
        return node.textContent ?? "";
      }
      /** 목록 뷰는 host 에 그려 넣는다. 액션은 이 테스트에서 쓰지 않으므로 빈 껍데기를 넘긴다. */
      function listHostFor(commands: Command[]): HTMLElement {
        const host = document.createElement("div");
        renderCommandList(host, commands, [], {} as never);
        return host;
      }
      describe("상점 실패 분기는 모든 뷰에 나온다", () => {
        it("정본이 성공·실패 두 분기를 라벨과 경로 칸까지 준다", () => {
          const branches = eventCommandBranches(shopWithBothBranches());
          expect(branches.map((branch) => branch.kind)).toEqual(["shopTransaction", "shopFailure"]);
          expect(branches.map((branch) => branch.label)).toEqual(["거래했을 때", "거래하지 못했을 때"]);
          // -1 / -12 는 `eventCommandPaths` 가 정한 분기 인덱스다. 목록 뷰는 예전에 -12 를
          // import 조차 하지 않아 이 분기를 주소로 가리킬 수 없었다.
          expect(branches.map((branch) => branch.branchIndex)).toEqual([-1, -12]);
        });

        it("목록 뷰가 실패 분기 줄과 그 안의 명령을 찍는다", () => {
          const host = listHostFor([shopWithBothBranches()]);
          const text = textOf(host);
          expect(text).toContain("거래했을 때");
          expect(text).toContain(SUCCESS);
          expect(text).toContain("거래하지 못했을 때");
          expect(text).toContain(FAILURE);
          expect(host.querySelector("[data-container-path='[0,-12]']")).not.toBeNull();
        });

        it("스토리 뷰가 실패 분기를 해결 가능한 경로로 찍는다", () => {
          const host = renderStoryboard([shopWithBothBranches()]);
          expect(textOf(host)).toContain(FAILURE);
          expect(host.querySelector<HTMLElement>("[data-cmd-path='[0,-12,0]']")?.textContent).toContain(FAILURE);
        });

        it("미리보기 스텝에 실패 분기 대사가 들어간다", () => {
          const steps = simulatePageCommands([shopWithBothBranches()]).steps;
          const bodies = steps.map((step) => (step.command.kind === "text" ? step.command.body : ""));
          expect(bodies).toContain(SUCCESS);
          expect(bodies).toContain(FAILURE);
          const failureStep = steps.find((step) => step.command.kind === "text" && step.command.body === FAILURE);
          expect(failureStep?.branchLabel).toBe("거래하지 못했을 때");
        });

        it("플로우가 쓰는 어댑터와 프로젝트 순회 어댑터도 두 분기를 본다", () => {
          expect(branchesOf(shopWithBothBranches()).map((branch) => branch.label))
            .toEqual(["거래했을 때", "거래하지 못했을 때"]);
          expect(commandBranches(shopWithBothBranches()).map((branch) => branch.kind))
            .toEqual(["shopTransaction", "shopFailure"]);
        });
      });
      describe("분기 라벨은 뷰마다 갈리지 않는다", () => {
        const fork: Command = {
          kind: "fork",
          condition: { kind: "switch", switchId: "0001", value: true },
          then: [{ kind: "text", body: "참 쪽" }],
          else: [{ kind: "text", body: "거짓 쪽" }],
        };

        it("조건 분기는 네 뷰 모두 같은 이름을 쓴다", () => {
          const canonical = eventCommandBranches(fork).map((branch) => branch.label);
          expect(canonical).toEqual(["조건이 맞을 때", "조건이 맞지 않을 때"]);

          // 플로우 어댑터
          expect(branchesOf(fork).map((branch) => branch.label)).toEqual(canonical);
          // 목록 뷰 — d885889d6e 부터 목록만 정본 라벨을 짧게 말한다(「그러면」/「아니면」).
          // 그래도 정본 라벨에서 한 함수(shortArmLabel)로 파생되므로 뷰마다 갈리지 않는다.
          const list = textOf(listHostFor([fork]));
          expect(canonical.map(shortArmLabel)).toEqual(["그러면", "아니면"]);
          for (const label of canonical) expect(list).toContain(shortArmLabel(label));
          // 스토리 뷰
          const storyboard = textOf(renderStoryboard([fork]));
          for (const label of canonical) expect(storyboard).toContain(label);
          // 미리보기 스텝 라벨
          const labels = simulatePageCommands([fork]).steps.map((step) => step.branchLabel).filter(Boolean);
          expect(new Set(labels)).toEqual(new Set(canonical));
        });

        it("빈 배열도 저작 대상이라 분기로 센다", () => {
          // `commandBranches` 로 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있다(AI 병합 경로).
          const emptyShop = { kind: "shop", itemIds: [], failedTransactionBranch: [] } as Command;
          expect(eventCommandBranches(emptyShop).map((branch) => branch.kind)).toEqual(["shopFailure"]);
        });
      });
    });
    describe("eventCommandDragOwnership", () => {
      isolateTimers();
      const MIME = "application/x-oprn-event-command-path";
      const commands = [{ kind: "text" as const, body: "A" }, { kind: "text" as const, body: "B" }];
      const actions = (): CommandListActions => ({
        addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: vi.fn(),
        deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
      });
      function dragEvent(type: string, types = [MIME], payload = "[0]"): Event {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { types, getData: () => payload, setData: vi.fn() },
        });
        return event;
      }
      function startDrag(host: HTMLElement): HTMLElement {
        const item = host.querySelector<HTMLElement>(".cmd-item")!;
        item.querySelector(".cmd-drag-handle")!.dispatchEvent(new Event("pointerdown"));
        item.dispatchEvent(dragEvent("dragstart"));
        return item;
      }
      function mount(callbacks: CommandListActions): HTMLElement {
        const host = document.createElement("div");
        document.body.append(host);
        renderCommandList(host, commands, [], callbacks);
        return host;
      }
      afterEach(() => {
        document.querySelectorAll(".cmd-item").forEach(item => item.dispatchEvent(new Event("dragend")));
        document.body.replaceChildren();
      });
      describe("event command drag ownership", () => {
        it("ignores plain text and unowned command payloads", () => {
          const callbacks = actions();
          const host = mount(callbacks);
          host.dispatchEvent(dragEvent("drop", ["text/plain"]));
          host.dispatchEvent(dragEvent("drop"));
          expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
        });

        it("rejects commands dragged from another editor and altered payloads", () => {
          const first = mount(actions());
          const callbacks = actions();
          const second = mount(callbacks);
          startDrag(first);
          second.dispatchEvent(dragEvent("drop"));
          startDrag(second);
          second.dispatchEvent(dragEvent("drop", [MIME], "[1]"));
          expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
        });

        it("uses current callbacks after reusing a list host and rejects the old drag", () => {
          const oldActions = actions();
          const currentActions = actions();
          const host = mount(oldActions);
          const oldSource = startDrag(host);
          renderCommandList(host, commands, [], currentActions);
          host.dispatchEvent(dragEvent("drop"));
          expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
          expect(currentActions.moveCommandTo).not.toHaveBeenCalled();
          oldSource.dispatchEvent(new Event("dragend"));
          startDrag(host);
          host.dispatchEvent(dragEvent("drop"));
          expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
          expect(currentActions.moveCommandTo).toHaveBeenCalledExactlyOnceWith([0], Number.MAX_SAFE_INTEGER);
        });
      });
    });
    describe("eventCommandPickerAudio", () => {
      isolateTimers();
      describe("event command picker audio intent", () => {
        afterEach(() => {
          document.body.replaceChildren();
        });

        it.each([
          ["BGM 재생...", true],
          ["SE 재생...", false],
        ] as const)("preserves the channel selected by %s", (label, loop) => {
          let selected: Command | null = null;
          openEventCommandPicker({
            title: "이벤트 명령",
            context: "map",
            onSelect: (command) => {
              selected = command;
            },
          });

          const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command"))
            .find((candidate) => candidate.getAttribute("aria-label") === label);
          expect(button, `${label} command button`).toBeDefined();
          button?.click();

          expect(selected).toEqual({ kind: "playAudio", resourceId: "", loop });
        });

        it("uses a channel-neutral edit-dialog label", () => {
          expect(commandLabel("playAudio")).toBe("소리 재생");
        });
      });
    });
  });
  describe("eventDraftProjectionIntegration", () => {
    isolateTimers();
    let mapId: string;
    const eventId = "projection-integration";
    function control(id: string): HTMLElement {
      const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing ${id}`);
      return node;
    }
    beforeEach(() => {
      resetModalStackForTest();
      const project = createBlankProject();
      mapId = project.startMapId;
      const event = createDefaultGameEvent(2, 2);
      event.id = eventId;
      event.characterId = "alice";
      project.characters = { alice: { displayName: "Before" } };
      const map = project.maps[mapId];
      if (!map) throw new Error("Missing map");
      map.events = [event];
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: event.pages?.[0]?.id ?? null });
      openEventEditorModal(mapId, eventId);
      resetMapEditHistory();
    });
    afterEach(() => {
      document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
      document.body.replaceChildren();
      resetModalStackForTest();
      resetMapEditHistory();
    });
    it("renders the staged name in the NPC rail without changing canonical profiles", () => {
      // Given: a mounted editor linked to an existing profile.
      const input = control("event-character-display-name-input");
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected name input");
      // When: the actual name control stages an edit.
      input.value = "Staged name";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // Then: rail and working input agree while canonical data stays isolated.
      expect(control("evt-rail-meta-npc").textContent).toBe("Staged name");
      expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
    });
    it("validates a newly staged switch and commits it through parent Apply", () => {
      // Given: the actual field-template dialog over the event editor.
      control("event-command-toolbar-field-monster").click();
      const input = control("field-monster-template-clear-switch");
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected switch input");
      input.value = "projection_new_switch";
      control("field-monster-template-apply").click();
      const before = store.getCurrent();
      expect(before.switches.some(entry => entry.id === "projection_new_switch")).toBe(false);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
      // When: parent validation consumes the same transaction that Apply will commit.
      expect(validateEventDraft(before, mapId, eventId).canCommit).toBe(true);
      control("event-editor-apply").click();
      // Then: the switch and template pages commit atomically, not a fatal-reference refusal.
      const canonical = projectWithoutEventDrafts(store.getCurrent());
      expect(canonical.switches.some(entry => entry.id === "projection_new_switch")).toBe(true);
      expect(canonical.maps[mapId]?.events.find(entry => entry.id === eventId)?.pages).toHaveLength(2);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
    });
  });
  //
  // 플로우가 «미리보기 위에 겹치는 팝오버» 에서 «네 번째 보기 방식» 으로 승격된 계약.
  //
  // 회귀 배경(실측 2026-08-31): 플로우는 도구 팝오버 안 `<details>` 아코디언이었고
  // 618×280 으로 묶여 있었다. 1440px 높이 화면에서도 280px 만 써서 최상위 명령 7개 중
  // 2개만 보였고, 무엇보다 미리보기 **위에** 절대 배치로 떠서 「자동 재생」 버튼과 단계
  // 카운터를 덮었다. 겹쳐 뜨는 동안에도 미리보기가 몇 번째 단계인지 알려주지 않아
  // 두 화면이 서로 남남이었다.
  //
  // 여기서 못박는 것:
  //  1) 플로우는 `<details>` 팝오버가 아니다 (겹칠 오버레이가 없다)
  //  2) 보기 방식 세그먼트에 네 번째 버튼으로 있고, 미리보기와 배타적이다
  //  3) 미리보기가 보던 단계를 **경로로** 짚는다 — 인덱스로 짚으면 `breakLoop` 에서 어긋난다
  describe("eventPageFlowView", () => {
    isolateTimers();
    const PAGE_BASE: Omit<EventPage, "commands"> = {
      id: "pg_flow",
      name: "테스트",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
    };
    function pageWith(commands: Command[]): EventPage {
      return { ...PAGE_BASE, commands };
    }
    /** 분기 안쪽에 명령이 있는 페이지 — 경로가 여러 칸인 단계를 만든다. */
    function branchingPage(): EventPage {
      return pageWith([
        { kind: "text", body: "첫 줄" },
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "", value: true },
          then: [{ kind: "text", body: "참 쪽" }],
          else: [{ kind: "text", body: "거짓 쪽" }],
        },
        { kind: "text", body: "마지막 줄" },
      ] as Command[]);
    }
    function flowFor(page: EventPage, opts?: { onSelect?: (path: number[]) => void }): HTMLElement {
      store.replace(createBlankProject());
      return renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page, ...opts });
    }
    describe("플로우 보기 승격", () => {
      it("팝오버 details 가 아니라 칼럼을 쓰는 section 이다", () => {
        const flow = flowFor(branchingPage());
        expect(flow.tagName.toLowerCase()).toBe("section");
        expect(flow.querySelector("details")).toBeNull();
        expect(flow.querySelector("[data-testid='event-script-flowchart']")).toBeNull();
        expect(flow.dataset.testid).toBe("event-page-flow");
      });

      it("보기 방식 세그먼트의 네 번째 버튼이고 미리보기와 배타적이다", () => {
        const bar = renderViewToggle("flow", () => {});
        const labels = Array.from(bar.querySelectorAll("button")).map((btn) => btn.textContent);
        expect(labels).toEqual(["목록", "스토리", "미리보기", "플로우"]);
        const flowBtn = bar.querySelector("[data-testid='event-view-toggle-flow']");
        const previewBtn = bar.querySelector("[data-testid='event-view-toggle-preview']");
        expect(flowBtn?.getAttribute("aria-selected")).toBe("true");
        expect(previewBtn?.getAttribute("aria-selected")).toBe("false");
      });

      it("미리보기를 한 번도 열지 않았으면 강조하지 않고, 안내만 보여준다", () => {
        const flow = flowFor(pageWith([{ kind: "text", body: "혼자" }] as Command[]));
        expect(flow.querySelectorAll(".event-flow-node.is-current").length).toBe(0);
        expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
          .toContain("미리보기에서 보던 단계");
      });

      it("미리보기가 보던 단계를 이어받아 그 노드를 짚는다", () => {
        const page = branchingPage();
        store.replace(createBlankProject());
        // 미리보기를 열고 「다음」을 세 번 눌러 참 쪽 분기 안(경로 [1,-2,0])까지 간다.
        const preview = renderEventPagePreview({ mapId: "map_start", eventId: "ev_flow", page });
        const next = preview.querySelector<HTMLElement>("[data-testid='event-script-live-next']");
        if (!next) throw new Error("미리보기 「다음」 버튼을 찾지 못했다");
        next.click();
        next.click();

        const steps = simulatePageCommands(page.commands, "ev_flow").steps;
        const expectedPath = steps[2]?.path;
        expect(expectedPath).toEqual([1, -2, 0]);

        const flow = renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page });
        const current = flow.querySelectorAll<HTMLElement>(".event-flow-node.is-current");
        expect(current.length).toBe(1);
        expect(current[0]?.dataset.cmdPath).toBe(JSON.stringify(expectedPath));
        expect(current[0]?.getAttribute("aria-current")).toBe("step");
        expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
          .toBe(`미리보기 현재 단계 3/${steps.length}`);
      });

      it("노드를 누르면 목록·스토리와 같은 편집 경로를 넘긴다", () => {
        const picked: number[][] = [];
        const flow = flowFor(branchingPage(), { onSelect: (path) => picked.push(path) });
        const nodes = flow.querySelectorAll<HTMLElement>(".event-flow-node");
        // 순차 명령 3개 + 분기 안 2개 = 5개 노드.
        expect(nodes.length).toBe(5);
        nodes[2]?.click();
        expect(picked).toEqual([[1, -2, 0]]);
      });

      it("`breakLoop` 이 뒤 명령을 끊어도 단계 경로는 어긋나지 않는다", () => {
        // 인덱스로 짝지으면 여기서 깨진다: 단계는 breakLoop 에서 멈추지만 플로우는 뒤 노드도 그린다.
        const page = pageWith([
          {
            kind: "loop",
            body: [
              { kind: "breakLoop" },
              { kind: "text", body: "닿지 않는 줄" },
            ],
          },
          { kind: "text", body: "반복 다음" },
        ] as Command[]);
        store.replace(createBlankProject());
        const steps = simulatePageCommands(page.commands, "ev_flow").steps;
        // 단계: loop, breakLoop, (뒤 텍스트는 걷지 않음), 반복 다음
        expect(steps.map((step) => step.command.kind)).toEqual(["loop", "breakLoop", "text"]);
        expect(steps.map((step) => step.path)).toEqual([[0], [0, -5, 0], [1]]);

        const flow = flowFor(page);
        // 플로우는 닿지 않는 줄까지 그리므로 노드는 4개 — 단계 수(3)와 다르다.
        const paths = Array.from(flow.querySelectorAll<HTMLElement>(".event-flow-node"))
          .map((node) => node.dataset.cmdPath);
        expect(paths).toEqual([
          JSON.stringify([0]),
          JSON.stringify([0, -5, 0]),
          JSON.stringify([0, -5, 1]),
          JSON.stringify([1]),
        ]);
        expect(paths.length).not.toBe(steps.length);
      });
    });
  });
  // test/eventPageManagementSurface.test.ts
  //
  // 이벤트 편집기 「페이지 관리」 작업면 계약. 2026-08-30 적대적 리뷰가 실측한 결함을 잡는다:
  //
  //   D1 헤더 이름 상자가 활성 페이지를 따라가지 않고, 고치면 **다른 페이지**가 바뀌었다.
  //   D2 복사·삭제가 모달 오른쪽 끝(x=1514) 접힌 details 안에 있어 화면에 없었다.
  //   D3 페이지 복제(`copyEventPage`)가 UI 에서 도달 불가였다.
  //   D4 페이지 순서 이동(`moveEventPage`)이 UI 에서 도달 불가였다 — 순서가 런타임 우선순위다.
  //   D5 붙여넣기·삭제가 조건부 마운트라 버튼이 나타났다 사라졌다.
  //   D7 탭 우클릭 메뉴가 없었다(명령 목록에는 있다).
  //   D8 role=tab 에 aria-pressed 를 함께 쓰고, tabindex·방향키가 없었다.
  describe("eventPageManagementSurface", () => {
    isolateTimers();
    let mapId: MapId;
    let eventId: string;
    beforeEach(() => {
      resetModalStackForTest();
      clearCopiedEventPage();
      store.replace(createBlankProject());
      mapId = store.getCurrent().startMapId;
      eventId = addEvent(mapId, 3, 3);
      document.body.replaceChildren();
    });
    function currentEvent(): GameEvent {
      const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
      if (!event) throw new Error("event missing");
      return event;
    }
    function pages(): readonly EventPage[] {
      return currentEvent().pages ?? [];
    }
    function actions(activeIndex = 0): HTMLElement {
      const event = currentEvent();
      const page = (event.pages ?? [])[activeIndex];
      if (!page) throw new Error(`page ${activeIndex} missing`);
      const host = document.createElement("div");
      host.append(renderPageActions(mapId, event, page));
      document.body.append(host);
      return host;
    }
    function button(host: HTMLElement, testId: string): HTMLButtonElement {
      const node = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      if (!node) throw new Error(`missing ${testId}`);
      return node;
    }
    describe("페이지 관리 작업면", () => {
      it("여섯 액션을 항상 마운트하고, 못 쓰는 것은 disabled + 이유를 말한다 (D2·D5)", () => {
        const host = actions();
        const ids = [
          "event-page-duplicate",
          "event-page-copy",
          "event-page-paste",
          "event-page-move-back",
          "event-page-move-forward",
          "event-page-delete",
        ];
        for (const id of ids) expect(button(host, id)).toBeTruthy();

        // 페이지 하나 · 클립보드 비었음 → 붙여넣기·순서·삭제는 못 쓴다.
        expect(button(host, "event-page-paste").disabled).toBe(true);
        expect(button(host, "event-page-paste").title).toContain("먼저 복사");
        expect(button(host, "event-page-delete").disabled).toBe(true);
        expect(button(host, "event-page-delete").title).toContain("하나뿐");
        expect(button(host, "event-page-move-back").disabled).toBe(true);
        expect(button(host, "event-page-move-forward").disabled).toBe(true);
        // 여섯 버튼은 ⋯ 메뉴 안에 있지만 항상 마운트된다. 닫힌 details 여도 .click() 은 동작한다.
        const menu = host.querySelector("details");
        expect(menu?.querySelector("summary")?.getAttribute("aria-label")).toBe("페이지 메뉴");
        expect(menu?.querySelectorAll("button")).toHaveLength(ids.length);
      });

      it("복제는 원본 바로 앞의 낮은 우선순위에 꽂는다 — 원본 뒤면 런타임 승자가 바뀐다 (D3)", () => {
        addEventPage(mapId, eventId);
        addEventPage(mapId, eventId);
        expect(pages()).toHaveLength(3);
        const sourceId = pages()[0]!.id;

        button(actions(0), "event-page-duplicate").click();

        const after = pages();
        expect(after).toHaveLength(4);
        expect(after[1]!.id).toBe(sourceId);
        expect(after[0]!.name).toBe(`${after[1]!.name} 복사본`);
      });

      it("순서 이동 버튼이 실제로 페이지를 옮기고 양 끝에서 막힌다 (D4)", () => {
        addEventPage(mapId, eventId);
        const [first, second] = [pages()[0]!.id, pages()[1]!.id];

        button(actions(1), "event-page-move-back").click();

        expect(pages().map((page) => page.id)).toEqual([second, first]);
        expect(button(actions(0), "event-page-move-back").disabled).toBe(true);
        expect(button(actions(1), "event-page-move-forward").disabled).toBe(true);
      });

      it("복사를 누르면 붙여넣기가 살아난다 (D5)", () => {
        const host = actions();
        expect(button(host, "event-page-paste").disabled).toBe(true);
        button(host, "event-page-copy").click();
        // 복사는 스토어를 바꾸지 않으므로 액션 줄이 스스로 자기를 다시 그린다.
        const refreshed = document.body.querySelector<HTMLElement>('[data-testid="event-page-tabs"]');
        expect(refreshed?.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')?.disabled).toBe(false);
      });

      it("탭은 WAI-ARIA tablist 계약을 지킨다: aria-pressed 없음, roving tabindex (D8)", () => {
        addEventPage(mapId, eventId);
        const event = currentEvent();
        editorState.set({ selectedEventPageId: (event.pages ?? [])[1]!.id });
        const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[1]!);

        const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment")];
        expect(tabs).toHaveLength(2);
        for (const tab of tabs) expect(tab.getAttribute("aria-pressed")).toBeNull();
        expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
        expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0"]);
      });

      it("방향키가 페이지 선택을 옮기고, Ctrl+방향키는 순서를 바꾼다 (D8)", () => {
        addEventPage(mapId, eventId);
        const event = currentEvent();
        const [first, second] = [(event.pages ?? [])[0]!.id, (event.pages ?? [])[1]!.id];
        editorState.set({ selectedEventPageId: first });
        const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
        document.body.append(strip);

        strip
          .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
          .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        expect(editorState.get().selectedEventPageId).toBe(second);

        strip
          .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
          .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true }));
        expect(pages().map((page) => page.id)).toEqual([second, first]);
      });

      it("실제 모달 구독 렌더 뒤에도 방향키와 Ctrl+방향키 포커스가 선택 페이지를 따른다", () => {
        addEventPage(mapId, eventId);
        editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: pages()[0]!.id });
        openEventEditorModal(mapId, eventId);
        const firstId = pages()[0]!.id;
        const secondId = pages()[1]!.id;
        const first = document.querySelector<HTMLElement>(`.evt-page-segment[data-page-id="${firstId}"]`)!;
        first.focus();

        first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        expect(editorState.get().selectedEventPageId).toBe(secondId);
        expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);

        document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowLeft", ctrlKey: true, bubbles: true,
        }));
        expect(pages().map((page) => page.id)).toEqual([secondId, firstId]);
        expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);
        expect((document.activeElement as HTMLElement).dataset.pageId).toBe(editorState.get().selectedEventPageId);
      });

      it("우클릭 메뉴의 붙여넣기는 선택이 아니라 **우클릭한** 페이지 바로 앞에 넣는다", () => {
        // 우클릭은 선택을 옮기지 않는다. 예전엔 붙여넣기가 editorState 의 활성 페이지로 자리를 잡아서,
        // 1페이지를 고른 상태에서 3페이지를 우클릭해 붙여넣으면 새 페이지가 index 0 에 꽂혔다.
        addEventPage(mapId, eventId);
        addEventPage(mapId, eventId);
        const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
        expect(copyEventPageToClipboard(mapId, eventId, first.id)).toBe(true);
        editorState.set({ selectedEventPageId: first.id });

        openPageTabContextMenu({
          x: 20, y: 20, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
        });
        document.querySelector<HTMLElement>('[data-testid="event-page-menu-paste"]')!.click();

        const after = pages();
        const pastedIndex = after.findIndex((page) => page.id === editorState.get().selectedEventPageId);
        expect(after.findIndex((page) => page.id === third.id)).toBe(3);
        expect(pastedIndex).toBe(2);
      });

      it("한 동작은 한 단어만 쓰고, 보이는 라벨이 접근성 이름에 들어 있다 (WCAG 2.5.3)", () => {
        const host = actions();
        const expected = [
          ["event-page-duplicate", "복제"],
          ["event-page-copy", "복사"],
          ["event-page-paste", "붙여넣기"],
          ["event-page-delete", "삭제"],
        ] as const;
        for (const [testId, label] of expected) {
          const node = button(host, testId);
          // 보이는 라벨은 진짜 텍스트 노드다 — `font-size:0` + `::after` 로 다른 말을 그리면 이 단언이 깨진다.
          expect(node.textContent, testId).toBe(label);
          expect(node.querySelector(".event-page-button-label")?.textContent, testId).toBe(label);
          expect(node.dataset.compactLabel, testId).toBeUndefined();
          expect(node.getAttribute("aria-label") ?? "", testId).toContain(label);
          // 비활성이여도 title 은 라벨을 되둥하지 않고 이유를 말한다.
          expect(node.getAttribute("title") ?? "", testId).not.toBe(label);
        }
      });

      it("좁은 포트 CSS 는 라벨을 지우고 다시 그리는 장치를 쓰지 않는다", () => {
        // 2026-09-11 Task 13: 페이지 버튼 규칙을 갖던 event-editor.balanced.css 는 구성 요소 버킷으로 흩어졌다 → 표면 전체를 본다.
        const css = readEventSurfaceCss();
        expect(css).not.toContain("attr(data-compact-label)");
        expect(css).not.toMatch(/\.event-page-button-label\s*\{[^}]*font-size:\s*0/u);
      });

      it("메뉴 복사는 선택을 옮기지 않는다 — 읽기 행위가 헤더·목록·버튼 대상을 끌고 가면 안 된다", () => {
        addEventPage(mapId, eventId);
        addEventPage(mapId, eventId);
        const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
        editorState.set({ selectedEventPageId: first.id });

        openPageTabContextMenu({
          x: 12, y: 12, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
        });
        document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

        expect(editorState.get().selectedEventPageId).toBe(first.id);
      });

      it("이미 활성인 페이지를 메뉴로 복사해도 버튼 줄의 붙여넣기가 살아나고 안내도 바뀌다", () => {
        // 클립보드에 변경 통지가 없어서, 메뉴 복사 후에도 붙여넣기가 disabled + "먼저 복사를 누르세요"
        // 로 남았다 — 같은 화면의 성공 토스트와 정반대로 말하는 상태다.
        const host = actions(0);
        const active = pages()[0]!;
        editorState.set({ selectedEventPageId: active.id });
        expect(button(host, "event-page-paste").disabled).toBe(true);

        openPageTabContextMenu({
          x: 12, y: 12, mapId, event: currentEvent(), page: active, index: 0, requestDelete: () => undefined,
        });
        document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

        const paste = document.body.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')!;
        expect(paste.disabled).toBe(false);
        expect(paste.title).not.toContain("먼저 복사");
        expect(paste.title).toContain("앞");
      });

      it("탭 우클릭 메뉴가 여섯 항목을 주고 클립보드 상태를 반영한다 (D7)", () => {
        addEventPage(mapId, eventId);
        const event = currentEvent();
        const page = (event.pages ?? [])[0]!;
        openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });

        const menu = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
        expect(menu).toBeTruthy();
        expect(menu!.getAttribute("role")).toBe("menu");
        expect([...menu!.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid"))).toEqual([
          "event-page-menu-duplicate",
          "event-page-menu-copy",
          "event-page-menu-paste",
          "event-page-menu-move-back",
          "event-page-menu-move-forward",
          "event-page-menu-delete",
        ]);
        // 첫 페이지에서는 앞으로 옮기기와 빈 버퍼의 붙여넣기가 막혀 있다.
        expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-move-back"]')!.disabled).toBe(true);
        expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(true);

        copyEventPageToClipboard(mapId, eventId, page.id);
        openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });
        const reopened = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
        expect(reopened!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(false);
      });

      it("우클릭 메뉴는 모달 스택 최상단을 잡는다 — Escape 가 이벤트 편집기까지 닫지 않도록", () => {
        const event = currentEvent();
        const page = (event.pages ?? [])[0]!;
        const before = modalStackEntryCountForTest();

        openPageTabContextMenu({ x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined });
        expect(modalStackEntryCountForTest()).toBe(before + 1);

        document
          .querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
          .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(document.querySelector('[data-testid="event-page-context-menu"]')).toBeNull();
        expect(modalStackEntryCountForTest()).toBe(before);
      });

      it("우클릭 메뉴의 모든 닫기 경로가 리스너와 raw 모달 엔트리를 함께 치운다", () => {
        addEventPage(mapId, eventId);
        const event = currentEvent();
        const page = event.pages![0]!;
        const request = { x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined };
        const baseline = modalStackEntryCountForTest();

        openPageTabContextMenu(request);
        openPageTabContextMenu(request);
        expect(document.querySelectorAll('[data-testid="event-page-context-menu"]')).toHaveLength(1);
        expect(modalStackEntryCountForTest()).toBe(baseline + 1);

        document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();
        expect(modalStackEntryCountForTest()).toBe(baseline);

        openPageTabContextMenu(request);
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        expect(modalStackEntryCountForTest()).toBe(baseline);

        openPageTabContextMenu(request);
        document.querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
          .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(modalStackEntryCountForTest()).toBe(baseline);
      });

      it("페이지가 한 장이면 탭을 끌 수 없다", () => {
        const strip = renderClassicPageTabStrip(mapId, currentEvent(), pages()[0]!);
        const tab = strip.querySelector<HTMLElement>(".evt-page-segment[data-page-id]");
        expect(tab?.getAttribute("draggable")).toBe("false");
      });

      it("페이지가 두 장 이상이면 탭을 끌 수 있고, 복제 버튼은 브라우저 기본 드래그를 막는다", () => {
        addEventPage(mapId, eventId);
        const event = currentEvent();
        const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
        document.body.append(strip);
        const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment[data-page-id]")];
        expect(tabs).toHaveLength(2);
        for (const tab of tabs) expect(tab.getAttribute("draggable")).toBe("true");
        expect(tabs[0]!.title).toContain("끌어다 놓아");

        const host = actions();
        const duplicate = button(host, "event-page-duplicate");
        expect(duplicate.getAttribute("draggable")).toBe("false");
        const drag = new Event("dragstart", { bubbles: true, cancelable: true });
        duplicate.dispatchEvent(drag);
        expect(drag.defaultPrevented).toBe(true);
      });

      it("탭 드롭은 소스 제거를 보정한 자리에 꽂는다", () => {
        expect(pageTabDropIndex(0, 2, false)).toBe(2);
        expect(pageTabDropIndex(2, 0, true)).toBe(0);
        expect(pageTabDropIndex(1, 1, false)).toBe(1);
      });

      it("탭을 다른 탭 위에 떨어뜨리면 페이지 순서가 바뀐다", () => {
        addEventPage(mapId, eventId);
        addEventPage(mapId, eventId);
        const [first, second, third] = pages();
        editorState.set({ selectedEventPageId: first!.id });
        const strip = renderClassicPageTabStrip(mapId, currentEvent(), first!);
        document.body.append(strip);
        const source = strip.querySelector<HTMLElement>(`[data-page-id="${first!.id}"]`)!;
        const target = strip.querySelector<HTMLElement>(`[data-page-id="${third!.id}"]`)!;
        target.getBoundingClientRect = () => ({
          x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 28, width: 80, height: 28, toJSON: () => ({}),
        });

        source.dispatchEvent(new Event("dragstart", { bubbles: true }));
        target.dispatchEvent(new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: 70 }));

        expect(pages().map((page) => page.id)).toEqual([second!.id, third!.id, first!.id]);
      });

      it("거부된 경계 이동은 성공 토스트를 만들지 않는다", () => {
        const host = actions();
        const target = button(host, "event-page-move-back");
        target.disabled = false;
        target.click();
        expect(document.querySelector('[data-testid="toast"]')).toBeNull();
      });
    });
  });
});

describe("panelsEventEditorSuite4", () => {
  isolateTimers();
  describe("eventPreviewState", () => {
    isolateTimers();
    const FACE_A = "easyrpg-faceset-people1-03";
    const FACE_B = "easyrpg-faceset-actor1-00";
    function faceCommand(resourceId: string): Extract<Command, { kind: "changeFace" }> {
      return { kind: "changeFace", resourceId, position: "left", flipHorizontally: false };
    }
    function page(id: string, commands: Command[]): EventPage {
      return {
        id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" },
        priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
      };
    }
    function render(authored: EventPage, advances = 0): HTMLElement {
      const panel = renderEventPagePreview({
        mapId: store.getCurrent().startMapId, eventId: "ev_preview_state", page: authored,
      });
      document.body.append(panel);
      for (let i = 0; i < advances; i += 1) {
        const next = panel.querySelector<HTMLButtonElement>('[data-testid="event-script-live-next"]');
        if (!next) throw new Error("Preview Next control is missing");
        next.click();
      }
      return panel;
    }
    function faceId(panel: HTMLElement): string | null {
      return panel.querySelector('[data-testid="event-command-face-crop-shell"]')?.getAttribute("data-resource-id") ?? null;
    }
    describe("event preview uses the current command state", () => {
      beforeEach(() => {
        const project = createBlankProject();
        project.variables = [{ id: "var_0001", name: "Score" }];
        store.replace(project);
      });
      afterEach(() => {
        clearCommandInspector();
        setCommandInspectorHost(undefined);
        document.body.replaceChildren();
      });

      it("refreshes a remembered dialogue step when its preceding face is edited", () => {
        const first = render(page("edited-face", [
          faceCommand(FACE_A), { kind: "text", body: "대사" },
        ]), 1);
        expect(faceId(first)).toBe(FACE_A);
        first.remove();

        const refreshed = render(page("edited-face", [
          faceCommand(FACE_B), { kind: "text", body: "대사" },
        ]));

        expect(refreshed.querySelector(".event-script-live-position")?.textContent).toBe("2/2");
        expect(faceId(refreshed)).toBe(FACE_B);
      });

      it("honors a face-clear command instead of finding an older portrait", () => {
        const panel = render(page("cleared-face", [
          faceCommand(FACE_A),
          faceCommand(""),
          { kind: "text", body: "얼굴 없는 대사" },
        ]), 2);

        expect(faceId(panel)).toBeNull();
        expect(panel.querySelector(".ecp-message-window")?.classList.contains("with-face")).toBe(false);
      });

      it("carries the authored face side and flip into the dialogue stage", () => {
        const panel = render(page("face-layout", [
          { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
          { kind: "text", body: "오른쪽 얼굴" },
        ]), 1);

        const face = panel.querySelector('[data-testid="event-command-face-crop-shell"]');
        expect(face?.getAttribute("data-position")).toBe("right");
        expect(face?.classList.contains("flipped")).toBe(true);
        expect(panel.querySelector(".ecp-message-window")?.classList.contains("face-right")).toBe(true);
      });

      it("does not borrow a face from a skipped conditional branch", () => {
        const panel = render(page("skipped-face", [
          faceCommand(FACE_A),
          {
            kind: "fork", condition: { kind: "switch", switchId: "sw_preview", value: true },
            then: [faceCommand(FACE_B)], else: [],
          },
          { kind: "text", body: "실행되는 대사" },
        ]), 3);

        expect(faceId(panel)).toBe(FACE_A);
      });

      it.each([4, 5])("keeps choice-local faces out of sibling/outer dialogue at step %i", (step) => {
        const panel = render(page(`choice-face-${step}`, [
          faceCommand(FACE_A),
          {
            kind: "choices", prompt: "선택", options: [
              { text: "첫 분기", branch: [
                faceCommand(FACE_B), { kind: "text", body: "첫 분기 대사" },
              ] },
              { text: "다음 분기", branch: [{ kind: "text", body: "다음 분기 대사" }] },
            ],
          },
          { kind: "text", body: "분기 밖 대사" },
        ]), step);

        expect(faceId(panel)).toBe(FACE_A);
      });

      it("interpolates the variable value at the current simulated step", () => {
        const panel = render(page("variable-dialogue", [
          { kind: "setVariable", variableId: "var_0001", op: "=", value: 37 },
          { kind: "text", body: "점수: \\V[1]" },
        ]), 1);

        expect(panel.querySelector(".ecp-message-body")?.textContent).toBe("점수: 37");
      });

      it("passes authored face side and flip from the list into the text inspector", () => {
        const list = document.createElement("div");
        const inspector = document.createElement("div");
        document.body.append(list, inspector);
        setCommandInspectorHost(inspector);
        renderCommandList(list, [
          { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
          { kind: "text", body: "인스펙터 대사" },
        ], [], {
          addCommand() {}, insertCommand() {}, replaceCommand() {},
          deleteCommand() {}, moveCommand() {}, moveCommandTo() {},
        });
        const row = list.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
        if (!row) throw new Error("Text command row is missing");

        row.click();

        const face = inspector.querySelector('[data-testid="event-command-face-crop-shell"]');
        expect(face?.getAttribute("data-position")).toBe("right");
        expect(face?.classList.contains("flipped")).toBe(true);
      });
    });
  });
  // 스위치가 수십 개로 늘어나면 "쓰는 곳 n곳"만으로는 지금 편집 중인 맵과 관계있는
  // 레코드를 못 고른다. 이 맵에서 이미 쓰는 것들을 위로 올려 준다.
  describe("eventRecordPickerMapScope", () => {
    isolateTimers();
    function panel(): HTMLElement {
      const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
      if (!node) throw new Error("픽커가 열리지 않았다");
      return node;
    }
    /** 화면에 보이는 순서대로 행 이름을 읽는다. */
    const visibleNames = (): string[] =>
      Array.from(panel().querySelectorAll<HTMLElement>(".event-record-picker-row-name")).map(
        (node) => node.textContent ?? "",
      );
    describe("레코드 픽커 — 이 맵에서 쓰는 중", () => {
      beforeEach(() => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.switches[0]!.name = "다른 맵 스위치";
        project.switches[1]!.name = "이 맵 스위치";
        // 이 맵의 이벤트가 두 번째 스위치를 참조하게 만든다.
        project.maps[mapId]!.events = [
          {
            id: "ev_use",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "p1",
                name: "쓰는 이벤트",
                conditions: [{ kind: "switch", switchId: project.switches[1]!.id, value: true }],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                overlapForbidden: true,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      });

      afterEach(() => {
        document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
      });

      it("이 맵에서 쓰는 레코드를 맨 위 구획으로 올린다", () => {
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

        const section = panel().querySelector<HTMLElement>(
          '[data-testid="event-record-picker-section-map"]',
        );
        expect(section, "이 맵 구획이 있어야 한다").not.toBeNull();
        expect(section!.textContent).toContain("이 맵에서 쓰는 중");

        // 이 맵이 참조하는 스위치가 목록 첫 행이어야 한다.
        expect(visibleNames()[0]).toBe("이 맵 스위치");
      });

      it("이 맵이 아무것도 안 쓰면 구획을 만들지 않는다", () => {
        const project = store.getCurrent();
        project.maps[project.startMapId]!.events = [];
        store.replace(project);

        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });
        expect(
          panel().querySelector('[data-testid="event-record-picker-section-map"]'),
        ).toBeNull();
      });

      it("구획을 나눠도 행 testid 는 레코드 번호를 그대로 따른다", () => {
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

        // e2e 3개 스펙이 -row-1 을 첫 번째 *레코드*로 집는다. 표시 순서가 바뀌어도
        // testid 는 레코드 인덱스를 따라야 한다.
        const first = panel().querySelector<HTMLElement>('[data-testid="event-record-picker-row-1"]');
        expect(first).not.toBeNull();
        expect(first!.textContent).toContain("다른 맵 스위치");
      });
    });
  });
  // 레코드 픽커 창의 두 계약을 고정한다.
  //
  // 1) 참조 수 집계는 창이 열려 있는 동안 한 번만 한다. 렌더마다 새로 만들면 검색 키
  //    한 번에 프로젝트 맵 전체가 다시 직렬화된다.
  // 2) 행을 클릭해 재렌더가 일어나도 포커스가 선택된 행에 남는다. 재렌더는 방금 누른
  //    버튼을 파괴하므로, 옮겨 주지 않으면 body 로 떨어져 ↑↓·Enter 와 스크린리더
  //    위치를 함께 잃는다.
  describe("eventRecordPickerPanelBehavior", () => {
    isolateTimers();
    function picker(): HTMLElement {
      const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
      if (!node) throw new Error("픽커가 열리지 않았다");
      return node;
    }
    const rows = (): HTMLElement[] =>
      Array.from(picker().querySelectorAll<HTMLElement>(".event-record-picker-row"));
    describe("레코드 픽커 창 동작", () => {
      beforeEach(() => {
        const project = createBlankProject();
        project.switches[0]!.name = "마을 축제 시작";
        project.switches[1]!.name = "마을 축제 끝남";
        store.replace(project);
      });

      afterEach(() => {
        document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
        vi.restoreAllMocks();
      });

      it("검색을 여러 번 해도 프로젝트를 다시 직렬화하지 않는다", () => {
        const spy = vi.spyOn(JSON, "stringify");
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

        const afterOpen = spy.mock.calls.length;
        expect(afterOpen).toBeGreaterThan(0);

        const search = picker().querySelector<HTMLInputElement>(
          '[data-testid="event-record-picker-search"]',
        )!;
        for (const query of ["축", "축제", "축제 시"]) {
          search.value = query;
          search.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // 검색 세 번이 집계 원본을 다시 만들지 않아야 한다.
        expect(spy.mock.calls.length).toBe(afterOpen);
      });

      it("행을 클릭한 뒤에도 포커스가 선택된 행에 남는다", () => {
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

        const second = rows()[1];
        expect(second).toBeTruthy();
        second!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        const selected = picker().querySelector<HTMLElement>(".event-record-picker-row.selected");
        expect(selected).toBeTruthy();
        expect(document.activeElement).toBe(selected);
        expect(document.activeElement).not.toBe(document.body);
      });

      it("행에 포커스가 있어도 ↑↓ 로 선택을 옮길 수 있다", () => {
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

        const first = rows()[0]!;
        first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const before = picker()
          .querySelector<HTMLElement>(".event-record-picker-row.selected")
          ?.dataset.testid;

        document.activeElement!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );

        const after = picker()
          .querySelector<HTMLElement>(".event-record-picker-row.selected")
          ?.dataset.testid;
        expect(after).toBeTruthy();
        expect(after).not.toBe(before);
      });

      it("빈 검색 문구는 아이템·스위치 받침에 맞는 조사를 쓴다", () => {
        openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
        const search = picker().querySelector<HTMLInputElement>(
          '[data-testid="event-record-picker-search"]',
        )!;
        search.value = "없는물건";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
          .toBe('"없는물건" 과 일치하는 아이템이 없습니다.');

        document.querySelectorAll('[data-testid="event-record-picker"]').forEach((node) => node.remove());
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });
        const switchSearch = picker().querySelector<HTMLInputElement>(
          '[data-testid="event-record-picker-search"]',
        )!;
        switchSearch.value = "가나";
        switchSearch.dispatchEvent(new Event("input", { bubbles: true }));
        expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
          .toBe('"가나" 와 일치하는 스위치가 없습니다.');
      });

      it("아이템이 없으면 빈 목록도 받침 있는 조사를 쓴다", () => {
        const project = createBlankProject();
        project.database.items = [];
        store.replace(project);
        openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
        expect(picker().textContent).toContain("아이템이 아직 없습니다.");
        expect(picker().textContent).not.toContain("아이템가");
      });

      it("Enter 는 선택을 확정하고 창을 닫는다", () => {
        const onSelect = vi.fn();
        openRecordPickerPanel({ kind: "switch", currentId: "", onSelect });

        rows()[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        document.activeElement!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-testid="event-record-picker"]')).toBeNull();
      });
    });
  });
  // 이벤트 편집기 보기 셋(쉬움·보통·고급)과 장면 카드 모델(목업 v2).
  describe("eventSceneCards", () => {
    isolateTimers();
    const comment = (text: string): Command => ({ kind: "m2Command", commandId: SCENE_COMMENT_COMMAND_ID, fields: { comment: text, color: "green" } });
    const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body });
    const narrate = (body: string): Command => ({ kind: "text", body, context: "narration" });
    describe("장면 카드 모델", () => {
      it("대사 줄은 얼굴 바꾸기와 함께 한 대화 카드로 묶고, 상점은 따로 카드다", () => {
        const cards = buildSceneCards([
          { kind: "changeFace", faceId: "f" } as Command,
          say("오든", "회복약이랑 약초는 여기서 사고판다."),
          { kind: "shop", itemIds: ["a"], allowSell: true, title: "오든 약재상" },
        ]);
        expect(cards.map((card) => card.kind)).toEqual(["talk", "shop"]);
        expect(cards[0]!.title).toBe("오든이 말한다");
        expect(cards[0]!.paths).toEqual([[0], [1]]);
        expect(cards[1]!.shop?.title).toBe("오든 약재상");
      });

      it("주석 명령은 카드 경계이자 이름이고, 다음 주석까지 모두 담는다", () => {
        const cards = buildSceneCards([
          comment("막을 연다"),
          { kind: "playAudio", resourceId: "se", loop: false, channel: "se" } as Command,
          narrate("쇠 장화 소리"),
          comment("마주 선다"),
          say("발렌", "넘겨라."),
          say("이리스", "싫어요."),
        ]);
        expect(cards.map((card) => [card.kind, card.title, card.commandCount])).toEqual([
          ["stage", "막을 연다", 3],
          ["talk", "마주 선다", 3],
        ]);
      });

      it("전투 뒤 전투 결과 갈림은 전투 카드 하나와 이기면·지면 갈래다", () => {
        const cards = buildSceneCards([
          { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true } as Command,
          { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [narrate("이겼다")], else: [narrate("졌다")] } as Command,
        ]);
        expect(cards).toHaveLength(1);
        expect(cards[0]!.kind).toBe("battle");
        expect(cards[0]!.branches.map((branch) => branch.label)).toEqual(["이기면", "지면"]);
        expect(cards[0]!.branches[0]!.containerPath).toEqual([1, FORK_THEN_BRANCH_INDEX]);
      });

      it("조건 문장을 물음으로 바꾼다", () => {
        expect(conditionQuestion("「해 손잡이 당김」이 켜져 있으면")).toBe("「해 손잡이 당김」이 켜져 있나?");
        expect(conditionQuestion("전투 승리일 때")).toBe("전투 승리일 때?");
      });
    });
    describe("보기 셋", () => {
      const EVENT_ID = "ev_scene_levels";
      const page: EventPage = {
        id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [say("오든", "어서 오게."), { kind: "shop", itemIds: [], allowSell: true }],
      };

      beforeEach(() => {
        localStorage.clear();
        resetEventViewSession();
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0]!;
        const event: GameEvent = { id: EVENT_ID, name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] };
        project.maps[mapId]!.events.push(event);
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      });
      afterEach(() => {
        localStorage.clear();
        clearCommandInspector();
        document.body.replaceChildren();
      });

      const render = (): HTMLElement => {
        const host = document.createElement("div");
        document.body.append(host);
        renderEventEditorDynamic(host, editorState.get().currentMapId!, EVENT_ID);
        return host;
      };

      it("시험 환경의 기본은 고급(명령 목록)이고, 고른 보기는 기억한다", () => {
        expect(eventEditorViewLevel()).toBe("advanced");
        setEventEditorViewLevel("easy");
        expect(eventEditorViewLevel()).toBe("easy");
        expect(localStorage.getItem("oprn.event-editor.view")).toBe("easy");
      });

      it("쉬움은 명령 목록 대신 장면 카드를 그리고, 줄 수·카드 추가를 숨긴다", () => {
        setEventEditorViewLevel("easy");
        const host = render();
        const cards = host.querySelector<HTMLElement>('[data-testid="event-scene-cards"]');
        expect(cards?.dataset.level).toBe("easy");
        expect(cards?.querySelectorAll(".event-scene-card")).toHaveLength(2);
        expect(host.querySelector('[data-testid="event-scene-card-count"]')).toBeNull();
        expect(host.querySelector('[data-testid="event-scene-add"]')).toBeNull();
        expect(host.querySelector(".cmd-item")).toBeNull();
        expect(host.querySelector('[data-testid="event-editor-advanced-toggle"]')).toBeNull();
      });

      it("쉬움은 모습·시작 방식을 페이지 줄 앞 칩으로 옮기고, 고급은 설정 칸에 그대로 둔다", () => {
        setEventEditorViewLevel("easy");
        const easy = render();
        const strip = easy.querySelector('[data-testid="event-editor-pagebar"] > [data-testid="event-scene-who-when"]');
        expect(strip?.querySelector('[data-testid="event-classic-graphic"]')).not.toBeNull();
        expect(strip?.querySelector('[data-testid="event-classic-trigger"]')).not.toBeNull();
        expect(easy.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).toBeNull();
        expect(easy.querySelector('[data-testid="event-scene-page-label"]')?.textContent).toBe("때");
        document.body.replaceChildren();
        setEventEditorViewLevel("advanced");
        const advanced = render();
        expect(advanced.querySelector('[data-testid="event-scene-who-when"]')).toBeNull();
        expect(advanced.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).not.toBeNull();
      });

      it("보통은 카드에 줄 수와 카드 추가를 더한다", () => {
        setEventEditorViewLevel("normal");
        const host = render();
        expect(host.querySelectorAll('[data-testid="event-scene-card-count"]')).toHaveLength(2);
        expect(host.querySelector('[data-testid="event-scene-add"]')).not.toBeNull();
      });
    });
    describe("막히는 신호의 보기 제안", () => {
      beforeEach(() => {
        localStorage.clear();
        resetViewLevelHintForTest();
        resetEventEditLineForTest();
      });

      it("쉬움에서 두 번 되돌림은 보통을 한 번만 제안하고, 14일 뒤 다시 제안한다", () => {
        setEventEditorViewLevel("easy");
        const now = 1_000_000;
        expect(viewLevelHintFor("undo-twice", now)).toContain("보기 › 보통");
        expect(viewLevelHintFor("undo-twice", now + 1000)).toBeNull();
        expect(viewLevelHintFor("undo-twice", now + VIEW_LEVEL_HINT_QUIET_MS + 1)).toContain("보통");
      });

      it("숨은 명령·줄 복사·Delete 는 고급을 제안하고, 이미 그 보기 이상이면 말하지 않는다", () => {
        setEventEditorViewLevel("normal");
        expect(viewLevelHintFor("undo-twice")).toBeNull();
        expect(viewLevelHintFor("hidden-command")).toContain("보기 › 고급");
        expect(viewLevelHintFor("line-delete")).toBeNull();
        setEventEditorViewLevel("advanced");
        resetViewLevelHintForTest();
        expect(viewLevelHintFor("line-copy")).toBeNull();
      });

      it("보기를 스스로 바꾸지 않고, 열린 편집기의 요약줄 자리에 한 줄로 띄운다", () => {
        setEventEditorViewLevel("easy");
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0]!;
        const page: EventPage = {
          id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [say("오든", "어서 오게.")],
        };
        project.maps[mapId]!.events.push({ id: "ev_hint", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        const host = document.createElement("div");
        document.body.append(host);
        renderEventEditorDynamic(host, mapId, "ev_hint");
        const card = host.querySelector<HTMLElement>(".event-scene-card")!;
        card.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
        const summary = host.querySelector<HTMLElement>('[data-testid="event-edit-line-summary"]')!;
        expect(summary.dataset.kind).toBe("hint");
        expect(summary.textContent).toContain("고급");
        expect(eventEditorViewLevel()).toBe("easy");
        expect(noteViewLevelSignal("line-copy")).toBe(false);
        document.body.replaceChildren();
        clearCommandInspector();
      });
    });
    describe("한 줄 고치기 조수 호출", () => {
      afterEach(() => {
        unregisterAiAssistantBridge();
        resetEventEditLineForTest();
        document.body.replaceChildren();
        clearCommandInspector();
      });

      it("Enter 는 지금 페이지 범위(eventCommandScope)로 보내고, 이어진 이벤트가 없으면 한 번만 부른다", async () => {
        setEventEditorViewLevel("easy");
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0]!;
        const page: EventPage = {
          id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [say("오든", "어서 오게.")],
        };
        project.maps[mapId]!.events.push({ id: "ev_line", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        const calls: { text: string; options?: AiBridgeSendOptions }[] = [];
        registerAiAssistantBridge({
          send: async (text, options) => {
            calls.push({ text, options });
            const before = store.getCurrent();
            const after = structuredClone(before);
            (after.maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0] as { body: string }).body = "어서 와.";
            return { ok: true, pendingProposal: { callCount: 1, summary: "", before, after }, status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
          },
          getStatus: () => ({ ready: true, turnBusy: false }) as never,
          getAudit: () => [],
          getHarness: () => null,
          abort: () => {},
        });
        const host = document.createElement("div");
        document.body.append(host);
        renderEventEditorDynamic(host, mapId, "ev_line");
        const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
        input.value = "반말로";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(store.getCurrent().maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0]).toMatchObject({ body: "어서 와." }));
        expect(calls).toHaveLength(1);
        expect(calls[0]!.text).toBe("반말로");
        expect(calls[0]!.options).toMatchObject({ deferApply: true, eventCommandScope: { mapId, eventId: "ev_line", pageId: "p1", mode: "edit" } });
      });

      it("페이지 범위가 실패로 끝나도 이어진 이벤트가 있으면 전체 길로 한 번 더 보낸다(퍼즐 손잡이)", async () => {
        // 2026-11-25 fast-apply: 「퍼즐 정답을 2번으로」 의 범위 턴이 ok:false 로 끝나 전체 길을 타지 않고 바로 실패했다.
        setEventEditorViewLevel("easy");
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0]!;
        const leverPage = (id: string, body: string): EventPage => ({
          id, name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [narrate(body), { kind: "setSwitch", switchId: "sw_sun", value: true } as Command],
        });
        project.maps[mapId]!.events.push(
          { id: "ev_sun", name: "해 손잡이", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [leverPage("sun_p1", "해 문양")] },
          { id: "ev_moon", name: "달 손잡이", x: 2, y: 1, trigger: { kind: "action" }, commands: [], pages: [leverPage("moon_p1", "달 문양")] },
        );
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "moon_p1" });
        const calls: { text: string; options?: AiBridgeSendOptions }[] = [];
        registerAiAssistantBridge({
          send: async (text, options) => {
            calls.push({ text, options });
            if (options?.eventCommandScope) return { ok: false, error: "명령 4개가 사라져 적용하지 않았습니다", status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
            const before = store.getCurrent();
            const after = structuredClone(before);
            (after.maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages![0]!.commands[0] as { body: string }).body = "달 문양, 먼저";
            return { ok: true, pendingProposal: { callCount: 1, summary: "", before, after }, status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
          },
          getStatus: () => ({ ready: true, turnBusy: false }) as never,
          getAudit: () => [],
          getHarness: () => null,
          abort: () => {},
        });
        const host = document.createElement("div");
        document.body.append(host);
        renderEventEditorDynamic(host, mapId, "ev_moon");
        const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
        input.value = "퍼즐 정답을 2번으로";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(calls).toHaveLength(2));
        expect(calls[0]!.options?.eventCommandScope).toBeDefined();
        expect(calls[1]!.options?.eventCommandScope).toBeUndefined();
        await vi.waitFor(() => expect(store.getCurrent().maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages![0]!.commands[0]).toMatchObject({ body: "달 문양, 먼저" }));
      });
    });
    describe("한 줄 고치기 범위(이어진 이벤트)", () => {
      const lever = (id: string, name: string, switchId: string, body: string): GameEvent => ({
        id, name, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
        pages: [{
          id: `${id}_p1`, name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [narrate(body), { kind: "setSwitch", switchId, value: true } as Command],
        }],
      });
      const puzzle = () => {
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0]!;
        project.maps[mapId]!.events.push(
          lever("ev_sun", "해 손잡이", "sw_sun", "해 문양"),
          lever("ev_moon", "달 손잡이", "sw_sun", "달 문양"),
          lever("ev_far", "석판", "sw_other", "석판 글"),
        );
        return { project, mapId };
      };
      const setBody = (event: GameEvent, body: string) => { (event.pages![0]!.commands[0] as { body: string }).body = body; };

      it("같은 스위치를 쓰는 같은 맵 이벤트를 이어진 것으로 찾는다", () => {
        const { project, mapId } = puzzle();
        expect(linkedMapEvents(project, mapId, "ev_moon").map((event) => event.id)).toEqual(["ev_sun"]);
      });

      it("맵 여러 이벤트가 명령에서 쓰는 이야기 깃발은 연결로 보지 않는다(마을 허브)", () => {
        const { project, mapId } = puzzle();
        for (let index = 0; index < 4; index += 1) project.maps[mapId]!.events.push(lever(`ev_villager_${index}`, "주민", "sw_sun", "안녕"));
        expect(linkedMapEvents(project, mapId, "ev_moon")).toEqual([]);
      });

      it("같은 맵 다른 이벤트의 명령 변경은 받고 연 이벤트를 먼저 둔다", () => {
        const { project: before, mapId } = puzzle();
        const after = structuredClone(before);
        const events = after.maps[mapId]!.events;
        setBody(events.find((event) => event.id === "ev_sun")!, "해 문양, 나중에");
        setBody(events.find((event) => event.id === "ev_moon")!, "달 문양, 먼저");
        const checked = eventCommandChanges(before, after, mapId, "ev_moon");
        expect(checked.ok).toBe(true);
        if (!checked.ok) return;
        expect(checked.changes.map((change) => change.eventId)).toEqual(["ev_moon", "ev_sun"]);
        const moonPages = before.maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages!;
        const line = editStepSummary(checked.changes, moonPages, undefined, "ev_moon", (id) => id === "ev_sun" ? "해 손잡이" : id);
        expect(line).toContain("이벤트 2개");
        expect(line).toContain("해 손잡이");
      });

      it("다른 이벤트의 조건·다른 맵·이벤트 더하기는 통째로 거절한다", () => {
        const { project: before, mapId } = puzzle();
        const cond = structuredClone(before);
        cond.maps[mapId]!.events.find((event) => event.id === "ev_sun")!.pages![0]!.name = "바뀐 이름";
        expect(eventCommandChanges(before, cond, mapId, "ev_moon").ok).toBe(false);
        const added = structuredClone(before);
        added.maps[mapId]!.events.push(lever("ev_new", "새 손잡이", "sw_sun", "새"));
        expect(eventCommandChanges(before, added, mapId, "ev_moon").ok).toBe(false);
        const otherMap = structuredClone(before);
        const otherMapId = Object.keys(otherMap.maps).find((id) => id !== mapId);
        if (otherMapId) {
          otherMap.maps[otherMapId]!.name = "바뀐 맵";
          expect(eventCommandChanges(before, otherMap, mapId, "ev_moon").ok).toBe(false);
        }
      });

      it("연 이벤트만 Ctrl+Z 로 되돌리면 같은 단계의 다른 이벤트도 되돌려 한 단계로 지킨다", () => {
        const { project, mapId } = puzzle();
        const events = project.maps[mapId]!.events;
        const sun = events.find((event) => event.id === "ev_sun")!;
        const moon = events.find((event) => event.id === "ev_moon")!;
        const sunBefore = structuredClone(sun.pages![0]!.commands);
        const moonBefore = structuredClone(moon.pages![0]!.commands);
        setBody(sun, "해 문양, 나중에");
        const sunAfter = structuredClone(sun.pages![0]!.commands);
        const moonAfter = moonBefore.map((command, index) => index === 0 ? narrate("달 문양, 먼저") : command);
        store.replace(project); // 달은 이미 Ctrl+Z 로 되돌아갔고(before), 해는 아직 after 다.
        const state: { steps: EditStep[] } = { steps: [{ summary: "정답 바꿈", changes: [
          { eventId: "ev_moon", pageId: "ev_moon_p1", before: moonBefore, after: moonAfter },
          { eventId: "ev_sun", pageId: "ev_sun_p1", before: sunBefore, after: sunAfter },
        ] }] };
        const undone: string[] = [];
        pruneUndoneSteps(state, mapId, (eventId, pageId) => undone.push(`${eventId}:${pageId}`));
        expect(state.steps).toHaveLength(0);
        expect(undone).toEqual(["ev_sun:ev_sun_p1"]);
      });
    });
  });
});

describe("panelsEventEditorSuite5", () => {
  isolateTimers();
  describe("fieldMonsterTemplate", () => {
    isolateTimers();
    function basePage(overrides: Partial<EventPage> = {}): EventPage {
      return {
        id: "p1",
        name: "빈 이벤트",
        conditions: [],
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" } },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
        ...overrides,
      };
    }
    function baseEvent(overrides: Partial<GameEvent> = {}): GameEvent {
      return {
        id: "ev_field_mob",
        x: 4,
        y: 5,
        trigger: { kind: "action" },
        commands: [],
        pages: [basePage()],
        ...overrides,
      };
    }
    describe("field monster template", () => {
      let host: HTMLElement;

      beforeEach(() => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId]!.events = [baseEvent()];
        if (project.database.troops.length === 0) {
          project.database.troops.push({
            id: "troop_test",
            name: "시험 무리",
            enemyIds: [],
            members: [],
            battleEventPages: [],
          });
        }
        store.replaceProject(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        _resetEventDraftVaultForTest();
        host.remove();
        document.querySelectorAll('[data-testid="field-monster-template-dialog"]').forEach((node) => node.remove());
      });

      it("builds victory-only erase fight commands", () => {
        const commands = buildFieldMonsterFightCommands({
          troopId: "troop_test",
          clearSwitchId: "sw_clear",
          intro: ["싸운다!"],
          victory: ["이겼다!"],
          victoryItems: [{ itemId: "it_potion", amount: 1 }],
        });
        expect(hasFieldMonsterVictoryErasePattern(commands)).toBe(true);
        expect(commands[0]).toMatchObject({ kind: "text", body: "싸운다!" });
        expect(commands[1]).toMatchObject({ kind: "battleProcessing", troopId: "troop_test" });
        expect(commands[2]).toMatchObject({
          kind: "fork",
          condition: { kind: "battleResult", result: "victory" },
        });
        const then = commands[2]!.kind === "fork" ? commands[2].then : [];
        expect(then.some((c) => c.kind === "setSwitch" && c.switchId === "sw_clear")).toBe(true);
        expect(then.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
        expect(then.some((c) => c.kind === "changeItem" && c.itemId === "it_potion")).toBe(true);
      });

      it("shows toolbar button and applies two-page template from dialog", () => {
        const mapId = store.getCurrent().startMapId;
        renderEventEditorDynamic(host, mapId, "ev_field_mob");
        const button = host.querySelector('[data-testid="event-command-toolbar-field-monster"]');
        expect(button).toBeTruthy();
        expect(button?.getAttribute("title")).toContain("필드 몬스터");

        const page = store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
        openFieldMonsterTemplateDialog(mapId, "ev_field_mob", page);
        const dialog = document.querySelector('[data-testid="field-monster-template-dialog"]');
        expect(dialog).toBeTruthy();

        const troopSelect = dialog!.querySelector('[data-testid="field-monster-template-troop"]') as HTMLSelectElement;
        const troopId = store.getCurrent().database.troops[0]!.id;
        troopSelect.value = troopId;
        troopSelect.dispatchEvent(new Event("change"));

        const intro = dialog!.querySelector('[data-testid="field-monster-template-intro"]') as HTMLTextAreaElement;
        const victory = dialog!.querySelector('[data-testid="field-monster-template-victory"]') as HTMLTextAreaElement;
        intro.value = "나타난다!";
        victory.value = "쓰러졌다!";

        (dialog!.querySelector('[data-testid="field-monster-template-apply"]') as HTMLButtonElement).click();

        const event = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === "ev_field_mob")!;
        expect(event.pages).toHaveLength(2);
        expect(event.pages![0]!.name).toBe("전투");
        expect(hasFieldMonsterVictoryErasePattern(event.pages![0]!.commands)).toBe(true);
        expect(event.pages![1]!.conditions).toEqual([
          { kind: "switch", switchId: "sw_ev_field_mob_clear", value: true },
        ]);
        expect(event.pages![1]!.graphic.transparent).toBe(true);
        expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(false);
        saveEventDraft(mapId, "ev_field_mob");
        expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(true);
        expect(document.querySelector('[data-testid="field-monster-template-dialog"]')).toBeNull();
      });
    });
  });
  // 호감도 조건의 UI 게이트 — 런타임이 하드 게이트(resolveSocialKey → null)로 항상 거짓을 내는 조합을
  // 저작 화면이 조용히 만들게 두지 않는다. 근거: docs/specs/2026-07-14-character-id-relationship-gate.md §1-7,8
  describe("friendshipConditionGate", () => {
    isolateTimers();
    const HINT = "event-condition-friendship-requires-character-id";
    function pageWith(conditions: readonly EventPageCondition[]): EventPage {
      return {
        id: "p1",
        name: "호감도 게이트",
        conditions: [...conditions],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "안녕" }],
      };
    }
    function renderRow(page: EventPage, event?: { characterId?: string }): HTMLElement {
      const host = document.createElement("div");
      host.append(...renderPageConditions("map-start", "ev_gate", page, event));
      return host;
    }
    function seedEvent(page: EventPage, characterId?: string): { project: Project; mapId: string; event: GameEvent } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const event: GameEvent = {
        id: "ev_gate",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
        ...(characterId ? { characterId } : {}),
      };
      project.maps[mapId]!.events = [event];
      return { project, mapId, event };
    }
    function issueCodes(page: EventPage, characterId?: string): readonly string[] {
      const { project, mapId, event } = seedEvent(page, characterId);
      return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
    }
    describe("호감도 조건 게이트", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });

      it("NPC 관계가 없으면 조건 행이 항상 거짓임을 말한다", () => {
        const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]));
        expect(host.querySelector(`[data-testid="${HINT}"]`)).not.toBeNull();
        // 행 자체는 사라지지 않는다 — RM 계약상 핵심 조건 행은 항상 자리를 지킨다.
        expect(host.querySelector('[data-testid="event-page-friendship-condition-value"]')).not.toBeNull();
      });

      it("NPC 관계가 연결되면 경고가 사라진다", () => {
        const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), { characterId: "char_a" });
        expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
      });

      it("NPC 키를 직접 적은 경로는 미연결에서도 유효하다", () => {
        const host = renderRow(pageWith([{ kind: "friendshipAtLeast", npcKey: "village_herbalist", value: 80 }]));
        expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
      });

      it("검증기가 미연결 호감도 조건을 경고로 잡는다", () => {
        expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }])))
          .toContain("condition.friendship.no-character-id");
      });

      it("검증기는 연결됐거나 NPC 키가 있으면 경고하지 않는다", () => {
        expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), "char_a"))
          .not.toContain("condition.friendship.no-character-id");
        expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", npcKey: "char_b", value: 80 }])))
          .not.toContain("condition.friendship.no-character-id");
      });

      it("중첩·명령 안 조건도 같은 게이트를 받는다", () => {
        const nested = pageWith([{ kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 10 }] }]);
        expect(issueCodes(nested)).toContain("condition.friendship.no-character-id");

        const forked = pageWith([]);
        const page: EventPage = {
          ...forked,
          commands: [{
            kind: "fork",
            condition: { kind: "friendshipAtLeast", value: 10 },
            then: [],
            else: [],
          }],
        };
        expect(issueCodes(page)).toContain("condition.friendship.no-character-id");
      });
    });
    describe("검증 이슈 앵커와 설정 레일 그룹", () => {
      it("닫힌 그룹 안의 앵커를 가리키면 그 그룹이 열린다", () => {
        const rail = document.createElement("div");
        rail.className = "event-editor-settings-accordion";
        rail.dataset.railKey = "rail-test";
        const groups = ["look-talk", "when"].map((slug, index) => {
          const group = document.createElement("div");
          group.className = `event-editor-settings-accordion-group${index === 0 ? " is-open" : ""}`;
          group.dataset.railGroup = slug;
          const header = document.createElement("button");
          header.className = "event-editor-settings-accordion-header";
          header.setAttribute("aria-expanded", index === 0 ? "true" : "false");
          group.append(header);
          rail.append(group);
          return group;
        });
        const anchor = document.createElement("input");
        groups[1]!.append(anchor);
        document.body.append(rail);

        openEventRailGroupFor(anchor);

        expect(groups[1]!.classList.contains("is-open")).toBe(true);
        expect(groups[0]!.classList.contains("is-open")).toBe(false);
        expect(groups[1]!.querySelector(".event-editor-settings-accordion-header")?.getAttribute("aria-expanded")).toBe("true");
        rail.remove();
      });
    });
  });
  describe("lifeEconomyUiParity", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function economyProject(): Project {
      const project = createBlankProject();
      project.database.items.push(
        ...["economy_A", "economy_B", "economy_C"].map((id) =>
          normalizeItemRecord({ id, name: id, scope: "none", price: 100 }),
        ),
      );
      project.variables.push({ id: "economy_result", name: "Result" }, { id: "economy_next", name: "Next" });
      project.session.variables = { economy_result: -1, economy_next: 0 };
      project.session.inventory = { economy_A: 1 };
      project.session.gold = 100;
      project.system.craftRecipes = [
        { id: "recipe", name: "Economy Craft", ingredients: [{ itemId: "economy_A", count: 1 }], outputItemId: "economy_B", goldCost: 10 },
      ];
      project.system.itemUpgrades = [
        { id: "upgrade", fromItemId: "economy_A", toItemId: "economy_B", goldCost: 10 },
      ];
      project.system.sellPrices = [{ itemId: "economy_A", price: 90 }];
      project.system.shipping = { enabled: true };
      return project;
    }
    function scene(session: ReturnType<typeof startSession>): PlaySceneContext {
      return { session, syncRuntimeState: () => undefined } as unknown as PlaySceneContext;
    }
    function command(kind: "craftRecipe" | "applyItemUpgrade", result = true): Command {
      const target = kind === "craftRecipe" ? { kind, recipeId: "recipe" } : { kind, upgradeId: "upgrade" };
      return { ...target, ...(result ? { resultVariableId: "economy_result" } : {}) };
    }
    function mountLife(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      const rerender = () => {
        host.replaceChildren();
        renderLifeCraftingTab(host, rerender);
      };
      rerender();
      return host;
    }
    function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, id: string): T {
      const node = host.querySelector<T>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    }
    function openShipping(host: HTMLElement): void {
      control(host, "db-life-section-shipping").click();
      if (!host.querySelector('[data-testid="db-life-shipping-items-card"]')) {
        control(host, "db-life-package-create").click();
      }
    }
    beforeEach(() => {
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      store.replaceProject(economyProject());
      resetMapEditHistory();
      _resetEditActivityForTest();
      document.body.replaceChildren();
    });
    afterEach(() => {
      _resetEditActivityForTest();
      document.body.replaceChildren();
      store.replaceProject(previous);
    });
    describe("Task15 UI shop sell price consumers", () => {
      it.each([
        { table: 90 as number | undefined, expected: 90 },
        { table: 100, expected: 99 },
        { table: 0, expected: 0 },
        { table: undefined, expected: 50 },
      ])("rows/totals/default offers/haggle/settle use helper $table -> $expected", ({ table, expected }) => {
        const project = store.getCurrent();
        project.system.sellPrices = table === undefined ? [] : [{ itemId: "economy_A", price: table }];
        store.replaceProject(project);
        const item = project.database.items.find((entry) => entry.id === "economy_A")!;
        const goods = itemToGoods(item);
        expect(resolveShopSellUnitPrice(project, item.id, item.price)).toBe(expected);
        expect(sellPrice(item)).toBe(expected);
        expect(listingPrice(goods, "sell")).toBe(expected);

        const overlay = createShopOverlay();
        overlay.append(
          renderShopItems({
            scene: scene(startSession(project, 15)),
            step: { allowSell: true, quantityMode: "select" } as ShopStep,
            items: [item],
            mode: "sell",
            prompt: "sell",
            terms: resolveTerms(project),
            merchantGold: 500,
            setStatus: () => undefined,
            showMenu: () => undefined,
            onItem: () => undefined,
          }),
        );
        const row = overlay.querySelector<HTMLElement>("[data-testid='shop-sell-economy_A']");
        expect(row?.dataset.unitPrice).toBe(String(expected));
        expect(overlay.querySelector("[data-testid='shop-price-economy_A']")?.textContent).toBe(`${expected}G`);
        row?.classList.add("selected");
        updateShopQuantityTotal(overlay);
        expect(overlay.querySelector("[data-testid='shop-quantity-total']")?.textContent).toBe(`합계 ${expected}G`);

        const reference = sellPrice(item);
        expect(reference).toBe(expected);
        // Haggle reference is the helper unit. Offering the list price is accepted when >0;
        // explicit 0 is a valid trade unit but an insulting haggle bid.
        if (expected > 0) {
          const reserve = resolveHaggleReserve({
            role: "playerSells",
            reference,
            buyPrice: item.price,
            maxDiscount: 0.25,
            itemId: item.id,
            merchantKey: "merchant",
            dayKey: "1:spring:1",
            attemptIndex: 0,
          });
          const verdict = proposeHaggle(
            { role: "playerSells", reference, reserve, buyPrice: item.price, patience: 3, insultRatio: 0.6 },
            expected,
          );
          expect(verdict).toEqual({ kind: "accept", price: expected });
        }

        const session = startSession(project, 15);
        const result = handleShopTransaction(scene(session), item, "sell", 1, 500, expected === 0 ? 0 : undefined);
        expect(result).toMatchObject({ ok: true, merchantGold: 500 - expected });
        expect(session.gold).toBe(100 + expected);
        // Pawn/settle bookkeeping unit must match helper when no agreed price is supplied.
        const unit = sellPrice(item);
        expect(unit).toBe(expected);
      });

      it("keeps shipping unclamped at table100 while shop clamps to 99", () => {
        const project = store.getCurrent();
        project.system.sellPrices = [{ itemId: "economy_A", price: 100 }];
        store.replaceProject(project);
        expect(sellPrice(project.database.items.find((item) => item.id === "economy_A")!)).toBe(99);
        const session = startSession(project, 15);
        expect(depositShipping(project, session, "economy_A", 1).ok).toBe(true);
        expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: true, total: 100, credited: 100 });
      });
    });
    describe("Task15 UI shipping checkbox materialization", () => {
      it("undefined/all materializes every current item id then disable A leaves B/C", () => {
        const host = mountLife();
        openShipping(host);
        expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
        const all = control(host, "db-life-shipping-all-items");
        expect(all.checked).toBe(true);
        const itemA = control(host, "db-life-shipping-item-economy_A");
        expect(itemA.checked).toBe(true);
        itemA.checked = false;
        itemA.dispatchEvent(new Event("change", { bubbles: true }));
        const allowed = store.getCurrent().system.shipping?.allowedItemIds;
        expect(allowed).toBeDefined();
        expect(allowed).not.toEqual([]);
        expect(allowed?.includes("economy_A")).toBe(false);
        expect(allowed?.includes("economy_B")).toBe(true);
        expect(allowed?.includes("economy_C")).toBe(true);
        // default catalog items remain present when all was materialized
        expect((allowed ?? []).length).toBe(store.getCurrent().database.items.length - 1);
      });

      it("explicit empty list stays none and persists through roundtrip", () => {
        const host = mountLife();
        openShipping(host);
        const all = control(host, "db-life-shipping-all-items");
        all.checked = false;
        all.dispatchEvent(new Event("change", { bubbles: true }));
        expect(store.getCurrent().system.shipping?.allowedItemIds).toEqual([]);
        const restored = deserialize(serialize(store.getCurrent()));
        expect(restored.system.shipping?.allowedItemIds).toEqual([]);
      });
    });
    describe.each(["craftRecipe", "applyItemUpgrade"] as const)("Task15 UI %s result variable forms", (kind) => {
      let staged: Command;
      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, next) => {
          staged = next;
        },
      };

      function body(cmd: Command): HTMLElement {
        staged = cmd;
        const host = document.createElement("div");
        document.body.append(host);
        host.append(renderCommandBody({ path: [0], actions, lockKind: true }, cmd));
        return host;
      }

      function resultRootTestId(): string {
        return kind === "craftRecipe" ? "craft-recipe-result-variable" : "apply-item-upgrade-result-variable";
      }

      function clearTestId(): string {
        return kind === "craftRecipe"
          ? "craft-recipe-result-variable-clear"
          : "apply-item-upgrade-result-variable-clear";
      }

      function resultSelect(host: HTMLElement): HTMLSelectElement {
        const root = host.querySelector<HTMLElement>(`[data-testid="${resultRootTestId()}"]`);
        const select = root?.querySelector("select") ?? null;
        if (!select) throw new Error(`missing result variable select for ${kind}`);
        return select;
      }

      function clearButton(host: HTMLElement): HTMLButtonElement {
        const button = host.querySelector<HTMLButtonElement>(`[data-testid="${clearTestId()}"]`);
        if (!button) throw new Error(`missing visible clear control ${clearTestId()}`);
        return button;
      }

      it("authors optional resultVariableId; visible clear omits the property", () => {
        const host = body(command(kind, false));
        const select = resultSelect(host);
        expect(select.value).toBe("");
        // Set via the real select change path (picker writes the same onChange).
        select.value = "economy_result";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(staged).toEqual(command(kind, true));
        expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(true);

        // Clear must be a visible form control — not hidden-select writes.
        const clear = clearButton(host);
        expect(clear.hidden).toBe(false);
        expect(clear.getAttribute("aria-hidden")).not.toBe("true");
        clear.click();
        expect(staged).toEqual(command(kind, false));
        expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(false);
        expect((staged as { resultVariableId?: string }).resultVariableId).toBeUndefined();
        expect(resultSelect(host).value).toBe("");
      });

      it("preserves a declared resultVariableId exactly without display trim", () => {
        // Schema-valid IDs are stored as selected; form must not rewrite them via trim helpers.
        const exactId = "economy_result";
        const withId =
          kind === "craftRecipe"
            ? ({ kind, recipeId: "recipe", resultVariableId: exactId } as Command)
            : ({ kind, upgradeId: "upgrade", resultVariableId: exactId } as Command);
        const host = body(withId);
        expect(resultSelect(host).value).toBe(exactId);
        expect(staged).toEqual(withId);
        if (staged.kind === kind) {
          expect((staged as { resultVariableId?: string }).resultVariableId).toBe(exactId);
        }
        const summary = commandSummary(withId);
        expect(summary).toContain("Result");
        // Summary must still resolve the exact stored id.
        expect(summary.includes(exactId) || summary.includes("Result")).toBe(true);
      });

      it("keeps a declared selection in the form and shows it in summary/preview", () => {
        const host = body(command(kind, true));
        expect(resultSelect(host).value).toBe("economy_result");
        expect(clearButton(host)).toBeTruthy();
        const summary = commandSummary(command(kind, true));
        expect(summary).toContain("Result");
        expect(commandSummary(command(kind, false))).not.toContain("Result");

        const preview = renderCommandPreview(command(kind, true));
        expect(preview.textContent).toContain("Result");
        const clearedPreview = renderCommandPreview(command(kind, false));
        expect(clearedPreview.textContent ?? "").not.toContain("Result");
      });

      it.each(["success", "material"] as const)(
        "form-authored command keeps core outcome parity for %s",
        (outcome) => {
          const project = store.getCurrent();
          if (outcome === "material") project.session.inventory = {};
          store.replaceProject(project);
          const authored = command(kind, true);
          // Simulate form commit path: only declared fields.
          const formCommand: Command =
            kind === "craftRecipe"
              ? {
                  kind,
                  recipeId: "recipe",
                  ...(authored.kind === kind && authored.resultVariableId
                    ? { resultVariableId: authored.resultVariableId }
                    : {}),
                }
              : {
                  kind,
                  upgradeId: "upgrade",
                  ...(authored.kind === kind && authored.resultVariableId
                    ? { resultVariableId: authored.resultVariableId }
                    : {}),
                };
          expect(formCommand).toEqual(command(kind, true));

          const session = startSession(project, 15);
          const before = structuredClone(session);
          const commands: Command[] = [
            formCommand,
            {
              kind: "fork",
              condition: { kind: "variable", variableId: "economy_result", op: "==", value: 1 },
              then: [{ kind: "changeItem", itemId: "economy_C", op: "+=", amount: 1 }],
            },
            { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 },
          ];
          expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
          const expected = outcome === "success" ? 1 : 0;
          expect(session.variables.economy_result).toBe(expected);
          expect(session.variables.economy_next).toBe(7);
          if (expected === 1) {
            expect(session.inventory).toEqual({ economy_B: 1, economy_C: 1 });
            expect(session.gold).toBe(90);
          } else {
            expect(session.inventory).toEqual(before.inventory);
            expect(session.gold).toBe(before.gold);
            expect(session).toEqual({
              ...before,
              variables: { ...before.variables, economy_result: 0, economy_next: 7 },
            });
          }
          const transaction =
            kind === "craftRecipe"
              ? craftRecipe(project, startSession(project, 15), "recipe")
              : applyItemUpgrade(project, startSession(project, 15), "upgrade");
          expect(transaction.ok).toBe(expected === 1);
          if (!transaction.ok) {
            expect(transaction.reason === "missing-ingredients" || transaction.reason === "missing-item").toBe(true);
          }
          const preview = simulatePageCommands(commands);
          expect(preview.finalState.variables.economy_result).toBe(expected);
          expect(preview.finalState.variables.economy_next).toBe(7);
          expect(preview.finalState.inventory).toEqual(session.inventory);
          expect(preview.finalState.gold).toBe(session.gold);
          expect(preview.steps.find((step) => step.command.kind === "fork")?.forkTaken).toBe(expected ? "then" : "else");
        },
      );

      it("failure paths never flip UI success or mutate inventory beyond result writes", () => {
        const project = store.getCurrent();
        project.session.inventory = {};
        store.replaceProject(project);
        const session = startSession(project, 15);
        const before = structuredClone(session);
        expect(createInterpreter([command(kind, true), { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 }], session, project).start()).toEqual({
          kind: "done",
        });
        expect(session.inventory).toEqual(before.inventory);
        expect(session.gold).toBe(before.gold);
        expect(session.variables.economy_result).toBe(0);
        expect(session.variables.economy_next).toBe(7);
      });
    });
    describe("Task15 UI shop failure surfaces", () => {
      it.each(["merchant-gold", "wallet-cap", "quantity-cap"] as const)(
        "rejects %s with no inventory/gold mutation and no false UI success unit",
        (failure) => {
          const project = store.getCurrent();
          if (failure === "wallet-cap") project.session.gold = GOLD_MAX;
          if (failure === "quantity-cap") project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
          store.replaceProject(project);
          const session = startSession(project, 15);
          const before = structuredClone(session);
          const item = project.database.items.find((entry) => entry.id === "economy_A")!;
          const result = handleShopTransaction(
            scene(session),
            item,
            failure === "quantity-cap" ? "buy" : "sell",
            1,
            failure === "merchant-gold" ? 89 : 500,
          );
          expect(result.ok).toBe(false);
          expect(session).toEqual(before);
          expect("merchantGold" in result).toBe(false);
          // UI unit price still comes from helper, but failed deal must not apply it.
          expect(sellPrice(item)).toBe(90);
        },
      );
    });
  });
  describe("locationDraw", () => {
    isolateTimers();
    // test/locationDrawCta.test.ts
    //
    // 「이 맵에는 아직 구역이 없습니다」 빈 상태의 **행동** 계약.
    //
    // 왜 회귀가 필요한가(어포던스 감사 2026-09-11 실측): 쓰는 지점(조건 폼·트리거·인카운터)이
    // 문장 하나로 끝나 막다른 길이었고, 인카운터는 0개 맵에서 필드를 통째로 숨겨 기능의 존재 자체를
    // 배울 수 없었다. 이 파일은 «없으면 행동을 낸다» 와 «있으면 소음이 되지 않는다» 를 고정한다.
    describe("locationDrawCta", () => {
      isolateTimers();
      const MAP_ID = "cta_map";
      function seedMap(): GameMap {
        const project = createBlankProject();
        const map: GameMap = {
          id: MAP_ID,
          name: "빈 상태 맵",
          width: 20,
          height: 20,
          tilesetId: "easyrpg_chipset_combined_town",
          tileSize: 16,
          lowerTiles: new Array(400).fill(TILE.GRASS),
          upperTiles: new Array(400).fill(TILE.EMPTY),
          events: [],
        };
        project.maps[MAP_ID] = map;
        project.startMapId = MAP_ID;
        store.replace(project);
        editorState.set({ currentMapId: MAP_ID });
        return map;
      }
      function testId(id: string): HTMLElement | null {
        return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      }
      beforeEach(() => {
        setLocationLayerEnabled(false);
        document.body.innerHTML = "";
        seedMap();
      });
      describe("location draw CTA — 빈 상태의 행동", () => {
        it("구역이 없으면 버튼을 내고, 누르면 로케이션 레이어가 켜진다", () => {
          const cta = renderLocationDrawCta({ testId: "cta-probe" });
          expect(cta).not.toBeNull();
          expect(cta?.textContent).toBe(LOCATION_DRAW_CTA_LABEL);

          document.body.append(cta!);
          cta!.click();

          expect(locationLayerState().enabled).toBe(true);
          // 켠 결과가 지금 자리에 보이지 않을 수 있으므로(소비 표면은 모달) 토스트가 그 자리를 잇는다.
          expect(testId("toast")?.textContent).toContain("로케이션 레이어를 켰습니다");
        });

        it("구역이 하나라도 있으면 버튼을 내지 않는다", () => {
          const result = addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "정문 광장", x: 1, y: 1, w: 3, h: 3 });
          expect(result.ok).toBe(true);
          expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
        });

        it("맵을 못 고른 상태(맵 없음)에서는 버튼을 내지 않는다", () => {
          const project = store.getCurrent();
          delete project.maps[MAP_ID];
          editorState.set({ currentMapId: "없는_맵" });
          expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
        });

        it("조건 폼은 구역이 없을 때만 그리기 버튼을 붙인다", () => {
          const open = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
          expect(open.querySelector("[data-testid='event-condition-inside-location-draw']")).not.toBeNull();

          addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "부두", x: 12, y: 12, w: 4, h: 4 });
          const filled = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
          expect(filled.querySelector("[data-testid='event-condition-inside-location-draw']")).toBeNull();
        });

        it("startDrawingLocations 는 이미 켜져 있어도 상태를 켜진 채로 유지한다", () => {
          setLocationLayerEnabled(true);
          startDrawingLocations();
          expect(locationLayerState().enabled).toBe(true);
        });
      });
    });
    describe("locationDrawGuard", () => {
      isolateTimers();
      let dispose: (() => void) | null = null;
      describe("location draw mode guard", () => {
        afterEach(() => {
          dispose?.();
          dispose = null;
          setLocationLayerEnabled(false);
          editorState.set({ tool: "paint", layer: "lower" });
          delete document.body.dataset.locationDraw;
        });

        it("끄는 순간의 도구와 다른 도구로 넘어가면 그리기를 끝낸다", () => {
          editorState.set({ tool: "paint" });
          setLocationLayerEnabled(true);
          dispose = installLocationDrawModeGuard();
          expect(locationLayerState().enabled).toBe(true);

          // 같은 도구를 다시 고르는 것(팔레트 칸 클릭)도 도구 전이의 한 형태다.
          editorState.set({ tool: "fill" });
          expect(locationLayerState().enabled).toBe(false);
        });

        it("팬은 그리기를 빼앗지 않는다", () => {
          editorState.set({ tool: "paint" });
          setLocationLayerEnabled(true);
          dispose = installLocationDrawModeGuard();

          editorState.set({ tool: "pan" });
          expect(locationLayerState().enabled).toBe(true);
          editorState.set({ tool: "pan" });
          expect(locationLayerState().enabled).toBe(true);
        });

        it("바닥↔덧그림 전환은 그리기를 유지한다", () => {
          editorState.set({ tool: "paint", layer: "lower" });
          setLocationLayerEnabled(true);
          dispose = installLocationDrawModeGuard();

          editorState.set({ layer: "upper" });
          expect(locationLayerState().enabled).toBe(true);
          editorState.set({ layer: "lower" });
          expect(locationLayerState().enabled).toBe(true);
        });

        it("타일 팔레트에서 칸을 고르면 그리기가 끝난다", async () => {
          editorState.set({ tool: "paint", layer: "lower" });
          setLocationLayerEnabled(true);
          const { selectPaletteTile } = await import("@/editor/panels/tilePalette");
          selectPaletteTile(42);
          expect(locationLayerState().enabled).toBe(false);
          expect(editorState.get().selectedTile).toBe(42);
        });

        it("설치 시점에 이미 켜져 있으면 첫 전이에 곧바로 꺼지지 않는다", () => {
          editorState.set({ tool: "select" });
          setLocationLayerEnabled(true);
          dispose = installLocationDrawModeGuard();
          // 상태 변화 없음 — 여전히 켜져 있다.
          expect(locationLayerState().enabled).toBe(true);
          editorState.set({ tool: "event", layer: "event" });
          expect(locationLayerState().enabled).toBe(false);
        });
      });
    });
    describe("locationDrawMode", () => {
      isolateTimers();
      describe("location draw mode", () => {
        afterEach(() => {
          setLocationLayerEnabled(false);
          editorState.set({ tool: "paint", layer: "lower" });
          delete document.body.dataset.locationDraw;
        });

        it("isLocationDrawClick is only true on the same tile", () => {
          expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
          expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 4, y: 4 })).toBe(false);
        });

        it("keeps pan and dismisses paint/event tools", () => {
          setLocationLayerEnabled(true);
          expect(isLocationDrawMode()).toBe(true);
          dismissLocationDrawModeForTool("pan");
          expect(locationLayerState().enabled).toBe(true);
          dismissLocationDrawModeForTool("paint");
          expect(locationLayerState().enabled).toBe(false);
        });

        it("event layer dismisses draw mode", () => {
          setLocationLayerEnabled(true);
          dismissLocationDrawModeForLayer("lower");
          expect(locationLayerState().enabled).toBe(true);
          dismissLocationDrawModeForLayer("event");
          expect(locationLayerState().enabled).toBe(false);
        });

        it("selecting a tile tool turns the location layer off even if paint was already selected", () => {
          editorState.set({ tool: "paint", layer: "lower" });
          setLocationLayerEnabled(true);
          expect(document.body.dataset.locationDraw).toBe("1");
          selectTileTool("pen");
          expect(locationLayerState().enabled).toBe(false);
          expect(document.body.dataset.locationDraw).toBeUndefined();
        });

        it("selecting the event tool turns the location layer off", () => {
          setLocationLayerEnabled(true);
          selectMapModeTool("event");
          expect(locationLayerState().enabled).toBe(false);
          expect(editorState.get().tool).toBe("event");
        });
      });
    });
  });
});
