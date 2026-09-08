// 할 일 목록 표면(작업 계획 체크리스트) — AI 패널의 라이브 체크리스트/마일스톤 피드/예산 표시 DOM 테스트.
// 패널은 fake DOM(테스트 전용) 위에서 렌더되고, 세션은 합성 이벤트(onEvent)를 흘려보내는
// 목으로 대체된다 — emitWorkPlan/milestone_applied/proposal_paused/예산 status 이벤트가
// 실제 패널 이벤트 핸들러를 통과해 표면에 반영되는지가 단언 대상이다(타이밍 대기 없음, 전부 동기).
// Lifecycle: live chrome belongs to the owner turn, not to the retained session plan.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import {
  AUTO_COLLAPSE_AFTER_AI_MS,
  renderAiChatPanel,
} from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { closeWorkPlanBook } from "@/editor/panels/aiWorkPlanModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { WorkPlan } from "@/ai/workPlan";

// 패널은 AssistantSession 을 lazy 생성한다 — 목 세션으로 대체해 합성 이벤트를 흘려보낸다.
const assistantMock = vi.hoisted(() => {
  const sentMessages: string[] = [];
  let emitter: ((onEvent: (event: unknown) => void, opts?: unknown) => void) | null = null;
  let lastOpts: unknown = null;
  let stopReason: "final" | "max-tool-calls" | "error" = "final";
  let answer = "완료.";
  let holdNext = false;
  let heldResolve: (() => void) | null = null;
  let heldSignal = Promise.resolve();
  let signalHeld: (() => void) | null = null;

  class MockAssistantSession {
    constructor(_project: unknown, _options: unknown) {}

    async sendUserMessage(
      text: string,
      onEvent: (event: unknown) => void,
      _signal: unknown,
      opts?: unknown
    ): Promise<{ assistantText: string; proposedCalls: []; stoppedReason: "final" | "max-tool-calls" | "error" }> {
      sentMessages.push(text);
      lastOpts = opts;
      emitter?.(onEvent, opts);
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => {
          heldResolve = resolve;
          signalHeld?.();
        });
        heldResolve = null;
      }
      return { assistantText: answer, proposedCalls: [], stoppedReason: stopReason };
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

    getRunOutcome(): null {
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
    setEmitter(fn: typeof emitter) {
      emitter = fn;
    },
    setAnswer(text: string) { answer = text; },
    setStopReason(reason: typeof stopReason) { stopReason = reason; },
    getLastOpts(): unknown {
      return lastOpts;
    },
    holdNextTurn() {
      holdNext = true;
      heldSignal = new Promise<void>((resolve) => { signalHeld = resolve; });
    },
    whenHeld() { return heldSignal; },
    releaseHeldTurn() {
      heldResolve?.();
    },
    reset() {
      sentMessages.length = 0;
      emitter = null;
      lastOpts = null;
      holdNext = false;
      stopReason = "final";
      answer = "완료.";
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
  await assistantMock.whenHeld();
}

// 칩 접힘(`is-collapsed`)은 side·float 축이다 — glass 는 입력줄을 남기는 fold 로 갈라졌다
// (test/aiGlassFold.test.ts). 이 파일은 자동 펼침/재접기를 보므로 side 에 고정한다.
function renderPanel(dock: "glass" | "side" | "float" = "side"): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel({ getChatDock: () => dock }));
}

// emitWorkPlan 페이로드와 같은 형태의 합성 계획.
function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
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
      {
        id: "L2",
        title: "필드",
        items: [
          { id: "L2-1", title: "필드 맵", instruction: "필드를 만든다", status: "pending" },
          { id: "L2-2", title: "보스", instruction: "보스를 배치한다", status: "pending" },
        ],
      },
    ],
    ...overrides,
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
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-or-test" }));
});

