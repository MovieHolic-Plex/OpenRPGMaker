// @vitest-environment happy-dom

import { afterEach, expect, it, vi, describe, beforeEach } from "vitest";
import { mountAgentModeDock } from "@/editor/agentMode/agentModeDock";
import { refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCollapsedUndoButton } from "@/editor/panels/aiDirectorChrome";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { localDiagnostics } from "@/editor/localDiagnostics";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { clearAiUiEvents, listAiUiEvents } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { aiImageGenerateField, aiImagePromptPrefix } from "@/editor/panels/aiImageGenerateField";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom, signal, queueTransition } from "./helpers/aiTestSignals";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { createAiLiveStatus, isQuietTool, liveStatusHeadline, plannedStepsFromTodoArgs } from "@/editor/panels/aiLiveStatus";
import type { Project } from "@/project/types";
import type { RunOutcome } from "@/ai/runOutcome";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import { fixture, plan, size, skip } from "./requiredOutcomeFixture";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { setActivityLevel } from "@/editor/panels/aiActivityPreference";
import { COMPLETION_PLAY_HINT, compactRefineFindings, completionHeadline, createRefineFindings, plainMadeSummary, refineFindingsText } from "@/editor/panels/aiPiCompletionReport";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { createAiRunStream } from "@/editor/panels/aiRunStream";
import { createRunTimeline, summarizeToolArgs } from "@/editor/panels/aiRunTimeline";
import { formatAiActivityLogText, aiActivityLogTextFileName } from "@/ai/activityLogText";
import type { AiActivityLogRecord } from "@/ai/activityLogTypes";
import { downloadAiUsageLogText } from "@/editor/panels/aiUsageLogDownload";
import { createAiActionMenuItems } from "@/editor/panels/aiActionMenu";
import { AUDIO_DESCRIPTION_SOURCE_LABELS, listAudioResources, type AudioResourceProject } from "@/assets/audioResourceCatalog";
import data from "@/assets/audioAiDescriptions.json";
import { audioAiDraftDescription, getAudioAiDescription } from "@/assets/audioAiDescriptions";
import { BGM_CATALOG } from "@/assets/bgmCatalog";
import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { OPRN_BGM_ASSETS } from "@/assets/oprnBgmAssets";
import { SE_CATALOG } from "@/assets/seCatalog";
import { moodTagsForAsset } from "@/assets/resourceMoodTags";
import { searchResources } from "@/assets/resourceSearch";
import { audioDescriptionView } from "@/editor/panels/audioResourcePresentation";
import { deserialize, serialize } from "@/project/io";
import { AUDIO_DESCRIPTION_MAX_LENGTH, resetAudioDescriptionOverride, setAudioDescriptionOverride } from "@/project/audioDescriptions";
import { isolateTimers } from "./mergedTeardown";

describe("agentModeChatGpt", () => {
  isolateTimers();
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    resetAiConnectionStatusCache();
    document.body.replaceChildren();
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  it("uses the editor's companion composer when ChatGPT is ready and none of the local agents are installed", async () => {
    const detect = vi.fn(async () => ({
      agents: ["codex", "claude", "opencode"].map(id => ({
        id, label: id, cliFound: false, adapterFound: false, ready: false, installHint: "", loginHint: "",
      })),
      state: { running: false, busy: false, seq: 0 },
    }));
    const start = vi.fn();
    vi.stubGlobal("oprn", { agent: { detect, start, poll: () => new Promise(() => {}) } });
    vi.stubGlobal("fetch", async () => Response.json({ connected: true, authKind: "oauth" }));
    localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));

    const host = document.createElement("div");
    document.body.append(host);
    dispose = mountAgentModeDock(host);
    await vi.waitFor(() => expect(detect).toHaveBeenCalled());
    const tab = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-tab-agent']")!;
    tab.click();
    await refreshAiConnectionStatus();
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(tab.querySelector<HTMLElement>(".agent-mode-tab-setup")?.hidden).toBe(true);
    expect(tab.title).toBe("");
    expect(host.querySelector<HTMLElement>("[data-testid='agent-mode-chatgpt-ready']")?.hidden).toBe(false);
    expect(host.classList.contains("is-agent-mode")).toBe(false);
    expect(start).not.toHaveBeenCalled();

    const switchRoute = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-switch-route']")!;
    switchRoute.click();
    expect(host.classList.contains("is-agent-mode")).toBe(true);
    switchRoute.click();
    expect(host.classList.contains("is-agent-mode")).toBe(false);
  });
});

describe("aiCollapsedUndoReach", () => {
  isolateTimers();
  /**
   * PR #310 은 맵 위 «적용 완료» 밴드를 지우고 되돌리기를 컴포저 행으로 옮긴다. 방향은 맞지만
   * 그대로 두면 **접힌 상태에서 되돌리기에 닿을 수 없다** — 컴포저 행은 사이드·도크가 접힌 동안
   * `display: none` 이고(03-three-tier-ia.css), 접힘은 사용자가 직접 하며
   * `savePanelCollapsed` 로 새로고침을 넘어 유지된다. 삭제되는 밴드는 패널 자식이라 그 선택자에
   * 걸리지 않았으므로 이것은 이 PR 이 새로 만드는 구멍이다.
   *
   * 그래서 접힌 레일에 같은 상태로 움직이는 진입점을 둔다. 이 테스트가 그 계약을 고정한다.
   */

  const CSS = readFileSync(
    resolve(__dirname, "../src/styles/database/tabs-b-assistant-panel/03-three-tier-ia.css"),
    "utf8",
  );
  describe("접힌 레일의 되돌리기", () => {
    it("기본은 숨김이고 aria-hidden 이 붙는다 — 되돌릴 것이 없을 때 읽히지 않는다", () => {
      const button = createCollapsedUndoButton(() => {});
      expect(button.hidden).toBe(true);
      expect(button.getAttribute("aria-hidden")).toBe("true");
    });

    it("클릭이 위임된다 — 진입점마다 동작이 갈라지지 않는다", () => {
      let calls = 0;
      const button = createCollapsedUndoButton(() => {
        calls += 1;
      });
      document.body.append(button);
      button.click();
      expect(calls).toBe(1);
    });

    it("사람이 읽는 이름이 붙는다 — 아이콘만으로는 무엇을 되돌리는지 알 수 없다", () => {
      const button = createCollapsedUndoButton(() => {});
      expect(button.getAttribute("aria-label")).toContain("되돌리기");
      expect(button.dataset.testid).toBe("ai-collapsed-undo");
    });

    // 아래 둘은 CSS 계약이다. 컴포저 행을 끄는 규칙과 짝이라 한쪽만 바뀌면 구멍이 다시 생긴다.
    it("접힘 상태에서 보인다 — 사이드와 도크 둘 다", () => {
      expect(CSS).toMatch(/\.ai-chat-panel\.chat-dock-side\.is-collapsed > \.ai-collapsed-undo/);
      expect(CSS).toMatch(/\.ai-chat-panel\.is-docked\.is-collapsed > \.ai-collapsed-undo/);
    });

    it("펼친 상태에서는 숨는다 — 컴포저 행의 것과 중복이면 어느 쪽이 무엇을 되돌리는지 모른다", () => {
      expect(CSS).toMatch(/\.ai-collapsed-undo\s*\{\s*display:\s*none;/);
    });

    it("컴포저 행을 끄는 규칙이 여전히 있다 — 이 짝이 깨지면 계약이 무의미해진다", () => {
      expect(CSS).toMatch(/\.is-collapsed > \.ai-command-bar/);
    });
  });
});

describe("aiEmptyExportFeedback", () => {
  isolateTimers();
  beforeEach(() => {
    localDiagnostics.clear(); resetModalStackForTest(); clearAiUiEvents();
    localStorage.clear();
    document.body.replaceChildren();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  });
  afterEach(async () => {
    teardownAiChatPanel();
    await whenAiChatPanelSettled();
    localDiagnostics.clear(); resetModalStackForTest(); clearAiUiEvents();
    document.body.replaceChildren();
    localStorage.clear();
  });
  it("the empty-conversation menu opens consent without exporting, and Escape closes only its registered layer", () => {
    const panel = renderAiChatPanel();
    document.body.append(panel);
    const delegate = panel.querySelector<HTMLButtonElement>("[data-testid='ai-export']");
    const action = panel.querySelector<HTMLButtonElement>("[data-testid='ai-command-menu-export']");
    if (!delegate || !action) throw new Error("export controls missing");
    expect(delegate.disabled).toBe(false);
    const underlay = document.createElement("div");
    document.body.append(underlay);
    const closeUnderlay = registerModal(underlay, () => underlay.remove());
    const layers = modalStackDepthForTest();
    action.click();

    expect(document.querySelector('[data-testid="local-diagnostics-dialog"]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-testid="diagnostics-start"]')?.disabled).toBe(true);
    expect(localDiagnostics.snapshot()).toMatchObject({ active: false, sessionId: null, receipts: [] });
    expect(document.querySelector('[data-testid="diagnostics-preview-text"]')).toBeNull();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(listAiUiEvents().some(event => event.action === AI_UI_ACTIONS.conversationExport)).toBe(false);
    expect(modalStackDepthForTest()).toBe(layers + 1);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector('[data-testid="local-diagnostics-dialog"]')).toBeNull();
    expect(underlay.isConnected).toBe(true);
    expect(modalStackDepthForTest()).toBe(layers);
    closeUnderlay();
  });
});

