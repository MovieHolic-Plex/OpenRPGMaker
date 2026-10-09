/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import type Phaser from "phaser";
import type { Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { startMaker } from "@/project/makers";
import { store } from "@/project/store";
import { isGameTimePausedForRuntime, updateGameTime } from "@/player/playSceneTime";
import { tickNpcSchedules } from "@/player/npcSchedules";
import * as runner from "../scripts/lib/runtimeQaFrames.mjs";
import { normalizeScenario } from "../scripts/lib/runtimeQa.mjs";
import { Input } from "@/player/input";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const boot = vi.hoisted(() => ({ game: undefined as unknown }));
vi.mock("@/app/phaserRuntime", () => ({ ensurePhaser: async () => ({
  AUTO: 0, Scale: { NONE: 0 },
  Game: function (config: { callbacks: { preBoot(game: unknown): void } }) {
    config.callbacks.preBoot(boot.game); return boot.game;
  },
}) }));
vi.mock("@/player/PlayScene", () => ({ PlayScene: class {} }));
import { createPlayGame } from "@/player/createPlayGame";

const require = createRequire(import.meta.url);
const phaserRoot = dirname(require.resolve("phaser/package.json"));
const TimeStep = require(resolve(phaserRoot, "src/core/TimeStep.js"));
const EventEmitter = require("eventemitter3");

// Execute the installed Phaser dispatchers unchanged. Constructor-only renderer,
// loader and device imports are inert: no browser renderer is constructed here.
// Class and event definitions are real. No loop/update/event method is replaced.
function dispatcher(file: string) {
  const filename = resolve(phaserRoot, "src", file);
  const localRequire = createRequire(filename);
  const module = { exports: {} as { prototype: Record<string, Function> } };
  runInNewContext(readFileSync(filename, "utf8"), {
    module, exports: module.exports,
    require: (id: string) => id.endsWith("/Class") || id === "./events" || id === "./const" ? localRequire(id) : {},
  }, { filename });
  return module.exports.prototype;
}
const gameMethods = dispatcher("core/Game.js");
const systemMethods = dispatcher("scene/Systems.js");
const managerMethods = dispatcher("scene/SceneManager.js");
const sceneStatus = require(resolve(phaserRoot, "src/scene/const.js"));

interface FrameHook {
  pause(): void;
  step(request: { frames: number; deltaMs: number }): { sequence: number; frames: number; deltaMs: number; startFrame: number; endFrame: number };
  resume(): void;
}
function hook(): FrameHook {
  const value = (window as unknown as { __oprnQaFrames?: FrameHook }).__oprnQaFrames;
  expect(value, "QA boot must expose the frame controller").toBeDefined();
  return value!;
}

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); vi.restoreAllMocks(); document.body.replaceChildren(); });

