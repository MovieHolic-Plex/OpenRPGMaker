import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { clearRuntimeOverlay, showRuntimeOverlay } from "@/player/playSceneOverlays";
import { presentDayTransitionFailure, sleepUntilMorningScene } from "@/player/playSceneTime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { FakeElement, installFakeDom } from "./fakeDom";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function runtime(command: Command, malformed = true) {
  const restoreDom = installFakeDom();
  const previous = store.getCurrent();
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.shipping = { enabled: true };
  project.database.items.push(normalizeItemRecord({ id: "raw", name: "Raw", scope: "none", price: 1 }));
  project.commonEvents = [{
    id: "scheduled", name: "Scheduled", trigger: "parallel",
    commands: [command, { kind: "setSwitch", switchId: "continued", value: true }],
  }];
  const session = startSession(project, 1605);
  session.commonEvents = project.commonEvents;
  session.gameTime = { year: 1, season: "spring", day: 1, hour: 25, minute: 50 };
  // Reconciliation boundary arrangement, not a valid Save5 or injected live-player fixture.
  session.shippingQueue = malformed ? { item_deleted: -1 } : {};
  session.lifeRecovery = { nextSequence: 2, claims: {
    "recovery:1": { id: "recovery:1", sourceKind: "shippingQueue", sourceId: "raw", reason: "disabled", items: [{ itemId: "raw", count: 3 }] },
  } };
  store.replaceProject(project);
  const host = document.createElement("div");
  document.body.append(host);
  const openLedger = vi.fn();
  const cameraEvents = new Map<string, () => void>();
  const scene = {
    session, parallelProcesses: new Map(), activeRuntimeEvents: () => [],
    timeFixedAccumulatorMs: 0, timeMinuteAccumulator: 0, timeSleepInProgress: false,
    game: { canvas: { parentElement: null, ownerDocument: document }, registry: {
      get: (key: string) => key === "dialogueHost" ? host : key === "openLifeRecoveryLedger" ? openLedger : undefined,
    } },
    // Camera boundary emits the exact pre-subscribed completion; no timer or mocked transition.
    cameras: { main: {
      once: (name: string, done: () => void) => cameraEvents.set(name, done),
      fadeOut: () => cameraEvents.get("camerafadeoutcomplete")!(),
      fadeIn: () => cameraEvents.get("camerafadeincomplete")!(),
    } },
    refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
    showRuntimeOverlay: (id: string, text: string) => showRuntimeOverlay(scene, id, text),
    clearRuntimeOverlay: (id: string) => clearRuntimeOverlay(scene, id),
  } as unknown as PlaySceneContext;
  const hook = vi.fn(async (_commands: readonly Command[]) => undefined);
  scene.sleepUntilMorning = (...args: Parameters<PlaySceneContext["sleepUntilMorning"]>) => sleepUntilMorningScene(scene, hook, ...args);
  cleanups.push(() => {
    clearRuntimeOverlay(scene, "day-transition-error");
    host.remove();
    store.replaceProject(previous);
    restoreDom();
  });
  return { scene, session, project, host, openLedger, hook };
}

function startParallel(scene: PlaySceneContext) {
  updateParallelEvents(scene, 0);
  const process = scene.parallelProcesses.get("common:scheduled");
  if (!process?.pendingTimeTransition) throw new Error("missing scheduled transition");
  return { process, pending: process.pendingTimeTransition };
}

function errorOverlay(host: HTMLElement): FakeElement {
  const overlay = host.querySelector("[data-testid='day-transition-error']");
  if (!(overlay instanceof FakeElement)) throw new Error("missing date-error overlay");
  return overlay;
}

function key(root: FakeElement, value: string) {
  root.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), {
    key: value, repeat: false, isComposing: false,
  }));
}

