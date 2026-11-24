// 앱 자동 업데이트(메인). 흐름과 판단은 electron/shared/appUpdate.ts, 칩은 src/app/appUpdateChip.ts.
//
// 공급자는 GitHub 릴리스다(공개 저장소). 패키지 안 app-update.yml(electron-builder publish 설정)이 주소를 갖는다.
// 릴리스 워크플로가 latest.yml·latest-linux.yml·blockmap 을 올린 판부터 실제로 받는다 — 그 전 판은 확인이 404 로 끝나고 조용히 넘어간다.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPRN_CHANNELS } from "../shared/channels";
import {
  APP_UPDATE_FIRST_CHECK_MS,
  APP_UPDATE_INTERVAL_MS,
  appUpdateModeFor,
  portableDownloadUrl,
  summarizeReleaseNotes,
  type AppUpdateMode,
  type AppUpdateState,
  type AppUpdateStatus,
  type AppUpdateWhatsNew,
} from "../shared/appUpdate";

type Updater = typeof import("electron-updater").autoUpdater;

interface StoredPrefs {
  enabled: boolean;
  /** 받아 둔 판의 「바뀐 점」. 그 판으로 켜졌을 때 한 번 보이고 지운다. */
  pending?: AppUpdateWhatsNew;
}

let mode: AppUpdateMode = "off";
let state: AppUpdateState = { kind: "idle" };
let prefs: StoredPrefs = { enabled: true };
let whatsNew: AppUpdateWhatsNew | null = null;
let updater: Updater | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let installing = false;
/** AppImage 는 이름에 판이 박혀 있으면 새 이름으로 옮겨진다. 다시 띄울 파일. */
let appImageTarget: string | null = null;

const prefsPath = (): string => join(app.getPath("userData"), "app-update.json");
/** CI 업데이트 e2e(scripts/qa/app-update-e2e.mjs)만 켠다. 다 받으면 칩을 누른 것처럼 바로 설치·재시작하고 줄을 남긴다. */
const e2eLog = (): string | undefined => process.env.OPRN_UPDATE_E2E_LOG || undefined;

