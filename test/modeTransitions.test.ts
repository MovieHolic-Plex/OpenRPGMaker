import { afterEach, describe, expect, it, vi } from "vitest";
import { bounded, deferred } from "./persistenceTestSignals";

// 플레이어는 파일 머리에서 가로챈다(vi.mock 은 끌어올려진다). 아래에서 목 모듈을 한 번 미리 불러 둔다 —
// CI 진단: 두 전환이 동시에 import("@/player/player") 를 부르면 두 번째(Promise.all index 1)가 진짜 모듈을 받아
// renderPlayer 가 목 store 의 meta.publication 에서 죽었다. 첫 import 를 끝내 두면 둘 다 같은 목을 받는다.
const player = vi.hoisted(() => ({ renderPlayer: vi.fn(), teardownPlayer: vi.fn() }));
vi.mock("@/player/player", () => player);

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

describe("mode transitions", () => {
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
    const renderPlayer = player.renderPlayer.mockImplementation((parent: HTMLElement) => {
      const surface = document.createElement("div");
      surface.className = "play-surface";
      parent.append(surface);
    });
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

    const { bootApp, enterMode } = await import("@/app/mode");
    await import("@/player/player");
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
