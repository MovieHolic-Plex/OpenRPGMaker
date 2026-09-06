// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { absoluteGameMinutes, collectMaker, startMaker } from "@/project/makers";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { calendarDayKey, type GameTime } from "@/project/gameTime";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { advanceTimeAcrossDayBoundaries, transitionToNextDay } from "@/player/dayTransition";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, saveSlotKey } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { LifeReconciliationError } from "@/project/lifeRecovery";
import type { PlaySceneContext } from "@/player/playSceneTypes";

// Only the visual fade endpoint is replaced; clocks, makers, recovery and storage are real.
vi.mock("@/player/playSceneMapCommands", () => ({ fadeCamera: async () => undefined, TRANSFER_FADE_DURATION_MS: 120 }));
import { applyAdvanceTimeStep, applySetTimeStep, sleepUntilMorningScene, updateGameTime } from "@/player/playSceneTime";

const previous = store.getCurrent();
afterEach(() => { store.replaceProject(previous); document.body.replaceChildren(); localStorage.clear(); });

function runtime(time?: GameTime) {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 40, minutesPerRealSecond: 1 };
  project.database.items.push(...["clock_input", "clock_output", "clock_bonus"].map((id) => normalizeItemRecord({ id, name: id, scope: "none", price: 1 })));
  project.system.makers = [{ id: "clock_maker", inputs: [{ itemId: "clock_input", count: 3 }], outputs: [{ itemId: "clock_output", count: 2 }, { itemId: "clock_bonus", count: 1 }], durationMinutes: 30 }];
  const session = startSession(project, 409);
  if (time) session.gameTime = time;
  session.inventory.clock_input = 6;
  expect(startMaker(project, session, "machine", "clock_maker", absoluteGameMinutes(session.gameTime!, project.system.timeSystem)).ok).toBe(true);
  store.replaceProject(project);
  const stage = document.createElement("div");
  stage.className = "play-stage";
  const canvas = document.createElement("canvas");
  stage.append(canvas);
  document.body.append(stage);
  const scene = {
    session, game: { canvas }, timeFixedAccumulatorMs: 0, timeMinuteAccumulator: 0, timeSleepInProgress: false,
    showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
  } as unknown as PlaySceneContext;
  scene.sleepUntilMorning = () => sleepUntilMorningScene(scene, async () => undefined);
  return { project, session, scene, stage };
}

function status(session: ReturnType<typeof startSession>) { return session.makerInstances?.machine?.status; }

