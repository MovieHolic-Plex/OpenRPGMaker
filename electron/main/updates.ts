// electron/main/updates.ts
// 데스크톱 업데이트 확인·받기·적용. 상태 모양은 electron/shared/updates.ts, 결정은
// openwiki/release-and-version.md 「앱 안 새 소식과 업데이트」.
//
// 세 갈래다.
//   auto      리눅스 AppImage. electron-updater 가 뒤에서 받고, 다시 시작하거나 종료할 때 바꾼다.
//   manual    윈도우 zip·서명 없는 맥·AppImage 밖 실행. 스스로 바꿀 수 없으니 새 버전만 알린다.
//             버전은 AppImage 와 같은 태그에서 나오는 latest-linux.yml 한 파일로 확인한다.
//   꺼짐      업데이트 주소 없이 만든 빌드(unconfigured)·패키지 안 된 개발 실행(dev).
//
// 이 모듈은 electron 을 직접 부르지 않는다 — 판단을 단위로 검증할 수 있게 의존성을 받는다(test/desktopUpdates.test.ts).
import {
  UPDATE_CHANNEL_FILE,
  isNewerVersion,
  parseChannelVersion,
  releaseTagUrl,
  type UpdateStatus,
} from "../shared/updates";

/** electron-updater 의 autoUpdater 중 여기서 쓰는 부분. */
export type AutoUpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  forceDevUpdateConfig: boolean;
  logger: unknown;
  setFeedURL(options: { provider: "generic"; url: string }): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: never[]) => void): unknown;
};

export type UpdateMode = "auto" | "manual" | "unconfigured" | "dev";

export type UpdateControllerDeps = {
  readonly platform: NodeJS.Platform;
  readonly packaged: boolean;
  /** 시험용으로 패키지 안 된 실행에서도 확인한다(OPRN_UPDATE_FORCE_DEV=1). */
  readonly forceDev?: boolean;
  /** AppImage 로 실행 중이면 그 파일 경로(환경 변수 APPIMAGE). */
  readonly appImagePath?: string | null;
  readonly feedUrl: string | null;
  readonly releasesUrl: string;
  readonly currentVersion: string;
  readonly loadAutoUpdater: () => Promise<AutoUpdaterLike>;
  readonly fetchText: (url: string) => Promise<string>;
  readonly broadcast: (status: UpdateStatus) => void;
  readonly log?: (message: string) => void;
  readonly now?: () => Date;
};

export type UpdateController = {
  readonly mode: UpdateMode;
  status(): UpdateStatus;
  check(): Promise<UpdateStatus>;
  /** 받아 둔 업데이트가 있는가(auto 에서만 true 가 될 수 있다). */
  canInstall(): boolean;
  /** 창을 모두 닫은 뒤 부른다. 바꾸고 새 버전을 띄운다. */
  installAndRelaunch(): boolean;
};

export function resolveUpdateMode(deps: Pick<UpdateControllerDeps, "platform" | "packaged" | "forceDev" | "appImagePath" | "feedUrl">): UpdateMode {
  if (!deps.feedUrl) return "unconfigured";
  if (!deps.packaged && !deps.forceDev) return "dev";
  return deps.platform === "linux" && deps.appImagePath ? "auto" : "manual";
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine || "알 수 없는 오류";
}

