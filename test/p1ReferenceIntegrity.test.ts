import { afterEach, describe, expect, it } from "vitest";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { createBlankProject } from "@/project/defaults";
import {
  collectProjectReferenceIssues,
  repairProjectReferences,
  validateProjectReferences,
} from "@/project/io/references";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { store } from "@/project/store";
import type {
  FarmAnimalBuildingDefinition,
  FarmAnimalSpeciesRecord,
  GameEvent,
  GameMap,
  Project,
} from "@/project/types";
import { resetToastsForTest } from "@/util/toast";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

afterEach(() => {
  resetToastsForTest();
  restoreDom?.();
  restoreDom = undefined;
});

describe("P1 farm-animal project reference integrity", () => {
  it("reports duplicate definitions and every cross-record failure with an exact authored path", () => {
    // Break caught: farm-animal rows can contain dangling ids and impossible capacity/compatibility without blocking play.
    const project = referenceProject();
    const [feedItem, productItem] = project.database.items;
    if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
    addEvent(project, "event_chicken");
    project.database.farmAnimalSpecies = [
      species("chicken", feedItem.id, productItem.id),
      species("cow", "missing_feed", "missing_product"),
      species("chicken", feedItem.id, productItem.id),
    ];
    project.system.farmAnimalBuildings = [
      building(project, "coop", 1, ["chicken", "missing_species"]),
      building(project, "coop", 4, ["chicken"]),
      { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
      { ...building(project, "off_map", 4, ["chicken"]), x: project.maps[project.startMapId]!.width },
      building(project, "cow_home", 4, ["chicken"]),
    ];
    project.session.farmAnimals = [
      { instanceId: "hen_1", speciesId: "chicken", name: "Hen 1", buildingId: "coop", eventId: "event_chicken" },
      { instanceId: "hen_2", speciesId: "chicken", name: "Hen 2", buildingId: "coop" },
      { instanceId: "hen_1", speciesId: "chicken", name: "Duplicate" },
      { instanceId: "ghost", speciesId: "missing_species", name: "Ghost" },
      { instanceId: "no_home", speciesId: "chicken", name: "No home", buildingId: "missing_building" },
      { instanceId: "no_event", speciesId: "chicken", name: "No event", eventId: "missing_event" },
      { instanceId: "wrong_home", speciesId: "cow", name: "Wrong home", buildingId: "cow_home" },
    ];

    const issues = collectProjectReferenceIssues(project);

    expect(issues).toEqual(expect.arrayContaining([
      "database.farmAnimalSpecies[2].id duplicates database.farmAnimalSpecies[0].id: chicken",
      "database.farmAnimalSpecies[1].feedItemId does not exist: missing_feed",
      "database.farmAnimalSpecies[1].productItemId does not exist: missing_product",
      "system.farmAnimalBuildings[1].id duplicates system.farmAnimalBuildings[0].id: coop",
      "system.farmAnimalBuildings[0].allowedSpeciesIds[1] does not exist: missing_species",
      "system.farmAnimalBuildings[2].mapId does not exist: missing_map",
      `system.farmAnimalBuildings[3].position (${project.maps[project.startMapId]!.width}, 0) is out of bounds for map ${project.startMapId}`,
      "session.farmAnimals[2].instanceId duplicates session.farmAnimals[0].instanceId: hen_1",
      "session.farmAnimals[3].speciesId does not exist: missing_species",
      "session.farmAnimals[4].buildingId does not exist: missing_building",
      "session.farmAnimals[5].eventId does not exist: missing_event",
      "session.farmAnimals[6].buildingId cow_home does not allow speciesId cow",
      "session.farmAnimals[1].buildingId exceeds system.farmAnimalBuildings[0].capacity: coop (1)",
    ]));
    expect(() => validateProjectReferences(project)).toThrow(/database\.farmAnimalSpecies\[2\]\.id/);
  });

  it("repairs invalid definitions and assignments without inventing replacement species or capacity", () => {
    // Break caught: load repair substitutes unrelated ids or leaves a cascading farm-animal reference failure.
    const project = referenceProject();
    const [feedItem, productItem] = project.database.items;
    if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
    addEvent(project, "event_keep");
    project.database.farmAnimalSpecies = [
      species("chicken", feedItem.id, productItem.id),
      species("cow", feedItem.id, productItem.id),
      species("invalid_items", "missing_feed", productItem.id),
    ];
    project.system.farmAnimalBuildings = [
      building(project, "coop", 1, ["chicken", "invalid_items", "missing_species"]),
      { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
      { ...building(project, "off_map", 4, ["chicken"]), y: project.maps[project.startMapId]!.height },
    ];
    project.session.farmAnimals = [
      { instanceId: "keep", speciesId: "chicken", name: "Keep", buildingId: "coop", eventId: "event_keep" },
      { instanceId: "overflow", speciesId: "chicken", name: "Overflow", buildingId: "coop" },
      { instanceId: "incompatible", speciesId: "cow", name: "Incompatible", buildingId: "coop" },
      { instanceId: "invalid_species", speciesId: "invalid_items", name: "Invalid items" },
      { instanceId: "unknown_species", speciesId: "missing_species", name: "Unknown" },
      { instanceId: "unknown_home", speciesId: "chicken", name: "Unknown home", buildingId: "missing_building" },
      { instanceId: "removed_home", speciesId: "chicken", name: "Removed home", buildingId: "missing_home" },
    ];

    repairProjectReferences(project);

    expect(project.database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken", "cow"]);
    expect(project.system.farmAnimalBuildings).toEqual([
      expect.objectContaining({ id: "coop", capacity: 1, allowedSpeciesIds: ["chicken"] }),
    ]);
    expect(project.session.farmAnimals?.map((row) => row.instanceId)).toEqual([
      "keep", "overflow", "incompatible", "unknown_home", "removed_home",
    ]);
    expect(project.session.farmAnimals?.find((row) => row.instanceId === "keep")).toMatchObject({
      speciesId: "chicken",
      buildingId: "coop",
      eventId: "event_keep",
    });
    for (const instanceId of ["overflow", "incompatible", "unknown_home", "removed_home"]) {
      expect(project.session.farmAnimals?.find((row) => row.instanceId === instanceId)?.buildingId).toBeUndefined();
    }
    expect(() => validateProjectReferences(project)).not.toThrow();
  });

  it("includes animal-home ids in map impact and clears only assignments to cascaded homes", () => {
    // Break caught: deleting a map silently leaves farmAnimalBuildings and starting-animal buildingIds dangling.
    const project = referenceProject();
    const target = addMap(project, "map_barnyard");
    target.events.push({
      id: "event_barnyard_hen",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
    });
    const [feedItem, productItem] = project.database.items;
    if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
    project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
    project.system.farmAnimalBuildings = [
      buildingOn(target, "coop", 4, ["chicken"]),
      buildingOn(target, "barn", 4, ["chicken"]),
      building(project, "source_home", 4, ["chicken"]),
    ];
    project.session.farmAnimals = [
      {
        instanceId: "coop_animal",
        speciesId: "chicken",
        name: "Coop",
        buildingId: "coop",
        eventId: "event_barnyard_hen",
      },
      { instanceId: "barn_animal", speciesId: "chicken", name: "Barn", buildingId: "barn" },
      { instanceId: "source_animal", speciesId: "chicken", name: "Source", buildingId: "source_home" },
    ];

    const impact = collectMapDeletionImpact(project, target.id);
    expect(impact?.farmAnimalBuildingCount).toBe(2);
    expect(impact?.farmAnimalBuildingIds).toEqual(["coop", "barn"]);

    applyMapDeletion(project, target.id);

    expect(project.system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["source_home"]);
    expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.buildingId).toBeUndefined();
    expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.eventId).toBeUndefined();
    expect(project.session.farmAnimals?.find((row) => row.instanceId === "barn_animal")?.buildingId).toBeUndefined();
    expect(project.session.farmAnimals?.find((row) => row.instanceId === "source_animal")?.buildingId).toBe("source_home");
    expect(() => validateProjectReferences(project)).not.toThrow();
  });

  it("blocks database item deletion when a species uses it as feed or product", () => {
    // Break caught: deleting an item used by a farm species bypasses the database reference guard.
    const project = referenceProject();
    const [feedItem, productItem] = project.database.items;
    if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
    project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
    store.replace(project);

    expect(databaseReferenceMessage("items", feedItem.id)).toMatch(/동물 종.*먹이/);
    expect(databaseReferenceMessage("items", productItem.id)).toMatch(/동물 종.*생산물/);
  });

  it("keeps referenced species and buildings when their farm-animal UI delete buttons are clicked", () => {
    // Break caught: the structured animal editor splices referenced species/buildings without consulting a guard.
    restoreDom = installFakeDom();
    const project = referenceProject();
    const [feedItem, productItem] = project.database.items;
    if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
    project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
    project.system.farmAnimalBuildings = [building(project, "coop", 4, ["chicken"])];
    project.session.farmAnimals = [{ instanceId: "hen", speciesId: "chicken", name: "Hen", buildingId: "coop" }];
    store.replace(project);
    const host = document.createElement("div") as unknown as FakeElement;
    renderFarmAnimalsTab(host as unknown as HTMLElement, () => undefined);

    findByTestId(host, "db-farm-species-chicken")?.querySelector("button")?.click();
    findByTestId(host, "db-farm-building-coop")?.querySelector("button")?.click();

    expect(store.getCurrent().database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken"]);
    expect(store.getCurrent().system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["coop"]);
  });
});

function referenceProject(): Project {
  return createBlankProject();
}

function species(id: string, feedItemId: string, productItemId: string): FarmAnimalSpeciesRecord {
  return {
    id,
    name: id,
    feedItemId,
    productItemId,
    productCount: 1,
    productEveryDays: 1,
    petFriendship: 10,
  };
}

function building(
  project: Project,
  id: string,
  capacity: number,
  allowedSpeciesIds: string[],
): FarmAnimalBuildingDefinition {
  return buildingOn(project.maps[project.startMapId]!, id, capacity, allowedSpeciesIds);
}

function buildingOn(
  map: GameMap,
  id: string,
  capacity: number,
  allowedSpeciesIds: string[],
): FarmAnimalBuildingDefinition {
  return { id, name: id, mapId: map.id, x: 0, y: 0, capacity, allowedSpeciesIds };
}

function addMap(project: Project, id: string): GameMap {
  const map = structuredClone(project.maps[project.startMapId]!);
  map.id = id;
  map.name = id;
  map.events = [];
  project.maps[id] = map;
  project.mapTree.children.push({ mapId: id, children: [] });
  return map;
}

function addEvent(project: Project, id: string): void {
  const event: GameEvent = {
    id,
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands: [],
  };
  project.maps[project.startMapId]!.events.push(event);
}
