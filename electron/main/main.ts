import { mainMark } from "./startupTiming";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { startLocalProjectServer, type LocalProjectServer } from "../serve/runtime";
import { normalizeTeamUrl } from "../serve/localNetwork";
import { join, resolve } from "node:path";
import { BrowserWindow, Menu, app, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { OPRN_APP_SCHEME, OPRN_CHANNELS } from "../shared/channels";
import { folderSwitchFlushOk, isAppRendererFrame } from "../shared/folderSwitch";
import { isWindowControlAction, windowChromeFor, type WindowState } from "../shared/windowControl";
import { registerIpcHandlers } from "./ipc";
import { registerAssetBrowser } from "./assetBrowser";
import { acceptStoreDeepLink, registerAssetStore } from "./assetStore";
import { findStoreDeepLinkArg } from "../../src/assetStore/deepLink";
import { electronUserArgIndex, inspectCliProjectArgs, inspectCurrentCliProject, projectDirFromOpenPath } from "./cliProject";
import { decideWindowClose, nextQuitHeld, shouldRetryQuit } from "./closeFlow";
import { planWindowReload } from "../shared/reloadFlow";
import { chosenDirectory, directoryDialogParent, directoryDialogProperties, pickAppWindow } from "./directoryDialog";
import { registerAppProtocol, registerAssetProtocol } from "./protocols";
import { captureLastViewBeforeClose, forgetLastViewWindow, markEditorLeft, markEditorSettled, readLastView, scheduleLastViewAfterSave } from "./lastView";
import { firstShowSteps } from "./windowShow";
import { SessionConsumerClosed, createProjectSessionRegistry } from "./sessions";
import { startCompanionServer, type CompanionServer } from "./companion";
import { acceptMenuFolder, prepareNewProjectDir } from "./newProjectDir";
import { describeRecentProjects, listRecentTeams, recentProjectCoverSource, rememberRecentProject, rememberRecentTeam, suggestProjectDir, writeRecentProjectCover } from "./recent";
import { openTeamWindow } from "./teamWindow";
import type { Splash } from "./splash";
import { peekPendingProjectDir, rendererDirectory, takePendingOpenFiles, windowIconPath, type BootContext, type SecondInstanceLaunch } from "./bootContext";
import type { JoinTeamResult } from "../shared/start";
import { TEAM_COLLAB_ENABLED } from "../shared/teamCollab";

// 앱 본체(dist-electron/app.cjs). 시작 입구 boot.ts(dist-electron/main.cjs)가 app ready 뒤 스플래시를 띄우고 이 파일을 읽어
// startApp 을 부른다. ready 전에 해야 하는 일(스킴 권한·한 번만 실행·링크 받아 두기)은 입구에 있다.

// ── 「에디터에서 열기」 링크(oprn://store/install?…) ─────────────────────────────
// 판정은 src/assetStore/deepLink.ts(순수), 받은 뒤 처리는 assetStore.ts 의 acceptStoreDeepLink. openwiki/asset-store.md.
const DEEP_LINK_SCHEME = "oprn";

/** OS 에 oprn: 처리기로 등록한다. 개발 실행은 OPRN_REGISTER_PROTOCOL=1 일 때만(개발 빌드가 사용자 등록을 빼앗지 않게). */
function registerDeepLinkProtocol(): void {
  try {
    if (!process.defaultApp) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    else if (process.env.OPRN_REGISTER_PROTOCOL === "1" && process.argv[1]) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [resolve(process.argv[1])]);
    }
  } catch (error) {
    console.warn("[store-link] oprn: 링크 처리기를 등록하지 못했습니다:", error);
  }
}

mainMark("modulesEvaluated");
const sessions = createProjectSessionRegistry();
const hosting = new Set<string>();
const teamHosts = new Map<string, LocalProjectServer>();
let companionServer: CompanionServer | null = null;
/** 첫 실행 스플래시. 부팅 중에 두 번째 실행이 프로젝트를 열면 시작 화면 신호를 기다리지 않고 닫는다. */
let activeSplash: Splash | undefined;
const rendererDir = rendererDirectory();
const windowIcon = windowIconPath(rendererDir);
/** 팀 호스트 포트. 앱을 다시 켜도 팀원이 받은 주소가 그대로 맞도록 고정 범위에서 먼저 찾는다. */
/** @deprecated multi-user team collaboration is not supported yet (2026-10-21). 「팀 협업 시작」이 LAN 에 여는 포트. */
const TEAM_HOST_PORTS = [9840, 9841, 9842, 9843, 9844, 9845, 9846, 9847, 9848, 9849];

const closing = new Set<number>();
const closeTimers = new Map<number, ReturnType<typeof setTimeout>>();
/** 편집기가 새로고침 저장 리스너를 붙인 창. 그 전에는 메모리 편집이 없다. */
const flushReady = new Set<number>();
/** 보기 메뉴·개발자 도구 새로고침을 위해 저장 중인 창. 값은 캐시를 무시할지. */
const reloadFlushing = new Map<number, "soft" | "hard">();
const reloadTimers = new Map<number, ReturnType<typeof setTimeout>>();
/** 저장을 마친 직후의 reload() 만, 다른 beforeunload(미적용 초안)가 새로고침을 삼키지 않게 한다. */
const reloadArmed = new Set<number>();
/** 렌더러가 미저장이라 이번 새로고침을 막았다. will-prevent-unload 한 번만 소비한다. */
const unsavedReloadBlock = new Set<number>();
/** 이번 새로고침이 캐시를 무시하는지. 저장이 끝난 뒤의 reload() 까지 유지한다. */
const reloadHard = new Set<number>();
/**
 * 사용자가 Quit 을 요청했다. 프로젝트 창이 저장 때문에 close 를 막으면 Electron 이 종료를 취소하므로
 * (app.quit 문서), 그 저장이 끝난 뒤에 다시 건다. 마지막 창을 그냥 닫는 것과는 다르다 — macOS 는 그때 앱이 남는다.
 */
let quitRequested = false;
/** 열린 프로젝트의 저장이 Quit 을 한 번 막았다. 막을 일이 없었으면(시작 화면) 다시 종료하지 않는다. */
let quitHeld = false;

function destroyWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  const id = window.webContents.id;
  const timer = closeTimers.get(id);
  if (timer) clearTimeout(timer);
  closeTimers.delete(id);
  window.destroy();
}

function abandonReloadFlush(id: number): void {
  reloadFlushing.delete(id);
  const timer = reloadTimers.get(id);
  if (timer) clearTimeout(timer);
  reloadTimers.delete(id);
  unsavedReloadBlock.delete(id);
  reloadArmed.delete(id);
}

