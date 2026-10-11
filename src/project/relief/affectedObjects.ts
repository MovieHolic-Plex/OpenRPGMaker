import { clearTileStack } from "@/project/mapOverlayTiles";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { footprintBounds, normalizeCharacterFootprint } from "@/project/footprint";
import { restoreStructurePlacementTiles, structurePlacementsOf } from "@/project/structurePlacements";
import type { GameMap, StructurePlacement } from "@/project/types";

export interface ReliefAffectedObjectResult {
  readonly structureCount: number;
  readonly doodadCount: number;
  readonly eventIds: readonly string[];
  readonly cells: readonly { readonly x: number; readonly y: number; readonly layer: "lower" | "upper" | "event" }[];
}

function rectTouchesChanged(rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }, changed: ReadonlySet<number>, width: number): boolean {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x >= 0 && x < width && y >= 0 && changed.has(y * width + x)) return true;
    }
  }
  return false;
}

function structureCells(placement: StructurePlacement, width: number, height: number): number[] {
  const cells: number[] = [];
  for (let y = placement.y; y < placement.y + placement.h; y += 1) {
    for (let x = placement.x; x < placement.x + placement.w; x += 1) {
      if (x >= 0 && y >= 0 && x < width && y < height) cells.push(y * width + x);
    }
  }
  return cells;
}

/**
 * Height edits are destructive to authored objects that occupy the edited ground.
 * Remove the complete owning object and restore the tiles underneath before the
 * relief writer applies its top-grass policy. This keeps a house or a prop group
 * from being left half embedded in a new cliff.
 */
export function clearReliefAffectedObjects(map: GameMap, changed: ReadonlySet<number>): ReliefAffectedObjectResult {
  if (changed.size === 0) return { structureCount: 0, doodadCount: 0, eventIds: [], cells: [] };
  const cells: { x: number; y: number; layer: "lower" | "upper" | "event" }[] = [];
  const structures = structurePlacementsOf(map);
  const affectedStructures = structures.filter((placement) => rectTouchesChanged(placement, changed, map.width));
  const affectedIds = new Set(affectedStructures.map((placement) => placement.id));
  const survivingOwners = new Map<number, number>();
  if (affectedStructures.length) for (let order = 0; order < structures.length; order += 1) {
    const placement = structures[order]!;
    if (affectedIds.has(placement.id)) continue;
    for (const index of structureCells(placement, map.width, map.height)) survivingOwners.set(index, order);
  }
  // Later placements own the visible overlap. Restore removed placements from
  // newest to oldest, while leaving cells still owned by a surviving placement.
  for (let i = structures.length - 1; i >= 0; i -= 1) {
    const placement = structures[i];
    if (!placement || !affectedIds.has(placement.id)) continue;
    const skipCells = new Set([...survivingOwners].filter(([, order]) => order > i).map(([index]) => index));
    restoreStructurePlacementTiles(map, placement, { skipCells });
    for (const index of structureCells(placement, map.width, map.height)) {
      cells.push({ x: index % map.width, y: Math.floor(index / map.width), layer: "lower" });
      cells.push({ x: index % map.width, y: Math.floor(index / map.width), layer: "upper" });
    }
  }
  if (affectedStructures.length) {
    const remaining = structures.filter((placement) => !affectedIds.has(placement.id));
    if (remaining.length) map.structurePlacements = remaining;
    else delete map.structurePlacements;
  }

  const affectedDoodads = (map.doodadGroups ?? []).filter((group) => group.cells.some((cell) => changed.has(cell.index)));
  if (affectedDoodads.length) {
    const doodadIds = new Set(affectedDoodads.map((group) => group.id));
    for (const group of [...affectedDoodads].reverse()) {
      for (const cell of group.cells) {
        if (layerTileAt(map, 3, cell.index) !== cell.tile) continue;
        setLayerTileAt(map, 3, cell.index, cell.before);
        cells.push({ x: cell.index % map.width, y: Math.floor(cell.index / map.width), layer: "upper" });
      }
    }
    const remaining = map.doodadGroups?.filter((group) => !doodadIds.has(group.id));
    if (remaining?.length) map.doodadGroups = remaining;
    else delete map.doodadGroups;
  }

  const eventIds: string[] = [];
  const remainingEvents = map.events.filter((event) => {
    const footprint = normalizeCharacterFootprint(event.pages?.[0]?.footprint);
    const rect = footprintBounds(event.x, event.y, footprint);
    let hit = false;
    for (let y = rect.top; y <= rect.bottom && !hit; y += 1) {
      for (let x = rect.left; x <= rect.right; x += 1) {
        if (x >= 0 && x < map.width && y >= 0 && y < map.height && changed.has(y * map.width + x)) { hit = true; break; }
      }
    }
    if (!hit) return true;
    eventIds.push(event.id);
    cells.push({ x: event.x, y: event.y, layer: "event" });
    return false;
  });
  if (remainingEvents.length !== map.events.length) map.events = remainingEvents;

  // Upper layers are the editor's untracked object surface. A height edit must
  // also remove a hand-painted prop that has no doodad/structure record.
  for (const index of changed) {
    if (index < 0 || index >= map.width * map.height) continue;
    const x = index % map.width, y = Math.floor(index / map.width);
    if (layerTileAt(map, 3, index) >= 0 || layerTileAt(map, 4, index) >= 0) {
      setLayerTileAt(map, 3, index, -1);
      setLayerTileAt(map, 4, index, -1);
      clearTileStack(map, "upper", index);
      cells.push({ x, y, layer: "upper" });
    }
  }
  return { structureCount: affectedStructures.length, doodadCount: affectedDoodads.length, eventIds, cells };
}
