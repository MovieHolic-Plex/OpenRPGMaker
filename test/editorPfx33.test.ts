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
import type { Project, SectionStructureKitDef, TilesetDef } from "@/project/types";
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
import { AUDIO_DESCRIPTION_MAX_LENGTH, resetAudioDescriptionOverride, setAudioDescriptionOverride, getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { isolateTimers } from "./mergedTeardown";
import { resetMapEditHistory, getMapEditHistoryState, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions, spatialProjectKey, type SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spatialBuildProposal } from "@/editor/panels/spatialBuildActions";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { libraryObjectCardId } from "@/editor/panels/spatialObjectDraft";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { librarySpaceCardId, freshSpatialId, spaceDraftTarget, usedSpatialIds } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome, renderSpatialSpacesInspector, spatialSpacesChrome } from "@/editor/panels/spatialSpacesTab";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { spaceDesign, fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { compileSpaces } from "@/editor/spatial/compileSpaces";
import { requireOccurrenceAssociations } from "@/project/spatial/domain";
import { SPACE_TILE_PX, renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { mutateWorkingSpace, workingProject } from "@/editor/panels/spatialSpaceCommands";
import { identityAuthoringController, reconstructDraft } from "./support/spatialAuthoringIdentity";
import { clearFavoriteTilesForTest, recordRecentTile } from "@/editor/panels/tileBrushTools";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { CARD_COLUMNS, PALETTE_CARD_ROW_PX, PALETTE_CARD_WINDOW, PALETTE_THUMB_PX, resetSmartPaletteForTests } from "@/editor/panels/tilePaletteSmart";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import { chooseKind, cleanupAudioManager, control, row, setupAudioManager, writeDraft } from "./helpers/audioDescriptionManager";
import { AUDIO_PREVIEW_DEFAULTS, AudioPreviewSession, type AudioPreviewState } from "@/editor/panels/audioPreviewSession";
import { audioPreviewTime } from "@/editor/panels/audioPreviewPlayer";
import { installPreviewMedia, mediaMetadata, previewMedia } from "./support/previewMedia";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { BATTLE_HIT_FEEL_IDS, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";

describe("editorPanelsSuite", () => {
  isolateTimers();
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
});

describe("editorPanelsSuite10", () => {
  isolateTimers();
  describe("spatialSourceBuildUiBoundary", () => {
    isolateTimers();
    const previous = store.getCurrent();
    const previousEditor = editorState.get();
    let host: HTMLDivElement;
    let target: ReturnType<typeof manualBuildFixture>["target"];
    function paint(): void {
      renderDatabasePanel(host);
    }
    function control<T extends Element>(testid: string): T {
      const node = host.querySelector<T>(`[data-testid=${JSON.stringify(testid)}]`);
      if (!node) throw new Error(`missing ${testid}`);
      return node;
    }
    function fill(testid: string, value: string): void {
      const input = control<HTMLInputElement>(testid);
      input.value = value;
      input.dispatchEvent(new Event("change"));
    }
    function click(testid: string): void {
      const picker = host.querySelector<HTMLSelectElement>("[data-testid='composition-design']");
      if (testid.startsWith("spatial-card-") && picker) {
        picker.value = testid.slice("spatial-card-".length); picker.dispatchEvent(new Event("change")); return;
      }
      control<HTMLButtonElement>(testid).click();
    }
    function selectObject(): void {
      setDatabaseActiveTab("spatialObjects");
      paint();
      click(`spatial-card-${libraryObjectCardId("hearth-design")}`);
    }
    function selectSpace(): void {
      setDatabaseActiveTab("spatialSpaces");
      paint();
      click(`spatial-card-${librarySpaceCardId(spaceDesign)}`);
    }
    function fillTarget(): void {
      fill("spatial-build-map", target.mapId);
      fill("spatial-build-rect-x", String(target.rect.x));
      fill("spatial-build-rect-y", String(target.rect.y));
      fill("spatial-build-rect-width", String(target.rect.width));
      fill("spatial-build-rect-height", String(target.rect.height));
      fill("spatial-build-entry-x", String(target.entry.x));
      fill("spatial-build-entry-y", String(target.entry.y));
    }
    beforeEach(() => {
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
      resetSpatialAuthoringSessions();
      resetSpatialPlacesTabChrome();
      resetSpatialSpacesTabChrome();
      resetSpatialObjectsTabChrome();
      resetMapEditHistory();
      target = manualBuildFixture().target;
      editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null, activePaletteStamp: null });
      host = document.createElement("div");
      host.className = "database-modal-body";
      document.body.append(host);
    });
    afterEach(() => {
      host.remove();
      bindSpatialAuthoringControllerFactory(null);
      resetSpatialAuthoringSessions();
      resetSpatialPlacesTabChrome();
      resetSpatialSpacesTabChrome();
      resetSpatialObjectsTabChrome();
      store.replace(previous, { preserveEventDrafts: false });
      editorState.set(previousEditor);
      setDatabaseActiveTab("overview");
    });
    describe("source build input lifecycle", () => {
      it("requires fresh object target consent after store.replaceProject with a coincident map id", () => {
        // Given
        selectObject();
        fillTarget();
        fill("spatial-build-seed", "19");
        click("spatial-build");
        expect(hasAuthoringPreview()).toBe(true);
        const other = structuredClone(store.getCurrent());
        const otherMap = other.maps[target.mapId];
        if (!otherMap) throw new Error("missing coincident map");
        otherMap.name = "Project B coincident map";
        const keyA = spatialProjectKey();
        store.replaceProject(other);
        expect(spatialProjectKey()).not.toBe(keyA);
        paint();
        selectObject();
        expect(spatialBuildProposal()).toBeNull();
        const beforeB = structuredClone(store.getCurrent());
        // When
        click("spatial-build");
        const previewIssued = hasAuthoringPreview();
        click("spatial-apply");
        // Then
        expect(previewIssued).toBe(false);
        expect(spatialBuildProposal()).toBeNull();
        expect(store.getCurrent()).toEqual(beforeB);
      });

      it.each(["", "1.5", "9007199254740992"] as const)("rejects empty or non-integer seed %j without issuing a proposal", (value) => {
        // Given
        selectSpace();
        fill("spatial-build-seed", value);
        const live = structuredClone(store.getCurrent());
        // When
        click("spatial-build");
        // Then
        expect(hasAuthoringPreview()).toBe(false);
        expect(spatialBuildProposal()).toBeNull();
        expect(store.getCurrent()).toEqual(live);
        expect(control<HTMLInputElement>("spatial-build-seed").value).toBe(value);
      });

      it("keeps an explicit zero seed as zero", () => {
        // Given
        selectSpace();
        fill("spatial-build-seed", "0");
        // When
        click("spatial-build");
        // Then
        expect(spatialBuildProposal()?.input.seed).toBe(0);
        expect(hasAuthoringPreview()).toBe(true);
      });

      it("rejects a negative object entry without pinning, then builds after correction", () => {
        // Given
        selectObject();
        fillTarget();
        fill("spatial-build-seed", "19");
        fill("spatial-build-entry-x", "-1");
        click("spatial-build");
        expect(hasAuthoringPreview()).toBe(false);
        expect(spatialBuildProposal()).toBeNull();
        expect(control<HTMLElement>("spatial-preview-error").textContent).not.toBe("");
        expect(control<HTMLInputElement>("spatial-build-entry-x").value).toBe("-1");
        const live = structuredClone(store.getCurrent());
        // When
        fill("spatial-build-entry-x", String(target.entry.x));
        click("spatial-build");
        // Then
        expect(store.getCurrent()).toEqual(live);
        expect(hasAuthoringPreview()).toBe(true);
        expect(spatialBuildProposal()?.input.destination).toMatchObject({
          kind: "map",
          currentMapId: target.mapId,
          entry: target.entry,
        });
        expect(control<HTMLElement>("spatial-preview-error").textContent).toBe("");
      });
    });
  });
  describe("spatialSpaceActions", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function session(): SpatialAuthoringSession {
      return {
        tab: "spaces",
        mode: "design",
        source: "own",
        designId: librarySpaceCardId(spaceDesign),
        occurrenceId: null,
        camera: { x: 0, y: 0, zoom: 1 },
        breadcrumb: [],
        legacyOrigin: null,
        placeKindFilter: null,
        regionKindFilter: null,
        inspectorOpen: true,
      };
    }
    function spaceCard() {
      return {
        id: librarySpaceCardId(spaceDesign),
        localId: spaceDesign,
        name: "Compiler room",
        source: "own" as const,
        kind: "spaces" as const,
        usage: 0,
      };
    }
    function placedCard() {
      return {
        id: spaceRoot,
        localId: spaceDesign,
        name: "Compiler room",
        source: "placed" as const,
        kind: "spaces" as const,
        usage: 0,
      };
    }
    beforeEach(() => {
      store.replace(spaceCompilerFixture(7));
      resetSpatialSpacesTabChrome();
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    });
    afterEach(() => {
      bindSpatialAuthoringControllerFactory(null);
      resetSpatialSpacesTabChrome();
      store.replace(previous);
    });
    describe("spatial space actions", () => {
      it("keeps the issued draft handle so reconstructed wrappers are foreign-draft", () => {
        const controller = identityAuthoringController();
        const created = controller.createDraft();
        if (created.kind !== "ok") throw new Error("draft");
        const rebuilt = reconstructDraft(created.value.project);
        expect(controller.preview(rebuilt, { operation: { kind: "edit" } }).kind).toBe("error");
        expect(controller.preview(created.value, { operation: { kind: "edit" } }).kind).toBe("ok");
        const host = document.createElement("div");
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesInspector(spaceCard(), true, paint));
        };
        paint();
        const input = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
        const baseline = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width;
        input!.value = "14";
        input!.dispatchEvent(new Event("change"));
        expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(baseline);
        expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
        const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
        chrome.preview?.();
        expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
        spatialSpacesChrome(spaceCard(), paint).apply?.();
        expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
      });

      it("does not apply clone/delete/refresh until explicit preview", () => {
        const before = JSON.stringify(store.getCurrent().spatialAuthoring);
        const placed = spatialSpacesChrome(placedCard(), () => undefined);
        placed.duplicate?.();
        placed.refresh?.();
        expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
        const owned = spatialSpacesChrome(spaceCard(), () => undefined);
        owned.delete?.();
        spatialSpacesChrome(spaceCard(), () => undefined).onDeleteConfirm?.();
        expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
        owned.preview?.();
        expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
      });

      it("refuses apply without a visible preview", () => {
        const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
        chrome.add?.();
        const current = spatialSpacesChrome(spaceCard(), () => undefined);
        expect(current.apply).toBeUndefined();
        current.apply?.();
        expect(store.getCurrent().spatialAuthoring?.library.spaces["untitled-space-1"]).toBeUndefined();
      });

      it("compiles placed edits through the preview request", () => {
        const host = document.createElement("div");
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesInspector(placedCard(), true, paint));
        };
        paint();
        const width = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
        width!.value = "16";
        width!.dispatchEvent(new Event("change"));
        spatialSpacesChrome(placedCard(), paint).preview?.();
        spatialSpacesChrome(placedCard(), paint).apply?.();
        const project = store.getCurrent();
        const spatialDocument = fixtureDocument(project);
        const compiled = compileSpaces({
          project,
          document: spatialDocument,
          occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
        });
        expect(compiled.ports.length).toBeGreaterThan(0);
        expect(compiled.map.width).toBeGreaterThan(0);
      });

      it("empties slots through preview/apply then compile", () => {
        const host = document.createElement("div");
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
        };
        paint();
        const before = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots.length ?? 0;
        expect(before).toBeGreaterThan(0);
        mutateWorkingSpace(spaceDraftTarget(spaceCard()), (space) => ({ ...space, objectSlots: [] }));
        spatialSpacesChrome(spaceCard(), paint).preview?.();
        spatialSpacesChrome(spaceCard(), paint).apply?.();
        expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots).toEqual([]);
        const rebuilt = reinstantiateSpace(store.getCurrent(), (space) => space);
        const spatialDocument = fixtureDocument(rebuilt);
        const compiled = compileSpaces({
          project: rebuilt,
          document: spatialDocument,
          occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
        });
        expect(compiled.objects).toEqual([]);
      });

      it("nudges a slot by pointer tiles and Escape restores the origin", () => {
        const host = document.createElement("div");
        document.body.append(host);
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
        };
        paint();
        const board = host.querySelector<HTMLElement>("[data-testid='spatial-space-board']");
        const slot = host.querySelector<HTMLButtonElement>("[data-testid='spatial-slot-hearth']");
        expect(board).not.toBeNull();
        expect(slot).not.toBeNull();
        board!.getBoundingClientRect = () => ({
          x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 288, width: 480, height: 288, toJSON: () => undefined,
        });
        const origin = workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
          .find((entry) => entry.id === "hearth");
        expect(origin?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
        slot!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
        board!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 3 * SPACE_TILE_PX + 1, clientY: 5 * SPACE_TILE_PX + 1 }));
        expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
          .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 3, y: 5 });
        board!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
          .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
        host.remove();
      });

      it("adds a source space and clones a placed occurrence without silent no-op", () => {
        const source = spatialSpacesChrome(spaceCard(), () => undefined);
        expect(source.add).toBeTypeOf("function");
        const before = new Set(Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}));
        source.add?.();
        spatialSpacesChrome(spaceCard(), () => undefined).preview?.();
        spatialSpacesChrome(spaceCard(), () => undefined).apply?.();
        const added = Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
        expect(added).toHaveLength(1);
        expect(store.getCurrent().spatialAuthoring?.library.spaces[added[0] ?? ""]?.objectSlots).toEqual([]);
        resetSpatialSpacesTabChrome();
        bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
        const placed = spatialSpacesChrome(placedCard(), () => undefined);
        expect(placed.duplicate).toBeTypeOf("function");
        expect(placed.delete).toBeTypeOf("function");
      });

      it("does not reuse a library-wide id on repeated add or clone allocation", () => {
        const project = store.getCurrent();
        const objectId = Object.keys(project.spatialAuthoring?.library.objects ?? {})[0];
        expect(objectId).toBeTruthy();
        const first = freshSpatialId(project, "space");
        const second = freshSpatialId(project, "space");
        expect(first).not.toBe(second);
        expect(usedSpatialIds(project).has(first)).toBe(false);
        expect(first).not.toBe(objectId);
        const occupied = structuredClone(project);
        if (!occupied.spatialAuthoring) throw new Error("missing document");
        occupied.spatialAuthoring.library.objects = {
          ...occupied.spatialAuthoring.library.objects,
          [first]: occupied.spatialAuthoring.library.objects[objectId!],
        };
        expect(freshSpatialId(occupied, "space")).not.toBe(first);
        const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
        const before = new Set(Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}));
        chrome.add?.();
        chrome.add?.();
        const added = Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
        expect(added).toHaveLength(2);
        expect(added[0]).not.toBe(added[1]);
        chrome.duplicate?.();
        chrome.duplicate?.();
        expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.id).toBe(spaceDesign);
      });
    });
  });
  describe("tilePaletteSmart", () => {
    isolateTimers();
    function pass(count: number) {
      return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
    }
    function sectionKit(id: string, name: string, role: "building" | "prop"): SectionStructureKitDef {
      return {
        id,
        name,
        kind: "section",
        width: 1,
        height: 1,
        rows: [{ tiles: [4] }],
        learnedFrom: "user-paint",
        ai: { description: name, placementRules: "", role, tags: name.includes("기와") ? ["기와"] : [] },
      };
    }
    function smartTileset(kitCount = 1): TilesetDef {
      const count = 16;
      const kits = [sectionKit("giwa-house", "조선 기와집", "building")];
      for (let index = 1; index < kitCount; index += 1) kits.push(sectionKit(`shed-${index}`, `헛간 ${index}`, "prop"));
      return {
        id: "smart-fixture",
        name: "합성",
        kind: "custom",
        image: { type: "bundled", id: "smart-sheet" },
        tileSize: 16,
        count,
        tilesPerRow: 8,
        passability: pass(count),
        priority: Array.from({ length: count }, () => "lower"),
        terrain: Array(count).fill(0),
        tileMeta: [
          undefined,
          { label: "흙길 외곽" },
          undefined,
          { label: "연못" },
          { label: "기와 조각", tags: ["기와"] },
        ],
        autotileGroups: [{
          id: "dirt-road",
          name: "조선 흙길",
          memberTileIds: [1, 8],
          variantMap: { "0": 1, "255": 8 },
          layer: "lower",
        }],
        tileGroups: [{
          id: "pond",
          name: "연못",
          role: "water",
          defaultLayer: "lower",
          tileIds: [3],
          description: "",
          placementRules: "",
        }],
        structureKits: kits,
      };
    }
    function bareTileset(): TilesetDef {
      const count = 8;
      return {
        id: "bare-fixture",
        name: "빈 판",
        kind: "custom",
        image: { type: "bundled", id: "bare-sheet" },
        tileSize: 16,
        count,
        tilesPerRow: 4,
        passability: pass(count),
        priority: Array.from({ length: count }, () => "lower"),
        terrain: Array(count).fill(0),
      };
    }
    describe("smart tile palette", () => {
      let host: HTMLElement;
      const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

      function mount(tileset: TilesetDef): void {
        const project = createBlankProject();
        project.tilesets[tileset.id] = tileset;
        project.maps[project.startMapId]!.tilesetId = tileset.id;
        store.replace(project);
        editorState.set({
          currentMapId: project.startMapId,
          layer: "lower",
          tool: "paint",
          paintShape: "pen",
          selectedTile: 0,
          activePaletteStamp: null,
          autoConnectMode: false,
        });
        host = document.createElement("div");
        host.dataset.testid = "left-palette-root";
        document.body.append(host);
        renderTilePalette(host);
      }

      beforeEach(() => {
        vi.useFakeTimers();
        resetSmartPaletteForTests();
        clearFavoriteTilesForTest();
      });

      afterEach(() => {
        host?.remove();
        resetSmartPaletteForTests();
        clearFavoriteTilesForTest();
        vi.clearAllTimers();
        vi.useRealTimers();
      });

      it("opens on terrain cards and paints the autotile body with the existing connect flag", () => {
        mount(smartTileset());
        expect(find("palette-tab-terrain")?.getAttribute("aria-selected")).toBe("true");
        expect(find("tile-palette")).toBeNull();
        const card = find("palette-terrain-auto:dirt-road");
        expect(card?.querySelector(".palette-card-name")?.textContent).toBe("조선 흙길");
        const sprite = card?.querySelector<HTMLElement>(".palette-card-sprite");
        expect(sprite?.getAttribute("style")).toContain(`calc(-1 * ${PALETTE_THUMB_PX}px)`);
        expect(sprite?.getAttribute("style")).not.toContain("100%");
        editorState.set({ activePaletteStamp: { width: 1, height: 1, cells: [], source: { startTile: 0, endTile: 0 } } });
        card?.click();
        expect(editorState.get()).toMatchObject({
          selectedTile: 8,
          autoConnectMode: true,
          activePaletteStamp: null,
          tool: "paint",
          layer: "lower",
        });
      });

      it("filters terrain chips down to water", () => {
        mount(smartTileset());
        find("palette-terrain-chip-water")?.click();
        expect(find("palette-terrain-group:pond")).not.toBeNull();
        expect(find("palette-terrain-auto:dirt-road")).toBeNull();
      });

      it("stamps a prefab and toggles it off", () => {
        mount(smartTileset());
        find("palette-tab-prefab")?.click();
        find("palette-prefab-giwa-house")?.click();
        expect(editorState.get().activePaletteStamp).toMatchObject({ kitId: "giwa-house", width: 1, height: 1 });
        expect(editorState.get().tool).toBe("paint");
        find("palette-prefab-giwa-house")?.click();
        expect(editorState.get().activePaletteStamp).toBeNull();
      });

      it("lists a recently picked tile and selects it through the shared tile path", () => {
        mount(smartTileset());
        recordRecentTile(4);
        find("palette-tab-recent")?.click();
        expect(find("palette-recent-4")?.textContent).toContain("기와 조각");
        find("palette-recent-4")?.click();
        expect(editorState.get().selectedTile).toBe(4);
        expect(editorState.get().activePaletteStamp).toBeNull();
      });

      it("keeps the raw grid, category select, and its own search on the individual tab", () => {
        mount(smartTileset());
        find("palette-tab-tiles")?.click();
        expect(find("tile-palette")).not.toBeNull();
        expect(find("tile-category-select")).not.toBeNull();
        expect(find("tile-search-input")).not.toBeNull();
        expect(find("palette-catalog-search")).toBeNull();
      });

      it("ranks a prefab hit before an individual tile in search results", () => {
        mount(smartTileset());
        const input = find("palette-catalog-search");
        if (!(input instanceof HTMLInputElement)) throw new Error("missing catalog search");
        input.value = "기와";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(120);
        const headings = [...host.querySelectorAll("[data-testid='palette-search-results'] h4")].map((node) => node.textContent ?? "");
        const prefabAt = headings.findIndex((text) => text.startsWith("프리팹"));
        const tileAt = headings.findIndex((text) => text.startsWith("개별 타일"));
        expect(prefabAt).toBeGreaterThanOrEqual(0);
        expect(tileAt).toBeGreaterThan(prefabAt);
        expect(find("palette-search-summary")?.textContent).toContain("프리팹");
      });

      it("virtualizes a long prefab list to the first window", () => {
        mount(smartTileset(80));
        find("palette-tab-prefab")?.click();
        const body = find("palette-smart-body");
        expect(body?.clientHeight ?? 0).toBe(0);
        expect(host.querySelectorAll(".palette-card").length).toBeLessThanOrEqual(PALETTE_CARD_WINDOW);
        expect(host.querySelectorAll(".palette-card").length).toBeGreaterThan(0);
        const rows = Math.ceil(80 / CARD_COLUMNS);
        expect(host.querySelector<HTMLElement>(".palette-card-spacer")?.style.height).toBe(`${rows * PALETTE_CARD_ROW_PX - 4}px`);
      });

      it("falls back to the raw grid when the tileset has no catalog", () => {
        mount(bareTileset());
        expect(find("palette-smart-tabs")).toBeNull();
        expect(find("tile-palette")).not.toBeNull();
        expect(find("tile-category-select")).not.toBeNull();
      });

      it("clears active catalog search when switching palette tabs so the target tab renders immediately", () => {
        mount(smartTileset());
        const input = find("palette-catalog-search");
        if (!(input instanceof HTMLInputElement)) throw new Error("missing catalog search");
        input.value = "기와";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(120);
        expect(find("palette-search-results")).not.toBeNull();

        find("palette-tab-prefab")?.click();
        expect(find("palette-tab-prefab")?.getAttribute("aria-selected")).toBe("true");
        expect(find("palette-search-results")).toBeNull();
        expect(find("palette-smart")?.dataset.paletteView).toBe("prefab");
        expect(find("palette-prefab-giwa-house")).not.toBeNull();
      });

      it("retains auxiliary relief-side-panel in left-palette-root across smart tab switches", () => {
        mount(smartTileset());
        const relief = document.createElement("section");
        relief.dataset.testid = "relief-side-panel";
        relief.hidden = true;
        host.append(relief);

        find("palette-tab-prefab")?.click();
        find("palette-tab-tiles")?.click();
        find("palette-tab-terrain")?.click();

        expect(find("relief-side-panel")).toBe(relief);
        expect(host.querySelectorAll('[data-testid="palette-work-shell"]')).toHaveLength(1);
      });
    });
  });
});

