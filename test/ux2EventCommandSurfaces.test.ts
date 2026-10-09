/** @vitest-environment happy-dom */
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { createDefaultEventPage } from "@/editor/eventPages";
import { editorState } from "@/editor/editorState";
import { resetEventViewSession, setStoryboardMode } from "@/editor/panels/eventEditor/storyboardView";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginCommandSelectionScope, clearCommandInspector, isCommandSelected, selectAllAuthoredCommands, selectedCommandPaths, selectedCommandRoots, setCommandSelectionSurface, setCommandInspectorHost, setCommandSelectionListener, showCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { finishCommandListMount, resumeCommandListMount, indexCommandIssues, renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { indexCommandSearch, renderEventEditorDynamic, refreshEventCommandMove } from "@/editor/panels/eventEditor/content";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command } from "@/project/types";
import type { EventDraftIssue } from "@/editor/eventDraftValidator";
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