describe("aiImageGenerateField", () => {
  isolateTimers();
  beforeEach(() => {
    document.body.replaceChildren();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
  describe("aiImageGenerateField", () => {
    it("종류별 placeholder 와 testid 접두사로 렌더된다", () => {
      const face = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "faceset", testidPrefix: "face-ai", onInserted: vi.fn() })
      );
      const prompt = findByTestId(face, "face-ai-prompt");
      expect(prompt, "faceset 프롬프트 칸").not.toBeNull();
      expect(prompt?.getAttribute("placeholder")?.length ?? 0).toBeGreaterThan(0);
      expect(findByTestId(face, "face-ai-generate"), "faceset 생성 버튼").not.toBeNull();

      const title = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "title", testidPrefix: "title-ai", onInserted: vi.fn() })
      );
      expect(findByTestId(title, "title-ai-prompt"), "title 프롬프트 칸").not.toBeNull();
      expect(findByTestId(title, "title-ai-generate"), "title 생성 버튼").not.toBeNull();
    });

    it("빈 프롬프트는 요청하지 않는다", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "picture", testidPrefix: "picture-ai", onInserted: vi.fn() })
      );
      findByTestId(field, "picture-ai-generate")?.click();
      await Promise.resolve();
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("종류별 프롬프트 접두사를 붙여 요청한다", async () => {
      const seen: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
          // The default image route first probes /auth/status (ChatGPT → Google fallback, da29a9f402); count only the generate POST.
          if (init?.body === undefined) return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
          seen.push(String((init?.body as string | undefined) ?? ""));
          return new Response(
            JSON.stringify({
              image: {
                dataUrl:
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==",
                mimeType: "image/png",
                model: "gemini-3.8-flash",
                provider: "google-antigravity",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }),
      );
      const inserted: string[] = [];
      const completed = signal();
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({
          kind: "backdrop",
          testidPrefix: "backdrop-ai",
          onInserted: (id) => { inserted.push(id); completed.resolve(); },
        })
      );
      const prompt = findByTestId(field, "backdrop-ai-prompt");
      expect(prompt).not.toBeNull();
      if (prompt) prompt.value = "화산 동굴";
      findByTestId(field, "backdrop-ai-generate")?.click();
      await completed.promise;
      expect(inserted).toHaveLength(1);
      expect(seen.length).toBe(1);
      expect(seen[0]).toContain("화산 동굴");
      expect(JSON.parse(seen[0]).prompt).toBe(`${aiImagePromptPrefix("backdrop")}화산 동굴`);
      vi.unstubAllGlobals();
    });
  });
});

