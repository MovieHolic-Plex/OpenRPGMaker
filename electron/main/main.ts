import { mainMark } from "./startupTiming";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { startLocalProjectServer, type LocalProjectServer } from "../serve/runtime";
import { normalizeTeamUrl } from "../serve/localNetwork";
import { join, resolve } from "node:path";
import { BrowserWindow, Menu, app, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { OPRN_APP_SCHEME, OPRN_CHANNELS } from "../shared/channels";
import { isWindowControlAction, windowChromeFor, type WindowState } from "../shared/windowControl";
import { registerIpcHandlers } from "./ipc";
import { registerAssetBrowser } from "./assetBrowser";
import { acceptStoreDeepLink, registerAssetStore } from "./assetStore";
import { findStoreDeepLinkArg } from "../../src/assetStore/deepLink";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { createProjectSessionRegistry } from "./sessions";
import { startCompanionServer, type CompanionServer } from "./companion";
import { describeRecentProjects, listRecentTeams, prepareNewProjectDir, recentProjectCoverSource, rememberRecentProject, rememberRecentTeam, suggestProjectDir, writeRecentProjectCover } from "./recent";
import { openTeamWindow } from "./teamWindow";
import type { Splash } from "./splash";
import { bootsToStartScreen, rendererDirectory, windowIconPath, type BootContext } from "./bootContext";
import type { JoinTeamResult } from "../shared/start";
import { TEAM_COLLAB_ENABLED } from "../shared/teamCollab";

// 앱 본체(dist-electron/app.cjs). 시작 입구 boot.ts(dist-electron/main.cjs)가 app ready 뒤 스플래시를 띄우고 이 파일을 읽어
// startApp 을 부른다. ready 전에 해야 하는 일(스킴 권한·한 번만 실행·링크 받아 두기)은 입구에 있다.

// ── 「에디터에서 열기」 링크(oprn://store/install?…) ─────────────────────────────
// 판정은 src/assetStore/deepLink.ts(순수), 받은 뒤 처리는 assetStore.ts 의 acceptStoreDeepLink. openwiki/asset-store.md.
const DEEP_LINK_SCHEME = "oprn";

/** OS 에 oprn: 처리기로 등록한다. 개발 실행은 OPRN_REGISTER_PROTOCOL=1 일 때만(개발 빌드가 사용자 등록을 빼앗지 않게). */
function registerDeepLinkProtocol(): void {
  try {
    if (!process.defaultApp) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    else if (process.env.OPRN_REGISTER_PROTOCOL === "1" && process.argv[1]) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [resolve(process.argv[1])]);
    }
  } catch (error) {
    console.warn("[store-link] oprn: 링크 처리기를 등록하지 못했습니다:", error);
  }
}

mainMark("modulesEvaluated");
const sessions = createProjectSessionRegistry();
const hosting = new Set<string>();
const teamHosts = new Map<string, LocalProjectServer>();
let companionServer: CompanionServer | null = null;
const rendererDir = rendererDirectory();
const windowIcon = windowIconPath(rendererDir);
/** 팀 호스트 포트. 앱을 다시 켜도 팀원이 받은 주소가 그대로 맞도록 고정 범위에서 먼저 찾는다. */
/** @deprecated multi-user team collaboration is not supported yet (2026-10-21). 「팀 협업 시작」이 LAN 에 여는 포트. */
const TEAM_HOST_PORTS = [9840, 9841, 9842, 9843, 9844, 9845, 9846, 9847, 9848, 9849];

const closing = new Set<number>();
const closeTimers = new Map<number, ReturnType<typeof setTimeout>>();

function destroyWindow(window: BrowserWindow): void {
  const id = window.webContents.id;
  const timer = closeTimers.get(id);
  if (timer) clearTimeout(timer);
  closeTimers.delete(id);
  if (!window.isDestroyed()) window.destroy();
}

