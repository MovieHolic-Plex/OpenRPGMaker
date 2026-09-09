import { assertNever, findOccurrenceChildId, own, requireOccurrenceAssociations, SpatialOperationError } from "@/project/spatial/domain";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import type { PlaceDesign, SpatialChildSlot, SpatialId, SpatialParentSlot, SpatialPoint, SpatialSource } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialAuthoringController, SpatialAuthoringDraft, SpatialAuthoringPreview, SpatialAuthoringResult } from "./authoringTypes";
import type { SpatialCompileRequest } from "./compilerTypes";

export type PlacedPlaceEdit = { readonly parentId: SpatialId } & (
  | { readonly kind: "move"; readonly slot: SpatialParentSlot; readonly position: SpatialPoint & { readonly level: number } }
  | { readonly kind: "delete"; readonly slot: SpatialParentSlot; readonly externalConnections: "reject" | "remove" }
  | { readonly kind: "add"; readonly slot: SpatialChildSlot<"space" | "place">; readonly rootId: SpatialId;
      readonly seed: number; readonly generatorVersion: string }
);

export type PlacedPlaceChild = SpatialPoint & {
  readonly occurrenceId: SpatialId; readonly slotId: SpatialId; readonly index: number;
  readonly level: number; readonly name: string; readonly source: SpatialSource<"space" | "place">;
  readonly destination: { readonly tab: "spaces" | "places"; readonly mode: "instances"; readonly occurrenceId: SpatialId };
};

function placedParent(project: Project, parentId: SpatialId) {
  const document = project.spatialAuthoring;
  if (!document) throw new SpatialOperationError("missing", "spatialAuthoring");
  const parent = requireOccurrenceAssociations(own(document.occurrences, parentId));
  const design = own(parent.snapshot.library.places, parent.source.id);
  return { document, parent, design };
}

/** A template position edit intentionally moves only its surviving associated member.
 * Missing repetitions remain gaps; source identity never selects an actual child.
 */
export function patchPlacedPlace(project: Project, parentId: SpatialId, next: PlaceDesign): Project {
  const { document, parent, design: current } = placedParent(project, parentId);
  const occurrences = { ...document.occurrences };
  for (const slot of next.children) {
    const previous = current.children.find(child => child.id === slot.id);
    if (!previous || (previous.x === slot.x && previous.y === slot.y && previous.level === slot.level)) continue;
    const id = findOccurrenceChildId(document, parentId, { slotId: slot.id, index: 0 });
    if (id === undefined) continue;
    occurrences[id] = { ...own(occurrences, id), x: slot.x, y: slot.y, level: slot.level };
  }
  occurrences[parentId] = { ...parent, snapshot: { ...parent.snapshot, library: { ...parent.snapshot.library,
    places: { ...parent.snapshot.library.places, [current.id]: next },
  } } };
  return { ...project, spatialAuthoring: { ...document, occurrences } };
}

/** Actual surviving members, including frozen overrides, drive tokens and drill destinations. */
export function placedPlaceChildren(project: Project, parentId: SpatialId): readonly PlacedPlaceChild[] {
  const { document } = placedParent(project, parentId);
  return Object.values(document.occurrences).filter(child => child.parentId === parentId).map((child): PlacedPlaceChild => {
    const actual = requireOccurrenceAssociations(child);
    const slot = actual.parentSlot;
    if (slot === null) throw new SpatialOperationError("association-required", child.id);
    const occurrenceId = actual.id;
    const common = { occurrenceId, slotId: slot.slotId, index: slot.index, x: actual.x, y: actual.y, level: actual.level };
    switch (actual.kind) {
      case "space": return { ...common, source: actual.source, name: own(actual.snapshot.library.spaces, actual.source.id).name,
        destination: { tab: "spaces", mode: "instances", occurrenceId } };
      case "place": return { ...common, source: actual.source, name: own(actual.snapshot.library.places, actual.source.id).name,
        destination: { tab: "places", mode: "instances", occurrenceId } };
      case "object": case "region": case "world": throw new SpatialOperationError("referenced", child.id);
      default: return assertNever(actual);
    }
  });
}

function mergeFrozen<T>(current: Readonly<Record<string, T>>, added: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  for (const [id, value] of Object.entries(added)) {
    if (Object.hasOwn(current, id) && JSON.stringify(current[id]) !== JSON.stringify(value)) {
      throw new SpatialOperationError("referenced", `frozen-snapshot-conflict:${id}`);
    }
  }
  return { ...added, ...current };
}

