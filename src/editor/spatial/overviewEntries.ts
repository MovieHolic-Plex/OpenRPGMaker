import { isPassableLanding } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import { hasOverviewRouteRepresentation, overviewDesign, resolveOverviewEndpoint, sameSpatialEndpoint, spatialEventOwner, spatialPortLanding } from "@/project/spatial/overview";
import { validateSpatialProject } from "@/project/spatial/overviewPairs";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { SpatialCompileError } from "./compilerTypes";

/** Separate source resolver: an overview marker never changes ordinary port resolution. */
export function resolveOverviewEntry(document: SpatialAuthoringDocument, ownerId: SpatialId, target: SpatialConnection["from"]) {
  const owner = own(document.occurrences, ownerId);
  const matches = owner.bindings.filter(isOwnedSpatialBinding).flatMap(binding => binding.overviewEntries
    ?.filter(entry => sameSpatialEndpoint(entry.target, target)).map(entry => ({ mapId: binding.mapId, ...entry })) ?? []);
  const entry = matches[0];
  if (matches.length !== 1 || !entry) throw new SpatialCompileError("port", target.portId);
  return entry;
}
/** Acceptance for diagnostic/producer output, not a geography generator. */
export function validateOverviewAccess(project: Project, ownerId: SpatialId, start: { readonly mapId: string; readonly x: number; readonly y: number }): void {
  const document = project.spatialAuthoring;
  if (!document) throw new SpatialCompileError("target", ownerId);
  validateSpatialProject(document, project);
  const owner = own(document.occurrences, ownerId);
  const design = overviewDesign(owner);
  const bindings = owner.bindings.filter(isOwnedSpatialBinding);
  for (const local of "routes" in design ? design.routes : design.connections) {
    const link = document.connections.find(link => link.overviewRoute?.occurrenceId === ownerId && link.overviewRoute.localConnectionId === local.id);
    if (!link || !link.bidirectional || !bindings.some(binding => binding.connectionIds.includes(link.id) && hasOverviewRouteRepresentation(owner, binding, link))) {
      throw new SpatialCompileError("connection", local.id);
    }
  }
  if ("entryPort" in design) {
    const selected = resolveOverviewEndpoint(document, ownerId, design.entryPort);
    if (design.entryPort.childId !== null) resolveOverviewEntry(document, ownerId, selected);
    else if (!spatialPortLanding(document, selected)) throw new SpatialCompileError("entry", selected.portId);
  }
  const map = own(project.maps, start.mapId);
  if (!bindings.some(binding => binding.mapId === start.mapId && start.x >= binding.rect.x && start.y >= binding.rect.y &&
    start.x < binding.rect.x + binding.rect.width && start.y < binding.rect.y + binding.rect.height) ||
    !isPassableLanding(project, map, start.x, start.y)) throw new SpatialCompileError("entry", ownerId);
  const reached = computeReachableCells(project, map, start.x, start.y);
  for (const binding of bindings) for (const port of binding.ports) {
    if (binding.mapId !== start.mapId || !reached.has(`${port.x},${port.y}`) || !isPassableLanding(project, map, port.x, port.y)) {
      throw new SpatialCompileError("port", port.portId);
    }
  }
  for (const binding of bindings) for (const entry of binding.overviewEntries ?? []) {
    const landing = spatialPortLanding(document, entry.target);
    if (binding.mapId !== start.mapId || !reached.has(`${entry.x},${entry.y}`) || !landing ||
      !isPassableLanding(project, own(project.maps, landing.mapId), landing.x, landing.y)) throw new SpatialCompileError("port", entry.target.portId);
  }
}
/** Entry references only block partial writes; they never grant cross-map cleanup authority. */
export function requireOverviewWriteSet(document: SpatialAuthoringDocument, members: ReadonlySet<SpatialId>): void {
  for (const owner of Object.values(document.occurrences)) for (const binding of owner.bindings.filter(isOwnedSpatialBinding)) {
    for (const entry of binding.overviewEntries ?? []) {
      const landing = spatialPortLanding(document, entry.target);
      const reverse = landing && spatialEventOwner(document, { mapId: landing.mapId, eventId: entry.returnEventId });
      if (!reverse) throw new SpatialCompileError("ownership", entry.returnEventId);
      const affected = members.has(owner.id) || members.has(entry.target.occurrenceId) || members.has(reverse.occurrenceId);
      if (affected && (!members.has(owner.id) || !members.has(entry.target.occurrenceId) || !members.has(reverse.occurrenceId))) {
        throw new SpatialCompileError("ownership", entry.eventId);
      }
    }
  }
}
