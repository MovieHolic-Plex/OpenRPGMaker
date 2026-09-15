import { assertNever, checkedDocument, designNode, designSlots, freezeSpatial, nodeConnections, nodePorts,
  occurrenceChildId, occurrencePortId, own, spatialId, SpatialOperationError } from "./domain";
import { resolveSpatialDesign, snapshotFor } from "./resolve";
import type { SpatialResolutionContext } from "./snapshotRaster";
import type * as S from "./types";

export type SpatialInstantiation = S.SpatialPoint & {
  readonly source: S.SpatialDesignReference; readonly rootId: string;
  readonly level: number; readonly seed: number; readonly generatorVersion: string;
  readonly origin?: S.SpatialProvenance["origin"];
};
type PendingOccurrence = S.SpatialPoint & {
  readonly id: S.SpatialId; readonly source: S.SpatialDesignReference;
  readonly level: number; readonly chipOverrides?: readonly string[];
} & (
  | { readonly parentId: null; readonly parentSlot: null }
  | { readonly parentId: S.SpatialId; readonly parentSlot: S.SpatialParentSlot }
);

/** Pure insertion of a complete, uncompiled tree. Auto layout stays in the frozen slot;
 * object x/y=0 is only a local placeholder for that declared auto placement, not raster data.
 * Fresh IDs and persisted associations both originate at the frozen slot/local port.
 */
export function instantiateSpatialDesign(input: unknown, context: SpatialResolutionContext, request: SpatialInstantiation): S.SpatialAuthoringDocument {
  const document = checkedDocument(input, context);
  const resolved = resolveSpatialDesign(document, context, request.source);
  const rootId = spatialId(request.rootId);
  const pending: PendingOccurrence[] = [{ id: rootId, parentId: null, parentSlot: null, source: request.source, x: request.x, y: request.y, level: request.level }];
  // Builders are private; output is parsed and deeply frozen only after the whole operation succeeds.
  const additions = new Map<S.SpatialId, unknown>();
  const connections: S.SpatialConnection[] = [];
  for (const entry of pending) {
    if (Object.hasOwn(document.occurrences, entry.id) || additions.has(entry.id)) {
      throw new SpatialOperationError("id", entry.id);
    }
    const node = designNode(resolved.snapshot.library, entry.source);
    const snapshot = snapshotFor(resolved.snapshot, entry.source);
    const library = entry.chipOverrides === undefined ? snapshot.library : { ...snapshot.library,
      objects: { ...snapshot.library.objects, [entry.source.id]: { ...own(snapshot.library.objects, entry.source.id), chips: entry.chipOverrides } } };
    additions.set(entry.id, { id: entry.id, kind: entry.source.kind, parentId: entry.parentId, parentSlot: entry.parentSlot, source: snapshot.root,
      x: entry.x, y: entry.y, level: entry.level, seed: request.seed, generatorVersion: request.generatorVersion, bindings: [],
      ...(request.origin === undefined ? {} : { origin: request.origin }),
      snapshot: { ...snapshot, library, ports: nodePorts(node).map(port => ({ ...port, localPortId: port.id, id: occurrencePortId(entry.id, port.id) })) } });
    for (const slot of designSlots(node)) for (let index = 0; index < slot.quantity; index++) {
      pending.push({ id: occurrenceChildId(entry.id, slot.id, index), parentId: entry.id, parentSlot: { slotId: slot.id, index }, source: slot.source,
        x: slot.x, y: slot.y, level: slot.level, ...(slot.chipOverrides === undefined ? {} : { chipOverrides: slot.chipOverrides }) });
    }
    const endpoint = (local: S.SpatialLocalEndpoint): S.SpatialConnection["from"] => {
      const occurrenceId = local.childId === null ? entry.id : occurrenceChildId(entry.id, local.childId, 0);
      return { occurrenceId, portId: occurrencePortId(occurrenceId, local.portId) };
    };
    for (const connection of nodeConnections(node)) {
      let provenance: Pick<S.SpatialConnection, "overviewRoute">;
      switch (entry.source.kind) {
        case "region": case "world": provenance = { overviewRoute: { occurrenceId: entry.id, localConnectionId: connection.id } }; break;
        case "object": case "space": case "place": provenance = {}; break;
        default: return assertNever(entry.source.kind);
      }
      connections.push({ id: spatialId(`connection:${entry.id.length}:${entry.id}${connection.id.length}:${connection.id}`),
        from: endpoint(connection.from), to: endpoint(connection.to), bidirectional: connection.bidirectional, ...provenance });
    }
  }
  return freezeSpatial(checkedDocument({ ...document, occurrences: { ...document.occurrences, ...Object.fromEntries(additions) },
    rootOccurrenceIds: [...document.rootOccurrenceIds, rootId], connections: [...document.connections, ...connections] }, context));
}
