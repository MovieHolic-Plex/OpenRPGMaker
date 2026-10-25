// 데스크톱 앱의 시작 입구(dist-electron/main.cjs). 가볍게 둔다 — 여기서 import 하는 것은 앱 아이콘을 누른 뒤
// 스플래시가 뜨기 전에 모두 평가된다. 무거운 앱 본체(main.ts → dist-electron/app.cjs)는 스플래시를 띄운 뒤 require 한다.
//
// ready 전에 해야 하는 일만 여기 있다: 스킴 권한 등록, 한 번만 실행 잠금, 링크(open-url·second-instance) 받아 두기.
import { mainMark } from "./startupTiming";
import { join } from "node:path";
import { app, protocol } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME } from "../shared/channels";
import { bootsToStartScreen, rendererDirectory, windowIconPath, type BootContext, type SecondInstanceLaunch } from "./bootContext";
import { openSplash, type Splash } from "./splash";

protocol.registerSchemesAsPrivileged([
  // codeCache: 편집기 번들(약 90MB)의 V8 컴파일 결과를 다음 실행에 다시 쓴다(standard 와 함께여야 켜진다).
  { scheme: OPRN_APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, codeCache: true } },
  { scheme: OPRN_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

/**
 * 한 번만 실행(single instance). 배포 앱에서만 건다 — QA 하니스는 개발 빌드 Electron 을 여러 개 동시에 띄우고
 * (OPRN_SMOKE_PAGE·OPRN_OPEN_PROJECT_DIR), 잠금을 걸면 두 번째부터 바로 꺼진다.
 * 잠금을 못 얻은 두 번째 실행은 스플래시를 띄우지 않고 바로 끝난다(떠 있는 앱이 second-instance 로 인자를 받는다).
 */
const singleInstance = app.isPackaged && process.env.OPRN_SMOKE_PAGE === undefined && process.env.OPRN_OPEN_PROJECT_DIR === undefined
  && process.env.OPRN_MULTI_INSTANCE !== "1";
const duplicate = singleInstance && !app.requestSingleInstanceLock();
if (duplicate) app.exit(0);

// ── 「에디터에서 열기」 링크(oprn://store/install?…) ─────────────────────────────
// 본체가 붙기 전에 온 것은 받아 두었다가 넘긴다. 판정·처리는 본체(main.ts → assetStore.ts)가 한다.
const early = { links: [] as string[], secondInstances: [] as SecondInstanceLaunch[] };
let onLink: ((url: string) => void) | null = null;
let onSecondInstance: ((launch: SecondInstanceLaunch) => void) | null = null;
// macOS: 링크·「다음으로 열기」는 open-url 로 온다. ready 전에 붙여야 첫 실행 링크를 놓치지 않는다.
app.on("open-url", (event, url) => {
  event.preventDefault();
  if (onLink) onLink(url);
  else early.links.push(url);
});
// Windows·Linux: 이미 떠 있는 앱에 두 번째 실행의 인자가 온다. 링크와 프로젝트 폴더를 본체가 가른다.
// workingDirectory 가 있어야 `AppImage quest` 처럼 상대 경로가 그 실행의 폴더에서 풀린다.
app.on("second-instance", (_event, argv, workingDirectory) => {
  const launch: SecondInstanceLaunch = {
    argv: [...argv],
    cwd: typeof workingDirectory === "string" && workingDirectory.length > 0 ? workingDirectory : process.cwd(),
  };
  if (onSecondInstance) onSecondInstance(launch);
  else early.secondInstances.push(launch);
});

mainMark("bootEvaluated");

/** 스플래시가 그려지기를 기다리는 상한. 넘으면 그냥 본체를 읽는다(느린 기계에서 큰 창이 마냥 늦지 않게). */
const SPLASH_WAIT_MS = 400;

if (!duplicate) {
  void app.whenReady().then(() => {
    mainMark("appReady");
    // 누르자마자 보이는 것: 스플래시를 다른 무엇보다 먼저 만든다. 시작 화면으로 켜질 때만(QA 진입점은 빼고).
    // Playwright 가 띄운 앱은 기본으로 끈다 — QA 스크립트 다수가 app.firstWindow() 로 앱 창을 받는다. OPRN_SPLASH=1 이면 켜고 0 이면 끈다.
    const automated = typeof (globalThis as { __playwright_run?: unknown }).__playwright_run === "function";
    const wantSplash = process.env.OPRN_SPLASH === "1" || (process.env.OPRN_SPLASH !== "0" && !automated);
    let retry: () => void = () => {};
    const rendererDir = rendererDirectory();
    const splash: Splash | undefined = bootsToStartScreen() && wantSplash
      ? openSplash({ rendererDir, icon: windowIconPath(rendererDir), onRetry: () => retry() })
      : undefined;
    const context: BootContext = {
      splash,
      setRetry: (next) => { retry = next; },
      attachLinks: (linkHandler, secondInstanceHandler) => {
        onLink = linkHandler;
        onSecondInstance = secondInstanceHandler;
        const taken = { links: [...early.links], secondInstances: [...early.secondInstances] };
        early.links.length = 0;
        early.secondInstances.length = 0;
        return taken;
      },
    };
    // 본체 평가(약 0.3s) 동안 메인 스레드가 막힌다 — 스플래시가 먼저 그려져 보이게 기다린다(늦어도 SPLASH_WAIT_MS).
    const loadBody = (): void => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const body = require(join(__dirname, "app.cjs")) as { startApp: (context: BootContext) => Promise<void> };
        mainMark("modulesEvaluated");
        body.startApp(context).catch((error: unknown) => {
          console.error("[boot] 앱을 시작하지 못했습니다:", error);
          splash?.fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
        });
      } catch (error) {
        console.error("[boot] 앱 본체를 읽지 못했습니다:", error);
        if (splash) splash.fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
        else app.exit(1);
      }
    };
    if (!splash) { loadBody(); return; }
    let loaded = false;
    const once = (): void => { if (!loaded) { loaded = true; loadBody(); } };
    void splash.painted.then(once);
    setTimeout(once, SPLASH_WAIT_MS);
  });
}
