import { isPassableLanding } from "@/project/collision";
import { assertNever, own, resolveOccurrencePortId } from "@/project/spatial/domain";
import type { SpatialAssociatedOccurrence, SpatialPoint, SpatialRect } from "@/project/spatial/types";
import type { GameMap, Project, SectionStructureKitDef } from "@/project/types";
import { interiorObjectFromKit } from "../interiorRoomVocab";
import { SpatialCompileError, type CompiledObject, type SpatialCompileContext, type SpatialRasterProposal, type SpatialStampTarget } from "./compilerTypes";

export function containsPoint(rect: SpatialRect, point: SpatialPoint): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

/** Feed the established vocabulary adapter ONLY frozen rows; never read a live kit or catalog. */
export function frozenObject(occurrence: SpatialAssociatedOccurrence) {
  switch (occurrence.kind) {
    case "object": break;
    case "space": case "place": case "region": case "world": throw new SpatialCompileError("kind", occurrence.id);
    default: return assertNever(occurrence);
  }
  const design = own(occurrence.snapshot.library.objects, occurrence.source.id);
  const raster = own(occurrence.snapshot.kitCells, design.id);
  const cells = new Map(raster.cells.map(cell => [`${cell.x},${cell.y},${cell.layer}`, cell.tile]));
  const rows = Array.from({ length: raster.height }, (_, y) => ({
    tiles: Array.from({ length: raster.width }, (_, x) => cells.get(`${x},${y},lower`) ?? -1),
    upperTiles: Array.from({ length: raster.width }, (_, x) => cells.get(`${x},${y},upper`) ?? -1),
  }));
  const kit: SectionStructureKitDef = { id: raster.interior?.id ?? occurrence.id, kind: "section", name: design.name,
    width: raster.width, height: raster.height, rows, learnedFrom: "db-authored",
    ...(raster.interior ? {ai: {description: "", placementRules: "", snap: raster.interior.snap, interiorRole: raster.interior.role}} : {}) };
  return { design, raster, object: interiorObjectFromKit(kit) };
}

/** Logical anchor coordinates are translated once, never snapped to a nearby open tile. */
export function objectPorts(object: CompiledObject) {
  return object.occurrence.snapshot.ports.map(port => ({
    portId: resolveOccurrencePortId(object.occurrence, port.localPortId), x: object.origin.x + port.x, y: object.origin.y + port.y,
  }));
}

export function placedObject(occurrence: SpatialAssociatedOccurrence, origin: SpatialPoint, required: boolean, wallMounted = false): CompiledObject {
  const { design, raster } = frozenObject(occurrence);
  const left = Math.min(0, ...occurrence.snapshot.ports.map(port => port.x));
  const top = Math.min(0, ...occurrence.snapshot.ports.map(port => port.y));
  const width = Math.max(raster.width, ...occurrence.snapshot.ports.map(port => port.x + 1)) - left;
  const height = Math.max(raster.height, ...occurrence.snapshot.ports.map(port => port.y + 1)) - top;
  return { occurrence, origin, rect: { x: origin.x + left, y: origin.y + top, width, height }, placement: {
    roomId: occurrence.parentId ?? occurrence.id, thingId: occurrence.id, objectId: occurrence.id,
    label: design.name, chips: design.chips, required,
    cells: raster.cells.map(cell => ({ ...cell, x: origin.x + cell.x, y: origin.y + cell.y })),
    anchor: { x: origin.x + Math.floor(raster.width / 2), y: origin.y + (wallMounted ? Math.max(2, raster.height - 1) : raster.height - 1) },
  } };
}

/** Mutates only the compiler's detached raster after preflight of the entire assembly. */
export function stampFrozenObject(context: { readonly project: Project; readonly map: GameMap; readonly area: SpatialRect; readonly upperWallCells?: ReadonlySet<string> },
  object: CompiledObject, previous?: CompiledObject): void {
  const { raster } = frozenObject(object.occurrence);
  const { map, project, area } = context;
  if (raster.tilesetId !== map.tilesetId) throw new SpatialCompileError("atlas", object.occurrence.id);
  const extent = { x: object.rect.x + object.rect.width - 1, y: object.rect.y + object.rect.height - 1 };
  if (!containsPoint(area, object.rect) || !containsPoint(area, extent)) throw new SpatialCompileError("clipped", object.occurrence.id);
  const oldCells = previous?.placement.cells ?? [];
  const oldPoints = new Set(oldCells.map(cell => `${cell.x},${cell.y}`));
  const oldUpper = new Set(oldCells.filter(cell => cell.layer === "upper").map(cell => `${cell.x},${cell.y}`));
  for (const cell of oldCells) {
    const i = cell.y * map.width + cell.x;
    const tile = cell.layer === "lower" ? map.lowerTiles[i] : map.upperTiles[i];
    if (!containsPoint(area, cell) || tile !== cell.tile) throw new SpatialCompileError("ownership", object.occurrence.id);
  }
  for (const cell of [...oldCells, ...object.placement.cells]) {
    const i = cell.y * map.width + cell.x;
    const point = `${cell.x},${cell.y}`;
    if ((!oldPoints.has(point) && !isPassableLanding(project, map, cell.x, cell.y)
        && !(cell.layer === "upper" && context.upperWallCells?.has(point)))
      || (map.upperTiles[i] !== -1 && !oldUpper.has(point))
      || map.lowerTileStacks?.[i]?.length || map.upperTileStacks?.[i]?.length
      || map.events.some(event => event.x === cell.x && event.y === cell.y)) {
      throw new SpatialCompileError("blocked", `${object.occurrence.id}@${cell.x},${cell.y}`);
    }
  }
  // No underlay is stored: erase only the old graphic's exact layer cells, never its reservation.
  for (const cell of [...oldCells.map(cell => ({ ...cell, tile: -1 })), ...object.placement.cells]) {
    const i = cell.y * map.width + cell.x;
    switch (cell.layer) {
      case "lower": map.lowerTiles[i] = cell.tile; break;
      case "upper": map.upperTiles[i] = cell.tile; break;
      default: assertNever(cell.layer);
    }
  }
}

export function compileObjects(context: SpatialCompileContext, target: SpatialStampTarget): SpatialRasterProposal {
  const map = structuredClone(own(context.project.maps, target.mapId));
  const mapRect = { x: 0, y: 0, width: map.width, height: map.height };
  if (!containsPoint(mapRect, target.rect) || !containsPoint(mapRect, {
    x: target.rect.x + target.rect.width - 1, y: target.rect.y + target.rect.height - 1,
  })) throw new SpatialCompileError("clipped", target.mapId);
  const object = placedObject(context.occurrence, target.rect, true);
  stampFrozenObject({ project: context.project, map, area: target.rect }, object);
  return { map, entry: target.entry, rect: target.rect, objects: [object], ports: objectPorts(object), omitted: [] };
}
