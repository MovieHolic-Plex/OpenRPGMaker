import { validateSpatialAuthoring } from "./guards";
import { validateSpatialReferences } from "./references";
import type * as S from "./types";

export class SpatialOperationError extends Error {
  readonly name = "SpatialOperationError";
  constructor(readonly code: "missing" | "id" | "limit" | "raster" | "referenced" | "external-connection" | "association-required", readonly path: string) {
    super(`${code}: ${path}`);
  }
}
export function requireOccurrenceAssociations(occurrence: S.SpatialOccurrence): S.SpatialAssociatedOccurrence {
  if (occurrence.parentSlot === undefined) throw new SpatialOperationError("association-required", `occurrences.${occurrence.id}`);
  return occurrence;
}
/** Typed read APIs require schema-parsed input; no ID parsing or payload/order inference. */
export function resolveOccurrencePortId(occurrence: S.SpatialOccurrence, localPortId: S.SpatialId): S.SpatialId {
  const associated = requireOccurrenceAssociations(occurrence);
  const port = associated.snapshot.ports.find(port => port.localPortId === localPortId);
  if (!port) throw new SpatialOperationError("missing", `occurrences.${occurrence.id}.snapshot.ports.${localPortId}`);
  return port.id;
}
/** An incomplete direct child could occupy any slot, so check all before returning a match.
 * Unrelated roots and grandchildren do not affect this parent's direct slot lookup. */
export function findOccurrenceChildId(document: S.SpatialAuthoringDocument, parentId: S.SpatialId, slot: S.SpatialParentSlot): S.SpatialId | undefined {
  requireOccurrenceAssociations(own(document.occurrences, parentId));
  const children = Object.values(document.occurrences).filter(child => child.parentId === parentId).map(requireOccurrenceAssociations);
  return children.find(child => child.parentSlot?.slotId === slot.slotId && child.parentSlot.index === slot.index)?.id;
}
export function spatialId(value: string): S.SpatialId {
  const valid = (id: string): id is S.SpatialId => id.trim().length > 0;
  if (!valid(value)) throw new SpatialOperationError("id", value);
  return value;
}
export function own<T>(records: Readonly<Record<string, T>>, id: string): T {
  const value = Object.hasOwn(records, id) ? records[id] : undefined;
  if (value === undefined) throw new SpatialOperationError("missing", id);
  return value;
}
export function assertNever(value: never): never { throw new TypeError(`Unreachable spatial variant: ${String(value)}`); }
export type DesignNode =
  | { readonly kind: "object"; readonly design: S.ObjectDesign }
  | { readonly kind: "space"; readonly design: S.SpaceDesign }
  | { readonly kind: "place"; readonly design: S.PlaceDesign }
  | { readonly kind: "region"; readonly design: S.RegionDesign }
  | { readonly kind: "world"; readonly design: S.WorldDesign };
export function designNode(library: S.SpatialLibrary, ref: S.SpatialDesignReference): DesignNode {
  switch (ref.kind) {
    case "object": return { kind: ref.kind, design: own(library.objects, ref.id) };
    case "space": return { kind: ref.kind, design: own(library.spaces, ref.id) };
    case "place": return { kind: ref.kind, design: own(library.places, ref.id) };
    case "region": return { kind: ref.kind, design: own(library.regions, ref.id) };
    case "world": return { kind: ref.kind, design: own(library.worlds, ref.id) };
    default: return assertNever(ref.kind);
  }
}
export type ExpansionSlot = S.SpatialChildSlot<S.SpatialKind> & {
  readonly quantity: number; readonly chipOverrides?: readonly string[];
};
/** Ordered edges; quantity is not expanded until cardinality preflight succeeds. */
export function designSlots(node: DesignNode): readonly ExpansionSlot[] {
  switch (node.kind) {
    case "object": return [];
    case "space": return node.design.objectSlots.map(slot => ({
      id: slot.id, source: { kind: "object", id: slot.objectDesignId }, quantity: slot.quantity,
      ...placementPoint(slot.placement), level: 0,
      ...(slot.chipOverrides === undefined ? {} : { chipOverrides: slot.chipOverrides }),
    }));
    case "place": return node.design.children.map(slot => ({ ...slot, quantity: 1 }));
    case "region": return node.design.places.map(slot => ({ ...slot, quantity: 1 }));
    case "world": return node.design.regions.map(slot => ({ ...slot, quantity: 1 }));
    default: return assertNever(node);
  }
}
function placementPoint(placement: S.SpatialObjectSlot["placement"]): S.SpatialPoint {
  switch (placement.mode) {
    case "auto": return { x: 0, y: 0 };
    case "fixed": return { x: placement.x, y: placement.y };
    default: return assertNever(placement);
  }
}
export function nodePorts(node: DesignNode): readonly S.SpatialPort[] {
  switch (node.kind) {
    case "object": return node.design.anchors;
    case "space": case "place": case "region": case "world": return node.design.ports;
    default: return assertNever(node);
  }
}
export function nodeConnections(node: DesignNode): readonly S.SpatialLocalConnection[] {
  switch (node.kind) {
    case "object": case "space": return [];
    case "place": case "world": return node.design.connections;
    case "region": return node.design.routes;
    default: return assertNever(node);
  }
}
/** Fresh-ID constructors, not read APIs for persisted opaque identities.
 * Length-prefixed tuples avoid collisions without exponential nested escaping. */
export function occurrenceChildId(parent: S.SpatialId, slot: S.SpatialId, index: number): S.SpatialId {
  return spatialId(`child:${parent.length}:${parent}${slot.length}:${slot}:${index}`);
}
export function occurrencePortId(occurrence: S.SpatialId, port: S.SpatialId): S.SpatialId {
  return spatialId(`port:${occurrence.length}:${occurrence}${port.length}:${port}`);
}
/** Parsed copies are acyclic plain records; freezing never freezes caller-owned assets. */
export function freezeSpatial<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeSpatial(child);
    Object.freeze(value);
  }
  return value;
}
export function checkedDocument(input: unknown, assets: S.SpatialAssetContext): S.SpatialAuthoringDocument {
  const document = validateSpatialAuthoring(input);
  validateSpatialReferences(document, assets);
  for (const occurrence of Object.values(document.occurrences)) {
    for (const [id, kit] of Object.entries(occurrence.snapshot.kitCells)) {
      if (kit.cells.length === 0 || kit.cells.every(cell => cell.tile === -1)) {
        throw new SpatialOperationError("raster", `occurrences.${occurrence.id}.snapshot.kitCells.${id}.cells`);
      }
    }
  }
  return document;
}