describe("maker game-clock integration", () => {
  it("executes actual updateGameTime at minute 29 then 30, including split fixed frames", () => {
    const { scene, session } = runtime();
    updateGameTime(scene, 29_000);
    expect(session.gameTime).toMatchObject({ hour: 6, minute: 29 });
    expect(status(session)).toBe("processing");
    updateGameTime(scene, 999);
    expect(status(session)).toBe("processing");
    updateGameTime(scene, 1);
    expect(session.gameTime).toMatchObject({ hour: 6, minute: 30 });
    expect(status(session)).toBe("ready");
  });

  it.each(["natural", "command", "set-time", "sleep", "load"] as const)("has identical deadline readiness through %s", async (path) => {
    const { project, scene, session } = runtime({ year: 1, season: "winter", day: 40, hour: 25, minute: 30 });
    const contract = structuredClone(session.makerInstances?.machine?.contract);
    if (path === "natural") updateGameTime(scene, 30_000);
    if (path === "command") await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 30 });
    if (path === "set-time") applySetTimeStep(scene, { kind: "setTime", hour: 26, minute: 0 });
    if (path === "sleep") expect(await scene.sleepUntilMorning()).toBe(true);
    let result = session;
    if (path === "load") {
      // Historical processing save at the deadline, not a fabricated ready result.
      session.gameTime = { ...session.gameTime!, hour: 26, minute: 0 };
      const before = structuredClone(session);
      expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
      expect(session).toEqual(before);
      const read = readSaveSlot(localStorage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("missing slot");
      result = applySaveSnapshot(project, read.snapshot);
    }
    expect(status(result)).toBe("ready");
    expect(result.makerInstances?.machine?.contract).toEqual(contract);
    expect(result.inventory.clock_output).toBeUndefined();
  });

  it("finishes a deadline in the residual minutes after a large multi-day delta", () => {
    const { project, scene, session } = runtime();
    project.system.makers![0] = { ...project.system.makers![0]!, durationMinutes: 2430 };
    expect(startMaker(project, session, "long", "clock_maker", 0).ok).toBe(true);
    store.replaceProject(project);
    updateGameTime(scene, 2_430_000);
    expect(session.gameTime).toMatchObject({ day: 3, hour: 6, minute: 30 });
    expect(session.makerInstances?.long?.status).toBe("ready");
    expect(status(session)).toBe("ready");
  });

  it("does not consume menu-open real elapsed frames or catch them up on close", () => {
    const { scene, session, stage } = runtime();
    updateGameTime(scene, 29_500);
    const menu = document.createElement("div");
    menu.dataset.testid = "main-menu";
    stage.append(menu);
    const before = structuredClone(session);
    updateGameTime(scene, 600_000);
    expect(session).toEqual(before);
    expect(scene.timeFixedAccumulatorMs).toBe(500);
    menu.remove();
    updateGameTime(scene, 499);
    expect(status(session)).toBe("processing");
    updateGameTime(scene, 1);
    expect(status(session)).toBe("ready");
  });

  it("zero minutes and frames leave every owner and object identity unchanged", async () => {
    const { project, scene, session } = runtime();
    session.gameTime = { ...session.gameTime!, minute: 30 };
    const before = structuredClone(session);
    const owners = { time: session.gameTime, inventory: session.inventory, makers: session.makerInstances };
    expect(advanceTimeAcrossDayBoundaries(project, session, 0).ok).toBe(true);
    await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 0 });
    updateGameTime(scene, 0);
    expect(session).toEqual(before);
    expect(session.gameTime).toBe(owners.time);
    expect(session.inventory).toBe(owners.inventory);
    expect(session.makerInstances).toBe(owners.makers);
  });

  it("never demotes ready on backward set-time or load and pays frozen outputs once", () => {
    const { project, scene, session } = runtime();
    const promise = structuredClone(session.makerInstances?.machine?.contract);
    project.system.makers![0] = { id: "clock_maker", inputs: [], outputs: [{ itemId: "clock_output", count: 9 }], durationMinutes: 300 };
    store.replaceProject(project);
    applySetTimeStep(scene, { kind: "setTime", hour: 6, minute: 30 });
    applySetTimeStep(scene, { kind: "setTime", hour: 6, minute: 0 });
    expect(status(session)).toBe("ready");
    expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
    const read = readSaveSlot(localStorage, 1);
    if (read.kind !== "present") throw new Error("missing slot");
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(status(restored)).toBe("ready");
    expect(restored.makerInstances?.machine?.contract).toEqual(promise);
    restored.inventory.clock_bonus = ITEM_QUANTITY_MAX;
    const full = structuredClone(restored);
    expect(collectMaker(project, restored, "machine")).toMatchObject({ ok: false, reason: "inventory-overflow" });
    expect(restored).toEqual(full);
    delete restored.inventory.clock_bonus;
    expect(collectMaker(project, restored, "machine").ok).toBe(true);
    expect(restored.inventory.clock_output).toBe(2);
    expect(restored.inventory.clock_bonus).toBe(1);
    const collected = structuredClone(restored);
    expect(collectMaker(project, restored, "machine").ok).toBe(false);
    expect(restored).toEqual(collected);
  });

  it.each(["minute", "hour", "day", "year"] as const)("refuses an invalid %s without normalizing a live date or maker", (field) => {
    const { project, scene, session } = runtime();
    session.gameTime = { ...session.gameTime!, [field]: -1 };
    const before = structuredClone(session);
    expect(advanceTimeAcrossDayBoundaries(project, session, 1).ok).toBe(false);
    expect(session).toEqual(before);
    expect(transitionToNextDay(project, session, calendarDayKey(session.gameTime)).ok).toBe(false);
    expect(session).toEqual(before);
    updateGameTime(scene, 1_000);
    expect(session).toEqual(before);
    expect(() => applySetTimeStep(scene, { kind: "setTime", hour: 7 })).toThrow();
    expect(session).toEqual(before);
  });

  it("retains runner command minutes when set-time starts exactly at day end", () => {
    const { project } = runtime();
    project.maps[project.startMapId]!.events = [{
      id: "clock_event", x: 0, y: 0, trigger: { kind: "action" },
      commands: [{ kind: "setTime", hour: 26, minute: 0 }, { kind: "advanceTime", minutes: 30 }],
    }];
    const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 }, steps: [{ kind: "interact" }] });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.gameTime).toMatchObject({ day: 2, hour: 6, minute: 30 });
  });

  it.each([1, 30])("preserves forced sleep hook clock and readiness at rate %s", async (rate) => {
    const { project, scene, session } = runtime({ year: 1, season: "spring", day: 1, hour: 25, minute: 30 });
    project.system.timeSystem = { ...project.system.timeSystem!, forceSleep: true, minutesPerRealSecond: rate, onDayEnd: "forced_hook" };
    project.commonEvents.push({ id: "forced_hook", name: "hook", trigger: "none", commands: [{ kind: "wait", ms: 0 }] });
    let hookTime: GameTime | undefined;
    store.replaceProject(project);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let resolveSleep: (value: boolean) => void = () => undefined;
    let rejectSleep: (error: unknown) => void = () => undefined;
    const completed = new Promise<boolean>((resolve, reject) => {
      resolveSleep = resolve;
      rejectSleep = reject;
      timeout = setTimeout(() => reject(new Error("forced sleep completion missing")), 1000);
    });
    scene.sleepUntilMorning = async () => {
      try {
        const result = await sleepUntilMorningScene(scene, async () => { hookTime = structuredClone(session.gameTime); });
        resolveSleep(result);
        return result;
      } catch (error) { rejectSleep(error); throw error; }
    };
    try {
      updateGameTime(scene, 30_000 / rate);
      expect(await completed).toBe(true);
      expect(hookTime).toMatchObject({ hour: 25, minute: rate === 1 ? 59 : 30 });
      expect(status(session)).toBe("ready");
      expect(session.gameTime).toMatchObject({ day: 2, hour: 6, minute: 0 });
    } finally { clearTimeout(timeout); }
  });

  it("advances command minutes at 29 then 30 without a day boundary", async () => {
    const { scene, session } = runtime();
    await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 29 });
    expect(status(session)).toBe("processing");
    await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 1 });
    expect(session.gameTime).toMatchObject({ day: 1, hour: 6, minute: 30 });
    expect(status(session)).toBe("ready");
  });

  it("rolls back an entire authored multi-day command when its second hook fails", async () => {
    const { project, scene, session } = runtime();
    project.system.timeSystem = { ...project.system.timeSystem!, onDayEnd: "clock_hook" };
    project.commonEvents.push({ id: "clock_hook", name: "hook", trigger: "none", commands: [{ kind: "wait", ms: 0 }] });
    store.replaceProject(project);
    let calls = 0;
    scene.sleepUntilMorning = () => sleepUntilMorningScene(scene, async () => {
      calls += 1;
      session.gold += 1;
      if (calls === 2) throw new Error("second hook fails");
    });
    const before = structuredClone(session);
    await expect(applyAdvanceTimeStep(scene, { kind: "advanceTime", days: 2, minutes: 1 })).rejects.toThrow();
    expect(calls).toBe(2);
    expect(session).toEqual(before);
    expect(scene.showRuntimeOverlay).toHaveBeenCalled();
  });

  it.each([-1, Number.NaN, Number.MAX_SAFE_INTEGER])("rejects an unusable saved maker clock (%s) before writer/parser/apply loss", (year) => {
    const { project, session } = runtime();
    const snapshot = createSaveSnapshot(project, session);
    expect(saveToSlot(localStorage, 1, snapshot).ok).toBe(true);
    const slot = localStorage.getItem(saveSlotKey(1));
    session.gameTime = { ...session.gameTime!, year };
    const before = structuredClone(session);
    expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
    expect(localStorage.getItem(saveSlotKey(1))).toBe(slot);
    expect(session).toEqual(before);
    const invalid = { ...snapshot, session: { ...snapshot.session, gameTime: session.gameTime } };
    expect(() => applySaveSnapshot(project, invalid)).toThrow(LifeReconciliationError);
    localStorage.setItem(saveSlotKey(1), JSON.stringify(invalid));
    const raw = localStorage.getItem(saveSlotKey(1));
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(localStorage.getItem(saveSlotKey(1))).toBe(raw);
    expect(session).toEqual(before);
  });

  it("retains legacy normal collection without inventing spent-input refunds", async () => {
    const { project, scene, session } = runtime();
    const { contract: _firstContract, ...legacyReady } = session.makerInstances!.machine!;
    session.makerInstances!.machine = legacyReady;
    await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 30 });
    expect(status(session)).toBe("ready");
    expect(collectMaker(project, session, "machine").ok).toBe(true);
    expect(session.inventory.clock_output).toBe(2);
    expect(startMaker(project, session, "machine", "clock_maker", 30).ok).toBe(true);
    const { contract: _secondContract, ...legacyProcessing } = session.makerInstances!.machine!;
    session.makerInstances!.machine = legacyProcessing;
    const original = structuredClone(session.makerInstances?.machine);
    project.system.makers = [];
    store.replaceProject(project);
    await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 1 });
    expect(session.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [], unresolved: { record: original } });
    expect(session.inventory.clock_input).toBeUndefined();
    expect(session.inventory.clock_output).toBe(2);
  });

  it("discards a ready draft and recovery prefix when capacity refuses set-time", () => {
    const { project, scene, session } = runtime();
    session.lifeRecovery = { nextSequence: 4097, claims: Object.fromEntries(Array.from({ length: 4096 }, (_, i) => [`recovery:${i + 1}`, { id: `recovery:${i + 1}`, sourceKind: "makerInstances", sourceId: `old:${i}`, reason: "removed", items: [{ itemId: "clock_input", count: 1 }] }])) };
    project.system.makers = [];
    store.replaceProject(project);
    const before = structuredClone(session);
    expect(() => applySetTimeStep(scene, { kind: "setTime", hour: 20 })).toThrow();
    expect(session).toEqual(before);
  });

  it("rolls back the whole large natural frame if a later day stage fails", () => {
    const { project, scene, session } = runtime();
    project.system.energy = { max: 100, initial: 10, restorePerDay: -1 };
    store.replaceProject(project);
    const before = structuredClone(session);
    updateGameTime(scene, 1_201_000);
    expect(scene.showRuntimeOverlay).toHaveBeenCalled();
    expect(session).toEqual(before);
  });

  it("rolls back completed frame minutes when actual forced sleep refuses", async () => {
    const { project, scene, session } = runtime();
    project.system.timeSystem = { ...project.system.timeSystem!, forceSleep: true };
    project.system.energy = { max: 100, initial: 10, restorePerDay: -1 };
    store.replaceProject(project);
    const before = structuredClone(session);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const failure = new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("forced sleep refusal missing")), 1000);
      scene.showRuntimeOverlay = (_id, message) => { if (message.includes("forced-sleep")) resolve(); };
    });
    try {
      updateGameTime(scene, 1_201_000);
      await failure;
      expect(session).toEqual(before);
    } finally { clearTimeout(timeout); }
  });

  it.each([29, 30])("uses the pre-change original clock at minute %s for cancellation, not the new target", (minute) => {
    const { project, scene, session } = runtime();
    session.gameTime = { ...session.gameTime!, minute };
    project.system.timeSystem = { ...project.system.timeSystem!, dayStartHour: 8, daysPerSeason: 28 };
    store.replaceProject(project);
    applySetTimeStep(scene, { kind: "setTime", hour: 20 });
    expect(session.makerInstances).toEqual({});
    expect(session.lifeRecovery?.claims["recovery:1"]?.items).toEqual(minute === 29 ? [{ itemId: "clock_input", count: 3 }] : [{ itemId: "clock_output", count: 2 }, { itemId: "clock_bonus", count: 1 }]);
    expect(session.inventory.clock_output).toBeUndefined();
  });
});
