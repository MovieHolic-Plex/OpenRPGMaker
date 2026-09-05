import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { advanceMakers, collectMaker, startMaker } from "@/project/makers";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim, isLifeRecoveryJson, isLifeRecoveryState, moveLifeRecoverySource } from "@/project/lifeRecovery";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { startSession, type LifeRecoveryClaim, type LifeRecoveryState } from "@/project/session";
import * as validation from "@/player/saveSlotValidation";

function fixture() {
  const project = createBlankProject();
  project.database.items.push(...["raw", "product"].map((id) =>
    normalizeItemRecord({ id, name: id, scope: "none", price: 1 })));
  project.system.timeSystem = { enabled: true, dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 };
  project.system.makers = [{ id: "maker", inputs: [{ itemId: "raw", count: 3 }],
    outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30 }];
  const session = startSession(project, 3);
  session.inventory = { raw: 3 };
  return { project, session };
}

describe("life transaction evidence", () => {
  it("freezes spent inputs, promised outputs, duration and calendar when starting", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    expect(session.makerInstances?.one).toMatchObject({ contract: {
      inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }],
      durationMinutes: 30, timeBasis: { dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 },
    } });
    expect(session.inventory.raw).toBeUndefined();
  });

  it("pays the original promise when the definition changes during a new job", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    project.system.makers = [{ id: "maker", inputs: [], outputs: [{ itemId: "product", count: 9 }], durationMinutes: 900 }];
    expect(advanceMakers(project, session, 40).ok).toBe(true);
    expect(collectMaker(project, session, "one")).toMatchObject({ ok: true, outputs: [{ itemId: "product", count: 2 }] });
    expect(session.inventory.product).toBe(2);
  });

  it("retains current-definition payout for legacy jobs without a contract", () => {
    const { project, session } = fixture();
    session.makerInstances = { old: { instanceId: "old", makerId: "maker", status: "processing", startedAtMinute: 10, readyAtMinute: 40 } };
    expect(advanceMakers(project, session, 40).ok).toBe(true);
    expect(collectMaker(project, session, "old")).toMatchObject({ ok: true, outputs: [{ itemId: "product", count: 2 }] });
    expect(session.inventory.product).toBe(2);
  });

  it("rejects malformed new contracts at the existing save validation seam", () => {
    const instance = { instanceId: "one", makerId: "maker", status: "processing", startedAtMinute: 10, readyAtMinute: 40,
      contract: { inputs: [{ itemId: "raw", count: -3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30,
        timeBasis: { dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 } } };
    expect(validation.isMakerInstancesRecord({ one: instance })).toBe(false);
  });

  it("exposes a bounded recovery-state validator at the save boundary", () => {
    expect(validation).toHaveProperty("isLifeRecoveryState");
  });
});

const shippingSource = { sourceKind: "shippingQueue", sourceId: "raw", reason: "disabled" } as const;
function claim(sequence: number): LifeRecoveryClaim {
  return { id: `recovery:${sequence}`, sourceKind: "shippingQueue", sourceId: "raw", reason: "disabled", items: [{ itemId: "raw", count: 3 }] };
}
function state(count = 1): LifeRecoveryState {
  return { nextSequence: count + 1, claims: Object.fromEntries(Array.from({ length: count }, (_, index) => [ `recovery:${index + 1}`, claim(index + 1) ])) };
}

