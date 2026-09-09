import { assertNever, own, requireOccurrenceAssociations, resolveOccurrencePortId, SpatialOperationError } from "@/project/spatial/domain";
import { snapshotFor, SPATIAL_EXPANSION_LIMITS } from "@/project/spatial/resolve";
import type { SpaceDesign, SpatialId, SpatialObjectSlot, SpatialOccurrence, SpatialParentSlot, SpatialPoint } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialAuthoringController, SpatialAuthoringDraft, SpatialAuthoringError, SpatialAuthoringPreview, SpatialAuthoringResult } from "./authoringTypes";
import type { SpatialCompileRequest } from "./compilerTypes";
import { addPlacedSpaceMember, PlacedSpaceEditError, placedSpaceMember, placedSpaceState } from "./placedSpaceMembers";

export type PlacedSpaceEdit =
  | { readonly kind: "move"; readonly member: SpatialParentSlot; readonly position: SpatialPoint }
  | { readonly kind: "chips"; readonly member: SpatialParentSlot; readonly chips: readonly string[] }
  | { readonly kind: "remove"; readonly member: SpatialParentSlot }
  | { readonly kind: "add"; readonly slot: SpatialObjectSlot }
  | { readonly kind: "quantity"; readonly slotId: SpatialId; readonly quantity: number; readonly positions: readonly SpatialPoint[] }
  | { readonly kind: "recipe"; readonly space: SpaceDesign };
export type PlacedSpaceEditRequest = {
  readonly occurrenceId: SpatialId;
  /** Resolve the containing compilation scope at the authoring boundary, never guess a leaf. */
  readonly compile: SpatialCompileRequest;
  readonly edit: PlacedSpaceEdit;
};

class ControllerFailure extends Error {
  readonly name = "ControllerFailure";
  constructor(readonly error: SpatialAuthoringError) { super(error.message); }
}
function issued<T>(result: SpatialAuthoringResult<T>): T {
  switch (result.kind) {
    case "ok": return result.value;
    case "error": throw new ControllerFailure(result.error);
    default: return assertNever(result);
  }
}

/** One detached final proposal. Intermediate lifecycle checkpoints are never applied.
 * Controller baselines, owned-raster protection and original impact survive continuation.
 */
export function previewPlacedSpaceEdit(controller: SpatialAuthoringController, draft: SpatialAuthoringDraft,
  request: PlacedSpaceEditRequest): SpatialAuthoringResult<SpatialAuthoringPreview> {
  try {
    const { occurrenceId, edit } = request;
    const initial = placedSpaceState(draft.project, occurrenceId);
    // Validate the exact issued handle before making a private working continuation.
    let working = issued(controller.continueDraft(issued(controller.preview(draft, { operation: { kind: "edit" } }))));
    const remove = (id: SpatialId): void => {
      working = issued(controller.continueDraft(issued(controller.preview(working,
        { operation: { kind: "delete-occurrence", request: { occurrenceId: id, externalConnections: "reject" } } }))));
    };
    switch (edit.kind) {
      case "move": case "chips": {
        const { child, slot } = placedSpaceMember(working.project, occurrenceId, edit.member);
        let updated: SpatialOccurrence;
        switch (edit.kind) {
          case "move":
            switch (slot.placement.mode) {
              case "auto": throw new PlacedSpaceEditError("fixed-required", slot.id);
              case "fixed": updated = { ...child, ...edit.position }; break;
              default: return assertNever(slot.placement);
            }
            break;
          case "chips": {
            const object = own(child.snapshot.library.objects, child.source.id);
            updated = { ...child, snapshot: { ...child.snapshot, library: { ...child.snapshot.library,
              objects: { ...child.snapshot.library.objects, [object.id]: { ...object, chips: edit.chips } } } } };
            break;
          }
          default: return assertNever(edit);
        }
        const { document } = placedSpaceState(working.project, occurrenceId);
        working.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [child.id]: updated } };
        break;
      }
      case "remove": remove(placedSpaceMember(working.project, occurrenceId, edit.member).child.id); break;
      case "add": {
        if (initial.space.objectSlots.some(slot => slot.id === edit.slot.id)) throw new SpatialOperationError("id", edit.slot.id);
        if (edit.slot.quantity !== 1) throw new PlacedSpaceEditError("positions-required", edit.slot.id);
        Object.assign(working.project, addPlacedSpaceMember(working.project, occurrenceId,
          { slot: edit.slot, index: 0, position: placementPoint(edit.slot.placement) }));
        break;
      }
      case "recipe": case "quantity": {
        const before = initial.space;
        let next: SpaceDesign;
        switch (edit.kind) {
          case "recipe":
            for (const slot of edit.space.objectSlots) {
              const old = before.objectSlots.find(value => value.id === slot.id);
              if (!old || slot.quantity > old.quantity) throw new PlacedSpaceEditError("positions-required", slot.id);
              if (old.objectDesignId !== slot.objectDesignId) throw new PlacedSpaceEditError("frozen-closure-conflict", slot.id);
            }
            next = edit.space;
            break;
          case "quantity": {
            const slot = before.objectSlots.find(value => value.id === edit.slotId);
            if (!slot) throw new SpatialOperationError("missing", edit.slotId);
            if (!Number.isSafeInteger(edit.quantity) || edit.quantity < 0 || edit.quantity > SPATIAL_EXPANSION_LIMITS.occurrences) throw new SpatialOperationError("limit", edit.slotId);
            if (edit.positions.length !== Math.max(0, edit.quantity - slot.quantity)) throw new PlacedSpaceEditError("positions-required", edit.slotId);
            next = { ...before, objectSlots: edit.quantity === 0 ? before.objectSlots.filter(value => value.id !== slot.id)
              : before.objectSlots.map(value => value.id === slot.id ? { ...value, quantity: edit.quantity } : value) };
            break;
          }
          default: return assertNever(edit);
        }
        for (const child of Object.values(initial.document.occurrences).filter(value => value.parentId === occurrenceId).map(requireOccurrenceAssociations)) {
          const association = child.parentSlot;
          if (!association) throw new SpatialOperationError("association-required", child.id);
          const retained = next.objectSlots.find(slot => slot.id === association.slotId);
          if (!retained || association.index >= retained.quantity) remove(child.id);
        }
        Object.assign(working.project, patchPlacedSpace(working.project, occurrenceId, () => next));
        switch (edit.kind) {
          case "quantity": {
            const slot = next.objectSlots.find(value => value.id === edit.slotId);
            const old = before.objectSlots.find(value => value.id === edit.slotId);
            if (slot && old) edit.positions.forEach((position, offset) => {
              Object.assign(working.project, addPlacedSpaceMember(working.project, occurrenceId, { slot, index: old.quantity + offset, position }));
            });
            break;
          }
          case "recipe": break;
          default: return assertNever(edit);
        }
        break;
      }
      default: return assertNever(edit);
    }
    return controller.preview(working, { operation: { kind: "edit" }, compile: request.compile });
  } catch (error) {
    if (error instanceof ControllerFailure) return { kind: "error", error: error.error };
    if (error instanceof SpatialOperationError || error instanceof PlacedSpaceEditError) {
      return { kind: "error", error: { code: "invalid", message: error.message, detail: error.code } };
    }
    throw error;
  }
}

