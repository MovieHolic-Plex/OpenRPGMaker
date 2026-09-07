import type { ConstructionDiffTotals, ConstructionOutcome } from "@/editor/construction/contracts";

import { AUTHOR_HOUSE_TOOL } from "./authorHouseToolDef";
import type { AuthorHouseResultData } from "./authorHouseTypes";
import { runToolDefinition, type RunToolOptions } from "./toolRunner";
import type { ChangeSummary, ToolContext, ToolResult } from "./types";

export { AUTHOR_HOUSE_TOOL };
export type { AuthorHouseResultData } from "./authorHouseTypes";

export type AuthorHouseToolResult = Omit<ToolResult, "data"> & {
  readonly data: AuthorHouseResultData;
};

export function runAuthorHouse(
  ctx: ToolContext,
  args: Record<string, unknown>,
  options: RunToolOptions = {},
): AuthorHouseToolResult {
  const result = runToolDefinition(ctx, AUTHOR_HOUSE_TOOL, args, options);
  if (!isAuthorHouseResultData(result.data)) {
    return { ...result, data: failedData(args, result) };
  }
  const construction = finalizedConstruction(result.data.construction, result, options.dryRun === true);
  return { ...result, data: { ...result.data, construction } };
}

function isAuthorHouseResultData(value: unknown): value is AuthorHouseResultData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return "construction" in value && "houses" in value && Array.isArray(value.houses)
    && "changes" in value && typeof value.changes === "object" && value.changes !== null;
}

function finalizedConstruction(
  inner: ConstructionOutcome,
  result: ToolResult,
  pendingApproval: boolean,
): ConstructionOutcome {
  const common = {
    requestedEntrypoint: inner.requestedEntrypoint,
    canonicalRoute: inner.canonicalRoute,
    selectedImplementation: inner.selectedImplementation,
    routeChanges: inner.routeChanges,
    activityPersistence: inner.activityPersistence,
    projectPersistence: inner.projectPersistence,
    target: inner.target,
    counts: inner.counts,
    diff: toolDiff(result.diff),
    warnings: mergedWarnings([inner.warnings, result.warnings, result.diff?.warnings]),
  };
  return pendingApproval
    ? { ...common, executionOk: false, applied: false, outcome: "pending-approval" }
    : { ...common, executionOk: true, applied: true, outcome: "applied" };
}

function failedData(args: Record<string, unknown>, result: ToolResult): AuthorHouseResultData {
  const requested = args.kind === "lots" && Array.isArray(args.houses) ? Math.max(1, args.houses.length) : 1;
  const selectedImplementation = args.kind === "lots" ? "house-lot-domain" : "house-kit-domain";
  const mapId = typeof args.mapId === "string" && args.mapId.trim().length > 0 ? args.mapId.trim() : "(invalid-map)";
  const code = result.issues?.[0]?.code;
  const failed = code === "tool-exception" || code === "tool-postprocess";
  const common = {
    requestedEntrypoint: "author_house" as const,
    canonicalRoute: "author_house" as const,
    selectedImplementation,
    routeChanges: [],
    activityPersistence: "not-recorded" as const,
    projectPersistence: "not-requested" as const,
    target: { kind: "existing" as const, mapId },
    counts: { requested, actual: 0 },
    diff: toolDiff(result.diff),
    warnings: mergedWarnings([
      result.warnings,
      result.diff?.warnings,
      result.issues?.map((issue) => issue.message),
    ]),
  };
  const construction: ConstructionOutcome = failed
    ? { ...common, executionOk: false, applied: false, outcome: "failed" }
    : { ...common, executionOk: false, applied: false, outcome: "blocked" };
  return {
    construction,
    houses: [],
    changes: { changedMapIds: [], addedMapIds: [], changedCells: [], addedEventIds: [], changedEventIds: [] },
  };
}

function mergedWarnings(sources: readonly (readonly string[] | undefined)[]): readonly string[] {
  return [...new Set(sources.flatMap((source) => source ?? []))];
}

function toolDiff(diff: ChangeSummary | undefined): ConstructionDiffTotals {
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
    audioDescriptionsChanged: diff?.audioDescriptionsChanged ?? 0,
    monsterMetadataChanged: diff?.monsterMetadataChanged ?? 0,
    sessionChanged: diff?.sessionChanged ?? false,
    systemChanged: diff?.systemChanged ?? false,
  };
}
