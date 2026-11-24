import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { GOLD_MAX, startSession } from "@/project/session";
import { handleShopTransaction } from "@/player/playSceneShop";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, type SaveSnapshot } from "@/player/saveSlots";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { depositToChest, ensureChest, withdrawFromChest } from "@/project/placeables";
import { restoreEnergy, spendEnergy } from "@/project/energy";
import { isolateTimers } from "./mergedTeardown";

describe("p0CommerceFinalSafety", () => {
  isolateTimers();
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
});

describe("p0EconomySafetyFollowup", () => {
  isolateTimers();
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
  function hostileChest(project: ReturnType<typeof createBlankProject>) {
    return {
      id: "chest_hostile",
      mapId: project.startMapId,
      x: 1,
      y: 2,
      inventory: {
        item_safe: 3,
        item_max: ITEM_QUANTITY_MAX,
        item_huge: 1e300,
        item_over: ITEM_QUANTITY_MAX + 1,
      },
    };
  }
  describe("P0 chest quantity safety", () => {
    it("sanitizes hostile chest inventories while parsing a save slot", () => {
      // Break caught: parseSessionRecord clones arbitrary chest objects, so
      // 1e300 and above-cap stacks reach runtime unchanged.
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, startSession(project, 1));
      (snapshot.session as { chests?: unknown }).chests = { chest_hostile: hostileChest(project) };
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, snapshot);

      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected parsed save");
      expect(read.snapshot.session.chests?.chest_hostile?.inventory).toEqual({
        item_safe: 3,
        item_max: ITEM_QUANTITY_MAX,
      });
    });

    it("sanitizes hostile chest inventories when a snapshot is applied directly", () => {
      // Break caught: checkpoints/direct callers can bypass the wire parser and
      // apply unsafe chest quantities straight into a live session.
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, startSession(project, 2));
      (snapshot.session as { chests?: unknown }).chests = { chest_hostile: hostileChest(project) };

      expect(applySaveSnapshot(project, snapshot).chests?.chest_hostile?.inventory).toEqual({
        item_safe: 3,
        item_max: ITEM_QUANTITY_MAX,
      });
    });

    it.each([
      { direction: "deposit" as const, player: 1, chest: ITEM_QUANTITY_MAX },
      { direction: "deposit" as const, player: 1e300, chest: 0 },
      { direction: "deposit" as const, player: ITEM_QUANTITY_MAX + 1, chest: 0 },
      { direction: "deposit" as const, player: 1, chest: 1e300 },
      { direction: "deposit" as const, player: 1, chest: ITEM_QUANTITY_MAX + 1 },
      { direction: "withdraw" as const, player: ITEM_QUANTITY_MAX, chest: 1 },
      { direction: "withdraw" as const, player: 0, chest: 1e300 },
      { direction: "withdraw" as const, player: 0, chest: ITEM_QUANTITY_MAX + 1 },
      { direction: "withdraw" as const, player: 1e300, chest: 1 },
      { direction: "withdraw" as const, player: ITEM_QUANTITY_MAX + 1, chest: 1 },
    ])("leaves both containers unchanged for rejected $direction values ($player/$chest)", ({ direction, player, chest }) => {
      // Break caught: one container mutates before the second container rejects
      // an unsafe source or full/overflow destination.
      const session = startSession(createBlankProject(), 3);
      session.inventory = { item_target: player };
      ensureChest(session, { id: "chest", mapId: session.currentMapId, x: 0, y: 0 }).inventory = { item_target: chest };
      const before = structuredClone({ inventory: session.inventory, chests: session.chests, itemUseCharges: session.itemUseCharges });

      const ok = direction === "deposit"
        ? depositToChest(session, "chest", "item_target", 1)
        : withdrawFromChest(session, "chest", "item_target", 1);

      expect(ok).toBe(false);
      expect({ inventory: session.inventory, chests: session.chests, itemUseCharges: session.itemUseCharges }).toEqual(before);
    });
  });
  describe("P0 crafting quantity safety", () => {
    it("sums duplicate ingredient rows before deciding whether crafting is possible", () => {
      // Break caught: two rows for the same item each pass against the same
      // current count, then sequential clamped removals mint the output.
      const project = createBlankProject();
      project.system.craftRecipes = [{
        id: "recipe_duplicate",
        ingredients: [{ itemId: "item_input", count: 2 }, { itemId: "item_input", count: 2 }],
        outputItemId: "item_output",
        outputCount: 1,
        goldCost: 10,
      }];
      const session = startSession(project, 4);
      session.inventory = { item_input: 3 };
      session.gold = 100;
      const before = structuredClone(session);

      expect(canCraft(project, session, "recipe_duplicate")).toEqual({ ok: false, reason: "missing-ingredients" });
      expect(craftRecipe(project, session, "recipe_duplicate")).toEqual({ ok: false, reason: "missing-ingredients" });
      expect(session).toEqual(before);
    });

    it("consumes the summed duplicate requirement exactly once when enough exists", () => {
      const project = createBlankProject();
      project.system.craftRecipes = [{
        id: "recipe_duplicate",
        ingredients: [{ itemId: "item_input", count: 2 }, { itemId: "item_input", count: 2 }],
        outputItemId: "item_output",
        outputCount: 1,
      }];
      const session = startSession(project, 5);
      session.inventory = { item_input: 4 };

      expect(craftRecipe(project, session, "recipe_duplicate")).toMatchObject({ ok: true });
      expect(session.inventory).toEqual({ item_output: 1 });
    });

    it("does not remove ingredients or gold when the output stack would overflow", () => {
      // Break caught: crafting debits gold and ingredients before its unchecked
      // output grant rejects ITEM_QUANTITY_MAX + 1.
      const project = createBlankProject();
      project.system.craftRecipes = [{
        id: "recipe_overflow",
        ingredients: [{ itemId: "item_input", count: 1 }],
        outputItemId: "item_output",
        outputCount: 1,
        goldCost: 10,
      }];
      const session = startSession(project, 6);
      session.inventory = { item_input: 1, item_output: ITEM_QUANTITY_MAX };
      session.gold = 100;
      const before = structuredClone(session);

      expect(craftRecipe(project, session, "recipe_overflow")).toMatchObject({ ok: false });
      expect(session).toEqual(before);
    });
  });
  describe("P0 shop purchase quantity safety", () => {
    it.each([ITEM_QUANTITY_MAX, ITEM_QUANTITY_MAX + 1, 1e300])(
      "does not debit a purchase or advance trade state when the item stack is %s",
      (current) => {
        // Break caught: buy debits gold before an unchecked item grant, then
        // increments trade counts and returns increased merchant gold anyway.
        const project = createBlankProject();
        const item = normalizeItemRecord({ id: "item_shop", name: "Shop item", scope: "none", price: 40 });
        const session = startSession(project, 7);
        session.inventory = { [item.id]: current };
        session.gold = 500;
        session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
        const before = structuredClone(session);

        const result = handleShopTransaction(fakeScene(session), item, "buy", 1, 100);

        expect(result.ok).toBe(false);
        expect(session).toEqual(before);
        expect("merchantGold" in result).toBe(false);
      },
    );
  });
});

