import type { AuthorHouseRequest, HouseWing } from "@/editor/construction/contracts";
import type { GameEvent, GameMap, MapTreeNode, Project } from "@/project/types";
import { LAYOUT_TREE_CANOPY_IDS, LAYOUT_TREE_TRUNK_IDS } from "@/project/lint/layoutPlacementValidate";

import { houseBBox } from "./houseLotDecor";
import { houseFootprintCells } from "./houseProtection";

import type { ChangeSummary } from "./types";
import { ToolError } from "./types";
import type {
  AuthorHouseChanges,
  AuthorHouseExecution,
  ConstructionCellChange,
  HouseInteriorEvidence,
} from "./authorHouseTypes";

/** Reject before any lot is stamped or sealed: lower writes preserve occupied upper cells. */
export function validateAuthorHouseTreeClearance(map: GameMap, request: AuthorHouseRequest): void {
  const plans = request.kind === "single" ? [request] : request.houses;
  for (const plan of plans) {
    // Include unchanged ridge/gap cells that completion will protect. Clearing a whole
    // tree may cross this footprint, so require explicit clearance instead of erasing.
    for (const cell of houseFootprintCells(houseBBox(plan.wings), map)) {
      const index = cell.y * map.width + cell.x;
      const tree = [map.lowerTiles[index], map.upperTiles[index]].find((tile) =>
        LAYOUT_TREE_CANOPY_IDS.has(tile) || LAYOUT_TREE_TRUNK_IDS.has(tile));
      if (tree !== undefined) {
        throw new ToolError(
          `집 부지 (${cell.x},${cell.y})에 나무 타일 ${tree}이 있습니다. 시공 전에 수관과 밑동 전체를 명시적으로 정리하거나 다른 부지를 선택하세요.`,
          { code: "house-tree-clearance-required", mapId: map.id, ...cell },
        );
      }
    }
  }
}

export function describeAuthorHouseChanges(before: Project, after: Project): AuthorHouseChanges {
  const beforeMapIds = new Set(Object.keys(before.maps));
  const afterMapIds = Object.keys(after.maps).sort();
  const addedMapIds = afterMapIds.filter((mapId) => !beforeMapIds.has(mapId));
  const changedMapIds = afterMapIds.filter((mapId) => JSON.stringify(before.maps[mapId]) !== JSON.stringify(after.maps[mapId]));
  const changedCells: ConstructionCellChange[] = [];
  const addedEventIds: string[] = [];
  const changedEventIds: string[] = [];
  for (const mapId of afterMapIds) {
    const afterMap = after.maps[mapId];
    if (afterMap === undefined) continue;
    const beforeMap = before.maps[mapId];
    if (beforeMap !== undefined) collectChangedCells({ mapId, before: beforeMap, after: afterMap, changes: changedCells });
    const beforeEvents = new Map((beforeMap?.events ?? []).map((event) => [event.id, JSON.stringify(event)]));
    for (const event of afterMap.events) {
      const previous = beforeEvents.get(event.id);
      if (previous === undefined) addedEventIds.push(event.id);
      else if (previous !== JSON.stringify(event)) changedEventIds.push(event.id);
    }
  }
  return {
    changedMapIds,
    addedMapIds,
    changedCells,
    addedEventIds: addedEventIds.sort(),
    changedEventIds: changedEventIds.sort(),
  };
}

type CellCollectionInput = {
  readonly mapId: string;
  readonly before: Project["maps"][string];
  readonly after: Project["maps"][string];
  readonly changes: ConstructionCellChange[];
};

function collectChangedCells(input: CellCollectionInput): void {
  const size = Math.max(input.before.lowerTiles.length, input.after.lowerTiles.length);
  for (let index = 0; index < size; index += 1) {
    const x = index % input.after.width;
    const y = Math.floor(index / input.after.width);
    if (input.before.lowerTiles[index] !== input.after.lowerTiles[index]) {
      input.changes.push({ mapId: input.mapId, layer: "lower", x, y });
    }
    if (input.before.upperTiles[index] !== input.after.upperTiles[index]) {
      input.changes.push({ mapId: input.mapId, layer: "upper", x, y });
    }
  }
}

type HousePostconditionInput = {
  readonly before: Project;
  readonly after: Project;
  readonly request: AuthorHouseRequest;
  readonly houses: readonly AuthorHouseExecution[];
  readonly changes: AuthorHouseChanges;
  readonly diff: ChangeSummary;
};

export function validateAuthorHousePostconditions(input: HousePostconditionInput): void {
  const { before, after, request, houses, changes, diff } = input;
  const requested = request.kind === "single" ? 1 : request.houses.length;
  if (houses.length !== requested) fail("시공된 집 수가 요청 수와 다릅니다.", "house-count-mismatch", request.mapId);
  if (after.startMapId !== before.startMapId || JSON.stringify(after.startPos) !== JSON.stringify(before.startPos)) {
    fail("집 시공이 시작 위치를 변경했습니다.", "undeclared-construction-change", request.mapId);
  }
  if (projectEnvelope(after) !== projectEnvelope(before)) {
    fail("집 시공이 선언되지 않은 프로젝트 영역을 변경했습니다.", "undeclared-construction-change", request.mapId);
  }
  validateHouseEvidence(after, request, houses);
  validateMapScope({ before, after, targetMapId: request.mapId, houses, changes, diff });
  for (const house of houses) {
    if (!changes.changedCells.some((cell) => cell.mapId === request.mapId && house.wings.some((wing) => wingContains(wing, cell)))) {
      fail(`집 #${house.index + 1} 외관에 실제 셀 변경이 없습니다.`, "construction-zero-change", request.mapId);
    }
  }
}

