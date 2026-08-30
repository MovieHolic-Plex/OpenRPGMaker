import type {
  AuthorVillageRequest,
  ConstructionDiffTotals,
  ConstructionOutcome,
  ConstructionRect,
  NewVillageTarget,
} from "@/editor/construction/contracts";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MIN_SIZE } from "./village/constants";
import type { GameMap, Project } from "@/project/types";
import { summarizeChanges } from "./changeset";
import { assertMapIdAvailable } from "./mapHelpers";
import { ToolError, type ChangeSummary, type ToolExecResult } from "./types";
import type { VillageBuildDomainArgs, VillageBuildInspection } from "./villageBuilder";

export type VillageFacadeChanges = {
  readonly changedMapIds: readonly string[];
  readonly addedMapIds: readonly string[];
  readonly changedCells: number;
  readonly addedEventIds: readonly string[];
};

export type AuthorVillageFacadeData = {
  readonly construction: ConstructionOutcome;
  readonly village: VillageBuildInspection;
  readonly changes: VillageFacadeChanges;
};

export type VillageFacadeState = {
  readonly baseline: Project;
  readonly draft: Project;
  readonly request: AuthorVillageRequest;
  readonly inspection: VillageBuildInspection;
};

export function createExactVillageMap(project: Project, target: NewVillageTarget): void {
  assertMapIdAvailable(project, target.mapId);
  const size = target.width * target.height;
  const map: GameMap = {
    id: target.mapId,
    name: target.name,
    width: target.width,
    height: target.height,
    tilesetId: DEFAULT_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(TILE.GRASS),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  project.maps[target.mapId] = map;
  if (!project.maps[project.mapTree.mapId]) {
    project.mapTree = { mapId: target.mapId, children: [] };
  } else {
    project.mapTree.children.push({ mapId: target.mapId, children: [] });
  }
  if (!project.maps[project.startMapId]) {
    project.startMapId = target.mapId;
    project.startPos = { x: Math.floor(target.width / 2), y: Math.floor(target.height / 2) };
  }
}

/**
 * 뷰포트 스냅샷 중심을 가운데로 둔 시공 사각형. 한 변은 최소 시공 크기(minSpan)이고,
 * 맵을 벗어나면 안쪽으로 밀고, 맵 자체가 minSpan 보다 작으면 맵 크기로 줄인다.
 * 스냅샷의 w/h(최대 16타일, DEFAULT_VIEWPORT_MAX_SPAN)는 쓰지 않는다 — 파서·빌더가 20 미만을
 * 거부하므로(MIN_SIZE) 화면 크기를 그대로 넘기면 invalid-args 가 된다.
 */
export function viewportVillageBounds(
  snapshot: { readonly mapId: string; readonly centerX: number; readonly centerY: number },
  mapSize: { readonly width: number; readonly height: number },
  minSpan: number = MIN_SIZE,
): ConstructionRect {
  const w = Math.min(minSpan, mapSize.width);
  const h = Math.min(minSpan, mapSize.height);
  return {
    x: clampStart(snapshot.centerX, w, mapSize.width),
    y: clampStart(snapshot.centerY, h, mapSize.height),
    w,
    h,
  };
}

function clampStart(center: number, span: number, limit: number): number {
  const start = Math.round(center) - Math.floor(span / 2);
  return Math.max(0, Math.min(start, limit - span));
}

export function villageDomainArgs(request: AuthorVillageRequest): VillageBuildDomainArgs {
  return {
    mapId: request.target.mapId,
    houses: request.houseCount,
    ...(request.target.kind === "existing" && request.target.bounds ? { bounds: request.target.bounds } : {}),
    ...(request.housePlans ? { housePlans: request.housePlans } : {}),
    ...(request.theme ? { theme: request.theme } : {}),
    ...(request.groundTheme === undefined ? {} : { groundTheme: request.groundTheme }),
    ...(request.settlementLayout === undefined ? {} : { settlementLayout: request.settlementLayout }),
    ...(request.npcCount === undefined ? {} : { npcCount: request.npcCount }),
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...(request.presetId === undefined ? {} : { presetId: request.presetId }),
    interior: request.interior ?? true,
    doorEvent: request.interior ?? true,
  };
}

export function assertInnerVillageSuccess(result: ToolExecResult, mapId: string): void {
  const data = result.data;
  if (typeof data === "object" && data !== null && !Array.isArray(data) && Reflect.get(data, "ok") === false) {
    throw new ToolError("The village builder reported data.ok=false.", { code: "village-inner-failed", mapId });
  }
}

export function assertVillagePostconditions(
  request: AuthorVillageRequest,
  inspection: VillageBuildInspection,
): void {
  const mapId = request.target.mapId;
  if (inspection.exteriorMapId !== mapId) {
    throw new ToolError(`Village target changed to ${inspection.exteriorMapId}.`, { code: "village-target-changed", mapId });
  }
  const minimum = Math.min(request.houseCount, Math.max(4, Math.ceil(request.houseCount * 0.85)));
  const countOk = request.countPolicy === "exact"
    ? inspection.actualHouseCount === request.houseCount
    : inspection.actualHouseCount >= minimum;
  if (!countOk) {
    throw new ToolError(
      `Village house count shortfall: ${inspection.actualHouseCount}/${request.houseCount}.`,
      { code: "village-count-shortfall", mapId },
    );
  }
  if (request.npcCount !== undefined && inspection.npcCount !== request.npcCount) {
    throw new ToolError(
      `Village population shortfall: ${inspection.npcCount}/${request.npcCount}.`,
      { code: "village-population-shortfall", mapId },
    );
  }
  if (!inspection.structuralQa.ok) {
    throw new ToolError("Village structural QA failed.", { code: "village-qa-failed", mapId });
  }
}

export function buildVillageFacadeData(
  state: VillageFacadeState,
  result: ToolExecResult,
): AuthorVillageFacadeData {
  const { baseline, draft, request, inspection } = state;
  const summary = summarizeChanges(baseline, draft);
  const changes = collectChanges(baseline, draft, summary);
  if (!hasWrite(summary)) {
    throw new ToolError("Village builder produced no project change.", { code: "village-no-change", mapId: request.target.mapId });
  }
  const partial = inspection.actualHouseCount !== request.houseCount;
  const warnings = [...(result.warnings ?? [])];
  if (partial) warnings.push(`Built ${inspection.actualHouseCount} of ${request.houseCount} requested houses.`);
  const construction: ConstructionOutcome = {
    executionOk: true,
    applied: true,
    outcome: partial ? "partial" : "applied",
    requestedEntrypoint: "author_village",
    canonicalRoute: "author_village",
    selectedImplementation: "buildVillageDomain",
    routeChanges: [],
    activityPersistence: "not-recorded",
    projectPersistence: "not-requested",
    target: { kind: request.target.kind, mapId: request.target.mapId },
    counts: { requested: request.houseCount, actual: inspection.actualHouseCount },
    diff: constructionDiff(summary),
    warnings,
  };
  return { construction, village: inspection, changes };
}

function constructionDiff(summary: ChangeSummary): ConstructionDiffTotals {
  const { warnings: _warnings, ...diff } = summary;
  return diff;
}

function hasWrite(diff: ChangeSummary): boolean {
  return diff.tilesChanged + diff.eventsAdded + diff.eventsModified + diff.eventsRemoved + diff.mapsAdded
    + diff.mapsRemoved + diff.dbRecordsChanged + diff.tilesetsChanged + diff.switchesAdded + diff.variablesAdded
    + diff.worldEntitiesAdded + diff.worldEntitiesModified + diff.palettePresetsAdded + diff.palettePresetsModified
    + diff.endingsChanged + (diff.mapPropertiesChanged ?? 0) > 0 || diff.sessionChanged || diff.systemChanged;
}

function collectChanges(baseline: Project, draft: Project, summary: ChangeSummary): VillageFacadeChanges {
  const addedMapIds = Object.keys(draft.maps).filter((mapId) => baseline.maps[mapId] === undefined).sort();
  const changedMapIds = Object.keys(draft.maps)
    .filter((mapId) => baseline.maps[mapId] === undefined || JSON.stringify(baseline.maps[mapId]) !== JSON.stringify(draft.maps[mapId]))
    .sort();
  const addedEventIds = changedMapIds.flatMap((mapId) => {
    const beforeIds = new Set((baseline.maps[mapId]?.events ?? []).map((event) => event.id));
    return (draft.maps[mapId]?.events ?? []).filter((event) => !beforeIds.has(event.id)).map((event) => event.id);
  }).sort();
  return { changedMapIds, addedMapIds, changedCells: summary.tilesChanged, addedEventIds };
}