describe("bounded recovery ownership", () => {
  it("moves three items source to claim to inventory exactly once and never rewinds sequence", () => {
    const { project, session } = fixture();
    session.inventory = {};
    session.shippingQueue = { raw: 3 };
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: true, claimIds: ["recovery:1"] });
    expect(session.shippingQueue).toEqual({});
    expect(session.inventory).toEqual({});
    expect(session.lifeRecovery).toEqual(state());
    const transferred = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: false, reason: "missing-source" });
    expect(session).toEqual(transferred);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1").ok).toBe(true);
    expect(session.inventory).toEqual({ raw: 3 });
    expect(session.lifeRecovery).toEqual({ nextSequence: 2, claims: {} });
    const collected = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "missing-claim" });
    expect(session).toEqual(collected);
    session.shippingQueue = { raw: 1 };
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: true, claimIds: ["recovery:2"] });
  });

  it("keeps independent source kinds distinct even when source IDs match", () => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: 3 };
    session.bundleContributions = { raw: { product: 2 } };
    expect(moveLifeRecoverySource(project, session, shippingSource).ok).toBe(true);
    expect(session.bundleContributions).toEqual({ raw: { product: 2 } });
    expect(moveLifeRecoverySource(project, session, { ...shippingSource, sourceKind: "bundleContributions" }).ok).toBe(true);
    expect(Object.values(session.lifeRecovery?.claims ?? {}).map((entry) => entry.sourceKind)).toEqual(["shippingQueue", "bundleContributions"]);
  });

  it("rejects full destination inventory without paying or consuming any claim field", () => {
    const { project, session } = fixture();
    session.lifeRecovery = state();
    session.inventory.raw = ITEM_QUANTITY_MAX - 2;
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "inventory-overflow" });
    expect(session).toEqual(before);
  });

  it("rolls back all payout side effects when collection metadata is invalid", () => {
    const { project, session } = fixture();
    session.lifeRecovery = state();
    session.collections = { raw: { discovered: false, shippedCount: -1, caughtCount: 0, donated: false } };
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1").ok).toBe(false);
    expect(session).toEqual(before);
  });

  it("keeps unknown item evidence until an explicit receipt after the item returns", () => {
    const { project, session } = fixture();
    session.shippingQueue = { missing: 3 };
    const source = { ...shippingSource, sourceId: "missing" };
    expect(moveLifeRecoverySource(project, session, source).ok).toBe(true);
    expect(session.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [{ itemId: "missing", count: 3 }], unresolved: { record: 3 } });
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "unresolved" });
    expect(session).toEqual(before);
    project.database.items.push(normalizeItemRecord({ id: "missing", name: "missing", scope: "none", price: 1 }));
    expect(session).toEqual(before);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1").ok).toBe(true);
    expect(session.inventory.missing).toBe(3);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid source count %s without loss", (count) => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: count };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource).ok).toBe(false);
    expect(session).toEqual(before);
  });

  it("accepts claim 4096 then refuses claim 4097 without removing its owner or sequence", () => {
    const { project, session } = fixture();
    session.lifeRecovery = state(4095);
    session.shippingQueue = { raw: 3 };
    expect(moveLifeRecoverySource(project, session, shippingSource).ok).toBe(true);
    expect(Object.keys(session.lifeRecovery?.claims ?? {})).toHaveLength(4096);
    session.shippingQueue = { raw: 3 };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: false, reason: "capacity" });
    expect(session).toEqual(before);
  });

  it("splits large proven quantities into capped claims without losing a unit", () => {
    const { project, session } = fixture();
    session.shippingQueue = { raw: ITEM_QUANTITY_MAX * 2 + 3 };
    expect(moveLifeRecoverySource(project, session, shippingSource).ok).toBe(true);
    expect(Object.values(session.lifeRecovery?.claims ?? {}).map((entry) => entry.items)).toEqual([
      [{ itemId: "raw", count: ITEM_QUANTITY_MAX }], [{ itemId: "raw", count: ITEM_QUANTITY_MAX }], [{ itemId: "raw", count: 3 }],
    ]);
    expect(session.shippingQueue).toEqual({});
  });

  it("rejects a multi-claim split in advance when only one slot remains", () => {
    const { project, session } = fixture();
    session.lifeRecovery = state(4095);
    session.shippingQueue = { raw: ITEM_QUANTITY_MAX + 1 };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: false, reason: "capacity" });
    expect(session).toEqual(before);
  });

  it("splits 65 distinct items into 64 plus 1 and preserves unknown source JSON", () => {
    const { project, session } = fixture();
    const original = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`unknown:${index}`, 1]));
    session.bundleContributions = { raw: original };
    expect(moveLifeRecoverySource(project, session, { ...shippingSource, sourceKind: "bundleContributions" }).ok).toBe(true);
    expect(Object.values(session.lifeRecovery?.claims ?? {}).map((entry) => entry.items.length)).toEqual([64, 1]);
    expect(session.lifeRecovery?.claims["recovery:1"]?.unresolved?.record).toEqual(original);
  });

  it("rejects sequence exhaustion without deleting the source", () => {
    const { project, session } = fixture();
    session.lifeRecovery = { nextSequence: Number.MAX_SAFE_INTEGER, claims: {} };
    session.shippingQueue = { raw: 3 };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: false, reason: "capacity" });
    expect(session).toEqual(before);
  });

  it("never refunds completed bundle tombstones", () => {
    const { project, session } = fixture();
    session.bundleContributions = { raw: { raw: 3 } };
    session.bundleRewardAppliedIds = ["raw"];
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { ...shippingSource, sourceKind: "bundleContributions" }).ok).toBe(false);
    expect(session).toEqual(before);
  });

  it("does not treat inherited record names as owned sources or claims", () => {
    const { project, session } = fixture();
    session.lifeRecovery = state();
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { ...shippingSource, sourceId: "constructor" })).toEqual({ ok: false, reason: "missing-source" });
    expect(collectLifeRecoveryClaim(project, session, "__proto__")).toEqual({ ok: false, reason: "missing-claim" });
    expect(session).toEqual(before);
  });
});

