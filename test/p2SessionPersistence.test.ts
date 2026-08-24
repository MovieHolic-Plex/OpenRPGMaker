import { describe, expect, it } from "vitest";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { advanceSeasonalForage } from "@/project/seasonalForage";
import { nextSessionRandom, startSession } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

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
