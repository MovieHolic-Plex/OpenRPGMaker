import {
  FARM_ANIMAL_BUILDING_CAPACITY_MAX,
  FARM_ANIMAL_FRIENDSHIP_MAX,
  FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX,
  FARM_ANIMAL_RECORD_LIMIT,
  isCalendarDayKey,
} from "@/project/p1FoundationRecords";
import { calendarDayKey, daysPerSeasonOf, SEASONS } from "@/project/gameTime";
import { reconcileLinkedAnimalHousing, resolveAnimalHome } from "./animalHousing";
import { isItemQuantity, isPositiveItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { changeItemsAtomically, type FarmAnimalState, type PlaySession } from "@/project/session";
import type {
  FarmAnimalBuildingDefinition,
  FarmAnimalSpeciesRecord,
  Project,
} from "@/project/types";

export type FarmAnimalFailureReason =
  | "disabled"
  | "missing-animal"
  | "missing-species"
  | "missing-building"
  | "species-not-allowed"
  | "building-full"
  | "unassigned"
  | "invalid-day-key"
  | "already-fed"
  | "already-petted"
  | "already-advanced"
  | "insufficient-feed"
  | "not-ready"
  | "inventory-overflow"
  | "product-overflow"
  | "invalid-definition"
  | "invalid-state";

export type FarmAnimalAssignmentResult =
  | {
      readonly ok: true;
      readonly instanceId: string;
      readonly buildingId: string;
      readonly previousBuildingId: string | undefined;
    }
  | {
      readonly ok: false;
      readonly reason: FarmAnimalFailureReason;
      readonly instanceId?: string;
      readonly buildingId?: string;
    };

export type FarmAnimalFeedResult =
  | { readonly ok: true; readonly instanceId: string; readonly itemId: string; readonly dayKey: string }
  | { readonly ok: false; readonly reason: FarmAnimalFailureReason; readonly instanceId?: string };

export type FarmAnimalPetResult =
  | {
      readonly ok: true;
      readonly instanceId: string;
      readonly dayKey: string;
      readonly friendship: number;
      readonly gained: number;
    }
  | { readonly ok: false; readonly reason: FarmAnimalFailureReason; readonly instanceId?: string };

export type FarmAnimalAdvanceResult =
  | {
      readonly ok: true;
      readonly dayKey: string;
      readonly advancedInstanceIds: readonly string[];
      readonly products: readonly { readonly instanceId: string; readonly itemId: string; readonly count: number }[];
    }
  | { readonly ok: false; readonly reason: FarmAnimalFailureReason; readonly instanceId?: string };

export type FarmAnimalCollectResult =
  | { readonly ok: true; readonly instanceId: string; readonly itemId: string; readonly count: number }
  | { readonly ok: false; readonly reason: FarmAnimalFailureReason; readonly instanceId?: string };

export function assignFarmAnimalToBuilding(
  project: Project,
  session: PlaySession,
  instanceId: string,
  buildingId: string,
): FarmAnimalAssignmentResult {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason, instanceId, buildingId };
  const animal = context.animals[instanceId];
  if (!animal) return { ok: false, reason: "missing-animal", instanceId, buildingId };
  const building = context.buildings.get(buildingId);
  if (!building) return { ok: false, reason: "missing-building", instanceId, buildingId };
  if (!building.allowedSpeciesIds.includes(animal.speciesId)) {
    return { ok: false, reason: "species-not-allowed", instanceId, buildingId };
  }
  const occupants = Object.entries(context.animals)
    .filter(([otherId, other]) => otherId !== instanceId && other.buildingId === buildingId)
    .length;
  if (occupants >= building.capacity) {
    return { ok: false, reason: "building-full", instanceId, buildingId };
  }

  const previousBuildingId = animal.buildingId;
  const { housingPlacementId: _previousPlacement, ...independent } = animal;
  session.farmAnimals = {
    ...context.animals,
    [instanceId]: { ...independent, buildingId },
  };
  return { ok: true, instanceId, buildingId, previousBuildingId };
}

