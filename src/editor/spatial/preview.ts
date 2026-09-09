import { deserialize } from "@/project/io";
import { assertNever, checkedDocument, freezeSpatial, own, spatialId } from "@/project/spatial/domain";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import type { SpatialConnection } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialAuthoringPreview, SpatialAuthoringRequest } from "./authoringTypes";
import { applySpatialAuthoringOperation } from "./authoringOperations";
import { compileSpatialOccurrence } from "./compileSpatialOccurrence";
import { SpatialCompileError } from "./compilerTypes";
import { releaseAuthoringOverviewEntries } from "./authoringOverview";
import { releasePlaceOwnership } from "./placeOwnership";
import { prepareGeographyMotion } from "./authoringGeographyMove";

/** Protected output comes from the controller checkpoint; impact covers the original live proposal. */
export function previewSpatialAuthoring(input: Project, request: SpatialAuthoringRequest,
  source: { readonly original: Project; readonly checkpoint: Project }): SpatialAuthoringPreview {
  const { original: baseline, checkpoint } = source;
  if (JSON.stringify([input.maps, input.mapConnections, input.mapTree]) !== JSON.stringify([checkpoint.maps, checkpoint.mapConnections, checkpoint.mapTree])) {
    throw new SpatialCompileError("ownership", "Raster edits require the map editor, not a spatial draft");
  }
  const protectedDocument = checkedDocument(checkpoint.spatialAuthoring, checkpoint);
  const authored = validateSpatialAuthoring(input.spatialAuthoring);
  for (const id of new Set([...Object.keys(protectedDocument.occurrences), ...Object.keys(authored.occurrences)])) {
    if (JSON.stringify(protectedDocument.occurrences[id]?.bindings ?? []) !== JSON.stringify(authored.occurrences[id]?.bindings ?? [])) {
      throw new SpatialCompileError("ownership", `${id}: use the explicit ownership operation`);
    }
  }
  const prepared = prepareGeographyMotion({ ...input, spatialAuthoring: authored }, request, { project: checkpoint, document: protectedDocument });
  const project = deserialize(JSON.stringify(prepared));
  const document = checkedDocument(project.spatialAuthoring, project);
  switch (request.operation.kind) {
    case "edit-connection": {
      if (!request.compile) throw new SpatialCompileError("target", "Connection edits require explicit containing compilation");
      if (JSON.stringify(document.connections) !== JSON.stringify(protectedDocument.connections)) {
        throw new SpatialCompileError("ownership", "Connection edits require the checkpoint's exact old graph");
      }
      const edit = request.operation.request;
      let links: readonly SpatialConnection[];
      switch (edit.kind) {
        case "create": links = [edit.connection]; break;
        case "replace": links = [...document.connections.filter(link => link.id === edit.connection.id), edit.connection]; break;
        case "remove": links = document.connections.filter(link => link.id === edit.connectionId); break;
        default: return assertNever(edit);
      }
      const members = new Set(occurrenceSubtree(document, request.compile.occurrenceId));
      if (links.some(link => !members.has(link.from.occurrenceId) || !members.has(link.to.occurrenceId))) {
        throw new SpatialCompileError("ownership", "Compilation must contain the old and new connection endpoints");
      }
      break;
    }
    case "refresh": {
      const members = occurrenceSubtree(document, request.operation.request.occurrenceId);
      if (!request.compile && members.some(id => own(document.occurrences, id).bindings.length > 0)) {
        throw new SpatialCompileError("target", "Refreshing compiled content requires explicit compilation");
      }
      break;
    }
    case "edit": case "instantiate": case "clone-occurrence": case "clone-design":
    case "delete-occurrence": case "delete-design": case "detach": break;
    default: return assertNever(request.operation);
  }
  applySpatialAuthoringOperation(project, request.operation);
  switch (request.operation.kind) {
    case "delete-occurrence": case "refresh": {
      const next = checkedDocument(project.spatialAuthoring, project);
      const cleaned = releaseAuthoringOverviewEntries(project, document, next);
      const removed = new Set(Object.values(document.occurrences).filter(entry => !Object.hasOwn(next.occurrences, entry.id)).map(entry => entry.id));
      releasePlaceOwnership(project, cleaned.before, removed);
      project.spatialAuthoring = cleaned.after;
      break;
    }
    case "edit": case "edit-connection": case "instantiate": case "clone-occurrence": case "clone-design": case "delete-design": case "detach": break;
    default: return assertNever(request.operation);
  }
  const proposed = request.compile ? compileSpatialOccurrence(project, request.compile,
    protectedDocument.occurrences[request.compile.occurrenceId]) : deserialize(JSON.stringify(project));
  const mapIds = [...new Set([...Object.keys(baseline.maps), ...Object.keys(proposed.maps)])]
    .filter(id => JSON.stringify(baseline.maps[id]) !== JSON.stringify(proposed.maps[id]));
  const original = checkedDocument(baseline.spatialAuthoring, baseline);
  const occurrenceIds = [...new Set([...Object.keys(original.occurrences), ...Object.keys(proposed.spatialAuthoring?.occurrences ?? {})])]
    .filter(id => JSON.stringify(original.occurrences[id]) !== JSON.stringify(proposed.spatialAuthoring?.occurrences[id])).map(spatialId);
  const events = mapIds.flatMap(mapId => (baseline.maps[mapId]?.events ?? [])
    .filter(event => JSON.stringify(event) !== JSON.stringify(proposed.maps[mapId]?.events.find(value => value.id === event.id)))
    .map(event => ({ mapId, eventId: event.id })));
  return freezeSpatial({ project: proposed, impact: { mapIds, occurrenceIds, events } });
}
