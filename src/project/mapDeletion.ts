// project/mapDeletion.ts
// 맵 삭제 무결성(도그푸딩 결함 ①): 삭제 후 프로젝트가 shape 검증(재로드)을 반드시 통과하도록
// 모든 맵 참조를 재배선/정리하고, 최종적으로 직렬화 왕복 검증에 실패하면 삭제 자체를 차단한다.
//
// 정책 결정(차단 vs 재배선) 근거:
// - UI 삭제(deleteMap)는 "모든 맵을 지우고 새로 만들기" 같은 정상 워크플로를 막지 않아야 하므로
//   startMapId/mapTree 루트는 **안전 재배선**한다(기존 deleteMap도 startMapId는 재배선했으나
//   mapTree 루트/연결/이벤트 참조를 방치해 재로드 벽돌을 만들었다).
// - AI 툴(remove_map)은 에이전트가 의도를 명시하도록 시작 맵 삭제를 **차단**(기존 정책 유지)하되,
//   나머지 참조 정리는 이 모듈을 공유해 동일하게 재배선한다.
// - 어느 경로든 마지막 안전핀: 삭제 결과를 serialize→deserialize 왕복으로 검증해
//   통과하지 못하면 삭제를 커밋하지 않는다(벽돌 원천 차단).

import { deserialize, serialize } from "./io";
import type { Command, EventPage, GameEvent, MapId, MapTreeNode, Project } from "./types";
import { isQuestGraphDef, type AnyQuestDef } from "./quest/questDef";
import { mapPresentItemBranches, presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";
import { mapTroopAfterBattleLists, troopAfterBattleLists } from "@/project/troopAfterBattle";

export interface MapScheduleRowReference {
  readonly hostMapId: MapId;
  readonly eventId: string;
  readonly eventIndex: number;
  readonly scheduleIndex: number;
}

export interface MapDeletionImpact {
  readonly mapId: MapId;
  readonly mapName: string;
  readonly worldRefCount: number;
  readonly worldGraphEdgeCount: number;
  /** 삭제되는 맵 위의 이벤트 수. */
  readonly eventCount: number;
  /** 시작 맵이었는지(삭제 시 다른 맵으로 재배선됨). */
  readonly isStartMap: boolean;
  /** 맵 트리 루트였는지(삭제 시 자식 승격). */
  readonly isTreeRoot: boolean;
  /** 맵 트리에서 이 맵의 자식 수(부모로 재배선되어 보존됨). */
  readonly treeChildCount: number;
  /** 다른 맵/공통 이벤트에서 이 맵으로 이동(transfer/changeTile)하는 명령 수(함께 제거됨). */
  readonly incomingCommandCount: number;
  readonly incomingScheduleRows: readonly MapScheduleRowReference[];
  /** 이 맵과 연결된 mapConnections 수(함께 제거됨). */
  readonly connectionCount: number;
  /** 이 맵의 legacy worldview source document 수(함께 제거됨). */
  readonly villageInfoCount: number;
  /** 이 맵을 참조하는 퀘스트 수(함께 제거됨). */
  readonly questCount: number;
  /** 이 맵을 시작 위치로 쓰는 테스트 프리셋 수(시작 위치가 해제됨). */
  readonly testPresetCount: number;
  /** Animal-home definitions placed on this map and removed with it. */
  readonly farmAnimalBuildingCount: number;
  readonly farmAnimalBuildingIds: readonly string[];
  readonly farmBuildingPlacementCount: number;
  readonly farmBuildingPlacementIds: readonly string[];
  readonly homeDecorationPlacementCount: number;
  readonly homeDecorationPlacementIds: readonly string[];
  readonly fishingSpotCount: number;
  readonly fishingSpotIds: readonly string[];
  readonly forageAreaCount: number;
  readonly forageAreaIds: readonly string[];
}

export type MapDeletionBlock = {
  readonly code: "missing-map" | "last-map" | "validation";
  readonly message: string;
};

export type MapDeletionPlan =
  | { readonly ok: true; readonly impact: MapDeletionImpact }
  | { readonly ok: false; readonly block: MapDeletionBlock };

// 삭제 영향 요약(확인 다이얼로그/툴 결과용). 맵이 없으면 null.
export function collectMapDeletionImpact(project: Project, mapId: MapId): MapDeletionImpact | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const treeNode = findTreeNode(project.mapTree, mapId);
  const farmAnimalBuildingIds = (project.system.farmAnimalBuildings ?? [])
    .filter((building) => building.mapId === mapId)
    .map((building) => building.id);
  const farmBuildingPlacementIds = (project.session.farmBuildingPlacements ?? [])
    .filter((placement) => placement.mapId === mapId)
    .map((placement) => placement.instanceId);
  const homeDecorationPlacementIds = (project.session.homeDecorationPlacements ?? [])
    .filter((placement) => placement.mapId === mapId)
    .map((placement) => placement.instanceId);
  const fishingSpotIds = (project.system.fishing?.spots ?? []).filter((spot) => spot.mapId === mapId).map((spot) => spot.id);
  const forageAreaIds = (project.system.seasonalForage?.areas ?? []).filter((area) => area.mapId === mapId).map((area) => area.id);
  return {
    mapId,
    mapName: map.name,
    worldRefCount: (project.world?.entities ?? []).reduce((sum, e) => sum + (e.refs ?? []).filter((r) => r.kind === "map" && r.id === mapId).length, 0),
    worldGraphEdgeCount: (project.worldGraph?.edges ?? []).filter((e) => e.from.mapId === mapId || e.to.mapId === mapId).length + (project.worldGraph?.nodes ?? []).filter((n) => n.mapId === mapId).length,
    eventCount: map.events.length,
    isStartMap: project.startMapId === mapId,
    isTreeRoot: project.mapTree.mapId === mapId,
    treeChildCount: treeNode?.children.length ?? 0,
    incomingCommandCount: countIncomingCommands(project, mapId),
    incomingScheduleRows: collectIncomingScheduleRows(project, mapId),
    connectionCount: (project.mapConnections ?? []).filter(
      (connection) => connection.from.mapId === mapId || connection.to.mapId === mapId
    ).length,
    villageInfoCount: (project.villageInfoDocuments ?? []).filter((doc) => doc.mapId === mapId).length,
    questCount: (project.quests ?? []).filter((quest) => questReferencesMap(quest, mapId)).length,
    testPresetCount: (project.testPresets ?? []).filter((preset) => preset.startMapId === mapId).length,
    farmAnimalBuildingCount: farmAnimalBuildingIds.length,
    farmAnimalBuildingIds,
    farmBuildingPlacementCount: farmBuildingPlacementIds.length,
    farmBuildingPlacementIds,
    homeDecorationPlacementCount: homeDecorationPlacementIds.length,
    homeDecorationPlacementIds,
    fishingSpotCount: fishingSpotIds.length,
    fishingSpotIds,
    forageAreaCount: forageAreaIds.length,
    forageAreaIds,
  };
}

