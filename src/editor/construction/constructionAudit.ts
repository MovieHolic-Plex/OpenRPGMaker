import { ToolError } from "@/editor/tools/types";

import type {
  ActivityPersistence,
  CanonicalConstructionRoute,
  ConstructionCounts,
  ConstructionDiffTotals,
  ConstructionOutcome,
  ConstructionRouteChange,
  ConstructionTarget,
  ConstructionWriteEntrypoint,
  ProjectPersistence,
} from "./contracts";
import { parseConstructionOutcome } from "./parseConstructionOutcome";

export const CONSTRUCTION_AUDIT_OUTCOMES = [
  "exact",
  "partial",
  "failed",
  "blocked",
  "no-change",
  "pending",
] as const;

export type ConstructionAuditOutcome = (typeof CONSTRUCTION_AUDIT_OUTCOMES)[number];
export type ConstructionAuditObservation = "canonical" | "no-change";

export type ConstructionAuditRecord = {
  readonly executionOk: boolean;
  readonly applied: boolean;
  readonly outcome: ConstructionAuditOutcome;
  readonly requestedEntrypoint: ConstructionWriteEntrypoint;
  readonly canonicalRoute: CanonicalConstructionRoute;
  readonly selectedImplementation: string;
  readonly routeChanges: readonly ConstructionRouteChange[];
  readonly target: ConstructionTarget;
  readonly counts: ConstructionCounts;
  readonly diff: ConstructionDiffTotals;
  readonly warnings: readonly string[];
  readonly activityPersistence: ActivityPersistence;
  readonly projectPersistence: ProjectPersistence;
};

export type ConstructionAuditInput = {
  readonly resultData: unknown;
  readonly observation?: ConstructionAuditObservation;
};

export function isCanonicalConstructionResult(value: unknown): boolean {
  return extractConstructionOutcome(value) !== null;
}

export function constructionAuditFromResult(input: ConstructionAuditInput): ConstructionAuditRecord | null {
  const construction = extractConstructionOutcome(input.resultData);
  if (construction === null) return null;
  const observation = input.observation ?? "canonical";
  if (
    observation === "no-change"
    && (construction.outcome !== "failed" || construction.applied || constructionDiffHasChanges(construction.diff))
  ) {
    return null;
  }
  return {
    executionOk: construction.executionOk,
    applied: construction.applied,
    outcome: observation === "no-change" ? "no-change" : canonicalAuditOutcome(construction),
    requestedEntrypoint: construction.requestedEntrypoint,
    canonicalRoute: construction.canonicalRoute,
    selectedImplementation: construction.selectedImplementation,
    routeChanges: construction.routeChanges,
    target: construction.target,
    counts: construction.counts,
    diff: construction.diff,
    warnings: construction.warnings,
    activityPersistence: construction.activityPersistence,
    projectPersistence: construction.projectPersistence,
  };
}

export function serializeConstructionAudit(record: ConstructionAuditRecord | null): string {
  return record === null ? "null" : JSON.stringify(record, null, 2);
}

function extractConstructionOutcome(value: unknown): ConstructionOutcome | null {
  const candidate = isRecord(value) && "construction" in value ? value["construction"] : value;
  if (
    !isRecord(candidate)
    || typeof candidate["requestedEntrypoint"] !== "string"
    || typeof candidate["canonicalRoute"] !== "string"
    || typeof candidate["selectedImplementation"] !== "string"
  ) {
    return null;
  }
  try {
    return parseConstructionOutcome(candidate);
  } catch (error) {
    if (error instanceof ToolError) return null;
    throw error;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalAuditOutcome(construction: ConstructionOutcome): Exclude<ConstructionAuditOutcome, "no-change"> {
  const outcome = construction.outcome;
  switch (outcome) {
    case "applied":
      return "exact";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
    case "pending-approval":
      return "pending";
    default:
      return assertNever(outcome);
  }
}

function constructionDiffHasChanges(diff: ConstructionDiffTotals): boolean {
  return diff.tilesChanged > 0
    || diff.eventsAdded > 0
    || diff.eventsModified > 0
    || diff.eventsRemoved > 0
    || diff.mapsAdded > 0
    || diff.mapsRemoved > 0
    || diff.dbRecordsChanged > 0
    || diff.tilesetsChanged > 0
    || diff.switchesAdded > 0
    || diff.variablesAdded > 0
    || diff.worldEntitiesAdded > 0
    || diff.worldEntitiesModified > 0
    || diff.palettePresetsAdded > 0
    || diff.palettePresetsModified > 0
    || diff.endingsChanged > 0
    || (diff.mapPropertiesChanged ?? 0) > 0
    || (diff.audioDescriptionsChanged ?? 0) > 0
    || diff.sessionChanged
    || diff.systemChanged;
}

function assertNever(value: never): never {
  throw new ToolError(`Unknown construction outcome: ${String(value)}`, { code: "invalid-outcome" });
}
