// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import type { ComposerMode } from "@/ai/composerMode";
import type { WorkPlan } from "@/ai/workPlan";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

function signal<T>() {
  let resolve: (value: T) => void = () => { throw new Error("signal not initialized"); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Missing retry lifecycle signal")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

function terminalSignal() {
  const terminal = signal<void>();
  vi.mocked(recordAiActivity).mockImplementation(async (record) => {
    if (record.result && record.result.pending !== true) terminal.resolve();
    return buildAiActivityLogRecord(record);
  });
  return terminal.promise;
}

function plan(status: "in_progress" | "done" = "in_progress"): WorkPlan {
  return {
    id: "retry-plan", goal: "retry fixture", createdAt: "2026-09-06T00:00:00.000Z",
    currentLayerIndex: 0, currentItemId: "item",
    layers: [{ id: "layer", title: "layer", items: [{ id: "item", title: "item", instruction: "inspect", status }] }],
  };
}

function button(panel: HTMLElement, testid: string): HTMLButtonElement {
  const node = panel.querySelector<HTMLButtonElement>(`[data-testid='${testid}']`);
  if (!node) throw new Error(`Missing button: ${testid}`);
  return node;
}

beforeEach(async () => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear();
  await clearConversations();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
});

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  await clearConversations();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("manual retry work-plan ownership", () => {
  const cases: { agentMode: "auto" | "chat"; composerMode: ComposerMode; ending: "final" | "error" | "aborted" | "throw"; completed?: boolean }[] = [
    { agentMode: "chat", composerMode: "do", ending: "final" },
    { agentMode: "auto", composerMode: "do", ending: "final" },
    { agentMode: "auto", composerMode: "plan", ending: "final" },
    { agentMode: "chat", composerMode: "ask", ending: "error" },
    { agentMode: "chat", composerMode: "do", ending: "aborted" },
    { agentMode: "chat", composerMode: "do", ending: "throw" },
    { agentMode: "chat", composerMode: "do", ending: "final", completed: true },
  ];

  it.each(cases)("reopens live checklist on actual retry and removes it at $ending ($agentMode/$composerMode, completed=$completed)", async ({ agentMode, composerMode, ending, completed }) => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode, autonomyLevel: "balanced" }));
    let retainedPlan: WorkPlan | null = null;
    const getPlan = vi.spyOn(AssistantSession.prototype, "getWorkPlan").mockImplementation(() => retainedPlan);
    const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (_text, onEvent) => {
      retainedPlan = plan(completed ? "done" : "in_progress");
      onEvent?.({ type: "work_plan", plan: retainedPlan });
      return { assistantText: "", proposedCalls: [], stoppedReason: "error", error: "RETRY_FIXTURE_ERROR" };
    });
    vi.spyOn(AssistantSession.prototype, "canRetryLastTurn").mockReturnValue(true);
    const panel = renderAiChatPanel();
    document.body.append(panel);
    await bounded(whenAiChatPanelSettled());
    const input = panel.querySelector<HTMLTextAreaElement>("[data-testid='ai-input']");
    if (!input) throw new Error("Missing composer input");
    if (composerMode !== "do") button(panel, `ai-composer-mode-${composerMode}`).click();
    const firstDone = terminalSignal();
    input.value = "RETRY_FIXTURE_REQUEST";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    button(panel, "ai-send").click();
    await bounded(firstDone);
    expect(send).toHaveBeenCalledTimes(1);
    expect(panel.querySelector("[data-testid='ai-work-plan-checklist']")).toBeNull();
    const beforeRetry = store.getCurrent();
    const savedPlan = retainedPlan;
    const retryHeld = signal<void>();
    const releaseRetry = signal<void>();
    let carriedVisible = false;
    const retry = vi.spyOn(AssistantSession.prototype, "retryLastTurn").mockImplementation(async (onEvent, abort) => {
      carriedVisible = panel.querySelector("[data-testid='ai-work-plan-checklist']") !== null;
      retainedPlan = plan();
      onEvent?.({ type: "work_plan", plan: retainedPlan });
      retryHeld.resolve();
      await releaseRetry.promise;
      if (ending === "throw") throw new Error("RETRY_FIXTURE_THROW");
      if (ending === "aborted") expect(abort?.aborted).toBe(true);
      return { assistantText: "", proposedCalls: [], stoppedReason: ending, ...(ending === "error" ? { error: "RETRY_FIXTURE_ERROR" } : {}) } satisfies TurnResult;
    });
    // Retry must use the original run options, not the currently selected mode/config.
    button(panel, "ai-composer-mode-ask").click();
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: agentMode === "auto" ? "chat" : "auto", autonomyLevel: "balanced" }));
    const retryDone = terminalSignal();
    button(panel, "ai-retry-turn").click();
    try {
      await bounded(retryHeld.promise);
      expect(retry).toHaveBeenCalledTimes(1);
      expect(panel.classList.contains("is-turn-running")).toBe(true);
      expect(panel.querySelector("[data-testid='ai-work-plan-checklist']"), "held retry work_plan must render a live checklist").not.toBeNull();
      expect(carriedVisible).toBe(!completed);
      expect(getPlan.mock.results.some((result) => result.value === savedPlan)).toBe(true);
      const budget = panel.querySelector("[data-testid='ai-autonomous-budget']");
      // Do enters the autonomous driver regardless of agentMode (C1). Ask/plan-preview do not.
      if (composerMode === "do") expect(budget?.textContent).toContain("0/16");
      else expect(budget).toBeNull();
      expect(store.getCurrent()).toBe(beforeRetry);
    } finally {
      if (ending === "aborted") button(panel, "ai-abort").click();
      releaseRetry.resolve();
      await bounded(retryDone);
    }
    expect(panel.querySelector("[data-testid='ai-work-plan-checklist']")).toBeNull();
    expect(panel.querySelector("[data-testid='ai-autonomous-run-surface']")).toBeNull();
    expect(panel.querySelector("[data-testid='ai-plan-book']")).toBeNull();
    expect(panel.classList.contains("is-turn-running")).toBe(false);
    expect(retainedPlan).toEqual(plan());
    expect(store.getCurrent()).toBe(beforeRetry);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
