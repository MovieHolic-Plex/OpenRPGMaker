import { sendAiTurn } from "./aiTurnHarness";
// 지시줄 effort 셀렉트 — 패널 배선: 초기값·저장·세션 반영·설정모달 동기화.
import { RunOperation } from "@/ai/runOperation";
import { teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
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
    private operation = new RunOperation();
    getRunOperation(): RunOperation { return this.operation; }
    retireRun(): void { this.operation.retire(); }
    constructor(_project: unknown, options: unknown) {
      created.push(options);
    }
    async sendUserMessage(): Promise<{ assistantText: string; proposedCalls: []; stoppedReason: "final" }> {
      this.operation.retire();
      this.operation = new RunOperation();
      sent += 1;
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
    getWorkPlan(): null {
      return null;
    }
    getProposedProject(): ReturnType<typeof store.getCurrent> {
      return store.getCurrent();
    }
    getHarnessSnapshot(): null {
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

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("지시줄 자율성 셀렉트 — 패널 배선", () => {
  it("저장된 레벨을 초기값으로 그린다", () => {
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), autonomyLevel: "autonomous", reasoningEffort: "high" }),
    );
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-autonomy")?.value).toBe("autonomous");
  });

  it("지시줄 컨트롤은 자율성 셀렉트 하나다", () => {
    // Break: 모드 칩이나 추론 셀렉트가 남으면 같은 노브를 여러 컨트롤이 만진다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig() }));
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-autonomy")).not.toBeNull();
    expect(findByTestId(panel, "ai-composer-reasoning")).toBeNull();
    expect(findByTestId(panel, "ai-composer-mode")).toBeNull();
  });

  it("자율성을 고르면 레벨 프리셋(추론·작업모드)까지 저장한다", () => {
    // Break: effort 가 프리셋으로 안 맞으면 세션이 레벨과 다른 effort 로 돈다. 지시줄에 수동
    // override 가 없으므로 이 저장이 추론 강도의 유일한 원천이다.
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
    expect(autonomy.value).toBe("max");
  });

  it("읽기 전용 레벨도 같은 경로로 저장된다", () => {
    // Break: 새 레벨이 isAutonomyLevel 검증을 통과하지 못하면 저장이 balanced 로 되돌아가
    // ask 레일을 부를 수단이 사라진다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig() }));
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as unknown as FakeElement;
    const autonomy = findByTestId(panel, "ai-composer-autonomy");
    if (!autonomy) throw new Error("ai-composer-autonomy missing");
    autonomy.value = "readonly";
    autonomy.dispatchEvent(new Event("change"));

    expect(storedConfig().autonomyLevel).toBe("readonly");
    expect(storedConfig().agentMode).toBe(resolveAutonomy("readonly").agentMode);
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
    await sendAiTurn(panel);
    expect(assistantMock.sentCount()).toBe(1);
    // ensureSession 은 전송 시점 저장 설정으로 세션을 만든다 — 방금 고른 레벨이 실려야 한다.
    const created = assistantMock.created as { config?: { autonomyLevel?: unknown; reasoningEffort?: unknown } }[];
    expect(created.length).toBeGreaterThan(0);
    expect(created[0]?.config?.autonomyLevel).toBe("max");
    expect(created[0]?.config?.reasoningEffort).toBe(resolveAutonomy("max").reasoningEffort);
  });
});