describe("recovery save boundary schema", () => {
  it("accepts exactly 4096 claims and rejects excess without trimming input", () => {
    expect(validation.isLifeRecoveryState(state(4096))).toBe(true);
    const excessive = state(4097);
    expect(validation.isLifeRecoveryState(excessive)).toBe(false);
    expect(Object.keys(excessive.claims)).toHaveLength(4097);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe sequence %s", (nextSequence) => {
    expect(isLifeRecoveryState({ ...state(), nextSequence })).toBe(false);
  });
  it.each([0, -1, 1.5, NaN, Infinity, ITEM_QUANTITY_MAX + 1])("rejects invalid stored count %s", (count) => {
    const entry = { ...claim(1), items: [{ itemId: "raw", count }] };
    expect(isLifeRecoveryState({ nextSequence: 2, claims: { "recovery:1": entry } })).toBe(false);
  });
  it("rejects duplicate IDs, stale sequence, mismatched keys, duplicate items and excessive distinct items", () => {
    expect(isLifeRecoveryState({ nextSequence: 3, claims: { "recovery:1": claim(1), "recovery:2": claim(1) } })).toBe(false);
    expect(isLifeRecoveryState({ ...state(), nextSequence: 1 })).toBe(false);
    expect(isLifeRecoveryState({ nextSequence: 2, claims: { "recovery:01": claim(1) } })).toBe(false);
    const items = Array.from({ length: 64 }, (_, index) => ({ itemId: `${index}`, count: ITEM_QUANTITY_MAX }));
    const valid = { nextSequence: 2, claims: { "recovery:1": { ...claim(1), items } } };
    expect(isLifeRecoveryState(valid)).toBe(true);
    expect(isLifeRecoveryState({ nextSequence: 2, claims: { "recovery:1": { ...claim(1), items: [...items, { itemId: "65", count: 1 }] } } })).toBe(false);
    expect(isLifeRecoveryState({ nextSequence: 2, claims: { "recovery:1": { ...claim(1), items: [{ itemId: "raw", count: 1 }, { itemId: "raw", count: 1 }] } } })).toBe(false);
  });
  it("measures exact UTF-8 raw JSON bytes, including quotes and multibyte characters", () => {
    const raw = "é".repeat(32767); // JSON string = 65534 UTF-8 data bytes + two quotes.
    const make = (record: string) => ({ nextSequence: 2, claims: { "recovery:1": { ...claim(1), unresolved: { record, detail: "unknown" } } } });
    expect(isLifeRecoveryState(make(raw))).toBe(true);
    expect(isLifeRecoveryState(make(raw + "a"))).toBe(false);
  });
  it("accepts exactly 8 MiB total and rejects one extra byte without normalizing input", () => {
    const base = state();
    const bytes = new TextEncoder().encode(JSON.stringify(base)).length;
    const entry = claim(1);
    const atLimit = { ...base, claims: { "recovery:1": { ...entry, reason: entry.reason + "x".repeat(8 * 1024 * 1024 - bytes) } } };
    expect(new TextEncoder().encode(JSON.stringify(atLimit)).length).toBe(8 * 1024 * 1024);
    expect(isLifeRecoveryState(atLimit)).toBe(true);
    const overLimit = { ...atLimit, nextSequence: 10 };
    const original = JSON.stringify(overLimit);
    expect(isLifeRecoveryState(overLimit)).toBe(false);
    expect(JSON.stringify(overLimit)).toBe(original);
  });
  it("rejects non-JSON evidence including cycles, sparse arrays, NaN, undefined and accessors", () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    for (const raw of [cycle, [,,], NaN, { value: undefined }, new Date(0), { get value() { throw new Error("must not execute"); } }]) {
      expect(isLifeRecoveryJson(raw)).toBe(false);
    }
  });
});

