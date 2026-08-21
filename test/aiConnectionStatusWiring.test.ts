// AI 연동 칩 배선 회귀 테스트.
// renderAiConnectionStatus 가 실제 에디터 상태바(renderEditor → renderEditorStatusbar)에
// 렌더되어 DOM 에 나타나는지 검증한다. 칩 단위 동작은 aiConnectionStatus.test.ts 가 담당하고,
// 여기서는 "화면에 실제로 연결돼 있는가"만 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

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
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
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

// editor.ts 의 무거운 의존(Phaser·맵 잠금·AI 채팅 패널 등)을 가짜로 대체한다.
// 단, aiConnectionStatus 는 배선 대상이므로 mock 하지 않고 실제 모듈을 쓴다.
function mockEditorDependencies(): void {
  vi.doMock("@/app/mode", () => ({
    destroyGame: vi.fn(),
    getGame: vi.fn(() => null),
    startEditGame: vi.fn(async () => ({ scale: { resize: vi.fn() } })),
  }));
  vi.doMock("@/editor/editorToolHook", () => ({ installEditorToolHook: vi.fn(), cleanupProjectE2EBridge: vi.fn() }));
  vi.doMock("@/editor/mapEditLocks", () => ({
    ensureCurrentMapLock: vi.fn(),
    getMapEditLockStatus: () => ({ kind: "idle" }),
    isMapEditLockTakeoverImmediate: () => false,
    lockOwnerPhrase: (ownerLabel: string) => `${ownerLabel} 세션이 편집 중`,
    mapEditLockLastActivityText: () => "방금 활동",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock: vi.fn(async () => {}),
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    renderAiChatPanel: () => {
      const panel = document.createElement("aside");
      panel.dataset.testid = "ai-panel";
      return panel;
    },
    teardownAiChatPanel: vi.fn(),
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

const APIKEY_READY = {
  authMode: "apiKey",
  baseUrl: "https://gateway.invalid/v1",
  model: "z-ai/glm-5.2-ultrafast",
  liteModel: "z-ai/glm-5.2-ultrafast",
  apiKey: "sk-test-key",
  maxToolCalls: 200,
  maxTokens: 32768,
  reasoningEffort: "off" as const,
};

beforeEach(() => {
  vi.resetModules();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installStorage();
  installBrowserGlobals();
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

describe("AI 연동 칩 상태바 배선", () => {
  it("renderEditor 가 렌더한 상태바에 AI 연동 칩(testid: ai-connection-status)이 나타난다", async () => {
    storage.setItem("rpg-zzu:ai-config", JSON.stringify(APIKEY_READY));
    const { renderEditor, teardownEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");

    renderEditor(main);

    const chip = findByTestId(fakeElement(main), "ai-connection-status");
    expect(chip).not.toBeNull();
    // 칩은 클릭 가능한 버튼이어야 한다(설정 모달 진입점).
    expect(chip?.tagName.toLowerCase()).toBe("button");
    // 저장값이 apiKey 여도 OAuth 로 승격되므로, 동반 서비스 조회 전에는 "확인 중" 이 정상이다.
    // (옛 스펙은 여기서 '연결됨' 을 기대했다 — 설정 모양만 보고 초록을 칠하던 배선이다.)
    expect(chip?.textContent).toContain("확인 중");

    teardownEditor();
  });

  it("저장된 설정이 apiKey 여도 칩은 OAuth 상태를 가리킨다", async () => {
    // 키 유무로 칩을 칠하던 판정은 사라졌다 — 인증 경로가 OAuth 하나뿐이므로 "키 없음" 은
    // 더 이상 가능한 상태가 아니다. 이 스펙은 그 문구가 되살아나는 것을 막는다.
    storage.setItem("rpg-zzu:ai-config", JSON.stringify({ ...APIKEY_READY, apiKey: "" }));
    const { renderEditor, teardownEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");

    renderEditor(main);

    const chip = findByTestId(fakeElement(main), "ai-connection-status");
    expect(chip).not.toBeNull();
    expect(chip?.textContent).not.toContain("키 없음");
    expect(chip?.className).toContain("auth-chatgpt");

    teardownEditor();
  });
});
