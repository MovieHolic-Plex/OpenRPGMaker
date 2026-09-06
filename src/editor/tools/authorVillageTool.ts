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
    // 내부 diff(파사드가 베이스라인에서 직접 계산)를 정본으로 쓴다.
    // 러너 diff(result.diff)는 실행기 관측이라 비어 있을 수 있어 덮어쓰면 변경 내역이 증발한다.
    diff: innerDiffOrFallback(inner.diff, result.diff),
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
  // failed = 빌더 내부 실패(재시도해도 같은 결과). blocked = 입력·환경 문제(고치고 재시도 가능).
  // 개수 미달·QA 실패는 빌더가 할 수 있는 만큼 하고 실패한 것이라 failed — blocked로 두면
  // UI가 "재시도 가능"으로 해석해 같은 실패를 반복한다.
  const failed = code === "village-inner-failed"
    || code === "tool-exception"
    || code === "tool-postprocess"
    || code === "village-count-shortfall"
    || code === "village-population-shortfall"
    || code === "village-qa-failed"
    || code === "landmark-water-missing"
    || code === "landmark-forest-missing"
    || code === "landmark-market-missing"
    || code === "road-forbidden-residual"
    || code === "no-houses-built";
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
      npcCount: 0,
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

/** 내부 diff가 비어 있지 않으면(실제 쓰기 흔적) 그것을 쓰고, 비어 있을 때만 러너 diff로 폴백. */
function innerDiffOrFallback(
  inner: ConstructionDiffTotals,
  runnerDiff: ChangeSummary | undefined,
): ConstructionDiffTotals {
  if (hasWriteTotals(inner)) return inner;
  return toolDiff(runnerDiff);
}

function hasWriteTotals(diff: ConstructionDiffTotals): boolean {
  return diff.tilesChanged + diff.eventsAdded + diff.eventsModified + diff.eventsRemoved + diff.mapsAdded
    + diff.mapsRemoved + diff.dbRecordsChanged + diff.tilesetsChanged + diff.switchesAdded + diff.variablesAdded
    + diff.worldEntitiesAdded + diff.worldEntitiesModified + diff.palettePresetsAdded + diff.palettePresetsModified
    + diff.endingsChanged + (diff.mapPropertiesChanged ?? 0) + (diff.audioDescriptionsChanged ?? 0) > 0
    || diff.sessionChanged || diff.systemChanged;
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
    sessionChanged: diff?.sessionChanged ?? false,
    systemChanged: diff?.systemChanged ?? false,
  };
}
