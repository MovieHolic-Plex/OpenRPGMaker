import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const assistantMock = vi.hoisted(() => {
  const sentMessages: string[] = [];

  class MockAssistantSession {
    constructor(_project: unknown, _options: unknown) {}

    async sendUserMessage(text: string, _onEvent: (event: unknown) => void): Promise<{
      assistantText: string;
      proposedCalls: [];
      stoppedReason: "final";
    }> {
      sentMessages.push(text);
      return { assistantText: "완료.", proposedCalls: [], stoppedReason: "final" };
    }

    getAuditEntries(): [] {
      return [];
    }

    getActiveSpec(): null {
      return null;
    }

    getProposedProject(): ReturnType<typeof store.getCurrent> {
      return store.getCurrent();
    }

    getHarnessSnapshot(): null {
      return null;
    }

    updateConfig(_config: unknown): void {}
  }

  return {
    MockAssistantSession,
    sentMessages,
    reset() {
      sentMessages.length = 0;
    },
  };
});

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: assistantMock.MockAssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS: 48,
  METADATA_ONLY_TOOLS: new Set(["set_tile_metadata", "set_tile_rules", "upsert_tile_group"]),
}));

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function installFakeWindow(): () => void {
  const previous = globalThis.window;
  const listeners = new Map<string, Set<EventListener>>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      location: { search: "aiBridge=0" },
      addEventListener: (type: string, listener: EventListener) => {
        const bucket = listeners.get(type) ?? new Set<EventListener>();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event): boolean => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
      clearTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.clearTimeout(...args),
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      setInterval: (...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args),
      clearInterval: (...args: Parameters<typeof clearInterval>) => globalThis.clearInterval(...args),
    },
  });
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "window");
      return;
    }
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previous });
  };
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

beforeEach(() => {
  assistantMock.reset();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
  installFakeLocalStorage();
  vi.useFakeTimers();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-or-test" }));
});

afterEach(() => {
  vi.useRealTimers();
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

// 접힘/자동 접기는 삭제됐다 — 유휴가 56px 한 줄이면 접어서 아낄 공간이 없고, 자동 접기는
// 이미 무효 정책이었다(`AUTO_COLLAPSE_AFTER_AI_MS = 0` 이라 타이머가 플래그만 내렸다).
//
// 남는 계약은 그 셋이 실제로 지키려던 것 하나다: **바깥에서 온 작업 신호가 띠를 자라게 한다.**
// 브리지 전송과 어시스트 이벤트 둘 다 유휴에서 시작해 `is-risen` 으로 끝나야 한다.
describe("AI 패널 자동 자람", () => {
  it("유휴에서 브리지로 전송하면 자라고, 턴이 끝나도 답을 읽도록 자란 채 남는다", async () => {
    const panel = renderPanel();
    expect(panel.classList.contains("is-risen")).toBe(false);

    const bridge = (globalThis.window as unknown as { __oprnAiBridge?: { send: (text: string) => Promise<unknown> } }).__oprnAiBridge;
    expect(bridge).toBeTruthy();
    await bridge!.send("안녕");
    await flushAsync();

    expect(panel.classList.contains("is-risen")).toBe(true);
    expect(assistantMock.sentMessages).toHaveLength(1);

    // 예전에는 여기서 자동 접기 타이머를 기다렸다. 타이머가 없어졌어도 결과는 같아야 한다 —
    // 대화가 남아 있는 동안 유휴로 되돌아가면 방금 받은 답이 사라진다.
    await vi.advanceTimersByTimeAsync(5_000);
    await flushAsync();

    expect(panel.classList.contains("is-risen")).toBe(true);
    // 접힘 키는 아무도 쓰지 않는다 — 상태 기계와 함께 삭제됐으므로 되살아나면 회귀다.
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);
  });

  it("스킬 어시스트 이벤트도 자람 경로를 탄다", async () => {
    const panel = renderPanel();
    expect(panel.classList.contains("is-risen")).toBe(false);

    window.dispatchEvent(
      new CustomEvent("oprn:ai-assist", {
        detail: { kind: "cluster-edit", tilesetId: "ts_default", groupId: "wall_group" },
      })
    );
    await flushAsync();

    expect(panel.classList.contains("is-risen")).toBe(true);
  });
});