afterEach(() => {
  closeWorkPlanBook();
  resetModalStackForTest();
  vi.useRealTimers();
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("할 일 목록 표면 (작업 계획 체크리스트)", () => {
  it("does not promote quick-reply presets but retains their transcript text", async () => {
    const panel = renderPanel();
    const answer = "Choose a preset.\n[선택지] Village | Dungeon | Farm";
    assistantMock.setAnswer(answer);
    await bridgeSend("options");
    expect(panel.querySelectorAll(".ai-quick-reply-chip")).toHaveLength(0);
    for (const fragment of answer.split("\n")) {
      expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain(fragment);
    }
  });

  it("(a) emitWorkPlan 이벤트로 체크리스트가 렌더된다 — 항목별 진행 + 현재 레이어 표시", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    // 런이 진행 중인 동안(턴 홀드) 표면을 관찰한다 — 런 종료 시 표면은 정리된다.
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    const checklist = findByTestId(panel, "ai-work-plan-checklist");
    expect(checklist).not.toBeNull();
    expect(checklist?.textContent).toContain("RPG 만들어줘");
    expect(document.querySelector("[data-testid='ai-plan-book']")).toBeNull();
    findByTestId(panel, "ai-plan-book-open")?.click();
    expect(document.querySelector("[data-testid='ai-plan-book']")).not.toBeNull();
    expect(findByTestId(panel, "ai-plan-book-open")?.textContent).toBe("계획 보기");
    const items = document.querySelectorAll("[data-testid='ai-autonomous-item']");
    expect(items).toHaveLength(4);
    expect([...items].map((item) => (item as HTMLElement).dataset.status)).toEqual(["done", "in_progress", "pending", "pending"]);
    const layers = document.querySelectorAll("[data-testid='ai-autonomous-layer']");
    expect(layers).toHaveLength(2);
    expect((layers[0] as HTMLElement | undefined)?.dataset.current).toBe("true");
    expect((layers[1] as HTMLElement | undefined)?.dataset.current).toBe("false");
    expect(findByTestId(panel, "ai-autonomous-progress")?.textContent).toBe("1/4");
    expect(findByTestId(panel, "ai-autonomous-chip")?.textContent).toContain("자율 실행");
    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("0/16");
    expect(findByTestId(panel, "ai-run-status")?.textContent).toBe("집 3채 중");
    expect(findByTestId(panel, "ai-run-stop")?.textContent).toBe("중지");
    expect(findByTestId(panel, "ai-run-progress")).not.toBeNull();
    expect(findByTestId(panel, "ai-run-details-toggle")?.textContent).toContain("자세히");
    expect(findByTestId(panel, "ai-run-whisper")?.textContent).not.toContain("예산");
    expect(findByTestId(panel, "ai-run-details")?.contains(findByTestId(panel, "ai-autonomous-budget"))).toBe(true);
    expect(findByTestId(panel, "ai-work-item-activity")?.textContent).toBe("진행 중…");
    expect(checklist?.dataset.active).toBe("true");
    expect(panel.classList.contains("is-autonomous-run")).toBe(true);

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("tool_started 이벤트는 진행 중 항목의 활동 줄만 갈아 끼운다(체크리스트 재렌더 없음)", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "tool_started", name: "fill_region", index: 1 });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();
    const checklist = findByTestId(panel, "ai-work-plan-checklist");
    const activity = findByTestId(panel, "ai-work-item-activity");
    expect(activity?.textContent).not.toBe("진행 중…");
    expect((activity?.textContent ?? "").length).toBeGreaterThan(0);
    // 같은 노드가 유지된다 — 툴콜마다 목록을 통째로 다시 그리지 않는다.
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBe(checklist);
    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("(b) 자동 계속/예산 소진 status 이벤트로 예산 표시(used/total)가 갱신된다 — 표시는 저장 레벨 cap", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "status", text: "자율 실행 계속 (2/48)" });
      onEvent({ type: "status", text: "자율 실행 계속 (17/48)" });
    });
    assistantMock.holdNextTurn();
    const firstRun = bridgeSend("RPG 만들어줘");
    await flushAsync();

    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("17/16");
    assistantMock.releaseHeldTurn();
    await firstRun;
    await flushAsync();

    // 새 런: 예산은 0부터 다시 시작한다(이전 런의 사용량이 남지 않는다).
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "status", text: "자율 실행 계속 (1/48)" });
    });
    assistantMock.holdNextTurn();
    const secondRun = bridgeSend("이어서");
    await flushAsync();
    expect(findByTestId(panel, "ai-autonomous-budget")?.textContent).toContain("1/16");
    assistantMock.releaseHeldTurn();
    await secondRun;
    await flushAsync();
  });

  it("(c) milestone_applied / proposal_paused 이벤트마다 적용/실패 피드 라인이 렌더된다", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "milestone_applied", title: "마을 광장", toolCount: 3, commitId: "c1" });
      onEvent({ type: "proposal_paused", reason: "적용 검증 실패", warnings: [] });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    const applied = findByTestId(panel, "ai-milestone-feed-applied");
    expect(applied).not.toBeNull();
    expect(applied?.textContent).toContain("마을 광장");
    expect(applied?.textContent).toContain("3");
    const failed = findByTestId(panel, "ai-milestone-feed-apply-failed");
    expect(failed).not.toBeNull();
    expect(failed?.textContent).toContain("적용 실패");
    expect(failed?.textContent).toContain("프로젝트 저장소 변경 없음");
    expect(findByTestId(panel, "ai-run-details")?.contains(applied)).toBe(true);

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("(d) 런 진행 중에는 자동 접기가 비활성화되고, 런 종료 후에는 재개된다", async () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);

    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();

    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    // 런 진행 중: 자동 펼침 + 체크리스트 표시, 접히지 않는다.
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(findByTestId(panel, "ai-work-plan-checklist")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(AUTO_COLLAPSE_AFTER_AI_MS * 2);
    await flushAsync();
    expect(panel.classList.contains("is-collapsed")).toBe(false);

    // 런 종료 뒤에도 조수는 열어 둔다 — 답과 할 일 목록을 읽어야 한다. 목록은 남고 활동만 꺼진다.
    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeNull();
    expect(findByTestId(panel, "ai-run-stop")).toBeNull();
    await vi.advanceTimersByTimeAsync(AUTO_COLLAPSE_AFTER_AI_MS + 50);
    await flushAsync();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });

  it("턴이 끝나면 할 일 표면은 걷히고 다음 턴의 새 계획은 보인다", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const firstRun = bridgeSend("RPG 만들어줘");
    await flushAsync();
    expect(findByTestId(panel, "ai-work-plan-checklist")).not.toBeNull();

    // 턴 종료 → 목록은 그대로 남는다(사용자가 뭐가 됐는지 읽는다). 활동만 꺼져 「대기 중」이 된다.
    assistantMock.releaseHeldTurn();
    await firstRun;
    await flushAsync();
    const settled = findByTestId(panel, "ai-work-plan-checklist");
    expect(settled).toBeNull();
    expect(findByTestId(panel, "ai-autonomous-run-surface")).toBeNull();

    // 다음 턴: 다른 목표의 계획 — 이전 항목이 남지 않는다.
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan({ goal: "던전 하나", layers: [] }) });
    });
    assistantMock.holdNextTurn();
    const secondRun = bridgeSend("던전 만들어줘");
    await flushAsync();
    const checklist = findByTestId(panel, "ai-work-plan-checklist");
    expect(checklist?.textContent).toContain("던전 하나");
    expect(checklist?.textContent).not.toContain("RPG 만들어줘");
    expect(document.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
    assistantMock.releaseHeldTurn();
    await secondRun;
    await flushAsync();
  });

  it("항목 체크 뒤에도 실행이 살아 있으면 확인 중, 도구 한도로 끝나면 중단 상태로 남는다", async () => {
    const panel = renderPanel();
    const finished = samplePlan({ currentItemId: null, layers: samplePlan().layers.map((layer) => ({
      ...layer, items: layer.items.map((item) => ({ ...item, status: "done" as const })),
    })) });
    assistantMock.setEmitter((onEvent) => onEvent({ type: "work_plan", plan: finished }));
    assistantMock.setStopReason("max-tool-calls");
    assistantMock.holdNextTurn();
    const running = bridgeSend("RPG 만들어줘");
    await flushAsync();
    expect(findByTestId(panel, "ai-run-status")?.textContent).toBe("마무리 확인 중");
    expect(findByTestId(panel, "ai-work-plan-checklist")?.dataset.complete).toBe("false");
    assistantMock.releaseHeldTurn();
    await running;
    await flushAsync();
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeNull();
  });

  it("완료 계획은 표면에서 걷히고 계획 없는 턴도 목록을 만들지 않는다", async () => {
    const panel = renderPanel();
    const finished = samplePlan({
      currentItemId: null,
      layers: samplePlan().layers.map((layer) => ({
        ...layer,
        items: layer.items.map((item) => ({ ...item, status: "done" as const })),
      })),
    });
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
      onEvent({ type: "work_plan", plan: finished });
    });
    await bridgeSend("RPG 만들어줘");
    await flushAsync();
    const checklist = findByTestId(panel, "ai-work-plan-checklist");
    expect(checklist).toBeNull();
    expect(document.querySelector("[data-testid=ai-plan-book]")).toBeNull();

    // 계획 없는 다음 턴: 끝난 계획은 이어받지 않고, 새 계획도 안 오면 목록이 없다.
    assistantMock.setEmitter(() => {});
    await bridgeSend("고마워");
    await flushAsync();
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeNull();
    expect(findByTestId(panel, "ai-autonomous-run-surface")).toBeNull();
  });

  it("런 중 중단하면 목록과 활동 표면이 함께 걷힌다", async () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();

    expect(findByTestId(panel, "ai-work-plan-checklist")).not.toBeNull();
    // 중단 버튼은 진행 중에 노출되고 클릭으로 턴을 중단한다.
    const abort = findByTestId(panel, "ai-abort");
    expect(abort).not.toBeNull();
    expect(abort?.disabled).toBe(false);
    abort?.click();
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("중단 중…");

    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
    // 중단된 런도 목록은 남는다 — 어디까지 됐는지가 곧 중단의 결과다. 활동(중지 버튼·펄스)만 꺼진다.
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeNull();
    expect(findByTestId(panel, "ai-run-stop")).toBeNull();
  });

  it("목록의 「중지」 버튼은 진행 중 턴을 중단한다", async () => {
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("RPG 만들어줘");
    await flushAsync();
    const stop = findByTestId(panel, "ai-run-stop");
    expect(stop).not.toBeNull();
    stop?.click();
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("중단 중…");
    assistantMock.releaseHeldTurn();
    await sending;
    await flushAsync();
  });

  it("agentMode chat 에서도 할 일 목록은 뜨되 예산 없이 뜨고, 세션에 autonomous 플래그가 전달되지 않는다", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", apiKey: "sk-or-test" }));
    const panel = renderPanel();
    assistantMock.setEmitter((onEvent) => {
      onEvent({ type: "work_plan", plan: samplePlan() });
    });
    assistantMock.holdNextTurn();
    const sending = bridgeSend("안녕");
    await flushAsync();
    // C1: chat Do still enters the driver. Checklist is independent of agentMode.
    expect(findByTestId(panel, "ai-work-plan-checklist")).not.toBeNull();
    expect(findByTestId(panel, "ai-autonomous-chip")?.textContent).toBe("자율 실행 중");
    findByTestId(panel, "ai-plan-book-open")?.click();
    expect(document.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(4);
    expect(assistantMock.getLastOpts()).toMatchObject({ autonomous: true, instruction: "안녕", scope: null });
    assistantMock.releaseHeldTurn();
    await sending;
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeNull();
  });
});
