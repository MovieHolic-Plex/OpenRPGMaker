import assert from "node:assert/strict";
import { createServer } from "vite";
import { Window } from "happy-dom";

const server = await createServer({ configFile: false,
  cacheDir: ".omo/evidence/life-full-20260906/3/vite-cache",
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom" });
const window = new Window();
const storage = window.localStorage;
try {
  const recovery = await server.ssrLoadModule("/src/project/lifeRecovery.ts");
  const makers = await server.ssrLoadModule("/src/project/makers.ts");
  const saves = await server.ssrLoadModule("/src/player/saveSlots.ts");
  const validation = await server.ssrLoadModule("/src/player/saveSlotValidation.ts");
  const { normalizeItemRecord } = await server.ssrLoadModule("/src/project/databaseRecordModel.ts");
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { startSession } = await server.ssrLoadModule("/src/project/session.ts");
  const project = createBlankProject();
  project.database.items.push(...["raw", "product"].map(id => normalizeItemRecord({ id, name: id, scope: "none", price: 1 })));
  project.system.timeSystem = { enabled: true, dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 };
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  const session = startSession(project, 3);
  session.inventory = { raw: 3 };
  assert.equal(makers.startMaker(project, session, "one", "maker", 10).ok, true);
  const originalContract = structuredClone(session.makerInstances.one.contract);
  project.system.makers[0].outputs.splice(0, 1, { itemId: "product", count: 9 });
  saves.setSaveSlotStorageNamespace("life-task3-public");
  assert.equal(saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session)).ok, true);
  const read = saves.readSaveSlot(storage, 1);
  assert.equal(read.kind, "present");
  const resumed = saves.applySaveSnapshot(project, read.snapshot);
  assert.deepEqual(resumed.makerInstances.one.contract, originalContract);
  assert.equal(makers.advanceMakers(project, resumed, 40).ok, true);
  assert.equal(makers.collectMaker(project, resumed, "one").ok, true);
  assert.equal(resumed.inventory.product, 2);
  assert.equal(session.makerInstances.one.status, "processing");
  console.log(JSON.stringify({ surface: "actual public Vite SSR maker/save imports + local Storage", frozenPromise: 2, editedPromise: 9, resumedPayout: resumed.inventory.product, liveJobUnchanged: true }));

  project.system.makers = [];
  assert.equal(recovery.moveLifeRecoverySource(project, session, { sourceKind: "makerInstances", sourceId: "one", reason: "deleted", absoluteMinute: 39 }).ok, true);
  assert.deepEqual(session.inventory, {});
  assert.deepEqual(session.lifeRecovery.claims["recovery:1"].items, [{ itemId: "raw", count: 3 }]);
  assert.deepEqual(session.makerInstances, {});
  session.inventory.raw = 9_999_997;
  const overflow = structuredClone(session);
  assert.deepEqual(recovery.collectLifeRecoveryClaim(project, session, "recovery:1"), { ok: false, reason: "inventory-overflow" });
  assert.deepEqual(session, overflow);
  session.inventory = {};
  assert.equal(recovery.collectLifeRecoveryClaim(project, session, "recovery:1").ok, true);
  assert.deepEqual(session.inventory, { raw: 3 });
  const paid = structuredClone(session);
  assert.equal(recovery.collectLifeRecoveryClaim(project, session, "recovery:1").ok, false);
  assert.deepEqual(session, paid);
  session.shippingQueue = { missing: 3 };
  assert.equal(recovery.moveLifeRecoverySource(project, session, { sourceKind: "shippingQueue", sourceId: "missing", reason: "unknown" }).ok, true);
  const unknown = structuredClone(session);
  assert.deepEqual(recovery.collectLifeRecoveryClaim(project, session, "recovery:2"), { ok: false, reason: "unresolved" });
  assert.deepEqual(session, unknown);
  assert.equal(session.lifeRecovery.claims["recovery:2"].unresolved.record, 3);
  assert.equal(validation.isLifeRecoveryState(session.lifeRecovery), true);
  const bad = structuredClone(session.lifeRecovery);
  bad.claims["recovery:2"].items[0].count = 0;
  const raw = JSON.stringify(bad);
  storage.setItem("recovery-boundary-input", raw);
  assert.equal(validation.isLifeRecoveryState(JSON.parse(storage.getItem("recovery-boundary-input"))), false);
  assert.equal(storage.getItem("recovery-boundary-input"), raw);
  console.log(JSON.stringify({ surface: "actual public recovery source/receipt/boundary imports (not UI or future save wiring)", inputSpent: 3, canceledInputs: 3, paidOnce: 3, overflowUnchanged: true, unknownPreserved: true, nextSequence: session.lifeRecovery.nextSequence, malformedRawUnchanged: true }));
  const legacy = startSession(project, 4);
  legacy.inventory = {};
  const original = { instanceId: "old", makerId: "maker", status: "processing", startedAtMinute: 10, readyAtMinute: 40 };
  legacy.makerInstances = { old: original };
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 7 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  assert.equal(recovery.moveLifeRecoverySource(project, legacy, { sourceKind: "makerInstances", sourceId: "old", reason: "canceled", absoluteMinute: 39 }).ok, true);
  assert.deepEqual(legacy.makerInstances, {});
  assert.deepEqual(legacy.lifeRecovery.claims["recovery:1"].items, []);
  assert.deepEqual(legacy.lifeRecovery.claims["recovery:1"].unresolved.record, original);
  const preserved = structuredClone(legacy);
  assert.deepEqual(recovery.collectLifeRecoveryClaim(project, legacy, "recovery:1"), { ok: false, reason: "unresolved" });
  assert.deepEqual(legacy, preserved);
  assert.deepEqual(legacy.inventory, {});
  console.log(JSON.stringify({ legacyEditedInputs: 7, inferredRefund: 0, originalPreserved: true, receiptRejected: true }));
} finally {
  storage.clear();
  await window.happyDOM.close();
  await server.close();
  console.log(JSON.stringify({ teardown: "storage cleared, window and middleware-only Vite server closed", httpListener: false, remoteWrites: 0 }));
}
