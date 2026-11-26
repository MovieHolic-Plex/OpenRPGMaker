import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { _resetEventDraftVaultForTest, applyEventDraftVault, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { undoMapEdit, getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory } from "@/editor/mapEditHistory";
import { deleteEditorEvent, requestEditorEventDeletion } from "@/editor/eventDeletion";
import type { Command, EventPage, GameEvent, EventPageGraphic, MapId, EventPageCondition, NpcScheduleEntry, Project } from "@/project/types";
import { installFakeDom, FakeElement, renderWithFakeDom, findByTestId, flushFakeAnimationFrames, FakeNode } from "./fakeDom";
import { FORK_THEN_BRANCH_INDEX, isContainerInsideCommand, moveCommandBetweenLists, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { updateEventPage, normalizeEventPage } from "@/editor/eventPages";
import { createDefaultGameEvent, updateEvent } from "@/editor/eventActions";
import { renderEventCharacterSocialExtras, renderClassicPageTabStrip } from "@/editor/panels/eventEditor/pageProps";
import { applyMemoryOpeningTemplate } from "@/editor/panels/eventEditor/memoryOpeningTemplate";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { validateEventDraft, validateEventDraftBody } from "@/editor/eventDraftValidator";
import { projectWithEventDraftAuthoredWrites } from "@/project/eventDraftAuthored";
import { eventDraftDiffById, eventDraftHasUserChanges, projectWithoutEventDrafts, eventDraftDiff } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderEventGraphicIcon, renderEventGraphicPreview } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { el } from "@/util/dom";
import { eventSurfaceFileContaining } from "./helpers/eventSurfaceCss";
import { readFileSync } from "node:fs";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { resetToastsForTest } from "@/util/toast";
import { shortRecordName } from "@/editor/shortRecordName";
import { hasBatchim, josa, readIdentifier, readScriptLabels } from "@/editor/script/scriptLabels";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { flattenScript, renderEventPageFlow, renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { fieldSpawnBody } from "@/editor/panels/eventEditor/commandBodyFieldSpawn";
import { createCaptureProject } from "./fixtures/captureProject";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { navigateToEventCommand } from "@/editor/panels/eventEditor/content";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";
import { getAutoKeyedDataUrl } from "@/editor/panels/chromaKey";
import { Window } from "happy-dom";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { faceDisplayModeOf } from "@/editor/panels/eventEditor/facesetPreview";
import { renderNpcActivityCondition } from "@/editor/panels/eventEditor/conditionForm";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";

describe("panelsEventEditorSuite10", () => {
  isolateTimers();
  describe("eventCommandDeleteSafety", () => {
    isolateTimers();
    function eventPage(commands: Command[] = []): EventPage {
      return {
        id: "page-1",
        name: "페이지 1",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      };
    }
    function gameEvent(page: EventPage): GameEvent {
      return {
        id: "event-1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
    }
    function keyEvent(key: string, target?: EventTarget | null): KeyboardEvent {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        altKey: { value: false },
        ctrlKey: { value: false },
        key: { value: key },
        metaKey: { value: false },
        target: { value: target ?? null },
      });
      return event as KeyboardEvent;
    }
    describe("event command Delete safety", () => {
      let restoreDom: (() => void) | undefined;
      let restoreWindow: (() => void) | undefined;

      function installWindowShim(): void {
        const hadWindow = "window" in globalThis;
        const previous = (globalThis as { window?: unknown }).window;
        Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
        restoreWindow = () => {
          if (hadWindow) (globalThis as { window?: unknown }).window = previous;
          else Reflect.deleteProperty(globalThis, "window");
        };
      }

      beforeEach(() => {
        _resetEventDraftVaultForTest();
        restoreDom = installFakeDom();
        store.replaceProject(createBlankProject());
      });

      afterEach(() => {
        document.querySelector<HTMLElement>('[data-testid="app-modal-cancel"]')?.click();
        document.querySelector('[data-testid="event-editor-modal"]')?.remove();
        document.querySelector('[data-testid="toast"]')?.remove();
        restoreWindow?.();
        restoreWindow = undefined;
        restoreDom?.();
        vi.unstubAllGlobals();
      });

      it("Delete on a selected command removes only that command, not the event", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const commands: Command[] = [
          { kind: "text", speaker: "A", body: "hello" },
          { kind: "changeGold", op: "+=", amount: 10 },
        ];
        const page = eventPage(commands);
        map.events = [gameEvent(page)];
        store.replace(project);
        editorState.set({
          currentMapId: project.startMapId,
          selectedEventId: "event-1",
          selectedEventPageId: page.id,
        });
        const confirmDeletion = vi.fn(() => true);
        vi.stubGlobal("confirm", confirmDeletion);

        openEventEditorModal(project.startMapId, "event-1");
        const cmdHead = document.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
        if (!cmdHead) throw new Error("expected command head");

        cmdHead.dispatchEvent(keyEvent("Delete", cmdHead));

        expect(confirmDeletion).not.toHaveBeenCalled();
        const live = store.getCurrent().maps[project.startMapId]!.events.find((e) => e.id === "event-1");
        expect(live).toBeTruthy();
        expect(live?.pages?.[0]?.commands.map((c) => c.kind)).toEqual(["changeGold"]);
        expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
      });

      it("Delete while focus is on the command list surface does not delete the event", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const page = eventPage([{ kind: "text", speaker: "", body: "x" }]);
        map.events = [gameEvent(page)];
        store.replace(project);
        editorState.set({
          currentMapId: project.startMapId,
          selectedEventId: "event-1",
          selectedEventPageId: page.id,
        });
        const confirmDeletion = vi.fn(() => true);
        vi.stubGlobal("confirm", confirmDeletion);

        openEventEditorModal(project.startMapId, "event-1");
        const cmdList = document.querySelector<HTMLElement>(".cmd-list");
        if (!cmdList) throw new Error("expected cmd-list");

        const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
        if (!modal) throw new Error("expected modal");
        // Simulate keydown that reaches the modal with command-list target.
        Object.defineProperty(keyEvent("Delete", cmdList), "target", { value: cmdList });
        modal.dispatchEvent(keyEvent("Delete", cmdList));

        expect(confirmDeletion).not.toHaveBeenCalled();
        expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
      });

      it("event deletion snapshots and restore undoes the delete", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const page = eventPage();
        map.events = [gameEvent(page)];
        store.replace(project);
        editorState.set({
          currentMapId: project.startMapId,
          selectedEventId: "event-1",
          selectedEventPageId: page.id,
        });
        vi.stubGlobal("confirm", vi.fn(() => true));

        expect(deleteEditorEvent(project.startMapId, "event-1")).toBe(true);
        expect(store.getCurrent().maps[project.startMapId]!.events).toEqual([]);

        const toast = document.querySelector('[data-testid="toast"]');
        expect(toast?.textContent).toContain("삭제");
        const restore = document.querySelector<HTMLButtonElement>('[data-testid="toast-event-delete-restore"]');
        expect(restore).toBeTruthy();
        restore?.click();

        expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
      });

      it("requestEditorEventDeletion asks for confirmation before mutating", async () => {
        installWindowShim();
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.events = [gameEvent(eventPage())];
        store.replace(project);
        const confirmDeletion = vi.fn(() => false);
        vi.stubGlobal("confirm", confirmDeletion);

        const pending = requestEditorEventDeletion(project.startMapId, "event-1");
        const cancel = document.querySelector<HTMLButtonElement>('[data-testid="app-modal-cancel"]');
        const confirmButton = document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]');
        expect(cancel?.textContent).toBe("취소");
        expect(confirmButton?.textContent).toBe("삭제");
        cancel?.click();
        expect(await pending).toBe(false);
        expect(confirmDeletion).not.toHaveBeenCalled();
        expect(store.getCurrent().maps[project.startMapId]!.events).toHaveLength(1);
      });

      it("Ctrl+Z restores after confirmed event delete", async () => {
        installWindowShim();
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.events = [gameEvent(eventPage())];
        store.replace(project);
        const confirmDeletion = vi.fn(() => true);
        vi.stubGlobal("confirm", confirmDeletion);

        const pending = requestEditorEventDeletion(project.startMapId, "event-1");
        document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]')?.click();
        expect(await pending).toBe(true);
        expect(confirmDeletion).not.toHaveBeenCalled();
        expect(store.getCurrent().maps[project.startMapId]!.events).toEqual([]);
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
      });
    });
  });
  describe("eventCommandHistoryDrag", () => {
    isolateTimers();
    function baseActions(overrides: Partial<CommandListActions> = {}): CommandListActions {
      return {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand: vi.fn(),
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
        ...overrides,
      };
    }
    function startDrag(item: FakeElement | undefined): void {
      if (!item) throw new Error("drag source missing");
      item.querySelector('[data-testid="event-command-drag-handle"]')?.dispatchEvent(new Event("pointerdown"));
      item.dispatchEvent(new Event("dragstart"));
    }
    function dropEvent(sourcePath: readonly number[]): Event {
      const payload = JSON.stringify(sourcePath);
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientY: { value: 1 },
        dataTransfer: {
          value: {
            types: ["application/x-oprn-event-command-path", "text/plain"],
            getData: (type: string) =>
              type === "application/x-oprn-event-command-path" || type === "text/plain" ? payload : "",
            setData: vi.fn(),
            effectAllowed: "move",
            dropEffect: "move",
          },
        },
      });
      return event;
    }
    describe("event command history lifecycle", () => {
      it("forwards cross-container moves and records them for undo", () => {
        let commands: Command[] = [{ kind: "text", body: "A" }];
        const moveCommandAcross = vi.fn(() => {
          commands = [{ kind: "text", body: "B" }];
        });
        const history = createCommandToolbarHistory({
          key: "map:event:page-cross",
          readCommands: () => commands,
          replaceCommands: (next) => { commands = next; },
        });
        const wrapped = history.wrapActions(baseActions({ moveCommandAcross }));

        expect(wrapped.moveCommandAcross).toBeTypeOf("function");
        wrapped.moveCommandAcross?.([0], [1, FORK_THEN_BRANCH_INDEX], 0);
        expect(moveCommandAcross).toHaveBeenCalledWith([0], [1, FORK_THEN_BRANCH_INDEX], 0);
        expect(history.canUndo()).toBe(true);
        history.undo();
        expect(commands).toEqual([{ kind: "text", body: "A" }]);
      });

      it("does not resurrect cancelled edits after the event session history is cleared", () => {
        let commands: Command[] = [{ kind: "text", body: "A" }];
        const key = "map:event:page-cancel";
        const first = createCommandToolbarHistory({
          key,
          readCommands: () => commands,
          replaceCommands: (next) => { commands = next; },
        });
        const wrapped = first.wrapActions(baseActions({
          replaceCommand: (_path, command) => { commands = [command]; },
        }));
        wrapped.replaceCommand([0], { kind: "text", body: "B" });
        expect(first.canUndo()).toBe(true);

        // Cancel restores A and closes the edit session.
        commands = [{ kind: "text", body: "A" }];
        clearCommandToolbarHistories("map:event:");
        const reopened = createCommandToolbarHistory({
          key,
          readCommands: () => commands,
          replaceCommands: (next) => { commands = next; },
        });
        expect(reopened.canUndo()).toBe(false);
        reopened.undo();
        expect(commands).toEqual([{ kind: "text", body: "A" }]);
      });
    });
    describe("nested event command drag/drop DOM", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => { restoreDom = installFakeDom(); });
      afterEach(() => restoreDom?.());

      it("uses the real nested parent path for same-branch row reordering", () => {
        const moveCommandTo = vi.fn();
        const commands: Command[] = [{
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_0001", value: true },
          then: [
            { kind: "text", body: "A" },
            { kind: "text", body: "B" },
          ],
        }];
        const host = renderWithFakeDom(() => {
          const root = document.createElement("div");
          renderCommandList(root, commands, [], baseActions({ moveCommandTo }));
          return root;
        });
        const rows = host.querySelectorAll('[data-testid="event-command-text"]') as unknown as FakeElement[];
        expect(rows).toHaveLength(2);
        startDrag(rows[0]);
        rows[1]?.dispatchEvent(dropEvent([0, FORK_THEN_BRANCH_INDEX, 0]));
        expect(moveCommandTo).toHaveBeenCalledWith([0, FORK_THEN_BRANCH_INDEX, 0], 1);
      });

      it("routes a drop on the empty branch button to that branch instead of the root list", () => {
        const moveCommandAcross = vi.fn();
        const commands: Command[] = [
          {
            kind: "fork",
            condition: { kind: "switch", switchId: "sw_0001", value: true },
            then: [],
          },
          { kind: "text", body: "move me" },
        ];
        const host = renderWithFakeDom(() => {
          const root = document.createElement("div");
          renderCommandList(root, commands, [], baseActions({ moveCommandAcross }));
          return root;
        });
        const empty = host.querySelector(
          `[data-testid="event-command-branch-empty-0-${FORK_THEN_BRANCH_INDEX}"]`,
        ) as unknown as FakeElement | null;

        expect(empty?.dataset.containerPath).toBe(JSON.stringify([0, FORK_THEN_BRANCH_INDEX]));
        startDrag(host.querySelector('[data-testid="event-command-text"]') as unknown as FakeElement);
        empty?.dispatchEvent(dropEvent([1]));
        expect(moveCommandAcross).toHaveBeenCalledWith(
          [1],
          [0, FORK_THEN_BRANCH_INDEX],
          Number.MAX_SAFE_INTEGER,
        );
      });

      it("renders an empty branch drop zone and routes root-to-branch moves across containers", () => {
        const moveCommandAcross = vi.fn();
        const commands: Command[] = [
          {
            kind: "fork",
            condition: { kind: "switch", switchId: "sw_0001", value: true },
            then: [],
          },
          { kind: "text", body: "move me" },
        ];
        const host = renderWithFakeDom(() => {
          const root = document.createElement("div");
          renderCommandList(root, commands, [], baseActions({ moveCommandAcross }));
          return root;
        });
        const zones = host.querySelectorAll('[data-testid="event-command-branch-drop-zone"]') as unknown as FakeElement[];
        const thenZone = zones.find((zone) =>
          zone.dataset.containerPath === JSON.stringify([0, FORK_THEN_BRANCH_INDEX])
        );
        expect(thenZone).toBeTruthy();
        startDrag(host.querySelector('[data-testid="event-command-text"]') as unknown as FakeElement);
        thenZone?.dispatchEvent(dropEvent([1]));
        expect(moveCommandAcross).toHaveBeenCalledWith(
          [1],
          [0, FORK_THEN_BRANCH_INDEX],
          Number.MAX_SAFE_INTEGER
        );
      });
    });
  });
  describe("eventDraftTransactions", () => {
    isolateTimers();
    let restoreDom: () => void;
    let originalStorage: PropertyDescriptor | undefined;
    let mapId: string;
    let eventId: string;
    function liveEvent() {
      const event = store.getCurrent().maps[mapId].events.find((entry) => entry.id === eventId);
      if (!event) throw new Error("missing test event");
      return event;
    }
    function editName(name: string) {
      const field = renderEventCharacterSocialExtras(mapId, liveEvent());
      if (!field) throw new Error("missing social field");
      const input = field.querySelector<HTMLInputElement>('[data-testid="event-character-display-name-input"]');
      if (!input) throw new Error("missing name input");
      input.value = name;
      input.dispatchEvent(new Event("change"));
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
      originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
      const values = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      } });
      _resetEventDraftVaultForTest();
      const project = createBlankProject();
      mapId = project.startMapId;
      const event = createDefaultGameEvent(2, 2);
      eventId = event.id;
      event.characterId = "alice";
      project.maps[mapId].events = [event];
      project.characters = { alice: { displayName: "Before" } };
      store.replaceProject(project);
      beginExistingEventDraft(mapId, eventId);
      resetMapEditHistory();
    });
    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="field-monster-template-cancel"]')?.click();
      _resetEventDraftVaultForTest();
      resetMapEditHistory();
      if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
      restoreDom();
    });
    describe("linked authored draft transactions", () => {
      it.each(["save", "cancel"])("keeps a new event and new profile atomic on %s", (action) => {
        discardEventDraft(mapId, eventId);
        eventId = createEventDraft(mapId, 4, 4);
        updateEvent(mapId, eventId, { characterId: "new-npc" });
        editName("New NPC");
        const exported = deserialize(serialize(projectWithoutEventDrafts(store.getCurrent())));
        expect(exported.characters?.["new-npc"]).toBeUndefined();
        expect(exported.maps[mapId].events.some((entry) => entry.id === eventId)).toBe(false);
        if (action === "save") {
          saveEventDraft(mapId, eventId);
          expect(store.getCurrent().characters?.["new-npc"]?.displayName).toBe("New NPC");
          expect(undoMapEdit()).toBe(true);
        } else discardEventDraft(mapId, eventId);
        expect(store.getCurrent().characters?.["new-npc"]).toBeUndefined();
        expect(store.getCurrent().maps[mapId].events.some((entry) => entry.id === eventId)).toBe(false);
      });

      it.each(["save", "cancel"])("preserves concurrent profile fields and project edits on %s", (action) => {
        editName("");
        const incoming = projectWithoutEventDrafts(store.getCurrent());
        incoming.characters = { alice: { displayName: "Concurrent", birthday: { season: "spring", day: 4 } } };
        incoming.title = "Concurrent project edit";
        store.replace(incoming);
        if (action === "save") saveEventDraft(mapId, eventId);
        else discardEventDraft(mapId, eventId);
        expect(store.getCurrent().characters?.alice).toEqual({
          ...(action === "cancel" ? { displayName: "Concurrent" } : {}), birthday: { season: "spring", day: 4 },
        });
        expect(store.getCurrent().title).toBe("Concurrent project edit");
      });

      it("removes an empty profile on Apply and restores it on undo", () => {
        editName("");
        saveEventDraft(mapId, eventId);
        expect(store.getCurrent().characters).toBeUndefined();
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().characters).toEqual({ alice: { displayName: "Before" } });
        expect(redoMapEdit()).toBe(true);
        expect(store.getCurrent().characters).toBeUndefined();
      });

      it("returning to the original name clears the dirty guard without history", () => {
        editName("Temporary");
        editName("Before");
        expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(false);
        expect(getMapEditHistoryEntries()).toHaveLength(0);
      });

      it("commits template pages and a recovered switch together, with undo/redo", () => {
        const page = liveEvent().pages?.[0];
        if (!page) throw new Error("missing page");
        const before = projectWithoutEventDrafts(store.getCurrent());
        openFieldMonsterTemplateDialog(mapId, eventId, page);
        const input = document.querySelector<HTMLInputElement>('[data-testid="field-monster-template-clear-switch"]');
        const apply = document.querySelector<HTMLElement>('[data-testid="field-monster-template-apply"]');
        if (!input || !apply) throw new Error("missing field template controls");
        input.value = "recovered_switch";
        apply.click();
        const expectedPages = structuredClone(liveEvent().pages);
        persistEventDraftVaultNow("transaction-test");
        _resetEventDraftVaultForTest();
        expect(loadEventDraftVaultFromLocalStorage("transaction-test")).toBe(1);
        store.replace(applyEventDraftVault(before));
        saveEventDraft(mapId, eventId);
        expect(liveEvent().pages).toEqual(expectedPages);
        expect(store.getCurrent().switches.find((entry) => entry.id === "recovered_switch")?.name).toBeTruthy();
        expect(getMapEditHistoryEntries()).toHaveLength(1);
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().switches).toEqual(before.switches);
        expect(liveEvent().pages).toEqual(before.maps[mapId].events[0].pages);
        expect(redoMapEdit()).toBe(true);
        expect(liveEvent().pages).toEqual(expectedPages);
        expect(store.getCurrent().switches.some((entry) => entry.id === "recovered_switch")).toBe(true);
      });

      it.each(["After", ""])("isolates name %j from canonical data and history until Apply", (name) => {
        editName(name);
        expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
        expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(true);
        expect(eventDraftDiffById(store.getCurrent(), mapId, eventId)?.changes.length).toBeGreaterThan(0);
        expect(getMapEditHistoryEntries()).toHaveLength(0);
      });

      it("discards a newly created profile without removing unrelated project edits", () => {
        updateEvent(mapId, eventId, { characterId: "new-key" });
        editName("New profile");
        store.update((project) => { project.title = "Unrelated"; });
        discardEventDraft(mapId, eventId);
        expect(store.getCurrent().characters?.["new-key"]).toBeUndefined();
        expect(store.getCurrent().title).toBe("Unrelated");
        expect(liveEvent().characterId).toBe("alice");
        expect(getMapEditHistoryEntries()).toHaveLength(0);
      });

      it("retains name-only edits through durable vault recovery and global replacement", () => {
        editName("Recovered");
        const canonical = projectWithoutEventDrafts(store.getCurrent());
        persistEventDraftVaultNow("transaction-test");
        _resetEventDraftVaultForTest();
        expect(loadEventDraftVaultFromLocalStorage("transaction-test")).toBe(1);
        store.replace(applyEventDraftVault(canonical));
        expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(true);
        expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
        saveEventDraft(mapId, eventId);
        expect(store.getCurrent().characters?.alice?.displayName).toBe("Recovered");
      });

      it("commits both character keys and the event in one undoable Apply", () => {
        editName("Alice edited");
        updateEvent(mapId, eventId, { characterId: "bob" });
        editName("Bob created");
        store.update((project) => { project.title = "Keep me"; });
        saveEventDraft(mapId, eventId);
        expect(getMapEditHistoryEntries()).toHaveLength(1);
        expect(store.getCurrent().characters).toMatchObject({ alice: { displayName: "Alice edited" }, bob: { displayName: "Bob created" } });
        expect(undoMapEdit()).toBe(true);
        expect(liveEvent().characterId).toBe("alice");
        expect(store.getCurrent().characters).toEqual({ alice: { displayName: "Before" } });
        expect(store.getCurrent().title).toBe("Keep me");
        expect(redoMapEdit()).toBe(true);
        expect(liveEvent().characterId).toBe("bob");
        expect(store.getCurrent().characters?.bob?.displayName).toBe("Bob created");
      });

      it("Cancel after Apply retains the applied name and only one history entry", () => {
        editName("Applied");
        saveEventDraft(mapId, eventId);
        beginExistingEventDraft(mapId, eventId);
        editName("Discarded");
        discardEventDraft(mapId, eventId);
        expect(store.getCurrent().characters?.alice?.displayName).toBe("Applied");
        expect(getMapEditHistoryEntries()).toHaveLength(1);
      });

      it("memory template Cancel leaves no global undo entry or changed pages", () => {
        const before = structuredClone(liveEvent().draft?.original);
        const page = liveEvent().pages?.[0];
        if (!page) throw new Error("missing page");
        applyMemoryOpeningTemplate(mapId, eventId, commands => updateEventPage(mapId, eventId, page.id, { commands }));
        expect(liveEvent().pages?.[0]?.commands.length).toBeGreaterThan(3);
        discardEventDraft(mapId, eventId);
        expect(liveEvent()).toEqual(before);
        expect(getMapEditHistoryEntries()).toHaveLength(0);
      });

      it.each([false, true])("field template stages switch definitions without session writes (existing=%s)", (existing) => {
        const switchId = "transaction_clear";
        if (existing) store.update((project) => { project.switches.push({ id: switchId, name: "" }); });
        const before = projectWithoutEventDrafts(store.getCurrent());
        const page = liveEvent().pages?.[0];
        if (!page) throw new Error("missing page");
        openFieldMonsterTemplateDialog(mapId, eventId, page);
        const input = document.querySelector<HTMLInputElement>('[data-testid="field-monster-template-clear-switch"]');
        const apply = document.querySelector<HTMLElement>('[data-testid="field-monster-template-apply"]');
        if (!input || !apply) throw new Error("missing field template controls");
        input.value = switchId;
        apply.click();
        expect(liveEvent().pages).toHaveLength(2);
        expect(validateEventDraft(projectWithEventDraftAuthoredWrites(store.getCurrent(), mapId, eventId), mapId, eventId).canCommit).toBe(true);
        expect(projectWithoutEventDrafts(store.getCurrent()).switches).toEqual(before.switches);
        expect(store.getCurrent().session).toEqual(before.session);
        expect(getMapEditHistoryEntries()).toHaveLength(0);
        discardEventDraft(mapId, eventId);
        expect(store.getCurrent().switches).toEqual(before.switches);
      });
    });
  });
});

