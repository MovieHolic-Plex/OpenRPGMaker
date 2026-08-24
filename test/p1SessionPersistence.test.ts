import { describe, expect, it } from "vitest";
import {
  advanceFarmAnimalProduction,
  assignFarmAnimalToBuilding,
  feedFarmAnimal,
  petFarmAnimal,
} from "@/project/farmAnimals";
import { createBlankProject } from "@/project/defaults";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { startSession } from "@/project/session";
import { animalProject, feedItemId } from "./fixtures/p1FarmAnimals";

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
