import assert from "node:assert/strict";
import { createServer } from "vite";
import { Window } from "happy-dom";

const server = await createServer({ configFile: false,
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom" });
const window = new Window();
const storage = window.localStorage;
try {
  const [saves, defaults, sessions, recovery, autosave, days] = await Promise.all([
    "/src/player/saveSlots.ts", "/src/project/defaults.ts", "/src/project/session.ts",
    "/src/project/lifeRecovery.ts", "/src/player/autosave.ts", "/src/player/dayTransition.ts",
  ].map(path => server.ssrLoadModule(path)));
  const project = defaults.createBlankProject();
  project.system.timeSystem = { enabled: true };
  const session = sessions.startSession(project, 44);
  const mapId = project.startMapId;
  assert.equal(mapId, "map_blank_start");
  const key = `${mapId}:2,2`;
  // Exact B1 payload from st_01a0741b, not an unrecognizable substitute.
  const original = { id: "legacy", mapId, x: 2, y: 2, kind: "legacy-machine",
    paid: { itemId: "old-input", count: 3 }, oldJob: { progress: 7 } };
  const snapshot = saves.createSaveSnapshot(project, session);
  snapshot.session.placeables = { [key]: original };
  const wire = JSON.stringify(snapshot);
  storage.setItem(saves.saveSlotKey(1), wire);
  const read = saves.readSaveSlot(storage, 1);
  assert.equal(read.kind, "present");
  assert.deepEqual(read.snapshot.session.placeables[key], original);
  const restored = saves.applySaveSnapshot(project, read.snapshot);
  assert.equal(storage.getItem(saves.saveSlotKey(1)), wire);
  function assertOneOwner(state) {
    assert.equal(state.placeables[key], undefined);
    const claims = Object.values(state.lifeRecovery.claims);
    assert.equal(claims.length, 1);
    assert.deepEqual(claims[0].unresolved.record, original);
    assert.deepEqual(claims[0].items, []);
    assert.equal(claims[0].sourceId, key);
  }
  assertOneOwner(restored);
  const restoredBefore = structuredClone(restored);
  assert.equal(recovery.collectLifeRecoveryClaim(project, restored, "recovery:1").ok, false);
  assert.deepEqual(restored, restoredBefore);
  const live = sessions.startSession(project, 45);
  live.placeables = { [key]: original };
  const liveBefore = structuredClone(live);
  const written = saves.createSaveSnapshot(project, live);
  assertOneOwner(written.session);
  assert.deepEqual(live, liveBefore);
  let roundtrip = restored;
  for (let pass = 0; pass < 2; pass++) {
    assert.equal(saves.saveToSlot(storage, 3, saves.createSaveSnapshot(project, roundtrip)).ok, true);
    const reread = saves.readSaveSlot(storage, 3);
    assert.equal(reread.kind, "present");
    roundtrip = saves.applySaveSnapshot(project, reread.snapshot);
    assertOneOwner(roundtrip);
    assert.deepEqual(roundtrip.lifeRecovery, restored.lifeRecovery);
  }
  console.log(JSON.stringify({ blocker: "B1", writer: "quarantined", readerOriginalIntact: true,
    originalOwners: 1, fullOriginal: original, payableItems: [], receiptRefused: true,
    repeatedRoundtrips: 2, reissued: false, liveUnchanged: true, inputDiskUnchanged: true }));

  project.database.farmBuildingTypes = [{ id: "shed", name: "Shed", levels: [{
    level: 1, footprint: { width: 1, height: 1 }, capacity: 1,
    graphicResourceId: "easyrpg-picture-cloud" }] }];
  const damaged = saves.createSaveSnapshot(project, session);
  // Exact B2 payload: valid occupied2,2, malformed neighboring3,3, valid colliding shed.
  const fields = {
    farmPlots: { [mapId]: {
      "2,2": { tilled: true, watered: true, stage: 1, cropId: "old-crop" },
      "3,3": { tilled: "legacy", watered: false },
    } },
    farmBuildingPlacements: { shed: { instanceId: "shed", typeId: "shed",
      level: 1, mapId, x: 2, y: 2, orientation: "down" } },
  };
  Object.assign(damaged.session, fields);
  const raw = JSON.stringify(damaged);
  storage.setItem(saves.saveSlotKey(2), raw);
  assert.equal(saves.readSaveSlot(storage, 2).kind, "corrupt");
  assert.throws(() => saves.applySaveSnapshot(project, damaged), recovery.LifeReconciliationError);
  assert.equal(JSON.stringify(damaged), raw);
  assert.equal(storage.getItem(saves.saveSlotKey(2)), raw);
  assert.notEqual(autosave.performAutosave(project, session, storage, "transfer"), null);
  const disk = storage.getItem(saves.autosaveKey());
  Object.assign(session, fields);
  session.completedBundleIds = ["prior-reward"];
  session.bundleRewardAppliedIds = ["prior-reward"];
  session.lifeRecovery = structuredClone(restored.lifeRecovery);
  project.system.shipping = { enabled: false };
  session.shippingQueue = { [project.database.items[0].id]: 3 };
  const failedLive = structuredClone(session);
  assert.throws(() => saves.saveToSlot(storage, 2, saves.createSaveSnapshot(project, session)), recovery.LifeReconciliationError);
  assert.equal(autosave.performAutosave(project, session, storage, "transfer"), null);
  assert.equal(storage.getItem(saves.autosaveKey()), disk);
  assert.equal(storage.getItem(saves.saveSlotKey(2)), raw);
  const transition = days.transitionToNextDay(project, session, "1:spring:1");
  assert.deepEqual(transition, { ok: false, reason: "recovery", stage: "recovery", sourceKind: "farmPlots", sourceId: "farmPlots" });
  assert.deepEqual(session, failedLive);
  console.log(JSON.stringify({ blocker: "B2", reader: "corrupt", apply: "refused", writer: "refused",
    autosave: null, day: transition, priorDiskUnchanged: true, currentLiveAndReceiptsUnchanged: true }));

  // Positive control: removing only the malformed neighbor retains the original occupancy rule.
  const valid = structuredClone(damaged);
  delete valid.session.farmPlots[mapId]["3,3"];
  storage.setItem(saves.saveSlotKey(3), JSON.stringify(valid));
  const accepted = saves.readSaveSlot(storage, 3);
  assert.equal(accepted.kind, "present");
  const occupied = saves.applySaveSnapshot(project, accepted.snapshot);
  assert.deepEqual(occupied.farmPlots[mapId]["2,2"], fields.farmPlots[mapId]["2,2"]);
  assert.deepEqual(occupied.farmBuildingPlacements, {});
  assert.deepEqual(occupied.lifeRecovery.claims["recovery:1"].unresolved.record, fields.farmBuildingPlacements.shed);
  console.log(JSON.stringify({ control: "valid occupancy", plotRetained: true, collidingShed: "quarantined", occupancyWeakened: false }));
} finally {
  storage.clear();
  await window.happyDOM.close();
  await server.close();
  console.log(JSON.stringify({ teardown: "Storage cleared; happy-dom and middleware-only Vite closed", httpListener: false, remoteWrites: 0 }));
}
