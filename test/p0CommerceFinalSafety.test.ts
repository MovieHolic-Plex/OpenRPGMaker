import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { GOLD_MAX, startSession } from "@/project/session";
import { handleShopTransaction } from "@/player/playSceneShop";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readSaveSlot,
  saveToSlot,
  type SaveSnapshot,
} from "@/player/saveSlots";
import type { PlaySceneContext } from "@/player/playSceneTypes";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function fakeScene(session: ReturnType<typeof startSession>): PlaySceneContext {
  return { session, syncRuntimeState: () => {} } as unknown as PlaySceneContext;
}

function shopItem() {
  return normalizeItemRecord({ id: "item_shop_safe", name: "Safe shop item", scope: "none", price: 40 });
}

function hostileSnapshot(): { project: ReturnType<typeof createBlankProject>; snapshot: SaveSnapshot } {
  const project = createBlankProject();
  const snapshot = createSaveSnapshot(project, startSession(project, 301));
  const session = snapshot.session as unknown as Record<string, unknown>;
  session.gold = "forged";
  session.shopLoyaltySpend = {
    safe: 12,
    max: GOLD_MAX,
    over: GOLD_MAX + 1,
    huge: 1e300,
    fractional: 1.5,
    negative: -1,
  };
  session.shopTradeCounts = {
    safe: { sold: 2, bought: 3 },
    max: { sold: GOLD_MAX, bought: GOLD_MAX },
    soldOver: { sold: GOLD_MAX + 1, bought: 0 },
    boughtHuge: { sold: 0, bought: 1e300 },
    fractional: { sold: 0.5, bought: 1 },
  };
  session.shopMileagePoints = GOLD_MAX + 1;
  return { project, snapshot };
}

const EXPECTED_LOYALTY = { safe: 12, max: GOLD_MAX };
const EXPECTED_TRADES = {
  safe: { sold: 2, bought: 3 },
  max: { sold: GOLD_MAX, bought: GOLD_MAX },
};

describe("P0 shop sell atomic safety", () => {
  it.each([1e300, ITEM_QUANTITY_MAX + 1, Number.POSITIVE_INFINITY])(
    "does not mutate any economy state when the sold stack is %s",
    (owned) => {
      // Break caught: sell ignored changeItemsAtomically's false result, then
      // still credited gold, advanced sold counts, and returned merchant gold.
      const project = createBlankProject();
      const item = shopItem();
      const session = startSession(project, 201);
      session.inventory = { [item.id]: owned };
      session.gold = 100;
      session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
      session.shopLoyaltySpend = { global: 4 };
      session.shopMileagePoints = 5;
      const before = structuredClone(session);

      const result = handleShopTransaction(fakeScene(session), item, "sell", 1, 100);

      expect(result.ok).toBe(false);
      expect("merchantGold" in result).toBe(false);
      expect(session).toEqual(before);
    },
  );

  it.each([
    {
      label: "a full player gold destination",
      configure: (session: ReturnType<typeof startSession>, itemId: string) => { session.gold = GOLD_MAX; },
      merchantGold: 100,
    },
    {
      label: "a full sold counter",
      configure: (session: ReturnType<typeof startSession>, itemId: string) => {
        session.shopTradeCounts = { [itemId]: { sold: GOLD_MAX, bought: 0 } };
      },
      merchantGold: 100,
    },
    {
      label: "a poisoned sold counter",
      configure: (session: ReturnType<typeof startSession>, itemId: string) => {
        session.shopTradeCounts = { [itemId]: { sold: 1e300, bought: 0 } };
      },
      merchantGold: 100,
    },
    {
      label: "a poisoned bought counter",
      configure: (session: ReturnType<typeof startSession>, itemId: string) => {
        session.shopTradeCounts = { [itemId]: { sold: 0, bought: Number.POSITIVE_INFINITY } };
      },
      merchantGold: 100,
    },
    {
      label: "poisoned mileage",
      configure: (session: ReturnType<typeof startSession>) => { session.shopMileagePoints = GOLD_MAX + 1; },
      merchantGold: 100,
    },
    {
      label: "poisoned loyalty",
      configure: (session: ReturnType<typeof startSession>) => { session.shopLoyaltySpend = { global: 1e300 }; },
      merchantGold: 100,
    },
    {
      label: "poisoned merchant gold",
      configure: () => {},
      merchantGold: Number.POSITIVE_INFINITY,
    },
    {
      label: "over-cap merchant gold",
      configure: () => {},
      merchantGold: GOLD_MAX + 1,
    },
  ])("leaves inventory, gold, ledgers, and merchant unchanged for $label", ({ configure, merchantGold }) => {
    const project = createBlankProject();
    const item = shopItem();
    const session = startSession(project, 202);
    session.inventory = { [item.id]: 1 };
    session.gold = 100;
    session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
    session.shopLoyaltySpend = { global: 4 };
    session.shopMileagePoints = 5;
    configure(session, item.id);
    const before = structuredClone(session);

    const result = handleShopTransaction(fakeScene(session), item, "sell", 1, merchantGold);

    expect(result.ok).toBe(false);
    expect("merchantGold" in result).toBe(false);
    expect(session).toEqual(before);
  });

  it("commits a normal sale only after the atomic item removal succeeds", () => {
    const project = createBlankProject();
    const item = shopItem();
    const session = startSession(project, 203);
    session.inventory = { [item.id]: 2 };
    session.gold = 100;
    session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
    session.shopLoyaltySpend = { global: 4 };
    session.shopMileagePoints = 5;

    const result = handleShopTransaction(fakeScene(session), item, "sell", 1, 100);

    expect(result).toMatchObject({ ok: true, merchantGold: 80 });
    expect(session.inventory[item.id]).toBe(1);
    expect(session.gold).toBe(120);
    expect(session.shopTradeCounts).toEqual({ [item.id]: { sold: 3, bought: 3 } });
    expect(session.shopLoyaltySpend).toEqual({ global: 4 });
    expect(session.shopMileagePoints).toBe(5);
  });
});