export function assignFarmAnimalToHousingPlacement(
  project: Project, session: PlaySession, instanceId: string, housingPlacementId: string,
): { readonly ok: true; readonly instanceId: string; readonly housingPlacementId: string }
  | { readonly ok: false; readonly reason: FarmAnimalFailureReason } {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason };
  const animal = context.animals[instanceId];
  if (!animal) return { ok: false, reason: "missing-animal" };
  const home = resolveAnimalHome(project, session, { housingPlacementId });
  if (!home) return { ok: false, reason: "missing-building" };
  if (!home.allowedSpeciesIds.includes(animal.speciesId)) return { ok: false, reason: "species-not-allowed" };
  const count = Object.values(context.animals).filter((other) => other.instanceId !== instanceId && other.housingPlacementId === housingPlacementId).length;
  if (count >= home.capacity) return { ok: false, reason: "building-full" };
  const { buildingId: _legacy, ...linked } = animal;
  session.farmAnimals = { ...context.animals, [instanceId]: { ...linked, housingPlacementId } };
  return { ok: true, instanceId, housingPlacementId };
}

export function feedFarmAnimal(
  project: Project,
  session: PlaySession,
  instanceId: string,
  dayKey: string,
): FarmAnimalFeedResult {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason, instanceId };
  if (!isCalendarDayKey(dayKey) || !isLiveCareDay(session, dayKey)) {
    return { ok: false, reason: "invalid-day-key", instanceId };
  }
  const animal = context.animals[instanceId];
  if (!animal) return { ok: false, reason: "missing-animal", instanceId };
  if (!resolveAnimalHome(project, session, animal)) return { ok: false, reason: "unassigned", instanceId };
  if (animal.lastAdvancedDayKey && compareDayKeys(animal.lastAdvancedDayKey, dayKey) >= 0) {
    return { ok: false, reason: "already-advanced", instanceId };
  }
  if (animal.lastFedDayKey && compareDayKeys(animal.lastFedDayKey, dayKey) >= 0) {
    return { ok: false, reason: "already-fed", instanceId };
  }
  const species = context.species.get(animal.speciesId)!;
  const available = session.inventory[species.feedItemId] ?? 0;
  if (!isItemQuantity(available)) return { ok: false, reason: "invalid-state", instanceId };
  if (available < 1) return { ok: false, reason: "insufficient-feed", instanceId };
  if (!changeItemsAtomically(session, [{ itemId: species.feedItemId, op: "-=", amount: 1 }])) {
    return { ok: false, reason: "invalid-state", instanceId };
  }
  session.farmAnimals = {
    ...context.animals,
    [instanceId]: { ...animal, lastFedDayKey: dayKey },
  };
  return { ok: true, instanceId, itemId: species.feedItemId, dayKey };
}

export function petFarmAnimal(
  project: Project,
  session: PlaySession,
  instanceId: string,
  dayKey: string,
): FarmAnimalPetResult {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason, instanceId };
  if (!isCalendarDayKey(dayKey) || !isLiveCareDay(session, dayKey)) {
    return { ok: false, reason: "invalid-day-key", instanceId };
  }
  const animal = context.animals[instanceId];
  if (!animal) return { ok: false, reason: "missing-animal", instanceId };
  if (!resolveAnimalHome(project, session, animal)) return { ok: false, reason: "unassigned", instanceId };
  if (animal.lastAdvancedDayKey && compareDayKeys(animal.lastAdvancedDayKey, dayKey) >= 0) {
    return { ok: false, reason: "already-advanced", instanceId };
  }
  if (animal.lastPettedDayKey && compareDayKeys(animal.lastPettedDayKey, dayKey) >= 0) {
    return { ok: false, reason: "already-petted", instanceId };
  }
  const species = context.species.get(animal.speciesId)!;
  const friendship = Math.min(FARM_ANIMAL_FRIENDSHIP_MAX, animal.friendship + species.petFriendship);
  const gained = friendship - animal.friendship;
  session.farmAnimals = {
    ...context.animals,
    [instanceId]: { ...animal, friendship, lastPettedDayKey: dayKey },
  };
  return { ok: true, instanceId, dayKey, friendship, gained };
}

