import { describe, expect, it } from "vitest";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { donateMuseumItem } from "@/project/museum";
import { settleShipping } from "@/project/shipping";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { GOLD_MAX } from "@/project/session";
import { startSession } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

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
    project.system.seasonalForage!.areas[0]!.dailySpawnCount = 0;
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
    project.system.museum!.rewards = [
      { id: "reward_a", minDonations: 1, reward: { gold: 4 } },
      { id: "reward_b", minDonations: 1, reward: { gold: 4 } },
    ];
    const session = startSession(project, 408);
    session.inventory.item_trout = 1;
    session.gold = GOLD_MAX - 5;
    const before = structuredClone(session);
    expect(donateMuseumItem(project, session, "item_trout")).toMatchObject({ ok: false, reason: "invalid-reward" });
    expect(session).toEqual(before);
  });
});
