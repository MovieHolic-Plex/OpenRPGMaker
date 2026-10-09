import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTopbar } from "@/editor/panels/menu";
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

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

function installStorage(): void {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
}

function installFullscreenDocument(): void {
  const html = document.createElement("html");
  Object.defineProperty(document, "documentElement", {
    configurable: true,
    value: html,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    writable: true,
    value: null,
  });
  Object.defineProperty(document, "addEventListener", {
    configurable: true,
    value: vi.fn(),
  });
}

/**
 * 데스크톱 앱 렌더러 흉내 — 기본 vitest 환경(node)에는 window 가 없다. 프리로드가 붙이는
 * window.oprn 브릿지를 window 위에 세우고, 끝나면 지우는 함수를 돌려준다. 코드가
 * `typeof window !== "undefined"` 로 가드를 걸므로 window 자체를 정의해야 하고,
 * 없는 속성(addEventListener 등)은 no-op 함수로 돌려준다.
 */
function installDesktopBridge(bridge: object | null): () => void {
  const base: Record<string, unknown> = bridge ? { oprn: bridge } : {};
  const win = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      if (prop === "document") return document;
      if (prop in globalThis) return (globalThis as Record<string | symbol, unknown>)[prop];
      return () => {};
    },
    has() { return true; },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: win });
  return () => {
    Reflect.deleteProperty(globalThis, "window");
  };
}

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installStorage();
  installFullscreenDocument();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("상단 창 컨트롤", () => {
  it("툴바 접기 버튼은 없다 — 접을 두 번째 툴바 행이 사라졌다(2026-09-03)", () => {
    // Break: 편집 모드 클래식 툴바 행이 되살아나 「─」 접기 버튼과 함께 돌아온다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    expect(findByTestId(fakeElement(topbar), "window-toolbar-collapse")).toBeNull();
    expect(findByTestId(fakeElement(topbar), "oprn-toolbar")).toBeNull();
    expect(document.body.classList.contains("toolbar-collapsed")).toBe(false);
  });

  it("전체화면 버튼이 requestFullscreen을 호출한다", () => {
    const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    const topbar = document.createElement("div");
    renderTopbar(topbar);
    const fullscreen = findByTestId(fakeElement(topbar), "window-fullscreen");
    if (!fullscreen) throw new Error("window-fullscreen button missing");

    fullscreen.click();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("전체화면 API가 없으면 토스트를 표시하고 예외 없이 반환한다", () => {
    const topbar = document.createElement("div");
    renderTopbar(topbar);
    const fullscreen = findByTestId(fakeElement(topbar), "window-fullscreen");
    if (!fullscreen) throw new Error("window-fullscreen button missing");

    expect(() => fullscreen.click()).not.toThrow();
    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("전체화면");
  });

  it("데스크톱 창 브릿지가 있으면 전체화면을 창 컨트롤로 토글한다", async () => {
    // Break: 브릿지가 있는데도 브라우저 Fullscreen API 를 부르면, 네이티브 전체화면으로 뜬
    // 앱 창은 「축소」가 되지 않는다(2026-10-05 사용자 보고).
    const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    const windowControl = vi.fn(async () => true);
    const disposeBridge = installDesktopBridge({ windowControl });
    try {
      const topbar = document.createElement("div");
      renderTopbar(topbar);
      const fullscreen = findByTestId(fakeElement(topbar), "window-fullscreen");
      if (!fullscreen) throw new Error("window-fullscreen button missing");

      fullscreen.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(windowControl).toHaveBeenCalledWith("toggle-fullscreen");
      expect(requestFullscreen).not.toHaveBeenCalled();
    } finally {
      disposeBridge();
    }
  });

  it("데스크톱 네이티브 전체화면 상태를 구독해 aria-pressed 를 맞춘다", async () => {
    // Break: 창 컨트롤로 들어간 전체화면은 document.fullscreenElement 를 바꾸지 않아
    // 아이콘이 항상 「아님」으로 남는다.
    const listeners: Array<(fullscreen: boolean) => void> = [];
    const disposeBridge = installDesktopBridge({
      windowControl: vi.fn(async () => true),
      windowFullscreen: async () => true,
      onWindowFullscreen: (callback: (fullscreen: boolean) => void) => {
        listeners.push(callback);
        return () => { listeners.length = 0; };
      },
    });
    try {
      const topbar = document.createElement("div");
      renderTopbar(topbar);
      const fullscreen = findByTestId(fakeElement(topbar), "window-fullscreen");
      if (!fullscreen) throw new Error("window-fullscreen button missing");

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fullscreen.getAttribute("aria-pressed")).toBe("true");

      for (const listener of listeners) listener(false);
      expect(fullscreen.getAttribute("aria-pressed")).toBe("false");
    } finally {
      disposeBridge();
    }
  });
});