describe("maker contract ownership and resume", () => {
  it.each([39, 40])("cancels at minute %s to the frozen input or output, not the edited definition", (absoluteMinute) => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    project.system.makers = [];
    expect(moveLifeRecoverySource(project, session, { sourceKind: "makerInstances", sourceId: "one", reason: "deleted", absoluteMinute }).ok).toBe(true);
    expect(session.makerInstances).toEqual({});
    expect(session.lifeRecovery?.claims["recovery:1"]?.items).toEqual(absoluteMinute < 40 ? [{ itemId: "raw", count: 3 }] : [{ itemId: "product", count: 2 }]);
    expect(session.inventory).toEqual({});
  });
  it("retains unproven legacy jobs verbatim without guessing a refund", () => {
    const { project, session } = fixture();
    const old = { instanceId: "old", makerId: "deleted", status: "processing", startedAtMinute: 10, readyAtMinute: 40 } as const;
    session.makerInstances = { old };
    expect(moveLifeRecoverySource(project, session, { sourceKind: "makerInstances", sourceId: "old", reason: "deleted" }).ok).toBe(true);
    expect(session.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [], unresolved: { record: old } });
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "unresolved" });
    expect(session).toEqual(before);
  });
  it("keeps a new contract detached from authored arrays and through the actual save/apply seam", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    const definition = project.system.makers?.[0];
    if (!definition) throw new Error("fixture maker missing");
    definition.inputs.splice(0, 1, { itemId: "raw", count: 1 });
    definition.outputs.splice(0, 1, { itemId: "product", count: 9 });
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.makerInstances?.one?.contract).toEqual({ inputs: [{ itemId: "raw", count: 3 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30,
      timeBasis: { dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 } });
    expect(advanceMakers(project, restored, 40).ok).toBe(true);
    expect(collectMaker(project, restored, "one").ok).toBe(true);
    expect(restored.inventory.product).toBe(2);
    expect(session.makerInstances?.one?.status).toBe("processing");
  });
  it("uses the changed definition only for the next job", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    expect(advanceMakers(project, session, 40).ok).toBe(true);
    expect(collectMaker(project, session, "one").ok).toBe(true);
    project.system.makers = [{ id: "maker", inputs: [], outputs: [{ itemId: "product", count: 9 }], durationMinutes: 3 }];
    expect(startMaker(project, session, "one", "maker", 40)).toMatchObject({ ok: true, readyAtMinute: 43 });
    expect(session.makerInstances?.one?.contract?.outputs).toEqual([{ itemId: "product", count: 9 }]);
  });
  it("preserves a ready maker and its contract on overflow or missing promised item", () => {
    const { project, session } = fixture();
    expect(startMaker(project, session, "one", "maker", 10).ok).toBe(true);
    expect(advanceMakers(project, session, 40).ok).toBe(true);
    session.inventory.product = ITEM_QUANTITY_MAX;
    const before = structuredClone(session);
    expect(collectMaker(project, session, "one")).toMatchObject({ ok: false, reason: "inventory-overflow" });
    expect(session).toEqual(before);
    project.database.items = project.database.items.filter((item) => item.id !== "product");
    expect(collectMaker(project, session, "one")).toMatchObject({ ok: false, reason: "invalid-definition" });
    expect(session).toEqual(before);
  });
});