describe("aiImageGenerateQueue", () => {
  isolateTimers();
  beforeEach(() => {
    document.body.replaceChildren();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
  describe("aiImageGenerateField queue", () => {
    it("프롬프트를 비우지 않고 여러 작업을 쌓는다", () => {
      const queue = createImageGenerationQueue({ runner: () => new Promise<string>(() => {}) });
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue, onInserted: vi.fn() })
      );
      const prompt = findByTestId(field, "q-prompt");
      expect(prompt).not.toBeNull();
      if (prompt) prompt.value = "슬라임";
      findByTestId(field, "q-generate")?.click();
      if (prompt) prompt.value = "고블린";
      findByTestId(field, "q-generate")?.click();
      const snapshot = queue.getSnapshot();
      expect(snapshot.jobs).toHaveLength(2);
      expect(snapshot.jobs.map((job) => job.label)).toEqual(["슬라임", "고블린"]);
      expect(prompt?.value).toBe("");
      expect(findByTestId(field, "q-queue-list")?.textContent).toContain("고블린");
      queue.dispose();
    });

    it("빈 프롬프트는 큐에 넣지 않는다", () => {
      const queue = createImageGenerationQueue({ runner: async () => "x" });
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue, onInserted: vi.fn() })
      );
      findByTestId(field, "q-generate")?.click();
      expect(queue.getSnapshot().jobs).toHaveLength(0);
    });

    it("끝난 작업은 에셋으로 등록하고 onInserted 를 부른다", async () => {
      const queue = createImageGenerationQueue({
        runner: async () => "data:image/png;base64,AAA",
      });
      const inserted: string[] = [];
      const completed = signal();
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({
          kind: "backdrop",
          testidPrefix: "q",
          queue,
          onInserted: (id) => { inserted.push(id); completed.resolve(); },
        })
      );
      const prompt = findByTestId(field, "q-prompt");
      if (prompt) prompt.value = "슬라임";
      findByTestId(field, "q-generate")?.click();
      await completed.promise;
      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toContain("backdrop_img");
      expect(store.getCurrent().assets.uploaded[inserted[0]!]?.kind).toBe("backdrop");
      expect(findByTestId(field, "q-queue-list")?.textContent).toContain("완료");
    });

    it("실패한 작업은 목록에 남고 다시 시도할 수 있다", async () => {
      let calls = 0;
      const queue = createImageGenerationQueue({
        runner: async () => {
          calls += 1;
          if (calls === 1) throw new Error("서버 불량");
          return "data:image/png;base64,AAA";
        },
      });
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue, onInserted: vi.fn() })
      );
      const prompt = findByTestId(field, "q-prompt");
      if (prompt) prompt.value = "슬라임";
      const failed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "error");
      findByTestId(field, "q-generate")?.click();
      await failed;
      expect(findByTestId(field, "q-queue-list")?.textContent).toContain("서버 불량");
      expect(findByTestId(field, "q-queue-retry")).not.toBeNull();
      const completed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "done");
      findByTestId(field, "q-queue-retry")?.click();
      await completed;
      expect(calls).toBe(2);
    });

    it("대기 중인 작업은 목록에서 취소할 수 있다", async () => {
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          if (job.label === "느림") return new Promise<string>(() => {});
          return "data:image/png;base64,AAA";
        },
      });
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue, onInserted: vi.fn() })
      );
      const prompt = findByTestId(field, "q-prompt");
      if (prompt) prompt.value = "느림";
      findByTestId(field, "q-generate")?.click();
      if (prompt) prompt.value = "빠름";
      findByTestId(field, "q-generate")?.click();
      expect(queue.getSnapshot().jobs).toHaveLength(2);
      const waiting = queue.getSnapshot().jobs.find((job) => job.label === "빠름")!;
      expect(queue.cancel(waiting.id)).toBe(true);
      const rendered = findByTestId(field, "q-queue-list");
      expect(rendered?.textContent).toContain("취소됨");
      queue.dispose();
    });

    it("같은 queueKey 의 필드는 리마운트해도 작업을 공유한다", async () => {
      let calls = 0;
      const shared = createImageGenerationQueue({
        runner: async (job) => {
          calls += 1;
          if (job.label === "느림") return new Promise<string>(() => {});
          return "data:image/png;base64,AAA";
        },
      });
      const first = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue: shared, onInserted: vi.fn() })
      );
      const prompt = findByTestId(first, "q-prompt");
      if (prompt) prompt.value = "느림";
      findByTestId(first, "q-generate")?.click();
      if (prompt) prompt.value = "빠름";
      findByTestId(first, "q-generate")?.click();
      expect(shared.getSnapshot().jobs).toHaveLength(2);
      // 폼이 통째로 다시 그려져도 같은 큐 인스턴스를 쓰면 목록이 살아 있다.
      const second = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue: shared, onInserted: vi.fn() })
      );
      expect(findByTestId(second, "q-queue-list")?.textContent).toContain("느림");
      expect(findByTestId(second, "q-queue-list")?.textContent).toContain("빠름");
      expect(calls).toBe(1);
      shared.dispose();
    });

    it("이미 끝난 큐에 붙은 새 필드는 초기 스캔으로 등록한다", async () => {
      const shared = createImageGenerationQueue({
        runner: async () => "data:image/png;base64,AAA",
      });
      const completed = queueTransition(shared, (snapshot) => snapshot.jobs[0]?.status === "done");
      const id = shared.enqueue({ prompt: "슬라임", kind: "backdrop" });
      await completed;
      expect(id).toBeTruthy();
      // 이 큐의 done 을 본 구독이 없으므로, 새로 붙는 필드가 초기 스냅샷을
      // 스캔해 에셋으로 등록한다.
      const inserted: string[] = [];
      renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue: shared, onInserted: (resourceId) => inserted.push(resourceId) })
      );
      expect(inserted).toHaveLength(1);
      expect(store.getCurrent().assets.uploaded[inserted[0]!]?.kind).toBe("backdrop");
      const afterRemount: string[] = [];
      renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue: shared, onInserted: (resourceId) => afterRemount.push(resourceId) })
      );
      expect(afterRemount).toHaveLength(0);
    });

    it("queueKey 필드는 같은 문서에서 리마운트해도 대기 목록을 유지한다", () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
      const a = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "share-key", queueKey: "enemy-graphic:e1", onInserted: vi.fn() })
      );
      const prompt = findByTestId(a, "share-key-prompt");
      if (prompt) prompt.value = "느림";
      findByTestId(a, "share-key-generate")?.click();
      const b = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "share-key", queueKey: "enemy-graphic:e1", onInserted: vi.fn() })
      );
      expect(findByTestId(b, "share-key-queue-list")?.textContent).toContain("느림");
    });

    it("store 재진입 리마운트에도 에셋 등록은 한 번만 한다", async () => {
      const shared = createImageGenerationQueue({
        runner: async () => "data:image/png;base64,AAA",
      });
      const inserted: string[] = [];
      const render = (): void => {
        renderWithFakeDom(() =>
          aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue: shared, onInserted: (resourceId) => inserted.push(resourceId) })
        );
      };
      render();
      const off = store.subscribe(() => {
        // 이벤트 에디터처럼 store.update emit 에 리마운트되는 호출부를 흉내낸다.
        render();
      });
      const before = Object.keys(store.getCurrent().assets.uploaded).length;
      const completed = queueTransition(shared, (snapshot) => snapshot.jobs[0]?.status === "done");
      shared.enqueue({ prompt: "슬라임", kind: "backdrop" });
      await completed;
      expect(inserted).toHaveLength(1);
      const after = Object.keys(store.getCurrent().assets.uploaded).length;
      expect(after - before).toBe(1);
      off();
      shared.dispose();
    });

    it("레코드를 바꾸면 진행 중 작업의 완료가 새 레코드에 닿지 않는다", async () => {
      // queueKey 격리를 진짜로 타야 한다: 주입 큐를 쓰면 resolveQueue 가 키 조회를
      // 건너뛰어 와이어링을 지워도 테스트가 초록이 된다(재검토 지적). 그래서 기본
      // runner + fetch 스텁으로 in-flight 를 붙잡고, 같은 testid·다른 queueKey 로 연다.
      // 결함 형태: B 가 작업 진행 중에 마운트되고 A 구독이 끊기면, 키가 공유될 때
      // done notify 가 B 에게 꽂혀 B 의 onInserted 가 A 그림을 받는다.
      const png = "data:image/png;base64,AAA";
      let resolveFetch!: (response: Response) => void;
      const gate = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      vi.stubGlobal(
        "fetch",
        // The default image route first probes /auth/status (da29a9f402); only the generate POST waits on the gate.
        vi.fn((_url: unknown, init?: { body?: unknown }) => init?.body === undefined
          ? Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }))
          : gate),
      );
      const forA: string[] = [];
      const forB: string[] = [];
      const completed = signal();
      const renderFor = (recordId: string, sink: string[]): HTMLElement =>
        renderWithFakeDom(() =>
          aiImageGenerateField({
            kind: "backdrop",
            testidPrefix: "qa",
            queueKey: `monster-species-resource:${recordId}`,
            onInserted: (resourceId) => { sink.push(resourceId); completed.resolve(); },
          })
        );
      const rootA = renderFor("speciesA", forA);
      const promptA = findByTestId(rootA, "qa-prompt");
      if (promptA) promptA.value = "A종족 그림";
      findByTestId(rootA, "qa-generate")?.click();
      rootA.remove();
      expect(rootA.isConnected).toBe(false);
      // B 를 A 작업이 끝나기 전에 연다. 키가 분리돼 있으면 B 의 큐는 비어 있다.
      const rootB = renderFor("speciesB", forB);
      expect(findByTestId(rootB, "qa-queue-list")?.textContent).not.toContain("A종족 그림");
      // Return to A while its request is pending; only A may receive the result.
      renderFor("speciesA", forA);
      resolveFetch(
        new Response(JSON.stringify({ image: { dataUrl: png } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await completed.promise;
      expect(forA).toHaveLength(1);
      expect(forB).toHaveLength(0);
      expect(store.getCurrent().assets.uploaded[forA[0]!]?.kind).toBe("backdrop");
    });

    it("끝난 항목 지우기는 완료·취소만 걷는다", async () => {
      let calls = 0;
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          calls += 1;
          if (job.label === "깨짐") throw new Error("불량");
          return "data:image/png;base64,AAA";
        },
      });
      const field = renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "backdrop", testidPrefix: "q", queue, onInserted: vi.fn() })
      );
      const prompt = findByTestId(field, "q-prompt");
      if (prompt) prompt.value = "깨짐";
      const failed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "error");
      findByTestId(field, "q-generate")?.click();
      await failed;
      expect(calls).toBe(1);
      expect(findByTestId(field, "q-queue-clear")).toBeNull();
    });
  });
});

