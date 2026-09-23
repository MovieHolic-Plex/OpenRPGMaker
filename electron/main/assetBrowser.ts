import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserWindow, WebContentsView, ipcMain, session, type Session, type WebContents } from "electron";
import { assetPageUrl } from "../../src/editor/assetBrowser/assetPageAllowlist";
import { OPRN_CHANNELS } from "../shared/channels";
import { assetBrowserBoundsSchema, assetBrowserOpenSchema } from "../shared/schemas";

const MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024;
const PACK_EXTENSIONS = [".zip", ".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;

type AssetView = {
  view: WebContentsView;
  hostWindowId: number | null;
  hostContents: WebContents | null;
};

let opened: AssetView | null = null;
let downloadDir: string | null = null;
const hookedWindows = new Set<number>();

export function registerAssetBrowser(): void {
  const ses = session.fromPartition("persist:oprn-asset-browser");
  bindDownloads(ses);
  ipcMain.handle(OPRN_CHANNELS.assetBrowserOpen, async (event, payload: unknown) => {
    const input = assetBrowserOpenSchema.parse(payload);
    const url = assetPageUrl(input.url);
    if (url === null) throw new Error("itch.io 페이지 주소만 열 수 있습니다.");
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window === null) throw new Error("편집기 창을 찾지 못했습니다.");
    const asset = ensureView(ses);
    attach(window, event.sender, asset);
    asset.view.setBounds({ x: input.x, y: input.y, width: input.width, height: input.height });
    await asset.view.webContents.loadURL(url.toString());
    return { title: asset.view.webContents.getTitle(), url: asset.view.webContents.getURL() };
  });
  ipcMain.handle(OPRN_CHANNELS.assetBrowserBounds, (event, payload: unknown) => {
    const input = assetBrowserBoundsSchema.parse(payload);
    if (opened?.hostContents !== event.sender) return false;
    opened.view.setBounds(input);
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.assetBrowserClose, (event) => {
    if (opened?.hostContents !== event.sender) return false;
    hide(BrowserWindow.fromWebContents(event.sender));
    return true;
  });
}

function ensureView(ses: Session): AssetView {
  if (opened) return opened;
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const contents = view.webContents;
  contents.setUserAgent(contents.getUserAgent().replace(/ Electron\/\S+/, ""));
  contents.setWindowOpenHandler(({ url }) => {
    if (assetPageUrl(url) !== null) {
      void contents.loadURL(url);
      return { action: "deny" };
    }
    if (url.startsWith("https://")) {
      contents.downloadURL(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (assetPageUrl(url) === null) event.preventDefault();
  });
  contents.on("will-redirect", (event, url) => {
    if (!url.startsWith("https://")) event.preventDefault();
  });
  opened = { view, hostWindowId: null, hostContents: null };
  return opened;
}

function attach(window: BrowserWindow, hostContents: WebContents, asset: AssetView): void {
  if (asset.hostWindowId !== null && asset.hostWindowId !== window.id) {
    BrowserWindow.fromId(asset.hostWindowId)?.contentView.removeChildView(asset.view);
  }
  if (asset.hostWindowId !== window.id) window.contentView.addChildView(asset.view);
  asset.hostWindowId = window.id;
  asset.hostContents = hostContents;
  watchClose(window);
}

function watchClose(window: BrowserWindow): void {
  if (hookedWindows.has(window.id)) return;
  hookedWindows.add(window.id);
  window.once("closed", () => {
    hookedWindows.delete(window.id);
    if (opened?.hostWindowId === window.id) opened = null;
  });
}

function hide(window: BrowserWindow | null): void {
  if (!opened) return;
  opened.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  window?.contentView.removeChildView(opened.view);
  opened.hostWindowId = null;
  opened.hostContents = null;
}

function bindDownloads(ses: Session): void {
  ses.on("will-download", (event, item, contents) => {
    const pageUrl = contents.getURL();
    if (assetPageUrl(pageUrl) === null) {
      event.preventDefault();
      return;
    }
    const fileName = item.getFilename() || fileNameFromUrl(item.getURL());
    if (isBlockedDownload(fileName)) {
      event.preventDefault();
      notify({ kind: "rejected", message: "zip 또는 그림 파일만 가져옵니다." });
      return;
    }
    const total = item.getTotalBytes();
    if (total > MAX_DOWNLOAD_BYTES) {
      event.preventDefault();
      notify({ kind: "rejected", message: "32MB보다 큰 파일은 가져오지 않습니다." });
      return;
    }
    const savePath = join(downloadDirectory(), `${Date.now()}-${safeFileName(fileName)}`);
    item.setSavePath(savePath);
    item.once("done", (_doneEvent, state) => {
      if (state !== "completed") {
        notify({ kind: "rejected", message: "받기가 끝나기 전에 중단되었습니다." });
        return;
      }
      void deliver(savePath, fileName, pageUrl, contents.getTitle());
    });
  });
}

function downloadDirectory(): string {
  downloadDir ??= mkdtempSync(join(tmpdir(), "oprn-asset-browser-"));
  return downloadDir;
}

async function deliver(savePath: string, fileName: string, pageUrl: string, pageTitle: string): Promise<void> {
  const bytes = new Uint8Array(await readFile(savePath));
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES || !isPackBytes(bytes)) {
    notify({ kind: "rejected", message: "zip 또는 그림 파일만 가져옵니다." });
    return;
  }
  const name = isPackFile(fileName) ? fileName : packNameFromBytes(bytes, fileName);
  notify({ kind: "download", fileName: name, pageUrl, pageTitle, bytes });
}

function notify(payload: { readonly kind: "rejected"; readonly message: string } | { readonly kind: "download"; readonly fileName: string; readonly pageUrl: string; readonly pageTitle: string; readonly bytes: Uint8Array }): void {
  const host = opened?.hostContents;
  if (host === undefined || host === null || host.isDestroyed()) return;
  host.send(OPRN_CHANNELS.assetBrowserDownload, payload);
}

function isBlockedDownload(fileName: string): boolean {
  return /\.(exe|dmg|pkg|msi|bat|cmd|sh|html?|js)$/i.test(fileName);
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof URIError)) throw error;
    return "";
  }
}

function isPackBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
}

function packNameFromBytes(bytes: Uint8Array, fileName: string): string {
  if (bytes[0] === 0x50) return fileName.endsWith(".zip") ? fileName : `${fileName || "pack"}.zip`;
  if (bytes[0] === 0x89) return fileName.endsWith(".png") ? fileName : `${fileName || "tileset"}.png`;
  return fileName || "pack.bin";
}

function isPackFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return PACK_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function safeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "download";
  const cleaned = base.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "download";
}
