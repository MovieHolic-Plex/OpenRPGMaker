import { assert } from "../io/guards";
import { isOwnedSpatialBinding } from "./bindings";
import { assertNever, designNode, findOccurrenceChildId, own, requireOccurrenceAssociations, resolveOccurrencePortId } from "./domain";
import type * as S from "./types";

export function overviewDesign(occurrence: S.SpatialOccurrence): S.RegionDesign | S.WorldDesign {
  requireOccurrenceAssociations(occurrence);
  const node = designNode(occurrence.snapshot.library, occurrence.snapshot.root);
  switch (node.kind) {
    case "region": case "world": return node.design;
    case "object": case "space": case "place": assert(false, `occurrences.${occurrence.id}.overview: expected region/world`);
    default: return assertNever(node);
  }
}
export function sameSpatialEndpoint(a: S.SpatialConnection["from"], b: S.SpatialConnection["from"]): boolean {
  return a.occurrenceId === b.occurrenceId && a.portId === b.portId;
}
export function resolveOverviewEndpoint(document: S.SpatialAuthoringDocument, owner: S.SpatialId, local: S.SpatialLocalEndpoint): S.SpatialConnection["from"] {
  const occurrenceId = local.childId === null ? owner : findOccurrenceChildId(document, owner, { slotId: local.childId, index: 0 });
  assert(occurrenceId !== undefined, `occurrences.${owner}.overview: missing child slot ${local.childId}`);
  return { occurrenceId, portId: resolveOccurrencePortId(own(document.occurrences, occurrenceId), local.portId) };
}
export function validateOverviewRoutes(document: S.SpatialAuthoringDocument): void {
  const claimed = new Set<string>();
  for (const [index, connection] of document.connections.entries()) {
    const route = connection.overviewRoute;
    if (route === undefined) continue;
    const path = `spatialAuthoring.connections[${index}].overviewRoute`;
    const design = overviewDesign(own(document.occurrences, route.occurrenceId));
    const local = ("routes" in design ? design.routes : design.connections).find(link => link.id === route.localConnectionId);
    assert(local !== undefined, `${path}.localConnectionId: missing frozen route`);
    assert(sameSpatialEndpoint(connection.from, resolveOverviewEndpoint(document, route.occurrenceId, local.from)), `${path}.from: frozen endpoint mismatch`);
    assert(sameSpatialEndpoint(connection.to, resolveOverviewEndpoint(document, route.occurrenceId, local.to)), `${path}.to: frozen endpoint mismatch`);
    assert(connection.bidirectional === local.bidirectional, `${path}.bidirectional: frozen direction mismatch`);
    const key = JSON.stringify([route.occurrenceId, route.localConnectionId]);
    assert(!claimed.has(key), `${path}: duplicate route claim`);
    claimed.add(key);
  }
}
/** Ordinary bindings remain the only authority for a concrete landing. */
export function spatialPortLanding(document: S.SpatialAuthoringDocument, endpoint: S.SpatialConnection["from"]) {
  const occurrence = Object.hasOwn(document.occurrences, endpoint.occurrenceId) ? document.occurrences[endpoint.occurrenceId] : undefined;
  const matches = occurrence?.bindings.flatMap(binding => binding.ports.filter(port => port.portId === endpoint.portId)
    .map(port => ({ mapId: binding.mapId, x: port.x, y: port.y }))) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}
export function spatialEventOwner(document: S.SpatialAuthoringDocument, event: { readonly mapId: string; readonly eventId: string }) {
  return Object.values(document.occurrences).flatMap(occurrence => occurrence.bindings.filter(isOwnedSpatialBinding)
    .filter(binding => binding.mapId === event.mapId && binding.eventIds.includes(event.eventId))
    .map(binding => ({ occurrenceId: occurrence.id, binding })))[0];
}
export function overviewEntryAuthorized(document: S.SpatialAuthoringDocument, owner: S.SpatialOccurrence, binding: S.SpatialOwnedBinding): (entry: S.SpatialOverviewEntry) => boolean {
  const design = overviewDesign(owner);
  // A deleted world selector may leave an intentionally uncompiled, incomplete tree.
  const selector = "entryPort" in design ? design.entryPort : undefined;
  const child = selector?.childId == null ? undefined : findOccurrenceChildId(document, owner.id, { slotId: selector.childId, index: 0 });
  const worldEntry = selector && (selector.childId === null || child !== undefined)
    ? resolveOverviewEndpoint(document, owner.id, selector) : undefined;
  return entry => (worldEntry !== undefined && sameSpatialEndpoint(worldEntry, entry.target)) ||
    document.connections.some(link => binding.connectionIds.includes(link.id) && link.overviewRoute?.occurrenceId === owner.id &&
      [link.from, link.to].some(endpoint => sameSpatialEndpoint(endpoint, entry.target)));
}
/** Exact bookkeeping proof shared by IO and metadata-only ownership pruning. */
export function hasOverviewRouteRepresentation(owner: S.SpatialOccurrence, binding: S.SpatialOwnedBinding, link: S.SpatialConnection): boolean {
  return link.overviewRoute?.occurrenceId === owner.id && [link.from, link.to].every(endpoint =>
    endpoint.occurrenceId === owner.id
      ? binding.ports.some(port => port.portId === endpoint.portId)
      : binding.overviewEntries?.some(entry => sameSpatialEndpoint(entry.target, endpoint)) === true);
}
