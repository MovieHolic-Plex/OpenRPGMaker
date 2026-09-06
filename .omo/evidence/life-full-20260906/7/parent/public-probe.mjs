import assert from "node:assert/strict";
import { createServer } from "vite";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const evidence = resolve(".omo/evidence/life-full-20260906/7/parent");
const server = await createServer({
  configFile: false, cacheDir: resolve(evidence, "probe-cache"),
  resolve: { alias: { "@": resolve("src") } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom",
});
// Compare the same structured-clone projection on both sides; native Node strict
// equality otherwise mistakes the existing null-prototype item dictionaries for lost values.
const records = [];
try {
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { normalizeItemRecord } = await server.ssrLoadModule("/src/project/databaseRecordModel.ts");
  const { normalizeCropRecord } = await server.ssrLoadModule("/src/project/farmModel.ts");
  const { startSession } = await server.ssrLoadModule("/src/project/session.ts");
  const farm = await server.ssrLoadModule("/src/player/farming.ts");
  const saves = await server.ssrLoadModule("/src/player/saveSlots.ts");
  const { transitionToNextDay } = await server.ssrLoadModule("/src/player/dayTransition.ts");
  const { calendarDayKey } = await server.ssrLoadModule("/src/project/gameTime.ts");
  const { ITEM_QUANTITY_MAX } = await server.ssrLoadModule("/src/project/itemQuantities.ts");
  assert.ok(localStorage instanceof Storage);
  saves.setSaveSlotStorageNamespace("task7-native-probe");
  function fixture(count = 1, regrow = 10) {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    assert.ok(map);
    map.farmableArea = [{ x: 0, y: 0, w: 4, h: 4 }];
    project.database.items.push(...[
      { id: "seed", name: "Seed", type: "seed" }, { id: "produce", name: "Produce" },
      { id: "hoe", name: "Hoe", farmTool: "hoe" }, { id: "can", name: "Can", farmTool: "wateringCan" },
    ].map(item => normalizeItemRecord({ ...item, scope: "none" })));
    const crop = normalizeCropRecord({ id: "crop", name: "Crop", seedItemId: "seed", harvestItemId: "produce",
      harvestCount: count, stages: [{ days: 1 }, { days: 1 }], seasons: ["spring"], regrow: { days: regrow } });
    project.database.crops = [crop];
    project.system.skillSystem = { enabled: false };
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
    project.system.energy = { max: 100, initial: 100, restorePerDay: 100 };
    const session = startSession(project, 707);
    // Authored starting equipment only; all plot progress and produce come from real actions.
    Object.assign(session.inventory, { seed: 1, hoe: 1, can: 1 });
    const plot = () => farm.farmPlotAt(session, map.id, 1, 1);
    const act = (intent) => farm.interactWithFarmPlot(project, session, map, 1, 1, intent);
    const day = () => {
      const result = transitionToNextDay(project, session, calendarDayKey(session.gameTime));
      assert.equal(result.ok, true);
      return result;
    };
    const waterDay = () => { assert.equal(act("water").kind, "watered"); return day(); };
    assert.equal(act().kind, "tilled");
    assert.equal(act().kind, "planted");
    assert.equal(Object.hasOwn(plot(), "regrowDaysRemaining"), false);
    waterDay(); assert.equal(farm.cropReady(project, plot()), false);
    waterDay(); assert.equal(farm.cropReady(project, plot()), true);
    return { project, session, map, crop, plot, act, day, waterDay };
  }
  for (const regrow of [0, 10]) for (const atCapacity of [false, true]) {
    const f = fixture(0, regrow);
    if (atCapacity) f.session.inventory.produce = ITEM_QUANTITY_MAX;
    const before = structuredClone(f.session);
    const result = f.act("harvest");
    assert.equal(result.kind, "harvested"); assert.equal(result.count, 0);
    assert.deepEqual(structuredClone(f.session.inventory), before.inventory);
    assert.equal(f.session.energy, before.energy - 1);
    assert.equal(f.plot().regrowDaysRemaining, regrow || undefined);
    records.push({ scenario: "zero-yield", regrow, atCapacity, before, result, after: structuredClone(f.session) });
  }
  const f = fixture();
  assert.equal(f.act("harvest").kind, "harvested");
  assert.equal(f.plot().regrowDaysRemaining, 10);
  const ticks = [];
  for (let tick = 1; tick <= 10; tick += 1) {
    const before = structuredClone(f.session);
    assert.equal(f.act("harvest").reason, "nothing-to-harvest");
    assert.deepEqual(structuredClone(f.session), before);
    f.waterDay();
    assert.equal(f.plot().regrowDaysRemaining, 10 - tick);
    assert.equal(farm.cropReady(f.project, f.plot()), tick === 10);
    assert.equal(farm.cropStageForPlot(f.crop, f.plot()), tick < 9 ? 0 : tick - 8);
    ticks.push({ tick, plot: structuredClone(f.plot()), ready: farm.cropReady(f.project, f.plot()) });
    if (tick === 3) {
      const live = structuredClone(f.session);
      assert.deepEqual(saves.saveToSlot(localStorage, 1, saves.createSaveSnapshot(f.project, f.session)), { ok: true });
      const raw = localStorage.getItem(saves.saveSlotKey(1));
      const loaded = saves.readSaveSlot(localStorage, 1);
      assert.equal(loaded.kind, "present");
      assert.equal(loaded.snapshot.schemaVersion, 5);
      assert.equal(f.project.version, 4);
      const restored = saves.applySaveSnapshot(f.project, loaded.snapshot);
      assert.equal(restored.farmPlots[f.map.id]["1,1"].regrowDaysRemaining, 7);
      assert.deepEqual(structuredClone(f.session), live);
      assert.deepEqual(structuredClone(restored.farmPlots), live.farmPlots);
      records.push({ scenario: "remaining7-native-Storage-roundtrip", raw, before: live, after: structuredClone(restored) });
      Object.assign(f.session, restored);
    }
  }
  assert.equal(f.act("harvest").kind, "harvested");
  assert.equal(f.session.inventory.produce, 2);
  assert.equal(f.plot().regrowDaysRemaining, 10);
  records.push({ scenario: "exact-ten-ticks", ticks, final: structuredClone(f.session) });
  const beforeDry = structuredClone(f.plot()); f.day(); assert.deepEqual(structuredClone(f.plot()), beforeDry);
  f.act("water");
  const beforeSync = structuredClone(f.session); farm.syncFarmPlotsToDate(f.project, f.session);
  assert.deepEqual(structuredClone(f.session), beforeSync);
  f.project.system.energy = { max: 100, initial: 100, restorePerDay: -1 };
  const failedDay = transitionToNextDay(f.project, f.session, calendarDayKey(f.session.gameTime));
  assert.equal(failedDay.reason, "energy"); assert.deepEqual(structuredClone(f.session), beforeSync);
  records.push({ scenario: "dry-duplicate-date-and-day-rollback", before: beforeSync, failedDay, after: structuredClone(f.session) });
  farm.advanceFarmPlotsForDay(f.project, f.session, 1, "summer");
  assert.equal(f.plot().regrowDaysRemaining, 10); assert.equal(f.plot().dead, true);
  const dead = structuredClone(f.session);
  assert.equal(f.act("harvest").reason, "plot-needs-clearing");
  farm.advanceFarmPlotsForDay(f.project, f.session, 1, "spring"); assert.deepEqual(structuredClone(f.session), dead);
  records.push({ scenario: "out-of-season-and-dead-preservation", before: dead, after: structuredClone(f.session) });
  for (const reason of ["capacity", "energy", "xp"]) for (const regrown of [false, true]) {
    const g = fixture();
    if (regrown) { g.act("harvest"); for (let tick = 0; tick < 10; tick += 1) g.waterDay(); }
    if (reason === "capacity") g.session.inventory.produce = ITEM_QUANTITY_MAX;
    if (reason === "energy") g.session.energy = 0;
    if (reason === "xp") {
      g.project.system.skillSystem = { enabled: true };
      g.project.database.lifeSkills = [{ id: "farm", name: "Farm", skillType: "farming", maxLevel: 10,
        levelUpRewards: [{ level: 2, switchId: "absent" }] }];
      g.session.lifeSkills = { farm: { xp: 99, level: 1 } };
    }
    const before = structuredClone(g.session); const result = g.act("harvest");
    assert.equal(result.reason, { capacity: "inventory-full", energy: "insufficient-energy", xp: "invalid-life-skill" }[reason]);
    assert.deepEqual(structuredClone(g.session), before);
    records.push({ scenario: reason, regrown, before, result, after: structuredClone(g.session) });
  }
  const good = localStorage.getItem(saves.saveSlotKey(1));
  for (const invalid of [-1, 0.5, null, "7", Number.MAX_SAFE_INTEGER + 1]) {
    const snapshot = JSON.parse(good);
    snapshot.session.farmPlots[Object.keys(snapshot.session.farmPlots)[0]]["1,1"].regrowDaysRemaining = invalid;
    const raw = JSON.stringify(snapshot); localStorage.setItem(saves.saveSlotKey(1), raw);
    assert.equal(saves.readSaveSlot(localStorage, 1).kind, "corrupt");
    assert.equal(localStorage.getItem(saves.saveSlotKey(1)), raw);
    records.push({ scenario: "invalid-countdown-raw-preservation", invalid, preserved: true });
  }
  console.log(JSON.stringify({ records: records.length, realNativeStorage: true, mockedAuthorities: false, nativePlayerInput: false }));
} finally {
  writeFileSync(resolve(evidence, "public-state.json"), JSON.stringify(records, null, 2) + "\n");
  localStorage.clear();
  await server.close();
  console.log(JSON.stringify({ viteClosed: true, httpListenerStarted: false, nativeStorageCleared: localStorage.length === 0 }));
}
