import { describe, expect, it } from "vitest";
import { performAutosave } from "@/player/autosave";
import { restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import { applySaveSnapshot, createSaveSnapshot, readAutosave, readSaveSlot, saveToSlot, saveSlotKey } from "@/player/saveSlots";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession, GOLD_MAX, nextSessionRandom } from "@/project/session";
import { createLegacyLifeProject } from "./fixtures/life-full/legacyProject";
import { collectLifeRecoveryClaim, LifeReconciliationError } from "@/project/lifeRecovery";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { donateMuseumItem } from "@/project/museum";
import { settleShipping } from "@/project/shipping";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { isolateTimers } from "./mergedTeardown";
import { asPlacementFacing, asPlacementZone, checkPlacementSurface, describePlacementSurface, evaluatePlacementConditions, surfaceRuleFromClusterRule, tileSetSurfaceProbe, type SurfaceProbe } from "@/project/placementSurface";
import type { PlacementSurfaceCondition } from "@/project/types";

describe("p1FoundationSchema", { timeout: 120000 }, () => {
  isolateTimers();
  // 시험 시간 한도는 수집 때 읽혀 beforeAll 안 vi.setConfig 는 듣지 않는다 — describe 옵션 timeout 으로 둔다.
  // createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
  // CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }
  type MutableUnknown = Record<string, unknown>;
  function configureP1Project(project: ReturnType<typeof createBlankProject>): void {
    const itemId = project.database.items[0]!.id;
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: {
        spring: [
          { kind: "none", weight: 7 },
          { kind: "rain", weight: 3, intensity: 0.6 },
        ],
        winter: [{ kind: "snow", weight: 1, intensity: 0.9 }],
      },
    };
    project.database.farmAnimalSpecies = [{
      id: "animal_chicken",
      name: "Chicken",
      graphic: {
        sprite: { type: "bundled", id: "farm-animal-chicken" },
        direction: "down",
        pattern: 1,
      },
      feedItemId: itemId,
      productItemId: itemId,
      productCount: 1,
      productEveryDays: 2,
      petFriendship: 15,
    }];
    project.system.farmAnimalBuildings = [{
      id: "animal_home_coop",
      name: "Coop",
      mapId: project.startMapId,
      x: 4,
      y: 5,
      capacity: 4,
      allowedSpeciesIds: ["animal_chicken"],
    }];
    project.maps[project.startMapId]!.events.push({
      id: "event_chicken_1",
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
    });
    project.session.farmAnimals = [{
      instanceId: "farm_animal_1",
      speciesId: "animal_chicken",
      name: "Coco",
      eventId: "event_chicken_1",
      buildingId: "animal_home_coop",
    }];
  }
  describe("P1 weather and farm-animal authored schema", () => {
    it("round-trips authored weather, species, homes, and project-start animals", () => {
      // Break caught: normalizeSystemRecords drops P1 authored weather and animal-home packages.
      const project = createBlankProject();
      configureP1Project(project);

      const loaded = deserialize(serialize(project)) as unknown as {
        system: MutableUnknown;
        database: MutableUnknown;
        session: MutableUnknown;
      };

      expect(loaded.system.dailyWeather).toEqual({
        enabled: true,
        forecastDays: 3,
        seasons: {
          spring: [
            { kind: "none", weight: 7 },
            { kind: "rain", weight: 3, intensity: 0.6 },
          ],
          winter: [{ kind: "snow", weight: 1, intensity: 0.9 }],
        },
      });
      expect(loaded.database.farmAnimalSpecies).toHaveLength(1);
      expect(loaded.system.farmAnimalBuildings).toHaveLength(1);
      expect(loaded.session.farmAnimals).toHaveLength(1);

      const session = startSession(loaded as never, 101) as unknown as MutableUnknown;
      expect(session.dailyWeather).toBeUndefined();
      expect(session.farmAnimals).toEqual({
        farm_animal_1: {
          instanceId: "farm_animal_1",
          speciesId: "animal_chicken",
          name: "Coco",
          eventId: "event_chicken_1",
          buildingId: "animal_home_coop",
          friendship: 0,
          productionProgress: 0,
          readyProductCount: 0,
        },
      });
    });

    it("keeps legacy projects byte-stable without optional P1 authored fields", () => {
      // Break caught: a schema normalizer invents empty weather/animal fields in legacy JSON.
      const project = createLegacyLifeProject();
      // 비교 기준은 한 번 읽은(정규화한) 모양이다 — 새 프로젝트의 기본값(system.battleUiStyle="retro2003")은 로드가 생략하므로
      // 첫 저장 글과 재저장 글은 표현만 다르다(내용 같음, #3774 이전부터). 이 시험이 잡는 것은 «로드가 필드를 지어내지 않는다»이다.
      const before = serialize(deserialize(serialize(project)));
      const loaded = deserialize(before) as unknown as {
        system: MutableUnknown;
        database: MutableUnknown;
        session: MutableUnknown;
      };

      expect(loaded.system.dailyWeather).toBeUndefined();
      expect(loaded.system.farmAnimalBuildings).toBeUndefined();
      expect(loaded.database.farmAnimalSpecies).toBeUndefined();
      expect(loaded.session.farmAnimals).toBeUndefined();
      expect(serialize(loaded as never)).toBe(before);
      expect(serialize(deserialize(serialize(loaded as never)))).toBe(before);
    });

    it("rejects unknown weather kinds, unsafe numbers, duplicate ids, and oversized arrays", () => {
      // Break caught: hostile authored arrays and numeric payloads enter runtime before normalization.
      const cases: Array<{ mutate: (wire: MutableUnknown) => void; pattern: RegExp }> = [
        {
          mutate: (wire) => {
            (wire.system as MutableUnknown).dailyWeather = {
              enabled: true,
              forecastDays: 8,
              seasons: {},
            };
          },
          pattern: /dailyWeather.*forecastDays/i,
        },
        {
          mutate: (wire) => {
            (wire.system as MutableUnknown).dailyWeather = {
              enabled: true,
              forecastDays: 7,
              seasons: { spring: [{ kind: "meteor", weight: 1 }] },
            };
          },
          pattern: /dailyWeather.*kind/i,
        },
        {
          mutate: (wire) => {
            (wire.database as MutableUnknown).farmAnimalSpecies = [
              speciesWire("duplicate"),
              speciesWire("duplicate"),
            ];
          },
          pattern: /farmAnimalSpecies.*duplicat/i,
        },
        {
          mutate: (wire) => {
            (wire.system as MutableUnknown).farmAnimalBuildings = [
              buildingWire("duplicate", wire),
              buildingWire("duplicate", wire),
            ];
          },
          pattern: /farmAnimalBuildings.*duplicat/i,
        },
        {
          mutate: (wire) => {
            (wire.session as MutableUnknown).farmAnimals = [
              startAnimalWire("duplicate"),
              startAnimalWire("duplicate"),
            ];
          },
          pattern: /session\.farmAnimals.*duplicat/i,
        },
        {
          mutate: (wire) => {
            (wire.database as MutableUnknown).farmAnimalSpecies = Array.from(
              { length: 501 },
              (_, index) => speciesWire(`animal_${index}`),
            );
          },
          pattern: /farmAnimalSpecies.*500/i,
        },
        {
          mutate: (wire) => {
            (wire.system as MutableUnknown).farmAnimalBuildings = [{
              ...buildingWire("unsafe", wire),
              x: Number.MAX_SAFE_INTEGER + 1,
            }];
          },
          pattern: /farmAnimalBuildings.*\.x/i,
        },
      ];

      for (const { mutate, pattern } of cases) {
        const wire = JSON.parse(serialize(createBlankProject())) as MutableUnknown;
        mutate(wire);
        expect(() => deserialize(JSON.stringify(wire))).toThrow(pattern);
      }
    });

    it("bounds direct in-memory normalization and drops unknown weather rules", () => {
      // Break caught: only the JSON shape gate is safe while direct editor/store writes remain hostile.
      const project = createBlankProject();
      const normalizedSystem = normalizeSystemRecords({
        ...project.system,
        dailyWeather: {
          enabled: true,
          forecastDays: 99,
          seasons: {
            spring: [
              { kind: "rain", weight: Number.MAX_SAFE_INTEGER, intensity: 5 },
              { kind: "meteor", weight: 1, intensity: 1 },
            ],
          },
        },
        farmAnimalBuildings: Array.from({ length: 510 }, (_, index) => ({
          id: `home_${index}`,
          name: `Home ${index}`,
          mapId: project.startMapId,
          x: index,
          y: index,
          capacity: 99_999,
          allowedSpeciesIds: [" animal_chicken ", "animal_chicken"],
        })),
      } as never) as unknown as MutableUnknown;
      const weather = normalizedSystem.dailyWeather as MutableUnknown;
      const seasons = weather.seasons as MutableUnknown;
      expect(weather.forecastDays).toBe(7);
      expect(seasons.spring).toEqual([{ kind: "rain", weight: 1_000_000, intensity: 1 }]);
      expect(normalizedSystem.farmAnimalBuildings).toHaveLength(500);
      expect((normalizedSystem.farmAnimalBuildings as Array<MutableUnknown>)[0]).toMatchObject({
        capacity: 500,
        allowedSpeciesIds: ["animal_chicken"],
      });

      const normalizedDatabase = normalizeDatabaseRecords({
        ...project.database,
        farmAnimalSpecies: [
          { ...speciesWire("animal_chicken"), productCount: Number.MAX_SAFE_INTEGER },
          { ...speciesWire("animal_chicken"), productCount: 2 },
          { ...speciesWire("animal_bad"), productEveryDays: Number.POSITIVE_INFINITY },
        ],
      } as never) as unknown as MutableUnknown;
      expect(normalizedDatabase.farmAnimalSpecies).toEqual([
        expect.objectContaining({ id: "animal_chicken", productCount: 9_999_999 }),
        expect.objectContaining({ id: "animal_bad", productEveryDays: 1 }),
      ]);
    });
  });
  describe("P1 daily weather and farm-animal session persistence", () => {
    it("preserves one current weather state and animal progress through manual save parse/apply", () => {
      // Break caught: SaveSnapshot omits P1 daily state even though manual save succeeds.
      const project = createBlankProject();
      configureP1Project(project);
      const session = startSession(project, 102) as unknown as MutableUnknown;
      session.dailyWeather = { dayKey: "1:spring:4", kind: "rain", intensity: 0.6 };
      const animals = session.farmAnimals as Record<string, MutableUnknown>;
      Object.assign(animals.farm_animal_1!, {
        friendship: 120,
        productionProgress: 1,
        readyProductCount: 2,
        lastFedDayKey: "1:spring:4",
        lastPettedDayKey: "1:spring:4",
        lastAdvancedDayKey: "1:spring:3",
      });

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session as never));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected present save");
      const restored = applySaveSnapshot(project, read.snapshot) as unknown as MutableUnknown;

      expect(restored.dailyWeather).toEqual(session.dailyWeather);
      expect(restored.farmAnimals).toEqual(session.farmAnimals);
      expect((read.snapshot.session as unknown as MutableUnknown).forecast).toBeUndefined();
    });

    it("sanitizes hostile runtime weather and animal state without corrupting the whole save", () => {
      // Break caught: unsafe progress/count payloads survive a save read or erase every valid animal.
      const project = createBlankProject();
      configureP1Project(project);
      const snapshot = createSaveSnapshot(project, startSession(project, 103));
      const wire = snapshot.session as unknown as MutableUnknown;
      wire.dailyWeather = { dayKey: "1:monsoon:4", kind: "meteor", intensity: 1e300 };
      wire.farmAnimals = {
        farm_animal_1: {
          ...startAnimalWire("farm_animal_1"),
          speciesId: "animal_chicken",
          name: "Coco",
          buildingId: "animal_home_coop",
          friendship: 70,
          productionProgress: 1,
          readyProductCount: 2,
          lastFedDayKey: "1:spring:4",
        },
        poisoned: {
          ...startAnimalWire("poisoned"),
          speciesId: "animal_chicken",
          friendship: 1e300,
          productionProgress: Number.MAX_SAFE_INTEGER + 1,
          readyProductCount: 1e300,
        },
      };

      const storage = new MemoryStorage();
      saveToSlot(storage, 2, snapshot);
      const read = readSaveSlot(storage, 2);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected present save");
      const restored = applySaveSnapshot(project, read.snapshot) as unknown as MutableUnknown;
      expect(restored.dailyWeather).toBeUndefined();
      expect(restored.farmAnimals).toEqual({
        farm_animal_1: expect.objectContaining({
          friendship: 70,
          productionProgress: 1,
          readyProductCount: 2,
          lastFedDayKey: "1:spring:4",
        }),
      });
    });

    it("rejects unrepresentable writer state and quarantines JSON-safe hostile direct input", () => {
      const project = createBlankProject();
      configureP1Project(project);
      const weatherOnly = startSession(project, 108) as unknown as MutableUnknown;
      weatherOnly.dailyWeather = { dayKey: "1:spring:4", kind: "rain", intensity: Number.NaN };
      const weatherWritten = createSaveSnapshot(project, weatherOnly as never);
      expect((weatherWritten.session as unknown as MutableUnknown).dailyWeather).toBeUndefined();

      const session = startSession(project, 106) as unknown as MutableUnknown;
      session.dailyWeather = { dayKey: "1:spring:4", kind: "rain", intensity: Number.NaN };
      const animal = (session.farmAnimals as Record<string, MutableUnknown>).farm_animal_1!;
      Object.assign(animal, {
        friendship: Number.POSITIVE_INFINITY,
        productionProgress: Number.MAX_SAFE_INTEGER + 1,
        readyProductCount: 1e300,
      });
      const before = structuredClone(session);
      const storage = new MemoryStorage();
      const valid = createSaveSnapshot(project, startSession(project, 105));
      expect(saveToSlot(storage, 2, valid).ok).toBe(true);
      const priorSlotBytes = storage.getItem(saveSlotKey(2));
      expect(priorSlotBytes).not.toBeNull();

      let thrown: unknown;
      try { saveToSlot(storage, 2, createSaveSnapshot(project, session as never)); }
      catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(LifeReconciliationError);
      expect(thrown).toMatchObject({ name: "LifeReconciliationError", sourceKind: "farmAnimals", sourceId: "farm_animal_1", reason: "invalid-state" });
      expect(session).toEqual(before);
      expect(storage.getItem(saveSlotKey(2))).toBe(priorSlotBytes);

      const direct = createSaveSnapshot(project, startSession(project, 107));
      const directSession = direct.session as unknown as MutableUnknown;
      directSession.dailyWeather = { dayKey: "1:spring:4", kind: "meteor", intensity: 1 };
      directSession.farmAnimals = {
        farm_animal_1: {
          ...startAnimalWire("farm_animal_1"),
          speciesId: "animal_chicken",
          friendship: 1e300,
          productionProgress: 0,
          readyProductCount: Number.MAX_SAFE_INTEGER + 1,
        },
      };
      const directBefore = structuredClone(direct);
      const restored = applySaveSnapshot(project, direct) as unknown as MutableUnknown;
      expect(direct).toEqual(directBefore);
      expect(restored.dailyWeather).toBeUndefined();
      expect(restored.farmAnimals).toEqual({});
      const claims = (restored.lifeRecovery as MutableUnknown).claims as Record<string, MutableUnknown>;
      expect(Object.values(claims)).toHaveLength(1);
      expect(Object.values(claims)[0]).toMatchObject({
        sourceKind: "farmAnimals",
        sourceId: "farm_animal_1",
        items: [],
        unresolved: { record: (directBefore.session as unknown as MutableUnknown).farmAnimals && ((directBefore.session as unknown as MutableUnknown).farmAnimals as MutableUnknown).farm_animal_1 },
      });
      expect(restored.inventory).toEqual((directBefore.session as unknown as MutableUnknown).inventory);
      expect(restored.gold).toBe((directBefore.session as unknown as MutableUnknown).gold);
      const beforeCollection = structuredClone(restored);
      const claimId = Object.keys(claims)[0];
      if (!claimId) throw new Error("expected unresolved recovery claim");
      expect(collectLifeRecoveryClaim(project, restored as never, claimId)).toEqual({ ok: false, reason: "unresolved" });
      expect(restored).toEqual(beforeCollection);

      const initialRecovery = structuredClone(restored.lifeRecovery);
      const initialInventory = structuredClone(restored.inventory);
      const initialGold = restored.gold;
      const roundTrip = (state: MutableUnknown) => {
        const snapshot = createSaveSnapshot(project, state as never);
        expect(saveToSlot(storage, 2, snapshot).ok).toBe(true);
        const read = readSaveSlot(storage, 2);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected present save");
        return applySaveSnapshot(project, read.snapshot) as unknown as MutableUnknown;
      };
      const repeated = roundTrip(restored);
      const repeatedAgain = roundTrip(repeated);
      expect(repeated.lifeRecovery).toEqual(initialRecovery);
      expect(repeatedAgain.lifeRecovery).toEqual(initialRecovery);
      expect(repeated.inventory).toEqual(initialInventory);
      expect(repeatedAgain.inventory).toEqual(initialInventory);
      expect(repeated.gold).toBe(initialGold);
      expect(repeatedAgain.gold).toBe(initialGold);
      expect(repeated.farmAnimals).toEqual({});
      expect(repeatedAgain.farmAnimals).toEqual({});

      const repeatedRead = readSaveSlot(storage, 2);
      expect(repeatedRead.kind).toBe("present");
      if (repeatedRead.kind !== "present") throw new Error("expected present save");
      const repeatedDirect = applySaveSnapshot(project, repeatedRead.snapshot) as unknown as MutableUnknown;
      expect(repeatedDirect.lifeRecovery).toEqual(repeated.lifeRecovery);
      expect(repeatedDirect.farmAnimals).toEqual({});

    });

    it("uses the common snapshot for autosave and checkpoint restoration", () => {
      // Break caught: a second writer preserves manual saves but drops P1 state in autosave/checkpoints.
      const project = createBlankProject();
      configureP1Project(project);
      const session = startSession(project, 104) as unknown as MutableUnknown;
      session.dailyWeather = { dayKey: "1:winter:9", kind: "snow", intensity: 0.8 };
      Object.assign((session.farmAnimals as Record<string, MutableUnknown>).farm_animal_1!, {
        friendship: 250,
        productionProgress: 0,
        readyProductCount: 3,
        lastAdvancedDayKey: "1:winter:9",
      });

      const storage = new MemoryStorage();
      expect(performAutosave(project, session as never, storage, "transfer")).not.toBeNull();
      const autosave = readAutosave(storage);
      expect(autosave.kind).toBe("present");
      if (autosave.kind !== "present") throw new Error("expected present autosave");
      expect(applySaveSnapshot(project, autosave.snapshot)).toMatchObject({
        dailyWeather: session.dailyWeather,
        farmAnimals: session.farmAnimals,
      });

      saveSessionCheckpoint(project, session as never);
      session.dailyWeather = undefined;
      session.farmAnimals = {};
      expect(restoreSessionCheckpoint(project, session as never)).toMatchObject({
        dailyWeather: { dayKey: "1:winter:9", kind: "snow", intensity: 0.8 },
        farmAnimals: {
          farm_animal_1: expect.objectContaining({ friendship: 250, readyProductCount: 3 }),
        },
      });
    });

    it("loads a legacy save without optional P1 runtime fields", () => {
      // Break caught: adding P1 save fields turns legacy schema-version-3 snapshots corrupt.
      const project = createBlankProject();
      configureP1Project(project);
      const snapshot = createSaveSnapshot(project, startSession(project, 105));
      const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
      delete (legacy.session as unknown as MutableUnknown).dailyWeather;
      delete (legacy.session as unknown as MutableUnknown).farmAnimals;
      const storage = new MemoryStorage();
      saveToSlot(storage, 3, legacy);

      const read = readSaveSlot(storage, 3);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("expected legacy save");
      const restored = applySaveSnapshot(project, read.snapshot) as unknown as MutableUnknown;
      expect(restored.dailyWeather).toBeUndefined();
      expect(restored.farmAnimals).toEqual({
        farm_animal_1: expect.objectContaining({ friendship: 0, readyProductCount: 0 }),
      });
    });
  });
  function speciesWire(id: string): MutableUnknown {
    return {
      id,
      name: id,
      feedItemId: "item_feed",
      productItemId: "item_product",
      productCount: 1,
      productEveryDays: 2,
      petFriendship: 15,
    };
  }
  function buildingWire(id: string, wire: MutableUnknown): MutableUnknown {
    return {
      id,
      name: id,
      mapId: wire.startMapId,
      x: 1,
      y: 2,
      capacity: 4,
      allowedSpeciesIds: ["animal_chicken"],
    };
  }
  function startAnimalWire(instanceId: string): MutableUnknown {
    return {
      instanceId,
      speciesId: "animal_chicken",
      name: instanceId,
    };
  }
});

