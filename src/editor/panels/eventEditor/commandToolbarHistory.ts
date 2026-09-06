import { resolveCommandAtPath, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import type { ProjectChangeAnnotation } from "@/project/store";
import type { Command } from "@/project/types";
import { copyEventCommandsToClipboard } from "./commandClipboard";
import { authoredCommandPaths, clearCommandInspector, isCommandSelected, notifyCommandSelectionChanged, selectedCommandPaths, selectedCommandRoots } from "./commandInspector";
import type { CommandListActions } from "./types";

type CommandToolbarHistoryOptions = {
  readonly key: string;
  readonly readCommands: () => Command[];
  readonly replaceCommands: (commands: Command[], change?: ProjectChangeAnnotation) => void;
};

type CommandHistory = {
  readonly past: Command[][];
  readonly future: Command[][];
  changing: boolean;
};

export type CommandToolbarHistory = {
  readonly wrapActions: (actions: CommandListActions) => CommandListActions;
  readonly copySelected: (path: readonly number[]) => void;
  readonly cutSelected: (path: readonly number[], actions: CommandListActions) => void;
  /**
   * 목록 전체를 **되돌리기 한 칸으로** 교체한다. AI 초안 적용처럼 여러 곳이 한꺼번에 바뀌는
   * 편집용. 예전 AI 삽입은 명령 개수만큼 insertCommand 를 불러 스냅샷이 그만큼 쌓였고,
   * "되돌리려면 ↶" 안내와 달리 8개를 넣으면 ↶ 를 8번 눌러야 했다.
   */
  readonly replaceAll: (commands: readonly Command[], change?: ProjectChangeAnnotation) => void;
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
  historyFor(options.key);
  const history = () => historyFor(options.key);
  const change = (run: () => void, structural = true) =>
    recordCommandToolbarChange(options.key, options.readCommands, run, structural);
  const pathsFor = (path: readonly number[]) => selectedCommandRoots(
    isCommandSelected(path) ? selectedCommandPaths() : [path]);
  const copy = (path: readonly number[]) => {
    const commands = options.readCommands();
    copyEventCommandsToClipboard(pathsFor(path).flatMap(selected => {
      const command = resolveCommandAtPath(commands, selected);
      return command ? [command] : [];
    }));
  };
  return {
    wrapActions: (actions) => ({
      undo: () => restorePrevious(options, history()),
      redo: () => restoreNext(options, history()),
      deleteCommands: (paths) => change(() => {
        const next = cloneCommands(options.readCommands());
        for (const path of selectedCommandRoots(paths).reverse()) {
          const list = resolveCommandListAtPath(next, path.slice(0, -1));
          const index = path.at(-1);
          if (list && index !== undefined) list.splice(index, 1);
        }
        options.replaceCommands(next);
      }),
      insertCommands: (path, commands) => change(() => {
        const next = cloneCommands(options.readCommands());
        const list = resolveCommandListAtPath(next, path.slice(0, -1));
        const index = path.at(-1);
        if (!list || index === undefined) return;
        list.splice(index, 0, ...structuredClone([...commands]));
        options.replaceCommands(next);
      }),
      addCommand: (containerPath, command) => {
        change(() => actions.addCommand(containerPath, command));
      },
      insertCommand: (path, command) => {
        change(() => actions.insertCommand(path, command));
      },
      replaceCommand: (path, command) => {
        change(() => actions.replaceCommand(path, command), false);
      },
      deleteCommand: (path) => {
        change(() => actions.deleteCommand(path));
      },
      moveCommand: (path, dir) => {
        change(() => actions.moveCommand(path, dir));
      },
      moveCommandTo: (sourcePath, toIndex) => {
        change(() => actions.moveCommandTo(sourcePath, toIndex));
      },
      ...(actions.moveCommandAcross
        ? {
            moveCommandAcross: (sourcePath: readonly number[], targetContainerPath: readonly number[], toIndex: number) => {
              change(() => actions.moveCommandAcross?.(sourcePath, targetContainerPath, toIndex));
            },
          }
        : {}),
    }),
    copySelected: copy,
    cutSelected: (path, actions) => {
      const paths = pathsFor(path);
      copy(path);
      if (actions.deleteCommands) actions.deleteCommands(paths);
      else change(() => paths.reverse().forEach(selected => actions.deleteCommand(selected)));
    },
    replaceAll: (commands, annotation) => {
      change(() => options.replaceCommands(structuredClone([...commands]), annotation));
    },
    undo: () => restorePrevious(options, history()),
    redo: () => restoreNext(options, history()),
    canUndo: () => history().past.length > 0,
    canRedo: () => history().future.length > 0,
  };
}

/** Legacy page catalog callers join an existing editor session, never create map history. */
export function recordCommandToolbarChange(
  key: string, readCommands: () => Command[], run: () => void, structural = true,
): void {
  const entry = histories.get(key);
  if (!entry || entry.changing) { run(); return; }
  const before = cloneCommands(readCommands());
  const past = [...entry.past];
  const future = [...entry.future];
  // Publish before the synchronous store render so its toolbar sees the new history.
  entry.changing = true;
  entry.past.push(before);
  entry.future.length = 0;
  try {
    run();
  } finally {
    entry.changing = false;
    if (JSON.stringify(before) === JSON.stringify(readCommands())) {
      entry.past.splice(0, entry.past.length, ...past);
      entry.future.push(...future);
    } else {
      if (entry.past.length > HISTORY_LIMIT) entry.past.shift();
      if (structural || JSON.stringify(authoredCommandPaths(before)) !== JSON.stringify(authoredCommandPaths(readCommands()))) clearCommandInspector();
    }
    notifyCommandSelectionChanged();
  }
}

function restorePrevious(options: CommandToolbarHistoryOptions, history: CommandHistory): void {
  const previous = history.past.pop();
  if (!previous) return;
  clearCommandInspector();
  history.future.push(cloneCommands(options.readCommands()));
  options.replaceCommands(previous);
}

function restoreNext(options: CommandToolbarHistoryOptions, history: CommandHistory): void {
  const next = history.future.pop();
  if (!next) return;
  clearCommandInspector();
  history.past.push(cloneCommands(options.readCommands()));
  options.replaceCommands(next);
}

function historyFor(key: string): CommandHistory {
  const existing = histories.get(key);
  if (existing) return existing;
  const created: CommandHistory = { past: [], future: [], changing: false };
  histories.set(key, created);
  return created;
}

function cloneCommands(commands: Command[]): Command[] {
  return structuredClone(commands);
}