export function createUpdateController(deps: UpdateControllerDeps): UpdateController {
  const mode = resolveUpdateMode(deps);
  const releasesUrl = deps.releasesUrl;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  let current: UpdateStatus =
    mode === "unconfigured" || mode === "dev"
      ? { kind: "unavailable", reason: mode, releasesUrl }
      : { kind: "idle", checkedAt: null, releasesUrl };
  let inflight: Promise<UpdateStatus> | null = null;
  let updater: AutoUpdaterLike | null = null;
  // electron-updater 는 check 가 끝나기 전에 이벤트로 결과를 알린다. 그 check 가 풀릴 때 돌려줄 값을 맞추려고 둔다.
  let settle: ((status: UpdateStatus) => void) | null = null;
  // set() 이 current 를 바꾸므로 await 뒤에는 이 함수로 다시 읽는다(타입 좁히기가 옛 값을 믿지 않게).
  const latest = (): UpdateStatus => current;

  const set = (next: UpdateStatus): void => {
    // 받아 둔 업데이트는 뒤따르는 확인 실패로 지우지 않는다 — 다시 시작하면 여전히 적용된다.
    if (current.kind === "ready" && (next.kind === "error" || next.kind === "idle" || next.kind === "checking")) return;
    current = next;
    deps.broadcast(current);
    if (next.kind !== "checking" && next.kind !== "downloading" && settle) {
      const resolve = settle;
      settle = null;
      resolve(next);
    }
  };

  async function ensureUpdater(): Promise<AutoUpdaterLike> {
    if (updater) return updater;
    const loaded = await deps.loadAutoUpdater();
    loaded.autoDownload = true;
    loaded.autoInstallOnAppQuit = true;
    loaded.allowPrerelease = false;
    loaded.allowDowngrade = false;
    // 패키지 안 된 실행(시험)에서는 electron-updater 가 확인을 건너뛴다. 강제 스위치일 때만 켠다.
    loaded.forceDevUpdateConfig = !deps.packaged && Boolean(deps.forceDev);
    loaded.logger = { info: log, warn: log, error: log, debug: () => {} };
    loaded.setFeedURL({ provider: "generic", url: deps.feedUrl! });
    loaded.on("checking-for-update", () => set({ kind: "checking", releasesUrl }));
    loaded.on("update-not-available", () => set({ kind: "idle", checkedAt: now().toISOString(), releasesUrl }));
    loaded.on("update-available", ((info: { version?: string }) => {
      set({ kind: "downloading", version: String(info?.version ?? ""), percent: 0, releasesUrl });
    }) as (...args: never[]) => void);
    loaded.on("download-progress", ((progress: { percent?: number }) => {
      if (current.kind !== "downloading") return;
      const percent = Math.max(0, Math.min(100, Math.round(Number(progress?.percent ?? 0))));
      if (percent !== current.percent) set({ ...current, percent });
    }) as (...args: never[]) => void);
    loaded.on("update-downloaded", ((info: { version?: string }) => {
      set({ kind: "ready", version: String(info?.version ?? ""), releasesUrl });
    }) as (...args: never[]) => void);
    loaded.on("error", ((error: unknown) => {
      log(`[updates] ${errorMessage(error)}`);
      set({ kind: "error", message: errorMessage(error), releasesUrl });
    }) as (...args: never[]) => void);
    updater = loaded;
    return loaded;
  }

  async function checkAuto(): Promise<UpdateStatus> {
    const instance = await ensureUpdater();
    // 이미 받는 중·받아 둔 상태에서 다시 확인하면 electron-updater 가 같은 파일을 또 받는다. 지금 상태를 그대로 돌려준다.
    if (current.kind === "downloading" || current.kind === "ready") return current;
    const settled = new Promise<UpdateStatus>((resolve) => { settle = resolve; });
    set({ kind: "checking", releasesUrl });
    try {
      const result = await instance.checkForUpdates();
      // 주소 설정이 틀려 업데이터가 조용히 null 을 돌려주는 경우 — 이벤트가 오지 않는다.
      if (result == null && settle) set({ kind: "idle", checkedAt: now().toISOString(), releasesUrl });
    } catch (error) {
      set({ kind: "error", message: errorMessage(error), releasesUrl });
    }
    const after = latest();
    return after.kind === "downloading" ? after : settled;
  }

  async function checkManual(): Promise<UpdateStatus> {
    set({ kind: "checking", releasesUrl });
    try {
      const yml = await deps.fetchText(`${deps.feedUrl}/${UPDATE_CHANNEL_FILE}`);
      const version = parseChannelVersion(yml);
      if (!version) throw new Error(`${UPDATE_CHANNEL_FILE} 에 version 이 없습니다`);
      if (isNewerVersion(version, deps.currentVersion)) {
        set({ kind: "manual", version, downloadUrl: releaseTagUrl(releasesUrl, version), releasesUrl });
      } else {
        set({ kind: "idle", checkedAt: now().toISOString(), releasesUrl });
      }
    } catch (error) {
      set({ kind: "error", message: errorMessage(error), releasesUrl });
    }
    return current;
  }

  return {
    mode,
    status: () => current,
    check() {
      if (mode === "unconfigured" || mode === "dev") return Promise.resolve(current);
      if (inflight) return inflight;
      inflight = (mode === "auto" ? checkAuto() : checkManual()).finally(() => { inflight = null; });
      return inflight;
    },
    canInstall: () => mode === "auto" && current.kind === "ready" && updater !== null,
    installAndRelaunch() {
      if (mode !== "auto" || current.kind !== "ready" || !updater) return false;
      // isSilent=true, isForceRunAfter=true — 새 AppImage 로 바꾼 뒤 바로 띄운다.
      updater.quitAndInstall(true, true);
      return true;
    },
  };
}
