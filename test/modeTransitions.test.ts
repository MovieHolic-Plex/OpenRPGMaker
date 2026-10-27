import { afterEach, describe, expect, it, vi } from "vitest";
import { bounded, deferred } from "./persistenceTestSignals";

// 플레이어는 파일 머리에서 가로챈다(vi.mock 은 끌어올려진다).
// CI 진단(ci-vitest-files 40463662845): mode.ts 안에서 import("@/player/player") 두 개가 **동시에** 걸리면 먼저 온 것은 목,
// 겹친 두 번째는 진짜 모듈을 받았다(Vitest 의 동시 동적 import 목 해석). 진짜 renderPlayer 는 목 store 의
// meta.publication 에서 죽었다. 그래서 겹침 시나리오 전에 플레이 진입을 한 번 해 mode.ts 쪽 import 를 끝내 둔다.
const player = vi.hoisted(() => ({ renderPlayer: vi.fn(), teardownPlayer: vi.fn() }));
vi.mock("@/player/player", () => player);
// 데우기의 편집 복귀가 stopAllAudio 를 부른다 — 노드에는 오디오가 없다.
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn() }));

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
    let editorTornDown = deferred<void>();
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
    const root = document.createElement("div");
    await bootApp(root);

    // 데우기: 플레이 한 번 → 편집 복귀. 겹침 시나리오는 그다음 편집 상태에서 똑같이 시작한다.
    await enterMode("play");
    await enterMode("edit");
    editorTornDown = deferred<void>();
    teardownEditor.mockClear();
    renderPlayer.mockClear();

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
