import { describe, expect, it } from "vitest";
import { normalizeItemRecord, normalizeEnemyRecord, normalizeSkillRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { absoluteGameMinutes, advanceMakers, collectMaker, startMaker } from "@/project/makers";
import { startSession, changeItem, GOLD_MAX, type MonsterInstance } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readAutosave, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { contributeBundle } from "@/project/bundles";
import { depositShipping, settleShipping, withdrawShipping } from "@/project/shipping";
import { applyItemUpgrade, resolveToolCapability } from "@/project/upgrades";
import { performAutosave } from "@/player/autosave";
import { restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import { calendarDayKey } from "@/project/gameTime";
import { transitionToNextDay } from "@/player/dayTransition";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { monsterBattleStats, monsterSpeciesById, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("p0Makers", () => {
  isolateTimers();
  function makerProject() {
    const project = createBlankProject();
    for (const id of ["item_milk", "item_cheese"]) {
      const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
      const index = project.database.items.findIndex((item) => item.id === id);
      if (index >= 0) project.database.items[index] = record;
      else project.database.items.push(record);
    }
    project.system.timeSystem = {
      enabled: true,
      dayStartHour: 6,
      dayEndHour: 26,
      daysPerSeason: 28,
    };
    project.system.makers = [{
      id: "maker_cheese",
      inputs: [{ itemId: "item_milk", count: 1 }],
      outputs: [{ itemId: "item_cheese", count: 2 }],
      durationMinutes: 30,
    }];
    return project;
  }
  describe("P0 timed makers", () => {
    it("uses a monotonic absolute game-minute clock across a season/day boundary", () => {
      // Break caught: spring 28 late-night → summer 1 morning makes the timer move backwards.
      const project = makerProject();
      const before = absoluteGameMinutes(
        { year: 1, season: "spring", day: 28, hour: 25, minute: 30 },
        project.system.timeSystem,
      );
      const after = absoluteGameMinutes(
        { year: 1, season: "summer", day: 1, hour: 6, minute: 0 },
        project.system.timeSystem,
      );
      expect(after - before).toBe(30);

      const session = startSession(project, 1);
      session.inventory = { item_milk: 1 };
      expect(startMaker(project, session, "farm:4,5", "maker_cheese", before)).toMatchObject({
        ok: true,
        readyAtMinute: after,
      });
      expect(session.inventory.item_milk).toBeUndefined();
      expect(advanceMakers(project, session, after - 1)).toEqual({ ok: true, readyInstanceIds: [] });
      expect(session.makerInstances?.["farm:4,5"]?.status).toBe("processing");
      expect(advanceMakers(project, session, after)).toEqual({ ok: true, readyInstanceIds: ["farm:4,5"] });
      expect(session.makerInstances?.["farm:4,5"]?.status).toBe("ready");
    });

    it("preserves a processing timer through the shared save snapshot path", () => {
      // Break caught: a save/load recreates a processing maker as idle or shifts its deadline.
      const project = makerProject();
      const session = startSession(project, 2);
      session.inventory = { item_milk: 1 };
      expect(startMaker(project, session, "farm:1,1", "maker_cheese", 1_000).ok).toBe(true);

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.makerInstances).toEqual(session.makerInstances);
      expect(advanceMakers(project, restored, 1_030)).toEqual({ ok: true, readyInstanceIds: ["farm:1,1"] });
      expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({
        ok: true,
        outputs: [{ itemId: "item_cheese", count: 2 }],
      });
      expect(restored.inventory.item_cheese).toBe(2);
      expect(restored.makerInstances?.["farm:1,1"]).toEqual({
        instanceId: "farm:1,1",
        makerId: "maker_cheese",
        status: "idle",
      });
      const frozen = structuredClone(restored);
      expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({ ok: false, reason: "not-ready" });
      expect(restored).toEqual(frozen);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid absolute minute %s before consuming inputs",
      (minute) => {
        // Break caught: invalid/overflow deadlines consume inputs and leave an unusable instance.
        const project = makerProject();
        const session = startSession(project, 3);
        session.inventory = { item_milk: 1 };
        expect(startMaker(project, session, "farm:2,2", "maker_cheese", minute)).toMatchObject({ ok: false, reason: "invalid-time" });
        expect(session.inventory).toEqual({ item_milk: 1 });
        expect(session.makerInstances).toEqual({});
      },
    );

    it("rejects missing inventory, busy instances, and invalid definitions atomically", () => {
      // Break caught: maker input is consumed before busy/definition validation completes.
      const project = makerProject();
      const session = startSession(project, 4);
      session.inventory = {};
      expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "insufficient-input" });
      expect(session.makerInstances).toEqual({});

      session.inventory = { item_milk: 2 };
      expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100).ok).toBe(true);
      const busy = structuredClone(session);
      expect(startMaker(project, session, "farm:3,3", "maker_cheese", 110)).toMatchObject({ ok: false, reason: "busy" });
      expect(session).toEqual(busy);

      const broken = makerProject();
      broken.system.makers![0] = {
        ...broken.system.makers![0]!,
        outputs: [{ itemId: "item_missing", count: 1 }],
      };
      const brokenSession = startSession(broken, 5);
      brokenSession.inventory = { item_milk: 1 };
      const before = structuredClone(brokenSession);
      expect(startMaker(broken, brokenSession, "farm:4,4", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "invalid-definition" });
      expect(brokenSession).toEqual(before);
    });
  });
});

