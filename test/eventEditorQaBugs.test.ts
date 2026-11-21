/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { runSmallTask } from "@/editor/smallTask/run";
import { isTopModal, registerModal, resetModalStackForTest, unregisterModal } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";

vi.mock("@/editor/smallTask/run", () => ({
  runSmallTask: vi.fn(async (before: Project) => before),
}));

function control<T extends HTMLElement = HTMLButtonElement>(testId: string): T {
  const element = document.querySelector<T>(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`Missing control ${testId}`);
  return element;
}

async function openEditor(commands: Command[] = []) {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event = createDefaultGameEvent(2, 3);
  event.pages![0].commands = commands;
  project.maps[mapId]!.events = [event];
  store.replaceProject(project);
  openEventEditorModal(mapId, event.id);
  await vi.waitFor(() => control("event-command-empty-line"));
  return {
    mapId,
    switchId: project.switches[0]!.id,
    readCommands: () => store.getCurrent().maps[mapId]!.events[0]!.pages![0].commands,
  };
}

function chooseCommand(kind: string, label: string): void {
  control("event-command-empty-line").click();
  const search = control<HTMLInputElement>("event-command-picker-search");
  search.value = label;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  control(`command-picker-add-${kind}`).click();
}

function pressHistoryKey(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey, bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(event);
  return event;
}

