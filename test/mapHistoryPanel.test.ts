import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type HistoryMeta = {
  readonly index: number;
  readonly label: string;
  readonly mapId: string | null;
  readonly at: number;
  readonly current: boolean;
};

type TestMutationObserverCallback = (records: MutationRecord[], observer: MutationObserver) => void;

const historyMock = vi.hoisted(() => ({
  entries: [] as HistoryMeta[],
  state: { canUndo: false, canRedo: false },
  undoMapEdit: vi.fn(() => true),
  redoMapEdit: vi.fn(() => true),
  revertToHistoryIndex: vi.fn(() => true),
}));

vi.mock("@/editor/mapEditHistory", () => ({
  MAP_EDIT_HISTORY_EVENT: "rpgzzu:map-edit-history-change",
  getMapEditHistoryEntries: () => historyMock.entries,
  getMapEditHistoryState: () => historyMock.state,
  undoMapEdit: historyMock.undoMapEdit,
  redoMapEdit: historyMock.redoMapEdit,
  revertToHistoryIndex: historyMock.revertToHistoryIndex,
}));

import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { installMapHistoryPanelAutoMount, renderMapHistoryPanel } from "@/editor/panels/mapHistoryPanel";

let restoreDom: (() => void) | null = null;
let listeners: Map<string, EventListener[]>;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId });
  historyMock.entries = [];
  historyMock.state = { canUndo: false, canRedo: false };
  historyMock.undoMapEdit.mockClear();
  historyMock.redoMapEdit.mockClear();
  historyMock.revertToHistoryIndex.mockClear();
  listeners = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      confirm: vi.fn(() => true),
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "MutationObserver");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderMapHistoryPanel());
}

describe("map history panel", () => {
  it("renders entries, current marker, and map labels", () => {
    const mapId = store.getCurrent().startMapId;
    historyMock.entries = [
      { index: 2, label: "AI: 집 건설", mapId, at: 2, current: true },
      { index: 1, label: "타일 편집", mapId: "map_other", at: 1, current: false },
    ];

    const panel = renderPanel();

    expect(panel.textContent).toContain("AI: 집 건설");
    expect(panel.textContent).toContain("● 현재");
    expect(panel.textContent).toContain(store.getCurrent().maps[mapId].name);
    expect(panel.textContent).toContain("다른 맵");
    expect(findByTestId(panel, "history-revert-2")).toBeTruthy();
  });

  it("reverts a history point after confirmation (커스텀 모달 §2.4)", async () => {
    const mapId = store.getCurrent().startMapId;
    historyMock.entries = [{ index: 4, label: "되돌릴 지점", mapId, at: 4, current: false }];
    const panel = renderPanel();

    findByTestId(panel, "history-revert-4")?.click();

    // 네이티브 confirm 대신 커스텀 인앱 모달이 뜬다 — 확인을 눌러야 되돌린다.
    const bodyEl = document.body as unknown as FakeElement;
    expect(findByTestId(bodyEl, "app-confirm-modal")).toBeTruthy();
    expect(historyMock.revertToHistoryIndex).not.toHaveBeenCalled();
    findByTestId(bodyEl, "app-modal-confirm")?.click();
    await Promise.resolve();
    expect(historyMock.revertToHistoryIndex).toHaveBeenCalledWith(4);
  });

  it("toggles undo and redo disabled state from history events", () => {
    const panel = renderPanel();
    const undo = findByTestId(panel, "history-undo");
    const redo = findByTestId(panel, "history-redo");
    if (!undo || !redo) throw new Error("history buttons missing");

    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    historyMock.state = { canUndo: true, canRedo: true };
    window.dispatchEvent(new Event(MAP_EDIT_HISTORY_EVENT));

    expect(findByTestId(panel, "history-undo")?.disabled).toBe(false);
    expect(findByTestId(panel, "history-redo")?.disabled).toBe(false);
  });

  it("remounts the panel when the palette root is rerendered", async () => {
    const observerState: { callback?: TestMutationObserverCallback; observer?: MutationObserver } = {};
    class TestMutationObserver implements MutationObserver {
      constructor(callback: TestMutationObserverCallback) {
        observerState.callback = callback;
        observerState.observer = this;
      }

      disconnect(): void {
      }

      observe(): void {
      }

      takeRecords(): MutationRecord[] {
        return [];
      }
    }
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: TestMutationObserver,
    });
    const root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);

    installMapHistoryPanelAutoMount();
    await Promise.resolve();
    expect(root.querySelector('[data-testid="map-history-panel"]')).toBeTruthy();

    root.replaceChildren();
    expect(root.querySelector('[data-testid="map-history-panel"]')).toBeNull();
    const observer = observerState.observer;
    const observerCallback = observerState.callback;
    if (!observer || !observerCallback) throw new Error("history panel observer was not installed");

    observerCallback([], observer);

    expect(root.querySelector('[data-testid="map-history-panel"]')?.textContent).toContain("작업 기록이 없습니다");
  });
});