describe("aiLiveStatus", () => {
  isolateTimers();
  describe("liveStatusHeadline", () => {
    it("names the map, the action and the step count when a plan exists", () => {
      expect(liveStatusHeadline({ action: "집을 만드는 중", mapName: "숲속 마을", done: 3, planned: 9 })).toBe("숲속 마을에서 집을 만드는 중 · 4/9 단계");
    });

    it("does not invent a denominator without a plan", () => {
      expect(liveStatusHeadline({ action: "길을 그리는 중", done: 2, planned: 0 })).toBe("길을 그리는 중 · 2단계 끝");
      expect(liveStatusHeadline({ action: "요청을 읽고 있어요", done: 0, planned: 0 })).toBe("요청을 읽고 있어요");
    });

    it("never shows a step number past the total", () => {
      expect(liveStatusHeadline({ action: "다듬는 중", done: 5, planned: 3 })).toBe("다듬는 중 · 5/5 단계");
    });
  });
  describe("plannedStepsFromTodoArgs", () => {
    it("reads the v2 todo init list across phases", () => {
      expect(plannedStepsFromTodoArgs({ op: "init", list: [
        { phase: "땅", items: [{ content: "숲 바닥 깔기" }, "길 내기"] },
        { phase: "집", items: [{ content: "집 3채" }] },
      ] })).toEqual({ op: "init", items: ["숲 바닥 깔기", "길 내기", "집 3채"] });
    });

    it("reads append and ignores other operations", () => {
      expect(plannedStepsFromTodoArgs({ op: "append", phase: "마무리", items: [{ content: "NPC 두기" }] })).toEqual({ op: "append", items: ["NPC 두기"] });
      expect(plannedStepsFromTodoArgs({ op: "done", task: "t1" })).toBeNull();
    });
  });
  describe("createAiLiveStatus finish", () => {
    const base = { maps: {} } as unknown as Project;

    it("hides the line when a turn ends without any step (connection failure, refused start)", () => {
      const status = createAiLiveStatus({ baseProject: base });
      expect(status.root.hidden).toBe(false);
      status.finish();
      expect(status.root.hidden).toBe(true);
    });

    it("keeps the finished summary when the turn did work", () => {
      const status = createAiLiveStatus({ baseProject: base });
      status.event({ type: "tool_start", id: "t1", name: "build_house", args: {} });
      status.event({ type: "tool_end", id: "t1", name: "build_house", ok: true, summary: "" });
      status.finish();
      expect(status.root.hidden).toBe(false);
      expect(status.root.textContent).toContain("1단계를 마쳤어요");
    });

    it("between tools shows the last finished step, never the stale opening line (qa1124 «요청을 읽고 있어요 · 6/6»)", () => {
      const status = createAiLiveStatus({ baseProject: base });
      status.status("요청을 읽고 있어요");
      status.event({ type: "tool_start", id: "t1", name: "make_place", args: {} });
      status.event({ type: "tool_end", id: "t1", name: "make_place", ok: true, summary: "" });
      const line = () => status.root.querySelector("[data-testid=ai-live-status-line]")!.textContent!;
      expect(line()).not.toContain("요청을 읽고 있어요");
      expect(line()).toContain("장소 짓기 끝");
      status.event({ type: "execution_status", name: "v2.blueprint.auto_path", ok: true, summary: "청사진 경로 자동 짓기 — 길 3개" });
      expect(line()).toContain("청사진 경로 자동 짓기");
      status.event({ type: "execution_status", name: "turn.diag", ok: true, summary: "stop=toolUse blocks=text(0)" });
      expect(line()).not.toContain("stop=");
    });
  });
  describe("isQuietTool", () => {
    it("keeps reads out of the step list and builds in it", () => {
      expect(isQuietTool("read_tileset_reference")).toBe(true);
      expect(isQuietTool("todo")).toBe(true);
      expect(isQuietTool("build_house")).toBe(false);
    });
  });
});

describe("aiOutcomePresentation", () => {
  isolateTimers();
  const notes: ReturnType<typeof createAiStickyChecklist>[] = [];
  afterEach(() => {
    notes.forEach(note => note.dispose()); notes.length = 0;
    document.body.replaceChildren(); resetIntentDeclarationCache(); vi.restoreAllMocks();
  });
  const executions: readonly RunOutcome["execution"][] = ["response-final", "awaiting-user", "blocked", "cancelled", "budget-exhausted", "failed"];
  const goals: readonly RunOutcome["goal"][] = ["unassessed", "incomplete", "satisfied"];
  const deliveries: readonly RunOutcome["delivery"][] = ["no-change", "draft", "applied", "persisted", "persisted-verified"];
  for (const execution of executions) for (const goal of goals) for (const delivery of deliveries) {
    it(`projects ${execution}/${goal}/${delivery} without changing authority`, () => {
      const outcome = Object.freeze({ execution, goal, delivery });
      const root = renderRunOutcome(outcome);
      expect(root.dataset).toMatchObject({ testid: "ai-run-outcome", execution, goal, delivery });
      expect(root.getAttribute("role")).toBe("status");
      expect(root.querySelectorAll("button, input")).toHaveLength(0);
      expect(outcome).toEqual({ execution, goal, delivery });
    });
  }
  // 「실제 세션 수용 판정으로 요구 철회·필수/선택 집계를 그린다」 다섯 케이스는 은퇴했다 — 수용(acceptance) 원장은
  // 더 이상 만들어지지 않아(acceptance:disabled, 2026-09-17 하네스 게이트 2차 해체) 세션이 줄 스냅샷이 없다.

  it("does not offer a user action for legacy read-only callers", async () => {
    const f = fixture(); await f.run([[plan([size]), skip]]);
    const note = createAiStickyChecklist(); notes.push(note); note.update(f.session.getAcceptanceSnapshot());
    expect(document.querySelector("[data-testid='ai-requirement-withdraw']")).toBeNull();
  });
});

