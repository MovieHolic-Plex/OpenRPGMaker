import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { app, BrowserWindow, ipcMain, Menu, protocol } from "electron";
import { normalizeOpakPath, OpakArchiveReader } from "./opakReader";
import { createDesktopSaveStore, resolveWritableSaveDir, type DesktopSaveStore } from "./saveStore";

const OPRN_GAME_SCHEME = "oprn-game";
const PLAYER_IPC = {
  writeSaveFile: "oprn-player:write-save",
  readSaveFile: "oprn-player:read-save",
  listSaveFiles: "oprn-player:list-saves",
  toggleFullscreen: "oprn-player:toggle-fullscreen",
  captureScreenshot: "oprn-player:capture-screenshot",
  quit: "oprn-player:quit",
} as const;

interface DesktopRuntimeConfig {
  readonly gameTitle?: string;
  readonly executableSlug?: string;
  readonly version?: string;
  readonly window?: {
    readonly defaultMode?: "fullscreen" | "windowed-720p" | "windowed-640p";
    readonly width?: number;
    readonly height?: number;
    readonly resizable?: boolean;
  };
  readonly storage?: {
    readonly steamAutoCloud?: boolean;
    readonly saveDirectory?: string;
    readonly saveNamespace?: string;
  };
  readonly archive?: {
    readonly pakPath?: string;
    readonly packed?: boolean;
  };
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: OPRN_GAME_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      codeCache: true,
    },
  },
]);

function readCliFlagValue(argv: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag && i + 1 < argv.length) return argv[i + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}

function locateResourcesDir(): string {
  const cliDir = readCliFlagValue(process.argv, "--game-dir") ?? process.env.OPRN_GAME_DIR;
  const candidates: string[] = [];
  if (cliDir?.trim()) {
    const abs = resolve(cliDir.trim());
    candidates.push(join(abs, "resources"), abs);
  }
  if (app.isPackaged) {
    candidates.push(process.resourcesPath, join(process.resourcesPath, "resources"));
  }
  const appPath = app.getAppPath();
  candidates.push(
    join(appPath, "resources"),
    join(dirname(appPath), "resources"),
    join(dirname(process.execPath), "resources"),
  );
  for (const dir of candidates) {
    if (
      existsSync(join(dir, "desktop-runtime.json")) ||
      existsSync(join(dir, "game.pak")) ||
      existsSync(join(dir, "app", "index.html"))
    ) {
      return dir;
    }
  }
  return candidates[0] ?? join(appPath, "resources");
}

function readRuntimeConfig(resourcesDir: string): DesktopRuntimeConfig {
  const configPath = join(resourcesDir, "desktop-runtime.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as DesktopRuntimeConfig;
  } catch {
    return {};
  }
}

function contentTypeFor(entryPath: string): string {
  const ext = extname(entryPath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function parseByteRange(rangeHeader: string | null, totalSize: number): { readonly start: number; readonly end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || totalSize <= 0) return null;
  const spec = rangeHeader.slice("bytes=".length).split(",")[0]?.trim();
  if (!spec) return null;
  const [rawStart, rawEnd] = spec.split("-", 2);
  if (rawStart === "" && rawEnd) {
    const suffix = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, totalSize - suffix);
    return { start, end: totalSize - 1 };
  }
  const start = Number.parseInt(rawStart ?? "", 10);
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : totalSize - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= totalSize || end < start) {
    return null;
  }
  return { start, end: Math.min(end, totalSize - 1) };
}

function registerGameProtocol(resourcesDir: string, pakReader: OpakArchiveReader | null): void {
  const appDir = resolve(resourcesDir, "app");

  protocol.handle(OPRN_GAME_SCHEME, (request: Request): Response => {
    const url = new URL(request.url);
    const cleanPath = normalizeOpakPath(url.pathname);
    if (!cleanPath) {
      return new Response("Invalid path", { status: 400 });
    }

    // 1. Primary path: serve directly from OPAK binary archive (resources/game.pak)
    if (pakReader) {
      const meta = pakReader.getEntryMeta(url.pathname);
      if (!meta) {
        return new Response("Not Found", { status: 404 });
      }
      const mime = contentTypeFor(meta.path);
      const range = parseByteRange(request.headers.get("range"), meta.size);
      if (range) {
        const length = range.end - range.start + 1;
        const headers = {
          "content-type": mime,
          "accept-ranges": "bytes",
          "content-range": `bytes ${range.start}-${range.end}/${meta.size}`,
          "content-length": String(length),
          "cache-control": "no-store",
        };
        if (request.method === "HEAD") return new Response(null, { status: 206, headers });
        const chunk = pakReader.readSlice(meta, range.start, length);
        return new Response(new Uint8Array(chunk), { status: 206, headers });
      }
      const headers = {
        "content-type": mime,
        "accept-ranges": "bytes",
        "content-length": String(meta.size),
        "cache-control": "no-store",
      };
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      const bytes = pakReader.readSlice(meta, 0, meta.size);
      return new Response(new Uint8Array(bytes), { status: 200, headers });
    }

    // 2. Fallback path: serve from unpacked resources/app/ directory when packAssetsArchive is false
    const candidate = resolve(appDir, cleanPath);
    if (!candidate.startsWith(`${appDir}${sep}`) || !existsSync(candidate)) {
      return new Response("Not Found", { status: 404 });
    }
    const bytes = readFileSync(candidate);
    const headers = {
      "content-type": contentTypeFor(candidate),
      "content-length": String(bytes.length),
      "cache-control": "no-store",
    };
    if (request.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(new Uint8Array(bytes), { status: 200, headers });
  });
}

function registerIpcHandlers(getWindow: () => BrowserWindow | null, saveStore: DesktopSaveStore, slug: string): void {
  ipcMain.handle(PLAYER_IPC.writeSaveFile, (_event, relativePath: unknown, content: unknown) => {
    if (typeof relativePath !== "string" || typeof content !== "string") {
      throw new Error("Invalid save arguments");
    }
    saveStore.writeSaveFile(relativePath, content);
  });

  ipcMain.handle(PLAYER_IPC.readSaveFile, (_event, relativePath: unknown) => {
    if (typeof relativePath !== "string") {
      throw new Error("Invalid save path argument");
    }
    return saveStore.readSaveFile(relativePath);
  });

  ipcMain.handle(PLAYER_IPC.listSaveFiles, () => {
    return saveStore.listSaveFiles();
  });

  ipcMain.handle(PLAYER_IPC.toggleFullscreen, () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return next;
  });

  ipcMain.handle(PLAYER_IPC.captureScreenshot, async () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const image = await win.webContents.capturePage();
    return saveStore.writeScreenshot(slug, image.toPNG());
  });

  ipcMain.handle(PLAYER_IPC.quit, () => {
    app.quit();
  });
}

