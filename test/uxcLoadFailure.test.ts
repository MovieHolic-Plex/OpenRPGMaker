import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function mockModeDependencies(): {
  readonly discardDevProjectOverride: ReturnType<typeof vi.fn>;
  readonly loadFallbackProject: ReturnType<typeof vi.fn<(project: unknown) => Promise<void>>>;
  readonly renderEditor: ReturnType<typeof vi.fn>;
} {
  const loadFallbackProject = vi.fn(async () => undefined);
  const discardDevProjectOverride = vi.fn();
  const renderEditor = vi.fn((node: HTMLElement) => {
    node.append(document.createElement("div"));
  });
  vi.doMock("@/project/store", () => ({
    DbConnectionRequiredError: class DbConnectionRequiredError extends Error {},
    store: {
      getCurrent: () => ({ startMapId: "map_fallback" }),
      isLoaded: () => true,
      load: vi.fn(async () => {
        throw new Error("mapTree: mapId(map_ember_village)가 존재하지 않는 맵.");
      }),
      loadFallbackProject,
    },
    setDevProjectFactory: vi.fn(),
  }));
  vi.doMock("@/app/perfMetrics", () => ({
    markInitialEditRender: vi.fn(),
    markModeSwitch: vi.fn(),
    mountPerfMetrics: vi.fn(),
  }));
  vi.doMock("@/editor/editorState", () => ({
    editorState: { set: vi.fn() },
  }));
  vi.doMock("@/editor/aiBootIntent", () => ({
    applyPendingAiBootIntent: vi.fn(),
    clearPendingAiBootIntent: vi.fn(),
    clearWelcomeIntentBootFlags: vi.fn(),
    markWelcomeIntentAppliedThisBoot: vi.fn(),
    peekPendingAiBootIntent: vi.fn(() => null),
    setPendingAiBootIntent: vi.fn(),
    setPendingWelcomePipeline: vi.fn(),
    wasWelcomeIntentAppliedThisBoot: vi.fn(() => false),
  }));
  vi.doMock("@/editor/editorWelcome", () => ({
    hasDeepLinkedProject: vi.fn(() => false),
    isAutomationBootContext: vi.fn(() => true),
    presentEditorWelcome: vi.fn(async () => ({
      intent: null,
      prompt: null,
      autoSend: false,
      replaceWithBlank: false,
      dismiss: false,
      action: "skip",
    })),
    setEditorWelcomeDismissed: vi.fn(),
    shouldPresentEditorWelcome: vi.fn(() => false),
  }));
  vi.doMock("@/editor/mapSelection", () => ({
    focusProjectStartMap: vi.fn(),
  }));
  vi.doMock("@/editor/mapUrlSync", () => ({
    installMapUrlSync: vi.fn(),
    restoreMapFromUrl: vi.fn(() => false),
  }));
  vi.doMock("@/editor/mapEditHistory", () => ({
    MAP_EDIT_HISTORY_EVENT: "map-edit-history",
  }));
  vi.doMock("@/editor/panels/menu", () => ({
    renderTopbar: vi.fn(),
  }));
  vi.doMock("@/editor/panels/editor", () => ({
    renderEditor,
    teardownEditor: vi.fn(),
  }));
  vi.doMock("@/editor/teamWorkflowUi", () => ({
    openLoginModalIfNeeded: vi.fn(),
  }));
  vi.doMock("@/project/devProjectPersistence", () => ({
    discardDevProjectOverride,
    hasDevProjectOverride: () => false,
  }));
  // 실제 defaults 모듈은 프로젝트 그래프 전체를 끌어와 전체 스위트 부하에서
  // 동적 import가 vi.waitFor 타임아웃(1s)을 넘길 수 있다 — mock으로 결정론화.
  vi.doMock("@/project/defaults", () => ({
    createSampleAdventureProject: () => ({ kind: "sample-fallback" }),
    createBlankProject: () => ({ kind: "blank-fallback" }),
  }));
  return { discardDevProjectOverride, loadFallbackProject, renderEditor };
}

async function bootFailureScreen(): Promise<{
  readonly root: FakeElement;
  readonly discardDevProjectOverride: ReturnType<typeof vi.fn>;
  readonly loadFallbackProject: ReturnType<typeof vi.fn<(project: unknown) => Promise<void>>>;
  readonly renderEditor: ReturnType<typeof vi.fn>;
}> {
  const mocks = mockModeDependencies();
  const { bootApp } = await import("@/app/mode");
  const root = document.createElement("div");
  await bootApp(root);
  return { root: fakeElement(root), ...mocks };
}

describe("UXC D01 프로젝트 로드 실패 폴백", () => {
  beforeEach(() => {
    vi.resetModules();
    restoreDom = installFakeDom();
    Reflect.deleteProperty(globalThis, "window");
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("오류 원문을 숨기고 안전한 복구 방법과 예제/새 프로젝트 CTA를 제공한다", async () => {
    const { root } = await bootFailureScreen();

    const panel = findByTestId(root, "project-load-error-panel");
    const details = findByTestId(root, "project-load-error-details");
    const message = findByTestId(root, "project-load-error-message");

    expect(panel?.textContent).toContain("저장된 작업을 바로 열 수 없습니다");
    expect(panel?.textContent).toContain("예제 작업으로 시작");
    expect(panel?.textContent).toContain("새 작업으로 시작");
    expect(details?.getAttribute("open")).toBeNull();
    expect(details?.textContent).toContain("해결 방법");
    expect(message?.textContent).toContain("기존 온라인 저장본은 바뀌지 않습니다");
    expect(message?.textContent).not.toContain("map_ember_village");
  });

  it("예제 프로젝트 폴백은 저장본을 폐기하지 않고 메모리 프로젝트로 부팅한다", async () => {
    const { root, discardDevProjectOverride, loadFallbackProject, renderEditor } = await bootFailureScreen();
    const sample = findByTestId(root, "load-error-start-sample");
    if (!sample) throw new Error("sample fallback missing");

    sample.click();

    await vi.waitFor(() => expect(loadFallbackProject).toHaveBeenCalledTimes(1));
    // renderEditor는 loadFallbackProject 완료 후 비동기로 호출되므로 함께 waitFor로 기다린다.
    await vi.waitFor(() => expect(renderEditor).toHaveBeenCalledTimes(1));
    expect(discardDevProjectOverride).not.toHaveBeenCalled();
  });

  it("새 프로젝트 폴백도 기존 저장본을 폐기하지 않는다", async () => {
    const { root, discardDevProjectOverride, loadFallbackProject } = await bootFailureScreen();
    const blank = findByTestId(root, "load-error-start-blank");
    if (!blank) throw new Error("blank fallback missing");

    blank.click();

    await vi.waitFor(() => expect(loadFallbackProject).toHaveBeenCalledTimes(1));
    expect(discardDevProjectOverride).not.toHaveBeenCalled();
  });
});
