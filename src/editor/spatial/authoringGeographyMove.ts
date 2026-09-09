import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { assertNever, own } from "@/project/spatial/domain";
import { validateSpatialProject } from "@/project/spatial/overviewPairs";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import type { SpatialAuthoringDocument, SpatialId, SpatialOccurrence } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialAuthoringRequest } from "./authoringTypes";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";
import { compileGeographyEntries, releaseGeographyEntries } from "./geographyEntries";
import { requireOverviewWriteSet } from "./overviewEntries";

/** A private paired-output producer, never a new checkpoint or a validator bypass.
 * The caller has parsed the draft shape and proved maps/connections/tree/bindings equal to source.
 */
export function prepareGeographyMotion(input: Project & { readonly spatialAuthoring: SpatialAuthoringDocument }, request: SpatialAuthoringRequest,
  source: { readonly project: Project; readonly document: SpatialAuthoringDocument }): Project {
  switch (request.operation.kind) {
    case "edit": break;
    case "edit-connection": case "instantiate": case "clone-occurrence": case "clone-design":
    case "delete-occurrence": case "delete-design": case "detach": case "refresh": return input;
    default: return assertNever(request.operation);
  }
  const before = source.document;
  const authored = input.spatialAuthoring;
  const moved = new Map<SpatialId, SpatialOccurrence[]>();
  for (const previous of Object.values(before.occurrences)) {
    const next = authored.occurrences[previous.id];
    if (!next || previous.parentId === null || previous.x === next.x && previous.y === next.y && previous.level === next.level && previous.parentId === next.parentId) continue;
    const parent = own(before.occurrences, previous.parentId);
    switch (parent.kind) {
      case "region": case "world": break;
      case "object": case "space": case "place": continue;
      default: return assertNever(parent);
    }
    if (!parent.bindings.some(isOwnedSpatialBinding)) continue;
    const children = moved.get(parent.id) ?? [];
    children.push(next);
    moved.set(parent.id, children);
  }
  // Frozen/source edits are not member motion and acquire no paired-output authority.
  if (moved.size === 0) return input;
  const compile = request.compile;
  if (!compile || compile.target) throw new SpatialCompileError("target", "Geography motion requires its containing compile root");
  validateSpatialProject(before, source.project);
  if (JSON.stringify([before.rootOccurrenceIds, before.connections, Object.keys(before.occurrences).sort()]) !==
    JSON.stringify([authored.rootOccurrenceIds, authored.connections, Object.keys(authored.occurrences).sort()])) {
    throw new SpatialCompileError("ownership", "Motion cannot replace the protected graph");
  }
  for (const previous of Object.values(before.occurrences)) {
    const next = own(authored.occurrences, previous.id);
    if (JSON.stringify([previous.kind, previous.parentId, previous.parentSlot, previous.source, previous.snapshot.root, previous.snapshot.ports]) !==
      JSON.stringify([next.kind, next.parentId, next.parentSlot, next.source, next.snapshot.root, next.snapshot.ports])) {
      throw new SpatialCompileError("ownership", `${previous.id}: motion requires stable associations and ports`);
    }
  }
  const root = own(before.occurrences, compile.occurrenceId);
  switch (root.kind) {
    case "region": case "world": break;
    case "object": case "space": case "place": throw new SpatialCompileError("ownership", root.id);
    default: return assertNever(root);
  }
  const members = new Set(occurrenceSubtree(before, root.id));
  const proposedMembers = new Set(occurrenceSubtree(authored, root.id));
  for (const [parentId, children] of moved) {
    if (!members.has(parentId) || !proposedMembers.has(parentId) || children.some(child => !members.has(child.id) || !proposedMembers.has(child.id))) {
      throw new SpatialCompileError("ownership", "Compile scope must contain every moved geography member");
    }
  }
  requireOverviewWriteSet(before, members);
  requireOverviewWriteSet(authored, proposedMembers);
  // Validate ALL old digests against the immutable full checkpoint before any private output mutation.
  for (const id of members) for (const binding of own(before.occurrences, id).bindings.filter(isOwnedSpatialBinding)) {
    if (spatialRasterDigest(own(source.project.maps, binding.mapId), binding) !== binding.contentDigest) {
      throw new SpatialCompileError("ownership", binding.mapId);
    }
  }
  const motionIds = new Set([...moved.values()].flatMap(children => children.map(child => child.id)));
  // Old positions make the authored logical proposal reference-valid while old pairs are inspected.
  // This staging copy is NOT ownership proof: only source above authorizes the producer.
  let document: SpatialAuthoringDocument = { ...authored, occurrences: Object.fromEntries(Object.values(authored.occurrences).map(child => {
    const old = own(before.occurrences, child.id);
    return [child.id, motionIds.has(child.id) ? { ...child, x: old.x, y: old.y, level: old.level } : child];
  })) };
  const project = structuredClone({ ...input, spatialAuthoring: document });
  document = project.spatialAuthoring;
  validateSpatialProject(document, project);
  const eventOrder = new Map(Object.values(project.maps).map(map => [map.id, new Map(map.events.map((event, index) => [event.id, index]))]));
  const connectionOrder = new Map(project.mapConnections?.map((link, index) => [link.id, index]));
  const changedEvents = new Set<string>();
  for (const [parentId, children] of moved) {
    const parent = own(document.occurrences, parentId);
    const binding = parent.bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new SpatialCompileError("ownership", parentId);
    const selected = new Set(children.map(child => child.id));
    const targets = binding.overviewEntries?.filter(entry => selected.has(entry.target.occurrenceId)).map(entry => entry.target) ?? [];
    const released = releaseGeographyEntries(project, document, { ownerId: parentId, targets });
    for (const pair of released.previous.pairs) {
      changedEvents.add(pair.entry.eventId);
      changedEvents.add(pair.entry.returnEventId);
    }
    document = { ...released.document, occurrences: { ...released.document.occurrences,
      ...Object.fromEntries(children.map(child => [child.id, { ...own(released.document.occurrences, child.id), x: child.x, y: child.y, level: child.level }])) } };
    const map = own(project.maps, binding.mapId);
    const compiled = compileGeographyEntries(project, document, { ownerId: parentId, map, targets, previous: released.previous });
    const extent = { ...binding, ...(binding.overviewEntries ? { overviewEntries: binding.overviewEntries.map(entry =>
      compiled.entries.find(next => next.eventId === entry.eventId) ?? entry) } : {}) };
    const currentParent = own(compiled.document.occurrences, parentId);
    document = { ...compiled.document, occurrences: { ...compiled.document.occurrences, [parentId]: { ...currentParent,
      bindings: currentParent.bindings.map(current => current.mapId === binding.mapId
        ? { ...extent, contentDigest: spatialRasterDigest(map, extent) } : current) } } };
    project.spatialAuthoring = document;
  }
  for (const map of Object.values(project.maps)) if (map.events.some(event => changedEvents.has(event.id))) {
    const order = eventOrder.get(map.id);
    map.events.sort((a, b) => (order?.get(a.id) ?? Infinity) - (order?.get(b.id) ?? Infinity));
  }
  project.mapConnections?.sort((a, b) => (connectionOrder.get(a.id) ?? Infinity) - (connectionOrder.get(b.id) ?? Infinity));
  project.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(owner => [owner.id, { ...owner,
    bindings: owner.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding) || !binding.eventIds.some(id => changedEvents.has(id))) return binding;
      const previous = own(before.occurrences, owner.id).bindings.filter(isOwnedSpatialBinding).find(previous => previous.mapId === binding.mapId);
      const order = new Map(previous?.eventIds.map((id, index) => [id, index]));
      const extent = { ...binding, eventIds: [...binding.eventIds].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)) };
      return { ...extent, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), extent) };
    }) }])) };
  validateSpatialProject(project.spatialAuthoring, project);
  return project;
}