function expectRich(overlay: FakeElement) {
  expect(overlay.getAttribute("data-stage")).toBe("recovery");
  expect(overlay.getAttribute("data-problem-id")).toBe("shippingQueue/item_deleted");
  expect(overlay.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
  expect(overlay.getAttribute("data-recovery-actionable")).toBe("true");
  expect(overlay.querySelector("[data-testid='day-transition-recovery-entry']")).not.toBeNull();
}

function expectDisposed(overlay: FakeElement) {
  expect(overlay.isConnected).toBe(false);
  expect(overlay.hasListener("keydown")).toBe(false);
  expect(overlay.hasListener("focusin")).toBe(false);
}

const stale = { reason: "old", stage: "makers", problemId: "maker/stale" };

describe("composed scheduled date diagnostics", () => {
  it.each([
    ["sleep false", { kind: "sleepUntilMorning" }],
    ["advance rejection", { kind: "advanceTime", minutes: 20 }],
    ["nested day-advance rejection", { kind: "advanceTime", days: 1 }],
  ] as const)("retains structured markers and owned recovery cursor after %s", async (_name, command) => {
    const { scene, session, host, openLedger, hook } = runtime(command);
    const before = structuredClone(session);
    const { process, pending } = startParallel(scene);
    await expect(pending).resolves.toBe(false);
    expect(session).toEqual(before);
    expect(process.stopped).toBe(true);
    expect(process.pendingTimeTransition).toBeUndefined();
    expect(scene.timeSleepInProgress).toBe(false);
    expect(hook).not.toHaveBeenCalled();
    const overlay = errorOverlay(host);
    expectRich(overlay);
    key(overlay, "Enter");
    expect(openLedger).toHaveBeenCalledTimes(1);
    expectDisposed(overlay);
    key(overlay, "Enter");
    expect(openLedger).toHaveBeenCalledTimes(1);
    expect(session).toEqual(before);
    updateParallelEvents(scene, 0);
    expect(session.switches.continued).toBeUndefined();
  });

  it.each(["false", "rejection"] as const)("replaces a stale diagnostic for an unpresented %s", async (outcome) => {
    const { scene, session, host, openLedger } = runtime({ kind: "sleepUntilMorning" });
    presentDayTransitionFailure(scene, stale);
    const old = errorOverlay(host);
    scene.sleepUntilMorning = async () => {
      if (outcome === "rejection") throw new Error("unpresented");
      return false;
    };
    const before = structuredClone(session);
    await expect(startParallel(scene).pending).resolves.toBe(false);
    const overlay = errorOverlay(host);
    expect(overlay).not.toBe(old);
    expect(overlay.getAttribute("data-stage")).toBeNull();
    expect(overlay.getAttribute("data-problem-id")).toBeNull();
    expect(overlay.getAttribute("data-recovery-actionable")).toBe("true");
    expectDisposed(old);
    key(old, "Enter");
    expect(openLedger).not.toHaveBeenCalled();
    key(overlay, "Escape");
    expectDisposed(overlay);
    expect(openLedger).not.toHaveBeenCalled();
    expect(session).toEqual(before);
  });

  it.each(["false", "rejection"] as const)("presents fallback for a fresh unpresented %s", async (outcome) => {
    const { scene, host, session } = runtime({ kind: "sleepUntilMorning" });
    scene.sleepUntilMorning = async () => {
      if (outcome === "rejection") throw new Error("unpresented");
      return false;
    };
    const before = structuredClone(session);
    await expect(startParallel(scene).pending).resolves.toBe(false);
    const overlay = errorOverlay(host);
    expect(overlay.getAttribute("data-stage")).toBeNull();
    expect(overlay.getAttribute("data-problem-id")).toBeNull();
    expect(overlay.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
    expect(session).toEqual(before);
  });

  it.each([
    { kind: "sleepUntilMorning" }, { kind: "advanceTime", minutes: 1 },
  ] as const)("clears prior diagnostics and resumes after real $kind success", async (command) => {
    const { scene, session, host, openLedger } = runtime(command, false);
    presentDayTransitionFailure(scene, stale);
    const old = errorOverlay(host);
    const claims = structuredClone(session.lifeRecovery);
    const inventory = structuredClone(session.inventory);
    await expect(startParallel(scene).pending).resolves.toBe(true);
    expect(host.querySelector("[data-testid='day-transition-error']")).toBeNull();
    expectDisposed(old);
    key(old, "Enter");
    expect(openLedger).not.toHaveBeenCalled();
    expect(session.switches.continued).toBe(true);
    expect(scene.parallelProcesses.size).toBe(0);
    expect(session.lifeRecovery).toEqual(claims);
    expect(session.inventory).toEqual(inventory);
  });

  it("retains a nested forced-sleep failure through scheduled advance", async () => {
    const { scene, session, project, host } = runtime({ kind: "advanceTime", minutes: 20 });
    project.system.timeSystem = { ...project.system.timeSystem, enabled: true, forceSleep: true };
    store.replaceProject(project);
    const before = structuredClone(session);
    await expect(startParallel(scene).pending).resolves.toBe(false);
    expectRich(errorOverlay(host));
    expect(session).toEqual(before);
  });

  it("presents fallback for an unpresented real advance rejection", async () => {
    const { scene, session, host } = runtime({ kind: "advanceTime", days: 1 }, false);
    scene.cameras.main.fadeOut = () => { throw new Error("camera failure"); };
    presentDayTransitionFailure(scene, stale);
    const old = errorOverlay(host);
    const before = structuredClone(session);
    await expect(startParallel(scene).pending).resolves.toBe(false);
    const overlay = errorOverlay(host);
    expect(overlay).not.toBe(old);
    expect(overlay.getAttribute("data-stage")).toBeNull();
    expect(overlay.getAttribute("data-problem-id")).toBeNull();
    expectDisposed(old);
    expect(session).toEqual(before);
  });

  it.each(["structured", "hook rejection"] as const)("keeps a presented %s failure after rollback and asynchronous fade-in", async (failure) => {
    const { scene, session, project, host, hook } = runtime({ kind: "sleepUntilMorning" }, false);
    project.system.timeSystem = { ...project.system.timeSystem, enabled: true, onDayEnd: "day-end" };
    project.commonEvents.push({ id: "day-end", name: "Day end", trigger: "none", commands: [{ kind: "setSwitch", switchId: "hook", value: true }] });
    store.replaceProject(project);
    hook.mockImplementation(async () => {
      session.gold += 123;
      session.inventory.raw = 7;
      session.shippingQueue = { item_deleted: -1 };
      if (failure === "hook rejection") throw new Error("hook-failed");
    });
    const faded = deferred<void>();
    const completeFade = scene.cameras.main.fadeIn;
    scene.cameras.main.fadeIn = () => { faded.resolve(); return scene.cameras.main; };
    const before = structuredClone(session);
    const { pending } = startParallel(scene);
    await faded.promise;
    const presented = errorOverlay(host);
    expect(session).toEqual(before);
    completeFade.call(scene.cameras.main);
    await expect(pending).resolves.toBe(false);
    expect(errorOverlay(host)).toBe(presented);
    if (failure === "structured") expectRich(presented);
    expect(session).toEqual(before);
    expect(scene.timeSleepInProgress).toBe(false);
  });

  it("does not overwrite a newer failure when an already-presented sleep finishes later", async () => {
    const { scene, session, project, host, hook } = runtime({ kind: "sleepUntilMorning" }, false);
    project.system.timeSystem = { ...project.system.timeSystem, enabled: true, onDayEnd: "day-end" };
    project.commonEvents.push({ id: "day-end", name: "Day end", trigger: "none", commands: [{ kind: "setSwitch", switchId: "hook", value: true }] });
    store.replaceProject(project);
    hook.mockImplementation(async () => { session.shippingQueue = { item_deleted: -1 }; });
    const faded = deferred<void>();
    const completeFade = scene.cameras.main.fadeIn;
    scene.cameras.main.fadeIn = () => { faded.resolve(); return scene.cameras.main; };
    const before = structuredClone(session);
    const { pending } = startParallel(scene);
    await faded.promise;
    const rich = errorOverlay(host);
    expectRich(rich);
    expect(session).toEqual(before);
    scene.parallelProcesses.delete("common:scheduled");
    // Real sleep's in-progress guard returns an unpresented false for the new operation.
    const replacement = startParallel(scene);
    await expect(replacement.pending).resolves.toBe(false);
    const newer = errorOverlay(host);
    expect(newer).not.toBe(rich);
    expect(newer.getAttribute("data-stage")).toBeNull();
    expectDisposed(rich);
    completeFade.call(scene.cameras.main);
    await expect(pending).resolves.toBe(false);
    expect(errorOverlay(host)).toBe(newer);
    expect(replacement.process.stopped).toBe(true);
    expect(session).toEqual(before);
  });

  it("does not attribute an overlapping operation's presentation to an unpresented failure", async () => {
    const { scene, session, host } = runtime({ kind: "sleepUntilMorning" });
    const held = deferred<boolean>();
    const realSleep = scene.sleepUntilMorning;
    const invoked = deferred<void>();
    scene.sleepUntilMorning = () => { invoked.resolve(); return held.promise; };
    const { pending } = startParallel(scene);
    await invoked.promise;
    // A replacement parallel process fails independently while the first is held.
    scene.parallelProcesses.delete("common:scheduled");
    scene.sleepUntilMorning = realSleep;
    const before = structuredClone(session);
    await expect(startParallel(scene).pending).resolves.toBe(false);
    const other = errorOverlay(host);
    expectRich(other);
    held.resolve(false);
    await expect(pending).resolves.toBe(false);
    const final = errorOverlay(host);
    expect(final).not.toBe(other);
    expect(final.getAttribute("data-stage")).toBeNull();
    expect(final.getAttribute("data-problem-id")).toBeNull();
    expectDisposed(other);
    expect(session).toEqual(before);
  });
});
