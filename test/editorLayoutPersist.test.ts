import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { MapEditLockStatus } from "@/editor/mapEditLocks";

const EDITOR_LAYOUT_KEY = "rpg-zzu:editor-layout";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type ListenerMap = Map<string, EventListener[]>;

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;
let documentListeners: ListenerMap;
let windowListeners: ListenerMap;
let lockStatus: MapEditLockStatus;
let takeoverMapLock: ReturnType<typeof vi.fn<(mapId: string, mapName: string) => Promise<void>>>;

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function addListener(listeners: ListenerMap, type: string, listener: EventListenerOrEventListenerObject | null): void {
  if (listener === null) return;
  const callable = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
  listeners.set(type, [...(listeners.get(type) ?? []), callable]);
}

function removeListener(listeners: ListenerMap, type: string, listener: EventListenerOrEventListenerObject | null): void {
  if (listener === null) return;
  const current = listeners.get(type) ?? [];
  listeners.set(type, current.filter((item) => item !== listener));
}

function dispatch(listeners: ListenerMap, event: Event): boolean {
  for (const listener of listeners.get(event.type) ?? []) listener(event);
  return !event.defaultPrevented;
}

function mouseEvent(type: string, point: { readonly clientX?: number; readonly clientY?: number }): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "clientX", { configurable: true, value: point.clientX ?? 0 });
  Object.defineProperty(event, "clientY", { configurable: true, value: point.clientY ?? 0 });
  return event;
}

function installBrowserGlobals(): void {
  documentListeners = new Map();
  windowListeners = new Map();
  Object.defineProperty(document, "addEventListener", {
    configurable: true,
    value: (type: string, listener: EventListenerOrEventListenerObject | null) => addListener(documentListeners, type, listener),
  });
  Object.defineProperty(document, "removeEventListener", {
    configurable: true,
    value: (type: string, listener: EventListenerOrEventListenerObject | null) => removeListener(documentListeners, type, listener),
  });
  Object.defineProperty(document, "dispatchEvent", {
    configurable: true,
    value: (event: Event) => dispatch(documentListeners, event),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      confirm: vi.fn(() => true),
      dispatchEvent: (event: Event) => dispatch(windowListeners, event),
      innerWidth: 1200,
      localStorage: storage,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => addListener(windowListeners, type, listener),
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => removeListener(windowListeners, type, listener),
    },
  });
}

function installStorage(): void {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
}

function mockEditorDependencies(): void {
  takeoverMapLock = vi.fn(async () => {});
  vi.doMock("@/app/mode", () => ({
    destroyGame: vi.fn(),
    getGame: vi.fn(() => null),
    startEditGame: vi.fn(async () => ({ scale: { resize: vi.fn() } })),
  }));
  vi.doMock("@/editor/editorToolHook", () => ({ installEditorToolHook: vi.fn() }));
  vi.doMock("@/editor/mapEditLocks", () => ({
    ensureCurrentMapLock: vi.fn(),
    getMapEditLockStatus: () => lockStatus,
    isMapEditLockTakeoverImmediate: () => false,
    mapEditLockLastActivityText: () => "방금 활동",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock,
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    renderAiChatPanel: () => document.createElement("div"),
  }));
  vi.doMock("@/editor/panels/editorZoomToolbar", () => ({
    renderCanvasToolbar: (node: HTMLElement) => {
      node.textContent = "zoom";
    },
  }));
  vi.doMock("@/editor/panels/dbConnectionSettings", () => ({
    renderDbConnectionStatus: () => document.createElement("button"),
  }));
  vi.doMock("@/editor/panels/mapList", () => ({
    renderMapList: (node: HTMLElement) => {
      node.textContent = "maps";
    },
  }));
  vi.doMock("@/editor/panels/testPlayModal", () => ({
    closeTestPlayModal: vi.fn(),
    openTestPlayModal: vi.fn(),
  }));
  vi.doMock("@/editor/panels/tilePalette", () => ({
    renderTilePalette: (node: HTMLElement) => {
      node.textContent = "tiles";
    },
  }));
}

beforeEach(() => {
  vi.resetModules();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installStorage();
  installBrowserGlobals();
  lockStatus = { kind: "idle" };
  mockEditorDependencies();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("에디터 레이아웃 크기 저장", () => {
  it("리사이저 mouseup과 좌측 패널 토글 시 저장하고 모듈 재로드 후 접힘을 복원한다", async () => {
    const { renderEditor, toggleLeftPanel } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    const leftResizer = fakeElement(main).querySelector(".resizer-left");
    const mapTreeResizer = findByTestId(fakeElement(main), "map-tree-height-resizer");
    if (!leftResizer || !mapTreeResizer) throw new Error("resizers missing");

    leftResizer.dispatchEvent(mouseEvent("mousedown", { clientX: 0 }));
    document.dispatchEvent(mouseEvent("mousemove", { clientX: 100 }));
    document.dispatchEvent(mouseEvent("mouseup", {}));
    mapTreeResizer.dispatchEvent(mouseEvent("mousedown", { clientY: 0 }));
    document.dispatchEvent(mouseEvent("mousemove", { clientY: -6 }));
    document.dispatchEvent(mouseEvent("mouseup", {}));
    toggleLeftPanel();

    expect(storage.getItem(EDITOR_LAYOUT_KEY)).toBe(JSON.stringify({ leftWidth: 626, mapTreeHeight: 160, leftCollapsed: true }));

    vi.resetModules();
    mockEditorDependencies();
    const reloaded = await import("@/editor/panels/editor");
    const nextMain = document.createElement("main");
    reloaded.renderEditor(nextMain);

    expect(reloaded.isLeftCollapsed()).toBe(true);
    expect(fakeElement(nextMain).querySelector(".left-panel")?.style.display).toBe("none");
  });

  it("저장된 크기를 기존 범위로 clamp해서 복원하고 잘못된 JSON은 기본값으로 무시한다", async () => {
    storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 9999, mapTreeHeight: -1, leftCollapsed: false }));
    vi.resetModules();
    mockEditorDependencies();
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");

    renderEditor(main);

    const leftPanel = fakeElement(main).querySelector(".left-panel");
    expect(leftPanel?.style.width).toBe("640px");
    expect(leftPanel?.style["--map-tree-height"]).toBe("112px");

    storage.setItem(EDITOR_LAYOUT_KEY, "{broken");
    vi.resetModules();
    mockEditorDependencies();
    const fresh = await import("@/editor/panels/editor");
    const freshMain = document.createElement("main");
    fresh.renderEditor(freshMain);

    const freshLeftPanel = fakeElement(freshMain).querySelector(".left-panel");
    expect(freshLeftPanel?.style.width).toBe("526px");
    expect(freshLeftPanel?.style["--map-tree-height"]).toBe("154px");
  });
});

describe("맵 잠금 상태바", () => {
  it("다른 세션이 잠근 맵이면 가져오기 버튼으로 takeover를 호출한다", async () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const mapName = project.maps[mapId].name;
    lockStatus = { kind: "locked", mapId, mapName, ownerLabel: "다른 브라우저", expiresAt: new Date().toISOString() };
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    const takeover = findByTestId(fakeElement(main), "map-lock-takeover");
    if (!takeover) throw new Error("map-lock-takeover button missing");

    takeover.click();
    await vi.waitFor(() => {
      expect(takeoverMapLock).toHaveBeenCalledWith(mapId, mapName);
    });
  });
});
