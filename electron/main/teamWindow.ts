// 다른 컴퓨터의 팀 호스트를 앱 창으로 연다.
//
// 참여하는 쪽도 앱이어야 한다(브라우저 탭이 아니라). 창은 호스트 페이지를 그대로 싣는다 —
// 호스트가 주입하는 /__oprn/bridge.js 가 HTTP 로 같은 저장 채널(window.oprn)을 만든다.
// 원격 페이지이므로 preload(IPC) 를 주지 않는다. 이 창은 이 컴퓨터의 파일·IPC 에 닿지 못한다.

import { BrowserWindow, dialog, session, shell } from "electron";

/** 팀 창 전용 쿠키 저장소. 로그인 쿠키가 앱을 다시 켜도 남는다(호스트 세션은 12시간). */
const TEAM_PARTITION = "persist:oprn-team";
let permissionsLocked = false;

function lockPermissions(): void {
  if (permissionsLocked) return;
  permissionsLocked = true;
  // 원격 페이지에 카메라·알림 같은 권한을 주지 않는다. 편집기는 쓰지 않는다.
  session.fromPartition(TEAM_PARTITION).setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}

export type TeamWindowOptions = {
  readonly icon?: string;
  /** 첫 페이지를 불러왔을 때. */
  readonly onLoaded?: (target: URL) => void;
  /** 첫 페이지를 불러오지 못했을 때(호스트가 꺼졌거나 주소가 틀림). 창은 이미 닫혔다. */
  readonly onLoadFailed?: (target: URL, reason: string) => void;
};

export function openTeamWindow(target: URL, options: TeamWindowOptions = {}): BrowserWindow {
  lockPermissions();
  const origin = target.origin;
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "팀 프로젝트 · " + target.host,
    ...(options.icon ? { icon: options.icon } : {}),
    webPreferences: { partition: TEAM_PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false },
  });
  const sameOrigin = (url: string): boolean => {
    try { return new URL(url).origin === origin; } catch { return false; }
  };
  window.once("ready-to-show", () => window.show());
  // 호스트 밖으로는 이 창이 이동하지 않는다. https 링크는 시스템 브라우저로 넘긴다.
  const guard = (event: { preventDefault(): void }, url: string): void => {
    if (sameOrigin(url)) return;
    event.preventDefault();
    if (url.startsWith("https://")) void shell.openExternal(url);
  };
  window.webContents.on("will-navigate", guard);
  window.webContents.on("will-redirect", guard);
  window.webContents.setWindowOpenHandler(({ url }) => {
    // 편집기의 「팀 관리 ↗」(target=_blank)는 같은 호스트의 새 팀 창으로 연다.
    if (sameOrigin(url)) openTeamWindow(new URL(url), { icon: options.icon });
    else if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  // 편집기는 미저장 변경이 있으면 beforeunload 로 닫기를 막는다. Electron 은 이때 아무것도 묻지 않고
  // 닫기를 취소하므로, 여기서 직접 묻는다.
  window.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: "warning",
      buttons: ["닫기", "취소"],
      defaultId: 1,
      cancelId: 1,
      message: "호스트에 아직 저장하지 못한 변경이 있습니다.",
      detail: "지금 닫으면 이 변경은 사라질 수 있습니다. 그래도 닫을까요?",
    });
    if (choice === 0) event.preventDefault();
  });
  let loaded = false;
  let failed = false;
  window.webContents.on("did-finish-load", () => {
    if (loaded) return;
    loaded = true;
    options.onLoaded?.(target);
  });
  window.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    // -3 은 이동 취소(ERR_ABORTED) — 실패가 아니다.
    if (!isMainFrame || code === -3 || loaded) return;
    failed = true;
    if (!window.isDestroyed()) window.destroy();
    options.onLoadFailed?.(target, description);
  });
  // 불러오는 중에 사용자가 창을 닫으면 시작 화면이 계속 기다리지 않게 한다.
  window.on("closed", () => {
    if (!loaded && !failed) options.onLoadFailed?.(target, "창을 닫았습니다");
  });
  void window.loadURL(target.href);
  return window;
}