describe("p0SafetyHardening", () => {
  isolateTimers();
  const ITEM_MAX = 9_999_999;
  function addItem(project: ReturnType<typeof createBlankProject>, id: string, farmTool?: "axe"): void {
    const item = normalizeItemRecord({ id, name: id, scope: "none", price: 20, farmTool });
    const index = project.database.items.findIndex((entry) => entry.id === id);
    if (index >= 0) project.database.items[index] = item;
    else project.database.items.push(item);
  }
  describe("P0 hostile item quantity hardening", () => {
    it.each([
      { current: 1e300, op: "+=" as const, amount: 1 },
      { current: ITEM_MAX, op: "+=" as const, amount: 1 },
      { current: 1, op: "+=" as const, amount: Number.MAX_SAFE_INTEGER },
      { current: 1, op: "=" as const, amount: 1e300 },
    ])("rejects unsafe current/delta/result without touching inventory or charge cursors: $current $op $amount", ({ current, op, amount }) => {
      // Break caught: changeItem forwards unsafe arithmetic to itemTransitions,
      // silently sanitizing or overflowing state instead of failing atomically.
      const project = createBlankProject();
      const session = startSession(project, 1);
      session.inventory = { item_target: current, item_other: 2 };
      session.itemUseCharges = { item_target: 1, item_other: 1 };
      const before = structuredClone({ inventory: session.inventory, itemUseCharges: session.itemUseCharges });

      expect(changeItem(session, "item_target", op, amount)).toBe(false);
      expect({ inventory: session.inventory, itemUseCharges: session.itemUseCharges }).toEqual(before);
    });

    it("keeps shipping, bundle, and upgrade transactions unchanged for forged 1e300 stacks", () => {
      // Break caught: domain prechecks accept a finite integer like 1e300, then
      // subtraction loses precision and the same forged stack buys multiple outputs.
      const project = createBlankProject();
      for (const id of ["item_input", "item_reward", "item_tool"]) addItem(project, id);
      project.system.shipping = { enabled: true };
      project.system.sellPrices = [{ itemId: "item_input", price: 10 }];
      project.system.bundles = [{
        id: "bundle",
        requirements: [{ itemId: "item_input", count: 1 }],
        reward: { itemRewards: [{ itemId: "item_reward", count: 1 }] },
      }];
      project.system.itemUpgrades = [{
        id: "upgrade",
        fromItemId: "item_input",
        toItemId: "item_tool",
      }];
      const session = startSession(project, 2);
      session.inventory = { item_input: 1e300 };

      for (const action of [
        () => depositShipping(project, session, "item_input", 1),
        () => contributeBundle(project, session, "bundle", "item_input", 1),
        () => applyItemUpgrade(project, session, "upgrade"),
      ]) {
        const before = structuredClone(session);
        expect(action()).toMatchObject({ ok: false });
        expect(session).toEqual(before);
      }
    });

    it("does not start a maker from a safe-integer stack above the shared item cap", () => {
      const project = createBlankProject();
      addItem(project, "item_input");
      addItem(project, "item_output");
      project.system.makers = [{
        id: "maker",
        inputs: [{ itemId: "item_input", count: 1 }],
        outputs: [{ itemId: "item_output", count: 1 }],
        durationMinutes: 10,
      }];
      const session = startSession(project, 5);
      session.inventory = { item_input: ITEM_MAX + 1 };
      const before = structuredClone(session);

      expect(startMaker(project, session, "farm:0,0", "maker", 100)).toMatchObject({ ok: false });
      expect(session).toEqual(before);
    });
  });
});

