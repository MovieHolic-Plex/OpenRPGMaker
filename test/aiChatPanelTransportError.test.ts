// aiChatPanel transport failure — P0 regression: any /api/ai failure must stop running,
// clear pending, append system bubble with settings CTA, and keep ai-send mounted disabled
// alongside ai-abort (not hidden swap).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, LLM_RETRY_BACKOFF_MS } from "@/ai/llmClient";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { completeChatTurn } from "./helpers/aiChatTestSignals";
import { signal } from "./helpers/aiTestSignals";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, String(v)),
      removeItem: (k: string) => void storage.delete(k),
      clear: () => storage.clear(),
    },
  });
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat" }));
});

afterEach(() => {
  teardownAiChatPanel();
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("transport failure paints recovery CTA and keeps Send mounted", () => {
  it("refused fetch: is-turn-running cleared, system error bubble + ai-error-open-settings, ai-send stays disabled with ai-abort visible", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Any transport failure counts — network throw
    const refused = vi.fn(() => { throw new TypeError("Failed to fetch"); });
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
      if (!request.tools?.length) return new Response(JSON.stringify({ choices: [{ message: {
        role: "assistant", content: JSON.stringify({ mode: "question", space: "none", needsPlan: false, tools: [], summary: "transport fixture" }),
      } }] }), { headers: { "Content-Type": "application/json" } });
      return refused();
    });
    vi.stubGlobal("fetch", fetchMock);
    const retryDelays = [1, 2, 3].map((attempt) => ({ ms: LLM_RETRY_BACKOFF_MS * attempt, scheduled: signal(`retry ${attempt} scheduled`) }));
    const schedule = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, ms, ...args) => {
      const timer = schedule(handler, ms, ...args);
      retryDelays.find((retry) => retry.ms === ms)?.scheduled.resolve();
      return timer;
    });
    const panel = renderWithFakeDom(() => renderAiChatPanel({ clock: () => 37_000 })) as unknown as FakeElement;
    // expand if collapsed
    findByTestId(panel, "ai-collapsed-restore")?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement;
    const abort = findByTestId(panel, "ai-abort") as unknown as FakeElement;
    const status = findByTestId(panel, "ai-status") as unknown as FakeElement;
    expect(send).toBeTruthy();
    expect(abort).toBeTruthy();
    input.value = "hello";
    const completed = completeChatTurn(() => send.click());
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
    expect(send.disabled).toBe(true);
    expect(abort.hidden).toBe(false);
    // Advance only after the actual retry timer is registered.
    for (const retry of retryDelays) {
      await retry.scheduled.promise;
      await vi.advanceTimersByTimeAsync(retry.ms);
    }
    await completed;
    expect(refused).toHaveBeenCalledTimes(4);
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect(panel.classList.contains("is-turn-running")).toBe(false);
    expect((status.textContent ?? "")).not.toContain("계획 중");
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("오류");
    // send still mounted, not hidden prolonge
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
    expect((findByTestId(panel, "ai-send") as unknown as FakeElement).hidden).toBe(false);
  });

  it("401 also mounts settings opener", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401, headers: { "Content-Type": "text/plain" } })));
    const panel = renderWithFakeDom(() => renderAiChatPanel({ clock: () => 37_000 })) as unknown as FakeElement;
    findByTestId(panel, "ai-collapsed-restore")?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "hello";
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect(panel.classList.contains("is-turn-running")).toBe(false);
  });
});