/** Snapshot recipe changes intentionally affect surviving members of that slot only.
 * Structural insertion/deletion belongs to previewPlacedSpaceEdit's lifecycle.
 */
export function patchPlacedSpace(project: Project, occurrenceId: SpatialId, patch: (space: SpaceDesign) => SpaceDesign): Project {
  const document = project.spatialAuthoring;
  if (!document) throw new SpatialOperationError("missing", "spatialAuthoring");
  const occurrence = own(document.occurrences, occurrenceId);
  switch (occurrence.kind) {
    case "space": break;
    case "object": case "place": case "region": case "world": throw new SpatialOperationError("missing", occurrenceId);
    default: return assertNever(occurrence);
  }
  const current = own(occurrence.snapshot.library.spaces, occurrence.source.id);
  const next = patch(current);
  const slotsChanged = JSON.stringify(current.objectSlots) !== JSON.stringify(next.objectSlots);
  const portsChanged = JSON.stringify(current.ports) !== JSON.stringify(next.ports);
  // Metadata-only edits remain readable on legacy snapshots; identity-dependent edits never guess.
  if (slotsChanged || portsChanged) requireOccurrenceAssociations(occurrence);
  const expanded = { ...occurrence.snapshot.library,
    spaces: { ...occurrence.snapshot.library.spaces, [occurrence.source.id]: next } };
  const closed = slotsChanged ? snapshotFor({ ...occurrence.snapshot, library: expanded }, occurrence.source) : occurrence.snapshot;
  const library = slotsChanged ? closed.library : expanded;
  const kitCells = closed.kitCells;
  const ports = portsChanged ? requireOccurrenceAssociations(occurrence).snapshot.ports.map(port => {
    const named = next.ports.find(value => value.id === port.localPortId);
    if (!named) throw new SpatialOperationError("missing", port.localPortId);
    resolveOccurrencePortId(occurrence, named.id);
    return { ...port, name: named.name, x: named.x, y: named.y };
  }) : undefined;
  // Private builder, returned immutably. Preserve the legacy/associated discriminant.
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  occurrences[occurrenceId] = ports
    ? { ...requireOccurrenceAssociations(occurrence), snapshot: { ...occurrence.snapshot, library, kitCells, ports } }
    : occurrence.parentSlot === undefined
      ? { ...occurrence, snapshot: { ...occurrence.snapshot, library, kitCells } }
      : { ...occurrence, snapshot: { ...occurrence.snapshot, library, kitCells } };
  if (slotsChanged) for (const value of Object.values(document.occurrences).filter(child => child.parentId === occurrenceId)) {
    const child = requireOccurrenceAssociations(value);
    if (!child.parentSlot) throw new SpatialOperationError("association-required", child.id);
    const before = current.objectSlots.find(slot => slot.id === child.parentSlot?.slotId);
    const after = next.objectSlots.find(slot => slot.id === child.parentSlot?.slotId);
    if (!before || !after) throw new SpatialOperationError("missing", child.parentSlot.slotId);
    const moved = JSON.stringify(before.placement) !== JSON.stringify(after.placement);
    const chipsChanged = JSON.stringify(before.chipOverrides) !== JSON.stringify(after.chipOverrides);
    const object = own(child.snapshot.library.objects, child.source.id);
    const chips = after.chipOverrides ?? own(library.objects, child.source.id).chips;
    const snapshot = chipsChanged ? { ...child.snapshot, library: { ...child.snapshot.library,
      objects: { ...child.snapshot.library.objects, [object.id]: { ...object, chips } } } } : child.snapshot;
    const position = moved ? placementPoint(after.placement) : { x: child.x, y: child.y };
    occurrences[child.id] = { ...child, ...position, snapshot };
  }
  return { ...project, spatialAuthoring: { ...document, occurrences } };
}

function placementPoint(placement: SpaceDesign["objectSlots"][number]["placement"]) {
  switch (placement.mode) {
    case "auto": return { x: 0, y: 0 };
    case "fixed": return { x: placement.x, y: placement.y };
    default: return assertNever(placement);
  }
}
