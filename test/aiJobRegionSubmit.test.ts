// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAiRegionTaskRunner } from "@/editor/panels/aiRegionTaskRunner";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installAdmitClient } from "./aiJobAdmitSupport";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { submitRegionJob } from "@/editor/aiJobs/submitRegionJob";

function surface(): AiRunSurface {
  const sendButton = document.createElement("button");
  const log = document.createElement("div");
  return {
    panel: document.createElement("div"),
    log,
    sendButton,
    controller: { auditHistory: [], session: null, statusTimeline: [] },
    turnBusy: false,
    disposed: false,
    abortNoticeShown: false,
    activeAbortController: null,
    collapseAfterAiWork: false,
    collapsed: false,
    conversationId: "c1",
    conversationScope: "s1",
    runningPhaseStatus: null,
    runningProgress: null,
    setStatus: vi.fn(),
    beginTurnProgress: vi.fn(),
    endTurnProgress: vi.fn(),
    refreshRunningStatus: vi.fn(),
    refreshAbortButton: vi.fn(),
    startLiveActivity: vi.fn(),
    completeLiveActivity: vi.fn(),
    expandForAiWork: vi.fn(),
    scheduleCollapseAfterAiWork: vi.fn(),
    notifyIfObscuredByTestPlay: vi.fn(),
    drainPendingSends: vi.fn(),
    persistConversation: vi.fn(),
    sendText: vi.fn(async () => undefined),
    appendBubble: () => {
      const node = document.createElement("div");
      log.append(node);
      return node;
    },
    appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }),
    closeToolActivity: vi.fn(),
    clearLastReasoning: vi.fn(),
    isLastReasoningBox: () => false,
  };
}

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("selection-scoped chat admits a region job instead of running a browser session", async () => {
  const harness = installAdmitClient();
  const run = surface();
  const mapId = store.getCurrent().startMapId;
  const runner = createAiRegionTaskRunner({
    surface: run,
    status: document.createElement("div"),
    selectionTaskActive: true,
    activeSelectionRegionController: null,
    activeSelectionRegionKey: null,
    currentSelectionForRegionTask: () => ({ mapId, region: { x: 1, y: 2, width: 3, height: 4 } }),
    refreshContextChips: vi.fn(),
  });
  const pending = harness.nextAdmitted();
  await runner.sendSelectionRegionTask("이 영역을 숲으로 채워 주세요");
  const admitted = await pending;
  expect(admitted.input.family).toBe("region");
  expect(admitted.input.target).toMatchObject({ mapId, region: { x: 1, y: 2, width: 3, height: 4 } });
  expect(run.sendText).not.toHaveBeenCalled();
});

it("queued region capture uses the lite model, not the supervisor model", async () => {
  const storage = new Map<string, string>();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    authMode: "apiKey",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "gemini-3.1-pro",
    liteModel: "gemini-2.5-flash-lite",
  }));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  const harness = installAdmitClient();
  const mapId = store.getCurrent().startMapId;
  const pending = harness.nextAdmitted();
  await submitRegionJob({ mapId, region: { x: 1, y: 2, width: 3, height: 4 }, instruction: "여기 채워" });
  const admitted = await pending;
  const config = admitted.input.payload.config as { model?: string; liteModel?: string };
  expect(config.model).toBe("gemini-2.5-flash-lite");
  expect(config.liteModel).toBe("gemini-2.5-flash-lite");
  expect(config.model).not.toBe("gemini-3.1-pro");
});