describe("p2LifeRuntime", () => {
  isolateTimers();
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
});

describe("p2SpatialSchema", () => {
  isolateTimers();
  type MutableRecord = Record<string, any>;
  function configureSpatialProject(project: ReturnType<typeof createBlankProject>): void {
    const itemId = project.database.items[0]!.id;
    (project.database as MutableRecord).farmBuildingTypes = [{
      id: "farm_building_shed",
      name: "Shed",
      levels: [
        {
          level: 1,
          footprint: { width: 2, height: 3 },
          capacity: 8,
          cost: { gold: 100, items: [{ itemId, count: 2 }] },
          graphicResourceId: "easyrpg-picture-cloud",
        },
        {
          level: 2,
          footprint: { width: 3, height: 3 },
          capacity: 16,
          cost: { gold: 250, items: [{ itemId, count: 4 }] },
          graphicResourceId: "easyrpg-picture-cloud",
        },
      ],
    }];
    (project.database as MutableRecord).homeDecorationTypes = [{
      id: "home_decor_table",
      name: "Table",
      placementItemId: itemId,
      footprint: { width: 2, height: 1 },
      blocksMovement: true,
      allowedOrientations: ["down", "left", "right", "up"],
      graphicResourceId: "easyrpg-picture-cloud",
    }];
    (project.session as MutableRecord).farmBuildingPlacements = [{
      instanceId: "farm_building_1",
      typeId: "farm_building_shed",
      level: 1,
      mapId: project.startMapId,
      x: 2,
      y: 2,
      orientation: "down",
    }];
    (project.session as MutableRecord).homeDecorationPlacements = [{
      instanceId: "home_decor_1",
      typeId: "home_decor_table",
      mapId: project.startMapId,
      x: 7,
      y: 2,
      orientation: "left",
    }];
  }
  describe("P2 spatial authored schema", () => {
    it("round-trips independent building/decor definitions and instantiates keyed runtime placements", () => {
      // Break caught: authored P2 placements serialize but startSession has no independent runtime authority.
      const project = createBlankProject();
      configureSpatialProject(project);

      const loaded = deserialize(serialize(project)) as unknown as MutableRecord;
      expect(loaded.database.farmBuildingTypes).toEqual((project.database as MutableRecord).farmBuildingTypes);
      expect(loaded.database.homeDecorationTypes).toEqual((project.database as MutableRecord).homeDecorationTypes);
      expect(loaded.session.farmBuildingPlacements).toEqual((project.session as MutableRecord).farmBuildingPlacements);
      expect(loaded.session.homeDecorationPlacements).toEqual((project.session as MutableRecord).homeDecorationPlacements);

      const session = startSession(loaded as never, 601) as unknown as MutableRecord;
      expect(session.farmBuildingPlacements).toEqual({
        farm_building_1: expect.objectContaining({ typeId: "farm_building_shed", level: 1, x: 2, y: 2 }),
      });
      expect(session.homeDecorationPlacements).toEqual({
        home_decor_1: expect.objectContaining({ typeId: "home_decor_table", orientation: "left", x: 7, y: 2 }),
      });
      expect((loaded.system as MutableRecord).farmAnimalBuildings).toBeUndefined();
    });

    it("rejects duplicate ids, unsafe footprints, non-contiguous levels, and unknown orientations", () => {
      // Break caught: validateProjectV4 ignores malformed known P2 fields and lets unbounded footprint loops reach runtime.
      const cases: Array<{ mutate: (wire: MutableRecord) => void; pattern: RegExp }> = [
        {
          mutate: (wire) => {
            wire.database.farmBuildingTypes = [
              buildingTypeWire(wire, "duplicate"),
              buildingTypeWire(wire, "duplicate"),
            ];
          },
          pattern: /farmBuildingTypes.*duplicat/i,
        },
        {
          mutate: (wire) => {
            wire.database.farmBuildingTypes = [{
              ...buildingTypeWire(wire, "unsafe"),
              levels: [{
                ...buildingTypeWire(wire, "unsafe").levels[0],
                footprint: { width: Number.MAX_SAFE_INTEGER + 1, height: 1 },
              }],
            }];
          },
          pattern: /farmBuildingTypes.*footprint/i,
        },
        {
          mutate: (wire) => {
            wire.database.farmBuildingTypes = [{
              ...buildingTypeWire(wire, "gap"),
              levels: [
                buildingTypeWire(wire, "gap").levels[0],
                { ...buildingTypeWire(wire, "gap").levels[0], level: 3 },
              ],
            }];
          },
          pattern: /farmBuildingTypes.*level/i,
        },
        {
          mutate: (wire) => {
            wire.session.homeDecorationPlacements = [{
              instanceId: "decor_1",
              typeId: "decor_table",
              mapId: wire.startMapId,
              x: 1,
              y: 1,
              orientation: "diagonal",
            }];
          },
          pattern: /homeDecorationPlacements.*orientation/i,
        },
      ];

      for (const { mutate, pattern } of cases) {
        const wire = JSON.parse(serialize(createBlankProject())) as MutableRecord;
        mutate(wire);
        expect(() => deserialize(JSON.stringify(wire))).toThrow(pattern);
      }
    });

    it("bounds direct normalization without inventing optional legacy packages", () => {
      // Break caught: direct store writes bypass the JSON gate and preserve unsafe/duplicate spatial records.
      const project = createBlankProject();
      const normalized = normalizeDatabaseRecords({
        ...project.database,
        farmBuildingTypes: Array.from({ length: 270 }, (_, index) => ({
          id: index === 1 ? "building_0" : `building_${index}`,
          name: `Building ${index}`,
          levels: [{
            level: 1,
            footprint: { width: 1e300, height: 2 },
            capacity: 1e300,
            graphicResourceId: "easyrpg-picture-cloud",
          }],
        })),
        homeDecorationTypes: [{
          id: "decor_table",
          name: "Table",
          placementItemId: project.database.items[0]!.id,
          footprint: { width: 2, height: 1 },
          blocksMovement: true,
          allowedOrientations: ["left", "left", "diagonal"],
          graphicResourceId: "easyrpg-picture-cloud",
        }],
      } as never) as unknown as MutableRecord;

      expect(normalized.farmBuildingTypes).toHaveLength(256);
      expect(normalized.farmBuildingTypes.filter((row: MutableRecord) => row.id === "building_0")).toHaveLength(1);
      expect(normalized.farmBuildingTypes[0]).toMatchObject({
        levels: [{ footprint: { width: 1, height: 2 }, capacity: 1 }],
      });
      expect(normalized.homeDecorationTypes[0].allowedOrientations).toEqual(["left"]);

      const legacy = deserialize(serialize(createBlankProject())) as unknown as MutableRecord;
      expect(legacy.database.farmBuildingTypes).toBeUndefined();
      expect(legacy.database.homeDecorationTypes).toBeUndefined();
      expect(legacy.session.farmBuildingPlacements).toBeUndefined();
      expect(legacy.session.homeDecorationPlacements).toBeUndefined();
    });
  });
  function buildingTypeWire(wire: MutableRecord, id: string): MutableRecord {
    return {
      id,
      name: id,
      levels: [{
        level: 1,
        footprint: { width: 2, height: 2 },
        capacity: 4,
        cost: { items: [{ itemId: wire.database.items[0].id, count: 1 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      }],
    };
  }
});

describe("placementSurface", () => {
  isolateTimers();
  /**
   * 테스트용 방. `#` = 벽, `.` = 바닥.
   * 좌표는 문자열 인덱스 그대로 — (x, y) = (열, 행).
   */
  function probeFromArt(rows: readonly string[]): SurfaceProbe {
    const height = rows.length;
    const width = Math.max(...rows.map((row) => row.length));
    return tileSetSurfaceProbe({
      height,
      tileAt: (x, y) => (rows[y]?.[x] === "#" ? 1 : 0),
      width,
      wallTiles: new Set([1]),
    });
  }
  /** 5×5 방: 테두리가 벽, 안이 바닥. */
  const ROOM = [
    "#####",
    "#...#",
    "#...#",
    "#...#",
    "#####",
  ];
  describe("placementSurface — 배치 면 판정", () => {
    it("벽에 붙은 바닥: 북쪽은 위 칸이 벽일 때만 통과한다", () => {
      const probe = probeFromArt(ROOM);
      const north = { facing: "north", zone: "againstWall" } as const;

      // (2,1): 위가 테두리 벽 → 통과
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: north }).ok).toBe(true);
      // (2,2): 위가 바닥 → 실패
      const middle = checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: north });
      expect(middle.ok).toBe(false);
      expect(middle.reason).toContain("북쪽");
    });

    it("방향을 명시하면 다른 쪽이 벽이어도 통과하지 않는다 — 실패 이유가 붙어 있는 쪽을 알려준다", () => {
      const probe = probeFromArt(ROOM);
      // (1,2): 서쪽이 벽, 북쪽은 바닥
      const check = checkPlacementSurface({
        probe,
        rect: { x: 1, y: 2, w: 1, h: 1 },
        rule: { facing: "north", zone: "againstWall" },
      });
      expect(check.ok).toBe(false);
      expect(check.satisfiedFacings).toEqual(["west"]);
      expect(check.reason).toContain("서쪽");
    });

    it("방향을 any 로 두면 네 방향 중 하나만 벽이어도 통과한다", () => {
      const probe = probeFromArt(ROOM);
      expect(
        checkPlacementSurface({ probe, rect: { x: 1, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
      ).toBe(true);
      expect(
        checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "againstWall" } }).ok,
      ).toBe(false);
    });

    it("화덕처럼 키 큰 물건은 **발밑 줄**로 판정한다 — 윗칸이 벽에 겹쳐도 통과", () => {
      const probe = probeFromArt(ROOM);
      // 1×2 세로쌍의 좌상단을 벽 행(y=0)에 두고 발밑을 y=1 에 둔다.
      // 사각 전체를 봤다면 y=0 이 벽이라 어떤 바닥 zone 도 만족할 수 없다.
      const stove = checkPlacementSurface({
        probe,
        rect: { x: 2, y: 0, w: 1, h: 2 },
        rule: { facing: "north", zone: "againstWall" },
      });
      expect(stove.ok).toBe(true);
      expect(stove.reason).toContain("북쪽");
    });

    it("빈 땅(clearArea)은 사각 전체를 본다 — 발밑만 보는 anyFloor 와 갈린다", () => {
      const probe = probeFromArt(ROOM);
      const rect = { x: 2, y: 0, w: 1, h: 2 };
      expect(checkPlacementSurface({ probe, rect, rule: { zone: "anyFloor" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect, rule: { zone: "clearArea" } }).ok).toBe(false);
    });

    it("구석은 세로 한 쪽 + 가로 한 쪽이 모두 벽이어야 한다", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 1, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(true);
      // (2,1): 북쪽만 벽 — 가로가 비어 구석이 아니다
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "corner" } }).ok).toBe(false);
    });

    it("벽에서 떨어진 바닥(openFloor)은 네 방향 모두 트여 있어야 한다", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 1, w: 1, h: 1 }, rule: { zone: "openFloor" } }).ok).toBe(false);
    });

    it("벽면(wallFace)은 발밑 자체가 벽이어야 한다 — 창문·아궁이", () => {
      const probe = probeFromArt(ROOM);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 0, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(true);
      expect(checkPlacementSurface({ probe, rect: { x: 2, y: 2, w: 1, h: 1 }, rule: { zone: "wallFace" } }).ok).toBe(false);
    });

    it("맵 밖은 벽으로 센다 — 경계에 등을 대는 것도 «벽에 붙은» 것이다", () => {
      // 테두리 없는 3×3 바닥. (1,0) 의 북쪽은 맵 밖.
      const probe = probeFromArt(["...", "...", "..."]);
      expect(
        checkPlacementSurface({ probe, rect: { x: 1, y: 0, w: 1, h: 1 }, rule: { facing: "north", zone: "againstWall" } }).ok,
      ).toBe(true);
    });

    it("가로로 넓은 물건은 발밑 줄 **전부**가 그 방향으로 벽이어야 한다", () => {
      // 위쪽 벽이 왼쪽 2칸만 있는 방
      const probe = probeFromArt([
        "##..",
        "....",
        "....",
      ]);
      const rule = { facing: "north", zone: "againstWall" } as const;
      expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 2, h: 1 }, rule }).ok).toBe(true);
      // 3칸이면 (2,0) 이 바닥이라 실패
      expect(checkPlacementSurface({ probe, rect: { x: 0, y: 1, w: 3, h: 1 }, rule }).ok).toBe(false);
    });
  });
  describe("placementSurface — 조건 목록 판정", () => {
    const north: PlacementSurfaceCondition = {
      id: "pc_north",
      strength: "hard",
      zone: "againstWall",
      facing: "north",
    };
    const openSoft: PlacementSurfaceCondition = { id: "pc_open", strength: "soft", zone: "openFloor" };

    it("hard 는 blocked, soft 는 warnings 로 갈린다", () => {
      const probe = probeFromArt(ROOM);
      // (2,2): 북쪽이 바닥(hard 위반) + 네 방향 트임(soft 통과)
      const middle = evaluatePlacementConditions({
        conditions: [north, openSoft],
        probe,
        rect: { x: 2, y: 2, w: 1, h: 1 },
      });
      expect(middle.blocked).toHaveLength(1);
      expect(middle.warnings).toHaveLength(0);

      // (2,1): 북쪽이 벽(hard 통과) + 북쪽이 벽이라 openFloor 위반(soft)
      const top = evaluatePlacementConditions({
        conditions: [north, openSoft],
        probe,
        rect: { x: 2, y: 1, w: 1, h: 1 },
      });
      expect(top.blocked).toHaveLength(0);
      expect(top.warnings).toHaveLength(1);
    });

    it("조건이 없거나 undefined 면 아무것도 막지 않는다 — 기존 킷 하위 호환", () => {
      const probe = probeFromArt(ROOM);
      const rect = { x: 2, y: 2, w: 1, h: 1 };
      expect(evaluatePlacementConditions({ conditions: undefined, probe, rect }).blocked).toHaveLength(0);
      expect(evaluatePlacementConditions({ conditions: [], probe, rect }).blocked).toHaveLength(0);
    });

    it("사람이 쓴 message 가 있으면 그것을 앞세우고 판정 이유를 괄호로 붙인다", () => {
      const probe = probeFromArt(ROOM);
      const verdict = evaluatePlacementConditions({
        conditions: [{ ...north, message: "화덕은 북벽에 붙습니다" }],
        probe,
        rect: { x: 2, y: 2, w: 1, h: 1 },
      });
      expect(verdict.blocked[0]?.text).toContain("화덕은 북벽에 붙습니다");
      expect(verdict.blocked[0]?.text).toContain("북쪽");
    });
  });
  describe("placementSurface — 라벨과 파싱", () => {
    it("사람 말 설명은 방향까지 담는다", () => {
      expect(describePlacementSurface({ facing: "north", zone: "againstWall" })).toBe("북쪽(위) 벽에 붙은 바닥");
      expect(describePlacementSurface({ zone: "againstWall" })).toBe("벽에 붙은 바닥");
      // 방향은 againstWall 에서만 뜻이 있다 — 다른 면에서는 무시한다
      expect(describePlacementSurface({ facing: "north", zone: "openFloor" })).toBe("벽에서 떨어진 바닥");
    });

    it("모르는 값은 undefined 로 떨어진다 — 억지 매핑 금지", () => {
      expect(asPlacementZone("againstWall")).toBe("againstWall");
      expect(asPlacementZone("againstWallFloor")).toBeUndefined();
      expect(asPlacementFacing("north")).toBe("north");
      expect(asPlacementFacing("up")).toBeUndefined();
    });

    it("surface 클러스터 규칙 params → 규칙. 다른 kind 나 잘못된 zone 은 undefined", () => {
      expect(
        surfaceRuleFromClusterRule({
          id: "r",
          kind: "surface",
          params: { facing: "north", zone: "againstWall" },
          strength: "hard",
        }),
      ).toEqual({ facing: "north", zone: "againstWall" });
      expect(
        surfaceRuleFromClusterRule({ id: "r", kind: "surface", params: { zone: "뭐지" }, strength: "hard" }),
      ).toBeUndefined();
      expect(
        surfaceRuleFromClusterRule({ id: "r", kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
      ).toBeUndefined();
    });
  });
});
