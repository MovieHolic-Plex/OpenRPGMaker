import { compositionOf } from "@/project/spatial/composition";
import { designNode } from "@/project/spatial/domain";
import { mixedCompositionRaster, type MixedProjection } from "./mixedCompositionRaster";
import { assertNever, own, requireOccurrenceAssociations, resolveOccurrencePortId } from "@/project/spatial/domain";
import type { SpatialAssociatedOccurrence, SpatialPoint } from "@/project/spatial/types";
import type { GameMap } from "@/project/types";
import { compileSpaces } from "./compileSpaces";
import { compileObjectEvents, validateRasterAccess } from "./compilerValidation";
import { SpatialCompileError, type SpatialCompileContext, type SpatialRasterProposal } from "./compilerTypes";

export type PlaceSurface = {
  readonly occurrence: SpatialAssociatedOccurrence;
  readonly raster: SpatialRasterProposal;
  readonly world: SpatialPoint;
  readonly level: number;
  readonly outdoor: boolean;
  readonly projections?: readonly MixedProjection[];
};
export type PlacePosition = { readonly occurrence: SpatialAssociatedOccurrence; readonly world: SpatialPoint; readonly level: number };

/** Stored containment coordinates define planes. A distinct interior resets its raster origin. */
export function placeLayout(context: SpatialCompileContext) {
  const positions: PlacePosition[] = [{ occurrence: context.occurrence, world: { x: 0, y: 0 }, level: context.occurrence.level }];
  const surfaces: PlaceSurface[] = [];
  for (const position of positions) {
    const { occurrence } = position;
    const node = designNode(occurrence.snapshot.library, occurrence.source);
    if (compositionOf(node)) {
      const raster = mixedCompositionRaster({ ...context, occurrence });
      validateRasterAccess(context.project, { ...raster, ports: raster.projections.flatMap(projection => projection.ports) });
      compileObjectEvents(raster, new Set(context.document.connections.flatMap(link => [link.from.occurrenceId, link.to.occurrenceId])));
      surfaces.push({ ...position, raster, projections: raster.projections,
        outdoor: node.kind === "space" ? node.design.environment === "outdoor" : position.level === 0 });
      continue;
    }
    switch (occurrence.kind) {
      case "place": {
        const design = own(occurrence.snapshot.library.places, occurrence.source.id);
        for (const child of Object.values(context.document.occurrences).filter(child => child.parentId === occurrence.id)) {
          positions.push({ occurrence: requireOccurrenceAssociations(child),
            world: { x: position.world.x + child.x, y: position.world.y + child.y }, level: position.level + child.level });
        }
        if (!design.exterior) break;
        const frozen = own(occurrence.snapshot.kitCells, design.id);
        const map: GameMap = { id: `spatial:${occurrence.id}`, name: design.name, width: frozen.width, height: frozen.height,
          tilesetId: frozen.tilesetId, tileSize: own(context.project.tilesets, frozen.tilesetId).tileSize,
          lowerTiles: new Array<number>(frozen.width * frozen.height).fill(-1),
          upperTiles: new Array<number>(frozen.width * frozen.height).fill(-1), events: [] };
        // Parametric house exteriors have already crossed the frozen house-raster adapter.
        for (const cell of frozen.cells) {
          switch (cell.layer) {
            case "lower": map.lowerTiles[cell.y * map.width + cell.x] = cell.tile; break;
            case "upper": map.upperTiles[cell.y * map.width + cell.x] = cell.tile; break;
            default: assertNever(cell.layer);
          }
        }
        const ports = occurrence.snapshot.ports.map(port => ({ portId: resolveOccurrencePortId(occurrence, port.localPortId), x: port.x, y: port.y }));
        const entry = ports[0] ?? { x: 0, y: 0 };
        const raster: SpatialRasterProposal = { map, rect: { x: 0, y: 0, width: map.width, height: map.height }, entry,
          ports, objects: [], omitted: [] };
        if (ports.length) validateRasterAccess(context.project, raster);
        surfaces.push({ ...position, raster, outdoor: true });
        break;
      }
      case "space": {
        const raster = compileSpaces({ ...context, occurrence });
        validateRasterAccess(context.project, raster);
        compileObjectEvents(raster, new Set(context.document.connections.flatMap(link => [link.from.occurrenceId, link.to.occurrenceId])));
        const design = own(occurrence.snapshot.library.spaces, occurrence.source.id);
        surfaces.push({ ...position, raster, outdoor: design.environment === "outdoor" });
        break;
      }
      case "object": case "region": case "world": throw new SpatialCompileError("kind", occurrence.id);
      default: assertNever(occurrence);
    }
  }
  return { positions, surfaces };
}

/** A container port must resolve to exactly one painted, passable surface on its declared plane. */
export function projectedPlacePort(position: PlacePosition, surfaces: readonly PlaceSurface[], local: SpatialPoint) {
  const world = { x: position.world.x + local.x, y: position.world.y + local.y };
  const matches = surfaces.filter(surface => surface.level === position.level && surface.outdoor &&
    world.x >= surface.world.x && world.y >= surface.world.y && world.x < surface.world.x + surface.raster.rect.width &&
    world.y < surface.world.y + surface.raster.rect.height);
  const surface = matches[0];
  if (matches.length !== 1 || !surface) throw new SpatialCompileError("port", `${position.occurrence.id}@${local.x},${local.y}`);
  return { surface, world };
}
