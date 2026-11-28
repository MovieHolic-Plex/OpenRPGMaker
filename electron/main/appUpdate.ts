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
  APP_UPDATE_REPO,
  appUpdateModeFor,
  compareSemver,
  isSafeReleaseDownloadUrl,
  portableDownloadUrl,
  releasesLatestPageUrl,
  restoreLaunchEnv,
  snapshotLaunchEnv,
  summarizeReleaseNotes,
  summarizeReleaseNotesRange,
  isReleaseNoteHeading,
  type ReleaseFeedEntry,
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
let attachPromise: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let installing = false;
let manualCheckInFlight = false;
let manualDownloadOwned = false;
/** 켜질 때의 경로 환경 변수. 이 모듈은 main.ts 가 import 할 때 평가되므로 startApp 이 값을 쓰기 전이다. */
const launchEnv = snapshotLaunchEnv(process.env);

const prefsPath = (): string => join(app.getPath("userData"), "app-update.json");
/** CI 업데이트 e2e(scripts/qa/app-update-e2e.mjs)만 켠다. 다 받으면 칩을 누르거나(install) 앱을 끄고(quit) 줄을 남긴다. */
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

function friendlyUpdateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ERR_INTERNET_DISCONNECTED|AbortError|fetch failed/i.test(raw)) {
    return "네트워크에 연결할 수 없어 업데이트를 확인하지 못했어요.";
  }
  if (/404|Cannot find latest/i.test(raw)) {
    return "아직 이 환경용 업데이트 정보가 등록되지 않았어요.";
  }
  if (/403|rate limit/i.test(raw)) {
    return "잠시 후 다시 확인해 주세요 (요청 한도 초과).";
  }
  return "업데이트를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

async function check(): Promise<void> {
  if (!updater || !prefs.enabled || installing) return;
  if (state.kind === "ready" || state.kind === "checking" || state.kind === "downloading") return;
  try {
    await updater.checkForUpdates();
  } catch (error) {
    // 오프라인·릴리스에 latest.yml 이 아직 없음 등. 자동 확인은 사용자에게 보일 일이 아니다.
    console.warn("[update] 확인 실패:", error instanceof Error ? error.message : String(error));
  }
}

const RELEASE_NOTES_MAX_ITEMS = 10;
// 여러 버전이 밀렸을 때 재시작 뒤 안내에도 같은 목록을 보인다(제목 줄 포함) — 옛 8줄 한도는 한 판 분량이었다.
const WHATS_NEW_MAX_ITEMS = 45;
const RELEASE_RANGE_FETCH_COUNT = 30;

type RangeCache = { readonly key: string; readonly notes: readonly string[] };
let rangeCache: RangeCache | null = null;

