import { GOLD_MAX } from "@/project/economyValues";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import type {
  Dir,
  FarmBuildingLevelDefinition,
  FarmBuildingPlacement,
  FarmBuildingTypeRecord,
  HomeDecorationPlacement,
  HomeDecorationTypeRecord,
  ItemAmount,
  SpatialFootprint,
  SpatialPlacementCost,
} from "@/project/types";

export const SPATIAL_DEFINITION_LIMIT = 256;
export const SPATIAL_LEVEL_LIMIT = 16;
export const SPATIAL_PLACEMENT_LIMIT = 1_024;
export const SPATIAL_COST_ITEM_LIMIT = 64;
export const SPATIAL_FOOTPRINT_AXIS_MAX = 16;
export const SPATIAL_FOOTPRINT_TILE_MAX = 128;
export const SPATIAL_CAPACITY_MAX = 9_999;

export const SPATIAL_ORIENTATIONS = ["down", "left", "right", "up"] as const satisfies readonly Dir[];

export function isSpatialOrientation(value: unknown): value is Dir {
  return typeof value === "string" && (SPATIAL_ORIENTATIONS as readonly string[]).includes(value);
}

export function orientedFootprint(footprint: SpatialFootprint, orientation: Dir): SpatialFootprint {
  return orientation === "left" || orientation === "right"
    ? { width: footprint.height, height: footprint.width }
    : { ...footprint };
}

export function footprintCells(
  x: number,
  y: number,
  footprint: SpatialFootprint,
  orientation: Dir,
): Array<{ readonly x: number; readonly y: number }> {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return [];
  const size = orientedFootprint(footprint, orientation);
  if (!isSpatialFootprint(size)) return [];
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) cells.push({ x: x + dx, y: y + dy });
  }
  return cells;
}

export function isSpatialFootprint(value: unknown): value is SpatialFootprint {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.width)
    && Number.isSafeInteger(value.height)
    && (value.width as number) >= 1
    && (value.height as number) >= 1
    && (value.width as number) <= SPATIAL_FOOTPRINT_AXIS_MAX
    && (value.height as number) <= SPATIAL_FOOTPRINT_AXIS_MAX
    && (value.width as number) * (value.height as number) <= SPATIAL_FOOTPRINT_TILE_MAX;
}

export function normalizeFarmBuildingTypes(value: unknown): FarmBuildingTypeRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: FarmBuildingTypeRecord[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (result.length >= SPATIAL_DEFINITION_LIMIT) break;
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id);
    if (!id || seen.has(id)) continue;
    const levels = normalizeBuildingLevels(raw.levels);
    if (levels.length === 0) continue;
    if (raw.animalHousing !== undefined && (!isRecord(raw.animalHousing)
      || !Array.isArray(raw.animalHousing.allowedSpeciesIds)
      || raw.animalHousing.allowedSpeciesIds.some((id) => typeof id !== "string" || !id.trim() || id !== id.trim())
      || new Set(raw.animalHousing.allowedSpeciesIds).size !== raw.animalHousing.allowedSpeciesIds.length
      || raw.animalHousing.allowedSpeciesIds.length > SPATIAL_DEFINITION_LIMIT
      || levels.some((level) => level.animalCapacity === undefined))) throw new Error("Invalid animalHousing definition");
    seen.add(id);
    const allowedMapIds = uniqueIds(raw.allowedMapIds, SPATIAL_DEFINITION_LIMIT);
    result.push({
      id,
      name: cleanText(raw.name) ?? id,
      levels,
      ...(isRecord(raw.animalHousing) ? { animalHousing: { allowedSpeciesIds: [...raw.animalHousing.allowedSpeciesIds as string[]] } } : {}),
      ...(allowedMapIds.length > 0 ? { allowedMapIds } : {}),
    });
  }
  return result;
}

export function normalizeHomeDecorationTypes(value: unknown): HomeDecorationTypeRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: HomeDecorationTypeRecord[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (result.length >= SPATIAL_DEFINITION_LIMIT) break;
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id);
    const placementItemId = cleanId(raw.placementItemId);
    const graphicResourceId = cleanId(raw.graphicResourceId);
    if (!id || seen.has(id) || !placementItemId || !graphicResourceId) continue;
    seen.add(id);
    const allowedMapIds = uniqueIds(raw.allowedMapIds, SPATIAL_DEFINITION_LIMIT);
    const allowedOrientations = uniqueOrientations(raw.allowedOrientations);
    result.push({
      id,
      name: cleanText(raw.name) ?? id,
      placementItemId,
      footprint: normalizeFootprint(raw.footprint),
      blocksMovement: raw.blocksMovement !== false,
      allowedOrientations: allowedOrientations.length > 0 ? allowedOrientations : ["down"],
      graphicResourceId,
      ...normalizeOrientationGraphics(raw.orientationGraphicResourceIds),
      ...(allowedMapIds.length > 0 ? { allowedMapIds } : {}),
    });
  }
  return result;
}

export function normalizeFarmBuildingPlacements(value: unknown): FarmBuildingPlacement[] | undefined {
  return normalizePlacements(value, true) as FarmBuildingPlacement[] | undefined;
}