const RELOAD_BLOCKED_MESSAGE = "저장하지 못해 새로고침하지 않았습니다.";
const RELOAD_BLOCKED_DETAIL = "방금 한 편집이 아직 디스크에 없습니다. 저장이 끝난 뒤 다시 시도해 주세요.";

function performReload(window: BrowserWindow, hard: boolean): void {
  if (window.isDestroyed()) return;
  const id = window.webContents.id;
  // beforeunload 답은 reload() 가 돌아온 뒤에 온다. 막히면 will-prevent-unload 가 이 집합을 본다.
  reloadArmed.add(id);
  if (hard) reloadHard.add(id);
  else reloadHard.delete(id);
  if (hard) window.webContents.reloadIgnoringCache();
  else window.webContents.reload();
  // 이동이 취소되고 이벤트도 없으면 다음 막힘을 통과시키지 않는다.
  setTimeout(() => { reloadArmed.delete(id); }, 10_000);
}

/** 보기 → 새로고침, 그리고 개발자 도구가 막힌 새로고침. 저장이 안전하지 않으면 창을 그대로 둔다. */
function beginReloadFlush(window: BrowserWindow, hard: boolean, becauseDirty = false): void {
  if (window.isDestroyed()) return;
  const id = window.webContents.id;
  const plan = planWindowReload({
    hasSession: sessions.get(id) !== null,
    flushListenerReady: flushReady.has(id),
    closeFlushInProgress: closing.has(id),
    reloadFlushInProgress: reloadFlushing.has(id),
  });
  if (plan === "ignore") return;
  if (hard) reloadHard.add(id);
  else reloadHard.delete(id);
  if (plan === "reload-now") {
    // 미저장인데 저장 리스너·세션이 없으면 바로 새로고침하지 않는다. 그러면 편집이 사라진다.
    if (becauseDirty) {
      void dialog.showMessageBox(window, { type: "warning", message: RELOAD_BLOCKED_MESSAGE, detail: RELOAD_BLOCKED_DETAIL }).catch((error: unknown) => {
        console.warn("[project] 새로고침 안내를 띄우지 못했습니다:", error);
      });
      return;
    }
    performReload(window, hard);
    return;
  }
  reloadFlushing.set(id, hard ? "hard" : "soft");
  window.webContents.send(OPRN_CHANNELS.lifecycleFlushBeforeReload);
  reloadTimers.set(id, setTimeout(() => {
    if (!reloadFlushing.has(id)) return;
    abandonReloadFlush(id);
    if (window.isDestroyed() || closing.has(id)) return;
    void dialog.showMessageBox(window, { type: "warning", message: RELOAD_BLOCKED_MESSAGE, detail: RELOAD_BLOCKED_DETAIL }).catch((error: unknown) => {
      console.warn("[project] 새로고침 안내를 띄우지 못했습니다:", error);
    });
  }, CLOSE_FLUSH_TIMEOUT_MS));
}

function retryQuitIfFlushHeldIt(): void {
  const pending = (): boolean => shouldRetryQuit({ quitRequested, quitHeld, windowsStillFlushing: closing.size });
  if (!pending()) return;
  // 같은 종료에서 다른 창의 close 가 이 핸들러보다 늦게 올 수 있다. 한 틱 뒤에, 아직 저장 중인 창이 없을 때만 다시 건다.
  setTimeout(() => { if (pending()) app.quit(); }, 0);
}

/**
 * 닫기 저장을 기다리는 상한. 큰 프로젝트를 새 빌드로 처음 연 직후의 자동 저장(부팅 정규화 결과 + 표식)은 렌더러 준비만 10초를 넘는다
 * (2026-10-20 실측, 71MB: 정착 뒤 저장 완료까지 16초). 예전 상한 10초는 그 저장을 끊어 버려 — 다음 실행이 또 «첫 부팅»(+10~15초)이
 * 되고 저장 중이던 변경도 잃었다. 창은 닫는 즉시 숨기므로 사용자는 기다리지 않는다.
 */
const CLOSE_FLUSH_TIMEOUT_MS = 60_000;

/** 편집기가 파일 메뉴의 폴더 교체 저장을 받을 수 있다. 문서를 떠나면 지운다. createWindow 보다 위에 둔다. */
const replaceFlushReady = new Set<number>();
/** 그 저장의 보고를 기다리는 창. */
const replaceFlushWaiters = new Map<number, (payload: unknown) => void>();
/** 같은 창에서 폴더 대화상자를 두 번 열지 않는다. */
const folderSwitching = new Set<number>();

// 닫기는 flush → ack → destroy 다(설계서 7.3). 렌더러가 상한 안에 flush-done 을 부르지 않으면 강제로 닫는다.
// 저장을 기다리는 동안의 두 번째 close 는 막는다(closeFlow.ts). 막지 않으면 연타·Quit 이 저장을 끊는다.
function installCloseFlow(window: BrowserWindow): void {
  const id = window.webContents.id;
  window.on("close", (event) => {
    const session = sessions.get(id);
    const decision = decideWindowClose(closing.has(id), session !== null);
    if (decision === "allow") return;
    event.preventDefault();
    quitHeld = nextQuitHeld(quitHeld, quitRequested, decision);
    if (decision === "hold") return;
    // 새로고침 저장이 진행 중이면 그 저장은 닫기로 넘긴다. 끝나자마자 페이지를 다시 열지 않는다.
    abandonReloadFlush(id);
    // flush 는 세션이 있을 때만 나온다. 없으면 닫기를 막아 둔 채 두면 창이 남지 않게 바로 없앤다.
    if (session === null) { destroyWindow(window); return; }
    closing.add(id);
    window.webContents.send(OPRN_CHANNELS.lifecycleFlushBeforeClose);
    closeTimers.set(id, setTimeout(() => destroyWindow(window), CLOSE_FLUSH_TIMEOUT_MS));
    // 저장이 끝날 때까지 창을 잡아 두되 화면에서는 곧 치운다 — 숨기기 전에 마지막 편집 화면을 찍는다(상한 250ms, lastView.ts).
    // 다음 실행에서 이 프로젝트를 열면 편집기가 부팅하는 동안 이 그림이 바로 보인다.
    void captureLastViewBeforeClose(window, session.projectDir).finally(() => { if (!window.isDestroyed()) window.hide(); });
  });
  window.on("closed", () => {
    forgetLastViewWindow(id);
    abandonReloadFlush(id);
    flushReady.delete(id);
    reloadHard.delete(id);
    closing.delete(id);
    const timer = closeTimers.get(id);
    if (timer) clearTimeout(timer);
    closeTimers.delete(id);
    sessions.close(id);
    retryQuitIfFlushHeldIt();
  });
}

