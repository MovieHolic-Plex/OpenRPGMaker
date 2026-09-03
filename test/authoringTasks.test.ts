// 저작 작업(runAuthoringTask) — Ctrl+K 「작업: …」 명령의 실제 동작 경계.
//
// 2026-09-03: 톱바의 작업 칩 4개(맵/이벤트/데이터/테스트)는 걷었다 — 사이드바 레이어 전환·자료집 버튼·
// ▶ 테스트의 두 번째 자리였다. 함수는 팔레트를 위해 남고, 칩이 함께 바꾸던 도크 프리셋 결합도 풀렸다
// (「데이터 중심」이 자료집 모달 뒤에서 좌측 도크를 비워, 모달을 닫으면 팔레트가 사라진 채 남는 함정).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { getWorkspaceLayout, resetWorkspaceForTests } from "@/editor/workspace/workspaceStore";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  openDatabaseModal: vi.fn(),
}));

vi.mock("@/editor/panels/databaseModal", () => ({
  openDatabaseModal: mocks.openDatabaseModal,
}));
// app/mode 는 모듈 상단에서 workspaceStore 를 동적 import 해 구독한다 — 이 테스트가 workspaceBar 를
// 통해 그 순환을 밟으면 초기화 전 `listeners` 접근(TDZ)이 unhandled rejection 으로 새어 나온다.
vi.mock("@/app/mode", () => ({ getMode: () => "edit", toggleMode: vi.fn() }));

const { AUTHORING_TASKS, runAuthoringTask } = await import("@/editor/authoringTasks");
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
      innerWidth: 1440,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent,
    },
  });
  resetEditorUiModeForTests("standard");
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

describe("저작 작업 명령", () => {
  it("네 작업이 팔레트용 표에 남아 있다", () => {
    expect(AUTHORING_TASKS.map((task) => task.id)).toEqual(["map", "event", "data", "test"]);
  });

  // Break caught: Event changes panel geometry but leaves the paint tool active.
  it("이벤트는 실제 이벤트 레이어와 도구를 켠다", () => {
    runAuthoringTask("event");
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });

  it("맵은 이벤트 레이어에서 바닥으로 돌아오고 타일 레이어는 그대로 둔다", () => {
    editorState.set({ layer: "event", tool: "event" });
    runAuthoringTask("map");
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("paint");
    editorState.set({ layer: "upper", tool: "erase" });
    runAuthoringTask("map");
    expect(editorState.get().layer).toBe("upper");
  });

  // Break caught: Data clears the left dock but never opens the database work window.
  it("데이터는 자료집 모달을 열고 좌측 도크는 건드리지 않는다", () => {
    const before = getWorkspaceLayout().docks;
    runAuthoringTask("data");
    expect(mocks.openDatabaseModal).toHaveBeenCalledTimes(1);
    expect(getWorkspaceLayout().docks).toEqual(before);
    expect(getWorkspaceLayout().docks.left).toEqual(["tiles", "maps"]);
  });

  // Break caught: Test merely changes layout state.
  it("테스트는 실제 테스트 실행 요청을 보낸다", () => {
    runAuthoringTask("test");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({ type: "oprn:test-play-window" });
  });

  it("「보기」 메뉴는 작업 칩·프리셋·밀도를 다시 내놓지 않고 편집 모드만 소유한다", () => {
    // Break: 작업 칩이나 밀도(안내/보통/촘촘) 라디오가 두 번째 이름으로 되살아난다.
    const root = renderBar();
    for (const id of ["map", "event", "data", "test"]) {
      expect(findByTestId(root, `authoring-task-${id}`), id).toBeNull();
      expect(findByTestId(root, `workspace-layout-${id}`), id).toBeNull();
    }
    for (const density of ["guided", "comfortable", "dense"]) {
      expect(findByTestId(root, `workspace-density-${density}`), density).toBeNull();
    }
    expect(findByTestId(root, "authoring-task-launcher")).toBeNull();
    for (const mode of ["beginner", "standard", "expert"]) {
      expect(findByTestId(root, `workspace-ui-mode-${mode}`), mode).not.toBeNull();
    }
    expect(findByTestId(root, "workspace-ui-mode-standard")?.getAttribute("aria-checked")).toBe("true");
  });
});
