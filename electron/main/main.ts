import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { startLocalProjectServer, type LocalProjectServer } from "../serve/runtime";
import { normalizeTeamUrl } from "../serve/localNetwork";
import { join } from "node:path";
import { BrowserWindow, Menu, app, clipboard, dialog, ipcMain, protocol, shell, type IpcMainInvokeEvent } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME, OPRN_CHANNELS } from "../shared/channels";
import { registerIpcHandlers } from "./ipc";
import { registerAssetBrowser } from "./assetBrowser";
import { registerAssetStore } from "./assetStore";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { createProjectSessionRegistry } from "./sessions";
import { startCompanionServer, type CompanionServer } from "./companion";
import { describeRecentProjects, listRecentTeams, prepareNewProjectDir, recentProjectCoverSource, rememberRecentProject, rememberRecentTeam, suggestProjectDir, writeRecentProjectCover } from "./recent";
import { openTeamWindow } from "./teamWindow";
import type { JoinTeamResult } from "../shared/start";

protocol.registerSchemesAsPrivileged([
  { scheme: OPRN_APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: OPRN_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const sessions = createProjectSessionRegistry();
const hosting = new Set<string>();
const teamHosts = new Map<string, LocalProjectServer>();
let companionServer: CompanionServer | null = null;
const rendererDir = process.env.OPRN_RENDERER_DIR ?? join(app.getAppPath(), "dist");
const windowIcon = process.platform === "darwin" ? undefined : join(rendererDir, "icons", "pwa-512.png");
/** 팀 호스트 포트. 앱을 다시 켜도 팀원이 받은 주소가 그대로 맞도록 고정 범위에서 먼저 찾는다. */
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

// 닫기는 flush → ack → destroy 다(설계서 7.3). 렌더러가 10초 안에 flush-done 을 부르지 않으면 강제로 닫는다.
function installCloseFlow(window: BrowserWindow): void {
  const id = window.webContents.id;
  window.on("close", (event) => {
    if (closing.has(id)) return;
    if (!sessions.get(id)) return;
    event.preventDefault();
    closing.add(id);
    window.webContents.send(OPRN_CHANNELS.lifecycleFlushBeforeClose);
    closeTimers.set(id, setTimeout(() => destroyWindow(window), 10_000));
  });
  window.on("closed", () => {
    closing.delete(id);
    const timer = closeTimers.get(id);
    if (timer) clearTimeout(timer);
    closeTimers.delete(id);
    sessions.close(id);
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
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

  window.once("ready-to-show", () => window.show());
  // F11·보기 메뉴 등 버튼 밖에서도 전체화면이 바뀐다 — 렌더러가 아이콘 상태를 맞출 수 있게 알린다.
  const broadcastFullscreen = (fullscreen: boolean): void => {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.windowFullscreen, fullscreen);
  };
  window.on("enter-full-screen", () => broadcastFullscreen(true));
  window.on("leave-full-screen", () => broadcastFullscreen(false));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${OPRN_APP_SCHEME}://`)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  installCloseFlow(window);

  const hasOpenProject = sessions.get(window.webContents.id) !== null;
  // QA 하니스용 진입점(OPRN_SMOKE_PAGE·OPRN_RENDERER_DIR 와 같은 계열): 폴더를 주면 시작 화면을
  // 건너뛰고 그 폴더를 연 채로 편집기를 띄운다. GUI 폴더 선택 대화상자를 자동화할 수 없어서
  // "앱이 폴더를 열고 편집기로 들어간다" 를 헤드리스에서 확인할 유일한 길이다.
  const bootProjectDir = process.env.OPRN_OPEN_PROJECT_DIR;
  const startScreen = process.env.OPRN_SMOKE_PAGE === undefined && bootProjectDir === undefined && !hasOpenProject;
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
  return window;
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

/** 참여하는 쪽: 다른 컴퓨터의 팀 호스트를 앱 창으로 연다. 창이 첫 페이지를 불러오면 끝난다. */
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

/** The app owns the local host lifecycle; users do not install or start a DB/server. */
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

/** 파일 메뉴 → 팀에 참여. 주소 입력은 시작 화면이 맡는다. 새 창은 프로젝트가 없으니 시작 화면으로 열린다. */
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
        { label: "팀 협업 시작 / 관리", click: () => { void hostCurrentTeam(); } },
        { label: "팀에 참여…", click: () => { showJoinFromMenu(); } },
        { label: "팀 호스트 중지", click: async () => {
          const window = focusedWindow();
          const projectDir = window ? sessions.get(window.webContents.id)?.projectDir : undefined;
          if (!projectDir) return;
          await teamHosts.get(projectDir)?.close(); teamHosts.delete(projectDir);
        } },
        { type: "separator" },
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

app.whenReady().then(async () => {
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
  companionServer = await startCompanionServer();
  ipcMain.on(OPRN_CHANNELS.companionOrigin, (event) => {
    event.returnValue = companionServer?.origin ?? null;
  });
  ipcMain.on(OPRN_CHANNELS.companionToken, (event) => {
    event.returnValue = companionServer?.token ?? null;
  });
  buildMenu();
  registerAppProtocol(rendererDir, () => sessions.firstProjectDir() ?? process.cwd(), () => companionServer?.origin ?? null);
  registerAssetProtocol(sessions);
  ipcMain.handle(OPRN_CHANNELS.lifecycleFlushDone, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) destroyWindow(window);
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.windowControl, (event, action: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    if (action === "toggle-fullscreen") { window.setFullScreen(!window.isFullScreen()); return true; }
    if (action === "close") { window.close(); return true; }
    return false;
  });
  // 창의 진짜 전체화면 상태는 네이티브 쪽에만 있다 — 브라우저 Fullscreen API 는 이 창과 무관하다.
  ipcMain.handle(OPRN_CHANNELS.windowFullscreen, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    return window.isFullScreen();
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentProjects, () => describeRecentProjects());
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
  ipcMain.handle(OPRN_CHANNELS.startJoinTeam, async (_event: IpcMainInvokeEvent, payload: unknown) => {
    const url = (payload as { readonly url?: unknown } | null)?.url;
    return joinTeam(typeof url === "string" ? url : "");
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentTeams, () => listRecentTeams());
  registerIpcHandlers(sessions);
  registerAssetBrowser();
  registerAssetStore();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  void companionServer?.close();
  for (const host of teamHosts.values()) void host.close();
});
