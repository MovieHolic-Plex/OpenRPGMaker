import assert from "node:assert/strict";
import { createServer } from "vite";
import { Window } from "happy-dom";

const server = await createServer({ configFile: false,
  cacheDir: ".omo/evidence/life-full-20260906/4/vite-cache",
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom" });
const window = new Window();
const storage = window.localStorage;
try {
  const [saves, recovery, bundles, shipping, makers, autosave, days, checkpoints, defaults, records, sessions] = await Promise.all([
    "/src/player/saveSlots.ts", "/src/project/lifeRecovery.ts", "/src/project/bundles.ts", "/src/project/shipping.ts", "/src/project/makers.ts",
    "/src/player/autosave.ts", "/src/player/dayTransition.ts", "/src/player/checkpoints.ts", "/src/project/defaults.ts", "/src/project/databaseRecordModel.ts", "/src/project/session.ts",
  ].map(path => server.ssrLoadModule(path)));
  const project = defaults.createBlankProject();
  project.database.items.push(...["raw", "product"].map(id => records.normalizeItemRecord({ id, name: id, scope: "none", price: 10 })));
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.bundles = [{ id: "bundle", requirements: [{ itemId: "raw", count: 8 }] }];
  project.system.shipping = { enabled: true };
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  saves.setSaveSlotStorageNamespace("life-task4-public");
  function roundtrip(session) {
    assert.equal(saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session)).ok, true);
    const read = saves.readSaveSlot(storage, 1);
    assert.equal(read.kind, "present");
    return saves.applySaveSnapshot(project, read.snapshot);
  }
  const session = sessions.startSession(project, 4);
  session.inventory = { raw: 10 };
  assert.equal(bundles.contributeBundle(project, session, "bundle", "raw", 5).ok, true);
  assert.equal(session.inventory.raw, 5);
  project.system.bundles[0].requirements[0].count = 2;
  const before = structuredClone(session);
  const restored = roundtrip(session);
  assert.deepEqual(session, before);
  assert.deepEqual(restored.bundleContributions, { bundle: { raw: 2 } });
  assert.deepEqual(restored.lifeRecovery.claims["recovery:1"].items, [{ itemId: "raw", count: 3 }]);
  assert.equal(restored.inventory.raw, 5);
  const twice = roundtrip(roundtrip(restored));
  assert.deepEqual(twice.lifeRecovery, restored.lifeRecovery);
  assert.equal(recovery.collectLifeRecoveryClaim(project, twice, "recovery:1").ok, true);
  assert.equal(recovery.collectLifeRecoveryClaim(project, twice, "recovery:1").ok, false);
  assert.equal(roundtrip(twice).inventory.raw, 8);
  assert.equal(twice.inventory.raw + twice.bundleContributions.bundle.raw, 10);
  assert.deepEqual(twice.lifeRecovery, { nextSequence: 2, claims: {} });
  console.log(JSON.stringify({ surface: "real public contribute -> Save5 Storage -> read/apply -> claim receipt", donated: 5, progress: 2, claim: 3, inventoryBeforeReceipt: 5, inventoryAfterReceipt: twice.inventory.raw, conservedTotal: 10, reloads: 2, duplicatePayout: false, liveUnchanged: true }));

  const tombstone = sessions.startSession(project, 5);
  tombstone.inventory = { raw: 2 };
  project.system.worldUnlocks = [{ id: "region" }];
  project.system.craftRecipes = [{ id: "recipe", ingredients: [], outputItemId: "raw" }];
  project.system.bundles[0].reward = { gold: 9, worldUnlockIds: ["region"], recipeIds: ["recipe"] };
  assert.equal(bundles.contributeBundle(project, tombstone, "bundle", "raw", 2).ok, true);
  const savedDefinitions = structuredClone(project.system.bundles);
  project.system.bundles = [];
  project.system.worldUnlocks = [];
  project.system.craftRecipes = [];
  const dormant = roundtrip(tombstone);
  assert.deepEqual(dormant.completedBundleIds, ["bundle"]);
  assert.deepEqual(dormant.bundleRewardAppliedIds, ["bundle"]);
  assert.deepEqual(dormant.unlockedRegionIds, ["region"]);
  assert.deepEqual(dormant.unlockedRecipeIds, ["recipe"]);
  assert.equal(dormant.lifeRecovery, undefined);
  project.system.bundles = savedDefinitions;
  const paid = structuredClone(dormant);
  assert.equal(bundles.contributeBundle(project, dormant, "bundle", "raw", 1).reason, "already-complete");
  assert.deepEqual(dormant, paid);
  console.log(JSON.stringify({ completedTombstone: true, dormantRights: 2, repeatedReward: false, earnedGold: dormant.gold }));

  for (const minute of [29, 30]) {
    const makerSession = sessions.startSession(project, minute);
    makerSession.inventory = { raw: 3 };
    assert.equal(makers.startMaker(project, makerSession, "job", "maker", 0).ok, true);
    makerSession.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute };
    const snapshot = saves.createSaveSnapshot(project, makerSession);
    project.system.timeSystem.dayStartHour = 8;
    const canceled = saves.applySaveSnapshot(project, snapshot);
    const expected = [{ itemId: minute === 29 ? "raw" : "product", count: minute === 29 ? 3 : 2 }];
    assert.deepEqual(canceled.lifeRecovery.claims["recovery:1"].items, expected);
    assert.deepEqual(canceled.makerInstances, {});
    project.system.timeSystem.dayStartHour = 6;
    assert.deepEqual(roundtrip(canceled).lifeRecovery, canceled.lifeRecovery);
    console.log(JSON.stringify({ oldClockMinute: minute, changedStart: 8, canceled: expected, reissued: false }));
  }

  const failure = sessions.startSession(project, 7);
  failure.inventory = { raw: 3 };
  assert.equal(shipping.depositShipping(project, failure, "raw", 3).ok, true);
  assert.notEqual(autosave.performAutosave(project, failure, storage, "transfer"), null);
  const disk = storage.getItem(saves.autosaveKey());
  const checkpoint = checkpoints.saveSessionCheckpoint(project, failure);
  failure.lifeRecovery = { nextSequence: 0, claims: {} };
  const live = structuredClone(failure);
  assert.equal(autosave.performAutosave(project, failure, storage, "transfer"), null);
  assert.deepEqual(failure, live);
  assert.equal(storage.getItem(saves.autosaveKey()), disk);
  assert.throws(() => checkpoints.saveSessionCheckpoint(project, failure), recovery.LifeReconciliationError);
  assert.equal(checkpoints.getSessionCheckpoint(failure), checkpoint);
  assert.equal(days.transitionToNextDay(project, failure, "1:spring:1").stage, "recovery");
  assert.deepEqual(failure, live);
  const malformed = JSON.parse(disk);
  malformed.session.lifeRecovery = { nextSequence: 0, claims: {} };
  const raw = JSON.stringify(malformed);
  storage.setItem(saves.saveSlotKey(2), raw);
  assert.equal(saves.readSaveSlot(storage, 2).kind, "corrupt");
  assert.equal(storage.getItem(saves.saveSlotKey(2)), raw);
  assert.throws(() => saves.applySaveSnapshot(project, malformed), recovery.LifeReconciliationError);
  console.log(JSON.stringify({ reconciliationFailure: "reported", currentLiveUnchanged: true, priorAutosaveUnchanged: true, priorCheckpointUnchanged: true, dayRollback: true, malformedRead: "corrupt", malformedRawUnchanged: true }));

  delete failure.lifeRecovery;
  project.system.shipping.enabled = false;
  project.system.energy = { max: 10, initial: 10, restorePerDay: -1 };
  const failedDay = structuredClone(failure);
  assert.equal(days.transitionToNextDay(project, failure, "1:spring:1").stage, "energy");
  assert.deepEqual(failure, failedDay);
  delete project.system.energy;
  const canceledShipping = roundtrip(failure);
  assert.equal(recovery.collectLifeRecoveryClaim(project, canceledShipping, "recovery:1").ok, true);
  const current = structuredClone(canceledShipping);
  const quota = new Proxy(storage, { get(target, key) {
    if (key === "setItem") return () => { throw new DOMException("quota", "QuotaExceededError"); };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  assert.equal(autosave.performAutosave(project, canceledShipping, quota, "transfer"), null);
  assert.deepEqual(canceledShipping, current);
  assert.equal(storage.getItem(saves.autosaveKey()), disk);
  console.log(JSON.stringify({ laterStage: "energy", wholeDayRolledBack: true, quotaFailure: true, successfulClaimNotRolledBack: true, currentInventory: canceledShipping.inventory.raw }));
} finally {
  storage.clear();
  await window.happyDOM.close();
  await server.close();
  console.log(JSON.stringify({ teardown: "Storage cleared; happy-dom and middleware-only Vite closed", httpListener: false, remoteWrites: 0, playerHtml: "not-run; public persistence seam exercised" }));
}
