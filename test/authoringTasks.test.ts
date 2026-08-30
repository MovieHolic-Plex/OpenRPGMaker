import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { getEditorUiMode, resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { resetWorkspaceForTests } from "@/editor/workspace/workspaceStore";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  openDatabaseModal: vi.fn(),
}));

vi.mock("@/editor/panels/databaseModal", () => ({
  openDatabaseModal: mocks.openDatabaseModal,
}));
vi.mock("@/editor/panels/commandPalette", () => ({ requestCommandPalette: vi.fn() }));
vi.mock("@/app/mode", () => ({ getMode: () => "edit", toggleMode: vi.fn() }));

const { renderWorkspaceBar } = await import("@/editor/panels/workspaceBar");

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
let dispatchEvent: ReturnType<typeof vi.fn>;

function renderBar(): FakeElement {
  const root = document.createElement("div") as unknown as FakeElement;
  root.append(...renderWorkspaceBar() as unknown as FakeElement[]);
  return root;
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  const storage = new MemoryStorage();
  dispatchEvent = vi.fn(() => true);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent,
    },
  });
  resetEditorUiModeForTests("beginner");
  resetWorkspaceForTests();
  editorState.set({ layer: "lower", tool: "paint" });
  mocks.openDatabaseModal.mockClear();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  resetWorkspaceForTests();
});

describe("genre-neutral authoring task launcher", () => {
  // Break caught: a topbar control that looks like a task launcher but exposes only layout presets.
  it("renders four direct task actions instead of three pretend task presets", () => {
    const root = renderBar();
    for (const id of ["map", "event", "data", "test"]) {
      expect(findByTestId(root, `authoring-task-${id}`), id).toBeTruthy();
    }
    expect(findByTestId(root, "workspace-preset-toggle")).toBeNull();
  });

  // Break caught: Event changes panel geometry but leaves the paint tool active.
  it("starts Event by activating the real event layer and tool", () => {
    const root = renderBar();
    findByTestId(root, "authoring-task-event")?.click();
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });

  // Break caught: Data clears the left dock but never opens the database work window.
  it("starts Data by opening the real database modal", () => {
    const root = renderBar();
    findByTestId(root, "authoring-task-data")?.click();
    expect(mocks.openDatabaseModal).toHaveBeenCalledTimes(1);
  });

  // Break caught: Test is omitted from the common tasks or merely changes layout state.
  it("starts Test by dispatching the real test-play request", () => {
    const root = renderBar();
    findByTestId(root, "authoring-task-test")?.click();
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({ type: "oprn:test-play-window" });
  });

  // Break: ▤ 패널 메뉴가 같은 프리셋 3개를 「레이아웃」 이라는 두 번째 이름으로 다시 내놓는다.
  // 그 줄들은 authoringTasks 가 대체한 「작업 런처처럼 보이지만 레이아웃 프리셋만 내놓는 컨트롤」
  // 이었고, 톱바 한 줄 안에서 맵/이벤트/데이터를 두 번 말하게 만들었다.
  it("패널 메뉴에 작업 프리셋을 두 번째 이름으로 다시 내놓지 않는다", () => {
    const root = renderBar();
    for (const preset of ["map", "event", "data"]) {
      expect(findByTestId(root, `workspace-layout-${preset}`), preset).toBeNull();
    }
    // 밀도·편집 모드는 이 메뉴가 계속 소유한다 — 지운 것은 중복된 프리셋 줄뿐이다.
    expect(findByTestId(root, "workspace-density-comfortable")).toBeTruthy();
    expect(findByTestId(root, "workspace-ui-mode-standard")).toBeTruthy();
  });

  // Break: 프리셋 줄이 갖고 있던 「지금 어느 작업 화면인가」 표시가 사라져 아무도 말하지 않는다.
  // mode.ts 의 워크스페이스 구독이 톱바를 다시 그리는 이유로 적어둔 그 표시다.
  it("현재 작업 화면을 칩의 선택 상태로 말한다", () => {
    const root = renderBar();
    findByTestId(root, "authoring-task-event")?.click();

    const after = renderBar();
    expect(findByTestId(after, "authoring-task-event")?.getAttribute("aria-pressed")).toBe("true");
    expect(findByTestId(after, "authoring-task-map")?.getAttribute("aria-pressed")).toBe("false");
    // 테스트는 프리셋이 아니라 실행 요청이므로 선택 상태를 갖지 않는다.
    expect(findByTestId(after, "authoring-task-test")?.getAttribute("aria-pressed")).toBe("false");
  });

  // Break caught: selecting Data silently upgrades guided users to dense/expert chrome.
  it("preserves the current density while switching among all four tasks", () => {
    const root = renderBar();
    for (const id of ["map", "event", "data", "test"]) {
      const button = findByTestId(root, `authoring-task-${id}`);
      expect(button, id).toBeTruthy();
      button!.click();
      expect(getEditorUiMode(), id).toBe("beginner");
    }
  });
});
