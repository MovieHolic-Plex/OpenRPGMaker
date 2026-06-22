import type { Command } from "@/project/types";

export type CommandEditContext = {
  readonly path: number[];
  readonly actions: CommandListActions;
};

export type CommandListActions = {
  readonly addCommand: (containerPath: readonly number[], command: Command) => void;
  readonly replaceCommand: (path: readonly number[], command: Command) => void;
  readonly deleteCommand: (path: readonly number[]) => void;
  readonly moveCommand: (path: readonly number[], dir: -1 | 1) => void;
};