export interface MapDeletionBatchOptions {
  /** 맵 행이 없는 트리 노드(분류 등). 하위 포함 삭제 때 빈 분류가 남지 않게 함께 뺀다. */
  readonly treeNodeIds?: readonly string[];
}

// 요청 순서대로, 실제로 지울 맵. 마지막 한 장은 항상 남긴다.
export function mapDeletionTargets(project: Project, mapIds: readonly MapId[]): MapId[] {
  const seen = new Set<string>();
  const existing: MapId[] = [];
  for (const mapId of mapIds) {
    if (seen.has(mapId) || !project.maps[mapId]) continue;
    seen.add(mapId);
    existing.push(mapId);
  }
  if (Object.keys(project.maps).length - existing.length >= 1) return existing;
  return existing.slice(0, -1);
}

// 삭제 가능 여부 + 영향 요약. 묶음도 미리보기·재로드 검증은 한 번만 한다.
export function planMapDeletions(
  project: Project,
  mapIds: readonly MapId[],
  options?: MapDeletionBatchOptions,
): MapDeletionPlan {
  const targets = mapDeletionTargets(project, mapIds);
  if (targets.length === 0) {
    const present = mapIds.find((mapId) => project.maps[mapId]);
    if (!present) {
      return { ok: false, block: { code: "missing-map", message: `맵(${mapIds[0] ?? ""})이 존재하지 않습니다.` } };
    }
    return { ok: false, block: { code: "last-map", message: "마지막 맵은 삭제할 수 없습니다." } };
  }
  const impact = collectMapDeletionImpact(project, targets[targets.length - 1]!);
  if (!impact) {
    return { ok: false, block: { code: "missing-map", message: `맵(${targets[targets.length - 1]})이 존재하지 않습니다.` } };
  }
  const preview = structuredClone(project);
  applyMapDeletions(preview, mapIds, options);
  try {
    deserialize(serialize(preview));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      block: { code: "validation", message: `삭제 결과가 무결성 검증에 실패해 취소했습니다: ${message}` },
    };
  }
  return { ok: true, impact };
}

