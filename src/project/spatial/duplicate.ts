import { assertNever, checkedDocument, freezeSpatial, occurrenceChildId, occurrencePortId, own, requireOccurrenceAssociations, spatialId, SpatialOperationError } from "./domain";
import { occurrenceSubtree } from "./ownership";
import { SPATIAL_EXPANSION_LIMITS } from "./resolve";
import type * as S from "./types";

export type SpatialDuplication = {
  readonly occurrenceId: S.SpatialId; readonly rootId: string;
  readonly externalConnections: "omit" | "copy";
};
/** Copies the actual frozen tree, not today's library expansion. The duplicate is a standalone
 * root; internal links are remapped, external links require explicit copy, bindings are released.
 */
export function duplicateSpatialOccurrence(input: unknown, assets: S.SpatialAssetContext, request: SpatialDuplication): S.SpatialAuthoringDocument {
  const document = checkedDocument(input, assets);
  const ids = occurrenceSubtree(document, request.occurrenceId);
  let entries = 0;
  let cells = 0;
  for (const id of ids) {
    const snapshot = requireOccurrenceAssociations(own(document.occurrences, id)).snapshot;
    entries += Object.values(snapshot.library).reduce((count, records) => count + Object.keys(records).length, 0);
    cells += Object.values(snapshot.kitCells).reduce((count, kit) => count + kit.cells.length, 0);
  }
  if (ids.length > SPATIAL_EXPANSION_LIMITS.occurrences || entries > SPATIAL_EXPANSION_LIMITS.snapshotEntries || cells > SPATIAL_EXPANSION_LIMITS.frozenCells) {
    throw new SpatialOperationError("limit", `duplicate: occurrences=${ids.length}, snapshotEntries=${entries}, frozenCells=${cells}`);
  }
  const rootId = spatialId(request.rootId);
  // occurrenceSubtree is parent-first even when the persisted dictionary is reordered.
  const remap: Record<string, S.SpatialId> = {};
  const portPairs: (readonly [S.SpatialId, S.SpatialId])[] = [];
  const additions = new Map<S.SpatialId, unknown>();
  for (const oldId of ids) {
    const original = requireOccurrenceAssociations(own(document.occurrences, oldId));
    const parent = oldId === request.occurrenceId || original.parentSlot === null
      ? { parentId: null, parentSlot: null } as const
      : { parentId: own(remap, original.parentId), parentSlot: original.parentSlot };
    const id = parent.parentSlot === null ? rootId : occurrenceChildId(parent.parentId, parent.parentSlot.slotId, parent.parentSlot.index);
    if (Object.hasOwn(document.occurrences, id) || additions.has(id)) throw new SpatialOperationError("id", id);
    // Define an own data property: opaque IDs may be __proto__ or constructor.
    Object.defineProperty(remap, oldId, { value: id, enumerable: true });
    const concretePorts = original.snapshot.ports.map(port => {
      const fresh = { ...port, id: occurrencePortId(id, port.localPortId) };
      portPairs.push([port.id, fresh.id]);
      return fresh;
    });
    additions.set(id, { ...original, ...parent, id, snapshot: { ...original.snapshot, ports: concretePorts }, bindings: [] });
  }
  const ports = Object.fromEntries(portPairs);
  const selected = new Set(ids);
  const connections: S.SpatialConnection[] = [];
  const endpoint = (value: S.SpatialConnection["from"]): S.SpatialConnection["from"] => selected.has(value.occurrenceId)
    ? { occurrenceId: own(remap, value.occurrenceId), portId: own(ports, value.portId) } : value;
  for (const link of document.connections) {
    const from = selected.has(link.from.occurrenceId);
    const to = selected.has(link.to.occurrenceId);
    if (!from && !to) continue;
    if (from !== to) {
      switch (request.externalConnections) {
        case "omit": continue;
        case "copy": break;
        default: return assertNever(request.externalConnections);
      }
    }
    connections.push({ ...link, id: spatialId(`copy-link:${rootId.length}:${rootId}${link.id.length}:${link.id}`), from: endpoint(link.from), to: endpoint(link.to) });
  }
  return freezeSpatial(checkedDocument({ ...document, occurrences: { ...document.occurrences, ...Object.fromEntries(additions) },
    rootOccurrenceIds: [...document.rootOccurrenceIds, rootId], connections: [...document.connections, ...connections] }, assets));
}
