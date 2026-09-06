/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { advanceFarmPlotsForDay, cropReady, farmPlotAt, interactWithFarmPlot, syncFarmPlotsToDate } from "@/player/farming";
import { transitionToNextDay } from "@/player/dayTransition";
import { renderFarmOverlays } from "@/player/playSceneFarming";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { isFarmPlotsRecord } from "@/player/saveSlotValidation";
import { createFarmingDemoProject } from "@/project/defaults";
import { normalizeCropRecord } from "@/project/farmModel";
import { calendarDayKey } from "@/project/gameTime";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession, type FarmPlotState } from "@/project/session";
import type { CropRecord } from "@/project/types";

function fixture(harvestCount = 1, regrowDays = 10) {
  const project = createFarmingDemoProject();
  const original = project.database.crops?.[0];
  const map = project.maps[project.startMapId];
  if (!original || !map) throw new Error("Missing farming fixture");
  const crop = normalizeCropRecord({ ...original, harvestCount, stages: [{ days: 1 }, { days: 1 }],
    regrow: { days: regrowDays },
    graphicStages: [{ resourceId: "farming-crop-potato", frame: 0 }, { resourceId: "farming-crop-potato", frame: 1 }],
  });
  project.database.crops = [crop];
  project.system.dailyWeather = undefined;
  project.system.energy = { max: 100, initial: 100, restorePerDay: 100 };
  project.system.skillSystem = { enabled: false };
  const session = startSession(project, 707);
  const act = (intent?: "harvest" | "water" | "till") => interactWithFarmPlot(project, session, map, 4, 5, intent);
  const plot = () => {
    const result = farmPlotAt(session, map.id, 4, 5);
    if (!result) throw new Error("Missing planted plot");
    return result;
  };
  const nextDay = () => {
    if (!session.gameTime) throw new Error("Missing fixture date");
    expect(transitionToNextDay(project, session, calendarDayKey(session.gameTime))).toMatchObject({ ok: true });
  };
  const waterDay = () => { expect(act("water").kind).toBe("watered"); nextDay(); };
  expect(act().kind).toBe("tilled");
  expect(act().kind).toBe("planted");
  return { project, session, map, crop, act, plot, nextDay, waterDay };
}

function mature(f: ReturnType<typeof fixture>) {
  f.waterDay();
  expect(cropReady(f.project, f.plot())).toBe(false);
  f.waterDay();
  expect(cropReady(f.project, f.plot())).toBe(true);
}

function spriteFrame(crop: CropRecord, plot: FarmPlotState): string | number | undefined {
  let frame: string | number | undefined;
  renderFarmOverlays({
    map: { id: "render", width: 1, height: 1 },
    session: { farmPlots: { render: { "0,0": plot } } },
    tileLayer: { add: object => object },
    add: { sprite: (_x, _y, _texture, value) => { frame = value; return {}; } },
  }, [crop]);
  return frame;
}

beforeEach(() => localStorage.clear());

