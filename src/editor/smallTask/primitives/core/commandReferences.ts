import { scriptContainsLiteral, withOpenEventDrafts } from "@/ai/smallTaskReferences";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { openingStageFlag } from "@/project/openingStage";
import { isQuestGraphDef } from "@/project/quest/questDef";
import { extractQuestGraphConditions, resolveQuestGraphCondition } from "@/project/quest/questGraph";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type { Command, Project } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext } from "../types";

function usesLabel(list: readonly Command[], name: string, root = true): boolean {
  if (!root && list.some(command => command.kind === "label" && command.name === name)) return false;
  return list.some(command =>
    (command.kind === "gotoLabel" && command.name === name)
    || (command.kind === "script" && scriptContainsLiteral(command, name, "gotoLabel"))
    || nestedCommandLists(command).some(branch => usesLabel(branch, name, false)));
}

function lastSpawnStillUsed(project: Project, mapId: string, id: string): boolean {
  let defined = project.maps[mapId]?.fieldSpawns?.some(spawn => spawn.id === id) ?? false;
  let used = project.scriptLibrary?.some(script => scriptContainsLiteral(script, id, "despawnFieldEnemy")) ?? false;
  visitProjectCommands(project, ({ command, location }) => {
    if ("mapId" in location && location.mapId !== mapId) return;
    if (command.kind === "spawnFieldEnemy" && command.spawn.id === id
      && (location.kind !== "troopPage" || location.pageId.startsWith("afterBattle."))) defined = true;
    if ((command.kind === "despawnFieldEnemy" && command.spawnId === id)
      || (command.kind === "script" && scriptContainsLiteral(command, id, "despawnFieldEnemy"))) used = true;
  });
  return used && !defined;
}

function questReadsSwitch(project: Project, id: string): boolean {
  return project.quests?.some(quest => isQuestGraphDef(quest) && quest.nodes.some(node =>
    extractQuestGraphConditions(node.completesWhen).some(condition => {
      try {
        const resolved = resolveQuestGraphCondition(project, condition);
        return resolved.kind === "switch" && resolved.targetId === id;
      } catch {
        // An unrelated invalid condition in a saved quest cannot resolve to a runtime reader.
        return false;
      }
    }))) ?? false;
}

export function assertCommandDeletion(
  ctx: PrimitiveContext, after: Project, list: readonly Command[], command: Command,
): void {
  if (ctx.target.kind !== "event") return;
  ctx.commandDeletionGuard?.(ctx, list, command);
  if (command.kind === "label") {
    if (list.find(row => row.kind === "label" && row.name === command.name) === command && usesLabel(list, command.name)) {
      throw new PrimitiveError("이 위치 표시로 이동하는 명령이 남아 있어 삭제할 수 없어요.");
    }
  } else if (command.kind === "setFlag" && !command.value) {
    const stage = after.system.opening?.stage;
    if (stage && command.flag === openingStageFlag(stage.mapId, stage.eventId)) {
      throw new PrimitiveError("오프닝을 마치는 데 필요한 기억 명령이라 삭제할 수 없어요.");
    }
  } else if (command.kind === "spawnFieldEnemy" || command.kind === "setSwitch" || command.kind === "setVariable") {
    // The selected edit takes precedence over the open draft and its original in both views.
    const target = ctx.target;
    const selected = after.maps[target.mapId]?.events.find(event => event.id === target.eventId);
    const selectedMap = after.maps[target.mapId];
    let edited = after;
    if (selected?.draft) {
      const { draft: _draft, ...event } = selected;
      edited = { ...after, maps: { ...after.maps,
        [target.mapId]: { ...selectedMap, events: selectedMap.events.map(row => row === selected ? event : row) },
      } };
    }
    const working = withOpenEventDrafts(edited, ctx.live, target);
    const saved = projectViewWithoutEventDrafts(working);
    const views = saved === working ? [working] : [working, saved];
    if (command.kind === "spawnFieldEnemy") {
      if (views.some(project => lastSpawnStillUsed(project, target.mapId, command.spawn.id))) {
        throw new PrimitiveError("이 출현 대상을 제거하는 명령이 남아 있어 삭제할 수 없어요.");
      }
    } else if (views.some(project => {
      const kind = command.kind === "setSwitch" ? "switch" : "variable";
      const id = command.kind === "setSwitch" ? command.switchId : command.variableId;
      const usage = usageBucketFor(buildStoryFlagUsageIndex(project), kind, id);
      return usage.writes.length === 0 && (usage.reads.length > 0 || (kind === "switch" && questReadsSwitch(project, id)));
    })) {
      throw new PrimitiveError("이 명령이 설정하는 진행 값을 읽는 조건이 남아 있어 삭제할 수 없어요.");
    }
  }
}
