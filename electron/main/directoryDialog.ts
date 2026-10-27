// 폴더 선택 대화상자.
//
// 앱 창은 프레임이 없고 보일 때 전체화면이다. 부모 창 없이 연 대화상자는 모달이 아니라서
// 전체화면 창 뒤로 갈 수 있다. 시작 화면은 대화상자가 끝날 때까지 바빠 보이므로, 뒤에 숨으면
// 앱이 멈춘 것처럼 보인다. 파일 메뉴도 같은 규칙을 쓴다 — 스플래시·팀 창이 아니라 편집기 창에 붙인다.

export type DirectoryDialogChoice = {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
};

export type DirectoryDialogOwner = {
  isDestroyed(): boolean;
};

/** macOS 의 createDirectory 는 기존 메뉴와 같다. Linux·Windows 는 그 속성을 무시한다. */
export function directoryDialogProperties(createDirectory: boolean): Array<"openDirectory" | "createDirectory"> {
  return createDirectory ? ["openDirectory", "createDirectory"] : ["openDirectory"];
}

/** 살아 있는 창만 부모로 넘긴다. 파괴된 창을 넘기면 Electron 이 던지고, 없으면 부모 없는 대화상자다. */
export function directoryDialogParent<T extends DirectoryDialogOwner>(owner: T | null | undefined): T | undefined {
  if (!owner || owner.isDestroyed()) return undefined;
  return owner;
}

/** 취소·빈 경로는 폴더를 고르지 않은 것이다. 첫 경로만 쓴다. */
export function chosenDirectory(result: DirectoryDialogChoice): string | null {
  if (result.canceled) return null;
  const path = result.filePaths[0];
  return typeof path === "string" && path.length > 0 ? path : null;
}

/**
 * 파일 메뉴가 건드릴 창. 포커스가 스플래시·팀 창·개발자 도구면 그 창에 폴더를 열지 않는다.
 * 마지막으로 포커스됐던 앱 창, 그것도 없으면 아직 살아있는 앱 창을 쓴다.
 */
export function pickAppWindow<T>(input: {
  readonly focused: T | null;
  readonly lastFocused: T | null;
  readonly windows: readonly T[];
  readonly isAppWindow: (window: T) => boolean;
  readonly isDestroyed: (window: T) => boolean;
}): T | null {
  const usable = (window: T | null): window is T => window !== null && input.isAppWindow(window) && !input.isDestroyed(window);
  if (usable(input.focused)) return input.focused;
  if (usable(input.lastFocused)) return input.lastFocused;
  for (const window of input.windows) {
    if (input.isAppWindow(window) && !input.isDestroyed(window)) return window;
  }
  return null;
}
