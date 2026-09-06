import { Window } from "happy-dom";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { normalizeItemTransitionState, transitionItemState } from "@/project/itemTransitions";
import { deserialize, serialize } from "@/project/io";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim, moveLifeRecoverySource, parseLifeState, reconcileLifeState } from "@/project/lifeRecovery";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";

const window = new Window();
const storage = window.localStorage;
afterEach(() => storage.clear());
afterAll(() => window.happyDOM.close());
const ids = ["ordinary", "__proto__", "constructor", "toString"];
const prototype = Object.getOwnPropertyDescriptors(Object.prototype);

function fixture(itemId: string, known = true, required = 2) {
  const project = createBlankProject();
  if (known) project.database.items.push(normalizeItemRecord({ id: itemId, name: itemId, scope: "none", price: 1 }));
  project.system.bundles = [{ id: itemId, requirements: [{ itemId, count: required }] }];
  const session = startSession(project, 30);
  session.inventory = {};
  // JSON.parse, not an object-literal __proto__ setter: both levels are own keys.
  session.bundleContributions = JSON.parse(`{${JSON.stringify(itemId)}:{${JSON.stringify(itemId)}:5}}`);
  return { project, session };
}
function roundtrip(project: ReturnType<typeof fixture>["project"], session: ReturnType<typeof startSession>) {
  const before = JSON.stringify(session);
  const snapshot = createSaveSnapshot(project, session);
  expect(JSON.stringify(session)).toBe(before);
  expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
  const raw = storage.getItem(saveSlotKey(1));
  const read = readSaveSlot(storage, 1);
  if (read.kind !== "present") throw new Error(`save read: ${read.kind}`);
  const restored = applySaveSnapshot(project, read.snapshot);
  expect(storage.getItem(saveSlotKey(1))).toBe(raw);
  expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototype);
  return restored;
}

