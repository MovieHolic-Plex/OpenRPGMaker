import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import {
  AUTO_COLLAPSE_AFTER_AI_MS,
  renderAiChatPanel,
} from "@/editor/panels/aiChatPanel";
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

// 접힘 축은 하나다: 패널 전체 칩 접힘(`is-collapsed`). glass 도크의 본문 접힘(fold)이
// 두 번째 축이었고 도크 삭제와 함께 사라졌다 — 이제 도크 인자도 없다.
function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

function expandPanel(panel: FakeElement): void {
  // Restore click is a no-op when first visit already boots open.
  if (!panel.classList.contains("is-collapsed")) return;
  findByTestId(panel, "ai-collapsed-restore")?.click();
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

// 삭제: "glass 는 저장된 '1' 을 칩 접힘이 아니라 fold 로 라우팅한다" — fold 축(`is-glass-folded`)
// 자체가 없어져 주제가 사라졌다. 저장값이 칩 접힘으로 되돌아온다는 새 계약은 아래 복원 케이스가 잡는다.
describe("AI 패널 자동 펼침/접기", () => {
  it("부팅 시 저장된 접힘 선택('1')을 복원한다 — fold 로 새지 않는다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    // Break: 저장값이 다시 본문 접힘(fold)으로 라우팅돼 칩이 안 서고 입력줄만 남는다.
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1"); // 부팅이 덮어쓰지 않는다.
  });

  it("접힌 채 전송하면 펼치고, 턴이 끝나도 답을 읽도록 열어 둔다", async () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);

    const bridge = (globalThis.window as unknown as { __oprnAiBridge?: { send: (text: string) => Promise<unknown> } }).__oprnAiBridge;
    expect(bridge).toBeTruthy();
    await bridge!.send("안녕");
    await flushAsync();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");
    expect(assistantMock.sentMessages).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(AUTO_COLLAPSE_AFTER_AI_MS + 50);
    await flushAsync();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");
  });

  it("이미 펼친 첫 방문은 턴 종료 후 자동으로 접히지 않는다 — 키를 쓰지 않는다", async () => {
    // Break: first visit still boots collapsed, or an already-open panel auto-collapses after idle.
    const panel = renderPanel();
    expandPanel(panel);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);

    const bridge = (globalThis.window as unknown as { __oprnAiBridge?: { send: (text: string) => Promise<unknown> } }).__oprnAiBridge;
    await bridge!.send("지도 그려줘");
    await flushAsync();

    await vi.advanceTimersByTimeAsync(AUTO_COLLAPSE_AFTER_AI_MS + 50);
    await flushAsync();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);
  });

  it("스킬 어시스트 이벤트도 자동 펼침 경로를 탄다", async () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);

    window.dispatchEvent(
      new CustomEvent("oprn:ai-assist", {
        detail: { kind: "cluster-edit", tilesetId: "ts_default", groupId: "wall_group" },
      })
    );
    await flushAsync();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });
});
