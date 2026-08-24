import { GOLD_MAX } from "@/project/economyValues";
import { isItemQuantity, ITEM_QUANTITY_MAX, type ItemQuantityOperation } from "@/project/itemQuantities";
import { changeItemsAtomically, type PlaySession } from "@/project/session";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import {
  isSpatialFootprint,
  isSpatialOrientation,
  SPATIAL_COST_ITEM_LIMIT,
  SPATIAL_PLACEMENT_LIMIT,
} from "@/project/spatialPlacements";
import type {
  Dir,
  FarmBuildingPlacement,
  HomeDecorationPlacement,
  Project,
  SpatialPlacementCost,
} from "@/project/types";

export type SpatialMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid" | "missing" | "blocked" | "insufficient" | "overflow" };

export type NewSpatialPlacement = {
  readonly instanceId: string;
  readonly typeId: string;
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly orientation: Dir;
};

export function placeFarmBuilding(project: Project, session: PlaySession, input: NewSpatialPlacement): SpatialMutationResult {
  const types = project.database.farmBuildingTypes ?? [];
  const type = types.find((entry) => entry.id === input.typeId);
  const firstLevel = type?.levels.find((entry) => entry.level === 1);
  if (!type || !firstLevel || !validPlacementInput(input) || !isSpatialFootprint(firstLevel.footprint)) return invalid();
  const placements = session.farmBuildingPlacements ?? {};
  if (Object.keys(placements).length >= SPATIAL_PLACEMENT_LIMIT || placements[input.instanceId]) return invalid();
  if (!mapAllowed(type.allowedMapIds, input.mapId)) return invalid();
  if (!canOccupySpatialFootprint(project, session, input, firstLevel.footprint)) return blocked();
  const payment = preflightCost(project, session, firstLevel.cost);
  if (!payment.ok) return payment.result;

  const placement: FarmBuildingPlacement = { ...input, level: 1 };
  return commitWithInventory(session, payment.operations, () => {
    session.gold = payment.nextGold;
    session.farmBuildingPlacements = { ...placements, [input.instanceId]: placement };
  });
}

export function moveFarmBuilding(project: Project, session: PlaySession, instanceId: string, mapId: string, x: number, y: number): SpatialMutationResult {
  const placement = session.farmBuildingPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
  const level = type?.levels.find((entry) => entry.level === placement.level);
  if (!type || !level || !validCoordinates(mapId, x, y) || !mapAllowed(type.allowedMapIds, mapId)) return invalid();
  const next = { ...placement, mapId, x, y };
  if (!canOccupySpatialFootprint(project, session, next, level.footprint, { kind: "farmBuilding", instanceId })) return blocked();
  session.farmBuildingPlacements = { ...session.farmBuildingPlacements, [instanceId]: next };
  return success();
}

export function upgradeFarmBuilding(project: Project, session: PlaySession, instanceId: string): SpatialMutationResult {
  const placement = session.farmBuildingPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
  const level = type?.levels.find((entry) => entry.level === placement.level + 1);
  if (!type || !level || !isSpatialFootprint(level.footprint)) return missing();
  if (!canOccupySpatialFootprint(project, session, placement, level.footprint, { kind: "farmBuilding", instanceId })) return blocked();
  const payment = preflightCost(project, session, level.cost);
  if (!payment.ok) return payment.result;
  return commitWithInventory(session, payment.operations, () => {
    session.gold = payment.nextGold;
    session.farmBuildingPlacements = {
      ...session.farmBuildingPlacements,
      [instanceId]: { ...placement, level: level.level },
    };
  });
}

export function removeFarmBuilding(session: PlaySession, instanceId: string): SpatialMutationResult {
  if (!session.farmBuildingPlacements?.[instanceId]) return missing();
  const next = { ...session.farmBuildingPlacements };
  delete next[instanceId];
  session.farmBuildingPlacements = next;
  return success();
}

export function placeHomeDecoration(project: Project, session: PlaySession, input: NewSpatialPlacement): SpatialMutationResult {
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === input.typeId);
  if (!type || !validPlacementInput(input) || !isSpatialFootprint(type.footprint)) return invalid();
  const placements = session.homeDecorationPlacements ?? {};
  if (Object.keys(placements).length >= SPATIAL_PLACEMENT_LIMIT || placements[input.instanceId]) return invalid();
  if (!type.allowedOrientations.includes(input.orientation) || !mapAllowed(type.allowedMapIds, input.mapId)) return invalid();
  if (!project.database.items.some((entry) => entry.id === type.placementItemId)) return invalid();
  if (!canOccupySpatialFootprint(project, session, input, type.footprint)) return blocked();
  if (!hasItems(session, [{ itemId: type.placementItemId, count: 1 }])) return insufficientOrInvalid(session.inventory[type.placementItemId]);
  const placement: HomeDecorationPlacement = { ...input };
  return commitWithInventory(session, [{ itemId: type.placementItemId, op: "-=", amount: 1 }], () => {
    session.homeDecorationPlacements = { ...placements, [input.instanceId]: placement };
  });
}

