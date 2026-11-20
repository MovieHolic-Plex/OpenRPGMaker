import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { blueprintMapFor } from "@/ai/v2/story/blueprintPathNames";
import { commandBranches, visitProjectCommands } from "@/editor/tools/commandTraversal";
import { inMapBounds } from "@/editor/tools/mapHelpers";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { ToolError } from "@/editor/tools/types";
import { eventDraftDiff } from "@/project/eventDrafts";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { cloneGameMap } from "@/project/mapClone";
import { applyMapDeletion } from "@/project/mapDeletion";
import { eventDisplayName } from "@/project/eventDisplayName";
import { countLocationReferences } from "@/project/mapLocationReferences";
import { appendToTree, findParentMapId, findTreeNode, insertTreeNode, siblingIndex } from "@/project/mapTree";
import { isStepQuestDef } from "@/project/quest/questDef";
import { scriptCalls, scriptCommandEffects, scriptHasDynamic, scriptReads, scriptWrites } from "@/project/script/effects";
import type { BattleEventCondition, Command, Condition, GameEvent, GameMap, MoveRoute, Project, Rect } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { displayText } from "../../../target";
import { MAP_REMOVAL_DRAFT_REFUSAL, PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";

export function selectedMap(ctx: PrimitiveContext): GameMap {
  const { target, project } = ctx;
  if (target.kind !== "map") throw new PrimitiveError("범위 밖이에요. 맵을 선택해 주세요.");
  const map = Object.hasOwn(project.maps, target.mapId) ? project.maps[target.mapId] : undefined;
  if (!map || map.id !== target.mapId) throw new PrimitiveError("선택한 맵을 찾을 수 없어요. 맵을 다시 골라 주세요.");
  return map;
}

export function label(value: string | undefined, fallback: string): string {
  return displayText((value ?? "").replace(/[\[\]{}.!?『』]/gu, ""), fallback).slice(0, 24);
}

export function mapLabel(map: GameMap): string {
  return label(map.name === map.id ? undefined : map.name, "선택한 맵");
}

export function requiredName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name) throw new PrimitiveError("이름을 입력해 주세요.");
  return name;
}

