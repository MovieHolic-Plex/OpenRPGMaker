import { afterEach, expect, it, vi } from "vitest";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { sendAiAssistantMessage, getAiAssistantAudit, getAiAssistantStatus } from "@/editor/aiAssistantBridge";
import * as llm from "@/ai/llmClient";
import * as activity from "@/ai/activityLog";
import * as adapter from "@/editor/tools/applyChangesetToStore";
import { clearConversations } from "@/ai/conversationStore";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { installFakeDom } from "./fakeDom";
import { bounded, deferred } from "./aiEpochFixture";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";
import { independentReviewPayload } from "./independentReviewFixture";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
let restoreDom: (() => void) | undefined;
afterEach(async () => {
  teardownAiChatPanel(); await whenAiChatPanelSettled(); await clearConversations(); await store.flush();
  resetMapEditHistory(); resetIntentDeclarationCache(); restoreDom?.(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("the actual Panel Abort frees B and its public bridge result before A's late HTTP body arrives", async () => {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>([[llm.AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...llm.defaultAiConfig(), agentMode: "chat" })]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory(); editorState.set({ currentMapId: null, selection: null });
  await clearConversations();
  const entered = deferred<void>(); const late = deferred<Response>();
  let round = 0;
  const sse = (delta: unknown) => new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "Content-Type": "text/event-stream" } });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (url, init) => {
    if (!String(url).endsWith("/v1/chat/completions")) return Response.json({});
    const payload: { stream?: boolean; response_format?: { type: "json_object" }; messages: llm.ChatRequest["messages"] } = JSON.parse(String(init?.body));
    if (isWikiExtraction(payload.messages)) return emptyWikiResponse();
    const review = independentReviewPayload(payload);
    if (review) {
      expect(review.requiredProblems).toEqual([]);
      return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify({
        revision: review.revision, verdict: "approved", summary: "Reviewed B", findings: [],
      }) }, finish_reason: "stop" }] });
    }
    if (payload.response_format?.type === "json_object") return Response.json({ choices: [{ message: { role: "assistant",
      content: JSON.stringify({ mode: "other", space: "none", needsPlan: false, tools: ["set_title_screen"] }) }, finish_reason: "stop" }] });
    if (round++ === 0) { entered.resolve(); return late.promise; }
    if (round === 2) {
      const message: llm.ChatMessage = { role: "assistant", content: null, tool_calls: [{ id: "B", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: "B_CURRENT" }),
      } }] };
      return payload.stream ? sse({ tool_calls: message.tool_calls?.map(call => ({ ...call, index: 0 })) })
        : Response.json({ choices: [{ message, finish_reason: "tool_calls" }] });
    }
    return payload.stream ? sse({ content: "RESULT" })
      : Response.json({ choices: [{ message: { role: "assistant", content: "RESULT" }, finish_reason: "stop" }] });
  }));
  const completions = vi.spyOn(llm, "chatCompletion");
  const applying = vi.spyOn(adapter, "applyProposedProject");
  const panel = renderAiChatPanel(); document.body.append(panel);
  await whenAiChatPanelSettled();
  const a = sendAiAssistantMessage("A");
  try {
    await bounded(entered.promise);
    const abort = panel.querySelector('[data-testid="ai-abort"]');
    if (!abort) throw new Error("Actual Abort control missing");
    abort.dispatchEvent(new Event("click"));
    expect(getAiAssistantStatus().turnBusy).toBe(false);
    const b = await bounded(sendAiAssistantMessage("B"));
    expect(b.runOutcome?.delivery).toBe("applied");
    expect(store.getCurrent().system.titleScreen?.title).toBe("B_CURRENT");
    const cancelled = await bounded(a);
    expect(cancelled.runOutcome?.execution).toBe("cancelled");
    expect(cancelled.audit.some(entry => entry.kind === "user" && entry.text?.startsWith("B"))).toBe(false);
    const audit = structuredClone(getAiAssistantAudit());
    const status = getAiAssistantStatus();
    const ui = panel.textContent;
    const activityCount = vi.mocked(activity.recordAiActivity).mock.calls.length;
    late.resolve(sse({ tool_calls: [{ index: 0, id: "A", type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: "A_LATE" }) } }] }));
    await bounded(Promise.allSettled(completions.mock.results.map(result => {
      if (result.type !== "return") throw new Error("Completion did not return");
      return result.value;
    })));
    expect(getAiAssistantAudit()).toEqual(audit);
    expect(getAiAssistantStatus()).toEqual(status);
    expect(panel.textContent).toBe(ui);
    expect(vi.mocked(activity.recordAiActivity).mock.calls).toHaveLength(activityCount);
    expect(applying).toHaveBeenCalledTimes(1);
    expect(store.getCurrent().system.titleScreen?.title).toBe("B_CURRENT");
  } finally {
    late.resolve(sse({ content: "LATE" })); await bounded(a);
    await bounded(Promise.allSettled(completions.mock.results.map(result => {
      if (result.type !== "return") throw new Error("Completion did not return");
      return result.value;
    })));
  }
});
