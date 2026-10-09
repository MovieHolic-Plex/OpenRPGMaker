import { RunOperation } from "@/ai/runOperation";
import { teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const assistantMock = vi.hoisted(() => {
  class MockAssistantSession {
    private operation = new RunOperation();
    getRunOperation(): RunOperation { return this.operation; }
    retireRun(): void { this.operation.retire(); }
    constructor(_project: unknown, _options: unknown) {}

    async sendUserMessage(_text: string, _onEvent: (event: unknown) => void): Promise<{
      assistantText: string;
      proposedCalls: [];
      stoppedReason: "final";
    }> {
      this.operation.retire();
      this.operation = new RunOperation();
      return { assistantText: "완료.", proposedCalls: [], stoppedReason: "final" };
    }

    getRunOutcome(): null { return null; }

    getAuditEntries(): [] {
      return [];
    }

    getActiveSpec(): null {
      return null;
    }

    getCompletionSpecs(): [] {
      return [];
    }


    // 패널은 턴마다 미완료 계획을 이어받으려 세션의 계획을 읽는다 — 더블은 계획 없음.

    getWorkPlan(): null {

      return null;

    }

    getProposedProject(): ReturnType<typeof store.getCurrent> {
      return store.getCurrent();
    }

    getHarnessSnapshot(): null {
      return null;
    }

    // 패널이 새 턴 직전 저장소 기준 동기화를 부른다 — 더블은 제안 없음(false)으로 답한다.
    syncBaselineFromStoreIfClean(_project: unknown): boolean {
      return false;
    }

    updateConfig(_config: unknown): void {}
  }

  return { MockAssistantSession };
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


function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
  installFakeLocalStorage();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-or-test" }));
});

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("조수 캡슐 넓힘/줄임", () => {
  it("빈 유휴 상태는 좁은 입력줄이고 로그는 접혀 있다", () => {
    const panel = renderPanel();
    expect(panel.classList.contains("is-assistant-idle")).toBe(true);
    expect(panel.classList.contains("is-assistant-log-open")).toBe(false);
    expect(panel.classList.contains("is-composer-focused")).toBe(false);
  });

  it("턴이 돌면 로그가 펼쳐지고, 답이 남으면 열린 채로 둔다", async () => {
    const panel = renderPanel();
    const bridge = (globalThis.window as unknown as { __oprnAiBridge?: { send: (text: string) => Promise<unknown> } }).__oprnAiBridge;
    expect(bridge).toBeTruthy();
    await bridge!.send("여기 나무 심어줘");
    await whenAiChatPanelSettled();

    expect(panel.classList.contains("is-assistant-idle")).toBe(false);
    expect(panel.classList.contains("is-assistant-log-open")).toBe(true);
    expect(findByTestId(panel, "ai-chat-log")?.childNodes.length ?? 0).toBeGreaterThan(0);
  });
});
