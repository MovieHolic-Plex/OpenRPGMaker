import { afterEach, describe, expect, it, vi } from "vitest";
import { bounded, deferred } from "./persistenceTestSignals";

class TestElement {
  className = "";
  readonly children: TestElement[] = [];

  constructor(readonly tagName: string) {}

  get firstChild(): TestElement | null {
    return this.children[0] ?? null;
  }

  append(...nodes: TestElement[]): void {
    this.children.push(...nodes);
  }

  removeChild(node: TestElement): void {
    const index = this.children.indexOf(node);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
  }
}

function installDocument(): void {
  vi.stubGlobal("document", {
    createElement: (tagName: string) => new TestElement(tagName),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: {
      setAttribute: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {},
    },
  });
}

// 파일 단위 시한: 차가운 러너에서 @/app/mode 의 import 그래프만 약 22초 걸린다(ci-vitest-files 단독 실행 실측).
// 전역 testTimeout(15초)을 올리지 않고 이 파일만 늘린다.
describe("mode transitions", { timeout: 60_000 }, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("mounts play when a newer same-mode request overlaps an in-flight switch", async () => {
    installDocument();
    const renderEditor = vi.fn();
    const editorTornDown = deferred<void>();
    const teardownEditor = vi.fn(() => editorTornDown.resolve());
    const renderPlayer = vi.fn((parent: HTMLElement) => {
      const surface = document.createElement("div");
      surface.className = "play-surface";
      parent.append(surface);
    });
    const teardownPlayer = vi.fn();
    const editorPlayBootDiagnosticSink = vi.fn();

    vi.doMock("@/project/store", () => ({
      DbConnectionRequiredError: class DbConnectionRequiredError extends Error {},
      store: {
        load: vi.fn(async () => {}),
        // finishEditorBoot reads maps/commonEvents (isBlankStartProject) to decide the first-visit briefing.
        getCurrent: vi.fn(() => ({ startMapId: "map_town", system: { battleModel: "rm2k3" }, maps: {}, commonEvents: [] })),
        subscribe: vi.fn(),
        getDbPersistenceStatus: vi.fn(() => ({ kind: "ok" })),
        isSharedDemoSession: vi.fn(() => false),
        loadSharedDemo: vi.fn(async () => null),
      },
      setDevProjectFactory: vi.fn(),
    }));
    vi.doMock("@/editor/editorState", () => ({
      editorState: {
        set: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      },
    }));
    vi.doMock("@/editor/panels/menu", () => ({
      renderTopbar: vi.fn(),
    }));
    vi.doMock("@/app/perfMetrics", () => ({
      markInitialEditRender: vi.fn(),
      markModeSwitch: vi.fn(),
      mountPerfMetrics: vi.fn(),
    }));
    vi.doMock("@/editor/panels/editor", () => ({
      renderEditor,
      teardownEditor,
    }));
    vi.doMock("@/editor/editorWelcome", () => ({
      hasDeepLinkedProject: vi.fn(() => false),
      isAutomationBootContext: vi.fn(() => true),
      setEditorWelcomeDismissed: vi.fn(),
      shouldPresentEditorWelcome: vi.fn(() => false),
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
    vi.doMock("@/editor/mapSelection", () => ({
      focusProjectStartMap: vi.fn(),
    }));
    vi.doMock("@/editor/mapUrlSync", () => ({
      installMapUrlSync: vi.fn(),
      restoreMapFromUrl: vi.fn(() => false),
    }));
    vi.doMock("@/editor/teamWorkflowUi", () => ({
      ensureGuestIdentityForAiSurface: vi.fn(),
      openLoginModalIfNeeded: vi.fn(),
    }));
    vi.doMock("@/app/editorPlayBootDiagnostics", () => ({
      editorPlayBootDiagnosticSink,
    }));

    const { bootApp, enterMode, setPlayerModuleLoaderForTest } = await import("@/app/mode");
    // 플레이어는 mode.ts 의 이음새로 넣는다. vi.doMock 은 겹친 두 전환이 동시에 부른 동적 import 중 두 번째에
    // 진짜 모듈을 돌려줬다(CI 진단 40463662845). 이음새 하나로 두 전환이 같은 약속을 나눠 쓰는지도 본다.
    const loadPlayer = vi.fn(async () => ({ renderPlayer, teardownPlayer }));
    setPlayerModuleLoaderForTest(loadPlayer as unknown as Parameters<typeof setPlayerModuleLoaderForTest>[0]);
    const root = document.createElement("div");
    await bootApp(root);

    const teardownSignal = bounded(editorTornDown.promise);
    let firstFinished = false;
    const firstSwitch = enterMode("play").then(() => { firstFinished = true; });
    await teardownSignal;
    expect(firstFinished).toBe(false);
    expect(teardownEditor).toHaveBeenCalledTimes(1);

    const secondSwitch = enterMode("play");
    await bounded(Promise.all([firstSwitch, secondSwitch]));

    expect(loadPlayer).toHaveBeenCalledTimes(1);
    expect(renderPlayer).toHaveBeenCalledTimes(1);
    expect(renderPlayer).toHaveBeenCalledWith(
      expect.anything(),
      { qaInstrumentation: true, diagnosticSink: editorPlayBootDiagnosticSink },
    );
    const playParent = renderPlayer.mock.calls[0]?.[0];
    expect(playParent?.children.length).toBe(1);
    expect(playParent?.children[0]?.className).toBe("play-surface");
  });
});
