// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import type { WorkPlan } from "@/ai/workPlan";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { closeWorkPlanBook, openWorkPlanBook } from "@/editor/panels/aiWorkPlanModal";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

const plan: WorkPlan = {
  id: "terminal-focus", goal: "Focus fixture", createdAt: "2026-09-06T00:00:00.000Z",
  currentLayerIndex: 0, currentItemId: "item",
  layers: [{ id: "layer", title: "Layer", items: [{ id: "item", title: "Item", instruction: "Inspect", status: "in_progress" }] }],
};

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred not initialized"); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// Observe the exact teardown before releasing the held turn. Timeout only bounds failure.
function removed(node: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (node.isConnected) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error("Owner turn did not remove its live checklist"));
    }, 2_000);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

beforeEach(async () => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "focus-test", agentMode: "chat" }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  await clearConversations();
  document.body.append(renderAiChatPanel());
  await whenAiChatPanelSettled();
  document.querySelector<HTMLElement>('[data-testid="ai-collapsed-restore"]')?.click();
});

afterEach(async () => {
  teardownAiChatPanel();
  closeWorkPlanBook();
  await whenAiChatPanelSettled();
  await clearConversations();
  document.body.replaceChildren();
  resetModalStackForTest();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function startTurn() {
  const entered = deferred<void>();
  const result = deferred<TurnResult>();
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation((_text, onEvent) => {
    onEvent({ type: "work_plan", plan });
    entered.resolve();
    return result.promise;
  });
  control<HTMLTextAreaElement>("ai-input").value = "Inspect focus";
  control("ai-send").click();
  await entered.promise;
  const surface = control("ai-autonomous-run-surface");
  return async (stoppedReason: "final" | "aborted" | "error" = "final") => {
    const terminal = removed(surface);
    result.resolve({ assistantText: "Focus result", proposedCalls: [], stoppedReason,
      ...(stoppedReason === "error" ? { error: "Scripted terminal error" } : {}),
    });
    await terminal;
    expect(document.querySelector('[data-testid="ai-plan-book"]')).toBeNull();
    expect(document.querySelector('[data-testid="ai-work-plan-checklist"]')).toBeNull();
  };
}

describe("terminal work-plan focus ownership", () => {
  it.each(["ai-plan-book", "ai-plan-book-close", "ai-plan-book-open"])("returns removed %s focus to the stable composer", async (id) => {
    const finish = await startTurn();
    const composer = control("ai-input");
    if (id !== "ai-plan-book-open") control("ai-plan-book-open").click();
    const focused = control(id);
    focused.focus();
    expect(document.activeElement).toBe(focused);
    await finish();
    expect(document.activeElement?.tagName).toBe("TEXTAREA");
    expect(document.activeElement).toBe(composer);
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("restores composer focus on an aborted terminal result", async () => {
    const finish = await startTurn();
    control("ai-plan-book-open").click();
    expect(document.activeElement).toBe(control("ai-plan-book"));
    await finish("aborted");
    expect(document.activeElement).toBe(control("ai-input"));
  });

  it("does not steal focus from an unrelated control while removing an open book", async () => {
    const finish = await startTurn();
    control("ai-plan-book-open").click();
    const unrelated = document.createElement("button");
    document.body.append(unrelated);
    unrelated.focus();
    await finish();
    expect(document.activeElement).toBe(unrelated);
  });

  it("preserves the error dialog's focus when it supersedes the focused book", async () => {
    const finish = await startTurn();
    control("ai-plan-book-open").click();
    expect(document.activeElement).toBe(control("ai-plan-book"));
    await finish("error");
    expect(document.activeElement).toBe(control("ai-gate-modal-close"));
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("keeps manual close notification distinct from terminal programmatic close", () => {
    const onClose = vi.fn();
    openWorkPlanBook({ plan, onClose });
    control("ai-plan-book-close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
    openWorkPlanBook({ plan, onClose });
    closeWorkPlanBook();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(modalStackDepthForTest()).toBe(0);
  });
});
