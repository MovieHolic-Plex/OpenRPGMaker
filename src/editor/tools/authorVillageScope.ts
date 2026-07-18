import type { AuthorVillageRequest, ConstructionRect } from "@/editor/construction/contracts";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, MapTreeNode, Project, TileGraft, TilesetDef } from "@/project/types";
import type { VillageFacadeState } from "./authorVillageSupport";
import { ToolError } from "./types";

const INN_SIGN_GRAFT: TileGraft = {
  targetTile: 443,
  sourceChipset: "tex_easyrpg_chipset_retro_house",
  sourceTile: 443,
};

export function restoreExistingTargetStart(
  baseline: Project,
  draft: Project,
  request: AuthorVillageRequest,
): void {
  if (request.target.kind !== "existing") return;
  draft.startMapId = baseline.startMapId;
  draft.startPos = { ...baseline.startPos };
  const beforeMap = baseline.maps[baseline.startMapId];
  const afterMap = draft.maps[baseline.startMapId];
  if (!beforeMap || !afterMap || isPassable(draft, afterMap, baseline.startPos.x, baseline.startPos.y)) return;
  const index = baseline.startPos.y * afterMap.width + baseline.startPos.x;
  afterMap.lowerTiles[index] = beforeMap.lowerTiles[index] ?? TILE.GRASS;
  afterMap.upperTiles[index] = beforeMap.upperTiles[index] ?? TILE.EMPTY;
}

export function assertVillageMutationScope(state: VillageFacadeState): void {
  const allowedAdded = allowedAddedMapIds(state);
  assertMapSetAndContents(state, allowedAdded);
  assertMapTree(state, allowedAdded);
  assertStart(state);
  assertProjectCore(state);
  assertTilesets(state);
}

function allowedAddedMapIds(state: VillageFacadeState): ReadonlySet<string> {
  const { baseline, request, inspection } = state;
  const ids = new Set(inspection.interiorMapIds);
  if (request.target.kind === "new") ids.add(request.target.mapId);
  for (const id of inspection.interiorMapIds) {
    if (id === request.target.mapId || baseline.maps[id]) {
      scopeError(`Village declared a pre-existing map as an interior: ${id}.`, id);
    }
  }
  return ids;
}

function assertMapSetAndContents(state: VillageFacadeState, allowedAdded: ReadonlySet<string>): void {
  const { baseline, draft, request } = state;
  for (const [mapId, before] of Object.entries(baseline.maps)) {
    const after = draft.maps[mapId];
    if (!after) scopeError(`Village removed an undeclared map: ${mapId}.`, mapId);
    if (mapId !== request.target.mapId && !same(before, after)) {
      scopeError(`Village modified an undeclared map: ${mapId}.`, mapId);
    }
  }
  for (const mapId of Object.keys(draft.maps)) {
    if (!baseline.maps[mapId] && !allowedAdded.has(mapId)) {
      scopeError(`Village added an undeclared map: ${mapId}.`, mapId);
    }
  }
  const target = draft.maps[request.target.mapId];
  if (!target) scopeError(`Village target is missing: ${request.target.mapId}.`, request.target.mapId);
  if (request.target.kind === "existing") assertExistingTarget(state, target);
  for (const mapId of allowedAdded) assertEventsInMap(draft.maps[mapId], mapId);
}

function assertExistingTarget(state: VillageFacadeState, after: GameMap): void {
  const { baseline, request } = state;
  if (request.target.kind !== "existing") return;
  const before = baseline.maps[request.target.mapId];
  if (!before) scopeError(`Village target baseline is missing: ${request.target.mapId}.`, request.target.mapId);
  if (!same(mapDescriptor(before), mapDescriptor(after))) {
    scopeError("Village changed the target map descriptor.", after.id);
  }
  const bounds = request.target.bounds;
  if (bounds) assertTilesWithinBounds(before, after, bounds);
  assertChangedEventsWithinBounds(before, after, bounds ?? mapBounds(after));
  assertEventsInMap(after, after.id);
}

function assertTilesWithinBounds(before: GameMap, after: GameMap, bounds: ConstructionRect): void {
  for (let index = 0; index < after.lowerTiles.length; index += 1) {
    const x = index % after.width;
    const y = Math.floor(index / after.width);
    if (!contains(bounds, x, y)
      && (before.lowerTiles[index] !== after.lowerTiles[index] || before.upperTiles[index] !== after.upperTiles[index])) {
      throw new ToolError("Village wrote outside the requested bounds.", {
        code: "village-outside-bounds",
        mapId: after.id,
        x,
        y,
      });
    }
  }
}

function assertChangedEventsWithinBounds(before: GameMap, after: GameMap, bounds: ConstructionRect): void {
  const beforeEvents = new Map(before.events.map((event) => [event.id, event]));
  const afterEvents = new Map(after.events.map((event) => [event.id, event]));
  const ids = new Set([...beforeEvents.keys(), ...afterEvents.keys()]);
  for (const id of ids) {
    const oldEvent = beforeEvents.get(id);
    const newEvent = afterEvents.get(id);
    if (same(oldEvent, newEvent)) continue;
    if ((oldEvent && !contains(bounds, oldEvent.x, oldEvent.y))
      || (newEvent && !contains(bounds, newEvent.x, newEvent.y))) {
      scopeError(`Village changed event '${id}' outside the requested bounds.`, after.id);
    }
  }
}