// 삭제 가능 여부 + 영향 요약. 삭제 결과가 재로드(shape 검증)를 통과하지 못하면 차단한다.
export function planMapDeletion(project: Project, mapId: MapId): MapDeletionPlan {
  return planMapDeletions(project, [mapId]);
}

// 맵 삭제 + 모든 참조 재배선/정리. draft를 직접 변경한다(호출 전 planMapDeletion으로 검증 권장).
export function applyMapDeletion(draft: Project, mapId: MapId): void {
  applyMapDeletions(draft, [mapId]);
}

// 여러 맵을 한 번에 지운다. 참조 순회와 트리 재구성은 맵 수와 상관없이 한 번씩이다.
export function applyMapDeletions(draft: Project, mapIds: readonly MapId[], options?: MapDeletionBatchOptions): void {
  const targets = mapDeletionTargets(draft, mapIds);
  if (targets.length === 0) return;
  const deleted = new Set<string>(targets);
  const removedFarmAnimalBuildingIds = new Set(
    (draft.system.farmAnimalBuildings ?? [])
      .filter((building) => deleted.has(building.mapId))
      .map((building) => building.id),
  );
  const removedFarmAnimalEventIds = new Set(
    targets.flatMap((mapId) => draft.maps[mapId]?.events.map((event) => event.id) ?? []),
  );
  const removedHousingIds = new Set((draft.session.farmBuildingPlacements ?? [])
    .filter((placement) => deleted.has(placement.mapId)).map((placement) => placement.instanceId));
  if (draft.session.farmAnimals) draft.session.farmAnimals = draft.session.farmAnimals.map((animal) => {
    if (!animal.housingPlacementId || !removedHousingIds.has(animal.housingPlacementId)) return animal;
    const { housingPlacementId: _removed, ...unassigned } = animal;
    return unassigned;
  });
  for (const mapId of targets) delete draft.maps[mapId];

  if (draft.session.farmBuildingPlacements) {
    draft.session.farmBuildingPlacements = draft.session.farmBuildingPlacements.filter((placement) => !deleted.has(placement.mapId));
  }
  if (draft.session.homeDecorationPlacements) {
    draft.session.homeDecorationPlacements = draft.session.homeDecorationPlacements.filter((placement) => !deleted.has(placement.mapId));
  }
  if (draft.database.farmBuildingTypes) {
    draft.database.farmBuildingTypes = draft.database.farmBuildingTypes.map((type) => withoutDeletedAllowedMaps(type, deleted));
  }
  if (draft.database.homeDecorationTypes) {
    draft.database.homeDecorationTypes = draft.database.homeDecorationTypes.map((type) => withoutDeletedAllowedMaps(type, deleted));
  }

  if (draft.system.farmAnimalBuildings) {
    draft.system.farmAnimalBuildings = draft.system.farmAnimalBuildings.filter(
      (building) => !deleted.has(building.mapId),
    );
  }
  if (draft.system.fishing) {
    draft.system.fishing = { ...draft.system.fishing, spots: draft.system.fishing.spots.filter((spot) => !deleted.has(spot.mapId)) };
  }
  if (draft.system.seasonalForage) {
    draft.system.seasonalForage = {
      ...draft.system.seasonalForage,
      areas: draft.system.seasonalForage.areas.filter((area) => !deleted.has(area.mapId)),
    };
  }
  const remainingFarmAnimalEventIds = new Set(
    Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)),
  );
  if ((removedFarmAnimalBuildingIds.size > 0 || removedFarmAnimalEventIds.size > 0) && draft.session.farmAnimals) {
    draft.session.farmAnimals = draft.session.farmAnimals.map((animal) => {
      const clearBuilding = Boolean(animal.buildingId && removedFarmAnimalBuildingIds.has(animal.buildingId));
      const clearEvent = Boolean(
        animal.eventId
        && removedFarmAnimalEventIds.has(animal.eventId)
        && !remainingFarmAnimalEventIds.has(animal.eventId),
      );
      if (clearBuilding && clearEvent) {
        const { buildingId: _removedBuildingId, eventId: _removedEventId, ...unassignedAnimal } = animal;
        return unassignedAnimal;
      }
      if (clearBuilding) {
        const { buildingId: _removedBuildingId, ...unassignedAnimal } = animal;
        return unassignedAnimal;
      }
      if (clearEvent) {
        const { eventId: _removedEventId, ...unboundAnimal } = animal;
        return unboundAnimal;
      }
      return animal;
    });
  }

  const removeFromTree = new Set<string>(deleted);
  for (const nodeId of options?.treeNodeIds ?? []) {
    if (!draft.maps[nodeId]) removeFromTree.add(nodeId);
  }
  // 맵 트리: 지우는 노드의 살아남은 자식만 부모로 승격. 함께 지우는 분류는 남기지 않는다.
  draft.mapTree = rebuildTreeWithoutMaps(draft.mapTree, removeFromTree, Object.keys(draft.maps));

  // 시작 맵 재배선: 트리 루트(반드시 존재하는 맵)를 우선, startPos는 새 맵 경계로 클램프.
  if (deleted.has(draft.startMapId)) {
    draft.startMapId = draft.maps[draft.mapTree.mapId] ? draft.mapTree.mapId : Object.keys(draft.maps)[0];
    const startMap = draft.maps[draft.startMapId];
    if (startMap) {
      draft.startPos = {
        x: Math.max(0, Math.min(draft.startPos?.x ?? 0, startMap.width - 1)),
        y: Math.max(0, Math.min(draft.startPos?.y ?? 0, startMap.height - 1)),
      };
    }
  }

  // 연결/문서/퀘스트/테스트 프리셋 참조 정리.
  if (draft.mapConnections) {
    draft.mapConnections = draft.mapConnections.filter(
      (connection) => !deleted.has(connection.from.mapId) && !deleted.has(connection.to.mapId)
    );
  }
  if (draft.villageInfoDocuments) {
    draft.villageInfoDocuments = draft.villageInfoDocuments.filter((doc) => !deleted.has(doc.mapId));
  }
  if (draft.quests) {
    draft.quests = draft.quests.filter((quest) => !questReferencesAnyMap(quest, deleted));
  }
  if (draft.testPresets) {
    for (const preset of draft.testPresets) {
      if (preset.startMapId && deleted.has(preset.startMapId)) {
        delete preset.startMapId;
        delete preset.startPos;
      }
    }
  }

  if (draft.world?.entities) {
    for (const entity of draft.world.entities) {
      if (!entity.refs) continue;
      (entity as { refs?: typeof entity.refs }).refs = entity.refs.filter((ref) => !(ref.kind === "map" && deleted.has(ref.id)));
    }
  }
  if (draft.worldGraph?.nodes) {
    draft.worldGraph = {
      ...draft.worldGraph,
      nodes: draft.worldGraph.nodes.filter((node) => !deleted.has(node.mapId)),
      edges: draft.worldGraph.edges.filter((edge) => !deleted.has(edge.from.mapId) && !deleted.has(edge.to.mapId)),
    };
  }

  // 이벤트 일정, 명령(transfer/changeTile), 생활 이동 목적지에서 삭제 맵 참조 제거.
  for (const map of Object.values(draft.maps)) {
    for (const event of map.events) {
      stripEventScheduleMapReferences(event, deleted);
      event.commands = stripMapCommandSet(event.commands, deleted);
      for (const page of event.pages ?? []) stripPageMapReferences(page, deleted);
    }
  }
  for (const commonEvent of draft.commonEvents) {
    commonEvent.commands = stripMapCommandSet(commonEvent.commands, deleted);
  }
  for (const troop of draft.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) {
      page.commands = stripMapCommandSet(page.commands, deleted);
    }
    mapTroopAfterBattleLists(troop, (commands) => stripMapCommandSet(commands, deleted));
  }
}

