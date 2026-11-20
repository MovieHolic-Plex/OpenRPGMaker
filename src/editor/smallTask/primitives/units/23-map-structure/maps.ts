import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { inMapBounds } from "@/editor/tools/mapHelpers";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { ToolError } from "@/editor/tools/types";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { cloneGameMap } from "@/project/mapClone";
import { applyMapDeletion } from "@/project/mapDeletion";
import { eventDisplayName } from "@/project/eventDisplayName";
import { appendToTree, findParentMapId, findTreeNode, insertTreeNode, siblingIndex } from "@/project/mapTree";
import { forEachProjectScript, scriptCalls } from "@/project/script/effects";
import type { GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { displayText } from "../../../target";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";

export function selectedMap(ctx: PrimitiveContext): GameMap {
  const { target, project } = ctx;
  if (target.kind !== "map") throw new PrimitiveError("범위 밖이에요. 맵을 선택해 주세요.");
  const map = Object.hasOwn(project.maps, target.mapId) ? project.maps[target.mapId] : undefined;
  if (!map) throw new PrimitiveError("선택한 맵을 찾을 수 없어요.");
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
  const priorIssues = new Set(collectProjectReferenceIssues(before));
  if (collectProjectReferenceIssues(after).some(issue => !priorIssues.has(issue))) throw new PrimitiveError(failure);
}

export function nextMapId(project: Project): string {
  return freeId("map_small_task_", id => Object.hasOwn(project.maps, id) || Boolean(findTreeNode(project.mapTree, id)));
}

export function duplicateMap(project: Project, map: GameMap, name: string): Project {
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
  const mapTree = structuredClone(project.mapTree);
  const index = siblingIndex(mapTree, map.id);
  if (!insertTreeNode(mapTree, { mapId: id, children: [] }, findParentMapId(mapTree, map.id) ?? "", index < 0 ? undefined : index + 1)) {
    appendToTree(mapTree, id);
  }
  return { ...project, maps: { ...project.maps, [id]: copy }, mapTree };
}

function eventLabel(project: Project, mapId: string, eventId: string): string {
  const event = project.maps[mapId]?.events.find(entry => entry.id === eventId);
  return label(event && eventDisplayName(event) !== event.id ? eventDisplayName(event) : undefined, "이름 없는 이벤트");
}

export function removeMap(project: Project, map: GameMap): Project {
  const references = new Set<string>();
  visitProjectCommands(project, ({ command, location }) => {
    if ((command.kind !== "transfer" && command.kind !== "changeTile") || command.mapId !== map.id) return;
    switch (location.kind) {
      case "legacyEvent":
      case "eventPage":
        if (location.mapId !== map.id) references.add(eventLabel(project, location.mapId, location.eventId));
        break;
      case "commonEvent":
        references.add(label(location.commonEventName, "공용 이벤트"));
        break;
      case "troopPage":
        references.add(label(location.troopName, "전투 이벤트"));
        break;
    }
  });
  forEachProjectScript(project, (command, owner) => {
    if (owner.mapId === map.id || !scriptCalls(command, "map", project).includes(map.id)) return;
    if (owner.mapId && owner.eventId) references.add(eventLabel(project, owner.mapId, owner.eventId));
    else if (owner.commonEventId) references.add(label(project.commonEvents.find(event => event.id === owner.commonEventId)?.name, "공용 이벤트"));
    else references.add(label(project.database.troops.find(troop => troop.id === owner.troopId)?.name, "전투 이벤트"));
  });
  for (const connection of project.mapConnections ?? []) {
    if (connection.from.mapId !== map.id && connection.to.mapId !== map.id) continue;
    const other = project.maps[connection.from.mapId === map.id ? connection.to.mapId : connection.from.mapId];
    references.add(label(connection.name === connection.id ? undefined : connection.name, other ? `${mapLabel(other)} 연결` : "맵 연결"));
  }
  if (references.size) {
    throw new PrimitiveError(`『${[...references].join("』, 『")}』에서 이 맵을 참조하고 있어 삭제할 수 없어요.`);
  }
  if (project.startMapId === map.id || Object.keys(project.maps).length <= 1) {
    throw new PrimitiveError("게임의 시작 맵이나 마지막 맵은 삭제할 수 없어요.");
  }

  const draft = structuredClone(project);
  applyMapDeletion(draft, map.id);
  const maps = { ...project.maps };
  delete maps[map.id];
  const after = { ...project, maps, mapTree: draft.mapTree };
  if (!jsonEqual(draft, after)) {
    throw new PrimitiveError("범위 밖의 설정이 이 맵을 사용하고 있어 삭제할 수 없어요.");
  }
  assertReferencesPreserved(project, after, "이 맵을 사용하는 설정이 남아 있어 삭제할 수 없어요.");
  return after;
}

export function resizeMap(project: Project, map: GameMap, width: number, height: number): Project {
  if (width === map.width && height === map.height) return project;
  if (width < map.width || height < map.height) {
    const outside = (point: { x: number; y: number }) =>
      inMapBounds(map, point.x, point.y) && (point.x >= width || point.y >= height);
    const cutsRect = (rect: { x: number; y: number; w: number; h: number }) =>
      outside({ x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 });
    const lostPosition = (project.mapConnections ?? []).some(({ from, to }) =>
      [from, to].some(point => point.mapId === map.id && outside(point)));
    let lostTransfer = false;
    visitProjectCommands(project, ({ command }) => {
      if ((command.kind === "transfer" || command.kind === "changeTile") && command.mapId === map.id && outside(command)) {
        lostTransfer = true;
      }
    });
    if (lostPosition || lostTransfer || map.locations?.some(cutsRect) || map.doors?.some(cutsRect)
      || map.layoutPlan?.regions.some(cutsRect)) {
      throw new PrimitiveError("축소 범위 밖에 이동 위치나 기존 장소가 있어요.");
    }
  }
  const after = runMapTool(mapDraft(project, map), "resize_map", { mapId: map.id, width, height },
    "축소 범위 밖에 이벤트나 시작 위치가 있어요.");
  assertReferencesPreserved(project, after, "크기를 바꾸면 맵을 가리키는 설정이 끊겨요.");
  return after;
}