export function freeId(prefix: string, used: (id: string) => boolean): string {
  let n = 1;
  while (used(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function mapDraft(project: Project, map: GameMap, draft: GameMap = { ...map }): Project {
  return { ...project, maps: { ...project.maps, [map.id]: draft } };
}

export function runMapTool(project: Project, name: string, args: Record<string, unknown>, failure: string): Project {
  try {
    MAP_TOOLS.find(tool => tool.name === name)!.run(project, args);
  } catch (error) {
    if (error instanceof ToolError) throw new PrimitiveError(failure);
    throw error;
  }
  return project;
}

export function assertReferencesPreserved(before: Project, after: Project, failure: string): void {
  const priorIssues = new Map<string, number>();
  for (const issue of collectProjectReferenceIssues(before)) {
    priorIssues.set(issue, (priorIssues.get(issue) ?? 0) + 1);
  }
  for (const issue of collectProjectReferenceIssues(after)) {
    const count = priorIssues.get(issue) ?? 0;
    if (count === 0) throw new PrimitiveError(failure);
    priorIssues.set(issue, count - 1);
  }
}

export function nextMapId(project: Project): string {
  return freeId("map_small_task_", id => Object.hasOwn(project.maps, id) || Boolean(findTreeNode(project.mapTree, id)));
}

export function duplicateMap(project: Project, map: GameMap, name: string): Project {
  if (new Set(map.events.map(event => event.id)).size !== map.events.length) {
    throw new PrimitiveError("같은 식별자를 쓰는 이벤트가 여럿 있어요. 이벤트 목록을 먼저 확인해 주세요.");
  }
  const id = nextMapId(project);
  const used = new Set(Object.values(project.maps).flatMap(entry => entry.events.flatMap(event => [
    event.id, ...(event.pages ?? []).map(page => page.id),
  ])));
  let next = 1;
  const copy = cloneGameMap(map, {
    newId: id,
    newName: name,
    nextEventId() {
      while (used.has(`ev_${id}_${next}`)) next++;
      return `ev_${id}_${next++}`;
    },
  });
  const ids = new Map(map.events.map((event, index) => [event.id, copy.events[index]!.id]));
  const remapPoint = (point: { mapId: string }) => { if (point.mapId === map.id) point.mapId = id; };
  const remapRoute = (route: MoveRoute | undefined) => {
    for (const move of route?.moves ?? []) {
      if (move.kind === "npcTransfer") remapPoint(move);
      if ("target" in move && move.target) move.target = ids.get(move.target) ?? move.target;
    }
  };
  const remapCondition = (condition: Condition) => {
    if ((condition.kind === "insideLocation" || condition.kind === "eventSeesPlayer") && condition.eventId) {
      condition.eventId = ids.get(condition.eventId) ?? condition.eventId;
    } else if (condition.kind === "all" || condition.kind === "any") condition.conditions.forEach(remapCondition);
    else if (condition.kind === "not") remapCondition(condition.condition);
  };
  const remapCommands = (commands: readonly Command[]) => {
    for (const command of commands) {
      if (command.kind === "moveEvent") remapRoute(command.route);
      if (command.kind === "storeParty" && command.mapId === map.id) command.mapId = id;
      if (command.kind === "fork") remapCondition(command.condition);
      if (command.kind === "choices") for (const option of command.options) {
        if (option.showWhen) remapCondition(option.showWhen);
        if (option.enableWhen) remapCondition(option.enableWhen);
      }
      for (const branch of commandBranches(command)) remapCommands(branch.commands);
    }
  };
  for (const event of copy.events) {
    remapRoute(event.moveRoute);
    if (event.schedule) {
      event.schedule = event.schedule.map(row => row.at.mapId === map.id ? { ...row, at: { ...row.at, mapId: id } } : row);
    }
    if (event.condition) remapCondition(event.condition);
    remapCommands(event.commands);
    for (const page of event.pages ?? []) {
      remapRoute(page.movement.route);
      page.movement.living?.destinations.forEach(remapPoint);
      page.conditions.forEach(remapCondition);
      remapCommands(page.commands);
    }
  }
  const mapTree = structuredClone(project.mapTree);
  const index = siblingIndex(mapTree, map.id);
  if (!insertTreeNode(mapTree, { mapId: id, children: [] }, findParentMapId(mapTree, map.id) ?? "", index < 0 ? undefined : index + 1)) {
    appendToTree(mapTree, id);
  }
  const after = { ...project, maps: { ...project.maps, [id]: copy }, mapTree };
  if (changesBlueprintPlaces(project, after)) {
    throw new PrimitiveError("이 이름을 쓰면 게임 청사진이 복제한 맵을 가리켜요. 다른 이름을 골라 주세요.");
  }
  return after;
}

function eventLabel(project: Project, mapId: string, eventId: string): string {
  const event = project.maps[mapId]?.events.find(entry => entry.id === eventId);
  return label(event && eventDisplayName(event) !== event.id ? eventDisplayName(event) : undefined, "이름 없는 이벤트");
}

export function changesBlueprintPlaces(before: Project, after: Project): boolean {
  const blueprint = before.gameBlueprint;
  if (!blueprint) return false;
  const names = [...blueprint.steps.map(step => step.place), ...(blueprint.places ?? []).flatMap(place =>
    place.from ? [place.name, place.from] : [place.name])];
  return names.some(name => {
    const original = blueprintMapFor(before, name);
    return original && blueprintMapFor(after, name)?.id !== original.id;
  });
}

type MapTarget = { readonly mapId: string; readonly x?: number; readonly y?: number; readonly locationId?: string };
type MapTargetCheck = (target: MapTarget) => boolean;

function questUsesMap(project: Project, check: MapTargetCheck): boolean {
  const target = (ref: { mapId: string } | { create: MapTarget }) => check("create" in ref ? ref.create : ref);
  return project.quests?.some(quest => isStepQuestDef(quest) && (
    target(quest.giver) || quest.gates?.some(check) || quest.worldChanges?.some(change => check(change.target))
    || quest.steps.some(step => {
      switch (step.kind) {
        case "talk":
        case "choice":
        case "deliver": return target(step.target);
        case "escort": return target(step.target) || check(step.destination);
        case "collect": return step.sources.some(check);
        case "reach": return check(step);
        case "craft":
        case "inspect":
        case "kill": return check(step.at);
      }
    })
  )) ?? false;
}

function scriptTransfersToMap(command: Extract<Command, { kind: "script" }>, project: Project, mapId: string): boolean {
  return scriptCalls(command, "map", project).includes(mapId)
    || scriptHasDynamic(command, "map", { access: "call", library: project.scriptLibrary });
}

function routeUsesMap(route: MoveRoute | undefined, check: MapTargetCheck): boolean {
  return route?.moves.some(move => move.kind === "npcTransfer" && check(move)) ?? false;
}

function commandUsesMap(command: Command, check: MapTargetCheck): boolean {
  switch (command.kind) {
    case "transfer":
    case "changeTile":
      return check(command);
    case "storeParty":
      return command.mapId !== undefined && check({ ...command, mapId: command.mapId });
    case "moveEvent":
      return routeUsesMap(command.route, check);
    case "m2Command": {
      const { mapId, x, y } = command.fields;
      return typeof mapId === "string" && check({ mapId, x: Number(x), y: Number(y) });
    }
    default:
      return false;
  }
}

function conditionUsesLocation(condition: BattleEventCondition | undefined, id: string): boolean {
  switch (condition?.kind) {
    case "insideLocation": return condition.locationId === id;
    case "eventSeesPlayer": return condition.watchers?.locationId === id;
    case "all":
    case "any": return condition.conditions.some(child => conditionUsesLocation(child, id));
    case "not": return conditionUsesLocation(condition.condition, id);
    default: return false;
  }
}

function commandConditionUsesLocation(command: Command, id: string): boolean {
  if (command.kind === "fork") return conditionUsesLocation(command.condition, id);
  if (command.kind === "choices") {
    return command.options.some(option => conditionUsesLocation(option.showWhen, id) || conditionUsesLocation(option.enableWhen, id));
  }
  return false;
}

function eventUsesLocation(event: GameEvent, id: string): boolean {
  const triggerUsesLocation = (trigger: GameEvent["trigger"]) =>
    trigger.kind === "locationTransition" && trigger.locationId === id;
  const commandsUseLocation = (commands: readonly Command[]): boolean =>
    commands.some(command => commandConditionUsesLocation(command, id)
      || commandBranches(command).some(branch => commandsUseLocation(branch.commands)));
  return triggerUsesLocation(event.trigger) || conditionUsesLocation(event.condition, id) || commandsUseLocation(event.commands)
    || (event.pages?.some(page => triggerUsesLocation(page.trigger)
      || page.conditions?.some(condition => conditionUsesLocation(condition, id)) || commandsUseLocation(page.commands)) ?? false);
}

export function locationDeletionDraftError(project: Project, mapId: string, id: string, live?: SmallTaskDraftSource): string | undefined {
  const working = withOpenEventDrafts(project, live);
  const event = working.maps[mapId].events.find(event => event.draft && eventUsesLocation(event, id));
  if (!event) return undefined;
  return `미저장 이벤트 『${eventLabel(working, mapId, event.id)}』에서 이 장소를 사용하고 있어 삭제할 수 없어요.`;
}

export function usesLocation(project: Project, map: GameMap, id: string): boolean {
  if (map.fieldSpawns?.some(spawn => spawn.locationId === id)
    || Object.values(map.locationRoleProjection ?? {}).some(roles => Object.hasOwn(roles, id))
    || countLocationReferences(project, id, map.id) > 0
    || questUsesMap(project, point => point.mapId === map.id && point.locationId === id)) return true;
  if (map.events.some(event => eventUsesLocation(event, id))) return true;
  if (project.database.troops.some(troop => troop.battleEventPages?.some(page =>
    page.conditions?.some(condition => conditionUsesLocation(condition, id))))) return true;

  let used = false;
  // 공용 이벤트와 전투 이벤트는 실행될 때의 맵에서 장소를 찾는다.
  visitProjectCommands(project, ({ command, location }) => {
    if (used || "mapId" in location) return;
    used = commandConditionUsesLocation(command, id);
  });
  return used;
}

function mapReferenceNames(project: Project, mapId: string): ReadonlySet<string> {
  const references = new Set<string>();
  const pointsHere: MapTargetCheck = point => point.mapId === mapId;
  visitProjectCommands(project, ({ command, location }) => {
    if ("mapId" in location && location.mapId === mapId) return;
    const scriptTargetsMap = command.kind === "script" && (
      scriptTransfersToMap(command, project, mapId) || scriptReads(command, "map", project).includes(mapId)
      || scriptWrites(command, "map", project).includes(mapId)
      || scriptHasDynamic(command, "map", { library: project.scriptLibrary })
    );
    if (!commandUsesMap(command, pointsHere) && !scriptTargetsMap) return;
    switch (location.kind) {
      case "legacyEvent":
      case "eventPage":
        references.add(eventLabel(project, location.mapId, location.eventId));
        break;
      case "commonEvent":
        references.add(label(location.commonEventName, "공용 이벤트"));
        break;
      case "troopPage":
        references.add(label(location.troopName, "전투 이벤트"));
        break;
    }
  });
  for (const module of project.scriptLibrary ?? []) {
    const { reads, writes, calls } = scriptCommandEffects(module);
    if ([...reads, ...writes, ...calls].some(ref => ref.kind === "map" && ref.id === mapId)) {
      references.add(label(module.name, "공용 스크립트"));
    }
  }
  for (const other of Object.values(project.maps)) {
    if (other.id === mapId) continue;
    for (const event of other.events) {
      if (routeUsesMap(event.moveRoute, pointsHere) || event.schedule?.some(entry => pointsHere(entry.at))
        || event.pages?.some(page => routeUsesMap(page.movement.route, pointsHere) || page.movement.living?.destinations.some(pointsHere))) {
        references.add(eventLabel(project, other.id, event.id));
      }
    }
    if (other.transit?.routes.some(route => route.stops?.some(stop => stop.board?.mapId === mapId))) {
      references.add(`${mapLabel(other)} 탈것 노선`);
    }
    if (other.worldmapSource?.variant?.of === mapId) references.add(`${mapLabel(other)} 세계 지도`);
  }
  for (const connection of project.mapConnections ?? []) {
    if (connection.from.mapId !== mapId && connection.to.mapId !== mapId) continue;
    const other = project.maps[connection.from.mapId === mapId ? connection.to.mapId : connection.from.mapId];
    references.add(label(connection.name === connection.id ? undefined : connection.name, other ? `${mapLabel(other)} 연결` : "맵 연결"));
  }
  return references;
}

function mapReferenceError(references: ReadonlySet<string>): string | undefined {
  if (!references.size) return undefined;
  const names = [...references].slice(0, 3).map(name => `『${name}』`).join(", ");
  const extra = references.size > 3 ? ` 외 ${references.size - 3}곳` : "";
  return `${names}${extra}에서 이 맵을 사용하고 있어 삭제할 수 없어요.`;
}

export function mapRemovalDraftError(project: Project, mapId: string, live: SmallTaskDraftSource): string | undefined {
  const unsaved = live.maps[mapId]?.events.find(event => event.draft &&
    (event.draft.conflict || eventDraftDiff(mapId, event)?.changes.length));
  if (unsaved) return `『${label(eventDisplayName(unsaved), "이름 없는 이벤트")}』의 편집을 먼저 저장하거나 취소해 주세요.`;

  if (!Object.values(live.maps).some(map => map.events.some(event => event.draft))) return undefined;
  return mapReferenceError(mapReferenceNames(withOpenEventDrafts(project, live), mapId));
}

export function removeMap(project: Project, map: GameMap, live?: SmallTaskDraftSource): Project {
  if (project.startMapId === map.id || Object.keys(project.maps).length <= 1) {
    throw new PrimitiveError("게임의 시작 맵이나 마지막 맵은 삭제할 수 없어요.");
  }
  const draftError = mapRemovalDraftError(project, map.id, live ?? project);
  if (draftError) throw new PrimitiveError(`${MAP_REMOVAL_DRAFT_REFUSAL}${draftError}`);
  const error = mapReferenceError(mapReferenceNames(project, map.id));
  if (error) throw new PrimitiveError(error);
  if (questUsesMap(project, point => point.mapId === map.id)) {
    throw new PrimitiveError("이 맵을 사용하는 퀘스트가 있어 삭제할 수 없어요.");
  }

  const draft = structuredClone(project);
  applyMapDeletion(draft, map.id);
  const maps = { ...project.maps };
  delete maps[map.id];
  const after = { ...project, maps, mapTree: draft.mapTree };
  if (changesBlueprintPlaces(project, after) || project.gameBlueprint?.steps.some(step => step.built?.mapId === map.id)
    || project.gameBlueprint?.retired?.some(step => step.mapId === map.id)) {
    throw new PrimitiveError("게임 청사진에 이 맵을 사용하는 장면이 있어 삭제할 수 없어요.");
  }
  if (project.system.titleScreen?.variants?.some(variant => variant.when.kind === "saveMapId" && variant.when.mapId === map.id)
    || Object.values(project.session.placeables ?? {}).some(item => item.mapId === map.id)
    || project.system.opening?.stage?.mapId === map.id
    || project.endings?.some(ending => ending.continueTo?.mapId === map.id)
    || Object.values(project.spatialAuthoring?.occurrences ?? {}).some(row => row.bindings.some(binding => binding.mapId === map.id))
    || map.events.some(event => Object.hasOwn(project.meta.oprnCharacterRoles ?? {}, `${map.id}/${event.id}`))) {
    throw new PrimitiveError("이 맵을 사용하는 게임 설정이나 배치가 남아 있어 삭제할 수 없어요.");
  }
  if (map.events.some(event => Object.hasOwn(project.session.selfSwitches ?? {}, event.id)
    && !Object.values(after.maps).some(other => other.events.some(entry => entry.id === event.id)))) {
    throw new PrimitiveError("이 맵의 이벤트에 시작 상태가 지정되어 있어 삭제할 수 없어요.");
  }
  if (!jsonEqual(draft, after)) {
    throw new PrimitiveError("범위 밖의 설정이 이 맵을 사용하고 있어 삭제할 수 없어요.");
  }
  assertReferencesPreserved(project, after, "이 맵을 사용하는 설정이 남아 있어 삭제할 수 없어요.");
  return after;
}

export function resizeMap(project: Project, map: GameMap, width: number, height: number, live?: SmallTaskDraftSource): Project {
  if (width === map.width && height === map.height) return project;
  if (map.worldmapSource) {
    throw new PrimitiveError("이 맵의 크기는 세계 지도 원본에서 정해요. 세계 지도 편집에서 바꿔 주세요.");
  }
  const shrinking = width < map.width || height < map.height;
  const working = shrinking ? withOpenEventDrafts(project, live) : project;
  if (shrinking) {
    const outside = (point: { x: number; y: number }) =>
      inMapBounds(map, point.x, point.y) && (point.x >= width || point.y >= height);
    const cutsRect = (rect: Rect) => rect.x < map.width && rect.y < map.height
      && outside({ x: Math.min(map.width - 1, rect.x + rect.w - 1), y: Math.min(map.height - 1, rect.y + rect.h - 1) });
    const cutsTarget: MapTargetCheck = point => point.mapId === map.id && point.x !== undefined && point.y !== undefined
      && outside({ x: point.x, y: point.y });
    const lostPosition = (project.mapConnections ?? []).some(({ from, to }) =>
      [from, to].some(point => point.mapId === map.id && outside(point)));
    const sources = working === project ? [project] : [project, working];
    const lostCommandTarget = sources.some(source => {
      let lost = false;
      visitProjectCommands(source, ({ command }) => {
        lost ||= commandUsesMap(command, cutsTarget)
          || (command.kind === "script" && scriptTransfersToMap(command, source, map.id));
      });
      return lost;
    });
    const lostRouteTarget = sources.some(source => Object.values(source.maps).some(other =>
      other.events.some(event => routeUsesMap(event.moveRoute, cutsTarget) || event.schedule?.some(entry => cutsTarget(entry.at))
        || event.pages?.some(page => routeUsesMap(page.movement.route, cutsTarget) || page.movement.living?.destinations.some(cutsTarget)))
      || other.transit?.routes.some(route => route.stops?.some(stop => stop.board && cutsTarget(stop.board)))));
    const lostPreset = project.testPresets?.some(preset => preset.startMapId === map.id && preset.startPos && outside(preset.startPos));
    const lostAuthoredTarget = questUsesMap(project, cutsTarget)
      || project.endings?.some(ending => ending.continueTo && cutsTarget(ending.continueTo))
      || Object.values(project.session.placeables ?? {}).some(cutsTarget)
      || project.system.monsterCampaign?.locations.some(cutsTarget)
      || project.worldAtlases?.some(atlas => {
        const nodeIds = new Set(atlas.nodes.filter(node => node.mapId === map.id).map(node => node.id));
        return atlas.nodes.some(node => (nodeIds.has(node.id) && outside(node.entry))
          || (atlas.overviewMapId === map.id && node.worldEntrance && outside(node.worldEntrance)))
          || atlas.edges.some(edge => (nodeIds.has(edge.from) && edge.fromExit && outside(edge.fromExit))
            || (nodeIds.has(edge.to) && edge.toExit && outside(edge.toExit)));
      })
      || project.worldGraph?.edges.some(({ from, to }) => (
        (from.mapId === map.id && from.exit && "x" in from.exit && cutsRect(from.exit))
        || (to.mapId === map.id && to.entry && "x" in to.entry && ("w" in to.entry ? cutsRect(to.entry) : outside(to.entry)))
      ))
      || Object.values(project.spatialAuthoring?.occurrences ?? {}).some(row => row.bindings.some(binding =>
        binding.mapId === map.id && cutsRect({ ...binding.rect, w: binding.rect.width, h: binding.rect.height })));
    if (lostPosition || lostCommandTarget || lostRouteTarget || map.locations?.some(cutsRect) || map.doors?.some(cutsRect)
      || map.layoutPlan?.regions.some(cutsRect) || map.structurePlacements?.some(cutsRect)
      || map.fieldSpawns?.some(spawn => cutsRect(spawn.area)) || map.safeZones?.some(cutsRect) || map.farmableArea?.some(cutsRect)
      || map.encounterTable?.some(entry => entry.conditions?.region && cutsRect(entry.conditions.region))
      || map.transit?.routes.some(route => route.path.some(outside)) || lostPreset || lostAuthoredTarget) {
      throw new PrimitiveError("맵을 이 크기로 줄이면 이동 위치나 기존 영역이 맵 밖으로 나가요.");
    }
  }
  const after = runMapTool(mapDraft(project, map), "resize_map", { mapId: map.id, width, height },
    "축소 범위 밖에 이벤트나 시작 위치가 있어요.");
  const failure = "크기를 바꾸면 맵을 가리키는 설정이 끊겨요.";
  assertReferencesPreserved(project, after, failure);
  if (working !== project) assertReferencesPreserved(working, withOpenEventDrafts(after, live), failure);
  return after;
}
