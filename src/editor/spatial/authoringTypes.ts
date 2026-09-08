import type { Project } from "@/project/types";
import type { SpatialDesignReference, SpatialId } from "@/project/spatial/types";
import type { SpatialInstantiation } from "@/project/spatial/instances";
import type { SpatialDuplication } from "@/project/spatial/duplicate";
import type { SpatialDeletion } from "@/project/spatial/ownership";
import type { SpatialCompileRequest } from "./compilerTypes";

/** Detached working copy. Panels may edit project; baseline is controller-owned. */
export type SpatialAuthoringDraft = { readonly project: Project };
export type SpatialAuthoringOperation =
  | { readonly kind: "edit" }
  | { readonly kind: "instantiate"; readonly request: SpatialInstantiation }
  | { readonly kind: "clone-occurrence"; readonly request: SpatialDuplication }
  | { readonly kind: "clone-design"; readonly source: SpatialDesignReference; readonly id: SpatialId; readonly name: string }
  | { readonly kind: "delete-occurrence"; readonly request: SpatialDeletion }
  | { readonly kind: "delete-design"; readonly source: SpatialDesignReference }
  | { readonly kind: "detach"; readonly occurrenceId: SpatialId }
  | { readonly kind: "refresh"; readonly request: SpatialDeletion };
export type SpatialAuthoringRequest = {
  readonly operation: SpatialAuthoringOperation;
  /** Compilation is explicit, never an implicit refresh of frozen instances. */
  readonly compile?: SpatialCompileRequest;
};
export type SpatialAuthoringImpact = {
  readonly mapIds: readonly string[];
  readonly occurrenceIds: readonly SpatialId[];
  /** Exact removed or changed events, including incoming overview transfers. */
  readonly events: readonly { readonly mapId: string; readonly eventId: string }[];
};
/** Display-only frozen proposal. Only the issuing controller can apply it once. */
export type SpatialAuthoringPreview = {
  readonly project: Project;
  readonly impact: SpatialAuthoringImpact;
};
export type SpatialAuthoringError = {
  readonly code: "invalid" | "unsupported" | "ownership" | "stale" | "foreign-draft" | "foreign-preview" | "already-applied";
  readonly message: string;
  readonly detail?: string;
};
export type SpatialAuthoringResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "error"; readonly error: SpatialAuthoringError };
export type SpatialAuthoringApplied = { readonly changed: boolean; readonly impact: SpatialAuthoringImpact };
/** Uses the existing singleton project store and project history, not panel persistence. */
export interface SpatialAuthoringController {
  createDraft(): SpatialAuthoringResult<SpatialAuthoringDraft>;
  preview(draft: SpatialAuthoringDraft, request: SpatialAuthoringRequest): SpatialAuthoringResult<SpatialAuthoringPreview>;
  apply(preview: SpatialAuthoringPreview): SpatialAuthoringResult<SpatialAuthoringApplied>;
  undo(): boolean;
  redo(): boolean;
}
/** Runtime implementation is exported by ./actions (no runtime export in this contract). */
export type CreateSpatialAuthoringController = () => SpatialAuthoringController;
