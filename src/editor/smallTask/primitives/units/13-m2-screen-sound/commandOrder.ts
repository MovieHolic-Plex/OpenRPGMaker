import { eventCommandBranches } from "@/editor/eventCommandBranches";
import type { Command, EventPage, GameMap, Project } from "@/project/types";
import { commandListAt } from "../../core/helpers";

export const movePictureId = "m2-052-move-picture";
export const memorizeBgmId = "m2-063-memorize-current-bgm";
const replayBgmId = "m2-064-play-memorized-bgm";

function listsAlongPath(page: EventPage, path: readonly number[]) {
  const lists: { commands: readonly Command[]; index: number }[] = [];
  for (let offset = 0; offset < path.length; offset += 2) {
    lists.push({ commands: commandListAt(page, path.slice(0, offset)), index: path[offset]! });
  }
  return lists;
}

export function hasEarlierPicture(page: EventPage, path: readonly number[], pictureId: string): boolean {
  function availableAfter(commands: readonly Command[], available: boolean): boolean {
    for (const command of commands) {
      if (command.kind === "showPicture" && command.pictureId === pictureId) {
        available = Boolean(command.resourceId.trim());
      } else if (command.kind === "erasePicture" && command.pictureId === pictureId) {
        available = false;
      } else if (command.kind === "m2Command" && command.commandId === movePictureId &&
          String(command.fields.pictureId ?? "pic1") === pictureId && Object.hasOwn(command.fields, "resourceId")) {
        available = Boolean(String(command.fields.resourceId ?? "").trim());
      }
      // A previous optional branch can erase a known picture. Showing it in just one branch
      // doesn't establish it for later rows, unless the selected path enters that branch.
      if (available) available = eventCommandBranches(command).every(branch => availableAfter(branch.commands, true));
    }
    return available;
  }

  return listsAlongPath(page, path).reduce(
    (available, { commands, index }) => availableAfter(commands.slice(0, index), available), false,
  );
}

export function hasDependentBgmReplay(project: Project, map: GameMap, page: EventPage, path: readonly number[]): boolean {
  const active = new Set<readonly Command[]>();

  function calledLists(command: Command): readonly (readonly Command[])[] {
    if (command.kind === "callCommonEvent") {
      const event = project.commonEvents.find(event => event.id === command.commonEventId);
      return event ? [event.commands] : [];
    }
    if (command.kind === "callMapEvent") {
      const event = map.events.find(event => event.id === command.eventId);
      return event ? [event.commands, ...(event.pages ?? []).map(page => page.commands)] : [];
    }
    return [];
  }

  function firstBgmUse(commands: readonly Command[], start = 0): "replay" | "memorize" | undefined {
    if (active.has(commands)) return undefined;
    active.add(commands);
    try {
      for (const command of commands.slice(start)) {
        if (command.kind === "m2Command") {
          if (command.commandId === replayBgmId) return "replay";
          if (command.commandId === memorizeBgmId) return "memorize";
        }
        const branches = eventCommandBranches(command).map(branch => branch.commands);
        if ([...branches, ...calledLists(command)].some(list => firstBgmUse(list) === "replay")) return "replay";
      }
    } finally {
      active.delete(commands);
    }
    return undefined;
  }

  // After a nested list finishes, execution continues after its containing command.
  const lists = listsAlongPath(page, path);
  for (let depth = lists.length - 1; depth >= 0; depth -= 1) {
    const { commands, index } = lists[depth]!;
    const use = firstBgmUse(commands, index + 1);
    if (use) return use === "replay";
    const parent = lists[depth - 1];
    if (parent?.commands[parent.index]?.kind === "loop" && firstBgmUse(commands) === "replay") return true;
  }
  return false;
}
