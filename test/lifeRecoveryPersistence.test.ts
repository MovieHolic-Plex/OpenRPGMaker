import { Window } from "happy-dom";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { collectLifeRecoveryClaim, reconcileLifeState } from "@/project/lifeRecovery";
import { startMaker } from "@/project/makers";
import { depositShipping } from "@/project/shipping";
import { applySaveSnapshot, autosaveKey, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { performAutosave, shouldAutosave } from "@/player/autosave";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { transitionToNextDay } from "@/player/dayTransition";

const window = new Window();
const localStorage = window.localStorage;
afterAll(() => window.close());

function fixture() {
  const project = createBlankProject();
  project.database.items.push(normalizeItemRecord({ id: "raw", name: "Raw", scope: "none", price: 10 }));
  project.database.items.push(normalizeItemRecord({ id: "product", name: "Product", scope: "none", price: 20 }));
  project.system.shipping = { enabled: true };
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.bundles = [{ id: "bundle", requirements: [{ itemId: "raw", count: 5 }] }];
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  const session = startSession(project, 404);
  session.inventory.raw = 10;
  return { project, session };
}
function roundtrip(project: ReturnType<typeof fixture>["project"], session: ReturnType<typeof startSession>) {
  expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
  const read = readSaveSlot(localStorage, 1);
  if (read.kind !== "present") throw new Error(`save read: ${read.kind}`);
  return applySaveSnapshot(project, read.snapshot);
}
afterEach(() => localStorage.clear());

describe("lossless life persistence", () => {
  it("keeps compatible shipping and unfinished legacy maker behavior", () => {
    const { project, session } = fixture();
    expect(depositShipping(project, session, "raw", 3).ok).toBe(true);
    session.makerInstances = { old: { instanceId: "old", makerId: "maker", status: "processing", startedAtMinute: 0, readyAtMinute: 60 } };
    const restored = roundtrip(project, session);
    expect(restored.shippingQueue).toEqual({ raw: 3 });
    expect(restored.inventory.raw).toBe(7);
    expect(restored.makerInstances).toEqual(session.makerInstances);
    expect(restored.lifeRecovery).toBeUndefined();
  });
  it("keeps contribution2 and recovers only excess3 after requirement5 becomes2", () => {
    const { project, session } = fixture();
    session.bundleContributions = { bundle: { raw: 5 } };
    project.system.bundles = [{ id: "bundle", requirements: [{ itemId: "raw", count: 2 }] }];
    const before = structuredClone(session);
    const restored = roundtrip(project, session);
    expect(session).toEqual(before);
    expect(restored.bundleContributions).toEqual({ bundle: { raw: 2 } });
    expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([{ sourceKind: "bundleContributions", sourceId: "bundle", items: [{ itemId: "raw", count: 3 }] }]);
    const again = roundtrip(project, restored);
    expect(again.lifeRecovery).toEqual(restored.lifeRecovery);
    expect(again.bundleContributions).toEqual(restored.bundleContributions);
    expect(collectLifeRecoveryClaim(project, again, "recovery:1").ok).toBe(true);
    expect(collectLifeRecoveryClaim(project, again, "recovery:1").ok).toBe(false);
    expect(roundtrip(project, again).lifeRecovery).toEqual({ nextSequence: 2, claims: {} });
    expect(again.inventory.raw).toBe(13);
  });
  it("retains removed completed bundle tombstones and dormant unlock rights without refunds", () => {
    const { project, session } = fixture();
    session.bundleContributions = { bundle: { raw: 5 } };
    session.completedBundleIds = ["bundle"];
    session.unlockedRegionIds = ["removed-region"];
    session.unlockedRecipeIds = ["removed-recipe"];
    delete project.system.bundles;
    const restored = roundtrip(project, session);
    expect(restored.completedBundleIds).toEqual(["bundle"]);
    expect(restored.bundleRewardAppliedIds).toEqual(["bundle"]);
    expect(restored.unlockedRegionIds).toEqual(["removed-region"]);
    expect(restored.unlockedRecipeIds).toEqual(["removed-recipe"]);
    expect(restored.lifeRecovery).toBeUndefined();
  });
  it.each(["disabled", "removed", "ineligible"] as const)("moves %s shipping before writer filtering without paying inventory", (change) => {
    const { project, session } = fixture();
    expect(depositShipping(project, session, "raw", 3).ok).toBe(true);
    if (change === "disabled") project.system.shipping = { enabled: false };
    if (change === "removed") project.database.items = project.database.items.filter((item) => item.id !== "raw");
    if (change === "ineligible") project.system.shipping = { enabled: true, allowedItemIds: [] };
    const restored = roundtrip(project, session);
    expect(restored.shippingQueue).toEqual({});
    expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([{ items: [{ itemId: "raw", count: 3 }] }]);
    expect(session.inventory.raw).toBe(7);
    if (change === "removed") {
      expect(collectLifeRecoveryClaim(project, restored, "recovery:1").ok).toBe(false);
      expect(restored.lifeRecovery?.claims["recovery:1"]?.unresolved?.record).toBe(3);
    }
  });
  it.each([29, 30])("cancels removed frozen makers at original minute %i through apply", (minute) => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "job", "maker", 0).ok).toBe(true);
    session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute };
    const snapshot = createSaveSnapshot(project, session);
    delete project.system.makers;
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.makerInstances).toEqual({});
    expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([{ items: [{ itemId: minute === 29 ? "raw" : "product", count: minute === 29 ? 3 : 2 }] }]);
    expect(roundtrip(project, restored).lifeRecovery).toEqual(restored.lifeRecovery);
  });
  it("rejects corrupt recovery at read and direct apply without touching source bytes", () => {
    const { project, session } = fixture();
    const snapshot = { ...createSaveSnapshot(project, session), session: { ...createSaveSnapshot(project, session).session, lifeRecovery: { nextSequence: 1, claims: { "recovery:1": { id: "recovery:1", sourceKind: "shippingQueue", sourceId: "raw", reason: "removed", items: [{ itemId: "raw", count: 3 }] } } } } };
    const raw = JSON.stringify(snapshot);
    localStorage.setItem(saveSlotKey(1), raw);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(() => applySaveSnapshot(project, snapshot)).toThrow();
    expect(localStorage.getItem(saveSlotKey(1))).toBe(raw);
  });
  it("returns failed autosave on reconciliation failure, preserving prior disk and current live action", () => {
    const { project, session } = fixture();
    expect(performAutosave(project, session, localStorage, "transfer")).not.toBeNull();
    const prior = localStorage.getItem(autosaveKey());
    expect(depositShipping(project, session, "raw", 3).ok).toBe(true);
    session.lifeRecovery = { nextSequence: 0, claims: {} };
    const before = structuredClone(session);
    expect(performAutosave(project, session, localStorage, "transfer")).toBeNull();
    expect(session).toEqual(before);
    expect(localStorage.getItem(autosaveKey())).toBe(prior);
    ensureM2Runtime(session).access.save = false;
    expect(shouldAutosave(session, "transfer", null, 0, project)).toBe(false);
  });
  it("rolls back the whole day when reconciliation fails", () => {
    const { project, session } = fixture();
    session.lifeRecovery = { nextSequence: 0, claims: {} };
    const before = structuredClone(session);
    expect(transitionToNextDay(project, session, "1:spring:1")).toMatchObject({ ok: false, reason: "recovery", stage: "recovery" });
    expect(session).toEqual(before);
  });
});


