// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { clearConversations } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/ai/activityLog", async original => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
function node<T extends HTMLElement>(testid: string): T {
  const result = document.querySelector<T>(`[data-testid='${testid}']`);
  if (!result) throw new Error(`Missing ${testid}`);
  return result;
}
async function bounded(promise: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Missing panel publication")), 5000);
  })]); } finally { clearTimeout(timer); }
}
function terminalSignal() {
  let done = () => {};
  const promise = new Promise<void>(resolve => { done = resolve; });
  vi.mocked(recordAiActivity).mockImplementation(async record => {
    if (record.result?.stoppedReason && !record.result.pending) done();
    return buildAiActivityLogRecord(record);
  });
  return promise;
}
afterEach(async () => {
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await clearConversations();
  document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});
it("the real Continue control updates both the panel send mode and composer presentation after Ask", async () => {
  vi.stubEnv("VITE_LLM_API_URL", ""); vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear(); await clearConversations();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (_text, onEvent) => {
    onEvent?.({ type: "status", text: "자율 실행 예산 소진" });
    return { assistantText: "", proposedCalls: [], stoppedReason: "max-tool-calls" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  node("ai-composer-mode-ask").click();
  node<HTMLTextAreaElement>("ai-input").value = "QUERY_FIXTURE";
  const asked = terminalSignal(); node("ai-send").click(); await bounded(asked);
  expect(send.mock.calls[0]?.[3]?.composerMode).toBe("ask");
  const resumed = terminalSignal(); node("ai-continue-run").click(); await bounded(resumed);
  expect(send.mock.calls[1]?.[3]?.composerMode).toBe("do");
  expect(node("ai-composer-mode").dataset.mode).toBe("do");
  expect(node("ai-composer-mode-do").getAttribute("aria-checked")).toBe("true");
  expect(node("ai-composer-mode-ask").getAttribute("aria-checked")).toBe("false");
});
