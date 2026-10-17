// 데스크톱 앱 창 컨트롤 계약 — 메인(검증)·프리로드·렌더러가 같은 이름을 쓴다.
// 설계와 플랫폼별 결정은 openwiki/desktop-window-controls.md.

/** 렌더러가 메인에 요청할 수 있는 창 동작. 메인은 이 목록 밖의 값을 모두 거절한다. */
export const WINDOW_CONTROL_ACTIONS = ["toggle-fullscreen", "minimize", "toggle-maximize", "close"] as const;
export type WindowControlAction = (typeof WINDOW_CONTROL_ACTIONS)[number];

export function isWindowControlAction(value: unknown): value is WindowControlAction {
  return typeof value === "string" && (WINDOW_CONTROL_ACTIONS as readonly string[]).includes(value);
}

/** 창의 네이티브 상태. 최대화·전체화면은 서로 다른 축이다(전체화면이 최대화를 덮는다). */
export type WindowState = {
  readonly fullscreen: boolean;
  readonly maximized: boolean;
};

/** 렌더러가 그릴 창 단추 방식. darwin 은 OS 신호등을 쓰고 DOM 단추를 그리지 않는다. */
export type WindowPlatform = "win32" | "darwin" | "linux";

/**
 * 제목줄을 직접 그리는 창(Windows·Linux)은 frame:false, macOS 는 신호등만 남긴 숨김 제목줄.
 * main.ts 의 BrowserWindow 옵션과 렌더러의 단추 분기가 같은 표를 보도록 한 곳에 둔다.
 */
export function windowChromeFor(platform: string): { readonly platform: WindowPlatform; readonly drawsOwnButtons: boolean } {
  if (platform === "darwin") return { platform: "darwin", drawsOwnButtons: false };
  return { platform: platform === "win32" ? "win32" : "linux", drawsOwnButtons: true };
}