describe("p0SessionPersistence", () => {
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
    project.system.skillSystem = { enabled: true };
    project.database.lifeSkills = [
      { id: "skill_farming", name: "Farming", skillType: "farming", maxLevel: 5, levelUpRewards: [] },
      { id: "skill_mining", name: "Mining", skillType: "mining", maxLevel: 5, levelUpRewards: [] },
    ];
  }
  describe("P0 save snapshot regression", () => {
    it("preserves life skills and shop economy through writer, parser, and apply", () => {
      // Break caught: createSaveSnapshot/parse/apply silently omits live progression fields.
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      project.system.timeSystem = { enabled: true };
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
      session.gameTime = { year: 1, season: "spring", day: 12, hour: 9, minute: 30 };
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
      expect(restored.makerInstances).toEqual({ "farm:2,3": { ...session.makerInstances["farm:2,3"], status: "ready" } });
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

    it("removes a cursor that does not match the canonical day-key grammar at parse time", () => {
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      const session = startSession(project, 181);
      session.gameTime = { year: 1, season: "spring", day: 2, hour: 6, minute: 0 };
      const snapshot = createSaveSnapshot(project, session);
      const wireSession = snapshot.session as unknown as Record<string, unknown>;
      wireSession.dayTransitionLastDayKey = "1:spring:1:forged";
      const storage = new MemoryStorage();
      saveToSlot(storage, 2, snapshot);

      const read = readSaveSlot(storage, 2);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected a parsed save slot");
      expect(read.snapshot.session.dayTransitionLastDayKey).toBeUndefined();
    });

    it("drops a non-safe saved year before it can poison a loaded day transition", () => {
      // Break caught: 1e300 passes finite-integer validation, loads verbatim, then absoluteGameMinutes throws.
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      project.system.timeSystem = { enabled: true };
      const snapshot = createSaveSnapshot(project, startSession(project, 182));
      const wireSession = snapshot.session as unknown as Record<string, unknown>;
      wireSession.gameTime = { year: 1e300, season: "spring", day: 1, hour: 6, minute: 0 };
      const storage = new MemoryStorage();
      saveToSlot(storage, 2, snapshot);

      const read = readSaveSlot(storage, 2);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected a parsed save slot");
      expect(read.snapshot.session.gameTime).toBeUndefined();
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.gameTime).toEqual({ year: 1, season: "spring", day: 1, hour: 6, minute: 0 });
      expect(() => transitionToNextDay(project, restored, calendarDayKey(restored.gameTime))).not.toThrow();
    });

    it("normalizes a safe-integer year that still exceeds the absolute-minute range", () => {
      // Break caught: Number.MAX_SAFE_INTEGER is field-safe but maker absolute-minute arithmetic is not.
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      project.system.timeSystem = { enabled: true };
      const snapshot = createSaveSnapshot(project, startSession(project, 183));
      const poisoned = {
        ...snapshot,
        session: {
          ...snapshot.session,
          gameTime: {
            year: Number.MAX_SAFE_INTEGER,
            season: "spring" as const,
            day: 1,
            hour: 6,
            minute: 0,
          },
        },
      };

      const restored = applySaveSnapshot(project, poisoned);

      expect(restored.gameTime).toEqual({ year: 1, season: "spring", day: 1, hour: 6, minute: 0 });
    });

    it("uses the same P0 snapshot state for autosave and checkpoints", () => {
      // Break caught: a second save writer preserves manual slots but drops new state in auto/checkpoint flows.
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      project.system.timeSystem = { enabled: true };
      const session = startSession(project, 19);
      session.lifeSkills = { skill_farming: { xp: 500, level: 4 } };
      session.energy = 48;
      session.gameTime = { year: 1, season: "spring", day: 5, hour: 8, minute: 0 };
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
        makerInstances: { "farm:4,5": { ...session.makerInstances["farm:4,5"], status: "ready" } },
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
        lifeSkills: { skill_farming: { xp: 500, level: 4 } },
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

    it("quarantines removed P0 assets and retains completed rights without paying them", () => {
      // Deleted content cannot mint items; the recovery owner and completed rights must survive.
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
      expect(restored.completedBundleIds).toEqual(["bundle_mine"]);
      expect(restored.bundleRewardAppliedIds).toEqual(["bundle_mine"]);
      expect(restored.unlockedRegionIds).toEqual(["region_bridge"]);
      expect(restored.unlockedRecipeIds).toEqual(["recipe_preserves"]);
      expect(restored.makerInstances).toEqual({});
      expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([
        { sourceKind: "shippingQueue", items: [{ itemId: "item_turnip", count: 2 }] },
        { sourceKind: "bundleContributions", items: [{ itemId: "item_turnip", count: 1 }] },
        { sourceKind: "makerInstances", items: [], unresolved: { record: session.makerInstances["farm:1,1"] } },
      ]);
      expect(restored.inventory).toEqual(session.inventory);
    });

    it("normalizes hostile skill, maker, and bundle receipt state against the current project", () => {
      // Break caught: direct snapshot apply trusts stale skill ids, inconsistent
      // levels, unsafe maker deadlines, and one-sided completion receipts.
      const project = createBlankProject();
      configureP0PersistenceProject(project);
      const snapshot = createSaveSnapshot(project, startSession(project, 22));
      const hostile = snapshot.session as unknown as Record<string, unknown>;
      hostile.lifeSkills = {
        skill_farming: { xp: 275, level: 99 },
        skill_mining: { xp: 1e300, level: 2 },
        skill_deleted: { xp: 100, level: 2 },
      };
      hostile.bundleContributions = { bundle_spring: { item_turnip: 2 } };
      hostile.completedBundleIds = ["bundle_spring"];
      hostile.bundleRewardAppliedIds = [];
      hostile.makerInstances = {
        "farm:unsafe": {
          instanceId: "farm:unsafe",
          makerId: "maker_preserves",
          status: "processing",
          startedAtMinute: 100,
          readyAtMinute: 1e300,
        },
      };

      const restored = applySaveSnapshot(project, snapshot);

      expect(restored.lifeSkills).toEqual({ skill_farming: { xp: 275, level: 3 } });
      expect(restored.makerInstances).toEqual({});
      expect(restored.completedBundleIds).toEqual(["bundle_spring"]);
      expect(restored.bundleRewardAppliedIds).toEqual(["bundle_spring"]);
    });
  });
});

describe("p0Shipping", () => {
  isolateTimers();
  function projectWithShipping(historyLimit = 2) {
    const project = createBlankProject();
    for (const [id, price] of [["item_turnip", 20], ["item_milk", 40]] as const) {
      const record = normalizeItemRecord({ id, name: id, scope: "none", price });
      const index = project.database.items.findIndex((item) => item.id === id);
      if (index >= 0) project.database.items[index] = record;
      else project.database.items.push(record);
    }
    project.system.shipping = { enabled: true, historyLimit };
    project.system.sellPrices = [
      { itemId: "item_turnip", price: 10 },
      { itemId: "item_milk", price: 25 },
    ];
    return project;
  }
  describe("P0 shipping rules", () => {
    it("deposits and withdraws inventory atomically", () => {
      // Break caught: queue changes without the inverse inventory movement.
      const project = projectWithShipping();
      const session = startSession(project, 1);
      session.inventory = { item_turnip: 5 };

      expect(depositShipping(project, session, "item_turnip", 3)).toEqual({
        ok: true,
        itemId: "item_turnip",
        queued: 3,
      });
      expect(session.inventory.item_turnip).toBe(2);
      expect(session.shippingQueue?.item_turnip).toBe(3);

      expect(withdrawShipping(project, session, "item_turnip", 2)).toEqual({
        ok: true,
        itemId: "item_turnip",
        queued: 1,
      });
      expect(session.inventory.item_turnip).toBe(4);
      expect(session.shippingQueue?.item_turnip).toBe(1);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
      "rejects malformed deposit count %s without mutation",
      (count) => {
        // Break caught: invalid counts remove or mint inventory entries.
        const project = projectWithShipping();
        const session = startSession(project, 2);
        session.inventory = { item_turnip: 5 };
        expect(depositShipping(project, session, "item_turnip", count)).toMatchObject({ ok: false, reason: "invalid-count" });
        expect(session.inventory).toEqual({ item_turnip: 5 });
        expect(session.shippingQueue).toEqual({});
      },
    );

    it("rejects unknown, disallowed, insufficient, and over-withdraw operations without partial mutation", () => {
      // Break caught: an error branch mutates one side of the inventory/queue transaction.
      const project = projectWithShipping();
      project.system.shipping = { enabled: true, allowedItemIds: ["item_turnip"] };
      const session = startSession(project, 3);
      session.inventory = { item_turnip: 1, item_milk: 2 };

      expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
      project.system.sellPrices!.push({ itemId: "item_missing", price: 99 });
      session.inventory.item_missing = 1;
      expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
      delete session.inventory.item_missing;
      expect(depositShipping(project, session, "item_milk", 1)).toMatchObject({ ok: false, reason: "item-not-allowed" });
      expect(depositShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
      expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });
      expect(session.shippingQueue).toEqual({});

      session.shippingQueue = { item_turnip: 1 };
      expect(withdrawShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-queue" });
      expect(session.shippingQueue).toEqual({ item_turnip: 1 });
      expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });

      session.shippingQueue = { item_missing: 1 };
      const staleQueue = structuredClone(session);
      expect(withdrawShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
      expect(session).toEqual(staleQueue);
    });

    it("settles one day exactly once, caps gold, and bounds immutable history", () => {
      // Break caught: replaying a day-end credits gold twice or grows history without bound.
      const project = projectWithShipping(2);
      const session = startSession(project, 4);
      session.gold = GOLD_MAX - 6;
      session.shippingQueue = { item_turnip: 2 };

      const first = settleShipping(project, session, "1:spring:1");
      expect(first).toMatchObject({ ok: true, total: 20, credited: 6 });
      expect(session.gold).toBe(GOLD_MAX);
      expect(session.shippingQueue).toEqual({});
      expect(session.shippingLastSettledDayKey).toBe("1:spring:1");
      expect(session.shippingHistory?.[0]).toMatchObject({ dayKey: "1:spring:1", total: 20, credited: 6 });

      const frozen = structuredClone(session);
      expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: false, reason: "already-settled" });
      expect(session).toEqual(frozen);

      session.shippingQueue = { item_milk: 1 };
      expect(settleShipping(project, session, "1:spring:2").ok).toBe(true);
      session.shippingQueue = {};
      expect(settleShipping(project, session, "1:spring:3").ok).toBe(true);
      const afterEmptySettlement = structuredClone(session);
      expect(settleShipping(project, session, "1:spring:3")).toMatchObject({ ok: false, reason: "already-settled" });
      expect(session).toEqual(afterEmptySettlement);
      expect(session.shippingHistory?.map((entry) => entry.dayKey)).toEqual(["1:spring:2", "1:spring:3"]);
    });

    it("does not settle a malformed queue or blank day key", () => {
      // Break caught: settlement clears valid rows before discovering an invalid row.
      const project = projectWithShipping();
      const session = startSession(project, 5);
      session.shippingQueue = { item_turnip: 1, item_missing: 1 };
      const before = structuredClone(session);
      expect(settleShipping(project, session, "1:spring:4")).toMatchObject({ ok: false, reason: "unknown-item" });
      expect(session).toEqual(before);
      expect(settleShipping(project, session, "   ")).toMatchObject({ ok: false, reason: "invalid-day-key" });
      expect(session).toEqual(before);
    });
  });
});