describe("adversarial source conversion", () => {
  it("rejects malformed maker evidence rather than refunding a different valid side", () => {
    const { project, session } = fixture();
    session.makerInstances = { bad: { instanceId: "bad", makerId: "maker", status: "processing", startedAtMinute: 10, readyAtMinute: 40,
      contract: { inputs: [{ itemId: "raw", count: -1 }], outputs: [{ itemId: "product", count: 2 }], durationMinutes: 30,
        timeBasis: { dayStartHour: 5, dayEndHour: 27, daysPerSeason: 40 } } } };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "makerInstances", sourceId: "bad", reason: "deleted", absoluteMinute: 40 }).ok).toBe(false);
    expect(session).toEqual(before);
  });
  it("validates a large JSON array without overflowing the call stack", () => {
    expect(isLifeRecoveryJson(Array.from({ length: 200_000 }, () => 0))).toBe(true);
  });
  it("preserves spatial raw evidence without guessing a historic construction cost", () => {
    const { project, session } = fixture();
    const placement = { instanceId: "old", typeId: "deleted", level: 1, mapId: project.startMapId, x: 1, y: 1, orientation: "down" } as const;
    session.farmBuildingPlacements = { old: placement };
    expect(moveLifeRecoverySource(project, session, { sourceKind: "farmBuildingPlacements", sourceId: "old", reason: "deleted" }).ok).toBe(true);
    expect(session.farmBuildingPlacements).toEqual({});
    expect(session.lifeRecovery?.claims["recovery:1"]).toMatchObject({ items: [], unresolved: { record: placement } });
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "unresolved" });
    expect(session).toEqual(before);
  });
  it("rejects raw JSON above 64 KiB before removing the source", () => {
    const { project, session } = fixture();
    session.makerInstances = { old: { instanceId: "old", makerId: "x".repeat(65536), status: "processing", startedAtMinute: 10, readyAtMinute: 40 } };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "makerInstances", sourceId: "old", reason: "deleted" })).toEqual({ ok: false, reason: "capacity" });
    expect(session).toEqual(before);
  });
  it("rejects total recovery overflow without removing the owner or advancing sequence", () => {
    const { project, session } = fixture();
    const base = state();
    const bytes = new TextEncoder().encode(JSON.stringify(base)).length;
    const entry = claim(1);
    session.lifeRecovery = { ...base, claims: { "recovery:1": { ...entry, reason: entry.reason + "x".repeat(8 * 1024 * 1024 - bytes) } } };
    session.shippingQueue = { raw: 3 };
    const before = structuredClone(session);
    expect(moveLifeRecoverySource(project, session, shippingSource)).toEqual({ ok: false, reason: "capacity" });
    expect(session).toEqual(before);
  });
  it("rejects malformed persisted claims before any inventory payout", () => {
    const { project, session } = fixture();
    session.lifeRecovery = { nextSequence: 2, claims: { "recovery:1": { ...claim(1), items: [{ itemId: "raw", count: ITEM_QUANTITY_MAX + 1 }] } } };
    const before = structuredClone(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });
});

it("accepts JSON-serializable shared values but rejects accessor and symbol array evidence", () => {
  const shared = { value: 3 };
  expect(isLifeRecoveryJson({ first: shared, second: shared })).toBe(true);
  const array = [1];
  Object.defineProperty(array, "0", { get() { throw new Error("must not execute"); }, enumerable: true });
  expect(isLifeRecoveryJson(array)).toBe(false);
  const symbolArray = [1];
  Object.defineProperty(symbolArray, Symbol("lost"), { value: 2 });
  expect(isLifeRecoveryJson(symbolArray)).toBe(false);
});
