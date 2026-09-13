import { HOUSE_SHELL_CREAM_FACE_TILES } from "@/project/defaults/interiorHouseWallTiles";
import { tilePassability } from "@/project/collision";
import { assertNever, findOccurrenceChildId, own, requireOccurrenceAssociations, resolveOccurrencePortId } from "@/project/spatial/domain";
import type { SpatialId } from "@/project/spatial/types";
import { parseConceptPlan } from "../conceptPlan";
import { composeConceptRoom } from "../interiorConceptCompose";
import type { InteriorObjectDef } from "../interiorObjectCatalog";
import { frozenObject, placedObject, stampFrozenObject } from "./compileObjects";
import { SpatialCompileError, type CompiledObject, type SpatialCompileContext, type SpatialRasterProposal } from "./compilerTypes";
import { spaceLayout } from "./spaceLayout";

/** Compiles stored occurrences, not a fresh expansion of either the live or frozen library. */
export function compileSpaces(context: SpatialCompileContext): SpatialRasterProposal {
  const { occurrence, document, project } = context;
  switch (occurrence.kind) {
    case "space": break;
    case "object": case "place": case "region": case "world": throw new SpatialCompileError("kind", occurrence.id);
    default: return assertNever(occurrence);
  }
  const space = own(occurrence.snapshot.library.spaces, occurrence.source.id);
  const layout = spaceLayout(project, space, { mapId: `spatial:${occurrence.id}`, seed: occurrence.seed });
  const { map, floor, room, entry } = layout;
  const rect = { x: 0, y: 0, width: map.width, height: map.height };
  const area = { x: room.x, y: room.y, width: room.w, height: room.h };
  const children = Object.values(document.occurrences).filter(child => child.parentId === occurrence.id).map(requireOccurrenceAssociations);
  const jobs = space.objectSlots.flatMap(slot => children
    .filter(child => child.parentSlot?.slotId === slot.id)
    .sort((a, b) => (a.parentSlot?.index ?? 0) - (b.parentSlot?.index ?? 0))
    .map(child => {
      if (!child.parentSlot) throw new SpatialCompileError("kind", child.id);
      const id = findOccurrenceChildId(document, occurrence.id, child.parentSlot);
      if (id !== child.id) throw new SpatialCompileError("kind", child.id);
      const frozen = frozenObject(child);
      if (frozen.raster.tilesetId !== map.tilesetId) throw new SpatialCompileError("atlas", child.id);
      // Nonzero actual coordinates override an auto slot's unplaced 0,0 placeholder.
      const placement = child.x !== 0 || child.y !== 0 ? { mode: "fixed" as const, x: child.x, y: child.y } : slot.placement;
      return { slot: { ...slot, placement }, wallOverlap: slot.placement.mode === "fixed" ? slot.placement.wallOverlap ?? 0 : 0, child, ...frozen };
    }));
  const objects: CompiledObject[] = [];
  const omitted: SpatialId[] = [];
  const available = [...floor];
  for (const job of jobs) {
    switch (job.slot.placement.mode) {
      case "auto": break;
      case "fixed": {
        const baseY = room.y + job.child.y;
        const object = placedObject(job.child, { x: room.x + job.child.x, y: baseY - job.wallOverlap }, job.slot.required);
        try {
          const upperWallCells = new Set<string>();
          if (job.wallOverlap) {
            if (space.environment !== "interior" || job.raster.height <= job.wallOverlap) throw new SpatialCompileError("clipped", job.child.id);
            for (const cell of object.placement.cells.filter(cell => cell.y < baseY)) {
              if (cell.layer !== "upper" || !HOUSE_SHELL_CREAM_FACE_TILES.includes(map.lowerTiles[cell.y * map.width + cell.x]!)
                || !floor[baseY * map.width + cell.x]
                || !object.placement.cells.some(base => base.x === cell.x && base.y >= baseY && floor[base.y * map.width + base.x])) throw new SpatialCompileError("blocked", `${job.child.id}: wall support`);
              upperWallCells.add(`${cell.x},${cell.y}`);
            }
            if (!upperWallCells.size) throw new SpatialCompileError("blocked", `${job.child.id}: no wall overlap`);
          }
          if (object.placement.cells.some(cell => !floor[cell.y * map.width + cell.x] && !upperWallCells.has(`${cell.x},${cell.y}`))) throw new SpatialCompileError("clipped", job.child.id);
          const stampArea = { ...area, y: area.y - job.wallOverlap, height: area.height + job.wallOverlap };
          stampFrozenObject({ project, map, area: stampArea, upperWallCells }, object);
          objects.push(object);
          for (const cell of object.placement.cells) available[cell.y * map.width + cell.x] = false;
        } catch (error) {
          if (!(error instanceof SpatialCompileError)) throw error;
          if (job.slot.required || job.child.snapshot.ports.length || !["blocked", "clipped"].includes(error.code)) throw error;
          omitted.push(job.child.id);
        }
        break;
      }
      default: assertNever(job.slot.placement);
    }
  }
  // Adapter-local symbols protect opaque persisted IDs from the legacy parser's trimming.
  const automatic = jobs.filter(job => job.slot.placement.mode === "auto").map((job, index) => ({ ...job, key: `object-${index}` }));
  const vocab = new Map<string, InteriorObjectDef>(automatic.map(job => [job.key, job.object]));
  // The existing concept parser owns chip semantics and the composer owns all automatic layout.
  const parsed = parseConceptPlan({ places: [{ id: "space", label: space.name, role: layout.role, shape: space.shape }],
    things: automatic.map(job => ({ id: job.key, objectId: job.key, label: job.design.name,
      placeIds: ["space"], chips: job.design.chips, required: job.slot.required })) },
  { bundleId: occurrence.id, facilityId: occurrence.id, facilityLabel: space.name, resolveObject: id => vocab.get(id) });
  const composed = composeConceptRoom({ map, floor: available, fullFloor: floor, room, roomId: occurrence.id,
    role: layout.role, protectedAnchors: objects.filter(o=>o.placement.required).map(o=>o.placement.anchor), door: entry, placeLabel: space.name, seed: occurrence.seed,
    things: parsed.bundle.things.map(thing => ({ thingId: thing.id, objectId: thing.objectId, label: thing.label, chips: thing.chips, required: thing.required === true })),
    resolveObject: id => vocab.get(id),
    isFloorTile: tile => {
      const passage = tilePassability(own(project.tilesets, map.tilesetId), tile, -1);
      return passage.up || passage.down || passage.left || passage.right;
    },
  });
  for (const job of automatic) {
    const placement = composed.placements.find(placement => placement.thingId === job.key);
    if (!placement) {
      if (job.slot.required || job.child.snapshot.ports.length) throw new SpatialCompileError("required", job.child.id);
      omitted.push(job.child.id);
      continue;
    }
    const cell = placement.cells[0];
    const local = job.object.cells[0];
    if (!cell || !local) throw new SpatialCompileError("raster", job.child.id);
    objects.push(placedObject(job.child, { x: cell.x - local.dx, y: cell.y - local.dy }, job.slot.required, job.object.snap === "wall-any"));
  }
  const ports = occurrence.snapshot.ports.map(port => ({ portId: resolveOccurrencePortId(occurrence, port.localPortId),
    x: room.x + port.x, y: room.y + port.y }));
  return { map, entry, rect, objects, ports, omitted };
}
