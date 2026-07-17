import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import type { ConstructionDiffTotals, ConstructionOutcome } from "@/editor/construction/contracts";
import { createDraft } from "./changeset";
import { runToolDefinition, type RunToolOptions } from "./toolRunner";
import { ToolError, type ChangeSummary, type ToolContext, type ToolDefinition, type ToolExecResult, type ToolResult } from "./types";
import { assertVillageMutationScope, restoreExistingTargetStart } from "./authorVillageScope";
import {
  assertInnerVillageSuccess,
  assertVillagePostconditions,
  buildVillageFacadeData,
  createExactVillageMap,
  type AuthorVillageFacadeData,
  villageDomainArgs,
} from "./authorVillageSupport";
import {
  buildVillageDomain,
  inspectVillageBuild,
  type VillageBuildDomainArgs,
  type VillageBuildInspection,
} from "./villageBuilder";

export type AuthorVillageDependencies = {
  readonly build: (project: Parameters<typeof buildVillageDomain>[0], args: VillageBuildDomainArgs) => ToolExecResult;
  readonly inspect: (project: Parameters<typeof inspectVillageBuild>[0], result: ToolExecResult) => VillageBuildInspection;
};

const DEFAULT_DEPENDENCIES: AuthorVillageDependencies = {
  build: buildVillageDomain,
  inspect: inspectVillageBuild,
};

export function createAuthorVillageTool(dependencies: AuthorVillageDependencies = DEFAULT_DEPENDENCIES): ToolDefinition {
  return {
    name: "author_village",
    description:
      "Canonical village facade. Builds an exact or explicit best-effort house count on one locked existing/new target.",
    mode: "write",
    domains: ["tile", "map"],
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        target: { type: "object", description: "Existing map/bounds or exact new map descriptor." },
        houseCount: { type: "integer", description: "Requested exterior houses, 4-32 without clamping." },
        housePlans: { type: "array", items: { type: "object" } },
        countPolicy: { type: "string", enum: ["exact", "best-effort"] },
        theme: { type: "string" },
        seed: { type: "integer" },
        interior: { type: "boolean" },
      },
      required: ["target", "houseCount", "countPolicy"],
    },
    invalidArgsExample: {
      target: { kind: "existing", mapId: "map_town" },
      houseCount: 8,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    },
    run(draft, args): ToolExecResult {
      const request = parseAuthorVillageRequest(args);
      const baseline = createDraft(draft);
      switch (request.target.kind) {
        case "existing":
          if (!draft.maps[request.target.mapId]) {
            throw new ToolError(`Map not found: ${request.target.mapId}`, { code: "map-not-found", mapId: request.target.mapId });
          }
          break;
        case "new":
          createExactVillageMap(draft, request.target);
          break;
      }
      const result = dependencies.build(draft, villageDomainArgs(request));
      assertInnerVillageSuccess(result, request.target.mapId);
      const inspection = dependencies.inspect(draft, result);
      assertVillagePostconditions(request, inspection);
      restoreExistingTargetStart(baseline, draft, request);
      const state = { baseline, draft, request, inspection };
      assertVillageMutationScope(state);
      const data = buildVillageFacadeData(state, result);
      return {
        summary: `Village authored: ${inspection.actualHouseCount}/${request.houseCount} houses on ${request.target.mapId}.`,
        data,
        ...(data.construction.warnings.length === 0 ? {} : { warnings: [...data.construction.warnings] }),
      };
    },
  };
}

export const AUTHOR_VILLAGE_TOOL = createAuthorVillageTool();

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
