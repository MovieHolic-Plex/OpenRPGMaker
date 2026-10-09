import { assertNever, findOccurrenceChildId, occurrencePortId, own, requireOccurrenceAssociations, spatialId, SpatialOperationError } from "@/project/spatial/domain";
import { resolveSpatialDesign, snapshotFor } from "@/project/spatial/resolve";
import type { SpatialAssociatedOccurrence, SpatialId, SpatialObjectSlot, SpatialParentSlot, SpatialPoint } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";

export class PlacedSpaceEditError extends Error {
  readonly name = "PlacedSpaceEditError";
  constructor(readonly code: "frozen-closure-conflict" | "fixed-required" | "positions-required", readonly path: string) {
    super(`${code}: ${path}`);
  }
}

export function placedSpaceState(project: Project, occurrenceId: SpatialId) {
  const document = project.spatialAuthoring;
  if (!document) throw new SpatialOperationError("missing", "spatialAuthoring");
  const occurrence = requireOccurrenceAssociations(own(document.occurrences, occurrenceId));
  switch (occurrence.kind) {
    case "space": return { document, occurrence, space: own(occurrence.snapshot.library.spaces, occurrence.source.id) };
    case "object": case "place": case "region": case "world": throw new SpatialOperationError("missing", occurrenceId);
    default: return assertNever(occurrence);
  }
}

export function placedSpaceMember(project: Project, occurrenceId: SpatialId, member: SpatialParentSlot) {
  const { document, space } = placedSpaceState(project, occurrenceId);
  const id = findOccurrenceChildId(document, occurrenceId, member);
  if (!id) throw new SpatialOperationError("missing", `${occurrenceId}/${member.slotId}/${member.index}`);
  const slot = space.objectSlots.find(value => value.id === member.slotId);
  if (!slot) throw new SpatialOperationError("missing", member.slotId);
  return { child: requireOccurrenceAssociations(own(document.occurrences, id)), slot };
}

/** Explicit fixed additions use the parent's frozen recipe when already captured.
 * Only a novel, explicitly requested source is resolved live; no sibling is expanded.
 */
export function addPlacedSpaceMember(project: Project, occurrenceId: SpatialId,
  addition: { readonly slot: SpatialObjectSlot; readonly index: number; readonly position: SpatialPoint }): Project {
  const { document, occurrence, space } = placedSpaceState(project, occurrenceId);
  const { slot, index, position } = addition;
  switch (slot.placement.mode) {
    case "fixed": break;
    case "auto": throw new PlacedSpaceEditError("fixed-required", slot.id);
    default: return assertNever(slot.placement);
  }
  if (findOccurrenceChildId(document, occurrenceId, { slotId: slot.id, index })) throw new SpatialOperationError("id", slot.id);
  const captured = occurrence.snapshot.library.objects[slot.objectDesignId];
  if (!captured && Object.values(occurrence.snapshot.library).some(records => Object.hasOwn(records, slot.objectDesignId))) {
    throw new PlacedSpaceEditError("frozen-closure-conflict", slot.objectDesignId);
  }
  const source = { kind: "object", id: slot.objectDesignId } as const;
  const snapshot = captured ? snapshotFor(occurrence.snapshot, source) : resolveSpatialDesign(document, project, source).snapshot;
  const design = own(snapshot.library.objects, slot.objectDesignId);
  const raster = own(snapshot.kitCells, slot.objectDesignId);
  const id = spatialId(genId("placed-object"));
  const root = { ...source, revision: design.revision };
  const child: SpatialAssociatedOccurrence = { id, kind: "object", parentId: occurrenceId, parentSlot: { slotId: slot.id, index },
    source: root, ...position, level: 0, seed: occurrence.seed, generatorVersion: occurrence.generatorVersion, bindings: [], origin: "user",
    snapshot: { ...snapshot, root, library: { ...snapshot.library,
      objects: { [design.id]: { ...design, chips: slot.chipOverrides ?? design.chips } } },
      ports: design.anchors.map(port => ({ ...port, localPortId: port.id, id: occurrencePortId(id, port.id) })) } };
  const nextSpace = { ...space, objectSlots: space.objectSlots.some(value => value.id === slot.id)
    ? space.objectSlots.map(value => value.id === slot.id ? slot : value) : [...space.objectSlots, slot] };
  const parent = { ...occurrence, snapshot: { ...occurrence.snapshot,
    library: { ...occurrence.snapshot.library, objects: { ...occurrence.snapshot.library.objects, [design.id]: design },
      spaces: { ...occurrence.snapshot.library.spaces, [space.id]: nextSpace } },
    kitCells: { ...occurrence.snapshot.kitCells, [design.id]: raster } } };
  return { ...project, spatialAuthoring: { ...document, occurrences: { ...document.occurrences, [id]: child, [occurrenceId]: parent } } };
}