describe("p0ToolCapability", () => {
  isolateTimers();
  describe("P0 upgraded tool capabilities", () => {
    it("resolves the upgraded item area and energy multiplier after replacement", () => {
      // Break caught: upgrade swaps item ids but runtime queries still see base 1x1/1.0 behavior.
      const project = createBlankProject();
      for (const id of ["item_hoe", "item_hoe_iron"]) {
        const record = normalizeItemRecord({ id, name: id, scope: "none", price: 50, farmTool: "hoe" });
        const index = project.database.items.findIndex((item) => item.id === id);
        if (index >= 0) project.database.items[index] = record;
        else project.database.items.push(record);
      }
      project.system.itemUpgrades = [{
        id: "upgrade_hoe_iron",
        fromItemId: "item_hoe",
        toItemId: "item_hoe_iron",
        capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.75 },
      }];
      const session = startSession(project, 1);
      session.inventory = { item_hoe: 1 };
      session.equippedToolItemId = "item_hoe";

      expect(resolveToolCapability(project, "item_hoe")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
      expect(applyItemUpgrade(project, session, "upgrade_hoe_iron").ok).toBe(true);
      expect(session.equippedToolItemId).toBe("item_hoe_iron");
      expect(resolveToolCapability(project, session.equippedToolItemId)).toEqual({
        areaWidth: 3,
        areaHeight: 3,
        energyMultiplier: 0.75,
      });
    });

    it("keeps legacy upgrade rows at safe default behavior and ignores malformed capability values", () => {
      // Break caught: omitted/invalid additive fields change legacy tools or emit NaN costs.
      const project = createBlankProject();
      project.system.itemUpgrades = [{ id: "legacy", fromItemId: "a", toItemId: "b" }];
      expect(resolveToolCapability(project, "b")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
      project.system.itemUpgrades = [{
        id: "bad",
        fromItemId: "a",
        toItemId: "c",
        capability: { areaWidth: 0, areaHeight: Number.NaN, energyMultiplier: -1 },
      }];
      expect(resolveToolCapability(project, "c")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });

      project.system.itemUpgrades = [{
        id: "oversized",
        fromItemId: "a",
        toItemId: "d",
        capability: { areaWidth: 10, areaHeight: 9, energyMultiplier: 1 },
      }];
      expect(resolveToolCapability(project, "d")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
    });
  });
});

// B6's six July gauge calibrations predate Pokemon stats and the actor-party enemy rebalance.
// Preserve the seven tracked coverage slots and the existing type-effectiveness check,
// using explicit Gen1 fixtures and independent known answers rather than retuning shipped data.
describe("pkmnBalanceB6", () => {
  isolateTimers();
  const STARTERS = ["species_aqualing", "species_leafling", "species_sparkit"] as const;
  function mon(project: Project, speciesId: string, level: number, id = "mon_1"): MonsterInstance {
    return {
      instanceId: id, speciesId, level, exp: 0,
      ivs: { hp: 0, atk: 0, def: 0, spd: 0 }, friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    };
  }
  function gen1Fixture() {
    const project = createBlankProject();
    project.system = {
      ...project.system, battleModel: "gen1", battleFlow: "strict", battleUiStyle: "pokemon",
      battleParty: "monsters", monsterCollection: true, activeSlots: undefined,
      typeChart: { types: ["normal", "water"], multipliers: { normal: { water: 1 } } },
    };
    const species = normalizeMonsterSpeciesRecord({
      id: "species_b6", name: "B6 specimen", types: ["water"],
      baseStats: { maxHp: 100, maxMp: 0, attack: 95, defense: 95, mind: 95, agility: 40 },
      skillsByLevel: [{ level: 1, skillId: "skill_b6" }],
    });
    const skill = normalizeSkillRecord({
      id: "skill_b6", name: "B6 strike", type: "normal", scope: "enemy",
      mpCost: { flat: 0, percentMax: 0 }, power: 40, hitRate: 100, successRate: 100, variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      elementId: "normal", maxPp: 5, movePriority: 1,
    });
    const enemy = normalizeEnemyRecord({
      id: "enemy_b6", name: "B6 opponent", speciesId: species.id, level: 50,
      stats: { maxHp: 100, maxMp: 0, attack: 1, defense: 100, mind: 100, agility: 1 },
      actions: [{ skillId: "skill_b6_enemy", priority: 5, condition: { kind: "always" } }],
      stateRates: {}, elementRates: {},
    });
    project.database.monsterSpecies = [species];
    project.database.skills = [skill, { ...skill, id: "skill_b6_enemy", name: "B6 reply", movePriority: 0 }];
    project.database.enemies = [enemy];
    project.database.troops = [normalizeTroopRecord({ id: "troop_b6", name: "B6 duel", enemyIds: [enemy.id] })];
    project.database.states = [];
    project.database.elements = [{
      id: "normal", name: "Normal", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"],
      damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
    }];
    return { project, species, skill, enemy };
  }
  function duel(project: Project, party: readonly MonsterInstance[]) {
    // Each move gets noncritical byte 255, maximum damage byte 255, and hit byte 0.
    // One target/action and unequal priority/Speed avoid unrelated RNG draws.
    let byteIndex = 0;
    return createBattleRuntime({
      project, troopId: "troop_b6", partyMonsters: party, canEscape: false, canLose: true,
      rng: () => (byteIndex++ % 3 === 2 ? 0 : 255 / 256),
    });
  }
  const strike = { kind: "skill", skillId: "skill_b6", targetEnemyId: "enemy-1" } as const;
  describe("batch 6 · explicit Gen1 combat contracts", () => {
    it("uses Pokemon stat known answers at L5 and L50 with explicit IVs", () => {
      const { project, species } = gen1Fixture();
      const starter = mon(project, species.id, 5);
      const trained = { ...starter, level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } };

      // HP=floor((200+IV)*L/100)+L+10; other stats=floor((190+IV)*L/100)+5.
      expect(monsterBattleStats(project, starter)).toEqual({ maxHp: 25, maxMp: 0, attack: 14, defense: 14, mind: 14, agility: 9 });
      expect(monsterBattleStats(project, trained)).toEqual({ maxHp: 167, maxMp: 0, attack: 107, defense: 107, mind: 100, agility: 52 });
    });

    it("deals the cartridge L50 P40 A100 D100 known answer and spends one PP", () => {
      const { project, species } = gen1Fixture();
      const runtime = duel(project, [mon(project, species.id, 50)]);
      const before = runtime.snapshot();
      expect(before.actors[0]?.skillPp?.skill_b6).toBe(5);

      runtime.performActorCommand(strike);

      // floor(floor((floor(2*50/5)+2)*40*100/100)/50)+2 = 19; no STAB.
      const after = runtime.snapshot();
      expect(after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
        .toMatchObject({ hit: true, critical: false, amount: 19 });
      expect(after.enemies[0]?.hp).toBe(81);
      expect(after.actors[0]?.skillPp?.skill_b6).toBe(4);
    });

    it("orders a slow priority move before a fast opponent and Speed breaks equal priority", () => {
      for (const priority of [1, 0]) {
        const { project, species, skill, enemy } = gen1Fixture();
        skill.movePriority = priority;
        enemy.stats.agility = 100;
        const runtime = duel(project, [mon(project, species.id, 50)]);

        runtime.performActorCommand(strike);

        const sides = runtime.snapshot().roundLogs.flatMap((round) => round.actions.map((action) => action.side));
        expect(sides).toEqual(priority === 1 ? ["actor", "enemy"] : ["enemy", "actor"]);
      }
    });

    it("matches both combatants at L26 and uses that level in the damage formula", () => {
      const { project, species, enemy } = gen1Fixture();
      enemy.level = 26;
      enemy.stats = { maxHp: 88, maxMp: 0, attack: 54, defense: 54, mind: 54, agility: 25 };
      const runtime = duel(project, [mon(project, species.id, 26)]);
      const before = runtime.snapshot();
      expect(before.actors[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });
      expect(before.enemies[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });

      runtime.performActorCommand(strike);

      // L26's level term is 12: floor(12*40/50)+2 = 11, not the L50 answer 19.
      expect(runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
        .toMatchObject({ hit: true, critical: false, amount: 11 });
    });

    it("counts two usable-move decisions and two resolved attacks in a seeded Gen1 simulation", () => {
      const { project, species, enemy } = gen1Fixture();
      species.baseStats.agility = 1; // Critical threshold floor(base Speed / 2) = 0.
      enemy.stats.maxHp = 20; // Two neutral hits of 16..19, never a one-hit victory.
      const actor = { ...mon(project, species.id, 50), skillPp: { skill_b6: 2 } };

      const result = simulateBattle({ project, troopId: "troop_b6", heroLevel: 1, monsterParty: [actor], n: 1, seed: 42, maxSteps: 4 });

      expect(result.battleFlow).toBe("strict");
      expect(result.samples).toBe(1);
      expect(result.winRate).toBe(1);
      expect(result.avgTurns).toBe(2);
      const actions = result.roundLogs.flatMap((round) => round.actions).filter((action) => action.side === "actor");
      expect(actions.map((action) => ({ kind: action.commandKind, hit: action.hit })))
        .toEqual([{ kind: "skill", hit: true }, { kind: "skill", hit: true }]);
      expect(result.participatingActorIds).toEqual(["mon_1"]);
      expect(actor.skillPp).toEqual({ skill_b6: 2 }); // Simulation consumes battle state, not its input.
    });

    it("defaults a Gen1 trio to one active monster and admits reserves only by switching", () => {
      const { project, species } = gen1Fixture();
      const party = ["mon_1", "mon_2", "mon_3"].map((id) => mon(project, species.id, 50, id));
      const runtime = duel(project, party);
      expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_1"]);
      expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_2", "mon_3"]);
      expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1"]);

      runtime.performActorCommand({ kind: "switch", targetActorId: "mon_2" });

      expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_2"]);
      expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_1", "mon_3"]);
      expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1", "mon_2"]);
      expect(runtime.snapshot().reserveActors.find((actor) => actor.recordId === "mon_3")?.hp).toBe(160);
    });
  });
  describe("batch 6 · type weakness is clearly felt (>=3x vs resist)", () => {
    function skillDamageVs(targetSpecies: string, level: number): number {
      const project = createBlankProject();
      const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
      if (!enemy) throw new Error("missing enemy_slime");
      enemy.speciesId = targetSpecies;
      // 적은 과녁일 뿐이다: 먼저 움직이거나(민첩) 정신력 기술(독침)로 몬스터를 쓰러뜨리지 않게 한다.
      enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1, mind: 1, agility: 1 };
      const result = simulateBattle({
        project,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 3,
        monsterParty: [mon(project, "species_aqualing", level, "mon_w")],
        strictScript: [[{ actorId: "mon_w", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
        maxSteps: 6,
      });
      return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
    }

    it("water skill on fire target deals >=3x the damage of water target, at L5 and L35", () => {
      for (const level of [5, 35]) {
        const weak = skillDamageVs("species_cave_bat", level); // fire → 2× (+STAB)
        const resist = skillDamageVs("species_aqualing", level); // water → 0.5× (+STAB)
        expect(weak).toBeGreaterThan(0);
        expect(resist).toBeGreaterThan(0);
        expect(weak / resist).toBeGreaterThanOrEqual(3);
      }
    });
  });
  describe("batch 6 · progression ladder sanity", () => {
    it("L1 stats use the Pokemon formula through the instance API", () => {
      const project = createBlankProject();
      for (const speciesId of STARTERS) {
        const species = monsterSpeciesById(project, speciesId);
        if (!species) throw new Error(`missing ${speciesId}`);
        const stats = monsterBattleStats(project, mon(project, speciesId, 1));
        expect(stats.maxHp).toBe(Math.floor(2 * species.baseStats.maxHp / 100) + 11);
        expect(stats.attack).toBe(Math.floor(2 * species.baseStats.attack / 100) + 5);
        expect(stats.defense).toBe(Math.floor(2 * species.baseStats.defense / 100) + 5);
        expect(stats.mind).toBe(Math.floor(2 * species.baseStats.mind / 100) + 5);
        expect(stats.agility).toBe(Math.floor(2 * species.baseStats.agility / 100) + 5);
      }
    });
  });
});
