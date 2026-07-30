import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  openWorldPanel: vi.fn(),
  openAiSettingsModal: vi.fn(),
}));

vi.mock("@/editor/panels/worldPanel", () => ({
  openWorldPanel: mocks.openWorldPanel,
}));

vi.mock("@/editor/panels/aiSettingsModal", () => ({
  openAiSettingsModal: mocks.openAiSettingsModal,
  closeAiSettingsModal: vi.fn(),
}));

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
let previousWindow: unknown;

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

function openToolsMenu(topbar: HTMLElement): FakeElement {
  const menu = findByTestId(fakeElement(topbar), "menu-tools");
  if (!menu) throw new Error("menu-tools missing");
  menu.click();
  let item = findByTestId(fakeBody(), "menu-tools-world");
  if (!item) {
    menu.click();
    item = findByTestId(fakeBody(), "menu-tools-world");
  }
  if (!item) throw new Error("menu-tools-world missing");
  return item;
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", {
    configurable: true,
    value: document.createElement("html"),
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
  Object.defineProperty(document, "removeEventListener", {
    configurable: true,
    value: vi.fn(),
  });
}

function installImportWindow(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: new MemoryStorage(),
    },
  });
}

function restoreWindow(value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value,
  });
}

const originalWindow = globalThis.window;
installImportWindow();
const { renderTopbar } = await import("@/editor/panels/menu");
restoreWindow(originalWindow);


beforeEach(() => {
  previousWindow = globalThis.window;
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installBrowserGlobals();
  mocks.openWorldPanel.mockClear();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  restoreWindow(previousWindow);
  vi.clearAllMocks();
});

describe("세계관 메뉴 표면", () => {
  it("툴바에는 세계관 버튼 하나만 남고 legacy 버튼 testid는 사라진다", () => {
    const topbar = document.createElement("div");

    renderTopbar(topbar);

    const toolbarWorld = findByTestId(fakeElement(topbar), "toolbar-world");
    expect(toolbarWorld?.getAttribute("title")).toBe("세계관");
    expect(toolbarWorld?.getAttribute("aria-label")).toBe("세계관");
    expect(findByTestId(fakeElement(topbar), "toolbar-village-info")).toBeNull();
    expect(findByTestId(fakeElement(topbar), "toolbar-evidence-packet")).toBeNull();
  });

  it("세계관 툴바 버튼은 세계관 패널을 연다", () => {
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    findByTestId(fakeElement(topbar), "toolbar-world")?.click();

    expect(mocks.openWorldPanel).toHaveBeenCalledTimes(1);
  });

  it("도구 메뉴는 세계관 항목을 노출하고 마을 정보 항목은 노출하지 않는다", () => {
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    openToolsMenu(topbar);

    const worldItem = findByTestId(fakeBody(), "menu-tools-world");
    expect(worldItem?.textContent).toBe("세계관...");
    expect(findByTestId(fakeBody(), "menu-tools-village-info")).toBeNull();
    expect(fakeBody().textContent).not.toContain("마을 정보");
  });

  it("도구 메뉴의 세계관 항목도 세계관 패널을 연다", () => {
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    openToolsMenu(topbar).click();

    expect(mocks.openWorldPanel).toHaveBeenCalledTimes(1);
  });

  it("legacy openVillageInfoModal 진입점은 세계관 패널로 리다이렉트한다", async () => {
    const { openVillageInfoModal } = await import("@/editor/panels/villageInfoModal");

    openVillageInfoModal();

    expect(mocks.openWorldPanel).toHaveBeenCalledTimes(1);
  });
});
