import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { findSchedule } from "@/project/schedule";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, GameMap, Project } from "@/project/types";
import { scopedPage } from "../../core/helpers";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";
import { scriptMayDispatchFlow } from "./script";

type CommandList = readonly Command[];
type FlowRoot = { commands: CommandList; mapId: string; continueAfterTransfer: boolean };
type MapsAtCommand = (command: Command) => ReadonlySet<string>;

export function firstLabelIndex(commands: readonly Command[], name: string): number {
  return commands.findIndex(command => command.kind === "label" && command.name === name);
}

function activePageLists(event: GameMap["events"][number]): readonly CommandList[] {
  const lists: CommandList[] = [];
  // The highest matching page wins. An unconditional page hides all earlier pages and the legacy list.
  for (const page of [...(event.pages ?? [])].reverse()) {
    lists.push(page.commands);
    if (!page.conditions.length) return lists;
  }
  return [...lists, event.commands];
}

function commonList(project: Project, id: string): CommandList {
  return project.commonEvents.find(event => event.id === id)?.commands ?? [];
}

function calledLists(project: Project, mapIds: Iterable<string>, command: Command): readonly CommandList[] {
  switch (command.kind) {
    case "callCommonEvent":
      return [commonList(project, command.commonEventId)];
    case "callMapEvent": {
      return [...mapIds].flatMap(mapId => {
        const event = project.maps[mapId]?.events.find(entry => entry.id === command.eventId);
        return event ? activePageLists(event) : [];
      });
    }
    case "runSchedule":
      return findSchedule(project.database, command.scheduleId)?.activities.map(activity => commonList(project, activity.commonEventId)) ?? [];
    default:
      return [];
  }
}

function* flowRoots(project: Project, map: GameMap, page: CommandList): Generator<FlowRoot> {
  const preservesStack = (event: GameMap["events"][number], commands: CommandList) => event.pages?.some(
    candidate => candidate.commands === commands && candidate.detectionEncounter !== undefined);
  yield { commands: page, mapId: map.id, continueAfterTransfer: map.events.some(event => preservesStack(event, page)) };
  const globalLists = [
    ...project.commonEvents.map(event => event.commands),
    ...project.database.troops.flatMap(troop => troopAfterBattleLists(troop).map(entry => entry.commands)),
  ];
  for (const entry of Object.values(project.maps)) {
    for (const event of entry.events) {
      for (const commands of activePageLists(event)) {
        if (commands !== page && commands.length) {
          yield { commands, mapId: entry.id, continueAfterTransfer: preservesStack(event, commands) ?? false };
        }
      }
    }
    for (const commands of globalLists) {
      if (commands.length) yield { commands, mapId: entry.id, continueAfterTransfer: true };
    }
  }
}

function rootContext(project: Project, root: FlowRoot, conservative: boolean) {
  const frames = new Map<CommandList, Map<string, Set<string>>>();
  const mapIds = new Set([root.mapId]);
  const callMaps = new Map<Command, Set<string>>();
  const noMaps: ReadonlySet<string> = new Set();
  let changed = false;
  function exits(commands: CommandList, mapId: string): ReadonlySet<string> {
    const entry = conservative ? root.mapId : mapId;
    let byMap = frames.get(commands);
    if (!byMap) frames.set(commands, byMap = new Map());
    let destinations = byMap.get(entry);
    if (!destinations) {
      byMap.set(entry, destinations = new Set());
      changed = true;
    }
    return destinations;
  }
  exits(root.commands, root.mapId);
  // A child can return in a different map. Propagate its exits to later rows until the map sets stabilize.
  do {
    changed = false;
    for (const [commands, byMap] of frames) {
      for (const [entryMap, destinations] of byMap) {
        // Protection must also account for jumps back into a caller after a transfer.
        const currentMaps = new Set(conservative ? mapIds : [entryMap]);
        for (const command of commands) {
          const before = [...currentMaps];
          const branches = nestedCommandLists(command);
          function follow(child: CommandList, from: string): void {
            if (child.length) exits(child, from).forEach(id => currentMaps.add(id));
          }
          function transfer(mapId?: string): false {
            if (root.continueAfterTransfer) {
              if (mapId === undefined && conservative) Object.keys(project.maps).forEach(id => currentMaps.add(id));
              if (mapId !== undefined && Object.hasOwn(project.maps, mapId)) currentMaps.add(mapId);
            }
            return false;
          }
          if (command.kind === "callMapEvent") {
            let ids = callMaps.get(command);
            if (!ids) callMaps.set(command, ids = new Set());
            before.forEach(id => ids.add(id));
          }
          for (const from of before) {
            for (const branch of branches) follow(branch, from);
            for (const called of calledLists(project, [from], command)) follow(called, from);
          }
          if (command.kind === "transfer") {
            if (!conservative && !root.continueAfterTransfer) {
              currentMaps.clear();
              break;
            }
            transfer(command.mapId);
          }
          if (command.kind === "recallParty" || (command.kind === "m2Command"
            && m2CommandById(command.commandId)?.title === "Teleport Menu"
            && command.fields.transfer !== false && command.fields.transfer !== "false")) transfer();
          if (command.kind === "script") {
            scriptMayDispatchFlow(command.compiled, id => {
              const called = commonList(project, id);
              for (const from of [...currentMaps]) follow(called, from);
              return false;
            }, transfer, transfer);
          }
        }
        for (const mapId of currentMaps) {
          mapIds.add(mapId);
          if (!destinations.has(mapId)) {
            destinations.add(mapId);
            changed = true;
          }
        }
      }
    }
  } while (changed);
  return { mapIds, reachable: frames, mapsAt: (command: Command) => callMaps.get(command) ?? noMaps };
}

