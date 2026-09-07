import { GOLD_MAX } from "@/project/economyValues";
import { isItemQuantity, ITEM_QUANTITY_MAX, type ItemQuantityOperation } from "@/project/itemQuantities";
import { changeItemsAtomically, type HomeDecorationPlacementState, type PlaySession, type SpatialPaymentReceipt } from "@/project/session";
import { reconcileLinkedAnimalHousing } from "./animalHousing";
import { isDecorationRecoveryItem, isSpatialPaymentReceipt } from "./lifeRecovery";
import { canPlaceSpatialFootprint, type SpatialLiveContextReader } from "@/project/spatialOccupancy";
import {
  isSpatialFootprint,
  isSpatialOrientation,
  SPATIAL_COST_ITEM_LIMIT,
  SPATIAL_PLACEMENT_LIMIT,
} from "@/project/spatialPlacements";
import type {
  Dir,
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

export function placeFarmBuilding(project: Project, session: PlaySession, input: NewSpatialPlacement, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const types = project.database.farmBuildingTypes ?? [];
  const type = types.find((entry) => entry.id === input.typeId);
  const firstLevel = type?.levels.find((entry) => entry.level === 1);
  if (!type || !firstLevel || !validPlacementInput(input) || !isSpatialFootprint(firstLevel.footprint)) return invalid();
  if (type.animalHousing && !validAnimalCapacity(firstLevel.animalCapacity)) return invalid();
  const placements = session.farmBuildingPlacements ?? {};
  if (Object.keys(placements).length >= SPATIAL_PLACEMENT_LIMIT || placements[input.instanceId]) return invalid();
  if (!mapAllowed(type.allowedMapIds, input.mapId)) return invalid();
  if (!canPlaceSpatialFootprint(project, session, input, firstLevel.footprint, readLive)) return blocked();
  const payment = preflightCost(project, session, firstLevel.cost);
  if (!payment.ok) return payment.result;

  const paymentReceipt = addPaymentReceipt(undefined, firstLevel.cost);
  if (!paymentReceipt) return invalid();
  const placement = { ...placementFields(input), level: 1, paymentReceipt };
  return commitWithInventory(session, payment.operations, () => {
    session.gold = payment.nextGold;
    session.farmBuildingPlacements = { ...placements, [input.instanceId]: placement };
  });
}

export function moveFarmBuilding(project: Project, session: PlaySession, instanceId: string, mapId: string, x: number, y: number, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const placement = session.farmBuildingPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
  const level = type?.levels.find((entry) => entry.level === placement.level);
  if (!type || !level || !validCoordinates(mapId, x, y) || !mapAllowed(type.allowedMapIds, mapId)) return invalid();
  const next = { ...placement, mapId, x, y };
  if (!canPlaceSpatialFootprint(project, session, next, level.footprint, readLive, { kind: "farmBuilding", instanceId })) return blocked();
  const draft = { ...session, farmBuildingPlacements: { ...session.farmBuildingPlacements, [instanceId]: next } };
  draft.farmAnimals = reconcileLinkedAnimalHousing(project, draft, draft.farmAnimals);
  Object.assign(session, draft);
  return success();
}

export function upgradeFarmBuilding(project: Project, session: PlaySession, instanceId: string, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const placement = session.farmBuildingPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
  const level = type?.levels.find((entry) => entry.level === placement.level + 1);
  if (!type || !level || !isSpatialFootprint(level.footprint)) return missing();
  if (type.animalHousing && !validAnimalCapacity(level.animalCapacity)) return invalid();
  if (!canPlaceSpatialFootprint(project, session, placement, level.footprint, readLive, { kind: "farmBuilding", instanceId })) return blocked();
  const payment = preflightCost(project, session, level.cost);
  if (!payment.ok) return payment.result;
  const paymentReceipt = addPaymentReceipt(placement.paymentReceipt, level.cost);
  if (!paymentReceipt) return invalid();
  const draft = structuredClone(session);
  draft.farmBuildingPlacements = { ...draft.farmBuildingPlacements, [instanceId]: { ...placement, level: level.level, paymentReceipt } };
  draft.farmAnimals = reconcileLinkedAnimalHousing(project, draft, draft.farmAnimals);
  if (!changeItemsAtomically(draft, payment.operations)) return invalid();
  draft.gold = payment.nextGold;
  Object.assign(session, draft);
  return success();
}

export function removeFarmBuilding(session: PlaySession, instanceId: string): SpatialMutationResult {
  const placement = session.farmBuildingPlacements?.[instanceId];
  if (!placement) return missing();
  const draft = structuredClone(session);
  // Voluntary demolition is nonrefundable and independent of recovery capacity.
  delete draft.farmBuildingPlacements![instanceId];
  if (draft.farmAnimals) draft.farmAnimals = Object.fromEntries(Object.entries(draft.farmAnimals).map(([id, animal]) => {
    if (animal.housingPlacementId !== instanceId) return [id, animal];
    const { housingPlacementId: _removed, ...unassigned } = animal;
    return [id, unassigned];
  }));
  Object.assign(session, draft);
  return success();
}

function validAnimalCapacity(value: number | undefined): boolean {
  return Number.isSafeInteger(value) && value! >= 0 && value! <= 9999;
}

function addPaymentReceipt(previous: SpatialPaymentReceipt | undefined, cost: SpatialPlacementCost | undefined): SpatialPaymentReceipt | undefined {
  if (previous !== undefined && !isSpatialPaymentReceipt(previous)) return undefined;
  // The new cost already passed per-transaction preflight. History has cumulative bounds.
  const totals = new Map((previous?.items ?? []).map(({ itemId, count }) => [itemId, count]));
  for (const { itemId, count } of cost?.items ?? []) totals.set(itemId, (totals.get(itemId) ?? 0) + count);
  const items = [...totals].map(([itemId, count]) => ({ itemId, count }));
  const receipt = { gold: (previous?.gold ?? 0) + (cost?.gold ?? 0), items };
  return isSpatialPaymentReceipt(receipt) ? receipt : undefined;
}

export function placeHomeDecoration(project: Project, session: PlaySession, input: NewSpatialPlacement, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === input.typeId);
  if (!type || !validPlacementInput(input) || !isSpatialFootprint(type.footprint)) return invalid();
  const placements = session.homeDecorationPlacements ?? {};
  if (Object.keys(placements).length >= SPATIAL_PLACEMENT_LIMIT || placements[input.instanceId]) return invalid();
  if (!type.allowedOrientations.includes(input.orientation) || !mapAllowed(type.allowedMapIds, input.mapId)) return invalid();
  if (!project.database.items.some((entry) => entry.id === type.placementItemId)) return invalid();
  if (!canPlaceSpatialFootprint(project, session, input, type.footprint, readLive, undefined, type.blocksMovement)) return blocked();
  if (!hasItems(session, [{ itemId: type.placementItemId, count: 1 }])) return insufficientOrInvalid(session.inventory[type.placementItemId]);
  const placement: HomeDecorationPlacementState = { ...placementFields(input), recoveryItem: { itemId: type.placementItemId, count: 1 } };
  return commitWithInventory(session, [{ itemId: type.placementItemId, op: "-=", amount: 1 }], () => {
    session.homeDecorationPlacements = { ...placements, [input.instanceId]: placement };
  });
}

