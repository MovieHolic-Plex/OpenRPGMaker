import { bounded } from "./aiEpochFixture";
// 자율성 다이얼 런 표면 — 예산 total 과 칩 라벨이 저장된 레벨을 따른다.
// 기계가 소비하는 값(total 숫자·칩 텍스트)만 단언한다.
import { RunOperation } from "@/ai/runOperation";
import { teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { closeWorkPlanBook } from "@/editor/panels/aiWorkPlanModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import type { WorkPlan } from "@/ai/workPlan";

const assistantMock = vi.hoisted(() => {
  let emitter: ((onEvent: (event: unknown) => void, opts?: unknown) => void) | null = null;
  let holdNext = false;
  let heldResolve: (() => void) | null = null;
  let held = Promise.resolve();
  let signalHeld: (() => void) | undefined;

  class MockAssistantSession {
    private operation = new RunOperation();
    getRunOperation(): RunOperation { return this.operation; }
    retireRun(): void { this.operation.retire(); heldResolve?.(); }
    constructor(_project: unknown, _options: unknown) {}
    async sendUserMessage(
      _text: string,
      onEvent: (event: unknown) => void,
      _signal: unknown,
      _opts?: unknown
    ): Promise<{ assistantText: string; proposedCalls: []; stoppedReason: "final" }> {
      this.operation.retire();
      this.operation = new RunOperation();
      emitter?.(onEvent, _opts);
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => {
          heldResolve = resolve;
          signalHeld?.();
        });
        heldResolve = null;
      }
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
    updateConfig(_config: unknown): void {}
  }
  return {
    MockAssistantSession,
    setEmitter(fn: typeof emitter) {
      emitter = fn;
    },
    holdNextTurn() {
      holdNext = true;
      held = new Promise<void>(resolve => { signalHeld = resolve; });
    },
    whenHeld: () => held,
    releaseHeldTurn() {
      heldResolve?.();
    },
    reset() {
      emitter = null;
      holdNext = false;
      heldResolve = null;
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
  await bounded(assistantMock.whenHeld());
}

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

function samplePlan(): WorkPlan {
  return {
    id: "plan-1",
    goal: "RPG 만들어줘",
    createdAt: "2026-08-14T00:00:00.000Z",
    currentLayerIndex: 0,
    currentItemId: "L1-2",
    layers: [
      {
        id: "L1",
        title: "마을",
        items: [
          { id: "L1-1", title: "마을 광장", instruction: "광장을 만든다", status: "done" },
          { id: "L1-2", title: "집 3채", instruction: "집을 짓는다", status: "in_progress" },
        ],
      },
    ],
  };
}

function bridgeSend(text: string): Promise<unknown> {
  const bridge = (globalThis.window as unknown as { __oprnAiBridge?: { send: (text: string) => Promise<unknown> } }).__oprnAiBridge;
  if (!bridge) throw new Error("bridge missing");
  return bridge.send(text);
}

beforeEach(() => {
  assistantMock.reset();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
  installFakeLocalStorage();
  vi.useFakeTimers();
});

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  closeWorkPlanBook();
  resetModalStackForTest();
  vi.useRealTimers();
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("자율성 다이얼 런 표면", () => {
  it("autonomous 저장 시 자율 런 예산이 0/32 으로 시작한다", async () => {
    // 예전 픽스처는 confirm + agentMode:"auto" 였다. 다이얼이 프리셋의 agentMode 를 함께
    // 저장하므로(confirm → "chat") UI 로는 만들 수 없는 조합이고, planOnly 레벨은 계획 턴에
    // 자율 표면을 켜지 않는다(아래 별도 테스트). 분모가 레벨 cap 이라는 계약은 그대로 검증한다.
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), agentMode: "auto", autonomyLevel: "autonomous" })
    );
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("0/32");

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("확인(planOnly) 레벨의 계획 턴은 자율 런 표면을 켜지 않는다", async () => {
    // Break: 계획만 세우고 멈추는 턴에 「자율 실행 예산」을 띄우면 실행되지 않을 런의 진행률을
    // 보여주는 거짓 표면이 된다. 예전 「계획」 칩은 이걸 눌렀고 다이얼 confirm 은 안 눌렀다 —
    // 두 경로를 하나로 합치는 것이 이 작업의 목적이다.
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), agentMode: "auto", autonomyLevel: "confirm" })
    );
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    expect(findByTestId(panel, "ai-autonomous-budget")).toBeNull();

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("레벨 미지정 저장은 balanced 로 백필돼 예산이 0/16 이다", async () => {
    // loadAiConfig 가 autonomyLevel 없는 옛 blob 을 "balanced"(cap 16)로 정규화하므로
    // 패널 경로에서는 종래 48이 아니라 0/16이 뜬다. 필드 없는 주입 config 의 종래 상한은
    // 세션 단위 테스트(test/autonomyHarness.test.ts)가 보장한다.
    const { autonomyLevel: _dropped, ...legacy } = defaultAiConfig();
    void _dropped;
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...legacy, agentMode: "auto" }));
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("0/16");

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("계속 이벤트의 48분모 표시는 레벨 cap 으로 클램프된다", async () => {
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), agentMode: "auto", autonomyLevel: "autonomous" })
    );
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "status", text: "자율 실행 계속 (5/48)" });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    // 세션 텍스트는 48분모지만 표시는 레벨 cap 32로 내린다.
    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("5/32");

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("컴포저 모델 칩에 저장된 레벨 라벨이 함께 보인다", async () => {
    resetEditorUiModeForTests("standard");
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), model: "stub-model", autonomyLevel: "autonomous" })
    );
    const panel = renderPanel();
    await whenAiChatPanelSettled();

    // autonomous 라벨은 「자율」이다(autonomyLevels AUTONOMY_LEVELS).
    expect(findByTestId(panel, "ai-composer-model")?.textContent).toContain("자율");
  });
});