/** 지금 판 초과·latest 이하의 릴리스 변경을 모은다. 실패·없음은 빈 배열(호출한 쪽이 한 판짜리 노트를 그대로 둔다). */
async function fetchReleaseNotesRange(latest: string): Promise<readonly string[]> {
  if (e2eLog()) return [];
  const plain = String(latest).replace(/^v/i, "").trim();
  if (!plain) return [];
  const current = app.getVersion();
  const key = `${current}→${plain}`;
  if (rangeCache?.key === key) return rangeCache.notes;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://api.github.com/repos/${APP_UPDATE_REPO.owner}/${APP_UPDATE_REPO.repo}/releases?per_page=${RELEASE_RANGE_FETCH_COUNT}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `OPRN-Studio/${current}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const notes = summarizeReleaseNotesRange(data as readonly ReleaseFeedEntry[], current, plain, { perVersionMax: 5, totalMax: WHATS_NEW_MAX_ITEMS - 5 });
    rangeCache = { key, notes };
    return notes;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 밀린 중간 버전이 있으면 그 변경까지 모아 노트를 바꿔 끼운다. 밀린 게 하나뿐이면 노트가 이미 그 한 판 것이라 바꾸지 않는다.
 * 릴리스 목록을 못 읽으면(오프라인·속도 제한) 받아 둔 한 판짜리 노트가 그대로 남는다.
 */
function hydrateReleaseNotes(version: string, existing: readonly string[]): void {
  if (e2eLog()) return;
  void fetchReleaseNotesRange(version).then((notes) => {
    if (notes.length === 0) return;
    // 한 판짜리 결과(제목 없음)는 이미 가진 노트가 있으면 그대로 둔다.
    if (existing.length > 0 && !notes.some(isReleaseNoteHeading)) return;
    if (state.kind === "downloading" && state.version === version) {
      setState({ ...state, releaseNotes: notes });
    } else if (state.kind === "ready" && state.version === version) {
      setState({ ...state, releaseNotes: notes });
      if (prefs.pending?.version === version) {
        prefs.pending = { version, lines: notes.slice(0, WHATS_NEW_MAX_ITEMS) };
        writePrefs();
      }
    } else if (state.kind === "available" && state.version === version) {
      setState({ ...state, releaseNotes: notes });
    }
  });
}

async function checkViaGithubRelease(): Promise<void> {
  setState({ kind: "checking" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `https://api.github.com/repos/${APP_UPDATE_REPO.owner}/${APP_UPDATE_REPO.repo}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `OPRN-Studio/${app.getVersion()}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { tag_name?: unknown; html_url?: unknown; body?: unknown };
    const latest = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/i, "").trim() : "";
    if (!latest) {
      setState({ kind: "up-to-date", checkedAt: Date.now() });
      return;
    }
    if (compareSemver(latest, app.getVersion()) > 0) {
      const candidateUrl = typeof data.html_url === "string" ? data.html_url : "";
      const downloadUrl = isSafeReleaseDownloadUrl(candidateUrl) ? candidateUrl : releasesLatestPageUrl();
      const releaseNotes = summarizeReleaseNotes(data.body, RELEASE_NOTES_MAX_ITEMS);
      setState({
        kind: "available",
        version: latest,
        downloadUrl,
        ...(releaseNotes.length > 0 ? { releaseNotes } : {}),
      });
      hydrateReleaseNotes(latest, releaseNotes);
    } else {
      setState({ kind: "up-to-date", checkedAt: Date.now() });
    }
  } catch (error) {
    console.warn("[update] 수동 확인 실패(GitHub):", error instanceof Error ? error.message : String(error));
    setState({ kind: "error", message: friendlyUpdateError(error) });
  } finally {
    clearTimeout(timeout);
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
  if (updater) return;
  if (attachPromise) return attachPromise;
  attachPromise = (async () => {
    const { autoUpdater } = await import("electron-updater");
    updater = autoUpdater;
    autoUpdater.logger = { info: () => {}, debug: () => {}, warn: (m: unknown) => console.warn("[update]", m), error: (m: unknown) => console.warn("[update]", m) };
    autoUpdater.autoDownload = mode === "auto";
    autoUpdater.autoInstallOnAppQuit = mode === "auto" && prefs.enabled;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.on("update-available", (info) => {
      const releaseNotes = summarizeReleaseNotes(info.releaseNotes, RELEASE_NOTES_MAX_ITEMS);
      if (mode === "manual") {
        manualDownloadOwned = false;
        setState({
          kind: "available",
          version: info.version,
          downloadUrl: portableDownloadUrl(info.version),
          ...(releaseNotes.length > 0 ? { releaseNotes } : {}),
        });
      } else {
        manualDownloadOwned = manualCheckInFlight;
        setState({
          kind: "downloading",
          version: info.version,
          percent: 0,
          ...(releaseNotes.length > 0 ? { releaseNotes } : {}),
        });
      }
      hydrateReleaseNotes(info.version, releaseNotes);
    });
    autoUpdater.on("download-progress", (progress) => {
      if (state.kind !== "downloading") return;
      const percent = Math.max(0, Math.min(100, Math.round(progress.percent ?? 0)));
      if (state.percent === percent) return;
      setState({
        kind: "downloading",
        version: state.version,
        percent,
        ...(state.releaseNotes && state.releaseNotes.length > 0 ? { releaseNotes: state.releaseNotes } : {}),
      });
    });
    autoUpdater.on("update-not-available", () => {
      manualDownloadOwned = false;
      if (manualCheckInFlight || state.kind === "checking") {
        setState({ kind: "up-to-date", checkedAt: Date.now() });
      }
    });
    autoUpdater.on("update-downloaded", (info) => {
      manualDownloadOwned = false;
      const fromDownloaded = summarizeReleaseNotes(info.releaseNotes, RELEASE_NOTES_MAX_ITEMS);
      const fromDownloading = state.kind === "downloading" && state.version === info.version ? (state.releaseNotes ?? []) : [];
      // 내려받는 동안 밀린 판까지 모은 노트(제목 줄 있음)가 있으면 그것이 우선이다 — 피드 노트는 최신 한 판뿐이다.
      const releaseNotes = fromDownloading.some(isReleaseNoteHeading) ? fromDownloading : fromDownloaded.length > 0 ? fromDownloaded : fromDownloading;
      prefs.pending = { version: info.version, lines: releaseNotes.slice(0, WHATS_NEW_MAX_ITEMS) };
      writePrefs();
      setState({
        kind: "ready",
        version: info.version,
        ...(releaseNotes.length > 0 ? { releaseNotes } : {}),
      });
      hydrateReleaseNotes(info.version, releaseNotes);
      e2eNote("downloaded", { to: info.version });
      // e2e: install = 칩을 누른 것과 같다, quit = 칩을 안 누르고 앱을 끈 것과 같다(끌 때 설치).
      if (e2eLog()) {
        if (process.env.OPRN_UPDATE_E2E_ACTION === "quit") app.quit();
        else installAppUpdate();
      }
    });
    autoUpdater.on("error", (error) => {
      console.warn("[update] 오류:", error instanceof Error ? error.message : String(error));
      const reportToUser = manualCheckInFlight || manualDownloadOwned || state.kind === "checking";
      manualDownloadOwned = false;
      if (reportToUser) {
        setState({ kind: "error", message: friendlyUpdateError(error) });
      } else if (state.kind === "downloading") {
        setState({ kind: "idle" });
      }
    });
  })().catch((error) => {
    attachPromise = null;
    throw error;
  });
  return attachPromise;
}

/** 사용자가 직접 「업데이트 확인」을 눌렀을 때 실행한다. 자동 업데이트 토글과 무관하게 동작한다. */
export async function checkForAppUpdateNow(): Promise<AppUpdateStatus> {
  if (state.kind === "downloading") {
    manualDownloadOwned = true;
    return status();
  }
  if (installing || state.kind === "ready" || state.kind === "checking") {
    return status();
  }
  if (mode === "off") {
    await checkViaGithubRelease();
    return status();
  }
  try {
    await attachUpdater();
  } catch (error) {
    console.warn("[update] 업데이트 모듈을 읽지 못했습니다:", error);
    setState({ kind: "error", message: friendlyUpdateError(error) });
    return status();
  }
  if (!updater) {
    setState({ kind: "error", message: "업데이트 모듈을 초기화하지 못했어요." });
    return status();
  }
  manualCheckInFlight = true;
  setState({ kind: "checking" });
  try {
    await updater.checkForUpdates();
  } catch (error) {
    console.warn("[update] 수동 확인 실패:", error instanceof Error ? error.message : String(error));
    if (state.kind === "checking" || state.kind === "downloading") {
      setState({ kind: "error", message: friendlyUpdateError(error) });
    }
  } finally {
    manualCheckInFlight = false;
    if (state.kind === "checking") {
      setState({ kind: "up-to-date", checkedAt: Date.now() });
    }
  }
  return status();
}

/**
 * 받아 둔 판을 설치하고 다시 띄운다. 저장·조수 대기는 렌더러가 끝낸 뒤 부른다(칩 → update.install).
 * 창 닫기 저장 확인(main.ts closeWindows)은 건너뛴다 — isInstallingAppUpdate() 를 본다.
 */
export function installAppUpdate(): boolean {
  if (!updater || state.kind !== "ready" || installing) return false;
  installing = true;
  // 새 판은 이 실행의 process.env 를 물려받는다 — 이 실행이 쓴 워커·렌더러 경로를 떼야 새 판이 자기 경로를 찾는다.
  restoreLaunchEnv(process.env, launchEnv);
  e2eNote("install");
  // 설치 후 새 판을 띄운다. AppImage 는 새 파일을 바로 띄우므로 그 실행이 아직 이 실행의 한 번만 실행 잠금과 겹친다 —
  // 새 실행은 APPIMAGE_SILENT_INSTALL 표시를 보고 잠금이 풀릴 때까지 기다린다(boot.ts). app.relaunch 는 쓰지 않는다:
  // 마운트된(FUSE) 옛 바이너리에서 띄운 재실행 도우미는 옛 실행이 끝나며 마운트가 풀릴 때 같이 사라졌다(2026-11-24 CI).
  updater.quitAndInstall(true, true);
  return true;
}

export function isInstallingAppUpdate(): boolean {
  return installing;
}

export function registerAppUpdate(): void {
  mode = appUpdateModeFor({ platform: process.platform, isPackaged: app.isPackaged, env: process.env });
  prefs = readPrefs();
  adoptWhatsNew();
  // registerAppUpdate 는 startApp 이 워커·렌더러 경로를 정한 뒤에 불린다. e2e 는 새 판이 옛 판 경로를 물려받지 않았는지 본다.
  e2eNote("start", {
    mode,
    resourcesPath: process.resourcesPath,
    inherited: launchEnv,
    resolved: { rendererDir: process.env.OPRN_RENDERER_DIR ?? null, workerBin: process.env.OPRN_OH_MY_PI_WORKER_BIN ?? null },
  });

  ipcMain.handle(OPRN_CHANNELS.updateStatus, () => status());
  ipcMain.handle(OPRN_CHANNELS.updateCheck, () => checkForAppUpdateNow());
  ipcMain.handle(OPRN_CHANNELS.updateInstall, () => installAppUpdate());
  ipcMain.handle(OPRN_CHANNELS.updateOpenDownload, () => {
    if (state.kind === "available" && isSafeReleaseDownloadUrl(state.downloadUrl)) {
      void shell.openExternal(state.downloadUrl);
    }
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