/** 창의 네이티브 상태. 전체화면이 최대화를 덮으므로 둘은 따로 보낸다. */
function windowStateOf(window: BrowserWindow): WindowState {
  return { fullscreen: window.isFullScreen(), maximized: window.isMaximized() };
}

/**
 * 제목줄 방식. Windows·Linux 는 OS 제목줄을 빼고 렌더러가 최소화·최대화·전체화면·닫기 단추를 그린다
 * (전체화면 전환까지 한 줄에 두려면 titleBarOverlay 로는 안 된다 — openwiki/desktop-window-controls.md).
 * macOS 는 신호등을 왼쪽 위에 남기고 제목줄만 숨긴다(오른쪽에 단추를 또 그리지 않는다).
 */
const chrome = windowChromeFor(process.platform);
const chromeOptions: Electron.BrowserWindowConstructorOptions = chrome.drawsOwnButtons
  ? { frame: false }
  : { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 16 } };

/** 시작 화면 창이 첫 카드를 그렸다고 알리면 부를 것(webContents id → 보이기). */
const revealOnStartReady = new Map<number, () => void>();
/** 시작 화면이 신호를 못 보내도(옛 렌더러·오류) 첫 페인트 뒤 이만큼 지나면 창을 보인다. */
const START_READY_FALLBACK_MS = 6_000;

/** createWindow 로 만든 앱 창. 스플래시(data: 문서)는 여기 없다. */
const appWindows = new Set<BrowserWindow>();
/** 파일 메뉴가 스플래시·팀 창에 붙지 않도록, 마지막으로 앞에 있던 앱 창. */
let lastAppWindow: BrowserWindow | null = null;
/** 명령줄·macOS open-file 로 이 창에 연 프로젝트. QA 의 OPRN_OPEN_PROJECT_DIR 와 따로 둔다(그 변수는 잠금을 끈다). */
const explicitProjectDir = new WeakMap<BrowserWindow, string>();
/** 한 번이라도 처음 보이기(전체화면)를 탄 창. 사용자가 전체화면에서 나온 뒤 다시 앞으로 가져올 때 전체화면을 켜지 않는다. */
const presentedWindows = new WeakSet<BrowserWindow>();

/** 숨겨 둔 창을 처음 보인다. 순서는 windowShow.ts — 맥은 보인 뒤 전체화면, 그 밖은 전체화면 뒤 보이기. */
function presentAppWindow(window: BrowserWindow): void {
  if (window.isDestroyed() || presentedWindows.has(window)) return;
  presentedWindows.add(window);
  for (const step of firstShowSteps(process.platform)) {
    if (window.isDestroyed()) return;
    if (step === "fullscreen") window.setFullScreen(true);
    else window.show();
  }
}

function opensStartScreen(projectDir: string | undefined): boolean {
  return process.env.OPRN_SMOKE_PAGE === undefined && projectDir === undefined && process.env.OPRN_OPEN_PROJECT_DIR === undefined;
}

function bootProjectDirOf(window: BrowserWindow): string | undefined {
  return explicitProjectDir.get(window) ?? process.env.OPRN_OPEN_PROJECT_DIR;
}

function isStartScreenBoot(window: BrowserWindow): boolean {
  return process.env.OPRN_SMOKE_PAGE === undefined && bootProjectDirOf(window) === undefined && sessions.get(window.webContents.id) === null;
}

function warnIgnoredCliPaths(ignored: readonly string[]): void {
  for (const path of ignored) console.warn(`[project] 명령줄 경로를 열지 않았습니다 (project.sqlite 가 있는 폴더가 아님): ${path}`);
}

function safeRealpath(dir: string): string {
  try { return realpathSync(dir); } catch { return resolve(dir); }
}

/**
 * 창을 만든다. 처음 뜨는 창은 스플래시(splash.ts)와 짝을 이룬다 — 숨긴 채 준비하고, 시작 화면이 첫 카드를 그렸다고 알리면
 * 보이며 스플래시를 닫는다. 그 전에 문서를 못 불러오면 스플래시가 오류를 보인다. 스플래시가 없는 창(두 번째 창·QA 진입점)은
 * 예전처럼 첫 페인트(ready-to-show)에 보인다. deferLoad 면 문서는 loadWindowContent 로 따로 싣는다(앱 시작 때 창 객체만 먼저 만든다).
 */