export function advanceFarmAnimalProduction(
  project: Project,
  session: PlaySession,
  dayKey: string,
): FarmAnimalAdvanceResult {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason };
  if (!isCalendarDayKey(dayKey) || !isLiveAdvanceDay(project, session, dayKey)) {
    return { ok: false, reason: "invalid-day-key" };
  }
  const entries = Object.entries(context.animals);
  if (entries.length === 0) {
    return { ok: true, dayKey, advancedInstanceIds: [], products: [] };
  }

  const pending: Array<[string, FarmAnimalState]> = [];
  for (const [instanceId, animal] of entries) {
    if ((animal.lastFedDayKey && compareDayKeys(animal.lastFedDayKey, dayKey) > 0)
      || (animal.lastPettedDayKey && compareDayKeys(animal.lastPettedDayKey, dayKey) > 0)) {
      return { ok: false, reason: "invalid-day-key", instanceId };
    }
    if (animal.lastAdvancedDayKey) {
      const order = compareDayKeys(animal.lastAdvancedDayKey, dayKey);
      if (order > 0) return { ok: false, reason: "invalid-day-key", instanceId };
      if (order === 0) continue;
    }
    pending.push([instanceId, animal]);
  }
  if (pending.length === 0) return { ok: false, reason: "already-advanced" };

  const replacements: Record<string, FarmAnimalState> = Object.create(null);
  const products: Array<{ instanceId: string; itemId: string; count: number }> = [];
  for (const [instanceId, animal] of pending) {
    const species = context.species.get(animal.speciesId)!;
    let productionProgress = animal.productionProgress;
    let readyProductCount = animal.readyProductCount;
    const cared = resolveAnimalHome(project, session, animal) !== undefined
      && animal.lastFedDayKey === dayKey
      && animal.lastPettedDayKey === dayKey;
    if (cared) {
      productionProgress += 1;
      if (productionProgress === species.productEveryDays) {
        const nextReady = readyProductCount + species.productCount;
        if (!isItemQuantity(nextReady)) {
          return { ok: false, reason: "product-overflow", instanceId };
        }
        productionProgress = 0;
        readyProductCount = nextReady;
        products.push({ instanceId, itemId: species.productItemId, count: species.productCount });
      }
    }
    replacements[instanceId] = {
      ...animal,
      productionProgress,
      readyProductCount,
      lastAdvancedDayKey: dayKey,
    };
  }

  session.farmAnimals = { ...context.animals, ...replacements };
  return {
    ok: true,
    dayKey,
    advancedInstanceIds: pending.map(([instanceId]) => instanceId),
    products,
  };
}

export function collectFarmAnimalProduct(
  project: Project,
  session: PlaySession,
  instanceId: string,
): FarmAnimalCollectResult {
  const context = farmAnimalContext(project, session);
  if (!context.ok) return { ok: false, reason: context.reason, instanceId };
  const animal = context.animals[instanceId];
  if (!animal) return { ok: false, reason: "missing-animal", instanceId };
  if (!isPositiveItemQuantity(animal.readyProductCount)) {
    return { ok: false, reason: "not-ready", instanceId };
  }
  const species = context.species.get(animal.speciesId)!;
  const current = session.inventory[species.productItemId] ?? 0;
  if (!isItemQuantity(current) || current + animal.readyProductCount > ITEM_QUANTITY_MAX) {
    return { ok: false, reason: "inventory-overflow", instanceId };
  }
  if (!changeItemsAtomically(session, [{
    itemId: species.productItemId,
    op: "+=",
    amount: animal.readyProductCount,
  }])) {
    return { ok: false, reason: "inventory-overflow", instanceId };
  }
  session.farmAnimals = {
    ...context.animals,
    [instanceId]: { ...animal, readyProductCount: 0 },
  };
  return {
    ok: true,
    instanceId,
    itemId: species.productItemId,
    count: animal.readyProductCount,
  };
}

type FarmAnimalContext = {
  readonly ok: true;
  readonly animals: Record<string, FarmAnimalState>;
  readonly species: ReadonlyMap<string, FarmAnimalSpeciesRecord>;
  readonly buildings: ReadonlyMap<string, FarmAnimalBuildingDefinition>;
} | {
  readonly ok: false;
  readonly reason: FarmAnimalFailureReason;
};

