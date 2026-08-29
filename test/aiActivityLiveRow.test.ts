import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
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
  it("도구 시작 즉시 구체적인 한국어 활동을 보이고 같은 행을 완료 형태로 바꾼다", async () => {
    let now = 0;
    installFakeWindow();
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

      options.onEvent?.({
        type: "tool_call",
        name: "paint_road",
        args: { mapId, x: 1, y: 2, w: 3, h: 4 },
        result: { ok: true, summary: "길 6칸" },
      });

      assertInsideRunner(() => {
        expect(findByTestId(panel, "ai-activity-live")).toBeNull();
        const entries = panel.querySelectorAll("[data-testid=ai-tool-entry]");
        expect(entries).toHaveLength(1);
        expect(entries[0]).toBe(liveRow);
        expect(entries[0]?.textContent).toContain("길 6칸");
      });

      return {
        ok: true,
        applied: true,
        changedCells: 6,
        changedEvents: 0,
        clippedCells: 0,
        proposedCalls: 1,
        assistantText: "",
      };
    });

    panel = renderAiChatPanel({
      clock: () => now,
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
});
