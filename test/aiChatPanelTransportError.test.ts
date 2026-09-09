// 작업 접수 실패는 실행 표시를 끄고 설정 CTA 를 붙이며 Send 는 마운트된 채 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;
let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
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
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    authMode: "apiKey",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    agentMode: "chat",
  }));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  harness = installAdmitClient();
});

afterEach(() => {
  teardownAiChatPanel();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 80; i++) await Promise.resolve();
}

describe("transport failure paints recovery CTA and keeps Send mounted", () => {
  it("refused fetch: is-turn-running cleared, system error bubble + ai-error-open-settings, ai-send stays mounted", async () => {
    harness.failNext("Failed to fetch");
    const panel = renderWithFakeDom(() => renderAiChatPanel({ clock: () => 37_000})) as unknown as FakeElement;
    findByTestId(panel, "ai-collapsed-restore")?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement;
    expect(send).toBeTruthy();
    input.value = "hello";
    const pending = harness.nextAdmitted().then(() => undefined, () => undefined);
    send.click();
    await pending;
    await flushAsync();
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect(panel.classList.contains("is-turn-running")).toBe(false);
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toMatch(/Failed to fetch|오류/);
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
    expect((findByTestId(panel, "ai-send") as unknown as FakeElement).hidden).toBe(false);
  });

  it("401 also mounts settings opener", async () => {
    harness.failNext("AI jobs HTTP 401: no");
    const panel = renderWithFakeDom(() => renderAiChatPanel({ clock: () => 37_000})) as unknown as FakeElement;
    findByTestId(panel, "ai-collapsed-restore")?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "hello";
    const pending = harness.nextAdmitted().then(() => undefined, () => undefined);
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    await pending;
    await flushAsync();
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect(panel.classList.contains("is-turn-running")).toBe(false);
  });
});
