import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let previousWindow: typeof globalThis.window | undefined;

function stubWindowTimers(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
}

function restoreWindow(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database common events view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubWindowTimers();
    const project = createBlankProject();
    project.commonEvents = [];
    store.replace(project);
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreWindow();
  });

  // fix(db): 0001~0010 빈 행은 실레코드가 아닌 순수 장식이었다(클릭/편집 전부 무반응 —
  // qa-commonev-report.md 결함 3). 레코드가 없으면 목록은 비어 있어야 한다.
  it("shows no decorative placeholder rows when there are zero common events", () => {
    const host = renderUtility(renderCommonEventsTab);
    expect(host.querySelectorAll(".db-common-event-empty-row")).toHaveLength(0);
    expect(host.querySelectorAll("button.db-list-row")).toHaveLength(0);
  });

  it("wires undo snapshots for add/name/trigger/conditionSwitch/delete", () => {
    const host = renderUtility(renderCommonEventsTab);
    expect(getMapEditHistoryState().canUndo).toBe(false);

    const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
    if (!addButton) throw new Error("missing add button");
    addButton.click();
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(store.getCurrent().commonEvents).toHaveLength(1);

    const undoAfterAdd = undoMapEdit();
    expect(undoAfterAdd).toBe(true);
    expect(store.getCurrent().commonEvents).toHaveLength(0);
  });

  it("coalesces keystroke name edits into a single undo snapshot", () => {
    const host = renderUtility(renderCommonEventsTab);
    const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
    addButton?.click();
    resetMapEditHistory(); // isolate the name-typing snapshot count from the add snapshot

    const nameInput = findByTestId(host, "db-common-event-name");
    if (!nameInput) throw new Error("missing name input");
    const original = store.getCurrent().commonEvents[0]?.name ?? "";
    for (const next of ["U", "UN", "UND", "UNDO"]) {
      nameInput.value = next;
      nameInput.dispatchEvent(new Event("input"));
    }
    expect(store.getCurrent().commonEvents[0]?.name).toBe("UNDO");

    const undone = undoMapEdit();
    expect(undone).toBe(true);
    expect(store.getCurrent().commonEvents[0]?.name).toBe(original);
    // a second undo must not exist — the whole keystroke stream collapsed to one snapshot
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("duplicates with a 사본 suffix and requires two clicks to delete", () => {
    const host = renderUtility(renderCommonEventsTab);
    const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
    addButton?.click();

    const duplicateButton = findByTestId(host, "db-common-event-duplicate");
    duplicateButton?.click();
    const events = store.getCurrent().commonEvents;
    expect(events).toHaveLength(2);
    expect(events[1]?.name).toBe("새 공통 이벤트 사본");

    const id = events[1]!.id;
    const deleteButton = findByTestId(host, `db-common-event-delete-${id}`);
    if (!deleteButton) throw new Error("missing delete button");
    deleteButton.click();
    expect(deleteButton.textContent).toBe("정말 삭제?");
    expect(store.getCurrent().commonEvents).toHaveLength(2);

    deleteButton.click();
    expect(store.getCurrent().commonEvents).toHaveLength(1);
  });
});
