// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import type { AutonomyLevel } from "@/ai/autonomyLevels";
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

/** 지시줄의 유일한 컨트롤. composerMode·planOnly·추론은 전부 이 레벨에서 유도된다. */
function selectAutonomy(panel: HTMLElement, level: AutonomyLevel): void {
  const dial = panel.querySelector<HTMLSelectElement>("[data-testid='ai-composer-autonomy']");
  if (!dial) throw new Error("Missing autonomy dial");
  dial.value = level;
  dial.dispatchEvent(new Event("change"));
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
  const cases: { agentMode: "auto" | "chat"; level: AutonomyLevel; ending: "final" | "error" | "aborted" | "throw"; completed?: boolean }[] = [
    { agentMode: "chat", level: "balanced", ending: "final" },
    { agentMode: "auto", level: "balanced", ending: "final" },
    { agentMode: "auto", level: "confirm", ending: "final" },
    { agentMode: "chat", level: "readonly", ending: "error" },
    { agentMode: "chat", level: "balanced", ending: "aborted" },
    { agentMode: "chat", level: "balanced", ending: "throw" },
    { agentMode: "chat", level: "balanced", ending: "final", completed: true },
  ];

  it.each(cases)("reopens live checklist on actual retry and removes it at $ending ($agentMode/$level, completed=$completed)", async ({ agentMode, level, ending, completed }) => {
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
    if (level !== "balanced") selectAutonomy(panel, level);
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
    // Retry must use the original run options, not the currently selected dial/config.
    selectAutonomy(panel, "readonly");
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
      // 자율 예산 표시는 쓰기 레벨이고 planOnly 가 아닐 때만 뜬다(confirm 은 계획만 세우고 멈춘다).
      if (agentMode === "auto" && level === "balanced") expect(budget?.textContent).toContain("0/16");
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