describe("adversarial life codec boundaries", () => {
  it("preserves opaque legacy owners through the parser without guessing payouts", () => {
    const { project, session } = fixture();
    const snapshot = createSaveSnapshot(project, session);
    const unknown = { oldVersion: 7, paid: ["unproven"], nested: { note: "keep me" } };
    Object.assign(snapshot.session, {
      shippingQueue: { oldShipment: unknown }, makerInstances: { oldMaker: unknown },
      farmAnimals: { oldAnimal: unknown }, farmBuildingPlacements: { oldBuilding: unknown },
      homeDecorationPlacements: { oldDecoration: unknown },
    });
    localStorage.setItem(saveSlotKey(1), JSON.stringify(snapshot));
    const read = readSaveSlot(localStorage, 1);
    if (read.kind !== "present") throw new Error(read.kind);
    const restored = applySaveSnapshot(project, read.snapshot);
    const claims = Object.values(restored.lifeRecovery?.claims ?? {});
    expect(claims).toHaveLength(5);
    for (const claim of claims) {
      expect(claim.items).toEqual([]);
      expect(claim.unresolved?.record).toEqual(unknown);
      const before = structuredClone(restored);
      expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(false);
      expect(restored).toEqual(before);
    }
    expect(roundtrip(project, restored).lifeRecovery).toEqual(restored.lifeRecovery);
  });
  it.each([29, 30])("uses original maker clock on changed day start at minute %i", (minute) => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "job", "maker", 0).ok).toBe(true);
    session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute };
    const snapshot = createSaveSnapshot(project, session);
    project.system.timeSystem = { enabled: true, dayStartHour: 8, dayEndHour: 20, daysPerSeason: 20 };
    for (const restored of [applySaveSnapshot(project, snapshot), roundtrip(project, session)]) {
      expect(restored.makerInstances).toEqual({});
      expect(restored.lifeRecovery?.claims["recovery:1"]?.items).toEqual([{ itemId: minute === 29 ? "raw" : "product", count: minute === 29 ? 3 : 2 }]);
    }
  });
  it("synchronizes compatible makers only on apply, not snapshot creation", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "job", "maker", 0).ok).toBe(true);
    session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 30 };
    const before = structuredClone(session);
    const snapshot = createSaveSnapshot(project, session);
    expect(session).toEqual(before);
    expect(snapshot.session.makerInstances?.job?.status).toBe("processing");
    expect(applySaveSnapshot(project, snapshot).makerInstances?.job?.status).toBe("ready");
  });
  it("restores plots before spatial placement, retains raw removed species and rejected placement", () => {
    const { project, session } = fixture();
    project.database.farmBuildingTypes = [{ id: "shed", name: "Shed", levels: [{ level: 1, footprint: { width: 1, height: 1 }, capacity: 1, graphicResourceId: "easyrpg-picture-cloud" }] }];
    const placement = { instanceId: "shed", typeId: "shed", level: 1, mapId: project.startMapId, x: 2, y: 2, orientation: "down" as const };
    const animal = { instanceId: "old", speciesId: "removed", name: "Old", friendship: 73, productionProgress: 1, readyProductCount: 2, lastFedDayKey: "1:spring:1" };
    session.farmBuildingPlacements = { shed: placement };
    session.farmAnimals = { old: animal };
    session.farmPlots = { [project.startMapId]: { "2,2": { tilled: true, watered: true, stage: 0 } } };
    const before = structuredClone(session);
    const restored = roundtrip(project, session);
    expect(session).toEqual(before);
    expect(restored.farmBuildingPlacements).toEqual({});
    expect(restored.farmAnimals).toEqual({});
    expect(restored.farmPlots).toEqual(session.farmPlots);
    expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([
      { sourceKind: "farmBuildingPlacements", items: [], unresolved: { record: placement } },
      { sourceKind: "farmAnimals", items: [], unresolved: { record: animal } },
    ]);
    expect(roundtrip(project, restored).lifeRecovery).toEqual(restored.lifeRecovery);
  });
  it("keeps valid paid placements and their detached receipts through read and apply", () => {
    const { project, session } = fixture();
    project.database.farmBuildingTypes = [{ id: "shed", name: "Shed", levels: [{ level: 1, footprint: { width: 1, height: 1 }, capacity: 1, graphicResourceId: "easyrpg-picture-cloud" }] }];
    session.farmBuildingPlacements = { shed: { instanceId: "shed", typeId: "shed", level: 1, mapId: project.startMapId, x: 2, y: 2, orientation: "down", paymentReceipt: { gold: 25, items: [{ itemId: "raw", count: 2 }] } } };
    session.x = 2;
    session.y = 2;
    const restored = roundtrip(project, session);
    expect(restored.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
    expect(restored.lifeRecovery).toBeUndefined();
  });
  it("preserves stale generated forage raw rather than paying a guessed harvest", () => {
    const { project, session } = fixture();
    const sourceId = `${project.startMapId}:2,2`;
    const original = { id: "spawn", mapId: project.startMapId, x: 2, y: 2, kind: "forage", itemId: "raw", forageSpawn: { areaId: "removed", entryId: "removed", spawnedDayKey: "1:spring:1" } };
    session.placeables = { [sourceId]: original };
    const restored = roundtrip(project, session);
    expect(restored.placeables).toEqual({});
    expect(restored.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [], unresolved: { record: original } });
  });
  it("rejects a duplicate raw JSON claim key instead of silently keeping its last owner", () => {
    const { project, session } = fixture();
    const claim = { id: "recovery:1", sourceKind: "shippingQueue", sourceId: "raw", reason: "removed", items: [{ itemId: "raw", count: 3 }] };
    session.lifeRecovery = { nextSequence: 2, claims: { "recovery:1": claim } };
    const text = JSON.stringify(createSaveSnapshot(project, session));
    const duplicate = text.replace('"claims":{', `"claims":{"recovery:1":${JSON.stringify(claim)},`);
    localStorage.setItem(saveSlotKey(1), duplicate);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(localStorage.getItem(saveSlotKey(1))).toBe(duplicate);
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid owned quantity %s without truncation", (count) => {
    const { project, session } = fixture();
    const snapshot = createSaveSnapshot(project, session);
    Object.assign(snapshot.session, { shippingQueue: { raw: count } });
    const text = JSON.stringify(snapshot);
    localStorage.setItem(saveSlotKey(1), text);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(() => applySaveSnapshot(project, snapshot)).toThrow();
    expect(localStorage.getItem(saveSlotKey(1))).toBe(text);
  });
  it("refuses all conversions on claim exhaustion without moving a prefix", () => {
    const { project, session } = fixture();
    session.lifeRecovery = { nextSequence: 4096, claims: Object.fromEntries(Array.from({ length: 4095 }, (_, i) => {
      const id = `recovery:${i + 1}`;
      return [id, { id, sourceKind: "shippingQueue", sourceId: `old${i}`, reason: "removed", items: [{ itemId: "raw", count: 1 }] }];
    })) };
    session.shippingQueue = { raw: 2, product: 3 };
    project.system.shipping = { enabled: false };
    const before = structuredClone(session);
    expect(() => createSaveSnapshot(project, session)).toThrow();
    expect(session).toEqual(before);
    expect(transitionToNextDay(project, session, "1:spring:1")).toMatchObject({ ok: false, stage: "recovery", sourceId: "product" });
    expect(session).toEqual(before);
  });
  it("rejects oversized unknown originals at the parser, preserving the disk slot", () => {
    const { project, session } = fixture();
    const snapshot = createSaveSnapshot(project, session);
    Object.assign(snapshot.session, { makerInstances: { old: { legacy: "界".repeat(23000) } } });
    const text = JSON.stringify(snapshot);
    localStorage.setItem(saveSlotKey(1), text);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(localStorage.getItem(saveSlotKey(1))).toBe(text);
  });
  it("rolls back recovery, inventory, date and receipts when a later energy stage fails", () => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: 3 };
    project.system.shipping = { enabled: false };
    project.system.energy = { max: 10, initial: 10, restorePerDay: -1 };
    const before = structuredClone(session);
    expect(transitionToNextDay(project, session, "1:spring:1")).toMatchObject({ ok: false, stage: "energy" });
    expect(session).toEqual(before);
  });
  it("keeps a successful claim action in memory when subsequent autosave hits quota", () => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: 3 };
    project.system.shipping = { enabled: false };
    const restored = roundtrip(project, session);
    expect(performAutosave(project, restored, localStorage, "transfer")).not.toBeNull();
    const disk = localStorage.getItem(autosaveKey());
    expect(collectLifeRecoveryClaim(project, restored, "recovery:1").ok).toBe(true);
    const before = structuredClone(restored);
    const quota: Storage = {
      get length() { return localStorage.length; }, clear: () => localStorage.clear(), key: (i) => localStorage.key(i),
      getItem: (key) => localStorage.getItem(key), removeItem: (key) => localStorage.removeItem(key),
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
    };
    expect(performAutosave(project, restored, quota, "transfer")).toBeNull();
    expect(restored).toEqual(before);
    expect(localStorage.getItem(autosaveKey())).toBe(disk);
    expect(collectLifeRecoveryClaim(project, restored, "recovery:1").ok).toBe(false);
  });
});


