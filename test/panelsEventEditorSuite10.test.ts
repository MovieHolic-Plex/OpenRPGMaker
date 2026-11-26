import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest, applyEventDraftVault, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { undoMapEdit, getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory } from "@/editor/mapEditHistory";
import { deleteEditorEvent, requestEditorEventDeletion } from "@/editor/eventDeletion";
import type { Command, EventPage, GameEvent } from "@/project/types";
import { installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { updateEventPage } from "@/editor/eventPages";
import { createDefaultGameEvent, updateEvent } from "@/editor/eventActions";
import { renderEventCharacterSocialExtras } from "@/editor/panels/eventEditor/pageProps";
import { applyMemoryOpeningTemplate } from "@/editor/panels/eventEditor/memoryOpeningTemplate";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { projectWithEventDraftAuthoredWrites } from "@/project/eventDraftAuthored";
import { eventDraftDiffById, eventDraftHasUserChanges, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

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