function createWindow(options: { readonly splash?: () => Splash | undefined; readonly deferLoad?: boolean; readonly projectDir?: string } = {}): BrowserWindow {
  const splash = (): Splash | undefined => options.splash?.();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 600,
    show: false,
    // 창 크기가 바뀌는 순간에 다른 색이 비치지 않게 문서 바탕색과 맞춘다 — 시작 화면은 어두운 #111214(startScreen.css),
    // 편집기는 tokens.css --bg-base.
    backgroundColor: opensStartScreen(options.projectDir) ? "#111214" : "#F7F8F8",
    // 전체화면은 보일 때 켠다 — 리눅스는 생성자에서 fullscreen 을 주면 show:false 여도 창을 바로 띄워(빈 화면이 스플래시를 덮었다).
    fullscreen: false,
    autoHideMenuBar: true,
    ...chromeOptions,
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
  const id = window.webContents.id;
  if (options.projectDir) explicitProjectDir.set(window, options.projectDir);
  appWindows.add(window);
  lastAppWindow = window;
  window.on("focus", () => { lastAppWindow = window; });

  let shown = false;
  /** 스플래시에 오류를 띄웠다 — 「다시 시도」 전에는 대체 타이머가 빈 창을 보이지 않는다. */
  let failed = false;
  const reveal = (reason: string): void => {
    if (shown || failed || window.isDestroyed()) return;
    shown = true;
    revealOnStartReady.delete(id);
    // 두 번째 실행·open-file 이 이미 이 창을 앞으로 가져왔으면 전체화면을 다시 켜지 않는다.
    if (!presentedWindows.has(window)) {
      presentAppWindow(window);
      mainMark("windowShown");
      if (process.env.OPRN_STARTUP_TRACE === "1") process.stderr.write(`[startup] window shown (${reason})\n`);
    }
    splash()?.close();
  };
  const fail = (detail: string): void => {
    const current = splash();
    if (shown || !current?.open()) return;
    failed = true;
    current.fail(detail);
  };
  // ready-to-show 는 렌더러가 첫 프레임을 그린 뒤에 온다(창마다 한 번). 스플래시가 있으면 시작 화면이 카드를 그릴 때까지 더 기다린다.
  window.once("ready-to-show", () => {
    mainMark("firstPaint");
    if (!splash()?.open()) reveal("first-paint");
  });
  if (options.splash) {
    revealOnStartReady.set(id, () => reveal("start-screen-ready"));
    // 「다시 시도」로 다시 싣는 경우까지 — 문서를 다 받은 뒤 신호가 끝내 안 오면(옛 렌더러·시작 화면 오류) 그래도 창을 보인다.
    window.webContents.on("did-finish-load", () => {
      setTimeout(() => reveal("fallback-timeout"), START_READY_FALLBACK_MS);
    });
    // 아직 숨어 있을 때 문서를 못 불러오거나 렌더러가 죽으면 빈 화면 대신 스플래시에 오류를 보인다.
    window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3 = 다른 이동으로 취소됨(정상)
      fail(`${description || "load failed"} (${code})\n${url}`);
    });
    // app:// 이 문서를 못 찾으면(빌드 누락·손상) did-fail-load 없이 오류 응답을 그린다 — 응답 코드로 잡는다.
    window.webContents.on("did-navigate", (_event, url, httpResponseCode, httpStatusText) => {
      if (httpResponseCode >= 400) fail(`${httpResponseCode} ${httpStatusText}\n${url}`);
    });
    window.webContents.on("render-process-gone", (_event, details) => fail(`renderer ${details.reason} (exit ${details.exitCode})`));
    window.webContents.on("preload-error", (_event, _path, error) => fail(`preload: ${error.message}`));
    window.webContents.on("did-start-loading", () => { failed = false; });
  }
  // F11·보기 메뉴 등 버튼 밖에서도 전체화면이 바뀐다 — 렌더러가 아이콘 상태를 맞출 수 있게 알린다.
  const broadcastFullscreen = (fullscreen: boolean): void => {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.windowFullscreen, fullscreen);
  };
  const broadcastState = (): void => {
    if (!window.isDestroyed()) window.webContents.send(OPRN_CHANNELS.windowState, windowStateOf(window));
  };
  window.on("enter-full-screen", () => { broadcastFullscreen(true); broadcastState(); });
  window.on("leave-full-screen", () => { broadcastFullscreen(false); broadcastState(); });
  // 최대화·복원은 단추 밖(제목줄 더블클릭·키보드 단축키·창 관리자)에서도 일어난다.
  window.on("maximize", broadcastState);
  window.on("unmaximize", broadcastState);
  window.on("restore", broadcastState);
  window.on("minimize", broadcastState);
  window.on("closed", () => {
    revealOnStartReady.delete(id);
    replaceFlushReady.delete(id);
    appWindows.delete(window);
    explicitProjectDir.delete(window);
    if (lastAppWindow === window) lastAppWindow = null;
  });
  // 문서를 떠나면(시작 화면 ↔ 편집기·새로고침) 다시 «부팅을 마쳤다» 신호가 올 때까지 찍지 않는다.
  window.webContents.on("did-start-navigation", (details) => {
    if (!details.isMainFrame || details.isSameDocument) return;
    markEditorLeft(id);
    // 새 문서는 리스너를 다시 붙일 때까지 메모리 편집이 없다.
    flushReady.delete(id);
    reloadArmed.delete(id);
    reloadHard.delete(id);
  });
  // 개발자 도구의 새로고침은 메뉴를 타지 않는다. 렌더러가 미저장으로 막으면 저장한 뒤 다시 연다.
  // 저장을 마친 reload() 가 다른 beforeunload(미적용 초안)에 막히면 그 새로고침은 그대로 진행한다.
  window.webContents.on("will-prevent-unload", (event) => {
    const webContentsId = window.webContents.id;
    if (unsavedReloadBlock.has(webContentsId)) {
      const hard = reloadHard.has(webContentsId);
      unsavedReloadBlock.delete(webContentsId);
      reloadArmed.delete(webContentsId);
      beginReloadFlush(window, hard, true);
      return;
    }
    if (!reloadArmed.has(webContentsId)) return;
    reloadArmed.delete(webContentsId);
    event.preventDefault();
  });
  // 폴더 교체 저장도 새 문서가 준비됐다고 알릴 때까지 기다리지 않는다 — 부팅 중에는 저장할 변경이 없다.
  window.webContents.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      markEditorLeft(id);
      replaceFlushReady.delete(id);
    }
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${OPRN_APP_SCHEME}://`)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  installCloseFlow(window);
  if (!options.deferLoad) loadWindowContent(window);
  return window;
}

/**
 * 이 창의 프로젝트 세션. 여는 중에 창이 닫히면 null — 스토어는 레지스트리가 닫는다.
 * 죽은 webContents 에 SQLite 를 붙이면 파일 잠금이 앱이 꺼질 때까지 남는다.
 */
async function openWindowSession(webContentsId: number, projectDir: string) {
  try {
    return await sessions.open(webContentsId, projectDir);
  } catch (error) {
    if (error instanceof SessionConsumerClosed) return null;
    throw error;
  }
}

/** 창에 첫 문서를 싣는다 — 시작 화면, QA 진입점(OPRN_SMOKE_PAGE·OPRN_OPEN_PROJECT_DIR), 명령줄 폴더, 또는 편집기. */
function loadWindowContent(window: BrowserWindow): void {
  // QA 하니스용 진입점(OPRN_SMOKE_PAGE·OPRN_RENDERER_DIR 와 같은 계열): 폴더를 주면 시작 화면을
  // 건너뛰고 그 폴더를 연 채로 편집기를 띄운다. GUI 폴더 선택 대화상자를 자동화할 수 없어서
  // "앱이 폴더를 열고 편집기로 들어간다" 를 헤드리스에서 확인할 유일한 길이다.
  // 명령줄 폴더(explicitProjectDir)도 같은 순서로 연다. 세션을 연 뒤에 문서를 다시 실어야
  // 편집기 부팅이 빈 세션을 보지 않는다.
  const bootProjectDir = bootProjectDirOf(window);
  const openedByCli = explicitProjectDir.has(window);
  const startScreen = isStartScreenBoot(window);
  const smokePage = process.env.OPRN_SMOKE_PAGE;
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (smokePage) void window.loadFile(smokePage);
  else if (startScreen) void window.loadURL(`${OPRN_APP_SCHEME}://oprn/start-screen.html`);
  else if (devServerUrl) void window.loadURL(devServerUrl);
  else void window.loadURL(`${OPRN_APP_SCHEME}://oprn/index.html`);
  if (bootProjectDir !== undefined) {
    const webContentsId = window.webContents.id;
    void openWindowSession(webContentsId, bootProjectDir).then((session) => {
      if (!session || window.isDestroyed()) {
        if (session) sessions.close(webContentsId);
        explicitProjectDir.delete(window);
        if (!session && !window.isDestroyed() && !smokePage) void window.loadURL(`${OPRN_APP_SCHEME}://oprn/start-screen.html`);
        return;
      }
      if (openedByCli) rememberRecentProject(session.projectDir, session.store.info().title ?? session.projectDir);
      if (devServerUrl) void window.loadURL(devServerUrl);
      else void window.loadURL(`${OPRN_APP_SCHEME}://oprn/index.html`);
    }).catch((error: unknown) => {
      console.warn("[project] 폴더를 열지 못했습니다:", error);
      explicitProjectDir.delete(window);
      if (window.isDestroyed() || smokePage) return;
      void window.loadURL(`${OPRN_APP_SCHEME}://oprn/start-screen.html`);
    });
  }
}