/**
 * 닫기 저장을 기다리는 상한. 큰 프로젝트를 새 빌드로 처음 연 직후의 자동 저장(부팅 정규화 결과 + 표식)은 렌더러 준비만 10초를 넘는다
 * (2026-10-20 실측, 71MB: 정착 뒤 저장 완료까지 16초). 예전 상한 10초는 그 저장을 끊어 버려 — 다음 실행이 또 «첫 부팅»(+10~15초)이
 * 되고 저장 중이던 변경도 잃었다. 창은 닫는 즉시 숨기므로 사용자는 기다리지 않는다.
 */
const CLOSE_FLUSH_TIMEOUT_MS = 60_000;

// 닫기는 flush → ack → destroy 다(설계서 7.3). 렌더러가 상한 안에 flush-done 을 부르지 않으면 강제로 닫는다.
function installCloseFlow(window: BrowserWindow): void {
  const id = window.webContents.id;
  window.on("close", (event) => {
    if (closing.has(id)) return;
    if (!sessions.get(id)) return;
    event.preventDefault();
    closing.add(id);
    // 저장이 끝날 때까지 창을 잡아 두되 화면에서는 바로 치운다 — 닫기 단추가 «바로» 먹는다.
    window.hide();
    window.webContents.send(OPRN_CHANNELS.lifecycleFlushBeforeClose);
    closeTimers.set(id, setTimeout(() => destroyWindow(window), CLOSE_FLUSH_TIMEOUT_MS));
  });
  window.on("closed", () => {
    closing.delete(id);
    const timer = closeTimers.get(id);
    if (timer) clearTimeout(timer);
    closeTimers.delete(id);
    sessions.close(id);
  });
}

/** 창의 네이티브 상태. 전체화면이 최대화를 덮으므로 둘은 따로 보낸다. */
function windowStateOf(window: BrowserWindow): WindowState {
  return { fullscreen: window.isFullScreen(), maximized: window.isMaximized() };
}

/**
 * 제목줄 방식. Windows·Linux 는 OS 제목줄을 빼고 렌더러가 최소화·최대화·전체화면·닫기 단추를 그린다
 * (전체화면 전환까지 한 줄에 두려면 titleBarOverlay 로는 안 된다 — openwiki/desktop-window-controls.md).
 * macOS 는 신호등을 왼쪽 위에 남기고 제목줄만 숨긴다(오른쪽에 단추를 또 그리지 않는다).
 */
const chrome = windowChromeFor(process.platform);
const chromeOptions: Electron.BrowserWindowConstructorOptions = chrome.drawsOwnButtons
  ? { frame: false }
  : { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 16 } };

/** 시작 화면 창이 첫 카드를 그렸다고 알리면 부를 것(webContents id → 보이기). */
const revealOnStartReady = new Map<number, () => void>();
/** 시작 화면이 신호를 못 보내도(옛 렌더러·오류) 첫 페인트 뒤 이만큼 지나면 창을 보인다. */
const START_READY_FALLBACK_MS = 6_000;

function isStartScreenBoot(window: BrowserWindow): boolean {
  return process.env.OPRN_SMOKE_PAGE === undefined && process.env.OPRN_OPEN_PROJECT_DIR === undefined && sessions.get(window.webContents.id) === null;
}

/**
 * 창을 만든다. 처음 뜨는 창은 스플래시(splash.ts)와 짝을 이룬다 — 숨긴 채 준비하고, 시작 화면이 첫 카드를 그렸다고 알리면
 * 보이며 스플래시를 닫는다. 그 전에 문서를 못 불러오면 스플래시가 오류를 보인다. 스플래시가 없는 창(두 번째 창·QA 진입점)은
 * 예전처럼 첫 페인트(ready-to-show)에 보인다. deferLoad 면 문서는 loadWindowContent 로 따로 싣는다(앱 시작 때 창 객체만 먼저 만든다).
 */
