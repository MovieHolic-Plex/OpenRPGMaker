import { describe, expect, it } from "vitest";
import { performAutosave } from "@/player/autosave";
import { restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readAutosave,
  readSaveSlot,
  saveToSlot,
} from "@/player/saveSlots";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";

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
    const project = createBlankProject();
    const before = serialize(project);
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

  it("sanitizes hostile P1 state in both the writer and direct-apply paths", () => {
    // Break caught: parser-only validation lets internal writer/direct apply callers bypass save safety.
    const project = createBlankProject();
    configureP1Project(project);
    const session = startSession(project, 106) as unknown as MutableUnknown;
    session.dailyWeather = { dayKey: "1:spring:4", kind: "rain", intensity: Number.NaN };
    Object.assign((session.farmAnimals as Record<string, MutableUnknown>).farm_animal_1!, {
      friendship: Number.POSITIVE_INFINITY,
      productionProgress: Number.MAX_SAFE_INTEGER + 1,
      readyProductCount: 1e300,
    });

    const written = createSaveSnapshot(project, session as never);
    expect((written.session as unknown as MutableUnknown).dailyWeather).toBeUndefined();
    expect((written.session as unknown as MutableUnknown).farmAnimals).toEqual({
      farm_animal_1: expect.objectContaining({
        friendship: 0,
        productionProgress: 0,
        readyProductCount: 0,
      }),
    });

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
    const restored = applySaveSnapshot(project, direct) as unknown as MutableUnknown;
    expect(restored.dailyWeather).toBeUndefined();
    expect(restored.farmAnimals).toEqual({
      farm_animal_1: expect.objectContaining({
        friendship: 0,
        productionProgress: 0,
        readyProductCount: 0,
      }),
    });
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
