import { describe, expect, it } from "vitest";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { donateMuseumItem } from "@/project/museum";
import { settleShipping } from "@/project/shipping";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { GOLD_MAX, startSession, nextSessionRandom } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("p2LifeRuntime", () => {
  isolateTimers();
  describe("P2 deterministic fishing and unified collection progress", () => {
    it("filters without consuming RNG and commits catch, energy, inventory, collection, and XP together", () => {
      // Break caught: availability consumes RNG or a successful catch updates only a subset of its receipt.
      const project = p2LifeProject();
      const session = startSession(project, 401);
      const beforePreview = structuredClone(session.rng);

      expect(resolveFishingAvailability(project, session, { mapId: project.startMapId, x: 1, y: 1 })).toEqual({
        ok: true,
        spotId: "spot_pond",
        fishIds: ["fish_trout"],
      });
      expect(session.rng).toEqual(beforePreview);

      expect(attemptFishingCatch(project, session, { mapId: project.startMapId, x: 1, y: 1 })).toMatchObject({
        ok: true,
        fishId: "fish_trout",
        itemId: "item_trout",
      });
      expect(session.energy).toBe(7);
      expect(session.inventory.item_trout).toBe(1);
      expect(session.collections?.item_trout).toEqual({ discovered: true, shippedCount: 0, caughtCount: 1, donated: false });
      expect(session.lifeSkills?.life_fishing?.xp).toBe(12);
      expect(session.rng).not.toEqual(beforePreview);
    });

    it("leaves RNG and every other state unchanged when a catch cannot fit", () => {
      // Break caught: catch RNG/energy/XP advances before inventory overflow is discovered.
      const project = p2LifeProject();
      const session = startSession(project, 402);
      session.inventory.item_trout = ITEM_QUANTITY_MAX;
      const before = structuredClone(session);

      expect(attemptFishingCatch(project, session, { mapId: project.startMapId, x: 1, y: 1 })).toMatchObject({ ok: false, reason: "inventory" });
      expect(session).toEqual(before);
    });
  });
  describe("P2 seasonal forage", () => {
    it("spawns a deterministic bounded set once per destination day and collects atomically", () => {
      // Break caught: a repeated day call duplicates forage or collection removes the object before item/XP succeeds.
      const project = p2LifeProject();
      const session = startSession(project, 403);
      const date = { year: 1, season: "spring" as const, day: 2, hour: 6, minute: 0 };

      // Collection is checked against the live date, not a future generator preview.
      session.gameTime = date;
      const first = advanceSeasonalForage(project, session, date);
      expect(first).toMatchObject({ ok: true, dayKey: "1:spring:2", spawned: 2, removed: 0 });
      const generated = Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn);
      expect(generated).toHaveLength(2);
      expect(generated.every((entry) => entry.kind === "forage" && entry.itemId === "item_berry")).toBe(true);
      const afterFirst = structuredClone(session);
      expect(advanceSeasonalForage(project, session, date)).toMatchObject({ ok: false, reason: "already-advanced" });
      expect(session).toEqual(afterFirst);

      const target = generated[0]!;
      expect(collectForageAt(project, session, target.mapId, target.x, target.y)).toMatchObject({ ok: true, itemId: "item_berry" });
      expect(session.inventory.item_berry).toBe(1);
      expect(session.collections?.item_berry?.discovered).toBe(true);
      expect(session.lifeSkills?.life_foraging?.xp).toBeGreaterThan(0);
      expect(session.placeables?.[`${target.mapId}:${target.x},${target.y}`]).toBeUndefined();
    });

    it("cleans expired generated forage without deleting legacy placeables", () => {
      // Break caught: cleanup treats every placeable as forage or leaves season-old generated items forever.
      const project = p2LifeProject();
      const session = startSession(project, 404);
      session.placeables![`${project.startMapId}:9,9`] = { id: "legacy", mapId: project.startMapId, x: 9, y: 9, kind: "rock", itemId: "item_berry" };
      expect(advanceSeasonalForage(project, session, { year: 1, season: "spring", day: 1, hour: 6, minute: 0 }).ok).toBe(true);
      const forage = project.system.seasonalForage;
      if (!forage) throw new Error("Missing fixture forage");
      project.system.seasonalForage = { ...forage, areas: forage.areas.map(area => ({ ...area, dailySpawnCount: 0 })) };
      expect(advanceSeasonalForage(project, session, { year: 1, season: "summer", day: 1, hour: 6, minute: 0 })).toMatchObject({ ok: true, removed: 2 });
      expect(session.placeables?.[`${project.startMapId}:9,9`]?.kind).toBe("rock");
    });
  });
  describe("P2 shipping collections and museum", () => {
    it("records only settled shipping and keeps exact-once settlement", () => {
      // Break caught: depositing or retrying settlement double-counts the shipped collection.
      const project = p2LifeProject();
      const session = startSession(project, 405);
      session.shippingQueue = { item_trout: 2 };
      expect(settleShipping(project, session, "1:spring:1").ok).toBe(true);
      expect(session.collections?.item_trout?.shippedCount).toBe(2);
      const after = structuredClone(session);
      expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: false, reason: "already-settled" });
      expect(session).toEqual(after);
    });

    it("donates once and applies every newly-qualified reward in the same transaction", () => {
      // Break caught: a duplicate donation consumes inventory or grants the milestone reward twice.
      const project = p2LifeProject();
      const session = startSession(project, 406);
      session.inventory.item_trout = 1;

      expect(donateMuseumItem(project, session, "item_trout")).toMatchObject({ ok: true, appliedRewardIds: ["museum_first"] });
      expect(session.inventory.item_trout).toBeUndefined();
      expect(session.inventory.item_reward).toBe(2);
      expect(session.gold).toBe(50);
      expect(session.collections?.item_trout).toMatchObject({ discovered: true, donated: true });
      expect(session.museumRewardAppliedIds).toEqual(["museum_first"]);
      const after = structuredClone(session);
      expect(donateMuseumItem(project, session, "item_trout")).toMatchObject({ ok: false, reason: "already-donated" });
      expect(session).toEqual(after);
    });

    it("rejects malformed source inventory without partial donation or rewards", () => {
      // Break caught: museum marks a donation after a hostile inventory quantity makes debit fail.
      const project = p2LifeProject();
      const session = startSession(project, 407);
      session.inventory.item_trout = 1e300;
      const before = structuredClone(session);
      expect(donateMuseumItem(project, session, "item_trout")).toMatchObject({ ok: false, reason: "inventory" });
      expect(session).toEqual(before);
    });

    it("preflights the combined gold of multiple newly-qualified rewards", () => {
      // Break caught: each reward fits alone but their combined gold silently clamps after donation.
      const project = p2LifeProject();
      const museum = project.system.museum;
      if (!museum) throw new Error("Missing fixture museum");
      project.system.museum = { ...museum, rewards: [
        { id: "reward_a", minDonations: 1, reward: { gold: 4 } },
        { id: "reward_b", minDonations: 1, reward: { gold: 4 } },
      ] };
      const session = startSession(project, 408);
      session.inventory.item_trout = 1;
      session.gold = GOLD_MAX - 5;
      const before = structuredClone(session);
      expect(donateMuseumItem(project, session, "item_trout")).toMatchObject({ ok: false, reason: "invalid-reward" });
      expect(session).toEqual(before);
    });
  });
});

