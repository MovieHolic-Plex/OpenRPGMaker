import { checkedDocument, findOccurrenceChildId, occurrencePortId, own, requireOccurrenceAssociations, spatialId } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { deleteSpatialOccurrence, occurrenceSubtree, type SpatialDeletion } from "@/project/spatial/ownership";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import type { SpatialAssociatedOccurrence, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

/** Explicitly resolve today's source while matching retained identity by stored slot/local-port associations. */
export function refreshSpatialAuthoring(project: Project, request: SpatialDeletion): void {
  const document = checkedDocument(project.spatialAuthoring, project);
  const original = requireOccurrenceAssociations(own(document.occurrences, request.occurrenceId));
  const removed = deleteSpatialOccurrence(document, project, request);
  const fresh = instantiateSpatialDesign(removed, project, {
    source: original.source, rootId: original.id, x: original.x, y: original.y, level: original.level,
    seed: original.seed, generatorVersion: original.generatorVersion,
  });
  // Reserve persisted identities before traversing: a missing parent's allocated ID must
  // never look like a retained parent, including one visited later in the transitive tree.
  const reserved = new Set<SpatialId>([
    ...Object.values(document.library).flatMap(collection => Object.values(collection).map(design => design.id)),
    ...Object.values(document.occurrences).flatMap(entry => [entry.id, ...entry.snapshot.ports.map(port => port.id)]),
    ...fresh.connections.map(link => link.id),
  ]);
  const allocate = (preferred: SpatialId): SpatialId => {
    let id = preferred;
    for (let suffix = 1; reserved.has(id); suffix++) id = spatialId(`refresh:${preferred.length}:${preferred}:${suffix}`);
    reserved.add(id);
    return id;
  };
  const ids = new Map<SpatialId, SpatialId>();
  const ports = new Map<SpatialId, SpatialId>();
  const replacements: SpatialAssociatedOccurrence[] = [];
  const freshIds = new Set(occurrenceSubtree(fresh, original.id));
  for (const id of freshIds) {
    const entry = requireOccurrenceAssociations(own(fresh.occurrences, id));
    const parentId = entry.parentId === null ? null : ids.get(entry.parentId);
    if (parentId === undefined) throw new TypeError("Refresh traversal must be parent-first");
    const retainedId = entry.parentSlot === null ? original.id
      : parentId !== null && Object.hasOwn(document.occurrences, parentId)
        ? findOccurrenceChildId(document, parentId, entry.parentSlot) : undefined;
    const nextId = retainedId ?? allocate(entry.id);
    ids.set(entry.id, nextId);
    const previous = retainedId === undefined ? undefined : requireOccurrenceAssociations(own(document.occurrences, retainedId));
    const nextPorts = entry.snapshot.ports.map(port => {
      const portId = previous?.snapshot.ports.find(value => value.localPortId === port.localPortId)?.id
        ?? allocate(occurrencePortId(nextId, port.localPortId));
      ports.set(port.id, portId);
      return { ...port, id: portId };
    });
    const parent = entry.id === original.id
      ? { parentId: original.parentId, parentSlot: original.parentSlot }
      : { parentId, parentSlot: entry.parentSlot };
    const bindings = (previous?.bindings ?? []).map(binding => {
      const retainedPorts = binding.ports.filter(port => nextPorts.some(next => next.id === port.portId));
      if (retainedPorts.length === binding.ports.length) return binding;
      if (!isOwnedSpatialBinding(binding)) return { ...binding, ports: retainedPorts };
      const map = own(project.maps, binding.mapId);
      if (spatialRasterDigest(map, binding) !== binding.contentDigest) throw new SpatialCompileError("ownership", binding.mapId);
      const next = { ...binding, ports: retainedPorts };
      return { ...next, contentDigest: spatialRasterDigest(map, next) };
    });
    const parsed = { ...entry, ...parent, id: nextId, snapshot: { ...entry.snapshot, ports: nextPorts }, bindings };
    // Preserve the discriminated union without a cast by splitting root/child construction.
    if (parsed.parentId === null) replacements.push({ ...entry, id: nextId, parentId: null, parentSlot: null,
      snapshot: parsed.snapshot, bindings: parsed.bindings });
    else {
      if (parsed.parentSlot === null) throw new TypeError("Contained refresh requires a stored parent slot");
      replacements.push({ ...entry, id: nextId, parentId: parsed.parentId, parentSlot: parsed.parentSlot,
        snapshot: parsed.snapshot, bindings: parsed.bindings });
    }
  }
  const endpoint = (value: typeof fresh.connections[number]["from"]) => ({
    occurrenceId: ids.get(value.occurrenceId) ?? value.occurrenceId,
    portId: ports.get(value.portId) ?? value.portId,
  });
  const connections = fresh.connections.map(link => ({ ...link, from: endpoint(link.from), to: endpoint(link.to) }));
  const retainedConnections = new Set(connections.map(link => link.id));
  project.spatialAuthoring = checkedDocument({ ...fresh,
    rootOccurrenceIds: document.rootOccurrenceIds,
    connections,
    occurrences: { ...removed.occurrences, ...Object.fromEntries(replacements.map(entry => [entry.id, { ...entry,
      bindings: entry.bindings.map(binding => isOwnedSpatialBinding(binding)
        ? { ...binding, connectionIds: binding.connectionIds.filter(id => retainedConnections.has(id)) } : binding),
    }])) },
  }, project);
}