describe("event editor QA regressions", () => {
  beforeEach(() => {
    vi.mocked(runSmallTask).mockClear();
    localStorage.setItem("oprn:storyboard-mode", "list");
    _resetEventDraftVaultForTest();
  });

  afterEach(async () => {
    document.querySelector<HTMLElement>('[data-testid="event-record-picker"] .event-subdialog-close')?.click();
    document.querySelector<HTMLElement>('[data-testid="event-command-edit-cancel"]')?.click();
    document.querySelector<HTMLElement>('[data-testid="event-command-picker-cancel"]')?.click();
    document.querySelector('[data-testid="event-editor-modal"]')?.remove();
    await Promise.resolve();
    resetModalStackForTest();
    _resetEventDraftVaultForTest();
    localStorage.clear();
  });

  it.each(["ctrlKey", "metaKey"])("runs the small task on %s+Enter without saving and closing", async modifier => {
    await openEditor();
    const modal = control("event-editor-modal");
    const onModalKeyDown = vi.fn();
    modal.addEventListener("keydown", onModalKeyDown);
    const save = vi.spyOn(control("event-editor-save"), "click");
    control("small-task-open").click();
    const input = modal.querySelector<HTMLInputElement>(".event-editor-small-task input")!;
    input.value = "이벤트 이름 확인";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const key = new KeyboardEvent("keydown", { key: "Enter", [modifier]: true, bubbles: true, cancelable: true });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(onModalKeyDown).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(modal.querySelector(".small-task-status")?.textContent).toBe("바뀐 내용이 없어요."));
    expect(runSmallTask).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(modal.isConnected).toBe(true);
  });

  it("closes the editor from the close button while the header menu is the top layer", async () => {
    await openEditor();
    const modal = control("event-editor-modal");
    const menu = control<HTMLDetailsElement>("event-editor-header-more");
    menu.open = true;
    await Promise.resolve();
    expect(isTopModal(menu)).toBe(true);
    // 브라우저의 toggle 은 태스크로 늦게 온다. 그 이벤트가 오기 전에 닫기를 눌러도 창이 닫혀야 한다.
    const dispatch = menu.dispatchEvent.bind(menu);
    menu.dispatchEvent = (event: Event) => {
      if (event.type === "toggle") return true;
      return dispatch(event);
    };
    const removeListener = vi.spyOn(document, "removeEventListener");
    try {
      control("event-editor-modal-close").click();
      expect(modal.isConnected).toBe(false);
      expect(isTopModal(menu)).toBe(false);
      expect(removeListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    } finally {
      removeListener.mockRestore();
    }
  });

  it.each(["ctrlKey", "metaKey"] as const)("applies on %s+S inside a field that owns Ctrl+Enter", async (modifier) => {
    await openEditor();
    const modal = control("event-editor-modal");
    const input = control<HTMLInputElement>("event-editor-name");
    input.setAttribute("data-owns-ctrl-enter", "");
    input.focus();
    const apply = vi.spyOn(control("event-editor-apply"), "click");
    const save = vi.spyOn(control("event-editor-save"), "click");
    const key = new KeyboardEvent("keydown", {
      key: "s", [modifier]: true, bubbles: true, cancelable: true,
    });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(modal.isConnected).toBe(true);

    const enter = new KeyboardEvent("keydown", {
      key: "Enter", [modifier]: true, bubbles: true, cancelable: true,
    });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey"] as const)("applies on %s+S from the open small-task input", async (modifier) => {
    await openEditor();
    const modal = control("event-editor-modal");
    control("small-task-open").click();
    const box = modal.querySelector<HTMLElement>(".event-editor-small-task");
    const input = box?.querySelector("input");
    if (!box || !input) throw new Error("missing small-task input");
    expect(isTopModal(box)).toBe(true);
    input.focus();
    const apply = vi.spyOn(control("event-editor-apply"), "click");
    const save = vi.spyOn(control("event-editor-save"), "click");
    const key = new KeyboardEvent("keydown", {
      key: "s", [modifier]: true, bubbles: true, cancelable: true,
    });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(modal.isConnected).toBe(true);
  });

  it("leaves Ctrl+S to a dialog stacked above the small-task input", async () => {
    await openEditor();
    const modal = control("event-editor-modal");
    control("small-task-open").click();
    const input = modal.querySelector<HTMLInputElement>(".event-editor-small-task input");
    if (!input) throw new Error("missing small-task input");
    const shield = document.createElement("div");
    document.body.append(shield);
    registerModal(shield, () => undefined);
    const apply = vi.spyOn(control("event-editor-apply"), "click");
    try {
      const key = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
      input.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(false);
      expect(apply).not.toHaveBeenCalled();
      expect(modal.isConnected).toBe(true);
    } finally {
      unregisterModal(shield);
      shield.remove();
    }
  });

  it("leaves Ctrl+Enter to inputs that own the shortcut", async () => {
    await openEditor();
    const input = control<HTMLInputElement>("event-editor-name");
    const save = vi.spyOn(control("event-editor-save"), "click");
    const pressShortcut = () => input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", ctrlKey: true, bubbles: true, cancelable: true,
    }));
    input.setAttribute("data-owns-ctrl-enter", "");
    input.focus();
    pressShortcut();
    expect(save).not.toHaveBeenCalled();

    input.removeAttribute("data-owns-ctrl-enter");
    pressShortcut();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps focus for both redo shortcuts after undo removes the last command", async () => {
    const { readCommands } = await openEditor();
    chooseCommand("text", "문장 표시");
    const body = control<HTMLTextAreaElement>("event-command-text-body");
    body.value = "Hello";
    body.dispatchEvent(new Event("input", { bubbles: true }));
    control("event-command-edit-ok").click();

    const head = await vi.waitFor(() => {
      const row = control("event-command-text").querySelector<HTMLElement>(".cmd-head");
      if (!row) throw new Error("Missing command row");
      return row;
    });
    const authored = structuredClone(readCommands());
    expect(authored).toMatchObject([{ kind: "text", body: "Hello" }]);
    head.focus();
    pressHistoryKey("z");
    expect(readCommands()).toEqual([]);
    expect(document.activeElement).toBe(control("event-command-empty-line"));
    pressHistoryKey("y");
    expect(readCommands()).toEqual(authored);

    pressHistoryKey("z");
    expect(readCommands()).toEqual([]);
    pressHistoryKey("Z", true);
    expect(readCommands()).toEqual(authored);

    control("event-command-search").focus();
    expect(pressHistoryKey("z").defaultPrevented).toBe(false);
    expect(readCommands()).toEqual(authored);
  });

  it("requires a switch and saves empty arms while preserving an existing branch", async () => {
    const oldFork = {
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [{ kind: "text", body: "" }],
      else: [{ kind: "text", body: "Existing" }],
    } satisfies Command;
    const { mapId, switchId, readCommands } = await openEditor([oldFork]);
    chooseCommand("fork", "조건 분기");
    const ok = control("event-command-edit-ok");
    const error = control("event-condition-switch-error");
    const initialOkClass = ok.className;
    expect(ok.hasAttribute("disabled")).toBe(true);
    expect(ok.getAttribute("aria-disabled")).toBe("true");
    expect(ok.classList.contains("btn")).toBe(false);
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("대상 스위치를 선택하세요.");
    ok.click();
    expect(readCommands()).toEqual([oldFork]);

    const value = control<HTMLSelectElement>("event-condition-switch-value");
    expect(value.value).toBe("true");
    value.value = "false";
    value.dispatchEvent(new Event("change", { bubbles: true }));
    control("event-switch-picker-open").click();
    control("event-record-picker-row-1").click();
    control("event-record-picker-ok").click();
    expect(value.value).toBe("false");
    expect(ok.hasAttribute("disabled")).toBe(false);
    expect(ok.getAttribute("aria-disabled")).toBe("false");
    expect(ok.className).toBe(initialOkClass);
    expect(error.hidden).toBe(true);

    const elseToggle = control<HTMLInputElement>("event-fork-else-enabled");
    expect(elseToggle.checked).toBe(false);
    elseToggle.click();
    ok.click();
    const newFork = {
      kind: "fork",
      condition: { kind: "switch", switchId, value: false },
      then: [],
      else: [],
    };
    await vi.waitFor(() => {
      expect(control(`event-command-branch-empty-1-${FORK_THEN_BRANCH_INDEX}`).dataset.containerPath)
        .toBe(JSON.stringify([1, FORK_THEN_BRANCH_INDEX]));
      expect(control(`event-command-branch-empty-1-${FORK_ELSE_BRANCH_INDEX}`).dataset.containerPath)
        .toBe(JSON.stringify([1, FORK_ELSE_BRANCH_INDEX]));
    });
    expect(readCommands()).toEqual([oldFork, newFork]);
    control("event-editor-apply").click();
    const reloaded = deserialize(serialize(store.getCurrent()));
    expect(reloaded.maps[mapId]!.events[0]!.pages![0].commands).toEqual([oldFork, newFork]);
  });

  it("disables row moves at each sibling boundary, including reused branch rows", () => {
    const root = document.createElement("div");
    const actions: CommandListActions = {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn(),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    };
    const first: Command = { kind: "text", body: "First" };
    const second: Command = { kind: "text", body: "Second" };
    const fork = {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_0001", value: true },
      then: [first],
      else: [second],
    } satisfies Command;
    const buttons = (path: number[]) =>
      [...root.querySelectorAll<HTMLButtonElement>(`[data-cmd-path='${JSON.stringify(path)}'] .cmd-actions button`)];
    const expectBounds = (path: number[], up: boolean, down: boolean) => {
      const moveButtons = buttons(path).slice(0, 2);
      expect(moveButtons.map(button => button.hasAttribute("disabled"))).toEqual([up, down]);
      expect(moveButtons.map(button => button.getAttribute("aria-disabled"))).toEqual([String(up), String(down)]);
      expect(moveButtons.map(button => button.classList.contains("btn"))).toEqual([false, false]);
    };
    const thenPath = [0, FORK_THEN_BRANCH_INDEX];
    const elsePath = [0, FORK_ELSE_BRANCH_INDEX];
    const options = { reuseImmutableRows: true };

    renderCommandList(root, [fork], [], actions, options);
    expectBounds([0], true, true);
    expectBounds([...thenPath, 0], true, true);
    expectBounds([...elsePath, 0], true, true);

    renderCommandList(root, [{ ...fork, then: [first, second] }, first], [], actions, options);
    expectBounds([0], true, false);
    expectBounds([1], false, true);
    expectBounds([...thenPath, 0], true, false);
    expectBounds([...thenPath, 1], false, true);
    expectBounds([...elsePath, 0], true, true);
    buttons([...thenPath, 0])[0]!.click();
    buttons([...thenPath, 0])[1]!.click();
    expect(actions.moveCommand).toHaveBeenCalledExactlyOnceWith([...thenPath, 0], 1);
  });
});
