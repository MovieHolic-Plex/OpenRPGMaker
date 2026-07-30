import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { copyEventCommandToClipboard } from "./commandClipboard";
import type { CommandListActions } from "./types";

type CommandToolbarHistoryOptions = {
  readonly key: string;
  readonly readCommands: () => Command[];
  readonly replaceCommands: (commands: Command[]) => void;
};

type CommandHistory = {
  readonly past: Command[][];
  readonly future: Command[][];
};

export type CommandToolbarHistory = {
  readonly wrapActions: (actions: CommandListActions) => CommandListActions;
  readonly copySelected: (path: readonly number[]) => void;
  readonly cutSelected: (path: readonly number[], actions: CommandListActions) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
};

const HISTORY_LIMIT = 50;
const histories = new Map<string, CommandHistory>();

/** 편집 세션의 페이지 히스토리를 모두 폐기한다. prefix 예: `${mapId}:${eventId}:`. */
export function clearCommandToolbarHistories(prefix: string): void {
  for (const key of histories.keys()) {
    if (key.startsWith(prefix)) histories.delete(key);
  }
}


export function createCommandToolbarHistory(options: CommandToolbarHistoryOptions): CommandToolbarHistory {
  const history = () => historyFor(options.key);
  const recordBeforeChange = () => {
    const entry = history();
    entry.past.push(cloneCommands(options.readCommands()));
    if (entry.past.length > HISTORY_LIMIT) entry.past.shift();
    entry.future.length = 0;
  };
  return {
    wrapActions: (actions) => ({
      addCommand: (containerPath, command) => {
        recordBeforeChange();
        actions.addCommand(containerPath, command);
      },
      insertCommand: (path, command) => {
        recordBeforeChange();
        actions.insertCommand(path, command);
      },
      replaceCommand: (path, command) => {
        recordBeforeChange();
        actions.replaceCommand(path, command);
      },
      deleteCommand: (path) => {
        recordBeforeChange();
        actions.deleteCommand(path);
      },
      moveCommand: (path, dir) => {
        recordBeforeChange();
        actions.moveCommand(path, dir);
      },
      moveCommandTo: (sourcePath, toIndex) => {
        recordBeforeChange();
        actions.moveCommandTo(sourcePath, toIndex);
      },
      ...(actions.moveCommandAcross
        ? {
            moveCommandAcross: (sourcePath: readonly number[], targetContainerPath: readonly number[], toIndex: number) => {
              recordBeforeChange();
              actions.moveCommandAcross!(sourcePath, targetContainerPath, toIndex);
            },
          }
        : {}),
    }),
    copySelected: (path) => {
      const command = resolveCommandAtPath(options.readCommands(), path);
      if (command) copyEventCommandToClipboard(command);
    },
    cutSelected: (path, actions) => {
      const command = resolveCommandAtPath(options.readCommands(), path);
      if (!command) return;
      copyEventCommandToClipboard(command);
      actions.deleteCommand(path);
    },
    undo: () => restorePrevious(options, history()),
    redo: () => restoreNext(options, history()),
    canUndo: () => history().past.length > 0,
    canRedo: () => history().future.length > 0,
  };
}

function restorePrevious(options: CommandToolbarHistoryOptions, history: CommandHistory): void {
  const previous = history.past.pop();
  if (!previous) return;
  history.future.push(cloneCommands(options.readCommands()));
  options.replaceCommands(previous);
}

function restoreNext(options: CommandToolbarHistoryOptions, history: CommandHistory): void {
  const next = history.future.pop();
  if (!next) return;
  history.past.push(cloneCommands(options.readCommands()));
  options.replaceCommands(next);
}

function historyFor(key: string): CommandHistory {
  const existing = histories.get(key);
  if (existing) return existing;
  const created = { past: [], future: [] };
  histories.set(key, created);
  return created;
}

function cloneCommands(commands: Command[]): Command[] {
  return structuredClone(commands);
}
