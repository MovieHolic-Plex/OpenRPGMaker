import {
  constructionAuditFromResult,
  type ConstructionAuditRecord,
} from "@/editor/construction/constructionAudit";
import type { ConstructionDiffTotals } from "@/editor/construction/contracts";
import type { ChangeSummary, ToolResult } from "@/editor/tools/types";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";

import type {
  HarnessCaseRecord,
  HarnessCategory,
  HarnessOutcome,
  HarnessQa,
} from "./constructionHarnessTypes";

export class HarnessInvariantError extends Error {
  readonly caseId: string;

  constructor(caseId: string, message: string) {
    super(`${caseId}: ${message}`);
    this.name = "HarnessInvariantError";
    this.caseId = caseId;
  }
}

export type HarnessObservation = {
  readonly id: string;
  readonly category: HarnessCategory;
  readonly seed: number;
  readonly expectedOutcome: HarnessOutcome;
  readonly beforeHash: string;
  readonly project: Project;
  readonly result: ToolResult;
  readonly qa: HarnessQa;
  readonly extraChecksPassed: boolean;
};

export async function projectSha256(project: Project): Promise<string> {
  return sha256HexText(serialize(project));
}

export async function recordObservation(observation: HarnessObservation): Promise<HarnessCaseRecord> {
  const audit = requiredAudit(observation.id, observation.result);
  const diff = constructionDiff(observation.result.diff);
  const normalizedAudit = { ...audit, diff };
  const afterHash = await projectSha256(observation.project);
  const changed = observation.beforeHash !== afterHash;
  const actualOutcome = harnessOutcome(normalizedAudit);
  const expectsMutation = observation.expectedOutcome === "exact" || observation.expectedOutcome === "partial";
  const expectsSuccess = expectsMutation;
  const passed = actualOutcome === observation.expectedOutcome
    && changed === expectsMutation
    && observation.result.ok === expectsSuccess
    && normalizedAudit.requestedEntrypoint === normalizedAudit.canonicalRoute
    && normalizedAudit.routeChanges.length === 0
    && observation.extraChecksPassed;
  return {
    id: observation.id,
    category: observation.category,
    seed: observation.seed,
    expectedOutcome: observation.expectedOutcome,
    actualOutcome,
    passed,
    requestedEntrypoint: normalizedAudit.canonicalRoute,
    canonicalRoute: normalizedAudit.canonicalRoute,
    selectedImplementation: normalizedAudit.selectedImplementation,
    routeChanges: normalizedAudit.routeChanges,
    beforeHash: observation.beforeHash,
    afterHash,
    changed,
    resultOk: observation.result.ok,
    summary: observation.result.summary,
    issueCodes: observation.result.issues?.map((issue) => issue.code) ?? [],
    diff,
    audit: normalizedAudit,
    qa: observation.qa,
  };
}

export function projectQa(
  project: Project,
  audit: ConstructionAuditRecord,
  details: {
    readonly interiorMapIds?: readonly string[];
    readonly structuralQaOk?: boolean | null;
  } = {},
): HarnessQa {
  const mapIds = Object.keys(project.maps).sort();
  let eventCount = 0;
  let linkedTransferCount = 0;
  for (const map of Object.values(project.maps)) {
    eventCount += map.events.length;
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        linkedTransferCount += page.commands.filter((command) => command.kind === "transfer").length;
      }
    }
  }
  return {
    mapIds,
    eventCount,
    exteriorMapId: audit.target.mapId,
    interiorMapIds: [...(details.interiorMapIds ?? [])].sort(),
    requestedCount: audit.counts.requested,
    actualCount: audit.counts.actual,
    structuralQaOk: details.structuralQaOk ?? null,
    targetMapPresent: project.maps[audit.target.mapId] !== undefined,
    linkedTransferCount,
  };
}

export function requiredAudit(caseId: string, result: ToolResult): ConstructionAuditRecord {
  const audit = constructionAuditFromResult({ resultData: result.data });
  if (audit !== null) return audit;
  throw new HarnessInvariantError(caseId, "canonical construction result did not contain a parseable audit record");
}

function harnessOutcome(audit: ConstructionAuditRecord): HarnessOutcome {
  switch (audit.outcome) {
    case "exact":
      return "exact";
    case "partial":
      return "partial";
    case "blocked":
    case "no-change":
    case "pending":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return assertNever(audit.outcome);
  }
}

function constructionDiff(diff: ChangeSummary | undefined): ConstructionDiffTotals {
  return {
    tilesChanged: diff?.tilesChanged ?? 0,
    eventsAdded: diff?.eventsAdded ?? 0,
    eventsModified: diff?.eventsModified ?? 0,
    eventsRemoved: diff?.eventsRemoved ?? 0,
    mapsAdded: diff?.mapsAdded ?? 0,
    mapsRemoved: diff?.mapsRemoved ?? 0,
    dbRecordsChanged: diff?.dbRecordsChanged ?? 0,
    tilesetsChanged: diff?.tilesetsChanged ?? 0,
    switchesAdded: diff?.switchesAdded ?? 0,
    variablesAdded: diff?.variablesAdded ?? 0,
    worldEntitiesAdded: diff?.worldEntitiesAdded ?? 0,
    worldEntitiesModified: diff?.worldEntitiesModified ?? 0,
    palettePresetsAdded: diff?.palettePresetsAdded ?? 0,
    palettePresetsModified: diff?.palettePresetsModified ?? 0,
    endingsChanged: diff?.endingsChanged ?? 0,
    sessionChanged: diff?.sessionChanged ?? false,
    systemChanged: diff?.systemChanged ?? false,
  };
}

function assertNever(value: never): never {
  throw new HarnessInvariantError("outcome", `unknown audit outcome ${String(value)}`);
}
