import type { Command } from "@/project/types";

export type CommandEditContext = {
  readonly path: number[];
  readonly actions: CommandListActions;
  /** 이 명령 앞에서 활성화된 얼굴. 문장 표시의 인라인 게임 미리보기에 사용한다. */
  readonly previewFace?: { readonly resourceId: string; readonly faceIndex: number };
  /**
   * 현재 편집 다이얼로그의 최신 staged 명령을 반환한다.
   * 폼 이벤트 핸들러는 렌더 시점 cmd를 펼치지 말고 이 값을 기준으로 patch해야 한다.
   */
  readonly getCurrentCommand?: () => Command;
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
  /**
   * [P2] 크로스 컨테이너 이동: sourcePath 명령을 targetContainerPath 리스트의 toIndex 로 옮긴다.
   * 옵셔널 — 미구현 호스트는 같은 컨테이너 재정렬만 지원한다.
   */
  readonly moveCommandAcross?: (
    sourcePath: readonly number[],
    targetContainerPath: readonly number[],
    toIndex: number
  ) => void;
};
