// 데스크톱 창 컨트롤 실측 — 실제 Electron 을 띄워 최소화·최대화·복원·전체화면·닫기를 눌러 보고
// 그때마다 네이티브 창 상태와 화면을 남긴다. openwiki/desktop-window-controls.md 참고.
//
// 필요: Electron 바이너리(ELECTRON_BIN), dist/ + dist-electron/ 빌드, X 서버(xvfb) + 창 관리자(xfwm4).
//   Xvfb :77 -screen 0 1600x1000x24 &  DISPLAY=:77 xfwm4 --compositor=off &
//   DISPLAY=:77 ELECTRON_BIN=~/electron-bin-44.7.0/electron OUT=verify-shots/window-controls node scripts/qa/window-controls.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, process.env.OUT ?? "verify-shots/window-controls");
const BIN = process.env.ELECTRON_BIN;
const PROJECT = process.env.OPRN_QA_PROJECT;
if (!BIN) throw new Error("ELECTRON_BIN 이 필요하다");
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (line) => { console.log(line); log.push(line); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(extraEnv = {}) {
  const app = await electron.launch({
    executablePath: BIN,
    args: [ROOT, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--user-data-dir=${mkdtempSync(join(tmpdir(), "oprn-wc-ud-"))}`],
    cwd: ROOT,
    env: { ...process.env, OPRN_RENDERER_DIR: join(ROOT, "dist"), ...extraEnv },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

const nativeState = (app) => app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  return w ? { fullscreen: w.isFullScreen(), maximized: w.isMaximized(), minimized: w.isMinimized(), visible: w.isVisible(), bounds: w.getBounds(), destroyed: w.isDestroyed() } : { gone: true };
});
const x11Geometry = () => {
  try { return execFileSync("sh", ["-c", "xdotool search --name . 2>/dev/null | head -0; xwininfo -root -tree | grep -i -E 'Electron|oprn|OPRN' | head -3"], { encoding: "utf8" }).trim(); } catch { return ""; }
};
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  note(`  screenshot ${name}.png`);
}
async function step(app, page, label, fn) {
  await fn();
  await wait(900);
  const s = await nativeState(app);
  note(`${label} -> ${JSON.stringify(s)}`);
  return s;
}

const sh = (cmd) => execFileSync("sh", ["-c", cmd], { encoding: "utf8" }).trim();

/** 실제 X 입력(xdotool)으로 누른다 — Chromium 의 창 끌기 영역·네이티브 히트 테스트까지 밟는다. */
async function realClick(app, page, selector, { double = false } = {}) {
  const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
  const r = await page.evaluate((sel) => { const e = document.querySelector(sel); const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, selector);
  const X = Math.round(b.x + r.x), Y = Math.round(b.y + r.y);
  sh(`xdotool mousemove ${X} ${Y}`);
  await wait(250);
  sh(`xdotool click ${double ? "--repeat 2 --delay 80 " : ""}1`);
  return { X, Y };
}
const realHover = async (app, page, selector) => {
  const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
  const r = await page.evaluate((sel) => { const e = document.querySelector(sel); const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, selector);
  sh(`xdotool mousemove ${Math.round(b.x + r.x)} ${Math.round(b.y + r.y)}`);
  await wait(400);
};

const T = (id) => `[data-testid="${id}"]`;
const domState = (page) => page.evaluate(() => {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  const nav = q("studio-window-controls");
  const nb = nav?.getBoundingClientRect();
  return {
    body: [...document.body.classList].filter((c) => /window/.test(c)).join(" "),
    nav: nb ? { x: Math.round(nb.x), y: Math.round(nb.y), w: Math.round(nb.width), h: Math.round(nb.height) } : null,
    max: { label: q("window-toggle-maximize")?.getAttribute("aria-label"), state: q("window-toggle-maximize")?.dataset.state },
    fs: { label: q("window-toggle-fullscreen")?.getAttribute("aria-label"), pressed: q("window-toggle-fullscreen")?.getAttribute("aria-pressed") },
  };
});

export { launch, nativeState, shot, step, wait, note, log, OUT, PROJECT, ROOT, realClick, realHover, domState, T, sh };


/** 톱바·시작 화면 위 막대에서 끌기 영역(조작 요소가 아닌 곳)을 찾는다. */
const findDragPoint = (page) => page.evaluate(() => {
  const bar = document.querySelector(".oprn-menu-bar.studio-bar, .cf-top");
  const r = bar.getBoundingClientRect();
  const nav = document.querySelector(".studio-window-controls").getBoundingClientRect();
  for (let x = Math.floor(r.left) + 10; x < nav.left - 6; x += 4) {
    const e = document.elementFromPoint(x, 24);
    if (e && !e.closest("button,input,select,textarea,a,label,[role=button],[role=combobox],[role=menuitem],[role=tab],[tabindex]")) {
      const prev = document.elementFromPoint(x - 6, 24), next = document.elementFromPoint(x + 6, 24);
      if (prev === e || next === e || !prev?.closest("button,input,select,a") ) return { x, y: 24, tag: e.className?.toString().slice(0, 40) };
    }
  }
  return null;
});

async function screenshotClip(page, name, h = 100) {
  const w = await page.evaluate(() => innerWidth);
  await page.screenshot({ path: join(OUT, `${name}.png`), clip: { x: Math.max(0, w - 360), y: 0, width: Math.min(360, w), height: h } });
}

async function runSequence(mode) {
  const env = mode === "editor" ? { OPRN_OPEN_PROJECT_DIR: PROJECT } : {};
  const { app, page } = await launch(env);
  await page.waitForSelector(mode === "editor" ? T("oprn-menu-bar") : T("studio-window-controls"), { timeout: 90_000 });
  await wait(2500);
  note(`## ${mode}: url=${page.url()}`);
  note(`initial native ${JSON.stringify(await nativeState(app))} dom ${JSON.stringify(await domState(page))}`);
  await shot(page, `${mode}-1-fullscreen`);

  await realClick(app, page, T("window-toggle-fullscreen")); await wait(1200);
  note(`[전체화면 단추] native ${JSON.stringify(await nativeState(app))} dom ${JSON.stringify(await domState(page))}`);
  await shot(page, `${mode}-2-windowed`);

  for (const id of ["window-toggle-fullscreen", "window-minimize", "window-toggle-maximize", "window-close"]) {
    await realHover(app, page, T(id)); await screenshotClip(page, `${mode}-3-hover-${id}`);
  }
  await realHover(app, page, T("window-toggle-maximize"));
  await wait(1400);
  await page.screenshot({ path: join(OUT, `${mode}-3-tooltip-maximize.png`), clip: { x: Math.max(0, (await page.evaluate(() => innerWidth)) - 360), y: 0, width: 360, height: 110 } });
  sh("xdotool mousedown 1"); await wait(300);
  await screenshotClip(page, `${mode}-3-active-maximize`);
  sh("xdotool mouseup 1"); await wait(1200);
  note(`[최대화 단추(누름→뗌)] native ${JSON.stringify(await nativeState(app))} dom ${JSON.stringify(await domState(page))}`);
  await shot(page, `${mode}-4-maximized`);

  await realClick(app, page, T("window-toggle-maximize")); await wait(1200);
  note(`[이전 크기로 단추] native ${JSON.stringify(await nativeState(app))} dom ${JSON.stringify(await domState(page))}`);
  await shot(page, `${mode}-5-restored`);

  await realClick(app, page, T("window-minimize")); await wait(1500);
  note(`[최소화 단추] native ${JSON.stringify(await nativeState(app))}`);
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.restore(); w.focus(); }); await wait(1200);
  note(`[복원(w.restore())] native ${JSON.stringify(await nativeState(app))}`);

  const dp = await findDragPoint(page);
  note(`drag point ${JSON.stringify(dp)}`);
  if (dp) {
    const before = (await nativeState(app)).bounds;
    const bb = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
    sh(`xdotool mousemove ${bb.x + dp.x} ${bb.y + dp.y}`); await wait(250);
    sh("xdotool mousedown 1"); await wait(150);
    for (let i = 1; i <= 10; i++) { sh(`xdotool mousemove ${bb.x + dp.x + i * 12} ${bb.y + dp.y + i * 8}`); await wait(40); }
    sh("xdotool mouseup 1"); await wait(600);
    const after = (await nativeState(app)).bounds;
    note(`[끌기] ${JSON.stringify(before)} -> ${JSON.stringify(after)} (dx=${after.x - before.x}, dy=${after.y - before.y})`);
    await shot(page, `${mode}-6-after-drag`);
    const b2 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
    sh(`xdotool mousemove ${b2.x + dp.x} ${b2.y + dp.y}`); await wait(250);
    sh("xdotool click --repeat 2 --delay 80 1"); await wait(1300);
    note(`[끌기 영역 더블클릭] native ${JSON.stringify(await nativeState(app))}`);
    await shot(page, `${mode}-7-dblclick-maximized`);
    const b3 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
    sh(`xdotool mousemove ${b3.x + dp.x} ${b3.y + dp.y}`); await wait(250);
    sh("xdotool click --repeat 2 --delay 80 1"); await wait(1300);
    note(`[끌기 영역 더블클릭 다시] native ${JSON.stringify(await nativeState(app))}`);
  }

  await page.focus(T("window-minimize")); await page.keyboard.press("Tab"); await wait(300);
  note(`[키보드] Tab 뒤 초점=${await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))}`);
  await screenshotClip(page, `${mode}-8-focus-visible`);
  await page.keyboard.press("Enter"); await wait(1300);
  note(`[최대화 단추에서 Enter] native ${JSON.stringify(await nativeState(app))}`);
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab"); await wait(200);
  note(`[Shift+Tab ×2] 초점=${await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))}`);

  // 닫기: flush → ack → destroy 경로를 타는지 — 렌더러에서 flush 알림을 콘솔로 남겨 창이 사라진 뒤에도 센다
  let flushSeen = 0;
  page.on("console", (m) => { if (m.text() === "WC_FLUSH_BEFORE_CLOSE") flushSeen += 1; });
  await page.evaluate(() => { window.oprn?.lifecycle?.onFlushBeforeClose?.(() => console.log("WC_FLUSH_BEFORE_CLOSE")); });
  const exited = new Promise((resolve) => app.process().once("exit", (code) => resolve(code)));
  await realClick(app, page, T("window-close"));
  const outcome = await Promise.race([exited.then((c) => `앱 프로세스 종료 code=${c}`), wait(15000).then(() => "15초 뒤에도 실행 중")]);
  note(`[닫기 단추] flushBeforeClose 수신=${flushSeen}; ${outcome}`);
  writeFileSync(join(OUT, `${mode}.log`), log.join("\n") + "\n");
}

/** Windows·macOS 모양: 이 기계는 Linux 라서 body·nav 클래스만 바꿔 CSS 분기를 그려 본다(시뮬레이션 — 실제 OS 검증이 아니다). */
async function runPlatforms() {
  for (const surface of ["editor", "start"]) {
    const { app, page } = await launch(surface === "editor" ? { OPRN_OPEN_PROJECT_DIR: PROJECT } : {});
    await page.waitForSelector(surface === "editor" ? T("oprn-menu-bar") : T("studio-window-controls"), { timeout: 90_000 });
    await wait(2500);
    await realClick(app, page, T("window-toggle-fullscreen")); await wait(1500);
    for (const platform of ["linux", "win32", "darwin"]) {
      await page.evaluate((pf) => {
        const b = document.body; const nav = document.querySelector(".studio-window-controls");
        b.classList.remove("window-chrome-linux", "window-chrome-win32", "window-chrome-darwin"); b.classList.add(`window-chrome-${pf}`);
        b.classList.toggle("has-window-buttons", pf !== "darwin");
        if (nav) { nav.classList.remove("is-linux", "is-win32"); nav.classList.add(`is-${pf === "darwin" ? "linux" : pf}`); nav.style.display = pf === "darwin" ? "none" : ""; }
      }, platform);
      await wait(500);
      await page.screenshot({ path: join(OUT, `platform-${surface}-${platform}.png`), clip: { x: 0, y: 0, width: 1280, height: 130 } });
      const m = await page.evaluate(() => { const bar = document.querySelector(".oprn-menu-bar.studio-bar, .cf-top"); const nav = document.querySelector(".studio-window-controls"); const r = (e) => { const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right)]; }; const kids = [...bar.querySelectorAll("button")].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest(".studio-window-controls")); const rs = kids.map((e) => [e, e.getBoundingClientRect()]); const ov = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (rs[i][0].contains(rs[j][0]) || rs[j][0].contains(rs[i][0])) continue; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom && b.top < a.bottom) ov.push((rs[i][0].dataset.testid || "?") + "x" + (rs[j][0].dataset.testid || "?")); } const navR = nav && nav.style.display !== "none" ? nav.getBoundingClientRect() : null; const under = navR ? kids.filter((e) => { const q = e.getBoundingClientRect(); return q.right > navR.left && q.left < navR.right; }).length : 0; return { mutualOverlap: ov, underNav: under, barPad: [getComputedStyle(bar).paddingLeft, getComputedStyle(bar).paddingRight], rightmostButtonRight: Math.max(...kids.map((e) => r(e)[1])), leftmostButtonLeft: Math.min(...kids.map((e) => r(e)[0])), navLeft: nav && nav.style.display !== "none" ? r(nav)[0] : null }; });
      note(`[${surface}/${platform} 시뮬레이션] ${JSON.stringify(m)}`);
    }
    await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
  }
  writeFileSync(join(OUT, "platforms.log"), log.join("\n") + "\n");
}