function farmAnimalContext(project: Project, session: PlaySession): FarmAnimalContext {
  const packageAuthored = project.database.farmAnimalSpecies !== undefined
    || project.system.farmAnimalBuildings !== undefined
    || project.session.farmAnimals !== undefined
    || session.farmAnimals !== undefined;
  if (!packageAuthored) return { ok: false, reason: "disabled" };

  const rawSpecies: unknown = project.database.farmAnimalSpecies;
  if (rawSpecies !== undefined
    && (!Array.isArray(rawSpecies) || rawSpecies.length > FARM_ANIMAL_RECORD_LIMIT)) {
    return { ok: false, reason: "invalid-definition" };
  }
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const species = new Map<string, FarmAnimalSpeciesRecord>();
  for (const raw of rawSpecies ?? []) {
    if (!isRecord(raw)) return { ok: false, reason: "invalid-definition" };
    const value = raw as unknown as FarmAnimalSpeciesRecord;
    if (!validSpecies(value, itemIds) || species.has(value.id)) {
      return { ok: false, reason: "invalid-definition" };
    }
    species.set(value.id, value);
  }

  const rawBuildings: unknown = project.system.farmAnimalBuildings;
  if (rawBuildings !== undefined
    && (!Array.isArray(rawBuildings) || rawBuildings.length > FARM_ANIMAL_RECORD_LIMIT)) {
    return { ok: false, reason: "invalid-definition" };
  }
  const buildings = new Map<string, FarmAnimalBuildingDefinition>();
  for (const raw of rawBuildings ?? []) {
    if (!isRecord(raw)) return { ok: false, reason: "invalid-definition" };
    const value = raw as unknown as FarmAnimalBuildingDefinition;
    if (!validBuilding(project, value, species) || buildings.has(value.id)) {
      return { ok: false, reason: "invalid-definition" };
    }
    buildings.set(value.id, value);
  }

  const rawAnimals: unknown = session.farmAnimals;
  if (rawAnimals !== undefined && !isRecord(rawAnimals)) {
    return { ok: false, reason: "invalid-state" };
  }
  const animals = (rawAnimals ?? {}) as Record<string, FarmAnimalState>;
  const entries = Object.entries(animals);
  if (entries.length > FARM_ANIMAL_RECORD_LIMIT) return { ok: false, reason: "invalid-state" };
  const instanceIds = new Set<string>();
  const occupancy = new Map<string, number>();
  for (const [recordKey, rawAnimal] of entries) {
    if (!isRecord(rawAnimal)) return { ok: false, reason: "invalid-state" };
    const animal = rawAnimal as unknown as FarmAnimalState;
    if (!validId(recordKey) || !validId(animal.instanceId) || animal.instanceId !== recordKey) {
      return { ok: false, reason: "invalid-state" };
    }
    if (instanceIds.has(animal.instanceId)) return { ok: false, reason: "invalid-state" };
    instanceIds.add(animal.instanceId);
    const animalSpecies = species.get(animal.speciesId);
    if (!animalSpecies) return { ok: false, reason: "missing-species" };
    if (!validAnimalState(animal, animalSpecies)) return { ok: false, reason: "invalid-state" };
    if (!animal.buildingId) continue;
    const building = buildings.get(animal.buildingId);
    if (!building) return { ok: false, reason: "missing-building" };
    if (!building.allowedSpeciesIds.includes(animal.speciesId)) {
      return { ok: false, reason: "species-not-allowed" };
    }
    occupancy.set(building.id, (occupancy.get(building.id) ?? 0) + 1);
  }
  for (const [buildingId, count] of occupancy) {
    if (count > buildings.get(buildingId)!.capacity) return { ok: false, reason: "invalid-state" };
  }
  return { ok: true, animals: reconcileLinkedAnimalHousing(project, session, animals)!, species, buildings };
}

function validSpecies(species: FarmAnimalSpeciesRecord, itemIds: ReadonlySet<string>): boolean {
  return validId(species.id)
    && validText(species.name)
    && validId(species.feedItemId)
    && itemIds.has(species.feedItemId)
    && validId(species.productItemId)
    && itemIds.has(species.productItemId)
    && isPositiveItemQuantity(species.productCount)
    && Number.isSafeInteger(species.productEveryDays)
    && species.productEveryDays >= 1
    && species.productEveryDays <= FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX
    && Number.isSafeInteger(species.petFriendship)
    && species.petFriendship >= 0
    && species.petFriendship <= FARM_ANIMAL_FRIENDSHIP_MAX;
}

