import type { ConstructionDiffTotals, ConstructionOutcome } from "@/editor/construction/contracts";
import { runToolDefinition, type RunToolOptions } from "./toolRunner";
import type { ChangeSummary, ToolContext, ToolResult } from "./types";
import type { AuthorVillageFacadeData } from "./authorVillageSupport";
import { AUTHOR_VILLAGE_TOOL, createAuthorVillageTool } from "./authorVillageToolDef";

export { AUTHOR_VILLAGE_TOOL, createAuthorVillageTool };
export type { AuthorVillageDependencies } from "./authorVillageToolDef";

export type AuthorVillageToolResult = Omit<ToolResult, "data"> & {
  readonly data: AuthorVillageFacadeData;
};

export function runAuthorVillage(
  ctx: ToolContext,
  args: Record<string, unknown>,
  options: RunToolOptions = {},
): AuthorVillageToolResult {
  const result = runToolDefinition(ctx, AUTHOR_VILLAGE_TOOL, args, options);
  if (!isAuthorVillageFacadeData(result.data)) {
    return { ...result, data: failedData(args, result) };
  }
  const construction = finalizedConstruction(result.data.construction, result, options.dryRun === true);
  return { ...result, data: { ...result.data, construction } };
}

function isAuthorVillageFacadeData(value: unknown): value is AuthorVillageFacadeData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const construction = Reflect.get(value, "construction");
  const village = Reflect.get(value, "village");
  const changes = Reflect.get(value, "changes");
  return typeof construction === "object" && construction !== null
    && typeof village === "object" && village !== null
    && typeof changes === "object" && changes !== null;
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
  if (pendingApproval) {
    return { ...common, executionOk: false, applied: false, outcome: "pending-approval" };
  }
  return {
    ...common,
    executionOk: true,
    applied: true,
    outcome: inner.outcome === "partial" ? "partial" : "applied",
  };
}

function failedData(args: Record<string, unknown>, result: ToolResult): AuthorVillageFacadeData {
  const target = failedTarget(args);
  const requested = Number.isInteger(args.houseCount) ? Number(args.houseCount) : 1;
  const code = result.issues?.[0]?.code;
  const failed = code === "village-inner-failed" || code === "tool-exception" || code === "tool-postprocess";
  const common = {
    requestedEntrypoint: "author_village" as const,
    canonicalRoute: "author_village" as const,
    selectedImplementation: "buildVillageDomain",
    routeChanges: [],
    activityPersistence: "not-recorded" as const,
    projectPersistence: "not-requested" as const,
    target,
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
    village: {
      exteriorMapId: target.mapId,
      interiorMapIds: [],
      actualHouseCount: 0,
      structuralQa: {
        ok: false,
        doorsConnected: 0,
        doorsIntact: 0,
        roadComponents: 0,
        ridgeInvaded: 0,
        critiqueOk: false,
      },
    },
    changes: { changedMapIds: [], addedMapIds: [], changedCells: 0, addedEventIds: [] },
  };
}

function failedTarget(args: Record<string, unknown>): { readonly kind: "existing" | "new"; readonly mapId: string } {
  const raw = args.target;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { kind: "existing", mapId: "(invalid-map)" };
  }
  const kind = Reflect.get(raw, "kind") === "new" ? "new" : "existing";
  const value = Reflect.get(raw, "mapId");
  const mapId = typeof value === "string" && value.trim().length > 0 ? value.trim() : "(invalid-map)";
  return { kind, mapId };
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
    sessionChanged: diff?.sessionChanged ?? false,
    systemChanged: diff?.systemChanged ?? false,
  };
}