// 실행 마무리 말 — 만든 것이 먼저, 남은 지적은 접은 「더 다듬을 곳 (N)」 칸. 지적은 버리지 않는다.
describe("aiPiCompletionReport", () => {
  isolateTimers();
  afterEach(() => setActivityLevel("brief"));
  describe("실행 마무리 말", () => {
    it("새로 생긴 맵·이벤트·캐릭터를 사람 말로 센다", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      const template = Object.values(after.maps)[0]!;
      for (let i = 0; i < 2; i++) after.maps[`map_new_${i}`] = { ...structuredClone(template), id: `map_new_${i}`, name: `새 맵 ${i}`, events: [] };
      const events = after.maps.map_new_0!.events as unknown[];
      const sample = { id: "evt_a", name: "고양이", x: 1, y: 1, pages: [] };
      events.push(sample, { ...sample, id: "evt_b" }, { ...sample, id: "evt_c" });
      const actor = { ...(before.database.actors[0] ?? { name: "주인공" }), id: "actor_new" } as (typeof after.database.actors)[number];
      after.database.actors.push(actor);
      expect(plainMadeSummary(before, after)).toBe("맵 2개 · 이벤트 3개 · 캐릭터 1명을 만들었어요.");
      // 새로 생긴 게 없으면 숫자를 지어내지 않는다.
      expect(plainMadeSummary(before, structuredClone(before))).toBeNull();
    });

    it("머리말은 만든 것과 플레이 안내로 시작하고, 확인을 못 끝냈으면 그 사실을 숨기지 않는다", () => {
      const made = "맵 14개 · 이벤트 151개 · 캐릭터 11명을 만들었어요.";
      expect(completionHeadline(made, { unverified: false })).toBe(`${made}\n${COMPLETION_PLAY_HINT}`);
      const stopped = completionHeadline(made, { unverified: true, stoppedEarly: "Cloud Code Assist API returned a thought-only response" });
      expect(stopped).toContain("도중에 멈춰");
      expect(stopped).toContain("thought-only");
      expect(stopped).not.toContain(COMPLETION_PLAY_HINT);
      expect(completionHeadline(null, { unverified: true }).split("\n")).toEqual([
        "변경 내용을 반영했어요.",
        COMPLETION_PLAY_HINT,
        "끝까지 확인하지는 못했어요. 마음에 들지 않으면 되돌릴 수 있어요.",
      ]);
    });

    it("여러 맵에 되풀이된 같은 유형의 지적과 똑같은 문장은 한 줄로 모인다", () => {
      // 2026-09-23 「등대지기의 겨울」 실제 검수 문장(요약)
      const bedroom = "좌측 방((2,2)~(5,5))과 우측 방((7,2)~(10,5))의 침대, 협탁, 거울, 액자 배치가 완전히 동일하게 복사되어 있어 인위적입니다.";
      const findings = [
        `바란의 집 내부 (2층): ${bedroom}`,
        "늙은 어부의 집 내부 (2층): 상단 두 침실 (2~5, 1~6)과 (7~10, 1~6)의 침대, 협탁, 화장대, 창문 배치가 완전히 똑같이 복사되어 있어 인위적입니다.",
        "헬가의 여관: 상단 방 사이의 비정상적인 외부 공백 (x=6, y=1~6): 북측 두 방 사이에 1타일 폭의 검은 배경 보이드가 깊게 파고들어 있습니다.",
        "바란의 집 내부 (2층): 상단 두 방 사이 (6,1)~(6,6) 구간에 1타일 너비의 외부 암흑 공백이 파고들어 있습니다.",
        "성에항: 중앙 상단 건물(x: 29~36, y: 6~12)에서 우측 지붕 구역 아래에 벽체나 기둥이 없어 지붕이 공중에 홀로 떠 있습니다.",
        "바란의 상점: 우상단 방과 우하단 방은 가구가 극소수만 흩어져 있어 휑합니다.",
        `바란의 집 내부 (2층): ${bedroom}`,
      ];
      const lines = compactRefineFindings(findings);
      expect(lines).toHaveLength(4);
      expect(lines[0]).toMatch(/^방·가구가 복사한 듯 똑같음 — 2곳\(바란의 집 내부 \(2층\), 늙은 어부의 집 내부 \(2층\)\)\. 예: 좌측 방/);
      expect(lines[1]).toMatch(/^맵 안의 검은 빈칸 — 2곳\(헬가의 여관, 바란의 집 내부 \(2층\)\)/);
      // 한 맵에만 나온 유형과 분류되지 않은 지적은 원문 그대로.
      expect(lines).toContain(findings[4]);
      expect(lines).toContain(findings[5]);
      const details = createRefineFindings(findings) as HTMLDetailsElement;
      expect(details.querySelector("summary")?.textContent).toBe("더 다듬을 곳 (4)");
    });

    it("지적은 간단히 보기에서 접힌 칸에 전부 남고, 자세히 보기에서는 펼쳐진다", () => {
      const findings = ["마을: 맵 좌측 전체가 검은 공백으로 방치되어 있습니다", "마을: 집 입구가 막혔습니다", "숲: 길이 끊겼습니다", "숲: 나무가 겹칩니다"];
      const details = createRefineFindings(findings) as HTMLDetailsElement;
      document.body.append(details);
      expect(details.querySelector("summary")?.textContent).toBe("더 다듬을 곳 (4)");
      expect(details.open).toBe(false);
      // 옛 문구는 셋만 보이고 나머지는 「작업 과정」 으로 밀었다 — 이제는 넷 다 칸 안에 있다.
      expect([...details.querySelectorAll("li")].map(li => li.textContent)).toEqual(findings);
      setActivityLevel("detail");
      expect(details.open).toBe(true);
      expect(refineFindingsText(findings)).toContain("• 숲: 나무가 겹칩니다");
    });
  });
});

// 작업 스트림(목업 v4, qa1124): 실행기 이벤트열 리플레이 → 조수별 레인·도구 줄·할 일·끝 화면. 지어낸 진행률·문장이 없어야 한다.
describe("aiRunTimeline", () => {
  isolateTimers();
  const at = (ms: number) => ({ at: 1_000_000 + ms });
  const wrap = (agentId: string, event: PiAgentEvent): PiAgentEvent => ({ type: "agent_event", agentId, event });
  /** piTeamRuntime 이 내는 순서 그대로: team_start → 팀장 도구 → agent_spawn ×2 → 일꾼 이벤트 → agent_done → done. */
  function teamFirstBuild(): PiAgentEvent[] {
    return [
      { type: "team_start", task: "회상 게임", roles: [], ...at(0) },
      { type: "tool_start", id: "o1", name: "assign_map_agent", args: { mapId: "m2", task: "바닷가 포구" }, ...at(100) },
      { type: "tool_end", id: "o1", name: "assign_map_agent", ok: true, summary: "시공 1 → 바닷가 포구", ...at(200) },
      { type: "agent_spawn", agentId: "builder-1", role: "builder", mapId: "m2", mapName: "바닷가 포구", task: "마을", ...at(210) },
      { type: "agent_spawn", agentId: "builder-2", role: "builder", mapId: "m3", mapName: "등대 안", task: "실내", ...at(220) },
      wrap("builder-1", { type: "tool_start", id: "b1", name: "author_beodeul_town", args: { mapId: "m2", name: "바닷가 포구", theme: "coast", houseCount: 4, width: 44, height: 36 }, ...at(300) }),
      wrap("builder-2", { type: "delta", kind: "text", text: "등대 안은 1층 거실 하나로 짓겠습니다.", ...at(320) }),
      wrap("builder-2", { type: "delta", kind: "thinking", text: "internal reasoning", ...at(330) }),
      wrap("builder-1", { type: "tool_end", id: "b1", name: "author_beodeul_town", ok: true, summary: "새 맵 44×36 · 집 4 · 다리 1", durationMs: 1400, ...at(1700) }),
      wrap("builder-1", { type: "map_delta", maps: [{ mapId: "m2", layers: [{ layer: "lower", cells: Array.from({ length: 1584 }, (_, i) => ({ i, t: 1 })) }] }] as never, ...at(1710) }),
      wrap("builder-1", { type: "checkpoint", checkpointId: "c1", constructionLogs: [{ mapId: "m2", width: 44, height: 36, toolName: "author_beodeul_town", elapsedMs: 1400, planClasses: {}, steps: [{ kind: "paint", label: "바닥", cells: [1] }] }] } as never),
      wrap("builder-1", { type: "tool_start", id: "b2", name: "get_map_region", args: { mapId: "m2" }, ...at(1800) }),
      wrap("builder-1", { type: "tool_end", id: "b2", name: "get_map_region", ok: true, summary: "읽음", ...at(1810) }),
      { type: "agent_done", agentId: "builder-1", ok: true, summary: "마을을 지었다", stats: {} as never, changedKeys: [], spills: [], conflicts: [], ...at(2000) },
    ];
  }
  describe("createRunTimeline (event replay)", () => {
    it("builds one lane per assistant with real args, raw tool name, result text, duration and changed cells", () => {
      const timeline = createRunTimeline({ now: () => 1_000_000 });
      for (const event of teamFirstBuild()) timeline.apply(event);
      const snap = timeline.snapshot();
      expect(snap.team).toBe(true);
      expect(snap.lanes.map((lane) => [lane.title, lane.rawName, lane.mapName])).toEqual([["팀장", "orchestrator", null], ["시공 1", "builder-1", "바닷가 포구"], ["시공 2", "builder-2", "등대 안"]]);
      const town = snap.rows.find((row) => row.name === "author_beodeul_town")!;
      expect(town).toMatchObject({ laneId: "builder-1", state: "done", durationMs: 1400, result: "새 맵 44×36 · 집 4 · 다리 1", changedCells: 1584, realMs: 1400 });
      expect(town.args).toBe("width×height: 44×36 · mapId: m2 · name: 바닷가 포구 · theme: coast · houseCount: 4");
      expect(snap.rows.find((row) => row.name === "get_map_region")?.quiet).toBe(true);
    });

    it("shows only model text the runner actually sent — thinking is not shown", () => {
      const timeline = createRunTimeline();
      for (const event of teamFirstBuild()) timeline.apply(event);
      const lane = timeline.snapshot().lanes.find((l) => l.id === "builder-2")!;
      expect(lane.text).toBe("등대 안은 1층 거실 하나로 짓겠습니다.");
      expect(timeline.snapshot().lanes.find((l) => l.id === "builder-1")!.text).toBe("");
    });

    it("releases the map owner when the worker is done and keeps the running worker's map", () => {
      const timeline = createRunTimeline();
      for (const event of teamFirstBuild()) timeline.apply(event);
      expect(timeline.snapshot().mapOwners).toEqual({ m3: "builder-2" });
    });

    it("keeps the model's todo list as written and follows its start/done", () => {
      const timeline = createRunTimeline();
      timeline.apply({ type: "tool_start", id: "t", name: "todo", args: { op: "init", list: [{ phase: "장소", items: [{ content: "바닷가 포구" }, { content: "등대 안" }] }] } });
      timeline.apply({ type: "tool_start", id: "t2", name: "todo", args: { op: "start", task: "t1" } });
      timeline.apply({ type: "tool_start", id: "t3", name: "todo", args: { op: "done", task: "바닷가 포구" } });
      timeline.apply({ type: "tool_start", id: "t4", name: "todo", args: { op: "start", task: "t2" } });
      expect(timeline.snapshot().todos.map((t) => [t.text, t.state])).toEqual([["바닷가 포구", "done"], ["등대 안", "now"]]);
      expect(timeline.snapshot().rows).toEqual([]);
    });

    it("running rows carry no invented result or progress", () => {
      const timeline = createRunTimeline();
      timeline.apply({ type: "tool_start", id: "x", name: "make_place", args: { type: "village" } });
      const row = timeline.snapshot().rows[0]!;
      expect(row.state).toBe("running");
      expect(row.result).toBeUndefined();
      expect(row.durationMs).toBeUndefined();
    });

    it("summarizes args without rewriting values", () => {
      expect(summarizeToolArgs({ objectId: "kit:beodeul_city/성당", x: 1, y: 15, layer: "upper", cells: [1, 2, 3] })).toBe("objectId: kit:beodeul_city/성당 · x: 1 · y: 15 · layer: upper · cells: 3개");
    });
  });
  describe("createAiRunStream", () => {
    const base = { maps: {} } as unknown as Project;

    it("ends a first MVP build with «MVP까지 만들었어요» and never leaves the opening line behind", () => {
      const stream = createAiRunStream({ live: createAiLiveStatus({ baseProject: base }), team: true, firstMvp: true });
      stream.status("요청을 읽고 있어요");
      for (const event of teamFirstBuild()) stream.event(event);
      stream.event({ type: "done", project: base, stats: {} as never, changedKeys: [] });
      stream.finish(true);
      const text = stream.root.textContent ?? "";
      expect(stream.root.querySelector("[data-testid=ai-run-stream-end]")?.textContent).toContain("MVP까지 만들었어요");
      expect(stream.root.querySelector("[data-testid=ai-live-status-line]")?.textContent).not.toContain("요청을 읽고 있어요");
      expect(text).toContain("author_beodeul_town");
      expect(text).toContain("마을 짓기");
      expect(text).not.toMatch(/%|진행률/u);
    });

    it("says it stopped when the runner stopped early instead of claiming the MVP", () => {
      const stream = createAiRunStream({ live: createAiLiveStatus({ baseProject: base }), firstMvp: true });
      stream.event({ type: "done", project: base, stats: {} as never, changedKeys: [], stoppedEarly: "사용 한도" });
      stream.finish(true);
      const end = stream.root.querySelector("[data-testid=ai-run-stream-end]")?.textContent ?? "";
      expect(end).toContain("도중에 멈췄어요");
      expect(end).not.toContain("MVP까지");
    });
  });
});