/** 언어별 aria-label·툴팁 — 네 언어 모두 한국어 원문이 남지 않는지. */
async function runI18n() {
  const { app, page } = await launch({});
  await page.waitForSelector(T("studio-window-controls"), { timeout: 90_000 }); await wait(2000);
  await realClick(app, page, T("window-toggle-fullscreen")); await wait(1500);
  for (const lang of ["ko", "en", "ja", "zh"]) {
    await page.evaluate((l) => localStorage.setItem("oprn:locale", l), lang);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(T("studio-window-controls"), { timeout: 30_000 }); await wait(2500);
    const labels = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".studio-window-controls button")].map((b) => [b.dataset.testid, b.getAttribute("aria-label")])));
    await realHover(app, page, T("window-toggle-maximize")); await wait(1500);
    const tip = await page.evaluate(() => document.querySelector('[data-testid="delayed-tooltip"]')?.textContent ?? null);
    note(`[${lang}] aria-label ${JSON.stringify(labels)} 툴팁(최대화 호버 1.5s)=${JSON.stringify(tip)} nav aria-label=${await page.evaluate(() => document.querySelector(".studio-window-controls")?.getAttribute("aria-label"))}`);
    await page.screenshot({ path: join(OUT, `i18n-${lang}.png`), clip: { x: (await page.evaluate(() => innerWidth)) - 360, y: 0, width: 360, height: 100 } });
    sh("xdotool mousemove 10 400"); await wait(300);
  }
  await page.evaluate(() => localStorage.removeItem("oprn:locale"));
  writeFileSync(join(OUT, "i18n.log"), log.join("\n") + "\n");
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === "i18n") { await runI18n(); process.exit(0); }
  if (process.argv[2] === "platforms") { await runPlatforms(); process.exit(0); }
  await runSequence(process.argv[2] ?? "start");
  process.exit(0);
}