describe("panelsEventEditorSuite11", () => {
  isolateTimers();
  describe("eventEditorPresentation", () => {
    isolateTimers();
    describe("event editor presentation", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        const firstItem = project.database.items[0];
        if (firstItem) firstItem.name = "포션";
        const firstActor = project.database.actors[0];
        if (firstActor) firstActor.name = "잭";
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("keeps command text black by default while coloring command labels and important values", () => {
        const command = { kind: "text", body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요." } satisfies Command;

        const parts = commandSummaryParts(command);

        expect(parts.map((part) => part.text).join("")).toBe(commandSummary(command));
        expect(parts).toContainEqual({ text: "문장 표시", tone: "command" });
        expect(parts).toContainEqual({ text: ": ", tone: "plain" });
        expect(parts.some((part) => part.tone === "plain" && part.text.includes("어서 와요"))).toBe(true);
      });

      it("renders choice options as chips and cancel as a distinct badge, not another option", () => {
        const command = {
          kind: "choices",
          prompt: "폐광 열쇠 조사도 맡겠나?",
          options: [
            { text: "맡는다", branch: [] },
            { text: "잠시 후", branch: [] },
          ],
          cancelBehavior: "choice2",
        } satisfies Command;

        const parts = commandSummaryParts(command);
        const text = commandSummary(command);

        expect(parts).toContainEqual({ text: "선택지 표시", tone: "command" });
        expect(parts).toContainEqual({ text: "1.맡는다", tone: "choice-option" });
        expect(parts).toContainEqual({ text: "2.잠시 후", tone: "choice-option" });
        expect(parts).toContainEqual({ text: "취소→잠시 후", tone: "choice-cancel" });
        // 취소 표기가 옵션 목록 사이에 섞이지 않는다.
        expect(text).toContain("1.맡는다");
        expect(text).toContain("2.잠시 후");
        expect(text).toContain("취소→잠시 후");
        expect(text).not.toMatch(/맡는다 \/ 잠시 후 \/ 취소/);
      });

      it("shows user-defined switch and variable names instead of raw internal ids", () => {
        const project = store.getCurrent();
        const variable = project.variables[0];
        const blankVariable = project.variables[1];
        const switchRecord = project.switches[0];
        if (!variable || !blankVariable || !switchRecord) throw new Error("missing default switch/variable slots");
        variable.name = "Gold Count";
        switchRecord.name = "Gate Open";
        store.replace(project);

        expect(commandSummary({ kind: "setVariable", variableId: variable.id, op: "=", value: { kind: "var", id: blankVariable.id } })).toContain("Gold Count");
        expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: true })).toContain("Gate Open");
        expect(commandSummary({ kind: "setVariable", variableId: blankVariable.id, op: "=", value: 0 })).toContain("(이름 없음)");
        expect(commandSummary({ kind: "setVariable", variableId: blankVariable.id, op: "=", value: 0 })).not.toContain(blankVariable.id);
      });

      it("showEmote 요약은 이모트 이름과 대상을 함께 보여준다", () => {
        expect(commandSummary({
          kind: "showEmote",
          target: { eventId: "town-npc" },
          emote: "heart",
        })).toBe("이모트 표시: 하트 / 이벤트 town-npc");
        expect(commandSummary({
          kind: "showEmote",
          target: "player",
          emote: "question",
        })).toBe("이모트 표시: 물음표 / 주인공");
      });

      it("스위치 조작 요약은 ON/OFF/전환/변수 값을 구분한다", () => {
        const project = store.getCurrent();
        const switchRecord = project.switches[0];
        const variable = project.variables[0];
        if (!switchRecord || !variable) throw new Error("missing default switch/variable slots");
        switchRecord.name = "Gate Open";
        variable.name = "Flag Count";
        store.replace(project);

        expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: true })).toContain("켜짐");
        expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: false })).toContain("꺼짐");
        expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: "toggle" })).toContain("전환");
        expect(commandSummary({
          kind: "setSwitch",
          switchId: switchRecord.id,
          value: { kind: "var", id: variable.id },
        })).toContain("Flag Count");
      });

      it("스위치 조작 폼은 인라인 검색·ON/OFF/전환/변수 값을 한 줄로 노출한다", () => {
        const project = store.getCurrent();
        const switchRecord = project.switches[0];
        const variable = project.variables[0];
        if (!switchRecord || !variable) throw new Error("missing default switch/variable slots");
        switchRecord.name = "Gate Open";
        variable.name = "Flag Count";
        store.replace(project);

        let staged: Command = { kind: "setSwitch", switchId: switchRecord.id, value: true };
        const body = renderWithFakeDom(() => renderCommandBody(
          {
            path: [0],
            lockKind: true,
            actions: {
              addCommand: () => undefined,
              deleteCommand: () => undefined,
              insertCommand: () => undefined,
              moveCommand: () => undefined,
              moveCommandTo: () => undefined,
              replaceCommand: (_path, next) => {
                staged = next;
              },
            },
          },
          staged,
        ));

        // 인라인 검색 필터는 변수·스위치 선택 모달 통일(2026-08)로 제거됐다. 검색은 "찾기" 트리거가 여는 모달이 소유한다.
        expect(findByTestId(body, "event-switch-inline-filter")).toBeNull();
        expect(findByTestId(body, "event-command-switch-value")).not.toBeNull();
        expect(findByTestId(body, "event-command-switch-value-row")).not.toBeNull();
        expect(findByTestId(body, "event-command-switch-hint")).not.toBeNull();
        // "값 소스" 배지/세그먼트는 쓰지 않는다.
        expect(findByTestId(body, "event-command-switch-value-mode")).toBeNull();
        expect(body.textContent).not.toContain("값 소스");

        const valueSelect = findByTestId(body, "event-command-switch-value") as unknown as HTMLSelectElement;
        valueSelect.value = "toggle";
        valueSelect.dispatchEvent(new Event("change"));
        expect(staged).toEqual({ kind: "setSwitch", switchId: switchRecord.id, value: "toggle" });

        valueSelect.value = "variable";
        valueSelect.dispatchEvent(new Event("change"));
        const operand = findByTestId(body, "event-command-switch-operand") as unknown as HTMLElement;
        expect(operand.hidden).toBe(false);
        const operandSelect = operand.querySelector("select") as HTMLSelectElement | null;
        if (!operandSelect) throw new Error("missing switch operand select");
        operandSelect.value = variable.id;
        operandSelect.dispatchEvent(new Event("change"));
        expect(staged).toEqual({
          kind: "setSwitch",
          switchId: switchRecord.id,
          value: { kind: "var", id: variable.id },
        });
      });

      it("marks non-fixed event graphics as animated previews", () => {
        const graphic = {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
        } satisfies EventPageGraphic;

        const preview = renderWithFakeDom(() => renderEventGraphicPreview(graphic, "random"));

        expect(preview).toBeInstanceOf(FakeElement);
        expect(preview.style.boxSizing).toBe("content-box");
        expect(preview.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth * 2}px`);
        expect(preview.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight * 2}px`);
        expect(preview.style.backgroundRepeat).toBe("no-repeat");
        expect(preview.style.backgroundSize).toBe(
          `${RESOURCE_SLICING.charset.sheetWidth * 2}px ${RESOURCE_SLICING.charset.sheetHeight * 2}px`
        );
        expect(preview.classList.contains("moving")).toBe(true);
        expect(preview.dataset.movementType).toBe("random");
        expect(preview.style["--event-graphic-frame-a"]).toBeTruthy();
        expect(preview.style["--event-graphic-frame-b"]).toBeTruthy();
      });

      it("uses a distinct test id for small event list graphic icons", () => {
        const graphic = {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
        } satisfies EventPageGraphic;

        const icon = renderWithFakeDom(() => renderEventGraphicIcon(graphic));

        expect(icon.dataset.testid).toBe("event-page-graphic-icon-preview");
        expect(icon.classList.contains("event-graphic-icon-preview")).toBe(true);
        // Default list icon stays compact (~0.6875 scale → 16.5×22).
        expect(icon.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth * 0.6875}px`);
        expect(icon.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight * 0.6875}px`);
      });

      it("renders page-tab icons at full charset cell size", () => {
        const graphic = {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
        } satisfies EventPageGraphic;

        const icon = renderWithFakeDom(() => renderEventGraphicIcon(graphic, { scale: 1 }));

        expect(icon.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth}px`);
        expect(icon.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight}px`);
      });

      it("renders runtime support badges in the command list", () => {
        const host = renderWithFakeDom(() => {
          const node = el("div");
          renderCommandList(
            node,
            [{ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "메모" } }],
            [],
            {
              addCommand: () => undefined,
              deleteCommand: () => undefined,
              insertCommand: () => undefined,
              moveCommand: () => undefined,
              moveCommandTo: () => undefined,
              replaceCommand: () => undefined,
            }
          );
          return node;
        });

        const badge = findByTestId(host, "command-runtime-badge-list-0");
        expect(badge?.dataset.runtimeSupport).toBe("editor-only");
        expect(badge?.attrs.title).toContain("런타임에서 실행되지 않습니다");
      });

      it("renders the inserted native row with the same map support grade as lint and draft validation", () => {
        const host = renderWithFakeDom(() => {
          const node = el("div");
          renderCommandList(
            node,
            [{ kind: "giveMonster", speciesId: "monster_missing", level: 1 }],
            [],
            {
              addCommand: () => undefined,
              deleteCommand: () => undefined,
              insertCommand: () => undefined,
              moveCommand: () => undefined,
              moveCommandTo: () => undefined,
              replaceCommand: () => undefined,
            },
            { pickerContext: "map" }
          );
          return node;
        });

        expect(findByTestId(host, "command-runtime-badge-list-0")?.dataset.runtimeSupport).toBe("runtime-partial");
      });

      it("renders M2 image resource fields with a picker, selected name, and preview", () => {
        const body = renderWithFakeDom(() => {
          const rendered = renderM2CommandBody(
            {
              path: [],
              actions: {
                addCommand: () => undefined,
                deleteCommand: () => undefined,
                insertCommand: () => undefined,
                moveCommand: () => undefined,
                moveCommandTo: () => undefined,
                replaceCommand: () => undefined,
              },
            },
            {
              kind: "m2Command",
              commandId: "m2-052-move-picture",
              fields: {
                pictureId: "pic_demo",
                resourceId: "easyrpg-picture-cloud",
                x: 24,
                y: 32,
              },
            }
          );
          if (!rendered) throw new Error("expected Move Picture editor body");
          return rendered;
        });

        expect(findByTestId(body, "move-picture-m2-resource-select")).toBeNull();
        expect(findByTestId(body, "move-picture-m2-preview")?.textContent).toContain("pic_demo");
        expect(findByTestId(body, "move-picture-m2-preview")?.textContent).toContain("(24, 32)");
        expect(findByTestId(body, "move-picture-m2-id-input")?.value).toBe("pic_demo");
        expect(findByTestId(body, "move-picture-m2-x-input")?.value).toBe("24");
        expect(findByTestId(body, "move-picture-m2-y-input")?.value).toBe("32");
      });

      it("says what an access toggle allows and never prints internal keys or raw booleans", () => {
        const blocked = commandSummary({ kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "false" } });
        expect(blocked).toContain("저장 막기");
        expect(blocked).not.toMatch(/허가|금지 \/|false/);
        const allowed = commandSummary({ kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "true", legacyFlag: true } });
        expect(allowed).toContain("저장 허용");
        expect(allowed).not.toMatch(/legacyFlag|true/);
      });

      it("renders the selected standalone face image inside the Change Face command editor", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            {
              path: [],
              actions: {
                addCommand: () => undefined,
                deleteCommand: () => undefined,
                insertCommand: () => undefined,
                moveCommand: () => undefined,
                moveCommandTo: () => undefined,
                replaceCommand: () => undefined,
              },
            },
            {
              kind: "changeFace",
              resourceId: "easyrpg-faceset-actor1-05",
              position: "right",
              flipHorizontally: true,
            }
          )
        );

        const preview = findByTestId(body, "event-command-face-preview");

        expect(preview).not.toBeNull();
        expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1-05");
        // 칸 번호는 모델에서 사라졌다 — 표면에도 인덱스 흔적이 없어야 한다.
        expect(preview?.dataset.faceIndex).toBeUndefined();
        expect(findByTestId(body, "event-command-edit-summary")?.textContent).toBe("얼굴 바꾸기");
        expect(findByTestId(body, "event-command-face-index")).toBeNull();
        expect(findByTestId(body, "event-command-face-index-grid")).toBeNull();
        expect(findByTestId(body, "event-command-face-slot-5")).toBeNull();
        expect(findByTestId(body, "event-command-face-resource-set")).not.toBeNull();
        const crop = findByTestId(body, "event-command-face-crop");
        expect(crop?.style["--face-display-width"]).toBe("96px");
        expect(crop?.style["--face-x"]).toBeUndefined();
        expect(crop?.style["--face-sheet-size"]).toBeUndefined();
        expect(findByTestId(body, "faceset-crop-sheet")?.attrs.src).toContain(
          "/assets/easyrpg/faceset/Actor1/05.png",
        );
        // 4×4 격자 대신 낱장 얼굴 갤러리에서 고른다.
        expect(findByTestId(body, "event-command-face-gallery")).not.toBeNull();
        expect(
          findByTestId(body, "event-command-face-option-easyrpg-faceset-actor1-05")?.className,
        ).toContain("is-selected");
      });

      
      it("hides the face gallery for bust resources and shows a bust note", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            {
              path: [],
              actions: {
                addCommand: () => undefined,
                deleteCommand: () => undefined,
                insertCommand: () => undefined,
                moveCommand: () => undefined,
                moveCommandTo: () => undefined,
                replaceCommand: () => undefined,
              },
            },
            {
              kind: "changeFace",
              resourceId: "generated-face-actor1-bust",
              position: "left",
              flipHorizontally: false,
            }
          )
        );

        expect(findByTestId(body, "event-command-face-bust-note")).not.toBeNull();
        expect(findByTestId(body, "event-command-face-gallery")).toBeNull();
        expect(findByTestId(body, "event-command-face-preview")?.dataset.faceMode).toBe("bust");
        expect(findByTestId(body, "event-command-face-bust-preset")).not.toBeNull();
      });

    it("explains missing face graphic previews instead of leaving a blank slot", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            {
              path: [],
              actions: {
                addCommand: () => undefined,
                deleteCommand: () => undefined,
                insertCommand: () => undefined,
                moveCommand: () => undefined,
                moveCommandTo: () => undefined,
                replaceCommand: () => undefined,
              },
            },
            {
              kind: "changeFace",
              resourceId: "missing-faceset",
              position: "left",
              flipHorizontally: false,
            }
          )
        );

        const preview = findByTestId(body, "event-command-face-preview");

        expect(preview?.dataset.empty).toBe("true");
        expect(preview?.textContent).toContain("missing-faceset");
        expect(preview?.textContent).toContain("미리보기를 찾을 수 없습니다.");
      });

      it("updates the Change Face preview when the face resource changes", () => {
        // 얼굴 편집면은 공용 명령 편집 모달의 본문이다 — 종류별 전용 다이얼로그는 없다.
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            {
              path: [],
              actions: {
                addCommand: () => undefined,
                deleteCommand: () => undefined,
                insertCommand: () => undefined,
                moveCommand: () => undefined,
                moveCommandTo: () => undefined,
                replaceCommand: () => undefined,
              },
            },
            { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false }
          )
        );

        const resource = findByTestId(body, "event-command-face-resource");
        if (!resource) throw new Error("missing face resource input");
        // 칸 번호 스피너는 삭제됐다.
        expect(findByTestId(body, "faceset-index")).toBeNull();
        resource.value = "easyrpg-faceset-actor1-05";
        resource.dispatchEvent(new Event("input"));

        const preview = findByTestId(body, "event-command-face-preview");
        expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1-05");
        expect(preview?.dataset.faceIndex).toBeUndefined();
        expect(findByTestId(body, "faceset-crop-sheet")?.attrs.src).toContain(
          "/assets/easyrpg/faceset/Actor1/05.png",
        );
      });

      it("renders page conditions as Korean RM-style condition rows", () => {
        const page = {
          id: "page-1",
          name: "EV0001",
          conditions: [
            { kind: "switch", switchId: "sw_gate", value: true },
            { kind: "switch", switchId: "sw_bonus", value: true },
            { kind: "variable", variableId: "var_score", op: ">=", value: 7 },
            { kind: "item", itemId: "item_potion", present: true },
            { kind: "actor", actorId: "actor_hero", present: true },
            { kind: "timer", timerId: "timer1", seconds: 65 },
          ],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        } satisfies EventPage;

        const conditions = renderWithFakeDom(() =>
          el("div", { children: renderPageConditions("map-start", "event-1", page) })
        );

        expect(conditions.textContent).toContain("스위치");
        expect(conditions.textContent).toContain("켜짐");
        expect(conditions.textContent).toContain("변수");
        expect(conditions.textContent).toContain("이상");
        expect(conditions.textContent).toContain("아이템");
        expect(conditions.textContent).toContain("보유 중");
        expect(conditions.textContent).toContain("주인공");
        expect(conditions.textContent).toContain("파티에 있음");
        expect(conditions.textContent).toContain("타이머 1");
        expect(conditions.textContent).toContain("포션");
        expect(conditions.textContent).toContain("잭");
        expect(conditions.textContent).toContain("초과");
        expect(conditions.textContent).toContain("미만");
        expect(findByTestId(conditions, "event-page-item-condition-input")?.tagName).toBe("SELECT");
        expect(findByTestId(conditions, "event-page-actor-condition-input")?.tagName).toBe("SELECT");
        expect(findByTestId(conditions, "event-page-timer1-condition-minutes")?.value).toBe("1");
        expect(findByTestId(conditions, "event-page-timer1-condition-seconds")?.value).toBe("5");
      });

      it("keeps extra page conditions in the expandable advanced condition list", () => {
        const page = {
          id: "page-1",
          name: "EV0001",
          conditions: [
            { kind: "switch", switchId: "sw_gate", value: true },
            { kind: "switch", switchId: "sw_bonus", value: true },
            { kind: "switch", switchId: "sw_secret", value: true },
            { kind: "variable", variableId: "var_score", op: ">=", value: 7 },
            { kind: "variable", variableId: "var_rank", op: ">=", value: 3 },
          ],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        } satisfies EventPage;

        const conditions = renderWithFakeDom(() =>
          el("div", { children: renderPageConditions("map-start", "event-1", page) })
        );

        expect(conditions.textContent).toContain("고급 조건 (2)");
        expect(findByTestId(conditions, "event-page-advanced-condition-list")).not.toBeNull();
        expect(findByTestId(conditions, "event-page-advanced-condition-switch-0")?.value).toBe("sw_secret");
        expect(findByTestId(conditions, "event-page-advanced-condition-variable-1")?.value).toBe("var_rank");
        expect(findByTestId(conditions, "event-page-advanced-condition-variable-picker-1")).not.toBeNull();
        expect(findByTestId(conditions, "event-page-advanced-condition-add")).not.toBeNull();
      });

      it("얼굴 바꾸기 폼에 AI 얼굴 만들기 칸이 있다", () => {
        const staged: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false };
        const body = renderWithFakeDom(() => renderCommandBody(
          {
            path: [0],
            lockKind: true,
            actions: {
              addCommand: () => undefined,
              deleteCommand: () => undefined,
              insertCommand: () => undefined,
              moveCommand: () => undefined,
              moveCommandTo: () => undefined,
              replaceCommand: () => undefined,
            },
          },
          staged,
        ));
        expect(findByTestId(body, "event-command-face-ai-prompt"), "얼굴 AI 프롬프트 칸").not.toBeNull();
        expect(findByTestId(body, "event-command-face-ai-generate"), "얼굴 AI 생성 버튼").not.toBeNull();
      });
    });
  });
  // test/eventIdReadout.test.ts
  //
  // OPRN-OUT-014 — 선택한 이벤트의 정본 `event.id` 를 읽기 전용 속성으로 보여 준다.
  //
  // 왜 이 게이트가 필요한가: 이 값이 보이는 곳은 목록 호버 카드와 전역 검색 결과뿐이었다 —
  // 둘 다 «값을 이미 알아야» 닿는 경로다. 그리고 예전 헤더의 `0007` 은 ID 가 아니라 맵
  // events 배열 순번이었다(modal.ts 주석). 그래서 이 테스트는 두 가지를 동시에 못 박는다:
  //   1) 화면에 뜨는 문자열이 **저장된 event.id 그 자체**여야 한다(순번·이름·characterId 유도 금지)
  //   2) 그 표시를 만지는 것으로 프로젝트도 이벤트 드래프트도 더러워지지 않아야 한다
  describe("eventIdReadout", () => {
    isolateTimers();
    let restoreFakeDom: () => void = () => undefined;
    /** 실제 genId("ev") 출력 모양 — prefix + v4 UUID. 39자라 좁은 상자에서 레이아웃을 시험한다. */
    const LONG_UUID_ID = "ev_3f1c9b2e-8a47-4d6b-9c05-7e2a1b4d8f30";
    function fakeContainer(): HTMLElement {
      return new FakeElement("div") as unknown as HTMLElement;
    }
    function page(id = "page-1", name = "EV001"): EventPage {
      return {
        id,
        name,
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
    }
    function gameEvent(id: string, overrides: Partial<GameEvent> = {}): GameEvent {
      return {
        id,
        x: 7,
        y: 4,
        trigger: { kind: "action" },
        commands: [],
        pages: [page()],
        ...overrides,
      };
    }
    /** 맵에 이벤트를 심고 첫 번째를 선택한 상태로 만든다. */
    function seed(events: readonly GameEvent[], selectedId = events[0]?.id ?? null): MapId {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].events = events.map((event) => ({ ...event }));
      store.replaceProject(project);
      editorState.set({
        currentMapId: mapId,
        selectedEventId: selectedId,
        selectedEventPageId: events.find((event) => event.id === selectedId)?.pages?.[0]?.id ?? null,
      });
      return mapId;
    }
    function renderSidebar(): HTMLElement {
      const container = fakeContainer();
      renderEventEditor(container);
      return container;
    }
    function readout(root: HTMLElement, scope = "event-summary"): HTMLElement {
      const node = root.querySelector<HTMLElement>(`[data-testid="${scope}-event-id"]`);
      if (!node) throw new Error(`${scope}-event-id 를 찾지 못했다`);
      return node;
    }
    function valueInput(root: HTMLElement, scope = "event-summary"): HTMLInputElement {
      const node = root.querySelector<HTMLInputElement>(`[data-testid="${scope}-event-id-value"]`);
      if (!node) throw new Error(`${scope}-event-id-value 를 찾지 못했다`);
      return node;
    }
    describe("이벤트 ID 읽기 전용 표시 (OPRN-OUT-014)", () => {
      beforeEach(() => {
        _resetEventDraftVaultForTest();
        restoreFakeDom = installFakeDom();
        resetToastsForTest();
      });

      afterEach(() => {
        document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
        document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
        resetToastsForTest();
        _resetEventDraftVaultForTest();
        restoreFakeDom();
        vi.unstubAllGlobals();
      });

      // ── 정확한 값 ────────────────────────────────────────────────────────────────

      it("저장된 이벤트: 선택 요약이 저장된 id 를 글자 그대로 보여 준다", () => {
        seed([gameEvent("ev_saved_alpha")]);
        expect(valueInput(renderSidebar()).value).toBe("ev_saved_alpha");
      });

      it("새 드래프트: 아직 커밋 전이어도 배정된 id 를 보여 준다", () => {
        seed([gameEvent("ev_fresh_draft", { draft: { kind: "new" } })]);
        expect(valueInput(renderSidebar()).value).toBe("ev_fresh_draft");
      });

      it("복제 이벤트: 원본이 아니라 자기 id 를 보여 준다", () => {
        const source = gameEvent("ev_source", { pages: [page("page-1", "원본")] });
        const clone = gameEvent("ev_clone", { x: 8, pages: [page("page-1", "원본")] });
        seed([source, clone], "ev_clone");
        expect(valueInput(renderSidebar()).value).toBe("ev_clone");
      });

      it("레거시·커스텀 id: 접두사 규칙을 안 따라도 그대로 보여 준다", () => {
        seed([gameEvent("EV003")]);
        expect(valueInput(renderSidebar()).value).toBe("EV003");
      });

      it("긴 UUID id: 잘리지 않은 전체 값이 value 와 title 에 남는다", () => {
        seed([gameEvent(LONG_UUID_ID)]);
        const input = valueInput(renderSidebar());
        expect(input.value).toBe(LONG_UUID_ID);
        expect(input.getAttribute("title")).toContain(LONG_UUID_ID);
      });

      it("표시 이름·페이지 id·characterId·목록 순번을 값으로 쓰지 않는다", () => {
        seed([
          gameEvent("ev_first"),
          gameEvent("ev_target", {
            characterId: "npc_baker",
            pages: [page("page-xyz", "빵집 주인")],
          }),
        ], "ev_target");
        const input = valueInput(renderSidebar());
        expect(input.value).toBe("ev_target");
        expect(input.value).not.toContain("npc_baker");
        expect(input.value).not.toContain("page-xyz");
        expect(input.value).not.toContain("빵집");
        expect(input.value).not.toBe("2");
      });

      // ── 읽기 전용 ────────────────────────────────────────────────────────────────

      it("readonly 속성으로 잠근다 — disabled 는 키보드 선택을 막으므로 쓰지 않는다", () => {
        seed([gameEvent("ev_locked")]);
        const input = valueInput(renderSidebar());
        expect(input.getAttribute("readonly")).not.toBeNull();
        expect(input.getAttribute("disabled")).toBeNull();
        expect(input.disabled).toBe(false);
        // 탭 순서에 남아야 포커스 → Ctrl+A → 복사가 가능하다.
        expect(input.getAttribute("tabindex")).not.toBe("-1");
      });

      it("값을 바꿔 change 를 쏘아도 프로젝트도 드래프트도 바뀌지 않는다", () => {
        // 드래프트에 원본 스냅샷을 실어 둔다 — original 이 없으면 diff 가 무조건 null 이라
        // 「diff 에 안 들어간다」를 증명하지 못한다.
        const base = gameEvent("ev_immutable");
        const mapId = seed([{ ...base, draft: { kind: "edit", original: { ...base } } }]);
        const input = valueInput(renderSidebar());

        input.value = "ev_hacked";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        const project = store.getCurrent();
        const stored = project.maps[mapId]?.events.find((event) => event.id === "ev_immutable");
        expect(stored).toBeDefined();
        expect(project.maps[mapId]?.events.some((event) => event.id === "ev_hacked")).toBe(false);
        expect(eventDraftHasUserChanges(project, mapId, "ev_immutable")).toBe(false);
        expect(eventDraftDiff(mapId, stored!)?.changes ?? []).toEqual([]);
      });

      it("읽기 전용 표시를 만지는 것만으로 프로젝트가 미저장 상태가 되지 않는다", () => {
        seed([gameEvent("ev_clean")]);
        const before = store.hasUnsavedChanges();
        const input = valueInput(renderSidebar());
        input.focus();
        input.select();
        input.value = "ev_typed";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(store.hasUnsavedChanges()).toBe(before);
      });

      // ── 라벨·도움말 ──────────────────────────────────────────────────────────────

      it("라벨과 도움말이 이벤트 이름·페이지·characterId·목록 순서와 구분해 준다", () => {
        seed([gameEvent("ev_labelled")]);
        const root = renderSidebar();
        const label = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-label"]');
        const hint = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-hint"]');
        expect(label?.textContent).toBe("이벤트 ID");

        const help = hint?.textContent ?? "";
        expect(help).toContain("이벤트 이름");
        expect(help).toContain("페이지");
        expect(help).toContain("characterId");
        expect(help).toContain("순서");
        // 「고칠 수 없다」를 말해야 사용자가 이름칸으로 오해하지 않는다.
        expect(help).toMatch(/고칠 수 없|수정할 수 없/u);

        // 스크린리더가 라벨/설명을 실제로 집도록 연결돼 있어야 한다.
        const input = valueInput(root);
        expect(input.getAttribute("aria-labelledby")).toBe(label?.getAttribute("id"));
        expect(input.getAttribute("aria-describedby")).toBe(hint?.getAttribute("id"));
      });

      // ── 선택 변경 ────────────────────────────────────────────────────────────────

      it("다른 이벤트를 고르면 표시가 따라 바뀐다 — 낡은 값이 남지 않는다", () => {
        seed([gameEvent("ev_one"), gameEvent("ev_two", { x: 9 })], "ev_one");
        expect(valueInput(renderSidebar()).value).toBe("ev_one");

        editorState.set({ selectedEventId: "ev_two", selectedEventPageId: "page-1" });
        const second = renderSidebar();
        expect(valueInput(second).value).toBe("ev_two");
        expect(second.querySelector('[data-testid="event-summary-event-id-value"]')).not.toBeNull();
        // 같은 컨테이너 안에 ID 표시는 하나뿐이어야 한다(이전 렌더 잔존 금지).
        expect(second.querySelectorAll('[data-testid="event-summary-event-id-value"]').length).toBe(1);
      });

      it("선택이 없으면 ID 표시도 없다 — 빈 값이나 마지막 이벤트가 남지 않는다", () => {
        seed([gameEvent("ev_only")], null);
        expect(renderSidebar().querySelector('[data-testid="event-summary-event-id"]')).toBeNull();
      });

      // ── 복사 동작 ────────────────────────────────────────────────────────────────

      it("복사 성공은 접근 가능한 토스트로 알린다", async () => {
        seed([gameEvent(LONG_UUID_ID)]);
        const dirtyBefore = store.hasUnsavedChanges();
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const root = renderSidebar();
        const copy = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]');
        expect(copy).not.toBeNull();
        expect(copy?.getAttribute("aria-label")).toContain("이벤트 ID");
        // 눈에 보이는 글자 라벨이어야 한다 — 아이콘만 넣으면 이 저장소에는 SVG 크기 규칙이
        // 없어 8×8px 로 찍힌다(1440×900 실측).
        expect(copy?.textContent?.trim()).toBe("복사");
        copy?.dispatchEvent(new Event("click", { bubbles: true }));
        await vi.waitFor(() => {
          expect(writeText).toHaveBeenCalledWith(LONG_UUID_ID);
        });

        await vi.waitFor(() => {
          const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
          expect(alive?.textContent ?? "").toContain("복사");
          expect(alive?.className ?? "").toContain("ok");
        });
        // 복사는 읽기 동작이다 — 프로젝트를 더럽히지 않는다.
        expect(store.hasUnsavedChanges()).toBe(dirtyBefore);
      });

      it("복사 실패는 조용히 지나가지 않고 error 토스트로 알린다", async () => {
        seed([gameEvent("ev_copy_fail")]);
        // Clipboard API 없음 + execCommand 없음 → 폴백까지 실패하는 경로.
        vi.stubGlobal("navigator", {});

        const root = renderSidebar();
        root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]')
          ?.dispatchEvent(new Event("click", { bubbles: true }));

        await vi.waitFor(() => {
          const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
          expect(alive?.className ?? "").toContain("error");
          expect(alive?.getAttribute("role")).toBe("alert");
        });
      });

      // ── 이벤트 편집 모달 헤더 ────────────────────────────────────────────────────

      it("이벤트 편집 모달 헤더도 같은 id 를 읽기 전용으로 보여 준다", () => {
        const mapId = seed([gameEvent(LONG_UUID_ID)]);
        openEventEditorModal(mapId, LONG_UUID_ID);
        const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
        expect(modal).not.toBeNull();

        const input = valueInput(modal!, "event-editor");
        expect(input.value).toBe(LONG_UUID_ID);
        expect(input.getAttribute("readonly")).not.toBeNull();
        expect(input.getAttribute("disabled")).toBeNull();
        // 헤더는 48px 한 줄이라 도움말 문장을 붙일 자리가 없다 — title 이 그 역할을 한다.
        expect(input.getAttribute("title") ?? "").toContain("이벤트 ID");
        expect(readout(modal!, "event-editor").dataset.variant).toBe("chip");
      });

      it("모달 헤더 ID 상자의 change 도 이벤트를 바꾸지 않는다", () => {
        const mapId = seed([gameEvent("ev_modal_ro")]);
        openEventEditorModal(mapId, "ev_modal_ro");
        const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')!;
        const input = valueInput(modal, "event-editor");
        input.value = "ev_modal_hacked";
        input.dispatchEvent(new Event("change", { bubbles: true }));

        const project = store.getCurrent();
        expect(project.maps[mapId]?.events.map((event) => event.id)).toContain("ev_modal_ro");
        expect(project.maps[mapId]?.events.map((event) => event.id)).not.toContain("ev_modal_hacked");
      });

      // ── 기존 표면 보존 ───────────────────────────────────────────────────────────

      it("목록 호버 카드의 `ID <event.id>` 표기는 그대로다", async () => {
        const { buildEventListTooltipModel } = await import("@/editor/eventMarkerUx");
        const model = buildEventListTooltipModel(gameEvent(LONG_UUID_ID));
        expect(model.identity).toBe(LONG_UUID_ID);
        expect(model.plainText).toContain(`ID ${LONG_UUID_ID}`);
      });

      it("전역 검색은 여전히 event.id 로 이벤트를 찾는다", async () => {
        const mapId = seed([gameEvent(LONG_UUID_ID)]);
        const { searchProject } = await import("@/editor/panels/mapEventSearchModel");
        const results = searchProject({
          project: store.getCurrent(),
          selectedMapId: mapId,
          query: LONG_UUID_ID,
          scope: "all",
        });
        const hit = results.find((result) => result.kind === "mapEvent");
        expect(hit).toBeDefined();
        expect(hit?.detail).toContain(LONG_UUID_ID);
      });

      // ── 레이아웃 ─────────────────────────────────────────────────────────────────

      it("긴 값이 상자를 밀어내지 않도록 두 변형 모두 넘침 규칙을 갖는다", () => {
        // 왜 CSS 를 파일로 읽는가: 맵/모달 캔버스는 WebGL 이고 단위 테스트 DOM 에는 레이아웃
        // 엔진이 없다. 「긴 UUID 가 레이아웃을 깨지 않는다」는 약속을 검증 가능한 형태로
        // 고정할 수 있는 지점은 규칙 자체다(값이 사라지면 이 테스트가 먼저 깨진다).
        // 2026-09-11 Task 13: 카드 변형(옛 from-editor-core-part-2.css)과 칩 변형(옛 event-editor.balanced.css)은 이제 구성 요소
        // 버킷(pages*.css) 에 있다. 파일 이름 대신 각 변형의 선택자를 가진 리프 시트를 찾아 읽는다.
        const cardFile = eventSurfaceFileContaining(".event-editor input.event-id-readout-value");
        const chipFile = eventSurfaceFileContaining(".event-editor-modal-header .event-id-readout {");
        expect(cardFile, "카드 변형 규칙을 가진 이벤트 시트").toBeDefined();
        expect(chipFile, "칩 변형 규칙을 가진 이벤트 시트").toBeDefined();
        const card = readFileSync(cardFile!, "utf8");
        const chip = readFileSync(chipFile!, "utf8");

        const cardRule = card.slice(card.indexOf(".event-id-readout-value"));
        expect(card).toContain(".event-id-readout");
        // 카드 변형은 전체 값을 보여 준다 — 줄바꿈으로 감싸고 가로 스크롤을 만들지 않는다.
        expect(cardRule).toMatch(/min-width:\s*0/u);
        expect(cardRule).toMatch(/text-overflow:\s*ellipsis/u);

        const chipRule = chip.slice(chip.indexOf(".event-id-readout"));
        expect(chip).toContain(".event-editor-modal-header .event-id-readout");
        // 칩 변형은 48px 헤더 안에 갇혀야 한다 — 상한 폭 + 줄임표.
        expect(chipRule).toMatch(/max-width:/u);
        expect(chipRule).toMatch(/text-overflow:\s*ellipsis/u);
      });
    });
  });
  describe("eventPage", () => {
    isolateTimers();
    describe("eventPageNormalize", () => {
      isolateTimers();
      describe("normalizeEventPage", () => {
        it("fills the fields the event editor reads without optional chaining", () => {
          const page = normalizeEventPage({ id: "page-1", name: "첫 방문" });

          expect(page.graphic).toEqual({});
          expect(page.trigger).toEqual({ kind: "action" });
          expect(page.priority).toBe("same");
          expect(page.movement).toEqual({ type: "fixed", speed: 3, frequency: 3 });
          expect(page.conditions).toEqual([]);
          expect(page.commands).toEqual([]);
          expect(page.name).toBe("첫 방문");
        });

        it("keeps authored movement extras when only some fields are missing", () => {
          const page = normalizeEventPage({
            id: "page-2",
            name: "단골 창구",
            movement: { type: "random" } as never,
            commands: [{ kind: "text", body: "어서 오세요" }],
          });

          expect(page.movement.type).toBe("random");
          expect(page.movement.speed).toBe(3);
          expect(page.movement.frequency).toBe(3);
          expect(page.commands).toEqual([{ kind: "text", body: "어서 오세요" }]);
        });
      });
    });
    describe("eventPageTabsRich", () => {
      isolateTimers();
      let restoreFakeDom: () => void = () => undefined;
      function eventPage(id: string, overrides: Partial<EventPage> = {}): EventPage {
        return {
          id,
          name: "EV001",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
          ...overrides,
        };
      }
      function gameEvent(pages: EventPage[]): GameEvent {
        return {
          id: "event-1",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          pages,
        };
      }
      function richConditions(): EventPageCondition[] {
        return [
          { kind: "switch", switchId: "sw_0001", value: true },
          { kind: "variable", variableId: "var_0001", op: ">=", value: 3 },
          { kind: "item", itemId: "missing-item", present: true },
          { kind: "actor", actorId: "missing-actor", present: true },
          { kind: "timer", timerId: "timer1", seconds: 30 },
        ];
      }
      function renderStrip(pages: EventPage[], activePage: EventPage = pages[0]!): FakeElement {
        const strip = renderClassicPageTabStrip("map_start", gameEvent(pages), activePage);
        if (!(strip instanceof FakeElement)) throw new Error("expected FakeElement render");
        return strip;
      }
      describe("rich event page tabs", () => {
        beforeEach(() => {
          restoreFakeDom = installFakeDom();
          const project = createBlankProject();
          const firstSwitch = project.switches.find((record) => record.id === "sw_0001");
          if (firstSwitch) firstSwitch.name = "별등 의뢰 수락";
          const firstVariable = project.variables.find((record) => record.id === "var_0001");
          if (firstVariable) firstVariable.name = "별등 진행도";
          store.replace(project);
          editorState.set({ selectedEventPageId: null });
        });

        afterEach(() => {
          restoreFakeDom();
        });

        it("renders page tabs without graphic thumbnails (mockup v2 contract)", () => {
          const pages = [
            eventPage("page-1"),
            eventPage("page-2", { graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } }),
          ];
          const strip = renderStrip(pages);

          const tab1 = findByTestId(strip, "evt-page-segment-1");
          const tab2 = findByTestId(strip, "evt-page-segment-2");
          expect(tab1).not.toBeNull();
          expect(tab2).not.toBeNull();
          // 목업 v2: 탭은 번호 + 이름 + 조건 요약 + 배지만 가진다 — 썸네일은 없다.
          expect(findByTestId(tab1!, "event-page-tab-thumb")).toBeNull();
          expect(findByTestId(tab2!, "event-page-tab-thumb")).toBeNull();
          expect(tab2!.querySelector(".event-page-tab-thumb")).toBeNull();
        });

        it("renders condition badges capped at three plus an overflow counter", () => {
          const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
          const strip = renderStrip(pages);

          const tab1 = findByTestId(strip, "evt-page-segment-1");
          const tab2 = findByTestId(strip, "evt-page-segment-2");
          expect(tab1).not.toBeNull();
          expect(tab2).not.toBeNull();
          expect(findByTestId(tab1!, "event-page-tab-badges")).toBeNull();
          expect(findByTestId(tab2!, "event-page-tab-badges")).toBeNull();
        });

        it("summarizes conditions with database names in the tab tooltip", () => {
          const pages = [
            eventPage("page-1"),
            eventPage("page-2", { name: "의뢰 수락 후", conditions: richConditions() }),
          ];
          const strip = renderStrip(pages);

          const title1 = findByTestId(strip, "evt-page-segment-1")!.getAttribute("title") ?? "";
          expect(title1).toContain("페이지 1 — EV001");
          expect(title1).toContain("조건 없음");

          const title2 = findByTestId(strip, "evt-page-segment-2")!.getAttribute("title") ?? "";
          expect(title2).toContain("페이지 2 — 의뢰 수락 후");
          expect(title2).toContain("별등 의뢰 수락 · 켜짐");
          expect(title2).toContain("별등 진행도 3 이상");
          expect(title2).toContain("아이템 missing-item 보유 중");
          expect(title2).toContain("주인공 [missing-actor] 파티에 있음");
          expect(title2).toContain("타이머 1 30초 이하");
        });

        it("keeps the numeric label, testid, active class, and click selection behavior", () => {
          const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
          const strip = renderStrip(pages, pages[1]!);

          expect(strip.dataset.testid).toBe("evt-header-page-tabs");
          const tab1 = findByTestId(strip, "evt-page-segment-1")!;
          const tab2 = findByTestId(strip, "evt-page-segment-2")!;
          expect(tab1.tagName).toBe("BUTTON");
          expect(tab2.tagName).toBe("BUTTON");

          expect(tab1.querySelector(".evt-page-segment-number")?.textContent).toBe("1");
          expect(tab2.querySelector(".evt-page-segment-number")?.textContent).toBe("2");
          expect(tab1.textContent).toContain("1");
          expect(tab2.textContent).toContain("2");

          expect(tab1.className).not.toContain("active");
          expect(tab2.className).toContain("active");

          tab1.click();
          expect(editorState.get().selectedEventPageId).toBe("page-1");
          tab2.click();
          expect(editorState.get().selectedEventPageId).toBe("page-2");
        });
      });
    });
  });
  // test/eventReadability.test.ts — the naming pieces behind the event list's readability pass (2026-11-01):
  // short switch/variable names (src/editor/shortRecordName.ts) and the Korean labels a script gives its own code
  // (src/editor/script/scriptLabels.ts). Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
  describe("eventReadability", () => {
    isolateTimers();
    describe("shortRecordName", () => {
      it("drops the description written into a name and never returns an empty name", () => {
        expect(shortRecordName("레버 퍼즐 진행 단계(0~4, 올바르게 당긴 레버 수)")).toBe("레버 퍼즐 진행 단계");
        expect(shortRecordName("마을 평판 (레버 퍼즐 해결 시 +10)")).toBe("마을 평판");
        expect(shortRecordName("레버 퍼즐(3→1→4→2)을 풀어 창고 문이 열림")).toBe("레버 퍼즐을 풀어 창고 문이 열림");
        expect(shortRecordName("평판 — 마을에서의 주인공 평판 (로직은 다음 작업에서 연결)")).toBe("평판");
        expect(shortRecordName("포션 할인율 % (평판×3, 최대 30)")).toBe("포션 할인율");
        expect(shortRecordName("지금 포션 가격 = 50 × (100-할인율) / 100, 소수점 버림")).toBe("지금 포션 가격");
        expect(shortRecordName("마을 평판. 할머니 퀘스트 완료 시 +10")).toBe("마을 평판");
        expect(shortRecordName("평판")).toBe("평판");
        expect(shortRecordName("(괄호만)")).toBe("(괄호만)");
      });
    });
    describe("readScriptLabels", () => {
      it("reads trailing-comment names, @label tags, JSDoc helper labels and heading comments", () => {
        const labels = readScriptLabels([
          "// 가격 계산",
          "const pct = discountPercent(rep); // 할인율",
          "const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인",
          'const url = "http://x"; // 주소',
          "// @label A: 이미 당김",
          "// @label LEVERS: 레버들",
          "/** @label 할인된 값 */",
          "function discounted(n: number) { return n; }",
          "",
          "// 틀린 순서: 원위치",
          "if (x) {",
          "}",
        ].join("\n"));
        expect(labels.names.get("pct")).toBe("할인율");
        expect(labels.names.get("BASE")).toBe("기본 가격");
        expect(labels.names.get("MAX_OFF")).toBe("최대 할인");
        expect(labels.names.get("url")).toBe("주소");
        expect(labels.names.get("LEVERS")).toBe("레버들");
        expect(labels.names.get("discounted")).toBe("할인된 값");
        expect(labels.selfSwitches.get("A")).toBe("이미 당김");
        expect([...labels.headings.entries()]).toEqual([[2, "가격 계산"], [11, "틀린 순서: 원위치"]]);
      });

      it("does not take a comma list that does not match the declarators, nor eslint/ts comments as headings", () => {
        const labels = readScriptLabels(["const a = 1, b = 2; // 하나", "// eslint-disable-next-line", "game.wait(1);"].join("\n"));
        expect(labels.names.size).toBe(0);
        expect(labels.headings.size).toBe(0);
      });
    });
    describe("readIdentifier / josa", () => {
      it("reads known words and keeps unknown identifiers", () => {
        expect(readIdentifier("discountedPrice")).toBe("할인된 가격");
        expect(readIdentifier("discountPercent")).toBe("할인율");
        expect(readIdentifier("ORDER")).toBe("순서");
        expect(readIdentifier("ev_lever1")).toBe("레버 1");
        expect(readIdentifier("BASE_PRICE")).toBe("기본 가격");
        expect(readIdentifier("sx")).toBeUndefined();
      });

      it("picks the particle by the last syllable or digit", () => {
        expect(josa("돈", "이", "가")).toBe("돈이");
        expect(josa("개수", "이", "가")).toBe("개수가");
        expect(hasBatchim("3")).toBe(true);
        expect(hasBatchim("4")).toBe(false);
        expect(hasBatchim("「평판」")).toBe(true);
      });

      it("says branch arms the short way in the list", () => {
        expect(shortArmLabel("조건이 맞을 때")).toBe("그러면");
        expect(shortArmLabel("조건이 맞지 않을 때")).toBe("아니면");
        expect(shortArmLabel("이겼을 때")).toBe("이겼을 때");
      });
    });
  });
  // [P2] 라이브 미리보기/플로우 파생 뷰 + 크로스 컨테이너 이동.
  describe("eventScriptModernViews", () => {
    isolateTimers();
    const PAGE_BASE: Omit<EventPage, "commands"> = {
      id: "pg_test",
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
    describe("이벤트 스크립트 모던 뷰 (P2)", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("flattenScript 는 분기 라벨과 시뮬레이션 상태를 스크립트 순서로 기록한다", () => {
        const commands: Command[] = [
          { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-03", position: "left", flipHorizontally: false },
          { kind: "text", body: "안녕" },
          {
            kind: "fork",
            condition: { kind: "switch", switchId: "", value: true },
            then: [{ kind: "text", body: "참" }],
            else: [{ kind: "text", body: "거짓" }],
          },
        ];
        const steps = flattenScript(commands);
        expect(steps.map((step) => step.command.kind)).toEqual(["changeFace", "text", "fork", "text", "text"]);
        expect(steps[0]?.simState).toBeDefined();
        expect(steps[1]?.simState).toBeDefined();
        expect(steps[2]?.simState).toBeDefined();
        expect(steps[3]?.branchLabel).toBe("조건이 맞을 때");
        expect(steps[4]?.branchLabel).toBe("조건이 맞지 않을 때");
        const forkStep = steps.find((s) => s.command.kind === "fork");
        expect(forkStep?.forkTaken).toBeDefined();
      });

      it("미리보기 패널은 details 접힘 없이 무대와 스텝 조작을 바로 내건다", () => {
        const page = pageWith([{ kind: "text", body: "한 줄" }]);
        const root = renderWithFakeDom(() =>
          renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page })
        );
        const panel = findByTestId(root, "event-page-preview");
        expect(panel).not.toBeNull();
        expect((panel as unknown as { tagName?: string }).tagName?.toLowerCase()).not.toBe("details");
        expect(findByTestId(root, "event-script-live-stage")).not.toBeNull();
        expect(findByTestId(root, "event-script-live-prev")).not.toBeNull();
        expect(findByTestId(root, "event-script-live-next")).not.toBeNull();
        expect(findByTestId(root, "event-script-live-play")).not.toBeNull();
      });

      it("명령이 없으면 미리보기는 빈 안내를 내건다", () => {
        const root = renderWithFakeDom(() =>
          renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page: pageWith([]) })
        );
        expect(findByTestId(root, "event-page-preview-empty")).not.toBeNull();
        expect(findByTestId(root, "event-script-live-stage")).toBeNull();
      });

      it("플로우는 팝오버 details 가 아니라 칼럼 전체를 쓰는 보기 방식으로 렌더된다", () => {
        const page = pageWith([{ kind: "text", body: "한 줄" }]);
        const root = renderWithFakeDom(() =>
          renderEventPageFlow({ mapId: "map_start", eventId: "ev_test", page })
        );
        // 예전 도구 팝오버 아코디언(`event-script-flowchart`)은 미리보기 위에 겹쳐 떴다 — 이제 없다.
        expect(findByTestId(root, "event-script-flowchart")).toBeNull();
        expect(findByTestId(root, "event-page-flow")).not.toBeNull();
        expect(findByTestId(root, "event-flow-node-text")).not.toBeNull();
      });

      it("플로우는 fork/choices 분기를 하위 컬럼으로 렌더한다", () => {
        const root = renderWithFakeDom(() =>
          renderEventPageFlow({
            mapId: "map_start",
            eventId: "ev_test",
            page: pageWith([
              {
                kind: "choices",
                options: [
                  { text: "예", branch: [{ kind: "text", body: "긍정" }] },
                  { text: "아니오", branch: [] },
                ],
              },
            ]),
          })
        );
        const flow = findByTestId(root, "event-flowchart-body");
        expect(flow).not.toBeNull();
        const labels = flow ? flow.querySelectorAll(".event-flow-branch-label").map((node) => node.textContent) : [];
        expect(labels).toContain("예");
        expect(labels).toContain("아니오");
        expect(flow?.querySelectorAll(".event-flow-empty").length).toBe(1);
      });
    });
    describe("크로스 컨테이너 명령 이동 (P2)", () => {
      it("isContainerInsideCommand 는 자기 분기 안 이동만 참이다", () => {
        expect(isContainerInsideCommand([2], [2, FORK_THEN_BRANCH_INDEX])).toBe(true);
        expect(isContainerInsideCommand([2], [1, FORK_THEN_BRANCH_INDEX])).toBe(false);
        expect(isContainerInsideCommand([2, FORK_THEN_BRANCH_INDEX, 0], [])).toBe(false);
        expect(isContainerInsideCommand([0], [0])).toBe(false);
      });

      it("moveCommandBetweenLists 는 루트 → fork then 분기 이동을 수행한다", () => {
        const commands: Command[] = [
          { kind: "text", body: "이동 대상" },
          {
            kind: "fork",
            condition: { kind: "switch", switchId: "", value: true },
            then: [{ kind: "text", body: "기존" }],
          },
        ];
        const targetList = resolveCommandListAtPath(commands, [1, FORK_THEN_BRANCH_INDEX], { missingBranches: "create" });
        expect(targetList).not.toBeNull();
        if (!targetList) return;
        expect(moveCommandBetweenLists(commands, 0, targetList, Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(commands.length).toBe(1);
        expect(commands[0]?.kind).toBe("fork");
        const fork = commands[0];
        if (fork?.kind !== "fork") return;
        expect(fork.then.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["기존", "이동 대상"]);
      });

      it("같은 리스트 이동은 기존 재정렬 규칙(클램프)을 따른다", () => {
        const list: Command[] = [
          { kind: "text", body: "A" },
          { kind: "text", body: "B" },
          { kind: "text", body: "C" },
        ];
        expect(moveCommandBetweenLists(list, 0, list, 99)).toBe(true);
        expect(list.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["B", "C", "A"]);
      });
    });
  });
  describe("eventSpawnNumericProbe", () => {
    isolateTimers();
    let restore: () => void;
    beforeEach(() => { restore = installFakeDom(); store.replace(createCaptureProject()); });
    afterEach(() => restore());
    describe("spawn numeric controls through the gate DOM", () => {
      it.each(["x", "y", "w", "h"] as const)("rejects invalid %s edits and accumulates valid commits", key => {
        const initial = MINIMAL_COMMANDS.spawnFieldEnemy;
        if (initial.kind !== "spawnFieldEnemy") throw new Error("Wrong fixture");
        let current: Command = structuredClone(initial);
        const replaceCommand = vi.fn((_path: readonly number[], command: Command) => { current = command; });
        const unexpected = () => { throw new Error("Unexpected action"); };
        const root = fieldSpawnBody({ path: [0], getCurrentCommand: () => current, actions: {
          replaceCommand, addCommand: unexpected, insertCommand: unexpected, deleteCommand: unexpected,
          moveCommand: unexpected, moveCommandTo: unexpected,
        } }, initial);
        if (!(root instanceof FakeElement)) throw new Error("Expected gate DOM");
        const input = findByTestId(root, `event-command-spawn-area-${key}`);
        if (!input) throw new Error("Missing numeric control");
        const invalid = vi.fn();
        input.addEventListener("invalid", invalid);
        for (const raw of ["", "NaN", "Infinity", "1e309", "0x10", "2.5"]) {
          input.value = raw;
          input.dispatchEvent(new Event("change"));
          expect(current).toEqual(initial);
          expect(replaceCommand).not.toHaveBeenCalled();
        }
        expect(invalid).toHaveBeenCalledTimes(6);
        for (const value of [3, 4]) {
          input.value = String(value);
          input.dispatchEvent(new Event("change"));
          expect(current).toEqual({ ...initial, spawn: { ...initial.spawn, area: { ...initial.spawn.area, [key]: value } } });
        }
        expect(replaceCommand).toHaveBeenCalledTimes(2);
      });

      it("existing native numeric consumers retain their number instead of the missing-API fallback", () => {
        const initial = MINIMAL_COMMANDS.changeFactionStance;
        if (initial.kind !== "changeFactionStance") throw new Error("Wrong fixture");
        const run = probeCommandControls(initial);
        expect(run.results).toHaveLength(4);
        for (const result of run.results) {
          expect(result.outcome).toBe("commit");
          expect(result.committed).toMatchObject({ value: result.key === "event-command-faction-value" ? Number(result.applied) : initial.value });
        }
      });

      it("the actual commit probe commits all seven fields without exceptions or no-commit exemptions", () => {
        const run = probeCommandControls(MINIMAL_COMMANDS.spawnFieldEnemy);
        expect(run.error).toBeUndefined();
        expect(run.results).toHaveLength(7);
        expect(run.results.map(result => result.outcome)).toEqual(Array(7).fill("commit"));
        for (const result of run.results) {
          expect(result.errorMessage).toBeUndefined();
          expect(result.callCount).toBe(1);
        }
      });
    });
  });
});

