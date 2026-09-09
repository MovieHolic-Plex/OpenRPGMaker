import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { freezeSpatial, own } from "@/project/spatial/domain";
import { hasOverviewRouteRepresentation, sameSpatialEndpoint } from "@/project/spatial/overview";
import { validateSpatialProject } from "@/project/spatial/overviewPairs";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId, SpatialOccurrence, SpatialOverviewEntry } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { createHouseDoorStepEvent } from "../houseInteriors";
import { resolveCompiledPort } from "./compileConnections";
import { containsPoint } from "./compileObjects";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

const provenPairs = Symbol("proven-geography-pairs");
type SavedPair = {
  readonly entry: SpatialOverviewEntry;
  readonly transfers: readonly { readonly event: GameMap["events"][number]; readonly connection: NonNullable<Project["mapConnections"]>[number] }[];
};
type ProvenPairs = { readonly [provenPairs]: true; readonly pairs: readonly SavedPair[] };

/** Validate old output before retiring exact selected pairs. Descendant and sibling entries remain intact. */
export function releaseGeographyEntries(project: Project, document: SpatialAuthoringDocument, selection: {
  readonly ownerId: SpatialId; readonly targets?: readonly SpatialConnection["from"][];
}): { readonly document: SpatialAuthoringDocument; readonly previous: ProvenPairs } {
  validateSpatialProject(document, project);
  for (const id of occurrenceSubtree(document, selection.ownerId)) for (const binding of own(document.occurrences, id).bindings.filter(isOwnedSpatialBinding)) {
    if (spatialRasterDigest(own(project.maps, binding.mapId), binding) !== binding.contentDigest) throw new SpatialCompileError("ownership", binding.mapId);
  }
  const owner = own(document.occurrences, selection.ownerId);
  const pairs: SavedPair[] = [];
  const removed = new Set<string>();
  const mapEvents = new Map<string, Set<string>>();
  for (const binding of owner.bindings.filter(isOwnedSpatialBinding)) for (const entry of binding.overviewEntries ?? []) {
    if (selection.targets && !selection.targets.some(target => sameSpatialEndpoint(target, entry.target))) continue;
    const landing = resolveCompiledPort({ project, occurrences: document.occurrences }, entry.target);
    const transfers = [{ mapId: binding.mapId, id: entry.eventId }, { mapId: landing.mapId, id: entry.returnEventId }].map(pair => {
      const event = own(project.maps, pair.mapId).events.find(event => event.id === pair.id);
      const connection = project.mapConnections?.find(link => link.id === pair.id);
      if (!event || !connection) throw new SpatialCompileError("ownership", pair.id);
      removed.add(pair.id);
      const ids = mapEvents.get(pair.mapId) ?? new Set<string>();
      ids.add(pair.id);
      mapEvents.set(pair.mapId, ids);
      return { event: structuredClone(event), connection: structuredClone(connection) };
    });
    pairs.push({ entry: structuredClone(entry), transfers });
  }
  // All owner/event/pair/digest checks finished before the first private output write.
  for (const [mapId, ids] of mapEvents) {
    const map = own(project.maps, mapId);
    map.events = map.events.filter(event => !ids.has(event.id));
  }
  if (project.mapConnections) project.mapConnections = project.mapConnections.filter(link => !removed.has(link.id));
  const occurrences = Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
    bindings: occurrence.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding) || !binding.eventIds.some(id => removed.has(id))) return binding;
      const { overviewEntries, ...previous } = binding;
      const retained = overviewEntries?.filter(entry => !removed.has(entry.eventId));
      const extent = { ...previous, ...(retained?.length ? { overviewEntries: retained } : {}),
        eventIds: binding.eventIds.filter(id => !mapEvents.get(binding.mapId)?.has(id)) };
      const next = { ...extent, connectionIds: binding.connectionIds.filter(id => !document.connections.some(link =>
        link.id === id && link.overviewRoute?.occurrenceId === occurrence.id && !hasOverviewRouteRepresentation(occurrence, extent, link))) };
      return { ...next, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), next) };
    }) }]));
  return { document: { ...document, occurrences }, previous: freezeSpatial({ [provenPairs]: true as const, pairs }) };
}

/** Target identity selects a single entry; containment alone never emits an event. */
export function compileGeographyEntries(project: Project, document: SpatialAuthoringDocument, input: {
  readonly ownerId: SpatialId; readonly map: GameMap; readonly targets: readonly SpatialConnection["from"][];
  readonly previous?: ProvenPairs;
}): { readonly document: SpatialAuthoringDocument; readonly entries: readonly SpatialOverviewEntry[] } {
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  const entries: SpatialOverviewEntry[] = [];
  for (const target of input.targets) {
    if (target.occurrenceId === input.ownerId || entries.some(entry => sameSpatialEndpoint(entry.target, target))) continue;
    const child = own(occurrences, target.occurrenceId);
    const from = { mapId: input.map.id, x: child.x, y: child.y };
    const to = resolveCompiledPort({ project, occurrences }, target);
    const owner = Object.values(occurrences).find(occurrence => occurrence.bindings.some(binding =>
      isOwnedSpatialBinding(binding) && binding.mapId === to.mapId && containsPoint(binding.rect, to)));
    if (!owner) throw new SpatialCompileError("ownership", target.portId);
    const key = `${input.ownerId.length}:${input.ownerId}:${target.portId.length}:${target.portId}`;
    const saved = input.previous?.pairs.find(pair => sameSpatialEndpoint(pair.entry.target, target));
    const eventId = saved?.entry.eventId ?? `spatial-enter:${key}`;
    const returnEventId = saved?.entry.returnEventId ?? `spatial-return:${key}`;
    for (const pair of [{ id: eventId, from, to }, { id: returnEventId, from: to, to: from }]) {
      const map = own(project.maps, pair.from.mapId);
      if (map.events.some(event => event.id === pair.id || event.x === pair.from.x && event.y === pair.from.y) ||
        project.mapConnections?.some(link => link.id === pair.id || link.from.mapId === map.id && link.from.x === pair.from.x && link.from.y === pair.from.y)) {
        throw new SpatialCompileError("connection", pair.id);
      }
      const prior = saved?.transfers.find(transfer => transfer.connection.id === pair.id);
      const unchanged = prior && JSON.stringify([prior.connection.from, prior.connection.to]) === JSON.stringify([pair.from, pair.to]);
      map.events.push(unchanged ? structuredClone(prior.event) : createHouseDoorStepEvent({ eventId: pair.id, x: pair.from.x, y: pair.from.y,
        interiorMapId: pair.to.mapId, entryX: pair.to.x, entryY: pair.to.y }));
      (project.mapConnections ??= []).push(unchanged ? structuredClone(prior.connection) : { ...pair, playerEnabled: true, npcEnabled: true });
    }
    occurrences[owner.id] = { ...owner, bindings: owner.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding) || binding.mapId !== to.mapId || !containsPoint(binding.rect, to)) return binding;
      const extent = { ...binding, eventIds: [...binding.eventIds, returnEventId] };
      return { ...extent, contentDigest: spatialRasterDigest(own(project.maps, to.mapId), extent) };
    }) };
    entries.push({ target, x: from.x, y: from.y, eventId, returnEventId });
  }
  return { document: { ...document, occurrences }, entries };
}
