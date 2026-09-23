import type { Command, GameEvent, GameMap, MapId } from "@/project/types";
import { mapPresentItemBranches } from "@/project/eventCommands/presentItemBranches";

export type CloneGameMapOptions = {
  readonly newId: MapId;
  readonly newName: string;
  readonly nextEventId: () => string;
};

export function cloneGameMap(source: GameMap, options: CloneGameMapOptions): GameMap {
  const copy = structuredClone(source);
  copy.id = options.newId;
  copy.name = options.newName;
  copy.events = source.events.map((event) => cloneEvent(event, source.id, options.newId, options.nextEventId));
  return copy;
}

function cloneEvent(event: GameEvent, sourceMapId: MapId, newMapId: MapId, nextEventId: () => string): GameEvent {
  const cloned = structuredClone(event);
  cloned.id = nextEventId();
  cloned.commands = rewriteCommands(cloned.commands, sourceMapId, newMapId);
  if (cloned.pages) {
    cloned.pages = cloned.pages.map((page) => ({
      ...page,
      id: nextEventId(),
      commands: rewriteCommands(page.commands, sourceMapId, newMapId),
    }));
  }
  return cloned;
}

function rewriteCommands(commands: readonly Command[], sourceMapId: MapId, newMapId: MapId): Command[] {
  return commands.map((command) => rewriteCommand(command, sourceMapId, newMapId));
}

function rewriteCommand(command: Command, sourceMapId: MapId, newMapId: MapId): Command {
  if (command.kind === "transfer" || command.kind === "changeTile") {
    return command.mapId === sourceMapId ? { ...command, mapId: newMapId } : { ...command };
  }
  if (command.kind === "presentItem") {
    return mapPresentItemBranches(command, (branch) => rewriteCommands(branch, sourceMapId, newMapId));
  }
  if (command.kind === "choices") {
    return {
      ...command,
      options: command.options.map((option) => ({
        ...option,
        branch: rewriteCommands(option.branch, sourceMapId, newMapId),
      })),
      cancelBranch: command.cancelBranch
        ? rewriteCommands(command.cancelBranch, sourceMapId, newMapId)
        : command.cancelBranch,
    };
  }
  if (command.kind === "fork") {
    return {
      ...command,
      then: rewriteCommands(command.then, sourceMapId, newMapId),
      else: command.else ? rewriteCommands(command.else, sourceMapId, newMapId) : command.else,
    };
  }
  if (command.kind === "loop") {
    return { ...command, body: rewriteCommands(command.body, sourceMapId, newMapId) };
  }
  if (command.kind === "shop" && command.transactionBranch) {
    return {
      ...command,
      transactionBranch: rewriteCommands(command.transactionBranch, sourceMapId, newMapId),
    };
  }
  return structuredClone(command);
}