/** 렌더러 문서 주소. 개발 중에는 dev 서버, 배포는 app:// 다. */
function rendererEntryUrl(): string {
  return process.env.ELECTRON_RENDERER_URL ?? `${OPRN_APP_SCHEME}://oprn/index.html`;
}

/** 폴더를 이 창의 세션으로 열고 편집기 문서로 넘긴다. 파일 메뉴가 쓰는 경로. */
async function adoptFolder(window: BrowserWindow, projectDir: string, title?: string): Promise<void> {
  const webContentsId = window.webContents.id;
  const session = await openWindowSession(webContentsId, projectDir);
  if (!session || window.isDestroyed()) {
    if (session) sessions.close(webContentsId);
    return;
  }
  rememberRecentProject(projectDir, title ?? session.store.info().title ?? projectDir);
  void window.loadURL(rendererEntryUrl());
}

function dismissSplash(): void {
  activeSplash?.close();
  activeSplash = undefined;
}

function focusAppWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  // 스플래시 뒤에 숨은 창은 아직 전체화면이 아니다. 그냥 show 하면 창 모드로 뜨고, 6초 뒤 폴백이 전체화면으로 튀긴다.
  if (!presentedWindows.has(window)) {
    presentAppWindow(window);
    mainMark("windowShown");
  } else window.show();
  window.focus();
}

function windowAlreadyOpening(projectDir: string): BrowserWindow | null {
  const resolved = safeRealpath(projectDir);
  for (const window of appWindows) {
    if (window.isDestroyed()) continue;
    const open = sessions.get(window.webContents.id)?.projectDir;
    const pending = explicitProjectDir.get(window);
    if ((open && safeRealpath(open) === resolved) || (pending && safeRealpath(pending) === resolved)) return window;
  }
  return null;
}

/** 아직 프로젝트가 없는 시작 화면 창. 명령줄로 연 폴더를 여기 얹는다. */
function idleStartWindow(): BrowserWindow | null {
  for (const window of appWindows) {
    if (window.isDestroyed()) continue;
    if (sessions.get(window.webContents.id) !== null) continue;
    if (explicitProjectDir.has(window)) continue;
    return window;
  }
  return null;
}

/** 두 번째 실행·macOS open-file 이 넘긴 프로젝트. 같은 폴더가 이미 있으면 그 창을 앞으로 가져온다. */
async function openProjectFromCli(projectDir: string): Promise<void> {
  const resolved = safeRealpath(projectDir);
  const existing = windowAlreadyOpening(resolved);
  if (existing) { dismissSplash(); focusAppWindow(existing); return; }
  console.log(`[project] 폴더를 엽니다: ${resolved}`);
  dismissSplash();
  const idle = idleStartWindow();
  if (idle) {
    explicitProjectDir.set(idle, resolved);
    focusAppWindow(idle);
    try { await adoptFolder(idle, resolved); }
    catch (error) {
      explicitProjectDir.delete(idle);
      console.warn("[project] 명령줄 폴더를 열지 못했습니다:", error);
    }
    return;
  }
  createWindow({ projectDir: resolved });
}

function focusedWindow(): BrowserWindow | null {
  return pickAppWindow({
    focused: BrowserWindow.getFocusedWindow(),
    lastFocused: lastAppWindow,
    windows: [...appWindows],
    isAppWindow: (window) => appWindows.has(window),
    isDestroyed: (window) => window.isDestroyed(),
  });
}

/**
 * 폴더 선택 창. 살아 있는 앱 창이 있으면 그 창에 붙여 전체화면 뒤로 숨지 않게 한다.
 * 고른 경로만 돌려주고, 취소면 null.
 */
function askForDirectory(owner: BrowserWindow | null, title: string, createDirectory = false): Promise<string | null> {
  const parent = directoryDialogParent(owner);
  const options = { title, properties: directoryDialogProperties(createDirectory) };
  const pending = parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options);
  return pending.then(chosenDirectory);
}

function trustedRendererSender(event: {
  readonly senderFrame: { readonly url: string; readonly parent?: unknown } | null;
  readonly sender: { getURL(): string };
}): boolean {
  // 하위 프레임은 거절한다. 메인 프레임의 parent 는 없고, 프레임 정보가 없으면 보낸 문서 주소로 본다.
  if (event.senderFrame && event.senderFrame.parent != null) return false;
  const url = event.senderFrame?.url || event.sender.getURL();
  return isAppRendererFrame(url, process.env.ELECTRON_RENDERER_URL);
}

type FolderSwitchFlush = "ok" | "blocked" | "timeout" | "closed" | "skip";

/**
 * 이 창에 열린 프로젝트가 있고 편집기가 저장 요청을 받을 준비가 됐으면 flush 를 기다린다.
 * 시작 화면·부팅 전은 skip — 아직 렌더러에 저장할 변경이 없다.
 */
function waitForFolderSwitchFlush(window: BrowserWindow): Promise<FolderSwitchFlush> {
  const id = window.webContents.id;
  if (closing.has(id)) return Promise.resolve("closed");
  if (sessions.get(id) === null || !replaceFlushReady.has(id)) return Promise.resolve("skip");
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: FolderSwitchFlush): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!window.isDestroyed()) window.removeListener("closed", onClosed);
      if (replaceFlushWaiters.get(id) === onDone) replaceFlushWaiters.delete(id);
      resolve(result);
    };
    const onDone = (payload: unknown): void => finish(folderSwitchFlushOk(payload) ? "ok" : "blocked");
    const onClosed = (): void => finish("closed");
    timer = setTimeout(() => finish("timeout"), CLOSE_FLUSH_TIMEOUT_MS);
    replaceFlushWaiters.set(id, onDone);
    window.once("closed", onClosed);
    if (window.webContents.isDestroyed()) finish("closed");
    else window.webContents.send(OPRN_CHANNELS.lifecycleFlushBeforeReplace);
  });
}