/** Scope is supplied by the shared authoringScope owner, never inferred from source IDs.
 * Every intermediate proposal remains controller-issued and detached. The caller's draft
 * is unchanged even on errors; only the final returned handle is offered for Apply.
 */
export function previewPlacedPlaceEdit(controller: SpatialAuthoringController, draft: SpatialAuthoringDraft,
  request: { readonly edit: PlacedPlaceEdit; readonly compile: SpatialCompileRequest },
): SpatialAuthoringResult<SpatialAuthoringPreview> {
  try {
    const { edit, compile } = request;
    const { document, design } = placedParent(draft.project, edit.parentId);
    if (!occurrenceSubtree(document, compile.occurrenceId).includes(edit.parentId)) {
      throw new SpatialOperationError("referenced", "compile-scope-must-contain-parent");
    }
    switch (edit.kind) {
      case "delete": {
        const occurrenceId = findOccurrenceChildId(document, edit.parentId, edit.slot);
        if (occurrenceId === undefined) throw new SpatialOperationError("missing", edit.slot.slotId);
        return controller.preview(draft, { operation: { kind: "delete-occurrence", request: { occurrenceId,
          externalConnections: edit.externalConnections } }, compile });
      }
      case "move": {
        const occurrenceId = findOccurrenceChildId(document, edit.parentId, edit.slot);
        if (occurrenceId === undefined) throw new SpatialOperationError("missing", edit.slot.slotId);
        const checkpoint = controller.preview(draft, { operation: { kind: "edit" } });
        switch (checkpoint.kind) { case "error": return checkpoint; case "ok": break; default: return assertNever(checkpoint); }
        const continued = controller.continueDraft(checkpoint.value);
        switch (continued.kind) { case "error": return continued; case "ok": break; default: return assertNever(continued); }
        Object.assign(continued.value.project, patchPlacedPlace(continued.value.project, edit.parentId, { ...design,
          children: design.children.map(slot => slot.id === edit.slot.slotId ? { ...slot, ...edit.position } : slot),
        }));
        const updated = placedParent(continued.value.project, edit.parentId).document;
        continued.value.project.spatialAuthoring = { ...updated, occurrences: { ...updated.occurrences,
          [occurrenceId]: { ...own(updated.occurrences, occurrenceId), ...edit.position },
        } };
        return controller.preview(continued.value, { operation: { kind: "edit" }, compile });
      }
      case "add": {
        const instantiated = controller.preview(draft, { operation: { kind: "instantiate", request: { source: edit.slot.source,
          rootId: edit.rootId, x: edit.slot.x, y: edit.slot.y, level: edit.slot.level, seed: edit.seed, generatorVersion: edit.generatorVersion } } });
        switch (instantiated.kind) { case "error": return instantiated; case "ok": break; default: return assertNever(instantiated); }
        const continued = controller.continueDraft(instantiated.value);
        switch (continued.kind) { case "error": return continued; case "ok": break; default: return assertNever(continued); }
        const working = continued.value.project;
        const { document: nextDocument, parent } = placedParent(working, edit.parentId);
        const child = requireOccurrenceAssociations(own(nextDocument.occurrences, edit.rootId));
        const current = parent.snapshot.library;
        const added = child.snapshot.library;
        const library = { objects: mergeFrozen(current.objects, added.objects), spaces: mergeFrozen(current.spaces, added.spaces),
          places: mergeFrozen(current.places, added.places), regions: mergeFrozen(current.regions, added.regions), worlds: mergeFrozen(current.worlds, added.worlds) };
        const nextParent = { ...parent, snapshot: { ...parent.snapshot,
          library: { ...library, places: { ...library.places, [design.id]: { ...design, children: [...design.children, edit.slot] } } },
          kitCells: mergeFrozen(parent.snapshot.kitCells, child.snapshot.kitCells),
        } };
        working.spatialAuthoring = { ...nextDocument, occurrences: { ...nextDocument.occurrences,
          [parent.id]: nextParent, [child.id]: { ...child, parentId: parent.id, parentSlot: { slotId: edit.slot.id, index: 0 } },
        }, rootOccurrenceIds: nextDocument.rootOccurrenceIds.filter(id => id !== child.id) };
        return controller.preview(continued.value, { operation: { kind: "edit" }, compile });
      }
      default: return assertNever(edit);
    }
  } catch (error) {
    if (error instanceof SpatialOperationError) return { kind: "error", error: { code: "invalid", message: error.message, detail: error.code } };
    throw error;
  }
}
