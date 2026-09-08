// 지시줄 effort 셀렉트 — 패널 배선: 초기값·저장·세션 반영·설정모달 동기화.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const assistantMock = vi.hoisted(() => {
  const updated: unknown[] = [];
  const created: unknown[] = [];
  let sent = 0;
  class MockAssistantSession {
    constructor(_project: unknown, options: unknown) {
      created.push(options);
    }
    async sendUserMessage(): Promise<{ assistantText: string; proposedCalls: []; stoppedReason: "final" }> {
      sent += 1;
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
    getWorkPlan(): null {
      return null;
    }
    getProposedProject(): ReturnType<typeof store.getCurrent> {
      return store.getCurrent();
    }
    getRunOutcome(): null {
      return null;
    }
    getHarnessSnapshot() {
      return {
        model: "",
        maxTokens: 0,
        messages: [],
        audit: [],
        workPlan: null,
        acceptance: null,
        runEndProof: null,
        runOutcome: null,
        requests: [],
        execution: undefined,
      };
    }

    getAcceptanceSnapshot(): null {
      return null;
    }
    syncBaselineFromStoreIfClean(_project: unknown): boolean {
      return false;
    }
    updateConfig(config: unknown): void {
      updated.push(config);
    }
  }
  return {
    MockAssistantSession,
    updated,
    created,
    sentCount: (): number => sent,
    reset() {
      updated.length = 0;
      created.length = 0;
      sent = 0;
    },
  };
});

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: assistantMock.MockAssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS: 48,
  METADATA_ONLY_TOOLS: new Set(["set_tile_metadata", "set_tile_rules", "upsert_tile_group"]),
}));

let restoreDom: (() => void) | null = null;
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

function storedConfig(): Record<string, unknown> {
  return JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
}

beforeEach(() => {
  assistantMock.reset();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("지시줄 effort 셀렉트 — 패널 배선", () => {
  it("저장된 레벨·effort 를 초기값으로 그린다", () => {
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), autonomyLevel: "autonomous", reasoningEffort: "high" }),
    );
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-autonomy")?.value).toBe("autonomous");
    expect(findByTestId(panel, "ai-composer-reasoning")?.value).toBe("high");
  });

  it("자율성을 고르면 레벨 프리셋(추론·작업모드)까지 저장하고 추론 셀렉트도 함께 바뀐다", () => {
    // Break: 저장만 되고 표시가 옛값이라 거짓을 보여주거나, effort 가 프리셋으로 안 맞아
    // 세션이 레벨과 다른 effort 로 돈다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig() }));
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    const autonomy = findByTestId(panel, "ai-composer-autonomy");
    if (!autonomy) throw new Error("ai-composer-autonomy missing");
    autonomy.value = "max";
    autonomy.dispatchEvent(new Event("change"));

    const resolved = resolveAutonomy("max");
    expect(storedConfig().autonomyLevel).toBe("max");
    expect(storedConfig().reasoningEffort).toBe(resolved.reasoningEffort);
    expect(storedConfig().agentMode).toBe(resolved.agentMode);
    expect(findByTestId(panel, "ai-composer-reasoning")?.value).toBe(resolved.reasoningEffort);
  });

  it("추론 강도를 고르면 그 값 그대로 저장하고 자율성 레벨은 그대로 둔다", () => {
    // Break: 다이얼이 effort 를 덮어 수동 선택이 저장에만 남고 세션에 안 먹는다.
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), autonomyLevel: "balanced", reasoningEffort: "low" }),
    );
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    const reasoning = findByTestId(panel, "ai-composer-reasoning");
    if (!reasoning) throw new Error("ai-composer-reasoning missing");
    reasoning.value = "high";
    reasoning.dispatchEvent(new Event("change"));

    expect(storedConfig().reasoningEffort).toBe("high");
    expect(storedConfig().autonomyLevel).toBe("balanced");
  });

  it("지시줄에서 바꾼 값은 다음 전송 때 세션 생성 설정에 실린다", async () => {
    // Break: 저장은 되지만 ensureSession 이 전송 시점 설정을 다시 읽지 않아 다음 턴이 옛값으로 돈다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig() }));
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    const autonomy = findByTestId(panel, "ai-composer-autonomy");
    if (!autonomy) throw new Error("ai-composer-autonomy missing");
    autonomy.value = "max";
    autonomy.dispatchEvent(new Event("change"));

    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "짧은 질문";
    findByTestId(panel, "ai-send")?.click();
    await vi.waitFor(() => expect(assistantMock.sentCount()).toBe(1), { timeout: 2_000, interval: 5 });
    // ensureSession 은 전송 시점 저장 설정으로 세션을 만든다 — 방금 고른 레벨이 실려야 한다.
    const created = assistantMock.created as { config?: { autonomyLevel?: unknown; reasoningEffort?: unknown } }[];
    expect(created.length).toBeGreaterThan(0);
    expect(created[0]?.config?.autonomyLevel).toBe("max");
    expect(created[0]?.config?.reasoningEffort).toBe(resolveAutonomy("max").reasoningEffort);
  });
});