describe("source definition churn", () => {
  it("preserves legacy placeables whose explicit item definition disappeared", () => {
    const { project, session } = fixture();
    const sourceId = `${project.startMapId}:2,2`;
    const original = { id: "rock", mapId: project.startMapId, x: 2, y: 2, kind: "rock", itemId: "missing" };
    session.placeables = { [sourceId]: original };
    const restored = roundtrip(project, session);
    expect(restored.placeables).toEqual({});
    expect(restored.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [], unresolved: { record: original } });
  });
  it("does not auto-pay unknown claims when definitions return", () => {
    const { project, session } = fixture();
    session.shippingQueue = { returned: 3 };
    const first = roundtrip(project, session);
    project.database.items.push(normalizeItemRecord({ id: "returned", name: "Returned", scope: "none", price: 1 }));
    const resumed = roundtrip(project, first);
    expect(resumed.inventory.returned).toBeUndefined();
    expect(resumed.lifeRecovery).toEqual(first.lifeRecovery);
    expect(collectLifeRecoveryClaim(project, resumed, "recovery:1").ok).toBe(true);
    expect(roundtrip(project, resumed).inventory.returned).toBe(3);
  });
});


describe("load refusal bounds and pure reconciliation", () => {
  it.each(["claim-limit", "item-limit", "total-bytes", "raw-bytes", "unsafe-sequence"] as const)("rejects %s at the real Save5 reader without overwriting bytes", (kind) => {
    const { project, session } = fixture();
    const snapshot = createSaveSnapshot(project, session);
    const claim = { id: "recovery:1", sourceKind: "shippingQueue", sourceId: "raw", reason: "removed", items: [{ itemId: "raw", count: 1 }] };
    let lifeRecovery: unknown;
    switch (kind) {
      case "claim-limit": lifeRecovery = { nextSequence: 4098, claims: Object.fromEntries(Array.from({ length: 4097 }, (_, i) => { const id = `recovery:${i + 1}`; return [id, { ...claim, id }]; })) }; break;
      case "item-limit": lifeRecovery = { nextSequence: 2, claims: { "recovery:1": { ...claim, items: Array.from({ length: 65 }, (_, i) => ({ itemId: `item${i}`, count: 1 })) } } }; break;
      case "total-bytes": lifeRecovery = { nextSequence: 2, claims: { "recovery:1": { ...claim, reason: "x".repeat(8 * 1024 * 1024) } } }; break;
      case "raw-bytes": lifeRecovery = { nextSequence: 2, claims: { "recovery:1": { ...claim, unresolved: { record: "x".repeat(65536), detail: "legacy" } } } }; break;
      case "unsafe-sequence": lifeRecovery = { nextSequence: Number.MAX_SAFE_INTEGER + 1, claims: {} }; break;
      default: { const exhaustive: never = kind; throw new Error(exhaustive); }
    }
    Object.assign(snapshot.session, { lifeRecovery });
    const raw = JSON.stringify(snapshot);
    localStorage.setItem(saveSlotKey(1), raw);
    expect(readSaveSlot(localStorage, 1).kind).toBe("corrupt");
    expect(localStorage.getItem(saveSlotKey(1))).toBe(raw);
    expect(() => applySaveSnapshot(project, snapshot)).toThrow();
  });
  it("returns an idempotent reconciled draft without mutating its input or paying items", () => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: 3 };
    project.system.shipping = { enabled: false };
    const before = structuredClone(session);
    const result = reconcileLifeState(project, session);
    expect(session).toEqual(before);
    expect(result.inventory).toEqual(before.inventory);
    expect(result.shippingQueue).toEqual({});
    expect(reconcileLifeState(project, result)).toEqual(result);
  });
});


describe("bounded animal restoration", () => {
  it("quarantines animals beyond the runtime bound instead of dropping a saved suffix", () => {
    const { project, session } = fixture();
    project.database.farmAnimalSpecies = [{ id: "species", name: "Species", feedItemId: "raw", productItemId: "product", productCount: 1, productEveryDays: 1, petFriendship: 1 }];
    session.farmAnimals = Object.fromEntries(Array.from({ length: 501 }, (_, i) => {
      const instanceId = `animal${i}`;
      return [instanceId, { instanceId, speciesId: "species", name: instanceId, friendship: 3, productionProgress: 0, readyProductCount: 1 }];
    }));
    const restored = roundtrip(project, session);
    expect(Object.keys(restored.farmAnimals ?? {})).toHaveLength(500);
    expect(restored.lifeRecovery?.claims["recovery:1"]).toMatchObject({ sourceId: "animal500", items: [], unresolved: { record: session.farmAnimals.animal500 } });
    expect(roundtrip(project, restored).lifeRecovery).toEqual(restored.lifeRecovery);
  });
});
