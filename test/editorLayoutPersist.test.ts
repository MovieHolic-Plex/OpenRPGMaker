import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { MapEditLockStatus } from "@/editor/mapEditLocks";

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const LAYOUT_VERSION = "2026-07-24-maptree-300";

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
  storage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
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
    lockOwnerPhrase: (ownerLabel: string) => `${ownerLabel} 세션이 편집 중`,
    mapEditLockLastActivityText: () => "방금 활동",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock,
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    // 도크 축이 삭제돼 `onChatDockToggle` 콜백과 `chat-dock-toggle` 픽스처도 함께 빠졌다.
    renderAiChatPanel: (options?: {
      readonly getAssistantTemperature?: () => string;
    }) => {
      const panel = document.createElement("aside");
      panel.dataset.testid = "ai-panel";
      panel.dataset.temperature = options?.getAssistantTemperature?.() ?? "";
      panel.className = "ai-chat-panel";
      const log = document.createElement("div");
      log.dataset.testid = "ai-chat-log";
      panel.append(log);
      return panel;
    },
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

/**
 * 표준 모드를 심는다. 저장값이 없는 첫 방문은 **초보**로 떨어지고(applyFirstVisitEditorUiMode),
 * 초보의 아이콘 레일(`chrome.paletteRail`)은 `applyLayout` 을 폭/맵트리 높이 적용 **전에**
 * early-return 시킨다 — 그러면 복원값이 DOM 에 닿는지 볼 수 없다.
 */
function useStandardUiMode(): void {
  storage.setItem("oprn:editor-ui-mode", "standard");
}

/** fake DOM 의 style 은 Record 라 커스텀 프로퍼티를 인덱스로 읽는다. */
function cssVar(node: FakeElement | null, name: string): string {
  return node?.style[name] ?? "";
}

/** 리사이저를 0px 만큼 끌어 현재 값을 그대로 다시 저장시킨다 — 모듈 전역 leftWidth/mapTreeHeight 관측용. */
function resaveLayout(root: FakeElement): Record<string, unknown> {
  const leftResizer = root.querySelector(".resizer-left");
  if (!leftResizer) throw new Error("resizer-left missing");
  leftResizer.dispatchEvent(mouseEvent("mousedown", { clientX: 0 }));
  document.dispatchEvent(mouseEvent("mousemove", { clientX: 0 }));
  document.dispatchEvent(mouseEvent("mouseup", {}));
  return JSON.parse(storage.getItem(EDITOR_LAYOUT_KEY) ?? "{}") as Record<string, unknown>;
}