describe("p2SessionPersistence", () => {
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
  describe("P2 session persistence", () => {
    it("round-trips collection, museum receipts, forage cursor/placeables, and fishing RNG", () => {
      // Break caught: common snapshot writers omit one or more P2 runtime authorities.
      const project = p2LifeProject();
      const session = startSession(project, 601);
      session.collections!.item_trout = { discovered: true, shippedCount: 3, caughtCount: 2, donated: true };
      session.museumRewardAppliedIds = ["museum_first"];
      session.gameTime = { year: 1, season: "spring", day: 2, hour: 6, minute: 0 };
      expect(advanceSeasonalForage(project, session, session.gameTime).ok).toBe(true);
      nextSessionRandom(session, "fishing");

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected present save");
      const restored = applySaveSnapshot(project, read.snapshot);

      expect(restored.collections).toEqual(session.collections);
      expect(restored.museumRewardAppliedIds).toEqual(["museum_first"]);
      expect(restored.forageLastAdvancedDayKey).toBe("1:spring:2");
      expect(Object.values(restored.placeables ?? {}).filter((entry) => entry.forageSpawn)).toHaveLength(2);
      expect(restored.rng?.streams.fishing).toEqual(session.rng?.streams.fishing);
    });

    it("accepts a legacy RNG payload without fishing while preserving every old stream", () => {
      // Break caught: adding fishing to RNG_STREAMS makes the whole legacy RNG payload invalid.
      const project = p2LifeProject();
      const session = startSession(project, 602);
      nextSessionRandom(session, "battle");
      nextSessionRandom(session, "movement");
      const snapshot = createSaveSnapshot(project, session);
      const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
      delete (legacy.session.rng!.streams as Record<string, unknown>).fishing;
      const oldBattle = structuredClone(legacy.session.rng!.streams.battle);
      const oldMovement = structuredClone(legacy.session.rng!.streams.movement);

      const storage = new MemoryStorage();
      saveToSlot(storage, 2, legacy);
      const read = readSaveSlot(storage, 2);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected legacy save");
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.rng?.streams.battle).toEqual(oldBattle);
      expect(restored.rng?.streams.movement).toEqual(oldMovement);
      expect(restored.rng?.streams.fishing).toEqual(expect.objectContaining({ seed: expect.any(Number), state: expect.any(Number) }));
    });

    it("sanitizes hostile P2 state and removes stale generated forage without touching legacy placeables", () => {
      // Break caught: unsafe counters/poison cursor/stale provenance survive direct apply.
      const project = p2LifeProject();
      const snapshot = createSaveSnapshot(project, startSession(project, 603));
      const raw = snapshot.session as unknown as Record<string, any>;
      raw.collections = {
        item_trout: { discovered: false, shippedCount: 2, caughtCount: 1e300, donated: false },
        item_berry: { discovered: false, shippedCount: 1, caughtCount: 0, donated: false },
      };
      raw.museumRewardAppliedIds = ["museum_first", "museum_first", " tombstone_removed ", ""];
      raw.forageLastAdvancedDayKey = "999999999:spring:1";
      raw.placeables = {
        [`${project.startMapId}:9,9`]: { id: "legacy", mapId: project.startMapId, x: 9, y: 9, kind: "rock", itemId: "item_berry" },
        [`${project.startMapId}:1,1`]: {
          id: "stale-forage", mapId: project.startMapId, x: 1, y: 1, kind: "forage", itemId: "item_berry",
          forageSpawn: { areaId: "deleted_area", entryId: "berry", spawnedDayKey: "1:spring:1" },
        },
      };

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.collections).toEqual({ item_berry: { discovered: true, shippedCount: 1, caughtCount: 0, donated: false } });
      expect(restored.museumRewardAppliedIds).toEqual(["museum_first", "tombstone_removed"]);
      expect(restored.forageLastAdvancedDayKey).toBeUndefined();
      expect(restored.placeables?.[`${project.startMapId}:9,9`]?.kind).toBe("rock");
      expect(restored.placeables?.[`${project.startMapId}:1,1`]).toBeUndefined();
    });

    it("loads omitted legacy P2 state without inventing it for projects that do not opt in", () => {
      // Break caught: additive save fields make old snapshots corrupt or leak P2 state into legacy projects.
      const project = p2LifeProject();
      const legacy = createSaveSnapshot(project, startSession(project, 604));
      delete (legacy.session as Record<string, unknown>).collections;
      delete (legacy.session as Record<string, unknown>).museumRewardAppliedIds;
      delete (legacy.session as Record<string, unknown>).forageLastAdvancedDayKey;
      expect(applySaveSnapshot(project, legacy)).toMatchObject({ collections: {}, museumRewardAppliedIds: [] });
    });
  });
});
