// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCharacterIdPicker } from "@/editor/panels/eventEditor/characterIdPickerDialog";
import { renderEventCharacterIdField, renderEventCharacterSocialExtras, renderClassicPageTabStrip, renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Command, EventPage, Project, Condition } from "@/project/types";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic, indexCommandSearch, refreshEventCommandMove } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector, selectedCommandPath, setCommandInspectorHost, beginCommandSelectionScope, isCommandSelected, selectAllAuthoredCommands, selectedCommandPaths, selectedCommandRoots, setCommandSelectionSurface, setCommandSelectionListener, showCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { copyEventCommandsToClipboard } from "@/editor/panels/eventEditor/commandClipboard";
import { resetEventViewSession, setStoryboardMode } from "@/editor/panels/eventEditor/storyboardView";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createDefaultEventPage } from "@/editor/eventPages";
import { finishCommandListMount, resumeCommandListMount, indexCommandIssues, renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { EventDraftIssue } from "@/editor/eventDraftValidator";
import { renderCompanionRoster } from "@/editor/panels/eventEditor/companionRoster";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { isolateTimers } from "./mergedTeardown";

describe("characterIdPickerDialog", () => {
  isolateTimers();
  function baseEvent(partial: Partial<GameEvent> = {}): GameEvent {
    return {
      id: "ev_host",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [{ id: "p1", name: "page", conditions: [], commands: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 } }],
      ...partial,
    };
  }
  function seedProject(options?: {
    readonly characterId?: string;
    readonly characters?: Record<string, { displayName?: string }>;
    readonly extraEvents?: readonly GameEvent[];
  }): { mapId: string; event: GameEvent } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = baseEvent(options?.characterId ? { characterId: options.characterId } : {});
    project.maps[mapId] = {
      ...project.maps[mapId]!,
      events: [event, ...(options?.extraEvents ?? [])],
    };
    if (options?.characters) project.characters = options.characters;
    store.replace(project);
    return { mapId, event };
  }
  function dialogRoot(): HTMLElement {
    const root = document.querySelector('[data-testid="event-character-id-picker"]');
    if (!(root instanceof HTMLElement)) throw new Error("character id picker dialog missing");
    return root;
  }
  describe("characterId picker dialog", () => {
    beforeEach(() => {
      document.body.replaceChildren();
    });

    afterEach(() => {
      document.body.replaceChildren();
    });

    it("shows a direct relationship action, then a linked status and grouped settings", () => {
      const { mapId, event } = seedProject();
      const unlinked = renderEventCharacterIdField(mapId, event);
      document.body.append(unlinked);
      expect(unlinked.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
      expect(unlinked.querySelector('[data-testid="event-character-id-input"]')).toBeNull();
      unlinked.remove();

      const linkedEvent = { ...event, characterId: "char_linked" };
      const linked = renderEventCharacterIdField(mapId, linkedEvent);
      const extras = renderEventCharacterSocialExtras(mapId, linkedEvent);
      document.body.append(linked);
      if (extras) document.body.append(extras);
      expect(linked.querySelector('[data-testid="event-character-id-picker-open"]')?.textContent).toContain("char_linked");
      expect(linked.querySelector('[data-testid="event-character-id-connect"]')).toBeNull();
      expect(extras?.querySelector('[data-testid="event-character-id-input"]')).toBeTruthy();
      expect(extras?.querySelector('[data-testid="event-talk-friendship-field"]')?.textContent).toContain("대화 보너스");
      expect(extras?.querySelector('[data-testid="event-character-social-unlink"]')).toBeTruthy();
    });

    it("opens dedicated dialog with union list, displayName, and usage counts", () => {
      const { mapId, event } = seedProject({
        characterId: "char_used",
        characters: {
          char_used: { displayName: "마을 촌장" },
          char_profile_only: { displayName: "미사용" },
        },
        extraEvents: [baseEvent({ id: "ev_orphan", characterId: "char_orphan" })],
      });

      openCharacterIdPicker({ mapId, eventId: event.id, currentId: event.characterId });
      const root = dialogRoot();

      expect(root.textContent).toContain("NPC 관계 연결");
      expect(root.querySelector('[data-testid="event-character-id-picker-search"]')).toBeTruthy();
      expect(root.querySelector('[data-testid="event-character-id-picker-list"]')).toBeTruthy();
      expect(root.textContent).toContain("char_used");
      expect(root.textContent).toContain("마을 촌장");
      expect(root.textContent).toContain("char_profile_only");
      expect(root.textContent).toContain("char_orphan");
      expect(root.textContent).toMatch(/사용\s*1/);
    });

    it("select attaches existing characterId without creating extra profiles", () => {
      const { mapId, event } = seedProject({
        characters: { char_existing: { displayName: "Existing" } },
      });

      openCharacterIdPicker({ mapId, eventId: event.id });
      const root = dialogRoot();
      const row = root.querySelector('[data-testid="event-character-id-picker-row-char_existing"]');
      expect(row).toBeTruthy();
      (row as HTMLButtonElement).click();
      (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

      const updated = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id);
      expect(updated?.characterId).toBe("char_existing");
      expect(Object.keys(store.getCurrent().characters ?? {})).toEqual(["char_existing"]);
      expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeNull();
    });

    it("create registers profile + attaches, and rejects duplicates", () => {
      const { mapId, event } = seedProject({
        characters: { char_taken: { displayName: "Taken" } },
      });

      openCharacterIdPicker({ mapId, eventId: event.id });
      let root = dialogRoot();
      (root.querySelector('[data-testid="event-character-id-picker-create-toggle"]') as HTMLButtonElement).click();

      const idInput = root.querySelector('[data-testid="event-character-id-picker-create-id"]') as HTMLInputElement;
      const nameInput = root.querySelector('[data-testid="event-character-id-picker-create-name"]') as HTMLInputElement;
      idInput.value = "char_taken";
      idInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.value = "Duplicate";
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

      expect(store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBeUndefined();
      expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeTruthy();
      expect(root.querySelector('[data-testid="event-character-id-picker-create-error"]')?.textContent).toContain("이미 사용");

      idInput.value = "char_new";
      idInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.value = "새 주민";
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      (root.querySelector('[data-testid="event-character-id-picker-ok"]') as HTMLButtonElement).click();

      const project = store.getCurrent();
      expect(project.maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBe("char_new");
      expect(project.characters?.char_new).toEqual({ displayName: "새 주민" });
      expect(document.querySelector('[data-testid="event-character-id-picker"]')).toBeNull();
    });

    it("free-type unknown id attaches without auto profile create", () => {
      // 자유 입력은 연결된 관계 카드의 고급 설정에서만 가능하다.
      const { mapId, event } = seedProject({ characterId: "char_seed" });
      const field = renderEventCharacterSocialExtras(mapId, event);
      if (!field) throw new Error("relationship settings missing");
      document.body.append(field);
      const input = field.querySelector('[data-testid="event-character-id-input"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      input.value = "char_orphan_free";
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const project = store.getCurrent();
      expect(project.maps[mapId]!.events.find((entry) => entry.id === event.id)?.characterId).toBe("char_orphan_free");
      expect(project.characters?.["char_orphan_free"]).toBeUndefined();
    });
  });
});

describe("commandInspector", () => {
  isolateTimers();
  // 명령 피커 → 편집 창 인수인계 계약: 편집 창이 열리기 전에 피커는 닫혀 있어야 한다.
  // 피커가 뒤에 남으면 확인이 뒤 창에 먹혀 저작이 유실된다.
  describe("eventCommandPickerHandoff", () => {
    isolateTimers();
    const PICKER = '[data-testid="event-command-picker"]';
    const EDIT_DIALOG = '[data-testid="event-command-edit-dialog"]';
    let host: HTMLElement;
    function textCommandButton(): HTMLButtonElement {
      const button = document.querySelector<HTMLButtonElement>(`${PICKER} [data-testid="command-picker-add-text"]`);
      if (!button) throw new Error("expected the 문장 표시 picker entry");
      return button;
    }
    function emptyEvent(): GameEvent {
      return {
        id: "ev_handoff",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [{
          id: "p1",
          name: "페이지 1",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "below",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        }],
      };
    }
    beforeEach(() => {
      clearCommandInspector();
      host = document.createElement("div");
      document.body.append(host);
    });
    afterEach(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-cancel"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-testid="event-command-picker-cancel"]')?.click();
      clearCommandInspector();
      document.body.replaceChildren();
    });
    describe("command picker hands off to the edit dialog", () => {
      it("closes the map event picker before the edit dialog opens", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = emptyEvent();
        project.maps[mapId]!.events = [event];
        store.replace(project);
        editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
        renderEventEditorDynamic(host, mapId, event.id);

        const append = host.querySelector<HTMLButtonElement>('[data-testid="event-command-empty-line"]');
        expect(append).not.toBeNull();
        append?.click();
        expect(document.querySelector(PICKER)).not.toBeNull();

        textCommandButton().click();

        expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
        expect(document.querySelector(PICKER)).toBeNull();
      });

      it("closes the common event picker before the edit dialog opens", () => {
        store.replace(createBlankProject());
        let commands: Command[] = [];
        renderDatabaseCommandListEditor(host, {
          commands,
          replaceCommands: (next) => {
            commands = next;
          },
          pickerContext: "common",
        });

        host.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
        );
        expect(document.querySelector(PICKER)).not.toBeNull();

        textCommandButton().click();

        expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
        expect(document.querySelector(PICKER)).toBeNull();
      });
    });
  });
  describe("eventCommandSharedHostContract", () => {
    isolateTimers();
    beforeEach(() => { store.replaceProject(createBlankProject()); resetMapEditHistory(); setCommandInspectorHost(undefined); clearCommandInspector(); });
    afterEach(() => { clearCommandInspector(); document.body.replaceChildren(); resetMapEditHistory(); });
    describe.each(["common", "troop"] as const)("%s command host", pickerContext => {
      it("deletes Select All as one host transaction with its existing global history", () => {
        let commands: Command[] = [{ kind: "text", body: "one" }, { kind: "loop", body: [{ kind: "text", body: "nested" }] }];
        let replacements = 0;
        const host = document.createElement("div");
        document.body.append(host);
        renderDatabaseCommandListEditor(host, { commands, pickerContext, replaceCommands: next => { commands = next; replacements++; } });
        const head = host.querySelector<HTMLElement>(".cmd-head")!;
        head.click();
        head.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
        head.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
        expect(commands).toEqual([]);
        expect(replacements).toBe(1);
        expect(getMapEditHistoryEntries()).toHaveLength(1);
        expect(selectedCommandPath()).toBeUndefined();
      });
      it("pastes a nested clipboard batch once with independent clones", () => {
        const copied: Command[] = [{ kind: "loop", body: [{ kind: "text", body: "nested" }] }, { kind: "text", body: "tail" }];
        copyEventCommandsToClipboard(copied);
        let commands: Command[] = [{ kind: "text", body: "existing" }];
        let replacements = 0;
        const host = document.createElement("div");
        document.body.append(host);
        renderDatabaseCommandListEditor(host, { commands, pickerContext, replaceCommands: next => { commands = next; replacements++; } });
        host.querySelector<HTMLElement>(".cmd-head")!.dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true }));
        // 붙여넣기는 행 **바로 아래** — 「+ 명령」과 같은 자리 규칙(2026-09-18).
        expect(commands).toEqual([{ kind: "text", body: "existing" }, ...copied]);
        expect(commands[0]).not.toBe(copied[0]);
        expect(replacements).toBe(1);
      });
    });
  });
  // 툴바 팝오버(「편집 ▾」 등 `<details>`)는 바깥을 누르면 닫혀야 한다.
  //
  // 실측 2026-09-03(제안서 §4): 팝오버가 열린 채 목록을 클릭해도 `details.open` 이 유지돼
  // 우클릭 메뉴와 두 메뉴가 동시에 떠 있었다. Escape 층 등록(registerModal)은 있었지만
  // 포인터 경로가 없었다.
  describe("eventEditorPopoverDismiss", () => {
    isolateTimers();
    const EVENT_ID = "ev_popover_probe";
    function page(commands: Command[]): EventPage {
      return {
        id: "p1",
        name: "안내인",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      };
    }
    function seed(): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const ev: GameEvent = {
        id: EVENT_ID,
        x: 3,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [page([{ kind: "text", body: "서쪽 길에는 슬라임이 있어." }, { kind: "wait", ms: 500 }])],
      };
      project.maps[mapId]!.events = [ev];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
      return mapId;
    }
    function pointerDownOn(target: Element): void {
      target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    }
    describe("툴바 팝오버 닫힘", () => {
      let host: HTMLElement;
      let mapId: string;

      beforeEach(() => {
        resetModalStackForTest();
        clearCommandInspector();
        resetEventViewSession();
        localStorage.clear();
        host = document.createElement("div");
        document.body.append(host);
        mapId = seed();
        renderEventEditorDynamic(host, mapId, EVENT_ID);
      });

      afterEach(() => {
        clearCommandInspector();
        resetEventViewSession();
        resetModalStackForTest();
        host.remove();
      });

      const menu = (): HTMLDetailsElement => {
        const node = host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]');
        if (!node) throw new Error("편집 팝오버가 없다");
        return node;
      };

      const open = (details: HTMLDetailsElement): void => {
        details.open = true;
        details.dispatchEvent(new Event("toggle"));
      };

      it("바깥(명령 목록)을 누르면 닫힌다", () => {
        const details = menu();
        open(details);
        expect(details.open).toBe(true);
        const list = host.querySelector(".cmd-list");
        if (!list) throw new Error("명령 목록이 없다");
        pointerDownOn(list);
        expect(details.open).toBe(false);
      });

      it("팝오버 안을 누르면 열린 채다", () => {
        const details = menu();
        open(details);
        const inside = details.querySelector('[data-testid="event-command-toolbar-move-up"]');
        if (!inside) throw new Error("팝오버 안 버튼이 없다");
        pointerDownOn(inside);
        expect(details.open).toBe(true);
      });

      it("닫힌 뒤에는 바깥 클릭 리스너가 남지 않는다 — 다시 열면 다시 닫힌다", () => {
        const details = menu();
        open(details);
        pointerDownOn(document.body);
        expect(details.open).toBe(false);
        open(details);
        expect(details.open).toBe(true);
        pointerDownOn(document.body);
        expect(details.open).toBe(false);
      });

      it("도구 팝오버도 같은 규칙을 따른다", () => {
        const tools = host.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
        if (!tools) throw new Error("도구 팝오버가 없다");
        open(tools);
        pointerDownOn(document.body);
        expect(tools.open).toBe(false);
      });
    });
  });
  describe("ux2EventCommandSurfaces", () => {
    isolateTimers();
    const actions: CommandListActions = { addCommand() {}, insertCommand() {}, replaceCommand() {}, deleteCommand() {}, moveCommand() {}, moveCommandTo() {} };
    afterEach(() => { setCommandSelectionListener(undefined); clearCommandInspector(); setCommandInspectorHost(undefined); document.body.replaceChildren(); vi.restoreAllMocks(); });
    describe("event command selection and List mounting", () => {
      it("Select All includes hidden/nested commands, paints shared paths on both surfaces, and drops child copy roots", () => {
        const host = document.createElement("div"); document.body.append(host);
        for (const path of [[0], [0, -5, 0], [1]]) for (let view = 0; view < 2; view++) {
          const row = document.createElement("div"); row.dataset.cmdPath = JSON.stringify(path); row.hidden = path[0] === 1; host.append(row);
        }
        const commands: Command[] = [{ kind: "loop", body: [{ kind: "text", body: "child" }] }, { kind: "text", body: "hidden" }];
        beginCommandSelectionScope(host); setCommandSelectionSurface(host); selectAllAuthoredCommands(commands);
        expect(selectedCommandPaths()).toHaveLength(3); expect(isCommandSelected([0, -5, 0])).toBe(true);
        expect(host.querySelectorAll(".selected")).toHaveLength(6);
        expect(selectedCommandRoots(selectedCommandPaths())).toEqual([[0], [1]]);
        const scan = vi.spyOn(host, "querySelectorAll");
        showCommandInspector({ command: commands[1]!, path: [1], actions });
        expect(scan).not.toHaveBeenCalled(); // A single selection reuses the path registry.
        expect(host.querySelectorAll(".selected")).toHaveLength(2);
      });

      it("Tab does not replace a multi-selection or mount a new inspector", () => {
        const host = document.createElement("div"); document.body.append(host);
        const commands: Command[] = [{ kind: "text", body: "a" }, { kind: "text", body: "b" }];
        renderCommandList(host, commands, [], actions); selectAllAuthoredCommands(commands);
        host.querySelectorAll<HTMLElement>(".cmd-head")[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
        expect(selectedCommandPaths()).toEqual([[0], [1]]);
      });

      it("reuses unaffected row DOM during an immutable reorder, then its shortcut sees the latest authored tree", () => {
        const host = document.createElement("div"); document.body.append(host);
        const commands: Command[] = [{ kind: "text", body: "a" }, { kind: "text", body: "b" }, { kind: "text", body: "c" }];
        renderCommandList(host, commands, [], actions, { reuseImmutableRows: true });
        const first = host.querySelector('[data-cmd-path="[0]"]');
        renderCommandList(host, [commands[0]!, commands[2]!], [], actions, { reuseImmutableRows: true });
        expect(host.querySelector('[data-cmd-path="[0]"]')).toBe(first);
        first!.querySelector(".cmd-head")!.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
        expect(selectedCommandPaths()).toEqual([[0], [1]]);
        expect(host.querySelectorAll(".cmd-item")).toHaveLength(2);
      });

      it("rebuilds dependent speaker-face rows while retaining rows after the next face boundary", () => {
        const host = document.createElement("div"); document.body.append(host);
        const face: Command = { kind: "changeFace", resourceId: "face-a", position: "left", flipHorizontally: false };
        const text: Command = { kind: "text", body: "a" };
        const reset: Command = { kind: "changeFace", resourceId: "face-b", position: "left", flipHorizontally: false };
        const end: Command = { kind: "text", body: "b" };
        renderCommandList(host, [face, text, reset, end], [], actions, { reuseImmutableRows: true });
        const dependent = host.querySelector('[data-cmd-path="[1]"]');
        const unaffected = host.querySelector('[data-cmd-path="[3]"]');
        renderCommandList(host, [{ kind: "changeFace", resourceId: "face-c", position: "left", flipHorizontally: false }, text, reset, end], [], actions, { reuseImmutableRows: true });
        expect(host.querySelector('[data-cmd-path="[1]"]')).not.toBe(dependent);
        expect(host.querySelector('[data-cmd-path="[3]"]')).toBe(unaffected);
      });

      it("mounts a bounded prefix and finishes before the append destination; obsolete frames cannot append old commands", () => {
        const callbacks = new Map<number, FrameRequestCallback>(); let sequence = 0;
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callbacks.set(++sequence, callback); return sequence; });
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { callbacks.delete(id); });
        const host = document.createElement("div"); document.body.append(host);
        const commands: Command[] = Array.from({ length: 200 }, (_, i) => ({ kind: "text", body: String(i) }));
        renderCommandList(host, commands, [], actions, { deferMount: true });
        expect(host.querySelectorAll(".cmd-item").length).toBeLessThan(200);
        expect(host.getAttribute("aria-busy")).toBe("true");
        const mounted = host.querySelectorAll(".cmd-item").length;
        host.hidden = true;
        const scheduled = [...callbacks.entries()];
        for (const [id, callback] of scheduled) { callbacks.delete(id); callback(1); }
        expect(host.querySelectorAll(".cmd-item")).toHaveLength(mounted);
        host.hidden = false; resumeCommandListMount(host);
        const tail = document.createElement("button"); host.append(tail);
        finishCommandListMount(host);
        expect(host.querySelectorAll(".cmd-item")).toHaveLength(200); expect(host.lastChild).toBe(tail);
        renderCommandList(host, commands, [], actions, { deferMount: true });
        const obsolete = [...callbacks.values()];
        renderCommandList(host, [{ kind: "text", body: "replacement" }], [], actions);
        for (const callback of obsolete) callback(1);
        expect(host.querySelectorAll(".cmd-item")).toHaveLength(1);
        expect(host.textContent).toContain("replacement");
      });
    });
    describe("page-version search and issue indexing", () => {
      it("searches the complete nested model without rendering hidden List and records ancestor paths", () => {
        const index = indexCommandSearch([{ kind: "loop", body: [{ kind: "text", body: "unique needle" }] }]);
        const matches = index.filter(entry => entry.text.includes("needle"));
        expect(matches).toHaveLength(1); expect(matches[0]!.key).toBe("[0,-5,0]"); expect(matches[0]!.ancestors).toEqual(["[0]"]);
        expect(index.filter(entry => entry.text.includes("needle"))).toHaveLength(1);
      });

      it("groups issue paths once, preserving duplicate issue order and excluding page-only problems", () => {
        const issues: EventDraftIssue[] = [
          { pageId: "p", code: "a", commandPath: [0, -5, 0], severity: "warning", message: "first" },
          { pageId: "p", code: "b", commandPath: [1], severity: "info", message: "other" },
          { pageId: "p", code: "c", commandPath: [0, -5, 0], severity: "error", message: "second" },
          { pageId: "p", code: "page", severity: "error", message: "page" },
        ];
        const index = indexCommandIssues(issues);
        expect(index.size).toBe(2); expect(index.get("[0,-5,0]")).toEqual([issues[0], issues[2]]);
        const host = document.createElement("div"); document.body.append(host);
        renderCommandList(host, [{ kind: "loop", body: [{ kind: "text", body: "a" }] }, { kind: "text", body: "b" }], [], actions, { issuesByPath: index });
        const badge = host.querySelector<HTMLElement>('[data-testid="event-command-issue-badge-0--5-0"]')!;
        expect(badge.dataset.severity).toBe("error"); expect(badge.title).toBe("first\nsecond"); expect(badge.getAttribute("aria-label")).toBe("검사 문제 2개");
      });
    });
    describe("active event search surfaces", () => {
      function render(mode: "list" | "flow") {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = { id: "ux2-search", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [] };
        const page = createDefaultEventPage(event, 1); page.id = "ux2-search-page";
        page.commands = [{ kind: "text", body: "needle" }, { kind: "text", body: "other" }];
        project.maps[mapId]!.events = [{ ...event, pages: [page] }];
        store.replaceProject(project);
        editorState.set({ currentMapId: mapId, selectedEventId: event.id, selectedEventPageId: page.id });
        resetEventViewSession(); localStorage.clear();
        const host = document.createElement("div"); document.body.append(host);
        // Set the view through the actual control after the session has begun.
        renderEventEditorDynamic(host, mapId, event.id);
        host.querySelector<HTMLElement>(`[data-testid="event-view-toggle-${mode}"]`)!.click();
        return host;
      }
      it("refreshes a typed move within the same workbench and updates the active search revision", () => {
        const host = render("list");
        const workbench = host.querySelector(".event-editor-workbench");
        const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
        search.value = "needle"; search.dispatchEvent(new Event("input", { bubbles: true }));
        const mapId = store.getCurrent().startMapId;
        const unsubscribe = store.subscribe((_project, change) => {
          expect(refreshEventCommandMove(mapId, "ux2-search", change)).toBe(true);
        });
        try {
          store.reorderEventCommands(mapId, "ux2-search", "ux2-search-page", [0], [], 1);
        } finally { unsubscribe(); }
        expect(host.querySelector(".event-editor-workbench")).toBe(workbench);
        expect(host.querySelector('[data-cmd-path="[0]"]')!.textContent).toContain("other");
        expect(host.querySelector<HTMLElement>('[data-cmd-path="[0]"]')!.hidden).toBe(true);
        expect(host.querySelector<HTMLElement>('[data-cmd-path="[1]"]')!.hidden).toBe(false);
        expect(host.querySelector('[data-testid="event-command-search-count"]')!.textContent).toBe("1개 일치");
        expect(refreshEventCommandMove(mapId, "ux2-search", { scope: "map", mapId, eventId: "ux2-search", label: "커맨드 순서 이동" })).toBe(false);
      });

      it("computes Flow search counts without creating hidden List rows", () => {
        const host = render("flow");
        // Flow may be entered after an initial List; use a fresh body in that mode.
        host.replaceChildren(); setStoryboardMode("flow");
        renderEventEditorDynamic(host, store.getCurrent().startMapId, "ux2-search");
        const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
        search.value = "needle"; search.dispatchEvent(new Event("input", { bubbles: true }));
        expect(host.querySelector('[data-testid="event-command-search-count"]')!.textContent).toBe("1개 일치");
        expect(host.querySelector(".cmd-list .cmd-item")).toBeNull();
      });
      it("does not re-filter the active or retained hidden List for a selection-only change", () => {
        const host = render("list");
        const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
        search.value = "needle"; search.dispatchEvent(new Event("input", { bubbles: true }));
        const list = host.querySelector<HTMLElement>(".cmd-list")!;
        const scan = vi.spyOn(list, "querySelectorAll");
        host.querySelector<HTMLElement>('.cmd-item .cmd-head')!.click();
        expect(scan).not.toHaveBeenCalled();
        expect(search.value).toBe("needle");
        expect(host.querySelector('[data-testid="event-command-search-count"]')!.textContent).toBe("1개 일치");
      });
    });
    it("defers retained hidden List filtering until List is activated again", () => {
      const project = createBlankProject(); const mapId = project.startMapId;
      const event = { id: "ux2-hidden-search", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [] };
      const page = createDefaultEventPage(event, 1); page.id = "ux2-hidden-page";
      page.commands = [{ kind: "text", body: "alpha" }, { kind: "text", body: "beta" }];
      project.maps[mapId]!.events = [{ ...event, pages: [page] }]; store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: event.id, selectedEventPageId: page.id });
      resetEventViewSession(); localStorage.clear();
      const host = document.createElement("div"); document.body.append(host); renderEventEditorDynamic(host, mapId, event.id);
      host.querySelector<HTMLElement>('[data-testid="event-view-toggle-list"]')!.click();
      const rows = [...host.querySelectorAll<HTMLElement>(".cmd-list .cmd-item")];
      host.querySelector<HTMLElement>('[data-testid="event-view-toggle-storyboard"]')!.click();
      const writes = rows.map(row => vi.spyOn(row, "hidden", "set"));
      const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
      search.value = "beta"; search.dispatchEvent(new Event("input", { bubbles: true }));
      for (const write of writes) expect(write).not.toHaveBeenCalled();
      expect(host.querySelector('[data-testid="event-command-search-count"]')!.textContent).toBe("1개 일치");
      host.querySelector<HTMLElement>('[data-testid="event-view-toggle-list"]')!.click();
      expect(rows[0]!.hidden).toBe(true); expect(rows[1]!.hidden).toBe(false);
    });
  });
});

