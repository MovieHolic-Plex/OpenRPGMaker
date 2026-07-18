import type { ConstructionDiffTotals, ConstructionOutcome } from "@/editor/construction/contracts";

import { executeAuthorHouse } from "./authorHouseExecution";
import type { AuthorHouseResultData } from "./authorHouseTypes";
import { runToolDefinition, type RunToolOptions } from "./toolRunner";
import type { ChangeSummary, ToolContext, ToolDefinition, ToolResult } from "./types";

export type { AuthorHouseResultData } from "./authorHouseTypes";

const WING_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
  },
  required: ["x", "y", "w", "h"],
} as const;

const HOUSE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    kitId: { type: "string" },
    wings: { type: "array", items: WING_SCHEMA },
    interior: { type: "string", enum: ["exterior-only", "linked-interior"] },
    door: { type: "boolean" },
    ownerName: { type: "string" },
    windows: { type: ["object", "boolean"] },
    yard: { type: "array" },
  },
  required: ["kitId", "wings", "interior", "door", "yard"],
} as const;

const EXAMPLE = {
  kind: "single",
  mapId: "map_1",
  kitId: "blue-stone",
  wings: [{ x: 4, y: 3, w: 8, h: 6 }],
  interior: "exterior-only",
  door: true,
} as const;

export const AUTHOR_HOUSE_TOOL: ToolDefinition = {
  name: "author_house",
  description:
    "야외 맵에 집 한 채 또는 명시된 여러 부지를 원자적으로 시공한다. 독립 실내 방 요청에는 사용하지 않는다. "
    + "interior는 exterior-only 또는 출입 이벤트가 연결되는 linked-interior를 명시한다.",
  mode: "write",
  version: 3,
  domains: ["tile"],
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["single", "lots"] },
      mapId: { type: "string" },
      kitId: { type: "string" },
      wings: { type: "array", items: WING_SCHEMA },
      interior: { type: "string", enum: ["exterior-only", "linked-interior"] },
      door: { type: "boolean" },
      ownerName: { type: "string" },
      windows: { type: ["object", "boolean"] },
      houses: { type: "array", items: HOUSE_PLAN_SCHEMA },
      seed: { type: "integer" },
    },
    required: ["kind", "mapId"],
  },
  invalidArgsExample: EXAMPLE,
  run: executeAuthorHouse,
};

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
    sessionChanged: diff?.sessionChanged ?? false,
    systemChanged: diff?.systemChanged ?? false,
  };
}