describe("editorPanelsSuite2", () => {
  isolateTimers();
  describe("audioDescriptionEditor", () => {
    isolateTimers();
    beforeEach(setupAudioManager);
    afterEach(cleanupAudioManager);
    const resource = { kind: "music", resourceId: "audio-a" } as const;
    describe("audio description manager", () => {
      it("owns history shortcuts while the resource modal is open", () => {
        chooseKind("music");

        expect(historyHotkeyOwnedByPanel()).toBe(true);
      });

      it("releases history shortcut ownership when the resource modal closes", () => {
        chooseKind("music");

        control("resource-modal-close").click();

        expect(historyHotkeyOwnedByPanel()).toBe(false);
      });

      it("renders an editable description when the visible music category is selected", () => {
        // Given: the existing resource modal.
        // When:
        chooseKind("music");
        // Then: behavioral baseline RED, not a missing-module failure.
        expect(document.querySelectorAll('[data-testid="audio-description-input"]').length).toBe(1);
      });

      it.each(["music", "sound"] as const)("enumerates the complete %s catalog without mutations", kind => {
        // Given:
        const before = structuredClone(store.getCurrent());
        const expected = listAudioResources(kind, before).map(item => item.id).sort();
        // When:
        chooseKind(kind);
        // Then:
        const actual = [...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
          .map(node => node.dataset.resourceId).sort();
        expect(actual).toEqual(expected);
        expect(store.getCurrent()).toEqual(before);
        expect(getMapEditHistoryState().canUndo).toBe(false);
      });

      it("commits normalized input once when Save is activated", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        writeDraft("  <b>author sentinel</b>\nsecond line  ");
        const changes: { readonly scope: string; readonly origin?: string; readonly label?: string }[] = [];
        const unsubscribe = store.subscribe((_project, change) => changes.push(change));
        // When:
        control("audio-description-save").click();
        unsubscribe();
        // Then:
        expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource))
          .toBe("<b>author sentinel</b>\nsecond line");
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ scope: "project", origin: "human" });
        expect(Boolean(changes[0]?.label)).toBe(true);
        expect(control("resource-modal").querySelector("b")).toBeNull();
        expect(control("audio-description-source").dataset.source).toBe("project");
      });

      it("retains a saved description when the manager is reopened", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        writeDraft("reopen sentinel");
        control("audio-description-save").click();
        control("resource-modal-close").click();
        // When:
        openResourceModal();
        chooseKind("music");
        row(resource.resourceId).click();
        // Then:
        expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("reopen sentinel");
      });

      it("stores an explicit clear when an empty draft is saved", () => {
        // Given:
        chooseKind("music");
        const builtin = listAudioResources("music", store.getCurrent()).find(item => item.description.length > 0);
        if (!builtin) throw new Error("Expected a described bundled resource");
        row(builtin.id).click();
        writeDraft("");
        // When:
        control("audio-description-save").click();
        // Then:
        expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, {
          kind: "music", resourceId: builtin.id,
        })).toBe("");
        expect(control("audio-description-source").dataset.source).toBe("project");
      });

      it("removes only the selected override when Restore default is activated", () => {
        // Given:
        store.update(project => {
          project.audioDescriptions = { music: { "audio-a": "", "audio-b": "keep sibling" } };
        });
        chooseKind("music");
        row(resource.resourceId).click();
        resetMapEditHistory();
        // When:
        control("audio-description-reset").click();
        // Then:
        expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
        expect(store.getCurrent().audioDescriptions?.music?.["audio-b"]).toBe("keep sibling");
        expect(control("audio-description-source").dataset.source).toBe("missing");
      });

      it("restores the prior override when project Undo runs", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        writeDraft("undo sentinel");
        control("audio-description-save").click();
        // When:
        expect(undoMapEdit()).toBe(true);
        // Then:
        expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
        expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("");
      });

      it("restores the authored override when project Redo runs", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        writeDraft("redo sentinel");
        control("audio-description-save").click();
        undoMapEdit();
        // When:
        expect(redoMapEdit()).toBe(true);
        // Then:
        expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("redo sentinel");
      });

      it("retains draft DOM, caret and focus during an unrelated store rerender", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        const input = writeDraft("draft stays here");
        input.setSelectionRange(3, 8);
        // When:
        store.update(project => {
          project.audioDescriptions = { music: { "audio-b": "external update" } };
        }, { scope: "project", label: "fixture update" });
        // Then:
        expect(control("audio-description-input")).toBe(input);
        expect(input.value).toBe("draft stays here");
        expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
        expect(document.activeElement).toBe(input);
      });

      it("finds a resource by description without changing the project", () => {
        store.update(project => {
          project.audioDescriptions = { music: { "audio-a": "SEARCH_SENTINEL_20260906" } };
        });
        chooseKind("music");
        const before = structuredClone(store.getCurrent());
        const search = control<HTMLInputElement>("audio-description-search");

        search.value = "SEARCH_SENTINEL_20260906";
        search.dispatchEvent(new Event("input", { bubbles: true }));

        expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
          .map(node => node.dataset.resourceId)).toEqual(["audio-a"]);
        expect(store.getCurrent()).toEqual(before);
      });

      it("filters effective empty descriptions without changing the current draft", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        const input = writeDraft("unsaved");
        const before = structuredClone(store.getCurrent());
        const expected = listAudioResources("music", before)
          .filter(item => item.description.trim().length === 0).map(item => item.id).sort();
        // When:
        const filter = control<HTMLInputElement>("audio-description-missing-filter");
        filter.checked = true;
        filter.dispatchEvent(new Event("change", { bubbles: true }));
        // Then:
        expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
          .map(node => node.dataset.resourceId).sort()).toEqual(expected);
        expect(control("audio-description-input")).toBe(input);
        expect(input.value).toBe("unsaved");
        expect(store.getCurrent()).toEqual(before);
      });

      it("rejects an over-limit programmatic draft without recording history", () => {
        // Given:
        chooseKind("music");
        row(resource.resourceId).click();
        writeDraft("x".repeat(4001));
        const before = structuredClone(store.getCurrent());
        // When:
        control("audio-description-save").click();
        // Then:
        expect(store.getCurrent()).toEqual(before);
        expect(getMapEditHistoryState().canUndo).toBe(false);
        expect(control<HTMLTextAreaElement>("audio-description-input").value).toHaveLength(4001);
      });
    });
  });
  describe("audioPreviewSession", () => {
    isolateTimers();
    const sessions: AudioPreviewSession[] = [];
    function fixture() {
      const host = document.createElement("div");
      document.body.append(host);
      const session = new AudioPreviewSession(host);
      sessions.push(session);
      const states: AudioPreviewState[] = [];
      session.subscribe(state => states.push(state));
      session.select("/fixture.wav");
      return { session, host, media: previewMedia(host), state: () => states.at(-1), states };
    }
    beforeEach(() => { installPreviewMedia(); });
    afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
    describe("editor preview media lifecycle", () => {
      it("does not infer playing from selection or a fulfilled play promise", async () => {
        const f = fixture();
        expect(f.state()?.phase).toBe("ready");
        await f.session.play();
        expect(f.state()?.phase).toBe("loading");
        f.media.dispatchEvent(new Event("playing"));
        expect(f.state()?.phase).toBe("playing");
      });
      it("keeps metadata loading distinct from a requested play", () => {
        const f = fixture();
        f.media.dispatchEvent(new Event("loadstart"));
        expect(f.state()).toMatchObject({ phase: "loading", requested: false });
      });
      it("reports a rejected play and permits retry", async () => {
        const f = fixture();
        vi.mocked(f.media.play).mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
        await f.session.play();
        expect(f.state()).toMatchObject({ phase: "error", error: "blocked" });
        await f.session.play();
        f.media.dispatchEvent(new Event("playing"));
        expect(f.state()?.phase).toBe("playing");
      });
      it("ignores rejected play and events from a replaced source", async () => {
        const f = fixture();
        let reject: (reason: Error) => void = () => { throw new Error("play request not installed"); };
        vi.mocked(f.media.play).mockImplementationOnce(() => new Promise((_resolve, rejectPlay) => { reject = rejectPlay; }));
        const pending = f.session.play();
        f.session.select("/replacement.wav");
        reject(new Error("late rejection"));
        await pending;
        for (const name of ["playing", "ended", "error", "loadedmetadata"]) f.media.dispatchEvent(new Event(name));
        expect(f.state()).toMatchObject({ phase: "ready", current: 0, error: "" });
        expect(f.media.hasAttribute("src")).toBe(false);
      });
      it("pauses without rewinding and resumes from the same position", async () => {
        const f = fixture();
        await f.session.play(); f.media.dispatchEvent(new Event("playing"));
        f.media.currentTime = 8;
        f.session.pause();
        expect(f.state()?.phase).toBe("paused");
        await f.session.play();
        expect(f.media.currentTime).toBe(8);
      });
      it("stops immediately and ignores late canplay or playing", async () => {
        const f = fixture();
        await f.session.play();
        f.media.currentTime = 5;
        f.session.stop();
        f.media.dispatchEvent(new Event("canplay")); f.media.dispatchEvent(new Event("playing"));
        expect(f.state()).toMatchObject({ phase: "stopped", current: 0 });
        expect(f.media.paused).toBe(true);
      });
      it("replays an ended sound immediately", async () => {
        const f = fixture();
        mediaMetadata(f.media, 0.18);
        await f.session.play();
        f.media.currentTime = 0.18; f.media.dispatchEvent(new Event("ended"));
        expect(f.state()?.phase).toBe("ended");
        await f.session.play();
        expect(f.media.currentTime).toBe(0);
        f.media.dispatchEvent(new Event("playing"));
        expect(f.state()?.phase).toBe("playing");
      });
      it("seeks only with a finite known duration and keeps an ended seek position", () => {
        const f = fixture();
        mediaMetadata(f.media, Infinity); f.session.seek(3);
        expect(f.media.currentTime).toBe(0);
        mediaMetadata(f.media, 10); f.session.seek(12);
        expect(f.media.currentTime).toBe(10);
        f.media.dispatchEvent(new Event("ended")); f.session.seek(3);
        expect(f.state()).toMatchObject({ phase: "paused", current: 3, duration: 10 });
      });
      it("makes buffering and decode errors observable", async () => {
        const f = fixture();
        await f.session.play(); f.media.dispatchEvent(new Event("playing"));
        f.media.dispatchEvent(new Event("waiting"));
        expect(f.state()?.phase).toBe("loading");
        f.media.dispatchEvent(new Event("error"));
        expect(f.state()?.phase).toBe("error");
        expect(f.state()?.error.length).toBeGreaterThan(0);
      });
      it("keeps a failed selected source failed during metadata refresh", () => {
        const f = fixture(); f.media.dispatchEvent(new Event("error"));
        f.session.select("/fixture.wav");
        expect(f.state()?.phase).toBe("error");
      });
      it("allows only the latest editor session to play", async () => {
        const a = fixture(); const b = fixture();
        await a.session.play(); a.media.dispatchEvent(new Event("playing"));
        await b.session.play(); b.media.dispatchEvent(new Event("playing"));
        expect(a.media.paused).toBe(true);
        expect(a.state()?.phase).toBe("stopped");
        expect(b.state()?.phase).toBe("playing");
      });
      it("releases source and listeners on disposal", async () => {
        const f = fixture(); await f.session.play();
        f.session.dispose(); const count = f.states.length;
        f.media.dispatchEvent(new Event("error")); f.media.dispatchEvent(new Event("playing"));
        expect(f.states).toHaveLength(count);
        expect(f.host.querySelector("audio")).toBeNull();
        expect(f.media.hasAttribute("src")).toBe(false);
        expect(f.media.paused).toBe(true);
      });
      it("keeps cross-origin playback native until pan is requested", () => {
        const f = fixture(); f.session.select("https://audio.example/no-cors.mp3");
        expect(previewMedia(f.host).hasAttribute("crossorigin")).toBe(false);
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
        expect(previewMedia(f.host).crossOrigin).toBe("anonymous");
      });
      it("applies volume, tempo and a media-position-driven fade without timers", async () => {
        const f = fixture();
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, volume: 40, tempo: 135, fade: 4 });
        await f.session.play();
        expect(f.media.volume).toBe(0); expect(f.media.playbackRate).toBe(1.35);
        f.media.currentTime = 2; f.media.dispatchEvent(new Event("timeupdate"));
        expect(f.media.volume).toBeCloseTo(0.2);
        f.media.currentTime = 4; f.media.dispatchEvent(new Event("timeupdate"));
        expect(f.media.volume).toBeCloseTo(0.4);
      });
      it.each([[0.18, "0:00.18"], [0, "0:00"], [84.636725, "1:24"], [null, "--:--"]] as const)("formats meaningful preview time %s", (seconds, expected) => {
        expect(audioPreviewTime(seconds)).toBe(expected);
      });
      it("preserves fade progress across a music loop, seek and pause", async () => {
        const f = fixture();
        f.session.select("/loop.wav", "", true);
        const media = previewMedia(f.host);
        mediaMetadata(media, 2);
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, fade: 4 });
        await f.session.play();
        media.currentTime = 1.5; media.dispatchEvent(new Event("timeupdate"));
        expect(media.volume).toBeCloseTo(0.375);
        media.currentTime = 0.5; media.dispatchEvent(new Event("timeupdate"));
        expect(media.loop).toBe(true); expect(media.volume).toBeCloseTo(0.625);
        f.session.seek(1.5); media.dispatchEvent(new Event("timeupdate"));
        expect(media.volume).toBeCloseTo(0.625);
        f.session.pause(); await f.session.play();
        media.currentTime = 1.75; media.dispatchEvent(new Event("timeupdate"));
        expect(media.volume).toBeCloseTo(0.6875);
      });
      it("connects real pan routing and disposes every WebAudio resource", async () => {
        const source = { connect: vi.fn(), disconnect: vi.fn() };
        const panner = { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
        const close = vi.fn().mockResolvedValue(undefined);
        const destination = {};
        const createSource = vi.fn(() => source);
        vi.stubGlobal("AudioContext", class {
          destination = destination;
          createMediaElementSource = createSource;
          createStereoPanner = () => panner;
          resume = () => Promise.resolve();
          close = close;
        });
        const f = fixture();
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
        await f.session.play();
        expect(createSource).toHaveBeenCalledWith(previewMedia(f.host));
        expect(source.connect).toHaveBeenCalledWith(panner);
        expect(panner.connect).toHaveBeenCalledWith(destination);
        expect(panner.pan.value).toBe(-0.4);
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: 80 });
        expect(panner.pan.value).toBe(0.8);
        f.session.dispose();
        expect(source.disconnect).toHaveBeenCalledOnce(); expect(panner.disconnect).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
      });
      it("does not recreate a failed pan session after disposal", async () => {
        const f = fixture();
        f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
        previewMedia(f.host).dispatchEvent(new Event("error"));
        f.session.dispose();
        await f.session.play();
        expect(f.host.querySelector("audio")).toBeNull();
      });
    });
  });
  /**
   * 타격감 프리셋(2026-09-27): system.battleHitFeel = impact(기본·생략) | light | calm.
   * 저장 계약(기본 생략·무효값 → 기본), 자료집 시스템 탭 선택, AI set_project_settings, 런타임 DOM 층(아군 피격 흔들림 바닥 ·
   * 히트스톱 진동 · 베기 궤적)을 묶는다. 화면 증거는 output/combat-qa/hitfeel-*(player.html 프로브).
   */
  describe("battleHitFeelPreset", () => {
    isolateTimers();
    describe("system.battleHitFeel — 저장 계약", () => {
      it("새 프로젝트는 묵직하게(impact)로 열리고 JSON 에 키가 없다", () => {
        const project = createBlankProject();
        expect(resolveBattleHitFeel(project.system.battleHitFeel)).toBe("impact");
        expect(serialize(project)).not.toContain("battleHitFeel");
      });

      it("light · calm 은 왕복을 보존하고 impact 는 생략된다", () => {
        for (const feel of ["light", "calm"] as const) {
          const project = createBlankProject();
          project.system.battleHitFeel = feel;
          const wire = serialize(project);
          expect(wire).toContain(`"battleHitFeel":"${feel}"`);
          expect(deserialize(wire).system.battleHitFeel).toBe(feel);
        }
        const base = createBlankProject();
        expect(normalizeSystemRecords({ ...base.system, battleHitFeel: "impact" }).battleHitFeel).toBeUndefined();
      });

      it("모르는 값은 기본으로 풀린다", () => {
        const obj = JSON.parse(serialize(createBlankProject()));
        obj.system.battleHitFeel = "wobbly";
        const restored = deserialize(JSON.stringify(obj));
        expect(restored.system.battleHitFeel).toBeUndefined();
        expect(resolveBattleHitFeel(restored.system.battleHitFeel)).toBe("impact");
      });
    });
    // 타격감 선택은 시스템 탭에서 자료집 「전투 화면」 탭의 타격감 카드로 옮겨졌다(databaseBattleScreenTab.ts).
    describe("자료집 전투 화면 탭 — 타격감 선택", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });
      afterEach(() => {
        document.body.innerHTML = "";
      });

      function renderSystem(): HTMLElement {
        const host = document.createElement("div");
        document.body.append(host);
        renderBattleScreenTab(host);
        return host;
      }

      function hitFeelSelect(host: HTMLElement): HTMLSelectElement {
        const select = host.querySelector<HTMLSelectElement>('[data-testid="db-field-system-battle-hit-feel"]');
        if (!select) throw new Error("타격감 선택이 없다");
        return select;
      }

      it("세 프리셋을 내놓고 기본은 묵직하게다", () => {
        const select = hitFeelSelect(renderSystem());
        expect([...select.options].map((option) => option.value)).toEqual([...BATTLE_HIT_FEEL_IDS]);
        expect(select.value).toBe("impact");
      });

      it("고르면 프로젝트에 저장되고, 기본으로 돌리면 키가 사라진다", () => {
        const host = renderSystem();
        const select = hitFeelSelect(host);
        select.value = "calm";
        select.dispatchEvent(new Event("change"));
        expect(store.getCurrent().system.battleHitFeel).toBe("calm");
        const again = hitFeelSelect(host);
        again.value = "impact";
        again.dispatchEvent(new Event("change"));
        expect("battleHitFeel" in store.getCurrent().system).toBe(false);
      });
    });
    describe("AI set_project_settings battle.hitFeel", () => {
      it("light 를 저장하고 impact 로 되돌리면 지운다", () => {
        const context = { project: createBlankProject() };
        expect(runTool(context, "set_project_settings", { battle: { hitFeel: "light" } }).ok).toBe(true);
        expect(context.project.system.battleHitFeel).toBe("light");
        expect(runTool(context, "set_project_settings", { battle: { hitFeel: "impact" } }).ok).toBe(true);
        expect(context.project.system.battleHitFeel).toBeUndefined();
      });
    });
    describe("런타임 타격감 층", () => {
      afterEach(() => {
        document.body.innerHTML = "";
      });

      it("묵직하게는 아군 피격 흔들림을 최소 heavy 로 올리고, 다른 프리셋은 피해 비율 그대로 둔다", () => {
        expect(hurtShakeIntensity("impact", "graze")).toBe("heavy");
        expect(hurtShakeIntensity("impact", "normal")).toBe("heavy");
        expect(hurtShakeIntensity("impact", "crushing")).toBe("crushing");
        expect(hurtShakeIntensity("impact", undefined)).toBeUndefined();
        expect(hurtShakeIntensity("light", "graze")).toBe("graze");
        expect(hurtShakeIntensity("calm", "normal")).toBe("normal");
      });

      it("진동은 translate 로만 떨고 잦아들어 제자리로 돌아온다", () => {
        const sprite = document.createElement("img");
        const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
        sprite.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
          calls.push({ frames, options });
          return {} as Animation;
        }) as typeof sprite.animate;
        vibrateStruck(sprite, "normal");
        expect(calls).toHaveLength(1);
        const offsets = calls[0]!.frames.map((frame) => Number.parseFloat(String(frame.translate)));
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(0);
        expect(Math.abs(offsets[1]!)).toBeGreaterThan(Math.abs(offsets[offsets.length - 2]!));
        expect(offsets.some((value) => value < 0)).toBe(true);
        expect(calls[0]!.frames.every((frame) => frame.transform === undefined)).toBe(true);
      });

      it("베기 궤적은 적 노드에 붙었다가 스스로 사라진다", async () => {
        const enemy = document.createElement("button");
        enemy.className = "battle-enemy";
        document.body.append(enemy);
        spawnSlashTrail(enemy);
        expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).not.toBeNull();
        await new Promise((resolve) => setTimeout(resolve, SWING_LEAD_MS + 260));
        expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).toBeNull();
      });
    });
  });
});