function resolveInitialWindowOptions(config: DesktopRuntimeConfig): {
  readonly width: number;
  readonly height: number;
  readonly fullscreen: boolean;
  readonly resizable: boolean;
} {
  const defaultMode = config.window?.defaultMode ?? "fullscreen";
  const hasFullscreenFlag = process.argv.includes("--fullscreen");
  const hasWindowedFlag = process.argv.includes("--windowed");
  const fullscreen = hasWindowedFlag ? false : hasFullscreenFlag ? true : defaultMode === "fullscreen";
  const defaultWidth = defaultMode === "windowed-640p" ? 960 : 1280;
  const defaultHeight = defaultMode === "windowed-640p" ? 640 : 720;
  const width = typeof config.window?.width === "number" && config.window.width >= 320 ? Math.trunc(config.window.width) : defaultWidth;
  const height = typeof config.window?.height === "number" && config.window.height >= 240 ? Math.trunc(config.window.height) : defaultHeight;
  const resizable = config.window?.resizable !== false;
  return { width, height, fullscreen, resizable };
}

let mainWindow: BrowserWindow | null = null;
let activePakReader: OpakArchiveReader | null = null;

async function startDesktopPlayer(): Promise<void> {
  const resourcesDir = locateResourcesDir();
  const config = readRuntimeConfig(resourcesDir);
  const title = config.gameTitle?.trim() || "OPRN Game";
  const slug = config.executableSlug?.trim() || "oprn-game";

  // Keep userData per-game (or per shared saveNamespace) so multiple games never collide.
  const saveNamespace = config.storage?.saveNamespace?.trim() || slug;
  const userDataDir = join(app.getPath("appData"), "OPRN-Games", saveNamespace.replace(/[^a-zA-Z0-9._-]+/g, "-"));
  app.setPath("userData", userDataDir);

  // Prefer portable <installDir>/saves for Steam Auto-Cloud GameInstall when writable (not inside macOS .app bundle).
  const installRoot = app.isPackaged ? dirname(process.execPath) : dirname(resourcesDir);
  const isInsideMacAppBundle = process.platform === "darwin" && installRoot.includes(".app/");
  const preferredSaveDir = config.storage?.steamAutoCloud !== false && !isInsideMacAppBundle
    ? join(installRoot, config.storage?.saveDirectory || "saves")
    : undefined;
  const saveDir = resolveWritableSaveDir({
    overrideDir: process.env.OPRN_SAVE_DIR,
    preferredDir: preferredSaveDir,
    fallbackDir: join(app.getPath("userData"), "saves"),
  });
  const saveStore = createDesktopSaveStore(saveDir);

  const pakPath = join(resourcesDir, "game.pak");
  if (existsSync(pakPath)) {
    activePakReader = OpakArchiveReader.openFile(pakPath);
  }

  registerGameProtocol(resourcesDir, activePakReader);
  registerIpcHandlers(() => mainWindow, saveStore, slug);
  Menu.setApplicationMenu(null);

  const winOpts = resolveInitialWindowOptions(config);
  const preloadPath = join(__dirname, "preload.cjs");

  mainWindow = new BrowserWindow({
    title,
    width: winOpts.width,
    height: winOpts.height,
    fullscreen: winOpts.fullscreen,
    resizable: winOpts.resizable,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // Handle F11 / Alt+Enter natively and prevent duplicate toggle in renderer keydown.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const isF11 = input.key === "F11" && !input.control && !input.alt && !input.meta;
    const isAltEnter = input.key === "Enter" && input.alt && !input.control && !input.meta;
    if (isF11 || isAltEnter) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`${OPRN_GAME_SCHEME}://app/index.html`);
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  activePakReader?.close();
  activePakReader = null;
});

void app.whenReady().then(() => startDesktopPlayer()).catch((error) => {
  console.error("[oprn-desktop-player] Failed to start:", error);
  app.exit(1);
});