/** 파일 메뉴의 새 프로젝트·폴더 열기. 열린 프로젝트는 저장이 끝난 뒤에만 바꾼다. 실패는 창으로 보여 준다. */
function openChosenFolder(window: BrowserWindow, options: {
  readonly title: string;
  readonly createDirectory?: boolean;
  readonly recentTitle?: string;
  readonly failure: string;
}): void {
  const id = window.webContents.id;
  if (folderSwitching.has(id)) return;
  folderSwitching.add(id);
  void (async () => {
    try {
      const picked = await askForDirectory(window, options.title, options.createDirectory === true);
      if (!picked || window.isDestroyed()) return;
      const flushed = await waitForFolderSwitchFlush(window);
      if (flushed === "closed" || window.isDestroyed() || closing.has(window.webContents.id)) return;
      if (flushed === "blocked" || flushed === "timeout") {
        const detail = flushed === "timeout"
          ? "저장이 시간 안에 끝나지 않았습니다. 이 프로젝트는 그대로 두었습니다."
          : "저장하지 못한 변경이 남아 있습니다. 이 프로젝트는 그대로 두었습니다.";
        await dialog.showMessageBox(window, { type: "warning", message: "폴더를 바꾸지 않았습니다", detail }).catch((dialogError: unknown) => {
          console.warn("[project] 오류 창을 띄우지 못했습니다:", dialogError);
        });
        return;
      }
      const dir = acceptMenuFolder(picked, options.createDirectory === true ? "new" : "open");
      await adoptFolder(window, dir, options.recentTitle);
    } catch (error) {
      console.warn("[project] 폴더를 열지 못했습니다:", error);
      if (window.isDestroyed()) return;
      const detail = error instanceof Error ? error.message : String(error);
      await dialog.showMessageBox(window, { type: "error", message: options.failure, detail }).catch((dialogError: unknown) => {
        console.warn("[project] 오류 창을 띄우지 못했습니다:", dialogError);
      });
    } finally {
      folderSwitching.delete(id);
    }
  })();
}

/** macOS 는 마지막 창을 닫아도 앱이 남는다. 그때 파일 메뉴는 창을 하나 만든 뒤 대화상자를 연다. */
function fileMenuWindow(): BrowserWindow | null {
  const existing = focusedWindow();
  if (existing) return existing;
  if (process.platform !== "darwin") return null;
  const created = createWindow();
  presentAppWindow(created);
  return created;
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * 참여하는 쪽: 다른 컴퓨터의 팀 호스트를 앱 창으로 연다. 창이 첫 페이지를 불러오면 끝난다. */
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

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * The app owns the local host lifecycle; users do not install or start a DB/server. */
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

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * 파일 메뉴 → 팀에 참여. 주소 입력은 시작 화면이 맡는다. 새 창은 프로젝트가 없으니 시작 화면으로 열린다. */
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
        // @deprecated multi-user team collaboration is not supported yet (2026-10-21).
        // TEAM_COLLAB_ENABLED(electron/shared/teamCollab.ts) 를 켜면 세 항목이 돌아온다.
        ...(TEAM_COLLAB_ENABLED ? [
          { label: "팀 협업 시작 / 관리", click: () => { void hostCurrentTeam(); } },
          { label: "팀에 참여…", click: () => { showJoinFromMenu(); } },
          { label: "팀 호스트 중지", click: async () => {
            const window = focusedWindow();
            const projectDir = window ? sessions.get(window.webContents.id)?.projectDir : undefined;
            if (!projectDir) return;
            await teamHosts.get(projectDir)?.close(); teamHosts.delete(projectDir);
          } },
          { type: "separator" as const },
        ] : []),
        {
          label: "새 프로젝트",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            const window = fileMenuWindow();
            if (!window) return;
            openChosenFolder(window, { title: "새 프로젝트 폴더 선택", createDirectory: true, recentTitle: "새 프로젝트", failure: "새 프로젝트를 만들지 못했습니다." });
          },
        },
        {
          id: "file-open-folder",
          label: "폴더 열기",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            const window = fileMenuWindow();
            if (!window) return;
            // 메뉴 경로는 폴더에 project.sqlite 가 없어도 연다 — initLocalProjectStore 가 만든다.
            openChosenFolder(window, { title: "프로젝트 폴더 열기", failure: "폴더를 열지 못했습니다." });
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
    {
      // 기본 viewMenu 의 Reload 는 저장 없이 webContents.reload() 를 부른다.
      // 라벨·단축키는 Electron 역할과 같다. 개발자 도구·확대·전체화면은 역할을 그대로 둔다.
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => { const window = focusedWindow(); if (window) beginReloadFlush(window, false); } },
        { label: "Force Reload", accelerator: "Shift+CmdOrCtrl+R", click: () => { const window = focusedWindow(); if (window) beginReloadFlush(window, true); } },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ]));
}