function e2eNote(event: string, detail: Record<string, unknown> = {}): void {
  const file = e2eLog();
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify({ event, version: app.getVersion(), pid: process.pid, ...detail })}\n`);
  } catch (error) {
    console.warn("[update] e2e 기록 실패:", error);
  }
}

function readPrefs(): StoredPrefs {
  try {
    if (!existsSync(prefsPath())) return { enabled: true };
    const raw = JSON.parse(readFileSync(prefsPath(), "utf8")) as Partial<StoredPrefs>;
    const pending = raw.pending && typeof raw.pending.version === "string" && Array.isArray(raw.pending.lines)
      ? { version: raw.pending.version, lines: raw.pending.lines.filter((line): line is string => typeof line === "string") }
      : undefined;
    return { enabled: raw.enabled !== false, ...(pending ? { pending } : {}) };
  } catch {
    return { enabled: true };
  }
}

function writePrefs(): void {
  try {
    writeFileSync(prefsPath(), `${JSON.stringify(prefs, null, 2)}\n`);
  } catch (error) {
    console.warn("[update] 설정 저장 실패:", error);
  }
}

function status(): AppUpdateStatus {
  return { mode, enabled: prefs.enabled, currentVersion: app.getVersion(), state };
}

function setState(next: AppUpdateState): void {
  state = next;
  const payload = status();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.updateState, payload);
  }
}

async function check(): Promise<void> {
  if (!updater || !prefs.enabled || state.kind === "ready" || installing) return;
  try {
    await updater.checkForUpdates();
  } catch (error) {
    // 오프라인·릴리스에 latest.yml 이 아직 없음 등. 사용자에게 보일 일이 아니다.
    console.warn("[update] 확인 실패:", error instanceof Error ? error.message : String(error));
  }
}

function schedule(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (!prefs.enabled || mode === "off") return;
  setTimeout(() => void check(), APP_UPDATE_FIRST_CHECK_MS);
  timer = setInterval(() => void check(), APP_UPDATE_INTERVAL_MS);
}

function adoptWhatsNew(): void {
  const pending = prefs.pending;
  if (!pending) return;
  if (pending.version === app.getVersion()) {
    whatsNew = pending;
    delete prefs.pending;
    writePrefs();
  }
}

async function attachUpdater(): Promise<void> {
  const { autoUpdater } = await import("electron-updater");
  updater = autoUpdater;
  autoUpdater.logger = { info: () => {}, debug: () => {}, warn: (m: unknown) => console.warn("[update]", m), error: (m: unknown) => console.warn("[update]", m) };
  autoUpdater.autoDownload = mode === "auto";
  autoUpdater.autoInstallOnAppQuit = mode === "auto" && prefs.enabled;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("update-available", (info) => {
    if (mode === "manual") setState({ kind: "available", version: info.version, downloadUrl: portableDownloadUrl(info.version) });
    else setState({ kind: "downloading", version: info.version });
  });
  autoUpdater.on("update-downloaded", (info) => {
    prefs.pending = { version: info.version, lines: summarizeReleaseNotes(info.releaseNotes) };
    writePrefs();
    setState({ kind: "ready", version: info.version });
    e2eNote("downloaded", { to: info.version });
    if (e2eLog()) installAppUpdate();
  });
  autoUpdater.on("appimage-filename-updated", (path: string) => { appImageTarget = path; });
  autoUpdater.on("error", (error) => {
    console.warn("[update] 오류:", error instanceof Error ? error.message : String(error));
    if (state.kind === "downloading") setState({ kind: "idle" });
  });
}

/**
 * 받아 둔 판을 설치하고 다시 띄운다. 저장·조수 대기는 렌더러가 끝낸 뒤 부른다(칩 → update.install).
 * 창 닫기 저장 확인(main.ts closeWindows)은 건너뛴다 — isInstallingAppUpdate() 를 본다.
 */
export function installAppUpdate(): boolean {
  if (!updater || state.kind !== "ready" || installing) return false;
  installing = true;
  e2eNote("install");
  if (process.platform === "linux") {
    // AppImage: isForceRunAfter 를 주면 새 파일을 바로 띄우는데, 그때는 아직 이 실행이 한 번만 실행 잠금을 쥐고 있어
    // 새 실행이 곧바로 꺼진다. 설치만 하고(새 파일은 APPIMAGE_EXIT_AFTER_INSTALL 로 바로 끝난다 — boot.ts)
    // 이 실행이 완전히 끝난 뒤 다시 띄우게 relaunch 를 건다.
    const before = process.env.APPIMAGE ?? null;
    updater.quitAndInstall(true, false);
    const target = appImageTarget ?? before;
    if (target) app.relaunch({ execPath: target, args: process.argv.slice(1) });
  } else {
    updater.quitAndInstall(true, true);
  }
  return true;
}

export function isInstallingAppUpdate(): boolean {
  return installing;
}

export function registerAppUpdate(): void {
  mode = appUpdateModeFor({ platform: process.platform, isPackaged: app.isPackaged, env: process.env });
  prefs = readPrefs();
  adoptWhatsNew();
  e2eNote("start", { mode });

  ipcMain.handle(OPRN_CHANNELS.updateStatus, () => status());
  ipcMain.handle(OPRN_CHANNELS.updateInstall, () => installAppUpdate());
  ipcMain.handle(OPRN_CHANNELS.updateOpenDownload, () => {
    if (state.kind === "available") void shell.openExternal(state.downloadUrl);
  });
  ipcMain.handle(OPRN_CHANNELS.updateTakeWhatsNew, () => {
    const taken = whatsNew;
    whatsNew = null;
    return taken;
  });
  ipcMain.handle(OPRN_CHANNELS.updateSetEnabled, (_event, enabled: unknown) => {
    prefs.enabled = enabled === true;
    writePrefs();
    if (updater) updater.autoInstallOnAppQuit = mode === "auto" && prefs.enabled;
    schedule();
    setState(state);
    return status();
  });

  if (mode === "off") return;
  void attachUpdater().then(schedule, (error) => {
    console.warn("[update] 업데이트 모듈을 읽지 못했습니다:", error);
  });
}
