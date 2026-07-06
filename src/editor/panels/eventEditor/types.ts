import type { Command } from "@/project/types";

export type CommandEditContext = {
  readonly path: number[];
  readonly actions: CommandListActions;
  // 기존 명령 편집(모달)에서는 명령 종류 select 를 잠근다. 종류를 바꾸면 fork/choices/shop 의
  // 분기 자식(then/else/branch)이 유실되므로, 종류 변경은 "새 명령" 추가에서만 허용한다.
  readonly lockKind?: boolean;
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
