import { describe, expect, it } from "vitest";
import {
  advanceFarmAnimalProduction,
  assignFarmAnimalToBuilding,
  collectFarmAnimalProduct,
  feedFarmAnimal,
  petFarmAnimal,
} from "@/project/farmAnimals";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession, type FarmAnimalState, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import {
  animalProject,
  feedItemId,
  productItemId,
  replaceAnimal,
} from "./fixtures/p1FarmAnimals";

describe("P1 farm-animal runtime authority", () => {
  it("assigns and moves an animal only to a compatible home with remaining capacity", () => {
    // Break caught: authored homes exist, but no runtime authority commits a valid assignment or move.
    const project = animalProject();
    const session = startSession(project, 201);

    expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop")).toEqual({
      ok: true,
      instanceId: "animal_2",
      buildingId: "coop",
      previousBuildingId: undefined,
    });
    expect(session.farmAnimals?.animal_2?.buildingId).toBe("coop");

    project.system.farmAnimalBuildings!.push({
      id: "coop_small",
      name: "Small coop",
      mapId: project.startMapId,
      x: 4,
      y: 4,
      capacity: 1,
      allowedSpeciesIds: ["chicken"],
    });
    expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop_small")).toMatchObject({
      ok: true,
      previousBuildingId: "coop",
    });
    expect(session.farmAnimals?.animal_2?.buildingId).toBe("coop_small");
  });

  it("rejects missing, incompatible, and full homes without mutating the session", () => {
    // Break caught: assignment can overfill a home or silently accept a stale home/species reference.
    const cases = [
      { buildingId: "missing", reason: "missing-building" },
      { buildingId: "barn", reason: "species-not-allowed" },
      { buildingId: "coop", reason: "building-full", capacity: 1 },
    ] as const;
    for (const entry of cases) {
      const project = animalProject();
      if (entry.capacity) {
        project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!.map((building, index) =>
          index === 0 ? { ...building, capacity: entry.capacity } : building);
      }
      const session = startSession(project, 202);
      const before = structuredClone(session);

      expect(assignFarmAnimalToBuilding(project, session, "animal_2", entry.buildingId)).toEqual({
        ok: false,
        reason: entry.reason,
        instanceId: "animal_2",
        buildingId: entry.buildingId,
      });
      expect(session).toEqual(before);
    }
  });

  it("feeds from the species item exactly once per day and debits before the receipt", () => {
    // Break caught: feed can mint a daily receipt without a valid one-item debit or repeat on one day.
    const project = animalProject();
    const session = startSession(project, 203);
    session.inventory[feedItemId(project)] = 2;

    expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toEqual({
      ok: true,
      instanceId: "animal_1",
      itemId: feedItemId(project),
      dayKey: "1:spring:1",
    });
    expect(session.inventory[feedItemId(project)]).toBe(1);
    expect(session.farmAnimals?.animal_1?.lastFedDayKey).toBe("1:spring:1");

    const afterFirst = structuredClone(session);
    expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
      ok: false,
      reason: "already-fed",
    });
    expect(session).toEqual(afterFirst);
  });

  it("rejects empty and unsafe feed stacks without changing inventory or animal care", () => {
    // Break caught: a malformed source stack can still stamp lastFedDayKey.
    for (const value of [0, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 1e300]) {
      const project = animalProject();
      const session = startSession(project, 204);
      session.inventory[feedItemId(project)] = value;
      const before = structuredClone(session);

      expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(false);
      expect(session).toEqual(before);
    }
  });

  it("rejects feed and pet after that day was already advanced", () => {
    // Break caught: late care consumes feed or friendship after the production cursor closed the day.
    const project = animalProject();
    const session = startSession(project, 213);
    session.inventory[feedItemId(project)] = 1;
    replaceAnimal(session, "animal_1", { lastAdvancedDayKey: "1:spring:1" });
    const before = structuredClone(session);

    expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
      ok: false,
      reason: "already-advanced",
    });
    expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
      ok: false,
      reason: "already-advanced",
    });
    expect(session).toEqual(before);
  });

  it("pets exactly once per day and caps friendship", () => {
    // Break caught: repeated petting exceeds the daily receipt or friendship maximum.
    const project = animalProject();
    const session = startSession(project, 205);
    replaceAnimal(session, "animal_1", { friendship: 995 });

    expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toEqual({
      ok: true,
      instanceId: "animal_1",
      dayKey: "1:spring:1",
      friendship: 1_000,
      gained: 5,
    });
    const afterFirst = structuredClone(session);
    expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
      ok: false,
      reason: "already-petted",
    });
    expect(session).toEqual(afterFirst);
  });

  it("advances cared animals on species cadence and never advances one day twice", () => {
    // Break caught: daily advancement ignores care/cadence or duplicates ready products on retry.
    const project = animalProject();
    const session = startSession(project, 206);
    replaceAnimal(session, "animal_1", {
      lastFedDayKey: "1:spring:1",
      lastPettedDayKey: "1:spring:1",
    });

    expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toEqual({
      ok: true,
      dayKey: "1:spring:1",
      advancedInstanceIds: ["animal_1", "animal_2"],
      products: [],
    });
    expect(session.farmAnimals?.animal_1).toMatchObject({
      productionProgress: 1,
      readyProductCount: 0,
      lastAdvancedDayKey: "1:spring:1",
    });
    const afterFirst = structuredClone(session);
    expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
      ok: false,
      reason: "already-advanced",
    });
    expect(session).toEqual(afterFirst);

    replaceAnimal(session, "animal_1", {
      lastFedDayKey: "1:spring:2",
      lastPettedDayKey: "1:spring:2",
    });
    expect(advanceFarmAnimalProduction(project, session, "1:spring:2")).toEqual({
      ok: true,
      dayKey: "1:spring:2",
      advancedInstanceIds: ["animal_1", "animal_2"],
      products: [{ instanceId: "animal_1", itemId: productItemId(project), count: 2 }],
    });
    expect(session.farmAnimals?.animal_1).toMatchObject({
      productionProgress: 0,
      readyProductCount: 2,
      lastAdvancedDayKey: "1:spring:2",
    });
  });

  it("requires both feed and pet receipts for production progress", () => {
    // Break caught: partial daily care produces an item despite the missing care receipt.
    const cases: Array<Partial<FarmAnimalState>> = [
      { lastFedDayKey: "1:spring:1" },
      { lastPettedDayKey: "1:spring:1" },
      {},
    ];
    for (const care of cases) {
      const project = animalProject();
      const session = startSession(project, 207);
      replaceAnimal(session, "animal_1", care);

      expect(advanceFarmAnimalProduction(project, session, "1:spring:1").ok).toBe(true);
      expect(session.farmAnimals?.animal_1).toMatchObject({
        productionProgress: 0,
        readyProductCount: 0,
        lastAdvancedDayKey: "1:spring:1",
      });
    }
  });

  it("preflights production overflow for the entire daily batch", () => {
    // Break caught: one overflowing animal leaves other animals partially advanced.
    const project = animalProject();
    const session = startSession(project, 208);
    replaceAnimal(session, "animal_1", {
      productionProgress: 1,
      readyProductCount: ITEM_QUANTITY_MAX - 1,
      lastFedDayKey: "1:spring:1",
      lastPettedDayKey: "1:spring:1",
    });
    const before = structuredClone(session);

    expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
      ok: false,
      reason: "product-overflow",
      instanceId: "animal_1",
    });
    expect(session).toEqual(before);
  });

  it("rejects future care receipts when advancing an older day", () => {
    // Break caught: a poisoned future receipt is silently consumed as an uncared earlier day.
    const project = animalProject();
    const session = startSession(project, 214);
    replaceAnimal(session, "animal_1", {
      lastFedDayKey: "1:spring:2",
      lastPettedDayKey: "1:spring:2",
    });
    const before = structuredClone(session);

    expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
      ok: false,
      reason: "invalid-day-key",
      instanceId: "animal_1",
    });
    expect(session).toEqual(before);
  });

  it("collects all ready products with inventory and ready count committed together", () => {
    // Break caught: collection clears ready products before detecting a full inventory.
    const project = animalProject();
    const session = startSession(project, 209);
    session.inventory[productItemId(project)] = 4;
    replaceAnimal(session, "animal_1", { readyProductCount: 3 });

    expect(collectFarmAnimalProduct(project, session, "animal_1")).toEqual({
      ok: true,
      instanceId: "animal_1",
      itemId: productItemId(project),
      count: 3,
    });
    expect(session.inventory[productItemId(project)]).toBe(7);
    expect(session.farmAnimals?.animal_1?.readyProductCount).toBe(0);
  });

  it("rejects collection overflow without consuming ready products", () => {
    // Break caught: inventory overflow loses an animal's accumulated products.
    const project = animalProject();
    const session = startSession(project, 210);
    session.inventory[productItemId(project)] = ITEM_QUANTITY_MAX - 2;
    replaceAnimal(session, "animal_1", { readyProductCount: 3 });
    const before = structuredClone(session);

    expect(collectFarmAnimalProduct(project, session, "animal_1")).toMatchObject({
      ok: false,
      reason: "inventory-overflow",
    });
    expect(session).toEqual(before);
  });

  it("fails closed on unknown references, duplicate instances, and unsafe state", () => {
    // Break caught: poisoned live animal rows bypass later capacity/care/product validation.
    const cases: Array<(project: Project, session: PlaySession) => unknown> = [
      (_project, session) => {
        replaceAnimal(session, "animal_1", { speciesId: "missing_species" });
        return session;
      },
      (_project, session) => {
        replaceAnimal(session, "animal_1", { buildingId: "missing_home" });
        return session;
      },
      (_project, session) => {
        session.farmAnimals!.alias = { ...session.farmAnimals!.animal_1! };
        return session;
      },
      (_project, session) => {
        replaceAnimal(session, "animal_1", { productionProgress: 1e300 });
        return session;
      },
    ];
    for (const poison of cases) {
      const project = animalProject();
      const session = startSession(project, 211);
      poison(project, session);
      const before = structuredClone(session);

      expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(false);
      expect(session).toEqual(before);
    }
  });

  it("returns invalid-state instead of throwing for malformed animal containers and rows", () => {
    // Break caught: non-record live session payloads crash the daily authority or pass as an empty herd.
    const cases: unknown[] = [[], { animal_1: null }, { animal_1: 7 }];
    for (const value of cases) {
      const project = animalProject();
      const session = startSession(project, 216);
      session.farmAnimals = value as PlaySession["farmAnimals"];
      const before = structuredClone(session);
      let result: ReturnType<typeof advanceFarmAnimalProduction> | undefined;

      expect(() => { result = advanceFarmAnimalProduction(project, session, "1:spring:1"); }).not.toThrow();
      expect(result).toMatchObject({
        ok: false,
        reason: "invalid-state",
      });
      expect(session).toEqual(before);
    }
  });

  it("fails closed when authored feed or product item references are stale", () => {
    // Break caught: missing item definitions allow feed receipts or product loss to commit.
    const project = animalProject();
    const session = startSession(project, 215);
    session.inventory[feedItemId(project)] = 1;
    replaceAnimal(session, "animal_1", { readyProductCount: 1 });
    const before = structuredClone(session);
    project.database.farmAnimalSpecies = project.database.farmAnimalSpecies!.map((species) =>
      species.id === "chicken"
        ? { ...species, feedItemId: "missing_feed", productItemId: "missing_product" }
        : species);

    expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
      ok: false,
      reason: "invalid-definition",
    });
    expect(collectFarmAnimalProduct(project, session, "animal_1")).toMatchObject({
      ok: false,
      reason: "invalid-definition",
    });
    expect(session).toEqual(before);
  });

  it("treats authored empty animal arrays as a compatible no-op package", () => {
    // Break caught: legacy/empty optional arrays crash daily advancement or invent session animals.
    const project = createBlankProject();
    project.database.farmAnimalSpecies = [];
    project.system.farmAnimalBuildings = [];
    project.session.farmAnimals = [];
    const session = startSession(project, 212);

    expect(session.farmAnimals).toEqual({});
    expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toEqual({
      ok: true,
      dayKey: "1:spring:1",
      advancedInstanceIds: [],
      products: [],
    });
  });
});
