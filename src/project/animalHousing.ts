import type { FarmAnimalStartInstance, FarmBuildingPlacement, Project } from "./types";
import { orientedFootprint } from "./spatialPlacements";

export type AnimalHome = {
  readonly id: string;
  readonly kind: "legacy" | "placement";
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly capacity: number;
  readonly allowedSpeciesIds: readonly string[];
  readonly level?: number;
};
type HousingState = { readonly farmBuildingPlacements?: Record<string, FarmBuildingPlacement> };

/** Only explicit references resolve homes. No name/type/coordinate matching or legacy fallback. */
export function resolveAnimalHome(project: Project, state: HousingState, animal: Pick<FarmAnimalStartInstance, "buildingId" | "housingPlacementId">): AnimalHome | undefined {
  if (animal.housingPlacementId !== undefined) {
    if (animal.buildingId !== undefined) return undefined;
    const placement = state.farmBuildingPlacements?.[animal.housingPlacementId];
    if (!placement || placement.instanceId !== animal.housingPlacementId) return undefined;
    const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
    const level = type?.levels.find((entry) => entry.level === placement.level);
    const map = project.maps[placement.mapId];
    if (!type?.animalHousing || !level || !map || !Number.isSafeInteger(level.animalCapacity)
      || level.animalCapacity! < 0 || level.animalCapacity! > 9999) return undefined;
    const size = orientedFootprint(level.footprint, placement.orientation);
    if (!Number.isSafeInteger(placement.x) || !Number.isSafeInteger(placement.y)
      || placement.x < 0 || placement.y < 0 || placement.x + size.width > map.width || placement.y + size.height > map.height
      || (type.allowedMapIds?.length && !type.allowedMapIds.includes(placement.mapId))) return undefined;
    return { id: placement.instanceId, kind: "placement", mapId: placement.mapId, x: placement.x, y: placement.y,
      level: placement.level, capacity: level.animalCapacity!, allowedSpeciesIds: type.animalHousing.allowedSpeciesIds };
  }
  const home = project.system.farmAnimalBuildings?.find((entry) => entry.id === animal.buildingId);
  return home ? { ...home, kind: "legacy" } : undefined;
}

/** Linked shrink/removal only unassigns. Receipts, identity and products stay with the animal. */
export function reconcileLinkedAnimalHousing<T extends FarmAnimalStartInstance>(project: Project, state: HousingState, animals: Record<string, T> | undefined): Record<string, T> | undefined {
  if (animals === undefined) return undefined;
  const keep = new Set<string>();
  const occupancy = new Map<string, number>();
  for (const animal of Object.values(animals).sort((a, b) => compareCodePoints(a.instanceId, b.instanceId))) {
    if (animal.housingPlacementId === undefined) continue;
    if (animal.buildingId !== undefined) throw new Error("Simultaneous animal home references");
    const home = resolveAnimalHome(project, state, animal);
    if (!home || !home.allowedSpeciesIds.includes(animal.speciesId)) continue;
    const count = occupancy.get(home.id) ?? 0;
    if (count >= home.capacity) continue;
    occupancy.set(home.id, count + 1);
    keep.add(animal.instanceId);
  }
  return Object.fromEntries(Object.entries(animals).map(([id, animal]) => {
    if (animal.housingPlacementId === undefined || keep.has(id)) return [id, animal];
    const { housingPlacementId: _removed, ...unassigned } = animal;
    return [id, unassigned as T];
  }));
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (value) => value.codePointAt(0)!);
  const b = Array.from(right, (value) => value.codePointAt(0)!);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
