import { describe, expect, it } from "vitest";
import { advanceFarmAnimalProduction, assignFarmAnimalToBuilding, collectFarmAnimalProduct, feedFarmAnimal, petFarmAnimal } from "@/project/farmAnimals";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession, type FarmAnimalState, type PlaySession, GOLD_MAX, nextSessionRandom } from "@/project/session";
import type { Project, DailyWeatherConfig } from "@/project/types";
import { animalProject, feedItemId, productItemId, replaceAnimal } from "./fixtures/p1FarmAnimals";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { applyDailyWeatherForDate, dailyWeatherForecast, resolveDailyWeatherForDate } from "@/project/dailyWeather";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { donateMuseumItem } from "@/project/museum";
import { settleShipping } from "@/project/shipping";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { isolateTimers } from "./mergedTeardown";

describe("p1FarmAnimals", () => {
  isolateTimers();
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
});

describe("p1HostileAudit", () => {
  isolateTimers();
  describe("P1 independent hostile audit", () => {
    it("rejects care receipts for a day other than the live calendar day without mutation", () => {
      // Break caught: a caller can consume feed or gain friendship for a future day and poison the next transition.
      const project = animalProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
      const session = startSession(project, 901);
      session.inventory[feedItemId(project)] = 2;
      const before = structuredClone(session);

      expect(feedFarmAnimal(project, session, "animal_1", "1:spring:2")).toMatchObject({
        ok: false,
        reason: "invalid-day-key",
      });
      expect(petFarmAnimal(project, session, "animal_1", "1:spring:2")).toMatchObject({
        ok: false,
        reason: "invalid-day-key",
      });
      expect(session).toEqual(before);
    });

    it("rejects production advancement for a day other than the live calendar day", () => {
      // Break caught: direct authority calls can mint products while gameTime remains on an earlier day.
      const project = animalProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
      const session = startSession(project, 902);
      replaceAnimal(session, "animal_1", {
        productionProgress: 1,
        lastFedDayKey: "1:spring:2",
        lastPettedDayKey: "1:spring:2",
      });
      const before = structuredClone(session);

      expect(advanceFarmAnimalProduction(project, session, "1:spring:2")).toMatchObject({
        ok: false,
        reason: "invalid-day-key",
      });
      expect(session).toEqual(before);
    });

    it("repairs over-capacity saved assignments deterministically on direct apply", () => {
      // Break caught: a hostile save restores an overfilled home and makes every animal API fail invalid-state.
      const project = animalProject();
      project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!.map((building) =>
        building.id === "coop" ? { ...building, capacity: 1 } : building);
      const session = startSession(project, 903);
      session.farmAnimals!.animal_2 = {
        ...session.farmAnimals!.animal_2!,
        buildingId: "coop",
      };
      const snapshot = createSaveSnapshot(project, session);

      const restored = applySaveSnapshot(project, snapshot);

      expect(restored.farmAnimals?.animal_1?.buildingId).toBe("coop");
      expect(restored.farmAnimals?.animal_2?.buildingId).toBeUndefined();
    });
  });
});

describe("p1SessionPersistence", () => {
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
  describe("P1 farm-animal session persistence", () => {
    it("round-trips runtime assignment, care receipts, cadence, and ready products", () => {
      // Break caught: runtime animal actions work live but their resulting state is lost by save parse/apply.
      const project = animalProject();
      const session = startSession(project, 301);
      session.inventory[feedItemId(project)] = 2;
      expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop").ok).toBe(true);
      expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(true);
      expect(petFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(true);
      expect(advanceFarmAnimalProduction(project, session, "1:spring:1").ok).toBe(true);
      expect(feedFarmAnimal(project, session, "animal_1", "1:spring:2").ok).toBe(true);
      expect(petFarmAnimal(project, session, "animal_1", "1:spring:2").ok).toBe(true);
      expect(advanceFarmAnimalProduction(project, session, "1:spring:2").ok).toBe(true);

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected present save");
      const restored = applySaveSnapshot(project, read.snapshot);

      expect(restored.farmAnimals).toEqual(session.farmAnimals);
      expect(restored.farmAnimals?.animal_1).toMatchObject({
        friendship: 20,
        productionProgress: 0,
        readyProductCount: 2,
        lastFedDayKey: "1:spring:2",
        lastPettedDayKey: "1:spring:2",
        lastAdvancedDayKey: "1:spring:2",
      });
      expect(restored.farmAnimals?.animal_2?.buildingId).toBe("coop");
    });

    it("keeps empty authored arrays and omitted legacy animal state compatible", () => {
      // Break caught: an empty/omitted legacy package becomes corrupt after runtime APIs are introduced.
      const project = createBlankProject();
      project.database.farmAnimalSpecies = [];
      project.system.farmAnimalBuildings = [];
      project.session.farmAnimals = [];
      const empty = startSession(project, 302);
      const snapshot = createSaveSnapshot(project, empty);
      delete (snapshot.session as { farmAnimals?: unknown }).farmAnimals;

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.farmAnimals).toEqual({});
      expect(advanceFarmAnimalProduction(project, restored, "1:spring:1")).toMatchObject({
        ok: true,
        advancedInstanceIds: [],
        products: [],
      });
    });

    it("falls back to the authored home when a saved moved-home reference is deleted", () => {
      // Break caught: a stale moved building id survives load or erases the safe authored assignment.
      const project = animalProject();
      project.system.farmAnimalBuildings!.push({
        id: "temporary_coop",
        name: "Temporary coop",
        mapId: project.startMapId,
        x: 5,
        y: 5,
        capacity: 1,
        allowedSpeciesIds: ["chicken"],
      });
      const session = startSession(project, 303);
      expect(assignFarmAnimalToBuilding(project, session, "animal_1", "temporary_coop").ok).toBe(true);
      const snapshot = createSaveSnapshot(project, session);
      project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!
        .filter((building) => building.id !== "temporary_coop");

      expect(applySaveSnapshot(project, snapshot).farmAnimals?.animal_1?.buildingId).toBe("coop");
    });
  });
});