describe("companionRoster", () => {
  isolateTimers();
  describe("companion roster in the companion command picker", () => {
    it("lists every database actor with a rendered portrait background", () => {
      const project = fixtureProject();
      const root = renderCompanionRoster(project);

      expect(root.dataset.testid).toBe("companion-roster");
      const cards = root.querySelectorAll("[data-testid^='companion-card-']");
      expect(cards.length).toBe(project.database.actors.length);
      for (const actor of project.database.actors) {
        const card = root.querySelector(`[data-testid='companion-card-${actor.id}']`);
        expect(card?.textContent ?? "").toContain(actor.name);
        const thumb = card?.querySelector(`[data-testid='companion-thumb-${actor.id}']`) as HTMLElement | null;
        expect(thumb?.style.backgroundImage ?? "").toContain("url(");
      }
    });

    it("collapses to a hint when no actor exists", () => {
      const project = createBlankProject();
      project.database.actors = [];
      const root = renderCompanionRoster(project);
      expect(root.querySelectorAll("[data-testid^='companion-card-']").length).toBe(0);
    });
  });
  function fixtureProject(): Project {
    const project = createBlankProject();
    const template = project.database.actors[0];
    if (!template) throw new Error("missing default actor fixture");
    project.database.actors = [template, ...project.database.actors.slice(1)].map((actor, index) => ({
      ...actor,
      faceResourceId: index === 0 ? undefined : actor.faceResourceId,
      characterResourceId: index === 0 ? "easyrpg-charset-object1" : actor.characterResourceId,
      characterIndex: index,
    }));
    return project;
  }
});