describe("panelsEventEditorSuite12", () => {
  isolateTimers();
  describe("eventValidationFakeNavigation", () => {
    isolateTimers();
    it("uses the shared navigation contract in the lightweight rendered host", () => {
      const restore = installFakeDom();
      const errors = vi.spyOn(console, "error");
      try {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        if (!map) throw new Error("Missing map");
        map.events = [{ id: "fake-nav", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
          id: "p1", name: "page", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: "missing-map", x: 0, y: 0 }],
        }] }];
        store.replaceProject(project);
        editorState.set({ currentMapId: mapId, selectedEventId: "fake-nav", selectedEventPageId: "p1" });
        openEventEditorModal(mapId, "fake-nav");
        expect(errors.mock.calls).toEqual([]);
        expect(document.querySelector('[data-testid="event-editor-modal"]')?.isConnected).toBe(true);
        expect(document.querySelectorAll("[data-cmd-path]").length).toBeGreaterThan(0);
        expect(navigateToEventCommand(mapId, "fake-nav", "p1", [0])).toBe(true);
        expect(selectedCommandPath()).toEqual([0]);
        navigateToEventDraftIssue({ pageId: "p1", commandPath: [0], code: "reference.map.missing", severity: "error", message: "" });
        expect(document.querySelector('[data-testid="event-command-transfer"]')?.className).toContain("selected");
      } finally {
        document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
        errors.mockRestore();
        restore();
      }
    });
  });
  describe("fakeDom", () => {
    isolateTimers();
    describe("fakeDomAudioContract", () => {
      isolateTimers();
      describe("fake DOM audio control contracts", () => {
        let restore: () => void;
        const globalNames = ["MutationObserver", "requestAnimationFrame", "cancelAnimationFrame"] as const;
        let previousGlobals: PropertyDescriptor[];

        beforeEach(() => {
          previousGlobals = globalNames.map(name => Object.getOwnPropertyDescriptor(globalThis, name) ?? {});
          restore = installFakeDom({ animationFrames: "manual" });
        });
        afterEach(() => { restore(); });

        it("keeps select options, index and value consistent", () => {
          const select = document.createElement("select");
          const first = document.createElement("option");
          const second = document.createElement("option");
          first.value = "a"; second.value = "b";
          select.append(first, second);
          expect(Array.from(select.options)).toEqual([first, second]);
          expect(select.selectedIndex).toBe(0);
          expect(select.value).toBe("a");
          select.value = "b";
          expect(select.selectedIndex).toBe(1);
          expect(Array.from(select.selectedOptions)).toEqual([second]);
          expect(second.index).toBe(1);
          select.selectedIndex = 0;
          expect(select.value).toBe("a");
          select.selectedIndex = -1;
          expect(select.value).toBe("");
          expect(select.selectedIndex).toBe(-1);
          select.value = "b";
          expect(select.selectedIndex).toBe(1);
        });

        it("distinguishes elements, select controls and text nodes for observers", () => {
          const container = document.createElement("div");
          const select = document.createElement("select");
          const text = document.createTextNode("label");
          expect(container).toBeInstanceOf(Element);
          expect(select).toBeInstanceOf(HTMLSelectElement);
          expect(container).not.toBeInstanceOf(HTMLSelectElement);
          expect(text).not.toBeInstanceOf(Element);
        });

        it("preserves the default frame capability while allowing idle cancellation", () => {
          restore();
          const previousFrame = globalThis.requestAnimationFrame;
          restore = installFakeDom();
          expect(globalThis.requestAnimationFrame).toBe(previousFrame);
          expect(() => cancelAnimationFrame(0)).not.toThrow();
        });

        it("delivers filtered attribute records with requested old values", () => {
          const element = document.createElement("div");
          const observer = new MutationObserver(() => undefined);
          observer.observe(element, { attributes: true, attributeFilter: ["data-state"], attributeOldValue: true });
          element.setAttribute("ignored", "value");
          element.setAttribute("data-state", "playing");
          element.removeAttribute("data-state");
          expect(observer.takeRecords().map(record => [record.type, record.attributeName, record.oldValue]))
            .toEqual([["attributes", "data-state", null], ["attributes", "data-state", "playing"]]);
          observer.disconnect();
        });

        it("supports combined child, class and character data observations", () => {
          const element = document.createElement("div");
          const observer = new MutationObserver(() => undefined);
          observer.observe(element, { childList: true, subtree: true, attributes: true, characterData: true, characterDataOldValue: true });
          const text = document.createTextNode("before");
          element.append(text);
          text.textContent = "after";
          element.setAttribute("class", "active");
          expect(observer.takeRecords().map(record => [record.type, record.oldValue]))
            .toEqual([["childList", null], ["characterData", "before"], ["attributes", null]]);
          observer.disconnect();
        });

        it("provides cancellable animation frames without a wall-clock timer", () => {
          const frames: number[] = [];
          const cancelled = requestAnimationFrame(time => { frames.push(time); });
          requestAnimationFrame(time => { frames.push(time); });
          cancelAnimationFrame(cancelled);
          cancelAnimationFrame(0);
          expect(frames).toEqual([]);
          flushFakeAnimationFrames(123);
          expect(frames).toEqual([123]);
        });

        it("supports idle audio teardown without claiming successful playback", () => {
          const audio = document.createElement("audio");
          audio.setAttribute("src", "https://example.invalid/preview.ogg");
          let playing = 0;
          audio.addEventListener("playing", () => { playing += 1; });
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          expect(audio.paused).toBe(true);
          expect(audio.currentTime).toBe(0);
          expect(audio.duration).toBeNaN();
          expect(audio.getAttribute("src")).toBeNull();
          expect(playing).toBe(0);
        });

        it("delivers batched subtree child-list records after attachment and removal", async () => {
          const wrapper = document.createElement("section");
          const preview = document.createElement("div");
          wrapper.append(preview);
          let delivered = false;
          const recordsReady = new Promise<MutationRecord[]>(resolve => {
            const observer = new MutationObserver(records => {
              delivered = true;
              observer.disconnect();
              resolve(records);
            });
            observer.observe(document.body, { childList: true, subtree: true });
          });
          document.body.append(wrapper);
          preview.remove();
          expect(delivered).toBe(false);
          const records = await recordsReady;
          const [attachment, removal] = records;
          if (!attachment || !removal) throw new Error("Expected attachment and removal records");
          expect(records.map(record => record.type)).toEqual(["childList", "childList"]);
          expect(records.map(record => record.target)).toEqual([document.body, wrapper]);
          expect(Array.from(attachment.addedNodes)).toEqual([wrapper]);
          expect(Array.from(removal.removedNodes)).toEqual([preview]);
          expect(preview.isConnected).toBe(false);
          expect(preview.parentNode).toBeNull();
        });

        it("reports replacement as one mutation and disconnect discards queued records", () => {
          const parent = document.createElement("div");
          const old = document.createElement("span");
          parent.append(old);
          const observer = new MutationObserver(() => { throw new Error("Disconnected observer fired"); });
          observer.observe(parent, { childList: true });
          parent.replaceChildren("next");
          const records = observer.takeRecords();
          expect(records).toHaveLength(1);
          const replacement = records[0];
          if (!replacement) throw new Error("Expected a replacement record");
          expect(Array.from(replacement.removedNodes)).toEqual([old]);
          expect(Array.from(replacement.addedNodes)).toEqual(Array.from(parent.childNodes));
          expect(observer.takeRecords()).toEqual([]);
          parent.replaceChildren();
          observer.disconnect();
          expect(observer.takeRecords()).toEqual([]);
          parent.append("unobserved");
          expect(observer.takeRecords()).toEqual([]);
        });

        it("reports an adopted descendant replacement without leaving duplicate ownership", () => {
          const parent = document.createElement("div");
          const wrapper = document.createElement("section");
          const preview = document.createElement("audio");
          wrapper.append(preview);
          parent.append(wrapper);
          const observer = new MutationObserver(() => undefined);
          observer.observe(parent, { childList: true, subtree: true });

          wrapper.replaceWith(preview);

          expect(Array.from(parent.childNodes)).toEqual([preview]);
          expect(wrapper.childNodes).toHaveLength(0);
          expect(preview.parentNode).toBe(parent);
          expect(wrapper.parentNode).toBeNull();
          const records = observer.takeRecords();
          expect(records.map(record => [record.target, Array.from(record.addedNodes), Array.from(record.removedNodes)]))
            .toEqual([[wrapper, [], [preview]], [parent, [preview], [wrapper]]]);
          observer.disconnect();
        });

        it("limits notifications to the observed target unless subtree is requested", () => {
          const parent = document.createElement("div");
          const child = document.createElement("section");
          parent.append(child);
          const observer = new MutationObserver(() => { throw new Error("Unrelated mutation delivered"); });
          observer.observe(parent, { childList: true });
          child.append("nested");
          document.body.append("outside");
          expect(observer.takeRecords()).toEqual([]);
          observer.disconnect();
        });

        it("restores lifecycle globals and discards pending work on teardown", () => {
          const observer = new MutationObserver(() => { throw new Error("Observer leaked after teardown"); });
          observer.observe(document.body, { childList: true });
          document.body.append("pending");
          requestAnimationFrame(() => { throw new Error("Frame leaked after teardown"); });
          restore();
          expect(observer.takeRecords()).toEqual([]);
          flushFakeAnimationFrames();
          globalNames.forEach((name, index) => {
            expect(Object.getOwnPropertyDescriptor(globalThis, name) ?? {}).toEqual(previousGlobals[index]);
          });
        });

        it("appends mixed strings and elements as ordered child nodes", () => {
          const button: HTMLElement = document.createElement("button");
          const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          button.append("before", icon, "after");

          expect(Array.from(button.childNodes, node => node.textContent)).toEqual(["before", "", "after"]);
          expect(button.textContent).toBe("beforeafter");
          expect(Array.from(button.children)).toEqual([icon]);
          expect(button.childElementCount).toBe(1);
          for (const node of button.childNodes) expect(node.parentNode).toBe(button);
          expect(button.childNodes[0]).toBeInstanceOf(Node);
          expect(button.childNodes[0]).not.toBeInstanceOf(HTMLElement);
        });

        it("replaces textContent and old children without retaining stale labels or parents", () => {
          const button: HTMLElement = document.createElement("button");
          const oldIcon = document.createElement("span");
          button.textContent = "old";
          button.append(oldIcon);
          const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          button.replaceChildren(icon, "next");

          expect(button.textContent).toBe("next");
          expect(Array.from(button.children)).toEqual([icon]);
          expect(button.childNodes).toHaveLength(2);
          expect(oldIcon.parentNode).toBeNull();
          const label = button.childNodes[1];
          expect(label?.parentNode).toBe(button);
          button.replaceChildren();
          expect(button.textContent).toBe("");
          expect(button.childNodes).toHaveLength(0);
          expect(icon.parentNode).toBeNull();
          expect(label?.parentNode).toBeNull();
        });

        it("clears textContent even when replacing with no children", () => {
          const button: HTMLElement = document.createElement("button");
          button.textContent = "old";
          button.replaceChildren();
          expect(button.textContent).toBe("");
        });

        it("moves existing nodes rather than duplicating them when appending or replacing", () => {
          const previous: HTMLElement = document.createElement("div");
          const next: HTMLElement = document.createElement("div");
          const icon = document.createElement("span");
          previous.append(icon);
          next.append(icon, icon);
          expect(previous.childNodes).toHaveLength(0);
          expect(Array.from(next.childNodes)).toEqual([icon]);
          previous.replaceChildren(icon);
          expect(next.childNodes).toHaveLength(0);
          expect(Array.from(previous.childNodes)).toEqual([icon]);
          expect(icon.parentNode).toBe(previous);
        });
      });
    });
    describe("fakeDomImageGlobal", () => {
      isolateTimers();
      describe("fake DOM Image global", () => {
        let preInstallImage: PropertyDescriptor | undefined;
        let restore: (() => void) | null = null;

        beforeEach(() => {
          preInstallImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
          restore = installFakeDom();
        });

        afterEach(() => {
          restore?.();
          restore = null;
        });

        it("constructs an IMG-shaped FakeElement without throwing", () => {
          const image = new Image();
          expect(image).toBeInstanceOf(FakeElement);
          expect(image.tagName).toBe("IMG");
          expect(image.naturalWidth).toBe(0);
          expect(image.naturalHeight).toBe(0);
        });

        it("dispatches error exactly once when src is assigned", async () => {
          const image = new Image();
          let errorCount = 0;
          let loadCount = 0;
          const fired = new Promise<void>((resolve) => {
            image.addEventListener("error", () => {
              errorCount += 1;
              resolve();
            });
          });
          image.addEventListener("load", () => {
            loadCount += 1;
          });
          image.src = "https://example.invalid/sheet.png";
          expect(errorCount).toBe(0);
          await fired;
          expect(errorCount).toBe(1);
          expect(loadCount).toBe(0);
        });

        it("lets getAutoKeyedDataUrl resolve to the original url instead of rejecting", async () => {
          const url = "https://example.invalid/fake-dom-auto-key.png";
          await expect(getAutoKeyedDataUrl(url)).resolves.toBe(url);
        });

        it("restores the pre-install Image global on teardown", () => {
          expect(Object.getOwnPropertyDescriptor(globalThis, "Image")).toBeDefined();
          restore?.();
          restore = null;
          const after = Object.getOwnPropertyDescriptor(globalThis, "Image");
          expect(after?.value).toBe(preInstallImage?.value);
          expect("Image" in globalThis).toBe(preInstallImage !== undefined);
        });
      });
    });
    describe("fakeDomInsertBefore", () => {
      isolateTimers();
      describe("acceptance checklist DOM insertion", () => {
        it("moves an existing row without duplication and supports append and self insertion", () => {
          const list = new FakeNode(), first = new FakeNode(), second = new FakeNode();
          list.append(first, second);
          expect(list.insertBefore(second, first)).toBe(second);
          expect(list.childNodes).toEqual([second, first]);
          list.insertBefore(second, second);
          expect(list.childNodes).toEqual([second, first]);
          list.insertBefore(second, null);
          expect(list.childNodes).toEqual([first, second]);
          expect(second.parentNode).toBe(list);
        });
        it("detaches a row from its previous list and rejects a foreign reference", () => {
          const previous = new FakeNode(), next = new FakeNode(), row = new FakeNode(), foreign = new FakeNode();
          previous.append(row);
          next.insertBefore(row, null);
          expect(previous.childNodes).toEqual([]);
          expect(next.childNodes).toEqual([row]);
          expect(row.parentNode).toBe(next);
          expect(() => next.insertBefore(row, foreign)).toThrow();
          expect(next.childNodes).toEqual([row]);
        });
      });
    });
    describe("fakeDomNumericInput", () => {
      isolateTimers();
      function numeric(attrs: Record<string, string> = {}) {
        const input = new FakeElement("input");
        for (const [key, value] of Object.entries({ type: "number", ...attrs })) input.setAttribute(key, value);
        return input;
      }
      describe("fake DOM number-input fidelity", () => {
        it.each(["", " ", "NaN", "Infinity", "1e309", "0x10", "+1", "1.", "12px"])("rejects non-HTML number %j", value => {
          const input = numeric({ required: "" });
          input.value = value;
          expect(input.valueAsNumber).toBeNaN();
          const invalid = vi.fn((event: Event) => { expect(event.cancelable).toBe(true); expect(event.bubbles).toBe(false); event.preventDefault(); });
          input.addEventListener("invalid", invalid);
          expect(input.reportValidity()).toBe(false);
          expect(invalid).toHaveBeenCalledOnce();
        });

        it.each([["0", 0], ["-3", -3], [".5", 0.5], ["1.25", 1.25], ["2e2", 200]] as const)("converts %s without truncating", (raw, value) => {
          const input = numeric({ step: "any" });
          input.value = raw;
          expect(input.valueAsNumber).toBe(value);
          expect(input.reportValidity()).toBe(true);
        });

        it("checks required, bounds and step rather than reporting success unconditionally", () => {
          const input = numeric({ min: "1", max: "5", step: "2", required: "" });
          for (const value of ["", "0", "2", "6", "1.5"]) {
            input.value = value;
            expect(input.checkValidity(), value).toBe(false);
          }
          for (const value of ["1", "3", "5"]) {
            input.value = value;
            expect(input.checkValidity(), value).toBe(true);
          }
          input.value = "";
          input.removeAttribute("required");
          expect(input.reportValidity()).toBe(true);
          input.setAttribute("required", "");
          input.disabled = true;
          expect(input.reportValidity()).toBe(true);
        });

        it("uses the default integer step and value-attribute step base", () => {
          const input = numeric({ value: "0.5" });
          input.value = "1.5";
          expect(input.checkValidity()).toBe(true);
          input.value = "1";
          expect(input.checkValidity()).toBe(false);
          input.removeAttribute("value");
          expect(input.checkValidity()).toBe(true);
        });

        it("recognizes property-authored number types but not text inputs", () => {
          const input = new FakeElement("input");
          input.value = "3";
          expect(input.valueAsNumber).toBeNaN();
          input.type = "number";
          expect(input.valueAsNumber).toBe(3);
        });
      });
    });
    describe("fakeDomSelectContracts", () => {
      isolateTimers();
      let restore = (): void => {};
      afterEach(() => { vi.restoreAllMocks(); restore(); });
      describe("fake DOM select/adoption contracts", () => {
        function documentForTest(): Document {
          restore = installFakeDom();
          return document;
        }

        function fixture() {
          const doc = documentForTest();
          const select = doc.createElement("select");
          const first = doc.createElement("option");
          first.value = "first";
          const group = doc.createElement("optgroup");
          const second = doc.createElement("option");
          second.value = "second";
          group.append(second);
          select.append(first, group);
          return { doc, select, first, group, second };
        }

        it("flattens optgroups and aligns value, selectedIndex, selected and option.index", () => {
          const { select, first, second, group } = fixture();
          expect(Array.from(select.options)).toEqual([first, second]);
          expect([select.value, select.selectedIndex, first.index, second.index]).toEqual(["first", 0, 0, 1]);
          select.value = "second";
          expect([select.selectedIndex, first.selected, second.selected]).toEqual([1, false, true]);
          select.prepend(group);
          expect([select.value, select.selectedIndex, second.index, first.index]).toEqual(["second", 0, 0, 1]);
          select.selectedIndex = first.index;
          expect([select.value, first.selected, second.selected]).toEqual(["first", true, false]);
        });

        it("clears invalid selections, chooses one duplicate value, and recovers on insertion", () => {
          const { select, first, second, doc } = fixture();
          second.value = first.value;
          select.value = first.value;
          expect([select.selectedIndex, first.selected, second.selected]).toEqual([0, true, false]);
          select.value = "missing";
          expect([select.value, select.selectedIndex, first.selected, second.selected]).toEqual(["", -1, false, false]);
          select.append(doc.createElement("option"));
          expect(select.selectedIndex).toBe(0);
          select.selectedIndex = 99;
          expect([select.value, select.selectedIndex]).toEqual(["", -1]);
          select.selectedIndex = -1;
          expect(select.selectedIndex).toBe(-1);
        });

        it("honors selected options, disabled defaults and removal of the selected optgroup", () => {
          const { doc, select, first, second, group } = fixture();
          second.selected = true;
          expect([select.value, first.selected, second.selected]).toEqual(["second", false, true]);
          group.remove();
          expect([select.value, select.selectedIndex, second.index]).toEqual(["first", 0, 0]);
          first.disabled = true;
          const disabledGroup = doc.createElement("optgroup");
          disabledGroup.disabled = true;
          disabledGroup.append(doc.createElement("option"));
          select.replaceChildren(first, disabledGroup, group);
          first.selected = false;
          expect(select.value).toBe("second");
          const chosen = doc.createElement("option");
          chosen.value = "chosen";
          chosen.setAttribute("selected", "");
          select.append(chosen);
          expect([select.value, select.selectedIndex, second.selected]).toEqual(["chosen", 3, false]);
        });

        it("uses option text as fallback value and label, preserving explicit empty values", () => {
          const doc = documentForTest();
          const option = doc.createElement("option");
          option.textContent = "  Text\n label  ";
          expect([option.value, option.label]).toEqual(["Text label", "Text label"]);
          option.setAttribute("label", "Display");
          option.value = "";
          expect([option.value, option.label]).toEqual(["", "Display"]);
          option.removeAttribute("value");
          option.removeAttribute("label");
          expect([option.value, option.label]).toEqual(["Text label", "Text label"]);
        });

        it("adopts into enhanced wrappers and unwraps without duplicate ownership", () => {
          const { doc, select } = fixture();
          const host = doc.createElement("div"), wrapper = doc.createElement("span"), tail = doc.createElement("button");
          host.append(select, tail);
          host.insertBefore(wrapper, select);
          wrapper.append(select);
          expect(Array.from(host.childNodes)).toEqual([wrapper, tail]);
          expect(Array.from(wrapper.childNodes)).toEqual([select]);
          host.insertBefore(select, wrapper);
          wrapper.remove();
          expect(Array.from(host.childNodes)).toEqual([select, tail]);
          expect(wrapper.childNodes.length).toBe(0);
          expect(wrapper.parentNode).toBeNull();
          host.prepend(tail, select);
          expect(Array.from(host.childNodes)).toEqual([tail, select]);
          host.append(tail, tail);
          expect(Array.from(host.childNodes)).toEqual([select, tail]);
        });

        it("replaces with adopted siblings and descendants, including self replacement", () => {
          const doc = documentForTest();
          const host = doc.createElement("div"), first = doc.createElement("span"), middle = doc.createElement("span"), last = doc.createElement("span");
          host.append(first, middle, last);
          middle.replaceWith(last, first, middle);
          expect(Array.from(host.childNodes)).toEqual([last, first, middle]);
          const inner = doc.createElement("select");
          middle.append(inner);
          middle.replaceWith(inner);
          expect(Array.from(host.childNodes)).toEqual([last, first, inner]);
          expect(middle.parentNode).toBeNull();
          expect(middle.childNodes.length).toBe(0);
        });

        it("clears parent links on removal, text replacement and replaceChildren", () => {
          const { doc, select } = fixture();
          const host = doc.createElement("div");
          host.append(select);
          expect(host.removeChild(select)).toBe(select);
          expect(select.parentNode).toBeNull();
          expect(() => host.removeChild(select)).toThrow();
          host.append(select);
          host.textContent = "replacement";
          expect(select.parentNode).toBeNull();
          expect(() => host.insertBefore(doc.createElement("span"), select)).toThrow();
          host.replaceChildren(select);
          expect(host.textContent).toBe("");
          host.replaceChildren();
          expect(select.parentNode).toBeNull();
          expect(host.textContent).toBe("");
        });
      });
      it("matches Happy DOM for grouped selection, wrapper adoption and cleanup", () => {
        // Happy DOM's duplicate-value, label and self-replacement implementations differ
        // from browsers. Those edge assertions above were checked against Firefox instead.
        function trace(doc: Document) {
          const host = doc.createElement("div"), wrapper = doc.createElement("span");
          const select = doc.createElement("select"), group = doc.createElement("optgroup");
          const first = doc.createElement("option"), second = doc.createElement("option");
          first.value = "first"; second.value = "second";
          group.append(second); select.append(first, group); host.append(select);
          const initial = [select.value, select.selectedIndex, first.index, second.index];
          select.value = "second";
          const changed = [select.value, select.selectedIndex, first.selected, second.selected];
          host.insertBefore(wrapper, select); wrapper.append(select);
          const wrapped = [host.children.length, wrapper.children.length, select.parentElement === wrapper];
          host.insertBefore(select, wrapper); wrapper.remove();
          const unwrapped = [host.children.length, wrapper.children.length, wrapper.parentNode === null];
          host.textContent = "";
          return { initial, changed, wrapped, unwrapped, detached: select.parentNode === null };
        }
        restore = installFakeDom();
        expect(trace(document)).toEqual(trace(new Window().document as unknown as Document));
      });
      it("recognizes only SELECT elements and exposes current selectedOptions", () => {
        restore = installFakeDom();
        expect(document.createElement("div") instanceof HTMLSelectElement).toBe(false);
        expect(new FakeElement("select") instanceof HTMLSelectElement).toBe(true);
        const select = document.createElement("select");
        const first = document.createElement("option"), second = document.createElement("option");
        const group = document.createElement("optgroup");
        group.append(second);
        select.append(first, group);
        expect(Array.from(select.selectedOptions)).toEqual([first]);
        select.selectedIndex = 1;
        expect(Array.from(select.selectedOptions)).toEqual([second]);
        select.selectedIndex = -1;
        expect(Array.from(select.selectedOptions)).toEqual([]);
      });
      it("runs real select refresh, menu selection and disposal without wrapping the dialog root", async () => {
        restore = installFakeDom();
        // Geometry is a fixture; menu construction, selection, events and cleanup are real.
        Object.defineProperty(document, "documentElement", { value: { clientWidth: 800, clientHeight: 600 } });
        const host = document.createElement("section"), select = document.createElement("select");
        const first = document.createElement("option"), second = document.createElement("option");
        first.value = "first"; second.value = "second";
        first.textContent = "First"; second.textContent = "Second";
        select.append(first, second);
        host.append(select);
        document.body.append(host);
        const controller = installEventEditorCustomSelects(host);
        let focusTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          expect(Array.from(document.body.children)).toEqual([host]);
          expect(host.querySelectorAll("select")).toHaveLength(1);
          expect(host.querySelectorAll(".event-custom-select-trigger")).toHaveLength(1);
          expect(select.parentElement?.parentElement).toBe(host);
          select.selectedIndex = 1;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          expect(host.querySelector(".event-custom-select-value")?.textContent).toBe(second.textContent);
          controller.refresh();
          expect(host.querySelectorAll("select")).toHaveLength(1);
          const trigger = host.querySelector<HTMLButtonElement>(".event-custom-select-trigger")!;
          trigger.click();
          const rows = host.querySelectorAll<HTMLButtonElement>(".event-custom-select-option");
          expect(rows).toHaveLength(2);
          expect(rows[1]?.getAttribute("aria-selected")).toBe("true");
          const events: string[] = [];
          host.addEventListener("input", () => events.push("input"));
          host.addEventListener("change", () => events.push("change"));
          const focus = trigger.focus.bind(trigger);
          const focused = new Promise<void>((resolve, reject) => {
            focusTimeout = setTimeout(() => reject(new Error("Menu selection did not restore focus")), 1000);
            vi.spyOn(trigger, "focus").mockImplementation((options) => { focus(options); resolve(); });
          });
          rows[0]!.click();
          expect([select.value, select.selectedIndex]).toEqual(["first", 0]);
          expect(events).toEqual(["input", "change"]);
          expect(host.querySelector(".event-custom-select-value")?.textContent).toBe(first.textContent);
          expect(host.querySelector(".event-custom-select-popover")).toBeNull();
          await focused;
          expect(document.activeElement).toBe(trigger);
        } finally {
          clearTimeout(focusTimeout);
          controller.dispose();
        }
        expect(Array.from(host.children)).toEqual([select]);
        expect(select.getAttribute("aria-hidden")).toBeNull();
        expect(select.dataset.eventCustomSelect).toBeUndefined();
        expect((select as unknown as FakeElement).hasListener("change")).toBe(false);
        expect((host as unknown as FakeElement).hasListener("scroll")).toBe(false);
        host.remove();
        expect(document.body.children).toHaveLength(0);
      });
      it("keeps real acceptance checklist row identity while reordering, removing and clearing", () => {
        restore = installFakeDom();
        const checklist = createAiStickyChecklist();
        const snapshot: AcceptanceSnapshot = { id: "contract", goal: "fixture", status: "working", items: [
          { id: "first", title: "first", status: "working", evidence: [] },
          { id: "second", title: "second", status: "pending", evidence: [] },
        ] };
        try {
          checklist.update(snapshot);
          const rows = Array.from(checklist.root.querySelectorAll<HTMLElement>(".ai-sticky-item"));
          expect(rows.map(row => row.dataset.itemId)).toEqual(["first", "second"]);
          // Input order cannot override working-before-pending priority.
          checklist.update({ ...snapshot, items: [...snapshot.items].reverse() });
          const priorityRows = Array.from(checklist.root.querySelectorAll(".ai-sticky-item"));
          expect(priorityRows).toHaveLength(2);
          expect(priorityRows[0]).toBe(rows[0]);
          expect(priorityRows[1]).toBe(rows[1]);
          // Swap priorities in the original input order: the existing keyed rows must move.
          checklist.update({ ...snapshot, items: [
            { ...snapshot.items[0]!, status: "pending" },
            { ...snapshot.items[1]!, status: "working" },
          ] });
          const reordered = Array.from(checklist.root.querySelectorAll(".ai-sticky-item"));
          expect(reordered).toEqual([...rows].reverse());
          expect(reordered[0]).toBe(rows[1]);
          expect(reordered[1]).toBe(rows[0]);
          checklist.update({ ...snapshot, items: [snapshot.items[1]!] });
          expect(rows[0]!.parentNode).toBeNull();
          expect(Array.from(checklist.root.querySelectorAll(".ai-sticky-item"))).toEqual([rows[1]]);
          checklist.update(null);
          expect(rows[1]!.parentNode).toBeNull();
          expect(checklist.root.isConnected).toBe(false);
          expect(document.body.children).toHaveLength(0);
        } finally {
          checklist.dispose();
        }
      });
    });
  });
  describe("generatedPictureAsset", () => {
    isolateTimers();
    const PNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
    describe("insertGeneratedPictureAsset", () => {
      it("dataUrl 그림을 uploaded picture 로 넣고 id 를 돌려준다", () => {
        const project = createBlankProject();
        const before = Object.keys(project.assets.uploaded).length;
        const id = insertGeneratedPictureAsset(project, { name: "달빛 창가", dataUrl: PNG });
        expect(id.length).toBeGreaterThan(0);
        expect(project.assets.uploaded[id]?.kind).toBe("picture");
        expect(project.assets.uploaded[id]?.dataUrl).toBe(PNG);
        expect(project.assets.uploaded[id]?.name).toBe("달빛 창가");
        expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "picture")).toBe(true);
        expect(Object.keys(project.assets.uploaded).length).toBe(before + 1);
      });

      it("kind 를 주면 그 kind 로 저장한다", () => {
        const project = createBlankProject();
        const faceId = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
        expect(project.assets.uploaded[faceId]?.kind).toBe("faceset");
        expect(project.resourceProfiles.some((profile) => profile.assetId === faceId && profile.kind === "faceset")).toBe(true);
        const titleId = insertGeneratedPictureAsset(project, { name: "타이틀", dataUrl: PNG, kind: "title" });
        expect(project.assets.uploaded[titleId]?.kind).toBe("title");
        const backdropId = insertGeneratedPictureAsset(project, { name: "화산 동굴", dataUrl: PNG, kind: "backdrop" });
        expect(project.assets.uploaded[backdropId]?.kind).toBe("backdrop");
        expect(backdropId).toContain("backdrop_img");
      });

      it("faceset 생성 id 는 통짜 초상 판정을 받는다", () => {
        const project = createBlankProject();
        const id = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
        expect(faceDisplayModeOf(id)).not.toBe("chip");
      });

      it("그림 dataUrl 이 아니면 프로젝트에 쓰지 않는다", () => {
        const project = createBlankProject();
        const before = Object.keys(project.assets.uploaded).length;
        expect(() => insertGeneratedPictureAsset(project, { name: "x", dataUrl: "not-an-image" })).toThrow();
        expect(Object.keys(project.assets.uploaded).length).toBe(before);
      });
    });
  });
  describe("pageConditions", () => {
    isolateTimers();
    // 페이지 조건의 "꺼짐/없음" 방향 저작 보증.
    // 런타임은 switch value:false / item present:false / actor present:false 를 정상 평가하는데
    // (src/project/io/pageResolution.ts:33-46) 좌측 "언제 보이나요" 패널은 항상 true 로만 써서
    // (a) 데이터에 있는 false 를 화면에서 볼 수 없고 (b) id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
    describe("eventPageConditionOffValue", () => {
      isolateTimers();
      const EVENT_ID = "ev-cond-off";
      function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
        const mapId = store.getCurrent().startMapId;
        const page: EventPage = {
          id: "page-off",
          name: "꺼짐 조건",
          conditions: [...conditions],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        };
        const event: GameEvent = {
          id: EVENT_ID,
          x: 2,
          y: 2,
          trigger: { kind: "action" },
          commands: [],
          pages: [page],
        };
        store.update((draft) => {
          const target = draft.maps[mapId];
          if (!target) return;
          target.events = [...target.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
        });
        return { mapId, page: livePage(mapId) };
      }
      function livePage(mapId: string): EventPage {
        const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
        if (!page) throw new Error("live page missing");
        return page;
      }
      function render(mapId: string, page: EventPage) {
        return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
      }
      describe("페이지 조건: 꺼짐/없음 방향 저작", () => {
        let restoreDom: (() => void) | undefined;

        beforeEach(() => {
          restoreDom = installFakeDom();
          store.replace(createBlankProject());
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("스위치 조건의 켜짐/꺼짐 셀렉트가 저장된 value 를 보여준다", () => {
          const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
          const { mapId, page } = seedPage([{ kind: "switch", switchId, value: false }]);
          const root = render(mapId, page);
          const value = findByTestId(root, "event-page-switch-condition-value");
          expect(value).toBeDefined();
          expect(value?.value).toBe("off");
        });

        it("스위치 조건의 셀렉트를 꺼짐으로 바꾸면 store 에 value:false 로 저장된다", () => {
          const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
          const { mapId, page } = seedPage([{ kind: "switch", switchId, value: true }]);
          const root = render(mapId, page);
          const value = findByTestId(root, "event-page-switch-condition-value");
          if (!value) throw new Error("switch value select missing");
          value.value = "off";
          value.dispatchEvent(new Event("change"));
          const stored = livePage(mapId).conditions.find((entry) => entry.kind === "switch");
          expect(stored).toEqual({ kind: "switch", switchId, value: false });
        });

        it("아이템 조건은 보유/미보유를 저작하고 유지한다", () => {
          const { mapId, page } = seedPage([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }]);
          const root = render(mapId, page);
          const value = findByTestId(root, "event-page-item-condition-present");
          expect(value?.value).toBe("absent");
        });

        it("주인공 조건은 파티 있음/없음을 저작하고 유지한다", () => {
          const { mapId, page } = seedPage([{ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false }]);
          const root = render(mapId, page);
          const value = findByTestId(root, "event-page-actor-condition-present");
          expect(value?.value).toBe("absent");
        });

        it("고급 스위치에서 꺼짐을 저작한 뒤 대상을 바꿔도 value:false를 유지한다", () => {
          const switches = store.getCurrent().switches;
          const { mapId, page } = seedPage([
            { kind: "switch", switchId: switches[0]?.id ?? "sw_1", value: true },
            { kind: "switch", switchId: switches[1]?.id ?? "sw_2", value: true },
            { kind: "switch", switchId: switches[2]?.id ?? "sw_3", value: true },
          ]);
          const root = render(mapId, page);
          const polarity = findByTestId(root, "event-page-advanced-condition-switch-value-0");
          const picker = findByTestId(root, "event-page-advanced-condition-switch-0");
          if (!polarity || !picker) throw new Error("advanced switch controls missing");

          polarity.value = "false";
          polarity.dispatchEvent(new Event("change"));
          picker.value = switches[0]?.id ?? "sw_changed";
          picker.dispatchEvent(new Event("change"));

          expect(polarity.textContent).toContain("꺼짐");
          expect(livePage(mapId).conditions[2]).toEqual({
            kind: "switch",
            switchId: switches[0]?.id ?? "sw_changed",
            value: false,
          });
        });

        it("고급 아이템에서 보유 안 함을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
          const items = store.getCurrent().database.items;
          const { mapId, page } = seedPage([
            { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
            { kind: "item", itemId: items[1]?.id ?? "item_extra", present: true },
          ]);
          const root = render(mapId, page);
          const polarity = findByTestId(root, "event-page-advanced-condition-item-present-0");
          const picker = findByTestId(root, "event-page-advanced-condition-item-0");
          if (!polarity || !picker) throw new Error("advanced item controls missing");

          polarity.value = "false";
          polarity.dispatchEvent(new Event("change"));
          picker.value = DEFAULT_ITEM_ID;
          picker.dispatchEvent(new Event("change"));

          expect(polarity.textContent).toContain("보유 안 함");
          expect(livePage(mapId).conditions[1]).toEqual({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false });
        });

        it("고급 주인공에서 파티에 없음을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
          const actors = store.getCurrent().database.actors;
          const { mapId, page } = seedPage([
            { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
            { kind: "actor", actorId: actors[1]?.id ?? "actor_extra", present: true },
          ]);
          const root = render(mapId, page);
          const polarity = findByTestId(root, "event-page-advanced-condition-actor-present-0");
          const picker = findByTestId(root, "event-page-advanced-condition-actor-0");
          if (!polarity || !picker) throw new Error("advanced actor controls missing");

          polarity.value = "false";
          polarity.dispatchEvent(new Event("change"));
          picker.value = DEFAULT_ACTOR_ID;
          picker.dispatchEvent(new Event("change"));

          expect(polarity.textContent).toContain("파티에 없음");
          expect(livePage(mapId).conditions[1]).toEqual({ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false });
        });
      });
    });
    describe("npcActivitySuggestions", () => {
      isolateTimers();
      const EVENT_ID = "ev-activity-condition";
      const NPC_ID = "ev-scheduled-npc";
      function scheduleEntry(mapId: string, activity: string | undefined): NpcScheduleEntry {
        return { when: { timePhase: "day" }, at: { mapId, x: 3, y: 3 }, activity, facing: "down" };
      }
      function seedScheduledNpc(project: Project, activities: readonly (string | undefined)[]): void {
        const mapId = project.startMapId;
        const npc: GameEvent = {
          id: NPC_ID,
          x: 3,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          schedule: activities.map((activity) => scheduleEntry(mapId, activity)),
        };
        const map = project.maps[mapId];
        if (!map) throw new Error("start map missing");
        map.events = [...map.events.filter((entry) => entry.id !== NPC_ID), npc];
      }
      function activityPage(activity: string): EventPage {
        return {
          id: "page-activity",
          name: "활동 조건",
          conditions: [{ kind: "npcActivity", activity }],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: "안녕" }],
        };
      }
      function hostEvent(page: EventPage): GameEvent {
        return { id: EVENT_ID, x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] };
      }
      function optionValues(root: FakeElement, testId: string): string[] {
        const list = findByTestId(root, testId);
        if (!list) throw new Error(`datalist ${testId} 없음`);
        return list.children.filter((child) => child.tagName === "OPTION").map((option) => option.value);
      }
      describe("활동 조건 저작 도움", () => {
        let restoreDom: (() => void) | undefined;

        beforeEach(() => {
          restoreDom = installFakeDom();
        });

        afterEach(() => {
          restoreDom?.();
          restoreDom = undefined;
        });

        it("프로젝트 일정에 적힌 활동을 중복 없이 정렬해 모은다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["저녁 장터", "귀가", "저녁 장터", "  ", undefined]);

          expect(collectNpcActivitySuggestions(project)).toEqual(["귀가", "저녁 장터"]);
        });

        it("일정이 없으면 빈 목록을 준다", () => {
          expect(collectNpcActivitySuggestions(createBlankProject())).toEqual([]);
        });

        it("페이지 활동 조건 입력이 프로젝트 활동을 후보로 건다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["귀가", "저녁 장터"]);
          const page = activityPage("저녁 장터");
          const mapId = project.startMapId;
          project.maps[mapId]!.events = [...project.maps[mapId]!.events, hostEvent(page)];
          store.replace(project);

          const root = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));

          expect(optionValues(root, "event-page-npc-activity-condition-options")).toEqual(["귀가", "저녁 장터"]);
          const input = findByTestId(root, "event-page-npc-activity-condition-input");
          expect(input?.getAttribute("list")).toBe("event-page-npc-activity-condition-options");
        });

        it("분기 폼 활동 입력도 같은 후보를 건다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["귀가"]);
          store.replace(project);

          const root = renderWithFakeDom(() =>
            el("div", { children: [renderNpcActivityCondition({ kind: "npcActivity", activity: "귀가" }, () => undefined)] })
          );

          expect(optionValues(root, "event-condition-npc-activity-options")).toEqual(["귀가"]);
          const input = findByTestId(root, "event-condition-npc-activity");
          expect(input?.getAttribute("list")).toBe("event-condition-npc-activity-options");
        });

        it("어떤 일정에도 없는 활동은 저작 시점에 알려준다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["귀가"]);
          const event = hostEvent(activityPage("관광"));
          project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

          const result = validateEventDraftBody(project, project.startMapId, event);
          const issue = result.issues.find((entry) => entry.code === "condition.npcActivity.unknown");

          expect(issue?.severity).toBe("warning");
          expect(issue?.message).toContain("NPC 일정");
        });

        it("일정에 있는 활동은 알리지 않는다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["귀가", "저녁 장터"]);
          const event = hostEvent(activityPage("저녁 장터"));
          project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

          const result = validateEventDraftBody(project, project.startMapId, event);

          expect(result.issues.filter((entry) => entry.code === "condition.npcActivity.unknown")).toEqual([]);
        });

        it("빈 활동은 기존 경고만 내고 미확인 경고를 겹치지 않는다", () => {
          const project = createBlankProject();
          seedScheduledNpc(project, ["귀가"]);
          const event = hostEvent(activityPage("   "));
          project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

          const codes = validateEventDraftBody(project, project.startMapId, event).issues.map((entry) => entry.code);

          expect(codes).toContain("condition.npcActivity.empty");
          expect(codes).not.toContain("condition.npcActivity.unknown");
        });
      });
    });
    describe("pageConditionAuthoringIntegrity", () => {
      isolateTimers();
      const EVENT_ID = "ev-condition-integrity";
      function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
        const mapId = store.getCurrent().startMapId;
        const page: EventPage = {
          id: "page-condition-integrity",
          name: "조건 무결성",
          conditions: [...conditions],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        };
        const event: GameEvent = {
          id: EVENT_ID,
          x: 2,
          y: 2,
          trigger: { kind: "action" },
          commands: [],
          pages: [page],
        };
        store.update((draft) => {
          const map = draft.maps[mapId];
          if (!map) return;
          map.events = [...map.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
        });
        return { mapId, page: livePage(mapId) };
      }
      function livePage(mapId: string): EventPage {
        const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
        if (!page) throw new Error("live page missing");
        return page;
      }
      function render(mapId: string, page: EventPage) {
        return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
      }
      describe("페이지 조건 저작 무결성", () => {
        let restoreDom: (() => void) | undefined;

        beforeEach(() => {
          restoreDom = installFakeDom();
          store.replace(createBlankProject());
        });

        afterEach(() => {
          restoreDom?.();
        });

        it.each([
          {
            name: "스위치",
            condition: () => ({ kind: "switch", switchId: store.getCurrent().switches[0]?.id ?? "sw_1", value: false }) as EventPageCondition,
            pickerTestId: "event-page-switch-condition-input",
            errorTestId: "event-page-switch-condition-error",
            expected: { kind: "switch", switchId: "", value: false },
            issueCode: "reference.switch.missing",
          },
          {
            name: "아이템",
            condition: () => ({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }) as EventPageCondition,
            pickerTestId: "event-page-item-condition-input",
            errorTestId: "event-page-item-condition-error",
            expected: { kind: "item", itemId: "", present: false },
            issueCode: "reference.item.missing",
          },
        ])("$name 참조를 비워도 조건을 보존하고 인라인 오류와 집계 검증을 표시한다", ({ condition, pickerTestId, errorTestId, expected, issueCode }) => {
          const { mapId, page } = seedPage([condition()]);
          const root = render(mapId, page);
          const picker = findByTestId(root, pickerTestId);
          const error = findByTestId(root, errorTestId);
          if (!picker || !error) throw new Error("reference controls missing");

          picker.value = "";
          picker.dispatchEvent(new Event("change"));

          expect(livePage(mapId).conditions[0]).toEqual(expected);
          expect(error.hidden).toBe(false);
          const validation = validateEventDraft(store.getCurrent(), mapId, EVENT_ID);
          expect(validation.issues.some((issue) => issue.code === issueCode)).toBe(true);
        });

        it("칩으로 아이템 조건을 담으면 행이 생기고, 다시 빼면 안내 한 줄로 돌아간다", () => {
          const { mapId, page } = seedPage([]);
          const emptyRoot = render(mapId, page);
          expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
          expect(findByTestId(emptyRoot, "event-condition-row-아이템")).toBeNull();
          const chip = findByTestId(emptyRoot, "event-condition-chip-item");
          if (!chip) throw new Error("item chip missing");
          expect(chip.getAttribute("aria-pressed")).toBe("false");

          chip.click();

          // 첫 아이템에 조용히 묶지 않는다 — 빈 참조로 세우고 행의 「아이템을 선택하세요」가 고르게 한다(2026-09-18).
          expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: "", present: true }]);
          const openRoot = render(mapId, livePage(mapId));
          const row = findByTestId(openRoot, "event-condition-row-아이템");
          if (!row) throw new Error("enabled item row missing after chip toggle");
          expect(row.dataset.conditionActive).toBe("true");
          expect(row.classList.contains("disabled")).toBe(false);
          expect(findByTestId(openRoot, "event-condition-chip-item")?.getAttribute("aria-pressed")).toBe("true");
          expect(findByTestId(openRoot, "event-page-item-condition-input")).not.toBeNull();

          findByTestId(openRoot, "event-condition-chip-item")?.click();

          expect(livePage(mapId).conditions).toEqual([]);
          expect(findByTestId(render(mapId, livePage(mapId)), "event-condition-empty")).not.toBeNull();
        });
      });
    });
  });
});
