/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modeMocks = vi.hoisted(() => ({
  startPlayGame: vi.fn(),
  destroyGame: vi.fn(),
}));
const handSlotMocks = vi.hoisted(() => ({
  cycleHandSlot: vi.fn(),
  selectHandSlot: vi.fn(),
}));

vi.mock("@/app/mode", () => modeMocks);
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn(() => ({})) }));
vi.mock("@/player/audio", () => ({
  getAudioEngine: vi.fn(() => ({ setQaInstrumentation: vi.fn() })),
  playAudioCommand: vi.fn(),
  stopAudioCommand: vi.fn(),
  stopAllAudio: vi.fn(),
  resumeAudioState: vi.fn(),
}));
vi.mock("@/player/handSlot", () => handSlotMocks);

import { renderPlayer, teardownPlayer } from "@/player/player";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

// PlayScene.session is a `declare` field, so between Phaser constructing the scene and
// create() assigning the session the property does not exist. The document-level keydown
// handler can fire inside that window; this stub reproduces that exact state without a race.
function sessionlessGame() {
  const scene = {
    applySession: () => undefined,
    getSession: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    sys: { settings: { status: 5 } },
    session: undefined,
  };
  return {
    destroy: vi.fn(),
    registry: { set: vi.fn() },
    events: { once: () => undefined, off: () => undefined },
    scene: { getScene: () => scene },
  };
}

let main: HTMLElement;
let bootResolved: Promise<void>;

beforeEach(() => {
  store.replaceProject(createBlankProject());
  handSlotMocks.cycleHandSlot.mockReset();
  handSlotMocks.selectHandSlot.mockReset();
  modeMocks.startPlayGame.mockReset();
  modeMocks.startPlayGame.mockImplementation(async () => sessionlessGame());
  main = document.createElement("div");
  document.body.append(main);
  bootResolved = new Promise<void>((resolve) => {
    renderPlayer(main, {
      trackGlobalGame: false,
      autoStartRun: true,
      onPlayBootSuccess: () => resolve(),
    });
  });
});

afterEach(() => {
  teardownPlayer();
  main.remove();
  vi.restoreAllMocks();
});

describe("runtime keydown handler with an unassigned scene session", () => {
  it("treats a session-less scene as not input-ready instead of throwing", async () => {
    await bootResolved;

    for (const key of ["1", "5", "Tab", "z", "Escape", "["]) {
      expect(() =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
      ).not.toThrow();
    }

    // No hand-slot mutation may be attempted with an undefined session.
    expect(handSlotMocks.cycleHandSlot).not.toHaveBeenCalled();
    expect(handSlotMocks.selectHandSlot).not.toHaveBeenCalled();
  });
});
