import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  duplicateMap: vi.fn(() => "map-copy"),
  selectEditorMap: vi.fn(() => true),
  showConfirm: vi.fn(async () => true),
  showPromptInput: vi.fn(async () => "새 프로젝트"),
}));

vi.mock("@/editor/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/actions")>();
  return { ...actual, duplicateMap: mocks.duplicateMap };
});
vi.mock("@/editor/mapSelection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/mapSelection")>();
  return { ...actual, selectEditorMap: mocks.selectEditorMap };
});
vi.mock("@/editor/ui/modal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/ui/modal")>();
  return { ...actual, showConfirm: mocks.showConfirm, showPromptInput: mocks.showPromptInput };
});

const { renderTopbar } = await import("@/editor/panels/menu");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let previousWindow: unknown;

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  installBrowserGlobals();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null });
  mocks.duplicateMap.mockClear();
  mocks.selectEditorMap.mockClear();
  mocks.showConfirm.mockClear();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  resetEditorUiModeForTests("standard");
  vi.restoreAllMocks();
});

describe("editor chrome and canvas controls", () => {
  it("enables new project without a stub class and runs newProject", async () => {
    resetEditorUiModeForTests("expert");
    // Break: bottom-bar cleanup removes or disables the existing classic toolbar action.
    const loadNew = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "rpg-zzu-test" });
    const topbar = document.createElement("div");

    renderTopbar(topbar);
    const button = findByTestId(fake(topbar), "toolbar-new");
    expect(button?.disabled).toBe(false);
    expect(button?.classList.contains("classic-toolbar-stub")).toBe(false);

    button?.click();
    await vi.waitFor(() => expect(loadNew).toHaveBeenCalledTimes(1));
    expect(loadNew.mock.calls[0]?.[1]).toMatchObject({ title: "새 프로젝트" });
  });

  it("duplicates the current-or-start map and selects the copy", () => {
    resetEditorUiModeForTests("expert");
    const project = store.getCurrent();
    const topbar = document.createElement("div");

    renderTopbar(topbar);
    const button = findByTestId(fake(topbar), "toolbar-map-copy");
    expect(button?.disabled).toBe(false);
    expect(button?.classList.contains("classic-toolbar-stub")).toBe(false);

    button?.click();
    expect(mocks.duplicateMap).toHaveBeenCalledWith(project.startMapId);
    expect(mocks.selectEditorMap).toHaveBeenCalledWith("map-copy");
  });

  it("persists expert canvas toolbar expansion across renders", () => {
    resetEditorUiModeForTests("expert");
    const firstHost = document.createElement("div");
    renderCanvasToolbar(firstHost);
    const expand = findByTestId(fake(firstHost), "editor-canvas-toolbar-expand");

    expand?.click();
    expect(localStorage.getItem("oprn:canvas-toolbar-expanded")).toBe("1");
    expect(expand?.getAttribute("aria-expanded")).toBe("true");

    const secondHost = document.createElement("div");
    renderCanvasToolbar(secondHost);
    const secondExpand = findByTestId(fake(secondHost), "editor-canvas-toolbar-expand");
    expect(fake(secondHost).classList.contains("is-expanded")).toBe(true);
    expect(secondExpand?.getAttribute("aria-expanded")).toBe("true");

    secondExpand?.click();
    expect(localStorage.getItem("oprn:canvas-toolbar-expanded")).toBe("0");
  });

  // 2026-08-26: standard 전용 ⋯ (`standard-more-tools`) 메뉴를 제거하면서 이 배치 테스트도 삭제했다.
  // 그 메뉴는 `.oprn-menu-popup{display:none}` 상황에서 `.open` 을 붙이지 않아 실제로는 열리지
  // 않았고(이 테스트는 `hidden` 필드만 봐서 통과했다), 담긴 4개 항목은 전부 「도구」 메뉴와
  // 중복이었다. 대심 커버리지: test/editorMenuSidebarIa.test.ts — ⋯ 메뉴 부재 + 편집 모드가
  // ▤ 메뉴에서 모든 모드에서 도달 가능함을 검증한다.
});