describe("life recovery own record keys", () => {
  it("keeps the exact raw JSON __proto__ quantity owned at parse", () => {
    const text = '{"bundleContributions":{"bundle":{"__proto__":1}}}';
    const input = JSON.parse(text);
    const parsed = parseLifeState(input);
    expect(Object.hasOwn(parsed.bundleContributions?.bundle ?? {}, "__proto__")).toBe(true);
    expect(parsed.bundleContributions?.bundle?.["__proto__"]).toBe(1);
    expect(JSON.stringify(input)).toBe(text);
    expect(JSON.stringify(parsed.bundleContributions)).toBe(JSON.stringify(input.bundleContributions));
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototype);
  });

  it.each(ids)("retains compatible %s contributions without inventing claims", (id) => {
    const { project, session } = fixture(id, true, 5);
    const restored = roundtrip(project, session);
    expect(Object.entries(restored.bundleContributions ?? {})).toEqual([[id, { [id]: 5 }]]);
    expect(restored.lifeRecovery).toBeUndefined();
    expect(roundtrip(project, restored).bundleContributions).toEqual(restored.bundleContributions);
  });

  it.each(ids)("splits %s into progress2 and claim3 and pays exactly once", (id) => {
    const { project, session } = fixture(id);
    const restored = roundtrip(project, session);
    expect(Object.entries(restored.bundleContributions ?? {})).toEqual([[id, { [id]: 2 }]]);
    expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([
      { sourceId: id, items: [{ itemId: id, count: 3 }] },
    ]);
    expect(Object.keys(restored.inventory)).not.toContain(id);
    expect(reconcileLifeState(project, restored)).toEqual(restored);
    const again = roundtrip(project, roundtrip(project, restored));
    expect(again.lifeRecovery).toEqual(restored.lifeRecovery);
    expect(collectLifeRecoveryClaim(project, again, "recovery:1").ok).toBe(true);
    expect(Object.entries(again.inventory)).toContainEqual([id, 3]);
    expect(collectLifeRecoveryClaim(project, again, "recovery:1")).toEqual({ ok: false, reason: "missing-claim" });
    const paid = roundtrip(project, again);
    expect(Object.entries(paid.inventory)).toContainEqual([id, 3]);
    expect(paid.bundleContributions?.[id]?.[id]).toBe(2);
    expect(paid.lifeRecovery).toEqual({ nextSequence: 2, claims: {} });
  });

  it.each(ids)("preserves complete unknown %s source evidence with no guessed payout", (id) => {
    const { project, session } = fixture(id, false);
    const original = session.bundleContributions?.[id];
    const restored = roundtrip(project, session);
    expect(Object.keys(restored.bundleContributions ?? {})).toEqual([]);
    const claims = Object.values(restored.lifeRecovery?.claims ?? {});
    expect(claims).toHaveLength(1);
    expect(claims[0]?.items).toEqual([{ itemId: id, count: 5 }]);
    expect(JSON.stringify(claims[0]?.unresolved?.record)).toBe(JSON.stringify(original));
    const before = JSON.stringify(restored);
    expect(collectLifeRecoveryClaim(project, restored, "recovery:1")).toEqual({ ok: false, reason: "unresolved" });
    expect(JSON.stringify(restored)).toBe(before);
    expect(reconcileLifeState(project, restored)).toEqual(restored);
    expect(roundtrip(project, roundtrip(project, restored)).lifeRecovery).toEqual(restored.lifeRecovery);
    expect(Object.keys(restored.inventory)).not.toContain(id);
  });

  it.each(ids)("preserves existing %s inventory when collecting a direct shipping claim", (id) => {
    const { project, session } = fixture(id);
    session.bundleContributions = {};
    session.inventory = JSON.parse(`{${JSON.stringify(id)}:1}`);
    session.shippingQueue = { [id]: 3 };
    expect(moveLifeRecoverySource(project, session, { sourceKind: "shippingQueue", sourceId: id, reason: "disabled" }).ok).toBe(true);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1").ok).toBe(true);
    expect(Object.entries(session.inventory)).toContainEqual([id, 4]);
    expect(Object.entries(roundtrip(project, session).inventory)).toContainEqual([id, 4]);
  });

  it.each(ids)("retains %s source and claim quantities on capacity and malformed rollback", (id) => {
    const { project, session } = fixture(id);
    session.lifeRecovery = { nextSequence: Number.MAX_SAFE_INTEGER, claims: {} };
    const before = JSON.stringify(session);
    expect(() => createSaveSnapshot(project, session)).toThrow();
    expect(JSON.stringify(session)).toBe(before);
    delete session.lifeRecovery;
    const snapshot = createSaveSnapshot(project, startSession(project, 30));
    Object.assign(snapshot.session, { bundleContributions: { [id]: { [id]: -1 } } });
    const raw = JSON.stringify(snapshot);
    storage.setItem(saveSlotKey(1), raw);
    expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
    expect(() => applySaveSnapshot(project, snapshot)).toThrow();
    expect(storage.getItem(saveSlotKey(1))).toBe(raw);
    session.bundleContributions = {};
    session.inventory = { [id]: ITEM_QUANTITY_MAX };
    session.shippingQueue = { [id]: 3 };
    expect(moveLifeRecoverySource(project, session, { sourceKind: "shippingQueue", sourceId: id, reason: "disabled" }).ok).toBe(true);
    const full = JSON.stringify(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "inventory-overflow" });
    expect(JSON.stringify(session)).toBe(full);
  });
});


