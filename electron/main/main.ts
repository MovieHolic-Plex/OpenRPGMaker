import { join } from "node:path";
import { BrowserWindow, Menu, app, protocol, shell } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME } from "../shared/channels";
import { registerIpcHandlers } from "./ipc";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { createWindowSessionRegistry } from "./sessions";

protocol.registerSchemesAsPrivileged([
  { scheme: OPRN_APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: OPRN_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const sessions = createWindowSessionRegistry();
const rendererDir = process.env.OPRN_RENDERER_DIR ?? join(app.getAppPath(), "dist");

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
  window.on("closed", () => sessions.close(window.webContents.id));

  const smokePage = process.env.OPRN_SMOKE_PAGE;
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (smokePage) void window.loadFile(smokePage);
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
  registerIpcHandlers(sessions);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
