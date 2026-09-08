import { assertNever, checkedDocument, designNode, SpatialOperationError } from "@/project/spatial/domain";
import { duplicateSpatialOccurrence } from "@/project/spatial/duplicate";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { deleteSpatialDesign, deleteSpatialOccurrence, detachSpatialOccurrence } from "@/project/spatial/ownership";
import type { Project } from "@/project/types";
import type { SpatialAuthoringOperation } from "./authoringTypes";
import { refreshSpatialAuthoring } from "./authoringRefresh";

/** Mutates only the private proposal builder. Domain APIs keep frozen identity semantics. */
export function applySpatialAuthoringOperation(project: Project, operation: SpatialAuthoringOperation): void {
  const document = checkedDocument(project.spatialAuthoring, project);
  switch (operation.kind) {
    case "edit": return;
    case "instantiate":
      project.spatialAuthoring = instantiateSpatialDesign(document, project, operation.request); return;
    case "clone-occurrence":
      project.spatialAuthoring = duplicateSpatialOccurrence(document, project, operation.request); return;
    case "clone-design": {
      const node = designNode(document.library, operation.source);
      const collections = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const;
      if (Object.values(document.library).some(records => Object.hasOwn(records, operation.id))) throw new SpatialOperationError("id", operation.id);
      const collection = collections[node.kind];
      const design = { ...node.design, id: operation.id, name: operation.name, revision: 1, provenance: { origin: "user" as const } };
      project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library,
        [collection]: { ...document.library[collection], [operation.id]: design } } }, project);
      return;
    }
    case "delete-design":
      project.spatialAuthoring = deleteSpatialDesign(document, project, operation.source); return;
    case "delete-occurrence":
      project.spatialAuthoring = deleteSpatialOccurrence(document, project, operation.request); return;
    case "detach":
      project.spatialAuthoring = detachSpatialOccurrence(document, project, operation.occurrenceId); return;
    case "refresh":
      refreshSpatialAuthoring(project, operation.request); return;
    default: return assertNever(operation);
  }
}
