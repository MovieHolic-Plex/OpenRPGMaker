// Transport failures must finish the real panel/session turn and expose recovery.
// Send remains mounted beside Abort while running, then becomes usable again.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import * as activityLog from "@/ai/activityLog";
import { clearConversations } from "@/ai/conversationStore";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { closeAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";

let restoreDom: (() => void) | null = null;

beforeEach(async () => {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => storage.clear(),
  });
  // All network boundaries stay local, including background conversation writes.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async (entry) => activityLog.buildAiActivityLogRecord(entry));
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat" }));
  await clearConversations();
});

afterEach(async () => {
  closeAiSettingsModal();
  findByTestId(document.body as unknown as FakeElement, "ai-gate-modal-close")?.click();
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function nextTerminalActivity(): Promise<activityLog.AiActivityLogInput> {
  return new Promise((resolve, reject) => {
    // The production session retries at 1.5/3/4.5s. Await its terminal publication,
    // not a guessed microtask count or a loop that polls for a recovery element.
    const timeout = setTimeout(() => reject(new Error("Transport turn did not publish terminal activity")), 15_000);
    vi.mocked(activityLog.recordAiActivity).mockImplementation(async (entry) => {
      if (entry.channel === "chat" && entry.result.pending !== true) {
        clearTimeout(timeout);
        resolve(entry);
      }
      return activityLog.buildAiActivityLogRecord(entry);
    });
  });
}

function stubTransport(fail: () => Promise<Response>): { intent: number; chat: number } {
  const requests = { intent: 0, chat: 0 };
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    if (!String(url).endsWith("/v1/chat/completions")) return new Response("{}");
    const payload: { response_format?: { type: string }; messages?: { content?: unknown }[] } = JSON.parse(String(init?.body));
    if (isWikiExtraction(payload.messages)) return emptyWikiResponse();
    if (payload.response_format?.type === "json_object") {
      requests.intent += 1;
      // A single-step request isolates chat transport recovery, not planner retries.
      return new Response(JSON.stringify({ choices: [{ message: {
        role: "assistant", content: JSON.stringify({ mode: "question", needsPlan: false }),
      }, finish_reason: "stop" }] }), { headers: { "Content-Type": "application/json" } });
    }
    requests.chat += 1;
    return fail();
  }));
  return requests;
}

function expectRecovery(panel: FakeElement): void {
  expect(panel.classList.contains("is-turn-running")).toBe(false);
  expect(findByTestId(panel, "ai-send")?.hidden).toBe(false);
  expect(findByTestId(panel, "ai-send")?.disabled).toBe(false);
  expect(findByTestId(panel, "ai-abort")?.hidden).toBe(true);
  expect(findByTestId(panel, "ai-retry-turn")).toBeTruthy();
  const settings = findByTestId(panel, "ai-error-open-settings");
  expect(settings).toBeTruthy();
  findByTestId(document.body as unknown as FakeElement, "ai-gate-modal-close")?.click();
  settings?.click();
  expect(findByTestId(document.body as unknown as FakeElement, "ai-settings-modal")).toBeTruthy();
}

describe("transport failure paints recovery CTA and keeps Send mounted", () => {
  it("refused fetch: is-turn-running cleared, system error bubble + ai-error-open-settings, ai-send stays disabled with ai-abort visible", async () => {
    const requests = stubTransport(async () => { throw new TypeError("Failed to fetch"); });
    const panel = renderAiChatPanel() as unknown as FakeElement;
    await whenAiChatPanelSettled();
    const terminal = nextTerminalActivity();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as FakeElement;
    input.value = "hello";
    send.click();
    expect(panel.classList.contains("is-turn-running")).toBe(true);
    expect(findByTestId(panel, "ai-send")).toBe(send);
    expect(send.hidden).toBe(false);
    expect(send.disabled).toBe(true);
    expect(findByTestId(panel, "ai-abort")?.hidden).toBe(false);

    const result = await terminal;
    expect(result.result).toMatchObject({ ok: false, stoppedReason: "error", proposedCalls: 0, appliedCalls: 0 });
    expect(result.result.error).toContain("Failed to fetch");
    expect(requests).toEqual({ intent: 1, chat: 4 });
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain(result.result.error?.replaceAll("\n", ""));
    expectRecovery(panel);
  }, 20_000);

  it("401 also mounts settings opener", async () => {
    const requests = stubTransport(async () => new Response("unauthorized-sentinel", { status: 401 }));
    const panel = renderAiChatPanel() as unknown as FakeElement;
    await whenAiChatPanelSettled();
    const terminal = nextTerminalActivity();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "hello";
    findByTestId(panel, "ai-send")?.click();
    const result = await terminal;
    expect(result.result).toMatchObject({ ok: false, stoppedReason: "error", proposedCalls: 0, appliedCalls: 0 });
    expect(result.result.error).toContain("401");
    expect(requests).toEqual({ intent: 1, chat: 1 });
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain(result.result.error?.replaceAll("\n", ""));
    expectRecovery(panel);
  });
});
