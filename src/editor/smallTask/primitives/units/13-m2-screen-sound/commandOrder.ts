import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import type { Command, EventPage, GameMap, Project } from "@/project/types";
import { commandListAt } from "../../core/helpers";

export const movePictureId = "m2-052-move-picture";
export const memorizeBgmId = "m2-063-memorize-current-bgm";
const replayBgmId = "m2-064-play-memorized-bgm";
const endEventId = "m2-085-end-event-processing";

function calledLists(project: Project, map: GameMap, command: Command): readonly (readonly Command[])[] {
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

function hasCommand(project: Project, map: GameMap, root: readonly Command[], matches: (command: Command) => boolean): boolean {
  const visited = new Set<readonly Command[]>();
  function visit(commands: readonly Command[]): boolean {
    if (visited.has(commands)) return false;
    visited.add(commands);
    return commands.some(command => matches(command)
      || eventCommandBranches(command).some(branch => visit(branch.commands))
      || calledLists(project, map, command).some(visit));
  }
  return visit(root);
}

function listsAlongPath(page: EventPage, path: readonly number[]) {
  const lists: { commands: readonly Command[]; index: number }[] = [];
  for (let offset = 0; offset < path.length; offset += 2) {
    lists.push({ commands: commandListAt(page, path.slice(0, offset)), index: path[offset]! });
  }
  return lists;
}

function isExhaustiveFork(command: Command): boolean {
  return command.kind === "fork" && command.else !== undefined;
}

// undefined means the path cannot reach this point. Otherwise the value is
// true only when the picture is displayed on every path that reaches it.
type PictureAvailability = boolean | undefined;
type PictureFlow = { next: PictureAvailability; breaks: PictureAvailability };

function mergeAvailability(left: PictureAvailability, right: PictureAvailability): PictureAvailability {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return left && right;
}

export function hasEarlierPicture(project: Project, map: GameMap, page: EventPage, path: readonly number[], pictureId: string): boolean {
  // A jump can bypass a display or re-enter an earlier list after an erase.
  if (hasCommand(project, map, page.commands, command => command.kind === "gotoLabel")) return false;

  let atTarget: PictureAvailability;
  function scan(commands: readonly Command[], available: PictureAvailability, targetPath: readonly number[] | undefined, inLoop: boolean): PictureFlow {
    let breaks: PictureAvailability;
    for (let index = 0; index <= commands.length && available !== undefined; index += 1) {
      const target = targetPath?.[0] === index ? targetPath : undefined;
      if (target?.length === 1) atTarget = mergeAvailability(atTarget, available);
      const command = commands[index];
      if (!command) break;
      if (command.kind === "breakLoop" && inLoop) {
        return { next: undefined, breaks: mergeAvailability(breaks, available) };
      }
      if (command.kind === "m2Command" && command.commandId === endEventId) return { next: undefined, breaks };

      if (command.kind === "showPicture" && command.pictureId === pictureId) {
        available = Boolean(command.resourceId.trim());
      } else if (command.kind === "erasePicture" && command.pictureId === pictureId) {
        available = false;
      } else if (command.kind === "m2Command" && command.commandId === movePictureId &&
          String(command.fields.pictureId ?? "pic1") === pictureId && Object.hasOwn(command.fields, "resourceId")) {
        available = Boolean(String(command.fields.resourceId ?? "").trim());
      }

      if (command.kind === "loop") {
        const bodyPath = target?.[1] === LOOP_BODY_BRANCH_INDEX ? target.slice(2) : undefined;
        const first = scan(command.body, available, bodyPath, true);
        // Finishing a body can repeat it or continue after the interpreter's loop limit.
        let exits = mergeAvailability(first.next, first.breaks);
        if (first.next !== undefined && first.next !== available) {
          const later = scan(command.body, first.next, bodyPath, true);
          exits = mergeAvailability(exits, mergeAvailability(later.next, later.breaks));
        }
        available = exits;
      } else {
        let next: PictureAvailability = isExhaustiveFork(command) ? undefined : available;
        for (const branch of eventCommandBranches(command)) {
          const branchPath = target?.[1] === branch.branchIndex ? target.slice(2) : undefined;
          const outcome = scan(branch.commands, available, branchPath, inLoop);
          next = mergeAvailability(next, outcome.next);
          breaks = mergeAvailability(breaks, outcome.breaks);
        }
        available = next;
      }
    }
    return { next: available, breaks };
  }

  scan(page.commands, false, path, false);
  return atTarget === true;
}

export function hasDependentBgmReplay(project: Project, map: GameMap, page: EventPage, path: readonly number[]): boolean {
  const active = new Set<readonly Command[]>();
  type BgmUse = "replay" | "memorize" | "end" | "uncertain" | undefined;

  function firstBgmUse(commands: readonly Command[], start = 0): BgmUse {
    if (active.has(commands)) return undefined;
    active.add(commands);
    try {
      for (const command of commands.slice(start)) {
        if (command.kind === "gotoLabel" || command.kind === "breakLoop") return "uncertain";
        if (command.kind === "m2Command") {
          if (command.commandId === replayBgmId) return "replay";
          if (command.commandId === memorizeBgmId) return "memorize";
          if (command.commandId === endEventId) return "end";
        }
        const branches = eventCommandBranches(command).map(branch => firstBgmUse(branch.commands));
        const calls = calledLists(project, map, command).map(list => firstBgmUse(list));
        const uses = [...branches, ...calls];
        if (uses.includes("replay")) return "replay";
        if (uses.includes("uncertain")) return "uncertain";
        const alternatives = isExhaustiveFork(command) ? branches : calls;
        if (alternatives.length && alternatives.every(use => use === "memorize" || use === "end")) {
          return alternatives.includes("memorize") ? "memorize" : "end";
        }
      }
    } finally {
      active.delete(commands);
    }
    return undefined;
  }

  function mayReplay(use: Exclude<BgmUse, undefined>): boolean {
    if (use !== "uncertain") return use === "replay";
    // A jump can revisit a replay above the edited line or skip a later overwrite.
    return hasCommand(project, map, page.commands, command => command.kind === "m2Command" && command.commandId === replayBgmId);
  }

  // After a nested list finishes, execution continues after its containing command.
  const lists = listsAlongPath(page, path);
  for (let depth = lists.length - 1; depth >= 0; depth -= 1) {
    const { commands, index } = lists[depth]!;
    const use = firstBgmUse(commands, index + 1);
    if (use) return mayReplay(use);
    const parent = lists[depth - 1];
    if (parent?.commands[parent.index]?.kind === "loop") {
      const nextIteration = firstBgmUse(commands);
      if (nextIteration && mayReplay(nextIteration)) return true;
    }
  }
  return false;
}