async function runtime(qaInstrumentation?: boolean) {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 1 };
  const itemId = project.database.items[0]!.id;
  project.session.inventory = { [itemId]: 2 };
  project.system.makers = [{ id: "ticks", inputs: [{ itemId, count: 1 }], outputs: [{ itemId, count: 1 }], durationMinutes: 30 }];
  project.maps[project.startMapId]!.events.push({
    id: "scheduled", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [],
    schedule: [
      { when: { hourRange: [6, 7] }, at: { mapId: project.startMapId, x: 2, y: 2 }, facing: "left", activity: "work" },
      { when: { hourRange: [7, 8] }, at: { mapId: project.startMapId, x: 2, y: 2 }, facing: "right", activity: "rest" },
    ],
  });
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  const session = startSession(project, 17);
  expect(startMaker(project, session, "job", "ticks", 0).ok).toBe(true);
  const canvas = document.createElement("canvas");
  const stage = document.createElement("div"); stage.className = "play-stage"; stage.append(canvas); document.body.append(stage);
  const events = new EventEmitter();
  const sceneEvents = new EventEmitter();
  const registry = new Map<string, unknown>();
  const updates: number[] = [];
  const inputs: ReturnType<Input["update"]>[] = [];
  const game = {
    events, registry, canvas, isRunning: true, isPaused: false, pendingDestroy: false,
    renderer: { preRender: vi.fn(), postRender: vi.fn(), destroy: vi.fn() },
    scene: {
      _pending: [], _queue: [], scenes: [] as Array<{ sys: typeof system }>,
      processQueue() { managerMethods.processQueue!.call(this); },
      update(time: number, delta: number) { managerMethods.update!.call(this, time, delta); },
      render(renderer: unknown) { managerMethods.render!.call(this, renderer); },
      destroy() { sceneEvents.emit("shutdown"); },
    },
    destroy(removeCanvas: boolean) { gameMethods.destroy!.call(game, removeCanvas); },
    runDestroy() { gameMethods.runDestroy!.call(game); },
    step(time: number, delta: number) { gameMethods.step!.call(game, time, delta); },
    loop: undefined as unknown as Phaser.Core.TimeStep,
  };
  const input = new Input({ input: { keyboard: { createCursorKeys: () => Object.fromEntries(["up", "down", "left", "right", "space", "shift"].map((key) => [key, { isDown: false }])), addKeys: () => ({}), on: () => {} } }, events: sceneEvents } as unknown as Phaser.Scene);
  const scene = {
    game, session, timeFixedAccumulatorMs: 0, timeMinuteAccumulator: 0, timeSleepInProgress: false,
    clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
    map: project.maps[project.startMapId], eventPositions: {}, autonomousNPCs: new Map(), commandMoveRouteEventIds: new Set(),
    refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
    registerAutonomousMover: () => { throw new Error("Stationary schedule must not create a mover"); },
  } as unknown as PlaySceneContext;
  const system = {
    events: sceneEvents, scene, settings: { status: sceneStatus.RUNNING, visible: true }, render: vi.fn(),
    step(time: number, delta: number) { systemMethods.step!.call(this, time, delta); },
    sceneUpdate(_time: number, delta: number) {
      updates.push(delta); inputs.push(input.update()); updateGameTime(scene, delta);
      tickNpcSchedules(scene, isGameTimePausedForRuntime(scene), delta);
    },
  };
  game.scene.scenes.push({ sys: system });
  // The only scheduler fake stores/cancels exact RAF callbacks, never simulates time.
  let nextId = 0;
  const scheduled = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { scheduled.set(++nextId, callback); return nextId; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { scheduled.delete(id); });
  vi.spyOn(window.performance, "now").mockReturnValue(1000);
  const loop = new TimeStep(game, { smoothStep: false }); game.loop = loop;
  loop.start(game.step.bind(game));
  const deliverFrame = (deltaMs: number) => {
    const pending = [...scheduled.values()]; scheduled.clear();
    for (const callback of pending) callback(loop.lastTime + deltaMs);
  };
  boot.game = game;
  await createPlayGame(stage, undefined, { qaInstrumentation });
  cleanups.push(() => { events.emit("destroy"); sceneEvents.emit("shutdown"); if (loop.raf) loop.stop(); });
  return { game, loop, events, updates, inputs, session, stage, scheduled, deliverFrame };
}