// 조건 문장·요약·배지·분기 폼에 내부 토큰이 새면 안 된다.
// 페이지 문장과 분기 요약은 같은 기능의 두 표면이므로 한 계약으로 묶는다.
describe("conditionCopyTokens", () => {
  isolateTimers();
  const FORBIDDEN: readonly { readonly name: string; readonly re: RegExp }[] = [
    { name: "ON", re: /\bON\b/ },
    { name: "OFF", re: /\bOFF\b/ },
    { name: "AND(", re: /AND\(/ },
    { name: "OR(", re: /OR\(/ },
    { name: "NOT", re: /\bNOT\b/ },
    { name: "timer1", re: /timer1/ },
    { name: "timer2", re: /timer2/ },
    { name: "completed", re: /\bcompleted\b/ },
    { name: "failed", re: /\bfailed\b/ },
    { name: "abandoned", re: /\babandoned\b/ },
    { name: "run", re: /\brun\b/ },
  ];
  function assertCleanCopy(label: string, text: string): void {
    for (const token of FORBIDDEN) {
      expect(text, `${label} leaked ${token.name}: ${text}`).not.toMatch(token.re);
    }
  }
  function sampleConditions(): readonly Condition[] {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_0001";
    const variableId = project.variables[0]?.id ?? "var_0001";
    const actorId = project.database.actors[0]?.id ?? "act_0001";
    const itemId = project.database.items[0]?.id ?? "item_0001";
    const switchCond: Condition = { kind: "switch", switchId, value: true };
    return [
      switchCond,
      { kind: "switch", switchId, value: false },
      { kind: "variable", variableId, op: ">=", value: 10 },
      { kind: "variable", variableId, op: "==", value: 4 },
      { kind: "variable", variableId, op: "!=", value: 1 },
      { kind: "selfSwitch", key: "A", value: true },
      { kind: "selfSwitch", key: "B", value: false },
      { kind: "actor", actorId, present: true },
      { kind: "actor", actorId, present: false },
      { kind: "item", itemId, present: true },
      { kind: "item", itemId, present: false },
      { kind: "gold", op: ">=", amount: 100 },
      { kind: "timer", timerId: "timer1", seconds: 5 },
      { kind: "timer", timerId: "timer2", seconds: 90 },
      { kind: "timePhase", phase: "morning" },
      { kind: "season", season: "winter" },
      { kind: "npcActivity", activity: "work" },
      { kind: "friendshipAtLeast", npcKey: "촌장", value: 50 },
      { kind: "battleResult", result: "victory" },
      { kind: "run", query: "active", value: true },
      { kind: "run", query: "active", value: false },
      { kind: "run", query: "floor", op: ">=", value: 3 },
      { kind: "run", query: "flag", flag: "door", value: true },
      { kind: "run", query: "result", result: "completed" },
      { kind: "run", query: "result", result: "failed" },
      { kind: "run", query: "result", result: "abandoned" },
      { kind: "all", conditions: [switchCond] },
      { kind: "any", conditions: [switchCond] },
      { kind: "not", condition: switchCond },
      { kind: "all", conditions: [] },
      { kind: "any", conditions: [] },
    ];
  }
  function pageWith(conditions: readonly Condition[]): EventPage {
    return {
      id: "p1",
      name: "조건 복사",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function hostEvent(page: EventPage): GameEvent {
    return {
      id: "ev_copy",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    };
  }
  describe("조건 복사에 내부 토큰이 없다", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("페이지 문장과 분기 요약에 금지 토큰이 없다", () => {
      for (const condition of sampleConditions()) {
        assertCleanCopy(`sentence ${condition.kind}`, pageConditionSentence([condition]).text);
        assertCleanCopy(
          `fork ${condition.kind}`,
          commandSummary({ kind: "fork", condition, then: [] }),
        );
      }
    });

    it("페이지 탭·배지·조건 폼에도 금지 토큰이 없다", () => {
      const mapId = store.getCurrent().startMapId;
      for (const condition of sampleConditions()) {
        const page = pageWith([condition]);
        const event = hostEvent(page);
        const tabs = renderClassicPageTabStrip(mapId, event, page);
        assertCleanCopy(`tab ${condition.kind}`, tabs.textContent ?? "");
        const tooltip = tabs.querySelector('[data-testid="evt-page-cond-1"]')?.parentElement?.getAttribute("title") ?? "";
        assertCleanCopy(`tooltip ${condition.kind}`, tooltip);

        const props = renderEventPageProps(mapId, event.id, page, event);
        assertCleanCopy(`props ${condition.kind}`, props.textContent ?? "");

        const form = conditionForm(condition, () => {});
        assertCleanCopy(`form ${condition.kind}`, form.textContent ?? "");
      }
    });
  });
});