export function normalizeHomeDecorationPlacements(value: unknown): HomeDecorationPlacement[] | undefined {
  return normalizePlacements(value, false) as HomeDecorationPlacement[] | undefined;
}

export function placementRecord<T extends FarmBuildingPlacement | HomeDecorationPlacement>(
  placements: readonly T[] | undefined,
): Record<string, T> | undefined {
  if (placements === undefined) return undefined;
  return Object.fromEntries(placements.map((placement) => [placement.instanceId, structuredClone(placement)]));
}

function normalizeBuildingLevels(value: unknown): FarmBuildingLevelDefinition[] {
  if (!Array.isArray(value)) return [];
  const result: FarmBuildingLevelDefinition[] = [];
  for (const raw of value.slice(0, SPATIAL_LEVEL_LIMIT)) {
    if (!isRecord(raw) || raw.level !== result.length + 1) break;
    const graphicResourceId = cleanId(raw.graphicResourceId);
    if (!graphicResourceId) break;
    const cost = normalizeCost(raw.cost);
    if (raw.animalCapacity !== undefined && (!Number.isSafeInteger(raw.animalCapacity)
      || (raw.animalCapacity as number) < 0 || (raw.animalCapacity as number) > SPATIAL_CAPACITY_MAX)) throw new Error("Invalid animalCapacity");
    result.push({
      level: result.length + 1,
      ...(cleanText(raw.name) ? { name: cleanText(raw.name) } : {}),
      footprint: normalizeFootprint(raw.footprint),
      capacity: clampSafeInteger(raw.capacity, 1, SPATIAL_CAPACITY_MAX),
      ...(raw.animalCapacity !== undefined ? { animalCapacity: raw.animalCapacity as number } : {}),
      ...(cost ? { cost } : {}),
      graphicResourceId,
      ...normalizeOrientationGraphics(raw.orientationGraphicResourceIds),
    });
  }
  return result;
}

function normalizeCost(value: unknown): SpatialPlacementCost | undefined {
  if (!isRecord(value)) return undefined;
  const gold = value.gold === undefined ? undefined : clampSafeInteger(value.gold, 0, GOLD_MAX);
  const items = normalizeItemAmounts(value.items);
  if (gold === undefined && items.length === 0) return undefined;
  return { ...(gold !== undefined ? { gold } : {}), ...(items.length > 0 ? { items } : {}) };
}

function normalizeItemAmounts(value: unknown): ItemAmount[] {
  if (!Array.isArray(value)) return [];
  const totals = new Map<string, number>();
  for (const raw of value.slice(0, SPATIAL_COST_ITEM_LIMIT)) {
    if (!isRecord(raw)) continue;
    const itemId = cleanId(raw.itemId);
    if (!itemId) continue;
    const count = clampSafeInteger(raw.count, 1, ITEM_QUANTITY_MAX);
    const next = (totals.get(itemId) ?? 0) + count;
    totals.set(itemId, Math.min(ITEM_QUANTITY_MAX, next));
  }
  return [...totals].map(([itemId, count]) => ({ itemId, count }));
}

function normalizePlacements(value: unknown, building: boolean): Array<FarmBuildingPlacement | HomeDecorationPlacement> | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: Array<FarmBuildingPlacement | HomeDecorationPlacement> = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (result.length >= SPATIAL_PLACEMENT_LIMIT) break;
    if (!isRecord(raw)) continue;
    const instanceId = cleanId(raw.instanceId);
    const typeId = cleanId(raw.typeId);
    const mapId = cleanId(raw.mapId);
    if (!instanceId || seen.has(instanceId) || !typeId || !mapId || !isSpatialOrientation(raw.orientation)) continue;
    seen.add(instanceId);
    const base = {
      instanceId,
      typeId,
      mapId,
      x: safeIntegerOr(raw.x, 0),
      y: safeIntegerOr(raw.y, 0),
      orientation: raw.orientation,
    };
    result.push(building
      ? { ...base, level: clampSafeInteger(raw.level, 1, SPATIAL_LEVEL_LIMIT) }
      : base);
  }
  return result;
}

function normalizeFootprint(value: unknown): SpatialFootprint {
  const width = clampSafeInteger(isRecord(value) ? value.width : undefined, 1, SPATIAL_FOOTPRINT_AXIS_MAX);
  const heightMax = Math.min(SPATIAL_FOOTPRINT_AXIS_MAX, Math.max(1, Math.floor(SPATIAL_FOOTPRINT_TILE_MAX / width)));
  return {
    width,
    height: clampSafeInteger(isRecord(value) ? value.height : undefined, 1, heightMax),
  };
}

function normalizeOrientationGraphics(value: unknown): Pick<FarmBuildingLevelDefinition, "orientationGraphicResourceIds"> {
  if (!isRecord(value)) return {};
  const entries = SPATIAL_ORIENTATIONS.flatMap((orientation) => {
    const id = cleanId(value[orientation]);
    return id ? [[orientation, id] as const] : [];
  });
  return entries.length > 0 ? { orientationGraphicResourceIds: Object.fromEntries(entries) } : {};
}

function uniqueOrientations(value: unknown): Dir[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSpatialOrientation))];
}

function uniqueIds(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => cleanId(entry) ? [cleanId(entry)!] : []))].slice(0, limit);
}

function clampSafeInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeIntegerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}

function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