describe("exact crop regrowth contract", () => {
  describe.each([undefined, ITEM_QUANTITY_MAX])("zero yield with inventory %s", (inventory) => {
  it.each([0, 10])("treats zero yield as a successful harvest (regrow=%s)", (regrow) => {
    const f = fixture(0, regrow);
    expect(f.crop.harvestCount).toBe(0);
    mature(f);
    if (inventory !== undefined) f.session.inventory[f.crop.harvestItemId] = inventory;
    const before = structuredClone(f.session);
    expect(f.act("harvest")).toMatchObject({ kind: "harvested", count: 0, energySpent: 1, xpAwarded: {} });
    expect(f.session.inventory).toEqual(before.inventory);
    expect(f.session.collections).toEqual(before.collections);
    expect(f.session.lifeSkills).toEqual(before.lifeSkills);
    expect(f.session.energy).toBe(Number(before.energy) - 1);
    if (regrow === 0) expect(f.plot()).toEqual({ tilled: true, watered: false });
    else expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 });
  });

  });

  it("requires ten qualifying ticks after a two-day crop's harvest, including every displayed stage", () => {
    const f = fixture();
    expect(f.plot()).not.toHaveProperty("regrowDaysRemaining");
    mature(f);
    expect(f.plot()).not.toHaveProperty("regrowDaysRemaining");
    expect(f.act("harvest")).toMatchObject({ kind: "harvested", count: 1 });
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10, stage: 0, growthDays: 0 });
    for (let tick = 1; tick <= 10; tick += 1) {
      const before = structuredClone(f.session);
      expect(f.act("harvest")).toMatchObject({ kind: "ignored", reason: "nothing-to-harvest" });
      expect(f.session).toEqual(before);
      f.waterDay();
      expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 - tick });
      expect(cropReady(f.project, f.plot())).toBe(tick === 10);
      expect(spriteFrame(f.crop, f.plot())).toBe(tick === 10 ? 1 : 0);
    }
    expect(f.act("harvest")).toMatchObject({ kind: "harvested", count: 1 });
    expect(f.session.inventory[f.crop.harvestItemId]).toBe(2);
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 });
  });

  it("preserves remaining seven through actual Storage write/read/apply and resumes on the seventh tick", () => {
    const f = fixture(); mature(f); f.act("harvest");
    for (let tick = 0; tick < 3; tick += 1) f.waterDay();
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 7 });
    const before = structuredClone(f.session);
    expect(saveToSlot(localStorage, 1, createSaveSnapshot(f.project, f.session))).toEqual({ ok: true });
    const read = readSaveSlot(localStorage, 1);
    if (read.kind !== "present") throw new Error("Missing saved crop");
    expect(read.snapshot.schemaVersion).toBe(5);
    expect(f.project.version).toBe(4);
    expect(f.session).toEqual(before);
    const restored = applySaveSnapshot(f.project, read.snapshot);
    expect(restored.farmPlots).toEqual(before.farmPlots);
    Object.assign(f.session, restored);
    for (let tick = 1; tick <= 7; tick += 1) {
      f.waterDay();
      expect(f.plot()).toMatchObject({ regrowDaysRemaining: 7 - tick });
      expect(cropReady(f.project, f.plot())).toBe(tick === 7);
    }
  });

  it("does not grow on dry days or duplicate date synchronization", () => {
    const f = fixture(); mature(f); f.act("harvest"); f.nextDay();
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 });
    expect(f.act("water").kind).toBe("watered");
    const before = structuredClone(f.session);
    syncFarmPlotsToDate(f.project, f.session);
    expect(f.session).toEqual(before);
    f.nextDay();
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 9 });
  });

  it("preserves countdown when watered crops die out of season and never revives dead crops", () => {
    const f = fixture(); mature(f); f.act("harvest"); f.act("water");
    advanceFarmPlotsForDay(f.project, f.session, 1, "summer");
    expect(f.plot()).toMatchObject({ dead: true, watered: false, regrowDaysRemaining: 10 });
    const before = structuredClone(f.session);
    expect(f.act("harvest")).toMatchObject({ kind: "ignored", reason: "plot-needs-clearing" });
    advanceFarmPlotsForDay(f.project, f.session, 1, "spring");
    expect(f.session).toEqual(before);
    expect(cropReady(f.project, f.plot())).toBe(false);
    expect(f.act("till").kind).toBe("tilled");
    expect(f.plot()).toEqual({ tilled: true, watered: false });
  });

  it.each(["capacity", "energy", "xp"] as const)("does not initialize or reset the countdown after %s refusal", (reason) => {
    const f = fixture(); mature(f);
    for (const previouslyHarvested of [false, true]) {
      if (previouslyHarvested) {
        f.session.inventory[f.crop.harvestItemId] = 0;
        f.session.energy = 100;
        f.project.system.skillSystem = { enabled: false };
        expect(f.act("harvest").kind).toBe("harvested");
        for (let tick = 0; tick < 10; tick += 1) f.waterDay();
        expect(f.plot()).toMatchObject({ regrowDaysRemaining: 0 });
      }
      if (reason === "capacity") f.session.inventory[f.crop.harvestItemId] = ITEM_QUANTITY_MAX;
      if (reason === "energy") f.session.energy = 0;
      if (reason === "xp") {
        f.project.system.skillSystem = { enabled: true };
        f.project.database.lifeSkills = [{ id: "farm", name: "Farm", skillType: "farming", maxLevel: 10,
          levelUpRewards: [{ level: 2, switchId: "missing-reward" }] }];
        f.session.lifeSkills = { farm: { xp: 99, level: 1 } };
      }
      const before = structuredClone(f.session);
      expect(f.act("harvest")).toMatchObject({ kind: "ignored", reason: {
        capacity: "inventory-full", energy: "insufficient-energy", xp: "invalid-life-skill",
      }[reason] });
      expect(f.session).toEqual(before);
    }
  });

  it.each([1, 10, 10000])("keeps authored regrow %i without limiting it to initial growth", (days) => {
    const f = fixture(1, days); mature(f); f.act("harvest");
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: days });
    f.waterDay();
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: days - 1 });
    expect(cropReady(f.project, f.plot())).toBe(days === 1);
  });

  it("does not infer harvest history in an old plot, including after Storage reload", () => {
    const f = fixture(); f.waterDay();
    expect(saveToSlot(localStorage, 1, createSaveSnapshot(f.project, f.session))).toEqual({ ok: true });
    const read = readSaveSlot(localStorage, 1);
    if (read.kind !== "present") throw new Error("Missing legacy-shaped crop");
    Object.assign(f.session, applySaveSnapshot(f.project, read.snapshot));
    expect(f.plot()).not.toHaveProperty("regrowDaysRemaining");
    f.waterDay();
    expect(cropReady(f.project, f.plot())).toBe(true);
    expect(f.plot()).not.toHaveProperty("regrowDaysRemaining");
    f.act("harvest");
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 });
  });

  it.each([0, 1, 7])("uses remaining %i rather than stale initial growth/stage for readiness and graphics", (remaining) => {
    const f = fixture();
    const plot = { ...f.plot(), stage: remaining > 0 ? 2 : 0, growthDays: remaining > 0 ? 100 : 0,
      regrowDaysRemaining: remaining };
    expect(cropReady(f.project, plot)).toBe(remaining === 0);
    expect(spriteFrame(f.crop, plot)).toBe(remaining === 0 ? 1 : 0);
  });


  it("rolls back a qualifying tick when a later date stage refuses", () => {
    const f = fixture(); mature(f); f.act("harvest"); f.act("water");
    f.project.system.energy = { max: 100, initial: 100, restorePerDay: -1 };
    const before = structuredClone(f.session);
    if (!f.session.gameTime) throw new Error("Missing date");
    expect(transitionToNextDay(f.project, f.session, calendarDayKey(f.session.gameTime)))
      .toMatchObject({ ok: false, reason: "energy", stage: "energy" });
    expect(f.session).toEqual(before);
  });

  it("counts additional growth ticks without moving the calendar cursor or consuming more than one watering", () => {
    const f = fixture(); mature(f); f.act("harvest"); f.act("water");
    const date = structuredClone(f.session.gameTime);
    const cursor = structuredClone(f.session.farmPlotsAdvancedThrough);
    advanceFarmPlotsForDay(f.project, f.session, 3, "spring");
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 9, watered: false });
    expect(f.session.gameTime).toEqual(date);
    expect(f.session.farmPlotsAdvancedThrough).toEqual(cursor);
  });

  it("preserves a watered dead plot's countdown on an in-season tick", () => {
    const f = fixture(); mature(f); f.act("harvest");
    f.session.farmPlots = { [f.map.id]: { "4,5": { ...f.plot(), dead: true, watered: true } } };
    advanceFarmPlotsForDay(f.project, f.session, 1, "spring");
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10, dead: true, watered: false });
  });

  it.each(["enabled", "disabled"] as const)("zero-item harvest retains automatic XP policy when %s", (mode) => {
    const f = fixture(0); mature(f);
    f.project.system.skillSystem = { enabled: mode === "enabled" };
    f.project.database.lifeSkills = [{ id: "farm", name: "Farm", skillType: "farming", maxLevel: 10, levelUpRewards: [] }];
    f.session.lifeSkills = { farm: { xp: 0, level: 1 } };
    expect(f.act("harvest")).toMatchObject({ kind: "harvested", count: 0 });
    expect(f.session.lifeSkills.farm?.xp).toBe(mode === "enabled" ? 10 : 0);
    expect(f.session.inventory[f.crop.harvestItemId] ?? 0).toBe(0);
    expect(f.plot()).toMatchObject({ regrowDaysRemaining: 10 });
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "7", null])("rejects malformed countdown %s without rewriting Storage", (remaining) => {
    const f = fixture();
    const snapshot = createSaveSnapshot(f.project, f.session);
    const plots = { [f.map.id]: { "4,5": { ...f.plot(), regrowDaysRemaining: remaining } } };
    expect(isFarmPlotsRecord(plots)).toBe(false);
    const raw = JSON.stringify({ ...snapshot, session: { ...snapshot.session, farmPlots: plots } });
    localStorage.setItem(saveSlotKey(1), raw);
    const before = structuredClone(f.session);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(localStorage.getItem(saveSlotKey(1))).toBe(raw);
    expect(f.session).toEqual(before);
  });
});