function createWindow(options: { readonly splash?: () => Splash | undefined; readonly deferLoad?: boolean } = {}): BrowserWindow {
  const splash = (): Splash | undefined => options.splash?.();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 600,
    show: false,
    // 창 크기가 바뀌는 순간에 다른 색이 비치지 않게 문서 바탕색과 맞춘다 — 시작 화면은 어두운 #111214(startScreen.css),
    // 편집기는 tokens.css --bg-base.
    backgroundColor: bootsToStartScreen() ? "#111214" : "#F7F8F8",
    // 전체화면은 보일 때 켠다 — 리눅스는 생성자에서 fullscreen 을 주면 show:false 여도 창을 바로 띄워(빈 화면이 스플래시를 덮었다).
    fullscreen: false,
    autoHideMenuBar: true,
    ...chromeOptions,
    // 리눅스·윈도우 창 제목줄과 작업표시줄 아이콘. 맥은 앱 번들 icns 를 쓰므로 주지 않는다.
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // AI checkpoint application and replies must continue while minimized.
      backgroundThrottling: false,
    },
  });
  const id = window.webContents.id;

  let shown = false;
  /** 스플래시에 오류를 띄웠다 — 「다시 시도」 전에는 대체 타이머가 빈 창을 보이지 않는다. */
  let failed = false;
  const reveal = (reason: string): void => {
    if (shown || failed || window.isDestroyed()) return;
    shown = true;
    revealOnStartReady.delete(id);
    // 맥은 숨은 창에 전체화면을 걸면 무시될 수 있어 보인 뒤에 건다. 그 밖은 전체화면을 건 뒤 보여 크기 튐이 없다.
    if (process.platform === "darwin") { window.show(); window.setFullScreen(true); }
    else { window.setFullScreen(true); window.show(); }
    mainMark("windowShown");
    if (process.env.OPRN_STARTUP_TRACE === "1") process.stderr.write(`[startup] window shown (${reason})\n`);
    splash()?.close();
  };
  const fail = (detail: string): void => {
    const current = splash();
    if (shown || !current?.open()) return;
    failed = true;
    current.fail(detail);
  };
  // ready-to-show 는 렌더러가 첫 프레임을 그린 뒤에 온다(창마다 한 번). 스플래시가 있으면 시작 화면이 카드를 그릴 때까지 더 기다린다.
  window.once("ready-to-show", () => {
    mainMark("firstPaint");
    if (!splash()?.open()) reveal("first-paint");
  });
  if (options.splash) {
    revealOnStartReady.set(id, () => reveal("start-screen-ready"));
    // 「다시 시도」로 다시 싣는 경우까지 — 문서를 다 받은 뒤 신호가 끝내 안 오면(옛 렌더러·시작 화면 오류) 그래도 창을 보인다.
    window.webContents.on("did-finish-load", () => {
      setTimeout(() => reveal("fallback-timeout"), START_READY_FALLBACK_MS);
    });
    // 아직 숨어 있을 때 문서를 못 불러오거나 렌더러가 죽으면 빈 화면 대신 스플래시에 오류를 보인다.
    window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3 = 다른 이동으로 취소됨(정상)
      fail(`${description || "load failed"} (${code})\n${url}`);
    });
    // app:// 이 문서를 못 찾으면(빌드 누락·손상) did-fail-load 없이 오류 응답을 그린다 — 응답 코드로 잡는다.
    window.webContents.on("did-navigate", (_event, url, httpResponseCode, httpStatusText) => {
      if (httpResponseCode >= 400) fail(`${httpResponseCode} ${httpStatusText}\n${url}`);
    });
    window.webContents.on("render-process-gone", (_event, details) => fail(`renderer ${details.reason} (exit ${details.exitCode})`));
    window.webContents.on("preload-error", (_event, _path, error) => fail(`preload: ${error.message}`));
    window.webContents.on("did-start-loading", () => { failed = false; });
  }
  // F11·보기 메뉴 등 버튼 밖에서도 전체화면이 바뀐다 — 렌더러가 아이콘 상태를 맞출 수 있게 알린다.
  const broadcastFullscreen = (fullscreen: boolean): void => {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.windowFullscreen, fullscreen);
  };
  const broadcastState = (): void => {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.windowState, windowStateOf(window));
  };
  window.on("enter-full-screen", () => { broadcastFullscreen(true); broadcastState(); });
  window.on("leave-full-screen", () => { broadcastFullscreen(false); broadcastState(); });
  // 최대화·복원은 단추 밖(제목줄 더블클릭·키보드 단축키·창 관리자)에서도 일어난다.
  window.on("maximize", broadcastState);
  window.on("unmaximize", broadcastState);
  window.on("restore", broadcastState);
  window.on("minimize", broadcastState);
  window.on("closed", () => revealOnStartReady.delete(id));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${OPRN_APP_SCHEME}://`)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  installCloseFlow(window);
  if (!options.deferLoad) loadWindowContent(window);
  return window;
}