describe("P0 economy save sanitization", () => {
  it("sanitizes hostile writer state while preserving bounded entries", () => {
    const project = createBlankProject();
    const session = startSession(project, 302);
    session.gold = 1e300;
    session.shopLoyaltySpend = {
      safe: 12,
      max: GOLD_MAX,
      over: GOLD_MAX + 1,
      huge: 1e300,
      fractional: 1.5,
    };
    session.shopTradeCounts = {
      safe: { sold: 2, bought: 3 },
      max: { sold: GOLD_MAX, bought: GOLD_MAX },
      invalid: { sold: 1e300, bought: 0 },
    };
    session.shopMileagePoints = Number.POSITIVE_INFINITY;

    const snapshot = createSaveSnapshot(project, session);

    expect(snapshot.session.gold).toBe(0);
    expect(snapshot.session.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
    expect(snapshot.session.shopTradeCounts).toEqual(EXPECTED_TRADES);
    expect(snapshot.session.shopMileagePoints).toBeUndefined();
  });

  it("sanitizes hostile wire values without corrupting the whole save slot", () => {
    const { snapshot } = hostileSnapshot();
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, snapshot);

    const read = readSaveSlot(storage, 1);

    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected sanitized save");
    expect(read.snapshot.session.gold).toBe(0);
    expect(read.snapshot.session.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
    expect(read.snapshot.session.shopTradeCounts).toEqual(EXPECTED_TRADES);
    expect(read.snapshot.session.shopMileagePoints).toBeUndefined();
  });

  it("sanitizes direct snapshot application through the same contract", () => {
    const { project, snapshot } = hostileSnapshot();

    const restored = applySaveSnapshot(project, snapshot);

    expect(restored.gold).toBe(0);
    expect(restored.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
    expect(restored.shopTradeCounts).toEqual(EXPECTED_TRADES);
    expect(restored.shopMileagePoints).toBeUndefined();
  });

  it("preserves inclusive GOLD_MAX values through writer, parser, and apply", () => {
    const project = createBlankProject();
    const session = startSession(project, 303);
    session.gold = GOLD_MAX;
    session.shopLoyaltySpend = { max: GOLD_MAX };
    session.shopTradeCounts = { max: { sold: GOLD_MAX, bought: GOLD_MAX } };
    session.shopMileagePoints = GOLD_MAX;
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));

    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected bounded save");
    const restored = applySaveSnapshot(project, read.snapshot);

    expect(restored.gold).toBe(GOLD_MAX);
    expect(restored.shopLoyaltySpend).toEqual({ max: GOLD_MAX });
    expect(restored.shopTradeCounts).toEqual({ max: { sold: GOLD_MAX, bought: GOLD_MAX } });
    expect(restored.shopMileagePoints).toBe(GOLD_MAX);
  });
});
