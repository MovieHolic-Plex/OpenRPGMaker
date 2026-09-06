import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createServer } from "vite";
import { Window } from "happy-dom";

const cacheDir = new URL("./ssr-cache/", import.meta.url).pathname;
const server = await createServer({ configFile: false, envFile: false, root: process.cwd(), cacheDir,
  resolve: { alias: { "@": `${process.cwd()}/src` } }, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom" });
const window = new Window();
const storage = window.localStorage;
try {
  const [saves, recovery, bundles, shipping, makers, days, defaults, records, sessions, checkpoints] = await Promise.all([
    "/src/player/saveSlots.ts", "/src/project/lifeRecovery.ts", "/src/project/bundles.ts", "/src/project/shipping.ts",
    "/src/project/makers.ts", "/src/player/dayTransition.ts", "/src/project/defaults.ts", "/src/project/databaseRecordModel.ts",
    "/src/project/session.ts", "/src/player/checkpoints.ts",
  ].map(path => server.ssrLoadModule(path)));
  const project = defaults.createBlankProject();
  project.database.items.push(...["raw", "product"].map(id => records.normalizeItemRecord({ id, name: id, scope: "none", price: 10 })));
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.shipping = { enabled: true };
  project.system.bundles = [{ id: "bundle", requirements: [{ itemId: "raw", count: 8 }] }];
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  saves.setSaveSlotStorageNamespace("reviewer-st_01a07628");
  const session = sessions.startSession(project, 76);
  assert.equal(sessions.changeItemsAtomically(session, [{ itemId: "raw", op: "+=", amount: 12 }]), true);
  assert.equal(shipping.depositShipping(project, session, "raw", 2).ok, true);
  assert.equal(bundles.contributeBundle(project, session, "bundle", "raw", 5).ok, true);
  assert.equal(makers.startMaker(project, session, "job", "maker", 0).ok, true);
  session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 29 };
  assert.equal(session.inventory.raw, 2);
  const checkpoint = checkpoints.saveSessionCheckpoint(project, session);
  const prior = saves.createSaveSnapshot(project, session);
  assert.equal(saves.saveToSlot(storage, 1, prior).ok, true);
  const disk = storage.getItem(saves.saveSlotKey(1));
  assert.notEqual(disk, null);
  project.system.shipping.enabled = false;
  project.system.bundles[0].requirements[0].count = 2;
  project.system.makers = [];
  const frozen = structuredClone(session);
  const snapshot = saves.createSaveSnapshot(project, session);
  assert.deepEqual(session, frozen);
  assert.deepEqual(Object.values(snapshot.session.lifeRecovery.claims).map(claim => [claim.sourceKind, claim.items]), [
    ["shippingQueue", [{ itemId: "raw", count: 2 }]],
    ["bundleContributions", [{ itemId: "raw", count: 3 }]],
    ["makerInstances", [{ itemId: "raw", count: 3 }]],
  ]);
  let restored = saves.applySaveSnapshot(project, snapshot);
  const recoveryBefore = structuredClone(restored.lifeRecovery);
  for (let roundtrip = 0; roundtrip < 2; roundtrip++) {
    assert.equal(saves.saveToSlot(storage, 2, saves.createSaveSnapshot(project, restored)).ok, true);
    const bytes = storage.getItem(saves.saveSlotKey(2));
    const read = saves.readSaveSlot(storage, 2);
    assert.equal(read.kind, "present");
    restored = saves.applySaveSnapshot(project, read.snapshot);
    assert.equal(storage.getItem(saves.saveSlotKey(2)), bytes);
    assert.deepEqual(restored.lifeRecovery, recoveryBefore);
  }
  for (const id of Object.keys(restored.lifeRecovery.claims)) {
    assert.equal(recovery.collectLifeRecoveryClaim(project, restored, id).ok, true);
    assert.equal(recovery.collectLifeRecoveryClaim(project, restored, id).reason, "missing-claim");
  }
  assert.equal(restored.inventory.raw, 10);
  assert.equal(restored.bundleContributions.bundle.raw, 2);
  assert.deepEqual(restored.lifeRecovery, { nextSequence: 4, claims: {} });
  assert.equal(storage.getItem(saves.saveSlotKey(1)), disk);
  console.log(JSON.stringify({ case: "simultaneous-content-churn", actualTransactions: ["grant12", "deposit2", "contribute5", "startMaker3"], inventoryBeforeReceipt: 2, claims: [2, 3, 3], retainedProgress: 2, inventoryAfterReceipt: 10, conserved: 12, repeatedRoundtrips: 2, duplicatePayout: false, writerInputUnchanged: true }));

  const full = structuredClone(session);
  full.lifeRecovery = { nextSequence: 4095, claims: Object.fromEntries(Array.from({ length: 4094 }, (_, i) => {
    const id = `recovery:${i + 1}`;
    return [id, { id, sourceKind: "shippingQueue", sourceId: "old", reason: "removed", items: [{ itemId: "raw", count: 1 }] }];
  })) };
  assert.equal(recovery.isLifeRecoveryState(full.lifeRecovery), true);
  const beforeFailure = structuredClone(full);
  const capacity = error => error instanceof recovery.LifeReconciliationError && error.sourceKind === "makerInstances" && error.sourceId === "job" && error.reason === "capacity";
  assert.throws(() => saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, full)), capacity);
  assert.deepEqual(full, beforeFailure);
  assert.equal(storage.getItem(saves.saveSlotKey(1)), disk);
  assert.deepEqual(days.transitionToNextDay(project, full, "1:spring:1"), { ok: false, reason: "recovery", stage: "recovery", sourceKind: "makerInstances", sourceId: "job" });
  assert.deepEqual(full, beforeFailure);
  checkpoints.setSessionCheckpoint(full, checkpoint);
  assert.throws(() => checkpoints.saveSessionCheckpoint(project, full), capacity);
  assert.equal(checkpoints.getSessionCheckpoint(full), checkpoint);
  assert.deepEqual(full, beforeFailure);
  console.log(JSON.stringify({ case: "last-owner-capacity-refusal", existingClaims: 4094, requiredConversions: 3, refusedOwner: "makerInstances/job", wholeSessionUnchanged: true, priorManualBytesUnchanged: true, priorCheckpointUnchanged: true, dayUnchanged: true }));
} finally {
  storage.clear();
  await window.happyDOM.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
  console.log(JSON.stringify({ cleanup: "Storage cleared; Happy DOM and middleware-only Vite closed; reviewer SSR cache removed", httpListenerStarted: false, remoteWrites: 0, playerHtml: "not executed by this public-module probe" }));
}
