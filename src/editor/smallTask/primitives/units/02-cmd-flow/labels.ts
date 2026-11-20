import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { findSchedule } from "@/project/schedule";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import { scriptMayDispatchFlow } from "./script";

export function firstLabelIndex(commands: readonly Command[], name: string): number {
  return commands.findIndex(command => command.kind === "label" && command.name === name);
}

function activePageLists(event: GameMap["events"][number]): Command[][] {
  const lists: Command[][] = [];
  // The highest matching page wins. An unconditional page hides all earlier pages and the legacy list.
  for (const page of [...(event.pages ?? [])].reverse()) {
    lists.push(page.commands);
    if (!page.conditions.length) return lists;
  }
  return [...lists, event.commands];
}

function commonList(project: Project, id: string): readonly Command[] {
  return project.commonEvents.find(event => event.id === id)?.commands ?? [];
}

function calledLists(project: Project, map: GameMap, command: Command): readonly (readonly Command[])[] {
  switch (command.kind) {
    case "callCommonEvent":
      return [commonList(project, command.commonEventId)];
    case "callMapEvent": {
      const event = map.events.find(entry => entry.id === command.eventId);
      return event ? activePageLists(event) : [];
    }
    case "runSchedule":
      return findSchedule(project.database, command.scheduleId)?.activities.map(activity => commonList(project, activity.commonEventId)) ?? [];
    default:
      return [];
  }
}

function hasDependentJump(project: Project, map: GameMap, owner: readonly Command[], name: string): boolean {
  const visited = new Set<readonly Command[]>();

  function scan(commands: readonly Command[]): boolean {
    if (visited.has(commands)) return false;
    visited.add(commands);
    // A nearer frame's own label takes precedence over the caller's label.
    if (commands !== owner && firstLabelIndex(commands, name) >= 0) return false;
    for (const command of commands) {
      if (command.kind === "gotoLabel" && command.name === name) return true;
      if (nestedCommandLists(command).some(scan)) return true;
      if (calledLists(project, map, command).some(scan)) return true;
      if (command.kind === "script" && scriptMayDispatchFlow(command.compiled, id => scan(commonList(project, id)))) return true;
    }
    return false;
  }

  return scan(owner);
}

function hasCallerLabel(project: Project, map: GameMap, page: readonly Command[], owner: readonly Command[], name: string): boolean {
  const mapLists: readonly (readonly Command[])[] = map.events.flatMap(activePageLists);
  const pageCanBeCalled = mapLists.includes(page);
  const roots = [page, ...mapLists, ...project.commonEvents.map(event => event.commands),
    ...project.database.troops.flatMap(troop => troopAfterBattleLists(troop).map(entry => entry.commands))];
  const withoutLabel = new Set<readonly Command[]>();
  const withLabel = new Set<readonly Command[]>();

  function scan(commands: readonly Command[], callerHasLabel: boolean): boolean {
    if (commands === owner && callerHasLabel) return true;
    const hasLabel = callerHasLabel || firstLabelIndex(commands, name) >= 0;
    const visited = hasLabel ? withLabel : withoutLabel;
    if (visited.has(commands)) return false;
    visited.add(commands);
    return commands.some(command => nestedCommandLists(command).some(list => scan(list, hasLabel))
      || calledLists(project, map, command).some(list => scan(list, hasLabel))
      || (command.kind === "script" && scriptMayDispatchFlow(command.compiled,
        id => scan(commonList(project, id), hasLabel), () => hasLabel && pageCanBeCalled)));
  }

  return roots.some(root => scan(root, false));
}

export function validateLabelChange(
  project: Project, map: GameMap, lists: readonly (readonly Command[])[], index: number, name: string, previousName?: string,
): void {
  if (previousName === name) return;
  const list = lists.at(-1)!;
  if (list.some((command, row) => command.kind === "label" && command.name.trim() === name.trim()
    && !(previousName !== undefined && row === index))) {
    throw new PrimitiveError("이 명령 목록에 같은 이름의 위치 표시가 있습니다. 다른 이름을 골라 주세요.");
  }
  if (previousName === CUTSCENE_END_LABEL) {
    throw new PrimitiveError("컷신을 건너뛸 때 사용하는 위치 표시의 이름은 바꿀 수 없습니다.");
  }
  if (previousName !== undefined && firstLabelIndex(list, previousName) === index
    && hasDependentJump(project, map, list, previousName)) {
    throw new PrimitiveError("이 위치로 이동하는 명령이 남아 있거나 스크립트가 이 위치를 사용할 수 있습니다.");
  }
  if ((name === CUTSCENE_END_LABEL || hasDependentJump(project, map, list, name))
    && (lists.slice(0, -1).some(ancestor => firstLabelIndex(ancestor, name) >= 0)
      || hasCallerLabel(project, map, lists[0]!, list, name))) {
    throw new PrimitiveError("이 이름을 쓰면 기존 이동 명령이나 컷신 건너뛰기의 목적지가 바뀝니다. 다른 이름을 골라 주세요.");
  }
}
