import type { Project } from "../types";
import type { LegacySpatialConversion } from "./legacyImport";

export type RawJson = null | boolean | number | string | readonly RawJson[] | RawObject;
export type RawObject = { readonly [key: string]: RawJson };
declare const serverSHABrand: unique symbol;
/** Opaque server-issued CAS token. Never derive from editor serialization. */
export type ServerSHA = string & { readonly [serverSHABrand]: true };
export type PersistenceFault = "conflict" | "migration-required" | "http" | "invalid-response" | "invalid-project" | "sha-unavailable" | "unsupported-legacy-version" | "already-canonical";
export class SpatialPersistenceError extends Error {
  readonly name = "SpatialPersistenceError";
  constructor(readonly code: PersistenceFault, message: string, readonly status?: number) { super(message); }
}
export type RawMapRow = { readonly map_id: string; readonly map_json: RawJson };
export type RawLegacyCapture = {
  readonly projectId: string;
  readonly serverSHA: ServerSHA;
  readonly rawRoot: RawObject;
  readonly rawMapRows: readonly RawMapRow[];
  readonly baseline: RawObject;
  /** Normalized, independent copy for inspection only; not an activation baseline. */
  readonly preview: Project;
};
export type SpatialPublication =
  | { readonly operation: "create"; readonly project: Project }
  | { readonly operation: "update"; readonly project: Project; readonly serverSHA: ServerSHA }
  | { readonly operation: "activate"; readonly project: LegacySpatialConversion["raw"]; readonly capture: RawLegacyCapture };
export type AcceptedSpatialPublication = {
  readonly kind: "accepted";
  readonly projectId: string;
  readonly revision: number;
  readonly serverSHA: ServerSHA;
  /** Accepted ordinary JSON, including opaque archive and unknown raw legacy fields. */
  readonly project: RawObject;
  readonly preview: Project;
};
export type RootSnapshot = {
  readonly projectId: string;
  readonly rawRoot: RawObject;
  readonly preview: Project;
} & (
  | { readonly mode: "canonical"; readonly serverSHA: ServerSHA }
  | { readonly mode: "legacy"; readonly serverSHA: ServerSHA | null }
);
export type MirrorStatus = { readonly status: "synced" } | { readonly status: "warning"; readonly error: Error };
