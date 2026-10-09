import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim, isLifeRecoveryJson, moveLifeRecoverySource, reconcileLifeState, LifeReconciliationError } from "@/project/lifeRecovery";
import { placeFarmBuilding, placeHomeDecoration, removeFarmBuilding, removeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
function fixture() {
  const project = createBlankProject();
  const item = project.database.items[0];
  if (!item) throw new Error("Missing baseline item");
  const itemId = item.id;
  project.database.farmBuildingTypes = [{ id: "building", name: "Building", levels: [{ level: 1, capacity: 1, footprint: { width: 1, height: 1 }, graphicResourceId: "easyrpg-picture-cloud", cost: { gold: 10, items: [{ itemId, count: 1 }] } }] }];
  project.database.homeDecorationTypes = [{ id: "rug", name: "Rug", footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"], placementItemId: itemId, graphicResourceId: "easyrpg-picture-cloud" }];
  const session = startSession(project, 12948);
  session.gold = 100;
  session.inventory[itemId] = 10;
  const building = { instanceId: "b1", typeId: "building", mapId: project.startMapId, x: 8, y: 5, orientation: "down" } as const;
  const rug = { ...building, instanceId: "r1", typeId: "rug", x: 10 };
  return { project, session, itemId, item, building, rug };
}
const claims = (session: PlaySession) => Object.values(session.lifeRecovery?.claims ?? {});
function roundtrip(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
  const storage = new MemoryStorage();
  const before = structuredClone(session);
  const snapshot = createSaveSnapshot(project, session);
  expect(snapshot.schemaVersion).toBe(5);
  expect(project.version).toBe(4);
  expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
  const raw = storage.getItem(saveSlotKey(1));
  const parsed = readSaveSlot(storage, 1);
  if (parsed.kind !== "present") throw new Error(parsed.kind);
  const restored = applySaveSnapshot(project, parsed.snapshot);
  expect(structuredClone(session)).toEqual(before);
  expect(storage.getItem(saveSlotKey(1))).toBe(raw);
  return restored;
}
function unpaid(session: PlaySession, original: unknown) {
  const retained = claims(session).filter(claim => claim.sourceId === "b1" && claim.items.length === 0);
  expect(retained).toHaveLength(1);
  expect(retained[0]?.unresolved?.record).toEqual(original);
  expect(retained[0]?.unresolved?.record).toMatchObject({ paymentReceipt: { gold: 10 } });
}

describe("spatial recovery conservation", () => {
  it("retains unpaid gold10 after mixed item collection and repeated Save5 resume", () => {
    const { project, session, itemId, building } = fixture();
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    const original = structuredClone(session.farmBuildingPlacements?.b1);
    session.farmPlots = { [project.startMapId]: { "8,5": { tilled: true, watered: false } } };
    let restored = roundtrip(project, session);
    const payable = claims(restored).find(claim => claim.items.length > 0);
    if (!payable) throw new Error("Missing payable item claim");
    expect(collectLifeRecoveryClaim(project, restored, payable.id).ok).toBe(true);
    expect(restored.inventory[itemId]).toBe(10);
    expect(restored.gold).toBe(90);
    unpaid(restored, original);
    const before = structuredClone(restored);
    expect(collectLifeRecoveryClaim(project, restored, payable.id)).toEqual({ ok: false, reason: "missing-claim" });
    expect(structuredClone(restored)).toEqual(before);
    restored = roundtrip(project, roundtrip(project, restored));
    unpaid(restored, original);
    expect(restored.lifeRecovery).toEqual(before.lifeRecovery);
  });

  it("freezes the actual paid decoration item and recovers it after definition removal", () => {
    const { project, session, itemId, rug } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    expect(session.inventory[itemId]).toBe(9);
    expect(session.homeDecorationPlacements?.r1?.recoveryItem).toEqual({ itemId, count: 1 });
    project.database.homeDecorationTypes = [];
    let restored = roundtrip(project, session);
    const claim = claims(restored)[0];
    if (!claim) throw new Error("Missing decoration claim");
    expect(claim.items).toEqual([{ itemId, count: 1 }]);
    expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
    expect(restored.inventory[itemId]).toBe(10);
    expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(false);
    restored = roundtrip(project, roundtrip(project, restored));
    expect(claims(restored)).toEqual([]);
    expect(restored.inventory[itemId]).toBe(10);
  });

  it("retains gold-only proof without payout and keeps normal demolition claim-free", () => {
    const { project, session, building } = fixture();
    const type = project.database.farmBuildingTypes?.[0];
    if (!type) throw new Error("Missing type");
    project.database.farmBuildingTypes = [{ ...type, levels: type.levels.map(level => ({ ...level, cost: { gold: 10 } })) }];
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    const original = structuredClone(session.farmBuildingPlacements?.b1);
    const demolition = structuredClone(session);
    expect(removeFarmBuilding(demolition, "b1").ok).toBe(true);
    expect(claims(demolition)).toEqual([]);
    expect(demolition.gold).toBe(90);
    project.database.farmBuildingTypes = [];
    const restored = roundtrip(project, session);
    unpaid(restored, original);
    const before = structuredClone(restored);
    for (const claim of claims(restored)) expect(collectLifeRecoveryClaim(project, restored, claim.id)).toEqual({ ok: false, reason: "unresolved" });
    expect(structuredClone(restored)).toEqual(before);
  });

  it("partitions split item batches from one gold proof through partial collect/save/resume", () => {
    const { project, session, itemId, building } = fixture();
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    Object.assign(session.farmBuildingPlacements?.b1 ?? {}, { paymentReceipt: { gold: 10, items: [{ itemId, count: ITEM_QUANTITY_MAX + 1 }] } });
    const original = structuredClone(session.farmBuildingPlacements?.b1);
    session.inventory = {};
    project.database.farmBuildingTypes = [];
    let restored = roundtrip(project, session);
    const batches = claims(restored).filter(claim => claim.items.length > 0);
    expect(batches.map(claim => claim.items)).toEqual([[{ itemId, count: ITEM_QUANTITY_MAX }], [{ itemId, count: 1 }]]);
    unpaid(restored, original);
    const first = batches[0]; const second = batches[1];
    if (!first || !second) throw new Error("Missing split");
    expect(collectLifeRecoveryClaim(project, restored, first.id).ok).toBe(true);
    restored = roundtrip(project, restored);
    const before = structuredClone(restored);
    expect(collectLifeRecoveryClaim(project, restored, second.id)).toEqual({ ok: false, reason: "inventory-overflow" });
    expect(structuredClone(restored)).toEqual(before);
    restored.inventory = {}; // Spend the first batch before explicitly collecting the next.
    expect(collectLifeRecoveryClaim(project, restored, second.id).ok).toBe(true);
    restored = roundtrip(project, restored);
    unpaid(restored, original);
    expect(restored.lifeRecovery?.nextSequence).toBe(before.lifeRecovery?.nextSequence);
    expect(restored.gold).toBe(90);
  });

  it.each(["capacity", "sequence"] as const)("refuses %s exhaustion atomically including the additional unpaid owner", kind => {
    const { project, session, building } = fixture();
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    session.lifeRecovery = kind === "sequence" ? { nextSequence: Number.MAX_SAFE_INTEGER - 1, claims: {} } : {
      nextSequence: 4096, claims: Object.fromEntries(Array.from({ length: 4095 }, (_, i) => {
        const id = `recovery:${i + 1}`;
        return [id, { id, sourceKind: "old", sourceId: "old", reason: "unknown", items: [], unresolved: { record: { amount: 7 }, detail: "unknown" } }];
      })),
    };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "removed" })).toEqual({ ok: false, reason: "capacity" });
    expect(structuredClone(session)).toEqual(before);
  });

  it("preserves each old mixed record without speculative deduplication or repeat payout", () => {
    const { project, session, itemId, building } = fixture();
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    const original = structuredClone(session.farmBuildingPlacements?.b1);
    if (!original) throw new Error("Missing original");
    if (!isLifeRecoveryJson(original)) throw new Error("Non-JSON original");
    session.farmBuildingPlacements = {};
    session.lifeRecovery = { nextSequence: 3, claims: Object.fromEntries([1, 2].map(sequence => {
      const id = `recovery:${sequence}`;
      return [id, { id, sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "incompatible-placement", items: [{ itemId, count: 1 }], unresolved: { record: original, detail: "incompatible-placement" } }];
    })) };
    for (const id of ["recovery:1", "recovery:2"]) {
      expect(collectLifeRecoveryClaim(project, session, id).ok).toBe(true);
      expect(collectLifeRecoveryClaim(project, session, id).ok).toBe(false);
    }
    const restored = roundtrip(project, roundtrip(project, session));
    expect(restored.inventory[itemId]).toBe(11);
    expect(restored.gold).toBe(90);
    expect(restored.lifeRecovery?.nextSequence).toBe(5);
    expect(claims(restored)).toHaveLength(2);
    for (const claim of claims(restored)) {
      expect(claim.items).toEqual([]);
      expect(claim.unresolved?.record).toEqual(original);
    }
  });

  it.each(["legacy", "starting"] as const)("preserves missing-proof %s originals without historical inference", kind => {
    const { project, session, rug, itemId } = fixture();
    if (kind === "starting") project.session.homeDecorationPlacements = [rug];
    else session.homeDecorationPlacements = { r1: rug };
    const input = kind === "starting" ? startSession(project, 12948) : session;
    const before = structuredClone(input.homeDecorationPlacements?.r1);
    project.database.homeDecorationTypes = [];
    const restored = roundtrip(project, roundtrip(project, input));
    expect(claims(restored)).toHaveLength(1);
    expect(claims(restored)[0]?.items).toEqual([]);
    expect(claims(restored)[0]?.unresolved?.record).toEqual(before);
    expect(restored.inventory[itemId]).toBe(input.inventory[itemId]);
  });

  it.each(["changed", "deleted"] as const)("ordinary reclaim uses frozen evidence with a %s type", mode => {
    const { project, session, rug, itemId } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    project.database.homeDecorationTypes = mode === "deleted" ? [] : (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "not-the-paid-item" }));
    expect(removeHomeDecoration(project, session, "r1").ok).toBe(true);
    expect(session.inventory[itemId]).toBe(10);
    expect(session.inventory["not-the-paid-item"]).toBeUndefined();
    expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "missing" });
  });

  it("keeps unknown paid items until restored and requires explicit collection", () => {
    const { project, session, rug, itemId, item } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    project.database.homeDecorationTypes = [];
    project.database.items = project.database.items.filter(entry => entry.id !== itemId);
    const restored = roundtrip(project, session);
    const claim = claims(restored)[0];
    if (!claim) throw new Error("Missing claim");
    expect(claim.items).toEqual([{ itemId, count: 1 }]);
    const before = structuredClone(restored);
    expect(collectLifeRecoveryClaim(project, restored, claim.id)).toEqual({ ok: false, reason: "unresolved" });
    expect(structuredClone(restored)).toEqual(before);
    project.database.items.push(item);
    expect(reconcileLifeState(project, restored).inventory).toEqual(before.inventory);
    expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
    expect(restored.inventory[itemId]).toBe((before.inventory[itemId] ?? 0) + 1);
  });

  it("refuses legacy mixed collection at exhausted sequence without inventory side effects", () => {
    const { project, session, itemId, building } = fixture();
    expect(placeFarmBuilding(project, session, building).ok).toBe(true);
    const original = session.farmBuildingPlacements?.b1;
    if (!original) throw new Error("Missing placement");
    if (!isLifeRecoveryJson(original)) throw new Error("Non-JSON placement");
    session.farmBuildingPlacements = {};
    session.lifeRecovery = { nextSequence: Number.MAX_SAFE_INTEGER, claims: { "recovery:1": {
      id: "recovery:1", sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "removed", items: [{ itemId, count: 1 }], unresolved: { record: original, detail: "removed" },
    } } };
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "capacity" });
    expect(structuredClone(session)).toEqual(before);
  });

  it("refuses ordinary decoration inventory overflow and missing paid item with whole-state equality", () => {
    const { project, session, itemId, rug } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    session.inventory[itemId] = ITEM_QUANTITY_MAX;
    const before = structuredClone(session);
    expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "overflow" });
    expect(structuredClone(session)).toEqual(before);
    project.database.items = project.database.items.filter(item => item.id !== itemId);
    expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "invalid" });
    expect(structuredClone(session)).toEqual(before);
  });

  it("recovers the frozen decoration item after a changed type becomes persistently incompatible", () => {
    const { project, session, itemId, rug } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    project.database.homeDecorationTypes = (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "new-cost" }));
    session.farmPlots = { [project.startMapId]: { "10,5": { tilled: true, watered: false } } };
    const restored = roundtrip(project, session);
    expect(claims(restored).flatMap(claim => claim.items)).toEqual([{ itemId, count: 1 }]);
    for (const claim of claims(restored)) expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
    expect(restored.inventory[itemId]).toBe(10);
    expect(restored.inventory["new-cost"]).toBeUndefined();
  });

  it("rejects missing placement items without spending or recording a placement", () => {
    const { project, session, rug } = fixture();
    project.database.homeDecorationTypes = (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "" }));
    const before = structuredClone(session);
    expect(placeHomeDecoration(project, session, rug)).toEqual({ ok: false, reason: "invalid" });
    expect(structuredClone(session)).toEqual(before);
  });

  it.each([null, { itemId: "", count: 1 }, { itemId: "item_potion", count: 0 }, { itemId: "item_potion", count: 2 }, { itemId: "item_potion", count: -1 }, { itemId: "item_potion", count: 0.5 }])("rejects malformed frozen proof %# repeatedly without changing raw or memory", recoveryItem => {
    const { project, session, rug } = fixture();
    expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
    const storage = new MemoryStorage();
    const snapshot = createSaveSnapshot(project, session);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const previous = storage.getItem(saveSlotKey(1));
    Object.assign(snapshot.session.homeDecorationPlacements?.r1 ?? {}, { recoveryItem });
    Object.assign(session.homeDecorationPlacements?.r1 ?? {}, { recoveryItem });
    const before = structuredClone(session);
    const corruptStorage = new MemoryStorage();
    const malformedRaw = JSON.stringify(snapshot);
    corruptStorage.setItem(saveSlotKey(1), malformedRaw);
    for (let i = 0; i < 2; i++) {
      expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
      expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
      expect(readSaveSlot(corruptStorage, 1).kind).toBe("corrupt");
      expect(corruptStorage.getItem(saveSlotKey(1))).toBe(malformedRaw);
      expect(storage.getItem(saveSlotKey(1))).toBe(previous);
      expect(structuredClone(session)).toEqual(before);
    }
  });
});