describe("native QA frame stepping", () => {
  it.each([undefined, false])("does not install or change realtime updates when QA is %s", async (qa) => {
    const { deliverFrame, session, updates, scheduled } = await runtime(qa);
    expect(Object.hasOwn(window, "__oprnQaFrames")).toBe(false);
    deliverFrame(1000);
    expect(updates).toEqual([1000]);
    expect(session.gameTime?.minute).toBe(1);
    expect(scheduled.size).toBe(1);
  });

  it("advances actual Phaser frames and clock/maker once, with automatic RAF cancelled", async () => {
    const { loop, events, session, updates, scheduled, deliverFrame, game } = await runtime(true);
    const control = hook(); control.pause();
    expect(scheduled.size).toBe(0);
    const order: string[] = [];
    for (const event of ["prestep", "step", "poststep", "postrender"]) events.on(event, () => order.push(event));
    const receipt = control.step({ frames: 29, deltaMs: 1000 });
    expect(receipt).toMatchObject({ sequence: 1, frames: 29, deltaMs: 1000 });
    expect(receipt.endFrame - receipt.startFrame).toBe(29);
    expect(loop.frame).toBe(receipt.endFrame);
    expect(updates).toEqual(Array(29).fill(1000));
    expect(order).toEqual(Array.from({ length: 29 }, () => ["prestep", "step", "poststep", "postrender"]).flat());
    expect(game.renderer.postRender).toHaveBeenCalledTimes(29);
    expect(session.gameTime).toMatchObject({ day: 1, hour: 6, minute: 29 });
    expect(session.makerInstances?.job?.status).toBe("processing");
    deliverFrame(9000); // No scheduled RAF remains to double-advance.
    expect(session.gameTime?.minute).toBe(29);
    control.step({ frames: 1, deltaMs: 1000 });
    expect(session.makerInstances?.job?.status).toBe("ready");
    expect(session.inventory).toEqual({ [Object.keys(session.inventory)[0]!]: 1 });
  });

  it("keeps the native key latch and menu pause policy in the stepped scene", async () => {
    const { session, stage, inputs } = await runtime(true);
    const control = hook(); control.pause();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "z" }));
    const menu = document.createElement("div"); menu.dataset.testid = "main-menu"; stage.append(menu);
    const before = structuredClone(session);
    control.step({ frames: 2, deltaMs: 1000 });
    expect(inputs.map((value) => value.actionPressed)).toEqual([true, false]);
    expect(session).toEqual(before);
    menu.remove();
    control.step({ frames: 1, deltaMs: 1000 });
    expect(session.gameTime?.minute).toBe(1);
    expect(session.npcActivities?.scheduled).toBe("work");
    expect(session.eventLocations.scheduled?.direction).toBe("left");
    control.step({ frames: 59, deltaMs: 1000 });
    expect(session.npcActivities?.scheduled).toBe("rest");
    expect(session.eventLocations.scheduled?.direction).toBe("right");
  });

  it("rejects invalid requests before any scheduler, frame, or owner changes", async () => {
    const { session, loop, updates, scheduled } = await runtime(true);
    const control = hook();
    expect(() => control.step({ frames: 1, deltaMs: 1000 })).toThrow();
    expect(scheduled.size).toBe(1);
    control.pause();
    const before = structuredClone(session); const frame = loop.frame;
    for (const request of [
      { frames: 0, deltaMs: 16 }, { frames: -1, deltaMs: 16 }, { frames: 1.5, deltaMs: 16 },
      { frames: NaN, deltaMs: 16 }, { frames: Infinity, deltaMs: 16 }, { frames: 1_000_000, deltaMs: 16 },
      { frames: 1, deltaMs: 0 }, { frames: 1, deltaMs: -1 }, { frames: 1, deltaMs: NaN },
      { frames: 1, deltaMs: Infinity }, { frames: 1, deltaMs: 1_000_000 }, { frames: 1, deltaMs: 0.5 },
    ]) expect(() => control.step(request)).toThrow();
    expect(session).toEqual(before); expect(loop.frame).toBe(frame); expect(updates).toEqual([]); expect(scheduled.size).toBe(0);
  });

  it("observes completion before acknowledging, rejects reentry, and resumes realtime without catch-up", async () => {
    const { loop, events, updates, deliverFrame, scheduled } = await runtime(true);
    const control = hook(); control.pause(); loop.smoothStep = true;
    const receipts: unknown[] = [];
    const listener = (event: Event) => receipts.push((event as CustomEvent).detail);
    window.addEventListener("oprn:qa-frames", listener);
    cleanups.push(() => window.removeEventListener("oprn:qa-frames", listener));
    events.once("prestep", () => {
      expect(() => control.step({ frames: 1, deltaMs: 1000 })).toThrow();
      expect(() => control.resume()).toThrow();
    });
    const receipt = control.step({ frames: 2, deltaMs: 250 });
    expect(updates).toEqual([250, 250]); expect(receipts).toEqual([receipt]); expect(loop.smoothStep).toBe(true);
    control.resume(); expect(scheduled.size).toBe(1);
    const count = updates.length;
    deliverFrame(16);
    expect(updates).toHaveLength(count + 1);
    expect(updates.at(-1)).toBeLessThan(1000);
    expect(() => control.step({ frames: 1, deltaMs: 16 })).toThrow();
  });

  it("allows Phaser's deferred destruction to finish even while automatic frames are stopped", async () => {
    const { game, events, scheduled } = await runtime(true);
    const control = hook(); control.pause();
    let deadline: ReturnType<typeof setTimeout>;
    const destroyed = new Promise<void>((resolveDone, reject) => {
      deadline = setTimeout(() => reject(new Error("Missing Phaser destruction event")), 1000);
      events.once("destroy", resolveDone);
    });
    game.destroy(false);
    try { await destroyed; } finally { clearTimeout(deadline!); }
    expect(game.renderer.destroy).toHaveBeenCalledOnce();
    expect(scheduled.size).toBe(0);
    expect(Object.hasOwn(window, "__oprnQaFrames")).toBe(false);
    expect(() => control.resume()).toThrow();
  });

  it("quantizes only the sampling anchor so exact deadlines survive a fractional browser timestamp", async () => {
    const { loop, updates, session } = await runtime(true);
    loop.lastTime = 8191.123456789;
    const control = hook(); control.pause();
    control.step({ frames: 30, deltaMs: 1000 });
    expect(updates).toEqual(Array(30).fill(1000));
    expect(session.gameTime?.minute).toBe(30);
    expect(session.makerInstances?.job?.status).toBe("ready");
  });

  it("never reports a successful frame when Phaser is paused or its update throws; teardown revokes retained controls", async () => {
    const { game, events, loop } = await runtime(true);
    const control = hook(); control.pause(); game.isPaused = true;
    expect(() => control.step({ frames: 1, deltaMs: 16 })).toThrow();
    game.isPaused = false;
    events.once("prestep", () => { throw new Error("scene update failure"); });
    expect(() => control.step({ frames: 1, deltaMs: 16 })).toThrow("scene update failure");
    expect(loop.smoothStep).toBe(false);
    events.emit("destroy");
    expect(Object.hasOwn(window, "__oprnQaFrames")).toBe(false);
    expect(() => control.step({ frames: 1, deltaMs: 16 })).toThrow();
  });
});

