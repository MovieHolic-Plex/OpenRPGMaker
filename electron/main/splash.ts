// 앱을 누르자마자 뜨는 시작 스플래시(작은 네이티브 창).
//
// 왜: 큰 창(전체화면)은 렌더러를 띄우고 시작 화면이 카드를 그려야 보인다 — 부하 40 박스에서 프로세스 시작 뒤 약 2초 동안
// 화면에 아무것도 없었다(2026-10-21 실측, scripts/perf/startup-bench.mjs). 사용자는 «눌렀는데 안 켜진다»로 본다.
// 그래서 app ready 직후 **번들도 프리로드도 없는** data: 문서 하나(인라인 CSS·앱 아이콘·이름·스피너)를 띄우고,
// 큰 창은 숨긴 채 준비한다. 시작 화면이 첫 카드를 그렸다고 알리면(OPRN_CHANNELS.startScreenReady) 큰 창을 보이고 스플래시를 닫는다.
// 큰 창을 못 불러오면 스플래시가 오류와 「다시 시도」·「닫기」를 보여 준다 — 빈 화면으로 멈추지 않는다.
//
// 스플래시 문서는 프리로드가 없다. 단추는 주소 조각(#retry / #quit)으로 바꾸고 메인이 did-navigate-in-page 로 듣는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app } from "electron";
import { PRODUCT_BRAND } from "../../src/brand";
import { mainMark } from "./startupTiming";

type SplashText = { starting: string; slow: string; failed: string; retry: string; quit: string };

const TEXT: Record<"ko" | "en" | "ja" | "zh", SplashText> = {
  ko: { starting: "시작하는 중…", slow: "준비하는 데 시간이 걸리고 있어요…", failed: "화면을 불러오지 못했습니다", retry: "다시 시도", quit: "닫기" },
  en: { starting: "Starting…", slow: "This is taking a little longer…", failed: "Couldn't load the app window", retry: "Try again", quit: "Quit" },
  ja: { starting: "起動しています…", slow: "準備に時間がかかっています…", failed: "画面を読み込めませんでした", retry: "再試行", quit: "閉じる" },
  zh: { starting: "正在启动…", slow: "准备时间较长，请稍候…", failed: "无法加载应用窗口", retry: "重试", quit: "关闭" },
};

function splashText(): SplashText {
  const locale = (app.getLocale() || "ko").toLowerCase();
  if (locale.startsWith("ko")) return TEXT.ko;
  if (locale.startsWith("ja")) return TEXT.ja;
  if (locale.startsWith("zh")) return TEXT.zh;
  return TEXT.en;
}

const escapeHtml = (value: string): string => value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

/** 앱 아이콘(작업표시줄과 같은 그림)을 data URI 로. 못 읽으면 시작 화면 뼈대와 같은 로고 SVG 를 쓴다. */
function iconMarkup(rendererDir: string): string {
  try {
    const png = readFileSync(join(rendererDir, "icons", "pwa-192.png"));
    return `<img class="icon" alt="" src="data:image/png;base64,${png.toString("base64")}">`;
  } catch {
    return `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="7" fill="#4a57d6"/><rect x="6" y="6" width="7" height="7" rx="1.5" fill="#fff"/><rect x="15" y="6" width="7" height="7" rx="1.5" fill="#fff" fill-opacity="0.55"/><rect x="6" y="15" width="7" height="7" rx="1.5" fill="#fff" fill-opacity="0.55"/><rect x="15" y="15" width="7" height="7" rx="1.5" fill="#fff"/></svg>`;
  }
}

