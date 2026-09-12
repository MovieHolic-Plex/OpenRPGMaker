import type {
  AuthorVillageRequest,
  ConstructionDiffTotals,
  ConstructionOutcome,
  ConstructionRect,
  NewVillageTarget,
} from "@/editor/construction/contracts";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MIN_SIZE } from "./village/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";
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
  // 파사드(fillMissingVillageDimensions)가 이미 채우지만, 직접 호출 경로(테스트·세션) 방어로
  // 같은 환산기의 하한 기본(houseCount 없음 = 기본 12채)로 닫는다 — undefined가 맵에 들어가지 않게.
  const width = target.width ?? 74;
  const height = target.height ?? 52;
  const size = width * height;
  const map: GameMap = {
    id: target.mapId,
    name: target.name,
    width,
    height,
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
    project.startPos = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }
}

/**
 * 뷰포트 스냅샷 중심을 가운데로 둔 시공 사각형. 한 변은 최소 시공 크기(minSpan, 기본 20)이고,
 * 맵을 벗어나면 안쪽으로 밀고, 맵 자체가 minSpan 보다 작으면 맵 크기로 줄인다.
 * 스냅샷 전체(최대 16타일)를 그대로 bounds로 쓰지 않는 이유: 집 1채 슬롯(8+여백 2×2)과
 * 광장·길을 놓으려면 16×16이 빡빡해 시공 실패(no-houses-built)가 잦다. 파서는 16×16 bounds도
 * 받으므로(MIN_BOUNDS_SIZE), 모델이 화면 크기를 직접 bounds로 지정하는 것은 허용된다.
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
    countPolicy: request.countPolicy,
    ...(request.composition ? { composition: request.composition } : {}),
    ...(request.target.kind === "existing" && request.target.bounds ? { bounds: request.target.bounds } : {}),
    ...(request.housePlans ? { housePlans: request.housePlans } : {}),
    ...(request.houseObjectIds ? { houseObjectIds: request.houseObjectIds } : {}),
    ...(request.theme ? { theme: request.theme } : {}),
    ...(request.forestDensity ? { forestDensity: request.forestDensity } : {}),
    ...(request.groundTheme === undefined ? {} : { groundTheme: request.groundTheme }),
    ...(request.settlementLayout === undefined ? {} : { settlementLayout: request.settlementLayout }),
    ...(request.npcCount === undefined ? {} : { npcCount: request.npcCount }),
    ...(request.residents === undefined ? {} : { npcs: request.residents }),
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...(request.presetId === undefined ? {} : { presetId: request.presetId }),
    interior: request.interior ?? !(request.houseObjectIds || request.housePlans?.some(plan => plan.objectId)),
    doorEvent: request.interior ?? !(request.houseObjectIds || request.housePlans?.some(plan => plan.objectId)),
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
    const policyNote = request.countPolicy === "best-effort" && request.houseCount <= 4
      ? " (best-effort도 4채 이하는 exact와 같다)"
      : "";
    throw new ToolError(
      `Village house count shortfall: ${inspection.actualHouseCount}/${request.houseCount}${policyNote}.`,
      { code: "village-count-shortfall", mapId },
    );
  }
  // NPC는 배치 확률 요소가 많아 1~2명 어긋남이 흔하다 — exact여도 하한 90%(최소 2명 관용)로 본다.
  // 집 수와 달리 과다 배치는 실패가 아니다(요청 이상이면 통과).
  if (request.npcCount !== undefined) {
    const npcMinimum = Math.min(request.npcCount, Math.max(2, Math.ceil(request.npcCount * 0.9)));
    if (inspection.npcCount < npcMinimum) {
      throw new ToolError(
        `Village population shortfall: ${inspection.npcCount}/${request.npcCount}.`,
        { code: "village-population-shortfall", mapId },
      );
    }
  }
  if (!inspection.structuralQa.ok) {
    const qa = inspection.structuralQa;
    throw new ToolError(`Village structural QA failed: doors ${qa.doorsConnected}/${inspection.actualHouseCount}, intact ${qa.doorsIntact}, roads ${qa.roadComponents}, ridge ${qa.ridgeInvaded}, reachable ${qa.critiqueOk}.`, { code: "village-qa-failed", mapId });
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
    + diff.endingsChanged + (diff.mapPropertiesChanged ?? 0) + (diff.audioDescriptionsChanged ?? 0) + (diff.monsterMetadataChanged ?? 0) > 0
    || diff.sessionChanged || diff.systemChanged;
}

function collectChanges(baseline: Project, draft: Project, summary: ChangeSummary): VillageFacadeChanges {
  const addedMapIds = Object.keys(draft.maps).filter((mapId) => baseline.maps[mapId] === undefined).sort();
  // 변경 맵 판정은 tileChanged() 헬퍼로 — JSON.stringify 전수 비교는 키 순서에 흔들리고 대형 맵에서 느리다.
  const changedMapIds = Object.keys(draft.maps)
    .filter((mapId) => baseline.maps[mapId] === undefined || tileChanged(baseline.maps[mapId], draft.maps[mapId]))
    .sort();
  const addedEventIds = changedMapIds.flatMap((mapId) => {
    const beforeIds = new Set((baseline.maps[mapId]?.events ?? []).map((event) => event.id));
    return (draft.maps[mapId]?.events ?? []).filter((event) => !beforeIds.has(event.id)).map((event) => event.id);
  }).sort();
  return { changedMapIds, addedMapIds, changedCells: summary.tilesChanged, addedEventIds };
}

/** 맵 변경 판정 — 타일 배열은 길이+요소 비교, 이벤트는 안정 직렬화 비교. 키 순서에 흔들리지 않는다. */
function tileChanged(before: GameMap | undefined, after: GameMap | undefined): boolean {
  if (before === undefined || after === undefined) return before !== after;
  if (
    before.width !== after.width || before.height !== after.height
    || before.tilesetId !== after.tilesetId || before.tileSize !== after.tileSize
    || before.name !== after.name
  ) {
    return true;
  }
  if (before.lowerTiles.length !== after.lowerTiles.length || before.upperTiles.length !== after.upperTiles.length) {
    return true;
  }
  for (let i = 0; i < before.lowerTiles.length; i += 1) {
    if (before.lowerTiles[i] !== after.lowerTiles[i]) return true;
  }
  for (let i = 0; i < before.upperTiles.length; i += 1) {
    if (before.upperTiles[i] !== after.upperTiles[i]) return true;
  }
  if ((before.events ?? []).length !== (after.events ?? []).length) return true;
  const encode = (event: GameEvent): string => stableEventStringify(event);
  const beforeEvents = (before.events ?? []).map(encode).sort();
  const afterEvents = (after.events ?? []).map(encode).sort();
  for (let i = 0; i < beforeEvents.length; i += 1) {
    if (beforeEvents[i] !== afterEvents[i]) return true;
  }
  return false;
}

function stableEventStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "undefined" : encoded;
  }
  if (Array.isArray(value)) return `[${value.map((entry) => stableEventStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableEventStringify(record[key])}`).join(",")}}`;
}
