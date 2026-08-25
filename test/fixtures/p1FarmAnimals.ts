import { createBlankProject } from "@/project/defaults";
import type { FarmAnimalState, PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export function animalProject(): Project {
  const project = createBlankProject();
  const feedItem = project.database.items[0];
  const productItem = project.database.items[1];
  if (!feedItem || !productItem) throw new Error("animal test requires two items");
  project.database.farmAnimalSpecies = [{
    id: "chicken",
    name: "Chicken",
    feedItemId: feedItem.id,
    productItemId: productItem.id,
    productCount: 2,
    productEveryDays: 2,
    petFriendship: 10,
  }, {
    id: "cow",
    name: "Cow",
    feedItemId: feedItem.id,
    productItemId: productItem.id,
    productCount: 1,
    productEveryDays: 1,
    petFriendship: 8,
  }];
  project.system.farmAnimalBuildings = [{
    id: "coop",
    name: "Coop",
    mapId: project.startMapId,
    x: 2,
    y: 2,
    capacity: 2,
    allowedSpeciesIds: ["chicken"],
  }, {
    id: "barn",
    name: "Barn",
    mapId: project.startMapId,
    x: 3,
    y: 3,
    capacity: 2,
    allowedSpeciesIds: ["cow"],
  }];
  project.session.farmAnimals = [{
    instanceId: "animal_1",
    speciesId: "chicken",
    name: "Coco",
    buildingId: "coop",
  }, {
    instanceId: "animal_2",
    speciesId: "chicken",
    name: "Pico",
  }];
  return project;
}

export function replaceAnimal(
  session: PlaySession,
  instanceId: string,
  patch: Partial<FarmAnimalState>,
): void {
  const current = session.farmAnimals?.[instanceId];
  if (!current || !session.farmAnimals) throw new Error(`missing animal ${instanceId}`);
  session.farmAnimals[instanceId] = { ...current, ...patch };
}

export function feedItemId(project: Project): string {
  return project.database.farmAnimalSpecies![0]!.feedItemId;
}

export function productItemId(project: Project): string {
  return project.database.farmAnimalSpecies![0]!.productItemId;
}