function assertEventsInMap(map: GameMap | undefined, mapId: string): void {
  if (!map) scopeError(`Declared village map is missing: ${mapId}.`, mapId);
  for (const event of map.events) {
    if (!eventInMap(event, map)) scopeError(`Village event '${event.id}' is outside map bounds.`, mapId);
  }
}

function assertMapTree(state: VillageFacadeState, allowedAdded: ReadonlySet<string>): void {
  const { baseline, draft } = state;
  const baselineHasRoot = baseline.maps[baseline.mapTree.mapId] !== undefined;
  if (baselineHasRoot) {
    const retained = stripAddedNodes(draft.mapTree, allowedAdded);
    if (!retained || !same(retained, baseline.mapTree)) scopeError("Village changed the existing map tree.");
  } else {
    const undeclared = collectTreeIds(draft.mapTree).find((mapId) => !allowedAdded.has(mapId));
    if (undeclared) scopeError(`Village added an undeclared map-tree node: ${undeclared}.`, undeclared);
  }
  const treeIds = new Set(collectTreeIds(draft.mapTree));
  for (const mapId of allowedAdded) {
    if (!treeIds.has(mapId)) scopeError(`Village map is absent from the map tree: ${mapId}.`, mapId);
  }
}

function stripAddedNodes(node: MapTreeNode, added: ReadonlySet<string>): MapTreeNode | undefined {
  const children = node.children.flatMap((child) => {
    const retained = stripAddedNodes(child, added);
    return retained ? [retained] : child.children.flatMap((grandchild) => {
      const retainedGrandchild = stripAddedNodes(grandchild, added);
      return retainedGrandchild ? [retainedGrandchild] : [];
    });
  });
  return added.has(node.mapId) ? undefined : { mapId: node.mapId, children };
}

function assertStart(state: VillageFacadeState): void {
  const { baseline, draft, request } = state;
  if (request.target.kind === "new") {
    const target = draft.maps[request.target.mapId];
    const pointIsValid = target !== undefined
      && Number.isInteger(draft.startPos.x)
      && Number.isInteger(draft.startPos.y)
      && contains(mapBounds(target), draft.startPos.x, draft.startPos.y)
      && isPassable(draft, target, draft.startPos.x, draft.startPos.y);
    if (draft.startMapId !== request.target.mapId || !pointIsValid) {
      scopeError("Village placed the project start outside its new target.", draft.startMapId);
    }
    return;
  }
  if (draft.startMapId !== baseline.startMapId || !same(draft.startPos, baseline.startPos)) {
    scopeError("Village changed the existing project start.", draft.startMapId);
  }
}

function assertProjectCore(state: VillageFacadeState): void {
  if (!same(projectCore(state.baseline), projectCore(state.draft))) {
    scopeError("Village changed undeclared project data.");
  }
}

function assertTilesets(state: VillageFacadeState): void {
  const { baseline, draft, request } = state;
  const targetTilesetId = draft.maps[request.target.mapId]?.tilesetId;
  if (!same(Object.keys(baseline.tilesets).sort(), Object.keys(draft.tilesets).sort())) {
    scopeError("Village changed the tileset set.");
  }
  for (const [tilesetId, before] of Object.entries(baseline.tilesets)) {
    const after = draft.tilesets[tilesetId];
    if (!after) scopeError(`Village removed tileset '${tilesetId}'.`);
    if (tilesetId !== targetTilesetId && !same(before, after)) {
      scopeError(`Village changed undeclared tileset '${tilesetId}'.`);
    }
    if (tilesetId === targetTilesetId && !allowedTargetTilesetChange(before, after)) {
      scopeError(`Village changed undeclared target tileset data '${tilesetId}'.`);
    }
  }
}

function allowedTargetTilesetChange(before: TilesetDef, after: TilesetDef): boolean {
  const beforeGrafts = before.tileGrafts ?? [];
  const afterGrafts = after.tileGrafts ?? [];
  const canAppendInnSign = !beforeGrafts.some((graft) => graft.targetTile === INN_SIGN_GRAFT.targetTile);
  return same(tilesetCore(before), tilesetCore(after))
    && (same(beforeGrafts, afterGrafts) || (canAppendInnSign && same([...beforeGrafts, INN_SIGN_GRAFT], afterGrafts)));
}

function mapDescriptor(map: GameMap) {
  const { lowerTiles: _lower, upperTiles: _upper, events: _events, layoutPlan: _plan, ...descriptor } = map;
  return descriptor;
}

function projectCore(project: Project) {
  const { maps: _maps, mapTree: _tree, startMapId: _start, startPos: _pos, tilesets: _tilesets, ...core } = project;
  return core;
}

function tilesetCore(tileset: TilesetDef) {
  const { tileGrafts: _grafts, ...core } = tileset;
  return core;
}

function collectTreeIds(node: MapTreeNode): string[] {
  return [node.mapId, ...node.children.flatMap(collectTreeIds)];
}

function contains(bounds: ConstructionRect, x: number, y: number): boolean {
  return x >= bounds.x && y >= bounds.y && x < bounds.x + bounds.w && y < bounds.y + bounds.h;
}

function mapBounds(map: GameMap): ConstructionRect {
  return { x: 0, y: 0, w: map.width, h: map.height };
}

function eventInMap(event: GameEvent, map: GameMap): boolean {
  return Number.isInteger(event.x) && Number.isInteger(event.y) && contains(mapBounds(map), event.x, event.y);
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function scopeError(message: string, mapId?: string): never {
  throw new ToolError(message, { code: "village-scope-violation", ...(mapId ? { mapId } : {}) });
}
