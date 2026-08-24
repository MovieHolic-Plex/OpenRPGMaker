import { describe, expect, it } from "vitest";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { attemptFishingCatch } from "@/project/fishing";
import { donateMuseumItem } from "@/project/museum";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { startSession } from "@/project/session";
import { placeFarmBuilding } from "@/project/spatialPlacementTransactions";
import type { Project } from "@/project/types";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

describe("P2 hostile fishing and collection boundaries", () => {
  it("fails closed when a fishing-enabled session has lost its collection authority", () => {
    // Break caught: deleting collections lets catches succeed without an exact caught receipt.
    const project = p2LifeProject();
    const session = startSession(project, 902);
    session.collections = undefined;
    const before = structuredClone(session);

    expect(attemptFishingCatch(project, session, fishingLocation(project))).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });

  it("rejects a stale fish item reference without minting an unknown inventory row", () => {
    // Break caught: direct project mutation bypasses reference lint and a catch grants a deleted item id.
    const project = p2LifeProject();
    project.database.fishSpecies![0]!.itemId = "deleted_fish_item";
    const session = startSession(project, 911);
    const before = structuredClone(session);

    expect(attemptFishingCatch(project, session, fishingLocation(project))).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });
});

describe("P2 hostile forage date, validation, and occupancy", () => {
  it("rejects a date beyond the authored season length without stamping the cursor", () => {
    // Break caught: spring day 29 aliases summer day 1 in a 28-day calendar and blocks a real future advance.
    const project = p2LifeProject();
    const session = startSession(project, 903);
    const before = structuredClone(session);

    expect(advanceSeasonalForage(project, session, {
      year: 1, season: "spring", day: 29, hour: 6, minute: 0,
    })).toEqual({ ok: false, reason: "invalid-date" });
    expect(session).toEqual(before);
  });

  it("rejects a malformed catch table without cleanup or cursor mutation", () => {
    // Break caught: an unsafe direct-authored weight is treated as a successful empty spawn and consumes the day.
    const project = p2LifeProject();
    project.system.seasonalForage!.areas[0]!.entries[0]!.weight = Number.POSITIVE_INFINITY;
    const session = startSession(project, 904);
    const before = structuredClone(session);

    expect(advanceSeasonalForage(project, session, {
      year: 1, season: "spring", day: 2, hour: 6, minute: 0,
    })).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });

  it("does not spawn forage on tiles occupied by chests", () => {
    // Break caught: forage checks only placeables and materializes underneath another runtime occupancy authority.
    const project = p2LifeProject();
    const session = startSession(project, 905);
    session.chests = {};
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
      const id = `chest_${x}_${y}`;
      session.chests[id] = { id, mapId: project.startMapId, x, y, inventory: {} };
    }

    expect(advanceSeasonalForage(project, session, {
      year: 1, season: "spring", day: 2, hour: 6, minute: 0,
    })).toMatchObject({ ok: true, spawned: 0 });
    expect(Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn)).toEqual([]);
  });

  it("does not spawn forage inside a placed farm-building footprint", () => {
    // Break caught: forage and spatial placement authorities use asymmetric occupancy checks and overlap at runtime.
    const project = p2LifeProject();
    project.database.farmBuildingTypes = [{
      id: "forage_blocker",
      name: "Forage blocker",
      levels: [{
        level: 1,
        footprint: { width: 4, height: 4 },
        capacity: 1,
        graphicResourceId: "easyrpg-picture-cloud",
      }],
    }];
    const session = startSession(project, 912);
    expect(placeFarmBuilding(project, session, {
      instanceId: "building_1",
      typeId: "forage_blocker",
      mapId: project.startMapId,
      x: 0,
      y: 0,
      orientation: "down",
    })).toEqual({ ok: true });

    expect(advanceSeasonalForage(project, session, {
      year: 1, season: "spring", day: 2, hour: 6, minute: 0,
    })).toMatchObject({ ok: true, spawned: 0 });
    expect(Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn)).toEqual([]);
  });
});

describe("P2 hostile museum exact-once state", () => {
  it("fails closed when a museum-enabled session has lost its collection authority", () => {
    // Break caught: absent collections makes the same museum item consumable as a donation more than once.
    const project = p2LifeProject();
    const session = startSession(project, 907);
    session.inventory.item_trout = 2;
    session.collections = undefined;
    const before = structuredClone(session);

    expect(donateMuseumItem(project, session, "item_trout")).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });

  it("rejects duplicate reward ids before applying either reward", () => {
    // Break caught: direct project mutation grants duplicate-id rewards twice and writes a poisoned receipt list.
    const project = p2LifeProject();
    project.system.museum!.rewards = [
      { id: "duplicate_reward", minDonations: 1, reward: { gold: 5 } },
      { id: "duplicate_reward", minDonations: 1, reward: { gold: 5 } },
    ];
    const session = startSession(project, 908);
    session.inventory.item_trout = 1;
    const before = structuredClone(session);

    expect(donateMuseumItem(project, session, "item_trout")).toEqual({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });
});

describe("P2 hostile direct save application", () => {
  it("drops unknown collection rows so they cannot satisfy museum donation milestones", () => {
    // Break caught: a poisoned donated ghost item counts toward minDonations after direct save apply.
    const project = p2LifeProject();
    project.system.museum!.rewards = [{ id: "two_real_donations", minDonations: 2, reward: { gold: 50 } }];
    const snapshot = createSaveSnapshot(project, startSession(project, 909));
    snapshot.session.inventory = { ...snapshot.session.inventory, item_trout: 1 };
    snapshot.session.collections = {
      ...snapshot.session.collections,
      ghost_item: { discovered: true, shippedCount: 0, caughtCount: 0, donated: true },
    };

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.collections?.ghost_item).toBeUndefined();
    expect(donateMuseumItem(project, restored, "item_trout")).toMatchObject({ ok: true, appliedRewardIds: [] });
    expect(restored.gold).toBe(0);
  });

  it("drops forged forage whose saved item does not match its authored seasonal entry", () => {
    // Break caught: valid-looking provenance lets a save replace a berry with any database item and mint it on collect.
    const project = p2LifeProject();
    const snapshot = createSaveSnapshot(project, startSession(project, 910));
    const key = `${project.startMapId}:1,1`;
    snapshot.session.placeables = {
      [key]: {
        id: "forged_forage",
        mapId: project.startMapId,
        x: 1,
        y: 1,
        kind: "forage",
        itemId: "item_reward",
        forageSpawn: { areaId: "area_farm", entryId: "berry", spawnedDayKey: "1:spring:1" },
      },
    };

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.placeables?.[key]).toBeUndefined();
    expect(collectForageAt(project, restored, project.startMapId, 1, 1)).toEqual({ ok: false, reason: "missing" });
    expect(restored.inventory.item_reward).toBeUndefined();
  });
});

function fishingLocation(project: Project) {
  return { mapId: project.startMapId, x: 1, y: 1 };
}
