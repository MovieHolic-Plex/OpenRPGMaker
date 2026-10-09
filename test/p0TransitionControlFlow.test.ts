/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep, updateParallelEvents } from "@/player/playSceneSchedulers";
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
    close: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function parallelScene(commands: Command[], sleepUntilMorning: () => Promise<boolean>) {
  const fixture = commandScene(sleepUntilMorning);
  fixture.project.commonEvents = [{
    id: "common_parallel_time",
    name: "Parallel time",
    trigger: "parallel",
    commands,
  }];
  fixture.scene.parallelProcesses = new Map();
  fixture.scene.activeRuntimeEvents = vi.fn(() => []);
  return fixture;
}

describe("P0 transition control flow", () => {
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

  it("keeps a parallel sleep pending and resumes the interpreter only after success", async () => {
    // Break caught: consumeParallelSteps resumes setSwitch immediately after starting an unresolved sleep.
    const previous = store.getCurrent();
    const sleep = deferred<boolean>();
    try {
      const scheduled = parallelScene([
        { kind: "sleepUntilMorning" },
        { kind: "setSwitch", switchId: "after_parallel_sleep", value: true },
      ], () => sleep.promise);
      store.replaceProject(scheduled.project);

      updateParallelEvents(scheduled.scene, 16);
      updateParallelEvents(scheduled.scene, 16);
      expect(scheduled.session.switches.after_parallel_sleep).not.toBe(true);
      expect(scheduled.scene.parallelProcesses.size).toBe(1);

      sleep.resolve(true);
      await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_sleep).toBe(true));
      expect(scheduled.scene.parallelProcesses.size).toBe(0);
    } finally {
      store.replaceProject(previous);
    }
  });

  it.each([
    ["false", (pending: ReturnType<typeof deferred<boolean>>) => pending.resolve(false)],
    ["reject", (pending: ReturnType<typeof deferred<boolean>>) => pending.reject(new Error("parallel sleep rejection"))],
  ] as const)("stops a failed parallel sleep (%s) without running later commands", async (_kind, finish) => {
    // Break caught: failed parallel sleeps only paint an overlay after their interpreter already completed.
    const previous = store.getCurrent();
    const sleep = deferred<boolean>();
    try {
      const scheduled = parallelScene([
        { kind: "sleepUntilMorning" },
        { kind: "setSwitch", switchId: "after_failed_parallel_sleep", value: true },
      ], () => sleep.promise);
      store.replaceProject(scheduled.project);

      updateParallelEvents(scheduled.scene, 16);
      finish(sleep);
      await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep"));
      updateParallelEvents(scheduled.scene, 16);

      expect(scheduled.session.switches.after_failed_parallel_sleep).not.toBe(true);
      expect(scheduled.scene.parallelProcesses.size).toBe(1);
      expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep");
    } finally {
      store.replaceProject(previous);
    }
  });

  it("waits for a parallel advance before running its following command", async () => {
    // Break caught: advanceTime is treated as synchronous inside parallel processes even when it sleeps.
    const previous = store.getCurrent();
    const sleep = deferred<boolean>();
    try {
      const scheduled = parallelScene([
        { kind: "advanceTime", days: 1 },
        { kind: "setSwitch", switchId: "after_parallel_advance", value: true },
      ], () => sleep.promise);
      store.replaceProject(scheduled.project);

      updateParallelEvents(scheduled.scene, 16);
      expect(scheduled.session.switches.after_parallel_advance).not.toBe(true);
      sleep.resolve(true);
      await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_advance).toBe(true));
    } finally {
      store.replaceProject(previous);
    }
  });

  it.each([
    ["false", async () => false],
    ["reject", async () => { throw new Error("parallel advance rejection"); }],
  ] as const)("stops a failed parallel advance (%s) without running later commands", async (_kind, sleepUntilMorning) => {
    // Break caught: advanceTime failure is observed but its parallel interpreter still resumes setSwitch.
    const previous = store.getCurrent();
    try {
      const scheduled = parallelScene([
        { kind: "advanceTime", days: 1 },
        { kind: "setSwitch", switchId: "after_failed_parallel_advance", value: true },
      ], sleepUntilMorning);
      store.replaceProject(scheduled.project);

      updateParallelEvents(scheduled.scene, 16);
      await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-advance"));
      updateParallelEvents(scheduled.scene, 16);

      expect(scheduled.session.switches.after_failed_parallel_advance).not.toBe(true);
      expect(scheduled.scene.parallelProcesses.size).toBe(1);
    } finally {
      store.replaceProject(previous);
    }
  });
});
