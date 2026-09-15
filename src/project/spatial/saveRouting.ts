import type { Project } from "../types";
import type { SupabaseProjectConfig } from "../supabaseProjectConfig";
import { captureRawLegacySnapshot, publishSpatialProject, syncSpatialMirrors } from "./persistence";
import { convertLegacySpatialSnapshot } from "./legacyImport";
import type { AcceptedSpatialPublication, MirrorStatus, ServerSHA } from "./persistenceTypes";
import { sameProjectTarget } from "../persistence/target";

export { sameProjectTarget };

/** Authority belongs to a loaded target, never a Project object's identity or local hash. */
export type ProjectWriteAuthority = {
  readonly target: SupabaseProjectConfig;
} & (
  | { readonly mode: "create" | "legacy" }
  | { readonly mode: "canonical"; readonly serverSHA: ServerSHA; readonly revision?: number }
);
export type ProjectRoutingFault = "authority-required" | "target-changed" | "canonical-replacement" | "activation-required" | "activation-stale";
export class ProjectRoutingError extends Error {
  readonly name = "ProjectRoutingError";
  constructor(readonly code: ProjectRoutingFault, message: string, readonly accepted?: {
    readonly projectId: string;
    readonly sha256: ServerSHA;
    readonly serverRevision?: number;
    readonly mirror: MirrorStatus;
  }) { super(message); }
}
export type CanonicalSave = {
  readonly kind: "saved";
  readonly project: Project;
  readonly sha256: ServerSHA;
  readonly authority: ProjectWriteAuthority;
  readonly mirror: MirrorStatus;
};

// Sticky knowledge denies unsafe legacy writes; it never grants a CAS token.
const canonicalTargets = new Set<string>();
function targetKey(target: SupabaseProjectConfig): string {
  return JSON.stringify([target.url, target.projectId]);
}
export function rememberCanonicalTarget(target: SupabaseProjectConfig): void {
  canonicalTargets.add(targetKey(target));
}
export function assertCanonicalReplacement(project: Project, authority: ProjectWriteAuthority | null): void {
  if (authority?.mode === "canonical" && !Object.hasOwn(project, "spatialAuthoring")) {
    throw new ProjectRoutingError("canonical-replacement", "A canonical target cannot lose its spatial document. Use an explicit new-project copy instead.");
  }
}

/** null means the caller may use its unchanged legacy writer. Never reads a fresh token. */
export async function routeSpatialSave(project: Project, config: SupabaseProjectConfig, authority?: ProjectWriteAuthority): Promise<CanonicalSave | null> {
  if (authority && !sameProjectTarget(authority.target, config)) {
    throw new ProjectRoutingError("target-changed", "The loaded authority belongs to another target. Load the selected project before saving.");
  }
  assertCanonicalReplacement(project, authority ?? null);
  const present = Object.hasOwn(project, "spatialAuthoring");
  if (!present) {
    if (canonicalTargets.has(targetKey(config))) {
      throw new ProjectRoutingError("canonical-replacement", "This target was canonical. Marker removal cannot enable legacy writes.");
    }
    return null;
  }
  if (!authority) throw new ProjectRoutingError("authority-required", "Canonical saving requires loaded authority or explicit insert-only creation.");
  let accepted;
  switch (authority.mode) {
    case "legacy":
      throw new ProjectRoutingError("activation-required", "Activate from a freshly captured raw legacy baseline; normalized project saving cannot activate a target.");
    case "create":
      accepted = await publishSpatialProject({ operation: "create", project }, config);
      break;
    case "canonical":
      accepted = await publishSpatialProject({ operation: "update", project, serverSHA: authority.serverSHA }, config);
      break;
    default: return assertNever(authority);
  }
  return completePublication(accepted, config);
}

/** Explicit operation only. Neither the editor Project nor its serializer is a raw baseline. */
export async function activateSpatialProjectFromRaw(config: SupabaseProjectConfig): Promise<CanonicalSave> {
  const capture = await captureRawLegacySnapshot(config);
  if (!capture) throw new ProjectRoutingError("authority-required", "The legacy target no longer exists.");
  const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
  const accepted = await publishSpatialProject({ operation: "activate", project: conversion.raw, capture }, config);
  return completePublication(accepted, config);
}

async function completePublication(accepted: AcceptedSpatialPublication, config: SupabaseProjectConfig): Promise<CanonicalSave> {
  rememberCanonicalTarget(config);
  const mirror = await syncSpatialMirrors(accepted, config);
  return { kind: "saved", project: accepted.preview, sha256: accepted.serverSHA, mirror,
    authority: { mode: "canonical", target: config, serverSHA: accepted.serverSHA, revision: accepted.revision } };
}
function assertNever(value: never): never { throw new TypeError(`Unknown authority: ${String(value)}`); }
