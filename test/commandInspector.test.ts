// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic, indexCommandSearch, refreshEventCommandMove } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector, selectedCommandPath, setCommandInspectorHost, beginCommandSelectionScope, isCommandSelected, selectAllAuthoredCommands, selectedCommandPaths, selectedCommandRoots, setCommandSelectionSurface, setCommandSelectionListener, showCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, EventPage } from "@/project/types";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { copyEventCommandsToClipboard } from "@/editor/panels/eventEditor/commandClipboard";
import { resetEventViewSession, setStoryboardMode } from "@/editor/panels/eventEditor/storyboardView";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createDefaultEventPage } from "@/editor/eventPages";
import { finishCommandListMount, resumeCommandListMount, indexCommandIssues, renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { EventDraftIssue } from "@/editor/eventDraftValidator";
import { isolateTimers } from "./mergedTeardown";

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