/** 스플래시 문서. 외부 참조 없이 혼자 그려진다(번들·글꼴·네트워크 없음). */
export function splashHtml(rendererDir: string, text: SplashText = splashText(), version = app.getVersion()): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(PRODUCT_BRAND)}</title><style>
html,body{margin:0;height:100%;background:#111214;color:#ececee;overflow:hidden;-webkit-user-select:none;user-select:none;cursor:default}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-app-region:drag;transition:opacity .18s ease}
body.leaving{opacity:0}
.icon{width:72px;height:72px;image-rendering:pixelated;animation:float 2.4s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.name{font-weight:700;font-size:22px;letter-spacing:-.01em}
.bar{position:relative;width:180px;height:4px;border-radius:2px;background:#2a2c31;overflow:hidden}
.bar::before{content:"";position:absolute;top:0;bottom:0;left:-40%;width:40%;border-radius:2px;background:#6b78f0;animation:slide 1.1s cubic-bezier(.4,0,.2,1) infinite}
@keyframes slide{to{left:100%}}
.status{color:#a3a5ad;min-height:18px;text-align:center;padding:0 20px}
.ver{position:fixed;bottom:10px;right:12px;color:#5c5f68;font-size:11px}
.error{display:none;flex-direction:column;align-items:center;gap:10px;padding:0 24px;text-align:center}
.error b{color:#ff8a80;font-size:14px}
.error code{display:block;max-width:360px;max-height:64px;overflow:auto;color:#c9cbd2;font:12px/1.4 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word;-webkit-user-select:text;user-select:text}
.error nav{display:flex;gap:8px;-webkit-app-region:no-drag}
.error a{padding:6px 14px;border-radius:6px;background:#2a2c31;color:#ececee;text-decoration:none}
.error a.primary{background:#4a57d6}
body.failed .bar,body.failed .status{display:none}
body.failed .error{display:flex}
@media (prefers-reduced-motion:reduce){.icon,.bar::before{animation:none}.bar::before{left:0;width:100%;opacity:.5}}
</style></head><body role="status" aria-live="polite">
${iconMarkup(rendererDir)}
<div class="name">${escapeHtml(PRODUCT_BRAND)}</div>
<div class="bar" aria-hidden="true"></div>
<div class="status" id="status">${escapeHtml(text.starting)}</div>
<div class="error"><b>${escapeHtml(text.failed)}</b><code id="detail"></code><nav><a class="primary" href="#retry">${escapeHtml(text.retry)}</a><a href="#quit">${escapeHtml(text.quit)}</a></nav></div>
<div class="ver">${escapeHtml(version)}</div>
<script>
window.__splash={
status:function(t){document.getElementById("status").textContent=t;},
fail:function(d){document.getElementById("detail").textContent=d;document.body.classList.add("failed");},
reset:function(t){document.body.classList.remove("failed");document.getElementById("status").textContent=t;history.replaceState(null,"",location.pathname+location.search);},
leave:function(){document.body.classList.add("leaving");}
};
</script></body></html>`;
}

export type Splash = {
  /** 스플래시가 첫 프레임을 그려 화면에 보였다. */
  readonly painted: Promise<void>;
  /** 스플래시가 아직 떠 있는가. */
  readonly open: () => boolean;
  /** 오류를 보이고 단추를 연다. 「다시 시도」는 onRetry 를 부른다. */
  readonly fail: (detail: string) => void;
  /** 큰 창이 보였다 — 살짝 사라지며 닫는다. */
  readonly close: () => void;
};

/** app ready 직후 가장 먼저 부른다. 창을 바로 보인다(바탕색이 첫 프레임). */
export function openSplash(options: { readonly rendererDir: string; readonly icon?: string; readonly onRetry: () => void }): Splash {
  const text = splashText();
  const window = new BrowserWindow({
    width: 420,
    height: 300,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    // 만들자마자 보인다. 첫 프레임은 바탕색(#111214, 문서 바탕과 같은 색)이고 아이콘·이름은 렌더러가 뜨면 얹힌다.
    // 예전에는 ready-to-show 까지 숨겼는데, 스플래시 렌더러 프로세스를 띄우는 데만 평소 0.38s, 부하 59 에서 1.2s 가
    // 걸려 그동안 화면에 아무것도 없었다(2026-10-25 실측, openwiki/app-startup.md). 같은 색 빈 상자는 깜빡임이 아니다.
    show: true,
    backgroundColor: "#111214",
    title: PRODUCT_BRAND,
    ...(options.icon ? { icon: options.icon } : {}),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, spellcheck: false },
  });
  mainMark("splashCreated");
  mainMark("firstPixel");
  let markPainted: () => void = () => {};
  const painted = new Promise<void>((resolvePainted) => { markPainted = resolvePainted; });
  window.once("ready-to-show", () => {
    if (!window.isVisible()) window.show();
    mainMark("splashShown");
    markPainted();
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(options.rendererDir, text))}`);

  const run = (script: string): void => {
    if (!window.isDestroyed()) void window.webContents.executeJavaScript(script, true).catch(() => {});
  };
  // 아주 느린 기계: 20초가 지나도 큰 창이 안 보이면 «아직 준비 중» 으로 바꾼다(멈춘 것처럼 보이지 않게).
  const slowTimer = setTimeout(() => run(`window.__splash&&__splash.status(${JSON.stringify(text.slow)})`), 20_000);
  window.webContents.on("did-navigate-in-page", (_event, url) => {
    const hash = new URL(url).hash;
    if (hash === "#quit") app.quit();
    else if (hash === "#retry") {
      run(`window.__splash&&__splash.reset(${JSON.stringify(text.starting)})`);
      options.onRetry();
    }
  });
  // 스플래시를 닫았다 = 앱을 끄겠다는 뜻이다(큰 창이 아직 숨어 있으면 아무것도 안 남는다).
  let closingByApp = false;
  window.on("closed", () => {
    clearTimeout(slowTimer);
    if (!closingByApp) app.quit();
  });

  return {
    painted,
    open: () => !window.isDestroyed(),
    fail: (detail) => {
      clearTimeout(slowTimer);
      if (window.isDestroyed()) return;
      run(`window.__splash&&__splash.fail(${JSON.stringify(detail)})`);
      window.show();
      window.focus();
    },
    close: () => {
      clearTimeout(slowTimer);
      if (window.isDestroyed()) return;
      closingByApp = true;
      run("window.__splash&&__splash.leave()");
      setTimeout(() => { if (!window.isDestroyed()) window.destroy(); }, 200);
    },
  };
}