// ☰ 「사용 로그 내려받기」 계약: 텍스트 서식 + 두 표면의 항목 + 빈 로그일 때 파일을 만들지 않음.
describe("aiUsageLogDownload", () => {
  isolateTimers();
  /** src/ai/activityLog.ts 의 저장 키. 로그를 심는 것이 목적이라 기록 API 를 태우지 않는다. */
  const ACTIVITY_STORAGE_KEY = "oprn:ai-activity-logs";
  const RECORD: AiActivityLogRecord = {
    id: "rec-1",
    runId: "run-9",
    at: "2026-09-09T01:02:03.000Z",
    channel: "chat",
    model: "gemini-3-pro",
    liteModel: "gemini-3-flash",
    instruction: "마을 광장에\n분수를 놓아줘",
    mapId: "map-1",
    mapName: "마을",
    region: { x: 2, y: 3, width: 4, height: 5 },
    result: {
      ok: true,
      applied: true,
      changedCells: 12,
      changedEvents: 1,
      assistantText: "분수를 놓았습니다.",
      commitIds: ["commit-a"],
      recap: {
        elapsedMs: 3200,
        promptTokens: 1200,
        completionTokens: 340,
        llmCalls: 2,
        toolCalls: 1,
        ralphContinues: 0,
        volumeContinues: 0,
        process: [],
      },
    },
    toolCalls: [{ name: "place_tiles", args: { x: 2, y: 3 }, ok: true, summary: "12칸 배치" }],
    audit: [
      { kind: "user", text: "마을 광장에 분수를 놓아줘", at: "2026-09-09T01:02:00.000Z" },
      { kind: "tool", name: "place_tiles", args: { x: 2 }, ok: false, summary: "실패", reason: "좌표가 맵 밖" },
      { kind: "status", text: "턴 종료" },
    ],
    diagnostics: { severity: "warning", kinds: ["tool-failure"], messages: ["도구 1건 실패"], failedTools: ["place_tiles"] },
    index: { toolNames: [], failedToolNames: [], auditKinds: [], commitIds: [], uiActions: [], mapIds: [] },
    truncated: { audit: 3 },
    persisted: "both",
  };
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.replaceChildren();
  });
  // 실측(2026-09-17 조수 로그 100건): Pi 18턴 중 6턴이 머리말과 적용 결과가 어긋났다. 「실패」인데
  // 적용된 반쯤 적용 상태와 「성공」인데 검토 대기인 상태는 다음에 할 일이 정반대인데(되돌리기 ↔ 검토),
  // 머리말만 보고는 구분이 안 됐다. 어긋날 때만 괄호로 사실을 덧붙인다.
  it("머리말은 적용 결과와 어긋날 때 그 사실을 함께 말한다", () => {
    const headline = (over: Partial<AiActivityLogRecord["result"]>): string => {
      const text = formatAiActivityLogText([{ ...RECORD, result: { ...RECORD.result, ...over } }], { at: new Date() });
      return text.split("\n").find((line) => line.startsWith("[1] ")) ?? "";
    };

    expect(headline({ ok: true, applied: true })).toContain("· 성공");
    expect(headline({ ok: true, applied: true })).not.toContain("성공(");
    // 검토 대기 — 붙지 않았는데 「성공」만 보이면 사용자가 끝난 줄 안다.
    expect(headline({ ok: true, applied: false })).toContain("· 성공(적용 안 됨)");
    // 반쯤 적용 — 「실패」만 보이면 되돌릴 것이 남은 줄 모른다.
    expect(headline({ ok: false, applied: true })).toContain("· 실패(부분 적용)");
    expect(headline({ ok: false, applied: false })).toContain("· 실패");
    expect(headline({ ok: false, applied: false })).not.toContain("실패(");
    // 적용 여부를 모르는 기록(화면 조작 등)은 예전 그대로 한 낱말이다.
    expect(headline({ ok: true, applied: undefined })).toContain("· 성공");
    expect(headline({ ok: true, applied: undefined })).not.toContain("성공(");
  });
  it("한 턴을 사람이 읽는 텍스트로 옮긴다 — 지시·결과·도구·대화 기록·잘림이 모두 남는다", () => {
    const text = formatAiActivityLogText([RECORD], { at: new Date("2026-09-09T02:00:00.000Z") });

    expect(text).toContain("AI 조수 사용 로그");
    expect(text).toContain("내려받은 시각: 2026-09-09T02:00:00.000Z");
    expect(text).toContain("기록: 1건 (최신 순)");
    expect(text).toContain("[1] 2026-09-09T01:02:03.000Z · 대화 · 성공");
    expect(text).toContain("모델: gemini-3-pro (보조 gemini-3-flash)");
    expect(text).toContain("맵: 마을 (map-1)");
    expect(text).toContain("영역: (2, 3) 크기 4×5");
    // 여러 줄 지시는 한 줄로 이어 붙이지 않는다.
    expect(text).toContain("지시:\n  마을 광장에\n  분수를 놓아줘");
    expect(text).toContain("결과 상세: 적용됨 · 셀 12칸 · 이벤트 1건");
    expect(text).toContain("자원: 3.2초 · LLM 2회 · 도구 1회 · 토큰 1200/340");
    expect(text).toContain("커밋: commit-a");
    expect(text).toContain("진단: 경고 · tool-failure · 실패 도구 place_tiles");
    expect(text).toContain("1. [ok] place_tiles — 12칸 배치");
    expect(text).toContain("조수 응답: 분수를 놓았습니다.");
    expect(text).toContain("[사용자]");
    expect(text).toContain("[도구 실패] place_tiles — 실패");
    expect(text).toContain("사유: 좌표가 맵 밖");
    expect(text).toContain("[상태]: 턴 종료");
    expect(text).toContain("잘린 기록: 대화 기록 3건");
    expect(text).toContain("기록 id: rec-1");
    expect(text.endsWith("\n")).toBe(true);
  });
  it("파일 이름은 콜론·점 없이 시각을 담는다(윈도 파일명 제약)", () => {
    const name = aiActivityLogTextFileName(new Date("2026-09-09T02:03:04.500Z"));
    expect(name).toBe("ai-usage-log-2026-09-09T02-03-04-500Z.txt");
    expect(name).not.toMatch(/[:.](?!txt)/u);
  });
  it("기록이 있으면 txt 를 내려받는다", async () => {
    // listAiActivityLogs 가 실제로 읽는 자리에 직접 넣는다 — recordAiActivity 는 원격 미러
    // fetch 를 띄우므로 이 계약(로그 → 파일)과 무관한 실패를 끌고 온다.
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([RECORD]));
    const blobs: { name: string }[] = [];
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stub");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(this: HTMLAnchorElement) {
      blobs.push({ name: this.download });
    });

    expect(downloadAiUsageLogText()).toBe(true);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.name).toMatch(/^ai-usage-log-.*\.txt$/u);
    const saved = createUrl.mock.calls[0]?.[0];
    if (!(saved instanceof Blob)) throw new Error("Blob 이 만들어지지 않았다");
    expect(saved.type).toBe("text/plain;charset=utf-8");
    await expect(saved.text()).resolves.toContain("분수를 놓아줘");
  });
  it("기록이 없으면 빈 파일을 떨어뜨리지 않는다", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stub");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    expect(downloadAiUsageLogText()).toBe(false);
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
  it("두 ☰ 표면 모두에 항목이 있고, 누르면 메뉴를 닫고 내려받기를 부른다", () => {
    for (const [variant, testid] of [["header", "ai-more-usage-log"], ["composer", "ai-command-menu-usage-log"]] as const) {
      const calls: string[] = [];
      const menu = createAiActionMenuItems({
        variant,
        close: () => calls.push("close"),
        actions: {
          exportAudit: () => undefined,
          downloadUsageLog: () => calls.push("download"),
          openHistory: () => undefined,
          openTools: () => undefined,
          openInstructions: () => undefined,
          compactContext: () => undefined,
          openSettings: () => undefined,
        },
      });
      const item = menu.items.find((button) => button.dataset.testid === testid);
      if (!item) throw new Error(`${variant} 표면에 ${testid} 항목이 없다`);
      expect(item.textContent).toContain("사용 로그 내려받기");
      item.click();
      expect(calls).toEqual(["close", "download"]);
    }
  });
});

