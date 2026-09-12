import { checkedDocument, designNode, designSlots, freezeSpatial, own, SpatialOperationError } from "./domain";
import { snapshotGraphic, type SpatialResolutionContext } from "./snapshotRaster";
import type * as S from "./types";

/** Hard limits are checked before quantity expansion or repeated snapshot cloning. */
export const SPATIAL_EXPANSION_LIMITS = Object.freeze({ occurrences: 4096, depth: 128, snapshotEntries: 65_536, frozenCells: 1_048_576 });
export const emptySpatialLibrary = (): S.SpatialLibrary => ({ objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} });
type ExpansionCost = {
  readonly occurrences: number; readonly depth: number; readonly entries: number;
  readonly closure: ReadonlySet<S.SpatialId>; readonly ref: S.SpatialDesignReference;
};
export type ResolvedSpatialDesign = {
  readonly snapshot: S.SpatialCompositionSnapshot;
  readonly occurrenceCount: number; readonly snapshotEntries: number; readonly frozenCellCount: number;
};
function limit(value: number, max: number, path: string): void {
  if (!Number.isSafeInteger(value) || value > max) throw new SpatialOperationError("limit", `${path}: ${value} > ${max}`);
}
function graphCosts(library: S.SpatialLibrary, root: S.SpatialDesignReference): ReadonlyMap<S.SpatialId, ExpansionCost> {
  const costs = new Map<S.SpatialId, ExpansionCost>();
  const visit = (ref: S.SpatialDesignReference, depth: number): ExpansionCost => {
    limit(depth, SPATIAL_EXPANSION_LIMITS.depth, "design depth");
    const cached = costs.get(ref.id);
    if (cached) return cached;
    const closure = new Set<S.SpatialId>([ref.id]);
    let occurrences = 1;
    let descendants = 0;
    let height = 1;
    for (const slot of designSlots(designNode(library, ref))) {
      const cost = visit(slot.source, depth + 1);
      occurrences += cost.occurrences * slot.quantity;
      descendants += cost.entries * slot.quantity;
      height = Math.max(height, 1 + cost.depth);
      limit(occurrences, SPATIAL_EXPANSION_LIMITS.occurrences, `design ${ref.id} occurrences`);
      limit(descendants, SPATIAL_EXPANSION_LIMITS.snapshotEntries, `design ${ref.id} snapshot entries`);
      for (const id of cost.closure) closure.add(id);
    }
    const entries = closure.size + descendants;
    limit(entries, SPATIAL_EXPANSION_LIMITS.snapshotEntries, `design ${ref.id} snapshot entries`);
    limit(height, SPATIAL_EXPANSION_LIMITS.depth, `design ${ref.id} depth`);
    const cost = { occurrences, depth: height, entries, closure, ref };
    costs.set(ref.id, cost);
    return cost;
  };
  visit(root, 1);
  return costs;
}
function selectLibrary(library: S.SpatialLibrary, ids: ReadonlySet<S.SpatialId>): S.SpatialLibrary {
  const select = <T extends S.SpatialDesignBase>(records: Readonly<Record<string, T>>) =>
    Object.fromEntries(Object.entries(records).filter(([, value]) => ids.has(value.id)));
  return { objects: select(library.objects), spaces: select(library.spaces), places: select(library.places),
    regions: select(library.regions), worlds: select(library.worlds) };
}
/** Internal closed projection. Each call returns detached data, even for repeated source IDs. */
export function snapshotFor(snapshot: S.SpatialCompositionSnapshot, ref: S.SpatialDesignReference): S.SpatialCompositionSnapshot {
  const ids = new Set<S.SpatialId>([ref.id]);
  const refs = [ref];
  for (const current of refs) for (const slot of designSlots(designNode(snapshot.library, current))) {
    if (!ids.has(slot.source.id)) { ids.add(slot.source.id); refs.push(slot.source); }
  }
  const node = designNode(snapshot.library, ref);
  const owners: ReadonlySet<string> = ids;
  return structuredClone({ root: { ...ref, revision: node.design.revision }, library: selectLibrary(snapshot.library, ids),
    kitCells: Object.fromEntries(Object.entries(snapshot.kitCells).filter(([id]) => owners.has(id))), ports: [] });
}

export function resolveSpatialDesign(input: unknown, context: SpatialResolutionContext, ref: S.SpatialDesignReference): ResolvedSpatialDesign {
  const document = checkedDocument(input, context);
  const costs = graphCosts(document.library, ref);
  const cost = costs.get(ref.id);
  if (!cost) throw new SpatialOperationError("missing", ref.id);
  const library = selectLibrary(document.library, cost.closure);
  const graphics: readonly (readonly [S.SpatialId, S.SpatialGraphic])[] = [
    ...Object.values(library.objects).map(object => [object.id, object.graphic] as const),
    ...Object.values(library.places).flatMap(place => place.exterior ? [[place.id, place.exterior] as const] : []),
  ];
  // Reverse postorder propagates occurrence multiplicity before any raster adapter runs.
  const multiplicity = new Map<S.SpatialId, number>([[ref.id, 1]]);
  for (const [id, entry] of [...costs].reverse()) for (const slot of designSlots(designNode(library, entry.ref))) {
    multiplicity.set(slot.source.id, (multiplicity.get(slot.source.id) ?? 0) + (multiplicity.get(id) ?? 0) * slot.quantity);
  }
  const copies = new Map<S.SpatialId, number>();
  for (const [id, entry] of costs) for (const owner of entry.closure) {
    copies.set(owner, (copies.get(owner) ?? 0) + (multiplicity.get(id) ?? 0));
  }
  const rasters = new Map<S.SpatialId, S.SpatialKitSnapshot>();
  let frozenCellCount = 0;
  for (const [id, entry] of costs) {
    const node = designNode(library, entry.ref);
    if (node.kind !== "object") frozenCellCount += (node.design.composition?.tiles.length ?? 0) * (copies.get(id) ?? 0);
    limit(frozenCellCount, SPATIAL_EXPANSION_LIMITS.frozenCells, `design ${id} painted cells`);
  }
  for (const [id, graphic] of graphics) {
    const raster = snapshotGraphic(context, graphic);
    frozenCellCount += raster.cells.length * (copies.get(id) ?? 0);
    limit(frozenCellCount, SPATIAL_EXPANSION_LIMITS.frozenCells, `design ${id} frozen cells`);
    rasters.set(id, raster);
  }
  const kitCells = Object.fromEntries(rasters);
  const node = designNode(library, ref);
  const root = { ...ref, revision: node.design.revision };
  // Use the actual occurrence/snapshot schema, with no live kit dependency in the frozen half.
  const proof = checkedDocument({ ...document, library: emptySpatialLibrary(), connections: [], rootOccurrenceIds: [ref.id],
    occurrences: { [ref.id]: { id: ref.id, kind: ref.kind, parentId: null, source: root, x: 0, y: 0, level: 0, seed: 0,
      snapshot: { root, library, kitCells, ports: [] }, generatorVersion: "resolution", bindings: [] } } }, context);
  return freezeSpatial({ snapshot: own(proof.occurrences, ref.id).snapshot, occurrenceCount: cost.occurrences,
    snapshotEntries: cost.entries, frozenCellCount });
}

/** Explicit refresh proposal only: never edits occurrences, bindings, maps or history. */
export function resolveSpatialOccurrenceRefresh(input: unknown, context: SpatialResolutionContext, occurrenceId: S.SpatialId): ResolvedSpatialDesign {
  const document = checkedDocument(input, context);
  return resolveSpatialDesign(document, context, own(document.occurrences, occurrenceId).source);
}
