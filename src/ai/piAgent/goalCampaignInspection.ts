import type { GameMap, Project } from "@/project/types";
import { collectCommands, reachableMapIdsFromStart } from "@/project/mapInspection";
import { GOAL_MIN_MAPS } from "./goalCommand";
import type { PiAgentDoneEvent } from "./protocol";

// Structural evidence only. Reachable transfer edges do not prove walkable
// doorways, branch completion, visual quality or a playable ending.
function hasPlayContent(map: GameMap): boolean {
  const encounter = (map.encounterRate ?? 0) > 0
    && ((map.troopIds?.length ?? 0) > 0 || (map.encounterTable?.length ?? 0) > 0);
  return encounter || (map.fieldSpawns?.length ?? 0) > 0
    || collectCommands(map.events ?? []).some(command =>
      command.kind === "text" ? command.body.trim().length > 0
        : !["transfer", "wait", "comment", "label", "exitEvent", "fork", "loop", "choices"].includes(command.kind));
}

export function inspectGoalCampaign(project: Project) {
  const maps = Object.values(project.maps);
  const reachable = reachableMapIdsFromStart(project);
  const emptyMapIds = maps.filter(map => !hasPlayContent(map)).map(map => map.id);
  const unreachableMapIds = maps.filter(map => !reachable.has(map.id)).map(map => map.id);
  const issues = [
    ...(maps.length < GOAL_MIN_MAPS ? [`맵 ${maps.length}/${GOAL_MIN_MAPS}개`] : []),
    ...(emptyMapIds.length ? [`이동문 외 콘텐츠가 없는 맵: ${emptyMapIds.join(", ")}`] : []),
    ...(unreachableMapIds.length ? [`시작점에서 연결되지 않은 맵: ${unreachableMapIds.join(", ")}`] : []),
  ];
  return { mapCount: maps.length, contentMapCount: maps.length - emptyMapIds.length,
    reachableMapCount: maps.length - unreachableMapIds.length, emptyMapIds, unreachableMapIds, issues };
}

export function goalProductionIssues(done: PiAgentDoneEvent): string[] {
  return [...(done.openingProduction?.issues ?? []), ...(done.gameSystemProduction?.issues ?? []),
    ...(done.monsterGameProduction?.issues ?? []),
    ...(done.interiorCompletion ?? []).map(report => `${report.mapId}: 실내 검사 미완료`)];
}
