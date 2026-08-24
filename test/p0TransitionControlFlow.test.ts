import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";

function commandScene(sleepUntilMorning: () => Promise<boolean>) {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true };
  const session = startSession(project, 501);
  const overlays: string[] = [];
  const dialogue = {
    showText: vi.fn(async () => undefined),
    showChoices: vi.fn(async () => 0),
    showNumberInput: vi.fn(async () => 0),
    hide: vi.fn(),
  };
  const registry = new Map<string, unknown>([["dialogue", dialogue]]);
  const scene = {
    session,
    running: false,
    inputEnabled: true,
    lastActionTargetKey: "",
    tileY: 0,
    map: { height: 1 },
    game: { registry: { get: (key: string) => registry.get(key) } },
    sleepUntilMorning,
    setInputEnabled: vi.fn(),
    refreshRuntimeSurfaces: vi.fn(),
    syncRuntimeState: vi.fn(),
    showRuntimeOverlay: (_id: string, text: string) => overlays.push(text),
    clearRuntimeOverlay: vi.fn(),
  } as unknown as PlaySceneContext;
  return { project, session, scene, overlays };
}

describe("P0 transition control flow", () => {
  beforeEach(() => {
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("does not resume the next authored command when sleep reports false", async () => {
    const previous = store.getCurrent();
    try {
      const { project, session, scene } = commandScene(async () => false);
      store.replaceProject(project);
      const commands: Command[] = [
        { kind: "sleepUntilMorning" },
        { kind: "setSwitch", switchId: "after_failed_sleep", value: true },
      ];

      await runCommands(scene, commands);

      expect(session.switches.after_failed_sleep).not.toBe(true);
    } finally {
      store.replaceProject(previous);
    }
  });

  it("observes false and rejected fire-and-forget scheduler sleeps", async () => {
    const falseCase = commandScene(async () => false);
    expect(applyNonBlockingStep(falseCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
    await vi.waitFor(() => expect(falseCase.overlays.at(-1)).toContain("scheduled-sleep"));

    const rejectedCase = commandScene(async () => {
      throw new Error("scheduler rejection");
    });
    expect(applyNonBlockingStep(rejectedCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
    await vi.waitFor(() => expect(rejectedCase.overlays.at(-1)).toContain("scheduler rejection"));
  });

  it("observes a rejected fire-and-forget scheduler day advance", async () => {
    const previous = store.getCurrent();
    try {
      const scheduled = commandScene(async () => {
        throw new Error("advance rejection");
      });
      store.replaceProject(scheduled.project);

      expect(applyNonBlockingStep(scheduled.scene, { kind: "advanceTime", days: 1 })).toBe(true);
      await vi.waitFor(() => {
        expect(scheduled.overlays.at(-1)).toContain("scheduled-advance");
        expect(scheduled.overlays.at(-1)).toContain("advance rejection");
      });
    } finally {
      store.replaceProject(previous);
    }
  });
});