export function moveHomeDecoration(project: Project, session: PlaySession, instanceId: string, mapId: string, x: number, y: number, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (!type || !validCoordinates(mapId, x, y) || !mapAllowed(type.allowedMapIds, mapId)) return invalid();
  const next = { ...placement, mapId, x, y };
  if (!canPlaceSpatialFootprint(project, session, next, type.footprint, readLive, { kind: "homeDecoration", instanceId }, type.blocksMovement)) return blocked();
  session.homeDecorationPlacements = { ...session.homeDecorationPlacements, [instanceId]: next };
  return success();
}

export function rotateHomeDecoration(project: Project, session: PlaySession, instanceId: string, orientation: Dir, readLive?: SpatialLiveContextReader): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (!type || !isSpatialOrientation(orientation) || !type.allowedOrientations.includes(orientation)) return invalid();
  const next = { ...placement, orientation };
  if (!canPlaceSpatialFootprint(project, session, next, type.footprint, readLive, { kind: "homeDecoration", instanceId }, type.blocksMovement)) return blocked();
  session.homeDecorationPlacements = { ...session.homeDecorationPlacements, [instanceId]: next };
  return success();
}

export function removeHomeDecoration(project: Project, session: PlaySession, instanceId: string): SpatialMutationResult {
  const placement = session.homeDecorationPlacements?.[instanceId];
  if (!placement) return missing();
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  if (placement.recoveryItem !== undefined && !isDecorationRecoveryItem(placement.recoveryItem)) return invalid();
  // Keep the existing ordinary legacy reclaim path; recovery cancellation never infers it.
  const itemId = placement.recoveryItem?.itemId ?? type?.placementItemId;
  if (!itemId || !project.database.items.some((entry) => entry.id === itemId)) return invalid();
  const current = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(current)) return invalid();
  if (current >= ITEM_QUANTITY_MAX) return { ok: false, reason: "overflow" };
  return commitWithInventory(session, [{ itemId, op: "+=", amount: 1 }], () => {
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

// Whitelist persistent fields: structurally typed callers can carry extra scene data.
function placementFields(input: NewSpatialPlacement): NewSpatialPlacement {
  const { instanceId, typeId, mapId, x, y, orientation } = input;
  return { instanceId, typeId, mapId, x, y, orientation };
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