function withoutDeletedAllowedMaps<T extends { readonly allowedMapIds?: readonly string[] }>(type: T, deleted: ReadonlySet<string>): T {
  if (!type.allowedMapIds?.some((id) => deleted.has(id))) return type;
  const kept = type.allowedMapIds.filter((id) => !deleted.has(id));
  const { allowedMapIds: _removed, ...base } = type;
  return { ...base, ...(kept.length > 0 ? { allowedMapIds: kept } : {}) } as T;
}

function stripEventScheduleMapReferences(event: GameEvent, deleted: ReadonlySet<string>): void {
  if (event.schedule === undefined) return;
  event.schedule = event.schedule.filter((entry) => !deleted.has(entry.at.mapId));
}

function stripPageMapReferences(page: EventPage, deleted: ReadonlySet<string>): void {
  page.commands = stripMapCommandSet(page.commands, deleted);
  if (page.movement.living) {
    page.movement.living.destinations = page.movement.living.destinations.filter(
      (destination) => !deleted.has(destination.mapId)
    );
    // 목적지가 모두 사라진 생활 이동은 제자리로 강등(빈 목적지 순회 방지).
    if (page.movement.living.destinations.length === 0 && page.movement.type === "living") {
      page.movement.type = "fixed";
      delete page.movement.living;
    }
  }
}