describe("p0Energy", () => {
  isolateTimers();
  describe("P0 energy rules", () => {
    it("spends and restores against the authored maximum", () => {
      // Break caught: a successful action reports success without changing the session pool.
      const project = createBlankProject();
      project.system.energy = { max: 100, initial: 50 };
      const session = startSession(project, 1);

      expect(spendEnergy(project, session, 15)).toEqual({ ok: true, before: 50, after: 35, spent: 15 });
      expect(restoreEnergy(project, session, 80)).toEqual({ ok: true, before: 35, after: 100, restored: 65 });
      expect(session.energy).toBe(100);
    });

    it("accepts an authored zero daily restore as a successful no-op", () => {
      // Break caught: restorePerDay=0 aborts the entire transactional day transition.
      const project = createBlankProject();
      project.system.energy = { max: 100, initial: 35, restorePerDay: 0 };
      const session = startSession(project, 11);

      expect(restoreEnergy(project, session, 0)).toEqual({
        ok: true,
        before: 35,
        after: 35,
        restored: 0,
      });
      expect(session.energy).toBe(35);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
      "rejects invalid spend %s without mutation",
      (amount) => {
        // Break caught: malformed amounts mint energy or partially debit the pool.
        const project = createBlankProject();
        project.system.energy = { max: 80, initial: 40 };
        const session = startSession(project, 2);
        expect(spendEnergy(project, session, amount)).toMatchObject({ ok: false, reason: "invalid-amount" });
        expect(session.energy).toBe(40);
      },
    );

    it("rejects insufficient energy and disabled projects atomically", () => {
      // Break caught: failed actions leave the pool at zero or invent a pool for legacy projects.
      const enabled = createBlankProject();
      enabled.system.energy = { max: 30, initial: 10 };
      const enabledSession = startSession(enabled, 3);
      expect(spendEnergy(enabled, enabledSession, 11)).toMatchObject({ ok: false, reason: "insufficient-energy" });
      expect(enabledSession.energy).toBe(10);

      const legacy = createBlankProject();
      const legacySession = startSession(legacy, 4);
      expect(restoreEnergy(legacy, legacySession)).toMatchObject({ ok: false, reason: "disabled" });
      expect(legacySession.energy).toBeUndefined();
    });
  });
});
