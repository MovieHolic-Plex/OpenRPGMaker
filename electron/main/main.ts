import { join } from "node:path";
import { BrowserWindow, Menu, app, dialog, ipcMain, protocol, shell, type IpcMainInvokeEvent } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME, OPRN_CHANNELS } from "../shared/channels";
import { registerIpcHandlers } from "./ipc";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { createWindowSessionRegistry } from "./sessions";
import { listRecentProjects, rememberRecentProject } from "./recent";

protocol.registerSchemesAsPrivileged([
  { scheme: OPRN_APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: OPRN_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const sessions = createWindowSessionRegistry();
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
  const startScreen = process.env.OPRN_SMOKE_PAGE === undefined && !hasOpenProject;
  const smokePage = process.env.OPRN_SMOKE_PAGE;
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (smokePage) void window.loadFile(smokePage);
  else if (startScreen) void window.loadURL(`${OPRN_APP_SCHEME}://oprn/start-screen.html`);
  else if (devServerUrl) void window.loadURL(devServerUrl);
  else void window.loadURL(`${OPRN_APP_SCHEME}://oprn/index.html`);
  return window;
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

app.whenReady().then(() => {
  buildMenu();
  registerAppProtocol(rendererDir);
  registerAssetProtocol(sessions);
  ipcMain.handle(OPRN_CHANNELS.lifecycleFlushDone, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) destroyWindow(window);
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentProjects, () => listRecentProjects());
  ipcMain.handle(OPRN_CHANNELS.startOpenFolder, async (event: IpcMainInvokeEvent) => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "프로젝트 폴더 열기" });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = result.filePaths[0];
    if (!sessions.directoryExists(dir)) return { projectDir: dir, isNew: true, projectId: null };
    const session = await sessions.open(event.sender.id, dir);
    rememberRecentProject(dir, session.store.info().title ?? dir);
    return { projectDir: dir, isNew: false, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startCreateProject, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = payload as { readonly title?: string };
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], title: "새 프로젝트 폴더 선택" });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = result.filePaths[0];
    const session = await sessions.open(event.sender.id, dir);
    rememberRecentProject(dir, input.title ?? "새 프로젝트");
    return { projectDir: dir, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startImportFile, async (event: IpcMainInvokeEvent, payload: unknown) => {
    return { projectDir: null, imported: false };
  });
  registerIpcHandlers(sessions);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
