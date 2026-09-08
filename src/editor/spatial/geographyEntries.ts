import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import { sameSpatialEndpoint } from "@/project/spatial/overview";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId, SpatialOccurrence, SpatialOverviewEntry } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { createHouseDoorStepEvent } from "../houseInteriors";
import { resolveCompiledPort } from "./compileConnections";
import { containsPoint } from "./compileObjects";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

/** Release only exact overview event pairs after proving all original member digests. */
export function releaseGeographyEntries(project: Project, document: SpatialAuthoringDocument, members: ReadonlySet<SpatialId>): SpatialAuthoringDocument {
  const removed = new Set<string>();
  const mapEvents = new Map<string, Set<string>>();
  for (const id of members) for (const binding of own(document.occurrences, id).bindings.filter(isOwnedSpatialBinding)) {
    if (spatialRasterDigest(own(project.maps, binding.mapId), binding) !== binding.contentDigest) throw new SpatialCompileError("ownership", binding.mapId);
    for (const entry of binding.overviewEntries ?? []) {
      const landing = resolveCompiledPort({ project, occurrences: document.occurrences }, entry.target);
      for (const pair of [{ mapId: binding.mapId, id: entry.eventId }, { mapId: landing.mapId, id: entry.returnEventId }]) {
        removed.add(pair.id);
        const ids = mapEvents.get(pair.mapId) ?? new Set<string>();
        ids.add(pair.id);
        mapEvents.set(pair.mapId, ids);
      }
    }
  }
  for (const [mapId, ids] of mapEvents) {
    const map = own(project.maps, mapId);
    map.events = map.events.filter(event => !ids.has(event.id));
  }
  if (project.mapConnections) project.mapConnections = project.mapConnections.filter(link => !removed.has(link.id));
  return { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id,
    members.has(occurrence.id) ? { ...occurrence, bindings: occurrence.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding)) return binding;
      const { overviewEntries: _entries, ...previous } = binding;
      const extent = { ...previous, eventIds: binding.eventIds.filter(id => !mapEvents.get(binding.mapId)?.has(id)),
        connectionIds: binding.connectionIds.filter(id => !document.connections.some(link => link.id === id && link.overviewRoute && members.has(link.overviewRoute.occurrenceId))) };
      return { ...extent, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), extent) };
    }) } : occurrence])) };
}

/** Target identity selects a single entry; containment alone never emits an event. */
export function compileGeographyEntries(project: Project, document: SpatialAuthoringDocument, input: {
  readonly ownerId: SpatialId; readonly map: GameMap; readonly targets: readonly SpatialConnection["from"][];
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
    const eventId = `spatial-enter:${key}`;
    const returnEventId = `spatial-return:${key}`;
    for (const pair of [{ id: eventId, from, to }, { id: returnEventId, from: to, to: from }]) {
      const map = own(project.maps, pair.from.mapId);
      if (map.events.some(event => event.id === pair.id || event.x === pair.from.x && event.y === pair.from.y) ||
        project.mapConnections?.some(link => link.id === pair.id || link.from.mapId === map.id && link.from.x === pair.from.x && link.from.y === pair.from.y)) {
        throw new SpatialCompileError("connection", pair.id);
      }
      map.events.push(createHouseDoorStepEvent({ eventId: pair.id, x: pair.from.x, y: pair.from.y,
        interiorMapId: pair.to.mapId, entryX: pair.to.x, entryY: pair.to.y }));
      (project.mapConnections ??= []).push({ ...pair, playerEnabled: true, npcEnabled: true });
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
