import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { performAutosave } from "@/player/autosave";
import { restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readAutosave,
  readSaveSlot,
  saveToSlot,
} from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function configureP0PersistenceProject(project: ReturnType<typeof createBlankProject>): void {
  const turnip = normalizeItemRecord({ id: "item_turnip", name: "Turnip", scope: "none", price: 20 });
  const index = project.database.items.findIndex((item) => item.id === turnip.id);
  if (index >= 0) project.database.items[index] = turnip;
  else project.database.items.push(turnip);
  project.system.energy = { max: 100, initial: 80 };
  project.system.shipping = { enabled: true, historyLimit: 28, allowedItemIds: ["item_turnip"] };
  project.system.bundles = [
    { id: "bundle_spring", requirements: [{ itemId: "item_turnip", count: 2 }] },
    { id: "bundle_mine", requirements: [{ itemId: "item_turnip", count: 1 }] },
  ];
  project.system.worldUnlocks = [{ id: "region_bridge" }];
  project.system.craftRecipes = [{ id: "recipe_preserves", ingredients: [], outputItemId: "item_turnip" }];
  project.system.makers = [{
    id: "maker_preserves",
    inputs: [],
    outputs: [{ itemId: "item_turnip", count: 1 }],
    durationMinutes: 1_440,
  }];
}

