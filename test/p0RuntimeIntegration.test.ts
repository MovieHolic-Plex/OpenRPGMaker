import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createFarmingDemoProject } from "@/project/defaults";
import { absoluteGameMinutes } from "@/project/makers";
import { placeableKey } from "@/project/placeables";
import { calendarDayKey } from "@/project/gameTime";
import { startSession } from "@/project/session";
import { farmPlotAt, interactWithFarmPlot } from "@/player/farming";
import { advanceTimeAcrossDayBoundaries, transitionToNextDay } from "@/player/dayTransition";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { settleShipping } from "@/project/shipping";
import { runSceneTest } from "@/testing/sceneTestRunner";

function runtimeProject() {
  const project = createFarmingDemoProject();
  const addItem = (id: string, name: string, farmTool?: "axe" | "hoe" | "pickaxe") => {
    const record = normalizeItemRecord({ id, name, scope: "none", price: 100, farmTool });
    const index = project.database.items.findIndex((item) => item.id === id);
    if (index >= 0) project.database.items[index] = record;
    else project.database.items.push(record);
  };
  addItem("item_gold_hoe", "황금 괭이", "hoe");
  addItem("item_axe", "도끼", "axe");
  addItem("item_pickaxe", "곡괭이", "pickaxe");
  project.system.energy = { max: 100, initial: 100, restorePerDay: 40 };
  project.system.shipping = { enabled: true, allowedItemIds: ["item_potato"] };
  project.system.makers = [{
    id: "maker_preserves",
    name: "숙성 통",
    inputs: [{ itemId: "item_potato_seed", count: 1 }],
    outputs: [{ itemId: "item_potato", count: 1 }],
    durationMinutes: 30,
  }];
  project.system.skillSystem = { enabled: true };
  project.database.lifeSkills = [
    { id: "life_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] },
    { id: "life_mining", name: "채광", skillType: "mining", maxLevel: 10, levelUpRewards: [] },
    { id: "life_foraging", name: "채집", skillType: "foraging", maxLevel: 10, levelUpRewards: [] },
  ];
  project.system.itemUpgrades = [{
    id: "upgrade_gold_hoe",
    fromItemId: "item_hoe",
    toItemId: "item_gold_hoe",
    capability: { areaWidth: 3, areaHeight: 1, energyMultiplier: 0.5 },
  }];
  return project;
}

describe("P0 day transition integration", () => {
  it("settles, advances calendar and farm, restores energy, then advances makers in one receipt", () => {
    const project = runtimeProject();
    const session = startSession(project, 101);
    const system = project.system.timeSystem!;
    session.gameTime = { year: 1, season: "spring", day: 28, hour: 25, minute: 30 };
    session.farmPlotsAdvancedThrough = { year: 1, season: "spring", day: 28 };
    session.farmPlots = {
      [project.startMapId]: {
        "4,5": { tilled: true, watered: true, cropId: "crop_potato", stage: 0, growthDays: 0 },
      },
    };
    session.energy = 10;
    session.shippingQueue = { item_potato: 2 };
    const before = absoluteGameMinutes(session.gameTime, system);
    session.makerInstances = {
      "farm:5,5": {
        instanceId: "farm:5,5",
        makerId: "maker_preserves",
        status: "processing",
        startedAtMinute: before - 10,
        readyAtMinute: before + 30,
      },
    };
    const sourceDayKey = calendarDayKey(session.gameTime);

    const result = transitionToNextDay(project, session, sourceDayKey);

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        sourceDayKey,
        destinationDayKey: "1:summer:1",
        stages: ["shipping", "calendar", "dailyWeather", "rainWatering", "farm", "energy", "makers", "animals"],
      },
    });
    expect(session.shippingQueue).toEqual({});
    expect(session.shippingLastSettledDayKey).toBe(sourceDayKey);
    expect(session.gameTime).toEqual({ year: 1, season: "summer", day: 1, hour: 6, minute: 0 });
    expect(farmPlotAt(session, project.startMapId, 4, 5)?.dead).toBe(true);
    expect(session.energy).toBe(50);
    expect(session.makerInstances?.["farm:5,5"]?.status).toBe("ready");

    const frozen = structuredClone(session);
    expect(transitionToNextDay(project, session, sourceDayKey)).toMatchObject({ ok: false, reason: "already-transitioned" });
    expect(session).toEqual(frozen);
  });

  it("fails closed when a stale queue or maker record is encountered", () => {
    const project = runtimeProject();
    const session = startSession(project, 102);
    const sourceDayKey = calendarDayKey(session.gameTime!);
    session.shippingQueue = { item_deleted: 1 };
    const frozen = structuredClone(session);
    expect(transitionToNextDay(project, session, sourceDayKey)).toMatchObject({ ok: false, reason: "shipping" });
    expect(session).toEqual(frozen);

    session.shippingQueue = {};
    session.makerInstances = {
      stale: { instanceId: "stale", makerId: "maker_deleted", status: "processing", startedAtMinute: 0, readyAtMinute: 1 },
    };
    const makerFrozen = structuredClone(session);
    expect(transitionToNextDay(project, session, sourceDayKey)).toMatchObject({ ok: false, reason: "makers" });
    expect(session).toEqual(makerFrozen);
  });

  it("persists the exact-once transition key through the shared save path", () => {
    const project = runtimeProject();
    const session = startSession(project, 103);
    const key = calendarDayKey(session.gameTime!);
    expect(transitionToNextDay(project, session, key).ok).toBe(true);
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.dayTransitionLastDayKey).toBe(key);
  });

  it("routes a natural clock boundary through the same receipt path", () => {
    const project = runtimeProject();
    const session = startSession(project, 104);
    session.gameTime = { year: 1, season: "spring", day: 3, hour: 25, minute: 50 };
    session.energy = 5;
    session.shippingQueue = { item_potato: 1 };

    const result = advanceTimeAcrossDayBoundaries(project, session, 25);

    expect(result).toMatchObject({
      ok: true,
      receipts: [{ sourceDayKey: "1:spring:3", destinationDayKey: "1:spring:4" }],
      time: { year: 1, season: "spring", day: 4, hour: 6, minute: 15 },
    });
    expect(session.shippingLastSettledDayKey).toBe("1:spring:3");
    expect(session.energy).toBe(45);
  });

  it("handles zero elapsed time and an exact boundary without skipping or duplicating a day", () => {
    const project = runtimeProject();
    const session = startSession(project, 105);
    session.gameTime = { year: 1, season: "spring", day: 7, hour: 25, minute: 50 };
    const frozen = structuredClone(session);
    expect(advanceTimeAcrossDayBoundaries(project, session, 0)).toMatchObject({ ok: true, receipts: [] });
    expect(session).toEqual(frozen);

    expect(advanceTimeAcrossDayBoundaries(project, session, 10)).toMatchObject({
      ok: true,
      time: { year: 1, season: "spring", day: 8, hour: 6, minute: 0 },
      receipts: [{ sourceDayKey: "1:spring:7", destinationDayKey: "1:spring:8" }],
    });
  });

  it("advances a day whose shipping was already settled but has no transition cursor", () => {
    const project = runtimeProject();
    const session = startSession(project, 106);
    const key = calendarDayKey(session.gameTime!);
    session.shippingQueue = { item_potato: 1 };
    expect(settleShipping(project, session, key).ok).toBe(true);
    expect(session.dayTransitionLastDayKey).toBeUndefined();

    expect(transitionToNextDay(project, session, key)).toMatchObject({
      ok: true,
      receipt: { shipping: { ok: false, reason: "already-settled" } },
    });
    expect(session.dayTransitionLastDayKey).toBe(key);
    expect(session.gameTime?.day).toBe(2);
  });

  it("continues the day transition when authored daily energy restore is zero", () => {
    const project = runtimeProject();
    project.system.energy = { max: 100, initial: 25, restorePerDay: 0 };
    const session = startSession(project, 107);
    const sourceDayKey = calendarDayKey(session.gameTime!);

    expect(transitionToNextDay(project, session, sourceDayKey)).toMatchObject({
      ok: true,
      receipt: { energy: { ok: true, before: 25, after: 25, restored: 0 } },
    });
    expect(session.gameTime?.day).toBe(2);
    expect(session.dayTransitionLastDayKey).toBe(sourceDayKey);
  });

  it("drops malformed, current-day, and non-adjacent save cursors while retaining the previous day", () => {
    const project = runtimeProject();
    const session = startSession(project, 108);
    session.gameTime = { year: 1, season: "spring", day: 8, hour: 12, minute: 0 };
    const snapshot = createSaveSnapshot(project, session);

    const restoreWithCursor = (dayTransitionLastDayKey: string) => applySaveSnapshot(project, {
      ...snapshot,
      session: { ...snapshot.session, dayTransitionLastDayKey },
    }).dayTransitionLastDayKey;

    expect(restoreWithCursor("1:spring:7")).toBe("1:spring:7");
    expect(restoreWithCursor("1:spring:8")).toBeUndefined();
    expect(restoreWithCursor("1:spring:6")).toBeUndefined();
    expect(restoreWithCursor("01:spring:7")).toBeUndefined();
    expect(restoreWithCursor("1:monsoon:7")).toBeUndefined();
    expect(restoreWithCursor("1:spring:7:poison")).toBeUndefined();
  });

  it("restores a cursor across a project-specific season boundary", () => {
    const project = runtimeProject();
    project.system.timeSystem = { ...project.system.timeSystem!, daysPerSeason: 40 };
    const session = startSession(project, 109);
    session.gameTime = { year: 1, season: "summer", day: 1, hour: 6, minute: 0 };
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, {
      ...snapshot,
      session: { ...snapshot.session, dayTransitionLastDayKey: "1:spring:40" },
    });

    expect(restored.dayTransitionLastDayKey).toBe("1:spring:40");
  });

  it("gives the scene test runner the same day-transition authority at exact boundaries", () => {
    const project = runtimeProject();
    project.system.energy = { max: 100, initial: 10, restorePerDay: 40 };

    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: project.startX, y: project.startY },
      steps: [{ kind: "advanceDays", days: 2 }],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.gameTime).toMatchObject({ year: 1, season: "spring", day: 3, hour: 6, minute: 0 });
    expect(result.session.shippingLastSettledDayKey).toBe("1:spring:2");
    expect(result.session.shippingHistory?.map((entry) => entry.dayKey)).toEqual(["1:spring:1", "1:spring:2"]);
    expect(result.session.energy).toBe(90);
    expect(result.session.makerInstances).toEqual({});
    expect(result.session.dayTransitionLastDayKey).toBe("1:spring:2");
  });

  it("routes the scene test runner's natural exact clock boundary through the authority", () => {
    const project = runtimeProject();
    project.system.timeSystem = {
      enabled: true,
      dayStartHour: 6,
      dayEndHour: 26,
      daysPerSeason: 28,
      minutesPerRealSecond: 1_200,
    };
    project.system.energy = { max: 100, initial: 15, restorePerDay: 20 };

    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: project.startX, y: project.startY },
      steps: [{ kind: "wait", ticks: 63 }],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.gameTime).toMatchObject({ year: 1, season: "spring", day: 2, hour: 6, minute: 0 });
    expect(result.session.shippingLastSettledDayKey).toBe("1:spring:1");
    expect(result.session.energy).toBe(35);
    expect(result.session.dayTransitionLastDayKey).toBe("1:spring:1");
  });

  it("does not calculate absolute maker time when the maker package is disabled", () => {
    // Break caught: a disabled maker package still evaluates absoluteGameMinutes and throws on overflow.
    const project = runtimeProject();
    delete project.system.makers;
    delete project.database.farmAnimalSpecies;
    delete project.system.farmAnimalBuildings;
    delete project.session.farmAnimals;
    const session = startSession(project, 110);
    session.gameTime = { year: 1e300, season: "spring", day: 2, hour: 6, minute: 0 };
    const sourceDayKey = calendarDayKey(session.gameTime);

    expect(() => transitionToNextDay(project, session, sourceDayKey)).not.toThrow();
    expect(session.gameTime?.day).toBe(3);
  });

  it("fails the maker stage atomically when absolute game time still overflows", () => {
    // Break caught: a hostile live session escapes save validation and throws midway through the draft receipt.
    const project = runtimeProject();
    const session = startSession(project, 111);
    session.gameTime = { year: 1e300, season: "spring", day: 2, hour: 6, minute: 0 };
    const sourceDayKey = calendarDayKey(session.gameTime);
    const frozen = structuredClone(session);

    expect(transitionToNextDay(project, session, sourceDayKey)).toEqual({
      ok: false,
      reason: "makers",
      stage: "makers",
    });
    expect(session).toEqual(frozen);
  });
});