// transfer/changeTile 명령 중 삭제 맵을 가리키는 것을 제거한다(중첩 분기 포함).
export function stripMapCommands(commands: readonly Command[], mapId: MapId): Command[] {
  return stripMapCommandSet(commands, new Set([mapId]));
}

function stripMapCommandSet(commands: readonly Command[], deleted: ReadonlySet<string>): Command[] {
  const result: Command[] = [];
  for (const command of commands) {
    if ((command.kind === "transfer" || command.kind === "changeTile") && deleted.has(command.mapId)) continue;
    if (command.kind === "choices") {
      result.push({
        ...command,
        options: command.options.map((option) => ({ ...option, branch: stripMapCommandSet(option.branch, deleted) })),
        ...(command.cancelBranch ? { cancelBranch: stripMapCommandSet(command.cancelBranch, deleted) } : {}),
      });
      continue;
    }
    if (command.kind === "presentItem") {
      result.push(mapPresentItemBranches(command, (branch) => stripMapCommandSet(branch, deleted)));
      continue;
    }
    if (command.kind === "fork") {
      result.push({
        ...command,
        then: stripMapCommandSet(command.then, deleted),
        ...(command.else ? { else: stripMapCommandSet(command.else, deleted) } : {}),
      });
      continue;
    }
    if (command.kind === "loop") {
      result.push({ ...command, body: stripMapCommandSet(command.body, deleted) });
      continue;
    }
    if (command.kind === "shop" && command.transactionBranch) {
      result.push({ ...command, transactionBranch: stripMapCommandSet(command.transactionBranch, deleted) });
      continue;
    }
    result.push(command);
  }
  return result;
}