function hasDependentJump(project: Project, mapsAt: MapsAtCommand, owner: CommandList, name: string): boolean {
  const visited = new Set<CommandList>();

  function scan(commands: readonly Command[]): boolean {
    if (visited.has(commands)) return false;
    visited.add(commands);
    // A nearer frame's own label takes precedence over the caller's label.
    if (commands !== owner && firstLabelIndex(commands, name) >= 0) return false;
    for (const command of commands) {
      if (command.kind === "gotoLabel" && command.name === name) return true;
      if (nestedCommandLists(command).some(scan)) return true;
      if (calledLists(project, mapsAt(command), command).some(scan)) return true;
      if (command.kind === "script" && scriptMayDispatchFlow(command.compiled, id => scan(commonList(project, id)))) return true;
    }
    return false;
  }

  return scan(owner);
}

function callerLabelInRoot(project: Project, mapsAt: MapsAtCommand, root: CommandList, owner: CommandList, name: string, unknownCanCall: boolean): boolean {
  const withoutLabel = new Set<CommandList>();
  const withLabel = new Set<CommandList>();

  function scan(commands: CommandList, callerHasLabel: boolean): boolean {
    if (commands === owner && callerHasLabel) return true;
    const hasLabel = callerHasLabel || firstLabelIndex(commands, name) >= 0;
    const visited = hasLabel ? withLabel : withoutLabel;
    if (visited.has(commands)) return false;
    visited.add(commands);
    return commands.some(command => nestedCommandLists(command).some(list => scan(list, hasLabel))
      || calledLists(project, mapsAt(command), command).some(list => scan(list, hasLabel))
      || (command.kind === "script" && scriptMayDispatchFlow(command.compiled,
        id => scan(commonList(project, id), hasLabel), () => hasLabel && unknownCanCall)));
  }

  return scan(root, false);
}

export function hasCallerLabel(project: Project, map: GameMap, lists: readonly CommandList[], name: string): boolean {
  const owner = lists.at(-1)!;
  for (const root of flowRoots(project, map, lists[0]!)) {
    const { mapsAt, reachable } = rootContext(project, root, false);
    if (reachable.has(owner) && callerLabelInRoot(project, mapsAt, root.commands, owner, name, false)) return true;
  }
  return false;
}

export function labelReferenceViews(ctx: PrimitiveContext): readonly Project[] {
  const working = withOpenEventDrafts(ctx.project, ctx.live, ctx.target.kind === "event" ? ctx.target : undefined);
  return working === ctx.project ? [ctx.project] : [ctx.project, working];
}

function someRootContext(
  project: Project, map: GameMap, page: CommandList,
  matches: (root: FlowRoot, context: ReturnType<typeof rootContext>) => boolean,
): boolean {
  for (const root of flowRoots(project, map, page)) {
    if (matches(root, rootContext(project, root, true))) return true;
  }
  return false;
}

function labelHasDependentJump(
  project: Project, map: GameMap, page: CommandList, list: CommandList, name: string,
): boolean {
  const allMaps = new Set(Object.keys(project.maps));
  return hasDependentJump(project, () => allMaps, list, name)
    && someRootContext(project, map, page, (_, { mapsAt, reachable }) => reachable.has(list)
      && hasDependentJump(project, mapsAt, list, name));
}

export function assertFlowCommandDeletion(ctx: PrimitiveContext, list: CommandList, command: Command): void {
  if (command.kind !== "label") return;
  if (command.name === CUTSCENE_END_LABEL) {
    throw new PrimitiveError("컷신을 건너뛸 때 사용하는 위치 표시는 삭제할 수 없어요.");
  }
  if (list[firstLabelIndex(list, command.name)] !== command) return;
  const { map, page } = scopedPage(ctx);
  if (labelReferenceViews(ctx).some(project =>
    labelHasDependentJump(project, project.maps[map.id]!, page.commands, list, command.name))) {
    throw new PrimitiveError("이 위치 표시로 이동하는 명령이 남아 있어 삭제할 수 없어요.");
  }
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
  const page = lists[0]!;
  const jumpsTo = (target: string) => labelHasDependentJump(project, map, page, list, target);
  if (previousName !== undefined && firstLabelIndex(list, previousName) === index
    && jumpsTo(previousName)) {
    throw new PrimitiveError("이 위치로 이동하는 명령이 남아 있거나 스크립트가 이 위치를 사용할 수 있습니다.");
  }
  const pageCanBeCalled = map.events.some(event => activePageLists(event).includes(page));
  if ((name === CUTSCENE_END_LABEL || jumpsTo(name))
    && (lists.slice(0, -1).some(ancestor => firstLabelIndex(ancestor, name) >= 0)
      || someRootContext(project, map, page, (root, { mapIds, mapsAt, reachable }) => {
        return (reachable.has(list) || (pageCanBeCalled && mapIds.has(map.id)))
          && callerLabelInRoot(project, mapsAt, root.commands, list, name, pageCanBeCalled && mapIds.has(map.id));
      }))) {
    throw new PrimitiveError("이 이름을 쓰면 기존 이동 명령이나 컷신 건너뛰기의 목적지가 바뀝니다. 다른 이름을 골라 주세요.");
  }
}
