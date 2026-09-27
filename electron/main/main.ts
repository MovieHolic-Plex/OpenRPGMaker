import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { startLocalProjectServer, type LocalProjectServer } from "../serve/runtime";
import { join } from "node:path";
import { BrowserWindow, Menu, app, clipboard, dialog, ipcMain, protocol, shell, type IpcMainInvokeEvent } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME, OPRN_CHANNELS } from "../shared/channels";
import { registerIpcHandlers } from "./ipc";
import { registerAssetBrowser } from "./assetBrowser";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { createProjectSessionRegistry } from "./sessions";
import { startCompanionServer, type CompanionServer } from "./companion";
import { describeRecentProjects, prepareNewProjectDir, rememberRecentProject, suggestProjectDir } from "./recent";

protocol.registerSchemesAsPrivileged([
  { scheme: OPRN_APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: OPRN_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const sessions = createProjectSessionRegistry();
const hosting = new Set<string>();
const teamHosts = new Map<string, LocalProjectServer>();
let companionServer: CompanionServer | null = null;
const rendererDir = process.env.OPRN_RENDERER_DIR ?? join(app.getAppPath(), "dist");

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
    // 리눅스·윈도우 창 제목줄과 작업표시줄 아이콘. 맥은 앱 번들 icns 를 쓰므로 주지 않는다.
    ...(process.platform === "darwin" ? {} : { icon: join(rendererDir, "icons", "pwa-512.png") }),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  window.once("ready-to-show", () => window.show());
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
      const ip = Object.values(networkInterfaces()).flat().find(address => address && !address.internal && address.family === 'IPv4')?.address;
      if (!ip) throw new Error('연결된 로컬 네트워크를 찾을 수 없습니다.');
      const browserBridgeSource = await readFile(join(app.getAppPath(), 'dist-electron/browser-bridge.js'), 'utf8');
      host = await startLocalProjectServer({ projectDir: session.projectDir, distDir: rendererDir,
        browserBridgeSource, sessions, host: '0.0.0.0', publicOrigin: `http://${ip}:0` });
      teamHosts.set(session.projectDir, host);
    }
    clipboard.writeText(session.team.accessCodeRequired() ? host.ownerAccessCode! : host.url);
    await dialog.showMessageBox(window, { message: '팀 호스트가 실행 중입니다.',
      detail: `${host.url}\n${session.team.accessCodeRequired() ? '소유자 접속 코드를 클립보드에 복사했습니다.' : '접속 주소를 클립보드에 복사했습니다. 코드 없이 바로 사용할 수 있습니다.'} 접속 코드는 팀 관리의 접속 설정에서 켜거나 끌 수 있습니다. 같은 네트워크에서 접속할 수 있으며, 앱을 종료하면 호스트도 종료됩니다.` });
    await shell.openExternal(host.url);
  } catch (error) { await dialog.showMessageBox(window, { type: 'error', message: '팀 호스트를 시작하지 못했습니다.', detail: error instanceof Error ? error.message : String(error) }); }
  finally { hosting.delete(session.projectDir); }
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    {
      label: "파일",
      submenu: [
        { label: "팀 협업 시작 / 관리", click: () => { void hostCurrentTeam(); } },
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
  ipcMain.handle(OPRN_CHANNELS.startRecentProjects, () => describeRecentProjects());
  ipcMain.handle(OPRN_CHANNELS.startSuggestProjectDir, (_event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly title?: unknown; readonly root?: unknown } | null;
    const title = typeof input?.title === "string" ? input.title : undefined;
    return typeof input?.root === "string" && input.root ? suggestProjectDir(title, input.root) : suggestProjectDir(title);
  });
  ipcMain.handle(OPRN_CHANNELS.startChooseProjectRoot, async (event: IpcMainInvokeEvent) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">, title: "새 게임을 만들 위치 선택" };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
  ipcMain.handle(OPRN_CHANNELS.startOpenFolder, async (event: IpcMainInvokeEvent) => {
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
  registerIpcHandlers(sessions);
  registerAssetBrowser();
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