// A Page/JSHandle transport adapter only. Browser callback bodies and event
// ordering execute unmodified against this DOM and the real Phaser loop above.
function transport() {
  const dispose = vi.fn();
  const page = {
    evaluate: async <T, A>(callback: (arg: A) => T, arg: A) => callback(arg),
    evaluateHandle: async <T, A>(callback: (arg: A) => T, arg: A) => {
      const entry = callback(arg);
      return { evaluate: async <R>(reader: (value: T) => R) => reader(entry), dispose };
    },
  };
  return { page: page as unknown as Page, dispose };
}
function frameDriver() {
  expect(runner.performObservedFrames, "runtime runner must expose observed frame stepping").toBeTypeOf("function");
  return runner.performObservedFrames;
}

describe("QA frame driver", () => {
  it("prearms receipt observation before native input and returns the completed frame state", async () => {
    const { session, inputs } = await runtime(true);
    hook().pause();
    Object.defineProperty(window, "__oprnDebug", { configurable: true, value: { readState: () => structuredClone(session) } });
    cleanups.push(() => { Reflect.deleteProperty(window, "__oprnDebug"); });
    const { page, dispose } = transport();
    const result = await frameDriver()(page, { frames: 2, deltaMs: 1000 }, async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "z" }));
    });
    expect(result.receipt.endFrame - result.receipt.startFrame).toBe(2);
    expect(result.state?.gameTime?.minute).toBe(2);
    expect(inputs.map((state) => state.actionPressed)).toEqual([true, false]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("keeps trigger errors and removes observation instead of stepping or fabricating success", async () => {
    const { updates } = await runtime(true); hook().pause();
    const { page, dispose } = transport();
    await expect(frameDriver()(page, { frames: 1, deltaMs: 16 }, async () => { throw new Error("native key failed"); })).rejects.toThrow("native key failed");
    expect(updates).toEqual([]); expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects malformed requests before even sending player input", async () => {
    await runtime(true); hook().pause();
    const { page } = transport(); const trigger = vi.fn();
    await expect(frameDriver()(page, { frames: 0, deltaMs: 16 }, trigger)).rejects.toThrow();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("normalizes bounded frame ops and rejects invalid control before a scenario can run", () => {
    const ops = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 30, deltaMs: 1000, key: "z" }, { kind: "resumeFrames" }];
    expect(normalizeScenario({ id: "ticks", beats: [{ id: "advance", ops }] } as never).beats[0]?.ops).toEqual(ops);
    expect(() => normalizeScenario({ id: "ticks", beats: [{ id: "advance", ops: [{ kind: "stepFrames", frames: 0, deltaMs: 16 }] }] } as never)).toThrow();
  });
});
