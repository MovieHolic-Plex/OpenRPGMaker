// NEW r3 public API evidence; adapted from recovered final r2 script.
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { createBlankProject } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/defaults";
import { startSession, type PlaySession } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/session";
import { placeFarmBuilding, placeHomeDecoration, removeHomeDecoration } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/spatialPlacementTransactions";
import { collectLifeRecoveryClaim, moveLifeRecoverySource, LifeReconciliationError } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/lifeRecovery";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot, saveSlotKey } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/player/saveSlots";
import { ITEM_QUANTITY_MAX } from "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3/src/project/itemQuantities";

const root = realpathSync("/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3");
assert.equal(root, "/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3");
assert.equal(process.cwd(), root);
const sources = ["src/project/lifeRecovery.ts", "src/project/lifeStateReconciliation.ts", "src/project/spatialPlacementTransactions.ts", "src/player/saveSlotSpatialValidation.ts", "src/player/saveSlots.ts", "src/project/session.ts", "src/project/defaults.ts", "src/project/itemQuantities.ts"].map(path => ({ path: realpathSync(`${root}/${path}`), sha256: createHash("sha256").update(readFileSync(`${root}/${path}`)).digest("hex") }));
writeFileSync(new URL("./import-resolution.json", import.meta.url), JSON.stringify({ root, sources }, null, 2));
class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  refuse = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { if (this.refuse) throw new DOMException("Owned storage quota refusal", "QuotaExceededError"); this.values.set(key, value); }
}
const captures: unknown[] = [];
const storage = new MemoryStorage();
const project = createBlankProject();
const item = project.database.items[0];
if (!item) throw new Error("Missing baseline item");
const itemId = item.id;
const mapId = project.startMapId;
project.database.farmBuildingTypes = [{ id: "b", name: "Building", levels: [{ level: 1, capacity: 1, footprint: { width: 1, height: 1 }, graphicResourceId: "easyrpg-picture-cloud", cost: { gold: 10, items: [{ itemId, count: 1 }] } }] }];
project.database.homeDecorationTypes = [{ id: "rug", name: "Rug", footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"], placementItemId: itemId, graphicResourceId: "easyrpg-picture-cloud" }];
let session = startSession(project, 12948);
session.gold = 100; session.inventory[itemId] = 10;
const building = { instanceId: "b1", typeId: "b", mapId, x: 8, y: 5, orientation: "down" } as const;
const rug = { ...building, instanceId: "r1", typeId: "rug", x: 10 };
function roundtrip(label: string, input: PlaySession) {
  const before = structuredClone(input);
  const snapshot = createSaveSnapshot(project, input);
  assert.equal(snapshot.schemaVersion, 5); assert.equal(project.version, 4);
  assert.deepEqual(structuredClone(input), before);
  assert.equal(saveToSlot(storage, 1, snapshot).ok, true);
  const raw = storage.getItem(saveSlotKey(1));
  const parsed = readSaveSlot(storage, 1);
  assert.equal(parsed.kind, "present");
  if (parsed.kind !== "present") throw new Error("Missing parsed slot");
  const restored = applySaveSnapshot(project, parsed.snapshot);
  assert.equal(storage.getItem(saveSlotKey(1)), raw);
  captures.push({ label, before, snapshot, raw, parsed, restored: structuredClone(restored), after: structuredClone(input) });
  return restored;
}
try {
  assert.equal(placeFarmBuilding(project, session, building).ok, true);
  const liveInput = { ...rug, npcs: ["transient"] };
  assert.equal(placeHomeDecoration(project, session, liveInput).ok, true);
  assert.deepEqual(session.homeDecorationPlacements?.r1?.recoveryItem, { itemId, count: 1 });
  assert.equal(Object.hasOwn(session.homeDecorationPlacements?.r1 ?? {}, "npcs"), false);
  captures.push({ label: "public-paid-placement", after: structuredClone(session) });
  const original = structuredClone(session.farmBuildingPlacements?.b1);
  const paid = structuredClone(session);
  session.farmPlots = { [mapId]: { "8,5": { tilled: true, watered: false }, "10,5": { tilled: true, watered: false } } };
  session = roundtrip("persistent-incompatibility", session);
  const payable = Object.values(session.lifeRecovery?.claims ?? {}).filter(claim => claim.items.length > 0);
  assert.equal(payable.length, 2);
  assert.deepEqual(payable.flatMap(claim => claim.items), [{ itemId, count: 1 }, { itemId, count: 1 }]);
  const first = payable[0]; const second = payable[1];
  if (!first || !second) throw new Error("Missing payable claims");
  assert.equal(collectLifeRecoveryClaim(project, session, first.id).ok, true);
  session = roundtrip("partial-collection", session);
  const beforeSecond = structuredClone(session);
  session.inventory[itemId] = ITEM_QUANTITY_MAX;
  const overflow = structuredClone(session);
  assert.deepEqual(collectLifeRecoveryClaim(project, session, second.id), { ok: false, reason: "inventory-overflow" });
  assert.deepEqual(structuredClone(session), overflow);
  captures.push({ label: "inventory-refusal", before: overflow, after: structuredClone(session) });
  session = beforeSecond;
  assert.equal(collectLifeRecoveryClaim(project, session, second.id).ok, true);
  for (const claim of payable) {
    const before = structuredClone(session);
    assert.deepEqual(collectLifeRecoveryClaim(project, session, claim.id), { ok: false, reason: "missing-claim" });
    assert.deepEqual(structuredClone(session), before);
    captures.push({ label: "repeated-collection-refusal", before, after: structuredClone(session) });
  }
  session = roundtrip("collected-once", roundtrip("collected", session));
  assert.equal(session.inventory[itemId], 10); assert.equal(session.gold, 90);
  const retained = Object.values(session.lifeRecovery?.claims ?? {});
  assert.equal(retained.length, 1);
  assert.deepEqual(retained[0]?.items, []);
  assert.deepEqual(retained[0]?.unresolved?.record, original);
  assert.deepEqual(original?.paymentReceipt, { gold: 10, items: [{ itemId, count: 1 }] });
  const raw = storage.getItem(saveSlotKey(1));
  const collected = structuredClone(session);
  storage.refuse = true;
  const quota = saveToSlot(storage, 1, createSaveSnapshot(project, session));
  assert.equal(quota.ok, false);
  assert.equal(storage.getItem(saveSlotKey(1)), raw);
  assert.deepEqual(structuredClone(session), collected);
  storage.refuse = false;
  captures.push({ label: "quota-after-success-does-not-roll-back-action", quota, raw, before: collected, after: structuredClone(session) });

  const malformed = structuredClone(paid);
  Object.assign(malformed.homeDecorationPlacements?.r1 ?? {}, { recoveryItem: { itemId, count: 2 } });
  const malformedBefore = structuredClone(malformed);
  const poisoned = createSaveSnapshot(project, paid);
  Object.assign(poisoned.session.homeDecorationPlacements?.r1 ?? {}, { recoveryItem: { itemId, count: 2 } });
  const corrupt = new MemoryStorage(); const corruptRaw = JSON.stringify(poisoned);
  corrupt.setItem(saveSlotKey(1), corruptRaw);
  for (let i = 0; i < 2; i++) {
    assert.throws(() => createSaveSnapshot(project, malformed), LifeReconciliationError);
    assert.throws(() => applySaveSnapshot(project, poisoned), LifeReconciliationError);
    assert.equal(readSaveSlot(corrupt, 1).kind, "corrupt");
    assert.deepEqual(structuredClone(malformed), malformedBefore);
    assert.equal(storage.getItem(saveSlotKey(1)), raw); assert.equal(corrupt.getItem(saveSlotKey(1)), corruptRaw);
  }
  captures.push({ label: "malformed-proof-refusal", before: malformedBefore, after: malformed, previousRaw: raw, malformedRaw: corruptRaw });

  for (const mode of ["capacity", "sequence"] as const) {
    const refusal = structuredClone(paid);
    refusal.lifeRecovery = mode === "sequence" ? { nextSequence: Number.MAX_SAFE_INTEGER, claims: {} } : { nextSequence: 4097, claims: Object.fromEntries(Array.from({ length: 4096 }, (_, i) => {
      const id = `recovery:${i + 1}`; return [id, { id, sourceKind: "old", sourceId: "old", reason: "old", items: [], unresolved: { record: { unpaid: 7 }, detail: "old" } }];
    })) };
    const before = structuredClone(refusal);
    assert.deepEqual(moveLifeRecoverySource(project, refusal, { sourceKind: "homeDecorationPlacements", sourceId: "r1", reason: "removed" }), { ok: false, reason: "capacity" });
    assert.deepEqual(structuredClone(refusal), before);
    captures.push({ label: `${mode}-refusal`, before, after: structuredClone(refusal) });
  }
  const typesBefore = structuredClone(project.database.homeDecorationTypes);
  for (const mode of ["changed", "deleted"] as const) {
    project.database.homeDecorationTypes = mode === "deleted" ? [] : (typesBefore ?? []).map(type => ({ ...type, placementItemId: "not-the-paid-item" }));
    const ordinaryCase = structuredClone(paid);
    const before = structuredClone(ordinaryCase);
    assert.equal(removeHomeDecoration(project, ordinaryCase, "r1").ok, true);
    assert.equal(ordinaryCase.inventory[itemId], 9);
    assert.equal(ordinaryCase.inventory["not-the-paid-item"], undefined);
    const after = structuredClone(ordinaryCase);
    assert.deepEqual(removeHomeDecoration(project, ordinaryCase, "r1"), { ok: false, reason: "missing" });
    assert.deepEqual(structuredClone(ordinaryCase), after);
    captures.push({ label: `ordinary-${mode}-definition`, before, after, repeatedAfter: structuredClone(ordinaryCase) });
    const incompatible = structuredClone(paid);
    incompatible.farmPlots = { [mapId]: { "10,5": { tilled: true, watered: false } } };
    let restored = roundtrip(`decoration-${mode}-definition`, incompatible);
    const claim = Object.values(restored.lifeRecovery?.claims ?? {}).find(claim => claim.sourceId === "r1");
    assert.ok(claim);
    assert.deepEqual(claim.items, [{ itemId, count: 1 }]);
    const beforeCollect = structuredClone(restored);
    assert.equal(collectLifeRecoveryClaim(project, restored, claim.id).ok, true);
    assert.equal(restored.inventory[itemId], 9);
    captures.push({ label: `decoration-${mode}-collection`, before: beforeCollect, after: structuredClone(restored) });
    restored = roundtrip(`decoration-${mode}-collected`, restored);
    assert.equal(restored.inventory[itemId], 9);
  }
  const ordinary = structuredClone(paid);
  project.database.homeDecorationTypes = [];
  assert.equal(removeHomeDecoration(project, ordinary, "r1").ok, true);
  assert.equal(ordinary.inventory[itemId], 9); // 10 minus still-owned building1.
  let unknown = structuredClone(paid);
  project.database.items = project.database.items.filter(entry => entry.id !== itemId);
  assert.equal(moveLifeRecoverySource(project, unknown, { sourceKind: "homeDecorationPlacements", sourceId: "r1", reason: "removed" }).ok, true);
  unknown = roundtrip("unknown-item-before-collection", unknown);
  const unknownClaim = Object.values(unknown.lifeRecovery?.claims ?? {}).find(claim => claim.sourceId === "r1");
  if (!unknownClaim) throw new Error("Missing unknown claim");
  const unknownBefore = structuredClone(unknown);
  assert.deepEqual(collectLifeRecoveryClaim(project, unknown, unknownClaim.id), { ok: false, reason: "unresolved" });
  assert.deepEqual(structuredClone(unknown), unknownBefore);
  project.database.items.push(item);
  const restoredUncollected = roundtrip("restored-item-no-automatic-payout", unknown);
  assert.deepEqual(restoredUncollected.inventory, unknown.inventory);
  unknown = restoredUncollected;
  assert.equal(collectLifeRecoveryClaim(project, unknown, unknownClaim.id).ok, true);
  assert.equal(unknown.inventory[itemId], (unknownBefore.inventory[itemId] ?? 0) + 1);
  unknown = roundtrip("restored-item-explicitly-collected", unknown);
  captures.push({ label: "frozen-ordinary-and-unknown-restored", ordinary, unknownBefore, unknownAfter: unknown });
  console.log(JSON.stringify({ ok: true, surface: "public placement/collect/Save5 APIs with MemoryStorage", root, exactlyOnceItems: 2, inventory: session.inventory[itemId], gold: session.gold, retainedOriginal: retained[0]?.unresolved?.record, capturedCases: captures.length }, null, 2));
} finally {
  writeFileSync(new URL("./public-state.json", import.meta.url), JSON.stringify({ itemId, captures, final: session }, null, 2));
  storage.clear();
}