describe("audioAiDescriptions", () => {
  isolateTimers();
  const empty: AudioResourceProject = { assets: { uploaded: {} }, resourceProfiles: [] };
  const musicId = "cc0-bgm-rtp-fld-001";
  const soundId = "cc0-se-orp-interface-interface2";
  describe("shared AI audio draft integration", () => {
    it.each([["music", musicId], ["sound", soundId]] as const)(
      "inherits an AI draft for shipped %s without a project override",
      (kind, id) => {
        const resource = listAudioResources(kind, empty).find(entry => entry.id === id);
        expect(resource).toMatchObject({ id, descriptionSource: "ai-listening" });
        expect(resource?.description.length).toBeGreaterThan(0);
      },
    );

    it.each(["", "PROJECT_AUDIO_SENTINEL"])("keeps explicit %j ahead of a draft and resets to the draft", description => {
      const ref = { kind: "music", resourceId: musicId } as const;
      const inherited = listAudioResources("music", empty).find(entry => entry.id === musicId);
      const overrides = setAudioDescriptionOverride(undefined, ref, description);
      expect(listAudioResources("music", { ...empty, audioDescriptions: overrides })
        .find(entry => entry.id === musicId)).toMatchObject({ description, descriptionSource: "project" });
      const reset = resetAudioDescriptionOverride(overrides, ref);
      expect(reset).toBeUndefined();
      const resetProject = reset === undefined ? empty : { ...empty, audioDescriptions: reset };
      const restored = listAudioResources("music", resetProject).find(entry => entry.id === musicId);
      expect(restored).toEqual(inherited);
      expect(restored?.descriptionSource).toBe("ai-listening");
    });

    it.each(["cc0-bgm-rtp-lft-001", "cc0-bgm-rtp-rad-001", "cc0-bgm-rtp-prx-006"])(
      "retains the creative brief for withheld %s", id => {
        const track = BGM_CATALOG.find(entry => entry.id === id);
        expect(track).toBeDefined();
        expect(listAudioResources("music", empty).find(entry => entry.id === id)).toMatchObject({
          description: track?.brief, descriptionSource: "catalog-brief",
        });
      },
    );

    it("does not mutate projects, register orphan overrides, or cross kind partitions", () => {
      const project: AudioResourceProject = {
        ...empty,
        audioDescriptions: { sound: { [musicId]: "WRONG_KIND", orphan: "ORPHAN" } },
        assets: { uploaded: { [musicId]: { kind: "sound", name: "same-id-other-kind" } } },
      };
      const before = JSON.stringify(project);
      const music = listAudioResources("music", project);
      const sound = listAudioResources("sound", project);
      expect(music.find(entry => entry.id === musicId)?.descriptionSource).toBe("ai-listening");
      expect(getAudioAiDescription("sound", musicId)).toBeUndefined();
      expect(getAudioAiDescription("music", soundId)).toBeUndefined();
      expect(getAudioAiDescription("music", "orphan")).toBeUndefined();
      expect(sound.find(entry => entry.id === musicId)).toMatchObject({
        description: "WRONG_KIND", descriptionSource: "project",
      });
      expect([...music, ...sound].some(entry => entry.id === "orphan")).toBe(false);
      expect(JSON.stringify(project)).toBe(before);
      expect(Object.hasOwn(empty, "audioDescriptions")).toBe(false);
    });

    it("ships only valid, unique, known drafts with retained model and review provenance", () => {
      const resources = [listAudioResources("music", empty), listAudioResources("sound", empty)].flat();
      const published = resources.filter(entry => entry.descriptionSource === "ai-listening");
      expect(published).toHaveLength(data.entries.length);
      expect(new Set(data.entries.map(entry => `${entry.kind}:${entry.id}`)).size).toBe(data.entries.length);
      expect(data.source).toBe("ai-listening");
      expect(data.verification).toBe("unverified-ai-draft");
      for (const draft of data.entries) {
        expect(draft.status).toBe("ok");
        expect(draft.result.audio_available).toBe(true);
        expect(audioAiDraftDescription(draft)).toBe(draft.result.description);
        expect(draft.result.description.trim().length).toBeGreaterThan(0);
        expect(draft.result.description.length).toBeLessThanOrEqual(AUDIO_DESCRIPTION_MAX_LENGTH);
        expect(["gemini-3.8-flash-high", "gemini-3.1-pro-high"]).toContain(draft.model);
        expect(["unverified-ai-draft", "human-corrected-ai-draft"]).toContain(draft.review);
        expect(Object.keys(draft.evidence).length).toBeGreaterThan(0);
        expect(resources.find(entry => entry.kind === draft.kind && entry.id === draft.id))
          .toMatchObject({ description: draft.result.description, descriptionSource: "ai-listening" });
      }
      expect(data.entries.find(entry => entry.id === "cc0-bgm-rtp-btl-001"))
        .toMatchObject({ model: "gemini-3.1-pro-high", review: "human-corrected-ai-draft" });
      // cc0-se-kis-footstep-carpet-003 left the SE catalog and the draft set in the public baseline (0d4f13e7c8).
      for (const id of ["cc0-se-orp-npc-slime-slime8", "easyrpg-sound-ice9"]) {
        expect(data.entries.find(entry => entry.id === id))
          .toMatchObject({ model: "gemini-3.1-pro-high", review: "unverified-ai-draft" });
      }
      const smoke = data.entries.find(entry => entry.id === "cc0-se-orp-interface-interface1");
      expect(smoke).toMatchObject({ model: "gemini-3.8-flash-high", review: "unverified-ai-draft" });
      expect(smoke).not.toHaveProperty("analyzedAt");
    });

    it.each(["music", "sound"] as const)("preserves builtin ordering and tags for %s", kind => {
      const sources = {
        music: [...BGM_CATALOG, ...CC0_MUSIC_ASSETS, ...OPRN_BGM_ASSETS, ...EASYRPG_MUSIC_ASSETS],
        sound: [...SE_CATALOG, ...CC0_SOUND_ASSETS, ...EASYRPG_SOUND_ASSETS],
      };
      const ids = [...new Set(sources[kind].map(entry => entry.id))];
      const resources = listAudioResources(kind, empty);
      expect(resources.slice(0, ids.length).map(entry => entry.id)).toEqual(ids);
      for (const resource of resources) {
        const bgm = BGM_CATALOG.find(entry => entry.id === resource.id);
        const se = SE_CATALOG.find(entry => entry.id === resource.id);
        const cc0 = [...CC0_MUSIC_ASSETS, ...CC0_SOUND_ASSETS].find(entry => entry.id === resource.id);
        const oprn = OPRN_BGM_ASSETS.find(entry => entry.id === resource.id);
        const legacy = [...EASYRPG_MUSIC_ASSETS, ...EASYRPG_SOUND_ASSETS].find(entry => entry.id === resource.id);
        if (bgm) expect(resource.tags).toEqual([...bgm.tags, bgm.category, bgm.titleEn, bgm.trackCode]);
        else if (se) expect(resource.tags).toEqual([...se.tags, se.category, se.baseName]);
        else if (cc0) expect(resource.tags).toEqual(["cc0", kind]);
        else if (oprn) expect(resource.tags).toEqual(["oprn-bgm", "ai-generated", kind]);
        else if (legacy) expect(resource.tags).toEqual(moodTagsForAsset(legacy));
      }
    });

    it("keeps failed MIDI and undescribed uploads on prior metadata", () => {
      const project: AudioResourceProject = {
        ...empty, assets: { uploaded: { qa_missing: { kind: "music", name: "uploaded" } } },
      };
      const resources = listAudioResources("music", project);
      for (const excluded of data.exclusions.filter(entry => entry.reason === "fail")) {
        const asset = EASYRPG_MUSIC_ASSETS.find(entry => entry.id === excluded.id);
        expect(asset).toBeDefined();
        if (!asset) throw new TypeError(`Missing legacy fixture ${excluded.id}`);
        expect(resources.find(entry => entry.id === asset.id)).toMatchObject({
          description: [asset.name, ...moodTagsForAsset(asset)].join(" · "),
          descriptionSource: "metadata-derived",
        });
      }
      expect(resources.find(entry => entry.id === "qa_missing"))
        .toMatchObject({ description: "", descriptionSource: "missing" });
    });

    it.each([["music", musicId, "bgm"], ["sound", soundId, "se"]] as const)(
      "shares shipped %s drafts with search and the actual description view", (kind, id, searchKind) => {
        const draft = data.entries.find(entry => entry.id === id);
        if (!draft) throw new TypeError(`Missing shipped fixture ${id}`);
        const resource = listAudioResources(kind, empty).find(entry => entry.id === id);
        if (!resource) throw new TypeError(`Missing resource fixture ${id}`);
        const metadata = [resource.name, ...resource.tags].map(value => value.toLowerCase());
        const token = draft.result.description.split(/\s+/u)
          .find(word => word.length > 2 && !metadata.some(value => value.includes(word.toLowerCase())));
        if (!token) throw new TypeError(`Missing description-only token for ${id}`);
        const view = audioDescriptionView(resource);
        expect(view.dataset.descriptionSource).toBe("ai-listening");
        expect(view.querySelector('[data-testid="audio-description-text"]')?.textContent).toBe(draft.result.description);
        expect(view.querySelector('[data-testid="audio-description-source"]')?.textContent)
          .toBe(AUDIO_DESCRIPTION_SOURCE_LABELS["ai-listening"]);
        expect(searchResources(searchKind, token, { audioProject: empty }))
          .toContainEqual(expect.objectContaining({ resourceId: id, description: draft.result.description, descriptionSource: "ai-listening" }));
        const cleared = { ...empty, audioDescriptions: { [kind]: { [id]: "" } } };
        expect(searchResources(searchKind, token, { audioProject: cleared })
          .some(entry => entry.resourceId === id)).toBe(false);
      },
    );

    it("does not persist shared defaults when listing then saving a project", () => {
      const project = createBlankProject();
      const before = serialize(project);
      listAudioResources("music", project);
      listAudioResources("sound", project);
      expect(serialize(project)).toBe(before);
      expect(Object.hasOwn(deserialize(before), "audioDescriptions")).toBe(false);
    });
  });
  describe("AI draft acceptance boundary", () => {
    const valid = { status: "ok", result: { audio_available: true, description: "AI_DRAFT_SENTINEL" } };
    it("accepts the exact bounded description without rewriting it", () => {
      expect(audioAiDraftDescription(valid)).toBe(valid.result.description);
      const description = "x".repeat(AUDIO_DESCRIPTION_MAX_LENGTH);
      expect(audioAiDraftDescription({ ...valid, result: { audio_available: true, description } })).toBe(description);
    });
    it.each([
      {}, { status: "ok" }, { status: "ok", result: null },
      { result: valid.result }, { status: "no-audio", result: valid.result },
      { status: "fail", result: valid.result },
      { status: "ok", result: { description: "FLAG_MISSING" } },
      ...[false, "true", 1].map(audio_available => ({ ...valid, result: { ...valid.result, audio_available } })),
      ...[undefined, "", " \n ", 42, "x".repeat(AUDIO_DESCRIPTION_MAX_LENGTH + 1)]
        .map(description => ({ ...valid, result: { ...valid.result, description } })),
    ])("rejects unsuccessful or incomplete record %#", record => {
      expect(audioAiDraftDescription(record)).toBeUndefined();
    });
  });
});