function validBuilding(
  project: Project,
  building: FarmAnimalBuildingDefinition,
  species: ReadonlyMap<string, FarmAnimalSpeciesRecord>,
): boolean {
  const map = project.maps[building.mapId];
  if (!validId(building.id) || !validText(building.name) || !map) return false;
  if (!Number.isSafeInteger(building.x) || !Number.isSafeInteger(building.y)) return false;
  if (building.x < 0 || building.y < 0 || building.x >= map.width || building.y >= map.height) return false;
  if (!Number.isSafeInteger(building.capacity)
    || building.capacity < 1
    || building.capacity > FARM_ANIMAL_BUILDING_CAPACITY_MAX) return false;
  if (!Array.isArray(building.allowedSpeciesIds)
    || building.allowedSpeciesIds.length > FARM_ANIMAL_RECORD_LIMIT) return false;
  const allowed = new Set<string>();
  for (const speciesId of building.allowedSpeciesIds) {
    if (!validId(speciesId) || !species.has(speciesId) || allowed.has(speciesId)) return false;
    allowed.add(speciesId);
  }
  return true;
}

function validAnimalState(animal: FarmAnimalState, species: FarmAnimalSpeciesRecord): boolean {
  if (!validText(animal.name)) return false;
  if (animal.eventId !== undefined && !validId(animal.eventId)) return false;
  if (animal.buildingId !== undefined && !validId(animal.buildingId)) return false;
  if (animal.housingPlacementId !== undefined && (!validId(animal.housingPlacementId) || animal.buildingId !== undefined)) return false;
  if (!Number.isSafeInteger(animal.friendship)
    || animal.friendship < 0
    || animal.friendship > FARM_ANIMAL_FRIENDSHIP_MAX) return false;
  if (!isItemQuantity(animal.productionProgress)
    || animal.productionProgress >= species.productEveryDays) return false;
  if (!isItemQuantity(animal.readyProductCount)) return false;
  return [animal.lastFedDayKey, animal.lastPettedDayKey, animal.lastAdvancedDayKey]
    .every((value) => value === undefined || isCalendarDayKey(value));
}

function compareDayKeys(left: string, right: string): number {
  const leftParts = dayKeyParts(left);
  const rightParts = dayKeyParts(right);
  if (leftParts.year !== rightParts.year) return leftParts.year < rightParts.year ? -1 : 1;
  if (leftParts.season !== rightParts.season) return leftParts.season < rightParts.season ? -1 : 1;
  if (leftParts.day === rightParts.day) return 0;
  return leftParts.day < rightParts.day ? -1 : 1;
}

function isLiveCareDay(session: PlaySession, dayKey: string): boolean {
  return !session.gameTime || calendarDayKey(session.gameTime) === dayKey;
}

/**
 * Direct animal advancement may settle the live day, while the atomic day-transition
 * authority advances the draft calendar first and then settles the immediately previous day.
 */
function isLiveAdvanceDay(project: Project, session: PlaySession, dayKey: string): boolean {
  const time = session.gameTime;
  if (!time) return true;
  if (calendarDayKey(time) === dayKey) return true;
  const daysPerSeason = daysPerSeasonOf(project);
  if (time.day > 1) return dayKey === `${time.year}:${time.season}:${time.day - 1}`;
  const seasonIndex = SEASONS.indexOf(time.season);
  const previousSeason = SEASONS[(seasonIndex + SEASONS.length - 1) % SEASONS.length]!;
  const previousYear = time.season === "spring" ? time.year - 1 : time.year;
  return previousYear >= 1 && dayKey === `${previousYear}:${previousSeason}:${daysPerSeason}`;
}

function dayKeyParts(value: string): { year: number; season: number; day: number } {
  const [year, season, day] = value.split(":");
  const seasons: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };
  return { year: Number(year), season: seasons[season!]!, day: Number(day) };
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value === value.trim();
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
