import type { Command } from "@/project/types";

export type CommandEditContext = {
  readonly path: number[];
  readonly actions: CommandListActions;
};

export type CommandListActions = {
  readonly addCommand: (containerPath: readonly number[], command: Command) => void;
  readonly insertCommand: (path: readonly number[], command: Command) => void;
  readonly replaceCommand: (path: readonly number[], command: Command) => void;
  readonly deleteCommand: (path: readonly number[]) => void;
  readonly moveCommand: (path: readonly number[], dir: -1 | 1) => void;
  /** 같은 컨테이너 안에서 sourcePath 명령을 toIndex 위치로 옮긴다(드래그 재정렬용 단일 호출). */
  readonly moveCommandTo: (sourcePath: readonly number[], toIndex: number) => void;
};
