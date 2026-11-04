/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  openWorldPanel: vi.fn(),
  openAiSettingsModal: vi.fn(),
}));

vi.mock("@/editor/panels/worldEntries", () => ({
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

describe("에디터 헤더 복구", () => {
  it("스튜디오 바의 정해진 집들을 유지한다", () => {
    // Break: a bottom-bar cleanup accidentally removes established top/editor chrome again.
    const topbar = document.createElement("div");

    renderTopbar(topbar);

    const surface = fakeElement(topbar);
    expect(findByTestId(surface, "editor-product-brand")).not.toBeNull();
    for (const testId of [
      "menu-project",
      // 맵 메뉴는 2026-08-26 에, 게임 메뉴·클래식 툴바 행·작업 칩은 2026-09-03 에 사라졌다 —
      // 전부 다른 자리에 이미 있는 동작의 복제였다.
      // 2026-11 개편: 세계관·음악·찾기·전투 테스트·스튜디오·보기·명령 팔레트 칩·전체화면은 ⌘K 명령으로만 닿는다.
      "toolbar-save",
      "toolbar-database",
      "toolbar-resource-manager",
      "topbar-assistant",
      "topbar-test-play",
    ]) {
      expect(findByTestId(surface, testId), testId).not.toBeNull();
    }
    for (const moved of ["toolbar-world", "toolbar-sound-test", "toolbar-search", "topbar-battle-test", "topbar-ai-studio", "window-fullscreen"]) {
      expect(findByTestId(surface, moved), `${moved} 는 ⌘K 로 옮겼다`).toBeNull();
    }
    for (const gone of ["menu-game", "oprn-toolbar", "toolbar-new", "toolbar-map-copy", "authoring-task-launcher", "window-toolbar-collapse"]) {
      expect(findByTestId(surface, gone), gone).toBeNull();
    }
  });

  it("⌘K 「AI 설정 열기」 명령이 설정 모달을 연다 — 톱바에는 ⋯ 가 없다", async () => {
    // Break: settings remains buried in the assistant panel, or the ⋯ button returns without a ⌘K home for it.
    const topbar = document.createElement("div");
    renderTopbar(topbar);
    expect(findByTestId(fakeElement(topbar), "menu-more-tools")).toBeNull();

    const { listEditorCommands } = await import("@/editor/commandRegistry");
    listEditorCommands().find((command) => command.id === "topbar-ai-settings")?.run();

    await vi.waitFor(() => expect(mocks.openAiSettingsModal).toHaveBeenCalledTimes(1));
  });

  it("legacy openVillageInfoModal 진입점은 세계관 패널로 리다이렉트한다", async () => {
    const { openVillageInfoModal } = await import("@/editor/panels/villageInfoModal");

    openVillageInfoModal();

    expect(mocks.openWorldPanel).toHaveBeenCalledTimes(1);
  });
});