function countIncomingCommands(project: Project, mapId: MapId): number {
  let count = 0;
  const countIn = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if ((command.kind === "transfer" || command.kind === "changeTile") && command.mapId === mapId) count += 1;
      if (command.kind === "choices") {
        for (const option of command.options) countIn(option.branch);
        if (command.cancelBranch) countIn(command.cancelBranch);
      }
      if (command.kind === "presentItem") presentItemBranchLists(command).forEach(countIn);
      if (command.kind === "fork") {
        countIn(command.then);
        if (command.else) countIn(command.else);
      }
      if (command.kind === "loop") countIn(command.body);
      if (command.kind === "shop" && command.transactionBranch) countIn(command.transactionBranch);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      countIn(event.commands);
      for (const page of event.pages ?? []) countIn(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents) countIn(commonEvent.commands);
  for (const troop of project.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) countIn(page.commands);
    for (const list of troopAfterBattleLists(troop)) countIn(list.commands);
  }
  return count;
}

function collectIncomingScheduleRows(
  project: Project,
  mapId: MapId,
): MapScheduleRowReference[] {
  const references: MapScheduleRowReference[] = [];
  for (const [hostMapId, map] of Object.entries(project.maps)) {
    if (hostMapId === mapId) continue;
    for (const [eventIndex, event] of map.events.entries()) {
      for (const [scheduleIndex, entry] of (event.schedule ?? []).entries()) {
        if (entry.at.mapId !== mapId) continue;
        references.push({ hostMapId, eventId: event.id, eventIndex, scheduleIndex });
      }
    }
  }
  return references;
}

function questReferencesMap(quest: AnyQuestDef, mapId: MapId): boolean {
  return questReferencesAnyMap(quest, new Set([mapId]));
}

function questReferencesAnyMap(quest: AnyQuestDef, deleted: ReadonlySet<string>): boolean {
  if (isQuestGraphDef(quest)) return false;
  const giver = quest.giver as { mapId?: unknown; create?: { mapId?: unknown } };
  if (typeof giver?.mapId === "string" && deleted.has(giver.mapId)) return true;
  if (typeof giver?.create?.mapId === "string" && deleted.has(giver.create.mapId)) return true;
  if (quest.steps?.some((step) => {
    const stepMapId = (step as { mapId?: unknown }).mapId;
    return typeof stepMapId === "string" && deleted.has(stepMapId);
  })) return true;
  if (quest.gates?.some((gate) => deleted.has(gate.mapId))) return true;
  return false;
}

// 지우는 노드를 빼고, 그 안에 살아남은 자식만 위로 올린다. 루트까지 빠지면 첫 생존 자식을 루트로 둔다.
function rebuildTreeWithoutMaps(root: MapTreeNode, remove: ReadonlySet<string>, remainingMapIds: readonly string[]): MapTreeNode {
  const expanded = expandSurvivingNodes(root, remove);
  if (!remove.has(root.mapId)) return expanded[0] ?? root;
  const [first, ...rest] = expanded;
  if (first) return { ...first, children: [...first.children, ...rest] };
  const [newRoot, ...others] = remainingMapIds;
  return { mapId: newRoot, children: others.map((id) => ({ mapId: id, children: [] })) };
}

function expandSurvivingNodes(node: MapTreeNode, remove: ReadonlySet<string>): MapTreeNode[] {
  const children = node.children.flatMap((child) => expandSurvivingNodes(child, remove));
  if (remove.has(node.mapId)) return children;
  return [{ ...node, children }];
}

function findTreeNode(node: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}