describe("p1WeatherCalendar", () => {
  isolateTimers();
  function weatherProject(): Project {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: {
        spring: [{ kind: "rain", weight: 1, intensity: 0.4 }],
        summer: [{ kind: "storm", weight: 1, intensity: 0.8 }],
        fall: [{ kind: "fog", weight: 1 }],
        winter: [{ kind: "snow", weight: 1, intensity: 0.6 }],
      },
    };
    return project;
  }
  describe("P1 deterministic daily weather", () => {
    it("derives the same authored outcome from only the session seed and calendar day key", () => {
      // Break caught: weather selection consumes a mutable RNG stream or ignores the calendar date.
      const project = weatherProject();
      project.system.dailyWeather = {
        enabled: true,
        seasons: {
          spring: [
            { kind: "none", weight: 1 },
            { kind: "rain", weight: 1, intensity: 0.7 },
            { kind: "storm", weight: 1, intensity: 0.9 },
          ],
        },
      };
      const date = { year: 2, season: "spring" as const, day: 7, hour: 6, minute: 0 };

      expect(resolveDailyWeatherForDate(project, 1234, date)).toEqual(
        resolveDailyWeatherForDate(project, 1234, date),
      );
      expect(new Set(
        Array.from({ length: 32 }, (_, index) => resolveDailyWeatherForDate(project, index + 1, date).kind),
      ).size).toBeGreaterThan(1);
      expect(new Set(
        Array.from({ length: 28 }, (_, index) => resolveDailyWeatherForDate(
          project,
          1234,
          { ...date, day: index + 1 },
        ).kind),
      ).size).toBeGreaterThan(1);
    });

    it("forecasts future days across season and year boundaries without consuming RNG state", () => {
      // Break caught: forecast calls perturb encounter/battle/movement/misc streams or include today twice.
      const project = weatherProject();
      const session = startSession(project, 20260825);
      const rngBefore = structuredClone(session.rng);

      const springBoundary = dailyWeatherForecast(project, session, {
        year: 1,
        season: "spring",
        day: 27,
        hour: 22,
        minute: 30,
      });
      expect(springBoundary).toEqual([
        { dayKey: "1:spring:28", kind: "rain", intensity: 0.4 },
        { dayKey: "1:summer:1", kind: "storm", intensity: 0.8 },
        { dayKey: "1:summer:2", kind: "storm", intensity: 0.8 },
      ]);

      const winterBoundary = dailyWeatherForecast(project, session, {
        year: 1,
        season: "winter",
        day: 28,
        hour: 6,
        minute: 0,
      });
      expect(winterBoundary[0]).toEqual({ dayKey: "2:spring:1", kind: "rain", intensity: 0.4 });
      expect(session.rng).toEqual(rngBefore);
      expect(dailyWeatherForecast(project, session, {
        year: 1,
        season: "spring",
        day: 27,
        hour: 6,
        minute: 0,
      })).toEqual(springBoundary);
      expect(session.rng).toEqual(rngBefore);
    });

    it("applies one current-day result without changing any RNG stream", () => {
      // Break caught: applying the current day advances a session stream and later forecasts change the result.
      const project = weatherProject();
      const session = startSession(project, 99);
      const rngBefore = structuredClone(session.rng);
      const date = { year: 1, season: "summer" as const, day: 3, hour: 6, minute: 0 };

      const applied = applyDailyWeatherForDate(project, session, date);
      dailyWeatherForecast(project, session, date);
      dailyWeatherForecast(project, session, date);

      expect(applied).toEqual({ dayKey: "1:summer:3", kind: "storm", intensity: 0.8 });
      expect(session.dailyWeather).toEqual(applied);
      expect(session.rng).toEqual(rngBefore);
      expect(applyDailyWeatherForDate(project, session, date)).toEqual(applied);
      expect(session.rng).toEqual(rngBefore);
    });

    it("fails closed to clear weather for empty, all-zero, and malformed direct inputs", () => {
      // Break caught: an invalid/all-zero table divides by zero, selects an invalid row, or loops unbounded.
      const project = weatherProject();
      project.system.dailyWeather = {
        enabled: true,
        forecastDays: Number.POSITIVE_INFINITY,
        seasons: {
          spring: [
            { kind: "rain", weight: 0, intensity: 0.9 },
            { kind: "storm", weight: -5, intensity: Number.NaN },
            { kind: "meteor", weight: 10, intensity: 1 },
            { kind: "snow", weight: Number.POSITIVE_INFINITY, intensity: 1 },
          ],
        },
      } as unknown as DailyWeatherConfig;
      const session = startSession(project, 7);
      const date = { year: 1, season: "spring" as const, day: 1, hour: 6, minute: 0 };

      expect(resolveDailyWeatherForDate(project, session.rng!.seed, date)).toEqual({
        dayKey: "1:spring:1",
        kind: "none",
        intensity: 0,
      });
      expect(dailyWeatherForecast(project, session, date)).toHaveLength(1);

      project.system.dailyWeather = { enabled: false, seasons: {} };
      session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 1 };
      expect(applyDailyWeatherForDate(project, session, date)).toBeUndefined();
      expect(session.dailyWeather).toBeUndefined();
      expect(dailyWeatherForecast(project, session, date)).toEqual([]);
    });
  });
});

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
