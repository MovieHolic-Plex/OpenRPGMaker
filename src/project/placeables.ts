// Opt-in session-backed chests / placeable markers (authoring tools for cozy/farm games).
import { changeItem, type PlaySession } from "@/project/session";
import type { ItemId, MapId } from "@/project/types";

export type ChestState = {
  readonly id: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  inventory: Record<string, number>;
};

export type PlaceableObjectState = {
  readonly id: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly kind: string;
  readonly itemId?: ItemId;
};

export function placeableKey(mapId: string, x: number, y: number): string {
  return `${mapId}:${Math.trunc(x)},${Math.trunc(y)}`;
}

export function ensureChest(
  session: PlaySession,
  chest: { id: string; mapId: MapId; x: number; y: number }
): ChestState {
  session.chests ??= {};
  const existing = session.chests[chest.id];
  if (existing) return existing;
  const created: ChestState = {
    id: chest.id,
    mapId: chest.mapId,
    x: Math.trunc(chest.x),
    y: Math.trunc(chest.y),
    inventory: {},
  };
  session.chests[chest.id] = created;
  return created;
}

export function depositToChest(
  session: PlaySession,
  chestId: string,
  itemId: ItemId,
  count: number
): boolean {
  const chest = session.chests?.[chestId];
  if (!chest) return false;
  const n = Math.max(0, Math.trunc(count));
  if (n <= 0) return false;
  if ((session.inventory[itemId] ?? 0) < n) return false;
  changeItem(session, itemId, "-=", n);
  chest.inventory[itemId] = (chest.inventory[itemId] ?? 0) + n;
  return true;
}

export function withdrawFromChest(
  session: PlaySession,
  chestId: string,
  itemId: ItemId,
  count: number
): boolean {
  const chest = session.chests?.[chestId];
  if (!chest) return false;
  const n = Math.max(0, Math.trunc(count));
  if (n <= 0) return false;
  if ((chest.inventory[itemId] ?? 0) < n) return false;
  const next = (chest.inventory[itemId] ?? 0) - n;
  if (next <= 0) delete chest.inventory[itemId];
  else chest.inventory[itemId] = next;
  changeItem(session, itemId, "+=", n);
  return true;
}

export function placeObject(
  session: PlaySession,
  object: PlaceableObjectState
): PlaceableObjectState {
  session.placeables ??= {};
  const key = placeableKey(object.mapId, object.x, object.y);
  const placed: PlaceableObjectState = {
    ...object,
    x: Math.trunc(object.x),
    y: Math.trunc(object.y),
  };
  session.placeables[key] = placed;
  return placed;
}

export function removeObjectAt(session: PlaySession, mapId: MapId, x: number, y: number): PlaceableObjectState | undefined {
  if (!session.placeables) return undefined;
  const key = placeableKey(mapId, x, y);
  const existing = session.placeables[key];
  if (!existing) return undefined;
  delete session.placeables[key];
  return existing;
}

export function findChestAt(session: PlaySession, mapId: MapId, x: number, y: number): ChestState | undefined {
  const chests = session.chests;
  if (!chests) return undefined;
  const tx = Math.trunc(x);
  const ty = Math.trunc(y);
  for (const chest of Object.values(chests)) {
    if (chest.mapId === mapId && chest.x === tx && chest.y === ty) return chest;
  }
  return undefined;
}

export function inventoryEntries(inventory: Record<string, number> | undefined): { itemId: ItemId; count: number }[] {
  if (!inventory) return [];
  return Object.entries(inventory)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([itemId, count]) => ({ itemId, count: Math.trunc(count) }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}
