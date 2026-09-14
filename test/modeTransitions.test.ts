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
        getCurrent: vi.fn(() => ({ startMapId: "map_town", system: { battleModel: "rm2k3" } })),
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
      presentEditorWelcome: vi.fn(async () => ({
        intent: null,
        prompt: null,
        autoSend: false,
        replaceWithBlank: false,
        dismiss: false,
        action: "skip" as const,
      })),
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
    vi.doMock("@/editor/coachMarks", () => ({
      maybeStartBasicCoachMarks: vi.fn(),
      maybeStartStandardWelcomeCard: vi.fn(),
    }));
    vi.doMock("@/editor/editorUiMode", () => ({
      subscribeEditorUiMode: vi.fn(() => () => {}),
      applyEditorUiModeClasses: vi.fn(),
      applyFirstVisitEditorUiMode: vi.fn(() => "standard"),
      getEditorUiMode: vi.fn(() => "standard"),
      getEditorChrome: vi.fn(() => ({ coachMarks: false, standardWelcome: false })),
    }));
    vi.doMock("@/editor/teamWorkflowUi", () => ({
      ensureGuestIdentityForAiSurface: vi.fn(),
      openLoginModalIfNeeded: vi.fn(),
    }));
    vi.doMock("@/player/player", () => ({ renderPlayer, teardownPlayer }));
    vi.doMock("@/app/editorPlayBootDiagnostics", () => ({
      editorPlayBootDiagnosticSink,
    }));

    const { bootApp, enterMode } = await import("@/app/mode");
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
