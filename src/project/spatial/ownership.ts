import { assertNever, checkedDocument, designNode, freezeSpatial, own, SpatialOperationError } from "./domain";
import type * as S from "./types";
import { isOwnedSpatialBinding } from "./bindings";

export type SpatialReferenceImpact = {
  readonly strong: readonly { readonly owner: S.SpatialDesignReference; readonly path: string }[];
  readonly historical: readonly S.SpatialId[];
};
const collections = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const satisfies Record<S.SpatialKind, keyof S.SpatialLibrary>;

/** Historical references include every transitive frozen use, not just root provenance. */
export function inspectSpatialDesignReferences(input: unknown, assets: S.SpatialAssetContext, ref: S.SpatialDesignReference): SpatialReferenceImpact {
  const document = checkedDocument(input, assets);
  const strong: SpatialReferenceImpact["strong"][number][] = [];
  for (const space of Object.values(document.library.spaces)) space.objectSlots.forEach((slot, index) => {
    if (ref.kind === "object" && slot.objectDesignId === ref.id) strong.push({ owner: { kind: "space", id: space.id }, path: `library.spaces.${space.id}.objectSlots[${index}].objectDesignId` });
  });
  const children = (owner: S.SpatialDesignReference, slots: readonly S.SpatialChildSlot<S.SpatialKind>[], field: string) => {
    slots.forEach((slot, index) => {
      if (slot.source.kind === ref.kind && slot.source.id === ref.id) strong.push({ owner, path: `library.${collections[owner.kind]}.${owner.id}.${field}[${index}].source` });
    });
  };
  for (const place of Object.values(document.library.places)) children({ kind: "place", id: place.id }, place.children, "children");
  for (const region of Object.values(document.library.regions)) children({ kind: "region", id: region.id }, region.places, "places");
  for (const world of Object.values(document.library.worlds)) children({ kind: "world", id: world.id }, world.regions, "regions");
  const historical = Object.values(document.occurrences).filter(value => Object.hasOwn(value.snapshot.library[collections[ref.kind]], ref.id)).map(value => value.id);
  return freezeSpatial({ strong, historical });
}

/** Callers must explicitly rewrite/detach strong references in their proposed document first.
 * Removing a library source never removes its independent historical snapshots.
 */
export function deleteSpatialDesign(input: unknown, assets: S.SpatialAssetContext, ref: S.SpatialDesignReference): S.SpatialAuthoringDocument {
  const document = checkedDocument(input, assets);
  designNode(document.library, ref);
  const impact = inspectSpatialDesignReferences(document, assets, ref);
  if (impact.strong.length > 0) throw new SpatialOperationError("referenced", impact.strong.map(value => value.path).join(", "));
  const collection = collections[ref.kind];
  const remaining = Object.fromEntries(Object.entries(document.library[collection]).filter(([id]) => id !== ref.id));
  return freezeSpatial(checkedDocument({ ...document, library: { ...document.library, [collection]: remaining } }, assets));
}

/** Linear traversal of actual single-parent occurrences, never expansion of source quantities. */
export function occurrenceSubtree(document: S.SpatialAuthoringDocument, id: S.SpatialId): readonly S.SpatialId[] {
  own(document.occurrences, id);
  const children = new Map<S.SpatialId, S.SpatialId[]>();
  for (const occurrence of Object.values(document.occurrences)) if (occurrence.parentId !== null) {
    const siblings = children.get(occurrence.parentId) ?? [];
    siblings.push(occurrence.id);
    children.set(occurrence.parentId, siblings);
  }
  const ids = [id];
  for (const parent of ids) ids.push(...children.get(parent) ?? []);
  return ids;
}
export type SpatialDeletionImpact = {
  readonly occurrenceIds: readonly S.SpatialId[]; readonly connections: readonly S.SpatialConnection[];
  readonly externalConnectionIds: readonly S.SpatialId[];
  readonly artifacts: readonly { readonly occurrenceId: S.SpatialId; readonly binding: S.SpatialOwnedBinding }[];
  readonly projections: readonly { readonly occurrenceId: S.SpatialId; readonly binding: S.SpatialProjectionBinding }[];
};
export function inspectSpatialOccurrenceDeletion(input: unknown, assets: S.SpatialAssetContext, id: S.SpatialId): SpatialDeletionImpact {
  const document = checkedDocument(input, assets);
  const occurrenceIds = occurrenceSubtree(document, id);
  const selected = new Set(occurrenceIds);
  const connections = document.connections.filter(link => selected.has(link.from.occurrenceId) || selected.has(link.to.occurrenceId));
  const artifacts: SpatialDeletionImpact["artifacts"][number][] = [];
  const projections: SpatialDeletionImpact["projections"][number][] = [];
  for (const occurrenceId of occurrenceIds) for (const binding of own(document.occurrences, occurrenceId).bindings) {
    switch (binding.kind) {
      case undefined: artifacts.push({ occurrenceId, binding }); break;
      case "projection": projections.push({ occurrenceId, binding }); break;
      default: return assertNever(binding);
    }
  }
  return freezeSpatial({ occurrenceIds, connections, artifacts, projections,
    externalConnectionIds: connections.filter(link => selected.has(link.from.occurrenceId) !== selected.has(link.to.occurrenceId)).map(link => link.id),
  });
}
export type SpatialDeletion = { readonly occurrenceId: S.SpatialId; readonly externalConnections: "reject" | "remove" };
/** Domain deletion releases ownership only. Artifact cleanup requires this exact impact in
 * the editor's later preview transaction; no map/event (managed or unmanaged) is mutated here.
 */
export function deleteSpatialOccurrence(input: unknown, assets: S.SpatialAssetContext, request: SpatialDeletion): S.SpatialAuthoringDocument {
  const document = checkedDocument(input, assets);
  const impact = inspectSpatialOccurrenceDeletion(document, assets, request.occurrenceId);
  switch (request.externalConnections) {
    case "reject": if (impact.externalConnectionIds.length > 0) throw new SpatialOperationError("external-connection", impact.externalConnectionIds.join(", ")); break;
    case "remove": break;
    default: return assertNever(request.externalConnections);
  }
  const removed = new Set(impact.occurrenceIds);
  const removedConnections = new Set(impact.connections.map(link => link.id));
  const occurrences = Object.fromEntries(Object.values(document.occurrences).filter(value => !removed.has(value.id)).map(value => [value.id, {
    ...value, bindings: value.bindings.map(binding => isOwnedSpatialBinding(binding)
      ? { ...binding, connectionIds: binding.connectionIds.filter(id => !removedConnections.has(id)) } : binding),
  }]));
  return freezeSpatial(checkedDocument({ ...document, occurrences,
    rootOccurrenceIds: document.rootOccurrenceIds.filter(id => !removed.has(id)),
    connections: document.connections.filter(link => !removedConnections.has(link.id)),
  }, assets));
}
/** Detach compiled ownership, retaining source provenance, tree, snapshots and navigation. */
export function detachSpatialOccurrence(input: unknown, assets: S.SpatialAssetContext, id: S.SpatialId): S.SpatialAuthoringDocument {
  const document = checkedDocument(input, assets);
  const selected = new Set(occurrenceSubtree(document, id));
  const occurrences = Object.fromEntries(Object.values(document.occurrences).map(value => [value.id, selected.has(value.id) ? { ...value, bindings: [] } : value]));
  return freezeSpatial(checkedDocument({ ...document, occurrences }, assets));
}