/** 창에 첫 문서를 싣는다 — 시작 화면, QA 진입점(OPRN_SMOKE_PAGE·OPRN_OPEN_PROJECT_DIR), 또는 편집기. */
function loadWindowContent(window: BrowserWindow): void {
  // QA 하니스용 진입점(OPRN_SMOKE_PAGE·OPRN_RENDERER_DIR 와 같은 계열): 폴더를 주면 시작 화면을
  // 건너뛰고 그 폴더를 연 채로 편집기를 띄운다. GUI 폴더 선택 대화상자를 자동화할 수 없어서
  // "앱이 폴더를 열고 편집기로 들어간다" 를 헤드리스에서 확인할 유일한 길이다.
  const bootProjectDir = process.env.OPRN_OPEN_PROJECT_DIR;
  const startScreen = isStartScreenBoot(window);
  const smokePage = process.env.OPRN_SMOKE_PAGE;
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (smokePage) void window.loadFile(smokePage);
  else if (startScreen) void window.loadURL(`${OPRN_APP_SCHEME}://oprn/start-screen.html`);
  else if (devServerUrl) void window.loadURL(devServerUrl);
  else void window.loadURL(`${OPRN_APP_SCHEME}://oprn/index.html`);
  if (bootProjectDir !== undefined) {
    void sessions.open(window.webContents.id, bootProjectDir).then(() => {
      if (window.isDestroyed()) return;
      if (devServerUrl) void window.loadURL(devServerUrl);
      else void window.loadURL(`${OPRN_APP_SCHEME}://oprn/index.html`);
    });
  }
}

/** 렌더러 문서 주소. 개발 중에는 dev 서버, 배포는 app:// 다. */
function rendererEntryUrl(): string {
  return process.env.ELECTRON_RENDERER_URL ?? `${OPRN_APP_SCHEME}://oprn/index.html`;
}

