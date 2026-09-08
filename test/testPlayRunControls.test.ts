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

import { AudioEngine } from "@/player/audio/audioEngine";
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

function checkbox(testid: string): HTMLInputElement {
  const node = document.querySelector<HTMLInputElement>(`[data-testid='${testid}']`);
  if (!node) throw new Error(`missing testid: ${testid}`);
  return node;
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
  it("unlocks audio synchronously before the opening gesture yields to persistence", async () => {
    const unlock = vi.spyOn(AudioEngine.prototype, "unlock");
    const opening = openTestPlayModal();
    expect(unlock).toHaveBeenCalled();
    await opening;
  });
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

describe("test play skip-title option", () => {
  it("shows the stored preference as a checkbox instead of hiding it behind the buttons", async () => {
    await openTestPlayModal();
    expect(checkbox("test-play-skip-title").checked).toBe(true);

    closeTestPlayModal();
    storage.setItem(AUTO_START_KEY, "0");
    await openTestPlayModal();
    expect(checkbox("test-play-skip-title").checked).toBe(false);
    expect(lastRenderOptions().autoStartRun).toBe(false);
  });

  it("applies the option to the open window: off goes to the title, on starts the run", async () => {
    await openTestPlayModal();
    const skipTitle = checkbox("test-play-skip-title");

    skipTitle.checked = false;
    skipTitle.dispatchEvent(new Event("change"));
    expect(runControls.returnToTitle).toHaveBeenCalledTimes(1);
    expect(storage.getItem(AUTO_START_KEY)).toBe("0");

    skipTitle.checked = true;
    skipTitle.dispatchEvent(new Event("change"));
    expect(runControls.restartRun).toHaveBeenCalledTimes(1);
    expect(storage.getItem(AUTO_START_KEY)).toBe("1");
  });

  it("keeps the checkbox in sync when the titlebar buttons change the preference", async () => {
    await openTestPlayModal();
    const skipTitle = checkbox("test-play-skip-title");

    button("test-play-title")?.click();
    expect(skipTitle.checked).toBe(false);

    button("test-play-restart")?.click();
    expect(skipTitle.checked).toBe(true);
  });
});
