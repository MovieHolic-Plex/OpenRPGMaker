// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { branchesOf, simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { commandLabel, openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { updateEventPage } from "@/editor/eventPages";
import { deleteEditorEvent } from "@/editor/eventDeletion";
import { showConfirm } from "@/editor/ui/modal";
import { attachColumnResize } from "@/editor/panels/eventEditor/layoutResize";
import { attachWindowFullscreen } from "@/editor/panels/eventEditor/modalFullscreen";
import { attachWindowResize } from "@/editor/panels/eventEditor/modalResize";
import { isolateTimers } from "./mergedTeardown";

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

describe("eventEditorWindowControls", () => {
  isolateTimers();
  let mapId: string;
  const destinationMapId = "window-map-b";
  function node(id: string): HTMLElement {
    const result = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!result) throw new Error(`Missing ${id}`);
    return result;
  }
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    project.maps[mapId].events = [{ id: "window-event", x: 1, y: 1,
      trigger: { kind: "action" }, commands: [], pages: [{
        id: "window-page", name: "Window event", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }] }];
    project.maps[mapId].events.push({ ...structuredClone(project.maps[mapId].events[0]), id: "other-event" });
    const secondMap = structuredClone(project.maps[mapId]);
    const pages = project.maps[mapId].events[0].pages;
    const destinationPage = secondMap.events[0].pages?.[0];
    if (!pages || !destinationPage) throw new Error("Expected two-map fixture pages");
    secondMap.id = destinationMapId;
    secondMap.events = [{ ...structuredClone(secondMap.events[0]), id: "destination-event",
      pages: [{ ...structuredClone(destinationPage), id: "destination-page" }] }];
    project.maps[destinationMapId] = secondMap;
    pages.push({ ...structuredClone(pages[0]), id: "window-page-2", name: "Second page" });
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page" });
    openEventEditorModal(mapId, "window-event");
  });
  afterEach(() => {
    document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
    document.body.replaceChildren();
    resetModalStackForTest();
    vi.restoreAllMocks();
  });
  function draft() { return store.getCurrent().maps[mapId].events.find(event => event.id === "window-event"); }
  function key(target: EventTarget, key: string, altKey = false): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, altKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }
  function changedUntil(check: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!check()) return;
        observer.disconnect();
        clearTimeout(deadline);
        resolve();
      });
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Expected DOM transition")); }, 5000);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }
  describe("event editor window controls", () => {
    for (const target of ["existing", "new"] as const) {
      for (const dirty of [false, true]) {
        it(`keeps the destination map when opening a ${target} event after ${dirty ? "approved dirty" : "unchanged"} cross-map switching`, async () => {
          if (dirty) updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
          const previous = node("event-editor-modal");
          node("event-editor-window-minimize").click();
          expect(selectEditorMap(destinationMapId)).toBe(true);
          expect(editorState.get().currentMapId).toBe(destinationMapId);
          if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
          else openNewEventEditorModal(destinationMapId, 3, 4);
          if (dirty) {
            const switched = changedUntil(() => node("event-editor-modal") !== previous);
            node("app-modal-confirm").click();
            await switched;
          }
          const modal = node("event-editor-modal");
          expect(modal).not.toBe(previous);
          expect(modal.dataset.mapId).toBe(destinationMapId);
          expect(editorState.get().currentMapId).toBe(destinationMapId);
          const opened = store.getCurrent().maps[destinationMapId].events.find(event => event.id === modal.dataset.eventId);
          expect(opened?.draft?.kind).toBe(target === "existing" ? "edit" : "new");
          expect(editorState.get().selectedEventId).toBe(opened?.id);
          expect(editorState.get().selectedEventPageId).toBe(opened?.pages?.[0].id);
          if (target === "existing") expect(opened?.id).toBe("destination-event");
          else expect(opened).toMatchObject({ x: 3, y: 4 });
          expect(draft()?.draft).toBeUndefined();
          expect(draft()?.pages?.[0].name).toBe("Window event");
          expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
          expect(modalStackDepthForTest()).toBe(1);
        });
      }

      it(`retains the original map and page when cancelling a dirty cross-map switch to a ${target} event`, async () => {
        editorState.set({ selectedEventPageId: "window-page-2" });
        updateEventPage(mapId, "window-event", "window-page-2", { name: "Dirty second page" });
        const original = structuredClone(draft());
        const destination = structuredClone(store.getCurrent().maps[destinationMapId]);
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        selectEditorMap(destinationMapId);
        if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
        else expect(openNewEventEditorModal(destinationMapId, 3, 4)).toBe("");
        expect(modal.hidden).toBe(false);
        expect(modalStackDepthForTest()).toBe(2);
        const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
        node("app-modal-cancel").click();
        await cancelled;
        expect(node("event-editor-modal")).toBe(modal);
        expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
        expect(draft()).toEqual(original);
        expect(store.getCurrent().maps[destinationMapId]).toEqual(destination);
        expect(modalStackDepthForTest()).toBe(1);
      });
    }

    for (const restore of ["chip", "same-event"] as const) {
      it(`restores the original map and nondefault page via ${restore} after selecting another map`, () => {
        editorState.set({ selectedEventPageId: "window-page-2" });
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        selectEditorMap(destinationMapId);
        if (restore === "chip") node("event-editor-window-restore").click();
        else openEventEditorModal(mapId, "window-event");
        expect(node("event-editor-modal")).toBe(modal);
        expect(modal.hidden).toBe(false);
        expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
      });
    }

    it("minimizes without discarding pending input and restores the same editor", () => {
      const modal = node("event-editor-modal");
      const input = node("event-editor-name");
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected input");
      input.focus();
      input.value = "Pending draft";
      input.setSelectionRange(3, 7);
      node("event-editor-window-minimize").click();
      expect(modal.hidden).toBe(true);
      expect(modalStackDepthForTest()).toBe(0);
      expect(document.body.classList.contains("event-editor-modal-open")).toBe(false);
      const restore = node("event-editor-window-restore");
      expect(document.activeElement).toBe(restore);
      expect(historyHotkeyOwnedByPanel()).toBe(false);
      expect(shouldIgnoreEditorShortcut(key(restore, "ArrowRight"))).toBe(false);
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      restore.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(false);
      restore.click();
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(node("event-editor-name")).toBe(input);
      expect(input.value).toBe("Pending draft");
      expect(input.selectionStart).toBe(3);
      expect(input.selectionEnd).toBe(7);
      expect(document.activeElement).toBe(input);
      expect(modalStackDepthForTest()).toBe(1);
    });
    it("keeps full-view state and saved normal geometry across minimize and map reopen", () => {
      const modal = node("event-editor-modal");
      const windowEl = modal.querySelector<HTMLElement>(".event-editor-modal-window");
      if (!windowEl) throw new Error("Expected window");
      Object.assign(windowEl.style, { width: "900px", height: "650px", transform: "translate(12px, 8px)" });
      node("event-editor-window-fullscreen").click();
      expect(node("event-editor-window-fullscreen").style.display).not.toBe("none");
      node("event-editor-window-minimize").click();
      editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
      openEventEditorModal(mapId, "window-event");
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      expect(editorState.get().selectedEventPageId).toBe("window-page");
      key(document, "Escape");
      expect(windowEl.style.width).toBe("900px");
      expect(windowEl.style.height).toBe("650px");
      expect(windowEl.style.transform).toBe("translate(12px, 8px)");
      expect(modalStackDepthForTest()).toBe(1);
      key(document, "Escape");
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });

    it("does not rebuild pending dynamic fields on background map and selection changes", () => {
      const field = node("event-command-search");
      if (!(field instanceof HTMLInputElement)) throw new Error("Expected search input");
      field.focus();
      field.value = "pending search";
      node("event-editor-window-minimize").click();
      store.updateMap(mapId, map => { map.name = "Background edit"; });
      editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
      node("event-editor-window-restore").click();
      expect(node("event-command-search")).toBe(field);
      expect(field.value).toBe("pending search");
      expect(document.activeElement).toBe(field);
    });

    it("restores a minimized new draft without resetting or discarding it", () => {
      node("event-editor-cancel").click();
      const eventId = openNewEventEditorModal(mapId, 2, 2);
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      openEventEditorModal(mapId, eventId);
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
    });

    it("guards switching dirty minimized drafts, then discards only on approval", async () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      openEventEditorModal(mapId, "other-event");
      expect(modal.hidden).toBe(false);
      expect(modalStackDepthForTest()).toBe(2);
      const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
      node("app-modal-cancel").click();
      await cancelled;
      expect(draft()?.pages?.[0].name).toBe("Dirty");
      expect(modalStackDepthForTest()).toBe(1);
      openEventEditorModal(mapId, "other-event");
      const switched = changedUntil(() => document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.dataset.eventId === "other-event");
      node("app-modal-confirm").click();
      await switched;
      expect(draft()?.draft).toBeUndefined();
      expect(draft()?.pages?.[0].name).toBe("Window event");
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("keeps Apply and save semantics after restore", () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Applied" });
      node("event-editor-window-minimize").click();
      node("event-editor-window-restore").click();
      node("event-editor-apply").click();
      expect(draft()?.pages?.[0].name).toBe("Applied");
      expect(draft()?.draft?.kind).toBe("edit");
      updateEventPage(mapId, "window-event", "window-page", { name: "Saved" });
      node("event-editor-save").click();
      expect(draft()?.pages?.[0].name).toBe("Saved");
      expect(draft()?.draft).toBeUndefined();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("closes a dormant draft on deletion rather than resurrecting it from the vault", () => {
      node("event-editor-window-minimize").click();
      expect(deleteEditorEvent(mapId, "window-event", { silent: true })).toBe(true);
      expect(draft()).toBeUndefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("ends ownership on same-ID project replacement without touching the incoming draft", () => {
      node("event-editor-window-minimize").click();
      const replacement = structuredClone(store.getCurrent());
      const incoming = replacement.maps[mapId].events[0];
      if (!incoming.pages?.[0]) throw new Error("Expected page");
      incoming.pages[0].name = "Incoming";
      store.replaceProject(replacement);
      expect(draft()?.pages?.[0].name).toBe("Incoming");
      expect(draft()?.draft).toBeDefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("tears down its pending close guard on project replacement", async () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
      node("event-editor-modal-close").click();
      const replacement = structuredClone(store.getCurrent());
      store.replaceProject(replacement);
      expect(document.querySelector('[data-testid="app-confirm-modal"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
      await Promise.resolve();
      expect(draft()?.pages?.[0].name).toBe("Dirty");
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("does not steal focus or Escape from another modal while minimized", async () => {
      node("event-editor-window-minimize").click();
      const result = showConfirm({ message: "Other operation" });
      openEventEditorModal(mapId, "window-event");
      expect(node("event-editor-modal").hidden).toBe(true);
      expect(document.activeElement).toBe(node("app-modal-cancel"));
      key(document, "Escape");
      expect(await result).toBe(false);
      expect(node("event-editor-modal").hidden).toBe(true);
      node("event-editor-window-restore").click();
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("disposes draft subscriptions and restore UI on external DOM teardown", async () => {
      node("event-editor-cancel").click();
      const subscribe = store.subscribe.bind(store);
      const disposers: Array<() => void> = [];
      vi.spyOn(store, "subscribe").mockImplementation(listener => {
        const dispose = vi.fn(subscribe(listener));
        disposers.push(dispose);
        return dispose;
      });
      openEventEditorModal(mapId, "window-event");
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      const disposed = changedUntil(() => !document.querySelector('[data-testid="event-editor-window-restore"]'));
      modal.remove();
      await disposed;
      expect(draft()?.draft).toBeUndefined();
      expect(modalStackDepthForTest()).toBe(0);
      store.updateMap(mapId, map => { map.name = "After teardown"; });
      expect(disposers.length).toBeGreaterThan(0);
      for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });

    it("maximizes on immediate titlebar double-click but not on nested button SVGs", () => {
      const modal = node("event-editor-modal");
      node("event-editor-titlebar").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      const path = node("event-editor-window-fullscreen").querySelector("path");
      if (!path) throw new Error("Expected SVG path");
      path.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      key(modal, "Enter", true);
      expect(modal.classList.contains("is-fullscreen")).toBe(false);
    });

  });
});

describe("eventEditorWindowing", () => {
  isolateTimers();
  describe("event editor windowing", () => {
    afterEach(() => {
      document.body.classList.remove("event-editor-column-resizing");
      document.body.replaceChildren();
    });

    it("toggles full view and restores the previous window geometry", () => {
      const backdrop = document.createElement("div");
      const windowEl = document.createElement("section");
      const header = document.createElement("header");
      const button = document.createElement("button");
      header.append(button);
      windowEl.append(header);
      backdrop.append(windowEl);
      document.body.append(backdrop);
      windowEl.style.width = "960px";
      windowEl.style.height = "700px";
      windowEl.style.transform = "translate(24px, 12px)";

      const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
      expect(button.getAttribute("aria-label")).toBe("전체 보기");
      expect(button.getAttribute("aria-pressed")).toBe("false");

      button.click();
      expect(controller.isFullscreen()).toBe(true);
      expect(backdrop.classList.contains("is-fullscreen")).toBe(true);
      expect(windowEl.classList.contains("is-fullscreen")).toBe(true);
      expect(windowEl.style.transform).toBe("");
      expect(button.getAttribute("aria-label")).toBe("창 보기로 복원");

      backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(controller.isFullscreen()).toBe(false);
      expect(windowEl.style.width).toBe("960px");
      expect(windowEl.style.height).toBe("700px");
      expect(windowEl.style.transform).toBe("translate(24px, 12px)");
      controller.dispose();
    });

    it("supports title-bar double click and Alt+Enter", () => {
      const backdrop = document.createElement("div");
      const windowEl = document.createElement("section");
      const header = document.createElement("header");
      const button = document.createElement("button");
      const title = document.createElement("span");
      header.append(title, button);
      windowEl.append(header);
      backdrop.append(windowEl);
      document.body.append(backdrop);

      const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
      title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(controller.isFullscreen()).toBe(true);

      backdrop.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }));
      expect(controller.isFullscreen()).toBe(false);
      controller.dispose();
    });

    it("resizes the settings rail by keyboard and resets it on double click", () => {
      const workbench = document.createElement("div");
      const settings = document.createElement("div");
      const handle = document.createElement("div");
      settings.className = "event-editor-settings-column";
      workbench.append(settings, handle);
      document.body.append(workbench);

      Object.defineProperty(workbench, "getBoundingClientRect", {
        value: () => ({ left: 100, width: 1200, right: 1300, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
      });
      Object.defineProperty(settings, "getBoundingClientRect", {
        value: () => ({ left: 100, width: 312, right: 412, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
      });

      attachColumnResize(handle, workbench);
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("336px");
      expect(handle.getAttribute("aria-valuenow")).toBe("336");
      expect(handle.getAttribute("aria-valuetext")).toBe("설정 패널 336픽셀");

      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("288px");

      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("");
      expect(handle.getAttribute("aria-valuenow")).toBe("312");
    });


    it("lets a viewport-fitted modal become smaller instead of growing to the desktop minimum", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
      const windowEl = document.createElement("section");
      const handle = document.createElement("div");
      document.body.append(windowEl, handle);
      Object.defineProperty(windowEl, "getBoundingClientRect", {
        value: () => ({ left: 40, width: 720, right: 760, top: 32, bottom: 832, height: 800, x: 40, y: 32, toJSON: () => ({}) }),
      });

      attachWindowResize(handle, windowEl);
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));

      expect(windowEl.style.width).toBe("704px");
    });
  });
});