function validateHouseEvidence(
  project: Project,
  request: AuthorHouseRequest,
  houses: readonly AuthorHouseExecution[],
): void {
  const plans = request.kind === "single" ? [request] : request.houses;
  for (const [index, house] of houses.entries()) {
    const plan = plans[index];
    if (plan === undefined) fail("집 계획과 실행 결과를 대응할 수 없습니다.", "house-count-mismatch", request.mapId);
    if (plan.interior === "exterior-only") {
      if (house.interior !== undefined) fail("외관 전용 집에 내부 맵이 생성되었습니다.", "house-interior-mismatch", request.mapId);
      continue;
    }
    if (house.interior === undefined) fail("연결 내부가 생성되지 않았습니다.", "house-interior-mismatch", request.mapId);
    validateTransferPair(project, house.interior);
  }
}

function validateTransferPair(project: Project, interior: HouseInteriorEvidence): void {
  const floorIds = new Set(interior.floorMapIds);
  if (!floorIds.has(interior.interiorMapId) || floorIds.size !== interior.floorMapIds.length) {
    fail("내부 층 맵 목록이 유효하지 않습니다.", "house-interior-mismatch", interior.transfer.exteriorMapId);
  }
  const door = findEvent(project, interior.transfer.exteriorMapId, interior.doorEventId);
  const exit = findEvent(project, interior.interiorMapId, interior.exitEventId);
  if (!transfersTo(door, interior.interiorMapId) || !transfersTo(exit, interior.transfer.exteriorMapId)) {
    fail("집 안팎 왕복 이동 이벤트가 유효하지 않습니다.", "house-transfer-mismatch", interior.transfer.exteriorMapId);
  }
}

function findEvent(project: Project, mapId: string, eventId: string): GameEvent | undefined {
  return project.maps[mapId]?.events.find((event) => event.id === eventId);
}

function transfersTo(event: GameEvent | undefined, mapId: string): boolean {
  return (event?.pages ?? []).some((page) =>
    page.commands.some((command) => command.kind === "transfer" && command.mapId === mapId));
}

type MapScopeInput = Omit<HousePostconditionInput, "request"> & { readonly targetMapId: string };

function validateMapScope(input: MapScopeInput): void {
  const expectedAdded = input.houses.flatMap((house) => house.interior?.floorMapIds ?? []).sort();
  if (JSON.stringify([...input.changes.addedMapIds].sort()) !== JSON.stringify(expectedAdded)) {
    fail("선언되지 않은 맵 추가가 감지되었습니다.", "undeclared-construction-change", input.targetMapId);
  }
  if (input.diff.mapsRemoved !== 0 || input.diff.mapsAdded !== expectedAdded.length || hasForbiddenDiff(input.diff)) {
    fail("집 시공의 변경 범위를 벗어났습니다.", "undeclared-construction-change", input.targetMapId);
  }
  for (const mapId of Object.keys(input.before.maps)) {
    if (mapId === input.targetMapId) continue;
    if (JSON.stringify(input.before.maps[mapId]) !== JSON.stringify(input.after.maps[mapId])) {
      fail(`대상 외 기존 맵이 변경되었습니다: ${mapId}`, "undeclared-construction-change", input.targetMapId);
    }
  }
  const added = new Set(expectedAdded);
  if (JSON.stringify(pruneAddedMaps(input.after.mapTree, added)) !== JSON.stringify(input.before.mapTree)) {
    fail("맵 트리에 선언되지 않은 변경이 있습니다.", "undeclared-construction-change", input.targetMapId);
  }
}

function hasForbiddenDiff(diff: ChangeSummary): boolean {
  return diff.dbRecordsChanged !== 0 || diff.tilesetsChanged !== 0 || diff.switchesAdded !== 0
    || diff.variablesAdded !== 0 || diff.worldEntitiesAdded !== 0 || diff.worldEntitiesModified !== 0
    || diff.palettePresetsAdded !== 0 || diff.palettePresetsModified !== 0 || diff.endingsChanged !== 0
    || diff.sessionChanged || diff.systemChanged;
}

function pruneAddedMaps(node: MapTreeNode, added: ReadonlySet<string>): MapTreeNode | undefined {
  if (added.has(node.mapId)) return undefined;
  const children = node.children.flatMap((child) => {
    const kept = pruneAddedMaps(child, added);
    return kept === undefined ? [] : [kept];
  });
  return { mapId: node.mapId, children };
}

function projectEnvelope(project: Project): string {
  const { maps, mapTree, startMapId, startPos, ...envelope } = project;
  void maps;
  void mapTree;
  void startMapId;
  void startPos;
  return JSON.stringify(envelope);
}

function wingContains(wing: HouseWing, cell: ConstructionCellChange): boolean {
  return cell.x >= wing.x && cell.x < wing.x + wing.w && cell.y >= wing.y && cell.y < wing.y + wing.h;
}

function fail(message: string, code: string, mapId: string): never {
  throw new ToolError(message, { code, mapId });
}