describe("P0 save snapshot regression", () => {
  it("preserves life skills and shop economy through writer, parser, and apply", () => {
    // Break caught: createSaveSnapshot/parse/apply silently omits live progression fields.
    const project = createBlankProject();
    configureP0PersistenceProject(project);
    const session = startSession(project, 17);
    session.lifeSkills = { skill_farming: { xp: 275, level: 3 } };
    session.shopLoyaltySpend = { shop_seed: 450 };
    session.shopTradeCounts = { shop_seed: { sold: 7, bought: 4 } };
    session.shopMileagePoints = 39;
    session.shopPawnTickets = {
      ticket_1: { itemId: "item_hoe", pawnPrice: 120, dueDayKey: "1:spring:12" },
    };
    session.shopLastRestockDayKey = { shop_seed: "1:spring:12" };
    session.energy = 72;
    session.shippingQueue = { item_turnip: 4 };
    session.shippingLastSettledDayKey = "1:spring:11";
    session.dayTransitionLastDayKey = "1:spring:11";
    session.shippingHistory = [{
      dayKey: "1:spring:11",
      entries: [{ itemId: "item_turnip", count: 2, unitPrice: 10, subtotal: 20 }],
      total: 20,
      credited: 20,
    }];
    session.bundleContributions = { bundle_spring: { item_turnip: 2 } };
    session.completedBundleIds = ["bundle_mine"];
    session.bundleRewardAppliedIds = ["bundle_mine"];
    session.unlockedRegionIds = ["region_bridge"];
    session.unlockedRecipeIds = ["recipe_preserves"];
    session.makerInstances = {
      "farm:2,3": {
        instanceId: "farm:2,3",
        makerId: "maker_preserves",
        status: "processing",
        startedAtMinute: 500,
        readyAtMinute: 1_940,
      },
    };

    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected a parsed save slot");

    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.lifeSkills).toEqual(session.lifeSkills);
    expect(restored.shopLoyaltySpend).toEqual(session.shopLoyaltySpend);
    expect(restored.shopTradeCounts).toEqual(session.shopTradeCounts);
    expect(restored.shopMileagePoints).toBe(39);
    expect(restored.shopPawnTickets).toEqual(session.shopPawnTickets);
    expect(restored.shopLastRestockDayKey).toEqual(session.shopLastRestockDayKey);
    expect(restored.energy).toBe(72);
    expect(restored.shippingQueue).toEqual(session.shippingQueue);
    expect(restored.shippingLastSettledDayKey).toBe("1:spring:11");
    expect(restored.dayTransitionLastDayKey).toBe("1:spring:11");
    expect(restored.shippingHistory).toEqual(session.shippingHistory);
    expect(restored.bundleContributions).toEqual(session.bundleContributions);
    expect(restored.completedBundleIds).toEqual(["bundle_mine"]);
    expect(restored.bundleRewardAppliedIds).toEqual(["bundle_mine"]);
    expect(restored.unlockedRegionIds).toEqual(["region_bridge"]);
    expect(restored.unlockedRecipeIds).toEqual(["recipe_preserves"]);
    expect(restored.makerInstances).toEqual(session.makerInstances);
  });

  it("loads a legacy snapshot with the optional progression fields omitted", () => {
    // Break caught: adding P0 fields turns old schema-version-3 saves into corrupt slots.
    const project = createBlankProject();
    configureP0PersistenceProject(project);
    const snapshot = createSaveSnapshot(project, startSession(project, 18));
    const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    const legacySession = legacy.session as unknown as Record<string, unknown>;
    for (const key of [
      "lifeSkills",
      "shopLoyaltySpend",
      "shopTradeCounts",
      "shopMileagePoints",
      "shopPawnTickets",
      "shopLastRestockDayKey",
      "energy",
      "shippingQueue",
      "shippingLastSettledDayKey",
      "dayTransitionLastDayKey",
      "shippingHistory",
      "bundleContributions",
      "completedBundleIds",
      "bundleRewardAppliedIds",
      "unlockedRegionIds",
      "unlockedRecipeIds",
      "makerInstances",
    ]) delete legacySession[key];
    const storage = new MemoryStorage();
    saveToSlot(storage, 2, legacy);

    const read = readSaveSlot(storage, 2);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected a legacy save slot");
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.lifeSkills).toEqual({});
    expect(restored.shopLoyaltySpend).toBeUndefined();
    expect(restored.shopMileagePoints).toBeUndefined();
    expect(restored.shippingQueue).toEqual({});
    expect(restored.shippingHistory).toEqual([]);
    expect(restored.dayTransitionLastDayKey).toBeUndefined();
    expect(restored.bundleContributions).toEqual({});
    expect(restored.completedBundleIds).toEqual([]);
    expect(restored.bundleRewardAppliedIds).toEqual([]);
    expect(restored.unlockedRegionIds).toEqual([]);
    expect(restored.unlockedRecipeIds).toEqual([]);
    expect(restored.makerInstances).toEqual({});
  });

  it("uses the same P0 snapshot state for autosave and checkpoints", () => {
    // Break caught: a second save writer preserves manual slots but drops new state in auto/checkpoint flows.
    const project = createBlankProject();
    configureP0PersistenceProject(project);
    const session = startSession(project, 19);
    session.lifeSkills = { skill_farming: { xp: 420, level: 4 } };
    session.energy = 48;
    session.shippingQueue = { item_turnip: 3 };
    session.dayTransitionLastDayKey = "1:spring:4";
    session.completedBundleIds = ["bundle_spring"];
    session.unlockedRecipeIds = ["recipe_preserves"];
    session.makerInstances = {
      "farm:4,5": {
        instanceId: "farm:4,5",
        makerId: "maker_preserves",
        status: "processing",
        startedAtMinute: 800,
        readyAtMinute: 1_100,
      },
    };

    const storage = new MemoryStorage();
    expect(performAutosave(project, session, storage, "transfer")).not.toBeNull();
    const autosave = readAutosave(storage);
    expect(autosave.kind).toBe("present");
    if (autosave.kind !== "present") throw new Error("expected a parsed autosave");
    const autoRestored = applySaveSnapshot(project, autosave.snapshot);
    expect(autoRestored).toMatchObject({
      lifeSkills: session.lifeSkills,
      energy: 48,
      shippingQueue: { item_turnip: 3 },
      dayTransitionLastDayKey: "1:spring:4",
      completedBundleIds: ["bundle_spring"],
      unlockedRecipeIds: ["recipe_preserves"],
      makerInstances: session.makerInstances,
    });

    saveSessionCheckpoint(project, session);
    session.energy = 0;
    session.shippingQueue = {};
    session.dayTransitionLastDayKey = undefined;
    session.completedBundleIds = [];
    session.unlockedRecipeIds = [];
    session.makerInstances = {};
    const checkpointRestored = restoreSessionCheckpoint(project, session);
    expect(checkpointRestored).toMatchObject({
      lifeSkills: { skill_farming: { xp: 420, level: 4 } },
      energy: 48,
      shippingQueue: { item_turnip: 3 },
      dayTransitionLastDayKey: "1:spring:4",
      completedBundleIds: ["bundle_spring"],
      unlockedRecipeIds: ["recipe_preserves"],
      makerInstances: {
        "farm:4,5": expect.objectContaining({ readyAtMinute: 1_100 }),
      },
    });
  });

  it("removes zero shipping rows and drops arithmetically forged settlement history", () => {
    // Break caught: a parsed zero row later blocks settlement, while forged totals are displayed as trusted history.
    const project = createBlankProject();
    configureP0PersistenceProject(project);
    const snapshot = createSaveSnapshot(project, startSession(project, 20));
    const wireSession = snapshot.session as unknown as Record<string, unknown>;
    wireSession.shippingQueue = { item_turnip: 2, item_zero: 0 };
    wireSession.shippingHistory = [{
      dayKey: "1:spring:1",
      entries: [{ itemId: "item_turnip", count: 2, unitPrice: 10, subtotal: 999 }],
      total: 999,
      credited: 999,
    }];
    const storage = new MemoryStorage();
    saveToSlot(storage, 3, snapshot);

    const read = readSaveSlot(storage, 3);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected a parsed save slot");
    expect(read.snapshot.session.shippingQueue).toEqual({ item_turnip: 2 });
    expect(read.snapshot.session.shippingHistory).toBeUndefined();
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.shippingQueue).toEqual({ item_turnip: 2 });
    expect(restored.shippingHistory).toEqual([]);
  });

  it("drops P0 progress whose authored shipping, bundle, or maker definition was deleted", () => {
    // Break caught: stale save state survives content deletion and later mints items or completes unknown ids.
    const project = createBlankProject();
    configureP0PersistenceProject(project);
    const session = startSession(project, 21);
    session.shippingQueue = { item_turnip: 2 };
    session.shippingLastSettledDayKey = "1:spring:1";
    session.shippingHistory = [{ dayKey: "1:spring:1", entries: [], total: 0, credited: 0 }];
    session.bundleContributions = { bundle_spring: { item_turnip: 1 } };
    session.completedBundleIds = ["bundle_mine"];
    session.bundleRewardAppliedIds = ["bundle_mine"];
    session.unlockedRegionIds = ["region_bridge"];
    session.unlockedRecipeIds = ["recipe_preserves"];
    session.makerInstances = {
      "farm:1,1": {
        instanceId: "farm:1,1",
        makerId: "maker_preserves",
        status: "processing",
        startedAtMinute: 100,
        readyAtMinute: 1_540,
      },
    };
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected a parsed save slot");

    delete project.system.shipping;
    delete project.system.bundles;
    delete project.system.worldUnlocks;
    delete project.system.craftRecipes;
    delete project.system.makers;
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.shippingQueue).toEqual({});
    expect(restored.shippingLastSettledDayKey).toBeUndefined();
    expect(restored.shippingHistory).toEqual([]);
    expect(restored.bundleContributions).toEqual({});
    expect(restored.completedBundleIds).toEqual([]);
    expect(restored.bundleRewardAppliedIds).toEqual([]);
    expect(restored.unlockedRegionIds).toEqual([]);
    expect(restored.unlockedRecipeIds).toEqual([]);
    expect(restored.makerInstances).toEqual({});
  });
});
