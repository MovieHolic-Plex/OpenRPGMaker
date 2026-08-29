import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { editorState } from "@/editor/editorState";
import {
  AI_ACTIVITY_MIN_DWELL_MS,
  renderAiChatPanel,
  teardownAiChatPanel,
  type AiActivityScheduler,
} from "@/editor/panels/aiChatPanel";
import type { RegionTaskOptions, RegionTaskResult } from "@/editor/regionTask/runRegionTask";
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

function successfulRegionResult(changedCells: number): RegionTaskResult {
  return {
    ok: true,
    applied: true,
    changedCells,
    changedEvents: 0,
    clippedCells: 0,
    proposedCalls: 1,
    assistantText: "",
  };
}

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
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    let panel: FakeElement;
    let liveRow: FakeElement | null = null;
    let runnerAssertionFailure: unknown;
    const assertInsideRunner = (assertion: () => void): void => {
      try {
        assertion();
      } catch (cause) {
        runnerAssertionFailure = cause;
        throw cause;
      }
    };
    const runner = vi.fn(async (options: RegionTaskOptions): Promise<RegionTaskResult> => {
      options.onEvent?.({ type: "tool_started", name: "paint_road", index: 1 });

      assertInsideRunner(() => {
        liveRow = findByTestId(panel, "ai-activity-live");
        expect(liveRow).toBeTruthy();
        expect(liveRow?.querySelector(".ai-activity-live-spinner")).toBeTruthy();
        const liveText = liveRow?.textContent ?? "";
        expect(liveText).toContain("길을 그리는 중");
        expect(liveText).not.toMatch(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u);

        now = 2_500;
        progressTick?.();
        expect(liveRow?.textContent).toContain("2초");
        expect(findByTestId(panel, "ai-status")?.textContent).toContain("길을 그리는 중 · 2초 · 도구 1");
      });

      // 완료 시각을 시작 직후로 되돌려 최소 표시 시간 예약을 검증한다.
      now = 0;
      options.onEvent?.({
        type: "tool_call",
        name: "paint_road",
        args: { mapId, x: 1, y: 2, w: 3, h: 4 },
        result: { ok: true, summary: "길 6칸" },
      });

      assertInsideRunner(() => {
        expect(findByTestId(panel, "ai-activity-live")).toBe(liveRow);
        expect(findByTestId(panel, "ai-tool-entry")).toBeNull();
        expect(activity.pending).toHaveLength(1);
        expect(activity.pending[0]?.delayMs).toBe(AI_ACTIVITY_MIN_DWELL_MS);

        activity.pending[0]?.callback();
        expect(findByTestId(panel, "ai-activity-live")).toBeNull();
        const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
        expect(entries).toHaveLength(1);
        expect(entries[0]).toBe(liveRow);
        expect(entries[0]?.textContent).toContain("길 6칸");
      });

      return successfulRegionResult(6);
    });

    panel = renderAiChatPanel({
      clock: () => now,
      activityScheduler: activity.scheduler,
      getChatDock: () => "side",
      regionTaskRunner: runner,
    }) as unknown as FakeElement;
    requestAiSelectionContext(editorState.get().selection);
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "선택 영역에 길을 그려줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(runner).toHaveBeenCalledTimes(1);
    if (runnerAssertionFailure) throw runnerAssertionFailure;
  });

  it("다음 도구 시작은 이전 예약을 먼저 확정하고 턴 종료는 마지막 예약까지 비운다", async () => {
    installFakeWindow();
    const activity = createActivityScheduler();
    const project = store.getCurrent();
    const mapId = project.startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    let panel: FakeElement;
    let runnerAssertionFailure: unknown;
    const assertInsideRunner = (assertion: () => void): void => {
      try {
        assertion();
      } catch (cause) {
        runnerAssertionFailure = cause;
        throw cause;
      }
    };
    const runner = vi.fn(async (options: RegionTaskOptions): Promise<RegionTaskResult> => {
      options.onEvent?.({ type: "tool_started", name: "paint_road", index: 1 });
      options.onEvent?.({
        type: "tool_call",
        name: "paint_road",
        args: { mapId },
        result: { ok: true, summary: "첫 번째 길" },
      });
      assertInsideRunner(() => {
        expect(findByTestId(panel, "ai-tool-entry")).toBeNull();
        expect(findByTestId(panel, "ai-activity-live")?.textContent).toContain("길을 그리는 중");
      });

      options.onEvent?.({ type: "tool_started", name: "place_npc", index: 2 });
      assertInsideRunner(() => {
        const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
        expect(entries).toHaveLength(1);
        expect(entries[0]?.textContent).toContain("첫 번째 길");
        expect(findByTestId(panel, "ai-activity-live")?.textContent).toContain("사람을 만드는 중");
        expect(activity.pending[0]?.cancelled).toBe(true);
      });

      options.onEvent?.({
        type: "tool_call",
        name: "place_npc",
        args: { mapId },
        result: { ok: true, summary: "두 번째 NPC" },
      });
      assertInsideRunner(() => {
        expect(panel.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);
        expect(findByTestId(panel, "ai-activity-live")?.textContent).toContain("사람을 만드는 중");
      });
      return successfulRegionResult(1);
    });

    panel = renderAiChatPanel({
      clock: () => 0,
      activityScheduler: activity.scheduler,
      getChatDock: () => "side",
      regionTaskRunner: runner,
    }) as unknown as FakeElement;
    requestAiSelectionContext(editorState.get().selection);
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "길을 그리고 NPC를 배치해줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(runner).toHaveBeenCalledTimes(1);
    if (runnerAssertionFailure) throw runnerAssertionFailure;
    expect(findByTestId(panel, "ai-activity-live")).toBeNull();
    const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
    expect(entries).toHaveLength(2);
    expect(entries[0]?.textContent).toContain("첫 번째 길");
    expect(entries[1]?.textContent).toContain("두 번째 NPC");
    expect(activity.pending.every((task) => task.cancelled)).toBe(true);
  });
});
