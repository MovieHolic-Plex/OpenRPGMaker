import { describe, expect, it } from "vitest";
import {
  advanceFarmAnimalProduction,
  feedFarmAnimal,
  petFarmAnimal,
} from "@/project/farmAnimals";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import {
  animalProject,
  feedItemId,
  replaceAnimal,
} from "./fixtures/p1FarmAnimals";

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