describe("finite-use recovery record keys", () => {
  function finiteFixture(id: string) {
    let project = createBlankProject();
    project.database.items.push(normalizeItemRecord({ id, name: id, scope: "none", price: 1, consumable: true, consumptionLimit: 5 }));
    project = deserialize(serialize(project));
    expect(project.database.items.find((item) => item.id === id)).toMatchObject({ consumable: true, consumptionLimit: 5 });
    const session = startSession(project, 30);
    session.inventory = JSON.parse(`{${JSON.stringify(id)}:1}`);
    session.itemUseCharges = JSON.parse(`{${JSON.stringify(id)}:2}`);
    return { project, session };
  }
  function cursor(state: { inventory?: Readonly<Record<string, number>>; itemUseCharges?: Readonly<Record<string, number>> }, id: string, count: number, charge: number) {
    if (!state.inventory) throw new Error("Missing inventory owner");
    expect(Object.entries(state.inventory)).toEqual([[id, count]]);
    expect(Object.entries(state.itemUseCharges ?? {})).toEqual([[id, charge]]);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototype);
  }

  it.each(ids)("preserves %s charge2 through actual shipping claim3 collection", (id) => {
    const { project, session } = finiteFixture(id);
    session.shippingQueue = JSON.parse(`{${JSON.stringify(id)}:3}`);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "shippingQueue", sourceId: id, reason: "disabled" })).toEqual({ ok: true, claimIds: ["recovery:1"] });
    cursor(session, id, 1, 2);
    if (!session.shippingQueue) throw new Error("Missing shipping owner");
    expect(Object.keys(session.shippingQueue)).toEqual([]);
    expect(session.lifeRecovery?.claims["recovery:1"]?.items).toEqual([{ itemId: id, count: 3 }]);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: true, claimIds: ["recovery:1"] });
    cursor(session, id, 4, 2);
    expect(session.lifeRecovery).toEqual({ nextSequence: 2, claims: {} });
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "missing-claim" });
    cursor(roundtrip(project, session), id, 4, 2);
    const tail = transitionItemState(session, project.database.items, { kind: "remove", itemId: id, amount: 3 });
    cursor(tail, id, 1, 2);
    expect(transitionItemState(tail, project.database.items, { kind: "remove", itemId: id, amount: 1 })).toEqual({ inventory: {}, itemUseCharges: {} });
  });

  it.each(ids)("preserves own %s charge2 at normalize, writer, Storage reader and apply", (id) => {
    const { project, session } = finiteFixture(id);
    const before = JSON.stringify(session);
    cursor(normalizeItemTransitionState(session, project.database.items), id, 1, 2);
    const snapshot = createSaveSnapshot(project, session);
    cursor(snapshot.session, id, 1, 2);
    expect(JSON.stringify(session)).toBe(before);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const disk = storage.getItem(saveSlotKey(1));
    const read = readSaveSlot(storage, 1);
    if (read.kind !== "present") throw new Error(`save read: ${read.kind}`);
    cursor(read.snapshot.session, id, 1, 2);
    cursor(applySaveSnapshot(project, read.snapshot), id, 1, 2);
    expect(storage.getItem(saveSlotKey(1))).toBe(disk);
  });

  it.each(ids)("counts numeric %s charges1..4 and depletes on successfulUse5", (id) => {
    const { project, session } = finiteFixture(id);
    let state = { inventory: session.inventory, itemUseCharges: {} };
    for (let use = 1; use <= 4; use++) {
      state = transitionItemState(state, project.database.items, { kind: "successfulUse", itemId: id });
      cursor(state, id, 1, use);
    }
    state = transitionItemState(state, project.database.items, { kind: "successfulUse", itemId: id });
    expect(Object.entries(state.inventory)).toEqual([]);
    expect(Object.entries(state.itemUseCharges)).toEqual([]);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototype);
  });

  it.each(ids)("keeps %s finite cursor and claim on overflow or invalid count", (id) => {
    const { project, session } = finiteFixture(id);
    session.inventory = JSON.parse(`{${JSON.stringify(id)}:${ITEM_QUANTITY_MAX}}`);
    session.shippingQueue = JSON.parse(`{${JSON.stringify(id)}:3}`);
    expect(moveLifeRecoverySource(project, session, { sourceKind: "shippingQueue", sourceId: id, reason: "disabled" }).ok).toBe(true);
    const before = JSON.stringify(session);
    expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "inventory-overflow" });
    expect(JSON.stringify(session)).toBe(before);
    cursor(transitionItemState(session, project.database.items, { kind: "grant", itemId: id, amount: -1 }), id, ITEM_QUANTITY_MAX, 2);
    expect(JSON.stringify(session)).toBe(before);
  });
});