describe("P0 farm action integration", () => {
  it("applies upgraded tool area and multiplier atomically", () => {
    const project = runtimeProject();
    const session = startSession(project, 201);
    const map = project.maps[project.startMapId]!;
    session.inventory.item_gold_hoe = 1;
    session.equippedToolItemId = "item_gold_hoe";
    session.energy = 2;

    const result = interactWithFarmPlot(project, session, map, 5, 5, "till");

    expect(result).toMatchObject({ kind: "tilled", energySpent: 2 });
    expect(result.affectedTiles).toEqual([
      { x: 4, y: 5, kind: "tilled" },
      { x: 5, y: 5, kind: "tilled" },
      { x: 6, y: 5, kind: "tilled" },
    ]);
    expect(session.energy).toBe(0);
    for (const x of [4, 5, 6]) expect(farmPlotAt(session, map.id, x, 5)?.tilled).toBe(true);
  });

  it("changes no tile, inventory, placeable, energy, or XP when energy is insufficient", () => {
    const project = runtimeProject();
    const session = startSession(project, 202);
    const map = project.maps[project.startMapId]!;
    session.inventory.item_gold_hoe = 1;
    session.equippedToolItemId = "item_gold_hoe";
    session.energy = 1;
    const frozen = structuredClone(session);

    expect(interactWithFarmPlot(project, session, map, 5, 5, "till")).toMatchObject({
      kind: "ignored",
      reason: "insufficient-energy",
    });
    expect(session).toEqual(frozen);
  });

  it("awards XP only for successful crop, rock, and tree harvests", () => {
    const project = runtimeProject();
    const session = startSession(project, 203);
    const map = project.maps[project.startMapId]!;
    session.energy = 20;
    session.farmPlots = {
      [map.id]: {
        "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 2, growthDays: 2 },
      },
    };
    session.equippedToolItemId = undefined;
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("harvested");
    expect(session.lifeSkills?.life_farming?.xp).toBe(10);

    session.placeables![placeableKey(map.id, 6, 5)] = { kind: "rock" };
    session.inventory.item_pickaxe = 1;
    session.equippedToolItemId = "item_pickaxe";
    expect(interactWithFarmPlot(project, session, map, 6, 5).kind).toBe("harvested");
    expect(session.lifeSkills?.life_mining?.xp).toBe(10);

    session.placeables![placeableKey(map.id, 7, 5)] = { kind: "tree" };
    session.inventory.item_axe = 1;
    session.equippedToolItemId = "item_axe";
    expect(interactWithFarmPlot(project, session, map, 7, 5).kind).toBe("harvested");
    expect(session.lifeSkills?.life_foraging?.xp).toBe(10);

    const xp = structuredClone(session.lifeSkills);
    expect(interactWithFarmPlot(project, session, map, 7, 5)).toMatchObject({ kind: "ignored" });
    expect(session.lifeSkills).toEqual(xp);
  });
});