/** 입구(boot.ts)가 스플래시를 띄운 뒤 부른다. */
export async function startApp(boot: BootContext): Promise<void> {
  // 큰 창 객체(숨김)를 먼저 만들고 문서는 프로토콜·동반 서비스가 준비된 뒤 싣는다(아래 loadWindowContent).
  const { splash } = boot;
  activeSplash = splash;
  const cli = inspectCurrentCliProject();
  warnIgnoredCliPaths(cli.ignored);
  // open-file 이 ready 전에 왔으면 명령줄과 같이 첫 창이 그 프로젝트를 연다. 스플래시를 기다리면 편집기 신호가 없어 6초 숨는다.
  const openedAtBoot = cli.dir ?? peekPendingProjectDir();
  if (cli.dir) console.log(`[project] 명령줄 폴더를 엽니다: ${cli.dir}`);
  else if (openedAtBoot) console.log(`[project] 연 폴더를 엽니다: ${openedAtBoot}`);
  mainMark("createWindow");
  const firstWindow = createWindow({
    splash: openedAtBoot ? undefined : () => splash,
    deferLoad: true,
    projectDir: openedAtBoot ?? undefined,
  });
  if (openedAtBoot) dismissSplash();
  mainMark("windowCreated");
  boot.setRetry(() => { if (!firstWindow.isDestroyed()) loadWindowContent(firstWindow); });
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
  // 조수 워커(컴파일된 실행 파일)는 자기 위치로 public/ 을 찾지 못한다 — 번들 참고 그림을 읽을 렌더러 폴더를 물려준다.
  process.env.OPRN_RENDERER_DIR ??= rendererDir;
  companionServer = await startCompanionServer();
  mainMark("companionReady");
  ipcMain.on(OPRN_CHANNELS.companionOrigin, (event) => {
    event.returnValue = companionServer?.origin ?? null;
  });
  ipcMain.on(OPRN_CHANNELS.companionToken, (event) => {
    event.returnValue = companionServer?.token ?? null;
  });
  ipcMain.on(OPRN_CHANNELS.lifecycleFlushReplaceDone, (event, payload: unknown) => {
    if (!trustedRendererSender(event)) return;
    replaceFlushWaiters.get(event.sender.id)?.(payload);
  });
  ipcMain.on(OPRN_CHANNELS.lifecycleFlushReplaceReady, (event) => {
    if (!trustedRendererSender(event)) return;
    replaceFlushReady.add(event.sender.id);
  });
  buildMenu();
  registerAppProtocol(rendererDir, () => sessions.firstProjectDir() ?? process.cwd(), () => companionServer?.origin ?? null);
  registerAssetProtocol(sessions);
  // 렌더러는 이 동기 블록이 끝나기 전에는 IPC 를 보낼 수 없다 — 문서를 먼저 걸고 아래 처리기를 같은 틱에 붙인다(약 50ms 앞당김).
  if (!firstWindow.isDestroyed()) loadWindowContent(firstWindow);
  mainMark("windowLoading");
  ipcMain.handle(OPRN_CHANNELS.lifecycleFlushDone, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    // 닫기 저장을 걸어 둔 창만 없앤다. 저장을 요청하지 않았는데 오면 편집 중인 창을 닫지 않는다.
    if (!window || window.isDestroyed() || !closing.has(event.sender.id)) return false;
    destroyWindow(window);
    return true;
  });
  ipcMain.on(OPRN_CHANNELS.lifecycleFlushReady, (event) => {
    if (event.senderFrame?.parent == null) flushReady.add(event.sender.id);
    event.returnValue = true;
  });
  ipcMain.on(OPRN_CHANNELS.lifecycleReloadBlocked, (event) => {
    if (event.senderFrame?.parent == null) unsavedReloadBlock.add(event.sender.id);
    event.returnValue = true;
  });
  ipcMain.handle(OPRN_CHANNELS.lifecycleFlushReloadDone, (event, ok: unknown) => {
    const id = event.sender.id;
    const hard = reloadFlushing.get(id) === "hard";
    if (!reloadFlushing.has(id)) return false;
    abandonReloadFlush(id);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed() || closing.has(id)) return false;
    if (ok !== true) {
      void dialog.showMessageBox(window, { type: "warning", message: RELOAD_BLOCKED_MESSAGE, detail: RELOAD_BLOCKED_DETAIL }).catch((error: unknown) => {
        console.warn("[project] 새로고침 안내를 띄우지 못했습니다:", error);
      });
      return false;
    }
    performReload(window, hard);
    return true;
  });
  ipcMain.on(OPRN_CHANNELS.resumeEditorReady, (event) => {
    if (event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) markEditorSettled(event.sender.id);
  });
  // 편집기 부팅 동안 보일 마지막 편집 화면(public/boot-splash.js). 이 창이 연 프로젝트 것만 준다.
  ipcMain.handle(OPRN_CHANNELS.resumeLastView, (event) => {
    if (!event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return null;
    return readLastView(sessions.get(event.sender.id)?.projectDir);
  });
  ipcMain.handle(OPRN_CHANNELS.windowControl, (event, action: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    if (!isWindowControlAction(action)) return false;
    if (action === "toggle-fullscreen") { window.setFullScreen(!window.isFullScreen()); return true; }
    if (action === "minimize") { window.minimize(); return true; }
    if (action === "toggle-maximize") {
      // 전체화면에서 「복원」 은 전체화면만 벗어난다(그 전 창 크기·최대화 상태로 돌아간다).
      if (window.isFullScreen()) window.setFullScreen(false);
      else if (window.isMaximized()) window.unmaximize();
      else window.maximize();
      return true;
    }
    // 닫기는 installCloseFlow 를 거친다 — 미저장 flush·확인을 우회하지 않는다.
    window.close();
    return true;
  });
  ipcMain.handle(OPRN_CHANNELS.windowState, (event): WindowState => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return { fullscreen: false, maximized: false };
    return windowStateOf(window);
  });
  // 창의 진짜 전체화면 상태는 네이티브 쪽에만 있다 — 브라우저 Fullscreen API 는 이 창과 무관하다.
  ipcMain.handle(OPRN_CHANNELS.windowFullscreen, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !event.senderFrame?.url.startsWith(`${OPRN_APP_SCHEME}://`)) return false;
    return window.isFullScreen();
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentProjects, () => {
    mainMark("recentProjectsAsked");
    const entries = describeRecentProjects();
    mainMark("recentProjectsAnswered");
    return entries;
  });
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
  ipcMain.handle(OPRN_CHANNELS.startChooseProjectRoot, (event: IpcMainInvokeEvent, _payload: unknown) =>
    askForDirectory(BrowserWindow.fromWebContents(event.sender), "새 게임을 만들 위치 선택", true));
  ipcMain.handle(OPRN_CHANNELS.startOpenFolder, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const senderId = event.sender.id;
    const requested = (payload as { readonly projectDir?: unknown } | null)?.projectDir;
    if (typeof requested === "string") {
      if (!requested || !sessions.directoryExists(requested)) throw new Error("열 프로젝트 폴더를 찾지 못했습니다.");
      const session = await openWindowSession(senderId, requested);
      if (!session) return null;
      rememberRecentProject(session.projectDir, session.store.info().title ?? requested);
      return { projectDir: session.projectDir, isNew: false, projectId: session.store.projectId };
    }
    const dir = await askForDirectory(BrowserWindow.fromWebContents(event.sender), "프로젝트 폴더 열기");
    if (!dir || event.sender.isDestroyed()) return null;
    // project.sqlite 가 없는 폴더도 그냥 연다 — 스토어가 만들어지고 렌더러의 store.load()
    // 가 빈 프로젝트를 심는다. isNew 는 시작 화면이 “새 프로젝트로 채택” 토스트를 띄우는 용도다.
    const isNew = !sessions.directoryExists(dir);
    const session = await openWindowSession(senderId, dir);
    if (!session) return null;
    rememberRecentProject(dir, session.store.info().title ?? dir);
    return { projectDir: dir, isNew, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startOpenRecent, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const senderId = event.sender.id;
    const input = payload as { readonly projectDir?: unknown };
    const dir = typeof input?.projectDir === "string" ? input.projectDir : "";
    if (!dir || !sessions.directoryExists(dir)) return null;
    const session = await openWindowSession(senderId, dir);
    if (!session) return null;
    rememberRecentProject(dir, session.store.info().title ?? dir);
    return { projectDir: dir, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startCreateProject, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const senderId = event.sender.id;
    const input = payload as { readonly title?: string; readonly seed?: string; readonly projectDir?: string };
    let dir: string;
    // 시작 화면은 저장 위치를 미리 보여 주고 확정된 경로를 보낸다. 경로가 없으면 대화상자를 연다.
    // 어느 쪽이든 파일이 있는 폴더는 거절한다.
    if (typeof input?.projectDir === "string" && input.projectDir) {
      dir = prepareNewProjectDir(input.projectDir);
    } else {
      const picked = await askForDirectory(BrowserWindow.fromWebContents(event.sender), "새 프로젝트 폴더 선택", true);
      if (!picked || event.sender.isDestroyed()) return null;
      dir = acceptMenuFolder(picked, "new");
    }
    const session = await openWindowSession(senderId, dir);
    if (!session) return null;
    // 시드(장르 프리셋 등)를 새 폴더에 심는다 — 빈 폴더로 시작하면 렌더러가 리로드 뒤에 적용할 수 없다.
    if (typeof input.seed === "string" && input.seed.length > 0) await session.store.saveSerialized(input.seed);
    rememberRecentProject(session.projectDir, input.title ?? "새 프로젝트");
    // 세션이 정규화한 경로(realpath)를 돌려준다 — 시작 화면 인계가 편집기가 연 폴더와 같은 문자열로 비교한다.
    return { projectDir: session.projectDir, projectId: session.store.projectId };
  });
  ipcMain.handle(OPRN_CHANNELS.startImportFile, async (event: IpcMainInvokeEvent, payload: unknown) => {
    return { projectDir: null, imported: false };
  });
  // @deprecated multi-user team collaboration is not supported yet (2026-10-21). 시작 화면이 부르지 않는다.
  ipcMain.handle(OPRN_CHANNELS.startJoinTeam, async (_event: IpcMainInvokeEvent, payload: unknown) => {
    if (!TEAM_COLLAB_ENABLED) return { ok: false, error: "팀 협업은 아직 지원하지 않습니다." } satisfies JoinTeamResult;
    const url = (payload as { readonly url?: unknown } | null)?.url;
    return joinTeam(typeof url === "string" ? url : "");
  });
  ipcMain.handle(OPRN_CHANNELS.startRecentTeams, () => (TEAM_COLLAB_ENABLED ? listRecentTeams() : []));
  ipcMain.on(OPRN_CHANNELS.startScreenReady, (event) => {
    mainMark("startScreenReady");
    revealOnStartReady.get(event.sender.id)?.();
  });
  registerIpcHandlers(sessions, (webContentsId) => {
    const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed() && candidate.webContents.id === webContentsId);
    const projectDir = sessions.get(webContentsId)?.projectDir;
    if (window && projectDir) scheduleLastViewAfterSave(window, projectDir);
  });
  registerAssetBrowser();
  registerAssetStore({ hasProject: (webContentsId) => sessions.get(webContentsId) !== null });
  registerDeepLinkProtocol();
  mainMark("handlersRegistered");
  // 첫 실행 인자(Windows·Linux)와 본체를 읽기 전에 온 링크·두 번째 실행을 이제 처리한다. 이후 것은 바로 받는다.
  // 두 번째 실행: 프로젝트 폴더면 그 폴더를 연다. 링크만 있으면 창을 더 열지 않는다. 둘 다 없으면 새 시작 화면.
  // macOS 는 폴더를 second-instance argv 가 아니라 open-file 로 보낸다. 둘은 순서가 정해져 있지 않아,
  // 경로 없는 두 번째 실행은 open-file 이 같은 폴더를 여는 동안이면 시작 화면을 더 만들지 않는다.
  let lastOpenFileAt = 0;
  const onSecondInstance = (launch: SecondInstanceLaunch): void => {
    const link = findStoreDeepLinkArg(launch.argv);
    if (link) acceptStoreDeepLink(link);
    // QA 진입점은 명령줄 폴더를 보지 않는다. OPRN_OPEN_PROJECT_DIR 은 잠금을 끄지만, 잠금이 켜진 채
    // 그 변수가 남아 있으면 예전처럼 링크 아니면 새 창이다.
    if (process.env.OPRN_SMOKE_PAGE !== undefined || process.env.OPRN_OPEN_PROJECT_DIR !== undefined) {
      if (!link) createWindow();
      return;
    }
    const found = inspectCliProjectArgs(launch.argv, launch.cwd, { fromIndex: electronUserArgIndex() });
    warnIgnoredCliPaths(found.ignored);
    if (found.dir) {
      void openProjectFromCli(found.dir);
      return;
    }
    if (!link) {
      if (process.platform === "darwin") {
        setTimeout(() => {
          if (quitRequested || Date.now() - lastOpenFileAt < 1000) return;
          createWindow();
        }, 200);
        return;
      }
      createWindow();
    }
  };
  const early = boot.attachLinks(acceptStoreDeepLink, onSecondInstance);
  const initialLink = findStoreDeepLinkArg(process.argv);
  for (const link of [...(initialLink ? [initialLink] : []), ...early.links]) acceptStoreDeepLink(link);
  for (const launch of early.secondInstances) onSecondInstance(launch);
  // macOS open-file. 첫 창이 이미 이 폴더를 열었으면 다시 열지 않는다(숨은 창을 창 모드로 띄우지 않게).
  const acceptOpenedPath = (filePath: string): void => {
    if (process.env.OPRN_SMOKE_PAGE !== undefined || process.env.OPRN_OPEN_PROJECT_DIR !== undefined) return;
    const dir = projectDirFromOpenPath(filePath);
    if (!dir) {
      console.warn(`[project] 연 항목을 프로젝트로 열지 않았습니다 (project.sqlite 가 있는 폴더가 아님): ${filePath}`);
      return;
    }
    lastOpenFileAt = Date.now();
    if (openedAtBoot && safeRealpath(dir) === safeRealpath(openedAtBoot)) return;
    void openProjectFromCli(dir);
  };
  for (const filePath of takePendingOpenFiles(acceptOpenedPath)) acceptOpenedPath(filePath);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on("before-quit", () => { quitRequested = true; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  void companionServer?.close();
  for (const host of teamHosts.values()) void host.close();
});
