import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { assertNever, checkedDocument } from "@/project/spatial/domain";
import type { SpatialConnection, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialConnectionEdit } from "./authoringTypes";
import { releaseAuthoringOverviewEntries } from "./authoringOverview";
import { SpatialCompileError } from "./compilerTypes";

/** Private proposal mutation: release the old exact edge before validating its replacement. */
export function editSpatialAuthoringConnection(project: Project, request: SpatialConnectionEdit): void {
  const before = checkedDocument(project.spatialAuthoring, project);
  switch (request.kind) {
    case "create": case "replace":
      if ("overviewRoute" in request.connection && request.connection.overviewRoute !== undefined) {
        throw new SpatialCompileError("connection", "Overview routes require their geography authoring operation");
      }
      break;
    case "remove": break;
    default: return assertNever(request);
  }
  let id: SpatialId;
  let connections: readonly SpatialConnection[];
  switch (request.kind) {
    case "create":
      // checkedDocument also enforces uniqueness against every occurrence, port and source ID.
      project.spatialAuthoring = checkedDocument({ ...before, connections: [...before.connections, request.connection] }, project);
      return;
    case "replace":
      id = request.connection.id;
      connections = before.connections.map(link => link.id === id ? request.connection : link);
      break;
    case "remove":
      id = request.connectionId;
      connections = before.connections.filter(link => link.id !== id);
      break;
    default: return assertNever(request);
  }
  const old = before.connections.find(link => link.id === id);
  if (!old || old.overviewRoute !== undefined) throw new SpatialCompileError("connection", id);
  const released = { ...before, connections: before.connections.filter(link => link.id !== id),
    occurrences: Object.fromEntries(Object.values(before.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
      bindings: occurrence.bindings.map(binding => isOwnedSpatialBinding(binding)
        ? { ...binding, connectionIds: binding.connectionIds.filter(value => value !== id) } : binding),
    }])),
  };
  const cleaned = releaseAuthoringOverviewEntries(project, before, released).after;
  project.spatialAuthoring = checkedDocument({ ...cleaned, connections }, project);
}
