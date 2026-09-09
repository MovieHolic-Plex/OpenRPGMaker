import { assertNever, own, requireOccurrenceAssociations } from "@/project/spatial/domain";
import type { SpatialAuthoringDocument, SpatialId } from "@/project/spatial/types";
import { SpatialCompileError, type SpatialCompileRequest, type SpatialStampTarget } from "./compilerTypes";

/** Parsed, acyclic actual containment owns compilation, never source IDs or projection maps.
 * The compiler retains final raster/external connection/overview write-set authority.
 */
export function spatialAuthoringCompileScope(
  document: SpatialAuthoringDocument,
  occurrenceId: SpatialId,
  target?: SpatialStampTarget,
): SpatialCompileRequest {
  let owner = requireOccurrenceAssociations(own(document.occurrences, occurrenceId));
  while (owner.parentId !== null) owner = requireOccurrenceAssociations(own(document.occurrences, owner.parentId));
  switch (owner.kind) {
    case "object":
      if (!target) throw new SpatialCompileError("target", owner.id);
      return { occurrenceId: owner.id, target };
    case "space": case "place": case "region": case "world":
      if (target) throw new SpatialCompileError("target", owner.id);
      return { occurrenceId: owner.id };
    default: return assertNever(owner);
  }
}
