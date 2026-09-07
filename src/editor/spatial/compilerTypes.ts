import type { ConceptPlacement } from "../interiorConceptCompose";
import type { Project, GameMap } from "@/project/types";
import type { SpatialAssociatedOccurrence, SpatialAuthoringDocument, SpatialCompiledBinding, SpatialId, SpatialPoint, SpatialRect } from "@/project/spatial/types";

export type SpatialStampTarget = {
  readonly mapId: string; readonly rect: SpatialRect; readonly entry: SpatialPoint;
};
export type SpatialCompileRequest = {
  readonly occurrenceId: SpatialId; readonly target?: SpatialStampTarget;
};
export type SpatialCompileContext = {
  readonly project: Project; readonly document: SpatialAuthoringDocument;
  readonly occurrence: SpatialAssociatedOccurrence;
};
export type CompiledObject = {
  readonly occurrence: SpatialAssociatedOccurrence;
  readonly placement: ConceptPlacement;
  readonly origin: SpatialPoint;
  readonly rect: SpatialRect;
};
export type SpatialRasterProposal = {
  readonly map: GameMap; readonly entry: SpatialPoint;
  readonly rect: SpatialRect;
  readonly objects: readonly CompiledObject[];
  readonly ports: SpatialCompiledBinding["ports"];
  readonly omitted: readonly SpatialId[];
};
export type SpatialCompileCode = "kind" | "target" | "atlas" | "clipped" | "blocked" | "required" | "port" | "material" | "ownership" | "connection" | "raster" | "entry";
export class SpatialCompileError extends Error {
  readonly name = "SpatialCompileError";
  constructor(readonly code: SpatialCompileCode, readonly path: string) { super(`${code}: ${path}`); }
}
