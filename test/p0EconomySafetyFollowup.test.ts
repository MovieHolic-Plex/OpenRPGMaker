import { describe, expect, it } from "vitest";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { depositToChest, ensureChest, withdrawFromChest } from "@/project/placeables";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { handleShopTransaction } from "@/player/playSceneShop";
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
