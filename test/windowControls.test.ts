import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTopbar } from "@/editor/panels/menu";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const TOOLBAR_COLLAPSED_KEY = "oprn:toolbar-collapsed";

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
  it("툴바 접기 버튼이 body 클래스와 localStorage를 토글한다", () => {
    const topbar = document.createElement("div");
    renderTopbar(topbar);
    const collapse = findByTestId(fakeElement(topbar), "window-toolbar-collapse");
    if (!collapse) throw new Error("window-toolbar-collapse button missing");

    collapse.click();

    expect(document.body.classList.contains("toolbar-collapsed")).toBe(true);
    expect(storage.getItem(TOOLBAR_COLLAPSED_KEY)).toBe("1");
    expect(collapse.textContent).toBe("▾");

    collapse.click();

    expect(document.body.classList.contains("toolbar-collapsed")).toBe(false);
    expect(storage.getItem(TOOLBAR_COLLAPSED_KEY)).toBe("0");
    expect(collapse.textContent).toBe("─");
  });

  it("저장된 툴바 접기 상태를 renderTopbar에서 복원한다", () => {
    storage.setItem(TOOLBAR_COLLAPSED_KEY, "1");
    const topbar = document.createElement("div");

    renderTopbar(topbar);

    const collapse = findByTestId(fakeElement(topbar), "window-toolbar-collapse");
    expect(document.body.classList.contains("toolbar-collapsed")).toBe(true);
    expect(collapse?.textContent).toBe("▾");
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
});
