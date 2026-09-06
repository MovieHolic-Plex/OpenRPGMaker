import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { createServer } from "vite";

const root = process.cwd();
const cacheDir = join(root, ".cache/life-record-keys-public");
const window = new Window();
const storage = window.localStorage;
const prototype = Object.getOwnPropertyDescriptors(Object.prototype);
const server = await createServer({
  configFile: false, root, cacheDir,
  resolve: { alias: { "@": `${root}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom",
});
const json = (value) => JSON.parse(JSON.stringify(value));
const ownCount = (record, id) => Object.hasOwn(record ?? {}, id) ? record[id] : 0;
try {
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { normalizeItemRecord } = await server.ssrLoadModule("/src/project/databaseRecordModel.ts");
  const { startSession } = await server.ssrLoadModule("/src/project/session.ts");
  const { parseLifeState, reconcileLifeState, collectLifeRecoveryClaim, moveLifeRecoverySource } = await server.ssrLoadModule("/src/project/lifeRecovery.ts");
  const { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, saveSlotKey } = await server.ssrLoadModule("/src/player/saveSlots.ts");
  const { serialize, deserialize } = await server.ssrLoadModule("/src/project/io.ts");
  const exact = '{"bundleContributions":{"bundle":{"__proto__":1}}}';
  const parsed = parseLifeState(JSON.parse(exact));
  assert.equal(ownCount(parsed.bundleContributions.bundle, "__proto__"), 1);
  console.log(JSON.stringify({ phase: "exact-parse", raw: exact, parsed, directOwner: true, unresolvedOwner: false }));
  function owners(state, id) {
    return { source: state.bundleContributions ?? {}, shipping: state.shippingQueue ?? {}, inventory: state.inventory,
      recovery: state.lifeRecovery ?? null, sourceQuantity: ownCount(state.bundleContributions?.[id], id),
      inventoryQuantity: ownCount(state.inventory, id),
      claimQuantity: Object.values(state.lifeRecovery?.claims ?? {}).flatMap((claim) => claim.items).filter((item) => item.itemId === id).reduce((total, item) => total + item.count, 0) };
  }
  function roundtrip(project, session, id, label) {
    const live = JSON.stringify(session);
    const snapshot = createSaveSnapshot(project, session);
    assert.equal(JSON.stringify(session), live);
    assert.equal(saveToSlot(storage, 1, snapshot).ok, true);
    const disk = storage.getItem(saveSlotKey(1));
    const read = readSaveSlot(storage, 1);
    assert.equal(read.kind, "present");
    const restored = applySaveSnapshot(project, read.snapshot);
    assert.equal(storage.getItem(saveSlotKey(1)), disk);
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototype);
    console.log(JSON.stringify({ id, phase: label, writer: owners(snapshot.session, id), reader: owners(read.snapshot.session, id), applied: owners(restored, id), diskUnchangedByReadApply: true, liveUnchangedByWriter: true }));
    return restored;
  }
  for (const id of ["ordinary", "__proto__", "constructor", "toString"]) {
    const project = createBlankProject();
    const item = normalizeItemRecord({ id, name: id, scope: "none", price: 1 });
    project.database.items.push(item);
    project.system.bundles = [{ id, requirements: [{ itemId: id, count: 2 }] }];
    const authored = deserialize(serialize(project));
    assert.equal(authored.database.items.some((item) => item.id === id), true);
    assert.deepEqual(authored.system.bundles, project.system.bundles);
    console.log(JSON.stringify({ id, phase: "actual-id-contract", projectSerializeDeserialize: "accepted" }));
    const session = startSession(project, 30);
    session.inventory = {};
    session.bundleContributions = JSON.parse(`{${JSON.stringify(id)}:{${JSON.stringify(id)}:5}}`);
    console.log(JSON.stringify({ id, phase: "original", ...owners(session, id) }));
    let restored = roundtrip(project, session, id, "split-2-plus-3");
    assert.equal(owners(restored, id).sourceQuantity, 2);
    assert.equal(owners(restored, id).claimQuantity, 3);
    assert.equal(owners(restored, id).inventoryQuantity, 0);
    const stableRecovery = json(restored.lifeRecovery);
    for (let retry = 1; retry <= 2; retry++) {
      assert.deepEqual(json(reconcileLifeState(project, restored)), json(restored));
      restored = roundtrip(project, restored, id, `retry-${retry}`);
      assert.deepEqual(json(restored.lifeRecovery), stableRecovery);
      assert.equal(owners(restored, id).sourceQuantity + owners(restored, id).claimQuantity, 5);
    }
    assert.equal(collectLifeRecoveryClaim(project, restored, "recovery:1").ok, true);
    assert.deepEqual(collectLifeRecoveryClaim(project, restored, "recovery:1"), { ok: false, reason: "missing-claim" });
    restored = roundtrip(project, restored, id, "explicit-payout-once");
    assert.equal(owners(restored, id).sourceQuantity, 2);
    assert.equal(owners(restored, id).inventoryQuantity, 3);
    assert.equal(owners(restored, id).claimQuantity, 0);
    assert.equal(restored.lifeRecovery.nextSequence, 2);

    const existing = startSession(project, 30);
    existing.inventory = JSON.parse(`{${JSON.stringify(id)}:1}`);
    existing.shippingQueue = { [id]: 3 };
    assert.equal(moveLifeRecoverySource(project, existing, { sourceKind: "shippingQueue", sourceId: id, reason: "disabled" }).ok, true);
    assert.equal(collectLifeRecoveryClaim(project, existing, "recovery:1").ok, true);
    assert.equal(owners(roundtrip(project, existing, id, "existing-stack-1-plus-3"), id).inventoryQuantity, 4);

    project.database.items = project.database.items.filter((entry) => entry.id !== id);
    const unknown = roundtrip(project, session, id, "unknown-original-preserved");
    assert.equal(owners(unknown, id).sourceQuantity, 0);
    assert.equal(owners(unknown, id).claimQuantity, 5);
    assert.equal(owners(unknown, id).inventoryQuantity, 0);
    assert.equal(Object.keys(unknown.lifeRecovery.claims).length, 1);
    assert.deepEqual(json(unknown.lifeRecovery.claims["recovery:1"].unresolved.record), json(session.bundleContributions[id]));
    const beforeRefusal = JSON.stringify(unknown);
    assert.deepEqual(collectLifeRecoveryClaim(project, unknown, "recovery:1"), { ok: false, reason: "unresolved" });
    assert.equal(JSON.stringify(unknown), beforeRefusal);
    const again = roundtrip(project, roundtrip(project, unknown, id, "unknown-retry-1"), id, "unknown-retry-2");
    assert.deepEqual(json(again.lifeRecovery), json(unknown.lifeRecovery));
    project.database.items.push(item);
    const returned = roundtrip(project, again, id, "definition-return-no-auto-payout");
    assert.equal(owners(returned, id).inventoryQuantity, 0);
    assert.equal(collectLifeRecoveryClaim(project, returned, "recovery:1").ok, true);
    assert.equal(owners(roundtrip(project, returned, id, "returned-explicit-payout"), id).inventoryQuantity, 5);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototype);
  console.log(JSON.stringify({ result: "PASS", idCases: 4, objectPrototypeUnchanged: true, ownershipPolicyChanged: false, remoteWrites: 0 }));
} finally {
  storage.clear();
  assert.equal(storage.length, 0);
  window.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
  console.log(JSON.stringify({ cleanup: { storageEntries: storage.length, windowClosed: window.closed, viteClosed: true, httpListenerStarted: false, cacheExists: existsSync(cacheDir), remoteWrites: 0 } }));
}
