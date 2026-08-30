import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import {
  AI_ACTIVITY_MIN_DWELL_MS,
  renderAiChatPanel,
  teardownAiChatPanel,
  type AiActivityScheduler,
} from "@/editor/panels/aiChatPanel";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;
let progressTick: (() => void) | null = null;
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

function installFakeWindow(): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget() as EventTarget & Partial<Window>;
  target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
  target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
  target.setInterval = ((handler: TimerHandler) => {
    progressTick = typeof handler === "function" ? handler as () => void : null;
    return 1;
  }) as typeof setInterval;
  target.clearInterval = ((..._args: Parameters<typeof clearInterval>) => {
    progressTick = null;
  }) as typeof clearInterval;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: target });
  restoreWindow = () => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
    restoreWindow = null;
  };
}

function createActivityScheduler(): {
  readonly scheduler: AiActivityScheduler;
  readonly pending: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }>;
} {
  const pending: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }> = [];
  return {
    pending,
    scheduler: (callback, delayMs) => {
      const task = { callback, delayMs, cancelled: false };
      pending.push(task);
      return () => { task.cancelled = true; };
    },
  };
}

// 실행체가 조수 세션 하나로 합쳐진 뒤, 패널 턴을 관측하는 이음새는 세션의 LLM 호출이다.
// 라운드 경계마다 스크립트 함수가 불리므로, 그 안에서 직전 라운드의 DOM 상태를 단정한다.
function toolRound(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalRound(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

/** 라운드마다 `before[i]` 단정을 먼저 돌리고 `steps[i]` 를 돌려준다. */
function scriptedChat(steps: readonly ChatResult[], before: readonly (() => void)[]) {
  let index = 0;
  const failures: unknown[] = [];
  const chat = vi.fn(async (_config: unknown, _req: ChatRequest): Promise<ChatResult> => {
    try {
      before[index]?.();
    } catch (cause) {
      failures.push(cause);
    }
    const next = steps[index];
    index += 1;
    if (!next) throw new Error("scripted chat exhausted");
    return next;
  });
  return { chat, failures, rounds: () => index };
}

const CHAT_CONFIG = (): string =>
  JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", model: "m", liteModel: "m", apiKey: "sk-test" });

async function flushAsync(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
});

afterEach(() => {
  teardownAiChatPanel();
  restoreWindow?.();
  progressTick = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("AI 도구 라이브 활동 행", () => {
  it("최소 표시 시간 동안 라이브 행을 유지한 뒤 예약 콜백에서 완료 행으로 바꾼다", async () => {
    let now = 0;
    installFakeWindow();
    const activity = createActivityScheduler();
    const project = store.getCurrent();
    const mapId = project.startMapId;
    storage.set(AI_CONFIG_STORAGE_KEY, CHAT_CONFIG());
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    let panel: FakeElement;
    let liveRow: FakeElement | null = null;
    const failures: unknown[] = [];
    // 예약 시점(=tool_call 처리 중)이 유일한 동기 관측점이다. 이때 라이브 행은 아직
    // **실행 중** 문구를 들고 있고 완료 행은 붙지 않았다 — 그것이 이 회귀의 요지다.
    const scheduler: AiActivityScheduler = (callback, delayMs) => {
      const cancel = activity.scheduler(callback, delayMs);
      try {
        liveRow = findByTestId(panel, "ai-activity-live");
        expect(liveRow).toBeTruthy();
        expect(liveRow?.querySelector(".ai-activity-live-spinner")).toBeTruthy();
        const liveText = liveRow?.textContent ?? "";
        expect(liveText).toContain("길을 그리는 중");
        // 도구 이름(snake_case)이 사용자에게 새면 안 된다.
        expect(liveText).not.toMatch(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u);

        now = 2_500;
        progressTick?.();
        expect(liveRow?.textContent).toBe(liveText);
        expect(findByTestId(panel, "ai-status")?.textContent).toContain("길을 그리는 중 · 2초 · 도구 1");

        // 완료 이벤트가 왔어도 최소 표시 시간 전에는 완료 행으로 바뀌지 않는다.
        expect(findByTestId(panel, "ai-tool-entry")).toBeNull();
        expect(delayMs).toBe(AI_ACTIVITY_MIN_DWELL_MS);
      } catch (cause) {
        failures.push(cause);
      }
      return cancel;
    };

    const script = scriptedChat(
      [
        toolRound("paint_road", { mapId, points: [{ x: 1, y: 2 }, { x: 3, y: 2 }], style: "dirt" }, "c1"),
        finalRound("길을 깔았습니다."),
      ],
      [],
    );

    panel = renderAiChatPanel({
      clock: () => now,
      activityScheduler: scheduler,
      getChatDock: () => "side",
      sessionChat: script.chat,
    }) as unknown as FakeElement;
    requestAiSelectionContext(editorState.get().selection);
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "선택 영역에 길을 그려줘";
    findByTestId(panel, "ai-send")?.click();
    for (let i = 0; i < 24; i += 1) await flushAsync();

    if (failures[0]) throw failures[0];
    if (script.failures[0]) throw script.failures[0];
    expect(script.rounds()).toBeGreaterThanOrEqual(2);
    // 예약 콜백이 돌면 같은 DOM 요소가 완료 행으로 바뀐다(행이 튀지 않는다).
    const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]).toBe(liveRow);
    expect(findByTestId(panel, "ai-activity-live")).toBeNull();
  });

  it("성공한 조회 도구는 완료 행을 남기지 않고 턴 종료 시 캔버스 칩 상태도 지운다", async () => {
    installFakeWindow();
    const project = store.getCurrent();
    const mapId = project.startMapId;
    storage.set(AI_CONFIG_STORAGE_KEY, CHAT_CONFIG());
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    let panel: FakeElement;
    let sawRunningTool = false;
    const script = scriptedChat(
      [
        toolRound("get_map_region", { mapId, x: 1, y: 2, w: 3, h: 4 }, "q1"),
        finalRound("3×4 입니다."),
      ],
      [
        () => {},
        // 조회 도구 직후 라운드: 실행 중 도구 이름이 캔버스 칩 상태에 남아 있고
        // 완료 행은 붙지 않았다(조회는 카운터만 올린다).
        () => {
          sawRunningTool = getAgentGhostPreviewState().runningToolName === "get_map_region";
          expect(panel.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(0);
          expect(findByTestId(panel, "ai-tool-activity-toggle")?.textContent).toContain("조회 1");
        },
      ],
    );

    panel = renderAiChatPanel({
      clock: () => 0,
      getChatDock: () => "side",
      sessionChat: script.chat,
    }) as unknown as FakeElement;
    requestAiSelectionContext(editorState.get().selection);
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "이 영역 크기를 알려줘";
    findByTestId(panel, "ai-send")?.click();
    for (let i = 0; i < 24; i += 1) await flushAsync();

    if (script.failures[0]) throw script.failures[0];
    expect(sawRunningTool).toBe(true);
    expect(panel.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(0);
    expect(findByTestId(panel, "ai-tool-activity-toggle")?.textContent).toContain("조회 1");
    // 턴이 끝나면 캔버스 칩 상태는 비워진다.
    expect(getAgentGhostPreviewState().runningToolName).toBe("");
    expect(findByTestId(panel, "ai-ghost-phase-chip")).toBeNull();
  });

  it("다음 도구 시작은 이전 예약을 먼저 확정하고 턴 종료는 마지막 예약까지 비운다", async () => {
    installFakeWindow();
    const activity = createActivityScheduler();
    const project = store.getCurrent();
    const mapId = project.startMapId;
    storage.set(AI_CONFIG_STORAGE_KEY, CHAT_CONFIG());
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    let panel: FakeElement;
    const script = scriptedChat(
      [
        toolRound("paint_road", { mapId, points: [{ x: 1, y: 2 }, { x: 3, y: 2 }], style: "dirt" }, "c1"),
        toolRound("place_npc", { mapId, id: "npc_live", x: 2, y: 3, name: "주민", pages: [{ lines: ["안녕"] }] }, "c2"),
        finalRound("길과 주민을 넣었습니다."),
      ],
      [
        () => {},
        // 첫 도구가 끝난 직후: 라이브 행 하나 + 예약 하나, 완료 행은 아직 없다.
        () => {
          expect(findByTestId(panel, "ai-tool-entry")).toBeNull();
          expect(findByTestId(panel, "ai-activity-live")?.textContent).toContain("길을 그리는 중");
          expect(activity.pending).toHaveLength(1);
        },
        // 둘째 도구 시작이 앞 예약을 먼저 확정(취소 + finalize)하고 라이브 행을 갈아탄다.
        () => {
          const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
          expect(entries).toHaveLength(1);
          expect(entries[0]?.textContent).toContain("도로");
          expect(activity.pending[0]?.cancelled).toBe(true);
          expect(findByTestId(panel, "ai-activity-live")?.textContent).toContain("사람을 만드는 중");
        },
      ],
    );

    panel = renderAiChatPanel({
      clock: () => 0,
      activityScheduler: activity.scheduler,
      getChatDock: () => "side",
      sessionChat: script.chat,
    }) as unknown as FakeElement;
    requestAiSelectionContext(editorState.get().selection);
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "길을 그리고 NPC를 배치해줘";
    findByTestId(panel, "ai-send")?.click();
    for (let i = 0; i < 24; i += 1) await flushAsync();

    if (script.failures[0]) throw script.failures[0];
    // 턴이 끝나면 라이브 행은 사라지고 두 도구가 순서대로 남는다.
    expect(findByTestId(panel, "ai-activity-live")).toBeNull();
    const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
    expect(entries).toHaveLength(2);
    expect(activity.pending.every((task) => task.cancelled)).toBe(true);
  });
});