describe("에디터 레이아웃 크기 저장", () => {
  // 삭제(2026-08-31): "채팅 dock 토글은 같은 패널 DOM을 float host와 side panel 사이에서 옮기고 저장한다",
  // "저장된 채팅 side dock을 복원한다" — 도크 축(chatDock)이 삭제됐다. 도크는 입력줄 하나뿐이고
  // side panel(`chat-side-panel`)·`toggleChatDock`·`editorState.chatDock` 이 전부 사라져
  // 두 케이스는 주제 자체가 없다. 저장 페이로드에서 `chatDock` 이 빠졌다는 계약은 아래 두
  // 케이스가 못박는다.
  //
  // `leftCollapsed` 는 2026-08-29 에 저장 페이로드에서 **빠졌다**. 선언·토글·저장은 있었는데
  // `applyLayout` 이 읽지 않는 죽은 상태였고(.omo/plans/sidebar-ux.md §1-1 B-7), 되살리면
  // "좌측 사이드바는 절대 비지 않는다" 불변식과 싸운다. 그래서 크기만 저장한다.
  it("리사이저 mouseup 시 크기를 저장하고 모듈 재로드 후 복원한다 (접힘 상태·도크는 저장하지 않는다)", async () => {
    useStandardUiMode();
    const { renderEditor } = await import("@/editor/panels/editor");
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

    // 기본값 526/300 에서 각각 +100 / +6(위로 끌면 커진다).
    const saved: unknown = JSON.parse(storage.getItem(EDITOR_LAYOUT_KEY) ?? "{}");
    expect(saved).toMatchObject({ leftWidth: 626, mapTreeHeight: 306 });
    expect(saved).not.toHaveProperty("leftCollapsed");
    expect(saved).not.toHaveProperty("chatDock");

    vi.resetModules();
    mockEditorDependencies();
    const reloaded = await import("@/editor/panels/editor");
    const nextMain = document.createElement("main");
    reloaded.renderEditor(nextMain);

    const nextRoot = fakeElement(nextMain);
    const nextLeft = nextRoot.querySelector(".left-panel");
    expect(nextLeft?.style.display).not.toBe("none");
    // 맵트리 높이는 좌패널의 `--map-tree-height` 로 직접 관측된다. 좌패널 폭은 표준 모드의
    // `leftPanelMaxWidthPx`(300) 에 눌려 인라인 width 로는 보이지 않으니 재저장으로 읽는다.
    expect(cssVar(nextLeft, "--map-tree-height")).toBe("306px");
    expect(resaveLayout(nextRoot)).toMatchObject({ leftWidth: 626, mapTreeHeight: 306 });
    // 이 파일의 첫 테스트가 `@/editor/panels/editor` 그래프 전체를 처음 변환·실행한다 —
    // 이 저장소에서 그 비용만 70초대다(뒤 테스트는 5~10초). 대기가 아니라 상한이다.
  }, 180_000);

  it("좁은 뷰포트에서도 좌측 사이드바를 접어 숨기지 않는다", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 480 });
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    expect(fakeElement(main).querySelector(".left-panel")?.style.display).not.toBe("none");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  }, 120_000);

  it("저장된 크기를 기존 범위로 clamp해서 복원하고 잘못된 JSON은 기본값으로 무시한다", async () => {
    // 낡은 `chatDock` 키를 일부러 남겨 둔다 — 로더가 모르는 키를 무시하고 크기만 읽어야 한다
    // (마이그레이션 없이 다음 저장에서 자연히 사라지는 설계).
    useStandardUiMode();
    storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 9999, mapTreeHeight: -1, leftCollapsed: false, chatDock: "float" }));
    vi.resetModules();
    mockEditorDependencies();
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");

    renderEditor(main);

    const root = fakeElement(main);
    // 9999 → 좌패널 max 640, -1 → 맵트리 min 80.
    expect(cssVar(root.querySelector(".left-panel"), "--map-tree-height")).toBe("80px");
    const resaved = resaveLayout(root);
    expect(resaved).toMatchObject({ leftWidth: 640, mapTreeHeight: 80 });
    expect(resaved).not.toHaveProperty("chatDock");

    storage.setItem(EDITOR_LAYOUT_KEY, "{broken");
    vi.resetModules();
    mockEditorDependencies();
    const fresh = await import("@/editor/panels/editor");
    const freshMain = document.createElement("main");
    fresh.renderEditor(freshMain);

    const freshRoot = fakeElement(freshMain);
    // 파싱 실패는 조용히 기본값(526 / 300)으로 떨어진다.
    expect(cssVar(freshRoot.querySelector(".left-panel"), "--map-tree-height")).toBe("300px");
    expect(resaveLayout(freshRoot)).toMatchObject({ leftWidth: 526, mapTreeHeight: 300 });
  }, 120_000);

  it("맵 트리 높이는 기본이 자동이고, 리사이저를 끌면 수동으로 저장되며 더블클릭이 자동으로 되돌린다", async () => {
    useStandardUiMode();
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    const root = fakeElement(main);
    const mapTreeResizer = findByTestId(root, "map-tree-height-resizer");
    if (!mapTreeResizer) throw new Error("map tree resizer missing");

    // 첫 저장(폭 리사이저 0px)에서 자동 플래그가 함께 남는다.
    expect(resaveLayout(root)).toMatchObject({ mapTreeAuto: true, mapTreeHeight: 300 });

    mapTreeResizer.dispatchEvent(mouseEvent("mousedown", { clientY: 0 }));
    document.dispatchEvent(mouseEvent("mousemove", { clientY: -20 }));
    document.dispatchEvent(mouseEvent("mouseup", {}));
    expect(JSON.parse(storage.getItem(EDITOR_LAYOUT_KEY) ?? "{}")).toMatchObject({ mapTreeAuto: false, mapTreeHeight: 320 });
    expect(cssVar(root.querySelector(".left-panel"), "--map-tree-height")).toBe("320px");

    mapTreeResizer.dispatchEvent(mouseEvent("dblclick", {}));
    expect(JSON.parse(storage.getItem(EDITOR_LAYOUT_KEY) ?? "{}")).toMatchObject({ mapTreeAuto: true });
  }, 120_000);

  it("자동 플래그가 없는 옛 저장본은 높이가 기본값이면 자동, 다른 값이면 수동으로 읽는다", async () => {
    useStandardUiMode();
    storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 526, mapTreeHeight: 154 }));
    vi.resetModules();
    mockEditorDependencies();
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    const root = fakeElement(main);
    // 154 는 끌어서 만든 값 — 자동으로 덮지 않고 그대로 쓴다.
    expect(cssVar(root.querySelector(".left-panel"), "--map-tree-height")).toBe("154px");
    expect(resaveLayout(root)).toMatchObject({ mapTreeAuto: false, mapTreeHeight: 154 });

    storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 526, mapTreeHeight: 300 }));
    vi.resetModules();
    mockEditorDependencies();
    const again = await import("@/editor/panels/editor");
    const againMain = document.createElement("main");
    again.renderEditor(againMain);
    expect(resaveLayout(fakeElement(againMain))).toMatchObject({ mapTreeAuto: true });
  }, 120_000);

  it("저장된 조수 대기 화면을 복원한다", async () => {
    storage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
    storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({
      leftWidth: 526,
      mapTreeHeight: 154,
      assistantTemperature: "ink-only",
    }));
    vi.resetModules();
    mockEditorDependencies();
    const { renderEditor } = await import("@/editor/panels/editor");
    const { editorState } = await import("@/editor/editorState");
    const main = document.createElement("main");

    renderEditor(main);

    expect(editorState.get().assistantTemperature).toBe("ink-only");
    expect(findByTestId(fakeElement(main), "ai-panel")?.dataset.temperature).toBe("ink-only");
  }, 120_000);
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
    const takeover = findByTestId(fakeElement(main), "map-lock-banner-takeover");
    if (!takeover) throw new Error("map-lock-banner-takeover button missing");

    takeover.click();
    // 비즉시 takeover는 커스텀 인앱 모달(§2.4)로 확인을 받는다 — 확인을 눌러야 호출된다.
    await vi.waitFor(() => {
      const confirm = findByTestId(fakeElement(document.body as unknown as HTMLElement), "app-modal-confirm");
      if (!confirm) throw new Error("app-modal-confirm not yet rendered");
      confirm.click();
    });
    await vi.waitFor(() => {
      expect(takeoverMapLock).toHaveBeenCalledWith(mapId, mapName);
    });
  }, 120_000);
});