/** 폴더를 이 창의 세션으로 열고 편집기 문서로 넘긴다. 파일 메뉴가 쓰는 경로. */
async function adoptFolder(window: BrowserWindow, projectDir: string, title?: string): Promise<void> {
  const session = await sessions.open(window.webContents.id, projectDir);
  rememberRecentProject(projectDir, title ?? session.store.info().title ?? projectDir);
  if (!window.isDestroyed()) void window.loadURL(rendererEntryUrl());
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * 참여하는 쪽: 다른 컴퓨터의 팀 호스트를 앱 창으로 연다. 창이 첫 페이지를 불러오면 끝난다. */
function joinTeam(input: string): Promise<JoinTeamResult> {
  let target: URL;
  try { target = normalizeTeamUrl(input); }
  catch (error) { return Promise.resolve({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  return new Promise((resolvePromise) => {
    openTeamWindow(target, {
      icon: windowIcon,
      onLoaded: (loaded) => { rememberRecentTeam(loaded); resolvePromise({ ok: true, url: loaded.origin }); },
      onLoadFailed: (_failed, reason) => resolvePromise({ ok: false, error: `${target.host} 에 연결하지 못했습니다 (${reason}). 호스트 컴퓨터에서 팀 협업이 켜져 있는지, 같은 네트워크인지 확인해 주세요.` }),
    });
  });
}

async function startTeamHost(projectDir: string): Promise<LocalProjectServer> {
  const browserBridgeSource = await readFile(join(app.getAppPath(), 'dist-electron/browser-bridge.js'), 'utf8');
  let lastError: unknown = null;
  for (const port of [...TEAM_HOST_PORTS, 0]) {
    try {
      return await startLocalProjectServer({ projectDir, distDir: rendererDir, browserBridgeSource, sessions,
        host: '0.0.0.0', port, localNetwork: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** 팀원을 초대하려면 이 주소를 알려 준다. LAN 주소가 여러 개면 모두 보여 준다(어느 것이 맞는지는 네트워크마다 다르다). */
function teamHostDetail(host: LocalProjectServer, accessCodeRequired: boolean): string {
  const [first, ...others] = host.urls;
  return [
    `팀원은 앱 시작 화면의 「팀에 참여」에 이 주소를 넣으면 됩니다:\n${first}`,
    others.length > 0 ? `연결되지 않으면 다른 주소를 써 보세요:\n${others.join('\n')}` : '',
    accessCodeRequired
      ? '접속 코드가 켜져 있습니다. 소유자 접속 코드를 클립보드에 복사했습니다. 팀원은 팀 관리에서 만든 초대 링크를 쓰세요.'
      : '주소를 클립보드에 복사했습니다. 코드 없이 바로 참여할 수 있습니다. 접속 코드는 팀 관리의 접속 설정에서 켤 수 있습니다.',
    '같은 네트워크에서만 참여할 수 있으며, 이 앱을 종료하면 팀 호스트도 종료됩니다. 연결되지 않으면 이 컴퓨터의 방화벽이 앱을 막고 있는지 확인해 주세요.',
  ].filter(Boolean).join('\n\n');
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * The app owns the local host lifecycle; users do not install or start a DB/server. */
async function hostCurrentTeam(): Promise<void> {
  const window = focusedWindow();
  if (!window) return;
  const session = sessions.get(window.webContents.id);
  if (!session) { await dialog.showMessageBox(window, { message: '프로젝트를 먼저 열어 주세요.' }); return; }
  if (hosting.has(session.projectDir)) return;
  hosting.add(session.projectDir);
  try {
    let host = teamHosts.get(session.projectDir);
    if (!host) {
      host = await startTeamHost(session.projectDir);
      if (!host.urls.some((url) => !url.includes('127.0.0.1'))) {
        await host.close();
        throw new Error('연결된 로컬 네트워크를 찾을 수 없습니다. Wi-Fi 나 유선 네트워크에 연결한 뒤 다시 시도해 주세요.');
      }
      teamHosts.set(session.projectDir, host);
    }
    const accessCodeRequired = session.team.accessCodeRequired();
    clipboard.writeText(accessCodeRequired ? host.ownerAccessCode! : host.url);
    const { response } = await dialog.showMessageBox(window, { message: '팀 호스트가 실행 중입니다.',
      detail: teamHostDetail(host, accessCodeRequired), buttons: ['확인', '팀 관리 열기'], defaultId: 0, cancelId: 0 });
    // 팀 관리(초대·권한·접속 코드)는 호스트 페이지다. 브라우저 대신 앱 창으로 연다.
    // LAN 주소로 연다. 팀 관리가 만드는 초대 링크는 이 창의 주소(location.origin)를 쓴다.
    if (response === 1) openTeamWindow(new URL('/__oprn/team', host.url), { icon: windowIcon });
  } catch (error) { await dialog.showMessageBox(window, { type: 'error', message: '팀 호스트를 시작하지 못했습니다.', detail: error instanceof Error ? error.message : String(error) }); }
  finally { hosting.delete(session.projectDir); }
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * 파일 메뉴 → 팀에 참여. 주소 입력은 시작 화면이 맡는다. 새 창은 프로젝트가 없으니 시작 화면으로 열린다. */
function showJoinFromMenu(): void {
  const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('start-screen.html'));
  if (window) { window.show(); window.focus(); return; }
  createWindow();
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    {
      label: "파일",
      submenu: [
        // @deprecated multi-user team collaboration is not supported yet (2026-10-21).
        // TEAM_COLLAB_ENABLED(electron/shared/teamCollab.ts) 를 켜면 세 항목이 돌아온다.
        ...(TEAM_COLLAB_ENABLED ? [
          { label: "팀 협업 시작 / 관리", click: () => { void hostCurrentTeam(); } },
          { label: "팀에 참여…", click: () => { showJoinFromMenu(); } },
          { label: "팀 호스트 중지", click: async () => {
            const window = focusedWindow();
            const projectDir = window ? sessions.get(window.webContents.id)?.projectDir : undefined;
            if (!projectDir) return;
            await teamHosts.get(projectDir)?.close(); teamHosts.delete(projectDir);
          } },
          { type: "separator" as const },
        ] : []),
        {
          label: "새 프로젝트",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            const window = focusedWindow();
            if (!window) return;
            void dialog.showOpenDialog(window, { properties: ["openDirectory", "createDirectory"], title: "새 프로젝트 폴더 선택" })
              .then((result) => (result.canceled || result.filePaths.length === 0 ? null : adoptFolder(window, result.filePaths[0], "새 프로젝트")));
          },
        },
        {
          id: "file-open-folder",
          label: "폴더 열기",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            const window = focusedWindow();
            if (!window) return;
            // 메뉴 경로는 폴더에 project.sqlite 가 없어도 연다 — initLocalProjectStore 가 만든다.
            void dialog.showOpenDialog(window, { properties: ["openDirectory"], title: "프로젝트 폴더 열기" })
              .then((result) => (result.canceled || result.filePaths.length === 0 ? null : adoptFolder(window, result.filePaths[0])));
          },
        },
        { type: "separator" },
        {
          id: "file-save",
          label: "저장",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            // 저장은 렌더러 store 가 소유한다(디바운스·권한·영수증). 메인이 할 일은 "지금 저장하라" 를
            // 알리는 것뿐이다 — 여기서 직접 쓰면 렌더러의 미저장 변경을 건너뛰고 옛 상태를 저장한다.
            focusedWindow()?.webContents.send(OPRN_CHANNELS.lifecycleSave);
          },
        },
        {
          label: "백업 만들기",
          click: () => {
            const window = focusedWindow();
            const session = window ? sessions.get(window.webContents.id) : null;
            if (!window || !session) return;
            try {
              const path = session.store.backup();
              void dialog.showMessageBox(window, { type: "info", message: "백업을 만들었습니다", detail: path });
            } catch (error) {
              void dialog.showMessageBox(window, { type: "error", message: "백업에 실패했습니다", detail: String(error) });
            }
          },
        },
        { type: "separator" },
        {
          label: "프로젝트 폴더 보기",
          click: () => {
            const window = focusedWindow();
            const session = window ? sessions.get(window.webContents.id) : null;
            if (session) void shell.openPath(session.projectDir);
          },
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

/** 입구(boot.ts)가 스플래시를 띄운 뒤 부른다. */
export async function startApp(boot: BootContext): Promise<void> {
  // 큰 창 객체(숨김)를 먼저 만들고 문서는 프로토콜·동반 서비스가 준비된 뒤 싣는다(아래 loadWindowContent).
  const { splash } = boot;
  mainMark("createWindow");
  const firstWindow = createWindow({ splash: () => splash, deferLoad: true });
  mainMark("windowCreated");
  boot.setRetry(() => { if (!firstWindow.isDestroyed()) loadWindowContent(firstWindow); });
  const workerBinName = process.platform === "win32" ? "oh-my-pi-worker.exe" : "oh-my-pi-worker";
  const workerBin = [
    process.env.OPRN_OH_MY_PI_WORKER_BIN,
    join(process.resourcesPath ?? "", "app.asar.unpacked", "dist-electron", workerBinName),
    join(app.getAppPath(), "dist-electron", workerBinName),
  ].find((candidate) => candidate && existsSync(candidate));
  if (workerBin) process.env.OPRN_OH_MY_PI_WORKER_BIN = workerBin;
  const workerScript = [
    process.env.OPRN_OH_MY_PI_WORKER_SCRIPT,
    join(process.resourcesPath ?? "", "app.asar.unpacked", "scripts", "oh-my-pi-worker.ts"),
    join(app.getAppPath(), "scripts", "oh-my-pi-worker.ts"),
  ].find((candidate) => candidate && existsSync(candidate));
  if (!workerBin && workerScript) process.env.OPRN_OH_MY_PI_WORKER_SCRIPT = workerScript;
  // 조수 워커(컴파일된 실행 파일)는 자기 위치로 public/ 을 찾지 못한다 — 번들 참고 그림을 읽을 렌더러 폴더를 물려준다.
  process.env.OPRN_RENDERER_DIR ??= rendererDir;
  companionServer = await startCompanionServer();
  mainMark("companionReady");
  ipcMain.on(OPRN_CHANNELS.companionOrigin, (event) => {
    event.returnValue = companionServer?.origin ?? null;
  });
  ipcMain.on(OPRN_CHANNELS.companionToken, (event) => {
    event.returnValue = companionServer?.token ?? null;
  });
  buildMenu();
  registerAppProtocol(rendererDir, () => sessions.firstProjectDir() ?? process.cwd(), () => companionServer?.origin ?? null);
  registerAssetProtocol(sessions);
  // 렌더러는 이 동기 블록이 끝나기 전에는 IPC 를 보낼 수 없다 — 문서를 먼저 걸고 아래 처리기를 같은 틱에 붙인다(약 50ms 앞당김).
  if (!firstWindow.isDestroyed()) loadWindowContent(firstWindow);
  mainMark("windowLoading");
  ipcMain.handle(OPRN_CHANNELS.lifecycleFlushDone, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) destroyWindow(window);
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.windowControl, (event, action: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    if (!isWindowControlAction(action)) return false;
    if (action === "toggle-fullscreen") { window.setFullScreen(!window.isFullScreen()); return true; }
    if (action === "minimize") { window.minimize(); return true; }
    if (action === "toggle-maximize") {
      // 전체화면에서 「복원」 은 전체화면만 벗어난다(그 전 창 크기·최대화 상태로 돌아간다).
      if (window.isFullScreen()) window.setFullScreen(false);
      else if (window.isMaximized()) window.unmaximize();
      else window.maximize();
      return true;
    }
    // 닫기는 installCloseFlow 를 거친다 — 미저장 flush·확인을 우회하지 않는다.
    window.close();
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.windowState, (event): WindowState => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return { fullscreen: false, maximized: false };
    return windowStateOf(window);
  });
  // 창의 진짜 전체화면 상태는 네이티브 쪽에만 있다 — 브라우저 Fullscreen API 는 이 창과 무관하다.
  ipcMain.handle(OPRN_CHANNELS.windowFullscreen, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    return window.isFullScreen();
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentProjects, () => {
    mainMark("recentProjectsAsked");
    const entries = describeRecentProjects();
    mainMark("recentProjectsAnswered");
    return entries;
  });
  ipcMain.handle(OPRN_CHANNELS.startCoverSource, (_event: IpcMainInvokeEvent, payload: unknown) =>
    recentProjectCoverSource((payload as { readonly projectDir?: unknown } | null)?.projectDir));
  ipcMain.handle(OPRN_CHANNELS.startSaveCover, (_event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly projectDir?: unknown; readonly dataUrl?: unknown } | null;
    return writeRecentProjectCover(input?.projectDir, input?.dataUrl);
  });
  ipcMain.handle(OPRN_CHANNELS.startSuggestProjectDir, (_event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly title?: unknown; readonly root?: unknown } | null;
    const title = typeof input?.title === "string" ? input.title : undefined;
    return typeof input?.root === "string" && input.root ? suggestProjectDir(title, input.root) : suggestProjectDir(title);
  });
  ipcMain.handle(OPRN_CHANNELS.startChooseProjectRoot, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">, title: "새 게임을 만들 위치 선택" };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
  ipcMain.handle(OPRN_CHANNELS.startOpenFolder, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const requested = (payload as { readonly projectDir?: unknown } | null)?.projectDir;
    if (typeof requested === "string") {
      if (!requested || !sessions.directoryExists(requested)) throw new Error("열 프로젝트 폴더를 찾지 못했습니다.");
      const session = await sessions.open(event.sender.id, requested);
      rememberRecentProject(session.projectDir, session.store.info().title ?? requested);
      return { projectDir: session.projectDir, isNew: false, projectId: session.store.projectId };
    }
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "프로젝트 폴더 열기" });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = result.filePaths[0];
    // project.sqlite 가 없는 폴더도 그냥 연다 — 스토어가 만들어지고 렌더러의 store.load()
    // 가 빈 프로젝트를 심는다. isNew 는 시작 화면이 “새 프로젝트로 채택” 토스트를 띄우는 용도다.
    const isNew = !sessions.directoryExists(dir);
    const session = await sessions.open(event.sender.id, dir);
    rememberRecentProject(dir, session.store.info().title ?? dir);
    return { projectDir: dir, isNew, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startOpenRecent, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly projectDir?: unknown };
    const dir = typeof input?.projectDir === "string" ? input.projectDir : "";
    if (!dir || !sessions.directoryExists(dir)) return null;
    const session = await sessions.open(event.sender.id, dir);
    rememberRecentProject(dir, session.store.info().title ?? dir);
    return { projectDir: dir, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startCreateProject, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly title?: string; readonly seed?: string; readonly projectDir?: string };
    let dir: string;
    // 시작 화면은 저장 위치를 미리 보여 주고 확정된 경로를 보낸다. 편집기 메뉴 경로는 예전처럼 대화상자를 연다.
    if (typeof input?.projectDir === "string" && input.projectDir) {
      dir = prepareNewProjectDir(input.projectDir);
    } else {
      const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], title: "새 프로젝트 폴더 선택" });
      if (result.canceled || result.filePaths.length === 0) return null;
      dir = result.filePaths[0];
    }
    const session = await sessions.open(event.sender.id, dir);
    // 시드(장르 프리셋 등)를 새 폴더에 심는다 — 빈 폴더로 시작하면 렌더러가 리로드 뒤에 적용할 수 없다.
    if (typeof input.seed === "string" && input.seed.length > 0) await session.store.saveSerialized(input.seed);
    rememberRecentProject(session.projectDir, input.title ?? "새 프로젝트");
    // 세션이 정규화한 경로(realpath)를 돌려준다 — 시작 화면 인계가 편집기가 연 폴더와 같은 문자열로 비교한다.
    return { projectDir: session.projectDir, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startImportFile, async (event: IpcMainInvokeEvent, payload: unknown) => {
    return { projectDir: null, imported: false };
  });
  // @deprecated multi-user team collaboration is not supported yet (2026-10-21). 시작 화면이 부르지 않는다.
  ipcMain.handle(OPRN_CHANNELS.startJoinTeam, async (_event: IpcMainInvokeEvent, payload: unknown) => {
    if (!TEAM_COLLAB_ENABLED) return { ok: false, error: "팀 협업은 아직 지원하지 않습니다." } satisfies JoinTeamResult;
    const url = (payload as { readonly url?: unknown } | null)?.url;
    return joinTeam(typeof url === "string" ? url : "");
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentTeams, () => (TEAM_COLLAB_ENABLED ? listRecentTeams() : []));
  ipcMain.on(OPRN_CHANNELS.startScreenReady, (event) => {
    mainMark("startScreenReady");
    revealOnStartReady.get(event.sender.id)?.();
  });
  registerIpcHandlers(sessions);
  registerAssetBrowser();
  registerAssetStore({ hasProject: (webContentsId) => sessions.get(webContentsId) !== null });
  registerDeepLinkProtocol();
  mainMark("handlersRegistered");
  // 첫 실행 인자(Windows·Linux)와 본체를 읽기 전에 온 링크·두 번째 실행을 이제 처리한다. 이후 것은 바로 받는다.
  // 두 번째 실행: 링크면 받고, 아니면 예전처럼 새 창(시작 화면)을 연다.
  const onSecondInstance = (argv: readonly string[]): void => {
    const link = findStoreDeepLinkArg([...argv]);
    if (link) acceptStoreDeepLink(link);
    else createWindow();
  };
  const early = boot.attachLinks(acceptStoreDeepLink, onSecondInstance);
  const initialLink = findStoreDeepLinkArg(process.argv);
  for (const link of [...(initialLink ? [initialLink] : []), ...early.links]) acceptStoreDeepLink(link);
  for (const argv of early.secondInstances) onSecondInstance(argv);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  void companionServer?.close();
  for (const host of teamHosts.values()) void host.close();
});
