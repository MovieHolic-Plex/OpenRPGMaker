import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { animalProject } from "./fixtures/p1FarmAnimals";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { changeItemsAtomically, startSession, type PlaySession } from "@/project/session";
import { GOLD_MAX } from "@/project/economyValues";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { SPATIAL_COST_ITEM_LIMIT, SPATIAL_LEVEL_LIMIT } from "@/project/spatialPlacements";
import { placeFarmBuilding, upgradeFarmBuilding } from "@/project/spatialPlacementTransactions";
import { collectLifeRecoveryClaim, isRecoveryItems, isSpatialPaymentReceipt, LifeReconciliationError, moveLifeRecoverySource, reconcileLifeState } from "@/project/lifeRecovery";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import type { SpatialPlacementCost } from "@/project/types";

const window = new Window();
const storage = window.localStorage;
afterEach(() => storage.clear());
afterAll(() => window.close());

function fixture(costs: SpatialPlacementCost[]) {
  const project = animalProject();
  const ids = [...new Set(costs.flatMap(cost => cost.items?.map(item => item.itemId) ?? []))];
  project.database.items.push(...ids.map(id => normalizeItemRecord({ id, name: id, scope: "none" })));
  project.session.inventory = Object.fromEntries(ids.map(id => [id, ITEM_QUANTITY_MAX]));
  project.session.gold = GOLD_MAX;
  project.database.farmBuildingTypes = [{ id: "paid", name: "Paid", levels: costs.map((cost, i) => ({
    level: i + 1, footprint: { width: 1, height: 1 }, capacity: 1, cost, graphicResourceId: "easyrpg-picture-cloud",
  })) }];
  const authored = deserialize(serialize(project));
  expect(authored.version).toBe(4);
  expect(authored.database.farmBuildingTypes![0]!.levels.map(level => level.cost)).toEqual(costs);
  const session = startSession(authored, 11);
  return { project: authored, session };
}
const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ itemId: `paid-${start + i}`, count: 1 }));
function build(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
  expect(placeFarmBuilding(project, session, { instanceId: "home", typeId: "paid", mapId: project.startMapId, x: 5, y: 5, orientation: "down" })).toEqual({ ok: true });
}
function roundtrip(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
  const before = structuredClone(session);
  const snapshot = createSaveSnapshot(project, session);
  expect(snapshot.schemaVersion).toBe(5);
  expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
  const raw = storage.getItem(saveSlotKey(1));
  const read = readSaveSlot(storage, 1);
  if (read.kind !== "present") throw new Error(read.kind);
  const restored = applySaveSnapshot(project, read.snapshot);
  expect(session).toEqual(before);
  expect(storage.getItem(saveSlotKey(1))).toBe(raw);
  expect(restored.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
  expect(restored.lifeRecovery).toEqual(session.lifeRecovery);
  expect(restored.inventory).toEqual(session.inventory);
  expect(restored.gold).toBe(session.gold);
  return restored;
}

// These are paid-history limits, not the bounds of one cost input or one claim.
describe("cumulative spatial payment receipts", () => {
  it("H1 aggregates 64 historical rows plus a repeated upgrade item before any cost-input limit", () => {
    const { project, session } = fixture([{ items: rows(64) }, { items: rows(1) }]);
    build(project, session);
    expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
    expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: [{ itemId: "paid-0", count: 2 }, ...rows(63, 1)] });
    expect(session.inventory["paid-0"]).toBe(ITEM_QUANTITY_MAX - 2);
    roundtrip(project, session);
  });

  it("H2 preserves 32+33 paid items through Save5 and content removal, split and collected exactly once", () => {
    const { project, session } = fixture([{ items: rows(32) }, { items: rows(33, 32) }]);
    build(project, session);
    expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
    expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: rows(65) });
    const restored = roundtrip(project, session);
    const original = structuredClone(restored.farmBuildingPlacements!.home);
    project.database.farmBuildingTypes = [];
    const before = structuredClone(restored);
    const recovered = reconcileLifeState(project, restored);
    expect(restored).toEqual(before);
    expect(recovered.farmBuildingPlacements).toEqual({});
    expect(recovered.inventory).toEqual(before.inventory);
    const claims = Object.values(recovered.lifeRecovery!.claims);
    expect(claims.map(claim => claim.items.length)).toEqual([64, 1]);
    expect(claims.flatMap(claim => claim.items)).toEqual(rows(65));
    for (const claim of claims) {
      expect(isRecoveryItems(claim.items)).toBe(true);
      expect(claim.unresolved!.record).toEqual(original);
    }
    const resumed = roundtrip(project, recovered);
    expect(reconcileLifeState(project, resumed)).toEqual(resumed);
    const consumed = structuredClone(resumed);
    expect(moveLifeRecoverySource(project, resumed, { sourceKind: "farmBuildingPlacements", sourceId: "home", reason: "removed" })).toEqual({ ok: false, reason: "missing-source" });
    expect(resumed).toEqual(consumed);
    for (const claim of claims) {
      expect(collectLifeRecoveryClaim(project, resumed, claim.id).ok).toBe(true);
      const paid = structuredClone(resumed);
      expect(collectLifeRecoveryClaim(project, resumed, claim.id)).toEqual({ ok: false, reason: "missing-claim" });
      expect(resumed).toEqual(paid);
    }
    expect(resumed.inventory).toEqual(project.session.inventory);
    expect(resumed.gold).toBe(before.gold);
    expect(resumed.lifeRecovery).toEqual({ nextSequence: 3, claims: {} });
    roundtrip(project, resumed);
  });

  it("retains every one of 16 levels of 64 distinct accepted costs", () => {
    const costs = Array.from({ length: SPATIAL_LEVEL_LIMIT }, (_, i) => ({ items: rows(SPATIAL_COST_ITEM_LIMIT, i * SPATIAL_COST_ITEM_LIMIT) }));
    const { project, session } = fixture(costs);
    build(project, session);
    for (let level = 2; level <= SPATIAL_LEVEL_LIMIT; level++) expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
    expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: rows(1024) });
    roundtrip(project, session);
    project.database.farmBuildingTypes = [];
    const recovered = reconcileLifeState(project, session);
    expect(Object.values(recovered.lifeRecovery!.claims).map(claim => claim.items.length)).toEqual(Array(16).fill(64));
    expect(Object.values(recovered.lifeRecovery!.claims).flatMap(claim => claim.items)).toEqual(rows(1024));
  });

  it("accumulates repeated full stacks and wallets across all levels without raising transaction or claim limits", () => {
    const cost = { gold: GOLD_MAX, items: [{ itemId: "paid-0", count: ITEM_QUANTITY_MAX }] };
    const { project, session } = fixture(Array.from({ length: SPATIAL_LEVEL_LIMIT }, () => structuredClone(cost)));
    build(project, session);
    for (let level = 2; level <= SPATIAL_LEVEL_LIMIT; level++) {
      expect(changeItemsAtomically(session, [{ itemId: "paid-0", op: "+=", amount: ITEM_QUANTITY_MAX }])).toBe(true);
      session.gold = GOLD_MAX; // New earnings fund each payment, never an over-cap wallet.
      expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
      expect(session.gold).toBe(0);
      expect(session.inventory["paid-0"] ?? 0).toBe(0);
      expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: level * GOLD_MAX, items: [{ itemId: "paid-0", count: level * ITEM_QUANTITY_MAX }] });
    }
    const restored = roundtrip(project, session);
    project.database.farmBuildingTypes = [];
    const recovered = reconcileLifeState(project, restored);
    const claims = Object.values(recovered.lifeRecovery!.claims).filter(claim => claim.items.length > 0);
    const unpaid = Object.values(recovered.lifeRecovery!.claims).filter(claim => claim.items.length === 0);
    expect(claims.map(claim => claim.items)).toEqual(Array.from({ length: 16 }, () => cost.items));
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0]!.unresolved!.record).toEqual(restored.farmBuildingPlacements!.home);
    let collected = 0;
    for (const claim of claims) {
      expect(collectLifeRecoveryClaim(project, recovered, claim.id).ok).toBe(true);
      collected += recovered.inventory["paid-0"]!;
      const next = claims.find(candidate => Object.hasOwn(recovered.lifeRecovery!.claims, candidate.id));
      if (next) {
        const full = structuredClone(recovered);
        expect(collectLifeRecoveryClaim(project, recovered, next.id)).toEqual({ ok: false, reason: "inventory-overflow" });
        expect(recovered).toEqual(full);
      }
      expect(changeItemsAtomically(recovered, [{ itemId: "paid-0", op: "-=", amount: ITEM_QUANTITY_MAX }])).toBe(true);
    }
    expect(collected).toBe(16 * ITEM_QUANTITY_MAX);
    expect(recovered.gold).toBe(0); // Gold remains evidence only, never an invented payout.
    expect(recovered.lifeRecovery).toEqual({ nextSequence: 18, claims: { [unpaid[0]!.id]: unpaid[0] } });
    expect(unpaid[0]!.unresolved!.record).toMatchObject({ paymentReceipt: { gold: 16 * GOLD_MAX } });
    roundtrip(project, recovered);
  });

  it("refuses a two-claim conversion with only one slot free, preserving the entire source and previous save", () => {
    const { project, session } = fixture([{ items: rows(32) }, { items: rows(33, 32) }]);
    build(project, session);
    expect(upgradeFarmBuilding(project, session, "home").ok).toBe(true);
    session.lifeRecovery = { nextSequence: 4096, claims: Object.fromEntries(Array.from({ length: 4095 }, (_, i) => {
      const id = `recovery:${i + 1}`;
      return [id, { id, sourceKind: "shippingQueue", sourceId: "old", reason: "removed", items: rows(1) }];
    })) };
    const snapshot = createSaveSnapshot(project, session);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const raw = storage.getItem(saveSlotKey(1));
    project.database.farmBuildingTypes = [];
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "farmBuildingPlacements", sourceId: "home", reason: "removed" })).toEqual({ ok: false, reason: "capacity" });
    expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
    expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
    expect(session).toEqual(before);
    expect(storage.getItem(saveSlotKey(1))).toBe(raw);
  });

  it.each(["rows", "stack", "gold", "wallet"] as const)("keeps the original per-transaction %s bound and failure atomicity", kind => {
    const { project, session } = fixture([{ items: rows(1) }, { items: rows(1) }]);
    build(project, session);
    const cost = kind === "rows" ? { items: Array.from({ length: 65 }, () => rows(1)[0]!) }
      : kind === "stack" ? { items: [{ itemId: "paid-0", count: ITEM_QUANTITY_MAX + 1 }] }
      : kind === "gold" ? { gold: GOLD_MAX + 1 } : { gold: 1 };
    project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map(type => ({ ...type,
      levels: type.levels.map(level => level.level === 2 ? { ...level, cost } : level),
    }));
    if (kind === "wallet") session.gold = GOLD_MAX + 1;
    const before = structuredClone(session);
    expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: false, reason: "invalid" });
    expect(session).toEqual(before);
  });

  it.each(["gold", "items"] as const)("rejects unsafe cumulative %s addition without spending anything", field => {
    const { project, session } = fixture([{ items: rows(1) }, { gold: 1, items: rows(1) }]);
    build(project, session);
    const receipt = { gold: field === "gold" ? Number.MAX_SAFE_INTEGER : 0, items: [{ itemId: "paid-0", count: field === "items" ? Number.MAX_SAFE_INTEGER : 1 }] };
    Object.assign(session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
    expect(isSpatialPaymentReceipt(receipt)).toBe(true);
    roundtrip(project, session);
    const before = structuredClone(session);
    expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: false, reason: "invalid" });
    expect(session).toEqual(before);
  });

  it.each([
    { gold: -1, items: [] }, { gold: 0.5, items: [] }, { gold: Number.MAX_SAFE_INTEGER + 1, items: [] },
    ...[0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(count => ({ gold: 0, items: [{ itemId: "paid-0", count }] })),
    { gold: 0, items: [rows(1)[0]!, rows(1)[0]!] }, { gold: 0, items: [{ itemId: "", count: 1 }] },
    { gold: 0, items: null },
  ])("rejects malformed receipt %# at writer/read/apply while preserving raw and live owners", receipt => {
    const { project, session } = fixture([{ items: rows(1) }]);
    build(project, session);
    const snapshot = createSaveSnapshot(project, session);
    Object.assign(snapshot.session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
    const raw = JSON.stringify(snapshot);
    storage.setItem(saveSlotKey(1), raw);
    storage.setItem("oprn:save-slot:1", "legacy-raw-preserved");
    const before = structuredClone(session);
    expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
    expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
    expect(session).toEqual(before);
    Object.assign(session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
    const poisoned = structuredClone(session);
    expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
    expect(session).toEqual(poisoned);
    expect(storage.getItem(saveSlotKey(1))).toBe(raw);
    expect(storage.getItem("oprn:save-slot:1")).toBe("legacy-raw-preserved");
  });
});