export function moveHomeDecoration(project: Project, session: PlaySession, instanceId: string, mapId: string, x: number, y: number): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (!type || !validCoordinates(mapId, x, y) || !mapAllowed(type.allowedMapIds, mapId)) return invalid();
  const next = { ...placement, mapId, x, y };
  if (!canOccupySpatialFootprint(project, session, next, type.footprint, { kind: "homeDecoration", instanceId })) return blocked();
  session.homeDecorationPlacements = { ...session.homeDecorationPlacements, [instanceId]: next };
  return success();
}

export function rotateHomeDecoration(project: Project, session: PlaySession, instanceId: string, orientation: Dir): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (!type || !isSpatialOrientation(orientation) || !type.allowedOrientations.includes(orientation)) return invalid();
  const next = { ...placement, orientation };
  if (!canOccupySpatialFootprint(project, session, next, type.footprint, { kind: "homeDecoration", instanceId })) return blocked();
  session.homeDecorationPlacements = { ...session.homeDecorationPlacements, [instanceId]: next };
  return success();
}

export function removeHomeDecoration(project: Project, session: PlaySession, instanceId: string): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (!type || !project.database.items.some((entry) => entry.id === type.placementItemId)) return invalid();
  const current = session.inventory[type.placementItemId] ?? 0;
  if (!isItemQuantity(current)) return invalid();
  if (current >= ITEM_QUANTITY_MAX) return { ok: false, reason: "overflow" };
  return commitWithInventory(session, [{ itemId: type.placementItemId, op: "+=", amount: 1 }], () => {
    const next = { ...session.homeDecorationPlacements };
    delete next[instanceId];
    session.homeDecorationPlacements = next;
  });
}

type CostPreflight =
  | { readonly ok: true; readonly nextGold: number; readonly operations: ItemQuantityOperation[] }
  | { readonly ok: false; readonly result: SpatialMutationResult };

function preflightCost(project: Project, session: PlaySession, cost: SpatialPlacementCost | undefined): CostPreflight {
  if (!Number.isSafeInteger(session.gold) || session.gold < 0 || session.gold > GOLD_MAX) {
    return { ok: false, result: invalid() };
  }
  const gold = cost?.gold ?? 0;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > GOLD_MAX) return { ok: false, result: invalid() };
  if (session.gold < gold) return { ok: false, result: { ok: false, reason: "insufficient" } };
  const items = aggregateCosts(cost?.items);
  if (!items) return { ok: false, result: invalid() };
  if (items.some((entry) => !project.database.items.some((item) => item.id === entry.itemId))) {
    return { ok: false, result: invalid() };
  }
  if (!hasItems(session, items)) {
    const poisoned = items.some((entry) => !isItemQuantity(session.inventory[entry.itemId] ?? 0));
    return { ok: false, result: poisoned ? invalid() : { ok: false, reason: "insufficient" } };
  }
  return {
    ok: true,
    nextGold: session.gold - gold,
    operations: items.map((entry) => ({ itemId: entry.itemId, op: "-=", amount: entry.count })),
  };
}

function aggregateCosts(items: SpatialPlacementCost["items"]): Array<{ itemId: string; count: number }> | undefined {
  if (!items) return [];
  if (!Array.isArray(items) || items.length > SPATIAL_COST_ITEM_LIMIT) return undefined;
  const totals = new Map<string, number>();
  for (const entry of items) {
    if (!entry || typeof entry.itemId !== "string" || !entry.itemId.trim() || !isItemQuantity(entry.count) || entry.count < 1) return undefined;
    const next = (totals.get(entry.itemId) ?? 0) + entry.count;
    if (!isItemQuantity(next)) return undefined;
    totals.set(entry.itemId, next);
  }
  return [...totals].map(([itemId, count]) => ({ itemId, count }));
}

function hasItems(session: PlaySession, items: readonly { itemId: string; count: number }[]): boolean {
  return items.every((entry) => {
    const current = session.inventory[entry.itemId] ?? 0;
    return isItemQuantity(current) && current >= entry.count;
  });
}

function commitWithInventory(
  session: PlaySession,
  operations: readonly ItemQuantityOperation[],
  commit: () => void,
): SpatialMutationResult {
  if (operations.length > 0 && !changeItemsAtomically(session, operations)) return invalid();
  commit();
  return success();
}

function mapAllowed(allowedMapIds: readonly string[] | undefined, mapId: string): boolean {
  return !allowedMapIds || allowedMapIds.length === 0 || allowedMapIds.includes(mapId);
}

function validPlacementInput(input: NewSpatialPlacement): boolean {
  return typeof input.instanceId === "string"
    && input.instanceId.trim().length > 0
    && typeof input.typeId === "string"
    && input.typeId.trim().length > 0
    && validCoordinates(input.mapId, input.x, input.y)
    && isSpatialOrientation(input.orientation);
}

function validCoordinates(mapId: string, x: number, y: number): boolean {
  return typeof mapId === "string" && mapId.trim().length > 0 && Number.isSafeInteger(x) && Number.isSafeInteger(y);
}

function insufficientOrInvalid(value: unknown): SpatialMutationResult {
  return isItemQuantity(value ?? 0) ? { ok: false, reason: "insufficient" } : invalid();
}

function success(): SpatialMutationResult { return { ok: true }; }
function invalid(): SpatialMutationResult { return { ok: false, reason: "invalid" }; }
function missing(): SpatialMutationResult { return { ok: false, reason: "missing" }; }
function blocked(): SpatialMutationResult { return { ok: false, reason: "blocked" }; }
