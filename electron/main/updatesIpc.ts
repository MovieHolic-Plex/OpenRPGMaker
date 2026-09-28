// electron/main/updatesIpc.ts
// 업데이트 컨트롤러(electron/main/updates.ts)를 electron 에 붙인다 — IPC·주기 확인·다시 시작.
//
// 업데이트 주소는 빌드할 때 박는다(scripts/build-electron.mjs 의 define __OPRN_UPDATE_URL__ ← 환경 변수
// OPRN_UPDATE_URL). 실행할 때 같은 이름의 환경 변수가 있으면 그것이 이긴다(시험·사내 미러용).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, ipcMain, net } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";
import { OPRN_RELEASES_URL, normalizeFeedUrl, normalizeReleasesUrl, type UpdateStatus } from "../shared/updates";
import { createUpdateController, type AutoUpdaterLike, type UpdateController } from "./updates";

declare const __OPRN_UPDATE_URL__: string | undefined;

/** 첫 확인은 창이 뜨고 조금 뒤에 한다 — 시작 화면 부팅과 네트워크를 다투지 않게. */
const FIRST_CHECK_DELAY_MS = 15_000;
/** 켜 둔 채로 쓰는 사람도 하루 안에 알게 한다. 릴리스가 하루 수십 번이어도 4시간이면 충분하다. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CHANNEL_FILE_BYTES = 64 * 1024;

function bakedFeedUrl(): string | undefined {
  return typeof __OPRN_UPDATE_URL__ === "string" ? __OPRN_UPDATE_URL__ : undefined;
}

/**
 * electron-updater 는 받은 파일 캐시 폴더 이름을 app-update.yml 에서 읽는다. 빌더가 publish 설정이 있을 때만
 * 그 파일을 패키지에 넣으므로, 실행 시 주소를 덮어쓴 빌드(OPRN_UPDATE_URL)에서는 없다. 그래서 우리가 쓴 파일을 준다.
 */
function writeUpdateConfig(feedUrl: string): string {
  const path = join(app.getPath("userData"), "oprn-app-update.yml");
  writeFileSync(path, `provider: generic\nurl: ${JSON.stringify(feedUrl)}\nupdaterCacheDirName: oprn-studio-updater\n`);
  return path;
}

async function fetchText(url: string): Promise<string> {
  const response = await net.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`업데이트 정보를 받지 못했습니다 (HTTP ${response.status})`);
  const text = await response.text();
  if (text.length > MAX_CHANNEL_FILE_BYTES) throw new Error("업데이트 정보 파일이 너무 큽니다");
  return text;
}

function broadcast(status: UpdateStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.updatesChanged, status);
  }
}

let controller: UpdateController | null = null;
let installing = false;

/** 업데이트를 적용하려고 창을 닫는 중인가. 그동안 «창이 다 닫히면 종료» 를 건너뛴다(main.ts). */
export function isInstallingUpdate(): boolean {
  return installing;
}

/**
 * 창을 모두 닫고(각 창의 flush-before-close 절차로 저장을 마친다) 나서 바꾼다.
 * 먼저 바꾸면 새 AppImage 가 옛 창이 아직 저장하는 동안 떠서 같은 project.sqlite 를 연다.
 */
async function closeAllWindows(): Promise<void> {
  await Promise.all(BrowserWindow.getAllWindows().map((window) => new Promise<void>((resolve) => {
    if (window.isDestroyed()) { resolve(); return; }
    window.once("closed", () => resolve());
    window.close();
  })));
}

export type RegisterUpdatesOptions = {
  /** 적용이 실패했을 때 창을 다시 연다 — 사용자가 창 없는 앱에 남지 않게. */
  readonly reopenWindow: () => void;
};

export function registerUpdates(options: RegisterUpdatesOptions): UpdateController {
  if (controller) return controller;
  const feedUrl = normalizeFeedUrl(process.env.OPRN_UPDATE_URL ?? bakedFeedUrl());
  const releasesUrl = normalizeReleasesUrl(process.env.OPRN_RELEASES_URL ?? OPRN_RELEASES_URL);
  const created = createUpdateController({
    platform: process.platform,
    packaged: app.isPackaged,
    forceDev: process.env.OPRN_UPDATE_FORCE_DEV === "1",
    appImagePath: process.env.APPIMAGE ?? null,
    feedUrl,
    releasesUrl,
    currentVersion: app.getVersion(),
    loadAutoUpdater: async () => {
      const { autoUpdater } = await import("electron-updater");
      autoUpdater.updateConfigPath = writeUpdateConfig(feedUrl!);
      return autoUpdater as unknown as AutoUpdaterLike;
    },
    fetchText,
    broadcast,
    log: (message) => console.log(`[updates] ${message}`),
  });
  controller = created;

  ipcMain.handle(OPRN_CHANNELS.updatesStatus, () => created.status());
  ipcMain.handle(OPRN_CHANNELS.updatesCheck, () => created.check());
  // 렌더러가 저장을 끝낸 뒤 부른다. 창 닫기 절차(flush-before-close)가 한 번 더 저장한다.
  ipcMain.handle(OPRN_CHANNELS.updatesInstall, async () => {
    if (installing || !created.canInstall()) return false;
    installing = true;
    let installed = false;
    try {
      await closeAllWindows();
      installed = created.installAndRelaunch();
      return installed;
    } catch (error) {
      console.error("[updates] 적용 실패:", error);
      return false;
    } finally {
      installing = false;
      // 성공하면 quitAndInstall 이 다음 틱에 종료한다. 실패하면 창을 다시 열어 작업을 이어 가게 한다.
      if (!installed && BrowserWindow.getAllWindows().length === 0) options.reopenWindow();
    }
  });

  if (created.mode === "auto" || created.mode === "manual") {
    const run = (): void => { void created.check(); };
    const first = setTimeout(run, FIRST_CHECK_DELAY_MS);
    const every = setInterval(run, CHECK_INTERVAL_MS);
    first.unref?.();
    every.unref?.();
  }
  return created;
}
