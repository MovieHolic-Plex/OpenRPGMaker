/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerRunControls, RenderPlayerOptions } from "@/player/player";

const runControls = vi.hoisted(() => ({
  restartRun: vi.fn(),
  returnToTitle: vi.fn(),
}));

const playerMocks = vi.hoisted(() => ({
  renderPlayer: vi.fn(),
  teardownPlayer: vi.fn(),
}));

vi.mock("@/player/player", () => playerMocks);
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeDebugPanel", () => ({
  renderRuntimeDebugPanel: () => document.createElement("div"),
}));

import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { closeTestPlayModal, openTestPlayModal } from "@/editor/panels/testPlayModal";

const AUTO_START_KEY = "oprn:test-play-auto-start";

// happy-dom 환경에는 localStorage 가 없다 — 생족 기억 스토랬지를 원래 번짜리에 심는다.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

let storage: Storage = memoryStorage();

function lastRenderOptions(): RenderPlayerOptions {
  const calls = playerMocks.renderPlayer.mock.calls;
  const [, options] = calls[calls.length - 1] as [HTMLElement, RenderPlayerOptions];
  return options;
}

function button(testid: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-testid='${testid}']`);
}

beforeEach(() => {
  storage = memoryStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  store.replaceProject(createBlankProject());
  vi.spyOn(store, "flush").mockResolvedValue({ kind: "not-configured" });
  runControls.restartRun.mockClear();
  runControls.returnToTitle.mockClear();
  playerMocks.renderPlayer.mockReset();
  playerMocks.renderPlayer.mockImplementation((_host: HTMLElement, options: RenderPlayerOptions) => {
    options.onRunControlsReady?.(runControls as PlayerRunControls);
  });
  playerMocks.teardownPlayer.mockClear();
});

afterEach(() => {
  closeTestPlayModal();
  vi.restoreAllMocks();
  storage.clear();
});

describe("test play window run controls", () => {
  it("fills the window and skips the title screen by default", async () => {
    await openTestPlayModal();

    const options = lastRenderOptions();
    expect(options.surfaceScaleMode).toBe("fit");
    expect(options.autoStartRun).toBe(true);
    expect(button("test-play-restart")?.textContent).toBe("다시 시작");
    expect(button("test-play-title")?.textContent).toBe("타이틀부터");
  });

  it("restarts the run from the titlebar without reopening the window", async () => {
    await openTestPlayModal();

    button("test-play-restart")?.click();

    expect(runControls.restartRun).toHaveBeenCalledTimes(1);
    expect(playerMocks.renderPlayer).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-testid='test-play-window']")).not.toBeNull();
  });

  it("boots to the title screen and remembers that choice for the next launch", async () => {
    await openTestPlayModal();

    button("test-play-title")?.click();

    expect(runControls.returnToTitle).toHaveBeenCalledTimes(1);
    expect(storage.getItem(AUTO_START_KEY)).toBe("0");

    await openTestPlayModal();
    expect(lastRenderOptions().autoStartRun).toBe(false);

    button("test-play-restart")?.click();
    expect(storage.getItem(AUTO_START_KEY)).toBe("1");

    await openTestPlayModal();
    expect(lastRenderOptions().autoStartRun).toBe(true);
  });

  it("restarts on F5 without letting the browser reload", async () => {
    await openTestPlayModal();

    const event = new KeyboardEvent("keydown", { key: "F5", cancelable: true });
    document.dispatchEvent(event);

    expect(runControls.restartRun).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("releases the F5 hotkey when the window closes", async () => {
    await openTestPlayModal();
    closeTestPlayModal();

    const event = new KeyboardEvent("keydown", { key: "F5", cancelable: true });
    document.dispatchEvent(event);

    expect(runControls.restartRun).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
