// W1 manual QA — DB modal light theme scope.
// Loads the editor, opens the DB modal, hard-refreshes (stale_state: no cached CSS),
// re-opens, then asserts the modal window bg is light while document.body stays dark.
// Usage: node scripts/qa-light-theme.mjs
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9173";
const SHOT = ".superpowers/sdd/qa-shots/light-theme-modal.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`[console.${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

// expert 모드에서만 클래식 툴바(toolbar-database 포함)가 렌더된다
// (editorUiMode.ts EXPERT_CHROME.classicToolbar=true). 초기 스크립트로 로드 전 세팅 —
// 하드 리프레시에도 유지되므로 stale_state 검증이 그대로 동작한다.
await page.addInitScript(() => {
  try {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  } catch {}
});

async function openDatabaseModal(page) {
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 10_000 });
}

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await openDatabaseModal(page);

  // stale_state: hard refresh so no cached CSS reaches the assert.
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await openDatabaseModal(page);

  const modal = await page.evaluate(() => {
    const win = document.querySelector(".database-modal-window");
    const body = document.body;
    if (!win) return { error: ".database-modal-window not found" };
    const winBg = getComputedStyle(win).backgroundColor;
    const bodyBg = getComputedStyle(body).backgroundColor;
    return { winBg, bodyBg };
  });

  console.log(`MODAL_BG=${modal.winBg}`);
  console.log(`BODY_BG=${modal.bodyBg}`);

  const parseRgb = (css) => {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css ?? "");
    return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : null;
  };

  const win = parseRgb(modal.winBg);
  const body = parseRgb(modal.bodyBg);
  if (!win || !body) throw new Error(`unparseable bg: ${JSON.stringify(modal)}`);

  const winLight = win.r > 200 && win.g > 200 && win.b > 200;
  const bodyDark = body.r <= 40 && body.g <= 40 && body.b <= 40;
  console.log(`MODAL_LIGHT=${winLight} (${win.r},${win.g},${win.b})`);
  console.log(`BODY_DARK=${bodyDark} (${body.r},${body.g},${body.b})`);

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`SHOT_SAVED=${SHOT}`);

  if (!winLight || !bodyDark) {
    throw new Error(`QA FAIL: modal light=${winLight} body dark=${bodyDark}`);
  }
  console.log("QA_PASS");
} finally {
  await browser.close();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(".omo/evidence/start-work/task-1/playwright-console.txt", consoleLines.join("\n") + "\n");
}
